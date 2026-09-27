// La présentation des tables en direct (chantier E5, décisions D75, D76) : ce qui, dans les tables de référence, ne
// fait qu'afficher — le nom et les trois couleurs des classes ISO, leur image de chaleur, sa légende et leurs
// caractéristiques ; la couleur des matières d'outil ; le pictogramme des opérations. Elle ne se publie pas : elle
// s'applique en direct, et se pose par-dessus TOUTE version de tables à l'affichage (page Question, feuilles, page
// de description, Gestion du contenu), jamais dans la correction ni l'attestation.
//
// Son format est celui des tables, réduit à la liste blanche : { classes_iso: [{ code, nom, couleur, couleur_texte,
// couleur_ligne, image_chaleur, legende_image, caracteristiques }], materiaux_outil: [{ cle, couleur }],
// operations: [{ operation, pictogramme }] }. La clé de chaque entrée (code, cle, operation) désigne une ligne des
// tables ; elle est versionnée, comme tout ce qui n'est pas dans la liste.
//
// Fonctions PURES, partagées par le serveur et le navigateur : la liste blanche, la présentation d'une version,
// celle en vigueur, la pose par-dessus des tables ou d'un catalogue, la validation, les différences.

import { LEGENDE_IMAGE_MAX, PRESENTATION_FIELDS, TOOL_MATERIAL_CLES, characteristicsDiff, characteristicsErrors, completeTables, isColor } from './tables.js';

// La liste blanche (D75, point 2) : pour chaque liste, la clé qui désigne la ligne et les champs en direct. Elle vit
// dans tables.js, qui en a besoin pour comparer les valeurs seules (tablesContent, tablesDiff).
export { PRESENTATION_FIELDS };
export const PRESENTATION_LISTS = Object.keys(PRESENTATION_FIELDS);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';

// Les lignes d'une liste dans des tables : classes et matières d'outil dans materiaux, opérations dans operations.
const rowsOf = (tables, list) => {
  const rows = list === 'operations' ? tables?.operations?.operations : tables?.materiaux?.[list];
  return Array.isArray(rows) ? rows : [];
};

// L'entrée de présentation d'une ligne des tables : sa clé et ses champs en direct, dans l'ordre de la liste
// blanche. Un pictogramme absent vaut null (le pictogramme par défaut : l'image nommée d'après l'opération).
function entryOf(row, list) {
  const { key, fields } = PRESENTATION_FIELDS[list];
  const out = { [key]: row[key] };
  for (const field of fields) out[field] = structuredClone(field === 'pictogramme' ? (row[field] ?? null) : row[field]);
  return out;
}

// Une entrée remise dans l'ordre de la liste blanche, sans autre clé : ce qu'on enregistre et ce qu'on exporte.
const normalizeEntry = (entry, list) => entryOf(entry, list);
export function normalizePresentation(presentation) {
  return Object.fromEntries(PRESENTATION_LISTS.map((list) => [list, (Array.isArray(presentation?.[list]) ? presentation[list] : []).filter(isObject).map((e) => normalizeEntry(e, list))]));
}

// La présentation que porte une version de tables (complétée : une version d'avant le 7b reçoit les valeurs par défaut).
export function presentationOf(tables) {
  const complete = completeTables(tables);
  return Object.fromEntries(PRESENTATION_LISTS.map((list) => [list, rowsOf(complete, list).filter(isObject).map((row) => entryOf(row, list))]));
}

// La présentation en vigueur (D76, points 2 et 3), celle du panneau : pour chaque ligne de la dernière version
// publiée des tables, l'entrée appliquée si elle existe, sinon celle de la version ; puis les entrées appliquées
// d'une clé que la dernière version n'a plus (elles servent encore aux versions plus anciennes). Rien d'appliqué
// (stored null) : la présentation de la dernière version, telle quelle.
//   stored : le contenu enregistré (presentation_tables.contenu), ou null ; latestTables : la dernière version
export function currentPresentation(stored, latestTables) {
  const latest = presentationOf(latestTables);
  if (!isObject(stored)) return latest;
  return Object.fromEntries(PRESENTATION_LISTS.map((list) => {
    const { key } = PRESENTATION_FIELDS[list];
    const applied = new Map((Array.isArray(stored[list]) ? stored[list] : []).filter(isObject).map((e) => [e[key], e]));
    const keys = new Set(latest[list].map((e) => e[key]));
    const fromLatest = latest[list].map((e) => (applied.has(e[key]) ? normalizeEntry(applied.get(e[key]), list) : e));
    const others = [...applied.values()].filter((e) => !keys.has(e[key])).map((e) => normalizeEntry(e, list));
    return [list, [...fromLatest, ...others]];
  }));
}

