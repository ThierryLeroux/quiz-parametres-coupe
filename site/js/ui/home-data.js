// Ce que montrent l'accueil unique et la page de description d'un exercice (D71 ; UI §3.1) : fonctions PURES,
// sans DOM, testées sous Node ; home-screen.js ne fait que les mettre à l'écran. Tout vient de ce que le
// serveur publie déjà (GET /api/exercices, GET /api/exercice : la dernière version publiée) — jamais rien de
// ce qui est à trouver.

import { allowedGroups, allowedToolMaterials, courseKey } from '../exercice.js';
import { toolLabels } from './rules.js';
import { operationPictoOf, toolPhotoUrl } from './sheets-data.js';
import { fieldName } from './text.js';

// Le lien d'un exercice, celui qu'on donne sur Léa : il mène à sa page de description (D71).
export const exerciseLink = (origin, id) => `${origin}/?exercice=${encodeURIComponent(id)}`;

// --- Accueil -------------------------------------------------------------------------------------------------------

// Les exercices de l'accueil regroupés par cours, dans l'ordre des rangs (celui de la liste reçue) : un groupe
// par clé de cours (courseKey : « m10 » et « M-10 » vont avec « M10 »), sous l'écriture du premier exercice du
// groupe ; les exercices sans cours en dernier, sous « Autres exercices ». Sans aucun cours, un seul groupe, sans
// titre. Retourne [{ title, exercises }] — title vaut null pour ce groupe sans titre.
//   exercises : [{ id, titre, cours, … }] (GET /api/exercices)
export function homeGroups(exercises) {
  const groups = new Map();
  const others = [];
  for (const entry of exercises) {
    const key = courseKey(entry.cours);
    if (key === '') {
      others.push(entry);
      continue;
    }
    if (!groups.has(key)) groups.set(key, { title: entry.cours.trim(), exercises: [] });
    groups.get(key).exercises.push(entry);
  }
  if (groups.size === 0) return others.length === 0 ? [] : [{ title: null, exercises: others }];
  return [...groups.values(), ...(others.length === 0 ? [] : [{ title: 'Autres exercices', exercises: others }])];
}

// --- Page de description d'un exercice -------------------------------------------------------------------------------

const FIELDS = [['vc', 'Vc'], ['fz', 'fz'], ['n', 'N'], ['f', 'f'], ['vf', 'Vf']];

// « a », « a et b », « a, b et c ».
const joined = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items.at(-1)}`);

// Les questions posées : les grandeurs à trouver, fournies et non demandées, en toutes lettres avec leur symbole,
// dans l'ordre de l'écran. Les mêmes pour chaque outil : l'exercice les règle pour tous (D52). Les cinq grandeurs
// sont du féminin (« fournies »).
//   exercise : l'exercice au format du moteur (champs_evalues, champs_masques)
export function questionLines(exercise) {
  const graded = exercise.champs_evalues;
  const masked = exercise.champs_masques ?? [];
  const named = (keep) => FIELDS.filter(([key]) => keep(key)).map(([key, symbol]) => `${fieldName(key)} (${symbol})`);
  const find = named((key) => graded.includes(key));
  const given = named((key) => !graded.includes(key) && !masked.includes(key));
  const hidden = named((key) => masked.includes(key));
  return [
    `À trouver : ${joined(find)}.`,
    ...(given.length === 0 ? [] : [`${given.length > 1 ? 'Fournies' : 'Fournie'} par l'exercice : ${joined(given)}.`]),
    ...(hidden.length === 0 ? [] : [`${hidden.length > 1 ? 'Non demandées' : 'Non demandée'} : ${joined(hidden)}.`]),
  ];
}

// La plage de dimensions d'un outil de l'exercice : « Ø 1/64 po à Ø 1 po », ou le libellé s'il n'y en a qu'une —
// comme la progression et l'attestation. Les dimensions d'une copie sont déjà celles que l'exercice permet (D47) ;
// une entrée de fichier d'exercice peut encore les restreindre (SPEC §10).
function dimensionRange(tool, entry) {
  const labels = tool.dimensions.map((d) => d.libelle).filter((label) => !Array.isArray(entry.dimensions) || entry.dimensions.includes(label));
  return labels.length === 1 ? labels[0] : `${labels[0]} à ${labels.at(-1)}`;
}

// Les outils questionnés, dans l'ordre de l'exercice : [{ id, label, photo, operation, picto, range, materials, streak }]
//   label     : le nom tel que la progression l'écrit (« SDTMR (métrique) » quand deux outils portent le même nom)
//   photo     : l'adresse de sa photo (/images/<id>) ; picto : celle du pictogramme de son opération
//   materials : les matières d'outil que l'exercice permet pour lui ; streak : les réussites de suite exigées
//   data      : le catalogue de la version (assembleData)
export function toolRows(exercise, data) {
  const labels = toolLabels(exercise, data);
  return exercise.outils.map((entry) => {
    const tool = data.outils.find((candidate) => candidate.id === entry.id);
    return {
      id: tool.id,
      label: labels.get(tool.id) ?? tool.nom,
      photo: toolPhotoUrl(tool),
      operation: tool.operation,
      picto: operationPictoOf(data, tool.operation),
      range: dimensionRange(tool, entry),
      materials: allowedToolMaterials(exercise, entry, tool),
      streak: entry.reussites_requises,
    };
  });
}

// « 3 réussites de suite », « 1 réussite de suite ».
export const streakText = (n) => `${n} réussite${n > 1 ? 's' : ''} de suite`;

// Les matériaux usinés possibles : les groupes qu'au moins un outil peut tirer, par classe ISO, dans l'ordre des
// tables. Retourne [{ code, name, groups: ['Acier non allié', …] }] — name : le nom de la classe dans les tables.
export function materialGroups(exercise, data) {
  const used = new Set(exercise.outils.flatMap((entry) => allowedGroups(exercise, entry, data.outils.find((tool) => tool.id === entry.id))));
  const classes = new Map();
  for (const [group, rows] of data.materialsByGroup) {
    if (!used.has(group) || rows.length === 0) continue;
    const code = rows[0].iso;
    if (!classes.has(code)) classes.set(code, { code, name: (data.classesIso ?? []).find((c) => c.code === code)?.nom ?? null, groups: [] });
    classes.get(code).groups.push(rows[0].materiau);
  }
  return [...classes.values()];
}
