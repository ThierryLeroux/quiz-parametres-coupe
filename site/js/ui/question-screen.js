// Écran Question (UI §3.3) — GABARIT VIDE pour l'instant : il ne s'affichera que lorsque le
// serveur de correction répondra à /api/question (jalon 3). L'outil, le matériau, le questionnaire
// et la progression viendront ici au jalon 4, à partir de la réponse du serveur.

import { el, showScreen } from './dom.js';

//   local   : { matricule, prenom, jeton } (session.js)
//   actions : { onQuit }
export function renderQuestion(main, { exercise, local }, actions) {
  const screen = el('div', { class: 'screen' }, el('section', { class: 'panel' }, [
    el('div', { class: 'eyebrow' }, 'Question'),
    el('h1', { tabindex: '-1' }, exercise.titre),
    el('p', { class: 'muted small' }, 'Cet écran est un gabarit : le questionnaire, les tables de référence et le rapport arrivent aux prochaines étapes.'),
  ]));

  showScreen(main, screen, {
    title: exercise.titre,
    aside: [el('span', {}, `${local.prenom} · ${local.matricule}`), el('button', { class: 'button-link', type: 'button', onclick: actions.onQuit }, 'Quitter')],
  });
}
