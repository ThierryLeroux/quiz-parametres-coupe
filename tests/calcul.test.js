// Tests de site/js/calcul.js : cas de référence calculés à la main depuis les JSON (SPEC §5).
// Les valeurs attendues sont écrites en dur ; le calcul est donné en commentaire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeParameters } from '../site/js/calcul.js';
import { data, questionPour, toutesLesQuestions } from './aide.js';

// Compare aux valeurs écrites à la main, à 1e-12 près en relatif : le moteur n'arrondit
// rien, mais 1600 × 0,003 donne 4,800000000000001 en virgule flottante.
function verifier(obtenu, attendu) {
  assert.deepEqual(Object.keys(obtenu).sort(), Object.keys(attendu).sort());
  for (const [cle, valeur] of Object.entries(attendu)) {
    if (typeof valeur !== 'number') assert.equal(obtenu[cle], valeur, cle); // booléens et feedType
    else assert.ok(Math.abs(obtenu[cle] - valeur) <= 1e-12 * Math.abs(valeur), `${cle} : ${obtenu[cle]} ≠ ${valeur}`);
  }
}

const ACIER_1020 = 1; // groupe 1 : P - Acier non allié, 1020 — Vc 100 / 200 / 400 pi/min
const ALUMINIUM_PUR = 21; // groupe 21 : N - Aluminium de corroyage — Vc 200 / 400 / 800
const ALUMINIUM_6061 = 22; // groupe 22 : N - Aluminium de corroyage, 6061 — Vc 180 / 380 / 700

test('avance proportionnelle au Ø : foret fractionnaire Ø 1/4 po, acier rapide, acier 1020', () => {
  const question = questionPour({ outil: 'foret_fractionnaire', dimension: 'Ø 1/4 po', dents: 2, materiauOutil: 'Acier rapide', groupeMateriau: ACIER_1020 });
  verifier(computeParameters(question, data), {
    vc: 100,
    rpmRaw: 1600, // 100 × 4 / 0,25 × 1
    rpm: 1600, // < 10 000
    rpmCapped: false,
    feedPerTooth: 0.0015, // Perçage : 0,006 × 0,25 × 1 (< 0,010)
    feedPerToothCapped: false,
    feedPerRev: 0.003, // 0,0015 × 2 dents
    feedRate: 4.8, // 1600 × 0,003
    feedType: 'proportional',
  });
});

test('avance proportionnelle, plusieurs dents : fraise en bout 1/2 po, 4 dents, carbure, aluminium 6061', () => {
  const question = questionPour({ outil: 'fraise_en_bout_helicoidale', dimension: '1/2 po', dents: 4, materiauOutil: 'Carbure de tungstène solide', groupeMateriau: ALUMINIUM_6061 });
  verifier(computeParameters(question, data), {
    vc: 380,
    rpmRaw: 3040, // 380 × 4 / 0,5
    rpm: 3040,
    rpmCapped: false,
    feedPerTooth: 0.003, // Contournage ébauche : 0,006 × 0,5
    feedPerToothCapped: false,
    feedPerRev: 0.012, // 0,003 × 4 dents
    feedRate: 36.48, // 3040 × 0,012
    feedType: 'proportional',
  });
});

test('avance fixe : MVLNR, Ø charioté 2.000", insert de carbure, acier 1020', () => {
  const question = questionPour({ outil: 'mvlnr', dimension: '2.000"', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: ACIER_1020 });
  verifier(computeParameters(question, data), {
    vc: 400,
    rpmRaw: 800, // 400 × 4 / 2
    rpm: 800, // < 3000
    rpmCapped: false,
    feedPerTooth: 0.005, // Chariotage finition : avance fixe, indépendante du Ø
    feedPerToothCapped: false,
    feedPerRev: 0.005, // 1 dent
    feedRate: 4, // 800 × 0,005
    feedType: 'fixed',
  });
});

test('plafond avance_max : foret fractionnaire Ø 2 po, acier rapide, acier 1020', () => {
  const question = questionPour({ outil: 'foret_fractionnaire_2', dimension: 'Ø 2 po', dents: 2, materiauOutil: 'Acier rapide', groupeMateriau: ACIER_1020 });
  verifier(computeParameters(question, data), {
    vc: 100,
    rpmRaw: 200, // 100 × 4 / 2
    rpm: 200,
    rpmCapped: false,
    feedPerTooth: 0.01, // 0,006 × 2 = 0,012 → plafonné à avance_max = 0,010
    feedPerToothCapped: true,
    feedPerRev: 0.02, // 0,010 × 2 dents
    feedRate: 4, // 200 × 0,02
    feedType: 'proportional',
  });
});

