// Tests de site/js/correction.js : tolérances de la SPEC §6 (décisions D13 et D15), une case du tableau à la fois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANSWER_FIELDS, gradeAnswers, parseAnswer, toleranceLabel } from '../site/js/correction.js';
import { computeParameters } from '../site/js/calcul.js';
import { formatParameters } from '../site/js/format.js';
import { data, questionPour } from './aide.js';

// Valeurs théoriques des cas de référence de tests/calcul.test.js (une par famille d'avance).
// feedRate est écrit comme le moteur le calcule, bruit de virgule flottante compris.
const PROPORTIONNELLE = { // foret fractionnaire Ø 1/4 po, acier rapide, acier 1020
  vc: 100, rpmRaw: 1600, rpm: 1600, rpmCapped: false, feedPerTooth: 0.0015, feedPerToothCapped: false,
  teeth: 2, feedPerRev: 0.003, feedRate: 1600 * 0.003, feedType: 'proportional',
};
const FIXE = { // MVLNR, Ø charioté 2.000", insert de carbure, acier 1020
  vc: 400, rpmRaw: 800, rpm: 800, rpmCapped: false, feedPerTooth: 0.005, feedPerToothCapped: false,
  teeth: 1, feedPerRev: 0.005, feedRate: 800 * 0.005, feedType: 'fixed',
};
const FILETAGE = { // taraud 1 - 8 UNC, acier rapide, acier 1020
  vc: 100, rpmRaw: 400, rpm: 400, rpmCapped: false, feedPerTooth: 0.125, feedPerToothCapped: false,
  teeth: 1, feedPerRev: 0.125, feedRate: 400 * 0.125, feedType: 'thread',
};

// Bonnes réponses de chaque cas, telles qu'un étudiant les saisirait.
const BONNES = new Map([
  [PROPORTIONNELLE, { vc: '100', feedPerTooth: '0.0015', rpm: '1600', feedPerRev: '0.003', feedRate: '4.8' }],
  [FIXE, { vc: '400', feedPerTooth: '0.005', rpm: '800', feedPerRev: '0.005', feedRate: '4' }],
  [FILETAGE, { vc: '100', feedPerTooth: '0.125', rpm: '400', feedPerRev: '0.125', feedRate: '50' }],
]);

// Corrige un cas où seul `champ` diffère des bonnes réponses ; retourne le résultat de ce champ.
function corrigerChamp(attendu, champ, saisie) {
  const reponses = { ...BONNES.get(attendu), [champ]: saisie };
  // f est jugée sur fz_saisi × dents (D69), Vf sur N_saisi × f_saisi (D15) : on les garde cohérentes avec les saisies.
  const fz = parseAnswer(reponses.feedPerTooth);
  if (champ === 'feedPerTooth' && fz !== null) reponses.feedPerRev = String(fz * attendu.teeth);
  const n = parseAnswer(reponses.rpm);
  const f = parseAnswer(reponses.feedPerRev);
  if (champ !== 'feedRate' && n !== null && f !== null) reponses.feedRate = String(n * f);

  const resultat = gradeAnswers(attendu, reponses);
  for (const autre of ANSWER_FIELDS.filter((c) => c !== champ)) assert.equal(resultat.fields[autre].ok, true, `${autre} devrait rester bon`);
  assert.equal(resultat.success, resultat.fields[champ].ok);
  return resultat.fields[champ];
}

