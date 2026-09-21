// Tests de site/js/ui/rules.js et sheets-data.js : règles d'affichage de l'écran Question et contenu
// des feuilles de référence, sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { factorLines, feedFamily, gapExplanation, helpLine, labeledIdentifier, progressRows, toolLabels, toolMaterialColor, toolStreak } from '../site/js/ui/rules.js';
import { feedSheet, inches, operationPicto, operationSlug, vcSheet } from '../site/js/ui/sheets-data.js';
import { data, lireFichier } from './aide.js';

const m10 = await lireFichier('exercices/m10-tournage-vc.json');
const exerciceAvec = (...ids) => ({ outils: ids.map((id) => ({ id, reussites_requises: 1 })) });

// --- Outils de même nom -------------------------------------------------------------------------------------------

test('toolLabels (M10) : SDTMR et Barre à fileter reçoivent leur unité ; les autres noms ne changent pas', () => {
  const labels = toolLabels(m10, data);
  assert.deepEqual([...labels.values()], [
    'MCLNR', 'MVLNR', 'Lame à tronçonner', 'Barre à fileter (impérial)', 'Barre à fileter (métrique)',
    'Barre à rainurer', 'Barre à aléser', 'SDTMR (impérial)', 'SDTMR (métrique)',
  ]);
  assert.equal(data.outils.find((tool) => tool.id === 'sdtmr_2').nom, 'SDTMR'); // la donnée ne change pas
});

test('toolLabels : un seul des deux homonymes dans l’exercice → pas de parenthèse ; même unité → la plage de dimensions', () => {
  assert.deepEqual([...toolLabels(exerciceAvec('sdtmr_2', 'mvlnr'), data).values()], ['SDTMR', 'MVLNR']);
  assert.deepEqual([...toolLabels(exerciceAvec('foret_fractionnaire', 'foret_fractionnaire_2'), data).values()], [
    'Foret fractionnaire (Ø 1/64 po à Ø 1 po)', 'Foret fractionnaire (Ø 1 po à Ø 2 po)',
  ]);
});

test('toolLabels : avec tout le catalogue dans un exercice, aucun nom affiché n’est en double', () => {
  const labels = [...toolLabels(exerciceAvec(...data.outils.map((tool) => tool.id)), data).values()];
  assert.equal(new Set(labels).size, data.outils.length, labels.join(' | '));
});

test('labeledIdentifier : le nom à afficher dans l’en-tête de la question', () => {
  const labels = toolLabels(m10, data);
  assert.equal(labeledIdentifier({ identifiant: 'SDTMR - filetage: M64 x 6', outil: { id: 'sdtmr_2', nom: 'SDTMR' } }, labels), 'SDTMR (métrique) - filetage: M64 x 6');
  assert.equal(labeledIdentifier({ identifiant: 'MVLNR - Ø charioté: 2.000"', outil: { id: 'mvlnr', nom: 'MVLNR' } }, labels), 'MVLNR - Ø charioté: 2.000"');
  assert.equal(labeledIdentifier({ identifiant: 'Foret Ø 1/4 po', outil: { id: 'foret_fractionnaire', nom: 'Foret fractionnaire' } }, new Map()), 'Foret Ø 1/4 po');
});

// --- Panneau de l'outil -----------------------------------------------------------------------------------------------

test('toolMaterialColor : la variable CSS du matériau d’outil (UI §1)', () => {
  assert.equal(toolMaterialColor('Acier rapide'), '--tool-acier-rapide');
  assert.equal(toolMaterialColor('Carbure de tungstène solide'), '--tool-carbure-solide');
  assert.equal(toolMaterialColor('Insert de carbure de tungstène'), '--tool-insert-carbure');
  assert.equal(toolMaterialColor('Céramique'), '--color-accent');
});

