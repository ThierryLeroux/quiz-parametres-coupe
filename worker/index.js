// Serveur du quiz : un Worker Cloudflare (décisions D19 à D23, D31 à D36, D47 à D49 ; API décrite dans SPEC §7).
//   /api/…               → le serveur de correction, en JSON
//   /api/prof/…          → l'espace professeur, derrière un cookie de séance signé
//   /api/prof/editeur/…  → l'éditeur des exercices et de la banque d'outils, rôle admin seulement
//   le reste             → les fichiers de site/, servis tels quels (liaison ASSETS de wrangler.jsonc)
//
// Ce fichier ne fait que recevoir les requêtes et enchaîner les étapes. Les règles du quiz sont
// dans seance.js, celles de l'attestation dans attestation.js, celles de l'accès (limites de débit,
// verrous, cookie professeur) dans acces.js, celles de l'éditeur dans editeur.js, le SQL dans
// base.js, la cryptographie dans crypto.js, le chargement des exercices depuis la base dans catalogue.js.

import pkg from '../package.json' with { type: 'json' };
import { validateData, validateTables } from '../site/js/data.js';
import { draftErrors, maskedFields } from '../site/js/exercice.js';
import { cleanStudent, matriculeError, nipError, validateStudent } from '../site/js/identification.js';
import {
  ADMIN, CONSULTATION, DISTINCT_PER_HOUR, PURGE_WORD, anonymizedDetails, canAct, clientAddress, hourSlot, isLocked, lockWait, profCookieHeader,
  profFailureLock, profSessionPayload, purgeDetails, readCookie, readProfSessionPayload, refusalLock,
} from './acces.js';
import { buildAttestation, canonical, claimsMatch, claimsOnlyCode, formatCode, newCode, readClaims, verificationUrl } from './attestation.js';
import * as base from './base.js';
import { assembleDraft, loadLatest, loadVersion, tablesOf } from './catalogue.js';
import { hashNip, hashToken, newToken, sameSecret, sameText, signAttestation, signProfSession } from './crypto.js';
import {
  EXPORT_FORMAT, cleanDraft, cleanTables, cleanTool, importDetails, importPlan, importWord, isExerciseId, isToolId, previewQuestions, sameContent,
} from './editeur.js';
import { isTablesId, nextRevision, tablesContent } from '../site/js/tables.js';
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

const SESSION_EXPIRED = 'Ta séance a expiré : identifie-toi de nouveau.';

// Le corps JSON d'une requête. Les requêtes du quiz sont courtes ; celles de l'éditeur portent des
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

// --- Limites de débit par adresse (D36) ---------------------------------------------------------------
// Consultation d'un matricule, vérification d'un code : au plus 100 valeurs DISTINCTES par adresse
// et par heure, jamais de limite sur le nombre de requêtes (tout le cégep sort par une adresse).
// La 101e valeur est refusée et verrouille l'adresse 10 minutes ; une valeur déjà vue passe toujours.

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
// pris fait échouer l'insertion (UNIQUE) : on en tire un autre (D42).
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

