// Tests de la présentation des exercices en direct (chantier E5, jalon E5-3, décision D78), par le vrai Worker sur une
// base SQLite en mémoire : la migration 0011, la liste blanche imposée par le serveur, une séance épinglée qui voit le
// titre, la photo et la note en vigueur et garde exactement ses valeurs, l'attestation déjà émise identique octet pour
// octet, la nouvelle attestation qui inscrit le titre affiché, le titre en double, la copie nouvelle, l'instantané à la
// publication, les retouches en attente, « Rétablir », le contrôle optimiste, le journal, la Sauvegarde, les images.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECONDE, serveurDeTest } from './aide-serveur.js';
import { fausseD1, migrationSql } from './aide-d1.js';
import { IMPORT_WORD } from '../worker/editeur.js';
import { copyOfTool, liveTitleRefusal } from '../site/js/exercice.js';
import { lireFichier } from './aide.js';

const M10 = 'm10-tournage-vc';
const VC_RPM = 'm10-tournage-vc-rpm';
const CAMILLE = { exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };
const ALEX = { ...CAMILLE, prenom: 'Alex', nom: 'Roy', matricule: '2498765' };
const m10 = await lireFichier('exercices/m10-tournage-vc.json');
const vcRpm = await lireFichier('exercices/m10-tournage-vc-rpm.json');