// Une ligne par case du tableau de la SPEC §6, sauf f et Vf (plus bas) :
// [famille, valeurs théoriques, champ, tolérance, min, max, saisie juste sous min, saisie juste au-dessus de max]
// D13 : l'intervalle n'est jamais plus étroit qu'une demi-unité du dernier chiffre affiché.
const CASES = [
  ['filetage', FILETAGE, 'vc', 'exact, affiché « 100 » → ±0,5', 99.5, 100.5, '99.49', '100.51'],
  ['filetage', FILETAGE, 'feedPerTooth', '±0,1 %', 0.124875, 0.125125, '0.1248749', '0.1251251'], // 0,125 × 0,999 et × 1,001 (> ±0,000005)
  ['filetage', FILETAGE, 'rpm', 'de −90 % à +0,1 %, affiché « 400 » → +0,5', 40, 400.5, '39.99', '400.51'], // 400 × 0,1 ; +0,1 % = 400,4 < 400,5

  ['avance fixe', FIXE, 'vc', 'exact, affiché « 400 » → ±0,5', 399.5, 400.5, '399.49', '400.51'],
  ['avance fixe', FIXE, 'feedPerTooth', 'exact, affiché « 0.0050 » → ±0,00005', 0.00495, 0.00505, '0.004949', '0.005051'],
  ['avance fixe', FIXE, 'rpm', '±5 % et ±1 rév/min', 759, 841, '758.9', '841.1'], // 800 × 0,95 − 1 et × 1,05 + 1 (D13, complément)

  ['avance proportionnelle', PROPORTIONNELLE, 'vc', 'exact, affiché « 100 » → ±0,5', 99.5, 100.5, '99.49', '100.51'],
  ['avance proportionnelle', PROPORTIONNELLE, 'feedPerTooth', '±25 %, borné à ±0,001 po', 0.001125, 0.001875, '0.0011249', '0.0018751'], // 0,0015 × 0,75 et × 1,25
  ['avance proportionnelle', PROPORTIONNELLE, 'rpm', '±5 % et ±1 rév/min', 1519, 1681, '1518.9', '1681.1'], // 1600 × 0,95 − 1 et × 1,05 + 1
];

for (const [famille, attendu, champ, tolerance, min, max, sousMin, surMax] of CASES) {
  test(`SPEC §6 — ${famille}, ${champ} : ${tolerance} → [${min} ; ${max}]`, () => {
    // Les bornes sont incluses, des deux côtés, et retournées telles quelles.
    assert.deepEqual(corrigerChamp(attendu, champ, String(min)), { ok: true, value: min, min, max });
    assert.deepEqual(corrigerChamp(attendu, champ, String(max)), { ok: true, value: max, min, max });
    // Juste à l'extérieur, des deux côtés.
    assert.deepEqual(corrigerChamp(attendu, champ, sousMin), { ok: false, value: Number(sousMin), min, max });
    assert.deepEqual(corrigerChamp(attendu, champ, surMax), { ok: false, value: Number(surMax), min, max });
  });
}

// f (D69) : fz saisie et lisible → cohérence, ±0,1 % de fz_saisi × dents, fz étant pris à la précision de son
// affichage (D13), comme N et f pour Vf :
//   min = (fz − ½ unité) × dents, moins 0,1 % ou la ½ unité de f      max = (fz + ½ unité) × dents, plus 0,1 % ou la ½ unité de f
// [famille, valeurs théoriques, min, max, dernière saisie refusée, première acceptée, dernière acceptée, première refusée]
const CASES_F = [
  ['filetage', FILETAGE, 0.124995 * 0.999, 0.125005 * 1.001, '0.12487', '0.124871', '0.12513', '0.125131'], // fz « 0.125 », 1 dent : ±0,1 % l'emporte
  ['avance fixe', FIXE, 0.00495 - 0.00005, 0.00505 + 0.00005, '0.004899', '0.0049', '0.0051', '0.005101'], // fz « 0.005 », 1 dent : la ½ unité de f l'emporte
  ['avance proportionnelle', PROPORTIONNELLE, 0.0029 - 0.00005, 0.0031 + 0.00005, '0.002849', '0.00285', '0.00315', '0.003151'], // fz « 0.0015 », 2 dents
];

for (const [famille, attendu, min, max, sousMin, dansMin, dansMax, surMax] of CASES_F) {
  test(`D69 — ${famille}, feedPerRev : ±0,1 % de fz_saisi × dents`, () => {
    const bornes = corrigerChamp(attendu, 'feedPerRev', dansMin);
    assert.ok(Math.abs(bornes.min - min) < 1e-12 && Math.abs(bornes.max - max) < 1e-12, `[${bornes.min} ; ${bornes.max}] ≠ [${min} ; ${max}]`);
    assert.equal(corrigerChamp(attendu, 'feedPerRev', sousMin).ok, false);
    assert.equal(corrigerChamp(attendu, 'feedPerRev', dansMin).ok, true);
    assert.equal(corrigerChamp(attendu, 'feedPerRev', dansMax).ok, true);
    assert.equal(corrigerChamp(attendu, 'feedPerRev', surMax).ok, false);
  });
}

