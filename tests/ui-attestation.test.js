// Tests de site/js/ui/attestation-data.js (ce que montrent l'attestation et la vérification) et de
// la partie pure de site/js/ui/qr.js (la bibliothèque vendorisée encode l'adresse de vérification).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PAGE_LAYOUT, attestationFacts, exerciseVersionLabel, materialColumnWidth, rowHeight, attestationFileName, attestationFooter, attestationRows, continuationLine, hasQuestions,
  materialText, pageLabel, paginateAttestation, questionColumns, questionRows, questionWidths, tableTitles, tablesRevision, verificationMention, verificationOutcome,
} from '../site/js/ui/attestation-data.js';
import { qrModules } from '../site/js/ui/qr.js';
import { formatDateStamp } from '../site/js/ui/text.js';
import { aleaAGraine, data, toutesLesQuestions } from './aide.js';

// Les dates sont écrites à l'heure du poste : on les construit en heure locale pour que le texte
// attendu ne dépende pas du fuseau de la machine de test.
const DEBUT = new Date(2026, 8, 21, 13, 5, 7);
const REUSSITE = new Date(2026, 8, 21, 13, 48, 10);

const RECORD = {
  code: 'ABCDEFGHJK',
  exercice: { id: 'm10-tournage-vc', titre: 'M10 — Tournage : vitesse de coupe' },
  revision: 'r0',
  revision_tables: { materiaux: 'A2026_r0', operations: 'A2026_r0' },
  etudiant: { prenom: 'Zoé', nom: "D'Amours Lévesque", matricule: '2412345' },
  debut: DEBUT.toISOString(),
  reussite_le: REUSSITE.toISOString(),
  questions_reussies: 15,
  outils: [
    { id: 'mclnr', nom: 'MCLNR', plage: '10 mm à 20 mm', operation: 'Chariotage ébauche', reussites: 1, requises: 1 },
    { id: 'mvlnr', nom: 'MVLNR', plage: '1.000" à 4.000"', operation: 'Chariotage finition', reussites: 3, requises: 3 },
  ],
};

test('formatDateStamp : « 2026-09-21 13:05 », avec ou sans secondes, à l’heure du poste', () => {
  assert.equal(formatDateStamp(DEBUT.toISOString()), '2026-09-21 13:05');
  assert.equal(formatDateStamp(DEBUT.toISOString(), { seconds: true }), '2026-09-21 13:05:07');
  assert.equal(formatDateStamp(new Date(2026, 0, 3, 8, 4).toISOString()), '2026-01-03 08:04');
});

test('attestationFacts : le bloc d’informations, dans l’ordre, dates mises en forme et marquées (stamp), matricule en chasse fixe', () => {
  assert.deepEqual(attestationFacts(RECORD), [
    { label: 'Exercice', value: 'M10 — Tournage : vitesse de coupe' },
    { label: "Version de l'exercice", value: 'r0' },
    { label: 'Révision des tables', value: 'A2026_r0' },
    { label: 'Prénom', value: 'Zoé' },
    { label: 'Nom', value: "D'Amours Lévesque" },
    { label: 'Matricule', value: '2412345', mono: true },
    { label: "Début de l'exercice", value: '2026-09-21 13:05', stamp: true },
    { label: "Réussite de l'exercice", value: '2026-09-21 13:48', stamp: true },
    { label: 'Questions réussies', value: '15' },
  ]);
});

test('exerciseVersionLabel (D50) : une version publiée numérotée s’écrit « version 1 » ; une attestation figée avant le jalon 7a garde « r0 »', () => {
  assert.equal(exerciseVersionLabel('1'), 'version 1');
  assert.equal(exerciseVersionLabel('12'), 'version 12');
  assert.equal(exerciseVersionLabel('r0'), 'r0');
  assert.deepEqual(attestationFacts({ ...RECORD, revision: '2' }).slice(1, 3), [{ label: "Version de l'exercice", value: 'version 2' }, { label: 'Révision des tables', value: 'A2026_r0' }]);
  assert.deepEqual(attestationFacts(RECORD)[1], { label: "Version de l'exercice", value: 'r0' }); // inchangée
});

