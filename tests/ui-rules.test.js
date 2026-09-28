// Tests de site/js/ui/rules.js et sheets-data.js : règles d'affichage de l'écran Question et contenu
// des feuilles de référence, sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { checkButtonLabel, diameterLines, factorLines, feedFamily, materialCard, gapExplanation, helpLine, operationProgress, progressRows, questionIsMetric, remainingWait, testAnswers, toolLabels, toolMaterialColor, toolStreak } from '../site/js/ui/rules.js';
import { sessionView } from '../worker/seance.js';
import { classFeatures, classImages, feedSheet, heatImageMaxWidth, inches, operationPicto, operationPictoOf, operationSlug, toolPhotoUrl, vcSheet } from '../site/js/ui/sheets-data.js';
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

// D25 : la barre à aléser a deux diamètres ; le panneau, l'aide de N et celle de fz disent lequel sert à quoi.
const BARRE = { identifiant: 'Barre à aléser Ø 3/4 po - Ø alésé: 2.000"', dimension: '2.000"', outil: { id: 'barre_a_aleser', nom: 'Barre à aléser', barre: '3/4 po', fact_vc: 1, fact_av: 1 } };

test('diameterLines : les deux diamètres de la barre à aléser, chacun avec son rôle ; rien pour les autres outils', () => {
  assert.deepEqual(diameterLines(BARRE), ['Ø usiné (alésé) : 2.000" — pour la vitesse de rotation', "Ø de la barre : 3/4 po — pour l'avance"]);
  // Barre à rainurer (D25, extension) : mêmes textes, le mot du gabarit change.
  const RAINURE = { ...BARRE, identifiant: 'Barre à rainurer Ø 1/2 po - Ø rainuré: 1.000"', dimension: '1.000"', outil: { ...BARRE.outil, id: 'barre_a_rainurer', nom: 'Barre à rainurer', barre: '1/2 po', fact_vc: 0.25 } };
  assert.deepEqual(diameterLines(RAINURE), ['Ø usiné (rainuré) : 1.000" — pour la vitesse de rotation', "Ø de la barre : 1/2 po — pour l'avance"]);
  assert.deepEqual(diameterLines({ ...BARRE, identifiant: 'Outil Ø 1 po' }), ['Ø usiné : 2.000" — pour la vitesse de rotation', "Ø de la barre : 3/4 po — pour l'avance"]);
  assert.deepEqual(diameterLines({ dimension: '2.000"', outil: { barre: null } }), []);
  assert.deepEqual(diameterLines({ dimension: '2.000"', outil: {} }), []); // séance servie par un serveur d'avant D25
});

test('helpLine, outil à deux diamètres : N avec le Ø usiné, avance avec le Ø de la barre', () => {
  const texte = (aide) => aide.parts.map((part) => part.text).join('');
  assert.equal(texte(helpLine('rpm', BARRE, 'proportional')), 'Vitesse de rotation → N = Vc × 4 / Ø usiné (le trou, pas la barre), plafonnée à la vitesse de rotation max de la machine.');
  assert.match(texte(helpLine('feedPerTooth', BARRE, 'proportional')), /avance × Ø de la barre \(pas le Ø usiné\)/);
});

test('checkButtonLabel et remainingWait : le compte à rebours de la cadence sur le bouton Vérifier', () => {
  assert.equal(checkButtonLabel(0), 'Vérifier');
  assert.equal(checkButtonLabel(7), 'Vérifier dans 7 s');
  assert.equal(remainingWait(10, 0), 10);
  assert.equal(remainingWait(10, 3400), 7); // arrondi vers le haut : on n'annonce jamais moins que le serveur n'exige
  assert.equal(remainingWait(10, 12000), 0);
  assert.equal(remainingWait(undefined, 0), 0); // séance servie par un serveur d'avant le compte à rebours
});