// Foret fractionnaire Ø 1/2 po, 2 lèvres, acier rapide, acier 1020 : N = 100 × 4 / 0.5 = 800 ; fz = 0.006 × 0.5 = 0.003
// (affiché « 0.0030 ») ; f = 0.006 ; Vf = 4.8. fz est tolérée à ±25 %, au plus ±0.001 po : [0.00225 ; 0.00375].
const FORET_DEMI = computeParameters(questionPour({ outil: 'foret_fractionnaire', dimension: 'Ø 1/2 po', dents: 2, materiauOutil: 'Acier rapide', groupeMateriau: 1 }), data);
const FORET_UN = computeParameters(questionPour({ outil: 'foret_fractionnaire', dimension: 'Ø 1 po', dents: 2, materiauOutil: 'Acier rapide', groupeMateriau: 1 }), data);
const saisiesForet = (fz, f) => ({ vc: '100', feedPerTooth: fz, rpm: '800', feedPerRev: f, feedRate: String(800 * Number(f)) });
const SANS_FZ = ['vc', 'rpm', 'feedPerRev', 'feedRate']; // fz fournie ou masquée : elle n'est pas corrigée

test('D69 : foret Ø 1/2 po, fz « 0.0037 » et f « 0.0074 » → les deux justes (f cohérente avec le fz saisi)', () => {
  assert.deepEqual([FORET_DEMI.rpm, FORET_DEMI.feedPerTooth, FORET_DEMI.teeth, FORET_DEMI.feedPerRev, FORET_DEMI.feedType], [800, 0.003, 2, 0.006, 'proportional']);
  const resultat = gradeAnswers(FORET_DEMI, saisiesForet('0.0037', '0.0074'));
  assert.equal(resultat.fields.feedPerTooth.ok, true); // +23 %, dans [0.00225 ; 0.00375]
  assert.equal(resultat.fields.feedPerRev.ok, true); // 0.0037 × 2
  assert.equal(resultat.success, true);
  // Avant D69, f était jugée sur la valeur théorique à ±20 % : [0.0048 ; 0.0072], et 0.0074 était refusée.
  assert.ok(0.0074 > 0.006 * 1.2);
});

test('D69 : fz fausse mais f cohérente avec elle → fz refusée, f acceptée ; f théorique mais incohérente → refusée', () => {
  const coherente = gradeAnswers(FORET_DEMI, saisiesForet('0.005', '0.010'));
  assert.equal(coherente.fields.feedPerTooth.ok, false); // 0.005 > 0.00375
  assert.equal(coherente.fields.feedPerRev.ok, true); // 0.005 × 2
  assert.equal(coherente.success, false); // l'erreur est comptée sur fz, là où elle a été faite

  const theorique = gradeAnswers(FORET_DEMI, saisiesForet('0.005', '0.006'));
  assert.equal(theorique.fields.feedPerRev.ok, false); // la f théorique n'est pas 0.005 × 2
});

test('D69 : fz fournie ou masquée → f jugée sur la valeur théorique, tolérance de fz reportée (±25 %, au plus ±0.001 po par dent)', () => {
  const f = (attendu, saisie) => gradeAnswers(attendu, { vc: '100', rpm: String(attendu.rpm), feedPerRev: saisie, feedRate: String(attendu.rpm * Number(saisie)) }, SANS_FZ).fields.feedPerRev;
  // Ø 1/2 po : f = 0.006 ; ±25 % = ±0.0015, plus étroit que ±0.001 × 2 dents → [0.0045 ; 0.0075]
  assert.deepEqual(f(FORET_DEMI, '0.0045'), { ok: true, value: 0.0045, min: 0.0045, max: 0.0075 });
  assert.deepEqual(f(FORET_DEMI, '0.0075'), { ok: true, value: 0.0075, min: 0.0045, max: 0.0075 });
  assert.equal(f(FORET_DEMI, '0.0044').ok, false);
  assert.equal(f(FORET_DEMI, '0.0076').ok, false);
  // Ø 1 po : f = 0.012 ; ±25 % = ±0.003, plus large que ±0.001 × 2 dents → [0.010 ; 0.014] (et non ±0.001 : [0.011 ; 0.013])
  assert.deepEqual(f(FORET_UN, '0.0105'), { ok: true, value: 0.0105, min: 0.01, max: 0.014 });
  assert.equal(f(FORET_UN, '0.0099').ok, false);
  assert.equal(f(FORET_UN, '0.0141').ok, false);
});

