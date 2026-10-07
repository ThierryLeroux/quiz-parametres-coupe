// La coquille de l'espace enseignant (décision D95 ; UI §3.8) : ce que les deux modules d'écrans — prof.js (Réussites,
// Corrections d'identité, Effacement) et editeur.js (Exercices, Banque d'outils, Tables de référence, Images,
// Sauvegarde) — ont en commun. La séance et son rôle (D44), la connexion unique aux deux clés, la barre du haut
// (l'étiquette de l'espace, D94 ; Se déconnecter), la rangée d'onglets, l'onglet courant dans le fragment de l'adresse
// (« /prof#exercices » : un rechargement y revient), la garde des modifications non enregistrées, et le retour à la
// connexion sur un 401. prof-main.js enregistre les onglets des deux modules et démarre.
// Le client ne contient aucun secret : le serveur ne répond qu'avec le cookie de séance posé à la connexion. Ce qu'on
// montre est décidé par prof-data.js (pur, testé) : ici, on construit le DOM.

import { teacherLogin, teacherLogout, teacherRole } from '../api.js';
import { el, showScreen } from './dom.js';
import { LEAVE_CONFIRMATION, LOGIN_LINKS, TITLE, canAct, confirmsBeforeLeaving, eyebrowText, initialTab, loginNotice, roleLabel, spaceOf, tabsFor } from './prof-data.js';
import { serverErrorMessage } from './text.js';

export { TITLE };

const main = document.querySelector('#app');

// L'état de la séance, partagé par tous les écrans de la page.
const state = {
  teacher: null,
  role: null, // 'admin' ou 'consultation' (D44) ; null : aucune séance (la connexion)
  connected: false, // une séance est ouverte (connexion réussie, ou un appel qui a réussi après un rechargement) : un 401 dit alors « Ta séance a expiré »
  dirty: false, // des modifications non enregistrées sur l'écran courant (la Gestion du contenu)
  current: null, // la clé de l'onglet courant
};
const openers = new Map(); // clé d'onglet → la fonction qui l'ouvre, enregistrée par prof-main.js

// Le rôle de la séance, et ce qu'il permet : la consultation lit tout, sans aucun bouton d'action (D95).
export const role = () => state.role;
export const readOnly = () => !canAct(state.role);
export const isDirty = () => state.dirty;
export const setDirty = (flag) => { state.dirty = Boolean(flag); };

// Les onglets : { seances: showSessions, identites: showIdentities, exercices: showList, … } (prof-main.js).
export function registerTabs(map) {
  for (const [key, open] of Object.entries(map)) openers.set(key, open);
}

// L'ambiance de couleur de la page (D94) : data-espace sur <html>, d'après le rôle — l'espace étudiant sur la connexion,
// ambre en consultation, pourpre en administration. Les couleurs elles-mêmes sont dans tokens.css.
const applySpace = () => { document.documentElement.dataset.espace = spaceOf(state.role); };

// Quitter la page avec des modifications non enregistrées : le navigateur demande (son texte à lui) pour ce que la page
// ne contrôle pas — bouton Précédent, onglet du navigateur fermé, adresse retapée.
window.addEventListener('beforeunload', (event) => {
  if (state.dirty) event.preventDefault();
});

// Les liens de la barre du haut quittent la page aussi (le logo vers l'accueil, D87) : la même confirmation que leave(),
// dans les mots de la page ; confirmée, state.dirty tombe et beforeunload n'a plus rien à demander ; refusée, le clic est
// annulé. Un clic qui ouvre un autre onglet du navigateur (Ctrl, Maj, ⌘) ne quitte pas la page.
document.querySelector('.app-header').addEventListener('click', (event) => {
  if (!event.target.closest('a[href]') || !confirmsBeforeLeaving(state.dirty, event)) return;
  if (window.confirm(LEAVE_CONFIRMATION)) state.dirty = false;
  else event.preventDefault();
});

// --- Connexion : une seule, aux deux clés ; le rôle décide des onglets et de ce qu'ils permettent -----------------------

