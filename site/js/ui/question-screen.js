// Écran Question (UI §3.3) et question corrigée (UI §3.4) : panneau de l'outil à la couleur de son
// matériau, panneau du matériau brut à la couleur de sa classe ISO, questionnaire de cinq champs
// avec pictogrammes et aide contextuelle, progression par points. L'exercice réussi ouvre la page
// de l'attestation (attestation-screen.js).
// Tout ce qui est affiché vient du serveur (SPEC §7) ; ce qu'on montre et quand est décidé par
// rules.js et text.js (fonctions pures, testées) : ici, on ne fait que construire le DOM.

import { el, showScreen } from './dom.js';
import { checkButtonLabel, diameterLines, factorLines, feedFamily, foldDoneRows, gapExplanation, helpLine, materialCard, progressRows, remainingWait, testAnswers, toolMaterialColor, toolStreak } from './rules.js';
import { operationPicto } from './sheets-data.js';
import { FIELD_PARTS, correctionBanner, fieldResultNote, studentLine } from './text.js';

// Pictogramme d'une grandeur (UI §5) : le fichier SVG sert de masque, la couleur est celle du texte.
function picto(name) {
  const url = `url(img/pictos/grandeurs/${name}.svg)`;
  return el('span', { class: 'picto', 'aria-hidden': 'true', style: `-webkit-mask-image: ${url}; mask-image: ${url};` });
}

// Image décorative qui disparaît si son fichier manque (outil ou opération ajoutés sans image).
function optionalImage(src, className) {
  const image = el('img', { class: className, src, alt: '', onerror: () => image.remove() });
  return image;
}

const header = (seance, actions) => ({
  title: seance.exercice.titre,
  aside: [
    el('span', {}, studentLine(seance)),
    actions.onTables ? el('button', { class: 'button-outline', type: 'button', onclick: () => actions.onTables('vc') }, 'Tables de référence') : '',
    el('button', { class: 'button-link', type: 'button', onclick: actions.onIdentity }, 'Corriger mon identité'),
    el('button', { class: 'button-link', type: 'button', onclick: actions.onQuit }, 'Quitter'),
  ],
});

// Sur téléphone (la progression est sous le formulaire), les outils terminés sont repliés (UI §3.3).
// La mise en page de question.css passe en deux colonnes à 1000 px.
const isPhone = () => window.matchMedia('(max-width: 999px)').matches;

// Progression (UI §3.3) : barre « n / m outils », puis un rang par outil, un point par réussite consécutive.
function progressPanel(progression, labels, marks) {
  const { outils, outils_termines: done } = progression;
  const tags = { current: 'en cours', reset: 'remis à zéro' };
  const rowItem = (row) => el('li', { class: `progress-row progress-row--${row.state}` }, [
    el('span', { class: 'progress-name' }, [row.label, tags[row.state] ? el('small', {}, ` ${tags[row.state]}`) : '']),
    el('span', { class: 'dots', role: 'img', 'aria-label': `${row.dots.filter(Boolean).length} sur ${row.dots.length}` }, row.dots.map((full) => el('span', { class: full ? 'dot dot--full' : 'dot' }))),
  ]);
  const rows = progressRows(progression, labels, marks);
  const { shown, folded } = isPhone() ? foldDoneRows(rows) : { shown: rows, folded: [] };
  return el('section', { class: 'panel progress' }, [
    el('div', { class: 'panel-head' }, [el('div', { class: 'eyebrow' }, 'Progression'), el('div', { class: 'muted smaller' }, `${done} / ${outils.length} outils`)]),
    el('div', { class: 'progress-bar', role: 'img', 'aria-label': `${done} outils réussis sur ${outils.length}` }, el('div', { style: `width: ${(done / outils.length) * 100}%` })),
    el('ul', { class: 'progress-rows' }, shown.map(rowItem)),
    folded.length === 0 ? '' : el('details', { class: 'progress-done' }, [
      el('summary', {}, `${folded.length} outil${folded.length > 1 ? 's' : ''} terminé${folded.length > 1 ? 's' : ''}`),
      el('ul', { class: 'progress-rows' }, folded.map(rowItem)),
    ]),
    el('p', { class: 'muted smaller' }, 'Un point par réussite de suite. Un échec sur un outil remet ses points à zéro.'),
  ]);
}

