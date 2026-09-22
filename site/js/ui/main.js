// Point d'entrée de la page : charge le quiz, puis passe d'un écran à l'autre (UI §2).
// Le navigateur affiche ; la séance vit sur le serveur de correction (D19). Ici on ne fait
// qu'appeler app.js (choix de l'exercice), api.js (le serveur) et session.js (le jeton local).

import { loadApp } from '../app.js';
import { createSession, getAttestation, lookupSession, nextQuestion, resumeSession, signOut, submitAnswers, updateIdentity } from '../api.js';
import { clearSession, loadSession, saveSession } from '../session.js';
import { renderAttestation, renderAttestationError } from './attestation-screen.js';
import { renderExerciseList, renderHome, renderLoadError } from './home-screen.js';
import { renderCreate, renderIdentity, renderMatricule, renderResume } from './identification-screen.js';
import { renderQuestion } from './question-screen.js';
import { createReference } from './reference-screen.js';
import { toolLabels } from './rules.js';
import { identificationErrorMessage, serverErrorMessage } from './text.js';

const main = document.querySelector('#app');

let exercise; // exercice demandé par l'adresse
let data; // catalogue (loadData) : feuilles de référence, aide contextuelle
let labels; // noms à afficher des outils de l'exercice (« SDTMR (métrique) »)
let reference; // feuilles de référence, ouvertes par-dessus l'écran Question

function showHome() {
  const local = loadSession();
  renderHome(main, { exercise, local }, {
    onResume: () => openQuestion(local.jeton),
    onStart: () => showMatricule(),
    onForget: () => {
      signOut(local.jeton, exercise.id).catch(() => {}); // le serveur oublie le jeton ; s'il ne répond pas, le jeton expirera seul
      clearSession();
      showHome();
    },
  });
}

// --- Identification en deux temps (D23) : rien ne se décide en silence -----------------------------------

// Garde { matricule, prenom, jeton } — le prénom est celui que connaît le serveur. Si le navigateur
// refuse, on continue : il faudra seulement s'identifier de nouveau.
const remember = (jeton, seance) => saveSession({ matricule: seance.etudiant.matricule, prenom: seance.etudiant.prenom, jeton });

// Ouvre la séance que le serveur vient de créer ou de rendre. Retourne le message à afficher, ou null.
async function enter(opening) {
  try {
    const { jeton, seance } = await opening;
    remember(jeton, seance);
    return await openQuestion(jeton);
  } catch (error) {
    return identificationErrorMessage(error);
  }
}

// 1/2 : le matricule seul ; le serveur dit s'il a une séance pour cet exercice.
function showMatricule(notice = '', matricule = '') {
  renderMatricule(main, { exercise, notice, matricule }, {
    onSubmit: async (typed) => {
      try {
        const found = await lookupSession(typed, exercise.id);
        const back = () => showMatricule('', typed);
        if (found.trouvee) {
          renderResume(main, { exercise, ...found }, { onBack: back, onSubmit: (nip) => enter(resumeSession(typed, nip, exercise.id)) });
        } else {
          renderCreate(main, { exercise, matricule: typed }, { onBack: back, onSubmit: (student) => enter(createSession(student, exercise.id)) });
        }
        return null;
      } catch (error) {
        return identificationErrorMessage(error);
      }
    },
  });
}

// « Corriger mon identité », depuis la séance : le jeton ne change pas, la séance est déplacée (D23).
function showIdentity(jeton, seance) {
  renderIdentity(main, { exercise, seance }, {
    onBack: () => showSession(jeton, seance),
    onSubmit: async (identity) => {
      try {
        const { seance: corrected } = await updateIdentity(jeton, exercise.id, identity);
        remember(jeton, corrected);
        showSession(jeton, corrected);
        return null;
      } catch (error) {
        // 401 veut dire ici « NIP incorrect » : le jeton, lui, vient d'être accepté ou la séance aurait expiré avant.
        return identificationErrorMessage(error);
      }
    },
  });
}

// Le serveur a refusé le jeton (expiré après 2 h, remplacé sur un autre appareil, autre exercice) :
// on l'oublie, et l'étudiant s'identifie. Rien n'est perdu : la séance est sur le serveur.
function sessionExpired() {
  const matricule = loadSession()?.matricule ?? '';
  clearSession();
  showMatricule('Ta séance a expiré : identifie-toi de nouveau.', matricule);
  return null;
}

// Exercice réussi : l'attestation, figée par le serveur (D31). Pas de « Corriger mon identité »
// ici : l'attestation ne changerait pas.
async function showAttestation(jeton, seance) {
  try {
    const attestation = await getAttestation(jeton, exercise.id);
    renderAttestation(main, { seance, attestation }, { onQuit: showHome });
  } catch (error) {
    if (error.status === 401) { sessionExpired(); return; }
    renderAttestationError(main, { seance, message: serverErrorMessage(error) }, { onRetry: () => showAttestation(jeton, seance), onQuit: showHome });
  }
}

// Affiche où en est la séance : la question à laquelle répondre, ou la réussite.
function showSession(jeton, seance) {
  const actions = { onQuit: showHome, onIdentity: () => showIdentity(jeton, seance) };
  if (seance.reussite_le !== null) {
    showAttestation(jeton, seance);
    return;
  }
  renderQuestion(main, { seance, data, labels }, {
    ...actions,
    onTables: (sheet) => reference.open(sheet),
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
    data = app.data;
    labels = toolLabels(exercise, data);
    reference = createReference(data);
    showHome();
  } catch (error) {
    renderLoadError(main, error);
  }
}

start();