test('tablesRevision : une seule révision si les deux tables ont la même, les deux sinon, « — » sans révision (ancien enregistrement)', () => {
  assert.equal(tablesRevision(RECORD), 'A2026_r0');
  assert.equal(tablesRevision({ revision_tables: { materiaux: 'A2026_r0', operations: 'A2026_r1' } }), 'vitesses A2026_r0 · avances A2026_r1');
  assert.equal(tablesRevision({}), '—');
});

test('attestationRows : une ligne par outil, dans l’ordre de l’enregistrement, réussites « obtenues / exigées »', () => {
  assert.deepEqual(attestationRows(RECORD), [
    { operation: 'Chariotage ébauche', outil: 'MCLNR', plage: '10 mm à 20 mm', reussites: '1 / 1' },
    { operation: 'Chariotage finition', outil: 'MVLNR', plage: '1.000" à 4.000"', reussites: '3 / 3' },
  ]);
});

// --- La liste des questions réussies (D41) ---------------------------------------------------------------------

const Q1 = new Date(2026, 8, 21, 13, 12, 5);
const Q2 = new Date(2026, 8, 21, 13, 40, 59);
const QUESTIONS = [
  { numero: 3, outil_id: 'mclnr', outil: 'MCLNR - Ø charioté: 10 mm', materiau_outil: 'Insert de carbure de tungstène', materiau: { classe: 'H', groupe: 39, materiau: 'Acier durci', etat: 'Durci et revenu' }, reponses: { vc: '40' }, horodatage: Q1.toISOString() },
  { numero: 7, outil_id: 'mvlnr', outil: 'MVLNR - Ø charioté: 2.000"', materiau_outil: 'Acier rapide', materiau: { classe: 'N', groupe: 21, materiau: 'Aluminium de corroyage', etat: null }, reponses: { vc: '400', rpm: '800' }, horodatage: Q2.toISOString() },
];
const AVEC_LISTE = { ...RECORD, questions: QUESTIONS };

test('hasQuestions : vrai avec une liste non vide ; faux pour un enregistrement figé avant cette version, ou une liste vide', () => {
  assert.equal(hasQuestions(AVEC_LISTE), true);
  assert.equal(hasQuestions(RECORD), false);
  assert.equal(hasQuestions({ ...RECORD, questions: [] }), false);
});

test('questionColumns : les grandeurs évaluées présentes, dans l’ordre du calcul, avec leur unité', () => {
  assert.deepEqual(questionColumns(AVEC_LISTE), [{ key: 'vc', label: 'Vc (pi/min)', lines: ['Vc', '(pi/min)'] }, { key: 'rpm', label: 'N (tr/min)', lines: ['N', '(tr/min)'] }]);
  assert.ok(questionColumns({ ...RECORD, questions: [{ ...QUESTIONS[0], reponses: { vc: '1', feedPerTooth: '1', rpm: '1', feedPerRev: '1', feedRate: '1' } }] }).every((c) => c.lines.join(' ') === c.label)); // deux lignes, le même texte
  assert.deepEqual(questionColumns({ ...RECORD, questions: [{ ...QUESTIONS[0], reponses: { feedRate: '4', vc: '40', feedPerTooth: '0.004' } }] }).map((c) => c.key), ['vc', 'feedPerTooth', 'feedRate']);
  assert.deepEqual(questionColumns(RECORD), []);
});

test('materialText : « P 1 — Acier non allié, Recuit » ; sans état, pas de virgule', () => {
  assert.equal(materialText({ classe: 'P', groupe: 1, materiau: 'Acier non allié', etat: 'Recuit' }), 'P 1 — Acier non allié, Recuit');
  assert.equal(materialText({ classe: 'N', groupe: 21, materiau: 'Aluminium de corroyage', etat: null }), 'N 21 — Aluminium de corroyage');
});

test('questionRows : une ligne par question, dans l’ordre, matière en court, une réponse par colonne (« — » si la grandeur n’était pas évaluée), heure avec les secondes, nombre de lignes de texte', () => {
  assert.deepEqual(questionRows(AVEC_LISTE), [
    { numero: '3', outil: 'MCLNR - Ø charioté: 10 mm', materiau_outil: 'Insert de carbure', materiau: 'H 39 — Acier durci, Durci et revenu', reponses: ['40', '—'], horodatage: '2026-09-21 13:12:05', lines: 1 },
    { numero: '7', outil: 'MVLNR - Ø charioté: 2.000"', materiau_outil: 'Acier rapide', materiau: 'N 21 — Aluminium de corroyage', reponses: ['400', '800'], horodatage: '2026-09-21 13:40:59', lines: 1 },
  ]);
  assert.equal(questionRows({ ...RECORD, questions: [{ ...QUESTIONS[0], materiau_outil: 'Carbure de tungstène solide' }] })[0].materiau_outil, 'Carbure solide');
  assert.deepEqual(questionRows(RECORD), []);
});

