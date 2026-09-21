// Tests de l'API du serveur de correction (SPEC §7) : le vrai Worker sur une base SQLite en mémoire
// où les vraies migrations sont appliquées, avec une horloge qu'on avance à la main (aide-serveur.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINUTE, SECONDE, serveurDeTest } from './aide-serveur.js';
import { readFile } from 'node:fs/promises';
import { lireFichier } from './aide.js';

const M10 = 'm10-tournage-vc';
const CAMILLE = { exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };

const m10 = await lireFichier('exercices/m10-tournage-vc.json');
const index = await lireFichier('exercices/index.json');

// Un second exercice, pour les jetons « d'un autre exercice » : cinq champs évalués, un seul outil.
const ESSAI = {
  id: 'essai-percage', titre: 'Essai — perçage', version: 'r1', champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'],
  outils: [{ id: 'foret_fractionnaire', reussites_requises: 2, dimensions: ['Ø 1/4 po'], materiaux_outil: ['Acier rapide'], groupes: ['P - Acier non allié'] }],
};
const DEUX_EXERCICES = {
  'exercices/index.json': { exercices: [...index.exercices, { id: ESSAI.id, titre: ESSAI.titre }] },
  'exercices/essai-percage.json': ESSAI,
};

// Crée la séance de Camille et demande sa première question ; retourne { jeton, seance }.
async function commencer(serveur, etudiant = CAMILLE) {
  const { status, corps } = await serveur.appel('POST', '/api/creation', { corps: etudiant });
  assert.equal(status, 200, JSON.stringify(corps));
  const question = await serveur.appel('POST', '/api/question', { jeton: corps.jeton, corps: { exercice: etudiant.exercice } });
  assert.equal(question.status, 200, JSON.stringify(question.corps));
  return { jeton: corps.jeton, seance: question.corps.seance };
}

// Fait corriger la question en cours, avec la bonne réponse ou une mauvaise, après avoir laissé passer la cadence.
async function repondre(serveur, jeton, juste, exercice = M10, matricule = '2412345') {
  serveur.avancer(11 * SECONDE);
  const bonnes = serveur.bonnesReponses(matricule, exercice);
  return serveur.appel('POST', '/api/correction', { jeton, corps: { exercice, saisies: juste ? bonnes : { ...bonnes, vc: '1' } } });
}

// --- Mode test (D26) : local seulement, et c'est le serveur qui décide --------------------------------------------

const LOCAL = { hote: 'http://localhost:8787', variables: { MODE_TEST: '1' } };

test('mode test : MODE_TEST=1 sur localhost → les réponses attendues accompagnent la question, et la cadence est levée', async () => {
  const serveur = serveurDeTest(LOCAL);
  const { jeton, seance } = await commencer(serveur);
  assert.deepEqual(seance.question.reponses_test, { vc: serveur.bonnesReponses('2412345', M10).vc });
  assert.deepEqual((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance.question.reponses_test, seance.question.reponses_test);

  // Deux corrections coup sur coup : pas de 429 ; la question suivante arrive avec ses réponses.
  for (let i = 0; i < 2; i += 1) {
    const { status, corps } = await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: serveur.bonnesReponses('2412345', M10) } });
    assert.equal(status, 200, JSON.stringify(corps));
    assert.equal(corps.correction.reussie, true);
    assert.deepEqual(corps.seance.question.reponses_test, { vc: serveur.bonnesReponses('2412345', M10).vc });
  }
});

test('mode test : rien de ce qu’envoie le navigateur ne l’active — ni adresse, ni en-tête, ni corps', async () => {
  const cas = [
    ['sans la variable, sur localhost', { hote: 'http://localhost:8787' }],
    ['variable à une autre valeur', { hote: 'http://localhost:8787', variables: { MODE_TEST: 'true' } }],
    ['avec la variable, mais ailleurs que sur le poste (production)', { variables: { MODE_TEST: '1' } }],
  ];
  for (const [nom, options] of cas) {
    const serveur = serveurDeTest(options);
    const { status, corps } = await serveur.appel('POST', '/api/creation?mode_test=1&MODE_TEST=1', { corps: { ...CAMILLE, mode_test: true, MODE_TEST: '1' }, entetes: { 'x-mode-test': '1', host: 'localhost' } });
    assert.equal(status, 200, nom);
    const question = await serveur.appel('POST', '/api/question?mode_test=1', { jeton: corps.jeton, corps: { exercice: M10, mode_test: true, MODE_TEST: '1' }, entetes: { 'x-mode-test': '1' } });
    assert.equal(question.status, 200, nom);
    assert.equal(JSON.stringify(question.corps).includes('reponses_test'), false, nom);
    // Et la cadence tient : une seconde correction aussitôt → 429.
    const saisies = serveur.bonnesReponses('2412345', M10);
    assert.equal((await serveur.appel('POST', '/api/correction', { jeton: corps.jeton, corps: { exercice: M10, saisies } })).status, 200, nom);
    assert.equal((await serveur.appel('POST', '/api/correction', { jeton: corps.jeton, corps: { exercice: M10, saisies: serveur.bonnesReponses('2412345', M10) } })).status, 429, nom);
  }
});

