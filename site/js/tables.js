// Les tables de référence versionnées (jalon 7b, décisions D61 à D63) : ce qu'une version contient
// au-delà des matériaux et des opérations — les classes ISO avec leurs couleurs, les matières
// d'outil avec les leurs, le pictogramme d'une opération —, les valeurs par défaut (celles de
// tokens.css, pour une version d'avant le 7b comme « A2026_r0 »), les variables CSS que le quiz et
// l'éditeur posent à partir de la version en usage, la révision suivante et les différences entre
// deux versions, valeur par valeur. Fonctions PURES, partagées par le serveur et le navigateur.

// Les classes ISO 513 du classeur, avec les couleurs des feuilles (UI §1 ; tokens.css avant le 7b) :
// la couleur vive (lettre, panneau du matériau), celle du texte posé dessus, la teinte de ligne.
export const DEFAULT_ISO_CLASSES = [
  { code: 'P', nom: 'Acier', couleur: '#00b0f0', couleur_texte: '#ffffff', couleur_ligne: '#c1efff' },
  { code: 'M', nom: 'Acier inoxydable', couleur: '#ffff00', couleur_texte: '#000000', couleur_ligne: '#ffffb7' },
  { code: 'K', nom: 'Fonte', couleur: '#ff0000', couleur_texte: '#ffffff', couleur_ligne: '#ffc5c5' },
  { code: 'N', nom: 'Métaux non ferreux', couleur: '#00b050', couleur_texte: '#ffffff', couleur_ligne: '#b3ffd5' },
  { code: 'S', nom: 'Alliages réfractaires et titane', couleur: '#ffc000', couleur_texte: '#000000', couleur_ligne: '#fff1c5' },
  { code: 'H', nom: 'Matériaux durcis', couleur: '#d9d9d9', couleur_texte: '#000000', couleur_ligne: '#eeeeee' },
  { code: 'O', nom: 'Plastiques et graphite', couleur: '#808080', couleur_texte: '#ffffff', couleur_ligne: '#d9d9d9' },
];

// Les trois matières d'outil : la clé (celle de vc_pi_min, fixe), le nom (celui que les outils
// nomment et que l'étudiant lit) et la couleur de la colonne de la table des Vc.
export const DEFAULT_TOOL_MATERIALS = [
  { cle: 'acier_rapide', nom: 'Acier rapide', couleur: '#b4c7e7' },
  { cle: 'carbure_solide', nom: 'Carbure de tungstène solide', couleur: '#a6a6a6' },
  { cle: 'insert_carbure', nom: 'Insert de carbure de tungstène', couleur: '#ffc000' },
];

export const TOOL_MATERIAL_CLES = DEFAULT_TOOL_MATERIALS.map((m) => m.cle);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

// Une version de tables complétée : classes ISO, matières d'outil et pictogrammes absents reçoivent
// leurs valeurs par défaut (une version d'avant le 7b n'en a pas ; la table en base ne change pas,
// D61). Ne modifie pas l'objet reçu.
export function completeTables(tables) {
  const materiaux = isObject(tables?.materiaux) ? tables.materiaux : {};
  const operations = isObject(tables?.operations) ? tables.operations : {};
  return {
    ...tables,
    materiaux: {
      ...materiaux,
      classes_iso: Array.isArray(materiaux.classes_iso) ? materiaux.classes_iso : DEFAULT_ISO_CLASSES.map((c) => ({ ...c })),
      materiaux_outil: Array.isArray(materiaux.materiaux_outil) ? materiaux.materiaux_outil : DEFAULT_TOOL_MATERIALS.map((m) => ({ ...m })),
    },
    operations,
  };
}

// Les classes ISO d'une table de matériaux (complétée ou non), et les matières d'outil.
export const isoClassesOf = (materiaux) => (Array.isArray(materiaux?.classes_iso) ? materiaux.classes_iso : DEFAULT_ISO_CLASSES);
export const toolMaterialsOf = (materiaux) => (Array.isArray(materiaux?.materiaux_outil) ? materiaux.materiaux_outil : DEFAULT_TOOL_MATERIALS);

