// Tests de tests/publier-test-complet.mjs (D70) : test-complet publié sur une base locale comme « Publier » dans
// l'éditeur, rien de republié s'il est identique, --remote refusé. La base est la fausse D1 des tests (les vraies
// migrations) ; le script, lui, ouvre la D1 locale de wrangler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { publishTestComplet, readArguments } from './publier-test-complet.mjs';
import { draftFromExercise } from '../site/js/exercice.js';
import { fausseD1 } from './aide-d1.js';
import { serveurDeTest } from './aide-serveur.js';
import { lireFichier } from './aide.js';

const FICHIER = await lireFichier('exercices/test-complet.json');
const MAINTENANT = new Date('2026-09-26T12:00:00.000Z');

test('publishTestComplet : crée et publie test-complet (version 1), les copies de la banque, les tables les plus récentes, au journal', async () => {
  const db = fausseD1();
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM exercices WHERE id = 'test-complet'").get().n, 0); // pas semé (D47)
  const resultat = await publishTestComplet(db, FICHIER, MAINTENANT);
  assert.deepEqual(resultat, { tables: 'A2026_r0', outils: FICHIER.outils.length, cree: true, archive: false, numero: 1, identique: false });

  const banque = db.sqlite.prepare('SELECT outil FROM banque_outils ORDER BY rang, id').all().map((row) => JSON.parse(row.outil));
  const version = db.sqlite.prepare("SELECT * FROM versions_exercice WHERE exercice_id = 'test-complet'").get();
  assert.deepEqual(JSON.parse(version.contenu), draftFromExercise(FICHIER, banque));
  assert.deepEqual([version.numero, version.tables_id, version.publiee_le], [1, 'A2026_r0', MAINTENANT.toISOString()]);
  const journal = db.sqlite.prepare("SELECT action, details, enseignant FROM journal_enseignant WHERE details LIKE 'test-complet%' ORDER BY id").all().map((row) => ({ ...row }));
  assert.deepEqual(journal.map((row) => row.action), ['editeur_creation', 'editeur_publication']);
  assert.ok(journal.every((row) => row.enseignant === 'script local (npm run publier:test-complet)'));

  // Le vrai serveur le sert, sans le lister à l'accueil (« liste »: false).
  const serveur = serveurDeTest({ db });
  const reponse = await serveur.appel('GET', '/api/exercice?exercice=test-complet');
  assert.equal(reponse.status, 200);
  assert.equal(reponse.corps.exercice.titre, FICHIER.titre);
  const liste = await serveur.appel('GET', '/api/exercices');
  assert.ok(!liste.corps.exercices.some((exercice) => exercice.id === 'test-complet'));
});

test('publishTestComplet : identique → rien de publié ; la banque change → version 2', async () => {
  const db = fausseD1();
  await publishTestComplet(db, FICHIER, MAINTENANT);
  assert.deepEqual(await publishTestComplet(db, FICHIER, MAINTENANT), { tables: 'A2026_r0', outils: FICHIER.outils.length, cree: false, archive: false, numero: 1, identique: true });

  const mvlnr = JSON.parse(db.sqlite.prepare("SELECT outil FROM banque_outils WHERE id = 'mvlnr'").get().outil);
  db.sqlite.prepare("UPDATE banque_outils SET outil = ? WHERE id = 'mvlnr'").run(JSON.stringify({ ...mvlnr, commentaire: 'Changé dans la banque' }));
  const resultat = await publishTestComplet(db, FICHIER, MAINTENANT);
  assert.deepEqual([resultat.numero, resultat.identique, resultat.cree], [2, false, false]);
  const contenu = JSON.parse(db.sqlite.prepare("SELECT contenu FROM versions_exercice WHERE exercice_id = 'test-complet' AND numero = 2").get().contenu);
  assert.equal(contenu.outils.find((copie) => copie.id === 'mvlnr').commentaire, 'Changé dans la banque');
});

test('publishTestComplet : un outil de test-complet absent de la banque → erreur, rien d’écrit', async () => {
  const db = fausseD1();
  db.sqlite.prepare("DELETE FROM banque_outils WHERE id = 'mvlnr'").run();
  await assert.rejects(publishTestComplet(db, FICHIER, MAINTENANT), /l'outil « mvlnr » n'existe pas/);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM exercices WHERE id = 'test-complet'").get().n, 0);
});

test('readArguments : --remote refusé sous toutes ses formes ; --persist-to permis ; le reste refusé', () => {
  for (const args of [['--remote'], ['--remote=true'], ['--persist-to', 'x', '--remote']]) assert.throws(() => readArguments(args), /--remote est refusé/);
  assert.deepEqual(readArguments([]), { persistTo: null });
  assert.deepEqual(readArguments(['--persist-to', 'C:/tmp/d1']), { persistTo: 'C:/tmp/d1' });
  assert.throws(() => readArguments(['--local']), /argument inconnu/);
  assert.throws(() => readArguments(['--persist-to']), /argument inconnu/);
});

test('le script lancé avec --remote s’arrête avant d’ouvrir la moindre base', () => {
  const script = fileURLToPath(new URL('./publier-test-complet.mjs', import.meta.url));
  const sortie = spawnSync(process.execPath, [script, '--remote'], { encoding: 'utf8', timeout: 20000 });
  assert.equal(sortie.status, 1);
  assert.match(sortie.stderr, /--remote est refusé/);
});
