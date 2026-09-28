// Tests de la cascade des tables et du retour en arrière des versions (chantier E5, jalon E5-2, décision D77), par le
// vrai Worker sur une base SQLite en mémoire : la cascade publie le dernier contenu publié et jamais le brouillon, le
// brouillon suit, les décochés restent intacts, un exercice en erreur est nommé et laissé tel quel, archivés et jamais
// publiés, titres en double, journal, une séance en cours garde sa version ; reprendre une version des tables ou d'un
// exercice, annuler les modifications, images du brouillon des tables, contrôle optimiste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SECONDE, serveurDeTest } from './aide-serveur.js';
import { tablesContent } from '../site/js/tables.js';
import { lireFichier } from './aide.js';

const M10 = 'm10-tournage-vc';
const VC_RPM = 'm10-tournage-vc-rpm';
const CAMILLE = { exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };
const ALEX = { exercice: M10, prenom: 'Alex', nom: 'Roy', matricule: '2498765', nip: '1357' };
const m10 = await lireFichier('exercices/m10-tournage-vc.json');
const materiaux = await lireFichier('data/materiaux.json');

async function editeurDeTest(options = {}) {
  const serveur = serveurDeTest(options);
  const { status, corps } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } });
  assert.equal(status, 200, JSON.stringify(corps));
  const entetes = { cookie: `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
  serveur.editeur = (methode, chemin, corps) => serveur.appel(methode, `/api/prof/editeur/${chemin}`, { corps, entetes });
  return serveur;
}

const brouillonTables = async (serveur) => (await serveur.editeur('GET', 'tables')).corps;
const exercice = async (serveur, id) => (await serveur.editeur('GET', `exercice?id=${id}`)).corps;
const ligne = (serveur, id) => ({ ...serveur.db.sqlite.prepare('SELECT * FROM exercices WHERE id = ?').get(id) });
const versions = (serveur, id) => serveur.db.sqlite.prepare('SELECT numero, contenu, tables_id FROM versions_exercice WHERE exercice_id = ? ORDER BY numero').all(id).map((v) => ({ ...v, contenu: JSON.parse(v.contenu) }));

// Les Vc du carbure solide doublées, celles des inserts + 10 : une différence de valeurs visible pour chaque exercice.
function vcCorrigees(contenu) {
  const next = structuredClone(contenu);
  next.materiaux.materiaux = next.materiaux.materiaux.map((m) => ({ ...m, vc_pi_min: { ...m.vc_pi_min, carbure_solide: m.vc_pi_min.carbure_solide * 2, insert_carbure: m.vc_pi_min.insert_carbure + 10 } }));
  return next;
}

// Enregistre le brouillon des tables, puis le publie sous `id` avec la cascade cochée ; rend la réponse.
async function publierAvecCascade(serveur, contenu, id, cascade) {
  const page = await brouillonTables(serveur);
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: page.brouillon.revision, contenu });
  assert.equal(enregistre.status, 200, JSON.stringify(enregistre.corps));
  return serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id, cascade });
}

async function enregistrerBrouillon(serveur, id, retouche) {
  const page = await exercice(serveur, id);
  const brouillon = structuredClone(page.exercice.brouillon);
  retouche(brouillon);
  const reponse = await serveur.editeur('POST', 'exercice/enregistrer', { id, revision: page.exercice.revision, brouillon });
  assert.equal(reponse.status, 200, JSON.stringify(reponse.corps));
  return reponse.corps.revision;
}

async function commencer(serveur, etudiant) {
  const { status, corps } = await serveur.appel('POST', '/api/creation', { corps: etudiant });
  assert.equal(status, 200, JSON.stringify(corps));
  const question = await serveur.appel('POST', '/api/question', { jeton: corps.jeton, corps: { exercice: etudiant.exercice } });
  return { jeton: corps.jeton, seance: question.corps.seance };
}

// --- La cascade ---------------------------------------------------------------------------------------------------

test('cascade (D77) : proposée pour tous les exercices sur la version remplacée (archivés, jamais publiés, titres en double compris) ; chaque coché publie son DERNIER CONTENU PUBLIÉ avec les nouvelles tables, jamais son brouillon, et son brouillon suit ; un décoché reste intact ; tout est au journal', async () => {
  const serveur = await editeurDeTest();
  // M10 : un brouillon modifié, jamais publié ainsi. VC_RPM : archivé. « brouillon-seul » : jamais publié.
  // « m10-bis » : le même titre publié que M10 (un doublon d'avant D74). « autre » : laissé décoché.
  await enregistrerBrouillon(serveur, M10, (b) => { b.titre = 'M10 — titre du brouillon, pas encore publié'; });
  assert.equal((await serveur.editeur('POST', 'exercice/archiver', { id: VC_RPM, archive: true })).status, 200);
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id: 'brouillon-seul', titre: 'Brouillon seul' })).status, 200);
  serveur.publierExercice({ ...m10, id: 'm10-bis' });
  serveur.publierExercice({ ...m10, id: 'autre', titre: 'Autre exercice' });
  assert.equal(versions(serveur, 'm10-bis')[0].contenu.titre, versions(serveur, M10)[0].contenu.titre);
  const avant = { m10: ligne(serveur, M10), autre: ligne(serveur, 'autre'), m10v1: versions(serveur, M10)[0] };

  // Ce que la cascade proposerait, avant de publier : les cinq exercices, avec ce que ça change pour chacun.
  const page = await brouillonTables(serveur);
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: page.brouillon.revision, contenu: vcCorrigees(page.brouillon.contenu) });
  const propose = (await serveur.editeur('GET', 'tables/cascade')).corps;
  assert.equal(propose.remplacee, 'A2026_r0');
  assert.deepEqual(propose.candidats.map((c) => c.id).sort(), ['autre', 'brouillon-seul', 'm10-bis', M10, VC_RPM]);
  const c = (id) => propose.candidats.find((x) => x.id === id);
  assert.deepEqual([c(M10).publication, c(M10).brouillon.modifie, c(M10).en_erreur, c(M10).titre], [{ depuis: 1, numero: 2 }, true, false, avant.m10v1.contenu.titre]);
  assert.ok(c(M10).lignes.some((l) => /Insert de carbure de tungstène : \d+ → \d+ pi\/min/.test(l)), c(M10).lignes.join('\n'));
  assert.equal(c(VC_RPM).archive_le !== null, true);
  assert.deepEqual([c('brouillon-seul').publication, c('brouillon-seul').brouillon.modifie], [null, true]);
  assert.equal(c('m10-bis').brouillon, null); // son brouillon n'a pas de version de tables : il suivra la plus récente
  // Publier, tous cochés sauf « autre ».
  const publie = await serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id: 'A2026_r1', cascade: [M10, VC_RPM, 'brouillon-seul', 'm10-bis', 'inconnu'] });
  assert.equal(publie.status, 200, JSON.stringify(publie.corps));
  assert.deepEqual(publie.corps.cascade, {
    publies: [{ id: M10, numero: 2 }, { id: VC_RPM, numero: 2 }, { id: 'm10-bis', numero: 2 }],
    brouillons: [M10, VC_RPM, 'brouillon-seul'],
    laisses: [],
    ignores: ['inconnu'],
  });
  // M10 : la version 2 est le contenu de la version 1, sur A2026_r1 — pas le brouillon ; le brouillon garde sa modification et suit.
  const m10v2 = versions(serveur, M10)[1];
  assert.deepEqual([m10v2.numero, m10v2.tables_id], [2, 'A2026_r1']);
  assert.deepEqual(m10v2.contenu, avant.m10v1.contenu);
  const m10apres = ligne(serveur, M10);
  assert.equal(JSON.parse(m10apres.brouillon).titre, 'M10 — titre du brouillon, pas encore publié');
  assert.deepEqual([m10apres.tables_id, m10apres.revision], ['A2026_r1', avant.m10.revision + 1]);
  // VC_RPM, archivé : publié aussi (seules les nouvelles séances le prendraient, et il n'en accepte pas).
  assert.deepEqual(versions(serveur, VC_RPM).map((v) => [v.numero, v.tables_id]), [[1, 'A2026_r0'], [2, 'A2026_r1']]);
  // Jamais publié : seul le brouillon passe. Titre en double : publié, la cascade ne change aucun titre (D74 ne s'applique pas).
  assert.deepEqual([versions(serveur, 'brouillon-seul').length, ligne(serveur, 'brouillon-seul').tables_id], [0, 'A2026_r1']);
  assert.deepEqual(versions(serveur, 'm10-bis').map((v) => v.tables_id), ['A2026_r0', 'A2026_r1']);
  // Décoché : intact, brouillon compris.
  assert.deepEqual(ligne(serveur, 'autre'), avant.autre);
  assert.equal(versions(serveur, 'autre').length, 1);
  // Le journal : chaque publication de la cascade comme une publication ordinaire, avec la mention ; les brouillons qui passent ; le résumé.
  const journal = serveur.journalEnseignant();
  const mention = 'cascade de la publication des tables A2026_r1';
  assert.deepEqual(journal.filter((l) => l.action === 'editeur_publication').map((l) => l.details), [`${M10} · version 2 · tables A2026_r1 · ${mention}`, `${VC_RPM} · version 2 · tables A2026_r1 · ${mention}`, `m10-bis · version 2 · tables A2026_r1 · ${mention}`]);
  assert.deepEqual(journal.filter((l) => l.action === 'editeur_tables_exercice').map((l) => l.details), [`${M10} · tables A2026_r0 → A2026_r1 · ${mention}`, `${VC_RPM} · tables A2026_r0 → A2026_r1 · ${mention}`, `brouillon-seul · tables A2026_r0 → A2026_r1 · ${mention}`]);
  assert.equal(journal.filter((l) => l.action === 'editeur_tables_publication').at(-1).details, 'tables A2026_r1 · depuis A2026_r0 · cascade sur 5 exercice(s) proposé(s) : 3 version(s) publiée(s), 3 brouillon(s) passé(s), 0 en erreur laissé(s) tel(s) quel(s)');
  // La page de M10 : plus d'avis « version plus récente », et le brouillon (modifié) diffère de la version 2 par son titre seulement.
  const page10 = await exercice(serveur, M10);
  assert.deepEqual([page10.exercice.tables_id, page10.derniere_tables, page10.derniere_version.numero], ['A2026_r1', 'A2026_r1', 2]);
});

test('cascade : un exercice en erreur avec les nouvelles tables est nommé, ne se publie pas et reste tel quel, brouillon compris, même coché', async () => {
  const serveur = await editeurDeTest();
  // L'acier rapide renommé « HSS » : l'exercice « Vc et RPM » le nomme (erreur), le M10 « vitesse de coupe » non.
  const page = await brouillonTables(serveur);
  const renomme = vcCorrigees(page.brouillon.contenu);
  renomme.materiaux.materiaux_outil = renomme.materiaux.materiaux_outil.map((m) => (m.cle === 'acier_rapide' ? { ...m, nom: 'HSS' } : m));
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: page.brouillon.revision, contenu: renomme });
  const propose = (await serveur.editeur('GET', 'tables/cascade')).corps.candidats;
  const rpm = propose.find((c) => c.id === VC_RPM);
  assert.equal(rpm.en_erreur, true);
  assert.ok(rpm.erreurs.some((e) => /Acier rapide/.test(e)), rpm.erreurs.join('\n'));
  assert.equal(propose.find((c) => c.id === M10).en_erreur, false);
  const avant = ligne(serveur, VC_RPM);
  const publie = await serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id: 'A2026_r1', cascade: [M10, VC_RPM] });
  assert.equal(publie.status, 200, JSON.stringify(publie.corps));
  assert.deepEqual(publie.corps.cascade.laisses.map((l) => [l.id, l.titre]), [[VC_RPM, versions(serveur, VC_RPM)[0].contenu.titre]]);
  assert.deepEqual(publie.corps.cascade.publies, [{ id: M10, numero: 2 }]);
  assert.equal(versions(serveur, VC_RPM).length, 1);
  assert.deepEqual(ligne(serveur, VC_RPM), avant);
});

test('une séance en cours garde exactement sa version et ses valeurs attendues après une cascade ; une nouvelle séance prend la version de la cascade et la Vc corrigée', async () => {
  const serveur = await editeurDeTest();
  const { jeton } = await commencer(serveur, CAMILLE);
  const avant = { version: serveur.seance().version_id, question: serveur.seance().question_courante, attendues: serveur.bonnesReponses() };
  const page = await brouillonTables(serveur);
  assert.equal((await publierAvecCascade(serveur, vcCorrigees(page.brouillon.contenu), 'A2026_r1', [M10])).status, 200);
  // Camille : même version, même question, mêmes valeurs attendues ; ses bonnes réponses sont justes.
  assert.deepEqual([serveur.seance().version_id, serveur.seance().question_courante, serveur.bonnesReponses()], [avant.version, avant.question, avant.attendues]);
  serveur.avancer(11 * SECONDE);
  const corrigee = await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: avant.attendues } });
  assert.equal(corrigee.corps.correction.reussie, true, JSON.stringify(corrigee.corps.correction));
  // Alex, nouvelle séance : la version 2 de la cascade, sur A2026_r1, avec la Vc corrigée.
  const alex = await commencer(serveur, ALEX);
  assert.equal(alex.seance.exercice.version, '2');
  const servies = (await serveur.appel('GET', `/api/exercice?exercice=${M10}&version=2`)).corps.tables;
  assert.equal(servies.materiaux.revision, 'A2026_r1');
  assert.equal(servies.materiaux.materiaux[0].vc_pi_min.insert_carbure, materiaux.materiaux[0].vc_pi_min.insert_carbure + 10);
  assert.equal((await serveur.appel('GET', `/api/exercice?exercice=${M10}&version=1`)).corps.tables.materiaux.materiaux[0].vc_pi_min.insert_carbure, materiaux.materiaux[0].vc_pi_min.insert_carbure);
});

// --- Reprendre une version, annuler les modifications -----------------------------------------------------------------

test('reprendre une version des tables : ses VALEURS entrent dans le brouillon, qui repart de la dernière ; sans fausses « retouches en attente » ; publiée comme version suivante avec la cascade', async () => {
  const serveur = await editeurDeTest();
  // Une présentation appliquée (légende de P), puis A2026_r1 publiée avec la cascade.
  const presentation = (await serveur.editeur('GET', 'presentation')).corps;
  presentation.presentation.classes_iso[0].legende_image = 'Zone chaude';
  assert.equal((await serveur.editeur('POST', 'presentation/appliquer', { revision: 0, presentation: presentation.presentation })).status, 200);
  const page = await brouillonTables(serveur);
  assert.equal((await publierAvecCascade(serveur, vcCorrigees(page.brouillon.contenu), 'A2026_r1', [M10, VC_RPM])).status, 200);
  // Reprendre A2026_r0.
  const apres = await brouillonTables(serveur);
  const reprise = await serveur.editeur('POST', 'tables/reprendre', { revision: apres.brouillon.revision, id: 'A2026_r0' });
  assert.equal(reprise.status, 200, JSON.stringify(reprise.corps));
  assert.deepEqual([reprise.corps.base_id, reprise.corps.modifie], ['A2026_r1', true]);
  const repris = await brouillonTables(serveur);
  assert.deepEqual([repris.brouillon.base_id, repris.modifie, repris.erreurs, repris.presentation_en_attente.lignes], ['A2026_r1', true, [], []]);
  assert.deepEqual(tablesContent(repris.brouillon.contenu).materiaux.materiaux, materiaux.materiaux);
  assert.equal(repris.brouillon.contenu.materiaux.classes_iso[0].legende_image, 'Zone chaude'); // la présentation en vigueur, pas celle de A2026_r0
  // La cascade propose les exercices sur A2026_r1 ; publiée comme A2026_r2, avec les valeurs de A2026_r0.
  const propose = (await serveur.editeur('GET', 'tables/cascade')).corps;
  assert.deepEqual([propose.remplacee, propose.candidats.map((c) => c.id)], ['A2026_r1', [M10, VC_RPM]]);
  const publie = await serveur.editeur('POST', 'tables/publier', { revision: repris.brouillon.revision, id: 'A2026_r2', cascade: [M10, VC_RPM] });
  assert.equal(publie.status, 200, JSON.stringify(publie.corps));
  assert.deepEqual(publie.corps.cascade.publies, [{ id: M10, numero: 3 }, { id: VC_RPM, numero: 3 }]);
  const r2 = (await serveur.editeur('GET', 'tables/version?id=A2026_r2')).corps.tables;
  assert.deepEqual(r2.materiaux.materiaux, materiaux.materiaux);
  assert.equal(r2.materiaux.classes_iso[0].legende_image, 'Zone chaude');
  assert.equal(serveur.journalEnseignant().filter((l) => l.action === 'editeur_tables_reprise').at(-1).details, 'valeurs de A2026_r0 reprises dans le brouillon · repart de A2026_r1');
  // Inconnue → 404 ; révision périmée → 409.
  assert.equal((await serveur.editeur('POST', 'tables/reprendre', { revision: (await brouillonTables(serveur)).brouillon.revision, id: 'A2099_r0' })).status, 404);
  assert.equal((await serveur.editeur('POST', 'tables/reprendre', { revision: 1, id: 'A2026_r0' })).status, 409);
});

test('reprendre une version d’un exercice : son contenu entre dans le brouillon, qui GARDE sa version de tables ; publiée normalement', async () => {
  const serveur = await editeurDeTest();
  const v1 = versions(serveur, M10)[0];
  // Une version 2 au contenu différent (un titre), puis la cascade vers A2026_r1 (version 3, contenu de la 2).
  const revision = await enregistrerBrouillon(serveur, M10, (b) => { b.titre = 'M10 — deuxième titre'; });
  assert.equal((await serveur.editeur('POST', 'exercice/publier', { id: M10, revision })).status, 200);
  const page = await brouillonTables(serveur);
  assert.equal((await publierAvecCascade(serveur, vcCorrigees(page.brouillon.contenu), 'A2026_r1', [M10])).status, 200);
  assert.deepEqual(versions(serveur, M10).map((v) => [v.numero, v.tables_id, v.contenu.titre]), [[1, 'A2026_r0', v1.contenu.titre], [2, 'A2026_r0', 'M10 — deuxième titre'], [3, 'A2026_r1', 'M10 — deuxième titre']]);
  // Reprendre la version 1 : son contenu, sur A2026_r1 (pas ses anciennes tables).
  const avant = await exercice(serveur, M10);
  const reprise = await serveur.editeur('POST', 'exercice/reprendre', { id: M10, revision: avant.exercice.revision, numero: 1 });
  assert.equal(reprise.status, 200, JSON.stringify(reprise.corps));
  assert.deepEqual([reprise.corps.tables_id, reprise.corps.erreurs], ['A2026_r1', []]);
  const apres = await exercice(serveur, M10);
  assert.deepEqual([apres.exercice.brouillon, apres.exercice.tables_id], [v1.contenu, 'A2026_r1']);
  const publie = await serveur.editeur('POST', 'exercice/publier', { id: M10, revision: apres.exercice.revision });
  assert.equal(publie.status, 200, JSON.stringify(publie.corps));
  assert.deepEqual(versions(serveur, M10).at(-1).tables_id, 'A2026_r1');
  assert.deepEqual(versions(serveur, M10).at(-1).contenu, v1.contenu);
  assert.equal(serveur.journalEnseignant().filter((l) => l.action === 'editeur_reprise').at(-1).details, `${M10} · version 1 reprise dans le brouillon · tables A2026_r1 gardées`);
  assert.equal((await serveur.editeur('POST', 'exercice/reprendre', { id: M10, revision: apres.exercice.revision, numero: 9 })).status, 404);
  assert.equal((await serveur.editeur('POST', 'exercice/reprendre', { id: M10, revision: 1, numero: 1 })).status, 409);
});

test('annuler les modifications : le brouillon d’un exercice revient à sa dernière version publiée (contenu et tables), celui des tables à la dernière version ; sans effet quand il est à jour ; refusé jamais publié ou périmé ; journalisé', async () => {
  const serveur = await editeurDeTest();
  // Un exercice : titre modifié, et passé à des tables plus récentes (non publiées pour lui).
  const page = await brouillonTables(serveur);
  assert.equal((await publierAvecCascade(serveur, vcCorrigees(page.brouillon.contenu), 'A2026_r1', [])).status, 200);
  const revision = await enregistrerBrouillon(serveur, VC_RPM, (b) => { b.titre = 'Brouillon à annuler'; });
  assert.equal((await serveur.editeur('POST', 'exercice/tables', { id: VC_RPM, revision, tables_id: 'A2026_r1' })).status, 200);
  const avant = await exercice(serveur, VC_RPM);
  const annule = await serveur.editeur('POST', 'exercice/annuler', { id: VC_RPM, revision: avant.exercice.revision });
  assert.equal(annule.status, 200, JSON.stringify(annule.corps));
  const apres = await exercice(serveur, VC_RPM);
  assert.deepEqual([apres.exercice.brouillon, apres.exercice.tables_id], [versions(serveur, VC_RPM)[0].contenu, 'A2026_r0']);
  // Déjà à jour (l'écran n'avait que des modifications non enregistrées) : rien n'est écrit ni journalisé.
  const lignesAvant = serveur.journalEnseignant().length;
  const aJour = await serveur.editeur('POST', 'exercice/annuler', { id: VC_RPM, revision: apres.exercice.revision });
  assert.deepEqual([aJour.status, aJour.corps.annule, aJour.corps.revision, serveur.journalEnseignant().length], [200, false, apres.exercice.revision, lignesAvant]);
  assert.equal((await serveur.editeur('POST', 'exercice/annuler', { id: VC_RPM, revision: 1 })).status, 409);
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id: 'jamais', titre: 'Jamais publié' })).status, 200);
  const jamais = await serveur.editeur('POST', 'exercice/annuler', { id: 'jamais', revision: 1 });
  assert.deepEqual([jamais.status, jamais.corps.erreur], [400, "Cet exercice n'a jamais été publié : il n'y a pas de version à laquelle revenir."]);
  // Les tables : une Vc changée, puis annulée ; de nouveau → 400 ; périmée → 409.
  const tables = await brouillonTables(serveur);
  const change = structuredClone(tables.brouillon.contenu);
  change.materiaux.materiaux[0].vc_pi_min.acier_rapide = 1234;
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: tables.brouillon.revision, contenu: change });
  assert.equal((await brouillonTables(serveur)).modifie, true);
  const annuleTables = await serveur.editeur('POST', 'tables/annuler', { revision: enregistre.corps.revision });
  assert.equal(annuleTables.status, 200, JSON.stringify(annuleTables.corps));
  const revenu = await brouillonTables(serveur);
  assert.deepEqual([revenu.modifie, revenu.brouillon.base_id, revenu.brouillon.contenu.materiaux.materiaux[0].vc_pi_min.acier_rapide], [false, 'A2026_r1', materiaux.materiaux[0].vc_pi_min.acier_rapide]);
  const tablesAJour = await serveur.editeur('POST', 'tables/annuler', { revision: revenu.brouillon.revision });
  assert.deepEqual([tablesAJour.status, tablesAJour.corps.annule, (await brouillonTables(serveur)).brouillon.revision], [200, false, revenu.brouillon.revision]);
  assert.equal((await serveur.editeur('POST', 'tables/annuler', { revision: 1 })).status, 409);
  const journal = serveur.journalEnseignant();
  assert.equal(journal.filter((l) => l.action === 'editeur_annulation').at(-1).details, `${VC_RPM} · brouillon ramené à la version 1 (tables A2026_r0)`);
  assert.equal(journal.filter((l) => l.action === 'editeur_tables_annulation').at(-1).details, 'brouillon ramené à A2026_r1');
});

test('images du brouillon des tables : une image nommée par le brouillon (une classe nouvelle, pas encore publiée) compte comme utilisée et ne se supprime pas', async () => {
  const serveur = await editeurDeTest();
  const png = readFileSync(new URL('../site/img/copeaux/copeaux-p-chaleur.png', import.meta.url));
  const neuve = (await serveur.editeur('POST', 'images/televerser', { nom: 'chaleur X.png', usage: 'classe', type: 'image/png', contenu: Buffer.concat([png, Buffer.from([0x2a])]).toString('base64') })).corps.image;
  const page = await brouillonTables(serveur);
  const contenu = structuredClone(page.brouillon.contenu);
  contenu.materiaux.classes_iso.push({ code: 'X', nom: 'Céramiques', couleur: '#112233', couleur_texte: '#ffffff', couleur_ligne: '#ddeeff', image_chaleur: neuve.id, legende_image: '', caracteristiques: [] });
  assert.equal((await serveur.editeur('POST', 'tables/enregistrer', { revision: page.brouillon.revision, contenu })).status, 200);
  const utilisations = (await serveur.editeur('GET', 'images?usage=classe')).corps.images.find((i) => i.id === neuve.id).utilisations;
  assert.deepEqual(utilisations.brouillon_tables, ['brouillon']);
  const refus = await serveur.editeur('POST', 'images/supprimer', { id: neuve.id });
  assert.equal(refus.status, 409);
  assert.match(refus.corps.erreur, /brouillon des tables/);
});

test('contrôle optimiste : une publication des tables sur une révision périmée → 409, et la cascade ne publie rien', async () => {
  const serveur = await editeurDeTest();
  const page = await brouillonTables(serveur);
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: page.brouillon.revision, contenu: vcCorrigees(page.brouillon.contenu) });
  const perimee = await serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision - 1, id: 'A2026_r1', cascade: [M10, VC_RPM] });
  assert.equal(perimee.status, 409);
  assert.deepEqual([versions(serveur, M10).length, versions(serveur, VC_RPM).length, ligne(serveur, M10).tables_id], [1, 1, 'A2026_r0']);
  assert.equal((await serveur.editeur('GET', 'tables/version?id=A2026_r1')).status, 404);
});
