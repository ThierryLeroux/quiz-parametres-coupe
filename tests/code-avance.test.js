// Tests du code G d'avance (décisions D96, D97 : le code est celui de l'outil — la banque, puis chaque copie d'un exercice —,
// jamais des tables) : les règles pures de site/js/code-avance.js, la validation des outils et des exercices (data.js,
// exercice.js), la copie d'un outil (copyOfTool), les différences (publication, historique de la banque), la correction
// et les vues du serveur (seance.js), l'attestation (attestation.js), l'aperçu (worker/editeur.js), les feuilles qui
// n'en portent rien (sheets-data.js, tables.js) et le brouillon des tables débarrassé d'un code resté de D96. Sans DOM ;
// les écrans sont dans tests/ui-code-avance.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeParameters } from '../site/js/calcul.js';
import {
  F_WORD_FROM_QUESTION, F_WORD_LABEL, FEED_CODE_CHOICES, FEED_CODES, NOT_APPLICABLE, NOT_APPLICABLE_SHORT, fWordField, fWordShown, feedCodeErrors, feedCodeLabel,
  feedCodeOf, feedCodeText, feedRateApplies, hasFeedCode, inapplicableFields, inapplicableGradedError, isFeedCode, isPerRevolution, notApplicableNote, ownFeedCodeLabel,
  programCoordinate, programLines, stripFeedCodes, withFeedCode,
} from '../site/js/code-avance.js';
import { ANSWER_FIELDS } from '../site/js/correction.js';
import { TOOL_KEYS, assembleData, assembleTables, toolErrors, validateTables } from '../site/js/data.js';
import { copyOfTool, draftErrors, draftFromExercise, engineExercise, maskedFields, validateExercise } from '../site/js/exercice.js';
import { prefillSpeedFactors } from '../site/js/facteur-vitesse.js';
import { formatParameters } from '../site/js/format.js';
import { generateQuestion } from '../site/js/question.js';
import { tablesDiff } from '../site/js/tables.js';
import { bankToolDiff, diffLines, exerciseTablesImpact, previewRows, versionDiff } from '../site/js/ui/editeur-data.js';
import { feedSheet, sheetTabs } from '../site/js/ui/sheets-data.js';
import { normalizedAnswers } from '../worker/attestation.js';
import { cleanTables, previewQuestions } from '../worker/editeur.js';
import { correctionView, emptyCounters, gradeQuestion, questionView } from '../worker/seance.js';
import { aleaAGraine, lireFichier } from './aide.js';

const materiaux = await lireFichier('data/materiaux.json');
const operations = await lireFichier('data/operations.json');
const banque = (await lireFichier('data/outils.json')).outils;
const SANS = { materiaux, operations }; // la semence, A2026_r0
const AVEC = prefillSpeedFactors(SANS); // des tables qui portent les facteurs de vitesse (comme A2026_r6 en production)
const outil = (id) => structuredClone(banque.find((t) => t.id === id));
const parNom = (tables) => new Map(tables.operations.operations.map((op) => [op.operation, op]));

// Un exercice à cinq grandeurs qui mêle le tour et la fraiseuse, au format fichier (SPEC §10) : le code de chaque entrée
// (❓ D97, point 5) devient celui de la copie — MVLNR et la lame en G99, le foret en G94, la fraise sans code.
const CINQ = {
  id: 'cinq', titre: 'Cinq grandeurs', version: 'r0', champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'],
  outils: [{ id: 'mvlnr', reussites_requises: 1, code_avance: 'G99' }, { id: 'lame_a_tronconner', reussites_requises: 1, code_avance: 'G99' }, { id: 'foret_fractionnaire', reussites_requises: 1, code_avance: 'G94' }, { id: 'fraise_en_bout_helicoidale', reussites_requises: 1 }],
};
// Le même, sans aucun code : l'exercice d'avant D96.
const SANS_CODE = { ...CINQ, id: 'sans-code', outils: CINQ.outils.map(({ code_avance: _c, ...entry }) => entry) };

