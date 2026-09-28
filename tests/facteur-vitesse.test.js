// Tests du facteur de vitesse (décision D83) : les règles pures de site/js/facteur-vitesse.js, la validation des
// tables et des outils (data.js), le réglage de l'exercice (exercice.js) et le calcul de N (calcul.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeParameters } from '../site/js/calcul.js';
import { assembleData, toolErrors, validateTables } from '../site/js/data.js';
import { draftErrors, draftFromExercise, engineExercise, validateExercise } from '../site/js/exercice.js';
import {
  PAPER_FACTORS, PASSAGE_REASON, REASON_MAX, adoptSpeedFactor, adoptSpeedFactors, carriesSpeedFactors, factorGiven, factorText, forcedFactorLine, hasSpeedFactor,
  ownFactorLabel, paperFactor, parseFactor, prefillSpeedFactors, questionFactor, settleSpeedFactor, settleSpeedFactors, speedFactorOf, speedFactorState, tableFactorLine,
} from '../site/js/facteur-vitesse.js';
import { generateQuestion } from '../site/js/question.js';
import { tablesDiff } from '../site/js/tables.js';
import { data, lireFichier } from './aide.js';

const materiaux = await lireFichier('data/materiaux.json');
const operations = await lireFichier('data/operations.json');
const banque = (await lireFichier('data/outils.json')).outils;
const SANS = { materiaux, operations }; // la semence, « A2026_r0 » : sans facteurs
const AVEC = prefillSpeedFactors(SANS); // le brouillon prérempli d'après la table papier
const operation = (tables, nom) => tables.operations.operations.find((op) => op.operation === nom);
const outil = (id) => structuredClone(banque.find((t) => t.id === id));
const groupes = materiaux.groupes_iso;
const parNom = (tables) => new Map(tables.operations.operations.map((op) => [op.operation, op]));

// --- Écrire et lire un facteur ---------------------------------------------------------------------------------------

test('factorText : en fraction comme sur le papier (1, 1/4, 1/8), en décimal seulement hors de la forme 1/n', () => {
  assert.deepEqual([1, 0.5, 0.25, 0.125, 0.1, 1 / 3, parseFactor('1/3')].map(factorText), ['1', '1/2', '1/4', '1/8', '1/10', '1/3', '1/3']);
  assert.deepEqual([0.75, 1.5, 2, 0.3, 0.26].map(factorText), ['0.75', '1.5', '2', '0.3', '0.26']);
});

test('parseFactor : « 1/4 » comme « 0.25 », la virgule, l’évaluateur des cases de réponse ; vide, illisible, nul ou négatif : null', () => {
  assert.deepEqual(['1/4', '0.25', '0,25', ' 1 / 8 ', '1', '3/4', '.5'].map(parseFactor), [0.25, 0.25, 0.25, 0.125, 1, 0.75, 0.5]);
  assert.deepEqual(['', '   ', 'abc', '1/', '0', '-1', '1/0', '1/4x', null, undefined].map(parseFactor), Array(10).fill(null));
});

// --- Les tables ---------------------------------------------------------------------------------------------------------

test('la table papier : les six opérations réduites de la semence, toutes les autres à 1 (D83, point 2)', () => {
  const noms = operations.operations.map((op) => op.operation);
  for (const nom of Object.keys(PAPER_FACTORS)) assert.ok(noms.includes(nom), `« ${nom} » est une opération de la semence`);
  assert.deepEqual(Object.fromEntries(noms.map((nom) => [nom, factorText(paperFactor(nom))])), {
    'Contournage ébauche': '1', 'Contournage finition': '1', 'Surfaçage': '1', 'Chanfreinage / ébavurage': '1/4',
    'Perçage': '1', 'Chanfreinage': '1/4', "Alésage à l'alésoir": '1/4', 'Pointage': '1', 'Taraudage': '1',
    'Filetage externe': '1', 'Filetage interne': '1', 'Chariotage ébauche': '1', 'Chariotage finition': '1', 'Centrage': '1',
    'Alésage à la barre': '1', 'Dressage': '1', 'Tronçonnage': '1/8', 'Rainurage externe': '1/4', 'Rainurage interne': '1/4',
  });
  assert.equal(paperFactor('Chambrage'), 1); // ni Chambrage ni Moletage ne sont créés : une opération inconnue vaut 1
});

