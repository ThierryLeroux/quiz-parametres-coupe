// Ce que montre l'éditeur (jalon 7a, décisions D47 à D49 ; UI §3.9) : état d'un exercice dans la
// liste, différences entre le brouillon et la dernière version (confirmation de publication), texte
// des dimensions dans le formulaire d'outil, exemple composé du gabarit de nomenclature, erreurs par
// champ, lignes de l'aperçu, résumé d'un import. Fonctions PURES, sans DOM, testées sous Node ;
// editeur.js ne fait que les mettre à l'écran.

import { TEMPLATE_TOKENS, TOOL_MATERIAL_KEYS, fittingBars, parseThread, templateTokens } from '../data.js';
import { DEFAULT_ISO_CLASSES, DEFAULT_TOOL_MATERIALS, isoClassesOf, toolMaterialsOf } from '../tables.js';
import { COPY_KEYS, GRADED_FIELD_KEYS } from '../exercice.js';
import { formatDateStamp } from './text.js';

// Les grandeurs, dans l'ordre de l'écran, avec leur libellé court.
export const FIELD_CHOICES = [
  { key: 'vc', label: 'Vitesse de coupe (Vc)' },
  { key: 'fz', label: 'Avance par dent (fz)' },
  { key: 'n', label: 'RPM (N)' },
  { key: 'f', label: 'Avance par révolution (f)' },
  { key: 'vf', label: "Vitesse d'avance (Vf)" },
];

// Les trois états d'une grandeur (D52) : évaluée (saisie et corrigée), fournie (valeur théorique
// montrée), masquée (« — », sans valeur, jamais envoyée au navigateur).
export const FIELD_STATES = [
  { key: 'evaluee', label: 'évaluée' },
  { key: 'fournie', label: 'fournie' },
  { key: 'masquee', label: 'masquée' },
];

// L'état de chaque grandeur d'un brouillon : { vc: 'evaluee', fz: 'fournie', n: 'masquee', … }.
export function fieldStates(draft) {
  const graded = draft.champs_evalues ?? [];
  const masked = draft.champs_masques ?? [];
  return Object.fromEntries(FIELD_CHOICES.map(({ key }) => [key, graded.includes(key) ? 'evaluee' : (masked.includes(key) ? 'masquee' : 'fournie')]));
}

// L'inverse : les états → { champs_evalues, champs_masques? } dans l'ordre de l'écran.
export function statesToDraft(states) {
  const keys = FIELD_CHOICES.map((f) => f.key);
  const out = { champs_evalues: keys.filter((key) => states[key] === 'evaluee') };
  const masked = keys.filter((key) => states[key] === 'masquee');
  if (masked.length > 0) out.champs_masques = masked;
  return out;
}

// « Vc évaluée · fz fournie · N masquée · f fournie · Vf fournie » — pour la liste des différences.
export function fieldStatesText(draft) {
  const states = fieldStates(draft);
  const short = { vc: 'Vc', fz: 'fz', n: 'N', f: 'f', vf: 'Vf' };
  return FIELD_CHOICES.map(({ key }) => `${short[key]} ${FIELD_STATES.find((s) => s.key === states[key]).label}`).join(' · ');
}

// Une grandeur évaluée ou masquée qui se déduit des grandeurs fournies et des données de la question
// (Ø, facteur Vc, limite RPM, nombre de dents) : l'étudiant peut la retrouver sans la table. Un
// avertissement, sans effet sur la publication. Relations du moteur (calcul.js) : N = Vc × 4 / Ø × facteur
// Vc, plafonné ; f = fz × dents ; Vf = N × f. Seules les grandeurs fournies servent de source (une
// grandeur évaluée n'est pas connue de l'étudiant). Retourne les phrases dans l'ordre de l'écran.
export function deducibleWarnings(draft) {
  const states = fieldStates(draft);
  const given = (key) => states[key] === 'fournie';
  const sought = (key) => states[key] !== 'fournie'; // évaluée ou masquée
  const lines = [];
  if (sought('vc') && given('n')) lines.push('Vc se déduit de N fourni : Vc = N × Ø / (4 × facteur Vc), sauf si N est plafonné par la limite RPM.');
  if (sought('fz') && given('f')) lines.push('fz se déduit de f fournie : fz = f / dents.');
  if (sought('n') && given('vc')) lines.push('N se déduit de Vc fournie : N = Vc × 4 / Ø × facteur Vc, plafonné à la limite RPM.');
  if (sought('n') && given('f') && given('vf')) lines.push('N se déduit de f et Vf fournies : N = Vf / f.');
  if (sought('f') && given('fz')) lines.push('f se déduit de fz fournie : f = fz × dents.');
  if (sought('f') && given('n') && given('vf')) lines.push('f se déduit de N et Vf fournis : f = Vf / N.');
  if (sought('vf') && given('n') && given('f')) lines.push('Vf se déduit de N et f fournis : Vf = N × f.');
  return lines;
}

