// Attestation de réussite (UI §3.6) : la sortie du parcours étudiant, ouverte par « Voir mon
// attestation » depuis l'écran « Exercice réussi ». Une page lettre claire, identique à l'écran et à
// l'impression ; l'étudiant l'enregistre en PDF et la remet sur Léa (D16).
//
// PROVISOIRE (D29) : la signature du serveur et son code QR viennent en tête du jalon 5
// (`GET /api/rapport`). D'ici là, la page le dit en toutes lettres et ne vaut pas preuve : tout ce
// qu'elle montre vient de la séance renvoyée par le serveur, mais rien ne permet encore de le vérifier.
// Ce qu'elle montre est décidé par text.js (pur, testé) ; ici, on ne fait que construire le DOM.

import { el, showScreen } from './dom.js';
import { DEPARTMENT_LINES, DEPARTMENT_SHORT, attestationFileName, attestationLines, studentLine } from './text.js';

//   seance   : l'état renvoyé par le serveur, exercice réussi
//   exercise : l'exercice (pour ses champs évalués)
//   actions  : { onBack } — retour à l'écran « Exercice réussi »
export function renderAttestation(main, { seance, exercise }, actions) {
  const page = el('article', { class: 'print-page attestation' }, [
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
    el('p', { class: 'attestation-notice' }, [
      el('strong', {}, 'Attestation provisoire, non signée. '),
      "Ta réussite est enregistrée sur le serveur de correction. La version signée par le serveur, avec son code QR de vérification, n'est pas encore offerte : cette page ne vaut pas preuve de réussite.",
    ]),
    el('footer', { class: 'sheet-footer' }, [el('span', {}, new Date().toISOString().slice(0, 10)), el('span', {}, `${DEPARTMENT_SHORT} — profil fabrication`), el('span', {}, 'Page 1 de 1')]),
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