test('prefillSpeedFactors : une opération sans la clé reçoit la valeur du papier ; une valeur présente est gardée ; rien n’est modifié sur place', () => {
  assert.equal(carriesSpeedFactors(SANS.operations.operations), false);
  assert.equal(carriesSpeedFactors(AVEC.operations.operations), true);
  assert.equal(operations.operations.some(hasSpeedFactor), false, 'la semence lue n’est pas touchée');
  assert.deepEqual(AVEC.materiaux, SANS.materiaux);
  assert.equal(AVEC.operations.revision, 'A2026_r0');
  const { facteur_vitesse: facteur, ...reste } = operation(AVEC, 'Tronçonnage');
  assert.deepEqual([facteur, reste], [0.125, operation(SANS, 'Tronçonnage')]);
  // Déjà rempli : le même objet ; une valeur retouchée, ou fausse, reste (la validation la dira).
  assert.equal(prefillSpeedFactors(AVEC), AVEC);
  const retouche = structuredClone(SANS);
  retouche.operations.operations[0].facteur_vitesse = 0.5;
  retouche.operations.operations[1].facteur_vitesse = null;
  assert.deepEqual(prefillSpeedFactors(retouche).operations.operations.slice(0, 4).map((op) => op.facteur_vitesse), [0.5, null, 1, 0.25]);
  assert.deepEqual(prefillSpeedFactors({ materiaux }), { materiaux });
});

test('validateTables : le facteur est un nombre > 0, donné pour toutes les opérations ou pour aucune', () => {
  assert.deepEqual(validateTables(SANS), []);
  assert.deepEqual(validateTables(AVEC), []);
  const abime = structuredClone(AVEC);
  abime.operations.operations[0].facteur_vitesse = 0;
  abime.operations.operations[1].facteur_vitesse = '1/4';
  abime.operations.operations[2].facteur_vitesse = null;
  assert.deepEqual(validateTables(abime), [
    "operations[0] « Contournage ébauche » : « facteur_vitesse » doit être un nombre > 0 (1 : aucune réduction ; « 1/4 » s'écrit 0.25)",
    "operations[1] « Contournage finition » : « facteur_vitesse » doit être un nombre > 0 (1 : aucune réduction ; « 1/4 » s'écrit 0.25)",
    "operations[2] « Surfaçage » : « facteur_vitesse » doit être un nombre > 0 (1 : aucune réduction ; « 1/4 » s'écrit 0.25)",
  ]);
  const troue = structuredClone(AVEC);
  delete troue.operations.operations[4].facteur_vitesse;
  delete troue.operations.operations[16].facteur_vitesse;
  assert.deepEqual(validateTables(troue), ['operations.json : « facteur_vitesse » manque pour « Perçage », « Tronçonnage » — il se donne pour toutes les opérations, ou pour aucune']);
});

test('tablesDiff : le facteur d’une opération, en fraction', () => {
  const lignes = tablesDiff(SANS, AVEC);
  assert.equal(lignes.length, 19);
  assert.ok(lignes.includes('Opération « Tronçonnage » — facteur de vitesse : — → 1/8'));
  assert.ok(lignes.includes('Opération « Perçage » — facteur de vitesse : — → 1'));
  const change = structuredClone(AVEC);
  operation(change, 'Chanfreinage').facteur_vitesse = 0.75;
  assert.deepEqual(tablesDiff(AVEC, change), ['Opération « Chanfreinage » — facteur de vitesse : 1/4 → 0.75']);
  assert.equal(assembleData(AVEC, banque).hasSpeedFactors, true);
  assert.equal(data.hasSpeedFactors, false);
});

// --- L'outil : hériter, forcer, passer ------------------------------------------------------------------------------------

