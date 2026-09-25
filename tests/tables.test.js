// Tests de site/js/tables.js (jalon 7b, partie B, décision D61) : complétion d'une version de tables
// avec les valeurs par défaut, variables CSS des couleurs, révision suivante, différences valeur par
// valeur, contenu comparé sans commentaires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_ISO_CLASSES, DEFAULT_TOOL_MATERIALS, colorVariables, completeTables, isTablesId, nextRevision, tablesContent, tablesDiff, toolMaterialKeyMap,
} from '../site/js/tables.js';
import { TOOL_MATERIAL_KEYS, assembleTables, validateTables } from '../site/js/data.js';
import { lireFichier } from './aide.js';

const materiaux = await lireFichier('data/materiaux.json');
const operations = await lireFichier('data/operations.json');
const tables = () => structuredClone({ materiaux, operations });

test('completeTables : une version d’avant le 7b reçoit les classes ISO et les matières d’outil par défaut, sans être modifiée ; une version complète est rendue telle quelle', () => {
  const source = tables();
  const complete = completeTables(source);
  assert.equal('classes_iso' in source.materiaux, false); // l'objet reçu n'est pas touché
  assert.deepEqual(complete.materiaux.classes_iso, DEFAULT_ISO_CLASSES);
  assert.deepEqual(complete.materiaux.materiaux_outil, DEFAULT_TOOL_MATERIALS);
  assert.equal(complete.materiaux.materiaux, source.materiaux.materiaux);
  assert.equal(complete.operations, source.operations);
  const own = { materiaux: { ...materiaux, classes_iso: [{ code: 'P', nom: 'x', couleur: '#000000', couleur_texte: '#ffffff', couleur_ligne: '#eeeeee' }], materiaux_outil: [{ cle: 'acier_rapide', nom: 'HSS', couleur: '#111111' }] }, operations };
  assert.equal(completeTables(own).materiaux.classes_iso, own.materiaux.classes_iso);
  assert.deepEqual([...toolMaterialKeyMap(own.materiaux)], [['HSS', 'acier_rapide']]);
  assert.deepEqual(Object.fromEntries(toolMaterialKeyMap(materiaux)), TOOL_MATERIAL_KEYS); // par défaut, les noms d'avant
  // assembleTables : les tables seules, indexées, avec les couleurs.
  const data = assembleTables(tables());
  assert.deepEqual([data.outils, data.classesIso.length, data.toolMaterials.map((m) => m.cle), data.toolMaterialKeys.get('Acier rapide'), data.revisions.materiaux], [[], 7, ['acier_rapide', 'carbure_solide', 'insert_carbure'], 'acier_rapide', 'A2026_r0']);
});

