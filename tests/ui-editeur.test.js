// Tests de site/js/ui/editeur-data.js (l'éditeur, jalon 7a) : état d'un exercice, différences entre
// versions, dimensions en texte, exemple du gabarit, erreurs par champ, aperçu, sauvegarde — sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import {
  FIELD_CHOICES, FIELD_STATES, IMPORT_WORD, REPLACE_WORD, TOOL_MATERIALS, USAGE_LABELS, archiveConfirmation, canDeleteImage, deducibleWarnings, deleteConfirmation, diffLines, dimensionReadings, dimensionsText, errorsByField, exampleIdentifier, exerciseState, exportFileName, fieldStates, fieldStatesText,
  filterImages, fittedSize, groupSwatch, hasTransparency, imageArchiveConfirmation, imageDeleteConfirmation, imageSizeText, imageUsageLabel, importSummaryLines, importWordFor, insertToken, materialSwatch, parseDimensions, permittedTokens, removeSelectionConfirmation, previewColumns, previewRows, publishState, sessionsLabel, statesToDraft, studentLink, templateTokenList, uploadPlan, versionDiff, versionLabel,
} from '../site/js/ui/editeur-data.js';
import { draftFromExercise } from '../site/js/exercice.js';
import { fittingBars } from '../site/js/data.js';
import { DEFAULT_ISO_CLASSES, DEFAULT_TOOL_MATERIALS } from '../site/js/tables.js';
import { IMPORT_WORD as SERVER_IMPORT_WORD, REPLACE_WORD as SERVER_REPLACE_WORD } from '../worker/editeur.js';
import { aleaAGraine, data, lireFichier } from './aide.js';

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
  assert.match(removeSelectionConfirmation([{ id: 'mvlnr', nom: 'MVLNR' }, { id: 'alesoir', nom: 'Alésoir' }]), /^Retirer 2 outils de l'exercice — MVLNR \(mvlnr\), Alésoir \(alesoir\) \? .*rien n'est perdu avant la publication/);
  assert.match(removeSelectionConfirmation([{ id: 'mvlnr', nom: 'MVLNR' }]), /^Retirer 1 outil de/);
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
  assert.deepEqual(publishState([], diff), { enabled: false, label: 'Aucune différence à publier' }); // D51 : une version identique ne se publie pas
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

