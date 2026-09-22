// Tests de worker/attestation.js (décisions D31 à D33) : code court, sérialisation canonique,
// enregistrement figé, adresse de vérification et comparaison des champs prétendus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CODE_ALPHABET, CODE_LENGTH, buildAttestation, canonical, claimsMatch, claimsOnlyCode, formatCode, newCode, parseCode, readClaims,
  successfulQuestions, verificationUrl,
} from '../worker/attestation.js';
import { cleanAnswers, gradeQuestion, sessionView } from '../worker/seance.js';
import { computeParameters } from '../site/js/calcul.js';
import { formatParameters } from '../site/js/format.js';
import { loadApp } from '../site/js/app.js';
import { lireFichier, questionPour } from './aide.js';

const { data, exercise: m10 } = await loadApp('?exercice=m10-tournage-vc', lireFichier);

// Une séance réussie du M10, telle qu'en base (colonnes JSON décodées).
const SEANCE = {
  id: 7,
  exercice_id: 'm10-tournage-vc',
  matricule: '2412345',
  prenom: 'Camille',
  nom: 'Tremblay',
  debut: '2026-09-21T13:05:00.000Z',
  reussite_le: '2026-09-21T13:48:10.000Z',
  version_exercice: 'r0',
  version_exercice_reussite: 'r0',
  question_courante: null,
  compteurs: { reussites: { mclnr: 1, mvlnr: 3, lame_a_tronconner: 3, barre_a_fileter: 1, barre_a_fileter_2: 1, barre_a_rainurer: 3, barre_a_aleser: 1, sdtmr: 1, sdtmr_2: 1 }, totalReussies: 17 },
};

// --- Code court --------------------------------------------------------------------------------------------

test('alphabet : base32 de Crockford sans 0, O, 1, I (ni L, ni U) — 30 caractères', () => {
  assert.equal(CODE_ALPHABET, '23456789ABCDEFGHJKMNPQRSTVWXYZ');
  for (const ambiguous of '0O1IlLuU') assert.equal(CODE_ALPHABET.includes(ambiguous.toUpperCase()), false, ambiguous);
  assert.equal(CODE_LENGTH, 10);
});

test('newCode : 10 caractères de l’alphabet, jamais deux fois le même', () => {
  const codes = new Set(Array.from({ length: 500 }, () => newCode()));
  assert.equal(codes.size, 500);
  for (const code of codes) assert.match(code, /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{10}$/);
});

