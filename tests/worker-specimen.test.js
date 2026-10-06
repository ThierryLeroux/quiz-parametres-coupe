// Tests du spécimen d'attestation du mode démo (décision D92, point 9) : les règles pures de worker/specimen.js
// (le code, la graine, la composition par le vrai moteur, l'adresse du QR), puis GET /api/demo/specimen et la
// vérification d'un spécimen par le vrai Worker — jamais enregistré, signé sous sa propre sous-clé, recomposé à
// partir de l'adresse ; un spécimen ne passe jamais pour une vraie attestation, ni l'inverse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINUTE, SECONDE, serveurDeTest } from './aide-serveur.js';
import { canonical, parseCode } from '../worker/attestation.js';
import { signAttestation, signSpecimen } from '../worker/crypto.js';
import {
  SECONDS_PER_QUESTION, SEED_MAX, SPECIMEN_CODE, SPECIMEN_STUDENT, buildSpecimen, isSpecimenCode, newSeed, readSpecimenClaims, seededRandom,
  specimenClaimsMatch, specimenClaimsOnlyCode, specimenDates, specimenRequest, specimenUrl,
} from '../worker/specimen.js';
import { computeParameters } from '../site/js/calcul.js';
import { formatParameters } from '../site/js/format.js';
import { lireFichier } from './aide.js';

const M10 = 'm10-tournage-vc';
const VC_RPM = 'm10-tournage-vc-rpm';
const CAMILLE = { exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };
const m10 = await lireFichier('exercices/m10-tournage-vc.json');
const vcRpm = await lireFichier('exercices/m10-tournage-vc-rpm.json');
const DATES = { debut: '2026-10-06T13:00:00.000Z', reussite: '2026-10-06T13:11:15.000Z' };

const exerciseOf = (file, version = '1') => ({ id: file.id, titre: file.titre, version, champs_evalues: file.champs_evalues, ...(file.materiaux_outil ? { materiaux_outil: file.materiaux_outil } : {}), outils: file.outils.map(({ id, reussites_requises }) => ({ id, reussites_requises })) });
const claimsDe = (url) => Object.fromEntries(new URL(url).searchParams);

// Mène la séance de Camille jusqu'à la réussite et rend son attestation.
async function vraieAttestation(serveur) {
  const { corps } = await serveur.appel('POST', '/api/creation', { corps: CAMILLE });
  const jeton = corps.jeton;
  let etat = (await serveur.appel('POST', '/api/question', { jeton, corps: { exercice: M10 } })).corps.seance;
  while (etat.reussite_le === null) {
    serveur.avancer(11 * SECONDE);
    etat = (await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: M10, saisies: serveur.bonnesReponses() } })).corps.seance;
  }
  return (await serveur.appel('GET', `/api/attestation?exercice=${M10}`, { jeton })).corps;
}

// --- Les règles pures ---------------------------------------------------------------------------------------------

test('le code d’un spécimen : « SPECI-MEN00 », une forme qu’aucune vraie attestation ne peut avoir ; isSpecimenCode tolère minuscules, espaces et tirets', () => {
  assert.equal(SPECIMEN_CODE, 'SPECIMEN00');
  assert.equal(parseCode(SPECIMEN_CODE), null); // I et 0 ne sont pas dans l'alphabet des codes (D32)
  assert.equal(parseCode('SPECI-MEN00'), null);
  for (const text of ['SPECIMEN00', 'SPECI-MEN00', 'speci-men00', ' speci men00 ', 'SPECI—MEN00'.replace('—', '-')]) assert.equal(isSpecimenCode(text), true, text);
  for (const text of ['SPECIMEN0', 'SPECIMEN000', 'ABCDE-FGHJK', '', null, undefined, 42]) assert.equal(isSpecimenCode(text), false, String(text));
});