test('repli (D43) : un matériau ou un outil trop long pour sa colonne compte deux lignes, jamais tronqué ; la colonne du matériau rétrécit avec le nombre de grandeurs évaluées', () => {
  assert.equal(materialColumnWidth(1), 720 - 22 - 180 - 90 - 60 - 110); // 258 px pour le M10 (Vc seule)
  assert.equal(materialColumnWidth(2), 198);
  const ampco = { classe: 'N', groupe: 30, materiau: 'Cuivre et alliages de cuivre', etat: 'Haute résistance en traction, Ampco' }; // 72 caractères
  const [long] = questionRows({ ...RECORD, questions: [{ ...QUESTIONS[1], materiau: ampco }] });
  assert.equal(long.materiau, 'N 30 — Cuivre et alliages de cuivre, Haute résistance en traction, Ampco');
  assert.equal(long.lines, 2);
  assert.equal(rowHeight(long), 7 + 2 * 13);
  assert.equal(rowHeight(questionRows(AVEC_LISTE)[0]), 20);
  // Un nom d'outil long compte aussi.
  const fraise = { ...QUESTIONS[1], outil: 'Fraise à chanfreiner 82 degrés - Ø 5/16 po - 3 lèvre(s)' }; // 55 caractères, colonne de 180 px
  assert.equal(questionRows({ ...RECORD, questions: [fraise] })[0].lines, 2);
});

// --- À quatre ou cinq grandeurs : les largeurs resserrées (D85) ------------------------------------------------------

const CINQ = { vc: '165', feedPerTooth: '0.000938', rpm: '10000', feedPerRev: '0.000984', feedRate: '166.667' };
const AMPCO = { classe: 'N', groupe: 30, materiau: 'Cuivre et alliages de cuivre', etat: 'Haute résistance en traction, Ampco' };

// Tous les noms d'outils que le moteur compose pour le catalogue (chaque outil × dimension × dents × barre).
const NOMS = new Set();
for (const question of toutesLesQuestions()) NOMS.add(question.displayId);

test('questionWidths (D85) : les largeurs ordinaires jusqu’à trois grandeurs ; resserrées à quatre et cinq, où le matériau usiné garde au moins 100 px', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => questionWidths(n).narrow), [false, false, false, true, true]);
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => materialColumnWidth(n)), [258, 198, 138, 214, 160]); // avant D85 : 78 px à quatre grandeurs, 18 px à cinq
  assert.ok([1, 2, 3, 4, 5].every((n) => materialColumnWidth(n) >= PAGE_LAYOUT.minMaterial));
  assert.deepEqual(questionWidths(2), { ...PAGE_LAYOUT.columns, narrow: false, materiau: 198 }); // une ou deux grandeurs : rien ne change
  assert.deepEqual(questionWidths(5), { numero: 22, outil: 150, materiau_outil: 56, answer: 54, stamp: 62, page: 720, narrow: true, materiau: 160 });
  // Les colonnes remplissent la page, ni plus ni moins.
  for (const n of [1, 2, 3, 4, 5]) {
    const w = questionWidths(n);
    assert.equal(w.numero + w.outil + w.materiau_outil + w.materiau + w.answer * n + w.stamp, 720);
  }
});

