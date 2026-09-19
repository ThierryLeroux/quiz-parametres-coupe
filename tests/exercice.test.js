// Tests de site/js/exercice.js : validation et chargement d'un exercice (SPEC §10, décision D11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadData } from '../site/js/data.js';
import { GRADED_FIELD_KEYS, fieldsToGrade, loadExercise, validateExercise } from '../site/js/exercice.js';
import { ANSWER_FIELDS } from '../site/js/correction.js';

// Vrai catalogue et vrais exercices, lus sur disque (sous Node, fetch ne lit pas les fichiers locaux).
const lireFichier = async (url) => JSON.parse(await readFile(new URL(`../site/${url}`, import.meta.url), 'utf8'));
const data = await loadData('data/', lireFichier);

// Exercice valide qui utilise toutes les possibilités du schéma. Chaque appel retourne une copie neuve, à abîmer.
const exerciceValide = () => ({
  _commentaire: 'les clés qui commencent par _ sont ignorées',
  id: 'essai-percage',
  titre: 'Essai — perçage',
  version: 'r1',
  multiplicateur_moodle: 12345,
  champs_evalues: ['vc', 'n', 'vf'],
  outils: [
    { id: 'mvlnr', reussites_requises: 3 },
    {
      id: 'foret_fractionnaire',
      reussites_requises: 2,
      dimensions: ['Ø 1/4 po', 'Ø 1/2 po'],
      materiaux_outil: ['Acier rapide'],
      groupes: ['P - Acier non allié', 'N - Aluminium de corroyage'],
    },
  ],
});

test('validateExercise : l’exercice d’essai est valide', () => {
  assert.deepEqual(validateExercise(exerciceValide(), data), []);
});

test('le M10 réel est valide et se charge', async () => {
  const exercice = await loadExercise('m10-tournage-vc', data, 'exercices/', lireFichier);
  assert.equal(exercice.titre, 'M10 — Tournage : vitesse de coupe');
  assert.equal(exercice.outils.length, 9);
  assert.deepEqual(fieldsToGrade(exercice), ['vc']);
});