// Les matières d'outil par défaut, dans l'ordre de la table des Vc ; celles d'une version de tables : toolMaterialNames (data.js).
export const TOOL_MATERIALS = Object.keys(TOOL_MATERIAL_KEYS);

// --- Couleurs de sens (UI §1), celles des tables de la version en usage (D61) -----------------------------------------

// La pastille d'une matière d'outil : la couleur de l'en-tête de colonne de la table des Vc.
//   materiaux : la table des matériaux de la version (ses matieres d'outil et leurs couleurs) ; celles par défaut sinon
export function materialSwatch(label, materiaux = null) {
  const m = toolMaterialsOf(materiaux).find((entry) => entry.nom === label) ?? DEFAULT_TOOL_MATERIALS.find((entry) => entry.nom === label);
  return { background: m?.couleur ?? 'var(--color-accent)', text: '#000000', letter: '' };
}

// La pastille d'un groupe de matériaux usinés : la lettre de sa classe ISO sur la couleur vive de la
// classe (le rouge K éclairci pour le fond nuit, comme le panneau du matériau brut).
export function groupSwatch(group, materiaux = null) {
  const letter = String(group).trim().charAt(0).toUpperCase();
  const c = isoClassesOf(materiaux).find((entry) => entry.code === letter) ?? DEFAULT_ISO_CLASSES.find((entry) => entry.code === letter);
  const vivid = c?.couleur ?? 'var(--color-accent)';
  return { background: letter === 'K' ? `color-mix(in srgb, ${vivid} 64%, #ffffff)` : vivid, text: c?.couleur_texte ?? '#000000', letter };
}

// --- Liste des exercices --------------------------------------------------------------------------------------------

// L'état d'un exercice, en clair : « Jamais publié », « Brouillon modifié », « À jour », « Archivé ».
export function exerciseState(row) {
  if (row.archive_le !== null) return 'Archivé';
  if (row.derniere_version === null) return 'Jamais publié';
  return row.modifie ? 'Brouillon modifié' : 'À jour';
}

// « v2 · 2026-09-24 13:05 », ou « — ».
export function versionLabel(row) {
  return row.derniere_version === null ? '—' : `v${row.derniere_version} · ${formatDateStamp(row.publie_le)}`;
}

// « 3 séances (v1 : 2, v2 : 1) », « 1 séance (v1 : 1) », « aucune ».
export function sessionsLabel(row) {
  if (row.seances === 0) return 'aucune';
  const parts = row.versions.filter((v) => v.seances > 0).map((v) => `v${v.numero} : ${v.seances}`);
  return `${row.seances} séance${row.seances > 1 ? 's' : ''}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`;
}

// Le lien à donner aux étudiants sur Léa.
export const studentLink = (origin, id) => `${origin}/?exercice=${encodeURIComponent(id)}`;

// Les textes de confirmation.
export const archiveConfirmation = (row) => `Archiver « ${row.titre} » ? Il disparaît de la liste de l'accueil et aucune nouvelle séance ne peut être commencée ; les séances en cours continuent, et les attestations restent vérifiables. Il pourra être rétabli.`;
export const deleteConfirmation = (row) => `Supprimer « ${row.titre} » (${row.id}) ? Aucune séance ne s'y rattache : le brouillon et ses versions disparaissent, sans retour.`;
export const removeToolConfirmation = (copy) => `Retirer « ${copy.nom} » (${copy.id}) de l'exercice ? Sa copie disparaît du brouillon ; l'outil de la banque n'est pas touché.`;
// Retirer plusieurs copies d'un coup : la confirmation les nomme toutes.
export const removeSelectionConfirmation = (copies) => `Retirer ${copies.length} outil${copies.length > 1 ? 's' : ''} de l'exercice — ${copies.map((c) => `${c.nom} (${c.id})`).join(', ')} ? Leurs copies disparaissent du brouillon (rien n'est perdu avant la publication) ; la banque n'est pas touchée.`;

