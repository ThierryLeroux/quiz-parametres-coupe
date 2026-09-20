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
const EXERCISE_KEYS = ['id', 'titre', 'version', 'champs_evalues', 'outils'];
const TOOL_ENTRY_KEYS = ['id', 'reussites_requises', 'dimensions', 'materiaux_outil', 'groupes'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';

// Une clé inconnue est une erreur : « dimension » pour « dimensions » lèverait sinon la
// restriction en silence. Les clés qui commencent par « _ » sont des commentaires.
function checkKeys(object, allowed, where, errors) {
  for (const key of Object.keys(object)) {
    if (!key.startsWith('_') && !allowed.includes(key)) errors.push(`${where} : clé inconnue « ${key} » (clés permises : ${allowed.join(', ')})`);
  }
}

// Vérifie une liste de restriction facultative (dimensions, materiaux_outil ou groupes) : si elle est
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

  // « index » est réservé : index.json est la liste des exercices, pas un exercice.
  if (!isText(exercise.id) || !EXERCISE_ID.test(exercise.id) || exercise.id === 'index') errors.push(`${where} : « id » doit être fait de minuscules, de chiffres et de tirets (ex. « m10-tournage-vc »)`);
  if (!isText(exercise.titre)) errors.push(`${where} : « titre » est vide`);
  if (!isText(exercise.version)) errors.push(`${where} : « version » doit être un texte non vide (ex. « r0 »)`);

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
    checkRestriction(entry.materiaux_outil, 'materiaux_outil', tool.materiaux_outil, whereTool, errors);
    checkRestriction(entry.groupes, 'groupes', tool.groupes_materiaux_usinables, whereTool, errors);
  });

  return errors;
}

// Charge et valide l'exercice `id`. Lève une erreur qui énumère tous les problèmes s'il est invalide.
//   data     : résultat de loadData (l'exercice est validé contre le catalogue)
//   readJson : lecteur injectable, comme dans loadData
export async function loadExercise(id, data, baseUrl = 'exercices/', readJson = fetchJson) {
  // L'id devient un nom de fichier : on refuse tout ce qui n'en a pas la forme (« ../autre »).
  if (!isText(id) || !EXERCISE_ID.test(id) || id === 'index') throw new Error(`Identifiant d'exercice invalide : « ${id} »`);

  const exercise = await readJson(`${baseUrl}${id}.json`);
  const errors = validateExercise(exercise, data);
  if (isObject(exercise) && exercise.id !== id) errors.push(`exercice « ${exercise.id} » : « id » doit être identique au nom du fichier (« ${id} »)`);
  if (errors.length > 0) throw new Error(`Exercice invalide (${id}.json) :\n- ${errors.join('\n- ')}`);
  return exercise;
}

// ---------------------------------------------------------------------------
// Index des exercices offerts : site/exercices/index.json
// ---------------------------------------------------------------------------
// Un site statique ne peut pas lister un dossier : l'index dit quels exercices proposer à
// l'étudiant, dans quel ordre. Le premier est l'exercice par défaut (app.js).
//   { "exercices": [ { "id": "m10-tournage-vc", "titre": "M10 — …" }, … ] }

const INDEX_KEYS = ['exercices'];
const INDEX_ENTRY_KEYS = ['id', 'titre'];

// Vérifie la forme de l'index. Retourne la liste de toutes les erreurs (vide = index valide).
// La concordance avec les fichiers d'exercice (existence, même titre) est vérifiée par les tests.
export function validateExerciseIndex(index) {
  const errors = [];
  if (!isObject(index)) return ["index des exercices : n'est pas un objet"];
  checkKeys(index, INDEX_KEYS, 'index des exercices', errors);

  const entries = Array.isArray(index.exercices) ? index.exercices : [];
  if (entries.length === 0) errors.push('index des exercices : « exercices » doit être une liste non vide');
  const seen = new Set();
  entries.forEach((entry, i) => {
    if (!isObject(entry)) return errors.push(`index des exercices : exercices[${i}] n'est pas un objet`);
    const where = `index des exercices, exercices[${i}] « ${entry.id} »`;
    checkKeys(entry, INDEX_ENTRY_KEYS, where, errors);
    if (!isText(entry.id) || !EXERCISE_ID.test(entry.id) || entry.id === 'index') errors.push(`${where} : « id » n'a pas la forme d'un identifiant d'exercice (ex. « m10-tournage-vc »)`);
    else if (seen.has(entry.id)) errors.push(`${where} : exercice en double`);
    seen.add(entry.id);
    if (!isText(entry.titre)) errors.push(`${where} : « titre » est vide`);
  });
  return errors;
}

// Charge et valide l'index. Retourne la liste [{ id, titre }, …], dans l'ordre du fichier.
export async function loadExerciseIndex(baseUrl = 'exercices/', readJson = fetchJson) {
  const index = await readJson(`${baseUrl}index.json`);
  const errors = validateExerciseIndex(index);
  if (errors.length > 0) throw new Error(`Index des exercices invalide (index.json) :\n- ${errors.join('\n- ')}`);
  return index.exercices.map(({ id, titre }) => ({ id, titre }));
}

// Champs à corriger, avec les noms du moteur : à passer tel quel à gradeAnswers (correction.js).
export function fieldsToGrade(exercise) {
  return exercise.champs_evalues.map((field) => GRADED_FIELD_KEYS[field]);
}
