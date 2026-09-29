// Le lot d'exercices de l'automne 2026 (décision D84) : à partir d'un EXPORT de la Gestion du contenu, compose le
// fichier d'import qui crée d'un seul coup 7 exercices, 7 démos, 6 outils et 2 images, et modifie 3 outils de la banque.
// Le catalogue arrêté par Thierry est dans docs/lots/lot-exercices-2026-09.md ; ce qui suit en est la transcription.
//
// Depuis la racine du dépôt :
//
//     node reference/lot-exercices/generer.mjs captures/lot-exercices/<export>.json
//
//   --images <dossier> : où sont outil_a_rainurer.png et fraise_a_fileter.png (par défaut, le dossier de l'export)
//   --sortie <fichier> : le fichier écrit (par défaut, import-lot.json dans le dossier de l'export)
//
// Le script ne parle à aucun serveur et ne touche à aucune base : il lit un fichier et en écrit un, à importer dans la
// Gestion du contenu (Sauvegarde → « Valider l'import » → « Importer »). Le même export donne toujours le même fichier,
// octet pour octet (aucune date n'y est écrite). Le fichier produit ne va pas dans Git (captures/ en est exclu).
//
// Il se relance sur un export plus frais : tout est recalculé à partir de la banque, des tables et du brouillon de cet
// export. Relancé sur un export pris APRÈS l'import, il redonne le même contenu (rien n'est ajouté deux fois).
//
// Rien n'est écrit si une vérification échoue : opération inconnue des tables, outil invalide, brouillon avec des
// erreurs (draftErrors), nombre de questions différent de la grille, titre en double (D74), outil de la banque qui
// disparaîtrait, import que le serveur refuserait (importPlan, le code même du serveur).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TOOL_KEYS, parseThread, validateData, validateTables } from '../../site/js/data.js';
import { copyOfTool, draftErrors, sameTitleExercises, titleKey } from '../../site/js/exercice.js';
import { PASSAGE_REASON, carriesSpeedFactors, factorText, speedFactorState } from '../../site/js/facteur-vitesse.js';
import { exercisePresentationErrors } from '../../site/js/presentation-exercice.js';
import { deducibleWarnings, factorSource } from '../../site/js/ui/editeur-data.js';
import { tablesOf } from '../../worker/catalogue.js';
import { EXPORT_FORMAT, importPlan, isExerciseId, isToolId, sameContent } from '../../worker/editeur.js';
import { MAX_IMAGE_BYTES, cleanImageName, imageIdFor, magicType } from '../../worker/images.js';

// =====================================================================================================================
// Le catalogue (docs/lots/lot-exercices-2026-09.md)
// =====================================================================================================================

const STEEL = 'Acier rapide';
const SOLID = 'Carbure de tungstène solide';
const INSERT = 'Insert de carbure de tungstène';

// Forets hélicoïdaux : Ø 1/16 po au minimum dans chaque copie. Le foret Udrill n'est pas de cette famille.
const MIN_DRILL = 1 / 16;
const TWIST_DRILLS = ['foret_fractionnaire', 'foret_fractionnaire_2', 'foret_a_numero', 'foret_a_lettre', 'foret_metrique', 'foret_metrique_2'];
// Ce que la règle doit donner, d'après le catalogue : la première dimension gardée, et leur nombre quand il est dit.
const DRILL_EXPECTED = {
  foret_fractionnaire: { premiere: 'Ø 1/16 po', nombre: 61 },
  foret_a_numero: { premiere: '#52' },
  foret_metrique: { premiere: 'Ø 1.6 mm' },
  foret_a_lettre: { premiere: 'A', nombre: 26 },
};

// Les outils axiaux (avance calculée à partir du M30 seulement) : aucun dans les exercices d'avances du M10.
const AXIAL_TOOLS = [...TWIST_DRILLS, 'foret_udrill', 'foret_a_centrer', 'foret_a_pointer', 'alesoir', 'alesoir_2', 'taraud_imperial', 'taraud_imperial_2', 'taraud_metrique', 'outil_a_chambrer', 'fraise_82_degres', 'nine9_90_degres'];

// Une opération renommée dans les tables : un outil qui porte l'ancien nom prend le nouveau (A2026_r6).
const RENAMED_OPERATIONS = { Chanfreinage: 'Chanfreinage / chambrage' };

const SINGLE_INSERT_REASON = 'Un seul insert de carbure en périphérie : vitesse non réduite';

// Les deux images nouvelles (120 px, fond transparent). Leur identifiant vient de leur empreinte, comme celui d'une
// image téléversée dans l'onglet Images (imageIdFor) : même contenu, même identifiant, sur toute base.
const NEW_IMAGES = {
  outil_a_rainurer: { fichier: 'outil_a_rainurer.png', nom: 'Outil à rainurer' },
  fraise_a_fileter: { fichier: 'fraise_a_fileter.png', nom: 'Fraise à fileter' },
};

