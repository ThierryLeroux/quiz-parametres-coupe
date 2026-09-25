// L'éditeur des exercices et de la banque d'outils (jalons 7a et 7b, décisions D47 à D49, D56 à D59 ; UI §3.9).
// Rôle admin seulement : la même clé que l'espace professeur ; le serveur refuse la clé de
// consultation sur chaque route. Ce qu'on montre est décidé par editeur-data.js (pur, testé) et la
// validation est celle du quiz (draftErrors, site/js/exercice.js) ; ici, on construit le DOM.
//
// Écrans : connexion → liste des exercices → page d'un exercice (réglages, outils, versions,
// aperçu, publication, version des tables) ; banque d'outils → fiche d'un outil ; tables de
// référence (brouillon, publication d'une version avec sa révision, aperçu, feuilles imprimables) ;
// images (galerie, téléversement, archivage) ; sauvegarde (export, import — les images voyagent à
// part, une par requête).

import {
  editorArchiveExercise, editorBank, editorBankArchive, editorBankCreate, editorBankSave, editorCreateExercise, editorDeleteExercise, editorExport,
  editorExerciseTables, editorGetExercise, editorImageArchive, editorImageDelete, editorImageImport, editorImageRename, editorImageUpload, editorImages, editorImport, editorImportValidate, editorListExercises, editorMoveExercise, editorPreview, editorPublish, editorRenameExercise, editorSaveDraft,
  editorTables, editorTablesPreview, editorTablesPublish, editorTablesSave, editorTablesVersion, teacherLogin, teacherLogout,
} from '../api.js';
import { toolMaterialNames, validateTables } from '../data.js';
import { copyOfTool, draftErrors } from '../exercice.js';
import { tablesDiff } from '../tables.js';
import { applyTableColors, el, showScreen } from './dom.js';
import {
  FEED_FAMILIES, FIELD_CHOICES, FIELD_STATES, USAGE_LABELS, archiveConfirmation, canDeleteImage, deleteConfirmation, deducibleWarnings, deriveGroups, diffLines, dimensionsText, errorsByField, exampleIdentifier, exerciseState, exerciseTablesImpact, exportFileName, feedFamilyFlags, feedFamilyOf, fieldStates,
  dimensionReadings, groupSwatch, imageArchiveConfirmation, imageDeleteConfirmation, imageSizeText, imageUsageLabel, importSummaryLines, importWordFor, insertToken, materialSwatch, parseDimensions, permittedTokens, previewColumns, previewRows, publishState, removeSelectionConfirmation, removeToolConfirmation, sessionsLabel, statesToDraft, studentLink, tablesNotice, tablesUsageLabel, templateTokenList, versionDiff, versionLabel,
} from './editeur-data.js';
import { imagePicker, prepareUpload } from './images-picker.js';
import { imageUrl } from './sheets-data.js';
import { formatDateStamp, serverErrorMessage } from './text.js';

const main = document.querySelector('#app');
const TITLE = 'Éditeur des exercices';

// Un identifiant libre parmi ceux pris : « mvlnr », « mvlnr_2 »…
function freeId(wanted, taken) {
  if (!taken.includes(wanted)) return wanted;
  for (let n = 2; ; n += 1) if (!taken.includes(`${wanted}_${n}`)) return `${wanted}_${n}`;
}

const state = {
  connected: false,
  images: { outil: null, operation: null }, // les fiches des images de la base, par usage (chargées à la demande)
  dirty: false, // des modifications non enregistrées sur la page courante
};

window.addEventListener('beforeunload', (event) => {
  if (state.dirty) event.preventDefault();
});

// --- Connexion ----------------------------------------------------------------------------------------------------

function showLogin(notice = '') {
  state.dirty = false;
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  const input = el('input', { id: 'cle', name: 'cle', type: 'text', class: 'input-secret', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'cle-note' });
  const button = el('button', { class: 'button', type: 'submit' }, 'Se connecter');
  async function submit(event) {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = '';
    try {
      const { role } = await teacherLogin(input.value);
      if (role !== 'admin') {
        await teacherLogout().catch(() => {});
        throw new Error("L'éditeur est réservé à la clé d'administration : la clé de consultation ne fait que lire l'espace professeur.");
      }
      state.connected = true;
      await showList();
    } catch (error) {
      status.textContent = error.status === 429 && error.details.attendre_s ? `${error.message} (${error.details.attendre_s} s)` : (error.status === undefined ? error.message : serverErrorMessage(error));
      button.disabled = false;
      input.focus();
    }
  }
  const screen = el('div', { class: 'screen screen--narrow' }, el('section', { class: 'panel' }, [
    el('div', { class: 'eyebrow' }, TITLE),
    el('h1', { tabindex: '-1' }, 'Connexion'),
    el('p', { class: 'muted small' }, "Entre la clé d'administration du serveur de correction. L'éditeur n'est pas ouvert à la clé de consultation. La séance dure 12 h."),
    el('form', { novalidate: true, onsubmit: submit }, [
      el('div', { class: 'form-grid form-grid--single' }, el('div', { class: 'field' }, [el('label', { for: 'cle' }, 'Clé'), input, el('div', { class: 'field-note', id: 'cle-note' }, "Clé d'administration. Cinq essais, puis un délai croissant.")])),
      el('div', { class: 'form-actions' }, [status, button]),
    ]),
  ]));
  showScreen(main, screen, { title: TITLE, aside: 'TGM-TMI' }, '#cle');
}

// Un appel à l'éditeur : un 401 ramène à la connexion, un 403 dit que la clé ne permet pas d'éditer.
async function guarded(action) {
  try {
    return await action();
  } catch (error) {
    if (error.status === 401) { showLogin('Ta séance a expiré : connecte-toi de nouveau.'); return null; }
    if (error.status === 403) { showLogin(serverErrorMessage(error)); return null; }
    throw error;
  }
}

function headerAside() {
  return [
    el('span', {}, 'admin'),
    el('a', { class: 'button-link', href: '/prof' }, 'Espace professeur'),
    el('button', { class: 'button-link', type: 'button', onclick: async () => { await teacherLogout().catch(() => {}); state.connected = false; showLogin('Déconnecté.'); } }, 'Se déconnecter'),
  ];
}

// Les onglets : Exercices, Banque d'outils, Tables de référence, Images, Sauvegarde.
function tabs(current) {
  return el('div', { class: 'prof-tabs', role: 'tablist' }, [['exercices', 'Exercices', showList], ['banque', "Banque d'outils", showBank], ['tables', 'Tables de référence', showTables], ['images', 'Images', showImages], ['sauvegarde', 'Sauvegarde', showBackup]]
    .map(([key, label, open]) => el('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(current === key), onclick: () => leave(open) }, label)));
}

// Quitter la page courante : si des modifications ne sont pas enregistrées, demander d'abord.
function leave(open, ...args) {
  if (state.dirty && !window.confirm('Des modifications ne sont pas enregistrées. Quitter la page et les perdre ?')) return;
  state.dirty = false;
  open(...args);
}

const panelHead = (eyebrow, current) => el('div', { class: 'panel-head' }, [el('div', { class: 'eyebrow' }, `${TITLE} · ${eyebrow}`), tabs(current)]);

// --- Liste des exercices (B2) ----------------------------------------------------------------------------------------

async function showList(notice = '') {
  const response = await guarded(() => editorListExercises());
  if (response === null) return;
  const status = el('div', { class: 'server-message', role: 'status' }, notice);

  // Une action de la liste, puis rechargement.
  const act = async (action, success = '') => {
    try {
      await guarded(action);
      await showList(success);
    } catch (error) {
      status.textContent = serverErrorMessage(error);
    }
  };

  const rows = response.exercices.map((row, i) => {
    const open = () => leave(showExercise, row.id);
    const actions = [
      el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: open }, 'Ouvrir'),
      // L'ordre de la liste est aussi celui de l'accueil des étudiants (D51).
      el('button', { class: 'button-small button-small--neutral', type: 'button', disabled: i === 0, title: 'Monter dans la liste', onclick: () => act(() => editorMoveExercise(row.id, row.rang, 'monter')) }, '↑'),
      el('button', { class: 'button-small button-small--neutral', type: 'button', disabled: i === response.exercices.length - 1, title: 'Descendre dans la liste', onclick: () => act(() => editorMoveExercise(row.id, row.rang, 'descendre')) }, '↓'),
      el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => {
        const id = window.prompt(`Identifiant du nouvel exercice (minuscules, chiffres, tirets), copie de « ${row.titre} » :`, `${row.id}-2`);
        if (id) act(() => editorCreateExercise({ id: id.trim(), depuis: row.id }), `« ${row.titre} » dupliqué sous « ${id.trim()} » : un brouillon, à publier.`);
      } }, 'Dupliquer'),
      el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => {
        const titre = window.prompt('Nouveau titre (celui du brouillon ; à publier pour que les étudiants le voient) :', row.titre);
        if (titre && titre.trim() !== row.titre) act(() => editorRenameExercise(row.id, titre.trim()), 'Titre du brouillon changé : publier pour que les étudiants le voient.');
      } }, 'Renommer'),
      row.archive_le === null
        ? el('button', { class: 'button-small', type: 'button', onclick: () => { if (window.confirm(archiveConfirmation(row))) act(() => editorArchiveExercise(row.id, true), `« ${row.titre} » archivé.`); } }, 'Archiver')
        : el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => act(() => editorArchiveExercise(row.id, false), `« ${row.titre} » rétabli.`) }, 'Rétablir'),
      ...(row.seances === 0 ? [el('button', { class: 'button-small button-small--danger', type: 'button', onclick: () => { if (window.confirm(deleteConfirmation(row))) act(() => editorDeleteExercise(row.id), `« ${row.titre} » supprimé.`); } }, 'Supprimer')] : []),
      el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: async (event) => {
        const link = studentLink(location.origin, row.id);
        try { await navigator.clipboard.writeText(link); event.currentTarget.textContent = 'Lien copié'; } catch { window.prompt('Lien à donner sur Léa :', link); }
      } }, 'Copier le lien étudiant'),
    ];
    return el('tr', {}, [
      el('td', { class: 'num' }, String(row.rang)),
      el('td', {}, el('button', { class: 'button-link', type: 'button', onclick: open }, row.titre)),
      el('td', { class: 'mono' }, row.id),
      el('td', { class: row.archive_le !== null ? 'state--running' : (row.modifie ? '' : 'state--done') }, exerciseState(row)),
      el('td', { class: 'date' }, versionLabel(row)),
      el('td', {}, sessionsLabel(row)),
      el('td', {}, row.liste && row.archive_le === null ? 'oui' : 'non'),
      el('td', { class: 'actions' }, el('div', { class: 'actions-group' }, actions)),
    ]);
  });

  // Nouvel exercice : identifiant et titre.
  const idInput = el('input', { id: 'nouvel-id', type: 'text', autocomplete: 'off', placeholder: 'm10-fraisage' });
  const titreInput = el('input', { id: 'nouveau-titre', type: 'text', autocomplete: 'off', placeholder: 'M10 — Fraisage : avances' });
  const createForm = el('form', { class: 'ajout-outil', novalidate: true, onsubmit: (event) => {
    event.preventDefault();
    act(() => editorCreateExercise({ id: idInput.value.trim(), titre: titreInput.value.trim() }), `« ${titreInput.value.trim()} » créé : un brouillon vide, à compléter puis à publier.`);
  } }, [
    el('div', { class: 'field' }, [el('label', { for: 'nouvel-id' }, "Identifiant d'URL (?exercice=…)"), idInput, el('div', { class: 'field-note' }, 'Minuscules, chiffres et tirets ; définitif : c\'est le lien sur Léa.')]),
    el('div', { class: 'field' }, [el('label', { for: 'nouveau-titre' }, 'Titre'), titreInput, el('div', { class: 'field-note' }, '')]),
    el('button', { class: 'button-outline', type: 'submit' }, 'Créer un exercice vide'),
  ]);

  const screen = el('div', { class: 'screen screen--wide prof editeur' }, el('section', { class: 'panel' }, [
    panelHead('exercices', 'exercices'),
    el('h1', { tabindex: '-1' }, 'Exercices'),
    el('p', { class: 'muted small' }, "Les étudiants voient la dernière version publiée de chaque exercice ; une séance commencée garde sa version jusqu'à la fin. Le brouillon ne change rien tant qu'il n'est pas publié. L'ordre de cette liste (↑ ↓) est celui de l'accueil des étudiants."),
    status,
    el('div', { class: 'table-wrap' }, el('table', { class: 'prof-table' }, [
      el('thead', {}, el('tr', {}, ['Rang', 'Titre', 'Identifiant', 'État', 'Dernière version', 'Séances', "À l'accueil", 'Actions'].map((label) => el('th', { class: label === 'Rang' ? 'num' : null }, label)))),
      el('tbody', {}, rows),
    ])),
    el('p', { class: 'muted smaller prof-count' }, `${rows.length} exercice${rows.length > 1 ? 's' : ''}.`),
    el('h2', { class: 'editeur-bar' }, 'Nouvel exercice'),
    createForm,
  ]));
  showScreen(main, screen, { title: TITLE, aside: headerAside() }, 'h1');
}

