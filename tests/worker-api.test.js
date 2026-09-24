// Tests de l'API du serveur de correction (SPEC §7) : le vrai Worker sur une base SQLite en mémoire
// où les vraies migrations sont appliquées, avec une horloge qu'on avance à la main (aide-serveur.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINUTE, SECONDE, serveurDeTest } from './aide-serveur.js';
import { readFile } from 'node:fs/promises';
import { canonical } from '../worker/attestation.js';
import { signAttestation } from '../worker/crypto.js';
import { lireFichier } from './aide.js';

const M10 = 'm10-tournage-vc';
// Le M10 tel qu'il est semé en base (migration 0005) : la version 1, identique au fichier du dépôt.
const VERSION_1 = '1';
const CAMILLE = { exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };

const m10 = await lireFichier('exercices/m10-tournage-vc.json');
const index = await lireFichier('exercices/index.json');

// Un second exercice, pour les jetons « d'un autre exercice » : cinq champs évalués, un seul outil.
// Publié en base par serveur.publierExercice (D47) : ses restrictions deviennent la copie de l'outil.
const ESSAI = {
  id: 'essai-percage', titre: 'Essai — perçage', version: 'r1', champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'],
  outils: [{ id: 'foret_fractionnaire', reussites_requises: 2, dimensions: ['Ø 1/4 po'], materiaux_outil: ['Acier rapide'], groupes: ['P - Acier non allié'] }],
};
// Un serveur où l'essai est publié à côté des deux M10 semés.
function serveurAvecEssai(options = {}) {
  const serveur = serveurDeTest(options);
  serveur.publierExercice(ESSAI);
  return serveur;
}

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

test('cadence réglable (D39) : CADENCE_S=1 sur localhost → 1 s entre deux corrections ; ailleurs, 10 s', async () => {
  const local = serveurDeTest({ hote: 'http://localhost:8787', variables: { CADENCE_S: '1' } });
  const { jeton } = await commencer(local);
  assert.equal((await local.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: local.bonnesReponses() } })).status, 200);
  const tropTot = await local.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: local.bonnesReponses() } });
  assert.deepEqual([tropTot.status, tropTot.corps.attendre_s], [429, 1]);
  assert.equal((await local.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance.attendre_s, 1);
  local.avancer(SECONDE);
  assert.equal((await local.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: local.bonnesReponses() } })).status, 200);

  const production = serveurDeTest({ variables: { CADENCE_S: '1' } });
  const prod = await commencer(production);
  assert.equal((await production.appel('POST', '/api/correction', { jeton: prod.jeton, corps: { exercice: M10, saisies: production.bonnesReponses() } })).status, 200);
  production.avancer(SECONDE);
  assert.equal((await production.appel('POST', '/api/correction', { jeton: prod.jeton, corps: { exercice: M10, saisies: production.bonnesReponses() } })).corps.attendre_s, 9);
});

test('mode test : MODE_TEST ne figure ni dans wrangler.jsonc ni dans le déploiement ; seulement, en commentaire, dans .dev.vars.exemple', async () => {
  const lire = (chemin) => readFile(new URL(`../${chemin}`, import.meta.url), 'utf8');
  for (const variable of ['MODE_TEST', 'CADENCE_S']) {
    assert.equal((await lire('wrangler.jsonc')).includes(variable), false, `wrangler.jsonc : ${variable}`);
    assert.equal((await lire('.github/workflows/deploy.yml')).includes(variable), false, `deploy.yml : ${variable}`);
    assert.equal((await lire('package.json')).includes(variable), false, `package.json : ${variable}`);
    const actives = (await lire('.dev.vars.exemple')).split(/\r?\n/).filter((ligne) => ligne.includes(variable) && !ligne.trim().startsWith('#'));
    assert.deepEqual(actives, [], `dans le modèle, ${variable} reste en commentaire`);
  }
});

test('test-complet : l’exercice de test, publié depuis son fichier, est servi par le serveur avec ses 29 outils et ses cinq champs à saisir', async () => {
  const serveur = serveurDeTest();
  serveur.publierExercice(await lireFichier('exercices/test-complet.json'));
  const { seance } = await commencer(serveur, { ...CAMILLE, exercice: 'test-complet' });
  assert.equal(seance.progression.outils.length, 29);
  assert.deepEqual(seance.question.champs.map((champ) => champ.evalue), [true, true, true, true, true]);
});

