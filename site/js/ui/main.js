// Point d'entrée de la page : charge le quiz, puis passe d'un écran à l'autre (UI §2).
// Le navigateur affiche ; la séance vit sur le serveur de correction (D19). Ici on ne fait
// qu'appeler app.js (choix de l'exercice), api.js (le serveur) et session.js (le jeton local).

import { demoRequested, loadApp, loadExerciseVersion } from '../app.js';
import {
  chooseDemoTool, createSession, demoQuestion, getAttestation, getSpecimen, lookupSession, nextQuestion, resumeSession, signOut, startDemo, submitAnswers,
  submitDemoAnswers, updateIdentity,
} from '../api.js';
import { clearSession, loadSession, saveSession, sessionFor } from '../session.js';
import { renderAttestation, renderAttestationError } from './attestation-screen.js';
import { DEMO_EXPIRED_NOTICE, demoToolGroups } from './demo-data.js';
import { renderDemoChooser, renderSpecimen } from './demo-screen.js';
import { toolRows } from './home-data.js';
import { renderHome, renderHomeList, renderLoadError } from './home-screen.js';
import { renderCreate, renderIdentity, renderMatricule, renderResume } from './identification-screen.js';
import { applyTableColors, convertDecimalCommas } from './dom.js';
import { renderQuestion } from './question-screen.js';
import { createReference } from './reference-screen.js';
import { toolLabels } from './rules.js';
import { identificationErrorMessage, serverErrorMessage } from './text.js';

const main = document.querySelector('#app');
convertDecimalCommas(main); // une virgule tapée devient un point à la sortie du champ (D71)

let exercise; // exercice demandé par l'adresse — la dernière version publiée, puis celle de la séance (D47)
let data; // catalogue (assembleData) : feuilles de référence, aide contextuelle
let labels; // noms à afficher des outils de l'exercice (« SDTMR (métrique) »)
let reference; // feuilles de référence, ouvertes par-dessus l'écran Question
let archived = false; // l'exercice n'est plus offert : plus de nouvelle séance

// Adopte une version d'exercice : catalogue, noms des outils, feuilles de référence, et les couleurs
// de sens de sa version des tables (D61).
function useExercise(loaded) {
  exercise = loaded.exercise;
  data = loaded.data;
  labels = toolLabels(exercise, data);
  applyTableColors({ classes_iso: data.classesIso, materiaux_outil: data.toolMaterials });
  reference?.destroy?.();
  reference = createReference(data);
}

// La séance est épinglée à sa version (D47) : si ce n'est pas celle qui est chargée, on la demande au serveur.
async function ensureVersion(seance) {
  if (seance.exercice.version === exercise.version) return;
  useExercise(await loadExerciseVersion(exercise.id, seance.exercice.version));
}

