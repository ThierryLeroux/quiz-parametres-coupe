// Tests de reference/lot-exercices/generer.mjs (D84) : le fichier d'import du lot d'exercices, composé à partir d'un
// export. L'export d'essai vient de la semence du dépôt, mise dans l'état de la production du 2026-09-29 : des tables
// qui portent les facteurs de vitesse (D83), l'opération « Chanfreinage » renommée « Chanfreinage / chambrage » dans
// la dernière version des tables — trois outils de la banque portent encore l'ancien nom —, et « Vc et vitesse de
// rotation » publié. Les deux images sont de faux PNG : seule leur signature est lue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildLot, readArguments, summaryLines } from '../reference/lot-exercices/generer.mjs';
import { draftErrors, draftFromExercise } from '../site/js/exercice.js';
import { adoptSpeedFactor, prefillSpeedFactors } from '../site/js/facteur-vitesse.js';
import { toolRows } from '../site/js/ui/home-data.js';
import { assembleDraft } from '../worker/catalogue.js';
import { EXPORT_FORMAT, previewQuestions } from '../worker/editeur.js';
import { aleaAGraine, lireFichier } from './aide.js';

const T2 = 'm10-tournage-vc-rpm-2';
const RAISON = 'Un seul insert de carbure en périphérie : vitesse non réduite';
const QUESTIONS = { [T2]: 36, 'm10-tournage-avances': 27, 'm10-fraisage-vc-rpm': 34, 'm10-fraisage-avances': 15, 'm30-fraisage-cn': 43, 'm40-tournage-cn': 39, 'f50-synthese': 37 };

const png = (text) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.from(text)]);
const IMAGES = new Map([['outil_a_rainurer.png', png('outil à rainurer')], ['fraise_a_fileter.png', png('fraise à fileter')]]);

// Un export comme celui de la production, à partir de la semence.
async function exportDEssai() {
  const materiaux = await lireFichier('data/materiaux.json');
  const operations = await lireFichier('data/operations.json');
  const { outils } = await lireFichier('data/outils.json');
  const avant = prefillSpeedFactors({ materiaux: { ...materiaux, revision: 'A2026_r5' }, operations: { ...operations, revision: 'A2026_r5' } });
  const apres = { materiaux: { ...avant.materiaux, revision: 'A2026_r6' }, operations: { ...avant.operations, revision: 'A2026_r6', operations: avant.operations.operations.map((op) => (op.operation === 'Chanfreinage' ? { ...op, operation: 'Chanfreinage / chambrage' } : op)) } };
  // La banque a fait son passage avec A2026_r5 (D83) ; le renommage de A2026_r6 ne l'a pas touchée.
  const banque = outils.map((outil, i) => ({ id: outil.id, outil: adoptSpeedFactor({ ...outil, image: outil.id }, avant.operations.operations.find((op) => op.operation === outil.operation)), rang: i + 1, archive_le: null }));
  const fichier = await lireFichier('exercices/m10-tournage-vc-rpm.json');
  const brouillon = { ...draftFromExercise({ ...fichier, id: T2, champs_masques: ['vf'] }, banque.map((b) => b.outil)), titre: 'M10 — Tournage : Vc et vitesse de rotation', cours: 'M10' };
  return {
    format: EXPORT_FORMAT,
    exporte_le: '2026-09-29T09:47:18.395Z',
    tables_reference: [{ id: 'A2026_r5', ...avant, creee_le: '2026-09-29T00:08:44.865Z' }, { id: 'A2026_r6', ...apres, creee_le: '2026-09-29T00:13:04.837Z' }],
    brouillon_tables: null,
    presentation_tables: { contenu: null, modifiee_le: null, enseignant: null, historique: [] },
    banque,
    historique_banque: [],
    exercices: [{ id: T2, brouillon, tables_id: 'A2026_r6', archive_le: null, cree_le: '2026-09-27T10:17:17.634Z', publie_le: '2026-09-29T00:13:04.837Z', rang: 1, versions: [{ numero: 1, contenu: brouillon, tables_id: 'A2026_r6', publiee_le: '2026-09-29T00:13:04.837Z' }], presentation: { contenu: null, modifiee_le: null, enseignant: null, historique: [] } }],
    images: banque.map(({ id, outil }) => ({ id, nom: outil.nom, usage: 'outil', type: 'image/png', taille: 10, empreinte: createHash('sha256').update(id).digest('hex'), creee_le: '2026-09-24T12:00:00.000Z', archivee_le: null, contenu: '' })),
  };
}

