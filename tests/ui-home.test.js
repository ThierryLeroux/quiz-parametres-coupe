// Tests de site/js/ui/home-data.js (D71, D91, D92) et de l'écran de l'accueil (home-screen.js, sur le DOM minuscule de
// aide-dom.js) : les cartes de cours, le bouton Démo de chaque rangée (le mode démo, D92), la page de description d'un
// exercice — composée, comme dans le navigateur, à partir de ce que le serveur publie (GET /api/exercice).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleExercise } from '../site/js/app.js';
import { NO_COURSE_NAME, OTHERS_TITLE, courseAnchor, exerciseHref, exerciseLink, gradedFields, homeCards, homeGroups, materialGroups, questionLines, splitCourse, streakText, toolRows } from '../site/js/ui/home-data.js';
import { DEMO_NOTE, HOME_STEPS, HOME_TITLE, NO_EXERCISE_NOTICE, TEACHER_LINK_LABEL, renderHomeList, unknownExerciseNotice } from '../site/js/ui/home-screen.js';
import { demoHref } from '../site/js/ui/demo-data.js';
import { countText } from '../site/js/ui/text.js';
import { installDom } from './aide-dom.js';
import { serveurDeTest } from './aide-serveur.js';

const serveur = serveurDeTest();
const publie = async (id) => assembleExercise((await serveur.appel('GET', `/api/exercice?exercice=${id}`)).corps);
const m10 = await publie('m10-tournage-vc');
const vcRpm = await publie('m10-tournage-vc-rpm');

// La liste de l'accueil telle que GET /api/exercices la rend en production (lot du 29 sept., D84 ; les sept
// exercices de démo archivés, D92), dans l'ordre des rangs.
const DEUX = ['vc', 'n'];
const CINQ = ['vc', 'fz', 'n', 'f', 'vf'];
const LOT = [
  { id: 'm10-tournage-vc-rpm-2', titre: 'Tournage — Exercice 2', cours: 'M10 — Tournage', nombre_outils: 13, champs_evalues: DEUX },
  { id: 'm10-tournage-avances', titre: 'Tournage — Exercice 3', cours: 'M10 — Tournage', nombre_outils: 9, champs_evalues: CINQ },
  { id: 'm10-fraisage-vc-rpm', titre: 'Fraisage — Exercice 2', cours: 'M10 — Fraisage', nombre_outils: 13, champs_evalues: DEUX },
  { id: 'm10-fraisage-avances', titre: 'Fraisage — Exercice 3', cours: 'M10 — Fraisage', nombre_outils: 6, champs_evalues: CINQ },
  { id: 'm30-fraisage-cn', titre: 'M30 — Fraisage CN : paramètres de coupe', cours: 'M30', nombre_outils: 18, champs_evalues: CINQ },
  { id: 'm40-tournage-cn', titre: 'M40 — Tournage CN : paramètres de coupe', cours: 'M40', nombre_outils: 15, champs_evalues: CINQ },
  { id: 'f50-synthese', titre: 'F50 — Synthèse du fraisage et du tournage', cours: 'F50', nombre_outils: 35, champs_evalues: CINQ },
];

// --- Accueil : les groupes (D71) ---------------------------------------------------------------------------------------

test('homeGroups (D71) : un groupe par cours, dans l’ordre des rangs, un même cours écrit autrement dans le même groupe ; sans cours, « Autres exercices » en dernier', () => {
  const liste = [
    { id: 'a', titre: 'A', cours: 'M10' },
    { id: 'b', titre: 'B', cours: null },
    { id: 'c', titre: 'C', cours: 'm-10' },
    { id: 'd', titre: 'D', cours: 'M20' },
    { id: 'e', titre: 'E' }, // réponse d'un serveur d'avant : pas de cours
  ];
  assert.deepEqual(homeGroups(liste).map((g) => [g.title, g.exercises.map((e) => e.id)]), [['M10', ['a', 'c']], ['M20', ['d']], ['Autres exercices', ['b', 'e']]]);
  assert.equal(OTHERS_TITLE, 'Autres exercices');
  // L'écriture du groupe est celle du premier exercice du groupe dans l'ordre des rangs.
  assert.equal(homeGroups([{ id: 'c', cours: ' m10 ' }, { id: 'a', cours: 'M10' }])[0].title, 'm10');
  // Aucun cours : un seul groupe, sans titre (l'accueil d'avant) ; aucune entrée : aucun groupe.
  assert.deepEqual(homeGroups([{ id: 'a', cours: null }, { id: 'b', cours: null }]), [{ title: null, exercises: [{ id: 'a', cours: null }, { id: 'b', cours: null }] }]);
  assert.deepEqual(homeGroups([]), []);
});

