// Tests de site/js/data.js : lecture et validation des données de référence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TOOL_MATERIAL_KEYS, loadData, parseThread, validateData } from '../site/js/data.js';

const lire = async (nom) => JSON.parse(await readFile(new URL(`../site/data/${nom}`, import.meta.url), 'utf8'));

const presque = (obtenu, attendu, message) => assert.ok(Math.abs(obtenu - attendu) < 1e-9, `${message} : ${obtenu} ≠ ${attendu}`);

// Dimensions de tous les outils de filetage, avec le nom de l'outil pour les messages.
const dimensionsFiletage = async () => {
  const { operations } = await lire('operations.json');
  const { outils } = await lire('outils.json');
  const filetages = new Set(operations.filter((op) => op.avance_egale_pas_filetage).map((op) => op.operation));
  return outils
    .filter((o) => filetages.has(o.operation))
    .flatMap((o) => o.dimensions.map((d) => ({ ...d, outil: o.nom })));
};

test('TOOL_MATERIAL_KEYS : chaque clé existe dans vc_pi_min de chaque matériau', async () => {
  const { materiaux } = await lire('materiaux.json');
  for (const m of materiaux) {
    for (const cle of Object.values(TOOL_MATERIAL_KEYS)) assert.ok(cle in m.vc_pi_min, `groupe ${m.groupe} : ${cle}`);
  }
});

test('parseThread : filetage impérial « Ø-filets/po »', () => {
  assert.deepEqual(parseThread('0.25-20'), { diameter: 0.25, pitch: 1 / 20 });
  assert.deepEqual(parseThread('.3125-18'), { diameter: 0.3125, pitch: 1 / 18 });
  assert.deepEqual(parseThread('1-8'), { diameter: 1, pitch: 1 / 8 });
});

test('parseThread : filetage métrique « ØxPas » converti en pouces', () => {
  assert.deepEqual(parseThread('10x1.5'), { diameter: 10 / 25.4, pitch: 1.5 / 25.4 });
  assert.deepEqual(parseThread('1.6x0.35'), { diameter: 1.6 / 25.4, pitch: 0.35 / 25.4 });
});

test('parseThread : valeur illisible → null', () => {
  for (const valeur of ['abc', '', '0.25-0', '0-20', '10x0', '10x', '10 x 1.5', '1/4-20', 0.25, null, undefined]) {
    assert.equal(parseThread(valeur), null, String(valeur));
  }
});

test('filetages : toutes les valeurs des données sont lisibles', async () => {
  for (const d of await dimensionsFiletage()) assert.notEqual(parseThread(d.valeur), null, `${d.outil} : ${d.libelle}`);
});

// Cohérence libellé ↔ valeur : seulement pour les filetages, et seulement ici
// (les libellés des autres outils sont trop variés : « #80 », « A », « 00 »…).
test('filetages métriques : le libellé « M10 x 1.5 » correspond à la valeur', async () => {
  const metriques = (await dimensionsFiletage()).filter((d) => d.libelle.startsWith('M'));
  assert.ok(metriques.length > 0);
  for (const d of metriques) {
    const lu = /^M([\d.]+) [xX] ([\d.]+)$/.exec(d.libelle);
    assert.ok(lu, `${d.outil} : libellé « ${d.libelle} » non reconnu`);
    const { diameter, pitch } = parseThread(d.valeur);
    presque(diameter, Number(lu[1]) / 25.4, `${d.outil} « ${d.libelle} » Ø`);
    presque(pitch, Number(lu[2]) / 25.4, `${d.outil} « ${d.libelle} » pas`);
  }
});

test('filetages impériaux fractionnaires : le libellé « 1/4 - 20 UNC » correspond à la valeur', async () => {
  const fractionnaires = (await dimensionsFiletage()).filter((d) => /^\d/.test(d.libelle));
  assert.ok(fractionnaires.length > 0);
  for (const d of fractionnaires) {
    const lu = /^(\d+)(?:\/(\d+))? ?- ?(\d+) UNC$/.exec(d.libelle); // « 1/4- 20 UNC », « 1 - 8 UNC »
    assert.ok(lu, `${d.outil} : libellé « ${d.libelle} » non reconnu`);
    const { diameter, pitch } = parseThread(d.valeur);
    presque(diameter, Number(lu[1]) / Number(lu[2] ?? 1), `${d.outil} « ${d.libelle} » Ø`);
    presque(pitch, 1 / Number(lu[3]), `${d.outil} « ${d.libelle} » pas`);
  }
});

