// Tests de site/js/api.js : les appels au serveur de correction, avec un faux fetch — puis avec le
// vrai Worker (aide-serveur.js) à la place du réseau : les deux côtés s'entendent sur les adresses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, getSession, getVersion, identify, nextQuestion, signOut, submitAnswers } from '../site/js/api.js';
import { SECONDE, serveurDeTest } from './aide-serveur.js';

const M10 = 'm10-tournage-vc';
const ETUDIANT = { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };

// Faux fetch : note chaque appel et répond ce qu'on lui dit.
function fauxFetch(status, corps) {
  const appels = [];
  const request = async (url, options) => {
    appels.push({ url, ...options });
    return new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status });
  };
  return { appels, request };
}

test('identify : POST /api/identification avec l’exercice et l’identification, sans jeton', async () => {
  const { appels, request } = fauxFetch(200, { jeton: 'abc123', seance: {} });
  assert.deepEqual(await identify(ETUDIANT, M10, request), { jeton: 'abc123', seance: {} });
  assert.equal(appels.length, 1);
  assert.equal(appels[0].url, '/api/identification');
  assert.equal(appels[0].method, 'POST');
  assert.deepEqual(appels[0].headers, { accept: 'application/json', 'content-type': 'application/json' });
  assert.deepEqual(JSON.parse(appels[0].body), { exercice: M10, ...ETUDIANT });
});

test('getSession : GET avec le jeton dans l’en-tête Authorization, l’exercice dans l’adresse', async () => {
  const { appels, request } = fauxFetch(200, { seance: {} });
  assert.deepEqual(await getSession('abc123', M10, request), { seance: {} });
  assert.equal(appels[0].url, `/api/seance?exercice=${M10}`);
  assert.equal(appels[0].method, 'GET');
  assert.deepEqual(appels[0].headers, { accept: 'application/json', authorization: 'Bearer abc123' });
  assert.equal(appels[0].body, undefined);
});

test('nextQuestion, submitAnswers, signOut : POST avec le jeton, et l’exercice dans le corps', async () => {
  const cas = [
    [(request) => nextQuestion('abc123', M10, request), '/api/question', { exercice: M10 }],
    [(request) => submitAnswers('abc123', M10, { vc: '400', rpm: '1,600' }, request), '/api/correction', { exercice: M10, saisies: { vc: '400', rpm: '1,600' } }],
    [(request) => signOut('abc123', M10, request), '/api/deconnexion', { exercice: M10 }],
  ];
  for (const [appel, chemin, corps] of cas) {
    const { appels, request } = fauxFetch(200, { ok: true });
    await appel(request);
    assert.equal(appels[0].url, chemin);
    assert.equal(appels[0].method, 'POST');
    assert.equal(appels[0].headers.authorization, 'Bearer abc123');
    assert.deepEqual(JSON.parse(appels[0].body), corps);
  }
});

test('erreur du serveur : ApiError avec le code HTTP, le message en français et le reste de la réponse', async () => {
  const cas = [[400, 'Le matricule doit avoir exactement 7 chiffres.'], [401, 'NIP incorrect.'], [429, "Trop d'essais."]];
  for (const [status, erreur] of cas) {
    const { request } = fauxFetch(status, { erreur });
    await assert.rejects(identify(ETUDIANT, M10, request), (error) => {
      assert.ok(error instanceof ApiError);
      assert.deepEqual([error.status, error.message, error.details], [status, erreur, {}]);
      return true;
    });
  }
  const { request } = fauxFetch(429, { erreur: 'Attends encore 6 s.', attendre_s: 6 });
  await assert.rejects(submitAnswers('abc123', M10, {}, request), { name: 'ApiError', status: 429, message: 'Attends encore 6 s.', details: { attendre_s: 6 } });
});

test('réponse d’erreur sans JSON : ApiError avec le code HTTP', async () => {
  const { request } = fauxFetch(502, '<html>Bad gateway</html>');
  await assert.rejects(nextQuestion('abc123', M10, request), { name: 'ApiError', status: 502, message: 'Le serveur a répondu 502.' });
});

test('serveur injoignable ou réponse illisible : ApiError de statut 0, jamais une autre exception', async () => {
  const horsLigne = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(identify(ETUDIANT, M10, horsLigne), { name: 'ApiError', status: 0, message: 'Le serveur de correction ne répond pas.' });
  const { request } = fauxFetch(200, 'pas du JSON');
  await assert.rejects(nextQuestion('abc123', M10, request), { name: 'ApiError', status: 0 });
});

test('avec le vrai Worker : identification, question, correction, état, déconnexion — de bout en bout', async () => {
  const serveur = serveurDeTest();
  const parLeWorker = async (url, options) => {
    const { status, corps } = await serveur.appel(options.method, url, { jeton: options.headers.authorization?.slice(7), corps: options.body && JSON.parse(options.body) });
    return new Response(JSON.stringify(corps), { status });
  };

  assert.match((await getVersion(parLeWorker)).version, /^\d+\.\d+\.\d+$/);
  const { jeton, seance } = await identify(ETUDIANT, M10, parLeWorker);
  assert.equal(seance.etudiant.prenom, 'Camille');
  await assert.rejects(identify({ ...ETUDIANT, nip: '0000' }, M10, parLeWorker), { status: 401, message: 'NIP incorrect.' });

  const { seance: posee } = await nextQuestion(jeton, M10, parLeWorker);
  assert.equal(posee.question.champs.length, 5);

  const corrigee = await submitAnswers(jeton, M10, { vc: serveur.bonnesReponses().vc }, parLeWorker);
  assert.equal(corrigee.correction.reussie, true);
  assert.equal(corrigee.seance.progression.total_reussies, 1);
  await assert.rejects(submitAnswers(jeton, M10, { vc: '1' }, parLeWorker), { status: 429, details: { attendre_s: 10 } });
  serveur.avancer(10 * SECONDE);
  assert.equal((await submitAnswers(jeton, M10, { vc: '1' }, parLeWorker)).correction.reussie, false);

  assert.equal((await getSession(jeton, M10, parLeWorker)).seance.progression.total_reussies, 1);
  assert.deepEqual(await signOut(jeton, M10, parLeWorker), { deconnecte: true });
  await assert.rejects(getSession(jeton, M10, parLeWorker), { status: 401 });
});