// Les clés qu'une présentation connaît, par liste : { classes_iso: Set(codes), materiaux_outil: Set(clés), operations: Set(noms) }.
export function presentationKeys(presentation) {
  return Object.fromEntries(PRESENTATION_LISTS.map((list) => [list, new Set((Array.isArray(presentation?.[list]) ? presentation[list] : []).filter(isObject).map((e) => e[PRESENTATION_FIELDS[list].key]))]));
}

// Des tables avec la présentation posée par-dessus (D76, point 3) : chaque ligne dont la présentation connaît la clé
// prend ses champs en direct ; les autres gardent ceux de leur version. Les tables sont complétées ; l'objet reçu
// n'est pas modifié. Sans présentation, les tables complétées telles quelles.
export function applyPresentation(tables, presentation) {
  const complete = completeTables(tables);
  if (!isObject(presentation)) return complete;
  const overlay = (list) => {
    const { key, fields } = PRESENTATION_FIELDS[list];
    const byKey = new Map((Array.isArray(presentation[list]) ? presentation[list] : []).filter(isObject).map((e) => [e[key], e]));
    return rowsOf(complete, list).map((row) => {
      const entry = isObject(row) ? byKey.get(row[key]) : undefined;
      if (entry === undefined) return row;
      const out = { ...row };
      for (const field of fields) if (field in entry) out[field] = structuredClone(entry[field]);
      return out;
    });
  };
  return {
    ...complete,
    materiaux: { ...complete.materiaux, classes_iso: overlay('classes_iso'), materiaux_outil: overlay('materiaux_outil') },
    operations: { ...complete.operations, operations: overlay('operations') },
  };
}

// Le catalogue d'une version (assembleData) avec la présentation posée par-dessus : classes ISO, matières d'outil et
// opérations (leur pictogramme) remplacées par des copies ; le reste est le même objet. Le catalogue reçu — celui
// que le serveur garde en mémoire, et avec lequel il corrige — n'est pas modifié.
export function presentData(data, presentation) {
  if (!isObject(presentation)) return data;
  const tables = applyPresentation({ materiaux: { classes_iso: data.classesIso, materiaux_outil: data.toolMaterials }, operations: { operations: data.operations } }, presentation);
  const operations = tables.operations.operations;
  return {
    ...data,
    classesIso: tables.materiaux.classes_iso,
    toolMaterials: tables.materiaux.materiaux_outil,
    operations,
    operationByName: new Map(operations.map((op) => [op.operation, op])),
  };
}

// --- Validation (D76, points 5 à 7) ---------------------------------------------------------------------------------

// L'identifiant d'une image de la base (D56 : le même motif que worker/images.js).
const IMAGE_REF = /^[a-z0-9]+([_-][a-z0-9]+)*$/;

export const OUTSIDE_WHITELIST = 'hors de la liste blanche de la présentation';

