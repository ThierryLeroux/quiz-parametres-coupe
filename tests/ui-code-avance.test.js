// Tests de ce que l'étudiant voit du code G d'avance (décision D96 ; UI §3.3 à §3.5) : l'écran Question et son corrigé —
// la pastille, l'étiquette « mot F », la case « sans objet », le panneau « Ligne de programme » — sur le DOM minuscule de
// aide-dom.js avec les vraies réponses du Worker ; les feuilles des avances et des formules ; les feuilles de style. Une
// version d'avant D96 ne montre rien de tout cela. C'est le DOM construit qu'on regarde ; la mise en page se vérifie dans
// Chrome (rapport d96-code-g-avance).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDom } from './aide-dom.js';
import { SECONDE, serveurDeTest } from './aide-serveur.js';
import { assembleExercise } from '../site/js/app.js';
import { F_WORD_FROM_QUESTION, NOT_APPLICABLE, feedCodeText, prefillFeedCodes } from '../site/js/code-avance.js';
import { assembleTables } from '../site/js/data.js';
import { prefillSpeedFactors } from '../site/js/facteur-vitesse.js';
import { feedCodeBadge } from '../site/js/ui/dom.js';
import { renderQuestion } from '../site/js/ui/question-screen.js';
import { createReference } from '../site/js/ui/reference-screen.js';
import { toolLabels } from '../site/js/ui/rules.js';
import { lireFichier } from './aide.js';

