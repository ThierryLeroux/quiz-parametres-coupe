// Le code G d'avance d'un outil (décisions D96, D97) : G94 et G95 en fraisage, G98 et G99 en tournage (le système de
// codes G « A » de Fanuc, au tour). G95 et G99 sont l'avance PAR TOUR ; G94 et G98 l'avance PAR MINUTE. Depuis D97, il
// se règle SUR L'OUTIL — dans la banque, qui donne la valeur de départ, et sur chaque copie d'un exercice, qui se règle
// seule ensuite (`code_avance`, facultatif, comme `fact_vc`) : c'est la copie qui sait sur quelle machine l'outil
// travaille (le même foret est au tour au M10, à la perceuse au M30). Les tables de référence n'en portent aucun, et
// aucune règle n'est déduite de la machine ni de l'opération. Pour un outil en avance par tour, la vitesse d'avance Vf
// (po/min) est « sans objet » : ni demandée, ni corrigée, et sa valeur ne part jamais au navigateur. Le code sert aussi
// de lien avec le cours de CN : le nombre qu'on programme après F est f en G95/G99, Vf en G94/G98.
//
// Fonctions PURES, partagées par le serveur, le quiz et la Gestion du contenu : l'avance par tour ou par minute, ce
// que la vitesse d'avance devient pour un outil, la grandeur du mot F, la pastille, la ligne de programme et sa
// coordonnée, la validation du code d'un outil, l'erreur d'un exercice dont aucune grandeur évaluée ne s'applique à un
// outil, les choix de la Gestion du contenu, et le retrait d'un code resté dans le brouillon des tables (D96). Un outil
// sans code se comporte exactement comme avant D96.

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// --- Les codes ---------------------------------------------------------------------------------------------------------

export const FEED_CODES = ['G94', 'G95', 'G98', 'G99'];
const PER_REVOLUTION_CODES = ['G95', 'G99']; // avance par tour

export const isFeedCode = (value) => typeof value === 'string' && FEED_CODES.includes(value);
export const isPerRevolution = (code) => PER_REVOLUTION_CODES.includes(code);

// Un outil (de la banque, ou une copie) porte-t-il un code ? Absent : « aucune avance programmée », l'outil d'avant D96.
export const hasFeedCode = (tool) => isObject(tool) && tool.code_avance !== undefined;

// Le code d'un outil, ou null : aucun, ou une valeur illisible (la validation la dira ; en attendant, l'outil se lit
// comme s'il n'en avait pas).
export const feedCodeOf = (tool) => (hasFeedCode(tool) && isFeedCode(tool.code_avance) ? tool.code_avance : null);

// Les erreurs du code d'un outil : [{ champ, message }] (toolErrors, data.js). Absent : rien à dire.
export function feedCodeErrors(tool) {
  if (!hasFeedCode(tool) || isFeedCode(tool.code_avance)) return [];
  return [{ champ: 'code_avance', message: `« code_avance » doit être ${FEED_CODES.join(', ')}, ou absent (aucune avance programmée)` }];
}

// --- La vitesse d'avance d'un outil -------------------------------------------------------------------------------------

// La vitesse d'avance a-t-elle un sens pour cet outil ? Non en avance par tour (G95, G99) ; oui sinon, et toujours
// pour un outil sans code.
export const feedRateApplies = (tool) => !isPerRevolution(feedCodeOf(tool));

// Les grandeurs du moteur (correction.js) qui sont SANS OBJET pour un outil : ['feedRate'], ou rien. Un champ sans objet
// n'est ni demandé ni corrigé, quel que soit l'état que l'exercice lui donne (D52) : c'est une propriété de l'outil
// dans cet exercice, pas un réglage de l'exercice.
export const inapplicableFields = (tool) => (feedRateApplies(tool) ? [] : ['feedRate']);

// --- Ce que l'écran en dit (D93 : des phrases courtes) -------------------------------------------------------------------

// Le libellé de la pastille : « avance par tour » (G95, G99) ou « avance par minute » (G94, G98).
export const feedCodeLabel = (code) => (isPerRevolution(code) ? 'avance par tour' : 'avance par minute');

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

