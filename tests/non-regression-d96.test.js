// Non-régression du chantier « code G d'avance » (décision D96, travail demandé, point 3) : un exercice sur une version
// de tables D'AVANT D96 — des tables qui portent les facteurs de vitesse (D83) mais aucun code G — se corrige et
// s'affiche exactement comme avant : la question rendue au navigateur, la correction, la ligne de calcul, l'aperçu, les
// feuilles, l'attestation et le spécimen, octet pour octet.
//
// Le témoin est tests/instantanes/avant-d96.json : il a été produit par CE scénario avec le code de `main` d'avant le
// chantier (commit 86e6f64), puis figé. Le test rejoue le scénario avec le code d'aujourd'hui et compare.
// NE PAS LE RÉGÉNÉRER pour faire passer le test : une différence veut dire que le code change ce qui existe. (Pour le
// produire de nouveau après une décision qui change volontairement la correction : ECRIRE_INSTANTANE=1 npm test.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { computeParameters } from '../site/js/calcul.js';
import { assembleData } from '../site/js/data.js';
import { draftFromExercise, engineExercise, fieldsToGrade, maskedFields } from '../site/js/exercice.js';
import { adoptSpeedFactors, prefillSpeedFactors } from '../site/js/facteur-vitesse.js';
import { formatParameters } from '../site/js/format.js';
import { generateQuestion } from '../site/js/question.js';
import { feedSheet, sheetTabs, speedFactorSheet } from '../site/js/ui/sheets-data.js';
import { canonical } from '../worker/attestation.js';
import { previewQuestions } from '../worker/editeur.js';
import { correctionView, emptyCounters, gradeQuestion, questionView } from '../worker/seance.js';
import { buildSpecimen } from '../worker/specimen.js';
import { aleaAGraine, lireFichier } from './aide.js';
import { SECONDE, serveurDeTest } from './aide-serveur.js';

const TEMOIN = new URL('./instantanes/avant-d96.json', import.meta.url);
const TABLES_ID = 'A2026_r1';

// Les tables d'avant D96 : la semence, préremplie des facteurs de vitesse (D83) — comme les tables A2026_r6 de la
// production —, sans aucun code G ; publiées sous A2026_r1.
const SANS = { materiaux: await lireFichier('data/materiaux.json'), operations: await lireFichier('data/operations.json') };
const AVEC = prefillSpeedFactors(SANS);
const TABLES = { materiaux: { ...AVEC.materiaux, revision: TABLES_ID }, operations: { ...AVEC.operations, revision: TABLES_ID } };
const banque = (await lireFichier('data/outils.json')).outils;

// Un exercice à cinq grandeurs qui mêle le tour et la fraiseuse (D96 : la vitesse d'avance y aura un sens à la fraiseuse
// seulement) : chariotage, tronçonnage, perçage, contournage ; une réussite par outil.
const TOUR_FRAISAGE = {
  id: 'tour-fraisage',
  titre: 'Tour et fraiseuse — cinq grandeurs',
  version: 'r0',
  champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'],
  outils: [
    { id: 'mvlnr', reussites_requises: 1 },
    { id: 'lame_a_tronconner', reussites_requises: 1 },
    { id: 'foret_fractionnaire', reussites_requises: 1, dimensions: ['Ø 1/4 po', 'Ø 1/2 po'] },
    { id: 'fraise_en_bout_helicoidale', reussites_requises: 1 },
  ],
};

// Le contenu d'un exercice avec ces tables : les copies de la banque, qui y font leur passage (D83 : hérité, ou forcé).
const contenuDe = (fichier) => adoptSpeedFactors(draftFromExercise(fichier, banque), TABLES);