const CINQ = 'cinq-grandeurs';
const materiaux = await lireFichier('data/materiaux.json');
const operations = await lireFichier('data/operations.json');
const SANS = prefillSpeedFactors({ materiaux, operations }); // des tables d'avant D96 (les facteurs de vitesse, aucun code)
const CODES = prefillFeedCodes(SANS);
const EXERCICE = { id: CINQ, titre: 'Cinq grandeurs', version: 'r0', champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'], outils: [{ id: 'mvlnr', reussites_requises: 1 }, { id: 'lame_a_tronconner', reussites_requises: 1 }, { id: 'foret_fractionnaire', reussites_requises: 1, dimensions: ['Ø 1/4 po'] }] };

const serveur = serveurDeTest({ hote: 'http://localhost:8787', variables: { MODE_TEST: '1' } });
serveur.publierTables('A2026_r1', CODES);
serveur.publierTables('A2026_r2', SANS); // une version d'avant D96, publiée après : l'ordre ne compte pas, c'est la version de l'exercice qui compte
serveur.publierExercice(EXERCICE, { tablesId: 'A2026_r1', adopter: true });
serveur.publierExercice({ ...EXERCICE, id: 'avant' }, { tablesId: 'A2026_r2', adopter: true });
const publie = async (id) => assembleExercise((await serveur.appel('GET', `/api/exercice?exercice=${id}`)).corps);
const cinq = await publie(CINQ);
const avant = await publie('avant');
const demoSur = async (exercice, outil) => (await serveur.appel('POST', '/api/demo/creation', { corps: { exercice, outil } })).corps;

const { main, document } = installDom({ url: `http://localhost/?exercice=${CINQ}&demo=1` });
const tick = () => new Promise((resolve) => { setTimeout(resolve, 0); });
const rien = { onQuit: () => {}, onTables: () => {}, onChooseTool: () => {}, onSpecimen: () => {}, onNext: () => {}, onCheck: async () => null };

// --- La pastille -------------------------------------------------------------------------------------------------------------

test('feedCodeBadge : le code en tête, puis le libellé ; son texte est celui de feedCodeText ; en court sur la feuille', () => {
  const badge = feedCodeBadge('G99');
  assert.equal(badge.className, 'code-g');
  assert.equal(badge.querySelector('.code-g-code').textContent, 'G99');
  assert.equal(badge.textContent, feedCodeText('G99'));
  assert.equal(feedCodeBadge('G94').textContent, 'G94 · avance par minute');
  assert.equal(feedCodeBadge('G98', 'code-g code-g--sheet', 'par minute').textContent, 'G98 · par minute');
});

// --- L'écran Question --------------------------------------------------------------------------------------------------------

test('un outil du tour : la pastille « G99 · avance par tour » sous l’opération, « mot F » à droite de la case de f dès la question, Vf « sans objet » avec sa note, et quatre cases à saisir', async () => {
  const { demo } = await demoSur(CINQ, 'mvlnr');
  renderQuestion(main, { seance: demo, data: cinq.data, labels: toolLabels(cinq.exercise, cinq.data), demo: true }, rien);
  const card = main.querySelector('.tool-card');
  const operation = card.querySelector('.tool-operation');
  assert.equal(operation.textContent, 'Opération : Chariotage finition');
  const pastille = card.querySelector('.tool-code-g .code-g');
  assert.ok(pastille, 'la pastille est dans le panneau de l’outil');
  assert.equal(pastille.textContent, 'G99 · avance par tour');
  assert.equal(pastille.querySelector('.code-g-code').textContent, 'G99');
  assert.equal(operation.parentNode.children.indexOf(operation) + 1, operation.parentNode.children.indexOf(card.querySelector('.tool-code-g')), 'juste sous la ligne de l’opération');
  // Le mot F sur la case de f (G99), visible dès la question (F_WORD_FROM_QUESTION).
  const tag = main.querySelector('.mot-f');
  assert.equal(tag.textContent, 'mot F');
  assert.equal(tag.hidden, !F_WORD_FROM_QUESTION);
  assert.equal(tag.parentNode.className, 'field-case');
  assert.equal(tag.parentNode.querySelector('input').id, 'feedPerRev');
  assert.equal(main.querySelectorAll('.mot-f').length, 1);
  // Vf : « sans objet », italique atténué (sa classe), la note, pas de case ; les quatre autres à saisir.
  const vf = main.querySelector('.field--sans-objet');
  assert.ok(vf);
  assert.equal(vf.querySelector('.field-name').textContent, "Vitesse d'avance");
  assert.equal(vf.querySelector('.field-sans-objet').textContent, NOT_APPLICABLE);
  assert.equal(vf.querySelector('.field-note').textContent, "En G99, F est l'avance par tour.");
  assert.equal(vf.querySelector('input'), null);
  assert.equal(main.querySelector('.field--masked'), null);
  assert.deepEqual(main.querySelectorAll('.answer-grid input').map((input) => input.id), ['vc', 'feedPerTooth', 'rpm', 'feedPerRev']);
  assert.equal(main.querySelector('.program-card'), null, 'pas de ligne de programme avant « Vérifier »');
  // Le mode test a rempli les quatre cases, jamais Vf.
  assert.ok(main.querySelectorAll('.answer-grid input').every((input) => input.value !== ''));
});

test('un outil de fraiseuse : « G94 · avance par minute », « mot F » sur la case de Vf, les cinq cases à saisir', async () => {
  const { demo } = await demoSur(CINQ, 'foret_fractionnaire');
  renderQuestion(main, { seance: demo, data: cinq.data, labels: toolLabels(cinq.exercise, cinq.data), demo: true }, rien);
  assert.equal(main.querySelector('.tool-code-g .code-g').textContent, 'G94 · avance par minute');
  assert.equal(main.querySelector('.mot-f').parentNode.querySelector('input').id, 'feedRate');
  assert.equal(main.querySelector('.field--sans-objet'), null);
  assert.deepEqual(main.querySelectorAll('.answer-grid input').map((input) => input.id), ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate']);
});

test('après « Vérifier » : le panneau « Ligne de programme » sous le questionnaire — les deux lignes, la coordonnée atténuée, le mot F en doré, la note —, Vf reste « sans objet », le mot F reste', async () => {
  const { jeton, demo } = await demoSur(CINQ, 'lame_a_tronconner');
  serveur.avancer(11 * SECONDE);
  const attendues = await serveur.bonnesReponsesDemo(jeton);
  const corrected = (await serveur.appel('POST', '/api/demo/correction', { jeton, corps: { exercice: CINQ, saisies: demo.question.reponses_test } })).corps;
  assert.equal(corrected.correction.reussie, true);
  renderQuestion(main, { seance: demo, data: cinq.data, labels: toolLabels(cinq.exercise, cinq.data), demo: true }, {
    ...rien, onCheck: async (answers) => { assert.deepEqual(Object.keys(answers), ['vc', 'feedPerTooth', 'rpm', 'feedPerRev']); return { correction: corrected.correction, seance: corrected.demo }; },
  });
  main.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(main.querySelector('h1.question-title').textContent, 'Question — corrigée');
  const panel = main.querySelector('.program-card');
  assert.ok(panel, 'le panneau est là');
  assert.equal(panel.querySelector('.eyebrow').textContent, 'Ligne de programme');
  assert.equal(panel.parentNode.className, 'program-slot');
  const lines = panel.querySelectorAll('.program-line');
  assert.deepEqual(lines.map((line) => line.textContent), [`G97 S${attendues.rpm} M03`, `G99 G01 X… F${attendues.feedPerRev}`]);
  assert.equal(lines[1].querySelector('.program-coord').textContent, 'X…');
  assert.equal(lines[1].querySelector('.program-f').textContent, `F${attendues.feedPerRev}`);
  assert.equal(panel.querySelector('.program-note').textContent, 'S = N. F = f, en po/tour.');
  // Le questionnaire précède le panneau ; la progression suit.
  const column = main.querySelector('.question-main');
  assert.equal(column.children.indexOf(panel.parentNode), column.children.length - 1);
  // Vf telle quelle ; le mot F toujours là ; aucune Vf nulle part.
  assert.equal(main.querySelector('.field--sans-objet .field-note').textContent, "En G99, F est l'avance par tour.");
  assert.equal(main.querySelector('.mot-f').hidden, false);
  assert.equal(main.textContent.includes(attendues.feedRate), false);
});

test('une version d’avant D96 : ni pastille, ni mot F, ni « sans objet », ni ligne de programme — l’écran d’avant, Vf demandée au tour aussi', async () => {
  const { jeton, demo } = await demoSur('avant', 'mvlnr');
  serveur.avancer(11 * SECONDE);
  const corrected = (await serveur.appel('POST', '/api/demo/correction', { jeton, corps: { exercice: 'avant', saisies: demo.question.reponses_test } })).corps;
  renderQuestion(main, { seance: demo, data: avant.data, labels: toolLabels(avant.exercise, avant.data), demo: true }, { ...rien, onCheck: async () => ({ correction: corrected.correction, seance: corrected.demo }) });
  assert.equal(main.querySelector('.code-g'), null);
  assert.equal(main.querySelector('.mot-f'), null);
  assert.equal(main.querySelector('.field-case'), null);
  assert.equal(main.querySelector('.field--sans-objet'), null);
  assert.deepEqual(main.querySelectorAll('.answer-grid input').map((input) => input.id), ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate']);
  main.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(main.querySelector('h1.question-title').textContent, 'Question — corrigée');
  assert.equal(main.querySelector('.program-card'), null);
  assert.equal(main.querySelector('.program-slot').children.length, 0);
});

// --- Les feuilles --------------------------------------------------------------------------------------------------------------

test('la feuille des avances : une colonne « Code G » entre le pictogramme et la barre, une pastille par opération (le code, puis « par tour » ou « par minute ») ; la feuille des formules reçoit la rangée du mot F ; une version d’avant garde ses feuilles', () => {
  const reference = createReference(assembleTables(CODES), { standalone: true });
  reference.open('avances');
  const grid = document.querySelector('.sheets .feed-grid');
  assert.equal(grid.className, 'feed-grid feed-grid--codes');
  const heads = grid.querySelectorAll('.feed-head').map((head) => [head.textContent, head.getAttribute('style')]);
  assert.deepEqual(heads, [['Machine-outil', 'grid-column: 1 / span 2'], ['Opération', 'grid-column: 3 / span 2'], ['Code G', 'grid-column: 5'], ['Avance par révolution', 'grid-column: 6 / span 2']]);
  const codes = grid.querySelectorAll('.feed-code');
  assert.equal(codes.length, 19);
  assert.ok(codes.every((cell) => cell.getAttribute('style').startsWith('grid-column: 5;')));
  assert.deepEqual(codes.map((cell) => cell.querySelector('.code-g--sheet').textContent).slice(0, 5), ['G94 · par minute', 'G94 · par minute', 'G94 · par minute', 'G94 · par minute', 'G94 · par minute']);
  assert.deepEqual(codes.map((cell) => cell.querySelector('.code-g-code').textContent).slice(9), Array(10).fill('G99'));
  assert.ok(grid.querySelectorAll('.feed-value').every((cell) => cell.getAttribute('style').startsWith('grid-column: 6;')));
  assert.ok(grid.querySelectorAll('.feed-box').every((cell) => cell.getAttribute('style').startsWith('grid-column: 7;')));
  assert.ok(grid.querySelectorAll('.feed-band').every((cell) => cell.getAttribute('style').startsWith('grid-column: 3 / span 5;')));
  reference.open('formules');
  const rows = document.querySelectorAll('.sheets .formula-row');
  const motF = rows.find((row) => row.querySelector('.formula-name strong').textContent === 'Mot F');
  assert.ok(motF, 'la rangée du mot F');
  assert.equal(motF.querySelector('.formula-math').textContent, 'G94 / G98 : F = Vf (po/min)G95 / G99 : F = f (po/tour)');
  assert.match(motF.querySelector('.formula-note').textContent, /^Au tour, G98 \/ G99 sont les codes du système A de Fanuc\. En fraisage, G94 \/ G95\./);
  const vf = rows.find((row) => row.querySelector('.formula-name strong').textContent === 'Vitesse d’avance');
  assert.equal(vf.querySelector('.formula-note').textContent, 'C’est la vitesse programmée à la commande en G94 / G98. En G95 / G99, c’est f qui se programme : Vf est sans objet.');
  assert.equal(rows.indexOf(motF), rows.indexOf(vf) + 1, 'juste après Vf');
  reference.destroy();
  // Une version d'avant : la grille d'avant, aucune pastille, la feuille des formules d'avant.
  const ancienne = createReference(assembleTables(SANS), { standalone: true });
  ancienne.open('avances');
  const ancienneGrid = document.querySelector('.sheets .feed-grid');
  assert.equal(ancienneGrid.className, 'feed-grid');
  assert.equal(ancienneGrid.querySelector('.feed-code'), null);
  assert.deepEqual(ancienneGrid.querySelectorAll('.feed-head').map((head) => head.textContent), ['Machine-outil', 'Opération', 'Avance par révolution']);
  assert.ok(ancienneGrid.querySelectorAll('.feed-value').every((cell) => cell.getAttribute('style').startsWith('grid-column: 5;')));
  ancienne.open('formules');
  const anciennes = document.querySelectorAll('.sheets .formula-row');
  assert.equal(anciennes.some((row) => row.querySelector('.formula-name strong').textContent === 'Mot F'), false);
  assert.equal(anciennes.find((row) => row.querySelector('.formula-name strong').textContent === 'Vitesse d’avance').querySelector('.formula-note').textContent, 'C’est la vitesse programmée à la commande (G94).');
  ancienne.destroy();
});

// --- Les feuilles de style ---------------------------------------------------------------------------------------------------

test('tokens.css, question.css, sheets.css, editeur.css : la pastille, le mot F, « sans objet », la ligne de programme et la colonne de la feuille ne nomment que les variables --code-g-* et le doré ; aucune couleur en dur', () => {
  const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const bloc = (css, selector) => {
    const debut = css.indexOf(`${selector} {`);
    assert.notEqual(debut, -1, selector);
    return css.slice(debut, css.indexOf('}', debut));
  };
  const question = lire('site/css/question.css');
  const pastille = bloc(question, '.code-g');
  assert.match(pastille, /border: 1px solid var\(--code-g-border\);/);
  assert.match(pastille, /background: var\(--code-g-bg\);/);
  assert.match(pastille, /font-family: var\(--font-number\);/);
  assert.match(bloc(question, '.code-g-code'), /color: var\(--code-g-code\);/);
  assert.match(bloc(question, '.mot-f'), /position: absolute;[\s\S]*border: 1px solid var\(--code-g-border\);[\s\S]*background: var\(--color-panel\);[\s\S]*font-family: var\(--font-number\);/);
  assert.match(bloc(question, '.field-case'), /position: relative;/);
  assert.match(bloc(question, '.field--sans-objet .field-sans-objet'), /font-style: italic;/);
  assert.match(bloc(question, '.program-lines'), /background: var\(--code-g-bg\);[\s\S]*font-family: var\(--font-number\);/);
  assert.match(bloc(question, '.program-coord'), /color: var\(--code-g-muted\);/);
  assert.match(bloc(question, '.program-f'), /color: var\(--color-gold\);/);
  for (const selector of ['.code-g', '.code-g-code', '.mot-f', '.program-lines', '.program-coord', '.program-f']) assert.doesNotMatch(bloc(question, selector), /#[0-9a-f]{3,6}\b/i, `${selector} : aucune couleur en dur`);
  const sheets = lire('site/css/sheets.css');
  assert.match(bloc(sheets, '.feed-grid--codes'), /grid-template-columns: 78px 36px 138px 62px 72px minmax\(0, 1fr\) 178px;/);
  assert.match(bloc(sheets, '.code-g--sheet'), /flex-direction: column;/);
  assert.match(bloc(sheets, '.code-g--sheet .code-g-sep'), /display: none;/);
  const tokens = lire('site/css/tokens.css');
  for (const name of ['bg', 'border', 'code', 'text', 'muted']) assert.match(tokens, new RegExp(`--code-g-${name}: #[0-9a-f]{6};`));
  assert.match(lire('site/css/editeur.css'), /\.avis-code-g\[hidden\] \{ display: none; \}/);
});