// --- Formulaire d'outil (B3, B4) : le même pour une copie et pour un outil de la banque ------------------------------

// Un champ de formulaire avec sa note (qui reçoit l'erreur du champ).
//   name : la clé de l'outil (data-champ) ; control : l'élément de saisie ; note : la note par défaut
function field(name, label, control, note = '', classes = '') {
  const noteEl = el('div', { class: 'field-note field-note--multi' }, note);
  const element = el('div', { class: `field ${classes}`.trim(), 'data-champ': name }, [el('label', { for: control.id }, label), control, noteEl]);
  return { element, control, noteEl, note, name };
}

const numberInput = (id, value, attrs = {}) => el('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', value: value === null || value === undefined ? '' : String(value), ...attrs });
const readNumber = (input) => {
  const text = input.value.trim().replace(',', '.');
  return text === '' ? Number.NaN : Number(text);
};

// Une liste de cases à cocher : retourne { element, read() → les valeurs cochées dans l'ordre des choix }.
//   swatchOf : (clé) → { background, text, letter } — la pastille de couleur devant le libellé (matières, groupes)
//   buttons  : « Tout cocher » / « Tout décocher » sous la liste
function checkboxes(idPrefix, choices, checked, { inline = false, swatchOf = null, buttons = false } = {}) {
  const inputs = choices.map((choice, i) => el('input', { id: `${idPrefix}-${i}`, type: 'checkbox', value: choice.key, checked: checked.includes(choice.key) }));
  const swatch = (choice) => {
    if (swatchOf === null) return '';
    const s = swatchOf(choice.key);
    return el('span', { class: 'choice-swatch', 'aria-hidden': 'true', style: `background: ${s.background}; color: ${s.text}` }, s.letter);
  };
  const list = el('ul', { class: `choices${inline ? ' choices--inline' : ''}` }, choices.map((choice, i) => el('li', {}, el('label', { for: `${idPrefix}-${i}` }, [inputs[i], swatch(choice), choice.label]))));
  const setAll = (value) => { inputs.forEach((input) => { input.checked = value; }); list.dispatchEvent(new Event('change', { bubbles: true })); };
  const element = el('div', { class: 'choices-block' }, [
    list,
    buttons ? el('div', { class: 'choices-actions' }, [
      el('button', { class: 'button-link', type: 'button', onclick: () => setAll(true) }, 'Tout cocher'),
      el('button', { class: 'button-link', type: 'button', onclick: () => setAll(false) }, 'Tout décocher'),
    ]) : '',
  ]);
  return { element, read: () => inputs.filter((input) => input.checked).map((input) => input.value) };
}

// Le formulaire d'un outil. Retourne { element, read(), setErrors(map), fields }.
//   tool  : l'outil (ou la copie) à éditer ; ctx : { tables, opsByName, images (fiches « outil »), copy, prefix }
function toolForm(tool, ctx) {
  const p = ctx.prefix;
  const ops = ctx.tables.operations.operations;
  const groups = ctx.tables.materiaux.groupes_iso;
  const operationSelect = el('select', { id: `${p}-operation` }, ops.map((op) => el('option', { value: op.operation, selected: op.operation === tool.operation }, op.operation)));
  const isThread = () => ctx.opsByName.get(operationSelect.value)?.avance_egale_pas_filetage === true;
  // La photo (D56) : la galerie des images « outil » de la base, avec téléversement sur place ; un
  // changement dans la galerie vaut un changement du formulaire (validation, brouillon modifié).
  const picker = imagePicker({ usage: 'outil', images: ctx.images, value: tool.image ?? null, upload: (file) => uploadImage(file, 'outil'), onChange: () => element.dispatchEvent(new Event('change', { bubbles: true })), idPrefix: `${p}-image` });
  // Les matières d'outil et les couleurs sont celles de la version de tables de la page (D61).
  const materials = checkboxes(`${p}-mat`, toolMaterialNames(ctx.tables.materiaux).map((key) => ({ key, label: key })), tool.materiaux_outil ?? [], { inline: true, swatchOf: (label) => materialSwatch(label, ctx.tables.materiaux), buttons: true });
  const groupChoices = checkboxes(`${p}-grp`, groups.map((key) => ({ key, label: key })), tool.groupes_materiaux_usinables ?? [], { swatchOf: (group) => groupSwatch(group, ctx.tables.materiaux), buttons: true });

  // Le gabarit de nomenclature (D24, D58) : éditable ; les boutons insèrent un jeton permis pour cet
  // outil au curseur ; l'exemple composé suit la frappe, « Autre exemple » le tire au hasard dans l'outil.
  const template = el('input', { id: `${p}-format`, type: 'text', autocomplete: 'off', spellcheck: 'false', value: tool.format_identifiant ?? '' });
  const tokenBar = el('div', { class: 'token-buttons' });
  const exampleText = el('span', {});
  let drawn = null; // null = l'exemple fixe (premières valeurs) ; sinon une suite de tirages figée, rejouée à chaque rafraîchissement
  const exampleLine = el('div', { class: 'field-note field-note--multi exemple-nomenclature' }, [exampleText, ' ', el('button', { class: 'button-link', type: 'button', onclick: () => {
    drawn = Array.from({ length: 8 }, () => Math.random());
    refreshExample();
  } }, 'Autre exemple')]);
  function refreshExample() {
    const current = read();
    const random = drawn === null ? null : ((sequence) => { let i = 0; return () => sequence[i++ % sequence.length]; })(drawn);
    exampleText.textContent = `Exemple composé : ${exampleIdentifier(current, ctx.opsByName, random)} — jetons : ${templateTokenList(template.value).join(', ') || 'aucun'}.`;
    tokenBar.replaceChildren(...permittedTokens(current, ctx.opsByName).map(({ token, label }) => el('button', { class: 'button-small button-small--neutral', type: 'button', title: `Insérer [${token}] : ${label}`, onclick: () => {
      const { text: next, caret } = insertToken(template.value, template.selectionStart ?? template.value.length, template.selectionEnd ?? template.value.length, token);
      template.value = next;
      template.focus();
      template.setSelectionRange(caret, caret);
      template.dispatchEvent(new Event('input', { bubbles: true }));
    } }, `[${token}]`)));
  }

  // Ce que le moteur lit de chaque ligne de dimension : pour un filetage, le Ø et le pas (pouces, et mm en
  // métrique) ; sinon seulement les lignes illisibles. Mis à jour à la frappe.
  const readings = el('ul', { class: 'dimension-lectures' });
  const refreshReadings = () => {
    const thread = isThread();
    const lines = dimensionReadings(fields.dimensions.control.value, thread).filter((line) => thread || line.erreur !== null);
    readings.replaceChildren(...lines.map((line) => el('li', { class: line.erreur ? 'dimension-lecture--erreur' : null }, [el('span', { class: 'mono' }, line.libelle), ' → ', line.erreur ?? line.lecture])));
    readings.hidden = lines.length === 0;
  };

  const fields = {
    id: field('id', 'Identifiant', el('input', { id: `${p}-id`, type: 'text', readonly: true, value: tool.id }), ctx.copy ? "Propre à l'exercice (dupliquer donne « _2 »)." : 'Définitif.'),
    nom: field('nom', 'Nom', el('input', { id: `${p}-nom`, type: 'text', autocomplete: 'off', value: tool.nom ?? '' }), 'Le nom générique, celui de la progression et de l\'attestation.'),
    operation: field('operation', 'Opération', operationSelect, 'Fixe la famille d\'avance (table des avances).'),
    commentaire: field('commentaire', 'Note affichée sous l\'outil', el('input', { id: `${p}-commentaire`, type: 'text', autocomplete: 'off', value: tool.commentaire ?? '' }), ''),
    image: field('image', 'Photo', picker.element, "Celle que l'étudiant voit dans le panneau de l'outil. La galerie montre les images « photo d'outil » non archivées ; « Téléverser » réduit la photo dans le navigateur avant l'envoi (800 px ; JPEG sur fond blanc, ou PNG si elle a de la transparence).", 'field--wide'),
    format_identifiant: field('format_identifiant', 'Gabarit de nomenclature', template, "Le nom affiché dans la question : du texte et des jetons entre crochets, remplacés au tirage. Les boutons insèrent au curseur les jetons permis pour cet outil.", 'field--wide'),
    dimensions: field('dimensions', 'Dimensions possibles (une par ligne : libellé ; valeur)', el('textarea', { id: `${p}-dimensions`, spellcheck: 'false', oninput: () => refreshReadings() }, dimensionsText(tool.dimensions)),
      'Valeur : Ø en pouces (« Ø 1/4 po ; 0.25 »), ou le filetage en texte : « 1/4- 20 UNC ; 0.25-20 », « M10 x 1.5 ; 10x1.5 ».', 'field--half'),
    dimensions_barre: field('dimensions_barre', 'Barres (outil à deux diamètres) : libellé ; Ø en pouces', el('textarea', { id: `${p}-barres`, spellcheck: 'false' }, dimensionsText(tool.dimensions_barre)),
      'Vide = un seul diamètre. Sinon, avance proportionnelle au Ø de la barre ; N avec le Ø usiné.'),
    rapport_barre_max: field('rapport_barre_max', 'Rapport Ø barre / Ø usiné maximal', numberInput(`${p}-rapport`, tool.rapport_barre_max), 'Ex. 0.75 : une barre entre si Ø barre ≤ 0.75 × Ø usiné.'),
    nb_dents_min: field('nb_dents_min', 'Dents, minimum', numberInput(`${p}-dents-min`, tool.nb_dents_min), 'Le nombre de dents est tiré entre les deux.'),
    nb_dents_max: field('nb_dents_max', 'Dents, maximum', numberInput(`${p}-dents-max`, tool.nb_dents_max), ''),
    fact_vc: field('fact_vc', 'Facteur de vitesse (× Vc)', numberInput(`${p}-fact-vc`, tool.fact_vc), '1 = aucun ; 0.25 pour un alésoir.'),
    fact_av: field('fact_av', "Facteur d'avance (× avance)", numberInput(`${p}-fact-av`, tool.fact_av), '1 sauf sur une avance proportionnelle au Ø.'),
    limite_rpm: field('limite_rpm', 'RPM max de la machine', numberInput(`${p}-limite-rpm`, tool.limite_rpm), 'rév/min'),
    limite_avance: field('limite_avance', "Limite d'avance (non utilisée)", numberInput(`${p}-limite-avance`, tool.limite_avance), 'po/rév ; vide = aucune. Donnée du classeur, ignorée par le moteur.'),
    materiaux_outil: field('materiaux_outil', "Matières d'outil possibles", materials.element, '', 'field--wide'),
    groupes_materiaux_usinables: field('groupes_materiaux_usinables', 'Groupes de matériaux usinables', groupChoices.element, '', 'field--wide'),
  };
  if (ctx.copy) fields.reussites_requises = field('reussites_requises', 'Réussites de suite exigées', numberInput(`${p}-reussites`, tool.reussites_requises, { inputmode: 'numeric' }), 'Un échec remet le compteur de cet outil à zéro.');

  // Les champs, regroupés par thème (UI §3.9) : un intertitre par groupe ; la même disposition pour la banque.
  const sections = [
    ['Identification', [fields.nom.element, fields.operation.element, fields.commentaire.element, fields.id.element, fields.image.element]],
    ['Nomenclature', [fields.format_identifiant.element]],
    ['Dimensions', [fields.dimensions.element, el('div', { class: 'field' }, [el('span', { class: 'field-label-text' }, 'Lecture par le moteur'), readings]), fields.dimensions_barre.element, fields.rapport_barre_max.element]],
    ['Dents', [fields.nb_dents_min.element, fields.nb_dents_max.element]],
    ['Facteurs', [fields.fact_vc.element, fields.fact_av.element]],
    ['Limites', [fields.limite_rpm.element, fields.limite_avance.element]],
    ['Matières et groupes permis', [fields.materiaux_outil.element, fields.groupes_materiaux_usinables.element]],
    ...(ctx.copy ? [['Exercice', [fields.reussites_requises.element]]] : []),
  ];
  const element = el('div', { class: 'outil-formulaire' }, sections.map(([title, members]) => el('fieldset', { class: 'editeur-groupe' }, [el('legend', {}, title), el('div', { class: 'editeur-grid' }, members)])));

  function read() {
    const bars = parseDimensions(fields.dimensions_barre.control.value, false);
    const out = {
      id: tool.id,
      nom: fields.nom.control.value.trim(),
      format_identifiant: template.value.trim(),
      commentaire: fields.commentaire.control.value.trim() === '' ? null : fields.commentaire.control.value.trim(), // null = pas de note, comme dans le catalogue
      operation: operationSelect.value,
      fact_vc: readNumber(fields.fact_vc.control),
      fact_av: readNumber(fields.fact_av.control),
      limite_rpm: readNumber(fields.limite_rpm.control),
      limite_avance: fields.limite_avance.control.value.trim() === '' ? null : readNumber(fields.limite_avance.control),
      nb_dents_min: readNumber(fields.nb_dents_min.control),
      nb_dents_max: readNumber(fields.nb_dents_max.control),
      materiaux_outil: materials.read(),
      groupes_materiaux_usinables: groupChoices.read(),
      image: picker.read(),
      dimensions: parseDimensions(fields.dimensions.control.value, isThread()),
    };
    if (tool.colonne_excel !== undefined) out.colonne_excel = tool.colonne_excel;
    if (bars.length > 0 || fields.rapport_barre_max.control.value.trim() !== '') {
      out.dimensions_barre = bars;
      out.rapport_barre_max = readNumber(fields.rapport_barre_max.control);
    }
    if (ctx.copy) {
      out.reussites_requises = readNumber(fields.reussites_requises.control);
      if (tool.origine !== undefined) out.origine = tool.origine;
    }
    return out;
  }

  // Écrit les erreurs sous leurs champs : map champ → [messages] ; les champs sans erreur reprennent leur note.
  function setErrors(map) {
    for (const f of Object.values(fields)) {
      const messages = map.get(f.name) ?? [];
      f.element.setAttribute('data-erreur', messages.length > 0 ? 'true' : 'false');
      f.control.setAttribute?.('aria-invalid', messages.length > 0 ? 'true' : 'false');
      f.noteEl.textContent = messages.length > 0 ? messages.join('\n') : f.note;
    }
  }
  fields.format_identifiant.element.insertBefore(tokenBar, fields.format_identifiant.noteEl);
  fields.format_identifiant.element.append(exampleLine);
  operationSelect.addEventListener('change', refreshReadings);
  refreshReadings();
  refreshExample();
  return { element, read, setErrors, fields, refreshExample, picker };
}

