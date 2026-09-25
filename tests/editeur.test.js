// Tests des règles pures de l'éditeur (jalon 7a, D47 à D49) : copies d'outils et brouillon
// (site/js/exercice.js), erreurs par champ (site/js/data.js), identifiants, aperçu, plan d'import (worker/editeur.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_KEYS, toolErrors } from '../site/js/data.js';
import { COPY_KEYS, DRAFT_KEYS, copyOfTool, draftErrors, draftFromExercise, engineExercise } from '../site/js/exercice.js';
import { EXPORT_FORMAT, IMPORT_WORD, REPLACE_WORD, cleanDraft, cleanTool, freeId, importDetails, importPlan, importWord, isExerciseId, isToolId, previewQuestions, sameContent } from '../worker/editeur.js';
import { aleaAGraine, data, lireFichier } from './aide.js';

const materiaux = await lireFichier('data/materiaux.json');
const operations = await lireFichier('data/operations.json');
const tables = { materiaux, operations };
const m10 = await lireFichier('exercices/m10-tournage-vc.json');
const opsByName = new Map(operations.operations.map((op) => [op.operation, op]));
const outil = (id) => data.outils.find((o) => o.id === id);

// --- Copies d'outils ---------------------------------------------------------------------------------------------

test('copyOfTool : une copie complète de l’outil, avec les restrictions d’une entrée appliquées, l’image, les réussites et l’origine', () => {
  const foret = outil('foret_fractionnaire');
  const copie = copyOfTool(foret, { reussites_requises: 2, dimensions: ['Ø 1/4 po', 'Ø 1/2 po'], materiaux_outil: ['Acier rapide'], groupes: ['P - Acier non allié'] });
  assert.deepEqual(copie.dimensions.map((d) => d.libelle), ['Ø 1/4 po', 'Ø 1/2 po']);
  assert.deepEqual([copie.materiaux_outil, copie.groupes_materiaux_usinables, copie.reussites_requises, copie.origine, copie.image, copie.id], [['Acier rapide'], ['P - Acier non allié'], 2, 'foret_fractionnaire', 'foret_fractionnaire', 'foret_fractionnaire']);
  assert.ok(Object.keys(copie).every((key) => COPY_KEYS.includes(key)));
  // Sans restriction : tout l'outil ; la copie ne partage rien avec lui.
  const entiere = copyOfTool(foret);
  assert.equal(entiere.dimensions.length, foret.dimensions.length);
  entiere.dimensions[0].libelle = 'x';
  assert.notEqual(foret.dimensions[0].libelle, 'x');
  assert.equal(entiere.reussites_requises, 1);
  // Une copie renommée dans l'exercice garde sa photo et son origine ; une copie d'une copie aussi.
  const deux = copyOfTool({ ...entiere, id: 'foret_2' }, { id: 'foret_3' });
  assert.deepEqual([deux.id, deux.image, deux.origine], ['foret_3', 'foret_fractionnaire', 'foret_fractionnaire']);
  assert.deepEqual(TOOL_KEYS.slice(0, 3), ['id', 'colonne_excel', 'nom']);
});