// Le catalogue d'un exercice avec des tables, par le format fichier (copyOfTool).
const catalogue = (tables, exercice) => {
  const { exercise, tools } = engineExercise(exercice.id, 1, draftFromExercise(exercice, banque));
  return { exercise, data: assembleData(tables, tools) };
};
const questionDe = (data, id) => generateQuestion(data, [data.outils.find((t) => t.id === id)], aleaAGraine(97));
const texteDes = (lignes) => lignes.map((ligne) => ligne.map((part) => part.texte).join(''));

// --- Les codes et l'outil ---------------------------------------------------------------------------------------------------

test('les quatre codes : G95 et G99 sont l’avance par tour, G94 et G98 l’avance par minute ; tout autre texte est refusé ; les libellés', () => {
  assert.deepEqual(FEED_CODES, ['G94', 'G95', 'G98', 'G99']);
  assert.deepEqual(FEED_CODES.map(isPerRevolution), [false, true, false, true]);
  assert.deepEqual(['G94', 'g99', 'G96', '', null, 94].map(isFeedCode), [true, false, false, false, false, false]);
  assert.deepEqual(FEED_CODES.map(feedCodeLabel), ['avance par minute', 'avance par tour', 'avance par minute', 'avance par tour']);
  assert.equal(feedCodeText('G99'), 'G99 · avance par tour');
  assert.deepEqual(FEED_CODES.map(fWordField), ['feedRate', 'feedPerRev', 'feedRate', 'feedPerRev']);
  assert.deepEqual(FEED_CODE_CHOICES, [
    { value: '', label: 'Aucune' }, { value: 'G94', label: 'G94 · fraisage, par minute' }, { value: 'G95', label: 'G95 · fraisage, par tour' },
    { value: 'G98', label: 'G98 · tour, par minute' }, { value: 'G99', label: 'G99 · tour, par tour' },
  ]);
});

test('hasFeedCode, feedCodeOf, ownFeedCodeLabel : le code est celui de l’OUTIL ; absent, « aucune » ; une valeur illisible vaut « aucune » en attendant la validation', () => {
  assert.equal(hasFeedCode(outil('mvlnr')), false);
  assert.equal(feedCodeOf(outil('mvlnr')), null);
  assert.equal(feedCodeOf({ ...outil('mvlnr'), code_avance: 'G99' }), 'G99');
  assert.equal(feedCodeOf({ ...outil('mvlnr'), code_avance: 'G96' }), null);
  assert.equal(feedCodeOf(undefined), null);
  assert.deepEqual([ownFeedCodeLabel(outil('mvlnr')), ownFeedCodeLabel({ code_avance: 'G99' })], ['aucune', 'G99']);
  // Aucun outil de la semence n'a de code (D97 : la banque donne la valeur de départ, et elle part sans).
  assert.equal(banque.some(hasFeedCode), false);
});

test('feedCodeErrors et toolErrors : un code qui n’est pas l’un des quatre est une erreur sur « code_avance » ; absent, rien ; TOOL_KEYS la porte', () => {
  assert.deepEqual(feedCodeErrors(outil('mvlnr')), []);
  assert.deepEqual(feedCodeErrors({ ...outil('mvlnr'), code_avance: 'G99' }), []);
  assert.deepEqual(feedCodeErrors({ ...outil('mvlnr'), code_avance: 'G96' }), [{ champ: 'code_avance', message: '« code_avance » doit être G94, G95, G98, G99, ou absent (aucune avance programmée)' }]);
  assert.deepEqual(feedCodeErrors({ ...outil('mvlnr'), code_avance: null }), [{ champ: 'code_avance', message: '« code_avance » doit être G94, G95, G98, G99, ou absent (aucune avance programmée)' }]);
  const ops = parNom(SANS);
  assert.deepEqual(toolErrors({ ...outil('mvlnr'), code_avance: 'G99' }, ops, materiaux.groupes_iso), []);
  assert.deepEqual(toolErrors({ ...outil('mvlnr'), code_avance: 'G1' }, ops, materiaux.groupes_iso).map((e) => e.champ), ['code_avance']);
  assert.ok(TOOL_KEYS.includes('code_avance'));
  assert.equal(TOOL_KEYS.indexOf('code_avance'), TOOL_KEYS.indexOf('fact_av') + 1);
});