test('plafond avance_max : une avance égale au plafond n’est pas « plafonnée » (barre à aléser de 1 po)', () => {
  const question = questionPour({ outil: 'barre_a_aleser', dimension: '2.000"', barre: '1 po', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: ACIER_1020 });
  const parametres = computeParameters(question, data);
  assert.equal(parametres.feedPerTooth, 0.006); // Alésage à la barre : 0,006 × 1 = avance_max = 0,006
  assert.equal(parametres.feedPerToothCapped, false);
});

// D25 : deux diamètres. Le Ø alésé (le trou) sert à N ; le Ø de la barre sert à l'avance.
test('barre à aléser : N avec le Ø alésé, avance avec le Ø de la barre (D25)', () => {
  const question = questionPour({ outil: 'barre_a_aleser', dimension: '2.000"', barre: '3/4 po', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: ACIER_1020 });
  const parametres = computeParameters(question, data);
  assert.equal(parametres.rpm, parametres.vc * 4 / 2); // Ø alésé 2 po
  assert.equal(parametres.feedPerTooth, 0.006 * 0.75); // 0,006 × Ø barre 3/4 po = 0,0045 — et non 0,006 × 2
  assert.equal(parametres.feedPerToothCapped, false);
});

test('barre à aléser de 1 1/4 po : 0,006 × 1,25 dépasse l’avance max, donc 0,006 (D25)', () => {
  const question = questionPour({ outil: 'barre_a_aleser', dimension: '2.000"', barre: '1 1/4 po', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: ACIER_1020 });
  const parametres = computeParameters(question, data);
  assert.equal(parametres.feedPerTooth, 0.006);
  assert.equal(parametres.feedPerToothCapped, true);
});

test('plafond limite_rpm : foret fractionnaire Ø 1/64 po, carbure, aluminium', () => {
  const question = questionPour({ outil: 'foret_fractionnaire', dimension: 'Ø 1/64 po', dents: 2, materiauOutil: 'Carbure de tungstène solide', groupeMateriau: ALUMINIUM_PUR });
  verifier(computeParameters(question, data), {
    vc: 400,
    rpmRaw: 102400, // 400 × 4 / 0,015625
    rpm: 10000, // plafonné à limite_rpm
    rpmCapped: true,
    feedPerTooth: 0.00009375, // 0,006 × 0,015625
    feedPerToothCapped: false,
    feedPerRev: 0.0001875, // × 2 dents
    feedRate: 1.875, // 10 000 × 0,0001875 : Vf part du N plafonné
    feedType: 'proportional',
  });
});

test('fact_vc ≠ 1 : alésoir 0.2500", 6 lèvres, acier rapide, acier 1020 (fact_vc = 0,25)', () => {
  const question = questionPour({ outil: 'alesoir', dimension: '0.2500"', dents: 6, materiauOutil: 'Acier rapide', groupeMateriau: ACIER_1020 });
  verifier(computeParameters(question, data), {
    vc: 100, // Vc reste la valeur de la table : fact_vc s'applique à N
    rpmRaw: 400, // 100 × 4 / 0,25 × 0,25
    rpm: 400,
    rpmCapped: false,
    feedPerTooth: 0.0005, // Alésage à l'alésoir : 0,002 × 0,25
    feedPerToothCapped: false,
    feedPerRev: 0.003, // 0,0005 × 6 lèvres
    feedRate: 1.2, // 400 × 0,003
    feedType: 'proportional',
  });
});

test('fact_vc ≠ 1 et avance fixe : lame à tronçonner, Ø 2.000", acier 1020 (fact_vc = 0,125)', () => {
  const question = questionPour({ outil: 'lame_a_tronconner', dimension: '2.000"', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: ACIER_1020 });
  verifier(computeParameters(question, data), {
    vc: 400,
    rpmRaw: 100, // 400 × 4 / 2 × 0,125
    rpm: 100,
    rpmCapped: false,
    feedPerTooth: 0.004, // Tronçonnage : avance fixe
    feedPerToothCapped: false,
    feedPerRev: 0.004,
    feedRate: 0.4, // 100 × 0,004
    feedType: 'fixed',
  });
});