test('exerciseLink et exerciseHref (D71) : le lien de la page d’un exercice, absolu pour Léa, relatif dans les rangées', () => {
  assert.equal(exerciseLink('https://quiz-parametres-coupe.tgm-tmi.workers.dev', 'm10-tournage-vc'), 'https://quiz-parametres-coupe.tgm-tmi.workers.dev/?exercice=m10-tournage-vc');
  assert.equal(exerciseLink('http://localhost:8787', 'a b'), 'http://localhost:8787/?exercice=a%20b');
  assert.equal(exerciseHref('demo-m30-fraisage-cn'), '?exercice=demo-m30-fraisage-cn');
  assert.equal(exerciseHref('a b'), '?exercice=a%20b');
});

// --- Accueil : les cartes (D91), le bouton Démo de chaque rangée (D92) ----------------------------------------------

test('splitCourse (D91) : le sigle et le nom, coupés au premier « — » ; sans tiret, tout est le sigle', () => {
  assert.deepEqual(splitCourse('M10 — Tournage'), { code: 'M10', name: 'Tournage' });
  assert.deepEqual(splitCourse('M30'), { code: 'M30', name: null });
  assert.deepEqual(splitCourse('Usinage CNC'), { code: 'Usinage CNC', name: null });
  assert.deepEqual(splitCourse('M10 — Tournage — avancé'), { code: 'M10', name: 'Tournage — avancé' });
  assert.deepEqual(splitCourse('M10—Tournage'), { code: 'M10', name: 'Tournage' });
  assert.deepEqual(splitCourse(' M10 — '), { code: 'M10', name: null });
  assert.deepEqual(splitCourse('M10 - Tournage'), { code: 'M10 - Tournage', name: null }); // un trait d'union n'est pas le tiret
});

test('courseAnchor (D91) : une ancre stable tirée du cours ; deux cours de l’accueil ont deux ancres', () => {
  assert.equal(courseAnchor('M10 — Tournage'), 'cours-m10-tournage');
  assert.equal(courseAnchor('M30'), 'cours-m30');
  assert.equal(courseAnchor('Génie mécanique — Été'), 'cours-genie-mecanique-ete');
  assert.equal(courseAnchor('Autres exercices'), 'cours-autres-exercices');
  assert.equal(courseAnchor(null), 'cours-exercices');
  const ancres = homeGroups(LOT).map((g) => courseAnchor(g.title));
  assert.deepEqual(ancres, ['cours-m10-tournage', 'cours-m10-fraisage', 'cours-m30', 'cours-m40', 'cours-f50']);
  assert.equal(new Set(ancres).size, ancres.length);
});

test('gradedFields (D91) : les grandeurs évaluées dans l’ordre Vc, fz, N, f, Vf, avec leur nom complet ; rien sans liste', () => {
  assert.deepEqual(gradedFields(['n', 'vc']).map((f) => f.symbol), ['Vc', 'N']);
  assert.deepEqual(gradedFields(CINQ).map((f) => [f.key, f.symbol, f.name]), [['vc', 'Vc', 'vitesse de coupe'], ['fz', 'fz', 'avance par dent'], ['n', 'N', 'vitesse de rotation'], ['f', 'f', 'avance totale par révolution'], ['vf', 'Vf', "vitesse d'avance"]]);
  assert.deepEqual(gradedFields(undefined), []);
  assert.deepEqual(gradedFields([]), []);
});

