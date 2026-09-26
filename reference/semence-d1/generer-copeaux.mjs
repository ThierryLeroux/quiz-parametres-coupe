// Génère le SQL de la migration 0009 (décision D64) : la semence des images de chaleur et de forme de
// copeaux par classe ISO — les douze PNG détourés de site/img/copeaux/ (detourer-copeaux.mjs), dans la
// table `images` (0007) sous l'usage « classe », identifiant = le nom du fichier sans « .png »
// (« copeaux-p-chaleur »). Les classes ISO des tables de référence ne sont pas réécrites : une
// version d'avant reçoit ces identifiants à la lecture (completeTables, site/js/tables.js), comme
// les couleurs (D61).
//
// Lancé UNE fois, depuis la racine du dépôt :   node reference/semence-d1/generer-copeaux.mjs
// Il écrit migrations/0009_images_copeaux.sql. Un fichier de migration appliqué n'est jamais
// modifié : ce script ne sert plus qu'à relire comment la semence a été composée, et au test qui
// vérifie qu'elle est identique aux fichiers (tests/semence-copeaux.test.js).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { DETOURES, decrireOriginal } from './detourer-copeaux.mjs';

const ROOT = new URL('../../', import.meta.url);

export const DATE_SEMENCE = '2026-09-26T12:00:00.000Z';

// Une instruction SQL ne dépasse pas 100 Ko sur D1 : un INSERT porte tout le contenu en hexadécimal
// (deux caractères par octet), donc une image semée ici ne peut pas dépasser LIMITE_OCTETS. Les plus
// grosses (chaleur, 44 Ko) font des instructions de 88 Ko. Recoller des morceaux par « contenu || X'…' »
// ne marche pas : SQLite concatène en texte.
export const LIMITE_OCTETS = 49_000;

const sql = (text) => `'${String(text).replaceAll("'", "''")}'`;
const hex = (bytes) => `X'${Buffer.from(bytes).toString('hex').toUpperCase()}'`;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const TYPES = { chaleur: 'chaleur', copeaux: 'forme de copeaux' };

// Les douze images de la semence, telles que le test les compare aux fichiers :
// [{ id, nom, usage, type, taille, empreinte, contenu (Buffer) }], dans l'ordre des noms de fichiers.
export function composerSemenceCopeaux() {
  const images = [];
  for (const name of readdirSync(DETOURES).filter((f) => f.endsWith('.png')).sort()) {
    const id = name.slice(0, -4);
    const match = /^copeaux-([a-z])-(chaleur|copeaux)$/.exec(id);
    if (!match) throw new Error(`Fichier inattendu dans site/img/copeaux/ : ${name}`);
    const contenu = readFileSync(new URL(name, DETOURES));
    images.push({ id, nom: `Classe ${match[1].toUpperCase()} — ${TYPES[match[2]]}`, usage: 'classe', type: 'image/png', taille: contenu.length, empreinte: sha256(contenu), contenu });
  }
  return images;
}

// Les identifiants des images de chaque classe, tels que les tables les nomment par défaut : { P: { image_chaleur, image_copeaux }, … }.
export function imagesParClasse() {
  const parClasse = {};
  for (const { id } of composerSemenceCopeaux()) {
    const [, lettre, type] = /^copeaux-([a-z])-(chaleur|copeaux)$/.exec(id);
    parClasse[lettre.toUpperCase()] ??= {};
    parClasse[lettre.toUpperCase()][`image_${type}`] = id;
  }
  return parClasse;
}

export function genererSql() {
  const images = composerSemenceCopeaux();
  const lignes = [`-- Décision D64 : les images de chaleur et de forme de copeaux par classe ISO, deux par classe
-- (P, M, K, N, S, H), semées dans la table images (0007) sous l'usage « classe » et servies par
-- /images/<id>. Ce fichier a été GÉNÉRÉ par reference/semence-d1/generer-copeaux.mjs à partir des PNG
-- détourés de site/img/copeaux/ (detourer-copeaux.mjs) tels qu'ils étaient ce jour-là. Les classes ISO
-- des tables de référence ne sont pas réécrites : une version d'avant reçoit ces identifiants à la
-- lecture (image_chaleur, image_copeaux ; completeTables), comme les couleurs (D61).
-- Une instruction D1 ne dépasse pas 100 Ko : la plus longue ici fait ${Math.max(...images.map((i) => i.taille)) * 2} caractères d'hexadécimal, plus l'entête.
-- Un fichier de migration appliqué n'est JAMAIS modifié.

-- Semence : ${images.length} images (PNG détourés, fond transparent).`];
  for (const i of images) {
    if (i.taille > LIMITE_OCTETS) throw new Error(`${i.id} : ${i.taille} octets, trop pour une instruction D1 (au plus ${LIMITE_OCTETS})`);
    lignes.push(`INSERT INTO images (id, nom, usage, type, taille, empreinte, contenu, creee_le) VALUES (${sql(i.id)}, ${sql(i.nom)}, ${sql(i.usage)}, ${sql(i.type)}, ${i.taille}, ${sql(i.empreinte)}, ${hex(i.contenu)}, ${sql(DATE_SEMENCE)});`);
  }
  return `${lignes.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  const cible = new URL('migrations/0009_images_copeaux.sql', ROOT);
  writeFileSync(cible, genererSql());
  console.log(`écrit : ${cible.pathname}`);
}
