// Lecture et écriture de PNG en JavaScript pur (node:zlib seulement, aucune dépendance) : de quoi
// détourer les petites images de chaleur et de copeaux (detourer-copeaux.mjs). Couvre ce dont on a
// besoin — 8 bits par canal, non entrelacé, tous les types de couleur — et refuse le reste plutôt
// que de deviner.
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }; // gris, RVB, palette, gris + alpha, RVBA

// Table du CRC-32 des blocs PNG.
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(bytes) {
  let c = -1;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// Lit un PNG : { width, height, rgba } — rgba : Uint8Array de 4 octets par pixel, ligne par ligne.
export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error("Ce n'est pas un PNG.");
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let palette = null;
  let paletteAlpha = null;
  const idat = [];
  for (let at = 8; at < buffer.length;) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString('latin1', at + 4, at + 8);
    const data = buffer.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      if (depth !== 8) throw new Error(`PNG à ${depth} bits par canal : seul 8 est lu.`);
      if (!(colorType in CHANNELS)) throw new Error(`Type de couleur PNG inconnu : ${colorType}.`);
      if (data[12] !== 0) throw new Error('PNG entrelacé : non lu.');
    } else if (type === 'PLTE') palette = Buffer.from(data);
    else if (type === 'tRNS') paletteAlpha = Buffer.from(data);
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    at += 12 + length;
  }
  if (width === 0 || height === 0 || idat.length === 0) throw new Error('PNG incomplet.');

  // Chaque ligne commence par son type de filtre ; on le défait ligne par ligne (PNG, §9).
  const channels = CHANNELS[colorType];
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = y * stride;
    const prev = (y - 1) * stride;
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? pixels[out + i - channels] : 0;
      const b = y > 0 ? pixels[prev + i] : 0;
      const c = y > 0 && i >= channels ? pixels[prev + i - channels] : 0;
      let value = line[i];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) value += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`Filtre PNG inconnu : ${filter}.`);
      pixels[out + i] = value & 0xff;
    }
  }

  // Tout en RVBA.
  const rgba = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p += 1) {
    const s = p * channels;
    const d = p * 4;
    if (colorType === 6) { rgba[d] = pixels[s]; rgba[d + 1] = pixels[s + 1]; rgba[d + 2] = pixels[s + 2]; rgba[d + 3] = pixels[s + 3]; }
    else if (colorType === 2) { rgba[d] = pixels[s]; rgba[d + 1] = pixels[s + 1]; rgba[d + 2] = pixels[s + 2]; rgba[d + 3] = 255; }
    else if (colorType === 0) { rgba[d] = rgba[d + 1] = rgba[d + 2] = pixels[s]; rgba[d + 3] = 255; }
    else if (colorType === 4) { rgba[d] = rgba[d + 1] = rgba[d + 2] = pixels[s]; rgba[d + 3] = pixels[s + 1]; }
    else {
      if (palette === null) throw new Error('PNG à palette sans PLTE.');
      const index = pixels[s];
      rgba[d] = palette[index * 3]; rgba[d + 1] = palette[index * 3 + 1]; rgba[d + 2] = palette[index * 3 + 2];
      rgba[d + 3] = paletteAlpha !== null && index < paletteAlpha.length ? paletteAlpha[index] : 255;
    }
  }
  return { width, height, rgba };
}

// Écrit un PNG RVBA 8 bits. Chaque ligne prend le filtre qui la rend la plus « plate » (somme des
// valeurs absolues la plus petite : l'heuristique habituelle), puis zlib au niveau 9.
export function encodePng({ width, height, rgba }) {
  const stride = width * 4;
  const filtered = Buffer.alloc((stride + 1) * height);
  const candidate = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const row = rgba.subarray(y * stride, (y + 1) * stride);
    const above = y > 0 ? rgba.subarray((y - 1) * stride, y * stride) : null;
    let best = null;
    let bestSum = Infinity;
    for (let filter = 0; filter < 5; filter += 1) {
      let sum = 0;
      for (let i = 0; i < stride; i += 1) {
        const a = i >= 4 ? row[i - 4] : 0;
        const b = above ? above[i] : 0;
        const c = above && i >= 4 ? above[i - 4] : 0;
        let value = row[i];
        if (filter === 1) value -= a;
        else if (filter === 2) value -= b;
        else if (filter === 3) value -= (a + b) >> 1;
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value -= pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        value &= 0xff;
        candidate[i] = value;
        sum += value < 128 ? value : 256 - value;
      }
      if (sum < bestSum) { bestSum = sum; best = filter; filtered[y * (stride + 1)] = filter; candidate.copy(filtered, y * (stride + 1) + 1); }
    }
    if (best === null) throw new Error('Filtre PNG introuvable.');
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(filtered, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}