// Les erreurs d'une présentation reçue : [messages]. Toute clé hors de la liste blanche est une erreur (le serveur
// refuse, 400) ; chaque entrée est complète ; mêmes règles que les tables (D61, D65, D68), et une image nommée
// (image de chaleur, pictogramme) doit exister et ne pas être archivée.
//   images   : les fiches des images de la base ([{ id, archivee_le }]), ou null : seule la forme est vérifiée
//   archived : 'erreur' (par défaut) — une image archivée est une erreur ; 'permis' — pour « Rétablir » (D76, point 7)
export function presentationErrors(presentation, { images = null, archived = 'erreur' } = {}) {
  if (!isObject(presentation)) return ['La présentation doit être un objet { classes_iso, materiaux_outil, operations }.'];
  const errors = [];
  const known = Array.isArray(images) ? new Map(images.filter(isObject).map((image) => [image.id, image])) : null;
  for (const name of Object.keys(presentation)) {
    if (!PRESENTATION_LISTS.includes(name)) errors.push(`« ${name} » est ${OUTSIDE_WHITELIST} : seules « classes_iso », « materiaux_outil » et « operations » s'y modifient ; le reste se modifie dans le brouillon des tables, puis se publie.`);
  }
  const imageErrors = (where, field, value) => {
    if (value === null) return;
    if (typeof value !== 'string' || !IMAGE_REF.test(value)) { errors.push(`${where} : « ${field} » doit être l'identifiant d'une image (ou null)`); return; }
    if (known === null) return;
    if (!known.has(value)) errors.push(`${where} : « ${field} » : l'image « ${value} » est inconnue`);
    else if (known.get(value).archivee_le && archived !== 'permis') errors.push(`${where} : « ${field} » : l'image « ${value} » est archivée (choisis-en une autre, ou rétablis-la dans l'onglet Images)`);
  };
  for (const list of PRESENTATION_LISTS) {
    if (!(list in presentation)) continue;
    const entries = presentation[list];
    if (!Array.isArray(entries)) { errors.push(`« ${list} » doit être une liste`); continue; }
    const { key, fields } = PRESENTATION_FIELDS[list];
    entries.forEach((entry, i) => {
      if (!isObject(entry)) { errors.push(`${list}[${i}] : n'est pas un objet`); return; }
      const where = `${list}[${i}] (${entry[key]})`;
      for (const field of Object.keys(entry)) {
        if (field !== key && !fields.includes(field)) errors.push(`${where} : « ${field} » est ${OUTSIDE_WHITELIST} : il se modifie dans le brouillon des tables, puis se publie`);
      }
      for (const field of [key, ...fields]) if (!(field in entry)) errors.push(`${where} : « ${field} » manque`);
      if (list === 'classes_iso') {
        if (typeof entry.code !== 'string' || !/^[A-Z]$/.test(entry.code)) errors.push(`${where} : « code » doit être une lettre majuscule`);
        if ('nom' in entry && !isText(entry.nom)) errors.push(`${where} : « nom » est vide`);
        for (const color of ['couleur', 'couleur_texte', 'couleur_ligne']) if (color in entry && !isColor(entry[color])) errors.push(`${where} : « ${color} » doit être une couleur « #rrggbb »`);
        if ('image_chaleur' in entry) imageErrors(where, 'image_chaleur', entry.image_chaleur);
        if ('legende_image' in entry) {
          if (typeof entry.legende_image !== 'string') errors.push(`${where} : « legende_image » doit être un texte (vide : pas de légende)`);
          else if (entry.legende_image.length > LEGENDE_IMAGE_MAX) errors.push(`${where} : « legende_image » a ${entry.legende_image.length} caractères (au plus ${LEGENDE_IMAGE_MAX})`);
        }
        if ('caracteristiques' in entry) {
          if (!Array.isArray(entry.caracteristiques)) errors.push(`${where} : « caracteristiques » doit être une liste (vide : aucune)`);
          else for (const message of characteristicsErrors(entry.caracteristiques)) errors.push(`${where} : ${message}`);
        }
      } else if (list === 'materiaux_outil') {
        if (!TOOL_MATERIAL_CLES.includes(entry.cle)) errors.push(`${where} : « cle » doit être ${TOOL_MATERIAL_CLES.join(', ')}`);
        if ('couleur' in entry && !isColor(entry.couleur)) errors.push(`${where} : « couleur » doit être une couleur « #rrggbb »`);
      } else {
        if (!isText(entry.operation)) errors.push(`${where} : « operation » est vide`);
        if ('pictogramme' in entry) imageErrors(where, 'pictogramme', entry.pictogramme);
      }
    });
    const keys = entries.filter(isObject).map((e) => e[key]);
    for (const [i, value] of keys.entries()) if (keys.indexOf(value) !== i) errors.push(`${list} : « ${value} » en double`);
  }
  return errors;
}

// Les images archivées qu'une présentation nomme : [{ where, id }] — l'avertissement de « Rétablir » (D76, point 7).
export function archivedImagesOf(presentation, images) {
  const archived = new Set((images ?? []).filter((image) => isObject(image) && image.archivee_le).map((image) => image.id));
  const found = [];
  for (const c of Array.isArray(presentation?.classes_iso) ? presentation.classes_iso : []) if (archived.has(c?.image_chaleur)) found.push({ where: `Classe ${c.code} — image de chaleur`, id: c.image_chaleur });
  for (const op of Array.isArray(presentation?.operations) ? presentation.operations : []) if (archived.has(op?.pictogramme)) found.push({ where: `Opération « ${op.operation} » — pictogramme`, id: op.pictogramme });
  return found;
}

// Les images qu'une présentation nomme (images de chaleur, pictogrammes) : ce qui la rend « utilisée » (D76, point 7).
export function imagesOfPresentation(presentation) {
  const ids = [];
  for (const c of Array.isArray(presentation?.classes_iso) ? presentation.classes_iso : []) if (typeof c?.image_chaleur === 'string') ids.push(c.image_chaleur);
  for (const op of Array.isArray(presentation?.operations) ? presentation.operations : []) if (typeof op?.pictogramme === 'string') ids.push(op.pictogramme);
  return ids;
}

