// Tests de site/js/ui/attestation-data.js (ce que montrent l'attestation et la vérification) et de
// la partie pure de site/js/ui/qr.js (la bibliothèque vendorisée encode l'adresse de vérification).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE_LAYOUT, attestationFacts, materialColumnWidth, rowHeight, attestationFileName, attestationFooter, attestationRows, continuationLine, hasQuestions,
  materialText, pageLabel, paginateQuestions, questionColumns, questionRows, tablesRevision, verificationMention, verificationOutcome,
} from '../site/js/ui/attestation-data.js';
import { qrModules } from '../site/js/ui/qr.js';
import { formatDateStamp } from '../site/js/ui/text.js';

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

test('attestationFacts : le bloc d’informations, dans l’ordre, dates mises en forme, matricule en chasse fixe', () => {
  assert.deepEqual(attestationFacts(RECORD), [
    { label: 'Exercice', value: 'M10 — Tournage : vitesse de coupe' },
    { label: "Version de l'exercice", value: 'r0' },
    { label: 'Révision des tables', value: 'A2026_r0' },
    { label: 'Prénom', value: 'Zoé' },
    { label: 'Nom', value: "D'Amours Lévesque" },
    { label: 'Matricule', value: '2412345', mono: true },
    { label: "Début de l'exercice", value: '2026-09-21 13:05' },
    { label: "Réussite de l'exercice", value: '2026-09-21 13:48' },
    { label: 'Questions réussies', value: '15' },
  ]);
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
  assert.deepEqual(questionColumns(AVEC_LISTE), [{ key: 'vc', label: 'Vc (pi/min)' }, { key: 'rpm', label: 'N (rév/min)' }]);
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
  // Avec cinq grandeurs évaluées (test-complet), la colonne du matériau ne fait plus que 24 px : beaucoup de lignes, rien de perdu.
  const cinq = { ...QUESTIONS[1], reponses: { vc: '1', feedPerTooth: '1', rpm: '1', feedPerRev: '1', feedRate: '1' } };
  assert.ok(questionRows({ ...RECORD, questions: [cinq] })[0].lines >= 5);
  // Un nom d'outil long compte aussi.
  const fraise = { ...QUESTIONS[1], outil: 'Fraise à chanfreiner 82 degrés - Ø 5/16 po - 3 lèvre(s)' }; // 55 caractères, colonne de 180 px
  assert.equal(questionRows({ ...RECORD, questions: [fraise] })[0].lines, 2);
});

test('paginateQuestions : la place de la page 1 se partage entre le tableau par outil et les questions, en pixels ; un rang de deux lignes compte double ; jamais coupé entre deux pages', () => {
  const rows = Array.from({ length: 22 }, (_, i) => ({ numero: String(i + 1), lines: 1 }));
  const layout = { ...PAGE_LAYOUT, firstPageFree: 400, nextPageFree: 300, toolRow: 20, rowBase: 7, line: 13 };
  const pages = paginateQuestions(rows, 11, layout);
  assert.deepEqual(pages.map((page) => page.length), [9, 13]); // (400 − 11 × 20) / 20 = 9
  assert.deepEqual(pages.flat(), rows); // rien de perdu, rien en double, dans l'ordre
  assert.deepEqual(paginateQuestions(rows, 3, { ...layout, firstPageFree: 500 }).map((page) => page.length), [22]); // tout tient
  assert.deepEqual(paginateQuestions(rows, 25, { ...layout, nextPageFree: 200 }).map((page) => page.length), [0, 10, 10, 2]); // trop d'outils : la liste commence page 2
  assert.deepEqual(paginateQuestions([], 9), [[]]);
  // Des rangs de deux lignes (33 px) : ils prennent leur place, et un rang qui ne tient pas passe entier à la page suivante.
  const doubles = rows.map((row) => ({ ...row, lines: 2 }));
  assert.deepEqual(paginateQuestions(doubles, 11, layout).map((page) => page.length), [5, 9, 8]); // 180 / 33 = 5 ; 300 / 33 = 9
  // Les vraies capacités, mesurées dans Chrome : « Vc et RPM » (11 outils, 22 questions) et le M10 (9 outils, 15) tiennent sur deux pages.
  assert.deepEqual(paginateQuestions(rows, 11).map((page) => page.length), [9, 13]);
  assert.deepEqual(paginateQuestions(rows.slice(0, 15), 9).map((page) => page.length), [12, 3]);
  assert.ok(PAGE_LAYOUT.nextPageFree / rowHeight(rows[0]) >= 22);
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
  assert.match(verificationOutcome({ resultat: 'annulee' }).text, /motif inconnu/);
  assert.equal(verificationOutcome({ resultat: 'autre' }).tone, 'wrong');
});

test('qrModules : la bibliothèque vendorisée encode une adresse de vérification en un QR carré, avec sa marge de 4 modules', () => {
  const url = 'https://quiz-parametres-coupe.exemple.workers.dev/verifier?exercice=m10-tournage-vc&matricule=2412345&nom=Tremblay&prenom=Camille'
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