test('feedRateApplies et inapplicableFields : Vf sans objet pour un outil en G95 ou G99 ; demandée en G94, G98, et toujours sans code', () => {
  assert.equal(feedRateApplies({ code_avance: 'G99' }), false);
  assert.equal(feedRateApplies({ code_avance: 'G95' }), false);
  assert.equal(feedRateApplies({ code_avance: 'G94' }), true);
  assert.equal(feedRateApplies(outil('mvlnr')), true);
  assert.equal(feedRateApplies(undefined), true);
  assert.deepEqual(inapplicableFields({ code_avance: 'G99' }), ['feedRate']);
  assert.deepEqual(inapplicableFields({ code_avance: 'G98' }), []);
  assert.deepEqual(inapplicableFields(outil('lame_a_tronconner')), []);
});

test('withFeedCode : pose le code après fact_av, ou retire la clé pour « Aucune » ; ne modifie pas l’objet reçu', () => {
  const avec = withFeedCode(outil('mvlnr'), 'G99');
  assert.equal(avec.code_avance, 'G99');
  assert.equal(Object.keys(avec).indexOf('code_avance'), Object.keys(avec).indexOf('fact_av') + 1);
  assert.equal('code_avance' in outil('mvlnr'), false);
  const sans = withFeedCode(avec, '');
  assert.equal('code_avance' in sans, false);
  assert.deepEqual(sans, outil('mvlnr'));
  assert.equal('code_avance' in withFeedCode(avec, null), false);
  assert.equal(withFeedCode(avec, 'G94').code_avance, 'G94');
  assert.equal(withFeedCode({ id: 'x', nom: 'X' }, 'G95').code_avance, 'G95'); // sans fact_av : à la fin
});

test('le mot F se montre dès la question (un essai) ; une seule constante le réserve au corrigé ; les textes de « sans objet »', () => {
  assert.equal(F_WORD_FROM_QUESTION, true);
  assert.equal(F_WORD_LABEL, 'mot F');
  assert.deepEqual([fWordShown('question'), fWordShown('corrige'), fWordShown('autre')], [true, true, false]);
  assert.deepEqual([NOT_APPLICABLE, NOT_APPLICABLE_SHORT], ['sans objet', 's.o.']);
  assert.equal(notApplicableNote('G99'), "En G99, F est l'avance par tour.");
  assert.equal(notApplicableNote('G95'), "En G95, F est l'avance par tour.");
});

// --- La ligne de programme ------------------------------------------------------------------------------------------------

test('programCoordinate : d’après la direction d’avance de l’opération — longitudinale et axiale → Z…, transversale → X…, latérale → X… Y… ; inconnue → aucune', () => {
  assert.deepEqual(['Avance longitudinale', 'Avance transversale', 'Avance axiale', 'Avance latérale'].map(programCoordinate), ['Z…', 'X…', 'Z…', 'X… Y…']);
  assert.deepEqual(['LONGITUDINALE', 'laterale', 'Avance axiale (Z)'].map(programCoordinate), ['Z…', 'X… Y…', 'Z…']);
  assert.deepEqual(['', null, undefined, 'Plongée'].map(programCoordinate), [null, null, null, null]);
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
  assert.deepEqual(texteDes(programLines('G94', 'Avance latérale', { ...displayed, rpm: '2400', feedRate: '28.800' }).lignes), ['G97 S2400 M03', 'G94 G01 X… Y… F28.800']);
  assert.equal(programLines('G94', 'Avance latérale', displayed).note, 'S = N. F = Vf, en po/min.');
  assert.deepEqual(programLines('G95', 'Plongée', displayed).lignes[1], [{ texte: 'G95 G01 ' }, { texte: 'F0.0100', role: 'mot_f' }]);
  assert.deepEqual(texteDes(programLines('G99', 'Avance transversale', displayed, ['rpm', 'feedPerRev']).lignes), ['G97 S— M03', 'G99 G01 X… F—']);
  assert.doesNotMatch(JSON.stringify(tour), /10\.000/); // jamais Vf dans une ligne au tour
});

