// Les migrations de migrations/ s'appliquent sur une base SQLite vide et donnent le schéma attendu
// (SPEC §7, décision D22). D1 est un SQLite : ce qui passe ici passe là-bas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fausseD1, migrationsSql } from './aide-d1.js';

const colonnes = (db, table) => db.sqlite.prepare(`SELECT name FROM pragma_table_info('${table}')`).all().map((row) => row.name);

const SEANCE = ['m10-tournage-vc', '2412345', 'Camille', 'Tremblay', '2026-09-21T13:05:00.000Z', '2026-09-21T13:05:00.000Z', 'r0', '{}'];
const INSERER = 'INSERT INTO seances (exercice_id, matricule, prenom, nom, debut, derniere_activite, version_exercice, compteurs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

test('les fichiers de migration sont numérotés : 0001_….sql, 0002_….sql…', () => {
  const fichiers = readdirSync(new URL('../migrations/', import.meta.url)).sort();
  assert.ok(fichiers.length >= 1);
  fichiers.forEach((nom, i) => assert.match(nom, new RegExp(`^${String(i + 1).padStart(4, '0')}_[a-z0-9_]+\\.sql$`), nom));
});

test('table seances : les colonnes attendues', () => {
  assert.deepEqual(colonnes(fausseD1(), 'seances'), [
    'id', 'exercice_id', 'matricule', 'prenom', 'nom', 'nip_hache', 'jeton_hache', 'jeton_expire_le', 'debut',
    'derniere_activite', 'derniere_correction', 'version_exercice', 'version_exercice_reussite', 'compteurs',
    'question_courante', 'reussite_le', 'essais_nip', 'essais_nip_debut', 'verrou_nip_jusqua', 'version_id',
  ]);
});

test('table corrections : les colonnes attendues', () => {
  assert.deepEqual(colonnes(fausseD1(), 'corrections'), ['id', 'seance_id', 'outil_id', 'question', 'reponses', 'resultat', 'reussie', 'horodatage']);
});

test('tables du jalon 5 : attestations, journal_enseignant, debit, verrous', () => {
  const db = fausseD1();
  assert.deepEqual(colonnes(db, 'attestations'), ['id', 'seance_id', 'code', 'enregistrement', 'signature', 'creee_le', 'annulee_le', 'annulation_motif']);
  assert.deepEqual(colonnes(db, 'corrections_identite').slice(-2), ['ancien_code', 'nouveau_code']);
  assert.deepEqual(colonnes(db, 'journal_enseignant'), ['id', 'horodatage', 'enseignant', 'seance_id', 'action', 'details']);
  assert.deepEqual(colonnes(db, 'debit'), ['portee', 'adresse', 'tranche', 'valeur']);
  assert.deepEqual(colonnes(db, 'verrous'), ['portee', 'adresse', 'echecs', 'jusqua']);
});

test('attestations : un code unique ; supprimer la séance garde ses attestations et le journal d’enseignant, séance mise à NULL (migration 0004, D45)', async () => {
  const db = fausseD1();
  const { meta } = await db.prepare(INSERER).bind(...SEANCE).run();
  const attestation = 'INSERT INTO attestations (seance_id, code, enregistrement, signature, creee_le) VALUES (?, ?, ?, ?, ?)';
  await db.prepare(attestation).bind(meta.last_row_id, 'ABCDEFGHJK', '{}', 'sig', '2026-09-21T13:06:00.000Z').run();
  await assert.rejects(db.prepare(attestation).bind(meta.last_row_id, 'ABCDEFGHJK', '{}', 'sig', '2026-09-21T13:07:00.000Z').run(), /UNIQUE/);
  await assert.rejects(db.prepare(attestation).bind(999, 'ZZZZZYYYYY', '{}', 'sig', '2026-09-21T13:07:00.000Z').run(), /FOREIGN KEY/);
  await db.prepare('INSERT INTO journal_enseignant (horodatage, enseignant, seance_id, action) VALUES (?, ?, ?, ?)').bind('2026-09-21T13:08:00.000Z', 'admin', meta.last_row_id, 'remise_a_zero').run();

  await db.prepare('DELETE FROM seances WHERE id = ?').bind(meta.last_row_id).run();
  assert.deepEqual(await db.prepare('SELECT id, seance_id, code FROM attestations').first(), { id: 1, seance_id: null, code: 'ABCDEFGHJK' });
  assert.deepEqual(await db.prepare('SELECT enseignant, seance_id, action FROM journal_enseignant').first(), { enseignant: 'admin', seance_id: null, action: 'remise_a_zero' });
  // La table recréée reprend la numérotation là où elle était.
  const { meta: suivante } = await db.prepare(attestation).bind(null, 'ZZZZZYYYYY', '{}', 'sig', '2026-09-21T13:09:00.000Z').run();
  assert.equal(suivante.last_row_id, 2);
});

