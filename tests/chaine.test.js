// Test de bout en bout du moteur : question → calcul → affichage → correction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadData } from '../site/js/data.js';
import { generateQuestion } from '../site/js/question.js';
import { computeParameters } from '../site/js/calcul.js';
import { formatParameters } from '../site/js/format.js';
import { gradeAnswers } from '../site/js/correction.js';

const lireFichier = async (url) => JSON.parse(await readFile(new URL(`../site/${url}`, import.meta.url), 'utf8'));
const data = await loadData('data/', lireFichier);

// Générateur pseudo-aléatoire à graine (mulberry32) : tirages nombreux mais reproductibles.
const aleaAGraine = (graine) => () => {
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

test('la réponse théorique exacte (non arrondie) réussit toujours la correction', () => {
  const random = aleaAGraine(3);
  for (let i = 0; i < 20000; i += 1) {
    const question = generateQuestion(data, data.outils, random);
    const attendu = computeParameters(question, data);
    const reponses = Object.fromEntries(['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate'].map((champ) => [champ, String(attendu[champ])]));
    // String() d'un très petit nombre donne « 1.18e-5 », que parseAnswer refuse à bon droit : on l'écrit en décimal.
    for (const champ of Object.keys(reponses)) if (reponses[champ].includes('e')) reponses[champ] = attendu[champ].toFixed(20);
    assert.equal(gradeAnswers(attendu, reponses).success, true, question.displayId);
  }
});

// ❓ Échec connu, à trancher par Thierry (SPEC §5 « Arrondis » contre SPEC §6) : la réponse
// théorique ARRONDIE comme à l'affichage ne passe pas toujours la correction.
//   1. Micro-forets (foret métrique ≤ 0,3 mm, forets #71 à #80) : à 4 décimales, fz et f
//      s'affichent « 0.0000 », « 0.0001 » ou « 0.0002 », hors de ±25 % / ±20 %.
//   2. Filetage, N < 500 rév/min : arrondir N à l'entier SUPÉRIEUR dépasse la tolérance de
//      +0,1 % (84,67 → 85). Vf, jugée sur N_saisi × f_saisi, échoue alors par ricochet.
//   3. Lame à tronçonner Ø 4.000" : N théorique = 4,375 rév/min ; l'entier 4 est hors de ±5 %.
// Retirer `todo` quand la SPEC aura été ajustée (décimales, arrondi de N, ou tolérances).
test('la réponse théorique arrondie comme à l’affichage réussit la correction', { todo: 'SPEC §5 / §6 : arrondis d’affichage et tolérances à concilier' }, () => {
  const random = aleaAGraine(11);
  const echecs = new Set();
  for (let i = 0; i < 100000; i += 1) {
    const question = generateQuestion(data, data.outils, random);
    const attendu = computeParameters(question, data);
    const resultat = gradeAnswers(attendu, formatParameters(attendu));
    for (const [champ, r] of Object.entries(resultat.fields)) {
      if (!r.ok) echecs.add(`${question.tool.id} | ${question.dimension.label} | ${champ}`);
    }
  }
  assert.deepEqual([...echecs].sort().slice(0, 10), [], `${echecs.size} combinaisons outil | dimension | champ en échec (10 premières)`);
});
