// Tests de worker/index.js : le Worker est un simple objet { fetch }, appelé ici sans wrangler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// Fausse liaison ASSETS : note les chemins demandés et répond comme le ferait un fichier de site/.
function fauxSite() {
  const demandes = [];
  return { demandes, ASSETS: { fetch: async (request) => { demandes.push(new URL(request.url).pathname); return new Response('fichier du site'); } } };
}

const appel = (chemin, env, options) => worker.fetch(new Request(`https://quiz.example${chemin}`, options), env);

test('GET /api/version : la version de package.json, en JSON', async () => {
  const env = fauxSite();
  const reponse = await appel('/api/version', env);
  assert.equal(reponse.status, 200);
  assert.match(reponse.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await reponse.json(), { version });
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(env.demandes, []);
});

test('tout autre chemin /api/ : 501 avec un message en français, sans toucher aux fichiers du site', async () => {
  const env = fauxSite();
  const appels = [['/api/identification', { method: 'POST', body: '{}' }], ['/api/question'], ['/api/version', { method: 'POST' }], ['/api/'], ['/api']];
  for (const [chemin, options] of appels) {
    const reponse = await appel(chemin, env, options);
    assert.equal(reponse.status, 501, chemin);
    assert.match(reponse.headers.get('content-type'), /^application\/json/, chemin);
    assert.deepEqual(await reponse.json(), { erreur: "Le serveur de correction n'est pas encore en service." }, chemin);
  }
  assert.deepEqual(env.demandes, []);
});

test('le reste est servi par les ressources statiques', async () => {
  const env = fauxSite();
  for (const chemin of ['/', '/index.html', '/data/outils.json', '/apidoc', '/exercices/index.json?x=/api/']) {
    const reponse = await appel(chemin, env);
    assert.equal(await reponse.text(), 'fichier du site', chemin);
  }
  assert.deepEqual(env.demandes, ['/', '/index.html', '/data/outils.json', '/apidoc', '/exercices/index.json']);
});
