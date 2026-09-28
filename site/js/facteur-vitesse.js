// Le facteur de modification de la vitesse de rotation (décision D83) : « N = Vc × 4 / Ø × facteur ». Il appartient à
// l'OPÉRATION, dans les tables de référence (`facteur_vitesse` : 1, 1/4, 1/8…), et l'outil en hérite, comme sa Vc vient
// de la table des vitesses. Un outil peut le FORCER : il porte alors son propre facteur (`fact_vc`) et la raison
// (`fact_vc_raison`), et l'étudiant le voit toujours. Avant D83, chaque outil portait son `fact_vc`, tapé à la main :
// ce qui existe — une version de tables sans facteurs et les copies d'outils des versions publiées — se lit et se
// corrige exactement comme avant.
//
// Fonctions PURES, partagées par le serveur, le quiz et la Gestion du contenu : le facteur qui sert au calcul, l'état
// d'un outil (hérité, forcé, propre), le passage d'un ancien outil, l'écriture en fraction, la lecture d'une saisie
// (« 1/4 » comme « 0.25 »), la table papier qui préremplit le brouillon des tables, ce que la question en dit.

import { evaluateExpression } from './expression.js';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isPositive = (v) => Number.isFinite(v) && v > 0;

// --- Les tables ---------------------------------------------------------------------------------------------------------

// Une opération porte-t-elle son facteur ? Une version de tables d'avant D83 (« A2026_r0 ») n'en a aucun, et n'en
// reçoit pas à la lecture : on ne montre jamais une feuille qui contredirait la correction de sa version.
export const hasSpeedFactor = (operation) => isObject(operation) && operation.facteur_vitesse !== undefined;

// Des tables « portent les facteurs » quand CHACUNE de leurs opérations a le sien (la validation refuse l'entre-deux).
export const carriesSpeedFactors = (operations) => Array.isArray(operations) && operations.length > 0 && operations.every(hasSpeedFactor);

// La table papier de l'atelier, « Modification du RPM en fonction de l'opération » (D83, point 2) : les opérations
// réduites ; toutes les autres valent 1. Chambrage et Moletage, qui y figurent, ne sont pas des opérations des tables.
export const PAPER_FACTORS = {
  'Tronçonnage': 0.125,
  'Rainurage externe': 0.25,
  'Rainurage interne': 0.25,
  "Alésage à l'alésoir": 0.25,
  'Chanfreinage': 0.25,
  'Chanfreinage / ébavurage': 0.25,
};
export const paperFactor = (operationName) => PAPER_FACTORS[operationName] ?? 1;

// Le brouillon des tables prérempli (D83, point 2) : une opération SANS la clé `facteur_vitesse` reçoit la valeur de
// la table papier ; une valeur présente, même fausse, est gardée (la validation la dira). Sert à la lecture du
// brouillon, jamais à celle d'une version publiée. Ne modifie pas l'objet reçu.
export function prefillSpeedFactors(tables) {
  const operations = tables?.operations?.operations;
  if (!Array.isArray(operations) || operations.every((op) => !isObject(op) || hasSpeedFactor(op))) return tables;
  return {
    ...tables,
    operations: { ...tables.operations, operations: operations.map((op) => (!isObject(op) || hasSpeedFactor(op) ? op : { ...op, facteur_vitesse: paperFactor(op.operation) })) },
  };
}

// --- Écrire et lire un facteur --------------------------------------------------------------------------------------------

// Un facteur comme sur le papier : « 1 », « 1/4 », « 1/8 » ; en décimal seulement s'il n'est pas de la forme 1/n
// (« 0.75 », « 1.5 »).
export function factorText(value) {
  if (!isPositive(value)) return String(value);
  const n = Math.round(1 / value);
  if (n >= 1 && Math.abs(1 / value - n) < 1e-9 * n) return n === 1 ? '1' : `1/${n}`;
  return String(Number(value.toPrecision(12)));
}

// Ce qu'on a tapé dans une case de facteur de la Gestion du contenu : « 1/4 », « 0.25 », « 0,25 », « 1 » → le nombre,
// par l'évaluateur des cases de réponse (expression.js, D82 : jamais eval). null : vide, illisible, nul ou négatif.
export function parseFactor(text) {
  const typed = String(text ?? '').trim();
  if (typed === '') return null;
  const result = evaluateExpression(typed);
  return result.error === undefined && result.value > 0 ? result.value : null;
}

// --- L'outil et son opération ----------------------------------------------------------------------------------------------

// La raison d'un ancien outil dont le facteur diffère de celui de son opération (D83, point 5) : rien ne change en
// silence, il devient « forcé » et Thierry tranche.
export const PASSAGE_REASON = "Valeur reprise de l'ancien outil — à vérifier";
export const REASON_MAX = 80; // caractères : une raison courte, montrée à l'étudiant

