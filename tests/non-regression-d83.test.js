// Non-régression du chantier « facteurs de vitesse » (décision D83, point 9) : ce qui existait avant le chantier — une
// version de tables sans facteurs, une version d'exercice publiée, une séance, une attestation — donne exactement la
// même question, la même correction, la même ligne de calcul et la même attestation qu'avant, octet pour octet.
//
// Le témoin est tests/instantanes/avant-d83.json : il a été produit par CE scénario avec le code de `main` d'avant le
// chantier (commit 4ffb4bf), puis figé. Le test rejoue le scénario avec le code d'aujourd'hui et compare.
// NE PAS LE RÉGÉNÉRER pour faire passer le test : une différence veut dire que le code change ce qui existe. (Pour le
// produire de nouveau après une décision qui change volontairement la correction : ECRIRE_INSTANTANE=1 npm test.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { computeParameters } from '../site/js/calcul.js';
import { assembleData } from '../site/js/data.js';
import { draftFromExercise, engineExercise, fieldsToGrade, maskedFields } from '../site/js/exercice.js';
import { formatParameters } from '../site/js/format.js';
import { generateQuestion } from '../site/js/question.js';
import { canonical } from '../worker/attestation.js';
import { previewQuestions } from '../worker/editeur.js';
import { correctionView, emptyCounters, gradeQuestion, questionView } from '../worker/seance.js';
import { aleaAGraine, lireFichier } from './aide.js';
import { SECONDE, serveurDeTest } from './aide-serveur.js';

const TEMOIN = new URL('./instantanes/avant-d83.json', import.meta.url);
const EXERCICES = ['m10-tournage-vc', 'm10-tournage-vc-rpm', 'test-complet'];

// --- Le moteur et les vues du serveur, sur les trois exercices du dépôt et le catalogue semé ------------------------
// Pour chaque outil de l'exercice, deux questions tirées avec un aléa à graine : la question telle que le navigateur la
// reçoit (et les réponses du mode test), les valeurs attendues, la correction d'une bonne réponse et d'une mauvaise — donc
// la ligne de calcul de chaque grandeur évaluée, facteur de vitesse compris.
async function vuesDuMoteur() {
  const tables = { materiaux: await lireFichier('data/materiaux.json'), operations: await lireFichier('data/operations.json') };
  const banque = (await lireFichier('data/outils.json')).outils;
  const out = {};
  for (const id of EXERCICES) {
    const fichier = await lireFichier(`exercices/${id}.json`);
    const { exercise, tools } = engineExercise(id, 1, draftFromExercise(fichier, banque));
    const data = assembleData(tables, tools);
    const random = aleaAGraine(83);
    const graded = fieldsToGrade(exercise);
    const questions = [];
    for (const tool of data.outils) {
      for (let n = 0; n < 2; n += 1) {
        const question = generateQuestion(data, [tool], random);
        const attendu = computeParameters(question, data);
        const affiche = formatParameters(attendu);
        const justes = Object.fromEntries(graded.map((field) => [field, affiche[field]]));
        const fausses = Object.fromEntries(graded.map((field) => [field, String(Number(affiche[field]) * 3 + 7)]));
        const corrige = (saisies) => {
          const answers = { vc: '', feedPerTooth: '', rpm: '', feedPerRev: '', feedRate: '', ...saisies };
          const graded_ = gradeQuestion(question, answers, emptyCounters(), exercise, data);
          return correctionView(question, answers, graded_.result, 0, graded_.counters, data, maskedFields(exercise));
        };
        questions.push({
          question,
          attendu,
          vue: questionView(question, exercise, data),
          reponses_test: questionView(question, exercise, data, { testMode: true }).reponses_test,
          correction_juste: corrige(justes),
          correction_fausse: corrige(fausses),
        });
      }
    }
    out[id] = { questions, apercu: previewQuestions(exercise, data, aleaAGraine(7), 10) };
  }
  return out;
}