test('mode test : MODE_TEST ne figure ni dans wrangler.jsonc ni dans le déploiement ; seulement, en commentaire, dans .dev.vars.exemple', async () => {
  const lire = (chemin) => readFile(new URL(`../${chemin}`, import.meta.url), 'utf8');
  assert.equal((await lire('wrangler.jsonc')).includes('MODE_TEST'), false, 'wrangler.jsonc');
  assert.equal((await lire('.github/workflows/deploy.yml')).includes('MODE_TEST'), false, 'deploy.yml');
  assert.equal((await lire('package.json')).includes('MODE_TEST'), false, 'package.json');
  const actives = (await lire('.dev.vars.exemple')).split(/\r?\n/).filter((ligne) => ligne.includes('MODE_TEST') && !ligne.trim().startsWith('#'));
  assert.deepEqual(actives, [], 'dans le modèle, MODE_TEST reste en commentaire');
});

test('test-complet : l’exercice de test est servi par le serveur, avec ses 29 outils et ses cinq champs à saisir', async () => {
  const serveur = serveurDeTest();
  const { seance } = await commencer(serveur, { ...CAMILLE, exercice: 'test-complet' });
  assert.equal(seance.progression.outils.length, 29);
  assert.deepEqual(seance.question.champs.map((champ) => champ.evalue), [true, true, true, true, true]);
});

// --- Généralités ---------------------------------------------------------------------------------------

test('GET /api/version, adresse inconnue (404, plus de 501), et le reste aux fichiers du site', async () => {
  const serveur = serveurDeTest();
  assert.match((await serveur.appel('GET', '/api/version')).corps.version, /^\d+\.\d+\.\d+$/);
  for (const [methode, chemin] of [['GET', '/api/creation'], ['POST', '/api/identification'], ['POST', '/api/version'], ['GET', '/api/rapport'], ['GET', '/api/'], ['GET', '/api']]) {
    const { status, corps } = await serveur.appel(methode, chemin);
    assert.equal(status, 404, chemin);
    assert.equal(typeof corps.erreur, 'string');
  }
  assert.deepEqual((await serveur.appel('GET', '/exercices/index.json')).corps, index);
});