// --- Différences entre deux contenus (B6 : confirmation de publication) ---------------------------------------------

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const listText = (list) => (Array.isArray(list) ? list.join(', ') : '(tous)');
const text = (value) => {
  if (value === undefined || value === null) return '—';
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'object' ? item.libelle : String(item))).join(', ');
  return String(value);
};

// Les réglages généraux comparés : [{ champ, avant, apres }] en texte.
function settingsDiff(before, after) {
  const compare = [
    ['titre', 'Titre', (d) => d.titre],
    ['champs_evalues', 'Grandeurs', (d) => fieldStatesText(d)],
    ['materiaux_outil', "Matières d'outil permises", (d) => listText(d.materiaux_outil)],
    ['groupes', 'Groupes de matériaux permis', (d) => listText(d.groupes)],
    ['liste', "Proposé à l'accueil", (d) => (d.liste === false ? 'non' : 'oui')],
  ];
  return compare.filter(([, , read]) => read(before) !== read(after)).map(([champ, label, read]) => ({ champ, label, avant: read(before), apres: read(after) }));
}

// Les champs d'une copie comparés (sans « origine ») : dimensions et listes en texte.
function copyDiff(before, after) {
  return COPY_KEYS.filter((key) => key !== 'origine' && !same(before[key], after[key])).map((champ) => ({ champ, avant: text(before[champ]), apres: text(after[champ]) }));
}

// Les différences entre la dernière version publiée et le brouillon : ce que la confirmation résume.
//   before : le contenu de la version (ou null : première publication) ; after : le brouillon
//   tables : { avant, apres } — la version de tables de la dernière version publiée et celle du brouillon (D62) ; null = sans
// Retourne { premiere, reglages: [...], ajoutes: [copies], retires: [copies], modifies: [{ id, nom, champs }], tables }.
export function versionDiff(before, after, tables = null) {
  const tablesChange = tables !== null && tables.avant !== tables.apres ? { avant: tables.avant, apres: tables.apres } : null;
  if (before === null) return { premiere: true, reglages: [], ajoutes: after.outils, retires: [], modifies: [], tables: tablesChange };
  const byId = (list) => new Map(list.map((copy) => [copy.id, copy]));
  const avant = byId(before.outils);
  const apres = byId(after.outils);
  return {
    premiere: false,
    reglages: settingsDiff(before, after),
    ajoutes: after.outils.filter((copy) => !avant.has(copy.id)),
    retires: before.outils.filter((copy) => !apres.has(copy.id)),
    modifies: after.outils.filter((copy) => avant.has(copy.id)).map((copy) => ({ id: copy.id, nom: copy.nom, champs: copyDiff(avant.get(copy.id), copy) })).filter((entry) => entry.champs.length > 0),
    reordonnes: before.outils.filter((copy) => apres.has(copy.id)).map((copy) => copy.id).join(',') !== after.outils.filter((copy) => avant.has(copy.id)).map((copy) => copy.id).join(','),
    tables: tablesChange,
  };
}

// Le résumé en lignes de texte : ce que la boîte de confirmation affiche.
export function diffLines(diff) {
  if (diff.premiere) return [`Première publication : ${diff.ajoutes.length} outil${diff.ajoutes.length > 1 ? 's' : ''}.`];
  const lines = [];
  if (diff.tables) lines.push(`Tables de référence : « ${diff.tables.avant} » → « ${diff.tables.apres} »`);
  for (const r of diff.reglages) lines.push(`${r.label} : « ${r.avant} » → « ${r.apres} »`);
  for (const copy of diff.ajoutes) lines.push(`Outil ajouté : ${copy.nom} (${copy.id}), ${copy.reussites_requises} réussite${copy.reussites_requises > 1 ? 's' : ''} de suite`);
  for (const copy of diff.retires) lines.push(`Outil retiré : ${copy.nom} (${copy.id})`);
  for (const entry of diff.modifies) for (const c of entry.champs) lines.push(`${entry.nom} (${entry.id}) — ${c.champ} : « ${c.avant} » → « ${c.apres} »`);
  if (diff.reordonnes) lines.push("L'ordre des outils a changé.");
  if (lines.length === 0) lines.push('Aucune différence avec la version précédente.');
  return lines;
}

// --- Tables de référence versionnées (D61 à D63) ----------------------------------------------------------------------

