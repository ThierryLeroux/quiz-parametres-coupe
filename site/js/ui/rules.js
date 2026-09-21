// Règles d'affichage de l'écran Question (UI §3.3, §3.4) : ce qu'on montre, et quand. Fonctions
// PURES, sans DOM, testées sous Node ; question-screen.js ne fait que les mettre à l'écran.
// Elles reçoivent ce que renvoie le serveur (SPEC §7) et le catalogue (loadData).

import { TOOL_MATERIAL_KEYS } from '../data.js';

// --- Outils de même nom -------------------------------------------------------------------------------------
// Quand deux outils d'un exercice portent le même nom (« SDTMR » impérial et métrique), l'écran
// ajoute ce qui les distingue, entre parenthèses ; la donnée `nom` ne change pas.
//   1. l'unité, si elle diffère : « SDTMR (impérial) », « SDTMR (métrique) » ;
//   2. sinon la plage de dimensions : « Foret fractionnaire (Ø 1/64 po à Ø 1 po) ».

// Un outil est métrique si ses dimensions le sont : filet « ØxPas » en mm, ou libellé en mm.
function toolUnit(tool) {
  const { libelle, valeur } = tool.dimensions[0];
  const metric = typeof valeur === 'string' ? valeur.includes('x') : /\bmm\b/.test(libelle);
  return metric ? 'métrique' : 'impérial';
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

// L'en-tête de la question avec le nom à afficher : « SDTMR (métrique) - filetage: M64 x 6 ».
// Un identifiant qui ne contient pas le nom de l'outil (« Foret Ø 1/4 po ») reste tel quel : sa
// dimension le distingue déjà.
export function labeledIdentifier(question, labels) {
  const label = labels.get(question.outil.id) ?? question.outil.nom;
  return question.identifiant.replace(question.outil.nom, label);
}

// --- Couleurs de sens (UI §1) ---------------------------------------------------------------------------------

// Variable CSS de la couleur du matériau d'outil : « Acier rapide » → « --tool-acier-rapide ».
export function toolMaterialColor(label) {
  const key = TOOL_MATERIAL_KEYS[label];
  return key ? `--tool-${key.replaceAll('_', '-')}` : '--color-accent';
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

// --- Aide contextuelle (UI §3.3) : la méthode, jamais la valeur, ni la ligne ni la colonne -------------------------
// Retourne { parts, table } :
//   parts : le texte, en morceaux — { text, accent } où accent vaut 'material' ou 'tool' pour les
//           mots à colorer comme le panneau correspondant, ou undefined
//   table : la feuille que le bouton « Ouvrir la table » ouvre ('vc' ou 'avances'), ou null
export function helpLine(field, question, family) {
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
      proportional: ' Avance proportionnelle au Ø : avance × Ø outil, sans dépasser l’avance max.',
      thread: ' Filetage : fz = pas = 1 / filets au pouce (ou mm / 25.4).',
      fixed: '',
    };
    return plain(`Avance par dent → table des avances, à l'opération de l'outil.${byFamily[family]}`, 'avances');
  }
  if (field === 'rpm') {
    const factor = question.outil.fact_vc === 1 ? '' : `, × ${question.outil.fact_vc} pour cet outil`;
    return plain(`RPM → N = Vc × 4 / Ø, plafonnée au RPM max de la machine${factor}.`);
  }
  if (field === 'feedPerRev') return plain('Avance totale par révolution → f = fz × nombre de dents.');
  return plain("Vitesse d'avance → Vf = N × f.");
}

// --- Question corrigée (UI §3.4) --------------------------------------------------------------------------------

const SYMBOLS = { vc: 'Vc', feedPerTooth: 'fz', rpm: 'N', feedPerRev: 'f', feedRate: 'Vf' };

// L'explication de l'écart et de la tolérance, pour chaque champ faux :
// « Ta Vf de 13.2 est à +5.6 % de 12.500 (tolérance : ±0.5 % de N × f). »
export function gapExplanation(correction) {
  return correction.champs.filter((champ) => champ.evalue && !champ.ok).map((champ) => {
    const symbol = SYMBOLS[champ.champ];
    if (champ.ecart_pct === null) return `${symbol} : réponse vide ou illisible (attendu ${champ.attendu}).`;
    const sign = champ.ecart_pct > 0 ? '+' : '−';
    const tolerance = champ.tolerance === 'exacte' ? 'la réponse doit être exacte' : `tolérance : ${champ.tolerance}`;
    return `Ta ${symbol} de ${champ.saisie} est à ${sign}${Math.abs(champ.ecart_pct)} % de ${champ.attendu} (${tolerance}).`;
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

// Rappel sous le formulaire : « Sur cet outil : 2 réussites de suite sur 3 ».
export function toolStreak(progression, toolId) {
  const outil = progression.outils.find((entry) => entry.id === toolId);
  if (!outil) return '';
  return `Sur cet outil : ${outil.reussites} réussite${outil.reussites > 1 ? 's' : ''} de suite sur ${outil.requises}`;
}
