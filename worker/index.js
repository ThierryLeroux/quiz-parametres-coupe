// Serveur du quiz : un Worker Cloudflare (décisions D19 à D23, D31 à D36, D47 à D49, D92 ; API décrite dans SPEC §7).
//   /api/…               → le serveur de correction, en JSON
//   /api/demo/…          → le mode démo (D92) : une séance anonyme, sans trace durable, et le spécimen d'attestation
//   /api/prof/…          → l'espace enseignant, derrière un cookie de séance signé
//   /api/prof/editeur/…  → la Gestion du contenu (exercices, banque, tables, images, sauvegarde) : les écritures, rôle admin
//                          seulement ; dix lectures ouvertes au rôle consultation, sans jamais un brouillon (D95)
//   /prof/editeur        → l'ancienne adresse de la Gestion du contenu : redirigée vers /prof#exercices (D95)
//   le reste             → les fichiers de site/, servis tels quels (liaison ASSETS de wrangler.jsonc)
//
// Ce fichier ne fait que recevoir les requêtes et enchaîner les étapes. Les règles du quiz sont
// dans seance.js, celles de l'attestation dans attestation.js, celles de l'accès (limites de débit,
// verrous, cookie professeur) dans acces.js, celles de la Gestion du contenu dans editeur.js, celles du mode démo
// dans demo.js et celles du spécimen dans specimen.js, le SQL dans base.js, la cryptographie dans crypto.js, le
// chargement des exercices depuis la base dans catalogue.js.

import pkg from '../package.json' with { type: 'json' };
import { validateData, validateTables } from '../site/js/data.js';
import { draftErrors, liveTitleRefusal, maskedFields, sameTitleExercises, sameTitleRefusal, titleKey } from '../site/js/exercice.js';
import { prefillFeedCodes } from '../site/js/code-avance.js';
import { adoptSpeedFactor, adoptSpeedFactors, prefillSpeedFactors, settleSpeedFactors } from '../site/js/facteur-vitesse.js';
import { cleanStudent, matriculeError, nipError, validateStudent } from '../site/js/identification.js';
import {
  ADMIN, CONSULTATION, DISTINCT_PER_HOUR, PURGE_WORD, anonymizedDetails, canAct, clientAddress, hourSlot, isLocked, lockWait, profCookieHeader,
  profFailureLock, profSessionPayload, purgeDetails, readCookie, readProfSessionPayload, refusalLock,
} from './acces.js';
import { buildAttestation, canonical, claimsMatch, claimsOnlyCode, formatCode, newCode, readClaims, verificationUrl } from './attestation.js';
import * as base from './base.js';
import { assembleDraft, loadExercisePresentation, loadLatest, loadPresentation, loadVersion, tablesOf } from './catalogue.js';
import { hashNip, hashToken, newToken, sameSecret, sameText, signAttestation, signProfSession, signSpecimen } from './crypto.js';
import { demoToolChoice, demoView, drawDemoQuestion, expiredBefore, isDemoExpired, isDemoQuestionValid } from './demo.js';
import {
  buildSpecimen, isSpecimenCode, newSeed, readSpecimenClaims, specimenClaimsMatch, specimenClaimsOnlyCode, specimenDates, specimenRequest, specimenUrl,
} from './specimen.js';
import {
  EXPORT_FORMAT, bankImageCheck, bankPassage, bankPassageSummary, cascadeCandidates, cascadePlan, cleanDraft, cleanTables, cleanTool, importDetails, importPlan, importWord, isExerciseId, isToolId, previewQuestions, sameContent,
} from './editeur.js';
import { bankToolDiff, exerciseTablesImpact } from '../site/js/ui/editeur-data.js';
import { isTablesId, nextRevision, tablesContent } from '../site/js/tables.js';
import {
  applyPresentation, archivedWarnings, currentPresentation, normalizePresentation, pendingDraftPresentation, presentData, presentationDiff, presentationErrors,
} from '../site/js/presentation.js';
import {
  applyExercisePresentation, copyNames, currentExercisePresentation, exerciseArchivedWarnings, exercisePresentationDiff, exercisePresentationErrors,
  exercisePresentationOf, exerciseValues, knownCopies, normalizeExercisePresentation, pendingExercisePresentation, presentSessionView, withLiveTitle,
} from '../site/js/presentation-exercice.js';
import {
  NIP_CLEARED, TOKEN_LIFETIME_MS, cadenceWait, cleanAnswers, correctionView, countNipAttempt, drawQuestion, emptyCounters,
  cadenceFor, gradeQuestion, isNipLocked, isQuestionValid, isTestMode, later, sessionView,
} from './seance.js';
import {
  ImageError, UPLOAD_BODY_MAX, encodeBase64, imageHeaders, imageUsages, imageView, isImageId, isUsed, readUpload, toBlob, toBytes, usagesText,
} from './images.js';

// Réponse JSON, jamais mise en cache : une réponse de l'API ne vaut que pour l'instant présent.
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

// Erreur destinée à l'étudiant : devient { "erreur": message, …extra } avec ce code HTTP.
class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const SESSION_EXPIRED = 'Ta séance a expiré. Identifie-toi de nouveau.';

// Le corps JSON d'une requête. Les requêtes du quiz sont courtes ; celles de la Gestion du contenu portent des
// exercices entiers (des dizaines de Ko), et un import, toute la sauvegarde.
const BODY_MAX = 10000;
const EDITOR_BODY_MAX = 4_000_000;

async function readBody(request, max = BODY_MAX) {
  const text = await request.text();
  if (text.length > max) throw new HttpError(400, 'Requête trop longue.');
  try {
    const body = JSON.parse(text);
    if (body !== null && typeof body === 'object' && !Array.isArray(body)) return body;
  } catch {
    // traité ci-dessous
  }
  throw new HttpError(400, 'Requête illisible : du JSON est attendu.');
}

// --- L'exercice nommé par la requête (D21), lu dans la base (D47) ----------------------------------------------

const NO_SUCH_EXERCISE = "Cet exercice n'existe pas.";
const ARCHIVED_EXERCISE = "Cet exercice n'est plus offert.";

// La fiche d'un exercice publié : sa dernière version, et si l'exercice est archivé. 400 s'il n'existe
// pas ou n'a jamais été publié : pour le serveur, un exercice sans version publiée n'existe pas.
async function findExercise(env, id) {
  if (!isExerciseId(id)) throw new HttpError(400, NO_SUCH_EXERCISE);
  const record = await base.findExercise(env.DB, id);
  const latest = record === null ? null : await loadLatest(env.DB, id);
  if (latest === null) throw new HttpError(400, NO_SUCH_EXERCISE);
  return { ...latest, archived: record.archive_le !== null };
}

// La présentation en vigueur d'un exercice publié (D78) : ce que le serveur pose par-dessus ce qu'il MONTRE de toute
// version de l'exercice (titre, cours, « À l'accueil », photo et note des copies) — jamais sur le tirage ni la correction.
//   latest : sa dernière version assemblée (findExercise)
async function livePresentation(env, latest) {
  return (await loadExercisePresentation(env.DB, latest.exercise.id, latest.version.contenu)).contenu;
}

// Les présentations en vigueur de tous les exercices publiés (D78) : Map id → présentation ; un exercice jamais publié
// n'y est pas (sa présentation est celle de son brouillon : shownPresentation).
//   rows : base.listExercises (contenu_publie : le contenu de la dernière version)
async function livePresentations(env, rows) {
  const stored = await base.listExercisePresentations(env.DB);
  return new Map(rows.filter((row) => row.contenu_publie !== null).map((row) => [row.id, currentExercisePresentation(stored.get(row.id)?.contenu ?? null, row.contenu_publie)]));
}

// Ce qu'un exercice montre de sa présentation : celle en vigueur s'il a été publié, sinon celle de son brouillon.
const shownPresentation = (row, presentations) => presentations.get(row.id) ?? exercisePresentationOf(row.brouillon);

// La séance telle que le serveur la montre (D78) : sessionView, avec la présentation en vigueur de l'exercice par-dessus
// (le titre de la barre, la photo et la note de l'outil de la question). La séance elle-même n'en sait rien.
const shownSession = (session, exercise, data, options, presentation) => presentSessionView(sessionView(session, exercise, data, options), presentation);

// La version épinglée à une séance (D47) : celle de sa création, jusqu'à la fin. Une séance sans
// version (créée par l'ancien serveur entre la migration et le déploiement) prend la dernière
// publiée, et y reste épinglée désormais.
async function loadSessionVersion(env, session, latest) {
  if (session.version_id === null) {
    await base.pinSessionVersion(env.DB, session.id, latest.version.id);
    return latest;
  }
  return loadVersion(env.DB, session.version_id);
}

// La séance du jeton présenté, avec sa version d'exercice. Jeton absent, inconnu, expiré ou d'un
// autre exercice → 401 : le navigateur renvoie alors à l'identification. Un appel accepté prolonge
// le jeton de 2 h. Retourne { session, data, exercise }.
async function authenticate(request, env, latest, now) {
  const [, token] = (request.headers.get('authorization') ?? '').match(/^Bearer ([A-Za-z0-9_-]{20,100})$/) ?? [];
  const session = token ? await base.findSessionByToken(env.DB, await hashToken(token)) : null;
  if (session === null || session.exercice_id !== latest.exercise.id || session.jeton_expire_le <= now.toISOString()) {
    throw new HttpError(401, SESSION_EXPIRED);
  }
  await base.touchSession(env.DB, session.id, now.toISOString(), later(now, TOKEN_LIFETIME_MS));
  const { data, exercise } = await loadSessionVersion(env, session, latest);
  return { session, data, exercise };
}

// --- Limites de débit par adresse (D36, D86, D92) ------------------------------------------------------
// Consultation d'un matricule, vérification d'un code, démos commencées (D92) : au plus DISTINCT_PER_HOUR
// valeurs DISTINCTES par adresse et par heure (1000 depuis D86 ; acces.js), jamais de limite sur le nombre
// de requêtes (tout le cégep sort par une adresse). La 1001e valeur est refusée et verrouille l'adresse
// 10 minutes pour cette portée seule ; une valeur déjà vue passe toujours.

const TOO_MANY_REQUESTS = 'Trop de demandes depuis cette adresse. Réessaie dans quelques minutes.';

async function limitRate(request, env, portee, valeur, now) {
  const adresse = clientAddress(request);
  const lock = await base.findLock(env.DB, portee, adresse);
  if (isLocked(lock, now)) throw new HttpError(429, TOO_MANY_REQUESTS, { attendre_s: lockWait(lock, now) });
  const { nouvelle, distinctes } = await base.countDistinct(env.DB, portee, adresse, hourSlot(now), valeur);
  if (nouvelle && distinctes > DISTINCT_PER_HOUR) {
    const refusal = refusalLock(now);
    await base.forgetDistinct(env.DB, portee, adresse, hourSlot(now), valeur); // une valeur refusée n'est pas « vue »
    await base.setLock(env.DB, portee, adresse, refusal);
    throw new HttpError(429, TOO_MANY_REQUESTS, { attendre_s: lockWait(refusal, now) });
  }
}

// --- Attestation (D31 à D33) ----------------------------------------------------------------------------

// L'attestation en cours d'une séance réussie, créée si elle n'existe pas encore : à la réussite,
// ou à la première ouverture d'une séance réussie avant cette version. L'enregistrement est figé
// à cet instant et signé (sous-clé « attestation » de CLE_SECRETE) ; il liste les questions
// réussies qui comptent, lues dans le journal des corrections (D41). Un code tiré qui serait déjà
// pris fait échouer l'insertion (UNIQUE) : on en tire un autre (D42). Le titre qu'il inscrit est celui en vigueur à cet
// instant (D78) : l'appelant passe l'exercice avec ce titre (withLiveTitle) ; une attestation déjà émise n'est jamais relue.
//   session : la ligne de la séance, à jour (reussite_le non nul)
//   tools   : { randomBytes } — l'aléa des codes, que les tests remplacent
async function ensureAttestation(env, session, exercise, data, now, tools) {
  let current = await base.findCurrentAttestation(env.DB, session.id);
  for (let attempt = 0; current === null && attempt < 5; attempt += 1) {
    const record = buildAttestation(session, exercise, data, newCode(tools.randomBytes), await base.listCorrections(env.DB, session.id));
    await base.createAttestation(env.DB, {
      seance_id: session.id,
      code: record.code,
      enregistrement: record,
      signature: await signAttestation(env.CLE_SECRETE, canonical(record)),
      creee_le: now.toISOString(),
    });
    current = await base.findCurrentAttestation(env.DB, session.id); // la nôtre, ou celle d'une requête plus rapide
  }
  if (current === null) throw new Error("impossible d'enregistrer l'attestation (codes en conflit)");
  return current;
}

// Ce que le navigateur reçoit d'une attestation : l'enregistrement, le code présenté 5-5, la
// signature et l'adresse de vérification que porte le QR (D33). L'adresse du site est celle de la
// requête : elle n'est pas dans l'enregistrement, le site peut déménager.
function attestationView(request, row) {
  return {
    attestation: row.enregistrement,
    code: formatCode(row.code),
    signature: row.signature,
    url_verification: verificationUrl(new URL(request.url).origin, row.enregistrement, row.signature),
    annulee_le: row.annulee_le,
  };
}

// Les options des vues de seance.js : l'heure (pour attendre_s, la cadence), le mode test (D26) et
// la cadence réglable (D39) — décidés ici, par le serveur seul : les variables MODE_TEST et
// CADENCE_S de .dev.vars, et une requête adressée au poste lui-même.
function viewOptions(request, env, now) {
  const { hostname } = new URL(request.url);
  return { now, testMode: isTestMode(env.MODE_TEST, hostname), cadenceMs: cadenceFor(env.CADENCE_S, hostname) };
}

// --- L'exercice pour le navigateur (D47) ---------------------------------------------------------------------
// Le navigateur ne lit plus les JSON de site/ : il demande l'exercice au serveur — la dernière version
// publiée pour l'accueil, ou la version épinglée à sa séance (?version=<n>) pour l'écran Question,
// les feuilles de référence et les noms des outils. Rien de secret : les tables sont celles des
// feuilles imprimées, et les copies d'outils ce qu'outils.json publiait.

// Les tables y sont montrées avec la présentation en vigueur posée par-dessus (D76), et l'exercice avec la sienne (D78 :
// titre, cours, « À l'accueil », photo et note des copies) : elles changent sans nouvelle version, pour toutes les
// versions ; le catalogue gardé en mémoire, qui tire et corrige, n'est pas touché.
function exerciseView({ data, exercise, version }, archived, presentation, exercisePresentation) {
  const shown = { ...exercise, outils: data.outils.map((tool) => ({ ...tool, reussites_requises: exercise.outils.find((entry) => entry.id === tool.id).reussites_requises })) };
  return {
    exercice: applyExercisePresentation(shown, exercisePresentation),
    tables: tablesView(presentData(data, presentation)),
    version: version.numero,
    archive: archived,
  };
}

// Les deux tables d'un catalogue assemblé, au format de SPEC §3, complètes (D61) : classes ISO et
// matières d'outil avec leurs couleurs, opérations avec leur pictogramme.
function tablesView(data) {
  return {
    materiaux: { revision: data.revisions.materiaux, classes_iso: data.classesIso, materiaux_outil: data.toolMaterials, groupes_iso: [...data.materialsByGroup.keys()], materiaux: data.materiaux },
    operations: { revision: data.revisions.operations, operations: data.operations },
  };
}

// GET /api/tables?version=<id> — une version des tables de référence, publique (les feuilles imprimables
// par version, D63) : rien de secret, ce sont les feuilles de l'atelier. Ses valeurs, avec la présentation en vigueur (D76).
async function tables(request, env) {
  const id = new URL(request.url).searchParams.get('version');
  const row = isTablesId(id) ? await base.findTables(env.DB, id) : null;
  if (row === null) throw new HttpError(404, "Cette version des tables de référence n'existe pas.");
  const presentation = await loadPresentation(env.DB);
  return json({ tables: { id: row.id, creee_le: row.creee_le, ...applyPresentation(tablesOf(row), presentation.contenu) } });
}

// GET /api/exercice?exercice=<id>[&version=<n>] — l'exercice publié (sa dernière version, ou celle demandée).
// La page Question, les feuilles du quiz et la page de description la lisent : c'est ici que la présentation en
// vigueur les atteint, séances en cours comprises (D76), dès que la page se recharge.
async function exercice(request, env) {
  const params = new URL(request.url).searchParams;
  const latest = await findExercise(env, params.get('exercice'));
  const presentation = (await loadPresentation(env.DB)).contenu;
  const live = await livePresentation(env, latest); // la même pour toutes ses versions (D78)
  const wanted = params.get('version');
  if (wanted === null || Number(wanted) === latest.version.numero) return json(exerciseView(latest, latest.archived, presentation, live));
  const version = /^[1-9]\d*$/.test(wanted) ? await base.findVersion(env.DB, latest.exercise.id, Number(wanted)) : null;
  if (version === null) throw new HttpError(404, "Cette version de l'exercice n'existe pas.");
  return json(exerciseView(await loadVersion(env.DB, version.id), latest.archived, presentation, live));
}

