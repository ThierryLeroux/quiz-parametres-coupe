// Tests du code G d'avance sur le serveur (décision D96), par le vrai Worker sur une base SQLite en mémoire : le brouillon
// des tables prérempli des codes, la publication qui les porte et sa cascade, ce que la question et la correction en
// disent (le code, « sans objet », la ligne de programme), l'attestation et le spécimen (« s.o. »), la démo, l'aperçu,
// la règle d'un exercice sans grandeur applicable, et ce qui ne change pas pour une séance épinglée à une version d'avant.
// Partout : aucune valeur masquée, et aucune Vf d'un outil en G95/G99, dans les réponses de l'API, ligne de programme comprise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECONDE, serveurDeTest } from './aide-serveur.js';
import { NOT_APPLICABLE_SHORT, prefillFeedCodes } from '../site/js/code-avance.js';
import { prefillSpeedFactors } from '../site/js/facteur-vitesse.js';
import { lireFichier } from './aide.js';

const M10 = 'm10-tournage-vc';
const CINQ = 'cinq-grandeurs';
const LOCAL = { hote: 'http://localhost:8787', variables: { MODE_TEST: '1' } }; // le mode test (D26) : les réponses attendues accompagnent la question
const CAMILLE = { exercice: CINQ, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };
const materiaux = await lireFichier('data/materiaux.json');
const operations = await lireFichier('data/operations.json');
const FACTEURS = prefillSpeedFactors({ materiaux, operations }); // des tables d'avant D96, comme A2026_r6 en production
const CODES = prefillFeedCodes(FACTEURS); // le brouillon prérempli : G99 au tour, G94 ailleurs
const TOUR = ['mvlnr', 'lame_a_tronconner'];

// Un exercice à cinq grandeurs qui mêle le tour (chariotage, tronçonnage) et la fraiseuse (perçage, contournage).
const EXERCICE = (id, champs = ['vc', 'fz', 'n', 'f', 'vf'], reglages = {}) => ({
  id, titre: `Exercice ${id}`, version: 'r0', champs_evalues: champs, ...reglages,
  outils: [{ id: 'mvlnr', reussites_requises: 1 }, { id: 'lame_a_tronconner', reussites_requises: 1 }, { id: 'foret_fractionnaire', reussites_requises: 1, dimensions: ['Ø 1/4 po', 'Ø 1/2 po'] }, { id: 'fraise_en_bout_helicoidale', reussites_requises: 1 }],
});

