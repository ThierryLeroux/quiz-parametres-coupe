// Règles d'affichage de l'écran Question (UI §3.3, §3.4) : ce qu'on montre, et quand. Fonctions
// PURES, sans DOM, testées sous Node ; question-screen.js ne fait que les mettre à l'écran.
// Elles reçoivent ce que renvoie le serveur (SPEC §7) et le catalogue (loadData).

import { TOOL_MATERIAL_KEYS } from '../data.js';

// --- Outils de même nom -------------------------------------------------------------------------------------
// Le TITRE de la question est le gabarit de l'outil résolu par le serveur (question.identifiant,
// D24), tel quel : « SDTMR - filetage: M64 x 6 ». La PROGRESSION, elle, liste les outils par leur nom
// générique : quand deux outils d'un exercice portent le même nom (« SDTMR » impérial et métrique),
// elle ajoute ce qui les distingue, entre parenthèses ; la donnée `nom` ne change pas.
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

// --- Couleurs de sens (UI §1) ---------------------------------------------------------------------------------

// Variable CSS de la couleur du matériau d'outil : « Acier rapide » → « --tool-acier-rapide ».
export function toolMaterialColor(label) {
  const key = TOOL_MATERIAL_KEYS[label];
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
  return [`Ø usiné${word ? ` (${word})` : ''} : ${question.dimension} — pour le RPM`, `Ø de la barre : ${question.outil.barre} — pour l'avance`];
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
      proportional: question.outil.barre
        ? ' Avance proportionnelle au Ø : avance × Ø de la barre (pas le Ø usiné), sans dépasser l’avance max.'
        : ' Avance proportionnelle au Ø : avance × Ø outil, sans dépasser l’avance max.',
      thread: ' Filetage : fz = pas = 1 / filets au pouce (ou mm / 25.4).',
      fixed: '',
    };
    return plain(`Avance par dent → table des avances, à l'opération de l'outil.${byFamily[family]}`, 'avances');
  }
  if (field === 'rpm') {
    const factor = question.outil.fact_vc === 1 ? '' : `, × ${question.outil.fact_vc} pour cet outil`;
    const which = question.outil.barre ? 'Ø usiné (le trou, pas la barre)' : 'Ø';
    return plain(`RPM → N = Vc × 4 / ${which}, plafonnée au RPM max de la machine${factor}.`);
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

// --- Repli des outils terminés sur téléphone (UI §3.3) ---------------------------------------------------------
// Les rangs terminés (« done ») sortent de la liste, dans l'ordre, pour être repliés sous un résumé ;
// l'outil en cours et celui qui vient d'être remis à zéro ne sont jamais repliés (leur état diffère).
export function foldDoneRows(rows) {
  return {
    shown: rows.filter((row) => row.state !== 'done'),
    folded: rows.filter((row) => row.state === 'done'),
  };
}

// Rappel sous le formulaire : « Sur cet outil : 2 réussites de suite sur 3 ».
export function toolStreak(progression, toolId) {
  const outil = progression.outils.find((entry) => entry.id === toolId);
  if (!outil) return '';
  return `Sur cet outil : ${outil.reussites} réussite${outil.reussites > 1 ? 's' : ''} de suite sur ${outil.requises}`;
}
