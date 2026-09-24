// Exercices configurables (décision D11, SPEC §10) : validation et chargement de
// site/exercices/<id>.json. Un exercice choisit dans le catalogue (data.js) les outils
// évalués, leurs réussites requises, les champs évalués et d'éventuelles restrictions.
// La même validation sert aux tests, au quiz et à l'éditeur.

import { TOOL_KEYS, TOOL_MATERIAL_KEYS, fetchJson, toolErrors } from './data.js';

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
const EXERCISE_KEYS = ['id', 'titre', 'version', 'champs_evalues', 'outils', 'liste', 'materiaux_outil', 'groupes'];
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
//   origin : d'où viennent les choix offerts, pour le message (« sur cet outil », « dans le catalogue »)
function checkRestriction(list, key, available, where, errors, origin = 'sur cet outil') {
  if (list === undefined) return;
  if (!Array.isArray(list) || list.length === 0) {
    errors.push(`${where} : « ${key} » doit être une liste non vide (ou être absente : aucune restriction)`);
    return;
  }
  list.forEach((item, i) => {
    if (!available.includes(item)) errors.push(`${where} : « ${key} » : « ${item} » n'existe pas ${origin}`);
    else if (list.indexOf(item) !== i) errors.push(`${where} : « ${key} » : « ${item} » est en double`);
  });
}

// Les matériaux d'outil qu'un outil peut tirer dans cet exercice (décision D40) : ceux de l'outil,
// restreints par la liste de l'exercice (`materiaux_outil` à la racine, pour tous les outils) et par
// celle de l'entrée (`outils[].materiaux_outil`, pour cet outil). Liste vide = l'outil n'a plus rien
// à tirer : l'exercice est refusé (validateExercise).
export function allowedToolMaterials(exercise, entry, tool) {
  const permitted = (list, material) => !Array.isArray(list) || list.includes(material);
  return tool.materiaux_outil.filter((material) => permitted(exercise.materiaux_outil, material) && permitted(entry.materiaux_outil, material));
}

// Même chose pour les groupes de matériaux usinés (jalon 7) : ceux de l'outil, restreints par la
// liste de l'exercice (`groupes` à la racine, pour tous les outils) et par celle de l'entrée.
export function allowedGroups(exercise, entry, tool) {
  const permitted = (list, group) => !Array.isArray(list) || list.includes(group);
  return tool.groupes_materiaux_usinables.filter((group) => permitted(exercise.groupes, group) && permitted(entry.groupes, group));
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
  // « liste »: false retire l'exercice de la liste de l'accueil (D30) ; il reste joignable par « ?exercice=<id> ».
  if (exercise.liste !== undefined && typeof exercise.liste !== 'boolean') errors.push(`${where} : « liste » doit être true ou false (ou absente : l'exercice est listé)`);
  // Restriction de matière d'outil pour tout l'exercice (D40) : chaque nom doit être un matériau d'outil du catalogue.
  checkRestriction(exercise.materiaux_outil, 'materiaux_outil', Object.keys(TOOL_MATERIAL_KEYS), where, errors, 'dans le catalogue');
  // Restriction des groupes de matériaux usinés pour tout l'exercice (jalon 7) : chaque groupe doit exister dans le catalogue.
  checkRestriction(exercise.groupes, 'groupes', [...data.materialsByGroup.keys()], where, errors, 'dans le catalogue');

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
    // Un outil dont aucune matière ne reste permise ne pourrait jamais être tiré : refusé, en le disant.
    if (Array.isArray(exercise.materiaux_outil) && exercise.materiaux_outil.length > 0 && allowedToolMaterials(exercise, entry, tool).length === 0) {
      errors.push(`${whereTool} : plus aucune matière d'outil permise — l'outil offre ${tool.materiaux_outil.join(', ')} ; l'exercice permet ${exercise.materiaux_outil.join(', ')}`);
    }
    if (Array.isArray(exercise.groupes) && exercise.groupes.length > 0 && allowedGroups(exercise, entry, tool).length === 0) {
      errors.push(`${whereTool} : plus aucun groupe de matériaux permis — l'outil usine ${tool.groupes_materiaux_usinables.join(', ')} ; l'exercice permet ${exercise.groupes.join(', ')}`);
    }
  });

  return errors;
}

