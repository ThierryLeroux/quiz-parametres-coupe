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
  assert.deepEqual(reprise.corps.seance, { ...enCours, attendre_s: 0 }); // 5 minutes plus tard : plus rien à attendre
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

test('attendre_s : la séance renvoyée avec la correction dit combien attendre ; GET /api/seance aussi ; 0 après 10 s', async () => {
  const serveur = serveurDeTest();
  const { jeton, seance } = await commencer(serveur);
  assert.equal(seance.attendre_s, 0);
  const { corps } = await repondre(serveur, jeton, true);
  assert.equal(corps.seance.attendre_s, 10);
  serveur.avancer(4 * SECONDE);
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance.attendre_s, 6);
  serveur.avancer(6 * SECONDE);
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance.attendre_s, 0);
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
  assert.deepEqual((await serveur.appel('POST', '/api/question', { jeton, corps: { exercice: M10 } })).corps.seance, { ...finale, attendre_s: 0 });
  assert.deepEqual(await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: {} } }), { status: 409, corps: { erreur: "Aucune question n'attend de correction." } });
  assert.deepEqual((await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).corps.seance, { ...finale, attendre_s: 0 }); // une réussite se retrouve de n'importe quel appareil
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
  assert.deepEqual(suite.progression.outils.at(-1), { id: 'foret_fractionnaire', nom: 'Foret fractionnaire', operation: 'Perçage', plage: 'Ø 1/64 po à Ø 1 po', reussites: 0, requises: 1 });
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

// =====================================================================================================
// Jalon 5 — attestation signée (D31 à D33), vérification publique, espace professeur (D34, D35),
// limites de débit (D36)
// =====================================================================================================

// Mène la séance d'un étudiant jusqu'à la réussite ; retourne { jeton, seance } avec l'état final.
async function reussir(serveur, etudiant = CAMILLE) {
  const { jeton } = await commencer(serveur, etudiant);
  let etat;
  do {
    etat = (await repondre(serveur, jeton, true, etudiant.exercice, etudiant.matricule)).corps.seance;
  } while (etat.reussite_le === null);
  return { jeton, seance: etat };
}

// Ouvre une séance professeur ; retourne l'en-tête Cookie à renvoyer.
async function seConnecter(serveur, cle = 'cle-admin-de-test', adresse = '203.0.113.7') {
  const { status, corps } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle }, entetes: { 'cf-connecting-ip': adresse } });
  assert.equal(status, 200, JSON.stringify(corps));
  return { cookie: serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1], corps };
}

const claimsDe = (url) => Object.fromEntries(new URL(url).searchParams);

// --- Attestation ---------------------------------------------------------------------------------------------

test('réussite : l’attestation est figée à l’instant de la dernière réussite exigée — code, signature, enregistrement ; GET /api/attestation la rend', async () => {
  const serveur = serveurDeTest();
  const { jeton: pasEncore } = await commencer(serveur);
  assert.equal((await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton: pasEncore })).status, 409);
  assert.deepEqual(serveur.attestations(), []);

  const { jeton, seance } = await reussir(serveur, { ...CAMILLE, matricule: '2412346' });
  const [ligne] = serveur.attestations('2412346');
  assert.equal(serveur.attestations('2412346').length, 1);
  assert.equal(ligne.creee_le, seance.reussite_le);
  assert.equal(ligne.annulee_le, null);
  assert.match(ligne.code, /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{10}$/);
  assert.match(ligne.signature, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(ligne.enregistrement.etudiant, { prenom: 'Camille', nom: 'Tremblay', matricule: '2412346' });
  assert.deepEqual(ligne.enregistrement.exercice, { id: M10, titre: m10.titre });
  assert.equal(ligne.enregistrement.revision, 'r0');
  assert.equal(ligne.enregistrement.questions_reussies, 15);
  assert.equal(ligne.enregistrement.reussite_le, seance.reussite_le);
  assert.equal(ligne.enregistrement.debut, seance.debut);
  assert.deepEqual(ligne.enregistrement.outils.map((o) => [o.id, o.reussites, o.requises]), m10.outils.map((o) => [o.id, o.reussites_requises, o.reussites_requises]));
  assert.deepEqual(ligne.enregistrement.outils[0], { id: 'mclnr', nom: 'MCLNR', plage: '10 mm à 20 mm', operation: 'Chariotage ébauche', reussites: 1, requises: 1 });

  const { status, corps } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
  assert.equal(status, 200);
  assert.deepEqual(corps.attestation, ligne.enregistrement);
  assert.equal(corps.code, `${ligne.code.slice(0, 5)}-${ligne.code.slice(5)}`);
  assert.equal(corps.signature, ligne.signature);
  assert.equal(corps.annulee_le, null);
  // Le QR : l'adresse de vérification, absolue, sur l'origine de la requête, l'essentiel en clair.
  assert.ok(corps.url_verification.startsWith('https://quiz.example/verifier?'), corps.url_verification);
  assert.deepEqual(claimsDe(corps.url_verification), {
    exercice: M10, matricule: '2412346', nom: 'Tremblay', prenom: 'Camille', reussite: seance.reussite_le, revision: 'r0',
    questions: '15', code: corps.code, signature: ligne.signature,
  });
  // Une seconde ouverture rend la même attestation, sans en créer une autre.
  assert.deepEqual((await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton })).corps, corps);
  assert.equal(serveur.attestations('2412346').length, 1);
});