test('requêtes invalides : 400 avec un message en français', async () => {
  const serveur = serveurDeTest();
  const cas = [
    [{ ...CAMILLE, exercice: 'inconnu' }, "Cet exercice n'existe pas."],
    [{ ...CAMILLE, exercice: '../data/outils' }, "Cet exercice n'existe pas."],
    [{ ...CAMILLE, exercice: undefined }, "Cet exercice n'existe pas."],
    [{ ...CAMILLE, matricule: '24123' }, 'Le matricule doit avoir exactement 7 chiffres.'],
    [{ ...CAMILLE, nip: '12' }, 'Le NIP doit avoir de 4 à 6 chiffres.'],
    [{ ...CAMILLE, prenom: ' ' }, 'Le prénom est requis.'],
    [[1, 2], 'Requête illisible : du JSON est attendu.'],
  ];
  for (const [corps, erreur] of cas) {
    assert.deepEqual(await serveur.appel('POST', '/api/creation', { corps }), { status: 400, corps: { erreur } });
  }
  assert.equal(serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM seances').get().n, 0);
});

test('sans CLE_SECRETE : erreur 500 sans détail, et aucune séance créée', async () => {
  const serveur = serveurDeTest({ secret: '' });
  const erreurs = [];
  const { error } = console;
  console.error = (e) => erreurs.push(e);
  try {
    const { status, corps } = await serveur.appel('POST', '/api/creation', { corps: CAMILLE });
    assert.equal(status, 500);
    assert.equal(corps.erreur, 'Erreur du serveur de correction. Réessaie dans un instant.');
  } finally {
    console.error = error;
  }
  assert.match(erreurs[0].message, /CLE_SECRETE/);
  assert.equal(serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM seances').get().n, 0);
});

// --- Identification --------------------------------------------------------------------------------------

test('création : nouvelle séance, jeton de 43 caractères ; la base ne contient ni le NIP ni le jeton', async () => {
  const serveur = serveurDeTest();
  const { status, corps } = await serveur.appel('POST', '/api/creation', { corps: { ...CAMILLE, prenom: ' Camille ', matricule: ' 2412345' } });
  assert.equal(status, 200);
  assert.match(corps.jeton, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(corps.seance.etudiant, { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' });
  assert.deepEqual(corps.seance.exercice, { id: M10, titre: m10.titre, version: 'r0' });
  assert.equal(corps.seance.question, null); // rien n'est tiré avant POST /api/question
  assert.equal(corps.seance.progression.total_reussies, 0);

  const ligne = serveur.seance();
  assert.equal(ligne.debut, '2026-09-21T13:05:00.000Z');
  assert.equal(ligne.version_exercice, 'r0');
  assert.equal(ligne.jeton_expire_le, '2026-09-21T15:05:00.000Z'); // 2 h
  assert.match(ligne.nip_hache, /^[A-Za-z0-9_-]{43}$/);
  const contenu = JSON.stringify(ligne);
  assert.equal(contenu.includes('4821'), false);
  assert.equal(contenu.includes(corps.jeton), false);
});

test('reprise : matricule + NIP suffisent ; prénom et nom de la création ; la progression et la question reviennent', async () => {
  const serveur = serveurDeTest();
  const { jeton, seance } = await commencer(serveur);
  assert.equal((await repondre(serveur, jeton, true)).status, 200);
  const enCours = (await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance;

  // Sur un autre appareil. Ni prénom ni nom ne sont demandés ; s'il en vient, ils sont ignorés.
  serveur.avancer(5 * MINUTE);
  const reprise = await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, prenom: 'Cam', nom: 'T.' } });
  assert.equal(reprise.status, 200);
  assert.notEqual(reprise.corps.jeton, jeton);
  assert.deepEqual(reprise.corps.seance, enCours);
  assert.deepEqual(reprise.corps.seance.etudiant, { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' });
  assert.equal(reprise.corps.seance.progression.total_reussies, 1);
  assert.notEqual(reprise.corps.seance.question, null);
  assert.notDeepEqual(reprise.corps.seance.question, seance.question); // c'est la 2e question, tirée après la correction

  // Un seul jeton par séance : celui du premier appareil ne vaut plus rien.
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 401);
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton: reprise.corps.jeton })).status, 200);
  assert.equal(serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM seances').get().n, 1);
});

test('deux étudiants, deux séances : le même NIP ne donne pas la même valeur en base', async () => {
  const serveur = serveurDeTest();
  await commencer(serveur);
  await commencer(serveur, { ...CAMILLE, prenom: 'Alex', nom: 'Roy', matricule: '2498765' });
  assert.notEqual(serveur.seance('2412345').nip_hache, serveur.seance('2498765').nip_hache);
});

test('NIP incorrect : 401, la séance n’est ni reprise ni modifiée ; le bon NIP passe ensuite et efface le compte des essais', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  assert.deepEqual(await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, nip: '0000' } }), { status: 401, corps: { erreur: 'NIP incorrect.' } });
  assert.equal(serveur.seance().essais_nip, 1);
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 200); // le jeton en cours reste valide

  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).status, 200);
  assert.deepEqual([serveur.seance().essais_nip, serveur.seance().essais_nip_debut, serveur.seance().verrou_nip_jusqua], [0, null, null]);
});

test('verrou : 5 échecs en 10 minutes → 429 pendant 10 minutes, même avec le bon NIP ; puis tout rentre dans l’ordre', async () => {
  const serveur = serveurDeTest();
  await commencer(serveur);
  for (let essai = 1; essai <= 5; essai += 1) {
    serveur.avancer(20 * SECONDE);
    assert.equal((await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, nip: `000${essai}` } })).status, 401, `essai ${essai}`);
  }
  const verrouille = await serveur.appel('POST', '/api/reprise', { corps: CAMILLE });
  assert.deepEqual(verrouille, { status: 429, corps: { erreur: "Trop d'essais. Attends 10 minutes avant de réessayer." } });

  serveur.avancer(10 * MINUTE - SECONDE);
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).status, 429);
  serveur.avancer(SECONDE);
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).status, 200);
});

test('verrou : des échecs étalés sur plus de 10 minutes ne verrouillent pas ; le verrou d’un étudiant ne touche pas les autres', async () => {
  const serveur = serveurDeTest();
  await commencer(serveur);
  await commencer(serveur, { ...CAMILLE, matricule: '2498765' });
  for (let essai = 0; essai < 8; essai += 1) {
    serveur.avancer(3 * MINUTE);
    assert.equal((await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, nip: '0000' } })).status, 401);
  }
  for (let essai = 0; essai < 6; essai += 1) await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, nip: '1111' } });
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).status, 429);
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, matricule: '2498765' } })).status, 200);
});