// ---------------------------------------------------------------------------
// Exercice avec ses copies d'outils (jalon 7, décision D47) : le format enregistré en base
// ---------------------------------------------------------------------------
// Depuis le jalon 7, un exercice ne référence plus les outils du catalogue : il porte ses propres
// COPIES, indépendantes de la banque d'outils. Modifier la banque ne change aucun exercice.
// Le brouillon d'un exercice et chacune de ses versions publiées ont cette forme :
//   { titre, champs_evalues, materiaux_outil?, groupes?, liste?, outils: [copie, …] }
// où une copie est un outil au format d'outils.json (TOOL_KEYS), plus `reussites_requises` et,
// à titre d'information, `origine` (l'id de l'outil de la banque dont elle vient).
// Ses dimensions, ses matières et ses groupes SONT ce que l'exercice permet : plus de restrictions
// par outil (elles s'appliquent en retirant de la copie), seules restent celles de tout l'exercice.

export const DRAFT_KEYS = ['titre', 'champs_evalues', 'materiaux_outil', 'groupes', 'liste', 'outils'];
export const COPY_KEYS = [...TOOL_KEYS, 'reussites_requises', 'origine'];

// La copie d'un outil du catalogue pour un exercice, avec les restrictions d'une entrée
// d'exercice (SPEC §10) déjà appliquées : dimensions, materiaux_outil, groupes.
//   tool  : l'outil de la banque (ou d'un autre exercice)
//   entry : { id?, reussites_requises?, dimensions?, materiaux_outil?, groupes? }
export function copyOfTool(tool, entry = {}) {
  const keep = (choices, allowed, labelOf = (choice) => choice) => (Array.isArray(allowed) ? choices.filter((choice) => allowed.includes(labelOf(choice))) : choices);
  const copy = {};
  for (const key of TOOL_KEYS) if (tool[key] !== undefined) copy[key] = structuredClone(tool[key]);
  copy.id = entry.id ?? tool.id;
  copy.image = tool.image ?? tool.id; // la photo de l'outil (site/img/outils/<image>.png) : une copie renommée garde la sienne
  copy.dimensions = keep(tool.dimensions, entry.dimensions, (d) => d.libelle);
  copy.materiaux_outil = keep(tool.materiaux_outil, entry.materiaux_outil);
  copy.groupes_materiaux_usinables = keep(tool.groupes_materiaux_usinables, entry.groupes);
  copy.reussites_requises = entry.reussites_requises ?? 1;
  copy.origine = tool.origine ?? tool.id;
  return copy;
}

// Le brouillon d'un exercice à partir d'un fichier d'exercice (SPEC §10) et du catalogue : c'est
// ainsi que la semence de la base (migration 0005) et les tests convertissent les exercices JSON.
export function draftFromExercise(exercise, tools) {
  const draft = { titre: exercise.titre, champs_evalues: [...exercise.champs_evalues] };
  if (exercise.materiaux_outil) draft.materiaux_outil = [...exercise.materiaux_outil];
  if (exercise.groupes) draft.groupes = [...exercise.groupes];
  if (exercise.liste === false) draft.liste = false;
  draft.outils = exercise.outils.map((entry) => {
    const tool = tools.find((candidate) => candidate.id === entry.id);
    if (!tool) throw new Error(`Exercice « ${exercise.id} » : l'outil « ${entry.id} » n'existe pas dans le catalogue`);
    return copyOfTool(tool, entry);
  });
  return draft;
}

// Ce que le moteur attend d'un exercice enregistré : l'exercice (SPEC §10, sans restriction par
// outil) et la liste des outils (les copies, sans ce qui n'est pas une propriété d'outil).
//   id      : l'identifiant d'URL de l'exercice
//   version : le numéro de la version publiée (le texte qui figure sur l'attestation), ou « brouillon »
export function engineExercise(id, version, draft) {
  const tools = draft.outils.map(({ reussites_requises: _r, origine: _o, ...tool }) => tool);
  const exercise = { id, titre: draft.titre, version: String(version), champs_evalues: draft.champs_evalues, outils: draft.outils.map((copy) => ({ id: copy.id, reussites_requises: copy.reussites_requises })) };
  if (draft.materiaux_outil) exercise.materiaux_outil = draft.materiaux_outil;
  if (draft.groupes) exercise.groupes = draft.groupes;
  if (draft.liste === false) exercise.liste = false;
  return { exercise, tools };
}