// GET /api/exercices — la liste de l'accueil (D18) : publiés, non archivés, « À l'accueil », dans l'ordre des rangs
// (D51). Chacun avec son titre et son cours (D71 : l'accueil les regroupe) en vigueur (D78), son nombre d'outils et ses
// grandeurs évaluées, tels que sa dernière version les publie.
async function exercices(request, env) {
  const rows = await base.listPublishedExercises(env.DB);
  const stored = await base.listExercisePresentations(env.DB);
  const shown = rows.map((row) => ({ row, live: currentExercisePresentation(stored.get(row.id)?.contenu ?? null, row.contenu) }));
  return json({
    exercices: shown.filter(({ row, live }) => row.archive_le === null && live.liste).map(({ row, live }) => ({
      id: row.id,
      titre: live.titre,
      cours: live.cours,
      nombre_outils: row.contenu.outils.length,
      champs_evalues: row.contenu.champs_evalues,
    })),
  });
}

// --- Identification en deux temps (D23) ------------------------------------------------------------------

const ALREADY_EXISTS = 'Ce matricule a déjà une séance pour cet exercice.';

// Le premier message d'erreur des règles d'identification.js, ou rien : requête mal formée → 400.
function requireValid(...errors) {
  const message = errors.flat().find((error) => error !== null);
  if (message !== undefined) throw new HttpError(400, message);
}

// Vérifie le NIP présenté pour une séance ; retourne normalement s'il est le bon, lève 401 ou 429.
// Verrou d'abord ; puis l'essai est compté AVANT d'être examiné : des essais lancés en parallèle
// ne passent pas tous. nip_hache nul = NIP remis à zéro par l'enseignant : le NIP présenté est adopté.
async function checkNip(env, session, nip, now) {
  const nipHash = await hashNip(env.CLE_SECRETE, session.matricule, nip);
  const tooMany = new HttpError(429, "Trop d'essais. Attends 10 minutes avant de réessayer.");
  if (isNipLocked(session, now)) throw tooMany;
  if (!await base.takeNipAttempt(env.DB, session, countNipAttempt(session, now))) throw tooMany;
  if (session.nip_hache !== null && !sameText(session.nip_hache, nipHash)) throw new HttpError(401, 'NIP incorrect.');
}

// Un nouveau jeton de séance : ce qu'on envoie une fois, et ce que la base en garde.
async function freshToken(now) {
  const token = newToken();
  return { token, stored: { jeton_hache: await hashToken(token), jeton_expire_le: later(now, TOKEN_LIFETIME_MS) } };
}

// --- POST /api/consultation — écran 1/2 : ce matricule a-t-il une séance pour cet exercice ?
// Répond le prénom et l'initiale du nom, pour que l'étudiant se reconnaisse. Rien d'autre ne sort.
async function consultation(request, env, { now }) {
  const body = await readBody(request);
  const latest = await findExercise(env, body.exercice);
  requireValid(matriculeError(body.matricule));
  const matricule = body.matricule.trim();
  await limitRate(request, env, 'consultation', matricule, now);
  const session = await base.findSession(env.DB, latest.exercise.id, matricule);
  if (session === null) {
    if (latest.archived) throw new HttpError(400, ARCHIVED_EXERCISE); // plus de nouvelle séance ; les séances existantes continuent
    return json({ trouvee: false });
  }
  return json({ trouvee: true, prenom: session.prenom, initiale: [...session.nom][0].toUpperCase() });
}

// --- POST /api/creation — écran 2/2, aucune séance : prénom, nom, matricule, NIP choisi.
// Ne reprend jamais une séance existante : 409, et l'écran renvoie à la reprise. La séance est
// épinglée à la dernière version publiée (D47).
async function creation(request, env, { now }) {
  const body = await readBody(request);
  const latest = await findExercise(env, body.exercice);
  if (latest.archived) throw new HttpError(400, ARCHIVED_EXERCISE);
  const { data, exercise, version } = latest;
  requireValid(validateStudent(body));
  const student = cleanStudent(body);
  const { token, stored } = await freshToken(now);
  const created = await base.createSession(env.DB, {
    ...stored,
    nip_hache: await hashNip(env.CLE_SECRETE, student.matricule, student.nip),
    exercice_id: exercise.id,
    matricule: student.matricule,
    prenom: student.prenom,
    nom: student.nom,
    debut: now.toISOString(),
    version_exercice: exercise.version,
    version_id: version.id,
    compteurs: emptyCounters(),
  });
  if (!created) throw new HttpError(409, ALREADY_EXISTS);
  const session = await base.findSession(env.DB, exercise.id, student.matricule);
  return json({ jeton: token, seance: shownSession(session, exercise, data, viewOptions(request, env, now), await livePresentation(env, latest)) });
}

// --- POST /api/reprise — écran 2/2, séance trouvée : matricule + NIP. Ni prénom ni nom.
async function reprise(request, env, { now }) {
  const body = await readBody(request);
  const latest = await findExercise(env, body.exercice);
  requireValid(matriculeError(body.matricule), nipError(body.nip));
  const matricule = body.matricule.trim();
  const nip = body.nip.trim();

  const session = await base.findSession(env.DB, latest.exercise.id, matricule);
  if (session === null) throw new HttpError(404, "Aucune séance pour ce matricule dans cet exercice.");
  await checkNip(env, session, nip, now);

  const { token, stored } = await freshToken(now);
  // nip_hache est réécrit : c'est ainsi qu'un NIP remis à zéro par l'enseignant est remplacé.
  await base.openSession(env.DB, session.id, { ...stored, nip_hache: await hashNip(env.CLE_SECRETE, matricule, nip), now: now.toISOString(), cleared: NIP_CLEARED });
  const { data, exercise } = await loadSessionVersion(env, session, latest);
  return json({ jeton: token, seance: shownSession(await base.findSessionById(env.DB, session.id), exercise, data, viewOptions(request, env, now), await livePresentation(env, latest)) });
}

// --- POST /api/identite — « Corriger mon identité » : prénom, nom, matricule ; NIP exigé.
// La séance est déplacée, jamais copiée ; la correction est journalisée. Le jeton reste le même.
// Après la réussite (D37) : l'attestation en cours est annulée (« identité corrigée ») et une
// nouvelle est émise — mêmes résultats, mêmes dates, nouvelle identité, nouveau code — dans le même lot.
// Si le code tiré est déjà pris, on en tire un autre (D42).
async function identite(request, env, { now, randomBytes }) {
  const body = await readBody(request);
  const latest = await findExercise(env, body.exercice);
  const { session, data, exercise } = await authenticate(request, env, latest, now);
  requireValid(validateStudent(body));
  const identity = cleanStudent(body);
  await checkNip(env, session, identity.nip, now);
  await base.clearNipAttempts(env.DB, session.id, NIP_CLEARED);

  const changed = ['prenom', 'nom', 'matricule'].some((key) => identity[key] !== session[key]);
  const live = await livePresentation(env, latest);
  if (changed) {
    const current = session.reussite_le === null ? null : await ensureAttestation(env, session, withLiveTitle(exercise, live), data, now, { randomBytes });
    // Le NIP est haché avec le matricule (crypto.js) : nouveau matricule, nouveau haché du même NIP.
    const moved = { ...identity, nip_hache: await hashNip(env.CLE_SECRETE, identity.matricule, identity.nip) };
    let outcome = 'code';
    for (let attempt = 0; outcome === 'code' && attempt < 5; attempt += 1) {
      let reissue = null;
      if (current !== null) {
        const record = { ...current.enregistrement, code: newCode(randomBytes), etudiant: { prenom: identity.prenom, nom: identity.nom, matricule: identity.matricule } };
        reissue = { ancienne: current, nouvelle: { code: record.code, enregistrement: record, signature: await signAttestation(env.CLE_SECRETE, canonical(record)) } };
      }
      outcome = await base.moveSession(env.DB, session, moved, now.toISOString(), reissue);
    }
    if (outcome === 'matricule') throw new HttpError(409, ALREADY_EXISTS);
    if (outcome !== 'ok') throw new Error("impossible de réémettre l'attestation (codes en conflit)");
  }
  return json({ seance: shownSession(await base.findSessionById(env.DB, session.id), exercise, data, viewOptions(request, env, now), live) });
}

// --- GET /api/seance?exercice=<id> ---------------------------------------------------------------------
// L'état de la séance, sans rien tirer.
async function seance(request, env, { now }) {
  const latest = await findExercise(env, new URL(request.url).searchParams.get('exercice'));
  const { session, data, exercise } = await authenticate(request, env, latest, now);
  return json({ seance: shownSession(session, exercise, data, viewOptions(request, env, now), await livePresentation(env, latest)) });
}

// --- POST /api/question ----------------------------------------------------------------------------------
// La question à laquelle répondre. C'est le serveur qui la tire et la mémorise ; tant qu'elle n'est
// pas corrigée, c'est toujours la même qui revient : on ne « passe » pas une question.
async function question(request, env, { now, random, randomBytes }) {
  const body = await readBody(request);
  const latest = await findExercise(env, body.exercice);
  let { session, data, exercise } = await authenticate(request, env, latest, now);
  const live = await livePresentation(env, latest);

  if (session.reussite_le === null && !isQuestionValid(session.question_courante, session.compteurs, exercise, data)) {
    const drawn = drawQuestion(session.compteurs, exercise, data, random);
    // Plus rien à tirer sans être passé par une correction : l'exercice a été allégé en cours de session (D21).
    const completion = drawn === null ? { reussite_le: now.toISOString(), version_exercice_reussite: exercise.version } : null;
    await base.saveQuestion(env.DB, session, drawn, completion); // si une autre requête a tiré avant nous, c'est sa question qui vaut
    session = await base.findSessionById(env.DB, session.id);
    if (session.reussite_le !== null) await ensureAttestation(env, session, withLiveTitle(exercise, live), data, now, { randomBytes });
  }
  return json({ seance: shownSession(session, exercise, data, viewOptions(request, env, now), live) });
}

// --- POST /api/correction --------------------------------------------------------------------------------
// Corrige la question mémorisée — jamais une question venue du navigateur —, met les compteurs à
// jour, journalise, et tire la question suivante (ou constate la réussite).
async function correction(request, env, { now, random, randomBytes }) {
  const body = await readBody(request);
  const latest = await findExercise(env, body.exercice);
  const { session, data, exercise } = await authenticate(request, env, latest, now);

  if (session.reussite_le !== null || !isQuestionValid(session.question_courante, session.compteurs, exercise, data)) {
    throw new HttpError(409, "Aucune question n'attend de correction.");
  }
  const wait = cadenceWait(session, now, viewOptions(request, env, now));
  if (wait > 0) throw new HttpError(429, `Attends encore ${wait} s avant de faire corriger ta réponse.`, { attendre_s: wait });

  const asked = session.question_courante;
  const answers = cleanAnswers(body.saisies);
  const before = session.compteurs.reussites[asked.tool.id] ?? 0;
  const graded = gradeQuestion(asked, answers, session.compteurs, exercise, data);
  const next = drawQuestion(graded.counters, exercise, data, random);

  const recorded = await base.recordCorrection(env.DB, session, {
    outil_id: asked.tool.id,
    question: asked,
    reponses: answers,
    resultat: graded.result,
    reussie: graded.success,
    horodatage: now.toISOString(),
    compteurs: graded.counters,
    question_suivante: next,
    completion: next === null ? { reussite_le: now.toISOString(), version_exercice_reussite: exercise.version } : null,
  });
  if (!recorded) throw new HttpError(429, 'Une correction de cette question est déjà en cours.', { attendre_s: 1 });

  const updated = await base.findSessionById(env.DB, session.id);
  const live = await livePresentation(env, latest);
  // La dernière réussite exigée vient d'être obtenue : l'attestation est figée tout de suite (D31), avec le titre en vigueur (D78).
  if (updated.reussite_le !== null) await ensureAttestation(env, updated, withLiveTitle(exercise, live), data, now, { randomBytes });
  return json({
    correction: correctionView(asked, answers, graded.result, before, graded.counters, data, maskedFields(exercise)),
    seance: shownSession(updated, exercise, data, viewOptions(request, env, now), live),
  });
}

// --- GET /api/attestation?exercice=<id> ------------------------------------------------------------------
// L'attestation de la séance, une fois l'exercice réussi ; un étudiant la retrouve par la reprise
// de séance. Une séance réussie avant cette version reçoit la sienne ici, à la première ouverture.
async function attestation(request, env, { now, randomBytes }) {
  const latest = await findExercise(env, new URL(request.url).searchParams.get('exercice'));
  const { session, data, exercise } = await authenticate(request, env, latest, now);
  if (session.reussite_le === null) throw new HttpError(409, "L'exercice n'est pas encore réussi.");
  return json(attestationView(request, await ensureAttestation(env, session, withLiveTitle(exercise, await livePresentation(env, latest)), data, now, { randomBytes })));
}

// --- POST /api/verification — public, sans connexion (D33) -------------------------------------------------
// Deux entrées : l'adresse du QR (tous les champs et la signature), ou le code seul. Quatre issues :
// valide, annulee (remise à zéro ou identité corrigée, avec la date et le motif), aucune (aucune attestation ne correspond),
// invalide (signature invalide ou contenu modifié). Une attestation ne se vérifie pas à moitié : si
// l'adresse porte autre chose que le code, tout doit correspondre. Rien ne sort de plus que
// l'attestation imprimée. Limite de débit sur les codes distincts.
// Le code d'un spécimen du mode démo (D92, point 9) prend un autre chemin : verificationSpecimen, deux issues de plus
// (specimen, specimen_code). Une vraie attestation ne passe jamais par là, un spécimen jamais par ici.
async function verification(request, env, { now }) {
  const body = await readBody(request);
  if (isSpecimenCode(body.code)) return verificationSpecimen(request, env, body, now);
  const claims = readClaims(body);
  if (claims === null) throw new HttpError(400, 'Le code doit avoir 10 caractères (lettres et chiffres, sans O, I, 0 ni 1).');
  await limitRate(request, env, 'verification', claims.code, now);

  const row = await base.findAttestationByCode(env.DB, claims.code);
  if (row === null) return json({ resultat: 'aucune' });
  // La signature est recomposée à partir de l'enregistrement que le serveur détient : elle doit
  // être celle qu'il a stockée, et celle que l'adresse présente.
  const expected = await signAttestation(env.CLE_SECRETE, canonical(row.enregistrement));
  const genuine = sameText(expected, row.signature) && (claimsOnlyCode(claims) || (sameText(expected, claims.signature) && claimsMatch(row.enregistrement, claims)));
  if (!genuine) return json({ resultat: 'invalide' });
  if (row.annulee_le !== null) return json({ resultat: 'annulee', attestation: row.enregistrement, annulee_le: row.annulee_le, motif: row.annulation_motif });
  return json({ resultat: 'valide', attestation: row.enregistrement });
}

// La vérification d'un spécimen (D92, 9.4 à 9.6) : rien n'est enregistré, le spécimen est RECOMPOSÉ à partir de ce
// que l'adresse porte (la version de l'exercice, la graine, les dates, le titre), signé de nouveau sous la sous-clé
// des spécimens, et comparé champ par champ à l'adresse. Le code seul (tapé à la main) : specimen_code — « scanne son
// QR ». Tout le reste : specimen (avec l'enregistrement recomposé), ou invalide — un seul caractère changé dans
// l'adresse recompose autre chose, ou ne correspond plus.
async function verificationSpecimen(request, env, body, now) {
  const claims = readSpecimenClaims(body);
  await limitRate(request, env, 'verification', claims.code, now);
  if (specimenClaimsOnlyCode(claims)) return json({ resultat: 'specimen_code' });
  const wanted = specimenRequest(claims);
  const version = wanted !== null && isExerciseId(wanted.exercice) ? await base.findVersion(env.DB, wanted.exercice, wanted.revision) : null;
  if (version === null) return json({ resultat: 'invalide' });
  const { data, exercise } = await loadVersion(env.DB, version.id);
  const record = buildSpecimen({ ...exercise, titre: wanted.titre }, data, { seed: wanted.seed, debut: wanted.debut, reussite: wanted.reussite });
  const expected = await signSpecimen(env.CLE_SECRETE, canonical(record));
  if (!sameText(expected, claims.signature) || !specimenClaimsMatch(record, claims)) return json({ resultat: 'invalide' });
  return json({ resultat: 'specimen', attestation: record });
}

// --- Le mode démo : /api/demo/… (D92) ------------------------------------------------------------------------
// Une séance ANONYME, sans identification, qui ne laisse aucune trace durable : son état vit dans la table demos
// (jamais dans seances, corrections ni attestations), 24 h au plus après sa dernière activité. Le serveur tire la
// question et la corrige exactement comme pour une séance (seance.js) ; les règles propres à la démo sont dans
// demo.js. Un jeton de démo n'ouvre aucune route de séance (elles ne lisent que seances), et inversement.

const DEMO_EXPIRED = "Cette démo n'existe plus : commence-en une autre.";

// La démo du jeton présenté, avec sa version d'exercice épinglée. Jeton absent, inconnu, expiré ou d'un autre
// exercice → 401 : le navigateur ramène au choix de l'outil. Un appel accepté repousse l'expiration.
async function authenticateDemo(request, env, latest, now) {
  const [, token] = (request.headers.get('authorization') ?? '').match(/^Bearer ([A-Za-z0-9_-]{20,100})$/) ?? [];
  const demo = token ? await base.findDemoByToken(env.DB, await hashToken(token)) : null;
  if (demo === null || demo.exercice_id !== latest.exercise.id || isDemoExpired(demo, now)) throw new HttpError(401, DEMO_EXPIRED);
  await base.touchDemo(env.DB, demo.id, now.toISOString());
  const { data, exercise } = await loadVersion(env.DB, demo.version_id);
  return { demo, data, exercise };
}