// --- Le moteur et les vues du serveur, sur test-complet (tous les outils, les cinq grandeurs) -----------------------------
// Pour chaque outil, une question tirée avec un aléa à graine : la question telle que le navigateur la reçoit (et les
// réponses du mode test), les valeurs attendues, la correction d'une bonne réponse et d'une mauvaise — donc la ligne de
// calcul de chaque grandeur, la vitesse d'avance comprise. Puis l'aperçu, les feuilles et un spécimen.
async function vuesDuMoteur() {
  const complet = await lireFichier('exercices/test-complet.json');
  const { exercise, tools } = engineExercise(complet.id, 1, contenuDe(complet));
  const data = assembleData(TABLES, tools);
  const random = aleaAGraine(96);
  const graded = fieldsToGrade(exercise);
  const questions = [];
  for (const tool of data.outils) {
    const question = generateQuestion(data, [tool], random);
    const attendu = computeParameters(question, data);
    const affiche = formatParameters(attendu);
    const justes = Object.fromEntries(graded.map((field) => [field, affiche[field]]));
    const fausses = Object.fromEntries(graded.map((field) => [field, String(Number(affiche[field]) * 3 + 7)]));
    const corrige = (saisies) => {
      const answers = { vc: '', feedPerTooth: '', rpm: '', feedPerRev: '', feedRate: '', ...saisies };
      const graded_ = gradeQuestion(question, answers, emptyCounters(), exercise, data);
      return { resultat: graded_.result, vue: correctionView(question, answers, graded_.result, 0, graded_.counters, data, maskedFields(exercise)) };
    };
    questions.push({
      question,
      attendu,
      vue: questionView(question, exercise, data),
      reponses_test: questionView(question, exercise, data, { testMode: true }).reponses_test,
      correction_juste: corrige(justes),
      correction_fausse: corrige(fausses),
    });
  }
  const mixte = engineExercise(TOUR_FRAISAGE.id, 1, contenuDe(TOUR_FRAISAGE));
  const mixteData = assembleData(TABLES, mixte.tools);
  return {
    questions,
    apercu: previewQuestions(exercise, data, aleaAGraine(7), 10),
    feuilles: { onglets: sheetTabs(data), avances: feedSheet(data), facteurs: speedFactorSheet(data), facteurs_portes: data.hasSpeedFactors },
    specimen: buildSpecimen(mixte.exercise, mixteData, { seed: 96, debut: '2026-09-21T13:00:00.000Z', reussite: '2026-09-21T13:03:00.000Z' }),
  };
}

// --- Le vrai Worker : l'exercice mixte publié sur A2026_r1, une séance entière, une démo ------------------------------------
// Chaque séance rendue, chaque correction (une mauvaise réponse à la deuxième question), puis l'attestation — son
// enregistrement, son texte canonique (ce que la signature couvre), la signature et l'adresse du QR —, ce que le navigateur
// lit pour afficher (l'exercice avec ses tables, les tables de la version), et une démo avec son spécimen.
async function parLeServeur() {
  const serveur = serveurDeTest({ codes: ['ABCDEFGHJK'] });
  serveur.db.sqlite.prepare('INSERT INTO tables_reference (id, materiaux, operations, creee_le) VALUES (?, ?, ?, ?)').run(TABLES_ID, JSON.stringify(TABLES.materiaux), JSON.stringify(TABLES.operations), '2026-09-21T12:00:00.000Z');
  serveur.publierExercice(TOUR_FRAISAGE, { tablesId: TABLES_ID });
  serveur.db.sqlite.prepare('UPDATE versions_exercice SET contenu = ? WHERE exercice_id = ?').run(JSON.stringify(contenuDe(TOUR_FRAISAGE)), TOUR_FRAISAGE.id);
  const exercice = TOUR_FRAISAGE.id;
  const etudiant = { exercice, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };
  const creation = await serveur.appel('POST', '/api/creation', { corps: etudiant });
  assert.equal(creation.status, 200, JSON.stringify(creation.corps));
  const { jeton } = creation.corps;
  const etapes = [];
  let seance = (await serveur.appel('POST', '/api/question', { jeton, corps: { exercice } })).corps.seance;
  etapes.push({ seance });
  for (let n = 0; seance.reussite_le === null; n += 1) {
    serveur.avancer(11 * SECONDE);
    const bonnes = serveur.bonnesReponses(etudiant.matricule, exercice);
    const saisies = n === 1 ? { ...bonnes, feedRate: '1' } : bonnes;
    const reponse = await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice, saisies } });
    assert.equal(reponse.status, 200, JSON.stringify(reponse.corps));
    etapes.push(reponse.corps);
    seance = reponse.corps.seance;
  }
  const attestation = (await serveur.appel('GET', `/api/attestation?exercice=${exercice}`, { jeton })).corps;
  // Une démo (D92) : une question, une correction, le spécimen composé par le serveur (sa graine vient de l'aléa du serveur).
  const demo = await serveur.appel('POST', '/api/demo/creation', { corps: { exercice, outil: 'lame_a_tronconner' } });
  assert.equal(demo.status, 200, JSON.stringify(demo.corps));
  serveur.avancer(11 * SECONDE);
  const demoCorrection = await serveur.appel('POST', '/api/demo/correction', { jeton: demo.corps.jeton, corps: { exercice, saisies: { ...(await serveur.bonnesReponsesDemo(demo.corps.jeton)), feedRate: '2' } } });
  assert.equal(demoCorrection.status, 200, JSON.stringify(demoCorrection.corps));
  const specimen = await serveur.appel('GET', `/api/demo/specimen?exercice=${exercice}`);
  assert.equal(specimen.status, 200, JSON.stringify(specimen.corps));
  const { jeton: _jeton, ...demoCreation } = demo.corps; // le jeton est tiré au hasard : hors du témoin
  return {
    etapes,
    attestation,
    texte_signe: canonical(attestation.attestation),
    seance_relue: (await serveur.appel('GET', `/api/seance?exercice=${exercice}`, { jeton })).corps,
    exercice: (await serveur.appel('GET', `/api/exercice?exercice=${exercice}`)).corps,
    tables: (await serveur.appel('GET', `/api/tables?version=${TABLES_ID}`)).corps,
    demo: { creation: demoCreation, correction: demoCorrection.corps, specimen: specimen.corps },
  };
}

