// L'accueil unique et la page de description d'un exercice (UI §3.1, décision D71).
//   renderHomeList : l'accueil (/, sans ?exercice=) — les exercices publiés, regroupés par cours, et la seule porte
//                    professeur ; avec l'avis de D18 quand l'adresse nomme un exercice qui n'existe pas
//   renderHome     : la page d'un exercice (?exercice=<id>, le lien diffusé sur Léa) — un seul bouton pour commencer
//                    (« Reprendre, <prénom> » si ce navigateur garde un jeton de cet exercice, « Commencer ou
//                    reprendre » sinon), puis ce que l'exercice demande : questions, outils, matériaux
// Ce qu'on montre est décidé par home-data.js et text.js (purs, testés) : ici, on construit le DOM.

import { el, showScreen } from './dom.js';
import { exerciseLink, homeGroups, materialGroups, questionLines, streakText, toolRows } from './home-data.js';
import { DEPARTMENT_SHORT, HOME_LINK_LABEL, exerciseMeta, exerciseSummary, listedExerciseMeta } from './text.js';

const TITLE = 'Quiz — paramètres de coupe';

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

// L'accueil unique (D71) : les exercices offerts, par cours — publiés, non archivés, proposés à l'accueil — et la seule
// porte professeur. Aussi quand l'adresse nomme un exercice qui n'existe pas (D18).
//   listed    : [{ id, titre, cours, nombre_outils, champs_evalues }, …] (GET /api/exercices)
//   unknownId : ce que l'adresse demandait et qui n'existe pas, ou null si elle ne demandait rien
export function renderHomeList(main, listed, unknownId) {
  const groups = homeGroups(listed);
  const screen = el('div', { class: 'screen' }, [
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, 'Exercices'),
      el('h1', { tabindex: '-1' }, 'Quel exercice fais-tu ?'),
      unknownId === null ? '' : el('p', { class: 'small' }, `L'exercice « ${unknownId} » n'existe pas — vérifie le lien sur Léa.`),
      el('p', { class: 'muted small' }, "Choisis l'exercice indiqué sur Léa par ton enseignant ; sa page dit ce qu'il demande avant que tu commences."),
      groups.length === 0 ? el('p', { class: 'small' }, "Aucun exercice n'est offert pour l'instant.") : '',
      ...groups.map(({ title, exercises }) => el('section', { class: 'home-group' }, [
        title === null ? '' : el('h2', { class: 'home-course' }, title),
        el('ul', { class: 'exercise-list' }, exercises.map((entry) => el('li', {}, [
          el('a', { href: `?exercice=${encodeURIComponent(entry.id)}` }, entry.titre),
          Number.isInteger(entry.nombre_outils) && Array.isArray(entry.champs_evalues) ? el('div', { class: 'muted smaller' }, listedExerciseMeta(entry)) : '',
        ]))),
      ])),
    ]),
    // Une seule porte professeur (D71) : la clé saisie décide de ce qu'on voit (D44).
    el('section', { class: 'panel home-teacher' }, [
      el('div', { class: 'eyebrow' }, 'Enseignants'),
      el('p', { class: 'small' }, [
        el('a', { href: '/prof' }, 'Espace professeur'),
        " — la clé d'administration ouvre les réussites, les actions et la Gestion du contenu ; la clé de consultation, les réussites en lecture seule.",
      ]),
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
