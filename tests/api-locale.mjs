// « npm run test:api » : l'API du serveur de correction, par HTTP, sur wrangler dev et une VRAIE base
// D1 locale — jetable, créée dans un dossier temporaire et détruite à la fin. Environ 30 secondes.
//
// Complète « npm test » (tests/worker-api.test.js), qui couvre tous les cas sur une base SQLite en
// mémoire avec une horloge réglable. Ici l'horloge est la vraie : on vérifie que le Worker se
// construit, que les migrations s'appliquent avec wrangler et que le SQL passe sur D1. Ce qui
// demande d'attendre 10 minutes ou 2 heures (verrou levé, jeton expiré) n'est testé que là-bas.
//
// Ce fichier ne finit pas par .test.js : « npm test » ne le lance pas.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL_MATERIAL_KEYS, loadData } from '../site/js/data.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WRANGLER = join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const PORT = 8799;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const M10 = 'm10-tournage-vc';
const CAMILLE = { exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };

const data = await loadData('data/', async (path) => JSON.parse(await readFile(join(ROOT, 'site', path), 'utf8')));
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function appel(methode, chemin, { jeton, corps } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (jeton) headers.authorization = `Bearer ${jeton}`;
  const response = await fetch(ORIGIN + chemin, { method: methode, headers, body: corps === undefined ? undefined : JSON.stringify(corps) });
  return { status: response.status, corps: await response.json() };
}

// La bonne Vc, trouvée comme le fait l'étudiant : table des vitesses, ligne du matériau, colonne de l'outil.
function bonneVc(question) {
  const materiau = data.materiaux.find((m) => m.groupe === question.materiau.groupe);
  return String(materiau.vc_pi_min[TOOL_MATERIAL_KEYS[question.outil.materiau]]);
}

let etapes = 0;
async function etape(nom, action) {
  await action();
  etapes += 1;
  console.log(`ok ${etapes} - ${nom}`);
}

const dossier = mkdtempSync(join(tmpdir(), 'quiz-d1-'));
let serveur = null;

function arreter() {
  if (serveur === null) return;
  // wrangler lance workerd dans un processus enfant : sous Windows, il faut arrêter tout l'arbre.
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(serveur.pid), '/T', '/F'], { stdio: 'ignore' });
  else serveur.kill('SIGTERM');
  serveur = null;
}