test('homeCards (D91, D92) : une carte par cours, dans l’ordre des rangs ; chaque rangée nommée en toutes lettres, avec le bouton Démo de son mode démo', () => {
  const cards = homeCards(LOT);
  assert.deepEqual(cards.map((c) => [c.id, c.code, c.name, c.count, c.rows.length]), [
    ['cours-m10-tournage', 'M10', 'Tournage', '2 exercices', 2],
    ['cours-m10-fraisage', 'M10', 'Fraisage', '2 exercices', 2],
    ['cours-m30', 'M30', null, '1 exercice', 1],
    ['cours-m40', 'M40', null, '1 exercice', 1],
    ['cours-f50', 'F50', null, '1 exercice', 1],
  ]);
  assert.deepEqual(cards.map((c) => c.title), ['M10 — Tournage', 'M10 — Fraisage', 'M30', 'M40', 'F50']);
  const row = cards[0].rows[0];
  assert.equal(row.href, '?exercice=m10-tournage-vc-rpm-2');
  assert.equal(row.title, 'Tournage — Exercice 2');
  assert.deepEqual(row.fields.map((f) => f.symbol), ['Vc', 'N']);
  assert.equal(row.tools, '13 outils');
  assert.equal(row.name, 'Tournage — Exercice 2 — à trouver : vitesse de coupe, vitesse de rotation — 13 outils');
  // Le bouton Démo (D92) : le mode démo de l'exercice, nommé et expliqué en toutes lettres.
  assert.deepEqual(row.demo, { href: '?exercice=m10-tournage-vc-rpm-2&demo=1', name: 'Démo : Tournage — Exercice 2', hint: "Tournage — Exercice 2 — mode démo : des questions à volonté sur l'outil de ton choix, sans identification ; rien n'est gardé" });
  assert.equal(row.demo.href, demoHref('m10-tournage-vc-rpm-2'));
  assert.ok(cards.every((c) => c.rows.every((r) => r.demo.href === `?exercice=${r.id}&demo=1`)));
  assert.equal(cards[4].rows[0].name, "F50 — Synthèse du fraisage et du tournage — à trouver : vitesse de coupe, avance par dent, vitesse de rotation, avance totale par révolution, vitesse d'avance — 35 outils");
  // Un seul outil : « 1 outil » ; le pluriel vient de countText.
  assert.equal(homeCards([{ ...LOT[0], nombre_outils: 1 }])[0].rows[0].tools, '1 outil');
  assert.equal(countText(0, 'exercice'), '0 exercice');
});

test('homeCards (D91) : « Autres exercices » et le groupe sans titre font une carte sans sigle ; un serveur d’avant (sans nombre d’outils ni grandeurs) donne une rangée au titre seul', () => {
  const mixte = homeCards([{ id: 'a', titre: 'A', cours: 'M10' }, { id: 'b', titre: 'B', cours: null, nombre_outils: 4, champs_evalues: ['vc'] }]);
  assert.deepEqual(mixte.map((c) => [c.id, c.title, c.code, c.name, c.count]), [['cours-m10', 'M10', 'M10', null, '1 exercice'], ['cours-autres-exercices', 'Autres exercices', null, 'Autres exercices', '1 exercice']]);
  assert.deepEqual(mixte[0].rows[0], { id: 'a', href: '?exercice=a', title: 'A', fields: [], tools: null, name: 'A', demo: { href: '?exercice=a&demo=1', name: 'Démo : A', hint: "A — mode démo : des questions à volonté sur l'outil de ton choix, sans identification ; rien n'est gardé" } });
  assert.equal(mixte[1].rows[0].name, 'B — à trouver : vitesse de coupe — 4 outils');
  const sansCours = homeCards([{ id: 'a', titre: 'A', nombre_outils: 2, champs_evalues: ['fz'] }]);
  assert.deepEqual(sansCours.map((c) => [c.id, c.title, c.code, c.name, c.count]), [['cours-exercices', null, null, NO_COURSE_NAME, '1 exercice']]);
  assert.equal(sansCours[0].rows[0].name, 'A — à trouver : avance par dent — 2 outils');
  assert.deepEqual(homeCards([]), []);
});

