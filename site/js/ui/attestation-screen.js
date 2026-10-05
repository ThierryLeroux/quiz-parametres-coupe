// Page de l'attestation de réussite (UI §3.6 ; décisions D31 à D33, D37, D41, D85) : une page lettre
// blanche, identique à l'écran et à l'impression, avec le QR de vérification — et, si le tableau par
// outil ou la liste des questions réussies ne tiennent pas dessous, leur suite sur les pages suivantes,
// avec l'en-tête. Elle remplace l'écran « Exercice réussi » et l'attestation provisoire du jalon 4. Le
// PDF vient de l'impression du navigateur, pas du serveur.
// Tout vient de l'enregistrement figé rendu par le serveur ; ce qu'on en montre est décidé par
// attestation-data.js (pur, testé) : ici, on ne fait que construire le DOM.

import { el, showScreen } from './dom.js';
import {
  attestationFacts, attestationFileName, attestationFooter, attestationRows, continuationLine, hasQuestions, pageLabel, paginateAttestation,
  questionColumns, questionRows, questionWidths, tableTitles, verificationMention,
} from './attestation-data.js';
import { qrSvg } from './qr.js';
import { DEPARTMENT_LINES, studentLine } from './text.js';

// Chaque cellule des deux tableaux porte le texte de l'en-tête de sa colonne (data-label) : la page de vérification
// (D90, attestation.css sous .verify-result) rend les rangs en fiches « libellé : valeur » et l'écrit devant la valeur.
// Sur la page lettre de l'attestation, l'attribut n'affiche rien.
const OPERATION_HEADERS = ['Opération', 'Outil', 'Plage de dimensions', 'Réussites de suite'];

// Le tableau des opérations effectuées, aussi utilisé par la page de vérification.
//   rows : les lignes à mettre dans ce tableau (une page, ou toutes pour la vérification)
export function operationsTable(record, rows = attestationRows(record)) {
  const [operation, outil, plage, reussites] = OPERATION_HEADERS;
  return el('table', { class: 'attestation-table attestation-operations' }, [
    el('thead', {}, el('tr', {}, [el('th', {}, operation), el('th', {}, outil), el('th', {}, plage), el('th', { class: 'num' }, reussites)])),
    el('tbody', {}, rows.map((row) => el('tr', {}, [
      el('td', { 'data-label': operation }, row.operation),
      el('td', { 'data-label': outil }, row.outil),
      el('td', { 'data-label': plage }, row.plage),
      el('td', { class: 'num', 'data-label': reussites }, row.reussites),
    ]))),
  ]);
}

// Le tableau des questions réussies (D41), aussi utilisé par la page de vérification : une ligne par
// question de la série finale de chaque outil, dans l'ordre chronologique.
//   rows   : les lignes à mettre dans ce tableau (une page, ou toutes pour la vérification)
//   narrow : les largeurs resserrées de la page lettre, à quatre ou cinq grandeurs évaluées (D85 : questionWidths) ;
//            la page de vérification n'a pas de largeurs fixes et ne les prend pas
export function questionsTable(record, rows = questionRows(record), narrow = false) {
  const columns = questionColumns(record);
  // Un en-tête ; en largeurs resserrées, le même texte sur deux lignes (attestation.css : chaque <span> fait sa ligne).
  const head = (attributes, label, lines) => el('th', attributes, narrow ? [el('span', {}, lines[0]), ' ', el('span', {}, lines[1])] : label);
  return el('table', { class: `attestation-table attestation-questions${narrow ? ' attestation-questions--narrow' : ''}` }, [
    el('thead', {}, el('tr', {}, [
      el('th', { class: 'num' }, 'N°'),
      el('th', {}, 'Outil'),
      head({}, "Matière d'outil", ['Matière', "d'outil"]),
      el('th', {}, 'Matériau usiné'),
      ...columns.map((column) => head({ class: 'num' }, column.label, column.lines)),
      head({}, 'Date et heure', ['Date', 'et heure']),
    ])),
    el('tbody', {}, rows.map((row) => el('tr', {}, [
      el('td', { class: 'num', 'data-label': 'N°' }, row.numero),
      el('td', { 'data-label': 'Outil' }, row.outil),
      el('td', { 'data-label': "Matière d'outil" }, row.materiau_outil),
      el('td', { 'data-label': 'Matériau usiné' }, row.materiau),
      ...row.reponses.map((value, i) => el('td', { class: 'num', 'data-label': columns[i].label }, value)),
      el('td', { class: 'stamp', 'data-label': 'Date et heure' }, row.horodatage),
    ]))),
  ]);
}

// Le bloc d'informations : deux colonnes de « libellé : valeur », aussi utilisé par la vérification (qui n'en fait qu'une).
// Une date et heure (fact.stamp) est marquée : sur /verifier, elle ne se coupe jamais entre la date et l'heure.
export function factsGrid(record) {
  return el('div', { class: 'attestation-facts' }, attestationFacts(record).map((fact) => el('div', { class: fact.stamp ? 'attestation-fact attestation-fact--stamp' : 'attestation-fact' }, [
    el('span', { class: 'attestation-fact-label' }, fact.label),
    el('span', { class: fact.mono ? 'attestation-fact-value mono' : 'attestation-fact-value' }, fact.value),
  ])));
}

const pageHeader = () => el('header', { class: 'attestation-header' }, [
  el('img', { class: 'sheet-logo', src: 'img/logo-cvm.png', alt: 'Cégep du Vieux Montréal' }),
  el('div', { class: 'attestation-department' }, DEPARTMENT_LINES.map((line) => el('div', {}, line))),
]);