// --- Les tables n'en portent rien (D97) ---------------------------------------------------------------------------------------

test('stripFeedCodes, cleanTables, validateTables : un code resté sur une opération d’un brouillon de D96 est ignoré à la lecture, retiré à l’enregistrement, et ne bloque rien ; rien à retirer : le même objet', () => {
  const reste = structuredClone(AVEC);
  reste.operations.operations[4].code_avance = 'G94';
  reste.operations.operations[15].code_avance = 'G99';
  assert.deepEqual(validateTables(reste), []);
  const nettoye = stripFeedCodes(reste);
  assert.deepEqual(nettoye, AVEC);
  assert.equal(reste.operations.operations[4].code_avance, 'G94', 'la source n’est pas touchée');
  assert.equal(stripFeedCodes(AVEC), AVEC);
  assert.deepEqual(stripFeedCodes({ materiaux }), { materiaux });
  assert.deepEqual(cleanTables({ materiaux: reste.materiaux, operations: reste.operations, autre: 1 }), AVEC);
  assert.deepEqual(tablesDiff(AVEC, reste), [], 'les différences ne le voient pas');
  // L'impact d'un changement de tables ne parle jamais du code ; les feuilles non plus.
  const impact = exerciseTablesImpact(draftFromExercise(CINQ, banque), AVEC, reste, draftErrors);
  assert.deepEqual(impact, { erreurs: [], lignes: [] });
  const feuille = feedSheet(assembleTables(reste));
  assert.equal('codes' in feuille, false);
  assert.deepEqual(Object.keys(feuille.rows[0]), ['operation', 'picto', 'label', 'bar', 'proportional']);
  assert.deepEqual(sheetTabs(assembleTables(AVEC)).map((tab) => tab.id), ['vc', 'avances', 'formules', 'facteurs']);
  assert.equal('hasFeedCodes' in assembleTables(AVEC), false);
});

// --- L'exercice et ses copies -----------------------------------------------------------------------------------------------

test('copyOfTool et draftFromExercise : une copie prend le code de sa source (la banque, une autre copie) ; une entrée du format fichier le règle (❓ D97, point 5) ; absent partout, pas de clé', () => {
  const banqueAvec = { ...outil('mvlnr'), code_avance: 'G99' };
  assert.equal(copyOfTool(banqueAvec, { reussites_requises: 2 }).code_avance, 'G99');
  assert.equal(copyOfTool(banqueAvec, { reussites_requises: 2, code_avance: 'G94' }).code_avance, 'G94');
  assert.equal('code_avance' in copyOfTool(outil('mvlnr'), { reussites_requises: 2 }), false);
  assert.equal(copyOfTool(outil('mvlnr'), { reussites_requises: 2, code_avance: 'G99' }).code_avance, 'G99');
  const brouillon = draftFromExercise(CINQ, banque);
  assert.deepEqual(brouillon.outils.map((c) => c.code_avance), ['G99', 'G99', 'G94', undefined]);
  assert.deepEqual(draftFromExercise(SANS_CODE, banque).outils.map((c) => 'code_avance' in c), [false, false, false, false]);
  // La copie d'une copie garde son code (dupliquer dans l'exercice).
  assert.equal(copyOfTool(brouillon.outils[0], { id: 'mvlnr_2' }).code_avance, 'G99');
});

