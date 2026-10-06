// Tests du mode démo (décision D92) : les règles pures de worker/demo.js, puis les routes /api/demo/* par le vrai
// Worker sur une base SQLite en mémoire (aide-serveur.js) — une séance anonyme, sans identification, qui ne laisse
// aucune trace durable, corrigée exactement comme une séance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINUTE, SECONDE, serveurDeTest } from './aide-serveur.js';
import { DISTINCT_PER_HOUR } from '../worker/acces.js';
import { DEMO_LIFETIME_MS, demoToolChoice, demoView, drawDemoQuestion, expiredBefore, isDemoExpired, isDemoQuestionValid } from '../worker/demo.js';
import { emptyCounters } from '../worker/seance.js';
import { eligibleTools } from '../site/js/progression.js';
import { aleaAGraine, lireFichier } from './aide.js';

const M10 = 'm10-tournage-vc';
const HEURE = 60 * MINUTE;
const CAMILLE = { exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };
const m10 = await lireFichier('exercices/m10-tournage-vc.json');

// Un exercice d'un seul outil à deux réussites, avec des restrictions (SPEC §10) : la démo doit les respecter.
const ESSAI = {
  id: 'essai-percage', titre: 'Essai — perçage', version: 'r1', champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'],
  outils: [{ id: 'foret_fractionnaire', reussites_requises: 2, dimensions: ['Ø 1/4 po'], materiaux_outil: ['Acier rapide'], groupes: ['P - Acier non allié'] }],
};
function serveurAvecEssai(options = {}) {
  const serveur = serveurDeTest(options);
  serveur.publierExercice(ESSAI);
  return serveur;
}

// Commence une démo ; retourne { jeton, demo }.
async function commencerDemo(serveur, exercice = M10, outil = null, entetes = {}) {
  const { status, corps } = await serveur.appel('POST', '/api/demo/creation', { corps: { exercice, outil }, entetes });
  assert.equal(status, 200, JSON.stringify(corps));
  return corps;
}

// Fait corriger la question en attente d'une démo, juste ou fausse, après la cadence.
async function repondreDemo(serveur, jeton, juste, exercice = M10) {
  serveur.avancer(11 * SECONDE);
  const bonnes = await serveur.bonnesReponsesDemo(jeton);
  return serveur.appel('POST', '/api/demo/correction', { jeton, corps: { exercice, saisies: juste ? bonnes : { ...bonnes, vc: '1' } } });
}

const compte = (serveur, table) => serveur.db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

// --- Les règles pures (worker/demo.js) ------------------------------------------------------------------------------

test('demoToolChoice : null, absent ou vide → au hasard ; un outil de l’exercice → son identifiant ; autre chose → undefined (400)', () => {
  const exercise = { outils: [{ id: 'mclnr', reussites_requises: 1 }] };
  for (const value of [null, undefined, '']) assert.equal(demoToolChoice(value, exercise), null);
  assert.equal(demoToolChoice('mclnr', exercise), 'mclnr');
  for (const value of ['foret', 42, {}, ['mclnr']]) assert.equal(demoToolChoice(value, exercise), undefined);
});

test('isDemoExpired et expiredBefore : 24 h après la dernière activité, pas avant', () => {
  const demo = { derniere_activite: '2026-10-06T10:00:00.000Z' };
  assert.equal(DEMO_LIFETIME_MS, 24 * HEURE);
  assert.equal(isDemoExpired(demo, new Date('2026-10-07T09:59:59.999Z')), false);
  assert.equal(isDemoExpired(demo, new Date('2026-10-07T10:00:00.000Z')), true);
  assert.equal(expiredBefore(new Date('2026-10-07T10:00:00.000Z')), '2026-10-06T10:00:00.000Z');
});

