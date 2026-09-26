// Règles des images (jalon 7b, décision D56) : photos d'outils et pictogrammes d'opérations,
// stockées dans D1 en blob. Ici les règles pures — identifiants, types reconnus par leurs premiers
// octets, base64, en-têtes de service, où une image est utilisée — ; le SQL est dans base.js, le
// SVG assaini dans svg.js, les routes dans index.js.

import { operationSlug } from '../site/js/ui/sheets-data.js';
import { CLASS_IMAGE_KEYS, completeTables } from '../site/js/tables.js';
import { SvgError, sanitizeSvg } from './svg.js';

// Les trois usages : la photo d'un outil (`image` de l'outil), le pictogramme d'une opération, et
// (D64) l'image d'une classe ISO (chaleur, forme de copeaux : `image_chaleur`, `image_copeaux`).
export const USAGES = ['outil', 'operation', 'classe'];

// Les types acceptés. Un type se vérifie sur les premiers octets (magicType), jamais sur ce que dit le navigateur.
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

// La taille maximale d'une image stockée : une photo réduite dans le navigateur (800 px, JPEG) fait
// 40 à 150 Ko ; une ligne D1 peut faire 2 Mo. Le corps de la requête (base64 : × 1,37) est limité à part.
export const MAX_IMAGE_BYTES = 600_000;
export const UPLOAD_BODY_MAX = 1_000_000;

// Identifiant d'image : celui des images semées est le nom de l'outil ou de l'opération (« mvlnr »,
// « percage ») ; celui d'une image téléversée vient de son empreinte (imageIdFor) — même contenu,
// même identifiant, sur toute base.
export const IMAGE_ID = /^[a-z0-9]+([_-][a-z0-9]+)*$/;
export const isImageId = (id) => typeof id === 'string' && id.length <= 80 && IMAGE_ID.test(id);
export const imageIdFor = (hashHex) => `img-${hashHex.slice(0, 16)}`;

// Le nom lisible d'une image téléversée : le nom du fichier sans son extension, nettoyé.
export function cleanImageName(name) {
  const text = String(name ?? '').replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, 80) || 'image';
}