test('speedFactorState : propre à l’outil sans facteurs dans les tables ; hérité ; forcé avec sa raison', () => {
  const alesage = operation(AVEC, "Alésage à l'alésoir");
  // Avant D83 : les tables ne portent rien, le facteur de l'outil sert, comme avant.
  assert.deepEqual(speedFactorState(outil('alesoir'), operation(SANS, "Alésage à l'alésoir")), { mode: 'own', value: 0.25, reason: null, table: null });
  assert.deepEqual(speedFactorState(outil('alesoir'), undefined), { mode: 'own', value: 0.25, reason: null, table: null }); // opération inconnue
  // Hérité : sans facteur propre ; ou un ancien outil qui vaut justement celui de son opération.
  const { fact_vc: _f, ...herite } = outil('alesoir');
  assert.deepEqual(speedFactorState(herite, alesage), { mode: 'inherited', value: 0.25, reason: null, table: 0.25 });
  assert.deepEqual(speedFactorState(outil('alesoir'), alesage), { mode: 'inherited', value: 0.25, reason: null, table: 0.25 });
  // Forcé : avec sa raison, même à la valeur de la table ; un ancien outil qui diffère reçoit la raison du passage.
  const force = { ...herite, fact_vc: 1, fact_vc_raison: ' alésoir au carbure ' };
  assert.deepEqual(speedFactorState(force, alesage), { mode: 'forced', value: 1, reason: 'alésoir au carbure', table: 0.25 });
  assert.deepEqual(speedFactorState({ ...force, fact_vc: 0.25 }, alesage), { mode: 'forced', value: 0.25, reason: 'alésoir au carbure', table: 0.25 });
  assert.deepEqual(speedFactorState(outil('nine9_90_degres'), operation(AVEC, 'Chanfreinage')), { mode: 'forced', value: 1, reason: PASSAGE_REASON, table: 0.25 });
  assert.equal(PASSAGE_REASON, "Valeur reprise de l'ancien outil — à vérifier");
  assert.deepEqual([speedFactorOf(herite, alesage), speedFactorOf(force, alesage), speedFactorOf(outil('alesoir'), operation(SANS, "Alésage à l'alésoir"))], [0.25, 1, 0.25]);
});

test('passage des outils de la semence (D83, point 5) : tous héritent, sauf Nine9 90° et l’outil à chambrer, forcés à × 1 sous Chanfreinage', () => {
  const ops = parNom(AVEC);
  const passes = banque.map((t) => adoptSpeedFactor(t, ops.get(t.operation)));
  const forces = passes.filter((t) => t.fact_vc !== undefined);
  assert.deepEqual(forces.map((t) => [t.id, t.operation, t.fact_vc, t.fact_vc_raison]), [
    ['nine9_90_degres', 'Chanfreinage', 1, PASSAGE_REASON],
    ['outil_a_chambrer', 'Chanfreinage', 1, PASSAGE_REASON],
  ]);
  assert.deepEqual(forces.map((t) => forcedFactorLine(t, ops.get(t.operation))), [
    "Nine9 90 degrés (nine9_90_degres) — facteur de vitesse forcé : × 1 au lieu de × 1/4 (Chanfreinage) — « Valeur reprise de l'ancien outil — à vérifier »",
    "Outil à chambrer (outil_a_chambrer) — facteur de vitesse forcé : × 1 au lieu de × 1/4 (Chanfreinage) — « Valeur reprise de l'ancien outil — à vérifier »",
  ]);
  // Les 27 autres héritent : plus de facteur propre, et le facteur qui sert est resté le même — rien ne change en silence.
  assert.equal(passes.filter((t) => t.fact_vc === undefined).length, 27);
  for (const [i, t] of passes.entries()) {
    assert.equal(speedFactorOf(t, ops.get(t.operation)), banque[i].fact_vc, t.id);
    assert.equal('fact_vc_raison' in t, t.fact_vc !== undefined, t.id);
    const { fact_vc: _a, fact_vc_raison: _b, ...apres } = t;
    const { fact_vc: _c, ...avant } = banque[i];
    assert.deepEqual(apres, avant, `${t.id} : rien d'autre ne change`);
  }
  // Les clés du facteur restent à leur place, la raison juste après le facteur.
  const cles = Object.keys(passes.find((t) => t.id === 'nine9_90_degres'));
  assert.deepEqual(cles.slice(cles.indexOf('operation'), cles.indexOf('operation') + 4), ['operation', 'fact_vc', 'fact_vc_raison', 'fact_av']);
  assert.deepEqual(Object.keys(passes[0]), Object.keys(banque[0]).filter((cle) => cle !== 'fact_vc'));
});

