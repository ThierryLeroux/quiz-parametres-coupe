// Écran Accueil (UI §3.1) : l'exercice demandé, et un seul bouton — « Reprendre, <prénom> » si ce
// navigateur garde un jeton de séance, « Commencer ou reprendre » sinon.
// Et, quand l'adresse ne nomme aucun exercice de l'index, la liste des exercices offerts.

import { el, showScreen } from './dom.js';
import { exerciseMeta, exerciseSummary } from './text.js';

// Accueil d'un exercice.
//   local   : { matricule, prenom, jeton } gardé par ce navigateur (loadSession), ou null
//   actions : { onResume, onStart, onForget }
//     onResume : async — demande la séance au serveur ; retourne le message à afficher si ça
//                échoue, ou null si un autre écran a pris la place
//     onStart  : ouvre l'écran Identification
//     onForget : « Changer d'étudiant » — oublie le jeton local
export function renderHome(main, { exercise, local }, actions) {
  const status = el('div', { class: 'server-message', role: 'status' });

  async function resume(event) {
    const button = event.currentTarget;
    button.disabled = true;
    status.textContent = '';
    const message = await actions.onResume();
    if (message === null) return;
    status.textContent = message;
    button.disabled = false;
  }

  const start = local === null
    ? [el('button', { class: 'button', type: 'button', onclick: actions.onStart }, 'Commencer ou reprendre')]
    : [
      el('button', { class: 'button', type: 'button', onclick: resume }, `Reprendre, ${local.prenom}`),
      el('button', { class: 'button-link', type: 'button', onclick: actions.onForget }, "Ce n'est pas toi ? Changer d'étudiant"),
    ];

  const screen = el('div', { class: 'screen' }, [
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, 'Exercice demandé par ton enseignant'),
      el('h1', { class: 'home-title', tabindex: '-1' }, exercise.titre),
      el('p', { class: 'muted small' }, exerciseMeta(exercise)),
      el('p', { class: 'home-summary' }, exerciseSummary(exercise).join(' ')),
      // Aucun moyen de changer d'exercice depuis la page (D11) : seulement la consigne de vérifier.
      el('p', { class: 'muted smaller' }, "Vérifie que le titre ci-dessus est bien l'exercice indiqué sur Léa. Il n'est pas possible d'en changer depuis cette page."),
    ]),
    el('div', { class: 'home-start' }, start),
    status,
  ]);

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