test('attestation.css porte les largeurs de PAGE_LAYOUT, ordinaires et resserrées', () => {
  const css = readFileSync(new URL('../site/css/attestation.css', import.meta.url), 'utf8');
  const width = (selector) => Number(css.match(new RegExp(`^${selector.replace(/[.()]/g, '\\$&')} \\{ width: (\\d+)px; \\}`, 'm'))?.[1]);
  for (const [name, columns] of [['.attestation-questions', PAGE_LAYOUT.columns], ['.attestation-questions--narrow', PAGE_LAYOUT.narrowColumns]]) {
    assert.equal(width(`${name} th:nth-child(2)`), columns.outil, `${name} : outil`);
    assert.equal(width(`${name} th:nth-child(3)`), columns.materiau_outil, `${name} : matière d'outil`);
    assert.equal(width(`${name} th.num:not(:first-child)`), columns.answer, `${name} : grandeur`);
    assert.equal(width(`${name} th:last-child`), columns.stamp, `${name} : date et heure`);
  }
  assert.equal(width('.attestation-questions th:nth-child(1)'), PAGE_LAYOUT.columns.numero);
  assert.equal(PAGE_LAYOUT.narrowColumns.numero, PAGE_LAYOUT.columns.numero); // la même colonne : une seule règle dans la feuille
});

test('largeurs resserrées (D85) : la date et l’heure sur deux lignes, donc deux lignes au moins par rang ; le matériau le plus long en prend trois, replié entre les mots', () => {
  const court = { ...QUESTIONS[1], reponses: CINQ };
  const [row] = questionRows({ ...RECORD, questions: [court] });
  assert.deepEqual(row.reponses, ['165', '0.000938', '10000', '0.000984', '166.667']); // dans l'ordre du calcul : Vc, fz, N, f, Vf
  assert.equal(row.horodatage, '2026-09-21 13:40:59'); // le texte ne change pas : c'est la colonne qui le replie
  assert.equal(row.lines, 2);
  assert.equal(rowHeight(row), 33);
  // « N 30 — Cuivre et alliages de » / « cuivre, Haute résistance en » / « traction, Ampco » dans 152 px à 4,6 px par caractère.
  assert.equal(questionRows({ ...RECORD, questions: [{ ...court, materiau: AMPCO }] })[0].lines, 3);
  // Le nom d'outil le plus long du lot (57 caractères) tient sur deux lignes dans 150 px.
  assert.equal(questionRows({ ...RECORD, questions: [{ ...court, outil: 'Fraise à fileter Ø 0.180 po — 20 à 32 filets/po - 4 dents' }] })[0].lines, 2);
  // Un mot plus large que sa colonne se coupe, en dernier recours, et compte ses lignes : 40 caractères dans 142 px.
  assert.equal(questionRows({ ...RECORD, questions: [{ ...court, outil: 'x'.repeat(40) }] })[0].lines, 2);
  assert.equal(questionRows({ ...RECORD, questions: [{ ...court, outil: `Foret ${'x'.repeat(40)}` }] })[0].lines, 3);
});

test('aucun mot coupé (D85) : à cinq grandeurs, chaque mot des matériaux des tables et des noms d’outils du catalogue tient dans sa colonne', () => {
  const widths = questionWidths(5);
  const fits = (text, width) => text.split(' ').every((word) => word.length * PAGE_LAYOUT.charWidth <= width - PAGE_LAYOUT.cellPadding);
  for (const m of data.materiaux) assert.ok(fits(materialText({ classe: m.iso, groupe: m.groupe, materiau: m.materiau, etat: m.etat }), widths.materiau), m.materiau);
  assert.ok(NOMS.size > 400, `${NOMS.size} noms`);
  for (const name of NOMS) assert.ok(fits(name, widths.outil), name);
  for (const name of ['Acier rapide', 'Carbure solide', 'Insert de carbure']) assert.ok(fits(name, widths.materiau_outil), name);
});

test('non-régression (D85) : à une et deux grandeurs, le repli entre les mots compte les mêmes lignes que l’estimation d’avant, pour tout le catalogue', () => {
  // L'estimation d'avant D85, gardée ici comme témoin : au caractère, sans égard aux mots.
  const before = (text, width) => Math.max(1, Math.ceil(text.length * 4.6 / (width - 8)));
  const linesOf = (question, n) => questionRows({ ...RECORD, questions: [{ ...QUESTIONS[0], ...question, reponses: Object.fromEntries(Object.entries(CINQ).slice(0, n)) }] })[0].lines;
  let compared = 0;
  for (const n of [1, 2]) {
    for (const m of data.materiaux) {
      const materiau = { classe: m.iso, groupe: m.groupe, materiau: m.materiau, etat: m.etat };
      assert.equal(linesOf({ outil: 'MCLNR', materiau }, n), before(materialText(materiau), materialColumnWidth(n)), `${n} grandeur(s) : ${m.materiau}, ${m.etat}`);
      compared += 1;
    }
  }
  for (const name of NOMS) {
    assert.equal(linesOf({ outil: name, materiau: { classe: 'P', groupe: 1, materiau: 'Acier', etat: null } }, 2), before(name, 180), name);
    compared += 1;
  }
  assert.ok(compared > 500, `${compared} textes comparés`);
});