// --- L'écran de l'accueil, sur le DOM minuscule (D91) ------------------------------------------------------------------

const { main, document } = installDom({ url: 'http://localhost/' });
const texts = (selector) => main.querySelectorAll(selector).map((node) => node.textContent);

test('renderHomeList (D91) : l’en-tête sur le fond (sur-titre, h1 au focus, trois étapes), cinq cartes ancrées, les raccourcis, la porte professeur compacte', () => {
  renderHomeList(main, LOT, null);
  const screen = main.querySelector('.screen.screen--home');
  assert.ok(screen);
  const hero = screen.querySelector('.home-hero');
  assert.ok(hero && !hero.classList.contains('panel')); // sans panneau
  assert.equal(hero.querySelector('.eyebrow').textContent, 'Exercices · paramètres de coupe');
  assert.equal(hero.querySelector('h1').textContent, HOME_TITLE);
  assert.equal(document.activeElement, hero.querySelector('h1'));
  assert.deepEqual(HOME_STEPS, ['Ton cours', "L'exercice indiqué sur Léa", 'Ton matricule et ton NIP']);
  assert.deepEqual(hero.querySelectorAll('.home-steps li').map((li) => li.textContent), ['1Ton cours', "2L'exercice indiqué sur Léa", '3Ton matricule et ton NIP']);
  assert.ok(hero.querySelectorAll('.home-steps .home-step-number').every((n) => n.getAttribute('aria-hidden') === 'true')); // la liste est numérotée pour les lecteurs d'écran
  assert.equal(hero.querySelector('.home-notice'), null);
  // Les raccourcis : un lien par carte, vers son ancre, dans l'ordre.
  const jump = hero.querySelector('nav.course-jump');
  assert.equal(jump.getAttribute('aria-label'), 'Aller à un cours');
  assert.deepEqual(jump.querySelectorAll('a').map((a) => [a.getAttribute('href'), a.textContent]), [['#cours-m10-tournage', 'M10 — Tournage'], ['#cours-m10-fraisage', 'M10 — Fraisage'], ['#cours-m30', 'M30'], ['#cours-m40', 'M40'], ['#cours-f50', 'F50']]);
  // Les cartes : des panneaux, dans une grille, chacune avec son ancre, son h2 (sigle, nom) et son compte.
  const cards = screen.querySelectorAll('.course-grid section.panel.course-card');
  assert.ok(cards.every((c) => c.parentNode === screen.querySelector('.course-grid')));
  assert.deepEqual(cards.map((c) => c.id), ['cours-m10-tournage', 'cours-m10-fraisage', 'cours-m30', 'cours-m40', 'cours-f50']);
  assert.deepEqual(cards.map((c) => [c.querySelector('h2 .course-code')?.textContent ?? null, c.querySelector('h2 .course-name')?.textContent ?? null, c.querySelector('.course-count').textContent]), [['M10', 'Tournage', '2 exercices'], ['M10', 'Fraisage', '2 exercices'], ['M30', null, '1 exercice'], ['M40', null, '1 exercice'], ['F50', null, '1 exercice']]);
  assert.ok(cards.every((c) => c.getAttribute('aria-labelledby') === c.querySelector('h2').id));
  assert.equal(main.querySelectorAll('h2').length, 5);
  // La porte professeur : une seule, le bouton au contour vers /prof, la note sur les démos, plus de phrase sur les clés.
  const teacher = screen.querySelector('section.panel.home-teacher');
  assert.equal(teacher.querySelector('.eyebrow').textContent, 'Enseignants');
  assert.equal(teacher.querySelector('p').textContent, DEMO_NOTE);
  assert.equal(DEMO_NOTE, "« Démo » : l'exercice sans identification — des questions à volonté sur l'outil de ton choix et un exemple d'attestation ; rien n'est gardé.");
  assert.doesNotMatch(DEMO_NOTE, /une seule question/); // D92 : plus une démo-exercice d'une question
  const link = teacher.querySelector('a.button-outline[href="/prof"]');
  assert.equal(link.textContent, TEACHER_LINK_LABEL);
  assert.equal(TEACHER_LINK_LABEL, 'Espace professeur →');
  assert.doesNotMatch(main.textContent, /clé/);
  assert.deepEqual(main.querySelectorAll('a[href="/prof"]').length, 1);
  // La barre du haut et le titre de l'onglet.
  assert.equal(document.querySelector('#header-title').textContent, 'Quiz — paramètres de coupe');
  assert.equal(document.querySelector('#header-aside').textContent, 'TGM-TMI');
});

