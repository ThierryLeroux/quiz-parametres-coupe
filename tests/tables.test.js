// Tests de site/js/tables.js (jalon 7b, partie B, décision D61) : complétion d'une version de tables
// avec les valeurs par défaut, variables CSS des couleurs, révision suivante, différences valeur par
// valeur, contenu comparé sans commentaires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_CHARACTERISTICS, DEFAULT_ISO_CLASSES, DEFAULT_TOOL_MATERIALS, characteristicsErrors, colorVariables, completeTables, isTablesId, isoClassOf, nextRevision, tablesContent, tablesDiff, toolMaterialKeyMap,
} from '../site/js/tables.js';
import { TOOL_MATERIAL_KEYS, assembleTables, validateTables } from '../site/js/data.js';
import { lireFichier } from './aide.js';

const materiaux = await lireFichier('data/materiaux.json');
const operations = await lireFichier('data/operations.json');
const tables = () => structuredClone({ materiaux, operations });

test('completeTables : une version d’avant le 7b reçoit les classes ISO et les matières d’outil par défaut, sans être modifiée ; une classe sans ses images (d’avant D64) reçoit celles de la semence, null reste null', () => {
  const source = tables();
  const complete = completeTables(source);
  assert.equal('classes_iso' in source.materiaux, false); // l'objet reçu n'est pas touché
  assert.deepEqual(complete.materiaux.classes_iso, DEFAULT_ISO_CLASSES);
  assert.deepEqual(complete.materiaux.materiaux_outil, DEFAULT_TOOL_MATERIALS);
  assert.equal(complete.materiaux.materiaux, source.materiaux.materiaux);
  assert.equal(complete.operations, source.operations);
  // Les images des classes (D64) : P à H ont les deux de la semence, O aucune.
  assert.deepEqual(DEFAULT_ISO_CLASSES.map((c) => [c.code, c.image_chaleur, c.image_copeaux]), [
    ['P', 'copeaux-p-chaleur', 'copeaux-p-copeaux'], ['M', 'copeaux-m-chaleur', 'copeaux-m-copeaux'], ['K', 'copeaux-k-chaleur', 'copeaux-k-copeaux'],
    ['N', 'copeaux-n-chaleur', 'copeaux-n-copeaux'], ['S', 'copeaux-s-chaleur', 'copeaux-s-copeaux'], ['H', 'copeaux-h-chaleur', 'copeaux-h-copeaux'], ['O', null, null],
  ]);
  const own = { materiaux: { ...materiaux, classes_iso: [{ code: 'P', nom: 'x', couleur: '#000000', couleur_texte: '#ffffff', couleur_ligne: '#eeeeee' }, { code: 'K', nom: 'k', couleur: '#000000', couleur_texte: '#ffffff', couleur_ligne: '#eeeeee', image_chaleur: null, image_copeaux: 'img-0123456789abcdef', caracteristiques: [] }, { code: 'X', nom: 'x', couleur: '#000000', couleur_texte: '#ffffff', couleur_ligne: '#eeeeee' }], materiaux_outil: [{ cle: 'acier_rapide', nom: 'HSS', couleur: '#111111' }] }, operations };
  const ownComplete = completeTables(own).materiaux.classes_iso;
  assert.deepEqual(ownComplete, [
    { ...own.materiaux.classes_iso[0], image_chaleur: 'copeaux-p-chaleur', image_copeaux: 'copeaux-p-copeaux', caracteristiques: DEFAULT_CHARACTERISTICS.P }, // d'avant D64 : les images et caractéristiques par défaut
    own.materiaux.classes_iso[1], // null = aucune image, gardé ; l'autre gardée ; [] = aucune caractéristique, gardé
    { ...own.materiaux.classes_iso[2], image_chaleur: null, image_copeaux: null, caracteristiques: [] }, // une lettre sans semence
  ]);
  assert.equal('image_chaleur' in own.materiaux.classes_iso[0], false); // l'objet reçu n'est pas touché
  assert.deepEqual(isoClassOf(own.materiaux.classes_iso, 'K'), own.materiaux.classes_iso[1]);
  assert.equal(isoClassOf(own.materiaux.classes_iso, 'P').image_copeaux, 'copeaux-p-copeaux');
  assert.equal(isoClassOf(own.materiaux.classes_iso, 'Z'), null);
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
  // Les images d'une classe (D64) : un identifiant d'image, null (aucune) ou absente ; autre chose est une erreur.
  const t4 = tables();
  t4.materiaux.classes_iso = DEFAULT_ISO_CLASSES.map((c) => (c.code === 'P' ? { ...c, image_chaleur: 'Pas Un Id', image_copeaux: null } : c));
  assert.deepEqual(validateTables(t4), ["classes_iso[0] (P) : « image_chaleur » doit être l'identifiant d'une image (ou null)"]);
  t4.materiaux.classes_iso[0].image_chaleur = 'img-0123456789abcdef';
  assert.deepEqual(validateTables(t4), []);
  // Avec les fiches des images (l'éditeur) : une image de classe archivée ou inconnue est une erreur nommée ; sans elles, non.
  const fiches = DEFAULT_ISO_CLASSES.flatMap((c) => [c.image_chaleur, c.image_copeaux]).filter(Boolean)
    .filter((id) => id !== 'copeaux-k-chaleur').map((id) => ({ id, archivee_le: id === 'copeaux-p-copeaux' ? '2026-09-26T13:00:00.000Z' : null }));
  const t5 = tables();
  t5.materiaux.classes_iso = structuredClone(DEFAULT_ISO_CLASSES);
  assert.deepEqual(validateTables(t5), []);
  assert.deepEqual(validateTables(t5, { images: fiches }), [
    "classes_iso[0] (P) : « image_copeaux » : l'image « copeaux-p-copeaux » est archivée (choisis-en une autre, ou rétablis-la dans l'onglet Images)",
    "classes_iso[2] (K) : « image_chaleur » : l'image « copeaux-k-chaleur » est inconnue",
  ]);
  t5.materiaux.classes_iso[0].image_copeaux = null;
  t5.materiaux.classes_iso[2].image_chaleur = 'copeaux-p-chaleur';
  assert.deepEqual(validateTables(t5, { images: fiches }), []);
  assert.deepEqual(validateTables(tables(), { images: [] }), [
    ...['P', 'M', 'K', 'N', 'S', 'H'].flatMap((code, i) => ['image_chaleur', 'image_copeaux'].map((key) => `classes_iso[${i}] (${code}) : « ${key} » : l'image « copeaux-${code.toLowerCase()}-${key.slice(6)} » est inconnue`)),
  ]); // une version d'avant D64, complétée, nomme les images de la semence : sans elles en base, chacune manque
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
  after.materiaux.classes_iso = after.materiaux.classes_iso.map((c) => (c.code === 'P' ? { ...c, couleur: '#0099cc', image_chaleur: null, image_copeaux: 'img-0123456789abcdef' } : c));
  after.materiaux.materiaux_outil = after.materiaux.materiaux_outil.map((m) => (m.cle === 'acier_rapide' ? { ...m, nom: 'HSS', couleur: '#cccccc' } : m));
  after.operations.operations = after.operations.operations.map((op) => (op.operation === 'Perçage' ? { ...op, avance_po_rev: 0.008, pictogramme: 'img-0123456789abcdef' } : op));
  const lines = tablesDiff(tables(), after);
  const p1 = materiaux.materiaux.find((m) => m.groupe === 1);
  assert.deepEqual(lines, [
    'Classe P — couleur : #00b0f0 → #0099cc',
    'Classe P — image de chaleur : copeaux-p-chaleur → —',
    'Classe P — image de copeaux : copeaux-p-copeaux → img-0123456789abcdef',
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

test('caractéristiques d’une classe (D65) : quatre lignes par défaut pour P à H (Effort, Chaleur, Copeaux, Problème typique avec sa solution), aucune pour O ; validation ; différences', () => {
  for (const code of ['P', 'M', 'K', 'N', 'S', 'H']) {
    const lines = DEFAULT_ISO_CLASSES.find((c) => c.code === code).caracteristiques;
    assert.deepEqual(lines.map((l) => l.libelle), ['Effort', 'Chaleur', 'Copeaux', 'Problème typique'], code);
    assert.deepEqual(lines.map((l) => 'solution' in l), [false, false, false, true], code);
    assert.deepEqual(characteristicsErrors(lines), [], code);
  }
  assert.deepEqual(DEFAULT_ISO_CLASSES.find((c) => c.code === 'O').caracteristiques, []);
  assert.deepEqual(DEFAULT_CHARACTERISTICS.M[3], { libelle: 'Problème typique', texte: 'écrouissage', solution: 'ne pas frotter, garder avance et profondeur suffisantes' });
  // Le caractère → du message n'est qu'un séparateur : il n'est dans aucun texte.
  assert.ok(Object.values(DEFAULT_CHARACTERISTICS).flat().every((l) => !`${l.texte}${l.solution ?? ''}`.includes('→')));
  // Validation : libellé et texte obligatoires, solution facultative non vide, 90 caractères au plus, clé inconnue, doublon, six lignes au plus.
  assert.deepEqual(characteristicsErrors(undefined), []);
  assert.deepEqual(characteristicsErrors('x'), ['« caracteristiques » doit être une liste (ou être absente)']);
  assert.deepEqual(characteristicsErrors([
    { libelle: '', texte: 'a' },
    { libelle: 'Effort', texte: 'b', solution: 'x'.repeat(91) },
    { libelle: 'Effort', texte: 'c', solution: ' ', note: 1 },
  ]), [
    'caractéristique 1 : « libelle » est vide',
    'caractéristique 2 : « solution » a 91 caractères (au plus 90)',
    'caractéristique 3 : clé inconnue « note »',
    "caractéristique 3 : « solution » est vide (l'omettre s'il n'y en a pas)",
    'libellé de caractéristique en double : « Effort »',
  ]);
  assert.deepEqual(characteristicsErrors([{ libelle: 'a', texte: 'x'.repeat(90), solution: 'y'.repeat(90) }]), []);
  assert.match(characteristicsErrors(Array.from({ length: 7 }, (_, i) => ({ libelle: `l${i}`, texte: 't' })))[0], /au plus 6 caractéristiques/);
  const t = tables();
  t.materiaux.classes_iso = structuredClone(DEFAULT_ISO_CLASSES);
  t.materiaux.classes_iso[1].caracteristiques[3].solution = 'x'.repeat(91);
  assert.deepEqual(validateTables(t), ['classes_iso[1] (M) : caractéristique 4 : « solution » a 91 caractères (au plus 90)']);
  // Différences : texte, solution ajoutée, retirée, changée, ligne ajoutée, retirée, ordre.
  const after = completeTables(tables());
  const p = after.materiaux.classes_iso[0].caracteristiques;
  p[0] = { libelle: 'Effort', texte: 'moyen à élevé', solution: 'plaquette robuste' };
  p[3] = { libelle: 'Problème typique', texte: 'usure en cratère à Vc élevée' };
  const m = after.materiaux.classes_iso[1].caracteristiques;
  m[3] = { ...m[3], solution: 'avance suffisante' };
  after.materiaux.classes_iso[2].caracteristiques.splice(1, 1);
  after.materiaux.classes_iso[3].caracteristiques.push({ libelle: 'Arrosage', texte: 'abondant' });
  const s = after.materiaux.classes_iso[4].caracteristiques;
  [s[0], s[1]] = [s[1], s[0]];
  assert.deepEqual(tablesDiff(tables(), after), [
    'Classe P — Effort : « moyen » → « moyen à élevé »',
    'Classe P — Effort, solution : — → « plaquette robuste »',
    'Classe P — Problème typique, solution : « respecter la Vc de la table, nuance revêtue » → —',
    'Classe M — Problème typique, solution : « ne pas frotter, garder avance et profondeur suffisantes » → « avance suffisante »',
    'Classe K — caractéristique retirée : Chaleur',
    'Classe N — caractéristique ajoutée : Arrosage : « abondant »',
    "Classe S — l'ordre des caractéristiques a changé.",
  ]);
});
