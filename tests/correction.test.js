// Tests de site/js/correction.js : tolérances de la SPEC §6 (décisions D13 et D15), une case du tableau à la fois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANSWER_FIELDS, coherentFeedPerTooth, gradeAnswers, parseAnswer, toleranceLabel } from '../site/js/correction.js';
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
  // À partir de deux dents, f est jugée sur fz_saisi × dents (D69, D70), et Vf toujours sur N_saisi × f_saisi (D15) :
  // on les garde cohérentes avec les saisies. À une dent, f est jugée sur la valeur théorique : on n'y touche pas.
  const fz = parseAnswer(reponses.feedPerTooth);
  if (champ === 'feedPerTooth' && fz !== null && attendu.teeth >= 2) reponses.feedPerRev = String(fz * attendu.teeth);
  const n = parseAnswer(reponses.rpm);
  const f = parseAnswer(reponses.feedPerRev);
  if (champ !== 'feedRate' && n !== null && f !== null) reponses.feedRate = String(n * f);

  const resultat = gradeAnswers(attendu, reponses);
  for (const autre of ANSWER_FIELDS.filter((c) => c !== champ)) assert.equal(resultat.fields[autre].ok, true, `${autre} devrait rester bon`);
  assert.equal(resultat.success, resultat.fields[champ].ok);
  return resultat.fields[champ];
}

