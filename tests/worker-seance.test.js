// Tests de worker/seance.js : les règles d'une séance sur le serveur, sans base ni réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CADENCE_MS, NIP_CLEARED, cadenceWait, cleanAnswers, correctionView, countNipAttempt, drawQuestion, emptyCounters,
  gradeQuestion, isExerciseComplete, isNipLocked, isQuestionValid, isTestMode, later, questionView, sessionView,
} from '../worker/seance.js';
import { computeParameters } from '../site/js/calcul.js';
import { formatParameters } from '../site/js/format.js';
import { loadExercise, validateExercise } from '../site/js/exercice.js';
import { aleaAGraine, data, lireFichier, questionPour } from './aide.js';

const m10 = await loadExercise('m10-tournage-vc', data, 'exercices/', lireFichier);

// Exercice où les 5 champs sont évalués, sur un seul outil et une seule dimension.
const CINQ_CHAMPS = {
  id: 'essai-percage',
  titre: 'Essai — perçage',
  version: 'r1',
  champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'],
  outils: [{ id: 'foret_fractionnaire', reussites_requises: 2, dimensions: ['Ø 1/4 po'], materiaux_outil: ['Acier rapide'], groupes: ['P - Acier non allié'] }],
};
assert.deepEqual(validateExercise(CINQ_CHAMPS, data), []);

const MAINTENANT = new Date('2026-09-21T13:05:00.000Z');
const apres = (ms) => new Date(MAINTENANT.getTime() + ms);
const bonnesReponses = (question) => formatParameters(computeParameters(question, data));

// Une ligne de la table seances, colonnes JSON déjà lues.
const seance = (champs = {}) => ({
  id: 1, exercice_id: 'm10-tournage-vc', matricule: '2412345', prenom: 'Camille', nom: 'Tremblay',
  debut: MAINTENANT.toISOString(), derniere_correction: null, reussite_le: null,
  compteurs: emptyCounters(), question_courante: null,
  essais_nip: 0, essais_nip_debut: null, verrou_nip_jusqua: null,
  ...champs,
});

// --- Tirage et correction --------------------------------------------------------------------------------

test('drawQuestion : tire parmi les outils encore à évaluer ; null quand tout est réussi', () => {
  const question = drawQuestion(emptyCounters(), m10, data, aleaAGraine(1));
  assert.ok(m10.outils.some((entry) => entry.id === question.tool.id));

  const presqueFini = { reussites: Object.fromEntries(m10.outils.map((entry) => [entry.id, entry.reussites_requises])), totalReussies: 15 };
  presqueFini.reussites.mvlnr = 2;
  for (let graine = 1; graine <= 20; graine += 1) assert.equal(drawQuestion(presqueFini, m10, data, aleaAGraine(graine)).tool.id, 'mvlnr');

  presqueFini.reussites.mvlnr = 3;
  assert.equal(drawQuestion(presqueFini, m10, data, aleaAGraine(1)), null);
  assert.equal(isExerciseComplete(presqueFini, m10), true);
  assert.equal(isExerciseComplete(emptyCounters(), m10), false);
});

test('gradeQuestion : bonne réponse → compteur de l’outil et total ; le résultat garde les valeurs attendues pour le journal', () => {
  const question = drawQuestion(emptyCounters(), m10, data, aleaAGraine(1));
  const depart = emptyCounters();
  const { success, result, counters } = gradeQuestion(question, cleanAnswers({ vc: bonnesReponses(question).vc }), depart, m10, data);
  assert.equal(success, true);
  assert.equal(result.fields.vc.ok, true);
  assert.deepEqual(result.attendu, computeParameters(question, data));
  assert.deepEqual(counters, { reussites: { [question.tool.id]: 1 }, totalReussies: 1 });
  assert.deepEqual(depart, emptyCounters()); // les compteurs reçus ne sont pas modifiés
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result); // se range tel quel dans une colonne JSON
});

