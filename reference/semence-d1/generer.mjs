// Génère le SQL de la semence de la migration 0005 (jalon 7a, décision D47) à partir des JSON du
// dépôt : les tables de référence (materiaux.json, operations.json) comme version « A2026_r0 », les
// outils d'outils.json comme banque, et les exercices M10 comme version 1 publiée, avec leurs copies
// d'outils (draftFromExercise, site/js/exercice.js).
//
// Lancé UNE fois, depuis la racine du dépôt :   node reference/semence-d1/generer.mjs
// Il écrit migrations/0005_editeur_exercices_banque.sql. Un fichier de migration appliqué n'est
// jamais modifié : ce script ne sert plus qu'à relire comment la semence a été composée, et au test
// qui vérifie qu'elle est identique aux JSON (tests/migration-0005.test.js).
import { readFileSync, writeFileSync } from 'node:fs';
import { draftFromExercise } from '../../site/js/exercice.js';

const ROOT = new URL('../../', import.meta.url);
const lire = (chemin) => JSON.parse(readFileSync(new URL(chemin, ROOT), 'utf8'));

export const DATE_SEMENCE = '2026-09-24T12:00:00.000Z';
export const TABLES_ID = 'A2026_r0';
export const EXERCICES_SEMES = ['m10-tournage-vc', 'm10-tournage-vc-rpm'];

const sql = (text) => `'${String(text).replaceAll("'", "''")}'`;
const json = (value) => sql(JSON.stringify(value));

// Tout ce que la semence contient, tel que les tests le comparent aux JSON.
export function composerSemence() {
  const materiaux = lire('site/data/materiaux.json');
  const operations = lire('site/data/operations.json');
  const { outils } = lire('site/data/outils.json');
  const exercices = EXERCICES_SEMES.map((id) => ({ id, brouillon: draftFromExercise(lire(`site/exercices/${id}.json`), outils) }));
  return { tables: { id: TABLES_ID, materiaux, operations }, outils, exercices };
}

