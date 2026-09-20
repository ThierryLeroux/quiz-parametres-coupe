// Orchestration d'une séance : choix de l'exercice, puis le cycle
//   nouvelle séance → question → correction → résultat enregistré → question suivante… → complétion.
//
// Aucun DOM ici : seulement des fonctions PURES, testables sous Node. Elles reçoivent l'état
// d'une séance et en retournent un nouveau, sans modifier celui qu'elles reçoivent. L'aléa et
// l'heure sont injectés.
//
// Depuis D19, l'état d'une séance vit sur le serveur de correction : le navigateur n'appelle plus
// que le « choix de l'exercice » ci-dessous, et passe par api.js pour tout le reste. Le cycle
// d'une séance est gardé ici, testé, pour le serveur (jalon 3) ; l'état reste un simple objet
// JSON, qui se range tel quel dans une base.

import { fetchJson, loadData } from './data.js';
import { fieldsToGrade, loadExercise, loadExerciseIndex } from './exercice.js';
import { generateQuestion } from './question.js';
import { computeParameters } from './calcul.js';
import { formatParameters } from './format.js';
import { ANSWER_FIELDS, gradeAnswers } from './correction.js';
import { createProgress, eligibleTools, isComplete, recordResult } from './progression.js';
import { cleanStudent, validateStudent } from './identification.js';

// --- Choix de l'exercice ---------------------------------------------------------------------

// Exercice demandé par l'adresse de la page : « ?exercice=<id> » (décision D18).
//   search : location.search (ex. « ?exercice=m10-tournage-vc »)
//   index  : résultat de loadExerciseIndex, [{ id, titre }, …]
// Retourne { exercise, unknownId } :
//   exercise  : l'entrée { id, titre } de l'index, ou null si l'adresse n'en nomme aucune
//   unknownId : ce que l'adresse demande et qui n'est PAS dans l'index, ou null
// Seuls les exercices de l'index sont offerts, et il n'y a aucun repli : sans exercice reconnu,
// l'accueil montre la liste des exercices (UI §3.1).
export function requestedExercise(search, index) {
  const requested = new URLSearchParams(search).get('exercice') || null;
  const exercise = index.find((entry) => entry.id === requested) ?? null;
  return { exercise, unknownId: exercise === null ? requested : null };
}

// Charge tout ce qu'il faut à la page : catalogue, index, et l'exercice nommé par l'adresse.
// Retourne { data, index, exercise, unknownId } — exercise vaut null si l'adresse n'en nomme
// aucun de l'index (voir requestedExercise) : aucun fichier d'exercice n'est alors lu.
//   readJson : lecteur injectable (fetch par défaut), comme dans loadData
export async function loadApp(search, readJson = fetchJson) {
  const data = await loadData('data/', readJson);
  const index = await loadExerciseIndex('exercices/', readJson);
  const { exercise: entry, unknownId } = requestedExercise(search, index);
  const exercise = entry === null ? null : await loadExercise(entry.id, data, 'exercices/', readJson);
  return { data, index, exercise, unknownId };
}

// Une séance enregistrée peut-elle continuer avec cet exercice ?
// Retourne l'état tel quel, ou null s'il faut démarrer une nouvelle séance : rien d'enregistré,
// autre exercice, exercice modifié depuis (autre version), ou question sur un outil qui n'en fait plus partie.
// ❓ SPEC §7, point 4 : ce que le serveur fera d'une séance dont l'exercice a changé reste à confirmer.
export function restoreSession(saved, exercise) {
  if (saved === null) return null;
  if (saved.exerciceId !== exercise.id || saved.progression.exerciceId !== exercise.id) return null;
  if (saved.exerciceVersion !== exercise.version) return null;
  if (saved.question !== null && !exercise.outils.some((entry) => entry.id === saved.question.tool?.id)) return null;
  return saved;
}

// --- Cycle d'une séance ----------------------------------------------------------------------

const emptyAnswers = () => Object.fromEntries(ANSWER_FIELDS.map((field) => [field, '']));

