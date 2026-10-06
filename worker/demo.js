// Règles d'une démo sur le serveur de correction (décision D92) : une séance ANONYME, sans identification, qui ne
// laisse aucune trace durable. Le serveur tire la question et la corrige comme pour une vraie séance (seance.js :
// gradeQuestion, correctionView, questionView — le même code, pas une copie) ; ce qui diffère est ici : le tirage
// (au hasard parmi les outils encore à évaluer, parmi tous les outils à 100 %, ou sur l'outil choisi), la validité
// de la question en attente quand l'outil choisi change, l'expiration après 24 h, et ce qu'on montre au navigateur.
//
// Fonctions PURES : ni base de données, ni réseau, ni horloge cachée. Le SQL est dans base.js, les routes dans index.js.

import { eligibleTools, restrictedTools } from '../site/js/progression.js';
import { generateQuestion } from '../site/js/question.js';
import { cadenceWait, isExerciseComplete, progressionView, questionView } from './seance.js';

const HOUR = 60 * 60 * 1000;

// Une démo expire 24 h après sa dernière activité : le serveur la refuse (401), et l'efface à la prochaine création.
export const DEMO_LIFETIME_MS = 24 * HOUR;

export function isDemoExpired(demo, now) {
  return new Date(demo.derniere_activite).getTime() + DEMO_LIFETIME_MS <= now.getTime();
}

// La date avant laquelle une dernière activité vaut expiration : DELETE … WHERE derniere_activite < ?.
export const expiredBefore = (now) => new Date(now.getTime() - DEMO_LIFETIME_MS).toISOString();

// L'outil choisi, tel que la requête le dit : null (« Au hasard » ; aussi absent ou vide), l'identifiant d'un outil
// de l'exercice, ou undefined si la valeur n'est ni l'un ni l'autre (la route répond 400).
export function demoToolChoice(value, exercise) {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' && exercise.outils.some((entry) => entry.id === value) ? value : undefined;
}

const progressOf = (counters, exercise) => ({ exerciceId: exercise.id, ...counters });

// La question en attente peut-elle encore être posée ? Oui si son outil est dans l'exercice et dans le catalogue de
// la version (toujours, pour une version publiée : elle ne change pas), et si elle est de l'outil choisi — ou si
// le choix est « Au hasard », qui garde la question en attente. Non si l'outil choisi est un autre : la démo en
// tire une de cet outil (D92, point 6). Non plus pour une question sans barre d'un outil à deux diamètres (D25).
export function isDemoQuestionValid(question, exercise, data, chosen) {
  if (question === null || question === undefined) return false;
  const tool = data.outils.find((entry) => entry.id === question.tool.id);
  if (!tool || !exercise.outils.some((entry) => entry.id === tool.id)) return false;
  if (tool.dimensions_barre && !question.bar) return false;
  return chosen === null || question.tool.id === chosen;
}

// Tire la prochaine question d'une démo : sur l'outil choisi (avec les restrictions de l'exercice, comme au
// hasard), ou au hasard parmi les outils encore à évaluer — et, à 100 %, parmi tous les outils de l'exercice : les
// questions ne s'arrêtent jamais (D92, point 7). Ne rend jamais null.
export function drawDemoQuestion(counters, exercise, data, random, chosen) {
  if (chosen !== null) return generateQuestion(data, restrictedTools(exercise, data).filter((tool) => tool.id === chosen), random);
  const remaining = eligibleTools(exercise, data, progressOf(counters, exercise));
  return generateQuestion(data, remaining.length > 0 ? remaining : restrictedTools(exercise, data), random);
}

// L'état d'une démo pour le navigateur : la même progression et la même question qu'une séance (sessionView),
// sans identité, avec l'outil choisi et « Démo réussie » (tous les outils à leurs réussites exigées).
//   demo    : la ligne de la table demos (colonnes JSON décodées, base.js)
//   options : { now, testMode, cadenceMs } — comme sessionView ; en mode test (D26, local), la question porte
//             reponses_test et la cadence est levée
export function demoView(demo, exercise, data, options = {}) {
  const chosen = demo.outil_choisi ?? null;
  const question = isDemoQuestionValid(demo.question_courante, exercise, data, chosen) ? demo.question_courante : null;
  return {
    demo: true,
    exercice: { id: exercise.id, titre: exercise.titre, version: exercise.version },
    outil_choisi: chosen,
    attendre_s: options.now ? cadenceWait(demo, options.now, options) : 0,
    progression: progressionView(demo.compteurs, exercise, data),
    reussie: isExerciseComplete(demo.compteurs, exercise),
    question: question === null ? null : questionView(question, exercise, data, options),
  };
}