test('drawDemoQuestion et isDemoQuestionValid : au hasard parmi les outils à évaluer, parmi tous à 100 % ; sur l’outil choisi avec les restrictions ; la question en attente vaut sauf pour un autre outil choisi', () => {
  const serveur = serveurAvecEssai();
  const data = serveur.catalogue(M10);
  const exercise = { id: M10, titre: m10.titre, version: '1', champs_evalues: m10.champs_evalues, outils: m10.outils.map(({ id, reussites_requises }) => ({ id, reussites_requises })) };
  const random = aleaAGraine(7);
  // Au hasard : les mêmes outils admissibles qu'une séance.
  const counters = { reussites: { mclnr: 1, mvlnr: 3 }, totalReussies: 4 };
  const eligible = eligibleTools(exercise, data, { exerciceId: M10, ...counters }).map((tool) => tool.id);
  for (let i = 0; i < 30; i += 1) assert.ok(eligible.includes(drawDemoQuestion(counters, exercise, data, random, null).tool.id));
  assert.equal(eligible.includes('mclnr'), false);
  // À 100 % : tous les outils, et jamais null.
  const full = { reussites: Object.fromEntries(exercise.outils.map((entry) => [entry.id, entry.reussites_requises])), totalReussies: 14 };
  assert.deepEqual(eligibleTools(exercise, data, { exerciceId: M10, ...full }), []);
  const drawn = new Set();
  for (let i = 0; i < 200; i += 1) drawn.add(drawDemoQuestion(full, exercise, data, random, null).tool.id);
  assert.deepEqual([...drawn].sort(), exercise.outils.map((entry) => entry.id).sort());
  // L'outil choisi, même terminé.
  for (let i = 0; i < 10; i += 1) assert.equal(drawDemoQuestion(full, exercise, data, random, 'mclnr').tool.id, 'mclnr');
  // Les restrictions de l'exercice s'appliquent à l'outil choisi (l'essai : une dimension, une matière, un groupe).
  const essaiData = serveur.catalogue(ESSAI.id);
  const essai = { id: ESSAI.id, titre: ESSAI.titre, version: '1', champs_evalues: ESSAI.champs_evalues, outils: [{ id: 'foret_fractionnaire', reussites_requises: 2 }] };
  for (let i = 0; i < 10; i += 1) {
    const question = drawDemoQuestion(emptyCounters(), essai, essaiData, random, 'foret_fractionnaire');
    assert.deepEqual([question.dimension.label, question.toolMaterial.label, question.material.iso, question.material.materiau], ['Ø 1/4 po', 'Acier rapide', 'P', 'Acier non allié']);
  }
  // La validité de la question en attente.
  const question = drawDemoQuestion(counters, exercise, data, random, 'sdtmr');
  assert.equal(isDemoQuestionValid(question, exercise, data, null), true); // « Au hasard » la garde
  assert.equal(isDemoQuestionValid(question, exercise, data, 'sdtmr'), true);
  assert.equal(isDemoQuestionValid(question, exercise, data, 'mclnr'), false); // un autre outil choisi : on en tire une de celui-là
  assert.equal(isDemoQuestionValid(null, exercise, data, null), false);
  assert.equal(isDemoQuestionValid(question, { ...exercise, outils: exercise.outils.filter((entry) => entry.id !== 'sdtmr') }, data, null), false);
  const bar = drawDemoQuestion(counters, exercise, data, random, 'barre_a_aleser');
  assert.ok(bar.bar);
  assert.equal(isDemoQuestionValid({ ...bar, bar: null }, exercise, data, null), false); // D25
});

