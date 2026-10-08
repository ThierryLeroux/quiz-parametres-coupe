// Contenu des feuilles de référence (UI §3.5), composé à partir du catalogue : fonctions PURES, sans
// DOM, testées sous Node ; reference-screen.js ne fait que les mettre en page. Tout vient des
// données : ajouter une opération à operations.json l'ajoute à la feuille des avances.

import { carriesFeedCodes } from '../code-avance.js';
import { TOOL_MATERIAL_KEYS } from '../data.js';
import { factorText } from '../facteur-vitesse.js';
import { CLASS_IMAGE_KEYS, isoClassOf } from '../tables.js';

// Une avance en pouces, comme sur la feuille de l'atelier : sans zéro de tête, au moins trois
// décimales — 0.006 → « .006" », 0.0015 → « .0015" », 0.01 → « .010" ».
export function inches(value) {
  let text = String(Number(value.toFixed(5))).replace(/^0/, '');
  if (!text.includes('.')) text += '.';
  return `${text.padEnd(4, '0')}"`;
}

// Nom du fichier d'un pictogramme d'opération : « Chanfreinage / ébavurage » → « chanfreinage_ebavurage ».
export function operationSlug(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Les images vivent dans la base D1 et sont servies par /images/<id> (D56) : la photo d'un outil
// (`image` de l'outil, sinon son identifiant) et le pictogramme d'une opération — son `pictogramme`
// s'il en a un, sinon le slug de son nom, l'identifiant de la semence (les dessins du classeur
// convertis en SVG, D29 ; site/img/pictos/operations/ n'en est plus que la semence).
export const imageUrl = (id) => `/images/${encodeURIComponent(id)}`;
export const toolPhotoUrl = (tool) => imageUrl(tool.image ?? tool.id);
export const operationPicto = (name, operation = null) => imageUrl(operation?.pictogramme ?? operationSlug(name));

// Le pictogramme de l'opération d'un outil, tel que les tables du catalogue le donnent (et la présentation en vigueur,
// D76) : la page Question, la page de description et la feuille des avances le prennent au même endroit.
//   data : le catalogue (assembleData) ; name : le nom de l'opération
export const operationPictoOf = (data, name) => operationPicto(name, data?.operationByName?.get(name) ?? null);

// L'image d'une classe ISO (D64 ; D66 : la chaleur seulement), telle que l'écran Question la montre sous le
// matériau brut, et l'aperçu de la Gestion du contenu : [{ key, label, id, url }] — vide pour une classe sans image (O),
// inconnue, ou dont l'image est retirée : l'espace reste vide, sans erreur. `classesIso` : les classes de la
// version en usage (data.classesIso, ou celles du brouillon des tables à l'écran).

// La largeur d'affichage maximale de l'image de chaleur, en px CSS, d'après sa largeur en pixels : ÷ 1,5, pour
// limiter l'agrandissement sur un écran haute densité. Sur un écran de densité 2, une image de 237 px affichée à
// 158 px CSS occupe 316 px réels : agrandie × 1,33, au lieu de × 1,43 à 170 px CSS. Les images semées font 235 à
// 237 px : 157 à 158 px CSS. null si la largeur est inconnue (image pas encore chargée).
export const heatImageMaxWidth = (naturalWidth) => (Number.isFinite(naturalWidth) && naturalWidth > 0 ? Math.round((naturalWidth / 1.5) * 10) / 10 : null);

// Les caractéristiques d'une classe ISO (D65), telles que l'écran Question les montre sous les images :
// [{ libelle, texte, solution }] — solution vaut null quand la ligne n'en a pas. Les lignes mal formées
// (sans libellé ou sans texte) sont sautées ; une classe sans caractéristique donne une liste vide.
export function classFeatures(classesIso, code) {
  const c = isoClassOf(classesIso, code);
  const lines = Array.isArray(c?.caracteristiques) ? c.caracteristiques : [];
  const clean = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  return lines.filter((l) => clean(l?.libelle) && clean(l?.texte)).map((l) => ({ libelle: clean(l.libelle), texte: clean(l.texte), solution: clean(l.solution) }));
}
// `label` est la légende de l'image, celle de la classe (legende_image, D68 : « Chaleur » par défaut) ; null
// quand elle est vide — pas de légende, et pas d'espace laissé pour elle.
export function classImages(classesIso, code) {
  const c = isoClassOf(classesIso, code);
  const label = typeof c?.legende_image === 'string' && c.legende_image.trim() !== '' ? c.legende_image.trim() : null;
  return CLASS_IMAGE_KEYS.filter((key) => typeof c?.[key] === 'string' && c[key] !== '').map((key) => ({ key, label, id: c[key], url: imageUrl(c[key]) }));
}

// --- Vitesses de coupe -----------------------------------------------------------------------------------------
// Toutes les classes et toutes les lignes, quel que soit l'exercice ; aucune ligne surlignée.
// Retourne { columns, rows, revision } : columns = les trois matériaux d'outil, { label, key } ;
// rows = les matériaux de materiaux.json, dans leur ordre — « debut_famille » y commande le trait fin
// au-dessus d'un changement de matériau usiné (D27 : une donnée, pas un calcul) ; revision = celle
// de la table, pour le pied de la feuille (D28).
export function vcSheet(data) {
  const classes = new Map((data.classesIso ?? []).map((c) => [c.code, c]));
  return {
    // Les trois matières d'outil des tables, avec la couleur de leur colonne (D61 ; TOOL_MATERIAL_KEYS et tokens.css par défaut).
    columns: (data.toolMaterials ?? Object.entries(TOOL_MATERIAL_KEYS).map(([nom, cle]) => ({ nom, cle, couleur: null }))).map((m) => ({ label: m.nom, key: m.cle, couleur: m.couleur })),
    rows: data.materiaux,
    // La couleur vive, celle du texte et la teinte de ligne de chaque classe, par code (null si la version n'en dit rien).
    classes: (code) => classes.get(code) ?? null,
    revision: data.revisions.materiaux,
  };
}

// --- Avances -------------------------------------------------------------------------------------------------------

const isLathe = (operation) => operation.machine === 'Tour';

// Le texte posé sur la barre d'une opération.
function feedLabel(operation) {
  if (operation.avance_egale_pas_filetage) return 'pas du filetage';
  const perTooth = isLathe(operation) ? '' : ' / dent';
  const proportional = operation.avance_proportionnelle_diametre ? ' × Ø outil' : '';
  return `${inches(operation.avance_po_rev)}${perTooth}${proportional}`;
}

// Suites d'éléments voisins de même clé : [{ key, start, span }] — start compte à partir de 0.
function runs(items, keyOf) {
  const found = [];
  items.forEach((item, i) => {
    const key = keyOf(item);
    const last = found.at(-1);
    if (last && last.key === key && last.start + last.span === i) last.span += 1;
    else found.push({ key, start: i, span: 1 });
  });
  return found;
}

// La note posée à droite d'une suite d'opérations proportionnelles au Ø, sur leur bande grise. Les nombres viennent des
// données : l'exemple est calculé (« .006"/dent × Ø1/4" = .0015"/dent »), jamais recopié.
function proportionalBox(operations) {
  const max = Math.max(...operations.map((operation) => operation.avance_max_po_rev));
  if (operations.every(isLathe)) {
    return [{ text: "Ajuster l'avance ↔ Ø outil", strong: true }, { text: `Av. MAX. : ${inches(max)} / tour` }];
  }
  const drilling = operations.find((operation) => operation.operation === 'Perçage');
  const example = drilling ?? operations[0];
  return [
    { text: 'Avances pour un outil Ø1"', strong: true },
    { text: "Ajuster l'avance ↔ Ø outil", strong: true },
    { text: 'Exemple :' },
    { text: drilling ? 'Foret de Ø1/4"' : `${example.operation}, outil de Ø1/4"` },
    { text: `${inches(example.avance_po_rev)}/dent × Ø1/4" = ${inches(example.avance_po_rev / 4)}/dent`, italic: true },
    { text: `Ne pas dépasser ${inches(max)} / dent`, strong: true },
  ];
}

// Retourne { rows, machines, directions, boxes, revision } :
//   rows       : une opération par rang — { operation, picto, label, bar, proportional } ; bar = longueur
//                de la barre, de 0 à 1, proportionnelle à l'avance (null pour un filetage : pas de barre) ;
//                proportional = avance proportionnelle au Ø : le rang porte la bande grise du classeur ;
//                code (D96) : le code G d'avance de l'opération — seulement pour des tables qui portent les codes,
//                et alors la feuille a aussi `codes: true` (la colonne de la pastille) ; une version d'avant D96 donne
//                exactement la feuille d'avant, clé pour clé
//   machines   : [{ key, start, span }] — la machine-outil, sur la hauteur de ses opérations
//   directions : idem pour la direction d'avance (à l'intérieur d'une machine)
//   boxes      : [{ start, span, lines }] — notes des suites d'opérations proportionnelles au Ø
//   revision   : celle de la table des avances, pour le pied de la feuille (D28)
export function feedSheet(data) {
  const { operations } = data;
  const longest = Math.max(...operations.filter((operation) => !operation.avance_egale_pas_filetage).map((operation) => operation.avance_po_rev));
  const codes = carriesFeedCodes(operations);
  return {
    rows: operations.map((operation) => ({
      operation: operation.operation,
      picto: operationPicto(operation.operation, operation),
      label: feedLabel(operation),
      bar: operation.avance_egale_pas_filetage ? null : operation.avance_po_rev / longest,
      proportional: operation.avance_proportionnelle_diametre,
      ...(codes ? { code: operation.code_avance } : {}),
    })),
    ...(codes ? { codes: true } : {}),
    machines: runs(operations, (operation) => operation.machine),
    directions: runs(operations, (operation) => `${operation.machine}|${operation.direction_avance}`).map((run) => ({ ...run, key: run.key.split('|')[1] })),
    boxes: runs(operations, (operation) => (operation.avance_proportionnelle_diametre ? 'proportionnelle' : `fixe-${operation.operation}`))
      .filter((run) => run.key === 'proportionnelle')
      .map(({ start, span }) => ({ start, span, lines: proportionalBox(operations.slice(start, start + span)) })),
    revision: data.revisions.operations,
  };
}

// --- Facteurs de vitesse (D83) : « Modification de la vitesse de rotation selon l'opération » ----------------------------
// La 4e feuille n'existe que pour des tables qui portent les facteurs (data.hasSpeedFactors) : pour une version
// d'avant, null — on ne montre jamais une feuille qui contredirait la correction de sa version.
// Retourne { title, formula, rows, machines, revision } :
//   title, formula : le titre de la feuille et la formule rappelée à sa droite
//   rows     : une opération par rang, dans l'ordre des tables — { operation (le nom exact, celui de la question),
//              picto (celui des tables), factor (en fraction, comme sur le papier : « 1 », « 1/4 », « 1/8 » ; en
//              décimal seulement hors de la forme 1/n), marked (le facteur n'est pas 1 : la ligne ressort) }
//   machines : [{ key, start, span }] — la machine-outil, sur la hauteur de ses opérations, comme la feuille des avances
//   revision : celle de la table des opérations, pour le pied de la feuille (D28)
export const FACTOR_SHEET_TITLE = "Modification de la vitesse de rotation selon l'opération";
export const FACTOR_FORMULA = 'N = Vc × 4 / Ø × facteur';

export function speedFactorSheet(data) {
  if (data.hasSpeedFactors !== true) return null;
  const { operations } = data;
  return {
    title: FACTOR_SHEET_TITLE,
    formula: FACTOR_FORMULA,
    rows: operations.map((operation) => ({
      operation: operation.operation,
      picto: operationPicto(operation.operation, operation),
      factor: factorText(operation.facteur_vitesse),
      marked: operation.facteur_vitesse !== 1,
    })),
    machines: runs(operations, (operation) => operation.machine),
    revision: data.revisions.operations,
  };
}

// Les onglets des feuilles, dans l'ordre : la 4e, « Facteurs de vitesse », après Formules, seulement pour des tables
// qui portent les facteurs (D83).
export function sheetTabs(data) {
  return [
    { id: 'vc', label: 'Vitesses de coupe' },
    { id: 'avances', label: 'Avances' },
    { id: 'formules', label: 'Formules' },
    ...(data?.hasSpeedFactors === true ? [{ id: 'facteurs', label: 'Facteurs de vitesse' }] : []),
  ];
}