// La démo telle que le serveur la montre : demoView, avec la présentation en vigueur de l'exercice par-dessus (D78 :
// le titre de la barre, la photo et la note de l'outil de la question), comme une séance.
const shownDemo = (demo, exercise, data, options, presentation) => presentSessionView(demoView(demo, exercise, data, options), presentation);

// L'outil choisi, lu dans le corps de la requête : null (au hasard) ou un outil de l'exercice ; 400 sinon.
function demoChoice(body, exercise) {
  const chosen = demoToolChoice(body.outil, exercise);
  if (chosen === undefined) throw new HttpError(400, "Cet outil n'est pas dans l'exercice.");
  return chosen;
}

// --- POST /api/demo/creation — { exercice, outil } : une démo sur la version en vigueur, sa première question tirée.
// Limite de débit sur les démos commencées (portée « demo », à elle seule) ; les démos expirées sont effacées ici.
async function demoCreation(request, env, { now, random }) {
  const body = await readBody(request);
  const latest = await findExercise(env, body.exercice);
  if (latest.archived) throw new HttpError(400, ARCHIVED_EXERCISE);
  const { data, exercise, version } = latest;
  const chosen = demoChoice(body, exercise);
  const token = newToken();
  const tokenHash = await hashToken(token);
  await limitRate(request, env, 'demo', tokenHash, now);
  await base.deleteExpiredDemos(env.DB, expiredBefore(now));
  const id = await base.createDemo(env.DB, {
    jeton_hache: tokenHash,
    exercice_id: exercise.id,
    version_id: version.id,
    outil_choisi: chosen,
    compteurs: emptyCounters(),
    question_courante: drawDemoQuestion(emptyCounters(), exercise, data, random, chosen),
    creee_le: now.toISOString(),
  });
  const demo = await base.findDemoById(env.DB, id);
  return json({ jeton: token, demo: shownDemo(demo, exercise, data, viewOptions(request, env, now), await livePresentation(env, latest)) });
}

// --- POST /api/demo/question — { exercice } : la question en attente, tirée au besoin ; jamais null.
async function demoQuestion(request, env, { now, random }) {
  const body = await readBody(request);
  const latest = await findExercise(env, body.exercice);
  let { demo, data, exercise } = await authenticateDemo(request, env, latest, now);
  if (!isDemoQuestionValid(demo.question_courante, exercise, data, demo.outil_choisi)) {
    await base.saveDemoQuestion(env.DB, demo, drawDemoQuestion(demo.compteurs, exercise, data, random, demo.outil_choisi), demo.outil_choisi);
    demo = await base.findDemoById(env.DB, demo.id);
  }
  return json({ demo: shownDemo(demo, exercise, data, viewOptions(request, env, now), await livePresentation(env, latest)) });
}

// --- POST /api/demo/outil — { exercice, outil } : l'outil des prochaines questions (D92, point 6). Choisir un outil
// remplace la question en attente si elle n'est pas de cet outil (rien n'est compté) ; « Au hasard » la garde.
async function demoOutil(request, env, { now, random }) {
  const body = await readBody(request);
  const latest = await findExercise(env, body.exercice);
  let { demo, data, exercise } = await authenticateDemo(request, env, latest, now);
  const chosen = demoChoice(body, exercise);
  const question = isDemoQuestionValid(demo.question_courante, exercise, data, chosen) ? demo.question_courante : drawDemoQuestion(demo.compteurs, exercise, data, random, chosen);
  await base.saveDemoQuestion(env.DB, demo, question, chosen);
  demo = await base.findDemoById(env.DB, demo.id);
  return json({ demo: shownDemo(demo, exercise, data, viewOptions(request, env, now), await livePresentation(env, latest)) });
}

// --- POST /api/demo/correction — { exercice, saisies } : la même correction qu'une séance (gradeQuestion,
// correctionView), la même cadence ; les compteurs continuent, la question suivante est toujours tirée (à 100 %,
// parmi tous les outils) ; rien n'est journalisé.
async function demoCorrection(request, env, { now, random }) {
  const body = await readBody(request);
  const latest = await findExercise(env, body.exercice);
  const { demo, data, exercise } = await authenticateDemo(request, env, latest, now);
  if (!isDemoQuestionValid(demo.question_courante, exercise, data, demo.outil_choisi)) throw new HttpError(409, "Aucune question n'attend de correction.");
  const wait = cadenceWait(demo, now, viewOptions(request, env, now));
  if (wait > 0) throw new HttpError(429, `Attends encore ${wait} s avant de faire corriger ta réponse.`, { attendre_s: wait });

  const asked = demo.question_courante;
  const answers = cleanAnswers(body.saisies);
  const before = demo.compteurs.reussites[asked.tool.id] ?? 0;
  const graded = gradeQuestion(asked, answers, demo.compteurs, exercise, data);
  const next = drawDemoQuestion(graded.counters, exercise, data, random, demo.outil_choisi);
  const recorded = await base.recordDemoCorrection(env.DB, demo, { compteurs: graded.counters, question_suivante: next, horodatage: now.toISOString() });
  if (!recorded) throw new HttpError(429, 'Une correction de cette question est déjà en cours.', { attendre_s: 1 });
  const updated = await base.findDemoById(env.DB, demo.id);
  return json({
    correction: correctionView(asked, answers, graded.result, before, graded.counters, data, maskedFields(exercise)),
    demo: shownDemo(updated, exercise, data, viewOptions(request, env, now), await livePresentation(env, latest)),
  });
}

// --- GET /api/demo/specimen?exercice=<id> — un spécimen d'attestation (D92, point 9), composé à la volée pour la
// version en vigueur de l'exercice, jamais enregistré, signé sous la sous-clé des spécimens. Sans jeton : il ne
// dépend d'aucune démo. Même forme que GET /api/attestation, avec `specimen: true`.
async function demoSpecimen(request, env, { now, random }) {
  const latest = await findExercise(env, new URL(request.url).searchParams.get('exercice'));
  if (latest.archived) throw new HttpError(400, ARCHIVED_EXERCISE);
  const { data, exercise } = latest;
  const record = buildSpecimen(withLiveTitle(exercise, await livePresentation(env, latest)), data, { seed: newSeed(random), ...specimenDates(now, exercise) });
  const signature = await signSpecimen(env.CLE_SECRETE, canonical(record));
  return json({
    attestation: record,
    code: formatCode(record.code),
    signature,
    url_verification: specimenUrl(new URL(request.url).origin, record, signature),
    annulee_le: null,
    specimen: true,
  });
}

// --- Espace enseignant : /api/prof/… (D34, D35, D44, D95) ------------------------------------------------------
// Deux clés : CLE_ADMIN ouvre le rôle « admin », CLE_CONSULTATION (facultative) le rôle
// « consultation », lecture seule. L'enseignant s'appelle comme son rôle, pour l'instant. La séance
// est un cookie signé (acces.js) qui porte le rôle ; chaque route le vérifie : aucune ne répond sans
// lui, et les routes d'action refusent le rôle consultation (403) — le serveur, pas seulement l'écran.

const ACTION_RESERVED = "Cette action est réservée à la clé d'administration : la clé de consultation ne fait que lire.";

async function requireTeacher(request, env, now) {
  const [payload, signature] = (readCookie(request.headers.get('cookie')) ?? '').split('.');
  const session = payload && signature ? readProfSessionPayload(payload, now) : null;
  if (session === null || !sameText(await signProfSession(env.CLE_SECRETE, payload), signature)) {
    throw new HttpError(401, 'Connexion requise.');
  }
  return session;
}

async function requireAdmin(request, env, now) {
  const session = await requireTeacher(request, env, now);
  if (!canAct(session.role)) throw new HttpError(403, ACTION_RESERVED);
  return session;
}

// Une lecture de la Gestion du contenu ouverte aux deux rôles (D95) : la séance, et `reader` — le rôle consultation, qui ne
// reçoit que ce qui est publié, jamais un brouillon.
async function requireReader(request, env, now) {
  const session = await requireTeacher(request, env, now);
  return { ...session, reader: !canAct(session.role) };
}

// Le rôle qu'ouvre la clé présentée, ou null. Les deux clés sont toujours examinées, en temps
// constant chacune (sameSecret). Sans CLE_CONSULTATION sur le serveur, seule CLE_ADMIN ouvre.
async function roleForKey(key, env) {
  const admin = await sameSecret(key, env.CLE_ADMIN);
  const consultation = typeof env.CLE_CONSULTATION === 'string' && env.CLE_CONSULTATION !== '' && await sameSecret(key, env.CLE_CONSULTATION);
  if (admin) return ADMIN;
  return consultation ? CONSULTATION : null;
}

// POST /api/prof/connexion — { cle }. Comparaison en temps constant ; cinq essais ratés par adresse,
// puis délai croissant ; chaque refus et chaque connexion sont journalisés, avec le rôle ouvert.
async function profConnexion(request, env, { now }) {
  const body = await readBody(request);
  const adresse = clientAddress(request);
  const lock = await base.findLock(env.DB, 'prof', adresse);
  if (isLocked(lock, now)) throw new HttpError(429, "Trop d'essais. Attends avant de réessayer.", { attendre_s: lockWait(lock, now) });
  const role = await roleForKey(body.cle, env);
  if (role === null) {
    const next = profFailureLock(lock, now);
    await base.setLock(env.DB, 'prof', adresse, next);
    await base.addTeacherLog(env.DB, { horodatage: now.toISOString(), enseignant: null, action: 'connexion_refusee', details: `adresse ${adresse}, échec ${next.echecs}` });
    throw new HttpError(401, 'Clé incorrecte.');
  }
  const teacher = role; // l'identifiant d'enseignant est le nom du rôle, tant qu'il n'y a pas de table des enseignants
  await base.clearLock(env.DB, 'prof', adresse);
  await base.addTeacherLog(env.DB, { horodatage: now.toISOString(), enseignant: teacher, action: 'connexion', details: `adresse ${adresse}, rôle ${role}` });
  const { payload, expires } = profSessionPayload(teacher, role, now);
  const cookie = `${payload}.${await signProfSession(env.CLE_SECRETE, payload)}`;
  return json({ enseignant: teacher, role, expire_le: expires }, 200, { 'set-cookie': profCookieHeader(cookie) });
}

// POST /api/prof/deconnexion — le cookie est effacé.
async function profDeconnexion() {
  return json({ deconnecte: true }, 200, { 'set-cookie': profCookieHeader(null) });
}

// GET /api/prof/role — la séance enseignant ouverte : { enseignant, role, expire_le } (D95 : la page le relit à son
// ouverture, pour savoir quels onglets offrir et comment). 401 sans cookie valide. Rien n'est journalisé.
async function profRole(request, env, { now }) {
  const { teacher, role, expires } = await requireTeacher(request, env, now);
  return json({ enseignant: teacher, role, expire_le: expires });
}

// Les titres des exercices, par identifiant, pour le tableau des séances (et son export CSV) : le titre en vigueur
// (D78), sinon, jamais publié, celui du brouillon.
async function exerciseTitles(env) {
  const rows = await base.listExercises(env.DB);
  const presentations = await livePresentations(env, rows);
  return new Map(rows.map((row) => [row.id, shownPresentation(row, presentations).titre]));
}

// GET /api/prof/seances — toutes les séances, pour le tableau des réussites ; le tri, le filtre et
// la recherche se font dans le navigateur (une classe, pas une base de données).
async function profSeances(request, env, { now }) {
  const { teacher, role } = await requireTeacher(request, env, now);
  const titles = await exerciseTitles(env);
  const rows = await base.listSessions(env.DB);
  return json({
    enseignant: teacher,
    role,
    exercices: [...titles].map(([id, titre]) => ({ id, titre })).sort((a, b) => a.titre.localeCompare(b.titre, 'fr')),
    seances: rows.map((row) => ({
      id: row.id,
      exercice: { id: row.exercice_id, titre: titles.get(row.exercice_id) ?? row.exercice_id },
      prenom: row.prenom,
      nom: row.nom,
      matricule: row.matricule,
      debut: row.debut,
      derniere_activite: row.derniere_activite,
      reussite_le: row.reussite_le,
      questions_reussies: row.total_reussies,
      code: row.code === null ? null : formatCode(row.code),
    })),
  });
}

// POST /api/prof/remise-a-zero — { seance } : la progression repart de zéro, la séance reste
// (matricule, NIP) ; l'attestation en cours est annulée avec la date ; l'action est journalisée.
async function profRemiseAZero(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const session = Number.isInteger(body.seance) ? await base.findSessionById(env.DB, body.seance) : null;
  if (session === null) throw new HttpError(404, "Cette séance n'existe pas.");
  await base.resetSession(env.DB, session.id, emptyCounters(), now.toISOString(), {
    horodatage: now.toISOString(),
    enseignant: teacher,
    action: 'remise_a_zero',
    details: `${session.exercice_id} · ${session.matricule} · ${session.prenom} ${session.nom}`,
  });
  return json({ remise_a_zero: true, seance: session.id });
}

// POST /api/prof/reinitialisation-nip — { seance } : le NIP est effacé et le verrou tombe (D38) ;
// l'étudiant choisit un nouveau NIP à sa prochaine reprise, comme à la création. Journalisée.
async function profReinitialisationNip(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const session = Number.isInteger(body.seance) ? await base.findSessionById(env.DB, body.seance) : null;
  if (session === null) throw new HttpError(404, "Cette séance n'existe pas.");
  await base.resetNip(env.DB, session.id, NIP_CLEARED, {
    horodatage: now.toISOString(),
    enseignant: teacher,
    action: 'reinitialisation_nip',
    details: `${session.exercice_id} · ${session.matricule} · ${session.prenom} ${session.nom}`,
  });
  return json({ nip_reinitialise: true, seance: session.id });
}

// POST /api/prof/suppression — { seance } (D45) : la séance et son journal disparaissent ; ses
// attestations restent, annulées « séance supprimée » — l'ancien code répond « annulée » avec la date.
// Rôle admin seulement. Journalisée, sans lien vers la séance : elle n'existe plus.
async function profSuppression(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const session = Number.isInteger(body.seance) ? await base.findSessionById(env.DB, body.seance) : null;
  if (session === null) throw new HttpError(404, "Cette séance n'existe pas.");
  await base.deleteSession(env.DB, session.id, now.toISOString(), {
    horodatage: now.toISOString(),
    enseignant: teacher,
    action: 'suppression',
    details: `${session.exercice_id} · ${session.matricule} · ${session.prenom} ${session.nom} · séance ${session.id}`,
  });
  return json({ supprimee: true, seance: session.id });
}

// POST /api/prof/effacement — { confirmation: "EFFACER" } (D46) : efface toutes les séances, journaux
// de corrections, corrections d'identité et attestations, les compteurs de débit et les verrous ;
// garde le journal des actions, anonymisé (matricules, noms et codes → « — »), où les nombres effacés
// sont inscrits. Les anciens codes d'attestation répondent ensuite « aucune ». Rôle admin seulement ;
// sans le mot exact, 400 et rien n'est touché. Exercices et banque d'outils ne sont pas touchés.
async function profEffacement(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  if (body.confirmation !== PURGE_WORD) throw new HttpError(400, `Pour effacer, la requête doit porter le mot ${PURGE_WORD}.`);
  const rows = await base.listTeacherLog(env.DB);
  const changed = rows.map((row) => ({ id: row.id, details: anonymizedDetails(row.action, row.details) })).filter((row, i) => row.details !== rows[i].details);
  const nombres = { ...await base.countStudentData(env.DB), journal_anonymise: changed.length };
  await base.purgeStudentData(env.DB, changed, { horodatage: now.toISOString(), enseignant: teacher, action: 'effacement', details: purgeDetails(nombres) });
  return json({ efface: true, nombres });
}

// GET /api/prof/identites — le journal des corrections d'identité, la plus récente en premier.
async function profIdentites(request, env, { now }) {
  await requireTeacher(request, env, now);
  return json({ corrections: await base.listIdentityCorrections(env.DB) });
}

// --- La Gestion du contenu : /api/prof/editeur/… (D47 à D49, D74, D95) ---------------------------------------------
// Chaque écriture exige le cookie enseignant avec le rôle admin (requireAdmin : 401 sans cookie, 403 en
// consultation), et chaque action est inscrite au journal des actions. Dix lectures acceptent aussi le rôle
// consultation (requireReader, D95 ; la liste : consultationRoutes), qui ne reçoit jamais un brouillon ; l'aperçu
// et les lectures n'enregistrent rien et ne sont pas journalisés.

const CONFLICT = "Ce brouillon a été enregistré ailleurs depuis ton ouverture (un autre onglet ou un autre appareil). Recharge la page pour reprendre ses dernières modifications ; rien n'a été écrasé.";

const logEntry = (teacher, now, action, details) => ({ horodatage: now.toISOString(), enseignant: teacher, action, details });

// La fiche d'un exercice de la Gestion du contenu, ou 404.
async function editorExercise(env, id) {
  const record = isExerciseId(id) ? await base.findExercise(env.DB, id) : null;
  if (record === null) throw new HttpError(404, "Cet exercice n'existe pas.");
  return record;
}

// Les tables de référence les plus récentes, complétées : ce contre quoi un outil de la banque se
// valide, et la version qu'un exercice créé prend (D62).
async function latestTables(env) {
  const row = await base.findLatestTables(env.DB);
  return { id: row.id, ...tablesOf(row) };
}

// Les tables d'un brouillon d'exercice (D62) : sa version choisie (tables_id), sinon la plus récente.
async function exerciseTables(env, record) {
  if (record.tables_id === null || record.tables_id === undefined) return latestTables(env);
  const row = await base.findTables(env.DB, record.tables_id);
  if (row === null) throw new Error(`Tables de référence « ${record.tables_id} » introuvables (exercice ${record.id})`);
  return { id: row.id, ...tablesOf(row) };
}

