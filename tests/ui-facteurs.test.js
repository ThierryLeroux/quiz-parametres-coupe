// Tests de ce que l'étudiant voit du facteur de vitesse (décision D83) : la 4e feuille (sheets-data.js), la ligne du
// facteur dans le panneau de l'outil et l'aide contextuelle de N (rules.js). Fonctions pures, sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { assembleData, assembleTables } from '../site/js/data.js';
import { PASSAGE_REASON, prefillSpeedFactors } from '../site/js/facteur-vitesse.js';
import { factorLines, helpLine } from '../site/js/ui/rules.js';
import { FACTOR_FORMULA, FACTOR_SHEET_TITLE, feedSheet, sheetTabs, speedFactorSheet } from '../site/js/ui/sheets-data.js';
import { data, lireFichier } from './aide.js';

const SANS = { materiaux: await lireFichier('data/materiaux.json'), operations: await lireFichier('data/operations.json') };
const AVEC = prefillSpeedFactors(SANS);
const banque = (await lireFichier('data/outils.json')).outils;
const avec = assembleTables(AVEC); // le catalogue d'une version qui porte les facteurs
const texte = (aide) => aide.parts.map((part) => part.text).join('');

// --- La 4e feuille ---------------------------------------------------------------------------------------------------------

test('speedFactorSheet : aucune feuille pour des tables sans facteurs ; les onglets n’en montrent une 4e, après Formules, que pour des tables qui les portent', () => {
  assert.equal(speedFactorSheet(data), null);
  assert.equal(speedFactorSheet(assembleTables(SANS)), null);
  assert.deepEqual(sheetTabs(data).map((tab) => tab.id), ['vc', 'avances', 'formules']);
  assert.deepEqual(sheetTabs(avec), [
    { id: 'vc', label: 'Vitesses de coupe' }, { id: 'avances', label: 'Avances' }, { id: 'formules', label: 'Formules' }, { id: 'facteurs', label: 'Facteurs de vitesse' },
  ]);
  assert.deepEqual(sheetTabs(null).map((tab) => tab.id), ['vc', 'avances', 'formules']);
});

test('speedFactorSheet : une ligne par opération des tables, regroupées par machine comme sur la feuille des avances ; le facteur en fraction ; les lignes réduites marquées', () => {
  const feuille = speedFactorSheet(avec);
  assert.equal(feuille.title, "Modification de la vitesse de rotation selon l'opération");
  assert.deepEqual([feuille.title, feuille.formula], [FACTOR_SHEET_TITLE, FACTOR_FORMULA]);
  assert.equal(feuille.formula, 'N = Vc × 4 / Ø × facteur');
  assert.equal(feuille.revision, 'A2026_r0');
  // Les mêmes opérations, dans le même ordre et sous les mêmes machines que la feuille des avances, avec le même pictogramme.
  const avances = feedSheet(avec);
  assert.deepEqual(feuille.rows.map((row) => [row.operation, row.picto]), avances.rows.map((row) => [row.operation, row.picto]));
  assert.deepEqual(feuille.machines, avances.machines);
  assert.deepEqual(feuille.machines, [{ key: 'Fraiseuse', start: 0, span: 4 }, { key: 'Perceuse / Fraiseuse', start: 4, span: 5 }, { key: 'Tour', start: 9, span: 10 }]);
  // La table papier : 1, 1/4, 1/8 ; les lignes réduites ressortent, celles à 1 restent sobres.
  assert.deepEqual(feuille.rows.map((row) => [row.operation, row.factor, row.marked]), [
    ['Contournage ébauche', '1', false], ['Contournage finition', '1', false], ['Surfaçage', '1', false], ['Chanfreinage / ébavurage', '1/4', true],
    ['Perçage', '1', false], ['Chanfreinage', '1/4', true], ["Alésage à l'alésoir", '1/4', true], ['Pointage', '1', false], ['Taraudage', '1', false],
    ['Filetage externe', '1', false], ['Filetage interne', '1', false], ['Chariotage ébauche', '1', false], ['Chariotage finition', '1', false], ['Centrage', '1', false],
    ['Alésage à la barre', '1', false], ['Dressage', '1', false], ['Tronçonnage', '1/8', true], ['Rainurage externe', '1/4', true], ['Rainurage interne', '1/4', true],
  ]);
  assert.equal(feuille.rows[4].picto, '/images/percage');
});