test('D69 : fz non corrigée → une fz envoyée quand même par le navigateur ne compte pas', () => {
  // Cohérente avec 0.0038 × 2, f = 0.0076 serait acceptée ; fz n'étant pas à saisir, c'est la tolérance reportée qui s'applique.
  const resultat = gradeAnswers(FORET_DEMI, saisiesForet('0.0038', '0.0076'), SANS_FZ);
  assert.equal(resultat.fields.feedPerRev.ok, false);
  assert.deepEqual([resultat.fields.feedPerRev.min, resultat.fields.feedPerRev.max], [0.0045, 0.0075]);
});

test('D69 : fz à saisir mais vide ou illisible → f jugée comme si fz était fournie (tolérance reportée)', () => {
  for (const fz of ['', 'abc']) {
    const resultat = gradeAnswers(FORET_DEMI, saisiesForet(fz, '0.0074'));
    assert.equal(resultat.fields.feedPerTooth.ok, false, fz);
    assert.deepEqual(resultat.fields.feedPerRev, { ok: true, value: 0.0074, min: 0.0045, max: 0.0075 }, fz);
    assert.equal(gradeAnswers(FORET_DEMI, saisiesForet(fz, '0.0076')).fields.feedPerRev.ok, false, fz);
  }
});

test('D69 : avance fixe et filetage, fz non saisie → f à ±0,1 % de la valeur théorique (et la ½ unité de f, D13)', () => {
  const f = (attendu, saisie) => gradeAnswers(attendu, { vc: String(attendu.vc), rpm: String(attendu.rpm), feedPerRev: saisie, feedRate: String(attendu.rpm * Number(saisie)) }, SANS_FZ).fields.feedPerRev;
  // Filetage : 0.125 × 0.999 et × 1.001 (plus large que ±0.000005)
  assert.deepEqual(f(FILETAGE, '0.124875'), { ok: true, value: 0.124875, min: 0.124875, max: 0.125125 });
  assert.equal(f(FILETAGE, '0.1248749').ok, false);
  assert.equal(f(FILETAGE, '0.1251251').ok, false);
  // Avance fixe : ±0.1 % = ±0.000005, plus étroit que la ½ unité de « 0.0050 » → [0.00495 ; 0.00505]
  assert.deepEqual(f(FIXE, '0.00505'), { ok: true, value: 0.00505, min: 0.00495, max: 0.00505 });
  assert.equal(f(FIXE, '0.004949').ok, false);
  assert.equal(f(FIXE, '0.005051').ok, false);
});

// Vf (D15) : ±0,5 % de N_saisi × f_saisi — ±0,01 % en filetage (D53) —, N et f étant pris à la précision
// de leur affichage (D13).
//   min = (N − ½ unité) × (f − ½ unité) × (1 − t)      max = (N + ½ unité) × (f + ½ unité) × (1 + t)
// [famille, valeurs théoriques, min, max, dernière saisie refusée, première acceptée, dernière acceptée, première refusée]
const CASES_VF = [
  ['filetage', FILETAGE, 399.5 * 0.124995 * 0.9999, 400.5 * 0.125005 * 1.0001, '49.93', '49.931', '50.069', '50.07'], // [49,9305… ; 50,0695…]
  ['avance fixe', FIXE, 799.5 * 0.00495 * 0.995, 800.5 * 0.00505 * 1.005, '3.937', '3.938', '4.062', '4.063'], // [3,9377… ; 4,0627…]
  ['avance proportionnelle', PROPORTIONNELLE, 1599.5 * 0.00295 * 0.995, 1600.5 * 0.00305 * 1.005, '4.694', '4.695', '4.905', '4.906'], // [4,6949… ; 4,9059…]
];

