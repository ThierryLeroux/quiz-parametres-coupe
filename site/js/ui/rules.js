// Règles d'affichage de l'écran Question (UI §3.3, §3.4) : ce qu'on montre, et quand. Fonctions
// PURES, sans DOM, testées sous Node ; question-screen.js ne fait que les mettre à l'écran.
// Elles reçoivent ce que renvoie le serveur (SPEC §7) et le catalogue (loadData).

import { TOOL_MATERIAL_KEYS, isMetricDimension } from '../data.js';
import { computedText, evaluateExpression, expressionText, isExpression } from '../expression.js';
import { FIELD_PARTS, computedNote, fieldInSentence, typedNumber, unreadableNote } from './text.js';

// --- Outils de même nom -------------------------------------------------------------------------------------
// Le TITRE de la question est le gabarit de l'outil résolu par le serveur (question.identifiant,
// D24), tel quel : « SDTMR - filetage: M64 x 6 ». La PROGRESSION, elle, liste les outils par leur nom
// générique : quand deux outils d'un exercice portent le même nom (« SDTMR » impérial et métrique),
// elle ajoute ce qui les distingue, entre parenthèses ; la donnée `nom` ne change pas.
//   1. l'unité, si elle diffère : « SDTMR (impérial) », « SDTMR (métrique) » ;
//   2. sinon la plage de dimensions : « Foret fractionnaire (Ø 1/64 po à Ø 1 po) ».

// Un outil est métrique si ses dimensions le sont : filet « ØxPas » en mm, ou libellé en mm.
function toolUnit(tool) {
  return isMetricDimension(tool.dimensions[0]) ? 'métrique' : 'impérial';
}

const toolRange = (tool) => `${tool.dimensions[0].libelle} à ${tool.dimensions.at(-1).libelle}`;

// Retourne une Map id d'outil → nom à afficher, pour les outils de l'exercice.
export function toolLabels(exercise, data) {
  const tools = exercise.outils.map((entry) => data.outils.find((tool) => tool.id === entry.id));
  const labels = new Map();
  for (const tool of tools) {
    const sameName = tools.filter((other) => other.nom === tool.nom);
    if (sameName.length === 1) labels.set(tool.id, tool.nom);
    else {
      const units = new Set(sameName.map(toolUnit));
      labels.set(tool.id, `${tool.nom} (${units.size === sameName.length ? toolUnit(tool) : toolRange(tool)})`);
    }
  }
  return labels;
}

// --- Couleurs de sens (UI §1) ---------------------------------------------------------------------------------

// Variable CSS de la couleur du matériau d'outil : « Acier rapide » → « --tool-acier-rapide ». La clé
// vient des tables de la version en usage (data.toolMaterialKeys, D61), ou des noms par défaut.
export function toolMaterialColor(label, data = null) {
  const key = data?.toolMaterialKeys?.get(label) ?? TOOL_MATERIAL_KEYS[label];
  return key ? `--tool-${key.replaceAll('_', '-')}` : '--color-accent';
}

// Le panneau du matériau brut : { letter, title, lines, color, textColor }. Jamais ses vitesses de
// coupe : les trouver dans la table, c'est l'exercice (et le serveur ne les envoie pas).
export function materialCard(materiau) {
  const hardness = typeof materiau.durete === 'number' ? `${materiau.durete} HB` : materiau.durete;
  const example = typeof materiau.exemple === 'number' ? `AISI ${materiau.exemple}` : materiau.exemple;
  const iso = materiau.iso.toLowerCase();
  return {
    letter: materiau.iso,
    title: `${materiau.materiau} — groupe ${materiau.groupe}`,
    lines: [
      materiau.composition ? `Composition : ${materiau.composition}` : null,
      [materiau.etat ? `État : ${materiau.etat}` : null, hardness ? `Dureté : ${hardness}` : null].filter(Boolean).join(' · ') || null,
      example ? `Exemple : ${example}` : null,
    ].filter(Boolean),
    color: `--iso-${iso}`,
    textColor: `--iso-${iso}-text`,
  };
}

