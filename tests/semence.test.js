// Tests de la migration 0005 et de sa semence (jalon 7, décision D47) : les exercices et la banque
// d'outils en base, les séances existantes épinglées à la version 1, et les deux M10 qui posent les
// mêmes questions qu'avant pour une même graine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fausseD1, migrationSql } from './aide-d1.js';
import { MINUTE, SECONDE, serveurDeTest } from './aide-serveur.js';
import { composerSemence } from '../reference/semence-d1/generer.mjs';
import { aleaAGraine, data as catalogueJson, lireFichier } from './aide.js';
import { loadExercise } from '../site/js/exercice.js';
import { eligibleTools, recordResult } from '../site/js/progression.js';
import { generateQuestion } from '../site/js/question.js';
import { computeParameters } from '../site/js/calcul.js';

const colonnes = (db, table) => db.sqlite.prepare(`SELECT name FROM pragma_table_info('${table}')`).all().map((row) => row.name);


const M10 = 'm10-tournage-vc';
const VC_RPM = 'm10-tournage-vc-rpm';
const CAMILLE = { exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };
const ALEX = { exercice: VC_RPM, prenom: 'Alex', nom: 'Roy', matricule: '2498765', nip: '1357' };
const ZOE = { exercice: M10, prenom: 'Zoé', nom: 'Lévesque', matricule: '2455555', nip: '2468' };

// Crée (ou reprend) la séance d'un étudiant et répond juste jusqu'à la réussite ; retourne le jeton.
async function reussir(serveur, etudiant, reprise = false) {
  const { status, corps } = await serveur.appel('POST', reprise ? '/api/reprise' : '/api/creation', { corps: etudiant });
  assert.equal(status, 200, JSON.stringify(corps));
  let etat = (await serveur.appel('POST', '/api/question', { jeton: corps.jeton, corps: { exercice: etudiant.exercice } })).corps.seance;
  while (etat.reussite_le === null) {
    serveur.avancer(11 * SECONDE);
    const reponse = await serveur.appel('POST', '/api/correction', { jeton: corps.jeton, corps: { exercice: etudiant.exercice, saisies: serveur.bonnesReponses(etudiant.matricule, etudiant.exercice) } });
    assert.equal(reponse.status, 200, JSON.stringify(reponse.corps));
    etat = reponse.corps.seance;
  }
  return corps.jeton;
}

// Copie les lignes d'une table d'une base à l'autre, colonne par colonne (celles que la cible connaît).
function transplanter(source, cible, table) {
  const colonnes = cible.prepare(`SELECT name FROM pragma_table_info('${table}')`).all().map((row) => row.name);
  const insert = cible.prepare(`INSERT INTO ${table} (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`);
  for (const row of source.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()) insert.run(...colonnes.map((c) => row[c]));
}

