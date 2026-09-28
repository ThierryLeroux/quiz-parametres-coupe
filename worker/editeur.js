// Règles de la Gestion du contenu (jalon 7, décisions D47 à D49 ; le nom du fichier date d'avant D74) : identifiants, aperçu d'un exercice, plan
// d'un import, textes du journal des actions. Fonctions PURES : ni base, ni réseau, ni horloge.
// Le SQL est dans base.js ; la validation d'un brouillon dans site/js/exercice.js (draftErrors),
// partagée avec la Gestion du contenu dans le navigateur.

import { computeParameters } from '../site/js/calcul.js';
import { TOOL_KEYS } from '../site/js/data.js';
import { DRAFT_KEYS, draftErrors, fieldsToGrade, maskedFields } from '../site/js/exercice.js';
import { formatParameters } from '../site/js/format.js';
import { eligibleTools } from '../site/js/progression.js';
import { normalizePresentation } from '../site/js/presentation.js';
import { exerciseValues, normalizeExercisePresentation } from '../site/js/presentation-exercice.js';
import { generateQuestion } from '../site/js/question.js';
import { USAGES } from './images.js';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';

// Identifiant d'exercice (SPEC §10) ou d'outil : minuscules, chiffres, tirets ou soulignés ; c'est
// une adresse (?exercice=<id>) ou un nom de fichier d'image, jamais un chemin.
export const EXERCISE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const TOOL_ID = /^[a-z0-9]+(_[a-z0-9]+)*$/;

export const isExerciseId = (id) => isText(id) && EXERCISE_ID.test(id) && id !== 'index';
export const isToolId = (id) => isText(id) && TOOL_ID.test(id);

