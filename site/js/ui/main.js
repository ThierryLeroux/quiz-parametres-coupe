// Point d'entrée de la page : charge le quiz, puis passe d'un écran à l'autre (UI §2).
// Le navigateur affiche ; la séance vit sur le serveur de correction (D19). Ici on ne fait
// qu'appeler app.js (choix de l'exercice), api.js (le serveur) et session.js (le jeton local).

import { loadApp } from '../app.js';
import { identify, nextQuestion, signOut, submitAnswers } from '../api.js';
import { clearSession, loadSession, saveSession } from '../session.js';
import { renderExerciseList, renderHome, renderLoadError } from './home-screen.js';
import { renderIdentification } from './identification-screen.js';
import { renderQuestion, renderSuccess } from './question-screen.js';
import { identificationErrorMessage, serverErrorMessage } from './text.js';

const main = document.querySelector('#app');

let exercise; // exercice demandé par l'adresse

function showHome() {
  const local = loadSession();
  renderHome(main, { exercise, local }, {
    onResume: () => openQuestion(local.jeton),
    onStart: () => showIdentification(),
    onForget: () => {
      signOut(local.jeton, exercise.id).catch(() => {}); // le serveur oublie le jeton ; s'il ne répond pas, le jeton expirera seul
      clearSession();
      showHome();
    },
  });
}

function showIdentification(notice = '') {
  renderIdentification(main, { exercise, notice }, {
    onSubmit: async (student) => {
      try {
        const { jeton, seance } = await identify(student, exercise.id);
        // Le prénom gardé est celui de la première visite, renvoyé par le serveur (D21).
        saveSession({ matricule: seance.etudiant.matricule, prenom: seance.etudiant.prenom, jeton }); // si le navigateur refuse, on continue
        return await openQuestion(jeton);
      } catch (error) {
        return identificationErrorMessage(error);
      }
    },
  });
}

// Le serveur a refusé le jeton (expiré après 2 h, remplacé sur un autre appareil, autre exercice) :
// on l'oublie, et l'étudiant s'identifie. Rien n'est perdu : la séance est sur le serveur.
function sessionExpired() {
  clearSession();
  showIdentification('Ta séance a expiré : identifie-toi de nouveau.');
  return null;
}

// Affiche où en est la séance : la question à laquelle répondre, ou la réussite.
function showSession(jeton, seance) {
  const actions = { onQuit: showHome };
  if (seance.reussite_le !== null) {
    renderSuccess(main, { seance }, actions);
    return;
  }
  renderQuestion(main, { seance }, {
    ...actions,
    onNext: (next) => showSession(jeton, next),
    onCheck: async (answers) => {
      try {
        return await submitAnswers(jeton, exercise.id, answers);
      } catch (error) {
        if (error.status === 401) return sessionExpired();
        if (error.status === 409) {
          // Plus de question à corriger ici (exercice modifié, autre onglet) : on redemande où en est la séance.
          const message = await openQuestion(jeton);
          return message === null ? null : { message };
        }
        return { message: serverErrorMessage(error) };
      }
    },
  });
}

// Demande au serveur la question en cours de la séance et l'affiche.
// Retourne null si un autre écran a pris la place, sinon le message à afficher sur l'écran courant.
async function openQuestion(jeton) {
  try {
    const { seance } = await nextQuestion(jeton, exercise.id);
    showSession(jeton, seance);
    return null;
  } catch (error) {
    if (error.status === 401) return sessionExpired();
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