test('exercice « M10 — Tournage : Vc et RPM » (D40) en mode test : 22 questions Vc et N jusqu’à l’attestation, jamais de carbure solide, filetage et barre à aléser rencontrés', async () => {
  const serveur = serveurDeTest(LOCAL);
  const VC_RPM = 'm10-tournage-vc-rpm';
  const { jeton, seance } = await commencer(serveur, { ...CAMILLE, exercice: VC_RPM });
  assert.equal(seance.progression.outils.length, 11);
  assert.deepEqual(seance.question.champs.map((champ) => champ.evalue), [true, false, true, false, false]); // Vc et N à saisir
  assert.deepEqual(Object.keys(seance.question.reponses_test), ['vc', 'rpm']);

  let etat = seance;
  const vus = { materiaux: new Set(), outils: new Set(), filetage: 0, barre: 0 };
  let n = 0;
  while (etat.reussite_le === null) {
    n += 1;
    assert.ok(n <= 22, 'plus de 22 questions');
    vus.materiaux.add(etat.question.outil.materiau);
    vus.outils.add(etat.question.outil.id);
    if (etat.question.outil.operation.startsWith('Filetage')) vus.filetage += 1;
    if (etat.question.outil.id === 'barre_a_aleser') { vus.barre += 1; assert.match(etat.question.outil.barre, /po$/); }
    // Les réponses jointes par le serveur en mode test : la Vc de la table, N calculée (plafond compris).
    const { status, corps } = await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: VC_RPM, saisies: etat.question.reponses_test } });
    assert.equal(status, 200, JSON.stringify(corps));
    assert.equal(corps.correction.reussie, true, `question ${n}`);
    etat = corps.seance;
  }
  assert.equal(n, 22);
  assert.deepEqual([...vus.materiaux].sort(), ['Acier rapide', 'Insert de carbure de tungstène']);
  assert.equal(vus.outils.size, 11);
  assert.equal(vus.filetage, 8); // quatre outils de filetage × deux réussites
  assert.equal(vus.barre, 2);
  assert.equal(etat.progression.total_reussies, 22);
  assert.equal(etat.question, null);

  const { status, corps } = await serveur.appel('GET', `/api/attestation?exercice=${VC_RPM}`, { jeton });
  assert.equal(status, 200, JSON.stringify(corps));
  assert.equal(corps.attestation.exercice.titre, 'M10 — Tournage : Vc et RPM');
  assert.equal(corps.attestation.questions_reussies, 22);
  assert.deepEqual(corps.attestation.outils.map((o) => `${o.reussites}/${o.requises}`), Array(11).fill('2/2'));
  assert.equal(serveur.journal().length, 22);
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
  assert.deepEqual(corps.seance.exercice, { id: M10, titre: m10.titre, version: VERSION_1 });
  assert.equal(corps.seance.question, null); // rien n'est tiré avant POST /api/question
  assert.equal(corps.seance.progression.total_reussies, 0);

  const ligne = serveur.seance();
  assert.equal(ligne.debut, '2026-09-21T13:05:00.000Z');
  assert.equal(ligne.version_exercice, VERSION_1);
  assert.equal(ligne.version_id, serveur.db.sqlite.prepare('SELECT id FROM versions_exercice WHERE exercice_id = ? AND numero = 1').get(M10).id); // épinglée (D47)
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
  const serveur = serveurAvecEssai();
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
  const serveur = serveurAvecEssai();
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
  assert.deepEqual([serveur.seance().reussite_le, serveur.seance().version_exercice, serveur.seance().version_exercice_reussite], [finale.reussite_le, VERSION_1, VERSION_1]);
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

// --- Séance épinglée à sa version (D47) : une publication ne touche pas les séances en cours --------------------

test('séance épinglée (D47) : après la publication d’une version 2, la séance en cours garde la version 1 — même titre, mêmes outils, même question — et une nouvelle séance prend la 2', async () => {
  const serveur = serveurDeTest();
  const { jeton, seance } = await commencer(serveur);
  assert.equal((await repondre(serveur, jeton, true)).status, 200);
  const enAttente = JSON.parse(serveur.seance().question_courante).tool.id;

  // L'enseignant publie la version 2 : l'outil de la question en attente est retiré, un foret est ajouté, le titre change.
  const v2 = { ...m10, titre: 'M10 — Tournage (v2)', outils: [...m10.outils.filter((outil) => outil.id !== enAttente), { id: 'foret_fractionnaire', reussites_requises: 1 }] };
  assert.equal(serveur.publierExercice(v2), 2);

  // Camille continue sur la version 1 : la question en attente vaut toujours, l'outil retiré est toujours là, le titre est l'ancien.
  serveur.avancer(11 * SECONDE);
  const suite = (await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance;
  assert.deepEqual(suite.exercice, { id: M10, titre: m10.titre, version: VERSION_1 });
  assert.equal(suite.question.outil.id, enAttente);
  assert.deepEqual(suite.progression.outils.map((outil) => outil.id), m10.outils.map((outil) => outil.id));
  assert.equal((await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: serveur.bonnesReponses() } })).status, 200);

  // Une nouvelle séance, elle, prend la version 2 ; sa reprise aussi.
  const alex = await commencer(serveur, { ...CAMILLE, prenom: 'Alex', nom: 'Roy', matricule: '2498765' });
  assert.deepEqual(alex.seance.exercice, { id: M10, titre: 'M10 — Tournage (v2)', version: '2' });
  assert.deepEqual(alex.seance.progression.outils.at(-1), { id: 'foret_fractionnaire', nom: 'Foret fractionnaire', operation: 'Perçage', plage: 'Ø 1/64 po à Ø 1 po', reussites: 0, requises: 1 });
  assert.equal(alex.seance.progression.outils.some((outil) => outil.id === enAttente), false);
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, matricule: '2498765' } })).corps.seance.exercice.version, '2');

  // Camille va jusqu'au bout sur la version 1 : la réussite note la version 1.
  let etat = suite;
  for (let n = 0; etat.reussite_le === null; n += 1) {
    assert.ok(n < 20);
    etat = (await repondre(serveur, jeton, true)).corps.seance;
  }
  assert.deepEqual([serveur.seance().version_exercice, serveur.seance().version_exercice_reussite], [VERSION_1, VERSION_1]);
  assert.equal(serveur.attestations()[0].enregistrement.revision, VERSION_1);
  assert.equal(serveur.attestations()[0].enregistrement.exercice.titre, m10.titre);
});

test('séance sans version (créée par l’ancien serveur entre la migration et le déploiement) : elle prend la dernière version publiée et y reste épinglée', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  serveur.db.sqlite.exec('UPDATE seances SET version_id = NULL');
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance.exercice.version, VERSION_1);
  assert.equal(serveur.seance().version_id, serveur.db.sqlite.prepare('SELECT id FROM versions_exercice WHERE exercice_id = ? AND numero = 1').get(M10).id);
  serveur.publierExercice({ ...m10, titre: 'M10 (v2)' });
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance.exercice.version, VERSION_1); // épinglée, désormais
});

test('exercice archivé : plus de nouvelle séance (consultation et création refusées), mais les séances existantes continuent ; la liste de l’accueil ne le montre plus', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  serveur.db.sqlite.prepare('UPDATE exercices SET archive_le = ? WHERE id = ?').run(serveur.maintenant.toISOString(), M10);
  assert.deepEqual(await serveur.appel('POST', '/api/creation', { corps: { ...CAMILLE, matricule: '2498765' } }), { status: 400, corps: { erreur: "Cet exercice n'est plus offert." } });
  assert.equal((await serveur.appel('POST', '/api/consultation', { corps: { exercice: M10, matricule: '2498765' } })).status, 400);
  assert.deepEqual((await serveur.appel('POST', '/api/consultation', { corps: { exercice: M10, matricule: CAMILLE.matricule } })).corps, { trouvee: true, prenom: 'Camille', initiale: 'T' });
  assert.equal((await repondre(serveur, jeton, true)).status, 200);
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).status, 200);
  assert.deepEqual((await serveur.appel('GET', '/api/exercices')).corps.exercices.map((e) => e.id), ['m10-tournage-vc-rpm']);
  assert.equal((await serveur.appel('GET', `/api/exercice?exercice=${M10}`)).corps.archive, true);
});