// État de départ d'une séance : étudiant identifié, exercice choisi, aucune question encore.
//   student : { prenom, nom, matricule, nip } — le NIP est vérifié, mais n'entre JAMAIS dans l'état
//   now     : Date du début (injectable pour les tests)
export function createSession(student, exercise, now) {
  const errors = validateStudent(student);
  if (errors.length > 0) throw new Error(`Identification invalide :\n- ${errors.join('\n- ')}`);
  const { prenom, nom, matricule } = cleanStudent(student);
  return {
    etudiant: { prenom, nom, matricule },
    exerciceId: exercise.id,
    exerciceVersion: exercise.version,
    debut: now.toISOString(),
    reussite: null, // date de réussite de l'exercice, quand il est complété
    progression: createProgress(exercise),
    question: null, // question en cours (generateQuestion)
    saisies: {}, // saisies de la question en cours, en texte : { vc, feedPerTooth, rpm, feedPerRev, feedRate }
    correction: null, // résultat de gradeAnswers une fois la question corrigée ; null tant qu'elle ne l'est pas
    questionsReussies: [], // pour le rapport (SPEC §8) : { question, attendu, date } de chaque question réussie
  };
}

// Nouvelle séance : identifie l'étudiant (createSession lève une erreur si l'identification
// est invalide) et tire la première question.
export function startSession(student, exercise, data, now, random = Math.random) {
  return nextQuestion(createSession(student, exercise, now), exercise, data, random);
}

// Tire la question suivante parmi les outils encore à évaluer. Si l'exercice est complété,
// il n'y a plus de question : `question` vaut null.
// Une question posée doit être corrigée avant d'en demander une autre : on ne « passe » pas une question.
export function nextQuestion(state, exercise, data, random = Math.random) {
  if (state.question !== null && state.correction === null) {
    throw new Error('La question en cours doit être corrigée avant de passer à la suivante');
  }
  const tools = eligibleTools(exercise, data, state.progression);
  const question = tools.length > 0 ? generateQuestion(data, tools, random) : null;
  return { ...state, question, saisies: emptyAnswers(), correction: null };
}

// Mémorise ce que l'étudiant est en train de taper, pour le retrouver après un rechargement.
// Sans effet sur une question déjà corrigée.
export function updateAnswers(state, answers) {
  if (state.question === null || state.correction !== null) return state;
  return { ...state, saisies: { ...state.saisies, ...answers } };
}

// Corrige la question en cours avec les saisies `answers`, enregistre le résultat dans la
// progression et, si l'exercice est complété, note la date de réussite. La question et sa
// correction restent dans l'état (pour les montrer) jusqu'à nextQuestion.
// Une question n'est corrigée qu'une fois : un second appel lève une erreur.
export function submitAnswers(state, exercise, data, answers, now) {
  if (state.question === null) throw new Error('Aucune question en cours');
  if (state.correction !== null) throw new Error('Cette question a déjà été corrigée');

  const expected = computeParameters(state.question, data);
  const correction = gradeAnswers(expected, answers, fieldsToGrade(exercise));
  const progression = recordResult(state.progression, state.question.tool.id, correction.success);
  const date = now.toISOString();

  return {
    ...state,
    saisies: { ...emptyAnswers(), ...answers },
    correction,
    progression,
    questionsReussies: correction.success
      ? [...state.questionsReussies, { question: state.question, attendu: expected, date }]
      : state.questionsReussies,
    reussite: state.reussite ?? (isComplete(exercise, progression) ? date : null),
  };
}

// --- Ce que l'écran doit montrer ---------------------------------------------------------------

// Les 5 champs de la question en cours, dans l'ordre de l'écran (SPEC §10) :
//   { field, graded, text }
//   graded = true  : champ évalué — `text` est la saisie de l'étudiant
//   graded = false : champ pré-rempli — `text` est la valeur théorique mise en forme (SPEC §5)
// Retourne [] s'il n'y a pas de question en cours.
export function answerFields(state, exercise, data) {
  if (state.question === null) return [];
  const graded = fieldsToGrade(exercise);
  const displayed = formatParameters(computeParameters(state.question, data));
  return ANSWER_FIELDS.map((field) => (graded.includes(field)
    ? { field, graded: true, text: state.saisies[field] ?? '' }
    : { field, graded: false, text: displayed[field] }));
}

// Où en est la séance ?
//   « question »   : une question attend sa réponse
//   « correction » : la question est corrigée ; on attend nextQuestion
//   « reussite »   : l'exercice est complété et la dernière correction a été vue
//   « depart »     : séance créée sans question (createSession seul ; startSession n'y passe pas)
export function sessionStep(state) {
  if (state.question !== null) return state.correction === null ? 'question' : 'correction';
  return state.reussite !== null ? 'reussite' : 'depart';
}
