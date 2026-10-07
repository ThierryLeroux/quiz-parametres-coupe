// La Gestion du contenu — les onglets Exercices, Banque d'outils, Tables de référence, Images et Sauvegarde de l'espace
// enseignant (jalons 7a et 7b, décisions D47 à D49, D56 à D59, D74, D95 ; UI §3.9). « Éditeur des exercices » jusqu'à
// D74 : les routes /api/prof/editeur/* et les noms de fichiers gardent « editeur » ; l'adresse /prof/editeur redirige
// vers /prof#exercices depuis D95.
// La coquille — connexion, barre du haut, onglets, garde des modifications, 401 — est prof-shell.js ; prof-main.js
// enregistre les cinq onglets exportés ici. Les deux rôles (D44) : l'administration édite ; la consultation lit tout,
// sauf la sauvegarde (D95) — les formulaires dans un fieldset inactif lisible, aucun bouton d'action construit, la
// dernière version publiée d'un exercice (le serveur ne lui envoie jamais un brouillon). Ce qu'on montre est décidé par
// editeur-data.js (pur, testé) et la validation est celle du quiz (draftErrors, site/js/exercice.js) ; ici, on
// construit le DOM.
//
// Écrans : liste des exercices → page d'un exercice (la présentation en direct d'un exercice publié —
// titre, cours, « À l'accueil », photos et notes, D78 — ; réglages, outils, versions,
// aperçu, publication, version des tables) ; banque d'outils → fiche d'un outil ; tables de
// référence (la présentation en direct — aperçu, application, historique, D76 — ; le brouillon des valeurs,
// publication d'une version avec sa révision, aperçu, feuilles imprimables) ;
// images (galerie, téléversement, archivage) ; sauvegarde (export, import — les images voyagent à
// part, une par requête).

import {
  editorArchiveExercise, editorBank, editorBankArchive, editorBankCreate, editorBankRestore, editorBankSave, editorBankTool, editorCreateExercise, editorDeleteExercise, editorExport,
  editorExerciseTables, editorGetExercise, editorImageArchive, editorImageDelete, editorImageImport, editorImageRename, editorImageUpload, editorImages, editorImport, editorImportValidate, editorListExercises, editorMoveExercise, editorPreview, editorPublish, editorRenameExercise, editorSaveDraft,
  editorCancel, editorExercisePresentation, editorExercisePresentationApply, editorExercisePresentationRestore, editorPresentation, editorPresentationApply, editorPresentationRestore, editorResume, editorTables, editorTablesCancel, editorTablesCascade, editorTablesPreview, editorTablesPublish, editorTablesResume, editorTablesSave, editorTablesVersion,
} from '../api.js';
import { toolMaterialNames, validateTables } from '../data.js';
import { copyOfTool, draftErrors, liveTitleRefusal, sameTitleExercises, sameTitleRefusal } from '../exercice.js';
import { REASON_MAX, carriesSpeedFactors, factorText, parseFactor, prefillSpeedFactors, settleSpeedFactor, speedFactorState, tableFactorLine } from '../facteur-vitesse.js';
import { applyPresentation, archivedWarnings, presentationDiff, presentationErrors, presentationKeys } from '../presentation.js';
import { applyCopyPresentation, applyExercisePresentation, exerciseArchivedWarnings, exercisePresentationDiff, exercisePresentationErrors, knownCopies } from '../presentation-exercice.js';
import { CHARACTERISTIC_LIMITS, DEFAULT_LEGENDE_IMAGE, tablesDiff } from '../tables.js';
import { applyTableColors, convertDecimalCommas, el, showScreen } from './dom.js';
import {
  archiveConfirmation, bankPassageLines, canDeleteImage, cascadeAction, cascadeResultText, characteristicFrom, courseSpelling, deducibleWarnings, deleteConfirmation, deriveGroups, diffLines, dimensionReadings, dimensionsText, errorsByField, exampleIdentifier, exerciseHistoryLabel, exerciseState, exerciseTablesImpact, exportFileName, factorSource, forcedBadge,
  liveTitleConflicts, presentationPreview, renameDone, renamePrompt, bankHistoryLabel, twinTitlesNote, twinTitlesWarning, FEED_FAMILIES, feedFamilyFlags, feedFamilyOf, FIELD_CHOICES, FIELD_STATES, fieldStates, groupSwatch, imageArchiveConfirmation, imageDeleteConfirmation, imageSizeText, imageUsageLabel, importSummaryLines, importWordFor, insertToken, knownCourses, lostChangesTitle, materialSwatch, moveItem, parseDimensions, permittedTokens, presentationApplyState, publishTablesLabel, presentationHistoryLabel, previewColumns, previewRows, publishedTitles, publishState, removeSelectionConfirmation, removeToolConfirmation, sessionsLabel, statesToDraft, studentLink, tablesNotice, tablesUsageLabel, templateTokenList, USAGE_LABELS, versionDiff, versionLabel,
} from './editeur-data.js';
import { imagePicker, prepareUpload } from './images-picker.js';
import { EXPIRED_NOTICE } from './prof-data.js';
import { TITLE, guarded, headerAside, isDirty, leave, panelHead, readOnly, setDirty } from './prof-shell.js';
import { classFeatures, classImages, imageUrl } from './sheets-data.js';
import { formatDateStamp, serverErrorMessage } from './text.js';

const main = document.querySelector('#app');
convertDecimalCommas(main); // une virgule tapée devient un point à la sortie d'un champ décimal (D71)

// Un identifiant libre parmi ceux pris : « mvlnr », « mvlnr_2 »…
function freeId(wanted, taken) {
  if (!taken.includes(wanted)) return wanted;
  for (let n = 2; ; n += 1) if (!taken.includes(`${wanted}_${n}`)) return `${wanted}_${n}`;
}

const state = {
  images: { outil: null, operation: null, classe: null }, // les fiches des images de la base, par usage (chargées à la demande)
};

// La lecture seule (D95) : les champs d'un écran de la consultation sont dans un fieldset inactif, que prof.css rend lisible.
const readOnlyBox = (children) => el('fieldset', { class: 'lecture-seule', disabled: true }, children);

// --- Liste des exercices (B2) ----------------------------------------------------------------------------------------

