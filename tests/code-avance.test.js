// Tests du code G d'avance (décision D96) : les règles pures de site/js/code-avance.js, la validation des tables et des
// exercices (data.js, exercice.js), les différences entre versions (tables.js), la correction et les vues du serveur
// (seance.js), l'attestation (attestation.js), l'aperçu (worker/editeur.js), les feuilles (sheets-data.js) et l'impact
// d'un changement de tables (editeur-data.js). Sans DOM ; les écrans sont dans tests/ui-code-avance.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeParameters } from '../site/js/calcul.js';
import {
  F_WORD_FROM_QUESTION, F_WORD_LABEL, FEED_CODES, NOT_APPLICABLE, NOT_APPLICABLE_SHORT, carriesFeedCodes, fWordField, fWordShown, feedCodeLabel, feedCodeOf,
  feedCodeShortLabel, feedCodeText, feedCodeWarnings, feedRateApplies, hasFeedCode, inapplicableFields, inapplicableGradedError, isFeedCode, isPerRevolution,
  notApplicableNote, paperFeedCode, prefillFeedCodes, programCoordinate, programLines,
} from '../site/js/code-avance.js';
import { ANSWER_FIELDS } from '../site/js/correction.js';
import { assembleData, assembleTables, validateTables } from '../site/js/data.js';
import { draftErrors, draftFromExercise, engineExercise, fieldsToGrade, maskedFields, validateExercise } from '../site/js/exercice.js';
import { adoptSpeedFactors, prefillSpeedFactors } from '../site/js/facteur-vitesse.js';
import { formatParameters } from '../site/js/format.js';
import { generateQuestion } from '../site/js/question.js';
import { tablesDiff } from '../site/js/tables.js';
import { feedRateImpact, exerciseTablesImpact, previewRows } from '../site/js/ui/editeur-data.js';
import { feedSheet, sheetTabs } from '../site/js/ui/sheets-data.js';
import { normalizedAnswers } from '../worker/attestation.js';
import { previewQuestions } from '../worker/editeur.js';
import { correctionView, emptyCounters, gradeQuestion, questionView } from '../worker/seance.js';
import { aleaAGraine, lireFichier, questionPour } from './aide.js';

const materiaux = await lireFichier('data/materiaux.json');
const operations = await lireFichier('data/operations.json');
const banque = (await lireFichier('data/outils.json')).outils;
const SANS = prefillSpeedFactors({ materiaux, operations }); // des tables d'avant D96 : les facteurs de vitesse, aucun code
const AVEC = prefillFeedCodes(SANS); // le brouillon prérempli : G99 au tour, G94 ailleurs
const operation = (tables, nom) => tables.operations.operations.find((op) => op.operation === nom);
const parNom = (tables) => new Map(tables.operations.operations.map((op) => [op.operation, op]));
const outil = (id) => structuredClone(banque.find((t) => t.id === id));

