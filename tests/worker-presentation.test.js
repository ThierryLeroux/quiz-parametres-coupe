// Tests de la présentation des tables en direct (chantier E5, jalon E5-1, décisions D75, D76), par le vrai Worker sur
// une base SQLite en mémoire : la migration 0010, ce qui change (et ne change pas) au déploiement, la liste blanche
// imposée par le serveur, une séance épinglée à une vieille version qui voit la présentation actuelle et garde ses
// valeurs, l'attestation identique octet pour octet, l'historique et « Rétablir », la validation, le contrôle
// optimiste, le journal, la publication des tables, la Sauvegarde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECONDE, serveurDeTest } from './aide-serveur.js';
import { fausseD1, migrationSql } from './aide-d1.js';
import { IMPORT_WORD } from '../worker/editeur.js';
import { currentPresentation, presentationOf } from '../site/js/presentation.js';
import { lireFichier } from './aide.js';

const M10 = 'm10-tournage-vc';
const CAMILLE = { exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };
const m10 = await lireFichier('exercices/m10-tournage-vc.json');
const materiaux = await lireFichier('data/materiaux.json');
const operations = await lireFichier('data/operations.json');
const A2026_R0 = { materiaux, operations };

async function editeurDeTest(options = {}) {
  const serveur = serveurDeTest(options);
  const { status, corps } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } });
  assert.equal(status, 200, JSON.stringify(corps));
  const entetes = { cookie: `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
  serveur.editeur = (methode, chemin, corps) => serveur.appel(methode, `/api/prof/editeur/${chemin}`, { corps, entetes });
  return serveur;
}

// La page de la présentation, telle que la Gestion du contenu la reçoit.
async function presentationDe(serveur) {
  const { status, corps } = await serveur.editeur('GET', 'presentation');
  assert.equal(status, 200, JSON.stringify(corps));
  return corps;
}

// Applique la présentation en vigueur modifiée par `retouche` (qui reçoit une copie) ; rend la réponse.
async function appliquer(serveur, retouche) {
  const page = await presentationDe(serveur);
  const presentation = structuredClone(page.presentation);
  retouche(presentation);
  return serveur.editeur('POST', 'presentation/appliquer', { revision: page.revision, presentation });
}

const classe = (presentation, code) => presentation.classes_iso.find((c) => c.code === code);

async function publierTables(serveur, contenu, id) {
  const page = (await serveur.editeur('GET', 'tables')).corps;
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: page.brouillon.revision, contenu });
  assert.equal(enregistre.status, 200, JSON.stringify(enregistre.corps));
  return serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id });
}

function carbureDouble(contenu) {
  const next = structuredClone(contenu);
  next.materiaux.materiaux = next.materiaux.materiaux.map((m) => ({ ...m, vc_pi_min: { ...m.vc_pi_min, carbure_solide: m.vc_pi_min.carbure_solide * 2, insert_carbure: m.vc_pi_min.insert_carbure + 10 } }));
  return next;
}

async function commencer(serveur, etudiant) {
  const { status, corps } = await serveur.appel('POST', '/api/creation', { corps: etudiant });
  assert.equal(status, 200, JSON.stringify(corps));
  const question = await serveur.appel('POST', '/api/question', { jeton: corps.jeton, corps: { exercice: etudiant.exercice } });
  return { jeton: corps.jeton, seance: question.corps.seance };
}

async function reussir(serveur, etudiant) {
  const { jeton } = await commencer(serveur, etudiant);
  let etat;
  do {
    serveur.avancer(11 * SECONDE);
    const reponse = await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: etudiant.exercice, saisies: serveur.bonnesReponses(etudiant.matricule, etudiant.exercice) } });
    assert.equal(reponse.status, 200, JSON.stringify(reponse.corps));
    etat = reponse.corps.seance;
  } while (etat.reussite_le === null);
  return jeton;
}

// Les tables qu'un navigateur reçoit avec un exercice (page Question, feuilles, page de description).
const tablesServies = async (serveur, version = null) => (await serveur.appel('GET', `/api/exercice?exercice=${M10}${version === null ? '' : `&version=${version}`}`)).corps.tables;

// --- La migration et le déploiement ------------------------------------------------------------------------------------

test('migration 0010 : la présentation vide (rien d’appliqué, révision 0), l’historique vide ; aucune autre table touchée', async () => {
  const db = fausseD1({ jusqua: 9 });
  const serveur = serveurDeTest({ db });
  // Des données produites par le serveur d'avant : une séance commencée, une question tirée.
  await commencer(serveur, CAMILLE);
  const tablesAvant = db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
  const photographie = () => tablesAvant.map((table) => db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map((row) => ({ ...row })));
  const avant = photographie();
  db.sqlite.exec(migrationSql(10));
  assert.deepEqual(photographie(), avant);
  assert.deepEqual({ ...db.sqlite.prepare('SELECT * FROM presentation_tables').get() }, { id: 1, contenu: null, revision: 0, modifiee_le: null, enseignant: null });
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM presentation_tables_historique').get().n, 0);
  assert.throws(() => db.sqlite.prepare('INSERT INTO presentation_tables (id, revision) VALUES (2, 0)').run(), /CHECK/);
  assert.throws(() => db.sqlite.prepare("INSERT INTO presentation_tables_historique (contenu, remplacee_le, action) VALUES ('{}', 'x', 'autre')").run(), /CHECK/);
});

test('au déploiement (rien d’appliqué) : la présentation est celle de la dernière version des tables — rien ne change pour une séance sur elle ; une séance sur une version plus ancienne prend celle de la dernière, avec ses propres valeurs', async () => {
  const serveur = await editeurDeTest();
  const page = await presentationDe(serveur);
  assert.deepEqual([page.appliquee, page.revision, page.historique, page.derniere_tables, page.erreurs], [false, 0, [], 'A2026_r0', []]);
  assert.deepEqual(page.presentation, presentationOf(A2026_R0));
  // La dernière version (A2026_r0) : servie exactement comme avant ce jalon (le catalogue de la version, sans rien par-dessus).
  const brut = serveur.catalogue(M10);
  const servies = await tablesServies(serveur);
  assert.deepEqual(servies.materiaux.classes_iso, brut.classesIso);
  assert.deepEqual(servies.materiaux.materiaux_outil, brut.toolMaterials);
  assert.deepEqual(servies.operations.operations, brut.operations);
  // Une version A2026_r1 publiée AVANT ce jalon, avec une autre légende pour P et une autre couleur pour l'acier rapide
  // (posée directement en base, comme la publication d'alors), et une version 2 de l'exercice dessus.
  const r1 = structuredClone(A2026_R0);
  r1.materiaux = { ...r1.materiaux, revision: 'A2026_r1', classes_iso: presentationOf(A2026_R0).classes_iso.map((c) => (c.code === 'P' ? { ...c, legende_image: 'Zone chaude' } : c)), materiaux_outil: [{ cle: 'acier_rapide', nom: 'Acier rapide', couleur: '#cccccc' }, { cle: 'carbure_solide', nom: 'Carbure de tungstène solide', couleur: '#a6a6a6' }, { cle: 'insert_carbure', nom: 'Insert de carbure de tungstène', couleur: '#ffc000' }] };
  r1.materiaux.materiaux = r1.materiaux.materiaux.map((m) => ({ ...m, vc_pi_min: { ...m.vc_pi_min, insert_carbure: m.vc_pi_min.insert_carbure + 1 } }));
  r1.operations = { ...r1.operations, revision: 'A2026_r1' };
  serveur.db.sqlite.prepare('INSERT INTO tables_reference (id, materiaux, operations, creee_le) VALUES (?, ?, ?, ?)').run('A2026_r1', JSON.stringify(r1.materiaux), JSON.stringify(r1.operations), '2026-09-26T10:00:00.000Z');
  serveur.publierExercice(m10, { tablesId: 'A2026_r1' });
  // La version 1 (sur A2026_r0) prend la présentation de A2026_r1, la dernière ; ses valeurs restent celles de A2026_r0.
  const ancienne = await tablesServies(serveur, 1);
  assert.equal(classe(ancienne.materiaux, 'P').legende_image, 'Zone chaude');
  assert.equal(ancienne.materiaux.materiaux_outil[0].couleur, '#cccccc');
  assert.deepEqual(ancienne.materiaux.materiaux, materiaux.materiaux);
  assert.equal(ancienne.materiaux.revision, 'A2026_r0');
  // La version 2, elle, ne voit rien changer.
  const nouvelle = await tablesServies(serveur, 2);
  assert.deepEqual(nouvelle.materiaux.classes_iso, serveur.catalogue(M10, 2).classesIso);
});

// --- La liste blanche -----------------------------------------------------------------------------------------------------

test('la liste blanche est imposée par le serveur : tout champ hors d’elle est refusé (400, nommé) et rien n’est appliqué, ni journalisé', async () => {
  const serveur = await editeurDeTest();
  const avant = { page: await presentationDe(serveur), servies: await tablesServies(serveur), journal: serveur.journalEnseignant().length };
  const essais = [
    (p) => { p.materiaux = { materiaux: [] }; },
    (p) => { classe(p, 'P').vc_pi_min = { acier_rapide: 999 }; },
    (p) => { classe(p, 'M').groupe = 3; },
    (p) => { p.materiaux_outil[0].nom = 'HSS'; },
    (p) => { p.operations[0].avance_po_rev = 0.5; },
    (p) => { p.operations[0].direction_avance = 'Avance transversale'; },
    (p) => { p.revision = 'A2026_r9'; },
  ];
  for (const essai of essais) {
    const refus = await appliquer(serveur, essai);
    assert.equal(refus.status, 400, essai.toString());
    assert.match(refus.corps.erreur, /erreur\(s\) : rien n'a été appliqué/);
    assert.ok(refus.corps.erreurs.some((e) => /hors de la liste blanche de la présentation/.test(e)), JSON.stringify(refus.corps.erreurs));
  }
  const apres = await presentationDe(serveur);
  assert.equal(apres.revision, avant.page.revision);
  assert.deepEqual(apres.presentation, avant.page.presentation);
  assert.deepEqual(await tablesServies(serveur), avant.servies);
  assert.equal(serveur.journalEnseignant().length, avant.journal);
  // Rien d'autre que du JSON attendu : un corps sans révision, ou sans présentation.
  assert.equal((await serveur.editeur('POST', 'presentation/appliquer', { presentation: avant.page.presentation })).status, 400);
  assert.equal((await serveur.editeur('POST', 'presentation/appliquer', { revision: 0 })).status, 400);
});

// --- Une séance épinglée à une vieille version ---------------------------------------------------------------------------

test('une séance épinglée à une vieille version voit la légende actuelle au rechargement, et garde exactement sa question et ses valeurs attendues', async () => {
  const serveur = await editeurDeTest();
  const { jeton } = await commencer(serveur, CAMILLE);
  const question = serveur.seance().question_courante;
  const attendues = serveur.bonnesReponses();
  // De nouvelles tables (des Vc changent) et une version 2 de l'exercice : Camille reste épinglée à la version 1.
  const brouillon = (await serveur.editeur('GET', 'tables')).corps.brouillon.contenu;
  assert.equal((await publierTables(serveur, carbureDouble(brouillon), 'A2026_r1')).status, 200);
  serveur.publierExercice(m10, { tablesId: 'A2026_r1' });
  // La légende de la classe du matériau de sa question change, en direct.
  const code = JSON.parse(question).material.iso;
  const applique = await appliquer(serveur, (p) => { classe(p, code).legende_image = 'Zone de coupe'; });
  assert.equal(applique.status, 200, JSON.stringify(applique.corps));
  assert.deepEqual(applique.corps.lignes, [`Classe ${code} — légende de l'image : Chaleur → Zone de coupe`]);
  // Sa page, rechargée (GET /api/exercice?version=1), montre la nouvelle légende, avec les valeurs de sa version.
  const servies = await tablesServies(serveur, 1);
  assert.equal(classe(servies.materiaux, code).legende_image, 'Zone de coupe');
  assert.deepEqual(servies.materiaux.materiaux, materiaux.materiaux);
  // Sa question et ses valeurs attendues n'ont pas bougé ; ses bonnes réponses sont jugées justes.
  assert.equal(serveur.seance().question_courante, question);
  assert.deepEqual(serveur.bonnesReponses(), attendues);
  serveur.avancer(11 * SECONDE);
  const corrigee = await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: attendues } });
  assert.equal(corrigee.status, 200, JSON.stringify(corrigee.corps));
  assert.equal(corrigee.corps.correction.reussie, true, JSON.stringify(corrigee.corps.correction));
  assert.equal(serveur.journal().at(-1).question, question);
});