// --- Le vrai Worker, sur les exercices semés par la migration 0005 (version 1, tables A2026_r0) ---------------------
// Une séance entière de chaque M10 : chaque séance rendue, chaque correction (une mauvaise réponse à la deuxième
// question), puis l'attestation — l'enregistrement, son texte canonique (ce que la signature couvre), la signature et
// l'adresse du QR. Et ce que le navigateur lit pour afficher : l'exercice avec ses tables, la liste de l'accueil, les
// tables d'une version.
async function parLeServeur() {
  const out = {};
  const serveur = serveurDeTest({ codes: ['ABCDEFGHJK', 'MNPQRSTVWX'] });
  for (const [i, exercice] of ['m10-tournage-vc', 'm10-tournage-vc-rpm'].entries()) {
    const etudiant = { exercice, prenom: 'Camille', nom: 'Tremblay', matricule: `241234${i}`, nip: '4821' };
    const creation = await serveur.appel('POST', '/api/creation', { corps: etudiant });
    assert.equal(creation.status, 200, JSON.stringify(creation.corps));
    const { jeton } = creation.corps;
    const etapes = [];
    let seance = (await serveur.appel('POST', '/api/question', { jeton, corps: { exercice } })).corps.seance;
    etapes.push({ seance });
    // Chaque étape : la correction et la séance rendue — entière à la première et à la dernière étape ; entre les deux,
    // sa question et ses compteurs (la progression outil par outil est dans les corrections : avant, après).
    const resume = ({ correction, seance: s }) => (s.reussite_le !== null ? { correction, seance: s } : { correction, question: s.question, exercice: s.exercice, attendre_s: s.attendre_s, outils_termines: s.progression.outils_termines, total_reussies: s.progression.total_reussies });
    for (let n = 0; seance.reussite_le === null; n += 1) {
      serveur.avancer(11 * SECONDE);
      const bonnes = serveur.bonnesReponses(etudiant.matricule, exercice);
      const saisies = n === 1 ? { ...bonnes, vc: '1' } : bonnes;
      const reponse = await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice, saisies } });
      assert.equal(reponse.status, 200, JSON.stringify(reponse.corps));
      etapes.push(resume(reponse.corps));
      seance = reponse.corps.seance;
    }
    const attestation = (await serveur.appel('GET', `/api/attestation?exercice=${exercice}`, { jeton })).corps;
    out[exercice] = {
      etapes,
      attestation,
      texte_signe: canonical(attestation.attestation),
      seance_relue: (await serveur.appel('GET', `/api/seance?exercice=${exercice}`, { jeton })).corps,
    };
    // Ce que le navigateur lit pour afficher : l'exercice et ses copies d'outils ; ses tables, gardées une fois (les
    // deux M10 sont sur A2026_r0).
    const { tables, ...lu } = (await serveur.appel('GET', `/api/exercice?exercice=${exercice}`)).corps;
    out[exercice].exercice = lu;
    if (out.tables_exercice === undefined) out.tables_exercice = tables;
    else assert.deepEqual(tables, out.tables_exercice);
  }
  out.accueil = (await serveur.appel('GET', '/api/exercices')).corps;
  out.tables = (await serveur.appel('GET', '/api/tables?version=A2026_r0')).corps;
  return out;
}

const scenario = async () => JSON.parse(JSON.stringify({ moteur: await vuesDuMoteur(), serveur: await parLeServeur() }));

test('D83, non-régression : questions, corrections, lignes de calcul et attestations d’avant le chantier, à l’identique', async () => {
  const obtenu = await scenario();
  if (process.env.ECRIRE_INSTANTANE === '1') {
    writeFileSync(TEMOIN, `${JSON.stringify(obtenu)}\n`);
    return;
  }
  const temoin = JSON.parse(readFileSync(TEMOIN, 'utf8'));
  // Morceau par morceau, pour qu'un écart se lise : l'exercice, puis la question ou l'étape.
  for (const id of EXERCICES) {
    temoin.moteur[id].questions.forEach((attendue, n) => assert.deepEqual(obtenu.moteur[id].questions[n], attendue, `${id}, question ${n + 1} (${attendue.question.displayId})`));
    assert.equal(obtenu.moteur[id].questions.length, temoin.moteur[id].questions.length);
    assert.deepEqual(obtenu.moteur[id].apercu, temoin.moteur[id].apercu, `${id}, aperçu`);
  }
  for (const id of ['m10-tournage-vc', 'm10-tournage-vc-rpm']) {
    temoin.serveur[id].etapes.forEach((attendue, n) => assert.deepEqual(obtenu.serveur[id].etapes[n], attendue, `${id}, étape ${n + 1}`));
    // L'attestation : octet pour octet — le texte signé, la signature, l'adresse du QR.
    assert.equal(obtenu.serveur[id].texte_signe, temoin.serveur[id].texte_signe, `${id}, texte signé de l'attestation`);
    assert.equal(JSON.stringify(obtenu.serveur[id].attestation), JSON.stringify(temoin.serveur[id].attestation), `${id}, attestation`);
    assert.deepEqual(obtenu.serveur[id].exercice, temoin.serveur[id].exercice, `${id}, GET /api/exercice`);
  }
  assert.deepEqual(obtenu, temoin);
});

test('D83, non-régression : le témoin couvre les lignes de calcul à facteur de vitesse (alésoir, lame à tronçonner, barre à rainurer)', () => {
  const temoin = JSON.parse(readFileSync(TEMOIN, 'utf8'));
  const lignes = temoin.moteur['test-complet'].questions.map((q) => q.correction_fausse.champs.find((c) => c.champ === 'rpm').calcul);
  assert.ok(lignes.some((l) => / × 0\.25( |$)/.test(l)), 'une ligne « × 0.25 »');
  assert.ok(lignes.some((l) => / × 0\.125( |$)/.test(l)), 'une ligne « × 0.125 »');
  assert.ok(temoin.moteur['test-complet'].questions.some((q) => q.vue.outil.fact_vc === 0.25));
  assert.equal(temoin.moteur['test-complet'].questions.length, 58);
});