test('essais lancés en même temps : ils ne passent pas tous — au plus un est examiné par état lu', async () => {
  const serveur = serveurDeTest();
  await commencer(serveur);
  const essais = await Promise.all(Array.from({ length: 20 }, (_, i) => serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, nip: String(1000 + i) } })));
  const examines = essais.filter((essai) => essai.status === 401).length;
  assert.ok(examines <= 5, `${examines} essais examinés`);
  assert.equal(essais.every((essai) => essai.status === 401 || essai.status === 429), true);
});

test('NIP remis à zéro par l’enseignant (nip_hache nul) : le prochain NIP présenté devient le nouveau', async () => {
  const serveur = serveurDeTest();
  await commencer(serveur);
  serveur.db.sqlite.exec('UPDATE seances SET nip_hache = NULL, jeton_hache = NULL');
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, nip: '135790' } })).status, 200);
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).status, 401); // l'ancien NIP ne vaut plus
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, nip: '135790' } })).status, 200);
});

// --- Jeton -----------------------------------------------------------------------------------------------

test('jeton : absent, inconnu ou mal formé → 401 sur tous les appels protégés', async () => {
  const serveur = serveurDeTest();
  await commencer(serveur);
  const appels = [['GET', `/api/seance?exercice=${M10}`], ['POST', '/api/question'], ['POST', '/api/correction'], ['POST', '/api/deconnexion']];
  for (const jeton of [undefined, 'x'.repeat(43), 'pas un jeton !']) {
    for (const [methode, chemin] of appels) {
      const { status, corps } = await serveur.appel(methode, chemin, { jeton, corps: methode === 'POST' ? { exercice: M10, saisies: {} } : undefined });
      assert.equal(status, 401, `${chemin} avec ${jeton}`);
      assert.equal(corps.erreur, 'Ta séance a expiré : identifie-toi de nouveau.');
    }
  }
});

test('jeton : expire 2 h après la dernière activité ; chaque appel le prolonge', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  for (let i = 0; i < 3; i += 1) {
    serveur.avancer(119 * MINUTE);
    assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 200); // près de 6 h en tout
  }
  serveur.avancer(120 * MINUTE);
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 401);
  assert.equal((await serveur.appel('POST', '/api/question', { jeton, corps: { exercice: M10 } })).status, 401);

  // L'état est sur le serveur : on s'identifie, et la même question attend toujours.
  const avant = serveur.seance().question_courante;
  const reprise = await serveur.appel('POST', '/api/reprise', { corps: CAMILLE });
  assert.equal(reprise.status, 200);
  assert.equal(serveur.seance().question_courante, avant);
});

test('jeton d’un autre exercice → 401 ; chaque exercice a sa séance, son NIP et son jeton', async () => {
  const serveur = serveurDeTest({ remplacements: DEUX_EXERCICES });
  const m10Seance = await commencer(serveur);
  const essai = await commencer(serveur, { ...CAMILLE, exercice: ESSAI.id, nip: '777777' });

  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${ESSAI.id}`, { jeton: m10Seance.jeton })).status, 401);
  assert.equal((await serveur.appel('POST', '/api/question', { jeton: essai.jeton, corps: { exercice: M10 } })).status, 401);
  assert.equal((await serveur.appel('POST', '/api/correction', { jeton: essai.jeton, corps: { exercice: M10, saisies: {} } })).status, 401);
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${ESSAI.id}`, { jeton: essai.jeton })).status, 200);
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton: m10Seance.jeton })).status, 200);
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, exercice: ESSAI.id } })).status, 401); // le NIP du M10 n'est pas celui de l'essai
});

test('changer d’étudiant : le jeton ne vaut plus rien ; la séance, elle, reste', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  assert.deepEqual(await serveur.appel('POST', '/api/deconnexion', { jeton, corps: { exercice: M10 } }), { status: 200, corps: { deconnecte: true } });
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 401);
  assert.equal(serveur.seance().jeton_hache, null);
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).status, 200);
});

// --- Question et correction --------------------------------------------------------------------------------