test('renderHomeList (D91, D92) : une rangée par exercice — le lien couvre la rangée, nommé en toutes lettres ; les pastilles avec leur nom ; le bouton Démo en lien à part, vers le mode démo ; jamais de lien dans un lien', () => {
  renderHomeList(main, LOT, null);
  const rows = main.querySelectorAll('.course-card .ex-rows li.ex-row');
  assert.ok(rows.every((r) => r.parentNode.classList.contains('ex-rows')));
  assert.equal(rows.length, 7);
  assert.equal(main.querySelectorAll('a a').length, 0);
  assert.equal(main.querySelectorAll('.course-card a').length, 14); // 7 rangées + 7 boutons Démo
  assert.deepEqual(texts('.course-card .ex-title'), ['Tournage — Exercice 2', 'Tournage — Exercice 3', 'Fraisage — Exercice 2', 'Fraisage — Exercice 3', 'M30 — Fraisage CN : paramètres de coupe', 'M40 — Tournage CN : paramètres de coupe', 'F50 — Synthèse du fraisage et du tournage']);
  const first = rows[0];
  const mainLink = first.querySelector('a.ex-main');
  assert.equal(mainLink.getAttribute('href'), '?exercice=m10-tournage-vc-rpm-2');
  assert.equal(mainLink.getAttribute('aria-label'), 'Tournage — Exercice 2 — à trouver : vitesse de coupe, vitesse de rotation — 13 outils');
  assert.ok(mainLink.querySelector('.ex-title') && mainLink.querySelector('.ex-go[aria-hidden="true"]'));
  assert.equal(mainLink.querySelector('.ex-go').textContent, '›');
  assert.equal(mainLink.querySelector('.ex-facts .ex-label').textContent, 'À trouver');
  assert.deepEqual(mainLink.querySelectorAll('.qty').map((q) => [q.textContent, q.getAttribute('title')]), [['Vc', 'vitesse de coupe'], ['N', 'vitesse de rotation']]);
  assert.match(mainLink.querySelector('.ex-facts').textContent, /·13 outils$/);
  const demo = first.querySelector('a.ex-demo');
  assert.equal(demo.getAttribute('href'), '?exercice=m10-tournage-vc-rpm-2&demo=1'); // le mode démo de l'exercice (D92)
  assert.equal(demo.getAttribute('aria-label'), 'Démo : Tournage — Exercice 2');
  assert.equal(demo.getAttribute('title'), "Tournage — Exercice 2 — mode démo : des questions à volonté sur l'outil de ton choix, sans identification ; rien n'est gardé");
  assert.equal(demo.textContent, 'Démo'); // la majuscule vient de la feuille de style
  assert.deepEqual(rows.map((r) => r.querySelector('a.ex-demo').getAttribute('href')), LOT.map((e) => `?exercice=${e.id}&demo=1`));
  const svg = demo.querySelector('svg');
  assert.ok(svg && svg.getAttribute('aria-hidden') === 'true' && svg.querySelector('rect') && svg.querySelector('path'));
  assert.equal(demo.parentNode, first); // la démo est un frère du lien de la rangée, pas un enfant
  // Les cinq grandeurs, dans l'ordre Vc, fz, N, f, Vf.
  assert.deepEqual(rows[6].querySelectorAll('.qty').map((q) => q.textContent), ['Vc', 'fz', 'N', 'f', 'Vf']);
  assert.match(rows[6].querySelector('.ex-facts').textContent, /35 outils$/);
});