// Téléverse une image pour une galerie : réduite dans le navigateur (prepareUpload), envoyée au
// serveur (qui vérifie le type, assainit un SVG et ne stocke pas un doublon), puis mise en cache.
// Retourne la fiche, avec « existante » et ce qui a été retiré d'un SVG.
async function uploadImage(file, usage) {
  const body = await prepareUpload(file, usage);
  const result = await guarded(() => editorImageUpload(body));
  if (result === null) throw new Error('Ta séance a expiré : connecte-toi de nouveau.');
  rememberImage(result.image);
  return { ...result.image, existante: result.existante, retires: result.retires };
}

// Les fiches des images d'un usage (« outil », « operation »), chargées une fois puis tenues à jour par rememberImage.
async function loadImages(usage) {
  if (state.images[usage] === null) {
    const response = await guarded(() => editorImages(usage));
    state.images[usage] = response?.images ?? [];
  }
  return state.images[usage];
}

// Une image téléversée entre dans le cache de son usage (ou le remplace, si elle y était).
function rememberImage(image) {
  const list = state.images[image.usage];
  if (list === null) return;
  const at = list.findIndex((known) => known.id === image.id);
  if (at < 0) list.push(image); else list[at] = image;
}

// Après une action de l'onglet Images, les caches sont oubliés : les galeries relisent la base.
const forgetImages = () => { state.images = { outil: null, operation: null }; };

// Un état par grandeur (D52) : une ligne par grandeur, trois boutons radio. Retourne { element, read() → { champs_evalues, champs_masques? } }.
function fieldStateChoice(draft) {
  const states = fieldStates(draft);
  const inputs = {};
  const element = el('ul', { class: 'choices choices--etats' }, FIELD_CHOICES.map(({ key, label }) => el('li', { class: 'etat-ligne' }, [
    el('span', { class: 'etat-nom' }, label),
    ...FIELD_STATES.map((state) => {
      const input = el('input', { id: `etat-${key}-${state.key}`, type: 'radio', name: `etat-${key}`, value: state.key, checked: states[key] === state.key });
      inputs[`${key}:${state.key}`] = input;
      return el('label', { for: `etat-${key}-${state.key}` }, [input, state.label]);
    }),
  ])));
  const read = () => statesToDraft(Object.fromEntries(FIELD_CHOICES.map(({ key }) => [key, FIELD_STATES.find((state) => inputs[`${key}:${state.key}`].checked)?.key ?? 'fournie'])));
  return { element, read };
}

// Une table de résultats d'aperçu.
function previewTable(response) {
  const columns = previewColumns(response.champs_evalues, response.champs_masques ?? []);
  const rows = previewRows(response.questions, response.champs_evalues, response.champs_masques ?? []);
  return el('div', { class: 'table-wrap' }, el('table', { class: 'prof-table apercu-table' }, [
    el('thead', {}, el('tr', {}, columns.map((label, i) => el('th', { class: i >= 4 ? 'num' : null }, label)))),
    el('tbody', {}, rows.map((row) => el('tr', {}, row.map((cell, i) => el('td', { class: i === 0 || i >= 4 ? 'num' : null }, cell))))),
  ]));
}

// --- Page d'un exercice (B3, B5, B6, B7) ---------------------------------------------------------------------------------