test('demoView : la même progression et la même question qu’une séance, sans identité ; l’outil choisi ; « reussie » à 100 %', () => {
  const serveur = serveurDeTest();
  const data = serveur.catalogue(M10);
  const exercise = { id: M10, titre: m10.titre, version: '1', champs_evalues: m10.champs_evalues, outils: m10.outils.map(({ id, reussites_requises }) => ({ id, reussites_requises })) };
  const question = drawDemoQuestion(emptyCounters(), exercise, data, aleaAGraine(3), null);
  const demo = { compteurs: { reussites: { mclnr: 1 }, totalReussies: 1 }, question_courante: question, outil_choisi: null, derniere_correction: null };
  const view = demoView(demo, exercise, data, { now: new Date('2026-10-06T10:00:00.000Z') });
  assert.equal(view.demo, true);
  assert.equal('etudiant' in view, false);
  assert.deepEqual(view.exercice, { id: M10, titre: m10.titre, version: '1' });
  assert.equal(view.outil_choisi, null);
  assert.equal(view.attendre_s, 0);
  assert.equal(view.reussie, false);
  assert.deepEqual(view.progression.outils.map((outil) => [outil.id, outil.reussites, outil.requises]).slice(0, 2), [['mclnr', 1, 1], ['mvlnr', 0, 3]]);
  assert.deepEqual([view.progression.outils_termines, view.progression.total_reussies], [1, 1]);
  assert.equal(view.question.identifiant, question.displayId);
  assert.equal(JSON.stringify(view).includes('vc_pi_min'), false); // rien de ce qui est à trouver ne part
  const full = { reussites: Object.fromEntries(exercise.outils.map((entry) => [entry.id, entry.reussites_requises])), totalReussies: 20 };
  assert.equal(demoView({ ...demo, compteurs: full, outil_choisi: 'sdtmr' }, exercise, data).reussie, true);
  assert.equal(demoView({ ...demo, compteurs: full, outil_choisi: 'sdtmr' }, exercise, data).outil_choisi, 'sdtmr');
  // Un autre outil choisi que celui de la question en attente : la vue ne la montre pas (la route en tire une autre).
  assert.equal(demoView({ ...demo, outil_choisi: question.tool.id === 'sdtmr' ? 'mclnr' : 'sdtmr' }, exercise, data).question, null);
});

// --- Les routes /api/demo/* ---------------------------------------------------------------------------------------