test('figée : ni le catalogue, ni l’exercice, ni une correction d’identité ne changent l’attestation ; l’écran, lui, suit', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await reussir(serveur);
  const { corps: avant } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });

  // L'enseignant renomme un outil, change ses dimensions, retitre l'exercice ; l'étudiant corrige son prénom.
  const outils = await lireFichier('data/outils.json');
  const mvlnr = outils.outils.find((o) => o.id === 'mvlnr');
  mvlnr.nom = 'MVLNR (nouveau)';
  mvlnr.dimensions = mvlnr.dimensions.slice(0, 2);
  serveur.publier({ 'data/outils.json': outils, 'exercices/m10-tournage-vc.json': { ...m10, titre: 'M10 — nouveau titre', version: 'r9' } });
  serveur.avancer(MINUTE);
  const corrige = await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, prenom: 'Camila' } });
  assert.equal(corrige.status, 200);
  assert.equal(corrige.corps.seance.etudiant.prenom, 'Camila');
  assert.equal(corrige.corps.seance.exercice.titre, 'M10 — nouveau titre');

  const { corps: apres } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
  assert.deepEqual(apres, avant);
  assert.equal(apres.attestation.etudiant.prenom, 'Camille');
  assert.equal(apres.attestation.outils[1].nom, 'MVLNR');
  assert.equal(apres.attestation.outils[1].plage, '1.000" à 4.000"');
  assert.equal(apres.attestation.exercice.titre, m10.titre);
});

test('séance réussie avant cette version : l’attestation est créée à la première ouverture, à partir de la progression ; une seule, même à plusieurs', async () => {
  const serveur = serveurDeTest();
  const { seance } = await reussir(serveur);
  serveur.db.sqlite.exec('DELETE FROM attestations');
  serveur.avancer(3 * 24 * 60 * MINUTE); // trois jours plus tard, la nouvelle version est publiée ; l'étudiant reprend sa séance
  const { jeton } = (await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).corps;

  const ouvertures = await Promise.all([1, 2, 3].map(() => serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton })));
  assert.deepEqual(ouvertures.map((o) => o.status), [200, 200, 200]);
  assert.equal(serveur.attestations().length, 1);
  for (const ouverture of ouvertures) assert.deepEqual(ouverture.corps, ouvertures[0].corps);
  const { attestation } = ouvertures[0].corps;
  assert.equal(attestation.reussite_le, seance.reussite_le); // la date de réussite, pas celle de l'ouverture
  assert.equal(attestation.questions_reussies, 15);
  assert.equal(serveur.attestations()[0].creee_le, serveur.maintenant.toISOString());
  assert.deepEqual(attestation.outils.map((o) => o.reussites), m10.outils.map((o) => o.reussites_requises));
});

