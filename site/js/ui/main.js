// Point d'entrée de la page : charge le quiz, puis passe d'un écran à l'autre (UI §2).
// Toute la logique est dans app.js et session.js (fonctions pures, testées) ; ici on ne fait que
// les appeler, sauvegarder l'état retourné et l'afficher.

import { loadApp, requestedExercise, restoreSession, startSession } from '../app.js';
import { loadSession, saveSession } from '../session.js';
import { renderExerciseList, renderHome, renderLoadError } from './home-screen.js';
import { renderIdentification } from './identification-screen.js';
import { renderQuestion } from './question-screen.js';

const main = document.querySelector('#app');

let data; // catalogue (loadData)
let exercise; // exercice demandé par l'adresse
let session = null; // séance en cours, une fois commencée ou reprise

function showHome() {
  const saved = loadSession();
  const resumable = restoreSession(saved, exercise);
  renderHome(main, { exercise, resumable, otherSession: saved !== null && resumable === null }, {
    onResume: () => { session = resumable; showQuestion(true); },
    onNew: showIdentification,
  });
}

// La séance précédente n'est effacée qu'au moment où la nouvelle commence : « ← Retour » la laisse intacte.
function showIdentification() {
  renderIdentification(main, { exercise }, {
    onBack: showHome,
    onStart: (student) => {
      session = startSession(student, exercise, data, new Date());
      showQuestion(saveSession(session));
    },
  });
}

function showQuestion(saved) {
  renderQuestion(main, { exercise, state: session, saved }, { onQuit: showHome });
}

async function start() {
  try {
    const app = await loadApp(location.search);
    // ❓ SPEC §10 : « id inconnu ou absent → le premier de l'index ». UI §3.1 : sans « ?exercice= », la
    // liste des exercices. Interprétation : on montre la liste dans les deux cas (absent ou inconnu),
    // plutôt que de lancer en silence un exercice que l'étudiant n'a pas demandé. À confirmer par Thierry.
    if (requestedExercise(location.search, app.index) === null) {
      renderExerciseList(main, app.index, new URLSearchParams(location.search).get('exercice') || null);
      return;
    }
    data = app.data;
    exercise = app.exercise;
    showHome();
  } catch (error) {
    renderLoadError(main, error);
  }
}

start();