// La famille d'avance d'une opération, et l'inverse : « fixe », « proportionnelle » (au Ø), « filetage » (le pas).
export const FEED_FAMILIES = [
  { key: 'fixe', label: 'fixe (la valeur de la table)' },
  { key: 'proportionnelle', label: 'proportionnelle au Ø de l\'outil' },
  { key: 'filetage', label: 'filetage (l\'avance est le pas)' },
];
export function feedFamilyOf(operation) {
  if (operation?.avance_egale_pas_filetage === true) return 'filetage';
  if (operation?.avance_proportionnelle_diametre === true) return 'proportionnelle';
  return 'fixe';
}
export const feedFamilyFlags = (family) => ({ avance_egale_pas_filetage: family === 'filetage', avance_proportionnelle_diametre: family === 'proportionnelle' });

// Les groupes ISO d'une table de matériaux, dérivés des lignes (« P - Acier non allié »), dans l'ordre d'apparition :
// c'est ce que les outils nomment dans « groupes_materiaux_usinables ».
export function deriveGroups(materials) {
  const groups = [];
  for (const m of materials) {
    const group = `${m.iso} - ${m.materiau}`;
    if (!groups.includes(group)) groups.push(group);
  }
  return groups;
}

// « 2 versions d'exercice · 1 brouillon », « aucune utilisation » — la colonne des versions de tables.
export function tablesUsageLabel({ versions_exercice: versions, brouillons }) {
  const parts = [];
  if (versions > 0) parts.push(`${versions} version${versions > 1 ? 's' : ''} d'exercice`);
  if (brouillons > 0) parts.push(`${brouillons} brouillon${brouillons > 1 ? 's' : ''}`);
  return parts.length === 0 ? 'aucune utilisation' : parts.join(' · ');
}

// Ce qu'un changement de version de tables change POUR CET EXERCICE (D62) : les erreurs qui
// apparaîtraient (matière, groupe ou opération que la nouvelle version n'a plus), les Vc qui changent
// dans les groupes et matières que ses outils tirent, les avances et pictogrammes des opérations de
// ses outils, les matériaux ajoutés ou retirés dans ses groupes. Retourne { erreurs, lignes }.
//   draft : le brouillon de l'exercice ; before, after : les deux versions de tables (complétées ou non)
//   draftErrorsOf : (draft, tables) → [{ champ, message }] (draftErrors d'exercice.js, injectée : pas de cycle d'import)
export function exerciseTablesImpact(draft, before, after, draftErrorsOf) {
  const key = (e) => `${e.champ} : ${e.message}`;
  const known = new Set(draftErrorsOf(draft, before).map(key));
  const erreurs = draftErrorsOf(draft, after).map(key).filter((e) => !known.has(e));

  const tools = Array.isArray(draft.outils) ? draft.outils : [];
  const permitted = (list, item) => !Array.isArray(list) || list.includes(item);
  const usedGroups = new Set(tools.flatMap((t) => (t.groupes_materiaux_usinables ?? []).filter((g) => permitted(draft.groupes, g))));
  const usedMaterials = new Set(tools.flatMap((t) => (t.materiaux_outil ?? []).filter((m) => permitted(draft.materiaux_outil, m))));
  const usedOperations = new Set(tools.map((t) => t.operation));

  const a = completeTablesLike(before);
  const b = completeTablesLike(after);
  const lignes = [];
  const text = (v) => (v === undefined || v === null ? '—' : String(v));
  const rowsA = new Map(a.materiaux.materiaux.map((m) => [m.groupe, m]));
  const rowsB = new Map(b.materiaux.materiaux.map((m) => [m.groupe, m]));
  const toolsB = new Map(b.materiaux.materiaux_outil.map((m) => [m.nom, m.cle]));
  const toolsA = new Map(a.materiaux.materiaux_outil.map((m) => [m.nom, m.cle]));
  for (const [groupe, row] of rowsB) {
    const group = `${row.iso} - ${row.materiau}`;
    if (!usedGroups.has(group)) continue;
    const old = rowsA.get(groupe);
    if (!old) { lignes.push(`Matériau ajouté dans un groupe de l'exercice : ${group} (groupe ${groupe})`); continue; }
    for (const name of usedMaterials) {
      const was = old.vc_pi_min?.[toolsA.get(name)];
      const now = row.vc_pi_min?.[toolsB.get(name)];
      if (was !== now) lignes.push(`${row.materiau} (groupe ${groupe}), ${name} : ${text(was)} → ${text(now)} pi/min`);
    }
  }
  for (const [groupe, row] of rowsA) {
    if (!rowsB.has(groupe) && usedGroups.has(`${row.iso} - ${row.materiau}`)) lignes.push(`Matériau retiré d'un groupe de l'exercice : ${row.iso} - ${row.materiau} (groupe ${groupe})`);
  }
  const opsA = new Map(a.operations.operations.map((op) => [op.operation, op]));
  const opsB = new Map(b.operations.operations.map((op) => [op.operation, op]));
  for (const name of usedOperations) {
    const old = opsA.get(name);
    const now = opsB.get(name);
    if (!old || !now) continue; // absente : c'est une erreur, déjà dite
    for (const [field, label] of [['avance_po_rev', 'avance (po/rév)'], ['avance_max_po_rev', 'avance max (po/rév)'], ['avance_egale_pas_filetage', 'filetage'], ['avance_proportionnelle_diametre', 'proportionnelle au Ø'], ['pictogramme', 'pictogramme']]) {
      if (JSON.stringify(old[field] ?? null) !== JSON.stringify(now[field] ?? null)) lignes.push(`Opération « ${name} » — ${label} : ${text(old[field])} → ${text(now[field])}`);
    }
  }
  return { erreurs, lignes };
}

