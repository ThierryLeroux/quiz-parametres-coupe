// Serveur du quiz : un Worker Cloudflare (décisions D19 à D23, D31 à D36 ; API décrite dans SPEC §7).
//   /api/…       → le serveur de correction, en JSON
//   /api/prof/…  → l'espace professeur, derrière un cookie de séance signé
//   le reste     → les fichiers de site/, servis tels quels (liaison ASSETS de wrangler.jsonc)
//
// Ce fichier ne fait que recevoir les requêtes et enchaîner les étapes. Les règles du quiz sont
// dans seance.js, celles de l'attestation dans attestation.js, celles de l'accès (limites de débit,
// verrous, cookie professeur) dans acces.js, le SQL dans base.js, la cryptographie dans crypto.js,
// la lecture des JSON de site/ dans catalogue.js.

import pkg from '../package.json' with { type: 'json' };
import { cleanStudent, matriculeError, nipError, validateStudent } from '../site/js/identification.js';
import {
  ADMIN, CONSULTATION, DISTINCT_PER_HOUR, PURGE_WORD, canAct, clientAddress, hourSlot, isLocked, lockWait, profCookieHeader, profFailureLock,
  profSessionPayload, purgeDetails, readCookie, readProfSessionPayload, refusalLock,
} from './acces.js';
import { buildAttestation, canonical, claimsMatch, claimsOnlyCode, formatCode, newCode, readClaims, verificationUrl } from './attestation.js';
import * as base from './base.js';
import { loadCatalogue } from './catalogue.js';
import { hashNip, hashToken, newToken, sameSecret, sameText, signAttestation, signProfSession } from './crypto.js';
import {
  NIP_CLEARED, TOKEN_LIFETIME_MS, cadenceWait, cleanAnswers, correctionView, countNipAttempt, drawQuestion, emptyCounters,
  cadenceFor, gradeQuestion, isNipLocked, isQuestionValid, isTestMode, later, sessionView,
} from './seance.js';

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

async function readBody(request) {
  const text = await request.text();
  if (text.length > 10000) throw new HttpError(400, 'Requête trop longue.');
  try {
    const body = JSON.parse(text);
    if (body !== null && typeof body === 'object' && !Array.isArray(body)) return body;
  } catch {
    // traité ci-dessous
  }
  throw new HttpError(400, 'Requête illisible : du JSON est attendu.');
}

// L'exercice nommé par la requête — chaque appel le nomme (D21) — et le catalogue.
async function findExercise(env, id) {
  const { data, exercises } = await loadCatalogue(env.ASSETS);
  const exercise = typeof id === 'string' ? exercises.get(id) : undefined;
  if (!exercise) throw new HttpError(400, "Cet exercice n'existe pas.");
  return { data, exercise };
}

// La séance du jeton présenté. Jeton absent, inconnu, expiré ou d'un autre exercice → 401 : le
// navigateur renvoie alors à l'identification. Un appel accepté prolonge le jeton de 2 h.
async function authenticate(request, env, exercise, now) {
  const [, token] = (request.headers.get('authorization') ?? '').match(/^Bearer ([A-Za-z0-9_-]{20,100})$/) ?? [];
  const session = token ? await base.findSessionByToken(env.DB, await hashToken(token)) : null;
  if (session === null || session.exercice_id !== exercise.id || session.jeton_expire_le <= now.toISOString()) {
    throw new HttpError(401, SESSION_EXPIRED);
  }
  await base.touchSession(env.DB, session.id, now.toISOString(), later(now, TOKEN_LIFETIME_MS));
  return session;
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
  const { exercise } = await findExercise(env, body.exercice);
  requireValid(matriculeError(body.matricule));
  const matricule = body.matricule.trim();
  await limitRate(request, env, 'consultation', matricule, now);
  const session = await base.findSession(env.DB, exercise.id, matricule);
  if (session === null) return json({ trouvee: false });
  return json({ trouvee: true, prenom: session.prenom, initiale: [...session.nom][0].toUpperCase() });
}

// --- POST /api/creation — écran 2/2, aucune séance : prénom, nom, matricule, NIP choisi.
// Ne reprend jamais une séance existante : 409, et l'écran renvoie à la reprise.
async function creation(request, env, { now }) {
  const body = await readBody(request);
  const { data, exercise } = await findExercise(env, body.exercice);
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
    compteurs: emptyCounters(),
  });
  if (!created) throw new HttpError(409, ALREADY_EXISTS);
  const session = await base.findSession(env.DB, exercise.id, student.matricule);
  return json({ jeton: token, seance: sessionView(session, exercise, data, viewOptions(request, env, now)) });
}

// --- POST /api/reprise — écran 2/2, séance trouvée : matricule + NIP. Ni prénom ni nom.
async function reprise(request, env, { now }) {
  const body = await readBody(request);
  const { data, exercise } = await findExercise(env, body.exercice);
  requireValid(matriculeError(body.matricule), nipError(body.nip));
  const matricule = body.matricule.trim();
  const nip = body.nip.trim();

  const session = await base.findSession(env.DB, exercise.id, matricule);
  if (session === null) throw new HttpError(404, "Aucune séance pour ce matricule dans cet exercice.");
  await checkNip(env, session, nip, now);

  const { token, stored } = await freshToken(now);
  // nip_hache est réécrit : c'est ainsi qu'un NIP remis à zéro par l'enseignant est remplacé.
  await base.openSession(env.DB, session.id, { ...stored, nip_hache: await hashNip(env.CLE_SECRETE, matricule, nip), now: now.toISOString(), cleared: NIP_CLEARED });
  return json({ jeton: token, seance: sessionView(await base.findSessionById(env.DB, session.id), exercise, data, viewOptions(request, env, now)) });
}