test('inapplicableGradedError : Vf seule évaluée avec une copie en avance par tour, le message nomme les outils ; rien avec une autre grandeur, sans copie par tour, ou sans code', () => {
  const copies = draftFromExercise(CINQ, banque).outils;
  assert.equal(inapplicableGradedError(['vf'], copies), "La seule grandeur évaluée, la vitesse d'avance, est sans objet pour MVLNR (mvlnr), Lame à tronçonner (lame_a_tronconner) : leur avance programmée est par tour (G95 ou G99). Évalue une autre grandeur, ou retire ces outils.");
  assert.equal(inapplicableGradedError(['vf', 'n'], copies), null);
  assert.equal(inapplicableGradedError(['vf'], copies.slice(2)), null); // G94 et sans code
  assert.equal(inapplicableGradedError(['vf'], draftFromExercise(SANS_CODE, banque).outils), null);
  assert.equal(inapplicableGradedError([], copies), null);
  assert.notEqual(inapplicableGradedError(['vf', 'xx'], copies), null); // une grandeur inconnue ne compte pas (une autre erreur la dit)
});

test('validateExercise et draftErrors : la règle dans les deux formats, avec n’importe quelle version de tables ; un code illisible sur une entrée ou une copie est une erreur nommée', () => {
  const vfSeule = { ...CINQ, id: 'vf-seule', champs_evalues: ['vf'], outils: [{ id: 'mvlnr', reussites_requises: 1, code_avance: 'G99' }, { id: 'foret_fractionnaire', reussites_requises: 1 }] };
  const message = "La seule grandeur évaluée, la vitesse d'avance, est sans objet pour MVLNR (mvlnr) : leur avance programmée est par tour (G95 ou G99). Évalue une autre grandeur, ou retire ces outils.";
  for (const tables of [SANS, AVEC]) {
    assert.deepEqual(validateExercise(vfSeule, assembleData(tables, banque)), [`exercice « vf-seule » : ${message}`]);
    assert.deepEqual(draftErrors(draftFromExercise(vfSeule, banque), tables), [{ champ: 'champs_evalues', message }]);
    assert.deepEqual(draftErrors({ ...draftFromExercise(vfSeule, banque), champs_evalues: ['n', 'vf'] }, tables), []);
    assert.deepEqual(draftErrors(draftFromExercise(CINQ, banque), tables), []);
  }
  assert.deepEqual(validateExercise({ ...vfSeule, champs_evalues: ['vc'], outils: [{ id: 'mvlnr', reussites_requises: 1, code_avance: 'G96' }] }, assembleData(SANS, banque)), ['exercice « vf-seule », outils[0] « mvlnr » : « code_avance » doit être G94, G95, G98, G99, ou absent (aucune avance programmée)']);
  const brouillon = draftFromExercise(CINQ, banque);
  brouillon.outils[0].code_avance = 'G1';
  assert.deepEqual(draftErrors(brouillon, SANS), [{ champ: 'outils.0.code_avance', message: '« code_avance » doit être G94, G95, G98, G99, ou absent (aucune avance programmée)' }]);
});

test('versionDiff et bankToolDiff : « avance programmée : « aucune » → « G99 » » ; l’historique de la banque le garde de même', () => {
  const avant = draftFromExercise(SANS_CODE, banque);
  const apres = draftFromExercise(CINQ, banque);
  const lines = diffLines(versionDiff(avant, apres));
  assert.deepEqual(lines, [
    'MVLNR (mvlnr) — avance programmée : « aucune » → « G99 »',
    'Lame à tronçonner (lame_a_tronconner) — avance programmée : « aucune » → « G99 »',
    'Foret fractionnaire (foret_fractionnaire) — avance programmée : « aucune » → « G94 »',
  ]);
  assert.deepEqual(diffLines(versionDiff(apres, { ...apres, outils: apres.outils.map((c) => withFeedCode(c, c.id === 'mvlnr' ? 'G98' : feedCodeOf(c))) })), ['MVLNR (mvlnr) — avance programmée : « G99 » → « G98 »']);
  assert.deepEqual(bankToolDiff(outil('mvlnr'), withFeedCode(outil('mvlnr'), 'G99')), ['Avance programmée : « aucune » → « G99 »']);
  assert.deepEqual(bankToolDiff(withFeedCode(outil('mvlnr'), 'G99'), outil('mvlnr')), ['Avance programmée : « G99 » → « aucune »']);
});

