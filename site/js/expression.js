// Les calculs dans les cases de réponse (D82) : une saisie comme « (3-1)*2 » ou « 4 × 350 / 0,75 », lue par un petit
// évaluateur écrit à la main — jamais eval() ni Function() : le serveur de correction lit chaque saisie avec lui
// (parseAnswer, correction.js). Fonctions PURES, sans DOM : le navigateur et le serveur importent ce même fichier.
//
// Syntaxe (D82, point 1) :
//   nombres     : point ou virgule décimale (« 0.75 », « 0,75 », « .5 »), espaces ignorés (« 1 600 »)
//   opérateurs  : + ; - ou − ; * ou × ou x ; / ou ÷ ; les parenthèses
//   constante   : pi, PI ou π, qui vaut Math.PI
// Rien d'autre : ni puissance, ni fonction, ni multiplication implicite (« 2pi », « 2(3+1) » sont illisibles).
// Le moins unaire est permis partout où un nombre peut aller (« 2 × −3 », « (−1 + 3) ») ; il n'y a pas de plus unaire.
// Un résultat négatif, une division par zéro ou une expression mal formée : illisible.
// ❓ D82, précisions à confirmer : −0 compte comme négatif (« -0 » reste refusé, comme avant) ; « x » en minuscule
// seulement ; « Pi » (ni « pi » ni « PI ») est illisible.

// Limites, pour que le Worker ne passe pas plus de temps sur une saisie démesurée que sur une réponse ordinaire.
export const EXPRESSION_MAX_LENGTH = 60; // caractères de la saisie, espaces compris : le maxlength de la case
const MAX_DEPTH = 10; // niveaux de parenthèses

// Ce que la case affiche d'un résultat : au plus 9 caractères, la largeur d'une case à 1280 px (mesurée dans Chrome).
const SHOWN_MAX_LENGTH = 9;

const OPERATORS = { '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', x: '*', '/': '/', '÷': '/' };
const NUMBER = /^(\d+\.?\d*|\.\d+)$/;

// La saisie contient-elle une expression plutôt qu'un nombre — un opérateur, une parenthèse ou pi ? Lisible ou non :
// c'est ce que la touche Entrée essaie de calculer (« (3-1)*2 », « 2(3) », « -5 »), et pas « 1 600 » ni « abc ».
export function isExpression(text) {
  return typeof text === 'string' && /[-+−*×x/÷()π]|pi|PI/.test(text);
}

// Découpe la saisie en éléments : { kind: 'number', value, text } (le texte avec un point décimal), { kind: 'pi' },
// { kind: 'op', op: '+' | '-' | '*' | '/' }, { kind: '(' } ou { kind: ')' }. null si un caractère n'est pas permis ou si
// un nombre est mal écrit (« 1.2.3 », « . »). Les espaces disparaissent, toutes les virgules deviennent des points.
function tokenize(text) {
  const compact = text.replace(/\s/g, '').replaceAll(',', '.');
  const tokens = [];
  let i = 0;
  while (i < compact.length) {
    const rest = compact.slice(i);
    const number = /^[0-9.]+/.exec(rest)?.[0];
    if (number !== undefined) {
      if (!NUMBER.test(number)) return null;
      tokens.push({ kind: 'number', value: Number(number), text: number });
      i += number.length;
    } else if (rest.startsWith('pi') || rest.startsWith('PI')) {
      tokens.push({ kind: 'pi' });
      i += 2;
    } else if (rest[0] === 'π') {
      tokens.push({ kind: 'pi' });
      i += 1;
    } else if (OPERATORS[rest[0]]) {
      tokens.push({ kind: 'op', op: OPERATORS[rest[0]] });
      i += 1;
    } else if (rest[0] === '(' || rest[0] === ')') {
      tokens.push({ kind: rest[0] });
      i += 1;
    } else return null;
  }
  return tokens;
}

// Une expression mal formée, ou qui ne se calcule pas : `reason` dit pourquoi.
class Unreadable extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

// Construit l'arbre de l'expression, ou lève Unreadable('syntax'). Grammaire, de la priorité la plus faible à la plus forte :
//   somme   = produit { (+ | -) produit }
//   produit = facteur { (* | /) facteur }
//   facteur = - facteur | nombre | pi | ( somme )
// Un nœud : { number, text } ; { pi: true } ; { negate } ; { op, left, right } ; { group } (des parenthèses, gardées
// pour écrire l'expression telle quelle).
function parse(tokens) {
  let position = 0;
  let depth = 0;
  const peek = () => tokens[position];
  const isOp = (...ops) => peek()?.kind === 'op' && ops.includes(peek().op);

  function sum() {
    let node = product();
    while (isOp('+', '-')) {
      const { op } = tokens[position++];
      node = { op, left: node, right: product() };
    }
    return node;
  }
  function product() {
    let node = factor();
    while (isOp('*', '/')) {
      const { op } = tokens[position++];
      node = { op, left: node, right: factor() };
    }
    return node;
  }
  function factor() {
    const token = tokens[position++];
    if (token?.kind === 'op' && token.op === '-') return { negate: factor() };
    if (token?.kind === 'number') return { number: token.value, text: token.text };
    if (token?.kind === 'pi') return { pi: true };
    if (token?.kind === '(') {
      depth += 1;
      if (depth > MAX_DEPTH) throw new Unreadable('syntax');
      const group = sum();
      if (tokens[position++]?.kind !== ')') throw new Unreadable('syntax');
      depth -= 1;
      return { group };
    }
    throw new Unreadable('syntax');
  }

  const tree = sum();
  if (position !== tokens.length) throw new Unreadable('syntax'); // « 2(3) », « (2)(3) », « 3) » : quelque chose reste
  return tree;
}

