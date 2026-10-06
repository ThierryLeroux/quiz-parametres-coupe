// L'accueil unique et la page de description d'un exercice (UI §3.1, décisions D71, D91 et D92).
//   renderHomeList : l'accueil (/, sans ?exercice=) — une carte par cours, une rangée par exercice publié avec son
//                    bouton Démo (le mode démo de l'exercice, D92), et la seule porte professeur ; avec l'avis de D18
//                    quand l'adresse nomme un exercice qui n'existe pas
//   renderHome     : la page d'un exercice (?exercice=<id>, le lien diffusé sur Léa) — un seul bouton pour commencer
//                    (« Reprendre, <prénom> » si ce navigateur garde un jeton de cet exercice, « Commencer ou
//                    reprendre » sinon), puis ce que l'exercice demande : questions, outils, matériaux
// Ce qu'on montre est décidé par home-data.js et text.js (purs, testés) : ici, on construit le DOM.

import { el, showScreen } from './dom.js';
import { DEMO_NOTE } from './demo-data.js';
import { exerciseLink, homeCards, materialGroups, questionLines, streakText, toolRows } from './home-data.js';
import { DEPARTMENT_SHORT, HOME_LINK_LABEL, exerciseMeta, exerciseSummary } from './text.js';

const TITLE = 'Quiz — paramètres de coupe';

// L'en-tête de l'accueil (D91) : le sur-titre, le titre, les trois étapes du parcours.
export const HOME_EYEBROW = 'Exercices · paramètres de coupe';
export const HOME_TITLE = 'Quel exercice fais-tu ?';
export const HOME_STEPS = ['Ton cours', "L'exercice indiqué sur Léa", 'Ton matricule et ton NIP'];
// La porte professeur, compacte : la note sur le mode démo (DEMO_NOTE, demo-data.js) et le bouton au contour.
export { DEMO_NOTE };
export const TEACHER_LINK_LABEL = 'Espace professeur →';
export const NO_EXERCISE_NOTICE = "Aucun exercice n'est offert pour l'instant.";
export const unknownExerciseNotice = (id) => `L'exercice « ${id} » n'existe pas — vérifie le lien sur Léa.`;

// Image décorative qui disparaît si elle manque (outil ou opération sans image) ; son cadre blanc, vide, s'efface aussi.
function optionalImage(src, className) {
  const image = el('img', { class: className, src, alt: '', onerror: () => image.remove() });
  return image;
}

// « Copier le lien » (D71) : le lien de l'exercice dans le presse-papiers, sans connexion ; si le navigateur refuse,
// le lien s'affiche, sélectionné, à copier à la main.
function copyLinkButton(link) {
  const note = el('div', { class: 'copy-link-note', 'aria-live': 'polite' });
  const button = el('button', { class: 'button-outline', type: 'button' }, 'Copier le lien');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      button.textContent = 'Lien copié';
      note.replaceChildren();
      setTimeout(() => { button.textContent = 'Copier le lien'; }, 2500);
    } catch {
      const field = el('input', { type: 'text', class: 'copy-link-field mono', readonly: true, value: link, 'aria-label': "Lien de l'exercice", onfocus: (event) => event.target.select() });
      note.replaceChildren(el('span', { class: 'muted smaller' }, 'Copie ce lien :'), field);
      field.focus();
    }
  });
  return { button, note };
}