test('filetage impérial : taraud 1 - 8 UNC, acier rapide, acier 1020', () => {
  const question = questionPour({ outil: 'taraud_imperial', dimension: '1 - 8 UNC', dents: 1, materiauOutil: 'Acier rapide', groupeMateriau: ACIER_1020 });
  verifier(computeParameters(question, data), {
    vc: 100,
    rpmRaw: 400, // 100 × 4 / 1
    rpm: 400, // < 1000
    rpmCapped: false,
    feedPerTooth: 0.125, // pas = 1/8 po
    feedPerToothCapped: false,
    feedPerRev: 0.125,
    feedRate: 50, // 400 × 0,125
    feedType: 'thread',
  });
});

test('filetage impérial avec plafond limite_rpm : taraud 1/4 - 20 UNC, acier rapide, acier 1020', () => {
  const question = questionPour({ outil: 'taraud_imperial', dimension: '1/4- 20 UNC', dents: 1, materiauOutil: 'Acier rapide', groupeMateriau: ACIER_1020 });
  verifier(computeParameters(question, data), {
    vc: 100,
    rpmRaw: 1600, // 100 × 4 / 0,25
    rpm: 1000, // plafonné à limite_rpm du taraud
    rpmCapped: true,
    feedPerTooth: 0.05, // pas = 1/20 po
    feedPerToothCapped: false,
    feedPerRev: 0.05,
    feedRate: 50, // 1000 × 0,05
    feedType: 'thread',
  });
});

test('filetage métrique : taraud M24 x 3, acier rapide, acier 1020', () => {
  const question = questionPour({ outil: 'taraud_metrique', dimension: 'M24 x 3', dents: 1, materiauOutil: 'Acier rapide', groupeMateriau: ACIER_1020 });
  verifier(computeParameters(question, data), {
    vc: 100,
    rpmRaw: 423.3333333333333, // D = 24 / 25,4 = 0,94488… po ; 100 × 4 × 25,4 / 24
    rpm: 423.3333333333333,
    rpmCapped: false,
    feedPerTooth: 0.11811023622047244, // pas = 3 / 25,4 po
    feedPerToothCapped: false,
    feedPerRev: 0.11811023622047244,
    feedRate: 50, // (400 × 25,4 / 24) × (3 / 25,4) = 400 × 3 / 24
    feedType: 'thread',
  });
});

test('le résultat est sérialisable en JSON et la question n’est pas modifiée', () => {
  const question = questionPour({ outil: 'foret_fractionnaire', dimension: 'Ø 1/4 po', dents: 2, materiauOutil: 'Acier rapide', groupeMateriau: ACIER_1020 });
  const avant = structuredClone(question);
  const parametres = computeParameters(question, data);
  assert.deepEqual(JSON.parse(JSON.stringify(parametres)), parametres);
  assert.deepEqual(question, avant);
});

test('une question passée par JSON (localStorage) donne le même résultat', () => {
  const question = questionPour({ outil: 'taraud_metrique', dimension: 'M24 x 3', dents: 1, materiauOutil: 'Acier rapide', groupeMateriau: ACIER_1020 });
  assert.deepEqual(computeParameters(JSON.parse(JSON.stringify(question)), data), computeParameters(question, data));
});

test('outil inconnu → erreur explicite', () => {
  const question = questionPour({ outil: 'mvlnr', dimension: '2.000"', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: ACIER_1020 });
  question.tool.id = 'outil_disparu';
  assert.throws(() => computeParameters(question, data), /Outil inconnu : « outil_disparu »/);
});

test('toutes les questions possibles donnent des valeurs finies, positives et cohérentes', () => {
  for (const question of toutesLesQuestions()) {
    const p = computeParameters(question, data);
    for (const cle of ['vc', 'rpmRaw', 'rpm', 'feedPerTooth', 'feedPerRev', 'feedRate']) {
      assert.ok(Number.isFinite(p[cle]) && p[cle] > 0, `${question.displayId} : ${cle} = ${p[cle]}`);
    }
    assert.ok(p.rpm <= p.rpmRaw, question.displayId);
    assert.equal(p.rpmCapped, p.rpm < p.rpmRaw, question.displayId);
    assert.equal(p.feedRate, p.rpm * p.feedPerRev, question.displayId);
  }
});
