// Tests de site/js/ui/editeur-data.js (l'éditeur, jalon 7a) : état d'un exercice, différences entre
// versions, dimensions en texte, exemple du gabarit, erreurs par champ, aperçu, sauvegarde — sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import {
  FIELD_CHOICES, TOOL_MATERIALS, archiveConfirmation, deleteConfirmation, diffLines, dimensionsText, errorsByField, exampleIdentifier, exerciseState, exportFileName,
  importSummaryLines, parseDimensions, previewColumns, previewRows, publishState, sessionsLabel, studentLink, templateTokenList, versionDiff, versionLabel,
} from '../site/js/ui/editeur-data.js';
import { draftFromExercise } from '../site/js/exercice.js';
import { data, lireFichier } from './aide.js';

const m10 = await lireFichier('exercices/m10-tournage-vc.json');
const brouillon = () => draftFromExercise(m10, data.outils);
const opsByName = data.operationByName;
const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi).toISOString();

const ROW = { id: 'm10-tournage-vc', titre: 'M10', modifie: false, derniere_version: 2, publie_le: at(2026, 9, 24, 13, 5), archive_le: null, seances: 3, versions: [{ numero: 2, seances: 1 }, { numero: 1, seances: 2 }], liste: true };

test('exerciseState, versionLabel, sessionsLabel : l’état en clair', () => {
  assert.equal(exerciseState(ROW), 'À jour');
  assert.equal(exerciseState({ ...ROW, modifie: true }), 'Brouillon modifié');
  assert.equal(exerciseState({ ...ROW, derniere_version: null, publie_le: null }), 'Jamais publié');
  assert.equal(exerciseState({ ...ROW, archive_le: at(2026, 9, 25, 8, 0) }), 'Archivé');
  assert.equal(versionLabel(ROW), 'v2 · 2026-09-24 13:05');
  assert.equal(versionLabel({ ...ROW, derniere_version: null }), '—');
  assert.equal(sessionsLabel(ROW), '3 séances (v2 : 1, v1 : 2)');
  assert.equal(sessionsLabel({ ...ROW, seances: 1, versions: [{ numero: 1, seances: 1 }] }), '1 séance (v1 : 1)');
  assert.equal(sessionsLabel({ ...ROW, seances: 0, versions: [] }), 'aucune');
  assert.equal(studentLink('https://quiz.example', 'm10-tournage-vc'), 'https://quiz.example/?exercice=m10-tournage-vc');
  assert.match(archiveConfirmation(ROW), /Archiver « M10 »/);
  assert.match(deleteConfirmation(ROW), /Supprimer « M10 » \(m10-tournage-vc\)/);
  assert.deepEqual(FIELD_CHOICES.map((f) => f.key), ['vc', 'fz', 'n', 'f', 'vf']);
  assert.deepEqual(TOOL_MATERIALS, ['Acier rapide', 'Carbure de tungstène solide', 'Insert de carbure de tungstène']);
});