// L'état du facteur de vitesse d'un outil, avec son opération telle que les tables de SA version la donnent :
//   { mode, value, reason, table }
//   mode 'own'       : les tables ne portent pas les facteurs (avant D83) — le `fact_vc` de l'outil, comme avant ;
//   mode 'inherited' : le facteur de l'opération (`table`) — l'outil n'a pas de `fact_vc`, ou c'est un ancien outil
//                      (un `fact_vc` sans raison) qui vaut justement celui de son opération ;
//   mode 'forced'    : le `fact_vc` de l'outil, avec sa raison — celle de l'outil, ou, pour un ancien outil dont le
//                      facteur diffère, PASSAGE_REASON.
// Le facteur qui sert au calcul est donc toujours : celui de l'outil s'il en a un, sinon celui de son opération.
export function speedFactorState(tool, operation) {
  const own = tool?.fact_vc;
  if (!hasSpeedFactor(operation)) return { mode: 'own', value: own, reason: null, table: null };
  const table = operation.facteur_vitesse;
  if (own === undefined) return { mode: 'inherited', value: table, reason: null, table };
  const reason = isText(tool.fact_vc_raison) ? tool.fact_vc_raison.trim() : null;
  if (reason === null && own === table) return { mode: 'inherited', value: table, reason: null, table };
  return { mode: 'forced', value: own, reason: reason ?? PASSAGE_REASON, table };
}

// Le facteur qui sert au calcul de N (calcul.js).
export const speedFactorOf = (tool, operation) => speedFactorState(tool, operation).value;

// Les erreurs du facteur de vitesse d'un outil : [{ champ, message }] (toolErrors, data.js).
//   - tables sans facteurs, ou opération inconnue : `fact_vc` est exigé, comme avant ; une raison n'y a pas de sens ;
//   - tables avec facteurs : `fact_vc` est facultatif (absent : l'outil hérite) ; une raison exige un facteur, et
//     s'écrit en REASON_MAX caractères au plus. Un `fact_vc` sans raison est un ancien outil : il passe (speedFactorState).
export function speedFactorErrors(tool, operation) {
  const errors = [];
  const inTables = hasSpeedFactor(operation);
  const hasOwn = tool.fact_vc !== undefined;
  if ((hasOwn || !inTables) && !isPositive(tool.fact_vc)) errors.push({ champ: 'fact_vc', message: '« fact_vc » doit être un nombre > 0' });
  if (tool.fact_vc_raison === undefined) return errors;
  if (!inTables) errors.push({ champ: 'fact_vc_raison', message: "« fact_vc_raison » n'a de sens qu'avec des tables qui portent les facteurs de vitesse : ici, l'outil garde son facteur, sans raison" });
  else if (!hasOwn) errors.push({ champ: 'fact_vc_raison', message: "« fact_vc_raison » est la raison d'un facteur forcé : sans « fact_vc », l'outil hérite du facteur de son opération" });
  else if (!isText(tool.fact_vc_raison)) errors.push({ champ: 'fact_vc_raison', message: 'Un facteur forcé exige une raison courte (elle est montrée à l’étudiant).' });
  else if (tool.fact_vc_raison.trim().length > REASON_MAX) errors.push({ champ: 'fact_vc_raison', message: `La raison a ${tool.fact_vc_raison.trim().length} caractères (au plus ${REASON_MAX}).` });
  return errors;
}

// Un outil sans ses clés de facteur, puis avec celles données, `fact_vc_raison` rangée juste après `fact_vc`.
function withFactorKeys(tool, keys) {
  const out = {};
  let placed = false;
  const place = () => { if (!placed) Object.assign(out, keys); placed = true; };
  for (const [key, value] of Object.entries(tool)) {
    if (key === 'fact_vc') place();
    else if (key !== 'fact_vc_raison') {
      if (key === 'fact_av') place(); // un outil sans `fact_vc` : à sa place, devant le facteur d'avance
      out[key] = value;
    }
  }
  place();
  return out;
}

// Le passage d'un ancien outil (D83, point 5), quand il rencontre des tables qui portent les facteurs : un `fact_vc`
// sans raison égal au facteur de son opération disparaît (l'outil hérite, et suivra la table) ; différent, il reçoit
// PASSAGE_REASON (l'outil est forcé, et signalé). Un outil déjà hérité ou déjà forcé, des tables sans facteurs, une
// opération inconnue : l'outil est rendu tel quel. Ne modifie pas l'objet reçu.
export function adoptSpeedFactor(tool, operation) {
  if (!isObject(tool) || tool.fact_vc === undefined || isText(tool.fact_vc_raison)) return tool;
  const state = speedFactorState(tool, operation);
  if (state.mode === 'inherited') return withFactorKeys(tool, {});
  if (state.mode === 'forced') return withFactorKeys(tool, { fact_vc: tool.fact_vc, fact_vc_raison: PASSAGE_REASON });
  return tool;
}