for (const [famille, attendu, min, max, sousMin, dansMin, dansMax, surMax] of CASES_VF) {
  test(`SPEC §6 — ${famille}, feedRate : ${attendu.feedType === 'thread' ? '±0,01 %' : '±0,5 %'} de N_saisi × f_saisi`, () => {
    const bornes = corrigerChamp(attendu, 'feedRate', dansMin);
    assert.ok(Math.abs(bornes.min - min) < 1e-9 && Math.abs(bornes.max - max) < 1e-9, `[${bornes.min} ; ${bornes.max}] ≠ [${min} ; ${max}]`);
    assert.equal(corrigerChamp(attendu, 'feedRate', sousMin).ok, false);
    assert.equal(corrigerChamp(attendu, 'feedRate', dansMin).ok, true);
    assert.equal(corrigerChamp(attendu, 'feedRate', dansMax).ok, true);
    assert.equal(corrigerChamp(attendu, 'feedRate', surMax).ok, false);
  });
}

test('toutes les bonnes réponses → success, pour chaque famille', () => {
  for (const [attendu, reponses] of BONNES) {
    const resultat = gradeAnswers(attendu, reponses);
    assert.equal(resultat.success, true, attendu.feedType);
    assert.deepEqual(Object.keys(resultat.fields), ANSWER_FIELDS);
  }
});

test('« borné à ±0,001 po », petit fz = 0,0015 : c’est ±25 % qui est le plus étroit', () => {
  // ±25 % = ±0,000375 po < ±0,001 po → [0,001125 ; 0,001875]
  assert.equal(corrigerChamp(PROPORTIONNELLE, 'feedPerTooth', '0.0012').ok, true);
  assert.equal(corrigerChamp(PROPORTIONNELLE, 'feedPerTooth', '0.0018').ok, true);
  assert.equal(corrigerChamp(PROPORTIONNELLE, 'feedPerTooth', '0.0011').ok, false); // dans ±0,001 po, mais hors ±25 %
  assert.equal(corrigerChamp(PROPORTIONNELLE, 'feedPerTooth', '0.0020').ok, false);
});

test('« borné à ±0,001 po », grand fz = 0,006 : c’est ±0,001 po qui est le plus étroit', () => {
  // Foret fractionnaire Ø 1 po, acier rapide, acier 1020 : N = 100 × 4 / 1 = 400 ; fz = 0,006 × 1 ; f = 0,012 ; Vf = 4,8
  const attendu = { vc: 100, rpmRaw: 400, rpm: 400, rpmCapped: false, feedPerTooth: 0.006, feedPerToothCapped: false, teeth: 2, feedPerRev: 0.012, feedRate: 400 * 0.012, feedType: 'proportional' };
  const reponses = { vc: '100', feedPerTooth: '0.006', rpm: '400', feedPerRev: '0.012', feedRate: '4.8' };
  const fz = (saisie) => gradeAnswers(attendu, { ...reponses, feedPerTooth: saisie }).fields.feedPerTooth;

  // ±25 % = ±0,0015 po > ±0,001 po → [0,005 ; 0,007]
  assert.deepEqual(fz('0.005'), { ok: true, value: 0.005, min: 0.005, max: 0.007 });
  assert.deepEqual(fz('0.007'), { ok: true, value: 0.007, min: 0.005, max: 0.007 });
  assert.equal(fz('0.0049').ok, false); // dans ±25 % (≥ 0,0045), mais hors ±0,001 po
  assert.equal(fz('0.0071').ok, false); // dans ±25 % (≤ 0,0075), mais hors ±0,001 po
});

test('D13 : la demi-unité d’affichage élargit une tolérance plus étroite qu’elle, jamais l’inverse', () => {
  // N de filetage : +0,1 % de 400 = 400,4 ; affiché à l'entier → 400,5 accepté. La borne basse (−90 %) ne bouge pas.
  assert.equal(corrigerChamp(FILETAGE, 'rpm', '400.5').ok, true);
  assert.equal(corrigerChamp(FILETAGE, 'rpm', '40').ok, true);
  // N hors filetage : ±5 % de 1600 = ±80, plus ±1 rév/min, bien plus large que ±0,5 → inchangé.
  assert.deepEqual(corrigerChamp(PROPORTIONNELLE, 'rpm', '1600'), { ok: true, value: 1600, min: 1519, max: 1681 });
});

