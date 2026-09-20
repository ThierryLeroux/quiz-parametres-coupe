// Tests de site/js/ui/text.js : textes des écrans composés à partir des données, sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exerciseMeta, exerciseSummary, formatDateTime, identificationErrorMessage, serverErrorMessage } from '../site/js/ui/text.js';
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

test('serverErrorMessage : 501 → « Serveur de correction à venir » ; injoignable ; sinon le message du serveur', () => {
  assert.equal(serverErrorMessage(new ApiError(501, "Le serveur de correction n'est pas encore en service.")), 'Serveur de correction à venir');
  assert.equal(serverErrorMessage(new ApiError(0, 'Le serveur de correction ne répond pas.')), 'Le serveur de correction ne répond pas. Vérifie ta connexion, puis réessaie.');
  assert.equal(serverErrorMessage(new TypeError('imprévu')), 'Le serveur de correction ne répond pas. Vérifie ta connexion, puis réessaie.');
  assert.equal(serverErrorMessage(new ApiError(500, 'Erreur du serveur.')), 'Erreur du serveur.');
});

test('identificationErrorMessage : matricule invalide, NIP incorrect, trop d’essais (UI §3.2)', () => {
  assert.equal(identificationErrorMessage(new ApiError(400, 'Le matricule doit avoir exactement 7 chiffres.')), 'Le matricule doit avoir exactement 7 chiffres.');
  assert.equal(identificationErrorMessage(new ApiError(401, 'NIP incorrect.')), "NIP incorrect. Si tu l'as oublié, demande à ton enseignant de le remettre à zéro.");
  assert.equal(identificationErrorMessage(new ApiError(429, "Trop d'essais.")), "Trop d'essais. Attends 10 minutes avant de réessayer.");
  assert.equal(identificationErrorMessage(new ApiError(501, '…')), 'Serveur de correction à venir');
});