// Panneau de l'outil, à la couleur de son matériau (UI §1). Son titre est le gabarit de nom de
// l'outil, résolu par le serveur avec les valeurs tirées (D24).
function toolPanel(question) {
  const { outil } = question;
  return el('section', { class: 'panel tool-card', style: `--panel-color: var(${toolMaterialColor(outil.materiau)})` }, [
    el('div', { class: 'panel-head' }, [el('div', { class: 'eyebrow' }, 'Outil de coupe'), el('div', { class: 'swatch smaller' }, outil.materiau.toLowerCase())]),
    el('div', { class: 'tool-body' }, [
      optionalImage(`img/outils/${outil.image ?? outil.id}.png`, 'tool-photo'),
      el('div', {}, [
        el('h2', { class: 'tool-title' }, question.identifiant),
        el('p', { class: 'tool-operation small' }, [optionalImage(operationPicto(outil.operation), 'operation-picto'), `Opération : ${outil.operation}`]),
        ...diameterLines(question).map((line) => el('p', { class: 'small' }, el('strong', {}, line))),
        el('p', { class: 'small' }, `Nombre de dents : ${outil.dents}`),
        el('p', { class: 'small' }, ['RPM max de la machine : ', el('strong', { class: 'accent' }, `${outil.limite_rpm} rév/min`)]),
        ...factorLines(outil).map((line) => el('p', { class: 'small' }, el('strong', { class: 'accent' }, line))),
        outil.commentaire ? el('p', { class: 'muted small' }, `Note : ${outil.commentaire}`) : '',
      ]),
    ]),
  ]);
}

// Panneau du matériau brut, à la couleur de sa classe ISO (UI §1).
function materialPanel(question) {
  const card = materialCard(question.materiau);
  return el('section', { class: 'panel material-card', style: `--panel-color: var(${card.color}); --badge-text: var(${card.textColor})` }, [
    el('div', { class: 'panel-head' }, [el('div', { class: 'eyebrow' }, 'Matériau brut'), el('div', { class: 'swatch smaller' }, `classe ISO ${card.letter}`)]),
    el('div', { class: 'material-body' }, [
      el('div', { class: 'iso-badge', 'aria-hidden': 'true' }, card.letter),
      el('div', {}, [el('h2', {}, card.title), ...card.lines.map((line) => el('p', { class: 'small' }, line))]),
    ]),
  ]);
}