test('la réussite constatée sans correction (exercice allégé, D21) crée aussi l’attestation', async () => {
  const serveur = serveurDeTest();
  const { jeton, seance } = await commencer(serveur);
  assert.equal((await repondre(serveur, jeton, true)).status, 200);
  const outil = m10.outils.find((entry) => entry.id === seance.question.outil.id);
  serveur.publier({ 'exercices/m10-tournage-vc.json': { ...m10, version: 'r2', outils: [{ ...outil, reussites_requises: 1 }] } });
  const { corps } = await serveur.appel('POST', '/api/question', { jeton, corps: { exercice: M10 } });
  assert.notEqual(corps.seance.reussite_le, null);
  assert.equal(serveur.attestations().length, 1);
  assert.equal(serveur.attestations()[0].enregistrement.revision, 'r2');
  assert.deepEqual(serveur.attestations()[0].enregistrement.outils.map((o) => o.id), [outil.id]);
});

// --- Vérification publique ---------------------------------------------------------------------------------

test('vérification : par l’adresse du QR → valide, avec l’enregistrement complet ; par le code seul → valide ; sans connexion', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await reussir(serveur);
  const { corps: attestation } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });

  const parUrl = await serveur.appel('POST', '/api/verification', { corps: claimsDe(attestation.url_verification) });
  assert.deepEqual(parUrl, { status: 200, corps: { resultat: 'valide', attestation: attestation.attestation } });
  const parCode = await serveur.appel('POST', '/api/verification', { corps: { code: attestation.code.toLowerCase() } });
  assert.deepEqual(parCode, parUrl);
  // Rien de plus que l'attestation imprimée : ni NIP, ni jeton, ni journal, ni identifiant de séance.
  const texte = JSON.stringify(parUrl.corps);
  for (const secret of ['nip', 'jeton', 'seance_id', 'corrections', 'derniere_activite']) assert.equal(texte.includes(secret), false, secret);
});

test('vérification : contenu modifié, signature fausse ou champ manquant → invalide ; enregistrement retouché en base → invalide même par le code ; code inconnu → aucune ; mal formé → 400', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await reussir(serveur);
  const { corps: attestation } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
  const claims = claimsDe(attestation.url_verification);
  const verifier = async (corps) => (await serveur.appel('POST', '/api/verification', { corps })).corps;

  assert.deepEqual(await verifier({ ...claims, nom: 'Tremblai' }), { resultat: 'invalide' });
  assert.deepEqual(await verifier({ ...claims, questions: '99' }), { resultat: 'invalide' });
  assert.deepEqual(await verifier({ ...claims, reussite: '2026-09-21T13:00:00.000Z' }), { resultat: 'invalide' });
  // Le premier caractère est changé : le dernier d'une signature base64url ne peut valoir que A, Q, g ou w.
  assert.deepEqual(await verifier({ ...claims, signature: `${claims.signature[0] === 'A' ? 'B' : 'A'}${claims.signature.slice(1)}` }), { resultat: 'invalide' });
  assert.deepEqual(await verifier({ ...claims, signature: 'x'.repeat(43) }), { resultat: 'invalide' });
  const { signature: _s, ...sansSignature } = claims;
  assert.deepEqual(await verifier(sansSignature), { resultat: 'invalide' }); // des champs sans signature : pas « le code seul »
  assert.deepEqual(await verifier({ code: claims.code, nom: 'Tremblay' }), { resultat: 'invalide' });

  assert.deepEqual(await verifier({ code: 'ABCDE-FGHJK' }), { resultat: 'aucune' });
  assert.deepEqual(await verifier({ ...claims, code: 'ABCDE-FGHJK' }), { resultat: 'aucune' });
  assert.equal((await serveur.appel('POST', '/api/verification', { corps: { code: 'ABC' } })).status, 400);
  assert.equal((await serveur.appel('POST', '/api/verification', { corps: {} })).status, 400);
  assert.equal((await serveur.appel('POST', '/api/verification', { corps: { code: 'ABCDE-FGHJ0' } })).status, 400);

  // Quelqu'un retouche l'enregistrement dans la base : la signature recomposée ne correspond plus.
  serveur.db.sqlite.exec(`UPDATE attestations SET enregistrement = replace(enregistrement, '"questions_reussies":15', '"questions_reussies":16')`);
  assert.deepEqual(await verifier({ code: claims.code }), { resultat: 'invalide' });
  assert.deepEqual(await verifier(claims), { resultat: 'invalide' });
});

