// Tests du détourage des images de chaleur et de copeaux (reference/semence-d1/detourer-copeaux.mjs,
// png.mjs) : le PNG relu est celui écrit, le fond atteint depuis les bords devient transparent avec
// un bord adouci et le blanc enclavé reste opaque, la réduction ne dépasse jamais 256 px et n'agrandit
// pas, et les douze fichiers de site/img/copeaux/ sont exactement ce que le script tire des originaux.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodePng, encodePng } from '../reference/semence-d1/png.mjs';
import { BANDE_PX, DETOURES, EROSION_PX, ORIGINAUX, PLANCHER, SEUIL_BLANC, backgroundMask, cutOut, decrireOriginal, detourer, dilate, fitWidth, LARGEUR_MAX, listerOriginaux } from '../reference/semence-d1/detourer-copeaux.mjs';

// Une image de w × h pixels, chacun donné par une fonction (x, y) → [r, v, b, a].
const image = (width, height, pixel) => {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) rgba.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, rgba };
};
const pixelAt = ({ width, rgba }, x, y) => [...rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)];

test('png.mjs : un PNG écrit puis relu rend les mêmes pixels ; les originaux du dépôt se lisent (RVBA 8 bits, non entrelacé)', () => {
  const source = image(5, 3, (x, y) => [x * 50, y * 100, (x + y) * 20, x === 2 ? 128 : 255]);
  const relu = decodePng(encodePng(source));
  assert.deepEqual([relu.width, relu.height, [...relu.rgba]], [5, 3, [...source.rgba]]);
  assert.throws(() => decodePng(Buffer.from('pas un png')), /PNG/);
  const original = decodePng(readFileSync(new URL('Chaleur groupe P.png', ORIGINAUX)));
  assert.deepEqual([original.width, original.height, original.rgba.length], [236, 154, 236 * 154 * 4]);
});

test('cutOut : fond transparent, objet érodé d’un pixel, bande de 3 px adoucie selon la blancheur et démélangée du blanc, objet opaque au-delà, blanc enclavé intact', () => {
  assert.deepEqual([SEUIL_BLANC, EROSION_PX, BANDE_PX, PLANCHER, LARGEUR_MAX], [244, 1, 3, 200, 340]);
  // 17 × 17 : fond blanc, un carré gris (120) de x, y = 3 à 13 ; dedans, un gris clair (230) près du bord et un au centre, un blanc enclavé près du bord.
  const special = { '5,8': [230, 230, 230], '8,8': [230, 230, 230], '8,6': [255, 255, 255] };
  const source = image(17, 17, (x, y) => {
    if (special[`${x},${y}`]) return [...special[`${x},${y}`], 255];
    if (x >= 3 && x <= 13 && y >= 3 && y <= 13) return [120, 120, 120, 255];
    return [255, 255, 255, 255];
  });
  const mask = backgroundMask(source);
  assert.equal(mask[3 * 17 + 3], 0); // le carré n'est pas du fond…
  assert.equal(dilate(mask, 17, 17)[3 * 17 + 3], 1); // … mais son anneau extérieur l'est après l'érosion (8-connexité : le coin aussi)
  assert.equal(dilate(mask, 17, 17)[4 * 17 + 4], 0);
  const out = cutOut(source);
  assert.deepEqual(pixelAt(out, 0, 0), [0, 0, 0, 0]); // le fond
  assert.deepEqual(pixelAt(out, 3, 8), [0, 0, 0, 0]); // l'anneau érodé, même gris foncé
  assert.deepEqual(pixelAt(out, 4, 8), [120, 120, 120, 255]); // dans la bande, mais plus sombre que 200 : opaque
  // Gris clair à 2 px du fond : alpha (255 − 230) / (255 − 200) = 0,4545…, couleur démélangée du blanc.
  const alpha = 25 / 55;
  const [r, , , a] = pixelAt(out, 5, 8);
  assert.equal(a, Math.round(alpha * 255));
  assert.equal(r, Math.round((230 - (1 - alpha) * 255) / alpha));
  assert.deepEqual(pixelAt(out, 8, 8), [230, 230, 230, 255]); // au-delà de la bande : opaque, tel quel
  assert.deepEqual(pixelAt(out, 8, 6), [255, 255, 255, 255]); // blanc enclavé, à 2 px du fond : intact
});

