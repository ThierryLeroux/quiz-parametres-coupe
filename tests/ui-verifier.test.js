// La page de vérification (/verifier, UI §3.7, décision D90) rend les deux tableaux de l'attestation en fiches
// « libellé : valeur » (attestation.css, sous .verify-result) : pour cela, chaque cellule porte le texte de l'en-tête
// de sa colonne (data-label), posé par attestation-screen.js. Les tableaux sont construits sur le DOM minuscule de
// aide-dom.js et c'est ce DOM qu'on regarde ; la mise en page, elle, se vérifie dans Chrome (rapport verifier-fiches).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDom } from './aide-dom.js';
import { questionColumns, questionRows } from '../site/js/ui/attestation-data.js';
import { operationsTable, questionsTable } from '../site/js/ui/attestation-screen.js';

installDom({ url: 'http://localhost/verifier' });

const Q = (numero, reponses, horodatage) => ({
  numero,
  outil_id: 'mclnr',
  outil: 'MCLNR - Ø charioté: 10 mm',
  materiau_outil: 'Insert de carbure de tungstène',
  materiau: { classe: 'P', groupe: 1, materiau: 'Acier non allié', etat: 'Recuit' },
  reponses,
  horodatage,
});
const RECORD = {
  code: 'ABCDEFGHJK',
  exercice: { id: 'm10-tournage-vc-rpm', titre: 'M10 — Tournage : Vc et RPM' },
  revision: 'r0',
  revision_tables: { materiaux: 'A2026_r0', operations: 'A2026_r0' },
  etudiant: { prenom: 'Zoé', nom: 'Lévesque', matricule: '2412345' },
  debut: '2026-09-21T17:05:07.000Z',
  reussite_le: '2026-09-21T17:48:10.000Z',
  questions_reussies: 2,
  outils: [
    { id: 'mclnr', nom: 'MCLNR', plage: '10 mm à 20 mm', operation: 'Chariotage ébauche', reussites: 1, requises: 1 },
    { id: 'mvlnr', nom: 'MVLNR', plage: '1.000" à 4.000"', operation: 'Chariotage finition', reussites: 3, requises: 3 },
  ],
  questions: [Q(1, { vc: '300', rpm: '1385' }, '2026-09-21T17:40:59.000Z'), Q(2, { vc: '400', rpm: '800' }, '2026-09-21T17:48:10.000Z')],
};
const CINQ = { ...RECORD, questions: [Q(1, { vc: '165', feedPerTooth: '0.000938', rpm: '10000', feedPerRev: '0.000984', feedRate: '166.667' }, '2026-09-21T17:40:59.000Z')] };

// Les en-têtes d'un tableau, dans l'ordre, tels que le texte les donne (en largeurs resserrées, les deux lignes d'un
// en-tête sont deux <span> séparés d'une espace : le texte est le même).
const headers = (table) => table.querySelectorAll('thead th').map((th) => th.textContent);
const rows = (table) => table.querySelectorAll('tbody tr');

test('operationsTable : chaque cellule porte le texte de l’en-tête de sa colonne ; la classe attestation-operations nomme le tableau', () => {
  const table = operationsTable(RECORD);
  assert.ok(table.classList.contains('attestation-table') && table.classList.contains('attestation-operations'));
  assert.deepEqual(headers(table), ['Opération', 'Outil', 'Plage de dimensions', 'Réussites de suite']);
  const lines = rows(table);
  assert.equal(lines.length, 2);
  for (const tr of lines) {
    assert.deepEqual(tr.children.map((td) => td.getAttribute('data-label')), headers(table));
    assert.deepEqual(tr.children.map((td) => td.tagName), ['TD', 'TD', 'TD', 'TD']);
  }
  assert.deepEqual(lines[1].children.map((td) => td.textContent), ['Chariotage finition', 'MVLNR', '1.000" à 4.000"', '3 / 3']);
  assert.equal(lines[1].children[3].className, 'num'); // les réussites restent un nombre (chasse fixe, à droite)
});