test('speedFactorSheet : tout vient des tables — une opération ajoutée, un facteur hors de la forme 1/n, un pictogramme choisi, la révision', () => {
  const tables = structuredClone(AVEC);
  tables.operations.revision = 'A2026_r3';
  tables.operations.operations.splice(9, 0, { operation: 'Chambrage', machine: 'Perceuse / Fraiseuse', direction_avance: 'Avance axiale', avance_po_rev: 0.003, avance_max_po_rev: 0.003, avance_egale_pas_filetage: false, avance_proportionnelle_diametre: false, facteur_vitesse: 0.25, pictogramme: 'img-0123456789abcdef' });
  tables.operations.operations.find((op) => op.operation === 'Surfaçage').facteur_vitesse = 0.75;
  tables.operations.operations.find((op) => op.operation === 'Dressage').facteur_vitesse = 1.5;
  const feuille = speedFactorSheet(assembleTables(tables));
  assert.equal(feuille.rows.length, 20);
  assert.deepEqual(feuille.rows[9], { operation: 'Chambrage', picto: '/images/img-0123456789abcdef', factor: '1/4', marked: true });
  assert.deepEqual(feuille.rows.filter((row) => ['Surfaçage', 'Dressage'].includes(row.operation)).map((row) => [row.factor, row.marked]), [['0.75', true], ['1.5', true]]);
  assert.deepEqual(feuille.machines[1], { key: 'Perceuse / Fraiseuse', start: 4, span: 6 });
  assert.equal(feuille.revision, 'A2026_r3');
  // Le catalogue d'un exercice (assembleData) la donne aussi : c'est celui de l'écran Question.
  assert.equal(speedFactorSheet(assembleData(tables, banque.filter((outil) => outil.operation === 'Perçage'))).rows.length, 20);
});

test('la miniature de la feuille des facteurs, pour la feuille des formules, est dans le dépôt', () => {
  assert.ok(existsSync(new URL('../site/img/pictos/miniatures/table-facteurs.svg', import.meta.url)));
});

// --- Le panneau de l'outil -------------------------------------------------------------------------------------------------

test('factorLines : à trouver, rien ; donné, la ligne d’avant en fraction ; forcé, toujours, avec sa raison ; une version d’avant, la ligne d’avant', () => {
  const outil = (facteur) => ({ facteur_vitesse: facteur, fact_av: 1 });
  assert.deepEqual(factorLines(outil({ etat: 'a_trouver', texte: null, valeur: null, raison: null })), []);
  assert.deepEqual(factorLines(outil({ etat: 'donne', texte: '1/4', valeur: 0.25, raison: null })), ['Vitesse réduite × 1/4']);
  assert.deepEqual(factorLines(outil({ etat: 'donne', texte: '1/8', valeur: 0.125, raison: null })), ['Vitesse réduite × 1/8']);
  assert.deepEqual(factorLines(outil({ etat: 'donne', texte: '1.5', valeur: 1.5, raison: null })), ['Vitesse augmentée × 1.5']);
  assert.deepEqual(factorLines(outil({ etat: 'donne', texte: '1', valeur: 1, raison: null })), []);
  // Forcé : même à 1, même quand l'exercice fait trouver le facteur — sinon la feuille piégerait l'étudiant.
  assert.deepEqual(factorLines(outil({ etat: 'force', texte: '1', valeur: 1, raison: 'fraise à inserts de carbure' })), ['Facteur propre à cet outil : × 1 — fraise à inserts de carbure']);
  assert.deepEqual(factorLines(outil({ etat: 'force', texte: '1/2', valeur: 0.5, raison: PASSAGE_REASON })), ["Facteur propre à cet outil : × 1/2 — Valeur reprise de l'ancien outil — à vérifier"]);
  // Le facteur d'avance ne change pas : propre à chaque outil, à la suite.
  assert.deepEqual(factorLines({ facteur_vitesse: { etat: 'a_trouver', texte: null, valeur: null, raison: null }, fact_av: 1.5 }), ['Avance augmentée × 1.5']);
  assert.deepEqual(factorLines({ facteur_vitesse: { etat: 'force', texte: '1', valeur: 1, raison: 'x' }, fact_av: 0.5 }), ['Facteur propre à cet outil : × 1 — x', 'Avance réduite × 0.5']);
  // Une version d'avant D83 : « fact_vc », en décimal, comme avant.
  assert.deepEqual(factorLines({ fact_vc: 0.25, fact_av: 1 }), ['Vitesse réduite × 0.25']);
  assert.deepEqual(factorLines({ fact_vc: 1, fact_av: 1 }), []);
});