const EXPORT = await exportDEssai();
const LOT = buildLot(EXPORT, IMAGES);

test("buildLot : aucun problème ; le fichier est au format d'un export, sur les tables les plus récentes", () => {
  assert.deepEqual(LOT.problemes, []);
  assert.equal(LOT.lot.format, EXPORT_FORMAT);
  assert.deepEqual(LOT.lot.tables_reference.map((t) => t.id), ['A2026_r6']);
  assert.ok(LOT.lot.exercices.every((e) => e.tables_id === 'A2026_r6'));
  assert.equal(LOT.lot._lot.export_source, EXPORT.exporte_le);
});

test('banque : 6 outils ajoutés au dernier rang, 3 modifiés, aucun retiré, les autres intacts', () => {
  const { banque } = LOT.lot;
  assert.equal(banque.length, EXPORT.banque.length + 6);
  assert.deepEqual(banque.slice(-6).map((b) => [b.id, b.rang]), [['dtfnr', 30], ['outil_a_rainurer', 31], ['nine9_ebavurage', 32], ['fraise_a_surfacer_3po_5', 33], ['fraise_a_surfacer_3po_7', 34], ['fraise_a_fileter', 35]]);
  const modifies = EXPORT.banque.filter((b, i) => JSON.stringify(b) !== JSON.stringify(banque[i])).map((b) => b.id);
  assert.deepEqual(modifies.sort(), ['fraise_82_degres', 'nine9_90_degres', 'outil_a_chambrer']);
  assert.deepEqual(LOT.resume.banque.retires, []);
  assert.deepEqual(LOT.resume.banque.ajoutes.map((t) => t.id), banque.slice(-6).map((b) => b.id));
  assert.deepEqual(LOT.resume.banque.modifies.map((t) => t.id).sort(), ['fraise_82_degres', 'nine9_90_degres', 'outil_a_chambrer']);
});

test('banque : les deux Nine9 forcés à 1 avec la raison, l’outil à chambrer en acier rapide et hérité, les opérations de A2026_r6', () => {
  const outil = (id) => LOT.lot.banque.find((b) => b.id === id).outil;
  for (const id of ['nine9_90_degres', 'nine9_ebavurage']) assert.deepEqual([outil(id).fact_vc, outil(id).fact_vc_raison], [1, RAISON]);
  assert.deepEqual(outil('outil_a_chambrer').materiaux_outil, ['Acier rapide']);
  assert.ok(!('fact_vc' in outil('outil_a_chambrer')) && !('fact_vc_raison' in outil('outil_a_chambrer')));
  for (const id of ['nine9_90_degres', 'outil_a_chambrer', 'fraise_82_degres']) assert.equal(outil(id).operation, 'Chanfreinage / chambrage');
  assert.equal(outil('nine9_ebavurage').operation, 'Chanfreinage / ébavurage');
  assert.deepEqual(LOT.lot.banque.filter((b) => b.outil.fact_vc !== undefined).map((b) => b.id).sort(), ['nine9_90_degres', 'nine9_ebavurage']);
  // Les six nouveaux : 14 groupes usinés (tous sauf la classe O), les dimensions du MVLNR pour les deux outils de tour.
  for (const b of LOT.lot.banque.slice(-6)) assert.ok(b.outil.groupes_materiaux_usinables.length === 14 && b.outil.groupes_materiaux_usinables.every((g) => !g.startsWith('O - ')), b.id);
  assert.deepEqual(outil('dtfnr').dimensions, outil('mvlnr').dimensions);
  assert.deepEqual(outil('outil_a_rainurer').dimensions, outil('mvlnr').dimensions);
  assert.deepEqual([outil('dtfnr').limite_rpm, outil('fraise_a_fileter').limite_rpm], [3000, 10000]);
  assert.deepEqual([outil('fraise_a_surfacer_3po_7').nb_dents_min, outil('fraise_a_surfacer_3po_7').nb_dents_max], [7, 7]);
});

