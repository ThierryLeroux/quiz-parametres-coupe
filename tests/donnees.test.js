// Validation minimale des données de référence. Premier test du projet :
// il garantit que les JSON sont lisibles et cohérents avant tout moteur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const lire = async (nom) => JSON.parse(await readFile(new URL(`../site/data/${nom}`, import.meta.url), 'utf8'));

test('materiaux.json : 47 matériaux, groupes 1..47, Vc positives', async () => {
  const { materiaux } = await lire('materiaux.json');
  assert.equal(materiaux.length, 47);
  materiaux.forEach((m, i) => {
    assert.equal(m.groupe, i + 1);
    for (const v of Object.values(m.vc_pi_min)) assert.ok(v > 0, `${m.materiau} groupe ${m.groupe}`);
  });
});

test('operations.json : chaque opération est fixe, proportionnelle ou filetage', async () => {
  const { operations } = await lire('operations.json');
  assert.equal(operations.length, 19);
  for (const op of operations) {
    if (op.avance_egale_pas_filetage) assert.equal(op.avance_po_rev, null);
    else assert.ok(op.avance_po_rev > 0 && op.avance_max_po_rev >= op.avance_po_rev, op.operation);
  }
});

test("outils.json : chaque outil référence une opération connue et a des dimensions", async () => {
  const { outils } = await lire('outils.json');
  const { operations } = await lire('operations.json');
  const noms = new Set(operations.map((o) => o.operation));
  assert.equal(outils.length, 29);
  for (const o of outils) {
    assert.ok(noms.has(o.operation), `${o.nom} → ${o.operation}`);
    assert.ok(o.dimensions.length > 0, o.nom);
    assert.ok(o.nb_dents_min >= 1 && o.nb_dents_max >= o.nb_dents_min, o.nom);
  }
});

test('exercices/m10-tournage-vc.json : reprend les réussites requises du classeur M10', async () => {
  const exercice = JSON.parse(await readFile(new URL('../site/exercices/m10-tournage-vc.json', import.meta.url), 'utf8'));
  const { outils } = await lire('outils.json');
  assert.equal(exercice.id, 'm10-tournage-vc');
  assert.equal(exercice.multiplicateur_moodle, 54126);
  assert.deepEqual(exercice.champs_evalues, ['vc']);

  // Ligne 3 de la feuille « Liste d'outils » : 9 outils de tournage évalués, les 20 autres à 0.
  const requises = Object.fromEntries(exercice.outils.map((o) => [o.id, o.reussites_requises]));
  assert.deepEqual(requises, {
    mclnr: 1, mvlnr: 3, lame_a_tronconner: 3, barre_a_fileter: 1, barre_a_fileter_2: 1,
    barre_a_rainurer: 3, barre_a_aleser: 1, sdtmr: 1, sdtmr_2: 1,
  });
  for (const id of Object.keys(requises)) assert.ok(outils.some((o) => o.id === id), id);
  for (const o of outils) assert.equal('reussites_requises' in o, false, `${o.id} : le catalogue ne porte plus les réussites (D11)`);
});
