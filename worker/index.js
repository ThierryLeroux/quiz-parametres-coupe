// Serveur du quiz : un Worker Cloudflare (décisions D19 à D22 ; API décrite dans SPEC §7).
//   /api/…  → le serveur de correction, en JSON
//   le reste → les fichiers de site/, servis tels quels (liaison ASSETS de wrangler.jsonc)
//
// Ce fichier ne fait que recevoir les requêtes et enchaîner les étapes. Les règles du quiz sont
// dans seance.js, le SQL dans base.js, la cryptographie dans crypto.js, la lecture des JSON de
// site/ dans catalogue.js.

import pkg from '../package.json' with { type: 'json' };
import { cleanStudent, validateStudent } from '../site/js/identification.js';
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

// --- POST /api/identification ------------------------------------------------------------------------
// Crée la séance du couple (exercice, matricule), ou la reprend si le NIP est le bon.
async function identification(request, env, { now }) {
  const body = await readBody(request);
  const { data, exercise } = await findExercise(env, body.exercice);
  const errors = validateStudent(body);
  if (errors.length > 0) throw new HttpError(400, errors[0]);

  const student = cleanStudent(body);
  const nipHash = await hashNip(env.CLE_SECRETE, student.matricule, student.nip);
  const token = newToken();
  const opening = { nip_hache: nipHash, jeton_hache: await hashToken(token), jeton_expire_le: later(now, TOKEN_LIFETIME_MS) };

  let session = await base.findSession(env.DB, exercise.id, student.matricule);
  const created = session === null && await base.createSession(env.DB, {
    ...opening,
    exercice_id: exercise.id,
    matricule: student.matricule,
    prenom: student.prenom,
    nom: student.nom,
    debut: now.toISOString(),
    version_exercice: exercise.version,
    compteurs: emptyCounters(),
  });

  if (!created) {
    // Reprise : matricule + NIP identifient ; le prénom et le nom tapés sont ignorés (D21).
    session ??= await base.findSession(env.DB, exercise.id, student.matricule);
    const tooMany = new HttpError(429, "Trop d'essais. Attends 10 minutes avant de réessayer.");
    if (isNipLocked(session, now)) throw tooMany;
    // L'essai est compté avant d'être examiné : des essais lancés en parallèle ne passent pas tous.
    if (!await base.takeNipAttempt(env.DB, session, countNipAttempt(session, now))) throw tooMany;
    // nip_hache nul = NIP remis à zéro par l'enseignant : le NIP présenté devient le nouveau.
    if (session.nip_hache !== null && !sameText(session.nip_hache, nipHash)) throw new HttpError(401, 'NIP incorrect.');
    await base.openSession(env.DB, session.id, { ...opening, now: now.toISOString(), cleared: NIP_CLEARED });
  }

  session = await base.findSession(env.DB, exercise.id, student.matricule);
  return json({ jeton: token, seance: sessionView(session, exercise, data) });
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
    correction: correctionView(asked, answers, graded.result, before, graded.counters),
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
  'POST /api/identification': identification,
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