async function showExercise(id, notice = '') {
  const page = await guarded(() => editorGetExercise(id));
  if (page === null) return;
  const images = await loadImages('outil');
  if (images === null) return;
  const { tables } = page;
  const opsByName = new Map(tables.operations.operations.map((op) => [op.operation, op]));
  let { revision } = page.exercice;
  let copies = structuredClone(page.exercice.brouillon.outils);
  const openIds = new Set();
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  const generalErrors = el('ul', { class: 'editeur-erreurs' });
  const draft = page.exercice.brouillon;

  // Réglages généraux.
  const titre = el('input', { id: 'titre', type: 'text', autocomplete: 'off', value: draft.titre ?? '' });
  const fieldsChoice = fieldStateChoice(draft);
  // Grandeurs déductibles : un avertissement sous les états, sans effet sur Publier ; rafraîchi par validate().
  const warningsList = el('ul', { class: 'avertissements', id: 'grandeurs-deductibles' });
  const toolMaterials = toolMaterialNames(tables.materiaux); // celles de la version de tables de cet exercice (D62)
  applyTableColors(tables.materiaux);
  const materialsChoice = checkboxes('matiere', toolMaterials.map((key) => ({ key, label: key })), draft.materiaux_outil ?? toolMaterials, { inline: true, swatchOf: (label) => materialSwatch(label, tables.materiaux), buttons: true });
  const groupsChoice = checkboxes('groupe', tables.materiaux.groupes_iso.map((key) => ({ key, label: key })), draft.groupes ?? tables.materiaux.groupes_iso, { swatchOf: (group) => groupSwatch(group, tables.materiaux), buttons: true });
  const listed = el('input', { id: 'liste', type: 'checkbox', checked: draft.liste !== false });
  const settings = {
    titre: field('titre', 'Titre', titre, "Affiché à l'étudiant et sur l'attestation.", 'field--half'),
    champs_evalues: field('champs_evalues', 'Grandeurs : évaluée (à saisir), fournie (valeur montrée) ou masquée (« — », sans valeur)', el('div', {}, [fieldsChoice.element, warningsList]), 'Au moins une grandeur évaluée. Une grandeur masquée compte comme fournie pour la cohérence de Vf.', 'field--wide'),
    materiaux_outil: field('materiaux_outil', "Matières d'outil permises pour tout l'exercice", materialsChoice.element, 'Tout coché = aucune restriction ; se croise avec les matières de chaque outil.', 'field--wide'),
    groupes: field('groupes', 'Groupes de matériaux usinés permis pour tout l\'exercice', groupsChoice.element, 'Tout coché = aucune restriction ; se croise avec les groupes de chaque outil.', 'field--wide'),
    liste: field('liste', "Proposé dans la liste de l'accueil", el('label', { class: 'choices', for: 'liste' }, el('li', {}, el('label', { for: 'liste' }, [listed, 'oui (sinon, joignable seulement par son lien)']))), ''),
  };

  const toolsSlot = el('div');
  let forms = [];

  function readDraft() {
    const out = { titre: titre.value.trim(), ...fieldsChoice.read(), outils: forms.map((f) => f.read()) };
    const materials = materialsChoice.read();
    if (materials.length !== toolMaterials.length) out.materiaux_outil = materials;
    const groups = groupsChoice.read();
    if (groups.length !== tables.materiaux.groupes_iso.length) out.groupes = groups;
    if (!listed.checked) out.liste = false;
    for (const key of Object.keys(draft)) if (key.startsWith('_')) out[key] = draft[key];
    return out;
  }

  const publishButton = el('button', { class: 'button button--gold', type: 'button' }, 'Publier…');
  const saveButton = el('button', { class: 'button', type: 'button' }, 'Enregistrer le brouillon');

  // Validation continue (B5) : les erreurs sous leurs champs, le reste dans la liste générale, Publier désactivé s'il en reste.
  function validate() {
    const current = readDraft();
    const errors = draftErrors(current, tables);
    const known = (champ) => champ in settings || champ === 'champs_masques' || /^outils\.\d+\.[a-z_]+$/.test(champ);
    const map = errorsByField(errors, known);
    for (const [name, s] of Object.entries(settings)) {
      const messages = [...(map.get(name) ?? []), ...(name === 'champs_evalues' ? map.get('champs_masques') ?? [] : [])];
      s.element.setAttribute('data-erreur', messages.length > 0 ? 'true' : 'false');
      s.noteEl.textContent = messages.length > 0 ? messages.join('\n') : s.note;
    }
    forms.forEach((form, i) => {
      const local = new Map();
      for (const [key, messages] of map) if (key.startsWith(`outils.${i}.`)) local.set(key.slice(`outils.${i}.`.length), messages);
      form.setErrors(local);
      form.refreshExample();
      const count = [...local.values()].reduce((n, list) => n + list.length, 0);
      form.row.setAttribute('data-erreur', count > 0 ? 'true' : 'false');
      form.summaryErrors.textContent = count > 0 ? `${count} erreur${count > 1 ? 's' : ''}` : '';
      form.summaryName.textContent = `${form.fields.nom.control.value.trim() || '(sans nom)'} · ${form.fields.reussites_requises.control.value || '?'} réussite(s) de suite`;
      form.thumbnail.src = imageUrl(form.picker.read() ?? form.read().id);
    });
    generalErrors.replaceChildren(...(map.get('') ?? []).map((message) => el('li', {}, message)));
    warningsList.replaceChildren(...deducibleWarnings(current).map((line) => el('li', {}, line)));
    const ps = publishState(errors, versionDiff(page.derniere_version?.contenu ?? null, current, { avant: page.derniere_version?.tables_id ?? null, apres: page.exercice.tables_id }));
    publishButton.disabled = !ps.enabled;
    publishButton.textContent = ps.label;
    return { current, errors };
  }

  // La sélection (cases à cocher) survit aux re-rendus ; Retirer la sélection nomme les outils.
  const selected = new Set();
  const selectionButton = el('button', { class: 'button-small', type: 'button', disabled: true, onclick: () => {
    const chosen = forms.map((f) => f.read()).filter((c) => selected.has(c.id));
    if (chosen.length === 0 || !window.confirm(removeSelectionConfirmation(chosen))) return;
    copies = forms.map((f) => f.read()).filter((c) => !selected.has(c.id));
    selected.clear();
    touch();
    renderTools();
  } }, 'Retirer la sélection');
  const allBox = el('input', { id: 'outils-tous', type: 'checkbox', onchange: () => { forms.forEach((f) => { f.checkbox.checked = allBox.checked; if (allBox.checked) selected.add(f.read().id); else selected.delete(f.read().id); }); refreshSelection(); } });
  function refreshSelection() {
    selectionButton.disabled = selected.size === 0;
    selectionButton.textContent = selected.size === 0 ? 'Retirer la sélection' : `Retirer la sélection (${selected.size})`;
    allBox.checked = forms.length > 0 && forms.every((f) => f.checkbox.checked);
  }

  // Une ligne par copie : case, vignette, nom, erreurs, les boutons (sans déplier), puis le formulaire replié.
  function renderTools() {
    forms = copies.map((copy, i) => {
      const form = toolForm(copy, { tables, opsByName, images, copy: true, prefix: `o${i}` });
      form.summaryName = el('span', { class: 'muted' }, '');
      form.summaryErrors = el('span', { class: 'outil-erreurs' }, '');
      form.thumbnail = el('img', { class: 'outil-vignette', src: imageUrl(copy.image ?? copy.id), alt: '', onerror: () => { form.thumbnail.style.visibility = 'hidden'; } });
      form.checkbox = el('input', { type: 'checkbox', 'aria-label': `Sélectionner ${copy.id}`, checked: selected.has(copy.id), onchange: () => { if (form.checkbox.checked) selected.add(copy.id); else selected.delete(copy.id); refreshSelection(); } });
      const swap = (j) => { copies = forms.map((f) => f.read()); [copies[i], copies[j]] = [copies[j], copies[i]]; touch(); renderTools(); };
      const buttons = el('div', { class: 'outil-actions' }, [
        el('button', { class: 'button-small button-small--neutral', type: 'button', title: "Dupliquer dans l'exercice", onclick: () => { copies = forms.map((f) => f.read()); const twin = copyOfTool(copies[i], { id: freeId(copies[i].id, copies.map((c) => c.id)), reussites_requises: copies[i].reussites_requises }); copies.splice(i + 1, 0, twin); openIds.add(twin.id); touch(); renderTools(); } }, 'Dupliquer'),
        el('button', { class: 'button-small button-small--neutral', type: 'button', disabled: i === 0, title: 'Monter', onclick: () => swap(i - 1) }, '↑'),
        el('button', { class: 'button-small button-small--neutral', type: 'button', disabled: i === copies.length - 1, title: 'Descendre', onclick: () => swap(i + 1) }, '↓'),
        el('button', { class: 'button-small', type: 'button', onclick: () => { if (window.confirm(removeToolConfirmation(copy))) { copies = forms.map((f) => f.read()); copies.splice(i, 1); selected.delete(copy.id); touch(); renderTools(); } } }, 'Retirer'),
      ]);
      const body = el('div', { class: 'outil-corps', hidden: !openIds.has(copy.id) }, form.element);
      const toggle = el('button', { class: 'outil-toggle', type: 'button', 'aria-expanded': String(openIds.has(copy.id)), onclick: () => {
        body.hidden = !body.hidden;
        toggle.setAttribute('aria-expanded', String(!body.hidden));
        if (body.hidden) openIds.delete(copy.id); else openIds.add(copy.id);
      } }, [el('strong', {}, `${i + 1}. ${copy.id}`)]);
      form.row = el('div', { class: 'outil-ligne' }, [
        el('div', { class: 'outil-entete' }, [form.checkbox, form.thumbnail, toggle, form.summaryName, form.summaryErrors, buttons]),
        body,
      ]);
      return form;
    });
    toolsSlot.replaceChildren(
      forms.length === 0 ? el('p', { class: 'muted small' }, 'Aucun outil : ajoute-en depuis la banque ou depuis un autre exercice.') : el('div', { class: 'outil-selection' }, [el('label', { for: 'outils-tous' }, [allBox, 'Tout cocher']), selectionButton]),
      ...forms.map((f) => f.row),
    );
    refreshSelection();
    validate();
  }

  const touch = () => { state.dirty = true; };

  // Ajouter depuis la banque.
  const bank = await guarded(() => editorBank());
  if (bank === null) return;
  const available = bank.outils.filter((row) => row.archive_le === null);
  const bankSelect = el('select', { id: 'ajout-banque' }, available.map((row) => el('option', { value: row.id }, `${row.outil.nom} (${row.id})`)));
  const addFromBank = el('button', { class: 'button-outline', type: 'button', onclick: () => {
    const row = available.find((r) => r.id === bankSelect.value);
    if (!row) return;
    copies = forms.map((f) => f.read());
    const copy = copyOfTool(row.outil, { id: freeId(row.id, copies.map((c) => c.id)) });
    copies.push(copy);
    openIds.add(copy.id);
    touch();
    renderTools();
  } }, 'Ajouter depuis la banque');

  // Ajouter depuis un autre exercice : le brouillon de l'autre, chargé à la demande.
  const others = ((await guarded(() => editorListExercises())) ?? { exercices: [] }).exercices.filter((row) => row.id !== id);
  const otherSelect = el('select', { id: 'ajout-exercice' }, [el('option', { value: '' }, '(choisir un exercice)'), ...others.map((row) => el('option', { value: row.id }, row.titre))]);
  const otherToolSelect = el('select', { id: 'ajout-exercice-outil' }, [el('option', { value: '' }, '—')]);
  let otherCopies = [];
  otherSelect.addEventListener('change', async () => {
    otherCopies = otherSelect.value === '' ? [] : ((await guarded(() => editorGetExercise(otherSelect.value)))?.exercice.brouillon.outils ?? []);
    otherToolSelect.replaceChildren(...(otherCopies.length === 0 ? [el('option', { value: '' }, '—')] : otherCopies.map((c) => el('option', { value: c.id }, `${c.nom} (${c.id}), ${c.reussites_requises} réussite(s)`))));
  });
  const addFromOther = el('button', { class: 'button-outline', type: 'button', onclick: () => {
    const source = otherCopies.find((c) => c.id === otherToolSelect.value);
    if (!source) return;
    copies = forms.map((f) => f.read());
    const copy = copyOfTool(source, { id: freeId(source.id, copies.map((c) => c.id)), reussites_requises: source.reussites_requises });
    copies.push(copy);
    openIds.add(copy.id);
    touch();
    renderTools();
  } }, "Ajouter depuis l'exercice");

  // Enregistrer (B5) : contrôle de version optimiste.
  async function save() {
    const { current, errors } = validate();
    saveButton.disabled = true;
    try {
      const result = await guarded(() => editorSaveDraft(id, revision, current));
      if (result === null) return false;
      revision = result.revision;
      state.dirty = false;
      status.textContent = `Brouillon enregistré à ${formatDateStamp(new Date().toISOString()).slice(11)} (révision ${revision})${errors.length > 0 ? ` — ${errors.length} erreur(s) restent à corriger avant de publier` : ''}.`;
      return true;
    } catch (error) {
      if (error.status === 409) {
        status.replaceChildren(el('strong', {}, error.message), ' ', el('button', { class: 'button-link', type: 'button', onclick: () => { state.dirty = false; showExercise(id); } }, 'Recharger la page'));
      } else {
        status.textContent = serverErrorMessage(error);
      }
      return false;
    } finally {
      saveButton.disabled = false;
    }
  }
  saveButton.addEventListener('click', save);

  // Publier (B6) : enregistrer, résumer les différences, confirmer, créer la version.
  const dialogSlot = el('div');
  publishButton.addEventListener('click', async () => {
    if (!(await save())) return;
    const diff = versionDiff(page.derniere_version?.contenu ?? null, readDraft(), { avant: page.derniere_version?.tables_id ?? null, apres: page.exercice.tables_id });
    const numero = (page.derniere_version?.numero ?? 0) + 1;
    const confirm = el('button', { class: 'button button--gold', type: 'button', onclick: async () => {
      confirm.disabled = true;
      try {
        const result = await guarded(() => editorPublish(id, revision));
        if (result === null) return;
        state.dirty = false;
        showExercise(id, `Version ${result.numero} publiée le ${formatDateStamp(result.publiee_le)} : les nouvelles séances la prennent ; les séances en cours gardent la leur.`);
      } catch (error) {
        dialogSlot.replaceChildren();
        status.textContent = serverErrorMessage(error);
      }
    } }, `Publier la version ${numero}`);
    dialogSlot.replaceChildren(el('section', { class: 'panel panel--gold' }, [
      el('div', { class: 'eyebrow' }, 'Confirmation'),
      el('h2', {}, `Publier la version ${numero} de « ${readDraft().titre} » ?`),
      el('p', { class: 'small' }, page.derniere_version === null ? "Première publication : l'exercice devient accessible aux étudiants par son lien." : `Différences avec la version ${page.derniere_version.numero} :`),
      el('ul', { class: 'editeur-diff' }, diffLines(diff).map((line) => el('li', {}, line))),
      ...(deducibleWarnings(readDraft()).length > 0 ? [
        el('p', { class: 'small' }, "Avertissement, sans effet sur la publication : une grandeur à trouver se déduit des grandeurs fournies."),
        el('ul', { class: 'avertissements' }, deducibleWarnings(readDraft()).map((line) => el('li', {}, line))),
      ] : []),
      el('p', { class: 'muted smaller' }, `Cette version sera sur les tables de référence ${page.exercice.tables_id}. Les séances déjà commencées gardent leur version ; seules les nouvelles séances prennent celle-ci. Une version publiée ne se modifie plus.`),
      el('div', { class: 'form-actions' }, [confirm, el('button', { class: 'button-link', type: 'button', onclick: () => dialogSlot.replaceChildren() }, 'Annuler')]),
    ]));
    dialogSlot.scrollIntoView({ block: 'nearest' });
  });

  // Aperçu (B7) : dix questions du brouillon tel qu'il est à l'écran, ou d'une version.
  async function preview(body, label) {
    try {
      const result = await guarded(() => editorPreview({ id, ...body }));
      if (result === null) return;
      dialogSlot.replaceChildren(el('section', { class: 'panel' }, [
        el('div', { class: 'eyebrow' }, 'Aperçu'),
        el('h2', {}, `Dix questions tirées ${label}`),
        el('p', { class: 'muted small' }, 'Avec la nomenclature composée et les réponses attendues des grandeurs évaluées. Rien n\'est enregistré ; les étudiants ne voient jamais ces réponses.'),
        previewTable(result),
        el('div', { class: 'form-actions' }, [el('button', { class: 'button-outline', type: 'button', onclick: () => preview(body, label) }, 'Dix autres'), el('button', { class: 'button-link', type: 'button', onclick: () => dialogSlot.replaceChildren() }, 'Fermer')]),
      ]));
      dialogSlot.scrollIntoView({ block: 'nearest' });
    } catch (error) {
      status.textContent = error.status === 400 && error.details.erreurs ? "Le brouillon a des erreurs : corrige-les avant l'aperçu." : serverErrorMessage(error);
    }
  }

  // Une version plus récente des tables existe (D62) : le dire, et proposer d'y passer en montrant d'abord
  // ce que ça change pour cet exercice (erreurs qui apparaîtraient, Vc et avances de ses outils).
  const tablesAdvice = tablesNotice(page.exercice.tables_id, page.derniere_tables);
  const tablesNoticePanel = tablesAdvice === null ? el('div') : el('div', { class: 'avis-tables' }, [
    el('span', {}, tablesAdvice),
    el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: async () => {
      if (!(await save())) return;
      try {
        const { tables: newer } = await guarded(() => editorTablesVersion(page.derniere_tables)) ?? {};
        if (!newer) return;
        const impact = exerciseTablesImpact(readDraft(), tables, newer, draftErrors);
        const go = el('button', { class: 'button button--gold', type: 'button', onclick: async () => {
          go.disabled = true;
          try {
            const result = await guarded(() => editorExerciseTables(id, revision, newer.id));
            if (result === null) return;
            state.dirty = false;
            showExercise(id, `L'exercice est maintenant sur les tables ${result.tables_id}${result.erreurs.length > 0 ? ` — ${result.erreurs.length} erreur(s) à corriger avant de publier` : ''}.`);
          } catch (error) { dialogSlot.replaceChildren(); status.textContent = serverErrorMessage(error); }
        } }, `Passer à ${newer.id}`);
        dialogSlot.replaceChildren(el('section', { class: 'panel panel--gold' }, [
          el('div', { class: 'eyebrow' }, 'Changement de tables de référence'),
          el('h2', {}, `Passer cet exercice de ${page.exercice.tables_id} à ${newer.id} ?`),
          el('p', { class: 'small' }, impact.erreurs.length === 0 && impact.lignes.length === 0 ? 'Rien ne change pour cet exercice : ses outils tirent les mêmes valeurs dans les deux versions.' : 'Ce que ça change pour cet exercice :'),
          ...(impact.erreurs.length > 0 ? [el('p', { class: 'small' }, `${impact.erreurs.length} erreur${impact.erreurs.length > 1 ? 's' : ''} apparaîtrai${impact.erreurs.length > 1 ? 'en' : ''}t (à corriger avant de publier) :`), el('ul', { class: 'editeur-erreurs' }, impact.erreurs.map((line) => el('li', {}, line)))] : []),
          el('ul', { class: 'editeur-diff' }, impact.lignes.map((line) => el('li', {}, line))),
          el('p', { class: 'muted smaller' }, 'Le brouillon seul change de tables ; les versions publiées et les séances en cours gardent les leurs. La prochaine publication prendra ces tables.'),
          el('div', { class: 'form-actions' }, [go, el('button', { class: 'button-link', type: 'button', onclick: () => dialogSlot.replaceChildren() }, 'Annuler')]),
        ]));
        dialogSlot.scrollIntoView({ block: 'nearest' });
      } catch (error) { status.textContent = serverErrorMessage(error); }
    } }, `Passer à ${page.derniere_tables}…`),
  ]);

  const versionsList = el('ul', { class: 'versions-liste' }, page.versions.length === 0 ? [el('li', {}, 'Aucune version publiée : les étudiants ne voient pas encore cet exercice.')] : page.versions.map((v) => el('li', {}, [
    el('strong', {}, `Version ${v.numero}`), el('span', { class: 'muted' }, `publiée le ${formatDateStamp(v.publiee_le)} · tables ${v.tables_id} · ${v.seances} séance${v.seances > 1 ? 's' : ''}`),
    el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => preview({ version: v.numero }, `de la version ${v.numero}`) }, 'Aperçu'),
  ])));

  const screen = el('div', { class: 'screen screen--wide prof editeur', oninput: () => { touch(); validate(); }, onchange: () => { touch(); validate(); } }, [
    el('section', { class: 'panel' }, [
      panelHead(`exercice · ${id}`, 'exercices'),
      el('h1', { tabindex: '-1' }, draft.titre),
      el('div', { class: 'editeur-bar' }, [
        el('div', { class: 'muted small' }, [
          `Identifiant ${id} · lien étudiant : `, el('span', { class: 'mono' }, studentLink(location.origin, id)),
          page.exercice.archive_le !== null ? ' · archivé' : '',
          ` · brouillon modifié le ${formatDateStamp(page.exercice.brouillon_modifie_le)}`,
          ' · tables de référence ', el('strong', { class: 'tables-version' }, page.exercice.tables_id),
        ]),
        el('div', { class: 'editeur-bar-actions' }, [
          el('button', { class: 'button-link', type: 'button', onclick: () => leave(showList) }, '← Exercices'),
          el('button', { class: 'button-outline', type: 'button', onclick: () => preview({ brouillon: readDraft() }, 'du brouillon') }, 'Aperçu du brouillon'),
          saveButton,
          publishButton,
        ]),
      ]),
      status,
      tablesNoticePanel,
      generalErrors,
      dialogSlot,
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, 'Réglages généraux'),
      el('div', { class: 'editeur-grid' }, Object.values(settings).map((s) => s.element)),
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, "Outils de l'exercice"),
      el('p', { class: 'muted small' }, "Chaque outil est une copie indépendante de la banque : ses dimensions, matières et groupes sont ce que l'exercice permet. Modifier la banque ne change pas cet exercice."),
      toolsSlot,
      el('div', { class: 'ajout-outil' }, [
        el('div', { class: 'field' }, [el('label', { for: 'ajout-banque' }, 'Depuis la banque'), bankSelect]),
        addFromBank,
      ]),
      el('div', { class: 'ajout-outil' }, [
        el('div', { class: 'field' }, [el('label', { for: 'ajout-exercice' }, 'Depuis un autre exercice'), otherSelect]),
        el('div', { class: 'field' }, [el('label', { for: 'ajout-exercice-outil' }, 'Outil'), otherToolSelect]),
        addFromOther,
      ]),
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, 'Versions publiées'),
      versionsList,
    ]),
  ]);
  renderTools();
  showScreen(main, screen, { title: TITLE, aside: headerAside() }, 'h1');
}