// --- La coupe entre les pages (D41, D43, D85) ---------------------------------------------------------------------------

const TOOL = { operation: 'Perçage', outil: 'Foret', plage: 'Ø 1/16 po à Ø 1 po', reussites: '1 / 1' };
const tools = (count) => Array.from({ length: count }, (_, i) => ({ ...TOOL, outil: `Foret ${i + 1}` }));
const rowsOf = (count, lines = 1) => Array.from({ length: count }, (_, i) => ({ numero: String(i + 1), lines }));
const counts = (pages) => pages.map((page) => [page.tools.length, page.questions.length]);

// La coupe d'avant D85, gardée ici comme témoin : la liste des questions seule ; le tableau par outil, d'un bloc en page 1.
function paginateBefore(rows, toolCount, layout = PAGE_LAYOUT) {
  const pages = [[]];
  let free = layout.firstPageFree - layout.toolRow * toolCount;
  for (const row of rows) {
    const height = rowHeight(row, layout);
    if (height > free && pages.at(-1).length > 0) { pages.push([]); free = layout.nextPageFree; }
    if (height > free && pages.length === 1) { pages.push([]); free = layout.nextPageFree; }
    pages.at(-1).push(row);
    free -= height;
  }
  return pages;
}

test('paginateAttestation : la place de la page 1 se partage entre le tableau par outil et les questions, en pixels ; un rang de deux lignes compte double ; jamais coupé entre deux pages', () => {
  const rows = rowsOf(22);
  const layout = { ...PAGE_LAYOUT, firstPageFree: 400, nextPageFree: 300, toolRow: 20, rowBase: 7, line: 13 };
  const pages = paginateAttestation(tools(11), rows, 2, layout);
  assert.deepEqual(counts(pages), [[11, 9], [0, 13]]); // (400 − 11 × 20) / 20 = 9
  assert.deepEqual(pages.flatMap((page) => page.questions), rows); // rien de perdu, rien en double, dans l'ordre
  assert.deepEqual(pages.map((page) => [page.note, page.title]), [[true, true], [false, false]]); // la note et le titre de la liste, en page 1
  assert.deepEqual(counts(paginateAttestation(tools(3), rows, 2, { ...layout, firstPageFree: 500 })), [[3, 22]]); // tout tient
  // Des rangs de deux lignes (33 px) : ils prennent leur place, et un rang qui ne tient pas passe entier à la page suivante.
  assert.deepEqual(counts(paginateAttestation(tools(11), rowsOf(22, 2), 2, layout)), [[11, 5], [0, 9], [0, 8]]); // 180 / 33 = 5 ; 300 / 33 = 9
  // Un enregistrement figé avant D41 n'a pas de questions : le tableau par outil, sa note, pas de titre de liste.
  assert.deepEqual(paginateAttestation(tools(9), []), [{ tools: tools(9), note: true, title: false, questions: [] }]);
  // Les vraies capacités, mesurées dans Chrome : « Vc et RPM » (11 outils, 22 questions) et le M10 (9 outils, 15) tiennent sur deux pages.
  // Avant le recalibrage de la page 1 (D85, point 6) : 9 et 13, 12 et 3 — et le pied de la page 1 pouvait sortir de la zone imprimable.
  assert.deepEqual(counts(paginateAttestation(tools(11), rows, 2)), [[11, 7], [0, 15]]); // (420 − 11 × 24) / 20 = 7,8
  assert.deepEqual(counts(paginateAttestation(tools(9), rows.slice(0, 15), 1)), [[9, 10], [0, 5]]); // (420 − 9 × 24) / 20 = 10,2
  assert.ok(PAGE_LAYOUT.nextPageFree / rowHeight(rows[0]) >= 22);
});

