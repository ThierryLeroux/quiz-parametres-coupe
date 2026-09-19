// Tests de site/js/data.js : lecture et validation des données de référence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TOOL_MATERIAL_KEYS, parseThread } from '../site/js/data.js';

const lire = async (nom) => JSON.parse(await readFile(new URL(`../site/data/${nom}`, import.meta.url), 'utf8'));

const presque = (obtenu, attendu, message) => assert.ok(Math.abs(obtenu - attendu) < 1e-9, `${message} : ${obtenu} ≠ ${attendu}`);

// Dimensions de tous les outils de filetage, avec le nom de l'outil pour les messages.
const dimensionsFiletage = async () => {
  const { operations } = await lire('operations.json');
  const { outils } = await lire('outils.json');
  const filetages = new Set(operations.filter((op) => op.avance_egale_pas_filetage).map((op) => op.operation));
  return outils
    .filter((o) => filetages.has(o.operation))
    .flatMap((o) => o.dimensions.map((d) => ({ ...d, outil: o.nom })));
};

test('TOOL_MATERIAL_KEYS : chaque clé existe dans vc_pi_min de chaque matériau', async () => {
  const { materiaux } = await lire('materiaux.json');
  for (const m of materiaux) {
    for (const cle of Object.values(TOOL_MATERIAL_KEYS)) assert.ok(cle in m.vc_pi_min, `groupe ${m.groupe} : ${cle}`);
  }
});

test('parseThread : filetage impérial « Ø-filets/po »', () => {
  assert.deepEqual(parseThread('0.25-20'), { diameter: 0.25, pitch: 1 / 20 });
  assert.deepEqual(parseThread('.3125-18'), { diameter: 0.3125, pitch: 1 / 18 });
  assert.deepEqual(parseThread('1-8'), { diameter: 1, pitch: 1 / 8 });
});

test('parseThread : filetage métrique « ØxPas » converti en pouces', () => {
  assert.deepEqual(parseThread('10x1.5'), { diameter: 10 / 25.4, pitch: 1.5 / 25.4 });
  assert.deepEqual(parseThread('1.6x0.35'), { diameter: 1.6 / 25.4, pitch: 0.35 / 25.4 });
});

test('parseThread : valeur illisible → null', () => {
  for (const valeur of ['abc', '', '0.25-0', '0-20', '10x0', '10x', '10 x 1.5', '1/4-20', 0.25, null, undefined]) {
    assert.equal(parseThread(valeur), null, String(valeur));
  }
});

test('filetages : toutes les valeurs des données sont lisibles', async () => {
  for (const d of await dimensionsFiletage()) assert.notEqual(parseThread(d.valeur), null, `${d.outil} : ${d.libelle}`);
});

// Cohérence libellé ↔ valeur : seulement pour les filetages, et seulement ici
// (les libellés des autres outils sont trop variés : « #80 », « A », « 00 »…).
test('filetages métriques : le libellé « M10 x 1.5 » correspond à la valeur', async () => {
  const metriques = (await dimensionsFiletage()).filter((d) => d.libelle.startsWith('M'));
  assert.ok(metriques.length > 0);
  for (const d of metriques) {
    const lu = /^M([\d.]+) [xX] ([\d.]+)$/.exec(d.libelle);
    assert.ok(lu, `${d.outil} : libellé « ${d.libelle} » non reconnu`);
    const { diameter, pitch } = parseThread(d.valeur);
    presque(diameter, Number(lu[1]) / 25.4, `${d.outil} « ${d.libelle} » Ø`);
    presque(pitch, Number(lu[2]) / 25.4, `${d.outil} « ${d.libelle} » pas`);
  }
});

test('filetages impériaux fractionnaires : le libellé « 1/4 - 20 UNC » correspond à la valeur', async () => {
  const fractionnaires = (await dimensionsFiletage()).filter((d) => /^\d/.test(d.libelle));
  assert.ok(fractionnaires.length > 0);
  for (const d of fractionnaires) {
    const lu = /^(\d+)(?:\/(\d+))? ?- ?(\d+) UNC$/.exec(d.libelle); // « 1/4- 20 UNC », « 1 - 8 UNC »
    assert.ok(lu, `${d.outil} : libellé « ${d.libelle} » non reconnu`);
    const { diameter, pitch } = parseThread(d.valeur);
    presque(diameter, Number(lu[1]) / Number(lu[2] ?? 1), `${d.outil} « ${d.libelle} » Ø`);
    presque(pitch, 1 / Number(lu[3]), `${d.outil} « ${d.libelle} » pas`);
  }
});

// ❓ Échec connu : « #6-32 UNC » a le Ø 0.136 dans outils.json alors que le Ø
// nominal d'un #6 est 0,138 po (0,060 + 0,013 × 6). Donnée à confirmer par
// Thierry ; retirer `todo` une fois la donnée corrigée (ou la règle infirmée).
test('filetages impériaux à numéro : le libellé « #6-32 UNC » correspond à la valeur', { todo: 'Ø du #6 à confirmer : 0.136 ou 0.138 ?' }, async () => {
  const aNumero = (await dimensionsFiletage()).filter((d) => d.libelle.startsWith('#'));
  assert.ok(aNumero.length > 0);
  for (const d of aNumero) {
    const lu = /^#(\d+)-(\d+) UNC$/.exec(d.libelle);
    assert.ok(lu, `${d.outil} : libellé « ${d.libelle} » non reconnu`);
    const { diameter, pitch } = parseThread(d.valeur);
    presque(diameter, 0.06 + 0.013 * Number(lu[1]), `${d.outil} « ${d.libelle} » Ø`);
    presque(pitch, 1 / Number(lu[2]), `${d.outil} « ${d.libelle} » pas`);
  }
});

test('filetages : chaque libellé est couvert par un des trois tests de cohérence', async () => {
  for (const d of await dimensionsFiletage()) assert.match(d.libelle, /^(M|#|\d)/, `${d.outil} : ${d.libelle}`);
});
