// Tests de l'historique de la banque d'outils (chantier E5, jalon E5-4, décision D79), par le vrai Worker sur une base
// SQLite en mémoire : la migration 0012, l'historique à chaque enregistrement, « Rétablir », le contrôle optimiste, le
// journal, un contenu ancien devenu invalide, les images, la Sauvegarde et l'import qui alimente l'historique ; et
// l'avertissement des titres en double (complément de D78).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serveurDeTest } from './aide-serveur.js';
import { fausseD1, migrationSql } from './aide-d1.js';
import { IMPORT_WORD, REPLACE_WORD } from '../worker/editeur.js';
import { lireFichier } from './aide.js';

const M10 = 'm10-tournage-vc';
const VC_RPM = 'm10-tournage-vc-rpm';
const m10 = await lireFichier('exercices/m10-tournage-vc.json');
const SEMENCE = '2026-09-24T12:00:00.000Z'; // la date des outils semés par 0005

async function editeurDeTest(options = {}) {
  const serveur = serveurDeTest(options);
  const { status, corps } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } });
  assert.equal(status, 200, JSON.stringify(corps));
  const entetes = { cookie: `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
  serveur.editeur = (methode, chemin, corps) => serveur.appel(methode, `/api/prof/editeur/${chemin}`, { corps, entetes });
  return serveur;
}

// La page d'un outil de la banque.
async function outil(serveur, id) {
  const { status, corps } = await serveur.editeur('GET', `banque/outil?id=${id}`);
  assert.equal(status, 200, JSON.stringify(corps));
  return corps;
}

// Enregistre l'outil modifié par `retouche` (qui reçoit une copie) ; rend la réponse.
async function enregistrer(serveur, id, retouche) {
  const page = await outil(serveur, id);
  const contenu = structuredClone(page.outil.outil);
  retouche(contenu);
  return serveur.editeur('POST', 'banque/enregistrer', { id, revision: page.outil.revision, outil: contenu });
}

const historique = (serveur) => serveur.db.sqlite.prepare('SELECT * FROM banque_outils_historique ORDER BY id').all().map((row) => ({ ...row }));
const journalBanque = (serveur) => serveur.journalEnseignant().filter((l) => l.action.startsWith('editeur_banque'));

test('migration 0012 : la colonne « modifie_par » (vide pour les outils d’avant), l’historique vide ; aucune autre table touchée', () => {
  const db = fausseD1({ jusqua: 11 });
  const tables = db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
  const photographie = () => tables.map((table) => db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map(({ modifie_par: _p, ...row }) => ({ ...row })));
  const avant = photographie();
  db.sqlite.exec(migrationSql(12));
  assert.deepEqual(photographie(), avant);
  assert.deepEqual(db.sqlite.prepare('SELECT DISTINCT modifie_par FROM banque_outils').all().map((row) => row.modifie_par), [null]);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM banque_outils_historique').get().n, 0);
  assert.throws(() => db.sqlite.prepare("INSERT INTO banque_outils_historique (outil_id, contenu, remplace_le, action) VALUES ('x', '{}', 'x', 'archivage')").run(), /CHECK/);
});

test('chaque enregistrement garde le contenu remplacé, avec sa date et son auteur ; sans changement, rien n’est écrit ; le journal dit les changements en clair', async () => {
  const serveur = await editeurDeTest();
  const depart = await outil(serveur, 'mvlnr');
  assert.deepEqual([depart.outil.revision, depart.outil.modifie_le, depart.outil.modifie_par, depart.historique, depart.erreurs, depart.avertissements], [1, SEMENCE, null, [], [], []]);
  const premier = await enregistrer(serveur, 'mvlnr', (o) => { o.nom = 'MVLNR modifié'; });
  assert.deepEqual([premier.status, premier.corps.enregistre, premier.corps.revision, premier.corps.lignes], [200, true, 2, ['Nom : « MVLNR » → « MVLNR modifié »']]);
  serveur.avancer(60_000);
  const second = await enregistrer(serveur, 'mvlnr', (o) => { o.dimensions = o.dimensions.slice(0, 2); o.limite_rpm = 2500; });
  assert.equal(second.status, 200, JSON.stringify(second.corps));
  assert.deepEqual(second.corps.lignes, ["Vitesse de rotation max : « 3000 » → « 2500 »", `Dimensions : retirées ${depart.outil.outil.dimensions.slice(2).slice(0, 6).map((d) => `« ${d.libelle} »`).join(', ')}${depart.outil.outil.dimensions.length - 2 > 6 ? ` et ${depart.outil.outil.dimensions.length - 8} autre${depart.outil.outil.dimensions.length - 8 > 1 ? 's' : ''}` : ''}`]);
  const page = await outil(serveur, 'mvlnr');
  assert.deepEqual([page.outil.revision, page.outil.modifie_par, page.historique.length], [3, 'admin', 2]);
  // Le plus récent en tête : le contenu du premier enregistrement (par admin), puis celui de la semence (sans auteur).
  assert.deepEqual(page.historique.map((h) => [h.action, h.enregistre_par, h.remplace_par]), [['enregistrement', 'admin', 'admin'], ['enregistrement', null, 'admin']]);
  assert.equal(page.historique[1].enregistre_le, SEMENCE);
  assert.equal(page.historique[0].enregistre_le, page.historique[1].remplace_le);
  // Ce que le rétablir changerait, en clair : de l'état actuel vers ce contenu.
  assert.deepEqual(page.historique[1].lignes.slice(0, 2), ['Nom : « MVLNR modifié » → « MVLNR »', "Vitesse de rotation max : « 2500 » → « 3000 »"]);
  assert.deepEqual(JSON.parse(historique(serveur)[0].contenu), depart.outil.outil);
  // Sans changement : rien n'est écrit, ni révision, ni historique, ni journal.
  const journalAvant = journalBanque(serveur).length;
  const rien = await enregistrer(serveur, 'mvlnr', () => {});
  assert.deepEqual([rien.status, rien.corps.enregistre, rien.corps.inchange, rien.corps.revision], [200, false, true, 3]);
  assert.deepEqual([historique(serveur).length, journalBanque(serveur).length], [2, journalAvant]);
  // Le journal : chaque enregistrement, avec ses changements.
  assert.deepEqual(journalBanque(serveur).map((l) => l.details), ['mvlnr · révision 2 · 1 changement(s) : Nom : « MVLNR » → « MVLNR modifié »', `mvlnr · révision 3 · 2 changement(s) : ${second.corps.lignes.join(' ; ')}`]);
  // L'archivage reste hors de l'historique.
  assert.equal((await serveur.editeur('POST', 'banque/archiver', { id: 'mvlnr', archive: true })).status, 200);
  assert.equal(historique(serveur).length, 2);
  // Créer un outil ne remplace rien ; son auteur est retenu.
  assert.equal((await serveur.editeur('POST', 'banque/creer', { id: 'mvlnr_2', depuis: 'mvlnr' })).status, 200);
  assert.deepEqual([(await outil(serveur, 'mvlnr_2')).outil.modifie_par, (await outil(serveur, 'mvlnr_2')).historique], ['admin', []]);
});

test('« Rétablir » : un contenu de l’historique revient en un clic ; celui qu’il remplace va à l’historique ; 409, 404, rien à changer ; journal', async () => {
  const serveur = await editeurDeTest();
  assert.equal((await enregistrer(serveur, 'mclnr', (o) => { o.nom = 'MCLNR retouché'; o.commentaire = 'Note retouchée'; })).status, 200);
  const page = await outil(serveur, 'mclnr');
  const semence = page.historique[0];
  // 409 : une révision périmée ; rien n'est écrit.
  const perime = await serveur.editeur('POST', 'banque/retablir', { id: 'mclnr', revision: 1, historique: semence.id });
  assert.deepEqual([perime.status, perime.corps.revision_actuelle], [409, 2]);
  assert.equal(historique(serveur).length, 1);
  const retabli = await serveur.editeur('POST', 'banque/retablir', { id: 'mclnr', revision: 2, historique: semence.id });
  assert.equal(retabli.status, 200, JSON.stringify(retabli.corps));
  assert.deepEqual([retabli.corps.revision, retabli.corps.lignes, retabli.corps.erreurs], [3, ['Nom : « MCLNR retouché » → « MCLNR »', "Note : « Note retouchée » → « Outil d'ébauche »"], []]);
  const apres = await outil(serveur, 'mclnr');
  assert.deepEqual([apres.outil.outil.nom, apres.outil.outil.commentaire, apres.historique.length, apres.historique[0].action], ['MCLNR', "Outil d'ébauche", 2, 'retablissement']);
  assert.equal(apres.historique[0].lignes[0], 'Nom : « MCLNR » → « MCLNR retouché »'); // le contenu remplacé, rétablissable à son tour
  // Rien à changer : l'entrée de la semence est maintenant identique au contenu actuel.
  const identique = await serveur.editeur('POST', 'banque/retablir', { id: 'mclnr', revision: 3, historique: semence.id });
  assert.deepEqual([identique.status, identique.corps.erreur], [400, 'Aucune différence avec le contenu actuel : rien à rétablir.']);
  assert.equal((await serveur.editeur('POST', 'banque/retablir', { id: 'mclnr', revision: 3, historique: 999 })).status, 404);
  assert.equal((await serveur.editeur('POST', 'banque/retablir', { id: 'mvlnr', revision: 1, historique: semence.id })).status, 404); // l'historique d'un autre outil
  assert.equal((await serveur.editeur('POST', 'banque/retablir', { id: 'inconnu', revision: 1, historique: semence.id })).status, 404);
  // Le journal.
  const ligne = journalBanque(serveur).find((l) => l.action === 'editeur_banque_historique_retablissement');
  assert.match(ligne.details, new RegExp(`^mclnr · historique n° ${semence.id} \\(remplacé le .* UTC\\) · 2 changement\\(s\\) : Nom : « MCLNR retouché » → « MCLNR » ; Note : `));
  // Le contrôle optimiste de l'enregistrement aussi : une révision périmée → 409, rien n'est écrit.
  const vieux = await serveur.editeur('POST', 'banque/enregistrer', { id: 'mclnr', revision: 2, outil: { ...apres.outil.outil, nom: 'Périmé' } });
  assert.deepEqual([vieux.status, vieux.corps.revision_actuelle], [409, 3]);
  assert.equal((await outil(serveur, 'mclnr')).outil.outil.nom, 'MCLNR');
});

test('contenu ancien devenu invalide : une matière d’outil renommée dans les tables — l’historique le dit avant, « Rétablir » le remet quand même, avec ses erreurs', async () => {
  const serveur = await editeurDeTest();
  // Le foret passe au carbure seul (valide avant et après) ; son contenu de départ nomme l'acier rapide.
  assert.equal((await enregistrer(serveur, 'foret_fractionnaire', (o) => { o.materiaux_outil = ['Carbure de tungstène solide']; })).status, 200);
  // Les tables A2026_r1 renomment l'acier rapide « HSS » (sans cascade).
  const tables = (await serveur.editeur('GET', 'tables')).corps;
  const contenu = structuredClone(tables.brouillon.contenu);
  contenu.materiaux.materiaux_outil = contenu.materiaux.materiaux_outil.map((m) => (m.cle === 'acier_rapide' ? { ...m, nom: 'HSS' } : m));
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: tables.brouillon.revision, contenu });
  assert.equal((await serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id: 'A2026_r1', cascade: [] })).status, 200);
  const page = await outil(serveur, 'foret_fractionnaire');
  assert.deepEqual(page.erreurs, []);
  assert.ok(page.historique[0].erreurs.length > 0 && page.historique[0].erreurs.every((m) => /Acier rapide/.test(m)), page.historique[0].erreurs.join('\n'));
  const retabli = await serveur.editeur('POST', 'banque/retablir', { id: 'foret_fractionnaire', revision: page.outil.revision, historique: page.historique[0].id });
  assert.equal(retabli.status, 200, JSON.stringify(retabli.corps));
  assert.ok(retabli.corps.erreurs.length > 0 && retabli.corps.erreurs.every((e) => /Acier rapide/.test(e.message)));
  const apres = await outil(serveur, 'foret_fractionnaire');
  assert.deepEqual([apres.outil.outil.materiaux_outil.includes('Acier rapide'), apres.erreurs.length > 0], [true, true]);
  assert.match(journalBanque(serveur).at(-1).details, /erreur\(s\) avec les tables d'aujourd'hui$/);
});

test('images : une photo choisie doit exister et ne pas être archivée ; archivée en place, un avertissement ; « Rétablir » permis ; une photo de l’historique de la banque ne se supprime pas', async () => {
  const serveur = await editeurDeTest();
  const nombre = () => historique(serveur).length;
  const inconnue = await enregistrer(serveur, 'alesoir', (o) => { o.image = 'img-inconnue'; });
  assert.deepEqual([inconnue.status, inconnue.corps.erreur], [400, "La photo « img-inconnue » est inconnue. Rien n'a été enregistré."]);
  assert.equal((await serveur.editeur('POST', 'images/archiver', { id: 'mclnr', archive: true })).status, 200);
  const archivee = await enregistrer(serveur, 'alesoir', (o) => { o.image = 'mclnr'; });
  assert.equal(archivee.status, 400);
  assert.match(archivee.corps.erreur, /La photo « mclnr » est archivée/);
  assert.equal(nombre(), 0);
  assert.equal((await serveur.editeur('POST', 'banque/creer', { id: 'nouveau', outil: { ...(await outil(serveur, 'alesoir')).outil.outil, image: 'mclnr' } })).status, 400);
  // En place et archivée (la photo du MCLNR) : un avertissement, qui ne bloque pas un autre changement.
  const enPlace = await enregistrer(serveur, 'mclnr', (o) => { o.nom = 'MCLNR bis'; });
  assert.equal(enPlace.status, 200, JSON.stringify(enPlace.corps));
  assert.match(enPlace.corps.avertissements[0], /La photo « mclnr » est archivée ; elle reste affichée et ne bloque rien/);
  assert.equal((await outil(serveur, 'mclnr')).avertissements.length, 1);
  // L'alésoir change de photo : la sienne n'est plus nommée que par son historique — utilisée, elle ne se supprime pas.
  assert.equal((await enregistrer(serveur, 'alesoir', (o) => { o.image = 'mvlnr'; })).status, 200);
  const alesoir = (await serveur.editeur('GET', 'images')).corps.images.find((i) => i.id === 'alesoir').utilisations;
  assert.deepEqual([alesoir.banque, alesoir.banque_historique.length], [[], 1]);
  assert.match(alesoir.banque_historique[0], /^alesoir · historique n° \d+$/);
  const supprimer = await serveur.editeur('POST', 'images/supprimer', { id: 'alesoir' });
  assert.equal(supprimer.status, 409);
  assert.match(supprimer.corps.erreur, /historique de la banque \(alesoir · historique n° \d+\)/);
  // Archivée depuis, elle se rétablit quand même, avec l'avertissement.
  assert.equal((await serveur.editeur('POST', 'images/archiver', { id: 'alesoir', archive: true })).status, 200);
  const page = await outil(serveur, 'alesoir');
  assert.deepEqual([page.historique[0].erreurs, page.historique[0].avertissements.length], [[], 1]);
  const retabli = await serveur.editeur('POST', 'banque/retablir', { id: 'alesoir', revision: page.outil.revision, historique: page.historique[0].id });
  assert.equal(retabli.status, 200, JSON.stringify(retabli.corps));
  assert.match(retabli.corps.avertissements[0], /La photo « alesoir » est archivée/);
  assert.equal((await outil(serveur, 'alesoir')).outil.outil.image, 'alesoir');
});

test('Sauvegarde : l’historique de la banque dans l’export ; l’aller-retour ne change rien ; l’import met chaque contenu qu’il remplace ou retire dans l’historique, et une restauration se défait outil par outil', async () => {
  const source = await editeurDeTest();
  assert.equal((await enregistrer(source, 'mvlnr', (o) => { o.nom = 'MVLNR v2'; })).status, 200);
  const { corps: exporte } = await source.editeur('GET', 'export');
  assert.deepEqual(exporte.historique_banque.map((h) => [h.outil_id, h.action, h.enregistre_le, h.remplace_par]), [['mvlnr', 'enregistrement', SEMENCE, 'admin']]);
  // Aller-retour : rien ne change — ni la banque (révisions, dates, auteurs), ni l'historique.
  const lignes = () => source.db.sqlite.prepare('SELECT * FROM banque_outils ORDER BY id').all().map((row) => ({ ...row }));
  const avant = lignes();
  const valide = await source.editeur('POST', 'import/valider', { export: exporte });
  assert.deepEqual([valide.corps.erreurs, valide.corps.resume.banque_historique, valide.corps.resume.banque.modifies], [[], 0, []]);
  assert.equal((await source.editeur('POST', 'import', { export: exporte, confirmation: IMPORT_WORD })).status, 200);
  const sansDates = ({ exporte_le, ...rest }) => rest;
  assert.deepEqual(sansDates((await source.editeur('GET', 'export')).corps), sansDates(exporte));
  assert.deepEqual(lignes(), avant);
  assert.equal(historique(source).length, 1);

  // Une autre base (la semence), où le MVLNR a été retouché autrement, et l'alésoir absent de l'export.
  const cible = await editeurDeTest();
  cible.avancer(60_000); // un autre moment : son contenu remplacé n'est pas celui de l'export
  assert.equal((await enregistrer(cible, 'mvlnr', (o) => { o.nom = 'MVLNR de la cible'; })).status, 200);
  const sansAlesoir = { ...exporte, banque: exporte.banque.filter((b) => b.id !== 'alesoir') };
  const plan = (await cible.editeur('POST', 'import/valider', { export: sansAlesoir })).corps.resume;
  assert.deepEqual([plan.banque_historique, plan.banque.modifies.map((t) => t.id), plan.banque.retires.map((t) => t.id)], [1, ['mvlnr'], ['alesoir']]);
  assert.equal((await cible.editeur('POST', 'import', { export: sansAlesoir, confirmation: REPLACE_WORD })).status, 200);
  const mvlnr = await outil(cible, 'mvlnr');
  assert.equal(mvlnr.outil.outil.nom, 'MVLNR v2');
  // Son historique : celui de la cible, celui de l'export, et le contenu que l'import a remplacé (« import »).
  assert.deepEqual(mvlnr.historique.map((h) => h.action).sort(), ['enregistrement', 'enregistrement', 'import']);
  const parImport = mvlnr.historique.find((h) => h.action === 'import');
  assert.deepEqual([parImport.enregistre_par, parImport.remplace_par, parImport.lignes], ['admin', 'admin', ['Nom : « MVLNR v2 » → « MVLNR de la cible »']]);
  // L'import se défait outil par outil : « Rétablir » ramène le MVLNR de la cible.
  assert.equal((await cible.editeur('POST', 'banque/retablir', { id: 'mvlnr', revision: mvlnr.outil.revision, historique: parImport.id })).status, 200);
  assert.equal((await outil(cible, 'mvlnr')).outil.outil.nom, 'MVLNR de la cible');
  // L'alésoir retiré : son contenu est dans l'historique ; recréé sous le même identifiant, il le retrouve et se rétablit.
  assert.equal((await cible.editeur('GET', 'banque/outil?id=alesoir')).status, 404);
  assert.equal((await cible.editeur('POST', 'banque/creer', { id: 'alesoir', outil: { ...mvlnr.outil.outil, id: 'alesoir', nom: 'À remplacer', image: null } })).status, 200);
  const recree = await outil(cible, 'alesoir');
  assert.deepEqual(recree.historique.map((h) => h.action), ['import']);
  assert.equal((await cible.editeur('POST', 'banque/retablir', { id: 'alesoir', revision: recree.outil.revision, historique: recree.historique[0].id })).status, 200);
  assert.equal((await outil(cible, 'alesoir')).outil.outil.nom, 'Alésoir');
  // Un outil inchangé par l'import garde sa ligne (révision, date, auteur).
  assert.deepEqual((await outil(cible, 'mclnr')).outil.modifie_le, SEMENCE);
  // Un historique illisible dans l'export est refusé, nommé.
  const mauvais = { ...exporte, historique_banque: [{ outil_id: 'mvlnr', contenu: {}, action: 'archivage', remplace_le: 'x' }] };
  assert.match((await cible.editeur('POST', 'import/valider', { export: mauvais })).corps.erreurs[0], /^Historique de la banque, entrée 1 : illisible/);
});

test('titres en double (D79) : deux exercices publiés et non archivés au même titre en vigueur sont signalés, chacun nommant l’autre ; rien n’est bloqué ; l’avertissement disparaît dès qu’un titre change', async () => {
  const serveur = await editeurDeTest();
  const liste = async () => Object.fromEntries((await serveur.editeur('GET', 'exercices')).corps.exercices.map((e) => [e.id, e.doublons]));
  assert.deepEqual(await liste(), { [M10]: [], [VC_RPM]: [] });
  // Un doublon arrive d'ailleurs (un import, un exercice rétabli, ou d'avant D74) : ici, publié directement en base.
  serveur.publierExercice({ ...m10, id: 'autre', titre: `  ${m10.titre.toUpperCase()} ` });
  const autreTitre = `  ${m10.titre.toUpperCase()} `;
  assert.deepEqual(await liste(), { [M10]: [{ id: 'autre', titre: autreTitre }], [VC_RPM]: [], autre: [{ id: M10, titre: m10.titre }] });
  const panneau = async (id) => (await serveur.editeur('GET', `exercice/presentation?id=${id}`)).corps.doublons;
  assert.deepEqual(await panneau(M10), [{ id: 'autre', titre: autreTitre }]);
  assert.deepEqual(await panneau('autre'), [{ id: M10, titre: m10.titre }]);
  // Rien n'est bloqué : une photo changée en direct, une republication.
  const page = (await serveur.editeur('GET', `exercice/presentation?id=${M10}`)).corps;
  const presentation = structuredClone(page.presentation);
  presentation.outils[0].commentaire = 'Nouvelle note';
  assert.equal((await serveur.editeur('POST', 'exercice/presentation/appliquer', { id: M10, revision: page.revision, presentation })).status, 200);
  const exercice = (await serveur.editeur('GET', `exercice?id=${M10}`)).corps;
  const enregistre = await serveur.editeur('POST', 'exercice/enregistrer', { id: M10, revision: exercice.exercice.revision, brouillon: { ...exercice.exercice.brouillon, champs_evalues: ['vc', 'n'] } });
  assert.equal((await serveur.editeur('POST', 'exercice/publier', { id: M10, revision: enregistre.corps.revision })).status, 200);
  assert.deepEqual((await liste())[M10], [{ id: 'autre', titre: autreTitre }]);
  // Archivé, l'un ne compte plus ; rétabli, l'avertissement revient ; renommé, il disparaît des deux côtés.
  assert.equal((await serveur.editeur('POST', 'exercice/archiver', { id: 'autre', archive: true })).status, 200);
  assert.deepEqual(await liste(), { [M10]: [], [VC_RPM]: [], autre: [] });
  assert.equal((await serveur.editeur('POST', 'exercice/archiver', { id: 'autre', archive: false })).status, 200);
  assert.deepEqual((await liste())[M10].map((d) => d.id), ['autre']);
  assert.equal((await serveur.editeur('POST', 'exercice/renommer', { id: 'autre', titre: 'Un autre titre' })).status, 200);
  assert.deepEqual(await liste(), { [M10]: [], [VC_RPM]: [], autre: [] });
  assert.deepEqual([await panneau(M10), await panneau('autre')], [[], []]);
});
