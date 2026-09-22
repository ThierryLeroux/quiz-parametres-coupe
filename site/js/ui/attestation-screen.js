// Page de l'attestation de réussite (UI §3.6 ; décisions D31 à D33) : une page lettre blanche,
// identique à l'écran et à l'impression, avec le QR de vérification. Elle remplace l'écran
// « Exercice réussi » et l'attestation provisoire du jalon 4. Le PDF vient de l'impression du navigateur, pas du serveur.
// Tout vient de l'enregistrement figé rendu par le serveur ; ce qu'on en montre est décidé par
// attestation-data.js (pur, testé) : ici, on ne fait que construire le DOM.

import { el, showScreen } from './dom.js';
import { attestationFacts, attestationFileName, attestationFooter, attestationRows, verificationMention } from './attestation-data.js';
import { qrSvg } from './qr.js';
import { DEPARTMENT_LINES, studentLine } from './text.js';

// Le tableau des opérations effectuées, aussi utilisé par la page de vérification.
export function operationsTable(record) {
  return el('table', { class: 'attestation-table' }, [
    el('thead', {}, el('tr', {}, [el('th', {}, 'Opération'), el('th', {}, 'Outil'), el('th', {}, 'Plage de dimensions'), el('th', { class: 'num' }, 'Réussites de suite')])),
    el('tbody', {}, attestationRows(record).map((row) => el('tr', {}, [el('td', {}, row.operation), el('td', {}, row.outil), el('td', {}, row.plage), el('td', { class: 'num' }, row.reussites)]))),
  ]);
}

// Le bloc d'informations : deux colonnes de « libellé : valeur », aussi utilisé par la vérification.
export function factsGrid(record) {
  return el('div', { class: 'attestation-facts' }, attestationFacts(record).map((fact) => el('div', { class: 'attestation-fact' }, [
    el('span', { class: 'attestation-fact-label' }, fact.label),
    el('span', { class: fact.mono ? 'attestation-fact-value mono' : 'attestation-fact-value' }, fact.value),
  ])));
}

// La page lettre de l'attestation.
//   attestation : { attestation (l'enregistrement), code, url_verification } rendus par GET /api/attestation
//   host        : l'adresse du site, pour la mention de vérification
export function attestationPage({ attestation: record, code, url_verification: url }, host) {
  return el('article', { class: 'print-page attestation' }, [
    el('header', { class: 'attestation-header' }, [
      el('img', { class: 'sheet-logo', src: 'img/logo-cvm.png', alt: 'Cégep du Vieux Montréal' }),
      el('div', { class: 'attestation-department' }, DEPARTMENT_LINES.map((line) => el('div', {}, line))),
    ]),
    el('h1', { class: 'attestation-title', tabindex: '-1' }, "Attestation de réussite — calcul de paramètres d'usinage"),
    el('div', { class: 'attestation-head' }, [
      factsGrid(record),
      el('div', { class: 'attestation-qr' }, [
        qrSvg(url, 160),
        el('div', { class: 'attestation-code' }, code),
      ]),
    ]),
    el('p', { class: 'attestation-mention' }, verificationMention(host, code)),
    el('h2', { class: 'attestation-subtitle' }, 'Opérations effectuées'),
    operationsTable(record),
    el('p', { class: 'attestation-note' }, 'Chaque outil devait être réussi le nombre de fois indiqué, de suite : une mauvaise réponse remettait son compteur à zéro. Les paramètres ont été corrigés par le serveur de correction.'),
    el('footer', { class: 'attestation-footer' }, [
      el('span', {}, `${attestationFileName(record)}.pdf · remis sur Léa par l'étudiant`),
      el('span', {}, attestationFooter(record)),
      el('span', {}, 'Page 1 de 1'),
    ]),
  ]);
}

// L'écran : barre de consigne, puis la page sur son fond gris.
//   seance      : l'état de la séance (pour l'en-tête)
//   attestation : ce que rend GET /api/attestation
//   actions     : { onQuit }
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
      el('div', {}, [el('strong', {}, 'Exercice réussi. '), 'Remettez ce PDF sur Léa.']),
      el('div', { class: 'attestation-bar-actions' }, [printButton, el('button', { class: 'button-link', type: 'button', onclick: actions.onQuit }, 'Terminer')]),
    ]),
    el('div', { class: 'print-stage attestation-stage' }, attestationPage(attestation, location.host)),
  ]);

  showScreen(main, screen, {
    title: 'Exercice réussi — attestation',
    aside: [el('span', {}, studentLine(seance)), el('button', { class: 'button-link', type: 'button', onclick: actions.onQuit }, 'Quitter')],
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
