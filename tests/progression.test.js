// Tests de site/js/progression.js : réussites consécutives, outils admissibles, complétion (SPEC §7, D12).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadData } from '../site/js/data.js';
import { loadExercise, validateExercise } from '../site/js/exercice.js';
import { generateQuestion } from '../site/js/question.js';
import { createProgress, eligibleTools, isComplete, recordResult } from '../site/js/progression.js';

const lireFichier = async (url) => JSON.parse(await readFile(new URL(`../site/${url}`, import.meta.url), 'utf8'));
const data = await loadData('data/', lireFichier);
const m10 = await loadExercise('m10-tournage-vc', data, 'exercices/', lireFichier);

// Petit exercice avec restrictions de dimensions, de matériaux d'outil et de groupes.
const EXERCICE = {
  id: 'essai',
  titre: 'Essai',
  version: 'r1',
  champs_evalues: ['vc'],
  outils: [
    { id: 'mvlnr', reussites_requises: 3 },
    { id: 'mclnr', reussites_requises: 1 },
    { id: 'foret_fractionnaire', reussites_requises: 2, dimensions: ['Ø 1/4 po', 'Ø 1/2 po'], materiaux_outil: ['Acier rapide'], groupes: ['P - Acier non allié', 'N - Aluminium de corroyage'] },
  ],
};
assert.deepEqual(validateExercise(EXERCICE, data), []);

