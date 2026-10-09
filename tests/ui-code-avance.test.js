// Tests de ce que l'étudiant voit du code G d'avance (décisions D96, D97 : le code est celui de la copie ; UI §3.3, §3.4) :
// l'écran Question et son corrigé — la pastille, l'étiquette « mot F », la case « sans objet », le panneau « Ligne de
// programme » — sur le DOM minuscule de aide-dom.js avec les vraies réponses du Worker ; une copie sans code, dans le
// même exercice, montre l'écran d'avant D96 ; les feuilles de référence n'en portent rien (retour à celles d'avant D96) ;
// les feuilles de style. C'est le DOM construit qu'on regarde ; la mise en page se vérifie dans Chrome (rapport
// d97-code-g-par-copie).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDom } from './aide-dom.js';
import { SECONDE, serveurDeTest } from './aide-serveur.js';
import { assembleExercise } from '../site/js/app.js';
import { F_WORD_FROM_QUESTION, NOT_APPLICABLE, feedCodeText } from '../site/js/code-avance.js';
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
const AVEC = prefillSpeedFactors({ materiaux, operations }); // des tables qui portent les facteurs de vitesse ; aucun code (D97)
// Le code de chaque entrée du format fichier devient celui de la copie (❓ D97, point 5) : MVLNR et la lame en G99, le foret en G94, la fraise sans code.
const EXERCICE = {
  id: CINQ, titre: 'Cinq grandeurs', version: 'r0', champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'],
  outils: [{ id: 'mvlnr', reussites_requises: 1, code_avance: 'G99' }, { id: 'lame_a_tronconner', reussites_requises: 1, code_avance: 'G99' }, { id: 'foret_fractionnaire', reussites_requises: 1, dimensions: ['Ø 1/4 po'], code_avance: 'G94' }, { id: 'fraise_en_bout_helicoidale', reussites_requises: 1 }],
};

const serveur = serveurDeTest({ hote: 'http://localhost:8787', variables: { MODE_TEST: '1' } });
serveur.publierTables('A2026_r1', AVEC);
serveur.publierExercice(EXERCICE, { tablesId: 'A2026_r1', adopter: true });
const cinq = assembleExercise((await serveur.appel('GET', `/api/exercice?exercice=${CINQ}`)).corps);
const demoSur = async (outil) => (await serveur.appel('POST', '/api/demo/creation', { corps: { exercice: CINQ, outil } })).corps;

const { main, document } = installDom({ url: `http://localhost/?exercice=${CINQ}&demo=1` });
const tick = () => new Promise((resolve) => { setTimeout(resolve, 0); });
const rien = { onQuit: () => {}, onTables: () => {}, onChooseTool: () => {}, onSpecimen: () => {}, onNext: () => {}, onCheck: async () => null };
const labels = toolLabels(cinq.exercise, cinq.data);

// --- La pastille -------------------------------------------------------------------------------------------------------------

test('feedCodeBadge : le code en tête, puis le libellé ; son texte est celui de feedCodeText', () => {
  const badge = feedCodeBadge('G99');
  assert.equal(badge.className, 'code-g');
  assert.equal(badge.querySelector('.code-g-code').textContent, 'G99');
  assert.equal(badge.textContent, feedCodeText('G99'));
  assert.equal(feedCodeBadge('G94').textContent, 'G94 · avance par minute');
});

// --- L'écran Question --------------------------------------------------------------------------------------------------------

