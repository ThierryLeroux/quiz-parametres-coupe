// Les chemins vers l'accueil (D87) : le lien de l'en-tête sur chacune des quatre pages, qui survit à showScreen ;
// « ← Page de l'exercice » sous l'identification 1 / 2, qui appelle onHome et laisse le jeton gardé ; le lien de
// l'écran de connexion de l'espace enseignant (une seule connexion, D95) ; la confirmation de la coquille avant de
// quitter par la barre du haut. Les écrans sont construits sur le DOM minuscule de aide-dom.js et c'est ce DOM qu'on regarde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fakeStorage, installDom } from './aide-dom.js';
import { HEADER_LINK_NAME, HOME_LINK_LABEL } from '../site/js/ui/text.js';
import { LEAVE_CONFIRMATION, LOGIN_LINKS, confirmsBeforeLeaving, loginNotice } from '../site/js/ui/prof-data.js';
import { SESSION_KEY, loadSession } from '../site/js/session.js';
import { el, showScreen } from '../site/js/ui/dom.js';
import { renderCreate, renderIdentity, renderMatricule, renderResume } from '../site/js/ui/identification-screen.js';
import { renderLoadError } from '../site/js/ui/home-screen.js';

const PAGES = ['site/index.html', 'site/prof.html', 'site/tables.html', 'site/verifier.html'];
const lire = (chemin) => readFile(new URL(`../${chemin}`, import.meta.url), 'utf8');

// Ce navigateur garde le jeton d'une séance du M10 : aucun écran d'identification ne doit y toucher.
const GARDE = { matricule: '2412345', prenom: 'Camille', jeton: 'jeton-du-m10', exercice: 'm10-tournage-vc' };
const storage = fakeStorage({ [SESSION_KEY]: JSON.stringify(GARDE) });
const { main, document } = installDom({ url: 'http://localhost/?exercice=m10-tournage-vc', storage });
const EXERCICE = { id: 'm10-tournage-vc', titre: 'M10 — Tournage : vitesse de coupe', version: 2 };

// --- L'en-tête des cinq pages ----------------------------------------------------------------------------------------

test('les quatre pages : le logo et le titre forment un seul lien vers l’accueil, nommé « Accueil — tous les exercices », dans l’en-tête no-print', async () => {
  assert.equal(HEADER_LINK_NAME, 'Accueil — tous les exercices');
  for (const page of PAGES) {
    const html = await lire(page);
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    assert.match(header, /^<header class="app-header no-print">/, page);
    const liens = header.match(/<a [^>]*>/g) ?? [];
    assert.deepEqual(liens, [`<a class="app-brand" href="/" aria-label="${HEADER_LINK_NAME}" title="${HEADER_LINK_NAME}">`], page); // un seul lien : le logo et le titre
    const lien = header.slice(header.indexOf('<a '), header.indexOf('</a>'));
    assert.match(lien, /<img class="app-logo" src="\/?img\/logo-cvm\.png" alt="Cégep du Vieux Montréal">/, page);
    assert.match(lien, /<div class="app-title" id="header-title">[^<]+<\/div>/, page);
    assert.ok(header.indexOf('id="header-aside"') > header.indexOf('</a>'), `${page} : la partie droite de la barre n'est pas dans le lien`);
  }
});