// --- Famille d'avance, facteurs ---------------------------------------------------------------------------------

// 'thread' (filetage), 'proportional' (proportionnelle au Ø) ou 'fixed', comme dans calcul.js.
export function feedFamily(operation) {
  if (operation?.avance_egale_pas_filetage) return 'thread';
  return operation?.avance_proportionnelle_diametre ? 'proportional' : 'fixed';
}

// Un facteur n'est montré que s'il diffère de 1, en clair : « Vitesse réduite × 0.25 ».
export function factorLines(outil) {
  const line = (what, factor) => `${what} ${factor < 1 ? 'réduite' : 'augmentée'} × ${factor}`;
  return [
    ...(outil.fact_vc === 1 ? [] : [line('Vitesse', outil.fact_vc)]),
    ...(outil.fact_av === 1 ? [] : [line('Avance', outil.fact_av)]),
  ];
}

// Outil à deux diamètres (barre à aléser, barre à rainurer : D25) : le panneau de l'outil nomme chacun,
// avec son rôle. Le trou est le « Ø usiné », précisé du mot que le gabarit de nom emploie (alésé,
// rainuré) quand il y est. Pour les autres outils, la dimension est déjà dans le titre : aucune ligne.
export function diameterLines(question) {
  if (!question.outil.barre) return [];
  const word = /Ø (\S+):/.exec(question.identifiant ?? '')?.[1];
  return [`Ø usiné${word ? ` (${word})` : ''} : ${question.dimension} — pour la vitesse de rotation`, `Ø de la barre : ${question.outil.barre} — pour l'avance`];
}

// --- Aide contextuelle (UI §3.3) : la méthode, jamais la valeur, ni la ligne ni la colonne -------------------------

// La dimension tirée est-elle métrique (D70) ? Lue dans le catalogue — la valeur d'un filet « Ø x pas » —, ou, à
// défaut, dans son libellé (« Ø 6.0 mm »).
export function questionIsMetric(question, data) {
  const tool = data.outils.find((entry) => entry.id === question.outil.id);
  const dimension = tool?.dimensions.find((entry) => entry.libelle === question.dimension);
  return isMetricDimension({ libelle: question.dimension, valeur: dimension?.valeur });
}

// Le rappel d'une dimension métrique (D70), pour les aides de N et de fz quand le Ø sert.
const INCHES_REMINDER = ' Le Ø se met en pouces : mm / 25.4.';

// Retourne { parts, table } :
//   parts : le texte, en morceaux — { text, accent } où accent vaut 'material' ou 'tool' pour les
//           mots à colorer comme le panneau correspondant, ou undefined
//   table : la feuille que le bouton « Ouvrir la table » ouvre ('vc' ou 'avances'), ou null
//   metric : la dimension tirée est métrique (questionIsMetric) — le rappel « mm / 25.4 », seulement alors (D70)
export function helpLine(field, question, family, metric = false) {
  const plain = (text, table = null) => ({ parts: [{ text }], table });
  if (field === 'vc') {
    return {
      parts: [
        { text: 'Vitesse de coupe → table des vitesses de coupe : le ' },
        { text: 'matériau brut', accent: 'material' },
        { text: ' donne la ligne, le ' },
        { text: "matériau de l'outil", accent: 'tool' },
        { text: ' donne la colonne.' },
      ],
      table: 'vc',
    };
  }
  if (field === 'feedPerTooth') {
    const byFamily = {
      proportional: (question.outil.barre
        ? ' Avance proportionnelle au Ø : avance × Ø de la barre (pas le Ø usiné), sans dépasser l’avance max.'
        : ' Avance proportionnelle au Ø : avance × Ø outil, sans dépasser l’avance max.') + (metric ? INCHES_REMINDER : ''),
      // Filetage : fz est le pas ; en métrique, le pas en mm se met en pouces (D70).
      thread: metric ? ' Filetage : fz = pas, en pouces : mm / 25.4.' : ' Filetage : fz = pas = 1 / filets au pouce.',
      fixed: ' Avance fixe : la valeur de la table, telle quelle, quel que soit le Ø.',
    };
    return plain(`Avance par dent → table des avances, à l'opération de l'outil.${byFamily[family]}`, 'avances');
  }
  if (field === 'rpm') {
    const factor = question.outil.fact_vc === 1 ? '' : `, × ${question.outil.fact_vc} pour cet outil`;
    const which = question.outil.barre ? 'Ø usiné (le trou, pas la barre)' : 'Ø';
    return plain(`Vitesse de rotation → N = Vc × 4 / ${which}, plafonnée à la vitesse de rotation max de la machine${factor}.${metric ? INCHES_REMINDER : ''}`);
  }
  if (field === 'feedPerRev') return plain('Avance totale par révolution → f = fz × nombre de dents.');
  return plain("Vitesse d'avance → Vf = N × f.");
}