test('adoptSpeedFactor : sans effet sur des tables sans facteurs, une opération inconnue, un outil déjà hérité ou déjà forcé ; deux fois = une fois', () => {
  const ops = parNom(AVEC);
  const alesoir = outil('alesoir');
  assert.equal(adoptSpeedFactor(alesoir, operation(SANS, "Alésage à l'alésoir")), alesoir);
  assert.equal(adoptSpeedFactor(alesoir, undefined), alesoir);
  const herite = adoptSpeedFactor(alesoir, ops.get(alesoir.operation));
  assert.equal(adoptSpeedFactor(herite, ops.get(alesoir.operation)), herite);
  const force = adoptSpeedFactor(outil('nine9_90_degres'), ops.get('Chanfreinage'));
  assert.equal(adoptSpeedFactor(force, ops.get('Chanfreinage')), force);
  assert.equal(alesoir.fact_vc, 0.25, 'l’outil reçu n’est pas modifié');
  // Une raison présente mais vide n'est pas un ancien outil : c'est un forçage incomplet, laissé à la validation.
  const incomplet = { ...outil('nine9_90_degres'), fact_vc_raison: '' };
  assert.equal(adoptSpeedFactor(incomplet, ops.get('Chanfreinage')), incomplet);
  assert.match(toolErrors(incomplet, ops, groupes)[0].message, /Un facteur forcé exige une raison courte/);
  // Un outil hérité suit sa table ; un outil forcé garde sa valeur.
  const autre = { ...ops.get('Chanfreinage'), facteur_vitesse: 0.5 };
  const fraise = adoptSpeedFactor(outil('fraise_82_degres'), ops.get('Chanfreinage'));
  assert.deepEqual([speedFactorOf(fraise, ops.get('Chanfreinage')), speedFactorOf(fraise, autre), speedFactorOf(force, autre)], [0.25, 0.5, 1]);
});

test('adoptSpeedFactors : chaque copie d’un contenu d’exercice fait le passage ; un contenu déjà passé est rendu tel quel', async () => {
  const brouillon = draftFromExercise(await lireFichier('exercices/test-complet.json'), banque);
  const passe = adoptSpeedFactors(brouillon, AVEC);
  assert.deepEqual(passe.outils.filter((c) => c.fact_vc !== undefined).map((c) => c.id), ['nine9_90_degres', 'outil_a_chambrer']);
  assert.deepEqual([passe.titre, passe.champs_evalues, passe.outils.length, passe.outils[0].reussites_requises, passe.outils[0].origine], [brouillon.titre, brouillon.champs_evalues, 29, 1, 'foret_fractionnaire']);
  assert.equal(adoptSpeedFactors(passe, AVEC), passe);
  assert.equal(adoptSpeedFactors(brouillon, SANS), brouillon);
  assert.equal(brouillon.outils[7].fact_vc, 0.25);
  assert.deepEqual(draftErrors(passe, AVEC), []);
  assert.deepEqual(draftErrors(brouillon, AVEC), [], 'un ancien contenu reste valide avec des tables qui portent les facteurs');
});

test('settleSpeedFactor : une copie ajoutée à un exercice prend le facteur que les tables de l’exercice veulent', () => {
  const avec = parNom(AVEC);
  const sans = parNom(SANS);
  const herite = adoptSpeedFactor(outil('alesoir'), avec.get("Alésage à l'alésoir"));
  const force = { ...herite, fact_vc: 1, fact_vc_raison: 'alésoir au carbure' };
  // Vers des tables qui portent les facteurs : le passage.
  assert.deepEqual(settleSpeedFactor(outil('alesoir'), avec.get("Alésage à l'alésoir")), herite);
  assert.equal(settleSpeedFactor(force, avec.get("Alésage à l'alésoir")), force);
  // Vers des tables sans facteurs : l'outil porte son facteur, celui de son opération d'origine s'il héritait ; sans raison.
  assert.deepEqual(settleSpeedFactor(herite, sans.get("Alésage à l'alésoir"), avec.get("Alésage à l'alésoir")), outil('alesoir'));
  assert.deepEqual(settleSpeedFactor(force, sans.get("Alésage à l'alésoir"), avec.get("Alésage à l'alésoir")), { ...outil('alesoir'), fact_vc: 1 });
  assert.deepEqual(toolErrors(settleSpeedFactor(herite, sans.get("Alésage à l'alésoir"), avec.get("Alésage à l'alésoir")), sans, groupes), []);
  assert.equal(settleSpeedFactor(outil('alesoir'), sans.get("Alésage à l'alésoir"), avec.get("Alésage à l'alésoir")).fact_vc, 0.25); // déjà à son format : tel quel
});

test('settleSpeedFactors : un contenu d’exercice qui change de tables, dans les deux sens, retrouve ses facteurs', async () => {
  const brouillon = draftFromExercise(await lireFichier('exercices/test-complet.json'), banque);
  const passe = settleSpeedFactors(brouillon, AVEC, SANS);
  assert.deepEqual(passe, adoptSpeedFactors(brouillon, AVEC));
  // Le retour : chaque copie retrouve son facteur propre — celui de sa table pour un outil hérité, le sien pour un
  // outil forcé —, sans raison ; le contenu est celui du départ.
  assert.deepEqual(settleSpeedFactors(passe, SANS, AVEC), brouillon);
  assert.equal(settleSpeedFactors(brouillon, SANS, SANS), brouillon);
  assert.equal(settleSpeedFactors(passe, AVEC, AVEC), passe);
});

