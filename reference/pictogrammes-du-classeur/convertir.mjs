// Convertit les 19 pictogrammes d'opérations du classeur Excel (formes DrawingML) en SVG.
//
//   node reference/pictogrammes-du-classeur/convertir.mjs
//
// Conversion fidèle, sans redessin : la géométrie, les couleurs et les traits viennent du classeur.
// Node pur, aucune dépendance. Déterministe : relancé, il réécrit des fichiers identiques.
// Ce qui est couvert, ce qui ne l'est pas et les choix faits : voir README.md, à côté.
// Tout élément DrawingML non prévu arrête le script avec un message : rien n'est ignoré en silence.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WORKBOOK_DIR = 'legacy'; // le classeur est le seul .xlsm du dossier (son nom de fichier a des accents abîmés sur disque)
const WORKBOOK_TITLE = 'Exercice M10 - tournage - vc seulement - version étudiant_r0.xlsm';
const DRAWING = 'xl/drawings/drawing3.xml'; // dessins de la feuille « Avances d'usinage »
const THEME = 'xl/theme/theme1.xml';
const SHEET_NAME = "Avances d'usinage";
const OUTER_GROUP = 'Group 4'; // le groupe qui contient les 19 pictogrammes
const OUT_DIR = 'site/img/pictos/operations';

// Correspondance [nom du sous-groupe dans le classeur, opération de site/data/operations.json].
// Les sous-groupes sont empilés dans la feuille, un par rang de la table des avances : l'ordre
// ci-dessous est à la fois celui des rangs (de haut en bas) et celui d'operations.json.
// Le script vérifie les deux ordres et s'arrête s'ils ne concordent plus.
const ICONS = [
  ['Group 54', 'Contournage ébauche'],
  ['Group 51', 'Contournage finition'],
  ['Group 44', 'Surfaçage'],
  ['Group 40', 'Chanfreinage / ébavurage'],
  ['Group 39', 'Perçage'],
  ['Group 38', 'Chanfreinage'],
  ['Group 36', "Alésage à l'alésoir"],
  ['Group 35', 'Pointage'],
  ['Group 169', 'Taraudage'],
  ['Group 206', 'Filetage externe'],
  ['Group 208', 'Filetage interne'],
  ['Group 193', 'Chariotage ébauche'],
  ['Group 194', 'Chariotage finition'],
  ['Group 201', 'Centrage'],
  ['Group 204', 'Alésage à la barre'],
  ['Group 456', 'Dressage'],
  ['Group 462', 'Tronçonnage'],
  ['Group 479', 'Rainurage externe'],
  ['Groupe 180', 'Rainurage interne'],
];

const EMU_PER_PT = 12700; // unité des SVG : 1 = 1 point
const MARGIN = 0.5; // marge autour de la boîte englobante, en points (absorbe les pointes des joints en onglet)
const MIN_ARROW_LINE = 2; // Office calcule les pointes comme si le trait faisait au moins 2 pt
const ARROW_FACTOR = { sm: 2, med: 3, lg: 5 }; // taille d'une pointe = facteur × épaisseur du trait
const STEALTH_NOTCH = 2 / 3; // pointe « stealth » : base rentrée jusqu'aux 2/3 de la longueur depuis la pointe
const DASHES = { sysDot: [1, 1], sysDash: [3, 1], dash: [4, 3], dashDot: [4, 3, 1, 3], lgDash: [8, 3] }; // × épaisseur

// Même règle que operationSlug de site/js/ui/sheets-data.js (recopiée : ce module-là charge le site).
const operationSlug = (name) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const fail = (message) => { throw new Error(message); };

// --- 1. Lecteur de zip : répertoire central, puis décompression de l'entrée demandée -----------------------

function openZip(file) {
  const buf = fs.readFileSync(file);
  let end = buf.length - 22; // fin du répertoire central : on recule jusqu'à sa signature
  while (buf.readUInt32LE(end) !== 0x06054b50) end--;
  const count = buf.readUInt16LE(end + 10);
  let pos = buf.readUInt32LE(end + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    const nameLength = buf.readUInt16LE(pos + 28);
    entries.set(buf.toString('utf8', pos + 46, pos + 46 + nameLength), {
      method: buf.readUInt16LE(pos + 10),
      size: buf.readUInt32LE(pos + 20),
      offset: buf.readUInt32LE(pos + 42),
    });
    pos += 46 + nameLength + buf.readUInt16LE(pos + 30) + buf.readUInt16LE(pos + 32);
  }
  return (name) => {
    const entry = entries.get(name) || fail(`Entrée absente du classeur : ${name}`);
    const start = entry.offset + 30 + buf.readUInt16LE(entry.offset + 26) + buf.readUInt16LE(entry.offset + 28);
    const data = buf.subarray(start, start + entry.size);
    return (entry.method === 0 ? data : zlib.inflateRawSync(data)).toString('utf8');
  };
}

