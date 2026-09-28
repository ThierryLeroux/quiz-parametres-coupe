// Tests du facteur de vitesse sur le serveur (décision D83), par le vrai Worker sur une base SQLite en mémoire : le
// brouillon des tables prérempli d'après la table papier, la publication de tables qui portent les facteurs, le passage
// des copies d'outils (cascade, « Passer à … », reprise, import) et de la banque, ce que la question dit du facteur
// (à trouver, donné, forcé), la ligne de calcul en fraction, et ce qui ne change pas pour une séance en cours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECONDE, serveurDeTest } from './aide-serveur.js';
import { PASSAGE_REASON, adoptSpeedFactors, prefillSpeedFactors } from '../site/js/facteur-vitesse.js';
import { IMPORT_WORD } from '../worker/editeur.js';
import { lireFichier } from './aide.js';

const M10 = 'm10-tournage-vc';
const VC_RPM = 'm10-tournage-vc-rpm';
const FACTEURS = 'facteurs';
const CAMILLE = { exercice: M10, prenom: 'Camille', nom: 'Tremblay', matricule: '2412345', nip: '4821' };
const materiaux = await lireFichier('data/materiaux.json');
const operations = await lireFichier('data/operations.json');
const AVEC = prefillSpeedFactors({ materiaux, operations });
const FORCES = ['nine9_90_degres', 'outil_a_chambrer'];

async function editeurDeTest(options = {}) {
  const serveur = serveurDeTest(options);
  const { status, corps } = await serveur.appel('POST', '/api/prof/connexion', { corps: { cle: 'cle-admin-de-test' } });
  assert.equal(status, 200, JSON.stringify(corps));
  const entetes = { cookie: `prof=${serveur.derniersEntetes.get('set-cookie').match(/^prof=([^;]+)/)[1]}` };
  serveur.editeur = async (methode, chemin, corps_) => {
    const reponse = await serveur.appel(methode, `/api/prof/editeur/${chemin}`, { corps: corps_, entetes });
    return reponse;
  };
  return serveur;
}

const brouillonTables = async (serveur) => (await serveur.editeur('GET', 'tables')).corps;
const exercice = async (serveur, id) => (await serveur.editeur('GET', `exercice?id=${id}`)).corps;
const versions = (serveur, id) => serveur.db.sqlite.prepare('SELECT numero, contenu, tables_id FROM versions_exercice WHERE exercice_id = ? ORDER BY numero').all(id).map((v) => ({ ...v, contenu: JSON.parse(v.contenu) }));
const banque = (serveur) => serveur.db.sqlite.prepare('SELECT id, outil, revision, modifie_par FROM banque_outils ORDER BY rang').all().map((row) => ({ ...row, outil: JSON.parse(row.outil) }));

// Publie le brouillon des tables tel que la Gestion du contenu le lit (prérempli), sous `id`, avec la cascade cochée.
async function publierTables(serveur, id, cascade = [], retouche = () => {}) {
  const page = await brouillonTables(serveur);
  const contenu = structuredClone(page.brouillon.contenu);
  retouche(contenu);
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: page.brouillon.revision, contenu });
  assert.equal(enregistre.status, 200, JSON.stringify(enregistre.corps));
  const publie = await serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id, cascade });
  assert.equal(publie.status, 200, JSON.stringify(publie.corps));
  return publie.corps;
}

// Crée, règle et publie un exercice fait de copies de la banque, sur les tables les plus récentes.
async function publierExercice(serveur, id, outils, reglages = {}) {
  assert.equal((await serveur.editeur('POST', 'exercice/creer', { id, titre: `Exercice ${id}` })).status, 200);
  const outilsBanque = (await serveur.editeur('GET', 'banque')).corps.outils;
  const page = await exercice(serveur, id);
  const brouillon = { ...page.exercice.brouillon, champs_evalues: ['vc', 'n'], ...reglages, outils: outils.map((outil) => ({ ...outilsBanque.find((row) => row.id === outil).outil, reussites_requises: 1, origine: outil })) };
  const enregistre = await serveur.editeur('POST', 'exercice/enregistrer', { id, revision: page.exercice.revision, brouillon });
  assert.deepEqual([enregistre.status, enregistre.corps.erreurs], [200, []], JSON.stringify(enregistre.corps));
  const publie = await serveur.editeur('POST', 'exercice/publier', { id, revision: enregistre.corps.revision });
  assert.equal(publie.status, 200, JSON.stringify(publie.corps));
  return publie.corps.numero;
}

