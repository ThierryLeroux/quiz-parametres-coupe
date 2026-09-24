// Espace professeur (décisions D34, D35, D44 ; UI §3.8) : connexion par la clé d'administration ou
// la clé de consultation, tableau des séances (filtre par exercice, tri par colonne, recherche, export
// CSV, remise à zéro) et journal des corrections d'identité. Le rôle consultation ne voit aucun
// bouton d'action — et le serveur les refuse de toute façon. Le client ne contient aucun secret : le
// serveur ne répond qu'avec le cookie de séance posé à la connexion ; un 401 ramène à la connexion.
// Ce qu'on montre est décidé par prof-data.js (pur, testé) : ici, on construit le DOM.

import { deleteSession, listIdentityCorrections, listSessions, purgeStudentData, resetNip, resetSession, teacherLogin, teacherLogout } from '../api.js';
import { el, showScreen } from './dom.js';
import {
  PURGE_WORD, SESSION_COLUMNS, canAct, csvFileName, csvOf, deleteConfirmation, filterSessions, identityRows, nipResetConfirmation, purgeIntro, purgeSummary,
  resetConfirmation, roleLabel, sessionCells, sortSessions,
} from './prof-data.js';
import { serverErrorMessage } from './text.js';

const main = document.querySelector('#app');

// L'état de l'écran : ce que le serveur a rendu, et ce que l'enseignant a choisi.
const state = {
  teacher: null,
  role: null, // 'admin' ou 'consultation' (D44)
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
      const { enseignant, role } = await teacherLogin(input.value);
      state.teacher = enseignant;
      state.role = role;
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
    el('p', { class: 'muted small' }, "Entre la clé d'administration ou la clé de consultation du serveur de correction. La séance dure 12 h."),
    el('form', { novalidate: true, onsubmit: submit }, [
      el('div', { class: 'form-grid form-grid--single' }, el('div', { class: 'field' }, [el('label', { for: 'cle' }, 'Clé'), input, el('div', { class: 'field-note', id: 'cle-note' }, "Clé d'administration, ou clé de consultation (lecture seule). Cinq essais, puis un délai croissant.")])),
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

// Une action sur une séance, après confirmation : remise à zéro (D35) ou réinitialisation du NIP (D38).
async function act(button, confirmation, action) {
  if (!window.confirm(confirmation)) return;
  button.disabled = true;
  try {
    await action();
    await loadAndShow();
  } catch (error) {
    if (error.status === 401) { showLogin('Ta séance a expiré : connecte-toi de nouveau.'); return; }
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
  const actions = canAct(state.role);
  const header = el('tr', {}, [
    ...SESSION_COLUMNS.map((column) => {
      const active = state.sort.key === column.key;
      return el('th', { class: column.num ? 'num' : null, 'aria-sort': active ? (state.sort.ascending ? 'ascending' : 'descending') : 'none' },
        el('button', { class: 'sort-button', type: 'button', onclick: () => { state.sort = { key: column.key, ascending: active ? !state.sort.ascending : true }; showDashboard(); } }, column.label));
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
      el('div', { class: 'panel-head' }, [el('div', { class: 'eyebrow' }, `Espace professeur · ${roleLabel(state.role)}`), el('div', { class: 'prof-tabs', role: 'tablist' }, tabs)]),
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
      // La page d'effacement (D46) : rôle admin seulement, à part du tableau.
      state.view === 'seances' && canAct(state.role)
        ? el('p', { class: 'prof-purge-link' }, el('button', { class: 'button-link', type: 'button', onclick: () => showPurge() }, 'Effacer les données des étudiants…'))
        : '',
    ]),
  ]);
  showScreen(main, screen, { title: 'Espace professeur', aside: headerAside() }, state.view === 'seances' ? '#recherche' : 'h1');
}

function headerAside() {
  return [
    el('span', {}, roleLabel(state.role)),
    // L'éditeur des exercices (jalon 7a, D47) : rôle admin seulement — le serveur refuse de toute façon la clé de consultation.
    ...(canAct(state.role) ? [el('a', { class: 'button-link', href: '/prof/editeur' }, 'Éditeur des exercices')] : []),
    el('button', { class: 'button-link', type: 'button', onclick: logout }, 'Se déconnecter'),
  ];
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
      const { nombres } = await purgeStudentData(input.value.trim());
      state.identites = null;
      await reload();
      showPurge(purgeSummary(nombres));
    } catch (error) {
      if (error.status === 401) { showLogin('Ta séance a expiré : connecte-toi de nouveau.'); return; }
      status.textContent = serverErrorMessage(error);
      input.value = '';
      input.focus();
    }
  }

  const screen = el('div', { class: 'screen screen--narrow prof' }, el('section', { class: 'panel panel--wrong' }, [
    el('div', { class: 'eyebrow' }, `Espace professeur · ${roleLabel(state.role)}`),
    el('h1', { tabindex: '-1' }, 'Effacer les données des étudiants'),
    el('p', { class: 'small' }, purgeIntro(state.seances.length)),
    el('ol', { class: 'purge-steps' }, [
      el('li', {}, [
        el('div', {}, "Exporter toutes les séances en CSV d'abord : c'est la dernière occasion."),
        el('p', {}, el('button', { class: 'button-outline', type: 'button', onclick: () => download(csvFileName('', new Date()), csvOf(state.seances)) }, 'Exporter tout en CSV')),
      ]),
      el('li', {}, el('form', { novalidate: true, onsubmit: submit }, [
        el('div', { class: 'field' }, [el('label', { for: 'confirmation' }, `Tape ${PURGE_WORD} pour confirmer`), input, el('div', { class: 'field-note', id: 'confirmation-note' }, 'En majuscules, tel quel. Le bouton ne s\'active qu\'avec le mot exact.')]),
        el('div', { class: 'form-actions' }, [status, button]),
      ])),
    ]),
    el('p', { class: 'prof-purge-link' }, el('button', { class: 'button-link', type: 'button', onclick: () => showDashboard() }, '← Retour aux réussites')),
  ]));
  showScreen(main, screen, { title: 'Espace professeur', aside: headerAside() }, '#confirmation');
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
  state.role = null;
  state.seances = [];
  state.identites = null;
  showLogin('Déconnecté.');
}

// Recharge les séances (et, si elles sont affichées, les corrections d'identité) dans l'état.
async function reload() {
  const { enseignant, role, exercices, seances } = await listSessions();
  state.teacher = enseignant;
  state.role = role;
  state.exercices = exercices;
  state.seances = seances;
  if (state.view === 'identites') state.identites = (await listIdentityCorrections()).corrections;
}

// Charge, puis affiche le tableau ; un 401 ramène à la connexion.
async function loadAndShow() {
  try {
    await reload();
    showDashboard();
    return true;
  } catch (error) {
    if (error.status === 401) { showLogin(); return false; }
    showLogin(serverErrorMessage(error));
    return false;
  }
}

loadAndShow();
