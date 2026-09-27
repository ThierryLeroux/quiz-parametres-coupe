// Tests de site/js/presentation.js (chantier E5, décisions D75, D76) : la liste blanche, la présentation d'une version,
// celle en vigueur, la pose par-dessus des tables et d'un catalogue, la validation, les différences, les retouches en
// attente du brouillon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OUTSIDE_WHITELIST, PRESENTATION_FIELDS, applyPresentation, archivedImagesOf, currentPresentation, imagesOfPresentation, normalizePresentation,
  pendingDraftPresentation, presentData, presentationDiff, presentationErrors, presentationKeys, presentationOf,
} from '../site/js/presentation.js';
import { DEFAULT_ISO_CLASSES, completeTables } from '../site/js/tables.js';
import { assembleData } from '../site/js/data.js';
import { lireFichier } from './aide.js';

const materiaux = await lireFichier('data/materiaux.json');
const operations = await lireFichier('data/operations.json');
const outils = await lireFichier('data/outils.json');
const tables = () => structuredClone({ materiaux, operations }); // A2026_r0 : sans classes ISO ni matières d'outil (complétées à la lecture)
const IMAGES = [
  ...['p', 'm', 'k', 'n', 's', 'h'].map((c) => ({ id: `copeaux-${c}-chaleur`, archivee_le: null })),
  { id: 'percage', archivee_le: null }, { id: 'img-0123456789abcdef', archivee_le: null }, { id: 'img-archivee', archivee_le: '2026-09-27T10:00:00.000Z' },
];

test('la liste blanche (D75) : nom, couleurs, image de chaleur, légende et caractéristiques des classes ; couleur des matières d’outil ; pictogramme des opérations', () => {
  assert.deepEqual(PRESENTATION_FIELDS, {
    classes_iso: { key: 'code', fields: ['nom', 'couleur', 'couleur_texte', 'couleur_ligne', 'image_chaleur', 'legende_image', 'caracteristiques'] },
    materiaux_outil: { key: 'cle', fields: ['couleur'] },
    operations: { key: 'operation', fields: ['pictogramme'] },
  });
});

test('presentationOf : la présentation d’une version, complétée (A2026_r0 reçoit les valeurs par défaut) ; un pictogramme absent vaut null', () => {
  const p = presentationOf(tables());
  assert.deepEqual(p.classes_iso, DEFAULT_ISO_CLASSES.map(({ code, nom, couleur, couleur_texte, couleur_ligne, image_chaleur, legende_image, caracteristiques }) => ({ code, nom, couleur, couleur_texte, couleur_ligne, image_chaleur, legende_image, caracteristiques })));
  assert.deepEqual(p.materiaux_outil, [{ cle: 'acier_rapide', couleur: '#b4c7e7' }, { cle: 'carbure_solide', couleur: '#a6a6a6' }, { cle: 'insert_carbure', couleur: '#ffc000' }]);
  assert.equal(p.operations.length, operations.operations.length);
  assert.deepEqual(p.operations[0], { operation: operations.operations[0].operation, pictogramme: null });
  // Aucune valeur n'y entre : ni Vc, ni avance, ni nom de matière d'outil.
  assert.ok(p.materiaux_outil.every((m) => Object.keys(m).join() === 'cle,couleur'));
  assert.ok(p.operations.every((op) => Object.keys(op).join() === 'operation,pictogramme'));
});