// La valeur d'un nœud ; lève Unreadable('divisionByZero').
function evaluate(node) {
  if ('number' in node) return node.number;
  if (node.pi) return Math.PI;
  if (node.group) return evaluate(node.group);
  if (node.negate) return -evaluate(node.negate);
  const left = evaluate(node.left);
  const right = evaluate(node.right);
  if (node.op === '+') return left + right;
  if (node.op === '-') return left - right;
  if (node.op === '*') return left * right;
  if (right === 0) throw new Unreadable('divisionByZero');
  return left / right;
}

// L'arbre d'une saisie, ou lève Unreadable('syntax') : trop longue, caractère non permis, mal formée.
function treeOf(text) {
  if (typeof text !== 'string' || text.length > EXPRESSION_MAX_LENGTH) throw new Unreadable('syntax');
  const tokens = tokenize(text);
  if (tokens === null || tokens.length === 0) throw new Unreadable('syntax');
  return parse(tokens);
}

// Calcule une expression : { value } — le résultat à 12 chiffres significatifs, sans le bruit de la virgule flottante
// (0.1 + 0.2 → 0.3) —, ou { error } :
//   'syntax'         : trop longue, caractère non permis, nombre mal écrit, opérateur ou parenthèse de trop ou manquant
//   'divisionByZero' : division par zéro
//   'negative'       : résultat négatif, −0 compris
// La syntaxe est vérifiée en entier avant le calcul : « 1/0 + » est mal formée, pas une division par zéro.
export function evaluateExpression(text) {
  try {
    const value = evaluate(treeOf(text));
    if (!Number.isFinite(value)) return { error: 'syntax' };
    if (value < 0 || Object.is(value, -0)) return { error: 'negative' };
    return { value: Number(value.toPrecision(12)) };
  } catch (error) {
    if (error instanceof Unreadable) return { error: error.reason };
    throw error;
  }
}

// Une expression écrite proprement, pour la correction et la note sous la case (D82, point 5) : les nombres avec un
// point, « × », « / », « − », « π », une espace de chaque côté d'un opérateur, les parenthèses de l'étudiant.
//   « 4*350/0,75 » → « 4 × 350 / 0.75 » ; « (3-1)x2 » → « (3 − 1) × 2 » ; « 2*-pi » → « 2 × −π »
// null si l'expression est mal formée (une division par zéro ou un résultat négatif s'écrivent quand même).
export function expressionText(text) {
  const symbols = { '+': '+', '-': '−', '*': '×', '/': '/' };
  const write = (node) => {
    if ('number' in node) return node.text;
    if (node.pi) return 'π';
    if (node.group) return `(${write(node.group)})`;
    if (node.negate) return `−${write(node.negate)}`;
    return `${write(node.left)} ${symbols[node.op]} ${write(node.right)}`;
  };
  try {
    return write(treeOf(text));
  } catch (error) {
    if (error instanceof Unreadable) return null;
    throw error;
  }
}

// Un nombre écrit sans exposant : String(1.2e-7) donne « 1.2e-7 », la case veut « 0.00000012 ».
function plainDecimal(value) {
  const match = /^(\d)(?:\.(\d+))?e-(\d+)$/.exec(String(value));
  return match ? `0.${'0'.repeat(Number(match[3]) - 1)}${match[1]}${match[2] ?? ''}` : String(value);
}

// Le résultat d'une expression tel que la case l'affiche (D82, point 4) : { text, rounded }. Le nombre jugé, s'il tient
// en 9 caractères ; sinon le même avec moins de chiffres significatifs, jusqu'à ce qu'il tienne — rounded dit alors que
// l'affichage est arrondi (le serveur, lui, juge l'expression). Aucun arrondi pédagogique : ni les décimales de la
// grandeur, ni l'entier de N.
//   4 → « 4 » ; 0.0045 → « 0.0045 » ; 1866.66666667 (4 × 350 / 0.75) → « 1866.6667 », arrondi
// ❓ D82, précision à confirmer : 9 caractères, la case à 1280 px ; elle en montre 6 à 1000 px, 26 à 390 px.
// Un nombre qui ne tient jamais (plus de 9 chiffres avant le point) s'écrit en entier.
export function computedText(value) {
  for (let digits = 12; digits >= 1; digits -= 1) {
    const text = plainDecimal(Number(value.toPrecision(digits)));
    if (text.length <= SHOWN_MAX_LENGTH) return { text, rounded: Number(text) !== value };
  }
  return { text: plainDecimal(value), rounded: false };
}