// Les tables complétées, sans dépendre de tables.js pour les tests de cet écran (la même règle : valeurs par défaut).
function completeTablesLike(tables) {
  return {
    materiaux: { ...tables.materiaux, classes_iso: tables.materiaux.classes_iso ?? DEFAULT_ISO_CLASSES, materiaux_outil: tables.materiaux.materiaux_outil ?? DEFAULT_TOOL_MATERIALS },
    operations: tables.operations,
  };
}

// Le nom d'une version de tables sur la page d'un exercice, et l'avis quand une plus récente existe.
export const tablesNotice = (current, latest) => (current === latest ? null : `Une version plus récente des tables de référence existe : ${latest}. Cet exercice est sur ${current}.`);

// --- Formulaire d'outil ---------------------------------------------------------------------------------------------

// Les dimensions dans une zone de texte, une par ligne : « Ø 1/4 po ; 0.25 » (libellé ; valeur).
export function dimensionsText(list) {
  return (Array.isArray(list) ? list : []).map((d) => `${d.libelle} ; ${d.valeur}`).join('\n');
}

// L'inverse : les lignes tapées → [{ libelle, valeur }]. La valeur est un nombre (Ø en pouces), ou
// un texte pour un filetage (« 0.25-20 », « 10x1.5 ») ; une ligne sans « ; » a le libellé pour valeur.
//   thread : l'opération est un filetage (la valeur reste un texte)
export function parseDimensions(textValue, thread = false) {
  return String(textValue ?? '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '').map((line) => {
    const at = line.lastIndexOf(';');
    const libelle = (at < 0 ? line : line.slice(0, at)).trim();
    const raw = (at < 0 ? '' : line.slice(at + 1)).trim().replace(',', '.');
    if (thread) return { libelle, valeur: raw };
    const valeur = raw === '' ? Number.NaN : Number(raw);
    return { libelle, valeur: Number.isFinite(valeur) ? valeur : raw };
  });
}

// Ce que le moteur lit de chaque ligne de dimension (retouche 5) : pour un filetage, le Ø et le pas en
// pouces — et en mm pour le métrique — tels que parseThread les donne ; sinon le Ø en pouces ; ou l'erreur
// quand la ligne ne se lit pas. Retourne [{ libelle, lecture, erreur }] dans l'ordre des lignes.
//   thread : l'opération est un filetage
export function dimensionReadings(textValue, thread) {
  const inches = (value) => `${Number(value.toFixed(5))} po`;
  const mm = (value) => `${Number((value * 25.4).toFixed(3))} mm`;
  return parseDimensions(textValue, thread).map(({ libelle, valeur }) => {
    if (thread) {
      const read = parseThread(valeur);
      if (read === null) return { libelle, lecture: null, erreur: `filetage illisible : « ${valeur} » (attendu « 0.25-20 » ou « 10x1.5 »)` };
      const metric = /x/.test(String(valeur));
      const lecture = metric
        ? `Ø ${mm(read.diameter)} = ${inches(read.diameter)} · pas ${mm(read.pitch)} = ${inches(read.pitch)}`
        : `Ø ${inches(read.diameter)} · pas ${inches(read.pitch)} (${Number((1 / read.pitch).toFixed(3))} filets/po)`;
      return { libelle, lecture, erreur: null };
    }
    if (typeof valeur !== 'number' || !(valeur > 0)) return { libelle, lecture: null, erreur: `Ø illisible : « ${valeur} » (attendu un Ø en pouces > 0)` };
    return { libelle, lecture: `Ø ${inches(valeur)}`, erreur: null };
  });
}