test('testAnswers : le bouton « Remplir » n’existe que si le serveur a joint les réponses (D26)', () => {
  assert.equal(testAnswers({ champs: [] }), null);
  assert.equal(testAnswers({ reponses_test: null }), null);
  assert.equal(testAnswers({ reponses_test: {} }), null);
  assert.equal(testAnswers({ reponses_test: 'oui' }), null);
  assert.deepEqual(testAnswers({ reponses_test: { vc: '100' } }), { vc: '100' });
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

test('classImages (D64, D66) : l’image de chaleur de la classe du matériau, servie par /images/<id> ; rien pour la classe O, une classe inconnue ou une image retirée', () => {
  assert.deepEqual(classImages(data.classesIso, 'P'), [{ key: 'image_chaleur', label: 'Chaleur', id: 'copeaux-p-chaleur', url: '/images/copeaux-p-chaleur' }]);
  for (const code of ['M', 'K', 'N', 'S', 'H']) assert.deepEqual(classImages(data.classesIso, code).map((i) => i.id), [`copeaux-${code.toLowerCase()}-chaleur`]);
  assert.deepEqual(classImages(data.classesIso, 'O'), []);
  assert.deepEqual(classImages(data.classesIso, 'Z'), []);
  assert.deepEqual(classImages(undefined, 'P'), []); // un catalogue sans classes (serveur d'avant) : l'espace reste vide
  // La légende vient de legende_image (D68) : « Chaleur » par défaut, le texte de la classe sinon, null si vide.
  assert.equal(classImages([{ code: 'P', legende_image: '  Zone la plus chaude  ' }], 'P')[0].label, 'Zone la plus chaude');
  assert.equal(classImages([{ code: 'P', legende_image: '' }], 'P')[0].label, null);
  assert.equal(classImages([{ code: 'P', legende_image: '   ' }], 'P')[0].label, null);
  assert.equal(classImages([{ code: 'P' }], 'P')[0].label, 'Chaleur'); // une classe d'avant D68
  // Le brouillon des tables tel qu'à l'écran : une image retirée (null), une autre choisie ; une classe d'avant D64 sans la clé reçoit celle de la semence.
  const draft = [{ code: 'P', image_chaleur: null }, { code: 'M', image_chaleur: 'img-0123456789abcdef' }, { code: 'K' }];
  assert.deepEqual(classImages(draft, 'P'), []);
  assert.deepEqual(classImages(draft, 'M'), [{ key: 'image_chaleur', label: 'Chaleur', id: 'img-0123456789abcdef', url: '/images/img-0123456789abcdef' }]);
  assert.deepEqual(classImages(draft, 'K').map((i) => i.url), ['/images/copeaux-k-chaleur']);
});

test('materialCard : lettre de classe, matériau et groupe, composition, état, dureté, exemple — jamais les Vc', () => {
  assert.deepEqual(materialCard({ iso: 'P', groupe: 2, materiau: 'Acier non allié', composition: 'C > 0.25 ... ≤ 0.55 %', etat: 'Recuit', durete: 190, exemple: 1045 }), {
    letter: 'P', title: 'Acier non allié — groupe 2', color: '--iso-p', textColor: '--iso-p-text',
    lines: ['Composition : C > 0.25 ... ≤ 0.55 %', 'État : Recuit · Dureté : 190 HB', 'Exemple : AISI 1045'],
  });
  assert.deepEqual(materialCard({ iso: 'H', groupe: 38, materiau: 'Acier durci', composition: null, etat: 'Durci et revenu', durete: '50 HRC', exemple: 'acier outil' }).lines, ['État : Durci et revenu · Dureté : 50 HRC', 'Exemple : acier outil']);
  assert.deepEqual(materialCard({ iso: 'O', groupe: 47, materiau: 'Graphite', composition: null, etat: null, durete: '80 Shore', exemple: null }).lines, ['Dureté : 80 Shore']);
  for (const materiau of data.materiaux) assert.deepEqual(Object.keys(materialCard(materiau)).sort(), ['color', 'letter', 'lines', 'textColor', 'title']); // tout le catalogue passe, et rien d'autre ne sort
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
  assert.equal(texte(helpLine('feedPerTooth', QUESTION, 'thread')), "Avance par dent → table des avances, à l'opération de l'outil. Filetage : fz = pas = 1 / filets au pouce.");
  assert.equal(texte(helpLine('feedPerTooth', QUESTION, 'fixed')), "Avance par dent → table des avances, à l'opération de l'outil. Avance fixe : la valeur de la table, telle quelle, quel que soit le Ø."); // D70
  assert.equal(helpLine('feedPerTooth', QUESTION, 'fixed').table, 'avances');

  assert.equal(texte(helpLine('rpm', QUESTION, 'fixed')), 'Vitesse de rotation → N = Vc × 4 / Ø, plafonnée à la vitesse de rotation max de la machine, × 0.25 pour cet outil.');
  assert.equal(texte(helpLine('rpm', { outil: { fact_vc: 1 } }, 'fixed')), 'Vitesse de rotation → N = Vc × 4 / Ø, plafonnée à la vitesse de rotation max de la machine.');
  assert.equal(texte(helpLine('feedPerRev', QUESTION, 'fixed')), 'Avance totale par révolution → f = fz × nombre de dents.');
  assert.equal(texte(helpLine('feedRate', QUESTION, 'fixed')), "Vitesse d'avance → Vf = N × f.");
  for (const champ of ['rpm', 'feedPerRev', 'feedRate']) assert.equal(helpLine(champ, QUESTION, 'fixed').table, null);
  for (const champ of ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate']) assert.doesNotMatch(texte(helpLine(champ, QUESTION, 'thread')), /\d{3}/, champ); // aucune valeur
});

test('helpLine, dimension métrique (D70) : « Le Ø se met en pouces : mm / 25.4. » pour N, et pour fz quand le Ø sert', () => {
  const RAPPEL = ' Le Ø se met en pouces : mm / 25.4.';
  const foret = { outil: { id: 'foret_metrique', fact_vc: 1, fact_av: 1 }, dimension: 'Ø 6.0 mm' };
  assert.equal(texte(helpLine('rpm', foret, 'proportional', true)), `Vitesse de rotation → N = Vc × 4 / Ø, plafonnée à la vitesse de rotation max de la machine.${RAPPEL}`);
  assert.equal(texte(helpLine('feedPerTooth', foret, 'proportional', true)), `Avance par dent → table des avances, à l'opération de l'outil. Avance proportionnelle au Ø : avance × Ø outil, sans dépasser l’avance max.${RAPPEL}`);
  // Filetage métrique : fz est le pas, qui se met en pouces ; l'impérial n'en dit rien.
  assert.equal(texte(helpLine('feedPerTooth', foret, 'thread', true)), "Avance par dent → table des avances, à l'opération de l'outil. Filetage : fz = pas, en pouces : mm / 25.4.");
  // Avance fixe : le Ø ne sert pas à fz, pas de rappel ; il reste pour N (MCLNR « 10 mm »).
  assert.doesNotMatch(texte(helpLine('feedPerTooth', foret, 'fixed', true)), /mm \/ 25\.4/);
  assert.match(texte(helpLine('rpm', { outil: { fact_vc: 0.25 } }, 'fixed', true)), /× 0\.25 pour cet outil\. Le Ø se met en pouces : mm \/ 25\.4\.$/);
  // Dimension impériale : aucun rappel.
  for (const champ of ['feedPerTooth', 'rpm']) for (const famille of ['proportional', 'thread', 'fixed']) assert.doesNotMatch(texte(helpLine(champ, foret, famille)), /mm/, `${champ} ${famille}`);
});

test('questionIsMetric : la dimension tirée, lue dans le catalogue (filet « Ø x pas ») ou dans son libellé (D70)', () => {
  const q = (outil, dimension) => ({ outil: { id: outil }, dimension });
  assert.equal(questionIsMetric(q('foret_metrique', 'Ø 6.0 mm'), data), true);
  assert.equal(questionIsMetric(q('mclnr', '10 mm'), data), true);
  assert.equal(questionIsMetric(q('taraud_metrique', 'M10 x 1.50'), data), true);
  assert.equal(questionIsMetric(q('sdtmr_2', 'M42 x 4.5'), data), true);
  assert.equal(questionIsMetric(q('foret_fractionnaire', 'Ø 1/4 po'), data), false);
  assert.equal(questionIsMetric(q('taraud_imperial', '1/4- 20 UNC'), data), false);
  assert.equal(questionIsMetric(q('foret_a_numero', '#40'), data), false);
  assert.equal(questionIsMetric(q('outil_inconnu', 'Ø 3 mm'), data), true); // hors catalogue : le libellé
});

// --- Question corrigée -------------------------------------------------------------------------------------------------------

test('gapExplanation : l’écart et la tolérance de chaque champ faux (UI §3.4)', () => {
  const correction = { champs: [
    { champ: 'vc', evalue: true, ok: true, saisie: '390', attendu: '390', tolerance: 'exacte', ecart_pct: 0 },
    { champ: 'rpm', evalue: true, ok: true, saisie: '2500', attendu: '2496', tolerance: '±5 % et ±1 tr/min', ecart_pct: 0.2 },
    { champ: 'feedPerRev', evalue: false, ok: true, saisie: '', attendu: '0.0050', tolerance: null, ecart_pct: null },
    { champ: 'feedRate', evalue: true, ok: false, saisie: '13.2', attendu: '12.500', tolerance: '±0.5 % de N × f', ecart_pct: 5.6 },
  ] };
  // D71 : la grandeur en toutes lettres, l'unité après chaque valeur ; la tolérance en formule garde ses symboles.
  assert.equal(gapExplanation(correction), "Ta vitesse d'avance de 13.2 po/min est à +5.6 % de 12.500 po/min (tolérance : ±0.5 % de N × f).");

  const deux = { champs: [
    { champ: 'vc', evalue: true, ok: false, saisie: '1', attendu: '570', tolerance: 'exacte', ecart_pct: -99.8 },
    { champ: 'rpm', evalue: true, ok: false, saisie: 'abc', attendu: '905', tolerance: '±5 % et ±1 tr/min', ecart_pct: null },
  ] };
  assert.equal(gapExplanation(deux), 'Ta vitesse de coupe de 1 pi/min est à −99.8 % de 570 pi/min (la réponse doit être exacte). Vitesse de rotation : réponse vide ou illisible (attendu 905 tr/min).');
  assert.equal(gapExplanation({ champs: correction.champs.slice(0, 3) }), '');
});

test('gapExplanation (D71) : l’exemple de Thierry, et les avances nommées « ton avance … »', () => {
  const barre = { champs: [{ champ: 'rpm', evalue: true, ok: false, saisie: '3200', attendu: '3000', tolerance: '±5 % et ±1 tr/min', ecart_pct: 6.7 }] };
  assert.equal(gapExplanation(barre), 'Ta vitesse de rotation de 3200 tr/min est à +6.7 % de 3000 tr/min (tolérance : ±5 % et ±1 tr/min).');
  const avances = { champs: [
    { champ: 'feedPerTooth', evalue: true, ok: false, saisie: '0.004', attendu: '0.0030', tolerance: '±25 %, au plus ±0.001 po', ecart_pct: 33.3 },
    { champ: 'feedPerRev', evalue: true, ok: false, saisie: '', attendu: '0.0060', tolerance: '±0.1 % de fz × dents', ecart_pct: null },
  ] };
  assert.equal(gapExplanation(avances), 'Ton avance par dent de 0.004 po/dent est à +33.3 % de 0.0030 po/dent (tolérance : ±25 %, au plus ±0.001 po). Avance totale par révolution : réponse vide ou illisible (attendu 0.0060 po/rév).');
  // Aucune grandeur n'est plus nommée par son symbole seul en tête de phrase.
  for (const champ of ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate']) {
    const texte = gapExplanation({ champs: [{ champ, evalue: true, ok: false, saisie: '1', attendu: '2', tolerance: 'exacte', ecart_pct: -50 }] });
    assert.doesNotMatch(texte, /^Ta (Vc|N|Vf|f|fz) |^Ton (fz|f) |RPM|rév\/min/, texte);
  }
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

// --- Progression par opération (D81) --------------------------------------------------------------------------------------

const rpm = await lireFichier('exercices/m10-tournage-vc-rpm.json');
const complet = await lireFichier('exercices/test-complet.json');

// La progression telle que le serveur l'envoie (sessionView) : les outils dans l'ordre de l'exercice, chacun avec son
// opération, ses réussites de suite (plafonnées) et ses réussites exigées. Aucune question en cours.
const progressionDe = (exercice, reussites = {}) => sessionView(
  { prenom: 'Léa', nom: 'Tremblay', matricule: '1234567', debut: 0, reussite_le: null, question_courante: null, compteurs: { reussites, totalReussies: 0 } },
  exercice,
  data,
).progression;

// Une opération réduite à ce que la barre dessine.
const barre = ({ operation, done, total, kept, gain, loss, complete }) => ({ operation, done, total, kept, gain, loss, complete });
const groupes = (resultat) => [...resultat.shown, ...resultat.folded];
const groupe = (resultat, operation) => groupes(resultat).find((entry) => entry.operation === operation);

test('operationProgress (M10) : une opération par premier outil, ses outils dessous ; même une opération à un seul outil a son en-tête', () => {
  const labels = toolLabels(m10, data);
  const resultat = operationProgress(progressionDe(m10, { mvlnr: 2, sdtmr: 1 }), labels, { currentId: 'mvlnr' });
  assert.deepEqual(resultat.folded, []); // sur ordinateur, rien n'est replié
  assert.equal(resultat.summary, null);
  assert.deepEqual(resultat.shown.map((entry) => [entry.operation, entry.rows.map((row) => row.id)]), [
    ['Chariotage ébauche', ['mclnr']],
    ['Chariotage finition', ['mvlnr']],
    ['Tronçonnage', ['lame_a_tronconner']],
    ['Filetage interne', ['barre_a_fileter', 'barre_a_fileter_2']],
    ['Rainurage interne', ['barre_a_rainurer']],
    ['Alésage à la barre', ['barre_a_aleser']],
    ['Filetage externe', ['sdtmr', 'sdtmr_2']],
  ]);
  // Les rangs d'outils sont ceux d'avant (progressRows) : nom distinctif, points, état.
  assert.deepEqual(groupe(resultat, 'Chariotage finition').rows, [{ id: 'mvlnr', label: 'MVLNR', dots: [true, true, false], state: 'current' }]);
  assert.deepEqual(barre(groupe(resultat, 'Chariotage finition')), { operation: 'Chariotage finition', done: 2, total: 3, kept: 2, gain: 0, loss: 0, complete: false });
  assert.equal(groupe(resultat, 'Chariotage finition').label, 'Chariotage finition : 2 réussites sur 3');
  assert.equal(groupe(resultat, 'Chariotage ébauche').label, 'Chariotage ébauche : 0 réussite sur 1');
});

test('operationProgress : des outils de même nom gardent chacun leur rang et leur nom distinctif ; leur opération fait la somme', () => {
  const resultat = operationProgress(progressionDe(m10, { sdtmr: 1 }), toolLabels(m10, data));
  const filetage = groupe(resultat, 'Filetage externe');
  assert.deepEqual(filetage.rows.map((row) => [row.label, row.dots, row.state]), [['SDTMR (impérial)', [true], 'done'], ['SDTMR (métrique)', [false], 'todo']]);
  assert.deepEqual(barre(filetage), { operation: 'Filetage externe', done: 1, total: 2, kept: 1, gain: 0, loss: 0, complete: false });
  assert.equal(filetage.label, 'Filetage externe : 1 réussite sur 2');
  // Même nom et même unité : la plage de dimensions les distingue (test-complet, Perçage).
  const percage = groupe(operationProgress(progressionDe(complet), toolLabels(complet, data)), 'Perçage');
  assert.equal(new Set(percage.rows.map((row) => row.label)).size, percage.rows.length);
  assert.equal(percage.rows.length, 7);
});

test('operationProgress : les réussites plafonnées du serveur ; « Perçage : 6 réussites sur 10 »', () => {
  const resultat = operationProgress(progressionDe(rpm, { foret_fractionnaire: 2, foret_a_numero: 2, foret_a_lettre: 5, foret_metrique: 0 }), toolLabels(rpm, data));
  const percage = groupe(resultat, 'Perçage');
  assert.equal(percage.done, 6); // 2 + 2 + 2 (5, plafonné à 2) + 0 + 0
  assert.equal(percage.total, 10);
  assert.equal(percage.label, 'Perçage : 6 réussites sur 10');
});

test('operationProgress : premier affichage sans progression d’avant — tout est acquis, en bleu, ni gain ni perte', () => {
  const resultat = operationProgress(progressionDe(rpm, { foret_a_pointer: 2, foret_udrill: 1 }), toolLabels(rpm, data), { currentId: 'foret_udrill' });
  for (const entry of groupes(resultat)) {
    assert.equal(entry.gain, 0, entry.operation);
    assert.equal(entry.loss, 0, entry.operation);
    assert.equal(entry.kept, entry.done, entry.operation);
  }
  assert.equal(groupe(resultat, 'Pointage').complete, true);
});

test('operationProgress : une réussite ajoute sa part en vert ; celle qui complète l’opération lui donne son contour doré, dès cette question', () => {
  const labels = toolLabels(m10, data);
  const avant = progressionDe(m10, { mclnr: 1, sdtmr: 1 });
  const apres = progressionDe(m10, { mclnr: 1, sdtmr: 1, sdtmr_2: 1 });
  const resultat = operationProgress(apres, labels, { previous: avant });
  assert.deepEqual(barre(groupe(resultat, 'Filetage externe')), { operation: 'Filetage externe', done: 2, total: 2, kept: 1, gain: 1, loss: 0, complete: true });
  // Une réussite qui ne complète rien : la part gagnée, sans contour.
  const partielle = operationProgress(progressionDe(m10, { mvlnr: 2 }), labels, { previous: progressionDe(m10, { mvlnr: 1 }) });
  assert.deepEqual(barre(groupe(partielle, 'Chariotage finition')), { operation: 'Chariotage finition', done: 2, total: 3, kept: 1, gain: 1, loss: 0, complete: false });
  // Les autres opérations n'ont rien gagné ni perdu.
  assert.equal(groupes(resultat).filter((entry) => entry.gain > 0 || entry.loss > 0).length, 1);
  // Sur téléphone, l'opération qui vient de se compléter reste visible ; une opération terminée avant se replie.
  const telephone = operationProgress(apres, labels, { previous: avant, phone: true });
  assert.ok(telephone.shown.some((entry) => entry.operation === 'Filetage externe'));
  assert.deepEqual(telephone.folded.map((entry) => entry.operation), ['Chariotage ébauche']);
  assert.equal(telephone.summary, '1 opération terminée');
  // À la question suivante (sans progression d'avant), la barre redevient simple, le contour reste.
  assert.deepEqual(barre(groupe(operationProgress(apres, labels), 'Filetage externe')), { operation: 'Filetage externe', done: 2, total: 2, kept: 2, gain: 0, loss: 0, complete: true });
});

test('operationProgress : un échec qui vide une opération — la part perdue en rouge, l’outil « remis à zéro »', () => {
  const labels = toolLabels(m10, data);
  const resultat = operationProgress(progressionDe(m10), labels, { previous: progressionDe(m10, { mvlnr: 2 }), resetId: 'mvlnr' });
  const finition = groupe(resultat, 'Chariotage finition');
  assert.deepEqual(barre(finition), { operation: 'Chariotage finition', done: 0, total: 3, kept: 0, gain: 0, loss: 2, complete: false });
  assert.equal(finition.rows[0].state, 'reset');
  assert.equal(finition.label, 'Chariotage finition : 0 réussite sur 3');
  // Un échec dans une opération à plusieurs outils : ce qui reste en bleu, ce qui est perdu en rouge.
  const percage = groupe(operationProgress(
    progressionDe(rpm, { foret_fractionnaire: 2 }),
    toolLabels(rpm, data),
    { previous: progressionDe(rpm, { foret_fractionnaire: 2, foret_a_numero: 1 }), resetId: 'foret_a_numero' },
  ), 'Perçage');
  assert.deepEqual(barre(percage), { operation: 'Perçage', done: 2, total: 10, kept: 2, gain: 0, loss: 1, complete: false });
  assert.deepEqual(percage.rows.map((row) => row.state), ['done', 'reset', 'todo', 'todo', 'todo']);
});

test('operationProgress : un échec sur un outil déjà à zéro — rien de perdu, pas de rouge, mais « remis à zéro »', () => {
  const avant = progressionDe(m10, { mvlnr: 1 });
  const resultat = operationProgress(progressionDe(m10, { mvlnr: 1 }), toolLabels(m10, data), { previous: avant, resetId: 'lame_a_tronconner' });
  const tronconnage = groupe(resultat, 'Tronçonnage');
  assert.deepEqual(barre(tronconnage), { operation: 'Tronçonnage', done: 0, total: 3, kept: 0, gain: 0, loss: 0, complete: false });
  assert.equal(tronconnage.rows[0].state, 'reset');
  assert.equal(groupes(resultat).filter((entry) => entry.gain > 0 || entry.loss > 0).length, 0);
});

test('operationProgress : opérations intercalées — dans l’ordre de leur premier outil, leurs outils dans l’ordre de l’exercice', () => {
  const progression = { outils: [
    { id: 'a', nom: 'A', operation: 'Perçage', reussites: 1, requises: 1 },
    { id: 'b', nom: 'B', operation: 'Chanfreinage', reussites: 0, requises: 2 },
    { id: 'c', nom: 'C', operation: 'Perçage', reussites: 0, requises: 1 },
    { id: 'd', nom: 'D', operation: 'Chanfreinage', reussites: 2, requises: 2 },
  ] };
  const resultat = operationProgress(progression, new Map());
  assert.deepEqual(resultat.shown.map((entry) => [entry.operation, entry.rows.map((row) => row.id), entry.done, entry.total]), [
    ['Perçage', ['a', 'c'], 1, 2],
    ['Chanfreinage', ['b', 'd'], 2, 4],
  ]);
  // test-complet : 29 outils, 16 opérations ; le Chanfreinage revient trois fois dans l'exercice.
  const complete = operationProgress(progressionDe(complet), toolLabels(complet, data));
  const premiers = [...new Set(complet.outils.map((entry) => data.outils.find((tool) => tool.id === entry.id).operation))];
  assert.deepEqual(complete.shown.map((entry) => entry.operation), premiers);
  assert.equal(premiers.length, 16);
  assert.deepEqual(groupe(complete, 'Chanfreinage').rows.map((row) => row.id), ['nine9_90_degres', 'fraise_82_degres', 'outil_a_chambrer']);
  assert.equal(groupes(complete).flatMap((entry) => entry.rows).length, 29);
});

test('operationProgress sur téléphone : les opérations terminées se replient, dans l’ordre ; une opération non terminée garde tous ses outils', () => {
  const labels = toolLabels(m10, data);
  const progression = progressionDe(m10, { mclnr: 1, barre_a_aleser: 1, sdtmr: 1, barre_a_fileter: 1, barre_a_fileter_2: 1 });
  const resultat = operationProgress(progression, labels, { currentId: 'sdtmr_2', phone: true });
  assert.deepEqual(resultat.folded.map((entry) => entry.operation), ['Chariotage ébauche', 'Filetage interne', 'Alésage à la barre']);
  assert.equal(resultat.summary, '3 opérations terminées');
  assert.deepEqual(resultat.shown.map((entry) => entry.operation), ['Chariotage finition', 'Tronçonnage', 'Rainurage interne', 'Filetage externe']);
  // L'opération de l'outil en cours reste, avec son outil terminé (SDTMR impérial) : on ne replie que des opérations.
  assert.deepEqual(groupe(resultat, 'Filetage externe').rows.map((row) => row.state), ['done', 'current']);
  // Sur ordinateur, rien n'est replié.
  assert.deepEqual(operationProgress(progression, labels, { currentId: 'sdtmr_2' }).folded, []);
  // Rien de terminé : aucun résumé.
  assert.equal(operationProgress(progressionDe(m10), labels, { phone: true }).summary, null);
  // Pendant le corrigé : l'opération de l'outil remis à zéro reste visible, avec ses outils terminés.
  const corrige = operationProgress(progressionDe(m10, { mclnr: 1, barre_a_fileter: 1 }), labels, {
    previous: progressionDe(m10, { mclnr: 1, barre_a_fileter: 1 }), resetId: 'barre_a_fileter_2', phone: true,
  });
  assert.deepEqual(corrige.folded.map((entry) => entry.operation), ['Chariotage ébauche']);
  assert.deepEqual(groupe(corrige, 'Filetage interne').rows.map((row) => row.state), ['done', 'reset']);
  assert.ok(corrige.shown.includes(groupe(corrige, 'Filetage interne')));
  // Aucun outil : rien à montrer.
  assert.deepEqual(operationProgress({ outils: [] }, new Map(), { phone: true }), { shown: [], folded: [], summary: null });
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

test('operationSlug et pictogrammes : chaque opération du catalogue a son SVG de semence dans site/img/pictos/operations/, servi par /images/<slug> (D56)', () => {
  assert.equal(operationSlug('Chanfreinage / ébavurage'), 'chanfreinage_ebavurage');
  assert.equal(operationSlug("Alésage à l'alésoir"), 'alesage_a_l_alesoir');
  for (const operation of data.operations) {
    assert.equal(operationPicto(operation.operation), `/images/${operationSlug(operation.operation)}`);
    assert.ok(existsSync(new URL(`../site/img/pictos/operations/${operationSlug(operation.operation)}.svg`, import.meta.url)), `${operation.operation} : SVG de semence absent`);
  }
  // Une opération qui nomme son pictogramme (partie B) : c'est lui qui est servi.
  assert.equal(operationPicto('Perçage', { operation: 'Perçage', pictogramme: 'img-0123456789abcdef' }), '/images/img-0123456789abcdef');
  // Le pictogramme d'un outil sur la page Question : celui des tables du catalogue (D76, point 12), pas l'image nommée
  // d'après l'opération ; sans pictogramme dans les tables, celle-là.
  const choisi = { ...data, operationByName: new Map([...data.operationByName].map(([name, op]) => [name, name === 'Perçage' ? { ...op, pictogramme: 'img-0123456789abcdef' } : op])) };
  assert.equal(operationPictoOf(choisi, 'Perçage'), '/images/img-0123456789abcdef');
  assert.equal(operationPictoOf(choisi, 'Tronçonnage'), `/images/${operationSlug('Tronçonnage')}`);
  assert.equal(operationPictoOf(data, 'Inconnue'), '/images/inconnue');
  assert.equal(toolPhotoUrl({ id: 'mvlnr' }), '/images/mvlnr');
  assert.equal(toolPhotoUrl({ id: 'mvlnr_2', image: 'mvlnr' }), '/images/mvlnr');
});

test('pictogrammes de grandeurs : les six fichiers SVG de site/img/pictos/grandeurs/ (UI §5)', () => {
  for (const grandeur of ['vc', 'fz', 'n', 'f', 'vf', 'pas']) {
    assert.ok(existsSync(new URL(`../site/img/pictos/grandeurs/${grandeur}.svg`, import.meta.url)), `${grandeur}.svg est absent`);
  }
});

test('vcSheet : toutes les lignes du catalogue, les trois colonnes de matériau d’outil, les débuts de famille et la révision', () => {
  const feuille = vcSheet(data);
  assert.equal(feuille.revision, data.revisions.materiaux);
  assert.equal(feuille.rows.filter((row) => row.debut_famille).length, 15); // D27 : le trait vient des données
  assert.equal(feuille.rows.length, 47);
  assert.deepEqual(feuille.columns.map((column) => column.key), ['acier_rapide', 'carbure_solide', 'insert_carbure']);
  for (const row of feuille.rows) for (const { key } of feuille.columns) assert.equal(typeof row.vc_pi_min[key], 'number');
});

test('feedSheet : une opération par rang, barre proportionnelle à l’avance, texte de la barre', () => {
  // (9 bandes grises depuis D25, extension : le rainurage interne est proportionnel au Ø de la barre)
  const feuille = feedSheet(data);
  assert.equal(feuille.rows.length, 19);
  const rang = (nom) => feuille.rows.find((row) => row.operation === nom);
  assert.deepEqual([rang('Chariotage ébauche').label, rang('Chariotage ébauche').bar], ['.010"', 1]);
  assert.deepEqual([rang('Chariotage finition').label, rang('Chariotage finition').bar], ['.005"', 0.5]);
  assert.equal(rang('Perçage').label, '.006" / dent × Ø outil');
  assert.equal(rang('Pointage').label, '.001" / dent');
  assert.equal(rang('Alésage à la barre').label, '.006" × Ø outil');
  assert.equal(rang('Rainurage interne').label, '.003" × Ø outil'); // D25, extension
  assert.deepEqual([rang('Taraudage').label, rang('Taraudage').bar], ['pas du filetage', null]);
  assert.equal(rang('Perçage').picto, '/images/percage');
  assert.equal(feuille.revision, data.revisions.operations);
  // La bande grise du classeur : les huit opérations à avance proportionnelle au Ø, et elles seules.
  assert.deepEqual(feuille.rows.filter((row) => row.proportional).map((row) => row.operation), [
    'Contournage ébauche', 'Contournage finition', 'Surfaçage', 'Chanfreinage / ébavurage', 'Perçage', 'Chanfreinage', "Alésage à l'alésoir", 'Alésage à la barre', 'Rainurage interne',
  ]);
});

test('feedSheet : machines et directions sur la hauteur de leurs opérations ; encadrés des opérations proportionnelles au Ø', () => {
  const feuille = feedSheet(data);
  assert.deepEqual(feuille.machines, [{ key: 'Fraiseuse', start: 0, span: 4 }, { key: 'Perceuse / Fraiseuse', start: 4, span: 5 }, { key: 'Tour', start: 9, span: 10 }]);
  assert.deepEqual(feuille.directions.map((run) => [run.key, run.start, run.span]), [
    ['Avance latérale', 0, 4], ['Avance axiale', 4, 5], ['Avance longitudinale', 9, 6], ['Avance transversale', 15, 4],
  ]);
  assert.deepEqual(feuille.boxes.map((box) => [box.start, box.span]), [[0, 7], [14, 1], [18, 1]]);
  assert.deepEqual(feuille.boxes[0].lines.map((line) => line.text), [
    'Avances pour un outil Ø1"', "Ajuster l'avance ↔ Ø outil", 'Exemple :', 'Foret de Ø1/4"', '.006"/dent × Ø1/4" = .0015"/dent', 'Ne pas dépasser .010" / dent',
  ]);
  assert.deepEqual(feuille.boxes[1].lines.map((line) => line.text), ["Ajuster l'avance ↔ Ø outil", 'Av. MAX. : .006" / tour']);
  assert.deepEqual(feuille.boxes[2].lines.map((line) => line.text), ["Ajuster l'avance ↔ Ø outil", 'Av. MAX. : .003" / tour']);
});

test('feedSheet : une opération ajoutée au catalogue apparaît dans la feuille, sans toucher au code', () => {
  const lamage = { operation: 'Lamage', machine: 'Perceuse / Fraiseuse', direction_avance: 'Avance axiale', avance_po_rev: 0.003, avance_max_po_rev: 0.003, avance_egale_pas_filetage: false, avance_proportionnelle_diametre: false };
  const feuille = feedSheet({ ...data, operations: [...data.operations.slice(0, 9), lamage, ...data.operations.slice(9)] });
  assert.equal(feuille.rows.length, 20);
  assert.deepEqual([feuille.rows[9].label, feuille.rows[9].picto], ['.003" / dent', '/images/lamage']);
  assert.deepEqual(feuille.machines[1], { key: 'Perceuse / Fraiseuse', start: 4, span: 6 });
});

test('classFeatures (D65) : les caractéristiques de la classe du matériau, solution à null quand il n’y en a pas ; rien pour O, une classe inconnue ou sans liste ; lignes mal formées sautées', () => {
  assert.deepEqual(classFeatures(data.classesIso, 'M'), [
    { libelle: 'Effort', texte: 'moyen à élevé', solution: null },
    { libelle: 'Chaleur', texte: "élevée, concentrée sur l'arête", solution: null },
    { libelle: 'Copeaux', texte: 'longs, tenaces, difficiles à fragmenter', solution: null },
    { libelle: 'Problème typique', texte: 'écrouissage', solution: 'ne pas frotter, garder avance et profondeur suffisantes' },
  ]);
  assert.deepEqual(classFeatures(data.classesIso, 'O'), []);
  assert.deepEqual(classFeatures(data.classesIso, 'Z'), []);
  assert.deepEqual(classFeatures(undefined, 'P'), []);
  assert.deepEqual(classFeatures([{ code: 'P', caracteristiques: [{ libelle: ' Effort ', texte: 'x', solution: '' }, { libelle: '', texte: 'y' }, null] }], 'P'), [{ libelle: 'Effort', texte: 'x', solution: null }]);
});

test('heatImageMaxWidth : la largeur affichée de l’image de chaleur, au plus la largeur de l’original ÷ 1,5', () => {
  assert.equal(heatImageMaxWidth(237), 158);
  assert.equal(heatImageMaxWidth(235), 156.7);
  assert.equal(heatImageMaxWidth(340), 226.7); // une image générée au double : la largeur d'affichage (170 px) reste la limite
  assert.equal(heatImageMaxWidth(0), null);
  assert.equal(heatImageMaxWidth(undefined), null);
});