// Les six outils à créer. Groupes usinés : tous sauf la classe O ; limite de vitesse de rotation des outils voisins
// (tour 3000, fraiseuse 10000) ; facteur de vitesse hérité de l'opération, sauf `force`.
//   image : { banque: <image d'un outil existant> } ou { nouvelle: <clé de NEW_IMAGES> }
//   dimensions : une liste, ou { de: <outil de la banque> } — les siennes, telles que l'export les donne
const NEW_TOOLS = [
  { id: 'dtfnr', nom: 'DTFNR', format_identifiant: 'DTFNR - Ø dressé: [IdDia]', operation: 'Dressage', limite_rpm: 3000, dents: [1, 1], materiaux_outil: [INSERT], image: { banque: 'mclnr' }, dimensions: { de: 'mvlnr' } },
  { id: 'outil_a_rainurer', nom: 'Outil à rainurer', format_identifiant: 'Outil à rainurer - Ø rainuré: [IdDia]', operation: 'Rainurage externe', limite_rpm: 3000, dents: [1, 1], materiaux_outil: [INSERT], image: { nouvelle: 'outil_a_rainurer' }, dimensions: { de: 'mvlnr' } },
  {
    id: 'nine9_ebavurage', nom: "Nine9 d'ébavurage", format_identifiant: 'Outil à chanfreiner Nine9 : [IdDia]', operation: 'Chanfreinage / ébavurage', limite_rpm: 10000, dents: [1, 1], materiaux_outil: [INSERT], image: { banque: 'nine9_90_degres' },
    force: { fact_vc: 1, fact_vc_raison: SINGLE_INSERT_REASON },
    dimensions: [{ libelle: 'Ø 1/4 po', valeur: 0.25 }, { libelle: 'Ø 3/8 po', valeur: 0.375 }, { libelle: 'Ø 1/2 po', valeur: 0.5 }],
  },
  { id: 'fraise_a_surfacer_3po_5', nom: 'Fraise à surfacer 3 po, 5 dents', format_identifiant: 'Fraise à surfacer Ø [IdDia] - [NbDent] inserts', operation: 'Surfaçage', limite_rpm: 10000, dents: [5, 5], materiaux_outil: [INSERT], image: { banque: 'fraise_a_surfacer' }, dimensions: [{ libelle: '3 po', valeur: 3 }] },
  { id: 'fraise_a_surfacer_3po_7', nom: 'Fraise à surfacer 3 po, 7 dents', format_identifiant: 'Fraise à surfacer Ø [IdDia] - [NbDent] inserts', operation: 'Surfaçage', limite_rpm: 10000, dents: [7, 7], materiaux_outil: [INSERT], image: { banque: 'fraise_a_surfacer' }, dimensions: [{ libelle: '3 po', valeur: 3 }] },
  {
    // Le gabarit du catalogue est « Fraise à fileter Ø [IdDia] - [NbDent] dents » ; [IdDia] est le libellé de la
    // dimension, qui commence déjà par « Ø » : le « Ø » du gabarit est retiré, sinon la question afficherait « Ø Ø 0.300 po ».
    id: 'fraise_a_fileter', nom: 'Fraise à fileter', format_identifiant: 'Fraise à fileter [IdDia] - [NbDent] dents', operation: 'Contournage finition', limite_rpm: 10000, dents: [4, 4], materiaux_outil: [SOLID], image: { nouvelle: 'fraise_a_fileter' },
    dimensions: [{ libelle: 'Ø 0.300 po — 16 à 28 filets/po', valeur: 0.3 }, { libelle: 'Ø 0.240 po — 18 à 28 filets/po', valeur: 0.24 }, { libelle: 'Ø 0.180 po — 20 à 32 filets/po', valeur: 0.18 }],
  },
];

// Les deux outils à modifier (en plus de leur opération renommée).
const MODIFIED_TOOLS = {
  nine9_90_degres: { force: { fact_vc: 1, fact_vc_raison: SINGLE_INSERT_REASON } },
  outil_a_chambrer: { materiaux_outil: [STEEL], force: null }, // acier rapide seulement ; hérite de son opération
};

// Les outils dont le facteur de vitesse est forcé, dans la banque comme dans les copies : ces deux-là, aucun autre.
const FORCED_TOOLS = ['nine9_90_degres', 'nine9_ebavurage'];

// La grille : les réussites de suite exigées de chaque outil dans chaque exercice (0 : absent), dans l'ordre du catalogue.
const COLUMNS = ['T2', 'T3', 'F2', 'F3', 'M30', 'M40', 'F50'];
const GRID = [
  ['dtfnr', 3, 3, 0, 0, 0, 3, 1],
  ['mclnr', 3, 3, 0, 0, 0, 3, 1],
  ['mvlnr', 3, 3, 0, 0, 0, 3, 1],
  ['outil_a_rainurer', 3, 3, 0, 0, 0, 3, 1],
  ['lame_a_tronconner', 3, 3, 0, 0, 0, 3, 1],
  ['barre_a_rainurer', 0, 3, 0, 0, 0, 3, 1],
  ['barre_a_aleser', 3, 3, 0, 0, 0, 3, 1],
  ['sdtmr', 3, 3, 0, 0, 0, 2, 1],
  ['sdtmr_2', 0, 0, 0, 0, 0, 2, 1],
  ['barre_a_fileter', 3, 3, 0, 0, 0, 2, 1],
  ['barre_a_fileter_2', 0, 0, 0, 0, 0, 2, 1],
  ['foret_a_centrer', 3, 0, 0, 0, 0, 3, 1],
  ['foret_a_pointer', 3, 0, 3, 0, 3, 0, 1],
  ['foret_fractionnaire', 2, 0, 2, 0, 2, 2, 1],
  ['foret_fractionnaire_2', 0, 0, 0, 0, 0, 0, 1],
  ['foret_a_numero', 2, 0, 2, 0, 2, 0, 1],
  ['foret_a_lettre', 2, 0, 2, 0, 2, 0, 1],
  ['foret_metrique', 0, 0, 0, 0, 2, 2, 1],
  ['foret_metrique_2', 0, 0, 0, 0, 0, 0, 1],
  ['foret_udrill', 0, 0, 0, 0, 3, 3, 1],
  ['alesoir', 0, 0, 3, 0, 3, 0, 1],
  ['alesoir_2', 0, 0, 0, 0, 0, 0, 1],
  ['taraud_imperial', 0, 0, 3, 0, 2, 0, 1],
  ['taraud_imperial_2', 0, 0, 0, 0, 0, 0, 1],
  ['taraud_metrique', 0, 0, 0, 0, 2, 0, 1],
  ['fraise_82_degres', 0, 0, 3, 0, 3, 0, 1],
  ['outil_a_chambrer', 0, 0, 3, 0, 3, 0, 1],
  ['nine9_90_degres', 0, 0, 2, 0, 2, 0, 1],
  ['nine9_ebavurage', 0, 0, 2, 3, 2, 0, 1],
  ['fraise_en_bout_helicoidale', 0, 0, 3, 3, 3, 0, 1],
  ['fraise_en_bout_a_inserts', 0, 0, 3, 3, 3, 0, 1],
  ['fraise_a_surfacer', 0, 0, 3, 2, 2, 0, 1],
  ['fraise_a_surfacer_3po_5', 0, 0, 0, 2, 2, 0, 1],
  ['fraise_a_surfacer_3po_7', 0, 0, 0, 2, 2, 0, 1],
  ['fraise_a_fileter', 0, 0, 0, 0, 0, 0, 3],
];