test('D15 : Vf est jugée sur N_saisi × f_saisi, pas sur la valeur théorique (filetage, N réduit)', () => {
  // L'étudiant réduit N à 200 rév/min (permis : −90 %) ; f = 0,125 → Vf cohérente = 25
  // min = 199,5 × 0,124995 × 0,9999 = 24,934… ; max = 200,5 × 0,125005 × 1,0001 = 25,066… (filetage : ±0,01 %, D53)
  const reponses = { ...BONNES.get(FILETAGE), rpm: '200' };
  const vf = (saisie) => gradeAnswers(FILETAGE, { ...reponses, feedRate: saisie });

  assert.equal(vf('25').success, true);
  assert.equal(vf('24.935').fields.feedRate.ok, true);
  assert.equal(vf('25.066').fields.feedRate.ok, true);
  assert.equal(vf('24.933').fields.feedRate.ok, false);
  assert.equal(vf('25.067').fields.feedRate.ok, false);
  assert.equal(vf('50').fields.feedRate.ok, false); // la Vf théorique n'est pas cohérente avec N = 200
});

test('D15 : hors filetage aussi, une Vf cohérente avec les saisies est bonne, même loin de la théorie', () => {
  // N = 1680 (+5 %, bon), fz = 0,0018 (+20 %, bon) et f = 0,0036 (cohérente, D69) → N × f = 6,048, soit +26 % sur la Vf théorique de 4,8
  const reponses = { ...BONNES.get(PROPORTIONNELLE), feedPerTooth: '0.0018', rpm: '1680', feedPerRev: '0.0036' };
  const coherente = gradeAnswers(PROPORTIONNELLE, { ...reponses, feedRate: '6.048' });
  assert.equal(coherente.success, true);

  // À l'inverse, la Vf théorique n'est plus cohérente avec ces saisies.
  const theorique = gradeAnswers(PROPORTIONNELLE, { ...reponses, feedRate: '4.8' });
  assert.equal(theorique.fields.feedRate.ok, false);
  assert.equal(theorique.success, false);
});

test('D15 : Vf cohérente avec un N faux reste bonne, mais la question échoue sur N', () => {
  const resultat = gradeAnswers(FILETAGE, { ...BONNES.get(FILETAGE), rpm: '800', feedRate: '100' });
  assert.equal(resultat.fields.rpm.ok, false); // 800 > 400,5
  assert.equal(resultat.fields.feedRate.ok, true); // 800 × 0,125 = 100
  assert.equal(resultat.success, false);
});

test('D15 : si N ou f n’est pas lisible, sa valeur théorique le remplace dans la référence de Vf', () => {
  const resultat = gradeAnswers(FILETAGE, { ...BONNES.get(FILETAGE), rpm: '' });
  assert.equal(resultat.fields.feedRate.ok, true); // 400 × 0,125 = 50
  assert.equal(resultat.fields.rpm.ok, false);
  assert.equal(resultat.success, false); // N vide
});

test('SPEC §6 : un N fourni, envoyé quand même par le navigateur, n’entre pas dans la cohérence de Vf', () => {
  // N n'est pas à saisir : c'est sa valeur théorique (400) qui compte, pas « 200 ».
  assert.equal(gradeAnswers(FILETAGE, { rpm: '200', feedRate: '25' }, ['feedRate']).fields.feedRate.ok, false);
  assert.equal(gradeAnswers(FILETAGE, { rpm: '200', feedRate: '50' }, ['feedRate']).fields.feedRate.ok, true);
});

test('parseAnswer : point ou virgule, espaces ignorés', () => {
  assert.equal(parseAnswer('0.0015'), 0.0015);
  assert.equal(parseAnswer('0,0015'), 0.0015);
  assert.equal(parseAnswer(' 1600 '), 1600);
  assert.equal(parseAnswer('1 600'), 1600);
  assert.equal(parseAnswer('1 600,5'), 1600.5); // espace insécable
  assert.equal(parseAnswer('.5'), 0.5);
  assert.equal(parseAnswer(',5'), 0.5);
  assert.equal(parseAnswer('5.'), 5);
  assert.equal(parseAnswer('0'), 0);
});

test('parseAnswer : vide ou illisible → null', () => {
  for (const saisie of ['', '   ', 'abc', '12abc', '1.2.3', '1,2,3', '1,600.5', '-5', '+5', '1e3', '.', ',', null, undefined, 1600]) {
    assert.equal(parseAnswer(saisie), null, String(saisie));
  }
});