// --- Espace professeur ---------------------------------------------------------------------------------------

test('connexion professeur : clé fausse → 401 ; cinq échecs par adresse, puis délai croissant (429) ; journalisés ; la bonne clé → cookie signé, verrou levé', async () => {
  const serveur = serveurDeTest();
  const adresse = { 'cf-connecting-ip': '203.0.113.7' };
  const essai = (cle) => serveur.appel('POST', '/api/prof/connexion', { corps: { cle }, entetes: adresse });

  for (let n = 1; n <= 5; n += 1) assert.deepEqual(await essai('mauvaise'), { status: 401, corps: { erreur: 'Clé incorrecte.' } }, `échec ${n}`);
  assert.deepEqual(await essai('cle-admin-de-test'), { status: 429, corps: { erreur: "Trop d'essais. Attends avant de réessayer.", attendre_s: 60 } });
  serveur.avancer(59 * SECONDE);
  assert.equal((await essai('cle-admin-de-test')).status, 429);
  serveur.avancer(SECONDE);
  assert.equal((await essai('mauvaise')).status, 401); // 6e échec : 2 minutes
  assert.equal((await essai('cle-admin-de-test')).corps.attendre_s, 120);
  serveur.avancer(2 * MINUTE);
  assert.equal((await essai('mauvaise')).status, 401); // 7e : 4 minutes
  assert.equal((await essai('cle-admin-de-test')).corps.attendre_s, 240);
  // Une autre adresse n'est pas touchée.
  assert.equal((await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' }, entetes: { 'cf-connecting-ip': '198.51.100.9' } })).status, 200);

  serveur.avancer(4 * MINUTE);
  const { status, corps } = await essai('cle-admin-de-test');
  assert.equal(status, 200);
  assert.deepEqual(corps, { enseignant: 'admin', expire_le: new Date(serveur.maintenant.getTime() + 12 * 60 * MINUTE).toISOString() });
  const cookie = serveur.derniersEntetes.get('set-cookie');
  assert.match(cookie, /^prof=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}; Path=\/api\/prof; HttpOnly; Secure; SameSite=Strict; Max-Age=43200$/);
  assert.equal(await essai('mauvaise').then((r) => r.status), 401); // le compte repart : pas de verrou au premier échec
  assert.equal((await essai('cle-admin-de-test')).status, 200);

  const journal = serveur.journalEnseignant();
  assert.deepEqual(journal.filter((l) => l.action === 'connexion_refusee').map((l) => [l.enseignant, l.details]).slice(0, 2), [[null, 'adresse 203.0.113.7, échec 1'], [null, 'adresse 203.0.113.7, échec 2']]);
  assert.equal(journal.filter((l) => l.action === 'connexion_refusee').length, 8);
  assert.deepEqual(journal.filter((l) => l.action === 'connexion').map((l) => [l.enseignant, l.details]), [['admin', 'adresse 198.51.100.9'], ['admin', 'adresse 203.0.113.7'], ['admin', 'adresse 203.0.113.7']]);
  for (const ligne of journal) assert.match(ligne.horodatage, /^2026-/);
});

test('connexion professeur : clé mal formée ou absente → 401 comme une clé fausse ; sans CLE_ADMIN sur le serveur → 500', async () => {
  const serveur = serveurDeTest();
  assert.equal((await serveur.appel('POST', '/api/prof/connexion', { corps: {} })).status, 401);
  assert.equal((await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 42 } })).status, 401);
  const sansCle = serveurDeTest({ cleAdmin: '' });
  assert.equal((await sansCle.appel('POST', '/api/prof/connexion', { corps: { cle: '' } })).status, 500);
});