test('GET /api/exercice et /api/exercices (D47) : la dernière version publiée avec ses copies d’outils et ses tables, ou une version précise ; la liste de l’accueil sans les exercices « liste »: false', async () => {
  const serveur = serveurDeTest();
  const { status, corps } = await serveur.appel('GET', `/api/exercice?exercice=${M10}`);
  assert.equal(status, 200);
  assert.deepEqual([corps.version, corps.archive, corps.exercice.id, corps.exercice.titre, corps.exercice.version], [1, false, M10, m10.titre, VERSION_1]);
  assert.deepEqual(corps.exercice.outils.map((o) => [o.id, o.reussites_requises]), m10.outils.map((o) => [o.id, o.reussites_requises]));
  assert.equal(corps.exercice.outils[0].dimensions.length, 11); // la copie complète du MCLNR
  assert.deepEqual([corps.tables.materiaux.revision, corps.tables.materiaux.materiaux.length, corps.tables.operations.operations.length], ['A2026_r0', 47, 19]);
  assert.equal((await serveur.appel('GET', '/api/exercice?exercice=inconnu')).status, 400);
  assert.equal((await serveur.appel('GET', `/api/exercice?exercice=${M10}&version=9`)).status, 404);
  serveur.publierExercice({ ...m10, titre: 'M10 (v2)' });
  assert.equal((await serveur.appel('GET', `/api/exercice?exercice=${M10}`)).corps.exercice.titre, 'M10 (v2)');
  assert.equal((await serveur.appel('GET', `/api/exercice?exercice=${M10}&version=1`)).corps.exercice.titre, m10.titre);
  serveur.publierExercice({ ...ESSAI, liste: false });
  assert.deepEqual((await serveur.appel('GET', '/api/exercices')).corps.exercices, index.exercices.filter((e) => e.id !== 'test-complet').map((e) => ({ ...e, titre: e.id === M10 ? 'M10 (v2)' : e.titre })));
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
    ancien_code: null, nouveau_code: null,
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
  const serveur = serveurAvecEssai();
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

// Les routes d'action de l'espace professeur, réservées au rôle admin (D44), avec le corps qu'elles attendent en plus de la séance.
const ROUTES_ACTION = [['/api/prof/remise-a-zero', {}], ['/api/prof/reinitialisation-nip', {}], ['/api/prof/suppression', {}], ['/api/prof/effacement', { confirmation: 'EFFACER' }]];

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
  assert.equal(ligne.enregistrement.revision, VERSION_1);
  assert.equal(ligne.enregistrement.questions_reussies, 15);
  assert.equal(ligne.enregistrement.reussite_le, seance.reussite_le);
  assert.equal(ligne.enregistrement.debut, seance.debut);
  assert.deepEqual(ligne.enregistrement.outils.map((o) => [o.id, o.reussites, o.requises]), m10.outils.map((o) => [o.id, o.reussites_requises, o.reussites_requises]));
  assert.deepEqual(ligne.enregistrement.outils[0], { id: 'mclnr', nom: 'MCLNR', plage: '10 mm à 20 mm', operation: 'Chariotage ébauche', reussites: 1, requises: 1 });
  // La liste des questions réussies (D41) : les 15, dans l'ordre, numérotées de 1 à 15.
  assert.equal(ligne.enregistrement.questions.length, 15);
  assert.deepEqual(ligne.enregistrement.questions.map((q) => q.numero), Array.from({ length: 15 }, (_, i) => i + 1));

  const { status, corps } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
  assert.equal(status, 200);
  assert.deepEqual(corps.attestation, ligne.enregistrement);
  assert.equal(corps.code, `${ligne.code.slice(0, 5)}-${ligne.code.slice(5)}`);
  assert.equal(corps.signature, ligne.signature);
  assert.equal(corps.annulee_le, null);
  // Le QR : l'adresse de vérification, absolue, sur l'origine de la requête, l'essentiel en clair.
  assert.ok(corps.url_verification.startsWith('https://quiz.example/verifier?'), corps.url_verification);
  assert.deepEqual(claimsDe(corps.url_verification), {
    exercice: M10, matricule: '2412346', nom: 'Tremblay', prenom: 'Camille', reussite: seance.reussite_le, revision: VERSION_1,
    questions: '15', code: corps.code, signature: ligne.signature,
  });
  // Une seconde ouverture rend la même attestation, sans en créer une autre.
  assert.deepEqual((await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton })).corps, corps);
  assert.equal(serveur.attestations('2412346').length, 1);
});

test('figée : une nouvelle version de l’exercice (outil renommé, dimensions changées, titre, tables) ne change ni l’attestation ni la séance épinglée (D31, D47) ; une nouvelle séance la voit', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await reussir(serveur);
  const { corps: avant } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });

  // L'enseignant publie une version 2 : le MVLNR renommé et réduit à deux dimensions, un nouveau titre, une autre révision des tables.
  const materiaux = await lireFichier('data/materiaux.json');
  const operations = await lireFichier('data/operations.json');
  serveur.db.sqlite.prepare('INSERT INTO tables_reference (id, materiaux, operations, creee_le) VALUES (?, ?, ?, ?)').run('A2027_r0', JSON.stringify({ ...materiaux, revision: 'A2027_r0' }), JSON.stringify(operations), serveur.maintenant.toISOString());
  serveur.db.sqlite.prepare("UPDATE banque_outils SET outil = json_set(outil, '$.nom', 'MVLNR (nouveau)') WHERE id = 'mvlnr'").run();
  serveur.publierExercice({ ...m10, titre: 'M10 — nouveau titre', outils: m10.outils.map((o) => (o.id === 'mvlnr' ? { ...o, dimensions: ['1.000"', '1.500"'] } : o)) }, { tablesId: 'A2027_r0' });
  serveur.avancer(MINUTE);
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).corps.seance.exercice.titre, m10.titre); // épinglée à la version 1
  const alex = await commencer(serveur, { ...CAMILLE, prenom: 'Alex', nom: 'Roy', matricule: '2498765' });
  assert.equal(alex.seance.exercice.titre, 'M10 — nouveau titre');
  assert.deepEqual(alex.seance.progression.outils[1], { id: 'mvlnr', nom: 'MVLNR (nouveau)', operation: 'Chariotage finition', plage: '1.000" à 1.500"', reussites: 0, requises: 3 });

  const { corps: apres } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
  assert.deepEqual(apres, avant);
  assert.equal(apres.attestation.outils[1].nom, 'MVLNR');
  assert.equal(apres.attestation.outils[1].plage, '1.000" à 4.000"');
  assert.equal(apres.attestation.exercice.titre, m10.titre);
  assert.equal(apres.attestation.revision_tables.materiaux, materiaux.revision);
});

