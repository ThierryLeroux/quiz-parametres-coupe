// Le code G d'avance de chaque opération (décision D96) : G94 et G95 en fraisage, G98 et G99 en tournage (le système
// de codes G « A » de Fanuc, au tour). G95 et G99 sont l'avance PAR TOUR ; G94 et G98 l'avance PAR MINUTE. Il appartient
// à l'OPÉRATION, dans les tables de référence (`code_avance`), versionné comme les avances, sur le modèle du facteur
// de vitesse (D83). Pour un outil dont l'opération est en avance par tour, la vitesse d'avance Vf (po/min) est « sans
// objet » : ni demandée, ni corrigée, et sa valeur ne part jamais au navigateur. Le code sert aussi de lien avec le
// cours de CN : le nombre qu'on programme après F est f en G95/G99, Vf en G94/G98.
//
// Fonctions PURES, partagées par le serveur, le quiz et la Gestion du contenu : l'avance par tour ou par minute, ce
// que la vitesse d'avance devient pour un outil, la grandeur du mot F, la pastille, la ligne de programme et sa
// coordonnée, le préremplissage du brouillon des tables, l'avertissement machine, l'erreur d'un exercice dont aucune
// grandeur évaluée ne s'applique à un outil. Une version de tables d'avant D96 n'a aucun code, et n'en reçoit pas à la
// lecture : ses exercices se corrigent et s'affichent comme avant.

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// --- Les codes ---------------------------------------------------------------------------------------------------------

export const FEED_CODES = ['G94', 'G95', 'G98', 'G99'];
const PER_REVOLUTION_CODES = ['G95', 'G99']; // avance par tour
const LATHE_CODES = ['G98', 'G99']; // le système A de Fanuc, au tour
export const LATHE_MACHINE = 'Tour'; // la machine-outil des opérations du tour, dans les tables (un texte libre)

export const isFeedCode = (value) => typeof value === 'string' && FEED_CODES.includes(value);
export const isPerRevolution = (code) => PER_REVOLUTION_CODES.includes(code);
export const isLatheCode = (code) => LATHE_CODES.includes(code);

// Une opération porte-t-elle son code ? Une version de tables d'avant D96 n'en a aucun, et n'en reçoit pas à la
// lecture : on ne montre jamais un code — ni une case « sans objet » — qui contredirait la correction de sa version.
export const hasFeedCode = (operation) => isObject(operation) && operation.code_avance !== undefined;

// Des tables « portent les codes » quand CHACUNE de leurs opérations a le sien (la validation refuse l'entre-deux).
export const carriesFeedCodes = (operations) => Array.isArray(operations) && operations.length > 0 && operations.every(hasFeedCode);

// Le code d'une opération, ou null : pas de code (une version d'avant), opération inconnue, ou valeur illisible (la
// validation la dira ; en attendant, l'outil se lit comme avant).
export const feedCodeOf = (operation) => (hasFeedCode(operation) && isFeedCode(operation.code_avance) ? operation.code_avance : null);

// --- La vitesse d'avance d'un outil -------------------------------------------------------------------------------------

// La vitesse d'avance a-t-elle un sens pour l'opération ? Non en avance par tour (G95, G99) ; oui sinon, et toujours
// pour une version d'avant D96.
export const feedRateApplies = (operation) => !isPerRevolution(feedCodeOf(operation));

// Les grandeurs du moteur (correction.js) qui sont SANS OBJET pour un outil de cette opération : ['feedRate'], ou rien.
// Un champ sans objet n'est ni demandé ni corrigé, quel que soit l'état que l'exercice lui donne (D52) : c'est une
// propriété de l'opération, pas un réglage.
export const inapplicableFields = (operation) => (feedRateApplies(operation) ? [] : ['feedRate']);

// --- Ce que l'écran en dit (D93 : des phrases courtes) -------------------------------------------------------------------

// Le libellé de la pastille : « avance par tour » (G95, G99) ou « avance par minute » (G94, G98) ; en court, sur la
// feuille des avances : « par tour », « par minute ».
export const feedCodeLabel = (code) => (isPerRevolution(code) ? 'avance par tour' : 'avance par minute');
export const feedCodeShortLabel = (code) => (isPerRevolution(code) ? 'par tour' : 'par minute');

// La pastille en une ligne : « G99 · avance par tour ».
export const feedCodeText = (code) => `${code} · ${feedCodeLabel(code)}`;

// La grandeur qu'on programme après le mot F (correction.js) : f en G95/G99, Vf en G94/G98.
export const fWordField = (code) => (isPerRevolution(code) ? 'feedPerRev' : 'feedRate');

// L'étiquette « mot F » se montre dès la question, avant « Vérifier » (D96, visuel, point 2 : un essai, à évaluer en
// classe). Pour la réserver au corrigé, mettre cette constante à false : rien d'autre à changer.
export const F_WORD_FROM_QUESTION = true;
export const F_WORD_LABEL = 'mot F';

// L'étiquette est-elle montrée à cette étape de l'écran : 'question' (avant « Vérifier ») ou 'corrige' (après) ?
export const fWordShown = (stage) => stage === 'corrige' || (stage === 'question' && F_WORD_FROM_QUESTION);

// La case Vf d'un outil en avance par tour : « sans objet », et sa note.
export const NOT_APPLICABLE = 'sans objet';
export const NOT_APPLICABLE_SHORT = 's.o.'; // dans la colonne Vf de l'attestation
export const notApplicableNote = (code) => `En ${code}, F est l'avance par tour.`;

// --- La ligne de programme (corrigé seulement) ---------------------------------------------------------------------------