test('gradeQuestion : mauvaise réponse → compteur de cet outil à zéro, total inchangé (D12) ; Vf jugée sur le N saisi (D15)', () => {
  const question = drawQuestion(emptyCounters(), CINQ_CHAMPS, data, aleaAGraine(2));
  const avant = { reussites: { foret_fractionnaire: 1, mvlnr: 2 }, totalReussies: 3 };
  const reponses = cleanAnswers({ ...bonnesReponses(question), rpm: '3200', feedRate: '9.6' }); // N faux ; Vf = 3200 × 0,003
  const { success, result, counters } = gradeQuestion(question, reponses, avant, CINQ_CHAMPS, data);
  assert.equal(success, false);
  assert.equal(result.fields.rpm.ok, false);
  assert.equal(result.fields.feedRate.ok, true);
  assert.deepEqual(counters, { reussites: { foret_fractionnaire: 0, mvlnr: 2 }, totalReussies: 3 });
});

test('cycle complet du M10 : 15 bonnes réponses, les compteurs passant par du JSON à chaque étape', () => {
  const random = aleaAGraine(2026);
  let compteurs = emptyCounters();
  let questions = 0;
  for (let question = drawQuestion(compteurs, m10, data, random); question !== null; question = drawQuestion(compteurs, m10, data, random)) {
    questions += 1;
    assert.ok(questions <= 15, 'un outil terminé ne doit plus sortir');
    const enBase = JSON.parse(JSON.stringify(question)); // la question mémorisée dans la séance
    const corrige = gradeQuestion(enBase, cleanAnswers({ vc: bonnesReponses(enBase).vc }), compteurs, m10, data);
    assert.equal(corrige.success, true, question.displayId);
    compteurs = JSON.parse(JSON.stringify(corrige.counters));
  }
  assert.equal(questions, 15); // 1 + 3 + 3 + 1 + 1 + 3 + 1 + 1 + 1
  assert.equal(compteurs.totalReussies, 15);
  assert.equal(isExerciseComplete(compteurs, m10), true);
});

test('cleanAnswers : seulement les cinq champs, en texte court', () => {
  assert.deepEqual(cleanAnswers({ vc: ' 400 ', rpm: 1600, autre: 'x', feedRate: '9'.repeat(100) }), {
    vc: '400', feedPerTooth: '', rpm: '', feedPerRev: '', feedRate: '9'.repeat(32),
  });
  for (const saisies of [null, undefined, 'texte', 42, []]) assert.deepEqual(Object.values(cleanAnswers(saisies)), ['', '', '', '', '']);
});

// --- Exercice modifié en cours de session (D21) ----------------------------------------------------------

test('exercice modifié : un outil retiré disparaît, un outil ajouté part à zéro, la séance continue', () => {
  const compteurs = { reussites: { mclnr: 1, mvlnr: 2 }, totalReussies: 3 };
  const sansMvlnr = { ...m10, version: 'r1', outils: m10.outils.filter((entry) => entry.id !== 'mvlnr') };
  const vue = sessionView(seance({ compteurs }), sansMvlnr, data);
  assert.equal(vue.progression.outils.some((outil) => outil.id === 'mvlnr'), false);
  assert.equal(vue.progression.total_reussies, 3); // le total ne diminue jamais
  assert.equal(vue.exercice.version, 'r1');

  const avecForet = { ...m10, outils: [...m10.outils, { id: 'foret_fractionnaire', reussites_requises: 2 }] };
  assert.deepEqual(sessionView(seance({ compteurs }), avecForet, data).progression.outils.at(-1), { id: 'foret_fractionnaire', nom: 'Foret fractionnaire', reussites: 0, requises: 2 });

  const toutReussi = { reussites: Object.fromEntries(m10.outils.map((entry) => [entry.id, entry.reussites_requises])), totalReussies: 15 };
  assert.equal(isExerciseComplete(toutReussi, avecForet), false); // l'outil ajouté reste à faire
  assert.equal(drawQuestion(toutReussi, avecForet, data, aleaAGraine(1)).tool.id, 'foret_fractionnaire');
});