try {
  const migrations = spawnSync(process.execPath, [WRANGLER, 'd1', 'migrations', 'apply', 'quiz-parametres-coupe', '--local', '--persist-to', dossier], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(migrations.status, 0, `migrations : ${migrations.stdout}\n${migrations.stderr}`);
  console.log('# migrations appliquées sur une D1 locale jetable');

  serveur = spawn(process.execPath, [WRANGLER, 'dev', '--port', String(PORT), '--persist-to', dossier, '--var', 'CLE_SECRETE:secret-du-test-api-locale'], { cwd: ROOT, stdio: 'ignore' });
  for (let essai = 0; ; essai += 1) {
    assert.ok(essai < 60, 'wrangler dev ne répond pas après 60 s');
    await sleep(1000);
    try { if ((await fetch(`${ORIGIN}/api/version`)).ok) break; } catch { /* pas encore prêt */ }
  }

  let jeton;
  let question;

  await etape('version, et adresse inconnue → 404', async () => {
    assert.match((await appel('GET', '/api/version')).corps.version, /^\d+\.\d+\.\d+$/);
    assert.equal((await appel('GET', '/api/rien')).status, 404);
  });

  await etape('le site est servi à côté de l’API', async () => {
    const page = await fetch(`${ORIGIN}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>Quiz — paramètres de coupe<\/title>/);
  });

  await etape('création : première identification', async () => {
    const { status, corps } = await appel('POST', '/api/identification', { corps: CAMILLE });
    assert.equal(status, 200, JSON.stringify(corps));
    assert.match(corps.jeton, /^[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(corps.seance.etudiant, { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' });
    jeton = corps.jeton;
  });

  await etape('requêtes invalides → 400 ; NIP incorrect → 401 ; sans jeton → 401', async () => {
    assert.equal((await appel('POST', '/api/identification', { corps: { ...CAMILLE, exercice: 'inconnu' } })).status, 400);
    assert.equal((await appel('POST', '/api/identification', { corps: { ...CAMILLE, matricule: '123' } })).status, 400);
    assert.deepEqual(await appel('POST', '/api/identification', { corps: { ...CAMILLE, nip: '0000' } }), { status: 401, corps: { erreur: 'NIP incorrect.' } });
    assert.equal((await appel('GET', `/api/seance?exercice=${M10}`)).status, 401);
  });

  await etape('tirage mémorisé : la même question revient', async () => {
    const premiere = await appel('POST', '/api/question', { jeton, corps: { exercice: M10 } });
    assert.equal(premiere.status, 200, JSON.stringify(premiere.corps));
    question = premiere.corps.seance.question;
    assert.equal(question.champs.length, 5);
    assert.deepEqual((await appel('POST', '/api/question', { jeton, corps: { exercice: M10 } })).corps.seance.question, question);
    assert.deepEqual((await appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance.question, question);
  });

  await etape('correction fausse, puis cadence : 429 avant 10 s', async () => {
    const fausse = await appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: { vc: '1' } } });
    assert.equal(fausse.status, 200, JSON.stringify(fausse.corps));
    assert.equal(fausse.corps.correction.reussie, false);
    assert.equal(fausse.corps.seance.progression.total_reussies, 0);
    question = fausse.corps.seance.question;

    const tropTot = await appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: { vc: bonneVc(question) } } });
    assert.equal(tropTot.status, 429);
    assert.ok(tropTot.corps.attendre_s >= 1 && tropTot.corps.attendre_s <= 10);
  });

  await etape('correction juste, 10 s plus tard : compteur, total, question suivante', async () => {
    await sleep(10200);
    const juste = await appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: { vc: bonneVc(question) } } });
    assert.equal(juste.status, 200, JSON.stringify(juste.corps));
    assert.equal(juste.corps.correction.reussie, true);
    assert.equal(juste.corps.correction.outil.apres, 1);
    assert.equal(juste.corps.seance.progression.total_reussies, 1);
    assert.notEqual(juste.corps.seance.question, null);
  });

  await etape('reprise avec matricule + NIP : nouvel appareil, même séance ; l’ancien jeton ne vaut plus', async () => {
    const reprise = await appel('POST', '/api/identification', { corps: { ...CAMILLE, prenom: 'Cam', nom: 'T.' } });
    assert.equal(reprise.status, 200);
    assert.deepEqual(reprise.corps.seance.etudiant, { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' });
    assert.equal(reprise.corps.seance.progression.total_reussies, 1);
    assert.equal((await appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 401);
    jeton = reprise.corps.jeton;
    assert.equal((await appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 200);
  });

  await etape('changer d’étudiant : le jeton ne vaut plus rien', async () => {
    assert.deepEqual((await appel('POST', '/api/deconnexion', { jeton, corps: { exercice: M10 } })).corps, { deconnecte: true });
    assert.equal((await appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 401);
  });

  await etape('verrou : 5 NIP incorrects → 429, même avec le bon NIP', async () => {
    for (let essai = 1; essai <= 5; essai += 1) {
      assert.equal((await appel('POST', '/api/identification', { corps: { ...CAMILLE, nip: `999${essai}` } })).status, 401, `essai ${essai}`);
    }
    assert.equal((await appel('POST', '/api/identification', { corps: CAMILLE })).status, 429);
  });

  console.log(`\n# ${etapes} étapes réussies sur wrangler dev et une vraie D1 locale`);
} catch (error) {
  console.error(`\nnot ok - ${error.message}`);
  process.exitCode = 1;
} finally {
  arreter();
  await sleep(500);
  try { rmSync(dossier, { recursive: true, force: true }); } catch { /* Windows garde parfois un fichier un instant : dossier temporaire, sans importance */ }
}
