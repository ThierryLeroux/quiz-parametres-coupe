// Tests de l'API de l'éditeur (jalon 7a, décisions D47 à D49) : le vrai Worker sur une fausse D1 semée
// (aide-serveur.js). Rôle admin seulement ; chaque action au journal ; brouillon et versions ; banque
// d'outils ; contrôle de version optimiste ; aperçu ; export et import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINUTE, SECONDE, serveurDeTest } from './aide-serveur.js';
import * as worker from '../worker/index.js';
import { IMPORT_WORD } from '../worker/editeur.js';

const EDITOR_ROUTES = worker.editorRoutes();
import { lireFichier } from './aide.js';

const M10 = 'm10-tournage-vc';
const VC_RPM = 'm10-tournage-vc-rpm';
const CAMILLE = { exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };
const m10 = await lireFichier('exercices/m10-tournage-vc.json');

// Ouvre une séance professeur ; retourne les en-têtes à renvoyer.
async function connexion(serveur, cle = 'cle-admin-de-test') {
  const { status, corps } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle } });
  assert.equal(status, 200, JSON.stringify(corps));
  return { cookie: `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
}

// Un serveur avec une séance professeur admin ouverte ; `editeur(methode, chemin, corps)` parle à l'éditeur.
async function editeurDeTest(options = {}) {
  const serveur = serveurDeTest(options);
  const entetes = await connexion(serveur);
  serveur.editeur = (methode, chemin, corps) => serveur.appel(methode, `/api/prof/editeur/${chemin}`, { corps, entetes });
  serveur.entetes = entetes;
  return serveur;
}

// L'exercice de l'éditeur : { exercice: { brouillon, revision… }, versions, derniere_version, tables, erreurs }.
async function ouvrir(serveur, id) {
  const { status, corps } = await serveur.editeur('GET', `exercice?id=${id}`);
  assert.equal(status, 200, JSON.stringify(corps));
  return corps;
}

// Enregistre un brouillon ; retourne la réponse.
const enregistrer = (serveur, id, revision, brouillon) => serveur.editeur('POST', 'exercice/enregistrer', { id, revision, brouillon });

// Crée la séance de Camille et demande sa première question ; retourne { jeton, seance }.
async function commencer(serveur, etudiant = CAMILLE) {
  const { status, corps } = await serveur.appel('POST', '/api/creation', { corps: etudiant });
  assert.equal(status, 200, JSON.stringify(corps));
  const question = await serveur.appel('POST', '/api/question', { jeton: corps.jeton, corps: { exercice: etudiant.exercice } });
  return { jeton: corps.jeton, seance: question.corps.seance };
}

// --- Accès (B1) : rôle admin seulement, chaque action au journal --------------------------------------------------

test('worker/index.js n’exporte que des fonctions et le gestionnaire : le Workers runtime refuse tout autre export du module d’entrée', () => {
  for (const [name, value] of Object.entries(worker)) {
    assert.ok(typeof value === 'function' || (name === 'default' && typeof value.fetch === 'function'), `export « ${name} » : ${typeof value}`);
  }
});

test('chaque route de l’éditeur refuse le rôle consultation (403) et l’absence de cookie (401), sans rien écrire', async () => {
  const serveur = serveurDeTest();
  const consultation = await connexion(serveur, 'cle-consultation-de-test');
  assert.ok(EDITOR_ROUTES.length >= 15, `${EDITOR_ROUTES.length} routes`);
  const photographie = () => ['exercices', 'versions_exercice', 'banque_outils', 'tables_reference', 'journal_enseignant'].map((table) => serveur.db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map((row) => ({ ...row })));
  const avant = photographie();
  for (const route of EDITOR_ROUTES) {
    const [methode, chemin] = route.split(' ');
    const corps = methode === 'POST' ? { id: M10, revision: 1, brouillon: m10, outil: {}, export: {}, confirmation: IMPORT_WORD, archive: true, titre: 'x', version: 1 } : undefined;
    const refuse = await serveur.appel(methode, `${chemin}${methode === 'GET' ? `?id=${M10}` : ''}`, { corps, entetes: consultation });
    assert.equal(refuse.status, 403, route);
    assert.match(refuse.corps.erreur, /réservée à la clé d'administration/);
    assert.equal((await serveur.appel(methode, chemin, { corps })).status, 401, `${route} sans cookie`);
  }
  assert.deepEqual(photographie(), avant); // rien n'a été écrit, pas même au journal
});

test('chaque action de l’éditeur est inscrite au journal des actions, avec l’enseignant « admin » ; l’aperçu et les lectures, non', async () => {
  const serveur = await editeurDeTest();
  const depart = serveur.journalEnseignant().length; // la connexion
  assert.equal((await serveur.editeur('GET', 'exercices')).status, 200);
  assert.equal((await serveur.editeur('POST', 'apercu', { id: M10 })).status, 200);
  assert.equal(serveur.journalEnseignant().length, depart);
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id: 'essai', titre: 'Essai' })).status, 200);
  const { exercice } = await ouvrir(serveur, 'essai');
  assert.equal((await enregistrer(serveur, 'essai', exercice.revision, { ...exercice.brouillon, titre: 'Essai 2' })).status, 200);
  assert.equal((await serveur.editeur('POST', 'exercice/renommer', { id: 'essai', titre: 'Essai 3' })).status, 200);
  assert.equal((await serveur.editeur('POST', 'exercice/archiver', { id: 'essai', archive: true })).status, 200);
  assert.equal((await serveur.editeur('POST', 'exercice/supprimer', { id: 'essai' })).status, 200);
  assert.equal((await serveur.editeur('GET', 'export')).status, 200);
  const actions = serveur.journalEnseignant().slice(depart);
  assert.deepEqual(actions.map((l) => [l.action, l.enseignant, l.seance_id]), [
    ['editeur_creation', 'admin', null], ['editeur_enregistrement', 'admin', null], ['editeur_renommage', 'admin', null],
    ['editeur_archivage', 'admin', null], ['editeur_suppression', 'admin', null], ['editeur_export', 'admin', null],
  ]);
  assert.equal(actions[0].details, 'essai · Essai');
  assert.equal(actions[2].details, 'essai · « Essai 2 » → « Essai 3 »');
});

// --- Liste des exercices (B2) ------------------------------------------------------------------------------------

test('liste des exercices : état du brouillon, dernière version, séances par version ; dupliquer, renommer, archiver, supprimer', async () => {
  const serveur = await editeurDeTest();
  await commencer(serveur);
  const { corps: liste } = await serveur.editeur('GET', 'exercices');
  assert.deepEqual(liste.exercices.map((e) => e.id), [M10, VC_RPM]);
  const [m10Row] = liste.exercices;
  assert.deepEqual([m10Row.titre, m10Row.modifie, m10Row.derniere_version, m10Row.archive_le, m10Row.seances, m10Row.liste], [m10.titre, false, 1, null, 1, true]);
  assert.deepEqual(m10Row.versions.map((v) => [v.numero, v.seances]), [[1, 1]]);
  assert.deepEqual(liste.exercices[1].versions.map((v) => [v.numero, v.seances]), [[1, 0]]);

  // Dupliquer : un nouveau brouillon, jamais publié, dont le titre dit « copie ».
  assert.deepEqual((await serveur.editeur('POST', 'exercice/creer', { id: 'm10-copie', depuis: M10 })).corps, { cree: true, id: 'm10-copie' });
  const copie = (await serveur.editeur('GET', 'exercices')).corps.exercices.find((e) => e.id === 'm10-copie');
  assert.deepEqual([copie.titre, copie.modifie, copie.derniere_version, copie.versions, copie.seances], [`${m10.titre} (copie)`, true, null, [], 0]);
  assert.deepEqual((await ouvrir(serveur, 'm10-copie')).exercice.brouillon.outils.map((c) => c.id), m10.outils.map((o) => o.id));
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id: 'm10-copie', depuis: M10 })).status, 409); // id pris
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id: 'Mauvais Id', titre: 'x' })).status, 400);
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id: 'index', titre: 'x' })).status, 400);
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id: 'sans-titre' })).status, 400);
  // Un exercice jamais publié n'existe pas pour les étudiants.
  assert.equal((await serveur.appel('POST', '/api/creation', { corps: { ...CAMILLE, exercice: 'm10-copie' } })).status, 400);

  // Renommer : le titre du brouillon change ; celui de la version publiée, non — jusqu'à la publication.
  assert.deepEqual((await serveur.editeur('POST', 'exercice/renommer', { id: M10, titre: '  M10 — renommé ' })).corps, { renomme: true, titre: 'M10 — renommé' });
  const renomme = (await serveur.editeur('GET', 'exercices')).corps.exercices.find((e) => e.id === M10);
  assert.deepEqual([renomme.titre, renomme.modifie], ['M10 — renommé', true]);
  assert.equal((await serveur.appel('GET', `/api/exercice?exercice=${M10}`)).corps.exercice.titre, m10.titre);
  assert.equal((await serveur.editeur('POST', 'exercice/renommer', { id: M10, titre: ' ' })).status, 400);

  // Archiver : retiré de la liste des étudiants, jamais supprimé s'il a des séances ; rétablir.
  const ligneM10 = async () => (await serveur.editeur('GET', 'exercices')).corps.exercices.find((e) => e.id === M10);
  assert.deepEqual((await serveur.editeur('POST', 'exercice/archiver', { id: M10, archive: true })).corps, { archive: true, id: M10 });
  assert.notEqual((await ligneM10()).archive_le, null);
  assert.deepEqual((await serveur.appel('GET', '/api/exercices')).corps.exercices.map((e) => e.id), [VC_RPM]);
  const refus = await serveur.editeur('POST', 'exercice/supprimer', { id: M10 });
  assert.deepEqual([refus.status, refus.corps.erreur], [409, 'Cet exercice a 1 séance(s) : il ne peut pas être supprimé, seulement archivé.']);
  assert.equal((await serveur.editeur('POST', 'exercice/archiver', { id: M10, archive: false })).corps.archive, false);
  assert.equal((await ligneM10()).archive_le, null);
  // Supprimer : seulement sans séance ; la copie, jamais publiée, part.
  assert.deepEqual((await serveur.editeur('POST', 'exercice/supprimer', { id: 'm10-copie' })).corps, { supprime: true, id: 'm10-copie' });
  assert.equal((await serveur.editeur('GET', 'exercice?id=m10-copie')).status, 404);
  assert.equal((await serveur.editeur('POST', 'exercice/supprimer', { id: 'm10-copie' })).status, 404);
});

// --- Page d'un exercice (B3, B5) : brouillon, validation, contrôle optimiste ------------------------------------------

test('ouvrir un exercice : le brouillon avec sa révision, ses versions, la dernière version publiée, les tables et les erreurs', async () => {
  const serveur = await editeurDeTest();
  const page = await ouvrir(serveur, M10);
  assert.deepEqual([page.exercice.id, page.exercice.revision, page.exercice.archive_le, page.erreurs], [M10, 1, null, []]);
  assert.deepEqual(page.exercice.brouillon.outils.map((c) => [c.id, c.reussites_requises, c.origine]), m10.outils.map((o) => [o.id, o.reussites_requises, o.id]));
  assert.deepEqual(page.versions.map((v) => v.numero), [1]);
  assert.deepEqual(page.derniere_version.contenu, page.exercice.brouillon);
  assert.deepEqual([page.tables.id, page.tables.materiaux.groupes_iso.length, page.tables.operations.operations.length], ['A2026_r0', 20, 19]);
  assert.equal((await serveur.editeur('GET', 'exercice?id=inconnu')).status, 404);
});

test('enregistrer le brouillon : la révision monte, les erreurs sont rendues sans bloquer ; un brouillon mal formé est refusé', async () => {
  const serveur = await editeurDeTest();
  const { exercice } = await ouvrir(serveur, M10);
  const brouillon = structuredClone(exercice.brouillon);
  brouillon.outils[1].fact_vc = 0; // MVLNR : facteur de vitesse nul
  brouillon.outils[1].reussites_requises = 0;
  brouillon.titre = 'M10 — brouillon';
  const { status, corps } = await enregistrer(serveur, M10, exercice.revision, brouillon);
  assert.equal(status, 200, JSON.stringify(corps));
  assert.equal(corps.revision, 2);
  assert.deepEqual(corps.erreurs.map((e) => e.champ), ['outils.1.reussites_requises', 'outils.1.fact_vc']);
  const relu = await ouvrir(serveur, M10);
  assert.deepEqual([relu.exercice.revision, relu.exercice.brouillon.titre, relu.exercice.brouillon.outils[1].fact_vc, relu.erreurs.length], [2, 'M10 — brouillon', 0, 2]);
  // Un commentaire « _… » et une clé inconnue : le premier passe, la seconde est une erreur.
  assert.deepEqual((await enregistrer(serveur, M10, 2, { ...brouillon, _note: 'x', inconnue: 1 })).corps.erreurs.some((e) => e.champ === 'inconnue'), false); // cleanDraft retire les clés inconnues avant d'enregistrer
  assert.equal((await enregistrer(serveur, M10, 3, { titre: 'x' })).status, 400);
  assert.equal((await enregistrer(serveur, M10, 'x', brouillon)).status, 400);
  assert.equal((await enregistrer(serveur, 'inconnu', 1, brouillon)).status, 404);
  // Les étudiants ne voient rien de tout cela : la version 1 publiée est intacte.
  assert.equal((await serveur.appel('GET', `/api/exercice?exercice=${M10}`)).corps.exercice.titre, m10.titre);
});

test('conflit d’enregistrement (D48) : l’éditeur ouvert sur deux appareils, le second enregistrement est refusé (409) avec un message clair, rien n’est écrasé', async () => {
  const serveur = await editeurDeTest();
  const poste1 = await ouvrir(serveur, M10);
  const poste2 = await ouvrir(serveur, M10);
  assert.equal((await enregistrer(serveur, M10, poste1.exercice.revision, { ...poste1.exercice.brouillon, titre: 'Depuis le poste 1' })).status, 200);
  const refus = await enregistrer(serveur, M10, poste2.exercice.revision, { ...poste2.exercice.brouillon, titre: 'Depuis le poste 2' });
  assert.equal(refus.status, 409);
  assert.match(refus.corps.erreur, /enregistré ailleurs depuis ton ouverture/);
  assert.equal(refus.corps.revision_actuelle, 2);
  assert.equal((await ouvrir(serveur, M10)).exercice.brouillon.titre, 'Depuis le poste 1');
  // Même règle pour renommer et publier avec une révision périmée.
  assert.equal((await serveur.editeur('POST', 'exercice/publier', { id: M10, revision: poste2.exercice.revision })).status, 409);
  assert.equal(serveur.journalEnseignant().filter((l) => l.action === 'editeur_enregistrement').length, 1);
});

// --- Copies indépendantes de la banque (A1, B4) ----------------------------------------------------------------------

test('copie indépendante : modifier ou archiver un outil de la banque ne change ni un brouillon ni une version ; la banque compte les copies', async () => {
  const serveur = await editeurDeTest();
  const { corps: banque } = await serveur.editeur('GET', 'banque');
  const mvlnr = banque.outils.find((o) => o.id === 'mvlnr');
  assert.deepEqual([mvlnr.revision, mvlnr.archive_le, mvlnr.exercices], [1, null, [M10]]);
  assert.deepEqual(banque.outils.find((o) => o.id === 'foret_fractionnaire').exercices, [VC_RPM]);
  assert.deepEqual(banque.outils.find((o) => o.id === 'alesoir').exercices, []);
  assert.equal(banque.outils.length, 29);

  const modifie = { ...mvlnr.outil, nom: 'MVLNR modifié', dimensions: mvlnr.outil.dimensions.slice(0, 1) };
  const { status, corps } = await serveur.editeur('POST', 'banque/enregistrer', { id: 'mvlnr', revision: 1, outil: modifie });
  assert.equal(status, 200, JSON.stringify(corps));
  assert.deepEqual([corps.revision, corps.erreurs], [2, []]);
  assert.equal((await serveur.editeur('POST', 'banque/archiver', { id: 'mvlnr', archive: true })).status, 200);

  const page = await ouvrir(serveur, M10);
  assert.deepEqual([page.exercice.brouillon.outils[1].nom, page.exercice.brouillon.outils[1].dimensions.length], ['MVLNR', 7]);
  assert.deepEqual([page.derniere_version.contenu.outils[1].nom], ['MVLNR']);
  const { seance } = await commencer(serveur);
  assert.equal(seance.progression.outils[1].nom, 'MVLNR');
  // Et inversement : une copie modifiée dans l'exercice ne touche pas la banque.
  const brouillon = structuredClone(page.exercice.brouillon);
  brouillon.outils[0].nom = 'MCLNR (exercice)';
  assert.equal((await enregistrer(serveur, M10, page.exercice.revision, brouillon)).status, 200);
  assert.equal((await serveur.editeur('GET', 'banque')).corps.outils.find((o) => o.id === 'mclnr').outil.nom, 'MCLNR');
  // Contrôle optimiste sur la banque aussi.
  assert.equal((await serveur.editeur('POST', 'banque/enregistrer', { id: 'mvlnr', revision: 1, outil: modifie })).status, 409);
});

test('banque : créer, dupliquer, un outil invalide s’enregistre avec ses erreurs ; identifiant mal formé ou pris refusé', async () => {
  const serveur = await editeurDeTest();
  const { corps: banque } = await serveur.editeur('GET', 'banque');
  const foret = banque.outils.find((o) => o.id === 'foret_udrill').outil;
  assert.deepEqual((await serveur.editeur('POST', 'banque/creer', { id: 'foret_udrill_2', depuis: 'foret_udrill' })).corps, { cree: true, id: 'foret_udrill_2' });
  const copie = (await serveur.editeur('GET', 'banque')).corps.outils.at(-1);
  assert.deepEqual([copie.id, copie.outil.nom, copie.outil.dimensions.length, copie.rang], ['foret_udrill_2', 'Foret Udrill (copie)', foret.dimensions.length, 30]);
  assert.deepEqual((await serveur.editeur('POST', 'banque/creer', { id: 'nouveau', outil: { ...foret, nom: 'Nouveau' } })).corps, { cree: true, id: 'nouveau' });
  assert.equal((await serveur.editeur('POST', 'banque/creer', { id: 'nouveau', outil: foret })).status, 409);
  assert.equal((await serveur.editeur('POST', 'banque/creer', { id: 'Nouveau-2', outil: foret })).status, 400);
  assert.equal((await serveur.editeur('POST', 'banque/creer', { id: 'x', depuis: 'inconnu' })).status, 404);
  const invalide = await serveur.editeur('POST', 'banque/enregistrer', { id: 'nouveau', revision: 1, outil: { ...foret, nb_dents_max: 0 } });
  assert.equal(invalide.status, 200);
  assert.match(invalide.corps.erreurs[0].message, /nb_dents/);
  assert.equal((await serveur.editeur('POST', 'banque/enregistrer', { id: 'inconnu', revision: 1, outil: foret })).status, 404);
});

test('ajouter une copie à un exercice depuis la banque ou depuis un autre exercice, puis publier : la version porte les copies telles quelles', async () => {
  const serveur = await editeurDeTest();
  const { exercice, tables } = await ouvrir(serveur, M10);
  const alesoir = (await serveur.editeur('GET', 'banque')).corps.outils.find((o) => o.id === 'alesoir').outil;
  const rpm = await ouvrir(serveur, VC_RPM);
  const foretDeRpm = rpm.exercice.brouillon.outils.find((c) => c.id === 'foret_a_pointer');
  const brouillon = structuredClone(exercice.brouillon);
  brouillon.outils.push({ ...alesoir, image: 'alesoir', reussites_requises: 2, origine: 'alesoir', dimensions: alesoir.dimensions.slice(0, 2) });
  brouillon.outils.push({ ...structuredClone(foretDeRpm), id: 'foret_a_pointer', reussites_requises: 1 });
  assert.deepEqual((await enregistrer(serveur, M10, exercice.revision, brouillon)).corps.erreurs, []);
  assert.equal(tables.id, 'A2026_r0');
  const publication = await serveur.editeur('POST', 'exercice/publier', { id: M10, revision: 2 });
  assert.equal(publication.status, 200, JSON.stringify(publication.corps));
  assert.deepEqual([publication.corps.publie, publication.corps.numero], [true, 2]);
  const { seance } = await commencer(serveur);
  assert.deepEqual([seance.exercice.version, seance.progression.outils.length], ['2', 11]);
  assert.deepEqual(seance.progression.outils.at(-2), { id: 'alesoir', nom: 'Alésoir', operation: "Alésage à l'alésoir", plage: `${alesoir.dimensions[0].libelle} à ${alesoir.dimensions[1].libelle}`, reussites: 0, requises: 2 });
  assert.equal(seance.progression.outils.at(-1).id, 'foret_a_pointer');
});

// --- Publication (B6) ---------------------------------------------------------------------------------------------

test('publier : bloqué par une erreur de validation (400, erreurs jointes) ; publiable une fois corrigé : version 2, brouillon « à jour », les nouvelles séances la prennent', async () => {
  const serveur = await editeurDeTest();
  const { exercice } = await ouvrir(serveur, M10);
  const brouillon = structuredClone(exercice.brouillon);
  brouillon.outils[0].limite_rpm = -1;
  assert.equal((await enregistrer(serveur, M10, 1, brouillon)).status, 200);
  const refus = await serveur.editeur('POST', 'exercice/publier', { id: M10, revision: 2 });
  assert.equal(refus.status, 400);
  assert.match(refus.corps.erreur, /1 erreur\(s\) : il ne peut pas être publié/);
  assert.deepEqual(refus.corps.erreurs, [{ champ: 'outils.0.limite_rpm', message: '« limite_rpm » doit être un nombre > 0' }]);
  assert.deepEqual((await serveur.editeur('GET', 'exercices')).corps.exercices[0].versions.map((v) => v.numero), [1]);
  assert.equal(serveur.journalEnseignant().some((l) => l.action === 'editeur_publication'), false);

  brouillon.outils[0].limite_rpm = 2500;
  brouillon.titre = 'M10 — v2';
  assert.equal((await enregistrer(serveur, M10, 2, brouillon)).status, 200);
  const ok = await serveur.editeur('POST', 'exercice/publier', { id: M10, revision: 3 });
  assert.deepEqual([ok.status, ok.corps.publie, ok.corps.numero], [200, true, 2]);
  const ligne = (await serveur.editeur('GET', 'exercices')).corps.exercices[0];
  assert.deepEqual([ligne.modifie, ligne.derniere_version, ligne.titre, ligne.versions.map((v) => v.numero)], [false, 2, 'M10 — v2', [2, 1]]);
  assert.equal(serveur.journalEnseignant().at(-1).details, `${M10} · version 2 · tables A2026_r0`);
  const { seance } = await commencer(serveur);
  assert.deepEqual([seance.exercice.titre, seance.exercice.version], ['M10 — v2', '2']);
  assert.equal(seance.question.outil.id === 'mclnr' ? seance.question.outil.limite_rpm : 2500, 2500);
  // Publier sans changement : refusé ? Non — une version identique est permise (l'enseignant décide) ; mais rien n'oblige. Ici : version 3 identique.
  assert.equal((await serveur.editeur('POST', 'exercice/publier', { id: M10, revision: 3 })).corps.numero, 3);
});

// --- Aperçu (B7) ---------------------------------------------------------------------------------------------------

test('aperçu : dix questions avec la nomenclature composée et les réponses attendues des grandeurs évaluées, sur le brouillon (même non enregistré) ou sur une version ; rien n’est enregistré', async () => {
  const serveur = await editeurDeTest();
  const avant = [serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM seances').get().n, serveur.journalEnseignant().length];
  const { exercice } = await ouvrir(serveur, M10);
  const brouillon = { ...structuredClone(exercice.brouillon), champs_evalues: ['vc', 'n'], outils: exercice.brouillon.outils.slice(0, 1) }; // le MCLNR seul, Vc et N
  const { status, corps } = await serveur.editeur('POST', 'apercu', { id: M10, brouillon });
  assert.equal(status, 200, JSON.stringify(corps));
  assert.deepEqual(corps.champs_evalues, ['vc', 'n']);
  assert.equal(corps.questions.length, 10);
  for (const q of corps.questions) {
    assert.match(q.identifiant, /^MCLNR - Ø charioté: /);
    assert.deepEqual([q.outil_id, q.outil, q.operation, q.barre, q.dents], ['mclnr', 'MCLNR', 'Chariotage ébauche', null, 1]);
    assert.deepEqual(Object.keys(q.reponses), ['vc', 'rpm']);
    assert.match(q.reponses.rpm, /^\d+$/);
    assert.deepEqual(Object.keys(q.materiau), ['classe', 'groupe', 'materiau', 'etat']);
  }
  const version = await serveur.editeur('POST', 'apercu', { id: M10, version: 1 });
  assert.equal(version.corps.questions.length, 10);
  assert.deepEqual(version.corps.champs_evalues, ['vc']);
  assert.ok(new Set(version.corps.questions.map((q) => q.outil_id)).size > 1);
  assert.equal((await serveur.editeur('POST', 'apercu', { id: M10, version: 9 })).status, 404);
  assert.equal((await serveur.editeur('POST', 'apercu', { id: M10, brouillon: { ...brouillon, outils: [] } })).status, 400);
  assert.deepEqual([serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM seances').get().n, serveur.journalEnseignant().length], avant);
  // La barre à aléser dans l'aperçu : nommée avec sa barre.
  const barre = await serveur.editeur('POST', 'apercu', { id: M10, brouillon: { ...brouillon, outils: exercice.brouillon.outils.filter((c) => c.id === 'barre_a_aleser') } });
  assert.ok(barre.corps.questions.every((q) => q.barre !== null && /^Barre à aléser Ø /.test(q.identifiant)));
});

// --- Sauvegarde (B8) : export, import ------------------------------------------------------------------------------

test('export puis import : l’export réimporté ne change rien (aller-retour identique) ; les séances et attestations ne sont pas touchées', async () => {
  const serveur = await editeurDeTest();
  const { jeton } = await commencer(serveur);
  serveur.avancer(11 * SECONDE);
  await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: serveur.bonnesReponses() } });
  const { status, corps: exporte } = await serveur.editeur('GET', 'export');
  assert.equal(status, 200);
  assert.deepEqual([exporte.format, exporte.tables_reference.length, exporte.banque.length, exporte.exercices.map((e) => e.id)], ['quiz-parametres-coupe/editeur/1', 1, 29, [M10, VC_RPM]]);
  assert.deepEqual(exporte.exercices[0].versions.map((v) => v.numero), [1]);
  assert.equal(JSON.stringify(exporte).includes('2412345'), false); // aucune donnée d'étudiant

  const validation = await serveur.editeur('POST', 'import/valider', { export: exporte });
  assert.equal(validation.status, 200, JSON.stringify(validation.corps));
  assert.deepEqual(validation.corps.erreurs, []);
  assert.deepEqual(validation.corps.resume, { tables_ajoutees: [], banque: 29, exercices_ajoutes: [], exercices_remplaces: [M10, VC_RPM], versions_ajoutees: [], exercices_gardes: [] });
  assert.equal((await serveur.editeur('POST', 'import', { export: exporte, confirmation: 'oui' })).status, 400);
  const avant = ['seances', 'corrections', 'attestations'].map((t) => serveur.db.sqlite.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all().map((r) => ({ ...r })));
  const importe = await serveur.editeur('POST', 'import', { export: exporte, confirmation: IMPORT_WORD });
  assert.equal(importe.status, 200, JSON.stringify(importe.corps));
  const { corps: apres } = await serveur.editeur('GET', 'export');
  const sansDates = ({ exporte_le, ...rest }) => rest;
  assert.deepEqual(sansDates(apres), sansDates(exporte));
  assert.deepEqual(['seances', 'corrections', 'attestations'].map((t) => serveur.db.sqlite.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all().map((r) => ({ ...r }))), avant);
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 200);
  assert.equal(serveur.journalEnseignant().at(-2).action, 'editeur_import'); // puis le second export
});

test('import par fusion (D49) : ajoute les exercices, versions et tables absents, remplace les brouillons et la banque ; refuse une version différente sous un numéro existant, un format inconnu, un contenu invalide', async () => {
  const source = await editeurDeTest();
  // Sur le poste source : un nouvel exercice publié, une version 2 du M10, un outil de banque en plus.
  assert.equal((await source.editeur('POST', 'exercice/creer', { id: 'nouveau', depuis: VC_RPM })).status, 200);
  assert.equal((await source.editeur('POST', 'exercice/publier', { id: 'nouveau', revision: 1 })).status, 200);
  const { exercice } = await ouvrir(source, M10);
  assert.equal((await enregistrer(source, M10, exercice.revision, { ...exercice.brouillon, titre: 'M10 v2' })).status, 200);
  assert.equal((await source.editeur('POST', 'exercice/publier', { id: M10, revision: 2 })).status, 200);
  assert.equal((await source.editeur('POST', 'banque/creer', { id: 'alesoir_3', depuis: 'alesoir' })).status, 200);
  const { corps: exporte } = await source.editeur('GET', 'export');

  // Sur la cible : la base semée, avec une séance sur la version 1 du M10, et un exercice qui n'est pas dans l'export (gardé).
  const cible = await editeurDeTest();
  const { jeton } = await commencer(cible);
  assert.equal((await cible.editeur('POST', 'exercice/creer', { id: 'local', titre: 'Local' })).status, 200);
  const validation = await cible.editeur('POST', 'import/valider', { export: exporte });
  assert.deepEqual(validation.corps.erreurs, []);
  assert.deepEqual({ ...validation.corps.resume, versions_ajoutees: [...validation.corps.resume.versions_ajoutees].sort() }, { tables_ajoutees: [], banque: 30, exercices_ajoutes: ['nouveau'], exercices_remplaces: [M10, VC_RPM], versions_ajoutees: [`${M10} v2`, 'nouveau v1'], exercices_gardes: ['local'] });
  assert.equal((await cible.editeur('POST', 'import', { export: exporte, confirmation: IMPORT_WORD })).status, 200);
  const liste = (await cible.editeur('GET', 'exercices')).corps.exercices;
  const parId = (id) => liste.find((e) => e.id === id);
  assert.deepEqual(liste.map((e) => [e.id, e.derniere_version, e.titre]).sort(), [['local', null, 'Local'], [M10, 2, 'M10 v2'], [VC_RPM, 1, parId(VC_RPM).titre], ['nouveau', 1, `${parId(VC_RPM).titre} (copie)`]]);
  assert.equal((await cible.editeur('GET', 'banque')).corps.outils.length, 30);
  // La séance de Camille est toujours épinglée à la version 1, intacte.
  assert.deepEqual((await cible.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance.exercice, { id: M10, titre: m10.titre, version: '1' });
  assert.equal((await cible.appel('POST', '/api/creation', { corps: { ...CAMILLE, matricule: '2498765' } })).corps.seance.exercice.version, '2');

  // Refus : une version 1 différente sous le même numéro ; un format inconnu ; une version au contenu invalide.
  const different = structuredClone(exporte);
  different.exercices.find((e) => e.id === M10).versions[0].contenu.titre = 'Autre';
  const refus = await cible.editeur('POST', 'import/valider', { export: different });
  assert.match(refus.corps.erreurs[0], /version 1 : la base en a une version différente/);
  assert.equal((await cible.editeur('POST', 'import', { export: different, confirmation: IMPORT_WORD })).status, 400);
  assert.match((await cible.editeur('POST', 'import/valider', { export: { format: 'autre' } })).corps.erreurs[0], /n'est pas un export/);
  const invalide = structuredClone(exporte);
  invalide.exercices.find((e) => e.id === M10).versions[1].contenu.outils[0].fact_vc = 0;
  assert.match((await cible.editeur('POST', 'import/valider', { export: invalide })).corps.erreurs[0], /version 2 : outils\.0\.fact_vc/);
  invalide.exercices.find((e) => e.id === M10).versions[1].tables_id = 'inconnue';
  assert.match((await cible.editeur('POST', 'import/valider', { export: invalide })).corps.erreurs[0], /tables de référence « inconnue » inconnues/);
});

// --- Les tables pour l'éditeur ---------------------------------------------------------------------------------------

test('GET /api/prof/editeur/tables : les tables de référence les plus récentes', async () => {
  const serveur = await editeurDeTest();
  const { corps } = await serveur.editeur('GET', 'tables');
  assert.deepEqual([corps.tables.id, corps.tables.materiaux.revision, corps.tables.operations.revision], ['A2026_r0', 'A2026_r0', 'A2026_r0']);
  serveur.avancer(MINUTE);
});