// Des tables telles qu'on les MONTRE (D76) : la présentation en vigueur posée par-dessus — les pastilles et l'aperçu
// d'un exercice ou de la banque. Jamais pour valider, tirer ou corriger : la présentation n'y change rien.
async function shownTables(env, tables) {
  return applyPresentation(tables, (await loadPresentation(env.DB)).contenu);
}

// Les noms des matières d'outil de la dernière version des tables, par clé : pour dire une couleur en clair.
const toolNamesOf = (latest) => new Map(latest.materiaux.materiaux_outil.map((m) => [m.cle, m.nom]));

// GET /api/prof/editeur/exercices — la liste : brouillon modifié ou non, dernière version, séances par version.
// Pour le rôle consultation (D95) : les exercices publiés seulement, sans « modifié » ni date de brouillon.
async function editeurExercices(request, env, { now }) {
  const { reader } = await requireReader(request, env, now);
  const rows = (await base.listExercises(env.DB)).filter((row) => !reader || row.contenu_publie !== null);
  const presentations = await livePresentations(env, rows);
  const titles = rows.map((row) => ({ id: row.id, titre: presentations.get(row.id)?.titre ?? null, archive_le: row.archive_le }));
  const list = [];
  for (const row of rows) {
    const shown = shownPresentation(row, presentations);
    list.push({
      id: row.id,
      rang: row.rang,
      // Le titre, le cours et « À l'accueil » en vigueur (D78) ; jamais publié, ceux du brouillon. titre_publie et
      // cours_publie : ceux que voient les étudiants (null : jamais publié) — les cours déjà utilisés (D71), et les
      // titres qu'un autre ne peut pas prendre (D74).
      titre: shown.titre,
      cours: shown.cours,
      titre_publie: presentations.get(row.id)?.titre ?? null,
      cours_publie: presentations.get(row.id)?.cours ?? null,
      // Modifié : ses valeurs seules, pour un exercice publié (la présentation du brouillon dort, D78).
      ...(reader ? {} : {
        modifie: row.contenu_publie === null || !sameContent(exerciseValues(row.brouillon), exerciseValues(row.contenu_publie)),
        brouillon_modifie_le: row.brouillon_modifie_le,
      }),
      derniere_version: row.derniere_version,
      publie_le: row.publie_le,
      archive_le: row.archive_le,
      seances: row.seances,
      versions: await base.listVersions(env.DB, row.id),
      liste: shown.liste,
      // Les titres en double (D79) : les autres exercices publiés et non archivés au même titre en vigueur — un avertissement.
      doublons: presentations.has(row.id) && row.archive_le === null ? sameTitleExercises(shown.titre, titles, row.id) : [],
    });
  }
  return json({ exercices: list });
}

// GET /api/prof/editeur/exercice?id=<id> — le brouillon avec sa révision, les versions (sans contenu), la dernière version
// (contenu), les tables, et, pour un exercice publié, sa présentation en vigueur (D78 : le panneau ; null sinon).
// Pour le rôle consultation (D95) : la dernière version publiée et ses tables, la présentation en vigueur et son
// historique — rien du brouillon (ni contenu, ni révision, ni erreurs, ni retouches en attente) ; jamais publié, 404.
async function editeurExercice(request, env, { now }) {
  const { reader } = await requireReader(request, env, now);
  const record = await editorExercise(env, new URL(request.url).searchParams.get('id'));
  const latest = await base.findLatestVersion(env.DB, record.id);
  const tablesVersions = await base.listTablesVersions(env.DB);
  const tablesList = tablesVersions.map(({ id, creee_le }) => ({ id, creee_le }));
  if (reader) {
    if (latest === null) throw new HttpError(404, "Cet exercice n'existe pas.");
    const row = await base.findTables(env.DB, latest.tables_id);
    if (row === null) throw new Error(`Tables de référence « ${latest.tables_id} » introuvables (exercice ${record.id})`);
    const tables = { id: row.id, ...tablesOf(row) };
    return json({
      exercice: { id: record.id, publie_le: record.publie_le, archive_le: record.archive_le, tables_id: tables.id },
      versions: await base.listVersions(env.DB, record.id),
      derniere_version: { numero: latest.numero, contenu: latest.contenu, tables_id: latest.tables_id, publiee_le: latest.publiee_le },
      tables: await shownTables(env, tables),
      tables_versions: tablesList,
      derniere_tables: tablesVersions[0]?.id ?? tables.id,
      presentation: await exercisePresentationPayload(env, record, latest, { reader: true }),
    });
  }
  const tables = await exerciseTables(env, record);
  return json({
    exercice: { id: record.id, brouillon: record.brouillon, revision: record.revision, brouillon_modifie_le: record.brouillon_modifie_le, publie_le: record.publie_le, archive_le: record.archive_le, tables_id: tables.id },
    versions: await base.listVersions(env.DB, record.id),
    derniere_version: latest === null ? null : { numero: latest.numero, contenu: latest.contenu, tables_id: latest.tables_id, publiee_le: latest.publiee_le },
    tables: await shownTables(env, tables),
    // Les versions des tables (D62) : la plus récente en tête ; la page signale quand le brouillon n'est pas dessus.
    tables_versions: tablesList,
    derniere_tables: tablesVersions[0]?.id ?? tables.id,
    erreurs: draftErrors(record.brouillon, tables),
    presentation: latest === null ? null : await exercisePresentationPayload(env, record, latest),
  });
}

// POST /api/prof/editeur/exercice/tables — { id, revision, tables_id } : le brouillon passe à cette version des
// tables (D62), avec le contrôle optimiste ; les erreurs du brouillon contre ces tables sont rendues. Si elles portent
// les facteurs de vitesse, ses copies d'outils font leur passage (D83, point 5 : hérité, ou forcé « à vérifier ») ; si
// elles ne les portent pas, chaque copie retrouve son facteur propre, celui qu'elle avait avec les tables qu'elle quitte.
async function editeurExerciceTables(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = await editorExercise(env, body.id);
  if (!Number.isInteger(body.revision)) throw new HttpError(400, 'La révision du brouillon est requise.');
  const row = isTablesId(body.tables_id) ? await base.findTables(env.DB, body.tables_id) : null;
  if (row === null) throw new HttpError(404, "Cette version des tables de référence n'existe pas.");
  const brouillon = settleSpeedFactors(record.brouillon, tablesOf(row), await exerciseTables(env, record));
  const saved = await base.replaceDraft(env.DB, record.id, body.revision, brouillon, row.id, now.toISOString(), logEntry(teacher, now, 'editeur_tables_exercice', `${record.id} · tables ${record.tables_id ?? '—'} → ${row.id}`));
  if (!saved) throw new HttpError(409, CONFLICT, { revision_actuelle: (await base.findExercise(env.DB, record.id)).revision });
  return json({ change: true, tables_id: row.id, revision: body.revision + 1, erreurs: draftErrors(brouillon, tablesOf(row)) });
}

// POST /api/prof/editeur/exercice/creer — { id, titre } ou { id, depuis: <id d'un exercice> } (dupliquer).
async function editeurCreer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
  if (!isExerciseId(body.id)) throw new HttpError(400, "L'identifiant doit être fait de minuscules, de chiffres et de tirets (ex. « m10-fraisage »), et ne peut pas être « index ».");
  let brouillon;
  let details;
  if (typeof body.depuis === 'string') {
    const source = await editorExercise(env, body.depuis);
    // Une copie d'un exercice publié part de sa présentation en vigueur (D78) : titre, cours, photos et notes.
    const sourceLatest = await base.findLatestVersion(env.DB, source.id);
    const live = sourceLatest === null ? null : (await loadExercisePresentation(env.DB, source.id, sourceLatest.contenu)).contenu;
    // D83 : jamais d'ancien outil dans un brouillon dont les tables portent les facteurs de vitesse.
    brouillon = structuredClone(adoptSpeedFactors(applyExercisePresentation(source.brouillon, live), await exerciseTables(env, source)));
    brouillon.titre = typeof body.titre === 'string' && body.titre.trim() !== '' ? body.titre.trim() : `${brouillon.titre} (copie)`;
    details = `${body.id} · dupliqué de ${body.depuis}`;
  } else {
    if (typeof body.titre !== 'string' || body.titre.trim() === '') throw new HttpError(400, 'Le titre est requis.');
    brouillon = { titre: body.titre.trim(), champs_evalues: ['vc'], outils: [] };
    details = `${body.id} · ${brouillon.titre}`;
  }
  // La version de tables du nouvel exercice (D62) : la plus récente ; une copie garde celle de sa source.
  const tablesId = typeof body.depuis === 'string' ? (await exerciseTables(env, await editorExercise(env, body.depuis))).id : (await latestTables(env)).id;
  const created = await base.createExercise(env.DB, { id: body.id, brouillon, tablesId, now: now.toISOString() }, logEntry(teacher, now, typeof body.depuis === 'string' ? 'editeur_duplication' : 'editeur_creation', details));
  if (!created) throw new HttpError(409, `L'identifiant « ${body.id} » est déjà pris.`);
  return json({ cree: true, id: body.id });
}

// POST /api/prof/editeur/exercice/enregistrer — { id, revision, brouillon } : contrôle optimiste (D48).
async function editeurEnregistrer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
  const record = await editorExercise(env, body.id);
  if (!Number.isInteger(body.revision)) throw new HttpError(400, 'La révision du brouillon est requise.');
  const received = cleanDraft(body.brouillon);
  if (!Array.isArray(received.outils) || !Array.isArray(received.champs_evalues)) throw new HttpError(400, 'Le brouillon est mal formé.');
  const tables = await exerciseTables(env, record);
  // Un ancien outil (un facteur de vitesse sans raison) fait son passage avec les tables du brouillon (D83, point 5) ;
  // le formulaire d'outil écrit déjà le nouveau format : rien ne change alors.
  const brouillon = adoptSpeedFactors(received, tables);
  const erreurs = draftErrors(brouillon, tables);
  const saved = await base.saveDraft(env.DB, record.id, body.revision, brouillon, now.toISOString(), logEntry(teacher, now, 'editeur_enregistrement', `${record.id} · révision ${body.revision + 1}${erreurs.length > 0 ? ` · ${erreurs.length} erreur(s)` : ''}`));
  if (!saved) throw new HttpError(409, CONFLICT, { revision_actuelle: (await base.findExercise(env.DB, record.id)).revision });
  return json({ enregistre: true, revision: body.revision + 1, erreurs });
}

// POST /api/prof/editeur/exercice/renommer — { id, titre }. Un exercice publié : le titre entre en vigueur tout de suite
// (D78) — le même geste qu'« Appliquer » dans le panneau de sa présentation, avec la règle du titre en double, l'historique
// et le journal. Jamais publié : le titre du brouillon, libre jusqu'à la première publication.
async function editeurRenommer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = await editorExercise(env, body.id);
  if (typeof body.titre !== 'string' || body.titre.trim() === '') throw new HttpError(400, 'Le titre est requis.');
  const titre = body.titre.trim();
  const latest = await base.findLatestVersion(env.DB, record.id);
  if (latest !== null) {
    const presentation = await loadExercisePresentation(env.DB, record.id, latest.contenu);
    await replaceExercisePresentation(env, record, latest, presentation, { revision: presentation.revision, contenu: { ...presentation.contenu, titre }, action: 'application', teacher, now, details: 'renommé depuis la liste · ' });
    return json({ renomme: true, titre, en_direct: true });
  }
  const brouillon = { ...record.brouillon, titre };
  const saved = await base.saveDraft(env.DB, record.id, record.revision, brouillon, now.toISOString(), logEntry(teacher, now, 'editeur_renommage', `${record.id} · « ${record.brouillon.titre} » → « ${brouillon.titre} »`));
  if (!saved) throw new HttpError(409, CONFLICT);
  return json({ renomme: true, titre: brouillon.titre, en_direct: false });
}

// POST /api/prof/editeur/exercice/deplacer — { id, rang, direction: "monter" | "descendre" } (D51) : l'ordre de la
// liste de la Gestion du contenu et de l'accueil. Contrôle optimiste sur le rang que l'écran a vu ; les rangs sont réécrits 1 à n.
async function editeurDeplacer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = await editorExercise(env, body.id);
  if (!['monter', 'descendre'].includes(body.direction)) throw new HttpError(400, '« direction » doit être « monter » ou « descendre ».');
  if (body.rang !== record.rang) throw new HttpError(409, "La liste des exercices a changé ailleurs depuis ton ouverture : recharge la page.", { rang_actuel: record.rang });
  const ordered = (await base.listExercises(env.DB)).map((row) => row.id);
  const at = ordered.indexOf(record.id);
  const to = body.direction === 'monter' ? at - 1 : at + 1;
  if (to < 0 || to >= ordered.length) throw new HttpError(400, body.direction === 'monter' ? 'Cet exercice est déjà en tête.' : 'Cet exercice est déjà en queue.');
  [ordered[at], ordered[to]] = [ordered[to], ordered[at]];
  await base.renumberExercises(env.DB, ordered, logEntry(teacher, now, 'editeur_deplacement', `${record.id} · rang ${at + 1} → ${to + 1}`));
  return json({ deplace: true, id: record.id, rang: to + 1 });
}

// POST /api/prof/editeur/exercice/archiver — { id, archive: true|false }.
async function editeurArchiver(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = await editorExercise(env, body.id);
  if (typeof body.archive !== 'boolean') throw new HttpError(400, '« archive » doit être true ou false.');
  await base.archiveExercise(env.DB, record.id, body.archive ? now.toISOString() : null, logEntry(teacher, now, body.archive ? 'editeur_archivage' : 'editeur_retablissement', record.id));
  return json({ archive: body.archive, id: record.id });
}

// POST /api/prof/editeur/exercice/supprimer — { id } : seulement sans aucune séance ; sinon, archiver.
async function editeurSupprimer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = await editorExercise(env, body.id);
  const sessions = await base.countSessionsOfExercise(env.DB, record.id);
  if (sessions > 0) throw new HttpError(409, `Cet exercice a ${sessions} séance(s) : il ne peut pas être supprimé, seulement archivé.`);
  await base.deleteExercise(env.DB, record.id, logEntry(teacher, now, 'editeur_suppression', `${record.id} · « ${record.brouillon.titre} »`));
  return json({ supprime: true, id: record.id });
}

// Les titres en vigueur (D78) de tous les exercices, pour la règle du titre en double (D74) : [{ id, titre, archive_le }] ;
// titre null pour un exercice jamais publié (son brouillon est libre).
async function titlesInForce(env) {
  const rows = await base.listExercises(env.DB);
  const presentations = await livePresentations(env, rows);
  return rows.map((row) => ({ id: row.id, titre: presentations.get(row.id)?.titre ?? null, archive_le: row.archive_le }));
}

// POST /api/prof/editeur/exercice/publier — { id, revision } : le brouillon devient la version suivante, s'il est valide.
// Un exercice déjà publié : la version prend la présentation en vigueur (D78, un instantané) et ne compare que ses valeurs
// à la précédente. Un exercice jamais publié : refusé si un autre exercice publié et non archivé porte son titre (D74).
async function editeurPublier(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = await editorExercise(env, body.id);
  if (body.revision !== record.revision) throw new HttpError(409, CONFLICT, { revision_actuelle: record.revision });
  const tables = await exerciseTables(env, record); // la version publiée prend la version de tables du brouillon (D62)
  const latest = await base.findLatestVersion(env.DB, record.id);
  // L'instantané (D78, point 8) : la présentation du brouillon d'un exercice publié dort ; celle en vigueur la remplace,
  // pour les copies qu'elle connaît (une copie nouvelle garde la photo et la note de sa ligne du brouillon).
  const live = latest === null ? null : (await loadExercisePresentation(env.DB, record.id, latest.contenu)).contenu;
  const contenu = applyExercisePresentation(record.brouillon, live);
  const erreurs = draftErrors(contenu, tables);
  if (erreurs.length > 0) throw new HttpError(400, `Le brouillon a ${erreurs.length} erreur(s) : il ne peut pas être publié.`, { erreurs });
  // Une version identique à la précédente ne se publie pas (D51) : l'écran désactive déjà le bouton.
  // Un changement de version de tables est une différence (D62), même à contenu identique.
  if (latest !== null && sameContent(exerciseValues(contenu), exerciseValues(latest.contenu)) && latest.tables_id === tables.id) throw new HttpError(400, `Aucune différence à publier : le brouillon est identique à la version ${latest.numero}.`);
  // Le titre identifie l'exercice pour les étudiants (D74) : à la première publication, refusé tant qu'un AUTRE exercice
  // publié et non archivé porte le même titre en vigueur (sans casse, accents ni espaces) — même si l'on contourne l'écran.
  // Ensuite, le titre ne change qu'en direct, où la même règle s'applique (D78, point 6).
  if (latest === null) {
    const doublons = sameTitleExercises(contenu.titre, await titlesInForce(env), record.id);
    if (doublons.length > 0) throw new HttpError(400, sameTitleRefusal(doublons), { doublons });
  }
  const numero = (latest?.numero ?? 0) + 1;
  const published = await base.publishVersion(env.DB, { id: record.id, revision: record.revision, numero, contenu, tablesId: tables.id, now: now.toISOString() },
    logEntry(teacher, now, 'editeur_publication', `${record.id} · version ${numero} · tables ${tables.id}`));
  if (!published) throw new HttpError(409, CONFLICT);
  return json({ publie: true, numero, publiee_le: now.toISOString() });
}