export function showLogin(notice = '') {
  state.role = null;
  state.teacher = null;
  state.connected = false;
  state.dirty = false;
  applySpace();
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
      const { enseignant, role: opened } = await teacherLogin(input.value);
      state.teacher = enseignant;
      state.role = opened;
      state.connected = true;
      await openTab(initialTab(location.hash, opened));
    } catch (error) {
      status.textContent = error.status === 429 && error.details.attendre_s ? `${error.message} (${error.details.attendre_s} s)` : serverErrorMessage(error);
      button.disabled = false;
      input.focus();
    }
  }

  const screen = el('div', { class: 'screen screen--narrow' }, el('section', { class: 'panel' }, [
    el('div', { class: 'eyebrow' }, TITLE),
    el('h1', { tabindex: '-1' }, 'Connexion'),
    el('p', { class: 'muted small' }, 'Entre ta clé. La séance dure 12 h.'),
    el('form', { novalidate: true, onsubmit: submit }, [
      el('div', { class: 'form-grid form-grid--single' }, el('div', { class: 'field' }, [el('label', { for: 'cle' }, 'Clé'), input, el('div', { class: 'field-note', id: 'cle-note' }, "Clé d'administration, ou clé de consultation (lecture seule). Cinq essais, puis un délai croissant.")])),
      el('div', { class: 'form-actions' }, [status, button]),
    ]),
    // Le retour à l'accueil (D87), visible aussi après « Se déconnecter ».
    el('div', { class: 'form-links' }, LOGIN_LINKS.map(({ label, href }) => el('a', { class: 'button-link', href }, label))),
  ]));
  showScreen(main, screen, { title: TITLE, aside: 'Techniques de génie mécanique' }, '#cle');
}

async function logout() {
  try { await teacherLogout(); } catch { /* le cookie expirera seul */ }
  showLogin('Déconnecté.');
}

// Un appel au serveur depuis un écran : un 401 ramène à la connexion — avec « Ta séance a expiré » seulement si une
// séance était ouverte (loginNotice) ; à l'ouverture de la page sans cookie, la connexion s'ouvre sans message (D87,
// point 4) — et rend null ; un appel qui réussit prouve la séance ouverte. Les autres erreurs remontent à l'écran.
export async function guarded(action) {
  try {
    const result = await action();
    state.connected = true;
    return result;
  } catch (error) {
    if (error.status === 401) { showLogin(loginNotice(state.connected)); return null; }
    throw error;
  }
}

// --- La barre du haut et les onglets ----------------------------------------------------------------------------------

// À droite de la barre du haut : l'étiquette de l'espace (D94), la déconnexion.
export function headerAside() {
  applySpace();
  return [
    el('span', { class: 'espace-etiquette' }, roleLabel(state.role)),
    el('button', { class: 'button-link', type: 'button', onclick: logout }, 'Se déconnecter'),
  ];
}

// La rangée d'onglets, ceux du rôle (tabsFor) ; chaque clic passe par la garde des modifications.
export function tabs(current) {
  return el('div', { class: 'prof-tabs', role: 'tablist' }, tabsFor(state.role).map((tab) => el('button', {
    class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(current === tab.key), onclick: () => leave(openTab, tab.key),
  }, tab.label)));
}

// Le sur-titre d'un écran (« Espace enseignant · exercices · lecture seule »), seul ou avec les onglets.
export const eyebrow = (part) => el('div', { class: 'eyebrow' }, eyebrowText(part, state.role));
export const panelHead = (part, current) => el('div', { class: 'panel-head' }, [eyebrow(part), tabs(current)]);

// Quitter l'écran courant : si des modifications ne sont pas enregistrées, demander d'abord.
export function leave(open, ...args) {
  if (state.dirty && !window.confirm(LEAVE_CONFIRMATION)) return;
  state.dirty = false;
  open(...args);
}

// Ouvre un onglet par sa clé et l'inscrit dans le fragment de l'adresse (sans recharger ni empiler d'historique).
// Une erreur autre qu'un 401 (que guarded a déjà ramenée à la connexion) s'affiche dans la page, avec les onglets.
export async function openTab(key, ...args) {
  const open = openers.get(key);
  if (!open) return;
  state.current = key;
  history.replaceState(null, '', `#${key}`);
  try {
    await open(...args);
  } catch (error) {
    const screen = el('div', { class: 'screen screen--wide prof' }, el('section', { class: 'panel panel--wrong' }, [
      panelHead('', key),
      el('h1', { tabindex: '-1' }, "Cet onglet n'a pas pu s'ouvrir"),
      el('p', { class: 'small' }, serverErrorMessage(error)),
    ]));
    showScreen(main, screen, { title: TITLE, aside: headerAside() }, 'h1');
  }
}

// --- Démarrage : la séance ouverte (le cookie) dit le rôle, puis l'onglet du fragment s'ouvre ; sans séance, la connexion --

export async function start() {
  try {
    const { enseignant, role: opened } = await teacherRole();
    state.teacher = enseignant;
    state.role = opened;
    state.connected = true;
  } catch (error) {
    showLogin(error.status === 401 ? '' : serverErrorMessage(error));
    return;
  }
  await openTab(initialTab(location.hash, state.role));
}