// --- Différences, en clair ---------------------------------------------------------------------------------------

const text = (v) => (v === undefined || v === null || v === '' ? '—' : String(v));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const CLASS_LABELS = { nom: 'nom', couleur: 'couleur', couleur_texte: 'couleur du texte', couleur_ligne: 'teinte de ligne', image_chaleur: 'image de chaleur', legende_image: "légende de l'image" };

// Les différences entre deux présentations, une ligne par valeur : « Classe P — couleur : #00b0f0 → #0099cc »,
// « Classe M — Problème typique, solution : … → … », « Matière d'outil « Acier rapide » — couleur : … »,
// « Opération « Perçage » — pictogramme : percage → img-… ». L'ordre des entrées ne compte pas (c'est celui des tables).
//   toolNames : Map clé → nom des matières d'outil (celui des tables), pour les nommer ; la clé sinon
export function presentationDiff(before, after, toolNames = new Map()) {
  const lines = [];
  const byKey = (p, list) => new Map((Array.isArray(p?.[list]) ? p[list] : []).filter(isObject).map((e) => [e[PRESENTATION_FIELDS[list].key], e]));

  const classesA = byKey(before, 'classes_iso');
  for (const [code, c] of byKey(after, 'classes_iso')) {
    const old = classesA.get(code);
    if (!old) { lines.push(`Classe ${code} — présentation ajoutée : ${text(c.nom)}`); continue; }
    for (const [field, label] of Object.entries(CLASS_LABELS)) if (!same(old[field], c[field])) lines.push(`Classe ${code} — ${label} : ${text(old[field])} → ${text(c[field])}`);
    lines.push(...characteristicsDiff(code, old.caracteristiques, c.caracteristiques));
  }
  const toolsA = byKey(before, 'materiaux_outil');
  for (const [cle, m] of byKey(after, 'materiaux_outil')) {
    const old = toolsA.get(cle);
    const name = toolNames.get(cle) ?? cle;
    if (!old) lines.push(`Matière d'outil « ${name} » — présentation ajoutée : ${text(m.couleur)}`);
    else if (!same(old.couleur, m.couleur)) lines.push(`Matière d'outil « ${name} » — couleur : ${text(old.couleur)} → ${text(m.couleur)}`);
  }
  const opsA = byKey(before, 'operations');
  for (const [name, op] of byKey(after, 'operations')) {
    const old = opsA.get(name);
    if (!old) lines.push(`Opération « ${name} » — présentation ajoutée : pictogramme ${text(op.pictogramme)}`);
    else if (!same(old.pictogramme, op.pictogramme)) lines.push(`Opération « ${name} » — pictogramme : ${text(old.pictogramme)} → ${text(op.pictogramme)}`);
  }
  return lines;
}

// --- Retouches en attente dans le brouillon des tables (D76, point 10) ----------------------------------------------
// Avant ce jalon, la présentation se modifiait dans le brouillon des tables : une retouche jamais publiée y est
// peut-être encore. C'est un champ de présentation, pour une clé que la présentation en vigueur connaît, qui
// diffère à la fois de la version dont le brouillon est parti et de la présentation en vigueur. Retourne
// { lignes, contenu } : les différences en clair (en vigueur → brouillon) et la présentation en vigueur avec ces
// retouches (ce que « Les reprendre dans le panneau » y met) ; lignes vide s'il n'y en a pas.
//   baseTables : la version dont le brouillon est parti (null : aucune) ; draftTables : le brouillon tel qu'en base
//   current : la présentation en vigueur ; toolNames : pour les nommer (presentationDiff)
export function pendingDraftPresentation(baseTables, draftTables, current, toolNames = new Map()) {
  if (baseTables === null || baseTables === undefined) return { lignes: [], contenu: current };
  const base = presentationOf(baseTables);
  const draft = presentationOf(draftTables);
  const contenu = structuredClone(current);
  for (const list of PRESENTATION_LISTS) {
    const { key, fields } = PRESENTATION_FIELDS[list];
    const baseByKey = new Map(base[list].map((e) => [e[key], e]));
    const draftByKey = new Map(draft[list].map((e) => [e[key], e]));
    for (const entry of contenu[list] ?? []) {
      const was = baseByKey.get(entry[key]);
      const now = draftByKey.get(entry[key]);
      if (!was || !now) continue;
      for (const field of fields) if (!same(was[field], now[field]) && !same(now[field], entry[field])) entry[field] = structuredClone(now[field]);
    }
  }
  return { lignes: presentationDiff(current, contenu, toolNames), contenu };
}
