// Assainissement d'un SVG téléversé (jalon 7b, décision D57) : liste blanche d'éléments et
// d'attributs ; aucun script, aucun gestionnaire d'événement, aucun lien, aucune ressource externe.
// Ce qui est dangereux fait REFUSER le fichier (SvgError, avec ce qui a été trouvé) ; ce qui est
// seulement inconnu (métadonnées d'Inkscape, attributs d'un autre espace de noms) est retiré, et
// dit dans `retires`. Le résultat est resérialisé : ce qui est servi est ce qui a été relu, jamais
// le texte reçu tel quel.
//
// Fonction PURE, sans DOMParser (le Workers runtime n'en a pas) : un petit lecteur XML suffit, le
// SVG étant du XML strict — tout ce qui n'en est pas (DOCTYPE, entité inconnue, balise mal fermée)
// est refusé plutôt qu'interprété.

export class SvgError extends Error {}

// Les éléments gardés : formes, groupes, définitions, dégradés, masques, filtres courants, texte.
export const SVG_ELEMENTS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'textPath',
  'clipPath', 'mask', 'marker', 'pattern',
  'linearGradient', 'radialGradient', 'stop',
  'filter', 'feGaussianBlur', 'feOffset', 'feBlend', 'feColorMatrix', 'feComposite', 'feFlood', 'feMerge', 'feMergeNode', 'feMorphology', 'feDropShadow',
  'style',
]);

// Les éléments qui font refuser le fichier : scripts, contenu étranger, images et liens (ressources
// externes), animations (qui peuvent changer un href).
export const FORBIDDEN_ELEMENTS = new Set([
  'script', 'foreignObject', 'image', 'a', 'iframe', 'embed', 'object', 'video', 'audio',
  'animate', 'animateMotion', 'animateTransform', 'set', 'handler', 'listener', 'feImage',
]);

// Les attributs gardés (noms exacts : SVG distingue la casse — viewBox, clipPathUnits…).
export const SVG_ATTRIBUTES = new Set([
  'id', 'class', 'style', 'transform', 'xmlns', 'xmlns:xlink', 'version', 'xml:space', 'lang', 'role', 'aria-label', 'aria-hidden', 'focusable',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'dx', 'dy', 'width', 'height', 'viewBox', 'preserveAspectRatio',
  'd', 'points', 'pathLength', 'href', 'xlink:href',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity',
  'opacity', 'display', 'visibility', 'overflow', 'vector-effect', 'shape-rendering', 'paint-order', 'color', 'clip-path', 'clip-rule', 'mask',
  'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'fx', 'fy', 'fr',
  'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'text-decoration', 'startOffset',
  'markerWidth', 'markerHeight', 'refX', 'refY', 'orient', 'markerUnits', 'marker-start', 'marker-mid', 'marker-end',
  'clipPathUnits', 'maskUnits', 'maskContentUnits', 'patternUnits', 'patternContentUnits', 'patternTransform',
  'filterUnits', 'primitiveUnits', 'stdDeviation', 'in', 'in2', 'result', 'mode', 'type', 'values', 'operator', 'k1', 'k2', 'k3', 'k4', 'flood-color', 'flood-opacity', 'radius', 'edgeMode',
]);

export const SVG_MAX_BYTES = 200_000;
const SVG_NS = 'http://www.w3.org/2000/svg';

const NAME = /[A-Za-z_:][-A-Za-z0-9_:.]*/y;
const WHITESPACE = /\s*/y;

// --- Lecture : un arbre { name, attrs: [[nom, valeur]], children: [nœud | texte] } ----------------------------------

function decodeEntities(text, where) {
  return text.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z]+);?/g, (whole, body) => {
    if (!whole.endsWith(';')) throw new SvgError(`SVG mal formé : « & » sans entité (${where})`);
    if (body[0] === '#') return String.fromCodePoint(body[1] === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10));
    const known = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (!(body in known)) throw new SvgError(`SVG refusé : entité inconnue « &${body}; » (${where})`);
    return known[body];
  });
}