test('factorLines : un facteur n’apparaît que s’il diffère de 1', () => {
  assert.deepEqual(factorLines({ fact_vc: 1, fact_av: 1 }), []);
  assert.deepEqual(factorLines({ fact_vc: 0.25, fact_av: 1 }), ['Vitesse réduite × 0.25']);
  assert.deepEqual(factorLines({ fact_vc: 0.125, fact_av: 1.5 }), ['Vitesse réduite × 0.125', 'Avance augmentée × 1.5']);
});

test('feedFamily : filetage, proportionnelle au Ø, fixe — comme calcul.js', () => {
  assert.equal(feedFamily(data.operationByName.get('Taraudage')), 'thread');
  assert.equal(feedFamily(data.operationByName.get('Perçage')), 'proportional');
  assert.equal(feedFamily(data.operationByName.get('Chariotage finition')), 'fixed');
  assert.equal(feedFamily(undefined), 'fixed');
});

// --- Aide contextuelle ----------------------------------------------------------------------------------------------------

const texte = (aide) => aide.parts.map((part) => part.text).join('');
const QUESTION = { outil: { id: 'alesoir', nom: 'Alésoir', fact_vc: 0.25, fact_av: 1 } };

test('helpLine : la méthode, jamais la valeur, sans nommer la ligne ni la colonne (UI §3.3)', () => {
  const vc = helpLine('vc', QUESTION, 'proportional');
  assert.equal(texte(vc), "Vitesse de coupe → table des vitesses de coupe : le matériau brut donne la ligne, le matériau de l'outil donne la colonne.");
  assert.deepEqual(vc.parts.filter((part) => part.accent).map((part) => [part.text, part.accent]), [['matériau brut', 'material'], ["matériau de l'outil", 'tool']]);
  assert.equal(vc.table, 'vc');

  assert.equal(texte(helpLine('feedPerTooth', QUESTION, 'proportional')), "Avance par dent → table des avances, à l'opération de l'outil. Avance proportionnelle au Ø : avance × Ø outil, sans dépasser l’avance max.");
  assert.equal(texte(helpLine('feedPerTooth', QUESTION, 'thread')), "Avance par dent → table des avances, à l'opération de l'outil. Filetage : fz = pas = 1 / filets au pouce (ou mm / 25.4).");
  assert.equal(texte(helpLine('feedPerTooth', QUESTION, 'fixed')), "Avance par dent → table des avances, à l'opération de l'outil.");
  assert.equal(helpLine('feedPerTooth', QUESTION, 'fixed').table, 'avances');

  assert.equal(texte(helpLine('rpm', QUESTION, 'fixed')), 'RPM → N = Vc × 4 / Ø, plafonnée au RPM max de la machine, × 0.25 pour cet outil.');
  assert.equal(texte(helpLine('rpm', { outil: { fact_vc: 1 } }, 'fixed')), 'RPM → N = Vc × 4 / Ø, plafonnée au RPM max de la machine.');
  assert.equal(texte(helpLine('feedPerRev', QUESTION, 'fixed')), 'Avance totale par révolution → f = fz × nombre de dents.');
  assert.equal(texte(helpLine('feedRate', QUESTION, 'fixed')), "Vitesse d'avance → Vf = N × f.");
  for (const champ of ['rpm', 'feedPerRev', 'feedRate']) assert.equal(helpLine(champ, QUESTION, 'fixed').table, null);
  for (const champ of ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate']) assert.doesNotMatch(texte(helpLine(champ, QUESTION, 'thread')), /\d{3}/, champ); // aucune valeur
});

// --- Question corrigée -------------------------------------------------------------------------------------------------------

test('gapExplanation : l’écart et la tolérance de chaque champ faux (UI §3.4)', () => {
  const correction = { champs: [
    { champ: 'vc', evalue: true, ok: true, saisie: '390', attendu: '390', tolerance: 'exacte', ecart_pct: 0 },
    { champ: 'rpm', evalue: true, ok: true, saisie: '2500', attendu: '2496', tolerance: '±5 %', ecart_pct: 0.2 },
    { champ: 'feedPerRev', evalue: false, ok: true, saisie: '', attendu: '0.0050', tolerance: null, ecart_pct: null },
    { champ: 'feedRate', evalue: true, ok: false, saisie: '13.2', attendu: '12.500', tolerance: '±0.5 % de N × f', ecart_pct: 5.6 },
  ] };
  assert.equal(gapExplanation(correction), 'Ta Vf de 13.2 est à +5.6 % de 12.500 (tolérance : ±0.5 % de N × f).');

  const deux = { champs: [
    { champ: 'vc', evalue: true, ok: false, saisie: '1', attendu: '570', tolerance: 'exacte', ecart_pct: -99.8 },
    { champ: 'rpm', evalue: true, ok: false, saisie: 'abc', attendu: '905', tolerance: '±5 %', ecart_pct: null },
  ] };
  assert.equal(gapExplanation(deux), 'Ta Vc de 1 est à −99.8 % de 570 (la réponse doit être exacte). N : réponse vide ou illisible (attendu 905).');
  assert.equal(gapExplanation({ champs: correction.champs.slice(0, 3) }), '');
});

// --- Progression -------------------------------------------------------------------------------------------------------------

test('progressRows : un point par réussite consécutive ; outil en cours, remis à zéro, réussi', () => {
  const progression = { outils: [
    { id: 'mclnr', nom: 'MCLNR', reussites: 1, requises: 1 },
    { id: 'mvlnr', nom: 'MVLNR', reussites: 2, requises: 3 },
    { id: 'sdtmr_2', nom: 'SDTMR', reussites: 0, requises: 1 },
  ] };
  const labels = toolLabels(m10, data);
  assert.deepEqual(progressRows(progression, labels, { currentId: 'mvlnr' }), [
    { id: 'mclnr', label: 'MCLNR', dots: [true], state: 'done' },
    { id: 'mvlnr', label: 'MVLNR', dots: [true, true, false], state: 'current' },
    { id: 'sdtmr_2', label: 'SDTMR (métrique)', dots: [false], state: 'todo' },
  ]);
  assert.equal(progressRows(progression, labels, { currentId: 'sdtmr_2', resetId: 'mvlnr' })[1].state, 'reset');
  assert.equal(progressRows(progression, new Map())[2].label, 'SDTMR');
});

test('toolStreak : « Sur cet outil : n réussites de suite sur m »', () => {
  const progression = { outils: [{ id: 'mvlnr', reussites: 2, requises: 3 }, { id: 'mclnr', reussites: 1, requises: 1 }, { id: 'sdtmr', reussites: 0, requises: 1 }] };
  assert.equal(toolStreak(progression, 'mvlnr'), 'Sur cet outil : 2 réussites de suite sur 3');
  assert.equal(toolStreak(progression, 'mclnr'), 'Sur cet outil : 1 réussite de suite sur 1');
  assert.equal(toolStreak(progression, 'sdtmr'), 'Sur cet outil : 0 réussite de suite sur 1');
  assert.equal(toolStreak(progression, 'inconnu'), '');
});

// --- Feuilles de référence -----------------------------------------------------------------------------------------------------

test('inches : une avance comme sur la feuille de l’atelier', () => {
  assert.deepEqual([0.006, 0.0015, 0.01, 0.001, 0.00025].map(inches), ['.006"', '.0015"', '.010"', '.001"', '.00025"']);
});

test('operationSlug et pictogrammes : chaque opération du catalogue a son fichier dans site/img/pictos/operations/', () => {
  assert.equal(operationSlug('Chanfreinage / ébavurage'), 'chanfreinage_ebavurage');
  assert.equal(operationSlug("Alésage à l'alésoir"), 'alesage_a_l_alesoir');
  for (const operation of data.operations) {
    assert.ok(existsSync(new URL(`../site/${operationPicto(operation.operation)}`, import.meta.url)), `${operationPicto(operation.operation)} est absent`);
  }
});

test('pictogrammes de grandeurs : les six fichiers SVG de site/img/pictos/grandeurs/ (UI §5)', () => {
  for (const grandeur of ['vc', 'fz', 'n', 'f', 'vf', 'pas']) {
    assert.ok(existsSync(new URL(`../site/img/pictos/grandeurs/${grandeur}.svg`, import.meta.url)), `${grandeur}.svg est absent`);
  }
});

test('vcSheet : toutes les lignes du catalogue, les trois colonnes de matériau d’outil', () => {
  const feuille = vcSheet(data);
  assert.equal(feuille.rows.length, 47);
  assert.deepEqual(feuille.columns.map((column) => column.key), ['acier_rapide', 'carbure_solide', 'insert_carbure']);
  for (const row of feuille.rows) for (const { key } of feuille.columns) assert.equal(typeof row.vc_pi_min[key], 'number');
});

test('feedSheet : une opération par rang, barre proportionnelle à l’avance, texte de la barre', () => {
  const feuille = feedSheet(data);
  assert.equal(feuille.rows.length, 19);
  const rang = (nom) => feuille.rows.find((row) => row.operation === nom);
  assert.deepEqual([rang('Chariotage ébauche').label, rang('Chariotage ébauche').bar], ['.010"', 1]);
  assert.deepEqual([rang('Chariotage finition').label, rang('Chariotage finition').bar], ['.005"', 0.5]);
  assert.equal(rang('Perçage').label, '.006" / dent x Ø outil');
  assert.equal(rang('Pointage').label, '.001" / dent');
  assert.equal(rang('Alésage à la barre').label, '.006" x Ø outil');
  assert.deepEqual([rang('Taraudage').label, rang('Taraudage').bar], ['pas du filetage', null]);
  assert.equal(rang('Perçage').picto, 'img/pictos/operations/percage.png');
});

test('feedSheet : machines et directions sur la hauteur de leurs opérations ; encadrés des opérations proportionnelles au Ø', () => {
  const feuille = feedSheet(data);
  assert.deepEqual(feuille.machines, [{ key: 'Fraiseuse', start: 0, span: 4 }, { key: 'Perceuse / Fraiseuse', start: 4, span: 5 }, { key: 'Tour', start: 9, span: 10 }]);
  assert.deepEqual(feuille.directions.map((run) => [run.key, run.start, run.span]), [
    ['Avance latérale', 0, 4], ['Avance axiale', 4, 5], ['Avance longitudinale', 9, 6], ['Avance transversale', 15, 4],
  ]);
  assert.deepEqual(feuille.boxes.map((box) => [box.start, box.span]), [[0, 7], [14, 1]]);
  assert.deepEqual(feuille.boxes[0].lines.map((line) => line.text), [
    'Avances pour un outil Ø1"', "Ajuster l'avance ↔ Ø outil", 'Exemple :', 'Foret de Ø1/4"', '.006"/dent × Ø1/4" = .0015"/dent', 'Ne pas dépasser .010" / dent',
  ]);
  assert.deepEqual(feuille.boxes[1].lines.map((line) => line.text), ["Ajuster l'avance ↔ Ø outil", 'Av. MAX. : .006" / tour']);
});

test('feedSheet : une opération ajoutée au catalogue apparaît dans la feuille, sans toucher au code', () => {
  const lamage = { operation: 'Lamage', machine: 'Perceuse / Fraiseuse', direction_avance: 'Avance axiale', avance_po_rev: 0.003, avance_max_po_rev: 0.003, avance_egale_pas_filetage: false, avance_proportionnelle_diametre: false, note: null };
  const feuille = feedSheet({ ...data, operations: [...data.operations.slice(0, 9), lamage, ...data.operations.slice(9)] });
  assert.equal(feuille.rows.length, 20);
  assert.deepEqual([feuille.rows[9].label, feuille.rows[9].picto], ['.003" / dent', 'img/pictos/operations/lamage.png']);
  assert.deepEqual(feuille.machines[1], { key: 'Perceuse / Fraiseuse', start: 4, span: 6 });
});