// Page d'un exercice.
//   exercise : l'exercice (sa dernière version publiée) ; data : son catalogue (assembleData)
//   local    : { matricule, prenom, jeton } gardé par ce navigateur POUR CET EXERCICE (sessionFor), ou null
//   archived : l'exercice n'est plus offert (D47) — une séance existante se reprend encore, aucune ne se crée
//   actions  : { onResume, onStart, onForget }
//     onResume : async — demande la séance au serveur ; retourne le message à afficher si ça
//                échoue, ou null si un autre écran a pris la place
//     onStart  : ouvre l'écran Identification
//     onForget : « Changer d'étudiant » — oublie le jeton local
export function renderHome(main, { exercise, data, local, archived = false }, actions) {
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
  const copy = copyLinkButton(exerciseLink(location.origin, exercise.id));

  // Ce que l'exercice demande (D71) : pour que l'étudiant vérifie qu'il est dans le bon exercice, et que le
  // professeur choisisse celui à donner.
  const tools = toolRows(exercise, data);
  const materials = materialGroups(exercise, data);
  const description = [
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, "Ce que demande l'exercice"),
      el('h2', { class: 'description-title' }, 'Questions posées pour chaque outil'),
      el('ul', { class: 'description-questions small' }, questionLines(exercise).map((line) => el('li', {}, line))),
      el('h2', { class: 'description-title' }, `Outils questionnés (${tools.length})`),
      el('ul', { class: 'description-tools' }, tools.map((row) => el('li', { class: 'description-tool' }, [
        el('div', { class: 'description-photo' }, optionalImage(row.photo, 'description-photo-image')),
        el('div', { class: 'description-tool-text' }, [
          el('strong', {}, row.label),
          el('div', { class: 'muted small' }, row.range),
          el('div', { class: 'small description-operation' }, [optionalImage(row.picto, 'description-picto'), `Opération : ${row.operation}`]),
          el('div', { class: 'muted smaller' }, `Matière d'outil : ${row.materials.join(', ')}`),
        ]),
        el('div', { class: 'description-streak small' }, streakText(row.streak)),
      ]))),
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, 'Matériaux usinés possibles'),
      el('ul', { class: 'description-materials small' }, materials.map(({ code, name, groups }) => el('li', {}, [
        el('span', { class: 'iso-chip', 'aria-hidden': 'true', style: `background: var(--iso-${code.toLowerCase()}); color: var(--iso-${code.toLowerCase()}-text)` }, code),
        el('span', {}, [el('strong', {}, name ? `${code} — ${name} : ` : `${code} : `), groups.join(', ')]),
      ]))),
    ]),
  ];

  const screen = el('div', { class: 'screen' }, [
    // Retour à l'accueil (D71) : une simple navigation — aucune séance n'est créée, modifiée ni effacée, ni ici ni sur le serveur.
    el('div', { class: 'description-nav' }, [el('a', { class: 'button-link', href: location.pathname }, HOME_LINK_LABEL), copy.button]),
    copy.note,
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, exercise.cours ? `${exercise.cours} · exercice` : 'Exercice'),
      el('h1', { class: 'home-title', tabindex: '-1' }, exercise.titre),
      el('p', { class: 'muted small' }, exerciseMeta(exercise)),
      el('p', { class: 'home-summary' }, exerciseSummary(exercise).join(' ')),
      el('p', { class: 'muted smaller' }, "Vérifie que ce titre est bien celui de l'exercice indiqué sur Léa."),
      archived ? el('p', { class: 'small home-archived' }, "Cet exercice n'est plus offert par ton enseignant : aucune nouvelle séance ne peut être commencée, mais une séance déjà commencée se reprend encore.") : '',
    ]),
    el('div', { class: 'home-start' }, start),
    status,
    ...description,
  ]);

  showScreen(main, screen, { title: TITLE, aside: DEPARTMENT_SHORT });
}