test('newCode : sans biais — un octet ≥ 240 est rejeté, les autres sont pris modulo 30', () => {
  // 0 → « 2 », 29 → « Z », 30 → « 2 » de nouveau, 240 et 255 rejetés.
  const octets = [0, 29, 30, 240, 255, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const code = newCode((n) => Uint8Array.from(octets.splice(0, n)));
  assert.equal(code, '2Z23456789'); // 0 → 2, 29 → Z, 30 → 2, 240 et 255 rejetés, 1..7 → 3..9
  // Jamais de code plus court si les octets sont tous rejetés au premier tour.
  let tour = 0;
  const lent = newCode((n) => { tour += 1; return new Uint8Array(n).fill(tour === 1 ? 250 : 0); });
  assert.equal(lent, '2222222222');
});

test('formatCode : présenté 5-5 ; parseCode : tolère minuscules, espaces et tirets, refuse le reste', () => {
  assert.equal(formatCode('ABCDEFGHJK'), 'ABCDE-FGHJK');
  assert.equal(parseCode('ABCDE-FGHJK'), 'ABCDEFGHJK');
  assert.equal(parseCode(' abcde fghjk '), 'ABCDEFGHJK');
  assert.equal(parseCode('ABCDEFGHJK'), 'ABCDEFGHJK');
  assert.equal(parseCode('ABCDE-FGHJ'), null); // 9 caractères
  assert.equal(parseCode('ABCDE-FGHJKL'), null); // 11
  assert.equal(parseCode('ABCDE-FGH0K'), null); // 0 n'existe pas — pas corrigé en O non plus
  assert.equal(parseCode('ABCDE-FGHIK'), null); // I non plus
  assert.equal(parseCode(''), null);
  assert.equal(parseCode(null), null);
  assert.equal(parseCode(1234567890), null);
});

// --- Sérialisation canonique -------------------------------------------------------------------------------------

test('canonical : clés triées à tous les niveaux, sans espace ; l’ordre d’écriture ne change rien', () => {
  const a = { b: 1, a: { d: [3, { z: 1, y: 'é' }], c: null } };
  const b = { a: { c: null, d: [3, { y: 'é', z: 1 }] }, b: 1 };
  assert.equal(canonical(a), '{"a":{"c":null,"d":[3,{"y":"é","z":1}]},"b":1}');
  assert.equal(canonical(a), canonical(b));
  assert.notEqual(canonical({ a: 1 }), canonical({ a: '1' })); // le type compte
  assert.equal(canonical([]), '[]');
  assert.equal(canonical('x'), '"x"');
});

// --- Enregistrement figé --------------------------------------------------------------------------------------

test('buildAttestation : tout est copié à cet instant — identité, exercice, révisions, dates, outils dans l’ordre de l’exercice', () => {
  const record = buildAttestation(SEANCE, m10, data, 'ABCDEFGHJK');
  assert.deepEqual(Object.keys(record), ['code', 'exercice', 'revision', 'revision_tables', 'etudiant', 'debut', 'reussite_le', 'questions_reussies', 'outils', 'questions']);
  assert.deepEqual(record.questions, []); // sans journal : aucune question listée
  assert.equal(record.code, 'ABCDEFGHJK');
  assert.deepEqual(record.exercice, { id: 'm10-tournage-vc', titre: 'M10 — Tournage : vitesse de coupe' });
  assert.equal(record.revision, 'r0');
  assert.deepEqual(record.revision_tables, { materiaux: data.revisions.materiaux, operations: data.revisions.operations });
  assert.match(record.revision_tables.materiaux, /^[A-Z]\d{4}_r\d+$/);
  assert.deepEqual(record.etudiant, { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' });
  assert.equal(record.debut, SEANCE.debut);
  assert.equal(record.reussite_le, SEANCE.reussite_le);
  assert.equal(record.questions_reussies, 17);
  assert.deepEqual(record.outils.map((outil) => outil.id), m10.outils.map((outil) => outil.id));
  assert.deepEqual(record.outils[1], { id: 'mvlnr', nom: 'MVLNR', plage: '1.000" à 4.000"', operation: 'Chariotage finition', reussites: 3, requises: 3 });
  assert.deepEqual(record.outils[8], { id: 'sdtmr_2', nom: 'SDTMR', plage: 'M4 x 0.7 à M68 x 6', operation: 'Filetage externe', reussites: 1, requises: 1 });
  // L'enregistrement ne partage aucun objet avec ses sources : le figer, c'est le copier.
  assert.notEqual(record.exercice, m10);
  assert.equal(JSON.stringify(record).includes('vc_pi_min'), false);
});

test('buildAttestation : la révision est celle de la réussite ; sinon celle de l’exercice ; un outil jamais réussi vaut 0 ; la plage est celle que l’exercice permet', () => {
  const r1 = { ...m10, version: 'r1', outils: [...m10.outils, { id: 'foret_fractionnaire', reussites_requises: 2, dimensions: ['Ø 1/4 po', 'Ø 3/8 po', 'Ø 1/2 po'] }] };
  const ancienne = buildAttestation({ ...SEANCE, version_exercice_reussite: null }, r1, data, 'ABCDEFGHJK');
  assert.equal(ancienne.revision, 'r1');
  assert.deepEqual(ancienne.outils.at(-1), { id: 'foret_fractionnaire', nom: 'Foret fractionnaire', plage: 'Ø 1/4 po à Ø 1/2 po', operation: 'Perçage', reussites: 0, requises: 2 });
  assert.equal(buildAttestation({ ...SEANCE, version_exercice_reussite: 'r0' }, r1, data, 'ABCDEFGHJK').revision, 'r0');
  // Les outils de l'attestation sont exactement ceux de progression.outils que le serveur montre à l'écran.
  const { progression } = sessionView(SEANCE, m10, data);
  assert.deepEqual(buildAttestation(SEANCE, m10, data, 'ABCDEFGHJK').outils, progression.outils);
});

// --- Les questions réussies qui comptent (D41) ------------------------------------------------------------

// Une ligne du journal, telle que listCorrections la rend, pour une question du M10 corrigée avec ces saisies.
function correction(question, saisies, horodatage) {
  const reponses = cleanAnswers(saisies);
  const { success, result } = gradeQuestion(question, reponses, { reussites: {}, totalReussies: 0 }, m10, data);
  return { seance_id: 7, outil_id: question.tool.id, question, reponses, resultat: result, reussie: success ? 1 : 0, horodatage };
}
const bonneVc = (question) => formatParameters(computeParameters(question, data)).vc;
const MVLNR = questionPour({ outil: 'mvlnr', dimension: '2.000"', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: 1 });
const MCLNR = questionPour({ outil: 'mclnr', dimension: '10 mm', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: 39 });
const BARRE = questionPour({ outil: 'barre_a_aleser', dimension: '2.000"', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: 1, barre: '1 po' });
const heure = (n) => `2026-09-21T13:${String(n).padStart(2, '0')}:00.000Z`;

test('successfulQuestions : la série finale de réussites de chaque outil, dans l’ordre chronologique, numérotée par le rang dans la séance', () => {
  // MVLNR : réussi, réussi, raté, puis trois de suite ; MCLNR : raté, puis réussi ; barre : réussie.
  const journal = [
    correction(MVLNR, { vc: bonneVc(MVLNR) }, heure(1)), // 1
    correction(MVLNR, { vc: bonneVc(MVLNR) }, heure(2)), // 2
    correction(MCLNR, { vc: '1' }, heure(3)), // 3 : raté
    correction(MVLNR, { vc: '1' }, heure(4)), // 4 : raté, compteur à zéro
    correction(MVLNR, { vc: bonneVc(MVLNR) }, heure(5)), // 5
    correction(MCLNR, { vc: bonneVc(MCLNR) }, heure(6)), // 6
    correction(MVLNR, { vc: `${bonneVc(MVLNR)},0` }, heure(7)), // 7 : la saisie telle quelle, virgule comprise
    correction(BARRE, { vc: bonneVc(BARRE) }, heure(8)), // 8
    correction(MVLNR, { vc: bonneVc(MVLNR) }, heure(9)), // 9
  ];
  const outils = [
    { id: 'mclnr', nom: 'MCLNR', plage: '10 mm à 20 mm', operation: 'Chariotage ébauche', reussites: 1, requises: 1 },
    { id: 'mvlnr', nom: 'MVLNR', plage: '1.000" à 4.000"', operation: 'Chariotage finition', reussites: 3, requises: 3 },
    { id: 'barre_a_aleser', nom: 'Barre à aléser', plage: '1.000" à 4.000"', operation: 'Alésage à la barre', reussites: 1, requises: 1 },
  ];
  const questions = successfulQuestions(journal, outils);
  assert.deepEqual(questions.map((q) => q.numero), [5, 6, 7, 8, 9]); // ni 1 ni 2 (série rompue), ni 3 ni 4 (ratées)
  assert.deepEqual(questions[0], {
    numero: 5,
    outil_id: 'mvlnr',
    outil: 'MVLNR - Ø charioté: 2.000"',
    materiau_outil: 'Insert de carbure de tungstène',
    materiau: { classe: 'P', groupe: 1, materiau: 'Acier non allié', etat: 'Recuit' },
    reponses: { vc: '400' }, // les champs évalués seulement : le M10 n'évalue que Vc
    horodatage: heure(5),
  });
  assert.deepEqual(questions[1].materiau, { classe: 'H', groupe: 39, materiau: 'Acier durci', etat: 'Durci et revenu' });
  assert.equal(questions[1].outil, 'MCLNR - Ø charioté: 10 mm');
  assert.deepEqual(questions[2].reponses, { vc: '400,0' }); // la réponse de l'étudiant, pas la valeur théorique
  assert.equal(questions[3].outil, 'Barre à aléser Ø 1 po - Ø alésé: 2.000"'); // gabarit résolu : la barre et le Ø alésé
  // Chaque outil : exactement ses réussites, et toutes après son dernier échec.
  for (const outil of outils) {
    const siennes = questions.filter((q) => q.outil_id === outil.id);
    assert.equal(siennes.length, outil.reussites, outil.id);
    const dernierEchec = journal.map((c, i) => (c.outil_id === outil.id && !c.reussie ? i + 1 : 0)).reduce((a, b) => Math.max(a, b), 0);
    assert.ok(siennes.every((q) => q.numero > dernierEchec), outil.id);
  }
  // Un outil jamais joué (reussites 0), ou un journal vide : rien.
  assert.deepEqual(successfulQuestions(journal, [{ id: 'sdtmr', reussites: 0 }]), []);
  assert.deepEqual(successfulQuestions([], outils), []);
  // Exercice allégé (D21) : le compteur dépasse les réussites exigées → les dernières seulement.
  assert.deepEqual(successfulQuestions(journal, [{ id: 'mvlnr', reussites: 2 }]).map((q) => q.numero), [7, 9]);
});

test('successfulQuestions : les réponses listées sont celles des grandeurs évaluées de l’exercice, sous les noms du moteur', () => {
  const complet = { ...m10, champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'] };
  const reponses = cleanAnswers(formatParameters(computeParameters(MVLNR, data)));
  const { result } = gradeQuestion(MVLNR, reponses, { reussites: {}, totalReussies: 0 }, complet, data);
  const [q] = successfulQuestions([{ outil_id: 'mvlnr', question: MVLNR, reponses, resultat: result, reussie: 1, horodatage: heure(1) }], [{ id: 'mvlnr', reussites: 1 }]);
  assert.deepEqual(Object.keys(q.reponses), ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate']);
  assert.deepEqual(q.reponses, reponses);
});

test('buildAttestation : avec le journal, l’enregistrement liste les questions réussies ; la liste entre dans la sérialisation signée', () => {
  const journal = [correction(MCLNR, { vc: bonneVc(MCLNR) }, heure(1))];
  const record = buildAttestation(SEANCE, m10, data, 'ABCDEFGHJK', journal);
  assert.equal(record.questions.length, 1);
  assert.deepEqual(record.questions[0].reponses, { vc: '40' });
  assert.ok(canonical(record).includes('"questions":[{"horodatage"'));
  assert.notEqual(canonical(record), canonical(buildAttestation(SEANCE, m10, data, 'ABCDEFGHJK', [])));
});

// --- Adresse de vérification et champs prétendus ------------------------------------------------------------

const RECORD = buildAttestation(SEANCE, m10, data, 'ABCDEFGHJK');
const SIGNATURE = 'x'.repeat(43);

test('verificationUrl : absolue, sur l’origine de la requête, avec l’essentiel en clair puis la signature', () => {
  const url = verificationUrl('https://quiz.example', RECORD, SIGNATURE);
  assert.equal(url, 'https://quiz.example/verifier?exercice=m10-tournage-vc&matricule=2412345&nom=Tremblay&prenom=Camille'
    + '&reussite=2026-09-21T13%3A48%3A10.000Z&revision=r0&questions=17&code=ABCDE-FGHJK&signature=' + SIGNATURE);
  assert.ok(url.length < 350, `${url.length} caractères`); // un QR raisonnable
});

test('readClaims : ce qu’une adresse prétend, code ramené à 10 caractères ; null si le code manque ou est mal formé', () => {
  const url = new URL(verificationUrl('https://quiz.example', RECORD, SIGNATURE));
  const claims = readClaims(url.searchParams);
  assert.deepEqual(claims, {
    code: 'ABCDEFGHJK', exercice: 'm10-tournage-vc', matricule: '2412345', nom: 'Tremblay', prenom: 'Camille',
    reussite: '2026-09-21T13:48:10.000Z', revision: 'r0', questions: '17', signature: SIGNATURE,
  });
  assert.deepEqual(readClaims({ code: 'abcde-fghjk' }), { code: 'ABCDEFGHJK', exercice: null, matricule: null, nom: null, prenom: null, reussite: null, revision: null, questions: null, signature: null });
  assert.equal(readClaims({ code: 'ABC' }), null);
  assert.equal(readClaims({}), null);
  assert.equal(readClaims(null), null);
});

test('claimsOnlyCode et claimsMatch : le code seul, ou tout doit correspondre — un champ absent ou modifié suffit à refuser', () => {
  const full = readClaims(new URL(verificationUrl('https://quiz.example', RECORD, SIGNATURE)).searchParams);
  assert.equal(claimsOnlyCode(full), false);
  assert.equal(claimsMatch(RECORD, full), true);
  assert.equal(claimsOnlyCode(readClaims({ code: 'ABCDE-FGHJK' })), true);
  assert.equal(claimsOnlyCode(readClaims({ code: 'ABCDE-FGHJK', nom: 'Tremblay' })), false);
  for (const [field, value] of [['nom', 'Roy'], ['prenom', 'Alex'], ['matricule', '2412346'], ['questions', '18'], ['revision', 'r1'], ['reussite', '2026-09-21T13:48:11.000Z'], ['exercice', 'autre'], ['nom', null]]) {
    assert.equal(claimsMatch(RECORD, { ...full, [field]: value }), false, `${field} = ${value}`);
  }
  assert.equal(claimsMatch(RECORD, { ...full, code: 'ABCDEFGHJJ' }), false);
});