test('migration 0005 sur des données réelles : les séances existantes pointent vers la version 1 de leur exercice ; attestations, codes, signatures et /verifier inchangés ; le serveur continue', async () => {
  // 1. Le vrai serveur produit les données : Camille réussit le M10 puis corrige son identité (attestation annulée et réémise),
  //    Alex réussit « Vc et RPM » et est remis à zéro (attestation annulée), Zoé commence le M10 sans réussir.
  const production = serveurDeTest();
  const camille = await reussir(production, CAMILLE);
  production.avancer(MINUTE);
  assert.equal((await production.appel('POST', '/api/identite', { jeton: camille, corps: { ...CAMILLE, prenom: 'Camila' } })).status, 200);
  const { corps: camilleAttestation } = await production.appel('GET', `/api/attestation?exercice=${M10}`, { jeton: camille });
  await reussir(production, ALEX);
  const { corps: connexion } = await production.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } });
  assert.equal(connexion.enseignant, 'admin');
  const entetes = { cookie: `prof=${production.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
  production.avancer(MINUTE);
  assert.equal((await production.appel('POST', '/api/prof/remise-a-zero', { corps: { seance: production.seance(ALEX.matricule, VC_RPM).id }, entetes })).status, 200);
  const zoe = (await production.appel('POST', '/api/creation', { corps: ZOE })).corps.jeton;
  await production.appel('POST', '/api/question', { jeton: zoe, corps: { exercice: M10 } });
  const codes = production.db.sqlite.prepare('SELECT code FROM attestations ORDER BY id').all().map((row) => row.code);
  assert.equal(codes.length, 3);

  // 2. Les mêmes lignes dans une base au schéma d'avant le jalon 7 (0001 à 0004) : sans version_id.
  const db = fausseD1({ jusqua: 4 });
  assert.equal(colonnes(db, 'seances').includes('version_id'), false);
  assert.equal(db.sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'exercices'").get(), undefined);
  const tables = ['seances', 'corrections', 'corrections_identite', 'attestations', 'journal_enseignant', 'debit', 'verrous'];
  for (const table of tables) transplanter(production.db.sqlite, db.sqlite, table);
  const contenu = (base) => Object.fromEntries(tables.map((table) => [table, base.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map(({ version_id, ...row }) => ({ ...row }))]));
  const avant = contenu(db);
  assert.deepEqual(avant, contenu(production.db));

  // 3. La 0005 seule : les tables de l'éditeur arrivent semées, et chaque séance pointe vers la version 1 de son exercice.
  db.sqlite.exec(migrationSql(5));
  assert.deepEqual(contenu(db), avant); // rien d'autre n'a bougé
  const versions = Object.fromEntries(db.sqlite.prepare('SELECT exercice_id, id FROM versions_exercice WHERE numero = 1').all().map((row) => [row.exercice_id, row.id]));
  assert.deepEqual(Object.keys(versions).sort(), [M10, VC_RPM]);
  assert.deepEqual(db.sqlite.prepare('SELECT matricule, exercice_id, version_id, version_exercice FROM seances ORDER BY id').all().map((row) => ({ ...row })), [
    { matricule: CAMILLE.matricule, exercice_id: M10, version_id: versions[M10], version_exercice: '1' },
    { matricule: ALEX.matricule, exercice_id: VC_RPM, version_id: versions[VC_RPM], version_exercice: '1' },
    { matricule: ZOE.matricule, exercice_id: M10, version_id: versions[M10], version_exercice: '1' },
  ]);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM banque_outils').get().n, 29);

  // 4. Le serveur continue sur cette base : /verifier répond pareil, l'attestation de Camille est la même, Zoé reprend et réussit sur la version 1.
  const serveur = serveurDeTest({ db });
  for (const [i, code] of codes.entries()) {
    assert.deepEqual((await serveur.appel('POST', '/api/verification', { corps: { code } })).corps, (await production.appel('POST', '/api/verification', { corps: { code } })).corps, `code ${i}`);
  }
  const reprise = await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE } });
  assert.equal(reprise.status, 200);
  assert.deepEqual((await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton: reprise.corps.jeton })).corps, camilleAttestation);
  const jetonZoe = await reussir(serveur, ZOE, true);
  const seanceZoe = (await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton: jetonZoe })).corps.seance;
  assert.deepEqual([seanceZoe.exercice.version, serveur.seance(ZOE.matricule).version_exercice_reussite], ['1', '1']);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM attestations').get().n, 4);
});

test('la semence de la migration 0005 est identique aux JSON du dépôt : tables « A2026_r0 », les 29 outils, les deux M10 en version 1 (brouillon = version)', () => {
  const db = fausseD1();
  const { tables, outils, exercices } = composerSemence();
  const enBase = db.sqlite.prepare('SELECT * FROM tables_reference').all().map((row) => ({ ...row }));
  assert.deepEqual(enBase.map((row) => row.id), [tables.id]);
  assert.deepEqual(JSON.parse(enBase[0].materiaux), tables.materiaux);
  assert.deepEqual(JSON.parse(enBase[0].operations), tables.operations);
  const banque = db.sqlite.prepare('SELECT * FROM banque_outils ORDER BY rang').all().map((row) => ({ ...row }));
  assert.deepEqual(banque.map((row) => row.id), outils.map((o) => o.id));
  assert.deepEqual(banque.map((row) => JSON.parse(row.outil)), outils.map((o) => ({ ...o, image: o.id }))); // l'image porte le nom de l'outil (D47)
  assert.deepEqual(banque.map((row) => [row.revision, row.archive_le]), outils.map(() => [1, null]));
  for (const { id, brouillon } of exercices) {
    const fiche = db.sqlite.prepare('SELECT * FROM exercices WHERE id = ?').get(id);
    assert.deepEqual(JSON.parse(fiche.brouillon), brouillon, id);
    assert.deepEqual([fiche.revision, fiche.archive_le, fiche.publie_le !== null], [1, null, true]);
    const versions = db.sqlite.prepare('SELECT * FROM versions_exercice WHERE exercice_id = ? ORDER BY numero').all(id).map((row) => ({ ...row }));
    assert.equal(versions.length, 1);
    assert.deepEqual([versions[0].numero, versions[0].tables_id], [1, tables.id]);
    assert.deepEqual(JSON.parse(versions[0].contenu), brouillon);
  }
  assert.deepEqual(db.sqlite.prepare('SELECT id FROM exercices ORDER BY id').all().map((row) => row.id), exercices.map((e) => e.id).sort());
  // Les copies d'outils du M10 sont les outils du catalogue, avec les réussites requises du fichier.
  const m10 = exercices.find((e) => e.id === 'm10-tournage-vc').brouillon;
  assert.deepEqual(m10.outils.map((c) => [c.id, c.origine, c.reussites_requises]), [['mclnr', 'mclnr', 1], ['mvlnr', 'mvlnr', 3], ['lame_a_tronconner', 'lame_a_tronconner', 3], ['barre_a_fileter', 'barre_a_fileter', 1], ['barre_a_fileter_2', 'barre_a_fileter_2', 1], ['barre_a_rainurer', 'barre_a_rainurer', 3], ['barre_a_aleser', 'barre_a_aleser', 1], ['sdtmr', 'sdtmr', 1], ['sdtmr_2', 'sdtmr_2', 1]]);
  assert.equal(m10.outils[0].dimensions.length, outils.find((o) => o.id === 'mclnr').dimensions.length);
});

// --- Les mêmes questions qu'avant (C.2) : le M10 semé tire et corrige comme le M10 des fichiers JSON ------------------

for (const id of ['m10-tournage-vc', 'm10-tournage-vc-rpm']) {
  test(`${id} : pour une même graine, le serveur (exercice semé en base) pose les mêmes questions, avec les mêmes réponses attendues, que le moteur sur les fichiers JSON`, async () => {
    const graine = 4242;
    const exercice = await loadExercise(id, catalogueJson, 'exercices/', lireFichier);
    // Le moteur sur les JSON : une question par tirage, réussie à chaque fois, jusqu'à la réussite de l'exercice.
    const alea = aleaAGraine(graine);
    let progression = { exerciceId: id, reussites: {}, totalReussies: 0 };
    const attendues = [];
    for (let outils = eligibleTools(exercice, catalogueJson, progression); outils.length > 0; outils = eligibleTools(exercice, catalogueJson, progression)) {
      const question = generateQuestion(catalogueJson, outils, alea);
      attendues.push({ question, reponses: computeParameters(question, catalogueJson) });
      progression = recordResult(progression, question.tool.id, true);
    }
    // Le serveur, même graine : Camille répond juste à tout.
    const serveur = serveurDeTest({ graine });
    const etudiant = { exercice: id, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };
    const { corps } = await serveur.appel('POST', '/api/creation', { corps: etudiant });
    let etat = (await serveur.appel('POST', '/api/question', { jeton: corps.jeton, corps: { exercice: id } })).corps.seance;
    while (etat.reussite_le === null) {
      serveur.avancer(11 * SECONDE);
      etat = (await serveur.appel('POST', '/api/correction', { jeton: corps.jeton, corps: { exercice: id, saisies: serveur.bonnesReponses('2412345', id) } })).corps.seance;
    }
    const posees = serveur.journal().map((ligne) => ({ question: JSON.parse(ligne.question), reponses: JSON.parse(ligne.resultat).attendu }));
    assert.equal(posees.length, attendues.length);
    for (const [i, { question, reponses }] of attendues.entries()) {
      assert.deepEqual(posees[i].question, question, `question ${i + 1}`);
      for (const champ of ['vc', 'rpm', 'feedPerTooth', 'feedPerRev', 'feedRate']) assert.equal(posees[i].reponses[champ], reponses[champ], `question ${i + 1} : ${champ}`);
    }
  });
}