// La coordonnée de la ligne d'avance, d'après la direction d'avance de l'opération : longitudinale → « Z… »,
// transversale → « X… », axiale → « Z… », latérale → « X… Y… ». null pour une direction inconnue : pas de coordonnée.
// ❓ Direction inconnue (une opération ajoutée avec une direction libre) : aucune coordonnée, la ligne garde G01 et F.
export function programCoordinate(direction) {
  const text = String(direction ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (text.includes('longitudinal') || text.includes('axial')) return 'Z…';
  if (text.includes('transversal')) return 'X…';
  if (text.includes('lateral')) return 'X… Y…';
  return null;
}

// Les deux lignes recomposées à partir des valeurs théoriques mises en forme (SPEC §5) : « G97 S1000 M03 », puis
// « G99 G01 Z… F0.0100 » (au tour) ou « G94 G01 X… Y… F28.800 » (fraiseuse). Chaque ligne est une liste de morceaux
// { texte, role } — role 'coordonnee' (en gris atténué) ou 'mot_f' (en doré) ; les autres sans rôle. Une grandeur masquée
// (D52) s'écrit « — », et sa valeur ne part pas.
//   code      : le code G d'avance de l'opération ; direction : sa direction d'avance
//   displayed : formatParameters des valeurs théoriques ({ rpm, feedPerRev, feedRate, … })
//   masked    : les grandeurs masquées de l'exercice, sous les noms du moteur
// Retourne { code, lignes: [[morceaux], [morceaux]], note }.
export function programLines(code, direction, displayed, masked = []) {
  const value = (field) => (masked.includes(field) ? '—' : displayed[field]);
  const field = fWordField(code);
  const coordinate = programCoordinate(direction);
  return {
    code,
    lignes: [
      [{ texte: `G97 S${value('rpm')} M03` }],
      [{ texte: `${code} G01 ` }, ...(coordinate === null ? [] : [{ texte: coordinate, role: 'coordonnee' }, { texte: ' ' }]), { texte: `F${value(field)}`, role: 'mot_f' }],
    ],
    note: isPerRevolution(code) ? 'S = N. F = f, en po/tour.' : 'S = N. F = Vf, en po/min.',
  };
}

// --- Le brouillon des tables ---------------------------------------------------------------------------------------------

// Le code de départ d'une opération (D96, correction, point 2) : G99 pour une opération de machine « Tour », G94 pour
// toutes les autres. Thierry révise dans la Gestion du contenu avant de publier.
export const paperFeedCode = (machine) => (machine === LATHE_MACHINE ? 'G99' : 'G94');

// Le brouillon des tables prérempli : une opération SANS la clé `code_avance` reçoit son code de départ ; une valeur
// présente, même fausse, est gardée (la validation la dira). Sert à la lecture du brouillon, jamais à celle d'une
// version publiée. Ne modifie pas l'objet reçu ; le rend tel quel s'il n'y a rien à préremplir.
export function prefillFeedCodes(tables) {
  const operations = tables?.operations?.operations;
  if (!Array.isArray(operations) || operations.every((op) => !isObject(op) || hasFeedCode(op))) return tables;
  return {
    ...tables,
    operations: { ...tables.operations, operations: operations.map((op) => (!isObject(op) || hasFeedCode(op) ? op : { ...op, code_avance: paperFeedCode(op.machine) })) },
  };
}

// L'avertissement machine (D96, décision, point 2), non bloquant : un G98/G99 sur une opération dont la machine n'est
// pas « Tour », un G94/G95 sur une opération du tour. Retourne une phrase par opération en cause, dans l'ordre des tables.
export function feedCodeWarnings(operations) {
  const warnings = [];
  for (const op of Array.isArray(operations) ? operations : []) {
    const code = feedCodeOf(op);
    if (code === null) continue;
    const lathe = op.machine === LATHE_MACHINE;
    if (isLatheCode(code) && !lathe) warnings.push(`Opération « ${op.operation} » : ${code} est un code du tour, mais sa machine est « ${op.machine ?? '—'} ».`);
    else if (!isLatheCode(code) && lathe) warnings.push(`Opération « ${op.operation} » : ${code} est un code de fraisage, mais sa machine est « ${op.machine} ».`);
  }
  return warnings;
}

// --- L'exercice (D96, décision, point 3) -----------------------------------------------------------------------------------

// Un exercice dont aucune grandeur évaluée ne s'applique à un de ses outils est invalide : « champs_evalues » réduit à
// « vf », avec un outil dont l'opération est en avance par tour. Retourne le message, qui nomme les outils en cause,
// ou null.
//   graded    : les champs évalués de l'exercice, tels qu'écrits (« vc », « fz », « n », « f », « vf »)
//   tools     : les outils de l'exercice (les copies, ou les outils du catalogue), avec nom, id et operation
//   opsByName : Map nom d'opération → opération des tables de l'exercice
export function inapplicableGradedError(graded, tools, opsByName) {
  const fields = Array.isArray(graded) ? graded.filter((field) => ['vc', 'fz', 'n', 'f', 'vf'].includes(field)) : [];
  if (fields.length === 0 || fields.some((field) => field !== 'vf')) return null;
  const named = (Array.isArray(tools) ? tools : []).filter((tool) => isObject(tool) && !feedRateApplies(opsByName.get(tool.operation))).map((tool) => `${tool.nom} (${tool.id})`);
  if (named.length === 0) return null;
  return `La seule grandeur évaluée, la vitesse d'avance, est sans objet pour ${named.join(', ')} : leur opération est en avance par tour (G95 ou G99). Évalue une autre grandeur, ou retire ces outils.`;
}