// --- La question, la correction, l'attestation ---------------------------------------------------------------------------------

test('questionView : le code et « sans objet » pour une copie en G99 ; le code seul pour une copie en G94 ; rien pour une copie sans code, dans le même exercice ; aucune Vf ne part, même en mode test', () => {
  const { exercise, data } = catalogue(AVEC, CINQ);
  const tour = questionView(questionDe(data, 'mvlnr'), exercise, data, { testMode: true });
  assert.equal(tour.outil.code_avance, 'G99');
  assert.deepEqual(tour.champs.map((c) => [c.champ, c.evalue, c.sans_objet ?? false, c.texte]), [['vc', true, false, ''], ['feedPerTooth', true, false, ''], ['rpm', true, false, ''], ['feedPerRev', true, false, ''], ['feedRate', false, true, '']]);
  assert.deepEqual(Object.keys(tour.reponses_test), ['vc', 'feedPerTooth', 'rpm', 'feedPerRev']);
  assert.equal(JSON.stringify(tour).includes(`"${formatParameters(computeParameters(questionDe(data, 'mvlnr'), data)).feedRate}"`), false);
  const fraiseuse = questionView(questionDe(data, 'foret_fractionnaire'), exercise, data, { testMode: true });
  assert.equal(fraiseuse.outil.code_avance, 'G94');
  assert.deepEqual(fraiseuse.champs.map((c) => [c.champ, c.evalue, 'sans_objet' in c]), ANSWER_FIELDS.map((f) => [f, true, false]));
  assert.deepEqual(Object.keys(fraiseuse.reponses_test), ANSWER_FIELDS);
  // La fraise, sans code : la question d'avant D96, clé pour clé.
  const sans = questionView(questionDe(data, 'fraise_en_bout_helicoidale'), exercise, data, { testMode: true });
  assert.equal('code_avance' in sans.outil, false);
  assert.deepEqual(sans.champs, ANSWER_FIELDS.map((champ) => ({ champ, evalue: true, texte: '' })));
  // Le même tour sans code, avec n'importe quelles tables : la question d'avant.
  for (const tables of [SANS, AVEC]) {
    const avant = catalogue(tables, SANS_CODE);
    const vue = questionView(questionDe(avant.data, 'mvlnr'), avant.exercise, avant.data, { testMode: true });
    assert.equal('code_avance' in vue.outil, false);
    assert.deepEqual(Object.keys(vue.reponses_test), ANSWER_FIELDS);
  }
});

test('questionView : « sans objet » l’emporte sur l’état que l’exercice donne à Vf — donnée ou masquée —, et sa valeur ne part jamais', () => {
  const donnee = catalogue(AVEC, { ...CINQ, champs_evalues: ['vc', 'n'] });
  const q = questionDe(donnee.data, 'lame_a_tronconner');
  const vue = questionView(q, donnee.exercise, donnee.data);
  assert.deepEqual(vue.champs.find((c) => c.champ === 'feedRate'), { champ: 'feedRate', evalue: false, sans_objet: true, texte: '' });
  assert.equal(vue.champs.find((c) => c.champ === 'feedPerRev').texte !== '', true); // f reste donnée
  assert.equal(JSON.stringify(vue).includes(`"${formatParameters(computeParameters(q, donnee.data)).feedRate}"`), false);
  assert.equal(questionView(questionDe(donnee.data, 'foret_fractionnaire'), donnee.exercise, donnee.data).champs.find((c) => c.champ === 'feedRate').texte !== '', true); // G94 : donnée
  const masquee = catalogue(AVEC, { ...CINQ, champs_evalues: ['vc', 'n'], champs_masques: ['vf'] });
  assert.deepEqual(questionView(questionDe(masquee.data, 'lame_a_tronconner'), masquee.exercise, masquee.data).champs.find((c) => c.champ === 'feedRate'), { champ: 'feedRate', evalue: false, sans_objet: true, texte: '' });
});

