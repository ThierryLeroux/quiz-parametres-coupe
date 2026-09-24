// Tests de site/js/ui/prof-data.js (espace professeur, D34, D35) : filtre, tri, recherche, export
// CSV, journal des corrections d'identité — sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_COLUMNS, canAct, csvCell, csvFileName, csvOf, deleteConfirmation, filterSessions, identityRows, nipResetConfirmation, plain, resetConfirmation, roleLabel,
  sessionCells, sessionState, sortSessions,
} from '../site/js/ui/prof-data.js';
import { claimsFromInput } from '../site/js/ui/attestation-data.js';

const at = (y, mo, d, h, mi, s = 0) => new Date(y, mo - 1, d, h, mi, s).toISOString(); // heure du poste

const M10 = { id: 'm10-tournage-vc', titre: 'M10 — Tournage : vitesse de coupe' };
const ESSAI = { id: 'essai-percage', titre: 'Essai — perçage' };
const SEANCES = [
  { id: 1, exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', debut: at(2026, 9, 21, 13, 5), derniere_activite: at(2026, 9, 21, 13, 48), reussite_le: at(2026, 9, 21, 13, 48), questions_reussies: 15, code: 'ABCDE-FGHJK' },
  { id: 2, exercice: M10, prenom: 'Alex', nom: 'Roy', matricule: '2498765', debut: at(2026, 9, 21, 13, 10), derniere_activite: at(2026, 9, 21, 14, 2), reussite_le: null, questions_reussies: 4, code: null },
  { id: 3, exercice: ESSAI, prenom: 'Zoé', nom: 'Lévesque', matricule: '2455555', debut: at(2026, 9, 20, 9, 0), derniere_activite: at(2026, 9, 20, 9, 30), reussite_le: null, questions_reussies: 0, code: null },
  { id: 4, exercice: M10, prenom: 'Élise', nom: 'Tremblay-Roy', matricule: '2400001', debut: at(2026, 9, 19, 8, 0), derniere_activite: at(2026, 9, 19, 8, 40), reussite_le: at(2026, 9, 19, 8, 40), questions_reussies: 15, code: 'ZZZZZ-YYYYY' },
];

test('SESSION_COLUMNS : les colonnes demandées, dans l’ordre', () => {
  assert.deepEqual(SESSION_COLUMNS.map((c) => c.label), ['Nom', 'Prénom', 'Matricule', 'Exercice', 'Début', 'Dernière activité', 'État', 'Questions réussies', 'Attestation']);
});

test('sessionState et sessionCells : réussi ou en cours, dates mises en forme', () => {
  assert.equal(sessionState(SEANCES[0]), 'Réussi');
  assert.equal(sessionState(SEANCES[1]), 'En cours');
  assert.deepEqual(sessionCells(SEANCES[0]), {
    nom: 'Tremblay', prenom: 'Camille', matricule: '2412345', exercice: M10.titre, debut: '2026-09-21 13:05', derniere_activite: '2026-09-21 13:48',
    etat: 'Réussi le 2026-09-21 13:48', questions_reussies: '15', code: 'ABCDE-FGHJK',
  });
  assert.deepEqual([sessionCells(SEANCES[1]).etat, sessionCells(SEANCES[1]).code], ['En cours', '']);
});

test('filterSessions : par exercice, et recherche par matricule ou par nom, sans casse ni accents', () => {
  assert.deepEqual(filterSessions(SEANCES).map((s) => s.id), [1, 2, 3, 4]);
  assert.deepEqual(filterSessions(SEANCES, { exercice: ESSAI.id }).map((s) => s.id), [3]);
  assert.deepEqual(filterSessions(SEANCES, { search: 'tremblay' }).map((s) => s.id), [1, 4]);
  assert.deepEqual(filterSessions(SEANCES, { search: 'LEVESQUE' }).map((s) => s.id), [3]);
  assert.deepEqual(filterSessions(SEANCES, { search: 'élise' }).map((s) => s.id), [4]);
  assert.deepEqual(filterSessions(SEANCES, { search: '2498' }).map((s) => s.id), [2]);
  assert.deepEqual(filterSessions(SEANCES, { search: 'camille tremblay' }).map((s) => s.id), [1]);
  assert.deepEqual(filterSessions(SEANCES, { search: 'tremblay camille' }).map((s) => s.id), [1]);
  assert.deepEqual(filterSessions(SEANCES, { exercice: M10.id, search: 'roy' }).map((s) => s.id), [2, 4]);
  assert.deepEqual(filterSessions(SEANCES, { search: 'personne' }), []);
  assert.equal(plain(' Élise-Zoé '), ' elise-zoe ');
});

test('sortSessions : par colonne, montant ou descendant, sans modifier la liste ; les égalités gardent l’ordre', () => {
  assert.deepEqual(sortSessions(SEANCES, 'nom').map((s) => s.id), [3, 2, 1, 4]);
  assert.deepEqual(sortSessions(SEANCES, 'nom', false).map((s) => s.id), [4, 1, 2, 3]);
  assert.deepEqual(sortSessions(SEANCES, 'questions_reussies', false).map((s) => s.id), [1, 4, 2, 3]); // 15, 15 (ordre gardé), 4, 0
  assert.deepEqual(sortSessions(SEANCES, 'derniere_activite', false).map((s) => s.id), [2, 1, 3, 4]);
  assert.deepEqual(sortSessions(SEANCES, 'debut').map((s) => s.id), [4, 3, 1, 2]);
  assert.deepEqual(sortSessions(SEANCES, 'etat', false).map((s) => s.id), [1, 4, 2, 3]); // réussites d'abord, la plus récente en premier
  assert.deepEqual(sortSessions(SEANCES, 'exercice').map((s) => s.id), [3, 1, 2, 4]);
  assert.deepEqual(sortSessions(SEANCES, 'matricule').map((s) => s.id), [4, 1, 3, 2]);
  assert.deepEqual(sortSessions(SEANCES, 'code', false).map((s) => s.id), [4, 1, 2, 3]);
  assert.deepEqual(SEANCES.map((s) => s.id), [1, 2, 3, 4]); // l'original n'a pas bougé
});

test('csvOf : UTF-8 avec BOM, séparateur « ; », CRLF, dates ISO à la seconde, cellules protégées', () => {
  const csv = csvOf([SEANCES[0], { ...SEANCES[1], nom: 'Roy; "Le Grand"' }]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lignes = csv.slice(1).split('\r\n');
  assert.deepEqual(lignes, [
    'Nom;Prénom;Matricule;Exercice;Titre;Début;Dernière activité;État;Réussite;Questions réussies;Attestation',
    'Tremblay;Camille;2412345;m10-tournage-vc;M10 — Tournage : vitesse de coupe;2026-09-21 13:05:00;2026-09-21 13:48:00;réussi;2026-09-21 13:48:00;15;ABCDE-FGHJK',
    '"Roy; ""Le Grand""";Alex;2498765;m10-tournage-vc;M10 — Tournage : vitesse de coupe;2026-09-21 13:10:00;2026-09-21 14:02:00;en cours;;4;',
    '',
  ]);
  assert.equal(csvCell('simple'), 'simple');
  assert.equal(csvCell('a;b'), '"a;b"');
  assert.equal(csvCell('l\nm'), '"l\nm"');
  assert.equal(csvCell(null), '');
  assert.equal(csvFileName('m10-tournage-vc', new Date(2026, 8, 21, 15, 0)), 'reussites-m10-tournage-vc-2026-09-21.csv');
  assert.equal(csvFileName('', new Date(2026, 8, 21, 15, 0)), 'reussites-tous-2026-09-21.csv');
});

test('identityRows : lisible, avant → après, matricule actuel, séance, attestation réémise (D37)', () => {
  const base = {
    id: 2, seance_id: 7, horodatage: at(2026, 9, 21, 13, 7), ancien_prenom: 'Camile', ancien_nom: 'Tremblay', ancien_matricule: '2412354',
    nouveau_prenom: 'Camille', nouveau_nom: 'Tremblay', nouveau_matricule: '2412345', exercice_id: 'm10-tournage-vc', matricule: '2412345',
  };
  assert.deepEqual(identityRows([{ ...base, ancien_code: null, nouveau_code: null }]), [{ id: 2, horodatage: '2026-09-21 13:07', exercice: 'm10-tournage-vc', matricule: '2412345', avant: 'Camile Tremblay · 2412354', apres: 'Camille Tremblay · 2412345', attestation: '', seance: 7 }]);
  assert.equal(identityRows([{ ...base, ancien_code: 'ABCDEFGHJK', nouveau_code: 'ZZZZZYYYYY' }])[0].attestation, 'ABCDE-FGHJK → ZZZZZ-YYYYY');
});

test('canAct et roleLabel (D44) : seul admin agit ; la consultation est dite « lecture seule »', () => {
  assert.equal(canAct('admin'), true);
  assert.equal(canAct('consultation'), false);
  assert.equal(canAct(null), false);
  assert.equal(roleLabel('admin'), 'admin');
  assert.equal(roleLabel('consultation'), 'consultation (lecture seule)');
});

test('resetConfirmation : nomme l’étudiant, l’exercice, et prévient de l’annulation s’il y a une attestation', () => {
  assert.match(resetConfirmation(SEANCES[0]), /Camille Tremblay \(2412345, M10 — Tournage : vitesse de coupe\)/);
  assert.match(resetConfirmation(SEANCES[0]), /attestation sera annulée/);
  assert.doesNotMatch(resetConfirmation(SEANCES[1]), /attestation/);
});

test('deleteConfirmation (D45) : rappelle le nom et le matricule, dit que c’est sans retour, et ce qu’il advient de l’attestation', () => {
  assert.match(deleteConfirmation(SEANCES[0]), /Camille Tremblay, matricule 2412345 \(M10 — Tournage : vitesse de coupe\)/);
  assert.match(deleteConfirmation(SEANCES[0]), /sans retour/);
  assert.match(deleteConfirmation(SEANCES[0]), /ABCDE-FGHJK restera vérifiable et répondra « annulée — séance supprimée »/);
  assert.doesNotMatch(deleteConfirmation(SEANCES[1]), /attestation/);
});

test('nipResetConfirmation : nomme l’étudiant et l’exercice, dit que la progression ne change pas', () => {
  assert.match(nipResetConfirmation(SEANCES[1]), /Alex Roy \(2498765, M10 — Tournage : vitesse de coupe\)/);
  assert.match(nipResetConfirmation(SEANCES[1]), /progression ne change pas/);
});

test('claimsFromInput : un code, une adresse collée entière, ou rien', () => {
  assert.deepEqual(claimsFromInput(' abcde-fghjk '), { code: 'abcde-fghjk' });
  assert.deepEqual(claimsFromInput('https://quiz.example/verifier?code=ABCDE-FGHJK&nom=Tremblay&signature=xyz'), { code: 'ABCDE-FGHJK', nom: 'Tremblay', signature: 'xyz' });
  assert.deepEqual(claimsFromInput('?code=ABCDE-FGHJK'), { code: 'ABCDE-FGHJK' });
  assert.equal(claimsFromInput(''), null);
  assert.equal(claimsFromInput('   '), null);
  assert.equal(claimsFromInput(undefined), null);
});