function parse(text) {
  const root = { name: '#document', attrs: [], children: [] };
  const stack = [root];
  let pos = 0;
  const at = (regex) => { regex.lastIndex = pos; const m = regex.exec(text); if (m) pos = regex.lastIndex; return m; };
  const skipTo = (end, what) => { const i = text.indexOf(end, pos); if (i < 0) throw new SvgError(`SVG mal formé : ${what} non terminé`); pos = i + end.length; };

  while (pos < text.length) {
    const lt = text.indexOf('<', pos);
    if (lt < 0) { stack.at(-1).children.push(decodeEntities(text.slice(pos), 'texte')); break; }
    if (lt > pos) stack.at(-1).children.push(decodeEntities(text.slice(pos, lt), 'texte'));
    pos = lt;
    if (text.startsWith('<!--', pos)) { skipTo('-->', 'commentaire'); continue; }
    if (text.startsWith('<?', pos)) { skipTo('?>', 'instruction de traitement'); continue; }
    if (text.startsWith('<![CDATA[', pos)) {
      const end = text.indexOf(']]>', pos);
      if (end < 0) throw new SvgError('SVG mal formé : CDATA non terminé');
      stack.at(-1).children.push(text.slice(pos + 9, end));
      pos = end + 3;
      continue;
    }
    if (text.startsWith('<!', pos)) throw new SvgError('SVG refusé : déclaration DOCTYPE ou entité interne');
    if (text.startsWith('</', pos)) {
      pos += 2;
      const name = at(NAME)?.[0];
      at(WHITESPACE);
      if (!name || text[pos] !== '>') throw new SvgError('SVG mal formé : balise fermante illisible');
      pos += 1;
      const open = stack.pop();
      if (open === root || open.name !== name) throw new SvgError(`SVG mal formé : « </${name}> » ne ferme pas « <${open.name}> »`);
      continue;
    }
    pos += 1;
    const name = at(NAME)?.[0];
    if (!name) throw new SvgError('SVG mal formé : balise sans nom');
    const node = { name, attrs: [], children: [] };
    const parent = stack.at(-1);
    for (;;) {
      at(WHITESPACE);
      if (text.startsWith('/>', pos)) { pos += 2; break; }
      if (text[pos] === '>') { pos += 1; stack.push(node); break; }
      const attr = at(NAME)?.[0];
      if (!attr) throw new SvgError(`SVG mal formé : attribut illisible dans « <${name}> »`);
      at(WHITESPACE);
      if (text[pos] !== '=') throw new SvgError(`SVG mal formé : attribut « ${attr} » sans valeur dans « <${name}> »`);
      pos += 1;
      at(WHITESPACE);
      const quote = text[pos];
      if (quote !== '"' && quote !== "'") throw new SvgError(`SVG mal formé : valeur de « ${attr} » sans guillemets`);
      const end = text.indexOf(quote, pos + 1);
      if (end < 0) throw new SvgError(`SVG mal formé : valeur de « ${attr} » non terminée`);
      node.attrs.push([attr, decodeEntities(text.slice(pos + 1, end), `attribut ${attr}`)]);
      pos = end + 1;
    }
    parent.children.push(node);
  }
  if (stack.length !== 1) throw new SvgError(`SVG mal formé : « <${stack.at(-1).name}> » n'est pas fermé`);
  const elements = root.children.filter((child) => typeof child !== 'string');
  if (elements.length !== 1 || elements[0].name !== 'svg') throw new SvgError('SVG refusé : le fichier doit contenir un seul élément racine <svg>');
  if (root.children.some((child) => typeof child === 'string' && child.trim() !== '')) throw new SvgError('SVG mal formé : du texte hors de la racine');
  return elements[0];
}

// --- Assainissement ---------------------------------------------------------------------------------------

