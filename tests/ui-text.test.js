// Tests de site/js/ui/text.js : textes des écrans composés à partir des données, sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEPARTMENT_LINES, DEPARTMENT_SHORT, FIELD_LABELS, FIELD_PARTS, coherenceSource, correctionBanner, decimalPoint, decimalPointInValues, fieldInSentence, newSessionNotice, sessionFoundNotice, exerciseMeta, exerciseSummary, fieldResultNote, formatDateTime, identificationErrorMessage,
  computedNote, expressionLine, localDate, serverErrorMessage, sheetSignature, studentLine, typedNumber, unreadableNote,
} from '../site/js/ui/text.js';
import { loadExercise } from '../site/js/exercice.js';
import { ApiError } from '../site/js/api.js';
import { data, lireFichier } from './aide.js';

const m10 = await loadExercise('m10-tournage-vc', data, 'exercices/', lireFichier);

const CINQ_CHAMPS = {
  id: 'essai',
  titre: 'Essai',
  version: 'r1',
  champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'],
  outils: [{ id: 'mvlnr', reussites_requises: 2 }],
};

const DEBUT = new Date(2026, 8, 19, 13, 5); // heure du poste : le texte affiché ne dépend pas du fuseau du test

test('newSessionNotice (D23, D93) : le matricule, à vérifier ; il sera inscrit sur l’attestation', () => {
  assert.equal(newSessionNotice('7654321'), 'Nouveau matricule : 7654321. Vérifie-le bien. Il sera inscrit sur ton attestation et te permettra de continuer sur un autre appareil.');
  assert.equal(sessionFoundNotice('Romain', 'L'), 'Séance de Romain L. trouvée. Entre ton NIP pour la reprendre.');
});

test('le département : trois lignes, les mêmes dans le pied de index.html ; le sigle TGM-TMI, et plus aucun « TGM » seul affiché (D29)', async () => {
  assert.deepEqual(DEPARTMENT_LINES, ['Techniques de génie mécanique', 'Technique du génie de la maintenance industrielle', '(fiabilité des systèmes de production)']);
  assert.equal(DEPARTMENT_SHORT, 'TGM-TMI');
  const page = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
  for (const line of DEPARTMENT_LINES) assert.ok(page.includes(`<div>${line}</div>`), line);
  assert.ok(page.includes('TGM-TMI'));
  assert.doesNotMatch(page.replaceAll('TGM-TMI', ''), /TGM/);
});

test('sheetSignature : « TGM-TMI — TLP — <année> » au pied des feuilles et de l’attestation (D30)', () => {
  assert.equal(sheetSignature(new Date('2026-09-21T12:00:00')), 'TGM-TMI — TLP — 2026');
  assert.match(sheetSignature(), /^TGM-TMI — TLP — \d{4}$/);
});

test('localDate : la date du poste, « AAAA-MM-JJ », jamais celle d’UTC', () => {
  assert.equal(localDate(new Date(2026, 8, 21, 23, 30)), '2026-09-21');
  assert.equal(localDate(new Date(2026, 0, 5, 0, 5)), '2026-01-05');
});

test('exerciseMeta : version, nombre d’outils, champs évalués', () => {
  assert.equal(exerciseMeta(m10), 'version r0 · 9 outils · champ évalué : vitesse de coupe');
  assert.equal(exerciseMeta(CINQ_CHAMPS), "version r1 · 1 outil · champs évalués : vitesse de coupe, avance par dent, vitesse de rotation, avance totale par révolution, vitesse d'avance");
});

test('exerciseSummary : trois phrases ; N vient de reussites_requises', () => {
  // M10 : de 1 à 3 réussites selon l'outil → « plusieurs fois de suite »
  assert.deepEqual(exerciseSummary(m10), [
    'Chaque outil doit être réussi plusieurs fois de suite.',
    'Une mauvaise réponse remet le compteur de cet outil à zéro.',
    'À la fin, enregistre ton attestation en PDF et remets-la sur Léa.',
  ]);
  assert.equal(exerciseSummary(CINQ_CHAMPS)[0], 'Chaque outil doit être réussi 2 fois de suite.');

  const troisPartout = { ...CINQ_CHAMPS, outils: [{ id: 'mvlnr', reussites_requises: 3 }, { id: 'mclnr', reussites_requises: 3 }] };
  assert.equal(exerciseSummary(troisPartout)[0], 'Chaque outil doit être réussi 3 fois de suite.');
  const varie = { ...CINQ_CHAMPS, outils: [{ id: 'mvlnr', reussites_requises: 3 }, { id: 'mclnr', reussites_requises: 2 }] };
  assert.equal(exerciseSummary(varie)[0], 'Chaque outil doit être réussi plusieurs fois de suite.');
  const uneFois = { ...CINQ_CHAMPS, outils: [{ id: 'mvlnr', reussites_requises: 1 }] };
  assert.equal(exerciseSummary(uneFois)[0], 'Chaque outil doit être réussi une fois.');
});

