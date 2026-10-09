// Tests du code G d'avance sur le serveur (décisions D96, D97 : le code est celui de la copie, jamais des tables), par le vrai
// Worker sur une base SQLite en mémoire : ce que la question et la correction disent d'une copie en G99, en G94 et sans
// code dans le même exercice (le code, « sans objet », la ligne de programme), l'attestation et le spécimen (« s.o. »),
// la démo, l'aperçu, la règle d'un exercice sans grandeur applicable, la banque et la copie dans la Gestion du contenu,
// l'export et l'import, le brouillon des tables débarrassé d'un code resté de D96, et ce qui ne change pas pour une
// séance épinglée. Partout : aucune valeur masquée, et aucune Vf d'une copie en G95/G99, dans les réponses de l'API,
// ligne de programme comprise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECONDE, serveurDeTest } from './aide-serveur.js';
import { NOT_APPLICABLE_SHORT, withFeedCode } from '../site/js/code-avance.js';
import { prefillSpeedFactors } from '../site/js/facteur-vitesse.js';
import { IMPORT_WORD } from '../worker/editeur.js';
import { lireFichier } from './aide.js';

const CINQ = 'cinq-grandeurs';
const LOCAL = { hote: 'http://localhost:8787', variables: { MODE_TEST: '1' } }; // le mode test (D26) : les réponses attendues accompagnent la question
const CAMILLE = { exercice: CINQ, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };
const TOUR = ['mvlnr', 'lame_a_tronconner']; // les copies en G99
const SANS_CODE = ['fraise_en_bout_helicoidale']; // la copie sans code : l'outil d'avant D96

// Un exercice à cinq grandeurs qui mêle le tour et la fraiseuse ; le code de chaque entrée du format fichier devient celui
// de la copie (❓ D97, point 5) : MVLNR et la lame en G99, le foret en G94, la fraise sans code.
const EXERCICE = (id, champs = ['vc', 'fz', 'n', 'f', 'vf'], reglages = {}) => ({
  id, titre: `Exercice ${id}`, version: 'r0', champs_evalues: champs, ...reglages,
  outils: [
    { id: 'mvlnr', reussites_requises: 1, code_avance: 'G99' }, { id: 'lame_a_tronconner', reussites_requises: 1, code_avance: 'G99' },
    { id: 'foret_fractionnaire', reussites_requises: 1, dimensions: ['Ø 1/4 po', 'Ø 1/2 po'], code_avance: 'G94' }, { id: 'fraise_en_bout_helicoidale', reussites_requises: 1 },
  ],
});