test('liste des questions réussies (D41) : la série finale de chaque outil, tirée du journal ; les échecs et les séries rompues n’y sont pas ; chaque ligne dit ce qui a été posé et répondu', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  // Un échec toutes les quatre questions : les séries rompues sortent de la liste, pas du total.
  let etat;
  let n = 0;
  do {
    n += 1;
    etat = (await repondre(serveur, jeton, n % 4 !== 0)).corps.seance;
  } while (etat.reussite_le === null);
  const journal = serveur.journal();
  assert.equal(journal.length, n);
  assert.ok(n > 15);

  const { corps } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
  const record = corps.attestation;
  const { questions } = record;
  assert.equal(questions.length, 15); // une par réussite exigée
  assert.equal(record.questions_reussies, journal.filter((c) => c.reussie).length); // le total, lui, compte tout
  assert.ok(record.questions_reussies >= 15);
  assert.deepEqual(questions.map((q) => q.numero), Array.from({ length: 15 }, (_, i) => i + 1)); // numérotées 1 à n (D43), sans trou
  assert.deepEqual(questions.map((q) => q.horodatage), [...questions.map((q) => q.horodatage)].sort()); // chronologique
  for (const outil of record.outils) {
    const siennes = questions.filter((q) => q.outil_id === outil.id);
    assert.equal(siennes.length, outil.reussites, outil.id);
    const dernierEchec = journal.filter((c) => c.outil_id === outil.id && !c.reussie).map((c) => c.horodatage).sort().at(-1) ?? '';
    assert.ok(siennes.every((q) => q.horodatage > dernierEchec), `${outil.id} : après son dernier échec`);
  }
  // Chaque ligne : ce que le journal a enregistré de la question posée et de la réponse.
  for (const q of questions) {
    const ligne = journal.find((c) => c.horodatage === q.horodatage);
    const question = JSON.parse(ligne.question);
    assert.equal(ligne.reussie, 1);
    assert.equal(q.outil, question.displayId);
    assert.equal(q.materiau_outil, question.toolMaterial.label);
    assert.deepEqual(q.materiau, { classe: question.material.iso, groupe: question.material.groupe, materiau: question.material.materiau, etat: question.material.etat });
    assert.deepEqual(q.reponses, { vc: String(Number(JSON.parse(ligne.reponses).vc)) }); // le M10 n'évalue que Vc ; réponse normalisée (D43)
    assert.equal(q.horodatage, ligne.horodatage);
  }
  assert.ok(questions.some((q) => /^Barre à aléser Ø .+ - Ø alésé: /.test(q.outil)), 'la barre à aléser est nommée avec sa barre');
  // La liste est dans ce que le QR fait vérifier : un enregistrement retouché sur une question ne passe plus.
  assert.equal((await serveur.appel('POST', '/api/verification', { corps: { code: corps.code } })).corps.resultat, 'valide');
  serveur.db.sqlite.exec(`UPDATE attestations SET enregistrement = replace(enregistrement, '"numero":${questions[0].numero},', '"numero":99,')`);
  assert.equal((await serveur.appel('POST', '/api/verification', { corps: { code: corps.code } })).corps.resultat, 'invalide');
});

test('attestation figée avant cette version, sans liste : elle reste telle quelle, se vérifie, et GET /api/attestation la rend sans y toucher', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await reussir(serveur);
  // On remplace l'attestation créée par une « ancienne » : même enregistrement sans « questions », signée par le serveur d'alors.
  const [ligne] = serveur.attestations();
  const { questions: _q, ...ancien } = ligne.enregistrement;
  const signature = await signAttestation('secret-de-test', canonical(ancien));
  serveur.db.sqlite.prepare('UPDATE attestations SET enregistrement = ?, signature = ? WHERE id = ?').run(JSON.stringify(ancien), signature, ligne.id);

  const { corps } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
  assert.deepEqual(corps.attestation, ancien);
  assert.equal('questions' in corps.attestation, false);
  assert.deepEqual((await serveur.appel('POST', '/api/verification', { corps: { code: corps.code } })).corps, { resultat: 'valide', attestation: ancien });
  assert.equal(serveur.attestations().length, 1);
});

