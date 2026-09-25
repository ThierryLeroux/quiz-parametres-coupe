// Ce que montre l'éditeur (jalon 7a, décisions D47 à D49 ; UI §3.9) : état d'un exercice dans la
// liste, différences entre le brouillon et la dernière version (confirmation de publication), texte
// des dimensions dans le formulaire d'outil, exemple composé du gabarit de nomenclature, erreurs par
// champ, lignes de l'aperçu, résumé d'un import. Fonctions PURES, sans DOM, testées sous Node ;
// editeur.js ne fait que les mettre à l'écran.

import { TOOL_MATERIAL_KEYS, fittingBars, parseThread, templateTokens } from '../data.js';
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

// Les matières d'outil, dans l'ordre de la table des Vc.
export const TOOL_MATERIALS = Object.keys(TOOL_MATERIAL_KEYS);

// --- Couleurs de sens (UI §1), les mêmes que les feuilles de référence : les variables de tokens.css ----------------

// La pastille d'une matière d'outil : la couleur de l'en-tête de colonne de la table des Vc.
export function materialSwatch(label) {
  const key = TOOL_MATERIAL_KEYS[label];
  return { background: `var(--tool-${key.replaceAll('_', '-')})`, text: '#000000', letter: '' };
}

// La pastille d'un groupe de matériaux usinés : la lettre de sa classe ISO sur la couleur vive de la
// classe (le rouge K éclairci pour le fond nuit, comme le panneau du matériau brut).
export function groupSwatch(group) {
  const letter = String(group).trim().charAt(0).toUpperCase();
  const iso = letter.toLowerCase();
  return { background: `var(--iso-${iso}${iso === 'k' ? '-night' : ''})`, text: `var(--iso-${iso}-text)`, letter };
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
// Retourne { premiere, reglages: [...], ajoutes: [copies], retires: [copies], modifies: [{ id, nom, champs }] }.
export function versionDiff(before, after) {
  if (before === null) return { premiere: true, reglages: [], ajoutes: after.outils, retires: [], modifies: [] };
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
  };
}

// Le résumé en lignes de texte : ce que la boîte de confirmation affiche.
export function diffLines(diff) {
  if (diff.premiere) return [`Première publication : ${diff.ajoutes.length} outil${diff.ajoutes.length > 1 ? 's' : ''}.`];
  const lines = [];
  for (const r of diff.reglages) lines.push(`${r.label} : « ${r.avant} » → « ${r.apres} »`);
  for (const copy of diff.ajoutes) lines.push(`Outil ajouté : ${copy.nom} (${copy.id}), ${copy.reussites_requises} réussite${copy.reussites_requises > 1 ? 's' : ''} de suite`);
  for (const copy of diff.retires) lines.push(`Outil retiré : ${copy.nom} (${copy.id})`);
  for (const entry of diff.modifies) for (const c of entry.champs) lines.push(`${entry.nom} (${entry.id}) — ${c.champ} : « ${c.avant} » → « ${c.apres} »`);
  if (diff.reordonnes) lines.push("L'ordre des outils a changé.");
  if (lines.length === 0) lines.push('Aucune différence avec la version précédente.');
  return lines;
}

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

// L'exemple composé du gabarit de nomenclature (D24), avec la première dimension, le moins de dents,
// la première matière et la première barre qui entre : « MVLNR - Ø charioté: 1.000" ».
export function exampleIdentifier(tool, opsByName) {
  const template = typeof tool.format_identifiant === 'string' ? tool.format_identifiant : '';
  const dimension = Array.isArray(tool.dimensions) ? tool.dimensions[0] : undefined;
  const op = opsByName.get(tool.operation);
  const thread = op?.avance_egale_pas_filetage === true && dimension ? parseThread(dimension.valeur) : null;
  const diameter = thread ? thread.diameter : (typeof dimension?.valeur === 'number' ? dimension.valeur : null);
  const inches = (value) => (value === null || value === undefined ? null : String(Number(value.toFixed(5))));
  const bar = diameter !== null && tool.dimensions_barre ? fittingBars(tool, diameter)[0] : null;
  const values = {
    IdDia: dimension?.libelle ?? null,
    Dia: diameter === null ? null : inches(diameter),
    Pas: thread ? inches(thread.pitch) : null,
    IdBarre: bar?.libelle ?? null,
    NbDent: tool.nb_dents_min ?? null,
    NomOutil: tool.nom ?? null,
    Operation: tool.operation ?? null,
    Matoutil: Array.isArray(tool.materiaux_outil) ? tool.materiaux_outil[0] ?? null : null,
  };
  return template.replace(/\[([^\]]*)\]/g, (token, name) => (values[name] === null || values[name] === undefined ? token : String(values[name])));
}

// Les jetons que le gabarit utilise, pour la note sous le champ.
export const templateTokenList = (template) => templateTokens(typeof template === 'string' ? template : '');

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

// Ce que l'import ferait, en phrases : la banque outil par outil (ajoutés, modifiés, retirés par nom, D50).
export function importSummaryLines(resume) {
  const list = (items) => (items.length === 0 ? 'aucun' : items.join(', '));
  const names = (items) => (items.length === 0 ? 'aucun' : items.map((t) => `${t.nom} (${t.id})`).join(', '));
  const b = resume.banque;
  return [
    `Tables de référence ajoutées : ${list(resume.tables_ajoutees)}.`,
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