test('app.css : le lien de l’en-tête garde l’apparence du bloc d’avant (couleur du texte, pas de soulignement), le titre passe au bleu clair au survol', async () => {
  const css = await lire('site/css/app.css');
  const regle = css.slice(css.indexOf('.app-brand {'), css.indexOf('}', css.indexOf('.app-brand {')));
  assert.match(regle, /color: inherit;/);
  assert.match(regle, /text-decoration: none;/);
  assert.match(css, /\.app-brand:hover \.app-title \{ color: var\(--color-accent-light\); \}/);
  // Le focus visible est celui de toute la page (base.css), rien ne l'annule pour le lien.
  assert.match(await lire('site/css/base.css'), /:focus-visible \{ outline: 2px solid var\(--color-accent-light\)/);
  assert.doesNotMatch(css, /\.app-brand[^{]*\{[^}]*outline: none/);
});

test('showScreen : change le texte du titre et le côté droit de la barre ; le lien de l’en-tête reste le même élément', () => {
  const avant = document.querySelector('header a.app-brand');
  showScreen(main, el('div', { class: 'screen' }, el('h1', { tabindex: '-1' }, 'Un écran')), { title: 'M10 — Tournage', aside: 'version 2' });
  const lien = document.querySelector('header a.app-brand[href="/"]');
  assert.equal(lien, avant);
  assert.equal(lien.getAttribute('aria-label'), HEADER_LINK_NAME);
  assert.ok(lien.querySelector('img.app-logo'));
  assert.equal(lien.querySelector('#header-title').textContent, 'M10 — Tournage');
  assert.equal(document.querySelector('#header-aside').textContent, 'version 2');
  assert.equal(document.title, 'M10 — Tournage');
  assert.equal(main.querySelector('h1').textContent, 'Un écran');
  assert.equal(document.activeElement, main.querySelector('h1'));
});

// --- Identification --------------------------------------------------------------------------------------------------

test('identification 1 / 2 : « ← Page de l’exercice » sous le formulaire appelle onHome, rien d’autre ; le jeton gardé reste', () => {
  const appels = [];
  renderMatricule(main, { exercise: EXERCICE }, { onSubmit: () => appels.push('submit'), onHome: () => appels.push('home') });
  const liens = main.querySelectorAll('.form-links button');
  assert.deepEqual(liens.map((b) => b.textContent), ["← Page de l'exercice"]);
  assert.equal(liens[0].getAttribute('type'), 'button'); // pas un envoi du formulaire
  assert.ok(liens[0].closest('.panel')); // sous le formulaire, dans le panneau
  assert.equal(document.activeElement, main.querySelector('#matricule'));
  liens[0].click();
  assert.deepEqual(appels, ['home']);
  assert.deepEqual(loadSession(), GARDE); // le navigateur garde le jeton : à showHome d'offrir « Reprendre, Camille »
  // Le titre de l'exercice est dans la barre du haut, qui reste le lien vers l'accueil.
  assert.equal(document.querySelector('a.app-brand[href="/"] #header-title').textContent, EXERCICE.titre);
  assert.equal(document.querySelector('#header-aside').textContent, 'version 2');
});

test('identification 1 / 2 ouvert après un jeton refusé (« Ta séance a expiré ») : le même lien, le matricule prérempli', () => {
  const appels = [];
  renderMatricule(main, { exercise: EXERCICE, notice: 'Ta séance a expiré. Identifie-toi de nouveau.', matricule: '2412345' }, { onSubmit: () => {}, onHome: () => appels.push('home') });
  assert.equal(main.querySelector('.server-message').textContent, 'Ta séance a expiré. Identifie-toi de nouveau.');
  assert.equal(main.querySelector('#matricule').value, '2412345');
  main.querySelector('.form-links button').click();
  assert.deepEqual(appels, ['home']);
});

test('identification 2 / 2 et « Corriger mon identité » : un seul lien chacun, inchangés — « Ce n’est pas moi », « Mauvais matricule », « Annuler »', () => {
  const appels = [];
  const actions = { onBack: () => appels.push('back'), onSubmit: () => appels.push('submit') };
  renderResume(main, { exercise: EXERCICE, prenom: 'Romain', initiale: 'L' }, actions);
  assert.deepEqual(main.querySelectorAll('.form-links button').map((b) => b.textContent), ["Ce n'est pas moi"]);
  main.querySelector('.form-links button').click();
  renderCreate(main, { exercise: EXERCICE, matricule: '7654321' }, actions);
  assert.deepEqual(main.querySelectorAll('.form-links button').map((b) => b.textContent), ['Mauvais matricule']);
  main.querySelector('.form-links button').click();
  renderIdentity(main, { exercise: EXERCICE, seance: { reussite_le: null, etudiant: { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' } } }, actions);
  assert.deepEqual(main.querySelectorAll('.form-links button').map((b) => b.textContent), ['Annuler']);
  main.querySelector('.form-links button').click();
  assert.deepEqual(appels, ['back', 'back', 'back']);
  assert.deepEqual(loadSession(), GARDE);
});

// --- « Le quiz n'a pas pu démarrer », connexions ------------------------------------------------------------------------

test('« Le quiz n’a pas pu démarrer » : « ← Tous les exercices » sous le message, vers l’accueil', () => {
  renderLoadError(main, new Error('catalogue illisible'));
  assert.equal(main.querySelector('h1').textContent, "Le quiz n'a pas pu démarrer");
  assert.equal(main.querySelector('.error-detail').textContent, 'catalogue illisible');
  const lien = main.querySelector('.form-links a');
  assert.equal(lien.textContent, HOME_LINK_LABEL);
  assert.equal(lien.getAttribute('href'), '/'); // location.pathname : le même lien que celui de la page de l'exercice (D71)
  assert.equal(HOME_LINK_LABEL, '← Tous les exercices');
});

test('la connexion de /prof, la seule de l’espace enseignant (D95) : « ← Tous les exercices », en lien, sous le formulaire', async () => {
  assert.deepEqual(LOGIN_LINKS, [{ label: '← Tous les exercices', href: '/' }]);
  const source = await lire('site/js/ui/prof-shell.js');
  const connexion = source.slice(source.indexOf('function showLogin'), source.indexOf('showScreen(main, screen, {', source.indexOf('function showLogin')));
  assert.match(connexion, /el\('div', \{ class: 'form-links' \}, LOGIN_LINKS\.map\(\(\{ label, href \}\) => el\('a', \{ class: 'button-link', href \}, label\)\)\)/);
  // Les deux modules d'écrans n'ont plus de connexion à eux.
  for (const fichier of ['site/js/ui/prof.js', 'site/js/ui/editeur.js']) assert.doesNotMatch(await lire(fichier), /function showLogin|teacherLogin/, fichier);
});

// --- La coquille de l'espace enseignant : quitter par la barre du haut --------------------------------------------------------

test('confirmsBeforeLeaving : demander seulement avec des modifications non enregistrées, et pas pour un clic qui ouvre un autre onglet', () => {
  assert.equal(confirmsBeforeLeaving(false), false);
  assert.equal(confirmsBeforeLeaving(true), true);
  assert.equal(confirmsBeforeLeaving(true, { ctrlKey: true }), false);
  assert.equal(confirmsBeforeLeaving(true, { metaKey: true }), false);
  assert.equal(confirmsBeforeLeaving(true, { shiftKey: true }), false);
  assert.equal(confirmsBeforeLeaving(false, { ctrlKey: true }), false);
  assert.equal(confirmsBeforeLeaving(undefined), false);
});

test('prof-shell.js : leave() et les liens de la barre du haut posent la même question, écrite une seule fois ; le beforeunload reste ; les modules d’écrans passent par la coquille', async () => {
  assert.equal(LEAVE_CONFIRMATION, 'Des modifications ne sont pas enregistrées. Quitter la page et les perdre ?');
  const source = await lire('site/js/ui/prof-shell.js');
  assert.equal((source.match(/window\.confirm\(LEAVE_CONFIRMATION\)/g) ?? []).length, 2);
  assert.doesNotMatch(source, /Quitter la page et les perdre/);
  assert.match(source, /window\.addEventListener\('beforeunload'/);
  assert.match(source, /document\.querySelector\('\.app-header'\)\.addEventListener\('click'/);
  assert.match(source, /confirmsBeforeLeaving\(state\.dirty, event\)/);
  for (const fichier of ['site/js/ui/prof.js', 'site/js/ui/editeur.js']) {
    const module = await lire(fichier);
    assert.doesNotMatch(module, /LEAVE_CONFIRMATION|beforeunload|state\.dirty/, fichier);
  }
  assert.match(await lire('site/js/ui/editeur.js'), /import \{ TITLE, guarded, headerAside, isDirty, leave, panelHead, readOnly, setDirty \} from '\.\/prof-shell\.js';/);
});

// --- Réponses de Thierry au rapport (D87, point 4), reprises par la coquille (D95) ------------------------------------------

test('prof-shell.js : à l’ouverture sans cookie, la connexion s’ouvre sans message ; « Ta séance a expiré » seulement pour une séance qui était ouverte (guarded, loginNotice)', async () => {
  const source = await lire('site/js/ui/prof-shell.js');
  // Le message n'est écrit qu'une fois, dans prof-data.js (les commentaires peuvent le citer) ; la coquille passe par
  // loginNotice(state.connected).
  assert.doesNotMatch(source.replace(/\/\/[^\n]*/g, ''), /Ta séance a expiré/);
  assert.match(source, /if \(error\.status === 401\) \{ showLogin\(loginNotice\(state\.connected\)\); return null; \}/);
  // Un appel qui réussit prouve la séance ouverte (la page rechargée avec son cookie) ; l'écran de connexion la ferme.
  const guarded = source.slice(source.indexOf('export async function guarded'), source.indexOf('export function headerAside'));
  assert.match(guarded, /const result = await action\(\);\s*state\.connected = true;\s*return result;/);
  const login = source.slice(source.indexOf('export function showLogin'), source.indexOf('async function logout'));
  assert.match(login, /state\.connected = false;/);
  // Le démarrage relit le rôle (GET /api/prof/role) : un 401 sans séance ouverte n'a pas de message.
  const start = source.slice(source.indexOf('export async function start'));
  assert.match(start, /await teacherRole\(\)/);
  assert.match(start, /showLogin\(error\.status === 401 \? '' : serverErrorMessage\(error\)\)/);
  assert.equal(loginNotice(false), '');
});

// --- Le DOM minuscule lui-même ------------------------------------------------------------------------------------------

test('aide-dom : sélecteurs (balise, #id, .classe, [attr], descendant), remontée des événements, preventDefault, closest', () => {
  const racine = el('div', { class: 'screen' }, [
    el('section', { class: 'panel' }, [el('h1', {}, 'Titre'), el('div', { class: 'form-links' }, [el('button', { type: 'button' }, 'Un'), el('a', { href: '/' }, 'Deux')])]),
    el('a', { href: '/prof', class: 'button-link' }, 'Trois'),
  ]);
  assert.deepEqual(racine.querySelectorAll('.form-links button, .form-links a').map((n) => n.textContent), ['Un', 'Deux']);
  assert.deepEqual(racine.querySelectorAll('a[href]').map((n) => n.textContent), ['Deux', 'Trois']);
  assert.equal(racine.querySelector('a[href="/prof"]').textContent, 'Trois');
  assert.equal(racine.querySelector('section h1').textContent, 'Titre');
  assert.equal(racine.querySelector('.form-links h1'), null);
  assert.equal(racine.querySelector('button').closest('.panel'), racine.children[0]);
  const vus = [];
  racine.addEventListener('click', (event) => { vus.push(`racine:${event.target.textContent}`); event.preventDefault(); });
  assert.equal(racine.querySelector('button').click(), false); // annulé par la racine
  assert.deepEqual(vus, ['racine:Un']);
  racine.querySelector('h1').textContent = 'Autre';
  assert.equal(racine.querySelector('h1').textContent, 'Autre');
});
