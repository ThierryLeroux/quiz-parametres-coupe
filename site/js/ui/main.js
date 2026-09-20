// Point d'entrée de la page : charge le quiz, puis passe d'un écran à l'autre (UI §2).
// Le navigateur affiche ; la séance vit sur le serveur de correction (D19). Ici on ne fait
// qu'appeler app.js (choix de l'exercice), api.js (le serveur) et session.js (le jeton local).

import { loadApp } from '../app.js';
import { getQuestion, identify } from '../api.js';
import { clearSession, loadSession, saveSession } from '../session.js';
import { renderExerciseList, renderHome, renderLoadError } from './home-screen.js';
import { renderIdentification } from './identification-screen.js';
import { renderQuestion } from './question-screen.js';
import { identificationErrorMessage, serverErrorMessage } from './text.js';

const main = document.querySelector('#app');

let exercise; // exercice demandé par l'adresse

function showHome() {
  const local = loadSession();
  renderHome(main, { exercise, local }, {
    onResume: () => openQuestion(local),
    onStart: () => showIdentification(),
    onForget: () => { clearSession(); showHome(); },
  });
}

function showIdentification(notice = '') {
  renderIdentification(main, { exercise, notice }, {
    onSubmit: async (student) => {
      try {
        const { jeton, prenom } = await identify(student, exercise.id);
        const local = { matricule: student.matricule, prenom, jeton };
        saveSession(local); // si le navigateur refuse, on continue : il faudra seulement s'identifier de nouveau
        return await openQuestion(local);
      } catch (error) {
        return identificationErrorMessage(error);
      }
    },
  });
}

// Demande au serveur la question en cours de la séance et l'affiche.
// Retourne null si un autre écran a pris la place, sinon le message à afficher sur l'écran courant.
async function openQuestion(local) {
  try {
    await getQuestion(local.jeton, exercise.id); // la réponse sera affichée par l'écran Question (jalon 4)
    renderQuestion(main, { exercise, local }, { onQuit: showHome });
    return null;
  } catch (error) {
    // 401 : jeton inconnu ou expiré (2 h sans activité) → on oublie le jeton, l'étudiant s'identifie.
    if (error.status === 401) {
      clearSession();
      showIdentification('Ta séance a expiré : identifie-toi de nouveau.');
      return null;
    }
    return serverErrorMessage(error);
  }
}

async function start() {
  try {
    const app = await loadApp(location.search);
    // D18 : « ?exercice= » absent ou inconnu → la liste des exercices, jamais un exercice par défaut.
    if (app.exercise === null) {
      renderExerciseList(main, app.index, app.unknownId);
      return;
    }
    exercise = app.exercise;
    showHome();
  } catch (error) {
    renderLoadError(main, error);
  }
}

start();