test('démo (D92) : POST /api/demo/creation sans identification → un jeton et la démo, sa première question tirée, la progression de l’exercice ; rien dans seances', async () => {
  const serveur = serveurDeTest();
  const { jeton, demo } = await commencerDemo(serveur);
  assert.match(jeton, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(demo.demo, true);
  assert.equal('etudiant' in demo, false);
  assert.deepEqual(demo.exercice, { id: M10, titre: m10.titre, version: '1' });
  assert.equal(demo.outil_choisi, null);
  assert.equal(demo.reussie, false);
  assert.equal(demo.attendre_s, 0);
  assert.deepEqual(demo.progression.outils.map((outil) => outil.id), m10.outils.map((outil) => outil.id));
  assert.deepEqual([demo.progression.outils_termines, demo.progression.total_reussies], [0, 0]);
  assert.ok(demo.question && demo.question.identifiant);
  assert.deepEqual(demo.question.champs.map((champ) => champ.evalue), [true, false, false, false, false]);
  assert.equal(JSON.stringify(demo).includes('reponses_test'), false);
  // L'état est en base, sans donnée personnelle, et nulle part ailleurs.
  const ligne = await serveur.demo(jeton);
  assert.equal(ligne.exercice_id, M10);
  assert.equal(ligne.outil_choisi, null);
  assert.deepEqual(Object.keys(ligne), ['id', 'jeton_hache', 'exercice_id', 'version_id', 'outil_choisi', 'compteurs', 'question_courante', 'derniere_correction', 'creee_le', 'derniere_activite']);
  assert.equal(ligne.jeton_hache.includes(jeton), false);
  assert.deepEqual([compte(serveur, 'seances'), compte(serveur, 'corrections'), compte(serveur, 'attestations'), compte(serveur, 'demos')], [0, 0, 0, 1]);
  // La même question revient tant qu'elle n'est pas corrigée.
  const { corps } = await serveur.appel('POST', '/api/demo/question', { jeton, corps: { exercice: M10 } });
  assert.deepEqual(corps.demo.question, demo.question);
});

test('démo : la correction est celle d’une séance — juste puis fausse, compteurs, calcul en une ligne, cadence de 10 s, la question suivante toujours ; rien dans corrections ni attestations', async () => {
  const serveur = serveurDeTest();
  const { jeton, demo } = await commencerDemo(serveur);
  const outil = demo.question.outil.id;
  const requises = demo.progression.outils.find((entry) => entry.id === outil).requises;

  const juste = await repondreDemo(serveur, jeton, true);
  assert.equal(juste.status, 200, JSON.stringify(juste.corps));
  assert.deepEqual(Object.keys(juste.corps).sort(), ['correction', 'demo']);
  assert.equal(juste.corps.correction.reussie, true);
  assert.deepEqual(juste.corps.correction.outil, { id: outil, nom: demo.progression.outils.find((entry) => entry.id === outil).nom, avant: 0, apres: 1 });
  assert.deepEqual(juste.corps.correction.champs.map((champ) => [champ.champ, champ.evalue, champ.ok]), [['vc', true, true], ['feedPerTooth', false, true], ['rpm', false, true], ['feedPerRev', false, true], ['feedRate', false, true]]);
  assert.equal(juste.corps.demo.progression.outils.find((entry) => entry.id === outil).reussites, Math.min(1, requises));
  assert.equal(juste.corps.demo.progression.total_reussies, 1);
  assert.ok(juste.corps.demo.question, 'la question suivante est tirée');
  assert.equal(juste.corps.demo.attendre_s, 10);

  // La cadence : une seconde correction tout de suite → 429 ; rien ne change.
  const tropTot = await serveur.appel('POST', '/api/demo/correction', { jeton, corps: { exercice: M10, saisies: await serveur.bonnesReponsesDemo(jeton) } });
  assert.deepEqual([tropTot.status, tropTot.corps.attendre_s], [429, 10]);

  // Une mauvaise réponse : le compteur de l'outil retombe à zéro, le calcul et l'écart sont ceux d'une séance.
  const faux = await repondreDemo(serveur, jeton, false);
  assert.equal(faux.status, 200);
  assert.equal(faux.corps.correction.reussie, false);
  const vc = faux.corps.correction.champs.find((champ) => champ.champ === 'vc');
  assert.deepEqual([vc.ok, vc.saisie, typeof vc.ecart_pct, vc.calcul], [false, '1', 'number', null]);
  const touche = faux.corps.correction.outil.id;
  assert.equal(faux.corps.demo.progression.outils.find((entry) => entry.id === touche).reussites, 0);
  assert.equal(faux.corps.demo.progression.total_reussies, 1);
  assert.ok(faux.corps.demo.question);
  // Aucune trace durable.
  assert.deepEqual([compte(serveur, 'seances'), compte(serveur, 'corrections'), compte(serveur, 'attestations'), compte(serveur, 'journal_enseignant')], [0, 0, 0, 0]);
});

test('démo : les saisies sont jugées comme dans une séance — un calcul dans la case (D82), une saisie illisible', async () => {
  const serveur = serveurAvecEssai();
  const { jeton } = await commencerDemo(serveur, ESSAI.id);
  serveur.avancer(11 * SECONDE);
  const bonnes = await serveur.bonnesReponsesDemo(jeton);
  const { status, corps } = await serveur.appel('POST', '/api/demo/correction', { jeton, corps: { exercice: ESSAI.id, saisies: { ...bonnes, vc: `${bonnes.vc}*2/2`, rpm: 'abc' } } });
  assert.equal(status, 200, JSON.stringify(corps));
  const vc = corps.correction.champs.find((champ) => champ.champ === 'vc');
  assert.deepEqual([vc.ok, vc.expression.texte, vc.expression.valeur], [true, `${bonnes.vc} × 2 / 2`, bonnes.vc]);
  const rpm = corps.correction.champs.find((champ) => champ.champ === 'rpm');
  assert.deepEqual([rpm.ok, rpm.ecart_pct], [false, null]);
  assert.equal(corps.correction.reussie, false);
});

test('démo : l’outil choisi — à la création, chaque question est de cet outil, avec les restrictions de l’exercice ; changer d’outil remplace la question en attente, « Au hasard » la garde ; hors de l’exercice → 400', async () => {
  const serveur = serveurAvecEssai();
  const { jeton, demo } = await commencerDemo(serveur, ESSAI.id, 'foret_fractionnaire');
  assert.equal(demo.outil_choisi, 'foret_fractionnaire');
  assert.equal(demo.question.outil.id, 'foret_fractionnaire');
  assert.deepEqual([demo.question.dimension, demo.question.outil.materiau, demo.question.materiau.iso], ['Ø 1/4 po', 'Acier rapide', 'P']);

  const m = serveurDeTest();
  const premiere = await commencerDemo(m, M10, 'sdtmr');
  for (let i = 0; i < 3; i += 1) {
    assert.equal(premiere.demo.question.outil.id, 'sdtmr');
    const { corps } = await repondreDemo(m, premiere.jeton, i % 2 === 0);
    premiere.demo = corps.demo;
    assert.equal(corps.demo.question.outil.id, 'sdtmr');
  }
  // Un autre outil : la question en attente est remplacée, rien n'est compté.
  const avant = premiere.demo.progression.total_reussies;
  const change = await m.appel('POST', '/api/demo/outil', { jeton: premiere.jeton, corps: { exercice: M10, outil: 'mclnr' } });
  assert.equal(change.status, 200, JSON.stringify(change.corps));
  assert.deepEqual([change.corps.demo.outil_choisi, change.corps.demo.question.outil.id, change.corps.demo.progression.total_reussies], ['mclnr', 'mclnr', avant]);
  // « Au hasard » garde la question en attente.
  const hasard = await m.appel('POST', '/api/demo/outil', { jeton: premiere.jeton, corps: { exercice: M10, outil: null } });
  assert.deepEqual([hasard.corps.demo.outil_choisi, hasard.corps.demo.question], [null, change.corps.demo.question]);
  // Le même outil que la question en attente : elle reste.
  const meme = await m.appel('POST', '/api/demo/outil', { jeton: premiere.jeton, corps: { exercice: M10, outil: 'mclnr' } });
  assert.deepEqual(meme.corps.demo.question, change.corps.demo.question);
  // Un outil qui n'est pas dans l'exercice : 400, rien ne change.
  for (const outil of ['foret_fractionnaire', 42, 'x']) {
    const refus = await m.appel('POST', '/api/demo/outil', { jeton: premiere.jeton, corps: { exercice: M10, outil } });
    assert.deepEqual([refus.status, refus.corps.erreur], [400, "Cet outil n'est pas dans l'exercice."], String(outil));
  }
  assert.equal((await m.appel('POST', '/api/demo/creation', { corps: { exercice: M10, outil: 'foret_fractionnaire' } })).status, 400);
  assert.deepEqual((await m.appel('POST', '/api/demo/question', { jeton: premiere.jeton, corps: { exercice: M10 } })).corps.demo.question, change.corps.demo.question);
});

test('démo : à 100 %, « reussie » et les questions continuent parmi tous les outils ; les compteurs continuent, un échec fait redescendre', async () => {
  const serveur = serveurAvecEssai();
  const { jeton } = await commencerDemo(serveur, ESSAI.id);
  let etat;
  for (let i = 0; i < 2; i += 1) {
    const { status, corps } = await repondreDemo(serveur, jeton, true, ESSAI.id);
    assert.equal(status, 200, JSON.stringify(corps));
    etat = corps.demo;
  }
  assert.equal(etat.reussie, true);
  assert.deepEqual([etat.progression.outils_termines, etat.progression.total_reussies], [1, 2]);
  assert.ok(etat.question, 'les questions ne s’arrêtent pas');
  assert.equal(etat.question.outil.id, 'foret_fractionnaire');
  // Encore une bonne réponse : toujours réussie, le total monte, le compteur reste plafonné à l'affichage.
  const encore = (await repondreDemo(serveur, jeton, true, ESSAI.id)).corps.demo;
  assert.deepEqual([encore.reussie, encore.progression.total_reussies, encore.progression.outils[0].reussites], [true, 3, 2]);
  // Un échec : l'outil retombe à zéro, la démo n'est plus « réussie ».
  const echec = (await repondreDemo(serveur, jeton, false, ESSAI.id)).corps.demo;
  assert.deepEqual([echec.reussie, echec.progression.outils_termines, echec.progression.outils[0].reussites, echec.progression.total_reussies], [false, 0, 0, 3]);
  assert.ok(echec.question);
  assert.deepEqual([compte(serveur, 'seances'), compte(serveur, 'corrections'), compte(serveur, 'attestations')], [0, 0, 0]);
});

test('démo : un jeton de démo n’ouvre aucune route de séance (401), un jeton de séance aucune route de démo (401) ; sans jeton → 401 ; mauvais exercice → 401 ; exercice archivé ou inconnu → 400', async () => {
  const serveur = serveurDeTest();
  const { jeton: demo } = await commencerDemo(serveur);
  const { corps: creation } = await serveur.appel('POST', '/api/creation', { corps: CAMILLE });
  const seance = creation.jeton;
  // Les routes d'une séance ne lisent que seances : rien n'y vaut pour une démo.
  const routesSeance = [['GET', `/api/seance?exercice=${M10}`], ['POST', '/api/question'], ['POST', '/api/correction'], ['GET', `/api/attestation?exercice=${M10}`], ['POST', '/api/identite'], ['POST', '/api/deconnexion']];
  for (const [methode, chemin] of routesSeance) {
    const { status } = await serveur.appel(methode, chemin, { jeton: demo, corps: methode === 'POST' ? { ...CAMILLE, saisies: {} } : undefined });
    assert.equal(status, 401, `${methode} ${chemin} avec un jeton de démo`);
  }
  // Les routes de démo ne lisent que demos : rien n'y vaut pour une séance.
  const routesDemo = [['POST', '/api/demo/question'], ['POST', '/api/demo/outil'], ['POST', '/api/demo/correction']];
  for (const [methode, chemin] of routesDemo) {
    assert.equal((await serveur.appel(methode, chemin, { jeton: seance, corps: { exercice: M10, saisies: {}, outil: null } })).status, 401, `${chemin} avec un jeton de séance`);
    assert.equal((await serveur.appel(methode, chemin, { corps: { exercice: M10, saisies: {}, outil: null } })).status, 401, `${chemin} sans jeton`);
    assert.equal((await serveur.appel(methode, chemin, { jeton: demo, corps: { exercice: 'm10-tournage-vc-rpm', saisies: {}, outil: null } })).status, 401, `${chemin} sur un autre exercice`);
  }
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton: seance })).status, 200); // la séance, elle, marche toujours
  assert.equal((await serveur.appel('POST', '/api/demo/question', { jeton: demo, corps: { exercice: M10 } })).status, 200);
  // Un exercice inconnu ou jamais publié, puis archivé : pas de démo.
  assert.equal((await serveur.appel('POST', '/api/demo/creation', { corps: { exercice: 'inconnu' } })).status, 400);
  assert.equal((await serveur.appel('GET', '/api/demo/specimen?exercice=inconnu')).status, 400);
  serveur.db.sqlite.prepare('UPDATE exercices SET archive_le = ? WHERE id = ?').run(serveur.maintenant.toISOString(), M10);
  const archive = await serveur.appel('POST', '/api/demo/creation', { corps: { exercice: M10 } });
  assert.deepEqual([archive.status, archive.corps.erreur], [400, "Cet exercice n'est plus offert."]);
  assert.equal((await serveur.appel('GET', `/api/demo/specimen?exercice=${M10}`)).status, 400);
  assert.equal((await serveur.appel('POST', '/api/demo/question', { jeton: demo, corps: { exercice: M10 } })).status, 200); // la démo commencée continue, comme une séance
});

