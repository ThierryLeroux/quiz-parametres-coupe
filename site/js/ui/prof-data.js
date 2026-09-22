// Ce que montre l'espace professeur (décisions D34, D35 ; UI §3.8) : colonnes du tableau des
// séances, filtre, tri, recherche, export CSV, journal des corrections d'identité. Fonctions PURES,
// sans DOM, testées sous Node ; prof.js ne fait que les mettre à l'écran.

import { formatDateStamp } from './text.js';

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

// Le texte de confirmation d'une remise à zéro.
export function resetConfirmation(session) {
  const attestation = session.code ? " Son attestation sera annulée ; l'ancien code répondra « annulée »." : '';
  return `Remettre à zéro la séance de ${session.prenom} ${session.nom} (${session.matricule}, ${session.exercice.titre}) ? Sa progression repart de zéro ; le matricule et le NIP restent.${attestation}`;
}