test('seededRandom : reproductible, dans [0, 1[ ; newSeed : un entier de 0 à 2^31 − 1 avec l’aléa du serveur', () => {
  const a = seededRandom(123456);
  const b = seededRandom(123456);
  const suite = Array.from({ length: 50 }, () => a());
  assert.deepEqual(Array.from({ length: 50 }, () => b()), suite);
  assert.ok(suite.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(Array.from({ length: 50 }, seededRandom(123457)), suite);
  assert.equal(newSeed(() => 0), 0);
  assert.equal(newSeed(() => 1 - Number.EPSILON), SEED_MAX);
  assert.equal(SEED_MAX, 2147483647);
});

test('specimenDates : réussi à l’instant, commencé 45 s par question plus tôt', () => {
  const now = new Date('2026-10-06T13:11:15.000Z');
  const questions = m10.outils.reduce((sum, outil) => sum + outil.reussites_requises, 0);
  assert.equal(questions, 15);
  assert.equal(SECONDS_PER_QUESTION, 45);
  assert.deepEqual(specimenDates(now, exerciseOf(m10)), { debut: '2026-10-06T13:00:00.000Z', reussite: '2026-10-06T13:11:15.000Z' });
});

test('buildSpecimen : composé par le vrai moteur — identité fictive, chaque outil à ses réussites exigées, autant de questions que de réussites, les bonnes réponses au format d’affichage, horodatages de debut à reussite ; reproductible par la graine', () => {
  const serveur = serveurDeTest();
  const data = serveur.catalogue(M10);
  const exercise = exerciseOf(m10);
  const record = buildSpecimen(exercise, data, { seed: 42, ...DATES });
  assert.equal(record.code, SPECIMEN_CODE);
  assert.equal(record.specimen, true);
  assert.equal(record.graine, 42);
  assert.deepEqual(record.etudiant, SPECIMEN_STUDENT);
  assert.deepEqual(record.exercice, { id: M10, titre: m10.titre });
  assert.equal(record.revision, '1');
  assert.deepEqual(record.revision_tables, { materiaux: 'A2026_r0', operations: 'A2026_r0' });
  assert.deepEqual([record.debut, record.reussite_le], [DATES.debut, DATES.reussite]);
  assert.equal(record.questions_reussies, 15);
  assert.deepEqual(record.outils.map((outil) => [outil.id, outil.reussites, outil.requises]), m10.outils.map((outil) => [outil.id, outil.reussites_requises, outil.reussites_requises]));
  assert.deepEqual(record.outils[0], { id: 'mclnr', nom: 'MCLNR', plage: '10 mm à 20 mm', operation: 'Chariotage ébauche', reussites: 1, requises: 1 });
  assert.equal(record.questions.length, 15);
  assert.deepEqual(record.questions.map((q) => q.numero), Array.from({ length: 15 }, (_, i) => i + 1));
  // Par outil, exactement ses réussites exigées ; chaque question avec sa réponse à la grandeur évaluée (Vc), au format d'affichage.
  for (const outil of m10.outils) assert.equal(record.questions.filter((q) => q.outil_id === outil.id).length, outil.reussites_requises, outil.id);
  for (const q of record.questions) {
    assert.deepEqual(Object.keys(q.reponses), ['vc']);
    assert.match(q.reponses.vc, /^\d+$/);
    assert.ok(q.outil && q.materiau_outil && q.materiau.classe && q.horodatage);
  }
  // Les horodatages montent, de debut (exclu) à reussite (le dernier).
  const stamps = record.questions.map((q) => q.horodatage);
  assert.deepEqual([...stamps].sort(), stamps);
  assert.ok(stamps[0] > DATES.debut);
  assert.equal(stamps.at(-1), DATES.reussite);
  // Reproductible : la même graine redonne le même enregistrement, octet pour octet ; une autre, d'autres questions.
  assert.equal(canonical(buildSpecimen(exercise, data, { seed: 42, ...DATES })), canonical(record));
  assert.notEqual(canonical(buildSpecimen(exercise, data, { seed: 43, ...DATES })), canonical(record));
  assert.notEqual(canonical(buildSpecimen(exercise, data, { seed: 42, debut: DATES.debut, reussite: '2026-10-06T13:12:00.000Z' })), canonical(record));
  assert.notEqual(canonical(buildSpecimen({ ...exercise, titre: 'Autre titre' }, data, { seed: 42, ...DATES })), canonical(record));
  // Un spécimen n'a pas la forme canonique d'une vraie attestation : specimen et graine y sont.
  assert.match(canonical(record), /"graine":42/);
  assert.match(canonical(record), /"specimen":true/);
});

test('buildSpecimen : à deux grandeurs et avec une restriction de matière (D40), les réponses sont celles que la correction attend, pour chaque question', async () => {
  const serveur = serveurDeTest();
  const data = serveur.catalogue(VC_RPM);
  const exercise = exerciseOf(vcRpm);
  for (const seed of [1, 2, 3]) {
    const record = buildSpecimen(exercise, data, { seed, ...DATES });
    assert.equal(record.questions.length, 22);
    for (const q of record.questions) {
      assert.deepEqual(Object.keys(q.reponses), ['vc', 'rpm']);
      assert.notEqual(q.materiau_outil, 'Carbure de tungstène solide');
    }
  }
  // Les réponses sont exactement les valeurs attendues, mises en forme (on rejoue le tirage pour le vérifier).
  const seed = 9;
  const record = buildSpecimen(exercise, data, { seed, ...DATES });
  const random = seededRandom(seed);
  const { drawQuestion } = await import('../worker/seance.js');
  const { recordResult } = await import('../site/js/progression.js');
  let counters = { reussites: {}, totalReussies: 0 };
  for (const q of record.questions) {
    const question = drawQuestion(counters, exercise, data, random);
    const displayed = formatParameters(computeParameters(question, data));
    assert.deepEqual(q.reponses, { vc: displayed.vc, rpm: displayed.rpm }, `question ${q.numero}`);
    assert.equal(q.outil, question.displayId);
    const progress = recordResult({ exerciceId: exercise.id, ...counters }, question.tool.id, true);
    counters = { reussites: progress.reussites, totalReussies: progress.totalReussies };
  }
});

test('specimenUrl, readSpecimenClaims, specimenRequest, specimenClaimsMatch : l’adresse marquée spécimen porte de quoi recomposer ; un champ absent ou mal formé ne se recompose pas', () => {
  const serveur = serveurDeTest();
  const record = buildSpecimen(exerciseOf(m10), serveur.catalogue(M10), { seed: 42, ...DATES });
  const url = specimenUrl('https://quiz.example', record, 'sig');
  assert.ok(url.startsWith('https://quiz.example/verifier?specimen=1&exercice=m10-tournage-vc&'), url);
  const claims = readSpecimenClaims(new URL(url).searchParams);
  assert.deepEqual(claims, {
    code: SPECIMEN_CODE, specimen: '1', exercice: M10, matricule: '0000000', nom: 'SPÉCIMEN', prenom: 'Exemple', reussite: DATES.reussite, revision: '1',
    questions: '15', graine: '42', debut: DATES.debut, titre: m10.titre, signature: 'sig',
  });
  assert.deepEqual(readSpecimenClaims(claimsDe(url)), claims); // aussi depuis un objet JSON
  assert.equal(readSpecimenClaims({ code: 'ABCDE-FGHJK' }), null); // pas un spécimen
  assert.equal(readSpecimenClaims({}), null);
  assert.equal(specimenClaimsMatch(record, claims), true);
  assert.equal(specimenClaimsOnlyCode(claims), false);
  assert.equal(specimenClaimsOnlyCode(readSpecimenClaims({ code: 'speci-men00' })), true);
  for (const name of Object.keys(claims)) {
    if (name === 'code' || name === 'signature') continue;
    assert.equal(specimenClaimsMatch(record, { ...claims, [name]: `${claims[name]}x` }), false, name);
    assert.equal(specimenClaimsMatch(record, { ...claims, [name]: null }), false, name);
  }
  assert.deepEqual(specimenRequest(claims), { exercice: M10, revision: 1, seed: 42, debut: DATES.debut, reussite: DATES.reussite, titre: m10.titre });
  for (const [name, value] of [['graine', '-1'], ['graine', '4294967296'], ['graine', 'x'], ['graine', null], ['revision', '0'], ['revision', 'r0'], ['debut', '2026-10-06'], ['debut', 'hier'], ['reussite', null], ['titre', null], ['exercice', null]]) {
    assert.equal(specimenRequest({ ...claims, [name]: value }), null, `${name} = ${value}`);
  }
  assert.equal(specimenRequest({ ...claims, debut: DATES.reussite, reussite: DATES.debut }), null); // un début après la réussite
  assert.equal(specimenRequest({ ...claims, graine: String(SEED_MAX) }).seed, SEED_MAX);
});

// --- Les routes ----------------------------------------------------------------------------------------------------

test('GET /api/demo/specimen : composé à la volée pour la version en vigueur, avec le titre en vigueur, signé sous la sous-clé des spécimens, jamais enregistré ; deux appels, deux graines ; sans jeton', async () => {
  const serveur = serveurDeTest({ graine: 11 });
  const { status, corps } = await serveur.appel('GET', `/api/demo/specimen?exercice=${M10}`);
  assert.equal(status, 200, JSON.stringify(corps));
  assert.deepEqual(Object.keys(corps).sort(), ['annulee_le', 'attestation', 'code', 'signature', 'specimen', 'url_verification']);
  assert.equal(corps.specimen, true);
  assert.equal(corps.code, 'SPECI-MEN00');
  assert.equal(corps.annulee_le, null);
  assert.match(corps.signature, /^[A-Za-z0-9_-]{43}$/);
  const record = corps.attestation;
  assert.deepEqual(record.etudiant, SPECIMEN_STUDENT);
  assert.deepEqual(record.exercice, { id: M10, titre: m10.titre });
  assert.equal(record.revision, '1');
  assert.equal(record.reussite_le, serveur.maintenant.toISOString());
  assert.equal(record.debut, new Date(serveur.maintenant.getTime() - 15 * SECONDS_PER_QUESTION * SECONDE).toISOString());
  assert.equal(record.questions.length, 15);
  assert.ok(Number.isInteger(record.graine));
  assert.equal(corps.signature, await signSpecimen('secret-de-test', canonical(record)));
  assert.notEqual(corps.signature, await signAttestation('secret-de-test', canonical(record))); // une autre sous-clé
  assert.ok(corps.url_verification.startsWith('https://quiz.example/verifier?specimen=1&'), corps.url_verification);
  assert.equal(claimsDe(corps.url_verification).code, 'SPECI-MEN00');
  assert.equal(claimsDe(corps.url_verification).graine, String(record.graine));
  // Rien n'est enregistré, nulle part.
  assert.equal(serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM attestations').get().n, 0);
  assert.equal(serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM demos').get().n, 0);
  assert.equal(serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM seances').get().n, 0);
  // Un second appel : une autre graine, d'autres questions.
  const second = (await serveur.appel('GET', `/api/demo/specimen?exercice=${M10}`)).corps;
  assert.notEqual(second.attestation.graine, record.graine);
  assert.notEqual(canonical(second.attestation), canonical(record));
  // Le titre en vigueur (D78), par la présentation de l'exercice.
  await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } });
  const entetes = { cookie: `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
  const page = (await serveur.appel('GET', `/api/prof/editeur/exercice/presentation?id=${M10}`, { entetes })).corps;
  assert.equal((await serveur.appel('POST', '/api/prof/editeur/exercice/presentation/appliquer', { corps: { id: M10, revision: page.revision, presentation: { ...page.presentation, titre: 'Tournage — titre en vigueur' } }, entetes })).status, 200);
  const renomme = (await serveur.appel('GET', `/api/demo/specimen?exercice=${M10}`)).corps;
  assert.equal(renomme.attestation.exercice.titre, 'Tournage — titre en vigueur');
  assert.equal(claimsDe(renomme.url_verification).titre, 'Tournage — titre en vigueur');
});

test('vérification d’un spécimen : par l’adresse du QR → « specimen » avec l’enregistrement recomposé, identique ; le code tapé à la main → « specimen_code » ; un seul caractère modifié → « invalide »', async () => {
  const serveur = serveurDeTest();
  const { corps: specimen } = await serveur.appel('GET', `/api/demo/specimen?exercice=${M10}`);
  const claims = claimsDe(specimen.url_verification);
  const verifier = async (corps) => (await serveur.appel('POST', '/api/verification', { corps })).corps;

  assert.deepEqual(await verifier(claims), { resultat: 'specimen', attestation: specimen.attestation });
  // Le même QR vérifié plus tard, après qu'une autre version a été publiée, ou le titre changé : toujours recomposable.
  serveur.avancer(30 * MINUTE);
  serveur.publierExercice({ ...m10, titre: 'Nouvelle version' });
  assert.deepEqual(await verifier(claims), { resultat: 'specimen', attestation: specimen.attestation });
  // Le code seul : un spécimen, scanne son QR.
  for (const code of ['SPECI-MEN00', 'specimen00', ' speci men00']) assert.deepEqual(await verifier({ code }), { resultat: 'specimen_code' });
  // Un seul caractère modifié, dans n'importe quel champ : invalide. Le code lui-même modifié n'est plus un code
  // (ni de spécimen, ni de l'alphabet des vraies) : 400, comme pour une vraie attestation.
  for (const name of Object.keys(claims)) {
    if (name === 'code') continue;
    const value = claims[name];
    const modifie = name === 'graine' ? String(Number(value) + 1) : name === 'signature' ? `${value[0] === 'A' ? 'B' : 'A'}${value.slice(1)}` : `${value}x`;
    assert.deepEqual(await verifier({ ...claims, [name]: modifie }), { resultat: 'invalide' }, `${name} modifié`);
    assert.deepEqual(await verifier({ ...claims, [name]: undefined }), { resultat: 'invalide' }, `${name} absent`);
  }
  assert.equal((await serveur.appel('POST', '/api/verification', { corps: { ...claims, code: 'SPECI-MEN0' } })).status, 400);
  assert.deepEqual(await verifier({ ...claims, titre: 'Nouvelle version' }), { resultat: 'invalide' }); // le titre de l'adresse est celui du spécimen, pas celui d'aujourd'hui
  assert.deepEqual(await verifier({ ...claims, specimen: '0' }), { resultat: 'invalide' });
  assert.deepEqual(await verifier({ code: claims.code, graine: claims.graine }), { resultat: 'invalide' }); // des champs sans signature : pas « le code seul »
  // Un exercice que le serveur n'a plus : invalide, sans erreur.
  assert.deepEqual(await verifier({ ...claims, exercice: 'inconnu' }), { resultat: 'invalide' });
  assert.deepEqual(await verifier({ ...claims, revision: '99' }), { resultat: 'invalide' });
  // Rien de plus que le spécimen : ni jeton, ni séance.
  assert.equal(JSON.stringify(await verifier(claims)).includes('jeton'), false);
});

test('un spécimen ne passe jamais pour une vraie attestation, ni l’inverse : codes échangés, signatures sous l’autre sous-clé, drapeau spécimen ajouté ou retiré', async () => {
  const serveur = serveurDeTest();
  const vraie = await vraieAttestation(serveur);
  const { corps: specimen } = await serveur.appel('GET', `/api/demo/specimen?exercice=${M10}`);
  const verifier = async (corps) => (await serveur.appel('POST', '/api/verification', { corps })).corps;
  const vraisChamps = claimsDe(vraie.url_verification);
  const champsSpecimen = claimsDe(specimen.url_verification);
  assert.deepEqual(await verifier(vraisChamps), { resultat: 'valide', attestation: vraie.attestation });
  assert.deepEqual(await verifier(champsSpecimen), { resultat: 'specimen', attestation: specimen.attestation });

  // Une vraie adresse dont le code devient celui d'un spécimen : le chemin du spécimen, rien ne se recompose.
  assert.deepEqual(await verifier({ ...vraisChamps, code: 'SPECI-MEN00' }), { resultat: 'invalide' });
  // Un spécimen dont le code devient un vrai code : le chemin des vraies attestations, qui ne le trouve pas ou ne le reconnaît pas.
  assert.deepEqual(await verifier({ ...champsSpecimen, code: 'ABCDE-FGHJK' }), { resultat: 'aucune' });
  assert.deepEqual(await verifier({ ...champsSpecimen, code: vraie.code }), { resultat: 'invalide' });
  // Un spécimen signé sous la sous-clé des attestations, une vraie signée sous celle des spécimens : invalide.
  assert.deepEqual(await verifier({ ...champsSpecimen, signature: await signAttestation('secret-de-test', canonical(specimen.attestation)) }), { resultat: 'invalide' });
  assert.deepEqual(await verifier({ ...vraisChamps, signature: await signSpecimen('secret-de-test', canonical(vraie.attestation)) }), { resultat: 'invalide' });
  // Le drapeau spécimen ajouté à une vraie adresse n'en fait pas un spécimen (le code décide) ; retiré d'un spécimen, l'adresse est modifiée.
  assert.deepEqual(await verifier({ ...vraisChamps, specimen: '1' }), { resultat: 'valide', attestation: vraie.attestation });
  const { specimen: _drapeau, ...sansDrapeau } = champsSpecimen;
  assert.deepEqual(await verifier(sansDrapeau), { resultat: 'invalide' });
  // Une autre CLE_SECRETE : plus aucun spécimen ne se vérifie (comme les attestations, D72).
  const autre = serveurDeTest({ db: serveur.db, secret: 'une-autre-cle' });
  assert.deepEqual((await autre.appel('POST', '/api/verification', { corps: champsSpecimen })).corps, { resultat: 'invalide' });
  // La vraie attestation, elle, n'a pas bougé en base.
  assert.equal(serveur.db.sqlite.prepare('SELECT COUNT(*) AS n FROM attestations').get().n, 1);
});

test('vérification d’un spécimen : soumise à la limite de débit sur les codes, sous une seule valeur (le code du spécimen)', async () => {
  const serveur = serveurDeTest();
  const { corps: specimen } = await serveur.appel('GET', `/api/demo/specimen?exercice=${M10}`);
  const adresse = { 'cf-connecting-ip': '203.0.113.7' };
  for (let i = 0; i < 3; i += 1) assert.equal((await serveur.appel('POST', '/api/verification', { corps: claimsDe(specimen.url_verification), entetes: adresse })).corps.resultat, 'specimen');
  assert.deepEqual(serveur.db.sqlite.prepare("SELECT valeur FROM debit WHERE portee = 'verification'").all().map((row) => row.valeur), [SPECIMEN_CODE]);
});