// --- L'attestation, octet pour octet ---------------------------------------------------------------------------------

test('une attestation reste identique octet pour octet — enregistrement, signature, données de la page, vérification — avant et après un changement de présentation', async () => {
  const serveur = await editeurDeTest();
  const jeton = await reussir(serveur, CAMILLE);
  const ligne = () => serveur.db.sqlite.prepare('SELECT * FROM attestations ORDER BY id').all().map((row) => ({ ...row }));
  const page = async () => {
    const reponse = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
    assert.equal(reponse.status, 200, JSON.stringify(reponse.corps));
    return JSON.stringify(reponse.corps);
  };
  const verification = async (corpsPage) => JSON.stringify((await serveur.appel('POST', '/api/verification', { corps: Object.fromEntries(new URL(JSON.parse(corpsPage).url_verification).searchParams) })).corps);
  const avant = { ligne: ligne(), page: await page() };
  avant.verification = await verification(avant.page);
  assert.match(avant.verification, /"resultat":"valide"/);
  // Tout ce que la présentation permet de changer, d'un coup.
  const applique = await appliquer(serveur, (p) => {
    for (const c of p.classes_iso) Object.assign(c, { nom: `${c.nom} (bis)`, couleur: '#123456', couleur_texte: '#fedcba', couleur_ligne: '#abcdef', image_chaleur: null, legende_image: '', caracteristiques: [] });
    for (const m of p.materiaux_outil) m.couleur = '#654321';
    for (const op of p.operations) op.pictogramme = 'percage';
  });
  assert.equal(applique.status, 200, JSON.stringify(applique.corps));
  assert.ok(applique.corps.lignes.length > 20);
  assert.deepEqual(ligne(), avant.ligne);
  assert.equal(await page(), avant.page);
  assert.equal(await verification(avant.page), avant.verification);
});

