// L'exercice « M10 - tournage - Vc et RPM » (site/exercices/m10-tournage-vc-rpm.json, décision D40) :
// Vc et N sur onze outils, jamais de carbure de tungstène solide, deux réussites de suite par outil.
// Tout ce qui existe s'applique sans changement ; on vérifie en particulier la tolérance de N en
// filetage et la barre à aléser à deux diamètres dans cet exercice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeParameters } from '../site/js/calcul.js';
import { fieldsToGrade, loadExercise, loadExerciseIndex, validateExercise } from '../site/js/exercice.js';
import { formatParameters } from '../site/js/format.js';
import { createProgress, eligibleTools, isComplete, recordResult } from '../site/js/progression.js';
import { generateQuestion } from '../site/js/question.js';
import { cleanAnswers, correctionView, drawQuestion, emptyCounters, gradeQuestion } from '../worker/seance.js';
import { aleaAGraine, data, lireFichier, questionPour } from './aide.js';

const ID = 'm10-tournage-vc-rpm';
const exercice = await loadExercise(ID, data, 'exercices/', lireFichier);
const OUTILS = ['foret_a_pointer', 'foret_fractionnaire', 'foret_a_numero', 'foret_a_lettre', 'foret_metrique', 'foret_udrill', 'barre_a_aleser', 'sdtmr', 'sdtmr_2', 'barre_a_fileter', 'barre_a_fileter_2'];

test('l’exercice : Vc et N, onze outils dans l’ordre demandé, deux réussites de suite chacun, listé à l’accueil', async () => {
  assert.deepEqual(validateExercise(exercice, data), []);
  assert.equal(exercice.titre, 'M10 - tournage - Vc et RPM');
  assert.deepEqual(exercice.champs_evalues, ['vc', 'n']);
  assert.deepEqual(fieldsToGrade(exercice), ['vc', 'rpm']);
  assert.deepEqual(exercice.outils.map((entry) => entry.id), OUTILS);
  assert.ok(exercice.outils.every((entry) => entry.reussites_requises === 2));
  assert.equal(exercice.outils.reduce((n, entry) => n + entry.reussites_requises, 0), 22);
  assert.equal(exercice.liste, undefined); // listé (D18, D30)
  const index = await loadExerciseIndex('exercices/', lireFichier);
  assert.deepEqual(index.find((entry) => entry.id === ID), { id: ID, titre: exercice.titre });
  // Les opérations couvertes : pointage, perçage, alésage à la barre, filetage externe et interne.
  const operations = new Set(OUTILS.map((id) => data.outils.find((o) => o.id === id).operation));
  assert.deepEqual([...operations], ['Pointage', 'Perçage', 'Alésage à la barre', 'Filetage externe', 'Filetage interne']);
});

test('matière de l’outil : acier rapide ou insert seulement, jamais le carbure solide ; tous les groupes et toutes les dimensions de chaque outil', () => {
  assert.deepEqual(exercice.materiaux_outil, ['Acier rapide', 'Insert de carbure de tungstène']);
  for (const tool of eligibleTools(exercice, data, createProgress(exercice))) {
    const catalogue = data.outils.find((o) => o.id === tool.id);
    assert.ok(tool.materiaux_outil.length >= 1, tool.id);
    assert.equal(tool.materiaux_outil.includes('Carbure de tungstène solide'), false, tool.id);
    assert.deepEqual(tool.materiaux_outil, catalogue.materiaux_outil.filter((m) => m !== 'Carbure de tungstène solide'), tool.id);
    assert.deepEqual(tool.groupes_materiaux_usinables, catalogue.groupes_materiaux_usinables, tool.id);
    assert.deepEqual(tool.dimensions, catalogue.dimensions, tool.id);
  }
  // Le catalogue lui-même offre le carbure solide sur les forets : c'est bien l'exercice qui l'exclut.
  assert.ok(data.outils.find((o) => o.id === 'foret_a_pointer').materiaux_outil.includes('Carbure de tungstène solide'));
});

test('séance simulée : sans erreur, l’exercice se termine en 22 questions ; aucune ne porte de carbure solide ; la barre à aléser vient avec sa barre', () => {
  const random = aleaAGraine(2026);
  let progress = createProgress(exercice);
  const outilsVus = new Set();
  let n = 0;
  while (!isComplete(exercice, progress)) {
    const question = generateQuestion(data, eligibleTools(exercice, data, progress), random);
    n += 1;
    assert.ok(n <= 22, 'plus de 22 questions');
    assert.notEqual(question.toolMaterial.label, 'Carbure de tungstène solide');
    if (question.tool.id === 'barre_a_aleser') assert.ok(question.bar !== null && question.bar.diameter <= 0.75 * question.dimension.diameter, 'barre qui entre dans le trou');
    outilsVus.add(question.tool.id);
    progress = recordResult(progress, question.tool.id, true);
  }
  assert.equal(n, 22);
  assert.equal(progress.totalReussies, 22);
  assert.deepEqual([...outilsVus].sort(), [...OUTILS].sort());
});