test('isQuestionValid : la question d’un outil retiré de l’exercice, ou déjà réussi, n’est plus posée', () => {
  const question = questionPour({ outil: 'mvlnr', dimension: data.outils.find((o) => o.id === 'mvlnr').dimensions[0].libelle, dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: 1 });
  const zero = emptyCounters();
  assert.equal(isQuestionValid(question, zero, m10, data), true);
  assert.equal(isQuestionValid(null, zero, m10, data), false);
  assert.equal(isQuestionValid(question, zero, { ...m10, outils: m10.outils.filter((entry) => entry.id !== 'mvlnr') }, data), false);
  // L'outil est déjà réussi (on exige maintenant moins de réussites) : sa question ne se pose plus.
  assert.equal(isQuestionValid(question, { reussites: { mvlnr: 2 }, totalReussies: 2 }, m10, data), true);
  assert.equal(isQuestionValid(question, { reussites: { mvlnr: 3 }, totalReussies: 3 }, m10, data), false);
});

// --- Cadence et essais de NIP ------------------------------------------------------------------------------

test('cadenceWait : 10 s entre deux corrections ; la première n’attend pas', () => {
  assert.equal(CADENCE_MS, 10000);
  assert.equal(cadenceWait(seance(), MAINTENANT), 0);
  const corrigee = seance({ derniere_correction: MAINTENANT.toISOString() });
  assert.equal(cadenceWait(corrigee, apres(0)), 10);
  assert.equal(cadenceWait(corrigee, apres(2500)), 8);
  assert.equal(cadenceWait(corrigee, apres(9999)), 1);
  assert.equal(cadenceWait(corrigee, apres(10000)), 0);
});

test('countNipAttempt : le 5e essai en 10 minutes pose le verrou de 10 minutes', () => {
  let s = seance();
  for (let essai = 1; essai <= 4; essai += 1) {
    s = { ...s, ...countNipAttempt(s, apres(essai * 1000)) };
    assert.deepEqual([s.essais_nip, s.essais_nip_debut, s.verrou_nip_jusqua], [essai, apres(1000).toISOString(), null]);
    assert.equal(isNipLocked(s, apres(essai * 1000)), false);
  }
  s = { ...s, ...countNipAttempt(s, apres(5000)) };
  assert.deepEqual([s.essais_nip, s.essais_nip_debut, s.verrou_nip_jusqua], [0, null, later(apres(5000), 10 * 60000)]);
  assert.equal(isNipLocked(s, apres(5000)), true);
  assert.equal(isNipLocked(s, apres(5000 + 10 * 60000 - 1)), true);
  assert.equal(isNipLocked(s, apres(5000 + 10 * 60000)), false);
});

test('countNipAttempt : des essais étalés sur plus de 10 minutes ne verrouillent pas ; une réussite efface tout', () => {
  let s = seance();
  for (let essai = 0; essai < 12; essai += 1) {
    s = { ...s, ...countNipAttempt(s, apres(essai * 3 * 60000)) }; // un essai aux 3 minutes : 4 par fenêtre
    assert.equal(s.verrou_nip_jusqua, null, `essai ${essai + 1}`);
    assert.ok(s.essais_nip <= 4);
  }
  assert.deepEqual({ ...s, ...NIP_CLEARED }.essais_nip, 0);
});

// --- Ce qu'on montre au navigateur -------------------------------------------------------------------------

test('questionView (M10) : Vc à saisir, les quatre autres champs fournis ; jamais les Vc du matériau', () => {
  const question = drawQuestion(emptyCounters(), m10, data, aleaAGraine(1));
  const vue = questionView(question, m10, data);
  const affiche = bonnesReponses(question);
  assert.deepEqual(vue.champs, [
    { champ: 'vc', evalue: true, texte: '' },
    { champ: 'feedPerTooth', evalue: false, texte: affiche.feedPerTooth },
    { champ: 'rpm', evalue: false, texte: affiche.rpm },
    { champ: 'feedPerRev', evalue: false, texte: affiche.feedPerRev },
    { champ: 'feedRate', evalue: false, texte: affiche.feedRate },
  ]);
  assert.equal(vue.identifiant, question.displayId);
  assert.equal(vue.outil.id, question.tool.id);
  assert.equal(vue.outil.dents, question.teeth);
  assert.equal(typeof vue.outil.limite_rpm, 'number');
  assert.equal(vue.dimension, question.dimension.label);
  assert.equal(vue.materiau.materiau, question.material.materiau);
  assert.equal(JSON.stringify(vue).includes('vc_pi_min'), false);
});