// Le type d'une image d'après ses premiers octets (PNG, JPEG, WebP), ou null. Le SVG est du texte : il
// n'est reconnu qu'après assainissement (readUpload).
export function magicType(bytes) {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

// --- base64 et empreinte ------------------------------------------------------------------------------------

export function decodeBase64(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length % 4 !== 0) return null;
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export const encoder = new TextEncoder();
export const decoder = new TextDecoder();

// L'empreinte SHA-256 d'un contenu, en hexadécimal.
export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Le contenu d'une image tel qu'il sort de la base : D1 rend un ArrayBuffer, node:sqlite un Uint8Array.
export const toBytes = (content) => (content instanceof Uint8Array ? content : new Uint8Array(content));

// Ce qu'on donne à D1 pour un BLOB : un ArrayBuffer (le seul type documenté), sans octets voisins.
export const toBlob = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

// --- Un téléversement ----------------------------------------------------------------------------------------

export class ImageError extends Error {}

// Lit un téléversement { nom, usage, type, contenu (base64) } et rend ce qui sera stocké :
// { id, nom, usage, type, taille, empreinte, bytes, retires }. Le type est celui des octets, pas
// celui annoncé ; un SVG est assaini (svg.js) ou refusé ; une image trop grande est refusée.
export async function readUpload(body) {
  if (!USAGES.includes(body?.usage)) throw new ImageError(`« usage » doit être ${USAGES.map((u) => `« ${u} »`).join(' ou ')}.`);
  const declared = body.type;
  if (!IMAGE_TYPES.includes(declared)) throw new ImageError(`Type d'image inconnu : « ${declared} » (acceptés : PNG, JPEG, WebP, SVG).`);
  const received = decodeBase64(body.contenu);
  if (received === null || received.length === 0) throw new ImageError('Le contenu de l\'image est absent ou illisible (base64 attendu).');
  if (received.length > MAX_IMAGE_BYTES) throw new ImageError(`L'image fait ${Math.round(received.length / 1000)} Ko : au plus ${MAX_IMAGE_BYTES / 1000} Ko (elle doit être réduite avant l'envoi).`);

  let bytes = received;
  let type = declared;
  let retires = [];
  if (declared === 'image/svg+xml') {
    try {
      const cleaned = sanitizeSvg(decoder.decode(received));
      bytes = encoder.encode(cleaned.svg);
      retires = cleaned.retires;
    } catch (error) {
      if (error instanceof SvgError) throw new ImageError(error.message);
      throw error;
    }
  } else {
    type = magicType(received);
    if (type === null) throw new ImageError("Ce fichier n'est pas une image PNG, JPEG ou WebP : ses premiers octets ne correspondent pas.");
    if (type !== declared) throw new ImageError(`Le fichier est en ${type}, pas en ${declared}.`);
  }
  const empreinte = await sha256Hex(bytes);
  return { id: imageIdFor(empreinte), nom: cleanImageName(body.nom), usage: body.usage, type, taille: bytes.length, empreinte, bytes, retires };
}

// --- Service d'une image (/images/<id>) -------------------------------------------------------------------------

// Les en-têtes d'une image servie : type exact, jamais deviné (nosniff), cache d'un an — une image ne
// change jamais sous le même identifiant —, et, pour un SVG, une politique qui interdit tout script.
export function imageHeaders(row) {
  const headers = {
    'content-type': row.type === 'image/svg+xml' ? 'image/svg+xml; charset=utf-8' : row.type,
    'content-length': String(row.taille),
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
    etag: `"${row.empreinte}"`,
  };
  if (row.type === 'image/svg+xml') headers['content-security-policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  return headers;
}

// La fiche d'une image telle que l'éditeur la reçoit (sans le contenu).
export const imageView = ({ id, nom, usage, type, taille, empreinte, creee_le, archivee_le }) => ({ id, nom, usage, type, taille, empreinte, creee_le, archivee_le });

// --- Où une image est utilisée --------------------------------------------------------------------------------
// Une image utilisée par une version publiée ne se supprime jamais (D56) ; elle s'archive. Les
// brouillons, la banque et les tables comptent aussi : supprimer une image qu'un brouillon nomme
// laisserait un trou.
//   versions : [{ exercice_id, numero, contenu }] ; exercices : [{ id, brouillon }] ; banque : [{ id, outil }] ;
//   tables   : [{ id, materiaux, operations }] — un pictogramme d'opération est `pictogramme`, sinon le nom de
//              l'opération en slug ; les images d'une classe ISO sont celles de la classe complétée (D64 : une
//              version d'avant nomme les images de la semence)
export function imageUsages(id, { versions = [], exercices = [], banque = [], tables = [] }) {
  const inTools = (tools) => (Array.isArray(tools) ? tools : []).some((tool) => tool?.image === id);
  const pictoOf = (op) => op?.pictogramme ?? operationSlug(String(op?.operation ?? ''));
  const inTables = (t) => (Array.isArray(t.operations?.operations) ? t.operations.operations : []).some((op) => pictoOf(op) === id)
    || completeTables({ materiaux: t.materiaux, operations: t.operations }).materiaux.classes_iso.some((c) => CLASS_IMAGE_KEYS.some((key) => c?.[key] === id));
  return {
    versions: versions.filter((v) => inTools(v.contenu?.outils)).map((v) => `${v.exercice_id} v${v.numero}`),
    brouillons: exercices.filter((e) => inTools(e.brouillon?.outils)).map((e) => e.id),
    banque: banque.filter((b) => b.outil?.image === id).map((b) => b.id),
    tables: tables.filter(inTables).map((t) => t.id),
  };
}

export const isUsed = (usages) => Object.values(usages).some((list) => list.length > 0);

// « versions m10-tournage-vc v1, v2 · brouillon m10-tournage-vc · banque mvlnr » — pour un refus de suppression.
export function usagesText(usages) {
  const parts = [];
  if (usages.versions.length > 0) parts.push(`version${usages.versions.length > 1 ? 's' : ''} publiée${usages.versions.length > 1 ? 's' : ''} ${usages.versions.join(', ')}`);
  if (usages.brouillons.length > 0) parts.push(`brouillon${usages.brouillons.length > 1 ? 's' : ''} ${usages.brouillons.join(', ')}`);
  if (usages.banque.length > 0) parts.push(`banque ${usages.banque.join(', ')}`);
  if (usages.tables.length > 0) parts.push(`tables ${usages.tables.join(', ')}`);
  return parts.join(' · ');
}