test('aucune route /api/prof/* ne répond sans cookie valide : absent, forgé, signé par un autre secret, expiré après 12 h ; la déconnexion efface le cookie', async () => {
  const serveur = serveurDeTest();
  const { cookie } = await seConnecter(serveur);
  const autre = serveurDeTest({ secret: 'autre-secret' });
  const { cookie: forge } = await seConnecter(autre);
  const routes = [['GET', '/api/prof/seances'], ['POST', '/api/prof/remise-a-zero'], ['GET', '/api/prof/identites']];

  for (const [methode, chemin] of routes) {
    for (const valeur of [undefined, 'n.importe.quoi', `${cookie.split('.')[0]}.${'x'.repeat(43)}`, forge, cookie.split('.')[0]]) {
      const entetes = valeur === undefined ? {} : { cookie: `prof=${valeur}` };
      const { status, corps } = await serveur.appel(methode, chemin, { corps: methode === 'POST' ? { seance: 1 } : undefined, entetes });
      assert.deepEqual([status, corps.erreur], [401, 'Connexion requise.'], `${chemin} avec ${valeur}`);
    }
    assert.notEqual((await serveur.appel(methode, chemin, { corps: methode === 'POST' ? { seance: 1 } : undefined, entetes: { cookie: `prof=${cookie}` } })).status, 401, chemin);
  }

  serveur.avancer(12 * 60 * MINUTE - SECONDE);
  assert.equal((await serveur.appel('GET', '/api/prof/seances', { entetes: { cookie: `prof=${cookie}` } })).status, 200);
  serveur.avancer(SECONDE);
  assert.equal((await serveur.appel('GET', '/api/prof/seances', { entetes: { cookie: `prof=${cookie}` } })).status, 401);

  assert.deepEqual((await serveur.appel('POST', '/api/prof/deconnexion', {})).corps, { deconnecte: true });
  assert.equal(serveur.derniersEntetes.get('set-cookie'), 'prof=; Path=/api/prof; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
});

test('liste des séances : qui, quel exercice, quand, réussie ou en cours, questions réussies, code ; ni NIP, ni jeton, ni question', async () => {
  const serveur = serveurDeTest({ remplacements: DEUX_EXERCICES });
  const { seance: reussie } = await reussir(serveur);
  serveur.avancer(MINUTE);
  const { jeton: alex } = await commencer(serveur, { ...CAMILLE, prenom: 'Alex', nom: 'Roy', matricule: '2498765' });
  assert.equal((await repondre(serveur, alex, true, M10, '2498765')).status, 200);
  await commencer(serveur, { ...CAMILLE, exercice: ESSAI.id, nip: '777777' });
  const { cookie } = await seConnecter(serveur);

  const { status, corps } = await serveur.appel('GET', '/api/prof/seances', { entetes: { cookie: `prof=${cookie}` } });
  assert.equal(status, 200);
  assert.equal(corps.enseignant, 'admin');
  assert.deepEqual(corps.exercices, [...index.exercices, { id: ESSAI.id, titre: ESSAI.titre }]);
  assert.equal(corps.seances.length, 3);
  const camille = corps.seances.find((s) => s.matricule === '2412345' && s.exercice.id === M10);
  assert.deepEqual(Object.keys(camille).sort(), ['code', 'debut', 'derniere_activite', 'exercice', 'id', 'matricule', 'nom', 'prenom', 'questions_reussies', 'reussite_le']);
  assert.deepEqual([camille.prenom, camille.nom, camille.exercice.titre, camille.reussite_le, camille.questions_reussies, camille.debut], ['Camille', 'Tremblay', m10.titre, reussie.reussite_le, 15, reussie.debut]);
  assert.equal(camille.code, (await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton: (await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).corps.jeton })).corps.code);
  const alexRow = corps.seances.find((s) => s.matricule === '2498765');
  assert.deepEqual([alexRow.reussite_le, alexRow.questions_reussies, alexRow.code], [null, 1, null]);
  assert.equal(corps.seances.find((s) => s.exercice.id === ESSAI.id).matricule, '2412345');
  const texte = JSON.stringify(corps);
  for (const secret of ['nip', 'jeton', 'question_courante', 'compteurs']) assert.equal(texte.includes(secret), false, secret);
});

