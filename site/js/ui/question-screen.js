// Écran Question (UI §3.3) et question corrigée (UI §3.4) : panneau de l'outil à la couleur de son
// matériau, panneau du matériau brut à la couleur de sa classe ISO, questionnaire de cinq champs
// avec pictogrammes et aide contextuelle, progression par opération et par points. L'exercice réussi ouvre la page
// de l'attestation (attestation-screen.js).
// Tout ce qui est affiché vient du serveur (SPEC §7) ; ce qu'on montre et quand est décidé par
// rules.js et text.js (fonctions pures, testées) : ici, on ne fait que construire le DOM.

import { EXPRESSION_MAX_LENGTH } from '../expression.js';
import { el, pointDecimalComma, showScreen } from './dom.js';
import {
  CALC_KEYS, answerOf, checkButtonLabel, computeCase, diameterLines, enterComputes, factorLines, feedFamily, gapExplanation, helpLine, insertInCase,
  materialCard, operationProgress, questionIsMetric, remainingWait, testAnswers, toolMaterialColor, toolStreak, unreadableCase,
} from './rules.js';
import { classFeatures, classImages, heatImageMaxWidth, operationPictoOf, toolPhotoUrl } from './sheets-data.js';
import { FIELD_PARTS, correctionBanner, expressionLine, fieldResultNote, studentLine } from './text.js';

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

// Sur téléphone (la progression est sous le formulaire), les opérations terminées sont repliées (UI §3.3, D81).
// La mise en page de question.css passe en deux colonnes à 1000 px.
const isPhone = () => window.matchMedia('(max-width: 999px)').matches;

// Écran tactile (D82, point 6) : le pointeur principal est un doigt. Là seulement, une rangée de boutons de calcul ;
// pas sur ordinateur, même à écran tactile, où la souris et le clavier restent le pointeur principal.
const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

// La rangée de boutons de calcul (D82, point 6 ; UI §3.3) : le clavier numérique n'a ni parenthèses ni opérateurs, ni
// touche Entrée sur iPhone. Elle se tient en bas de la zone visible, juste au-dessus du clavier virtuel, tant qu'une
// case à saisir a le focus, après un premier toucher dans une case (renderQuestion). Le clavier ne réduit que la zone
// visible (window.visualViewport), pas la page : la rangée suit le bas de cette zone. Un bouton ne prend jamais le
// focus (pointerdown et mousedown sans effet par défaut) : la case le garde, et le clavier reste ouvert.
//   onKey(key) : un bouton pressé, une entrée de CALC_KEYS
//   active()   : la case qui a le focus, pour que la rangée ne la couvre pas
function calcBar(onKey, active) {
  const keep = (event) => event.preventDefault();
  const bar = el('div', { class: 'calc-bar', role: 'toolbar', 'aria-label': 'Calcul', hidden: true }, CALC_KEYS.map((key) => el('button', {
    class: key.compute ? 'calc-key calc-key--equals' : 'calc-key', type: 'button', tabindex: '-1', 'aria-label': key.name, onpointerdown: keep, onmousedown: keep, onclick: () => onKey(key),
  }, key.label)));
  const viewport = window.visualViewport;
  // Au bas de la zone visible ; puis, si la rangée couvre la case, la page remonte d'autant (et 8 px d'air).
  function place() {
    if (viewport) {
      bar.style.width = `${viewport.width}px`;
      bar.style.transform = `translate(${viewport.offsetLeft}px, ${viewport.offsetTop + viewport.height - bar.offsetHeight}px)`;
    } else bar.classList.add('calc-bar--bottom'); // navigateur sans visualViewport : au bas de la fenêtre
    const input = active();
    const covered = input ? input.getBoundingClientRect().bottom + 8 - bar.getBoundingClientRect().top : 0;
    if (covered > 0) window.scrollBy(0, covered);
  }
  return {
    element: bar,
    // Ouverte, la rangée réserve sa hauteur au bas de l'écran (calc-bar-open) : elle ne cache jamais la fin de la page.
    show() {
      if (!bar.hidden) return;
      bar.hidden = false;
      bar.parentElement?.classList.add('calc-bar-open');
      viewport?.addEventListener('resize', place);
      viewport?.addEventListener('scroll', place);
      place();
    },
    hide() {
      bar.hidden = true;
      bar.parentElement?.classList.remove('calc-bar-open');
      viewport?.removeEventListener('resize', place);
      viewport?.removeEventListener('scroll', place);
    },
  };
}

