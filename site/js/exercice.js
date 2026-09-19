// Exercices configurables (décision D11, SPEC §10) : validation et chargement de
// site/exercices/<id>.json. Un exercice choisit dans le catalogue (data.js) les outils
// évalués, leurs réussites requises, les champs évalués et d'éventuelles restrictions.
// La même validation sert aux tests, au quiz et à l'éditeur.

import { fetchJson } from './data.js';

// Champ évalué tel qu'écrit dans l'exercice → nom du champ dans le moteur
// (computeParameters, gradeAnswers). L'ordre est celui de l'écran : Vc, fz, N, f, Vf.
export const GRADED_FIELD_KEYS = {
  vc: 'vc',
  fz: 'feedPerTooth',
  n: 'rpm',
  f: 'feedPerRev',
  vf: 'feedRate',
};

const EXERCISE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/; // minuscules, chiffres et tirets : c'est aussi le nom du fichier
const EXERCISE_KEYS = ['id', 'titre', 'version', 'multiplicateur_moodle', 'champs_evalues', 'outils'];
const TOOL_ENTRY_KEYS = ['id', 'reussites_requises', 'dimensions', 'groupes'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';

// Une clé inconnue est une erreur : « dimension » pour « dimensions » lèverait sinon la
// restriction en silence. Les clés qui commencent par « _ » sont des commentaires.
function checkKeys(object, allowed, where, errors) {
  for (const key of Object.keys(object)) {
    if (!key.startsWith('_') && !allowed.includes(key)) errors.push(`${where} : clé inconnue « ${key} » (clés permises : ${allowed.join(', ')})`);
  }
}

// Vérifie une liste de restriction facultative (dimensions ou groupes) : si elle est
// présente, elle doit être non vide, sans doublon, et ne nommer que des choix offerts par l'outil.
function checkRestriction(list, key, available, where, errors) {
  if (list === undefined) return;
  if (!Array.isArray(list) || list.length === 0) {
    errors.push(`${where} : « ${key} » doit être une liste non vide (ou être absente : aucune restriction)`);
    return;
  }
  list.forEach((item, i) => {
    if (!available.includes(item)) errors.push(`${where} : « ${key} » : « ${item} » n'existe pas sur cet outil`);
    else if (list.indexOf(item) !== i) errors.push(`${where} : « ${key} » : « ${item} » est en double`);
  });
}

// Vérifie un exercice contre le catalogue.
//   exercise : contenu de site/exercices/<id>.json
//   data     : résultat de loadData (data.js)
// Retourne la liste de TOUTES les erreurs, en français (liste vide = exercice valide).
// Ne lève jamais d'exception.
export function validateExercise(exercise, data) {
  const errors = [];
  if (!isObject(exercise)) return ["exercice : n'est pas un objet"];
  const where = `exercice « ${exercise.id} »`;
  checkKeys(exercise, EXERCISE_KEYS, where, errors);

  if (!isText(exercise.id) || !EXERCISE_ID.test(exercise.id)) errors.push(`${where} : « id » doit être fait de minuscules, de chiffres et de tirets (ex. « m10-tournage-vc »)`);
  if (!isText(exercise.titre)) errors.push(`${where} : « titre » est vide`);
  if (!isText(exercise.version)) errors.push(`${where} : « version » doit être un texte non vide (ex. « r0 »)`);
  if (!Number.isInteger(exercise.multiplicateur_moodle) || exercise.multiplicateur_moodle < 1) {
    errors.push(`${where} : « multiplicateur_moodle » doit être un entier ≥ 1`);
  }

  const fields = Array.isArray(exercise.champs_evalues) ? exercise.champs_evalues : [];
  if (fields.length === 0) errors.push(`${where} : « champs_evalues » doit être une liste non vide`);
  fields.forEach((field, i) => {
    if (!(field in GRADED_FIELD_KEYS)) errors.push(`${where} : champ évalué inconnu : « ${field} » (choix : ${Object.keys(GRADED_FIELD_KEYS).join(', ')})`);
    else if (fields.indexOf(field) !== i) errors.push(`${where} : champ évalué en double : « ${field} »`);
  });

  const entries = Array.isArray(exercise.outils) ? exercise.outils : [];
  if (entries.length === 0) errors.push(`${where} : « outils » doit être une liste non vide`);
  const seen = new Set();
  entries.forEach((entry, i) => {
    if (!isObject(entry)) return errors.push(`${where} : outils[${i}] n'est pas un objet`);
    const whereTool = `${where}, outils[${i}] « ${entry.id} »`;
    checkKeys(entry, TOOL_ENTRY_KEYS, whereTool, errors);

    if (seen.has(entry.id)) errors.push(`${whereTool} : outil en double`);
    seen.add(entry.id);
    if (!Number.isInteger(entry.reussites_requises) || entry.reussites_requises < 1) {
      errors.push(`${whereTool} : « reussites_requises » doit être un entier ≥ 1 (pour ne pas évaluer un outil, le retirer de la liste)`);
    }

    const tool = data.outils.find((o) => o.id === entry.id);
    if (!tool) return errors.push(`${whereTool} : cet outil n'existe pas dans le catalogue (outils.json)`);
    checkRestriction(entry.dimensions, 'dimensions', tool.dimensions.map((d) => d.libelle), whereTool, errors);
    checkRestriction(entry.groupes, 'groupes', tool.groupes_materiaux_usinables, whereTool, errors);
  });

  return errors;
}

// Charge et valide l'exercice `id`. Lève une erreur qui énumère tous les problèmes s'il est invalide.
//   data     : résultat de loadData (l'exercice est validé contre le catalogue)
//   readJson : lecteur injectable, comme dans loadData
export async function loadExercise(id, data, baseUrl = 'exercices/', readJson = fetchJson) {
  // L'id devient un nom de fichier : on refuse tout ce qui n'en a pas la forme (« ../autre »).
  if (!isText(id) || !EXERCISE_ID.test(id)) throw new Error(`Identifiant d'exercice invalide : « ${id} »`);

  const exercise = await readJson(`${baseUrl}${id}.json`);
  const errors = validateExercise(exercise, data);
  if (isObject(exercise) && exercise.id !== id) errors.push(`exercice « ${exercise.id} » : « id » doit être identique au nom du fichier (« ${id} »)`);
  if (errors.length > 0) throw new Error(`Exercice invalide (${id}.json) :\n- ${errors.join('\n- ')}`);
  return exercise;
}

// Champs à corriger, avec les noms du moteur : à passer tel quel à gradeAnswers (correction.js).
export function fieldsToGrade(exercise) {
  return exercise.champs_evalues.map((field) => GRADED_FIELD_KEYS[field]);
}