test('renderHomeList (D92) : toute rangée a son bouton Démo, convention « demo-<id> » ou non — un ancien exercice de démo encore publié est une rangée comme une autre', () => {
  renderHomeList(main, [{ id: 'demo-m10-tournage-vc-rpm-2', titre: "Tournage — Démo de l'exercice 2", cours: 'M10 — Tournage', nombre_outils: 1, champs_evalues: DEUX }, LOT[1], { id: 'm30-demo', titre: 'Démo du M30', cours: 'M30' }], null);
  const rows = main.querySelectorAll('li.ex-row');
  assert.deepEqual(rows.map((r) => [r.querySelector('.ex-title').textContent, r.querySelector('.ex-demo').getAttribute('href')]), [
    ["Tournage — Démo de l'exercice 2", '?exercice=demo-m10-tournage-vc-rpm-2&demo=1'], ['Tournage — Exercice 3', '?exercice=m10-tournage-avances&demo=1'], ['Démo du M30', '?exercice=m30-demo&demo=1'],
  ]);
  assert.equal(main.querySelector('.course-count').textContent, '2 exercices'); // les rangées comptent toutes
  // Sans nombre d'outils ni grandeurs (serveur d'avant) : le titre seul, ni « À trouver » ni pastille.
  assert.equal(rows[2].querySelector('.ex-facts'), null);
  assert.equal(rows[2].querySelector('a.ex-main').getAttribute('aria-label'), 'Démo du M30');
});

test('renderHomeList (D91) : les avis sous le h1, dans un panneau — l’exercice inconnu (D18), aucun exercice offert ; sans cartes, ni grille ni raccourcis', () => {
  renderHomeList(main, LOT, 'm10-inconnu');
  const afterH1 = () => { const hero = main.querySelector('.home-hero'); const notice = hero.querySelector('section.panel.home-notice'); assert.ok(hero.children.indexOf(notice) > hero.children.indexOf(hero.querySelector('h1'))); return notice; };
  let notice = afterH1();
  assert.deepEqual(notice.querySelectorAll('p').map((p) => p.textContent), ["L'exercice « m10-inconnu » n'existe pas — vérifie le lien sur Léa."]);
  assert.equal(unknownExerciseNotice('x'), "L'exercice « x » n'existe pas — vérifie le lien sur Léa.");
  assert.equal(main.querySelectorAll('.course-card').length, 5);
  renderHomeList(main, [], null);
  notice = afterH1();
  assert.deepEqual(notice.querySelectorAll('p').map((p) => p.textContent), [NO_EXERCISE_NOTICE]);
  assert.equal(NO_EXERCISE_NOTICE, "Aucun exercice n'est offert pour l'instant.");
  assert.equal(main.querySelectorAll('.course-card').length, 0);
  assert.equal(main.querySelector('.course-jump'), null);
  assert.ok(main.querySelector('.home-teacher a[href="/prof"]')); // la porte professeur reste
  renderHomeList(main, [], 'x');
  assert.deepEqual(texts('.home-notice p'), ["L'exercice « x » n'existe pas — vérifie le lien sur Léa.", NO_EXERCISE_NOTICE]);
  // Une seule carte : pas de raccourci (rien à sauter).
  renderHomeList(main, [LOT[0], LOT[1]], null);
  assert.equal(main.querySelector('.course-jump'), null);
  assert.equal(main.querySelectorAll('.course-card').length, 1);
});

