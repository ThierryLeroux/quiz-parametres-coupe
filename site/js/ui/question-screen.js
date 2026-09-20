// Écran Question (UI §3.3, §3.4) — FONCTIONNEL, mais sans la présentation de UI §3.3 (jalon 4) :
// l'outil, le matériau, les cinq champs, « Vérifier », le résultat champ par champ, la progression.
// Tout ce qui est affiché vient du serveur (SPEC §7) ; les textes sont composés par text.js.
// Et l'écran minimal « Exercice réussi » ; le rapport viendra au jalon 5.

import { el, showScreen } from './dom.js';
import { FIELD_LABELS, correctionBanner, fieldResultNote, formatDateTime, materialFacts, progressLine, studentLine, toolFacts } from './text.js';

const facts = (pairs) => el('dl', { class: 'facts' }, pairs.flatMap(([label, value]) => [el('dt', {}, label), el('dd', {}, value)]));

function progressPanel(progression) {
  return el('section', { class: 'panel' }, [
    el('div', { class: 'eyebrow' }, `Progression — ${progression.outils_termines} / ${progression.outils.length} outils`),
    el('ul', { class: 'progress-list' }, progression.outils.map((outil) => el('li', { class: outil.reussites >= outil.requises ? 'progress-done' : null }, progressLine(outil)))),
    el('p', { class: 'muted smaller' }, 'Un échec sur un outil remet son compteur à zéro.'),
  ]);
}

const header = (seance, actions) => ({
  title: seance.exercice.titre,
  aside: [el('span', {}, studentLine(seance)), el('button', { class: 'button-link', type: 'button', onclick: actions.onQuit }, 'Quitter')],
});

//   seance  : l'état renvoyé par le serveur, avec seance.question
//   actions : { onCheck(answers), onNext(seance), onQuit }
//     onCheck : async — fait corriger ; retourne { correction, seance }, ou { message } si le serveur
//               refuse (cadence, réseau), ou null si un autre écran a pris la place
//     onNext  : affiche la suite (question suivante ou réussite) à partir de la séance reçue
export function renderQuestion(main, { seance }, actions) {
  const { question } = seance;
  const inputs = {};
  const notes = {};
  const fieldBoxes = {};

  const fields = question.champs.map(({ champ, evalue, texte }) => {
    inputs[champ] = el('input', {
      id: champ,
      name: champ,
      type: 'text',
      inputmode: 'decimal',
      autocomplete: 'off',
      spellcheck: 'false',
      value: texte,
      readonly: !evalue,
      tabindex: evalue ? null : '-1', // Tab saute les champs fournis (UI §7)
      'aria-describedby': `${champ}-note`,
    });
    notes[champ] = el('div', { class: 'field-note', id: `${champ}-note` }, evalue ? '' : "fourni par l'exercice");
    fieldBoxes[champ] = el('div', { class: evalue ? 'field field--number' : 'field field--number field--provided' }, [el('label', { for: champ }, FIELD_LABELS[champ]), inputs[champ], notes[champ]]);
    return fieldBoxes[champ];
  });

  const status = el('div', { class: 'server-message', role: 'status' });
  const checkButton = el('button', { class: 'button', type: 'submit' }, 'Vérifier');
  const actionsRow = el('div', { class: 'form-actions' }, [status, checkButton]);
  const progressSlot = el('div', {}, progressPanel(seance.progression));

  function showCorrection({ correction, seance: next }) {
    for (const champ of correction.champs) {
      inputs[champ.champ].readOnly = true;
      notes[champ.champ].textContent = fieldResultNote(champ);
      if (champ.evalue) fieldBoxes[champ.champ].classList.add(champ.ok ? 'field--correct' : 'field--wrong');
    }
    const requises = seance.progression.outils.find((outil) => outil.id === correction.outil.id)?.requises ?? correction.outil.apres;
    const banner = el('p', { class: correction.reussie ? 'banner banner--correct' : 'banner banner--wrong', role: 'alert' }, correctionBanner(correction, requises));
    const nextButton = el('button', { class: 'button', type: 'button', onclick: () => actions.onNext(next) }, next.reussite_le === null ? 'Question suivante' : 'Voir le résultat');
    actionsRow.replaceChildren(nextButton);
    actionsRow.before(banner);
    progressSlot.replaceChildren(progressPanel(next.progression));
    nextButton.focus();
  }

  async function check(event) {
    event.preventDefault();
    if (checkButton.disabled) return; // un seul clic : le serveur ne corrige une question qu'une fois
    checkButton.disabled = true;
    status.textContent = '';
    const answers = Object.fromEntries(question.champs.filter((champ) => champ.evalue).map(({ champ }) => [champ, inputs[champ].value]));
    const result = await actions.onCheck(answers);
    if (result === null) return;
    if (result.message !== undefined) {
      status.textContent = result.message;
      checkButton.disabled = false;
      return;
    }
    showCorrection(result);
  }

  const screen = el('div', { class: 'screen' }, [
    el('section', { class: 'panel' }, [el('div', { class: 'eyebrow' }, 'Outil'), el('h1', { tabindex: '-1' }, question.identifiant), facts(toolFacts(question))]),
    el('section', { class: 'panel' }, [el('div', { class: 'eyebrow' }, 'Matériau brut'), facts(materialFacts(question))]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, 'Paramètres de coupe'),
      el('form', { novalidate: true, onsubmit: check }, [
        el('div', { class: 'form-grid' }, fields),
        el('p', { class: 'muted smaller' }, 'Point décimal, sans séparateur de milliers : 2496 · 0.005'),
        actionsRow,
      ]),
    ]),
    progressSlot,
  ]);

  const firstGraded = question.champs.find((champ) => champ.evalue);
  showScreen(main, screen, header(seance, actions), firstGraded ? `#${firstGraded.champ}` : 'h1');
}

// Exercice réussi — écran minimal ; le rapport à remettre sur Léa viendra au jalon 5.
//   actions : { onQuit }
export function renderSuccess(main, { seance }, actions) {
  const screen = el('div', { class: 'screen' }, [
    el('section', { class: 'panel panel--correct' }, [
      el('div', { class: 'eyebrow' }, seance.exercice.titre),
      el('h1', { tabindex: '-1' }, 'Exercice réussi'),
      el('p', {}, `${studentLine(seance)} — réussi le ${formatDateTime(seance.reussite_le)}, avec ${seance.progression.total_reussies} questions réussies.`),
      el('p', { class: 'muted small' }, 'Ta réussite est enregistrée sur le serveur de correction. Le rapport à remettre sur Léa sera offert ici prochainement.'),
    ]),
    progressPanel(seance.progression),
  ]);
  showScreen(main, screen, header(seance, actions));
}
