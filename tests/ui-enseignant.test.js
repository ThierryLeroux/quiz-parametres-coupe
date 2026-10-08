// L'espace enseignant, une seule page (décision D95 ; UI §3.8, §3.9) : la coquille (connexion, onglets, fragment de
// l'adresse, garde des modifications), puis chaque écran des deux rôles — construit sur le DOM minuscule de
// aide-dom.js par les vrais modules (prof-shell.js, prof.js, editeur.js) contre le VRAI Worker (aide-serveur.js), que
// la page appelle par une fausse fetch. Pour la consultation : aucun bouton hors des lectures, chaque case de saisie
// dans un fieldset inactif, aucun champ fichier, Sauvegarde absent, jamais le brouillon ; pour l'administration, les
// boutons d'action. C'est le DOM construit qu'on regarde ; la mise en page se vérifie dans Chrome (rapport espace-enseignant).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './aide-dom.js';
import { serveurDeTest } from './aide-serveur.js';
import { lireFichier } from './aide.js';
import { SESSION_COLUMNS, TABS } from '../site/js/ui/prof-data.js';

const M10 = 'm10-tournage-vc';
const m10 = await lireFichier('exercices/m10-tournage-vc.json');
const serveur = serveurDeTest();

// Le cookie de chaque rôle : la page le « garde », la fausse fetch l'envoie à chaque appel.
async function cookieDe(cle) {
  const { status } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle } });
  assert.equal(status, 200);
  return `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}`;
}
const COOKIES = { admin: await cookieDe('cle-admin-de-test'), consultation: await cookieDe('cle-consultation-de-test') };
let cookie = null; // la séance en cours dans le « navigateur » ; null : aucune

// Un exercice jamais publié, et un brouillon du M10 différent de sa version publiée : la consultation ne les voit pas.
{
  const entetes = { cookie: COOKIES.admin };
  assert.equal((await serveur.appel('POST', '/api/prof/editeur/exercice/creer', { corps: { id: 'jamais-publie', titre: 'Jamais publié' }, entetes })).status, 200);
  const page = (await serveur.appel('GET', `/api/prof/editeur/exercice?id=${M10}`, { entetes })).corps;
  assert.equal((await serveur.appel('POST', '/api/prof/editeur/exercice/enregistrer', { corps: { id: M10, revision: page.exercice.revision, brouillon: { ...page.exercice.brouillon, champs_evalues: ['vc', 'n'] } }, entetes })).status, 200);
}

// La page parle au vrai Worker : fetch remplacée — la méthode, le chemin et le corps passent à serveur.appel, avec le cookie.
const { main, document } = installDom({ url: 'http://localhost/prof' });
globalThis.fetch = async (path, init = {}) => {
  const { status, corps } = await serveur.appel(init.method ?? 'GET', path, { corps: init.body === undefined ? undefined : JSON.parse(init.body), entetes: cookie ? { cookie } : {} });
  return new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
};
globalThis.confirm = () => true;
globalThis.alert = () => {};
// Les modules lisent #app à leur chargement : après installDom.
const shell = await import('../site/js/ui/prof-shell.js');
const { showIdentities, showSessions } = await import('../site/js/ui/prof.js');
const editeur = await import('../site/js/ui/editeur.js');
shell.registerTabs({ seances: showSessions, identites: showIdentities, exercices: editeur.showList, banque: editeur.showBank, tables: editeur.showTables, images: editeur.showImages, sauvegarde: editeur.showBackup });

// Attend qu'une condition soit vraie (un écran ouvert par un clic, sans promesse à attendre).
async function until(predicate, what = 'la condition') {
  for (let i = 0; i < 2000; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => { setImmediate(resolve); });
  }
  throw new Error(`${what} n'est jamais venue`);
}
const h1 = () => main.querySelector('h1')?.textContent ?? '';
const texts = (selector, root = main) => root.querySelectorAll(selector).map((node) => node.textContent.trim());
const buttonTexts = () => texts('button, a.button-small, a.button-outline, a.button-link, a.button');
const tabLabels = () => texts('.prof-tabs .tab');
const eyebrow = () => main.querySelector('.eyebrow').textContent;
const badge = () => document.querySelector('#header-aside .espace-etiquette')?.textContent ?? null;
const clickButton = (label, root = main) => {
  const button = root.querySelectorAll('button').find((b) => b.textContent.trim() === label);
  assert.ok(button, `bouton « ${label} »`);
  button.click();
};

// Ouvre la session d'un rôle et son premier onglet (Réussites) depuis le fragment donné.
async function start(role, hash = '') {
  cookie = COOKIES[role];
  shell.setDirty(false);
  location.hash = hash;
  await shell.start();
}