// Ouvre une séance et rend sa première question ; `matricule` distingue les étudiants.
async function commencer(serveur, id, matricule = '2412345') {
  const { status, corps } = await serveur.appel('POST', '/api/creation', { corps: { ...CAMILLE, exercice: id, matricule } });
  assert.equal(status, 200, JSON.stringify(corps));
  const question = await serveur.appel('POST', '/api/question', { jeton: corps.jeton, corps: { exercice: id } });
  assert.equal(question.status, 200, JSON.stringify(question.corps));
  return { jeton: corps.jeton, seance: question.corps.seance };
}

// --- Les tables -----------------------------------------------------------------------------------------------------------

test('le brouillon des tables se lit prérempli d’après la table papier ; rien n’est écrit tant qu’on n’enregistre pas ; « Annuler » n’a rien à annuler ; une valeur illisible est une erreur, et ne se publie pas', async () => {
  const serveur = await editeurDeTest();
  const page = await brouillonTables(serveur);
  assert.deepEqual(page.brouillon.contenu.operations.operations, AVEC.operations.operations);
  assert.deepEqual([page.modifie, page.erreurs, page.brouillon.revision], [true, [], 1]);
  // En base, le brouillon semé n'a pas changé : le préremplissage se fait à la lecture.
  assert.equal(JSON.parse(serveur.db.sqlite.prepare('SELECT contenu FROM brouillon_tables').get().contenu).operations.operations.some((op) => 'facteur_vitesse' in op), false);
  // La version publiée, elle, n'en reçoit aucun : ni dans la Gestion du contenu, ni pour l'étudiant.
  assert.equal((await serveur.editeur('GET', 'tables/version?id=A2026_r0')).corps.tables.operations.operations.some((op) => 'facteur_vitesse' in op), false);
  assert.equal((await serveur.appel('GET', '/api/tables?version=A2026_r0')).corps.tables.operations.operations.some((op) => 'facteur_vitesse' in op), false);
  assert.equal((await serveur.appel('GET', `/api/exercice?exercice=${M10}`)).corps.tables.operations.operations.some((op) => 'facteur_vitesse' in op), false);
  // « Annuler les modifications » : le brouillon ne diffère de A2026_r0 que par le préremplissage — rien à annuler.
  const annule = await serveur.editeur('POST', 'tables/annuler', { revision: 1 });
  assert.deepEqual([annule.status, annule.corps.annule, annule.corps.revision], [200, false, 1]);
  // Une case vidée ou illisible (la Gestion du contenu envoie alors null ou le texte tapé) : une erreur, dite à l'enregistrement.
  const fautif = structuredClone(page.brouillon.contenu);
  fautif.operations.operations[4].facteur_vitesse = null;
  fautif.operations.operations[5].facteur_vitesse = 'un quart';
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: 1, contenu: fautif });
  assert.deepEqual(enregistre.corps.erreurs.map((e) => e.message), [
    "operations[4] « Perçage » : « facteur_vitesse » doit être un nombre > 0 (1 : aucune réduction ; « 1/4 » s'écrit 0.25)",
    "operations[5] « Chanfreinage » : « facteur_vitesse » doit être un nombre > 0 (1 : aucune réduction ; « 1/4 » s'écrit 0.25)",
  ]);
  const refus = await serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id: 'A2026_r1' });
  assert.deepEqual([refus.status, refus.corps.erreurs.length], [400, 2]);
});

