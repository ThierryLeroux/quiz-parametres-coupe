// Tests de site/js/expression.js : les calculs dans les cases de réponse (D82) — l'évaluateur, l'écriture propre d'une
// expression, le résultat tel que la case l'affiche. parseAnswer, qui s'en sert, est testé dans correction.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXPRESSION_MAX_LENGTH, computedText, evaluateExpression, expressionText, isExpression } from '../site/js/expression.js';

const value = (text) => evaluateExpression(text).value;
const error = (text) => evaluateExpression(text).error;

test('evaluateExpression : priorités — × et / avant + et −, de gauche à droite à priorité égale', () => {
  assert.equal(value('2+3*4'), 14);
  assert.equal(value('2*3+4'), 10);
  assert.equal(value('10-4-3'), 3); // (10 − 4) − 3, pas 10 − (4 − 3)
  assert.equal(value('24/4/2'), 3); // (24 / 4) / 2
  assert.equal(value('8/2*4'), 16);
  assert.equal(value('1+8/4-2'), 1);
  assert.equal(value('400*4/2'), 800); // N = Vc × 4 / Ø
});

test('evaluateExpression : parenthèses, imbriquées ou non', () => {
  assert.equal(value('(3-1)*2'), 4);
  assert.equal(value('2*(3+4)'), 14);
  assert.equal(value('((2+3)*(4-1))/5'), 3);
  assert.equal(value('(5)'), 5);
  assert.equal(value('((((1))))'), 1);
  assert.equal(value('400*4/(0.5+0.5)'), 1600);
});

test('evaluateExpression : pi, sans égard à la casse, et π valent Math.PI', () => {
  assert.equal(value('pi'), Number(Math.PI.toPrecision(12)));
  for (const pi of ['PI', 'Pi', 'pI', 'π']) assert.equal(value(pi), value('pi'), pi); // majuscules automatiques des téléphones
  assert.equal(value('Pi*2'), Number((2 * Math.PI).toPrecision(12)));
  assert.equal(value('2*pi'), Number((2 * Math.PI).toPrecision(12)));
  assert.equal(value('400*12/(π*2)'), Number((400 * 12 / (Math.PI * 2)).toPrecision(12)));
});

test('evaluateExpression : les autres symboles — −, –, ×, x, X, ÷ — et les virgules', () => {
  assert.equal(value('5−2'), 3);
  assert.equal(value('4–1'), 3); // tiret demi-cadratin
  assert.equal(value('10–-2'), 12);
  assert.equal(value('4×2'), 8);
  assert.equal(value('4x2'), 8);
  assert.equal(value('2X3'), 6);
  assert.equal(value('9÷3'), 3);
  assert.equal(value('1,5+2,5'), 4); // chaque nombre a sa virgule
  assert.equal(value('0,75*4'), 3);
  assert.equal(value(' 1 600 * 2 '), 3200); // espaces ignorés, même dans un nombre, comme avant
  assert.equal(value('1 600,5+0,5'), 1601); // espace insécable
  assert.equal(value('.5*4'), 2);
  assert.equal(value('5.*2'), 10);
});

test('evaluateExpression : le moins unaire, partout où un nombre peut aller', () => {
  assert.equal(value('-5+10'), 5);
  assert.equal(value('10+-2'), 8);
  assert.equal(value('2*-3+10'), 4);
  assert.equal(value('(-1+3)*2'), 4);
  assert.equal(value('--5'), 5);
  assert.equal(value('-(2-5)'), 3);
  assert.equal(value('-pi+4'), Number((4 - Math.PI).toPrecision(12)));
});

test('evaluateExpression : le bruit de la virgule flottante disparaît (12 chiffres significatifs)', () => {
  assert.equal(value('0.1+0.2'), 0.3); // 0.30000000000000004 en virgule flottante
  assert.equal(value('3.2*100'), 320); // 320.00000000000006
  assert.equal(value('0.006*0.75'), 0.0045);
  assert.equal(value('4*350/0.75'), 1866.66666667);
});

test('evaluateExpression : illisible — mal formée, avec sa raison', () => {
  for (const saisie of [
    '', '   ', 'abc', '2(3)', '(2)(3)', '2pi', 'pi2', '(3+1)2', '2 3+', '3)', '(3', '()', '1+', '*2', '+5', '2++3', '1**2',
    '2^3', '1e3', '1.2.3+1', '1,2,3', '.+1', 'sqrt(4)', '2Pi', 'PI2', 'X2', '2X', '–', '2—3', '1/0+', '2%',
  ]) {
    assert.equal(error(saisie), 'syntax', saisie);
  }
});