test('questionView (cinq champs évalués) : aucune valeur attendue ne part vers le navigateur', () => {
  const question = drawQuestion(emptyCounters(), CINQ_CHAMPS, data, aleaAGraine(1));
  const vue = questionView(question, CINQ_CHAMPS, data);
  assert.deepEqual(vue.champs.map((champ) => [champ.evalue, champ.texte]), Array(5).fill([true, '']));
  assert.equal('reponses_test' in vue, false);
});

// --- Mode test (D26) ------------------------------------------------------------------------------------------

test('isTestMode : la variable MODE_TEST=1 ET une requête adressée au poste lui-même ; rien d’autre', () => {
  for (const hote of ['localhost', '127.0.0.1', '[::1]']) assert.equal(isTestMode('1', hote), true, hote);
  for (const [variable, hote] of [
    ['1', 'quiz-parametres-coupe.exemple.workers.dev'], ['1', 'localhost.exemple.com'], ['1', ''], ['1', undefined],
    [undefined, 'localhost'], ['', 'localhost'], ['0', 'localhost'], ['true', 'localhost'], [1, 'localhost'], [true, 'localhost'],
  ]) assert.equal(isTestMode(variable, hote), false, `${String(variable)} / ${String(hote)}`);
});

test('questionView en mode test : les valeurs attendues des champs ÉVALUÉS seulement, mises en forme', () => {
  const question = drawQuestion(emptyCounters(), m10, data, aleaAGraine(1));
  assert.deepEqual(questionView(question, m10, data, { testMode: true }).reponses_test, { vc: bonnesReponses(question).vc });
  const complete = questionView(question, { ...CINQ_CHAMPS, outils: m10.outils }, data, { testMode: true });
  assert.deepEqual(complete.reponses_test, bonnesReponses(question));
  assert.equal('reponses_test' in questionView(question, m10, data, { testMode: false }), false);
});

test('cadenceWait en mode test : la cadence est levée', () => {
  assert.equal(cadenceWait(seance({ derniere_correction: MAINTENANT.toISOString() }), apres(1000), { testMode: true }), 0);
  assert.equal(cadenceWait(seance({ derniere_correction: MAINTENANT.toISOString() }), apres(1000)), 9);
});

// --- Outil à deux diamètres (D25) --------------------------------------------------------------------------------

const BARRE = { ...CINQ_CHAMPS, id: 'essai-barre', outils: [{ id: 'barre_a_aleser', reussites_requises: 1 }] };
const questionBarre = () => questionPour({ outil: 'barre_a_aleser', dimension: '2.000"', barre: '3/4 po', dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: 1 });

test('barre à aléser : la vue nomme la barre ; la correction calcule N avec le Ø usiné (alésé) et fz avec le Ø de la barre', () => {
  const question = questionBarre();
  const vue = questionView(question, BARRE, data);
  assert.equal(vue.identifiant, 'Barre à aléser Ø 3/4 po - Ø alésé: 2.000"');
  assert.deepEqual([vue.outil.barre, vue.dimension], ['3/4 po', '2.000"']);
  assert.equal(questionView(drawQuestion(emptyCounters(), CINQ_CHAMPS, data, aleaAGraine(1)), CINQ_CHAMPS, data).outil.barre, null);

  const corrige = gradeQuestion(question, cleanAnswers({}), emptyCounters(), BARRE, data);
  const champs = Object.fromEntries(correctionView(question, cleanAnswers({}), corrige.result, 0, corrige.counters, data).champs.map((champ) => [champ.champ, champ]));
  assert.equal(champs.rpm.calcul, 'N = Vc × 4 / Ø usiné = 400 × 4 / 2');
  assert.equal(champs.feedPerTooth.calcul, 'fz = avance × Ø barre = 0.006 × 0.75');
  assert.deepEqual([champs.rpm.attendu, champs.feedPerTooth.attendu], ['800', '0.0045']);
});

test('isQuestionValid : une question de barre à aléser tirée avant D25, sans barre, n’est plus posée', () => {
  const question = questionBarre();
  assert.equal(isQuestionValid(question, emptyCounters(), BARRE, data), true);
  const { bar: _avantD25, ...ancienne } = question;
  assert.equal(isQuestionValid(ancienne, emptyCounters(), BARRE, data), false);
  assert.equal(isQuestionValid({ ...question, bar: null }, emptyCounters(), BARRE, data), false);
});

