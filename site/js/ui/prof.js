// Les écrans des réussites de l'espace enseignant (décisions D34, D35, D44 à D46, D95 ; UI §3.8) : le tableau des
// séances (filtre par exercice, tri par colonne, recherche, export CSV ; remise à zéro, réinitialisation du NIP et
// suppression pour l'administration), le journal des corrections d'identité, et la page d'effacement des données des
// étudiants. La coquille — connexion, barre du haut, onglets, garde des modifications, 401 — est prof-shell.js ;
// prof-main.js enregistre les deux onglets, « Réussites » (showSessions) et « Corrections d'identité » (showIdentities).
// Le rôle consultation ne voit aucun bouton d'action — et le serveur les refuse de toute façon. Ce qu'on montre est
// décidé par prof-data.js (pur, testé) : ici, on construit le DOM.

import { deleteSession, listIdentityCorrections, listSessions, purgeStudentData, resetNip, resetSession } from '../api.js';
import { el, showScreen } from './dom.js';
import {
  PURGE_WORD, SESSION_COLUMNS, canAct, csvFileName, csvOf, deleteConfirmation, filterSessions, identityRows, nipResetConfirmation, purgeIntro, purgeSummary,
  resetConfirmation, sessionCells, sortSessions,
} from './prof-data.js';
import { TITLE, eyebrow, guarded, headerAside, panelHead, role } from './prof-shell.js';
import { serverErrorMessage } from './text.js';

const main = document.querySelector('#app');

// L'état de l'écran : ce que le serveur a rendu, et ce que l'enseignant a choisi.
const state = {
  exercices: [],
  seances: [],
  identites: [],
  filter: { exercice: '', search: '' },
  sort: { key: 'derniere_activite', ascending: false },
};

// --- Les deux onglets ------------------------------------------------------------------------------------------------

// Réussites : recharge les séances, puis le tableau ; un 401 ramène à la connexion (guarded).
export async function showSessions() {
  if ((await guarded(reloadSessions)) === null) return;
  render('seances');
}

// Corrections d'identité : recharge le journal, puis le tableau.
export async function showIdentities() {
  if ((await guarded(reloadIdentities)) === null) return;
  render('identites');
}

async function reloadSessions() {
  const { exercices, seances } = await listSessions();
  state.exercices = exercices;
  state.seances = seances;
  return true;
}

async function reloadIdentities() {
  state.identites = (await listIdentityCorrections()).corrections;
  return true;
}

// --- Tableau des séances --------------------------------------------------------------------------------------------