// Un identifiant libre parmi ceux déjà pris : « mvlnr », puis « mvlnr_2 », « mvlnr_3 »…
export function freeId(wanted, taken, separator = '_') {
  if (!taken.includes(wanted)) return wanted;
  for (let n = 2; ; n += 1) {
    const candidate = `${wanted}${separator}${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
}

// Ne garde d'un brouillon reçu que ses clés connues (les commentaires « _… » compris), sans rien
// interpréter : la validation (draftErrors) dit ensuite ce qui cloche.
export function cleanDraft(received) {
  if (!isObject(received)) return {};
  return Object.fromEntries(Object.entries(received).filter(([key]) => DRAFT_KEYS.includes(key) || key.startsWith('_')));
}

// Un brouillon de tables reçu : ses deux tables, sans rien d'autre ; null s'il est mal formé.
export function cleanTables(received) {
  if (!isObject(received) || !isObject(received.materiaux) || !isObject(received.operations)) return null;
  return { materiaux: received.materiaux, operations: received.operations };
}

export function cleanTool(received) {
  if (!isObject(received)) return {};
  return Object.fromEntries(Object.entries(received).filter(([key]) => TOOL_KEYS.includes(key)));
}

// Le brouillon est-il publiable ? Vrai sans erreur de validation.
export const isPublishable = (draft, tables) => draftErrors(draft, tables).length === 0;

// Les deux contenus (brouillon, version) disent-ils la même chose ? Comparaison structurelle, sans
// l'ordre des clés ni les commentaires « _… ».
export function sameContent(a, b) {
  return canonicalText(a) === canonicalText(b);
}

function canonicalText(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalText).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).filter((key) => !key.startsWith('_')).sort().map((key) => `${JSON.stringify(key)}:${canonicalText(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

// --- Aperçu (D49) : dix questions avec leurs réponses attendues, rien n'est enregistré ---------------------------
// Tire `count` questions parmi TOUS les outils de l'exercice (compteurs à zéro), comme le ferait le
// serveur, et joint la nomenclature composée, le matériau tiré et les valeurs attendues des grandeurs
// évaluées. Pour l'enseignant seulement, derrière la clé d'administration : rien ne va au navigateur d'un étudiant.
//   exercise, data : l'exercice au format du moteur et son catalogue (catalogue.js)
export function previewQuestions(exercise, data, random, count = 10) {
  const tools = eligibleTools(exercise, data, { exerciceId: exercise.id, reussites: {}, totalReussies: 0 });
  const graded = fieldsToGrade(exercise);
  const masked = maskedFields(exercise);
  const provided = ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate'].filter((field) => !graded.includes(field) && !masked.includes(field));
  return Array.from({ length: count }, () => {
    const question = generateQuestion(data, tools, random);
    const displayed = formatParameters(computeParameters(question, data));
    return {
      identifiant: question.displayId,
      outil_id: question.tool.id,
      outil: question.tool.name,
      operation: question.tool.operation,
      dimension: question.dimension.label,
      barre: question.bar?.label ?? null,
      dents: question.teeth,
      materiau_outil: question.toolMaterial.label,
      materiau: { classe: question.material.iso, groupe: question.material.groupe, materiau: question.material.materiau, etat: question.material.etat },
      reponses: Object.fromEntries(graded.map((field) => [field, displayed[field]])),
      fournies: Object.fromEntries(provided.map((field) => [field, displayed[field]])), // les grandeurs fournies (D52) ; les masquées n'y sont pas
    };
  });
}

// --- La cascade d'une publication de tables (D75, point 6 ; D77 et sa retouche) -------------------------------------
// Publier des tables propose, dans la même confirmation, UNE liste de tout ce qui n'est pas à jour : chaque exercice,
// archivés et jamais publiés compris — aucun n'est encore sur la version qu'on publie. Ceux qui sont sur la version
// remplacée (la version dont le brouillon des tables est parti) sont cochés par défaut ; ceux qui sont sur une version
// plus ancienne sont DÉCOCHÉS par défaut (ils ont pu être laissés de côté exprès) : ils restent dans la vue, cascade après
// cascade. « Sur » une version se lit à la dernière version publiée ; pour un exercice jamais publié, à son brouillon.
// Pour chaque exercice, ce que la cascade fera s'il est coché — chacun de son côté :
//   - publication : s'il a été publié, sa version suivante sera son DERNIER CONTENU PUBLIÉ avec les nouvelles tables,
//     jamais son brouillon ; sans titre vérifié (D74 : la cascade n'en change aucun) ;
//   - brouillon : son brouillon passe aux nouvelles tables, ses modifications gardées (d'où qu'il parte) ;
//   - en_erreur : le contenu à republier a des erreurs avec les nouvelles tables → nommé, et laissé tel quel (brouillon compris).
// Retourne [{ id, titre, archive_le, jamais_publie, sur (la version où il est), par_defaut, publication: { depuis, numero, tables } | null,
// brouillon: { depuis, modifie, erreurs }, en_erreur, erreurs, lignes }] dans l'ordre des rangs — lignes : ce que ça
// change pour lui DEPUIS SA PROPRE VERSION (exerciseTablesImpact de son contenu publié et des tables de celui-ci, ou de
// son brouillon et de ses tables s'il n'a jamais été publié) ; brouillon.erreurs : celles qui apparaîtraient dans son brouillon.
//   rows : base.listExercises (id, brouillon, tables_id, archive_le, contenu_publie, derniere_version, tables_publiees), et
//   titre_en_vigueur : le titre de la présentation en vigueur d'un exercice publié (D78), sinon absent
//   replacedId : la version remplacée ; tablesById : Map id → tables complétées (toutes les versions) ; latestId : la plus
//   récente (celle d'un brouillon sans version de tables) ; next : les nouvelles tables (complétées)
//   draftErrorsOf : draftErrors (exercice.js) ; impactOf : exerciseTablesImpact (editeur-data.js) — injectées
export function cascadeCandidates(rows, { replacedId, tablesById, latestId, next }, { draftErrorsOf, impactOf }) {
  const tablesOfId = (id) => tablesById.get(id ?? latestId) ?? null;
  return rows.map((row) => {
    const published = row.contenu_publie;
    const publishedTables = published === null ? null : tablesOfId(row.tables_publiees);
    const draftTables = tablesOfId(row.tables_id);
    const erreurs = published === null ? [] : draftErrorsOf(published, next).map((e) => `${e.champ} : ${e.message}`);
    const draftImpact = draftTables === null ? { erreurs: [], lignes: [] } : impactOf(row.brouillon, draftTables, next, draftErrorsOf);
    const impact = published === null ? draftImpact : (publishedTables === null ? { erreurs: [], lignes: [] } : impactOf(published, publishedTables, next, draftErrorsOf));
    const sur = published === null ? (row.tables_id ?? latestId) : row.tables_publiees;
    return {
      id: row.id,
      titre: row.titre_en_vigueur ?? (published ?? row.brouillon).titre,
      archive_le: row.archive_le,
      jamais_publie: published === null,
      sur,
      par_defaut: erreurs.length === 0 && sur === replacedId,
      publication: published === null ? null : { depuis: row.derniere_version, numero: row.derniere_version + 1, tables: row.tables_publiees },
      // Modifié : ses valeurs seules (D78 : la présentation du brouillon d'un exercice publié dort).
      brouillon: { depuis: row.tables_id ?? null, modifie: published === null || !sameContent(exerciseValues(row.brouillon), exerciseValues(published)), erreurs: draftImpact.erreurs },
      en_erreur: erreurs.length > 0,
      erreurs,
      lignes: impact.lignes,
    };
  });
}

// Ce que la cascade fait des exercices cochés (D77) : { versions: [{ exercice_id, numero, contenu }], brouillons: [{ id,
// depuis }], laisses, ignores }. Pour chaque coché, son contenu publié passe aux nouvelles tables (une version suivante),
// et son brouillon aussi, chacun de son côté ; un exercice en erreur est laissé tel quel, coché ou non (laisses les nomme
// tous, avec leurs erreurs) ; un identifiant inconnu est ignoré ; un exercice décoché n'est pas touché, brouillon compris.
//   candidates : cascadeCandidates ; rows : les mêmes lignes (le contenu publié) ; checked : les identifiants cochés
export function cascadePlan(candidates, rows, checked) {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const plan = { versions: [], brouillons: [], laisses: candidates.filter((c) => c.en_erreur).map(({ id, titre, erreurs }) => ({ id, titre, erreurs })), ignores: [] };
  for (const id of [...new Set(Array.isArray(checked) ? checked : [])]) {
    const c = byId.get(id);
    if (c === undefined) { plan.ignores.push(id); continue; }
    if (c.en_erreur) continue;
    if (c.publication !== null) plan.versions.push({ exercice_id: id, numero: c.publication.numero, contenu: rows.find((row) => row.id === id).contenu_publie });
    plan.brouillons.push({ id, depuis: c.brouillon.depuis });
  }
  return plan;
}

// --- Import par fusion (D49) ----------------------------------------------------------------------------------
// Un export est relu et comparé à ce que la base contient. Règle : rien n'est jamais supprimé, et
// une version publiée est immuable. Retourne { erreurs, plan, resume } ; un import n'est appliqué
// que sans erreur (base.applyImport).
//   received : le JSON de l'export ; existing : base.exportEditorData(db) ; tablesErrors(tables) : erreurs d'une version des
//   tables ; draftTablesErrors(tables) : celles du brouillon des tables (avec les images, D64 : une image archivée y est une erreur) ;
//   presentationErrorsOf(contenu) : celles d'un contenu de la présentation des tables ou de son historique (D76) ;
//   exercisePresentationErrorsOf(contenu) : de même pour la présentation d'un exercice (D78)
export const EXPORT_FORMAT = 'quiz-parametres-coupe/editeur/1';

// Le mot que la requête d'import doit porter, tel quel ; l'écran l'exige aussi (editeur.js du site).
// Si des outils de la banque disparaîtraient, c'est REMPLACER qu'il faut (D50) : importWord.
export const IMPORT_WORD = 'IMPORTER';
export const REPLACE_WORD = 'REMPLACER';
export const importWord = (resume) => (resume?.banque?.retires?.length > 0 ? REPLACE_WORD : IMPORT_WORD);

export function importPlan(received, existing, { tablesErrors, draftTablesErrors = tablesErrors, draftErrorsOf, latestTablesId = null, presentationErrorsOf = () => [], exercisePresentationErrorsOf = () => [] }) {
  const erreurs = [];
  const plan = { tables_ajoutees: [], brouillon_tables: null, presentation: { historique_ajoute: [], remplace: null }, banque: [], exercices_ajoutes: [], exercices_remplaces: [], versions_ajoutees: [], images_modifiees: [], presentations_exercices: [] };
  if (!isObject(received) || received.format !== EXPORT_FORMAT) return { erreurs: [`Ce fichier n'est pas un export de la Gestion du contenu (format attendu : ${EXPORT_FORMAT}).`], plan, resume: null };

  // Les images (D59) : leurs fiches seulement — le contenu voyage à part, une image par requête
  // (images/importer), avant l'import. Une image de l'export absente de la base est « manquante »
  // tant qu'elle n'a pas été envoyée ; une image présente garde son contenu (immuable sous son
  // identifiant : une empreinte différente est une erreur) et prend le nom et l'état d'archivage de l'export.
  const images = Array.isArray(received.images) ? received.images : [];
  const existingImages = new Map((existing.images ?? []).map((i) => [i.id, i]));
  const imagesManquantes = [];
  const imagesPresentes = [];
  images.forEach((i, n) => {
    if (!isObject(i) || !IMAGE_ID.test(String(i.id)) || !isText(i.empreinte) || !isText(i.nom) || !USAGES.includes(i.usage)) return erreurs.push(`Images, entrée ${n + 1} : fiche illisible (identifiant, nom, usage ou empreinte).`);
    const known = existingImages.get(i.id);
    if (known === undefined) return imagesManquantes.push(i.id);
    if (known.empreinte !== i.empreinte) return erreurs.push(`Image « ${i.id} » : la base en a une autre sous le même identifiant ; une image ne change jamais sous le même identifiant.`);
    imagesPresentes.push(i.id);
    const archiveeLe = typeof i.archivee_le === 'string' ? i.archivee_le : null;
    if (known.nom !== i.nom || (known.archivee_le ?? null) !== archiveeLe) plan.images_modifiees.push({ id: i.id, nom: i.nom, archivee_le: archiveeLe });
  });

  const tables = Array.isArray(received.tables_reference) ? received.tables_reference : [];
  const tablesById = new Map(existing.tables_reference.map((t) => [t.id, t]));
  for (const t of tables) {
    if (!isObject(t) || !isText(t.id)) { erreurs.push('Tables de référence : une entrée sans identifiant.'); continue; }
    const problems = tablesErrors(t);
    if (problems.length > 0) { erreurs.push(`Tables de référence « ${t.id} » : ${problems.join(' ; ')}`); continue; }
    const known = tablesById.get(t.id);
    if (known === undefined) { plan.tables_ajoutees.push(t); tablesById.set(t.id, t); } else if (!sameContent({ materiaux: known.materiaux, operations: known.operations }, { materiaux: t.materiaux, operations: t.operations })) {
      erreurs.push(`Tables de référence « ${t.id} » : la base en a une version différente sous le même identifiant ; une version de tables est immuable.`);
    }
  }

  // Le brouillon des tables (D61) : remplacé par celui de l'export, s'il en a un et s'il est valide.
  if (received.brouillon_tables !== undefined && received.brouillon_tables !== null) {
    const bt = received.brouillon_tables;
    const contenu = isObject(bt?.contenu) ? cleanTables(bt.contenu) : null;
    if (contenu === null) erreurs.push('Brouillon des tables de référence : illisible.');
    else {
      const problems = draftTablesErrors(contenu);
      if (problems.length > 0) erreurs.push(`Brouillon des tables de référence : ${problems.join(' ; ')}`);
      else plan.brouillon_tables = { contenu, base_id: isText(bt.base_id) && tablesById.has(bt.base_id) ? bt.base_id : null };
    }
  }
  // La présentation des tables et son historique (D76) : absente (un export d'avant), la présentation de la base ne change pas.
  const receivedPresentation = received.presentation_tables;
  if (receivedPresentation !== undefined && receivedPresentation !== null) {
    plan.presentation = mergePresentation(receivedPresentation, existing.presentation_tables, { label: 'Présentation des tables', errorsOf: presentationErrorsOf, normalize: normalizePresentation }, erreurs);
  }

  // La version de tables la plus récente une fois l'import fait : celle qu'un exercice sans tables_id prend (D62).
  const newestTablesId = [...tablesById.keys()].at(-1) ?? latestTablesId; // la dernière : celles de la base dans l'ordre, puis celles ajoutées

  const banque = Array.isArray(received.banque) ? received.banque : [];
  if (banque.length === 0) erreurs.push('La banque d\'outils de l\'export est vide.');
  const bankIds = new Set();
  banque.forEach((b, i) => {
    if (!isObject(b) || !isToolId(b.id) || !isObject(b.outil) || b.outil.id !== b.id) return erreurs.push(`Banque, entrée ${i + 1} : identifiant ou outil illisible.`);
    if (bankIds.has(b.id)) return erreurs.push(`Banque : l'outil « ${b.id} » est en double.`);
    bankIds.add(b.id);
    plan.banque.push({ id: b.id, outil: cleanTool(b.outil), rang: Number.isInteger(b.rang) ? b.rang : i + 1, archive_le: typeof b.archive_le === 'string' ? b.archive_le : null });
  });

  const exercices = Array.isArray(received.exercices) ? received.exercices : [];
  const existingById = new Map(existing.exercices.map((e) => [e.id, e]));
  for (const e of exercices) {
    if (!isObject(e) || !isExerciseId(e.id)) { erreurs.push('Exercices : une entrée sans identifiant valide.'); continue; }
    const brouillon = cleanDraft(e.brouillon);
    const known = existingById.get(e.id);
    const versions = Array.isArray(e.versions) ? e.versions : [];
    for (const v of versions) {
      if (!isObject(v) || !Number.isInteger(v.numero) || v.numero < 1 || !isObject(v.contenu)) { erreurs.push(`Exercice « ${e.id} » : une version illisible.`); continue; }
      const tablesId = isText(v.tables_id) ? v.tables_id : null;
      if (tablesId === null || !tablesById.has(tablesId)) { erreurs.push(`Exercice « ${e.id} », version ${v.numero} : tables de référence « ${v.tables_id} » inconnues.`); continue; }
      const problems = draftErrorsOf(v.contenu, tablesById.get(tablesId));
      if (problems.length > 0) { erreurs.push(`Exercice « ${e.id} », version ${v.numero} : ${problems.map((p) => `${p.champ} : ${p.message}`).join(' ; ')}`); continue; }
      const knownVersion = known?.versions.find((k) => k.numero === v.numero);
      if (knownVersion === undefined) plan.versions_ajoutees.push({ exercice_id: e.id, numero: v.numero, contenu: cleanDraft(v.contenu), tables_id: tablesId, publiee_le: typeof v.publiee_le === 'string' ? v.publiee_le : null });
      else if (!sameContent(knownVersion.contenu, v.contenu)) erreurs.push(`Exercice « ${e.id} », version ${v.numero} : la base en a une version différente sous le même numéro ; une version publiée est immuable.`);
    }
    // La version de tables du brouillon (D62) : celle de l'export si elle existe (ou est ajoutée), sinon la plus récente.
    let tablesId = newestTablesId;
    if (e.tables_id !== undefined && e.tables_id !== null) {
      if (isText(e.tables_id) && tablesById.has(e.tables_id)) tablesId = e.tables_id;
      else erreurs.push(`Exercice « ${e.id} » : tables de référence « ${e.tables_id} » inconnues.`);
    }
    const entry = { id: e.id, brouillon, tables_id: tablesId, archive_le: typeof e.archive_le === 'string' ? e.archive_le : null, cree_le: typeof e.cree_le === 'string' ? e.cree_le : null, publie_le: typeof e.publie_le === 'string' ? e.publie_le : null };
    if (known === undefined) plan.exercices_ajoutes.push(entry);
    else plan.exercices_remplaces.push(entry);
    // Sa présentation et son historique (D78), comme ceux des tables ; absente (un export d'avant), rien ne change.
    if (e.presentation !== undefined && e.presentation !== null) {
      const merged = mergePresentation(e.presentation, known?.presentation, { label: `Exercice « ${e.id} », présentation`, errorsOf: exercisePresentationErrorsOf, normalize: normalizeExercisePresentation }, erreurs);
      if (merged.historique_ajoute.length > 0 || merged.remplace !== null) plan.presentations_exercices.push({ exercice_id: e.id, ...merged });
    }
  }
  // La banque est remplacée entière : ce qui y apparaît, y change, y disparaît — par nom (D50).
  const existingBank = new Map(existing.banque.map((b) => [b.id, b]));
  const named = (b) => ({ id: b.id, nom: b.outil?.nom ?? b.id });
  const banqueDiff = {
    ajoutes: plan.banque.filter((b) => !existingBank.has(b.id)).map(named),
    modifies: plan.banque.filter((b) => existingBank.has(b.id) && !sameContent(existingBank.get(b.id).outil, b.outil)).map(named),
    retires: existing.banque.filter((b) => !bankIds.has(b.id)).map(named),
    gardes: plan.banque.filter((b) => existingBank.has(b.id) && sameContent(existingBank.get(b.id).outil, b.outil)).length,
  };
  const resume = {
    tables_ajoutees: plan.tables_ajoutees.map((t) => t.id),
    banque: banqueDiff,
    exercices_ajoutes: plan.exercices_ajoutes.map((e) => e.id),
    exercices_remplaces: plan.exercices_remplaces.map((e) => e.id),
    versions_ajoutees: plan.versions_ajoutees.map((v) => `${v.exercice_id} v${v.numero}`),
    exercices_gardes: existing.exercices.filter((e) => !exercices.some((r) => r?.id === e.id)).map((e) => e.id),
    images_manquantes: imagesManquantes,
    images_presentes: imagesPresentes.length,
    images_modifiees: plan.images_modifiees.map((i) => i.id),
    brouillon_tables: plan.brouillon_tables !== null,
    presentation_remplacee: plan.presentation.remplace !== null,
    presentation_historique: plan.presentation.historique_ajoute.length,
    presentations_exercices: plan.presentations_exercices.map((p) => ({ id: p.exercice_id, remplacee: p.remplace !== null, historique: p.historique_ajoute.length })),
  };
  return { erreurs, plan, resume };
}

// La fusion d'une présentation et de son historique (D76, point 11 ; D78, point 12) : les contenus d'historique de
// l'export s'ajoutent (un contenu déjà là, remplacé à la même date, n'est pas doublé) ; la présentation de l'export
// remplace celle de la base si elle en diffère — celle de la base va à l'historique (« import »). Jamais appliquée dans
// l'export (null) : celle de la base ne change pas. Retourne { historique_ajoute, remplace } ; les erreurs vont dans `erreurs`.
//   received : { contenu, modifiee_le, enseignant, historique } de l'export ; current : le même, tiré de la base (ou absent)
//   label : ce qui préfixe les erreurs ; errorsOf, normalize : les règles de cette présentation (tables ou exercice)
function mergePresentation(received, current, { label, errorsOf, normalize }, erreurs) {
  const merged = { historique_ajoute: [], remplace: null };
  if (!isObject(received)) { erreurs.push(`${label} : illisible.`); return merged; }
  const now = current ?? { contenu: null, modifiee_le: null, enseignant: null, historique: [] };
  const textOrNull = (v) => (isText(v) ? v : null);
  const seen = new Set((now.historique ?? []).map((h) => `${h.remplacee_le}|${canonicalText(h.contenu)}`));
  (Array.isArray(received.historique) ? received.historique : []).forEach((h, n) => {
    const where = `${label}, historique ${n + 1}`;
    if (!isObject(h) || !isText(h.remplacee_le) || !HISTORY_ACTIONS.includes(h.action)) return erreurs.push(`${where} : illisible (contenu, date ou action).`);
    const problems = errorsOf(h.contenu);
    if (problems.length > 0) return erreurs.push(`${where} : ${problems.join(' ; ')}`);
    const key = `${h.remplacee_le}|${canonicalText(h.contenu)}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.historique_ajoute.push({ contenu: normalize(h.contenu), posee_le: textOrNull(h.posee_le), posee_par: textOrNull(h.posee_par), remplacee_le: h.remplacee_le, remplacee_par: textOrNull(h.remplacee_par), action: h.action });
  });
  if (received.contenu !== null && received.contenu !== undefined) {
    const problems = errorsOf(received.contenu);
    if (problems.length > 0) erreurs.push(`${label} : ${problems.join(' ; ')}`);
    else if (now.contenu === null || !sameContent(now.contenu, received.contenu)) {
      merged.remplace = {
        avant: { contenu: now.contenu, modifiee_le: now.modifiee_le, enseignant: now.enseignant },
        apres: { contenu: normalize(received.contenu), modifiee_le: textOrNull(received.modifiee_le), enseignant: textOrNull(received.enseignant) },
      };
    }
  }
  return merged;
}

// Ce qui a remplacé un contenu de l'historique d'une présentation (migrations 0010 et 0011).
const HISTORY_ACTIONS = ['application', 'retablissement', 'import'];

// L'identifiant d'une image (images.js porte la même règle) : semence « mvlnr », « percage », téléversement « img-<empreinte> ».
const IMAGE_ID = /^[a-z0-9]+([_-][a-z0-9]+)*$/;

// Ce que le journal des actions note d'un import : « 1 table, 29 outils, 2 exercices ajoutés, 1 remplacé, 3 versions ».
export function importDetails(resume) {
  const b = resume.banque;
  return `${resume.tables_ajoutees.length} table(s) de référence · banque : ${b.ajoutes.length} ajouté(s), ${b.modifies.length} modifié(s), ${b.retires.length} retiré(s)${b.retires.length > 0 ? ` (${b.retires.map((t) => t.id).join(', ')})` : ''} · ${resume.exercices_ajoutes.length} exercice(s) ajouté(s) · ${resume.exercices_remplaces.length} remplacé(s) · ${resume.versions_ajoutees.length} version(s) ajoutée(s) · images : ${resume.images_presentes ?? 0} présente(s), ${resume.images_modifiees?.length ?? 0} fiche(s) mise(s) à jour · présentation des tables : ${resume.presentation_remplacee ? 'remplacée' : 'inchangée'}, ${resume.presentation_historique ?? 0} contenu(s) ajouté(s) à l'historique${exercisePresentationsDetails(resume.presentations_exercices ?? [])}`;
}

// « · présentation des exercices : 1 remplacée, 3 contenu(s) ajouté(s) à l'historique » (D78) ; rien s'il n'y en a pas.
function exercisePresentationsDetails(list) {
  if (list.length === 0) return '';
  const replaced = list.filter((p) => p.remplacee).length;
  const history = list.reduce((n, p) => n + p.historique, 0);
  return ` · présentation des exercices : ${replaced} remplacée(s), ${history} contenu(s) ajouté(s) à l'historique`;
}