// Une ligne par case du tableau de la SPEC §6, sauf Vf et f à deux dents et plus (plus bas) :
// [famille, valeurs théoriques, champ, tolérance, min, max, saisie juste sous min, saisie juste au-dessus de max]
// D13 : l'intervalle n'est jamais plus étroit qu'une demi-unité du dernier chiffre affiché.
const CASES = [
  ['filetage', FILETAGE, 'vc', 'exact, affiché « 100 » → ±0,5', 99.5, 100.5, '99.49', '100.51'],
  ['filetage', FILETAGE, 'feedPerTooth', '±0,1 %', 0.124875, 0.125125, '0.1248749', '0.1251251'], // 0,125 × 0,999 et × 1,001 (> ±0,000005)
  ['filetage', FILETAGE, 'rpm', 'de −90 % à +0,1 %, affiché « 400 » → +0,5', 40, 400.5, '39.99', '400.51'], // 400 × 0,1 ; +0,1 % = 400,4 < 400,5
  ['filetage', FILETAGE, 'feedPerRev', 'une dent (D70) : ±0,1 % de la valeur théorique', 0.124875, 0.125125, '0.1248749', '0.1251251'],

  ['avance fixe', FIXE, 'vc', 'exact, affiché « 400 » → ±0,5', 399.5, 400.5, '399.49', '400.51'],
  ['avance fixe', FIXE, 'feedPerTooth', 'exact, affiché « 0.0050 » → ±0,00005', 0.00495, 0.00505, '0.004949', '0.005051'],
  ['avance fixe', FIXE, 'rpm', '±5 % et ±1 rév/min', 759, 841, '758.9', '841.1'], // 800 × 0,95 − 1 et × 1,05 + 1 (D13, complément)
  ['avance fixe', FIXE, 'feedPerRev', 'une dent (D70) : ±0,1 %, affiché « 0.0050 » → ±0,00005', 0.00495, 0.00505, '0.004949', '0.005051'], // MVLNR : comme avant D69

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

// Les cas des tests de f, tirés par le moteur (acier rapide, acier 1020 : Vc 100).
const avec = (outil, dimension, dents, extra = {}) => computeParameters(questionPour({ outil, dimension, dents, materiauOutil: 'Acier rapide', groupeMateriau: 1, ...extra }), data);
// Foret à pointer Ø 1/2 po, 2 lèvres : avance fixe, fz = 0.001 (« 0.0010 »), f = 0.002 (« 0.0020 »).
const POINTEUR = avec('foret_a_pointer', 'Ø 1/2 po', 2);
// Foret #40 (Ø 0.098 po), 2 lèvres : fz = 0.000588 (« 0.000588 », ½ unité 0.0000005), f = 0.001176 (« 0.00118 », ½ unité 0.000005).
const FORET_40 = avec('foret_a_numero', '#40', 2);
for (const attendu of [POINTEUR, FORET_40]) BONNES.set(attendu, formatParameters(attendu));

// f à deux dents et plus (D69, D70) : fz saisie et lisible → cohérence avec fz_saisi × dents. Avec référence = fz × dents
// et les produits pris sur la plage (fz ± ½ unité de fz) × dents, l'intervalle est la plus large des deux (D13) :
//   min = min(plus petit produit × (1 − 0,1 %), référence − ½ unité de f)   max = max(plus grand produit × (1 + 0,1 %), référence + ½ unité de f)
// [cas, valeurs théoriques, min, max, dernière saisie refusée, première acceptée, dernière acceptée, première refusée]
const CASES_F = [
  ['avance proportionnelle, foret Ø 1/4 po, fz « 0.0015 »', PROPORTIONNELLE, 0.0029 * 0.999, 0.0031 * 1.001, '0.002897', '0.0028971', '0.0031031', '0.0031032'],
  ['avance fixe, foret à pointer, fz « 0.0010 »', POINTEUR, 0.0019 * 0.999, 0.0021 * 1.001, '0.001898', '0.0018981', '0.0021021', '0.0021022'], // avant D70 : [0.00185 ; 0.00215]
  ['foret #40, fz « 0.000588 » : la ½ unité de f l’emporte', FORET_40, 0.001176 - 0.000005, 0.001176 + 0.000005, '0.00117', '0.001171', '0.001181', '0.001182'],
];

for (const [cas, attendu, min, max, sousMin, dansMin, dansMax, surMax] of CASES_F) {
  test(`D70 — ${cas}, 2 dents : f à ±0,1 % de fz_saisi × dents`, () => {
    const bornes = corrigerChamp(attendu, 'feedPerRev', dansMin);
    assert.ok(Math.abs(bornes.min - min) < 1e-12 && Math.abs(bornes.max - max) < 1e-12, `[${bornes.min} ; ${bornes.max}] ≠ [${min} ; ${max}]`);
    assert.equal(corrigerChamp(attendu, 'feedPerRev', sousMin).ok, false);
    assert.equal(corrigerChamp(attendu, 'feedPerRev', dansMin).ok, true);
    assert.equal(corrigerChamp(attendu, 'feedPerRev', dansMax).ok, true);
    assert.equal(corrigerChamp(attendu, 'feedPerRev', surMax).ok, false);
  });
}

test('D70 : foret #40, fz « 0.000588 » et f « 0.00118 » (f affichée avec moins de décimales que fz × dents) → acceptée', () => {
  assert.deepEqual([BONNES.get(FORET_40).feedPerTooth, BONNES.get(FORET_40).feedPerRev], ['0.000588', '0.00118']);
  assert.equal(gradeAnswers(FORET_40, BONNES.get(FORET_40)).success, true);
});

// Foret fractionnaire Ø 1/2 po, 2 lèvres, acier rapide, acier 1020 : N = 100 × 4 / 0.5 = 800 ; fz = 0.006 × 0.5 = 0.003
// (affiché « 0.0030 ») ; f = 0.006 ; Vf = 4.8. fz est tolérée à ±25 %, au plus ±0.001 po : [0.00225 ; 0.00375].
const FORET_DEMI = avec('foret_fractionnaire', 'Ø 1/2 po', 2);
const FORET_UN = avec('foret_fractionnaire', 'Ø 1 po', 2);
const saisiesForet = (fz, f) => ({ vc: '100', feedPerTooth: fz, rpm: '800', feedPerRev: f, feedRate: String(800 * Number(f)) });
const SANS_FZ = ['vc', 'rpm', 'feedPerRev', 'feedRate']; // fz fournie ou masquée : elle n'est pas corrigée
const FZ_MASQUEE = ['feedPerTooth'];
// f seule changée, N et Vf gardés cohérents ; fz fournie (masques = []) ou masquée.
const fSansFz = (attendu, saisie, masques = []) => gradeAnswers(attendu, { vc: String(attendu.vc), rpm: String(attendu.rpm), feedPerRev: saisie, feedRate: String(attendu.rpm * Number(saisie)) }, SANS_FZ, masques).fields.feedPerRev;

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

// --- D70 : à une dent, f = fz — f jugée sur la valeur théorique avec la tolérance de fz, que fz soit saisie ou non ------
// SDTMR M42 x 4.5 : pas = 4.5 / 25.4 = 0.1771654… po (« 0.17717 »), 1 dent.
const SDTMR_M42 = avec('sdtmr_2', 'M42 x 4.5', 1, { materiauOutil: 'Insert de carbure de tungstène' });
// Barre à aléser Ø 1 1/4 po, Ø alésé 2.000" : fz = 0.006 × 1.25 = 0.0075 → plafonnée à 0.006 (« 0.0060 »), 1 dent.
const BARRE = avec('barre_a_aleser', '2.000"', 1, { barre: '1 1/4 po', materiauOutil: 'Insert de carbure de tungstène' });
const uneDent = (attendu, fz, f) => gradeAnswers(attendu, { ...formatParameters(attendu), feedPerTooth: fz, feedPerRev: f, feedRate: String(attendu.rpm * Number(f)) });

test('D70 : SDTMR M42 x 4.5, le pas en mm non converti — fz « 4.5 » et f « 4.5 » → les deux fausses', () => {
  assert.deepEqual([SDTMR_M42.teeth, SDTMR_M42.feedType, formatParameters(SDTMR_M42).feedPerTooth], [1, 'thread', '0.17717']);
  const resultat = uneDent(SDTMR_M42, '4.5', '4.5');
  assert.equal(resultat.fields.feedPerTooth.ok, false);
  assert.equal(resultat.fields.feedPerRev.ok, false); // à une dent, plus de cohérence avec le fz saisi (D69 l'acceptait)
  assert.deepEqual([resultat.fields.feedPerRev.min, resultat.fields.feedPerRev.max], [0.176988188976, 0.177342519685]); // ±0,1 % du pas
  // fz fausse, f juste : f acceptée (jugée sur la valeur théorique)
  assert.equal(uneDent(SDTMR_M42, '4.5', '0.17717').fields.feedPerRev.ok, true);
});

test('D70 : barre à aléser (1 dent, avance proportionnelle) — f jugée à ±25 %, au plus ±0.001 po, de la valeur théorique', () => {
  assert.deepEqual([BARRE.teeth, BARRE.feedType, BARRE.feedPerToothCapped, formatParameters(BARRE).feedPerRev], [1, 'proportional', true, '0.0060']);
  const f = (saisie) => uneDent(BARRE, '0.0060', saisie).fields.feedPerRev;
  assert.deepEqual(f('0.0070'), { ok: true, value: 0.007, min: 0.005, max: 0.007 }); // ±25 % = ±0.0015, borné à ±0.001
  assert.equal(f('0.00606').ok, true); // f +1 % : à une dent, f = fz, même tolérance que fz (D70 : la règle est gardée)
  assert.equal(f('0.0071').ok, false);
  // fz saisie fausse et f qui la recopie : f jugée sur 0.006, refusée
  assert.equal(uneDent(BARRE, '0.0080', '0.0080').fields.feedPerRev.ok, false);
});

test('D70 : une dent, fz fournie (avance fixe et filetage) → f à ±0,1 % de la valeur théorique (et la ½ unité de f, D13)', () => {
  // Filetage : 0.125 × 0.999 et × 1.001 (plus large que ±0.000005)
  assert.deepEqual(fSansFz(FILETAGE, '0.124875'), { ok: true, value: 0.124875, min: 0.124875, max: 0.125125 });
  assert.equal(fSansFz(FILETAGE, '0.1248749').ok, false);
  assert.equal(fSansFz(FILETAGE, '0.1251251').ok, false);
  // Avance fixe : ±0.1 % = ±0.000005, plus étroit que la ½ unité de « 0.0050 » → [0.00495 ; 0.00505]
  assert.deepEqual(fSansFz(FIXE, '0.00505'), { ok: true, value: 0.00505, min: 0.00495, max: 0.00505 });
  assert.equal(fSansFz(FIXE, '0.004949').ok, false);
  assert.equal(fSansFz(FIXE, '0.005051').ok, false);
});

// --- D70 : deux dents et plus, fz fournie → cohérence avec fz AFFICHÉ × dents : le nombre de dents est vérifié ---------------
// Alésoir 0.6250", 8 dents : fz = 0.002 × 0.625 = 0.00125 (« 0.00125 », ½ unité 0.000005), f = 0.01 (« 0.0100 », ½ unité 0.00005).
const ALESOIR_8 = avec('alesoir_2', '0.6250"', 8);

test('D70 : alésoir à 8 dents, fz fournie, f calculée avec 7 dents → refusée ; avec 8, acceptée', () => {
  assert.deepEqual([ALESOIR_8.teeth, formatParameters(ALESOIR_8).feedPerTooth, formatParameters(ALESOIR_8).feedPerRev], [8, '0.00125', '0.0100']);
  const avec8 = fSansFz(ALESOIR_8, '0.0100');
  assert.equal(avec8.ok, true);
  // plus petit produit 0.001245 × 8 = 0.00996, × 0.999 = 0.00995004 ; 0.01 − 0.00005 = 0.00995 (le plus large)
  // plus grand produit 0.001255 × 8 = 0.01004, × 1.001 = 0.01005004 (le plus large) ; 0.01 + 0.00005 = 0.01005
  assert.deepEqual([avec8.min, avec8.max], [0.00995, 0.01005004]);
  assert.equal(fSansFz(ALESOIR_8, '0.00875').ok, false); // 0.00125 × 7
  assert.equal(fSansFz(ALESOIR_8, '0.01125').ok, false); // 0.00125 × 9
  // La tolérance reportée de D69 (±25 %, au plus ±0.001 × 8) l'aurait acceptée — c'est pourquoi fz fournie passe à la cohérence.
  assert.ok(0.00875 >= 0.01 * 0.75);
});

test('D70 : fz fournie → une fz envoyée quand même par le navigateur ne compte pas ; c’est la valeur affichée qui sert', () => {
  // Cohérente avec 0.0038 × 2, f = 0.0076 serait acceptée ; fz n'étant pas à saisir, la référence est « 0.0030 » × 2.
  const resultat = gradeAnswers(FORET_DEMI, saisiesForet('0.0038', '0.0076'), SANS_FZ);
  assert.equal(resultat.fields.feedPerRev.ok, false);
  assert.deepEqual([resultat.fields.feedPerRev.min, resultat.fields.feedPerRev.max], [0.0058941, 0.0061061]); // 0.0059 × 0.999, 0.0061 × 1.001
});

test('D69 : fz masquée (deux dents et plus) → f jugée sur la valeur théorique, tolérance de fz reportée (±25 %, au plus ±0.001 po par dent)', () => {
  // Ø 1/2 po : f = 0.006 ; ±25 % = ±0.0015, plus étroit que ±0.001 × 2 dents → [0.0045 ; 0.0075]
  assert.deepEqual(fSansFz(FORET_DEMI, '0.0045', FZ_MASQUEE), { ok: true, value: 0.0045, min: 0.0045, max: 0.0075 });
  assert.deepEqual(fSansFz(FORET_DEMI, '0.0075', FZ_MASQUEE), { ok: true, value: 0.0075, min: 0.0045, max: 0.0075 });
  assert.equal(fSansFz(FORET_DEMI, '0.0044', FZ_MASQUEE).ok, false);
  assert.equal(fSansFz(FORET_DEMI, '0.0076', FZ_MASQUEE).ok, false);
  // Ø 1 po : f = 0.012 ; ±25 % = ±0.003, plus large que ±0.001 × 2 dents → [0.010 ; 0.014] (et non ±0.001 : [0.011 ; 0.013])
  assert.deepEqual(fSansFz(FORET_UN, '0.0105', FZ_MASQUEE), { ok: true, value: 0.0105, min: 0.01, max: 0.014 });
  assert.equal(fSansFz(FORET_UN, '0.0099', FZ_MASQUEE).ok, false);
  assert.equal(fSansFz(FORET_UN, '0.0141', FZ_MASQUEE).ok, false);
});

test('D69 : fz à saisir mais vide ou illisible → f jugée comme si fz était masquée (tolérance reportée)', () => {
  for (const fz of ['', 'abc']) {
    const resultat = gradeAnswers(FORET_DEMI, saisiesForet(fz, '0.0074'));
    assert.equal(resultat.fields.feedPerTooth.ok, false, fz);
    assert.deepEqual(resultat.fields.feedPerRev, { ok: true, value: 0.0074, min: 0.0045, max: 0.0075 }, fz);
    assert.equal(gradeAnswers(FORET_DEMI, saisiesForet(fz, '0.0076')).fields.feedPerRev.ok, false, fz);
  }
});

test('coherentFeedPerTooth : sur quoi f est jugée (D69, D70)', () => {
  assert.equal(coherentFeedPerTooth(FORET_DEMI, { feedPerTooth: '0,0037' }), 0.0037); // à saisir, lisible
  assert.equal(coherentFeedPerTooth(FORET_DEMI, { feedPerTooth: '' }), null); // vide
  assert.equal(coherentFeedPerTooth(FORET_DEMI, { feedPerTooth: '0.0038' }, SANS_FZ), 0.003); // fournie : « 0.0030 »
  assert.equal(coherentFeedPerTooth(FORET_DEMI, {}, SANS_FZ, FZ_MASQUEE), null); // masquée
  assert.equal(coherentFeedPerTooth(BARRE, { feedPerTooth: '0.0060' }), null); // une dent
  assert.equal(coherentFeedPerTooth(FIXE, {}, SANS_FZ), null); // une dent
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
  // f à une dent (D70) : la tolérance de fz de la famille, sans « par dent »
  assert.equal(toleranceLabel('proportional', 'feedPerRev', { teeth: 1 }), '±25 %, au plus ±0.001 po');
  assert.equal(toleranceLabel('proportional', 'feedPerRev', { teeth: 3 }), '±25 %, au plus ±0.001 po par dent');
  assert.equal(toleranceLabel('fixed', 'feedPerRev', { teeth: 1 }), '±0.1 %');
  assert.throws(() => toleranceLabel('inconnue', 'vc'), /Tolérance inconnue/);
  assert.throws(() => toleranceLabel('inconnue', 'feedPerRev', { coherence: true }), /Tolérance inconnue/);
});
