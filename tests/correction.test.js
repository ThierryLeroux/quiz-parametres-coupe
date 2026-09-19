// Tests de site/js/correction.js : tolérances de la SPEC §6, une case du tableau à la fois.
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

const QUESTION = {}; // gradeAnswers n'utilise pas la question pour l'instant

// Corrige un cas où seul `champ` diffère des bonnes réponses ; retourne le résultat de ce champ.
function corrigerChamp(attendu, champ, saisie) {
  const reponses = { ...BONNES.get(attendu), [champ]: saisie };
  // En filetage, Vf est jugée sur N_saisi × f_saisi : on la garde cohérente avec les saisies.
  if (attendu.feedType === 'thread' && (champ === 'rpm' || champ === 'feedPerRev')) {
    reponses.feedRate = String(Number(reponses.rpm) * Number(reponses.feedPerRev));
  }
  const resultat = gradeAnswers(QUESTION, attendu, reponses);
  for (const autre of ANSWER_FIELDS.filter((f) => f !== champ)) assert.equal(resultat.fields[autre].ok, true, `${autre} devrait rester bon`);
  assert.equal(resultat.success, resultat.fields[champ].ok);
  return resultat.fields[champ];
}

// Une ligne par case du tableau de la SPEC §6 :
// [famille, valeurs théoriques, champ, tolérance, min, max, saisie juste sous min, saisie juste au-dessus de max]
const CASES = [
  ['filetage', FILETAGE, 'vc', 'exact', 100, 100, '99.9', '100.1'],
  ['filetage', FILETAGE, 'feedPerTooth', '±0,1 %', 0.124875, 0.125125, '0.1248749', '0.1251251'], // 0,125 × 0,999 et × 1,001
  ['filetage', FILETAGE, 'rpm', 'de −90 % à +0,1 %', 40, 400.4, '39.99', '400.41'], // 400 × 0,1 et × 1,001
  ['filetage', FILETAGE, 'feedPerRev', '±0,1 %', 0.124875, 0.125125, '0.1248749', '0.1251251'],
  ['filetage', FILETAGE, 'feedRate', '±0,5 % de N_saisi × f_saisi', 49.75, 50.25, '49.74', '50.26'], // 400 × 0,125 = 50 ; × 0,995 et × 1,005

  ['avance fixe', FIXE, 'vc', 'exact', 400, 400, '399', '401'],
  ['avance fixe', FIXE, 'feedPerTooth', 'exact', 0.005, 0.005, '0.0049', '0.0051'],
  ['avance fixe', FIXE, 'rpm', '±5 %', 760, 840, '759.9', '840.1'], // 800 × 0,95 et × 1,05
  ['avance fixe', FIXE, 'feedPerRev', '±0,1 %', 0.004995, 0.005005, '0.0049949', '0.0050051'], // 0,005 × 0,999 et × 1,001
  ['avance fixe', FIXE, 'feedRate', '±5,1 %', 3.796, 4.204, '3.7959', '4.2041'], // 4 × 0,949 et × 1,051

  ['avance proportionnelle', PROPORTIONNELLE, 'vc', 'exact', 100, 100, '99', '101'],
  ['avance proportionnelle', PROPORTIONNELLE, 'feedPerTooth', '±25 %, borné à ±0,001 po', 0.001125, 0.001875, '0.0011249', '0.0018751'], // 0,0015 × 0,75 et × 1,25
  ['avance proportionnelle', PROPORTIONNELLE, 'rpm', '±5 %', 1520, 1680, '1519.9', '1680.1'], // 1600 × 0,95 et × 1,05
  ['avance proportionnelle', PROPORTIONNELLE, 'feedPerRev', '±20 %', 0.0024, 0.0036, '0.0023999', '0.0036001'], // 0,003 × 0,8 et × 1,2
  ['avance proportionnelle', PROPORTIONNELLE, 'feedRate', '±25 %', 3.6, 6, '3.599', '6.001'], // 4,8 × 0,75 et × 1,25
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

test('toutes les bonnes réponses → success, pour chaque famille', () => {
  for (const [attendu, reponses] of BONNES) {
    const resultat = gradeAnswers(QUESTION, attendu, reponses);
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
  const fz = (saisie) => gradeAnswers(QUESTION, attendu, { ...reponses, feedPerTooth: saisie }).fields.feedPerTooth;

  // ±25 % = ±0,0015 po > ±0,001 po → [0,005 ; 0,007]
  assert.deepEqual(fz('0.005'), { ok: true, value: 0.005, min: 0.005, max: 0.007 });
  assert.deepEqual(fz('0.007'), { ok: true, value: 0.007, min: 0.005, max: 0.007 });
  assert.equal(fz('0.0049').ok, false); // dans ±25 % (≥ 0,0045), mais hors ±0,001 po
  assert.equal(fz('0.0071').ok, false); // dans ±25 % (≤ 0,0075), mais hors ±0,001 po
});

test('filetage : Vf est jugée sur N_saisi × f_saisi, pas sur la valeur théorique', () => {
  // L'étudiant réduit N à 200 rév/min (permis : −90 %) ; f = 0,125 → Vf cohérente = 25, ±0,5 % → [24,875 ; 25,125]
  const reponses = { ...BONNES.get(FILETAGE), rpm: '200' };
  const vf = (saisie) => gradeAnswers(QUESTION, FILETAGE, { ...reponses, feedRate: saisie });

  assert.deepEqual(vf('25').fields.feedRate, { ok: true, value: 25, min: 24.875, max: 25.125 });
  assert.equal(vf('25').success, true);
  assert.equal(vf('24.875').fields.feedRate.ok, true);
  assert.equal(vf('25.125').fields.feedRate.ok, true);
  assert.equal(vf('24.87').fields.feedRate.ok, false);
  assert.equal(vf('25.13').fields.feedRate.ok, false);
  assert.equal(vf('50').fields.feedRate.ok, false); // la Vf théorique n'est pas cohérente avec N = 200
});

test('filetage : Vf cohérente avec un N faux reste bonne, mais la question échoue sur N', () => {
  const resultat = gradeAnswers(QUESTION, FILETAGE, { ...BONNES.get(FILETAGE), rpm: '800', feedRate: '100' });
  assert.equal(resultat.fields.rpm.ok, false); // 800 > 400,4
  assert.equal(resultat.fields.feedRate.ok, true); // 800 × 0,125 = 100
  assert.equal(resultat.success, false);
});

test('filetage : si N ou f n’est pas lisible, la référence de Vf retombe sur la valeur théorique', () => {
  const resultat = gradeAnswers(QUESTION, FILETAGE, { ...BONNES.get(FILETAGE), rpm: '' });
  assert.deepEqual(resultat.fields.feedRate, { ok: true, value: 50, min: 49.75, max: 50.25 });
  assert.equal(resultat.success, false); // N vide
});

test('hors filetage, Vf est jugée sur la valeur théorique, même si elle est cohérente avec les saisies', () => {
  // N = 1680 (+5 %, bon) et f = 0,0036 (+20 %, bon) → N × f = 6,048 : cohérent, mais hors ±25 % de 4,8
  const resultat = gradeAnswers(QUESTION, PROPORTIONNELLE, { ...BONNES.get(PROPORTIONNELLE), rpm: '1680', feedPerRev: '0.0036', feedRate: '6.048' });
  assert.equal(resultat.fields.rpm.ok, true);
  assert.equal(resultat.fields.feedPerRev.ok, true);
  assert.equal(resultat.fields.feedRate.ok, false);
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
  const resultat = gradeAnswers(QUESTION, PROPORTIONNELLE, { vc: '100', feedPerTooth: '0,0015', rpm: '1 600', feedPerRev: '0,003', feedRate: '4,8' });
  assert.equal(resultat.success, true);
  assert.equal(resultat.fields.feedPerTooth.value, 0.0015);
});

test('champ vide : non répondu → faux, value null, intervalle quand même fourni', () => {
  assert.deepEqual(corrigerChamp(PROPORTIONNELLE, 'rpm', ''), { ok: false, value: null, min: 1520, max: 1680 });
  assert.deepEqual(corrigerChamp(PROPORTIONNELLE, 'rpm', 'mille six cents'), { ok: false, value: null, min: 1520, max: 1680 });

  const sansCle = { ...BONNES.get(FIXE) };
  delete sansCle.feedRate; // champ absent des réponses
  assert.deepEqual(gradeAnswers(QUESTION, FIXE, sansCle).fields.feedRate, { ok: false, value: null, min: 3.796, max: 4.204 });
});

test('fieldsToGrade : les champs non corrigés (pré-remplis) sont réputés corrects', () => {
  // Exercice M10 « Vc seulement » : seule Vc est saisie.
  const bon = gradeAnswers(QUESTION, FIXE, { vc: '400' }, ['vc']);
  assert.equal(bon.success, true);
  assert.deepEqual(bon.fields.vc, { ok: true, value: 400, min: 400, max: 400 });
  for (const champ of ['feedPerTooth', 'rpm', 'feedPerRev', 'feedRate']) {
    assert.deepEqual(bon.fields[champ], { ok: true, value: null, min: null, max: null });
  }

  const mauvais = gradeAnswers(QUESTION, FIXE, { vc: '390' }, ['vc']);
  assert.equal(mauvais.success, false);
  assert.equal(mauvais.fields.vc.ok, false);
});

test('fieldsToGrade : en filetage, Vf seule corrigée → référence = N et f théoriques (pré-remplis)', () => {
  const resultat = gradeAnswers(QUESTION, FILETAGE, { feedRate: '50' }, ['feedRate']);
  assert.equal(resultat.success, true);
  assert.deepEqual(resultat.fields.feedRate, { ok: true, value: 50, min: 49.75, max: 50.25 });
});

test('erreurs de programmation : champ à corriger ou famille inconnus', () => {
  assert.throws(() => gradeAnswers(QUESTION, FIXE, {}, ['vitesse']), /Champ à corriger inconnu : « vitesse »/);
  assert.throws(() => gradeAnswers(QUESTION, { ...FIXE, feedType: 'autre' }, {}), /Famille d'avance inconnue : « autre »/);
});

test('le résultat est sérialisable en JSON', () => {
  const resultat = gradeAnswers(QUESTION, FILETAGE, BONNES.get(FILETAGE));
  assert.deepEqual(JSON.parse(JSON.stringify(resultat)), resultat);
});
