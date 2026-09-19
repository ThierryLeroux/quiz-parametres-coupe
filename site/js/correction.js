// Correction des réponses de l'étudiant (SPEC §6) : tolérances par champ et par famille d'avance.
// Fonctions pures : aucune lecture des données, aucun affichage.

// Les 5 champs de réponse, dans l'ordre de l'écran. Mêmes noms que dans computeParameters (calcul.js).
export const ANSWER_FIELDS = ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate'];

// Tolérances de la SPEC §6, en fraction de la valeur de référence.
//   below / above : écart permis sous / au-dessus de la référence (0 = réponse exacte)
//   maxDeviation  : écart absolu maximal (po) — l'intervalle retenu est le plus étroit des deux
//   entered       : la référence est N_saisi × f_saisi (cohérence interne), pas la valeur théorique
const EXACT = { below: 0, above: 0 };
const within = (fraction) => ({ below: fraction, above: fraction });

const TOLERANCES = {
  thread: {
    vc: EXACT,
    feedPerTooth: within(0.001),
    // ❓ La SPEC dit « de −90 % à +0,1 % » ; le VBA calculait Rt × (0,1 − 0,001), soit −90,1 %.
    // On suit la SPEC. La vitesse peut être réduite pour fileter.
    rpm: { below: 0.9, above: 0.001 },
    feedPerRev: within(0.001),
    feedRate: { ...within(0.005), entered: true },
  },
  fixed: {
    vc: EXACT,
    feedPerTooth: EXACT,
    rpm: within(0.05),
    feedPerRev: within(0.001),
    feedRate: within(0.051),
  },
  proportional: {
    vc: EXACT,
    feedPerTooth: { ...within(0.25), maxDeviation: 0.001 },
    rpm: within(0.05),
    feedPerRev: within(0.2),
    feedRate: within(0.25),
  },
};

// Lit une saisie : point ou virgule décimale (D10), espaces ignorés (« 1 600 »).
// Retourne le nombre, ou null si la saisie est vide ou illisible (« abc », « 1.2.3 », « -5 »).
export function parseAnswer(text) {
  if (typeof text !== 'string') return null;
  const compact = text.replace(/\s/g, '').replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(compact)) return null;
  return Number(compact);
}

// Efface le bruit de la virgule flottante (1600 × 0,95 = 1520,0000000000002) pour que
// la borne soit exactement le nombre que l'étudiant peut saisir (1520).
const clean = (value) => Number(value.toPrecision(12));

// Intervalle accepté [min, max], bornes incluses, autour de la valeur de référence.
function acceptedInterval(reference, tolerance) {
  let min = reference * (1 - tolerance.below);
  let max = reference * (1 + tolerance.above);
  if (tolerance.maxDeviation !== undefined) {
    min = Math.max(min, reference - tolerance.maxDeviation);
    max = Math.min(max, reference + tolerance.maxDeviation);
  }
  return { min: clean(min), max: clean(max) };
}

// Corrige les réponses d'une question.
//   question      : la question posée (non utilisée pour l'instant : tout ce qu'il faut est dans `expected`)
//   expected      : valeurs théoriques, résultat de computeParameters (dont feedType, la famille d'avance)
//   answers       : les saisies, en texte : { vc, feedPerTooth, rpm, feedPerRev, feedRate }
//   fieldsToGrade : champs à corriger ; les autres (pré-remplis, SPEC §10) sont réputés corrects
//
// Retourne { success, fields } où fields[champ] = { ok, value, min, max } :
//   value    : nombre lu dans la saisie, ou null (vide, illisible, ou champ non corrigé)
//   min, max : intervalle accepté, bornes incluses (null pour un champ non corrigé)
//   success  : true si tous les champs sont ok
export function gradeAnswers(question, expected, answers, fieldsToGrade = ANSWER_FIELDS) {
  const tolerances = TOLERANCES[expected.feedType];
  if (!tolerances) throw new Error(`Famille d'avance inconnue : « ${expected.feedType} »`);
  for (const field of fieldsToGrade) {
    if (!ANSWER_FIELDS.includes(field)) throw new Error(`Champ à corriger inconnu : « ${field} »`);
  }

  const values = {};
  for (const field of ANSWER_FIELDS) values[field] = parseAnswer(answers[field]);

  const fields = {};
  for (const field of ANSWER_FIELDS) {
    if (!fieldsToGrade.includes(field)) {
      fields[field] = { ok: true, value: null, min: null, max: null };
      continue;
    }

    const tolerance = tolerances[field];
    // Cohérence interne (Vf en filetage) : on part de ce que l'étudiant a saisi pour N et f ;
    // si une de ces saisies manque ou est illisible, on prend sa valeur théorique.
    const reference = tolerance.entered
      ? (values.rpm ?? expected.rpm) * (values.feedPerRev ?? expected.feedPerRev)
      : expected[field];

    const { min, max } = acceptedInterval(reference, tolerance);
    const value = values[field];
    fields[field] = { ok: value !== null && value >= min && value <= max, value, min, max };
  }

  const success = ANSWER_FIELDS.every((field) => fields[field].ok);
  return { success, fields };
}
