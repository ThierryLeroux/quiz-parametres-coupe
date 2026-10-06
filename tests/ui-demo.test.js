// Tests du mode démo côté navigateur (décision D92 ; UI §3.10) : les règles pures de demo-data.js et d'app.js, puis
// les écrans sur le DOM minuscule de aide-dom.js — le choix de l'outil, le bandeau, l'écran Question en mode démo
// (la barre sans identité, « Démo réussie », « Question suivante » toujours), le spécimen avec son filigrane, les deux
// issues de plus de /verifier, et les feuilles de style. C'est le DOM construit qu'on regarde ; la mise en page se
// vérifie dans Chrome (rapport mode-demo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDom } from './aide-dom.js';
import { SECONDE, serveurDeTest } from './aide-serveur.js';
import { assembleExercise, demoRequested } from '../site/js/app.js';
import { attestationFileName, verificationOutcome } from '../site/js/ui/attestation-data.js';
import { attestationPages } from '../site/js/ui/attestation-screen.js';
import {
  CHOOSER, DEMO_ASIDE, DEMO_BANNER, DEMO_DONE, DEMO_EXPIRED_NOTICE, DEMO_NOTE, SPECIMEN, chosenToolLabel, demoHint, demoHref, demoName, demoTitle, demoToolGroups,
} from '../site/js/ui/demo-data.js';
import { demoBanner, renderDemoChooser, renderSpecimen } from '../site/js/ui/demo-screen.js';
import { toolRows } from '../site/js/ui/home-data.js';
import { renderQuestion } from '../site/js/ui/question-screen.js';
import { toolLabels } from '../site/js/ui/rules.js';

const M10 = 'm10-tournage-vc';
const ESSAI = { id: 'essai-percage', titre: 'Essai — perçage', cours: 'M10 — Perçage', version: 'r1', champs_evalues: ['vc', 'n'], outils: [{ id: 'foret_fractionnaire', reussites_requises: 1, dimensions: ['Ø 1/4 po'], materiaux_outil: ['Acier rapide'] }] };

const serveur = serveurDeTest();
serveur.publierExercice(ESSAI);
const publie = async (id) => assembleExercise((await serveur.appel('GET', `/api/exercice?exercice=${id}`)).corps);
const m10 = await publie(M10);
const essai = await publie(ESSAI.id);
const commencerDemo = async (exercice, outil = null) => (await serveur.appel('POST', '/api/demo/creation', { corps: { exercice, outil } })).corps;

const { main, document } = installDom({ url: `http://localhost/?exercice=${M10}&demo=1` });
const texts = (selector) => main.querySelectorAll(selector).map((node) => node.textContent);
const tick = () => new Promise((resolve) => { setTimeout(resolve, 0); });

// --- Les règles pures ---------------------------------------------------------------------------------------------

test('demoHref et demoRequested : « ?exercice=<id>&demo=1 » ouvre le mode démo ; sans « demo », la page de l’exercice', () => {
  assert.equal(demoHref(M10), '?exercice=m10-tournage-vc&demo=1');
  assert.equal(demoHref('a b'), '?exercice=a%20b&demo=1');
  assert.equal(demoRequested('?exercice=m10-tournage-vc&demo=1'), true);
  assert.equal(demoRequested('?demo=1&exercice=x'), true);
  assert.equal(demoRequested('?exercice=m10-tournage-vc'), false);
  assert.equal(demoRequested(''), false);
});

