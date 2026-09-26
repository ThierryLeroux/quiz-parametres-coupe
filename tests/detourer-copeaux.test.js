// Tests du détourage des images de chaleur et de copeaux (reference/semence-d1/detourer-copeaux.mjs,
// png.mjs) : le PNG relu est celui écrit, le fond atteint depuis les bords devient transparent avec
// un bord adouci et le blanc enclavé reste opaque, la réduction ne dépasse jamais 256 px et n'agrandit
// pas, et les douze fichiers de site/img/copeaux/ sont exactement ce que le script tire des originaux.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodePng, encodePng } from '../reference/semence-d1/png.mjs';
import { BLANC, COTE_MAX, DETOURES, ORIGINAUX, SEUIL_BLANC, backgroundMask, cutOut, decrireOriginal, detourer, fitInside, listerOriginaux } from '../reference/semence-d1/detourer-copeaux.mjs';

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

test('cutOut : le blanc atteint depuis un bord devient transparent, le blanc enclavé reste opaque, la frontière a un alpha partiel démélangé du blanc', () => {
  // 9 × 9 : fond blanc, un carré gris de 5 × 5 au centre, un pixel blanc au milieu du carré, un pixel « presque blanc » (248) collé au carré.
  const source = image(9, 9, (x, y) => {
    if (x === 4 && y === 4) return [255, 255, 255, 255];
    if (x >= 2 && x <= 6 && y >= 2 && y <= 6) return [120, 120, 120, 255];
    if (x === 7 && y === 4) return [248, 248, 248, 255];
    return [255, 255, 255, 255];
  });
  const mask = backgroundMask(source);
  assert.equal(mask[4 * 9 + 4], 0); // le blanc enclavé n'est pas du fond
  assert.equal(mask[7 * 9 + 4], 1); // 248 ≥ 244 : du fond, au bord
  const out = cutOut(source);
  assert.deepEqual(pixelAt(out, 0, 0), [0, 0, 0, 0]); // coin : transparent
  assert.deepEqual(pixelAt(out, 4, 4), [255, 255, 255, 255]); // le blanc intérieur reste opaque
  assert.deepEqual(pixelAt(out, 4, 3), [120, 120, 120, 255]); // intérieur de l'objet, loin de la frontière : opaque
  assert.deepEqual(pixelAt(out, 2, 2), [120, 120, 120, 255]); // au bord de l'objet mais gris foncé : alpha 1 (rampe saturée)
  // Le pixel presque blanc collé au carré : dans la bande, alpha (252 − 248) / (252 − 244) = 0,5, couleur démélangée du blanc.
  const [r, , , a] = pixelAt(out, 7, 4);
  assert.equal(a, 128);
  assert.equal(r, Math.round((248 - 0.5 * 255) / 0.5)); // 241
  // Un pixel du fond à un pixel de la frontière mais blanc pur : transparent quand même.
  assert.deepEqual(pixelAt(out, 1, 4), [0, 0, 0, 0]);
  assert.deepEqual([SEUIL_BLANC, BLANC, COTE_MAX], [244, 252, 256]);
});

test('fitInside : jamais agrandi, réduit au plus grand côté 256 en moyennant (alpha prémultiplié)', () => {
  const small = image(10, 4, () => [1, 2, 3, 255]);
  assert.equal(fitInside(small), small);
  const big = image(512, 128, (x) => (x < 256 ? [200, 0, 0, 255] : [0, 0, 200, 0]));
  const reduced = fitInside(big);
  assert.deepEqual([reduced.width, reduced.height], [256, 64]);
  assert.deepEqual(pixelAt(reduced, 0, 0), [200, 0, 0, 255]);
  assert.deepEqual(pixelAt(reduced, 255, 63), [0, 0, 0, 0]); // entièrement transparent : couleur nulle
  const mixed = fitInside(image(4, 2, (x) => (x === 0 ? [100, 100, 100, 255] : [255, 255, 255, 0])), 1);
  assert.deepEqual(pixelAt(mixed, 0, 0), [100, 100, 100, 64]); // deux pixels opaques sur huit : alpha 2 × 255 / 8 ; la couleur est celle des pixels visibles
});

test('les douze originaux se nomment « Chaleur groupe P.png » / « Copeaux groupe P.png », deux par classe P, M, K, N, S, H ; les fichiers détourés du dépôt sont ceux que le script produit', () => {
  const originaux = listerOriginaux();
  assert.deepEqual(originaux.map((o) => o.id), [
    'copeaux-h-chaleur', 'copeaux-k-chaleur', 'copeaux-m-chaleur', 'copeaux-n-chaleur', 'copeaux-p-chaleur', 'copeaux-s-chaleur',
    'copeaux-h-copeaux', 'copeaux-k-copeaux', 'copeaux-m-copeaux', 'copeaux-n-copeaux', 'copeaux-p-copeaux', 'copeaux-s-copeaux',
  ]);
  assert.deepEqual(decrireOriginal('Chaleur groupe P.png'), { id: 'copeaux-p-chaleur', classe: 'P', type: 'chaleur' });
  assert.equal(decrireOriginal('chaleur P.png'), null);
  for (const { fileName, id } of originaux) {
    const result = detourer(readFileSync(new URL(fileName, ORIGINAUX)));
    assert.equal(Buffer.compare(readFileSync(new URL(`${id}.png`, DETOURES)), result.png), 0, `${id}.png n'est pas ce que le script produit : relancer node reference/semence-d1/detourer-copeaux.mjs`);
    assert.ok(Math.max(result.width, result.height) <= COTE_MAX);
    // Détouré : des pixels transparents (le fond), des pixels opaques (la pièce et l'outil), et rien d'agrandi.
    const out = decodePng(result.png);
    let transparent = 0;
    let opaque = 0;
    for (let i = 3; i < out.rgba.length; i += 4) { if (out.rgba[i] === 0) transparent += 1; else if (out.rgba[i] === 255) opaque += 1; }
    assert.ok(transparent > 0.1 * out.width * out.height && opaque > 0.3 * out.width * out.height, `${id} : ${transparent} transparents, ${opaque} opaques`);
  }
});
