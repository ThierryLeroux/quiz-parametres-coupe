// Tests de site/js/api.js : les appels au serveur de correction, avec un faux fetch — et, pour le
// 501, avec le vrai Worker (worker/index.js) à la place du réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, getQuestion, getReport, getVersion, identify, submitAnswers } from '../site/js/api.js';
import worker from '../worker/index.js';

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

// Le vrai Worker à la place du réseau : les chemins d'api.js sont bien ceux que le serveur attend.
const parLeWorker = (url, options) => worker.fetch(new Request(`https://quiz.example${url}`, options), {});

test('identify : POST /api/identification avec l’exercice et l’identification, sans jeton', async () => {
  const { appels, request } = fauxFetch(200, { jeton: 'abc123', prenom: 'Camille' });
  assert.deepEqual(await identify(ETUDIANT, 'm10-tournage-vc', request), { jeton: 'abc123', prenom: 'Camille' });
  assert.equal(appels.length, 1);
  assert.equal(appels[0].url, '/api/identification');
  assert.equal(appels[0].method, 'POST');
  assert.deepEqual(appels[0].headers, { accept: 'application/json', 'content-type': 'application/json' });
  assert.deepEqual(JSON.parse(appels[0].body), { exercice: 'm10-tournage-vc', ...ETUDIANT });
});

test('getQuestion et getReport : GET avec le jeton dans l’en-tête Authorization, l’exercice dans l’adresse', async () => {
  for (const [appel, chemin] of [[getQuestion, '/api/question'], [getReport, '/api/rapport']]) {
    const { appels, request } = fauxFetch(200, { ok: true });
    assert.deepEqual(await appel('abc123', 'm10-tournage-vc', request), { ok: true });
    assert.equal(appels[0].url, `${chemin}?exercice=m10-tournage-vc`);
    assert.equal(appels[0].method, 'GET');
    assert.deepEqual(appels[0].headers, { accept: 'application/json', authorization: 'Bearer abc123' });
    assert.equal(appels[0].body, undefined);
  }
});

test('submitAnswers : POST /api/correction avec le jeton, l’exercice et les saisies en texte', async () => {
  const { appels, request } = fauxFetch(200, { success: true });
  await submitAnswers('abc123', 'm10-tournage-vc', { vc: '400', rpm: '1,600' }, request);
  assert.equal(appels[0].url, '/api/correction');
  assert.equal(appels[0].method, 'POST');
  assert.equal(appels[0].headers.authorization, 'Bearer abc123');
  assert.deepEqual(JSON.parse(appels[0].body), { exercice: 'm10-tournage-vc', saisies: { vc: '400', rpm: '1,600' } });
});

test('erreur du serveur : ApiError avec le code HTTP et le message en français du serveur', async () => {
  const cas = [[400, 'Le matricule doit avoir exactement 7 chiffres.'], [401, 'NIP incorrect.'], [429, "Trop d'essais."]];
  for (const [status, erreur] of cas) {
    const { request } = fauxFetch(status, { erreur });
    await assert.rejects(identify(ETUDIANT, 'm10-tournage-vc', request), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.equal(error.message, erreur);
      return true;
    });
  }
});

test('réponse d’erreur sans JSON : ApiError avec le code HTTP', async () => {
  const { request } = fauxFetch(502, '<html>Bad gateway</html>');
  await assert.rejects(getQuestion('abc123', 'm10-tournage-vc', request), { name: 'ApiError', status: 502, message: 'Le serveur a répondu 502.' });
});

test('serveur injoignable ou réponse illisible : ApiError de statut 0, jamais une autre exception', async () => {
  const horsLigne = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(identify(ETUDIANT, 'm10-tournage-vc', horsLigne), { name: 'ApiError', status: 0, message: 'Le serveur de correction ne répond pas.' });
  const { request } = fauxFetch(200, 'pas du JSON');
  await assert.rejects(getQuestion('abc123', 'm10-tournage-vc', request), { name: 'ApiError', status: 0 });
});

test('avec le Worker d’aujourd’hui : la version répond, les quatre appels prévus lèvent une ApiError 501', async () => {
  assert.match((await getVersion(parLeWorker)).version, /^\d+\.\d+\.\d+$/);
  const appels = [
    () => identify(ETUDIANT, 'm10-tournage-vc', parLeWorker),
    () => getQuestion('abc123', 'm10-tournage-vc', parLeWorker),
    () => submitAnswers('abc123', 'm10-tournage-vc', { vc: '400' }, parLeWorker),
    () => getReport('abc123', 'm10-tournage-vc', parLeWorker),
  ];
  for (const appel of appels) {
    await assert.rejects(appel(), { name: 'ApiError', status: 501, message: "Le serveur de correction n'est pas encore en service." });
  }
});
