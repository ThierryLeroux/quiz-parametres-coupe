// Ce que la page de l'attestation et la page de vérification montrent d'un enregistrement
// d'attestation (décisions D31, D33 ; UI §3.6, §3.7) : fonctions PURES, sans DOM, testées sous
// Node. L'enregistrement vient du serveur, figé (SPEC §8) : rien n'est relu du catalogue ici.

import { ANSWER_FIELDS } from '../correction.js';
import { FIELD_PARTS, formatDateStamp } from './text.js';

// La révision des tables (D28) : « A2026_r0 », ou les deux si elles diffèrent.
export function tablesRevision(record) {
  const { materiaux, operations } = record.revision_tables ?? {};
  if (!materiaux && !operations) return '—';
  return materiaux === operations ? materiaux : `vitesses ${materiaux} · avances ${operations}`;
}

// Lignes du bloc d'informations, dans l'ordre d'affichage : [libellé, valeur].
//   mono : la valeur s'écrit en chasse fixe (matricule, code)
export function attestationFacts(record) {
  return [
    { label: 'Exercice', value: record.exercice.titre },
    { label: "Version de l'exercice", value: record.revision },
    { label: 'Révision des tables', value: tablesRevision(record) },
    { label: 'Prénom', value: record.etudiant.prenom },
    { label: 'Nom', value: record.etudiant.nom },
    { label: 'Matricule', value: record.etudiant.matricule, mono: true },
    { label: "Début de l'exercice", value: formatDateStamp(record.debut) },
    { label: "Réussite de l'exercice", value: formatDateStamp(record.reussite_le) },
    { label: 'Questions réussies', value: String(record.questions_reussies) },
  ];
}

// Le tableau des opérations effectuées : une ligne par outil de l'exercice, dans l'ordre.
export function attestationRows(record) {
  return record.outils.map((outil) => ({
    operation: outil.operation,
    outil: outil.nom,
    plage: outil.plage,
    reussites: `${outil.reussites} / ${outil.requises}`,
  }));
}

// --- La liste des questions réussies (D41) ---------------------------------------------------------------------
// Un enregistrement figé avant cette version n'a pas de `questions` : la liste n'est pas montrée.
export const hasQuestions = (record) => Array.isArray(record.questions) && record.questions.length > 0;

// Les colonnes de réponses : les grandeurs évaluées, dans l'ordre du calcul, en tête « Vc (pi/min) ».
export function questionColumns(record) {
  const present = new Set((record.questions ?? []).flatMap((q) => Object.keys(q.reponses)));
  return ANSWER_FIELDS.filter((field) => present.has(field)).map((field) => ({ key: field, label: `${FIELD_PARTS[field].symbol} (${FIELD_PARTS[field].unit})` }));
}

// La matière de l'outil, en court, pour tenir sur une ligne du tableau.
const TOOL_MATERIAL_SHORT = { 'Acier rapide': 'Acier rapide', 'Carbure de tungstène solide': 'Carbure solide', 'Insert de carbure de tungstène': 'Insert de carbure' };

// « P 1 — Acier non allié, Recuit » : classe, no de groupe, nom, état (sans état : pas de virgule).
export function materialText(materiau) {
  const state = materiau.etat ? `, ${materiau.etat}` : '';
  return `${materiau.classe} ${materiau.groupe} — ${materiau.materiau}${state}`;
}

// Les lignes du tableau des questions réussies, dans l'ordre de l'enregistrement (chronologique).
//   reponses : une valeur par colonne de questionColumns, « — » si la question n'évaluait pas cette grandeur
export function questionRows(record) {
  const columns = questionColumns(record);
  return (record.questions ?? []).map((q) => ({
    numero: String(q.numero),
    outil: q.outil,
    materiau_outil: TOOL_MATERIAL_SHORT[q.materiau_outil] ?? q.materiau_outil,
    materiau: materialText(q.materiau),
    reponses: columns.map((column) => q.reponses[column.key] ?? '—'),
    horodatage: formatDateStamp(q.horodatage, { seconds: true }),
  }));
}

// Mise en page sur une ou plusieurs pages lettre (UI §3.6). La première page porte l'en-tête, le bloc
// d'informations, le QR et le tableau par outil : il lui reste d'autant moins de place pour les
// questions qu'il y a d'outils. Les pages suivantes n'ont que l'en-tête et la suite du tableau.
// Les lignes ont toutes une hauteur fixe (une ligne, sans repli : attestation.css) : la coupe se
// décide par un compte de pixels, mesurés dans Chrome sur la page lettre (10 po utiles, soit 960 px).
export const PAGE_LAYOUT = {
  firstPageFree: 460, // px libres sur la page 1 pour le tableau par outil et les questions, une fois tout le reste posé
  toolRow: 24, // px par ligne du tableau par outil
  questionRow: 20, // px par ligne de question
  nextPageRows: 36, // questions par page de suite (en-tête, rappel, titre et pied posés)
};