export async function showList(notice = '') {
  const response = await guarded(() => editorListExercises());
  if (response === null) return;
  const ro = readOnly();
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
    const copyLink = el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: async (event) => {
      const link = studentLink(location.origin, row.id);
      try { await navigator.clipboard.writeText(link); event.currentTarget.textContent = 'Lien copié'; } catch { window.prompt('Lien à donner sur Léa :', link); }
    } }, 'Copier le lien étudiant');
    // La consultation (D95) : « Voir » et le lien étudiant, rien d'autre.
    const actions = ro ? [el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: open }, 'Voir'), copyLink] : [
      el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: open }, 'Modifier'), // « Modifier », dans toutes les listes (D74)
      // L'ordre de la liste est aussi celui de l'accueil des étudiants (D51).
      el('button', { class: 'button-small button-small--neutral', type: 'button', disabled: i === 0, title: 'Monter dans la liste', onclick: () => act(() => editorMoveExercise(row.id, row.rang, 'monter')) }, '↑'),
      el('button', { class: 'button-small button-small--neutral', type: 'button', disabled: i === response.exercices.length - 1, title: 'Descendre dans la liste', onclick: () => act(() => editorMoveExercise(row.id, row.rang, 'descendre')) }, '↓'),
      el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => {
        const id = window.prompt(`Identifiant du nouvel exercice (minuscules, chiffres, tirets), copie de « ${row.titre} » :`, `${row.id}-2`);
        if (id) act(() => editorCreateExercise({ id: id.trim(), depuis: row.id }), `« ${row.titre} » dupliqué sous « ${id.trim()} » : un brouillon, à publier.`);
      } }, 'Dupliquer'),
      // Renommer (D78) : un exercice publié, en direct — le même geste que le panneau de sa présentation, avec la règle du
      // titre en double (à l'écran, puis au serveur) ; jamais publié, le titre du brouillon.
      el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => {
        const titre = window.prompt(renamePrompt(row), row.titre)?.trim();
        if (!titre || titre === row.titre) return;
        const live = row.derniere_version !== null;
        const twins = live ? liveTitleConflicts(titre, row.titre, response.exercices, row.id) : [];
        if (twins.length > 0) { status.textContent = liveTitleRefusal(twins); return; }
        act(() => editorRenameExercise(row.id, titre), renameDone({ en_direct: live, titre }));
      } }, 'Renommer'),
      row.archive_le === null
        ? el('button', { class: 'button-small', type: 'button', onclick: () => { if (window.confirm(archiveConfirmation(row))) act(() => editorArchiveExercise(row.id, true), `« ${row.titre} » archivé.`); } }, 'Archiver')
        : el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => act(() => editorArchiveExercise(row.id, false), `« ${row.titre} » rétabli.`) }, 'Rétablir'),
      ...(row.seances === 0 ? [el('button', { class: 'button-small button-small--danger', type: 'button', onclick: () => { if (window.confirm(deleteConfirmation(row))) act(() => editorDeleteExercise(row.id), `« ${row.titre} » supprimé.`); } }, 'Supprimer')] : []),
      copyLink,
    ];
    // Un titre en double (D79) : une note dorée sous le titre, qui nomme l'autre exercice ; elle ne bloque rien.
    const twins = twinTitlesNote(row.doublons ?? []);
    return el('tr', {}, [
      el('td', { class: 'num' }, String(row.rang)),
      el('td', {}, [el('button', { class: 'button-link', type: 'button', onclick: open }, row.titre), ...(twins === null ? [] : [el('div', { class: 'avertissement-ligne' }, twins)])]),
      el('td', {}, row.cours ?? '—'),
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
    el('div', { class: 'field' }, [el('label', { for: 'nouvel-id' }, "Identifiant d'URL (?exercice=…)"), idInput, el('div', { class: 'field-note' }, "Minuscules, chiffres et tirets. Définitif : c'est le lien sur Léa.")]),
    el('div', { class: 'field' }, [el('label', { for: 'nouveau-titre' }, 'Titre'), titreInput, el('div', { class: 'field-note' }, '')]),
    el('button', { class: 'button-outline', type: 'submit' }, 'Créer un exercice vide'),
  ]);

  const screen = el('div', { class: 'screen screen--wide prof editeur' }, el('section', { class: 'panel' }, [
    panelHead('exercices', 'exercices'),
    el('h1', { tabindex: '-1' }, 'Exercices'),
    el('p', { class: 'muted small' }, ro
      ? "Lecture seule : chaque exercice s'ouvre dans sa dernière version publiée, celle que voient les étudiants. Les brouillons ne sont pas montrés. L'ordre de cette liste est celui de l'accueil."
      : "Les étudiants voient la dernière version publiée de chaque exercice. Une séance commencée garde sa version jusqu'à la fin. Le brouillon ne change rien tant qu'il n'est pas publié. L'ordre de cette liste (↑ ↓) est celui de l'accueil."),
    status,
    el('div', { class: 'table-wrap' }, el('table', { class: 'prof-table' }, [
      el('thead', {}, el('tr', {}, ['Rang', 'Titre', 'Cours', 'Identifiant', 'État', 'Dernière version', 'Séances', "À l'accueil", 'Actions'].map((label) => el('th', { class: label === 'Rang' ? 'num' : null }, label)))),
      el('tbody', {}, rows),
    ])),
    el('p', { class: 'muted smaller prof-count' }, `${rows.length} exercice${rows.length > 1 ? 's' : ''}.`),
    ...(ro ? [] : [el('h2', { class: 'editeur-bar' }, 'Nouvel exercice'), createForm]),
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

// Une case de facteur de vitesse (D83) : elle accepte « 1/4 » comme « 0.25 » (parseFactor : l'évaluateur des cases de
// réponse), et récrit en fraction, à la sortie de la case, ce qu'elle a su lire. Pas de clavier décimal : il n'a pas de « / ».
//   value : le facteur (un nombre), ou ce qui a été tapé et n'en est pas un
function factorInput(id, value, attrs = {}) {
  const input = el('input', { id, type: 'text', autocomplete: 'off', spellcheck: 'false', class: 'input-court mono', value: Number.isFinite(value) ? factorText(value) : (value ?? ''), ...attrs });
  input.addEventListener('focusout', () => {
    const read = parseFactor(input.value);
    if (read !== null && input.value !== factorText(read)) input.value = factorText(read);
  });
  return input;
}
// Ce qu'une case de facteur envoie : le nombre lu ; vide, `empty` ; illisible, le texte tapé (la validation le dira).
const readFactor = (input, empty = null) => parseFactor(input.value) ?? (input.value.trim() === '' ? empty : input.value.trim());

// Le badge « facteur forcé » d'un outil (D83), dans la liste de la banque et dans celle des outils d'un exercice.
const forcedBadgeOf = (tool, opsByName) => {
  const badge = forcedBadge(tool, opsByName.get(tool.operation));
  return el('span', { class: 'badge-force', hidden: badge === null, title: badge?.title ?? null }, badge?.label ?? '');
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
//   tool  : l'outil (ou la copie) à éditer ; ctx : { tables, opsByName, images (fiches « outil »), copy, prefix, live, readOnly }
//   readOnly (D95) : la consultation — aucun bouton (crochets, « Autre exemple », tout cocher, galerie) ; les champs
//   seront dans un fieldset inactif
function toolForm(tool, ctx) {
  const p = ctx.prefix;
  const ro = ctx.readOnly === true;
  const ops = ctx.tables.operations.operations;
  const groups = ctx.tables.materiaux.groupes_iso;
  const operationSelect = el('select', { id: `${p}-operation` }, ops.map((op) => el('option', { value: op.operation, selected: op.operation === tool.operation }, op.operation)));
  const isThread = () => ctx.opsByName.get(operationSelect.value)?.avance_egale_pas_filetage === true;
  // Le facteur de vitesse (D83). Avec des tables qui portent les facteurs, l'outil hérite de celui de son opération :
  // une ligne en lecture seule, « Selon la table : 1/4 (Chanfreinage) » ; « Forcer pour cet outil » ouvre la valeur et
  // la raison, toutes deux obligatoires. Un ancien outil s'y montre hérité, ou forcé « à vérifier » (speedFactorState).
  // Avec des tables d'avant, le champ d'avant : le facteur propre à l'outil.
  const inherits = carriesSpeedFactors(ops);
  const factor = speedFactorState(tool, ctx.opsByName.get(operationSelect.value));
  const tableLine = el('p', { class: 'facteur-table', id: `${p}-fact-table` }, '');
  const forceBox = el('input', { id: `${p}-fact-force`, type: 'checkbox', checked: factor.mode === 'forced', 'aria-describedby': `${p}-fact-table` });
  const forcedValue = factorInput(`${p}-fact-vc`, factor.mode === 'forced' ? tool.fact_vc : '', { 'aria-label': 'Facteur de vitesse forcé' });
  const forcedReason = el('input', { id: `${p}-fact-raison`, type: 'text', autocomplete: 'off', maxlength: String(REASON_MAX), value: factor.mode === 'forced' ? (tool.fact_vc_raison ?? factor.reason) : '' });
  const forcedFields = el('div', { class: 'facteur-force' });
  const refreshFactor = () => {
    const operation = ctx.opsByName.get(operationSelect.value);
    tableLine.textContent = operation ? tableFactorLine(operation) : '';
    forcedFields.hidden = !forceBox.checked;
  };
  forceBox.addEventListener('change', refreshFactor);
  // La photo (D56) : la galerie des images « outil » de la base, avec téléversement sur place ; un
  // changement dans la galerie vaut un changement du formulaire (validation, brouillon modifié). Une copie que la
  // présentation en vigueur connaît (ctx.live, D78) n'a ni photo ni note ici : elles sont en direct, dans le panneau ;
  // celles du brouillon dorment, gardées telles quelles.
  const picker = ctx.live ? null : imagePicker({ usage: 'outil', images: ctx.images, value: tool.image ?? null, upload: (file) => uploadImage(file, 'outil'), onChange: () => element.dispatchEvent(new Event('change', { bubbles: true })), idPrefix: `${p}-image`, readOnly: ro });
  // Les matières d'outil et les couleurs sont celles de la version de tables de la page (D61).
  const materials = checkboxes(`${p}-mat`, toolMaterialNames(ctx.tables.materiaux).map((key) => ({ key, label: key })), tool.materiaux_outil ?? [], { inline: true, swatchOf: (label) => materialSwatch(label, ctx.tables.materiaux), buttons: !ro });
  const groupChoices = checkboxes(`${p}-grp`, groups.map((key) => ({ key, label: key })), tool.groupes_materiaux_usinables ?? [], { swatchOf: (group) => groupSwatch(group, ctx.tables.materiaux), buttons: !ro });

  // Le gabarit de nomenclature (D24, D58) : éditable ; les boutons insèrent un jeton permis pour cet
  // outil au curseur ; l'exemple composé suit la frappe, « Autre exemple » le tire au hasard dans l'outil.
  const template = el('input', { id: `${p}-format`, type: 'text', autocomplete: 'off', spellcheck: 'false', value: tool.format_identifiant ?? '' });
  const tokenBar = el('div', { class: 'token-buttons' });
  const exampleText = el('span', {});
  let drawn = null; // null = l'exemple fixe (premières valeurs) ; sinon une suite de tirages figée, rejouée à chaque rafraîchissement
  const exampleLine = el('div', { class: 'field-note field-note--multi exemple-nomenclature' }, [exampleText, ...(ro ? [] : [' ', el('button', { class: 'button-link', type: 'button', onclick: () => {
    drawn = Array.from({ length: 8 }, () => Math.random());
    refreshExample();
  } }, 'Autre exemple')])]);
  function refreshExample() {
    const current = read();
    const random = drawn === null ? null : ((sequence) => { let i = 0; return () => sequence[i++ % sequence.length]; })(drawn);
    exampleText.textContent = `Exemple composé : ${exampleIdentifier(current, ctx.opsByName, random)} (crochets : ${templateTokenList(template.value).join(', ') || 'aucun'}).`;
    if (ro) return;
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
    ...(ctx.live ? {} : {
      commentaire: field('commentaire', 'Note affichée sous l\'outil', el('input', { id: `${p}-commentaire`, type: 'text', autocomplete: 'off', value: tool.commentaire ?? '' }), ''),
      image: field('image', 'Photo', picker.element, ro ? "Celle que l'étudiant voit dans le panneau de l'outil." : "Celle que l'étudiant voit dans le panneau de l'outil. La galerie montre les images « photo d'outil » non archivées. « Téléverser » réduit la photo dans le navigateur avant l'envoi : 800 px, en JPEG sur fond blanc ou en PNG si elle a de la transparence.", 'field--wide'),
    }),
    format_identifiant: field('format_identifiant', 'Gabarit de nomenclature', template, ro ? 'Le nom affiché dans la question : du texte, et des crochets remplacés au tirage.' : "Le nom affiché dans la question : du texte, et des crochets remplacés au tirage. Les boutons insèrent au curseur les crochets permis pour cet outil.", 'field--wide'),
    dimensions: field('dimensions', 'Dimensions possibles, une par ligne (libellé ; valeur)', el('textarea', { id: `${p}-dimensions`, spellcheck: 'false', 'data-decimal': 'valeurs', oninput: () => refreshReadings() }, dimensionsText(tool.dimensions)),
      'Valeur : le Ø en pouces (« Ø 1/4 po ; 0.25 »), ou le filetage en texte (« 1/4- 20 UNC ; 0.25-20 », « M10 x 1.5 ; 10x1.5 »).', 'field--half'),
    dimensions_barre: field('dimensions_barre', "Barres d'un outil à deux diamètres, une par ligne (libellé ; Ø en pouces)", el('textarea', { id: `${p}-barres`, spellcheck: 'false', 'data-decimal': 'valeurs' }, dimensionsText(tool.dimensions_barre)),
      "Vide : un seul diamètre. Sinon, l'avance suit le Ø de la barre, et N le Ø usiné."),
    rapport_barre_max: field('rapport_barre_max', 'Rapport Ø barre / Ø usiné maximal', numberInput(`${p}-rapport`, tool.rapport_barre_max), 'Ex. 0.75 : une barre entre si Ø barre ≤ 0.75 × Ø usiné.'),
    nb_dents_min: field('nb_dents_min', 'Dents, minimum', numberInput(`${p}-dents-min`, tool.nb_dents_min), 'Le nombre de dents est tiré entre les deux.'),
    nb_dents_max: field('nb_dents_max', 'Dents, maximum', numberInput(`${p}-dents-max`, tool.nb_dents_max), ''),
    ...(inherits ? {
      fact_vc: field('fact_vc', 'Valeur forcée', forcedValue, '« 1/4 » ou « 0.25 ». 1 : aucune réduction.'),
      fact_vc_raison: field('fact_vc_raison', 'Raison, montrée à l’étudiant', forcedReason, `Courte (${REASON_MAX} caractères au plus) : « fraise à inserts de carbure ».`),
    } : {
      fact_vc: field('fact_vc', 'Facteur de vitesse (× Vc)', numberInput(`${p}-fact-vc`, tool.fact_vc), '1 : aucun. 0.25 pour un alésoir.'),
    }),
    fact_av: field('fact_av', "Facteur d'avance (× avance)", numberInput(`${p}-fact-av`, tool.fact_av), '1 sauf sur une avance proportionnelle au Ø.'),
    limite_rpm: field('limite_rpm', 'Vitesse de rotation max de la machine', numberInput(`${p}-limite-rpm`, tool.limite_rpm), 'tr/min'),
    materiaux_outil: field('materiaux_outil', "Matières d'outil possibles", materials.element, '', 'field--wide'),
    groupes_materiaux_usinables: field('groupes_materiaux_usinables', 'Groupes de matériaux usinables', groupChoices.element, '', 'field--wide'),
  };
  if (ctx.copy) fields.reussites_requises = field('reussites_requises', 'Réussites de suite exigées', numberInput(`${p}-reussites`, tool.reussites_requises, { inputmode: 'numeric' }), 'Un échec remet le compteur de cet outil à zéro.');

  // Les champs, regroupés par thème (UI §3.9) : un intertitre par groupe ; la même disposition pour la banque.
  const liveNote = el('div', { class: 'field field--wide' }, [el('span', { class: 'field-label-text' }, 'Photo et note'), el('p', { class: 'muted small' }, 'En direct, dans le panneau « Présentation » en tête de la page : elles changent tout de suite, sans publication.')]);
  // Le facteur de vitesse hérité : la ligne de la table, la case « Forcer », et les deux champs qu'elle ouvre.
  forcedFields.append(...(inherits ? [fields.fact_vc.element, fields.fact_vc_raison.element] : []));
  const factorBlock = inherits ? el('div', { class: 'field field--half facteur-vitesse', 'data-champ': 'facteur_vitesse' }, [
    el('span', { class: 'field-label-text' }, 'Facteur de vitesse'),
    tableLine,
    el('label', { class: 'facteur-forcer', for: forceBox.id }, [forceBox, 'Forcer pour cet outil']),
    forcedFields,
    el('div', { class: 'field-note' }, "L'outil hérite du facteur de son opération, dans les tables. Forcé, il garde sa valeur quoi que dise la table, et l'étudiant le voit toujours, avec sa raison."),
  ]) : fields.fact_vc.element;
  const sections = [
    ['Identification', ctx.live ? [fields.nom.element, fields.operation.element, fields.id.element, liveNote] : [fields.nom.element, fields.operation.element, fields.commentaire.element, fields.id.element, fields.image.element]],
    ['Nomenclature', [fields.format_identifiant.element]],
    ['Dimensions', [fields.dimensions.element, el('div', { class: 'field' }, [el('span', { class: 'field-label-text' }, 'Lecture par le moteur'), readings]), fields.dimensions_barre.element, fields.rapport_barre_max.element]],
    ['Dents', [fields.nb_dents_min.element, fields.nb_dents_max.element]],
    ['Facteurs', [factorBlock, fields.fact_av.element]],
    ['Limites', [fields.limite_rpm.element]],
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
      // null = pas de note, comme dans le catalogue ; une copie en direct garde celle qui dort dans le brouillon (D78)
      commentaire: ctx.live ? (tool.commentaire ?? null) : (fields.commentaire.control.value.trim() === '' ? null : fields.commentaire.control.value.trim()),
      operation: operationSelect.value,
      // D83 : hérité, l'outil n'a pas de facteur propre ; forcé, sa valeur et sa raison ; avec des tables d'avant, son facteur.
      ...(inherits
        ? (forceBox.checked ? { fact_vc: readFactor(forcedValue, Number.NaN), fact_vc_raison: forcedReason.value.trim() } : {})
        : { fact_vc: readNumber(fields.fact_vc.control) }),
      fact_av: readNumber(fields.fact_av.control),
      limite_rpm: readNumber(fields.limite_rpm.control),
      ...(tool.limite_avance !== undefined ? { limite_avance: tool.limite_avance } : {}), // obsolète (D69) : gardée telle quelle, hors du formulaire
      nb_dents_min: readNumber(fields.nb_dents_min.control),
      nb_dents_max: readNumber(fields.nb_dents_max.control),
      materiaux_outil: materials.read(),
      groupes_materiaux_usinables: groupChoices.read(),
      image: ctx.live ? (tool.image ?? null) : picker.read(),
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
  if (!ro) fields.format_identifiant.element.insertBefore(tokenBar, fields.format_identifiant.noteEl);
  fields.format_identifiant.element.append(exampleLine);
  operationSelect.addEventListener('change', refreshReadings);
  operationSelect.addEventListener('change', refreshFactor);
  refreshReadings();
  refreshFactor();
  refreshExample();
  return { element, read, setErrors, fields, refreshExample, picker };
}

// Téléverse une image pour une galerie : réduite dans le navigateur (prepareUpload), envoyée au
// serveur (qui vérifie le type, assainit un SVG et ne stocke pas un doublon), puis mise en cache.
// Retourne la fiche, avec « existante » et ce qui a été retiré d'un SVG.
async function uploadImage(file, usage) {
  const body = await prepareUpload(file, usage);
  const result = await guarded(() => editorImageUpload(body));
  if (result === null) throw new Error(EXPIRED_NOTICE);
  rememberImage(result.image);
  return { ...result.image, existante: result.existante, retires: result.retires };
}

// Les fiches des images d'un usage (« outil », « operation », « classe »), chargées une fois puis tenues à jour par rememberImage.
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
const forgetImages = () => { state.images = { outil: null, operation: null, classe: null }; };

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

// Une table de résultats d'aperçu. `classesIso` : les classes de la version de tables en usage (ou du
// brouillon des tables à l'écran) — la cellule du matériau usiné montre, comme l'écran Question, l'image de
// chaleur de sa classe et, à sa droite, ses caractéristiques avec leur solution (D64 à D66).
function previewTable(response, classesIso = []) {
  const columns = previewColumns(response.champs_evalues, response.champs_masques ?? []);
  const rows = previewRows(response.questions, response.champs_evalues, response.champs_masques ?? []);
  const material = (r, text) => {
    const code = response.questions[r].materiau.classe;
    // L'image de chaleur avec sa légende dessous, comme sur l'écran Question (D68 : vide, pas de légende).
    const images = classImages(classesIso, code).map(({ url, label }) => el('figure', { class: 'apercu-classe-figure' }, [
      el('img', { class: 'apercu-classe-image', src: url, alt: '', loading: 'lazy' }),
      label === null ? '' : el('figcaption', {}, label),
    ]));
    const features = classFeatures(classesIso, code);
    return el('div', { class: 'apercu-materiau' }, [
      ...images,
      el('div', {}, [
        el('div', {}, text),
        features.length === 0 ? '' : el('ul', { class: 'apercu-caracteristiques' }, features.map(({ libelle, texte, solution }) => el('li', {}, [
          el('strong', {}, `${libelle} : `), texte,
          solution === null ? '' : el('div', { class: 'apercu-solution' }, [el('span', { class: 'material-feature-arrow' }, '→ Solution : '), solution]),
        ]))),
      ]),
    ]);
  };
  return el('div', { class: 'table-wrap' }, el('table', { class: 'prof-table apercu-table' }, [
    el('thead', {}, el('tr', {}, columns.map((label, i) => el('th', { class: i >= 4 ? 'num' : null }, label)))),
    el('tbody', {}, rows.map((row, r) => el('tr', {}, row.map((cell, i) => el('td', { class: i === 0 || i >= 4 ? 'num' : i === 3 ? 'apercu-materiau-cell' : null }, i === 3 ? material(r, cell) : cell))))),
  ]));
}

// Un retour en arrière (D77 : « Reprendre cette version », « Annuler les modifications ») : sans modification non publiée,
// il se fait tout de suite ; sinon, une confirmation les liste et dit qu'elles seront perdues.
//   slot : où poser la confirmation ; heading : la question ; lines : les modifications perdues ; label : le bouton ; act : async, le geste
function confirmLoss(slot, { heading, lines, label, act }) {
  if (lines.length === 0) return act();
  const go = el('button', { class: 'button button--wrong', type: 'button', onclick: async () => { go.disabled = true; await act(); go.disabled = false; } }, label);
  slot.replaceChildren(el('section', { class: 'panel panel--gold' }, [
    el('div', { class: 'eyebrow' }, 'Confirmation'),
    el('h2', {}, heading),
    el('p', { class: 'small avis-doublon' }, lostChangesTitle(lines.length)),
    el('ul', { class: 'editeur-diff' }, lines.map((line) => el('li', {}, line))),
    el('div', { class: 'form-actions' }, [go, el('button', { class: 'button-link', type: 'button', onclick: () => slot.replaceChildren() }, 'Garder le brouillon')]),
  ]));
  slot.scrollIntoView({ block: 'nearest' });
  return undefined;
}

// --- Page d'un exercice (B3, B5, B6, B7) ---------------------------------------------------------------------------------

async function showExercise(id, notice = '') {
  const page = await guarded(() => editorGetExercise(id));
  if (page === null) return;
  const ro = readOnly();
  const images = await loadImages('outil');
  if (images === null) return;
  const { tables } = page;
  const opsByName = new Map(tables.operations.operations.map((op) => [op.operation, op]));
  let { revision } = page.exercice;
  // L'administration édite le brouillon ; la consultation lit la dernière version publiée, tout ce que le serveur lui donne (D95).
  const draft = ro ? page.derniere_version.contenu : page.exercice.brouillon;
  let copies = structuredClone(draft.outils);
  const openIds = new Set();
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  const generalErrors = el('ul', { class: 'editeur-erreurs' });
  // Les autres exercices : leurs cours (proposés dans le champ Cours, D71), leurs titres en vigueur (un titre déjà pris est
  // refusé, D74) et leurs outils (ajout depuis un autre exercice).
  const others = ((await guarded(() => editorListExercises())) ?? { exercices: [] }).exercices.filter((row) => row.id !== id);
  // Un exercice publié (D78) : sa présentation en vigueur — titre, cours, « À l'accueil », photo et note des copies qu'elle
  // connaît — se modifie en direct, dans le panneau en tête ; ces champs quittent le brouillon (ils y dorment, gardés tels quels).
  let shown = page.presentation; // null : jamais publié, tout est dans le brouillon (jamais pour la consultation : 404 avant)
  const live = shown !== null;
  const knownIds = live ? knownCopies(shown.presentation) : new Set();
  const liveImageOf = (copyId) => shown?.presentation.outils.find((e) => e.id === copyId)?.image ?? null;
  // Deux choses peuvent ne pas être enregistrées : le brouillon, et le panneau de la présentation (pas encore appliqué).
  let draftDirty = false;
  let presentationDirty = false;
  const syncDirty = () => { setDirty(draftDirty || presentationDirty); };

  // Réglages généraux.
  const titre = el('input', { id: 'titre', type: 'text', autocomplete: 'off', value: draft.titre ?? '' });
  // Le cours (D71) : les cours déjà utilisés sont proposés ; écrit autrement qu'ailleurs (« m10 » pour « M10 »),
  // un conseil sous le champ offre l'écriture existante. L'accueil regroupe par cours.
  const courses = knownCourses(others);
  const cours = el('input', { id: 'cours', type: 'text', autocomplete: 'off', list: 'cours-connus', value: draft.cours ?? '' });
  const courseAdvice = el('div', { class: 'cours-conseil', 'aria-live': 'polite' });
  const fieldsChoice = fieldStateChoice(draft);
  // Grandeurs déductibles : un avertissement sous les états, sans effet sur Publier ; rafraîchi par validate().
  const warningsList = el('ul', { class: 'avertissements', id: 'grandeurs-deductibles' });
  const toolMaterials = toolMaterialNames(tables.materiaux); // celles de la version de tables de cet exercice (D62)
  applyTableColors(tables.materiaux);
  const materialsChoice = checkboxes('matiere', toolMaterials.map((key) => ({ key, label: key })), draft.materiaux_outil ?? toolMaterials, { inline: true, swatchOf: (label) => materialSwatch(label, tables.materiaux), buttons: !ro });
  const groupsChoice = checkboxes('groupe', tables.materiaux.groupes_iso.map((key) => ({ key, label: key })), draft.groupes ?? tables.materiaux.groupes_iso, { swatchOf: (group) => groupSwatch(group, tables.materiaux), buttons: !ro });
  const listed = el('input', { id: 'liste', type: 'checkbox', checked: draft.liste !== false });
  // « Donner le facteur de vitesse à l'étudiant » (D83, point 6) : versionné avec l'exercice, décoché par défaut —
  // l'étudiant le trouve dans la feuille des facteurs. Sans effet avec des tables qui ne portent pas les facteurs : le
  // réglage n'y est pas offert, et le brouillon garde le sien.
  const inherits = carriesSpeedFactors(tables.operations.operations);
  const givenFactor = el('input', { id: 'facteur-donne', type: 'checkbox', checked: draft.facteur_vitesse_donne === true });
  // Jamais publié : le titre, le cours et « À l'accueil » sont ici, et entrent en vigueur à la première publication.
  const settings = {
    ...(live ? {} : {
      titre: field('titre', 'Titre', titre, "Affiché à l'étudiant et sur l'attestation. Il entre en vigueur à la première publication. Ensuite, il se change en direct.", 'field--half'),
      cours: field('cours', 'Cours', cours, "Ex. M10 : l'accueil regroupe les exercices par cours. Vide, l'exercice va sous « Autres exercices ». En vigueur à la première publication."),
    }),
    champs_evalues: field('champs_evalues', 'Grandeurs : évaluée (à saisir), fournie (valeur montrée) ou masquée (« — », sans valeur)', el('div', {}, [fieldsChoice.element, warningsList]), 'Au moins une grandeur évaluée. Une grandeur masquée compte comme fournie pour la cohérence de Vf.', 'field--wide'),
    ...(inherits ? {
      facteur_vitesse_donne: field('facteur_vitesse_donne', 'Facteur de vitesse', el('label', { class: 'choices', for: 'facteur-donne' }, el('li', {}, el('label', { for: 'facteur-donne' }, [givenFactor, "Donner le facteur de vitesse à l'étudiant"]))),
        "Décoché : l'étudiant le trouve dans la feuille « Facteurs de vitesse », comme la Vc. Coché (exercices pour débutants) : la question l'affiche, « Vitesse réduite × 1/4 ». Un facteur forcé est toujours affiché, avec sa raison.", 'field--wide'),
    } : {}),
    materiaux_outil: field('materiaux_outil', "Matières d'outil permises pour tout l'exercice", materialsChoice.element, 'Tout coché : aucune restriction. Se croise avec les matières de chaque outil.', 'field--wide'),
    groupes: field('groupes', 'Groupes de matériaux usinés permis pour tout l\'exercice', groupsChoice.element, 'Tout coché : aucune restriction. Se croise avec les groupes de chaque outil.', 'field--wide'),
    ...(live ? {} : { liste: field('liste', "Proposé dans la liste de l'accueil", el('label', { class: 'choices', for: 'liste' }, el('li', {}, el('label', { for: 'liste' }, [listed, 'oui (sinon, joignable seulement par son lien)']))), '') }),
  };

  if (!live) {
    settings.cours.element.insertBefore(el('datalist', { id: 'cours-connus' }, courses.map((course) => el('option', { value: course }))), settings.cours.noteEl);
    settings.cours.element.insertBefore(courseAdvice, settings.cours.noteEl);
  }

  const toolsSlot = el('div');
  let forms = [];

  function readDraft() {
    const course = cours.value.trim();
    // Publié : le titre, le cours et « À l'accueil » du brouillon dorment, gardés tels quels (D78).
    const head = live ? { titre: draft.titre, ...(draft.cours === undefined ? {} : { cours: draft.cours }) } : { titre: titre.value.trim(), ...(course === '' ? {} : { cours: course }) };
    const out = { ...head, ...fieldsChoice.read(), outils: forms.map((f) => f.read()) };
    const materials = materialsChoice.read();
    if (materials.length !== toolMaterials.length) out.materiaux_outil = materials;
    const groups = groupsChoice.read();
    if (groups.length !== tables.materiaux.groupes_iso.length) out.groupes = groups;
    if (live ? draft.liste === false : !listed.checked) out.liste = false;
    if (inherits ? givenFactor.checked : draft.facteur_vitesse_donne === true) out.facteur_vitesse_donne = true;
    for (const key of Object.keys(draft)) if (key.startsWith('_')) out[key] = draft[key];
    return out;
  }

  // Les trois boutons du brouillon ; aucun pour la consultation (D95).
  const publishButton = ro ? null : el('button', { class: 'button button--gold', type: 'button' }, 'Publier…');
  const saveButton = ro ? null : el('button', { class: 'button', type: 'button' }, 'Enregistrer le brouillon');
  // Ramène le brouillon à la dernière version publiée, contenu et tables (D77) ; inactif quand il est à jour.
  const cancelDraftButton = ro ? null : el('button', { class: 'button-outline', type: 'button' }, 'Annuler les modifications');

  // Validation continue (B5) : les erreurs sous leurs champs, le reste dans la liste générale, Publier désactivé s'il en reste.
  // La consultation lit une version publiée, valide par construction, sans rien à valider.
  function validate() {
    if (ro) return null;
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
      form.badge.replaceWith(form.badge = forcedBadgeOf(form.read(), opsByName)); // « facteur forcé » (D83), tel que le formulaire le dit
      // La vignette : la photo du brouillon, ou, pour une copie en direct, celle en vigueur (D78).
      form.thumbnail.src = imageUrl((form.picker ? form.picker.read() : liveImageOf(form.read().id)) ?? form.read().id);
    });
    generalErrors.replaceChildren(...(map.get('') ?? []).map((message) => el('li', {}, message)));
    warningsList.replaceChildren(...deducibleWarnings(current, { factor: factorSource(current, tables.operations.operations) }).map((line) => el('li', {}, line)));
    if (!live) courseAdvice.replaceChildren(...courseAdviceFor(cours));
    const diff = versionDiff(page.derniere_version?.contenu ?? null, current, { avant: page.derniere_version?.tables_id ?? null, apres: page.exercice.tables_id });
    const ps = publishState(errors, diff);
    publishButton.disabled = !ps.enabled;
    publishButton.textContent = ps.label;
    cancelDraftButton.disabled = page.derniere_version === null || lostDraftChanges(true).length === 0;
    return { current, errors };
  }

  // Le conseil sous un champ Cours (D71) : écrit autrement qu'ailleurs, l'écriture existante est offerte.
  function courseAdviceFor(input) {
    const spelling = courseSpelling(input.value, courses);
    return spelling === null ? [] : [
      `Même cours que « ${spelling} », écrit autrement dans un autre exercice. `,
      el('button', { class: 'button-link', type: 'button', onclick: () => { input.value = spelling; input.dispatchEvent(new Event('input', { bubbles: true })); } }, `Écrire « ${spelling} »`),
    ];
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
    if (ro) return;
    selectionButton.disabled = selected.size === 0;
    selectionButton.textContent = selected.size === 0 ? 'Retirer la sélection' : `Retirer la sélection (${selected.size})`;
    allBox.checked = forms.length > 0 && forms.every((f) => f.checkbox.checked);
  }

  // La ligne d'une copie, repliée : « MVLNR · 2 réussite(s) de suite » (validate() la tient à jour à la frappe).
  const summaryOf = (copy) => `${copy.nom || '(sans nom)'} · ${copy.reussites_requises ?? '?'} réussite(s) de suite`;

  // Une ligne par copie : case, vignette, nom, erreurs, les boutons (sans déplier), puis le formulaire replié.
  // La consultation (D95) : ni case, ni boutons ; la copie se déplie, c'est tout.
  function renderTools() {
    forms = copies.map((copy, i) => {
      // Une copie que la présentation connaît : sa photo et sa note sont en direct (D78). Une copie nouvelle d'un exercice
      // publié les reçoit ici, dans sa ligne (liseré doré), jusqu'à sa publication.
      const known = knownIds.has(copy.id) || ro;
      const form = toolForm(copy, { tables, opsByName, images, copy: true, prefix: `o${i}`, live: known, readOnly: ro });
      form.summaryName = el('span', { class: 'muted' }, summaryOf(copy));
      form.badge = forcedBadgeOf(copy, opsByName);
      form.summaryErrors = el('span', { class: 'outil-erreurs' }, '');
      form.thumbnail = el('img', { class: 'outil-vignette', src: imageUrl((known ? liveImageOf(copy.id) : copy.image) ?? copy.id), alt: '', onerror: () => { form.thumbnail.style.visibility = 'hidden'; } });
      form.checkbox = ro ? null : el('input', { type: 'checkbox', 'aria-label': `Sélectionner ${copy.id}`, checked: selected.has(copy.id), onchange: () => { if (form.checkbox.checked) selected.add(copy.id); else selected.delete(copy.id); refreshSelection(); } });
      const swap = (j) => { copies = forms.map((f) => f.read()); [copies[i], copies[j]] = [copies[j], copies[i]]; touch(); renderTools(); };
      const buttons = ro ? '' : el('div', { class: 'outil-actions' }, [
        // Le double d'une copie en direct part de sa photo et de sa note en vigueur (D78) : c'est une copie nouvelle.
        el('button', { class: 'button-small button-small--neutral', type: 'button', title: "Dupliquer dans l'exercice", onclick: () => { copies = forms.map((f) => f.read()); const twin = copyOfTool(applyCopyPresentation(copies[i], shown?.presentation ?? null), { id: freeId(copies[i].id, copies.map((c) => c.id)), reussites_requises: copies[i].reussites_requises }); copies.splice(i + 1, 0, twin); openIds.add(twin.id); touch(); renderTools(); } }, 'Dupliquer'),
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
      const fresh = live && !known;
      form.row = el('div', { class: `outil-ligne${fresh ? ' ligne-nouvelle' : ''}` }, [
        el('div', { class: 'outil-entete' }, [form.checkbox ?? '', form.thumbnail, toggle, form.summaryName, form.badge, form.summaryErrors, buttons]),
        ...(fresh ? [el('p', { class: 'muted smaller outil-nouvelle' }, "Copie nouvelle : sa photo et sa note de départ se saisissent dans son formulaire. Publiée, elles passeront dans le panneau « Présentation », en direct.")] : []),
        body,
      ]);
      return form;
    });
    toolsSlot.replaceChildren(
      forms.length === 0 ? el('p', { class: 'muted small' }, ro ? 'Aucun outil.' : 'Aucun outil : ajoute-en depuis la banque ou depuis un autre exercice.') : (ro ? '' : el('div', { class: 'outil-selection' }, [el('label', { for: 'outils-tous' }, [allBox, 'Tout cocher']), selectionButton])),
      ...forms.map((f) => f.row),
    );
    refreshSelection();
    validate();
  }

  const touch = () => { draftDirty = true; syncDirty(); };

  // Ajouter un outil — depuis la banque, ou depuis un autre exercice : les deux rangées, pour l'administration seulement.
  const addTools = [];
  if (!ro) {
    // Ajouter depuis la banque.
    const bank = await guarded(() => editorBank());
    if (bank === null) return;
    const available = bank.outils.filter((row) => row.archive_le === null);
    const bankSelect = el('select', { id: 'ajout-banque' }, available.map((row) => el('option', { value: row.id }, `${row.outil.nom} (${row.id})`)));
    // Une copie ajoutée prend le facteur de vitesse que les tables de CET exercice veulent (D83, settleSpeedFactor) : la
    // banque se lit avec les tables les plus récentes, un autre exercice avec les siennes.
    const settled = (copy, source) => settleSpeedFactor(copy, opsByName.get(copy.operation), source.operations.operations.find((op) => op.operation === copy.operation));
    const addFromBank = el('button', { class: 'button-outline', type: 'button', onclick: () => {
      const row = available.find((r) => r.id === bankSelect.value);
      if (!row) return;
      copies = forms.map((f) => f.read());
      const copy = settled(copyOfTool(row.outil, { id: freeId(row.id, copies.map((c) => c.id)) }), bank.tables);
      copies.push(copy);
      openIds.add(copy.id);
      touch();
      renderTools();
    } }, 'Ajouter depuis la banque');

    // Ajouter depuis un autre exercice : le brouillon de l'autre, chargé à la demande.
    const otherSelect = el('select', { id: 'ajout-exercice' }, [el('option', { value: '' }, '(choisir un exercice)'), ...others.map((row) => el('option', { value: row.id }, row.titre))]);
    const otherToolSelect = el('select', { id: 'ajout-exercice-outil' }, [el('option', { value: '' }, '—')]);
    let otherCopies = [];
    let otherTables = tables;
    // Un exercice publié : ses copies avec leur photo et leur note en vigueur (D78), pas celles qui dorment dans son brouillon.
    otherSelect.addEventListener('change', async () => {
      const other = otherSelect.value === '' ? null : await guarded(() => editorGetExercise(otherSelect.value));
      otherCopies = other ? applyExercisePresentation(other.exercice.brouillon, other.presentation?.presentation ?? null).outils : [];
      otherTables = other?.tables ?? tables;
      otherToolSelect.replaceChildren(...(otherCopies.length === 0 ? [el('option', { value: '' }, '—')] : otherCopies.map((c) => el('option', { value: c.id }, `${c.nom} (${c.id}), ${c.reussites_requises} réussite(s)`))));
    });
    const addFromOther = el('button', { class: 'button-outline', type: 'button', onclick: () => {
      const source = otherCopies.find((c) => c.id === otherToolSelect.value);
      if (!source) return;
      copies = forms.map((f) => f.read());
      const copy = settled(copyOfTool(source, { id: freeId(source.id, copies.map((c) => c.id)), reussites_requises: source.reussites_requises }), otherTables);
      copies.push(copy);
      openIds.add(copy.id);
      touch();
      renderTools();
    } }, "Ajouter depuis l'exercice");
    addTools.push(
      el('div', { class: 'ajout-outil' }, [el('div', { class: 'field' }, [el('label', { for: 'ajout-banque' }, 'Depuis la banque'), bankSelect]), addFromBank]),
      el('div', { class: 'ajout-outil' }, [
        el('div', { class: 'field' }, [el('label', { for: 'ajout-exercice' }, 'Depuis un autre exercice'), otherSelect]),
        el('div', { class: 'field' }, [el('label', { for: 'ajout-exercice-outil' }, 'Outil'), otherToolSelect]),
        addFromOther,
      ]),
    );
  }

  // Enregistrer (B5) : contrôle de version optimiste.
  async function save() {
    const { current, errors } = validate();
    saveButton.disabled = true;
    try {
      const result = await guarded(() => editorSaveDraft(id, revision, current));
      if (result === null) return false;
      revision = result.revision;
      draftDirty = false;
      syncDirty();
      status.textContent = `Brouillon enregistré à ${formatDateStamp(new Date().toISOString()).slice(11)} (révision ${revision})${errors.length > 0 ? ` — ${errors.length} erreur(s) restent à corriger avant de publier` : ''}.`;
      return true;
    } catch (error) {
      if (error.status === 409) {
        status.replaceChildren(el('strong', {}, error.message), ' ', el('button', { class: 'button-link', type: 'button', onclick: () => { setDirty(false); showExercise(id); } }, 'Recharger la page'));
      } else {
        status.textContent = serverErrorMessage(error);
      }
      return false;
    } finally {
      saveButton.disabled = false;
    }
  }
  saveButton?.addEventListener('click', save);

  // Publier (B6) : enregistrer, résumer les différences, confirmer, créer la version.
  const dialogSlot = el('div');
  publishButton?.addEventListener('click', async () => {
    if (!(await save())) return;
    // Le titre identifie l'exercice pour les étudiants : un autre exercice publié et non archivé du même titre bloque
    // la publication (D74) — le serveur refuse de toute façon ; ici, le refus s'affiche et le bouton reste inactif.
    // Déjà publié, le titre ne change qu'en direct (D78), où la règle s'applique : la republication ne la vérifie plus.
    const listing = await guarded(() => editorListExercises());
    if (listing === null) return;
    const twins = live ? [] : sameTitleExercises(readDraft().titre, publishedTitles(listing.exercices), id);
    const diff = versionDiff(page.derniere_version?.contenu ?? null, readDraft(), { avant: page.derniere_version?.tables_id ?? null, apres: page.exercice.tables_id });
    const numero = (page.derniere_version?.numero ?? 0) + 1;
    const confirm = el('button', { class: 'button button--gold', type: 'button', disabled: twins.length > 0, onclick: async () => {
      confirm.disabled = true;
      try {
        const result = await guarded(() => editorPublish(id, revision));
        if (result === null) return;
        setDirty(false);
        showExercise(id, `Version ${result.numero} publiée le ${formatDateStamp(result.publiee_le)}. Les nouvelles séances la prennent, les séances en cours gardent la leur.`);
      } catch (error) {
        dialogSlot.replaceChildren();
        status.textContent = serverErrorMessage(error);
      }
    } }, `Publier la version ${numero}`);
    dialogSlot.replaceChildren(el('section', { class: 'panel panel--gold' }, [
      el('div', { class: 'eyebrow' }, 'Confirmation'),
      el('h2', {}, `Publier la version ${numero} de « ${live ? shown.presentation.titre : readDraft().titre} » ?`),
      ...(twins.length > 0 ? [el('p', { class: 'small avis-doublon', role: 'alert' }, sameTitleRefusal(twins))] : []),
      el('p', { class: 'small' }, page.derniere_version === null ? "Première publication : l'exercice devient accessible aux étudiants par son lien." : `Différences avec la version ${page.derniere_version.numero} :`),
      el('ul', { class: 'editeur-diff' }, diffLines(diff).map((line) => el('li', {}, line))),
      ...(deducibleWarnings(readDraft()).length > 0 ? [
        el('p', { class: 'small' }, "Avertissement, sans effet sur la publication : une grandeur à trouver se déduit des grandeurs fournies."),
        el('ul', { class: 'avertissements' }, deducibleWarnings(readDraft(), { factor: factorSource(readDraft(), tables.operations.operations) }).map((line) => el('li', {}, line))),
      ] : []),
      el('p', { class: 'muted smaller' }, `Cette version sera sur les tables de référence ${page.exercice.tables_id}. Les séances déjà commencées gardent leur version. Seules les nouvelles séances prennent celle-ci. Une version publiée ne se modifie plus.${live ? " Elle prend la présentation en vigueur (titre, cours, « À l'accueil », photos et notes), en instantané. Celle-ci continue de se modifier en direct." : ''}`),
      el('div', { class: 'form-actions' }, [confirm, el('button', { class: 'button-link', type: 'button', onclick: () => dialogSlot.replaceChildren() }, 'Annuler')]),
    ]));
    dialogSlot.scrollIntoView({ block: 'nearest' });
  });

  // Revenir en arrière (D77). Ce qui serait perdu : les différences du brouillon (tel qu'à l'écran) avec la dernière version
  // publiée — sa version de tables comprise pour « Annuler », pas pour « Reprendre », qui la garde.
  function lostDraftChanges(withTables) {
    if (page.derniere_version === null) return [];
    const lines = diffLines(versionDiff(page.derniere_version.contenu, readDraft(), withTables ? { avant: page.derniere_version.tables_id, apres: page.exercice.tables_id } : null));
    return lines[0] === 'Aucune différence avec la version précédente.' ? [] : lines;
  }
  cancelDraftButton?.addEventListener('click', () => confirmLoss(dialogSlot, {
    heading: `Ramener le brouillon à la version ${page.derniere_version.numero} ?`,
    lines: lostDraftChanges(true),
    label: 'Annuler les modifications',
    act: async () => {
      try {
        const result = await guarded(() => editorCancel(id, revision));
        if (result === null) return;
        setDirty(false);
        showExercise(id, result.annule ? `Brouillon ramené à la version ${result.numero} (tables ${result.tables_id}) : ses modifications sont annulées.` : `Brouillon ramené à la version ${result.numero} : ses modifications non enregistrées sont abandonnées.`);
      } catch (error) { dialogSlot.replaceChildren(); status.textContent = serverErrorMessage(error); }
    },
  }));
  const resumeVersion = (numero) => confirmLoss(dialogSlot, {
    heading: `Reprendre la version ${numero} dans le brouillon ?`,
    lines: lostDraftChanges(false),
    label: `Reprendre la version ${numero}`,
    act: async () => {
      try {
        const result = await guarded(() => editorResume(id, revision, numero));
        if (result === null) return;
        setDirty(false);
        showExercise(id, `Version ${result.numero} reprise dans le brouillon, qui garde ses tables (${result.tables_id}).${result.erreurs.length > 0 ? ` ${result.erreurs.length} erreur(s) à corriger avec ces tables.` : ''} Vérifie, puis « Publier… ».`);
      } catch (error) { dialogSlot.replaceChildren(); status.textContent = serverErrorMessage(error); }
    },
  });

  // Aperçu (B7) : dix questions du brouillon tel qu'il est à l'écran, ou d'une version.
  async function preview(body, label) {
    try {
      const result = await guarded(() => editorPreview({ id, ...body }));
      if (result === null) return;
      dialogSlot.replaceChildren(el('section', { class: 'panel' }, [
        el('div', { class: 'eyebrow' }, 'Aperçu'),
        el('h2', {}, `Dix questions tirées ${label}`),
        el('p', { class: 'muted small' }, "Avec la nomenclature composée et les réponses attendues des grandeurs évaluées. Rien n'est enregistré. Les étudiants ne voient jamais ces réponses."),
        previewTable(result, tables.materiaux.classes_iso),
        el('div', { class: 'form-actions' }, [el('button', { class: 'button-outline', type: 'button', onclick: () => preview(body, label) }, 'Dix autres'), el('button', { class: 'button-link', type: 'button', onclick: () => dialogSlot.replaceChildren() }, 'Fermer')]),
      ]));
      dialogSlot.scrollIntoView({ block: 'nearest' });
    } catch (error) {
      status.textContent = error.status === 400 && error.details.erreurs ? "Le brouillon a des erreurs : corrige-les avant l'aperçu." : serverErrorMessage(error);
    }
  }

  // Une version plus récente des tables existe (D62) : le dire, et proposer d'y passer en montrant d'abord
  // ce que ça change pour cet exercice (erreurs qui apparaîtraient, Vc et avances de ses outils). Pas pour la consultation.
  const tablesAdvice = ro ? null : tablesNotice(page.exercice.tables_id, page.derniere_tables);
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
            setDirty(false);
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

  // --- La présentation en direct d'un exercice publié (D78) : un panneau à part, redessiné après chaque application --------
  const heading = el('h1', { tabindex: '-1' }, live ? shown.presentation.titre : draft.titre);
  const presentationSlot = el('div');
  const copyNamesOf = () => new Map(shown.outils.map((o) => [o.id, o.nom]));
  const galleryImages = () => state.images.outil ?? images;

  // Relit la présentation (et les retouches en attente du brouillon) et redessine le panneau ; le brouillon n'est pas touché.
  async function reloadPresentation(message) {
    const next = await guarded(() => editorExercisePresentation(id));
    if (next === null) return;
    shown = next;
    presentationDirty = false;
    syncDirty();
    heading.textContent = shown.presentation.titre;
    renderPresentation(shown.presentation, message);
  }

  // Un refus du serveur, en clair : 409 (appliquée ailleurs) avec « Recharger le panneau », 400 avec ses erreurs.
  const failure = (error) => {
    if (error.status === 409) return [el('strong', {}, error.message), ' ', el('button', { class: 'button-link', type: 'button', onclick: () => reloadPresentation('') }, 'Recharger le panneau')];
    if (error.status === 400 && Array.isArray(error.details?.erreurs)) return [el('strong', {}, error.message), el('ul', { class: 'editeur-erreurs' }, error.details.erreurs.map((m) => el('li', {}, m)))];
    return [error.status === 400 || error.status === 404 ? error.message : serverErrorMessage(error)];
  };

  //   start : le contenu à montrer — la présentation en vigueur, ou celle qui reprend les retouches en attente
  function renderPresentation(start, message = '') {
    const panelStatus = el('div', { class: 'server-message', role: 'status' }, message);
    const panelErrors = el('ul', { class: 'editeur-erreurs' });
    const panelWarnings = el('ul', { class: 'avertissements' }); // une photo archivée en vigueur : dite, jamais bloquante
    const twinNotice = el('p', { class: 'small avis-doublon', role: 'alert', hidden: true });
    // Un autre exercice publié porte déjà le titre en vigueur (D79) : un avertissement doré, qui ne bloque rien.
    const twinsInForce = twinTitlesWarning(shown.doublons ?? []);
    const twinWarning = twinsInForce === null ? '' : el('ul', { class: 'avertissements' }, el('li', {}, twinsInForce));
    const dialog = el('div');
    const names = copyNamesOf();
    const onEdit = () => { presentationDirty = true; syncDirty(); check(); };

    const titreInput = el('input', { id: 'pr-titre', type: 'text', autocomplete: 'off', value: start.titre });
    const coursInput = el('input', { id: 'pr-cours', type: 'text', autocomplete: 'off', list: 'pr-cours-connus', value: start.cours ?? '' });
    const advice = el('div', { class: 'cours-conseil', 'aria-live': 'polite' });
    const listeBox = el('input', { id: 'pr-liste', type: 'checkbox', checked: start.liste });
    const titleField = field('pr-titre', 'Titre', titreInput, "Affiché à l'étudiant (accueil, page de l'exercice, barre du haut) et inscrit sur les attestations émises ensuite. Celles déjà émises ne changent pas. Un titre déjà pris par un autre exercice publié est refusé.", 'field--half');
    const coursField = field('pr-cours', 'Cours', coursInput, "Ex. M10 : l'accueil regroupe les exercices par cours. Vide, l'exercice va sous « Autres exercices ».");
    coursField.element.insertBefore(el('datalist', { id: 'pr-cours-connus' }, courses.map((course) => el('option', { value: course }))), coursField.noteEl);
    coursField.element.insertBefore(advice, coursField.noteEl);
    const listeField = field('pr-liste', "Proposé dans la liste de l'accueil", el('label', { class: 'choices', for: 'pr-liste' }, el('li', {}, el('label', { for: 'pr-liste' }, [listeBox, 'oui (sinon, joignable seulement par son lien)']))), '');

    // Une ligne par copie que la présentation connaît : sa photo et sa note ; une copie qui n'est plus dans la dernière
    // version sert encore aux séances épinglées à une plus ancienne.
    const rows = start.outils.map((entry, i) => {
      const info = shown.outils.find((o) => o.id === entry.id);
      const picker = imagePicker({ usage: 'outil', images: galleryImages(), value: entry.image, upload: (file) => uploadImage(file, 'outil'), onChange: onEdit, idPrefix: `pr-o${i}-image`, compact: true, readOnly: ro });
      const note = el('input', { id: `pr-o${i}-note`, type: 'text', autocomplete: 'off', class: 'input-note', value: entry.commentaire ?? '', 'aria-label': `Note de ${info?.nom ?? entry.id}` });
      const who = el('div', {}, [el('strong', {}, info?.nom ?? entry.id), el('div', { class: 'mono smaller muted' }, entry.id), ...(info?.derniere_version === false ? [el('div', { class: 'muted smaller' }, 'plus dans la dernière version (séances épinglées à une plus ancienne)')] : [])]);
      return { tr: el('tr', {}, [cell(who), cell(picker.element, 'picto-cell'), cell(note)]), read: () => ({ id: entry.id, image: picker.read(), commentaire: note.value.trim() === '' ? null : note.value.trim() }) };
    });
    const read = () => ({ titre: titreInput.value.trim(), cours: coursInput.value.trim() === '' ? null : coursInput.value.trim(), liste: listeBox.checked, outils: rows.map((r) => r.read()) });

    // L'aperçu : ce que voit l'étudiant — l'en-tête de la page de l'exercice, sa place à l'accueil, et chaque outil de la
    // dernière version avec sa photo et sa note (panneau de l'outil de la page Question).
    const preview = el('div', { class: 'presentation-apercu' });
    const paintPreview = (current) => {
      const p = presentationPreview(current);
      preview.replaceChildren(
        el('div', { class: 'eyebrow' }, ro ? "Aperçu — ce que voit l'étudiant" : "Aperçu — ce que voit l'étudiant, même non appliqué"),
        el('div', { class: 'apercu-entete' }, [el('div', { class: 'eyebrow' }, p.eyebrow), el('div', { class: 'apercu-titre' }, p.titre || '(sans titre)'), el('p', { class: 'muted smaller' }, p.accueil)]),
        el('ul', { class: 'apercu-outils' }, current.outils.filter((e) => shown.outils.find((o) => o.id === e.id)?.derniere_version !== false).map((e) => el('li', { class: 'apercu-outil' }, [
          el('img', { src: imageUrl(e.image ?? e.id), alt: '', onerror: (event) => { event.target.style.visibility = 'hidden'; } }),
          el('div', {}, [el('strong', { class: 'small' }, names.get(e.id) ?? e.id), el('p', { class: 'muted smaller' }, e.commentaire ? `Note : ${e.commentaire}` : 'Pas de note.')]),
        ]))),
      );
    };

    // Erreurs, titre déjà pris, avertissements, changements, bouton. Seule une photo CHOISIE (différente de celle en vigueur)
    // doit exister et ne pas être archivée ; une photo archivée déjà en vigueur n'est qu'un avertissement.
    // La consultation (D95) : l'aperçu et les avertissements, aucun bouton.
    const applyButton = ro ? null : el('button', { class: 'button button--direct', type: 'button' }, 'Appliquer…');
    function check() {
      const current = read();
      const errors = exercisePresentationErrors(current, { images: galleryImages(), inForce: shown.presentation, copies: knownCopies(shown.presentation) });
      const twins = liveTitleConflicts(current.titre, shown.presentation.titre, others, id);
      const lines = exercisePresentationDiff(shown.presentation, current, names);
      panelErrors.replaceChildren(...errors.map((m) => el('li', {}, m)));
      panelWarnings.replaceChildren(...exerciseArchivedWarnings(current, galleryImages(), names).map((m) => el('li', {}, m)));
      twinNotice.hidden = twins.length === 0;
      twinNotice.textContent = twins.length === 0 ? '' : liveTitleRefusal(twins);
      if (!ro) advice.replaceChildren(...courseAdviceFor(coursInput));
      paintPreview(current);
      if (applyButton) {
        const button = twins.length > 0 ? { enabled: false, label: 'Appliquer (titre déjà pris)' } : presentationApplyState(errors, lines);
        applyButton.disabled = !button.enabled;
        applyButton.textContent = button.label;
      }
      return { current, errors, lines, twins };
    }

    // « Appliquer… » : la liste des changements, puis l'application, effet immédiat.
    applyButton?.addEventListener('click', () => {
      const { current, errors, lines, twins } = check();
      if (errors.length > 0 || lines.length === 0 || twins.length > 0) return;
      const confirm = el('button', { class: 'button button--direct', type: 'button', onclick: async () => {
        confirm.disabled = true;
        try {
          const result = await guarded(() => editorExercisePresentationApply(id, shown.revision, current));
          if (result === null) return;
          await reloadPresentation(`Présentation appliquée à ${formatDateStamp(new Date().toISOString()).slice(11)} (${result.lignes.length} changement${result.lignes.length > 1 ? 's' : ''}). Effet immédiat : chaque page d'étudiant la montre dès qu'elle se recharge. Le contenu remplacé est dans l'historique.`);
        } catch (error) {
          confirm.disabled = false;
          panelStatus.replaceChildren(...failure(error));
        }
      } }, 'Appliquer maintenant');
      dialog.replaceChildren(el('section', { class: 'panel panel--direct' }, [
        el('div', { class: 'eyebrow' }, 'Confirmation — effet immédiat'),
        el('h3', {}, `Appliquer ${lines.length} changement${lines.length > 1 ? 's' : ''} de présentation, tout de suite ?`),
        el('ul', { class: 'editeur-diff' }, lines.map((line) => el('li', {}, line))),
        el('p', { class: 'small' }, "Tous les étudiants le voient dès que leur page se recharge, séances en cours comprises, quelle que soit leur version de l'exercice. Les valeurs, la correction et les attestations déjà émises ne changent pas. Une attestation émise ensuite inscrit le titre en vigueur. Le contenu remplacé va à l'historique : « Rétablir » le remet en un clic."),
        el('div', { class: 'form-actions' }, [confirm, el('button', { class: 'button-link', type: 'button', onclick: () => dialog.replaceChildren() }, 'Annuler')]),
      ]));
      dialog.scrollIntoView({ block: 'nearest' });
    });

    // « Rétablir » : un contenu de l'historique remis en vigueur, en un geste ; celui qu'il remplace va à l'historique.
    async function restore(entry) {
      if (presentationDirty && !window.confirm('Les modifications du panneau ne sont pas appliquées : elles seront perdues. Rétablir quand même ?')) return;
      try {
        const result = await guarded(() => editorExercisePresentationRestore(id, shown.revision, entry.id));
        if (result === null) return;
        const warnings = result.avertissements.length === 0 ? '' : ` Attention : ${result.avertissements.join(' ')}`;
        await reloadPresentation(`Présentation rétablie à ${formatDateStamp(new Date().toISOString()).slice(11)} (${result.lignes.length} changement${result.lignes.length > 1 ? 's' : ''}) : effet immédiat. Celle qu'elle remplace est dans l'historique.${warnings}`);
      } catch (error) {
        panelStatus.replaceChildren(...failure(error));
      }
    }
    const history = el('details', { class: 'presentation-historique' }, [
      el('summary', {}, `Historique (${shown.historique.length})`),
      shown.historique.length === 0
        ? el('p', { class: 'muted small' }, "Vide : chaque application y mettra le contenu qu'elle remplace.")
        : el('ul', { class: 'versions-liste historique-liste' }, shown.historique.map((h) => el('li', {}, [
          el('div', {}, [
            el('div', { class: 'small' }, exerciseHistoryLabel(h)),
            h.lignes.length === 0
              ? el('div', { class: 'muted smaller' }, 'Identique à la présentation en vigueur.')
              : el('details', {}, [el('summary', { class: 'muted smaller' }, `Rétablir changerait ${h.lignes.length} valeur${h.lignes.length > 1 ? 's' : ''}`), el('ul', { class: 'editeur-diff' }, h.lignes.map((line) => el('li', {}, line)))]),
          ]),
          ...(ro ? [] : [el('button', { class: 'button-small button-small--neutral', type: 'button', disabled: h.lignes.length === 0, onclick: () => restore(h) }, 'Rétablir')]),
        ]))),
    ]);

    // Les retouches de présentation en attente dans le brouillon (D78, point 10), s'il y en a (jamais pour la consultation).
    const pending = shown.en_attente;
    const pendingBox = pending.lignes.length === 0 ? '' : el('div', { class: 'avis-tables avis-presentation' }, [
      el('div', {}, [
        el('strong', {}, `Retouches de présentation en attente dans le brouillon (${pending.lignes.length})`),
        el('p', { class: 'small' }, "Faites dans le brouillon avant que la présentation passe en direct, elles n'ont jamais été publiées et ne le seront plus. Pour les garder, reprends-les dans ce panneau, vérifie l'aperçu, puis applique. La prochaine publication les abandonne."),
        el('ul', { class: 'editeur-diff' }, pending.lignes.map((line) => el('li', {}, line))),
      ]),
      el('button', { class: 'button-small', type: 'button', onclick: () => { renderPresentation(pending.contenu, 'Retouches reprises dans le panneau, pas encore appliquées : vérifie-les, puis « Appliquer… ».'); presentationDirty = true; syncDirty(); } }, 'Les reprendre dans le panneau'),
    ]);

    const onInput = (event) => { event.stopPropagation(); onEdit(); }; // pas jusqu'au brouillon, plus bas
    const fields = [
      el('div', { class: 'editeur-grid' }, [titleField.element, coursField.element, listeField.element]),
      el('h3', { class: 'presentation-titre' }, 'Outils : photo et note'),
      plainTable(['Outil', 'Photo', "Note affichée sous l'outil"], rows, 'tables-edit--outils'),
    ];
    presentationSlot.replaceChildren(el('section', { class: 'panel panel--direct presentation', ...(ro ? {} : { oninput: onInput, onchange: onInput }) }, [
      // En consultation (D95, retouche) : « Présentation en vigueur », sans la pastille — rien ne s'y applique.
      el('div', { class: 'panel-head' }, [el('div', { class: 'eyebrow' }, ro ? 'Présentation en vigueur' : 'Présentation — effet immédiat'), ...(ro ? [] : [el('span', { class: 'badge-direct' }, 'En direct')])]),
      el('h2', {}, "Présentation de l'exercice"),
      ro ? el('p', { class: 'small' }, "Lecture seule : ce que tous les étudiants voient de cet exercice, quelle que soit leur version. Le titre, le cours, « À l'accueil », la photo et la note de chaque outil. Les valeurs, la correction et les attestations n'en dépendent pas.") : el('p', { class: 'small' }, [
        el('strong', {}, "« Appliquer… » change ce que tous les étudiants voient de cet exercice dès que leur page se recharge, séances en cours comprises, quelle que soit leur version."),
        " Ce panneau n'a ni brouillon ni publication : ce qu'il montre est en vigueur. Il ne porte que ce qui s'affiche — le titre, le cours, « À l'accueil », la photo et la note de chaque outil. Les valeurs, la correction et les attestations déjà émises n'en dépendent pas.",
      ]),
      el('p', { class: 'muted small' }, `${shown.appliquee ? `Appliquée le ${formatDateStamp(shown.modifiee_le)} par ${shown.enseignant}` : `Jamais appliquée : c'est celle de la dernière version publiée (version ${shown.derniere_version})`} · révision ${shown.revision}.`),
      ...(ro ? [] : [el('div', { class: 'editeur-bar' }, [el('div', {}), el('div', { class: 'editeur-bar-actions' }, [applyButton])])]),
      panelStatus,
      panelErrors,
      twinNotice,
      twinWarning,
      panelWarnings,
      pendingBox,
      dialog,
      ...(ro ? [readOnlyBox(fields)] : fields),
      preview,
      history,
    ]));
    check();
  }
  if (live) renderPresentation(shown.presentation);

  // Les versions publiées : l'aperçu pour les deux rôles ; « Reprendre cette version », l'administration seulement.
  const versionsList = el('ul', { class: 'versions-liste' }, page.versions.length === 0 ? [el('li', {}, 'Aucune version publiée : les étudiants ne voient pas encore cet exercice.')] : page.versions.map((v) => el('li', {}, [
    el('strong', {}, `Version ${v.numero}`), el('span', { class: 'muted' }, `publiée le ${formatDateStamp(v.publiee_le)} · tables ${v.tables_id} · ${v.seances} séance${v.seances > 1 ? 's' : ''}`),
    el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => preview({ version: v.numero }, `de la version ${v.numero}`) }, 'Aperçu'),
    ...(ro ? [] : [el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => resumeVersion(v.numero) }, 'Reprendre cette version')]),
  ])));

  // La ligne d'état de la page : le brouillon (l'administration) ou la version lue (la consultation).
  const stateLine = ro
    ? ` · version ${page.derniere_version.numero} publiée le ${formatDateStamp(page.derniere_version.publiee_le)}`
    : ` · brouillon modifié le ${formatDateStamp(page.exercice.brouillon_modifie_le)}`;
  const part = ro ? `version ${page.derniere_version.numero}` : 'brouillon à publier';
  const screen = el('div', { class: 'screen screen--wide prof editeur', ...(ro ? {} : { oninput: () => { touch(); validate(); }, onchange: () => { touch(); validate(); } }) }, [
    el('section', { class: 'panel' }, [
      panelHead(`exercice · ${id}`, 'exercices'),
      heading,
      el('div', { class: 'editeur-bar' }, [
        el('div', { class: 'muted small' }, [
          `Identifiant ${id} · lien étudiant : `, el('span', { class: 'mono' }, studentLink(location.origin, id)),
          page.exercice.archive_le !== null ? ' · archivé' : '',
          stateLine,
          ' · tables de référence ', el('strong', { class: 'tables-version' }, page.exercice.tables_id),
        ]),
        el('div', { class: 'editeur-bar-actions' }, [
          el('button', { class: 'button-link', type: 'button', onclick: () => leave(showList) }, '← Exercices'),
          ...(ro ? [] : [
            el('button', { class: 'button-outline', type: 'button', onclick: () => preview({ brouillon: readDraft() }, 'du brouillon') }, 'Aperçu du brouillon'),
            cancelDraftButton,
            saveButton,
            publishButton,
          ]),
        ]),
      ]),
      status,
      tablesNoticePanel,
      generalErrors,
      dialogSlot,
    ]),
    presentationSlot,
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, live ? `Réglages généraux — ${part}` : 'Réglages généraux'),
      ...(live ? [el('p', { class: 'muted small' }, "Le titre, le cours et « À l'accueil » sont en direct, dans le panneau « Présentation » ci-dessus.")] : []),
      (ro ? readOnlyBox : (x) => x)(el('div', { class: 'editeur-grid' }, Object.values(settings).map((s) => s.element))),
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, live ? `Outils de l'exercice — ${part}` : "Outils de l'exercice"),
      el('p', { class: 'muted small' }, ro
        ? "Chaque outil est une copie indépendante de la banque : ses dimensions, matières et groupes sont ce que l'exercice permet. Déplie un outil pour le lire."
        : "Chaque outil est une copie indépendante de la banque : ses dimensions, matières et groupes sont ce que l'exercice permet. Modifier la banque ne change pas cet exercice."),
      ...(live && !ro ? [el('p', { class: 'muted small' }, "La photo et la note d'un outil déjà publié sont en direct, dans le panneau « Présentation ». Une copie nouvelle les reçoit ici (liseré doré), et sa publication les y fait passer.")] : []),
      (ro ? readOnlyBox : (x) => x)(toolsSlot),
      ...addTools,
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

export async function showBank(notice = '') {
  const bank = await guarded(() => editorBank());
  if (bank === null) return;
  const ro = readOnly();
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  const act = async (action, success) => {
    try { await guarded(action); await showBank(success); } catch (error) { status.textContent = serverErrorMessage(error); }
  };
  // Le badge « facteur forcé » (D83) : l'outil ne suit pas le facteur de son opération, dans les tables les plus récentes.
  const bankOps = new Map(bank.tables.operations.operations.map((op) => [op.operation, op]));
  const rows = bank.outils.map((row) => el('tr', {}, [
    el('td', {}, [el('button', { class: 'button-link', type: 'button', onclick: () => leave(showBankTool, row.id) }, row.outil.nom), ' ', forcedBadgeOf(row.outil, bankOps)]),
    el('td', { class: 'mono' }, row.id),
    el('td', {}, row.outil.operation),
    el('td', { class: 'num' }, String(row.outil.dimensions.length)),
    el('td', {}, row.exercices.length === 0 ? 'aucun' : `${row.exercices.length} (${row.exercices.join(', ')})`),
    el('td', { class: row.archive_le === null ? '' : 'state--running' }, row.archive_le === null ? 'disponible' : `archivé le ${formatDateStamp(row.archive_le)}`),
    // La consultation (D95) : « Voir », rien d'autre.
    el('td', { class: 'actions' }, el('div', { class: 'actions-group' }, ro ? [el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => leave(showBankTool, row.id) }, 'Voir')] : [
      el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => leave(showBankTool, row.id) }, 'Modifier'),
      el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => {
        const id = window.prompt(`Identifiant du nouvel outil (minuscules, chiffres, soulignés), copie de « ${row.outil.nom} » :`, `${row.id}_2`);
        if (id) act(() => editorBankCreate({ id: id.trim(), depuis: row.id }), `« ${row.outil.nom} » dupliqué sous « ${id.trim()} ».`);
      } }, 'Dupliquer'),
      row.archive_le === null
        ? el('button', { class: 'button-small', type: 'button', onclick: () => { if (window.confirm(`Archiver « ${row.outil.nom} » ? Il ne sera plus proposé à l'ajout dans un exercice. Les copies déjà faites ne changent pas.`)) act(() => editorBankArchive(row.id, true), `« ${row.outil.nom} » archivé.`); } }, 'Archiver')
        : el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => act(() => editorBankArchive(row.id, false), `« ${row.outil.nom} » rétabli.`) }, 'Rétablir'),
    ])),
  ]));
  const idInput = el('input', { id: 'nouvel-outil', type: 'text', autocomplete: 'off', placeholder: 'fraise_a_rainurer' });
  // Un outil neuf hérite du facteur de vitesse de son opération (D83) ; avec des tables d'avant, il porte le sien : 1.
  const blank = { nom: 'Nouvel outil', format_identifiant: '[NomOutil] [IdDia]', commentaire: '', operation: bank.tables.operations.operations[0].operation, ...(carriesSpeedFactors(bank.tables.operations.operations) ? {} : { fact_vc: 1 }), fact_av: 1, limite_rpm: 10000, nb_dents_min: 1, nb_dents_max: 1, materiaux_outil: ['Acier rapide'], groupes_materiaux_usinables: [bank.tables.materiaux.groupes_iso[0]], image: null, dimensions: [{ libelle: 'Ø 1/4 po', valeur: 0.25 }] };
  const screen = el('div', { class: 'screen screen--wide prof editeur' }, el('section', { class: 'panel' }, [
    panelHead("banque d'outils", 'banque'),
    el('h1', { tabindex: '-1' }, "Banque d'outils"),
    el('p', { class: 'muted small' }, ro
      ? "Les outils qu'on copie dans un exercice. Lecture seule : chaque outil s'ouvre avec son historique. Le nombre d'exercices est donné à titre d'information."
      : "Les outils qu'on copie dans un exercice. Modifier un outil ici ne change aucun exercice existant. Le nombre d'exercices est donné à titre d'information."),
    status,
    el('div', { class: 'table-wrap' }, el('table', { class: 'prof-table' }, [
      el('thead', {}, el('tr', {}, ['Nom', 'Identifiant', 'Opération', 'Dimensions', 'Exercices qui en ont une copie', 'État', 'Actions'].map((label) => el('th', {}, label)))),
      el('tbody', {}, rows),
    ])),
    el('p', { class: 'muted smaller prof-count' }, `${rows.length} outil${rows.length > 1 ? 's' : ''}.`),
    ...(ro ? [] : [el('form', { class: 'ajout-outil', novalidate: true, onsubmit: (event) => { event.preventDefault(); act(() => editorBankCreate({ id: idInput.value.trim(), outil: { ...blank, id: idInput.value.trim() } }), 'Outil créé : ouvre-le pour le compléter.'); } }, [
      el('div', { class: 'field' }, [el('label', { for: 'nouvel-outil' }, 'Nouvel outil : identifiant'), idInput, el('div', { class: 'field-note' }, 'Minuscules, chiffres et soulignés. Définitif.')]),
      el('button', { class: 'button-outline', type: 'submit' }, 'Créer un outil'),
    ])]),
  ]));
  showScreen(main, screen, { title: TITLE, aside: headerAside() }, 'h1');
}