test('currentPresentation (D76) : rien d’appliqué → celle de la dernière version ; sinon l’entrée appliquée pour chaque clé de la dernière version, celle de la version pour une clé nouvelle, puis les clés appliquées que la dernière version n’a plus', () => {
  const latest = tables();
  assert.deepEqual(currentPresentation(null, latest), presentationOf(latest));
  const stored = {
    classes_iso: [{ ...presentationOf(latest).classes_iso[1], nom: 'Inox', legende_image: 'Arête' }, { code: 'Z', nom: 'Retirée', couleur: '#000000', couleur_texte: '#ffffff', couleur_ligne: '#eeeeee', image_chaleur: null, legende_image: '', caracteristiques: [] }],
    materiaux_outil: [{ cle: 'carbure_solide', couleur: '#111111' }],
    operations: [{ operation: 'Perçage', pictogramme: 'img-0123456789abcdef' }],
  };
  const current = currentPresentation(stored, latest);
  assert.deepEqual(current.classes_iso.map((c) => [c.code, c.nom]), [['P', 'Acier'], ['M', 'Inox'], ['K', 'Fonte'], ['N', 'Métaux non ferreux'], ['S', 'Alliages réfractaires et titane'], ['H', 'Matériaux durcis'], ['O', 'Plastiques et graphite'], ['Z', 'Retirée']]);
  assert.equal(current.classes_iso[1].legende_image, 'Arête');
  assert.deepEqual(current.materiaux_outil.map((m) => m.couleur), ['#b4c7e7', '#111111', '#ffc000']);
  assert.equal(current.operations.find((op) => op.operation === 'Perçage').pictogramme, 'img-0123456789abcdef');
  assert.equal(current.operations.length, operations.operations.length);
  assert.deepEqual([...presentationKeys(current).classes_iso], ['P', 'M', 'K', 'N', 'S', 'H', 'O', 'Z']);
  // normalizePresentation : chaque entrée dans l'ordre de la liste blanche, sans autre clé.
  assert.deepEqual(Object.keys(normalizePresentation({ classes_iso: [{ caracteristiques: [], code: 'P', nom: 'x', couleur: '#000000', couleur_texte: '#000000', couleur_ligne: '#000000', image_chaleur: null, legende_image: '', vc: 1 }] }).classes_iso[0]),
    ['code', 'nom', 'couleur', 'couleur_texte', 'couleur_ligne', 'image_chaleur', 'legende_image', 'caracteristiques']);
});

test('applyPresentation : chaque ligne dont la présentation connaît la clé prend ses champs en direct, les autres gardent ceux de leur version ; les valeurs ne bougent pas ; l’objet reçu n’est pas modifié', () => {
  const version = tables();
  const before = JSON.stringify(version);
  const presentation = {
    classes_iso: [{ code: 'P', nom: 'Aciers', couleur: '#123456', couleur_texte: '#ffffff', couleur_ligne: '#abcdef', image_chaleur: null, legende_image: 'Zone chaude', caracteristiques: [{ libelle: 'Effort', texte: 'moyen' }], vc_pi_min: 999 }],
    materiaux_outil: [{ cle: 'acier_rapide', couleur: '#222222' }],
    operations: [{ operation: 'Perçage', pictogramme: 'img-0123456789abcdef' }, { operation: 'Inconnue', pictogramme: 'x' }],
  };
  const out = applyPresentation(version, presentation);
  assert.equal(JSON.stringify(version), before);
  const p = out.materiaux.classes_iso[0];
  assert.deepEqual([p.nom, p.couleur, p.couleur_ligne, p.image_chaleur, p.legende_image, p.caracteristiques.length], ['Aciers', '#123456', '#abcdef', null, 'Zone chaude', 1]);
  assert.equal('vc_pi_min' in p, false); // seuls les champs de la liste blanche sont posés
  assert.deepEqual(out.materiaux.classes_iso[1], completeTables(version).materiaux.classes_iso[1]); // M : inconnue de la présentation
  assert.deepEqual(out.materiaux.materiaux_outil[0], { cle: 'acier_rapide', nom: 'Acier rapide', couleur: '#222222' }); // le nom reste celui de la version
  const percage = out.operations.operations.find((op) => op.operation === 'Perçage');
  const source = operations.operations.find((op) => op.operation === 'Perçage');
  assert.deepEqual(percage, { ...source, pictogramme: 'img-0123456789abcdef' });
  assert.equal(out.operations.operations.length, operations.operations.length); // une clé que la version n'a pas n'ajoute rien
  assert.deepEqual(out.materiaux.materiaux, materiaux.materiaux);
  // Sans présentation : les tables complétées, telles quelles.
  assert.deepEqual(applyPresentation(version, null), completeTables(version));
});

test('presentData : le catalogue d’une version avec la présentation par-dessus — classes, matières d’outil et opérations en copies ; le catalogue reçu (celui qui corrige) n’est pas touché', () => {
  const data = assembleData(tables(), outils.outils);
  const snapshot = JSON.stringify({ classes: data.classesIso, tools: data.toolMaterials, ops: data.operations });
  const presentation = { classes_iso: [{ ...presentationOf(tables()).classes_iso[0], couleur: '#123456' }], operations: [{ operation: 'Perçage', pictogramme: 'img-0123456789abcdef' }] };
  const shown = presentData(data, presentation);
  assert.equal(shown.classesIso[0].couleur, '#123456');
  assert.equal(shown.operationByName.get('Perçage').pictogramme, 'img-0123456789abcdef');
  assert.equal(shown.operations.find((op) => op.operation === 'Perçage').pictogramme, 'img-0123456789abcdef');
  assert.equal(JSON.stringify({ classes: data.classesIso, tools: data.toolMaterials, ops: data.operations }), snapshot);
  assert.equal(data.operationByName.get('Perçage').pictogramme, undefined);
  for (const key of ['materiaux', 'materialsByGroup', 'revisions', 'outils', 'toolMaterialKeys']) assert.equal(shown[key], data[key], key);
  assert.equal(presentData(data, null), data);
});