test('correctionView : juste ou faux, saisie et valeur attendue de chaque champ, compteur avant → après', () => {
  const question = drawQuestion(emptyCounters(), CINQ_CHAMPS, data, aleaAGraine(2));
  const reponses = cleanAnswers({ ...bonnesReponses(question), vc: '1' });
  const avant = { reussites: { foret_fractionnaire: 1 }, totalReussies: 1 };
  const { result, counters } = gradeQuestion(question, reponses, avant, CINQ_CHAMPS, data);
  const vue = correctionView(question, reponses, result, 1, counters, data);
  assert.equal(vue.reussie, false);
  assert.deepEqual(vue.outil, { id: 'foret_fractionnaire', nom: 'Foret fractionnaire', avant: 1, apres: 0 });
  const vc = Number(bonnesReponses(question).vc);
  assert.deepEqual(vue.champs[0], { champ: 'vc', evalue: true, ok: false, saisie: '1', attendu: String(vc), tolerance: 'exacte', ecart_pct: Number((((1 - vc) / vc) * 100).toFixed(1)), calcul: null });
  assert.deepEqual(vue.champs.slice(1).map((champ) => champ.ok), [true, true, true, true]);

  const m10Question = drawQuestion(emptyCounters(), m10, data, aleaAGraine(1));
  const bonne = gradeQuestion(m10Question, cleanAnswers({ vc: bonnesReponses(m10Question).vc }), emptyCounters(), m10, data);
  const vueM10 = correctionView(m10Question, cleanAnswers({}), bonne.result, 0, bonne.counters, data);
  assert.deepEqual(vueM10.champs.map((champ) => champ.evalue), [true, false, false, false, false]);
  assert.deepEqual(vueM10.champs.slice(1).map((champ) => [champ.tolerance, champ.ecart_pct, champ.calcul]), Array(4).fill([null, null, null])); // champs fournis : rien à expliquer
});

test('correctionView : tolérance en clair, écart en %, calcul en une ligne (UI §3.4) — foret Ø 1/4 po, acier rapide, acier 1020', () => {
  // Vc 100, N = 100 × 4 / 0.25 = 1600, fz = 0.006 × 0.25 = 0.0015, f = 0.0030 (2 lèvres), Vf = 4.800
  const question = questionPour({ outil: 'foret_fractionnaire', dimension: 'Ø 1/4 po', dents: 2, materiauOutil: 'Acier rapide', groupeMateriau: 1 });
  const reponses = cleanAnswers({ vc: '100', feedPerTooth: '0,0015', rpm: '1650', feedPerRev: '0.0030', feedRate: '5.2' });
  const { result, counters } = gradeQuestion(question, reponses, emptyCounters(), CINQ_CHAMPS, data);
  const champs = Object.fromEntries(correctionView(question, reponses, result, 0, counters, data).champs.map((champ) => [champ.champ, champ]));

  assert.deepEqual([champs.rpm.ok, champs.rpm.attendu, champs.rpm.tolerance, champs.rpm.ecart_pct], [true, '1600', '±5 % et ±1 rév/min', 3.1]);
  assert.equal(champs.rpm.calcul, 'N = Vc × 4 / Ø = 100 × 4 / 0.25');
  assert.deepEqual([champs.feedPerTooth.tolerance, champs.feedPerTooth.calcul], ['±25 %, au plus ±0.001 po', 'fz = avance × Ø = 0.006 × 0.25']);
  assert.equal(champs.feedPerRev.calcul, 'f = fz × dents = 0.0015 × 2');

  // Vf est jugée sur le N et le f SAISIS (D15) : attendu = 1650 × 0.0030 = 4.950, et non les 4.800 théoriques.
  assert.deepEqual([champs.feedRate.ok, champs.feedRate.attendu, champs.feedRate.tolerance, champs.feedRate.ecart_pct], [false, '4.950', '±0.5 % de N × f', 5.1]);
  assert.equal(champs.feedRate.calcul, 'Vf = N × f = 1650 × 0.0030');
});