// Les réglages. Vc et N : fz et f fournies, Vf masquée. Partout : le facteur de vitesse est à trouver
// (`facteur_vitesse_donne` absent), tous les groupes usinés de chaque outil, et l'exercice est à l'accueil (`liste`
// absente : c'est ainsi que la Gestion du contenu écrit « oui »).
const VC_AND_N = { champs_evalues: ['vc', 'n'], champs_masques: ['vf'] };
const EVERYTHING = { champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'] };
const M10_MATERIALS = [STEEL, INSERT]; // jamais le carbure solide au M10 ; M30, M40, F50 : les trois (aucune restriction)

// Les sept exercices, dans l'ordre de l'accueil ; chacun avec sa démo, qui le précède.
//   questions : le total de sa colonne dans la grille ; avancesSeules : un exercice d'avances du M10 (aucun outil axial)
//   existant  : son brouillon part de celui de l'export ; ses versions publiées ne sont pas touchées
const EXERCISES = [
  { colonne: 'T2', id: 'm10-tournage-vc-rpm-2', titre: 'Tournage — Exercice 2', cours: 'M10 — Tournage', grandeurs: VC_AND_N, materiaux_outil: M10_MATERIALS, questions: 36, existant: true, m10: true, demo: { titre: "Tournage — Démo de l'exercice 2", outil: 'foret_fractionnaire' } },
  { colonne: 'T3', id: 'm10-tournage-avances', titre: 'Tournage — Exercice 3', cours: 'M10 — Tournage', grandeurs: EVERYTHING, materiaux_outil: M10_MATERIALS, questions: 27, m10: true, avancesSeules: true, demo: { titre: "Tournage — Démo de l'exercice 3", outil: 'barre_a_aleser' } },
  { colonne: 'F2', id: 'm10-fraisage-vc-rpm', titre: 'Fraisage — Exercice 2', cours: 'M10 — Fraisage', grandeurs: VC_AND_N, materiaux_outil: M10_MATERIALS, questions: 34, m10: true, demo: { titre: "Fraisage — Démo de l'exercice 2", outil: 'fraise_en_bout_helicoidale' } },
  { colonne: 'F3', id: 'm10-fraisage-avances', titre: 'Fraisage — Exercice 3', cours: 'M10 — Fraisage', grandeurs: EVERYTHING, materiaux_outil: M10_MATERIALS, questions: 15, m10: true, avancesSeules: true, demo: { titre: "Fraisage — Démo de l'exercice 3", outil: 'fraise_en_bout_helicoidale' } },
  { colonne: 'M30', id: 'm30-fraisage-cn', titre: 'M30 — Fraisage CN : paramètres de coupe', cours: 'M30', grandeurs: EVERYTHING, questions: 43, demo: { titre: 'M30 — Démo : fraisage CN', outil: 'fraise_a_surfacer_3po_5' } },
  { colonne: 'M40', id: 'm40-tournage-cn', titre: 'M40 — Tournage CN : paramètres de coupe', cours: 'M40', grandeurs: EVERYTHING, questions: 39, demo: { titre: 'M40 — Démo : tournage CN', outil: 'sdtmr_2' } },
  { colonne: 'F50', id: 'f50-synthese', titre: 'F50 — Synthèse du fraisage et du tournage', cours: 'F50', grandeurs: EVERYTHING, questions: 37, demo: { titre: 'F50 — Démo : synthèse', outil: 'fraise_a_fileter' } },
];

const demoId = (exerciseId) => `demo-${exerciseId}`;

// =====================================================================================================================
// La composition
// =====================================================================================================================

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Le Ø d'une dimension, en pouces : sa valeur, ou le Ø de son filet (« 0.25-20 », « 10x1.5 »).
const diameterOf = (dimension) => (typeof dimension.valeur === 'number' ? dimension.valeur : parseThread(dimension.valeur)?.diameter ?? Number.NaN);

// Un outil sans ses clés de facteur, puis avec celles données, rangées devant `fact_av` (l'ordre des clés de la banque).
function withFactor(tool, forced) {
  const out = {};
  for (const [key, value] of Object.entries(tool)) {
    if (key === 'fact_vc' || key === 'fact_vc_raison') continue;
    if (key === 'fact_av' && forced) Object.assign(out, forced);
    out[key] = value;
  }
  return out;
}

// Les fiches des deux images nouvelles, avec leur contenu : { cle → { id, nom, usage, type, taille, empreinte, archivee_le, contenu } }.
//   files : Map nom de fichier → octets
function newImages(files, problems) {
  const images = {};
  for (const [key, { fichier, nom }] of Object.entries(NEW_IMAGES)) {
    const bytes = files.get(fichier);
    if (bytes === undefined) { problems.push(`Image « ${fichier} » : fichier introuvable.`); continue; }
    if (magicType(bytes) !== 'image/png') { problems.push(`Image « ${fichier} » : ce n'est pas un PNG.`); continue; }
    if (bytes.length > MAX_IMAGE_BYTES) { problems.push(`Image « ${fichier} » : ${bytes.length} octets, au plus ${MAX_IMAGE_BYTES}.`); continue; }
    const empreinte = sha256(bytes);
    images[key] = { id: imageIdFor(empreinte), nom: cleanImageName(nom), usage: 'outil', type: 'image/png', taille: bytes.length, empreinte, archivee_le: null, contenu: Buffer.from(bytes).toString('base64') };
  }
  return images;
}

// La banque du lot : celle de l'export, ses opérations renommées, ses deux outils modifiés, puis les six nouveaux au
// dernier rang. Aucun outil n'est retiré. Retourne { banque, renommes, nouveaux } — les identifiants touchés.
function buildBank(exported, tables, images, problems) {
  const operations = new Set(tables.operations.operations.map((op) => op.operation));
  const groups = tables.materiaux.groupes_iso.filter((group) => !group.startsWith('O - '));
  const banque = structuredClone(exported.banque);
  const byId = new Map(banque.map((entry) => [entry.id, entry]));
  const knownImages = new Map(exported.images.map((image) => [image.id, image]));

  const renommes = [];
  for (const entry of banque) {
    const renamed = RENAMED_OPERATIONS[entry.outil.operation];
    if (operations.has(entry.outil.operation) || renamed === undefined) continue;
    entry.outil.operation = renamed;
    renommes.push(entry.id);
  }
  for (const [id, change] of Object.entries(MODIFIED_TOOLS)) {
    const entry = byId.get(id);
    if (entry === undefined) { problems.push(`Banque : l'outil à modifier « ${id} » n'est pas dans l'export.`); continue; }
    if (change.materiaux_outil) entry.outil.materiaux_outil = [...change.materiaux_outil];
    entry.outil = withFactor(entry.outil, change.force);
  }

  let rang = Math.max(0, ...banque.map((entry) => entry.rang ?? 0));
  const nouveaux = [];
  for (const spec of NEW_TOOLS) {
    const source = isObject(spec.dimensions) ? byId.get(spec.dimensions.de)?.outil.dimensions : spec.dimensions;
    if (!Array.isArray(source)) { problems.push(`Outil « ${spec.id} » : les dimensions de « ${spec.dimensions.de} » sont introuvables.`); continue; }
    const image = spec.image.nouvelle ? images[spec.image.nouvelle]?.id : spec.image.banque;
    if (image === undefined) continue; // l'image nouvelle manque : déjà dit
    if (spec.image.banque && (!knownImages.has(image) || knownImages.get(image).archivee_le)) problems.push(`Outil « ${spec.id} » : l'image « ${image} » est absente de l'export, ou archivée.`);
    const outil = {
      id: spec.id,
      nom: spec.nom,
      format_identifiant: spec.format_identifiant,
      commentaire: null, // pas de note : le catalogue n'en donne pas
      operation: spec.operation,
      ...(spec.force ?? {}),
      fact_av: 1,
      limite_rpm: spec.limite_rpm,
      nb_dents_min: spec.dents[0],
      nb_dents_max: spec.dents[1],
      materiaux_outil: [...spec.materiaux_outil],
      groupes_materiaux_usinables: [...groups],
      image,
      dimensions: structuredClone(source),
    };
    const known = byId.get(spec.id);
    if (known !== undefined) known.outil = outil; // le script relancé après l'import : l'outil garde son rang
    else {
      rang += 1;
      const entry = { id: spec.id, outil, rang, archive_le: null };
      banque.push(entry);
      byId.set(spec.id, entry);
      nouveaux.push(spec.id);
    }
  }

  // Chaque outil se valide comme dans la Gestion du contenu (validateData, avec les tables les plus récentes).
  if (groups.length !== 14) problems.push(`Tables : ${groups.length} groupes usinés hors de la classe O, 14 attendus.`);
  for (const entry of banque) {
    if (!isToolId(entry.id) || entry.outil.id !== entry.id) problems.push(`Banque : identifiant illisible (« ${entry.id} »).`);
    for (const key of Object.keys(entry.outil)) if (!TOOL_KEYS.includes(key)) problems.push(`Banque, « ${entry.id} » : clé inconnue « ${key} ».`);
    for (const message of validateData({ materiaux: tables.materiaux, operations: tables.operations, outils: { outils: [entry.outil] } })) problems.push(`Banque, « ${entry.id} » : ${message}`);
  }
  return { banque, renommes, nouveaux };
}

// Les dimensions qu'une copie garde : pour un foret hélicoïdal, celles de Ø 1/16 po et plus ; pour les autres, toutes.
//   origin : l'outil de la banque dont la copie vient
function keptDimensions(origin, dimensions) {
  return TWIST_DRILLS.includes(origin) ? dimensions.filter((d) => diameterOf(d) >= MIN_DRILL - 1e-9) : dimensions;
}

// La copie d'un outil de la banque pour un exercice du lot, comme « Ajouter depuis la banque » la ferait (copyOfTool).
function copyFor(tool, streak) {
  return copyOfTool(tool, { reussites_requises: streak, dimensions: keptDimensions(tool.id, tool.dimensions).map((d) => d.libelle) });
}

// Le brouillon d'un exercice : ses réglages, puis les copies de sa colonne de la grille.
//   kept : les copies d'un brouillon existant, à garder quand l'outil est encore dans la liste (Map origine → copie)
function buildDraft(spec, entries, bankById, { titre = spec.titre, kept = new Map() } = {}) {
  const outils = entries.map(([toolId, streak]) => {
    const before = kept.get(toolId);
    if (before === undefined) return copyFor(bankById.get(toolId).outil, streak);
    const operation = RENAMED_OPERATIONS[before.operation] !== undefined && bankById.get(toolId).outil.operation === RENAMED_OPERATIONS[before.operation] ? RENAMED_OPERATIONS[before.operation] : before.operation;
    return { ...before, operation, dimensions: keptDimensions(toolId, before.dimensions), reussites_requises: streak };
  });
  return { titre, cours: spec.cours, ...structuredClone(spec.grandeurs), outils, ...(spec.materiaux_outil ? { materiaux_outil: [...spec.materiaux_outil] } : {}) };
}

// Ce qu'une copie gardée d'un brouillon existant a de différent de l'outil de la banque (hors dimensions et réussites).
function copyDifferences(copy, tool) {
  const { reussites_requises: _r, origine: _o, dimensions: _d, ...mine } = copy;
  const { dimensions: _e, ...theirs } = tool;
  return [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].filter((key) => JSON.stringify(mine[key]) !== JSON.stringify(theirs[key]));
}

// Compose le lot. Retourne { lot, resume, problemes, remarques } ; le lot n'est à écrire que sans problème.
//   exported : le JSON d'un export de la Gestion du contenu ; files : Map nom de fichier → octets (les deux images)
export function buildLot(exported, files) {
  const problems = [];
  const notes = [];
  if (!isObject(exported) || exported.format !== EXPORT_FORMAT) return { lot: null, resume: null, problemes: [`Ce fichier n'est pas un export de la Gestion du contenu (format attendu : ${EXPORT_FORMAT}).`], remarques: [] };

  // Les tables les plus récentes de l'export : la dernière de la liste (l'ordre de la base).
  const latest = exported.tables_reference.at(-1);
  const tables = { id: latest.id, ...tablesOf(latest) };
  for (const message of validateTables(tables)) problems.push(`Tables « ${latest.id} » : ${message}`);
  if (!carriesSpeedFactors(tables.operations.operations)) problems.push(`Tables « ${latest.id} » : elles ne portent pas les facteurs de vitesse (D83).`);
  const opsByName = new Map(tables.operations.operations.map((op) => [op.operation, op]));

  const images = newImages(files, problems);
  const { banque, renommes, nouveaux } = buildBank(exported, tables, images, problems);
  const bankById = new Map(banque.map((entry) => [entry.id, entry]));
  for (const [toolId] of GRID) if (!bankById.has(toolId)) problems.push(`Grille : l'outil « ${toolId} » n'est pas dans la banque.`);
  for (const entry of banque) if (!GRID.some(([toolId]) => toolId === entry.id)) notes.push(`L'outil « ${entry.id} » de la banque n'est dans aucun exercice du lot.`);
  if (problems.length > 0) return { lot: null, resume: null, problemes: problems, remarques: notes };

  // Les exercices, dans l'ordre de l'accueil : chaque démo juste avant son exercice.
  const exportedById = new Map(exported.exercices.map((e) => [e.id, e]));
  const exercices = [];
  const rows = [];
  for (const spec of EXERCISES) {
    const column = COLUMNS.indexOf(spec.colonne) + 1;
    const entries = GRID.filter((row) => row[column] > 0).map((row) => [row[0], row[column]]);
    const known = exportedById.get(spec.id);
    if (spec.existant && known === undefined) notes.push(`« ${spec.id} » n'est pas dans l'export : il est créé, comme les autres.`);
    if (!spec.existant && known !== undefined && known.versions.length > 0) notes.push(`« ${spec.id} » est déjà publié dans l'export (version ${known.versions.at(-1).numero}) : son brouillon est remplacé par celui du lot.`);

    // Le brouillon d'un exercice existant part du sien : ses copies restent, quand leur outil est encore dans la liste.
    const kept = new Map();
    if (spec.existant && known !== undefined) {
      for (const copy of known.brouillon.outils) if (entries.some(([toolId]) => toolId === (copy.origine ?? copy.id)) && copy.id === (copy.origine ?? copy.id)) kept.set(copy.id, copy);
      for (const [toolId, copy] of kept) {
        const different = copyDifferences(copy, bankById.get(toolId).outil);
        if (different.length > 0) notes.push(`« ${spec.id} » : la copie « ${toolId} » de son brouillon diffère de l'outil de la banque (${different.join(', ')}) ; elle est gardée telle quelle.`);
      }
      for (const key of ['champs_evalues', 'champs_masques', 'materiaux_outil', 'groupes', 'facteur_vitesse_donne', 'liste']) {
        const mine = key in spec.grandeurs ? spec.grandeurs[key] : (key === 'materiaux_outil' ? spec.materiaux_outil : undefined);
        if (JSON.stringify(known.brouillon[key]) !== JSON.stringify(mine)) notes.push(`« ${spec.id} » : le réglage « ${key} » de son brouillon (${JSON.stringify(known.brouillon[key])}) n'est pas celui du catalogue (${JSON.stringify(mine)}) ; celui du catalogue est pris.`);
      }
    }
    const demoTool = GRID.find(([toolId]) => toolId === spec.demo.outil);
    const demo = { id: demoId(spec.id), spec, brouillon: buildDraft(spec, [[demoTool[0], 1]], bankById, { titre: spec.demo.titre }), questions: 1 };
    const exercise = { id: spec.id, spec, brouillon: buildDraft(spec, entries, bankById, { kept }), questions: spec.questions };

    for (const { id, brouillon, questions } of [demo, exercise]) {
      const before = exportedById.get(id);
      const entry = { id, brouillon, tables_id: tables.id, archive_le: before?.archive_le ?? null };
      // Un exercice déjà publié : son titre et son cours se posent par sa présentation en direct (D78) — ceux de son
      // brouillon dorment. Le reste de sa présentation (« À l'accueil », photos et notes appliquées) est gardé.
      if (before !== undefined && before.versions.length > 0) {
        const stored = isObject(before.presentation?.contenu) ? before.presentation.contenu : { liste: true, outils: [] };
        entry.presentation = { contenu: { titre: brouillon.titre, cours: brouillon.cours, liste: true, outils: structuredClone(stored.outils ?? []) }, modifiee_le: null, enseignant: null, historique: [] };
        for (const message of exercisePresentationErrors(entry.presentation.contenu)) problems.push(`« ${id} », présentation : ${message}`);
      }
      exercices.push(entry);

      // Les vérifications d'un brouillon : aucune erreur, le compte de la grille, et les règles du catalogue.
      if (!isExerciseId(id)) problems.push(`« ${id} » : identifiant illisible.`);
      for (const e of draftErrors(brouillon, tables)) problems.push(`« ${id} » : ${e.champ} : ${e.message}`);
      const total = brouillon.outils.reduce((sum, copy) => sum + copy.reussites_requises, 0);
      if (total !== questions) problems.push(`« ${id} » : ${total} questions, ${questions} attendues par la grille.`);
      for (const warning of deducibleWarnings(brouillon, { factor: factorSource(brouillon, tables.operations.operations) })) problems.push(`« ${id} » : une réponse se déduirait des grandeurs fournies — ${warning}`);
      if (brouillon.facteur_vitesse_donne !== undefined || brouillon.liste !== undefined || brouillon.groupes !== undefined) problems.push(`« ${id} » : le facteur est à trouver, l'exercice est à l'accueil et aucun groupe n'est restreint.`);
      for (const copy of brouillon.outils) {
        const origin = copy.origine ?? copy.id;
        const small = copy.dimensions.filter((d) => !(diameterOf(d) >= MIN_DRILL - 1e-9));
        if (small.length > 0) problems.push(`« ${id} », ${copy.id} : dimension sous Ø 1/16 po (${small.map((d) => d.libelle).join(', ')}).`);
        const expected = DRILL_EXPECTED[origin];
        if (expected && copy.dimensions[0]?.libelle !== expected.premiere) problems.push(`« ${id} », ${copy.id} : la première dimension est « ${copy.dimensions[0]?.libelle} », « ${expected.premiere} » attendue.`);
        if (expected?.nombre !== undefined && copy.dimensions.length !== expected.nombre) problems.push(`« ${id} », ${copy.id} : ${copy.dimensions.length} dimensions, ${expected.nombre} attendues.`);
        const state = speedFactorState(copy, opsByName.get(copy.operation));
        if ((state.mode === 'forced') !== FORCED_TOOLS.includes(origin)) problems.push(`« ${id} », ${copy.id} : facteur de vitesse ${state.mode === 'forced' ? 'forcé' : 'hérité'}, contre le catalogue.`);
        if (state.mode === 'forced' && (state.value !== 1 || state.reason !== SINGLE_INSERT_REASON)) problems.push(`« ${id} », ${copy.id} : facteur forcé × ${factorText(state.value)} (« ${state.reason} »), × 1 attendu avec la raison du catalogue.`);
        if (spec.avancesSeules && (AXIAL_TOOLS.includes(origin) || opsByName.get(copy.operation)?.direction_avance === 'Avance axiale')) problems.push(`« ${id} », ${copy.id} : outil axial dans un exercice d'avances du M10.`);
        if (spec.m10 && copy.dimensions.some((d) => /\bmm\b/.test(d.libelle) || /x/.test(String(d.valeur))) && /^(foret|sdtmr|barre_a_fileter|taraud)/.test(origin)) problems.push(`« ${id} », ${copy.id} : filetage ou foret métrique au M10.`);
        if (!exported.images.some((image) => image.id === copy.image && !image.archivee_le) && !Object.values(images).some((image) => image.id === copy.image)) problems.push(`« ${id} », ${copy.id} : la photo « ${copy.image} » est inconnue ou archivée.`);
      }
      if (spec.m10 && JSON.stringify(brouillon.materiaux_outil) !== JSON.stringify(M10_MATERIALS)) problems.push(`« ${id} » : au M10, les matières d'outil permises sont ${M10_MATERIALS.join(', ')}.`);
      if (!spec.m10 && brouillon.materiaux_outil !== undefined) problems.push(`« ${id} » : les trois matières d'outil sont permises.`);
      rows.push({ id, titre: brouillon.titre, cours: brouillon.cours, outils: brouillon.outils.map((copy) => ({ id: copy.id, nom: copy.nom, reussites: copy.reussites_requises, dimensions: copy.dimensions.length })), questions: total, etat: before === undefined ? 'ajouté' : (before.versions.length > 0 ? `brouillon remplacé (version ${before.versions.at(-1).numero} publiée, intacte)` : 'brouillon remplacé') });
    }
  }

  // Aucun outil forcé par le passage de D83 ne reste, ni dans la banque ni dans les copies.
  for (const tool of [...banque.map((entry) => entry.outil), ...exercices.flatMap((e) => e.brouillon.outils)]) if (tool.fact_vc_raison === PASSAGE_REASON) problems.push(`« ${tool.id} » porte encore « ${PASSAGE_REASON} ».`);

  // Les titres (D74) : tous différents dans le lot, et différents des titres en vigueur des AUTRES exercices publiés et
  // non archivés de l'export.
  const lotIds = new Set(exercices.map((e) => e.id));
  const inForce = exported.exercices.filter((e) => !lotIds.has(e.id)).map((e) => ({ id: e.id, archive_le: e.archive_le, titre: e.versions.length === 0 ? null : (e.presentation?.contenu?.titre ?? e.versions.at(-1).contenu.titre) }));
  const titles = exercices.map((e) => ({ id: e.id, titre: e.brouillon.titre, archive_le: null }));
  for (const e of exercices) {
    const twins = sameTitleExercises(e.brouillon.titre, [...inForce, ...titles], e.id);
    if (twins.length > 0) problems.push(`« ${e.id} » : le titre « ${e.brouillon.titre} » est aussi celui de ${twins.map((t) => t.id).join(', ')} (D74).`);
    if (titleKey(e.brouillon.titre) === '') problems.push(`« ${e.id} » : titre vide.`);
  }
  // Un exercice publié, non archivé, hors du lot, reste à l'accueil : il y fait son propre groupe si son cours n'est pas un de ceux du lot.
  for (const e of exported.exercices) {
    if (lotIds.has(e.id) || e.archive_le !== null || e.versions.length === 0) continue;
    const shown = { ...e.versions.at(-1).contenu, ...(isObject(e.presentation?.contenu) ? e.presentation.contenu : {}) };
    if (shown.liste !== false) notes.push(`« ${e.id} » (« ${shown.titre} », cours « ${shown.cours ?? '—'} »), publié et non archivé, n'est pas du lot : il reste à l'accueil.`);
  }

  const lot = {
    format: EXPORT_FORMAT,
    _lot: { decision: 'D84', catalogue: 'docs/lots/lot-exercices-2026-09.md', script: 'reference/lot-exercices/generer.mjs', export_source: exported.exporte_le ?? null, tables: tables.id },
    // Les tables des brouillons : si la base en a d'autres sous ce nom, l'import est refusé — rien ne doit avoir changé depuis l'export.
    tables_reference: [latest],
    banque,
    exercices,
    images: Object.values(images),
  };

  // Ce que le serveur ferait de ce fichier, avec son propre code (importPlan), sur une base dans l'état de l'export.
  const resume = dryRun(lot, exported, problems);
  if (resume !== null) {
    const expectedTools = new Set([...NEW_TOOLS.map((t) => t.id), ...Object.keys(MODIFIED_TOOLS), ...renommes]);
    for (const t of resume.banque.retires) problems.push(`Banque : l'outil « ${t.id} » disparaîtrait.`);
    for (const t of [...resume.banque.ajoutes, ...resume.banque.modifies]) if (!expectedTools.has(t.id)) problems.push(`Banque : l'outil « ${t.id} » changerait, hors du catalogue.`);
    for (const id of resume.versions_ajoutees) problems.push(`Une version publiée serait ajoutée : ${id}.`);
    if (resume.tables_ajoutees.length > 0 || resume.brouillon_tables || resume.presentation_remplacee) problems.push('Les tables, leur brouillon ou leur présentation changeraient.');
  }
  return { lot, resume: resume === null ? null : { ...resume, exercices: rows, operations_renommees: renommes, outils_nouveaux: nouveaux, tables: tables.id }, problemes: problems, remarques: notes };
}

// Le plan de l'import sur une base dans l'état de l'export, puis, une fois appliqué, le même import une seconde fois :
// il ne doit plus rien changer. Retourne le résumé du premier, ou null s'il a des erreurs (dites dans `problems`).
function dryRun(lot, exported, problems) {
  const fiches = { ...lot, images: lot.images.map(({ contenu: _c, ...fiche }) => fiche) };
  const existing = { tables_reference: exported.tables_reference, banque: exported.banque, exercices: exported.exercices, images: exported.images.map(({ contenu: _c, ...fiche }) => fiche), historique_banque: exported.historique_banque ?? [], presentation_tables: exported.presentation_tables };
  const rules = (images) => ({
    tablesErrors: (t) => validateTables({ materiaux: t.materiaux, operations: t.operations }),
    draftErrorsOf: (contenu, tables) => draftErrors(contenu, tablesOf(tables)),
    latestTablesId: exported.tables_reference.at(-1).id,
    exercisePresentationErrorsOf: (contenu) => exercisePresentationErrors(contenu, { images, archived: 'permis' }),
  });
  const first = importPlan(fiches, existing, rules([...existing.images, ...fiches.images]));
  for (const message of first.erreurs) problems.push(`Import : ${message}`);
  if (first.erreurs.length > 0) return null;

  // La base une fois l'import fait (base.applyImport, en mémoire).
  const after = {
    ...existing,
    banque: first.plan.banque.map(({ id, outil, rang, archive_le }) => ({ id, outil, rang, archive_le })),
    images: [...existing.images, ...fiches.images.filter((image) => first.resume.images_manquantes.includes(image.id))],
    exercices: [
      ...existing.exercices.map((e) => {
        const replaced = first.plan.exercices_remplaces.find((r) => r.id === e.id);
        const presentation = first.plan.presentations_exercices.find((p) => p.exercice_id === e.id)?.remplace?.apres;
        return replaced === undefined ? e : { ...e, brouillon: replaced.brouillon, tables_id: replaced.tables_id, archive_le: replaced.archive_le, presentation: presentation === undefined ? e.presentation : { ...e.presentation, contenu: presentation.contenu } };
      }),
      ...first.plan.exercices_ajoutes.map((e) => ({ id: e.id, brouillon: e.brouillon, tables_id: e.tables_id, archive_le: e.archive_le, versions: [], presentation: { contenu: null, modifiee_le: null, enseignant: null, historique: [] } })),
    ],
  };
  const second = importPlan(fiches, after, rules(after.images));
  for (const message of second.erreurs) problems.push(`Second import : ${message}`);
  const r = second.resume;
  if (r !== null) {
    const changes = [...r.banque.ajoutes.map((t) => t.id), ...r.banque.modifies.map((t) => t.id), ...r.banque.retires.map((t) => t.id), ...r.exercices_ajoutes, ...r.versions_ajoutees, ...r.images_manquantes, ...r.images_modifiees, ...r.presentations_exercices.map((p) => p.id), ...r.tables_ajoutees];
    for (const e of second.plan.exercices_remplaces) if (!sameContent(e.brouillon, after.exercices.find((x) => x.id === e.id).brouillon)) changes.push(e.id);
    if (changes.length > 0) problems.push(`Un second import du même fichier changerait encore : ${changes.join(', ')}.`);
  }
  return first.resume;
}

// =====================================================================================================================
// La commande
// =====================================================================================================================

export function readArguments(args) {
  const options = { source: null, images: null, sortie: null };
  for (let i = 0; i < args.length; i += 1) {
    if ((args[i] === '--images' || args[i] === '--sortie') && typeof args[i + 1] === 'string') {
      options[args[i].slice(2)] = args[i + 1];
      i += 1;
    } else if (!args[i].startsWith('--') && options.source === null) options.source = args[i];
    else throw new Error(`argument inconnu : « ${args[i] } »`);
  }
  if (options.source === null) throw new Error("L'export est requis :\n    node reference/lot-exercices/generer.mjs captures/lot-exercices/<export>.json [--images <dossier>] [--sortie <fichier>]");
  return options;
}

// Le résumé, en clair : ce que « Valider l'import » doit dire, puis le tableau des exercices.
export function summaryLines({ resume, remarques }) {
  const names = (list) => (list.length === 0 ? 'aucun' : list.map((t) => `${t.nom} (${t.id})`).join(', '));
  const b = resume.banque;
  return [
    `Tables des brouillons : ${resume.tables}.`,
    `Banque — ajoutés (${b.ajoutes.length}) : ${names(b.ajoutes)}.`,
    `Banque — modifiés (${b.modifies.length}) : ${names(b.modifies)}${resume.operations_renommees.length > 0 ? ` ; opération renommée : ${resume.operations_renommees.join(', ')}` : ''}.`,
    `Banque — inchangés : ${b.gardes} ; retirés : ${b.retires.length}.`,
    `Images — à envoyer : ${resume.images_manquantes.length === 0 ? 'aucune' : resume.images_manquantes.join(', ')} ; déjà dans la base : ${resume.images_presentes}.`,
    `Exercices ajoutés (${resume.exercices_ajoutes.length}) : ${resume.exercices_ajoutes.join(', ') || 'aucun'}.`,
    `Brouillons remplacés (${resume.exercices_remplaces.length}) : ${resume.exercices_remplaces.join(', ') || 'aucun'}.`,
    `Présentation en direct : ${resume.presentations_exercices.length === 0 ? 'inchangée' : resume.presentations_exercices.map((p) => `${p.id}${p.remplacee ? ' (remplacée, effet immédiat)' : ''}`).join(', ')}.`,
    `Exercices de la base gardés tels quels : ${resume.exercices_gardes.join(', ') || 'aucun'}.`,
    '',
    '| Identifiant | Titre | Cours | Outils | Réussites exigées | Questions |',
    '|---|---|---|---|---|---|',
    ...resume.exercices.map((e) => `| \`${e.id}\` | ${e.titre} | ${e.cours} | ${e.outils.length} | ${e.outils.map((o) => `${o.id} ${o.reussites}`).join(', ')} | ${e.questions} |`),
    ...(remarques.length === 0 ? [] : ['', 'Remarques :', ...remarques.map((note) => `- ${note}`)]),
  ];
}

function main() {
  const options = readArguments(process.argv.slice(2));
  const source = resolve(options.source);
  const folder = resolve(options.images ?? dirname(source));
  const target = resolve(options.sortie ?? join(dirname(source), 'import-lot.json'));
  if (target === source) throw new Error("Le fichier de sortie ne peut pas être l'export lui-même.");
  const exported = JSON.parse(readFileSync(source, 'utf8'));
  const files = new Map(Object.values(NEW_IMAGES).map(({ fichier }) => join(folder, fichier)).filter((path) => existsSync(path)).map((path) => [path.slice(folder.length + 1), new Uint8Array(readFileSync(path))]));

  const result = buildLot(exported, files);
  if (result.problemes.length > 0) {
    console.error(`Rien n'est écrit : ${result.problemes.length} problème(s).`);
    for (const problem of result.problemes) console.error(`- ${problem}`);
    process.exitCode = 1;
    return;
  }
  writeFileSync(target, `${JSON.stringify(result.lot, null, 2)}\n`);
  console.log(`Export du ${exported.exporte_le} → ${target}`);
  console.log(summaryLines(result).join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
