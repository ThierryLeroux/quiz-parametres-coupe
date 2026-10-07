// Les écrans du mode démo (décision D92 ; UI §3.10) : le choix de l'outil, le bandeau discret mais constant, et le
// spécimen d'attestation. L'écran Question lui-même est celui du vrai exercice (question-screen.js, en mode démo).
// Ce qu'on montre est décidé par demo-data.js (pur, testé) : ici, on construit le DOM.

import { el, showScreen } from './dom.js';
import { attestationFileName } from './attestation-data.js';
import { attestationPages } from './attestation-screen.js';
import { CHOOSER, DEMO_BANNER, SPECIMEN, chosenToolLabel, demoTitle } from './demo-data.js';
import { exerciseHref } from './home-data.js';
import { DEPARTMENT_SHORT, HOME_LINK_LABEL } from './text.js';

// Image décorative qui disparaît si elle manque (opération sans pictogramme).
function optionalImage(src, className) {
  const image = el('img', { class: className, src, alt: '', onerror: () => image.remove() });
  return image;
}

// Le retour à l'accueil d'une démo : la même rangée que la page de description d'un exercice (home-screen.js, D71) —
// « ← Tous les exercices », à gauche, au-dessus du bandeau du choix de l'outil, de la question et du corrigé. Une
// simple navigation : quitter une démo ne fait rien perdre, rien à confirmer. Le spécimen garde « ← Retour à la démo ».
export function demoHomeNav() {
  return el('div', { class: 'description-nav' }, el('a', { class: 'button-link', href: location.pathname }, HOME_LINK_LABEL));
}

// Le bandeau de la démo (D92, point 8 ; D93) : « Démo — rien n'est enregistré. », le lien vers le vrai exercice et le
// bouton du spécimen. Le même au-dessus de la question, du corrigé et du choix de l'outil.
//   exerciseId : l'exercice ; actions : { onSpecimen }
export function demoBanner(exerciseId, actions) {
  return el('div', { class: 'banner banner--demo', role: 'note' }, [
    el('p', {}, [el('strong', {}, DEMO_BANNER.label), ` — ${DEMO_BANNER.text}`]),
    el('div', { class: 'banner-demo-actions' }, [
      el('a', { class: 'button-link', href: exerciseHref(exerciseId) }, DEMO_BANNER.exercise),
      el('button', { class: 'button-outline', type: 'button', onclick: actions.onSpecimen }, DEMO_BANNER.specimen),
    ]),
  ]);
}

// Le choix de l'outil (D92, point 6) : « Au hasard », puis les outils de l'exercice regroupés par opération — le
// pictogramme et le nom de l'opération, un bouton par outil (son nom, sa plage de dimensions). En cours de démo
// (« Changer d'outil »), l'outil en vigueur est marqué et un lien ramène à la question.
//   exercise : l'exercice (titre, cours) ; groups : demoToolGroups ; chosen : l'outil en vigueur, ou null
//   notice   : un message sous le titre (« La démo a expiré… »), ou '' ; inSession : la démo est commencée
//   actions  : { onChoose(toolId | null) : async — commence la démo ou change d'outil ; retourne le message à afficher si
//               le serveur refuse, ou null si un autre écran a pris la place ; onSpecimen ; onBack (inSession seulement) }
export function renderDemoChooser(main, { exercise, groups, chosen = null, notice = '', inSession = false }, actions) {
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  const buttons = [];
  async function choose(event, toolId) {
    const button = event.currentTarget;
    buttons.forEach((b) => { b.disabled = true; });
    status.textContent = '';
    const message = await actions.onChoose(toolId);
    if (message === null) return;
    status.textContent = message;
    buttons.forEach((b) => { b.disabled = false; });
    button.focus();
  }
  const toolButton = (tool) => {
    const button = el('button', {
      class: tool.id === chosen ? 'demo-tool demo-tool--current' : 'demo-tool',
      type: 'button',
      'aria-pressed': tool.id === chosen ? 'true' : 'false',
      onclick: (event) => choose(event, tool.id),
    }, [el('span', { class: 'demo-tool-name' }, tool.label), el('span', { class: 'demo-tool-range muted smaller' }, tool.range)]);
    buttons.push(button);
    return el('li', {}, button);
  };
  const random = el('button', { class: chosen === null ? 'button demo-random' : 'button-outline demo-random', type: 'button', 'aria-pressed': chosen === null ? 'true' : 'false', onclick: (event) => choose(event, null) }, CHOOSER.random);
  buttons.push(random);

  const screen = el('div', { class: 'screen demo-chooser' }, [
    demoHomeNav(),
    demoBanner(exercise.id, actions),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, exercise.cours ? `${CHOOSER.eyebrow} · ${exercise.cours}` : CHOOSER.eyebrow),
      el('h1', { tabindex: '-1' }, CHOOSER.title),
      el('p', { class: 'muted small' }, CHOOSER.intro),
      inSession ? el('p', { class: 'small' }, `Outil en cours : ${chosenToolLabel(chosen, groups)}.`) : '',
      el('div', { class: 'demo-random-row' }, [random, el('span', { class: 'muted smaller' }, CHOOSER.randomNote)]),
      ...groups.map((group) => el('section', { class: 'demo-group' }, [
        el('h2', { class: 'demo-group-title' }, [optionalImage(group.picto, 'operation-picto'), group.operation]),
        el('ul', { class: 'demo-tools' }, group.tools.map(toolButton)),
      ])),
      status,
      inSession ? el('div', { class: 'form-links' }, el('button', { class: 'button-link', type: 'button', onclick: actions.onBack }, CHOOSER.back)) : '',
    ]),
  ]);
  showScreen(main, screen, { title: demoTitle(exercise.titre), aside: DEPARTMENT_SHORT });
}

// Le spécimen d'attestation (D92, point 9) : la même page lettre qu'une vraie attestation, avec le filigrane
// « SPÉCIMEN » sur chaque page ; au-dessus, la consigne, « Enregistrer en PDF » et le retour à la démo.
//   exercise : l'exercice ; specimen : ce que rend GET /api/demo/specimen ; actions : { onBack }
export function renderSpecimen(main, { exercise, specimen }, actions) {
  const fileName = attestationFileName(specimen.attestation); // « Specimen-attestation-<exercice> », comme au pied de page
  const print = () => {
    const title = document.title; // le navigateur propose le titre de la page comme nom de fichier PDF
    document.title = fileName;
    const restore = () => { document.title = title; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
  };
  const screen = el('div', { class: 'screen screen--document' }, [
    el('div', { class: 'attestation-bar no-print' }, [
      el('div', {}, [el('strong', {}, SPECIMEN.lead), ' ', SPECIMEN.text]),
      el('div', { class: 'attestation-bar-actions' }, [
        el('button', { class: 'button button--gold', type: 'button', onclick: print }, SPECIMEN.print),
        el('button', { class: 'button-link', type: 'button', onclick: actions.onBack }, SPECIMEN.back),
      ]),
    ]),
    el('div', { class: 'print-stage attestation-stage' }, attestationPages(specimen, location.host, { specimen: true })),
  ]);
  showScreen(main, screen, {
    title: `${SPECIMEN.title} — ${exercise.titre}`,
    aside: el('button', { class: 'button-link', type: 'button', onclick: actions.onBack }, SPECIMEN.back),
  }, '.attestation-title');
}
