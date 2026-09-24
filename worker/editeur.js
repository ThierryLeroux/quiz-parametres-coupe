// Règles de l'éditeur (jalon 7, décisions D47 à D49) : identifiants, aperçu d'un exercice, plan
// d'un import, textes du journal des actions. Fonctions PURES : ni base, ni réseau, ni horloge.
// Le SQL est dans base.js ; la validation d'un brouillon dans site/js/exercice.js (draftErrors),
// partagée avec l'éditeur du navigateur.

import { computeParameters } from '../site/js/calcul.js';
import { TOOL_KEYS } from '../site/js/data.js';
import { DRAFT_KEYS, draftErrors, fieldsToGrade } from '../site/js/exercice.js';
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
    };
  });
}

// --- Import par fusion (D49) ----------------------------------------------------------------------------------
// Un export est relu et comparé à ce que la base contient. Règle : rien n'est jamais supprimé, et
// une version publiée est immuable. Retourne { erreurs, plan, resume } ; un import n'est appliqué
// que sans erreur (base.applyImport).
//   received : le JSON de l'export ; existing : base.exportEditorData(db) ; tablesValid(tables) : erreurs des tables (validateData)
export const EXPORT_FORMAT = 'quiz-parametres-coupe/editeur/1';

export function importPlan(received, existing, { tablesErrors, draftErrorsOf }) {
  const erreurs = [];
  const plan = { tables_ajoutees: [], banque: [], exercices_ajoutes: [], exercices_remplaces: [], versions_ajoutees: [] };
  if (!isObject(received) || received.format !== EXPORT_FORMAT) return { erreurs: [`Ce fichier n'est pas un export de l'éditeur (format attendu : ${EXPORT_FORMAT}).`], plan, resume: null };

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
  const resume = {
    tables_ajoutees: plan.tables_ajoutees.map((t) => t.id),
    banque: plan.banque.length,
    exercices_ajoutes: plan.exercices_ajoutes.map((e) => e.id),
    exercices_remplaces: plan.exercices_remplaces.map((e) => e.id),
    versions_ajoutees: plan.versions_ajoutees.map((v) => `${v.exercice_id} v${v.numero}`),
    exercices_gardes: existing.exercices.filter((e) => !exercices.some((r) => r?.id === e.id)).map((e) => e.id),
  };
  return { erreurs, plan, resume };
}

// Ce que le journal des actions note d'un import : « 1 table, 29 outils, 2 exercices ajoutés, 1 remplacé, 3 versions ».
export function importDetails(resume) {
  return `${resume.tables_ajoutees.length} table(s) de référence · ${resume.banque} outil(s) de banque · ${resume.exercices_ajoutes.length} exercice(s) ajouté(s) · ${resume.exercices_remplaces.length} remplacé(s) · ${resume.versions_ajoutees.length} version(s) ajoutée(s)`;
}