function visibleSessions() {
  return sortSessions(filterSessions(state.seances, state.filter), state.sort.key, state.sort.ascending);
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = el('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Une action sur une séance, après confirmation : remise à zéro (D35), réinitialisation du NIP (D38), suppression (D45).
async function act(button, confirmation, action) {
  if (!window.confirm(confirmation)) return;
  button.disabled = true;
  try {
    if ((await guarded(action)) === null) return;
    await showSessions();
  } catch (error) {
    window.alert(serverErrorMessage(error));
    button.disabled = false;
  }
}

// Les boutons d'action d'une séance — rôle admin seulement (D44) : la consultation n'a pas de colonne Actions.
function actionButtons(session) {
  const resetButton = el('button', { class: 'button-small', type: 'button' }, 'Remettre à zéro');
  resetButton.addEventListener('click', () => act(resetButton, resetConfirmation(session), () => resetSession(session.id)));
  const nipButton = el('button', { class: 'button-small button-small--neutral', type: 'button' }, 'Réinitialiser le NIP');
  nipButton.addEventListener('click', () => act(nipButton, nipResetConfirmation(session), () => resetNip(session.id)));
  const deleteButton = el('button', { class: 'button-small button-small--danger', type: 'button' }, 'Supprimer');
  deleteButton.addEventListener('click', () => act(deleteButton, deleteConfirmation(session), () => deleteSession(session.id)));
  return [nipButton, resetButton, deleteButton];
}

function sessionsTable() {
  const rows = visibleSessions();
  const actions = canAct(role());
  const header = el('tr', {}, [
    ...SESSION_COLUMNS.map((column) => {
      const active = state.sort.key === column.key;
      return el('th', { class: column.num ? 'num' : null, 'aria-sort': active ? (state.sort.ascending ? 'ascending' : 'descending') : 'none' },
        el('button', { class: 'sort-button', type: 'button', onclick: () => { state.sort = { key: column.key, ascending: active ? !state.sort.ascending : true }; render('seances'); } }, column.label));
    }),
    ...(actions ? [el('th', {}, 'Actions')] : []),
  ]);
  const body = rows.map((session) => {
    const cells = sessionCells(session);
    return el('tr', {}, [
      ...SESSION_COLUMNS.map((column) => {
        const classes = [column.num ? 'num' : '', column.mono ? 'mono' : '', column.date ? 'date' : '', column.key === 'etat' ? (session.reussite_le === null ? 'state--running' : 'state--done') : ''].filter(Boolean).join(' ');
        return el('td', { class: classes || null }, cells[column.key]);
      }),
      ...(actions ? [el('td', { class: 'actions' }, el('div', { class: 'actions-group' }, actionButtons(session)))] : []),
    ]);
  });
  return [
    el('div', { class: 'table-wrap' }, el('table', { class: 'prof-table' }, [el('thead', {}, header), el('tbody', {}, body)])),
    el('p', { class: 'muted smaller prof-count' }, rows.length === 0 ? 'Aucune séance ne correspond.' : `${rows.length} séance${rows.length > 1 ? 's' : ''} sur ${state.seances.length}.`),
  ];
}

function identitiesTable() {
  const rows = identityRows(state.identites);
  return [
    el('div', { class: 'table-wrap' }, el('table', { class: 'prof-table' }, [
      el('thead', {}, el('tr', {}, [el('th', {}, 'Date'), el('th', {}, 'Exercice'), el('th', {}, 'Matricule actuel'), el('th', {}, 'Avant'), el('th', {}, 'Après'), el('th', {}, 'Attestation réémise'), el('th', { class: 'num' }, 'Séance')])),
      el('tbody', {}, rows.map((row) => el('tr', {}, [
        el('td', {}, row.horodatage), el('td', {}, row.exercice), el('td', { class: 'mono' }, row.matricule),
        el('td', {}, row.avant), el('td', {}, row.apres), el('td', { class: 'mono' }, row.attestation), el('td', { class: 'num mono' }, String(row.seance)),
      ]))),
    ])),
    el('p', { class: 'muted smaller prof-count' }, rows.length === 0 ? "Aucune correction d'identité." : `${rows.length} correction${rows.length > 1 ? 's' : ''}, la plus récente en premier.`),
  ];
}

// L'écran de l'un des deux onglets, avec la rangée d'onglets de la coquille.
//   view : 'seances' ou 'identites'
function render(view) {
  const exerciseSelect = el('select', { id: 'exercice', onchange: (event) => { state.filter.exercice = event.target.value; render('seances'); } }, [
    el('option', { value: '' }, 'Tous les exercices'),
    ...state.exercices.map((exercise) => el('option', { value: exercise.id, selected: state.filter.exercice === exercise.id }, exercise.titre)),
  ]);
  const searchInput = el('input', { id: 'recherche', type: 'search', value: state.filter.search, autocomplete: 'off', placeholder: 'Matricule ou nom', oninput: (event) => { state.filter.search = event.target.value; refreshTable(); } });

  const content = el('div', { class: 'prof-content' }, view === 'seances' ? sessionsTable() : identitiesTable());
  function refreshTable() { content.replaceChildren(...sessionsTable()); }

  const screen = el('div', { class: 'screen screen--wide prof' }, [
    el('section', { class: 'panel' }, [
      panelHead(view === 'seances' ? 'réussites' : "corrections d'identité", view),
      el('h1', { tabindex: '-1' }, view === 'seances' ? 'Réussites par exercice' : "Journal des corrections d'identité"),
      view === 'seances' ? el('div', { class: 'prof-toolbar' }, [
        el('div', { class: 'field' }, [el('label', { for: 'exercice' }, 'Exercice'), exerciseSelect]),
        el('div', { class: 'field' }, [el('label', { for: 'recherche' }, 'Recherche'), searchInput]),
        el('div', { class: 'prof-actions' }, [
          el('button', { class: 'button-outline', type: 'button', onclick: () => download(csvFileName(state.filter.exercice, new Date()), csvOf(visibleSessions())) }, 'Exporter en CSV'),
          el('button', { class: 'button-link', type: 'button', onclick: () => showSessions() }, 'Rafraîchir'),
        ]),
      ]) : '',
      content,
      // La page d'effacement (D46) : rôle admin seulement, à part du tableau.
      view === 'seances' && canAct(role())
        ? el('p', { class: 'prof-purge-link' }, el('button', { class: 'button-link', type: 'button', onclick: () => showPurge() }, 'Effacer les données des étudiants…'))
        : '',
    ]),
  ]);
  showScreen(main, screen, { title: TITLE, aside: headerAside() }, view === 'seances' ? '#recherche' : 'h1');
}

// --- Effacement des données des étudiants (D46) : une page à part, rôle admin seulement ------------------------------
// D'abord l'export CSV de tout, puis le mot EFFACER tapé en entier ; le serveur l'exige aussi. Après
// l'effacement, la page reste et dit les nombres effacés.
function showPurge(notice = '') {
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  const button = el('button', { class: 'button button--wrong', type: 'submit', disabled: true }, 'Effacer les données des étudiants');
  const input = el('input', {
    id: 'confirmation', name: 'confirmation', type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'confirmation-note',
    oninput: () => { button.disabled = input.value.trim() !== PURGE_WORD; },
  });

  async function submit(event) {
    event.preventDefault();
    if (button.disabled || input.value.trim() !== PURGE_WORD) return;
    button.disabled = true;
    try {
      const result = await guarded(() => purgeStudentData(input.value.trim()));
      if (result === null) return;
      if ((await guarded(reloadSessions)) === null) return;
      showPurge(purgeSummary(result.nombres));
    } catch (error) {
      status.textContent = serverErrorMessage(error);
      input.value = '';
      input.focus();
    }
  }

  const screen = el('div', { class: 'screen screen--narrow prof' }, el('section', { class: 'panel panel--wrong' }, [
    eyebrow('effacement des données'),
    el('h1', { tabindex: '-1' }, 'Effacer les données des étudiants'),
    el('p', { class: 'small' }, purgeIntro(state.seances.length)),
    el('ol', { class: 'purge-steps' }, [
      el('li', {}, [
        el('div', {}, "Exporte toutes les séances en CSV d'abord. C'est la dernière occasion."),
        el('p', {}, el('button', { class: 'button-outline', type: 'button', onclick: () => download(csvFileName('', new Date()), csvOf(state.seances)) }, 'Exporter tout en CSV')),
      ]),
      el('li', {}, el('form', { novalidate: true, onsubmit: submit }, [
        el('div', { class: 'field' }, [el('label', { for: 'confirmation' }, `Tape ${PURGE_WORD} pour confirmer`), input, el('div', { class: 'field-note', id: 'confirmation-note' }, 'En majuscules, tel quel. Le bouton ne s\'active qu\'avec le mot exact.')]),
        el('div', { class: 'form-actions' }, [status, button]),
      ])),
    ]),
    el('p', { class: 'prof-purge-link' }, el('button', { class: 'button-link', type: 'button', onclick: () => showSessions() }, '← Retour aux réussites')),
  ]));
  showScreen(main, screen, { title: TITLE, aside: headerAside() }, '#confirmation');
}