async function editeurDeTest(options = {}) {
  const serveur = serveurDeTest(options);
  const { status, corps } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } });
  assert.equal(status, 200, JSON.stringify(corps));
  const entetes = { cookie: `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
  serveur.editeur = (methode, chemin, corps_) => serveur.appel(methode, `/api/prof/editeur/${chemin}`, { corps: corps_, entetes });
  return serveur;
}

// Un serveur où une version de tables qui porte les codes existe (A2026_r1, insérée telle quelle) et où l'exercice mixte est
// publié dessus ; en mode test, pour lire les réponses attendues.
function serveurAvecCodes(exercice = EXERCICE(CINQ), options = LOCAL) {
  const serveur = serveurDeTest(options);
  serveur.publierTables('A2026_r1', CODES);
  serveur.publierExercice(exercice, { tablesId: 'A2026_r1', adopter: true });
  return serveur;
}

async function commencer(serveur, etudiant = CAMILLE) {
  const { status, corps } = await serveur.appel('POST', '/api/creation', { corps: etudiant });
  assert.equal(status, 200, JSON.stringify(corps));
  const question = await serveur.appel('POST', '/api/question', { jeton: corps.jeton, corps: { exercice: etudiant.exercice } });
  assert.equal(question.status, 200, JSON.stringify(question.corps));
  return { jeton: corps.jeton, seance: question.corps.seance };
}

// Les valeurs qui ne doivent jamais partir : celles dont une réponse de l'API contient le texte, entre guillemets.
const fuite = (corps, valeurs) => valeurs.filter((valeur) => JSON.stringify(corps).includes(`"${valeur}"`));
const champ = (vue, nom) => vue.champs.find((c) => c.champ === nom);
const texteDes = (lignes) => lignes.map((ligne) => ligne.map((part) => part.texte).join(''));

// Joue l'exercice entier avec les bonnes réponses — et, pour un outil du tour, une Vf absurde — ; rend ce que chaque outil a
// montré : la question reçue, les réponses attendues (mode test), la correction.
async function jouer(serveur, id, matricule = CAMILLE.matricule) {
  const { jeton, seance } = await commencer(serveur, { ...CAMILLE, exercice: id, matricule });
  const vus = new Map();
  let etat = seance;
  for (let tour = 0; etat.reussite_le === null && tour < 40; tour += 1) {
    serveur.avancer(11 * SECONDE);
    const { question } = etat;
    const attendues = serveur.bonnesReponses(matricule, id);
    const saisies = { ...question.reponses_test, ...(TOUR.includes(question.outil.id) ? { feedRate: 'abc' } : {}) };
    const reponse = await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: id, saisies } });
    assert.equal(reponse.status, 200, JSON.stringify(reponse.corps));
    vus.set(question.outil.id, { question, attendues, correction: reponse.corps.correction, seance: reponse.corps.seance });
    etat = reponse.corps.seance;
  }
  assert.notEqual(etat.reussite_le, null, 'exercice réussi');
  return { jeton, vus };
}

// --- La question et la correction ------------------------------------------------------------------------------------------

test('un outil du tour (G99) : le code dans la question, Vf « sans objet » — ni demandée, ni corrigée, juste quoi qu’on envoie —, et aucune Vf dans aucune réponse, mode test et ligne de programme compris ; un outil de fraiseuse (G94) garde Vf', async () => {
  const serveur = serveurAvecCodes();
  const { jeton, vus } = await jouer(serveur, CINQ);
  assert.deepEqual([...vus.keys()].sort(), ['foret_fractionnaire', 'fraise_en_bout_helicoidale', 'lame_a_tronconner', 'mvlnr']);
  for (const id of TOUR) {
    const { question, attendues, correction, seance } = vus.get(id);
    assert.equal(question.outil.code_avance, 'G99');
    assert.deepEqual(champ(question, 'feedRate'), { champ: 'feedRate', evalue: false, sans_objet: true, texte: '' });
    assert.deepEqual(Object.keys(question.reponses_test), ['vc', 'feedPerTooth', 'rpm', 'feedPerRev']);
    assert.equal(correction.reussie, true, `${id} : réussie malgré « abc » en Vf`);
    assert.deepEqual(champ(correction, 'feedRate'), { champ: 'feedRate', evalue: false, sans_objet: true, ok: true, saisie: '', expression: null, attendu: null, tolerance: null, ecart_pct: null, calcul: null, coherence: null });
    assert.deepEqual(texteDes(correction.programme.lignes), [`G97 S${attendues.rpm} M03`, `G99 G01 ${id === 'mvlnr' ? 'Z…' : 'X…'} F${attendues.feedPerRev}`]);
    assert.equal(correction.programme.note, 'S = N. F = f, en po/tour.');
    assert.deepEqual(fuite({ question, correction, seance }, [attendues.feedRate]), [], `${id} : aucune Vf`);
  }
  for (const id of ['foret_fractionnaire', 'fraise_en_bout_helicoidale']) {
    const { question, attendues, correction } = vus.get(id);
    assert.equal(question.outil.code_avance, 'G94');
    assert.deepEqual(champ(question, 'feedRate'), { champ: 'feedRate', evalue: true, texte: '' });
    assert.equal('feedRate' in question.reponses_test, true);
    assert.equal(champ(correction, 'feedRate').evalue, true);
    assert.deepEqual(texteDes(correction.programme.lignes), [`G97 S${attendues.rpm} M03`, `G94 G01 ${id === 'foret_fractionnaire' ? 'Z…' : 'X… Y…'} F${attendues.feedRate}`]);
    assert.equal(correction.programme.note, 'S = N. F = Vf, en po/min.');
  }
  // Une Vf fausse à la fraiseuse reste une mauvaise réponse.
  const autre = await commencer(serveur, { ...CAMILLE, matricule: '2499999' });
  let etat = autre.seance;
  for (let n = 0; n < 8 && !['foret_fractionnaire', 'fraise_en_bout_helicoidale'].includes(etat.question?.outil.id); n += 1) {
    serveur.avancer(11 * SECONDE);
    etat = (await serveur.appel('POST', '/api/correction', { jeton: autre.jeton, corps: { exercice: CINQ, saisies: etat.question.reponses_test } })).corps.seance;
  }
  serveur.avancer(11 * SECONDE);
  const fausse = (await serveur.appel('POST', '/api/correction', { jeton: autre.jeton, corps: { exercice: CINQ, saisies: { ...etat.question.reponses_test, feedRate: '1' } } })).corps.correction;
  assert.deepEqual([fausse.reussie, champ(fausse, 'feedRate').ok], [false, false]);
});

test('« sans objet » l’emporte sur l’état que l’exercice donne à Vf (donnée, masquée) ; une grandeur masquée s’écrit « — » dans la ligne de programme, et rien ne fuit', async () => {
  const serveur = serveurAvecCodes(EXERCICE(CINQ, ['vc', 'fz'], { champs_masques: ['n', 'f', 'vf'] }));
  serveur.publierExercice(EXERCICE('donnee', ['vc', 'n']), { tablesId: 'A2026_r1', adopter: true });
  const { vus } = await jouer(serveur, CINQ);
  for (const id of TOUR) {
    const { question, attendues, correction, seance } = vus.get(id);
    assert.deepEqual(champ(question, 'feedRate'), { champ: 'feedRate', evalue: false, sans_objet: true, texte: '' });
    assert.deepEqual(champ(question, 'rpm'), { champ: 'rpm', evalue: false, masque: true, texte: '' });
    assert.deepEqual(texteDes(correction.programme.lignes), ['G97 S— M03', `G99 G01 ${id === 'mvlnr' ? 'Z…' : 'X…'} F—`]);
    assert.deepEqual(fuite({ question, correction, seance }, [attendues.rpm, attendues.feedRate]), []);
  }
  const foret = vus.get('foret_fractionnaire');
  assert.deepEqual(texteDes(foret.correction.programme.lignes), ['G97 S— M03', 'G94 G01 Z… F—']);
  assert.deepEqual(fuite({ question: foret.question, correction: foret.correction }, [foret.attendues.rpm, foret.attendues.feedPerRev, foret.attendues.feedRate]), []);
  // Vf donnée par l'exercice (ni évaluée ni masquée) : sans objet au tour, sans valeur ; donnée à la fraiseuse, avec.
  const donnee = await jouer(serveur, 'donnee', '2411111');
  for (const id of TOUR) {
    const { question, attendues, correction, seance } = donnee.vus.get(id);
    assert.deepEqual(champ(question, 'feedRate'), { champ: 'feedRate', evalue: false, sans_objet: true, texte: '' });
    assert.deepEqual(fuite({ question, correction, seance }, [attendues.feedRate]), []);
  }
  assert.deepEqual(champ(donnee.vus.get('foret_fractionnaire').question, 'feedRate'), { champ: 'feedRate', evalue: false, texte: donnee.vus.get('foret_fractionnaire').attendues.feedRate });
});

// --- L'attestation, le spécimen, la démo, l'aperçu --------------------------------------------------------------------------

test('l’attestation inscrit « s.o. » dans la colonne Vf des questions d’un outil du tour, une valeur pour la fraiseuse ; elle se vérifie ; le spécimen de la démo fait de même', async () => {
  const serveur = serveurAvecCodes();
  const { jeton, vus } = await jouer(serveur, CINQ);
  const reponse = (await serveur.appel('GET', `/api/attestation?exercice=${CINQ}`, { jeton })).corps;
  const { attestation } = reponse;
  assert.equal(attestation.questions.length, 4);
  for (const q of attestation.questions) {
    if (TOUR.includes(q.outil_id)) assert.equal(q.reponses.feedRate, NOT_APPLICABLE_SHORT, q.outil_id);
    else assert.equal(q.reponses.feedRate, vus.get(q.outil_id).attendues.feedRate, q.outil_id);
    assert.deepEqual(Object.keys(q.reponses), ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate']);
  }
  assert.deepEqual(Object.keys(attestation).sort(), ['code', 'debut', 'etudiant', 'exercice', 'outils', 'questions', 'questions_reussies', 'reussite_le', 'revision', 'revision_tables']);
  assert.equal((await serveur.appel('POST', '/api/verification', { corps: Object.fromEntries(new URL(reponse.url_verification).searchParams) })).corps.resultat, 'valide');
  const specimen = (await serveur.appel('GET', `/api/demo/specimen?exercice=${CINQ}`)).corps.attestation;
  assert.deepEqual(specimen.questions.map((q) => [TOUR.includes(q.outil_id), q.reponses.feedRate === NOT_APPLICABLE_SHORT]).map(([t, so]) => t === so), [true, true, true, true]);
});

test('la démo (D92) suit les mêmes règles : le code, « sans objet », la correction et sa ligne de programme ; l’aperçu de la Gestion du contenu nomme « sans objet »', async () => {
  const serveur = await editeurDeTest(LOCAL);
  serveur.publierTables('A2026_r1', CODES);
  serveur.publierExercice(EXERCICE(CINQ), { tablesId: 'A2026_r1', adopter: true });
  const demo = await serveur.appel('POST', '/api/demo/creation', { corps: { exercice: CINQ, outil: 'lame_a_tronconner' } });
  assert.equal(demo.status, 200, JSON.stringify(demo.corps));
  const { question } = demo.corps.demo;
  assert.deepEqual([question.outil.id, question.outil.code_avance, champ(question, 'feedRate').sans_objet], ['lame_a_tronconner', 'G99', true]);
  serveur.avancer(11 * SECONDE);
  const attendues = await serveur.bonnesReponsesDemo(demo.corps.jeton);
  const corrigee = (await serveur.appel('POST', '/api/demo/correction', { jeton: demo.corps.jeton, corps: { exercice: CINQ, saisies: { ...question.reponses_test, feedRate: 'n’importe quoi' } } })).corps;
  assert.equal(corrigee.correction.reussie, true);
  assert.deepEqual(texteDes(corrigee.correction.programme.lignes), [`G97 S${attendues.rpm} M03`, `G99 G01 X… F${attendues.feedPerRev}`]);
  assert.deepEqual(fuite(corrigee, [attendues.feedRate]), []);
  // L'aperçu : « sans_objet » pour les outils du tour, leur Vf hors des réponses.
  const apercu = (await serveur.editeur('POST', 'apercu', { id: CINQ, version: 1 })).corps.questions;
  assert.equal(apercu.length, 10);
  for (const q of apercu) {
    if (TOUR.includes(q.outil_id)) assert.deepEqual([q.sans_objet, 'feedRate' in q.reponses], [['feedRate'], false], q.outil_id);
    else assert.deepEqual(['sans_objet' in q, 'feedRate' in q.reponses], [false, true], q.outil_id);
  }
});

// --- Les tables : le brouillon prérempli, la publication, la cascade --------------------------------------------------------

test('le brouillon des tables se lit prérempli des codes (G99 au tour, G94 ailleurs) ; une version publiée n’en reçoit aucun ; la publication les porte, les différences les disent, et /api/tables les sert', async () => {
  const serveur = await editeurDeTest();
  const page = (await serveur.editeur('GET', 'tables')).corps;
  assert.deepEqual(page.brouillon.contenu.operations.operations.map((op) => op.code_avance), CODES.operations.operations.map((op) => op.code_avance));
  assert.deepEqual(page.erreurs, []);
  // En base, le brouillon semé n'a pas changé ; la version A2026_r0 n'a aucun code, ni pour la Gestion du contenu ni pour l'étudiant.
  assert.equal(JSON.parse(serveur.db.sqlite.prepare('SELECT contenu FROM brouillon_tables').get().contenu).operations.operations.some((op) => 'code_avance' in op), false);
  assert.equal((await serveur.editeur('GET', 'tables/version?id=A2026_r0')).corps.tables.operations.operations.some((op) => 'code_avance' in op), false);
  assert.equal((await serveur.appel('GET', '/api/tables?version=A2026_r0')).corps.tables.operations.operations.some((op) => 'code_avance' in op), false);
  // « Annuler » : le brouillon ne diffère de A2026_r0 que par les préremplissages — rien à annuler.
  assert.deepEqual((await serveur.editeur('POST', 'tables/annuler', { revision: 1 })).corps.annule, false);
  // Un code illisible, ou qui manque : une erreur, dite à l'enregistrement, et la publication est refusée.
  const fautif = structuredClone(page.brouillon.contenu);
  fautif.operations.operations[4].code_avance = 'G96';
  fautif.operations.operations[5].code_avance = null;
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: 1, contenu: fautif });
  assert.deepEqual(enregistre.corps.erreurs.map((e) => e.message), [
    'operations[4] « Perçage » : « code_avance » doit être G94, G95, G98, G99 (G95 et G99 : avance par tour)',
    'operations[5] « Chanfreinage » : « code_avance » doit être G94, G95, G98, G99 (G95 et G99 : avance par tour)',
  ]);
  assert.equal((await serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id: 'A2026_r1' })).status, 400);
  // Publié tel que lu : la version porte les codes, et les différences les disent, opération par opération.
  const bon = await serveur.editeur('POST', 'tables/enregistrer', { revision: enregistre.corps.revision, contenu: page.brouillon.contenu });
  const publie = await serveur.editeur('POST', 'tables/publier', { revision: bon.corps.revision, id: 'A2026_r1', cascade: [] });
  assert.equal(publie.status, 200, JSON.stringify(publie.corps));
  const r1 = (await serveur.appel('GET', '/api/tables?version=A2026_r1')).corps.tables;
  assert.deepEqual(r1.operations.operations.map((op) => op.code_avance), CODES.operations.operations.map((op) => op.code_avance));
  // Le brouillon repart de A2026_r1, à jour : « Annuler » n'a rien à annuler, et aucun préremplissage ne le rend « modifié ».
  const apres = (await serveur.editeur('GET', 'tables')).corps;
  assert.deepEqual([apres.modifie, apres.brouillon.base_id], [false, 'A2026_r1']);
  // Reprendre A2026_r0 : les valeurs d'avant, préremplies des facteurs et des codes.
  const reprise = await serveur.editeur('POST', 'tables/reprendre', { revision: apres.brouillon.revision, id: 'A2026_r0' });
  assert.equal(reprise.status, 200, JSON.stringify(reprise.corps));
  assert.deepEqual((await serveur.editeur('GET', 'tables')).corps.brouillon.contenu.operations.operations.map((op) => op.code_avance), CODES.operations.operations.map((op) => op.code_avance));
});

test('un exercice dont la seule grandeur évaluée est Vf, avec un outil du tour : refusé à l’enregistrement (le message nomme les outils) et à la publication ; la cascade le nomme et le laisse tel quel', async () => {
  const serveur = await editeurDeTest();
  // Sur A2026_r0 (sans code), « vf » seule est permise : publié, avec deux outils du tour et un foret.
  serveur.publierExercice(EXERCICE('vf-seule', ['vf']));
  const page = (await serveur.editeur('GET', 'exercice?id=vf-seule')).corps;
  assert.deepEqual(page.erreurs, []);
  // Les tables qui portent les codes : la cascade le proposerait en erreur, et ne le publie pas, même coché.
  const tables = (await serveur.editeur('GET', 'tables')).corps;
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: tables.brouillon.revision, contenu: tables.brouillon.contenu });
  const propose = (await serveur.editeur('GET', 'tables/cascade')).corps.candidats.find((c) => c.id === 'vf-seule');
  const message = "La seule grandeur évaluée, la vitesse d'avance, est sans objet pour MVLNR (mvlnr), Lame à tronçonner (lame_a_tronconner) : leur opération est en avance par tour (G95 ou G99). Évalue une autre grandeur, ou retire ces outils.";
  assert.deepEqual([propose.en_erreur, propose.par_defaut, propose.erreurs], [true, false, [`champs_evalues : ${message}`]]);
  const publie = await serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id: 'A2026_r1', cascade: ['vf-seule', M10] });
  assert.equal(publie.status, 200, JSON.stringify(publie.corps));
  assert.deepEqual([publie.corps.cascade.publies.map((p) => p.id), publie.corps.cascade.laisses.map((l) => l.id)], [[M10], ['vf-seule']]);
  const versions = serveur.db.sqlite.prepare('SELECT numero, tables_id FROM versions_exercice WHERE exercice_id = ? ORDER BY numero').all('vf-seule').map((row) => ({ ...row }));
  assert.deepEqual(versions, [{ numero: 1, tables_id: 'A2026_r0' }]);
  assert.equal(serveur.db.sqlite.prepare('SELECT tables_id FROM exercices WHERE id = ?').get('vf-seule').tables_id, null); // tel que publierExercice l'a semé (null : la plus récente) : rien n'a été écrit
  // Passé à la main aux nouvelles tables : l'erreur sur « champs_evalues », l'enregistrement la rend, la publication refuse.
  const relu = (await serveur.editeur('GET', 'exercice?id=vf-seule')).corps;
  const passe = await serveur.editeur('POST', 'exercice/tables', { id: 'vf-seule', revision: relu.exercice.revision, tables_id: 'A2026_r1' });
  assert.deepEqual([passe.status, passe.corps.erreurs], [200, [{ champ: 'champs_evalues', message }]]);
  assert.equal((await serveur.editeur('POST', 'exercice/publier', { id: 'vf-seule', revision: passe.corps.revision })).status, 400);
  // Corrigé — N évaluée aussi — : plus d'erreur, et publiable.
  const corrige = await serveur.editeur('POST', 'exercice/enregistrer', { id: 'vf-seule', revision: passe.corps.revision, brouillon: { ...relu.exercice.brouillon, champs_evalues: ['n', 'vf'] } });
  assert.deepEqual([corrige.status, corrige.corps.erreurs], [200, []]);
  assert.equal((await serveur.editeur('POST', 'exercice/publier', { id: 'vf-seule', revision: corrige.corps.revision })).status, 200);
});

test('rien ne change pour ce qui existe : une séance commencée avant la publication des tables qui portent les codes garde sa question — Vf demandée, aucun code —, et sa correction ; une nouvelle séance prend la version de la cascade', async () => {
  const serveur = await editeurDeTest(LOCAL);
  serveur.publierExercice(EXERCICE(CINQ)); // sur A2026_r0 : ni facteurs, ni codes
  const avant = await commencer(serveur, { ...CAMILLE, exercice: CINQ });
  assert.equal('code_avance' in avant.seance.question.outil, false);
  assert.deepEqual(champ(avant.seance.question, 'feedRate'), { champ: 'feedRate', evalue: true, texte: '' });
  assert.equal('feedRate' in avant.seance.question.reponses_test, true);
  const tables = (await serveur.editeur('GET', 'tables')).corps;
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: tables.brouillon.revision, contenu: tables.brouillon.contenu });
  assert.equal((await serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id: 'A2026_r1', cascade: [CINQ] })).status, 200);
  // La séance en cours : même version, même question, Vf toujours demandée et corrigée, pas de ligne de programme.
  const relue = (await serveur.appel('GET', `/api/seance?exercice=${CINQ}`, { jeton: avant.jeton })).corps.seance;
  assert.deepEqual([relue.exercice.version, relue.question], ['1', avant.seance.question]);
  serveur.avancer(11 * SECONDE);
  const corrigee = (await serveur.appel('POST', '/api/correction', { jeton: avant.jeton, corps: { exercice: CINQ, saisies: { ...relue.question.reponses_test, feedRate: '1' } } })).corps;
  assert.deepEqual([corrigee.correction.reussie, champ(corrigee.correction, 'feedRate').ok, 'programme' in corrigee.correction], [false, false, false]);
  assert.equal('code_avance' in corrigee.seance.question.outil, false);
  // Une nouvelle séance : la version 2, sur les tables qui portent les codes.
  const apres = await commencer(serveur, { ...CAMILLE, exercice: CINQ, matricule: '2499999' });
  assert.equal(apres.seance.exercice.version, '2');
  assert.ok(['G94', 'G99'].includes(apres.seance.question.outil.code_avance));
});