test('la place de la page 1 (D85, point 6) : ce que la page porte ne dépasse jamais ce qui a été mesuré dans Chrome, pied de page compris', () => {
  // Mesuré sur la page lettre, en mode impression : du bas du titre « Opérations effectuées » au bas de la zone imprimable,
  // 593,6 px ; le pied et sa marge, 25,5 px. Les blocs, tels que mesurés (le modèle les arrondit vers le haut) :
  const REAL = { zone: 593.6 - 25.5, toolsHead: 36.3, toolRow: 23.8, note: 39, questionsTitle: 37.9, questionsHead: 32, narrowHead: 45 };
  const random = aleaAGraine(856);
  for (let trial = 0; trial < 600; trial += 1) {
    const answerColumns = 1 + Math.floor(random() * 5);
    const floor = answerColumns >= 4 ? 2 : 1; // en largeurs resserrées, deux lignes au moins
    const rows = Array.from({ length: Math.floor(random() * 50) }, (_, i) => ({ numero: String(i + 1), lines: floor + Math.floor(random() * 2) }));
    const [first] = paginateAttestation(tools(1 + Math.floor(random() * 40)), rows, answerColumns);
    const used = REAL.toolsHead + REAL.toolRow * first.tools.length + (first.note ? REAL.note : 0) + (first.title ? REAL.questionsTitle : 0)
      + (first.questions.length > 0 ? (answerColumns >= 4 ? REAL.narrowHead : REAL.questionsHead) + first.questions.reduce((sum, row) => sum + rowHeight(row), 0) : 0);
    assert.ok(used <= REAL.zone, `${first.tools.length} outils, ${first.questions.length} questions, ${answerColumns} grandeurs : ${used.toFixed(1)} px pour ${REAL.zone.toFixed(1)}`);
  }
});

test('non-régression (D85) : tant que le tableau par outil tient en page 1, la liste des questions se coupe exactement comme avant', () => {
  const random = aleaAGraine(85);
  let compared = 0;
  for (let toolCount = 1; toolCount <= 18; toolCount += 1) {
    for (let trial = 0; trial < 40; trial += 1) {
      const rows = Array.from({ length: Math.floor(random() * 70) }, (_, i) => ({ numero: String(i + 1), lines: 1 + Math.floor(random() * 3) }));
      const pages = paginateAttestation(tools(toolCount), rows, 2);
      assert.deepEqual(pages.map((page) => page.questions), paginateBefore(rows, toolCount), `${toolCount} outils, ${rows.length} questions`);
      assert.deepEqual(counts(pages).map(([t]) => t), [toolCount, ...Array(pages.length - 1).fill(0)]); // tout le tableau par outil en page 1
      assert.deepEqual([pages[0].note, pages[0].title], [true, rows.length > 0]);
      compared += 1;
    }
  }
  assert.equal(compared, 720);
});

test('paginateAttestation (D85) : le tableau par outil se poursuit sur la page suivante ; la note reste sous son dernier rang ; la liste des questions vient ensuite', () => {
  const rows = rowsOf(37, 2);
  const pages = paginateAttestation(tools(35), rows, 5);
  // Rien de perdu, rien en double, dans l'ordre — pour les deux tableaux.
  assert.deepEqual(pages.flatMap((page) => page.tools), tools(35));
  assert.deepEqual(pages.flatMap((page) => page.questions), rows);
  assert.ok(pages[0].tools.length < 35 && pages[1].tools.length > 0, JSON.stringify(counts(pages)));
  assert.equal(pages[0].tools.length + pages[1].tools.length, 35);
  // La note : une seule, sur la page du dernier rang du tableau par outil ; le titre de la liste : un seul, après elle.
  assert.deepEqual(pages.map((page) => page.note), pages.map((_, i) => i === 1));
  assert.deepEqual(pages.map((page) => page.title), pages.map((_, i) => i === 1));
  assert.equal(pages[0].questions.length, 0);
  // Chaque page tient dans sa place : ce qu'elle porte, en pixels, contre ce que la page offre sous son premier titre.
  const L = PAGE_LAYOUT;
  const head = L.questionsHead + L.line; // cinq grandeurs : l'en-tête des questions sur deux lignes
  pages.forEach((page, i) => {
    const room = i === 0 ? L.firstPageFree + L.toolsHead + L.note + L.questionsTitle + L.questionsHead : L.nextPageFree + L.questionsHead;
    const midTitle = page.title && page.tools.length > 0 ? L.questionsTitle : 0; // en tête de page, le titre est déjà compté
    const used = (page.tools.length > 0 ? L.toolsHead + L.toolRow * page.tools.length : 0) + (page.note ? L.note : 0) + midTitle
      + (page.questions.length > 0 ? head + page.questions.reduce((sum, row) => sum + rowHeight(row), 0) : 0);
    assert.ok(used <= room, `page ${i + 1} : ${used} px pour ${room}`);
  });
});

