// Ce que le navigateur garde d'une séance (SPEC §7, décision D19) : { matricule, prenom, jeton,
// exercice }. Rien d'autre : l'état de la séance (compteurs, question en cours, horodatages) vit sur
// le serveur de correction. Ces valeurs servent à offrir « Reprendre, <prénom> » sur la page de
// l'exercice sans redemander le NIP, tant que le jeton n'a pas expiré (2 h sans activité). Depuis
// D71, le jeton nomme son exercice : sur la page d'un autre exercice, il n'est ni offert ni effacé.
//
// Une seule clé de localStorage, un seul objet JSON. Le stockage n'est jamais fiable : navigation
// privée, quota plein, contenu abîmé… Chaque lecture et chaque écriture est donc dans un
// try/catch, et loadSession retourne null plutôt que de lever une exception : l'étudiant
// s'identifie alors, tout simplement.

// La clé ne suit pas l'adresse du site (D72, D73) : un changement d'adresse change de toute façon l'origine,
// donc le stockage ; elle ne change jamais.
export const SESSION_KEY = 'quiz-parametres-coupe:seance';

const KEYS = ['matricule', 'prenom', 'jeton'];
const OPTIONAL_KEYS = ['exercice']; // D71 ; absent d'un jeton gardé avant

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

// Seulement les clés connues ; l'exercice, s'il est là et lisible.
function kept(source) {
  const out = Object.fromEntries(KEYS.map((key) => [key, source[key]]));
  for (const key of OPTIONAL_KEYS) if (isText(source[key])) out[key] = source[key];
  return out;
}

// Relit { matricule, prenom, jeton, exercice? }. Retourne null si rien n'est gardé, si le stockage est
// inaccessible ou si le contenu est abîmé (ou date d'avant D19, quand toute la séance était ici).
// Ne lève jamais d'exception et n'efface rien : la prochaine sauvegarde remplacera le contenu.
export function loadSession(storage = browserStorage()) {
  try {
    const text = storage.getItem(SESSION_KEY);
    if (text === null) return null;
    const saved = JSON.parse(text);
    if (!isObject(saved) || !KEYS.every((key) => isText(saved[key]))) return null;
    return kept(saved);
  } catch {
    return null;
  }
}

// Garde { matricule, prenom, jeton, exercice } — et rien de plus, même si l'objet reçu en contient
// davantage (jamais le NIP). Retourne true si c'est fait, false sinon (valeur manquante, stockage
// absent, plein ou interdit) : l'application continue alors, et l'étudiant s'identifiera de nouveau.
export function saveSession(session, storage = browserStorage()) {
  try {
    if (!KEYS.every((key) => isText(session[key]))) return false;
    storage.setItem(SESSION_KEY, JSON.stringify(kept(session)));
    return true;
  } catch {
    return false;
  }
}

// Le jeton gardé, s'il est celui de cet exercice (D71) : la page offre alors « Reprendre, <prénom> ».
// Celui d'un autre exercice : null — la page offre « Commencer ou reprendre », et le jeton reste gardé,
// sans être essayé (le serveur le refuserait, 401, et on l'oublierait). Un jeton gardé avant D71, sans
// exercice, est offert comme avant.
export function sessionFor(local, exerciseId) {
  if (local === null || local === undefined) return null;
  return local.exercice === undefined || local.exercice === exerciseId ? local : null;
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
