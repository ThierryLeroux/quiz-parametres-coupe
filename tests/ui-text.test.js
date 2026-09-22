// Tests de site/js/ui/text.js : textes des écrans composés à partir des données, sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEPARTMENT_LINES, DEPARTMENT_SHORT, FIELD_LABELS, FIELD_PARTS, correctionBanner, newSessionNotice, sessionFoundNotice, exerciseMeta, exerciseSummary, fieldResultNote, formatDateTime, identificationErrorMessage,
  localDate, serverErrorMessage, sheetSignature, studentLine,
} from '../site/js/ui/text.js';
import { loadApp } from '../site/js/app.js';
import { ApiError } from '../site/js/api.js';
import { lireFichier } from './aide.js';

const { exercise: m10 } = await loadApp('?exercice=m10-tournage-vc', lireFichier);

const CINQ_CHAMPS = {
  id: 'essai',
  titre: 'Essai',
  version: 'r1',
  champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'],
  outils: [{ id: 'mvlnr', reussites_requises: 2 }],
};

const DEBUT = new Date(2026, 8, 19, 13, 5); // heure du poste : le texte affiché ne dépend pas du fuseau du test

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
  assert.equal(exerciseMeta(CINQ_CHAMPS), "version r1 · 1 outil · champs évalués : vitesse de coupe, avance par dent, RPM, avance totale par révolution, vitesse d'avance");
});

test('exerciseSummary : trois phrases ; N vient de reussites_requises', () => {
  // M10 : de 1 à 3 réussites selon l'outil → « plusieurs fois de suite »
  assert.deepEqual(exerciseSummary(m10), [
    'Chaque outil doit être réussi plusieurs fois de suite.',
    'Une mauvaise réponse remet le compteur de cet outil à zéro.',
    'À la fin, tu enregistres ton rapport de réussite en PDF et tu le remets sur Léa.',
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
  assert.equal(serverErrorMessage(new ApiError(0, 'Le serveur de correction ne répond pas.')), 'Le serveur de correction ne répond pas. Vérifie ta connexion, puis réessaie.');
  assert.equal(serverErrorMessage(new TypeError('imprévu')), 'Le serveur de correction ne répond pas. Vérifie ta connexion, puis réessaie.');
  assert.equal(serverErrorMessage(new ApiError(500, 'Erreur du serveur.')), 'Erreur du serveur.');
});

test('identificationErrorMessage : matricule invalide, NIP incorrect, trop d’essais (UI §3.2)', () => {
  assert.equal(identificationErrorMessage(new ApiError(400, 'Le matricule doit avoir exactement 7 chiffres.')), 'Le matricule doit avoir exactement 7 chiffres.');
  assert.equal(identificationErrorMessage(new ApiError(401, 'NIP incorrect.')), "NIP incorrect. Si tu l'as oublié, demande à ton enseignant de le remettre à zéro.");
  assert.equal(identificationErrorMessage(new ApiError(429, "Trop d'essais.")), "Trop d'essais. Attends 10 minutes avant de réessayer.");
  assert.equal(identificationErrorMessage(new ApiError(409, 'Ce matricule a déjà une séance pour cet exercice.')), 'Ce matricule a déjà une séance.');
  assert.equal(identificationErrorMessage(new ApiError(404, 'Aucune séance pour ce matricule dans cet exercice.')), 'Aucune séance pour ce matricule dans cet exercice.');
  assert.equal(identificationErrorMessage(new ApiError(0, '…')), 'Le serveur de correction ne répond pas. Vérifie ta connexion, puis réessaie.');
});

// --- Écran Question : ce que renvoie le serveur, mis en mots --------------------------------------------

test('FIELD_LABELS : nom, symbole et unité des cinq champs (UI §3.3)', () => {
  assert.deepEqual(Object.keys(FIELD_LABELS), ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate']);
  assert.equal(FIELD_LABELS.rpm, 'RPM (N, rév/min)');
  for (const [champ, { name, symbol, unit }] of Object.entries(FIELD_PARTS)) assert.equal(`${name} (${symbol}, ${unit})`, FIELD_LABELS[champ]);
});

test('fieldResultNote : Juste, Juste (… attendu), Faux — attendu …, fourni par l’exercice (UI §3.4)', () => {
  assert.equal(fieldResultNote({ evalue: true, ok: true, saisie: '2496', attendu: '2496' }), 'Juste');
  assert.equal(fieldResultNote({ evalue: true, ok: true, saisie: ' 0,0050 ', attendu: '0.0050' }), 'Juste');
  assert.equal(fieldResultNote({ evalue: true, ok: true, saisie: '2500', attendu: '2496' }), 'Juste (2496 attendu)');
  assert.equal(fieldResultNote({ evalue: true, ok: false, saisie: '', attendu: '12.500' }), 'Faux — attendu 12.500');
  assert.equal(fieldResultNote({ evalue: false, ok: true, saisie: '', attendu: '12.500' }), "fourni par l'exercice");
});

test('correctionBanner : bonne réponse, compteur qui retombe, compteur qui reste à zéro', () => {
  assert.equal(correctionBanner({ reussie: true, outil: { nom: 'MVLNR', avant: 1, apres: 2 } }, 3), 'Bonne réponse — MVLNR : 2 réussites de suite sur 3.');
  assert.equal(correctionBanner({ reussie: true, outil: { nom: 'MCLNR', avant: 0, apres: 1 } }, 1), 'Bonne réponse — MCLNR : 1 réussite de suite sur 1.');
  assert.equal(correctionBanner({ reussie: false, outil: { nom: 'MVLNR', avant: 2, apres: 0 } }, 3), 'Question ratée — le compteur de MVLNR retombe à zéro (2 → 0).');
  assert.equal(correctionBanner({ reussie: false, outil: { nom: 'MVLNR', avant: 0, apres: 0 } }, 3), 'Question ratée — le compteur de MVLNR reste à zéro.');
  assert.equal(correctionBanner({ reussie: false, outil: { nom: 'SDTMR', avant: 0, apres: 0 } }, 1, 'SDTMR (métrique)'), 'Question ratée — le compteur de SDTMR (métrique) reste à zéro.');
});

test('studentLine', () => {
  assert.equal(studentLine({ etudiant: { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' } }), 'Camille Tremblay · 2412345');
});