test('formatDateTime : date et heure du poste, en français', () => {
  assert.equal(formatDateTime(DEBUT.toISOString()), '19 sept. 2026, 13 h 05');
  assert.equal(formatDateTime(new Date(2027, 0, 4, 8, 30).toISOString()), '4 janv. 2027, 8 h 30');
});

test('serverErrorMessage : serveur injoignable ; sinon le message du serveur', () => {
  assert.equal(serverErrorMessage(new ApiError(429, 'Attends encore 6 s avant de faire corriger ta réponse.')), 'Attends encore 6 s avant de faire corriger ta réponse.');
  assert.equal(serverErrorMessage(new ApiError(0, 'Le site ne répond pas.')), 'Le site ne répond pas. Vérifie ta connexion, puis réessaie.'); // D93 : jamais « serveur »
  assert.equal(serverErrorMessage(new TypeError('imprévu')), 'Le site ne répond pas. Vérifie ta connexion, puis réessaie.');
  assert.equal(serverErrorMessage(new ApiError(500, 'Une erreur est survenue.')), 'Une erreur est survenue.');
});

test('identificationErrorMessage : matricule invalide, NIP incorrect, trop d’essais (UI §3.2)', () => {
  assert.equal(identificationErrorMessage(new ApiError(400, 'Le matricule doit avoir exactement 7 chiffres.')), 'Le matricule doit avoir exactement 7 chiffres.');
  assert.equal(identificationErrorMessage(new ApiError(401, 'NIP incorrect.')), "NIP incorrect. Si tu l'as oublié, demande à ton enseignant de le remettre à zéro.");
  assert.equal(identificationErrorMessage(new ApiError(429, "Trop d'essais.")), "Trop d'essais. Attends 10 minutes avant de réessayer.");
  assert.equal(identificationErrorMessage(new ApiError(409, 'Ce matricule a déjà une séance pour cet exercice.')), 'Ce matricule a déjà une séance.');
  assert.equal(identificationErrorMessage(new ApiError(404, 'Aucune séance pour ce matricule dans cet exercice.')), 'Aucune séance pour ce matricule dans cet exercice.');
  assert.equal(identificationErrorMessage(new ApiError(0, '…')), 'Le site ne répond pas. Vérifie ta connexion, puis réessaie.');
});

// --- Écran Question : ce que renvoie le serveur, mis en mots --------------------------------------------