test('démo : expire 24 h après la dernière activité (401), effacée à la prochaine création ; chaque appel accepté la prolonge ; le jeton ne vaut plus', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencerDemo(serveur);
  serveur.avancer(DEMO_LIFETIME_MS - MINUTE);
  assert.equal((await serveur.appel('POST', '/api/demo/question', { jeton, corps: { exercice: M10 } })).status, 200); // prolongée
  serveur.avancer(DEMO_LIFETIME_MS - MINUTE);
  assert.equal((await serveur.appel('POST', '/api/demo/question', { jeton, corps: { exercice: M10 } })).status, 200);
  serveur.avancer(DEMO_LIFETIME_MS);
  const expiree = await serveur.appel('POST', '/api/demo/question', { jeton, corps: { exercice: M10 } });
  assert.deepEqual([expiree.status, expiree.corps.erreur], [401, "Cette démo n'existe plus : commence-en une autre."]);
  assert.equal((await serveur.appel('POST', '/api/demo/correction', { jeton, corps: { exercice: M10, saisies: {} } })).status, 401);
  assert.equal(compte(serveur, 'demos'), 1); // encore en base, refusée
  const { jeton: autre } = await commencerDemo(serveur);
  assert.equal(compte(serveur, 'demos'), 1); // l'expirée est partie, la neuve est là
  assert.equal(await serveur.demo(jeton), null);
  assert.ok(await serveur.demo(autre));
});