// POST /api/prof/editeur/apercu — { id, brouillon } ou { id, version } : dix questions et leurs réponses. Rien n'est enregistré.
// Le rôle consultation n'a que l'aperçu d'une version publiée (D95) : un brouillon, ou sans version, 403.
async function editeurApercu(request, env, { now, random }) {
  const { reader } = await requireReader(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
  if (reader && (!Number.isInteger(body.version) || body.brouillon !== undefined)) throw new HttpError(403, ACTION_RESERVED);
  const record = await editorExercise(env, body.id);
  let assembledExercise;
  if (Number.isInteger(body.version)) {
    const version = await base.findVersion(env.DB, record.id, body.version);
    if (version === null) throw new HttpError(404, "Cette version n'existe pas.");
    assembledExercise = await loadVersion(env.DB, version.id);
  } else {
    const brouillon = cleanDraft(body.brouillon ?? record.brouillon);
    const tables = await exerciseTables(env, record);
    const erreurs = draftErrors(brouillon, tables);
    if (erreurs.length > 0) throw new HttpError(400, "Le brouillon a des erreurs : corrige-les avant l'aperçu.", { erreurs });
    assembledExercise = assembleDraft(record.id, brouillon, tables);
  }
  return json({ questions: previewQuestions(assembledExercise.exercise, assembledExercise.data, random, 10), champs_evalues: assembledExercise.exercise.champs_evalues, champs_masques: assembledExercise.exercise.champs_masques ?? [] });
}

// GET /api/prof/editeur/banque — les outils de la banque, avec le nombre d'exercices qui en ont une copie (brouillons).
// Ouverte aux deux rôles (D95) : la banque n'a ni brouillon ni version.
async function editeurBanque(request, env, { now }) {
  await requireReader(request, env, now);
  const tools = await base.listBankTools(env.DB);
  const exercises = await base.listExercises(env.DB);
  const tables = await latestTables(env);
  const copies = (id) => exercises.filter((e) => e.brouillon.outils.some((copy) => copy.origine === id)).map((e) => e.id);
  return json({ outils: tools.map((row) => ({ id: row.id, outil: row.outil, revision: row.revision, rang: row.rang, archive_le: row.archive_le, modifie_le: row.modifie_le, exercices: copies(row.id) })), tables: await shownTables(env, tables) });
}

// --- Les tables de référence versionnées (D61, D63) : un brouillon, des versions immuables -------------------------

// Le brouillon des tables tel qu'on le lit (D83, point 2 ; D96) : complété, et prérempli — une opération sans facteur de
// vitesse reçoit celui de la table papier, une opération sans code G d'avance reçoit G99 au tour, G94 ailleurs. Jamais
// pour une version publiée : une version d'avant D83 reste sans facteurs, une version d'avant D96 sans codes.
const draftTablesOf = (contenu) => prefillFeedCodes(prefillSpeedFactors(tablesOf(contenu)));

// Les erreurs d'un brouillon de tables : celles des deux tables (validateTables), sans outils ; avec les
// fiches des images, une image de classe inconnue ou archivée est une erreur (D64) — sauf celle que la présentation en
// vigueur a déjà pour cette classe : elle n'est pas choisie, et ne bloque ni le brouillon ni la publication (D76, retouche).
const tablesErrors = (contenu, images = null, presentation = null) => validateTables(contenu, { images, presentation }).map((message) => ({ champ: '', message }));

// GET /api/prof/editeur/tables — le brouillon des tables (complété, tel qu'en base), ses erreurs, les versions publiées
// avec leurs utilisations, la révision suggérée pour la prochaine publication. Depuis D76, les champs de la présentation
// y sont sans effet pour une clé que la présentation en vigueur connaît : les erreurs sont celles du brouillon avec la
// présentation par-dessus (ce que la publication prendra), « modifié » ne compare que les valeurs, et
// `presentation_en_attente` dit les retouches de présentation faites dans le brouillon avant D76, jamais publiées.
// Pour le rôle consultation (D95) : les versions publiées, la dernière et la présentation en vigueur — jamais le brouillon
// (la page lit les valeurs de la dernière version par tables/version).
async function editeurTables(request, env, { now }) {
  const { reader } = await requireReader(request, env, now);
  const versions = await base.listTablesVersions(env.DB);
  const presentation = await loadPresentation(env.DB);
  const versionsList = versions.map((v) => ({ id: v.id, creee_le: v.creee_le, utilisations: { versions_exercice: v.versions_exercice, brouillons: v.brouillons } }));
  if (reader) return json({ presentation: presentation.contenu, versions: versionsList, derniere: versions[0]?.id ?? null });
  const draft = await base.findTablesDraft(env.DB);
  const contenu = draftTablesOf(draft.contenu);
  const base_ = draft.base_id === null ? null : await base.findTables(env.DB, draft.base_id);
  return json({
    brouillon: { contenu, revision: draft.revision, modifie_le: draft.modifie_le, base_id: draft.base_id },
    modifie: base_ === null || !sameContent(tablesContent(contenu), tablesContent(tablesOf(base_))),
    erreurs: tablesErrors(applyPresentation(contenu, presentation.contenu), await base.listImages(env.DB), presentation.contenu),
    presentation: presentation.contenu,
    presentation_en_attente: pendingDraftPresentation(base_ === null ? null : tablesOf(base_), contenu, presentation.contenu, toolNamesOf(presentation.latest)),
    versions: versionsList,
    derniere: versions[0]?.id ?? null,
    suggestion: nextRevision(versions[0]?.id ?? 'A2026_r0'),
  });
}

// GET /api/prof/editeur/tables/version?id=<id> — une version publiée des tables, complétée. Ouverte aux deux rôles (D95).
async function editeurTablesVersion(request, env, { now }) {
  await requireReader(request, env, now);
  const id = new URL(request.url).searchParams.get('id');
  const row = isTablesId(id) ? await base.findTables(env.DB, id) : null;
  if (row === null) throw new HttpError(404, "Cette version des tables de référence n'existe pas.");
  return json({ tables: { id: row.id, creee_le: row.creee_le, ...tablesOf(row) } });
}

// POST /api/prof/editeur/tables/enregistrer — { revision, contenu: { materiaux, operations } } : contrôle optimiste (D48).
async function editeurTablesEnregistrer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
  if (!Number.isInteger(body.revision)) throw new HttpError(400, 'La révision du brouillon est requise.');
  const contenu = cleanTables(body.contenu);
  if (contenu === null) throw new HttpError(400, 'Le brouillon des tables est mal formé : « materiaux » et « operations » sont attendus.');
  const presentation = (await loadPresentation(env.DB)).contenu;
  const erreurs = tablesErrors(applyPresentation(draftTablesOf(contenu), presentation), await base.listImages(env.DB), presentation);
  const saved = await base.saveTablesDraft(env.DB, body.revision, contenu, now.toISOString(), logEntry(teacher, now, 'editeur_tables_enregistrement', `révision ${body.revision + 1}${erreurs.length > 0 ? ` · ${erreurs.length} erreur(s)` : ''}`));
  if (!saved) throw new HttpError(409, CONFLICT, { revision_actuelle: (await base.findTablesDraft(env.DB)).revision });
  return json({ enregistre: true, revision: body.revision + 1, erreurs });
}

// POST /api/prof/editeur/tables/publier — { revision, id } : le brouillon devient la version « id » des
// tables (immuable) ; sa révision (dans les deux JSON) est posée à « id ». Refusé s'il a des erreurs,
// si ses valeurs sont celles de la version dont il est parti, si l'identifiant est pris ou mal formé. La version prend
// la présentation en vigueur pour les clés qu'elle connaît (D76 : un instantané ; une clé nouvelle garde celle de sa
// ligne du brouillon), et le brouillon repart de cette version.
async function editeurTablesPublier(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const draft = await base.findTablesDraft(env.DB);
  if (body.revision !== draft.revision) throw new HttpError(409, CONFLICT, { revision_actuelle: draft.revision });
  if (!isTablesId(body.id)) throw new HttpError(400, 'La révision des tables doit être faite de lettres, de chiffres, de « _ », « . » ou « - » (ex. « A2026_r1 »).');
  const presentation = (await loadPresentation(env.DB)).contenu;
  const contenu = applyPresentation(draftTablesOf(draft.contenu), presentation);
  contenu.materiaux = { ...contenu.materiaux, revision: body.id };
  contenu.operations = { ...contenu.operations, revision: body.id };
  const erreurs = tablesErrors(contenu, await base.listImages(env.DB), presentation); // une image archivée déjà en vigueur passe, instantané compris
  if (erreurs.length > 0) throw new HttpError(400, `Le brouillon des tables a ${erreurs.length} erreur(s) : il ne peut pas être publié.`, { erreurs });
  const previous = draft.base_id === null ? null : await base.findTables(env.DB, draft.base_id);
  if (previous !== null && sameContent(tablesContent(contenu), tablesContent(tablesOf(previous)))) throw new HttpError(400, `Aucune différence à publier : le brouillon est identique à la version ${previous.id}.`);
  if ((await base.findTables(env.DB, body.id)) !== null) throw new HttpError(409, `La révision « ${body.id} » existe déjà : une version publiée ne se remplace pas.`);
  // La cascade (D77) : les exercices cochés, recalculés ici (jamais crus du navigateur). Chaque version qu'elle publie prend
  // la présentation en vigueur de son exercice (D78 : un instantané, comme toute version publiée). Avec des tables qui
  // portent les facteurs de vitesse, les copies d'outils font leur passage (D83 : cascadePlan), et la banque aussi.
  const { rows, candidates, presentations, bank } = await cascadeFor(env, draft.base_id, contenu);
  const plan = cascadePlan(candidates, rows, body.cascade, contenu);
  const mention = `cascade de la publication des tables ${body.id}`;
  const cascade = {
    versions: plan.versions.map((v) => ({ ...v, contenu: applyExercisePresentation(v.contenu, presentations.get(v.exercice_id) ?? null), entry: logEntry(teacher, now, 'editeur_publication', `${v.exercice_id} · version ${v.numero} · tables ${body.id} · ${mention}`) })),
    brouillons: plan.brouillons.map((b) => ({ ...b, entry: logEntry(teacher, now, 'editeur_tables_exercice', `${b.id} · tables ${b.depuis ?? '—'} → ${body.id} · ${mention}`) })),
  };
  const summary = candidates.length === 0 ? '' : ` · cascade sur ${candidates.length} exercice(s) proposé(s) : ${plan.versions.length} version(s) publiée(s), ${plan.brouillons.length} brouillon(s) passé(s), ${plan.laisses.length} en erreur laissé(s) tel(s) quel(s)`;
  const passage = bankPassageSummary(bank);
  const bankSummary = bank.length === 0 ? '' : ` · banque d'outils, passage aux facteurs de vitesse : ${passage.herites.length} outil(s) hérité(s), ${passage.forces.length} forcé(s)${passage.forces.length > 0 ? ` (${passage.forces.map((t) => t.id).join(', ')})` : ''}`;
  const outcome = await base.publishTables(env.DB, { id: body.id, revision: draft.revision, contenu, now: now.toISOString(), cascade, banque: bank.map((t) => ({ ...t, enseignant: teacher })), baseBefore: draft.base_id },
    logEntry(teacher, now, 'editeur_tables_publication', `tables ${body.id}${draft.base_id === null ? '' : ` · depuis ${draft.base_id}`}${summary}${bankSummary}`));
  if (outcome === 'revision') throw new HttpError(409, CONFLICT);
  if (outcome === 'id') throw new HttpError(409, `La révision « ${body.id} » existe déjà : une version publiée ne se remplace pas.`);
  if (outcome === 'exercice') throw new HttpError(409, "Un exercice de la cascade vient d'être publié ailleurs : rien n'a été publié. Recharge la page, puis recommence.");
  return json({
    publie: true,
    id: body.id,
    publiee_le: now.toISOString(),
    cascade: { publies: plan.versions.map((v) => ({ id: v.exercice_id, numero: v.numero })), brouillons: plan.brouillons.map((b) => b.id), laisses: plan.laisses, ignores: plan.ignores },
    banque: passage,
  });
}

// Les exercices que la cascade propose (D77, cascadeCandidates) : tous, puisqu'aucun n'est encore sur les nouvelles tables
// `next` ; cochés par défaut ceux qui sont sur la version remplacée ; ce que ça change pour chacun depuis sa propre version.
// Chaque exercice publié y est nommé par son titre en vigueur (D78) ; `presentations` : les présentations en vigueur ;
// `bank` : les outils de la banque qui feraient leur passage aux facteurs de vitesse de ces tables (D83, bankPassage).
async function cascadeFor(env, replacedId, next) {
  const versions = await base.listTables(env.DB);
  const tablesById = new Map(versions.map((row) => [row.id, tablesOf(row)]));
  const listed = await base.listExercises(env.DB);
  const presentations = await livePresentations(env, listed);
  const rows = listed.map((row) => (presentations.has(row.id) ? { ...row, titre_en_vigueur: presentations.get(row.id).titre } : row));
  const candidates = cascadeCandidates(rows, { replacedId, tablesById, latestId: versions.at(-1)?.id ?? null, next }, { draftErrorsOf: draftErrors, impactOf: exerciseTablesImpact });
  return { rows, candidates, presentations, bank: bankPassage(await base.listBankTools(env.DB), next) };
}

// GET /api/prof/editeur/tables/cascade — ce que la publication du brouillon des tables (tel qu'enregistré) proposerait en
// cascade (D77) : la version remplacée (celle dont le brouillon est parti) et une liste de tous les exercices — cochés par
// défaut ceux qui sont sur elle, décochés ceux qui sont sur une version plus ancienne —, avec ce que la cascade ferait et
// ce que ça change pour chacun depuis sa propre version (cascadeCandidates). Rien n'est écrit.
async function editeurTablesCascade(request, env, { now }) {
  await requireAdmin(request, env, now);
  const draft = await base.findTablesDraft(env.DB);
  const next = applyPresentation(draftTablesOf(draft.contenu), (await loadPresentation(env.DB)).contenu);
  const { candidates, bank } = await cascadeFor(env, draft.base_id, next);
  return json({ remplacee: draft.base_id, candidats: candidates, banque: bankPassageSummary(bank) });
}

// --- Reprendre une version, annuler les modifications (D75, point 6 ; D77) ---------------------------------------------

// Le brouillon des tables qui reprend les VALEURS d'une version : la présentation n'est pas reprise — pour une clé que la
// présentation en vigueur connaît, le brouillon prend la sienne (applyPresentation), si bien que l'encadré des retouches
// en attente ne s'allume pas à tort ; elle se rétablit par son propre historique.
// Une version d'avant D83, sans facteurs de vitesse, donne un brouillon prérempli d'après la table papier (D83, point 2).
async function tablesDraftFrom(env, row) {
  const presentation = (await loadPresentation(env.DB)).contenu;
  const { materiaux, operations } = applyPresentation(draftTablesOf(row), presentation);
  return { materiaux, operations };
}

// POST /api/prof/editeur/tables/reprendre — { revision, id } : les valeurs de la version `id` entrent dans le brouillon,
// qui repart de la dernière version publiée : le résumé des différences, puis la publication (avec la cascade), la
// comparent à elle. Contrôle optimiste ; journalisé.
async function editeurTablesReprendre(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const draft = await base.findTablesDraft(env.DB);
  if (body.revision !== draft.revision) throw new HttpError(409, CONFLICT, { revision_actuelle: draft.revision });
  const row = isTablesId(body.id) ? await base.findTables(env.DB, body.id) : null;
  if (row === null) throw new HttpError(404, "Cette version des tables de référence n'existe pas.");
  const latest = await base.findLatestTables(env.DB);
  const contenu = await tablesDraftFrom(env, row);
  const saved = await base.replaceTablesDraft(env.DB, draft.revision, contenu, latest.id, now.toISOString(), logEntry(teacher, now, 'editeur_tables_reprise', `valeurs de ${row.id} reprises dans le brouillon · repart de ${latest.id}`));
  if (!saved) throw new HttpError(409, CONFLICT, { revision_actuelle: (await base.findTablesDraft(env.DB)).revision });
  return json({ repris: true, id: row.id, revision: draft.revision + 1, base_id: latest.id, modifie: !sameContent(tablesContent(tablesOf(contenu)), tablesContent(tablesOf(latest))) });
}

// POST /api/prof/editeur/tables/annuler — { revision } : le brouillon des tables revient à la dernière version publiée.
// S'il en a déjà les valeurs, rien n'est écrit ni journalisé (annule: false) : l'écran n'avait que des modifications
// non enregistrées, qu'il abandonne en se rechargeant. Contrôle optimiste ; journalisé.
async function editeurTablesAnnuler(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const draft = await base.findTablesDraft(env.DB);
  if (body.revision !== draft.revision) throw new HttpError(409, CONFLICT, { revision_actuelle: draft.revision });
  const latest = await base.findLatestTables(env.DB);
  // Le brouillon se lit prérempli (D83) : il est « à jour » quand il ne diffère de la dernière version que par là.
  if (sameContent(tablesContent(draftTablesOf(draft.contenu)), tablesContent(draftTablesOf(latest)))) return json({ annule: false, id: latest.id, revision: draft.revision });
  const saved = await base.replaceTablesDraft(env.DB, draft.revision, await tablesDraftFrom(env, latest), latest.id, now.toISOString(), logEntry(teacher, now, 'editeur_tables_annulation', `brouillon ramené à ${latest.id}`));
  if (!saved) throw new HttpError(409, CONFLICT, { revision_actuelle: (await base.findTablesDraft(env.DB)).revision });
  return json({ annule: true, id: latest.id, revision: draft.revision + 1 });
}