// --- Calculs dans les cases (D82) ----------------------------------------------------------------------------------
// Une case de réponse accepte une expression (« (3-1)*2 ») : elle se calcule dans la case, qui affiche le résultat ; le
// texte tapé est gardé de côté et envoyé au serveur, qui juge la même chose. question-screen.js ne fait que brancher
// ces règles sur les événements (Entrée, sortie de la case, Vérifier, rangée de boutons).

// Calcule une case (Entrée, sortie de la case, Vérifier, bouton « = ») :
//   null                          — pas d'expression (un nombre, rien, « abc ») : la case ne change pas ;
//   { value, expression, note }   — la case affiche `value` (le résultat, en 9 caractères au plus) ; `expression`, le
//                                   texte tapé, part au serveur tant que la case montre `value` ; `note`, sous la case :
//                                   « = (3 − 1) × 2 », « ≈ 4 × 350 / 0.75 » ;
//   { error }                     — expression illisible : la case garde son texte, en rouge, avec cette note.
export function computeCase(text) {
  if (!isExpression(text)) return null;
  const result = evaluateExpression(text);
  if (result.error !== undefined) return { error: unreadableNote(result.error) };
  const shown = computedText(result.value);
  return { value: shown.text, expression: text.trim(), note: computedNote(expressionText(text), shown.rounded) };
}

// Entrée dans une case : calcule-t-elle (true), ou vérifie-t-elle, comme avant (false) ? Elle calcule toute expression.
// Après un calcul réussi, la case montre un nombre : le deuxième Entrée vérifie. Une expression illisible, elle, reste
// dans la case : Entrée la calcule de nouveau, et ne vérifie jamais (réponse de Thierry au rapport, point 2).
export const enterComputes = (text) => isExpression(text);

// La première case, dans l'ordre de l'écran, qui contient une expression illisible, ou null (réponse de Thierry au
// rapport, point 2) : tant qu'il y en a une, Vérifier — clic, toucher ou Entrée — ne part pas, et c'est elle qui reçoit
// le focus. Une faute de frappe dans un calcul ne coûte pas une série de réussites. Un texte illisible qui n'est pas une
// expression (« 12a ») n'arrête rien : il part, et reste une mauvaise réponse.
//   cases : [[champ, texte], …], dans l'ordre de l'écran
export function unreadableCase(cases) {
  return cases.find(([, text]) => computeCase(text)?.error !== undefined)?.[0] ?? null;
}

// Ce qui part au serveur pour une case : l'expression gardée de côté (`kept`, de computeCase) tant que la case montre
// son résultat ; sinon le texte de la case — un nombre tapé, ou un résultat retouché à la main : l'expression est oubliée.
export const answerOf = (text, kept = null) => (kept && text === kept.value ? kept.expression : text);