test('images : deux fiches avec leur contenu, l’identifiant et l’empreinte que le serveur calculerait', () => {
  assert.equal(LOT.lot.images.length, 2);
  for (const image of LOT.lot.images) {
    const octets = Buffer.from(image.contenu, 'base64');
    assert.equal(image.empreinte, createHash('sha256').update(octets).digest('hex'));
    assert.equal(image.id, `img-${image.empreinte.slice(0, 16)}`);
    assert.deepEqual([image.usage, image.type, image.taille, image.archivee_le], ['outil', 'image/png', octets.length, null]);
  }
  const outil = (id) => LOT.lot.banque.find((b) => b.id === id).outil;
  assert.deepEqual([outil('outil_a_rainurer').image, outil('fraise_a_fileter').image], LOT.lot.images.map((i) => i.id));
  assert.deepEqual(['dtfnr', 'nine9_ebavurage', 'fraise_a_surfacer_3po_5', 'fraise_a_surfacer_3po_7'].map((id) => outil(id).image), ['mclnr', 'nine9_90_degres', 'fraise_a_surfacer', 'fraise_a_surfacer']);
  assert.deepEqual(LOT.resume.images_manquantes, LOT.lot.images.map((i) => i.id));
});

test('exercices : 14 brouillons sans erreur, chaque démo juste avant son exercice, les questions de la grille', () => {
  const ids = LOT.lot.exercices.map((e) => e.id);
  assert.deepEqual(ids, Object.keys(QUESTIONS).flatMap((id) => [`demo-${id}`, id]));
  const tables = LOT.lot.tables_reference[0];
  for (const e of LOT.lot.exercices) {
    assert.deepEqual(draftErrors(e.brouillon, tables), [], e.id);
    const questions = e.brouillon.outils.reduce((n, copie) => n + copie.reussites_requises, 0);
    assert.equal(questions, e.id.startsWith('demo-') ? 1 : QUESTIONS[e.id], e.id);
    assert.ok(!('facteur_vitesse_donne' in e.brouillon) && !('liste' in e.brouillon) && !('groupes' in e.brouillon), e.id);
    assert.deepEqual(e.brouillon.materiaux_outil, e.id.includes('m10-') ? ['Acier rapide', 'Insert de carbure de tungstène'] : undefined, e.id);
  }
  assert.deepEqual(LOT.resume.exercices_ajoutes, ids.filter((id) => id !== T2));
  assert.deepEqual(LOT.resume.exercices_remplaces, [T2]);
  assert.deepEqual(LOT.resume.versions_ajoutees, []);
});

test('exercices : les réglages, la règle du Ø 1/16 po, aucun outil axial aux avances du M10', () => {
  const brouillon = (id) => LOT.lot.exercices.find((e) => e.id === id).brouillon;
  assert.deepEqual([brouillon(T2).champs_evalues, brouillon(T2).champs_masques], [['vc', 'n'], ['vf']]);
  assert.deepEqual([brouillon('m10-fraisage-vc-rpm').champs_evalues, brouillon('m10-fraisage-vc-rpm').champs_masques], [['vc', 'n'], ['vf']]);
  for (const id of ['m10-tournage-avances', 'm10-fraisage-avances', 'm30-fraisage-cn', 'm40-tournage-cn', 'f50-synthese']) assert.deepEqual([brouillon(id).champs_evalues, brouillon(id).champs_masques], [['vc', 'fz', 'n', 'f', 'vf'], undefined], id);
  const copie = (id, outil) => brouillon(id).outils.find((c) => c.id === outil);
  assert.deepEqual([copie('f50-synthese', 'foret_fractionnaire').dimensions.length, copie('f50-synthese', 'foret_fractionnaire').dimensions[0].libelle], [61, 'Ø 1/16 po']);
  assert.equal(copie('m30-fraisage-cn', 'foret_a_numero').dimensions[0].libelle, '#52');
  assert.equal(copie('m40-tournage-cn', 'foret_metrique').dimensions[0].libelle, 'Ø 1.6 mm');
  assert.equal(copie(T2, 'foret_a_lettre').dimensions.length, 26);
  assert.equal(copie(`demo-${T2}`, 'foret_fractionnaire').dimensions.length, 61);
  const axiaux = /^(foret|alesoir|taraud|outil_a_chambrer|fraise_82|nine9_90)/;
  for (const id of ['m10-tournage-avances', 'm10-fraisage-avances']) assert.deepEqual(brouillon(id).outils.filter((c) => axiaux.test(c.id)), [], id);
  assert.equal(brouillon('f50-synthese').outils.length, LOT.lot.banque.length);
  assert.deepEqual(brouillon('demo-f50-synthese').outils.map((c) => [c.id, c.reussites_requises]), [['fraise_a_fileter', 1]]);
});