// POST /api/prof/editeur/exercice/reprendre — { id, revision, numero } : le contenu de la version `numero` entre dans le
// brouillon, qui GARDE sa version de tables (reprendre un contenu ne ramène pas d'anciennes tables en silence). Puis
// publication normale, avec le résumé. Contrôle optimiste ; journalisé ; les erreurs du brouillon avec ses tables sont rendues.
async function editeurReprendre(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = await editorExercise(env, body.id);
  if (body.revision !== record.revision) throw new HttpError(409, CONFLICT, { revision_actuelle: record.revision });
  const version = Number.isInteger(body.numero) ? await base.findVersion(env.DB, record.id, body.numero) : null;
  if (version === null) throw new HttpError(404, "Cette version de l'exercice n'existe pas.");
  const tables = await exerciseTables(env, record);
  // Le contenu d'une version d'avant D83, repris sur des tables qui portent les facteurs : ses copies font leur passage (D83).
  const brouillon = adoptSpeedFactors(cleanDraft(structuredClone(version.contenu)), tables);
  const saved = await base.replaceDraft(env.DB, record.id, record.revision, brouillon, tables.id, now.toISOString(), logEntry(teacher, now, 'editeur_reprise', `${record.id} · version ${version.numero} reprise dans le brouillon · tables ${tables.id} gardées`));
  if (!saved) throw new HttpError(409, CONFLICT, { revision_actuelle: (await base.findExercise(env.DB, record.id)).revision });
  return json({ repris: true, numero: version.numero, revision: record.revision + 1, tables_id: tables.id, erreurs: draftErrors(brouillon, tables) });
}

// POST /api/prof/editeur/exercice/annuler — { id, revision } : le brouillon revient à la dernière version publiée, son
// contenu ET sa version de tables ; 400 jamais publié. Déjà à jour : rien n'est écrit ni journalisé (annule: false) —
// l'écran n'avait que des modifications non enregistrées, qu'il abandonne en se rechargeant. Contrôle optimiste ; journalisé.
async function editeurAnnuler(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = await editorExercise(env, body.id);
  if (body.revision !== record.revision) throw new HttpError(409, CONFLICT, { revision_actuelle: record.revision });
  const latest = await base.findLatestVersion(env.DB, record.id);
  if (latest === null) throw new HttpError(400, "Cet exercice n'a jamais été publié : il n'y a pas de version à laquelle revenir.");
  // Ses valeurs seules : la présentation du brouillon dort (D78).
  if (sameContent(exerciseValues(record.brouillon), exerciseValues(latest.contenu)) && record.tables_id === latest.tables_id) return json({ annule: false, numero: latest.numero, revision: record.revision, tables_id: latest.tables_id });
  const saved = await base.replaceDraft(env.DB, record.id, record.revision, cleanDraft(structuredClone(latest.contenu)), latest.tables_id, now.toISOString(), logEntry(teacher, now, 'editeur_annulation', `${record.id} · brouillon ramené à la version ${latest.numero} (tables ${latest.tables_id})`));
  if (!saved) throw new HttpError(409, CONFLICT, { revision_actuelle: (await base.findExercise(env.DB, record.id)).revision });
  return json({ annule: true, numero: latest.numero, revision: record.revision + 1, tables_id: latest.tables_id });
}

// POST /api/prof/editeur/tables/apercu — { contenu, exercice } : dix questions du brouillon de cet exercice,
// tirées avec ces tables (celles de l'écran, même non enregistrées), sans rien enregistrer (D63).
async function editeurTablesApercu(request, env, { now, random }) {
  await requireAdmin(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
  const record = await editorExercise(env, body.exercice);
  const contenu = cleanTables(body.contenu);
  if (contenu === null) throw new HttpError(400, 'Le brouillon des tables est mal formé.');
  const presentation = (await loadPresentation(env.DB)).contenu;
  const tables = applyPresentation(draftTablesOf(contenu), presentation); // ce que la publication prendrait (D76, D83)
  const erreursTables = tablesErrors(tables, await base.listImages(env.DB), presentation);
  if (erreursTables.length > 0) throw new HttpError(400, "Le brouillon des tables a des erreurs : corrige-les avant l'aperçu.", { erreurs: erreursTables });
  const erreurs = draftErrors(record.brouillon, tables);
  if (erreurs.length > 0) throw new HttpError(400, `L'exercice « ${record.brouillon.titre} » a des erreurs avec ces tables. ${erreurs.map((e) => `${e.champ} : ${e.message}`).join(' · ')}`, { erreurs });
  const assembledExercise = assembleDraft(record.id, record.brouillon, tables);
  return json({ questions: previewQuestions(assembledExercise.exercise, assembledExercise.data, random, 10), champs_evalues: assembledExercise.exercise.champs_evalues, champs_masques: assembledExercise.exercise.champs_masques ?? [] });
}

// --- La présentation des tables en direct (D75, D76) : lire, appliquer, rétablir -----------------------------------
// Pas de brouillon : « Appliquer » change la page de tous les étudiants dès qu'elle se recharge, séances en cours
// comprises. Chaque contenu remplacé va à l'historique ; « Rétablir » en remet un. Contrôle optimiste (D48), journal.

const PRESENTATION_CONFLICT = "La présentation a été appliquée ailleurs depuis ton ouverture (un autre onglet ou un autre appareil). Recharge la page pour partir de la présentation en vigueur ; rien n'a été écrasé.";

// « 3 changement(s) : Classe P — couleur : … ; … » — les détails du journal (les six premiers changements).
const changesText = (lignes) => `${lignes.length} changement(s) : ${lignes.slice(0, 6).join(' ; ')}${lignes.length > 6 ? ` ; … (${lignes.length - 6} de plus)` : ''}`;

// GET /api/prof/editeur/presentation — la présentation en vigueur (celle du panneau), sa révision, si elle a déjà été
// appliquée, ses erreurs, ses avertissements (une image archivée en vigueur : elle ne bloque rien, D76), les noms des
// matières d'outil, et l'historique, le plus récent en tête, avec pour chaque contenu remplacé ce que le rétablir changerait.
// Ouverte aux deux rôles (D95) : la présentation en vigueur n'a pas de brouillon.
async function editeurPresentation(request, env, { now }) {
  await requireReader(request, env, now);
  const presentation = await loadPresentation(env.DB);
  const names = toolNamesOf(presentation.latest);
  const historique = (await base.listPresentationHistory(env.DB)).reverse();
  const images = await base.listImages(env.DB);
  return json({
    presentation: presentation.contenu,
    revision: presentation.revision,
    appliquee: presentation.stocke !== null,
    modifiee_le: presentation.modifiee_le,
    enseignant: presentation.enseignant,
    derniere_tables: presentation.latest.id,
    matieres_outil: presentation.latest.materiaux.materiaux_outil.map(({ cle, nom }) => ({ cle, nom })),
    erreurs: presentationErrors(presentation.contenu, { images, inForce: presentation.contenu }),
    avertissements: archivedWarnings(presentation.contenu, images),
    historique: historique.map((h) => ({
      id: h.id, posee_le: h.posee_le, posee_par: h.posee_par, remplacee_le: h.remplacee_le, remplacee_par: h.remplacee_par, action: h.action,
      lignes: presentationDiff(presentation.contenu, currentPresentation(h.contenu, presentation.latest), names),
    })),
  });
}

// Écrit une présentation à la place de celle en vigueur (application ou rétablissement) : 409 si la révision est
// périmée, 400 si rien ne change ; le contenu remplacé va à l'historique ; journalisé. Retourne les changements.
async function replacePresentation(env, presentation, { revision, contenu, action, teacher, now, details }) {
  if (revision !== presentation.revision) throw new HttpError(409, PRESENTATION_CONFLICT, { revision_actuelle: presentation.revision });
  const lignes = presentationDiff(presentation.contenu, currentPresentation(contenu, presentation.latest), toolNamesOf(presentation.latest));
  if (lignes.length === 0) throw new HttpError(400, 'Aucune différence avec la présentation en vigueur : rien à appliquer.');
  const remplace = { contenu: presentation.stocke ?? presentation.contenu, posee_le: presentation.stocke === null ? null : presentation.modifiee_le, posee_par: presentation.stocke === null ? null : presentation.enseignant };
  const saved = await base.setPresentation(env.DB, { revision, contenu, remplace, action, now: now.toISOString(), enseignant: teacher },
    logEntry(teacher, now, action === 'application' ? 'editeur_presentation_application' : 'editeur_presentation_retablissement', `${details}${changesText(lignes)}`));
  if (!saved) throw new HttpError(409, PRESENTATION_CONFLICT, { revision_actuelle: (await base.findPresentation(env.DB)).revision });
  return lignes;
}

// POST /api/prof/editeur/presentation/appliquer — { revision, presentation } : la liste blanche est imposée ici
// (tout autre champ → 400, nommé), avec les règles des tables ; une image CHOISIE (différente de celle en vigueur pour ce
// champ) doit exister et ne pas être archivée ; une image archivée déjà en vigueur n'est qu'un avertissement (D76,
// retouche). Effet immédiat.
async function editeurPresentationAppliquer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
  if (!Number.isInteger(body.revision)) throw new HttpError(400, 'La révision de la présentation est requise.');
  const presentation = await loadPresentation(env.DB);
  const images = await base.listImages(env.DB);
  const erreurs = presentationErrors(body.presentation, { images, inForce: presentation.contenu });
  if (erreurs.length > 0) throw new HttpError(400, `La présentation a ${erreurs.length} erreur(s) : rien n'a été appliqué.`, { erreurs });
  const contenu = normalizePresentation(body.presentation);
  const lignes = await replacePresentation(env, presentation, { revision: body.revision, contenu, action: 'application', teacher, now, details: '' });
  return json({ applique: true, revision: body.revision + 1, lignes, avertissements: archivedWarnings(contenu, images) });
}

// POST /api/prof/editeur/presentation/retablir — { revision, historique } : remet un contenu de l'historique en vigueur
// (celui en vigueur va à l'historique). Permis même si une image a été archivée depuis (D76, point 7) : elle est
// toujours servie ; l'avertissement la nomme, et, en vigueur, elle ne bloque plus rien (D76, retouche).
async function editeurPresentationRetablir(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  if (!Number.isInteger(body.revision)) throw new HttpError(400, 'La révision de la présentation est requise.');
  const entry = Number.isInteger(body.historique) ? await base.findPresentationHistory(env.DB, body.historique) : null;
  if (entry === null) throw new HttpError(404, "Ce contenu n'est pas dans l'historique de la présentation.");
  const images = await base.listImages(env.DB);
  const erreurs = presentationErrors(entry.contenu, { images, archived: 'permis' });
  if (erreurs.length > 0) throw new HttpError(400, `Ce contenu de l'historique a ${erreurs.length} erreur(s) : il ne peut pas être rétabli.`, { erreurs });
  const presentation = await loadPresentation(env.DB);
  const quand = entry.remplacee_le.slice(0, 16).replace('T', ' ');
  const lignes = await replacePresentation(env, presentation, { revision: body.revision, contenu: normalizePresentation(entry.contenu), action: 'retablissement', teacher, now, details: `historique n° ${entry.id} (remplacée le ${quand} UTC) · ` });
  return json({ retablie: true, revision: body.revision + 1, lignes, avertissements: archivedWarnings(entry.contenu, images) });
}

// --- La présentation d'un exercice en direct (D78) : lire, appliquer, rétablir ---------------------------------------
// Par exercice publié, la mécanique de la présentation des tables : pas de brouillon ; « Appliquer » change ce que tous les
// étudiants voient de cet exercice dès que leur page se recharge, séances en cours comprises, quelle que soit leur version.
// Chaque contenu remplacé va à l'historique ; « Rétablir » en remet un. Contrôle optimiste (D48), journal.

const EXERCISE_PRESENTATION_CONFLICT = "La présentation de cet exercice a été appliquée ailleurs depuis ton ouverture (un autre onglet ou un autre appareil). Recharge le panneau pour partir de la présentation en vigueur ; rien n'a été écrasé.";
const NEVER_PUBLISHED = "Cet exercice n'a jamais été publié : son titre, son cours, « À l'accueil », les photos et les notes sont dans son brouillon, et entrent en vigueur à sa première publication.";

// La dernière version publiée d'un exercice de la Gestion du contenu ; 400 s'il n'a jamais été publié.
async function publishedLatest(env, record) {
  const latest = await base.findLatestVersion(env.DB, record.id);
  if (latest === null) throw new HttpError(400, NEVER_PUBLISHED);
  return latest;
}

// Les noms des copies d'un exercice, d'après ses versions publiées (la plus récente l'emporte) : pour dire un outil en clair.
const versionNames = async (env, id) => copyNames((await base.listVersionContentsOf(env.DB, id)).map((v) => v.contenu));

// Ce que le panneau de la présentation d'un exercice publié reçoit (GET …/exercice/presentation, et la page de
// l'exercice) : la présentation en vigueur, sa révision, si elle a déjà été appliquée, les noms des copies (et si chacune
// est dans la dernière version), ses erreurs, ses avertissements (une photo archivée en vigueur : elle ne bloque rien),
// les retouches en attente du brouillon (D78, point 10 ; vides pour le rôle consultation, qui ne lit pas le brouillon,
// D95), et l'historique, le plus récent en tête, avec pour chaque contenu remplacé ce que le rétablir changerait.
async function exercisePresentationPayload(env, record, latest, { reader = false } = {}) {
  const presentation = await loadExercisePresentation(env.DB, record.id, latest.contenu);
  const versions = (await base.listVersionContentsOf(env.DB, record.id)).map((v) => v.contenu);
  const names = copyNames(versions);
  const latestIds = new Set(latest.contenu.outils.map((copy) => copy.id));
  const images = await base.listImages(env.DB);
  const historique = (await base.listExercisePresentationHistory(env.DB, record.id)).reverse();
  return {
    presentation: presentation.contenu,
    revision: presentation.revision,
    appliquee: presentation.stocke !== null,
    modifiee_le: presentation.modifiee_le,
    enseignant: presentation.enseignant,
    derniere_version: latest.numero,
    outils: presentation.contenu.outils.map((e) => ({ id: e.id, nom: names.get(e.id) ?? e.id, derniere_version: latestIds.has(e.id) })),
    erreurs: exercisePresentationErrors(presentation.contenu, { images, inForce: presentation.contenu }),
    avertissements: exerciseArchivedWarnings(presentation.contenu, images, names),
    en_attente: reader ? { lignes: [], contenu: null } : pendingExercisePresentation(versions, record.brouillon, presentation.contenu, names, historique.map((h) => h.contenu)),
    // Les titres en double (D79) : un avertissement, qui nomme les autres et ne bloque rien.
    doublons: record.archive_le === null ? sameTitleExercises(presentation.contenu.titre, await titlesInForce(env), record.id) : [],
    historique: historique.map((h) => ({
      id: h.id, posee_le: h.posee_le, posee_par: h.posee_par, remplacee_le: h.remplacee_le, remplacee_par: h.remplacee_par, action: h.action,
      lignes: exercisePresentationDiff(presentation.contenu, currentExercisePresentation(h.contenu, latest.contenu), names),
    })),
  };
}

// GET /api/prof/editeur/exercice/presentation?id=<id> — la présentation en vigueur d'un exercice publié et son historique.
// Ouverte aux deux rôles (D95) ; la consultation ne reçoit pas les retouches en attente du brouillon.
async function editeurExercicePresentation(request, env, { now }) {
  const { reader } = await requireReader(request, env, now);
  const record = await editorExercise(env, new URL(request.url).searchParams.get('id'));
  return json(await exercisePresentationPayload(env, record, await publishedLatest(env, record), { reader }));
}

// Écrit une présentation d'exercice à la place de celle en vigueur (application, renommage ou rétablissement) : 409 si la
// révision est périmée, 400 si rien ne change, 400 si le titre change pour celui d'un autre exercice publié et non archivé
// (D74, D78 point 6) ; le contenu remplacé va à l'historique ; journalisé. Retourne les changements.
//   presentation : loadExercisePresentation ; names : versionNames
async function replaceExercisePresentation(env, record, latest, presentation, { revision, contenu, action, teacher, now, details }, names = null) {
  if (revision !== presentation.revision) throw new HttpError(409, EXERCISE_PRESENTATION_CONFLICT, { revision_actuelle: presentation.revision });
  const next = currentExercisePresentation(contenu, latest.contenu);
  const lignes = exercisePresentationDiff(presentation.contenu, next, names ?? await versionNames(env, record.id));
  if (lignes.length === 0) throw new HttpError(400, 'Aucune différence avec la présentation en vigueur : rien à appliquer.');
  if (titleKey(next.titre) !== titleKey(presentation.contenu.titre)) {
    const doublons = sameTitleExercises(next.titre, await titlesInForce(env), record.id);
    if (doublons.length > 0) throw new HttpError(400, liveTitleRefusal(doublons), { doublons });
  }
  const remplace = { contenu: presentation.stocke ?? presentation.contenu, posee_le: presentation.stocke === null ? null : presentation.modifiee_le, posee_par: presentation.stocke === null ? null : presentation.enseignant };
  const saved = await base.setExercisePresentation(env.DB, { exerciceId: record.id, revision, contenu, remplace, action, now: now.toISOString(), enseignant: teacher },
    logEntry(teacher, now, action === 'application' ? 'editeur_presentation_exercice_application' : 'editeur_presentation_exercice_retablissement', `${record.id} · ${details}${changesText(lignes)}`));
  if (!saved) throw new HttpError(409, EXERCISE_PRESENTATION_CONFLICT, { revision_actuelle: (await base.findExercisePresentation(env.DB, record.id)).revision });
  return lignes;
}

