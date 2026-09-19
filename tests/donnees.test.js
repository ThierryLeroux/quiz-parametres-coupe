// Validation minimale des données de référence. Premier test du projet :
// il garantit que les JSON sont lisibles et cohérents avant tout moteur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const lire = async (nom) => JSON.parse(await readFile(new URL(`../data/${nom}`, import.meta.url), 'utf8'));

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