test('correctionView : facteur de vitesse, plafond du RPM, pas d’un filet, réponse vide', () => {
  // Lame à tronçonner : fact_vc = 0.125. Saisie vide : pas d'écart à calculer.
  const lame = questionPour({ outil: 'lame_a_tronconner', dimension: data.outils.find((o) => o.id === 'lame_a_tronconner').dimensions[0].libelle, dents: 1, materiauOutil: 'Insert de carbure de tungstène', groupeMateriau: 1 });
  const tousLesChamps = { ...CINQ_CHAMPS, outils: [{ id: 'lame_a_tronconner', reussites_requises: 1 }, { id: 'taraud_imperial', reussites_requises: 1 }, { id: 'foret_fractionnaire', reussites_requises: 1 }] };
  let corrige = gradeQuestion(lame, cleanAnswers({}), emptyCounters(), tousLesChamps, data);
  let champs = Object.fromEntries(correctionView(lame, cleanAnswers({}), corrige.result, 0, corrige.counters, data).champs.map((champ) => [champ.champ, champ]));
  assert.match(champs.rpm.calcul, /^N = Vc × 4 \/ Ø = 400 × 4 \/ [\d.]+ × 0\.125$/);
  assert.deepEqual([champs.rpm.ok, champs.rpm.ecart_pct, champs.feedPerTooth.calcul], [false, null, null]); // avance fixe : elle se lit dans la table

  // Foret Ø 1/64 po au carbure dans l'aluminium : N plafonné par la machine.
  const petit = questionPour({ outil: 'foret_fractionnaire', dimension: 'Ø 1/64 po', dents: 2, materiauOutil: 'Carbure de tungstène solide', groupeMateriau: 21 });
  corrige = gradeQuestion(petit, cleanAnswers({}), emptyCounters(), tousLesChamps, data);
  champs = Object.fromEntries(correctionView(petit, cleanAnswers({}), corrige.result, 0, corrige.counters, data).champs.map((champ) => [champ.champ, champ]));
  assert.equal(champs.rpm.calcul, 'N = Vc × 4 / Ø = 400 × 4 / 0.015625 → plafonné à 10000');

  // Taraud 1/4-20 : fz = pas.
  const taraud = questionPour({ outil: 'taraud_imperial', dimension: '1/4- 20 UNC', dents: 1, materiauOutil: 'Acier rapide', groupeMateriau: 1 });
  corrige = gradeQuestion(taraud, cleanAnswers({}), emptyCounters(), tousLesChamps, data);
  champs = Object.fromEntries(correctionView(taraud, cleanAnswers({}), corrige.result, 0, corrige.counters, data).champs.map((champ) => [champ.champ, champ]));
  assert.deepEqual([champs.feedPerTooth.calcul, champs.feedPerTooth.tolerance, champs.rpm.tolerance], ['fz = pas du filet = 0.05000', '±0.1 %', 'de −90 % à +0.1 %']);
});

test('sessionView : étudiant de la première visite, exercice, progression par outil, question en attente', () => {
  const question = drawQuestion(emptyCounters(), m10, data, aleaAGraine(1));
  const vue = sessionView(seance({ compteurs: { reussites: { mvlnr: 2, mclnr: 1, sdtmr: 7 }, totalReussies: 9 }, question_courante: question }), m10, data);
  assert.deepEqual(vue.etudiant, { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' });
  assert.deepEqual(vue.exercice, { id: 'm10-tournage-vc', titre: m10.titre, version: 'r0' });
  assert.equal(vue.reussite_le, null);
  assert.equal(vue.progression.outils.length, 9);
  assert.deepEqual(vue.progression.outils.find((outil) => outil.id === 'mvlnr'), { id: 'mvlnr', nom: 'MVLNR', reussites: 2, requises: 3 });
  assert.deepEqual(vue.progression.outils.find((outil) => outil.id === 'sdtmr').reussites, 1); // jamais plus que le requis
  assert.equal(vue.progression.outils_termines, 2);
  assert.equal(vue.progression.total_reussies, 9);
  assert.equal(vue.question.identifiant, question.displayId);

  assert.equal(sessionView(seance(), m10, data).question, null);
  assert.equal(JSON.stringify(vue).includes('nip'), false);
  assert.equal(JSON.stringify(vue).includes('jeton'), false);
});
