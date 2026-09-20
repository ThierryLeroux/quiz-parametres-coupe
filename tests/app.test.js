// Tests de site/js/app.js : choix de l'exercice et cycle complet d'une séance, sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerFields, loadApp, nextQuestion, requestedExercise, restoreSession, sessionStep, startSession, submitAnswers, updateAnswers } from '../site/js/app.js';
import { computeParameters } from '../site/js/calcul.js';
import { formatParameters } from '../site/js/format.js';
import { validateExercise } from '../site/js/exercice.js';
import { SESSION_KEY, loadSession, saveSession } from '../site/js/session.js';
import { aleaAGraine, data, lireFichier } from './aide.js';

const { exercise: m10 } = await loadApp('?exercice=m10-tournage-vc', lireFichier);

const ETUDIANT = { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' };
const DEBUT = new Date('2026-09-21T13:05:00.000Z');
const minutesApres = (n) => new Date(DEBUT.getTime() + n * 60000);

const INDEX = [{ id: 'm10-tournage-vc', titre: 'M10' }, { id: 'essai-percage', titre: 'Essai' }];

// Exercice où les 5 champs sont évalués, sur un seul outil et une seule dimension.
const CINQ_CHAMPS = {
  id: 'essai-percage',
  titre: 'Essai — perçage',
  version: 'r1',
  champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'],
  outils: [{ id: 'foret_fractionnaire', reussites_requises: 2, dimensions: ['Ø 1/4 po'], materiaux_outil: ['Acier rapide'], groupes: ['P - Acier non allié'] }],
};
assert.deepEqual(validateExercise(CINQ_CHAMPS, data), []);

// Faux localStorage en mémoire.
function fauxStockage() {
  const memoire = new Map();
  return {
    getItem: (cle) => (memoire.has(cle) ? memoire.get(cle) : null),
    setItem: (cle, valeur) => { memoire.set(cle, String(valeur)); },
    removeItem: (cle) => { memoire.delete(cle); },
  };
}

// Les bonnes réponses d'une question, telles qu'affichées par le corrigé.
const bonnesReponses = (etat) => formatParameters(computeParameters(etat.question, data));

// --- Choix de l'exercice ---------------------------------------------------------------------

test('requestedExercise : ?exercice=<id> choisit un exercice de l’index', () => {
  const essai = { exercise: { id: 'essai-percage', titre: 'Essai' }, unknownId: null };
  assert.deepEqual(requestedExercise('?exercice=essai-percage', INDEX), essai);
  assert.deepEqual(requestedExercise('?autre=1&exercice=essai-percage', INDEX), essai);
  assert.deepEqual(requestedExercise('exercice=essai-percage', INDEX), essai); // sans le « ? »
});

test('requestedExercise : absent → aucun exercice ; inconnu → aucun exercice et l’id fautif ; jamais de repli (D18)', () => {
  assert.deepEqual(requestedExercise('', INDEX), { exercise: null, unknownId: null });
  assert.deepEqual(requestedExercise('?exercice=', INDEX), { exercise: null, unknownId: null });
  assert.deepEqual(requestedExercise('?Exercice=essai-percage', INDEX), { exercise: null, unknownId: null }); // le nom du paramètre est en minuscules
  assert.deepEqual(requestedExercise('?exercice=inconnu', INDEX), { exercise: null, unknownId: 'inconnu' });
  assert.deepEqual(requestedExercise('?exercice=../data/outils', INDEX), { exercise: null, unknownId: '../data/outils' }); // jamais un chemin
  assert.deepEqual(requestedExercise('?exercice=M10-tournage-vc', INDEX), { exercise: null, unknownId: 'M10-tournage-vc' }); // l'id est en minuscules
});

test('loadApp : charge le catalogue, l’index et l’exercice demandé par l’adresse', async () => {
  const demandes = [];
  const lecteur = (url) => { demandes.push(url); return lireFichier(url); };
  const app = await loadApp('?exercice=m10-tournage-vc', lecteur);
  assert.equal(app.data.outils.length, 29);
  assert.deepEqual(app.index.map((e) => e.id), ['m10-tournage-vc']);
  assert.equal(app.exercise.id, 'm10-tournage-vc');
  assert.equal(app.unknownId, null);
  assert.deepEqual(demandes.sort(), ['data/materiaux.json', 'data/operations.json', 'data/outils.json', 'exercices/index.json', 'exercices/m10-tournage-vc.json']);
});

test('loadApp : sans exercice reconnu, aucun fichier d’exercice n’est lu — l’accueil montrera la liste (D18)', async () => {
  for (const [adresse, inconnu] of [['', null], ['?exercice=inconnu', 'inconnu'], ['?exercice=../data/outils', '../data/outils']]) {
    const demandes = [];
    const lecteur = (url) => { demandes.push(url); return lireFichier(url); };
    const app = await loadApp(adresse, lecteur);
    assert.equal(app.exercise, null, adresse);
    assert.equal(app.unknownId, inconnu, adresse);
    assert.deepEqual(app.index.map((e) => e.id), ['m10-tournage-vc']);
    assert.deepEqual(demandes.sort(), ['data/materiaux.json', 'data/operations.json', 'data/outils.json', 'exercices/index.json'], adresse);
  }
});

test('loadApp : un fichier manquant fait échouer le chargement avec un message clair', async () => {
  const lecteur = async (url) => { if (url.includes('index')) throw new Error(`Impossible de charger ${url} (HTTP 404)`); return lireFichier(url); };
  await assert.rejects(loadApp('', lecteur), /Impossible de charger exercices\/index\.json/);
});

// --- Cycle d'une séance ----------------------------------------------------------------------

test('startSession : identifie l’étudiant et pose la première question', () => {
  const etat = startSession(ETUDIANT, m10, data, DEBUT, aleaAGraine(1));
  assert.deepEqual(etat.etudiant, ETUDIANT);
  assert.equal(etat.exerciceId, 'm10-tournage-vc');
  assert.equal(etat.debut, '2026-09-21T13:05:00.000Z');
  assert.ok(m10.outils.some((o) => o.id === etat.question.tool.id));
  assert.deepEqual(etat.saisies, { vc: '', feedPerTooth: '', rpm: '', feedPerRev: '', feedRate: '' });
  assert.equal(etat.correction, null);
  assert.equal(sessionStep(etat), 'question');
});

test('startSession : identification invalide → erreur, aucune séance', () => {
  assert.throws(() => startSession({ ...ETUDIANT, nom: '' }, m10, data, DEBUT), /Identification invalide/);
});

test('answerFields (M10) : Vc à saisir, les quatre autres champs pré-remplis avec la valeur mise en forme', () => {
  const etat = updateAnswers(startSession(ETUDIANT, m10, data, DEBUT, aleaAGraine(1)), { vc: '39' });
  const affiche = bonnesReponses(etat);
  assert.deepEqual(answerFields(etat, m10, data), [
    { field: 'vc', graded: true, text: '39' },
    { field: 'feedPerTooth', graded: false, text: affiche.feedPerTooth },
    { field: 'rpm', graded: false, text: affiche.rpm },
    { field: 'feedPerRev', graded: false, text: affiche.feedPerRev },
    { field: 'feedRate', graded: false, text: affiche.feedRate },
  ]);
});

test('updateAnswers : mémorise les saisies en cours, sans toucher à l’état reçu ni à une question corrigée', () => {
  const depart = startSession(ETUDIANT, m10, data, DEBUT, aleaAGraine(1));
  const tape = updateAnswers(updateAnswers(depart, { vc: '4' }), { vc: '40', rpm: '12' });
  assert.deepEqual(tape.saisies, { vc: '40', feedPerTooth: '', rpm: '12', feedPerRev: '', feedRate: '' });
  assert.equal(depart.saisies.vc, '');

  const corrige = submitAnswers(tape, m10, data, tape.saisies, minutesApres(1));
  assert.equal(updateAnswers(corrige, { vc: '999' }), corrige);
});

test('submitAnswers : bonne réponse → correction, compteur de l’outil, total, question réussie gardée pour le rapport', () => {
  const depart = startSession(ETUDIANT, m10, data, DEBUT, aleaAGraine(1));
  const copie = structuredClone(depart);
  const etat = submitAnswers(depart, m10, data, { vc: bonnesReponses(depart).vc }, minutesApres(2));

  assert.equal(etat.correction.success, true);
  assert.equal(etat.correction.fields.vc.ok, true);
  assert.deepEqual(etat.progression.reussites, { [depart.question.tool.id]: 1 });
  assert.equal(etat.progression.totalReussies, 1);
  assert.deepEqual(etat.questionsReussies, [{ question: depart.question, attendu: computeParameters(depart.question, data), date: '2026-09-21T13:07:00.000Z' }]);
  assert.equal(etat.question, depart.question); // la question reste affichée avec son corrigé
  assert.equal(sessionStep(etat), 'correction');
  assert.deepEqual(depart, copie); // l'état reçu n'est pas modifié
});

test('submitAnswers : mauvaise réponse → compteur de l’outil à zéro, total et historique inchangés', () => {
  let etat = startSession(ETUDIANT, CINQ_CHAMPS, data, DEBUT, aleaAGraine(1));
  etat = submitAnswers(etat, CINQ_CHAMPS, data, bonnesReponses(etat), minutesApres(1));
  etat = nextQuestion(etat, CINQ_CHAMPS, data, aleaAGraine(2));
  assert.equal(etat.progression.reussites.foret_fractionnaire, 1);

  // Deuxième question : N faux (3200, environ le double de la théorie), le reste bon, et Vf = 3200 × 0,003.
  const reponses = { ...bonnesReponses(etat), rpm: '3200', feedRate: '9.6' };
  etat = submitAnswers(etat, CINQ_CHAMPS, data, reponses, minutesApres(2));
  assert.equal(etat.correction.success, false);
  assert.equal(etat.correction.fields.rpm.ok, false);
  assert.equal(etat.correction.fields.feedRate.ok, true); // cohérente avec le N saisi (D15)
  assert.equal(etat.progression.reussites.foret_fractionnaire, 0); // réussites consécutives (D12)
  assert.equal(etat.progression.totalReussies, 1);
  assert.equal(etat.questionsReussies.length, 1);
  assert.equal(etat.reussite, null);
  assert.deepEqual(etat.saisies, reponses); // les saisies corrigées restent affichées
});

test('une question n’est corrigée qu’une fois, et on ne passe pas une question sans y répondre', () => {
  const depart = startSession(ETUDIANT, m10, data, DEBUT, aleaAGraine(1));
  assert.throws(() => nextQuestion(depart, m10, data, aleaAGraine(2)), /doit être corrigée avant/);

  const corrige = submitAnswers(depart, m10, data, { vc: '1' }, minutesApres(1));
  assert.throws(() => submitAnswers(corrige, m10, data, { vc: bonnesReponses(depart).vc }, minutesApres(2)), /déjà été corrigée/);
  assert.equal(corrige.progression.totalReussies, 0);
});

test('cycle complet du M10 : 15 bonnes réponses, avec sauvegarde et relecture à chaque étape', () => {
  const stockage = fauxStockage();
  const random = aleaAGraine(2026);
  let etat = startSession(ETUDIANT, m10, data, DEBUT, random);
  let questions = 0;

  while (sessionStep(etat) !== 'reussite') {
    // L'étudiant recharge la page au milieu de sa question : on repart de ce qui est sauvegardé.
    assert.equal(saveSession(etat, stockage), true);
    etat = restoreSession(loadSession(stockage), m10);
    assert.equal(sessionStep(etat), 'question');
    assert.equal(etat.reussite, null);

    questions += 1;
    etat = submitAnswers(etat, m10, data, { vc: bonnesReponses(etat).vc }, minutesApres(questions));
    assert.equal(etat.correction.success, true, etat.question.displayId);

    // Il recharge encore, cette fois devant le corrigé.
    saveSession(etat, stockage);
    etat = restoreSession(loadSession(stockage), m10);
    assert.equal(sessionStep(etat), 'correction');

    etat = nextQuestion(etat, m10, data, random);
    assert.ok(questions <= 15, 'un outil terminé ne doit plus sortir');
  }

  assert.equal(questions, 15); // 1 + 3 + 3 + 1 + 1 + 3 + 1 + 1 + 1
  assert.equal(etat.question, null);
  assert.deepEqual(answerFields(etat, m10, data), []);
  assert.equal(etat.progression.totalReussies, 15);
  assert.equal(etat.questionsReussies.length, 15);
  assert.equal(etat.reussite, minutesApres(15).toISOString()); // date de la 15e correction
  assert.equal(etat.debut, DEBUT.toISOString());

  // L'état final se sauvegarde et se relit lui aussi.
  saveSession(etat, stockage);
  assert.deepEqual(restoreSession(loadSession(stockage), m10), etat);
  assert.ok(stockage.getItem(SESSION_KEY).length < 50000, 'l’état complet reste petit pour localStorage');
});

test('cycle avec un échec : la série recommence, la date de réussite n’est posée qu’à la complétion', () => {
  const random = aleaAGraine(3);
  let etat = startSession(ETUDIANT, CINQ_CHAMPS, data, DEBUT, random);
  const resultats = [true, false, true, true]; // 2 réussites consécutives requises
  resultats.forEach((bon, i) => {
    const reponses = bon ? bonnesReponses(etat) : { ...bonnesReponses(etat), vc: '1' };
    etat = submitAnswers(etat, CINQ_CHAMPS, data, reponses, minutesApres(i + 1));
    assert.equal(etat.correction.success, bon);
    assert.equal(etat.reussite, i === 3 ? minutesApres(4).toISOString() : null);
    etat = nextQuestion(etat, CINQ_CHAMPS, data, random);
  });
  assert.equal(sessionStep(etat), 'reussite');
  assert.equal(etat.progression.totalReussies, 3);
  assert.equal(etat.questionsReussies.length, 3);
});

// --- Reprise d'une séance sauvegardée ----------------------------------------------------------

test('restoreSession : rien de sauvegardé, autre exercice ou exercice modifié → nouvelle séance', () => {
  const etat = startSession(ETUDIANT, m10, data, DEBUT, aleaAGraine(1));
  assert.equal(restoreSession(etat, m10), etat);
  assert.equal(restoreSession(null, m10), null);
  assert.equal(restoreSession(etat, CINQ_CHAMPS), null); // séance d'un autre exercice
  assert.equal(restoreSession(etat, { ...m10, version: 'r1' }), null); // l'enseignant a publié une nouvelle version
  assert.equal(restoreSession(etat, { ...m10, outils: m10.outils.filter((o) => o.id !== etat.question.tool.id) }), null); // l'outil de la question n'est plus évalué
});

test('stockage vide ou corrompu : loadSession donne null, restoreSession aussi, et une nouvelle séance démarre', () => {
  const stockage = fauxStockage();
  assert.equal(restoreSession(loadSession(stockage), m10), null);
  stockage.setItem(SESSION_KEY, '{"version":1,"etudiant":');
  assert.equal(restoreSession(loadSession(stockage), m10), null);

  const etat = startSession(ETUDIANT, m10, data, DEBUT, aleaAGraine(1));
  assert.equal(saveSession(etat, stockage), true);
  assert.deepEqual(restoreSession(loadSession(stockage), m10), etat);
});