// --- Les lectures permises à la consultation (D95) : tout autre bouton est un bouton d'action, interdit ---------------------
const LECTURES = new Set([
  'Se déconnecter', 'Exporter en CSV', 'Rafraîchir', 'Voir', 'Copier le lien étudiant', 'Aperçu', 'Dix questions', 'Dix autres', 'Fermer',
  '← Exercices', '← Banque', 'Feuilles imprimables',
  ...TABS.map((t) => t.label), ...SESSION_COLUMNS.map((c) => c.label),
]);
const isLecture = (text) => LECTURES.has(text) || /^\d+\. /.test(text); // « 1. mclnr » : déplier un outil
// Les cases qui restent actives en lecture seule : les filtres et le choix de l'exercice de l'aperçu.
const FILTRES = new Set(['exercice', 'recherche', 'images-usage', 'images-recherche', 'pr-apercu-exercice']);

// Ce que chaque écran de la consultation doit respecter. Le titre d'un exercice et le nom d'un outil, dans une liste,
// sont des boutons qui ouvrent la page (comme « Voir ») : des lectures.
function assertReadOnlyScreen(name) {
  const ouvertures = new Set(texts('tbody td button.button-link'));
  const interdits = buttonTexts().filter((text) => !isLecture(text) && !ouvertures.has(text));
  assert.deepEqual(interdits, [], `${name} : des boutons d'action`);
  assert.equal(main.querySelectorAll('input[type="file"]').length, 0, `${name} : un champ fichier`);
  const libres = main.querySelectorAll('input, select, textarea').filter((node) => !node.closest('fieldset[disabled]') && !FILTRES.has(node.id));
  assert.deepEqual(libres.map((node) => `${node.tagName.toLowerCase()}#${node.id}`), [], `${name} : des cases hors d'un fieldset inactif`);
  assert.match(eyebrow(), / · lecture seule$/, name);
  assert.equal(badge(), 'Consultation', name);
  assert.deepEqual(tabLabels(), TABS.filter((t) => !t.adminOnly).map((t) => t.label), name);
}

// --- La connexion, une seule, et le démarrage -------------------------------------------------------------------------------

