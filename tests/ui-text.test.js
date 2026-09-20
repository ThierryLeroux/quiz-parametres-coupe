// Tests de site/js/ui/text.js : textes des écrans composés à partir des données, sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exerciseMeta, exerciseSummary, formatDateTime, sessionSummary, studentLine } from '../site/js/ui/text.js';
import { loadApp } from '../site/js/app.js';
import { createSession } from '../site/js/session.js';
import { lireFichier } from './aide.js';

const { exercise: m10 } = await loadApp('', lireFichier);

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

test('exerciseSummary : trois phrases, selon les champs et les réussites requises', () => {
  assert.deepEqual(exerciseSummary(m10), [
    "Pour chaque outil, trouve la vitesse de coupe à l'aide des tables de référence.",
    "Chaque outil doit être réussi de 1 à 3 fois de suite, selon l'outil ; un échec remet son compteur à zéro.",
    'À la fin : rapport de réussite à enregistrer en PDF et à remettre sur Léa.',
  ]);
  const [quoi, combien] = exerciseSummary(CINQ_CHAMPS);
  assert.equal(quoi, "Pour chaque outil, trouve la vitesse de coupe, l'avance par dent, le RPM, l'avance totale par révolution et la vitesse d'avance à l'aide des tables de référence.");
  assert.equal(combien, 'Chaque outil doit être réussi 2 fois de suite ; un échec remet son compteur à zéro.');

  const uneFois = { ...CINQ_CHAMPS, champs_evalues: ['vc', 'n'], outils: [{ id: 'mvlnr', reussites_requises: 1 }] };
  assert.equal(exerciseSummary(uneFois)[0], "Pour chaque outil, trouve la vitesse de coupe et le RPM à l'aide des tables de référence.");
  assert.equal(exerciseSummary(uneFois)[1], 'Chaque outil doit être réussi une fois ; un échec remet son compteur à zéro.');
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