// --- Banque d'outils (B4) -----------------------------------------------------------------------------------------

async function showBank(notice = '') {
  const bank = await guarded(() => editorBank());
  if (bank === null) return;
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  const act = async (action, success) => {
    try { await guarded(action); await showBank(success); } catch (error) { status.textContent = serverErrorMessage(error); }
  };
  const rows = bank.outils.map((row) => el('tr', {}, [
    el('td', {}, el('button', { class: 'button-link', type: 'button', onclick: () => leave(showBankTool, row.id) }, row.outil.nom)),
    el('td', { class: 'mono' }, row.id),
    el('td', {}, row.outil.operation),
    el('td', { class: 'num' }, String(row.outil.dimensions.length)),
    el('td', {}, row.exercices.length === 0 ? 'aucun' : `${row.exercices.length} (${row.exercices.join(', ')})`),
    el('td', { class: row.archive_le === null ? '' : 'state--running' }, row.archive_le === null ? 'disponible' : `archivé le ${formatDateStamp(row.archive_le)}`),
    el('td', { class: 'actions' }, el('div', { class: 'actions-group' }, [
      el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => leave(showBankTool, row.id) }, 'Ouvrir'),
      el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => {
        const id = window.prompt(`Identifiant du nouvel outil (minuscules, chiffres, soulignés), copie de « ${row.outil.nom} » :`, `${row.id}_2`);
        if (id) act(() => editorBankCreate({ id: id.trim(), depuis: row.id }), `« ${row.outil.nom} » dupliqué sous « ${id.trim()} ».`);
      } }, 'Dupliquer'),
      row.archive_le === null
        ? el('button', { class: 'button-small', type: 'button', onclick: () => { if (window.confirm(`Archiver « ${row.outil.nom} » ? Il ne sera plus proposé à l'ajout dans un exercice ; les copies déjà faites ne changent pas.`)) act(() => editorBankArchive(row.id, true), `« ${row.outil.nom} » archivé.`); } }, 'Archiver')
        : el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => act(() => editorBankArchive(row.id, false), `« ${row.outil.nom} » rétabli.`) }, 'Rétablir'),
    ])),
  ]));
  const idInput = el('input', { id: 'nouvel-outil', type: 'text', autocomplete: 'off', placeholder: 'fraise_a_rainurer' });
  const blank = { nom: 'Nouvel outil', format_identifiant: '[NomOutil] [IdDia]', commentaire: '', operation: bank.tables.operations.operations[0].operation, fact_vc: 1, fact_av: 1, limite_rpm: 10000, limite_avance: null, nb_dents_min: 1, nb_dents_max: 1, materiaux_outil: ['Acier rapide'], groupes_materiaux_usinables: [bank.tables.materiaux.groupes_iso[0]], image: null, dimensions: [{ libelle: 'Ø 1/4 po', valeur: 0.25 }] };
  const screen = el('div', { class: 'screen screen--wide prof editeur' }, el('section', { class: 'panel' }, [
    panelHead("banque d'outils", 'banque'),
    el('h1', { tabindex: '-1' }, "Banque d'outils"),
    el('p', { class: 'muted small' }, "Les outils qu'on copie dans un exercice. Modifier un outil ici ne change aucun exercice existant ; le nombre d'exercices est donné à titre d'information."),
    status,
    el('div', { class: 'table-wrap' }, el('table', { class: 'prof-table' }, [
      el('thead', {}, el('tr', {}, ['Nom', 'Identifiant', 'Opération', 'Dimensions', 'Exercices qui en ont une copie', 'État', 'Actions'].map((label) => el('th', {}, label)))),
      el('tbody', {}, rows),
    ])),
    el('p', { class: 'muted smaller prof-count' }, `${rows.length} outil${rows.length > 1 ? 's' : ''}.`),
    el('form', { class: 'ajout-outil', novalidate: true, onsubmit: (event) => { event.preventDefault(); act(() => editorBankCreate({ id: idInput.value.trim(), outil: { ...blank, id: idInput.value.trim() } }), 'Outil créé : ouvre-le pour le compléter.'); } }, [
      el('div', { class: 'field' }, [el('label', { for: 'nouvel-outil' }, 'Nouvel outil : identifiant'), idInput, el('div', { class: 'field-note' }, 'Minuscules, chiffres et soulignés ; définitif.')]),
      el('button', { class: 'button-outline', type: 'submit' }, 'Créer un outil'),
    ]),
  ]));
  showScreen(main, screen, { title: TITLE, aside: headerAside() }, 'h1');
}