// --- L'historique et « Rétablir » ---------------------------------------------------------------------------------------

test('historique et « Rétablir » : chaque contenu remplacé est gardé (la présentation de départ comprise) ; rétablir le remet en vigueur, en un geste, et ce qu’il remplace va à l’historique ; tout est au journal', async () => {
  const serveur = await editeurDeTest();
  serveur.avancer(60 * SECONDE);
  assert.equal((await appliquer(serveur, (p) => { classe(p, 'P').legende_image = 'Zone chaude'; })).status, 200);
  serveur.avancer(60 * SECONDE);
  assert.equal((await appliquer(serveur, (p) => { classe(p, 'P').couleur = '#0099cc'; })).status, 200);
  const page = await presentationDe(serveur);
  assert.deepEqual([page.appliquee, page.revision, page.enseignant], [true, 2, 'admin']);
  // Le plus récent en tête : le contenu d'après la première application, puis la présentation de départ (jamais appliquée).
  assert.deepEqual(page.historique.map((h) => [h.id, h.action, h.posee_par, h.remplacee_par, h.posee_le === null]), [[2, 'application', 'admin', 'admin', false], [1, 'application', null, 'admin', true]]);
  assert.deepEqual(page.historique[0].lignes, ['Classe P — couleur : #0099cc → #00b0f0']);
  assert.deepEqual(page.historique[1].lignes, ['Classe P — couleur : #0099cc → #00b0f0', "Classe P — légende de l'image : Zone chaude → Chaleur"]);
  // Rétablir la présentation de départ : tout redevient comme au déploiement.
  const retablie = await serveur.editeur('POST', 'presentation/retablir', { revision: page.revision, historique: 1 });
  assert.equal(retablie.status, 200, JSON.stringify(retablie.corps));
  assert.deepEqual([retablie.corps.revision, retablie.corps.lignes, retablie.corps.avertissements], [3, page.historique[1].lignes, []]);
  assert.deepEqual((await presentationDe(serveur)).presentation, presentationOf(A2026_R0));
  assert.deepEqual((await tablesServies(serveur)).materiaux.classes_iso, serveur.catalogue(M10).classesIso);
  const apres = await presentationDe(serveur);
  assert.deepEqual(apres.historique.map((h) => [h.id, h.action]), [[3, 'retablissement'], [2, 'application'], [1, 'application']]);
  assert.deepEqual(apres.historique[0].lignes, ['Classe P — couleur : #00b0f0 → #0099cc', "Classe P — légende de l'image : Chaleur → Zone chaude"]);
  // Rétablir encore la même : rien ne change → 400 ; un numéro inconnu → 404.
  assert.equal((await serveur.editeur('POST', 'presentation/retablir', { revision: 3, historique: 1 })).status, 400);
  assert.equal((await serveur.editeur('POST', 'presentation/retablir', { revision: 3, historique: 99 })).status, 404);
  // Le journal : deux applications et un rétablissement, avec les changements en clair.
  const journal = serveur.journalEnseignant().filter((row) => row.action.startsWith('editeur_presentation'));
  assert.deepEqual(journal.map((row) => [row.action, row.enseignant]), [['editeur_presentation_application', 'admin'], ['editeur_presentation_application', 'admin'], ['editeur_presentation_retablissement', 'admin']]);
  assert.equal(journal[0].details, "1 changement(s) : Classe P — légende de l'image : Chaleur → Zone chaude");
  assert.equal(journal[2].details, "historique n° 1 (remplacée le 2026-09-21 13:06 UTC) · 2 changement(s) : Classe P — couleur : #0099cc → #00b0f0 ; Classe P — légende de l'image : Zone chaude → Chaleur");
});

