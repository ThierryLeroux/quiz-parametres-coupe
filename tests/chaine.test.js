// Tests de bout en bout du moteur : question → calcul → affichage → correction.
// Ils vérifient que les arrondis d'affichage (SPEC §5, D14) et les tolérances (SPEC §6, D13, D15)
// vont ensemble : ce que l'écran montre comme bonne réponse doit être accepté par la correction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeParameters } from '../site/js/calcul.js';
import { formatParameters } from '../site/js/format.js';
import { ANSWER_FIELDS, gradeAnswers } from '../site/js/correction.js';
import { data, questionPour, toutesLesQuestions } from './aide.js';

const ACIER_1020 = 1; // P - Acier non allié, 1020 — Vc 100 / 200 / 400 pi/min
const ACIER_OUTIL_DURCI = 39; // H - Acier durci, acier à outils — insert de carbure : 40 pi/min
const ACIER_440C_DURCI = 40; // H - Acier durci, 440C — insert de carbure : 35 pi/min

// Écrit un nombre en décimal, sans notation scientifique (String(0.0000118) donne « 1.18e-5 »).
const enDecimal = (nombre) => (String(nombre).includes('e') ? nombre.toFixed(20) : String(nombre));

test('toutes les combinaisons : la réponse théorique exacte (non arrondie) réussit la correction', () => {
  let nombre = 0;
  for (const question of toutesLesQuestions()) {
    const attendu = computeParameters(question, data);
    const reponses = Object.fromEntries(ANSWER_FIELDS.map((champ) => [champ, enDecimal(attendu[champ])]));
    assert.equal(gradeAnswers(attendu, reponses).success, true, question.displayId);
    nombre += 1;
  }
  assert.ok(nombre > 10000, `${nombre} combinaisons seulement`);
});

test('toutes les combinaisons : la réponse théorique arrondie comme à l’affichage réussit la correction', () => {
  const echecs = [];
  for (const question of toutesLesQuestions()) {
    const attendu = computeParameters(question, data);
    const affiche = formatParameters(attendu);
    const resultat = gradeAnswers(attendu, affiche);
    for (const champ of ANSWER_FIELDS) {
      const r = resultat.fields[champ];
      if (!r.ok) echecs.push(`${question.displayId} / ${question.material.groupe} | ${champ} : « ${affiche[champ]} » ∉ [${r.min} ; ${r.max}]`);
    }
  }
  assert.deepEqual(echecs.slice(0, 10), [], `${echecs.length} échecs (10 premiers)`);
});

test('toutes les combinaisons : l’avance affichée n’est jamais « 0.0000 » et garde 3 chiffres significatifs (D14)', () => {
  for (const question of toutesLesQuestions()) {
    const attendu = computeParameters(question, data);
    const affiche = formatParameters(attendu);
    for (const champ of ['feedPerTooth', 'feedPerRev']) {
      assert.ok(Number(affiche[champ]) > 0, `${question.displayId} : ${champ} affiché « ${affiche[champ]} »`);
      const ecart = Math.abs(Number(affiche[champ]) - attendu[champ]) / attendu[champ];
      assert.ok(ecart <= 0.005, `${question.displayId} : ${champ} « ${affiche[champ]} » s'écarte de ${(ecart * 100).toFixed(2)} % de ${attendu[champ]}`);
    }
  }
});

// --- Cas nommés : ceux qui échouaient avant D13, D14 et D15 ---------------------------------

test('lame à tronçonner Ø 4.000" dans l’acier 440C durci : N = 4,375 rév/min, et « 4 » est accepté', () => {
  const question = questionPour({ outil: 'lame_a_tronconner', dimension: '4.000"', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: ACIER_440C_DURCI });
  const attendu = computeParameters(question, data);
  assert.equal(attendu.rpm, 4.375); // 35 × 4 / 4 × 0,125 (fact_vc voulu)
  assert.equal(attendu.feedRate, 0.0175); // 4,375 × 0,004

  const affiche = formatParameters(attendu);
  assert.deepEqual(affiche, { vc: '35', rpm: '4', feedPerTooth: '0.0040', feedPerRev: '0.0040', feedRate: '0.018' });

  // ±5 % de 4,375 = [4,156 ; 4,594] exclurait 4 ; la demi-unité d'affichage (D13) donne [3,875 ; 4,875].
  const resultat = gradeAnswers(attendu, affiche);
  assert.deepEqual(resultat.fields.rpm, { ok: true, value: 4, min: 3.875, max: 4.875 });
  assert.equal(resultat.success, true); // y compris Vf « 0.018 », à côté d'un N arrondi à 4

  // L'étudiant qui calcule Vf avec le N arrondi qu'il a saisi (4 × 0,004 = 0,016) a bon aussi…
  assert.equal(gradeAnswers(attendu, { ...affiche, feedRate: '0.016' }).success, true);
  // … mais pas celui qui saisit N = 5 ou N = 3.
  assert.equal(gradeAnswers(attendu, { ...affiche, rpm: '5', feedRate: '0.02' }).fields.rpm.ok, false);
  assert.equal(gradeAnswers(attendu, { ...affiche, rpm: '3', feedRate: '0.012' }).fields.rpm.ok, false);
});