// La coordonnée de la ligne d'avance, d'après la direction d'avance de l'OPÉRATION (une lecture des tables, D97) :
// longitudinale → « Z… », transversale → « X… », axiale → « Z… », latérale → « X… Y… ». null pour une direction
// inconnue : pas de coordonnée.
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
//   code      : le code G d'avance de l'outil ; direction : la direction d'avance de son opération
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

// --- L'exercice (D96, décision, point 3 ; D97 : le code est celui de la copie) ---------------------------------------------

// Un exercice dont aucune grandeur évaluée ne s'applique à un de ses outils est invalide : « champs_evalues » réduit à
// « vf », avec une copie en avance par tour. Retourne le message, qui nomme les outils en cause, ou null.
//   graded : les champs évalués de l'exercice, tels qu'écrits (« vc », « fz », « n », « f », « vf »)
//   tools  : les outils de l'exercice (les copies, ou les outils du catalogue avec le code de leur entrée), avec nom et id
export function inapplicableGradedError(graded, tools) {
  const fields = Array.isArray(graded) ? graded.filter((field) => ['vc', 'fz', 'n', 'f', 'vf'].includes(field)) : [];
  if (fields.length === 0 || fields.some((field) => field !== 'vf')) return null;
  const named = (Array.isArray(tools) ? tools : []).filter((tool) => isObject(tool) && !feedRateApplies(tool)).map((tool) => `${tool.nom} (${tool.id})`);
  if (named.length === 0) return null;
  return `La seule grandeur évaluée, la vitesse d'avance, est sans objet pour ${named.join(', ')} : leur avance programmée est par tour (G95 ou G99). Évalue une autre grandeur, ou retire ces outils.`;
}

// --- La Gestion du contenu -------------------------------------------------------------------------------------------------

// Les choix de la liste « Avance programmée » du formulaire d'outil (banque et copie) : « Aucune », puis les quatre codes.
export const FEED_CODE_CHOICES = [
  { value: '', label: 'Aucune' },
  { value: 'G94', label: 'G94 · fraisage, par minute' },
  { value: 'G95', label: 'G95 · fraisage, par tour' },
  { value: 'G98', label: 'G98 · tour, par minute' },
  { value: 'G99', label: 'G99 · tour, par tour' },
];

// L'avance programmée d'un outil, en clair, pour les différences (publication, historique de la banque) : « aucune »,
// ou le code (« G99 »).
export const ownFeedCodeLabel = (tool) => feedCodeOf(tool) ?? 'aucune';

// L'outil (ou la copie) avec ce code — '' ou null : aucun, la clé disparaît. Ne modifie pas l'objet reçu ; la clé est rangée
// après `fact_av`, comme dans TOOL_KEYS.
export function withFeedCode(tool, code) {
  const { code_avance: _code, ...rest } = tool;
  if (!isFeedCode(code)) return rest;
  const out = {};
  let placed = false;
  for (const [key, value] of Object.entries(rest)) {
    out[key] = value;
    if (key === 'fact_av') { out.code_avance = code; placed = true; }
  }
  if (!placed) out.code_avance = code;
  return out;
}

// --- Le brouillon des tables (D97 : les tables ne portent plus de code) ----------------------------------------------------

// Un code resté dans le brouillon des tables enregistré sous D96 est ignoré à la lecture et retiré au prochain
// enregistrement, sans migration : le brouillon se lit identique à sa version de départ s'il n'a pas d'autre
// modification. Ne modifie pas l'objet reçu ; le rend tel quel s'il n'y a rien à retirer.
export function stripFeedCodes(tables) {
  const operations = tables?.operations?.operations;
  if (!Array.isArray(operations) || operations.every((op) => !isObject(op) || op.code_avance === undefined)) return tables;
  return {
    ...tables,
    operations: { ...tables.operations, operations: operations.map((op) => { if (!isObject(op) || op.code_avance === undefined) return op; const { code_avance: _code, ...rest } = op; return rest; }) },
  };
}
