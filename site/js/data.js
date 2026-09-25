// Données de référence : lecture des JSON de site/data/ (SPEC §3).
// Tout ce qui interprète le contenu brut des JSON (libellés, filetages,
// conversions mm → po) vit ici ; le reste du moteur ne voit que des pouces.

const MM_PER_INCH = 25.4;

// Matériau d'outil tel qu'écrit dans outils.json → clé de `vc_pi_min` dans materiaux.json.
export const TOOL_MATERIAL_KEYS = {
  'Acier rapide': 'acier_rapide',
  'Carbure de tungstène solide': 'carbure_solide',
  'Insert de carbure de tungstène': 'insert_carbure',
};

const NUMBER = String.raw`(\d*\.?\d+)`; // accepte « 0.25 », « .3125 » et « 1 »
const IMPERIAL_THREAD = new RegExp(`^${NUMBER}-(\\d+)$`); // Ø (po) - filets au pouce
const METRIC_THREAD = new RegExp(`^${NUMBER}x${NUMBER}$`); // Ø (mm) x pas (mm)

// Interprète la valeur d'une dimension de filetage (SPEC §4.3) :
//   « 0.25-20 » → Ø 0,25 po, pas = 1/20 po
//   « 10x1.5 »  → Ø 10/25,4 po, pas = 1,5/25,4 po
// Retourne { diameter, pitch } en pouces, ou null si la valeur est illisible.
export function parseThread(valeur) {
  if (typeof valeur !== 'string') return null;

  let diameter;
  let pitch;
  const imperial = IMPERIAL_THREAD.exec(valeur);
  const metric = METRIC_THREAD.exec(valeur);
  if (imperial) {
    diameter = Number(imperial[1]);
    pitch = 1 / Number(imperial[2]);
  } else if (metric) {
    diameter = Number(metric[1]) / MM_PER_INCH;
    pitch = Number(metric[2]) / MM_PER_INCH;
  } else {
    return null;
  }

  // Un Ø nul, un pas nul ou « 0 filet au pouce » (pas infini) n'ont pas de sens.
  if (!(diameter > 0) || !(pitch > 0) || !Number.isFinite(pitch)) return null;
  return { diameter, pitch };
}

// Jetons du gabarit de nom d'un outil, « format_identifiant » (SPEC §4.6, décision D24) — ceux du
// classeur (clsOutil.instIdOutil) qui ont un sens ici. question.js donne leur valeur au tirage.
export const TEMPLATE_TOKENS = ['IdDia', 'Dia', 'Pas', 'IdBarre', 'NbDent', 'NomOutil', 'Matoutil', 'Operation'];

// Les jetons d'un gabarit : « Alésoir [IdDia] - [NbDent] lèvres » → ['IdDia', 'NbDent'].
export const templateTokens = (template) => [...template.matchAll(/\[([^\]]*)\]/g)].map((match) => match[1]);

// ---------------------------------------------------------------------------
// Validation croisée des trois JSON
// ---------------------------------------------------------------------------