async function editeurDeTest(options = {}) {
  const serveur = serveurDeTest(options);
  const { status, corps } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } });
  assert.equal(status, 200, JSON.stringify(corps));
  const entetes = { cookie: `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
  serveur.editeur = (methode, chemin, corps) => serveur.appel(methode, `/api/prof/editeur/${chemin}`, { corps, entetes });
  serveur.prof = (methode, chemin, corps) => serveur.appel(methode, `/api/prof/${chemin}`, { corps, entetes });
  return serveur;
}

// Le panneau de la présentation d'un exercice, tel que la Gestion du contenu le reçoit.
async function panneau(serveur, id = M10) {
  const { status, corps } = await serveur.editeur('GET', `exercice/presentation?id=${id}`);
  assert.equal(status, 200, JSON.stringify(corps));
  return corps;
}

// Applique la présentation en vigueur modifiée par `retouche` (qui reçoit une copie) ; rend la réponse.
async function appliquer(serveur, retouche, id = M10) {
  const page = await panneau(serveur, id);
  const presentation = structuredClone(page.presentation);
  retouche(presentation);
  return serveur.editeur('POST', 'exercice/presentation/appliquer', { id, revision: page.revision, presentation });
}

const outil = (presentation, id) => presentation.outils.find((e) => e.id === id);
const ouvrir = async (serveur, id = M10) => (await serveur.editeur('GET', `exercice?id=${id}`)).corps;

async function enregistrerEtPublier(serveur, id, retouche) {
  const page = await ouvrir(serveur, id);
  const brouillon = structuredClone(page.exercice.brouillon);
  retouche(brouillon);
  const enregistre = await serveur.editeur('POST', 'exercice/enregistrer', { id, revision: page.exercice.revision, brouillon });
  assert.equal(enregistre.status, 200, JSON.stringify(enregistre.corps));
  const publie = await serveur.editeur('POST', 'exercice/publier', { id, revision: enregistre.corps.revision });
  assert.equal(publie.status, 200, JSON.stringify(publie.corps));
  return publie.corps.numero;
}

async function commencer(serveur, etudiant = CAMILLE) {
  const { status, corps } = await serveur.appel('POST', '/api/creation', { corps: etudiant });
  assert.equal(status, 200, JSON.stringify(corps));
  const question = await serveur.appel('POST', '/api/question', { jeton: corps.jeton, corps: { exercice: etudiant.exercice } });
  return { jeton: corps.jeton, seance: question.corps.seance };
}

async function reussir(serveur, etudiant = CAMILLE) {
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

const lignesDe = (serveur, table) => serveur.db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map((row) => ({ ...row }));

test('migration 0011 : deux tables vides (aucune ligne : rien d’appliqué) ; aucune autre table touchée ; au déploiement, l’exercice servi ne change pas', async () => {
  // Des données produites par le serveur d'aujourd'hui (séances, attestation, journal)…
  const production = await editeurDeTest();
  await reussir(production);
  await commencer(production, ALEX);
  const exerciceServi = (await production.appel('GET', `/api/exercice?exercice=${M10}`)).corps;
  // …transplantées dans une base au schéma d'avant la 0011.
  const db = fausseD1({ jusqua: 10 });
  const tables = db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
  assert.equal(tables.includes('presentation_exercices'), false);
  db.sqlite.exec('PRAGMA foreign_keys = OFF'); // les lignes arrivent table par table
  for (const table of tables) {
    db.sqlite.exec(`DELETE FROM ${table}`);
    const colonnes = db.sqlite.prepare(`SELECT name FROM pragma_table_info('${table}')`).all().map((row) => row.name);
    const insert = db.sqlite.prepare(`INSERT INTO ${table} (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`);
    for (const row of production.db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()) insert.run(...colonnes.map((c) => row[c]));
  }
  db.sqlite.exec('PRAGMA foreign_keys = ON');
  const photographie = () => tables.map((table) => db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map((row) => ({ ...row })));
  const avant = photographie();
  db.sqlite.exec(migrationSql(11));
  assert.deepEqual(photographie(), avant);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM presentation_exercices').get().n, 0);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM presentation_exercices_historique').get().n, 0);
  assert.throws(() => db.sqlite.prepare("INSERT INTO presentation_exercices_historique (exercice_id, contenu, remplacee_le, action) VALUES ('x', '{}', 'x', 'autre')").run(), /CHECK/);
  // Rien d'appliqué : l'exercice servi est celui d'avant, octet pour octet.
  const serveur = serveurDeTest({ db });
  assert.deepEqual((await serveur.appel('GET', `/api/exercice?exercice=${M10}`)).corps, exerciceServi);
  assert.equal(JSON.stringify((await serveur.appel('GET', `/api/exercice?exercice=${M10}`)).corps), JSON.stringify(exerciceServi));
});

test('liste blanche imposée par le serveur : tout autre champ (racine ou copie) est refusé et nommé ; une copie inconnue aussi ; rien n’est écrit', async () => {
  const serveur = await editeurDeTest();
  const page = await panneau(serveur);
  assert.deepEqual([page.revision, page.appliquee, page.derniere_version, page.historique, page.erreurs, page.avertissements], [0, false, 1, [], [], []]);
  assert.deepEqual(page.presentation.outils.map((e) => e.id), m10.outils.map((o) => o.id));
  assert.deepEqual(page.outils[0], { id: 'mclnr', nom: 'MCLNR', derniere_version: true });
  const envoyer = (presentation) => serveur.editeur('POST', 'exercice/presentation/appliquer', { id: M10, revision: 0, presentation });
  const racine = await envoyer({ ...page.presentation, champs_evalues: ['vc', 'n'] });
  assert.equal(racine.status, 400);
  assert.match(racine.corps.erreurs[0], /« champs_evalues » est hors de la liste blanche de la présentation/);
  const copie = await envoyer({ ...page.presentation, outils: page.presentation.outils.map((e, i) => (i === 0 ? { ...e, fact_vc: 2 } : e)) });
  assert.deepEqual([copie.status, copie.corps.erreurs], [400, ["outils[0] (mclnr) : « fact_vc » est hors de la liste blanche de la présentation : il se modifie dans le brouillon de l'exercice, puis se publie"]]);
  const inconnue = await envoyer({ ...page.presentation, outils: [...page.presentation.outils, { id: 'inconnue', image: null, commentaire: null }] });
  assert.equal(inconnue.status, 400);
  assert.match(inconnue.corps.erreurs[0], /outils\[9\] \(inconnue\) : cette copie n'est dans aucune version publiée de l'exercice/);
  assert.equal((await envoyer({ ...page.presentation, titre: '' })).status, 400);
  assert.equal((await envoyer(page.presentation)).corps.erreur, 'Aucune différence avec la présentation en vigueur : rien à appliquer.');
  assert.deepEqual([lignesDe(serveur, 'presentation_exercices'), lignesDe(serveur, 'presentation_exercices_historique')], [[], []]);
  assert.equal(serveur.journalEnseignant().some((l) => l.action.startsWith('editeur_presentation_exercice')), false);
  // Un exercice jamais publié n'a pas de présentation en vigueur : elle est dans son brouillon.
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id: 'neuf', titre: 'Neuf' })).status, 200);
  const neuf = await serveur.editeur('GET', 'exercice/presentation?id=neuf');
  assert.deepEqual([neuf.status, neuf.corps.erreur], [400, "Cet exercice n'a jamais été publié : son titre, son cours, « À l'accueil », les photos et les notes sont dans son brouillon, et entrent en vigueur à sa première publication."]);
  assert.equal((await ouvrir(serveur, 'neuf')).presentation, null);
  assert.equal((await serveur.editeur('POST', 'exercice/presentation/appliquer', { id: 'neuf', revision: 0, presentation: page.presentation })).status, 400);
  assert.equal((await serveur.editeur('GET', 'exercice/presentation?id=inconnu')).status, 404);
});

test('séance épinglée : elle voit le titre, la photo et la note en vigueur, dès que la page se recharge, et garde exactement ses valeurs — question figée, réponses attendues, correction', async () => {
  const serveur = await editeurDeTest();
  const { jeton, seance } = await commencer(serveur);
  const enAttente = seance.question.outil.id;
  const retiree = m10.outils.find((o) => o.id !== enAttente).id;
  const questionAvant = serveur.seance().question_courante;
  const attenduesAvant = serveur.bonnesReponses();
  // Une version 2 qui retire une copie : la séance de Camille reste sur la version 1.
  assert.equal(await enregistrerEtPublier(serveur, M10, (b) => { b.outils = b.outils.filter((c) => c.id !== retiree); }), 2);
  // En direct : le titre, le cours, la photo et la note de l'outil de sa question.
  const photo = enAttente === 'mvlnr' ? 'mclnr' : 'mvlnr';
  const applique = await appliquer(serveur, (p) => {
    Object.assign(p, { titre: 'M10 — titre en direct', cours: 'M10' });
    Object.assign(outil(p, enAttente), { image: photo, commentaire: 'Note en direct' });
  });
  assert.equal(applique.status, 200, JSON.stringify(applique.corps));
  assert.equal(applique.corps.lignes.length, 4);

  const suite = (await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance;
  assert.deepEqual(suite.exercice, { id: M10, titre: 'M10 — titre en direct', version: '1' });
  assert.deepEqual([suite.question.outil.image, suite.question.outil.commentaire], [photo, 'Note en direct']);
  const { image: _i, commentaire: _c, ...resteDeLOutil } = suite.question.outil;
  const { image: _i2, commentaire: _c2, ...resteAvant } = seance.question.outil;
  assert.deepEqual({ ...suite.question, outil: resteDeLOutil }, { ...seance.question, outil: resteAvant });
  assert.deepEqual(suite.progression, seance.progression);
  // Sa version, servie avec la présentation par-dessus ; la copie que la version 2 a retirée, que la présentation ne connaît pas, garde la sienne.
  const v1 = (await serveur.appel('GET', `/api/exercice?exercice=${M10}&version=1`)).corps.exercice;
  assert.deepEqual([v1.titre, v1.cours, v1.version], ['M10 — titre en direct', 'M10', '1']);
  assert.deepEqual([v1.outils.find((o) => o.id === enAttente).image, v1.outils.find((o) => o.id === enAttente).commentaire], [photo, 'Note en direct']);
  assert.equal(v1.outils.find((o) => o.id === retiree).image, retiree);
  // Les valeurs n'ont pas bougé : la même question, les mêmes réponses attendues, jugées justes.
  assert.equal(serveur.seance().question_courante, questionAvant);
  assert.deepEqual(serveur.bonnesReponses(), attenduesAvant);
  serveur.avancer(11 * SECONDE);
  const corrige = await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: attenduesAvant } });
  assert.equal(corrige.status, 200, JSON.stringify(corrige.corps));
  assert.equal(corrige.corps.correction.reussie, true);
  assert.equal(corrige.corps.seance.exercice.titre, 'M10 — titre en direct');
  // L'accueil, la page de description et l'espace professeur montrent aussi le titre en vigueur.
  const accueil = (await serveur.appel('GET', '/api/exercices')).corps.exercices.find((e) => e.id === M10);
  assert.deepEqual([accueil.titre, accueil.cours], ['M10 — titre en direct', 'M10']);
  const seances = (await serveur.prof('GET', 'seances')).corps;
  assert.equal(seances.seances[0].exercice.titre, 'M10 — titre en direct');
  assert.ok(seances.exercices.some((e) => e.id === M10 && e.titre === 'M10 — titre en direct'));
  // « À l'accueil » : non → l'exercice quitte la liste de l'accueil, sans nouvelle version ; il reste joignable par son lien.
  assert.equal((await appliquer(serveur, (p) => { p.liste = false; })).status, 200);
  assert.deepEqual((await serveur.appel('GET', '/api/exercices')).corps.exercices.map((e) => e.id), [VC_RPM]);
  assert.equal((await serveur.appel('GET', `/api/exercice?exercice=${M10}`)).corps.exercice.liste, false);
});

test('attestation déjà émise : identique octet pour octet après un changement de présentation ; une nouvelle attestation inscrit le titre en vigueur à sa réussite, et se vérifie', async () => {
  const serveur = await editeurDeTest();
  const jeton = await reussir(serveur);
  const avant = (await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton })).corps;
  const lignesAvant = lignesDe(serveur, 'attestations');
  assert.equal(avant.attestation.exercice.titre, m10.titre);

  assert.equal((await appliquer(serveur, (p) => { p.titre = 'M10 — nouveau titre'; outil(p, 'mclnr').commentaire = 'Autre note'; })).status, 200);
  assert.equal((await serveur.editeur('POST', 'exercice/renommer', { id: M10, titre: 'M10 — renommé ensuite' })).status, 200);
  const apres = (await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton })).corps;
  assert.deepEqual(apres, avant);
  assert.equal(JSON.stringify(apres), JSON.stringify(avant));
  assert.deepEqual(lignesDe(serveur, 'attestations'), lignesAvant); // l'enregistrement, sa signature, son code : rien n'a bougé en base
  const verifiee = (await serveur.appel('POST', '/api/verification', { corps: { code: avant.code } })).corps;
  assert.deepEqual([verifiee.resultat, verifiee.attestation.exercice.titre], ['valide', m10.titre]);

  // Alex réussit après le changement : son attestation porte le titre affiché à sa réussite, dans le même champ.
  const jetonAlex = await reussir(serveur, ALEX);
  const sienne = (await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton: jetonAlex })).corps;
  assert.deepEqual(sienne.attestation.exercice, { id: M10, titre: 'M10 — renommé ensuite' });
  assert.deepEqual(Object.keys(sienne.attestation), Object.keys(avant.attestation)); // le même enregistrement, champ pour champ
  assert.equal(sienne.attestation.revision, '1');
  const alexVerifiee = (await serveur.appel('POST', '/api/verification', { corps: Object.fromEntries(new URL(sienne.url_verification).searchParams) })).corps;
  assert.deepEqual([alexVerifiee.resultat, alexVerifiee.attestation.exercice.titre], ['valide', 'M10 — renommé ensuite']);
  // Un titre changé après sa réussite ne change pas non plus la sienne.
  assert.equal((await serveur.editeur('POST', 'exercice/renommer', { id: M10, titre: 'M10 — encore un autre' })).status, 200);
  assert.deepEqual((await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton: jetonAlex })).corps, sienne);
});

test('titre en double (D74, D78) : refusé en direct, par le serveur, si un AUTRE exercice publié et non archivé porte le même titre en vigueur (casse, accents, espaces) — avec son nom ; un archivé ou un jamais publié ne compte pas ; un titre qui ne change pas n’est pas vérifié', async () => {
  const serveur = await editeurDeTest();
  const titreEnDouble = `  ${vcRpm.titre.toUpperCase().replace('É', 'E')}   `;
  const refus = await appliquer(serveur, (p) => { p.titre = titreEnDouble; });
  assert.equal(refus.status, 400);
  assert.equal(refus.corps.erreur, liveTitleRefusal([{ id: VC_RPM, titre: vcRpm.titre }]));
  assert.match(refus.corps.erreur, /^Titre refusé : un autre exercice publié porte déjà ce titre : « M10 — Tournage : Vc et RPM » \(m10-tournage-vc-rpm\)\./);
  assert.deepEqual(refus.corps.doublons, [{ id: VC_RPM, titre: vcRpm.titre }]);
  assert.equal((await serveur.editeur('POST', 'exercice/renommer', { id: M10, titre: vcRpm.titre })).status, 400);
  assert.deepEqual([lignesDe(serveur, 'presentation_exercices'), lignesDe(serveur, 'presentation_exercices_historique')], [[], []]);
  // Un exercice jamais publié portant ce titre ne compte pas ; l'autre, renommé en direct, libère le sien.
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id: 'brouillon-seul', titre: 'Titre libre' })).status, 200);
  assert.equal((await serveur.editeur('POST', 'exercice/renommer', { id: M10, titre: 'Titre libre' })).status, 200);
  // Archivé : ne compte pas. Rétabli, le doublon reste en place ; un changement qui ne touche pas au titre passe.
  assert.equal((await serveur.editeur('POST', 'exercice/archiver', { id: VC_RPM, archive: true })).status, 200);
  assert.equal((await serveur.editeur('POST', 'exercice/renommer', { id: M10, titre: vcRpm.titre })).status, 200);
  assert.equal((await serveur.editeur('POST', 'exercice/archiver', { id: VC_RPM, archive: false })).status, 200);
  assert.equal((await appliquer(serveur, (p) => { outil(p, 'mclnr').commentaire = 'Nouvelle note'; })).status, 200);
  // Rétablir un titre pris : refusé de même.
  const titreLibre = (await panneau(serveur)).historique.find((h) => h.lignes.some((l) => l.includes('Titre libre')));
  assert.ok(titreLibre);
  assert.equal((await serveur.editeur('POST', 'exercice/renommer', { id: VC_RPM, titre: 'Titre libre' })).status, 200);
  const retabli = await serveur.editeur('POST', 'exercice/presentation/retablir', { id: M10, revision: (await panneau(serveur)).revision, historique: titreLibre.id });
  assert.deepEqual([retabli.status, retabli.corps.doublons], [400, [{ id: VC_RPM, titre: 'Titre libre' }]]);
  // Le jamais publié reste libre, et la règle s'applique à sa première publication, contre les titres en vigueur.
  const page = await ouvrir(serveur, 'brouillon-seul');
  const brouillon = { ...page.exercice.brouillon, titre: 'titre LIBRE', outils: (await ouvrir(serveur)).exercice.brouillon.outils.slice(0, 1) };
  const enregistre = await serveur.editeur('POST', 'exercice/enregistrer', { id: 'brouillon-seul', revision: page.exercice.revision, brouillon });
  assert.deepEqual(enregistre.corps.erreurs, []);
  const premiere = await serveur.editeur('POST', 'exercice/publier', { id: 'brouillon-seul', revision: enregistre.corps.revision });
  assert.deepEqual([premiere.status, premiere.corps.doublons], [400, [{ id: VC_RPM, titre: 'Titre libre' }]]);
});

test('copie nouvelle : sa photo et sa note de départ viennent de sa ligne du brouillon ; la version publiée les porte, puis elles sont en vigueur et se modifient en direct', async () => {
  const serveur = await editeurDeTest();
  const banque = (await serveur.editeur('GET', 'banque')).corps.outils;
  const foret = banque.find((b) => b.id === 'foret_fractionnaire').outil;
  const nouvelle = { ...copyOfTool(foret, { id: 'foret_nouveau' }), image: 'foret_a_lettre', commentaire: 'Note de départ' };
  // Avant sa publication, la présentation ne la connaît pas : elle ne s'y applique pas.
  const page = await ouvrir(serveur);
  const enregistre = await serveur.editeur('POST', 'exercice/enregistrer', { id: M10, revision: page.exercice.revision, brouillon: { ...page.exercice.brouillon, outils: [...page.exercice.brouillon.outils, nouvelle] } });
  assert.deepEqual(enregistre.corps.erreurs, []);
  const trop = await appliquer(serveur, (p) => { p.outils.push({ id: 'foret_nouveau', image: null, commentaire: 'x' }); });
  assert.equal(trop.status, 400);
  assert.equal((await serveur.editeur('POST', 'exercice/publier', { id: M10, revision: enregistre.corps.revision })).status, 200);
  const v2 = JSON.parse(serveur.db.sqlite.prepare('SELECT contenu FROM versions_exercice WHERE exercice_id = ? AND numero = 2').get(M10).contenu);
  assert.deepEqual([v2.outils.at(-1).image, v2.outils.at(-1).commentaire], ['foret_a_lettre', 'Note de départ']);
  const apres = await panneau(serveur);
  assert.deepEqual(outil(apres.presentation, 'foret_nouveau'), { id: 'foret_nouveau', image: 'foret_a_lettre', commentaire: 'Note de départ' });
  assert.deepEqual(apres.outils.at(-1), { id: 'foret_nouveau', nom: foret.nom, derniere_version: true });
  assert.equal((await appliquer(serveur, (p) => { outil(p, 'foret_nouveau').commentaire = 'Note en direct'; })).status, 200);
  const servi = (await serveur.appel('GET', `/api/exercice?exercice=${M10}`)).corps.exercice.outils.find((o) => o.id === 'foret_nouveau');
  assert.equal(servi.commentaire, 'Note en direct');
});

test('publication : la version prend la présentation en vigueur (un instantané), jamais celle qui dort dans le brouillon ; la cascade aussi ; le brouillon modifié et « aucune différence » ne comparent que les valeurs', async () => {
  const serveur = await editeurDeTest();
  assert.equal((await appliquer(serveur, (p) => { p.titre = 'Titre en direct'; outil(p, 'mclnr').image = 'mvlnr'; })).status, 200);
  // Un brouillon qui ne diffère que par sa présentation (qui dort) : pas « modifié », rien à publier.
  const page = await ouvrir(serveur);
  const dort = await serveur.editeur('POST', 'exercice/enregistrer', { id: M10, revision: page.exercice.revision, brouillon: { ...page.exercice.brouillon, titre: 'Titre qui dort', cours: 'M99' } });
  assert.equal((await serveur.editeur('GET', 'exercices')).corps.exercices.find((e) => e.id === M10).modifie, false);
  const rien = await serveur.editeur('POST', 'exercice/publier', { id: M10, revision: dort.corps.revision });
  assert.deepEqual([rien.status, rien.corps.erreur], [400, 'Aucune différence à publier : le brouillon est identique à la version 1.']);
  // « Annuler » : rien à annuler non plus.
  assert.equal((await serveur.editeur('POST', 'exercice/annuler', { id: M10, revision: dort.corps.revision })).corps.annule, false);
  // Une valeur change : la version 2 prend le titre et la photo en vigueur.
  assert.equal(await enregistrerEtPublier(serveur, M10, (b) => { b.outils[1].reussites_requises = 5; }), 2);
  const version = (n) => JSON.parse(serveur.db.sqlite.prepare('SELECT contenu FROM versions_exercice WHERE exercice_id = ? AND numero = ?').get(M10, n).contenu);
  assert.deepEqual([version(2).titre, version(2).cours, version(2).outils[0].image, version(2).outils[1].reussites_requises], ['Titre en direct', undefined, 'mvlnr', 5]);
  assert.equal((await ouvrir(serveur)).exercice.brouillon.titre, 'Titre qui dort'); // le brouillon n'est pas touché
  assert.equal((await panneau(serveur)).presentation.titre, 'Titre en direct');
  // La cascade des tables publie aussi avec la présentation en vigueur.
  assert.equal((await appliquer(serveur, (p) => { p.titre = 'Titre avant la cascade'; })).status, 200);
  const tables = (await serveur.editeur('GET', 'tables')).corps;
  const contenu = structuredClone(tables.brouillon.contenu);
  const materiau = contenu.materiaux.materiaux.find((m) => typeof m.vc_pi_min.acier_rapide === 'number');
  materiau.vc_pi_min.acier_rapide += 5;
  const enregistreTables = await serveur.editeur('POST', 'tables/enregistrer', { revision: tables.brouillon.revision, contenu });
  const cascade = (await serveur.editeur('GET', 'tables/cascade')).corps.candidats.find((c) => c.id === M10);
  assert.equal(cascade.titre, 'Titre avant la cascade'); // nommé par son titre en vigueur
  const publie = await serveur.editeur('POST', 'tables/publier', { revision: enregistreTables.corps.revision, id: 'A2026_r1', cascade: [M10] });
  assert.equal(publie.status, 200, JSON.stringify(publie.corps));
  assert.deepEqual([version(3).titre, version(3).outils[0].image], ['Titre avant la cascade', 'mvlnr']);
});

test('retouches en attente : une valeur de présentation du brouillon que ni la présentation en vigueur ni aucune version n’a portée ; une valeur d’une version n’en est pas une', async () => {
  const serveur = await editeurDeTest();
  assert.deepEqual((await panneau(serveur)).en_attente.lignes, []);
  const page = await ouvrir(serveur);
  const brouillon = structuredClone(page.exercice.brouillon);
  brouillon.titre = 'Retouche jamais publiée';
  brouillon.outils[0].commentaire = 'Note retouchée';
  assert.equal((await serveur.editeur('POST', 'exercice/enregistrer', { id: M10, revision: page.exercice.revision, brouillon })).status, 200);
  const enAttente = (await panneau(serveur)).en_attente;
  assert.deepEqual(enAttente.lignes, [`Titre : « ${m10.titre} » → « Retouche jamais publiée »`, `Outil « MCLNR » (mclnr) — note : « Outil d'ébauche » → « Note retouchée »`]);
  assert.equal(enAttente.contenu.titre, 'Retouche jamais publiée');
  // Reprises et appliquées : plus en attente.
  const applique = await serveur.editeur('POST', 'exercice/presentation/appliquer', { id: M10, revision: 0, presentation: enAttente.contenu });
  assert.equal(applique.status, 200, JSON.stringify(applique.corps));
  assert.deepEqual((await panneau(serveur)).en_attente.lignes, []);
  // Une autre application change le titre ; le brouillon garde « Retouche jamais publiée », qui a été en vigueur (elle est
  // dans l'historique) : ce n'est plus une retouche en attente. « Reprendre » la version 1 remet aussi le brouillon d'accord.
  assert.equal((await serveur.editeur('POST', 'exercice/renommer', { id: M10, titre: 'Encore autre' })).status, 200);
  assert.deepEqual((await panneau(serveur)).en_attente.lignes, []);
  const reprise = await serveur.editeur('POST', 'exercice/reprendre', { id: M10, revision: (await ouvrir(serveur)).exercice.revision, numero: 1 });
  assert.equal(reprise.status, 200);
  assert.deepEqual((await panneau(serveur)).en_attente.lignes, []);
});