// --- 2. Analyseur XML minimal : balises et attributs seulement (le texte n'est pas utile ici) ---------------

function parseXml(text) {
  const root = { name: '#racine', attrs: {}, children: [] };
  const stack = [root];
  for (const [, closing, name, rawAttrs, selfClosing] of text.matchAll(/<(\/?)([\w:]+)((?:\s+[\w:]+="[^"]*")*)\s*(\/?)>/g)) {
    if (closing) { stack.pop(); continue; }
    const attrs = {};
    for (const [, key, value] of rawAttrs.matchAll(/([\w:]+)="([^"]*)"/g)) attrs[key] = value;
    const node = { name, attrs, children: [] };
    stack.at(-1).children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root;
}

const child = (node, name) => node?.children.find((c) => c.name === name);
const descendants = (node, name) => node.children.flatMap((c) => [...(c.name === name ? [c] : []), ...descendants(c, name)]);
const shapeName = (node) => child(node.children[0], 'xdr:cNvPr').attrs.name; // nvSpPr, nvCxnSpPr ou nvGrpSpPr

// --- 3. Thème et couleurs ------------------------------------------------------------------------------------

function readTheme(xml) {
  const tree = parseXml(xml);
  const colors = {};
  for (const c of descendants(tree, 'a:clrScheme')[0].children) colors[c.name.slice(2)] = c.children[0];
  Object.assign(colors, { tx1: colors.dk1, bg1: colors.lt1, tx2: colors.dk2, bg2: colors.lt2 });
  return { colors, fills: descendants(tree, 'a:fillStyleLst')[0].children, lines: descendants(tree, 'a:lnStyleLst')[0].children };
}

// sRGB <-> linéaire : Office applique « shade » et « tint » en lumière linéaire.
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

// Couleur « #RRGGBB » d'un nœud srgbClr, sysClr ou schemeClr ; placeholder = la couleur que « phClr » désigne.
function resolveColor(theme, node, placeholder) {
  let hex;
  if (node.name === 'a:srgbClr') hex = node.attrs.val;
  else if (node.name === 'a:sysClr') hex = node.attrs.lastClr || fail(`sysClr sans lastClr : ${node.attrs.val}`);
  else if (node.name === 'a:schemeClr' && node.attrs.val === 'phClr') hex = resolveColor(theme, placeholder).slice(1);
  else if (node.name === 'a:schemeClr') hex = resolveColor(theme, theme.colors[node.attrs.val] || fail(`Couleur de thème inconnue : ${node.attrs.val}`)).slice(1);
  else fail(`Couleur non couverte : ${node.name}`);
  let rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  for (const change of node.children) {
    const amount = Number(change.attrs.val) / 100000;
    if (change.name === 'a:shade') rgb = rgb.map((c) => toSrgb(toLinear(c) * amount));
    else if (change.name === 'a:tint') rgb = rgb.map((c) => toSrgb(toLinear(c) * amount + 1 - amount));
    else fail(`Modificateur de couleur non couvert : ${change.name}`);
  }
  return '#' + rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// --- 4. Géométries : chacune rend des tracés en points, dans la boîte (0,0)-(w,h) de la forme ----------------
// Un tracé : { cmds: [{ op: 'M' | 'L' | 'C' | 'Z', pts: [[x, y], …] }], fill: true|false, stroke: true|false }.

const M = (x, y) => ({ op: 'M', pts: [[x, y]] });
const L = (x, y) => ({ op: 'L', pts: [[x, y]] });
const Z = { op: 'Z', pts: [] };
const RAD = Math.PI / 180;

// Arc d'ellipse DrawingML (arcTo) en courbes de Bézier. Angles en degrés, sens horaire à l'écran ; ce sont
// des angles « visuels » (ceux du rayon), convertis ici en angle paramétrique de l'ellipse, comme Office.
function arcTo(cx, cy, rx, ry, startDeg, sweepDeg) {
  const parametric = (deg) => {
    const t = Math.atan2(rx * Math.sin(deg * RAD), ry * Math.cos(deg * RAD));
    return t + 2 * Math.PI * Math.round((deg * RAD - t) / (2 * Math.PI)); // même tour que l'angle d'origine
  };
  const t0 = parametric(startDeg);
  const t1 = parametric(startDeg + sweepDeg);
  const pieces = Math.max(1, Math.ceil(Math.abs(t1 - t0) / (Math.PI / 2) - 1e-9)); // au plus 90° par courbe
  const step = (t1 - t0) / pieces;
  const k = (4 / 3) * Math.tan(step / 4);
  const cmds = [];
  for (let i = 0; i < pieces; i++) {
    const a = t0 + i * step, b = a + step;
    cmds.push({ op: 'C', pts: [
      [cx + rx * (Math.cos(a) - k * Math.sin(a)), cy + ry * (Math.sin(a) + k * Math.cos(a))],
      [cx + rx * (Math.cos(b) + k * Math.sin(b)), cy + ry * (Math.sin(b) - k * Math.cos(b))],
      [cx + rx * Math.cos(b), cy + ry * Math.sin(b)],
    ] });
  }
  return cmds;
}

// Point de l'ellipse vu sous l'angle visuel deg (formules cat2/sat2 des formes prédéfinies).
function ellipsePoint(cx, cy, rx, ry, deg) {
  const t = Math.atan2(rx * Math.sin(deg * RAD), ry * Math.cos(deg * RAD));
  return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
}

// Balayage horaire de l'angle from à l'angle to, dans ]0°, 360°] (formule swAng des formes prédéfinies).
const clockwiseSweep = (from, to) => (to - from > 0 ? to - from : to - from + 360);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Formes prédéfinies, d'après presetShapeDefinitions.xml. adj = valeurs d'ajustement lues dans a:avLst.
const PRESETS = {
  line: (w, h) => [{ cmds: [M(0, 0), L(w, h)], fill: false, stroke: true }],
  straightConnector1: (w, h) => PRESETS.line(w, h),

  ellipse: (w, h) => [{ cmds: [M(0, h / 2), ...arcTo(w / 2, h / 2, w / 2, h / 2, 180, 360), Z], fill: true, stroke: true }],

  // Rectangle à deux coins coupés du même côté : adj1 = coins du haut, adj2 = coins du bas.
  snip2SameRect(w, h, adj) {
    const side = Math.min(w, h);
    const top = (side * clamp(adj.adj1 ?? 16667, 0, 50000)) / 100000;
    const bottom = (side * clamp(adj.adj2 ?? 0, 0, 50000)) / 100000;
    const cmds = [M(top, 0), L(w - top, 0), L(w, top), L(w, h - bottom), L(w - bottom, h), L(bottom, h), L(0, h - bottom), L(0, top), Z];
    return [{ cmds, fill: true, stroke: true }];
  },

  // Arc : adj1 = angle de départ, adj2 = angle de fin (60000e de degré). Le secteur est rempli sans trait,
  // l'arc seul porte le trait.
  arc(w, h, adj) {
    const start = clamp(adj.adj1 ?? 16200000, 0, 21599999) / 60000;
    const end = clamp(adj.adj2 ?? 0, 0, 21599999) / 60000;
    const first = M(...ellipsePoint(w / 2, h / 2, w / 2, h / 2, start));
    const curve = arcTo(w / 2, h / 2, w / 2, h / 2, start, clockwiseSweep(start, end));
    return [
      { cmds: [first, ...curve, L(w / 2, h / 2), Z], fill: true, stroke: false },
      { cmds: [first, ...curve], fill: false, stroke: true },
    ];
  },

  // Arc plein : adj1 = angle de départ, adj2 = angle de fin, adj3 = épaisseur (100000e du petit côté).
  blockArc(w, h, adj) {
    const start = clamp(adj.adj1 ?? 10800000, 0, 21599999) / 60000;
    const end = clamp(adj.adj2 ?? 0, 0, 21599999) / 60000;
    const thickness = (Math.min(w, h) * clamp(adj.adj3 ?? 25000, 0, 50000)) / 100000;
    const sweep = clockwiseSweep(start, end);
    const rx = w / 2, ry = h / 2;
    const cmds = [
      M(...ellipsePoint(rx, ry, rx, ry, start)),
      ...arcTo(rx, ry, rx, ry, start, sweep),
      L(...ellipsePoint(rx, ry, rx - thickness, ry - thickness, end)),
      ...arcTo(rx, ry, rx - thickness, ry - thickness, end, -sweep),
      Z,
    ];
    return [{ cmds, fill: true, stroke: true }];
  },
};

// Forme libre (a:custGeom) : les points de chaque a:path sont exprimés dans son repère w × h.
function customGeometry(custGeom, w, h) {
  return child(custGeom, 'a:pathLst').children.map((pathNode) => {
    const sx = w / Number(pathNode.attrs.w), sy = h / Number(pathNode.attrs.h);
    const cmds = pathNode.children.map((cmd) => {
      const op = { 'a:moveTo': 'M', 'a:lnTo': 'L', 'a:cubicBezTo': 'C', 'a:close': 'Z' }[cmd.name] || fail(`Commande de tracé non couverte : ${cmd.name}`);
      return { op, pts: cmd.children.map((pt) => [Number(pt.attrs.x) * sx, Number(pt.attrs.y) * sy]) };
    });
    if (cmds.some((c) => c.pts.flat().some(Number.isNaN))) fail('Point de tracé non numérique (formule) : non couvert');
    // Un tracé qui revient exactement à son point de départ est fermé : même géométrie, mais le dernier
    // coin reçoit un vrai joint au lieu de deux bouts de trait juxtaposés.
    const first = cmds[0].pts[0], last = cmds.at(-1).pts.at(-1);
    if (last && cmds.length > 2 && first[0] === last[0] && first[1] === last[1]) cmds.push(Z);
    return { cmds, fill: pathNode.attrs.fill !== 'none', stroke: pathNode.attrs.stroke !== '0' };
  });
}

// --- 5. Placement : groupes imbriqués, puis retournements et rotation de la forme ------------------------------

function readXfrm(xfrm) {
  const box = (offName, extName) => {
    const off = child(xfrm, offName).attrs, ext = child(xfrm, extName).attrs;
    return { x: Number(off.x), y: Number(off.y), w: Number(ext.cx), h: Number(ext.cy) };
  };
  return {
    box: box('a:off', 'a:ext'),
    childBox: child(xfrm, 'a:chOff') && box('a:chOff', 'a:chExt'),
    rotation: Number(xfrm.attrs.rot || 0) / 60000,
    flipH: xfrm.attrs.flipH === '1',
    flipV: xfrm.attrs.flipV === '1',
  };
}

// Place une boîte du repère enfant d'un groupe (chOff, chExt) dans le repère du groupe (off, ext).
function throughGroup({ box, childBox }, b) {
  const sx = box.w / childBox.w, sy = box.h / childBox.h;
  return { x: box.x + (b.x - childBox.x) * sx, y: box.y + (b.y - childBox.y) * sy, w: b.w * sx, h: b.h * sy };
}

// Même centre, largeur et hauteur échangées.
const swapSides = (b) => ({ x: b.x + b.w / 2 - b.h / 2, y: b.y + b.h / 2 - b.w / 2, w: b.h, h: b.w });

// Rend les éléments à dessiner de tout ce que contient un groupe, dans l'ordre du document.
// place(boîte) amène une boîte du repère enfant de ce groupe jusqu'au repère du pictogramme (en EMU).
function collectGroup(theme, group, place, items = []) {
  for (const node of group.children) {
    if (node.name === 'xdr:nvGrpSpPr' || node.name === 'xdr:grpSpPr') continue;
    if (node.name === 'xdr:grpSp') {
      const xfrm = readXfrm(child(child(node, 'xdr:grpSpPr'), 'a:xfrm'));
      if (xfrm.rotation || xfrm.flipH || xfrm.flipV) fail(`Groupe tourné ou retourné, non couvert : ${shapeName(node)}`);
      collectGroup(theme, node, (b) => place(throughGroup(xfrm, b)), items);
    } else if (node.name === 'xdr:sp' || node.name === 'xdr:cxnSp') {
      items.push(...shapeItems(theme, node, place));
    } else fail(`Élément non couvert dans ${shapeName(group)} : ${node.name}`);
  }
  return items;
}

// --- 6. Une forme : géométrie placée, remplissage, trait, pointes de flèche -----------------------------------

function shapeItems(theme, node, place) {
  const spPr = child(node, 'xdr:spPr');
  const xfrm = readXfrm(child(spPr, 'a:xfrm'));

  // Mise à l'échelle par les groupes. Une forme tournée d'environ 90° ou 270° occupe à l'écran une boîte
  // aux côtés échangés : c'est cette boîte-là que le groupe étire, sinon la forme se décale de ses voisines.
  const turns = ((xfrm.rotation % 360) + 360) % 360;
  const sideways = (turns >= 45 && turns < 135) || (turns >= 225 && turns < 315);
  const placed = sideways ? swapSides(place(swapSides(xfrm.box))) : place(xfrm.box);
  const [x, y, w, h] = [placed.x, placed.y, placed.w, placed.h].map((v) => v / EMU_PER_PT);

  // Du repère de la forme au repère du pictogramme : retournements, puis rotation, autour du centre.
  const cos = Math.cos(xfrm.rotation * RAD), sin = Math.sin(xfrm.rotation * RAD);
  const toIcon = ([px, py]) => {
    const dx = (px - w / 2) * (xfrm.flipH ? -1 : 1), dy = (py - h / 2) * (xfrm.flipV ? -1 : 1);
    return [x + w / 2 + dx * cos - dy * sin, y + h / 2 + dx * sin + dy * cos];
  };

  const prstGeom = child(spPr, 'a:prstGeom');
  let paths;
  if (prstGeom) {
    const adj = {};
    for (const gd of child(prstGeom, 'a:avLst')?.children || []) adj[gd.attrs.name] = Number(gd.attrs.fmla.replace('val ', ''));
    const preset = PRESETS[prstGeom.attrs.prst] || fail(`Forme prédéfinie non couverte : ${prstGeom.attrs.prst} (${shapeName(node)})`);
    paths = preset(w, h, adj);
  } else {
    paths = customGeometry(child(spPr, 'a:custGeom') || fail(`Forme sans géométrie : ${shapeName(node)}`), w, h);
  }
  for (const p of paths) p.cmds = p.cmds.map((c) => ({ op: c.op, pts: c.pts.map(toIcon) }));

  const fill = resolveFill(theme, node, spPr);
  const line = resolveLine(theme, node, spPr);
  const items = [];
  for (const p of paths) {
    const item = { cmds: p.cmds, fill: p.fill ? fill : null, line: p.stroke ? line : null };
    if (!item.fill && !item.line) continue;
    const arrows = item.line ? [arrowHead(item, 'head'), arrowHead(item, 'tail')].filter(Boolean) : [];
    items.push(item, ...arrows);
  }
  return items;
}

// Remplissage : celui de spPr, sinon celui du style (fillRef ; idx 0 = aucun). Rend « #RRGGBB » ou null.
function resolveFill(theme, node, spPr) {
  const ref = child(child(node, 'xdr:style'), 'a:fillRef');
  const index = Number(ref?.attrs.idx || 0);
  const fillNode = spPr.children.find((c) => /Fill$/.test(c.name)) || (index > 0 ? theme.fills[index - 1] : null);
  if (!fillNode || fillNode.name === 'a:noFill') return null;
  if (fillNode.name !== 'a:solidFill') fail(`Remplissage non couvert : ${fillNode.name} (${shapeName(node)})`);
  return resolveColor(theme, fillNode.children[0], ref?.children[0]);
}

// Trait : le a:ln du thème désigné par lnRef (idx 0 = aucun), surchargé par le a:ln de spPr. Rend null sans trait.
function resolveLine(theme, node, spPr) {
  const ref = child(child(node, 'xdr:style'), 'a:lnRef');
  const index = Number(ref?.attrs.idx || 0);
  const layers = [child(spPr, 'a:ln'), index > 0 ? theme.lines[index - 1] : null].filter(Boolean);
  const attr = (name) => layers.find((l) => l.attrs[name] !== undefined)?.attrs[name];
  const part = (test) => layers.map((l) => l.children.find((c) => test.test(c.name))).find(Boolean);

  const fillNode = part(/Fill$/);
  if (!fillNode || fillNode.name === 'a:noFill') return null;
  if (fillNode.name !== 'a:solidFill') fail(`Trait non couvert : ${fillNode.name} (${shapeName(node)})`);
  if ((attr('cmpd') || 'sng') !== 'sng') fail(`Trait composé non couvert (${shapeName(node)})`);

  const width = Number(attr('w') ?? 9525) / EMU_PER_PT;
  const dash = part(/^a:prstDash$/)?.attrs.val || 'solid';
  const join = part(/^a:(round|bevel|miter)$/);
  const end = (name) => {
    const e = part(new RegExp(`^a:${name}$`));
    return e && e.attrs.type !== 'none' ? { type: e.attrs.type, w: e.attrs.w || 'med', len: e.attrs.len || 'med' } : null;
  };
  return {
    color: resolveColor(theme, fillNode.children[0], ref?.children[0]),
    width,
    dash: dash === 'solid' ? null : (DASHES[dash] || fail(`Tireté non couvert : ${dash}`)).map((n) => n * width),
    cap: { flat: 'butt', sq: 'square', rnd: 'round' }[attr('cap') || 'flat'] || fail(`Bout de trait inconnu : ${attr('cap')}`),
    join: join ? join.name.slice(2) : 'round',
    miterLimit: join?.name === 'a:miter' ? Number(join.attrs.lim ?? 800000) / 100000 : null,
    head: end('headEnd'), // au début du tracé
    tail: end('tailEnd'), // à la fin du tracé
  };
}

// Pointe de flèche dessinée en polygone, orientée selon le trait ; le trait est raccourci pour ne pas
// dépasser de la pointe. Seuls les traits droits (M, L) sont couverts. Modifie item.cmds.
function arrowHead(item, which) {
  const spec = item.line[which];
  if (!spec) return null;
  if (item.cmds.length !== 2 || item.cmds[1].op !== 'L') fail('Pointe de flèche sur un tracé non droit : non couvert');
  const [tipCmd, otherCmd] = which === 'tail' ? [item.cmds[1], item.cmds[0]] : [item.cmds[0], item.cmds[1]];
  const [tx, ty] = tipCmd.pts[0], [ox, oy] = otherCmd.pts[0];
  const lineLength = Math.hypot(tx - ox, ty - oy);
  const ux = (tx - ox) / lineLength, uy = (ty - oy) / lineLength; // direction du trait, vers la pointe

  const base = Math.max(item.line.width, MIN_ARROW_LINE);
  const length = base * (ARROW_FACTOR[spec.len] || fail(`Longueur de pointe inconnue : ${spec.len}`));
  const halfWidth = (base * (ARROW_FACTOR[spec.w] || fail(`Largeur de pointe inconnue : ${spec.w}`))) / 2;
  const at = (back, side) => [tx - ux * back - uy * side, ty - uy * back + ux * side]; // recul le long du trait, écart de côté
  const notch = { triangle: length, stealth: length * STEALTH_NOTCH }[spec.type] ?? fail(`Type de pointe non couvert : ${spec.type}`);

  const corners = [at(0, 0), at(length, halfWidth), ...(spec.type === 'stealth' ? [at(notch, 0)] : []), at(length, -halfWidth)];
  tipCmd.pts[0] = at(Math.min(notch, lineLength), 0); // le trait s'arrête à la base de la pointe
  return { cmds: [...corners.map(([px, py], i) => (i ? L(px, py) : M(px, py))), Z], fill: item.line.color, line: null };
}

// --- 7. Écriture du SVG ---------------------------------------------------------------------------------------

const format = (n) => String(Math.round(n * 100) / 100 || 0); // 2 décimales ; « || 0 » évite « -0 »

// Points d'un tracé, courbes échantillonnées : sert à la boîte englobante.
function samplePoints(cmds) {
  const points = [];
  let current;
  for (const { op, pts } of cmds) {
    if (op === 'C') {
      const [p0, p1, p2, p3] = [current, ...pts];
      for (let i = 1; i <= 16; i++) {
        const t = i / 16, u = 1 - t;
        points.push([0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]));
      }
    } else points.push(...pts);
    if (pts.length) current = pts.at(-1);
  }
  return points;
}

function toSvg(items, comment) {
  // Boîte englobante : les formes, plus la demi-épaisseur de leur trait, plus la marge.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const item of items) {
    const half = item.line ? item.line.width / 2 : 0;
    for (const [px, py] of samplePoints(item.cmds)) {
      minX = Math.min(minX, px - half); maxX = Math.max(maxX, px + half);
      minY = Math.min(minY, py - half); maxY = Math.max(maxY, py + half);
    }
  }
  minX -= MARGIN; minY -= MARGIN; maxX += MARGIN; maxY += MARGIN;

  const lines = items.map(({ cmds, fill, line }) => {
    const d = cmds.map(({ op, pts }) => op + pts.map(([px, py]) => `${format(px - minX)} ${format(py - minY)}`).join(' ')).join('');
    const attrs = [`d="${d}"`];
    if (fill) attrs.push(`fill="${fill}"`);
    if (line) {
      attrs.push(`stroke="${line.color}"`, `stroke-width="${format(line.width)}"`);
      if (line.dash) attrs.push(`stroke-dasharray="${line.dash.map(format).join(' ')}"`);
      if (line.cap !== 'butt') attrs.push(`stroke-linecap="${line.cap}"`);
      if (line.join !== 'miter') attrs.push(`stroke-linejoin="${line.join}"`);
      if (line.miterLimit && line.miterLimit !== 8) attrs.push(`stroke-miterlimit="${format(line.miterLimit)}"`);
    }
    return `  <path ${attrs.join(' ')}/>`;
  });
  // Les valeurs par défaut du thème du classeur (bout plat, joint en onglet, limite 8) sont posées sur la racine.
  return [
    `<!-- ${comment} -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${format(maxX - minX)} ${format(maxY - minY)}" fill="none" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="8">`,
    ...lines,
    '</svg>',
    '',
  ].join('\n');
}

// --- 8. Programme -----------------------------------------------------------------------------------------------

function main() {
  const workbooks = fs.readdirSync(path.join(ROOT, WORKBOOK_DIR)).filter((f) => f.endsWith('.xlsm'));
  if (workbooks.length !== 1) fail(`Un seul classeur .xlsm attendu dans ${WORKBOOK_DIR}/, trouvé : ${workbooks.length}`);
  const readEntry = openZip(path.join(ROOT, WORKBOOK_DIR, workbooks[0]));
  const theme = readTheme(readEntry(THEME));
  const outer = descendants(parseXml(readEntry(DRAWING)), 'xdr:grpSp').find((g) => shapeName(g) === OUTER_GROUP) || fail(`Groupe introuvable : ${OUTER_GROUP}`);
  const subGroups = outer.children.filter((c) => c.name === 'xdr:grpSp');
  const xfrmOf = (group) => readXfrm(child(child(group, 'xdr:grpSpPr'), 'a:xfrm'));

  // Vérifications de la table : tous les sous-groupes, une fois chacun, dans l'ordre des rangs de la feuille
  // (de haut en bas) et dans l'ordre d'operations.json.
  if (outer.children.some((c) => c.name === 'xdr:sp' || c.name === 'xdr:cxnSp')) fail(`${OUTER_GROUP} contient des formes hors sous-groupe`);
  const centerY = (group) => { const { box } = xfrmOf(group); return box.y + box.h / 2; };
  const byRow = [...subGroups].sort((a, b) => centerY(a) - centerY(b)).map(shapeName);
  if (byRow.join('|') !== ICONS.map(([groupName]) => groupName).join('|')) fail(`La table ICONS ne suit plus l'ordre des rangs de la feuille :\n${byRow.join(', ')}`);
  const operations = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data/operations.json'), 'utf8')).operations.map((o) => o.operation);
  if (operations.join('|') !== ICONS.map(([, operation]) => operation).join('|')) fail("La table ICONS ne suit plus l'ordre de site/data/operations.json");

  for (const [groupName, operation] of ICONS) {
    const group = subGroups.find((g) => shapeName(g) === groupName);
    // Repère du pictogramme = repère enfant de « Group 4 » : l'étirement de Group 4 lui-même, qui ne vient
    // que de l'ancrage du dessin aux cellules de la feuille, n'est pas appliqué (voir README.md).
    const items = collectGroup(theme, group, (b) => throughGroup(xfrmOf(group), b));
    const comment = `${operation} : classeur « ${WORKBOOK_TITLE} », feuille « ${SHEET_NAME} », ${OUTER_GROUP} › ${groupName}. `
      + 'Généré par reference/pictogrammes-du-classeur/convertir.mjs : ne pas retoucher à la main.';
    const file = path.join(OUT_DIR, operationSlug(operation) + '.svg');
    fs.writeFileSync(path.join(ROOT, file), toSvg(items, comment.replaceAll('--', '- -')));
    console.log(`${file}  <-  ${groupName} (${items.length} éléments)`);
  }
}

main();