async function showBankTool(id, notice = '') {
  const bank = await guarded(() => editorBank());
  if (bank === null) return;
  const row = bank.outils.find((r) => r.id === id);
  if (!row) { showBank(`L'outil « ${id} » n'existe pas.`); return; }
  const images = await loadImages('outil');
  if (images === null) return;
  const { tables } = bank;
  const opsByName = new Map(tables.operations.operations.map((op) => [op.operation, op]));
  let { revision } = row;
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  applyTableColors(tables.materiaux);
  const form = toolForm(row.outil, { tables, opsByName, images, copy: false, prefix: 'b' });
  const generalErrors = el('ul', { class: 'editeur-erreurs' });

  // Validation continue : la règle du catalogue (toolErrors, par validateData), sans le reste du catalogue.
  function validate() {
    const tool = form.read();
    const errors = draftErrors({ titre: 'x', champs_evalues: ['vc'], outils: [{ ...tool, reussites_requises: 1 }] }, tables).map((e) => ({ champ: e.champ.replace(/^outils\.0\./, ''), message: e.message }));
    const map = errorsByField(errors, (champ) => champ in form.fields);
    form.setErrors(map);
    form.refreshExample();
    generalErrors.replaceChildren(...(map.get('') ?? []).map((message) => el('li', {}, message)));
    return tool;
  }

  const saveButton = el('button', { class: 'button', type: 'button', onclick: async () => {
    const tool = validate();
    saveButton.disabled = true;
    try {
      const result = await guarded(() => editorBankSave(id, revision, tool));
      if (result === null) return;
      revision = result.revision;
      state.dirty = false;
      status.textContent = `Outil enregistré (révision ${revision})${result.erreurs.length > 0 ? ` — ${result.erreurs.length} erreur(s) : cet outil ne pourra pas être ajouté à un exercice tant qu'elles restent` : ''}.`;
    } catch (error) {
      if (error.status === 409) status.replaceChildren(el('strong', {}, error.message), ' ', el('button', { class: 'button-link', type: 'button', onclick: () => { state.dirty = false; showBankTool(id); } }, 'Recharger la page'));
      else status.textContent = serverErrorMessage(error);
    } finally {
      saveButton.disabled = false;
    }
  } }, "Enregistrer l'outil");

  const screen = el('div', { class: 'screen screen--wide prof editeur', oninput: () => { state.dirty = true; validate(); }, onchange: () => { state.dirty = true; validate(); } }, el('section', { class: 'panel' }, [
    panelHead(`banque · ${id}`, 'banque'),
    el('h1', { tabindex: '-1' }, row.outil.nom),
    el('div', { class: 'editeur-bar' }, [
      el('div', { class: 'muted small' }, `Identifiant ${id} · ${row.exercices.length === 0 ? "copié dans aucun exercice" : `copié dans : ${row.exercices.join(', ')}`} (les copies ne suivent pas)${row.archive_le === null ? '' : ' · archivé'}`),
      el('div', { class: 'editeur-bar-actions' }, [el('button', { class: 'button-link', type: 'button', onclick: () => leave(showBank) }, '← Banque'), saveButton]),
    ]),
    status,
    generalErrors,
    form.element,
  ]));
  validate();
  showScreen(main, screen, { title: TITLE, aside: headerAside() }, 'h1');
}

// --- Sauvegarde (B8) : export JSON, import avec validation puis confirmation -------------------------------------------

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const link = el('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function showBackup(notice = '') {
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  const summary = el('div');
  let received = null; // l'export lu, tel quel (avec le contenu des images)
  let fiches = null; // le même export sans le contenu des images : ce que valider et importer reçoivent (D59)
  let resume = null; // le résumé de la validation : dit quel mot la confirmation exige (D50) et quelles images manquent (D59)
  const importButton = el('button', { class: 'button button--wrong', type: 'button', disabled: true, onclick: async () => {
    const word = importWordFor(resume);
    const warning = resume.banque.retires.length > 0 ? `${resume.banque.retires.length} outil(s) de la banque disparaîtront : ${resume.banque.retires.map((t) => t.nom).join(', ')}. ` : '';
    if (window.prompt(`${warning}Pour importer, tape ${word} :`) !== word) return;
    importButton.disabled = true;
    try {
      // D'abord les images que la base n'a pas, une par requête, pour rester sous la limite ; puis l'import lui-même.
      const missing = (received.images ?? []).filter((image) => resume.images_manquantes.includes(image.id));
      for (const [i, image] of missing.entries()) {
        status.textContent = `Envoi de l'image ${i + 1} sur ${missing.length} : « ${image.nom} »…`;
        if ((await guarded(() => editorImageImport(image))) === null) return;
      }
      status.textContent = missing.length > 0 ? `${missing.length} image(s) envoyée(s) ; import en cours…` : 'Import en cours…';
      const result = await guarded(() => editorImport(fiches, word));
      if (result === null) return;
      forgetImages();
      showBackup(`Import terminé : ${importSummaryLines(result.resume).slice(0, 6).join(' ')}`);
    } catch (error) {
      status.textContent = error.status === 400 && error.details.erreurs ? `Rien n'a été importé : ${error.details.erreurs.join(' ; ')}` : serverErrorMessage(error);
      importButton.disabled = false;
    }
  } }, 'Importer');
  const fileInput = el('input', { id: 'fichier', type: 'file', accept: 'application/json,.json', onchange: async () => {
    received = null;
    fiches = null;
    resume = null;
    importButton.disabled = true;
    summary.replaceChildren();
    const [file] = fileInput.files;
    if (!file) return;
    try {
      received = JSON.parse(await file.text());
      fiches = received !== null && typeof received === 'object' && Array.isArray(received.images) ? { ...received, images: received.images.map(({ contenu, ...fiche }) => fiche) } : received;
      const result = await guarded(() => editorImportValidate(fiches));
      if (result === null) return;
      summary.replaceChildren(
        result.erreurs.length > 0 ? el('ul', { class: 'editeur-erreurs' }, result.erreurs.map((e) => el('li', {}, e))) : '',
        result.erreurs.length === 0 ? el('ul', { class: 'editeur-diff' }, importSummaryLines(result.resume).map((line) => el('li', {}, line))) : el('p', { class: 'small' }, "L'export a des erreurs : rien ne sera importé."),
      );
      resume = result.resume;
      importButton.disabled = result.erreurs.length > 0;
      importButton.textContent = result.erreurs.length === 0 && result.resume.banque.retires.length > 0 ? 'Importer et remplacer la banque' : 'Importer';
    } catch (error) {
      summary.replaceChildren(el('p', { class: 'small' }, error.status === undefined ? "Ce fichier n'est pas un JSON lisible." : serverErrorMessage(error)));
    }
  } });

  const screen = el('div', { class: 'screen screen--narrow prof editeur' }, el('section', { class: 'panel' }, [
    panelHead('sauvegarde', 'sauvegarde'),
    el('h1', { tabindex: '-1' }, 'Sauvegarde'),
    el('p', { class: 'small' }, "L'export contient la banque d'outils, les exercices avec leurs brouillons et toutes leurs versions, les tables de référence et les images (photos et pictogrammes) — jamais de données d'étudiants. L'import fusionne un export dans la base : il ajoute ce qui manque (les images absentes sont envoyées une à une, avant le reste), remplace les brouillons et la banque, ne supprime jamais une version publiée et ne touche ni aux séances ni aux attestations."),
    status,
    el('ol', { class: 'sauvegarde-etapes' }, [
      el('li', {}, [el('div', {}, 'Exporter tout en JSON, à garder en lieu sûr (par exemple avant une grosse retouche).'), el('p', {}, el('button', { class: 'button-outline', type: 'button', onclick: async () => {
        try {
          const data = await guarded(() => editorExport());
          if (data !== null) download(exportFileName(new Date()), JSON.stringify(data, null, 2));
        } catch (error) { status.textContent = serverErrorMessage(error); }
      } }, 'Exporter tout en JSON'))]),
      el('li', {}, [el('div', {}, "Importer un export : il est d'abord validé et résumé ; rien n'est écrit avant la confirmation."), el('div', { class: 'field' }, [el('label', { for: 'fichier' }, 'Fichier JSON'), fileInput]), summary, el('div', { class: 'form-actions' }, importButton)]),
    ]),
  ]));
  showScreen(main, screen, { title: TITLE, aside: headerAside() }, 'h1');
}

// --- Tables de référence (D61 à D63) : le brouillon unique, sa publication, l'aperçu, les versions ------------------------

// Un champ de tableau : une case de saisie compacte (texte, nombre, couleur, case à cocher, liste).
function cell(input, className = '') {
  return el('td', { class: className || null }, input);
}
const textInput = (id, value, attrs = {}) => el('input', { id, type: 'text', autocomplete: 'off', value: value === null || value === undefined ? '' : String(value), ...attrs });
const colorInput = (id, value) => el('input', { id, type: 'color', value: /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value).toLowerCase() : '#000000' });
const readNum = (input) => { const text = input.value.trim().replace(',', '.'); return text === '' ? null : (Number.isFinite(Number(text)) ? Number(text) : text); };
// La valeur d'une case texte qui peut être un nombre (dureté, exemple) : nombre si ça en est un, sinon le texte, null si vide.
const readMixed = (input) => { const text = input.value.trim(); if (text === '') return null; const n = Number(text.replace(',', '.')); return Number.isFinite(n) && /^[\d.,-]+$/.test(text) ? n : text; };

// Une liste de lignes éditables (classes, matériaux, opérations) : construire une ligne, la lire, monter, descendre, retirer, ajouter.
//   rows : les objets de départ ; build(row, i) → { tr, read() } ; blank() → un objet neuf ; onChange : après un mouvement
function editableRows(rows, build, blank, onChange) {
  let items = rows.map((row) => structuredClone(row));
  let built = [];
  const body = el('tbody');
  function render() {
    built = items.map((row, i) => {
      const { tr, read } = build(row, i);
      tr.append(el('td', { class: 'actions' }, el('div', { class: 'actions-group' }, [
        el('button', { class: 'button-small button-small--neutral', type: 'button', disabled: i === 0, title: 'Monter', onclick: () => { items = built.map((b) => b.read()); [items[i - 1], items[i]] = [items[i], items[i - 1]]; render(); onChange(); } }, '↑'),
        el('button', { class: 'button-small button-small--neutral', type: 'button', disabled: i === items.length - 1, title: 'Descendre', onclick: () => { items = built.map((b) => b.read()); [items[i], items[i + 1]] = [items[i + 1], items[i]]; render(); onChange(); } }, '↓'),
        el('button', { class: 'button-small', type: 'button', title: 'Retirer', onclick: () => { items = built.map((b) => b.read()); items.splice(i, 1); render(); onChange(); } }, 'Retirer'),
      ])));
      return { tr, read };
    });
    body.replaceChildren(...built.map((b) => b.tr));
  }
  render();
  return {
    body,
    read: () => built.map((b) => b.read()),
    add: (after = null) => { items = built.map((b) => b.read()); const at = after === null ? items.length : after + 1; items.splice(at, 0, blank(items[after] ?? items.at(-1) ?? null)); render(); onChange(); },
  };
}

