// Détoure les images de chaleur et de forme de copeaux par classe ISO (site/img/copeaux/originaux/,
// deux par classe : « Chaleur groupe P.png », « Copeaux groupe P.png ») et écrit un PNG à fond
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
// 2. Bord adouci : les pixels à un pixel de la frontière fond / objet (des deux côtés, 8-voisinage)
//    reçoivent un alpha partiel, en rampe sur la blancheur — opaque à min(R, V, B) ≤ SEUIL_BLANC,
//    transparent à ≥ BLANC (252), linéaire entre —, et leur couleur est « démélangée » du blanc
//    (l'original a été composé sur blanc : c = a·objet + (1 − a)·255), pour qu'aucun liseré clair
//    n'apparaisse sur le fond nuit. Le reste du fond est transparent, le reste de l'objet opaque.
// 3. Jamais agrandi ; réduit au plus grand côté COTE_MAX (256 px) si plus grand (moyenne des pixels,
//    alpha prémultiplié). Les originaux font 237 px au plus : aucun n'est réduit aujourd'hui.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { decodePng, encodePng } from './png.mjs';

export const SEUIL_BLANC = 244;
export const BLANC = 252;
export const COTE_MAX = 256;

const ROOT = new URL('../../', import.meta.url);
export const ORIGINAUX = new URL('site/img/copeaux/originaux/', ROOT);
export const DETOURES = new URL('site/img/copeaux/', ROOT);

// « Chaleur groupe P.png » → { id: 'copeaux-p-chaleur', classe: 'P', type: 'chaleur' } ; null si le nom ne dit pas la classe et le type.
export function decrireOriginal(fileName) {
  const match = /^(Chaleur|Copeaux) groupe ([A-Z])\.png$/.exec(fileName);
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

// Le PNG détouré : fond transparent, bord adouci d'un pixel de chaque côté de la frontière, couleurs démélangées du blanc.
export function cutOut(image, { threshold = SEUIL_BLANC, white = BLANC } = {}) {
  const { width, height, rgba } = image;
  const mask = backgroundMask(image, threshold);
  const out = new Uint8Array(rgba.length);
  const nearBoundary = (p) => {
    const x = p % width;
    const y = (p - x) / width;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < width && yy < height && mask[yy * width + xx] !== mask[p]) return true;
      }
    }
    return false;
  };
  for (let p = 0; p < width * height; p += 1) {
    const d = p * 4;
    const [r, g, b] = [rgba[d], rgba[d + 1], rgba[d + 2]];
    const alphaIn = rgba[d + 3] / 255; // les originaux sont opaques ; un alpha existant est respecté
    let alpha;
    if (nearBoundary(p)) {
      const whiteness = Math.min(r, g, b);
      alpha = Math.max(0, Math.min(1, (white - whiteness) / (white - threshold)));
    } else alpha = mask[p] === 1 ? 0 : 1;
    alpha *= alphaIn;
    if (alpha <= 0) continue; // transparent : (0, 0, 0, 0)
    if (alpha < 1) {
      // Démélange du blanc : c = a·objet + (1 − a)·255  →  objet = (c − (1 − a)·255) / a.
      const unblend = (c) => Math.max(0, Math.min(255, Math.round((c - (1 - alpha) * 255) / alpha)));
      out[d] = unblend(r); out[d + 1] = unblend(g); out[d + 2] = unblend(b);
    } else { out[d] = r; out[d + 1] = g; out[d + 2] = b; }
    out[d + 3] = Math.round(alpha * 255);
  }
  return { width, height, rgba: out };
}

// Réduit au plus grand côté maxSide (jamais agrandi) : moyenne des pixels source de chaque pixel cible, alpha prémultiplié.
export function fitInside(image, maxSide = COTE_MAX) {
  const { width, height, rgba } = image;
  const scale = Math.min(1, maxSide / Math.max(width, height));
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
  const image = fitInside(cutOut(decodePng(buffer)));
  const png = encodePng(image);
  return { png, width: image.width, height: image.height, avant: buffer.length, apres: png.length };
}

// Les douze originaux, dans l'ordre des noms : [{ fileName, id, classe, type }].
export function listerOriginaux() {
  return readdirSync(ORIGINAUX).filter((name) => name.endsWith('.png')).sort()
    .map((fileName) => { const info = decrireOriginal(fileName); if (info === null) throw new Error(`Nom d'original inattendu : « ${fileName} » (attendu « Chaleur groupe P.png » ou « Copeaux groupe P.png »)`); return { fileName, ...info }; });
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