// Le catalogue d'un exercice avec des tables : ses copies font leur passage (D83), et le moteur les assemble.
const catalogue = (tables, exercice) => {
  const { exercise, tools } = engineExercise(exercice.id, 1, adoptSpeedFactors(draftFromExercise(exercice, banque), tables));
  return { exercise, data: assembleData(tables, tools) };
};
const CINQ = { id: 'cinq', titre: 'Cinq grandeurs', version: 'r0', champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'], outils: [{ id: 'mvlnr', reussites_requises: 1 }, { id: 'lame_a_tronconner', reussites_requises: 1 }, { id: 'foret_fractionnaire', reussites_requises: 1 }, { id: 'fraise_en_bout_helicoidale', reussites_requises: 1 }] };

// Une question d'un outil précis, par le vrai générateur sur ce catalogue (la première dimension, la première matière).
const questionDe = (data, id) => {
  const tool = data.outils.find((t) => t.id === id);
  return generateQuestion(data, [tool], aleaAGraine(96));
};

// --- Les codes ------------------------------------------------------------------------------------------------------------

test('les quatre codes : G95 et G99 sont l’avance par tour, G94 et G98 l’avance par minute ; G98 et G99 sont ceux du tour ; tout autre texte est refusé', () => {
  assert.deepEqual(FEED_CODES, ['G94', 'G95', 'G98', 'G99']);
  assert.deepEqual(FEED_CODES.map(isPerRevolution), [false, true, false, true]);
  assert.deepEqual(['G94', 'g99', 'G96', '', null, 94].map(isFeedCode), [true, false, false, false, false, false]);
  assert.deepEqual(FEED_CODES.map(feedCodeLabel), ['avance par minute', 'avance par tour', 'avance par minute', 'avance par tour']);
  assert.deepEqual(FEED_CODES.map(feedCodeShortLabel), ['par minute', 'par tour', 'par minute', 'par tour']);
  assert.equal(feedCodeText('G99'), 'G99 · avance par tour');
  assert.equal(feedCodeText('G94'), 'G94 · avance par minute');
  assert.deepEqual(FEED_CODES.map(fWordField), ['feedRate', 'feedPerRev', 'feedRate', 'feedPerRev']);
});

test('hasFeedCode, carriesFeedCodes, feedCodeOf : une version d’avant D96 ne porte aucun code ; le brouillon prérempli les porte tous ; une valeur illisible vaut « aucun »', () => {
  assert.equal(carriesFeedCodes(SANS.operations.operations), false);
  assert.equal(carriesFeedCodes(AVEC.operations.operations), true);
  assert.equal(carriesFeedCodes([]), false);
  assert.equal(hasFeedCode(operation(SANS, 'Dressage')), false);
  assert.equal(feedCodeOf(operation(SANS, 'Dressage')), null);
  assert.equal(feedCodeOf(operation(AVEC, 'Dressage')), 'G99');
  assert.equal(feedCodeOf(operation(AVEC, 'Perçage')), 'G94');
  assert.equal(feedCodeOf({ operation: 'X', code_avance: 'G96' }), null);
  assert.equal(feedCodeOf(undefined), null);
});

test('feedRateApplies et inapplicableFields : la vitesse d’avance est sans objet en G95 et G99 ; elle garde son sens en G94, G98, et toujours pour une version d’avant', () => {
  assert.equal(feedRateApplies(operation(AVEC, 'Chariotage finition')), false);
  assert.equal(feedRateApplies(operation(AVEC, 'Perçage')), true);
  assert.equal(feedRateApplies(operation(SANS, 'Chariotage finition')), true);
  assert.equal(feedRateApplies(undefined), true);
  assert.deepEqual(inapplicableFields(operation(AVEC, 'Tronçonnage')), ['feedRate']);
  assert.deepEqual(inapplicableFields({ operation: 'X', code_avance: 'G95' }), ['feedRate']);
  assert.deepEqual(inapplicableFields({ operation: 'X', code_avance: 'G98' }), []);
  assert.deepEqual(inapplicableFields(operation(SANS, 'Tronçonnage')), []);
});

test('le mot F se montre dès la question (un essai) ; une seule constante le réserve au corrigé ; les textes de « sans objet »', () => {
  assert.equal(F_WORD_FROM_QUESTION, true);
  assert.equal(F_WORD_LABEL, 'mot F');
  assert.deepEqual([fWordShown('question'), fWordShown('corrige'), fWordShown('autre')], [true, true, false]);
  assert.equal(NOT_APPLICABLE, 'sans objet');
  assert.equal(NOT_APPLICABLE_SHORT, 's.o.');
  assert.equal(notApplicableNote('G99'), "En G99, F est l'avance par tour.");
  assert.equal(notApplicableNote('G95'), "En G95, F est l'avance par tour.");
});

// --- La ligne de programme ------------------------------------------------------------------------------------------------

test('programCoordinate : longitudinale et axiale → Z…, transversale → X…, latérale → X… Y…, sans égard à la casse ni aux accents ; inconnue → aucune', () => {
  assert.deepEqual(['Avance longitudinale', 'Avance transversale', 'Avance axiale', 'Avance latérale'].map(programCoordinate), ['Z…', 'X…', 'Z…', 'X… Y…']);
  assert.deepEqual(['LONGITUDINALE', 'laterale', 'Avance axiale (Z)'].map(programCoordinate), ['Z…', 'X… Y…', 'Z…']);
  assert.deepEqual(['', null, undefined, 'Plongée'].map(programCoordinate), [null, null, null, null]);
  // Les quatre directions de la semence sont connues.
  for (const op of operations.operations) assert.notEqual(programCoordinate(op.direction_avance), null, op.operation);
});

test('programLines : « G97 S1000 M03 » puis « G99 G01 Z… F0.0100 » au tour, « G94 G01 X… Y… F28.800 » à la fraiseuse ; la coordonnée et le mot F ont leur rôle ; une grandeur masquée s’écrit « — »', () => {
  const displayed = { vc: '100', feedPerTooth: '0.0100', rpm: '1000', feedPerRev: '0.0100', feedRate: '10.000' };
  const tour = programLines('G99', 'Avance longitudinale', displayed);
  assert.deepEqual(tour, {
    code: 'G99',
    lignes: [[{ texte: 'G97 S1000 M03' }], [{ texte: 'G99 G01 ' }, { texte: 'Z…', role: 'coordonnee' }, { texte: ' ' }, { texte: 'F0.0100', role: 'mot_f' }]],
    note: 'S = N. F = f, en po/tour.',
  });
  const texte = (ligne) => ligne.map((part) => part.texte).join('');
  assert.deepEqual(tour.lignes.map(texte), ['G97 S1000 M03', 'G99 G01 Z… F0.0100']);
  const fraiseuse = programLines('G94', 'Avance latérale', { ...displayed, rpm: '2400', feedRate: '28.800' });
  assert.deepEqual(fraiseuse.lignes.map(texte), ['G97 S2400 M03', 'G94 G01 X… Y… F28.800']);
  assert.equal(fraiseuse.note, 'S = N. F = Vf, en po/min.');
  // Sans coordonnée (direction inconnue) : G01 puis F, rien entre.
  assert.deepEqual(programLines('G95', 'Plongée', displayed).lignes[1], [{ texte: 'G95 G01 ' }, { texte: 'F0.0100', role: 'mot_f' }]);
  // Masquées : N, et la grandeur du mot F.
  assert.deepEqual(programLines('G99', 'Avance transversale', displayed, ['rpm', 'feedPerRev']).lignes.map(texte), ['G97 S— M03', 'G99 G01 X… F—']);
  assert.deepEqual(programLines('G94', 'Avance axiale', displayed, ['feedRate', 'feedPerRev']).lignes.map(texte), ['G97 S1000 M03', 'G94 G01 Z… F—']);
  // La vitesse d'avance n'apparaît jamais dans une ligne au tour.
  assert.doesNotMatch(JSON.stringify(tour), /10\.000/);
});

// --- Le brouillon des tables ---------------------------------------------------------------------------------------------

test('prefillFeedCodes : G99 pour les opérations de machine « Tour », G94 pour toutes les autres ; une valeur présente est gardée ; rien n’est modifié sur place', () => {
  assert.deepEqual(Object.fromEntries(AVEC.operations.operations.map((op) => [op.operation, op.code_avance])), {
    'Contournage ébauche': 'G94', 'Contournage finition': 'G94', 'Surfaçage': 'G94', 'Chanfreinage / ébavurage': 'G94',
    'Perçage': 'G94', 'Chanfreinage': 'G94', "Alésage à l'alésoir": 'G94', 'Pointage': 'G94', 'Taraudage': 'G94',
    'Filetage externe': 'G99', 'Filetage interne': 'G99', 'Chariotage ébauche': 'G99', 'Chariotage finition': 'G99', 'Centrage': 'G99',
    'Alésage à la barre': 'G99', 'Dressage': 'G99', 'Tronçonnage': 'G99', 'Rainurage externe': 'G99', 'Rainurage interne': 'G99',
  });
  assert.deepEqual([paperFeedCode('Tour'), paperFeedCode('Fraiseuse'), paperFeedCode('Perceuse / Fraiseuse'), paperFeedCode(undefined)], ['G99', 'G94', 'G94', 'G94']);
  assert.equal(SANS.operations.operations.some(hasFeedCode), false, 'la source n’est pas touchée');
  assert.deepEqual(AVEC.materiaux, SANS.materiaux);
  const { code_avance: _code, ...reste } = operation(AVEC, 'Dressage');
  assert.deepEqual(reste, operation(SANS, 'Dressage'));
  assert.equal(prefillFeedCodes(AVEC), AVEC); // déjà rempli : le même objet
  const retouche = structuredClone(SANS);
  retouche.operations.operations[0].code_avance = 'G95';
  retouche.operations.operations[1].code_avance = 'G96';
  assert.deepEqual(prefillFeedCodes(retouche).operations.operations.slice(0, 3).map((op) => op.code_avance), ['G95', 'G96', 'G94']);
  assert.deepEqual(prefillFeedCodes({ materiaux }), { materiaux });
});

test('validateTables : un code doit être l’un des quatre, donné pour toutes les opérations ou pour aucune ; une version d’avant reste valide', () => {
  assert.deepEqual(validateTables(SANS), []);
  assert.deepEqual(validateTables(AVEC), []);
  const abime = structuredClone(AVEC);
  abime.operations.operations[0].code_avance = 'G96';
  abime.operations.operations[1].code_avance = null;
  delete abime.operations.operations[2].code_avance;
  assert.deepEqual(validateTables(abime), [
    'operations[0] « Contournage ébauche » : « code_avance » doit être G94, G95, G98, G99 (G95 et G99 : avance par tour)',
    'operations[1] « Contournage finition » : « code_avance » doit être G94, G95, G98, G99 (G95 et G99 : avance par tour)',
    'operations.json : « code_avance » manque pour « Surfaçage » — il se donne pour toutes les opérations, ou pour aucune',
  ]);
  assert.equal(assembleTables(AVEC).hasFeedCodes, true);
  assert.equal(assembleTables(SANS).hasFeedCodes, false);
});

test('feedCodeWarnings : un code du tour hors du tour, un code de fraisage au tour — non bloquant, une phrase par opération ; rien pour le brouillon prérempli ni pour une version d’avant', () => {
  assert.deepEqual(feedCodeWarnings(AVEC.operations.operations), []);
  assert.deepEqual(feedCodeWarnings(SANS.operations.operations), []);
  const croise = structuredClone(AVEC);
  operation(croise, 'Perçage').code_avance = 'G99';
  operation(croise, 'Dressage').code_avance = 'G94';
  operation(croise, 'Surfaçage').code_avance = 'G95'; // fraisage, en fraiseuse : rien à dire
  assert.deepEqual(feedCodeWarnings(croise.operations.operations), [
    'Opération « Perçage » : G99 est un code du tour, mais sa machine est « Perceuse / Fraiseuse ».',
    'Opération « Dressage » : G94 est un code de fraisage, mais sa machine est « Tour ».',
  ]);
  assert.deepEqual(validateTables(croise), [], 'aucune règle bloquante n’est déduite du nom de la machine');
});

test('tablesDiff : le code G d’avance de chaque opération, « — → G99 » à la première publication qui le porte, « G99 → G98 » ensuite', () => {
  const lignes = tablesDiff(SANS, AVEC);
  assert.equal(lignes.length, 19);
  assert.ok(lignes.includes('Opération « Dressage » — code G d\'avance : — → G99'));
  assert.ok(lignes.includes('Opération « Perçage » — code G d\'avance : — → G94'));
  const suite = structuredClone(AVEC);
  operation(suite, 'Dressage').code_avance = 'G98';
  assert.deepEqual(tablesDiff(AVEC, suite), ['Opération « Dressage » — code G d\'avance : G99 → G98']);
  assert.deepEqual(tablesDiff(AVEC, AVEC), []);
});

// --- L'exercice -------------------------------------------------------------------------------------------------------------

test('inapplicableGradedError : Vf seule évaluée avec un outil en avance par tour, le message nomme les outils ; rien avec une autre grandeur, sans outil du tour, ou pour une version d’avant', () => {
  const ops = parNom(AVEC);
  const tools = [outil('mvlnr'), outil('lame_a_tronconner'), outil('foret_fractionnaire')];
  assert.equal(inapplicableGradedError(['vf'], tools, ops), "La seule grandeur évaluée, la vitesse d'avance, est sans objet pour MVLNR (mvlnr), Lame à tronçonner (lame_a_tronconner) : leur opération est en avance par tour (G95 ou G99). Évalue une autre grandeur, ou retire ces outils.");
  assert.equal(inapplicableGradedError(['vf', 'n'], tools, ops), null);
  assert.equal(inapplicableGradedError(['vf'], [outil('foret_fractionnaire')], ops), null);
  assert.equal(inapplicableGradedError(['vf'], tools, parNom(SANS)), null);
  assert.equal(inapplicableGradedError([], tools, ops), null);
  assert.notEqual(inapplicableGradedError(['vf', 'xx'], tools, ops), null); // une grandeur inconnue ne compte pas (une autre erreur la dit) : Vf reste seule
});

test('validateExercise et draftErrors : la règle de D96, point 3, dans les deux formats ; même règle à la publication des tables par la cascade (exerciseTablesImpact)', () => {
  const vfSeule = { id: 'vf-seule', titre: 'Vf seule', version: 'r0', champs_evalues: ['vf'], outils: [{ id: 'mvlnr', reussites_requises: 1 }, { id: 'foret_fractionnaire', reussites_requises: 1 }] };
  const message = "La seule grandeur évaluée, la vitesse d'avance, est sans objet pour MVLNR (mvlnr) : leur opération est en avance par tour (G95 ou G99). Évalue une autre grandeur, ou retire ces outils.";
  assert.deepEqual(validateExercise(vfSeule, assembleTables(AVEC) && assembleData(AVEC, banque)), [`exercice « vf-seule » : ${message}`]);
  assert.deepEqual(validateExercise(vfSeule, assembleData(SANS, banque)), []);
  const brouillon = draftFromExercise(vfSeule, banque);
  assert.deepEqual(draftErrors(brouillon, AVEC), [{ champ: 'champs_evalues', message }]);
  assert.deepEqual(draftErrors(brouillon, SANS), []);
  assert.deepEqual(draftErrors({ ...brouillon, champs_evalues: ['n', 'vf'] }, AVEC), []);
  // Ce que le passage de SANS à AVEC change pour cet exercice : l'erreur qui apparaît, le code de ses opérations, les outils.
  const impact = exerciseTablesImpact(brouillon, SANS, AVEC, draftErrors);
  assert.deepEqual(impact.erreurs, [`champs_evalues : ${message}`]);
  assert.ok(impact.lignes.includes('Opération « Chariotage finition » — code G d\'avance : — → G99'));
  assert.ok(impact.lignes.includes('Opération « Perçage » — code G d\'avance : — → G94'));
  assert.equal(impact.lignes.at(-1), "La vitesse d'avance devient sans objet pour MVLNR (mvlnr) : avance par tour (G95 ou G99). Elle n'est ni demandée ni corrigée.");
  // Dans l'autre sens, elle est de nouveau demandée ; et rien quand rien ne change.
  assert.deepEqual(feedRateImpact(brouillon.outils, parNom(AVEC), parNom(SANS)), ["La vitesse d'avance est de nouveau demandée pour MVLNR (mvlnr) : avance par minute (G94 ou G98)."]);
  assert.deepEqual(feedRateImpact(brouillon.outils, parNom(AVEC), parNom(AVEC)), []);
});

// --- La question, la correction, l'attestation ---------------------------------------------------------------------------------

test('questionView : le code G et « sans objet » pour un outil du tour ; le code seul pour un outil de fraiseuse ; rien de tout cela pour une version d’avant ; aucune Vf ne part, même en mode test', () => {
  const { exercise, data } = catalogue(AVEC, CINQ);
  const tour = questionView(questionDe(data, 'mvlnr'), exercise, data, { testMode: true });
  assert.equal(tour.outil.code_avance, 'G99');
  assert.deepEqual(tour.champs.map((c) => [c.champ, c.evalue, c.sans_objet ?? false, c.texte]), [['vc', true, false, ''], ['feedPerTooth', true, false, ''], ['rpm', true, false, ''], ['feedPerRev', true, false, ''], ['feedRate', false, true, '']]);
  assert.deepEqual(Object.keys(tour.reponses_test), ['vc', 'feedPerTooth', 'rpm', 'feedPerRev']);
  const attendu = formatParameters(computeParameters(questionDe(data, 'mvlnr'), data));
  assert.equal(JSON.stringify(tour).includes(`"${attendu.feedRate}"`), false);
  const fraiseuse = questionView(questionDe(data, 'foret_fractionnaire'), exercise, data, { testMode: true });
  assert.equal(fraiseuse.outil.code_avance, 'G94');
  assert.deepEqual(fraiseuse.champs.map((c) => [c.champ, c.evalue, 'sans_objet' in c]), ANSWER_FIELDS.map((f) => [f, true, false]));
  assert.deepEqual(Object.keys(fraiseuse.reponses_test), ANSWER_FIELDS);
  // Une version d'avant D96 : la question d'avant, clé pour clé.
  const avant = catalogue(SANS, CINQ);
  const vue = questionView(questionDe(avant.data, 'mvlnr'), avant.exercise, avant.data, { testMode: true });
  assert.equal('code_avance' in vue.outil, false);
  assert.deepEqual(vue.champs, ANSWER_FIELDS.map((champ) => ({ champ, evalue: true, texte: '' })));
  assert.deepEqual(Object.keys(vue.reponses_test), ANSWER_FIELDS);
});

test('questionView : « sans objet » l’emporte sur l’état que l’exercice donne à Vf — donnée ou masquée —, et sa valeur ne part jamais', () => {
  const donnee = catalogue(AVEC, { ...CINQ, champs_evalues: ['vc', 'n'] });
  const q = questionDe(donnee.data, 'lame_a_tronconner');
  const vue = questionView(q, donnee.exercise, donnee.data);
  assert.deepEqual(vue.champs.find((c) => c.champ === 'feedRate'), { champ: 'feedRate', evalue: false, sans_objet: true, texte: '' });
  assert.equal(vue.champs.find((c) => c.champ === 'feedPerRev').texte !== '', true); // f reste donnée
  assert.equal(JSON.stringify(vue).includes(`"${formatParameters(computeParameters(q, donnee.data)).feedRate}"`), false);
  const masquee = catalogue(AVEC, { ...CINQ, champs_evalues: ['vc', 'n'], champs_masques: ['vf'] });
  assert.deepEqual(questionView(questionDe(masquee.data, 'lame_a_tronconner'), masquee.exercise, masquee.data).champs.find((c) => c.champ === 'feedRate'), { champ: 'feedRate', evalue: false, sans_objet: true, texte: '' });
});

test('gradeQuestion et correctionView : Vf d’un outil du tour n’est pas corrigée — juste quoi qu’on envoie, sans cohérence, marquée notApplicable —, « sans objet » dans la vue, et la ligne de programme ; un outil de fraiseuse garde la correction de Vf', () => {
  const { exercise, data } = catalogue(AVEC, CINQ);
  const q = questionDe(data, 'mvlnr');
  const attendu = formatParameters(computeParameters(q, data));
  const saisies = { vc: attendu.vc, feedPerTooth: attendu.feedPerTooth, rpm: attendu.rpm, feedPerRev: attendu.feedPerRev, feedRate: '12345' };
  const graded = gradeQuestion(q, saisies, emptyCounters(), exercise, data);
  assert.equal(graded.success, true);
  assert.deepEqual(graded.result.fields.feedRate, { ok: true, value: null, min: null, max: null, notApplicable: true });
  assert.equal(graded.result.fields.feedPerRev.min !== null, true);
  const vue = correctionView(q, saisies, graded.result, 0, graded.counters, data, maskedFields(exercise));
  assert.deepEqual(vue.champs.find((c) => c.champ === 'feedRate'), { champ: 'feedRate', evalue: false, sans_objet: true, ok: true, saisie: '', expression: null, attendu: null, tolerance: null, ecart_pct: null, calcul: null, coherence: null });
  assert.equal(JSON.stringify(vue).includes(`"${attendu.feedRate}"`), false, 'aucune Vf dans la correction, ligne de programme comprise');
  assert.deepEqual(vue.programme.lignes.map((l) => l.map((p) => p.texte).join('')), [`G97 S${attendu.rpm} M03`, `G99 G01 Z… F${attendu.feedPerRev}`]);
  assert.equal(vue.programme.note, 'S = N. F = f, en po/tour.');
  // Une fausse Vf sur un outil de fraiseuse reste fausse ; la ligne de programme écrit Vf après F.
  const qf = questionDe(data, 'foret_fractionnaire');
  const af = formatParameters(computeParameters(qf, data));
  const gf = gradeQuestion(qf, { vc: af.vc, feedPerTooth: af.feedPerTooth, rpm: af.rpm, feedPerRev: af.feedPerRev, feedRate: '1' }, emptyCounters(), exercise, data);
  assert.equal(gf.success, false);
  assert.equal('notApplicable' in gf.result.fields.feedRate, false);
  const vf = correctionView(qf, { vc: af.vc, feedPerTooth: af.feedPerTooth, rpm: af.rpm, feedPerRev: af.feedPerRev, feedRate: '1' }, gf.result, 0, gf.counters, data, []);
  assert.equal(vf.champs.find((c) => c.champ === 'feedRate').ok, false);
  assert.deepEqual(vf.programme.lignes.map((l) => l.map((p) => p.texte).join('')), [`G97 S${af.rpm} M03`, `G94 G01 Z… F${af.feedRate}`]);
  assert.equal(vf.programme.note, 'S = N. F = Vf, en po/min.');
  // Une version d'avant : pas de ligne de programme, Vf corrigée au tour aussi.
  const avant = catalogue(SANS, CINQ);
  const qa = questionDe(avant.data, 'mvlnr');
  const ga = gradeQuestion(qa, saisies, emptyCounters(), avant.exercise, avant.data);
  assert.equal(ga.success, false);
  assert.equal('programme' in correctionView(qa, saisies, ga.result, 0, ga.counters, avant.data, []), false);
});

test('correctionView : une grandeur masquée s’écrit « — » dans la ligne de programme, et sa valeur ne part pas', () => {
  const masque = catalogue(AVEC, { ...CINQ, champs_evalues: ['vc', 'fz'], champs_masques: ['n', 'f', 'vf'] });
  const corrige = (id) => {
    const q = questionDe(masque.data, id);
    const attendu = formatParameters(computeParameters(q, masque.data));
    const saisies = { vc: attendu.vc, feedPerTooth: attendu.feedPerTooth, rpm: '', feedPerRev: '', feedRate: '' };
    const graded = gradeQuestion(q, saisies, emptyCounters(), masque.exercise, masque.data);
    return { attendu, vue: correctionView(q, saisies, graded.result, 0, graded.counters, masque.data, maskedFields(masque.exercise)) };
  };
  const tour = corrige('mvlnr'); // à une dent, f = fz : seuls N et Vf se vérifient absents
  assert.deepEqual(tour.vue.programme.lignes.map((l) => l.map((p) => p.texte).join('')), ['G97 S— M03', 'G99 G01 Z… F—']);
  for (const valeur of [tour.attendu.rpm, tour.attendu.feedRate]) assert.equal(JSON.stringify(tour.vue).includes(`"${valeur}"`), false, valeur);
  const fraiseuse = corrige('foret_fractionnaire');
  assert.deepEqual(fraiseuse.vue.programme.lignes.map((l) => l.map((p) => p.texte).join('')), ['G97 S— M03', 'G94 G01 Z… F—']);
  for (const valeur of [fraiseuse.attendu.rpm, fraiseuse.attendu.feedPerRev, fraiseuse.attendu.feedRate]) assert.equal(JSON.stringify(fraiseuse.vue).includes(`"${valeur}"`), false, valeur);
});

test('normalizedAnswers : « s.o. » pour la Vf qu’un exercice évaluait mais qui était sans objet ; rien de changé sinon', () => {
  const { exercise, data } = catalogue(AVEC, CINQ);
  const q = questionDe(data, 'lame_a_tronconner');
  const attendu = formatParameters(computeParameters(q, data));
  const saisies = { vc: attendu.vc, feedPerTooth: attendu.feedPerTooth, rpm: attendu.rpm, feedPerRev: attendu.feedPerRev, feedRate: '' };
  const { result } = gradeQuestion(q, saisies, emptyCounters(), exercise, data);
  assert.deepEqual(normalizedAnswers(saisies, result), { vc: attendu.vc, feedPerTooth: attendu.feedPerTooth, rpm: attendu.rpm, feedPerRev: attendu.feedPerRev, feedRate: NOT_APPLICABLE_SHORT });
  // L'exercice ne l'évaluait pas : pas de colonne Vf du tout.
  const deux = catalogue(AVEC, { ...CINQ, champs_evalues: ['vc', 'n'] });
  const q2 = questionDe(deux.data, 'lame_a_tronconner');
  const a2 = formatParameters(computeParameters(q2, deux.data));
  const r2 = gradeQuestion(q2, { vc: a2.vc, rpm: a2.rpm }, emptyCounters(), deux.exercise, deux.data).result;
  assert.deepEqual(Object.keys(normalizedAnswers({ vc: a2.vc, rpm: a2.rpm }, r2)), ['vc', 'rpm']);
});

// --- L'aperçu et les feuilles -------------------------------------------------------------------------------------------------

test('previewQuestions et previewRows : « sans objet » pour la Vf d’un outil du tour, sa valeur absente des réponses et des grandeurs fournies ; une version d’avant garde l’aperçu d’avant', () => {
  const { exercise, data } = catalogue(AVEC, CINQ);
  const questions = previewQuestions(exercise, data, aleaAGraine(3), 12);
  const tour = questions.filter((q) => ['mvlnr', 'lame_a_tronconner'].includes(q.outil_id));
  const fraiseuse = questions.filter((q) => !['mvlnr', 'lame_a_tronconner'].includes(q.outil_id));
  assert.ok(tour.length > 0 && fraiseuse.length > 0);
  for (const q of tour) {
    assert.deepEqual(q.sans_objet, ['feedRate']);
    assert.equal('feedRate' in q.reponses, false);
  }
  for (const q of fraiseuse) assert.equal('sans_objet' in q, false);
  const rows = previewRows(questions, exercise.champs_evalues, []);
  assert.deepEqual(rows.filter((_, i) => tour.includes(questions[i])).map((row) => row.at(-1)), tour.map(() => 'sans objet'));
  assert.ok(rows.filter((_, i) => fraiseuse.includes(questions[i])).every((row) => /^\d+\.\d{3}$/.test(row.at(-1))));
  // Vf donnée (fournie) sur une version d'avant : la valeur ; sur la nouvelle, « sans objet » au tour.
  const donnee = catalogue(AVEC, { ...CINQ, champs_evalues: ['vc', 'n'] });
  const qd = previewQuestions(donnee.exercise, donnee.data, aleaAGraine(3), 12);
  assert.ok(previewRows(qd, ['vc', 'n'], []).some((row) => row.at(-1) === 'sans objet'));
  const avant = catalogue(SANS, CINQ);
  assert.ok(previewQuestions(avant.exercise, avant.data, aleaAGraine(3), 12).every((q) => !('sans_objet' in q) && 'feedRate' in q.reponses));
});

test('feedSheet : la colonne du code G pour des tables qui portent les codes — chaque rang son code, `codes: true` — ; une version d’avant donne exactement la feuille d’avant, clé pour clé ; les onglets ne changent pas', () => {
  const avec = feedSheet(assembleTables(AVEC));
  assert.equal(avec.codes, true);
  assert.deepEqual(avec.rows.map((row) => row.code), AVEC.operations.operations.map((op) => op.code_avance));
  const sans = feedSheet(assembleTables(SANS));
  assert.equal('codes' in sans, false);
  assert.ok(sans.rows.every((row) => !('code' in row)));
  assert.deepEqual(Object.keys(sans.rows[0]), ['operation', 'picto', 'label', 'bar', 'proportional']);
  assert.deepEqual(sheetTabs(assembleTables(AVEC)).map((tab) => tab.id), ['vc', 'avances', 'formules', 'facteurs']);
});

// --- Le moteur ne change pas -------------------------------------------------------------------------------------------------

test('les valeurs théoriques ne changent pas : Vf se calcule toujours (N × f), seule la correction la laisse de côté au tour', () => {
  const { data } = catalogue(AVEC, CINQ);
  const q = questionPour({ outil: 'mvlnr', dimension: '1.000"', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: 1 });
  const avec = computeParameters(q, data);
  const avant = computeParameters(q, catalogue(SANS, CINQ).data);
  assert.deepEqual(avec, avant);
  assert.equal(avec.feedRate, avec.rpm * avec.feedPerRev);
  assert.deepEqual(fieldsToGrade({ champs_evalues: ['vf'] }), ['feedRate']);
});