test('toolErrors : le facteur est exigé de l’outil sans facteurs dans les tables, facultatif sinon ; forcer exige la valeur et la raison', () => {
  const avec = parNom(AVEC);
  const sans = parNom(SANS);
  const champs = (t, ops) => toolErrors(t, ops, groupes).map((e) => `${e.champ} : ${e.message}`);
  const { fact_vc: _f, ...herite } = outil('alesoir');
  assert.deepEqual(champs(outil('alesoir'), sans), []);
  assert.deepEqual(champs(herite, avec), []);
  assert.deepEqual(champs(outil('alesoir'), avec), [], 'un ancien outil passe');
  assert.deepEqual(champs({ ...herite, fact_vc: 1, fact_vc_raison: 'alésoir au carbure' }, avec), []);
  assert.deepEqual(champs(herite, sans), ['fact_vc : « fact_vc » doit être un nombre > 0']);
  assert.deepEqual(champs({ ...herite, fact_vc: 0 }, avec), ['fact_vc : « fact_vc » doit être un nombre > 0']);
  assert.deepEqual(champs({ ...herite, fact_vc: '1/4', fact_vc_raison: 'x' }, avec), ['fact_vc : « fact_vc » doit être un nombre > 0']);
  assert.deepEqual(champs({ ...herite, fact_vc: 1, fact_vc_raison: '  ' }, avec), ['fact_vc_raison : Un facteur forcé exige une raison courte (elle est montrée à l’étudiant).']);
  assert.deepEqual(champs({ ...herite, fact_vc: 1, fact_vc_raison: 'x'.repeat(REASON_MAX + 1) }, avec), [`fact_vc_raison : La raison a ${REASON_MAX + 1} caractères (au plus ${REASON_MAX}).`]);
  assert.deepEqual(champs({ ...herite, fact_vc: 1, fact_vc_raison: 'x'.repeat(REASON_MAX) }, avec), []);
  assert.match(champs({ ...herite, fact_vc_raison: 'sans valeur' }, avec)[0], /^fact_vc_raison : « fact_vc_raison » est la raison d'un facteur forcé/);
  assert.match(champs({ ...outil('alesoir'), fact_vc_raison: 'raison' }, sans)[0], /^fact_vc_raison : « fact_vc_raison » n'a de sens qu'avec des tables qui portent les facteurs/);
});

// --- Le calcul --------------------------------------------------------------------------------------------------------

test('computeParameters : N avec le facteur hérité de l’opération, avec le facteur forcé, et comme avant sans facteurs dans les tables', () => {
  const ops = parNom(AVEC);
  const alesoir = outil('alesoir');
  const herite = adoptSpeedFactor(alesoir, ops.get(alesoir.operation));
  const force = { ...herite, fact_vc: 1, fact_vc_raison: 'alésoir au carbure' };
  const tirer = (catalogue) => generateQuestion(catalogue, [catalogue.outils[0]], () => 0.5);
  const n = (tables, t) => {
    const catalogue = assembleData(tables, [t]);
    const question = tirer(catalogue);
    const attendu = computeParameters(question, catalogue);
    return attendu.rpmRaw / (attendu.vc * 4 / question.dimension.diameter);
  };
  assert.deepEqual([n(SANS, alesoir), n(AVEC, alesoir), n(AVEC, herite), n(AVEC, force)].map((f) => Number(f.toPrecision(12))), [0.25, 0.25, 0.25, 1]);
  // La table change : l'outil hérité la suit, l'outil forcé non, l'ancien outil devient forcé (il garde sa valeur).
  const autre = structuredClone(AVEC);
  operation(autre, alesoir.operation).facteur_vitesse = 0.5;
  assert.deepEqual([n(autre, herite), n(autre, force), n(autre, alesoir)].map((f) => Number(f.toPrecision(12))), [0.5, 1, 0.25]);
});

// --- L'exercice : le facteur donné, ou à trouver ---------------------------------------------------------------------------

test('« facteur_vitesse_donne » : un réglage de l’exercice, versionné ; true, false ou absent', async () => {
  const fichier = await lireFichier('exercices/m10-tournage-vc.json');
  const brouillon = draftFromExercise(fichier, banque);
  assert.equal('facteur_vitesse_donne' in brouillon, false, 'décoché par défaut');
  assert.deepEqual(draftErrors({ ...brouillon, facteur_vitesse_donne: true }, AVEC), []);
  assert.deepEqual(draftErrors({ ...brouillon, facteur_vitesse_donne: false }, SANS), []);
  assert.deepEqual(draftErrors({ ...brouillon, facteur_vitesse_donne: 'oui' }, AVEC), [{ champ: 'facteur_vitesse_donne', message: '« facteur_vitesse_donne » doit être true ou false (ou absent : le facteur est à trouver)' }]);
  assert.deepEqual(validateExercise({ ...fichier, facteur_vitesse_donne: true }, data), []);
  assert.match(validateExercise({ ...fichier, facteur_vitesse_donne: 1 }, data)[0], /« facteur_vitesse_donne » doit être true ou false/);
  assert.equal(draftFromExercise({ ...fichier, facteur_vitesse_donne: true }, banque).facteur_vitesse_donne, true);
  assert.equal(engineExercise('x', 1, { ...brouillon, facteur_vitesse_donne: true }).exercise.facteur_vitesse_donne, true);
  assert.equal('facteur_vitesse_donne' in engineExercise('x', 1, { ...brouillon, facteur_vitesse_donne: false }).exercise, false);
  assert.equal('facteur_vitesse_donne' in engineExercise('x', 1, brouillon).exercise, false);
});

test('factorGiven, questionFactor : donné comme avant sans facteurs dans les tables ; sinon selon l’exercice ; un facteur forcé est toujours dit, avec sa raison', () => {
  const avec = operation(AVEC, "Alésage à l'alésoir");
  const sans = operation(SANS, "Alésage à l'alésoir");
  const { fact_vc: _f, ...herite } = outil('alesoir');
  const force = { ...herite, fact_vc: 1, fact_vc_raison: 'alésoir au carbure' };
  assert.deepEqual([factorGiven({}, sans), factorGiven({ facteur_vitesse_donne: false }, sans), factorGiven({}, avec), factorGiven({ facteur_vitesse_donne: true }, avec)], [true, true, false, true]);
  // Une version d'avant D83 : null — la question garde « fact_vc », comme avant.
  assert.equal(questionFactor(outil('alesoir'), sans, {}), null);
  assert.equal(questionFactor(outil('alesoir'), sans, { facteur_vitesse_donne: true }), null);
  // À trouver : ni valeur ni texte ne partent.
  assert.deepEqual(questionFactor(herite, avec, {}), { etat: 'a_trouver', texte: null, valeur: null, raison: null });
  assert.deepEqual(questionFactor(outil('alesoir'), avec, {}), { etat: 'a_trouver', texte: null, valeur: null, raison: null });
  assert.deepEqual(questionFactor(herite, avec, { facteur_vitesse_donne: true }), { etat: 'donne', texte: '1/4', valeur: 0.25, raison: null });
  // Forcé : toujours, donné ou non — sinon la feuille des facteurs piégerait l'étudiant.
  for (const exercice of [{}, { facteur_vitesse_donne: true }]) assert.deepEqual(questionFactor(force, avec, exercice), { etat: 'force', texte: '1', valeur: 1, raison: 'alésoir au carbure' });
  assert.deepEqual(questionFactor(outil('nine9_90_degres'), operation(AVEC, 'Chanfreinage'), {}), { etat: 'force', texte: '1', valeur: 1, raison: PASSAGE_REASON });
});

// --- En clair ------------------------------------------------------------------------------------------------------------

test('ownFactorLabel, tableFactorLine : le facteur d’un outil et celui de sa table, en clair', () => {
  const { fact_vc: _f, ...herite } = outil('alesoir');
  assert.equal(ownFactorLabel(herite), "hérité de l'opération");
  assert.equal(ownFactorLabel(outil('alesoir')), '× 1/4');
  assert.equal(ownFactorLabel({ ...herite, fact_vc: 1, fact_vc_raison: 'fraise à inserts de carbure' }), 'forcé × 1 (fraise à inserts de carbure)');
  assert.equal(tableFactorLine(operation(AVEC, 'Chanfreinage')), 'Selon la table : 1/4 (Chanfreinage)');
  assert.equal(tableFactorLine(operation(AVEC, 'Perçage')), 'Selon la table : 1 (Perçage)');
});