test('presentationErrors : une présentation complète et juste passe ; tout champ hors de la liste blanche est refusé, nommé ; chaque entrée est complète ; mêmes règles que les tables ; image inconnue ou archivée (permise pour « Rétablir »)', () => {
  const good = presentationOf(tables());
  assert.deepEqual(presentationErrors(good, { images: IMAGES }), []);
  assert.deepEqual(presentationErrors(null), ['La présentation doit être un objet { classes_iso, materiaux_outil, operations }.']);
  // La liste blanche : une valeur (Vc, groupe, avance, nom de matière d'outil, révision, matériaux) n'y entre pas.
  const outside = structuredClone(good);
  outside.materiaux = { materiaux: [] };
  outside.classes_iso[0].vc_pi_min = { acier_rapide: 1 };
  outside.materiaux_outil[0].nom = 'HSS';
  outside.operations[0].avance_po_rev = 0.1;
  assert.deepEqual(presentationErrors(outside).filter((e) => e.includes(OUTSIDE_WHITELIST)), [
    `« materiaux » est ${OUTSIDE_WHITELIST} : seules « classes_iso », « materiaux_outil » et « operations » s'y modifient ; le reste se modifie dans le brouillon des tables, puis se publie.`,
    `classes_iso[0] (P) : « vc_pi_min » est ${OUTSIDE_WHITELIST} : il se modifie dans le brouillon des tables, puis se publie`,
    `materiaux_outil[0] (acier_rapide) : « nom » est ${OUTSIDE_WHITELIST} : il se modifie dans le brouillon des tables, puis se publie`,
    `operations[0] (${operations.operations[0].operation}) : « avance_po_rev » est ${OUTSIDE_WHITELIST} : il se modifie dans le brouillon des tables, puis se publie`,
  ]);
  // Les règles des tables : couleur, nom, légende de 40 caractères au plus, 6 caractéristiques au plus, clé, entrée complète, doublon.
  const bad = structuredClone(good);
  bad.classes_iso[0].couleur = 'rouge';
  bad.classes_iso[1].nom = ' ';
  bad.classes_iso[2].legende_image = 'x'.repeat(41);
  bad.classes_iso[3].caracteristiques = Array.from({ length: 7 }, (_, i) => ({ libelle: `l${i}`, texte: 't' }));
  delete bad.classes_iso[4].couleur_ligne;
  bad.classes_iso[5].code = 'P';
  bad.materiaux_outil[1].cle = 'diamant';
  bad.operations[1].operation = '';
  assert.deepEqual(presentationErrors(bad), [
    'classes_iso[0] (P) : « couleur » doit être une couleur « #rrggbb »',
    'classes_iso[1] (M) : « nom » est vide',
    'classes_iso[2] (K) : « legende_image » a 41 caractères (au plus 40)',
    'classes_iso[3] (N) : au plus 6 caractéristiques (7)',
    'classes_iso[4] (S) : « couleur_ligne » manque',
    'classes_iso : « P » en double',
    'materiaux_outil[1] (diamant) : « cle » doit être acier_rapide, carbure_solide, insert_carbure',
    'operations[1] () : « operation » est vide',
  ]);
  // Les images : l'image de chaleur et le pictogramme doivent exister et ne pas être archivés ; null est permis.
  const images = structuredClone(good);
  images.classes_iso[0].image_chaleur = 'img-inconnue';
  images.classes_iso[1].image_chaleur = 'img-archivee';
  images.classes_iso[2].image_chaleur = null;
  images.operations[0].pictogramme = 'img-archivee';
  images.operations[1].pictogramme = 'Pas Un Id';
  assert.deepEqual(presentationErrors(images, { images: IMAGES }), [
    "classes_iso[0] (P) : « image_chaleur » : l'image « img-inconnue » est inconnue",
    "classes_iso[1] (M) : « image_chaleur » : l'image « img-archivee » est archivée (choisis-en une autre, ou rétablis-la dans l'onglet Images)",
    `operations[0] (${operations.operations[0].operation}) : « pictogramme » : l'image « img-archivee » est archivée (choisis-en une autre, ou rétablis-la dans l'onglet Images)`,
    `operations[1] (${operations.operations[1].operation}) : « pictogramme » doit être l'identifiant d'une image (ou null)`,
  ]);
  assert.equal(presentationErrors(images, { images: IMAGES, archived: 'permis' }).filter((e) => /archivée/.test(e)).length, 0);
  assert.deepEqual(archivedImagesOf(images, IMAGES), [{ where: 'Classe M — image de chaleur', id: 'img-archivee' }, { where: `Opération « ${operations.operations[0].operation} » — pictogramme`, id: 'img-archivee' }]);
  assert.deepEqual(imagesOfPresentation(images), ['img-inconnue', 'img-archivee', 'copeaux-n-chaleur', 'copeaux-s-chaleur', 'copeaux-h-chaleur', 'img-archivee', 'Pas Un Id']);
  // Sans les fiches des images : la forme seulement.
  assert.deepEqual(presentationErrors(images).length, 1);
});