test('une image archivée déjà en vigueur ne bloque rien (D76, retouche) : « Rétablir » un contenu qui en nomme une est permis, avec un avertissement ; appliquer ensuite une légende réussit, avec l’avertissement ; CHOISIR une image archivée est refusé ; une image de la présentation, actuelle ou dans l’historique, ne se supprime pas', async () => {
  const serveur = await editeurDeTest();
  const avertissement = (where, id) => `${where} : l'image « ${id} » est archivée ; elle reste affichée et ne bloque rien (pour la remplacer, choisis-en une autre, ou rétablis-la dans l'onglet Images).`;
  // Une image de classe téléversée, mise sur P, puis remplacée par celle de la semence, puis archivée.
  const png = await import('node:fs').then((fs) => fs.readFileSync(new URL('../site/img/copeaux/copeaux-p-chaleur.png', import.meta.url)));
  const neuve = await serveur.editeur('POST', 'images/televerser', { nom: 'chaleur P bis.png', usage: 'classe', type: 'image/png', contenu: Buffer.concat([png, Buffer.from([0x2a])]).toString('base64') });
  const id = neuve.corps.image.id;
  assert.equal((await appliquer(serveur, (p) => { classe(p, 'P').image_chaleur = id; })).status, 200);
  assert.equal((await appliquer(serveur, (p) => { classe(p, 'P').image_chaleur = 'copeaux-p-chaleur'; })).status, 200);
  assert.equal((await serveur.editeur('POST', 'images/archiver', { id, archive: true })).status, 200);
  const utilisations = async () => (await serveur.editeur('GET', 'images?usage=classe')).corps.images.find((i) => i.id === id).utilisations;
  assert.deepEqual((await utilisations()).presentation, ['historique n° 2']);
  assert.equal((await serveur.editeur('POST', 'images/supprimer', { id })).status, 409); // l'historique la nomme : « Rétablir » la remettrait
  // Rétablir le contenu qui la nomme : permis, avec l'avertissement.
  const page = await presentationDe(serveur);
  const retablie = await serveur.editeur('POST', 'presentation/retablir', { revision: page.revision, historique: 2 });
  assert.equal(retablie.status, 200, JSON.stringify(retablie.corps));
  assert.deepEqual(retablie.corps.avertissements, [avertissement('Classe P — image de chaleur', id)]);
  assert.equal(classe((await tablesServies(serveur)).materiaux, 'P').image_chaleur, id); // une image archivée est toujours servie (D56)
  // Le panneau la dit en avertissement, pas en erreur.
  const signalee = await presentationDe(serveur);
  assert.deepEqual([signalee.erreurs, signalee.avertissements], [[], [avertissement('Classe P — image de chaleur', id)]]);
  assert.deepEqual((await utilisations()).presentation, ['actuelle', 'historique n° 2']);
  // Appliquer une légende pendant qu'elle est en vigueur : réussit, avec l'avertissement.
  const legende = await appliquer(serveur, (p) => { classe(p, 'M').legende_image = 'Arête'; });
  assert.equal(legende.status, 200, JSON.stringify(legende.corps));
  assert.deepEqual([legende.corps.lignes, legende.corps.avertissements], [["Classe M — légende de l'image : Chaleur → Arête"], [avertissement('Classe P — image de chaleur', id)]]);
  // CHOISIR une image archivée — pour une autre classe, ou pour P une fois qu'elle a changé — est refusé, nommément.
  const choisie = await appliquer(serveur, (p) => { classe(p, 'K').image_chaleur = id; });
  assert.equal(choisie.status, 400);
  assert.deepEqual(choisie.corps.erreurs, [`classes_iso[2] (K) : « image_chaleur » : l'image « ${id} » est archivée (choisis-en une autre, ou rétablis-la dans l'onglet Images)`]);
  assert.equal((await appliquer(serveur, (p) => { classe(p, 'P').image_chaleur = 'copeaux-p-chaleur'; })).status, 200);
  const reprise = await appliquer(serveur, (p) => { classe(p, 'P').image_chaleur = id; });
  assert.deepEqual([reprise.status, reprise.corps.erreurs?.length], [400, 1]);
});