// Nom de matière d'outil → clé de vc_pi_min, d'après la table (les valeurs par défaut sont TOOL_MATERIAL_KEYS de data.js).
export function toolMaterialKeyMap(materiaux) {
  return new Map(toolMaterialsOf(materiaux).filter(isObject).map((m) => [m.nom, m.cle]));
}

// --- Variables CSS (UI §1) : les couleurs de sens, lues dans la version en usage --------------------------------
// Le quiz, les feuilles et l'éditeur posent ces variables sur la page à partir des tables de la
// version en usage ; tokens.css n'en garde que les valeurs par défaut. Le rouge K éclairci pour le
// fond nuit (--iso-k-night, D30) est composé de la couleur vive : 64 % de la couleur, 36 % de blanc
// (#ff0000 → #ff5c5c, la valeur d'origine).
export function colorVariables({ classesIso, toolMaterials }) {
  const variables = [];
  for (const c of classesIso ?? []) {
    const code = String(c.code).toLowerCase();
    variables.push([`--iso-${code}`, c.couleur], [`--iso-${code}-text`, c.couleur_texte], [`--iso-${code}-tint`, c.couleur_ligne]);
    if (code === 'k') variables.push(['--iso-k-night', `color-mix(in srgb, ${c.couleur} 64%, #ffffff)`]);
  }
  for (const m of toolMaterials ?? []) variables.push([`--tool-${String(m.cle).replaceAll('_', '-')}`, m.couleur]);
  return variables;
}

// --- Révision (D28, D61) : « A2026_r0 » → « A2026_r1 » -----------------------------------------------------------
export const TABLES_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/;
export const isTablesId = (id) => typeof id === 'string' && TABLES_ID.test(id);

// La révision suivante suggérée : le numéro après « _r » incrémenté ; sans « _rN », « _r1 » est ajouté.
export function nextRevision(id) {
  const match = /^(.*_r)(\d+)$/.exec(String(id ?? ''));
  if (match) return `${match[1]}${Number(match[2]) + 1}`;
  return `${id}_r1`;
}

// --- Différences entre deux versions de tables, valeur par valeur (D61) ------------------------------------------
// Retourne des lignes de texte : « Acier non allié (groupe 1), Acier rapide : 100 → 110 pi/min »,
// « Matériau ajouté : … », « Opération « Perçage » — avance : 0.006 → 0.008 po/rév », « Classe P — couleur : … ».
const text = (v) => (v === undefined || v === null || v === '' ? '—' : String(v));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const MATERIAL_FIELDS = [['iso', 'classe'], ['materiau', 'matériau'], ['composition', 'composition'], ['etat', 'état'], ['durete', 'dureté'], ['exemple', 'exemple'], ['debut_famille', 'début de famille']];
const OPERATION_FIELDS = [['machine', 'machine-outil'], ['direction_avance', 'direction d\'avance'], ['avance_po_rev', 'avance (po/rév)'], ['avance_max_po_rev', 'avance max (po/rév)'], ['avance_egale_pas_filetage', 'filetage'], ['avance_proportionnelle_diametre', 'proportionnelle au Ø'], ['pictogramme', 'pictogramme']];

