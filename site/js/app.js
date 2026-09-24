// Démarrage de la page : ce qu'il faut charger, et quel exercice l'adresse demande.
//
// Aucun DOM ici : seulement des fonctions testables sous Node. Depuis D19, tout le reste d'une
// séance — tirage, correction, compteurs — se passe sur le serveur de correction
// (worker/seance.js) ; le navigateur y accède par api.js. Depuis D47 (jalon 7), l'exercice et son
// catalogue viennent aussi du serveur (GET /api/exercice), plus des JSON de site/ : le navigateur
// reçoit la version publiée — la dernière pour l'accueil, celle de la séance ensuite — avec ses
// copies d'outils et ses tables de référence, et assemble le catalogue comme le fait le serveur.

import { getExercise, listOfferedExercises } from './api.js';
import { assembleData } from './data.js';
import { engineExercise } from './exercice.js';

// Exercice demandé par l'adresse de la page : « ?exercice=<id> » (décision D18), ou null.
//   search : location.search (ex. « ?exercice=m10-tournage-vc »)
export function requestedExerciseId(search) {
  return new URLSearchParams(search).get('exercice') || null;
}

// Ce que le serveur rend d'une version d'exercice (GET /api/exercice) → { data, exercise, version, archived } :
// le catalogue au format de loadData (assembleData : les tables de la version et les copies d'outils)
// et l'exercice au format du moteur.
export function assembleExercise(response) {
  const { exercise, tools } = engineExercise(response.exercice.id, response.exercice.version, response.exercice);
  return { data: assembleData(response.tables, tools), exercise, version: response.version, archived: response.archive === true };
}

// Charge ce qu'il faut à la page. Retourne { data, exercise, version, archived, unknownId, listed } :
//   exercise  : l'exercice nommé par l'adresse, dans sa dernière version publiée — ou null si l'adresse
//               n'en nomme aucun que le serveur connaisse ; l'accueil montre alors `listed`, les exercices
//               offerts (publiés, non archivés, sans « liste »: false), et `unknownId`, l'id demandé qui n'existe pas
//   request   : fonction fetch injectable, pour les tests
// Seuls les exercices publiés existent, et il n'y a aucun repli (D18).
export async function loadApp(search, request = fetch) {
  const id = requestedExerciseId(search);
  if (id !== null) {
    try {
      return { ...assembleExercise(await getExercise(id, null, request)), unknownId: null, listed: [] };
    } catch (error) {
      if (error.status !== 400 && error.status !== 404) throw error;
    }
  }
  const { exercices } = await listOfferedExercises(request);
  return { data: null, exercise: null, version: null, archived: false, unknownId: id, listed: exercices };
}

// La version d'exercice d'une séance en cours, quand elle n'est pas la dernière publiée (D47) :
// même forme que loadApp, sans liste.
export async function loadExerciseVersion(id, version, request = fetch) {
  return assembleExercise(await getExercise(id, version, request));
}
