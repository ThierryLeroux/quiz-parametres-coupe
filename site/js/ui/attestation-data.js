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

// La version de l'exercice telle qu'elle s'affiche (D50) : depuis le jalon 7a, une version publiée est
// un numéro (« 1 ») et s'écrit « version 1 » ; une attestation figée avant (« r0 ») reste telle quelle.
export function exerciseVersionLabel(revision) {
  return /^\d+$/.test(String(revision)) ? `version ${revision}` : String(revision);
}

// Lignes du bloc d'informations, dans l'ordre d'affichage : [libellé, valeur].
//   mono : la valeur s'écrit en chasse fixe (matricule, code)
export function attestationFacts(record) {
  return [
    { label: 'Exercice', value: record.exercice.titre },
    { label: "Version de l'exercice", value: exerciseVersionLabel(record.revision) },
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
//   lines : le même en-tête sur deux lignes, « Vc » puis « (pi/min) », pour les largeurs resserrées (D85)
export function questionColumns(record) {
  const present = new Set((record.questions ?? []).flatMap((q) => Object.keys(q.reponses)));
  return ANSWER_FIELDS.filter((field) => present.has(field)).map((field) => {
    const { symbol, unit } = FIELD_PARTS[field];
    return { key: field, label: `${symbol} (${unit})`, lines: [symbol, `(${unit})`] };
  });
}

// La matière de l'outil, en court (l'enregistrement garde le nom complet).
const TOOL_MATERIAL_SHORT = { 'Acier rapide': 'Acier rapide', 'Carbure de tungstène solide': 'Carbure solide', 'Insert de carbure de tungstène': 'Insert de carbure' };

// « P 1 — Acier non allié, Recuit » : classe, no de groupe, nom, état (sans état : pas de virgule).
export function materialText(materiau) {
  const state = materiau.etat ? `, ${materiau.etat}` : '';
  return `${materiau.classe} ${materiau.groupe} — ${materiau.materiau}${state}`;
}

// Mise en page sur une ou plusieurs pages lettre (UI §3.6). La première page porte l'en-tête, le bloc
// d'informations, le QR et le tableau par outil : il lui reste d'autant moins de place pour les
// questions qu'il y a d'outils. Les pages suivantes n'ont que l'en-tête et la suite des tableaux.
// Rien n'est tronqué (D43) : un texte long se replie dans sa cellule, et un rang peut prendre deux
// lignes. La coupe entre les pages se décide donc par un compte de pixels, à partir d'une estimation
// du nombre de lignes de chaque rang. Tout est mesuré dans Chrome sur la page lettre (10 po utiles,
// soit 960 px ; 720 px de large) avec la police d'impression, Carlito 9,5 px (UI §3.6) : si la
// police ou la CSS de la page change, recalibrer ici — et vérifier le débordement en mode impression, ou au
// pied de page : à l'écran, ce qui dépasse tombe dans la marge de la page et ne se voit pas à `scrollHeight`.
export const PAGE_LAYOUT = {
  // ❓ D85, point 6 (proposé) : 460 jusque-là, soit 37 px de trop — mesuré : 422,9 px. Une page 1 pleine poussait son pied hors de la zone imprimable.
  firstPageFree: 420, // px libres sur la page 1 pour les rangs des deux tableaux, une fois tout le reste posé (titres, en-têtes des tableaux, note, pied)
  nextPageFree: 740, // px libres sur une page de suite pour les rangs de son tableau (en-tête, rappel, titre, en-tête du tableau et pied posés)
  toolRow: 24, // px par ligne du tableau par outil
  toolsHead: 36, // px de l'en-tête du tableau par outil, avec la marge au-dessus
  note: 39, // px de la note sous le tableau par outil (deux lignes), avec la marge au-dessus
  questionsTitle: 38, // px du titre de la liste des questions, avec la marge au-dessus
  questionsHead: 32, // px de l'en-tête du tableau des questions, avec la marge au-dessus ; une ligne de plus en largeurs resserrées
  rowBase: 7, // px d'un rang de question sans ses lignes de texte (marges et trait)
  line: 13, // px par ligne de texte d'un rang
  charWidth: 4.6, // px par caractère, avec de la marge (mesuré : 4,0), pour ne jamais sous-estimer le repli
  cellPadding: 8, // px de marges dans une cellule
  minMaterial: 100, // px : sous cette largeur du matériau usiné, le tableau des questions passe aux largeurs resserrées
  // Largeurs de attestation.css (un test vérifie qu'elles s'y retrouvent). Le matériau usiné prend ce qui reste.
  columns: { numero: 22, outil: 180, materiau_outil: 90, answer: 60, stamp: 110, page: 720 }, // une, deux ou trois grandeurs évaluées
  narrowColumns: { numero: 22, outil: 150, materiau_outil: 56, answer: 54, stamp: 62, page: 720 }, // quatre ou cinq (D85) : la date et l'heure sur deux lignes
};

// Nombre de lignes qu'un texte occupe dans une colonne de cette largeur (au moins une). Le texte se replie entre
// les mots, comme dans le navigateur ; un mot plus large que la colonne, lui, se coupe — en dernier recours.
function linesIn(text, width, layout) {
  const room = width - layout.cellPadding;
  let lines = 1;
  let used = 0; // px déjà pris sur la ligne en cours
  for (const word of text.split(' ')) {
    const size = word.length * layout.charWidth;
    if (used > 0 && used + layout.charWidth + size > room) { lines += 1; used = 0; }
    if (size > room) {
      const parts = Math.ceil(size / room);
      lines += parts - 1;
      used = size - (parts - 1) * room;
    } else {
      used += (used > 0 ? layout.charWidth : 0) + size;
    }
  }
  return lines;
}

// Les largeurs du tableau des questions, d'après le nombre de grandeurs évaluées (D85) : les largeurs ordinaires
// tant qu'elles laissent au matériau usiné au moins `minMaterial` px (une, deux ou trois grandeurs) ; sinon les
// largeurs resserrées (quatre ou cinq), où l'en-tête d'une grandeur et la date et l'heure prennent deux lignes.
//   narrow   : vrai en largeurs resserrées
//   materiau : la largeur du matériau usiné — ce qui reste, une fois les autres colonnes posées
export function questionWidths(answerColumns, layout = PAGE_LAYOUT) {
  const rest = ({ numero, outil, materiau_outil: material, answer, stamp, page }) => page - numero - outil - material - answer * answerColumns - stamp;
  const narrow = rest(layout.columns) < layout.minMaterial;
  const columns = narrow ? layout.narrowColumns : layout.columns;
  return { ...columns, narrow, materiau: rest(columns) };
}

// Largeur de la colonne « Matériau usiné ».
export const materialColumnWidth = (answerColumns, layout = PAGE_LAYOUT) => questionWidths(answerColumns, layout).materiau;

// Les lignes du tableau des questions réussies, dans l'ordre de l'enregistrement (chronologique),
// chacune avec le nombre de lignes de texte qu'elle occupe (`lines`, pour la pagination).
//   reponses : une valeur par colonne de questionColumns, « — » si la question n'évaluait pas cette grandeur
export function questionRows(record, layout = PAGE_LAYOUT) {
  const columns = questionColumns(record);
  const widths = questionWidths(columns.length, layout);
  const stampLines = widths.narrow ? 2 : 1; // en largeurs resserrées : la date, puis l'heure
  return (record.questions ?? []).map((q) => {
    const outil = q.outil;
    const materiauOutil = TOOL_MATERIAL_SHORT[q.materiau_outil] ?? q.materiau_outil;
    const materiau = materialText(q.materiau);
    return {
      numero: String(q.numero),
      outil,
      materiau_outil: materiauOutil,
      materiau,
      reponses: columns.map((column) => q.reponses[column.key] ?? '—'),
      horodatage: formatDateStamp(q.horodatage, { seconds: true }),
      lines: Math.max(stampLines, linesIn(outil, widths.outil, layout), linesIn(materiauOutil, widths.materiau_outil, layout), linesIn(materiau, widths.materiau, layout)),
    };
  });
}

// Hauteur d'un rang, en px : ses marges et son trait, plus ses lignes de texte.
export const rowHeight = (row, layout = PAGE_LAYOUT) => layout.rowBase + layout.line * (row.lines ?? 1);

// Répartit les deux tableaux en pages (D85) : [{ tools, note, title, questions }, …], dans l'ordre de lecture.
//   tools     : les rangs du tableau par outil qui sont sur cette page
//   note      : la note des réussites de suite est sur cette page — toujours sous le dernier rang du tableau par outil
//   title     : la liste des questions commence sur cette page (son titre y est, même si aucun rang n'y tient)
//   questions : les rangs de la liste des questions qui sont sur cette page
// La première page est toujours là. Le tableau par outil se poursuit sur la page suivante quand il ne tient plus,
// comme la liste des questions ; un rang ne se coupe jamais entre deux pages, et une page neuve prend toujours son
// premier rang. Sans question (enregistrement figé avant D41) : le tableau par outil seul.
//   toolRows      : attestationRows(record)
//   rows          : questionRows(record)
//   answerColumns : le nombre de grandeurs évaluées, dont dépend la hauteur de l'en-tête du tableau des questions
export function paginateAttestation(toolRows, rows, answerColumns = 0, layout = PAGE_LAYOUT) {
  const head = layout.questionsHead + (questionWidths(answerColumns, layout).narrow ? layout.line : 0);
  // La place sous le premier titre de la page, jusqu'au pied.
  const firstPage = layout.firstPageFree + layout.toolsHead + layout.note + layout.questionsTitle + layout.questionsHead;
  const nextPage = layout.nextPageFree + layout.questionsHead;
  const pages = [];
  let page;
  let free;
  const open = () => {
    page = { tools: [], note: false, title: false, questions: [] };
    free = pages.length === 0 ? firstPage : nextPage;
    pages.push(page);
  };
  open();

  toolRows.forEach((row, i) => {
    const under = i === toolRows.length - 1 ? layout.note : 0; // la note ne quitte pas le dernier rang
    if (page.tools.length > 0 && layout.toolRow + under > free) open();
    if (page.tools.length === 0) free -= layout.toolsHead;
    page.tools.push(row);
    free -= layout.toolRow;
  });
  if (toolRows.length > 0) {
    page.note = true;
    free -= layout.note;
  }

  if (rows.length > 0) {
    // Le titre de la liste : sous la note s'il y tient, sinon en tête de la page suivante (où il ne coûte rien).
    if (layout.questionsTitle > free) open(); else free -= layout.questionsTitle;
    page.title = true;
    for (const row of rows) {
      const height = rowHeight(row, layout);
      const blank = page.tools.length === 0 && page.questions.length === 0;
      if (!blank && height + (page.questions.length === 0 ? head : 0) > free) open();
      if (page.questions.length === 0) free -= head;
      page.questions.push(row);
      free -= height;
    }
  }
  return pages;
}

// Les titres des deux tableaux, page par page : [{ tools, questions }], null quand le tableau n'est pas sur la page.
// « Opérations effectuées », puis « Opérations effectuées (suite) » ; « Questions réussies qui comptent (36) » là où
// la liste commence, puis « … (suite) » ; et « — suite à la page suivante » tant que le tableau n'est pas fini.
//   pages         : celles de paginateAttestation
//   questionCount : le nombre de questions de la liste
export function tableTitles(pages, questionCount) {
  const lastOf = (key) => pages.map((page) => page[key].length > 0).lastIndexOf(true);
  const lastTools = lastOf('tools');
  const lastQuestions = lastOf('questions');
  const more = (continued) => (continued ? ' — suite à la page suivante' : '');
  return pages.map((page, i) => ({
    tools: page.tools.length > 0 ? `Opérations effectuées${i > 0 ? ' (suite)' : ''}${more(i < lastTools)}` : null,
    questions: page.title || page.questions.length > 0 ? `Questions réussies qui comptent (${page.title ? questionCount : 'suite'})${more(i < lastQuestions)}` : null,
  }));
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
    seance_supprimee: "séance supprimée par l'enseignant",
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
