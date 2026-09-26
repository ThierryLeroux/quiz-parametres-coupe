// Tests de la migration 0007 et de sa semence (jalon 7b, décision D56) : les photos d'outils et les
// pictogrammes d'opérations du dépôt, en base, identiques aux fichiers ; chaque outil de la banque et
// chaque opération des tables ont leur image. (Les images de classe ISO de 0009 : semence-copeaux.test.js.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fausseD1 } from './aide-d1.js';
import { composerSemenceImages } from '../reference/semence-d1/generer-images.mjs';
import { sanitizeSvg } from '../worker/svg.js';
import { operationSlug } from '../site/js/ui/sheets-data.js';
import { data } from './aide.js';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('la semence de la migration 0007 est identique aux fichiers du dépôt : 29 photos PNG et 19 pictogrammes SVG assainis, avec leur empreinte', () => {
  const db = fausseD1();
  const attendues = composerSemenceImages();
  const enBase = db.sqlite.prepare("SELECT * FROM images WHERE usage IN ('outil', 'operation') ORDER BY usage, id").all().map((row) => ({ ...row }));
  assert.equal(enBase.length, 48);
  assert.deepEqual(enBase.map((row) => row.id).sort(), attendues.map((i) => i.id).sort());
  for (const row of enBase) {
    const attendue = attendues.find((i) => i.id === row.id);
    assert.deepEqual([row.nom, row.usage, row.type, row.taille, row.archivee_le, row.creee_le], [attendue.nom, attendue.usage, attendue.type, attendue.taille, null, '2026-09-24T12:00:00.000Z'], row.id);
    assert.equal(Buffer.compare(Buffer.from(row.contenu), attendue.contenu), 0, `${row.id} : contenu différent`);
    assert.equal(row.empreinte, sha256(row.contenu), `${row.id} : empreinte`);
  }
  // Les photos sont les PNG tels quels ; les pictogrammes, les SVG du dépôt passés par l'assainisseur (sans leur commentaire).
  for (const name of readdirSync(new URL('../site/img/outils/', import.meta.url)).filter((f) => f.endsWith('.png'))) {
    assert.equal(Buffer.compare(Buffer.from(enBase.find((row) => row.id === name.slice(0, -4)).contenu), readFileSync(new URL(`../site/img/outils/${name}`, import.meta.url))), 0, name);
  }
  for (const name of readdirSync(new URL('../site/img/pictos/operations/', import.meta.url)).filter((f) => f.endsWith('.svg'))) {
    const { svg } = sanitizeSvg(readFileSync(new URL(`../site/img/pictos/operations/${name}`, import.meta.url), 'utf8'));
    assert.equal(Buffer.from(enBase.find((row) => row.id === name.slice(0, -4)).contenu).toString('utf8'), svg, name);
  }
  // Chaque outil de la banque a sa photo (image = son identifiant), chaque opération son pictogramme (le slug de son nom), nommés lisiblement.
  const ids = new Set(enBase.map((row) => row.id));
  for (const tool of data.outils) {
    assert.ok(ids.has(tool.image ?? tool.id), `${tool.id} : photo absente`);
    assert.equal(enBase.find((row) => row.id === (tool.image ?? tool.id)).nom, tool.nom);
  }
  for (const operation of data.operations) {
    const row = enBase.find((r) => r.id === operationSlug(operation.operation));
    assert.ok(row, `${operation.operation} : pictogramme absent`);
    assert.deepEqual([row.nom, row.usage], [operation.operation, 'operation']);
  }
  // Quatre photos partagées par deux outils du classeur ont la même empreinte sous deux identifiants : la semence
  // les garde toutes (chaque outil nomme la sienne) ; la règle « pas deux fois » vaut pour les téléversements.
  const partagees = enBase.filter((row) => row.usage === 'outil').filter((row, _, all) => all.some((other) => other.id !== row.id && other.empreinte === row.empreinte));
  assert.deepEqual(partagees.map((row) => row.id).sort(), ['barre_a_fileter', 'barre_a_fileter_2', 'foret_fractionnaire', 'foret_fractionnaire_2', 'foret_metrique', 'foret_metrique_2', 'sdtmr', 'sdtmr_2', 'taraud_imperial', 'taraud_imperial_2']);
});