test('corriger mon identité après la réussite (D37) : l’attestation est annulée « identité corrigée » et réémise — mêmes résultats, mêmes dates, nouvelle identité, nouveau code ; le journal note les codes', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await reussir(serveur);
  const { corps: avant } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
  serveur.avancer(MINUTE);

  // Sans changement : rien n'est réémis.
  assert.equal((await serveur.appel('POST', '/api/identite', { jeton, corps: CAMILLE })).status, 200);
  assert.equal(serveur.attestations().length, 1);

  const corrige = await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, prenom: 'Camila', matricule: '2412346' } });
  assert.equal(corrige.status, 200, JSON.stringify(corrige.corps));
  assert.deepEqual(corrige.corps.seance.etudiant, { prenom: 'Camila', nom: 'Tremblay', matricule: '2412346' });

  const { corps: apres } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
  assert.notEqual(apres.code, avant.code);
  assert.notEqual(apres.signature, avant.signature);
  assert.equal(apres.annulee_le, null);
  assert.deepEqual(apres.attestation.etudiant, { prenom: 'Camila', nom: 'Tremblay', matricule: '2412346' });
  const { code: _c1, etudiant: _e1, ...resteAvant } = avant.attestation;
  const { code: _c2, etudiant: _e2, ...resteApres } = apres.attestation;
  assert.equal(apres.attestation.questions.length, 15); // la liste des questions suit, telle quelle
  assert.deepEqual(resteApres, resteAvant); // dates, révisions, questions, outils : identiques
  assert.deepEqual(claimsDe(apres.url_verification).matricule, '2412346');

  // L'ancienne répond « annulée », avec le motif ; la nouvelle est valide.
  const ancienne = await serveur.appel('POST', '/api/verification', { corps: claimsDe(avant.url_verification) });
  assert.deepEqual(ancienne.corps, { resultat: 'annulee', attestation: avant.attestation, annulee_le: serveur.maintenant.toISOString(), motif: 'identite_corrigee' });
  assert.equal((await serveur.appel('POST', '/api/verification', { corps: claimsDe(apres.url_verification) })).corps.resultat, 'valide');
  const lignes = serveur.attestations('2412346');
  assert.equal(lignes.length, 2);
  assert.deepEqual([lignes[0].annulation_motif, lignes[1].annulation_motif, lignes[1].creee_le], ['identite_corrigee', null, serveur.maintenant.toISOString()]);

  // Le journal des corrections d'identité note les deux codes.
  const [correction] = identites(serveur);
  assert.deepEqual([correction.ancien_code, correction.nouveau_code, correction.nouveau_matricule], [lignes[0].code, lignes[1].code, '2412346']);

  // Un matricule déjà pris : rien n'est déplacé, ni réémis.
  await commencer(serveur, { ...CAMILLE, prenom: 'Alex', matricule: '2498765' });
  assert.equal((await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, matricule: '2498765' } })).status, 409);
  assert.equal(serveur.attestations('2412346').length, 2);
  assert.equal(identites(serveur).length, 1);
});

test('collision de code (D42) : à la réussite comme à la réémission, un code déjà pris est retiré ; le matricule pris reste un 409', async () => {
  const PRIS = 'ABCDEFGHJK';
  const serveur = serveurDeTest({ codes: [PRIS, PRIS, 'BCDEFGHJKM', PRIS, 'CDEFGHJKMN'] });
  // Alex réussit d'abord : le premier code tiré, ABCDEFGHJK, est le sien.
  const alex = await reussir(serveur, { ...CAMILLE, prenom: 'Alex', matricule: '2498765' });
  assert.equal(alex.seance.reussite_le !== null, true);
  assert.equal(serveur.attestations('2498765')[0].code, PRIS);

  // Camille réussit : le code tiré est déjà pris → un autre est tiré, sans erreur.
  const { jeton } = await reussir(serveur);
  assert.equal(serveur.attestations().length, 1);
  assert.equal(serveur.attestations()[0].code, 'BCDEFGHJKM');

  // Camille corrige son identité : le code tiré pour la réémission est pris → un autre est tiré ; l'ancienne est annulée.
  const { status, corps } = await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, prenom: 'Camila' } });
  assert.equal(status, 200, JSON.stringify(corps));
  const lignes = serveur.attestations();
  assert.deepEqual(lignes.map((l) => [l.code, l.annulee_le === null]), [['BCDEFGHJKM', false], ['CDEFGHJKMN', true]]);
  assert.equal(lignes[1].enregistrement.etudiant.prenom, 'Camila');
  assert.deepEqual(identites(serveur).map((c) => [c.ancien_code, c.nouveau_code]), [['BCDEFGHJKM', 'CDEFGHJKMN']]);
  assert.equal(serveur.attestations('2498765').length, 1); // celle d'Alex n'a pas bougé

  // Un matricule déjà pris, lui, reste refusé — et rien n'est réémis.
  assert.deepEqual(await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, matricule: '2498765' } }), { status: 409, corps: { erreur: 'Ce matricule a déjà une séance pour cet exercice.' } });
  assert.equal(serveur.attestations().length, 2);
});

test('corriger mon identité avant la réussite : aucune attestation n’est touchée, le journal n’a pas de codes', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  assert.equal((await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, nom: 'Roy' } })).status, 200);
  assert.deepEqual(serveur.attestations(), []);
  assert.deepEqual([identites(serveur)[0].ancien_code, identites(serveur)[0].nouveau_code], [null, null]);
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
  assert.equal(attestation.questions.length, 15); // la liste vient du journal, qui existe depuis le jalon 3
});

test('la réussite constatée sans correction (rien à tirer à la demande de question) crée aussi l’attestation', async () => {
  const serveur = serveurDeTest();
  const { jeton, seance } = await commencer(serveur);
  assert.equal((await repondre(serveur, jeton, true)).status, 200);
  // Les compteurs disent que tout est réussi (comme si l'exercice avait été allégé, D21) : la prochaine demande de question constate la réussite.
  const outil = seance.question.outil.id;
  serveur.db.sqlite.prepare('UPDATE seances SET compteurs = ?').run(JSON.stringify({ reussites: Object.fromEntries(m10.outils.map((o) => [o.id, o.reussites_requises])), totalReussies: 1 }));
  const { corps } = await serveur.appel('POST', '/api/question', { jeton, corps: { exercice: M10 } });
  assert.notEqual(corps.seance.reussite_le, null);
  assert.equal(serveur.attestations().length, 1);
  assert.equal(serveur.attestations()[0].enregistrement.revision, VERSION_1);
  assert.ok(serveur.attestations()[0].enregistrement.outils.some((o) => o.id === outil));
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
  assert.deepEqual(corps, { enseignant: 'admin', role: 'admin', expire_le: new Date(serveur.maintenant.getTime() + 12 * 60 * MINUTE).toISOString() });
  const cookie = serveur.derniersEntetes.get('set-cookie');
  assert.match(cookie, /^prof=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}; Path=\/api\/prof; HttpOnly; Secure; SameSite=Strict; Max-Age=43200$/);
  assert.equal(await essai('mauvaise').then((r) => r.status), 401); // le compte repart : pas de verrou au premier échec
  assert.equal((await essai('cle-admin-de-test')).status, 200);

  const journal = serveur.journalEnseignant();
  assert.deepEqual(journal.filter((l) => l.action === 'connexion_refusee').map((l) => [l.enseignant, l.details]).slice(0, 2), [[null, 'adresse 203.0.113.7, échec 1'], [null, 'adresse 203.0.113.7, échec 2']]);
  assert.equal(journal.filter((l) => l.action === 'connexion_refusee').length, 8);
  assert.deepEqual(journal.filter((l) => l.action === 'connexion').map((l) => [l.enseignant, l.details]), [['admin', 'adresse 198.51.100.9, rôle admin'], ['admin', 'adresse 203.0.113.7, rôle admin'], ['admin', 'adresse 203.0.113.7, rôle admin']]);
  for (const ligne of journal) assert.match(ligne.horodatage, /^2026-/);
});