// Le pictogramme de projecteur du bouton « Démo » : un SVG en ligne, construit par le DOM (jamais innerHTML), décoratif.
function projectorIcon() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  for (const [name, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(name, value);
  const screen = document.createElementNS(NS, 'rect');
  for (const [name, value] of Object.entries({ x: '3', y: '4', width: '18', height: '12', rx: '1' })) screen.setAttribute(name, value);
  const stand = document.createElementNS(NS, 'path');
  stand.setAttribute('d', 'M12 16v4M8 20h8M10 8.5v4l3.5-2z');
  svg.append(screen, stand);
  return svg;
}

// Une rangée d'exercice (D91) : le lien couvre toute la rangée — le titre, la flèche, puis « À trouver » et une pastille
// par grandeur évaluée, et le nombre d'outils ; son nom accessible dit tout cela en toutes lettres (row.name). Le bouton
// « Démo », à droite, est un lien à part vers le mode démo de l'exercice (D92) : jamais de lien dans un lien.
//   row : une rangée de homeCards
function exerciseRow(row) {
  const facts = row.fields.length === 0 && row.tools === null ? '' : el('span', { class: 'ex-facts' }, [
    row.fields.length === 0 ? '' : el('span', { class: 'ex-label' }, 'À trouver'),
    ...row.fields.map((field) => el('span', { class: 'qty', title: field.name }, field.symbol)),
    // « · 13 outils » d'un seul tenant : s'il passe à la ligne, le point médian le suit.
    row.tools === null ? '' : el('span', { class: 'ex-tools' }, [row.fields.length > 0 ? el('span', { class: 'ex-sep' }, '·') : '', row.tools]),
  ]);
  return el('li', { class: 'ex-row' }, [
    el('a', { class: 'ex-main', href: row.href, 'aria-label': row.name }, [
      el('span', { class: 'ex-title' }, row.title),
      el('span', { class: 'ex-go', 'aria-hidden': 'true' }, '›'),
      facts,
    ]),
    el('a', { class: 'ex-demo', href: row.demo.href, 'aria-label': row.demo.name, title: row.demo.hint }, [projectorIcon(), 'Démo']),
  ]);
}

// Une carte de cours (D91) : le panneau biseauté, l'en-tête en h2 (le sigle encadré, le nom), le nombre d'exercices à
// droite, puis une rangée par exercice. L'ancre de la carte est stable (courseAnchor) : les raccourcis y mènent.
//   card : une carte de homeCards
function courseCard(card) {
  return el('section', { class: 'panel course-card', id: card.id, 'aria-labelledby': `${card.id}-titre` }, [
    el('div', { class: 'course-head' }, [
      el('h2', { class: 'course-title', id: `${card.id}-titre` }, [
        card.code === null ? '' : el('span', { class: 'course-code' }, card.code),
        card.name === null ? '' : el('span', { class: 'course-name' }, card.name),
      ]),
      el('span', { class: 'course-count' }, card.count),
    ]),
    el('ul', { class: 'ex-rows' }, card.rows.map(exerciseRow)),
  ]);
}

// L'accueil unique (D71, D91) : les exercices offerts — publiés, non archivés, proposés à l'accueil —, une carte par
// cours, chaque rangée avec son bouton Démo (D92), et la seule porte professeur. Aussi quand l'adresse nomme un exercice
// qui n'existe pas (D18). L'en-tête est posé sur le fond, sans panneau ; les avis, eux, sont dans un panneau, sous le titre.
//   listed    : [{ id, titre, cours, nombre_outils, champs_evalues }, …] (GET /api/exercices)
//   unknownId : ce que l'adresse demandait et qui n'existe pas, ou null si elle ne demandait rien
export function renderHomeList(main, listed, unknownId) {
  const cards = homeCards(listed);
  const notices = [
    ...(unknownId === null ? [] : [unknownExerciseNotice(unknownId)]),
    ...(cards.length === 0 ? [NO_EXERCISE_NOTICE] : []),
  ];
  const screen = el('div', { class: 'screen screen--home' }, [
    el('section', { class: 'home-hero' }, [
      el('div', { class: 'eyebrow' }, HOME_EYEBROW),
      el('h1', { tabindex: '-1' }, HOME_TITLE),
      notices.length === 0 ? '' : el('section', { class: 'panel home-notice' }, notices.map((text) => el('p', { class: 'small' }, text))),
      el('ol', { class: 'home-steps' }, HOME_STEPS.map((step, i) => el('li', {}, [el('span', { class: 'home-step-number', 'aria-hidden': 'true' }, String(i + 1)), step]))),
      // Les raccourcis vers les cartes, utiles quand elles se suivent sur une colonne (téléphone) : la feuille de style
      // les cache à partir de 900 px, où toutes les cartes se voient d'un coup d'œil. Une seule carte : rien à sauter.
      cards.length < 2 ? '' : el('nav', { class: 'course-jump', 'aria-label': 'Aller à un cours' }, cards.map((card) => el('a', { href: `#${card.id}` }, card.title ?? card.name))),
    ]),
    el('div', { class: 'course-grid' }, cards.map(courseCard)),
    // Une seule porte professeur (D71) : la clé saisie décide de ce qu'on voit (D44) — la connexion de /prof le dit.
    el('section', { class: 'panel home-teacher' }, [
      el('div', { class: 'eyebrow' }, 'Enseignants'),
      el('p', { class: 'small muted' }, DEMO_NOTE),
      el('a', { class: 'button-outline', href: '/prof' }, TEACHER_LINK_LABEL),
    ]),
  ]);
  showScreen(main, screen, { title: TITLE, aside: DEPARTMENT_SHORT });
}

// Le quiz n'a pas pu démarrer : catalogue ou exercice illisible ou invalide. Sous le message, le retour à l'accueil (D87) :
// la même navigation que celui de la page de l'exercice.
export function renderLoadError(main, error) {
  const screen = el('div', { class: 'screen' }, el('section', { class: 'panel panel--wrong' }, [
    el('div', { class: 'eyebrow' }, 'Erreur'),
    el('h1', { tabindex: '-1' }, "Le quiz n'a pas pu démarrer"),
    el('p', { class: 'small' }, 'Recharge la page. Si le problème persiste, montre ce message à ton enseignant :'),
    el('pre', { class: 'error-detail muted smaller' }, error.message),
    el('div', { class: 'form-links' }, el('a', { class: 'button-link', href: location.pathname }, HOME_LINK_LABEL)),
  ]));
  showScreen(main, screen, { title: TITLE });
}