test('tirage mémorisé : tant qu’elle n’est pas corrigée, c’est la même question qui revient — on ne passe pas une question', async () => {
  const serveur = serveurDeTest();
  const { jeton, seance } = await commencer(serveur);
  assert.ok(m10.outils.some((outil) => outil.id === seance.question.outil.id));
  assert.deepEqual(seance.question.champs.map((champ) => champ.evalue), [true, false, false, false, false]);
  assert.equal(JSON.stringify(seance).includes('vc_pi_min'), false);

  for (let i = 0; i < 5; i += 1) {
    const encore = await serveur.appel('POST', '/api/question', { jeton, corps: { exercice: M10 } });
    assert.deepEqual(encore.corps.seance.question, seance.question);
  }
  assert.deepEqual((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance.question, seance.question);

  // Dix demandes en même temps : une seule question est tirée, tout le monde reçoit celle-là.
  const autre = await serveur.appel('POST', '/api/creation', { corps: { ...CAMILLE, matricule: '2498765' } });
  const tirages = await Promise.all(Array.from({ length: 10 }, () => serveur.appel('POST', '/api/question', { jeton: autre.corps.jeton, corps: { exercice: M10 } })));
  const memorisee = (await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton: autre.corps.jeton })).corps.seance.question;
  for (const tirage of tirages) assert.deepEqual(tirage.corps.seance.question, memorisee);
});

test('correction juste : compteur de l’outil, total, journal, question suivante', async () => {
  const serveur = serveurDeTest();
  const { jeton, seance } = await commencer(serveur);
  const outil = seance.question.outil.id;
  const bonnes = serveur.bonnesReponses();
  const questionEnBase = serveur.seance().question_courante;

  const { status, corps } = await repondre(serveur, jeton, true);
  assert.equal(status, 200);
  assert.equal(corps.correction.reussie, true);
  assert.deepEqual(corps.correction.outil, { id: outil, nom: seance.question.outil.nom, avant: 0, apres: 1 });
  assert.deepEqual(corps.correction.champs[0], { champ: 'vc', evalue: true, ok: true, saisie: bonnes.vc, attendu: bonnes.vc, tolerance: 'exacte', ecart_pct: 0, calcul: null });
  assert.equal(corps.seance.progression.outils.find((o) => o.id === outil).reussites, 1);
  assert.equal(corps.seance.progression.total_reussies, 1);
  assert.notEqual(corps.seance.question, null); // la suivante est déjà tirée et mémorisée

  const [ligne] = serveur.journal();
  assert.equal(serveur.journal().length, 1);
  assert.deepEqual([ligne.outil_id, ligne.reussie, ligne.horodatage, ligne.question], [outil, 1, serveur.maintenant.toISOString(), questionEnBase]);
  assert.equal(JSON.parse(ligne.reponses).vc, bonnes.vc);
  assert.equal(JSON.parse(ligne.resultat).success, true);
  assert.equal(typeof JSON.parse(ligne.resultat).attendu.rpm, 'number');
  assert.equal(serveur.seance().derniere_correction, serveur.maintenant.toISOString());
});

test('correction fausse : remise à zéro de cet outil seulement, total inchangé, journalisée elle aussi', async () => {
  const serveur = serveurDeTest({ remplacements: DEUX_EXERCICES });
  const { jeton } = await commencer(serveur, { ...CAMILLE, exercice: ESSAI.id });
  assert.equal((await repondre(serveur, jeton, true, ESSAI.id)).corps.seance.progression.outils[0].reussites, 1);

  const { status, corps } = await repondre(serveur, jeton, false, ESSAI.id);
  assert.equal(status, 200);
  assert.equal(corps.correction.reussie, false);
  assert.deepEqual(corps.correction.outil, { id: 'foret_fractionnaire', nom: 'Foret fractionnaire', avant: 1, apres: 0 });
  assert.deepEqual(corps.correction.champs.map((champ) => champ.ok), [false, true, true, true, true]);
  assert.equal(corps.correction.champs[0].saisie, '1');
  assert.equal(corps.seance.progression.outils[0].reussites, 0);
  assert.equal(corps.seance.progression.total_reussies, 1);
  assert.equal(corps.seance.reussite_le, null);
  assert.deepEqual(serveur.journal().map((ligne) => ligne.reussie), [1, 0]);
});

test('la correction porte sur la question mémorisée, jamais sur ce qu’envoie le navigateur', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  const enBase = serveur.seance().question_courante;
  serveur.avancer(11 * SECONDE);
  const { status, corps } = await serveur.appel('POST', '/api/correction', {
    jeton,
    corps: { exercice: M10, saisies: { vc: '1' }, question: { tool: { id: 'mclnr' } }, reussie: true, compteurs: { totalReussies: 99 } },
  });
  assert.equal(status, 200);
  assert.equal(corps.correction.reussie, false);
  assert.equal(corps.seance.progression.total_reussies, 0);
  assert.equal(serveur.journal()[0].question, enBase);
});