const ISO_CLASSES = ['P', 'M', 'K', 'N', 'S', 'H', 'O'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isPositive = (v) => Number.isFinite(v) && v > 0;
const isInteger = (v, min) => Number.isInteger(v) && v >= min;

// Retourne file[key] si c'est un tableau non vide ; sinon note l'erreur et retourne [].
function listOf(file, key, fileName, errors) {
  const list = isObject(file) ? file[key] : undefined;
  if (Array.isArray(list) && list.length > 0) return list;
  errors.push(`${fileName} : la liste « ${key} » est absente ou vide`);
  return [];
}

// Note une erreur pour chaque valeur présente plus d'une fois.
function checkUnique(values, what, errors) {
  const seen = new Set();
  for (const v of values) {
    if (seen.has(v)) errors.push(`${what} en double : « ${v} »`);
    seen.add(v);
  }
}

// Vérifie la cohérence des trois fichiers de données, pris ensemble.
// Reçoit le contenu complet de chaque JSON ; retourne la liste de TOUTES les
// erreurs trouvées, en français (liste vide = données valides). Ne lève jamais
// d'exception : c'est loadData qui décide quoi faire des erreurs.
export function validateData({ materiaux, operations, outils }) {
  const errors = [];
  const groups = listOf(materiaux, 'groupes_iso', 'materiaux.json', errors);
  const materials = listOf(materiaux, 'materiaux', 'materiaux.json', errors);
  const ops = listOf(operations, 'operations', 'operations.json', errors);
  const tools = listOf(outils, 'outils', 'outils.json', errors);

  // Révision des tables de référence, affichée au pied des feuilles (décision D28).
  if (!isText(materiaux?.revision)) errors.push('materiaux.json : « revision » doit être un texte non vide (ex. « A2026_r0 »)');
  if (!isText(operations?.revision)) errors.push('operations.json : « revision » doit être un texte non vide (ex. « A2026_r0 »)');

  validateMaterials(materials, groups, errors);
  validateOperations(ops, errors);
  validateTools(tools, ops, groups, errors);
  return errors;
}

function validateMaterials(materials, groups, errors) {
  materials.forEach((m, i) => {
    if (!isObject(m)) return errors.push(`materiaux[${i}] : n'est pas un objet`);
    const where = `materiaux[${i}] (groupe ${m.groupe})`;

    if (!isInteger(m.groupe, 1)) errors.push(`${where} : « groupe » doit être un entier ≥ 1`);
    if (!ISO_CLASSES.includes(m.iso)) errors.push(`${where} : classe « iso » inconnue : « ${m.iso} »`);
    if (!isText(m.materiau)) errors.push(`${where} : « materiau » est vide`);
    else if (!groups.includes(`${m.iso} - ${m.materiau}`)) {
      errors.push(`${where} : « ${m.iso} - ${m.materiau} » est absent de « groupes_iso »`);
    }
    // Trait de la feuille des vitesses de coupe au-dessus de ce matériau (décision D27).
    if (m.debut_famille !== undefined && typeof m.debut_famille !== 'boolean') errors.push(`${where} : « debut_famille » doit être true ou false (ou absent)`);
    for (const key of Object.values(TOOL_MATERIAL_KEYS)) {
      if (!isPositive(m.vc_pi_min?.[key])) errors.push(`${where} : « vc_pi_min.${key} » doit être un nombre > 0`);
    }
  });
  checkUnique(materials.filter(isObject).map((m) => m.groupe), 'materiaux.json : groupe', errors);

  // Un groupe sans matériau rendrait impossible le tirage du matériau brut (SPEC §4.5).
  for (const group of groups) {
    const used = materials.some((m) => isObject(m) && `${m.iso} - ${m.materiau}` === group);
    if (!used) errors.push(`materiaux.json : le groupe « ${group} » ne contient aucun matériau`);
  }
}

function validateOperations(ops, errors) {
  ops.forEach((op, i) => {
    if (!isObject(op)) return errors.push(`operations[${i}] : n'est pas un objet`);
    const where = `operations[${i}] « ${op.operation} »`;

    if (!isText(op.operation)) errors.push(`${where} : « operation » est vide`);
    for (const flag of ['avance_egale_pas_filetage', 'avance_proportionnelle_diametre']) {
      if (typeof op[flag] !== 'boolean') errors.push(`${where} : « ${flag} » doit être true ou false`);
    }

    if (op.avance_egale_pas_filetage === true) {
      // Filetage : l'avance est le pas, tiré de la dimension de l'outil.
      if (op.avance_po_rev !== null) errors.push(`${where} : filetage, donc « avance_po_rev » doit être null`);
      if (op.avance_proportionnelle_diametre === true) errors.push(`${where} : ne peut pas être à la fois filetage et proportionnelle au Ø`);
    } else {
      if (!isPositive(op.avance_po_rev)) errors.push(`${where} : « avance_po_rev » doit être un nombre > 0`);
      if (!isPositive(op.avance_max_po_rev)) errors.push(`${where} : « avance_max_po_rev » doit être un nombre > 0`);
      else if (op.avance_max_po_rev < op.avance_po_rev) errors.push(`${where} : « avance_max_po_rev » est plus petite que « avance_po_rev »`);
    }
  });
  checkUnique(ops.filter(isObject).map((op) => op.operation), 'operations.json : opération', errors);
}

function validateTools(tools, ops, groups, errors) {
  const opsByName = new Map(ops.filter(isObject).map((op) => [op.operation, op]));

  tools.forEach((tool, i) => {
    if (!isObject(tool)) return errors.push(`outils[${i}] : n'est pas un objet`);
    const where = `outils[${i}] « ${tool.nom} »`;
    for (const error of toolErrors(tool, opsByName, groups)) errors.push(`${where} : ${error.message}`);
  });
  checkUnique(tools.filter(isObject).map((tool) => tool.id), 'outils.json : id', errors);
}

// Les clés d'un outil, au format d'outils.json — celles que l'éditeur (jalon 7) montre et enregistre.
// « colonne_excel » est la provenance (classeur) ; « limite_avance » n'est pas utilisée par le moteur (SPEC §3).
export const TOOL_KEYS = [
  'id', 'colonne_excel', 'nom', 'format_identifiant', 'commentaire', 'operation', 'fact_vc', 'fact_av', 'limite_rpm', 'limite_avance',
  'nb_dents_min', 'nb_dents_max', 'materiaux_outil', 'groupes_materiaux_usinables', 'image', 'dimensions', 'dimensions_barre', 'rapport_barre_max',
];

// Les erreurs d'UN outil, chacune avec le champ en cause : [{ champ, message }]. C'est la règle que
// validateData applique à chaque outil du catalogue, et que l'éditeur applique en continu à un
// outil de la banque ou à une copie dans un exercice, pour écrire l'erreur à côté du champ (jalon 7).
//   tool      : l'outil, au format d'outils.json (un objet)
//   opsByName : Map nom d'opération → opération (celles des tables de référence)
//   groups    : les groupes ISO des tables (« P - Acier non allié »…)
// Ne lève jamais d'exception ; liste vide = outil valide.
export function toolErrors(tool, opsByName, groups) {
  const errors = [];
  const error = (champ, message) => errors.push({ champ, message });
  if (!isObject(tool)) return [{ champ: '', message: "n'est pas un objet" }];

  for (const key of ['id', 'nom', 'format_identifiant']) {
    if (!isText(tool[key])) error(key, `« ${key} » est vide`);
  }
  for (const key of ['fact_vc', 'fact_av', 'limite_rpm']) {
    if (!isPositive(tool[key])) error(key, `« ${key} » doit être un nombre > 0`);
  }
  // Les tarauds n'ont pas de limite d'avance : l'avance est imposée par le pas.
  if (tool.limite_avance !== null && !isPositive(tool.limite_avance)) error('limite_avance', '« limite_avance » doit être un nombre > 0 ou null');
  // Le catalogue ne sait rien des exercices (décision D11).
  if ('reussites_requises' in tool) error('reussites_requises', "« reussites_requises » n'est plus une propriété d'outil ; elle se règle dans site/exercices/<id>.json");
  if (!isInteger(tool.nb_dents_min, 1) || !isInteger(tool.nb_dents_max, 1)) error('nb_dents_min', '« nb_dents_min » et « nb_dents_max » doivent être des entiers ≥ 1');
  else if (tool.nb_dents_max < tool.nb_dents_min) error('nb_dents_max', '« nb_dents_max » est plus petit que « nb_dents_min »');

  const toolMaterials = Array.isArray(tool.materiaux_outil) ? tool.materiaux_outil : [];
  if (toolMaterials.length === 0) error('materiaux_outil', '« materiaux_outil » est absent ou vide');
  for (const name of toolMaterials) {
    if (!(name in TOOL_MATERIAL_KEYS)) error('materiaux_outil', `matériau d'outil inconnu : « ${name} »`);
  }
  // Un doublon fausserait le tirage uniforme (SPEC §4) sans que ça se voie.
  for (const dup of duplicates(toolMaterials)) error('materiaux_outil', `matériau d'outil en double : « ${dup} »`);

  const toolGroups = Array.isArray(tool.groupes_materiaux_usinables) ? tool.groupes_materiaux_usinables : [];
  if (toolGroups.length === 0) error('groupes_materiaux_usinables', '« groupes_materiaux_usinables » est absent ou vide');
  for (const group of toolGroups) {
    if (!groups.includes(group)) error('groupes_materiaux_usinables', `groupe de matériaux inconnu : « ${group} »`);
  }
  for (const dup of duplicates(toolGroups)) error('groupes_materiaux_usinables', `groupe de matériaux en double : « ${dup} »`);

  const op = opsByName.get(tool.operation);
  if (!op) error('operation', `opération inconnue : « ${tool.operation} »`);

  // fact_av ne sert qu'aux avances proportionnelles au Ø (SPEC §5). Ailleurs, le moteur
  // l'ignorerait en silence : on refuse, plutôt que de laisser croire qu'il a un effet.
  if (op && !op.avance_proportionnelle_diametre && isPositive(tool.fact_av) && tool.fact_av !== 1) {
    error('fact_av', `« fact_av » vaut ${tool.fact_av}, mais l'opération « ${op.operation} » n'est pas proportionnelle au Ø : le facteur serait ignoré (mettre 1)`);
  }

  const dimensions = Array.isArray(tool.dimensions) ? tool.dimensions : [];
  if (dimensions.length === 0) error('dimensions', '« dimensions » est absent ou vide');
  dimensions.forEach((d, j) => {
    if (!isObject(d) || !isText(d.libelle)) return error('dimensions', `dimensions[${j}] n'a pas de « libelle »`);
    if (!op) return; // sans opération connue, impossible de savoir si c'est un filetage
    if (op.avance_egale_pas_filetage) {
      if (parseThread(d.valeur) === null) error('dimensions', `dimension « ${d.libelle} » : filetage illisible : « ${d.valeur} » (attendu « 0.25-20 » ou « 10x1.5 »)`);
    } else if (!isPositive(d.valeur)) {
      error('dimensions', `dimension « ${d.libelle} » : « valeur » doit être un Ø en pouces > 0`);
    }
  });
  // Les exercices restreignent les dimensions par leur libellé (SPEC §10) : il doit être unique.
  for (const dup of duplicates(dimensions.filter(isObject).map((d) => d.libelle))) error('dimensions', `libellé de dimension en double : « ${dup} »`);

  barErrors(tool, op, error);

  // Gabarit du nom (D24) : un jeton inconnu, ou sans valeur pour cet outil, serait affiché à l'étudiant ;
  // un crochet ouvert sans être fermé aussi (D58 : le gabarit s'édite).
  if (isText(tool.format_identifiant) && (tool.format_identifiant.match(/\[/g) ?? []).length !== (tool.format_identifiant.match(/\]/g) ?? []).length) {
    error('format_identifiant', 'crochet « [ » ou « ] » non apparié dans « format_identifiant »');
  }
  for (const token of isText(tool.format_identifiant) ? templateTokens(tool.format_identifiant) : []) {
    if (!TEMPLATE_TOKENS.includes(token)) error('format_identifiant', `jeton inconnu dans « format_identifiant » : [${token}] (jetons permis : ${TEMPLATE_TOKENS.join(', ')})`);
    else if (token === 'Pas' && op && !op.avance_egale_pas_filetage) error('format_identifiant', "le jeton [Pas] n'a de sens que pour un outil de filetage");
    else if (token === 'IdBarre' && tool.dimensions_barre === undefined) error('format_identifiant', 'le jeton [IdBarre] exige « dimensions_barre »');
  }
  return errors;
}

// Les valeurs présentes plus d'une fois, chacune une fois par répétition.
function duplicates(values) {
  const seen = new Set();
  const found = [];
  for (const v of values) {
    if (seen.has(v)) found.push(v);
    seen.add(v);
  }
  return found;
}

// Outil à deux diamètres (décision D25) : « dimensions » est le Ø usiné, qui sert à N ;
// « dimensions_barre » est le Ø de l'outil lui-même, qui sert à l'avance proportionnelle. La barre
// doit entrer dans le trou : Ø barre ≤ rapport_barre_max × Ø usiné. Les deux clés vont ensemble.
function barErrors(tool, op, error) {
  if (tool.dimensions_barre === undefined && tool.rapport_barre_max === undefined) return;
  const bars = Array.isArray(tool.dimensions_barre) ? tool.dimensions_barre : [];
  if (bars.length === 0) error('dimensions_barre', '« dimensions_barre » doit être une liste non vide (ou être absente)');
  if (!isPositive(tool.rapport_barre_max) || tool.rapport_barre_max > 1) error('rapport_barre_max', '« rapport_barre_max » doit être un nombre > 0 et ≤ 1 (ex. 0.75)');
  if (op && !op.avance_proportionnelle_diametre) error('dimensions_barre', `« dimensions_barre » ne sert qu'à une avance proportionnelle au Ø ; l'opération « ${op.operation} » ne l'est pas`);
  bars.forEach((bar, j) => {
    if (!isObject(bar) || !isText(bar.libelle)) error('dimensions_barre', `dimensions_barre[${j}] n'a pas de « libelle »`);
    else if (!isPositive(bar.valeur)) error('dimensions_barre', `barre « ${bar.libelle} » : « valeur » doit être un Ø en pouces > 0`);
  });
  for (const dup of duplicates(bars.filter(isObject).map((bar) => bar.libelle))) error('dimensions_barre', `libellé de barre en double : « ${dup} »`);
  for (const d of isPositive(tool.rapport_barre_max) && Array.isArray(tool.dimensions) ? tool.dimensions : []) {
    if (isObject(d) && isPositive(d.valeur) && fittingBars(tool, d.valeur).length === 0) error('dimensions', `dimension « ${d.libelle} » : aucune barre n'y entre (Ø barre ≤ ${tool.rapport_barre_max} × Ø)`);
  }
}

// Les barres d'un outil à deux diamètres qui entrent dans un trou de Ø `diameter` (D25).
export function fittingBars(tool, diameter) {
  const bars = Array.isArray(tool.dimensions_barre) ? tool.dimensions_barre : [];
  return bars.filter((bar) => isObject(bar) && isPositive(bar.valeur) && bar.valeur <= tool.rapport_barre_max * diameter + 1e-9);
}

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

// Lecteur par défaut (navigateur) : télécharge un JSON et le décode. Sert aussi à exercice.js.
export async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Impossible de charger ${url} (HTTP ${response.status})`);
  try {
    return await response.json();
  } catch (cause) {
    throw new Error(`${url} n'est pas un JSON valide : ${cause.message}`, { cause });
  }
}