const pageFooter = (record, number, total) => el('footer', { class: 'attestation-footer' }, [
  el('span', {}, `${attestationFileName(record)}.pdf · remis sur Léa par l'étudiant`),
  el('span', {}, attestationFooter(record)),
  el('span', {}, pageLabel(number, total)),
]);

// Les pages lettre de l'attestation : la première avec le QR, le bloc d'informations et le tableau
// par outil ; la liste des questions réussies commence dessous. Les deux tableaux continuent, au
// besoin, sur les pages suivantes, avec leur titre et leur en-tête (attestation-data.js décide de la coupe).
//   attestation : { attestation (l'enregistrement), code, url_verification } rendus par GET /api/attestation
//   host        : l'adresse du site, pour la mention de vérification
export function attestationPages({ attestation: record, code, url_verification: url }, host) {
  const listed = hasQuestions(record);
  const answerColumns = questionColumns(record).length;
  const { narrow } = questionWidths(answerColumns);
  const pages = paginateAttestation(attestationRows(record), listed ? questionRows(record) : [], answerColumns);
  const total = pages.length;
  const titles = tableTitles(pages, record.questions?.length ?? 0);
  // Ce qu'une page porte des deux tableaux, dans l'ordre : le tableau par outil, sa note, la liste des questions.
  const tables = (page, i) => [
    ...(titles[i].tools === null ? [] : [el('h2', { class: 'attestation-subtitle' }, titles[i].tools), operationsTable(record, page.tools)]),
    ...(page.note ? [el('p', { class: 'attestation-note' }, 'Chaque outil devait être réussi le nombre de fois indiqué, de suite : une mauvaise réponse remettait son compteur à zéro. Les paramètres ont été corrigés par le serveur de correction.')] : []),
    ...(titles[i].questions === null ? [] : [el('h2', { class: 'attestation-subtitle' }, titles[i].questions)]),
    ...(page.questions.length > 0 ? [questionsTable(record, page.questions, narrow)] : []),
  ];
  const first = el('article', { class: 'print-page attestation' }, [
    pageHeader(),
    el('h1', { class: 'attestation-title', tabindex: '-1' }, "Attestation de réussite — calcul de paramètres d'usinage"),
    el('div', { class: 'attestation-head' }, [
      factsGrid(record),
      el('div', { class: 'attestation-qr' }, [
        qrSvg(url, 160),
        el('div', { class: 'attestation-code' }, code),
      ]),
    ]),
    el('p', { class: 'attestation-mention' }, verificationMention(host, code)),
    ...tables(pages[0], 0),
    pageFooter(record, 1, total),
  ]);
  const rest = pages.slice(1).map((page, i) => el('article', { class: 'print-page attestation attestation--continued' }, [
    pageHeader(),
    el('p', { class: 'attestation-continuation' }, continuationLine(record, code)),
    ...tables(page, i + 1),
    pageFooter(record, i + 2, total),
  ]));
  return [first, ...rest];
}

// L'écran : barre de consigne, puis la page sur son fond gris.
//   seance      : l'état de la séance (pour l'en-tête)
//   attestation : ce que rend GET /api/attestation
//   actions     : { onIdentity, onQuit } — « Corriger mon identité » (D37) annule et réémet l'attestation
export function renderAttestation(main, { seance, attestation }, actions) {
  const fileName = attestationFileName(attestation.attestation);
  const print = () => {
    // Le navigateur propose le titre de la page comme nom de fichier PDF.
    const title = document.title;
    document.title = fileName;
    const restore = () => { document.title = title; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
  };
  const printButton = el('button', { class: 'button button--gold', type: 'button', onclick: print }, 'Enregistrer en PDF');

  const screen = el('div', { class: 'screen screen--document' }, [
    el('div', { class: 'attestation-bar no-print' }, [
      el('div', {}, [el('strong', {}, 'Exercice réussi. '), 'Remets ce PDF sur Léa.']),
      el('div', { class: 'attestation-bar-actions' }, [printButton, el('button', { class: 'button-link', type: 'button', onclick: actions.onQuit }, 'Terminer')]),
    ]),
    el('div', { class: 'print-stage attestation-stage' }, attestationPages(attestation, location.host)),
  ]);

  showScreen(main, screen, {
    title: 'Exercice réussi — attestation',
    aside: [
      el('span', {}, studentLine(seance)),
      el('button', { class: 'button-link', type: 'button', onclick: actions.onIdentity }, 'Corriger mon identité'),
      el('button', { class: 'button-link', type: 'button', onclick: actions.onQuit }, 'Quitter'),
    ],
  }, '.attestation-title');
}

// L'attestation n'a pas pu être chargée (serveur injoignable) : le message, et « Réessayer ».
//   actions : { onRetry, onQuit }
export function renderAttestationError(main, { seance, message }, actions) {
  const screen = el('div', { class: 'screen' }, el('section', { class: 'panel panel--correct' }, [
    el('div', { class: 'eyebrow' }, seance.exercice.titre),
    el('h1', { tabindex: '-1' }, 'Exercice réussi'),
    el('p', {}, "Ta réussite est enregistrée sur le serveur de correction, mais ton attestation n'a pas pu être chargée."),
    el('p', { class: 'server-message', role: 'status' }, message),
    el('div', { class: 'form-actions' }, el('button', { class: 'button', type: 'button', onclick: actions.onRetry }, 'Réessayer')),
  ]));
  showScreen(main, screen, {
    title: seance.exercice.titre,
    aside: [el('span', {}, studentLine(seance)), el('button', { class: 'button-link', type: 'button', onclick: actions.onQuit }, 'Quitter')],
  });
}