function exerciseView({ data, exercise, version }, archived) {
  return {
    exercice: { ...exercise, outils: data.outils.map((tool) => ({ ...tool, reussites_requises: exercise.outils.find((entry) => entry.id === tool.id).reussites_requises })) },
    tables: tablesView(data),
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
// par version, D63) : rien de secret, ce sont les feuilles de l'atelier.
async function tables(request, env) {
  const id = new URL(request.url).searchParams.get('version');
  const row = isTablesId(id) ? await base.findTables(env.DB, id) : null;
  if (row === null) throw new HttpError(404, "Cette version des tables de référence n'existe pas.");
  return json({ tables: { id: row.id, creee_le: row.creee_le, ...tablesOf(row) } });
}

// GET /api/exercice?exercice=<id>[&version=<n>] — l'exercice publié (sa dernière version, ou celle demandée).
async function exercice(request, env) {
  const params = new URL(request.url).searchParams;
  const latest = await findExercise(env, params.get('exercice'));
  const wanted = params.get('version');
  if (wanted === null || Number(wanted) === latest.version.numero) return json(exerciseView(latest, latest.archived));
  const version = /^[1-9]\d*$/.test(wanted) ? await base.findVersion(env.DB, latest.exercise.id, Number(wanted)) : null;
  if (version === null) throw new HttpError(404, "Cette version de l'exercice n'existe pas.");
  return json(exerciseView(await loadVersion(env.DB, version.id), latest.archived));
}

// GET /api/exercices — la liste de l'accueil (D18) : publiés, non archivés, sans « liste »: false.
async function exercices(request, env) {
  const rows = await base.listPublishedExercises(env.DB);
  return json({ exercices: rows.filter((row) => row.archive_le === null && row.contenu.liste !== false).map((row) => ({ id: row.id, titre: row.contenu.titre })) });
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
  return json({ jeton: token, seance: sessionView(session, exercise, data, viewOptions(request, env, now)) });
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
  return json({ jeton: token, seance: sessionView(await base.findSessionById(env.DB, session.id), exercise, data, viewOptions(request, env, now)) });
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
  if (changed) {
    const current = session.reussite_le === null ? null : await ensureAttestation(env, session, exercise, data, now, { randomBytes });
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
  return json({ seance: sessionView(await base.findSessionById(env.DB, session.id), exercise, data, viewOptions(request, env, now)) });
}

// --- GET /api/seance?exercice=<id> ---------------------------------------------------------------------
// L'état de la séance, sans rien tirer.
async function seance(request, env, { now }) {
  const latest = await findExercise(env, new URL(request.url).searchParams.get('exercice'));
  const { session, data, exercise } = await authenticate(request, env, latest, now);
  return json({ seance: sessionView(session, exercise, data, viewOptions(request, env, now)) });
}

// --- POST /api/question ----------------------------------------------------------------------------------
// La question à laquelle répondre. C'est le serveur qui la tire et la mémorise ; tant qu'elle n'est
// pas corrigée, c'est toujours la même qui revient : on ne « passe » pas une question.
async function question(request, env, { now, random, randomBytes }) {
  const body = await readBody(request);
  const latest = await findExercise(env, body.exercice);
  let { session, data, exercise } = await authenticate(request, env, latest, now);

  if (session.reussite_le === null && !isQuestionValid(session.question_courante, session.compteurs, exercise, data)) {
    const drawn = drawQuestion(session.compteurs, exercise, data, random);
    // Plus rien à tirer sans être passé par une correction : l'exercice a été allégé en cours de session (D21).
    const completion = drawn === null ? { reussite_le: now.toISOString(), version_exercice_reussite: exercise.version } : null;
    await base.saveQuestion(env.DB, session, drawn, completion); // si une autre requête a tiré avant nous, c'est sa question qui vaut
    session = await base.findSessionById(env.DB, session.id);
    if (session.reussite_le !== null) await ensureAttestation(env, session, exercise, data, now, { randomBytes });
  }
  return json({ seance: sessionView(session, exercise, data, viewOptions(request, env, now)) });
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
  // La dernière réussite exigée vient d'être obtenue : l'attestation est figée tout de suite (D31).
  if (updated.reussite_le !== null) await ensureAttestation(env, updated, exercise, data, now, { randomBytes });
  return json({
    correction: correctionView(asked, answers, graded.result, before, graded.counters, data, maskedFields(exercise)),
    seance: sessionView(updated, exercise, data, viewOptions(request, env, now)),
  });
}

// --- GET /api/attestation?exercice=<id> ------------------------------------------------------------------
// L'attestation de la séance, une fois l'exercice réussi ; un étudiant la retrouve par la reprise
// de séance. Une séance réussie avant cette version reçoit la sienne ici, à la première ouverture.
async function attestation(request, env, { now, randomBytes }) {
  const latest = await findExercise(env, new URL(request.url).searchParams.get('exercice'));
  const { session, data, exercise } = await authenticate(request, env, latest, now);
  if (session.reussite_le === null) throw new HttpError(409, "L'exercice n'est pas encore réussi.");
  return json(attestationView(request, await ensureAttestation(env, session, exercise, data, now, { randomBytes })));
}

// --- POST /api/verification — public, sans connexion (D33) -------------------------------------------------
// Deux entrées : l'adresse du QR (tous les champs et la signature), ou le code seul. Quatre issues :
// valide, annulee (remise à zéro ou identité corrigée, avec la date et le motif), aucune (aucune attestation ne correspond),
// invalide (signature invalide ou contenu modifié). Une attestation ne se vérifie pas à moitié : si
// l'adresse porte autre chose que le code, tout doit correspondre. Rien ne sort de plus que
// l'attestation imprimée. Limite de débit sur les codes distincts.
async function verification(request, env, { now }) {
  const claims = readClaims(await readBody(request));
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

// --- Espace professeur : /api/prof/… (D34, D35, D44) ------------------------------------------------------
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

// Les titres des exercices, par identifiant, pour le tableau des séances : le titre de la dernière
// version publiée, sinon celui du brouillon.
async function exerciseTitles(env) {
  return new Map((await base.listExercises(env.DB)).map((row) => [row.id, (row.contenu_publie ?? row.brouillon).titre]));
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

// --- L'éditeur : /api/prof/editeur/… (D47 à D49), rôle admin seulement ------------------------------------------
// Chaque route exige le cookie professeur avec le rôle admin (requireAdmin : 401 sans cookie, 403 en
// consultation), et chaque action est inscrite au journal des actions. L'aperçu, lui, n'enregistre rien.

const CONFLICT = "Ce brouillon a été enregistré ailleurs depuis ton ouverture (un autre onglet ou un autre appareil). Recharge la page pour reprendre ses dernières modifications ; rien n'a été écrasé.";

const logEntry = (teacher, now, action, details) => ({ horodatage: now.toISOString(), enseignant: teacher, action, details });

// La fiche d'un exercice de l'éditeur, ou 404.
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

// GET /api/prof/editeur/exercices — la liste : brouillon modifié ou non, dernière version, séances par version.
async function editeurExercices(request, env, { now }) {
  await requireAdmin(request, env, now);
  const rows = await base.listExercises(env.DB);
  const list = [];
  for (const row of rows) {
    list.push({
      id: row.id,
      rang: row.rang,
      titre: row.brouillon.titre,
      modifie: row.contenu_publie === null || !sameContent(row.brouillon, row.contenu_publie),
      derniere_version: row.derniere_version,
      publie_le: row.publie_le,
      archive_le: row.archive_le,
      brouillon_modifie_le: row.brouillon_modifie_le,
      seances: row.seances,
      versions: await base.listVersions(env.DB, row.id),
      liste: row.brouillon.liste !== false,
    });
  }
  return json({ exercices: list });
}

// GET /api/prof/editeur/exercice?id=<id> — le brouillon avec sa révision, les versions (sans contenu), la dernière version (contenu) et les tables.
async function editeurExercice(request, env, { now }) {
  await requireAdmin(request, env, now);
  const record = await editorExercise(env, new URL(request.url).searchParams.get('id'));
  const latest = await base.findLatestVersion(env.DB, record.id);
  const tables = await exerciseTables(env, record);
  const tablesVersions = await base.listTablesVersions(env.DB);
  return json({
    exercice: { id: record.id, brouillon: record.brouillon, revision: record.revision, brouillon_modifie_le: record.brouillon_modifie_le, publie_le: record.publie_le, archive_le: record.archive_le, tables_id: tables.id },
    versions: await base.listVersions(env.DB, record.id),
    derniere_version: latest === null ? null : { numero: latest.numero, contenu: latest.contenu, tables_id: latest.tables_id, publiee_le: latest.publiee_le },
    tables,
    // Les versions des tables (D62) : la plus récente en tête ; la page signale quand le brouillon n'est pas dessus.
    tables_versions: tablesVersions.map(({ id, creee_le }) => ({ id, creee_le })),
    derniere_tables: tablesVersions[0]?.id ?? tables.id,
    erreurs: draftErrors(record.brouillon, tables),
  });
}

// POST /api/prof/editeur/exercice/tables — { id, revision, tables_id } : le brouillon passe à cette version des
// tables (D62), avec le contrôle optimiste ; les erreurs du brouillon contre ces tables sont rendues.
async function editeurExerciceTables(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = await editorExercise(env, body.id);
  if (!Number.isInteger(body.revision)) throw new HttpError(400, 'La révision du brouillon est requise.');
  const row = isTablesId(body.tables_id) ? await base.findTables(env.DB, body.tables_id) : null;
  if (row === null) throw new HttpError(404, "Cette version des tables de référence n'existe pas.");
  const saved = await base.setExerciseTables(env.DB, record.id, body.revision, row.id, now.toISOString(), logEntry(teacher, now, 'editeur_tables_exercice', `${record.id} · tables ${record.tables_id ?? '—'} → ${row.id}`));
  if (!saved) throw new HttpError(409, CONFLICT, { revision_actuelle: (await base.findExercise(env.DB, record.id)).revision });
  return json({ change: true, tables_id: row.id, revision: body.revision + 1, erreurs: draftErrors(record.brouillon, tablesOf(row)) });
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
    brouillon = structuredClone(source.brouillon);
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
  const brouillon = cleanDraft(body.brouillon);
  if (!Array.isArray(brouillon.outils) || !Array.isArray(brouillon.champs_evalues)) throw new HttpError(400, 'Le brouillon est mal formé.');
  const tables = await exerciseTables(env, record);
  const erreurs = draftErrors(brouillon, tables);
  const saved = await base.saveDraft(env.DB, record.id, body.revision, brouillon, now.toISOString(), logEntry(teacher, now, 'editeur_enregistrement', `${record.id} · révision ${body.revision + 1}${erreurs.length > 0 ? ` · ${erreurs.length} erreur(s)` : ''}`));
  if (!saved) throw new HttpError(409, CONFLICT, { revision_actuelle: (await base.findExercise(env.DB, record.id)).revision });
  return json({ enregistre: true, revision: body.revision + 1, erreurs });
}

// POST /api/prof/editeur/exercice/renommer — { id, titre } : le titre du brouillon (à publier ensuite).
async function editeurRenommer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = await editorExercise(env, body.id);
  if (typeof body.titre !== 'string' || body.titre.trim() === '') throw new HttpError(400, 'Le titre est requis.');
  const brouillon = { ...record.brouillon, titre: body.titre.trim() };
  const saved = await base.saveDraft(env.DB, record.id, record.revision, brouillon, now.toISOString(), logEntry(teacher, now, 'editeur_renommage', `${record.id} · « ${record.brouillon.titre} » → « ${brouillon.titre} »`));
  if (!saved) throw new HttpError(409, CONFLICT);
  return json({ renomme: true, titre: brouillon.titre });
}

// POST /api/prof/editeur/exercice/deplacer — { id, rang, direction: "monter" | "descendre" } (D51) : l'ordre de la
// liste de l'éditeur et de l'accueil. Contrôle optimiste sur le rang que l'écran a vu ; les rangs sont réécrits 1 à n.
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

// POST /api/prof/editeur/exercice/publier — { id, revision } : le brouillon devient la version suivante, s'il est valide.
async function editeurPublier(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const record = await editorExercise(env, body.id);
  if (body.revision !== record.revision) throw new HttpError(409, CONFLICT, { revision_actuelle: record.revision });
  const tables = await exerciseTables(env, record); // la version publiée prend la version de tables du brouillon (D62)
  const erreurs = draftErrors(record.brouillon, tables);
  if (erreurs.length > 0) throw new HttpError(400, `Le brouillon a ${erreurs.length} erreur(s) : il ne peut pas être publié.`, { erreurs });
  const latest = await base.findLatestVersion(env.DB, record.id);
  // Une version identique à la précédente ne se publie pas (D51) : l'écran désactive déjà le bouton.
  // Un changement de version de tables est une différence (D62), même à contenu identique.
  if (latest !== null && sameContent(record.brouillon, latest.contenu) && latest.tables_id === tables.id) throw new HttpError(400, `Aucune différence à publier : le brouillon est identique à la version ${latest.numero}.`);
  const numero = (latest?.numero ?? 0) + 1;
  const published = await base.publishVersion(env.DB, { id: record.id, revision: record.revision, numero, contenu: record.brouillon, tablesId: tables.id, now: now.toISOString() },
    logEntry(teacher, now, 'editeur_publication', `${record.id} · version ${numero} · tables ${tables.id}`));
  if (!published) throw new HttpError(409, CONFLICT);
  return json({ publie: true, numero, publiee_le: now.toISOString() });
}

// POST /api/prof/editeur/apercu — { id, brouillon } ou { id, version } : dix questions et leurs réponses. Rien n'est enregistré.
async function editeurApercu(request, env, { now, random }) {
  await requireAdmin(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
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
async function editeurBanque(request, env, { now }) {
  await requireAdmin(request, env, now);
  const tools = await base.listBankTools(env.DB);
  const exercises = await base.listExercises(env.DB);
  const tables = await latestTables(env);
  const copies = (id) => exercises.filter((e) => e.brouillon.outils.some((copy) => copy.origine === id)).map((e) => e.id);
  return json({ outils: tools.map((row) => ({ id: row.id, outil: row.outil, revision: row.revision, rang: row.rang, archive_le: row.archive_le, modifie_le: row.modifie_le, exercices: copies(row.id) })), tables });
}

// --- Les tables de référence versionnées (D61, D63) : un brouillon, des versions immuables -------------------------

// Les erreurs d'un brouillon de tables : celles des deux tables (validateTables), sans outils.
const tablesErrors = (contenu) => validateTables(contenu).map((message) => ({ champ: '', message }));

// GET /api/prof/editeur/tables — le brouillon des tables (complété), ses erreurs, les versions publiées
// avec leurs utilisations, la révision suggérée pour la prochaine publication.
async function editeurTables(request, env, { now }) {
  await requireAdmin(request, env, now);
  const draft = await base.findTablesDraft(env.DB);
  const versions = await base.listTablesVersions(env.DB);
  const contenu = tablesOf(draft.contenu);
  const base_ = draft.base_id === null ? null : await base.findTables(env.DB, draft.base_id);
  return json({
    brouillon: { contenu, revision: draft.revision, modifie_le: draft.modifie_le, base_id: draft.base_id },
    modifie: base_ === null || !sameContent(tablesContent(contenu), tablesContent(tablesOf(base_))),
    erreurs: tablesErrors(contenu),
    versions: versions.map((v) => ({ id: v.id, creee_le: v.creee_le, utilisations: { versions_exercice: v.versions_exercice, brouillons: v.brouillons } })),
    derniere: versions[0]?.id ?? null,
    suggestion: nextRevision(versions[0]?.id ?? 'A2026_r0'),
  });
}

// GET /api/prof/editeur/tables/version?id=<id> — une version publiée des tables, complétée.
async function editeurTablesVersion(request, env, { now }) {
  await requireAdmin(request, env, now);
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
  const erreurs = tablesErrors(contenu);
  const saved = await base.saveTablesDraft(env.DB, body.revision, contenu, now.toISOString(), logEntry(teacher, now, 'editeur_tables_enregistrement', `révision ${body.revision + 1}${erreurs.length > 0 ? ` · ${erreurs.length} erreur(s)` : ''}`));
  if (!saved) throw new HttpError(409, CONFLICT, { revision_actuelle: (await base.findTablesDraft(env.DB)).revision });
  return json({ enregistre: true, revision: body.revision + 1, erreurs });
}

// POST /api/prof/editeur/tables/publier — { revision, id } : le brouillon devient la version « id » des
// tables (immuable) ; sa révision (dans les deux JSON) est posée à « id ». Refusé s'il a des erreurs,
// s'il est identique à la version dont il est parti, si l'identifiant est pris ou mal formé.
async function editeurTablesPublier(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  const draft = await base.findTablesDraft(env.DB);
  if (body.revision !== draft.revision) throw new HttpError(409, CONFLICT, { revision_actuelle: draft.revision });
  if (!isTablesId(body.id)) throw new HttpError(400, 'La révision des tables doit être faite de lettres, de chiffres, de « _ », « . » ou « - » (ex. « A2026_r1 »).');
  const contenu = tablesOf(draft.contenu);
  contenu.materiaux = { ...contenu.materiaux, revision: body.id };
  contenu.operations = { ...contenu.operations, revision: body.id };
  const erreurs = tablesErrors(contenu);
  if (erreurs.length > 0) throw new HttpError(400, `Le brouillon des tables a ${erreurs.length} erreur(s) : il ne peut pas être publié.`, { erreurs });
  const previous = draft.base_id === null ? null : await base.findTables(env.DB, draft.base_id);
  if (previous !== null && sameContent(tablesContent(contenu), tablesContent(tablesOf(previous)))) throw new HttpError(400, `Aucune différence à publier : le brouillon est identique à la version ${previous.id}.`);
  if ((await base.findTables(env.DB, body.id)) !== null) throw new HttpError(409, `La révision « ${body.id} » existe déjà : une version publiée ne se remplace pas.`);
  const outcome = await base.publishTables(env.DB, { id: body.id, revision: draft.revision, contenu, now: now.toISOString() }, logEntry(teacher, now, 'editeur_tables_publication', `tables ${body.id}${draft.base_id === null ? '' : ` · depuis ${draft.base_id}`}`));
  if (outcome === 'revision') throw new HttpError(409, CONFLICT);
  if (outcome === 'id') throw new HttpError(409, `La révision « ${body.id} » existe déjà : une version publiée ne se remplace pas.`);
  return json({ publie: true, id: body.id, publiee_le: now.toISOString() });
}

// POST /api/prof/editeur/tables/apercu — { contenu, exercice } : dix questions du brouillon de cet exercice,
// tirées avec ces tables (celles de l'écran, même non enregistrées), sans rien enregistrer (D63).
async function editeurTablesApercu(request, env, { now, random }) {
  await requireAdmin(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
  const record = await editorExercise(env, body.exercice);
  const contenu = cleanTables(body.contenu);
  if (contenu === null) throw new HttpError(400, 'Le brouillon des tables est mal formé.');
  const tables = tablesOf(contenu);
  const erreursTables = tablesErrors(tables);
  if (erreursTables.length > 0) throw new HttpError(400, "Le brouillon des tables a des erreurs : corrige-les avant l'aperçu.", { erreurs: erreursTables });
  const erreurs = draftErrors(record.brouillon, tables);
  if (erreurs.length > 0) throw new HttpError(400, `L'exercice « ${record.brouillon.titre} » a des erreurs avec ces tables : ${erreurs.map((e) => `${e.champ} : ${e.message}`).join(' ; ')}`, { erreurs });
  const assembledExercise = assembleDraft(record.id, record.brouillon, tables);
  return json({ questions: previewQuestions(assembledExercise.exercise, assembledExercise.data, random, 10), champs_evalues: assembledExercise.exercise.champs_evalues, champs_masques: assembledExercise.exercise.champs_masques ?? [] });
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
    outil = { ...cleanTool(body.outil), id: body.id };
  }
  const created = await base.createBankTool(env.DB, { id: body.id, outil, now: now.toISOString() }, logEntry(teacher, now, typeof body.depuis === 'string' ? 'editeur_banque_duplication' : 'editeur_banque_creation', `${body.id}${typeof body.depuis === 'string' ? ` · dupliqué de ${body.depuis}` : ''}`));
  if (!created) throw new HttpError(409, `L'identifiant « ${body.id} » est déjà pris.`);
  return json({ cree: true, id: body.id });
}

// POST /api/prof/editeur/banque/enregistrer — { id, revision, outil } : contrôle optimiste (D48).
async function editeurBanqueEnregistrer(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request, EDITOR_BODY_MAX);
  const record = isToolId(body.id) ? await base.findBankTool(env.DB, body.id) : null;
  if (record === null) throw new HttpError(404, "Cet outil n'existe pas dans la banque.");
  if (!Number.isInteger(body.revision)) throw new HttpError(400, "La révision de l'outil est requise.");
  const outil = { ...cleanTool(body.outil), id: record.id };
  const tables = await latestTables(env);
  const erreurs = validateData({ materiaux: tables.materiaux, operations: tables.operations, outils: { outils: [outil] } }).map((message) => ({ champ: '', message }));
  const saved = await base.saveBankTool(env.DB, record.id, body.revision, outil, now.toISOString(), logEntry(teacher, now, 'editeur_banque_enregistrement', `${record.id} · révision ${body.revision + 1}`));
  if (!saved) throw new HttpError(409, CONFLICT, { revision_actuelle: (await base.findBankTool(env.DB, record.id)).revision });
  return json({ enregistre: true, revision: body.revision + 1, erreurs });
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

// Où chaque image est utilisée : versions publiées, brouillons, banque, tables (pictogrammes).
async function imageContext(env) {
  return {
    versions: await base.listVersionContents(env.DB),
    exercices: await base.listExercises(env.DB),
    banque: await base.listBankTools(env.DB),
    tables: await base.listTables(env.DB),
  };
}

// GET /api/prof/editeur/images[?usage=outil|operation] — la liste des images avec où chacune est utilisée.
async function editeurImages(request, env, { now }) {
  await requireAdmin(request, env, now);
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

// La fiche d'une image de l'éditeur, ou 404.
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
    if (existing.empreinte !== image.empreinte) throw new HttpError(409, `Image « ${image.id} » : la base en a une autre sous le même identifiant ; une image ne change jamais sous le même identifiant.`);
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
  const existing = { ...await base.exportEditorData(env.DB), images: await base.listImages(env.DB) };
  return importPlan(received, existing, {
    tablesErrors: (t) => validateTables({ materiaux: t.materiaux, operations: t.operations }),
    draftErrorsOf: (contenu, tables) => draftErrors(contenu, tablesOf(tables)),
    latestTablesId: (await base.findLatestTables(env.DB)).id,
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
    const why = resume.banque.retires.length > 0 ? ` — ${resume.banque.retires.length} outil(s) de la banque disparaîtraient : ${resume.banque.retires.map((t) => t.nom).join(', ')}` : '';
    throw new HttpError(400, `Pour importer, la requête doit porter le mot ${word}${why}.`, { mot: word });
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
  'POST /api/prof/connexion': profConnexion,
  'POST /api/prof/deconnexion': profDeconnexion,
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
  'POST /api/prof/editeur/banque/creer': editeurBanqueCreer,
  'POST /api/prof/editeur/banque/enregistrer': editeurBanqueEnregistrer,
  'POST /api/prof/editeur/banque/archiver': editeurBanqueArchiver,
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

// Les routes de l'éditeur, toutes réservées au rôle admin (tests : refus du rôle consultation sur chacune).
// Une fonction, pas une constante : le Workers runtime n'accepte comme exports du module d'entrée
// que des fonctions et le gestionnaire (un test le vérifie).
export function editorRoutes() {
  return Object.keys(ROUTES).filter((route) => route.includes('/api/prof/editeur/'));
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
      return new Response('Erreur du serveur.', { status: 500, headers: { 'cache-control': 'no-store' } });
    }
  }
  if (pathname !== '/api' && !pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

  if (pathname === '/api/version' && request.method === 'GET') return json({ version: pkg.version });
  const route = ROUTES[`${request.method} ${pathname}`];
  if (!route) return json({ erreur: "Cette adresse n'existe pas sur le serveur de correction." }, 404);

  try {
    return await route(request, env, tools);
  } catch (error) {
    if (error instanceof HttpError) return json({ erreur: error.message, ...error.extra }, error.status);
    console.error(error); // visible dans « wrangler tail » et dans le tableau de bord ; jamais envoyé à l'étudiant
    return json({ erreur: 'Erreur du serveur de correction. Réessaie dans un instant.' }, 500);
  }
}

export default {
  fetch: (request, env) => handle(request, env),
};
