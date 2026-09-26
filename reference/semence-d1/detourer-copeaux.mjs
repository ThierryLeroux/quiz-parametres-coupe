// Détoure les images de chaleur par classe ISO (site/img/copeaux/originaux/, une par classe :
// « Chaleur groupe P.png » ; les images de forme de copeaux ont été retirées, D66) et écrit un PNG à fond
// transparent dans site/img/copeaux/, nommé par l'identifiant d'image de la semence
// (« copeaux-p-chaleur.png », « copeaux-p-copeaux.png » ; migration 0009). JavaScript pur : png.mjs
// lit et écrit le PNG, sans dépendance.
//
// Lancé depuis la racine du dépôt :   node reference/semence-d1/detourer-copeaux.mjs
// Les originaux restent la source ; relancer le script refait les douze fichiers à l'identique.
// Les fichiers détourés sont la semence de la migration 0009 : les changer ici ne change rien en
// production (D56) — c'est l'onglet Images de l'éditeur qui téléverse.
//
// Méthode.
// 1. Remplissage depuis les bords (4-connexité) sur les pixels « proches du blanc » : les trois
//    canaux ≥ SEUIL_BLANC. Ce qui n'est pas atteint depuis un bord reste opaque : le blanc intérieur
//    d'un copeau ou d'un reflet, la pièce et l'outil qui touchent les bords.
//    SEUIL_BLANC = 244, mesuré sur les douze originaux : le pixel le plus clair d'un copeau atteint
//    min(R, V, B) = 240 (Copeaux M, reflet du copeau), le blanc des rendus de chaleur descend rarement
//    sous 252 (bruit) et jamais sous 250 hors des bords ; entre 241 et 249 il n'y a que des pixels
//    d'anticrénelage, au bord du fond. 244 laisse quatre valeurs de marge de chaque côté.
// 2. Érosion de l'objet : le fond est dilaté de EROSION_PX pixel (8-connexité) — l'anneau le plus
//    extérieur de l'objet, fait de pixels d'anticrénelage presque blancs, devient transparent.
// 3. Bande adoucie : sur BANDE_PX pixels à partir de ce fond (distance euclidienne entre centres de
//    pixels), alpha = clamp((255 − min(R, V, B)) / (255 − PLANCHER), 0, 1) — un pixel plus sombre que
//    PLANCHER sur un canal au moins reste opaque ; un gris-blanc devient partiellement transparent —,
//    et la couleur est « démélangée » du blanc (l'original a été composé sur blanc :
//    c = a·objet + (1 − a)·255, donc objet = (c − (1 − a)·255) / a), pour qu'aucun liseré gris-blanc
//    n'apparaisse sur le fond nuit. Au-delà de la bande, l'objet reste opaque. Le blanc intérieur non
//    relié aux bords (min(R, V, B) ≥ SEUIL_BLANC hors du fond : l'intérieur d'un copeau, un reflet)
//    reste intact et opaque, même dans la bande.
//    Avant (première version), seuls les pixels à un pixel de la frontière et entre 244 et 252 étaient
//    adoucis : un liseré gris-blanc restait visible sur le fond nuit.
// 4. Largeur : le double de la largeur d'affichage maximale (170 px sur l'écran Question → LARGEUR_MAX =
//    340 px), pour la netteté sur un écran haute densité — mais seulement si l'original le permet :
//    jamais agrandi. Plus large, il est réduit à 340 px (moyenne des pixels, alpha prémultiplié). Les
//    originaux font 235 à 237 px : ils gardent leur taille, et l'écran limite leur largeur affichée à
//    largeur ÷ 1,5 (heatImageMaxWidth, site/js/ui/sheets-data.js), soit 157 à 158 px CSS.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { decodePng, encodePng } from './png.mjs';

export const SEUIL_BLANC = 244; // remplissage depuis les bords : les trois canaux ≥ 244
export const EROSION_PX = 1; // le fond est dilaté d'un pixel (8-connexité)
export const BANDE_PX = 3; // largeur de la bande adoucie, à partir du fond dilaté (distance euclidienne)
export const PLANCHER = 200; // min(R, V, B) ≤ 200 : opaque ; 255 : transparent ; linéaire entre
export const LARGEUR_MAX = 340; // 2 × 170 px, la largeur d'affichage maximale ; jamais d'agrandissement

const ROOT = new URL('../../', import.meta.url);
export const ORIGINAUX = new URL('site/img/copeaux/originaux/', ROOT);
export const DETOURES = new URL('site/img/copeaux/', ROOT);

// « Chaleur groupe P.png » → { id: 'copeaux-p-chaleur', classe: 'P', type: 'chaleur' } ; null si le nom ne dit pas la classe et le type.
export function decrireOriginal(fileName) {
  const match = /^(Chaleur) groupe ([A-Z])\.png$/.exec(fileName);
  if (!match) return null;
  const type = match[1].toLowerCase();
  return { id: `copeaux-${match[2].toLowerCase()}-${type}`, classe: match[2], type };
}

// Le fond : 1 pour chaque pixel proche du blanc atteint depuis un bord (4-connexité).
export function backgroundMask({ width, height, rgba }, threshold = SEUIL_BLANC) {
  const nearWhite = (p) => rgba[p * 4] >= threshold && rgba[p * 4 + 1] >= threshold && rgba[p * 4 + 2] >= threshold;
  const mask = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x += 1) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y += 1) stack.push(y * width, y * width + width - 1);
  while (stack.length > 0) {
    const p = stack.pop();
    if (mask[p] === 1 || !nearWhite(p)) continue;
    mask[p] = 1;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }
  return mask;
}