test('remise à zéro : progression à zéro, la séance reste (matricule, NIP, jeton), l’attestation est annulée avec la date, la vérification le dit, l’action est journalisée ; une nouvelle réussite donne un autre code', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await reussir(serveur);
  const { corps: attestation } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
  const avant = serveur.seance();
  const { cookie } = await seConnecter(serveur);
  serveur.avancer(MINUTE);

  assert.deepEqual(await serveur.appel('POST', '/api/prof/remise-a-zero', { corps: { seance: avant.id }, entetes: { cookie: `prof=${cookie}` } }), { status: 200, corps: { remise_a_zero: true, seance: avant.id } });
  const apres = serveur.seance();
  assert.deepEqual([apres.id, apres.matricule, apres.nip_hache, apres.jeton_hache, apres.debut], [avant.id, avant.matricule, avant.nip_hache, avant.jeton_hache, avant.debut]);
  assert.deepEqual([JSON.parse(apres.compteurs), apres.question_courante, apres.reussite_le, apres.version_exercice_reussite, apres.derniere_correction], [{ reussites: {}, totalReussies: 0 }, null, null, null, null]);
  assert.equal(serveur.journal().length, 15); // le journal des corrections reste : c'est de l'histoire

  // L'attestation est annulée, la vérification le dit avec la date.
  assert.equal(serveur.attestations()[0].annulee_le, serveur.maintenant.toISOString());
  const verification = await serveur.appel('POST', '/api/verification', { corps: claimsDe(attestation.url_verification) });
  assert.deepEqual(verification.corps, { resultat: 'annulee', attestation: attestation.attestation, annulee_le: serveur.maintenant.toISOString() });
  assert.equal((await serveur.appel('POST', '/api/verification', { corps: { code: attestation.code } })).corps.resultat, 'annulee');
  assert.equal((await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton })).status, 409); // plus réussie

  const [action] = serveur.journalEnseignant().filter((l) => l.action === 'remise_a_zero');
  assert.deepEqual([action.enseignant, action.seance_id, action.details, action.horodatage], ['admin', avant.id, `${M10} · 2412345 · Camille Tremblay`, serveur.maintenant.toISOString()]);

  // L'étudiant reprend avec le même jeton, depuis le début ; une nouvelle réussite donne une nouvelle attestation.
  const question = await serveur.appel('POST', '/api/question', { jeton, corps: { exercice: M10 } });
  assert.equal(question.corps.seance.progression.total_reussies, 0);
  assert.notEqual(question.corps.seance.question, null);
  let etat;
  do etat = (await repondre(serveur, jeton, true)).corps.seance; while (etat.reussite_le === null);
  assert.equal(serveur.attestations().length, 2);
  const { corps: nouvelle } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
  assert.notEqual(nouvelle.code, attestation.code);
  assert.equal((await serveur.appel('POST', '/api/verification', { corps: { code: nouvelle.code } })).corps.resultat, 'valide');
  assert.equal((await serveur.appel('POST', '/api/verification', { corps: { code: attestation.code } })).corps.resultat, 'annulee');
  assert.equal((await serveur.appel('POST', '/api/prof/remise-a-zero', { corps: { seance: 999 }, entetes: { cookie: `prof=${cookie}` } })).status, 404);
  assert.equal((await serveur.appel('POST', '/api/prof/remise-a-zero', { corps: { seance: 'x' }, entetes: { cookie: `prof=${cookie}` } })).status, 404);
});