test('filetage dans cet exercice : N de −90 % à +0,1 % — un N réduit pour fileter passe, un N trop haut non ; Vc exacte', () => {
  const question = questionPour({ outil: 'sdtmr', dimension: '1/2 - 13 UNC', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: 1 });
  const attendu = computeParameters(question, data);
  assert.equal(attendu.feedType, 'thread');
  const affiche = formatParameters(attendu);
  assert.equal(affiche.vc, '400'); // 1020, insert de carbure
  assert.equal(affiche.rpm, '3000'); // 400 × 4 / 0.5 = 3200, plafonné au RPM max de 3000
  const corriger = (rpm) => gradeQuestion(question, cleanAnswers({ vc: affiche.vc, rpm }), emptyCounters(), exercice, data);
  assert.equal(corriger('3000').success, true);
  assert.equal(corriger('1500').success, true); // moitié de la vitesse : permis en filetage
  assert.equal(corriger('300').success, true); // −90 %, borne incluse
  assert.equal(corriger('299').success, false);
  assert.equal(corriger('3004').success, false); // +0,1 % = 3003
  assert.equal(corriger('3003').success, true);
  const vue = correctionView(question, cleanAnswers({ vc: '400', rpm: '1500' }), corriger('1500').result, 0, { reussites: { sdtmr: 1 }, totalReussies: 1 }, data);
  assert.equal(vue.champs.find((c) => c.champ === 'rpm').tolerance, 'de −90 % à +0.1 %');
  assert.deepEqual(vue.champs.filter((c) => c.evalue).map((c) => c.champ), ['vc', 'rpm']);
  // Le même exercice, sur un outil hors filetage : ±5 % et ±1 rév/min, comme partout.
  const foret = questionPour({ outil: 'foret_fractionnaire', dimension: 'Ø 1/4 po', dents: 2, materiauOutil: 'Acier rapide', groupeMateriau: 1 });
  const foretVue = correctionView(foret, cleanAnswers({ vc: '100', rpm: '1600' }), gradeQuestion(foret, cleanAnswers({ vc: '100', rpm: '1600' }), emptyCounters(), exercice, data).result, 0, { reussites: {}, totalReussies: 0 }, data);
  assert.equal(foretVue.champs.find((c) => c.champ === 'rpm').tolerance, '±5 % et ±1 rév/min');
});

test('barre à aléser dans cet exercice : N avec le Ø alésé (pas celui de la barre), la ligne de calcul le nomme, l’avance est fournie', () => {
  const question = questionPour({ outil: 'barre_a_aleser', dimension: '2.000"', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: 1, barre: '1 po' });
  assert.deepEqual(question.bar, { label: '1 po', diameter: 1 });
  const attendu = computeParameters(question, data);
  assert.equal(attendu.rpm, 400 * 4 / 2); // Ø alésé de 2 po, pas la barre de 1 po
  const avecBarre = gradeQuestion(question, cleanAnswers({ vc: '400', rpm: '1600' }), emptyCounters(), exercice, data);
  assert.equal(avecBarre.success, false);
  const vue = correctionView(question, cleanAnswers({ vc: '400', rpm: '1600' }), avecBarre.result, 0, { reussites: {}, totalReussies: 0 }, data);
  assert.match(vue.champs.find((c) => c.champ === 'rpm').calcul, /^N = Vc × 4 \/ Ø usiné = 400 × 4 \/ 2$/);
  assert.equal(gradeQuestion(question, cleanAnswers({ vc: '400', rpm: '800' }), emptyCounters(), exercice, data).success, true);
  // L'avance, non évaluée, arrive pré-remplie avec le Ø de la barre : 0.006 × 1 = 0.006 po/tour.
  assert.equal(vue.champs.find((c) => c.champ === 'feedPerTooth').evalue, false);
  assert.equal(vue.champs.find((c) => c.champ === 'feedPerTooth').attendu, '0.0060');
  // Et une question tirée par le serveur pour cet outil porte toujours sa barre.
  for (let graine = 1; graine <= 30; graine += 1) {
    const compteurs = { reussites: Object.fromEntries(OUTILS.filter((id) => id !== 'barre_a_aleser').map((id) => [id, 2])), totalReussies: 20 };
    const tiree = drawQuestion(compteurs, exercice, data, aleaAGraine(graine));
    assert.equal(tiree.tool.id, 'barre_a_aleser');
    assert.ok(tiree.bar !== null);
    assert.match(tiree.displayId, /^Barre à aléser Ø .+ - Ø alésé: /);
  }
});