test('rétablir, contrôle optimiste, journal : chaque contenu remplacé va à l’historique ; « Rétablir » en remet un en un clic ; une révision périmée → 409, rien n’est écrit ; tout est au journal', async () => {
  const serveur = await editeurDeTest();
  assert.equal((await appliquer(serveur, (p) => { p.titre = 'Premier'; })).status, 200);
  assert.equal((await appliquer(serveur, (p) => { p.titre = 'Second'; outil(p, 'mvlnr').commentaire = 'Note'; })).status, 200);
  const page = await panneau(serveur);
  assert.deepEqual([page.revision, page.appliquee, page.presentation.titre, page.historique.length], [2, true, 'Second', 2]);
  assert.deepEqual([page.historique[1].posee_le, page.historique[1].action], [null, 'application']); // la présentation de départ
  const noteDeDepart = (await ouvrir(serveur)).exercice.brouillon.outils[1].commentaire;
  assert.deepEqual(page.historique[1].lignes, [`Titre : « Second » → « ${m10.titre} »`, `Outil « MVLNR » (mvlnr) — note : « Note » → ${noteDeDepart === null ? '—' : `« ${noteDeDepart} »`}`]);
  // 409 : une révision périmée ; rien n'est écrit.
  const perime = await serveur.editeur('POST', 'exercice/presentation/appliquer', { id: M10, revision: 1, presentation: { ...page.presentation, titre: 'Troisième' } });
  assert.deepEqual([perime.status, perime.corps.revision_actuelle], [409, 2]);
  assert.match(perime.corps.erreur, /a été appliquée ailleurs depuis ton ouverture/);
  assert.equal((await panneau(serveur)).presentation.titre, 'Second');
  // Rétablir la présentation de départ.
  const retabli = await serveur.editeur('POST', 'exercice/presentation/retablir', { id: M10, revision: 2, historique: page.historique[1].id });
  assert.equal(retabli.status, 200, JSON.stringify(retabli.corps));
  assert.equal(retabli.corps.lignes.length, 2);
  const apres = await panneau(serveur);
  assert.deepEqual([apres.revision, apres.presentation.titre, apres.historique.length, apres.historique[0].action], [3, m10.titre, 3, 'retablissement']);
  assert.equal((await serveur.appel('GET', `/api/exercice?exercice=${M10}`)).corps.exercice.titre, m10.titre);
  assert.equal((await serveur.editeur('POST', 'exercice/presentation/retablir', { id: M10, revision: 1, historique: page.historique[1].id })).status, 409);
  assert.equal((await serveur.editeur('POST', 'exercice/presentation/retablir', { id: M10, revision: 3, historique: 999 })).status, 404);
  // L'historique d'un autre exercice ne se rétablit pas ici.
  assert.equal((await serveur.editeur('POST', 'exercice/presentation/retablir', { id: VC_RPM, revision: 0, historique: page.historique[1].id })).status, 404);
  // Le journal : chaque geste, avec ses changements en clair.
  const journal = serveur.journalEnseignant().filter((l) => l.action.startsWith('editeur_presentation_exercice'));
  assert.deepEqual(journal.map((l) => [l.action, l.enseignant]), [['editeur_presentation_exercice_application', 'admin'], ['editeur_presentation_exercice_application', 'admin'], ['editeur_presentation_exercice_retablissement', 'admin']]);
  assert.equal(journal[0].details, `${M10} · 1 changement(s) : Titre : « ${m10.titre} » → « Premier »`);
  assert.match(journal[2].details, new RegExp(`^${M10} · historique n° ${page.historique[1].id} \\(remplacée le .* UTC\\) · 2 changement\\(s\\) : Titre : « Second » → `));
  // « Renommer » depuis la liste : le même geste, dit au journal.
  assert.equal((await serveur.editeur('POST', 'exercice/renommer', { id: M10, titre: 'Renommé' })).status, 200);
  assert.equal(serveur.journalEnseignant().at(-1).details, `${M10} · renommé depuis la liste · 1 changement(s) : Titre : « ${m10.titre} » → « Renommé »`);
  assert.equal((await panneau(serveur)).historique.length, 4);
});