test('gradeQuestion et correctionView : Vf d’une copie en G99 n’est pas corrigée — juste quoi qu’on envoie, sans cohérence, marquée notApplicable —, « sans objet » dans la vue, et la ligne de programme ; une copie en G94 garde la correction de Vf, une copie sans code aussi, sans ligne de programme', () => {
  const { exercise, data } = catalogue(AVEC, CINQ);
  const q = questionDe(data, 'mvlnr');
  const attendu = formatParameters(computeParameters(q, data));
  const saisies = { vc: attendu.vc, feedPerTooth: attendu.feedPerTooth, rpm: attendu.rpm, feedPerRev: attendu.feedPerRev, feedRate: '12345' };
  const graded = gradeQuestion(q, saisies, emptyCounters(), exercise, data);
  assert.equal(graded.success, true);
  assert.deepEqual(graded.result.fields.feedRate, { ok: true, value: null, min: null, max: null, notApplicable: true });
  const vue = correctionView(q, saisies, graded.result, 0, graded.counters, data, maskedFields(exercise));
  assert.deepEqual(vue.champs.find((c) => c.champ === 'feedRate'), { champ: 'feedRate', evalue: false, sans_objet: true, ok: true, saisie: '', expression: null, attendu: null, tolerance: null, ecart_pct: null, calcul: null, coherence: null });
  assert.equal(JSON.stringify(vue).includes(`"${attendu.feedRate}"`), false, 'aucune Vf dans la correction, ligne de programme comprise');
  assert.deepEqual(texteDes(vue.programme.lignes), [`G97 S${attendu.rpm} M03`, `G99 G01 Z… F${attendu.feedPerRev}`]);
  assert.equal(vue.programme.note, 'S = N. F = f, en po/tour.');
  const corrige = (id, feedRate) => {
    const qq = questionDe(data, id);
    const a = formatParameters(computeParameters(qq, data));
    const s = { vc: a.vc, feedPerTooth: a.feedPerTooth, rpm: a.rpm, feedPerRev: a.feedPerRev, feedRate };
    const g = gradeQuestion(qq, s, emptyCounters(), exercise, data);
    return { attendu: a, success: g.success, result: g.result, vue: correctionView(qq, s, g.result, 0, g.counters, data, []) };
  };
  // Le foret (G94) : une fausse Vf reste fausse ; la ligne de programme écrit Vf après F.
  const foret = corrige('foret_fractionnaire', '1');
  assert.equal(foret.success, false);
  assert.equal('notApplicable' in foret.result.fields.feedRate, false);
  assert.deepEqual(texteDes(foret.vue.programme.lignes), [`G97 S${foret.attendu.rpm} M03`, `G94 G01 Z… F${foret.attendu.feedRate}`]);
  assert.equal(foret.vue.programme.note, 'S = N. F = Vf, en po/min.');
  // La fraise, sans code : Vf corrigée, pas de ligne de programme — la correction d'avant.
  const fraise = corrige('fraise_en_bout_helicoidale', '1');
  assert.equal(fraise.success, false);
  assert.equal('programme' in fraise.vue, false);
  assert.equal(fraise.vue.champs.find((c) => c.champ === 'feedRate').evalue, true);
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
  assert.deepEqual(texteDes(tour.vue.programme.lignes), ['G97 S— M03', 'G99 G01 Z… F—']);
  for (const valeur of [tour.attendu.rpm, tour.attendu.feedRate]) assert.equal(JSON.stringify(tour.vue).includes(`"${valeur}"`), false, valeur);
  const foret = corrige('foret_fractionnaire');
  assert.deepEqual(texteDes(foret.vue.programme.lignes), ['G97 S— M03', 'G94 G01 Z… F—']);
  for (const valeur of [foret.attendu.rpm, foret.attendu.feedPerRev, foret.attendu.feedRate]) assert.equal(JSON.stringify(foret.vue).includes(`"${valeur}"`), false, valeur);
});