test('paginateAttestation (D85) : cas limites — le dernier rang du tableau par outil passe à la page suivante avec la note ; le titre de la liste en tête de page ; une page neuve prend toujours son premier rang', () => {
  // 100 px sous le titre en page 1 : l'en-tête (20) et trois rangs (3 × 20) tiennent, mais pas la note (30) sous le troisième.
  const layout = { ...PAGE_LAYOUT, firstPageFree: 0, nextPageFree: 100, toolRow: 20, toolsHead: 20, note: 30, questionsTitle: 25, questionsHead: 25, rowBase: 7, line: 13 };
  assert.deepEqual(layout.firstPageFree + layout.toolsHead + layout.note + layout.questionsTitle + layout.questionsHead, 100);
  const split = paginateAttestation(tools(3), [], 0, layout);
  assert.deepEqual(counts(split), [[2, 0], [1, 0]]);
  assert.deepEqual(split.map((page) => page.note), [false, true]);
  // Deux outils et la note : il reste 10 px, le titre de la liste (25) passe en tête de la page suivante, avec ses rangs.
  const titled = paginateAttestation(tools(2), rowsOf(3), 2, layout);
  assert.deepEqual(counts(titled), [[2, 0], [0, 3]]);
  assert.deepEqual(titled.map((page) => [page.note, page.title]), [[true, false], [false, true]]);
  // Un outil et la note : le titre tient (25 px sur 30), mais pas un rang ; la liste commence à la page suivante.
  const alone = paginateAttestation(tools(1), rowsOf(3), 2, layout);
  assert.deepEqual(counts(alone), [[1, 0], [0, 3]]);
  assert.deepEqual(alone.map((page) => page.title), [true, false]);
  // Un rang plus haut qu'une page : il est posé quand même, seul sur sa page.
  const tall = paginateAttestation(tools(1), [{ numero: '1', lines: 20 }, { numero: '2', lines: 1 }], 2, layout);
  assert.deepEqual(counts(tall), [[1, 0], [0, 1], [0, 1]]);
  // En largeurs resserrées, l'en-tête des questions a une ligne de plus : 130 px sous le titre, cinq rangs de 20 px à deux grandeurs, quatre à cinq.
  const roomy = { ...layout, nextPageFree: 105 };
  assert.deepEqual(counts(paginateAttestation(tools(1), rowsOf(8), 2, roomy)), [[1, 0], [0, 5], [0, 3]]);
  assert.deepEqual(counts(paginateAttestation(tools(1), rowsOf(8), 5, roomy)), [[1, 0], [0, 4], [0, 4]]);
});

test('tableTitles (D85) : « (suite) » après la première page d’un tableau, « — suite à la page suivante » tant qu’il n’est pas fini', () => {
  const page = (toolCount, questionCount, title = false) => ({ tools: tools(toolCount), note: false, title, questions: rowsOf(questionCount) });
  // Comme avant D85 : le tableau par outil en page 1, la liste sur trois pages.
  assert.deepEqual(tableTitles([page(13, 4, true), page(0, 27), page(0, 5)], 36), [
    { tools: 'Opérations effectuées', questions: 'Questions réussies qui comptent (36) — suite à la page suivante' },
    { tools: null, questions: 'Questions réussies qui comptent (suite) — suite à la page suivante' },
    { tools: null, questions: 'Questions réussies qui comptent (suite)' },
  ]);
  assert.deepEqual(tableTitles([page(9, 15, true)], 15), [{ tools: 'Opérations effectuées', questions: 'Questions réussies qui comptent (15)' }]);
  // Le titre de la liste seul au bas de la page 1 : la liste commence à la page suivante.
  assert.deepEqual(tableTitles([page(18, 0, true), page(0, 22)], 22).map((t) => t.questions), ['Questions réussies qui comptent (22) — suite à la page suivante', 'Questions réussies qui comptent (suite)']);
  // Le tableau par outil sur deux pages, la liste à sa suite.
  assert.deepEqual(tableTitles([page(22, 0), page(13, 10, true), page(0, 27)], 37), [
    { tools: 'Opérations effectuées — suite à la page suivante', questions: null },
    { tools: 'Opérations effectuées (suite)', questions: 'Questions réussies qui comptent (37) — suite à la page suivante' },
    { tools: null, questions: 'Questions réussies qui comptent (suite)' },
  ]);
  // Sans liste de questions (enregistrement figé avant D41).
  assert.deepEqual(tableTitles([page(9, 0)], 0), [{ tools: 'Opérations effectuées', questions: null }]);
});