async function showTables(notice = '') {
  const page = await guarded(() => editorTables());
  if (page === null) return;
  const pictos = await loadImages('operation');
  if (pictos === null) return;
  const exercises = (await guarded(() => editorListExercises()))?.exercices ?? [];
  let { revision } = page.brouillon;
  const draft = page.brouillon.contenu;
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  const errorsList = el('ul', { class: 'editeur-erreurs' });
  const dialogSlot = el('div');
  const touch = () => { state.dirty = true; };

  // --- Classes ISO : code, nom, trois couleurs.
  const classes = editableRows(draft.materiaux.classes_iso, (c, i) => {
    const code = textInput(`cl-${i}-code`, c.code, { maxlength: '1', class: 'input-court mono' });
    const nom = textInput(`cl-${i}-nom`, c.nom);
    const couleur = colorInput(`cl-${i}-couleur`, c.couleur);
    const texte = colorInput(`cl-${i}-texte`, c.couleur_texte);
    const ligne = colorInput(`cl-${i}-ligne`, c.couleur_ligne);
    const swatch = el('span', { class: 'choice-swatch', 'aria-hidden': 'true' }, c.code);
    const paint = () => { swatch.style.background = couleur.value; swatch.style.color = texte.value; swatch.textContent = code.value.toUpperCase(); };
    for (const input of [code, couleur, texte]) input.addEventListener('input', paint);
    paint();
    return {
      tr: el('tr', {}, [cell(swatch, 'num'), cell(code), cell(nom), cell(couleur), cell(texte), cell(ligne)]),
      read: () => ({ code: code.value.trim().toUpperCase(), nom: nom.value.trim(), couleur: couleur.value, couleur_texte: texte.value, couleur_ligne: ligne.value }),
    };
  }, () => ({ code: '', nom: '', couleur: '#808080', couleur_texte: '#ffffff', couleur_ligne: '#eeeeee' }), () => { touch(); validate(); });

  // --- Matières d'outil : clé fixe, nom, couleur.
  const toolMaterialRows = draft.materiaux.materiaux_outil.map((m, i) => {
    const nom = textInput(`mo-${i}-nom`, m.nom);
    const couleur = colorInput(`mo-${i}-couleur`, m.couleur);
    return { tr: el('tr', {}, [cell(el('span', { class: 'mono smaller' }, m.cle)), cell(nom), cell(couleur)]), read: () => ({ cle: m.cle, nom: nom.value.trim(), couleur: couleur.value }) };
  });

  // --- Matériaux usinés : une ligne par groupe.
  const classCodes = () => classes.read().map((c) => c.code).filter((c) => c !== '');
  const materials = editableRows(draft.materiaux.materiaux, (m, i) => {
    const iso = el('select', { id: `ma-${i}-iso` }, [...new Set([...classCodes(), m.iso])].filter(Boolean).map((code) => el('option', { value: code, selected: code === m.iso }, code)));
    const groupe = textInput(`ma-${i}-groupe`, m.groupe, { inputmode: 'numeric', class: 'input-court' });
    const materiau = textInput(`ma-${i}-materiau`, m.materiau);
    const composition = textInput(`ma-${i}-composition`, m.composition);
    const etat = textInput(`ma-${i}-etat`, m.etat);
    const durete = textInput(`ma-${i}-durete`, m.durete, { class: 'input-court' });
    const exemple = textInput(`ma-${i}-exemple`, m.exemple, { class: 'input-moyen' });
    const vc = toolMaterialRows.map((row, j) => textInput(`ma-${i}-vc-${j}`, m.vc_pi_min?.[row.read().cle], { inputmode: 'decimal', class: 'input-court mono' }));
    const famille = el('input', { id: `ma-${i}-famille`, type: 'checkbox', checked: m.debut_famille === true, title: 'Début de famille : un trait fin au-dessus de cette ligne dans la feuille' });
    return {
      tr: el('tr', { class: m.debut_famille === true ? 'ligne-famille' : null }, [cell(iso), cell(groupe, 'num'), cell(materiau), cell(composition), cell(etat), cell(durete, 'num'), cell(exemple), ...vc.map((input) => cell(input, 'num')), cell(famille, 'num')]),
      read: () => {
        const out = { iso: iso.value, groupe: readNum(groupe), materiau: materiau.value.trim(), composition: readMixed(composition), etat: readMixed(etat), durete: readMixed(durete), exemple: readMixed(exemple), vc_pi_min: Object.fromEntries(toolMaterialRows.map((row, j) => [row.read().cle, readNum(vc[j])])) };
        if (famille.checked) out.debut_famille = true;
        for (const key of Object.keys(m)) if (!(key in out) && key !== 'debut_famille') out[key] = m[key]; // ce qu'on ne montre pas est gardé
        return out;
      },
    };
  }, (previous) => ({ iso: previous?.iso ?? 'P', groupe: (Number(previous?.groupe) || 0) + 1, materiau: previous?.materiau ?? '', composition: null, etat: null, durete: null, exemple: null, vc_pi_min: Object.fromEntries(toolMaterialRows.map((row) => [row.read().cle, null])) }), () => { touch(); validate(); });

  // --- Opérations : nom, machine, direction, famille d'avance, avances, pictogramme (galerie).
  const operations = editableRows(draft.operations.operations, (op, i) => {
    const nom = textInput(`op-${i}-nom`, op.operation);
    const machine = textInput(`op-${i}-machine`, op.machine);
    const direction = textInput(`op-${i}-direction`, op.direction_avance);
    const famille = el('select', { id: `op-${i}-famille` }, FEED_FAMILIES.map((f) => el('option', { value: f.key, selected: f.key === feedFamilyOf(op) }, f.label)));
    const avance = textInput(`op-${i}-avance`, op.avance_po_rev, { inputmode: 'decimal', class: 'input-court mono' });
    const avanceMax = textInput(`op-${i}-avance-max`, op.avance_max_po_rev, { inputmode: 'decimal', class: 'input-court mono' });
    const refreshFeeds = () => { const thread = famille.value === 'filetage'; avance.disabled = thread; avanceMax.disabled = thread; };
    famille.addEventListener('change', refreshFeeds);
    refreshFeeds();
    const picker = imagePicker({ usage: 'operation', images: state.images.operation, value: op.pictogramme ?? null, upload: (file) => uploadImage(file, 'operation'), onChange: () => { touch(); validate(); }, idPrefix: `op-${i}-picto`, compact: true });
    return {
      tr: el('tr', {}, [cell(nom), cell(machine), cell(direction), cell(famille), cell(avance, 'num'), cell(avanceMax, 'num'), cell(picker.element, 'picto-cell')]),
      read: () => {
        const flags = feedFamilyFlags(famille.value);
        const out = { operation: nom.value.trim(), machine: machine.value.trim(), direction_avance: direction.value.trim(), avance_po_rev: flags.avance_egale_pas_filetage ? null : readNum(avance), avance_max_po_rev: flags.avance_egale_pas_filetage ? null : readNum(avanceMax), ...flags };
        const picto = picker.read();
        if (picto !== null) out.pictogramme = picto;
        for (const key of Object.keys(op)) if (!(key in out) && key !== 'pictogramme') out[key] = op[key];
        return out;
      },
    };
  }, (previous) => ({ operation: '', machine: previous?.machine ?? 'Tour', direction_avance: previous?.direction_avance ?? 'Avance longitudinale', avance_po_rev: 0.005, avance_max_po_rev: 0.005, avance_egale_pas_filetage: false, avance_proportionnelle_diametre: false }), () => { touch(); validate(); });

  // Le brouillon tel qu'à l'écran : les groupes ISO sont dérivés des lignes ; les commentaires « _… » et la révision sont gardés.
  function readTables() {
    const rows = materials.read();
    const keep = (source, out) => { for (const key of Object.keys(source)) if (key.startsWith('_')) out[key] = source[key]; return out; };
    return {
      materiaux: keep(draft.materiaux, { revision: draft.materiaux.revision, classes_iso: classes.read(), materiaux_outil: toolMaterialRows.map((r) => r.read()), groupes_iso: deriveGroups(rows), materiaux: rows }),
      operations: keep(draft.operations, { revision: draft.operations.revision, operations: operations.read() }),
    };
  }

  const saveButton = el('button', { class: 'button', type: 'button' }, 'Enregistrer le brouillon');
  const publishButton = el('button', { class: 'button button--gold', type: 'button' }, 'Publier…');
  function validate() {
    const current = readTables();
    const errors = validateTables(current);
    errorsList.replaceChildren(...errors.map((message) => el('li', {}, message)));
    publishButton.disabled = errors.length > 0;
    publishButton.textContent = errors.length > 0 ? `Publier (${errors.length} erreur${errors.length > 1 ? 's' : ''} à corriger)` : 'Publier…';
    applyTableColors(current.materiaux); // les couleurs de l'écran suivent le brouillon
    return { current, errors };
  }

  async function save() {
    const { current, errors } = validate();
    saveButton.disabled = true;
    try {
      const result = await guarded(() => editorTablesSave(revision, current));
      if (result === null) return false;
      revision = result.revision;
      state.dirty = false;
      status.textContent = `Brouillon des tables enregistré à ${formatDateStamp(new Date().toISOString()).slice(11)} (révision ${revision})${errors.length > 0 ? ` — ${errors.length} erreur(s) restent à corriger avant de publier` : ''}.`;
      return true;
    } catch (error) {
      if (error.status === 409) status.replaceChildren(el('strong', {}, error.message), ' ', el('button', { class: 'button-link', type: 'button', onclick: () => { state.dirty = false; showTables(); } }, 'Recharger la page'));
      else status.textContent = serverErrorMessage(error);
      return false;
    } finally {
      saveButton.disabled = false;
    }
  }
  saveButton.addEventListener('click', save);

  // Publier : enregistrer, montrer les différences avec la version dont le brouillon est parti, saisir la révision, confirmer.
  publishButton.addEventListener('click', async () => {
    if (!(await save())) return;
    try {
      const previous = page.brouillon.base_id === null ? null : (await guarded(() => editorTablesVersion(page.brouillon.base_id)))?.tables;
      const lines = previous ? tablesDiff(previous, readTables()) : ['Première version des tables.'];
      const idInput = el('input', { id: 'tables-revision', type: 'text', autocomplete: 'off', spellcheck: 'false', value: page.suggestion, class: 'mono' });
      const confirm = el('button', { class: 'button button--gold', type: 'button', onclick: async () => {
        confirm.disabled = true;
        try {
          const result = await guarded(() => editorTablesPublish(revision, idInput.value.trim()));
          if (result === null) return;
          state.dirty = false;
          showTables(`Version ${result.id} des tables publiée le ${formatDateStamp(result.publiee_le)} : les exercices y passent un à un, depuis leur page ; les séances en cours gardent leurs tables.`);
        } catch (error) {
          confirm.disabled = false;
          status.textContent = serverErrorMessage(error);
        }
      } }, 'Publier cette version');
      dialogSlot.replaceChildren(el('section', { class: 'panel panel--gold' }, [
        el('div', { class: 'eyebrow' }, 'Confirmation'),
        el('h2', {}, previous ? `Publier une nouvelle version des tables, depuis ${previous.id} ?` : 'Publier la première version des tables ?'),
        el('p', { class: 'small' }, lines.length === 0 ? 'Aucune différence avec la version précédente : rien à publier.' : `Différences avec ${previous?.id ?? '—'} (${lines.length}) :`),
        el('ul', { class: 'editeur-diff' }, lines.map((line) => el('li', {}, line))),
        el('div', { class: 'field field--half' }, [el('label', { for: 'tables-revision' }, 'Révision de cette version'), idInput, el('div', { class: 'field-note' }, `Suggérée : ${page.suggestion}. Unique ; inscrite au pied des feuilles et sur les attestations. Lettres, chiffres, « _ », « . », « - ».`)]),
        el('p', { class: 'muted smaller' }, 'Une version publiée ne se modifie plus. Aucun exercice ne change de tables tout seul : chaque exercice y passe depuis sa page, et ses séances en cours gardent les leurs.'),
        el('div', { class: 'form-actions' }, [confirm, el('button', { class: 'button-link', type: 'button', onclick: () => dialogSlot.replaceChildren() }, 'Annuler')]),
      ]));
      dialogSlot.scrollIntoView({ block: 'nearest' });
    } catch (error) { status.textContent = serverErrorMessage(error); }
  });

  // Aperçu : dix questions d'un exercice avec les tables telles qu'à l'écran (D63).
  const previewSelect = el('select', { id: 'apercu-exercice' }, exercises.map((e) => el('option', { value: e.id }, e.titre)));
  async function preview() {
    const exercice = previewSelect.value;
    if (!exercice) return;
    try {
      const result = await guarded(() => editorTablesPreview(readTables(), exercice));
      if (result === null) return;
      dialogSlot.replaceChildren(el('section', { class: 'panel' }, [
        el('div', { class: 'eyebrow' }, 'Aperçu'),
        el('h2', {}, `Dix questions de « ${exercises.find((e) => e.id === exercice)?.titre ?? exercice} » avec ces tables`),
        el('p', { class: 'muted small' }, "Le brouillon de l'exercice, tiré avec le brouillon des tables tel qu'il est à l'écran. Rien n'est enregistré."),
        previewTable(result),
        el('div', { class: 'form-actions' }, [el('button', { class: 'button-outline', type: 'button', onclick: preview }, 'Dix autres'), el('button', { class: 'button-link', type: 'button', onclick: () => dialogSlot.replaceChildren() }, 'Fermer')]),
      ]));
      dialogSlot.scrollIntoView({ block: 'nearest' });
    } catch (error) {
      status.textContent = error.status === 400 ? error.message : serverErrorMessage(error);
    }
  }

  const versionsList = el('ul', { class: 'versions-liste' }, page.versions.map((v) => el('li', {}, [
    el('strong', {}, v.id), el('span', { class: 'muted' }, `publiée le ${formatDateStamp(v.creee_le)} · ${tablesUsageLabel(v.utilisations)}`),
    el('a', { class: 'button-small button-small--neutral', href: `/tables?version=${encodeURIComponent(v.id)}`, target: '_blank', rel: 'noopener' }, 'Feuilles imprimables'),
  ])));

  const table = (headers, body, className = '') => el('div', { class: 'table-wrap' }, el('table', { class: `prof-table tables-edit ${className}`.trim() }, [el('thead', {}, el('tr', {}, [...headers, 'Actions'].map((h) => el('th', {}, h)))), body]));
  const screen = el('div', { class: 'screen screen--wide prof editeur', oninput: () => { touch(); validate(); }, onchange: () => { touch(); validate(); } }, [
    el('section', { class: 'panel' }, [
      panelHead('tables de référence', 'tables'),
      el('h1', { tabindex: '-1' }, 'Tables de référence'),
      el('p', { class: 'muted small' }, "Un seul brouillon, modifiable ; des versions publiées immuables, chacune avec sa révision. Une version publiée ne change aucun exercice tout seul : chaque exercice choisit sa version de tables depuis sa page, et une séance commencée garde celles de sa version d'exercice."),
      el('div', { class: 'editeur-bar' }, [
        el('div', { class: 'muted small' }, [`Brouillon parti de la version ${page.brouillon.base_id ?? '—'} · modifié le ${formatDateStamp(page.brouillon.modifie_le)}`, page.modifie ? ' · différent de cette version' : ' · identique à cette version']),
        el('div', { class: 'editeur-bar-actions' }, [
          el('label', { for: 'apercu-exercice', class: 'muted small' }, 'Aperçu avec :'), previewSelect,
          el('button', { class: 'button-outline', type: 'button', onclick: preview }, 'Dix questions'),
          saveButton,
          publishButton,
        ]),
      ]),
      status,
      errorsList,
      dialogSlot,
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, 'Classes ISO'),
      el('p', { class: 'muted small' }, 'La lettre de classe, son nom, et ses couleurs : celle de la lettre et du panneau du matériau brut, celle du texte posé dessus, la teinte de ligne dans la feuille des vitesses de coupe.'),
      table(['', 'Code', 'Nom', 'Couleur', 'Texte', 'Ligne'], classes.body),
      el('div', { class: 'form-actions' }, el('button', { class: 'button-outline', type: 'button', onclick: () => classes.add() }, 'Ajouter une classe')),
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, "Matières d'outil"),
      el('p', { class: 'muted small' }, "Les trois colonnes de la table des vitesses de coupe. Renommer une matière oblige à renommer la matière dans chaque outil qui la nomme : les exercices le signaleront."),
      el('div', { class: 'table-wrap' }, el('table', { class: 'prof-table tables-edit' }, [el('thead', {}, el('tr', {}, ['Clé', 'Nom', 'Couleur'].map((h) => el('th', {}, h)))), el('tbody', {}, toolMaterialRows.map((r) => r.tr))])),
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, 'Matériaux usinés'),
      el('p', { class: 'muted small' }, "Une ligne par groupe, dans l'ordre de la feuille. Le groupe ISO d'un outil est « classe - matériau » (« P - Acier non allié ») : retirer le dernier matériau d'un groupe retire le groupe, et les exercices qui l'utilisent le signaleront. « Famille » : un trait fin au-dessus de la ligne (changement de matériau usiné)."),
      table(['Classe', 'Groupe', 'Matériau usiné', 'Composition', 'État', 'Dureté', 'Exemple', ...toolMaterialRows.map((r) => `Vc ${r.read().nom}`), 'Famille'], materials.body, 'tables-edit--materiaux'),
      el('div', { class: 'form-actions' }, el('button', { class: 'button-outline', type: 'button', onclick: () => materials.add() }, 'Ajouter un matériau')),
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, 'Opérations'),
      el('p', { class: 'muted small' }, "Une ligne par opération, dans l'ordre de la feuille des avances : la machine-outil, la direction d'avance, la famille (fixe, proportionnelle au Ø, filetage), l'avance par révolution et son maximum (en pouces ; sans objet en filetage), le pictogramme."),
      table(['Opération', 'Machine-outil', "Direction d'avance", 'Famille', 'Avance', 'Avance max', 'Pictogramme'], operations.body, 'tables-edit--operations'),
      el('div', { class: 'form-actions' }, el('button', { class: 'button-outline', type: 'button', onclick: () => operations.add() }, 'Ajouter une opération')),
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, 'Versions publiées'),
      versionsList,
    ]),
  ]);
  validate();
  showScreen(main, screen, { title: TITLE, aside: headerAside() }, 'h1');
}

