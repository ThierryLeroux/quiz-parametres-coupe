// « npm run test:api » : l'API du serveur de correction, par HTTP, sur wrangler dev et une VRAIE base
// D1 locale — jetable, créée dans un dossier temporaire et détruite à la fin. Environ 30 secondes.
//
// Complète « npm test » (tests/worker-api.test.js), qui couvre tous les cas sur une base SQLite en
// mémoire avec une horloge réglable. Ici l'horloge est la vraie : on vérifie que le Worker se
// construit, que les migrations s'appliquent avec wrangler et que le SQL passe sur D1. Ce qui
// demande d'attendre 10 minutes ou 2 heures (verrou levé, jeton expiré) n'est testé que là-bas.
// Le cycle complet du jalon 5 (réussite du M10, attestation, vérification par l'adresse du QR et par
// le code, connexion professeur, remise à zéro, attestation annulée) prend environ 2,5 minutes de
// plus : la cadence de 10 s entre deux corrections est la vraie.
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

let derniersEntetes = null; // les en-têtes de la dernière réponse (Set-Cookie de l'espace professeur)

async function appel(methode, chemin, { jeton, corps, cookie } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (jeton) headers.authorization = `Bearer ${jeton}`;
  if (cookie) headers.cookie = cookie;
  const response = await fetch(ORIGIN + chemin, { method: methode, headers, body: corps === undefined ? undefined : JSON.stringify(corps) });
  derniersEntetes = response.headers;
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

  // « --var » l'emporte sur .dev.vars : le test ne dépend ni des secrets locaux, ni d'un MODE_TEST=1 laissé là
  // par l'enseignant (D26) — la cadence de l'étape 6 doit tenir.
  serveur = spawn(process.execPath, [WRANGLER, 'dev', '--port', String(PORT), '--persist-to', dossier, '--var', 'CLE_SECRETE:secret-du-test-api-locale', '--var', 'CLE_ADMIN:cle-admin-du-test-api-locale', '--var', 'MODE_TEST:0'], { cwd: ROOT, stdio: 'ignore' });
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

  await etape('le site est servi à côté de l’API, avec /verifier et /prof', async () => {
    const page = await fetch(`${ORIGIN}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>Quiz — paramètres de coupe<\/title>/);
    assert.match(await (await fetch(`${ORIGIN}/verifier`)).text(), /Vérification d'une attestation/);
    assert.match(await (await fetch(`${ORIGIN}/prof`)).text(), /Espace professeur/);
    assert.equal((await fetch(`${ORIGIN}/vendor/qrcode-generator-2.0.4.mjs`)).status, 200);
  });

  await etape('consultation « aucune séance », création, consultation « séance trouvée » (D23)', async () => {
    assert.deepEqual((await appel('POST', '/api/consultation', { corps: { exercice: M10, matricule: CAMILLE.matricule } })).corps, { trouvee: false });
    const { status, corps } = await appel('POST', '/api/creation', { corps: CAMILLE });
    assert.equal(status, 200, JSON.stringify(corps));
    assert.match(corps.jeton, /^[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(corps.seance.etudiant, { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' });
    jeton = corps.jeton;
    assert.deepEqual((await appel('POST', '/api/consultation', { corps: { exercice: M10, matricule: CAMILLE.matricule } })).corps, { trouvee: true, prenom: 'Camille', initiale: 'T' });
    assert.equal((await appel('POST', '/api/creation', { corps: CAMILLE })).status, 409);
    assert.equal((await appel('POST', '/api/reprise', { corps: { ...CAMILLE, matricule: '2498765' } })).status, 404);
  });

  await etape('requêtes invalides → 400 ; NIP incorrect → 401 ; sans jeton → 401', async () => {
    assert.equal((await appel('POST', '/api/creation', { corps: { ...CAMILLE, exercice: 'inconnu' } })).status, 400);
    assert.equal((await appel('POST', '/api/consultation', { corps: { exercice: M10, matricule: '123' } })).status, 400);
    assert.deepEqual(await appel('POST', '/api/reprise', { corps: { ...CAMILLE, nip: '0000' } }), { status: 401, corps: { erreur: 'NIP incorrect.' } });
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
    const reprise = await appel('POST', '/api/reprise', { corps: { exercice: M10, matricule: CAMILLE.matricule, nip: CAMILLE.nip } });
    assert.equal(reprise.status, 200);
    assert.deepEqual(reprise.corps.seance.etudiant, { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' });
    assert.equal(reprise.corps.seance.progression.total_reussies, 1);
    assert.equal((await appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 401);
    jeton = reprise.corps.jeton;
    assert.equal((await appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 200);
  });

  await etape('corriger mon identité : la séance est déplacée vers le bon matricule, puis ramenée (D23)', async () => {
    const corrige = await appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, prenom: 'Camila', matricule: '2412346' } });
    assert.equal(corrige.status, 200, JSON.stringify(corrige.corps));
    assert.deepEqual(corrige.corps.seance.etudiant, { prenom: 'Camila', nom: 'Tremblay', matricule: '2412346' });
    assert.equal(corrige.corps.seance.progression.total_reussies, 1);
    assert.deepEqual((await appel('POST', '/api/consultation', { corps: { exercice: M10, matricule: CAMILLE.matricule } })).corps, { trouvee: false });
    assert.equal((await appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, nip: '0000' } })).status, 401);
    assert.equal((await appel('POST', '/api/identite', { jeton, corps: CAMILLE })).status, 200);
    // Un matricule déjà pris pour cet exercice : refusé par la contrainte d'unicité de la vraie D1.
    assert.equal((await appel('POST', '/api/creation', { corps: { ...CAMILLE, prenom: 'Alex', matricule: '2498765' } })).status, 200);
    assert.equal((await appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, matricule: '2498765' } })).status, 409);
  });

  await etape('changer d’étudiant : le jeton ne vaut plus rien', async () => {
    assert.deepEqual((await appel('POST', '/api/deconnexion', { jeton, corps: { exercice: M10 } })).corps, { deconnecte: true });
    assert.equal((await appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 401);
  });

  await etape('verrou : 5 NIP incorrects → 429, même avec le bon NIP', async () => {
    for (let essai = 1; essai <= 5; essai += 1) {
      assert.equal((await appel('POST', '/api/reprise', { corps: { ...CAMILLE, nip: `999${essai}` } })).status, 401, `essai ${essai}`);
    }
    assert.equal((await appel('POST', '/api/reprise', { corps: CAMILLE })).status, 429);
  });

  // --- Jalon 5 : le cycle complet, avec une troisième étudiante ------------------------------------------------
  const ZOE = { exercice: M10, prenom: 'Zoé', nom: 'Lévesque', matricule: '2455555', nip: '2468' };
  let attestation;
  let cookie;
  let seanceZoe;

  await etape('réussite du M10 (15 bonnes réponses, cadence de 10 s) : l’attestation est créée à la dernière', async () => {
    const creation = await appel('POST', '/api/creation', { corps: ZOE });
    assert.equal(creation.status, 200, JSON.stringify(creation.corps));
    const jetonZoe = creation.corps.jeton;
    assert.equal((await appel('GET', `/api/attestation?exercice=${M10}`, { jeton: jetonZoe })).status, 409);
    let etat = (await appel('POST', '/api/question', { jeton: jetonZoe, corps: { exercice: M10 } })).corps.seance;
    for (let n = 1; etat.reussite_le === null; n += 1) {
      assert.ok(n <= 15, 'plus de 15 questions');
      await sleep(10200);
      const correction = await appel('POST', '/api/correction', { jeton: jetonZoe, corps: { exercice: M10, saisies: { vc: bonneVc(etat.question) } } });
      assert.equal(correction.status, 200, JSON.stringify(correction.corps));
      assert.equal(correction.corps.correction.reussie, true, `question ${n}`);
      etat = correction.corps.seance;
      process.stdout.write(`\r  questions réussies : ${n}   `);
    }
    process.stdout.write('\r');
    const reponse = await appel('GET', `/api/attestation?exercice=${M10}`, { jeton: jetonZoe });
    assert.equal(reponse.status, 200, JSON.stringify(reponse.corps));
    attestation = reponse.corps;
    assert.match(attestation.code, /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}$/);
    assert.match(attestation.signature, /^[A-Za-z0-9_-]{43}$/);
    assert.ok(attestation.url_verification.startsWith(`${ORIGIN}/verifier?`), attestation.url_verification);
    assert.deepEqual(attestation.attestation.etudiant, { prenom: 'Zoé', nom: 'Lévesque', matricule: '2455555' });
    assert.equal(attestation.attestation.questions_reussies, 15);
    assert.equal(attestation.attestation.reussite_le, etat.reussite_le);
    assert.equal(attestation.attestation.outils.length, 9);
  });

  await etape('vérification : par l’adresse du QR et par le code → valide ; adresse retouchée → invalide ; code inconnu → aucune', async () => {
    const claims = Object.fromEntries(new URL(attestation.url_verification).searchParams);
    const parUrl = await appel('POST', '/api/verification', { corps: claims });
    assert.deepEqual(parUrl, { status: 200, corps: { resultat: 'valide', attestation: attestation.attestation } });
    assert.deepEqual((await appel('POST', '/api/verification', { corps: { code: attestation.code.toLowerCase() } })).corps, parUrl.corps);
    assert.deepEqual((await appel('POST', '/api/verification', { corps: { ...claims, questions: '16' } })).corps, { resultat: 'invalide' });
    assert.deepEqual((await appel('POST', '/api/verification', { corps: { ...claims, signature: 'x'.repeat(43) } })).corps, { resultat: 'invalide' });
    assert.deepEqual((await appel('POST', '/api/verification', { corps: { code: 'ABCDE-FGHJK' } })).corps, { resultat: 'aucune' });
    assert.equal((await appel('POST', '/api/verification', { corps: { code: 'ABC' } })).status, 400);
  });

  await etape('connexion professeur : clé fausse → 401 ; sans cookie → 401 ; bonne clé → cookie de séance', async () => {
    assert.equal((await appel('POST', '/api/prof/connexion', { corps: { cle: 'mauvaise' } })).status, 401);
    assert.equal((await appel('GET', '/api/prof/seances')).status, 401);
    const connexion = await appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-du-test-api-locale' } });
    assert.equal(connexion.status, 200, JSON.stringify(connexion.corps));
    assert.equal(connexion.corps.enseignant, 'admin');
    const setCookie = derniersEntetes.get('set-cookie');
    assert.match(setCookie, /^prof=[^;]+; Path=\/api\/prof; HttpOnly; Secure; SameSite=Strict; Max-Age=43200$/);
    cookie = setCookie.split(';')[0];
  });

  await etape('liste des séances : Zoé réussie avec son code, les autres en cours ; corrections d’identité de Camille', async () => {
    const { status, corps } = await appel('GET', '/api/prof/seances', { cookie });
    assert.equal(status, 200, JSON.stringify(corps));
    seanceZoe = corps.seances.find((s) => s.matricule === '2455555');
    assert.deepEqual([seanceZoe.prenom, seanceZoe.nom, seanceZoe.questions_reussies, seanceZoe.code, seanceZoe.exercice.id], ['Zoé', 'Lévesque', 15, attestation.code, M10]);
    assert.notEqual(seanceZoe.reussite_le, null);
    assert.equal(corps.seances.find((s) => s.matricule === CAMILLE.matricule).reussite_le, null);
    const identites = await appel('GET', '/api/prof/identites', { cookie });
    assert.equal(identites.status, 200);
    assert.ok(identites.corps.corrections.length >= 2);
    assert.deepEqual([identites.corps.corrections[0].nouveau_matricule, identites.corps.corrections.at(-1).ancien_matricule], [CAMILLE.matricule, CAMILLE.matricule]);
  });

  await etape('remise à zéro de Zoé : progression à zéro, attestation annulée avec la date, vérification « annulée » ; Zoé reprend au début', async () => {
    assert.deepEqual((await appel('POST', '/api/prof/remise-a-zero', { corps: { seance: seanceZoe.id }, cookie })).corps, { remise_a_zero: true, seance: seanceZoe.id });
    const apres = (await appel('GET', '/api/prof/seances', { cookie })).corps.seances.find((s) => s.id === seanceZoe.id);
    assert.deepEqual([apres.reussite_le, apres.questions_reussies, apres.code], [null, 0, null]);
    const verification = await appel('POST', '/api/verification', { corps: { code: attestation.code } });
    assert.equal(verification.corps.resultat, 'annulee');
    assert.match(verification.corps.annulee_le, /^20\d\d-/);
    assert.deepEqual(verification.corps.attestation, attestation.attestation);
    const reprise = await appel('POST', '/api/reprise', { corps: ZOE });
    assert.equal(reprise.status, 200);
    assert.equal(reprise.corps.seance.progression.total_reussies, 0);
    assert.equal(reprise.corps.seance.reussite_le, null);
    assert.equal((await appel('POST', '/api/question', { jeton: reprise.corps.jeton, corps: { exercice: M10 } })).corps.seance.question === null, false);
  });

  await etape('déconnexion professeur : le cookie est effacé', async () => {
    const deconnexion = await appel('POST', '/api/prof/deconnexion', { cookie });
    assert.deepEqual(deconnexion.corps, { deconnecte: true });
    assert.match(derniersEntetes.get('set-cookie'), /Max-Age=0/);
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