// Répartit les lignes de questions en pages : [ [lignes de la page 1], [page 2], … ]. La première
// page est toujours là, même vide. Une page suivante n'existe que s'il reste des lignes.
export function paginateQuestions(rows, toolCount, layout = PAGE_LAYOUT) {
  const first = Math.max(0, Math.floor((layout.firstPageFree - layout.toolRow * toolCount) / layout.questionRow));
  const pages = [rows.slice(0, first)];
  for (let i = pages[0].length; i < rows.length; i += layout.nextPageRows) pages.push(rows.slice(i, i + layout.nextPageRows));
  return pages;
}

// « Page 2 de 3 »
export const pageLabel = (number, total) => `Page ${number} de ${total}`;

// La ligne de rappel en tête d'une page de suite : « Attestation de réussite — Camille Tremblay · 2412345 · code ABCDE-FGHJK (suite) »
export function continuationLine(record, code) {
  return `Attestation de réussite — ${record.etudiant.prenom} ${record.etudiant.nom} · ${record.etudiant.matricule} · code ${code} (suite)`;
}

// « Vérification : quiz.example/verifier — code ABCDE-FGHJK »
//   host : location.host — l'adresse du site sans « https:// », lisible sur papier
export function verificationMention(host, code) {
  return `Vérification : ${host}/verifier — code ${code}`;
}

// Pied de page : « TGM-TMI — TLP — 2026 », l'année de la réussite.
export function attestationFooter(record) {
  return `TGM-TMI — TLP — ${new Date(record.reussite_le).getFullYear()}`;
}

// Nom du fichier PDF proposé par le navigateur (c'est le titre de la page pendant l'impression) :
// « Attestation-m10-tournage-vc-Tremblay-Camille », sans accent ni espace.
export function attestationFileName(record) {
  const plain = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `Attestation-${record.exercice.id}-${plain(record.etudiant.nom)}-${plain(record.etudiant.prenom)}`;
}

// Ce que le champ de la page de vérification contient : un code, ou une adresse de vérification
// collée entière (tout ce qu'elle porte est envoyé). Retourne les champs à envoyer, ou null si le
// champ est vide.
export function claimsFromInput(text) {
  const typed = String(text ?? '').trim();
  if (typed === '') return null;
  if (typed.includes('?')) {
    try {
      return Object.fromEntries(new URL(typed, 'https://site.invalid').searchParams);
    } catch {
      return null;
    }
  }
  return { code: typed };
}

// « Cette attestation a été annulée le … : identité corrigée, une nouvelle attestation a été émise. »
function cancellationText(result) {
  const reasons = {
    remise_a_zero: "séance remise à zéro par l'enseignant",
    identite_corrigee: "identité corrigée par l'étudiant, une nouvelle attestation a été émise avec un autre code",
  };
  const reason = reasons[result.motif] ?? 'motif inconnu';
  const when = result.annulee_le ? ` le ${formatDateStamp(result.annulee_le)}` : '';
  return `Cette attestation a été annulée${when} : ${reason}. Voici l'enregistrement tel qu'il était.`;
}

// Titre et explication de chaque issue de la vérification (SPEC §8, D33).
export function verificationOutcome(result) {
  const outcomes = {
    valide: { tone: 'correct', title: 'Attestation valide', text: "Le serveur de correction détient cette attestation, et sa signature est authentique. Voici l'enregistrement tel qu'il le détient." },
    annulee: { tone: 'gold', title: 'Attestation annulée', text: cancellationText(result) },
    aucune: { tone: 'wrong', title: 'Aucune attestation ne correspond', text: 'Aucune attestation ne porte ce code. Vérifie le code sur le document ; un O ou un I ne peuvent pas y figurer.' },
    invalide: { tone: 'wrong', title: 'Signature invalide ou contenu modifié', text: "Ce que l'adresse du QR prétend ne correspond pas à ce que le serveur détient : le document a été fabriqué ou retouché." },
  };
  return outcomes[result.resultat] ?? { tone: 'wrong', title: 'Réponse inattendue', text: "Le serveur a répondu quelque chose d'inconnu." };
}