// Une anomalie à la fois → exactement une erreur, qui nomme l'élément fautif.
const anomalies = [
  ['id avec majuscules ou espaces', (e) => { e.id = 'Essai perçage'; }, /« id » doit être fait de minuscules/],
  ['id absent', (e) => { delete e.id; }, /« id » doit être fait de minuscules/],
  ['titre vide', (e) => { e.titre = ' '; }, /« titre » est vide/],
  ['version numérique', (e) => { e.version = 1; }, /« version » doit être un texte/],
  ['multiplicateur Moodle absent', (e) => { delete e.multiplicateur_moodle; }, /« multiplicateur_moodle » doit être un entier ≥ 1/],
  ['multiplicateur Moodle décimal', (e) => { e.multiplicateur_moodle = 541.26; }, /« multiplicateur_moodle » doit être un entier ≥ 1/],
  ['multiplicateur Moodle en texte', (e) => { e.multiplicateur_moodle = '54126'; }, /« multiplicateur_moodle » doit être un entier ≥ 1/],
  ['clé inconnue à la racine', (e) => { e.champs_evaluees = ['vc']; }, /clé inconnue « champs_evaluees »/],
  ['aucun champ évalué', (e) => { e.champs_evalues = []; }, /« champs_evalues » doit être une liste non vide/],
  ['champ évalué inconnu (nom du moteur au lieu du nom du schéma)', (e) => { e.champs_evalues = ['vc', 'rpm']; }, /champ évalué inconnu : « rpm » \(choix : vc, fz, n, f, vf\)/],
  ['champ évalué en double', (e) => { e.champs_evalues = ['vc', 'n', 'vc']; }, /champ évalué en double : « vc »/],
  ['aucun outil', (e) => { e.outils = []; }, /« outils » doit être une liste non vide/],
  ['outil absent du catalogue', (e) => { e.outils[0].id = 'fraise_inconnue'; }, /outils\[0\] « fraise_inconnue » : cet outil n'existe pas dans le catalogue/],
  ['outil en double', (e) => { e.outils.push({ id: 'mvlnr', reussites_requises: 1 }); }, /outils\[2\] « mvlnr » : outil en double/],
  ['réussites requises à 0', (e) => { e.outils[0].reussites_requises = 0; }, /« mvlnr » : « reussites_requises » doit être un entier ≥ 1/],
  ['réussites requises décimales', (e) => { e.outils[0].reussites_requises = 1.5; }, /« mvlnr » : « reussites_requises » doit être un entier ≥ 1/],
  ['réussites requises absentes', (e) => { delete e.outils[0].reussites_requises; }, /« mvlnr » : « reussites_requises » doit être un entier ≥ 1/],
  ['clé inconnue sur un outil (faute de frappe)', (e) => { e.outils[0].dimension = ['2.000"']; }, /« mvlnr » : clé inconnue « dimension »/],
  ['dimension qui n’existe pas sur l’outil', (e) => { e.outils[1].dimensions = ['Ø 1/4 po', 'Ø 3 po']; }, /« foret_fractionnaire » : « dimensions » : « Ø 3 po » n'existe pas sur cet outil/],
  ['dimension d’un autre outil', (e) => { e.outils[0].dimensions = ['Ø 1/4 po']; }, /« mvlnr » : « dimensions » : « Ø 1\/4 po » n'existe pas/],
  ['dimension en double', (e) => { e.outils[1].dimensions = ['Ø 1/4 po', 'Ø 1/4 po']; }, /« dimensions » : « Ø 1\/4 po » est en double/],
  ['liste de dimensions vide', (e) => { e.outils[1].dimensions = []; }, /« dimensions » doit être une liste non vide/],
  ['matériau d’outil que l’outil n’offre pas', (e) => { e.outils[0].materiaux_outil = ['Acier rapide']; }, /« mvlnr » : « materiaux_outil » : « Acier rapide » n'existe pas sur cet outil/],
  ['matériau d’outil en double', (e) => { e.outils[1].materiaux_outil = ['Acier rapide', 'Acier rapide']; }, /« materiaux_outil » : « Acier rapide » est en double/],
  ['liste de matériaux d’outil vide', (e) => { e.outils[1].materiaux_outil = []; }, /« materiaux_outil » doit être une liste non vide/],
  ['groupe non usinable par l’outil', (e) => { e.outils[1].groupes = ['O - Graphite']; }, /« foret_fractionnaire » : « groupes » : « O - Graphite » n'existe pas sur cet outil/],
  ['groupe inconnu', (e) => { e.outils[1].groupes = ['P - Acier inconnu']; }, /« groupes » : « P - Acier inconnu » n'existe pas/],
  ['liste de groupes qui n’est pas une liste', (e) => { e.outils[1].groupes = 'P - Acier non allié'; }, /« groupes » doit être une liste non vide/],
];

for (const [nom, abimer, attendu] of anomalies) {
  test(`validateExercise : ${nom}`, () => {
    const exercice = exerciceValide();
    abimer(exercice);
    const erreurs = validateExercise(exercice, data);
    assert.equal(erreurs.length, 1, `une seule erreur attendue, reçu :\n${erreurs.join('\n')}`);
    assert.match(erreurs[0], attendu);
  });
}

test('validateExercise : rapporte toutes les erreurs d’un coup, sans lever d’exception', () => {
  const exercice = exerciceValide();
  exercice.titre = '';
  exercice.outils[0].reussites_requises = 0;
  exercice.outils[1] = null;
  assert.equal(validateExercise(exercice, data).length, 3);
  assert.equal(validateExercise(null, data).length, 1);
  assert.ok(validateExercise({}, data).length >= 5);
});

test('GRADED_FIELD_KEYS : les 5 champs du schéma correspondent aux 5 champs du moteur, dans l’ordre de l’écran', () => {
  assert.deepEqual(Object.keys(GRADED_FIELD_KEYS), ['vc', 'fz', 'n', 'f', 'vf']);
  assert.deepEqual(Object.values(GRADED_FIELD_KEYS), ANSWER_FIELDS);
});

test('fieldsToGrade : traduit champs_evalues pour gradeAnswers', () => {
  assert.deepEqual(fieldsToGrade(exerciceValide()), ['vc', 'rpm', 'feedRate']);
});

test('loadExercise : lit <baseUrl><id>.json et retourne l’exercice', async () => {
  const demandes = [];
  const exercice = await loadExercise('essai-percage', data, 'ailleurs/', async (url) => { demandes.push(url); return exerciceValide(); });
  assert.deepEqual(demandes, ['ailleurs/essai-percage.json']);
  assert.equal(exercice.id, 'essai-percage');
});

test('loadExercise : l’id doit être identique au nom du fichier', async () => {
  await assert.rejects(loadExercise('autre-nom', data, 'exercices/', async () => exerciceValide()), /« id » doit être identique au nom du fichier \(« autre-nom »\)/);
});

test('loadExercise : exercice invalide → erreur qui énumère tous les problèmes', async () => {
  const exercice = exerciceValide();
  exercice.champs_evalues = ['rpm'];
  exercice.outils[0].id = 'fraise_inconnue';
  await assert.rejects(loadExercise('essai-percage', data, 'exercices/', async () => exercice), (erreur) => {
    assert.match(erreur.message, /^Exercice invalide \(essai-percage\.json\) :/);
    assert.match(erreur.message, /champ évalué inconnu : « rpm »/);
    assert.match(erreur.message, /n'existe pas dans le catalogue/);
    return true;
  });
});

test('loadExercise : refuse un identifiant qui n’a pas la forme d’un nom d’exercice', async () => {
  const lecteur = async () => { throw new Error('ne devrait pas être appelé'); };
  for (const id of ['../data/outils', 'M10', 'a/b', '', null]) {
    await assert.rejects(loadExercise(id, data, 'exercices/', lecteur), /Identifiant d'exercice invalide/, String(id));
  }
});

test('loadExercise : un fichier introuvable fait échouer le chargement', async () => {
  const lecteur = async (url) => { throw new Error(`Impossible de charger ${url} (HTTP 404)`); };
  await assert.rejects(loadExercise('absent', data, 'exercices/', lecteur), /Impossible de charger exercices\/absent\.json/);
});