test('sans séance, la connexion s’ouvre sans message : « Espace enseignant », les deux clés annoncées, « ← Tous les exercices » ; une clé fausse est dite', async () => {
  cookie = null;
  await shell.start();
  assert.equal(h1(), 'Connexion');
  assert.equal(eyebrow(), 'Espace enseignant');
  assert.equal(main.querySelector('.server-message').textContent, '');
  assert.match(main.querySelector('#cle-note').textContent, /^Clé d'administration, ou clé de consultation \(lecture seule\)\./);
  assert.deepEqual(texts('.form-links a'), ['← Tous les exercices']);
  assert.equal(document.querySelector('#header-title').textContent, 'Espace enseignant');
  assert.equal(badge(), null);
  // Une clé fausse : « Clé incorrecte. », la connexion reste.
  main.querySelector('#cle').value = 'mauvaise';
  main.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await until(() => main.querySelector('.server-message')?.textContent !== '', 'le refus');
  assert.equal(main.querySelector('.server-message').textContent, 'Clé incorrecte.');
  assert.equal(h1(), 'Connexion');
});

test('la clé de consultation ouvre Réussites : l’étiquette « Consultation », le sur-titre « lecture seule », six onglets, ni Actions ni effacement', async () => {
  cookie = null;
  location.hash = '';
  await shell.start();
  cookie = COOKIES.consultation; // le navigateur garde le cookie que la connexion pose
  main.querySelector('#cle').value = 'cle-consultation-de-test';
  main.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await until(() => h1() === 'Réussites par exercice', 'le tableau');
  assert.equal(eyebrow(), 'Espace enseignant · réussites · lecture seule');
  assertReadOnlyScreen('Réussites');
  assert.equal(texts('thead th').includes('Actions'), false);
  assert.equal(main.querySelector('.prof-purge-link'), null);
  assert.equal(location.hash, '#seances');
});

test('la clé d’administration ouvre Réussites avec sept onglets, la colonne Actions et le lien d’effacement ; « Se déconnecter » ramène à la connexion', async () => {
  await start('admin');
  assert.equal(h1(), 'Réussites par exercice');
  assert.equal(badge(), 'Administration');
  assert.equal(eyebrow(), 'Espace enseignant · réussites');
  assert.deepEqual(tabLabels(), TABS.map((t) => t.label));
  assert.ok(texts('thead th').includes('Actions'));
  assert.ok(main.querySelector('.prof-purge-link button'));
  clickButton('Se déconnecter', document.querySelector('#header-aside'));
  await until(() => h1() === 'Connexion', 'la connexion');
  assert.equal(main.querySelector('.server-message').textContent, 'Déconnecté.');
});

test('le fragment de l’adresse choisit l’onglet au démarrage (/prof#exercices, ce que donne l’ancienne adresse) ; chaque onglet ouvert s’y inscrit ; Sauvegarde refusé à la consultation', async () => {
  await start('consultation', '#exercices');
  assert.equal(h1(), 'Exercices');
  await shell.openTab('banque');
  assert.equal(location.hash, '#banque');
  await start('consultation', '#sauvegarde');
  assert.equal(h1(), 'Réussites par exercice');
  await start('admin', '#sauvegarde');
  assert.equal(h1(), 'Sauvegarde');
});

test('la garde des modifications : avec des modifications non enregistrées, changer d’onglet demande d’abord, Réussites compris ; refusé, l’écran reste ; accepté, l’écran change et la garde tombe', async () => {
  await start('admin', '#banque');
  assert.equal(h1(), "Banque d'outils");
  shell.setDirty(true);
  globalThis.confirm = () => false;
  clickButton('Réussites');
  await new Promise((resolve) => { setTimeout(resolve, 20); });
  assert.equal(h1(), "Banque d'outils");
  assert.equal(shell.isDirty(), true);
  globalThis.confirm = () => true;
  clickButton('Réussites');
  await until(() => h1() === 'Réussites par exercice', 'le tableau');
  assert.equal(shell.isDirty(), false);
});

// --- La consultation, écran par écran : lecture seule, jamais le brouillon --------------------------------------------------

test('consultation — Exercices : les exercices publiés seulement, « Publié », « Voir » et le lien étudiant, pas de création', async () => {
  await start('consultation', '#exercices');
  assertReadOnlyScreen('Exercices');
  const ids = texts('tbody td.mono');
  assert.ok(ids.includes(M10));
  assert.equal(ids.includes('jamais-publie'), false);
  assert.ok(texts('tbody td').includes('Publié'));
  assert.equal(texts('tbody td').some((t) => /Brouillon modifié|À jour|Jamais publié/.test(t)), false);
  assert.equal(main.querySelector('#nouvel-id'), null);
  assert.match(main.querySelector('section.panel p.muted').textContent, /^Lecture seule/);
});

test('consultation — la page d’un exercice : sa dernière version publiée (pas le brouillon), les réglages et les outils dans un fieldset inactif, la présentation sans Appliquer ni Rétablir, les versions avec Aperçu seulement', async () => {
  await start('consultation', '#exercices');
  const ligne = main.querySelectorAll('tbody tr').find((tr) => tr.querySelector('td.mono').textContent === M10);
  clickButton('Voir', ligne);
  await until(() => h1() === m10.titre, "la page de l'exercice");
  assertReadOnlyScreen("page d'un exercice");
  assert.match(main.querySelector('.editeur-bar .muted').textContent, / · version 1 publiée le \d{4}-\d{2}-\d{2} \d{2}:\d{2} · tables de référence A2026_r0$/);
  assert.doesNotMatch(main.querySelector('.editeur-bar .muted').textContent, /brouillon modifié/);
  // La version publiée : les grandeurs évaluées sont celles de la version 1 (le brouillon a « vc, n »).
  const evaluees = main.querySelectorAll('input[type="radio"][value="evaluee"]').filter((input) => input.hasAttribute('checked')).map((input) => input.getAttribute('name'));
  assert.deepEqual(evaluees, m10.champs_evalues.map((key) => `etat-${key}`));
  assert.equal(main.querySelectorAll('fieldset.lecture-seule[disabled]').length >= 3, true); // présentation, réglages, outils
  // Le panneau de la présentation en consultation (retouche de D95) : « Présentation en vigueur », sans la pastille « En direct ».
  assert.equal(main.querySelector('.panel--direct .eyebrow').textContent, 'Présentation en vigueur');
  assert.equal(main.querySelector('.panel--direct .badge-direct'), null);
  assert.equal(main.textContent.includes('effet immédiat'), false);
  assert.equal(main.querySelectorAll('.outil-ligne').length, m10.outils.length);
  assert.equal(main.querySelectorAll('.outil-ligne input[type="checkbox"][aria-label]').length, 0); // pas de sélection
  assert.equal(main.querySelector('#ajout-banque'), null);
  assert.equal(main.querySelector('.token-buttons'), null); // aucun bouton de crochet
  assert.equal(texts('.versions-liste button').filter((t) => t === 'Aperçu').length, 1);
  // L'aperçu d'une version : une lecture, ouverte à la consultation.
  clickButton('Aperçu', main.querySelector('.versions-liste'));
  await until(() => main.querySelector('.apercu-table') !== null, "l'aperçu");
  assert.equal(main.querySelectorAll('.apercu-table tbody tr').length, 10);
  assertReadOnlyScreen("page d'un exercice, aperçu ouvert");
  clickButton('← Exercices');
  await until(() => h1() === 'Exercices', 'la liste');
});

test('consultation — Banque d’outils et la fiche d’un outil : « Voir », pas de création ; la fiche dans un fieldset inactif, l’historique sans Rétablir, pas d’enregistrement', async () => {
  await start('consultation', '#banque');
  assertReadOnlyScreen("Banque d'outils");
  assert.equal(main.querySelector('#nouvel-outil'), null);
  const premiere = main.querySelector('tbody tr');
  const nom = premiere.querySelector('td button').textContent;
  clickButton('Voir', premiere);
  await until(() => h1() === nom, "la fiche de l'outil");
  assertReadOnlyScreen("fiche d'un outil");
  assert.ok(main.querySelector('fieldset.lecture-seule[disabled] .outil-formulaire'));
  assert.ok(main.querySelector('.banque-historique'));
  assert.equal(main.querySelector('.exemple-nomenclature button'), null); // pas d'« Autre exemple »
  clickButton('← Banque');
  await until(() => h1() === "Banque d'outils", 'la banque');
});

test('consultation — Tables de référence : la présentation en lecture, puis les valeurs de la dernière version publiée (pas le brouillon), sans Ajouter, Enregistrer, Publier ni Reprendre', async () => {
  await start('consultation', '#tables');
  assertReadOnlyScreen('Tables de référence');
  assert.deepEqual(texts('.eyebrow').slice(1), ['Présentation en vigueur', 'Valeurs — version A2026_r0', 'Version A2026_r0 · Classes ISO', "Version A2026_r0 · Matières d'outil", 'Version A2026_r0 · Matériaux usinés', 'Version A2026_r0 · Opérations', 'Versions publiées']);
  assert.equal(main.querySelector('.panel--direct .badge-direct'), null); // ni pastille « En direct » ni « effet immédiat » en consultation
  assert.equal(main.textContent.includes('effet immédiat'), false);
  assert.doesNotMatch(main.textContent, /Brouillon parti de la version/);
  assert.ok(main.querySelectorAll('fieldset.lecture-seule[disabled]').length >= 5);
  assert.ok(main.querySelector('.versions-liste a[href="/tables?version=A2026_r0"]'));
  assert.equal(texts('thead th').includes('Actions'), false);
  assert.equal(main.querySelector('.caracteristiques button'), null);
  // Le code G d'avance (D96) : A2026_r0 n'en porte aucun — « — » dans la colonne, pas de liste, pas d'avertissement.
  assert.ok(texts('.tables-edit--operations thead th').includes("Code G d'avance"));
  assert.equal(main.querySelectorAll('.tables-edit--operations select.input-court').length, 0); // la liste du code G porte la classe ; celle de la famille, non (aide-dom ne lit pas « $= »)
  const valeurs = main.querySelectorAll('.tables-edit--operations').find((table) => texts('thead th', table).includes("Code G d'avance")); // l'autre tableau d'opérations est celui de la présentation
  assert.deepEqual([...new Set(valeurs.querySelectorAll('tbody tr').map((tr) => tr.children[7].textContent))], ['—']);
  assert.equal(main.querySelector('.avis-code-g').hidden, true);
});

test('consultation — Images : la liste et ses filtres, sans Actions ni téléversement', async () => {
  await start('consultation', '#images');
  assertReadOnlyScreen('Images');
  assert.ok(main.querySelectorAll('.images-table tbody tr').length > 0);
  assert.equal(texts('.images-table thead th').includes('Actions'), false);
  assert.equal(main.querySelector('#televerser-fichier'), null);
  assert.ok(main.querySelector('#images-recherche'));
});

test('consultation — Corrections d’identité : le journal, en lecture', async () => {
  await start('consultation', '#identites');
  assert.equal(h1(), "Journal des corrections d'identité");
  assertReadOnlyScreen("Corrections d'identité");
});

// --- L'administration : rien ne change — les boutons d'action sont là ----------------------------------------------------------

test('administration — les boutons d’action de chaque onglet sont construits, aucun fieldset inactif', async () => {
  const attendus = {
    exercices: ['Modifier', 'Dupliquer', 'Renommer', 'Archiver', 'Supprimer', 'Copier le lien étudiant', 'Créer un exercice vide'],
    banque: ['Modifier', 'Dupliquer', 'Archiver', 'Créer un outil'],
    tables: ['Dix questions', 'Annuler les modifications', 'Enregistrer le brouillon', 'Ajouter une classe', 'Ajouter un matériau', 'Ajouter une opération', 'Reprendre cette version', 'Retirer'],
    images: ['Renommer', 'Archiver', 'Téléverser'],
    sauvegarde: ['Exporter tout en JSON', 'Importer'],
  };
  for (const [tab, labels] of Object.entries(attendus)) {
    await start('admin', `#${tab}`);
    const present = buttonTexts();
    for (const label of labels) assert.ok(present.includes(label), `${tab} : « ${label} »`);
    assert.equal(main.querySelectorAll('fieldset[disabled]').length, 0, tab);
    assert.doesNotMatch(eyebrow(), /lecture seule/);
  }
  assert.ok(buttonTexts().length > 0);
  await start('admin', '#tables');
  assert.ok(buttonTexts().some((t) => /^Publier/.test(t)));
  assert.ok(buttonTexts().some((t) => /^Appliquer|^Aucun changement à appliquer/.test(t))); // le bouton de la présentation, dont le libellé suit les changements
  assert.match(main.textContent, /Brouillon parti de la version/);
  // L'administration garde « Présentation — effet immédiat » et la pastille « En direct » (la retouche ne vaut qu'en consultation).
  assert.equal(main.querySelector('.panel--direct .eyebrow').textContent, 'Présentation — effet immédiat');
  assert.equal(main.querySelector('.panel--direct .badge-direct').textContent, 'En direct');
  assert.ok(main.querySelector('#televerser-fichier') === null); // l'onglet Tables n'a pas le téléversement de l'onglet Images
  // Le code G d'avance (D96) : une liste par opération, préremplie (G99 au tour, G94 ailleurs), les quatre codes ; aucun avertissement.
  const codes = main.querySelectorAll('.tables-edit--operations select.input-court');
  assert.equal(codes.length, 19);
  assert.equal(codes[0].id, 'op-0-code');
  assert.deepEqual(codes[0].querySelectorAll('option').map((o) => o.getAttribute('value')), ['G94', 'G95', 'G98', 'G99']);
  assert.deepEqual([codes[0].value, codes[18].value], ['G94', 'G99']);
  assert.equal(main.querySelector('.avis-code-g').hidden, true);
});

test('administration — la page d’un exercice : le brouillon, Enregistrer, Publier, Aperçu du brouillon, Reprendre, Appliquer…, les crochets et la sélection des outils', async () => {
  await start('admin', '#exercices');
  const ligne = main.querySelectorAll('tbody tr').find((tr) => tr.querySelector('td.mono').textContent === M10);
  clickButton('Modifier', ligne);
  await until(() => h1() === m10.titre, "la page de l'exercice");
  const present = buttonTexts();
  for (const label of ['Enregistrer le brouillon', 'Aperçu du brouillon', 'Annuler les modifications', 'Reprendre cette version', 'Ajouter depuis la banque', "Ajouter depuis l'exercice", 'Dupliquer', 'Retirer', 'Autre exemple', 'Tout cocher']) {
    assert.ok(present.includes(label), `« ${label} »`);
  }
  assert.ok(present.some((t) => /^Publier|^Aucune différence à publier/.test(t)));
  assert.ok(present.some((t) => /^Appliquer|^Aucun changement à appliquer/.test(t)));
  assert.match(main.querySelector('.editeur-bar .muted').textContent, /brouillon modifié le/);
  const evaluees = main.querySelectorAll('input[type="radio"][value="evaluee"]').filter((input) => input.hasAttribute('checked')).map((input) => input.getAttribute('name'));
  assert.deepEqual(evaluees, ['etat-vc', 'etat-n']); // le brouillon modifié, pas la version publiée
  assert.ok(main.querySelector('.token-buttons'));
  assert.ok(main.querySelectorAll('.outil-ligne input[type="checkbox"][aria-label]').length > 0);
  assert.equal(main.querySelectorAll('fieldset[disabled]').length, 0);
  assert.equal(main.querySelector('.panel--direct .eyebrow').textContent, 'Présentation — effet immédiat');
  assert.equal(main.querySelector('.panel--direct .badge-direct').textContent, 'En direct');
});