test('pageLabel et continuationLine : « Page 2 de 3 » ; le rappel en tête d’une page de suite', () => {
  assert.equal(pageLabel(1, 1), 'Page 1 de 1');
  assert.equal(pageLabel(2, 3), 'Page 2 de 3');
  assert.equal(continuationLine(RECORD, 'ABCDE-FGHJK'), "Attestation de réussite — Zoé D'Amours Lévesque · 2412345 · code ABCDE-FGHJK (suite)");
});

test('mention de vérification, pied de page, nom du fichier PDF', () => {
  assert.equal(verificationMention('quiz.example', 'ABCDE-FGHJK'), 'Vérification : quiz.example/verifier — code ABCDE-FGHJK');
  assert.equal(attestationFooter(RECORD), 'TGM-TMI — TLP — 2026');
  assert.equal(attestationFileName(RECORD), 'Attestation-m10-tournage-vc-D-Amours-Levesque-Zoe');
});

test('verificationOutcome : quatre issues, ton et texte ; l’annulation donne la date', () => {
  assert.equal(verificationOutcome({ resultat: 'valide' }).title, 'Attestation valide');
  assert.equal(verificationOutcome({ resultat: 'valide' }).tone, 'correct');
  assert.equal(verificationOutcome({ resultat: 'aucune' }).title, 'Aucune attestation ne correspond');
  assert.equal(verificationOutcome({ resultat: 'invalide' }).title, 'Signature invalide ou contenu modifié');
  assert.equal(verificationOutcome({ resultat: 'invalide' }).tone, 'wrong');
  const annulee = verificationOutcome({ resultat: 'annulee', annulee_le: REUSSITE.toISOString(), motif: 'remise_a_zero' });
  assert.equal(annulee.title, 'Attestation annulée');
  assert.match(annulee.text, /le 2026-09-21 13:48 : séance remise à zéro/);
  assert.match(verificationOutcome({ resultat: 'annulee', annulee_le: REUSSITE.toISOString(), motif: 'identite_corrigee' }).text, /identité corrigée .* autre code/);
  assert.match(verificationOutcome({ resultat: 'annulee', annulee_le: REUSSITE.toISOString(), motif: 'seance_supprimee' }).text, /le 2026-09-21 13:48 : séance supprimée par l'enseignant/);
  assert.match(verificationOutcome({ resultat: 'annulee' }).text, /motif inconnu/);
  assert.equal(verificationOutcome({ resultat: 'autre' }).tone, 'wrong');
});

test('qrModules : la bibliothèque vendorisée encode une adresse de vérification en un QR carré, avec sa marge de 4 modules', () => {
  const url = 'https://quiz-parametres-coupe.tgm-tmi.workers.dev/verifier?exercice=m10-tournage-vc&matricule=2412345&nom=Tremblay&prenom=Camille'
    + '&reussite=2026-09-21T13%3A48%3A10.000Z&revision=r0&questions=17&code=ABCDE-FGHJK&signature=' + 'a'.repeat(43);
  const { count, size, path } = qrModules(url);
  assert.ok(count >= 21 && count <= 177 && (count - 21) % 4 === 0, `${count} modules`); // une version de QR : 21, 25, 29…
  assert.equal(size, count + 8);
  assert.match(path, /^(M\d+ \d+h1v1h-1z)+$/);
  // Le motif de repérage en haut à gauche : ses 7 premiers modules sont sombres.
  for (let col = 4; col < 11; col += 1) assert.ok(path.includes(`M${col} 4h1v1h-1z`), `module ${col}`);
  assert.ok(count <= 77, `${count} modules : une version ≤ 14 se lit sur une attestation imprimée`);
  assert.notEqual(qrModules(`${url}x`).path, path);
});