// Les questions qu'un brouillon du lot donne, tirées par le moteur comme dans l'aperçu de la Gestion du contenu.
function questionsDe(id, nombre) {
  const entree = LOT.lot.exercices.find((e) => e.id === id);
  const { exercise, data } = assembleDraft(id, entree.brouillon, LOT.lot.tables_reference[0]);
  return { exercise, data, questions: previewQuestions(exercise, data, aleaAGraine(84), nombre) };
}

test('fraise à fileter : ses dimensions de la plus petite à la plus grande, le gabarit sans « Ø » en double (fin de D84, point 7)', () => {
  const outil = LOT.lot.banque.find((b) => b.id === 'fraise_a_fileter').outil;
  assert.deepEqual(outil.dimensions, [{ libelle: 'Ø 0.180 po — 20 à 32 filets/po', valeur: 0.18 }, { libelle: 'Ø 0.240 po — 18 à 28 filets/po', valeur: 0.24 }, { libelle: 'Ø 0.300 po — 16 à 28 filets/po', valeur: 0.3 }]);
  assert.equal(outil.format_identifiant, 'Fraise à fileter [IdDia] - [NbDent] dents');
  for (const id of ['demo-f50-synthese', 'f50-synthese']) assert.deepEqual(LOT.lot.exercices.find((e) => e.id === id).brouillon.outils.find((c) => c.id === 'fraise_a_fileter').dimensions, outil.dimensions, id);
  // Ce que l'étudiant lit : la question, puis la plage de la page de l'exercice et de l'attestation.
  const { exercise, data, questions } = questionsDe('demo-f50-synthese', 40);
  assert.deepEqual([...new Set(questions.map((q) => q.identifiant))].sort(), ['Fraise à fileter Ø 0.180 po — 20 à 32 filets/po - 4 dents', 'Fraise à fileter Ø 0.240 po — 18 à 28 filets/po - 4 dents', 'Fraise à fileter Ø 0.300 po — 16 à 28 filets/po - 4 dents']);
  assert.equal(toolRows(exercise, data)[0].range, 'Ø 0.180 po — 20 à 32 filets/po à Ø 0.300 po — 16 à 28 filets/po');
  // L'avance : 0.004 × Ø par dent, soit 0.0012 po/dent à Ø 0.300 po.
  assert.equal(questions.find((q) => q.dimension.startsWith('Ø 0.300')).reponses.feedPerTooth, '0.0012');
});

