// Correction des réponses de l'étudiant (SPEC §6) : tolérances par champ et par famille d'avance.
// Fonctions pures : aucune lecture des données, aucun affichage.

import { decimalsOf, formatParameters } from './format.js';

// Les 5 champs de réponse, dans l'ordre de l'écran. Mêmes noms que dans computeParameters (calcul.js).
export const ANSWER_FIELDS = ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate'];

// Tolérances du tableau de la SPEC §6, en fraction de la valeur de référence.
//   below / above : écart permis sous / au-dessus de la référence (0 = réponse exacte)
//   maxDeviation  : écart absolu maximal (po) — l'intervalle retenu est le plus étroit des deux
// S'y ajoute toujours la demi-unité d'affichage (D13), voir acceptedInterval.
const EXACT = { below: 0, above: 0 };
const within = (fraction) => ({ below: fraction, above: fraction });

// Vf, toutes familles (D15) : cohérence interne, ±0,5 % de N_saisi × f_saisi. Voir feedRateInterval.
const FEED_RATE_TOLERANCE = within(0.005);

const TOLERANCES = {
  thread: {
    vc: EXACT,
    feedPerTooth: within(0.001),
    rpm: { below: 0.9, above: 0.001 }, // la vitesse peut être réduite pour fileter
    feedPerRev: within(0.001),
  },
  fixed: {
    vc: EXACT,
    feedPerTooth: EXACT,
    rpm: within(0.05),
    feedPerRev: within(0.001),
  },
  proportional: {
    vc: EXACT,
    feedPerTooth: { ...within(0.25), maxDeviation: 0.001 },
    rpm: within(0.05),
    feedPerRev: within(0.2),
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
// D13 : la tolérance effective est la plus large entre celle du tableau et `halfUnit`, la
// demi-unité du dernier chiffre affiché (±0,5 rév/min pour N, ±0,00005 po pour une avance à
// 4 décimales…). Ainsi la valeur théorique arrondie comme à l'écran est toujours acceptée,
// et « exact » veut dire : exact à la précision affichée.
function acceptedInterval(reference, tolerance, halfUnit) {
  let min = reference * (1 - tolerance.below);
  let max = reference * (1 + tolerance.above);
  if (tolerance.maxDeviation !== undefined) {
    min = Math.max(min, reference - tolerance.maxDeviation);
    max = Math.min(max, reference + tolerance.maxDeviation);
  }
  return { min: clean(Math.min(min, reference - halfUnit)), max: clean(Math.max(max, reference + halfUnit)) };
}

// Intervalle accepté pour Vf (D15) : cohérence avec N et f, pas avec la valeur théorique.
// N et f ne sont connus qu'à la précision de leur affichage (D13) : « 4 » rév/min peut être
// 4,375 dans la calculatrice de l'étudiant. Vf doit donc tomber entre le plus petit et le
// plus grand produit N × f possibles, élargis de ±0,5 % (ou de la demi-unité de Vf).
function feedRateInterval(rpm, feedPerRev, halfUnits) {
  const lowest = Math.max(rpm - halfUnits.rpm, 0) * Math.max(feedPerRev - halfUnits.feedPerRev, 0);
  const highest = (rpm + halfUnits.rpm) * (feedPerRev + halfUnits.feedPerRev);
  return {
    min: acceptedInterval(lowest, FEED_RATE_TOLERANCE, halfUnits.feedRate).min,
    max: acceptedInterval(highest, FEED_RATE_TOLERANCE, halfUnits.feedRate).max,
  };
}

// Corrige les réponses d'une question.
//   expected      : valeurs théoriques, résultat de computeParameters (dont feedType, la famille d'avance)
//   answers       : les saisies, en texte : { vc, feedPerTooth, rpm, feedPerRev, feedRate }
//   fieldsToGrade : champs à corriger ; les autres (pré-remplis, SPEC §10) sont réputés corrects
//
// Retourne { success, fields } où fields[champ] = { ok, value, min, max } :
//   value    : nombre lu dans la saisie, ou null (vide, illisible, ou champ non corrigé)
//   min, max : intervalle accepté, bornes incluses (null pour un champ non corrigé)
//   success  : true si tous les champs sont ok
export function gradeAnswers(expected, answers, fieldsToGrade = ANSWER_FIELDS) {
  const tolerances = TOLERANCES[expected.feedType];
  if (!tolerances) throw new Error(`Famille d'avance inconnue : « ${expected.feedType} »`);
  for (const field of fieldsToGrade) {
    if (!ANSWER_FIELDS.includes(field)) throw new Error(`Champ à corriger inconnu : « ${field} »`);
  }

  // Demi-unité du dernier chiffre affiché, par champ : « 1600 » → 0,5 ; « 0.0015 » → 0,00005.
  const displayed = formatParameters(expected);
  const halfUnits = {};
  const values = {};
  for (const field of ANSWER_FIELDS) {
    halfUnits[field] = 0.5 * 10 ** -decimalsOf(displayed[field]);
    values[field] = parseAnswer(answers[field]);
  }

  const fields = {};
  for (const field of ANSWER_FIELDS) {
    if (!fieldsToGrade.includes(field)) {
      fields[field] = { ok: true, value: null, min: null, max: null };
      continue;
    }

    // Vf : on part de ce que l'étudiant a saisi pour N et f ; un champ non saisi (pré-rempli,
    // vide ou illisible) est remplacé par sa valeur théorique.
    const { min, max } = field === 'feedRate'
      ? feedRateInterval(values.rpm ?? expected.rpm, values.feedPerRev ?? expected.feedPerRev, halfUnits)
      : acceptedInterval(expected[field], tolerances[field], halfUnits[field]);

    const value = values[field];
    fields[field] = { ok: value !== null && value >= min && value <= max, value, min, max };
  }

  const success = ANSWER_FIELDS.every((field) => fields[field].ok);
  return { success, fields };
}