test('renderHomeList (D91) : « Autres exercices » et le groupe sans titre, une carte sans sigle encadré', () => {
  renderHomeList(main, [{ id: 'a', titre: 'A', cours: 'M10', nombre_outils: 1, champs_evalues: ['vc'] }, { id: 'b', titre: 'B', cours: null, nombre_outils: 2, champs_evalues: ['vc'] }], null);
  const cards = main.querySelectorAll('.course-card');
  assert.deepEqual(cards.map((c) => [c.id, c.querySelector('.course-code')?.textContent ?? null, c.querySelector('.course-name')?.textContent ?? null]), [['cours-m10', 'M10', null], ['cours-autres-exercices', null, 'Autres exercices']]);
  assert.deepEqual(main.querySelectorAll('.course-jump a').map((a) => a.textContent), ['M10', 'Autres exercices']);
  renderHomeList(main, [{ id: 'b', titre: 'B', nombre_outils: 2, champs_evalues: ['vc'] }], null);
  assert.deepEqual(main.querySelectorAll('.course-card').map((c) => [c.id, c.querySelector('.course-code'), c.querySelector('.course-name').textContent]), [['cours-exercices', null, NO_COURSE_NAME]]);
});

test('app.css (D91) : l’accueil fait 1040 px, deux colonnes de cartes et les raccourcis cachés à partir de 900 px ; les couleurs viennent de tokens.css ; rien ne bouge en mouvement réduit', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../site/css/app.css', import.meta.url), 'utf8');
  assert.match(css, /\.screen--home \{ max-width: 1040px; \}/);
  assert.match(css, /\.screen \{[^}]*max-width: 680px;/); // les autres écrans gardent 680
  const desktop = css.slice(css.indexOf('@media (min-width: 900px)'), css.indexOf('/* Téléphone : moins de marges'));
  assert.match(desktop, /\.course-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(desktop, /\.course-jump \{ display: none; \}/);
  assert.match(css, /\.course-card \{ scroll-margin-top: var\(--space-4\); \}/);
  assert.match(css, /\.ex-title \{\s*font-size: 1\.0625rem;/); // 17 px
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.ex-row,\s*\.ex-demo \{ transition: none; \}/);
  // Aucune couleur en dur dans la section de l'accueil : tout vient des variables de tokens.css.
  const section = css.slice(css.indexOf('/* --- Accueil unique'), css.indexOf('/* --- Page de description'));
  assert.doesNotMatch(section, /#[0-9a-f]{3,8}\b/i);
  const tokens = await readFile(new URL('../site/css/tokens.css', import.meta.url), 'utf8');
  assert.match(tokens, /--color-panel-row: #0f1b3d;/);
  // Le téléphone : la colonne Démo d'environ 54 px, les marges des cartes resserrées.
  const phone = section.slice(section.indexOf('@media (max-width: 639px)'));
  assert.match(phone, /\.ex-demo \{ min-width: 54px;/);
  assert.match(phone, /\.app-main \.course-card \{ padding: var\(--space-4\) 14px; \}/);
});

// --- Page de description ---------------------------------------------------------------------------------------------

test('questionLines (D71) : les grandeurs à trouver, fournies et non demandées, en toutes lettres avec leur symbole', () => {
  assert.deepEqual(questionLines(m10.exercise), [
    'À trouver : vitesse de coupe (Vc).',
    "Fournies par l'exercice : avance par dent (fz), vitesse de rotation (N), avance totale par révolution (f) et vitesse d'avance (Vf).",
  ]);
  assert.deepEqual(questionLines(vcRpm.exercise), [
    'À trouver : vitesse de coupe (Vc) et vitesse de rotation (N).',
    "Fournies par l'exercice : avance par dent (fz), avance totale par révolution (f) et vitesse d'avance (Vf).",
  ]);
  assert.deepEqual(questionLines({ champs_evalues: ['fz', 'f'], champs_masques: ['vf'] }), [
    'À trouver : avance par dent (fz) et avance totale par révolution (f).',
    "Fournies par l'exercice : vitesse de coupe (Vc) et vitesse de rotation (N).",
    "Non demandée : vitesse d'avance (Vf).",
  ]);
  assert.deepEqual(questionLines({ champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'] }), ["À trouver : vitesse de coupe (Vc), avance par dent (fz), vitesse de rotation (N), avance totale par révolution (f) et vitesse d'avance (Vf)."]);
});

test('toolRows (D71) : les outils questionnés dans l’ordre, avec leur photo, leur plage, leur opération et son pictogramme, leurs matières et les réussites de suite', () => {
  const rows = toolRows(m10.exercise, m10.data);
  assert.deepEqual(rows.map((r) => r.id), m10.exercise.outils.map((e) => e.id));
  assert.deepEqual(rows.map((r) => r.label), ['MCLNR', 'MVLNR', 'Lame à tronçonner', 'Barre à fileter (impérial)', 'Barre à fileter (métrique)', 'Barre à rainurer', 'Barre à aléser', 'SDTMR (impérial)', 'SDTMR (métrique)']);
  assert.deepEqual(rows.map((r) => r.streak), [1, 3, 3, 1, 1, 3, 1, 1, 1]);
  const mclnr = rows[0];
  assert.deepEqual([mclnr.photo, mclnr.operation, mclnr.picto, mclnr.range], ['/images/mclnr', 'Chariotage ébauche', '/images/chariotage_ebauche', '10 mm à 20 mm']);
  assert.deepEqual(mclnr.materials, m10.data.outils.find((t) => t.id === 'mclnr').materiaux_outil);
  // « Vc et RPM » écarte le carbure solide pour tout l'exercice (D40) : aucun outil ne l'affiche.
  const rpm = toolRows(vcRpm.exercise, vcRpm.data);
  assert.equal(rpm.length, 11);
  assert.ok(rpm.every((r) => r.materials.length > 0 && !r.materials.includes('Carbure de tungstène solide')), JSON.stringify(rpm.map((r) => r.materials)));
  assert.ok(rpm.every((r) => r.streak === 2));
  assert.deepEqual([streakText(1), streakText(3)], ['1 réussite de suite', '3 réussites de suite']);
  // Une entrée de fichier d'exercice qui restreint ses dimensions : la plage le suit.
  const restreint = { outils: [{ id: 'mvlnr', reussites_requises: 1, dimensions: ['2.000"'] }], champs_evalues: ['vc'] };
  assert.equal(toolRows(restreint, m10.data)[0].range, '2.000"');
});

test('materialGroups (D71) : les groupes que les outils peuvent tirer, par classe ISO, dans l’ordre des tables ; la restriction de l’exercice s’y applique', () => {
  const classes = materialGroups(m10.exercise, m10.data);
  assert.equal(classes[0].code, 'P');
  assert.equal(classes[0].name, 'Acier');
  assert.equal(new Set(classes.map((c) => c.code)).size, classes.length); // une ligne par classe
  // Chaque groupe tiré par au moins un outil y est, une fois ; aucun autre.
  const attendus = new Set(m10.data.outils.flatMap((t) => t.groupes_materiaux_usinables).map((g) => g.split(' - ')[1]));
  assert.deepEqual(new Set(classes.flatMap((c) => c.groups)), attendus);
  assert.ok(!classes.flatMap((c) => c.groups).includes('Graphite')); // attaché à aucun outil (SPEC §3)
  // Restreint à un groupe pour tout l'exercice : il ne reste que lui.
  assert.deepEqual(materialGroups({ ...m10.exercise, groupes: ['P - Acier non allié'] }, m10.data), [{ code: 'P', name: 'Acier', groups: ['Acier non allié'] }]);
});

test('page de description (D71) : rien de ce qui est à trouver — aucune vitesse de coupe, aucune avance de la table', () => {
  const texte = JSON.stringify({ questions: questionLines(vcRpm.exercise), outils: toolRows(vcRpm.exercise, vcRpm.data), materiaux: materialGroups(vcRpm.exercise, vcRpm.data) });
  assert.doesNotMatch(texte, /vc_pi_min|avance_po_rev|pi\/min/);
  // Les seuls nombres des rangs d'outils sont les réussites de suite (les plages sont des libellés de dimension).
  for (const row of toolRows(vcRpm.exercise, vcRpm.data)) assert.deepEqual(Object.entries(row).filter(([, v]) => typeof v === 'number').map(([k]) => k), ['streak']);
});
