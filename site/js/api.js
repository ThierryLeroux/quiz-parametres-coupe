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
    throw new ApiError(0, 'Le site ne répond pas.'); // jamais le mot « serveur » à l'écran (D93)
  }

  let content = null;
  try {
    content = await response.json();
  } catch {
    // Réponse sans JSON (page d'erreur d'un intermédiaire, par exemple) : traitée plus bas.
  }
  if (!response.ok) {
    const { erreur, ...details } = content ?? {};
    throw new ApiError(response.status, erreur ?? `Erreur ${response.status}. Réessaie dans un instant.`, details);
  }
  if (content === null) throw new ApiError(0, 'Réponse illisible.');
  return content;
}

// Version du serveur : { version }.
export function getVersion(request) {
  return call('GET', '/api/version', {}, request);
}

// L'exercice publié (D47) : sa dernière version, ou la version demandée (numéro) — { exercice, tables, version, archive }.
// Erreurs : 400 exercice inconnu ou jamais publié ; 404 version inconnue.
export function getExercise(exerciseId, version, request) {
  const query = `exercice=${encodeURIComponent(exerciseId)}${version === null || version === undefined ? '' : `&version=${encodeURIComponent(version)}`}`;
  return call('GET', `/api/exercice?${query}`, {}, request);
}

// Une version des tables de référence (D63, les feuilles imprimables par version) : { tables: { id, creee_le, materiaux, operations } }. 404 inconnue.
export function getTables(version, request) {
  return call('GET', `/api/tables?version=${encodeURIComponent(version)}`, {}, request);
}

