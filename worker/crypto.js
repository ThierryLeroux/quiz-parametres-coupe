// Cryptographie du serveur (décision D22), avec l'API Web Crypto — la même dans un Worker
// Cloudflare et sous Node : rien à installer.
//
//   CLE_SECRETE ──HKDF──► une sous-clé par usage : « nip », « attestation », « prof »
//   NIP    : stocké comme HMAC-SHA-256(sous-clé « nip », matricule + NIP). Pas de hachage lent :
//            un NIP de 4 à 6 chiffres est trop court pour qu'il serve ; la protection vient du
//            secret, que la base ne contient pas.
//   Jeton  : 32 octets aléatoires ; le navigateur reçoit le jeton, la base n'en garde que le SHA-256.
// Tous les résultats sont des textes en base64url (lettres, chiffres, « - » et « _ »).

const encoder = new TextEncoder();

function base64url(bytes) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

// Sous-clé HMAC dérivée du secret du serveur, propre à un usage : connaître le résultat d'un usage
// n'apprend rien sur un autre.
//   secret : CLE_SECRETE        usage : « nip », « attestation »…
async function subKey(secret, usage) {
  if (typeof secret !== 'string' || secret === '') throw new Error("CLE_SECRETE n'est pas configurée sur le serveur");
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('quiz-parametres-coupe'), info: encoder.encode(usage) },
    material,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign'],
  );
}

// Ce que la base garde d'un NIP. Le matricule en fait partie : deux étudiants qui choisissent le
// même NIP n'ont pas la même valeur en base.
export async function hashNip(secret, matricule, nip) {
  const key = await subKey(secret, 'nip');
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(`${matricule}:${nip}`)));
}

// HMAC-SHA-256 d'un texte sous la sous-clé d'un usage, en base64url (43 caractères).
async function sign(secret, usage, text) {
  const key = await subKey(secret, usage);
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(text)));
}

// Signature d'une attestation (D32) : sur sa sérialisation canonique (attestation.js). Vérifier une
// signature = la recalculer et comparer en temps constant (sameText).
export const signAttestation = (secret, canonicalText) => sign(secret, 'attestation', canonicalText);

// Signature de la charge du cookie de séance professeur (D34, acces.js).
export const signProfSession = (secret, payload) => sign(secret, 'prof', payload);

// La clé d'administration présentée est-elle la bonne ? Les deux sont hachées avant la comparaison
// en temps constant : la durée ne dit rien, pas même la longueur de la clé.
export async function sameSecret(presented, expected) {
  if (typeof expected !== 'string' || expected === '') throw new Error("CLE_ADMIN n'est pas configurée sur le serveur");
  if (typeof presented !== 'string') return false;
  return sameText(await hashToken(presented), await hashToken(expected));
}

// Nouveau jeton de séance : 32 octets aléatoires (43 caractères).
export function newToken() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

// Ce que la base garde d'un jeton. Un jeton est long et aléatoire : un SHA-256 simple suffit.
export async function hashToken(token) {
  return base64url(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
}

// Comparaison de deux textes en temps constant : la durée ne dit pas où se trouve la première différence.
export function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
