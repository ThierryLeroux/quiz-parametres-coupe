// Tests de site/js/ui/text.js : textes des écrans composés à partir des données, sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exerciseMeta, exerciseSummary, formatDateTime, sessionSummary, studentLine } from '../site/js/ui/text.js';
import { loadApp } from '../site/js/app.js';
import { createSession } from '../site/js/session.js';
import { lireFichier } from './aide.js';

const { exercise: m10 } = await loadApp('?exercice=m10-tournage-vc', lireFichier);

const CINQ_CHAMPS = {
  id: 'essai',
  titre: 'Essai',
  version: 'r1',
  champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'],
  outils: [{ id: 'mvlnr', reussites_requises: 2 }],
};

const ETUDIANT = { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' };
const DEBUT = new Date(2026, 8, 19, 13, 5); // heure du poste : le texte affiché ne dépend pas du fuseau du test

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

test('studentLine et sessionSummary : séance en cours, puis réussie', () => {
  const etat = createSession(ETUDIANT, m10, DEBUT);
  assert.equal(studentLine(etat), 'Camille Tremblay · 2412345');
  assert.equal(sessionSummary(etat), 'Camille Tremblay · 2412345 · commencée le 19 sept. 2026, 13 h 05 · 0 réussite');

  const avancee = { ...etat, progression: { ...etat.progression, totalReussies: 7 } };
  assert.equal(sessionSummary(avancee), 'Camille Tremblay · 2412345 · commencée le 19 sept. 2026, 13 h 05 · 7 réussites');
  assert.match(sessionSummary({ ...avancee, reussite: DEBUT.toISOString() }), / · 7 réussites · exercice réussi$/);
});