test('Nine9 d’ébavurage : « Outil à ébavurer Nine9 : [IdDia] », dans la banque et dans toutes ses copies ; le Nine9 90 degrés garde sa nomenclature (fin de D84, point 9)', () => {
  const gabarit = (outils, id) => outils.find((o) => o.id === id)?.format_identifiant;
  const banque = LOT.lot.banque.map((b) => b.outil);
  assert.equal(gabarit(banque, 'nine9_ebavurage'), 'Outil à ébavurer Nine9 : [IdDia]');
  assert.equal(gabarit(banque, 'nine9_90_degres'), 'Outil à chanfreiner Nine9 : [IdDia]');
  assert.equal(gabarit(banque, 'nine9_90_degres'), gabarit(EXPORT.banque.map((b) => b.outil), 'nine9_90_degres'));
  const avec = (id) => LOT.lot.exercices.filter((e) => e.brouillon.outils.some((c) => c.id === id));
  assert.deepEqual(avec('nine9_ebavurage').map((e) => e.id), ['m10-fraisage-vc-rpm', 'm10-fraisage-avances', 'm30-fraisage-cn', 'f50-synthese']);
  for (const e of avec('nine9_ebavurage')) assert.equal(gabarit(e.brouillon.outils, 'nine9_ebavurage'), 'Outil à ébavurer Nine9 : [IdDia]', e.id);
  for (const e of avec('nine9_90_degres')) assert.equal(gabarit(e.brouillon.outils, 'nine9_90_degres'), 'Outil à chanfreiner Nine9 : [IdDia]', e.id);
  // Ce que l'étudiant lit : aux Ø que les deux outils partagent, deux titres différents.
  const titres = (outil) => [...new Set(questionsDe('m10-fraisage-vc-rpm', 600).questions.filter((q) => q.outil_id === outil).map((q) => q.identifiant))].sort();
  assert.deepEqual(titres('nine9_ebavurage'), ['Outil à ébavurer Nine9 : Ø 1/2 po', 'Outil à ébavurer Nine9 : Ø 1/4 po', 'Outil à ébavurer Nine9 : Ø 3/8 po']);
  assert.deepEqual(titres('nine9_90_degres'), ['Outil à chanfreiner Nine9 : Ø 1/2 po', 'Outil à chanfreiner Nine9 : Ø 3/4 po', 'Outil à chanfreiner Nine9 : Ø 3/8 po', 'Outil à chanfreiner Nine9 : Ø 5/8 po']);
});

test('« Vc et vitesse de rotation » : son brouillon part du sien, ses versions ne sont pas dans le fichier, titre et cours en direct', () => {
  const entree = LOT.lot.exercices.find((e) => e.id === T2);
  assert.ok(!('versions' in entree));
  assert.deepEqual([entree.brouillon.titre, entree.brouillon.cours], ['Tournage — Exercice 2', 'M10 — Tournage']);
  assert.deepEqual(entree.presentation.contenu, { titre: 'Tournage — Exercice 2', cours: 'M10 — Tournage', liste: true, outils: [] });
  assert.deepEqual(LOT.resume.presentations_exercices, [{ id: T2, remplacee: true, historique: 0 }]);
  // Une copie gardée du brouillon garde ce qu'on y avait changé ; ses réussites et ses dimensions suivent la grille.
  const modifie = structuredClone(EXPORT);
  modifie.exercices[0].brouillon.outils.find((c) => c.id === 'foret_a_lettre').commentaire = 'Note changée dans le brouillon';
  const lot = buildLot(modifie, IMAGES);
  assert.deepEqual(lot.problemes, []);
  const copie = lot.lot.exercices.find((e) => e.id === T2).brouillon.outils.find((c) => c.id === 'foret_a_lettre');
  assert.deepEqual([copie.commentaire, copie.reussites_requises], ['Note changée dans le brouillon', 2]);
  assert.ok(lot.remarques.some((note) => note.includes('foret_a_lettre') && note.includes('commentaire')));
  // Les nouveaux exercices n'ont pas de présentation : leur titre et leur cours sont ceux de leur brouillon.
  assert.ok(LOT.lot.exercices.filter((e) => e.id !== T2).every((e) => !('presentation' in e)));
});