const scenario = async () => JSON.parse(JSON.stringify({ moteur: await vuesDuMoteur(), serveur: await parLeServeur() }));

test('D96, non-régression : sur des tables d’avant D96, questions, corrections, lignes de calcul, feuilles, attestation et spécimen à l’identique', async () => {
  const obtenu = await scenario();
  if (process.env.ECRIRE_INSTANTANE === '1') {
    writeFileSync(TEMOIN, `${JSON.stringify(obtenu)}\n`);
    return;
  }
  const temoin = JSON.parse(readFileSync(TEMOIN, 'utf8'));
  // Morceau par morceau, pour qu'un écart se lise : la question ou l'étape.
  temoin.moteur.questions.forEach((attendue, n) => assert.deepEqual(obtenu.moteur.questions[n], attendue, `question ${n + 1} (${attendue.question.displayId})`));
  assert.equal(obtenu.moteur.questions.length, temoin.moteur.questions.length);
  for (const key of ['apercu', 'feuilles', 'specimen']) assert.deepEqual(obtenu.moteur[key], temoin.moteur[key], key);
  temoin.serveur.etapes.forEach((attendue, n) => assert.deepEqual(obtenu.serveur.etapes[n], attendue, `étape ${n + 1}`));
  // L'attestation : octet pour octet — le texte signé, la signature, l'adresse du QR.
  assert.equal(obtenu.serveur.texte_signe, temoin.serveur.texte_signe, "texte signé de l'attestation");
  assert.equal(JSON.stringify(obtenu.serveur.attestation), JSON.stringify(temoin.serveur.attestation), 'attestation');
  for (const key of ['seance_relue', 'exercice', 'tables', 'demo']) assert.deepEqual(obtenu.serveur[key], temoin.serveur[key], key);
  assert.deepEqual(obtenu, temoin);
});

test('D96, non-régression : le témoin couvre bien des tables à facteurs de vitesse sans code G, les cinq grandeurs, le tour et la fraiseuse', () => {
  const temoin = JSON.parse(readFileSync(TEMOIN, 'utf8'));
  const operations = temoin.serveur.tables.tables.operations.operations;
  assert.ok(operations.every((op) => typeof op.facteur_vitesse === 'number'));
  assert.ok(operations.every((op) => !('code_avance' in op)));
  assert.equal(temoin.moteur.questions.length, 29);
  // La vitesse d'avance est demandée partout, au tour comme à la fraiseuse, et aucune question ne porte de code G.
  for (const q of temoin.moteur.questions) {
    assert.deepEqual(q.vue.champs.find((c) => c.champ === 'feedRate'), { champ: 'feedRate', evalue: true, texte: '' });
    assert.equal('code_avance' in q.vue.outil, false);
    assert.equal('programme' in q.correction_fausse.vue, false);
  }
  const tours = temoin.serveur.etapes.slice(1).map((e) => e.correction.outil.id);
  assert.ok(tours.includes('mvlnr') && tours.includes('foret_fractionnaire'));
  assert.equal(temoin.serveur.attestation.attestation.questions.every((q) => 'feedRate' in q.reponses), true);
});
