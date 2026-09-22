// Règles d'accès au serveur (décisions D34, D36) : l'adresse du demandeur, les limites de débit par
// adresse, le verrou des connexions professeur ratées, et le cookie de séance professeur.
//
// Fonctions PURES : ni base, ni réseau, ni horloge cachée. Le SQL est dans base.js, la
// cryptographie dans crypto.js.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// Date ISO décalée de `ms` millisecondes.
const later = (now, ms) => new Date(now.getTime() + ms).toISOString();

// --- Adresse du demandeur ----------------------------------------------------------------------------
// Cloudflare met l'adresse IP du client dans cf-connecting-ip, qu'un client ne peut pas forger.
// Sans cet en-tête (tests sous Node), toutes les requêtes partagent une même adresse.
export function clientAddress(request) {
  return request.headers.get('cf-connecting-ip') ?? 'inconnue';
}

// --- Limites de débit (D36) ----------------------------------------------------------------------------
// Consultation d'un matricule et vérification d'un code : au plus 100 VALEURS DISTINCTES par
// adresse et par heure — pas de limite sur le nombre de requêtes, puisque tous les postes du cégep
// sortent par une seule adresse. Un refus verrouille l'adresse 10 minutes.

export const DISTINCT_PER_HOUR = 100;
export const REFUSAL_LOCK_MS = 10 * MINUTE;

// La tranche horaire d'un instant, en UTC : « 2026-09-21T13 ».
export const hourSlot = (now) => now.toISOString().slice(0, 13);

// Le verrou posé après un refus de débit : { echecs, jusqua }.
export const refusalLock = (now) => ({ echecs: 0, jusqua: later(now, REFUSAL_LOCK_MS) });

// Un verrou (ligne de la table verrous, ou null) est-il actif en ce moment ?
export function isLocked(lock, now) {
  return lock !== null && lock.jusqua !== null && lock.jusqua > now.toISOString();
}

// Secondes avant la levée d'un verrou actif.
export const lockWait = (lock, now) => Math.max(1, Math.ceil((new Date(lock.jusqua).getTime() - now.getTime()) / SECOND));

// --- Connexion professeur (D34) --------------------------------------------------------------------------
// Cinq essais ratés par adresse, puis un délai qui double à chaque échec : 1 min, 2 min, 4 min…
// plafonné à une heure. Une connexion réussie efface tout.

export const PROF_FREE_ATTEMPTS = 5;
export const PROF_LOCK_BASE_MS = 1 * MINUTE;
export const PROF_LOCK_MAX_MS = 1 * HOUR;

// Le verrou à poser après un échec de plus : { echecs, jusqua }.
export function profFailureLock(lock, now) {
  const failures = (lock?.echecs ?? 0) + 1;
  if (failures < PROF_FREE_ATTEMPTS) return { echecs: failures, jusqua: null };
  const delay = Math.min(PROF_LOCK_MAX_MS, PROF_LOCK_BASE_MS * 2 ** (failures - PROF_FREE_ATTEMPTS));
  return { echecs: failures, jusqua: later(now, delay) };
}

// --- Cookie de séance professeur (D34) --------------------------------------------------------------------
// Signé, sans état sur le serveur : « <charge>.<signature> », où la charge est l'identifiant de
// l'enseignant et l'expiration, en base64url. La signature (crypto.js, sous-clé « prof ») est
// recalculée à chaque requête et comparée en temps constant.

export const PROF_COOKIE = 'prof';
export const PROF_SESSION_MS = 12 * HOUR;
export const PROF_COOKIE_PATH = '/api/prof'; // le cookie ne voyage que vers l'espace professeur

const toBase64url = (text) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const fromBase64url = (text) => new TextDecoder().decode(Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0)));

// La charge d'une séance qui commence maintenant : { payload, expires }.
export function profSessionPayload(teacher, now) {
  const expires = later(now, PROF_SESSION_MS);
  return { payload: toBase64url(`${teacher}|${expires}`), expires };
}

// Lit une charge : { teacher, expires }, ou null si elle est illisible ou expirée.
export function readProfSessionPayload(payload, now) {
  try {
    const [teacher, expires] = fromBase64url(payload).split('|');
    if (!teacher || !expires || expires <= now.toISOString()) return null;
    return { teacher, expires };
  } catch {
    return null;
  }
}

// La valeur du cookie « prof » dans un en-tête Cookie, ou null.
export function readCookie(header, name = PROF_COOKIE) {
  for (const part of (header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

// L'en-tête Set-Cookie qui pose la séance (HttpOnly, Secure, SameSite=Strict, 12 h), ou qui l'efface.
export function profCookieHeader(value) {
  const base = `${PROF_COOKIE}=${value ?? ''}; Path=${PROF_COOKIE_PATH}; HttpOnly; Secure; SameSite=Strict`;
  return value === null ? `${base}; Max-Age=0` : `${base}; Max-Age=${PROF_SESSION_MS / SECOND}`;
}
