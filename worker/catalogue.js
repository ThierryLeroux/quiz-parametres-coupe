// Les exercices et le catalogue, lus par le serveur dans la base D1 (décision D47, jalon 7).
// Jusqu'au jalon 6, ils venaient des JSON de site/ (liaison ASSETS). Depuis, un exercice publié est
// une VERSION immuable en base (versions_exercice) : son contenu (titre, grandeurs, copies d'outils)
// et la version des tables de référence qu'elle utilise (tables_reference). Une séance est épinglée
// à sa version (seances.version_id) ; seules les nouvelles séances prennent la dernière publiée.
//
// Chaque chargement rend { data, exercise, version } : le catalogue au format de loadData
// (assembleData : les tables de la version, et les copies d'outils de l'exercice), l'exercice au
// format du moteur (engineExercise), et la ligne de la version. Une version publiée ne change
// jamais : elle est gardée en mémoire une fois assemblée. Le brouillon, lui, est toujours relu.
// Une version de tables d'avant le 7b (« A2026_r0 ») est complétée à la lecture (completeTables, D61) :
// classes ISO et matières d'outil avec leurs couleurs par défaut, celles de tokens.css.
//
// La présentation des tables en direct (D75, D76) ne passe PAS par ce cache : une version assemblée garde ses
// valeurs et sa présentation d'origine — c'est avec elle que le serveur tire, corrige et atteste. La présentation
// en vigueur (loadPresentation) se pose par-dessus ensuite, seulement dans ce que le serveur montre (index.js).

import { assembleData } from '../site/js/data.js';
import { engineExercise } from '../site/js/exercice.js';
import { currentPresentation } from '../site/js/presentation.js';
import { completeTables } from '../site/js/tables.js';
import * as base from './base.js';

// Versions déjà assemblées, par identifiant de version — immuables, donc sûres à garder. Une
// instance de Worker n'en verra jamais des milliers : au pire, on vide tout.
const assembled = new Map();
const MAX_KEPT = 200;

// Les deux tables d'une ligne de tables_reference (ou d'un brouillon de tables), complétées.
export const tablesOf = (row) => completeTables({ materiaux: row.materiaux, operations: row.operations });

// Assemble une version d'exercice avec ses tables : { data, exercise, version }.
async function assemble(db, version) {
  const tables = await base.findTables(db, version.tables_id);
  if (tables === null) throw new Error(`Tables de référence « ${version.tables_id} » introuvables (version ${version.id})`);
  const { exercise, tools } = engineExercise(version.exercice_id, version.numero, version.contenu);
  return { data: assembleData(tablesOf(tables), tools), exercise, version };
}

// La version publiée dont une séance dépend.
export async function loadVersion(db, versionId) {
  if (!assembled.has(versionId)) {
    const version = await base.findVersionById(db, versionId);
    if (version === null) throw new Error(`Version d'exercice ${versionId} introuvable`);
    if (assembled.size >= MAX_KEPT) assembled.clear();
    assembled.set(versionId, await assemble(db, version));
  }
  return assembled.get(versionId);
}

// La dernière version publiée d'un exercice, celle que prend une nouvelle séance ; null s'il n'a
// jamais été publié. `fiche` : la ligne de la table exercices (archive_le…).
export async function loadLatest(db, exerciseId) {
  const latest = await base.findLatestVersion(db, exerciseId);
  return latest === null ? null : loadVersion(db, latest.id);
}

// Le brouillon d'un exercice, assemblé avec des tables de référence — celles de sa version de tables
// (D62), ou celles données (l'aperçu d'un brouillon de tables, D63) — pour l'aperçu de la Gestion du contenu.
// Jamais gardé en mémoire : il change. Lève si le brouillon est invalide.
//   draft  : le brouillon à assembler (celui de la requête, ou celui de la base)
//   tables : { id?, materiaux, operations } — la version de tables (complétée ici)
export function assembleDraft(exerciseId, draft, tables) {
  const { exercise, tools } = engineExercise(exerciseId, 'brouillon', draft);
  return { data: assembleData(tablesOf(tables), tools), exercise, version: null, tables_id: tables.id ?? null };
}

// La dernière version publiée des tables, complétée : { id, materiaux, operations }. Gardée en mémoire par identifiant
// (une version ne change jamais) ; seul l'identifiant de la plus récente est relu à chaque fois.
const latestTables = new Map();
export async function loadLatestTables(db) {
  const id = await base.findLatestTablesId(db);
  if (!latestTables.has(id)) {
    if (latestTables.size >= 20) latestTables.clear();
    latestTables.set(id, { id, ...tablesOf(await base.findTables(db, id)) });
  }
  return latestTables.get(id);
}

// La présentation en vigueur (D76) : { contenu (celle du panneau : currentPresentation), stocke (celle enregistrée, ou
// null : rien d'appliqué), revision, modifiee_le, enseignant, latest (la dernière version des tables) }. Relue à chaque
// requête : elle change sans nouvelle version.
export async function loadPresentation(db) {
  const row = await base.findPresentation(db);
  const latest = await loadLatestTables(db);
  return { contenu: currentPresentation(row.contenu, latest), stocke: row.contenu, revision: row.revision, modifiee_le: row.modifiee_le, enseignant: row.enseignant, latest };
}

// Pour les tests et le Worker : oublier ce qui est en mémoire.
export function forgetAssembled() {
  assembled.clear();
  latestTables.clear();
}