test('un pictogramme archivé déjà en vigueur (comme il peut y en avoir en production) ne bloque rien : une légende s’applique, avec l’avertissement ; choisir ce pictogramme pour une autre opération est refusé', async () => {
  const serveur = await editeurDeTest();
  const [premiere, seconde] = operations.operations.map((op) => op.operation);
  assert.equal((await appliquer(serveur, (p) => { p.operations[0].pictogramme = 'tronconnage'; })).status, 200);
  assert.equal((await serveur.editeur('POST', 'images/archiver', { id: 'tronconnage', archive: true })).status, 200);
  const legende = await appliquer(serveur, (p) => { classe(p, 'P').legende_image = 'Zone chaude'; });
  assert.equal(legende.status, 200, JSON.stringify(legende.corps));
  assert.deepEqual(legende.corps.avertissements, [`Opération « ${premiere} » — pictogramme : l'image « tronconnage » est archivée ; elle reste affichée et ne bloque rien (pour la remplacer, choisis-en une autre, ou rétablis-la dans l'onglet Images).`]);
  const choisi = await appliquer(serveur, (p) => { p.operations[1].pictogramme = 'tronconnage'; });
  assert.equal(choisi.status, 400);
  assert.deepEqual(choisi.corps.erreurs, [`operations[1] (${seconde}) : « pictogramme » : l'image « tronconnage » est archivée (choisis-en une autre, ou rétablis-la dans l'onglet Images)`]);
});