// Charge les trois JSON, les valide, puis retourne les données prêtes à l'emploi :
//   materiaux, operations, outils : les tableaux (sans les en-têtes « _source », etc.)
//   operationByName  : Map nom d'opération → opération
//   materialsByGroup : Map « P - Acier non allié » → matériaux de ce groupe (tirage SPEC §4.5)
//   revisions        : { materiaux, operations } — révision de chaque table, pour le pied des feuilles (D28)
// Lève une erreur qui énumère tous les problèmes si les données sont invalides.
// `readJson` est injectable : les tests Node y passent un lecteur de fichiers.
export async function loadData(baseUrl = 'data/', readJson = fetchJson) {
  const [materiaux, operations, outils] = await Promise.all([
    readJson(`${baseUrl}materiaux.json`),
    readJson(`${baseUrl}operations.json`),
    readJson(`${baseUrl}outils.json`),
  ]);
  return assembleData({ materiaux, operations }, outils.outils);
}

// Le catalogue prêt à l'emploi (la même forme que loadData) à partir d'objets déjà lus : les deux
// tables de référence (contenu de materiaux.json et d'operations.json, tels quels) et une liste
// d'outils. Depuis le jalon 7, c'est ainsi que le serveur et le navigateur composent le catalogue
// d'une séance : les tables d'une version de référence, et les copies d'outils de l'exercice.
// Valide tout (validateData) ; lève une erreur qui énumère les problèmes.
export function assembleData({ materiaux, operations }, outils) {
  const errors = validateData({ materiaux, operations, outils: { outils } });
  if (errors.length > 0) throw new Error(`Données invalides :\n- ${errors.join('\n- ')}`);

  const operationByName = new Map(operations.operations.map((op) => [op.operation, op]));
  const materialsByGroup = new Map(materiaux.groupes_iso.map((group) => [group, []]));
  for (const m of materiaux.materiaux) materialsByGroup.get(`${m.iso} - ${m.materiau}`).push(m);

  return {
    materiaux: materiaux.materiaux,
    operations: operations.operations,
    outils,
    operationByName,
    materialsByGroup,
    revisions: { materiaux: materiaux.revision, operations: operations.revision },
  };
}
