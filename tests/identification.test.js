// Tests de site/js/identification.js : prénom, nom, matricule à 7 chiffres, NIP de 4 à 6 chiffres (SPEC §8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanStudent, studentErrors, validateStudent } from '../site/js/identification.js';

const ETUDIANT = { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };

test('validateStudent : identification complète → aucune erreur', () => {
  assert.deepEqual(validateStudent(ETUDIANT), []);
});

test('validateStudent : une erreur par champ fautif', () => {
  assert.deepEqual(validateStudent({ ...ETUDIANT, prenom: '  ' }), ['Le prénom est requis.']);
  assert.deepEqual(validateStudent({ ...ETUDIANT, nom: '' }), ['Le nom est requis.']);
  assert.deepEqual(validateStudent({ ...ETUDIANT, matricule: undefined }), ['Le matricule est requis.']);
  assert.deepEqual(validateStudent({ ...ETUDIANT, nip: '' }), ['Le NIP est requis.']);
  assert.equal(validateStudent({}).length, 4);
  assert.equal(validateStudent(null).length, 1);
});

test('validateStudent : le matricule a exactement 7 chiffres', () => {
  for (const matricule of ['241234', '24123456', '241234a', '2412 345', '2412-345']) {
    assert.deepEqual(validateStudent({ ...ETUDIANT, matricule }), ['Le matricule doit avoir exactement 7 chiffres.'], matricule);
  }
  assert.deepEqual(validateStudent({ ...ETUDIANT, matricule: 2412345 }), ['Le matricule est requis.']); // un nombre n'est pas un texte
  assert.deepEqual(validateStudent({ ...ETUDIANT, matricule: ' 0412345 ' }), []); // espaces autour tolérés, zéro de tête conservé
});

test('validateStudent : le NIP a de 4 à 6 chiffres', () => {
  for (const nip of ['4821', '48215', '482156', '0000', ' 0042 ']) assert.deepEqual(validateStudent({ ...ETUDIANT, nip }), [], nip);
  for (const nip of ['482', '4821567', '48a1', '48 21', '48.21', '-4821']) {
    assert.deepEqual(validateStudent({ ...ETUDIANT, nip }), ['Le NIP doit avoir de 4 à 6 chiffres.'], nip);
  }
  assert.deepEqual(validateStudent({ ...ETUDIANT, nip: 4821 }), ['Le NIP est requis.']); // un nombre n'est pas un texte : « 0042 » y perdrait ses zéros
});

test('studentErrors : le message de chaque champ, ou null', () => {
  assert.deepEqual(studentErrors(ETUDIANT), { prenom: null, nom: null, matricule: null, nip: null });
  assert.deepEqual(studentErrors({ prenom: ' ', nom: 'Tremblay', matricule: '24123', nip: '12' }), {
    prenom: 'Le prénom est requis.',
    nom: null,
    matricule: 'Le matricule doit avoir exactement 7 chiffres.',
    nip: 'Le NIP doit avoir de 4 à 6 chiffres.',
  });
  assert.deepEqual(studentErrors({}), { prenom: 'Le prénom est requis.', nom: 'Le nom est requis.', matricule: 'Le matricule est requis.', nip: 'Le NIP est requis.' });
});

test('cleanStudent : les quatre champs, sans les espaces autour, zéros de tête conservés', () => {
  assert.deepEqual(cleanStudent({ prenom: ' Camille ', nom: 'Tremblay ', matricule: ' 0412345', nip: ' 0042 ', autre: 'x' }), {
    prenom: 'Camille', nom: 'Tremblay', matricule: '0412345', nip: '0042',
  });
});