// --- Validation et contrôle optimiste ------------------------------------------------------------------------------------

test('validation : les règles des tables (légende de 40 caractères, 6 caractéristiques, couleurs, nom), les images (inconnue, archivée, pour une classe comme pour un pictogramme), les trois listes exigées ; rien à changer → 400', async () => {
  const serveur = await editeurDeTest();
  assert.equal((await serveur.editeur('POST', 'images/archiver', { id: 'tronconnage', archive: true })).status, 200);
  const refus = await appliquer(serveur, (p) => {
    classe(p, 'P').legende_image = 'x'.repeat(41);
    classe(p, 'M').caracteristiques = Array.from({ length: 7 }, (_, i) => ({ libelle: `l${i}`, texte: 't' }));
    classe(p, 'K').couleur = 'rouge';
    classe(p, 'N').nom = '';
    classe(p, 'S').image_chaleur = 'img-0000000000000000';
    p.operations[0].pictogramme = 'tronconnage';
    p.operations[1].pictogramme = 'img-0000000000000000';
  });
  assert.equal(refus.status, 400);
  assert.deepEqual(refus.corps.erreurs, [
    'classes_iso[0] (P) : « legende_image » a 41 caractères (au plus 40)',
    'classes_iso[1] (M) : au plus 6 caractéristiques (7)',
    'classes_iso[2] (K) : « couleur » doit être une couleur « #rrggbb »',
    'classes_iso[3] (N) : « nom » est vide',
    "classes_iso[4] (S) : « image_chaleur » : l'image « img-0000000000000000 » est inconnue",
    `operations[0] (${operations.operations[0].operation}) : « pictogramme » : l'image « tronconnage » est archivée (choisis-en une autre, ou rétablis-la dans l'onglet Images)`,
    `operations[1] (${operations.operations[1].operation}) : « pictogramme » : l'image « img-0000000000000000 » est inconnue`,
  ]);
  const page = await presentationDe(serveur);
  const sansListe = { classes_iso: page.presentation.classes_iso, operations: page.presentation.operations };
  const manque = await serveur.editeur('POST', 'presentation/appliquer', { revision: page.revision, presentation: sansListe });
  assert.deepEqual([manque.status, manque.corps.erreurs], [400, ['« materiaux_outil » manque']]);
  const pareil = await serveur.editeur('POST', 'presentation/appliquer', { revision: page.revision, presentation: page.presentation });
  assert.deepEqual([pareil.status, pareil.corps.erreur], [400, 'Aucune différence avec la présentation en vigueur : rien à appliquer.']);
  assert.equal((await presentationDe(serveur)).revision, 0);
});

test('contrôle optimiste : deux onglets ouverts sur la même révision — le second à appliquer ou à rétablir reçoit 409, et rien n’est écrit', async () => {
  const serveur = await editeurDeTest();
  const lue = await presentationDe(serveur);
  const premier = structuredClone(lue.presentation);
  classe(premier, 'P').legende_image = 'Premier';
  const second = structuredClone(lue.presentation);
  classe(second, 'P').legende_image = 'Second';
  assert.equal((await serveur.editeur('POST', 'presentation/appliquer', { revision: lue.revision, presentation: premier })).status, 200);
  const conflit = await serveur.editeur('POST', 'presentation/appliquer', { revision: lue.revision, presentation: second });
  assert.equal(conflit.status, 409);
  assert.match(conflit.corps.erreur, /appliquée ailleurs depuis ton ouverture/);
  assert.equal(conflit.corps.revision_actuelle, 1);
  const retablir = await serveur.editeur('POST', 'presentation/retablir', { revision: lue.revision, historique: 1 });
  assert.equal(retablir.status, 409);
  const page = await presentationDe(serveur);
  assert.deepEqual([page.revision, page.historique.length, classe(page.presentation, 'P').legende_image], [1, 1, 'Premier']);
  assert.equal(serveur.journalEnseignant().filter((row) => row.action.startsWith('editeur_presentation')).length, 1);
});

// --- Où elle se pose ---------------------------------------------------------------------------------------------------