test('une copie en G99 : la pastille « G99 · avance par tour » sous l’opération, « mot F » sur la case de f dès la question, Vf « sans objet » avec sa note, et quatre cases à saisir', async () => {
  const { demo } = await demoSur('mvlnr');
  renderQuestion(main, { seance: demo, data: cinq.data, labels, demo: true }, rien);
  const card = main.querySelector('.tool-card');
  const operation = card.querySelector('.tool-operation');
  assert.equal(operation.textContent, 'Opération : Chariotage finition');
  const pastille = card.querySelector('.tool-code-g .code-g');
  assert.ok(pastille, 'la pastille est dans le panneau de l’outil');
  assert.equal(pastille.textContent, 'G99 · avance par tour');
  assert.equal(pastille.querySelector('.code-g-code').textContent, 'G99');
  assert.equal(operation.parentNode.children.indexOf(operation) + 1, operation.parentNode.children.indexOf(card.querySelector('.tool-code-g')), 'juste sous la ligne de l’opération');
  const tag = main.querySelector('.mot-f');
  assert.equal(tag.textContent, 'mot F');
  assert.equal(tag.hidden, !F_WORD_FROM_QUESTION);
  assert.equal(tag.parentNode.className, 'field-case');
  assert.equal(tag.parentNode.querySelector('input').id, 'feedPerRev');
  assert.equal(main.querySelectorAll('.mot-f').length, 1);
  const vf = main.querySelector('.field--sans-objet');
  assert.ok(vf);
  assert.equal(vf.querySelector('.field-name').textContent, "Vitesse d'avance");
  assert.equal(vf.querySelector('.field-sans-objet').textContent, NOT_APPLICABLE);
  assert.equal(vf.querySelector('.field-note').textContent, "En G99, F est l'avance par tour.");
  assert.equal(vf.querySelector('input'), null);
  assert.equal(main.querySelector('.field--masked'), null);
  assert.deepEqual(main.querySelectorAll('.answer-grid input').map((input) => input.id), ['vc', 'feedPerTooth', 'rpm', 'feedPerRev']);
  assert.equal(main.querySelector('.program-card'), null, 'pas de ligne de programme avant « Vérifier »');
  assert.ok(main.querySelectorAll('.answer-grid input').every((input) => input.value !== ''), 'le mode test a rempli les quatre cases');
});