// --- POST /api/identite — « Corriger mon identité » : prénom, nom, matricule ; NIP exigé.
// La séance est déplacée, jamais copiée ; la correction est journalisée. Le jeton reste le même.
// Après la réussite (D37) : l'attestation en cours est annulée (« identité corrigée ») et une
// nouvelle est émise — mêmes résultats, mêmes dates, nouvelle identité, nouveau code — dans le même lot.
// Si le code tiré est déjà pris, on en tire un autre (D42).
async function identite(request, env, { now, randomBytes }) {
  const body = await readBody(request);
  const { data, exercise } = await findExercise(env, body.exercice);
  const session = await authenticate(request, env, exercise, now);
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
  const { data, exercise } = await findExercise(env, new URL(request.url).searchParams.get('exercice'));
  const session = await authenticate(request, env, exercise, now);
  return json({ seance: sessionView(session, exercise, data, viewOptions(request, env, now)) });
}

// --- POST /api/question ----------------------------------------------------------------------------------
// La question à laquelle répondre. C'est le serveur qui la tire et la mémorise ; tant qu'elle n'est
// pas corrigée, c'est toujours la même qui revient : on ne « passe » pas une question.
async function question(request, env, { now, random, randomBytes }) {
  const body = await readBody(request);
  const { data, exercise } = await findExercise(env, body.exercice);
  let session = await authenticate(request, env, exercise, now);

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
  const { data, exercise } = await findExercise(env, body.exercice);
  const session = await authenticate(request, env, exercise, now);

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
    correction: correctionView(asked, answers, graded.result, before, graded.counters, data),
    seance: sessionView(updated, exercise, data, viewOptions(request, env, now)),
  });
}

// --- GET /api/attestation?exercice=<id> ------------------------------------------------------------------
// L'attestation de la séance, une fois l'exercice réussi ; un étudiant la retrouve par la reprise
// de séance. Une séance réussie avant cette version reçoit la sienne ici, à la première ouverture.
async function attestation(request, env, { now, randomBytes }) {
  const { data, exercise } = await findExercise(env, new URL(request.url).searchParams.get('exercice'));
  const session = await authenticate(request, env, exercise, now);
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

// GET /api/prof/seances — toutes les séances, pour le tableau des réussites ; le tri, le filtre et
// la recherche se font dans le navigateur (une classe, pas une base de données).
async function profSeances(request, env, { now }) {
  const { teacher, role } = await requireTeacher(request, env, now);
  const { exercises } = await loadCatalogue(env.ASSETS);
  const rows = await base.listSessions(env.DB);
  return json({
    enseignant: teacher,
    role,
    exercices: [...exercises.values()].map((exercise) => ({ id: exercise.id, titre: exercise.titre })),
    seances: rows.map((row) => ({
      id: row.id,
      exercice: { id: row.exercice_id, titre: exercises.get(row.exercice_id)?.titre ?? row.exercice_id },
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
// de corrections, corrections d'identité et attestations ; garde le journal des actions, où les
// nombres effacés sont inscrits. Les anciens codes d'attestation répondent ensuite « aucune ». Rôle
// admin seulement ; sans le mot exact, 400 et rien n'est touché. Exercices et catalogue ne sont pas en base.
async function profEffacement(request, env, { now }) {
  const { teacher } = await requireAdmin(request, env, now);
  const body = await readBody(request);
  if (body.confirmation !== PURGE_WORD) throw new HttpError(400, `Pour effacer, la requête doit porter le mot ${PURGE_WORD}.`);
  const nombres = await base.countStudentData(env.DB);
  await base.purgeStudentData(env.DB, { horodatage: now.toISOString(), enseignant: teacher, action: 'effacement', details: purgeDetails(nombres) });
  return json({ efface: true, nombres });
}

// GET /api/prof/identites — le journal des corrections d'identité, la plus récente en premier.
async function profIdentites(request, env, { now }) {
  await requireTeacher(request, env, now);
  return json({ corrections: await base.listIdentityCorrections(env.DB) });
}

// --- POST /api/deconnexion -------------------------------------------------------------------------------
// « Changer d'étudiant » : le jeton ne vaut plus rien, sur aucun appareil.
async function deconnexion(request, env, { now }) {
  const body = await readBody(request);
  const { exercise } = await findExercise(env, body.exercice);
  const session = await authenticate(request, env, exercise, now);
  await base.closeToken(env.DB, session.id);
  return json({ deconnecte: true });
}

const ROUTES = {
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
};

// Traite une requête. `tools` porte l'horloge et l'aléa — celui des tirages (random) et celui des
// codes d'attestation (randomBytes, D32) —, que les tests remplacent.
const REAL_TOOLS = () => ({ now: new Date(), random: Math.random, randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)) });

export async function handle(request, env, tools = REAL_TOOLS()) {
  const { pathname } = new URL(request.url);
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