// Les exercices offerts à l'accueil (D18, D47) : { exercices: [{ id, titre }] }.
export function listOfferedExercises(request) {
  return call('GET', '/api/exercices', {}, request);
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

// --- Le mode démo (D92) : une séance anonyme, sans trace durable ; son jeton reste en mémoire de la page ------------------

// Commence une démo de l'exercice, sur l'outil choisi (un identifiant d'outil de l'exercice, ou null : au hasard) :
// { jeton, demo } — la première question est déjà tirée. Erreurs : 400 exercice inconnu, archivé ou outil hors de
// l'exercice ; 429 trop de démos commencées depuis cette adresse.
export function startDemo(exerciseId, toolId, request) {
  return call('POST', '/api/demo/creation', { body: { exercice: exerciseId, outil: toolId } }, request);
}

// La question en attente de la démo, tirée au besoin : { demo }. Erreur : 401 la démo n'existe plus (24 h sans activité).
export function demoQuestion(jeton, exerciseId, request) {
  return call('POST', '/api/demo/question', { jeton, body: { exercice: exerciseId } }, request);
}

// L'outil des prochaines questions (ou null : au hasard) : { demo } — la question en attente est remplacée si elle n'est
// pas de cet outil. Erreurs : 400 outil hors de l'exercice ; 401.
export function chooseDemoTool(jeton, exerciseId, toolId, request) {
  return call('POST', '/api/demo/outil', { jeton, body: { exercice: exerciseId, outil: toolId } }, request);
}

// Fait corriger la question en attente de la démo : { correction, demo } — demo porte déjà la question suivante.
// Erreurs : 429 cadence ; 409 aucune question à corriger ; 401.
export function submitDemoAnswers(jeton, exerciseId, answers, request) {
  return call('POST', '/api/demo/correction', { jeton, body: { exercice: exerciseId, saisies: answers } }, request);
}

// Un spécimen d'attestation de l'exercice (D92, point 9), composé à la volée, jamais enregistré, sans jeton :
// { attestation, code, signature, url_verification, annulee_le: null, specimen: true }. Erreur : 400 exercice inconnu ou archivé.
export function getSpecimen(exerciseId, request) {
  return call('GET', `/api/demo/specimen?exercice=${encodeURIComponent(exerciseId)}`, {}, request);
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

// --- La Gestion du contenu (jalon 7a, D47 à D49, D74) : rôle admin, même cookie que l'espace professeur ----------------------------

const editor = (method, path, body, request) => call(method, `/api/prof/editeur/${path}`, body === undefined ? {} : { body }, request);

// La liste des exercices : { exercices: [{ id, titre, modifie, derniere_version, publie_le, archive_le, seances, versions, liste }] }.
export const editorListExercises = (request) => editor('GET', 'exercices', undefined, request);

// Un exercice : { exercice: { id, brouillon, revision, … }, versions, derniere_version, tables, erreurs }. Erreur : 404.
export const editorGetExercise = (id, request) => editor('GET', `exercice?id=${encodeURIComponent(id)}`, undefined, request);

// Créer ({ id, titre }) ou dupliquer ({ id, depuis }) : { cree: true, id }. Erreurs : 400 identifiant ou titre ; 409 identifiant pris.
export const editorCreateExercise = (body, request) => editor('POST', 'exercice/creer', body, request);

// Enregistrer le brouillon : { enregistre: true, revision, erreurs }. Erreur : 409 enregistré ailleurs entre-temps (D48).
export const editorSaveDraft = (id, revision, brouillon, request) => editor('POST', 'exercice/enregistrer', { id, revision, brouillon }, request);

// Renommer : { renomme: true, titre, en_direct } — un exercice publié, en direct (D78 ; 400 titre en double, avec
// `doublons`) ; jamais publié, le titre du brouillon.
export const editorRenameExercise = (id, titre, request) => editor('POST', 'exercice/renommer', { id, titre }, request);
// Monter ou descendre un exercice dans la liste (D51) : { deplace: true, id, rang }. Erreurs : 400 déjà au bord ; 409 la liste a changé.
export const editorMoveExercise = (id, rang, direction, request) => editor('POST', 'exercice/deplacer', { id, rang, direction }, request);
export const editorArchiveExercise = (id, archive, request) => editor('POST', 'exercice/archiver', { id, archive }, request);
export const editorDeleteExercise = (id, request) => editor('POST', 'exercice/supprimer', { id }, request);

// Publier le brouillon : { publie: true, numero, publiee_le }. Erreurs : 400 erreurs de validation ; 409 révision périmée.
export const editorPublish = (id, revision, request) => editor('POST', 'exercice/publier', { id, revision }, request);

// Reprendre une version publiée d'un exercice dans le brouillon, qui garde sa version de tables : { repris, numero, revision,
// tables_id, erreurs } ; annuler les modifications du brouillon : { annule, numero, revision, tables_id } (D77) ; 400, 404, 409.
export const editorResume = (id, revision, numero, request) => editor('POST', 'exercice/reprendre', { id, revision, numero }, request);
export const editorCancel = (id, revision, request) => editor('POST', 'exercice/annuler', { id, revision }, request);

// Aperçu : { questions, champs_evalues } — du brouillon donné, ou d'une version ({ version: n }).
export const editorPreview = (body, request) => editor('POST', 'apercu', body, request);

// La banque : { outils: [{ id, outil, revision, rang, archive_le, exercices }], tables }.
export const editorBank = (request) => editor('GET', 'banque', undefined, request);
export const editorBankCreate = (body, request) => editor('POST', 'banque/creer', body, request);
// Enregistrer un outil : { enregistre, revision, erreurs, lignes, avertissements } — `inchange` sans changement (rien d'écrit) ;
// le contenu remplacé va à l'historique (D79). Erreurs : 400 photo choisie inconnue ou archivée ; 409 enregistré ailleurs.
export const editorBankSave = (id, revision, outil, request) => editor('POST', 'banque/enregistrer', { id, revision, outil }, request);
export const editorBankArchive = (id, archive, request) => editor('POST', 'banque/archiver', { id, archive }, request);
// La page d'un outil (D79) : { outil: { id, outil, revision, …, modifie_le, modifie_par, exercices }, tables, erreurs,
// avertissements, historique: [{ id, enregistre_le, enregistre_par, remplace_le, remplace_par, action, lignes, erreurs, avertissements }] }.
export const editorBankTool = (id, request) => editor('GET', `banque/outil?id=${encodeURIComponent(id)}`, undefined, request);
// Rétablir un contenu de l'historique d'un outil : { retabli, revision, lignes, erreurs, avertissements } ; 400 rien à changer ; 404, 409.
export const editorBankRestore = (id, revision, historique, request) => editor('POST', 'banque/retablir', { id, revision, historique }, request);

// Tables de référence versionnées (D61 à D63) : la page du brouillon ({ brouillon, modifie, erreurs, versions, derniere, suggestion }),
// une version ({ tables }), enregistrer ({ enregistre, revision, erreurs } ; 409 conflit), publier ({ publie, id } ; 400 erreurs
// ou sans différence, 409 révision périmée ou prise), l'aperçu d'un exercice avec ces tables, et le changement de version d'un exercice.
export const editorTables = (request) => editor('GET', 'tables', undefined, request);
export const editorTablesVersion = (id, request) => editor('GET', `tables/version?id=${encodeURIComponent(id)}`, undefined, request);
export const editorTablesSave = (revision, contenu, request) => editor('POST', 'tables/enregistrer', { revision, contenu }, request);
// Publier, avec la cascade (D77) : `cascade`, les identifiants des exercices cochés ; { publie, id, publiee_le, cascade:
// { publies, brouillons, laisses, ignores } }.
export const editorTablesPublish = (revision, id, cascade, request) => editor('POST', 'tables/publier', { revision, id, cascade }, request);
// La cascade que la publication proposerait (D77) : { remplacee, candidats: [{ id, titre, archive_le, publication, brouillon, en_erreur, erreurs, lignes }] }.
export const editorTablesCascade = (request) => editor('GET', 'tables/cascade', undefined, request);
// Reprendre une version des tables (ses valeurs) ; annuler les modifications du brouillon des tables (D77) ; 400, 404, 409.
export const editorTablesResume = (revision, id, request) => editor('POST', 'tables/reprendre', { revision, id }, request);
export const editorTablesCancel = (revision, request) => editor('POST', 'tables/annuler', { revision }, request);
export const editorTablesPreview = (contenu, exercice, request) => editor('POST', 'tables/apercu', { contenu, exercice }, request);
export const editorExerciseTables = (id, revision, tablesId, request) => editor('POST', 'exercice/tables', { id, revision, tables_id: tablesId }, request);

// La présentation des tables en direct (D76) : la lire ({ presentation, revision, appliquee, erreurs, matieres_outil,
// historique }), l'appliquer ({ applique, revision, lignes } ; 400 erreurs — liste blanche comprise — ou rien à changer ;
// 409 appliquée ailleurs), rétablir un contenu de l'historique ({ retablie, revision, lignes, avertissements } ; 404, 409).
export const editorPresentation = (request) => editor('GET', 'presentation', undefined, request);
export const editorPresentationApply = (revision, presentation, request) => editor('POST', 'presentation/appliquer', { revision, presentation }, request);
export const editorPresentationRestore = (revision, historique, request) => editor('POST', 'presentation/retablir', { revision, historique }, request);

// La présentation d'un exercice publié en direct (D78) : la lire ({ presentation, revision, appliquee, outils, erreurs,
// avertissements, en_attente, historique } ; 400 jamais publié), l'appliquer ({ applique, revision, lignes, avertissements } ;
// 400 erreurs — liste blanche comprise —, titre en double (`doublons`) ou rien à changer ; 409 appliquée ailleurs), rétablir un
// contenu de son historique ({ retablie, revision, lignes, avertissements } ; 400 titre en double ; 404, 409).
export const editorExercisePresentation = (id, request) => editor('GET', `exercice/presentation?id=${encodeURIComponent(id)}`, undefined, request);
export const editorExercisePresentationApply = (id, revision, presentation, request) => editor('POST', 'exercice/presentation/appliquer', { id, revision, presentation }, request);
export const editorExercisePresentationRestore = (id, revision, historique, request) => editor('POST', 'exercice/presentation/retablir', { id, revision, historique }, request);

// Images (D56) : la liste avec les utilisations ({ images }), le téléversement ({ image, existante, retires }),
// archiver, renommer, supprimer (409 si utilisée), et l'envoi d'une image d'un export avant l'import (D59).
export const editorImages = (usage, request) => editor('GET', `images${usage ? `?usage=${encodeURIComponent(usage)}` : ''}`, undefined, request);
export const editorImageUpload = (body, request) => editor('POST', 'images/televerser', body, request);
export const editorImageArchive = (id, archive, request) => editor('POST', 'images/archiver', { id, archive }, request);
export const editorImageRename = (id, nom, request) => editor('POST', 'images/renommer', { id, nom }, request);
export const editorImageDelete = (id, request) => editor('POST', 'images/supprimer', { id }, request);
export const editorImageImport = (image, request) => editor('POST', 'images/importer', { image }, request);

// Sauvegarde : l'export complet ; la validation d'un export ({ erreurs, resume }) ; l'import ({ importe: true, resume }).
export const editorExport = (request) => editor('GET', 'export', undefined, request);
export const editorImportValidate = (exported, request) => editor('POST', 'import/valider', { export: exported }, request);
export const editorImport = (exported, confirmation, request) => editor('POST', 'import', { export: exported, confirmation }, request);