test('evaluateExpression : illisible — division par zéro, résultat négatif (−0 compris)', () => {
  for (const saisie of ['1/0', '5/(2-2)', '0/0', '1/-0']) assert.equal(error(saisie), 'divisionByZero', saisie);
  for (const saisie of ['-5', '–5', '3-5', '3–5', '2*-3', '-0', '0*-1', '-(1)', '-pi', '-Pi']) assert.equal(error(saisie), 'negative', saisie);
  assert.equal(value('0'), 0);
  assert.equal(value('-0+0'), 0); // −0 + 0 = +0
  assert.equal(value('3-3'), 0);
});

test(`evaluateExpression : ${EXPRESSION_MAX_LENGTH} caractères au plus, 10 niveaux de parenthèses au plus`, () => {
  assert.equal(EXPRESSION_MAX_LENGTH, 60);
  const longue = `1${'+1'.repeat(29)}`; // 59 caractères
  assert.equal(value(`${longue} `), 30); // 60 caractères, l'espace compris
  assert.equal(error(`${longue}+1`), 'syntax'); // 61
  assert.equal(value(`${'('.repeat(10)}7${')'.repeat(10)}`), 7);
  assert.equal(error(`${'('.repeat(11)}7${')'.repeat(11)}`), 'syntax');
  assert.equal(value('(1+(2*(3-(4/(1+1)))))'), 3); // 5 niveaux
  for (const pasTexte of [null, undefined, 42, {}]) assert.equal(error(pasTexte), 'syntax');
});

test('evaluateExpression : jamais eval() ni Function() dans le fichier (D82, point 2)', () => {
  const source = readFileSync(new URL('../site/js/expression.js', import.meta.url), 'utf8')
    .replace(/\/\/[^\n]*/g, ''); // les commentaires en parlent
  assert.doesNotMatch(source, /\beval\s*\(|\bFunction\s*\(|new\s+Function\b/);
});

test('isExpression : un opérateur, une parenthèse ou pi — lisible ou non ; un nombre ou du texte, non', () => {
  for (const saisie of ['(3-1)*2', '2(3)', '-5', '4×2', '9÷3', '2x3', '2X3', 'pi', 'PI', 'Pi', 'pI', 'π', '1/0', '3+', '5−2', '4–1']) assert.equal(isExpression(saisie), true, saisie);
  for (const saisie of ['', '1600', '1 600', '0,0015', '.5', 'abc', '12a', '1.2.3', '1e3', 'P', null, undefined, 12]) assert.equal(isExpression(saisie), false, String(saisie));
});

test('expressionText : l’expression écrite proprement, ou null si elle est mal formée', () => {
  assert.equal(expressionText('4*350/0,75'), '4 × 350 / 0.75');
  assert.equal(expressionText('(3-1)x2'), '(3 − 1) × 2');
  assert.equal(expressionText(' 1 600 ÷ 2 '), '1600 / 2');
  assert.equal(expressionText('2*-pi+10'), '2 × −π + 10');
  assert.equal(expressionText('Pi*2X3–1'), 'π × 2 × 3 − 1'); // pi en toute casse, X et « – » s'écrivent comme les autres
  assert.equal(expressionText('PI*(.5+2.)'), 'π × (.5 + 2.)');
  assert.equal(expressionText('((2))'), '((2))');
  assert.equal(expressionText('1/0'), '1 / 0'); // lisible mais incalculable : elle s'écrit quand même
  assert.equal(expressionText('-5'), '−5');
  assert.equal(expressionText('2(3)'), null);
  assert.equal(expressionText('abc'), null);
});

test('computedText : le nombre jugé, s’il tient en 9 caractères ; sinon moins de chiffres, et « arrondi »', () => {
  assert.deepEqual(computedText(4), { text: '4', rounded: false });
  assert.deepEqual(computedText(0.0045), { text: '0.0045', rounded: false });
  assert.deepEqual(computedText(1600), { text: '1600', rounded: false });
  assert.deepEqual(computedText(0.3), { text: '0.3', rounded: false });
  assert.deepEqual(computedText(value('4*350/0.75')), { text: '1866.6667', rounded: true }); // 1866.66666667
  assert.deepEqual(computedText(value('400*12/(pi*2)')), { text: '763.94373', rounded: true });
  assert.deepEqual(computedText(value('1/3')), { text: '0.3333333', rounded: true });
  assert.deepEqual(computedText(value('0.05/25.4*0.006')), { text: '0.0000118', rounded: true }); // foret Ø 0.05 mm
  assert.deepEqual(computedText(0.00000012), { text: '0.0000001', rounded: true }); // sans exposant
  assert.deepEqual(computedText(123456789), { text: '123456789', rounded: false });
  assert.deepEqual(computedText(1234567890.5), { text: '1234567890.5', rounded: false }); // ne tient jamais : en entier
  assert.deepEqual(computedText(0), { text: '0', rounded: false });
  for (const n of [4, 0.0045, 1866.66666667, 763.943726841, 0.0000118110236]) assert.ok(computedText(n).text.length <= 9, String(n));
});