test('presentationDiff : une ligne par valeur changée, les matières d’outil nommées par leur nom ; l’ordre des entrées ne compte pas', () => {
  const before = presentationOf(tables());
  assert.deepEqual(presentationDiff(before, structuredClone(before)), []);
  const after = structuredClone(before);
  after.classes_iso[0] = { ...after.classes_iso[0], nom: 'Aciers', couleur: '#0099cc', image_chaleur: null, legende_image: '' };
  after.classes_iso[1].caracteristiques[3].solution = 'avance suffisante';
  after.materiaux_outil[0].couleur = '#cccccc';
  after.operations.find((op) => op.operation === 'Perçage').pictogramme = 'img-0123456789abcdef';
  after.classes_iso.reverse();
  assert.deepEqual(presentationDiff(before, after, new Map([['acier_rapide', 'Acier rapide']])), [
    'Classe M — Problème typique, solution : ne pas frotter, garder avance et profondeur suffisantes → avance suffisante',
    'Classe P — nom : Acier → Aciers',
    'Classe P — couleur : #00b0f0 → #0099cc',
    'Classe P — image de chaleur : copeaux-p-chaleur → —',
    "Classe P — légende de l'image : Chaleur → —",
    "Matière d'outil « Acier rapide » — couleur : #b4c7e7 → #cccccc",
    'Opération « Perçage » — pictogramme : — → img-0123456789abcdef',
  ]);
  const added = { ...structuredClone(before), classes_iso: [...before.classes_iso, { code: 'Z', nom: 'Neuve', couleur: '#000000', couleur_texte: '#ffffff', couleur_ligne: '#eeeeee', image_chaleur: null, legende_image: '', caracteristiques: [] }] };
  assert.deepEqual(presentationDiff(before, added), ['Classe Z — présentation ajoutée : Neuve']);
});

test('pendingDraftPresentation (D76, point 10) : une retouche de présentation faite dans le brouillon avant E5-1 et jamais publiée est signalée, et reprise dans le panneau ; une présentation appliquée depuis ne la fait pas réapparaître', () => {
  const base = tables();
  const current = currentPresentation(null, base);
  assert.deepEqual(pendingDraftPresentation(base, base, current).lignes, []);
  assert.deepEqual(pendingDraftPresentation(null, base, current).lignes, []);
  // Le brouillon a une légende et une couleur retouchées, jamais publiées.
  const draft = completeTables(tables());
  draft.materiaux.classes_iso[0].legende_image = 'Zone chaude';
  draft.materiaux.materiaux_outil[2].couleur = '#ff00ff';
  const pending = pendingDraftPresentation(base, draft, current, new Map([['insert_carbure', 'Insert']]));
  assert.deepEqual(pending.lignes, ["Classe P — légende de l'image : Chaleur → Zone chaude", "Matière d'outil « Insert » — couleur : #ffc000 → #ff00ff"]);
  assert.equal(pending.contenu.classes_iso[0].legende_image, 'Zone chaude');
  assert.equal(current.classes_iso[0].legende_image, 'Chaleur'); // la présentation reçue n'est pas touchée
  // Reprise et appliquée : plus rien en attente. Une autre couleur appliquée ensuite ne la fait pas revenir.
  assert.deepEqual(pendingDraftPresentation(base, draft, pending.contenu).lignes, []);
  const later = structuredClone(pending.contenu);
  later.classes_iso[1].couleur = '#000000';
  assert.deepEqual(pendingDraftPresentation(base, draft, later).lignes, []);
});
