// Appels au serveur de correction (décisions D19, D21, D23 ; table des appels dans SPEC §7).
// Le navigateur affiche ; c'est le serveur qui tire les questions, corrige et tient les compteurs.
//
// Chaque fonction retourne la réponse JSON du serveur, ou lève une ApiError. Aucun DOM ici.
//   jeton      : jeton de séance remis par createSession ou resumeSession, gardé par session.js
//   exerciseId : chaque appel nomme l'exercice ; un jeton d'un autre exercice est refusé (401)
//   request    : fonction fetch injectable, pour les tests

// Erreur d'un appel au serveur.
//   status  : code HTTP de la réponse (400, 401, 409, 429…), ou 0 si le serveur n'a pas pu être
//             joint ou a répondu autre chose que du JSON
//   message : le message en français du serveur ({ "erreur": "…" }), s'il en a donné un
//   details : le reste de la réponse d'erreur (ex. { attendre_s: 6 } pour la cadence)
export class ApiError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function call(method, path, { jeton, body } = {}, request = fetch) {
  const headers = { accept: 'application/json' };
  if (jeton) headers.authorization = `Bearer ${jeton}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  let response;
  try {
    // credentials: le cookie de l'espace professeur (D34) voyage avec les appels /api/prof/… ; les autres n'en ont pas.
    response = await request(path, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Le serveur de correction ne répond pas.');
  }

  let content = null;
  try {
    content = await response.json();
  } catch {
    // Réponse sans JSON (page d'erreur d'un intermédiaire, par exemple) : traitée plus bas.
  }
  if (!response.ok) {
    const { erreur, ...details } = content ?? {};
    throw new ApiError(response.status, erreur ?? `Le serveur a répondu ${response.status}.`, details);
  }
  if (content === null) throw new ApiError(0, 'La réponse du serveur est illisible.');
  return content;
}

// Version du serveur : { version }.
export function getVersion(request) {
  return call('GET', '/api/version', {}, request);
}

// Identification en deux temps (SPEC §8, D23) — le serveur ne devine rien : on consulte, puis on
// crée OU on reprend.

// 1/2 : ce matricule a-t-il une séance pour cet exercice ?
// Retourne { trouvee: false }, ou { trouvee: true, prenom, initiale } — rien d'autre ne sort.
export function lookupSession(matricule, exerciseId, request) {
  return call('POST', '/api/consultation', { body: { exercice: exerciseId, matricule } }, request);
}

// 2/2, aucune séance : { prenom, nom, matricule, nip } → { jeton, seance }.
// Erreurs : 400 identification mal formée ; 409 ce matricule a déjà une séance.
export function createSession(student, exerciseId, request) {
  return call('POST', '/api/creation', { body: { exercice: exerciseId, ...student } }, request);
}

// 2/2, séance trouvée : matricule + NIP → { jeton, seance }.
// Erreurs : 401 NIP incorrect ; 429 trop d'essais ; 404 aucune séance pour ce matricule.
export function resumeSession(matricule, nip, exerciseId, request) {
  return call('POST', '/api/reprise', { body: { exercice: exerciseId, matricule, nip } }, request);
}

// « Corriger mon identité » : { prenom, nom, matricule, nip } — NIP exigé → { seance }.
// Erreurs : 401 NIP incorrect ; 429 trop d'essais ; 409 le nouveau matricule a déjà une séance.
export function updateIdentity(jeton, exerciseId, identity, request) {
  return call('POST', '/api/identite', { jeton, body: { exercice: exerciseId, ...identity } }, request);
}

// L'état de la séance, sans rien tirer : { seance }.
export function getSession(jeton, exerciseId, request) {
  return call('GET', `/api/seance?exercice=${encodeURIComponent(exerciseId)}`, { jeton }, request);
}

// La question à laquelle répondre : { seance }, où seance.question est la question mémorisée par le
// serveur (tirée au besoin), ou null si l'exercice est réussi (seance.reussite_le).
export function nextQuestion(jeton, exerciseId, request) {
  return call('POST', '/api/question', { jeton, body: { exercice: exerciseId } }, request);
}

// Fait corriger la question en cours : { correction, seance } — seance porte déjà la question suivante.
//   answers : saisies en texte, { vc, feedPerTooth, rpm, feedPerRev, feedRate }
// Erreurs : 429 moins de 10 s depuis la correction précédente (cadence) ; 409 aucune question à corriger.
export function submitAnswers(jeton, exerciseId, answers, request) {
  return call('POST', '/api/correction', { jeton, body: { exercice: exerciseId, saisies: answers } }, request);
}

// « Changer d'étudiant » : le serveur oublie le jeton.
export function signOut(jeton, exerciseId, request) {
  return call('POST', '/api/deconnexion', { jeton, body: { exercice: exerciseId } }, request);
}

// L'attestation de la séance réussie (D31 à D33) : { attestation, code, signature, url_verification, annulee_le }.
// Erreur : 409 l'exercice n'est pas encore réussi.
export function getAttestation(jeton, exerciseId, request) {
  return call('GET', `/api/attestation?exercice=${encodeURIComponent(exerciseId)}`, { jeton }, request);
}

// Vérification publique d'une attestation, sans jeton (D33) : { resultat, attestation?, annulee_le? }.
//   claims : { code } seul, ou tous les champs de l'adresse du QR
// Erreurs : 400 code mal formé ; 429 trop de codes distincts depuis cette adresse.
export function verifyAttestation(claims, request) {
  return call('POST', '/api/verification', { body: claims }, request);
}

// --- Espace professeur (D34, D35) : la séance est un cookie HttpOnly posé par le serveur -----------------------------

// Connexion par la clé d'administration : { enseignant, expire_le }. Erreurs : 401 clé incorrecte ; 429 trop d'essais.
export function teacherLogin(cle, request) {
  return call('POST', '/api/prof/connexion', { body: { cle } }, request);
}

export function teacherLogout(request) {
  return call('POST', '/api/prof/deconnexion', { body: {} }, request);
}

// Toutes les séances : { enseignant, exercices, seances }. Erreur : 401 connexion requise.
export function listSessions(request) {
  return call('GET', '/api/prof/seances', {}, request);
}

// Remise à zéro d'une séance (D35) : { remise_a_zero: true, seance }. Erreurs : 401 ; 404 séance inconnue.
export function resetSession(seanceId, request) {
  return call('POST', '/api/prof/remise-a-zero', { body: { seance: seanceId } }, request);
}

// Réinitialisation du NIP d'une séance (D38) : { nip_reinitialise: true, seance }. Erreurs : 401 ; 404.
export function resetNip(seanceId, request) {
  return call('POST', '/api/prof/reinitialisation-nip', { body: { seance: seanceId } }, request);
}

// Suppression d'une séance (D45) : { supprimee: true, seance }. Erreurs : 401 ; 403 rôle consultation ; 404.
export function deleteSession(seanceId, request) {
  return call('POST', '/api/prof/suppression', { body: { seance: seanceId } }, request);
}

// Effacement des données des étudiants (D46), avec le mot de confirmation tapé : { efface: true, nombres }.
// Erreurs : 400 mot absent ou différent ; 401 ; 403 rôle consultation.
export function purgeStudentData(confirmation, request) {
  return call('POST', '/api/prof/effacement', { body: { confirmation } }, request);
}

// Le journal des corrections d'identité, la plus récente en premier : { corrections }.
export function listIdentityCorrections(request) {
  return call('GET', '/api/prof/identites', {}, request);
}