async function showBankTool(id, notice = '') {
  let page;
  try {
    page = await guarded(() => editorBankTool(id));
  } catch (error) {
    if (error.status === 404) { showBank(`L'outil « ${id} » n'existe pas.`); return; }
    throw error;
  }
  if (page === null) return;
  const ro = readOnly();
  const row = page.outil;
  const images = await loadImages('outil');
  if (images === null) return;
  const { tables } = page;
  const opsByName = new Map(tables.operations.operations.map((op) => [op.operation, op]));
  let { revision } = row;
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  applyTableColors(tables.materiaux);
  const form = toolForm(row.outil, { tables, opsByName, images, copy: false, prefix: 'b', readOnly: ro });
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

  // Un refus du serveur, en clair : 409 (enregistré ailleurs) avec « Recharger la page », sinon son message.
  const failure = (error) => (error.status === 409
    ? [el('strong', {}, error.message), ' ', el('button', { class: 'button-link', type: 'button', onclick: () => { setDirty(false); showBankTool(id); } }, 'Recharger la page')]
    : [error.status === 400 || error.status === 404 ? error.message : serverErrorMessage(error)]);
  const time = () => formatDateStamp(new Date().toISOString()).slice(11);
  const errorsText = (erreurs) => (erreurs.length > 0 ? ` Avec les tables d'aujourd'hui, ${erreurs.length} erreur${erreurs.length > 1 ? 's' : ''} (sous les champs). Tant qu'elles restent, cet outil ne peut pas être ajouté à un exercice.` : '');
  const warningsText = (avertissements) => (avertissements.length > 0 ? ` Attention : ${avertissements.join(' ')}` : '');

  // Enregistrer : le contenu remplacé va à l'historique (D79) ; sans changement, rien n'est écrit. Pas pour la consultation.
  const saveButton = ro ? null : el('button', { class: 'button', type: 'button', onclick: async () => {
    const tool = validate();
    saveButton.disabled = true;
    try {
      const result = await guarded(() => editorBankSave(id, revision, tool));
      if (result === null) return;
      setDirty(false);
      if (result.inchange) { status.textContent = "Aucun changement : rien n'a été enregistré."; return; }
      showBankTool(id, `Outil enregistré à ${time()} (révision ${result.revision}) : ${result.lignes.length} changement${result.lignes.length > 1 ? 's' : ''}. Le contenu remplacé est dans l'historique.${errorsText(result.erreurs)}${warningsText(result.avertissements)}`);
    } catch (error) {
      status.replaceChildren(...failure(error));
    } finally {
      saveButton.disabled = false;
    }
  } }, "Enregistrer l'outil");

  // L'historique (D79), replié : chaque contenu remplacé, ce que le rétablir changerait, ses erreurs et avertissements avec
  // les tables d'aujourd'hui, et « Rétablir » — un clic, sans confirmation, sauf si la page a des modifications non enregistrées.
  async function restore(entry) {
    if (isDirty() && !window.confirm("Les modifications de la page ne sont pas enregistrées : elles seront perdues. Rétablir quand même ?")) return;
    try {
      const result = await guarded(() => editorBankRestore(id, revision, entry.id));
      if (result === null) return;
      setDirty(false);
      showBankTool(id, `Contenu rétabli à ${time()} (${result.lignes.length} changement${result.lignes.length > 1 ? 's' : ''}). Celui qu'il remplace est dans l'historique.${errorsText(result.erreurs)}${warningsText(result.avertissements)}`);
    } catch (error) {
      status.replaceChildren(...failure(error));
    }
  }
  const history = el('details', { class: 'presentation-historique banque-historique' }, [
    el('summary', {}, `Historique (${page.historique.length})`),
    page.historique.length === 0
      ? el('p', { class: 'muted small' }, 'Vide : chaque fois que tu enregistres, le contenu remplacé vient ici.')
      : el('ul', { class: 'versions-liste historique-liste' }, page.historique.map((h) => el('li', {}, [
        el('div', {}, [
          el('div', { class: 'small' }, bankHistoryLabel(h)),
          h.lignes.length === 0
            ? el('div', { class: 'muted smaller' }, 'Identique au contenu actuel.')
            : el('details', {}, [el('summary', { class: 'muted smaller' }, `Rétablir changerait ${h.lignes.length} valeur${h.lignes.length > 1 ? 's' : ''}`), el('ul', { class: 'editeur-diff' }, h.lignes.map((line) => el('li', {}, line)))]),
          ...(h.erreurs.length === 0 ? [] : [
            el('p', { class: 'small historique-erreurs' }, `Avec les tables d'aujourd'hui, ce contenu a ${h.erreurs.length} erreur${h.erreurs.length > 1 ? 's' : ''}. Il se rétablit quand même, et elle${h.erreurs.length > 1 ? 's' : ''} ser${h.erreurs.length > 1 ? 'ont' : 'a'} à corriger :`),
            el('ul', { class: 'editeur-erreurs' }, h.erreurs.map((message) => el('li', {}, message))),
          ]),
          el('ul', { class: 'avertissements' }, h.avertissements.map((message) => el('li', {}, message))),
        ]),
        ...(ro ? [] : [el('button', { class: 'button-small button-small--neutral', type: 'button', disabled: h.lignes.length === 0, onclick: () => restore(h) }, 'Rétablir')]),
      ]))),
  ]);

  const saved = row.modifie_le ? ` · contenu enregistré le ${formatDateStamp(row.modifie_le)}${row.modifie_par ? ` par ${row.modifie_par}` : ''}` : '';
  const screen = el('div', { class: 'screen screen--wide prof editeur', ...(ro ? {} : { oninput: () => { setDirty(true); validate(); }, onchange: () => { setDirty(true); validate(); } }) }, el('section', { class: 'panel' }, [
    panelHead(`banque · ${id}`, 'banque'),
    el('h1', { tabindex: '-1' }, row.outil.nom),
    el('div', { class: 'editeur-bar' }, [
      el('div', { class: 'muted small' }, `Identifiant ${id} · révision ${revision}${saved} · ${row.exercices.length === 0 ? "copié dans aucun exercice" : `copié dans : ${row.exercices.join(', ')}`} (les copies ne suivent pas)${row.archive_le === null ? '' : ' · archivé'}`),
      el('div', { class: 'editeur-bar-actions' }, [el('button', { class: 'button-link', type: 'button', onclick: () => leave(showBank) }, '← Banque'), ...(ro ? [] : [saveButton])]),
    ]),
    status,
    generalErrors,
    el('ul', { class: 'avertissements' }, page.avertissements.map((message) => el('li', {}, message))),
    history,
    ro ? readOnlyBox(form.element) : form.element,
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

export async function showBackup(notice = '') {
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
      status.textContent = missing.length > 0 ? `${missing.length} image(s) envoyée(s). Import en cours…` : 'Import en cours…';
      const result = await guarded(() => editorImport(fiches, word));
      if (result === null) return;
      forgetImages();
      showBackup(`Import terminé : ${importSummaryLines(result.resume).slice(0, 6).join(' ')}`);
    } catch (error) {
      status.textContent = error.status === 400 && error.details.erreurs ? `Rien n'a été importé. ${error.details.erreurs.join(' ')}` : serverErrorMessage(error);
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
    el('p', { class: 'small' }, "L'export contient la banque d'outils, les exercices avec leurs brouillons et toutes leurs versions, les tables de référence et les images (photos et pictogrammes). Jamais de données d'étudiants. L'import fusionne un export dans la base. Il ajoute ce qui manque (les images absentes sont envoyées une à une, avant le reste), remplace les brouillons et la banque, ne supprime jamais une version publiée et ne touche ni aux séances ni aux attestations."),
    status,
    el('ol', { class: 'sauvegarde-etapes' }, [
      el('li', {}, [el('div', {}, 'Exporter tout en JSON, à garder en lieu sûr (par exemple avant une grosse retouche).'), el('p', {}, el('button', { class: 'button-outline', type: 'button', onclick: async () => {
        try {
          const data = await guarded(() => editorExport());
          if (data !== null) download(exportFileName(new Date()), JSON.stringify(data, null, 2));
        } catch (error) { status.textContent = serverErrorMessage(error); }
      } }, 'Exporter tout en JSON'))]),
      el('li', {}, [el('div', {}, "Importer un export : il est d'abord validé et résumé. Rien n'est écrit avant la confirmation."), el('div', { class: 'field' }, [el('label', { for: 'fichier' }, 'Fichier JSON'), fileInput]), summary, el('div', { class: 'form-actions' }, importButton)]),
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
//   readOnly (D95) : la consultation — les lignes sans leur colonne d'actions
function editableRows(rows, build, blank, onChange, { readOnly: ro = false } = {}) {
  let items = rows.map((row) => structuredClone(row));
  let built = [];
  const body = el('tbody');
  function render() {
    built = items.map((row, i) => {
      const { tr, read } = build(row, i);
      if (!ro) {
        tr.append(el('td', { class: 'actions' }, el('div', { class: 'actions-group' }, [
          el('button', { class: 'button-small button-small--neutral', type: 'button', disabled: i === 0, title: 'Monter', onclick: () => { items = built.map((b) => b.read()); [items[i - 1], items[i]] = [items[i], items[i - 1]]; render(); onChange(); } }, '↑'),
          el('button', { class: 'button-small button-small--neutral', type: 'button', disabled: i === items.length - 1, title: 'Descendre', onclick: () => { items = built.map((b) => b.read()); [items[i], items[i + 1]] = [items[i + 1], items[i]]; render(); onChange(); } }, '↓'),
          el('button', { class: 'button-small', type: 'button', title: 'Retirer', onclick: () => { items = built.map((b) => b.read()); items.splice(i, 1); render(); onChange(); } }, 'Retirer'),
        ])));
      }
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

// Les caractéristiques d'une classe ISO (D65), ligne par ligne : libellé, texte, solution facultative, avec
// ↑ ↓ Retirer, et « Ajouter une ligne » (au plus CHARACTERISTIC_LIMITS.lignes). Retourne { element, read() }.
//   readOnly (D95) : la consultation — les lignes seules, sans ↑ ↓ Retirer ni « Ajouter une ligne »
function characteristicsEditor(lines, idPrefix, code, onChange, { readOnly: ro = false } = {}) {
  let items = lines.map((l) => ({ ...l }));
  let built = [];
  const body = el('tbody');
  const addButton = ro ? null : el('button', { class: 'button-small button-small--neutral', type: 'button' }, 'Ajouter une ligne');
  const readAll = () => built.map((b) => b.read());
  function render() {
    built = items.map((line, n) => {
      const input = (key, width) => el('input', { id: `${idPrefix}-${n}-${key}`, type: 'text', autocomplete: 'off', class: width, value: line[key] ?? '', 'aria-label': `Classe ${code}, ligne ${n + 1} : ${{ libelle: 'libellé', texte: 'texte', solution: 'solution' }[key]}` });
      const libelle = input('libelle', 'input-moyen');
      const texte = input('texte', 'input-long');
      const solution = input('solution', 'input-long');
      const move = (delta) => { items = moveItem(readAll(), n, delta); render(); onChange(); };
      const tr = el('tr', {}, [
        el('td', {}, libelle), el('td', {}, texte), el('td', {}, solution),
        ...(ro ? [] : [el('td', { class: 'actions' }, el('div', { class: 'actions-group' }, [
          el('button', { class: 'button-small button-small--neutral', type: 'button', title: 'Monter', disabled: n === 0, onclick: () => move(-1) }, '↑'),
          el('button', { class: 'button-small button-small--neutral', type: 'button', title: 'Descendre', disabled: n === items.length - 1, onclick: () => move(1) }, '↓'),
          el('button', { class: 'button-small', type: 'button', title: 'Retirer', onclick: () => { items = readAll(); items.splice(n, 1); render(); onChange(); } }, 'Retirer'),
        ]))]),
      ]);
      return { tr, read: () => characteristicFrom(libelle.value, texte.value, solution.value) };
    });
    body.replaceChildren(...built.map((b) => b.tr));
    if (addButton) addButton.disabled = items.length >= CHARACTERISTIC_LIMITS.lignes;
  }
  addButton?.addEventListener('click', () => { items = [...readAll(), { libelle: '', texte: '' }]; render(); onChange(); });
  render();
  const element = el('div', { class: 'caracteristiques' }, [
    el('table', { class: 'caracteristiques-table' }, [el('thead', {}, el('tr', {}, ['Libellé', 'Texte', 'Solution (facultative)', ...(ro ? [] : [''])].map((h) => el('th', {}, h)))), body]),
    ...(ro ? [] : [addButton]),
  ]);
  return { element, read: readAll };
}

// Un tableau sans colonne d'actions (le panneau de la présentation : ses lignes sont celles des tables, fixes).
const plainTable = (headers, rows, className = '') => el('div', { class: 'table-wrap' }, el('table', { class: `prof-table tables-edit ${className}`.trim() }, [
  el('thead', {}, el('tr', {}, headers.map((h) => el('th', {}, h)))),
  el('tbody', {}, rows.map((row) => row.tr)),
]));

// L'onglet Tables de référence (D61 à D63, D76) : deux parties, qui ne s'enregistrent pas de la même façon.
//   - « Présentation — effet immédiat » : ce qui ne fait qu'afficher (noms et couleurs des classes, images de chaleur,
//     légendes, caractéristiques, couleurs des matières d'outil, pictogrammes) ; pas de brouillon : « Appliquer… »
//     change la page de tous les étudiants dès qu'elle se recharge ; l'historique garde chaque contenu remplacé.
//   - « Valeurs — brouillon à publier » : le reste, un brouillon unique et des versions immuables (D61). Pour une clé que
//     la présentation connaît, les champs de présentation n'y sont plus (ils y restent, cachés, sans effet) ; une classe
//     ou une opération nouvelle y reçoit sa présentation de départ (D76, point 9).
export async function showTables(notice = '') {
  const page = await guarded(() => editorTables());
  if (page === null) return;
  const ro = readOnly();
  let shown = await guarded(() => editorPresentation());
  if (shown === null) return;
  const pictos = await loadImages('operation');
  if (pictos === null) return;
  const classImagesList = await loadImages('classe');
  if (classImagesList === null) return;
  const exercises = (await guarded(() => editorListExercises()))?.exercices ?? [];
  let revision = ro ? null : page.brouillon.revision;
  // La dernière version publiée des tables : ce à quoi « Annuler les modifications » ramène le brouillon (D77), et ce que
  // la consultation lit à la place du brouillon, que le serveur ne lui envoie pas (D95).
  const latestTables = page.derniere === null ? null : (await guarded(() => editorTablesVersion(page.derniere)))?.tables ?? null;
  if (ro && latestTables === null) { showTablesEmpty(); return; }
  const draft = ro ? latestTables : page.brouillon.contenu;
  let pending = ro ? { lignes: [], contenu: null } : page.presentation_en_attente;
  // Le brouillon se lit prérempli des facteurs de vitesse (D83) : revenir à une version d'avant, c'est revenir à elle,
  // préremplie de même — « Annuler » n'a rien à annuler quand le brouillon n'en diffère que par là.
  const cancelTarget = ro || latestTables === null ? null : prefillSpeedFactors(latestTables);
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  const errorsList = el('ul', { class: 'editeur-erreurs' });
  const dialogSlot = el('div');
  // Deux choses peuvent ne pas être enregistrées : le brouillon, et le panneau de la présentation (pas encore appliqué).
  let draftDirty = false;
  let presentationDirty = false;
  const syncDirty = () => { setDirty(draftDirty || presentationDirty); };
  const touch = () => { draftDirty = true; syncDirty(); };
  // Les clés que la présentation en vigueur connaît (D76, point 9) : leurs champs de présentation quittent le brouillon.
  const known = presentationKeys(shown.presentation);
  const liveClass = (code) => shown.presentation.classes_iso.find((c) => c.code === code);

  // --- La présentation en direct (D75, D76) : un panneau à part, redessiné après chaque application ----------------------
  const presentationSlot = el('div');
  const published = exercises.filter((e) => e.derniere_version !== null);
  const presentationImages = () => [...(state.images.classe ?? []), ...(state.images.operation ?? [])];

  // Relit la présentation (et les retouches en attente du brouillon) et redessine le panneau ; le brouillon n'est pas touché.
  async function reloadPresentation(message) {
    const next = await guarded(() => editorPresentation());
    if (next === null) return;
    shown = next;
    pending = (await guarded(() => editorTables()))?.presentation_en_attente ?? pending;
    presentationDirty = false;
    syncDirty();
    renderPresentation(shown.presentation, message);
    validate();
  }

  // Un refus du serveur, en clair : 409 (appliquée ailleurs) avec « Recharger le panneau », 400 avec ses erreurs.
  const failure = (error) => {
    if (error.status === 409) return [el('strong', {}, error.message), ' ', el('button', { class: 'button-link', type: 'button', onclick: () => reloadPresentation('') }, 'Recharger le panneau')];
    if (error.status === 400 && Array.isArray(error.details?.erreurs)) return [el('strong', {}, error.message), el('ul', { class: 'editeur-erreurs' }, error.details.erreurs.map((m) => el('li', {}, m)))];
    return [error.status === 400 || error.status === 404 ? error.message : serverErrorMessage(error)];
  };

  //   start : le contenu à montrer — la présentation en vigueur, ou celle qui reprend les retouches en attente
  function renderPresentation(start, message = '') {
    const panelStatus = el('div', { class: 'server-message', role: 'status' }, message);
    const panelErrors = el('ul', { class: 'editeur-erreurs' });
    const panelWarnings = el('ul', { class: 'avertissements' }); // une image archivée en vigueur : dite, jamais bloquante (D76, retouche)
    const dialog = el('div');
    const toolNames = new Map(shown.matieres_outil.map((m) => [m.cle, m.nom]));
    const onEdit = () => { presentationDirty = true; syncDirty(); check(); };

    const classRows = start.classes_iso.map((c, i) => {
      const nom = textInput(`pr-cl-${i}-nom`, c.nom);
      const couleur = colorInput(`pr-cl-${i}-couleur`, c.couleur);
      const texte = colorInput(`pr-cl-${i}-texte`, c.couleur_texte);
      const ligne = colorInput(`pr-cl-${i}-ligne`, c.couleur_ligne);
      const swatch = el('span', { class: 'choice-swatch', 'aria-hidden': 'true' }, c.code);
      const paint = () => { swatch.style.background = couleur.value; swatch.style.color = texte.value; };
      for (const input of [couleur, texte]) input.addEventListener('input', paint);
      paint();
      const chaleur = imagePicker({ usage: 'classe', images: state.images.classe, value: c.image_chaleur ?? null, upload: (file) => uploadImage(file, 'classe'), onChange: onEdit, idPrefix: `pr-cl-${i}-chaleur`, compact: true, readOnly: ro });
      // La légende de l'image (D68) : 40 caractères au plus ; vide, pas de légende.
      const legende = textInput(`pr-cl-${i}-legende`, c.legende_image ?? '', { class: 'input-legende' });
      const features = characteristicsEditor(c.caracteristiques ?? [], `pr-cl-${i}-car`, c.code, onEdit, { readOnly: ro });
      return {
        tr: el('tr', {}, [cell(swatch, 'num'), cell(el('span', { class: 'mono' }, c.code)), cell(nom), cell(couleur), cell(texte), cell(ligne), cell(chaleur.element, 'picto-cell'), cell(legende), cell(features.element, 'caracteristiques-cell')]),
        read: () => ({ code: c.code, nom: nom.value.trim(), couleur: couleur.value, couleur_texte: texte.value, couleur_ligne: ligne.value, image_chaleur: chaleur.read(), legende_image: legende.value.trim(), caracteristiques: features.read() }),
      };
    });
    const toolRows = start.materiaux_outil.map((m, i) => {
      const couleur = colorInput(`pr-mo-${i}-couleur`, m.couleur);
      return { tr: el('tr', {}, [cell(el('span', { class: 'mono smaller' }, m.cle)), cell(toolNames.get(m.cle) ?? '—'), cell(couleur)]), read: () => ({ cle: m.cle, couleur: couleur.value }) };
    });
    const opRows = start.operations.map((op, i) => {
      const picker = imagePicker({ usage: 'operation', images: state.images.operation, value: op.pictogramme ?? null, upload: (file) => uploadImage(file, 'operation'), onChange: onEdit, idPrefix: `pr-op-${i}-picto`, compact: true, readOnly: ro });
      return { tr: el('tr', {}, [cell(op.operation), cell(picker.element, 'picto-cell')]), read: () => ({ operation: op.operation, pictogramme: picker.read() }) };
    });
    const read = () => ({ classes_iso: classRows.map((r) => r.read()), materiaux_outil: toolRows.map((r) => r.read()), operations: opRows.map((r) => r.read()) });

    // Erreurs, avertissements, changements, bouton ; les couleurs de la page suivent le panneau à la frappe (même non
    // appliqué). Seule une image CHOISIE (différente de celle en vigueur) doit exister et ne pas être archivée ; une image
    // archivée déjà en vigueur n'est qu'un avertissement, qui ne bloque pas « Appliquer » (D76, retouche).
    // La consultation (D95) : les avertissements et les couleurs, aucun bouton.
    const applyButton = ro ? null : el('button', { class: 'button button--direct', type: 'button' }, 'Appliquer…');
    function check() {
      const current = read();
      const errors = presentationErrors(current, { images: presentationImages(), inForce: shown.presentation });
      const lines = presentationDiff(shown.presentation, current, toolNames);
      panelErrors.replaceChildren(...errors.map((m) => el('li', {}, m)));
      panelWarnings.replaceChildren(...archivedWarnings(current, presentationImages()).map((m) => el('li', {}, m)));
      if (applyButton) {
        const button = presentationApplyState(errors, lines);
        applyButton.disabled = !button.enabled;
        applyButton.textContent = button.label;
      }
      applyTableColors({ classes_iso: current.classes_iso, materiaux_outil: current.materiaux_outil });
      return { current, errors, lines };
    }

    // « Appliquer… » : la liste des changements, puis l'application, effet immédiat.
    applyButton?.addEventListener('click', () => {
      const { current, errors, lines } = check();
      if (errors.length > 0 || lines.length === 0) return;
      const confirm = el('button', { class: 'button button--direct', type: 'button', onclick: async () => {
        confirm.disabled = true;
        try {
          const result = await guarded(() => editorPresentationApply(shown.revision, current));
          if (result === null) return;
          await reloadPresentation(`Présentation appliquée à ${formatDateStamp(new Date().toISOString()).slice(11)} (${result.lignes.length} changement${result.lignes.length > 1 ? 's' : ''}). Effet immédiat : chaque page d'étudiant la montre dès qu'elle se recharge. Le contenu remplacé est dans l'historique.`);
        } catch (error) {
          confirm.disabled = false;
          panelStatus.replaceChildren(...failure(error));
        }
      } }, 'Appliquer maintenant');
      dialog.replaceChildren(el('section', { class: 'panel panel--direct' }, [
        el('div', { class: 'eyebrow' }, 'Confirmation — effet immédiat'),
        el('h3', {}, `Appliquer ${lines.length} changement${lines.length > 1 ? 's' : ''} de présentation, tout de suite ?`),
        el('ul', { class: 'editeur-diff' }, lines.map((line) => el('li', {}, line))),
        el('p', { class: 'small' }, "Tous les étudiants le voient dès que leur page se recharge, séances en cours comprises, quelle que soit leur version des tables. Les valeurs (Vc, avances), la correction et les attestations ne changent pas. Le contenu remplacé va à l'historique : « Rétablir » le remet en un clic."),
        el('div', { class: 'form-actions' }, [confirm, el('button', { class: 'button-link', type: 'button', onclick: () => dialog.replaceChildren() }, 'Annuler')]),
      ]));
      dialog.scrollIntoView({ block: 'nearest' });
    });

    // L'aperçu (D75, point 5) : dix questions de la dernière version publiée d'un exercice, avec la présentation du panneau.
    const previewSelect = el('select', { id: 'pr-apercu-exercice' }, published.map((e) => el('option', { value: e.id }, e.titre_publie ?? e.titre)));
    async function preview() {
      const row = published.find((e) => e.id === previewSelect.value);
      if (!row) return;
      try {
        const result = await guarded(() => editorPreview({ id: row.id, version: row.derniere_version }));
        if (result === null) return;
        dialog.replaceChildren(el('section', { class: 'panel' }, [
          el('div', { class: 'eyebrow' }, "Aperçu — rien n'est appliqué"),
          el('h3', {}, `Dix questions de « ${row.titre_publie ?? row.titre} » (version ${row.derniere_version}) avec cette présentation`),
          el('p', { class: 'muted small' }, "La dernière version publiée de l'exercice, montrée avec la présentation telle qu'elle est dans ce panneau, même non appliquée : l'image de chaleur de chaque classe, sa légende et ses caractéristiques. Les couleurs de la page suivent déjà le panneau."),
          previewTable(result, read().classes_iso),
          el('div', { class: 'form-actions' }, [el('button', { class: 'button-outline', type: 'button', onclick: preview }, 'Dix autres'), el('button', { class: 'button-link', type: 'button', onclick: () => dialog.replaceChildren() }, 'Fermer')]),
        ]));
        dialog.scrollIntoView({ block: 'nearest' });
      } catch (error) {
        panelStatus.replaceChildren(...failure(error));
      }
    }

    // « Rétablir » : un contenu de l'historique remis en vigueur, en un geste ; celui qu'il remplace va à l'historique.
    async function restore(entry) {
      if (presentationDirty && !window.confirm('Les modifications du panneau ne sont pas appliquées : elles seront perdues. Rétablir quand même ?')) return;
      try {
        const result = await guarded(() => editorPresentationRestore(shown.revision, entry.id));
        if (result === null) return;
        const warnings = result.avertissements.length === 0 ? '' : ` Attention : ${result.avertissements.join(' ')}`;
        await reloadPresentation(`Présentation rétablie à ${formatDateStamp(new Date().toISOString()).slice(11)} (${result.lignes.length} changement${result.lignes.length > 1 ? 's' : ''}) : effet immédiat. Celle qu'elle remplace est dans l'historique.${warnings}`);
      } catch (error) {
        panelStatus.replaceChildren(...failure(error));
      }
    }
    const history = el('details', { class: 'presentation-historique' }, [
      el('summary', {}, `Historique (${shown.historique.length})`),
      shown.historique.length === 0
        ? el('p', { class: 'muted small' }, "Vide : chaque application y mettra le contenu qu'elle remplace.")
        : el('ul', { class: 'versions-liste historique-liste' }, shown.historique.map((h) => el('li', {}, [
          el('div', {}, [
            el('div', { class: 'small' }, presentationHistoryLabel(h)),
            h.lignes.length === 0
              ? el('div', { class: 'muted smaller' }, 'Identique à la présentation en vigueur.')
              : el('details', {}, [el('summary', { class: 'muted smaller' }, `Rétablir changerait ${h.lignes.length} valeur${h.lignes.length > 1 ? 's' : ''}`), el('ul', { class: 'editeur-diff' }, h.lignes.map((line) => el('li', {}, line)))]),
          ]),
          ...(ro ? [] : [el('button', { class: 'button-small button-small--neutral', type: 'button', disabled: h.lignes.length === 0, onclick: () => restore(h) }, 'Rétablir')]),
        ]))),
    ]);

    // Les retouches de présentation en attente dans le brouillon (D76, point 10), s'il y en a (jamais pour la consultation).
    const pendingBox = pending.lignes.length === 0 ? '' : el('div', { class: 'avis-tables avis-presentation' }, [
      el('div', {}, [
        el('strong', {}, `Retouches de présentation en attente dans le brouillon des tables (${pending.lignes.length})`),
        el('p', { class: 'small' }, "Faites dans le brouillon avant que la présentation passe en direct, elles n'ont jamais été publiées et ne le seront plus. Pour les garder, reprends-les dans ce panneau, vérifie l'aperçu, puis applique. La prochaine publication des tables les abandonne."),
        el('ul', { class: 'editeur-diff' }, pending.lignes.map((line) => el('li', {}, line))),
      ]),
      el('button', { class: 'button-small', type: 'button', onclick: () => { renderPresentation(pending.contenu, 'Retouches reprises dans le panneau, pas encore appliquées : vérifie-les, puis « Appliquer… ».'); presentationDirty = true; syncDirty(); } }, 'Les reprendre dans le panneau'),
    ]);

    const onInput = (event) => { event.stopPropagation(); onEdit(); }; // pas jusqu'au brouillon, plus bas
    const fields = [
      el('h3', { class: 'presentation-titre' }, 'Classes ISO'),
      plainTable(['', 'Code', 'Nom', 'Couleur', 'Texte', 'Ligne', 'Image de chaleur', 'Légende', 'Caractéristiques'], classRows, 'tables-edit--classes'),
      el('h3', { class: 'presentation-titre' }, "Matières d'outil"),
      plainTable(['Clé', ro ? 'Nom' : 'Nom (dans le brouillon)', 'Couleur'], toolRows),
      el('h3', { class: 'presentation-titre' }, 'Opérations'),
      plainTable(['Opération', 'Pictogramme'], opRows, 'tables-edit--operations'),
    ];
    presentationSlot.replaceChildren(el('section', { class: 'panel panel--direct presentation', ...(ro ? {} : { oninput: onInput, onchange: onInput }) }, [
      // En consultation (D95, retouche) : « Présentation en vigueur », sans la pastille — rien ne s'y applique.
      el('div', { class: 'panel-head' }, [el('div', { class: 'eyebrow' }, ro ? 'Présentation en vigueur' : 'Présentation — effet immédiat'), ...(ro ? [] : [el('span', { class: 'badge-direct' }, 'En direct')])]),
      el('h2', {}, 'Présentation des tables'),
      ro ? el('p', { class: 'small' }, "Lecture seule : ce qui ne fait qu'afficher, en vigueur sur la page de tous les étudiants, quelle que soit leur version des tables. Noms et couleurs des classes ISO, images de chaleur, légendes, caractéristiques, couleurs des matières d'outil, pictogrammes.") : el('p', { class: 'small' }, [
        el('strong', {}, "« Appliquer… » change la page de tous les étudiants dès qu'elle se recharge, séances en cours comprises, quelle que soit leur version des tables."),
        " Ce panneau n'a ni brouillon ni publication : ce qu'il montre est en vigueur. Il ne porte que ce qui s'affiche — noms et couleurs des classes ISO, images de chaleur, légendes (40 caractères au plus, aucune si vide), caractéristiques (au plus 6 lignes), couleurs des matières d'outil, pictogrammes. Les valeurs, la correction et les attestations n'en dépendent pas.",
      ]),
      el('p', { class: 'muted small' }, `${shown.appliquee ? `Appliquée le ${formatDateStamp(shown.modifiee_le)} par ${shown.enseignant}` : `Jamais appliquée : c'est celle de la dernière version des tables (${shown.derniere_tables})`} · révision ${shown.revision}.`),
      el('div', { class: 'editeur-bar' }, [
        el('div', {}),
        el('div', { class: 'editeur-bar-actions' }, [
          el('label', { for: 'pr-apercu-exercice', class: 'muted small' }, 'Aperçu avec :'), previewSelect,
          el('button', { class: 'button-outline', type: 'button', onclick: preview, disabled: published.length === 0 }, 'Dix questions'),
          ...(ro ? [] : [applyButton]),
        ]),
      ]),
      panelStatus,
      panelErrors,
      panelWarnings,
      pendingBox,
      dialog,
      ...(ro ? [readOnlyBox(fields)] : fields),
      history,
    ]));
    check();
  }

  // --- Classes ISO du brouillon : code et ordre ; une classe NOUVELLE y reçoit sa présentation de départ (D76, point 9).
  const classes = editableRows(draft.materiaux.classes_iso, (c, i) => {
    const code = textInput(`cl-${i}-code`, c.code, { maxlength: '1', class: 'input-court mono' });
    if (known.classes_iso.has(c.code)) {
      // Une classe que la présentation connaît : ses champs de présentation restent cachés, sans effet, et sont gardés tels quels.
      const live = liveClass(c.code);
      const swatch = el('span', { class: 'choice-swatch', 'aria-hidden': 'true', style: `background: ${live.couleur}; color: ${live.couleur_texte}` }, c.code);
      return {
        tr: el('tr', {}, [cell(swatch, 'num'), cell(code), el('td', { colspan: '7', class: 'muted small' }, `${live.nom}. Nom, couleurs, image, légende et caractéristiques : en direct, dans le panneau « Présentation » ci-dessus.`)]),
        read: () => ({ ...c, code: code.value.trim().toUpperCase() }),
      };
    }
    const nom = textInput(`cl-${i}-nom`, c.nom);
    const couleur = colorInput(`cl-${i}-couleur`, c.couleur);
    const texte = colorInput(`cl-${i}-texte`, c.couleur_texte);
    const ligne = colorInput(`cl-${i}-ligne`, c.couleur_ligne);
    const swatch = el('span', { class: 'choice-swatch', 'aria-hidden': 'true' }, c.code);
    const paint = () => { swatch.style.background = couleur.value; swatch.style.color = texte.value; swatch.textContent = code.value.toUpperCase(); };
    for (const input of [code, couleur, texte]) input.addEventListener('input', paint);
    paint();
    const pickerFor = (key) => imagePicker({ usage: 'classe', images: state.images.classe, value: c[key] ?? null, upload: (file) => uploadImage(file, 'classe'), onChange: () => { touch(); validate(); }, idPrefix: `cl-${i}-${key.replace('image_', '')}`, compact: true, readOnly: ro });
    const chaleur = pickerFor('image_chaleur');
    const legende = textInput(`cl-${i}-legende`, c.legende_image ?? DEFAULT_LEGENDE_IMAGE, { class: 'input-legende' });
    const features = characteristicsEditor(c.caracteristiques ?? [], `cl-${i}-car`, c.code, () => { touch(); validate(); }, { readOnly: ro });
    return {
      tr: el('tr', { class: 'ligne-nouvelle' }, [cell(swatch, 'num'), cell(code), cell(nom), cell(couleur), cell(texte), cell(ligne), cell(chaleur.element, 'picto-cell'), cell(legende), cell(features.element, 'caracteristiques-cell')]),
      read: () => ({ code: code.value.trim().toUpperCase(), nom: nom.value.trim(), couleur: couleur.value, couleur_texte: texte.value, couleur_ligne: ligne.value, image_chaleur: chaleur.read(), legende_image: legende.value.trim(), caracteristiques: features.read() }),
    };
  }, () => ({ code: '', nom: '', couleur: '#808080', couleur_texte: '#ffffff', couleur_ligne: '#eeeeee', image_chaleur: null, legende_image: DEFAULT_LEGENDE_IMAGE, caracteristiques: [] }), () => { touch(); validate(); }, { readOnly: ro });

  // --- Matières d'outil : clé fixe, nom (que les outils nomment) ; la couleur est de la présentation (gardée telle quelle).
  const toolMaterialRows = draft.materiaux.materiaux_outil.map((m, i) => {
    const nom = textInput(`mo-${i}-nom`, m.nom);
    return { tr: el('tr', {}, [cell(el('span', { class: 'mono smaller' }, m.cle)), cell(nom)]), read: () => ({ cle: m.cle, nom: nom.value.trim(), couleur: m.couleur }) };
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
  }, (previous) => ({ iso: previous?.iso ?? 'P', groupe: (Number(previous?.groupe) || 0) + 1, materiau: previous?.materiau ?? '', composition: null, etat: null, durete: null, exemple: null, vc_pi_min: Object.fromEntries(toolMaterialRows.map((row) => [row.read().cle, null])) }), () => { touch(); validate(); }, { readOnly: ro });

  // --- Opérations : nom, machine, direction, famille d'avance, avances ; le pictogramme d'une opération que la présentation
  // connaît est en direct (gardé tel quel ici) ; une opération NOUVELLE reçoit le sien dans sa ligne (D76, point 9).
  const operations = editableRows(draft.operations.operations, (op, i) => {
    const nom = textInput(`op-${i}-nom`, op.operation);
    const machine = textInput(`op-${i}-machine`, op.machine);
    const direction = textInput(`op-${i}-direction`, op.direction_avance);
    const famille = el('select', { id: `op-${i}-famille` }, FEED_FAMILIES.map((f) => el('option', { value: f.key, selected: f.key === feedFamilyOf(op) }, f.label)));
    const avance = textInput(`op-${i}-avance`, op.avance_po_rev, { inputmode: 'decimal', class: 'input-court mono' });
    const avanceMax = textInput(`op-${i}-avance-max`, op.avance_max_po_rev, { inputmode: 'decimal', class: 'input-court mono' });
    // Le facteur de vitesse de l'opération (D83) : « 1/4 » comme « 0.25 » ; versionné, comme les avances.
    const facteur = factorInput(`op-${i}-facteur`, op.facteur_vitesse, { 'aria-label': `Facteur de vitesse de ${op.operation || 'cette opération'}` });
    // En filetage, l'avance est sans objet (D69) : la case est inactive et atténuée (la classe, pas :disabled, que la lecture
    // seule emploie aussi, D95).
    const refreshFeeds = () => {
      const thread = famille.value === 'filetage';
      for (const input of [avance, avanceMax]) {
        input.disabled = thread;
        if (thread) input.classList.add('sans-objet'); else input.classList.remove('sans-objet');
      }
    };
    famille.addEventListener('change', refreshFeeds);
    refreshFeeds();
    const live = known.operations.has(op.operation);
    const picker = live ? null : imagePicker({ usage: 'operation', images: state.images.operation, value: op.pictogramme ?? null, upload: (file) => uploadImage(file, 'operation'), onChange: () => { touch(); validate(); }, idPrefix: `op-${i}-picto`, compact: true, readOnly: ro });
    return {
      tr: el('tr', { class: live ? null : 'ligne-nouvelle' }, [cell(nom), cell(machine), cell(direction), cell(famille), cell(avance, 'num'), cell(avanceMax, 'num'), cell(facteur, 'num'), cell(live ? el('span', { class: 'muted small' }, 'en direct, dans le panneau « Présentation »') : picker.element, 'picto-cell')]),
      read: () => {
        const flags = feedFamilyFlags(famille.value);
        const out = { operation: nom.value.trim(), machine: machine.value.trim(), direction_avance: direction.value.trim(), avance_po_rev: flags.avance_egale_pas_filetage ? null : readNum(avance), avance_max_po_rev: flags.avance_egale_pas_filetage ? null : readNum(avanceMax), ...flags, facteur_vitesse: readFactor(facteur) };
        const picto = live ? op.pictogramme ?? null : picker.read();
        if (picto !== null) out.pictogramme = picto;
        for (const key of Object.keys(op)) if (!(key in out) && key !== 'pictogramme') out[key] = op[key];
        return out;
      },
    };
  }, (previous) => ({ operation: '', machine: previous?.machine ?? 'Tour', direction_avance: previous?.direction_avance ?? 'Avance longitudinale', avance_po_rev: 0.005, avance_max_po_rev: 0.005, avance_egale_pas_filetage: false, avance_proportionnelle_diametre: false, facteur_vitesse: 1 }), () => { touch(); validate(); }, { readOnly: ro });

  // Le brouillon tel qu'à l'écran : les groupes ISO sont dérivés des lignes ; les commentaires « _… » et la révision sont gardés.
  function readTables() {
    const rows = materials.read();
    const keep = (source, out) => { for (const key of Object.keys(source)) if (key.startsWith('_')) out[key] = source[key]; return out; };
    return {
      materiaux: keep(draft.materiaux, { revision: draft.materiaux.revision, classes_iso: classes.read(), materiaux_outil: toolMaterialRows.map((r) => r.read()), groupes_iso: deriveGroups(rows), materiaux: rows }),
      operations: keep(draft.operations, { revision: draft.operations.revision, operations: operations.read() }),
    };
  }
  // Ce que la publication prendrait : le brouillon avec la présentation en vigueur par-dessus (D76).
  const publishedTables = () => applyPresentation(readTables(), shown.presentation);

  // Les trois boutons du brouillon ; aucun pour la consultation (D95), qui n'a rien à valider : une version publiée.
  const saveButton = ro ? null : el('button', { class: 'button', type: 'button' }, 'Enregistrer le brouillon');
  const publishButton = ro ? null : el('button', { class: 'button button--gold', type: 'button' }, 'Publier…');
  const cancelButton = ro ? null : el('button', { class: 'button-outline', type: 'button' }, 'Annuler les modifications'); // D77 ; inactif quand le brouillon est à jour
  function validate() {
    if (ro) return null;
    const current = readTables();
    // Une image de classe inconnue ou archivée est une erreur, sauf celle que la présentation en vigueur a déjà (D76, retouche).
    const errors = validateTables(publishedTables(), { images: state.images.classe, presentation: shown.presentation });
    errorsList.replaceChildren(...errors.map((message) => el('li', {}, message)));
    publishButton.disabled = errors.length > 0;
    publishButton.textContent = errors.length > 0 ? `Publier (${errors.length} erreur${errors.length > 1 ? 's' : ''} à corriger)` : 'Publier…';
    cancelButton.disabled = cancelTarget === null || tablesDiff(cancelTarget, current).length === 0;
    return { current, errors };
  }

  async function save() {
    const { current, errors } = validate();
    saveButton.disabled = true;
    try {
      const result = await guarded(() => editorTablesSave(revision, current));
      if (result === null) return false;
      revision = result.revision;
      draftDirty = false;
      syncDirty();
      status.textContent = `Brouillon des tables enregistré à ${formatDateStamp(new Date().toISOString()).slice(11)} (révision ${revision})${errors.length > 0 ? ` — ${errors.length} erreur(s) restent à corriger avant de publier` : ''}.`;
      return true;
    } catch (error) {
      if (error.status === 409) status.replaceChildren(el('strong', {}, error.message), ' ', el('button', { class: 'button-link', type: 'button', onclick: () => { setDirty(false); showTables(); } }, 'Recharger la page'));
      else status.textContent = serverErrorMessage(error);
      return false;
    } finally {
      saveButton.disabled = false;
    }
  }
  saveButton?.addEventListener('click', save);

  // Publier (D61, D77) : enregistrer, puis UNE confirmation — en tête, les différences de valeurs avec la version dont le
  // brouillon est parti (la protection contre une faute de frappe) ; la révision ; puis la cascade : les exercices sur la
  // version remplacée, cochés par défaut, chacun avec ce que ça change pour lui ; un exercice en erreur est nommé, pas cochable.
  publishButton?.addEventListener('click', async () => {
    if (!(await save())) return;
    try {
      const previous = page.brouillon.base_id === null ? null : (await guarded(() => editorTablesVersion(page.brouillon.base_id)))?.tables;
      const proposal = await guarded(() => editorTablesCascade());
      if (proposal === null) return;
      const lines = previous ? tablesDiff(previous, readTables()) : ['Première version des tables.'];
      const idInput = el('input', { id: 'tables-revision', type: 'text', autocomplete: 'off', spellcheck: 'false', value: page.suggestion, class: 'mono' });
      const checks = new Map();
      // Une ligne par exercice : cochée par défaut s'il est sur la version remplacée, décochée s'il est sur une plus
      // ancienne (D77, retouche) ; un exercice en erreur, jamais cochable.
      const cascadeItem = (c) => {
        const box = el('input', { id: `cascade-${c.id}`, type: 'checkbox', checked: c.par_defaut, disabled: c.en_erreur });
        if (!c.en_erreur) checks.set(c.id, box);
        const tags = [c.sur !== proposal.remplacee ? `sur ${c.sur ?? '—'}` : null, c.archive_le !== null ? 'archivé' : null, c.jamais_publie ? 'jamais publié' : null].filter(Boolean);
        return el('li', { class: c.en_erreur ? 'cascade-erreur' : null }, [
          el('label', { for: box.id, class: 'cascade-titre' }, [box, el('strong', {}, c.titre), el('span', { class: 'muted mono smaller' }, c.id), ...tags.map((tag) => el('span', { class: 'cascade-etiquette' }, tag))]),
          el('p', { class: 'small' }, cascadeAction(c)),
          c.en_erreur
            ? el('ul', { class: 'editeur-erreurs' }, c.erreurs.map((line) => el('li', {}, line)))
            : el('ul', { class: 'editeur-diff' }, (c.lignes.length === 0 ? ['Rien ne change pour lui : ses outils tirent les mêmes valeurs.'] : c.lignes).map((line) => el('li', {}, line))),
          !c.en_erreur && c.brouillon.erreurs.length > 0 ? el('p', { class: 'small avis-doublon' }, `Son brouillon aura ${c.brouillon.erreurs.length} erreur${c.brouillon.erreurs.length > 1 ? 's' : ''} avec ces tables, à corriger avant sa prochaine publication. ${c.brouillon.erreurs.join(' · ')}`) : '',
        ]);
      };
      const onReplaced = proposal.candidats.filter((c) => c.sur === proposal.remplacee);
      const older = proposal.candidats.filter((c) => c.sur !== proposal.remplacee);
      // Construites ici, avant le libellé du bouton et les écouteurs des cases, qui les parcourent.
      const replacedItems = onReplaced.map(cascadeItem);
      const olderItems = older.map(cascadeItem);
      const checkedIds = () => [...checks].filter(([, box]) => box.checked).map(([id]) => id);
      const confirm = el('button', { class: 'button button--gold', type: 'button', onclick: async () => {
        if (presentationDirty && !window.confirm("Les modifications du panneau « Présentation » ne sont pas appliquées : elles seront perdues au rechargement de l'onglet. Publier quand même ?")) return;
        confirm.disabled = true;
        try {
          const result = await guarded(() => editorTablesPublish(revision, idInput.value.trim(), checkedIds()));
          if (result === null) return;
          setDirty(false);
          showTables(cascadeResultText(result, new Map(proposal.candidats.map((c) => [c.id, c.titre]))));
        } catch (error) {
          confirm.disabled = false;
          status.textContent = serverErrorMessage(error);
        }
      } });
      const relabel = () => { confirm.textContent = publishTablesLabel(idInput.value.trim(), checkedIds().length); };
      idInput.addEventListener('input', (event) => { event.stopPropagation(); relabel(); });
      for (const box of checks.values()) box.addEventListener('change', (event) => { event.stopPropagation(); relabel(); });
      const setAll = (value) => { for (const box of checks.values()) box.checked = value; relabel(); };
      relabel();
      dialogSlot.replaceChildren(el('section', { class: 'panel panel--gold' }, [
        el('div', { class: 'eyebrow' }, 'Confirmation'),
        el('h2', {}, previous ? `Publier une nouvelle version des tables, depuis ${previous.id} ?` : 'Publier la première version des tables ?'),
        el('p', { class: 'small' }, lines.length === 0 ? 'Aucune différence de valeurs avec la version précédente : rien à publier.' : `Différences de valeurs avec ${previous?.id ?? '—'} (${lines.length}). Relis-les : une faute de frappe partirait chez tous les exercices cochés ci-dessous.`),
        el('ul', { class: 'editeur-diff editeur-diff--en-tete' }, lines.map((line) => el('li', {}, line))),
        // Le passage de la banque aux facteurs de vitesse (D83, point 5), quand ces tables sont les premières à les porter.
        ...(bankPassageLines(proposal.banque).length === 0 ? [] : [
          el('h3', { class: 'cascade-entete' }, "Banque d'outils : le facteur de vitesse passe aux tables"),
          el('p', { class: 'small' }, "Avec cette publication, chaque outil de la banque hérite du facteur de son opération s'il avait la même valeur. Sinon il garde la sienne, « forcée », avec la raison « à vérifier », à trancher ensuite dans la fiche de l'outil. Le contenu d'avant de chaque outil va à son historique."),
          el('ul', { class: 'editeur-diff' }, bankPassageLines(proposal.banque).map((line) => el('li', {}, line))),
        ]),
        el('div', { class: 'field field--half' }, [el('label', { for: 'tables-revision' }, 'Révision de cette version'), idInput, el('div', { class: 'field-note' }, `Suggérée : ${page.suggestion}. Unique, inscrite au pied des feuilles et sur les attestations. Lettres, chiffres, « _ », « . », « - ».`)]),
        el('h3', { class: 'cascade-entete' }, 'Cascade : les exercices qui ne sont pas à jour'),
        proposal.candidats.length === 0
          ? el('p', { class: 'muted small' }, "Aucun exercice : rien à publier en cascade.")
          : el('div', {}, [
            el('p', { class: 'small' }, "Pour chaque exercice coché, son contenu publié passe à ces tables (une version suivante, faite de son dernier contenu publié, jamais de son brouillon), et son brouillon aussi, chacun de son côté, ses modifications gardées. Un exercice décoché n'est pas touché. Les séances en cours gardent leur version. Seules les nouvelles séances prennent celle de la cascade."),
            el('div', { class: 'outil-actions' }, [
              el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => setAll(true) }, 'Tout cocher'),
              el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => setAll(false) }, 'Tout décocher'),
            ]),
            onReplaced.length === 0 ? '' : el('h4', { class: 'cascade-groupe' }, `Sur ${proposal.remplacee ?? '—'}, la version remplacée — cochés par défaut`),
            onReplaced.length === 0 ? '' : el('ul', { class: 'cascade-liste' }, replacedItems),
            older.length === 0 ? '' : el('h4', { class: 'cascade-groupe' }, 'Sur une version plus ancienne, décochés par défaut : ils ont pu être laissés de côté exprès'),
            older.length === 0 ? '' : el('ul', { class: 'cascade-liste' }, olderItems),
          ]),
        el('p', { class: 'muted smaller' }, 'Une version publiée ne se modifie plus. Elle prend la présentation en vigueur (panneau « Présentation »). Tout se publie ensemble, ou rien.'),
        el('div', { class: 'form-actions' }, [confirm, el('button', { class: 'button-link', type: 'button', onclick: () => dialogSlot.replaceChildren() }, 'Annuler')]),
      ]));
      dialogSlot.scrollIntoView({ block: 'nearest' });
    } catch (error) { status.textContent = serverErrorMessage(error); }
  });

  // Revenir en arrière (D77) : « Annuler les modifications » ramène le brouillon à la dernière version publiée ; « Reprendre
  // cette version » y met les valeurs d'une version publiée (la présentation en vigueur est gardée). Ce qui serait perdu —
  // les différences de valeurs avec la dernière version, et les retouches de présentation en attente — est listé d'abord.
  const lostTablesChanges = () => [
    ...(cancelTarget === null ? [] : tablesDiff(cancelTarget, readTables())),
    ...pending.lignes.map((line) => `Retouche de présentation en attente — ${line}`),
  ];
  const leavePresentation = () => !presentationDirty || window.confirm("Les modifications du panneau « Présentation » ne sont pas appliquées : elles seront perdues au rechargement de l'onglet. Continuer ?");
  cancelButton?.addEventListener('click', () => confirmLoss(dialogSlot, {
    heading: `Ramener le brouillon des tables à ${page.derniere} ?`,
    lines: lostTablesChanges(),
    label: 'Annuler les modifications',
    act: async () => {
      if (!leavePresentation()) return;
      try {
        const result = await guarded(() => editorTablesCancel(revision));
        if (result === null) return;
        setDirty(false);
        showTables(result.annule ? `Brouillon des tables ramené à ${result.id} : ses modifications sont annulées.` : `Brouillon des tables ramené à ${result.id} : ses modifications non enregistrées sont abandonnées.`);
      } catch (error) { status.textContent = serverErrorMessage(error); }
    },
  }));
  const resumeTables = (id) => confirmLoss(dialogSlot, {
    heading: `Reprendre les valeurs de ${id} dans le brouillon des tables ?`,
    lines: lostTablesChanges(),
    label: `Reprendre ${id}`,
    act: async () => {
      if (!leavePresentation()) return;
      try {
        const result = await guarded(() => editorTablesResume(revision, id));
        if (result === null) return;
        setDirty(false);
        showTables(`Valeurs de ${result.id} reprises dans le brouillon, qui repart de ${result.base_id} : vérifie les différences, puis « Publier… » — la cascade proposera les exercices sur ${result.base_id}. La présentation en vigueur est gardée.`);
      } catch (error) { status.textContent = serverErrorMessage(error); }
    },
  });

  // Aperçu : dix questions d'un exercice avec les tables telles qu'à l'écran (D63), et la présentation en vigueur.
  // L'administration seulement : la consultation lit une version publiée, dont l'aperçu est celui de chaque exercice.
  const previewSelect = ro ? null : el('select', { id: 'apercu-exercice' }, exercises.map((e) => el('option', { value: e.id }, e.titre)));
  async function preview() {
    const exercice = previewSelect.value;
    if (!exercice) return;
    try {
      const result = await guarded(() => editorTablesPreview(readTables(), exercice));
      if (result === null) return;
      dialogSlot.replaceChildren(el('section', { class: 'panel' }, [
        el('div', { class: 'eyebrow' }, 'Aperçu'),
        el('h2', {}, `Dix questions de « ${exercises.find((e) => e.id === exercice)?.titre ?? exercice} » avec ces tables`),
        el('p', { class: 'muted small' }, "Le brouillon de l'exercice, tiré avec le brouillon des tables tel qu'il est à l'écran, et la présentation en vigueur. Rien n'est enregistré."),
        previewTable(result, publishedTables().materiaux.classes_iso),
        el('div', { class: 'form-actions' }, [el('button', { class: 'button-outline', type: 'button', onclick: preview }, 'Dix autres'), el('button', { class: 'button-link', type: 'button', onclick: () => dialogSlot.replaceChildren() }, 'Fermer')]),
      ]));
      dialogSlot.scrollIntoView({ block: 'nearest' });
    } catch (error) {
      status.textContent = error.status === 400 ? error.message : serverErrorMessage(error);
    }
  }

  // Les versions publiées : les feuilles imprimables pour les deux rôles ; « Reprendre cette version », l'administration.
  const versionsList = el('ul', { class: 'versions-liste' }, page.versions.map((v) => el('li', {}, [
    el('strong', {}, v.id), el('span', { class: 'muted' }, `publiée le ${formatDateStamp(v.creee_le)} · ${tablesUsageLabel(v.utilisations)}`),
    el('a', { class: 'button-small button-small--neutral', href: `/tables?version=${encodeURIComponent(v.id)}`, target: '_blank', rel: 'noopener' }, 'Feuilles imprimables'),
    ...(ro ? [] : [el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => resumeTables(v.id) }, 'Reprendre cette version')]),
  ])));

  // Un tableau de valeurs ; la lecture seule n'a pas de colonne d'actions et met le tableau dans un fieldset inactif.
  const table = (headers, body, className = '') => (ro ? readOnlyBox : (x) => x)(el('div', { class: 'table-wrap' }, el('table', { class: `prof-table tables-edit ${className}`.trim() }, [el('thead', {}, el('tr', {}, [...headers, ...(ro ? [] : ['Actions'])].map((h) => el('th', {}, h)))), body])));
  const part = ro ? `Version ${draft.id}` : 'Brouillon'; // l'intertitre de chaque tableau de valeurs
  renderPresentation(shown.presentation);
  const screen = el('div', { class: 'screen screen--wide prof editeur', ...(ro ? {} : { oninput: () => { touch(); validate(); }, onchange: () => { touch(); validate(); } }) }, [
    el('section', { class: 'panel' }, [
      panelHead('tables de référence', 'tables'),
      el('h1', { tabindex: '-1' }, 'Tables de référence'),
      ro ? el('p', { class: 'muted small' }, [
        'Lecture seule, en deux parties. ',
        el('strong', {}, 'Présentation.'), " Ce qui ne fait qu'afficher, en vigueur pour tous les étudiants. ",
        el('strong', {}, 'Valeurs.'), ' La dernière version publiée des tables (matériaux, Vc, opérations, avances, facteurs de vitesse). Chaque exercice choisit sa version, et une séance commencée garde les valeurs de la sienne.',
      ]) : el('p', { class: 'muted small' }, [
        "Deux parties, qui ne s'enregistrent pas de la même façon. ",
        el('strong', {}, 'Présentation, effet immédiat.'), " Ce qui ne fait qu'afficher. « Appliquer… » change tout de suite la page de tous les étudiants, quelle que soit leur version des tables. L'historique permet de revenir en arrière. ",
        el('strong', {}, 'Valeurs, brouillon à publier.'), ' Tout le reste (matériaux, Vc, opérations, avances…). Un seul brouillon, des versions publiées immuables, chacune avec sa révision. Une version ne change aucun exercice toute seule, et une séance commencée garde les valeurs de sa version.',
      ]),
    ]),
    presentationSlot,
    el('section', { class: 'panel' }, ro ? [
      el('div', { class: 'eyebrow' }, `Valeurs — version ${draft.id}`),
      el('h2', {}, `Tables de la version ${draft.id}`),
      el('p', { class: 'muted small' }, "La dernière version publiée des tables, celle que prend un exercice créé aujourd'hui. Le brouillon n'est pas montré. Les versions plus anciennes se lisent par leurs feuilles imprimables, en bas de la page."),
      el('div', { class: 'editeur-bar' }, el('div', { class: 'muted small' }, `Version ${draft.id} · publiée le ${formatDateStamp(draft.creee_le)}`)),
      status,
    ] : [
      el('div', { class: 'eyebrow' }, 'Valeurs — brouillon à publier'),
      el('h2', {}, 'Brouillon des tables'),
      el('p', { class: 'muted small' }, "Un seul brouillon, modifiable. Des versions publiées immuables, chacune avec sa révision. Une version publiée ne change aucun exercice tout seul : chaque exercice choisit sa version de tables depuis sa page, et une séance commencée garde les valeurs de sa version d'exercice. Ce que le panneau « Présentation » porte n'est plus ici, sauf pour une classe ou une opération nouvelle : elle y reçoit sa présentation de départ, puis se modifie en direct une fois publiée."),
      el('div', { class: 'editeur-bar' }, [
        el('div', { class: 'muted small' }, [`Brouillon parti de la version ${page.brouillon.base_id ?? '—'} · modifié le ${formatDateStamp(page.brouillon.modifie_le)}`, page.modifie ? ' · valeurs différentes de cette version' : ' · mêmes valeurs que cette version']),
        el('div', { class: 'editeur-bar-actions' }, [
          el('label', { for: 'apercu-exercice', class: 'muted small' }, 'Aperçu avec :'), previewSelect,
          el('button', { class: 'button-outline', type: 'button', onclick: preview }, 'Dix questions'),
          cancelButton,
          saveButton,
          publishButton,
        ]),
      ]),
      status,
      errorsList,
      dialogSlot,
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, `${part} · Classes ISO`),
      el('p', { class: 'muted small' }, ro
        ? "La lettre de chaque classe, et leur ordre. Le nom, les couleurs, l'image de chaleur, la légende et les caractéristiques sont dans le panneau « Présentation », ci-dessus."
        : "La lettre de chaque classe, et leur ordre. Le nom, les couleurs, l'image de chaleur, la légende et les caractéristiques d'une classe sont en direct, dans le panneau « Présentation ». Une classe ajoutée ici reçoit sa présentation de départ sur sa ligne (légende de 40 caractères au plus, 6 caractéristiques au plus, libellé de 20 caractères, texte et solution de 90). Une fois publiée, elle se modifie en direct."),
      table(['', 'Code', 'Nom', 'Couleur', 'Texte', 'Ligne', 'Image de chaleur', 'Légende', 'Caractéristiques'], classes.body, 'tables-edit--classes'),
      ...(ro ? [] : [el('div', { class: 'form-actions' }, el('button', { class: 'button-outline', type: 'button', onclick: () => classes.add() }, 'Ajouter une classe'))]),
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, `${part} · Matières d'outil`),
      el('p', { class: 'muted small' }, ro
        ? "Les trois colonnes de la table des vitesses de coupe. Leur couleur est dans le panneau « Présentation »."
        : "Les trois colonnes de la table des vitesses de coupe. Leur couleur est en direct, dans le panneau « Présentation ». Renommer une matière oblige à renommer la matière dans chaque outil qui la nomme : les exercices le signaleront."),
      (ro ? readOnlyBox : (x) => x)(el('div', { class: 'table-wrap' }, el('table', { class: 'prof-table tables-edit' }, [el('thead', {}, el('tr', {}, ['Clé', 'Nom'].map((h) => el('th', {}, h)))), el('tbody', {}, toolMaterialRows.map((r) => r.tr))]))),
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, `${part} · Matériaux usinés`),
      el('p', { class: 'muted small' }, ro
        ? "Une ligne par groupe, dans l'ordre de la feuille. « Famille » : un trait fin au-dessus de la ligne (changement de matériau usiné)."
        : "Une ligne par groupe, dans l'ordre de la feuille. Le groupe ISO d'un outil est « classe - matériau » (« P - Acier non allié ») : retirer le dernier matériau d'un groupe retire le groupe, et les exercices qui l'utilisent le signaleront. « Famille » : un trait fin au-dessus de la ligne (changement de matériau usiné)."),
      table(['Classe', 'Groupe', 'Matériau usiné', 'Composition', 'État', 'Dureté', 'Exemple', ...toolMaterialRows.map((r) => `Vc ${r.read().nom}`), 'Famille'], materials.body, 'tables-edit--materiaux'),
      ...(ro ? [] : [el('div', { class: 'form-actions' }, el('button', { class: 'button-outline', type: 'button', onclick: () => materials.add() }, 'Ajouter un matériau'))]),
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, `${part} · Opérations`),
      el('p', { class: 'muted small' }, ro
        ? "Une ligne par opération, dans l'ordre de la feuille des avances et de celle des facteurs de vitesse : la machine-outil, la direction d'avance, la famille, l'avance par révolution et son maximum (en pouces, sans objet en filetage), et le facteur de vitesse dont les outils héritent. Le pictogramme est dans le panneau « Présentation »."
        : "Une ligne par opération, dans l'ordre de la feuille des avances et de celle des facteurs de vitesse : la machine-outil, la direction d'avance, la famille (fixe, proportionnelle au Ø, filetage), l'avance par révolution et son maximum (en pouces, sans objet en filetage), et le facteur de vitesse. Le facteur (N = Vc × 4 / Ø × facteur) : « 1 » sans réduction, « 1/4 » ou « 0.25 », « 1/8 »… Les outils en héritent. Le pictogramme est en direct, dans le panneau « Présentation ». Une opération ajoutée ici reçoit le sien sur sa ligne."),
      table(['Opération', 'Machine-outil', "Direction d'avance", 'Famille', 'Avance', 'Avance max', 'Facteur de vitesse', 'Pictogramme'], operations.body, 'tables-edit--operations'),
      ...(ro ? [] : [el('div', { class: 'form-actions' }, el('button', { class: 'button-outline', type: 'button', onclick: () => operations.add() }, 'Ajouter une opération'))]),
    ]),
    el('section', { class: 'panel' }, [
      el('div', { class: 'eyebrow' }, 'Versions publiées'),
      versionsList,
    ]),
  ]);
  validate();
  showScreen(main, screen, { title: TITLE, aside: headerAside() }, 'h1');
}

// L'onglet Tables de référence pour la consultation quand aucune version n'a été publiée (jamais en pratique : la semence
// en publie une) : la page le dit, sans rien d'autre.
function showTablesEmpty() {
  const screen = el('div', { class: 'screen screen--wide prof editeur' }, el('section', { class: 'panel' }, [
    panelHead('tables de référence', 'tables'),
    el('h1', { tabindex: '-1' }, 'Tables de référence'),
    el('p', { class: 'muted small' }, "Aucune version des tables n'a encore été publiée."),
  ]));
  showScreen(main, screen, { title: TITLE, aside: headerAside() }, 'h1');
}

// --- Images (D56) : la liste avec les utilisations, téléverser, renommer, archiver, supprimer ------------------------------

export async function showImages(notice = '', filters = { usage: '', query: '' }) {
  const response = await guarded(() => editorImages());
  if (response === null) return;
  const ro = readOnly();
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
      // Les actions : l'administration seulement (D95).
      ...(ro ? [] : [el('td', { class: 'actions' }, el('div', { class: 'actions-group' }, [
        el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => {
          const nom = window.prompt('Nouveau nom de l\'image (le nom lisible, dans la galerie) :', image.nom);
          if (nom && nom.trim() !== image.nom) act(() => editorImageRename(image.id, nom.trim()), `« ${image.nom} » renommée « ${nom.trim()} ».`);
        } }, 'Renommer'),
        image.archivee_le === null
          ? el('button', { class: 'button-small', type: 'button', onclick: () => { if (window.confirm(imageArchiveConfirmation(image))) act(() => editorImageArchive(image.id, true), `« ${image.nom} » archivée : plus proposée, toujours affichée là où elle est nommée.`); } }, 'Archiver')
          : el('button', { class: 'button-small button-small--neutral', type: 'button', onclick: () => act(() => editorImageArchive(image.id, false), `« ${image.nom} » rétablie.`) }, 'Rétablir'),
        ...(canDeleteImage(image.utilisations) ? [el('button', { class: 'button-small button-small--danger', type: 'button', onclick: () => { if (window.confirm(imageDeleteConfirmation(image))) act(() => editorImageDelete(image.id), `« ${image.nom} » supprimée.`); } }, 'Supprimer')] : []),
      ]))]),
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
    el('div', { class: 'field' }, [el('label', { for: 'televerser-fichier' }, 'Fichier (PNG, JPEG, WebP, GIF, BMP ou SVG)'), uploadFile, el('div', { class: 'field-note' }, "Une photo est réduite dans le navigateur à 800 px, en JPEG sur fond blanc ou en PNG si elle a de la transparence. Un pictogramme passe à 256 px en PNG, une image de classe à 340 px en PNG. Un SVG est gardé tel quel, nettoyé à l'envoi. Un doublon exact n'est pas stocké deux fois.")]),
    el('button', { class: 'button-outline', type: 'submit' }, 'Téléverser'),
  ]);

  const screen = el('div', { class: 'screen screen--wide prof editeur' }, el('section', { class: 'panel' }, [
    panelHead('images', 'images'),
    el('h1', { tabindex: '-1' }, 'Images'),
    el('p', { class: 'muted small' }, "Les photos d'outils, les pictogrammes d'opérations et les images de chaleur des classes ISO, dans la base. Une image ne change jamais sous le même identifiant. Une image utilisée par une version publiée ne se supprime pas : elle s'archive (retirée des galeries, toujours affichée). Une image jamais utilisée peut être supprimée."),
    status,
    el('div', { class: 'ajout-outil' }, [
      el('div', { class: 'field' }, [el('label', { for: 'images-usage' }, 'Usage'), usageSelect]),
      el('div', { class: 'field' }, [el('label', { for: 'images-recherche' }, 'Recherche'), search]),
    ]),
    el('div', { class: 'table-wrap' }, el('table', { class: 'prof-table images-table' }, [
      el('thead', {}, el('tr', {}, ['', 'Nom', 'Usage', 'Type', 'Ajoutée le', 'Utilisée par', 'État', ...(ro ? [] : ['Actions'])].map((label) => el('th', {}, label)))),
      body,
    ])),
    count,
    ...(ro ? [] : [el('h2', { class: 'editeur-bar' }, 'Téléverser une image'), uploadForm]),
  ]));
  renderRows();
  showScreen(main, screen, { title: TITLE, aside: headerAside() }, 'h1');
}

// Le démarrage est celui de la coquille (prof-shell.js, prof-main.js) : les cinq onglets exportés ici s'y enregistrent.