test('dimensionReadings : pour un filetage, le Ø et le pas tels que le moteur les lit (pouces, et mm en métrique) ; une ligne illisible est dite ; hors filetage, le Ø ou l’erreur', () => {
  assert.deepEqual(dimensionReadings(['1/4- 20 UNC ; 0.25-20', 'M10 x 1.50 ; 10x1.5', 'M6 ; 6 x 1'].join('\n'), true), [
    { libelle: '1/4- 20 UNC', lecture: 'Ø 0.25 po · pas 0.05 po (20 filets/po)', erreur: null },
    { libelle: 'M10 x 1.50', lecture: 'Ø 10 mm = 0.3937 po · pas 1.5 mm = 0.05906 po', erreur: null },
    { libelle: 'M6', lecture: null, erreur: 'filetage illisible : « 6 x 1 » (attendu « 0.25-20 » ou « 10x1.5 »)' },
  ]);
  assert.deepEqual(dimensionReadings(['Ø 1/4 po ; 0.25', 'Ø 3 po ; abc'].join('\n'), false), [
    { libelle: 'Ø 1/4 po', lecture: 'Ø 0.25 po', erreur: null },
    { libelle: 'Ø 3 po', lecture: null, erreur: 'Ø illisible : « abc » (attendu un Ø en pouces > 0)' },
  ]);
  // Les dimensions des tarauds et barres à fileter du catalogue se lisent toutes.
  for (const tool of data.outils.filter((t) => opsByName.get(t.operation).avance_egale_pas_filetage)) {
    assert.ok(dimensionReadings(dimensionsText(tool.dimensions), true).every((line) => line.erreur === null), tool.id);
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

test('groupSwatch et materialSwatch : les couleurs de sens des tables de la version en usage (D61), celles de tokens.css par défaut (UI §1)', () => {
  assert.deepEqual(groupSwatch('P - Acier non allié'), { background: '#00b0f0', text: '#ffffff', letter: 'P' });
  assert.deepEqual(groupSwatch('K - Fonte grise'), { background: 'color-mix(in srgb, #ff0000 64%, #ffffff)', text: '#ffffff', letter: 'K' }); // le rouge éclairci sur fond nuit
  assert.deepEqual(groupSwatch('O - Graphite').letter, 'O');
  assert.deepEqual(materialSwatch('Acier rapide'), { background: '#b4c7e7', text: '#000000', letter: '' });
  assert.equal(materialSwatch('Insert de carbure de tungstène').background, '#ffc000');
  // Avec une version de tables qui a ses couleurs : ce sont elles.
  const materiaux = { classes_iso: [{ code: 'P', nom: 'Acier', couleur: '#123456', couleur_texte: '#000000', couleur_ligne: '#eeeeee' }], materiaux_outil: [{ cle: 'acier_rapide', nom: 'HSS', couleur: '#abcdef' }] };
  assert.deepEqual(groupSwatch('P - Acier non allié', materiaux), { background: '#123456', text: '#000000', letter: 'P' });
  assert.equal(materialSwatch('HSS', materiaux).background, '#abcdef');
  assert.equal(materialSwatch('Inconnue', materiaux).background, 'var(--color-accent)');
  // Les valeurs par défaut sont celles de tokens.css, à l'identique : la semence des couleurs (D61).
  const tokens = readFileSync(new URL('../site/css/tokens.css', import.meta.url), 'utf8');
  const token = (name) => tokens.match(new RegExp(`${name}: (#[0-9a-f]{6});`))?.[1];
  for (const c of DEFAULT_ISO_CLASSES) {
    const code = c.code.toLowerCase();
    assert.deepEqual([token(`--iso-${code}`), token(`--iso-${code}-text`), token(`--iso-${code}-tint`)], [c.couleur, c.couleur_texte, c.couleur_ligne], c.code);
  }
  for (const m of DEFAULT_TOOL_MATERIALS) assert.equal(token(`--tool-${m.cle.replaceAll('_', '-')}`), m.couleur, m.cle);
  assert.equal(token('--iso-k-night'), '#ff5c5c');
  for (const group of data.materialsByGroup.keys()) assert.match(groupSwatch(group).background, /^(#[0-9a-f]{6}|color-mix)/, group);
});

test('errorsByField : regroupe par champ ; un champ sans place à l’écran va dans la liste générale, avec son nom', () => {
  const map = errorsByField([{ champ: 'titre', message: 'vide' }, { champ: 'outils.1.fact_vc', message: '> 0' }, { champ: 'outils.1.fact_vc', message: 'encore' }, { champ: 'inconnue', message: 'clé inconnue' }], (champ) => champ !== 'inconnue');
  assert.deepEqual([...map.entries()], [['titre', ['vide']], ['outils.1.fact_vc', ['> 0', 'encore']], ['', ['inconnue : clé inconnue']]]);
});

test('previewColumns et previewRows : les cinq grandeurs avec leur état (D52) ; réponse attendue si évaluée, valeur si fournie, « — » si masquée', () => {
  assert.deepEqual(previewColumns(['vc', 'n'], ['fz']), ['N°', 'Outil (nomenclature composée)', "Matière d'outil", 'Matériau usiné', 'Vitesse de coupe (Vc) · évaluée', 'Avance par dent (fz) · masquée', 'RPM (N) · évaluée', 'Avance par révolution (f) · fournie', "Vitesse d'avance (Vf) · fournie"]);
  const question = { identifiant: 'MVLNR - Ø charioté: 2.000"', materiau_outil: 'Insert de carbure de tungstène', materiau: { classe: 'P', groupe: 1, materiau: 'Acier non allié', etat: 'Recuit' }, reponses: { vc: '400', rpm: '800' }, fournies: { feedPerRev: '0.0050', feedRate: '4.000' } };
  assert.deepEqual(previewRows([question], ['vc', 'n'], ['fz']), [['1', 'MVLNR - Ø charioté: 2.000"', 'Insert de carbure de tungstène', 'P 1 — Acier non allié, Recuit', '400', '—', '800', '0.0050', '4.000']]);
});

test('fieldStates, statesToDraft, fieldStatesText (D52) : trois états par grandeur, aller-retour avec le brouillon', () => {
  assert.deepEqual(FIELD_STATES.map((s) => s.key), ['evaluee', 'fournie', 'masquee']);
  assert.deepEqual(fieldStates({ champs_evalues: ['vc', 'n'], champs_masques: ['f'] }), { vc: 'evaluee', fz: 'fournie', n: 'evaluee', f: 'masquee', vf: 'fournie' });
  assert.deepEqual(fieldStates({ champs_evalues: ['vc'] }), { vc: 'evaluee', fz: 'fournie', n: 'fournie', f: 'fournie', vf: 'fournie' });
  assert.deepEqual(statesToDraft({ vc: 'evaluee', fz: 'masquee', n: 'evaluee', f: 'fournie', vf: 'masquee' }), { champs_evalues: ['vc', 'n'], champs_masques: ['fz', 'vf'] });
  assert.deepEqual(statesToDraft({ vc: 'evaluee', fz: 'fournie', n: 'fournie', f: 'fournie', vf: 'fournie' }), { champs_evalues: ['vc'] }); // sans clé champs_masques
  assert.equal(fieldStatesText({ champs_evalues: ['vc', 'n'], champs_masques: ['f'] }), 'Vc évaluée · fz fournie · N évaluée · f masquée · Vf fournie');
  const avant = { ...brouillon() };
  const apres = { ...brouillon(), champs_masques: ['fz', 'f', 'vf'] };
  assert.deepEqual(diffLines(versionDiff(avant, apres)), ['Grandeurs : « Vc évaluée · fz fournie · N fournie · f fournie · Vf fournie » → « Vc évaluée · fz masquée · N fournie · f masquée · Vf masquée »']);
});

test('deducibleWarnings : une grandeur évaluée ou masquée qui se déduit des grandeurs fournies est dite, avec sa relation', () => {
  // Le M10 « vitesse de coupe » : Vc évaluée, tout le reste fourni → Vc se lit dans N (sauf plafond).
  assert.deepEqual(deducibleWarnings({ champs_evalues: ['vc'] }), ['Vc se déduit de N fourni : Vc = N × Ø / (4 × facteur Vc), sauf si N est plafonné par la limite RPM.']);
  // Le M10 « vitesse de coupe et RPM » : Vc et N évaluées → N se déduit de f et Vf fournies ; Vc de rien (N n'est pas fourni).
  assert.deepEqual(deducibleWarnings({ champs_evalues: ['vc', 'n'] }), ['N se déduit de f et Vf fournies : N = Vf / f.']);
  // Une grandeur masquée compte comme à trouver ; une grandeur évaluée n'est jamais une source.
  assert.deepEqual(deducibleWarnings({ champs_evalues: ['vf'], champs_masques: ['n'] }), [
    'N se déduit de Vc fournie : N = Vc × 4 / Ø × facteur Vc, plafonné à la limite RPM.',
  ]);
  assert.deepEqual(deducibleWarnings({ champs_evalues: ['fz', 'f'] }), ['f se déduit de N et Vf fournis : f = Vf / N.']); // fz n'a pas de source (f est à trouver), mais f se lit dans N et Vf
  assert.deepEqual(deducibleWarnings({ champs_evalues: ['fz'] }), ['fz se déduit de f fournie : fz = f / dents.']);
  assert.deepEqual(deducibleWarnings({ champs_evalues: ['f'], champs_masques: ['n'] }), [
    'N se déduit de Vc fournie : N = Vc × 4 / Ø × facteur Vc, plafonné à la limite RPM.',
    'f se déduit de fz fournie : f = fz × dents.',
  ]);
  assert.deepEqual(deducibleWarnings({ champs_evalues: ['vc'], champs_masques: ['fz', 'f', 'vf'] }), [
    'Vc se déduit de N fourni : Vc = N × Ø / (4 × facteur Vc), sauf si N est plafonné par la limite RPM.',
  ]);
  // Deux des trois de Vf = N × f fournies donnent la troisième ; l'ordre est celui de l'écran.
  assert.deepEqual(deducibleWarnings({ champs_evalues: ['f'], champs_masques: ['fz'] }), ['f se déduit de N et Vf fournis : f = Vf / N.']); // fz masquée n'a pas f pour source : f est à trouver
  assert.deepEqual(deducibleWarnings({ champs_evalues: ['vf'] }), ['Vf se déduit de N et f fournis : Vf = N × f.']);
  // Sans effet sur la publication : publishState ne la connaît pas.
  assert.deepEqual(publishState([], versionDiff(null, { ...brouillon(), champs_evalues: ['vc'] })), { enabled: true, label: 'Publier…' });
});

test('sauvegarde : nom du fichier d’export, résumé d’un import en phrases, images à envoyer avant l’import (D59)', () => {
  assert.equal(exportFileName(new Date(2026, 8, 24, 13, 5)), 'quiz-parametres-coupe-exercices-2026-09-24.json');
  const banque = { ajoutes: [{ id: 'x', nom: 'Fraise X' }], modifies: [], retires: [], gardes: 28 };
  const resume = { tables_ajoutees: [], banque, exercices_ajoutes: ['nouveau'], exercices_remplaces: ['m10'], versions_ajoutees: ['m10 v2'], exercices_gardes: [], images_manquantes: [], images_presentes: 48, images_modifiees: [] };
  const lines = importSummaryLines(resume);
  assert.deepEqual(lines.slice(0, 5), ['Images : 48 déjà dans la base ; aucune à envoyer.', 'Tables de référence ajoutées : aucun.', "Banque d'outils — ajoutés : Fraise X (x) ; modifiés : aucun ; inchangés : 28.", "Banque d'outils — aucun outil ne disparaît.", 'Exercices ajoutés : nouveau.']);
  assert.equal(lines.at(-1), 'Les séances, les journaux et les attestations ne sont pas touchés.');
  assert.equal(importSummaryLines({ ...resume, images_manquantes: ['img-1', 'img-2'], images_modifiees: ['mvlnr'] })[0], "Images : 48 déjà dans la base ; 2 à envoyer avant l'import (une par requête) ; 1 fiche(s) mise(s) à jour (nom, archivage).");
  assert.equal(importSummaryLines({ ...resume, images_manquantes: undefined, images_presentes: undefined })[0], 'Images : 0 déjà dans la base ; aucune à envoyer.'); // un export d'avant les images
  assert.equal(importWordFor(resume), IMPORT_WORD);
  // Des outils disparaîtraient (D50) : nommés, et le mot devient REMPLACER.
  const perte = { ...resume, banque: { ...banque, retires: [{ id: 'mvlnr', nom: 'MVLNR' }, { id: 'alesoir', nom: 'Alésoir' }] } };
  assert.match(importSummaryLines(perte)[3], /^Banque d'outils — DISPARAÎTRAIENT : MVLNR \(mvlnr\), Alésoir \(alesoir\)\. .* taper REMPLACER\.$/);
  assert.equal(importWordFor(perte), REPLACE_WORD);
  assert.deepEqual([IMPORT_WORD, REPLACE_WORD], ['IMPORTER', 'REMPLACER']);
  assert.deepEqual([IMPORT_WORD, REPLACE_WORD], [SERVER_IMPORT_WORD, SERVER_REPLACE_WORD]); // les mêmes mots des deux côtés
});

test('exampleIdentifier avec un aléa (« Autre exemple », D58) : des valeurs tirées dans l’outil, jamais hors de lui ; sans aléa, toujours les premières', () => {
  const alesoir = data.outils.find((o) => o.id === 'alesoir');
  const seen = new Set();
  for (let i = 0; i < 40; i += 1) {
    const example = exampleIdentifier(alesoir, opsByName, aleaAGraine(i));
    const [, dia, dents] = example.match(/^Alésoir (.+) - (\d+) lèvres$/);
    assert.ok(alesoir.dimensions.some((d) => d.libelle === dia), example);
    assert.ok(Number(dents) >= alesoir.nb_dents_min && Number(dents) <= alesoir.nb_dents_max, example);
    seen.add(example);
  }
  assert.ok(seen.size > 3, 'les exemples varient');
  const barre = data.outils.find((o) => o.id === 'barre_a_aleser');
  for (let i = 0; i < 20; i += 1) {
    const [, bar, hole] = exampleIdentifier(barre, opsByName, aleaAGraine(i)).match(/^Barre à aléser Ø (.+) - Ø alésé: (.+)$/);
    const dimension = barre.dimensions.find((d) => d.libelle === hole);
    assert.ok(fittingBars(barre, dimension.valeur).some((b) => b.libelle === bar), `${bar} n'entre pas dans ${hole}`);
  }
  assert.equal(exampleIdentifier(alesoir, opsByName, () => 0.999), `Alésoir ${alesoir.dimensions.at(-1).libelle} - ${alesoir.nb_dents_max} lèvres`);
  assert.equal(exampleIdentifier(alesoir, opsByName), 'Alésoir 0.1250" - 6 lèvres');
});

test('permittedTokens et insertToken (D58) : [Pas] pour un filetage seulement, [IdBarre] avec des barres seulement ; insertion à la place de la sélection', () => {
  const tokens = (id) => permittedTokens(data.outils.find((o) => o.id === id), opsByName).map((t) => t.token);
  assert.deepEqual(tokens('mvlnr'), ['IdDia', 'Dia', 'NbDent', 'NomOutil', 'Operation', 'Matoutil']);
  assert.deepEqual(tokens('taraud_metrique'), ['IdDia', 'Dia', 'Pas', 'NbDent', 'NomOutil', 'Operation', 'Matoutil']);
  assert.deepEqual(tokens('barre_a_aleser'), ['IdDia', 'Dia', 'IdBarre', 'NbDent', 'NomOutil', 'Operation', 'Matoutil']);
  assert.ok(permittedTokens(data.outils[0], opsByName).every((t) => typeof t.label === 'string' && t.label !== ''));
  assert.deepEqual(insertToken('Foret ', 6, 6, 'IdDia'), { text: 'Foret [IdDia]', caret: 13 });
  assert.deepEqual(insertToken('Foret [Dia] x', 6, 11, 'IdDia'), { text: 'Foret [IdDia] x', caret: 13 });
  assert.deepEqual(insertToken(undefined, 0, 0, 'NomOutil'), { text: '[NomOutil]', caret: 10 });
});

test('images (D56) : plan de réduction avant l’envoi, taille cible jamais agrandie, galerie filtrée sans casse ni accents, libellés', () => {
  assert.deepEqual(uploadPlan('outil', false), { resize: true, maxSide: 800, type: 'image/jpeg', quality: 0.85, background: '#ffffff' });
  assert.deepEqual(uploadPlan('outil', false, false), uploadPlan('outil', false));
  // Une photo avec de la transparence garde le PNG, sans fond blanc (D60) ; un pictogramme est en PNG de toute façon.
  assert.deepEqual(uploadPlan('outil', false, true), { resize: true, maxSide: 800, type: 'image/png', quality: undefined, background: null });
  assert.deepEqual(uploadPlan('operation', false), { resize: true, maxSide: 256, type: 'image/png', quality: undefined, background: null });
  assert.deepEqual(uploadPlan('operation', false, true), uploadPlan('operation', false));
  assert.deepEqual(uploadPlan('operation', true), { resize: false, type: 'image/svg+xml' });
  assert.deepEqual(uploadPlan('outil', true, true), { resize: false, type: 'image/svg+xml' });
  // hasTransparency : un seul pixel non opaque suffit ; une image vide ou toute opaque n'en a pas.
  assert.equal(hasTransparency(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255])), false);
  assert.equal(hasTransparency(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 254])), true);
  assert.equal(hasTransparency(new Uint8ClampedArray([0, 0, 0, 0])), true);
  assert.equal(hasTransparency(new Uint8ClampedArray([])), false);
  assert.deepEqual(fittedSize(4000, 3000, 800), { width: 800, height: 600 });
  assert.deepEqual(fittedSize(300, 1200, 800), { width: 200, height: 800 });
  assert.deepEqual(fittedSize(100, 50, 800), { width: 100, height: 50 }); // jamais agrandie
  const images = [
    { id: 'mvlnr', nom: 'MVLNR', usage: 'outil', archivee_le: null },
    { id: 'alesoir', nom: 'Alésoir', usage: 'outil', archivee_le: null },
    { id: 'alesoir_2', nom: 'Alésoir', usage: 'outil', archivee_le: '2026-09-24T13:00:00.000Z' },
    { id: 'percage', nom: 'Perçage', usage: 'operation', archivee_le: null },
    { id: 'img-abc', nom: 'Fraise à rainurer', usage: 'outil', archivee_le: null },
  ];
  assert.deepEqual(filterImages(images, { usage: 'outil' }).map((i) => i.id), ['mvlnr', 'alesoir', 'img-abc']);
  assert.deepEqual(filterImages(images, { usage: 'outil', query: 'ALES' }).map((i) => i.id), ['alesoir']);
  assert.deepEqual(filterImages(images, { usage: 'outil', query: 'alésoir', current: 'alesoir_2' }).map((i) => i.id), ['alesoir', 'alesoir_2']); // l'archivée déjà choisie reste visible
  assert.deepEqual(filterImages(images, { usage: 'outil', query: 'abc' }).map((i) => i.id), ['img-abc']); // par l'identifiant aussi
  assert.deepEqual(filterImages(images, { usage: 'operation' }).map((i) => i.id), ['percage']);
  assert.deepEqual([6527, 15816, 1_234_567].map(imageSizeText), ['6.5 Ko', '16 Ko', '1.2 Mo']);
  assert.equal(imageUsageLabel({ versions: ['m10 v1', 'm10 v2'], brouillons: ['m10'], banque: ['mvlnr'], tables: [] }), '2 versions publiées · 1 brouillon · 1 outil de la banque');
  assert.equal(imageUsageLabel({ versions: [], brouillons: [], banque: [], tables: ['A2026_r0'] }), '1 version des tables');
  assert.equal(imageUsageLabel({ versions: [], brouillons: [], banque: [], tables: [] }), 'jamais utilisée');
  assert.equal(canDeleteImage({ versions: [], brouillons: [], banque: [], tables: [] }), true);
  assert.equal(canDeleteImage({ versions: [], brouillons: ['x'], banque: [], tables: [] }), false);
  assert.match(imageDeleteConfirmation({ id: 'img-abc', nom: 'Fraise' }), /^Supprimer l'image « Fraise » \(img-abc\)/);
  assert.match(imageArchiveConfirmation({ id: 'mvlnr', nom: 'MVLNR' }), /toujours/);
  assert.deepEqual(Object.keys(USAGE_LABELS), ['outil', 'operation']);
});

test('site/img/outils/ : une photo de semence par outil du catalogue (la liste des images vient de la base, D56)', async () => {
  const files = (await readdir(new URL('../site/img/outils/', import.meta.url))).filter((name) => name.endsWith('.png')).sort();
  for (const tool of data.outils) assert.ok(files.includes(`${tool.image ?? tool.id}.png`), `${tool.id} : photo manquante`);
});
