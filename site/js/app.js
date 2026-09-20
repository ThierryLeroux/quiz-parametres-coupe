// Orchestration d'une séance : choix de l'exercice, puis le cycle
//   nouvelle séance → question → correction → résultat enregistré → question suivante… → complétion.
//
// Aucun DOM ici : seulement des fonctions PURES, testables sous Node. Elles reçoivent l'état
// d'une séance (session.js) et en retournent un nouveau, sans modifier celui qu'elles reçoivent.
// L'aléa et l'heure sont injectés. Les écrans (à venir) n'auront qu'à appeler ces fonctions,
// sauvegarder l'état retourné (saveSession) et l'afficher.

import { fetchJson, loadData } from './data.js';
import { fieldsToGrade, loadExercise, loadExerciseIndex } from './exercice.js';
import { generateQuestion } from './question.js';
import { computeParameters } from './calcul.js';
import { formatParameters } from './format.js';
import { ANSWER_FIELDS, gradeAnswers } from './correction.js';
import { eligibleTools, isComplete, recordResult } from './progression.js';
import { createSession } from './session.js';

// --- Choix de l'exercice ---------------------------------------------------------------------

// Exercice demandé par l'adresse de la page : « ?exercice=<id> ».
//   search : location.search (ex. « ?exercice=m10-tournage-vc »)
//   index  : résultat de loadExerciseIndex, [{ id, titre }, …]
// Seuls les exercices de l'index sont offerts : id absent ou inconnu → le premier de l'index.
export function resolveExerciseId(search, index) {
  const requested = new URLSearchParams(search).get('exercice');
  const found = index.find((entry) => entry.id === requested);
  return (found ?? index[0]).id;
}

// L'exercice nommé par l'adresse, { id, titre }, ou null si l'adresse n'en nomme aucun ou en nomme
// un qui n'est pas dans l'index. L'accueil montre alors la liste des exercices (UI §3.1).
export function requestedExercise(search, index) {
  const requested = new URLSearchParams(search).get('exercice');
  return index.find((entry) => entry.id === requested) ?? null;
}

// Charge tout ce qu'il faut pour une séance : catalogue, index, exercice choisi par l'adresse.
//   readJson : lecteur injectable (fetch par défaut), comme dans loadData
export async function loadApp(search, readJson = fetchJson) {
  const data = await loadData('data/', readJson);
  const index = await loadExerciseIndex('exercices/', readJson);
  const exercise = await loadExercise(resolveExerciseId(search, index), data, 'exercices/', readJson);
  return { data, index, exercise };
}

// Une séance relue du stockage (loadSession) peut-elle continuer avec cet exercice ?
// Retourne l'état tel quel, ou null s'il faut démarrer une nouvelle séance : rien de sauvegardé,
// autre exercice, exercice modifié depuis (autre version), ou question sur un outil qui n'en fait plus partie.
export function restoreSession(saved, exercise) {
  if (saved === null) return null;
  if (saved.exerciceId !== exercise.id || saved.progression.exerciceId !== exercise.id) return null;
  if (saved.exerciceVersion !== exercise.version) return null;
  if (saved.question !== null && !exercise.outils.some((entry) => entry.id === saved.question.tool?.id)) return null;
  return saved;
}

// --- Cycle d'une séance ----------------------------------------------------------------------

const emptyAnswers = () => Object.fromEntries(ANSWER_FIELDS.map((field) => [field, '']));

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