async function editeurDeTest(options = {}) {
  const serveur = serveurDeTest(options);
  const { status, corps } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } });
  assert.equal(status, 200, JSON.stringify(corps));
  const entetes = { cookie: `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
  serveur.editeur = (methode, chemin, corps_) => serveur.appel(methode, `/api/prof/editeur/${chemin}`, { corps: corps_, entetes });
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

// Joue l'exercice entier avec les bonnes réponses — et, pour une copie en G99, une Vf absurde — ; rend ce que chaque outil a
// montré : la question reçue, les réponses attendues, la correction, la séance qui suit.
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

test('une copie en G99 : le code dans la question, Vf « sans objet » — ni demandée, ni corrigée, juste quoi qu’on envoie —, aucune Vf dans aucune réponse, mode test et ligne de programme compris ; une copie en G94 garde Vf ; une copie sans code, dans le même exercice, est l’outil d’avant D96', async () => {
  const serveur = serveurDeTest(LOCAL);
  serveur.publierExercice(EXERCICE(CINQ));
  const { vus } = await jouer(serveur, CINQ);
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
  const foret = vus.get('foret_fractionnaire');
  assert.equal(foret.question.outil.code_avance, 'G94');
  assert.deepEqual(champ(foret.question, 'feedRate'), { champ: 'feedRate', evalue: true, texte: '' });
  assert.deepEqual(texteDes(foret.correction.programme.lignes), [`G97 S${foret.attendues.rpm} M03`, `G94 G01 Z… F${foret.attendues.feedRate}`]);
  assert.equal(foret.correction.programme.note, 'S = N. F = Vf, en po/min.');
  // La fraise, sans code : ni code, ni ligne de programme, Vf demandée et corrigée — rien ne change pour elle.
  const fraise = vus.get('fraise_en_bout_helicoidale');
  assert.equal('code_avance' in fraise.question.outil, false);
  assert.deepEqual(champ(fraise.question, 'feedRate'), { champ: 'feedRate', evalue: true, texte: '' });
  assert.equal('programme' in fraise.correction, false);
  assert.equal(champ(fraise.correction, 'feedRate').evalue, true);
  // Une Vf fausse à la fraiseuse (G94) ou sans code reste une mauvaise réponse.
  const autre = await commencer(serveur, { ...CAMILLE, matricule: '2499999' });
  let etat = autre.seance;
  for (let n = 0; n < 8 && TOUR.includes(etat.question?.outil.id); n += 1) {
    serveur.avancer(11 * SECONDE);
    etat = (await serveur.appel('POST', '/api/correction', { jeton: autre.jeton, corps: { exercice: CINQ, saisies: etat.question.reponses_test } })).corps.seance;
  }
  serveur.avancer(11 * SECONDE);
  const fausse = (await serveur.appel('POST', '/api/correction', { jeton: autre.jeton, corps: { exercice: CINQ, saisies: { ...etat.question.reponses_test, feedRate: '1' } } })).corps.correction;
  assert.deepEqual([fausse.reussie, champ(fausse, 'feedRate').ok], [false, false]);
});

test('« sans objet » l’emporte sur l’état que l’exercice donne à Vf (donnée, masquée) ; une grandeur masquée s’écrit « — » dans la ligne de programme, et rien ne fuit', async () => {
  const serveur = serveurDeTest(LOCAL);
  serveur.publierExercice(EXERCICE(CINQ, ['vc', 'fz'], { champs_masques: ['n', 'f', 'vf'] }));
  serveur.publierExercice(EXERCICE('donnee', ['vc', 'n']));
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
  const donnee = await jouer(serveur, 'donnee', '2411111');
  for (const id of TOUR) {
    const { question, attendues, correction, seance } = donnee.vus.get(id);
    assert.deepEqual(champ(question, 'feedRate'), { champ: 'feedRate', evalue: false, sans_objet: true, texte: '' });
    assert.deepEqual(fuite({ question, correction, seance }, [attendues.feedRate]), []);
  }
  assert.deepEqual(champ(donnee.vus.get('foret_fractionnaire').question, 'feedRate'), { champ: 'feedRate', evalue: false, texte: donnee.vus.get('foret_fractionnaire').attendues.feedRate });
});

// --- L'attestation, le spécimen, la démo, l'aperçu --------------------------------------------------------------------------

test('l’attestation inscrit « s.o. » dans la colonne Vf des questions d’une copie en G99, une valeur pour les autres ; elle se vérifie ; le spécimen de la démo fait de même', async () => {
  const serveur = serveurDeTest(LOCAL);
  serveur.publierExercice(EXERCICE(CINQ));
  const { jeton, vus } = await jouer(serveur, CINQ);
  const reponse = (await serveur.appel('GET', `/api/attestation?exercice=${CINQ}`, { jeton })).corps;
  const { attestation } = reponse;
  assert.equal(attestation.questions.length, 4);
  for (const q of attestation.questions) {
    if (TOUR.includes(q.outil_id)) assert.equal(q.reponses.feedRate, NOT_APPLICABLE_SHORT, q.outil_id);
    else assert.equal(q.reponses.feedRate, vus.get(q.outil_id).attendues.feedRate, q.outil_id);
  }
  assert.deepEqual(Object.keys(attestation).sort(), ['code', 'debut', 'etudiant', 'exercice', 'outils', 'questions', 'questions_reussies', 'reussite_le', 'revision', 'revision_tables']);
  assert.equal((await serveur.appel('POST', '/api/verification', { corps: Object.fromEntries(new URL(reponse.url_verification).searchParams) })).corps.resultat, 'valide');
  const specimen = (await serveur.appel('GET', `/api/demo/specimen?exercice=${CINQ}`)).corps.attestation;
  assert.deepEqual(specimen.questions.map((q) => TOUR.includes(q.outil_id) === (q.reponses.feedRate === NOT_APPLICABLE_SHORT)), [true, true, true, true]);
});

test('la démo (D92) suit les mêmes règles : le code, « sans objet », la correction et sa ligne de programme ; l’aperçu de la Gestion du contenu nomme « sans objet »', async () => {
  const serveur = await editeurDeTest(LOCAL);
  serveur.publierExercice(EXERCICE(CINQ));
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
  const apercu = (await serveur.editeur('POST', 'apercu', { id: CINQ, version: 1 })).corps.questions;
  assert.equal(apercu.length, 10);
  for (const q of apercu) {
    if (TOUR.includes(q.outil_id)) assert.deepEqual([q.sans_objet, 'feedRate' in q.reponses], [['feedRate'], false], q.outil_id);
    else assert.deepEqual(['sans_objet' in q, 'feedRate' in q.reponses], [false, true], q.outil_id);
  }
});

// --- La Gestion du contenu : la banque, la copie, la validation, l'export ---------------------------------------------------

test('la banque donne la valeur de départ : un outil enregistré avec un code le garde (différence « aucune → G99 », historique), un code illisible est une erreur nommée ; un brouillon dont la seule grandeur évaluée est Vf avec une copie en G99 est refusé, et ne se publie pas', async () => {
  const serveur = await editeurDeTest();
  const outil = (await serveur.editeur('GET', 'banque/outil?id=mvlnr')).corps.outil;
  const enregistre = await serveur.editeur('POST', 'banque/enregistrer', { id: 'mvlnr', revision: outil.revision, outil: withFeedCode(outil.outil, 'G99') });
  assert.deepEqual([enregistre.status, enregistre.corps.erreurs, enregistre.corps.lignes], [200, [], ['Avance programmée : « aucune » → « G99 »']]);
  const relu = (await serveur.editeur('GET', 'banque/outil?id=mvlnr')).corps;
  assert.equal(relu.outil.outil.code_avance, 'G99');
  assert.deepEqual(relu.historique.map((h) => h.lignes), [['Avance programmée : « G99 » → « aucune »']]); // rétablir le contenu d'avant retirerait le code
  const fautif = await serveur.editeur('POST', 'banque/enregistrer', { id: 'mvlnr', revision: enregistre.corps.revision, outil: { ...outil.outil, code_avance: 'G96' } });
  assert.equal(fautif.status, 200);
  assert.equal(fautif.corps.erreurs.length, 1);
  assert.match(fautif.corps.erreurs[0].message, /« code_avance » doit être G94, G95, G98, G99, ou absent \(aucune avance programmée\)$/); // la banque nomme l'outil devant, comme pour ses autres champs
  // Un outil invalide s'enregistre avec ses erreurs (D48) : remis en G99 pour la suite.
  assert.deepEqual((await serveur.editeur('POST', 'banque/enregistrer', { id: 'mvlnr', revision: fautif.corps.revision, outil: withFeedCode(outil.outil, 'G99') })).corps.erreurs, []);
  // L'exercice : un brouillon fait de copies de la banque (la Gestion du contenu les compose dans le navigateur, copyOfTool).
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id: 'vf-seule', titre: 'Vf seule' })).status, 200);
  const page = (await serveur.editeur('GET', 'exercice?id=vf-seule')).corps;
  const copie = (id, code) => withFeedCode({ ...(serveur.db.sqlite.prepare('SELECT outil FROM banque_outils WHERE id = ?').get(id) && JSON.parse(serveur.db.sqlite.prepare('SELECT outil FROM banque_outils WHERE id = ?').get(id).outil)), reussites_requises: 1, origine: id }, code);
  const brouillon = { ...page.exercice.brouillon, champs_evalues: ['vf'], outils: [copie('mvlnr', 'G99'), copie('foret_fractionnaire', '')] };
  const message = "La seule grandeur évaluée, la vitesse d'avance, est sans objet pour MVLNR (mvlnr) : leur avance programmée est par tour (G95 ou G99). Évalue une autre grandeur, ou retire ces outils.";
  const refus = await serveur.editeur('POST', 'exercice/enregistrer', { id: 'vf-seule', revision: page.exercice.revision, brouillon });
  assert.deepEqual([refus.status, refus.corps.erreurs], [200, [{ champ: 'champs_evalues', message }]]);
  assert.equal((await serveur.editeur('POST', 'exercice/publier', { id: 'vf-seule', revision: refus.corps.revision })).status, 400);
  // Le foret en G94 et MVLNR en G99 avec N évaluée aussi : publiable ; la version porte les codes ; les différences les disent.
  const corrige = await serveur.editeur('POST', 'exercice/enregistrer', { id: 'vf-seule', revision: refus.corps.revision, brouillon: { ...brouillon, champs_evalues: ['n', 'vf'], outils: [copie('mvlnr', 'G99'), copie('foret_fractionnaire', 'G94')] } });
  assert.deepEqual([corrige.status, corrige.corps.erreurs], [200, []]);
  assert.equal((await serveur.editeur('POST', 'exercice/publier', { id: 'vf-seule', revision: corrige.corps.revision })).status, 200);
  const version = JSON.parse(serveur.db.sqlite.prepare('SELECT contenu FROM versions_exercice WHERE exercice_id = ?').get('vf-seule').contenu);
  assert.deepEqual(version.outils.map((c) => c.code_avance), ['G99', 'G94']);
  // L'export porte le code de la banque et de la copie ; un aller-retour par l'import ne change rien.
  const exporte = (await serveur.editeur('GET', 'export')).corps;
  assert.equal(exporte.banque.find((b) => b.id === 'mvlnr').outil.code_avance, 'G99');
  assert.deepEqual(exporte.exercices.find((e) => e.id === 'vf-seule').brouillon.outils.map((c) => c.code_avance), ['G99', 'G94']);
  const cible = await editeurDeTest();
  assert.deepEqual((await cible.editeur('POST', 'import/valider', { export: exporte })).corps.erreurs, []);
  assert.equal((await cible.editeur('POST', 'import', { export: exporte, confirmation: IMPORT_WORD })).status, 200);
  assert.equal((await cible.editeur('GET', 'banque/outil?id=mvlnr')).corps.outil.outil.code_avance, 'G99');
  assert.deepEqual((await cible.editeur('GET', 'exercice?id=vf-seule')).corps.exercice.brouillon.outils.map((c) => c.code_avance), ['G99', 'G94']);
});

// --- Les tables n'en portent plus (D97) -------------------------------------------------------------------------------------

test('un code resté dans le brouillon des tables enregistré sous D96 est ignoré à la lecture et retiré au prochain enregistrement ; le brouillon se lit identique à sa version de départ : « Annuler » n’a rien à annuler ; aucune version ne porte de code', async () => {
  const serveur = await editeurDeTest();
  // Les tables qui portent les facteurs de vitesse, publiées (A2026_r1, comme A2026_r6 en production) ; le brouillon en repart.
  const page = (await serveur.editeur('GET', 'tables')).corps;
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: page.brouillon.revision, contenu: page.brouillon.contenu });
  assert.equal((await serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id: 'A2026_r1', cascade: [] })).status, 200);
  // Le brouillon enregistré sous D96 : chaque opération porte un code (posé en base, comme l'aurait fait la Gestion du contenu).
  const avecCodes = structuredClone(page.brouillon.contenu);
  for (const op of avecCodes.operations.operations) op.code_avance = op.machine === 'Tour' ? 'G99' : 'G94';
  serveur.db.sqlite.prepare('UPDATE brouillon_tables SET contenu = ?').run(JSON.stringify(avecCodes));
  const relu = (await serveur.editeur('GET', 'tables')).corps;
  assert.equal(relu.brouillon.contenu.operations.operations.some((op) => 'code_avance' in op), false, 'ignoré à la lecture');
  assert.deepEqual([relu.modifie, relu.erreurs, relu.brouillon.base_id], [false, [], 'A2026_r1'], 'identique à sa version de départ');
  assert.deepEqual((await serveur.editeur('POST', 'tables/annuler', { revision: relu.brouillon.revision })).corps.annule, false, 'rien à annuler');
  // Enregistré de nouveau, même avec des codes envoyés par un onglet resté ouvert : retirés.
  const sauve = await serveur.editeur('POST', 'tables/enregistrer', { revision: relu.brouillon.revision, contenu: avecCodes });
  assert.deepEqual([sauve.status, sauve.corps.erreurs], [200, []]);
  assert.equal(JSON.parse(serveur.db.sqlite.prepare('SELECT contenu FROM brouillon_tables').get().contenu).operations.operations.some((op) => 'code_avance' in op), false, 'retiré à l’enregistrement');
  // Les différences d'une publication n'en parlent pas, et aucune version publiée n'en porte : ni pour la Gestion du contenu, ni pour l'étudiant.
  assert.deepEqual((await serveur.editeur('GET', 'tables/cascade')).corps.candidats.flatMap((c) => c.lignes).filter((l) => /code G|sans objet/.test(l)), []);
  for (const id of ['A2026_r0', 'A2026_r1']) {
    assert.equal((await serveur.editeur('GET', `tables/version?id=${id}`)).corps.tables.operations.operations.some((op) => 'code_avance' in op), false);
    assert.equal((await serveur.appel('GET', `/api/tables?version=${id}`)).corps.tables.operations.operations.some((op) => 'code_avance' in op), false);
  }
});

test('rien ne change pour ce qui existe : une séance commencée sur une version dont les copies n’ont pas de code garde sa question — Vf demandée, aucun code — et sa correction après la publication d’une version 2 avec des codes ; une nouvelle séance prend la version 2', async () => {
  const serveur = serveurDeTest(LOCAL);
  const sansCode = { ...EXERCICE(CINQ), outils: EXERCICE(CINQ).outils.map(({ code_avance: _c, ...entry }) => entry) };
  serveur.publierExercice(sansCode);
  const avant = await commencer(serveur, { ...CAMILLE, exercice: CINQ });
  assert.equal('code_avance' in avant.seance.question.outil, false);
  assert.deepEqual(champ(avant.seance.question, 'feedRate'), { champ: 'feedRate', evalue: true, texte: '' });
  serveur.publierExercice(EXERCICE(CINQ)); // la version 2 : les mêmes outils, avec leurs codes
  const relue = (await serveur.appel('GET', `/api/seance?exercice=${CINQ}`, { jeton: avant.jeton })).corps.seance;
  assert.deepEqual([relue.exercice.version, relue.question], ['1', avant.seance.question]);
  serveur.avancer(11 * SECONDE);
  const corrigee = (await serveur.appel('POST', '/api/correction', { jeton: avant.jeton, corps: { exercice: CINQ, saisies: { ...relue.question.reponses_test, feedRate: '1' } } })).corps;
  assert.deepEqual([corrigee.correction.reussie, champ(corrigee.correction, 'feedRate').ok, 'programme' in corrigee.correction], [false, false, false]);
  assert.equal('code_avance' in corrigee.seance.question.outil, false);
  const apres = await commencer(serveur, { ...CAMILLE, exercice: CINQ, matricule: '2499999' });
  assert.equal(apres.seance.exercice.version, '2');
  const code = apres.seance.question.outil.code_avance;
  assert.ok(SANS_CODE.includes(apres.seance.question.outil.id) ? code === undefined : ['G94', 'G99'].includes(code));
});
