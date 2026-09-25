// Tests de l'API des tables de référence versionnées (jalon 7b, partie B, décisions D61 à D63) : le
// brouillon unique et les versions immuables, la révision saisie à la publication, l'exercice qui
// choisit sa version de tables, la séance qui garde les siennes, l'aperçu d'un brouillon de tables,
// l'export et l'import, la vue publique d'une version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINUTE, SECONDE, serveurDeTest } from './aide-serveur.js';
import { IMPORT_WORD } from '../worker/editeur.js';
import { lireFichier } from './aide.js';

const M10 = 'm10-tournage-vc';
const VC_RPM = 'm10-tournage-vc-rpm';
const CAMILLE = { exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };
const ALEX = { exercice: M10, prenom: 'Alex', nom: 'Roy', matricule: '2498765', nip: '1357' };
const testComplet = await lireFichier('exercices/test-complet.json');
const CARBURE = 'Carbure de tungstène solide';

async function editeurDeTest(options = {}) {
  const serveur = serveurDeTest(options);
  const { status, corps } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } });
  assert.equal(status, 200, JSON.stringify(corps));
  const entetes = { cookie: `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
  serveur.editeur = (methode, chemin, corps) => serveur.appel(methode, `/api/prof/editeur/${chemin}`, { corps, entetes });
  return serveur;
}

// Le brouillon des tables, tel que l'éditeur le reçoit : { contenu, revision, … } et le reste de la page.
async function brouillonTables(serveur) {
  const { status, corps } = await serveur.editeur('GET', 'tables');
  assert.equal(status, 200, JSON.stringify(corps));
  return corps;
}

// Le contenu avec la Vc de toutes les lignes doublée pour le carbure solide : une différence visible partout où cette matière est tirée.
function carbureDouble(contenu) {
  const next = structuredClone(contenu);
  next.materiaux.materiaux = next.materiaux.materiaux.map((m) => ({ ...m, vc_pi_min: { ...m.vc_pi_min, carbure_solide: m.vc_pi_min.carbure_solide * 2 } }));
  return next;
}

// Enregistre puis publie le brouillon des tables sous cet identifiant ; retourne la réponse de la publication.
async function publierTables(serveur, contenu, id) {
  const page = await brouillonTables(serveur);
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: page.brouillon.revision, contenu });
  assert.equal(enregistre.status, 200, JSON.stringify(enregistre.corps));
  return serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id });
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

// --- Le brouillon et la publication (D61) ----------------------------------------------------------------------------

test('brouillon des tables : enregistrer monte la révision et rend les erreurs ; un brouillon modifié est dit ; conflit d’enregistrement → 409, rien n’est écrasé ; mal formé → 400', async () => {
  const serveur = await editeurDeTest();
  const page = await brouillonTables(serveur);
  const contenu = carbureDouble(page.brouillon.contenu);
  const { status, corps } = await serveur.editeur('POST', 'tables/enregistrer', { revision: 1, contenu });
  assert.equal(status, 200, JSON.stringify(corps));
  assert.deepEqual(corps, { enregistre: true, revision: 2, erreurs: [] });
  const relu = await brouillonTables(serveur);
  assert.deepEqual([relu.brouillon.revision, relu.modifie, relu.brouillon.contenu.materiaux.materiaux[0].vc_pi_min.carbure_solide], [2, true, page.brouillon.contenu.materiaux.materiaux[0].vc_pi_min.carbure_solide * 2]);
  // Une erreur s'enregistre, mais est dite : un matériau d'une classe inconnue.
  const fautif = structuredClone(contenu);
  fautif.materiaux.materiaux[0].iso = 'Z';
  const avecErreur = await serveur.editeur('POST', 'tables/enregistrer', { revision: 2, contenu: fautif });
  assert.equal(avecErreur.status, 200);
  assert.ok(avecErreur.corps.erreurs.some((e) => /classe « iso » inconnue : « Z »/.test(e.message)), JSON.stringify(avecErreur.corps.erreurs));
  // Conflit : la révision 2 n'est plus la bonne.
  const conflit = await serveur.editeur('POST', 'tables/enregistrer', { revision: 2, contenu });
  assert.deepEqual([conflit.status, conflit.corps.revision_actuelle], [409, 3]);
  assert.equal((await brouillonTables(serveur)).brouillon.contenu.materiaux.materiaux[0].iso, 'Z'); // rien d'écrasé
  assert.equal((await serveur.editeur('POST', 'tables/enregistrer', { revision: 3, contenu: { materiaux: 'x' } })).status, 400);
  assert.equal((await serveur.editeur('POST', 'tables/enregistrer', { revision: 'x', contenu })).status, 400);
  assert.deepEqual(serveur.journalEnseignant().filter((l) => l.action === 'editeur_tables_enregistrement').map((l) => l.details), ['révision 2', 'révision 3 · 2 erreur(s)']);
});

test('publier les tables (D61) : révision saisie, suggérée et unique ; refusé sans différence, avec des erreurs, avec une révision périmée ou mal formée ; la version publiée est immuable et porte sa révision dans les deux JSON', async () => {
  const serveur = await editeurDeTest();
  const page = await brouillonTables(serveur);
  assert.equal(page.suggestion, 'A2026_r1');
  // Sans différence avec A2026_r0 : refusé.
  const identique = await serveur.editeur('POST', 'tables/publier', { revision: 1, id: 'A2026_r1' });
  assert.deepEqual([identique.status, identique.corps.erreur], [400, 'Aucune différence à publier : le brouillon est identique à la version A2026_r0.']);
  // Une révision périmée, un identifiant mal formé.
  assert.equal((await serveur.editeur('POST', 'tables/publier', { revision: 7, id: 'A2026_r1' })).status, 409);
  assert.equal((await serveur.editeur('POST', 'tables/publier', { revision: 1, id: 'A2026 r1' })).status, 400);
  // Avec des erreurs : refusé, erreurs jointes.
  const fautif = structuredClone(page.brouillon.contenu);
  fautif.materiaux.materiaux[0].vc_pi_min.acier_rapide = 0;
  assert.equal((await serveur.editeur('POST', 'tables/enregistrer', { revision: 1, contenu: fautif })).status, 200);
  const enErreur = await serveur.editeur('POST', 'tables/publier', { revision: 2, id: 'A2026_r1' });
  assert.equal(enErreur.status, 400);
  assert.match(enErreur.corps.erreurs[0].message, /vc_pi_min\.acier_rapide/);
  // Corrigé : publié comme A2026_r1 ; le brouillon repart de là.
  serveur.avancer(MINUTE);
  const ok = await publierTables(serveur, carbureDouble(page.brouillon.contenu), 'A2026_r1');
  assert.equal(ok.status, 200, JSON.stringify(ok.corps));
  assert.deepEqual([ok.corps.publie, ok.corps.id], [true, 'A2026_r1']);
  const apres = await brouillonTables(serveur);
  assert.deepEqual([apres.brouillon.base_id, apres.modifie, apres.derniere, apres.suggestion, apres.brouillon.revision], ['A2026_r1', false, 'A2026_r1', 'A2026_r2', 4]);
  assert.deepEqual(apres.versions.map((v) => [v.id, v.utilisations]), [['A2026_r1', { versions_exercice: 0, brouillons: 0 }], ['A2026_r0', { versions_exercice: 2, brouillons: 2 }]]);
  const version = await serveur.editeur('GET', 'tables/version?id=A2026_r1');
  assert.deepEqual([version.corps.tables.id, version.corps.tables.materiaux.revision, version.corps.tables.operations.revision, version.corps.tables.materiaux.classes_iso.length], ['A2026_r1', 'A2026_r1', 'A2026_r1', 7]);
  assert.equal(version.corps.tables.materiaux.materiaux[0].vc_pi_min.carbure_solide, page.brouillon.contenu.materiaux.materiaux[0].vc_pi_min.carbure_solide * 2);
  assert.equal((await serveur.editeur('GET', 'tables/version?id=inconnue')).status, 404);
  // Publier de nouveau : sans changement, refusé ; avec un changement mais sous une révision prise, refusé.
  assert.equal((await serveur.editeur('POST', 'tables/publier', { revision: 4, id: 'A2026_r2' })).status, 400);
  const prise = await publierTables(serveur, carbureDouble(apres.brouillon.contenu), 'A2026_r0');
  assert.deepEqual([prise.status, prise.corps.erreur], [409, 'La révision « A2026_r0 » existe déjà : une version publiée ne se remplace pas.']);
  assert.deepEqual(serveur.journalEnseignant().filter((l) => l.action === 'editeur_tables_publication').map((l) => l.details), ['tables A2026_r1 · depuis A2026_r0']);
  // Publique : GET /api/tables?version=… rend la version complétée ; inconnue → 404.
  const publique = await serveur.appel('GET', '/api/tables?version=A2026_r0');
  assert.deepEqual([publique.status, publique.corps.tables.id, publique.corps.tables.materiaux.classes_iso[0].code, publique.corps.tables.materiaux.materiaux_outil.length], [200, 'A2026_r0', 'P', 3]);
  assert.equal((await serveur.appel('GET', '/api/tables?version=A2099_r0')).status, 404);
});

// --- L'exercice choisit sa version de tables (D62) ; la séance garde les siennes (D47) ---------------------------------

test('exercice et tables (D62) : un exercice est sur la version la plus récente à sa création ; la page dit sa version et la dernière ; passer à une autre version est journalisé, validé contre elle, avec le contrôle optimiste', async () => {
  const serveur = await editeurDeTest();
  const page = await brouillonTables(serveur);
  assert.equal((await publierTables(serveur, carbureDouble(page.brouillon.contenu), 'A2026_r1')).status, 200);
  // Le M10, semé : toujours sur A2026_r0, et la page le signale.
  const m10 = (await serveur.editeur('GET', `exercice?id=${M10}`)).corps;
  assert.deepEqual([m10.exercice.tables_id, m10.tables.id, m10.derniere_tables, m10.tables_versions.map((v) => v.id)], ['A2026_r0', 'A2026_r0', 'A2026_r1', ['A2026_r1', 'A2026_r0']]);
  // Un exercice créé prend la plus récente ; une copie garde celle de sa source.
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id: 'neuf', titre: 'Neuf' })).status, 200);
  assert.equal((await serveur.editeur('GET', 'exercice?id=neuf')).corps.exercice.tables_id, 'A2026_r1');
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id: 'm10-copie', depuis: M10 })).status, 200);
  assert.equal((await serveur.editeur('GET', 'exercice?id=m10-copie')).corps.exercice.tables_id, 'A2026_r0');
  // Passer le M10 à A2026_r1 : révision périmée → 409 ; inconnue → 404 ; puis fait, journalisé, sans erreur.
  assert.equal((await serveur.editeur('POST', 'exercice/tables', { id: M10, revision: 9, tables_id: 'A2026_r1' })).status, 409);
  assert.equal((await serveur.editeur('POST', 'exercice/tables', { id: M10, revision: m10.exercice.revision, tables_id: 'A2099' })).status, 404);
  const passe = await serveur.editeur('POST', 'exercice/tables', { id: M10, revision: m10.exercice.revision, tables_id: 'A2026_r1' });
  assert.deepEqual(passe.corps, { change: true, tables_id: 'A2026_r1', revision: m10.exercice.revision + 1, erreurs: [] });
  const relu = (await serveur.editeur('GET', `exercice?id=${M10}`)).corps;
  assert.deepEqual([relu.exercice.tables_id, relu.tables.id, relu.exercice.revision], ['A2026_r1', 'A2026_r1', m10.exercice.revision + 1]);
  assert.equal(serveur.journalEnseignant().at(-1).details, `${M10} · tables A2026_r0 → A2026_r1`);
  assert.deepEqual((await brouillonTables(serveur)).versions.map((v) => [v.id, v.utilisations.brouillons]), [['A2026_r1', 2], ['A2026_r0', 2]]);
  // Publier le M10 : la version 2 est sur A2026_r1 ; l'export et la liste le disent.
  const publication = await serveur.editeur('POST', 'exercice/publier', { id: M10, revision: relu.exercice.revision });
  assert.equal(publication.status, 200, JSON.stringify(publication.corps));
  const versions = (await serveur.editeur('GET', `exercice?id=${M10}`)).corps.versions;
  assert.deepEqual(versions.map((v) => [v.numero, v.tables_id]), [[2, 'A2026_r1'], [1, 'A2026_r0']]);
  assert.equal(serveur.journalEnseignant().at(-1).details, `${M10} · version 2 · tables A2026_r1`);
});

test('une matière ou un groupe retiré des tables devient une erreur nommée sur les exercices qui l’utilisent (D62) : passer un exercice à cette version le dit, la publication est refusée', async () => {
  const serveur = await editeurDeTest();
  const page = await brouillonTables(serveur);
  // Version r1 : la fonte grise n'existe plus, et l'acier rapide s'appelle HSS.
  const contenu = structuredClone(page.brouillon.contenu);
  contenu.materiaux.materiaux = contenu.materiaux.materiaux.filter((m) => m.materiau !== 'Fonte grise');
  contenu.materiaux.groupes_iso = contenu.materiaux.groupes_iso.filter((g) => g !== 'K - Fonte grise');
  contenu.materiaux.materiaux_outil = contenu.materiaux.materiaux_outil.map((m) => (m.cle === 'acier_rapide' ? { ...m, nom: 'HSS' } : m));
  assert.equal((await publierTables(serveur, contenu, 'A2026_r1')).status, 200);
  const rpm = (await serveur.editeur('GET', `exercice?id=${VC_RPM}`)).corps;
  const passe = await serveur.editeur('POST', 'exercice/tables', { id: VC_RPM, revision: rpm.exercice.revision, tables_id: 'A2026_r1' });
  assert.equal(passe.status, 200);
  const messages = passe.corps.erreurs.map((e) => `${e.champ} : ${e.message}`);
  assert.ok(messages.some((m) => /^materiaux_outil : Matières d'outil permises : « Acier rapide » n'existe pas/.test(m)), messages.join('\n')); // la restriction de l'exercice (D40)
  assert.ok(messages.some((m) => /^outils\.\d+\.materiaux_outil : matériau d'outil inconnu : « Acier rapide » \(les tables offrent HSS, Carbure de tungstène solide, Insert de carbure de tungstène\)/.test(m)));
  assert.ok(messages.some((m) => /^outils\.\d+\.groupes_materiaux_usinables : groupe de matériaux inconnu : « K - Fonte grise »/.test(m)));
  assert.deepEqual((await serveur.editeur('GET', `exercice?id=${VC_RPM}`)).corps.erreurs.length, passe.corps.erreurs.length);
  const refus = await serveur.editeur('POST', 'exercice/publier', { id: VC_RPM, revision: rpm.exercice.revision + 1 });
  assert.equal(refus.status, 400);
  assert.match(refus.corps.erreur, /erreur\(s\) : il ne peut pas être publié/);
  // Retour à A2026_r0 : plus d'erreur.
  assert.deepEqual((await serveur.editeur('POST', 'exercice/tables', { id: VC_RPM, revision: rpm.exercice.revision + 1, tables_id: 'A2026_r0' })).corps.erreurs, []);
});

test('une séance en cours garde ses tables après la publication d’une nouvelle version ; un exercice passé à la nouvelle version change de réponses attendues seulement là où les valeurs ont changé ; l’attestation d’une version 2 inscrit la nouvelle révision (D47, D62)', async () => {
  const graine = 4242;
  const serveur = await editeurDeTest({ graine });
  const camille = await commencer(serveur, CAMILLE);
  const vcAvant = serveur.bonnesReponses(CAMILLE.matricule).vc;
  // Publication des tables r1 (carbure doublé) : la question en attente de Camille et sa réponse attendue ne bougent pas.
  const page = await brouillonTables(serveur);
  assert.equal((await publierTables(serveur, carbureDouble(page.brouillon.contenu), 'A2026_r1')).status, 200);
  const seance = (await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton: camille.jeton })).corps.seance;
  assert.deepEqual(seance.question, camille.seance.question);
  assert.equal(serveur.bonnesReponses(CAMILLE.matricule).vc, vcAvant);
  serveur.avancer(11 * SECONDE);
  const correction = await serveur.appel('POST', '/api/correction', { jeton: camille.jeton, corps: { exercice: M10, saisies: { vc: vcAvant } } });
  assert.deepEqual([correction.corps.correction.reussie, correction.corps.correction.champs[0].attendu], [true, vcAvant]);
  // Le M10 passe à r1 et publie sa version 2 ; Camille reste sur la 1 (tables r0), Alex prend la 2 (tables r1).
  const m10 = (await serveur.editeur('GET', `exercice?id=${M10}`)).corps;
  assert.equal((await serveur.editeur('POST', 'exercice/tables', { id: M10, revision: m10.exercice.revision, tables_id: 'A2026_r1' })).status, 200);
  assert.equal((await serveur.editeur('POST', 'exercice/publier', { id: M10, revision: m10.exercice.revision + 1 })).status, 200);
  assert.deepEqual((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton: camille.jeton })).corps.seance.exercice.version, '1');
  assert.equal((await serveur.appel('GET', `/api/exercice?exercice=${M10}`)).corps.tables.materiaux.revision, 'A2026_r1');
  const jetonAlex = await reussir(serveur, ALEX);
  const attestation = (await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton: jetonAlex })).corps.attestation;
  assert.deepEqual([attestation.revision, attestation.revision_tables], ['2', { materiaux: 'A2026_r1', operations: 'A2026_r1' }]);
  // Les réponses attendues d'Alex : le double de r0 pour le carbure solide, identiques ailleurs.
  const r0 = serveur.catalogue(M10, 1);
  for (const ligne of serveur.journal().filter((l) => l.seance_id === serveur.seance(ALEX.matricule).id)) {
    const question = JSON.parse(ligne.question);
    const attendu = JSON.parse(ligne.resultat).attendu.vc;
    const valeurR0 = r0.materiaux.find((m) => m.groupe === question.material.groupe).vc_pi_min[question.toolMaterial.key];
    assert.equal(Number(attendu), question.toolMaterial.label === CARBURE ? valeurR0 * 2 : valeurR0, `${question.displayId} · ${question.toolMaterial.label}`);
  }

  // Même graine, mêmes tirages : l'aperçu de test-complet sur r0 et sur r1 pose les mêmes questions, et seules les Vc du carbure diffèrent.
  const surR0 = await editeurDeTest({ graine });
  surR0.publierExercice(testComplet);
  const a = (await surR0.editeur('POST', 'apercu', { id: 'test-complet' })).corps.questions;
  const surR1 = await editeurDeTest({ graine });
  assert.equal((await publierTables(surR1, carbureDouble((await brouillonTables(surR1)).brouillon.contenu), 'A2026_r1')).status, 200);
  surR1.publierExercice(testComplet); // le brouillon prend la version la plus récente : A2026_r1
  const b = (await surR1.editeur('POST', 'apercu', { id: 'test-complet' })).corps.questions;
  assert.equal(a.length, 10);
  assert.ok(a.some((q) => q.materiau_outil === CARBURE) && a.some((q) => q.materiau_outil !== CARBURE), 'les deux cas sont tirés');
  for (const [i, q] of a.entries()) {
    assert.deepEqual([b[i].identifiant, b[i].materiau_outil, b[i].materiau], [q.identifiant, q.materiau_outil, q.materiau], `question ${i + 1}`);
    if (q.materiau_outil === CARBURE) assert.equal(Number(b[i].reponses.vc), Number(q.reponses.vc) * 2, `question ${i + 1} : Vc doublée`);
    else assert.deepEqual(b[i].reponses, q.reponses, `question ${i + 1} : inchangée`);
  }
});

// --- Aperçu d'un brouillon de tables (D63) ---------------------------------------------------------------------------------

test('aperçu d’un brouillon de tables : dix questions d’un exercice avec ces tables, telles qu’à l’écran, sans rien enregistrer ; un exercice en erreur avec ces tables → 400 nommé', async () => {
  const serveur = await editeurDeTest();
  const page = await brouillonTables(serveur);
  const contenu = carbureDouble(page.brouillon.contenu);
  const avant = [serveur.journalEnseignant().length, serveur.db.sqlite.prepare('SELECT revision FROM brouillon_tables').get().revision];
  const { status, corps } = await serveur.editeur('POST', 'tables/apercu', { contenu, exercice: M10 });
  assert.equal(status, 200, JSON.stringify(corps));
  assert.equal(corps.questions.length, 10);
  assert.deepEqual(corps.champs_evalues, ['vc']);
  const r0 = serveur.catalogue(M10, 1);
  for (const q of corps.questions) {
    const valeurR0 = r0.materiaux.find((m) => m.groupe === q.materiau.groupe).vc_pi_min[r0.toolMaterialKeys.get(q.materiau_outil)];
    assert.equal(Number(q.reponses.vc), q.materiau_outil === CARBURE ? valeurR0 * 2 : valeurR0, q.identifiant);
  }
  assert.deepEqual([serveur.journalEnseignant().length, serveur.db.sqlite.prepare('SELECT revision FROM brouillon_tables').get().revision], avant); // rien d'enregistré
  // Des tables où l'acier rapide s'appelle HSS : le M10 « Vc et RPM » les refuse, et le message nomme l'erreur.
  const renomme = structuredClone(contenu);
  renomme.materiaux.materiaux_outil[0].nom = 'HSS';
  const refus = await serveur.editeur('POST', 'tables/apercu', { contenu: renomme, exercice: VC_RPM });
  assert.equal(refus.status, 400);
  assert.match(refus.corps.erreur, /a des erreurs avec ces tables : materiaux_outil : Matières d'outil permises : « Acier rapide » n'existe pas/);
  assert.equal((await serveur.editeur('POST', 'tables/apercu', { contenu: { materiaux: {} }, exercice: M10 })).status, 400);
  assert.equal((await serveur.editeur('POST', 'tables/apercu', { contenu, exercice: 'inconnu' })).status, 404);
});

// --- Sauvegarde (D61, D62) ---------------------------------------------------------------------------------------------

test('export et import : les versions des tables, le brouillon des tables et la version de tables de chaque exercice font partie de la sauvegarde ; aller-retour identique ; un export d’avant (sans eux) s’importe encore', async () => {
  const source = await editeurDeTest();
  const page = await brouillonTables(source);
  assert.equal((await publierTables(source, carbureDouble(page.brouillon.contenu), 'A2026_r1')).status, 200);
  const m10 = (await source.editeur('GET', `exercice?id=${M10}`)).corps;
  assert.equal((await source.editeur('POST', 'exercice/tables', { id: M10, revision: m10.exercice.revision, tables_id: 'A2026_r1' })).status, 200);
  // Un brouillon de tables modifié, non publié.
  const apres = await brouillonTables(source);
  const brouillon = structuredClone(apres.brouillon.contenu);
  brouillon.operations.operations[0].avance_po_rev = 0.007;
  assert.equal((await source.editeur('POST', 'tables/enregistrer', { revision: apres.brouillon.revision, contenu: brouillon })).status, 200);
  const { corps: exporte } = await source.editeur('GET', 'export');
  assert.deepEqual(exporte.tables_reference.map((t) => t.id), ['A2026_r0', 'A2026_r1']);
  assert.deepEqual([exporte.brouillon_tables.base_id, exporte.brouillon_tables.contenu.operations.operations[0].avance_po_rev], ['A2026_r1', 0.007]);
  assert.deepEqual(exporte.exercices.map((e) => [e.id, e.tables_id]), [[M10, 'A2026_r1'], [VC_RPM, 'A2026_r0']]);

  const cible = await editeurDeTest();
  const validation = await cible.editeur('POST', 'import/valider', { export: exporte });
  assert.deepEqual(validation.corps.erreurs, []);
  assert.deepEqual([validation.corps.resume.tables_ajoutees, validation.corps.resume.brouillon_tables], [['A2026_r1'], true]);
  assert.equal((await cible.editeur('POST', 'import', { export: exporte, confirmation: IMPORT_WORD })).status, 200);
  const cibleTables = await brouillonTables(cible);
  assert.deepEqual([cibleTables.brouillon.base_id, cibleTables.modifie, cibleTables.brouillon.contenu.operations.operations[0].avance_po_rev, cibleTables.versions.map((v) => v.id)], ['A2026_r1', true, 0.007, ['A2026_r1', 'A2026_r0']]);
  assert.equal((await cible.editeur('GET', `exercice?id=${M10}`)).corps.exercice.tables_id, 'A2026_r1');
  const { corps: reexporte } = await cible.editeur('GET', 'export');
  const sansDates = ({ exporte_le, ...rest }) => rest;
  assert.deepEqual(sansDates(reexporte), sansDates(exporte));
  // Un export d'avant la partie B : sans brouillon_tables ni tables_id → importé, les exercices sur la version la plus récente.
  const ancien = structuredClone(exporte);
  delete ancien.brouillon_tables;
  for (const e of ancien.exercices) delete e.tables_id;
  const autre = await editeurDeTest();
  assert.deepEqual((await autre.editeur('POST', 'import/valider', { export: ancien })).corps.erreurs, []);
  assert.equal((await autre.editeur('POST', 'import', { export: ancien, confirmation: IMPORT_WORD })).status, 200);
  assert.deepEqual((await autre.editeur('GET', 'exercices')).corps.exercices.length, 2);
  assert.equal((await autre.editeur('GET', `exercice?id=${VC_RPM}`)).corps.exercice.tables_id, 'A2026_r1'); // la plus récente, une fois r1 ajoutée
  // Une version de tables inconnue nommée par un exercice : refusé.
  const casse = structuredClone(exporte);
  casse.exercices[0].tables_id = 'A2099_r0';
  assert.match((await autre.editeur('POST', 'import/valider', { export: casse })).corps.erreurs[0], /tables de référence « A2099_r0 » inconnues/);
});

test('migration 0008 : le brouillon des tables est semé depuis A2026_r0 et chaque exercice existant est sur A2026_r0', async () => {
  const serveur = serveurDeTest();
  const draft = serveur.db.sqlite.prepare('SELECT * FROM brouillon_tables').all();
  assert.equal(draft.length, 1);
  const contenu = JSON.parse(draft[0].contenu);
  const semence = serveur.db.sqlite.prepare("SELECT materiaux, operations FROM tables_reference WHERE id = 'A2026_r0'").get();
  assert.deepEqual(contenu, { materiaux: JSON.parse(semence.materiaux), operations: JSON.parse(semence.operations) });
  assert.deepEqual([draft[0].revision, draft[0].base_id, draft[0].modifie_le], [1, 'A2026_r0', '2026-09-24T12:00:00.000Z']);
  assert.deepEqual(serveur.db.sqlite.prepare('SELECT id, tables_id FROM exercices ORDER BY rang').all().map((r) => ({ ...r })), [{ id: M10, tables_id: 'A2026_r0' }, { id: VC_RPM, tables_id: 'A2026_r0' }]);
});