test('publier des tables qui portent les facteurs : la confirmation annonce le passage de la banque et nomme les outils forcés ; la banque fait son passage, son historique le garde ; le journal le résume', async () => {
  const serveur = await editeurDeTest();
  serveur.publierExercice(await lireFichier('exercices/test-complet.json'));
  const page = await brouillonTables(serveur);
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: page.brouillon.revision, contenu: page.brouillon.contenu });
  // Ce que la publication proposerait : l'impact pour chaque exercice, et le passage de la banque.
  const propose = (await serveur.editeur('GET', 'tables/cascade')).corps;
  assert.deepEqual([propose.banque.herites.length, propose.banque.forces.map((t) => t.id)], [27, FORCES]);
  assert.equal(propose.banque.forces[0].ligne, `Nine9 90 degrés (nine9_90_degres) — facteur de vitesse forcé : × 1 au lieu de × 1/4 (Chanfreinage) — « ${PASSAGE_REASON} »`);
  const complet = propose.candidats.find((c) => c.id === 'test-complet');
  assert.deepEqual(complet.lignes, [
    'Facteur de vitesse : ces tables le portent. 27 outils héritent de celui de leur opération, sans changement de valeur ; 2 sont forcés, à vérifier.',
    `Nine9 90 degrés (nine9_90_degres) — facteur de vitesse forcé : × 1 au lieu de × 1/4 (Chanfreinage) — « ${PASSAGE_REASON} »`,
    `Outil à chambrer (outil_a_chambrer) — facteur de vitesse forcé : × 1 au lieu de × 1/4 (Chanfreinage) — « ${PASSAGE_REASON} »`,
    "Le facteur de vitesse n'est plus donné à l'étudiant : il le trouve dans la feuille « Facteurs de vitesse », comme la Vc (pour le donner, coche « Donner le facteur de vitesse à l'étudiant » dans l'exercice, puis publie).",
  ]);
  assert.deepEqual([complet.en_erreur, complet.erreurs, complet.brouillon.erreurs], [false, [], []]);
  const m10 = propose.candidats.find((c) => c.id === M10);
  assert.equal(m10.lignes[0], 'Facteur de vitesse : ces tables le portent. 9 outils héritent de celui de leur opération, sans changement de valeur.');
  // Rien n'est encore écrit.
  assert.ok(banque(serveur).every((row) => row.outil.fact_vc !== undefined && row.revision === 1));

  serveur.avancer(60 * SECONDE);
  const publie = await serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id: 'A2026_r1', cascade: [M10, 'test-complet'] });
  assert.equal(publie.status, 200, JSON.stringify(publie.corps));
  assert.deepEqual([publie.corps.banque.herites.length, publie.corps.banque.forces.map((t) => t.id)], [27, FORCES]);
  // Les tables publiées portent les facteurs, et la feuille publique les sert.
  const r1 = (await serveur.appel('GET', '/api/tables?version=A2026_r1')).corps.tables;
  assert.deepEqual(r1.operations.operations.map((op) => op.facteur_vitesse), AVEC.operations.operations.map((op) => op.facteur_vitesse));
  // La banque : chaque outil a fait son passage, une révision de plus, l'auteur retenu ; le contenu d'avant est dans l'historique.
  const apres = banque(serveur);
  assert.deepEqual(apres.filter((row) => row.outil.fact_vc !== undefined).map((row) => [row.id, row.outil.fact_vc, row.outil.fact_vc_raison]), FORCES.map((id) => [id, 1, PASSAGE_REASON]));
  assert.ok(apres.every((row) => row.revision === 2 && row.modifie_par === 'admin'));
  const historique = serveur.db.sqlite.prepare('SELECT outil_id, contenu, action, remplace_par FROM banque_outils_historique ORDER BY id').all().map((row) => ({ ...row, contenu: JSON.parse(row.contenu) }));
  assert.equal(historique.length, 29);
  assert.ok(historique.every((h) => h.action === 'enregistrement' && h.remplace_par === 'admin' && h.contenu.fact_vc !== undefined && h.contenu.fact_vc_raison === undefined));
  const alesoir = (await serveur.editeur('GET', 'banque/outil?id=alesoir')).corps;
  assert.deepEqual([alesoir.outil.outil.fact_vc, alesoir.erreurs, alesoir.historique.map((h) => h.lignes)], [undefined, [], [["Facteur de vitesse : « hérité de l'opération » → « × 1/4 »"]]]);
  // Le journal : une ligne, celle de la publication des tables.
  assert.match(serveur.journalEnseignant().filter((l) => l.action === 'editeur_tables_publication').at(-1).details, / · banque d'outils, passage aux facteurs de vitesse : 27 outil\(s\) hérité\(s\), 2 forcé\(s\) \(nine9_90_degres, outil_a_chambrer\)$/);
  // La cascade : les copies des versions publiées ont fait leur passage ; rien d'autre n'y a changé.
  const [v1, v2] = versions(serveur, 'test-complet');
  assert.deepEqual([v2.tables_id, v2.contenu], ['A2026_r1', adoptSpeedFactors(v1.contenu, AVEC)]);
  assert.deepEqual(v2.contenu.outils.filter((c) => c.fact_vc !== undefined).map((c) => c.id), FORCES);
  // Publier de nouveau ne refait aucun passage : la banque ne bouge plus.
  const suite = await publierTables(serveur, 'A2026_r2', [], (contenu) => { contenu.operations.operations[0].avance_po_rev = 0.007; });
  assert.deepEqual([suite.banque, banque(serveur).every((row) => row.revision === 2)], [{ herites: [], forces: [] }, true]);
});

