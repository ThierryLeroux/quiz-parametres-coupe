// Démarrage de la page : ce qu'il faut charger, et quel exercice l'adresse demande.
//
// Aucun DOM ici : seulement des fonctions testables sous Node. Depuis D19, tout le reste d'une
// séance — tirage, correction, compteurs — se passe sur le serveur de correction
// (worker/seance.js) ; le navigateur y accède par api.js.

import { fetchJson, loadData } from './data.js';
import { loadExercise, loadExerciseIndex } from './exercice.js';

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
// Retourne { data, index, exercise, unknownId, listed } — exercise vaut null si l'adresse n'en
// nomme aucun de l'index (voir requestedExercise) ; l'accueil montre alors `listed`, les exercices
// de l'index dont le fichier ne dit pas « liste »: false (exercices d'essai, D30). C'est le seul cas
// où plusieurs fichiers d'exercice sont lus.
//   readJson : lecteur injectable (fetch par défaut), comme dans loadData
export async function loadApp(search, readJson = fetchJson) {
  const data = await loadData('data/', readJson);
  const index = await loadExerciseIndex('exercices/', readJson);
  const { exercise: entry, unknownId } = requestedExercise(search, index);
  const exercise = entry === null ? null : await loadExercise(entry.id, data, 'exercices/', readJson);
  let listed = [];
  if (exercise === null) {
    const files = await Promise.all(index.map((item) => loadExercise(item.id, data, 'exercices/', readJson)));
    listed = index.filter((_, i) => files[i].liste !== false);
  }
  return { data, index, exercise, unknownId, listed };
}
