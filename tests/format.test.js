// Tests de site/js/format.js : arrondis d'affichage (SPEC §5 ; D9, D14), point décimal (D10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decimalsOf, formatFeed, formatNumber, formatParameters } from '../site/js/format.js';

test('formatNumber : nombre de décimales fixe, point décimal', () => {
  assert.equal(formatNumber(4.8, 3), '4.800');
  assert.equal(formatNumber(1600, 0), '1600');
  assert.equal(formatNumber(0.0015, 4), '0.0015');
  assert.equal(formatNumber(0.05, 5), '0.05000');
  assert.equal(formatNumber(10000, 0), '10000'); // pas de séparateur de milliers
});

test('formatNumber : arrondi au plus proche, demi vers le haut', () => {
  assert.equal(formatNumber(423.3333333333333, 0), '423');
  assert.equal(formatNumber(846.6666666666666, 0), '847');
  assert.equal(formatNumber(1016.5, 0), '1017');
  assert.equal(formatNumber(4.375, 0), '4');
  assert.equal(formatNumber(0.11811023622047244, 5), '0.11811');
});

test('formatNumber : le bruit de la virgule flottante ne fausse pas l’arrondi', () => {
  assert.equal(formatNumber(1.0005, 3), '1.001'); // 1.0005 × 1000 = 1000.4999999999999
  assert.equal(formatNumber(0.00015, 4), '0.0002'); // 0.00015 × 10 000 = 1.4999999999999998
  assert.equal(formatNumber(4.800000000000001, 3), '4.800'); // 1600 × 0.003
  assert.equal(formatNumber(1.005, 2), '1.01');
});

test('decimalsOf : nombre de décimales d’un texte formaté', () => {
  assert.equal(decimalsOf('1600'), 0);
  assert.equal(decimalsOf('0.0015'), 4);
  assert.equal(decimalsOf('0.0000118'), 7);
});

test('formatFeed (D14) : au moins 4 décimales', () => {
  assert.equal(formatFeed(0.0015, 4), '0.0015');
  assert.equal(formatFeed(0.003, 4), '0.0030');
  assert.equal(formatFeed(0.005, 4), '0.0050');
  assert.equal(formatFeed(0.01, 4), '0.0100');
  assert.equal(formatFeed(0.012, 4), '0.0120');
  assert.equal(formatFeed(0.125, 5), '0.12500'); // filetage : au moins 5 décimales
});

test('formatFeed (D14) : au moins 3 chiffres significatifs pour les petites avances', () => {
  assert.equal(formatFeed(0.001875, 4), '0.00188'); // foret Ø 5/16 po : 0,006 × 0,3125
  assert.equal(formatFeed(0.00009375, 4), '0.0000938'); // foret Ø 1/64 po
  assert.equal(formatFeed(0.000011811023622047246, 4), '0.0000118'); // foret métrique Ø 0,05 mm : pas « 0.0000 »
  assert.equal(formatFeed(0.000162, 4), '0.000162'); // foret #80, f
  assert.equal(formatFeed(0.06889763779527559, 5), '0.06890'); // M12 x 1.75 : 3 chiffres significatifs déjà atteints
});

test('formatFeed (D14) : les zéros de fin au-delà du minimum ne sont pas écrits', () => {
  assert.equal(formatFeed(0.0015, 4), '0.0015'); // pas « 0.00150 »
  assert.equal(formatFeed(0.00015, 4), '0.00015'); // pas « 0.000150 »
  assert.equal(formatFeed(0.00099996, 4), '0.0010'); // l'arrondi à 3 chiffres remonte à 0,00100
});

test('formatParameters : hors filetage → N entier, avances à 4 décimales, Vf à 3 décimales', () => {
  // Foret fractionnaire Ø 1/4 po, acier rapide, acier 1020 (voir calcul.test.js)
  const parametres = { vc: 100, rpmRaw: 1600, rpm: 1600, rpmCapped: false, feedPerTooth: 0.0015, feedPerToothCapped: false, feedPerRev: 0.003, feedRate: 4.800000000000001, feedType: 'proportional' };
  assert.deepEqual(formatParameters(parametres), { vc: '100', rpm: '1600', feedPerTooth: '0.0015', feedPerRev: '0.0030', feedRate: '4.800' });
});

test('formatParameters : filetage → avances à 5 décimales', () => {
  // Taraud M24 x 3, acier rapide, acier 1020 (voir calcul.test.js)
  const parametres = { vc: 100, rpmRaw: 423.3333333333333, rpm: 423.3333333333333, rpmCapped: false, feedPerTooth: 0.11811023622047244, feedPerToothCapped: false, feedPerRev: 0.11811023622047244, feedRate: 50, feedType: 'thread' };
  assert.deepEqual(formatParameters(parametres), { vc: '100', rpm: '423', feedPerTooth: '0.11811', feedPerRev: '0.11811', feedRate: '50.000' });
});

test('formatParameters : c’est le N plafonné qui est affiché, une Vc décimale reste telle quelle, un micro-foret reste lisible', () => {
  // Foret fractionnaire Ø 1/64 po, carbure, aluminium (voir calcul.test.js)
  const parametres = { vc: 97.5, rpmRaw: 102400, rpm: 10000, rpmCapped: true, feedPerTooth: 0.00009375, feedPerToothCapped: false, feedPerRev: 0.0001875, feedRate: 1.875, feedType: 'proportional' };
  assert.deepEqual(formatParameters(parametres), { vc: '97.5', rpm: '10000', feedPerTooth: '0.0000938', feedPerRev: '0.000188', feedRate: '1.875' });
});