// La rangée de boutons de calcul, sur écran tactile (D82, point 6) : le caractère inséré, ou « = » qui calcule la case.
export const CALC_KEYS = [
  { label: '(', insert: '(', name: 'parenthèse ouvrante' },
  { label: ')', insert: ')', name: 'parenthèse fermante' },
  { label: '+', insert: '+', name: 'plus' },
  { label: '−', insert: '−', name: 'moins' },
  { label: '×', insert: '×', name: 'multiplié par' },
  { label: '÷', insert: '÷', name: 'divisé par' },
  { label: 'π', insert: 'π', name: 'pi' },
  { label: '=', compute: true, name: 'calculer' },
];

// Un bouton de la rangée insère son caractère à la place de la sélection [start, end[ — au curseur quand rien n'est
// sélectionné — et le curseur se place après lui : { value, caret }. null si la case dépasserait `max` caractères.
export function insertInCase(value, start, end, text, max) {
  const next = value.slice(0, start) + text + value.slice(end);
  return next.length > max ? null : { value: next, caret: start + text.length };
}

// --- Question corrigée (UI §3.4) --------------------------------------------------------------------------------

// L'explication de l'écart et de la tolérance, pour chaque champ faux, la grandeur en toutes lettres et l'unité après
// chaque valeur (D71) : « Ta vitesse de rotation de 3200 tr/min est à +6.7 % de 3000 tr/min (tolérance : ±5 % et
// ±1 tr/min). » La tolérance écrite en formule garde ses symboles (« ±0.5 % de N × f »). La saisie d'une expression
// s'y écrit en nombre (D82, typedNumber).
export function gapExplanation(correction) {
  const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  return correction.champs.filter((champ) => champ.evalue && !champ.ok).map((champ) => {
    const { name, unit } = FIELD_PARTS[champ.champ];
    if (champ.ecart_pct === null) return `${name} : réponse vide ou illisible (attendu ${champ.attendu} ${unit}).`;
    const sign = champ.ecart_pct > 0 ? '+' : '−';
    const tolerance = champ.tolerance === 'exacte' ? 'la réponse doit être exacte' : `tolérance : ${champ.tolerance}`;
    return `${capital(fieldInSentence(champ.champ))} de ${typedNumber(champ)} ${unit} est à ${sign}${Math.abs(champ.ecart_pct)} % de ${champ.attendu} ${unit} (${tolerance}).`;
  }).join(' ');
}

// --- Progression (UI §3.3) : un point par réussite consécutive ------------------------------------------------------
// Retourne un rang par outil : { id, label, dots: [true, true, false], state }
//   state : 'current' (outil de la question en cours), 'reset' (vient d'être remis à zéro),
//           'done' (toutes ses réussites acquises) ou 'todo'
export function progressRows(progression, labels, { currentId = null, resetId = null } = {}) {
  return progression.outils.map((outil) => {
    let state = outil.reussites >= outil.requises ? 'done' : 'todo';
    if (outil.id === currentId) state = 'current';
    if (outil.id === resetId) state = 'reset';
    return {
      id: outil.id,
      label: labels.get(outil.id) ?? outil.nom,
      dots: Array.from({ length: outil.requises }, (_, i) => i < outil.reussites),
      state,
    };
  });
}

// --- Mode test (D26) ---------------------------------------------------------------------------------------------
// Le serveur — et lui seul — décide du mode test : il joint alors à la question les valeurs attendues
// (question.reponses_test). Sans elles, ni bandeau ni bouton « Remplir » : retourne null.
export function testAnswers(question) {
  const answers = question.reponses_test;
  return answers !== null && typeof answers === 'object' && Object.keys(answers).length > 0 ? answers : null;
}

// --- Cadence (SPEC §7) : compte à rebours sur le bouton Vérifier -------------------------------------------------
// Le serveur dit combien de secondes attendre (seance.attendre_s, ou attendre_s d'un refus 429) ;
// le navigateur décompte. Le libellé du bouton pendant l'attente, puis « Vérifier ».
export function checkButtonLabel(seconds) {
  return seconds > 0 ? `Vérifier dans ${seconds} s` : 'Vérifier';
}