// L'exemple composé du gabarit de nomenclature (D24) : avec la première dimension, le moins de dents,
// la première matière et la première barre qui entre — « MVLNR - Ø charioté: 1.000" » —, ou, si un
// aléa est donné (« Autre exemple », D58), avec des valeurs tirées au hasard dans l'outil, comme le
// ferait une question. Un jeton sans valeur pour cet outil reste tel quel.
//   random : () → [0, 1[, ou null pour l'exemple fixe
export function exampleIdentifier(tool, opsByName, random = null) {
  const template = typeof tool.format_identifiant === 'string' ? tool.format_identifiant : '';
  const pick = (list) => (list.length === 0 ? undefined : list[random === null ? 0 : Math.min(list.length - 1, Math.floor(random() * list.length))]);
  const dimension = pick(Array.isArray(tool.dimensions) ? tool.dimensions : []);
  const op = opsByName.get(tool.operation);
  const thread = op?.avance_egale_pas_filetage === true && dimension ? parseThread(dimension.valeur) : null;
  const diameter = thread ? thread.diameter : (typeof dimension?.valeur === 'number' ? dimension.valeur : null);
  const inches = (value) => (value === null || value === undefined ? null : String(Number(value.toFixed(5))));
  const bar = diameter !== null && tool.dimensions_barre ? pick(fittingBars(tool, diameter)) : null;
  const teeth = Number.isInteger(tool.nb_dents_min) && Number.isInteger(tool.nb_dents_max) && tool.nb_dents_max >= tool.nb_dents_min
    ? tool.nb_dents_min + (random === null ? 0 : Math.min(tool.nb_dents_max - tool.nb_dents_min, Math.floor(random() * (tool.nb_dents_max - tool.nb_dents_min + 1))))
    : tool.nb_dents_min ?? null;
  const values = {
    IdDia: dimension?.libelle ?? null,
    Dia: diameter === null ? null : inches(diameter),
    Pas: thread ? inches(thread.pitch) : null,
    IdBarre: bar?.libelle ?? null,
    NbDent: teeth,
    NomOutil: tool.nom ?? null,
    Operation: tool.operation ?? null,
    Matoutil: pick(Array.isArray(tool.materiaux_outil) ? tool.materiaux_outil : []) ?? null,
  };
  return template.replace(/\[([^\]]*)\]/g, (token, name) => (values[name] === null || values[name] === undefined ? token : String(values[name])));
}

// Les jetons que le gabarit utilise, pour la note sous le champ.
export const templateTokenList = (template) => templateTokens(typeof template === 'string' ? template : '');

// Les jetons permis pour cet outil (D24, D58), dans l'ordre des boutons : les huit du moteur, sauf
// [Pas] hors filetage et [IdBarre] sans barres. Chaque bouton dit ce que le jeton devient.
export function permittedTokens(tool, opsByName) {
  const op = opsByName.get(tool.operation);
  const thread = op?.avance_egale_pas_filetage === true;
  const bars = Array.isArray(tool.dimensions_barre) && tool.dimensions_barre.length > 0;
  return [
    { token: 'IdDia', label: 'libellé de la dimension' },
    { token: 'Dia', label: 'Ø en pouces' },
    ...(thread ? [{ token: 'Pas', label: 'pas du filet, en pouces' }] : []),
    ...(bars ? [{ token: 'IdBarre', label: 'libellé de la barre' }] : []),
    { token: 'NbDent', label: 'nombre de dents' },
    { token: 'NomOutil', label: 'nom de l\'outil' },
    { token: 'Operation', label: 'opération' },
    { token: 'Matoutil', label: 'matière de l\'outil' },
  ].filter((entry) => TEMPLATE_TOKENS.includes(entry.token));
}

// Insère un jeton dans le gabarit à la place de la sélection [start, end[ : { text, caret } — le
// curseur se retrouve après le jeton, prêt pour la suite.
export function insertToken(text, start, end, token) {
  const before = String(text ?? '').slice(0, start);
  const after = String(text ?? '').slice(end);
  const inserted = `[${token}]`;
  return { text: `${before}${inserted}${after}`, caret: before.length + inserted.length };
}

// --- Images (D56) : galerie, téléversement ------------------------------------------------------------------------