test('images : une photo choisie doit exister et ne pas être archivée ; archivée en vigueur, un avertissement qui ne bloque rien ; « Rétablir » permis ; une photo de la présentation (ou de son historique) ne se supprime pas', async () => {
  const serveur = await editeurDeTest();
  const inconnue = await appliquer(serveur, (p) => { outil(p, 'mclnr').image = 'img-inconnue'; });
  assert.deepEqual([inconnue.status, inconnue.corps.erreurs], [400, ["outils[0] (mclnr) : « image » : l'image « img-inconnue » est inconnue"]]);
  assert.equal((await serveur.editeur('POST', 'images/archiver', { id: 'foret_a_lettre', archive: true })).status, 200);
  const archivee = await appliquer(serveur, (p) => { outil(p, 'mclnr').image = 'foret_a_lettre'; });
  assert.match(archivee.corps.erreurs[0], /l'image « foret_a_lettre » est archivée/);
  // Choisie avant d'être archivée : en vigueur, elle ne bloque rien.
  assert.equal((await serveur.editeur('POST', 'images/archiver', { id: 'foret_a_lettre', archive: false })).status, 200);
  assert.equal((await appliquer(serveur, (p) => { outil(p, 'mclnr').image = 'foret_a_lettre'; })).status, 200);
  assert.equal((await serveur.editeur('POST', 'images/archiver', { id: 'foret_a_lettre', archive: true })).status, 200);
  const page = await panneau(serveur);
  assert.deepEqual([page.erreurs, page.avertissements.length], [[], 1]);
  assert.match(page.avertissements[0], /^Outil « MCLNR » \(mclnr\) — photo : l'image « foret_a_lettre » est archivée ; elle reste affichée et ne bloque rien/);
  const note = await appliquer(serveur, (p) => { outil(p, 'mclnr').commentaire = 'Une note'; });
  assert.equal(note.status, 200, JSON.stringify(note.corps));
  assert.equal(note.corps.avertissements.length, 1);
  // Remplacée, puis rétablie depuis l'historique : permis, avec l'avertissement.
  assert.equal((await appliquer(serveur, (p) => { outil(p, 'mclnr').image = 'mclnr'; })).status, 200);
  const avecArchivee = (await panneau(serveur)).historique[0];
  const retabli = await serveur.editeur('POST', 'exercice/presentation/retablir', { id: M10, revision: (await panneau(serveur)).revision, historique: avecArchivee.id });
  assert.equal(retabli.status, 200, JSON.stringify(retabli.corps));
  assert.equal(retabli.corps.avertissements.length, 1);
  // Utilisée par la présentation, ou par son historique : elle ne se supprime pas.
  const utilisations = (await serveur.editeur('GET', 'images')).corps.images.find((i) => i.id === 'foret_a_lettre').utilisations;
  assert.deepEqual(utilisations.presentation_exercices.slice(0, 1), [M10]);
  assert.ok(utilisations.presentation_exercices.slice(1).every((u) => u.startsWith(`${M10} · historique n° `)));
  const supprimer = await serveur.editeur('POST', 'images/supprimer', { id: 'foret_a_lettre' });
  assert.equal(supprimer.status, 409);
  assert.match(supprimer.corps.erreur, /présentation des exercices \(m10-tournage-vc, m10-tournage-vc · historique n° /);
});

test('dupliquer un exercice publié part de sa présentation en vigueur ; supprimer un exercice emporte sa présentation et son historique', async () => {
  const serveur = await editeurDeTest();
  assert.equal((await appliquer(serveur, (p) => { Object.assign(p, { titre: 'M10 en direct', cours: 'M10' }); outil(p, 'mclnr').commentaire = 'Note en direct'; })).status, 200);
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id: 'copie', depuis: M10 })).status, 200);
  const copie = (await ouvrir(serveur, 'copie')).exercice.brouillon;
  assert.deepEqual([copie.titre, copie.cours, copie.outils[0].commentaire], ['M10 en direct (copie)', 'M10', 'Note en direct']);
  // Publiée (jamais de séance), présentée en direct, puis supprimée : il n'en reste rien.
  const page = await ouvrir(serveur, 'copie');
  assert.equal((await serveur.editeur('POST', 'exercice/publier', { id: 'copie', revision: page.exercice.revision })).status, 200);
  assert.equal((await appliquer(serveur, (p) => { p.titre = 'Copie en direct'; }, 'copie')).status, 200);
  assert.equal(lignesDe(serveur, 'presentation_exercices').filter((r) => r.exercice_id === 'copie').length, 1);
  assert.equal((await serveur.editeur('POST', 'exercice/supprimer', { id: 'copie' })).status, 200);
  assert.deepEqual([lignesDe(serveur, 'presentation_exercices').map((r) => r.exercice_id), lignesDe(serveur, 'presentation_exercices_historique').map((r) => r.exercice_id)], [[M10], [M10]]);
});

