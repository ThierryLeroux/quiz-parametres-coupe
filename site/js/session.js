// Ce que le navigateur garde d'une séance (SPEC §7, décision D19) : { matricule, prenom, jeton }.
// Rien d'autre : l'état de la séance (compteurs, question en cours, horodatages) vit sur le
// serveur de correction. Ces trois valeurs servent à offrir « Reprendre, <prénom> » à l'accueil
// sans redemander le NIP, tant que le jeton n'a pas expiré (2 h sans activité).
//
// Une seule clé de localStorage, un seul objet JSON. Le stockage n'est jamais fiable : navigation
// privée, quota plein, contenu abîmé… Chaque lecture et chaque écriture est donc dans un
// try/catch, et loadSession retourne null plutôt que de lever une exception : l'étudiant
// s'identifie alors, tout simplement.

export const SESSION_KEY = 'quiz-parametres-coupe:seance';

const KEYS = ['matricule', 'prenom', 'jeton'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';

// localStorage du navigateur, ou null s'il n'existe pas (Node) ou si y accéder est interdit
// (certains navigateurs lèvent une exception dès la lecture de la propriété).
function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Relit { matricule, prenom, jeton }. Retourne null si rien n'est gardé, si le stockage est
// inaccessible ou si le contenu est abîmé (ou date d'avant D19, quand toute la séance était ici).
// Ne lève jamais d'exception et n'efface rien : la prochaine sauvegarde remplacera le contenu.
export function loadSession(storage = browserStorage()) {
  try {
    const text = storage.getItem(SESSION_KEY);
    if (text === null) return null;
    const saved = JSON.parse(text);
    if (!isObject(saved) || !KEYS.every((key) => isText(saved[key]))) return null;
    return Object.fromEntries(KEYS.map((key) => [key, saved[key]]));
  } catch {
    return null;
  }
}

// Garde { matricule, prenom, jeton } — et rien de plus, même si l'objet reçu en contient davantage
// (jamais le NIP). Retourne true si c'est fait, false sinon (valeur manquante, stockage absent,
// plein ou interdit) : l'application continue alors, et l'étudiant s'identifiera de nouveau.
export function saveSession(session, storage = browserStorage()) {
  try {
    if (!KEYS.every((key) => isText(session[key]))) return false;
    storage.setItem(SESSION_KEY, JSON.stringify(Object.fromEntries(KEYS.map((key) => [key, session[key]]))));
    return true;
  } catch {
    return false;
  }
}

// Oublie l'étudiant sur ce poste (« Ce n'est pas toi ? Changer d'étudiant », ou jeton refusé par
// le serveur). Retourne true si c'est fait.
export function clearSession(storage = browserStorage()) {
  try {
    storage.removeItem(SESSION_KEY);
    return true;
  } catch {
    return false;
  }
}