test('versionDiff et diffLines : première publication ; réglages, outils ajoutés, retirés, modifiés champ par champ, réordonnés ; aucune différence', () => {
  const avant = brouillon();
  assert.deepEqual(diffLines(versionDiff(null, avant)), ['Première publication : 9 outils.']);
  const apres = brouillon();
  apres.titre = 'M10 v2';
  apres.materiaux_outil = ['Acier rapide'];
  apres.outils[1].fact_vc = 0.5;
  apres.outils[1].dimensions = apres.outils[1].dimensions.slice(0, 2);
  apres.outils[2].reussites_requises = 1;
  apres.outils.splice(0, 1); // le MCLNR retiré
  apres.outils.push({ ...brouillon().outils[0], id: 'mclnr_2', nom: 'MCLNR bis', reussites_requises: 2 });
  const diff = versionDiff(avant, apres);
  assert.deepEqual(diff.reglages.map((r) => [r.champ, r.avant, r.apres]), [['titre', 'M10 — Tournage : vitesse de coupe', 'M10 v2'], ['materiaux_outil', '(tous)', 'Acier rapide']]);
  assert.deepEqual(diff.ajoutes.map((c) => c.id), ['mclnr_2']);
  assert.deepEqual(diff.retires.map((c) => c.id), ['mclnr']);
  assert.deepEqual(diff.modifies.map((m) => [m.id, m.champs.map((c) => c.champ)]), [['mvlnr', ['fact_vc', 'dimensions']], ['lame_a_tronconner', ['reussites_requises']]]);
  assert.equal(diff.reordonnes, false);
  const lines = diffLines(diff);
  assert.deepEqual(lines.slice(0, 4), [
    'Titre : « M10 — Tournage : vitesse de coupe » → « M10 v2 »',
    "Matières d'outil permises : « (tous) » → « Acier rapide »",
    'Outil ajouté : MCLNR bis (mclnr_2), 2 réussites de suite',
    'Outil retiré : MCLNR (mclnr)',
  ]);
  assert.match(lines[4], /^MVLNR \(mvlnr\) — fact_vc : « 1 » → « 0.5 »$/);
  assert.match(lines[5], /^MVLNR \(mvlnr\) — dimensions : « 1\.000", .* » → « 1\.000", 1\.500" »$/);
  assert.deepEqual(diffLines(versionDiff(avant, brouillon())), ['Aucune différence avec la version précédente.']);
  const reordonne = brouillon();
  [reordonne.outils[0], reordonne.outils[1]] = [reordonne.outils[1], reordonne.outils[0]];
  assert.deepEqual(diffLines(versionDiff(avant, reordonne)), ["L'ordre des outils a changé."]);
});

test('publishState : désactivé tant qu’il reste des erreurs ; le libellé dit combien, ou « aucune différence »', () => {
  const diff = versionDiff(brouillon(), brouillon());
  assert.deepEqual(publishState([{ champ: 'titre', message: 'x' }], diff), { enabled: false, label: 'Publier (1 erreur à corriger)' });
  assert.deepEqual(publishState([{}, {}], diff), { enabled: false, label: 'Publier (2 erreurs à corriger)' });
  assert.deepEqual(publishState([], diff), { enabled: true, label: 'Publier (aucune différence)' });
  assert.deepEqual(publishState([], versionDiff(null, brouillon())), { enabled: true, label: 'Publier…' });
});

test('dimensionsText et parseDimensions : une dimension par ligne, « libellé ; valeur », aller-retour ; virgule acceptée ; filetage en texte', () => {
  const dims = [{ libelle: 'Ø 1/4 po', valeur: 0.25 }, { libelle: 'Ø 1/2 po', valeur: 0.5 }];
  assert.equal(dimensionsText(dims), 'Ø 1/4 po ; 0.25\nØ 1/2 po ; 0.5');
  assert.deepEqual(parseDimensions(dimensionsText(dims)), dims);
  assert.deepEqual(parseDimensions(' Ø 3 po ; 3,0 \n\n'), [{ libelle: 'Ø 3 po', valeur: 3 }]);
  assert.deepEqual(parseDimensions('1/4- 20 UNC ; 0.25-20\r\nM10 x 1.5 ; 10x1.5', true), [{ libelle: '1/4- 20 UNC', valeur: '0.25-20' }, { libelle: 'M10 x 1.5', valeur: '10x1.5' }]);
  assert.deepEqual(parseDimensions('sans valeur'), [{ libelle: 'sans valeur', valeur: '' }]); // laissé au validateur : « Ø en pouces > 0 »
  assert.deepEqual(parseDimensions('x ; abc'), [{ libelle: 'x', valeur: 'abc' }]);
  assert.deepEqual(parseDimensions(undefined), []);
  assert.equal(dimensionsText(undefined), '');
  // Les vraies dimensions du catalogue survivent à l'aller-retour, filetages compris.
  for (const tool of data.outils) {
    const thread = opsByName.get(tool.operation).avance_egale_pas_filetage;
    assert.deepEqual(parseDimensions(dimensionsText(tool.dimensions), thread), tool.dimensions, tool.id);
  }
});

test('exampleIdentifier : le gabarit résolu avec la première dimension, la première matière, la première barre qui entre ; un jeton sans valeur reste tel quel', () => {
  assert.equal(exampleIdentifier(data.outils.find((o) => o.id === 'mvlnr'), opsByName), 'MVLNR - Ø charioté: 1.000"');
  assert.equal(exampleIdentifier(data.outils.find((o) => o.id === 'alesoir'), opsByName), 'Alésoir 0.1250" - 6 lèvres');
  assert.match(exampleIdentifier(data.outils.find((o) => o.id === 'barre_a_aleser'), opsByName), /^Barre à aléser Ø 1\/2 po - Ø alésé: /);
  assert.match(exampleIdentifier(data.outils.find((o) => o.id === 'taraud_metrique'), opsByName), /^Taraud /);
  assert.equal(exampleIdentifier({ format_identifiant: '[NomOutil] [IdDia] [Pas] [Couleur]', nom: 'X', dimensions: [], operation: 'Perçage' }, opsByName), 'X [IdDia] [Pas] [Couleur]');
  assert.equal(exampleIdentifier({}, opsByName), '');
  assert.deepEqual(templateTokenList('Alésoir [IdDia] - [NbDent] lèvres'), ['IdDia', 'NbDent']);
  assert.deepEqual(templateTokenList(null), []);
});

test('errorsByField : regroupe par champ ; un champ sans place à l’écran va dans la liste générale, avec son nom', () => {
  const map = errorsByField([{ champ: 'titre', message: 'vide' }, { champ: 'outils.1.fact_vc', message: '> 0' }, { champ: 'outils.1.fact_vc', message: 'encore' }, { champ: 'inconnue', message: 'clé inconnue' }], (champ) => champ !== 'inconnue');
  assert.deepEqual([...map.entries()], [['titre', ['vide']], ['outils.1.fact_vc', ['> 0', 'encore']], ['', ['inconnue : clé inconnue']]]);
});

test('previewColumns et previewRows : une colonne par grandeur évaluée, le matériau usiné en clair', () => {
  assert.deepEqual(previewColumns(['vc', 'n']), ['N°', 'Outil (nomenclature composée)', "Matière d'outil", 'Matériau usiné', 'Vitesse de coupe (Vc)', 'RPM (N)']);
  const rows = previewRows([{ identifiant: 'MVLNR - Ø charioté: 2.000"', materiau_outil: 'Insert de carbure de tungstène', materiau: { classe: 'P', groupe: 1, materiau: 'Acier non allié', etat: 'Recuit' }, reponses: { vc: '400', rpm: '800' } }], ['vc', 'n']);
  assert.deepEqual(rows, [['1', 'MVLNR - Ø charioté: 2.000"', 'Insert de carbure de tungstène', 'P 1 — Acier non allié, Recuit', '400', '800']]);
});

test('sauvegarde : nom du fichier d’export, résumé d’un import en phrases', () => {
  assert.equal(exportFileName(new Date(2026, 8, 24, 13, 5)), 'quiz-parametres-coupe-exercices-2026-09-24.json');
  const lines = importSummaryLines({ tables_ajoutees: [], banque: 29, exercices_ajoutes: ['nouveau'], exercices_remplaces: ['m10'], versions_ajoutees: ['m10 v2'], exercices_gardes: [] });
  assert.deepEqual(lines.slice(0, 3), ['Tables de référence ajoutées : aucun.', "Banque d'outils : remplacée par les 29 outils de l'export.", 'Exercices ajoutés : nouveau.']);
  assert.equal(lines.at(-1), 'Les séances, les journaux et les attestations ne sont pas touchés.');
});

test('site/img/outils/index.json : la liste des photos est celle du dossier (l’éditeur ne peut pas lister un dossier)', async () => {
  const manifest = await lireFichier('img/outils/index.json');
  const files = (await readdir(new URL('../site/img/outils/', import.meta.url))).filter((name) => name.endsWith('.png')).sort();
  assert.deepEqual([...manifest.images].sort(), files);
  for (const tool of data.outils) assert.ok(files.includes(`${tool.image ?? tool.id}.png`), `${tool.id} : photo manquante`);
});