// Une valeur (attribut ou feuille de style) qui irait chercher ailleurs : url() vers autre chose
// qu'un « #id », @import, expression(), ou un schéma d'adresse.
function externalReference(value) {
  const v = String(value);
  if (/@import/i.test(v)) return '@import';
  if (/url\s*\(\s*['"]?\s*(?!#)/i.test(v)) return 'url() vers une ressource externe';
  if (/expression\s*\(/i.test(v)) return 'expression()';
  return null;
}

function cleanElement(node, retires, path) {
  const where = path.join(' > ');
  if (FORBIDDEN_ELEMENTS.has(node.name) || FORBIDDEN_ELEMENTS.has(node.name.toLowerCase())) throw new SvgError(`SVG refusé : élément <${node.name}> (${where})`);
  if (!SVG_ELEMENTS.has(node.name)) { retires.push(`élément <${node.name}>`); return null; }

  const attrs = [];
  for (const [name, value] of node.attrs) {
    if (/^on/i.test(name)) throw new SvgError(`SVG refusé : gestionnaire d'événement « ${name} » sur <${node.name}>`);
    if (name === 'href' || name === 'xlink:href') {
      if (!/^#[A-Za-z_][-A-Za-z0-9_.:]*$/.test(value.trim())) throw new SvgError(`SVG refusé : « ${name} » vers autre chose qu'un élément du fichier sur <${node.name}> (« ${value.slice(0, 60)} »)`);
    }
    if (!SVG_ATTRIBUTES.has(name)) { retires.push(`attribut ${name} sur <${node.name}>`); continue; }
    const external = externalReference(value);
    if (external !== null) throw new SvgError(`SVG refusé : ${external} dans « ${name} » sur <${node.name}>`);
    if (name === 'xmlns' && value !== SVG_NS) { retires.push(`attribut xmlns sur <${node.name}>`); continue; }
    if (name === 'xmlns:xlink' && value !== 'http://www.w3.org/1999/xlink') { retires.push(`attribut xmlns:xlink sur <${node.name}>`); continue; }
    attrs.push([name, value]);
  }

  const children = [];
  for (const child of node.children) {
    if (typeof child === 'string') {
      if (node.name === 'style') {
        const external = externalReference(child);
        if (external !== null) throw new SvgError(`SVG refusé : ${external} dans <style>`);
      }
      if (child.trim() !== '' || ['text', 'tspan', 'textPath'].includes(node.name)) children.push(child);
      continue;
    }
    const kept = cleanElement(child, retires, [...path, child.name]);
    if (kept !== null) children.push(kept);
  }
  return { name: node.name, attrs, children };
}

// --- Écriture -----------------------------------------------------------------------------------------------

const escapeText = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function serialize(node) {
  const attrs = node.attrs.map(([name, value]) => ` ${name}="${escapeAttr(value)}"`).join('');
  if (node.children.length === 0) return `<${node.name}${attrs}/>`;
  const inner = node.children.map((child) => (typeof child === 'string' ? escapeText(child) : serialize(child))).join('');
  return `<${node.name}${attrs}>${inner}</${node.name}>`;
}

// Assainit un SVG. Retourne { svg, retires } — le SVG resérialisé (compact, sans commentaire ni
// déclaration) et la liste de ce qui a été retiré ; lève SvgError si le fichier est refusé.
export function sanitizeSvg(text) {
  if (typeof text !== 'string') throw new SvgError('SVG refusé : pas du texte');
  if (text.length > SVG_MAX_BYTES) throw new SvgError(`SVG refusé : plus de ${SVG_MAX_BYTES / 1000} Ko`);
  const retires = [];
  const root = cleanElement(parse(text.replace(/^﻿/, '')), retires, ['svg']);
  if (root === null) throw new SvgError('SVG refusé : racine illisible');
  if (!root.attrs.some(([name]) => name === 'xmlns')) root.attrs.unshift(['xmlns', SVG_NS]);
  const has = (name) => root.attrs.some(([attr]) => attr === name);
  if (!has('viewBox') && !(has('width') && has('height'))) throw new SvgError('SVG refusé : sans viewBox ni largeur et hauteur, le dessin n\'a pas de taille');
  return { svg: serialize(root), retires };
}