test('le même export donne le même fichier ; relancé sur un export pris après l’import, rien ne s’ajoute deux fois', () => {
  assert.equal(JSON.stringify(buildLot(EXPORT, IMAGES).lot), JSON.stringify(LOT.lot));
  const apres = structuredClone(EXPORT);
  apres.banque = structuredClone(LOT.lot.banque);
  apres.images = [...apres.images, ...LOT.lot.images];
  apres.exercices = [
    ...LOT.lot.exercices.filter((e) => e.id !== T2).map((e, i) => ({ ...e, rang: i + 2, cree_le: '2026-09-29T23:00:00.000Z', publie_le: null, versions: [], presentation: { contenu: null, modifiee_le: null, enseignant: null, historique: [] } })),
    { ...apres.exercices[0], brouillon: LOT.lot.exercices.find((e) => e.id === T2).brouillon, presentation: { ...LOT.lot.exercices.find((e) => e.id === T2).presentation } },
  ];
  const second = buildLot(apres, IMAGES);
  assert.deepEqual(second.problemes, []);
  assert.equal(JSON.stringify(second.lot.banque), JSON.stringify(LOT.lot.banque));
  assert.equal(JSON.stringify(second.lot.exercices), JSON.stringify(LOT.lot.exercices));
  assert.deepEqual([second.resume.banque.ajoutes, second.resume.banque.modifies, second.resume.banque.retires, second.resume.exercices_ajoutes, second.resume.images_manquantes, second.resume.presentations_exercices], [[], [], [], [], [], []]);
});

test('rien n’est rendu quand quelque chose cloche : image absente, titre en double, outil de la grille retiré, export illisible', () => {
  assert.match(buildLot(EXPORT, new Map()).problemes.join('\n'), /outil_a_rainurer\.png.*introuvable/);
  assert.match(buildLot(EXPORT, new Map([...IMAGES, ['fraise_a_fileter.png', new Uint8Array([1, 2, 3])]])).problemes.join('\n'), /fraise_a_fileter\.png.*PNG/);

  const doublon = structuredClone(EXPORT);
  doublon.exercices.push({ ...structuredClone(doublon.exercices[0]), id: 'un-autre', rang: 2, versions: [{ ...doublon.exercices[0].versions[0], contenu: { ...doublon.exercices[0].brouillon, titre: 'fraisage — exercice 3' } }] });
  assert.match(buildLot(doublon, IMAGES).problemes.join('\n'), /m10-fraisage-avances.*« Fraisage — Exercice 3 ».*un-autre.*D74/);
  // Archivé, le même titre ne gêne plus.
  doublon.exercices[1].archive_le = '2026-09-29T12:00:00.000Z';
  assert.deepEqual(buildLot(doublon, IMAGES).problemes, []);

  const sans = structuredClone(EXPORT);
  sans.banque = sans.banque.filter((b) => b.id !== 'mvlnr');
  assert.ok(buildLot(sans, IMAGES).problemes.length > 0);
  assert.equal(buildLot(sans, IMAGES).lot, null);
  assert.match(buildLot({ format: 'autre' }, IMAGES).problemes[0], /n'est pas un export/);
});

test('un exercice publié hors du lot est signalé : il reste à l’accueil', () => {
  const copie = structuredClone(EXPORT);
  copie.exercices.push({ ...structuredClone(copie.exercices[0]), id: `${T2}-2`, rang: 2, brouillon: { ...copie.exercices[0].brouillon, titre: 'Une copie' }, versions: [{ ...copie.exercices[0].versions[0], contenu: { ...copie.exercices[0].brouillon, titre: 'Une copie' } }] });
  const lot = buildLot(copie, IMAGES);
  assert.deepEqual(lot.problemes, []);
  assert.ok(lot.remarques.some((note) => note.includes(`${T2}-2`) && note.includes("reste à l'accueil")));
  assert.deepEqual(lot.resume.exercices_gardes, [`${T2}-2`]);
});

test('summaryLines et readArguments', () => {
  const lignes = summaryLines(LOT);
  assert.ok(lignes.includes('Banque — inchangés : 26 ; retirés : 0.'));
  assert.ok(lignes.some((ligne) => ligne.startsWith('| `f50-synthese` | F50 — Synthèse du fraisage et du tournage | F50 | 35 |') && ligne.endsWith('| 37 |')));
  assert.deepEqual(readArguments(['export.json', '--sortie', 'lot.json', '--images', 'dossier']), { source: 'export.json', images: 'dossier', sortie: 'lot.json' });
  assert.throws(() => readArguments([]), /L'export est requis/);
  assert.throws(() => readArguments(['export.json', '--remote']), /argument inconnu/);
});