test('filetage M48 x 5 à la barre à fileter dans l’acier à outils durci : N = 84,67 rév/min, 84 et 85 sont acceptés', () => {
  const question = questionPour({ outil: 'barre_a_fileter_2', dimension: 'M48 x 5', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: ACIER_OUTIL_DURCI });
  const attendu = computeParameters(question, data);
  assert.ok(Math.abs(attendu.rpm - 84.66666666666667) < 1e-9); // 40 × 4 × 25,4 / 48
  assert.equal(formatParameters(attendu).rpm, '85');

  // +0,1 % de 84,67 = 84,75 exclurait 85 ; la demi-unité d'affichage (D13) monte la borne à 85,17.
  const avecN = (n) => {
    const f = attendu.feedPerRev; // 5 / 25,4 po
    return gradeAnswers(attendu, { ...formatParameters(attendu), rpm: String(n), feedRate: enDecimal(n * f) });
  };
  assert.equal(avecN(85).success, true);
  assert.equal(avecN(84).success, true);
  assert.equal(avecN(9).success, true); // −90 % : la vitesse peut être réduite pour fileter (borne basse 8,47)
  assert.equal(avecN(86).fields.rpm.ok, false);
  assert.equal(avecN(8).fields.rpm.ok, false);

  // La réponse affichée complète (N « 85 », Vf théorique « 16.667 ») passe aussi.
  assert.equal(gradeAnswers(attendu, formatParameters(attendu)).success, true);
});

test('foret métrique Ø 0.05 mm : l’avance reste lisible à l’affichage et se corrige normalement', () => {
  const question = questionPour({ outil: 'foret_metrique', dimension: 'Ø 0.05 mm', dents: 2, materiauOutil: 'Acier rapide', groupeMateriau: ACIER_1020 });
  const attendu = computeParameters(question, data);
  assert.equal(attendu.rpmCapped, true); // 100 × 4 / 0,0019685 = 203 200 → plafond 10 000

  // fz = 0,006 × 0,05 / 25,4 = 0,0000118110… ; f = 2 × fz ; Vf = 10 000 × f
  const affiche = formatParameters(attendu);
  assert.deepEqual(affiche, { vc: '100', rpm: '10000', feedPerTooth: '0.0000118', feedPerRev: '0.0000236', feedRate: '0.236' });
  assert.equal(gradeAnswers(attendu, affiche).success, true);

  // La correction n'est pas devenue laxiste pour autant : ±25 % sur fz.
  const fz = (saisie) => gradeAnswers(attendu, { ...affiche, feedPerTooth: saisie }).fields.feedPerTooth.ok;
  assert.equal(fz('0.00001'), true); // −15 %
  assert.equal(fz('0'), false); // ce que l'ancien affichage « 0.0000 » aurait fait saisir
  assert.equal(fz('0.0001'), false); // dix fois trop
  assert.equal(fz('0.000015'), false); // +27 %
});

test('Vf cohérente avec les saisies mais loin de la théorie : acceptée (D15)', () => {
  // Foret fractionnaire Ø 1/4 po, acier rapide, acier 1020 : théorie N = 1600, f = 0,003, Vf = 4,8.
  const question = questionPour({ outil: 'foret_fractionnaire', dimension: 'Ø 1/4 po', dents: 2, materiauOutil: 'Acier rapide', groupeMateriau: ACIER_1020 });
  const attendu = computeParameters(question, data);

  // N à +5 % et f à +20 % sont acceptés ; leur produit, 6,048, est à +26 % de la Vf théorique.
  const reponses = { vc: '100', feedPerTooth: '0.0015', rpm: '1680', feedPerRev: '0.0036', feedRate: '6.048' };
  assert.equal(gradeAnswers(attendu, reponses).success, true);

  // La Vf théorique, elle, n'est pas cohérente avec ces saisies.
  assert.equal(gradeAnswers(attendu, { ...reponses, feedRate: '4.8' }).fields.feedRate.ok, false);
});