test('validateTables : les vraies tables sont valides ; classes ISO et matières d’outil vérifiées (codes, couleurs, les trois clés, noms uniques) ; un matériau d’une classe inconnue, un pictogramme mal formé', () => {
  assert.deepEqual(validateTables(tables()), []);
  const t = tables();
  t.materiaux.classes_iso = [{ code: 'p', nom: '', couleur: 'bleu', couleur_texte: '#fff', couleur_ligne: '#c1efff' }];
  const errors = validateTables(t);
  assert.ok(errors.some((e) => /classes_iso\[0\].*« code » doit être une lettre majuscule/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /« nom » est vide/.test(e)));
  assert.ok(errors.some((e) => /« couleur » doit être une couleur « #rrggbb »/.test(e)));
  assert.ok(errors.some((e) => /« couleur_texte » doit être une couleur/.test(e)));
  assert.ok(errors.some((e) => /classe « iso » inconnue : « P » \(classes : p\)/.test(e))); // les matériaux P n'ont plus de classe
  const t2 = tables();
  t2.materiaux.materiaux_outil = [{ cle: 'acier_rapide', nom: 'HSS', couleur: '#b4c7e7' }, { cle: 'carbure_solide', nom: 'HSS', couleur: '#a6a6a6' }];
  const errors2 = validateTables(t2);
  assert.ok(errors2.some((e) => /doit porter les trois matières acier_rapide, carbure_solide, insert_carbure/.test(e)), errors2.join('\n'));
  assert.ok(errors2.some((e) => /nom de matière d'outil en double : « HSS »/.test(e)));
  const t3 = tables();
  t3.operations.operations[0].pictogramme = 'Pas Un Id';
  assert.ok(validateTables(t3).some((e) => /« pictogramme » doit être l'identifiant d'une image/.test(e)));
  t3.operations.operations[0].pictogramme = 'img-0123456789abcdef';
  assert.deepEqual(validateTables(t3), []);
});

test('colorVariables : les variables CSS de tokens.css, à partir des classes et des matières de la version en usage ; le K de nuit composé', () => {
  const variables = Object.fromEntries(colorVariables({ classesIso: DEFAULT_ISO_CLASSES, toolMaterials: DEFAULT_TOOL_MATERIALS }));
  const tokens = readFileSync(new URL('../site/css/tokens.css', import.meta.url), 'utf8');
  for (const [name, value] of Object.entries(variables)) {
    if (name === '--iso-k-night') continue;
    assert.equal(tokens.match(new RegExp(`${name}: (#[0-9a-f]{6});`))?.[1], value, name);
  }
  assert.equal(variables['--iso-k-night'], 'color-mix(in srgb, #ff0000 64%, #ffffff)'); // = #ff5c5c, la valeur de tokens.css
  assert.equal(Object.keys(variables).length, 7 * 3 + 1 + 3);
  assert.deepEqual(colorVariables({ classesIso: [{ code: 'X', couleur: '#123456', couleur_texte: '#000000', couleur_ligne: '#abcdef' }], toolMaterials: [] }), [['--iso-x', '#123456'], ['--iso-x-text', '#000000'], ['--iso-x-tint', '#abcdef']]);
});

test('nextRevision et isTablesId : « A2026_r0 » → « A2026_r1 », « H2025_r12 » → « H2025_r13 », sans suffixe → « _r1 » ; identifiants permis', () => {
  assert.equal(nextRevision('A2026_r0'), 'A2026_r1');
  assert.equal(nextRevision('H2025_r12'), 'H2025_r13');
  assert.equal(nextRevision('A2026'), 'A2026_r1');
  assert.equal(nextRevision('v2.1_r9'), 'v2.1_r10');
  assert.deepEqual(['A2026_r0', 'H2025_r1', 'v2.1', 'a', 'A2026 r1', '', '_x', 'a'.repeat(41), 'A/1'].map(isTablesId), [true, true, true, true, false, false, false, false, false]);
});

test('tablesDiff : les différences valeur par valeur — Vc, champs d’un matériau, ajouts et retraits, opérations, classes, matières d’outil, ordre ; rien si identiques', () => {
  assert.deepEqual(tablesDiff(tables(), tables()), []);
  const after = completeTables(tables());
  after.materiaux.materiaux = after.materiaux.materiaux.map((m) => (m.groupe === 1 ? { ...m, vc_pi_min: { ...m.vc_pi_min, carbure_solide: 500 }, durete: 130 } : m)).filter((m) => m.groupe !== 47);
  after.materiaux.groupes_iso = after.materiaux.groupes_iso.filter((g) => g !== 'O - Graphite');
  after.materiaux.materiaux.push({ iso: 'N', groupe: 48, materiau: 'Cuivre et alliages de cuivre', composition: 'x', etat: 'y', durete: 60, exemple: 'C110', vc_pi_min: { acier_rapide: 200, carbure_solide: 300, insert_carbure: 400 } });
  after.materiaux.classes_iso = after.materiaux.classes_iso.map((c) => (c.code === 'P' ? { ...c, couleur: '#0099cc' } : c));
  after.materiaux.materiaux_outil = after.materiaux.materiaux_outil.map((m) => (m.cle === 'acier_rapide' ? { ...m, nom: 'HSS', couleur: '#cccccc' } : m));
  after.operations.operations = after.operations.operations.map((op) => (op.operation === 'Perçage' ? { ...op, avance_po_rev: 0.008, pictogramme: 'img-0123456789abcdef' } : op));
  const lines = tablesDiff(tables(), after);
  const p1 = materiaux.materiaux.find((m) => m.groupe === 1);
  assert.deepEqual(lines, [
    'Classe P — couleur : #00b0f0 → #0099cc',
    'Matière d\'outil renommée : « Acier rapide » → « HSS »',
    'Matière d\'outil « HSS » — couleur : #b4c7e7 → #cccccc',
    `Acier non allié (groupe 1) — dureté : ${p1.durete} → 130`,
    `Acier non allié (groupe 1), Carbure de tungstène solide : ${p1.vc_pi_min.carbure_solide} → 500 pi/min`,
    'Matériau ajouté : N — Cuivre et alliages de cuivre (groupe 48)',
    'Matériau retiré : O — Graphite (groupe 47)',
    'Opération « Perçage » — avance (po/rév) : 0.006 → 0.008',
    'Opération « Perçage » — pictogramme : — → img-0123456789abcdef',
  ]);
  const reordered = tables();
  [reordered.operations.operations[0], reordered.operations.operations[1]] = [reordered.operations.operations[1], reordered.operations.operations[0]];
  assert.deepEqual(tablesDiff(tables(), reordered), ["L'ordre des opérations a changé."]);
  const ops = tables();
  ops.operations.operations.push({ ...operations.operations[0], operation: 'Lamage' });
  ops.operations.operations.splice(0, 1);
  assert.deepEqual(tablesDiff(tables(), ops), ['Opération ajoutée : Lamage', `Opération retirée : ${operations.operations[0].operation}`]);
  // tablesContent : les commentaires « _… » ne comptent pas.
  assert.deepEqual(Object.keys(tablesContent(tables()).materiaux), ['groupes_iso', 'materiaux']); // ni les commentaires, ni la révision
});
