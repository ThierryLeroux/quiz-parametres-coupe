// Attestation de réussite (UI §3.6) : la sortie du parcours étudiant, ouverte par « Voir mon
// attestation » depuis l'écran « Exercice réussi ». Une page lettre claire, identique à l'écran et à
// l'impression ; l'étudiant l'enregistre en PDF et la remet sur Léa (D16).
//
// PROVISOIRE (D29, D30) : la signature du serveur et son code QR viennent en tête du jalon 5
// (`GET /api/rapport`). D'ici là, une bannière bien visible, à l'écran et à l'impression, dit qu'elle
// ne vaut pas preuve : tout ce qu'elle montre vient de la séance renvoyée par le serveur, mais rien
// ne permet encore de le vérifier. La liste des opérations effectuées vient aussi de la séance (D30).
// Ce qu'elle montre est décidé par text.js (pur, testé) ; ici, on ne fait que construire le DOM.

import { el, showScreen } from './dom.js';
import { DEPARTMENT_LINES, attestationFileName, attestationLines, attestationTools, localDate, sheetSignature, studentLine } from './text.js';

//   seance   : l'état renvoyé par le serveur, exercice réussi
//   exercise : l'exercice (pour ses champs évalués)
//   actions  : { onBack } — retour à l'écran « Exercice réussi »
export function renderAttestation(main, { seance, exercise }, actions) {
  const page = el('article', { class: 'print-page attestation' }, [
    // Jusqu'au jalon 5 : la bannière est dans la page, donc imprimée aussi.
    el('div', { class: 'attestation-stamp', role: 'note' }, 'PROVISOIRE — non signée, ne vaut pas preuve de réussite'),
    el('header', { class: 'sheet-header' }, [
      el('img', { class: 'sheet-logo', src: 'img/logo-cvm.png', alt: 'Cégep du Vieux Montréal' }),
      el('div', { class: 'sheet-title' }, [el('h1', { tabindex: '-1' }, 'Attestation de réussite'), el('small', {}, "calcul de paramètres d'usinage")]),
      el('div', { class: 'sheet-program' }, DEPARTMENT_LINES.map((line) => el('div', {}, line))),
    ]),
    el('div', { class: 'attestation-body' }, [
      el('dl', { class: 'attestation-info' }, attestationLines(seance, exercise).flatMap(([label, value]) => [el('dt', {}, label), el('dd', {}, value)])),
      // L'emplacement du code QR de vérification, à droite du bloc d'informations (UI §3.6).
      el('div', { class: 'attestation-qr' }, ['Code QR de vérification', el('br'), 'à venir']),
    ]),
    el('table', { class: 'attestation-tools' }, [
      el('caption', {}, 'Opérations effectuées'),
      el('thead', {}, el('tr', {}, [el('th', {}, 'Outil'), el('th', {}, 'Opération'), el('th', {}, 'Réussites')])),
      el('tbody', {}, attestationTools(seance).map((row) => el('tr', {}, [el('td', {}, row.outil), el('td', {}, row.operation), el('td', {}, row.reussites)]))),
    ]),
    el('p', { class: 'attestation-notice' }, [
      el('strong', {}, 'Attestation provisoire, non signée. '),
      "Ta réussite est enregistrée sur le serveur de correction. La version signée par le serveur, avec son code QR de vérification, n'est pas encore offerte : cette page ne vaut pas preuve de réussite.",
    ]),
    el('footer', { class: 'sheet-footer' }, [el('span', {}, localDate()), el('span', {}, sheetSignature()), el('span', {}, 'Page 1 de 1')]),
  ]);

  const screen = el('div', { class: 'attestation-screen' }, [
    el('div', { class: 'attestation-bar no-print' }, [
      el('p', { class: 'muted small' }, 'Enregistre le PDF, puis remets-le sur Léa.'),
      el('button', { class: 'button button--gold', type: 'button', onclick: () => window.print() }, 'Enregistrer en PDF'),
      el('button', { class: 'button-link', type: 'button', onclick: actions.onBack }, '← Retour'),
    ]),
    el('div', { class: 'print-stage' }, page),
  ]);

  showScreen(main, screen, { title: seance.exercice.titre, aside: el('span', {}, studentLine(seance)) });
  // Le navigateur propose le titre de l'onglet comme nom du fichier PDF.
  document.title = attestationFileName(seance);
}