test('clé de consultation (D44) : ouvre le rôle consultation, dans le cookie et au journal ; mêmes verrous ; sans CLE_CONSULTATION sur le serveur, elle ne vaut rien', async () => {
  const serveur = serveurDeTest();
  const adresse = { 'cf-connecting-ip': '203.0.113.7' };
  const { cookie, corps } = await seConnecter(serveur, 'cle-consultation-de-test');
  assert.deepEqual(corps, { enseignant: 'consultation', role: 'consultation', expire_le: new Date(serveur.maintenant.getTime() + 12 * 60 * MINUTE).toISOString() });
  const seances = await serveur.appel('GET', '/api/prof/seances', { entetes: { cookie: `prof=${cookie}` } });
  assert.deepEqual([seances.status, seances.corps.enseignant, seances.corps.role], [200, 'consultation', 'consultation']);
  assert.deepEqual(serveur.journalEnseignant().map((l) => [l.enseignant, l.action, l.details]), [['consultation', 'connexion', 'adresse 203.0.113.7, rôle consultation']]);

  // Les essais ratés comptent ensemble, quelle que soit la clé visée : cinq échecs, puis le délai.
  for (let n = 1; n <= 5; n += 1) assert.equal((await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'mauvaise' }, entetes: adresse })).status, 401);
  assert.equal((await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-consultation-de-test' }, entetes: adresse })).status, 429);
  assert.equal((await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' }, entetes: adresse })).status, 429);

  // Le rôle consultation lit (tableau, journal des corrections d'identité) et se déconnecte ; chaque
  // route d'action le refuse, côté serveur, sans rien changer ni journaliser.
  const { jeton } = await commencer(serveur);
  await serveur.appel('POST', '/api/deconnexion', { jeton, corps: { exercice: M10 } });
  const seance = serveur.seance();
  assert.equal((await serveur.appel('GET', '/api/prof/identites', { entetes: { cookie: `prof=${cookie}` } })).status, 200);
  for (const [chemin, corpsAction] of ROUTES_ACTION) {
    const refus = await serveur.appel('POST', chemin, { corps: { seance: seance.id, ...corpsAction }, entetes: { cookie: `prof=${cookie}` } });
    assert.deepEqual([refus.status, refus.corps.erreur], [403, "Cette action est réservée à la clé d'administration : la clé de consultation ne fait que lire."], chemin);
  }
  assert.deepEqual(serveur.seance(), seance);
  assert.deepEqual(serveur.journalEnseignant().map((l) => l.action).filter((a) => !a.startsWith('connexion')), []);
  assert.deepEqual((await serveur.appel('POST', '/api/prof/deconnexion', { entetes: { cookie: `prof=${cookie}` } })).corps, { deconnecte: true });

  // Sans clé de consultation configurée, seule la clé d'administration ouvre ; la clé vide n'ouvre jamais.
  const sansConsultation = serveurDeTest({ cleConsultation: null });
  assert.equal((await sansConsultation.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-consultation-de-test' } })).status, 401);
  assert.equal((await sansConsultation.appel('POST', '/api/prof/connexion', { corps: { cle: '' } })).status, 401);
  assert.equal((await sansConsultation.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } })).status, 200);
  const vide = serveurDeTest({ cleConsultation: '' });
  assert.equal((await vide.appel('POST', '/api/prof/connexion', { corps: { cle: '' } })).status, 401);
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
  const routes = [
    ['GET', '/api/prof/seances'], ['POST', '/api/prof/remise-a-zero'], ['POST', '/api/prof/reinitialisation-nip'], ['POST', '/api/prof/suppression'],
    ['POST', '/api/prof/effacement'], ['GET', '/api/prof/identites'],
  ];

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
  const serveur = serveurAvecEssai();
  const { seance: reussie } = await reussir(serveur);
  serveur.avancer(MINUTE);
  const { jeton: alex } = await commencer(serveur, { ...CAMILLE, prenom: 'Alex', nom: 'Roy', matricule: '2498765' });
  assert.equal((await repondre(serveur, alex, true, M10, '2498765')).status, 200);
  await commencer(serveur, { ...CAMILLE, exercice: ESSAI.id, nip: '777777' });
  const { cookie } = await seConnecter(serveur);

  const { status, corps } = await serveur.appel('GET', '/api/prof/seances', { entetes: { cookie: `prof=${cookie}` } });
  assert.equal(status, 200);
  assert.equal(corps.enseignant, 'admin');
  assert.deepEqual(corps.exercices, [...index.exercices.filter((e) => e.id !== 'test-complet'), { id: ESSAI.id, titre: ESSAI.titre }].sort((a, b) => a.titre.localeCompare(b.titre, 'fr')));
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
  assert.deepEqual(verification.corps, { resultat: 'annulee', attestation: attestation.attestation, annulee_le: serveur.maintenant.toISOString(), motif: 'remise_a_zero' });
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

test('réinitialisation du NIP (D38) : le verrou tombe, le prochain NIP présenté devient le nouveau, la progression reste, l’action est journalisée', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await commencer(serveur);
  assert.equal((await repondre(serveur, jeton, true)).status, 200);
  for (let essai = 1; essai <= 5; essai += 1) await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, nip: `000${essai}` } });
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).status, 429); // verrouillée : elle a oublié son NIP
  const { cookie } = await seConnecter(serveur);
  const avant = serveur.seance();

  serveur.avancer(MINUTE);
  assert.deepEqual((await serveur.appel('POST', '/api/prof/reinitialisation-nip', { corps: { seance: avant.id }, entetes: { cookie: `prof=${cookie}` } })).corps, { nip_reinitialise: true, seance: avant.id });
  const apres = serveur.seance();
  assert.deepEqual([apres.nip_hache, apres.essais_nip, apres.essais_nip_debut, apres.verrou_nip_jusqua], [null, 0, null, null]);
  assert.deepEqual([apres.compteurs, apres.question_courante, apres.jeton_hache], [avant.compteurs, avant.question_courante, avant.jeton_hache]);

  // Le NIP présenté à la reprise devient le nouveau ; l'ancien ne vaut plus.
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, nip: '999999' } })).status, 200);
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: CAMILLE })).status, 401);
  assert.equal((await serveur.appel('POST', '/api/reprise', { corps: { ...CAMILLE, nip: '999999' } })).corps.seance.progression.total_reussies, 1);

  const [action] = serveur.journalEnseignant().filter((l) => l.action === 'reinitialisation_nip');
  assert.deepEqual([action.enseignant, action.seance_id, action.details], ['admin', avant.id, `${M10} · 2412345 · Camille Tremblay`]);
  assert.equal((await serveur.appel('POST', '/api/prof/reinitialisation-nip', { corps: { seance: 999 }, entetes: { cookie: `prof=${cookie}` } })).status, 404);
});