// Ce que le navigateur fait d'un fichier avant l'envoi : un SVG part tel quel (le serveur l'assainit) ;
// une photo d'outil est réduite au plus grand côté de 800 px — en JPEG à 0,85 sur fond blanc si elle est
// opaque (une photo d'atelier : 40 à 150 Ko), en PNG sans fond si elle a de la transparence (D60 : une
// photo détourée reste détourée sur le fond nuit) ; un pictogramme en image matricielle est réduit à
// 256 px, en PNG (aplats et transparence gardés). Jamais agrandi.
//   transparent : l'image a au moins un pixel non opaque (hasTransparency, lu dans le canvas)
export function uploadPlan(usage, isSvg, transparent = false) {
  if (isSvg) return { resize: false, type: 'image/svg+xml' };
  if (usage === 'operation') return { resize: true, maxSide: 256, type: 'image/png', quality: undefined, background: null };
  if (transparent) return { resize: true, maxSide: 800, type: 'image/png', quality: undefined, background: null };
  return { resize: true, maxSide: 800, type: 'image/jpeg', quality: 0.85, background: '#ffffff' };
}

// Au moins un pixel non opaque dans des données RVBA (getImageData().data : quatre octets par pixel).
export function hasTransparency(rgba) {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 255) return true;
  return false;
}

// La taille cible d'une image à réduire : jamais agrandie, le plus grand côté ramené à maxSide.
export function fittedSize(width, height, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const plain = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// La galerie : les images de cet usage, non archivées (sauf celle déjà choisie, pour qu'elle reste
// visible), filtrées par le nom ou l'identifiant, sans casse ni accents.
export function filterImages(images, { usage, query = '', current = null }) {
  const needle = plain(query).trim();
  return images
    .filter((image) => image.usage === usage && (image.archivee_le === null || image.id === current))
    .filter((image) => needle === '' || plain(image.nom).includes(needle) || plain(image.id).includes(needle));
}

// « 6.5 Ko », « 1.2 Mo ».
export function imageSizeText(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} Mo`;
  return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} Ko`;
}

// « 2 versions publiées · 1 brouillon · banque » ou « jamais utilisée » — la colonne de l'onglet Images.
export function imageUsageLabel(utilisations) {
  const parts = [];
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  if (utilisations.versions.length > 0) parts.push(plural(utilisations.versions.length, 'version publiée', 'versions publiées'));
  if (utilisations.brouillons.length > 0) parts.push(plural(utilisations.brouillons.length, 'brouillon', 'brouillons'));
  if (utilisations.banque.length > 0) parts.push(plural(utilisations.banque.length, 'outil de la banque', 'outils de la banque'));
  if (utilisations.tables.length > 0) parts.push(plural(utilisations.tables.length, 'version des tables', 'versions des tables'));
  return parts.length === 0 ? 'jamais utilisée' : parts.join(' · ');
}

// Une image utilisée par une version publiée ne se supprime jamais (D56) : le bouton n'existe que sans utilisation.
export const canDeleteImage = (utilisations) => Object.values(utilisations).every((list) => list.length === 0);

export const USAGE_LABELS = { outil: "photo d'outil", operation: "pictogramme d'opération" };
export const imageDeleteConfirmation = (image) => `Supprimer l'image « ${image.nom} » (${image.id}) ? Elle n'est utilisée nulle part ; elle disparaît sans retour.`;
export const imageArchiveConfirmation = (image) => `Archiver l'image « ${image.nom} » ? Elle ne sera plus proposée dans la galerie ; les outils et opérations qui la nomment l'affichent toujours. Elle pourra être rétablie.`;

// --- Erreurs par champ ----------------------------------------------------------------------------------------------

// Regroupe les erreurs par champ : Map champ → [messages]. Un champ sans place à l'écran va sous « » (liste générale).
//   known : (champ) → vrai si l'écran a une place pour ce champ
export function errorsByField(errors, known = () => true) {
  const map = new Map();
  for (const { champ, message } of errors) {
    const key = known(champ) ? champ : '';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(champ === key || key === '' ? (key === '' && champ ? `${champ} : ${message}` : message) : message);
  }
  return map;
}

// Le texte du bouton Publier et son état.
export function publishState(errors, diff) {
  if (errors.length > 0) return { enabled: false, label: `Publier (${errors.length} erreur${errors.length > 1 ? 's' : ''} à corriger)` };
  // Une version identique à la précédente ne se publie pas (D51) : le serveur refuse aussi.
  if (!diff.premiere && diffLines(diff)[0] === 'Aucune différence avec la version précédente.') return { enabled: false, label: 'Aucune différence à publier' };
  return { enabled: true, label: 'Publier…' };
}