test('la virgule et le point donnent la même correction', () => {
  const resultat = gradeAnswers(PROPORTIONNELLE, { vc: '100', feedPerTooth: '0,0015', rpm: '1 600', feedPerRev: '0,003', feedRate: '4,8' });
  assert.equal(resultat.success, true);
  assert.equal(resultat.fields.feedPerTooth.value, 0.0015);
});

test('champ vide : non répondu → faux, value null, intervalle quand même fourni', () => {
  assert.deepEqual(corrigerChamp(PROPORTIONNELLE, 'rpm', ''), { ok: false, value: null, min: 1519, max: 1681 });
  assert.deepEqual(corrigerChamp(PROPORTIONNELLE, 'rpm', 'mille six cents'), { ok: false, value: null, min: 1519, max: 1681 });

  const sansCle = { ...BONNES.get(FIXE) };
  delete sansCle.feedRate; // champ absent des réponses
  const vf = gradeAnswers(FIXE, sansCle).fields.feedRate;
  assert.equal(vf.ok, false);
  assert.equal(vf.value, null);
  assert.ok(vf.min < 4 && vf.max > 4);
});

test('fieldsToGrade : les champs non corrigés (pré-remplis) sont réputés corrects', () => {
  // Exercice M10 « Vc seulement » : seule Vc est saisie.
  const bon = gradeAnswers(FIXE, { vc: '400' }, ['vc']);
  assert.equal(bon.success, true);
  assert.deepEqual(bon.fields.vc, { ok: true, value: 400, min: 399.5, max: 400.5 });
  for (const champ of ['feedPerTooth', 'rpm', 'feedPerRev', 'feedRate']) {
    assert.deepEqual(bon.fields[champ], { ok: true, value: null, min: null, max: null });
  }

  const mauvais = gradeAnswers(FIXE, { vc: '390' }, ['vc']);
  assert.equal(mauvais.success, false);
  assert.equal(mauvais.fields.vc.ok, false);
});

test('fieldsToGrade : Vf seule corrigée → N et f pré-remplis, donc remplacés par leur valeur théorique', () => {
  const resultat = gradeAnswers(FILETAGE, { feedRate: '50' }, ['feedRate']);
  assert.equal(resultat.success, true);
  assert.equal(resultat.fields.feedRate.value, 50);
  assert.equal(gradeAnswers(FILETAGE, { feedRate: '51' }, ['feedRate']).success, false);
});