// Progression (UI §3.3, D81) : barre « n / m outils », puis les outils regroupés par opération (operationProgress) —
// un en-tête par opération (son pictogramme, celui des tables de la séance ; son nom ; « n / m » ; sa barre), ses
// outils dessous, un point par réussite consécutive. Pendant le corrigé (marks.previous : la progression d'avant
// « Vérifier »), la barre montre en vert ce que la question vient de gagner, en rouge ce qu'elle vient de perdre.
function progressPanel(progression, labels, marks, data) {
  const { outils, outils_termines: done } = progression;
  const tags = { current: 'en cours', reset: 'remis à zéro' };
  const rowItem = (row) => el('li', { class: `progress-row progress-row--${row.state}` }, [
    el('span', { class: 'progress-name' }, [row.label, tags[row.state] ? el('small', {}, ` ${tags[row.state]}`) : '']),
    el('span', { class: 'dots', role: 'img', 'aria-label': `${row.dots.filter(Boolean).length} sur ${row.dots.length}` }, row.dots.map((full) => el('span', { class: full ? 'dot dot--full' : 'dot' }))),
  ]);
  // Une part de la barre d'une opération : acquise (bleu), gagnée (vert) ou perdue (rouge), en réussites.
  const part = (kind, count, total) => (count === 0 ? '' : el('span', { class: `progress-op-${kind}`, style: `width: ${(count / total) * 100}%` }));
  const operationItem = (group) => el('li', { class: group.complete ? 'progress-op progress-op--complete' : 'progress-op' }, [
    el('div', { class: 'progress-op-head' }, [
      optionalImage(operationPictoOf(data, group.operation), 'operation-picto progress-op-picto'),
      el('span', { class: 'progress-op-name' }, group.operation),
      el('span', { class: 'progress-op-count' }, `${group.done} / ${group.total}`),
      el('div', { class: 'progress-op-bar', role: 'img', 'aria-label': group.label }, [
        part('kept', group.kept, group.total), part('gain', group.gain, group.total), part('loss', group.loss, group.total),
      ]),
    ]),
    el('ul', { class: 'progress-rows' }, group.rows.map(rowItem)),
  ]);
  const { shown, folded, summary } = operationProgress(progression, labels, { ...marks, phone: isPhone() });
  return el('section', { class: 'panel progress' }, [
    el('div', { class: 'panel-head' }, [el('div', { class: 'eyebrow' }, 'Progression'), el('div', { class: 'muted smaller' }, `${done} / ${outils.length} outils`)]),
    el('div', { class: 'progress-bar', role: 'img', 'aria-label': `${done} outils réussis sur ${outils.length}` }, el('div', { style: `width: ${(done / outils.length) * 100}%` })),
    el('ul', { class: 'progress-ops' }, shown.map(operationItem)),
    summary === null ? '' : el('details', { class: 'progress-done' }, [
      el('summary', {}, summary),
      el('ul', { class: 'progress-ops' }, folded.map(operationItem)),
    ]),
    el('p', { class: 'muted smaller' }, 'Un point par réussite de suite. Un échec sur un outil remet ses points à zéro.'),
  ]);
}

// Panneau de l'outil, à la couleur de son matériau (UI §1). Son titre est le gabarit de nom de
// l'outil, résolu par le serveur avec les valeurs tirées (D24). Le pictogramme de l'opération est celui des tables
// (D76, point 12 : il était pris d'après le nom de l'opération, l'image de la semence, sans lire les tables).
function toolPanel(question, data) {
  const { outil } = question;
  return el('section', { class: 'panel tool-card', style: `--panel-color: var(${toolMaterialColor(outil.materiau, data)})` }, [
    el('div', { class: 'panel-head' }, [el('div', { class: 'eyebrow' }, 'Outil de coupe'), el('div', { class: 'swatch smaller' }, outil.materiau.toLowerCase())]),
    el('div', { class: 'tool-body' }, [
      optionalImage(toolPhotoUrl(outil), 'tool-photo'),
      el('div', {}, [
        el('h2', { class: 'tool-title' }, question.identifiant),
        el('p', { class: 'tool-operation small' }, [optionalImage(operationPictoOf(data, outil.operation), 'operation-picto'), `Opération : ${outil.operation}`]),
        ...diameterLines(question).map((line) => el('p', { class: 'small' }, el('strong', {}, line))),
        el('p', { class: 'small' }, `Nombre de dents : ${outil.dents}`),
        el('p', { class: 'small' }, ['Vitesse de rotation max de la machine : ', el('strong', { class: 'accent' }, `${outil.limite_rpm} tr/min`)]),
        ...factorLines(outil).map((line) => el('p', { class: 'small' }, el('strong', { class: 'accent' }, line))),
        outil.commentaire ? el('p', { class: 'muted small' }, `Note : ${outil.commentaire}`) : '',
      ]),
    ]),
  ]);
}