test('une copie en G94 : « G94 · avance par minute », « mot F » sur la case de Vf, les cinq cases à saisir', async () => {
  const { demo } = await demoSur('foret_fractionnaire');
  renderQuestion(main, { seance: demo, data: cinq.data, labels, demo: true }, rien);
  assert.equal(main.querySelector('.tool-code-g .code-g').textContent, 'G94 · avance par minute');
  assert.equal(main.querySelector('.mot-f').parentNode.querySelector('input').id, 'feedRate');
  assert.equal(main.querySelector('.field--sans-objet'), null);
  assert.deepEqual(main.querySelectorAll('.answer-grid input').map((input) => input.id), ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate']);
});

test('après « Vérifier » : le panneau « Ligne de programme » sous le questionnaire — les deux lignes, la coordonnée atténuée, le mot F en doré, la note —, Vf reste « sans objet », le mot F reste', async () => {
  const { jeton, demo } = await demoSur('lame_a_tronconner');
  serveur.avancer(11 * SECONDE);
  const attendues = await serveur.bonnesReponsesDemo(jeton);
  const corrected = (await serveur.appel('POST', '/api/demo/correction', { jeton, corps: { exercice: CINQ, saisies: demo.question.reponses_test } })).corps;
  assert.equal(corrected.correction.reussie, true);
  renderQuestion(main, { seance: demo, data: cinq.data, labels, demo: true }, {
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
  const column = main.querySelector('.question-main');
  assert.equal(column.children.indexOf(panel.parentNode), column.children.length - 1);
  assert.equal(main.querySelector('.field--sans-objet .field-note').textContent, "En G99, F est l'avance par tour.");
  assert.equal(main.querySelector('.mot-f').hidden, false);
  assert.equal(main.textContent.includes(attendues.feedRate), false);
});

test('une copie sans code, dans le même exercice : ni pastille, ni mot F, ni « sans objet », ni ligne de programme — l’écran d’avant D96, Vf demandée', async () => {
  const { jeton, demo } = await demoSur('fraise_en_bout_helicoidale');
  serveur.avancer(11 * SECONDE);
  const corrected = (await serveur.appel('POST', '/api/demo/correction', { jeton, corps: { exercice: CINQ, saisies: demo.question.reponses_test } })).corps;
  renderQuestion(main, { seance: demo, data: cinq.data, labels, demo: true }, { ...rien, onCheck: async () => ({ correction: corrected.correction, seance: corrected.demo }) });
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

// --- Les feuilles : celles d'avant D96 (D97) ---------------------------------------------------------------------------------

test('les feuilles de référence ne portent rien du code G : la feuille des avances a sa grille d’avant, sans colonne ni pastille ; la feuille des formules n’a pas de rangée « Mot F » et garde sa note de Vf', () => {
  const reference = createReference(assembleTables(AVEC), { standalone: true });
  reference.open('avances');
  const grid = document.querySelector('.sheets .feed-grid');
  assert.equal(grid.className, 'feed-grid');
  assert.deepEqual(grid.querySelectorAll('.feed-head').map((head) => [head.textContent, head.getAttribute('style')]), [['Machine-outil', 'grid-column: 1 / span 2'], ['Opération', 'grid-column: 3 / span 2'], ['Avance par révolution', 'grid-column: 5 / span 2']]);
  assert.equal(grid.querySelector('.feed-code'), null);
  assert.equal(document.querySelector('.sheets .code-g'), null);
  assert.ok(grid.querySelectorAll('.feed-value').every((cell) => cell.getAttribute('style').startsWith('grid-column: 5;')));
  assert.ok(grid.querySelectorAll('.feed-box').every((cell) => cell.getAttribute('style').startsWith('grid-column: 6;')));
  reference.open('formules');
  const rows = document.querySelectorAll('.sheets .formula-row');
  assert.equal(rows.some((row) => row.querySelector('.formula-name strong').textContent === 'Mot F'), false);
  assert.equal(rows.find((row) => row.querySelector('.formula-name strong').textContent === 'Vitesse d’avance').querySelector('.formula-note').textContent, 'C’est la vitesse programmée à la commande (G94).');
  reference.destroy();
});

// --- Les feuilles de style ---------------------------------------------------------------------------------------------------

test('tokens.css, question.css, editeur.css, sheets.css : la pastille, le mot F, « sans objet » et la ligne de programme ne nomment que les variables --code-g-* et le doré ; la pastille grise de la Gestion du contenu ; plus rien du code G dans les feuilles', () => {
  const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const bloc = (css, selector) => {
    const debut = css.indexOf(`${selector} {`);
    assert.notEqual(debut, -1, selector);
    return css.slice(debut, css.indexOf('}', debut));
  };
  const question = lire('site/css/question.css');
  assert.match(bloc(question, '.code-g'), /border: 1px solid var\(--code-g-border\);[\s\S]*background: var\(--code-g-bg\);[\s\S]*font-family: var\(--font-number\);/);
  assert.match(bloc(question, '.code-g-code'), /color: var\(--code-g-code\);/);
  assert.match(bloc(question, '.mot-f'), /position: absolute;[\s\S]*border: 1px solid var\(--code-g-border\);[\s\S]*background: var\(--color-panel\);[\s\S]*font-family: var\(--font-number\);/);
  assert.match(bloc(question, '.field-case'), /position: relative;/);
  assert.match(bloc(question, '.field--sans-objet .field-sans-objet'), /font-style: italic;/);
  assert.match(bloc(question, '.program-lines'), /background: var\(--code-g-bg\);[\s\S]*font-family: var\(--font-number\);/);
  assert.match(bloc(question, '.program-coord'), /color: var\(--code-g-muted\);/);
  assert.match(bloc(question, '.program-f'), /color: var\(--color-gold\);/);
  for (const selector of ['.code-g', '.code-g-code', '.mot-f', '.program-lines', '.program-coord', '.program-f']) assert.doesNotMatch(bloc(question, selector), /#[0-9a-f]{3,6}\b/i, `${selector} : aucune couleur en dur`);
  const editeur = lire('site/css/editeur.css');
  assert.match(bloc(editeur, '.badge-code-g'), /border: 1px solid var\(--color-text-muted\);[\s\S]*color: var\(--color-text-muted\);[\s\S]*font-family: var\(--font-number\);/);
  assert.doesNotMatch(bloc(editeur, '.badge-code-g'), /--color-gold/); // pas de doré : ce n'est pas une alerte
  assert.match(editeur, /\.selection-code-g\[hidden\] \{ display: none; \}/);
  assert.doesNotMatch(editeur, /avis-code-g/);
  const sheets = lire('site/css/sheets.css');
  assert.doesNotMatch(sheets, /feed-grid--codes|code-g|formula-code/);
  const tokens = lire('site/css/tokens.css');
  for (const name of ['bg', 'border', 'code', 'text', 'muted']) assert.match(tokens, new RegExp(`--code-g-${name}: #[0-9a-f]{6};`));
});