test('questionsTable : chaque cellule porte le texte de l’en-tête de sa colonne, à deux et à cinq grandeurs, en largeurs ordinaires et resserrées', () => {
  for (const [record, narrow] of [[RECORD, false], [RECORD, true], [CINQ, false], [CINQ, true]]) {
    const table = questionsTable(record, questionRows(record), narrow);
    const expected = ['N°', 'Outil', "Matière d'outil", 'Matériau usiné', ...questionColumns(record).map((column) => column.label), 'Date et heure'];
    assert.deepEqual(headers(table), expected, `en-têtes, ${narrow ? 'resserré' : 'ordinaire'}`);
    assert.equal(table.classList.contains('attestation-questions--narrow'), narrow);
    const lines = rows(table);
    assert.equal(lines.length, record.questions.length);
    for (const tr of lines) {
      assert.deepEqual(tr.children.map((td) => td.getAttribute('data-label')), expected, `data-label, ${narrow ? 'resserré' : 'ordinaire'}`);
      // Les classes qui placent les cellules dans la fiche : le N° et les grandeurs sont des nombres, la date est le cachet.
      assert.equal(tr.children[0].className, 'num');
      assert.equal(tr.children.at(-1).className, 'stamp');
      for (const td of tr.children.slice(4, -1)) assert.equal(td.className, 'num');
    }
  }
  // À cinq grandeurs : les libellés des grandeurs, dans l'ordre du calcul, avec leur unité, devant chaque valeur.
  const [line] = rows(questionsTable(CINQ));
  assert.deepEqual(line.children.slice(4, -1).map((td) => [td.getAttribute('data-label'), td.textContent]), [
    ['Vc (pi/min)', '165'], ['fz (po/dent)', '0.000938'], ['N (tr/min)', '10000'], ['f (po/rév)', '0.000984'], ['Vf (po/min)', '166.667'],
  ]);
  assert.equal(line.children[0].textContent, '1');
  assert.equal(line.children.at(-1).getAttribute('data-label'), 'Date et heure');
});

test('attestation.css : les fiches de /verifier lisent data-label sous .verify-result seulement ; la page lettre n’en fait rien', () => {
  const css = readFileSync(new URL('../site/css/attestation.css', import.meta.url), 'utf8');
  // Chaque règle qui lit l'attribut est sous .verify-result : rien ne s'affiche sur la page lettre de l'attestation.
  const readers = css.split('}').filter((rule) => rule.includes('attr(data-label)')).map((rule) => rule.slice(0, rule.indexOf('{')).trim());
  assert.deepEqual(readers, ['.verify-result .attestation-questions td::before', '.verify-result .attestation-operations td::before']); // les questions, et le tableau par outil sous 480 px
  // Les questions : toujours en fiches (tbody en grille de fiches, tr en grille à deux colonnes, td en ligne « libellé : valeur »).
  assert.match(css, /\.verify-result \.attestation-questions tbody \{\n  display: grid;\n  grid-template-columns: repeat\(auto-fill, minmax\(260px, 1fr\)\);/);
  assert.match(css, /\.verify-result \.attestation-questions tr \{\n  display: grid;\n  grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.verify-result \.attestation-questions td \{\n  display: flex;/);
  assert.match(css, /\.verify-result \.attestation-questions td::before \{\n  content: attr\(data-label\);/);
  assert.match(css, /\.verify-result \.attestation-questions td:first-child::before \{ content: 'Question';/);
  assert.match(css, /\.verify-result \.attestation-questions td\.stamp::before \{ content: none; \}/);
  assert.match(css, /\.verify-result \.attestation-questions td\.num:not\(:first-child\) \{ grid-column: auto;/);
  // L'en-tête reste dans le DOM, caché à l'œil (1 × 1 px, rogné), pour les lecteurs d'écran.
  assert.match(css, /\.verify-result \.attestation-questions thead \{\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n  clip-path: inset\(50%\);/);
  // Le tableau par outil : en fiches sous 480 px seulement.
  const mobile = css.slice(css.indexOf('@media (max-width: 480px)'), css.indexOf('@media print'));
  assert.match(mobile, /\.verify-result \.attestation-operations td::before \{\n    content: attr\(data-label\);/);
  assert.match(mobile, /\.verify-result \.attestation-operations thead \{\n    position: absolute;/);
  assert.doesNotMatch(css.slice(0, css.indexOf('@media (max-width: 480px)')), /attestation-operations/);
  // Un texte se replie entre les mots dans les fiches (overflow-wrap: anywhere est la règle de la page lettre).
  assert.equal((css.match(/overflow-wrap: normal;/g) ?? []).length, 2);
});