test('cadence : moins de 10 s après la correction précédente → 429, sans effet sur les compteurs ni sur la question', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  assert.equal((await repondre(serveur, jeton, true)).status, 200);
  const avant = serveur.seance();

  serveur.avancer(4 * SECONDE);
  const tropTot = await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: serveur.bonnesReponses() } });
  assert.deepEqual(tropTot, { status: 429, corps: { erreur: 'Attends encore 6 s avant de faire corriger ta réponse.', attendre_s: 6 } });
  assert.deepEqual([serveur.seance().compteurs, serveur.seance().question_courante, serveur.seance().derniere_correction], [avant.compteurs, avant.question_courante, avant.derniere_correction]);
  assert.equal(serveur.journal().length, 1);

  serveur.avancer(6 * SECONDE);
  assert.equal((await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: serveur.bonnesReponses() } })).status, 200);
  assert.equal(serveur.journal().length, 2);
});

test('deux corrections de la même question en même temps : une seule compte', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  const saisies = serveur.bonnesReponses();
  const reponses = await Promise.all(Array.from({ length: 5 }, () => serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies } })));
  assert.deepEqual(reponses.map((reponse) => reponse.status).sort(), [200, 429, 429, 429, 429]);
  assert.equal(serveur.journal().length, 1);
  assert.equal(JSON.parse(serveur.seance().compteurs).totalReussies, 1);
});

test('complétion : 15 bonnes réponses au M10 → réussite datée, plus de question, plus de correction', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  let derniere;
  for (let n = 1; n <= 15; n += 1) {
    derniere = await repondre(serveur, jeton, true);
    assert.equal(derniere.status, 200);
    assert.equal(derniere.corps.correction.reussie, true, `question ${n}`);
    assert.equal(derniere.corps.seance.reussite_le === null, n < 15, `question ${n}`);
  }
  const finale = derniere.corps.seance;
  assert.equal(finale.reussite_le, serveur.maintenant.toISOString());
  assert.equal(finale.question, null);
  assert.equal(finale.progression.outils_termines, 9);
  assert.equal(finale.progression.total_reussies, 15); // 1 + 3 + 3 + 1 + 1 + 3 + 1 + 1 + 1
  assert.deepEqual([serveur.seance().reussite_le, serveur.seance().version_exercice, serveur.seance().version_exercice_reussite], [finale.reussite_le, 'r0', 'r0']);
  assert.equal(serveur.journal().length, 15);

  serveur.avancer(MINUTE);
  assert.deepEqual((await serveur.appel('POST', '/api/question', { jeton, corps: { exercice: M10 } })).corps.seance, finale);
  assert.deepEqual(await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: {} } }), { status: 409, corps: { erreur: "Aucune question n'attend de correction." } });
  assert.deepEqual((await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).corps.seance, finale); // une réussite se retrouve de n'importe quel appareil
});

test('correction sans question tirée → 409', async () => {
  const serveur = serveurDeTest();
  const { corps } = await serveur.appel('POST', '/api/creation', { corps: CAMILLE });
  assert.equal((await serveur.appel('POST', '/api/correction', { jeton: corps.jeton, corps: { exercice: M10, saisies: { vc: '400' } } })).status, 409);
});

// --- Exercice modifié en cours de session (D21) --------------------------------------------------------------

test('exercice modifié : la séance continue — outil retiré (et sa question), outil ajouté à zéro, version notée à la réussite', async () => {
  const serveur = serveurDeTest();
  const { jeton, seance } = await commencer(serveur);
  assert.equal((await repondre(serveur, jeton, true)).status, 200);
  const reussi = seance.question.outil.id;
  const enAttente = JSON.parse(serveur.seance().question_courante).tool.id;

  // L'enseignant publie la r1 : l'outil de la question en attente est retiré, un foret est ajouté.
  const r1 = { ...m10, version: 'r1', outils: [...m10.outils.filter((outil) => outil.id !== enAttente), { id: 'foret_fractionnaire', reussites_requises: 1 }] };
  serveur.publier({ 'exercices/m10-tournage-vc.json': r1 });

  // Corriger la question d'un outil retiré : refusé ; la question suivante est tirée dans la r1.
  serveur.avancer(11 * SECONDE);
  assert.equal((await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: { vc: '1' } } })).status, 409);
  const suite = (await serveur.appel('POST', '/api/question', { jeton, corps: { exercice: M10 } })).corps.seance;
  assert.equal(suite.exercice.version, 'r1');
  assert.notEqual(suite.question.outil.id, enAttente);
  assert.equal(suite.progression.outils.some((outil) => outil.id === enAttente), false);
  assert.deepEqual(suite.progression.outils.at(-1), { id: 'foret_fractionnaire', nom: 'Foret fractionnaire', reussites: 0, requises: 1 });
  assert.equal(suite.progression.total_reussies, 1); // ce qui est acquis le reste
  if (reussi !== enAttente) assert.equal(suite.progression.outils.find((outil) => outil.id === reussi).reussites, 1);

  let etat = suite;
  for (let n = 0; etat.reussite_le === null; n += 1) {
    assert.ok(n < 20);
    etat = (await repondre(serveur, jeton, true)).corps.seance;
  }
  assert.deepEqual([serveur.seance().version_exercice, serveur.seance().version_exercice_reussite], ['r0', 'r1']);
});