test('où elle se pose : l’exercice servi (dernière version et version épinglée), les feuilles imprimables d’une version, les tables d’un exercice et de la banque dans la Gestion du contenu ; pas la version elle-même, telle qu’en base', async () => {
  const serveur = await editeurDeTest();
  assert.equal((await appliquer(serveur, (p) => {
    classe(p, 'K').couleur = '#aa0000';
    p.materiaux_outil[2].couleur = '#00ffff';
    p.operations.find((op) => op.operation === 'Tronçonnage').pictogramme = 'percage';
  })).status, 200);
  const regarde = (tables) => [classe(tables.materiaux, 'K').couleur, tables.materiaux.materiaux_outil[2].couleur, tables.operations.operations.find((op) => op.operation === 'Tronçonnage').pictogramme];
  const attendu = ['#aa0000', '#00ffff', 'percage'];
  assert.deepEqual(regarde(await tablesServies(serveur)), attendu);
  assert.deepEqual(regarde(await tablesServies(serveur, 1)), attendu);
  assert.deepEqual(regarde((await serveur.appel('GET', '/api/tables?version=A2026_r0')).corps.tables), attendu);
  assert.deepEqual(regarde((await serveur.editeur('GET', `exercice?id=${M10}`)).corps.tables), attendu);
  assert.deepEqual(regarde((await serveur.editeur('GET', 'banque')).corps.tables), attendu);
  // La version, telle qu'en base (l'onglet Tables compare ses valeurs) : sa propre présentation.
  assert.deepEqual(regarde((await serveur.editeur('GET', 'tables/version?id=A2026_r0')).corps.tables), ['#ff0000', '#ffc000', undefined]);
  // Le catalogue gardé en mémoire, qui tire et corrige, n'a pas changé : la séance suivante tire comme avant.
  assert.deepEqual(serveur.catalogue(M10).classesIso.find((c) => c.code === 'K').couleur, '#ff0000');
});

// --- La publication des tables --------------------------------------------------------------------------------------------

test('publier des tables : la version prend la présentation en vigueur (un instantané) ; une classe nouvelle garde celle de sa ligne du brouillon, puis entre dans la présentation', async () => {
  const serveur = await editeurDeTest();
  assert.equal((await appliquer(serveur, (p) => { classe(p, 'P').legende_image = 'Zone chaude'; })).status, 200);
  const brouillon = (await serveur.editeur('GET', 'tables')).corps.brouillon.contenu;
  assert.equal(classe(brouillon.materiaux, 'P').legende_image, 'Chaleur'); // le champ caché du brouillon, sans effet
  const suivant = carbureDouble(brouillon);
  suivant.materiaux.classes_iso.push({ code: 'X', nom: 'Céramiques', couleur: '#112233', couleur_texte: '#ffffff', couleur_ligne: '#ddeeff', image_chaleur: null, legende_image: 'Neuve', caracteristiques: [] });
  const publie = await publierTables(serveur, suivant, 'A2026_r1');
  assert.equal(publie.status, 200, JSON.stringify(publie.corps));
  const version = (await serveur.editeur('GET', 'tables/version?id=A2026_r1')).corps.tables;
  assert.equal(classe(version.materiaux, 'P').legende_image, 'Zone chaude');
  assert.deepEqual(classe(version.materiaux, 'X'), { code: 'X', nom: 'Céramiques', couleur: '#112233', couleur_texte: '#ffffff', couleur_ligne: '#ddeeff', image_chaleur: null, legende_image: 'Neuve', caracteristiques: [] });
  // La présentation en vigueur connaît maintenant X (la dernière version) ; le brouillon repart de la version, sans différence.
  const page = await presentationDe(serveur);
  assert.equal(page.derniere_tables, 'A2026_r1');
  assert.deepEqual(classe(page.presentation, 'X').legende_image, 'Neuve');
  const tables = (await serveur.editeur('GET', 'tables')).corps;
  assert.deepEqual([tables.modifie, tables.erreurs, tables.presentation_en_attente.lignes], [false, [], []]);
  assert.equal((await appliquer(serveur, (p) => { classe(p, 'X').couleur = '#445566'; })).status, 200);
  assert.equal(classe((await serveur.appel('GET', '/api/tables?version=A2026_r1')).corps.tables.materiaux, 'X').couleur, '#445566');
});

test('retouches de présentation en attente dans le brouillon (faites avant ce jalon, jamais publiées) : signalées, avec la présentation qui les reprend ; plus rien une fois appliquées', async () => {
  const serveur = await editeurDeTest();
  // Le brouillon des tables tel qu'un enseignant l'aurait laissé avant E5-1 : la légende de P retouchée, pas publiée.
  const brouillon = JSON.parse(serveur.db.sqlite.prepare('SELECT contenu FROM brouillon_tables').get().contenu);
  const complet = (await serveur.editeur('GET', 'tables')).corps.brouillon.contenu;
  brouillon.materiaux.classes_iso = structuredClone(complet.materiaux.classes_iso);
  classe(brouillon.materiaux, 'P').legende_image = 'Zone chaude';
  serveur.db.sqlite.prepare('UPDATE brouillon_tables SET contenu = ?').run(JSON.stringify(brouillon));
  const page = (await serveur.editeur('GET', 'tables')).corps;
  assert.deepEqual(page.presentation_en_attente.lignes, ["Classe P — légende de l'image : Chaleur → Zone chaude"]);
  assert.equal(page.modifie, false); // les valeurs sont celles de A2026_r0
  const reprise = page.presentation_en_attente.contenu;
  const applique = await serveur.editeur('POST', 'presentation/appliquer', { revision: (await presentationDe(serveur)).revision, presentation: reprise });
  assert.equal(applique.status, 200, JSON.stringify(applique.corps));
  assert.deepEqual((await serveur.editeur('GET', 'tables')).corps.presentation_en_attente.lignes, []);
});

