// Génère le SQL de la migration 0007 (jalon 7b, décision D56) : la table `images` et sa semence —
// les photos d'outils de site/img/outils/ (une par outil, nommée par son identifiant) et les
// pictogrammes d'opérations de site/img/pictos/operations/ (nommés par le slug de l'opération),
// assainis comme un téléversement (worker/svg.js). Depuis, le serveur et le navigateur lisent les
// images dans D1 (/images/<id>) ; les fichiers du dépôt ne sont plus que la semence et les données
// des tests, comme les JSON de site/data/.
//
// Lancé UNE fois, depuis la racine du dépôt :   node reference/semence-d1/generer-images.mjs
// Il écrit migrations/0007_images.sql. Un fichier de migration appliqué n'est jamais modifié : ce
// script ne sert plus qu'à relire comment la semence a été composée, et au test qui vérifie qu'elle
// est identique aux fichiers (tests/semence-images.test.js).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { operationSlug } from '../../site/js/ui/sheets-data.js';
import { sanitizeSvg } from '../../worker/svg.js';

const ROOT = new URL('../../', import.meta.url);
const lire = (chemin) => JSON.parse(readFileSync(new URL(chemin, ROOT), 'utf8'));

export const DATE_SEMENCE = '2026-09-24T12:00:00.000Z';

const sql = (text) => `'${String(text).replaceAll("'", "''")}'`;
const hex = (bytes) => `X'${Buffer.from(bytes).toString('hex').toUpperCase()}'`;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Toutes les images de la semence, telles que les tests les comparent aux fichiers :
// [{ id, nom, usage, type, taille, empreinte, contenu (Buffer) }], photos d'abord, dans l'ordre des noms de fichiers.
export function composerSemenceImages() {
  const { outils } = lire('site/data/outils.json');
  const { operations } = lire('site/data/operations.json');
  const images = [];

  const photos = new URL('site/img/outils/', ROOT);
  for (const name of readdirSync(photos).filter((f) => f.endsWith('.png')).sort()) {
    const id = name.slice(0, -4);
    const contenu = readFileSync(new URL(name, photos));
    images.push({ id, nom: outils.find((o) => o.id === id)?.nom ?? id, usage: 'outil', type: 'image/png', taille: contenu.length, empreinte: sha256(contenu), contenu });
  }
  const pictos = new URL('site/img/pictos/operations/', ROOT);
  for (const name of readdirSync(pictos).filter((f) => f.endsWith('.svg')).sort()) {
    const id = name.slice(0, -4);
    const { svg } = sanitizeSvg(readFileSync(new URL(name, pictos), 'utf8'));
    const contenu = Buffer.from(svg, 'utf8');
    images.push({ id, nom: operations.find((op) => operationSlug(op.operation) === id)?.operation ?? id, usage: 'operation', type: 'image/svg+xml', taille: contenu.length, empreinte: sha256(contenu), contenu });
  }
  return images;
}

export function genererSql() {
  const images = composerSemenceImages();
  const lignes = [`-- Jalon 7b (décision D56) : les images — photos d'outils et pictogrammes d'opérations — vivent dans
-- D1, en blob, servies par /images/<id>. Ce fichier a été GÉNÉRÉ par reference/semence-d1/generer-images.mjs
-- à partir des fichiers de site/img/outils/ et de site/img/pictos/operations/ tels qu'ils étaient ce
-- jour-là (les SVG assainis par worker/svg.js, comme un téléversement) ; les INSERT sont la semence.
-- Un fichier de migration appliqué n'est JAMAIS modifié.

CREATE TABLE images (
  id          TEXT PRIMARY KEY,   -- « mvlnr », « percage » pour la semence ; « img-<empreinte> » pour un téléversement
  nom         TEXT NOT NULL,      -- le nom lisible, celui de la galerie (« MVLNR », « Perçage », le nom du fichier téléversé)
  usage       TEXT NOT NULL,      -- « outil » (photo d'un outil) ou « operation » (pictogramme)
  type        TEXT NOT NULL,      -- image/png, image/jpeg, image/webp, image/svg+xml — celui des octets
  taille      INTEGER NOT NULL,   -- en octets
  empreinte   TEXT NOT NULL,      -- SHA-256 du contenu, en hexadécimal ; un téléversement identique n'est pas stocké deux fois
  contenu     BLOB NOT NULL,
  creee_le    TEXT NOT NULL,
  archivee_le TEXT                -- NULL = offerte au choix ; archivée = plus proposée, toujours servie
);
CREATE INDEX images_par_usage ON images (usage, nom);

-- Semence : ${images.filter((i) => i.usage === 'outil').length} photos d'outils (PNG du classeur) et ${images.filter((i) => i.usage === 'operation').length} pictogrammes d'opérations (SVG convertis du classeur, D29).`];
  for (const i of images) {
    lignes.push(`INSERT INTO images (id, nom, usage, type, taille, empreinte, contenu, creee_le) VALUES (${sql(i.id)}, ${sql(i.nom)}, ${sql(i.usage)}, ${sql(i.type)}, ${i.taille}, ${sql(i.empreinte)}, ${hex(i.contenu)}, ${sql(DATE_SEMENCE)});`);
  }
  return `${lignes.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  const cible = new URL('migrations/0007_images.sql', ROOT);
  writeFileSync(cible, genererSql());
  console.log(`écrit : ${cible.pathname}`);
}