// ❓ Échec connu : « #6-32 UNC » a le Ø 0.136 dans outils.json alors que le Ø
// nominal d'un #6 est 0,138 po (0,060 + 0,013 × 6). Donnée à confirmer par
// Thierry ; retirer `todo` une fois la donnée corrigée (ou la règle infirmée).
test('filetages impériaux à numéro : le libellé « #6-32 UNC » correspond à la valeur', { todo: 'Ø du #6 à confirmer : 0.136 ou 0.138 ?' }, async () => {
  const aNumero = (await dimensionsFiletage()).filter((d) => d.libelle.startsWith('#'));
  assert.ok(aNumero.length > 0);
  for (const d of aNumero) {
    const lu = /^#(\d+)-(\d+) UNC$/.exec(d.libelle);
    assert.ok(lu, `${d.outil} : libellé « ${d.libelle} » non reconnu`);
    const { diameter, pitch } = parseThread(d.valeur);
    presque(diameter, 0.06 + 0.013 * Number(lu[1]), `${d.outil} « ${d.libelle} » Ø`);
    presque(pitch, 1 / Number(lu[2]), `${d.outil} « ${d.libelle} » pas`);
  }
});

test('filetages : chaque libellé est couvert par un des trois tests de cohérence', async () => {
  for (const d of await dimensionsFiletage()) assert.match(d.libelle, /^(M|#|\d)/, `${d.outil} : ${d.libelle}`);
});

// ---------------------------------------------------------------------------
// validateData
// ---------------------------------------------------------------------------

// Jeu de données minimal et valide : 2 groupes, 3 opérations (proportionnelle,
// fixe, filetage) et 2 outils. Chaque appel retourne une copie neuve, à abîmer.
const donneesValides = () => ({
  materiaux: {
    groupes_iso: ['P - Acier non allié', 'N - Aluminium de corroyage'],
    materiaux: [
      { iso: 'P', groupe: 1, materiau: 'Acier non allié', vc_pi_min: { acier_rapide: 100, carbure_solide: 200, insert_carbure: 400 } },
      { iso: 'N', groupe: 2, materiau: 'Aluminium de corroyage', vc_pi_min: { acier_rapide: 300, carbure_solide: 600, insert_carbure: 1200 } },
    ],
  },
  operations: {
    operations: [
      { operation: 'Perçage', avance_po_rev: 0.006, avance_max_po_rev: 0.01, avance_egale_pas_filetage: false, avance_proportionnelle_diametre: true },
      { operation: 'Chariotage', avance_po_rev: 0.01, avance_max_po_rev: 0.01, avance_egale_pas_filetage: false, avance_proportionnelle_diametre: false },
      { operation: 'Taraudage', avance_po_rev: null, avance_max_po_rev: null, avance_egale_pas_filetage: true, avance_proportionnelle_diametre: false },
    ],
  },
  outils: {
    outils: [
      {
        id: 'foret', nom: 'Foret', reussites_requises: 1, format_identifiant: 'Foret [IdDia]', operation: 'Perçage',
        fact_vc: 1, fact_av: 1, limite_rpm: 10000, limite_avance: 0.01, nb_dents_min: 2, nb_dents_max: 2,
        materiaux_outil: ['Acier rapide'], groupes_materiaux_usinables: ['P - Acier non allié'],
        dimensions: [{ libelle: 'Ø 1/4 po', valeur: 0.25 }],
      },
      {
        id: 'taraud', nom: 'Taraud', reussites_requises: 0, format_identifiant: 'Taraud [IdDia]', operation: 'Taraudage',
        fact_vc: 1, fact_av: 1, limite_rpm: 1000, limite_avance: null, nb_dents_min: 1, nb_dents_max: 1,
        materiaux_outil: ['Acier rapide', 'Carbure de tungstène solide'], groupes_materiaux_usinables: ['N - Aluminium de corroyage'],
        dimensions: [{ libelle: '1/4 - 20 UNC', valeur: '0.25-20' }, { libelle: 'M6 x 1', valeur: '6x1' }],
      },
    ],
  },
});

test('validateData : les vraies données sont valides', async () => {
  const erreurs = validateData({
    materiaux: await lire('materiaux.json'),
    operations: await lire('operations.json'),
    outils: await lire('outils.json'),
  });
  assert.deepEqual(erreurs, []);
});

test('validateData : le jeu minimal est valide', () => {
  assert.deepEqual(validateData(donneesValides()), []);
});

// Une anomalie à la fois → exactement une erreur, qui nomme l'élément fautif.
const anomalies = [
  ['Vc nulle', (d) => { d.materiaux.materiaux[0].vc_pi_min.carbure_solide = null; }, /materiaux\[0\] \(groupe 1\).*vc_pi_min\.carbure_solide/],
  ['Vc négative', (d) => { d.materiaux.materiaux[1].vc_pi_min.acier_rapide = -5; }, /materiaux\[1\].*vc_pi_min\.acier_rapide/],
  ['classe ISO inconnue', (d) => {
    d.materiaux.materiaux[0].iso = 'Z';
    d.materiaux.groupes_iso[0] = 'Z - Acier non allié';
    d.outils.outils[0].groupes_materiaux_usinables = ['Z - Acier non allié'];
  }, /classe « iso » inconnue : « Z »/],
  ['matériau hors des groupes ISO', (d) => {
    d.materiaux.materiaux.push({ iso: 'K', groupe: 3, materiau: 'Fonte grise', vc_pi_min: { acier_rapide: 1, carbure_solide: 1, insert_carbure: 1 } });
  }, /« K - Fonte grise » est absent de « groupes_iso »/],
  ['groupe ISO sans matériau', (d) => { d.materiaux.groupes_iso.push('H - Acier durci'); }, /le groupe « H - Acier durci » ne contient aucun matériau/],
  ['numéro de groupe en double', (d) => { d.materiaux.materiaux[1].groupe = 1; }, /groupe en double : « 1 »/],
  ['opération en double', (d) => { d.operations.operations.push({ ...d.operations.operations[1] }); }, /opération en double : « Chariotage »/],
  ['filetage avec une avance', (d) => { d.operations.operations[2].avance_po_rev = 0.01; }, /« Taraudage ».*doit être null/],
  ['filetage proportionnel au Ø', (d) => { d.operations.operations[2].avance_proportionnelle_diametre = true; }, /« Taraudage ».*à la fois filetage et proportionnelle/],
  ['avance absente', (d) => { d.operations.operations[1].avance_po_rev = null; }, /« Chariotage ».*avance_po_rev/],
  ['avance max plus petite que l’avance', (d) => { d.operations.operations[0].avance_max_po_rev = 0.001; }, /« Perçage ».*avance_max_po_rev/],
  ['drapeau non booléen', (d) => { d.operations.operations[1].avance_proportionnelle_diametre = 'non'; }, /« Chariotage ».*true ou false/],
  ['opération inconnue', (d) => { d.outils.outils[0].operation = 'Brochage'; }, /« Foret ».*opération inconnue : « Brochage »/],
  ['id d’outil en double', (d) => { d.outils.outils[1].id = 'foret'; }, /id en double : « foret »/],
  ['limite RPM nulle', (d) => { d.outils.outils[0].limite_rpm = 0; }, /« Foret ».*limite_rpm/],
  ['limite d’avance négative', (d) => { d.outils.outils[0].limite_avance = -1; }, /« Foret ».*limite_avance/],
  ['nombre de dents inversé', (d) => { d.outils.outils[0].nb_dents_max = 1; }, /« Foret ».*nb_dents_max/],
  ['nombre de dents non entier', (d) => { d.outils.outils[0].nb_dents_min = 1.5; }, /« Foret ».*entiers ≥ 1/],
  ['réussites requises négatives', (d) => { d.outils.outils[0].reussites_requises = -1; }, /« Foret ».*reussites_requises/],
  ['matériau d’outil inconnu', (d) => { d.outils.outils[0].materiaux_outil = ['Céramique']; }, /« Foret ».*matériau d'outil inconnu : « Céramique »/],
  ['aucun matériau d’outil', (d) => { d.outils.outils[0].materiaux_outil = []; }, /« Foret ».*materiaux_outil/],
  ['groupe usinable inconnu', (d) => { d.outils.outils[0].groupes_materiaux_usinables = ['P - Acier inconnu']; }, /« Foret ».*groupe de matériaux inconnu/],
  ['aucune dimension', (d) => { d.outils.outils[0].dimensions = []; }, /« Foret ».*dimensions/],
  ['dimension sans libellé', (d) => { d.outils.outils[0].dimensions[0].libelle = ''; }, /« Foret ».*dimensions\[0\]/],
  ['Ø en texte hors filetage', (d) => { d.outils.outils[0].dimensions[0].valeur = '0.25'; }, /« Foret ».*« Ø 1\/4 po ».*Ø en pouces/],
  ['filetage illisible', (d) => { d.outils.outils[1].dimensions[1].valeur = '6 x 1'; }, /« Taraud ».*« M6 x 1 ».*filetage illisible : « 6 x 1 »/],
  ['liste d’outils absente', (d) => { delete d.outils.outils; }, /outils\.json : la liste « outils » est absente ou vide/],
];

for (const [nom, abimer, attendu] of anomalies) {
  test(`validateData : ${nom}`, () => {
    const donnees = donneesValides();
    abimer(donnees);
    const erreurs = validateData(donnees);
    assert.equal(erreurs.length, 1, `une seule erreur attendue, reçu :\n${erreurs.join('\n')}`);
    assert.match(erreurs[0], attendu);
  });
}

test('validateData : rapporte toutes les erreurs d’un coup, sans lever d’exception', () => {
  const donnees = donneesValides();
  donnees.materiaux.materiaux[0].vc_pi_min = null;
  donnees.outils.outils[0].operation = 'Brochage';
  donnees.outils.outils[1] = null;
  assert.equal(validateData(donnees).length, 5); // 3 Vc + opération inconnue + outil qui n'est pas un objet
  assert.ok(validateData({}).length >= 4); // fichiers vides : une erreur par liste manquante
});

// ---------------------------------------------------------------------------
// loadData
// ---------------------------------------------------------------------------

// Sous Node, fetch ne lit pas les fichiers locaux : on injecte un lecteur.
const lireFichier = (url) => lire(url.replace('data/', ''));

test('loadData : charge les vraies données et construit les index', async () => {
  const data = await loadData('data/', lireFichier);
  assert.equal(data.materiaux.length, 47);
  assert.equal(data.operations.length, 19);
  assert.equal(data.outils.length, 29);

  assert.equal(data.operationByName.get('Perçage').avance_po_rev, 0.006);
  for (const outil of data.outils) assert.ok(data.operationByName.has(outil.operation), outil.nom);

  assert.equal(data.materialsByGroup.size, 20);
  const total = [...data.materialsByGroup.values()].reduce((n, liste) => n + liste.length, 0);
  assert.equal(total, 47);
  for (const m of data.materialsByGroup.get('P - Acier non allié')) assert.equal(m.iso, 'P');
});

test('loadData : demande les trois fichiers sous baseUrl', async () => {
  const demandes = [];
  const fichiers = donneesValides();
  await loadData('ailleurs/', async (url) => {
    demandes.push(url);
    return fichiers[url.replace('ailleurs/', '').replace('.json', '')];
  });
  assert.deepEqual(demandes.sort(), ['ailleurs/materiaux.json', 'ailleurs/operations.json', 'ailleurs/outils.json']);
});

test('loadData : données invalides → erreur qui énumère tous les problèmes', async () => {
  const fichiers = donneesValides();
  fichiers.outils.outils[0].operation = 'Brochage';
  fichiers.outils.outils[0].limite_rpm = 0;
  const lecteur = async (url) => fichiers[url.replace('data/', '').replace('.json', '')];
  await assert.rejects(loadData('data/', lecteur), (erreur) => {
    assert.match(erreur.message, /^Données invalides :/);
    assert.match(erreur.message, /opération inconnue : « Brochage »/);
    assert.match(erreur.message, /limite_rpm/);
    return true;
  });
});

test('loadData : un fichier introuvable fait échouer le chargement', async () => {
  const lecteur = async (url) => { throw new Error(`Impossible de charger ${url} (HTTP 404)`); };
  await assert.rejects(loadData('data/', lecteur), /Impossible de charger data\/.*HTTP 404/);
});
