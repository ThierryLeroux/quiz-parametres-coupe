// Tests de site/js/ui/attestation-data.js (ce que montrent l'attestation et la vérification) et de
// la partie pure de site/js/ui/qr.js (la bibliothèque vendorisée encode l'adresse de vérification).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attestationFacts, attestationFileName, attestationFooter, attestationRows, tablesRevision, verificationMention, verificationOutcome,
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