test('normalizedAnswers : « s.o. » pour la Vf qu’un exercice évaluait mais qui était sans objet pour cette copie ; rien de changé sinon', () => {
  const { exercise, data } = catalogue(AVEC, CINQ);
  const q = questionDe(data, 'lame_a_tronconner');
  const attendu = formatParameters(computeParameters(q, data));
  const saisies = { vc: attendu.vc, feedPerTooth: attendu.feedPerTooth, rpm: attendu.rpm, feedPerRev: attendu.feedPerRev, feedRate: '' };
  const { result } = gradeQuestion(q, saisies, emptyCounters(), exercise, data);
  assert.deepEqual(normalizedAnswers(saisies, result), { vc: attendu.vc, feedPerTooth: attendu.feedPerTooth, rpm: attendu.rpm, feedPerRev: attendu.feedPerRev, feedRate: NOT_APPLICABLE_SHORT });
  const deux = catalogue(AVEC, { ...CINQ, champs_evalues: ['vc', 'n'] });
  const q2 = questionDe(deux.data, 'lame_a_tronconner');
  const a2 = formatParameters(computeParameters(q2, deux.data));
  assert.deepEqual(Object.keys(normalizedAnswers({ vc: a2.vc, rpm: a2.rpm }, gradeQuestion(q2, { vc: a2.vc, rpm: a2.rpm }, emptyCounters(), deux.exercise, deux.data).result)), ['vc', 'rpm']);
});

test('previewQuestions et previewRows : « sans objet » pour la Vf d’une copie en G99, sa valeur absente des réponses et des grandeurs fournies ; une copie sans code garde l’aperçu d’avant', () => {
  const { exercise, data } = catalogue(AVEC, CINQ);
  const questions = previewQuestions(exercise, data, aleaAGraine(3), 16);
  const tour = questions.filter((q) => ['mvlnr', 'lame_a_tronconner'].includes(q.outil_id));
  const autres = questions.filter((q) => !['mvlnr', 'lame_a_tronconner'].includes(q.outil_id));
  assert.ok(tour.length > 0 && autres.length > 0);
  for (const q of tour) assert.deepEqual([q.sans_objet, 'feedRate' in q.reponses], [['feedRate'], false]);
  for (const q of autres) assert.deepEqual(['sans_objet' in q, 'feedRate' in q.reponses], [false, true]);
  const rows = previewRows(questions, exercise.champs_evalues, []);
  assert.deepEqual(rows.filter((_, i) => tour.includes(questions[i])).map((row) => row.at(-1)), tour.map(() => 'sans objet'));
  assert.ok(rows.filter((_, i) => autres.includes(questions[i])).every((row) => /^\d+\.\d{3}$/.test(row.at(-1))));
  const avant = catalogue(AVEC, SANS_CODE);
  assert.ok(previewQuestions(avant.exercise, avant.data, aleaAGraine(3), 12).every((q) => !('sans_objet' in q) && 'feedRate' in q.reponses));
});

test('les valeurs théoriques ne changent pas : Vf se calcule toujours (N × f), seule la correction la laisse de côté pour une copie par tour', () => {
  const { data } = catalogue(AVEC, CINQ);
  const q = questionDe(data, 'mvlnr');
  const avec = computeParameters(q, data);
  assert.deepEqual(avec, computeParameters(q, catalogue(AVEC, SANS_CODE).data));
  assert.equal(avec.feedRate, avec.rpm * avec.feedPerRev);
});