// --- Aperçu -----------------------------------------------------------------------------------------------------------

// Les colonnes du tableau d'aperçu : Outil, Matière, Matériau usiné, puis les cinq grandeurs, chacune
// avec son état (D52) : « RPM (N) · évaluée », « … · fournie », « … · masquée ».
export function previewColumns(champsEvalues, champsMasques = []) {
  const states = fieldStates({ champs_evalues: champsEvalues, champs_masques: champsMasques });
  return ['N°', 'Outil (nomenclature composée)', "Matière d'outil", 'Matériau usiné', ...FIELD_CHOICES.map(({ key, label }) => `${label} · ${FIELD_STATES.find((s) => s.key === states[key]).label}`)];
}

// Les lignes : la réponse attendue d'une grandeur évaluée, la valeur d'une grandeur fournie, « — » pour une masquée.
export function previewRows(questions, champsEvalues, champsMasques = []) {
  const states = fieldStates({ champs_evalues: champsEvalues, champs_masques: champsMasques });
  return questions.map((q, i) => [
    String(i + 1),
    q.identifiant,
    q.materiau_outil,
    `${q.materiau.classe} ${q.materiau.groupe} — ${q.materiau.materiau}${q.materiau.etat ? `, ${q.materiau.etat}` : ''}`,
    ...FIELD_CHOICES.map(({ key }) => {
      const engineKey = GRADED_FIELD_KEYS[key];
      if (states[key] === 'masquee') return '—';
      return (states[key] === 'evaluee' ? q.reponses[engineKey] : q.fournies?.[engineKey]) ?? '';
    }),
  ]);
}

// --- Sauvegarde -------------------------------------------------------------------------------------------------------

// Le nom du fichier d'export : « quiz-parametres-coupe-exercices-2026-09-24.json ».
export const exportFileName = (now) => `quiz-parametres-coupe-exercices-${formatDateStamp(now.toISOString()).slice(0, 10)}.json`;

// Les mots de confirmation d'un import (les mêmes que le serveur, worker/editeur.js) : IMPORTER, ou
// REMPLACER quand des outils de la banque disparaîtraient (D50).
export const IMPORT_WORD = 'IMPORTER';
export const REPLACE_WORD = 'REMPLACER';
export const importWordFor = (resume) => (resume.banque.retires.length > 0 ? REPLACE_WORD : IMPORT_WORD);

// Ce que l'import ferait, en phrases : la banque outil par outil (ajoutés, modifiés, retirés par nom, D50),
// et les images (D59) : celles de l'export absentes de la base seront envoyées une à une avant l'import.
export function importSummaryLines(resume) {
  const list = (items) => (items.length === 0 ? 'aucun' : items.join(', '));
  const names = (items) => (items.length === 0 ? 'aucun' : items.map((t) => `${t.nom} (${t.id})`).join(', '));
  const b = resume.banque;
  const manquantes = resume.images_manquantes ?? [];
  return [
    `Images : ${resume.images_presentes ?? 0} déjà dans la base ; ${manquantes.length === 0 ? 'aucune à envoyer' : `${manquantes.length} à envoyer avant l'import (une par requête)`}${(resume.images_modifiees ?? []).length > 0 ? ` ; ${resume.images_modifiees.length} fiche(s) mise(s) à jour (nom, archivage)` : ''}.`,
    `Tables de référence ajoutées : ${list(resume.tables_ajoutees)}${resume.brouillon_tables ? ' ; le brouillon des tables est remplacé' : ''}.`,
    `Banque d'outils — ajoutés : ${names(b.ajoutes)} ; modifiés : ${names(b.modifies)} ; inchangés : ${b.gardes}.`,
    b.retires.length > 0
      ? `Banque d'outils — DISPARAÎTRAIENT : ${names(b.retires)}. Les copies déjà faites dans les exercices ne changent pas, mais ces outils ne pourront plus être ajoutés. Pour importer quand même, il faudra taper ${REPLACE_WORD}.`
      : "Banque d'outils — aucun outil ne disparaît.",
    `Exercices ajoutés : ${list(resume.exercices_ajoutes)}.`,
    `Brouillons remplacés : ${list(resume.exercices_remplaces)}.`,
    `Versions publiées ajoutées : ${list(resume.versions_ajoutees)}.`,
    `Exercices de la base absents de l'export, gardés tels quels : ${list(resume.exercices_gardes)}.`,
    'Les séances, les journaux et les attestations ne sont pas touchés.',
  ];
}
