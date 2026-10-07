// Ce que montre l'espace enseignant (décisions D34, D35, D95 ; UI §3.8) : le nom de la page, les onglets, la garde des
// modifications, puis les colonnes du tableau des séances, filtre, tri, recherche, export CSV, journal des corrections
// d'identité. Fonctions PURES, sans DOM, testées sous Node ; prof-shell.js et prof.js ne font que les mettre à l'écran.

import { HOME_LINK_LABEL, formatDateStamp } from './text.js';

// --- L'espace enseignant, une seule page (D95) : le nom, les onglets, la garde des modifications ---------------------

// Le nom de la page : « enseignant », jamais « professeur », dans tout texte affiché (D95). L'adresse reste /prof.
export const TITLE = 'Espace enseignant';

// Les liens sous le formulaire de connexion (D87) : le retour à l'accueil, visible aussi après « Se déconnecter ».
export const LOGIN_LINKS = [{ label: HOME_LINK_LABEL, href: '/' }];

// La question posée avant de quitter un écran qui a des modifications non enregistrées (leave(), un changement
// d'onglet, les liens de la barre du haut).
export const LEAVE_CONFIRMATION = 'Des modifications ne sont pas enregistrées. Quitter la page et les perdre ?';

// Le message de l'écran de connexion quand le serveur refuse le cookie (401) : « Ta séance a expiré » seulement pour une
// séance qui était ouverte et expire en cours de travail ; à l'ouverture de la page sans cookie, la connexion s'ouvre
// sans message (D87, point 4).
//   connected : une séance était ouverte (connexion réussie, ou un appel qui a réussi après un rechargement)
export const EXPIRED_NOTICE = 'Ta séance a expiré. Connecte-toi de nouveau.';
export const loginNotice = (connected) => (connected ? EXPIRED_NOTICE : '');

// Un clic sur un lien de la barre du haut quitte la page : faut-il d'abord poser LEAVE_CONFIRMATION ? Oui s'il y a des
// modifications non enregistrées — sauf si le clic ouvre un autre onglet (Ctrl, Maj ou ⌘) : la page reste, rien à demander.
//   dirty : les modifications non enregistrées ; keys : { ctrlKey, metaKey, shiftKey } de l'événement
export function confirmsBeforeLeaving(dirty, { ctrlKey = false, metaKey = false, shiftKey = false } = {}) {
  return Boolean(dirty) && !ctrlKey && !metaKey && !shiftKey;
}

// Les onglets, dans l'ordre : ceux des réussites (prof.js), puis ceux du contenu (editeur.js). Sauvegarde : rôle admin
// seulement (l'export est tout le contenu, l'import est une écriture).
export const TABS = [
  { key: 'seances', label: 'Réussites' },
  { key: 'identites', label: "Corrections d'identité" },
  { key: 'exercices', label: 'Exercices' },
  { key: 'banque', label: "Banque d'outils" },
  { key: 'tables', label: 'Tables de référence' },
  { key: 'images', label: 'Images' },
  { key: 'sauvegarde', label: 'Sauvegarde', adminOnly: true },
];

// Les onglets offerts à un rôle : les sept à l'administration, six à la consultation.
export const tabsFor = (role) => TABS.filter((tab) => !tab.adminOnly || canAct(role));