export function genererSql() {
  const { tables, outils, exercices } = composerSemence();
  const lignes = [`-- Jalon 7a (décisions D47 à D49) : l'éditeur en production. Les exercices et la banque d'outils
-- quittent les fichiers JSON pour la base D1 ; les tables de référence (vitesses de coupe, avances)
-- y sont versionnées, une seule version pour l'instant. Ce fichier a été GÉNÉRÉ par
-- reference/semence-d1/generer.mjs à partir des JSON du dépôt tels qu'ils étaient ce jour-là ; les
-- INSERT sont la semence. Un fichier de migration appliqué n'est JAMAIS modifié.

-- Une version des tables de référence : immuable. Le 7b en créera d'autres (D28 : la révision est
-- dans le JSON de chaque table).
CREATE TABLE tables_reference (
  id         TEXT PRIMARY KEY,   -- « A2026_r0 » : la révision des tables
  materiaux  TEXT NOT NULL,      -- JSON : le contenu de materiaux.json (revision, groupes_iso, materiaux)
  operations TEXT NOT NULL,      -- JSON : le contenu d'operations.json (revision, operations)
  creee_le   TEXT NOT NULL
);

-- La banque d'outils : une ligne par outil, modifiable. Un exercice n'y fait pas référence : il en
-- prend une COPIE (D47), et modifier la banque ne change aucun exercice.
CREATE TABLE banque_outils (
  id         TEXT PRIMARY KEY,   -- identifiant de l'outil (« mvlnr »), aussi le nom de sa photo
  outil      TEXT NOT NULL,      -- JSON : l'outil au format d'outils.json (SPEC §3)
  rang       INTEGER NOT NULL,   -- ordre d'affichage dans la banque
  revision   INTEGER NOT NULL DEFAULT 1, -- numéro de modification : un enregistrement doit le présenter (D48)
  modifie_le TEXT NOT NULL,
  archive_le TEXT               -- NULL = disponible ; archivé = plus proposé, jamais supprimé
);

-- Les exercices : l'identifiant d'URL (?exercice=<id>, immuable : les liens sur Léa continuent de
-- fonctionner) et le BROUILLON, seul état modifiable. Les étudiants ne voient que les versions publiées.
CREATE TABLE exercices (
  id                   TEXT PRIMARY KEY,
  brouillon            TEXT NOT NULL,     -- JSON : { titre, champs_evalues, materiaux_outil?, groupes?, liste?, outils: [copies] }
  revision             INTEGER NOT NULL DEFAULT 1, -- contrôle de version optimiste (D48)
  brouillon_modifie_le TEXT NOT NULL,
  publie_le            TEXT,              -- date de la dernière publication ; NULL = jamais publié
  archive_le           TEXT,              -- NULL = offert ; archivé = plus de nouvelle séance, plus dans la liste
  cree_le              TEXT NOT NULL
);

-- Les versions publiées d'un exercice : immuables, numérotées 1, 2, 3… Une séance est épinglée à sa
-- version (seances.version_id) jusqu'à la fin ; seules les nouvelles séances prennent la dernière.
CREATE TABLE versions_exercice (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  exercice_id TEXT NOT NULL REFERENCES exercices (id),
  numero      INTEGER NOT NULL,
  contenu     TEXT NOT NULL,     -- JSON : la même forme que le brouillon, figée
  tables_id   TEXT NOT NULL REFERENCES tables_reference (id), -- la version des tables de référence qu'elle utilise
  publiee_le  TEXT NOT NULL,
  UNIQUE (exercice_id, numero)
);

-- Semence : les tables de référence du dépôt, comme version « ${TABLES_ID} ».
INSERT INTO tables_reference (id, materiaux, operations, creee_le) VALUES (${sql(tables.id)}, ${json(tables.materiaux)}, ${json(tables.operations)}, ${sql(DATE_SEMENCE)});
`];
  lignes.push('\n-- Semence : les outils d\'outils.json, dans leur ordre, comme banque.');
  outils.forEach((outil, i) => {
    lignes.push(`INSERT INTO banque_outils (id, outil, rang, modifie_le) VALUES (${sql(outil.id)}, ${json({ ...outil, image: outil.image ?? outil.id })}, ${i + 1}, ${sql(DATE_SEMENCE)});`);
  });
  lignes.push('\n-- Semence : les deux exercices M10, brouillon et version 1 publiée identiques, avec leurs copies d\'outils.');
  for (const { id, brouillon } of exercices) {
    lignes.push(`INSERT INTO exercices (id, brouillon, brouillon_modifie_le, publie_le, cree_le) VALUES (${sql(id)}, ${json(brouillon)}, ${sql(DATE_SEMENCE)}, ${sql(DATE_SEMENCE)}, ${sql(DATE_SEMENCE)});`);
    lignes.push(`INSERT INTO versions_exercice (exercice_id, numero, contenu, tables_id, publiee_le) VALUES (${sql(id)}, 1, ${json(brouillon)}, ${sql(tables.id)}, ${sql(DATE_SEMENCE)});`);
  }
  lignes.push(`
-- Les séances existantes pointent vers la version 1 de leur exercice ; une séance d'un exercice non
-- semé (il n'y en a pas en production) garde NULL, que le serveur traite comme « la dernière version publiée ».
ALTER TABLE seances ADD COLUMN version_id INTEGER REFERENCES versions_exercice (id);
UPDATE seances SET version_id = (SELECT v.id FROM versions_exercice v WHERE v.exercice_id = seances.exercice_id AND v.numero = 1);
CREATE INDEX seances_par_version ON seances (version_id);
`);
  return lignes.join('\n');
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  const cible = new URL('migrations/0005_editeur_exercices_banque.sql', ROOT);
  writeFileSync(cible, genererSql());
  console.log(`écrit : ${cible.pathname}`);
}
