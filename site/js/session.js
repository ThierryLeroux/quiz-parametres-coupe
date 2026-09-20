// État d'une séance et sa sauvegarde dans localStorage (SPEC §7, « État d'une séance » ; §9).
// Une seule clé, un seul objet JSON. Rien n'est envoyé ailleurs : tout reste dans le navigateur.
//
// Le stockage n'est jamais fiable : navigation privée, quota plein, contenu abîmé, autre version
// du site… Chaque lecture et chaque écriture est donc dans un try/catch, et loadSession retourne
// null plutôt que de lever une exception : l'application démarre alors une nouvelle séance.

import { createProgress } from './progression.js';

export const SESSION_KEY = 'quiz-parametres-coupe:seance';

// Version du FORMAT de l'état. À augmenter quand sa forme change : un état enregistré
// sous une autre version est ignoré au lieu d'être mal interprété.
export const SESSION_VERSION = 1;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isTextOrNull = (v) => v === null || isText(v);
const isObjectOrNull = (v) => v === null || isObject(v);

// Vérifie l'identification saisie par l'étudiant (SPEC §8), champ par champ, pour que l'écran
// affiche chaque message sous sa case : { prenom, nom, matricule }, où chaque valeur est le
// message d'erreur en français, ou null si le champ est valide.
export function studentErrors(student) {
  return {
    prenom: isText(student.prenom) ? null : 'Le prénom est requis.',
    nom: isText(student.nom) ? null : 'Le nom est requis.',
    matricule: matriculeError(student.matricule),
  };
}

function matriculeError(matricule) {
  if (!isText(matricule)) return 'Le matricule est requis.';
  if (!/^\d{7}$/.test(matricule.trim())) return 'Le matricule doit avoir exactement 7 chiffres.';
  return null;
}

// Même vérification, en liste : une erreur par champ fautif (liste vide = identification valide).
export function validateStudent(student) {
  if (!isObject(student)) return ["identification : n'est pas un objet"];
  return Object.values(studentErrors(student)).filter((message) => message !== null);
}

// État de départ d'une séance : étudiant identifié, exercice choisi, aucune question encore.
//   now : Date du début (injectable pour les tests)
export function createSession(student, exercise, now) {
  const errors = validateStudent(student);
  if (errors.length > 0) throw new Error(`Identification invalide :\n- ${errors.join('\n- ')}`);
  return {
    version: SESSION_VERSION,
    etudiant: {
      prenom: student.prenom.trim(),
      nom: student.nom.trim(),
      matricule: student.matricule.trim(),
    },
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

// L'objet a-t-il bien la forme d'un état de séance de CETTE version ? On vérifie la forme,
// pas le contenu métier : c'est restoreSession (app.js) qui le confronte à l'exercice.
export function isValidSession(state) {
  return isObject(state)
    && state.version === SESSION_VERSION
    && isObject(state.etudiant)
    && ['prenom', 'nom', 'matricule'].every((key) => isText(state.etudiant[key]))
    && isText(state.exerciceId)
    && isText(state.exerciceVersion)
    && isText(state.debut)
    && isTextOrNull(state.reussite)
    && isObject(state.progression)
    && isText(state.progression.exerciceId)
    && isObject(state.progression.reussites)
    && Number.isInteger(state.progression.totalReussies)
    && isObjectOrNull(state.question)
    && isObject(state.saisies)
    && isObjectOrNull(state.correction)
    && Array.isArray(state.questionsReussies);
}

// localStorage du navigateur, ou null s'il n'existe pas (Node) ou si y accéder est interdit
// (certains navigateurs lèvent une exception dès la lecture de la propriété).
function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Relit la séance sauvegardée. Retourne l'état, ou null si rien n'est sauvegardé, si le
// stockage est inaccessible, ou si le contenu est abîmé ou d'une autre version.
// Ne lève jamais d'exception et n'efface rien : la prochaine sauvegarde remplacera le contenu.
export function loadSession(storage = browserStorage()) {
  try {
    const text = storage.getItem(SESSION_KEY);
    if (text === null) return null;
    const state = JSON.parse(text);
    return isValidSession(state) ? state : null;
  } catch {
    return null;
  }
}

// Sauvegarde la séance. Retourne true si c'est fait, false sinon (stockage absent, plein ou
// interdit) : l'application continue alors sans sauvegarde, elle ne plante pas.
export function saveSession(state, storage = browserStorage()) {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// Efface la séance sauvegardée (nouvel étudiant sur le même poste, recommencer). Retourne true si c'est fait.
export function clearSession(storage = browserStorage()) {
  try {
    storage.removeItem(SESSION_KEY);
    return true;
  } catch {
    return false;
  }
}