// L'onglet à ouvrir d'après le fragment de l'adresse (« #exercices », ce que /prof/editeur donne) : lui s'il est offert
// à ce rôle, sinon le premier, Réussites.
export function initialTab(hash, role) {
  const key = String(hash ?? '').replace(/^#/, '');
  return (tabsFor(role).find((tab) => tab.key === key) ?? TABS[0]).key;
}

// Le sur-titre d'un écran : « Espace enseignant · exercices », suivi de « · lecture seule » pour la consultation.
export const eyebrowText = (part, role) => `${TITLE}${part ? ` · ${part}` : ''}${roleNote(role)}`;

// Les colonnes du tableau, dans l'ordre. `key` sert au tri et à l'export.
export const SESSION_COLUMNS = [
  { key: 'nom', label: 'Nom' },
  { key: 'prenom', label: 'Prénom' },
  { key: 'matricule', label: 'Matricule', mono: true },
  { key: 'exercice', label: 'Exercice' },
  { key: 'debut', label: 'Début', date: true },
  { key: 'derniere_activite', label: 'Dernière activité', date: true },
  { key: 'etat', label: 'État' },
  { key: 'questions_reussies', label: 'Questions réussies', num: true },
  { key: 'code', label: 'Attestation', mono: true },
];

// --- Rôles (D44) : la clé d'administration agit, la clé de consultation ne fait que lire -----------------------------

// Le rôle consultation ne voit aucun bouton d'action ; le serveur refuse de toute façon (403).
export const canAct = (role) => role === 'admin';

// L'étiquette de l'espace dans la barre du haut (D94) : « Administration » ou « Consultation ».
export function roleLabel(role) {
  return canAct(role) ? 'Administration' : 'Consultation';
}

// Ce que le sur-titre ajoute pour la consultation : « · lecture seule » ; rien pour l'administration.
export const roleNote = (role) => (canAct(role) ? '' : ' · lecture seule');

// L'ambiance de couleur de la page (D94), d'après le rôle de la séance professeur : la valeur de data-espace sur <html>.
// Sans séance (la connexion, la déconnexion), l'espace étudiant.
export function spaceOf(role) {
  if (role === 'admin') return 'admin';
  if (role === 'consultation') return 'consultation';
  return 'etudiant';
}

// Minuscules, sans accent : pour chercher « levesque » et trouver « Lévesque ».
export const plain = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Réussi ou en cours.
export const sessionState = (session) => (session.reussite_le === null ? 'En cours' : 'Réussi');

// Les valeurs à afficher d'une séance, une par colonne.
export function sessionCells(session) {
  return {
    nom: session.nom,
    prenom: session.prenom,
    matricule: session.matricule,
    exercice: session.exercice.titre,
    debut: formatDateStamp(session.debut),
    derniere_activite: formatDateStamp(session.derniere_activite),
    etat: session.reussite_le === null ? 'En cours' : `Réussi le ${formatDateStamp(session.reussite_le)}`,
    questions_reussies: String(session.questions_reussies),
    code: session.code ?? '',
  };
}

// Filtre par exercice (id, ou '' pour tous) et recherche par matricule ou par nom (prénom compris),
// sans tenir compte de la casse ni des accents.
export function filterSessions(sessions, { exercice = '', search = '' } = {}) {
  const needle = plain(search).trim();
  return sessions.filter((session) => {
    if (exercice !== '' && session.exercice.id !== exercice) return false;
    if (needle === '') return true;
    return [session.matricule, session.nom, session.prenom, `${session.prenom} ${session.nom}`, `${session.nom} ${session.prenom}`].some((value) => plain(value).includes(needle));
  });
}

// La valeur de tri d'une colonne : texte comparable (sans accent), nombre, ou date ISO (qui se
// compare comme du texte). L'état trie les réussites avant les séances en cours.
function sortValue(session, key) {
  if (key === 'questions_reussies') return session.questions_reussies;
  if (key === 'exercice') return plain(session.exercice.titre);
  if (key === 'etat') return session.reussite_le === null ? '' : session.reussite_le;
  if (key === 'code') return session.code ?? '';
  if (key === 'debut' || key === 'derniere_activite') return session[key];
  return plain(session[key]);
}

// Trie une copie de la liste par colonne, montante ou descendante ; l'ordre d'origine départage les égalités.
export function sortSessions(sessions, key, ascending = true) {
  const direction = ascending ? 1 : -1;
  return sessions
    .map((session, index) => ({ session, index, value: sortValue(session, key) }))
    .sort((a, b) => {
      if (a.value < b.value) return -direction;
      if (a.value > b.value) return direction;
      return a.index - b.index;
    })
    .map((entry) => entry.session);
}

// --- Export CSV (D34) : UTF-8 avec BOM, séparateur « ; », dates ISO, pour Excel en français ------------------------

const CSV_COLUMNS = [
  ['Nom', (s) => s.nom],
  ['Prénom', (s) => s.prenom],
  ['Matricule', (s) => s.matricule],
  ['Exercice', (s) => s.exercice.id],
  ['Titre', (s) => s.exercice.titre],
  ['Début', (s) => formatDateStamp(s.debut, { seconds: true })],
  ['Dernière activité', (s) => formatDateStamp(s.derniere_activite, { seconds: true })],
  ['État', (s) => (s.reussite_le === null ? 'en cours' : 'réussi')],
  ['Réussite', (s) => (s.reussite_le === null ? '' : formatDateStamp(s.reussite_le, { seconds: true }))],
  ['Questions réussies', (s) => String(s.questions_reussies)],
  ['Attestation', (s) => s.code ?? ''],
];

// Une cellule CSV : entre guillemets si elle contient le séparateur, un guillemet ou un saut de ligne.
export function csvCell(value) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// Le fichier CSV de la liste affichée. Les dates sont en ISO 8601 (format étendu, à l'heure du
// poste, séparateur espace : Excel reconnaît « 2026-09-21 13:48:10 », pas le « T »).
export function csvOf(sessions) {
  const lines = [CSV_COLUMNS.map(([label]) => csvCell(label)).join(';')];
  for (const session of sessions) lines.push(CSV_COLUMNS.map(([, read]) => csvCell(read(session))).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}

// « reussites-m10-tournage-vc-2026-09-21.csv », ou « reussites-tous-… » sans filtre.
export function csvFileName(exercice, now) {
  return `reussites-${exercice || 'tous'}-${formatDateStamp(now.toISOString()).slice(0, 10)}.csv`;
}

// --- Journal des corrections d'identité (D23) : lisible, la plus récente en premier ---------------------------------

const identity = (prenom, nom, matricule) => `${prenom} ${nom} · ${matricule}`;
const shortCode = (code) => `${code.slice(0, 5)}-${code.slice(5)}`;

// Une correction après la réussite a réémis l'attestation (D37) : « ABCDE-FGHJK → ZZZZZ-YYYYY ».
export function identityRows(corrections) {
  return corrections.map((c) => ({
    id: c.id,
    horodatage: formatDateStamp(c.horodatage),
    exercice: c.exercice_id,
    matricule: c.matricule,
    avant: identity(c.ancien_prenom, c.ancien_nom, c.ancien_matricule),
    apres: identity(c.nouveau_prenom, c.nouveau_nom, c.nouveau_matricule),
    attestation: c.ancien_code && c.nouveau_code ? `${shortCode(c.ancien_code)} → ${shortCode(c.nouveau_code)}` : '',
    seance: c.seance_id,
  }));
}

// Le texte de confirmation d'une réinitialisation du NIP (D38).
export function nipResetConfirmation(session) {
  return `Réinitialiser le NIP de ${session.prenom} ${session.nom} (${session.matricule}, ${session.exercice.titre}) ? Le verrou tombe. À sa prochaine reprise, le NIP entré deviendra le nouveau. Sa progression ne change pas.`;
}

// --- Effacement des données des étudiants (D46) -------------------------------------------------------------------

// Le mot à taper pour effacer ; le serveur exige le même (worker/acces.js).
export const PURGE_WORD = 'EFFACER';

// Ce que la page d'effacement annonce, avant : « La base contient 3 séances. … »
export function purgeIntro(sessionCount) {
  const count = sessionCount === 0 ? 'aucune séance' : `${sessionCount} séance${sessionCount > 1 ? 's' : ''}`;
  return `La base contient ${count}. L'effacement supprime toutes les séances, leurs journaux de corrections, les corrections d'identité et les attestations, les démos en cours, ainsi que les compteurs de débit et les verrous par adresse, sans retour. Les anciens codes d'attestation répondront ensuite « aucune attestation ne correspond ». Le journal des actions reste, anonymisé (matricules, noms et codes remplacés par « — »), et note les nombres effacés. Les exercices, la banque d'outils et les données de référence ne sont jamais touchés.`;
}

// Ce que la page dit après : « Effacé : 3 séances, 40 corrections, 1 correction d'identité, 2 attestations, 1 démo, 12 compteurs de débit et 1 verrou ; journal des actions gardé, 4 entrées anonymisées. »
export function purgeSummary(nombres) {
  const plural = (count, one, many) => `${count} ${count > 1 ? many : one}`; // en français, zéro reste au singulier
  const erased = [
    plural(nombres.seances, 'séance', 'séances'),
    plural(nombres.corrections, 'correction', 'corrections'),
    plural(nombres.corrections_identite, "correction d'identité", "corrections d'identité"),
    plural(nombres.attestations, 'attestation', 'attestations'),
    plural(nombres.demos ?? 0, 'démo', 'démos'), // les démos en cours (D92), jetables
    plural(nombres.debit, 'compteur de débit', 'compteurs de débit'),
  ];
  return `Effacé : ${erased.join(', ')} et ${plural(nombres.verrous, 'verrou', 'verrous')}. Journal des actions gardé, ${plural(nombres.journal_anonymise, 'entrée anonymisée', 'entrées anonymisées')}.`;
}

// Le texte de confirmation d'une suppression (D45 ; D93 : tout dit, en phrases courtes) : le nom et le matricule, ce qui
// disparaît, ce qu'il advient de l'attestation.
export function deleteConfirmation(session) {
  const attestation = session.code ? ` Son attestation ${session.code} restera vérifiable et répondra « annulée ».` : '';
  return `Supprimer la séance de ${session.prenom} ${session.nom}, matricule ${session.matricule} (${session.exercice.titre}) ? La séance et son journal disparaissent, sans retour. L'étudiant pourra recommencer de zéro.${attestation}`;
}

// Le texte de confirmation d'une remise à zéro.
export function resetConfirmation(session) {
  const attestation = session.code ? " Son attestation sera annulée. L'ancien code répondra « annulée »." : '';
  return `Remettre à zéro la séance de ${session.prenom} ${session.nom} (${session.matricule}, ${session.exercice.titre}) ? Sa progression repart de zéro. Le matricule et le NIP restent.${attestation}`;
}