test('migration 0004 : les attestations existantes sont copiées telles quelles, avec leurs identifiants, et l’index est refait', () => {
  // Les migrations jusqu'à 0003, une attestation, puis la 0004 seule.
  const sql = migrationsSql().split('-- Jalon 6 (décision D45)');
  assert.equal(sql.length, 2);
  const db = new DatabaseSync(':memory:');
  db.exec(sql[0]);
  db.prepare(INSERER).run(...SEANCE);
  db.prepare('INSERT INTO attestations (id, seance_id, code, enregistrement, signature, creee_le, annulee_le, annulation_motif) VALUES (7, 1, ?, ?, ?, ?, ?, ?)')
    .run('ABCDEFGHJK', '{"a":1}', 'sig', '2026-09-21T13:06:00.000Z', '2026-09-21T13:07:00.000Z', 'remise_a_zero');
  db.exec(`-- Jalon 6 (décision D45)${sql[1]}`);
  assert.deepEqual(db.prepare('SELECT * FROM attestations').all().map((row) => ({ ...row })), [{
    id: 7, seance_id: 1, code: 'ABCDEFGHJK', enregistrement: '{"a":1}', signature: 'sig', creee_le: '2026-09-21T13:06:00.000Z', annulee_le: '2026-09-21T13:07:00.000Z', annulation_motif: 'remise_a_zero',
  }]);
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'attestations' AND name NOT LIKE 'sqlite_%'").all().map((row) => row.name), ['attestations_par_seance']);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name = 'attestations_nouvelle'").get(), undefined);
  db.prepare('DELETE FROM seances').run();
  assert.equal(db.prepare('SELECT seance_id FROM attestations').get().seance_id, null);
});

test('une seule séance par couple (exercice, matricule)', async () => {
  const db = fausseD1();
  await db.prepare(INSERER).bind(...SEANCE).run();
  await assert.rejects(db.prepare(INSERER).bind(...SEANCE).run(), /UNIQUE/);
  await db.prepare(INSERER).bind('autre-exercice', ...SEANCE.slice(1)).run(); // même matricule, autre exercice : permis
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM seances').first()).n, 2);
});

test('purger une séance efface aussi son journal ; une correction sans séance est refusée', async () => {
  const db = fausseD1();
  const { meta } = await db.prepare(INSERER).bind(...SEANCE).run();
  const correction = 'INSERT INTO corrections (seance_id, outil_id, question, reponses, resultat, reussie, horodatage) VALUES (?, ?, ?, ?, ?, ?, ?)';
  await db.prepare(correction).bind(meta.last_row_id, 'mvlnr', '{}', '{}', '{}', 1, '2026-09-21T13:06:00.000Z').run();
  await assert.rejects(db.prepare(correction).bind(999, 'mvlnr', '{}', '{}', '{}', 1, '2026-09-21T13:06:00.000Z').run(), /FOREIGN KEY/);

  await db.prepare('DELETE FROM seances WHERE id = ?').bind(meta.last_row_id).run();
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM corrections').first()).n, 0);
});

test('fausse D1 : un lot (batch) est une transaction, et undefined est refusé comme sur D1', async () => {
  const db = fausseD1();
  await assert.rejects(db.batch([db.prepare(INSERER).bind(...SEANCE), db.prepare(INSERER).bind(...SEANCE)]), /UNIQUE/);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM seances').first()).n, 0); // la première insertion est annulée aussi
  await assert.rejects(db.prepare('SELECT ? AS v').bind(undefined).first(), /D1_TYPE_ERROR/);
});
