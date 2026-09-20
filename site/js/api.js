// Appels au serveur de correction (décision D19 ; table des appels dans SPEC §7).
// Le navigateur affiche ; c'est le serveur qui tire les questions, corrige et tient les compteurs.
//
// Chaque fonction retourne la réponse JSON du serveur, ou lève une ApiError. Aucun DOM ici.
//   jeton   : jeton de séance remis par identify, gardé par session.js
//   request : fonction fetch injectable, pour les tests
//
// Tant que le serveur n'existe pas (avant le jalon 3), tous ces appels lèvent une ApiError de
// statut 501, et l'écran affiche « Serveur de correction à venir ».

// Erreur d'un appel au serveur.
//   status  : code HTTP de la réponse (400, 401, 429, 501…), ou 0 si le serveur n'a pas pu être
//             joint ou a répondu autre chose que du JSON
//   message : le message en français du serveur ({ "erreur": "…" }), s'il en a donné un
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function call(method, path, { jeton, body } = {}, request = fetch) {
  const headers = { accept: 'application/json' };
  if (jeton) headers.authorization = `Bearer ${jeton}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  let response;
  try {
    response = await request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Le serveur de correction ne répond pas.');
  }

  let content = null;
  try {
    content = await response.json();
  } catch {
    // Réponse sans JSON (page d'erreur d'un intermédiaire, par exemple) : traitée plus bas.
  }
  if (!response.ok) throw new ApiError(response.status, content?.erreur ?? `Le serveur a répondu ${response.status}.`);
  if (content === null) throw new ApiError(0, 'La réponse du serveur est illisible.');
  return content;
}

// Version du serveur : { version }.
export function getVersion(request) {
  return call('GET', '/api/version', {}, request);
}

// Identification (SPEC §8) — première visite ou reprise, c'est le serveur qui le sait.
//   student : { prenom, nom, matricule, nip }
// Retourne { jeton, prenom }. Erreurs : 400 identification invalide, 401 NIP incorrect, 429 trop d'essais.
export function identify(student, exerciseId, request) {
  return call('POST', '/api/identification', { body: { exercice: exerciseId, ...student } }, request);
}

// La question en cours de la séance (tirée par le serveur au besoin) et la progression.
// Erreur 401 : jeton inconnu ou expiré → l'étudiant doit s'identifier de nouveau.
export function getQuestion(jeton, exerciseId, request) {
  return call('GET', `/api/question?exercice=${encodeURIComponent(exerciseId)}`, { jeton }, request);
}

// Fait corriger la question en cours.
//   answers : saisies en texte, { vc, feedPerTooth, rpm, feedPerRev, feedRate }
// Erreur 429 : moins de 10 s depuis la correction précédente (cadence, D19).
export function submitAnswers(jeton, exerciseId, answers, request) {
  return call('POST', '/api/correction', { jeton, body: { exercice: exerciseId, saisies: answers } }, request);
}

// Le rapport de réussite et son attestation signée (SPEC §8), une fois l'exercice réussi.
export function getReport(jeton, exerciseId, request) {
  return call('GET', `/api/rapport?exercice=${encodeURIComponent(exerciseId)}`, { jeton }, request);
}