// Générateur pseudo-aléatoire à graine (mulberry32) : tirages nombreux mais reproductibles.
const aleaAGraine = (graine) => () => {
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const ids = (outils) => outils.map((o) => o.id);

test('createProgress : état de départ, sérialisable en JSON', () => {
  const depart = createProgress(EXERCICE);
  assert.deepEqual(depart, { exerciceId: 'essai', reussites: {}, totalReussies: 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(depart)), depart);
  assert.equal(isComplete(EXERCICE, depart), false);
});

test('recordResult : une réussite ajoute 1 au compteur de l’outil et au total', () => {
  let etat = createProgress(EXERCICE);
  etat = recordResult(etat, 'mvlnr', true);
  etat = recordResult(etat, 'mvlnr', true);
  etat = recordResult(etat, 'mclnr', true);
  assert.deepEqual(etat, { exerciceId: 'essai', reussites: { mvlnr: 2, mclnr: 1 }, totalReussies: 3 });
});

test('recordResult : un échec remet à zéro le compteur de cet outil, et seulement celui-là', () => {
  let etat = createProgress(EXERCICE);
  etat = recordResult(etat, 'mvlnr', true);
  etat = recordResult(etat, 'mvlnr', true);
  etat = recordResult(etat, 'foret_fractionnaire', true);
  etat = recordResult(etat, 'mvlnr', false);
  assert.deepEqual(etat.reussites, { mvlnr: 0, foret_fractionnaire: 1 });
});

test('recordResult : le total des questions réussies ne diminue jamais', () => {
  let etat = createProgress(EXERCICE);
  etat = recordResult(etat, 'mvlnr', true);
  etat = recordResult(etat, 'mvlnr', true);
  etat = recordResult(etat, 'mvlnr', false);
  assert.equal(etat.totalReussies, 2);
  etat = recordResult(etat, 'mvlnr', true);
  assert.deepEqual(etat, { exerciceId: 'essai', reussites: { mvlnr: 1 }, totalReussies: 3 });
});

test('recordResult : un échec sur un outil jamais réussi laisse son compteur à 0', () => {
  const etat = recordResult(createProgress(EXERCICE), 'mclnr', false);
  assert.deepEqual(etat, { exerciceId: 'essai', reussites: { mclnr: 0 }, totalReussies: 0 });
});

test('recordResult : ne modifie pas l’état reçu', () => {
  const avant = recordResult(createProgress(EXERCICE), 'mvlnr', true);
  const copie = structuredClone(avant);
  const apres = recordResult(avant, 'mvlnr', false);
  assert.deepEqual(avant, copie);
  assert.notEqual(apres, avant);
  assert.notEqual(apres.reussites, avant.reussites);
});

test('eligibleTools : au départ, tous les outils de l’exercice et seulement eux', () => {
  assert.deepEqual(ids(eligibleTools(EXERCICE, data, createProgress(EXERCICE))), ['mvlnr', 'mclnr', 'foret_fractionnaire']);
  assert.deepEqual(ids(eligibleTools(m10, data, createProgress(m10))), m10.outils.map((o) => o.id));
});

test('eligibleTools : un outil qui a atteint ses réussites requises ne sort plus ; un échec le ramène', () => {
  let etat = createProgress(EXERCICE);
  etat = recordResult(etat, 'mclnr', true); // 1/1 : terminé
  etat = recordResult(etat, 'mvlnr', true); // 1/3
  assert.deepEqual(ids(eligibleTools(EXERCICE, data, etat)), ['mvlnr', 'foret_fractionnaire']);

  etat = recordResult(etat, 'mvlnr', true);
  etat = recordResult(etat, 'mvlnr', true); // 3/3 : terminé
  assert.deepEqual(ids(eligibleTools(EXERCICE, data, etat)), ['foret_fractionnaire']);

  etat = recordResult(etat, 'foret_fractionnaire', true);
  etat = recordResult(etat, 'foret_fractionnaire', false); // retour à 0/2
  assert.deepEqual(ids(eligibleTools(EXERCICE, data, etat)), ['foret_fractionnaire']);
});

test('eligibleTools : applique les restrictions de dimensions, de matériaux d’outil et de groupes, sans toucher au catalogue', () => {
  const catalogue = data.outils.find((o) => o.id === 'foret_fractionnaire');
  const nbDimensions = catalogue.dimensions.length;
  const nbGroupes = catalogue.groupes_materiaux_usinables.length;
  assert.deepEqual(catalogue.materiaux_outil, ['Acier rapide', 'Carbure de tungstène solide']);

  const [mvlnr, , foret] = eligibleTools(EXERCICE, data, createProgress(EXERCICE));
  assert.deepEqual(foret.dimensions, [{ libelle: 'Ø 1/4 po', valeur: 0.25 }, { libelle: 'Ø 1/2 po', valeur: 0.5 }]);
  assert.deepEqual(foret.materiaux_outil, ['Acier rapide']);
  assert.deepEqual(foret.groupes_materiaux_usinables, ['P - Acier non allié', 'N - Aluminium de corroyage']);
  assert.equal(foret.limite_rpm, catalogue.limite_rpm); // le reste de l'outil est intact

  // Sans restriction : tout l'outil.
  assert.deepEqual(mvlnr, data.outils.find((o) => o.id === 'mvlnr'));

  // Le catalogue n'a pas bougé.
  assert.equal(catalogue.dimensions.length, nbDimensions);
  assert.equal(catalogue.groupes_materiaux_usinables.length, nbGroupes);
  assert.equal(catalogue.materiaux_outil.length, 2);
});

test('restrictions : les questions générées ne sortent que les dimensions, matériaux d’outil et groupes permis', () => {
  const random = aleaAGraine(5);
  const admissibles = eligibleTools(EXERCICE, data, createProgress(EXERCICE));
  const dimensions = new Set();
  const groupes = new Set();
  const materiauxOutil = new Set();
  for (let i = 0; i < 3000; i += 1) {
    const q = generateQuestion(data, admissibles, random);
    if (q.tool.id !== 'foret_fractionnaire') continue;
    dimensions.add(q.dimension.label);
    materiauxOutil.add(q.toolMaterial.label);
    groupes.add(`${q.material.iso} - ${q.material.materiau}`);
  }
  assert.deepEqual([...dimensions].sort(), ['Ø 1/2 po', 'Ø 1/4 po']);
  assert.deepEqual([...materiauxOutil], ['Acier rapide']);
  assert.deepEqual([...groupes].sort(), ['N - Aluminium de corroyage', 'P - Acier non allié']);
});

test('eligibleTools : la restriction de matière d’outil de l’exercice (D40) s’applique à tous les outils, croisée avec celle de l’entrée', () => {
  const exercice = { ...EXERCICE, materiaux_outil: ['Acier rapide', 'Insert de carbure de tungstène'], outils: [...EXERCICE.outils, { id: 'foret_a_pointer', reussites_requises: 1 }] };
  assert.deepEqual(validateExercise(exercice, data), []);
  const [mvlnr, mclnr, foret, pointer] = eligibleTools(exercice, data, createProgress(exercice));
  assert.deepEqual(mvlnr.materiaux_outil, ['Insert de carbure de tungstène']);
  assert.deepEqual(mclnr.materiaux_outil, ['Insert de carbure de tungstène']);
  assert.deepEqual(foret.materiaux_outil, ['Acier rapide']);
  assert.deepEqual(pointer.materiaux_outil, ['Acier rapide']); // le carbure solide, qu'offre l'outil, est exclu par l'exercice
  const random = aleaAGraine(9);
  for (let i = 0; i < 2000; i += 1) {
    const q = generateQuestion(data, [pointer, foret], random);
    assert.equal(q.toolMaterial.label, 'Acier rapide');
  }
  assert.deepEqual(data.outils.find((o) => o.id === 'foret_a_pointer').materiaux_outil, ['Acier rapide', 'Carbure de tungstène solide']); // le catalogue n'a pas bougé
});

test('isComplete : vrai seulement quand chaque outil a atteint ses réussites requises', () => {
  let etat = createProgress(EXERCICE);
  const reussir = (id, fois) => { for (let i = 0; i < fois; i += 1) etat = recordResult(etat, id, true); };

  reussir('mvlnr', 3);
  reussir('mclnr', 1);
  reussir('foret_fractionnaire', 1);
  assert.equal(isComplete(EXERCICE, etat), false); // foret : 1/2

  reussir('foret_fractionnaire', 1);
  assert.equal(isComplete(EXERCICE, etat), true);
  assert.deepEqual(eligibleTools(EXERCICE, data, etat), []);
  assert.equal(etat.totalReussies, 6);
});

test('isComplete : un échec avant la dernière réussite requise oblige à recommencer la série', () => {
  let etat = createProgress(EXERCICE);
  etat = recordResult(etat, 'mclnr', true);
  for (const succes of [true, true]) etat = recordResult(etat, 'foret_fractionnaire', succes);
  for (const succes of [true, true, false, true, true]) etat = recordResult(etat, 'mvlnr', succes);
  assert.equal(etat.reussites.mvlnr, 2);
  assert.equal(isComplete(EXERCICE, etat), false);

  etat = recordResult(etat, 'mvlnr', true);
  assert.equal(isComplete(EXERCICE, etat), true);
  assert.equal(etat.totalReussies, 8); // 1 + 2 + 5 réussites ; l'échec n'a rien retiré au total
});

test('séance simulée du M10 : sans erreur, l’exercice se termine en 15 questions', () => {
  const random = aleaAGraine(10);
  let etat = createProgress(m10);
  let questions = 0;
  while (!isComplete(m10, etat)) {
    const question = generateQuestion(data, eligibleTools(m10, data, etat), random);
    etat = recordResult(etat, question.tool.id, true);
    questions += 1;
    assert.ok(questions <= 15, 'un outil terminé ne doit plus sortir');
  }
  assert.equal(questions, 15); // 1 + 3 + 3 + 1 + 1 + 3 + 1 + 1 + 1
  assert.equal(etat.totalReussies, 15);
});

// (Avec un échec sur trois, elle ne finirait jamais : réussi-réussi-raté ne donne pas 3 réussites de suite.)
test('séance simulée du M10 : avec un échec sur cinq, elle se termine quand même, en plus de questions', () => {
  const random = aleaAGraine(10);
  let etat = createProgress(m10);
  let questions = 0;
  while (!isComplete(m10, etat)) {
    const question = generateQuestion(data, eligibleTools(m10, data, etat), random);
    questions += 1;
    etat = recordResult(etat, question.tool.id, questions % 5 !== 0);
    assert.ok(questions < 1000, 'la séance ne se termine pas');
  }
  assert.ok(questions > 15);
  assert.equal(etat.totalReussies, questions - Math.floor(questions / 5));
});

test('une progression sauvegardée pour un autre exercice est refusée', () => {
  const autre = createProgress(m10);
  assert.throws(() => eligibleTools(EXERCICE, data, autre), /progression est celle de l'exercice « m10-tournage-vc », pas de « essai »/);
  assert.throws(() => isComplete(EXERCICE, autre), /progression est celle de l'exercice/);
});

test('la progression survit à un passage par JSON (localStorage)', () => {
  let etat = createProgress(EXERCICE);
  etat = recordResult(etat, 'mvlnr', true);
  const relue = JSON.parse(JSON.stringify(etat));
  assert.deepEqual(relue, etat);
  assert.deepEqual(ids(eligibleTools(EXERCICE, data, relue)), ids(eligibleTools(EXERCICE, data, etat)));
});
