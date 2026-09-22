// Espace professeur (décisions D34, D35 ; UI §3.8) : connexion par la clé d'administration, tableau
// des séances (filtre par exercice, tri par colonne, recherche, export CSV, remise à zéro) et journal
// des corrections d'identité. Le client ne contient aucun secret : le serveur ne répond qu'avec le
// cookie de séance posé à la connexion ; un 401 ramène à la connexion.
// Ce qu'on montre est décidé par prof-data.js (pur, testé) : ici, on construit le DOM.

import { listIdentityCorrections, listSessions, resetSession, teacherLogin, teacherLogout } from '../api.js';
import { el, showScreen } from './dom.js';
import { SESSION_COLUMNS, csvFileName, csvOf, filterSessions, identityRows, resetConfirmation, sessionCells, sortSessions } from './prof-data.js';
import { serverErrorMessage } from './text.js';

const main = document.querySelector('#app');

// L'état de l'écran : ce que le serveur a rendu, et ce que l'enseignant a choisi.
const state = {
  teacher: null,
  exercices: [],
  seances: [],
  identites: null, // chargées à la demande
  view: 'seances',
  filter: { exercice: '', search: '' },
  sort: { key: 'derniere_activite', ascending: false },
};

// --- Connexion ---------------------------------------------------------------------------------------------------