test('suppression d’une séance (D45) : la séance, son journal et ses corrections d’identité disparaissent ; ses attestations restent, l’attestation en cours annulée « séance supprimée » avec la date, la vérification le dit ; journalisée ; l’étudiant peut recommencer', async () => {
  const serveur = serveurDeTest();
  const { jeton } = await reussir(serveur);
  const { corps: premiere } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
  serveur.avancer(MINUTE);
  assert.equal((await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, prenom: 'Camila' } })).status, 200); // annule et réémet (D37) : deux attestations
  const { corps: seconde } = await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton });
  const avant = serveur.seance();
  const { cookie } = await seConnecter(serveur);
  const entetes = { cookie: `prof=${cookie}` };
  serveur.avancer(MINUTE);

  assert.deepEqual(await serveur.appel('POST', '/api/prof/suppression', { corps: { seance: avant.id }, entetes }), { status: 200, corps: { supprimee: true, seance: avant.id } });

  // La séance, son journal des corrections et ses corrections d'identité ont disparu ; le jeton ne vaut plus rien.
  const compte = (table) => serveur.db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  assert.deepEqual([compte('seances'), compte('corrections'), compte('corrections_identite')], [0, 0, 0]);
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 401);
  assert.deepEqual((await serveur.appel('POST', '/api/consultation', { corps: { exercice: M10, matricule: '2412345' } })).corps, { trouvee: false });
  assert.equal((await serveur.appel('GET', '/api/prof/seances', { entetes })).corps.seances.length, 0);

  // Les attestations restent, sans séance : celle en cours est annulée « séance supprimée » ; celle déjà annulée garde son motif et sa date.
  const attestations = serveur.db.sqlite.prepare('SELECT * FROM attestations ORDER BY id').all().map((row) => ({ ...row, enregistrement: JSON.parse(row.enregistrement) }));
  assert.deepEqual(attestations.map((a) => [a.seance_id, a.annulation_motif]), [[null, 'identite_corrigee'], [null, 'seance_supprimee']]);
  assert.equal(attestations[1].annulee_le, serveur.maintenant.toISOString());
  assert.deepEqual((await serveur.appel('POST', '/api/verification', { corps: { code: seconde.code } })).corps, { resultat: 'annulee', attestation: seconde.attestation, annulee_le: serveur.maintenant.toISOString(), motif: 'seance_supprimee' });
  assert.deepEqual((await serveur.appel('POST', '/api/verification', { corps: claimsDe(seconde.url_verification) })).corps.resultat, 'annulee');
  const ancienne = (await serveur.appel('POST', '/api/verification', { corps: { code: premiere.code } })).corps;
  assert.deepEqual([ancienne.resultat, ancienne.motif, ancienne.annulee_le], ['annulee', 'identite_corrigee', attestations[0].annulee_le]);

  // L'action est journalisée, sans lien vers la séance (elle n'existe plus) ; les détails la nomment.
  const [action] = serveur.journalEnseignant().filter((l) => l.action === 'suppression');
  assert.deepEqual([action.enseignant, action.seance_id, action.details, action.horodatage], ['admin', null, `${M10} · 2412345 · Camila Tremblay · séance ${avant.id}`, serveur.maintenant.toISOString()]);

  // L'étudiant recommence de zéro ; une nouvelle réussite donne une attestation neuve, les anciennes restent annulées.
  const { seance } = await commencer(serveur);
  assert.equal(seance.progression.total_reussies, 0);
  assert.equal(compte('attestations'), 2);
  assert.equal((await serveur.appel('POST', '/api/prof/suppression', { corps: { seance: avant.id }, entetes })).status, 404);
  assert.equal((await serveur.appel('POST', '/api/prof/suppression', { corps: { seance: 'x' }, entetes })).status, 404);
});