test('exercice allégé au point d’être déjà réussi : la réussite est constatée à la prochaine demande de question', async () => {
  const serveur = serveurDeTest();
  const { jeton, seance } = await commencer(serveur);
  assert.equal((await repondre(serveur, jeton, true)).status, 200);
  const outil = m10.outils.find((entry) => entry.id === seance.question.outil.id);
  serveur.publier({ 'exercices/m10-tournage-vc.json': { ...m10, version: 'r2', outils: [{ ...outil, reussites_requises: 1 }] } });

  // La question en attente ne vaut plus, quel que soit son outil : lui aussi est déjà réussi.
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance.question, null);
  const { corps } = await serveur.appel('POST', '/api/question', { jeton, corps: { exercice: M10 } });
  assert.equal(corps.seance.question, null);
  assert.equal(corps.seance.reussite_le, serveur.maintenant.toISOString());
  assert.equal(corps.seance.progression.outils_termines, 1);
  assert.deepEqual([serveur.seance().version_exercice_reussite, serveur.seance().question_courante], ['r2', null]);
});

// --- Identification en deux temps et correction d'identité (D23) ------------------------------------------------

test('consultation : « aucune séance », puis « séance trouvée » avec le prénom et l’initiale du nom — rien d’autre', async () => {
  const serveur = serveurDeTest();
  const demande = { exercice: M10, matricule: ' 2412345 ' };
  assert.deepEqual(await serveur.appel('POST', '/api/consultation', { corps: demande }), { status: 200, corps: { trouvee: false } });
  await commencer(serveur, { ...CAMILLE, nom: 'élise-Tremblay' });
  assert.deepEqual(await serveur.appel('POST', '/api/consultation', { corps: demande }), { status: 200, corps: { trouvee: true, prenom: 'Camille', initiale: 'É' } });
  assert.deepEqual((await serveur.appel('POST', '/api/consultation', { corps: { exercice: M10, matricule: '2498765' } })).corps, { trouvee: false });

  assert.deepEqual(await serveur.appel('POST', '/api/consultation', { corps: { exercice: M10, matricule: '24123' } }), { status: 400, corps: { erreur: 'Le matricule doit avoir exactement 7 chiffres.' } });
  assert.equal((await serveur.appel('POST', '/api/consultation', { corps: { exercice: 'inconnu', matricule: '2412345' } })).status, 400);
});

test('le serveur ne devine plus : créer une séance qui existe → 409 ; reprendre une séance qui n’existe pas → 404', async () => {
  const serveur = serveurDeTest();
  assert.deepEqual(await serveur.appel('POST', '/api/reprise', { corps: CAMILLE }), { status: 404, corps: { erreur: 'Aucune séance pour ce matricule dans cet exercice.' } });
  await commencer(serveur);
  const avant = serveur.seance();
  assert.deepEqual(await serveur.appel('POST', '/api/creation', { corps: { ...CAMILLE, prenom: 'Intrus', nip: '000000' } }), { status: 409, corps: { erreur: 'Ce matricule a déjà une séance pour cet exercice.' } });
  assert.deepEqual(serveur.seance(), avant); // ni le NIP, ni le jeton, ni le prénom n'ont bougé

  // Trois créations en même temps pour un même matricule : une seule séance, un seul gagnant.
  const ensemble = await Promise.all([1, 2, 3].map((n) => serveur.appel('POST', '/api/creation', { corps: { ...CAMILLE, matricule: '2498765', nip: `111${n}` } })));
  assert.deepEqual(ensemble.map((reponse) => reponse.status).sort(), [200, 409, 409]);
});

test('reprise : requête mal formée → 400, sans compter d’essai de NIP', async () => {
  const serveur = serveurDeTest();
  await commencer(serveur);
  assert.deepEqual(await serveur.appel('POST', '/api/reprise', { corps: { exercice: M10, matricule: '2412345', nip: '12' } }), { status: 400, corps: { erreur: 'Le NIP doit avoir de 4 à 6 chiffres.' } });
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: { exercice: M10, matricule: '2412345' } })).status, 400);
  assert.equal(serveur.seance().essais_nip, 0);
});