// --- Images (D56) : la liste avec les utilisations, téléverser, renommer, archiver, supprimer ------------------------------

async function showImages(notice = '', filters = { usage: '', query: '' }) {
  const response = await guarded(() => editorImages());
  if (response === null) return;
  forgetImages();
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  const act = async (action, success) => {
    try { await guarded(action); await showImages(success, filters); } catch (error) { status.textContent = serverErrorMessage(error); }
  };

  // Filtres : usage et recherche par nom ; la liste se refait à la frappe.
  const usageSelect = el('select', { id: 'images-usage' }, [el('option', { value: '' }, 'toutes'), ...Object.entries(USAGE_LABELS).map(([key, label]) => el('option', { value: key, selected: filters.usage === key }, label))]);
  const search = el('input', { id: 'images-recherche', type: 'search', autocomplete: 'off', placeholder: 'Nom ou identifiant', value: filters.query });
  const body = el('tbody');
  const count = el('p', { class: 'muted smaller prof-count' });
  const plain = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function renderRows() {
    filters = { usage: usageSelect.value, query: search.value };
    const needle = plain(search.value).trim();
    const shown = response.images.filter((image) => (filters.usage === '' || image.usage === filters.usage) && (needle === '' || plain(image.nom).includes(needle) || plain(image.id).includes(needle)));
    body.replaceChildren(...shown.map((image) => el('tr', { class: image.archivee_le === null ? null : 'image-archivee' }, [
      el('td', {}, el('img', { class: 'outil-vignette', src: imageUrl(image.id), alt: '', loading: 'lazy' })),
      el('td', {}, [image.nom, el('div', { class: 'mono smaller muted' }, image.id)]),
      el('td', {}, USAGE_LABELS[image.usage] ?? image.usage),
      el('td', {}, [image.type.replace('image/', '').replace('svg+xml', 'svg'), el('div', { class: 'smaller muted' }, imageSizeText(image.taille))]),
      el('td', { class: 'date' }, formatDateStamp(image.creee_le)),
      el('td', {}, imageUsageLabel(image.utilisations)),
      el('td', { class: image.archivee_le === null ? '' : 'state--running' }, image.archivee_le === null ? 'offerte' : `archivée le ${formatDateStamp(image.archivee_le)}`),
      el('td', { class: 'actions' }, el('div', { class: 'actions-group' }, [
        el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => {
          const nom = window.prompt('Nouveau nom de l\'image (le nom lisible, dans la galerie) :', image.nom);
          if (nom && nom.trim() !== image.nom) act(() => editorImageRename(image.id, nom.trim()), `« ${image.nom} » renommée « ${nom.trim()} ».`);
        } }, 'Renommer'),
        image.archivee_le === null
          ? el('button', { class: 'button-small', type: 'button', onclick: () => { if (window.confirm(imageArchiveConfirmation(image))) act(() => editorImageArchive(image.id, true), `« ${image.nom} » archivée : plus proposée, toujours affichée là où elle est nommée.`); } }, 'Archiver')
          : el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => act(() => editorImageArchive(image.id, false), `« ${image.nom} » rétablie.`) }, 'Rétablir'),
        ...(canDeleteImage(image.utilisations) ? [el('button', { class: 'button-small button-small--danger', type: 'button', onclick: () => { if (window.confirm(imageDeleteConfirmation(image))) act(() => editorImageDelete(image.id), `« ${image.nom} » supprimée.`); } }, 'Supprimer')] : []),
      ])),
    ])));
    count.textContent = `${shown.length} image${shown.length > 1 ? 's' : ''} sur ${response.images.length}.`;
  }
  usageSelect.addEventListener('change', renderRows);
  search.addEventListener('input', renderRows);

  // Téléverser : l'usage, puis le fichier ; réduit dans le navigateur, envoyé, puis la liste est relue.
  const uploadUsage = el('select', { id: 'televerser-usage' }, Object.entries(USAGE_LABELS).map(([key, label]) => el('option', { value: key }, label)));
  const uploadFile = el('input', { id: 'televerser-fichier', type: 'file', accept: 'image/*,.svg' });
  const uploadForm = el('form', { class: 'ajout-outil', novalidate: true, onsubmit: async (event) => {
    event.preventDefault();
    const [file] = uploadFile.files;
    if (!file) { status.textContent = 'Choisis un fichier.'; return; }
    status.textContent = 'Réduction et envoi…';
    try {
      const image = await uploadImage(file, uploadUsage.value);
      const retires = image.retires?.length > 0 ? ` Retiré du SVG : ${image.retires.join(', ')}.` : '';
      await showImages(image.existante ? `Cette image était déjà dans la base : « ${image.nom} » (${image.id}).${retires}` : `« ${image.nom} » téléversée (${image.id}, ${imageSizeText(image.taille)}).${retires}`, filters);
    } catch (error) {
      status.textContent = error.status === undefined ? error.message : serverErrorMessage(error);
    }
  } }, [
    el('div', { class: 'field' }, [el('label', { for: 'televerser-usage' }, 'Usage'), uploadUsage]),
    el('div', { class: 'field' }, [el('label', { for: 'televerser-fichier' }, 'Fichier (PNG, JPEG, WebP, GIF, BMP ou SVG)'), uploadFile, el('div', { class: 'field-note' }, "Une photo est réduite dans le navigateur (800 px ; JPEG sur fond blanc, ou PNG si elle a de la transparence) ; un pictogramme à 256 px, ou tel quel en SVG (assaini par le serveur). Un doublon exact n'est pas stocké deux fois.")]),
    el('button', { class: 'button-outline', type: 'submit' }, 'Téléverser'),
  ]);

  const screen = el('div', { class: 'screen screen--wide prof editeur' }, el('section', { class: 'panel' }, [
    panelHead('images', 'images'),
    el('h1', { tabindex: '-1' }, 'Images'),
    el('p', { class: 'muted small' }, "Les photos d'outils et les pictogrammes d'opérations, dans la base. Une image ne change jamais sous le même identifiant ; une image utilisée par une version publiée ne se supprime pas : elle s'archive (retirée des galeries, toujours affichée). Une image jamais utilisée peut être supprimée."),
    status,
    el('div', { class: 'ajout-outil' }, [
      el('div', { class: 'field' }, [el('label', { for: 'images-usage' }, 'Usage'), usageSelect]),
      el('div', { class: 'field' }, [el('label', { for: 'images-recherche' }, 'Recherche'), search]),
    ]),
    el('div', { class: 'table-wrap' }, el('table', { class: 'prof-table images-table' }, [
      el('thead', {}, el('tr', {}, ['', 'Nom', 'Usage', 'Type', 'Ajoutée le', 'Utilisée par', 'État', 'Actions'].map((label) => el('th', {}, label)))),
      body,
    ])),
    count,
    el('h2', { class: 'editeur-bar' }, 'Téléverser une image'),
    uploadForm,
  ]));
  renderRows();
  showScreen(main, screen, { title: TITLE, aside: headerAside() }, 'h1');
}

// --- Démarrage : on essaie la liste ; un 401 ramène à la connexion, un 403 la refuse --------------------------------

async function start() {
  try {
    await showList();
  } catch (error) {
    showLogin(serverErrorMessage(error));
  }
}

start();