test('effacement des données des étudiants (D46) : mot EFFACER exigé ; séances, journaux, corrections d’identité, attestations, compteurs de débit et verrous disparaissent ; le journal des actions reste, détaché et anonymisé, et note les nombres ; les anciens codes répondent « aucune » ; exercices intacts', async () => {
  const serveur = serveurAvecEssai();
  const { jeton } = await reussir(serveur); // 15 corrections, une attestation
  serveur.avancer(MINUTE);
  assert.equal((await serveur.appel('POST', '/api/identite', { jeton, corps: { ...CAMILLE, prenom: 'Camila' } })).status, 200); // une correction d'identité, deux attestations
  const { jeton: alex } = await commencer(serveur, { ...CAMILLE, prenom: 'Alex', nom: 'Roy', matricule: '2498765' });
  assert.equal((await repondre(serveur, alex, false, M10, '2498765')).status, 200); // 16 corrections
  await commencer(serveur, { ...CAMILLE, exercice: ESSAI.id, nip: '777777' }); // trois séances
  const { cookie } = await seConnecter(serveur);
  const entetes = { cookie: `prof=${cookie}` };
  const alexId = serveur.seance('2498765').id;
  assert.equal((await serveur.appel('POST', '/api/prof/remise-a-zero', { corps: { seance: alexId }, entetes })).status, 200); // une ligne du journal liée à une séance
  assert.equal((await serveur.appel('POST', '/api/prof/reinitialisation-nip', { corps: { seance: alexId }, entetes })).status, 200);
  // Des compteurs de débit (deux matricules consultés, un code vérifié) et un verrou (une clé fausse depuis une autre adresse).
  const codes = serveur.attestations().map((a) => a.code);
  for (const matricule of ['2412345', '2498765']) await serveur.appel('POST', '/api/consultation', { corps: { exercice: M10, matricule }, entetes: { 'cf-connecting-ip': '203.0.113.7' } });
  await serveur.appel('POST', '/api/verification', { corps: { code: codes[0] }, entetes: { 'cf-connecting-ip': '203.0.113.7' } });
  assert.equal((await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'mauvaise' }, entetes: { 'cf-connecting-ip': '198.51.100.9' } })).status, 401);
  const compte = (table) => serveur.db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  const comptes = () => [compte('seances'), compte('corrections'), compte('corrections_identite'), compte('attestations'), compte('debit'), compte('verrous')];
  assert.deepEqual(comptes(), [3, 16, 1, 2, 3, 1]);
  const journalAvant = serveur.journalEnseignant();
  assert.deepEqual(journalAvant.map((l) => [l.action, l.seance_id]), [['connexion', null], ['remise_a_zero', alexId], ['reinitialisation_nip', alexId], ['connexion_refusee', null]]);
  assert.equal(journalAvant[1].details, `${M10} · 2498765 · Alex Roy`);

  // Sans le mot exact : 400, rien n'est effacé, rien n'est journalisé.
  for (const corps of [{}, { confirmation: 'effacer' }, { confirmation: ' EFFACER' }, { confirmation: 'OUI' }, { confirmation: 42 }]) {
    const refus = await serveur.appel('POST', '/api/prof/effacement', { corps, entetes });
    assert.deepEqual([refus.status, refus.corps.erreur], [400, 'Pour effacer, la requête doit porter le mot EFFACER.'], JSON.stringify(corps));
  }
  assert.deepEqual(comptes(), [3, 16, 1, 2, 3, 1]);
  assert.deepEqual(serveur.journalEnseignant(), journalAvant);

  serveur.avancer(MINUTE);
  const nombres = { seances: 3, corrections: 16, corrections_identite: 1, attestations: 2, debit: 3, verrous: 1, journal_anonymise: 2 };
  assert.deepEqual(await serveur.appel('POST', '/api/prof/effacement', { corps: { confirmation: 'EFFACER' }, entetes }), { status: 200, corps: { efface: true, nombres } });
  assert.deepEqual(comptes(), [0, 0, 0, 0, 0, 0]);
  // Le journal des actions reste entier, détaché des séances, et ses détails ne nomment plus personne : date, enseignant, action, exercice et nombres restent.
  const journal = serveur.journalEnseignant();
  assert.deepEqual(journal.map((l) => [l.action, l.seance_id, l.enseignant, l.horodatage]), [...journalAvant.map((l) => [l.action, null, l.enseignant, l.horodatage]), ['effacement', null, 'admin', serveur.maintenant.toISOString()]]);
  assert.deepEqual(journal.map((l) => l.details), [
    'adresse 203.0.113.7, rôle admin', `${M10} · — · —`, `${M10} · — · —`, 'adresse 198.51.100.9, échec 1',
    "3 séances · 16 corrections · 1 correction d'identité · 2 attestations · 3 compteurs de débit · 1 verrou · 2 entrées du journal anonymisées",
  ]);
  assert.equal(JSON.stringify(journal).includes('2498765'), false);
  assert.equal(JSON.stringify(journal).includes('Roy'), false);
  for (const code of codes) assert.deepEqual((await serveur.appel('POST', '/api/verification', { corps: { code } })).corps, { resultat: 'aucune' });
  assert.equal((await serveur.appel('GET', `/api/seance?exercice=${M10}`, { jeton })).status, 401);
  assert.deepEqual((await serveur.appel('POST', '/api/consultation', { corps: { exercice: M10, matricule: '2412345' } })).corps, { trouvee: false });

  // Les exercices, la banque et les tables de référence ne sont pas touchés : la liste des exercices est la même (les deux M10 semés et l'essai), et l'étudiant recommence.
  const liste = await serveur.appel('GET', '/api/prof/seances', { entetes });
  assert.deepEqual([liste.corps.seances, liste.corps.exercices.length], [[], 3]);
  assert.deepEqual([compte('exercices'), compte('versions_exercice'), compte('banque_outils'), compte('tables_reference')], [3, 3, 29, 1]);
  const { seance } = await commencer(serveur);
  assert.equal(seance.progression.total_reussies, 0);
  // (Trois compteurs de débit depuis : les deux codes vérifiés et le matricule consulté ci-dessus.)
  assert.deepEqual((await serveur.appel('POST', '/api/prof/effacement', { corps: { confirmation: 'EFFACER' }, entetes })).corps.nombres, { seances: 1, corrections: 0, corrections_identite: 0, attestations: 0, debit: 3, verrous: 0, journal_anonymise: 0 });
  assert.equal(serveur.journalEnseignant().at(-1).details, "1 séance · 0 correction · 0 correction d'identité · 0 attestation · 3 compteurs de débit · 0 verrou · 0 entrée du journal anonymisée");
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