// Panneau du matériau brut, à la couleur de sa classe ISO (UI §1). Sous la description, l'image de chaleur
// de la classe (D64, D66) avec sa légende et, à sa droite — sous elle quand la place manque, à 390 px —,
// la liste des caractéristiques de la classe (D65) : « Effort : moyen », et sous une ligne qui en a une,
// « → Solution : … » sur une ligne à part. Une classe sans image ni caractéristique ne montre rien ; une
// image qui manque disparaît, la liste reste.
function materialPanel(question, data) {
  const card = materialCard(question.materiau);
  const features = classFeatures(data.classesIso, question.materiau.iso);
  const images = classImages(data.classesIso, question.materiau.iso).map(({ label, url }) => {
    // Largeur affichée : au plus celle de l'original ÷ 1,5 (heatImageMaxWidth), une fois l'image chargée.
    const image = el('img', { src: url, alt: '', onerror: () => figure.remove(), onload: () => { const max = heatImageMaxWidth(image.naturalWidth); if (max !== null) figure.style.maxWidth = `${max}px`; } });
    // La légende vient des tables (D68) ; vide, pas de figcaption du tout.
    const figure = el('figure', { class: 'material-image' }, [image, label === null ? '' : el('figcaption', {}, label)]);
    return figure;
  });
  const list = features.length === 0 ? '' : el('ul', { class: 'material-features small' }, features.map(({ libelle, texte, solution }) => el('li', {}, [
    el('p', {}, [el('span', { class: 'material-feature-label' }, `${libelle} : `), texte]),
    solution === null ? '' : el('p', { class: 'material-feature-solution' }, [el('span', { class: 'material-feature-arrow' }, '→ Solution : '), solution]),
  ])));
  return el('section', { class: 'panel material-card', style: `--panel-color: var(${card.color}); --badge-text: var(${card.textColor})` }, [
    el('div', { class: 'panel-head' }, [el('div', { class: 'eyebrow' }, 'Matériau brut'), el('div', { class: 'swatch smaller' }, `classe ISO ${card.letter}`)]),
    el('div', { class: 'material-body' }, [
      el('div', { class: 'iso-badge', 'aria-hidden': 'true' }, card.letter),
      el('div', {}, [el('h2', {}, card.title), ...card.lines.map((line) => el('p', { class: 'small' }, line))]),
    ]),
    images.length === 0 && list === '' ? '' : el('div', { class: 'material-heat' }, [...images, list]),
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
  const metric = questionIsMetric(question, data); // le rappel « mm / 25.4 » des aides (D70)
  const toolColor = `var(${toolMaterialColor(question.outil.materiau, data)})`;
  const materialColor = `var(${materialCard(question.materiau).color})`;
  const inputs = {};
  const notes = {};
  const boxes = {};

  // Calculs dans les cases (D82 ; règles dans rules.js). Pour chaque case calculée, `kept` garde { value, expression } :
  // la case montre `value`, et c'est `expression` qui part au serveur tant qu'elle la montre.
  const kept = {};

  // Calcule une case : Entrée, sortie de la case, Vérifier, bouton « = ». La virgule devient un point au même moment
  // (D71). Une expression illisible garde son texte, en rouge, avec la note qui dit pourquoi.
  function compute(champ) {
    const input = inputs[champ];
    if (!input || input.readOnly) return;
    pointDecimalComma(input);
    const result = computeCase(input.value);
    if (result === null) return;
    if (result.error !== undefined) {
      input.setAttribute('aria-invalid', 'true');
      notes[champ].textContent = result.error;
      return;
    }
    input.value = result.value;
    kept[champ] = result;
    notes[champ].textContent = result.note;
  }

  // La case a changé (frappe, bouton de la rangée, « Remplir ») : une expression gardée est oubliée dès que la case ne
  // montre plus son résultat ; la note d'une expression illisible s'efface.
  function edited(champ) {
    const input = inputs[champ];
    if (kept[champ] && input.value !== kept[champ].value) {
      delete kept[champ];
      notes[champ].textContent = '';
    }
    if (input.hasAttribute('aria-invalid')) {
      input.removeAttribute('aria-invalid');
      notes[champ].textContent = '';
    }
  }

  // Entrée dans une case : calcule une expression, et on reste dans la case — même illisible : Entrée ne vérifie jamais
  // une case illisible ; sinon, rien ici — le formulaire est envoyé, Entrée vérifie comme avant (UI §7).
  function enter(event, champ) {
    if (event.key !== 'Enter' || event.isComposing || !enterComputes(inputs[champ].value)) return;
    event.preventDefault();
    compute(champ);
  }

  // La rangée de boutons de calcul, sur écran tactile seulement (D82, point 6) : un bouton insère son caractère au
  // curseur de la case qui a le focus ; « = » la calcule.
  const activeCase = () => Object.entries(inputs).find(([, input]) => input === document.activeElement && !input.readOnly)?.[0] ?? null;
  const bar = isTouch() ? calcBar(pressKey, () => inputs[activeCase()] ?? null) : null;
  function pressKey(key) {
    const champ = activeCase();
    if (champ === null) return;
    if (key.compute) {
      compute(champ);
      return;
    }
    const input = inputs[champ];
    const next = insertInCase(input.value, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, key.insert, EXPRESSION_MAX_LENGTH);
    if (next === null) return;
    input.value = next.value;
    input.setSelectionRange(next.caret, next.caret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // La rangée se montre quand une case à saisir prend le focus, se cache quand le focus quitte les cases — mais seulement
  // après un premier toucher dans une case (D82, réponse de Thierry au rapport, point 4) : le focus automatique de la
  // première case, à l'affichage de la question, n'ouvre pas le clavier d'un iPhone, et la rangée resterait seule au
  // bas de l'écran. Une fois une case touchée, la rangée suit le focus d'une case à l'autre.
  let touched = false;
  const showBar = () => { if (touched) bar?.show(); };
  const hideBar = (event) => { if (bar && !Object.values(inputs).includes(event.relatedTarget)) bar.hide(); };
  // Un toucher dans une case : la case qui avait déjà le focus (la première, à l'affichage) ne reçoit pas d'événement
  // focus ; la rangée se montre donc ici aussi.
  function touchCase(champ) {
    touched = true;
    if (document.activeElement === inputs[champ] && !inputs[champ].readOnly) showBar();
  }

  // Aide contextuelle, au clic seulement : la méthode, jamais la valeur (rules.js).
  const help = el('div', { class: 'help-line', hidden: true, 'aria-live': 'polite' });
  function showHelp(field) {
    const { parts, table } = helpLine(field, question, family, metric);
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
      maxlength: evalue ? String(EXPRESSION_MAX_LENGTH) : null, // une expression de 60 caractères au plus (D82)
      tabindex: evalue ? null : '-1', // Tab saute les champs fournis (UI §7)
      'aria-describedby': `${champ}-note`,
      onfocus: evalue ? () => { showHelp(champ); if (!inputs[champ].readOnly) showBar(); } : () => {},
      // Calculs dans les cases (D82) : Entrée calcule, quitter la case calcule, toute retouche oublie l'expression.
      onkeydown: evalue ? (event) => enter(event, champ) : () => {},
      oninput: evalue ? () => edited(champ) : () => {},
      onfocusout: evalue ? (event) => { compute(champ); hideBar(event); } : () => {},
      onpointerdown: evalue ? () => touchCase(champ) : () => {},
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
  const fill = () => {
    for (const [champ, texte] of Object.entries(expected)) {
      if (!inputs[champ]) continue;
      inputs[champ].value = texte;
      edited(champ);
    }
  };
  const testBanner = expected === null ? '' : el('div', { class: 'banner banner--test' }, [
    el('p', {}, [el('strong', {}, 'Mode test'), ' — le serveur local a joint les réponses attendues. Modifie une case pour simuler une erreur.']),
    el('button', { class: 'button-outline', type: 'button', onclick: fill }, 'Remplir'),
  ]);
  if (expected !== null) fill();
  // ❓ D82 : « un calcul se tape tel quel » ajouté au rappel, pour que l'étudiant sache qu'il peut calculer dans la case.
  const reminder = el('p', { class: 'muted smaller form-reminder' }, `Point décimal (une virgule devient un point), sans séparateur de milliers : 2496 · 0.005  ·  un calcul se tape tel quel : (3-1)*2  ·  ${toolStreak(seance.progression, question.outil.id)}`);
  // Rappel et message du serveur à gauche, « Vérifier » à droite, sur la même ligne (maquette 03).
  const actionsRow = el('div', { class: 'form-actions' }, [el('div', { class: 'form-notes' }, [reminder, status]), checkButton]);
  const progressSlot = el('div', { class: 'question-side' }, progressPanel(seance.progression, labels, { currentId: question.outil.id }, data));

  function showCorrection({ correction, seance: next }) {
    const correctedAt = Date.now();
    for (const champ of correction.champs) {
      if (!inputs[champ.champ]) continue; // grandeur masquée : rien à corriger ni à montrer
      inputs[champ.champ].readOnly = true;
      inputs[champ.champ].removeAttribute('aria-invalid'); // « Juste » ou « Faux » remplace la note d'une expression illisible
      // Sous la case : juste ou faux ; la saisie avec son expression (D82) ; le calcul en une ligne d'un champ faux.
      const line = expressionLine(champ);
      notes[champ.champ].replaceChildren(fieldResultNote(champ), line ? el('div', {}, line) : '', champ.evalue && !champ.ok && champ.calcul ? el('div', {}, champ.calcul) : '');
      if (champ.evalue) boxes[champ.champ].classList.add(champ.ok ? 'field--correct' : 'field--wrong');
    }
    bar?.hide();
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
    // La progression d'après la correction, comparée à celle d'avant « Vérifier » : ce que la question a gagné (vert)
    // ou perdu (rouge) dans la barre de son opération ; l'outil remis à zéro y passe en rouge (D81).
    progressSlot.replaceChildren(progressPanel(next.progression, labels, { previous: seance.progression, resetId: correction.reussie ? null : correction.outil.id }, data));
    nextButton.focus();
  }

  async function check(event) {
    event.preventDefault(); // Entrée dans une case = Vérifier (UI §7)
    if (checkButton.disabled) return; // un seul clic : le serveur ne corrige une question qu'une fois
    status.textContent = '';
    // Toutes les cases se calculent avant l'envoi (D82), et la virgule devient un point ici aussi, à l'écran (D71) :
    // Entrée ne quitte pas la case. Une case calculée envoie son expression, que le serveur juge (answerOf).
    Object.keys(inputs).forEach(compute);
    Object.values(inputs).forEach(pointDecimalComma);
    // Une expression illisible ne part jamais (D82, réponse de Thierry au rapport, point 2) : rien n'est envoyé, et la
    // première case illisible reçoit le focus, en rouge avec sa raison ; l'étudiant corrige ou efface.
    const graded = question.champs.filter((champ) => champ.evalue).map(({ champ }) => champ);
    const blocked = unreadableCase(graded.map((champ) => [champ, inputs[champ].value]));
    if (blocked !== null) {
      inputs[blocked].focus();
      return;
    }
    checkButton.disabled = true;
    const answers = Object.fromEntries(graded.map((champ) => [champ, answerOf(inputs[champ].value, kept[champ])]));
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
      el('div', { class: 'question-cards' }, [toolPanel(question, data), materialPanel(question, data)]),
      el('section', { class: 'panel' }, [
        el('div', { class: 'panel-head' }, [el('div', { class: 'eyebrow' }, 'Questionnaire'), el('div', { class: 'muted smaller' }, "clique une case pour voir l'aide")]),
        el('form', { novalidate: true, onsubmit: check }, [el('div', { class: 'answer-grid' }, fields), help, reminder, actionsRow]),
      ]),
    ]),
    progressSlot,
    bar?.element ?? '', // hors des panneaux : leur filtre (le halo) ferait de la rangée un élément de panneau, pas de la fenêtre
  ]);

  // Le premier champ à saisir reçoit le focus à chaque nouvelle question.
  const firstGraded = question.champs.find((champ) => champ.evalue);
  showScreen(main, screen, header(seance, actions), firstGraded ? `#${firstGraded.champ}` : 'h1');
}