// POST /api/prof/editeur/exercice/presentation/appliquer — { id, revision, presentation } : la liste blanche est imposée
// ici (tout autre champ → 400, nommé), une copie inconnue de la présentation en vigueur aussi ; une photo CHOISIE doit
// exister et ne pas être archivée ; une photo archivée déjà en vigueur n'est qu'un avertissement. Effet immédiat.
async function editeurExercicePresentationAppliquer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
  const record = await editorExercise(env, body.id);
  if (!Number.isInteger(body.revision)) throw new HttpError(400, 'La révision de la présentation est requise.');
  const latest = await publishedLatest(env, record);
  const presentation = await loadExercisePresentation(env.DB, record.id, latest.contenu);
  const images = await base.listImages(env.DB);
  const erreurs = exercisePresentationErrors(body.presentation, { images, inForce: presentation.contenu, copies: knownCopies(presentation.contenu) });
  if (erreurs.length > 0) throw new HttpError(400, `La présentation a ${erreurs.length} erreur(s) : rien n'a été appliqué.`, { erreurs });
  const contenu = normalizeExercisePresentation(body.presentation);
  const names = await versionNames(env, record.id);
  const lignes = await replaceExercisePresentation(env, record, latest, presentation, { revision: body.revision, contenu, action: 'application', teacher, now, details: '' }, names);
  return json({ applique: true, revision: body.revision + 1, lignes, avertissements: exerciseArchivedWarnings(contenu, images, names) });
}

// POST /api/prof/editeur/exercice/presentation/retablir — { id, revision, historique } : remet un contenu de l'historique
// de cet exercice en vigueur (celui en vigueur va à l'historique). Permis même si une photo a été archivée depuis ; la
// règle du titre en double s'applique si le titre change.
async function editeurExercicePresentationRetablir(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = await editorExercise(env, body.id);
  if (!Number.isInteger(body.revision)) throw new HttpError(400, 'La révision de la présentation est requise.');
  const latest = await publishedLatest(env, record);
  const entry = Number.isInteger(body.historique) ? await base.findExercisePresentationHistory(env.DB, record.id, body.historique) : null;
  if (entry === null) throw new HttpError(404, "Ce contenu n'est pas dans l'historique de la présentation de cet exercice.");
  const images = await base.listImages(env.DB);
  const erreurs = exercisePresentationErrors(entry.contenu, { images, archived: 'permis' });
  if (erreurs.length > 0) throw new HttpError(400, `Ce contenu de l'historique a ${erreurs.length} erreur(s) : il ne peut pas être rétabli.`, { erreurs });
  const presentation = await loadExercisePresentation(env.DB, record.id, latest.contenu);
  const names = await versionNames(env, record.id);
  const quand = entry.remplacee_le.slice(0, 16).replace('T', ' ');
  const contenu = normalizeExercisePresentation(entry.contenu);
  const lignes = await replaceExercisePresentation(env, record, latest, presentation, { revision: body.revision, contenu, action: 'retablissement', teacher, now, details: `historique n° ${entry.id} (remplacée le ${quand} UTC) · ` }, names);
  return json({ retablie: true, revision: body.revision + 1, lignes, avertissements: exerciseArchivedWarnings(contenu, images, names) });
}

// --- La banque d'outils et son historique (D79) -------------------------------------------------------------------

// Les erreurs d'un outil de la banque : la règle du catalogue (validateData) avec les tables d'aujourd'hui ; [{ champ, message }].
const bankToolErrors = (outil, tables) => validateData({ materiaux: tables.materiaux, operations: tables.operations, outils: { outils: [outil] } }).map((message) => ({ champ: '', message }));

// Un outil de la banque de la Gestion du contenu, ou 404.
async function bankTool(env, id) {
  const record = isToolId(id) ? await base.findBankTool(env.DB, id) : null;
  if (record === null) throw new HttpError(404, "Cet outil n'existe pas dans la banque.");
  return record;
}

// GET /api/prof/editeur/banque/outil?id=<id> — la page d'un outil : l'outil (avec qui a enregistré son contenu), les tables,
// ses erreurs et avertissements, et son historique, le plus récent en tête — pour chaque contenu remplacé, ce que le
// rétablir changerait, et ses erreurs et avertissements avec les tables d'aujourd'hui (D79). Ouverte aux deux rôles (D95).
async function editeurBanqueOutil(request, env, { now }) {
  await requireReader(request, env, now);
  const record = await bankTool(env, new URL(request.url).searchParams.get('id'));
  const tables = await latestTables(env);
  const images = await base.listImages(env.DB);
  const exercises = await base.listExercises(env.DB);
  const historique = (await base.listBankToolHistory(env.DB, record.id)).reverse();
  // Un contenu d'avant D83 ferait son passage en revenant (un facteur de vitesse sans raison : hérité, ou forcé « à
  // vérifier ») : c'est ce contenu-là que « Rétablir » remettrait, et qu'on compare au contenu actuel.
  const passage = (outil) => adoptSpeedFactor(outil, tables.operations.operations.find((op) => op.operation === outil.operation));
  return json({
    outil: {
      id: record.id, outil: record.outil, revision: record.revision, rang: record.rang, archive_le: record.archive_le, modifie_le: record.modifie_le, modifie_par: record.modifie_par ?? null,
      exercices: exercises.filter((e) => e.brouillon.outils.some((copy) => copy.origine === record.id)).map((e) => e.id),
    },
    tables: await shownTables(env, tables),
    erreurs: bankToolErrors(record.outil, tables),
    avertissements: bankImageCheck(record.outil, record.outil, images).avertissements,
    historique: historique.map((h) => {
      const contenu = passage({ ...cleanTool(h.contenu), id: record.id });
      const photo = bankImageCheck(contenu, record.outil, images, { archived: 'permis' });
      return {
        id: h.id, enregistre_le: h.enregistre_le, enregistre_par: h.enregistre_par, remplace_le: h.remplace_le, remplace_par: h.remplace_par, action: h.action,
        lignes: bankToolDiff(record.outil, contenu),
        erreurs: [...photo.erreurs, ...bankToolErrors(contenu, tables).map((e) => e.message)],
        avertissements: photo.avertissements,
      };
    }),
  });
}

// POST /api/prof/editeur/banque/creer — { id, outil } ou { id, depuis: <id> } (dupliquer).
async function editeurBanqueCreer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
  if (!isToolId(body.id)) throw new HttpError(400, "L'identifiant d'outil doit être fait de minuscules, de chiffres et de soulignés (ex. « foret_udrill »).");
  let outil;
  if (typeof body.depuis === 'string') {
    const source = await base.findBankTool(env.DB, body.depuis);
    if (source === null) throw new HttpError(404, "L'outil à dupliquer n'existe pas.");
    outil = { ...structuredClone(source.outil), id: body.id, nom: `${source.outil.nom} (copie)` };
  } else {
    // Un outil créé à l'ancien format (un facteur de vitesse sans raison) fait son passage avec les tables d'aujourd'hui (D83).
    const operations = (await latestTables(env)).operations.operations;
    outil = adoptSpeedFactor({ ...cleanTool(body.outil), id: body.id }, operations.find((op) => op.operation === body.outil?.operation));
    // Une photo nommée à la création est choisie : elle doit exister et ne pas être archivée (D79).
    const photo = bankImageCheck(outil, null, await base.listImages(env.DB));
    if (photo.erreurs.length > 0) throw new HttpError(400, `${photo.erreurs.join(' ')} Rien n'a été créé.`, { erreurs: photo.erreurs.map((message) => ({ champ: 'image', message })) });
  }
  const created = await base.createBankTool(env.DB, { id: body.id, outil, now: now.toISOString(), enseignant: teacher }, logEntry(teacher, now, typeof body.depuis === 'string' ? 'editeur_banque_duplication' : 'editeur_banque_creation', `${body.id}${typeof body.depuis === 'string' ? ` · dupliqué de ${body.depuis}` : ''}`));
  if (!created) throw new HttpError(409, `L'identifiant « ${body.id} » est déjà pris.`);
  return json({ cree: true, id: body.id });
}

// Écrit un contenu d'outil à la place du contenu actuel (enregistrement ou rétablissement) : le contenu remplacé va à
// l'historique (D79), le journal dit les changements en clair. 409 si quelqu'un a enregistré entre-temps.
async function replaceBankTool(env, record, { revision, outil, action, teacher, now, journal, details }) {
  const saved = await base.saveBankTool(env.DB, {
    id: record.id, revision, outil, now: now.toISOString(), enseignant: teacher, action,
    remplace: { contenu: record.outil, enregistre_le: record.modifie_le, enregistre_par: record.modifie_par ?? null },
  }, logEntry(teacher, now, journal, `${record.id} · ${details}`));
  if (!saved) throw new HttpError(409, CONFLICT, { revision_actuelle: (await base.findBankTool(env.DB, record.id)).revision });
}

// POST /api/prof/editeur/banque/enregistrer — { id, revision, outil } : contrôle optimiste (D48). Enregistré même en erreur
// (les erreurs sont rendues) ; une photo CHOISIE inconnue ou archivée est refusée (400, D79) ; sans changement, rien n'est
// écrit (`inchange`). Le contenu remplacé va à l'historique (D79).
async function editeurBanqueEnregistrer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
  const record = await bankTool(env, body.id);
  if (!Number.isInteger(body.revision)) throw new HttpError(400, "La révision de l'outil est requise.");
  if (body.revision !== record.revision) throw new HttpError(409, CONFLICT, { revision_actuelle: record.revision });
  const tables = await latestTables(env);
  // Un ancien outil (un facteur de vitesse sans raison) fait son passage avec les tables d'aujourd'hui (D83, point 5).
  const outil = adoptSpeedFactor({ ...cleanTool(body.outil), id: record.id }, tables.operations.operations.find((op) => op.operation === body.outil?.operation));
  const photo = bankImageCheck(outil, record.outil, await base.listImages(env.DB));
  if (photo.erreurs.length > 0) throw new HttpError(400, `${photo.erreurs.join(' ')} Rien n'a été enregistré.`, { erreurs: photo.erreurs.map((message) => ({ champ: 'image', message })) });
  const erreurs = bankToolErrors(outil, tables);
  if (sameContent(outil, record.outil)) return json({ enregistre: false, inchange: true, revision: record.revision, erreurs, lignes: [], avertissements: photo.avertissements });
  const lignes = bankToolDiff(record.outil, outil);
  await replaceBankTool(env, record, { revision: body.revision, outil, action: 'enregistrement', teacher, now, journal: 'editeur_banque_enregistrement',
    details: `révision ${body.revision + 1} · ${changesText(lignes)}${erreurs.length > 0 ? ` · ${erreurs.length} erreur(s)` : ''}` });
  return json({ enregistre: true, revision: body.revision + 1, erreurs, lignes, avertissements: photo.avertissements });
}

// POST /api/prof/editeur/banque/retablir — { id, revision, historique } : remet un contenu de l'historique de cet outil (celui
// en place va à l'historique). Revalidé avec les tables d'aujourd'hui : un contenu devenu invalide se rétablit quand même,
// comme un enregistrement en erreur, et ses erreurs sont rendues ; une photo archivée depuis est permise, avec un
// avertissement (D79). 404 historique inconnu pour cet outil ; 409 révision périmée ; 400 rien à changer.
async function editeurBanqueRetablir(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = await bankTool(env, body.id);
  if (!Number.isInteger(body.revision)) throw new HttpError(400, "La révision de l'outil est requise.");
  const entry = Number.isInteger(body.historique) ? await base.findBankToolHistory(env.DB, record.id, body.historique) : null;
  if (entry === null) throw new HttpError(404, "Ce contenu n'est pas dans l'historique de cet outil.");
  if (body.revision !== record.revision) throw new HttpError(409, CONFLICT, { revision_actuelle: record.revision });
  const tables = await latestTables(env);
  // Un contenu d'avant D83 fait son passage en revenant, avec les tables d'aujourd'hui (D83, point 5).
  const outil = adoptSpeedFactor({ ...cleanTool(entry.contenu), id: record.id }, tables.operations.operations.find((op) => op.operation === entry.contenu?.operation));
  const photo = bankImageCheck(outil, record.outil, await base.listImages(env.DB), { archived: 'permis' });
  if (photo.erreurs.length > 0) throw new HttpError(400, `${photo.erreurs.join(' ')} Rien n'a été rétabli.`, { erreurs: photo.erreurs.map((message) => ({ champ: 'image', message })) });
  if (sameContent(outil, record.outil)) throw new HttpError(400, 'Aucune différence avec le contenu actuel : rien à rétablir.');
  const erreurs = bankToolErrors(outil, tables);
  const lignes = bankToolDiff(record.outil, outil);
  const quand = entry.remplace_le.slice(0, 16).replace('T', ' ');
  await replaceBankTool(env, record, { revision: body.revision, outil, action: 'retablissement', teacher, now, journal: 'editeur_banque_historique_retablissement',
    details: `historique n° ${entry.id} (remplacé le ${quand} UTC) · ${changesText(lignes)}${erreurs.length > 0 ? ` · ${erreurs.length} erreur(s) avec les tables d'aujourd'hui` : ''}` });
  return json({ retabli: true, revision: body.revision + 1, lignes, erreurs, avertissements: photo.avertissements });
}

// POST /api/prof/editeur/banque/archiver — { id, archive: true|false }.
async function editeurBanqueArchiver(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = isToolId(body.id) ? await base.findBankTool(env.DB, body.id) : null;
  if (record === null) throw new HttpError(404, "Cet outil n'existe pas dans la banque.");
  if (typeof body.archive !== 'boolean') throw new HttpError(400, '« archive » doit être true ou false.');
  await base.archiveBankTool(env.DB, record.id, body.archive ? now.toISOString() : null, logEntry(teacher, now, body.archive ? 'editeur_banque_archivage' : 'editeur_banque_retablissement', record.id));
  return json({ archive: body.archive, id: record.id });
}

// --- Images (jalon 7b, D56) : photos d'outils et pictogrammes d'opérations, en blob dans D1 ---------------------------

// GET /images/<id> — public, sans cookie : le quiz affiche les photos et les pictogrammes. Servie
// avec son type exact, nosniff, un cache d'un an (une image ne change jamais sous le même identifiant)
// et, pour un SVG, une politique sans script (images.js). Une image archivée est toujours servie.
async function serveImage(request, env, id) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Méthode refusée', { status: 405 });
  const row = isImageId(id) ? await base.findImage(env.DB, id) : null;
  if (row === null) return new Response('Aucune image sous cet identifiant.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  const headers = imageHeaders(row);
  if (request.headers.get('if-none-match') === headers.etag) return new Response(null, { status: 304, headers });
  return new Response(request.method === 'HEAD' ? null : toBytes(row.contenu), { status: 200, headers });
}

// Où chaque image est utilisée : versions publiées, brouillons, banque, tables (pictogrammes, images de chaleur), et
// la présentation en direct, actuelle ou dans l'historique (D76), et le brouillon des tables (D77), et la présentation des
// exercices, en vigueur ou dans l'historique (D78).
async function imageContext(env) {
  return {
    versions: await base.listVersionContents(env.DB),
    exercices: await base.listExercises(env.DB),
    banque: await base.listBankTools(env.DB),
    tables: await base.listTables(env.DB),
    presentation: { actuelle: (await base.findPresentation(env.DB)).contenu, historique: await base.listPresentationHistory(env.DB) },
    brouillonTables: (await base.findTablesDraft(env.DB)).contenu,
    presentationExercices: {
      actuelles: [...(await base.listExercisePresentations(env.DB))].map(([id, p]) => ({ exercice_id: id, contenu: p.contenu })),
      historique: await base.listExercisePresentationHistory(env.DB),
    },
    historiqueBanque: await base.listBankToolHistory(env.DB),
  };
}

// GET /api/prof/editeur/images[?usage=outil|operation] — la liste des images avec où chacune est utilisée. Ouverte aux deux rôles (D95).
async function editeurImages(request, env, { now }) {
  await requireReader(request, env, now);
  const usage = new URL(request.url).searchParams.get('usage');
  const context = await imageContext(env);
  const rows = (await base.listImages(env.DB)).filter((row) => usage === null || row.usage === usage);
  return json({ images: rows.map((row) => ({ ...imageView(row), utilisations: imageUsages(row.id, context) })) });
}

const imageDetails = (image) => `${image.id} · ${image.nom} · ${image.usage} · ${image.type} · ${image.taille} octets`;

// POST /api/prof/editeur/images/televerser — { nom, usage, type, contenu (base64) } : le navigateur a
// déjà réduit l'image ; le serveur vérifie le type sur les octets, assainit un SVG, et ne stocke pas
// deux fois le même contenu (empreinte) : un doublon rend l'image existante, avec « existante: true ».
async function editeurImageTeleverser(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request, UPLOAD_BODY_MAX);
  let upload;
  try {
    upload = await readUpload(body);
  } catch (error) {
    if (error instanceof ImageError) throw new HttpError(400, error.message);
    throw error;
  }
  const existing = await base.findImageByHash(env.DB, upload.empreinte);
  if (existing !== null) return json({ image: imageView(existing), existante: true, retires: upload.retires });
  const image = { id: upload.id, nom: upload.nom, usage: upload.usage, type: upload.type, taille: upload.taille, empreinte: upload.empreinte, contenu: toBlob(upload.bytes), creee_le: now.toISOString(), archivee_le: null };
  const created = await base.createImage(env.DB, image, logEntry(teacher, now, 'editeur_image_televersement', imageDetails(image)));
  if (!created) throw new HttpError(409, "Cette image vient d'être téléversée par une autre requête : recharge la liste.");
  return json({ image: imageView(await base.findImageMeta(env.DB, image.id)), existante: false, retires: upload.retires });
}