test('draftFromExercise et engineExercise : un fichier d’exercice devient un brouillon de copies, et un brouillon redevient l’exercice du moteur avec ses outils', () => {
  const brouillon = draftFromExercise({ ...m10, groupes: ['P - Acier non allié'], liste: false }, data.outils);
  assert.deepEqual(Object.keys(brouillon).every((key) => DRAFT_KEYS.includes(key)), true);
  assert.deepEqual([brouillon.titre, brouillon.champs_evalues, brouillon.groupes, brouillon.liste, brouillon.outils.length], [m10.titre, ['vc'], ['P - Acier non allié'], false, 9]);
  assert.deepEqual(brouillon.outils.map((c) => [c.id, c.reussites_requises]), m10.outils.map((o) => [o.id, o.reussites_requises]));
  assert.throws(() => draftFromExercise({ ...m10, outils: [{ id: 'inconnu', reussites_requises: 1 }] }, data.outils), /« inconnu » n'existe pas/);

  const { exercise, tools } = engineExercise('m10-tournage-vc', 3, brouillon);
  assert.deepEqual(exercise, { id: 'm10-tournage-vc', titre: m10.titre, version: '3', champs_evalues: ['vc'], outils: m10.outils, groupes: ['P - Acier non allié'], liste: false });
  assert.equal(tools.length, 9);
  assert.ok(tools.every((tool) => !('reussites_requises' in tool) && !('origine' in tool)));
  assert.deepEqual(tools[1].dimensions, outil('mvlnr').dimensions);
});

// --- Erreurs par champ ----------------------------------------------------------------------------------------------

test('toolErrors : chaque erreur nomme son champ ; un outil du catalogue n’en a aucune', () => {
  for (const tool of data.outils) assert.deepEqual(toolErrors(tool, opsByName, materiaux.groupes_iso), [], tool.id);
  const abime = { ...outil('alesoir'), nom: '', fact_vc: 0, nb_dents_max: 1, operation: 'Brochage', dimensions: [{ libelle: 'x', valeur: -1 }], format_identifiant: 'Alésoir [Couleur]' };
  const erreurs = toolErrors(abime, opsByName, materiaux.groupes_iso);
  assert.deepEqual(erreurs.map((e) => e.champ), ['nom', 'fact_vc', 'nb_dents_max', 'operation', 'format_identifiant']);
  assert.match(erreurs[3].message, /opération inconnue/);
  assert.deepEqual(toolErrors(null, opsByName, []), [{ champ: '', message: "n'est pas un objet" }]);
});

test('draftErrors : un brouillon semé n’a aucune erreur ; chaque anomalie nomme son champ (« outils.1.fact_vc »)', () => {
  const valide = draftFromExercise(m10, data.outils);
  assert.deepEqual(draftErrors(valide, tables), []);
  const cas = [
    ['titre vide', (d) => { d.titre = ' '; }, 'titre'],
    ['aucune grandeur', (d) => { d.champs_evalues = []; }, 'champs_evalues'],
    ['grandeur inconnue', (d) => { d.champs_evalues = ['vc', 'rpm']; }, 'champs_evalues'],
    ['grandeur en double', (d) => { d.champs_evalues = ['vc', 'vc']; }, 'champs_evalues'],
    ['liste non booléenne', (d) => { d.liste = 'non'; }, 'liste'],
    ['matière inconnue', (d) => { d.materiaux_outil = ['Céramique']; }, 'materiaux_outil'],
    ['groupe inconnu', (d) => { d.groupes = ['Z - Rien']; }, 'groupes'],
    ['groupes vides', (d) => { d.groupes = []; }, 'groupes'],
    ['clé inconnue', (d) => { d.version = 'r0'; }, 'version'],
    ['aucun outil', (d) => { d.outils = []; }, 'outils'],
    ['identifiant en double', (d) => { d.outils[1].id = 'mclnr'; }, 'outils.1.id'],
    ['réussites à zéro', (d) => { d.outils[2].reussites_requises = 0; }, 'outils.2.reussites_requises'],
    ['facteur nul', (d) => { d.outils[1].fact_vc = 0; }, 'outils.1.fact_vc'],
    ['clé inconnue sur une copie', (d) => { d.outils[0].couleur = 'rouge'; }, 'outils.0.couleur'],
    ['plus aucune matière permise', (d) => { d.materiaux_outil = ['Acier rapide']; }, 'outils.0.materiaux_outil'],
    ['plus aucun groupe permis', (d) => { d.groupes = ['O - Graphite']; }, 'outils.0.groupes_materiaux_usinables'],
    ['copie qui n’est pas un objet', (d) => { d.outils[3] = 'x'; }, 'outils.3'],
  ];
  for (const [nom, abimer, champ] of cas) {
    const brouillon = draftFromExercise(m10, data.outils);
    abimer(brouillon);
    const erreurs = draftErrors(brouillon, tables);
    assert.ok(erreurs.length >= 1, nom);
    assert.equal(erreurs[0].champ, champ, `${nom} : ${JSON.stringify(erreurs)}`);
  }
  assert.deepEqual(draftErrors(null, tables)[0].champ, '');
  assert.ok(draftErrors({}, tables).length >= 3);
});

// --- Identifiants, nettoyage, comparaison ---------------------------------------------------------------------------

test('identifiants : exercice en minuscules et tirets (jamais « index »), outil en minuscules et soulignés ; freeId ajoute _2, _3…', () => {
  assert.deepEqual(['m10-fraisage', 'a', 'x1-y2'].map(isExerciseId), [true, true, true]);
  assert.deepEqual(['index', 'M10', 'm10 fraisage', '', null, 'm10_fraisage', '-a'].map(isExerciseId), [false, false, false, false, false, false, false]);
  assert.deepEqual(['foret_udrill', 'mvlnr', 'x2'].map(isToolId), [true, true, true]);
  assert.deepEqual(['Foret', 'foret-udrill', '_x', ''].map(isToolId), [false, false, false, false]);
  assert.equal(freeId('mvlnr', ['mclnr']), 'mvlnr');
  assert.equal(freeId('mvlnr', ['mvlnr']), 'mvlnr_2');
  assert.equal(freeId('mvlnr', ['mvlnr', 'mvlnr_2', 'mvlnr_3']), 'mvlnr_4');
  assert.equal(freeId('m10', ['m10'], '-'), 'm10-2');
});

test('cleanDraft et cleanTool : ne gardent que les clés connues (et les commentaires « _… » du brouillon) ; sameContent ignore l’ordre des clés et les commentaires', () => {
  assert.deepEqual(cleanDraft({ titre: 'x', outils: [], version: 'r0', _note: 'n' }), { titre: 'x', outils: [], _note: 'n' });
  assert.deepEqual(cleanDraft('x'), {});
  assert.deepEqual(cleanTool({ id: 'a', nom: 'A', reussites_requises: 3, _x: 1 }), { id: 'a', nom: 'A' });
  assert.equal(sameContent({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1, _commentaire: 'x' }), true);
  assert.equal(sameContent({ a: 1 }, { a: 2 }), false);
  assert.equal(sameContent({ a: [1, 2] }, { a: [2, 1] }), false);
});

// --- Aperçu -----------------------------------------------------------------------------------------------------------

test('previewQuestions : dix questions parmi tous les outils, la nomenclature composée, les réponses attendues des grandeurs évaluées seulement', () => {
  const { exercise, tools } = engineExercise('m10-tournage-vc', 1, draftFromExercise({ ...m10, champs_evalues: ['vc', 'n', 'vf'] }, data.outils));
  const questions = previewQuestions(exercise, { ...data, outils: tools }, aleaAGraine(7));
  assert.equal(questions.length, 10);
  assert.ok(new Set(questions.map((q) => q.outil_id)).size >= 3);
  for (const q of questions) {
    assert.ok(m10.outils.some((o) => o.id === q.outil_id));
    assert.deepEqual(Object.keys(q.reponses), ['vc', 'rpm', 'feedRate']);
    assert.match(q.reponses.vc, /^\d+$/);
    assert.equal(typeof q.identifiant, 'string');
    if (q.outil_id === 'barre_a_aleser' || q.outil_id === 'barre_a_rainurer') assert.notEqual(q.barre, null); else assert.equal(q.barre, null);
  }
  assert.deepEqual(previewQuestions(exercise, { ...data, outils: tools }, aleaAGraine(7), 3).map((q) => q.identifiant), questions.slice(0, 3).map((q) => q.identifiant)); // même graine, mêmes tirages
});

// --- Plan d'import --------------------------------------------------------------------------------------------------

test('importPlan : format exigé ; tables, banque, exercices et versions comparés à l’existant ; rien n’est jamais supprimé', () => {
  const existant = {
    tables_reference: [{ id: 'A2026_r0', materiaux, operations, creee_le: 'd' }],
    banque: data.outils.map((o, i) => ({ id: o.id, outil: o, rang: i + 1, archive_le: null })),
    exercices: [{ id: 'm10', brouillon: draftFromExercise(m10, data.outils), versions: [{ numero: 1, contenu: draftFromExercise(m10, data.outils), tables_id: 'A2026_r0' }] }],
  };
  const outils = { tablesErrors: () => [], draftErrorsOf: (d, t) => draftErrors(d, t) };
  assert.match(importPlan({ format: 'x' }, existant, outils).erreurs[0], /n'est pas un export/);
  assert.match(importPlan(null, existant, outils).erreurs[0], /n'est pas un export/);

  const brouillon2 = { ...draftFromExercise(m10, data.outils), titre: 'v2' };
  const recu = {
    format: EXPORT_FORMAT,
    tables_reference: [{ id: 'A2026_r0', materiaux, operations }, { id: 'A2027_r0', materiaux: { ...materiaux, revision: 'A2027_r0' }, operations }],
    banque: existant.banque.slice(0, 2),
    exercices: [
      { id: 'm10', brouillon: brouillon2, versions: [{ numero: 1, contenu: existant.exercices[0].versions[0].contenu, tables_id: 'A2026_r0' }, { numero: 2, contenu: brouillon2, tables_id: 'A2027_r0' }] },
      { id: 'nouveau', brouillon: brouillon2, versions: [] },
    ],
  };
  const { erreurs, plan, resume } = importPlan(recu, existant, outils);
  assert.deepEqual(erreurs, []);
  assert.deepEqual({ ...resume, banque: undefined }, { tables_ajoutees: ['A2027_r0'], banque: undefined, exercices_ajoutes: ['nouveau'], exercices_remplaces: ['m10'], versions_ajoutees: ['m10 v2'], exercices_gardes: [], images_manquantes: [], images_presentes: 0, images_modifiees: [], brouillon_tables: false });
  // La banque reçue n'a que deux outils : les 27 autres disparaîtraient, nommés ; le mot exigé devient REMPLACER (D50).
  assert.deepEqual([resume.banque.ajoutes, resume.banque.modifies, resume.banque.gardes, resume.banque.retires.length], [[], [], 2, 27]);
  assert.deepEqual(resume.banque.retires[0], { id: 'foret_a_numero', nom: 'Foret à numéro' });
  assert.equal(importWord(resume), REPLACE_WORD);
  assert.match(importDetails(resume), /banque : 0 ajouté\(s\), 0 modifié\(s\), 27 retiré\(s\) \(foret_a_numero, /);
  // Une banque complète, avec un outil modifié et un nouveau : rien ne disparaît, le mot reste IMPORTER.
  const complete = { ...recu, banque: [...existant.banque.map((b) => (b.id === 'mvlnr' ? { ...b, outil: { ...b.outil, nom: 'MVLNR bis' } } : b)), { id: 'nouvel_outil', outil: { ...existant.banque[0].outil, id: 'nouvel_outil', nom: 'Nouvel outil' } }] };
  const complet = importPlan(complete, existant, outils).resume.banque;
  assert.deepEqual([complet.ajoutes, complet.modifies, complet.retires, complet.gardes], [[{ id: 'nouvel_outil', nom: 'Nouvel outil' }], [{ id: 'mvlnr', nom: 'MVLNR bis' }], [], 28]);
  assert.equal(importWord(importPlan(complete, existant, outils).resume), IMPORT_WORD);
  assert.deepEqual(plan.versions_ajoutees.map((v) => [v.exercice_id, v.numero, v.tables_id]), [['m10', 2, 'A2027_r0']]);
  assert.deepEqual(plan.exercices_remplaces[0].brouillon.titre, 'v2');

  // Refus : version 1 différente ; tables différentes sous le même id ; version aux tables inconnues ; contenu invalide ; banque vide.
  const autre = structuredClone(recu);
  autre.exercices[0].versions[0].contenu.titre = 'autre';
  assert.match(importPlan(autre, existant, outils).erreurs[0], /version 1 : la base en a une version différente/);
  const tablesAutres = structuredClone(recu);
  tablesAutres.tables_reference[0].materiaux = { ...materiaux, revision: 'x' };
  assert.match(importPlan(tablesAutres, existant, outils).erreurs[0], /« A2026_r0 » : la base en a une version différente/);
  const sansTables = structuredClone(recu);
  sansTables.exercices[0].versions[1].tables_id = 'B';
  assert.match(importPlan(sansTables, existant, outils).erreurs[0], /« B » inconnues/);
  const invalide = structuredClone(recu);
  invalide.exercices[0].versions[1].contenu.outils[0].fact_vc = 0;
  assert.match(importPlan(invalide, existant, outils).erreurs[0], /version 2 : outils\.0\.fact_vc/);
  assert.match(importPlan({ ...recu, banque: [] }, existant, outils).erreurs[0], /banque d'outils de l'export est vide/);
  assert.match(importPlan({ ...recu, banque: [recu.banque[0], recu.banque[0]] }, existant, outils).erreurs[0], /en double/);
});