test('FIELD_LABELS : nom, symbole et unité des cinq champs (UI §3.3)', () => {
  assert.deepEqual(Object.keys(FIELD_LABELS), ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate']);
  assert.equal(FIELD_LABELS.rpm, 'Vitesse de rotation (N, tr/min)'); // D71 : plus de « RPM » ni de « rév/min »
  for (const label of Object.values(FIELD_LABELS)) assert.doesNotMatch(label, /RPM|rév\/min/);
  for (const [champ, { name, symbol, unit }] of Object.entries(FIELD_PARTS)) assert.equal(`${name} (${symbol}, ${unit})`, FIELD_LABELS[champ]);
});

test('fieldResultNote : Juste, Juste (… attendu), Faux — attendu …, donné (UI §3.4 ; D93)', () => {
  assert.equal(fieldResultNote({ evalue: true, ok: true, saisie: '2496', attendu: '2496' }), 'Juste');
  assert.equal(fieldResultNote({ evalue: true, ok: true, saisie: ' 0,0050 ', attendu: '0.0050' }), 'Juste');
  assert.equal(fieldResultNote({ evalue: true, ok: true, saisie: '2500', attendu: '2496' }), 'Juste (2496 attendu)');
  assert.equal(fieldResultNote({ evalue: true, ok: false, saisie: '', attendu: '12.500' }), 'Faux — attendu 12.500');
  assert.equal(fieldResultNote({ evalue: false, ok: true, saisie: '', attendu: '12.500' }), 'donné');
  assert.equal(fieldResultNote({ evalue: false, masque: true, ok: true, saisie: '', attendu: null }), 'non demandée'); // D52
});

test('fieldResultNote (D70, D71) : une valeur attendue faite des saisies le dit, en toutes lettres — « = ton avance par dent × 2 »', () => {
  const f = { champ: 'feedPerRev', evalue: true, ok: true, saisie: '0.000283', attendu: '0.000284', coherence: { saisies: ['fz'], dents: 2 } };
  assert.equal(fieldResultNote(f), 'Juste (0.000284 = ton avance par dent × 2)');
  const vf = { champ: 'feedRate', evalue: true, ok: true, saisie: '3048', attendu: '3048.000', coherence: { saisies: ['n', 'f'] } };
  assert.equal(fieldResultNote(vf), 'Juste (3048.000 = ta vitesse de rotation × ton avance totale par révolution)');
  // Un seul des deux facteurs de Vf est le sien (l'autre fourni, masqué, vide ou illisible).
  assert.equal(fieldResultNote({ ...vf, coherence: { saisies: ['f'] } }), 'Juste (3048.000 = la vitesse de rotation × ton avance totale par révolution)');
  assert.equal(fieldResultNote({ ...vf, coherence: { saisies: ['n'] } }), "Juste (3048.000 = ta vitesse de rotation × l'avance totale par révolution)");
  // La saisie égale à la valeur attendue : « Juste », rien de plus.
  assert.equal(fieldResultNote({ ...f, saisie: '0,000284' }), 'Juste');
  // Un champ faux garde « Faux — attendu … », même quand la valeur attendue vient de la cohérence.
  assert.equal(fieldResultNote({ ...f, ok: false, saisie: '0.0003' }), 'Faux — attendu 0.000284');
  assert.equal(fieldResultNote({ ...vf, ok: false, saisie: '3100' }), 'Faux — attendu 3048.000');
  // Valeur théorique (pas de cohérence, ou une réponse d'avant) : « attendu », comme avant.
  assert.equal(fieldResultNote({ ...f, coherence: null }), 'Juste (0.000284 attendu)');
  const { coherence: _sans, ...ancien } = f;
  assert.equal(fieldResultNote(ancien), 'Juste (0.000284 attendu)');
});

// --- Calculs dans les cases (D82) -------------------------------------------------------------------------------

test('fieldResultNote (D82) : une expression se compare par son nombre — « Juste » s’il est celui attendu', () => {
  const vc = { champ: 'vc', evalue: true, ok: true, saisie: '400*1', expression: { texte: '400 × 1', valeur: '400', arrondie: false }, attendu: '400' };
  assert.equal(fieldResultNote(vc), 'Juste');
  const rpm = { champ: 'rpm', evalue: true, ok: true, saisie: '400*12/(pi*1)', expression: { texte: '400 × 12 / (π × 1)', valeur: '1527.8875', arrondie: true }, attendu: '1600' };
  assert.equal(fieldResultNote(rpm), 'Juste (1600 attendu)');
  assert.equal(fieldResultNote({ ...rpm, ok: false }), 'Faux — attendu 1600');
  assert.equal(typedNumber(rpm), '1527.8875');
  assert.equal(typedNumber({ saisie: '1 600', expression: null }), '1 600'); // un nombre, tel que tapé
  assert.equal(typedNumber({ saisie: '1600' }), '1600'); // une correction d'avant D82, sans `expression`
});

test('expressionLine (D82) : « ta saisie : … = … », « ≈ » quand la case l’affiche arrondi ; rien pour un nombre', () => {
  assert.equal(expressionLine({ expression: { texte: '4 × 350 / 0.75', valeur: '1866.6667', arrondie: true } }), 'ta saisie : 4 × 350 / 0.75 ≈ 1866.6667');
  assert.equal(expressionLine({ expression: { texte: '(3 − 1) × 2', valeur: '4', arrondie: false } }), 'ta saisie : (3 − 1) × 2 = 4');
  assert.equal(expressionLine({ saisie: '1600', expression: null }), null);
  assert.equal(expressionLine({ saisie: '1600' }), null);
});

test('computedNote et unreadableNote (D82) : la note sous une case calculée, ou illisible', () => {
  assert.equal(computedNote('(3 − 1) × 2', false), '= (3 − 1) × 2');
  assert.equal(computedNote('4 × 350 / 0.75', true), '≈ 4 × 350 / 0.75');
  assert.equal(unreadableNote('syntax'), 'Illisible : expression mal formée');
  assert.equal(unreadableNote('divisionByZero'), 'Illisible : division par zéro');
  assert.equal(unreadableNote('negative'), 'Illisible : résultat négatif');
});

test('coherenceSource (D70, D71) : les saisies dont la valeur attendue est faite, en toutes lettres', () => {
  assert.equal(coherenceSource('feedPerRev', { saisies: ['fz'], dents: 8 }), 'ton avance par dent × 8');
  assert.equal(coherenceSource('feedPerRev', { saisies: [], dents: 8 }), "l'avance par dent × 8");
  assert.equal(coherenceSource('feedRate', { saisies: ['n', 'f'] }), 'ta vitesse de rotation × ton avance totale par révolution');
  assert.equal(coherenceSource('feedRate', { saisies: ['f'] }), 'la vitesse de rotation × ton avance totale par révolution');
  assert.equal(coherenceSource('feedRate', { saisies: ['n'] }), "ta vitesse de rotation × l'avance totale par révolution");
  assert.equal(coherenceSource('feedRate', null), null);
  assert.equal(coherenceSource('vc', { saisies: ['n'] }), null); // pas de cohérence pour les autres champs
});

test('fieldInSentence (D71) : la grandeur en toutes lettres, avec son article — « ton » devant une voyelle', () => {
  assert.deepEqual(['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate'].map((field) => fieldInSentence(field)), [
    'ta vitesse de coupe', 'ton avance par dent', 'ta vitesse de rotation', 'ton avance totale par révolution', "ta vitesse d'avance",
  ]);
  assert.deepEqual(['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate'].map((field) => fieldInSentence(field, 'the')), [
    'la vitesse de coupe', "l'avance par dent", 'la vitesse de rotation', "l'avance totale par révolution", "la vitesse d'avance",
  ]);
});

test('correctionBanner : bonne réponse, compteur qui retombe, compteur qui reste à zéro', () => {
  assert.equal(correctionBanner({ reussie: true, outil: { nom: 'MVLNR', avant: 1, apres: 2 } }, 3), 'Bonne réponse — MVLNR : 2 réussites de suite sur 3.');
  assert.equal(correctionBanner({ reussie: true, outil: { nom: 'MCLNR', avant: 0, apres: 1 } }, 1), 'Bonne réponse — MCLNR : 1 réussite de suite sur 1.');
  assert.equal(correctionBanner({ reussie: false, outil: { nom: 'MVLNR', avant: 2, apres: 0 } }, 3), 'Question ratée — le compteur de MVLNR retombe à zéro (2 → 0).');
  assert.equal(correctionBanner({ reussie: false, outil: { nom: 'MVLNR', avant: 0, apres: 0 } }, 3), 'Question ratée — le compteur de MVLNR reste à zéro.');
  assert.equal(correctionBanner({ reussie: false, outil: { nom: 'SDTMR', avant: 0, apres: 0 } }, 1, 'SDTMR (métrique)'), 'Question ratée — le compteur de SDTMR (métrique) reste à zéro.');
});

test('decimalPoint (D71) : la virgule tapée devient un point ; rien d’autre ne change', () => {
  assert.equal(decimalPoint('0,15'), '0.15');
  assert.equal(decimalPoint(' 1,600 '), ' 1.600 '); // « 1,600 » vaut 1.6 (UI §7) ; les espaces restent, le serveur les ignore
  assert.equal(decimalPoint('0.15'), '0.15');
  assert.equal(decimalPoint('1,2,3'), '1.2.3'); // illisible avant, illisible après : le serveur le dira
  assert.equal(decimalPoint('abc'), 'abc');
  assert.equal(decimalPoint(''), '');
  assert.equal(decimalPoint(undefined), '');
});

test('decimalPointInValues (D71) : dans les dimensions de la Gestion du contenu, la valeur après le dernier « ; » seulement', () => {
  assert.equal(decimalPointInValues('Ø 1,5 mm ; 0,059\nM10 x 1.5 ; 10x1,5\n1/4- 20 UNC ; 0.25-20'), 'Ø 1,5 mm ; 0.059\nM10 x 1.5 ; 10x1.5\n1/4- 20 UNC ; 0.25-20');
  assert.equal(decimalPointInValues('sans valeur, ni point-virgule'), 'sans valeur, ni point-virgule'); // le libellé reste tel quel
  assert.equal(decimalPointInValues('a ; b ; 0,5\r\nc ; 1,25'), 'a ; b ; 0.5\r\nc ; 1.25');
  assert.equal(decimalPointInValues(''), '');
});

test('studentLine', () => {
  assert.equal(studentLine({ etudiant: { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' } }), 'Camille Tremblay · 2412345');
});