test('les textes du mode démo : le titre de la barre, le nom et l’indice du bouton, la note de l’accueil, le bandeau, « Démo réussie », le spécimen', () => {
  assert.equal(demoTitle('Tournage — Exercice 2'), 'Démo — Tournage — Exercice 2');
  assert.equal(demoName('Tournage — Exercice 2'), 'Démo : Tournage — Exercice 2');
  assert.equal(demoHint('Tournage — Exercice 2'), "Tournage — Exercice 2 — mode démo : des questions à volonté sur l'outil de ton choix, sans identification ; rien n'est gardé");
  assert.equal(DEMO_ASIDE, "Démo · rien n'est gardé");
  assert.match(DEMO_NOTE, /^« Démo » : l'exercice sans identification/);
  assert.deepEqual(Object.keys(DEMO_BANNER), ['label', 'text', 'exercise', 'specimen']);
  assert.equal(DEMO_BANNER.exercise, 'Faire le vrai exercice');
  assert.equal(DEMO_BANNER.specimen, "Voir un exemple d'attestation");
  assert.equal(DEMO_DONE.title, 'Démo réussie');
  assert.match(DEMO_DONE.text, /l'attestation s'afficherait ici/);
  assert.equal(CHOOSER.random, 'Au hasard');
  assert.match(DEMO_EXPIRED_NOTICE, /^La démo a expiré/);
  assert.equal(SPECIMEN.watermark, 'SPÉCIMEN');
  // Le nom du fichier PDF d'un spécimen, au pied de page et à l'impression : jamais « Attestation-… ».
  assert.equal(attestationFileName({ specimen: true, exercice: { id: M10 }, etudiant: { prenom: 'Exemple', nom: 'SPÉCIMEN' } }), 'Specimen-attestation-m10-tournage-vc');
  assert.equal(attestationFileName({ exercice: { id: M10 }, etudiant: { prenom: 'Camille', nom: 'Tremblay' } }), 'Attestation-m10-tournage-vc-Tremblay-Camille');
});

test('demoToolGroups : les outils regroupés par opération, dans l’ordre de l’exercice, avec le pictogramme, le nom de la progression et la plage ; chosenToolLabel', () => {
  const groups = demoToolGroups(toolRows(m10.exercise, m10.data));
  assert.deepEqual(groups.map((g) => [g.operation, g.tools.map((t) => t.id)]), [
    ['Chariotage ébauche', ['mclnr']], ['Chariotage finition', ['mvlnr']], ['Tronçonnage', ['lame_a_tronconner']], ['Filetage interne', ['barre_a_fileter', 'barre_a_fileter_2']],
    ['Rainurage interne', ['barre_a_rainurer']], ['Alésage à la barre', ['barre_a_aleser']], ['Filetage externe', ['sdtmr', 'sdtmr_2']],
  ]);
  assert.deepEqual(groups.map((g) => g.picto), ['/images/chariotage_ebauche', '/images/chariotage_finition', '/images/tronconnage', '/images/filetage_interne', '/images/rainurage_interne', '/images/alesage_a_la_barre', '/images/filetage_externe']);
  const sdtmr = groups.at(-1).tools;
  assert.deepEqual(sdtmr.map((t) => t.label), ['SDTMR (impérial)', 'SDTMR (métrique)']); // le nom de la progression, qui distingue les homonymes
  assert.deepEqual(groups[3].tools.map((t) => [t.label, t.range]), [['Barre à fileter (impérial)', '1/4- 20 UNC à 1 - 8 UNC'], ['Barre à fileter (métrique)', 'M4 x 0.7 à M68 x 6']]);
  assert.equal(groups[0].tools[0].range, '10 mm à 20 mm');
  assert.equal(groups[0].tools[0].streak, 1);
  assert.equal(chosenToolLabel(null, groups), 'Au hasard');
  assert.equal(chosenToolLabel('sdtmr_2', groups), 'SDTMR (métrique)');
  assert.equal(chosenToolLabel('inconnu', groups), 'Au hasard');
  assert.deepEqual(demoToolGroups([]), []);
});

// --- Le choix de l'outil et le bandeau ---------------------------------------------------------------------------------

test('renderDemoChooser : le bandeau, « Au hasard » puis les outils par opération ; un clic appelle onChoose avec l’outil (ou null) ; le message du serveur ; la barre du haut', async () => {
  const calls = [];
  let answer = null;
  const groups = demoToolGroups(toolRows(m10.exercise, m10.data));
  renderDemoChooser(main, { exercise: m10.exercise, groups }, { onChoose: async (id) => { calls.push(id); return answer; }, onSpecimen: () => calls.push('specimen') });
  assert.equal(document.querySelector('#header-title').textContent, `Démo — ${m10.exercise.titre}`);
  assert.equal(document.querySelector('#header-aside').textContent, DEMO_ASIDE);
  assert.equal(document.title, `Démo — ${m10.exercise.titre}`);
  const screen = main.querySelector('.screen.demo-chooser');
  const banner = screen.querySelector('.banner--demo');
  assert.equal(screen.children[0], banner); // le bandeau d'abord
  assert.equal(main.querySelector('h1').textContent, CHOOSER.title);
  assert.equal(document.activeElement, main.querySelector('h1'));
  assert.equal(main.querySelector('.eyebrow').textContent, 'Démo'); // le M10 semé n'a pas de cours
  assert.deepEqual(texts('.demo-group-title'), groups.map((g) => g.operation));
  assert.deepEqual(main.querySelectorAll('.demo-group').map((g) => g.querySelectorAll('button.demo-tool').length), [1, 1, 1, 2, 1, 1, 2]);
  assert.ok(main.querySelectorAll('.demo-group-title img.operation-picto').every((img) => img.getAttribute('src').startsWith('/images/')));
  const buttons = main.querySelectorAll('button.demo-tool');
  assert.equal(buttons.length, 9);
  assert.deepEqual(buttons.map((b) => b.querySelector('.demo-tool-name').textContent).slice(-2), ['SDTMR (impérial)', 'SDTMR (métrique)']);
  assert.ok(buttons.every((b) => b.getAttribute('type') === 'button' && b.getAttribute('aria-pressed') === 'false'));
  const random = main.querySelector('button.demo-random');
  assert.equal(random.textContent, 'Au hasard');
  assert.equal(random.getAttribute('aria-pressed'), 'true'); // au hasard par défaut
  assert.equal(main.querySelector('.form-links'), null); // pas de retour : la démo n'est pas commencée
  // Un clic : onChoose(id) ; pendant l'appel, les boutons sont inactifs ; null = un autre écran a pris la place.
  buttons[0].click();
  assert.deepEqual(calls, ['mclnr']);
  assert.ok(buttons.every((b) => b.disabled === true));
  await tick();
  // Le serveur refuse : le message s'affiche, les boutons reviennent.
  answer = 'Trop de demandes.';
  random.click();
  await tick();
  assert.deepEqual(calls, ['mclnr', null]);
  assert.equal(main.querySelector('.server-message').textContent, 'Trop de demandes.');
  assert.ok(buttons.every((b) => b.disabled === false));
  // Le bandeau : le lien vers le vrai exercice, le bouton du spécimen.
  assert.equal(banner.querySelector('a').getAttribute('href'), '?exercice=m10-tournage-vc');
  assert.equal(banner.querySelector('a').textContent, DEMO_BANNER.exercise);
  banner.querySelector('button').click();
  assert.equal(calls.at(-1), 'specimen');
  assert.match(banner.textContent, /^Démo — rien n'est gardé : ni séance, ni attestation\./);
});

test('renderDemoChooser en cours de démo : l’outil en vigueur marqué, « ← Revenir à la question » (onBack), l’avis d’une démo expirée, le cours dans le sur-titre', () => {
  const calls = [];
  const groups = demoToolGroups(toolRows(essai.exercise, essai.data));
  renderDemoChooser(main, { exercise: essai.exercise, groups, chosen: 'foret_fractionnaire', inSession: true, notice: DEMO_EXPIRED_NOTICE }, { onChoose: async () => null, onSpecimen: () => {}, onBack: () => calls.push('back') });
  assert.equal(main.querySelector('.eyebrow').textContent, 'Démo · M10 — Perçage');
  const current = main.querySelector('button.demo-tool--current');
  assert.equal(current.getAttribute('aria-pressed'), 'true');
  assert.equal(current.querySelector('.demo-tool-name').textContent, 'Foret fractionnaire');
  assert.equal(main.querySelector('button.demo-random').getAttribute('aria-pressed'), 'false');
  assert.equal(main.querySelector('button.demo-random').className, 'button-outline demo-random');
  assert.match(main.textContent, /Outil en cours : Foret fractionnaire\./);
  assert.equal(main.querySelector('.server-message').textContent, DEMO_EXPIRED_NOTICE);
  const back = main.querySelector('.form-links button');
  assert.equal(back.textContent, CHOOSER.back);
  back.click();
  assert.deepEqual(calls, ['back']);
});

test('demoBanner : un rôle note, le lien vers la page de l’exercice et le bouton du spécimen ; jamais de lien dans un lien', () => {
  const calls = [];
  const banner = demoBanner('a b', { onSpecimen: () => calls.push('specimen') });
  assert.equal(banner.getAttribute('role'), 'note');
  assert.ok(banner.classList.contains('banner') && banner.classList.contains('banner--demo'));
  assert.equal(banner.querySelector('strong').textContent, 'Démo');
  assert.equal(banner.querySelector('a.button-link').getAttribute('href'), '?exercice=a%20b');
  assert.equal(banner.querySelectorAll('a a').length, 0);
  banner.querySelector('button.button-outline').click();
  assert.deepEqual(calls, ['specimen']);
});

// --- L'écran Question en mode démo -----------------------------------------------------------------------------------

test('renderQuestion en mode démo : la barre (« Démo — <titre> », le rappel, les tables, « Changer d’outil », Quitter — ni identité ni « Corriger mon identité »), le bandeau avant les panneaux, la progression, les cases', async () => {
  const { demo } = await commencerDemo(M10);
  const labels = toolLabels(m10.exercise, m10.data);
  const calls = [];
  renderQuestion(main, { seance: demo, data: m10.data, labels, demo: true }, {
    onQuit: () => calls.push('quit'), onTables: (sheet) => calls.push(`tables:${sheet}`), onChooseTool: () => calls.push('choose'), onSpecimen: () => calls.push('specimen'), onNext: () => {}, onCheck: async () => null,
  });
  assert.equal(document.querySelector('#header-title').textContent, `Démo — ${m10.exercise.titre}`);
  const aside = document.querySelector('#header-aside');
  assert.equal(aside.querySelector('span').textContent, DEMO_ASIDE);
  assert.deepEqual(aside.querySelectorAll('button').map((b) => b.textContent), ['Tables de référence', "Changer d'outil", 'Quitter']);
  assert.doesNotMatch(document.querySelector('header').textContent, /Corriger mon identité|matricule/);
  aside.querySelectorAll('button')[1].click();
  aside.querySelectorAll('button')[2].click();
  aside.querySelectorAll('button')[0].click();
  assert.deepEqual(calls, ['choose', 'quit', 'tables:vc']);
  // Le bandeau, premier enfant de la colonne de la question ; pas de « Démo réussie » à 0 %.
  const column = main.querySelector('.question-main');
  assert.ok(column.children[0].classList.contains('banner--demo'));
  assert.equal(main.querySelector('.banner--demo-done'), null);
  column.querySelector('.banner--demo button').click();
  assert.equal(calls.at(-1), 'specimen');
  // Le reste est l'écran du vrai exercice : les panneaux, les cinq cases (Vc à saisir), la progression par opération.
  assert.equal(main.querySelector('h1.question-title').textContent, 'Question');
  assert.ok(main.querySelector('.tool-card') && main.querySelector('.material-card'));
  assert.equal(main.querySelectorAll('.answer-grid input').length, 5);
  assert.equal(document.activeElement, main.querySelector('#vc'));
  assert.equal(main.querySelectorAll('.progress .progress-op').length, 7);
  assert.equal(main.querySelector('.progress-bar').getAttribute('aria-label'), '0 outils réussis sur 9');
  assert.equal(main.querySelector('button[type="submit"]').textContent, 'Vérifier');
});

test('renderQuestion en mode démo : après « Vérifier », « Question suivante » toujours, et « Démo réussie » dès la question qui complète la démo ; puis le bandeau reste tant que la démo est à 100 %', async () => {
  const { jeton, demo } = await commencerDemo(ESSAI.id);
  const labels = toolLabels(essai.exercise, essai.data);
  serveur.avancer(11 * SECONDE);
  const bonnes = await serveur.bonnesReponsesDemo(jeton);
  const corrected = (await serveur.appel('POST', '/api/demo/correction', { jeton, corps: { exercice: ESSAI.id, saisies: bonnes } })).corps;
  assert.equal(corrected.demo.reussie, true);
  const nexts = [];
  renderQuestion(main, { seance: demo, data: essai.data, labels, demo: true }, {
    onQuit: () => {}, onTables: () => {}, onChooseTool: () => {}, onSpecimen: () => {}, onNext: (next) => nexts.push(next),
    onCheck: async (answers) => { assert.deepEqual(answers, { vc: bonnes.vc, rpm: bonnes.rpm }); return { correction: corrected.correction, seance: corrected.demo }; },
  });
  main.querySelector('#vc').value = bonnes.vc;
  main.querySelector('#rpm').value = bonnes.rpm;
  main.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(main.querySelector('h1.question-title').textContent, 'Question — corrigée');
  assert.ok(main.querySelector('.banner--correct'));
  const done = main.querySelector('.banner--demo-done');
  assert.ok(done, '« Démo réussie » apparaît');
  assert.equal(done.querySelector('strong').textContent, DEMO_DONE.title);
  assert.equal(done.querySelector('p').textContent, DEMO_DONE.text);
  const next = main.querySelector('.form-actions button');
  assert.equal(next.textContent, 'Question suivante'); // jamais « Voir le résultat » en démo
  assert.equal(document.activeElement, next);
  next.click();
  assert.equal(nexts.length, 1);
  assert.equal(nexts[0].reussie, true);
  // La question suivante, à 100 % : le bandeau « Démo réussie » est là d'entrée, sous le bandeau de la démo.
  renderQuestion(main, { seance: nexts[0], data: essai.data, labels, demo: true }, { onQuit: () => {}, onTables: () => {}, onChooseTool: () => {}, onSpecimen: () => {}, onNext: () => {}, onCheck: async () => null });
  const column = main.querySelector('.question-main');
  assert.ok(column.children[0].classList.contains('banner--demo'));
  assert.ok(column.children[1].classList.contains('banner--demo-done'));
  assert.equal(main.querySelector('h1.question-title').textContent, 'Question');
});

test('renderQuestion sans le mode démo : rien ne change — la barre avec l’étudiant et « Corriger mon identité », pas de bandeau de démo', async () => {
  const { corps } = await serveur.appel('POST', '/api/creation', { corps: { exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' } });
  const { corps: question } = await serveur.appel('POST', '/api/question', { jeton: corps.jeton, corps: { exercice: M10 } });
  renderQuestion(main, { seance: question.seance, data: m10.data, labels: toolLabels(m10.exercise, m10.data) }, { onQuit: () => {}, onTables: () => {}, onIdentity: () => {}, onNext: () => {}, onCheck: async () => null });
  assert.equal(document.querySelector('#header-title').textContent, m10.exercise.titre);
  assert.equal(document.querySelector('#header-aside span').textContent, 'Camille Tremblay · 2412345');
  assert.deepEqual(document.querySelectorAll('#header-aside button').map((b) => b.textContent), ['Tables de référence', 'Corriger mon identité', 'Quitter']);
  assert.equal(main.querySelector('.banner--demo'), null);
  assert.equal(main.querySelector('.banner--demo-done'), null);
});

// --- Le spécimen -------------------------------------------------------------------------------------------------------

test('attestationPages avec specimen : chaque page porte la classe attestation--specimen et le filigrane « SPÉCIMEN », décoratif ; sans l’option, rien de tel', async () => {
  const { corps: specimen } = await serveur.appel('GET', `/api/demo/specimen?exercice=${M10}`);
  const pages = attestationPages(specimen, 'quiz.example', { specimen: true });
  assert.ok(pages.length >= 1);
  for (const page of pages) {
    assert.ok(page.classList.contains('print-page') && page.classList.contains('attestation') && page.classList.contains('attestation--specimen'));
    const mark = page.querySelector('.attestation-watermark');
    assert.equal(mark.textContent, 'SPÉCIMEN');
    assert.equal(mark.getAttribute('aria-hidden'), 'true');
    assert.equal(page.children[0], mark); // le premier enfant : posé par-dessus le contenu par la feuille de style
  }
  assert.equal(pages[0].querySelector('.attestation-code').textContent, 'SPECI-MEN00');
  assert.match(pages[0].querySelector('.attestation-mention').textContent, /^Vérification : quiz\.example\/verifier — code SPECI-MEN00$/);
  assert.match(pages[0].querySelector('.attestation-footer').textContent, /^Specimen-attestation-m10-tournage-vc\.pdf · remis sur Léa par l'étudiant/); // jamais « Attestation-… »
  assert.deepEqual(texts('.attestation-fact-value').length, 0); // pas encore à l'écran
  const facts = pages[0].querySelectorAll('.attestation-fact-value').map((n) => n.textContent);
  assert.ok(facts.includes('Exemple') && facts.includes('SPÉCIMEN') && facts.includes('0000000'));
  assert.ok(pages[0].querySelector('svg[role="img"]'));
  const plain = attestationPages(specimen, 'quiz.example');
  assert.ok(plain.every((page) => !page.classList.contains('attestation--specimen') && page.querySelector('.attestation-watermark') === null));
});

test('renderSpecimen : la page lettre avec le filigrane, la consigne, « Enregistrer en PDF », « ← Retour à la démo » (onBack), la barre du haut', async () => {
  const { corps: specimen } = await serveur.appel('GET', `/api/demo/specimen?exercice=${M10}`);
  const calls = [];
  renderSpecimen(main, { exercise: m10.exercise, specimen }, { onBack: () => calls.push('back') });
  assert.equal(document.querySelector('#header-title').textContent, `Spécimen d'attestation — ${m10.exercise.titre}`);
  assert.equal(document.querySelector('#header-aside span').textContent, DEMO_ASIDE);
  assert.ok(main.querySelector('.screen--document .attestation-stage .attestation--specimen .attestation-watermark'));
  const bar = main.querySelector('.attestation-bar');
  assert.ok(bar.classList.contains('no-print'));
  assert.equal(bar.querySelector('strong').textContent, SPECIMEN.title);
  assert.match(bar.textContent, /^Spécimen d'attestation — un exemple sans valeur, composé pour cette démo : la même page que l'étudiant remet sur Léa\./);
  assert.deepEqual(bar.querySelectorAll('button').map((b) => b.textContent), [SPECIMEN.print, SPECIMEN.back]);
  assert.equal(document.activeElement, main.querySelector('.attestation-title'));
  bar.querySelectorAll('button')[1].click();
  document.querySelector('#header-aside button').click();
  assert.deepEqual(calls, ['back', 'back']);
});

test('verificationOutcome : les deux issues d’un spécimen — « SPÉCIMEN — exemple sans valeur » (doré, avec le contenu) et « Code d’un spécimen » (scanne son QR)', () => {
  const specimen = verificationOutcome({ resultat: 'specimen' });
  assert.deepEqual([specimen.tone, specimen.title], ['gold', 'SPÉCIMEN — exemple sans valeur']);
  assert.match(specimen.text, /mode démo/);
  assert.match(specimen.text, /n'atteste aucune réussite/);
  const code = verificationOutcome({ resultat: 'specimen_code' });
  assert.deepEqual([code.tone, code.title], ['gold', "Code d'un spécimen"]);
  assert.match(code.text, /Scanne son code QR/);
});

// --- Les feuilles de style ---------------------------------------------------------------------------------------------

test('question.css, app.css, attestation.css : le bandeau de la démo, « Démo réussie » doré, le choix de l’outil, le filigrane ; aucune couleur en dur hors du filigrane', () => {
  const lire = (nom) => readFileSync(new URL(`../site/css/${nom}`, import.meta.url), 'utf8');
  const question = lire('question.css');
  assert.match(question, /\.banner--demo \{[^}]*margin: 0 0 var\(--space-4\);[^}]*border-color: var\(--color-accent-light\);/);
  assert.match(question, /\.banner--gold \{[^}]*border-color: var\(--color-gold\);/);
  assert.match(question, /\.banner-demo-actions \{\n  display: flex;/);
  const demoSection = question.slice(question.indexOf('/* Le mode démo (D92'), question.indexOf('/* Le rouge de la classe K'));
  assert.doesNotMatch(demoSection, /#[0-9a-f]{3,8}\b/i);
  const app = lire('app.css');
  const chooser = app.slice(app.indexOf('/* --- Le mode démo'), app.indexOf('/* --- Page de description'));
  assert.match(chooser, /\.demo-tools \{\n  display: grid;\n  grid-template-columns: repeat\(auto-fill, minmax\(200px, 1fr\)\);/);
  assert.match(chooser, /\.demo-tool \{[^}]*min-height: 44px;/); // cible tactile
  assert.match(chooser, /\.demo-tool--current \{ border-color: var\(--color-gold\); \}/);
  assert.match(chooser, /@media \(prefers-reduced-motion: reduce\) \{\n  \.demo-tool \{ transition: none; \}/);
  assert.doesNotMatch(chooser, /#[0-9a-f]{3,8}\b/i);
  const attestation = lire('attestation.css');
  assert.match(attestation, /\.attestation--specimen \{ position: relative; \}/);
  assert.match(attestation, /\.attestation-watermark \{\n  position: absolute;\n  inset: 0;\n  z-index: 1;[^}]*transform: rotate\(-30deg\);[^}]*pointer-events: none;/);
  // Le filigrane n'est pas caché à l'impression : aucune règle @media print ne le touche.
  assert.doesNotMatch(attestation.slice(attestation.indexOf('@media print')), /attestation-watermark/);
});