test('démo : n’apparaît pas dans les réussites de /prof ; l’effacement (D46) la compte et l’efface', async () => {
  const serveur = serveurDeTest();
  await commencerDemo(serveur);
  await commencerDemo(serveur, 'm10-tournage-vc-rpm');
  const { corps: connexion } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } });
  assert.equal(connexion.role, 'admin');
  const entetes = { cookie: `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
  assert.deepEqual((await serveur.appel('GET', '/api/prof/seances', { entetes })).corps.seances, []);
  const { corps } = await serveur.appel('POST', '/api/prof/effacement', { corps: { confirmation: 'EFFACER' }, entetes });
  assert.equal(corps.nombres.demos, 2);
  assert.equal(compte(serveur, 'demos'), 0);
  assert.match(serveur.journalEnseignant().at(-1).details, /· 2 démos ·/);
});

test('démo : limite de débit — DISTINCT_PER_HOUR démos commencées par adresse et par heure, puis 429 et un verrou de 10 minutes sur la portée demo seule ; la consultation, la vérification et une autre adresse passent ; l’heure suivante repart', async () => {
  const serveur = serveurDeTest();
  const adresse = { 'cf-connecting-ip': '203.0.113.7' };
  for (let i = 0; i < DISTINCT_PER_HOUR; i += 1) {
    const { status } = await serveur.appel('POST', '/api/demo/creation', { corps: { exercice: M10 }, entetes: adresse });
    assert.equal(status, 200, `démo ${i + 1}`);
  }
  const refus = await serveur.appel('POST', '/api/demo/creation', { corps: { exercice: M10 }, entetes: adresse });
  assert.deepEqual([refus.status, refus.corps.attendre_s], [429, 10 * 60]);
  assert.equal(compte(serveur, 'demos'), DISTINCT_PER_HOUR); // la refusée n'est pas créée
  // Le verrou est celui de la portée demo : l'identification et la vérification des vrais exercices ne sont pas touchées.
  assert.deepEqual((await serveur.appel('POST', '/api/consultation', { corps: { exercice: M10, matricule: '2412345' }, entetes: adresse })).corps, { trouvee: false });
  assert.deepEqual((await serveur.appel('POST', '/api/verification', { corps: { code: 'ABCDE-FGHJK' }, entetes: adresse })).corps, { resultat: 'aucune' });
  assert.deepEqual(serveur.db.sqlite.prepare('SELECT portee FROM verrous').all().map((row) => row.portee), ['demo']);
  // Une autre adresse n'est pas touchée ; le spécimen non plus (il ne commence aucune démo).
  assert.equal((await serveur.appel('POST', '/api/demo/creation', { corps: { exercice: M10 }, entetes: { 'cf-connecting-ip': '198.51.100.9' } })).status, 200);
  assert.equal((await serveur.appel('GET', `/api/demo/specimen?exercice=${M10}`, { entetes: adresse })).status, 200);
  // Pendant le verrou, encore 429 ; après, et dans l'heure suivante, ça repart.
  serveur.avancer(9 * MINUTE);
  assert.equal((await serveur.appel('POST', '/api/demo/creation', { corps: { exercice: M10 }, entetes: adresse })).status, 429);
  serveur.avancer(HEURE);
  assert.equal((await serveur.appel('POST', '/api/demo/creation', { corps: { exercice: M10 }, entetes: adresse })).status, 200);
});

test('démo : mode test (D26) — MODE_TEST=1 sur localhost joint les réponses attendues et lève la cadence ; ailleurs, jamais', async () => {
  const local = serveurDeTest({ hote: 'http://localhost:8787', variables: { MODE_TEST: '1' } });
  const { jeton, demo } = await commencerDemo(local);
  assert.deepEqual(demo.question.reponses_test, { vc: (await local.bonnesReponsesDemo(jeton)).vc });
  for (let i = 0; i < 2; i += 1) {
    const { status, corps } = await local.appel('POST', '/api/demo/correction', { jeton, corps: { exercice: M10, saisies: demo.question.reponses_test } });
    assert.equal(status, 200, JSON.stringify(corps)); // deux corrections coup sur coup : la cadence est levée
    demo.question = corps.demo.question;
  }
  const production = serveurDeTest({ variables: { MODE_TEST: '1' } });
  const { demo: prod } = await commencerDemo(production);
  assert.equal(JSON.stringify(prod).includes('reponses_test'), false);
});

test('démo : la présentation en vigueur de l’exercice (D78) se pose sur la démo — le titre de la barre et la note de l’outil —, jamais sur la correction', async () => {
  const serveur = serveurDeTest();
  const { status } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } });
  assert.equal(status, 200);
  const entetes = { cookie: `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
  const page = (await serveur.appel('GET', `/api/prof/editeur/exercice/presentation?id=${M10}`, { entetes })).corps;
  const presentation = structuredClone(page.presentation);
  presentation.titre = 'Tournage — Démo du titre en vigueur';
  for (const outil of presentation.outils) outil.commentaire = `Note en vigueur (${outil.id})`;
  const applique = await serveur.appel('POST', '/api/prof/editeur/exercice/presentation/appliquer', { corps: { id: M10, revision: page.revision, presentation }, entetes });
  assert.equal(applique.status, 200, JSON.stringify(applique.corps));
  const { jeton, demo } = await commencerDemo(serveur);
  assert.equal(demo.exercice.titre, 'Tournage — Démo du titre en vigueur');
  assert.equal(demo.question.outil.commentaire, `Note en vigueur (${demo.question.outil.id})`);
  const { corps } = await repondreDemo(serveur, jeton, true);
  assert.equal(corps.correction.reussie, true);
  assert.equal(corps.demo.exercice.titre, 'Tournage — Démo du titre en vigueur');
});
