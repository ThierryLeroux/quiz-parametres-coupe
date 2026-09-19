// Tests de site/js/correction.js : tolérances de la SPEC §6 (décisions D13 et D15), une case du tableau à la fois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANSWER_FIELDS, gradeAnswers, parseAnswer } from '../site/js/correction.js';

// Valeurs théoriques des cas de référence de tests/calcul.test.js (une par famille d'avance).
// feedRate est écrit comme le moteur le calcule, bruit de virgule flottante compris.
const PROPORTIONNELLE = { // foret fractionnaire Ø 1/4 po, acier rapide, acier 1020
  vc: 100, rpmRaw: 1600, rpm: 1600, rpmCapped: false, feedPerTooth: 0.0015, feedPerToothCapped: false,
  feedPerRev: 0.003, feedRate: 1600 * 0.003, feedType: 'proportional',
};
const FIXE = { // MVLNR, Ø charioté 2.000", insert de carbure, acier 1020
  vc: 400, rpmRaw: 800, rpm: 800, rpmCapped: false, feedPerTooth: 0.005, feedPerToothCapped: false,
  feedPerRev: 0.005, feedRate: 800 * 0.005, feedType: 'fixed',
};
const FILETAGE = { // taraud 1 - 8 UNC, acier rapide, acier 1020
  vc: 100, rpmRaw: 400, rpm: 400, rpmCapped: false, feedPerTooth: 0.125, feedPerToothCapped: false,
  feedPerRev: 0.125, feedRate: 400 * 0.125, feedType: 'thread',
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
  // Vf est jugée sur N_saisi × f_saisi (D15) : on la garde cohérente avec les saisies de N et de f.
  const n = parseAnswer(reponses.rpm);
  const f = parseAnswer(reponses.feedPerRev);
  if (champ !== 'feedRate' && n !== null && f !== null) reponses.feedRate = String(n * f);

  const resultat = gradeAnswers(attendu, reponses);
  for (const autre of ANSWER_FIELDS.filter((c) => c !== champ)) assert.equal(resultat.fields[autre].ok, true, `${autre} devrait rester bon`);
  assert.equal(resultat.success, resultat.fields[champ].ok);
  return resultat.fields[champ];
}