const identites = (serveur) => serveur.db.sqlite.prepare('SELECT * FROM corrections_identite ORDER BY id').all().map((row) => ({ ...row }));

test('corriger mon identité : prénom, nom et matricule changent, la séance est déplacée — jamais copiée — et la correction est journalisée', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur, { ...CAMILLE, prenom: 'Camile', matricule: '2412354' });
  assert.equal((await repondre(serveur, jeton, true, M10, '2412354')).status, 200);
  const avant = serveur.seance('2412354');

  serveur.avancer(MINUTE);
  const { status, corps } = await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, prenom: ' Camille ' } });
  assert.equal(status, 200, JSON.stringify(corps));
  assert.deepEqual(corps.seance.etudiant, { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' });
  assert.equal(corps.seance.progression.total_reussies, 1);

  // Même ligne, même journal des corrections, même question en attente ; l'ancien matricule est libre.
  const apres = serveur.seance('2412345');
  assert.deepEqual([apres.id, apres.compteurs, apres.question_courante, apres.debut, apres.jeton_hache], [avant.id, avant.compteurs, avant.question_courante, avant.debut, avant.jeton_hache]);
  assert.equal(serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM seances').get().n, 1);
  assert.equal(serveur.journal()[0].seance_id, apres.id);
  assert.deepEqual((await serveur.appel('POST', '/api/consultation', { corps: { exercice: M10, matricule: '2412354' } })).corps, { trouvee: false });

  assert.deepEqual(identites(serveur), [{
    id: 1, seance_id: apres.id, ancien_prenom: 'Camile', ancien_nom: 'Tremblay', ancien_matricule: '2412354',
    nouveau_prenom: 'Camille', nouveau_nom: 'Tremblay', nouveau_matricule: '2412345', horodatage: serveur.maintenant.toISOString(),
  }]);

  // Le jeton reste valide, et le NIP — haché avec le matricule — vaut toujours, sous le nouveau matricule.
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 200);
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).status, 200);
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, matricule: '2412354' } })).status, 404);
});

test('corriger mon identité : NIP exigé (401, essais comptés, verrou) ; sans jeton → 401 ; rien ne change', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  const avant = serveur.seance();
  assert.equal((await serveur.appel('POST', '/api/identite', { corps: { ...CAMILLE, prenom: 'Autre' } })).status, 401); // sans jeton
  assert.deepEqual(await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, prenom: 'Autre', nip: '0000' } }), { status: 401, corps: { erreur: 'NIP incorrect.' } });
  assert.equal(serveur.seance().essais_nip, 1);
  assert.equal((await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, matricule: '123' } })).status, 400);
  for (let essai = 2; essai <= 5; essai += 1) await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, prenom: 'Autre', nip: '0000' } });
  assert.equal((await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, prenom: 'Autre' } })).status, 429); // verrouillé, même avec le bon NIP
  assert.deepEqual([serveur.seance().prenom, serveur.seance().matricule, serveur.seance().nip_hache], [avant.prenom, avant.matricule, avant.nip_hache]);
  assert.deepEqual(identites(serveur), []);
});

test('corriger mon identité : un matricule qui a déjà une séance pour cet exercice → 409, rien n’est déplacé ni journalisé', async () => {
  const serveur = serveurDeTest({ remplacements: DEUX_EXERCICES });
  const { jeton } = await commencer(serveur);
  await commencer(serveur, { ...CAMILLE, prenom: 'Alex', matricule: '2498765' });
  await commencer(serveur, { ...CAMILLE, exercice: ESSAI.id, matricule: '2455555' });

  assert.deepEqual(await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, matricule: '2498765' } }), { status: 409, corps: { erreur: 'Ce matricule a déjà une séance pour cet exercice.' } });
  assert.equal(serveur.seance('2412345').prenom, 'Camille');
  assert.equal(serveur.seance('2498765').prenom, 'Alex');
  assert.deepEqual(identites(serveur), []);

  // Un matricule pris dans un AUTRE exercice est libre dans celui-ci.
  assert.equal((await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, matricule: '2455555' } })).status, 200);
  assert.equal(serveur.seance('2455555', M10).prenom, 'Camille');
});

test('corriger mon identité : sans changement, rien n’est journalisé ; purger la séance efface aussi ses corrections d’identité', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  assert.equal((await serveur.appel('POST', '/api/identite', { jeton, corps: CAMILLE })).status, 200);
  assert.deepEqual(identites(serveur), []);
  assert.equal((await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, nom: 'Tremblay-Roy' } })).status, 200);
  assert.equal(identites(serveur).length, 1);
  serveur.db.sqlite.exec('DELETE FROM seances');
  assert.deepEqual(identites(serveur), []);
});