// Les erreurs d'un brouillon, chacune avec le champ en cause : [{ champ, message }] — « titre »,
// « outils.2.fact_vc »… L'éditeur les écrit à côté du champ, le serveur refuse de publier tant
// qu'il en reste. La règle d'un outil est celle du catalogue (toolErrors : le même validateData que le quiz).
//   tables : { materiaux, operations } — le contenu des deux tables de référence, tels quels
// Ne lève jamais d'exception ; liste vide = brouillon publiable.
export function draftErrors(draft, tables) {
  const errors = [];
  const error = (champ, message) => errors.push({ champ, message });
  if (!isObject(draft)) return [{ champ: '', message: "le brouillon n'est pas un objet" }];
  for (const key of Object.keys(draft)) if (!key.startsWith('_') && !DRAFT_KEYS.includes(key)) error(key, `clé inconnue « ${key} »`);

  const groups = Array.isArray(tables?.materiaux?.groupes_iso) ? tables.materiaux.groupes_iso : [];
  const opsByName = new Map((Array.isArray(tables?.operations?.operations) ? tables.operations.operations : []).filter(isObject).map((op) => [op.operation, op]));

  if (!isText(draft.titre)) error('titre', 'Le titre est vide.');
  if (draft.liste !== undefined && typeof draft.liste !== 'boolean') error('liste', '« liste » doit être true ou false');
  const fields = Array.isArray(draft.champs_evalues) ? draft.champs_evalues : [];
  if (fields.length === 0) error('champs_evalues', 'Au moins une grandeur doit être évaluée.');
  fields.forEach((field, i) => {
    if (!(field in GRADED_FIELD_KEYS)) error('champs_evalues', `grandeur inconnue : « ${field} » (choix : ${Object.keys(GRADED_FIELD_KEYS).join(', ')})`);
    else if (fields.indexOf(field) !== i) error('champs_evalues', `grandeur en double : « ${field} »`);
  });
  const listErrors = (list, key, available, label) => {
    if (list === undefined) return;
    if (!Array.isArray(list) || list.length === 0) return error(key, `${label} : la liste doit être non vide, ou absente (aucune restriction).`);
    list.forEach((item, i) => {
      if (!available.includes(item)) error(key, `${label} : « ${item} » n'existe pas dans les tables de référence`);
      else if (list.indexOf(item) !== i) error(key, `${label} : « ${item} » est en double`);
    });
  };
  listErrors(draft.materiaux_outil, 'materiaux_outil', Object.keys(TOOL_MATERIAL_KEYS), "Matières d'outil permises");
  listErrors(draft.groupes, 'groupes', groups, 'Groupes de matériaux permis');

  const copies = Array.isArray(draft.outils) ? draft.outils : [];
  if (copies.length === 0) error('outils', "L'exercice doit avoir au moins un outil.");
  const seen = new Set();
  copies.forEach((copy, i) => {
    const at = (champ) => `outils.${i}.${champ}`;
    if (!isObject(copy)) return error(`outils.${i}`, "cet outil n'est pas un objet");
    for (const key of Object.keys(copy)) if (!key.startsWith('_') && !COPY_KEYS.includes(key)) error(at(key), `clé inconnue « ${key} »`);
    if (seen.has(copy.id)) error(at('id'), `identifiant en double : « ${copy.id} » — deux outils d'un exercice ne peuvent pas porter le même identifiant`);
    seen.add(copy.id);
    if (!Number.isInteger(copy.reussites_requises) || copy.reussites_requises < 1) error(at('reussites_requises'), 'Les réussites de suite exigées doivent être un entier ≥ 1 (pour ne pas évaluer un outil, le retirer).');
    const { reussites_requises: _r, origine: _o, ...tool } = copy;
    for (const { champ, message } of toolErrors(tool, opsByName, groups)) error(at(champ), message);
    if (Array.isArray(tool.materiaux_outil) && Array.isArray(draft.materiaux_outil) && draft.materiaux_outil.length > 0 && allowedToolMaterials(draft, {}, tool).length === 0) {
      error(at('materiaux_outil'), `plus aucune matière d'outil permise — l'outil offre ${tool.materiaux_outil.join(', ')} ; l'exercice permet ${draft.materiaux_outil.join(', ')}`);
    }
    if (Array.isArray(tool.groupes_materiaux_usinables) && Array.isArray(draft.groupes) && draft.groupes.length > 0 && allowedGroups(draft, {}, tool).length === 0) {
      error(at('groupes_materiaux_usinables'), `plus aucun groupe de matériaux permis — l'outil usine ${tool.groupes_materiaux_usinables.join(', ')} ; l'exercice permet ${draft.groupes.join(', ')}`);
    }
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