function showLogin(notice = '') {
  const status = el('div', { class: 'server-message', role: 'status' }, notice);
  // Un champ texte masqué par CSS, jamais type="password" : rien à enregistrer sur un poste partagé (D21).
  const input = el('input', { id: 'cle', name: 'cle', type: 'text', class: 'input-secret', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'cle-note' });
  const button = el('button', { class: 'button', type: 'submit' }, 'Se connecter');

  async function submit(event) {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = '';
    try {
      const { enseignant } = await teacherLogin(input.value);
      state.teacher = enseignant;
      await loadAndShow();
    } catch (error) {
      status.textContent = error.status === 429 && error.details.attendre_s ? `${error.message} (${error.details.attendre_s} s)` : serverErrorMessage(error);
      button.disabled = false;
      input.focus();
    }
  }

  const screen = el('div', { class: 'screen screen--narrow' }, el('section', { class: 'panel' }, [
    el('div', { class: 'eyebrow' }, 'Espace professeur'),
    el('h1', { tabindex: '-1' }, 'Connexion'),
    el('p', { class: 'muted small' }, "Entre la clé d'administration du serveur de correction. La séance dure 12 h."),
    el('form', { novalidate: true, onsubmit: submit }, [
      el('div', { class: 'form-grid form-grid--single' }, el('div', { class: 'field' }, [el('label', { for: 'cle' }, "Clé d'administration"), input, el('div', { class: 'field-note', id: 'cle-note' }, 'Cinq essais, puis un délai croissant.')])),
      el('div', { class: 'form-actions' }, [status, button]),
    ]),
  ]));
  showScreen(main, screen, { title: 'Espace professeur', aside: 'Techniques de génie mécanique' }, '#cle');
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

async function reset(session, button) {
  if (!window.confirm(resetConfirmation(session))) return;
  button.disabled = true;
  try {
    await resetSession(session.id);
    await loadAndShow();
  } catch (error) {
    if (error.status === 401) { showLogin('Ta séance a expiré : connecte-toi de nouveau.'); return; }
    window.alert(serverErrorMessage(error));
    button.disabled = false;
  }
}

function sessionsTable() {
  const rows = visibleSessions();
  const header = el('tr', {}, [
    ...SESSION_COLUMNS.map((column) => {
      const active = state.sort.key === column.key;
      return el('th', { class: column.num ? 'num' : null, 'aria-sort': active ? (state.sort.ascending ? 'ascending' : 'descending') : 'none' },
        el('button', { class: 'sort-button', type: 'button', onclick: () => { state.sort = { key: column.key, ascending: active ? !state.sort.ascending : true }; showDashboard(); } }, column.label));
    }),
    el('th', {}, 'Action'),
  ]);
  const body = rows.map((session) => {
    const cells = sessionCells(session);
    const resetButton = el('button', { class: 'button-small', type: 'button' }, 'Remettre à zéro');
    resetButton.addEventListener('click', () => reset(session, resetButton));
    return el('tr', {}, [
      ...SESSION_COLUMNS.map((column) => {
        const classes = [column.num ? 'num' : '', column.mono ? 'mono' : '', column.date ? 'date' : '', column.key === 'etat' ? (session.reussite_le === null ? 'state--running' : 'state--done') : ''].filter(Boolean).join(' ');
        return el('td', { class: classes || null }, cells[column.key]);
      }),
      el('td', {}, resetButton),
    ]);
  });
  return [
    el('div', { class: 'table-wrap' }, el('table', { class: 'prof-table' }, [el('thead', {}, header), el('tbody', {}, body)])),
    el('p', { class: 'muted smaller prof-count' }, rows.length === 0 ? 'Aucune séance ne correspond.' : `${rows.length} séance${rows.length > 1 ? 's' : ''} sur ${state.seances.length}.`),
  ];
}

function identitiesTable() {
  const rows = identityRows(state.identites ?? []);
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

function showDashboard() {
  const exerciseSelect = el('select', { id: 'exercice', onchange: (event) => { state.filter.exercice = event.target.value; showDashboard(); } }, [
    el('option', { value: '' }, 'Tous les exercices'),
    ...state.exercices.map((exercise) => el('option', { value: exercise.id, selected: state.filter.exercice === exercise.id }, exercise.titre)),
  ]);
  const searchInput = el('input', { id: 'recherche', type: 'search', value: state.filter.search, autocomplete: 'off', placeholder: 'Matricule ou nom', oninput: (event) => { state.filter.search = event.target.value; refreshTable(); } });
  const tabs = [['seances', 'Réussites'], ['identites', "Corrections d'identité"]].map(([view, label]) => el('button', {
    class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(state.view === view), onclick: () => switchView(view),
  }, label));

  const content = el('div', { class: 'prof-content' }, state.view === 'seances' ? sessionsTable() : identitiesTable());
  function refreshTable() { content.replaceChildren(...sessionsTable()); }

  const screen = el('div', { class: 'screen screen--wide prof' }, [
    el('section', { class: 'panel' }, [
      el('div', { class: 'panel-head' }, [el('div', { class: 'eyebrow' }, `Espace professeur · ${state.teacher}`), el('div', { class: 'prof-tabs', role: 'tablist' }, tabs)]),
      el('h1', { tabindex: '-1' }, state.view === 'seances' ? 'Réussites par exercice' : "Journal des corrections d'identité"),
      state.view === 'seances' ? el('div', { class: 'prof-toolbar' }, [
        el('div', { class: 'field' }, [el('label', { for: 'exercice' }, 'Exercice'), exerciseSelect]),
        el('div', { class: 'field' }, [el('label', { for: 'recherche' }, 'Recherche'), searchInput]),
        el('div', { class: 'prof-actions' }, [
          el('button', { class: 'button-outline', type: 'button', onclick: () => download(csvFileName(state.filter.exercice, new Date()), csvOf(visibleSessions())) }, 'Exporter en CSV'),
          el('button', { class: 'button-link', type: 'button', onclick: () => loadAndShow() }, 'Rafraîchir'),
        ]),
      ]) : '',
      content,
    ]),
  ]);
  showScreen(main, screen, {
    title: 'Espace professeur',
    aside: [el('span', {}, state.teacher), el('button', { class: 'button-link', type: 'button', onclick: logout }, 'Se déconnecter')],
  }, state.view === 'seances' ? '#recherche' : 'h1');
}

async function switchView(view) {
  state.view = view;
  if (view === 'identites' && state.identites === null) {
    try {
      state.identites = (await listIdentityCorrections()).corrections;
    } catch (error) {
      if (error.status === 401) { showLogin('Ta séance a expiré : connecte-toi de nouveau.'); return; }
      state.identites = [];
    }
  }
  showDashboard();
}

async function logout() {
  try { await teacherLogout(); } catch { /* le cookie expirera seul */ }
  state.teacher = null;
  state.seances = [];
  state.identites = null;
  showLogin('Déconnecté.');
}

// Charge les séances (et, si elles sont affichées, les corrections d'identité), puis affiche.
async function loadAndShow() {
  try {
    const { enseignant, exercices, seances } = await listSessions();
    state.teacher = enseignant;
    state.exercices = exercices;
    state.seances = seances;
    if (state.view === 'identites') state.identites = (await listIdentityCorrections()).corrections;
    showDashboard();
    return true;
  } catch (error) {
    if (error.status === 401) { showLogin(); return false; }
    showLogin(serverErrorMessage(error));
    return false;
  }
}

loadAndShow();