// Le contenu d'un exercice (brouillon ou version) dont chaque copie d'outil fait ce passage, avec ces tables.
//   tables : { operations: { operations: [...] } } — les tables que le contenu rencontre
export function adoptSpeedFactors(content, tables) {
  if (!isObject(content) || !Array.isArray(content.outils)) return content;
  const byName = operationsByName(tables);
  const outils = content.outils.map((copy) => adoptSpeedFactor(copy, byName.get(copy?.operation)));
  return outils.every((copy, i) => copy === content.outils[i]) ? content : { ...content, outils };
}

// Une copie d'outil qu'on ajoute à un exercice (depuis la banque, depuis un autre exercice) : son facteur tel que les
// tables de L'EXERCICE le veulent.
//   - elles portent les facteurs : le passage ci-dessus (un outil hérité ou forcé reste tel quel) ;
//   - elles ne les portent pas : l'outil doit avoir son `fact_vc` — le sien, sinon celui de son opération dans les
//     tables d'où il vient (`sourceOperation`) —, sans raison.
export function settleSpeedFactor(copy, operation, sourceOperation) {
  if (hasSpeedFactor(operation)) return adoptSpeedFactor(copy, operation);
  const own = copy.fact_vc ?? sourceOperation?.facteur_vitesse;
  return withFactorKeys(copy, own === undefined ? {} : { fact_vc: own });
}

const operationsByName = (tables) => new Map((Array.isArray(tables?.operations?.operations) ? tables.operations.operations : []).filter(isObject).map((op) => [op.operation, op]));

// --- L'exercice : donner le facteur à l'étudiant, ou le lui faire trouver (D83, point 6) ------------------------------------

// Le facteur est-il donné à l'étudiant ? Avec des tables sans facteurs, toujours : il n'y a pas de feuille où le
// trouver, et l'affichage reste celui d'avant. Sinon, seulement si l'exercice le dit (`facteur_vitesse_donne`).
export const factorGiven = (exercise, operation) => !hasSpeedFactor(operation) || exercise?.facteur_vitesse_donne === true;

// Ce que la question dit du facteur de vitesse de son outil (`question.outil.facteur_vitesse`, seance.js), ou null
// pour une version d'avant D83 (la question porte alors `fact_vc`, comme avant) :
//   { etat: 'force', texte, valeur, raison }  — toujours montré, avec sa raison, que l'exercice donne le facteur ou non ;
//   { etat: 'donne', texte, valeur }          — l'exercice le donne ;
//   { etat: 'a_trouver' }                     — il se trouve dans la feuille des facteurs : ni texte ni valeur ne partent.
export function questionFactor(tool, operation, exercise) {
  const state = speedFactorState(tool, operation);
  if (state.mode === 'own') return null;
  if (state.mode === 'forced') return { etat: 'force', texte: factorText(state.value), valeur: state.value, raison: state.reason };
  if (factorGiven(exercise, operation)) return { etat: 'donne', texte: factorText(state.value), valeur: state.value, raison: null };
  return { etat: 'a_trouver', texte: null, valeur: null, raison: null };
}

// --- En clair, pour la Gestion du contenu -----------------------------------------------------------------------------------

// Le facteur tel qu'un outil le porte, sans ses tables : « hérité de l'opération », « forcé × 1 (raison) », « × 1/4 »
// (un outil d'avant D83). Pour les différences entre deux contenus (publication, historique de la banque).
export function ownFactorLabel(tool) {
  if (tool?.fact_vc === undefined) return "hérité de l'opération";
  const text = `× ${factorText(tool.fact_vc)}`;
  return isText(tool.fact_vc_raison) ? `forcé ${text} (${tool.fact_vc_raison.trim()})` : text;
}

// « Selon la table : 1/4 (Chanfreinage) » — la ligne en lecture seule du formulaire d'outil.
export const tableFactorLine = (operation) => `Selon la table : ${factorText(operation.facteur_vitesse)} (${operation.operation})`;

// « Nine9 90 degrés (nine9_90_degres) — facteur forcé : × 1 au lieu de × 1/4 (Chanfreinage) — raison » : un outil
// forcé, nommé dans l'impact d'un changement de tables et dans la cascade.
export function forcedFactorLine(tool, operation) {
  const state = speedFactorState(tool, operation);
  return `${tool.nom} (${tool.id}) — facteur de vitesse forcé : × ${factorText(state.value)} au lieu de × ${factorText(state.table)} (${operation.operation}) — « ${state.reason} »`;
}