test('journal des corrections d’identité : la plus récente en premier, avant/après, matricule actuel et exercice de la séance', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur, { ...CAMILLE, prenom: 'Camile', matricule: '2412354' });
  serveur.avancer(MINUTE);
  assert.equal((await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, prenom: 'Camille', matricule: '2412354' } })).status, 200);
  serveur.avancer(MINUTE);
  assert.equal((await serveur.appel('POST', '/api/identite', { jeton, corps: CAMILLE })).status, 200);
  const { cookie } = await seConnecter(serveur);

  const { status, corps } = await serveur.appel('GET', '/api/prof/identites', { entetes: { cookie: `prof=${cookie}` } });
  assert.equal(status, 200);
  assert.equal(corps.corrections.length, 2);
  const [derniere, premiere] = corps.corrections;
  assert.deepEqual([derniere.ancien_matricule, derniere.nouveau_matricule, derniere.matricule, derniere.exercice_id, derniere.seance_id], ['2412354', '2412345', '2412345', M10, serveur.seance().id]);
  assert.deepEqual([premiere.ancien_prenom, premiere.nouveau_prenom, premiere.ancien_matricule, premiere.nouveau_matricule], ['Camile', 'Camille', '2412354', '2412354']);
  assert.ok(derniere.horodatage > premiere.horodatage);
});

// --- Limites de débit --------------------------------------------------------------------------------------------

test('limite de débit, consultation : 100 matricules distincts par adresse et par heure ; le 101e est refusé et verrouille 10 minutes ; un matricule déjà vu passe ; une autre adresse n’est pas touchée ; l’heure suivante repart', async () => {
  const serveur = serveurDeTest();
  const consulter = (matricule, adresse = '203.0.113.7') => serveur.appel('POST', '/api/consultation', { corps: { exercice: M10, matricule }, entetes: { 'cf-connecting-ip': adresse } });
  serveur.maintenant = new Date('2026-09-21T13:50:00.000Z');

  for (let n = 0; n < 100; n += 1) assert.equal((await consulter(String(2400000 + n))).status, 200, `matricule ${n}`);
  for (let n = 0; n < 100; n += 1) assert.equal((await consulter(String(2400000 + n))).status, 200); // déjà vus : autant de fois qu'on veut
  assert.deepEqual(await consulter('2400100'), { status: 429, corps: { erreur: 'Trop de demandes depuis cette adresse. Réessaie dans quelques minutes.', attendre_s: 600 } });
  assert.equal((await consulter('2400000')).status, 429); // verrouillé, même pour un matricule connu
  assert.equal((await consulter('2400100', '198.51.100.9')).status, 200); // une autre adresse
  assert.equal((await consulter('123')).status, 400); // un matricule mal formé n'est pas compté

  serveur.avancer(10 * MINUTE); // 14:00 : nouvelle tranche horaire
  assert.equal((await consulter('2400101')).status, 200);
  for (let n = 0; n < 99; n += 1) assert.equal((await consulter(String(2500000 + n))).status, 200);
  assert.equal((await consulter('2500099')).status, 429);
  serveur.avancer(10 * MINUTE); // 14:10 : verrou levé, mais toujours 100 valeurs dans la tranche
  assert.equal((await consulter('2400101')).status, 200); // déjà vu
  assert.equal((await consulter('2500099')).status, 429); // nouveau → refusé et verrouillé de nouveau
  assert.equal(serveur.db.sqlite.prepare("SELECT COUNT(*) AS n FROM debit WHERE tranche = '2026-09-21T13'").get().n, 0); // la tranche passée est effacée
});

test('limite de débit, vérification : 100 codes distincts par adresse et par heure, puis 429 ; un code déjà vérifié passe', async () => {
  const serveur = serveurDeTest();
  const verifier = (code) => serveur.appel('POST', '/api/verification', { corps: { code }, entetes: { 'cf-connecting-ip': '203.0.113.7' } });
  const codes = Array.from({ length: 101 }, (_, n) => `AAAAA${String(n).padStart(3, '0').replace(/0/g, 'X').replace(/1/g, 'Y')}ZZ`);
  for (const code of codes.slice(0, 100)) assert.equal((await verifier(code)).status, 200, code);
  assert.equal((await verifier(codes[100])).status, 429);
  serveur.avancer(10 * MINUTE);
  assert.equal((await verifier(codes[0])).status, 200);
  assert.equal((await verifier(codes[100])).status, 429);
});