export function tablesDiff(before, after) {
  const a = completeTables(before);
  const b = completeTables(after);
  const lines = [];
  const bool = (v) => (v === true ? 'oui' : v === false ? 'non' : text(v));

  // Classes ISO, par code.
  const classesA = new Map(a.materiaux.classes_iso.map((c) => [c.code, c]));
  const classesB = new Map(b.materiaux.classes_iso.map((c) => [c.code, c]));
  for (const [code, c] of classesB) {
    const old = classesA.get(code);
    if (!old) { lines.push(`Classe ajoutée : ${code} — ${c.nom}`); continue; }
    for (const [key, label] of [['nom', 'nom'], ['couleur', 'couleur'], ['couleur_texte', 'couleur du texte'], ['couleur_ligne', 'teinte de ligne']]) {
      if (!same(old[key], c[key])) lines.push(`Classe ${code} — ${label} : ${text(old[key])} → ${text(c[key])}`);
    }
  }
  for (const code of classesA.keys()) if (!classesB.has(code)) lines.push(`Classe retirée : ${code}`);

  // Matières d'outil, par clé.
  const toolsA = new Map(a.materiaux.materiaux_outil.map((m) => [m.cle, m]));
  const toolsB = new Map(b.materiaux.materiaux_outil.map((m) => [m.cle, m]));
  for (const [cle, m] of toolsB) {
    const old = toolsA.get(cle);
    if (!old) { lines.push(`Matière d'outil ajoutée : ${m.nom}`); continue; }
    if (!same(old.nom, m.nom)) lines.push(`Matière d'outil renommée : « ${text(old.nom)} » → « ${text(m.nom)} »`);
    if (!same(old.couleur, m.couleur)) lines.push(`Matière d'outil « ${m.nom} » — couleur : ${text(old.couleur)} → ${text(m.couleur)}`);
  }
  for (const [cle, m] of toolsA) if (!toolsB.has(cle)) lines.push(`Matière d'outil retirée : ${m.nom}`);

  // Matériaux usinés, par numéro de groupe.
  const rowsA = new Map((a.materiaux.materiaux ?? []).map((m) => [m.groupe, m]));
  const rowsB = new Map((b.materiaux.materiaux ?? []).map((m) => [m.groupe, m]));
  const label = (m) => `${text(m.materiau)} (groupe ${text(m.groupe)})`;
  for (const [groupe, m] of rowsB) {
    const old = rowsA.get(groupe);
    if (!old) { lines.push(`Matériau ajouté : ${m.iso} — ${label(m)}`); continue; }
    for (const [key, fieldLabel] of MATERIAL_FIELDS) {
      if (!same(old[key], m[key])) lines.push(`${label(m)} — ${fieldLabel} : ${bool(old[key])} → ${bool(m[key])}`);
    }
    for (const tool of toolsB.values()) {
      const was = old.vc_pi_min?.[tool.cle];
      const now = m.vc_pi_min?.[tool.cle];
      if (!same(was, now)) lines.push(`${label(m)}, ${tool.nom} : ${text(was)} → ${text(now)} pi/min`);
    }
  }
  for (const [groupe, m] of rowsA) if (!rowsB.has(groupe)) lines.push(`Matériau retiré : ${m.iso} — ${label(m)}`);
  const orderA = [...rowsA.keys()].filter((g) => rowsB.has(g)).join(',');
  const orderB = [...rowsB.keys()].filter((g) => rowsA.has(g)).join(',');
  if (orderA !== orderB) lines.push("L'ordre des matériaux a changé.");

  // Opérations, par nom.
  const opsA = new Map((a.operations.operations ?? []).map((op) => [op.operation, op]));
  const opsB = new Map((b.operations.operations ?? []).map((op) => [op.operation, op]));
  for (const [name, op] of opsB) {
    const old = opsA.get(name);
    if (!old) { lines.push(`Opération ajoutée : ${name}`); continue; }
    for (const [key, fieldLabel] of OPERATION_FIELDS) {
      if (!same(old[key], op[key])) lines.push(`Opération « ${name} » — ${fieldLabel} : ${bool(old[key])} → ${bool(op[key])}`);
    }
  }
  for (const name of opsA.keys()) if (!opsB.has(name)) lines.push(`Opération retirée : ${name}`);
  const opOrderA = [...opsA.keys()].filter((n) => opsB.has(n)).join('|');
  const opOrderB = [...opsB.keys()].filter((n) => opsA.has(n)).join('|');
  if (opOrderA !== opOrderB) lines.push("L'ordre des opérations a changé.");
  return lines;
}

// Le contenu d'un brouillon de tables ou d'une version, tel qu'on le compare : sans les commentaires
// « _… » ni la révision (qui est le nom de la version, posé à la publication).
export function tablesContent(tables) {
  const strip = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([key]) => !key.startsWith('_') && key !== 'revision'));
  return { materiaux: strip(tables?.materiaux), operations: strip(tables?.operations) };
}