test('un outil hérité suit sa table ; un outil forcé garde sa valeur : l’impact d’une nouvelle version le dit, outil par outil', async () => {
  const serveur = await editeurDeTest();
  await publierTables(serveur, 'A2026_r1');
  await publierExercice(serveur, FACTEURS, ['alesoir', 'fraise_82_degres', 'nine9_90_degres']);
  const page = await brouillonTables(serveur);
  const contenu = structuredClone(page.brouillon.contenu);
  contenu.operations.operations.find((op) => op.operation === 'Chanfreinage').facteur_vitesse = 0.5;
  const enregistre = await serveur.editeur('POST', 'tables/enregistrer', { revision: page.brouillon.revision, contenu });
  const propose = (await serveur.editeur('GET', 'tables/cascade')).corps.candidats.find((c) => c.id === FACTEURS);
  assert.deepEqual(propose.lignes, ['Fraise 82 degrés (fraise_82_degres) — facteur de vitesse : × 1/4 → × 1/2 (Chanfreinage)']);
  assert.equal((await serveur.editeur('POST', 'tables/publier', { revision: enregistre.corps.revision, id: 'A2026_r2', cascade: [FACTEURS] })).status, 200);
  // La version 2 : le même contenu ; la fraise, héritée, vaut désormais 1/2 ; le Nine9, forcé, garde × 1.
  const [v1, v2] = versions(serveur, FACTEURS);
  assert.deepEqual([v2.tables_id, v2.contenu], ['A2026_r2', v1.contenu]);
  const catalogue = serveur.catalogue(FACTEURS);
  assert.equal(catalogue.operationByName.get('Chanfreinage').facteur_vitesse, 0.5);
});

// --- La question et la correction ------------------------------------------------------------------------------------------

// Joue toutes les questions d'un exercice, avec les bonnes réponses, et rend pour chaque outil la question reçue et sa
// correction (une mauvaise vitesse de rotation à la première question de chaque outil, pour lire la ligne de calcul).
async function jouer(serveur, id, matricule) {
  const { jeton, seance } = await commencer(serveur, id, matricule);
  const vus = new Map();
  let etat = seance;
  for (let tour = 0; etat.reussite_le === null && tour < 40; tour += 1) {
    serveur.avancer(11 * SECONDE);
    const { question } = etat;
    const bonnes = serveur.bonnesReponses(matricule, id);
    const premiere = !vus.has(question.outil.id);
    const saisies = premiere ? { ...bonnes, rpm: String(Number(bonnes.rpm) * 3 + 11) } : bonnes;
    const reponse = await serveur.appel('POST', '/api/correction', { jeton, corps: { exercice: id, saisies } });
    assert.equal(reponse.status, 200, JSON.stringify(reponse.corps));
    if (premiere) vus.set(question.outil.id, { question, correction: reponse.corps.correction, bonnes });
    etat = reponse.corps.seance;
  }
  assert.notEqual(etat.reussite_le, null, 'exercice réussi');
  return { jeton, vus };
}

