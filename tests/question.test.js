// Tests de site/js/question.js : génération d'une question (SPEC §4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadData } from '../site/js/data.js';
import { generateQuestion } from '../site/js/question.js';

// Vraies données, lues sur disque (sous Node, fetch ne lit pas les fichiers locaux).
const lireFichier = async (url) => JSON.parse(await readFile(new URL(`../site/${url}`, import.meta.url), 'utf8'));
const data = await loadData('data/', lireFichier);
const outil = (id) => data.outils.find((o) => o.id === id);

// Aléa fixé : retourne les valeurs données, dans l'ordre. Un tirage de trop fait échouer le test.
// Ordre des 6 tirages : outil, nombre de dents, dimension, matériau d'outil, groupe, matériau brut.
const suite = (...valeurs) => {
  let i = 0;
  return () => {
    assert.ok(i < valeurs.length, 'plus de tirages que prévu');
    return valeurs[i++];
  };
};

// Générateur pseudo-aléatoire à graine (mulberry32) : tirages nombreux mais reproductibles.
const aleaAGraine = (graine) => () => {
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

test('tirage déterministe : fraise en bout, 5 dents, Ø 1/4 po, carbure, acier 1045', () => {
  const admissibles = [outil('mclnr'), outil('fraise_en_bout_helicoidale')];
  // outil 2/2 ; dents 2 + ⌊0,99 × 4⌋ = 5 ; dimension 4/6 ; matériau d'outil 2/2 ; groupe 1/14 ; matériau 2/5
  const question = generateQuestion(data, admissibles, suite(0.5, 0.99, 0.5, 0.5, 0, 0.2));

  assert.deepEqual(question, {
    tool: { id: 'fraise_en_bout_helicoidale', name: 'Fraise en bout hélicoïdale', operation: 'Contournage ébauche' },
    displayId: 'Fraise en bout Ø 1/4 po - 5 lèvres',
    teeth: 5,
    dimension: { label: '1/4 po', diameter: 0.25, pitch: null },
    toolMaterial: { label: 'Carbure de tungstène solide', key: 'carbure_solide' },
    material: {
      iso: 'P', groupe: 2, materiau: 'Acier non allié', composition: 'C > 0.25 … ≤ 0.55%', etat: 'Recuit',
      durete: 190, exemple: 1045, vc_pi_min: { acier_rapide: 95, carbure_solide: 195, insert_carbure: 390 },
    },
  });
});

test('bornes de l’aléa : 0 donne le premier choix partout, 0,999… le dernier', () => {
  const fraise = outil('fraise_en_bout_helicoidale');

  const premiere = generateQuestion(data, [fraise], suite(0, 0, 0, 0, 0, 0));
  assert.equal(premiere.teeth, fraise.nb_dents_min);
  assert.equal(premiere.dimension.label, fraise.dimensions[0].libelle);
  assert.equal(premiere.toolMaterial.label, fraise.materiaux_outil[0]);
  assert.equal(premiere.material.groupe, 1);

  const presqueUn = 1 - Number.EPSILON;
  const derniere = generateQuestion(data, [fraise], suite(presqueUn, presqueUn, presqueUn, presqueUn, presqueUn, presqueUn));
  assert.equal(derniere.teeth, fraise.nb_dents_max);
  assert.equal(derniere.dimension.label, fraise.dimensions.at(-1).libelle);
  assert.equal(derniere.toolMaterial.label, fraise.materiaux_outil.at(-1));
  const dernierGroupe = data.materialsByGroup.get(fraise.groupes_materiaux_usinables.at(-1));
  assert.deepEqual(derniere.material, dernierGroupe.at(-1));
});

test('filetage impérial : « 5/16 - 18 UNC » → Ø 0,3125 po, pas 1/18 po', () => {
  // dimension 2/10 ; groupe 8/18 (N - Aluminium de corroyage) ; matériau 2/2
  const question = generateQuestion(data, [outil('taraud_imperial')], suite(0, 0, 0.1, 0, 0.4, 0.5));
  assert.equal(question.displayId, 'Taraud 5/16 - 18 UNC');
  assert.deepEqual(question.dimension, { label: '5/16 - 18 UNC', diameter: 0.3125, pitch: 1 / 18 });
  assert.equal(question.teeth, 1);
  assert.equal(question.material.groupe, 22);
});

test('filetage métrique : « M10 x 1.50 » → Ø 10/25,4 po, pas 1,5/25,4 po', () => {
  // dimension 10/24
  const question = generateQuestion(data, [outil('taraud_metrique')], suite(0, 0, 0.38, 0, 0, 0));
  assert.equal(question.displayId, 'Taraud M10 x 1.50');
  assert.deepEqual(question.dimension, { label: 'M10 x 1.50', diameter: 10 / 25.4, pitch: 1.5 / 25.4 });
});

test('hors filetage, une dimension métrique garde son libellé et donne le Ø en pouces', () => {
  const question = generateQuestion(data, [outil('mclnr')], suite(0, 0, 0, 0, 0, 0));
  assert.equal(question.displayId, 'MCLNR - Ø charioté: 10 mm');
  assert.deepEqual(question.dimension, { label: '10 mm', diameter: 10 / 25.4, pitch: null });
  assert.deepEqual(question.toolMaterial, { label: 'Insert de carbure de tungstène', key: 'insert_carbure' });
});

test('gabarit : tous les jetons reconnus sont remplacés', () => {
  const special = { ...outil('fraise_en_bout_helicoidale'), format_identifiant: '[NomOutil] | [Operation] | [Matoutil] | [IdDia] | [NbDent] | [NbDent]' };
  const question = generateQuestion(data, [special], suite(0, 0, 0, 0, 0, 0));
  assert.equal(question.displayId, 'Fraise en bout hélicoïdale | Contournage ébauche | Acier rapide | 1/8 po | 2 | 2');
});

test('gabarit : un jeton inconnu est une erreur explicite', () => {
  const special = { ...outil('mclnr'), format_identifiant: 'MCLNR [Couleur]' };
  assert.throws(() => generateQuestion(data, [special], suite(0, 0, 0, 0, 0, 0)), /Jeton inconnu.*\[Couleur\]/);
});

test('aucun outil admissible → erreur explicite', () => {
  assert.throws(() => generateQuestion(data, [], Math.random), /Aucun outil admissible/);
  assert.throws(() => generateQuestion(data, undefined, Math.random), /Aucun outil admissible/);
});

test('exactement 6 tirages par question, même quand il n’y a qu’un seul choix', () => {
  let tirages = 0;
  generateQuestion(data, [outil('mclnr')], () => { tirages += 1; return 0; });
  assert.equal(tirages, 6);
});

test('la question est sérialisable en JSON et indépendante des données chargées', () => {
  const question = generateQuestion(data, data.outils, aleaAGraine(1));
  assert.deepEqual(JSON.parse(JSON.stringify(question)), question);

  const vcAvant = data.materiaux.find((m) => m.groupe === question.material.groupe).vc_pi_min.acier_rapide;
  question.material.vc_pi_min.acier_rapide = -1;
  assert.equal(data.materiaux.find((m) => m.groupe === question.material.groupe).vc_pi_min.acier_rapide, vcAvant);
});

test('seuls les outils admissibles sortent', () => {
  const admissibles = data.outils.filter((o) => o.reussites_requises > 0);
  const ids = new Set(admissibles.map((o) => o.id));
  const random = aleaAGraine(2);
  const sortis = new Set();
  for (let i = 0; i < 2000; i += 1) sortis.add(generateQuestion(data, admissibles, random).tool.id);
  assert.deepEqual([...sortis].sort(), [...ids].sort());
});

test('couverture : chaque outil, dimension, nombre de dents, matériau d’outil et groupe de matériaux sort au moins une fois', () => {
  // Tout ce qui doit sortir, par outil.
  const attendus = new Set();
  for (const o of data.outils) {
    attendus.add(`${o.id} | outil`);
    for (const d of o.dimensions) attendus.add(`${o.id} | dimension ${d.libelle}`);
    for (let n = o.nb_dents_min; n <= o.nb_dents_max; n += 1) attendus.add(`${o.id} | dents ${n}`);
    for (const m of o.materiaux_outil) attendus.add(`${o.id} | matériau d'outil ${m}`);
    for (const g of o.groupes_materiaux_usinables) attendus.add(`${o.id} | groupe ${g}`);
  }

  // L'événement le plus rare (une dimension du foret métrique) a 1 chance sur 29 × 111 ≈ 3 200.
  const random = aleaAGraine(2026);
  const materiauxSortis = new Set();
  for (let i = 0; i < 100000; i += 1) {
    const q = generateQuestion(data, data.outils, random);
    const o = outil(q.tool.id);

    // Chaque question doit être cohérente avec son outil.
    assert.ok(!/[[\]]/.test(q.displayId), `jeton non résolu : ${q.displayId}`);
    assert.ok(q.dimension.diameter > 0, q.displayId);
    assert.equal(q.dimension.pitch !== null, data.operationByName.get(o.operation).avance_egale_pas_filetage, q.displayId);
    assert.ok(q.material.vc_pi_min[q.toolMaterial.key] > 0, q.displayId);
    const groupe = `${q.material.iso} - ${q.material.materiau}`;
    assert.ok(o.groupes_materiaux_usinables.includes(groupe), `${q.displayId} : ${groupe}`);

    attendus.delete(`${o.id} | outil`);
    attendus.delete(`${o.id} | dimension ${q.dimension.label}`);
    attendus.delete(`${o.id} | dents ${q.teeth}`);
    attendus.delete(`${o.id} | matériau d'outil ${q.toolMaterial.label}`);
    attendus.delete(`${o.id} | groupe ${groupe}`);
    materiauxSortis.add(q.material.groupe);
  }

  assert.deepEqual([...attendus], [], 'jamais sortis');
  // Les groupes « O - … » ne sont usinables que par certains outils, mais chaque matériau usinable doit sortir.
  const usinables = new Set(data.outils.flatMap((o) => o.groupes_materiaux_usinables).flatMap((g) => data.materialsByGroup.get(g).map((m) => m.groupe)));
  assert.equal(materiauxSortis.size, usinables.size);
});