// La page de l'exercice (D71) : « Reprendre » seulement avec le jeton de CET exercice ; celui d'un autre reste gardé, sans être essayé.
function showHome() {
  const local = sessionFor(loadSession(), exercise.id);
  renderHome(main, { exercise, data, local, archived }, {
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

// Garde { matricule, prenom, jeton, exercice } — le prénom est celui que connaît le serveur ; l'exercice, celui
// du jeton (D71). Si le navigateur refuse, on continue : il faudra seulement s'identifier de nouveau.
const remember = (jeton, seance) => saveSession({ matricule: seance.etudiant.matricule, prenom: seance.etudiant.prenom, jeton, exercice: exercise.id });

// Ouvre la séance que le serveur vient de créer ou de rendre. Retourne le message à afficher, ou null.
async function enter(opening) {
  try {
    const { jeton, seance } = await opening;
    remember(jeton, seance);
    await ensureVersion(seance);
    return await openQuestion(jeton);
  } catch (error) {
    return identificationErrorMessage(error);
  }
}

// 1/2 : le matricule seul ; le serveur dit s'il a une séance pour cet exercice.
// « ← Page de l'exercice » (D87) : showHome, qui ne touche ni au jeton gardé ni au serveur.
function showMatricule(notice = '', matricule = '') {
  renderMatricule(main, { exercise, notice, matricule }, {
    onHome: showHome,
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

// Exercice réussi : l'attestation, figée par le serveur (D31). « Corriger mon identité » (D37) la
// fait annuler et réémettre par le serveur ; on la recharge ensuite.
async function showAttestation(jeton, seance) {
  try {
    const attestation = await getAttestation(jeton, exercise.id);
    renderAttestation(main, { seance, attestation }, { onQuit: showHome, onIdentity: () => showIdentity(jeton, seance) });
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
        return { message: serverErrorMessage(error), attendre_s: error.details?.attendre_s };
      }
    },
  });
}

// Demande au serveur la question en cours de la séance et l'affiche.
// Retourne null si un autre écran a pris la place, sinon le message à afficher sur l'écran courant.
async function openQuestion(jeton) {
  try {
    const { seance } = await nextQuestion(jeton, exercise.id);
    await ensureVersion(seance);
    showSession(jeton, seance);
    return null;
  } catch (error) {
    if (error.status === 401) return sessionExpired();
    return serverErrorMessage(error);
  }
}

// --- Le mode démo (D92) : une séance anonyme, sans identification, sans trace durable ------------------------------
// Son jeton reste ici, en mémoire de la page : rien dans le navigateur ; recharger la page ramène au choix de l'outil.
let demoToken = null;

// Le choix de l'outil : à l'entrée (la démo commence au choix), ou en cours de démo (« Changer d'outil »).
function showDemoChooser({ notice = '', chosen = null, inSession = false } = {}) {
  renderDemoChooser(main, { exercise, groups: demoToolGroups(toolRows(exercise, data)), chosen, notice, inSession }, {
    onChoose: (toolId) => (inSession ? changeDemoTool(toolId) : openDemo(toolId)),
    onSpecimen: showSpecimen,
    onBack: resumeDemo,
  });
}

// Commence la démo sur l'outil choisi (ou au hasard) ; retourne le message à afficher, ou null.
async function openDemo(toolId) {
  try {
    const { jeton, demo } = await startDemo(exercise.id, toolId);
    demoToken = jeton;
    await ensureVersion(demo);
    showDemo(demo);
    return null;
  } catch (error) {
    return serverErrorMessage(error);
  }
}

// Change l'outil des prochaines questions ; retourne le message à afficher, ou null.
async function changeDemoTool(toolId) {
  try {
    const { demo } = await chooseDemoTool(demoToken, exercise.id, toolId);
    showDemo(demo);
    return null;
  } catch (error) {
    if (error.status === 401) return demoExpired();
    return serverErrorMessage(error);
  }
}

// Le serveur ne reconnaît plus la démo (24 h sans activité) : on en commence une autre.
function demoExpired() {
  demoToken = null;
  showDemoChooser({ notice: DEMO_EXPIRED_NOTICE });
  return null;
}

// Redemande au serveur la question en attente de la démo (retour du spécimen ou du choix de l'outil) et l'affiche.
async function resumeDemo() {
  if (demoToken === null) {
    showDemoChooser();
    return null;
  }
  try {
    const { demo } = await demoQuestion(demoToken, exercise.id);
    await ensureVersion(demo);
    showDemo(demo);
    return null;
  } catch (error) {
    if (error.status === 401) return demoExpired();
    return serverErrorMessage(error);
  }
}

// La question de la démo : l'écran Question du vrai exercice, en mode démo.
function showDemo(demo) {
  renderQuestion(main, { seance: demo, data, labels, demo: true }, {
    onQuit: showHome,
    onTables: (sheet) => reference.open(sheet),
    onChooseTool: () => showDemoChooser({ chosen: demo.outil_choisi, inSession: true }),
    onSpecimen: showSpecimen,
    onNext: showDemo,
    onCheck: async (answers) => {
      try {
        const { correction, demo: next } = await submitDemoAnswers(demoToken, exercise.id, answers);
        return { correction, seance: next };
      } catch (error) {
        if (error.status === 401) return demoExpired();
        if (error.status === 409) {
          // Plus de question à corriger ici (autre onglet) : on redemande où en est la démo.
          const message = await resumeDemo();
          return message === null ? null : { message };
        }
        return { message: serverErrorMessage(error), attendre_s: error.details?.attendre_s };
      }
    },
  });
}

// Le spécimen d'attestation (D92, point 9), composé par le serveur ; « Retour à la démo » redemande la question en attente.
async function showSpecimen() {
  try {
    const specimen = await getSpecimen(exercise.id);
    renderSpecimen(main, { exercise, specimen }, { onBack: resumeDemo });
  } catch (error) {
    showDemoChooser({ notice: serverErrorMessage(error), inSession: demoToken !== null });
  }
}

async function start() {
  try {
    const app = await loadApp(location.search);
    // D18, D71 : « ?exercice= » absent ou inconnu → l'accueil, les exercices par cours ; jamais un exercice par défaut.
    if (app.exercise === null) {
      renderHomeList(main, app.listed, app.unknownId);
      return;
    }
    useExercise(app);
    archived = app.archived;
    // Le mode démo (D92) : « &demo=1 » ouvre le choix de l'outil, sans formulaire ; un exercice archivé n'en a pas.
    if (demoRequested(location.search) && !archived) {
      showDemoChooser();
      return;
    }
    showHome();
  } catch (error) {
    renderLoadError(main, error);
  }
}

start();