// Le fond dilaté de `erosion` pixels (8-connexité) : l'érosion de l'objet.
export function dilate(mask, width, height, erosion = EROSION_PX) {
  let current = mask;
  for (let step = 0; step < erosion; step += 1) {
    const next = Uint8Array.from(current);
    for (let p = 0; p < width * height; p += 1) {
      if (current[p] === 1) continue;
      const x = p % width;
      const y = (p - x) / width;
      search: for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < width && yy < height && current[yy * width + xx] === 1) { next[p] = 1; break search; }
        }
      }
    }
    current = next;
  }
  return current;
}

// Le PNG détouré : fond (dilaté) transparent, bande adoucie de `band` pixels démélangée du blanc,
// objet opaque au-delà, blanc intérieur intact.
export function cutOut(image, { threshold = SEUIL_BLANC, erosion = EROSION_PX, band = BANDE_PX, floor = PLANCHER } = {}) {
  const { width, height, rgba } = image;
  const background = dilate(backgroundMask(image, threshold), width, height, erosion);
  const reach = Math.ceil(band);
  // La distance d'un pixel au fond le plus proche, cherchée dans une fenêtre de ±reach (Infinity au-delà).
  const distanceToBackground = (p) => {
    const x = p % width;
    const y = (p - x) / width;
    let best = Infinity;
    for (let dy = -reach; dy <= reach; dy += 1) {
      for (let dx = -reach; dx <= reach; dx += 1) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < width && yy < height && background[yy * width + xx] === 1) best = Math.min(best, Math.hypot(dx, dy));
      }
    }
    return best;
  };
  const out = new Uint8Array(rgba.length);
  for (let p = 0; p < width * height; p += 1) {
    if (background[p] === 1) continue; // transparent : (0, 0, 0, 0)
    const d = p * 4;
    const [r, g, b] = [rgba[d], rgba[d + 1], rgba[d + 2]];
    const alphaIn = rgba[d + 3] / 255; // les originaux sont opaques ; un alpha existant est respecté
    const whiteness = Math.min(r, g, b);
    // Blanc intérieur (hors du fond, donc non relié aux bords) : intact. Dans la bande : alpha selon la blancheur.
    let alpha = 1;
    if (whiteness < threshold && distanceToBackground(p) <= band) alpha = Math.max(0, Math.min(1, (255 - whiteness) / (255 - floor)));
    alpha *= alphaIn;
    if (alpha <= 0) continue;
    if (alpha < 1) {
      // Démélange du blanc : c = a·objet + (1 − a)·255  →  objet = (c − (1 − a)·255) / a.
      const unblend = (c) => Math.max(0, Math.min(255, Math.round((c - (1 - alpha) * 255) / alpha)));
      out[d] = unblend(r); out[d + 1] = unblend(g); out[d + 2] = unblend(b);
    } else { out[d] = r; out[d + 1] = g; out[d + 2] = b; }
    out[d + 3] = Math.round(alpha * 255);
  }
  return { width, height, rgba: out };
}

// Réduit à la largeur maxWidth (jamais agrandi) : moyenne des pixels source de chaque pixel cible, alpha prémultiplié.
export function fitWidth(image, maxWidth = LARGEUR_MAX) {
  const { width, height, rgba } = image;
  const scale = Math.min(1, maxWidth / width);
  if (scale === 1) return image;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.floor((y * height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / h));
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.floor((x * width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / w));
      let r = 0; let g = 0; let b = 0; let a = 0; let n = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
          const s = (yy * width + xx) * 4;
          const alpha = rgba[s + 3] / 255;
          r += rgba[s] * alpha; g += rgba[s + 1] * alpha; b += rgba[s + 2] * alpha; a += alpha; n += 1;
        }
      }
      const d = (y * w + x) * 4;
      if (a > 0) { out[d] = Math.round(r / a); out[d + 1] = Math.round(g / a); out[d + 2] = Math.round(b / a); out[d + 3] = Math.round((a / n) * 255); }
    }
  }
  return { width: w, height: h, rgba: out };
}

// Un original (Buffer PNG) → { png (Buffer), width, height, avant, apres } : détouré, réduit au besoin, réencodé.
export function detourer(buffer) {
  const image = fitWidth(cutOut(decodePng(buffer)));
  const png = encodePng(image);
  return { png, width: image.width, height: image.height, avant: buffer.length, apres: png.length };
}

// Les douze originaux, dans l'ordre des noms : [{ fileName, id, classe, type }].
export function listerOriginaux() {
  return readdirSync(ORIGINAUX).filter((name) => name.endsWith('.png')).sort()
    .map((fileName) => { const info = decrireOriginal(fileName); if (info === null) throw new Error(`Nom d'original inattendu : « ${fileName} » (attendu « Chaleur groupe P.png »)`); return { fileName, ...info }; });
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  mkdirSync(DETOURES, { recursive: true });
  let totalAvant = 0;
  let totalApres = 0;
  for (const { fileName, id } of listerOriginaux()) {
    const result = detourer(readFileSync(new URL(fileName, ORIGINAUX)));
    writeFileSync(new URL(`${id}.png`, DETOURES), result.png);
    totalAvant += result.avant;
    totalApres += result.apres;
    console.log(`${fileName} → ${id}.png : ${result.width} × ${result.height}, ${result.avant} → ${result.apres} octets`);
  }
  console.log(`total : ${totalAvant} → ${totalApres} octets`);
}