test('le facteur à trouver : ni valeur ni texte ne partent au navigateur ; un facteur forcé est toujours dit, avec sa raison ; la correction juge N avec le facteur, et la ligne de calcul l’écrit en fraction', async () => {
  const serveur = await editeurDeTest();
  await publierTables(serveur, 'A2026_r1');
  await publierExercice(serveur, FACTEURS, ['alesoir', 'nine9_90_degres', 'foret_a_pointer']);
  const { jeton, vus } = await jouer(serveur, FACTEURS, '2411111');
  const { alesoir, nine9_90_degres: nine9, foret_a_pointer: foret } = Object.fromEntries(vus);
  // L'alésoir hérite de 1/4 : à trouver, rien ne part — ni « fact_vc », ni la valeur, ni son texte.
  assert.deepEqual(alesoir.question.outil.facteur_vitesse, { etat: 'a_trouver', texte: null, valeur: null, raison: null });
  assert.equal('fact_vc' in alesoir.question.outil, false);
  assert.doesNotMatch(JSON.stringify(alesoir.question), /0\.25|1\/4/);
  assert.deepEqual(foret.question.outil.facteur_vitesse, { etat: 'a_trouver', texte: null, valeur: null, raison: null });
  // Le Nine9, forcé par le passage : toujours dit, avec sa raison.
  assert.deepEqual(nine9.question.outil.facteur_vitesse, { etat: 'force', texte: '1', valeur: 1, raison: PASSAGE_REASON });
  // La correction : la ligne de calcul de N, en fraction ; un facteur hérité de 1 ne s'écrit pas ; un facteur forcé toujours.
  const ligne = (vu) => vu.correction.champs.find((c) => c.champ === 'rpm');
  assert.match(ligne(alesoir).calcul, /^N = Vc × 4 \/ Ø × facteur = \d+ × 4 \/ [\d.]+ × 1\/4( → plafonné à \d+)?$/);
  assert.match(ligne(nine9).calcul, /^N = Vc × 4 \/ Ø × facteur = \d+ × 4 \/ [\d.]+ × 1 \(propre à cet outil\)( → plafonné à \d+)?$/);
  assert.match(ligne(foret).calcul, /^N = Vc × 4 \/ Ø = \d+ × 4 \/ [\d.]+( → plafonné à \d+)?$/);
  // N attendu : Vc × 4 / Ø × 1/4 pour l'alésoir (la formule et les tolérances ne changent pas).
  const catalogue = serveur.catalogue(FACTEURS);
  const posee = serveur.journal().map((l) => ({ question: JSON.parse(l.question), attendu: JSON.parse(l.resultat).attendu })).find((l) => l.question.tool.id === 'alesoir');
  assert.equal(posee.attendu.rpmRaw, posee.attendu.vc * 4 / posee.question.dimension.diameter * 0.25);
  assert.equal(catalogue.outils.find((o) => o.id === 'alesoir').fact_vc, undefined);
  // L'exercice servi au navigateur : ses tables portent les facteurs (la 4e feuille), comme elles portent les Vc.
  const servi = (await serveur.appel('GET', `/api/exercice?exercice=${FACTEURS}`)).corps;
  assert.equal(servi.tables.operations.operations.find((op) => op.operation === "Alésage à l'alésoir").facteur_vitesse, 0.25);
  assert.equal('facteur_vitesse_donne' in servi.exercice, false);
  // L'attestation ne dit rien du facteur : elle garde sa forme.
  const attestation = (await serveur.appel('GET', `/api/attestation?exercice=${FACTEURS}`, { jeton })).corps.attestation;
  assert.deepEqual(Object.keys(attestation).sort(), ['code', 'debut', 'etudiant', 'exercice', 'outils', 'questions', 'questions_reussies', 'reussite_le', 'revision', 'revision_tables']);
  assert.deepEqual(attestation.revision_tables, { materiaux: 'A2026_r1', operations: 'A2026_r1' });
});