// --- La Sauvegarde ------------------------------------------------------------------------------------------------------

test('Sauvegarde : l’export porte la présentation et son historique ; importés dans une base neuve, ils sont identiques (aller-retour) ; réimporté, rien ne change ; un export d’avant s’importe sans y toucher ; un champ hors de la liste blanche est refusé', async () => {
  const source = await editeurDeTest();
  source.avancer(60 * SECONDE);
  assert.equal((await appliquer(source, (p) => { classe(p, 'P').legende_image = 'Zone chaude'; })).status, 200);
  source.avancer(60 * SECONDE);
  assert.equal((await appliquer(source, (p) => { p.materiaux_outil[0].couleur = '#cccccc'; })).status, 200);
  source.avancer(60 * SECONDE);
  assert.equal((await source.editeur('POST', 'presentation/retablir', { revision: 2, historique: 1 })).status, 200);
  const exporte = (await source.editeur('GET', 'export')).corps;
  assert.equal(exporte.presentation_tables.historique.length, 3);
  assert.deepEqual(exporte.presentation_tables.contenu, presentationOf(A2026_R0));
  assert.equal(exporte.presentation_tables.enseignant, 'admin');
  const fiches = { ...exporte, images: exporte.images.map(({ contenu: _, ...fiche }) => fiche) }; // les images de la semence sont déjà dans une base neuve
  // Réimporté dans la même base : rien ne change.
  const meme = await source.editeur('POST', 'import/valider', { export: fiches });
  assert.deepEqual([meme.corps.erreurs, meme.corps.resume.presentation_remplacee, meme.corps.resume.presentation_historique], [[], false, 0]);
  // Dans une base neuve : la présentation et son historique, identiques.
  const cible = await editeurDeTest();
  const validation = await cible.editeur('POST', 'import/valider', { export: fiches });
  assert.deepEqual([validation.corps.erreurs, validation.corps.resume.presentation_remplacee, validation.corps.resume.presentation_historique], [[], true, 3]);
  const importe = await cible.editeur('POST', 'import', { export: fiches, confirmation: IMPORT_WORD });
  assert.equal(importe.status, 200, JSON.stringify(importe.corps));
  assert.deepEqual((await cible.editeur('GET', 'export')).corps.presentation_tables, exporte.presentation_tables);
  const page = await presentationDe(cible);
  assert.deepEqual([page.appliquee, page.revision, page.historique.map((h) => h.action)], [true, 1, ['retablissement', 'application', 'application']]);
  assert.match(cible.journalEnseignant().filter((row) => row.action === 'editeur_import').at(-1).details, /présentation des tables : remplacée, 3 contenu\(s\) ajouté\(s\) à l'historique/);
  // Un export d'avant ce jalon (sans présentation) : s'importe, et la présentation de la base ne change pas.
  const ancien = structuredClone(fiches);
  delete ancien.presentation_tables;
  const avant = await presentationDe(cible);
  assert.equal((await cible.editeur('POST', 'import', { export: ancien, confirmation: IMPORT_WORD })).status, 200);
  const apres = await presentationDe(cible);
  assert.deepEqual([apres.presentation, apres.historique.length], [avant.presentation, avant.historique.length]);
  // Une présentation d'export avec un champ hors de la liste blanche : refusée, nommée.
  const trafique = structuredClone(fiches);
  trafique.presentation_tables.contenu.classes_iso[0].vc_pi_min = { acier_rapide: 1 };
  assert.match((await cible.editeur('POST', 'import/valider', { export: trafique })).corps.erreurs.join('|'), /Présentation des tables : classes_iso\[0\] \(P\) : « vc_pi_min » est hors de la liste blanche/);
  // Une présentation plus récente dans la base, remplacée par un import : elle va à l'historique (« import »).
  assert.equal((await appliquer(cible, (p) => { classe(p, 'H').couleur = '#101010'; })).status, 200);
  assert.equal((await cible.editeur('POST', 'import', { export: fiches, confirmation: IMPORT_WORD })).status, 200);
  const remplacee = await presentationDe(cible);
  assert.deepEqual(remplacee.presentation, currentPresentation(exporte.presentation_tables.contenu, A2026_R0));
  assert.equal(remplacee.historique[0].action, 'import');
  assert.deepEqual(remplacee.historique[0].lignes, ['Classe H — couleur : #d9d9d9 → #101010']);
});