// La fiche d'une image de la Gestion du contenu, ou 404.
async function editorImage(env, id) {
  const row = isImageId(id) ? await base.findImageMeta(env.DB, id) : null;
  if (row === null) throw new HttpError(404, "Cette image n'existe pas.");
  return row;
}

// POST /api/prof/editeur/images/archiver — { id, archive: true|false } : retirée du choix, toujours servie.
async function editeurImageArchiver(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const row = await editorImage(env, body.id);
  if (typeof body.archive !== 'boolean') throw new HttpError(400, '« archive » doit être true ou false.');
  await base.archiveImage(env.DB, row.id, body.archive ? now.toISOString() : null, logEntry(teacher, now, body.archive ? 'editeur_image_archivage' : 'editeur_image_retablissement', `${row.id} · ${row.nom}`));
  return json({ archive: body.archive, id: row.id });
}

// POST /api/prof/editeur/images/renommer — { id, nom } : le nom lisible seulement.
async function editeurImageRenommer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const row = await editorImage(env, body.id);
  if (typeof body.nom !== 'string' || body.nom.trim() === '') throw new HttpError(400, 'Le nom est requis.');
  const nom = body.nom.trim().slice(0, 80);
  await base.renameImage(env.DB, row.id, nom, logEntry(teacher, now, 'editeur_image_renommage', `${row.id} · « ${row.nom} » → « ${nom} »`));
  return json({ renomme: true, id: row.id, nom });
}

// POST /api/prof/editeur/images/supprimer — { id } : seulement si l'image n'est utilisée nulle part
// (version publiée, brouillon, banque, tables) ; sinon 409, et c'est « archiver » qu'il faut.
async function editeurImageSupprimer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const row = await editorImage(env, body.id);
  const usages = imageUsages(row.id, await imageContext(env));
  if (isUsed(usages)) throw new HttpError(409, `Cette image est utilisée (${usagesText(usages)}) : elle ne peut pas être supprimée, seulement archivée.`, { utilisations: usages });
  await base.deleteImage(env.DB, row.id, logEntry(teacher, now, 'editeur_image_suppression', `${row.id} · ${row.nom}`));
  return json({ supprimee: true, id: row.id });
}

// POST /api/prof/editeur/images/importer — { image: { id, nom, usage, type, empreinte, contenu (base64), creee_le, archivee_le } } :
// une image d'un export, envoyée à part avant l'import (D59) pour rester sous la limite des requêtes.
// L'identifiant et l'empreinte sont ceux de l'export ; le contenu doit avoir cette empreinte. Une image
// déjà là sous cet identifiant avec la même empreinte ne change pas (rien à faire) ; avec une autre, refusée.
async function editeurImageImporter(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request, UPLOAD_BODY_MAX);
  const image = body.image;
  if (!isImageId(image?.id) || typeof image.empreinte !== 'string') throw new HttpError(400, "L'image de l'export est illisible (identifiant ou empreinte).");
  let upload;
  try {
    upload = await readUpload({ nom: image.nom, usage: image.usage, type: image.type, contenu: image.contenu });
  } catch (error) {
    if (error instanceof ImageError) throw new HttpError(400, `Image « ${image.id} » : ${error.message}`);
    throw error;
  }
  if (upload.empreinte !== image.empreinte) throw new HttpError(400, `Image « ${image.id} » : le contenu n'a pas l'empreinte annoncée par l'export.`);
  const existing = await base.findImageMeta(env.DB, image.id);
  if (existing !== null) {
    if (existing.empreinte !== image.empreinte) throw new HttpError(409, `Image « ${image.id} » : la base en a déjà une autre sous cet identifiant. Une image ne change jamais sous le même identifiant.`);
    return json({ importee: false, id: image.id, existante: true });
  }
  const stored = { id: image.id, nom: upload.nom, usage: upload.usage, type: upload.type, taille: upload.taille, empreinte: upload.empreinte, contenu: toBlob(upload.bytes), creee_le: typeof image.creee_le === 'string' ? image.creee_le : now.toISOString(), archivee_le: typeof image.archivee_le === 'string' ? image.archivee_le : null };
  const created = await base.createImage(env.DB, stored, logEntry(teacher, now, 'editeur_image_import', imageDetails(stored)));
  if (!created) throw new HttpError(409, `Image « ${image.id} » : vient d'être créée par une autre requête.`);
  return json({ importee: true, id: image.id, existante: false });
}

// GET /api/prof/editeur/export — la sauvegarde complète : tables, banque, exercices et toutes leurs versions, et les images (contenu en base64).
async function editeurExport(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const data = await base.exportEditorData(env.DB);
  const images = (await base.listImagesWithContent(env.DB)).map((row) => ({ ...imageView(row), contenu: encodeBase64(toBytes(row.contenu)) }));
  await base.addTeacherLog(env.DB, logEntry(teacher, now, 'editeur_export', `${data.exercices.length} exercice(s) · ${data.banque.length} outil(s) · ${images.length} image(s)`));
  return json({ format: EXPORT_FORMAT, exporte_le: now.toISOString(), version_serveur: pkg.version, ...data, images });
}

// Le plan d'un import, à partir d'un export reçu et de ce que la base contient. Les images de
// l'export (fiches, sans contenu ou avec) sont comparées aux fiches en base : celles qui manquent
// doivent être envoyées à part (images/importer) avant l'import.
async function planImport(env, received) {
  // La banque avec ses lignes complètes (D79 : quand et par qui chaque contenu avait été enregistré, pour l'historique).
  const existing = { ...await base.exportEditorData(env.DB), images: await base.listImages(env.DB), banque: await base.listBankTools(env.DB) };
  // Les images que l'import laissera : celles de la base, et les fiches de l'export (leur état d'archivage) —
  // le brouillon des tables de l'export est validé contre elles (D64) ; une version publiée, immuable, ne l'est pas.
  const images = new Map(existing.images.map((i) => [i.id, i]));
  for (const i of Array.isArray(received?.images) ? received.images : []) if (i && typeof i.id === 'string') images.set(i.id, { id: i.id, archivee_le: typeof i.archivee_le === 'string' ? i.archivee_le : null });
  // Le brouillon des tables se valide avec la présentation posée par-dessus (D76), comme à la publication : celle de
  // l'export s'il en porte une, sinon celle de la base. Un champ de présentation resté caché dans le brouillon (une
  // image archivée depuis, par exemple) ne doit pas empêcher de restaurer une sauvegarde.
  const current = await loadPresentation(env.DB);
  const exported = received?.presentation_tables?.contenu;
  const overlay = exported !== null && typeof exported === 'object' && !Array.isArray(exported) ? currentPresentation(exported, current.latest) : current.contenu;
  return importPlan(received, existing, {
    tablesErrors: (t) => validateTables({ materiaux: t.materiaux, operations: t.operations }),
    draftTablesErrors: (t) => validateTables(applyPresentation(draftTablesOf(t), overlay), { images: [...images.values()], presentation: overlay }),
    draftErrorsOf: (contenu, tables) => draftErrors(contenu, tablesOf(tables)),
    latestTablesId: (await base.findLatestTables(env.DB)).id,
    // La présentation de l'export et son historique (D76) : la forme et la liste blanche, et des images qui existeront ;
    // une image archivée n'est pas une erreur (un contenu rétabli peut en nommer une).
    presentationErrorsOf: (contenu) => presentationErrors(contenu, { images: [...images.values()], archived: 'permis' }),
    exercisePresentationErrorsOf: (contenu) => exercisePresentationErrors(contenu, { images: [...images.values()], archived: 'permis' }),
  });
}

// POST /api/prof/editeur/import/valider — { export } : ce que l'import ferait, et ses erreurs ; rien n'est écrit.
async function editeurImportValider(request, env, { now }) {
  await requireAdmin(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
  const { erreurs, resume } = await planImport(env, body.export);
  return json({ erreurs, resume });
}

// POST /api/prof/editeur/import — { export, confirmation } : applique le plan, sans erreur seulement.
// Le mot attendu est IMPORTER ; REMPLACER si des outils de la banque disparaissent (D50) — le serveur
// l'exige, pas seulement l'écran.
async function editeurImport(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
  const { erreurs, plan, resume } = await planImport(env, body.export);
  if (erreurs.length > 0) throw new HttpError(400, "L'export a des erreurs : rien n'a été importé.", { erreurs });
  if (resume.images_manquantes.length > 0) throw new HttpError(400, `${resume.images_manquantes.length} image(s) de l'export ne sont pas encore dans la base : elles doivent être envoyées d'abord (images/importer). Rien n'a été importé.`, { images_manquantes: resume.images_manquantes });
  const word = importWord(resume);
  if (body.confirmation !== word) {
    const why = resume.banque.retires.length > 0 ? ` ${resume.banque.retires.length} outil(s) de la banque disparaîtraient : ${resume.banque.retires.map((t) => t.nom).join(', ')}.` : '';
    throw new HttpError(400, `Pour importer, la requête doit porter le mot ${word}.${why}`, { mot: word });
  }
  await base.applyImport(env.DB, plan, now.toISOString(), logEntry(teacher, now, 'editeur_import', importDetails(resume)));
  return json({ importe: true, resume });
}

// --- POST /api/deconnexion -------------------------------------------------------------------------------
// « Changer d'étudiant » : le jeton ne vaut plus rien, sur aucun appareil.
async function deconnexion(request, env, { now }) {
  const body = await readBody(request);
  const latest = await findExercise(env, body.exercice);
  const { session } = await authenticate(request, env, latest, now);
  await base.closeToken(env.DB, session.id);
  return json({ deconnecte: true });
}

const ROUTES = {
  'GET /api/exercice': exercice,
  'GET /api/exercices': exercices,
  'GET /api/tables': tables,
  'POST /api/consultation': consultation,
  'POST /api/creation': creation,
  'POST /api/reprise': reprise,
  'POST /api/identite': identite,
  'GET /api/seance': seance,
  'POST /api/question': question,
  'POST /api/correction': correction,
  'POST /api/deconnexion': deconnexion,
  'GET /api/attestation': attestation,
  'POST /api/verification': verification,
  'POST /api/demo/creation': demoCreation,
  'POST /api/demo/question': demoQuestion,
  'POST /api/demo/outil': demoOutil,
  'POST /api/demo/correction': demoCorrection,
  'GET /api/demo/specimen': demoSpecimen,
  'POST /api/prof/connexion': profConnexion,
  'POST /api/prof/deconnexion': profDeconnexion,
  'GET /api/prof/role': profRole,
  'GET /api/prof/seances': profSeances,
  'POST /api/prof/remise-a-zero': profRemiseAZero,
  'POST /api/prof/reinitialisation-nip': profReinitialisationNip,
  'POST /api/prof/suppression': profSuppression,
  'POST /api/prof/effacement': profEffacement,
  'GET /api/prof/identites': profIdentites,
  'GET /api/prof/editeur/exercices': editeurExercices,
  'GET /api/prof/editeur/exercice': editeurExercice,
  'POST /api/prof/editeur/exercice/creer': editeurCreer,
  'POST /api/prof/editeur/exercice/enregistrer': editeurEnregistrer,
  'POST /api/prof/editeur/exercice/renommer': editeurRenommer,
  'POST /api/prof/editeur/exercice/deplacer': editeurDeplacer,
  'POST /api/prof/editeur/exercice/archiver': editeurArchiver,
  'POST /api/prof/editeur/exercice/supprimer': editeurSupprimer,
  'POST /api/prof/editeur/exercice/publier': editeurPublier,
  'POST /api/prof/editeur/apercu': editeurApercu,
  'GET /api/prof/editeur/banque': editeurBanque,
  'POST /api/prof/editeur/exercice/tables': editeurExerciceTables,
  'GET /api/prof/editeur/tables': editeurTables,
  'GET /api/prof/editeur/tables/version': editeurTablesVersion,
  'POST /api/prof/editeur/tables/enregistrer': editeurTablesEnregistrer,
  'POST /api/prof/editeur/tables/publier': editeurTablesPublier,
  'POST /api/prof/editeur/tables/apercu': editeurTablesApercu,
  'GET /api/prof/editeur/tables/cascade': editeurTablesCascade,
  'POST /api/prof/editeur/tables/reprendre': editeurTablesReprendre,
  'POST /api/prof/editeur/tables/annuler': editeurTablesAnnuler,
  'POST /api/prof/editeur/exercice/reprendre': editeurReprendre,
  'POST /api/prof/editeur/exercice/annuler': editeurAnnuler,
  'GET /api/prof/editeur/presentation': editeurPresentation,
  'POST /api/prof/editeur/presentation/appliquer': editeurPresentationAppliquer,
  'POST /api/prof/editeur/presentation/retablir': editeurPresentationRetablir,
  'GET /api/prof/editeur/exercice/presentation': editeurExercicePresentation,
  'POST /api/prof/editeur/exercice/presentation/appliquer': editeurExercicePresentationAppliquer,
  'POST /api/prof/editeur/exercice/presentation/retablir': editeurExercicePresentationRetablir,
  'POST /api/prof/editeur/banque/creer': editeurBanqueCreer,
  'POST /api/prof/editeur/banque/enregistrer': editeurBanqueEnregistrer,
  'POST /api/prof/editeur/banque/archiver': editeurBanqueArchiver,
  'GET /api/prof/editeur/banque/outil': editeurBanqueOutil,
  'POST /api/prof/editeur/banque/retablir': editeurBanqueRetablir,
  'GET /api/prof/editeur/images': editeurImages,
  'POST /api/prof/editeur/images/televerser': editeurImageTeleverser,
  'POST /api/prof/editeur/images/archiver': editeurImageArchiver,
  'POST /api/prof/editeur/images/renommer': editeurImageRenommer,
  'POST /api/prof/editeur/images/supprimer': editeurImageSupprimer,
  'POST /api/prof/editeur/images/importer': editeurImageImporter,
  'GET /api/prof/editeur/export': editeurExport,
  'POST /api/prof/editeur/import/valider': editeurImportValider,
  'POST /api/prof/editeur/import': editeurImport,
};

// Les routes de la Gestion du contenu (tests : un cas par route pour le rôle consultation). Une fonction, pas une
// constante : le Workers runtime n'accepte comme exports du module d'entrée que des fonctions et le gestionnaire (un
// test le vérifie).
export function editorRoutes() {
  return Object.keys(ROUTES).filter((route) => route.includes('/api/prof/editeur/'));
}

// Celles qui acceptent le rôle consultation (D95) : des lectures, qui ne rendent jamais un brouillon (requireReader) ;
// toute autre route de la Gestion du contenu lui répond 403.
export function consultationRoutes() {
  return [
    'GET /api/prof/editeur/exercices',
    'GET /api/prof/editeur/exercice',
    'GET /api/prof/editeur/exercice/presentation',
    'POST /api/prof/editeur/apercu', // une version publiée seulement
    'GET /api/prof/editeur/banque',
    'GET /api/prof/editeur/banque/outil',
    'GET /api/prof/editeur/tables',
    'GET /api/prof/editeur/tables/version',
    'GET /api/prof/editeur/presentation',
    'GET /api/prof/editeur/images',
  ];
}

// Traite une requête. `tools` porte l'horloge et l'aléa — celui des tirages (random) et celui des
// codes d'attestation (randomBytes, D32) —, que les tests remplacent.
const REAL_TOOLS = () => ({ now: new Date(), random: Math.random, randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)) });

export async function handle(request, env, tools = REAL_TOOLS()) {
  const { pathname } = new URL(request.url);
  // /images/<id> : les photos et pictogrammes, lus dans D1 (D56). Tout le reste hors /api/ vient de site/.
  const image = pathname.match(/^\/images\/([^/]+)$/);
  if (image) {
    try {
      return await serveImage(request, env, decodeURIComponent(image[1]));
    } catch (error) {
      console.error(error);
      return new Response('Une erreur est survenue.', { status: 500, headers: { 'cache-control': 'no-store' } });
    }
  }
  // /prof/editeur, l'ancienne adresse de la Gestion du contenu (D74) : l'onglet Exercices de l'espace enseignant (D95).
  if (pathname === '/prof/editeur' || pathname === '/prof/editeur/') return Response.redirect(new URL('/prof#exercices', request.url).href, 302);
  if (pathname !== '/api' && !pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

  if (pathname === '/api/version' && request.method === 'GET') return json({ version: pkg.version });
  const route = ROUTES[`${request.method} ${pathname}`];
  if (!route) return json({ erreur: "Cette adresse n'existe pas." }, 404);

  try {
    return await route(request, env, tools);
  } catch (error) {
    if (error instanceof HttpError) return json({ erreur: error.message, ...error.extra }, error.status);
    console.error(error); // visible dans « wrangler tail » et dans le tableau de bord ; jamais envoyé à l'étudiant
    return json({ erreur: 'Une erreur est survenue. Réessaie dans un instant.' }, 500); // jamais le mot « serveur » (D93)
  }
}

export default {
  fetch: (request, env) => handle(request, env),
};
