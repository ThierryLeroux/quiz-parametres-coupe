// Écran Question (UI §3.3) — GABARIT VIDE pour l'instant : il prouve que la séance démarre, se
// sauvegarde et se reprend. L'outil, le matériau, le questionnaire et la progression viendront ici.

import { el, showScreen } from './dom.js';
import { studentLine } from './text.js';

//   state   : état de la séance (session.js)
//   saved   : false si la séance n'a pas pu être sauvegardée dans ce navigateur
//   actions : { onQuit }
export function renderQuestion(main, { exercise, state, saved }, actions) {
  const done = state.question === null; // plus de question : l'exercice est complété
  const screen = el('div', { class: 'screen' }, el('section', { class: 'panel' }, [
    el('div', { class: 'eyebrow' }, done ? 'Exercice réussi' : 'Question'),
    el('h1', { tabindex: '-1' }, done ? 'Rapport de réussite' : state.question.displayId),
    el('p', { class: 'muted small' }, "Cet écran est un gabarit : le questionnaire, les tables de référence et le rapport arrivent aux prochaines étapes."),
    saved ? '' : el('p', { class: 'small' }, "Attention : ce navigateur refuse de conserver la séance. Si la page est fermée ou rechargée, il faudra recommencer."),
  ]));

  showScreen(main, screen, {
    title: exercise.titre,
    aside: [el('span', {}, studentLine(state)), el('button', { class: 'button-link', type: 'button', onclick: actions.onQuit }, 'Quitter')],
  });
}