// Ce qu'il reste à attendre quand `elapsedMs` se sont écoulées depuis que le serveur a dit `seconds`
// (la question suivante arrive avec la correction, mais l'étudiant lit d'abord le corrigé).
export function remainingWait(seconds, elapsedMs) {
  return Math.max(0, Math.ceil((seconds ?? 0) - elapsedMs / 1000));
}

// --- Progression par opération (UI §3.3, D81 ; VBA modAffGraph) -------------------------------------------------
// Les outils de la progression regroupés par opération : les opérations dans l'ordre de leur premier outil dans
// l'exercice, les outils dans l'ordre de l'exercice (celui du serveur). Chaque opération :
//   { operation, done, total, kept, gain, loss, complete, label, rows }
//   done / total : la somme des réussites de suite de ses outils (plafonnées par le serveur) / la somme de leurs
//                  réussites exigées — « n / m », et la barre, de 0 à total ;
//   kept, gain, loss : les trois parts de la barre, en réussites — acquis (bleu), gagné par la question (vert),
//                  perdu par la question (rouge, au-delà de ce qui reste). Sans progression d'avant (`previous` :
//                  premier affichage, question suivante), tout est acquis ;
//   complete : toutes ses réussites acquises — le contour doré, dès la question qui la complète ;
//   label : « Perçage : 6 réussites sur 10 », l'aria-label de la barre ;
//   rows : ses outils (progressRows).
// Sur téléphone (`phone`), les opérations terminées sont repliées (`folded`, dans l'ordre, sous `summary`), sauf
// celle de l'outil en cours et celle que la question vient de changer : une perte, un « remis à zéro », mais aussi un
// gain qui la complète (l'étudiant doit voir le contour doré). Une opération non terminée garde tous ses outils.
export function operationProgress(progression, labels, { previous = null, currentId = null, resetId = null, phone = false } = {}) {
  const rows = progressRows(progression, labels, { currentId, resetId });
  const before = new Map((previous?.outils ?? []).map((outil) => [outil.id, outil.reussites]));
  const groups = [];
  progression.outils.forEach((outil, index) => {
    let group = groups.find((entry) => entry.operation === outil.operation);
    if (!group) {
      group = { operation: outil.operation, done: 0, total: 0, kept: 0, gain: 0, loss: 0, rows: [] };
      groups.push(group);
    }
    // Une question ne touche qu'un outil : il gagne une réussite, ou retombe à zéro.
    const was = before.get(outil.id) ?? outil.reussites;
    group.done += outil.reussites;
    group.total += outil.requises;
    group.kept += Math.min(was, outil.reussites);
    group.gain += Math.max(0, outil.reussites - was);
    group.loss += Math.max(0, was - outil.reussites);
    group.rows.push(rows[index]);
  });
  const shown = [];
  const folded = [];
  for (const group of groups) {
    group.complete = group.done === group.total;
    group.label = `${group.operation} : ${group.done} réussite${group.done > 1 ? 's' : ''} sur ${group.total}`;
    const changed = group.gain > 0 || group.loss > 0 || group.rows.some((row) => row.state === 'current' || row.state === 'reset');
    (phone && group.complete && !changed ? folded : shown).push(group);
  }
  const summary = folded.length === 0 ? null : `${folded.length} opération${folded.length > 1 ? 's' : ''} terminée${folded.length > 1 ? 's' : ''}`;
  return { shown, folded, summary };
}

// Rappel sous le formulaire : « Sur cet outil : 2 réussites de suite sur 3 ».
export function toolStreak(progression, toolId) {
  const outil = progression.outils.find((entry) => entry.id === toolId);
  if (!outil) return '';
  return `Sur cet outil : ${outil.reussites} réussite${outil.reussites > 1 ? 's' : ''} de suite sur ${outil.requises}`;
}
