// Tests de la migration 0009 et de sa semence (décision D64) : les douze images de chaleur et de forme
// de copeaux, en base sous l'usage « classe », identiques aux PNG détourés du dépôt ; chaque classe ISO
// par défaut nomme les siennes, complétées à la lecture d'une version d'avant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fausseD1 } from './aide-d1.js';
import { DATE_SEMENCE, LIMITE_OCTETS, composerSemenceCopeaux, imagesParClasse } from '../reference/semence-d1/generer-copeaux.mjs';
import { DETOURES } from '../reference/semence-d1/detourer-copeaux.mjs';
import { DEFAULT_ISO_CLASSES, completeTables } from '../site/js/tables.js';
import { lireFichier } from './aide.js';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('la semence de la migration 0009 est identique aux six PNG détourés de site/img/copeaux/, sous l’usage « classe »', () => {
  const db = fausseD1();
  const attendues = composerSemenceCopeaux();
  assert.equal(attendues.length, 6);
  const enBase = db.sqlite.prepare("SELECT * FROM images WHERE usage = 'classe' ORDER BY id").all().map((row) => ({ ...row }));
  assert.deepEqual(enBase.map((row) => row.id), attendues.map((i) => i.id));
  for (const row of enBase) {
    const attendue = attendues.find((i) => i.id === row.id);
    assert.deepEqual([row.nom, row.usage, row.type, row.taille, row.archivee_le, row.creee_le], [attendue.nom, 'classe', 'image/png', attendue.taille, null, DATE_SEMENCE], row.id);
    assert.equal(Buffer.compare(Buffer.from(row.contenu), attendue.contenu), 0, `${row.id} : contenu différent`);
    assert.equal(row.contenu.length, row.taille);
    assert.equal(row.empreinte, sha256(row.contenu), `${row.id} : empreinte`);
  }
  for (const name of readdirSync(DETOURES).filter((f) => f.endsWith('.png'))) {
    assert.equal(Buffer.compare(Buffer.from(enBase.find((row) => row.id === name.slice(0, -4)).contenu), readFileSync(new URL(name, DETOURES))), 0, name);
  }
  // Chaque image tient dans une instruction D1 (100 Ko, hexadécimal compris).
  assert.ok(attendues.every((i) => i.taille <= LIMITE_OCTETS), attendues.map((i) => `${i.id} ${i.taille}`).join(', '));
  assert.deepEqual(attendues.map((i) => i.nom), ['Classe H — chaleur', 'Classe K — chaleur', 'Classe M — chaleur', 'Classe N — chaleur', 'Classe P — chaleur', 'Classe S — chaleur']);
  // Les photos et pictogrammes de 0007 sont toujours là : 48 + 6.
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM images').get().n, 54);
});

test('chaque classe ISO par défaut nomme son image de chaleur de la semence (la classe O n’en a pas), et une version d’avant la reçoit à la lecture', async () => {
  const parClasse = imagesParClasse();
  assert.deepEqual(Object.keys(parClasse).sort(), ['H', 'K', 'M', 'N', 'P', 'S']);
  for (const c of DEFAULT_ISO_CLASSES) {
    assert.equal(c.image_chaleur, c.code === 'O' ? null : parClasse[c.code].image_chaleur, c.code);
  }
  // A2026_r0 (les JSON du dépôt, sans classes_iso) : complétée, la classe P a ses images ; la ligne en base ne change pas (0009 ne touche pas tables_reference).
  const tables = completeTables({ materiaux: await lireFichier('data/materiaux.json'), operations: await lireFichier('data/operations.json') });
  assert.deepEqual([tables.materiaux.classes_iso[0].code, tables.materiaux.classes_iso[0].image_chaleur, 'image_copeaux' in tables.materiaux.classes_iso[0]], ['P', 'copeaux-p-chaleur', false]);
  const db = fausseD1();
  const r0 = JSON.parse(db.sqlite.prepare("SELECT materiaux FROM tables_reference WHERE id = 'A2026_r0'").get().materiaux);
  assert.equal('classes_iso' in r0, false);
  const brouillon = JSON.parse(db.sqlite.prepare('SELECT contenu FROM brouillon_tables WHERE id = 1').get().contenu);
  assert.equal('classes_iso' in brouillon.materiaux, false);
});