test('« Donner le facteur de vitesse à l’étudiant » : coché, la question le donne en fraction ; le réglage est versionné avec l’exercice', async () => {
  const serveur = await editeurDeTest();
  await publierTables(serveur, 'A2026_r1');
  await publierExercice(serveur, FACTEURS, ['alesoir', 'nine9_90_degres', 'foret_a_pointer'], { facteur_vitesse_donne: true });
  const { vus } = await jouer(serveur, FACTEURS, '2422222');
  assert.deepEqual(vus.get('alesoir').question.outil.facteur_vitesse, { etat: 'donne', texte: '1/4', valeur: 0.25, raison: null });
  assert.deepEqual(vus.get('foret_a_pointer').question.outil.facteur_vitesse, { etat: 'donne', texte: '1', valeur: 1, raison: null });
  assert.deepEqual(vus.get('nine9_90_degres').question.outil.facteur_vitesse, { etat: 'force', texte: '1', valeur: 1, raison: PASSAGE_REASON });
  assert.equal((await serveur.appel('GET', `/api/exercice?exercice=${FACTEURS}`)).corps.exercice.facteur_vitesse_donne, true);
  // Décoché dans le brouillon, puis publié : la version 2 le fait trouver ; la version 1 reste telle quelle.
  const page = await exercice(serveur, FACTEURS);
  const { facteur_vitesse_donne: _donne, ...sans } = page.exercice.brouillon;
  const enregistre = await serveur.editeur('POST', 'exercice/enregistrer', { id: FACTEURS, revision: page.exercice.revision, brouillon: sans });
  assert.equal((await serveur.editeur('POST', 'exercice/publier', { id: FACTEURS, revision: enregistre.corps.revision })).status, 200);
  assert.deepEqual(versions(serveur, FACTEURS).map((v) => v.contenu.facteur_vitesse_donne), [true, undefined]);
  const nouvelle = await commencer(serveur, FACTEURS, '2433333');
  assert.equal(nouvelle.seance.exercice.version, '2');
  assert.ok(['a_trouver', 'force'].includes(nouvelle.seance.question.outil.facteur_vitesse.etat));
  // Un réglage mal formé : une erreur du brouillon, qui ne se publie pas.
  const mauvais = await serveur.editeur('POST', 'exercice/enregistrer', { id: FACTEURS, revision: (await exercice(serveur, FACTEURS)).exercice.revision, brouillon: { ...sans, facteur_vitesse_donne: 'oui' } });
  assert.deepEqual(mauvais.corps.erreurs.map((e) => e.champ), ['facteur_vitesse_donne']);
});

test('rien ne change pour ce qui existe : une séance commencée avant la cascade garde sa question, son « fact_vc » et sa correction ; une version d’avant ignore le réglage', async () => {
  const serveur = await editeurDeTest();
  serveur.publierExercice({ ...(await lireFichier('exercices/test-complet.json')), outils: [{ id: 'alesoir', reussites_requises: 2 }], facteur_vitesse_donne: false });
  const avant = await commencer(serveur, 'test-complet');
  assert.deepEqual([avant.seance.question.outil.fact_vc, 'facteur_vitesse' in avant.seance.question.outil], [0.25, false]);
  const attendues = serveur.bonnesReponses('2412345', 'test-complet');
  await publierTables(serveur, 'A2026_r1', ['test-complet']);
  // La séance en cours : même version, même question, mêmes valeurs ; la ligne de calcul d'avant, en décimal.
  const relue = (await serveur.appel('GET', '/api/seance?exercice=test-complet', { jeton: avant.jeton })).corps.seance;
  assert.deepEqual([relue.exercice.version, relue.question], ['1', avant.seance.question]);
  assert.deepEqual(serveur.bonnesReponses('2412345', 'test-complet'), attendues);
  serveur.avancer(11 * SECONDE);
  const corrigee = (await serveur.appel('POST', '/api/correction', { jeton: avant.jeton, corps: { exercice: 'test-complet', saisies: { ...attendues, rpm: '1' } } })).corps;
  assert.match(corrigee.correction.champs.find((c) => c.champ === 'rpm').calcul, /^N = Vc × 4 \/ Ø = \d+ × 4 \/ [\d.]+ × 0\.25$/);
  assert.equal(corrigee.seance.question.outil.fact_vc, 0.25);
  // Une nouvelle séance prend la version de la cascade : le facteur y est à trouver.
  const apres = await commencer(serveur, 'test-complet', '2499999');
  assert.deepEqual([apres.seance.exercice.version, apres.seance.question.outil.facteur_vitesse.etat, 'fact_vc' in apres.seance.question.outil], ['2', 'a_trouver', false]);
});