// --- L'aide contextuelle de N ------------------------------------------------------------------------------------------------

test('aide de N : le facteur à trouver — la méthode seulement, jamais la valeur, et le bouton ouvre la feuille des facteurs', () => {
  const question = { outil: { id: 'alesoir', nom: 'Alésoir', facteur_vitesse: { etat: 'a_trouver', texte: null, valeur: null, raison: null }, fact_av: 1 } };
  const aide = helpLine('rpm', question, 'proportional');
  assert.equal(texte(aide), "Vitesse de rotation → N = Vc × 4 / Ø × le facteur de l'opération (feuille Facteurs de vitesse), plafonnée à la vitesse de rotation max de la machine.");
  assert.equal(aide.table, 'facteurs');
  assert.doesNotMatch(texte(aide), /\d\/\d|0\.\d/);
  // Avec un outil à deux diamètres, et une dimension métrique : la même aide, avec leurs précisions.
  const barre = helpLine('rpm', { outil: { ...question.outil, barre: '1/2 po' } }, 'proportional', true);
  assert.equal(texte(barre), "Vitesse de rotation → N = Vc × 4 / Ø usiné (le trou, pas la barre) × le facteur de l'opération (feuille Facteurs de vitesse), plafonnée à la vitesse de rotation max de la machine. Le Ø se met en pouces : mm / 25.4.");
  // Les autres aides ne changent pas, et gardent leur table.
  assert.equal(helpLine('vc', question, 'proportional').table, 'vc');
  assert.equal(helpLine('feedPerTooth', question, 'proportional').table, 'avances');
  assert.equal(helpLine('feedRate', question, 'proportional').table, null);
});

test('aide de N : le facteur donné, comme avant, en fraction ; forcé, celui de l’outil, sans renvoi à la feuille ; une version d’avant, l’aide d’avant', () => {
  const avecFacteur = (facteur) => ({ outil: { id: 'alesoir', facteur_vitesse: facteur, fact_av: 1 } });
  const donne = helpLine('rpm', avecFacteur({ etat: 'donne', texte: '1/4', valeur: 0.25, raison: null }), 'fixed');
  assert.equal(texte(donne), 'Vitesse de rotation → N = Vc × 4 / Ø, plafonnée à la vitesse de rotation max de la machine, × 1/4 pour cet outil.');
  assert.equal(donne.table, null);
  assert.equal(texte(helpLine('rpm', avecFacteur({ etat: 'donne', texte: '1', valeur: 1, raison: null }), 'fixed')), 'Vitesse de rotation → N = Vc × 4 / Ø, plafonnée à la vitesse de rotation max de la machine.');
  const force = helpLine('rpm', avecFacteur({ etat: 'force', texte: '1', valeur: 1, raison: 'fraise à inserts de carbure' }), 'fixed');
  assert.equal(texte(force), 'Vitesse de rotation → N = Vc × 4 / Ø × 1 (le facteur propre à cet outil, pas celui de la feuille), plafonnée à la vitesse de rotation max de la machine.');
  assert.equal(force.table, null);
  assert.equal(texte(helpLine('rpm', { outil: { fact_vc: 0.25, fact_av: 1 } }, 'fixed')), 'Vitesse de rotation → N = Vc × 4 / Ø, plafonnée à la vitesse de rotation max de la machine, × 0.25 pour cet outil.');
});