test('cutOut, image synthétique : un disque de couleur anticrénelé sur blanc ne garde aucun pixel d’alpha > 0,5 plus clair que 200 sur les trois canaux à moins de 3 px du fond', () => {
  // Disque de rayon 20, bleu (40, 120, 200), anticrénelé par suréchantillonnage 4 × 4 et composé sur blanc.
  const color = [40, 120, 200];
  const source = image(64, 64, (x, y) => {
    let covered = 0;
    for (let sy = 0; sy < 4; sy += 1) for (let sx = 0; sx < 4; sx += 1) if (Math.hypot(x + (sx + 0.5) / 4 - 32, y + (sy + 0.5) / 4 - 32) <= 20) covered += 1;
    const k = covered / 16;
    return [...color.map((c) => Math.round(k * c + (1 - k) * 255)), 255];
  });
  const out = cutOut(source);
  const transparent = (x, y) => x < 0 || y < 0 || x >= 64 || y >= 64 || out.rgba[(y * 64 + x) * 4 + 3] === 0;
  const fringe = [];
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      const [pr, pg, pb, pa] = pixelAt(out, x, y);
      if (pa <= 127 || !(pr > 200 && pg > 200 && pb > 200)) continue;
      let near = false;
      for (let dy = -3; dy <= 3 && !near; dy += 1) for (let dx = -3; dx <= 3; dx += 1) if (Math.hypot(dx, dy) < 3 && transparent(x + dx, y + dy)) { near = true; break; }
      if (near) fringe.push(`(${x},${y}) ${pr},${pg},${pb},${pa}`);
    }
  }
  assert.deepEqual(fringe, []);
  assert.deepEqual(pixelAt(out, 0, 0), [0, 0, 0, 0]);
  assert.deepEqual(pixelAt(out, 32, 32), [...color, 255]); // le cœur du disque, tel quel
});

test('fitWidth : jamais agrandi, réduit à 340 px de large (le double de l’affichage maximal) en moyennant (alpha prémultiplié)', () => {
  const small = image(237, 4, () => [1, 2, 3, 255]);
  assert.equal(fitWidth(small), small); // 237 px : gardé tel quel
  const big = image(680, 170, (x) => (x < 340 ? [200, 0, 0, 255] : [0, 0, 200, 0]));
  const reduced = fitWidth(big);
  assert.deepEqual([reduced.width, reduced.height], [340, 85]);
  assert.deepEqual(pixelAt(reduced, 0, 0), [200, 0, 0, 255]);
  assert.deepEqual(pixelAt(reduced, 339, 84), [0, 0, 0, 0]); // entièrement transparent : couleur nulle
  const mixed = fitWidth(image(4, 2, (x) => (x === 0 ? [100, 100, 100, 255] : [255, 255, 255, 0])), 1);
  assert.deepEqual(pixelAt(mixed, 0, 0), [100, 100, 100, 64]); // deux pixels opaques sur huit : alpha 2 × 255 / 8 ; la couleur est celle des pixels visibles
});

test('les six originaux se nomment « Chaleur groupe P.png », un par classe P, M, K, N, S, H (plus d’image de copeaux, D66) ; les fichiers détourés du dépôt sont ceux que le script produit', () => {
  const originaux = listerOriginaux();
  assert.deepEqual(originaux.map((o) => o.id), ['copeaux-h-chaleur', 'copeaux-k-chaleur', 'copeaux-m-chaleur', 'copeaux-n-chaleur', 'copeaux-p-chaleur', 'copeaux-s-chaleur']);
  assert.equal(decrireOriginal('Copeaux groupe P.png'), null);
  assert.deepEqual(decrireOriginal('Chaleur groupe P.png'), { id: 'copeaux-p-chaleur', classe: 'P', type: 'chaleur' });
  assert.equal(decrireOriginal('chaleur P.png'), null);
  for (const { fileName, id } of originaux) {
    const result = detourer(readFileSync(new URL(fileName, ORIGINAUX)));
    assert.equal(Buffer.compare(readFileSync(new URL(`${id}.png`, DETOURES)), result.png), 0, `${id}.png n'est pas ce que le script produit : relancer node reference/semence-d1/detourer-copeaux.mjs`);
    assert.ok(result.width <= LARGEUR_MAX);
    // Détouré : des pixels transparents (le fond), des pixels opaques (la pièce et l'outil), et rien d'agrandi.
    const out = decodePng(result.png);
    let transparent = 0;
    let opaque = 0;
    for (let i = 3; i < out.rgba.length; i += 4) { if (out.rgba[i] === 0) transparent += 1; else if (out.rgba[i] === 255) opaque += 1; }
    assert.ok(transparent > 0.1 * out.width * out.height && opaque > 0.3 * out.width * out.height, `${id} : ${transparent} transparents, ${opaque} opaques`);
  }
});