// --- Le passage d'un brouillon, d'une reprise, d'un import ------------------------------------------------------------------

test('« Passer à … » : le brouillon fait le passage de ses copies vers des tables qui portent les facteurs, et chaque copie retrouve son facteur propre en revenant à des tables qui ne les portent pas', async () => {
  const serveur = await editeurDeTest();
  serveur.publierExercice(await lireFichier('exercices/test-complet.json'));
  serveur.db.sqlite.prepare("UPDATE exercices SET tables_id = 'A2026_r0' WHERE id = 'test-complet'").run();
  await publierTables(serveur, 'A2026_r1');
  const depart = await exercice(serveur, 'test-complet');
  assert.equal(depart.exercice.tables_id, 'A2026_r0');
  const passe = await serveur.editeur('POST', 'exercice/tables', { id: 'test-complet', revision: depart.exercice.revision, tables_id: 'A2026_r1' });
  assert.deepEqual([passe.status, passe.corps.erreurs], [200, []]);
  const surR1 = await exercice(serveur, 'test-complet');
  assert.deepEqual(surR1.exercice.brouillon, adoptSpeedFactors(depart.exercice.brouillon, AVEC));
  assert.deepEqual(surR1.exercice.brouillon.outils.filter((c) => c.fact_vc !== undefined).map((c) => [c.id, c.fact_vc_raison]), FORCES.map((id) => [id, PASSAGE_REASON]));
  // Retour à A2026_r0 : aucune erreur, et les facteurs d'avant (la raison du passage, sans objet, n'y est plus).
  const retour = await serveur.editeur('POST', 'exercice/tables', { id: 'test-complet', revision: surR1.exercice.revision, tables_id: 'A2026_r0' });
  assert.deepEqual([retour.status, retour.corps.erreurs], [200, []]);
  assert.deepEqual((await exercice(serveur, 'test-complet')).exercice.brouillon, depart.exercice.brouillon);
});

test('enregistrer un brouillon ou un outil de la banque : un ancien outil y fait son passage ; forcer exige la valeur et la raison', async () => {
  const serveur = await editeurDeTest();
  await publierTables(serveur, 'A2026_r1', [M10]);
  // Un brouillon envoyé à l'ancien format (un autre onglet resté ouvert, un script) : enregistré au nouveau.
  const page = await exercice(serveur, M10);
  const ancien = structuredClone(versions(serveur, M10)[0].contenu);
  ancien.outils[2].fact_vc = 1; // la lame à tronçonner, à × 1 au lieu de 1/8
  const enregistre = await serveur.editeur('POST', 'exercice/enregistrer', { id: M10, revision: page.exercice.revision, brouillon: ancien });
  assert.deepEqual([enregistre.status, enregistre.corps.erreurs], [200, []]);
  const relu = (await exercice(serveur, M10)).exercice.brouillon;
  assert.deepEqual(relu.outils.map((c) => [c.id, c.fact_vc, c.fact_vc_raison]).filter(([, facteur]) => facteur !== undefined), [['lame_a_tronconner', 1, PASSAGE_REASON]]);
  // La banque : forcer sans raison, ou avec une valeur illisible, est une erreur (l'outil s'enregistre, l'erreur est dite).
  const outil = (await serveur.editeur('GET', 'banque/outil?id=alesoir')).corps.outil;
  const sansRaison = await serveur.editeur('POST', 'banque/enregistrer', { id: 'alesoir', revision: outil.revision, outil: { ...outil.outil, fact_vc: 1, fact_vc_raison: '' } });
  assert.deepEqual([sansRaison.status, sansRaison.corps.erreurs.length], [200, 1]);
  assert.match(sansRaison.corps.erreurs[0].message, /Un facteur forcé exige une raison courte/);
  const force = await serveur.editeur('POST', 'banque/enregistrer', { id: 'alesoir', revision: sansRaison.corps.revision, outil: { ...outil.outil, fact_vc: 1, fact_vc_raison: 'alésoir au carbure' } });
  assert.deepEqual([force.status, force.corps.erreurs, force.corps.lignes], [200, [], ['Facteur de vitesse : « × 1 » → « forcé × 1 (alésoir au carbure) »']]);
  // Revenu à l'héritage : plus de facteur propre.
  const herite = await serveur.editeur('POST', 'banque/enregistrer', { id: 'alesoir', revision: force.corps.revision, outil: outil.outil });
  assert.deepEqual([herite.corps.erreurs, herite.corps.lignes], [[], ["Facteur de vitesse : « forcé × 1 (alésoir au carbure) » → « hérité de l'opération »"]]);
});