test('Sauvegarde : la présentation de chaque exercice et son historique dans l’export ; l’aller-retour ne change rien ; une autre base la reçoit, avec effet immédiat', async () => {
  const serveur = await editeurDeTest();
  assert.equal((await appliquer(serveur, (p) => { p.titre = 'Premier'; })).status, 200);
  assert.equal((await appliquer(serveur, (p) => { p.titre = 'Second'; outil(p, 'mclnr').image = 'mvlnr'; })).status, 200);
  const { corps: exporte } = await serveur.editeur('GET', 'export');
  const m10Exporte = exporte.exercices.find((e) => e.id === M10);
  assert.deepEqual([m10Exporte.presentation.contenu.titre, m10Exporte.presentation.enseignant, m10Exporte.presentation.historique.length], ['Second', 'admin', 2]);
  assert.deepEqual(exporte.exercices.find((e) => e.id === VC_RPM).presentation, { contenu: null, modifiee_le: null, enseignant: null, historique: [] });
  // Aller-retour : rien ne change.
  const validation = await serveur.editeur('POST', 'import/valider', { export: exporte });
  assert.deepEqual([validation.corps.erreurs, validation.corps.resume.presentations_exercices], [[], []]);
  assert.equal((await serveur.editeur('POST', 'import', { export: exporte, confirmation: IMPORT_WORD })).status, 200);
  const sansDates = ({ exporte_le, ...rest }) => rest;
  assert.deepEqual(sansDates((await serveur.editeur('GET', 'export')).corps), sansDates(exporte));
  // Une autre base (la semence) : la présentation et son historique arrivent ; effet immédiat.
  const cible = await editeurDeTest();
  const resume = (await cible.editeur('POST', 'import/valider', { export: exporte })).corps.resume;
  assert.deepEqual(resume.presentations_exercices, [{ id: M10, remplacee: true, historique: 2 }]);
  assert.equal((await cible.editeur('POST', 'import', { export: exporte, confirmation: IMPORT_WORD })).status, 200);
  assert.equal((await cible.appel('GET', `/api/exercice?exercice=${M10}`)).corps.exercice.titre, 'Second');
  const recu = await panneau(cible);
  assert.deepEqual([recu.presentation.titre, recu.historique.length, recu.revision], ['Second', 2, 1]);
  assert.match(cible.journalEnseignant().filter((l) => l.action === 'editeur_import').at(-1).details, /présentation des exercices : 1 remplacée\(s\), 2 contenu\(s\) ajouté\(s\) à l'historique$/);
  // Un contenu hors de la liste blanche dans l'export : refusé, nommé.
  const mauvais = structuredClone(exporte);
  mauvais.exercices.find((e) => e.id === M10).presentation.contenu.fact_vc = 2;
  assert.match((await cible.editeur('POST', 'import/valider', { export: mauvais })).corps.erreurs[0], /^Exercice « m10-tournage-vc », présentation : « fact_vc » est hors de la liste blanche/);
});