//   seance  : l'état renvoyé par le serveur, avec seance.question
//   data    : le catalogue (loadData) — pour la famille d'avance de l'opération, dans l'aide
//   labels  : noms à afficher des outils de l'exercice (toolLabels)
//   actions : { onCheck(answers), onNext(seance), onTables(feuille), onIdentity, onQuit }
//     onCheck  : async — fait corriger ; retourne { correction, seance }, ou { message, attendre_s } si le
//                serveur refuse (attendre_s : la cadence, en secondes), ou null si un autre écran a pris la place
//     onNext   : affiche la suite (question suivante ou réussite) à partir de la séance reçue
//     onTables : ouvre les feuilles de référence PAR-DESSUS l'écran : la saisie en cours n'est pas perdue
export function renderQuestion(main, { seance, data, labels }, actions) {
  const { question } = seance;
  const family = feedFamily(data.operationByName.get(question.outil.operation));
  const toolColor = `var(${toolMaterialColor(question.outil.materiau)})`;
  const materialColor = `var(${materialCard(question.materiau).color})`;
  const inputs = {};
  const notes = {};
  const boxes = {};

  // Aide contextuelle, au clic seulement : la méthode, jamais la valeur (rules.js).
  const help = el('div', { class: 'help-line', hidden: true, 'aria-live': 'polite' });
  function showHelp(field) {
    const { parts, table } = helpLine(field, question, family);
    const colors = { tool: toolColor, material: materialColor };
    help.replaceChildren(
      el('p', {}, parts.map((part) => (part.accent ? el('span', { style: `color: ${colors[part.accent]}` }, part.text) : part.text))),
      table ? el('button', { class: 'button-outline', type: 'button', onclick: () => actions.onTables(table) }, 'Ouvrir la table') : '',
    );
    help.hidden = false;
  }

  const fields = question.champs.map(({ champ, evalue, masque, texte }) => {
    const { name, symbol, unit, picto: pictoName } = FIELD_PARTS[champ];
    // Grandeur masquée (D52) : « — », sans valeur ni champ de saisie.
    if (masque) {
      notes[champ] = el('div', { class: 'field-note', id: `${champ}-note` }, 'non demandée');
      boxes[champ] = el('div', { class: 'field field--number field--provided field--masked' }, [
        el('div', { class: 'field-label' }, [picto(pictoName), el('span', {}, [el('span', { class: 'field-name' }, name), el('small', {}, `${symbol} · ${unit}`)])]),
        el('div', { class: 'field-dash', 'aria-describedby': `${champ}-note` }, '—'),
        notes[champ],
      ]);
      return boxes[champ];
    }
    inputs[champ] = el('input', {
      id: champ,
      name: champ,
      type: 'text',
      inputmode: 'decimal', // clavier numérique ; le point et la virgule sont acceptés (D10)
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: evalue ? '?' : null,
      value: texte,
      readonly: !evalue,
      tabindex: evalue ? null : '-1', // Tab saute les champs fournis (UI §7)
      'aria-describedby': `${champ}-note`,
      onfocus: evalue ? () => showHelp(champ) : () => {},
    });
    notes[champ] = el('div', { class: 'field-note', id: `${champ}-note` }, evalue ? '' : "fourni par l'exercice");
    boxes[champ] = el('div', { class: evalue ? 'field field--number' : 'field field--number field--provided' }, [
      el('label', { for: champ, class: 'field-label' }, [picto(pictoName), el('span', {}, [el('span', { class: 'field-name' }, name), el('small', {}, `${symbol} · ${unit}`)])]),
      inputs[champ],
      notes[champ],
    ]);
    return boxes[champ];
  });

  const title = el('h1', { class: 'question-title', tabindex: '-1' }, 'Question');
  const status = el('div', { class: 'server-message', role: 'status' });
  const checkButton = el('button', { class: 'button', type: 'submit' }, 'Vérifier');

  // Cadence (SPEC §7) : le serveur dit combien attendre (seance.attendre_s, ou attendre_s d'un refus) ;
  // le bouton décompte, puis redevient « Vérifier ».
  let countdown = null;
  function waitBefore(seconds) {
    clearInterval(countdown);
    let left = seconds;
    const tick = () => {
      checkButton.textContent = checkButtonLabel(left);
      checkButton.disabled = left > 0;
      if (left <= 0 || !checkButton.isConnected) clearInterval(countdown);
      left -= 1;
    };
    tick();
    if (seconds > 0) countdown = setInterval(tick, 1000);
  }
  waitBefore(seance.attendre_s ?? 0);

  // Mode test (D26) : seulement si le SERVEUR a joint les réponses attendues à la question. Les cases
  // se remplissent d'elles-mêmes et restent modifiables (pour simuler une erreur) ; « Remplir » les remet.
  const expected = testAnswers(question);
  const fill = () => { for (const [champ, texte] of Object.entries(expected)) if (inputs[champ]) inputs[champ].value = texte; };
  const testBanner = expected === null ? '' : el('div', { class: 'banner banner--test' }, [
    el('p', {}, [el('strong', {}, 'Mode test'), ' — le serveur local a joint les réponses attendues. Modifie une case pour simuler une erreur.']),
    el('button', { class: 'button-outline', type: 'button', onclick: fill }, 'Remplir'),
  ]);
  if (expected !== null) fill();
  const reminder = el('p', { class: 'muted smaller form-reminder' }, `Point décimal, sans séparateur de milliers : 2496 · 0.005  ·  ${toolStreak(seance.progression, question.outil.id)}`);
  // Rappel et message du serveur à gauche, « Vérifier » à droite, sur la même ligne (maquette 03).
  const actionsRow = el('div', { class: 'form-actions' }, [el('div', { class: 'form-notes' }, [reminder, status]), checkButton]);
  const progressSlot = el('div', { class: 'question-side' }, progressPanel(seance.progression, labels, { currentId: question.outil.id }));

  function showCorrection({ correction, seance: next }) {
    const correctedAt = Date.now();
    for (const champ of correction.champs) {
      if (!inputs[champ.champ]) continue; // grandeur masquée : rien à corriger ni à montrer
      inputs[champ.champ].readOnly = true;
      notes[champ.champ].replaceChildren(fieldResultNote(champ), champ.evalue && !champ.ok && champ.calcul ? el('div', {}, champ.calcul) : '');
      if (champ.evalue) boxes[champ.champ].classList.add(champ.ok ? 'field--correct' : 'field--wrong');
    }
    const requises = seance.progression.outils.find((outil) => outil.id === correction.outil.id)?.requises ?? correction.outil.apres;
    const [headline, ...rest] = correctionBanner(correction, requises, labels.get(correction.outil.id)).split(' — ');
    const banner = el('div', { class: correction.reussie ? 'banner banner--correct' : 'banner banner--wrong', role: 'alert' }, [
      el('strong', {}, headline),
      el('p', {}, [rest.join(' — ').replace(/^./, (letter) => letter.toUpperCase()), ' ', gapExplanation(correction)]),
    ]);
    // La question suivante est arrivée avec la correction : ce que l'étudiant a passé à lire le corrigé compte déjà.
    const nextButton = el('button', { class: 'button', type: 'button', onclick: () => actions.onNext({ ...next, attendre_s: remainingWait(next.attendre_s, Date.now() - correctedAt) }) }, next.reussite_le === null ? 'Question suivante' : 'Voir le résultat');
    title.textContent = 'Question — corrigée';
    help.hidden = true;
    reminder.hidden = true;
    if (testBanner) testBanner.hidden = true;
    actionsRow.replaceChildren(nextButton);
    actionsRow.before(banner);
    // La progression d'après la correction ; l'outil remis à zéro y passe en rouge.
    progressSlot.replaceChildren(progressPanel(next.progression, labels, { resetId: correction.reussie ? null : correction.outil.id }));
    nextButton.focus();
  }

  async function check(event) {
    event.preventDefault(); // Entrée dans une case = Vérifier (UI §7)
    if (checkButton.disabled) return; // un seul clic : le serveur ne corrige une question qu'une fois
    checkButton.disabled = true;
    status.textContent = '';
    const answers = Object.fromEntries(question.champs.filter((champ) => champ.evalue).map(({ champ }) => [champ, inputs[champ].value]));
    const result = await actions.onCheck(answers);
    if (result === null) return;
    if (result.message !== undefined) {
      // Un refus de cadence devient un compte à rebours ; les autres refus s'écrivent sous le formulaire.
      if (result.attendre_s > 0) waitBefore(result.attendre_s);
      else {
        status.textContent = result.message;
        checkButton.disabled = false;
      }
      return;
    }
    showCorrection(result);
  }

  const total = seance.progression.total_reussies;
  const screen = el('div', { class: 'screen screen--wide question-layout' }, [
    el('div', { class: 'question-main' }, [
      el('div', { class: 'question-head' }, [title, el('div', { class: 'muted smaller' }, `${total} question${total > 1 ? 's' : ''} réussie${total > 1 ? 's' : ''}`)]),
      testBanner,
      el('div', { class: 'question-cards' }, [toolPanel(question), materialPanel(question)]),
      el('section', { class: 'panel' }, [
        el('div', { class: 'panel-head' }, [el('div', { class: 'eyebrow' }, 'Questionnaire'), el('div', { class: 'muted smaller' }, "clique une case pour voir l'aide")]),
        el('form', { novalidate: true, onsubmit: check }, [el('div', { class: 'answer-grid' }, fields), help, reminder, actionsRow]),
      ]),
    ]),
    progressSlot,
  ]);

  // Le premier champ à saisir reçoit le focus à chaque nouvelle question.
  const firstGraded = question.champs.find((champ) => champ.evalue);
  showScreen(main, screen, header(seance, actions), firstGraded ? `#${firstGraded.champ}` : 'h1');
}