test('Sauvegarde : un export d’avant les facteurs, importé dans une base dont les tables les portent — la banque et les brouillons font leur passage, les versions publiées ne sont pas touchées', async () => {
  const source = await editeurDeTest();
  const exporte = (await source.editeur('GET', 'export')).corps; // une base d'avant D83 : tout à l'ancien format
  assert.ok(exporte.banque.every((b) => b.outil.fact_vc !== undefined));
  const cible = await editeurDeTest();
  await publierTables(cible, 'A2026_r1', [M10, VC_RPM]);
  const avant = { banque: banque(cible), v1: versions(cible, M10)[0], v2: versions(cible, M10)[1] };
  const validation = (await cible.editeur('POST', 'import/valider', { export: exporte })).corps;
  assert.deepEqual(validation.erreurs, []);
  // La banque de l'export, une fois son passage fait, est celle de la base : rien n'y change.
  assert.deepEqual([validation.resume.banque.modifies, validation.resume.banque.gardes], [[], 29]);
  assert.equal((await cible.editeur('POST', 'import', { export: exporte, confirmation: IMPORT_WORD })).status, 200);
  assert.deepEqual(banque(cible), avant.banque);
  // Les brouillons de l'export sont sur A2026_r0 : ils gardent leurs tables et leur format ; les versions, immuables, aussi.
  const m10 = await exercice(cible, M10);
  assert.deepEqual([m10.exercice.tables_id, m10.exercice.brouillon.outils.every((c) => c.fact_vc !== undefined), m10.erreurs], ['A2026_r0', true, []]);
  assert.deepEqual([versions(cible, M10)[0], versions(cible, M10)[1]], [avant.v1, avant.v2]);
  // Un brouillon de l'export rattaché aux tables qui portent les facteurs : ses copies font leur passage à l'import.
  const rattache = structuredClone(exporte);
  rattache.tables_reference = (await cible.editeur('GET', 'export')).corps.tables_reference;
  rattache.exercices.find((e) => e.id === VC_RPM).tables_id = 'A2026_r1';
  assert.equal((await cible.editeur('POST', 'import', { export: rattache, confirmation: IMPORT_WORD })).status, 200);
  const rpm = await exercice(cible, VC_RPM);
  assert.deepEqual([rpm.exercice.tables_id, rpm.exercice.brouillon.outils.some((c) => c.fact_vc !== undefined), rpm.erreurs], ['A2026_r1', false, []]);
});

test('« Reprendre cette version » d’une version des tables d’avant les facteurs : le brouillon reprend ses valeurs, prérempli d’après la table papier', async () => {
  const serveur = await editeurDeTest();
  await publierTables(serveur, 'A2026_r1', [], (contenu) => { contenu.operations.operations.find((op) => op.operation === 'Perçage').facteur_vitesse = 0.5; });
  const page = await brouillonTables(serveur);
  assert.equal(page.modifie, false);
  const reprise = await serveur.editeur('POST', 'tables/reprendre', { revision: page.brouillon.revision, id: 'A2026_r0' });
  assert.deepEqual([reprise.status, reprise.corps.base_id, reprise.corps.modifie], [200, 'A2026_r1', true]);
  const repris = await brouillonTables(serveur);
  assert.deepEqual(repris.brouillon.contenu.operations.operations.map((op) => op.facteur_vitesse), AVEC.operations.operations.map((op) => op.facteur_vitesse));
  assert.deepEqual(repris.erreurs, []);
});