test('erreurs de programmation : champ à corriger ou famille inconnus', () => {
  assert.throws(() => gradeAnswers(FIXE, {}, ['vitesse']), /Champ à corriger inconnu : « vitesse »/);
  assert.throws(() => gradeAnswers({ ...FIXE, feedType: 'autre' }, {}), /Famille d'avance inconnue : « autre »/);
  assert.throws(() => gradeAnswers({ ...FIXE, teeth: undefined }, {}), /Nombre de dents inconnu/);
});

test('le résultat est sérialisable en JSON', () => {
  const resultat = gradeAnswers(FILETAGE, BONNES.get(FILETAGE));
  assert.deepEqual(JSON.parse(JSON.stringify(resultat)), resultat);
});

// --- D53 : Vf en filetage à ±0,01 % de N_saisi × f_saisi (les autres familles restent à ±0,5 %) ---------------------
// Taraud métrique M10 x 1.50, acier rapide, acier 1020 : Vc 100, N = 100 × 4 / 0.3937 = 1016 → plafonnée à 1000 ;
// f = pas = 1.5 / 25.4 = 0.05905511… po (affiché « 0.05906 ») ; Vf exacte = 59.0551… (affichée « 59.055 »).
const TARAUD_M10 = computeParameters(questionPour({ outil: 'taraud_metrique', dimension: 'M10 x 1.50', dents: 1, materiauOutil: 'Acier rapide', groupeMateriau: 1 }), data);
const AFFICHE_M10 = formatParameters(TARAUD_M10);

test('D53, filetage : f saisi arrondi à l’affichage (0.05906) et Vf calculée avec le pas exact (59.055) → acceptée', () => {
  assert.deepEqual([TARAUD_M10.feedType, AFFICHE_M10.rpm, AFFICHE_M10.feedPerRev, AFFICHE_M10.feedRate], ['thread', '1000', '0.05906', '59.055']);
  const resultat = gradeAnswers(TARAUD_M10, { vc: '100', feedPerTooth: '0.05906', rpm: '1000', feedPerRev: '0.05906', feedRate: '59.055' });
  assert.equal(resultat.success, true);
});

test('D53, filetage : Vf calculée sur le pas arrondi (1000 × 0.05906 = 59.06) → acceptée', () => {
  const resultat = gradeAnswers(TARAUD_M10, { vc: '100', feedPerTooth: '0.05906', rpm: '1000', feedPerRev: '0.05906', feedRate: '59.06' });
  assert.equal(resultat.fields.feedRate.ok, true);
  assert.equal(resultat.success, true);
});

test('D53, filetage : une Vf décalée de 0,1 % (59.119) → refusée, alors que ±0,5 % l’aurait acceptée', () => {
  const resultat = gradeAnswers(TARAUD_M10, { vc: '100', feedPerTooth: '0.05906', rpm: '1000', feedPerRev: '0.05906', feedRate: String(Number((59.06 * 1.001).toFixed(3))) });
  assert.equal(resultat.fields.feedRate.ok, false);
  assert.ok(resultat.fields.feedRate.max < 59.119 && resultat.fields.feedRate.max > 59.09, `max = ${resultat.fields.feedRate.max}`); // N ± 0.5 et f ± 0.000005, puis ±0,01 % et la demi-unité de Vf
  assert.ok(59.119 < 59.06 * 1.005); // sous l'ancienne tolérance de ±0,5 %, elle passait
  assert.equal(resultat.success, false);
});

test('D53, filetage : une Vf cohérente avec un N saisi faux (1002 → Vf 59.178) → Vf acceptée, N refusé', () => {
  const resultat = gradeAnswers(TARAUD_M10, { vc: '100', feedPerTooth: '0.05906', rpm: '1002', feedPerRev: '0.05906', feedRate: '59.178' });
  assert.equal(resultat.fields.feedRate.ok, true);
  assert.equal(resultat.fields.rpm.ok, false); // filetage : de −90 % à +0,1 % ; 1002 dépasse
  assert.equal(resultat.success, false);
});

test('D53 : les autres familles gardent ±0,5 % pour Vf', () => {
  assert.equal(gradeAnswers(FIXE, { ...BONNES.get(FIXE), feedRate: String(800 * 0.005 * 1.004) }).fields.feedRate.ok, true);
  assert.equal(gradeAnswers(PROPORTIONNELLE, { ...BONNES.get(PROPORTIONNELLE), feedRate: String(4.8 * 1.004) }).fields.feedRate.ok, true);
  assert.equal(gradeAnswers(FILETAGE, { ...BONNES.get(FILETAGE), feedRate: String(50 * 1.004) }).fields.feedRate.ok, false);
});

test('toleranceLabel : la tolérance de chaque champ, en clair, telle que le tableau de la SPEC §6', () => {
  const ligne = (type) => ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate'].map((champ) => toleranceLabel(type, champ));
  // f : fz non saisie, la tolérance de fz reportée (D69)
  assert.deepEqual(ligne('thread'), ['exacte', '±0.1 %', 'de −90 % à +0.1 %', '±0.1 %', '±0.01 % de N × f']); // D53
  assert.deepEqual(ligne('fixed'), ['exacte', 'exacte', '±5 % et ±1 rév/min', '±0.1 %', '±0.5 % de N × f']);
  assert.deepEqual(ligne('proportional'), ['exacte', '±25 %, au plus ±0.001 po', '±5 % et ±1 rév/min', '±25 %, au plus ±0.001 po par dent', '±0.5 % de N × f']);
  // f : fz saisie et lisible, la cohérence (D69), pour toutes les familles
  for (const type of ['thread', 'fixed', 'proportional']) assert.equal(toleranceLabel(type, 'feedPerRev', { coherence: true }), '±0.1 % de fz × dents');
  assert.throws(() => toleranceLabel('inconnue', 'vc'), /Tolérance inconnue/);
  assert.throws(() => toleranceLabel('inconnue', 'feedPerRev', { coherence: true }), /Tolérance inconnue/);
});
