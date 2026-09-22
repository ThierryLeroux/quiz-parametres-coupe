// Ce que la page de l'attestation et la page de vérification montrent d'un enregistrement
// d'attestation (décisions D31, D33 ; UI §3.6, §3.7) : fonctions PURES, sans DOM, testées sous
// Node. L'enregistrement vient du serveur, figé (SPEC §8) : rien n'est relu du catalogue ici.

import { formatDateStamp } from './text.js';

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