// Une ligne par case du tableau de la SPEC §6, sauf Vf (plus bas) :
// [famille, valeurs théoriques, champ, tolérance, min, max, saisie juste sous min, saisie juste au-dessus de max]
// D13 : l'intervalle n'est jamais plus étroit qu'une demi-unité du dernier chiffre affiché.
const CASES = [
  ['filetage', FILETAGE, 'vc', 'exact, affiché « 100 » → ±0,5', 99.5, 100.5, '99.49', '100.51'],
  ['filetage', FILETAGE, 'feedPerTooth', '±0,1 %', 0.124875, 0.125125, '0.1248749', '0.1251251'], // 0,125 × 0,999 et × 1,001 (> ±0,000005)
  ['filetage', FILETAGE, 'rpm', 'de −90 % à +0,1 %, affiché « 400 » → +0,5', 40, 400.5, '39.99', '400.51'], // 400 × 0,1 ; +0,1 % = 400,4 < 400,5
  ['filetage', FILETAGE, 'feedPerRev', '±0,1 %', 0.124875, 0.125125, '0.1248749', '0.1251251'],

  ['avance fixe', FIXE, 'vc', 'exact, affiché « 400 » → ±0,5', 399.5, 400.5, '399.49', '400.51'],
  ['avance fixe', FIXE, 'feedPerTooth', 'exact, affiché « 0.0050 » → ±0,00005', 0.00495, 0.00505, '0.004949', '0.005051'],
  ['avance fixe', FIXE, 'rpm', '±5 %', 760, 840, '759.9', '840.1'], // 800 × 0,95 et × 1,05
  ['avance fixe', FIXE, 'feedPerRev', '±0,1 %, affiché « 0.0050 » → ±0,00005', 0.00495, 0.00505, '0.004949', '0.005051'], // ±0,1 % = ±0,000005, plus étroit

  ['avance proportionnelle', PROPORTIONNELLE, 'vc', 'exact, affiché « 100 » → ±0,5', 99.5, 100.5, '99.49', '100.51'],
  ['avance proportionnelle', PROPORTIONNELLE, 'feedPerTooth', '±25 %, borné à ±0,001 po', 0.001125, 0.001875, '0.0011249', '0.0018751'], // 0,0015 × 0,75 et × 1,25
  ['avance proportionnelle', PROPORTIONNELLE, 'rpm', '±5 %', 1520, 1680, '1519.9', '1680.1'], // 1600 × 0,95 et × 1,05
  ['avance proportionnelle', PROPORTIONNELLE, 'feedPerRev', '±20 %', 0.0024, 0.0036, '0.0023999', '0.0036001'], // 0,003 × 0,8 et × 1,2
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

// Vf (D15), même règle pour les trois familles : ±0,5 % de N_saisi × f_saisi, N et f étant pris à
// la précision de leur affichage (D13).
//   min = (N − ½ unité) × (f − ½ unité) × 0,995      max = (N + ½ unité) × (f + ½ unité) × 1,005
// [famille, valeurs théoriques, min, max, dernière saisie refusée, première acceptée, dernière acceptée, première refusée]
const CASES_VF = [
  ['filetage', FILETAGE, 399.5 * 0.124995 * 0.995, 400.5 * 0.125005 * 1.005, '49.68', '49.69', '50.31', '50.32'], // [49,6858… ; 50,3148…]
  ['avance fixe', FIXE, 799.5 * 0.00495 * 0.995, 800.5 * 0.00505 * 1.005, '3.937', '3.938', '4.062', '4.063'], // [3,9377… ; 4,0627…]
  ['avance proportionnelle', PROPORTIONNELLE, 1599.5 * 0.00295 * 0.995, 1600.5 * 0.00305 * 1.005, '4.694', '4.695', '4.905', '4.906'], // [4,6949… ; 4,9059…]
];

for (const [famille, attendu, min, max, sousMin, dansMin, dansMax, surMax] of CASES_VF) {
  test(`SPEC §6 — ${famille}, feedRate : ±0,5 % de N_saisi × f_saisi`, () => {
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
  const attendu = { vc: 100, rpmRaw: 400, rpm: 400, rpmCapped: false, feedPerTooth: 0.006, feedPerToothCapped: false, feedPerRev: 0.012, feedRate: 400 * 0.012, feedType: 'proportional' };
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
  // N hors filetage : ±5 % de 1600 = ±80, bien plus large que ±0,5 → inchangé.
  assert.deepEqual(corrigerChamp(PROPORTIONNELLE, 'rpm', '1600'), { ok: true, value: 1600, min: 1520, max: 1680 });
});

test('D15 : Vf est jugée sur N_saisi × f_saisi, pas sur la valeur théorique (filetage, N réduit)', () => {
  // L'étudiant réduit N à 200 rév/min (permis : −90 %) ; f = 0,125 → Vf cohérente = 25
  // min = 199,5 × 0,124995 × 0,995 = 24,81… ; max = 200,5 × 0,125005 × 1,005 = 25,18…
  const reponses = { ...BONNES.get(FILETAGE), rpm: '200' };
  const vf = (saisie) => gradeAnswers(FILETAGE, { ...reponses, feedRate: saisie });

  assert.equal(vf('25').success, true);
  assert.equal(vf('24.82').fields.feedRate.ok, true);
  assert.equal(vf('25.18').fields.feedRate.ok, true);
  assert.equal(vf('24.81').fields.feedRate.ok, false);
  assert.equal(vf('25.19').fields.feedRate.ok, false);
  assert.equal(vf('50').fields.feedRate.ok, false); // la Vf théorique n'est pas cohérente avec N = 200
});

test('D15 : hors filetage aussi, une Vf cohérente avec les saisies est bonne, même loin de la théorie', () => {
  // N = 1680 (+5 %, bon) et f = 0,0036 (+20 %, bon) → N × f = 6,048, soit +26 % sur la Vf théorique de 4,8
  const reponses = { ...BONNES.get(PROPORTIONNELLE), rpm: '1680', feedPerRev: '0.0036' };
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
  assert.deepEqual(corrigerChamp(PROPORTIONNELLE, 'rpm', ''), { ok: false, value: null, min: 1520, max: 1680 });
  assert.deepEqual(corrigerChamp(PROPORTIONNELLE, 'rpm', 'mille six cents'), { ok: false, value: null, min: 1520, max: 1680 });

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
});

test('le résultat est sérialisable en JSON', () => {
  const resultat = gradeAnswers(FILETAGE, BONNES.get(FILETAGE));
  assert.deepEqual(JSON.parse(JSON.stringify(resultat)), resultat);
});
