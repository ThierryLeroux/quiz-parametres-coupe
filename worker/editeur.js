// Règles de l'éditeur (jalon 7, décisions D47 à D49) : identifiants, aperçu d'un exercice, plan
// d'un import, textes du journal des actions. Fonctions PURES : ni base, ni réseau, ni horloge.
// Le SQL est dans base.js ; la validation d'un brouillon dans site/js/exercice.js (draftErrors),
// partagée avec l'éditeur du navigateur.

import { computeParameters } from '../site/js/calcul.js';
import { TOOL_KEYS } from '../site/js/data.js';
import { DRAFT_KEYS, draftErrors, fieldsToGrade, maskedFields } from '../site/js/exercice.js';
import { formatParameters } from '../site/js/format.js';
import { eligibleTools } from '../site/js/progression.js';
import { generateQuestion } from '../site/js/question.js';

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

// --- Import par fusion (D49) ----------------------------------------------------------------------------------
// Un export est relu et comparé à ce que la base contient. Règle : rien n'est jamais supprimé, et
// une version publiée est immuable. Retourne { erreurs, plan, resume } ; un import n'est appliqué
// que sans erreur (base.applyImport).
//   received : le JSON de l'export ; existing : base.exportEditorData(db) ; tablesValid(tables) : erreurs des tables (validateData)
export const EXPORT_FORMAT = 'quiz-parametres-coupe/editeur/1';

// Le mot que la requête d'import doit porter, tel quel ; l'écran l'exige aussi (editeur.js du site).
// Si des outils de la banque disparaîtraient, c'est REMPLACER qu'il faut (D50) : importWord.
export const IMPORT_WORD = 'IMPORTER';
export const REPLACE_WORD = 'REMPLACER';
export const importWord = (resume) => (resume?.banque?.retires?.length > 0 ? REPLACE_WORD : IMPORT_WORD);

export function importPlan(received, existing, { tablesErrors, draftErrorsOf }) {
  const erreurs = [];
  const plan = { tables_ajoutees: [], banque: [], exercices_ajoutes: [], exercices_remplaces: [], versions_ajoutees: [], images_modifiees: [] };
  if (!isObject(received) || received.format !== EXPORT_FORMAT) return { erreurs: [`Ce fichier n'est pas un export de l'éditeur (format attendu : ${EXPORT_FORMAT}).`], plan, resume: null };

  // Les images (D59) : leurs fiches seulement — le contenu voyage à part, une image par requête
  // (images/importer), avant l'import. Une image de l'export absente de la base est « manquante »
  // tant qu'elle n'a pas été envoyée ; une image présente garde son contenu (immuable sous son
  // identifiant : une empreinte différente est une erreur) et prend le nom et l'état d'archivage de l'export.
  const images = Array.isArray(received.images) ? received.images : [];
  const existingImages = new Map((existing.images ?? []).map((i) => [i.id, i]));
  const imagesManquantes = [];
  const imagesPresentes = [];
  images.forEach((i, n) => {
    if (!isObject(i) || !IMAGE_ID.test(String(i.id)) || !isText(i.empreinte) || !isText(i.nom) || !['outil', 'operation'].includes(i.usage)) return erreurs.push(`Images, entrée ${n + 1} : fiche illisible (identifiant, nom, usage ou empreinte).`);
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
    const entry = { id: e.id, brouillon, archive_le: typeof e.archive_le === 'string' ? e.archive_le : null, cree_le: typeof e.cree_le === 'string' ? e.cree_le : null, publie_le: typeof e.publie_le === 'string' ? e.publie_le : null };
    if (known === undefined) plan.exercices_ajoutes.push(entry);
    else plan.exercices_remplaces.push(entry);
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
  };
  return { erreurs, plan, resume };
}

// L'identifiant d'une image (images.js porte la même règle) : semence « mvlnr », « percage », téléversement « img-<empreinte> ».
const IMAGE_ID = /^[a-z0-9]+([_-][a-z0-9]+)*$/;

// Ce que le journal des actions note d'un import : « 1 table, 29 outils, 2 exercices ajoutés, 1 remplacé, 3 versions ».
export function importDetails(resume) {
  const b = resume.banque;
  return `${resume.tables_ajoutees.length} table(s) de référence · banque : ${b.ajoutes.length} ajouté(s), ${b.modifies.length} modifié(s), ${b.retires.length} retiré(s)${b.retires.length > 0 ? ` (${b.retires.map((t) => t.id).join(', ')})` : ''} · ${resume.exercices_ajoutes.length} exercice(s) ajouté(s) · ${resume.exercices_remplaces.length} remplacé(s) · ${resume.versions_ajoutees.length} version(s) ajoutée(s) · images : ${resume.images_presentes ?? 0} présente(s), ${resume.images_modifiees?.length ?? 0} fiche(s) mise(s) à jour`;
}
