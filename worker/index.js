// Serveur du quiz : un Worker Cloudflare (décisions D19 à D23 ; API décrite dans SPEC §7).
//   /api/…  → le serveur de correction, en JSON
//   le reste → les fichiers de site/, servis tels quels (liaison ASSETS de wrangler.jsonc)
//
// Ce fichier ne fait que recevoir les requêtes et enchaîner les étapes. Les règles du quiz sont
// dans seance.js, le SQL dans base.js, la cryptographie dans crypto.js, la lecture des JSON de
// site/ dans catalogue.js.

import pkg from '../package.json' with { type: 'json' };
import { cleanStudent, matriculeError, nipError, validateStudent } from '../site/js/identification.js';
import * as base from './base.js';
import { loadCatalogue } from './catalogue.js';
import { hashNip, hashToken, newToken, sameText } from './crypto.js';
import {
  NIP_CLEARED, TOKEN_LIFETIME_MS, cadenceWait, cleanAnswers, correctionView, countNipAttempt, drawQuestion, emptyCounters,
  gradeQuestion, isNipLocked, isQuestionValid, later, sessionView,
} from './seance.js';

// Réponse JSON, jamais mise en cache : une réponse de l'API ne vaut que pour l'instant présent.
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
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
async function consultation(request, env) {
  const body = await readBody(request);
  const { exercise } = await findExercise(env, body.exercice);
  requireValid(matriculeError(body.matricule));
  const session = await base.findSession(env.DB, exercise.id, body.matricule.trim());
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
  return json({ jeton: token, seance: sessionView(session, exercise, data) });
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
  return json({ jeton: token, seance: sessionView(await base.findSessionById(env.DB, session.id), exercise, data) });
}

// --- POST /api/identite — « Corriger mon identité » : prénom, nom, matricule ; NIP exigé.
// La séance est déplacée, jamais copiée ; la correction est journalisée. Le jeton reste le même.
async function identite(request, env, { now }) {
  const body = await readBody(request);
  const { data, exercise } = await findExercise(env, body.exercice);
  const session = await authenticate(request, env, exercise, now);
  requireValid(validateStudent(body));
  const identity = cleanStudent(body);
  await checkNip(env, session, identity.nip, now);
  await base.clearNipAttempts(env.DB, session.id, NIP_CLEARED);

  const changed = ['prenom', 'nom', 'matricule'].some((key) => identity[key] !== session[key]);
  if (changed) {
    // Le NIP est haché avec le matricule (crypto.js) : nouveau matricule, nouveau haché du même NIP.
    const moved = await base.moveSession(env.DB, session, { ...identity, nip_hache: await hashNip(env.CLE_SECRETE, identity.matricule, identity.nip) }, now.toISOString());
    if (!moved) throw new HttpError(409, ALREADY_EXISTS);
  }
  return json({ seance: sessionView(await base.findSessionById(env.DB, session.id), exercise, data) });
}

// --- GET /api/seance?exercice=<id> ---------------------------------------------------------------------
// L'état de la séance, sans rien tirer.
async function seance(request, env, { now }) {
  const { data, exercise } = await findExercise(env, new URL(request.url).searchParams.get('exercice'));
  const session = await authenticate(request, env, exercise, now);
  return json({ seance: sessionView(session, exercise, data) });
}

// --- POST /api/question ----------------------------------------------------------------------------------
// La question à laquelle répondre. C'est le serveur qui la tire et la mémorise ; tant qu'elle n'est
// pas corrigée, c'est toujours la même qui revient : on ne « passe » pas une question.
async function question(request, env, { now, random }) {
  const body = await readBody(request);
  const { data, exercise } = await findExercise(env, body.exercice);
  let session = await authenticate(request, env, exercise, now);

  if (session.reussite_le === null && !isQuestionValid(session.question_courante, session.compteurs, exercise, data)) {
    const drawn = drawQuestion(session.compteurs, exercise, data, random);
    // Plus rien à tirer sans être passé par une correction : l'exercice a été allégé en cours de session (D21).
    const completion = drawn === null ? { reussite_le: now.toISOString(), version_exercice_reussite: exercise.version } : null;
    await base.saveQuestion(env.DB, session, drawn, completion); // si une autre requête a tiré avant nous, c'est sa question qui vaut
    session = await base.findSessionById(env.DB, session.id);
  }
  return json({ seance: sessionView(session, exercise, data) });
}

// --- POST /api/correction --------------------------------------------------------------------------------
// Corrige la question mémorisée — jamais une question venue du navigateur —, met les compteurs à
// jour, journalise, et tire la question suivante (ou constate la réussite).
async function correction(request, env, { now, random }) {
  const body = await readBody(request);
  const { data, exercise } = await findExercise(env, body.exercice);
  const session = await authenticate(request, env, exercise, now);

  if (session.reussite_le !== null || !isQuestionValid(session.question_courante, session.compteurs, exercise, data)) {
    throw new HttpError(409, "Aucune question n'attend de correction.");
  }
  const wait = cadenceWait(session, now);
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
  return json({
    correction: correctionView(asked, answers, graded.result, before, graded.counters, data),
    seance: sessionView(updated, exercise, data),
  });
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
};

// Traite une requête. `tools` porte l'horloge et l'aléa, que les tests remplacent.
export async function handle(request, env, tools = { now: new Date(), random: Math.random }) {
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
