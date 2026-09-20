// Écran Accueil (UI §3.1) : l'exercice demandé, la reprise d'une séance, le départ d'une nouvelle.
// Et, quand l'adresse ne nomme aucun exercice de l'index, la liste des exercices offerts.

import { el, showScreen } from './dom.js';
import { exerciseMeta, exerciseSummary, sessionSummary } from './text.js';

// Accueil d'un exercice.
//   resumable    : séance de cet exercice qu'on peut reprendre (restoreSession), ou null
//   otherSession : true si le navigateur conserve une séance qu'on ne peut PAS reprendre ici
//                  (autre exercice, autre version) — une nouvelle séance l'effacera aussi
//   actions      : { onResume, onNew }
export function renderHome(main, { exercise, resumable, otherSession }, actions) {
  const screen = el('div', { class: 'screen' }, [
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, 'Exercice demandé par ton enseignant'),
      el('h1', { class: 'home-title', tabindex: '-1' }, exercise.titre),
      el('p', { class: 'muted small' }, exerciseMeta(exercise)),
      el('p', { class: 'home-summary' }, exerciseSummary(exercise).join(' ')),
      // Aucun moyen de changer d'exercice depuis la page (D11) : seulement la consigne de vérifier.
      el('p', { class: 'muted smaller' }, "Vérifie que le titre ci-dessus est bien l'exercice indiqué sur Léa. Il n'est pas possible d'en changer depuis cette page."),
    ]),
  ]);

  if (resumable !== null) {
    screen.append(el('section', { class: 'panel panel--gold' }, el('div', { class: 'resume' }, [
      el('div', {}, [
        el('div', { class: 'resume-title' }, 'Séance en cours sur cet appareil'),
        el('div', { class: 'muted smaller' }, sessionSummary(resumable)),
      ]),
      el('button', { class: 'button button--gold', type: 'button', onclick: actions.onResume }, 'Reprendre'),
    ])));
  }

  let warning = '';
  if (resumable !== null) warning = 'Une nouvelle séance efface la séance en cours.';
  else if (otherSession) warning = "Une séance d'un autre exercice est conservée sur cet appareil : une nouvelle séance l'efface.";
  screen.append(el('div', { class: 'new-session' }, [
    el('button', { class: 'button', type: 'button', onclick: actions.onNew }, 'Nouvelle séance'),
    el('div', { class: 'muted smaller' }, warning),
  ]));

  showScreen(main, screen, { title: 'Quiz — paramètres de coupe', aside: 'Techniques de génie mécanique' });
}

// Liste des exercices offerts : seulement quand l'adresse n'a pas de « ?exercice= » valide (D18).
//   index     : [{ id, titre }, …] (loadExerciseIndex)
//   unknownId : ce que l'adresse demandait et qui n'existe pas, ou null si elle ne demandait rien
export function renderExerciseList(main, index, unknownId) {
  const screen = el('div', { class: 'screen' }, el('section', { class: 'panel' }, [
    el('div', { class: 'eyebrow' }, 'Exercices'),
    el('h1', { tabindex: '-1' }, 'Quel exercice fais-tu ?'),
    unknownId === null ? '' : el('p', { class: 'small' }, `L'exercice « ${unknownId} » n'existe pas — vérifie le lien sur Léa.`),
    el('p', { class: 'muted small' }, "Choisis l'exercice indiqué sur Léa par ton enseignant."),
    el('ul', { class: 'exercise-list' }, index.map((entry) => el('li', {}, el('a', { href: `?exercice=${encodeURIComponent(entry.id)}` }, entry.titre)))),
  ]));
  showScreen(main, screen, { title: 'Quiz — paramètres de coupe', aside: 'Techniques de génie mécanique' });
}

// Le quiz n'a pas pu démarrer : catalogue ou exercice illisible ou invalide.
export function renderLoadError(main, error) {
  const screen = el('div', { class: 'screen' }, el('section', { class: 'panel panel--wrong' }, [
    el('div', { class: 'eyebrow' }, 'Erreur'),
    el('h1', { tabindex: '-1' }, "Le quiz n'a pas pu démarrer"),
    el('p', { class: 'small' }, 'Recharge la page. Si le problème persiste, montre ce message à ton enseignant :'),
    el('pre', { class: 'error-detail muted smaller' }, error.message),
  ]));
  showScreen(main, screen, { title: 'Quiz — paramètres de coupe' });
}
