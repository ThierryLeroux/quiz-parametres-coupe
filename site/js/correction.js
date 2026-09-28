// Correction des réponses de l'étudiant (SPEC §6) : tolérances par champ et par famille d'avance.
// Fonctions pures : aucune lecture des données, aucun affichage.

import { evaluateExpression } from './expression.js';
import { decimalsOf, formatParameters } from './format.js';

// Les 5 champs de réponse, dans l'ordre de l'écran. Mêmes noms que dans computeParameters (calcul.js).
export const ANSWER_FIELDS = ['vc', 'feedPerTooth', 'rpm', 'feedPerRev', 'feedRate'];

// Tolérances du tableau de la SPEC §6, en fraction de la valeur de référence.
//   below / above : écart permis sous / au-dessus de la référence (0 = réponse exacte)
//   maxDeviation  : écart absolu maximal (po) — l'intervalle retenu est le plus étroit des deux
//   perTooth      : maxDeviation est par dent, à multiplier par le nombre de dents (f, D69)
//   margin        : élargissement absolu de chaque côté, ajouté après (tr/min) — D13, complément : un N
//                   calculé avec 12/π puis arrondi à l'entier tient ainsi dans la tolérance
// S'y ajoute toujours la demi-unité d'affichage (D13), voir acceptedInterval.
const EXACT = { below: 0, above: 0 };
const within = (fraction) => ({ below: fraction, above: fraction });

// Vf (D15) : cohérence interne avec N_saisi × f_saisi — ±0,5 %, sauf en filetage, ±0,01 % (D53 : le pas
// est exact, Vf doit l'être aussi ; la plage N ± demi-unité × f ± demi-unité et la demi-unité de Vf
// restent appliquées). Voir feedRateInterval.
const FEED_RATE_TOLERANCES = { thread: within(0.0001), fixed: within(0.005), proportional: within(0.005) };

// f (D69, D70), à partir de deux dents : cohérence avec fz × dents — fz saisi, ou fz affiché quand il est fourni —,
// pour toutes les familles. Voir coherentFeedPerTooth et feedPerRevInterval. Sinon (une dent ; fz masquée, vide ou
// illisible), f est jugée sur la valeur théorique avec `feedPerRev` du tableau ci-dessous : la tolérance de fz
// reportée sur f.
const FEED_PER_REV_COHERENCE = within(0.001);

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
    rpm: { ...within(0.05), margin: 1 },
    feedPerRev: within(0.001),
  },
  proportional: {
    vc: EXACT,
    feedPerTooth: { ...within(0.25), maxDeviation: 0.001 },
    rpm: { ...within(0.05), margin: 1 },
    feedPerRev: { ...within(0.25), maxDeviation: 0.001, perTooth: true },
  },
};

// La tolérance d'un champ, en clair, pour l'expliquer à l'étudiant après la correction (UI §3.4) :
// « exacte », « ±5 % et ±1 tr/min », « de −90 % à +0.1 % », « ±25 %, au plus ±0.001 po », « ±0.5 % de N × f ».
// Écrite à partir des mêmes constantes que la correction : elle ne peut pas la contredire.
// (La demi-unité d'affichage de D13 n'y est pas dite : elle ne sert qu'à accepter les arrondis.)
//   coherence : f jugée sur fz × dents (D69, D70) — « ±0.1 % de fz × dents » ; sinon la tolérance de fz reportée
//   teeth     : le nombre de dents de la question — à une dent, pas de « par dent » (D70)
export function toleranceLabel(feedType, field, { coherence = false, teeth = null } = {}) {
  const percent = (fraction) => `${Number((fraction * 100).toPrecision(6))} %`;
  const tolerance = field === 'feedRate' ? FEED_RATE_TOLERANCES[feedType] : TOLERANCES[feedType]?.[field];
  if (!tolerance) throw new Error(`Tolérance inconnue : « ${feedType} », « ${field} »`);
  if (field === 'feedPerRev' && coherence) return `±${percent(FEED_PER_REV_COHERENCE.above)} de fz × dents`;
  if (tolerance.below === 0 && tolerance.above === 0) return 'exacte';
  let label = tolerance.below === tolerance.above ? `±${percent(tolerance.above)}` : `de −${percent(tolerance.below)} à +${percent(tolerance.above)}`;
  if (tolerance.maxDeviation !== undefined) label += `, au plus ±${tolerance.maxDeviation} po${tolerance.perTooth && teeth !== 1 ? ' par dent' : ''}`;
  if (tolerance.margin !== undefined) label += ` et ±${tolerance.margin} tr/min`;
  return field === 'feedRate' ? `${label} de N × f` : label;
}

// Lit une saisie : un nombre — point ou virgule décimale (D10), espaces ignorés (« 1 600 ») —, ou une expression
// (D82 : « (3-1)*2 », « 4 × 350 / 0,75 », lue par expression.js). Retourne le nombre, ou null si la saisie est vide ou
// illisible (« abc », « 1.2.3 », « -5 », « 2(3) », une division par zéro, un résultat négatif).
// Un nombre se lit exactement comme avant D82, par les deux lignes du milieu : seul ce qui n'en est pas un passe par
// l'évaluateur. Le serveur de correction lit chaque saisie avec cette fonction (seance.js, attestation.js).
export function parseAnswer(text) {
  if (typeof text !== 'string') return null;
  const compact = text.replace(/\s/g, '').replace(',', '.');
  if (/^(\d+\.?\d*|\.\d+)$/.test(compact)) return Number(compact);
  const result = evaluateExpression(text);
  return result.error === undefined ? result.value : null;
}

// Efface le bruit de la virgule flottante (1600 × 0,95 = 1520,0000000000002) pour que
// la borne soit exactement le nombre que l'étudiant peut saisir (1520).
const clean = (value) => Number(value.toPrecision(12));

// Intervalle accepté [min, max], bornes incluses, autour de la valeur de référence.
// D13 : la tolérance effective est la plus large entre celle du tableau et `halfUnit`, la
// demi-unité du dernier chiffre affiché (±0,5 tr/min pour N, ±0,00005 po pour une avance à
// 4 décimales…). Ainsi la valeur théorique arrondie comme à l'écran est toujours acceptée,
// et « exact » veut dire : exact à la précision affichée.
function acceptedInterval(reference, tolerance, halfUnit) {
  let min = reference * (1 - tolerance.below);
  let max = reference * (1 + tolerance.above);
  if (tolerance.maxDeviation !== undefined) {
    min = Math.max(min, reference - tolerance.maxDeviation);
    max = Math.min(max, reference + tolerance.maxDeviation);
  }
  if (tolerance.margin !== undefined) {
    min -= tolerance.margin;
    max += tolerance.margin;
  }
  return { min: clean(Math.min(min, reference - halfUnit)), max: clean(Math.max(max, reference + halfUnit)) };
}

// Intervalle accepté pour Vf (D15) : cohérence avec N et f, pas avec la valeur théorique.
// N et f ne sont connus qu'à la précision de leur affichage (D13) : « 4 » tr/min peut être
// 4,375 dans la calculatrice de l'étudiant. Vf doit donc tomber entre le plus petit et le
// plus grand produit N × f possibles, élargis de la tolérance de la famille (±0,5 %, ou ±0,01 % en
// filetage, D53) ou de la demi-unité de Vf.
function feedRateInterval(rpm, feedPerRev, halfUnits, feedType) {
  const tolerance = FEED_RATE_TOLERANCES[feedType];
  const lowest = Math.max(rpm - halfUnits.rpm, 0) * Math.max(feedPerRev - halfUnits.feedPerRev, 0);
  const highest = (rpm + halfUnits.rpm) * (feedPerRev + halfUnits.feedPerRev);
  return {
    min: acceptedInterval(lowest, tolerance, halfUnits.feedRate).min,
    max: acceptedInterval(highest, tolerance, halfUnits.feedRate).max,
  };
}

// L'avance par dent sur laquelle f est jugée par cohérence (D69, D70), ou null : f est alors jugée sur la valeur
// théorique, avec la tolérance de fz reportée.
//   une dent                          → null : f = fz, la même valeur, rien à vérifier de plus
//   fz à saisir et lisible            → la saisie
//   fz fournie                        → la valeur affichée, celle que l'étudiant a sous les yeux (le nombre de dents est vérifié)
//   fz masquée, ou à saisir mais vide ou illisible → null
// Les mêmes arguments que gradeAnswers ; correctionView (seance.js) s'en sert pour montrer la valeur attendue.
export function coherentFeedPerTooth(expected, answers, fieldsToGrade = ANSWER_FIELDS, masked = []) {
  if (expected.teeth < 2 || masked.includes('feedPerTooth')) return null;
  if (fieldsToGrade.includes('feedPerTooth')) return parseAnswer(answers.feedPerTooth);
  return Number(formatParameters(expected).feedPerTooth);
}

// Intervalle accepté pour f par cohérence (D69, D70) : ±0,1 % de fz × dents, comme Vf avec N × f. fz n'est connue
// qu'à la précision de son affichage (D13) : les produits sont pris sur la plage (fz ± demi-unité) × dents, et la
// demi-unité de f s'applique autour de la référence fz × dents — la plus large des deux, pas leur somme (D70).
function feedPerRevInterval(feedPerTooth, teeth, halfUnits) {
  const reference = feedPerTooth * teeth;
  const lowest = Math.max(feedPerTooth - halfUnits.feedPerTooth, 0) * teeth;
  const highest = (feedPerTooth + halfUnits.feedPerTooth) * teeth;
  return {
    min: clean(Math.min(lowest * (1 - FEED_PER_REV_COHERENCE.below), reference - halfUnits.feedPerRev)),
    max: clean(Math.max(highest * (1 + FEED_PER_REV_COHERENCE.above), reference + halfUnits.feedPerRev)),
  };
}

// La tolérance du tableau pour une question à `teeth` dents : un écart maximal par dent est multiplié par elles.
function toleranceFor(tolerance, teeth) {
  return tolerance.perTooth ? { ...tolerance, maxDeviation: tolerance.maxDeviation * teeth } : tolerance;
}

// Corrige les réponses d'une question.
//   expected      : valeurs théoriques, résultat de computeParameters (dont feedType, la famille d'avance,
//                   et teeth, le nombre de dents)
//   answers       : les saisies, en texte : { vc, feedPerTooth, rpm, feedPerRev, feedRate }
//   fieldsToGrade : champs à corriger ; les autres (pré-remplis, SPEC §10) sont réputés corrects
//   masked        : parmi les autres, les champs masqués (D52) — fz fournie et fz masquée ne jugent pas f de la même
//                   façon (D70) ; ceux qui ne sont ni à corriger ni masqués sont fournis
//
// Retourne { success, fields } où fields[champ] = { ok, value, min, max } :
//   value    : nombre lu dans la saisie, ou null (vide, illisible, ou champ non corrigé)
//   min, max : intervalle accepté, bornes incluses (null pour un champ non corrigé)
//   success  : true si tous les champs sont ok
export function gradeAnswers(expected, answers, fieldsToGrade = ANSWER_FIELDS, masked = []) {
  const tolerances = TOLERANCES[expected.feedType];
  if (!tolerances) throw new Error(`Famille d'avance inconnue : « ${expected.feedType} »`);
  if (!Number.isInteger(expected.teeth) || expected.teeth < 1) throw new Error(`Nombre de dents inconnu : « ${expected.teeth} »`);
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

  // La saisie d'un champ à corriger, lue ; null pour un champ fourni ou masqué (même si le navigateur
  // l'envoie), vide ou illisible. Dans les contrôles de cohérence, un champ non saisi est remplacé par sa
  // valeur théorique (SPEC §6).
  const typed = (field) => (fieldsToGrade.includes(field) ? values[field] : null);
  const coherentFz = coherentFeedPerTooth(expected, answers, fieldsToGrade, masked);

  const fields = {};
  for (const field of ANSWER_FIELDS) {
    if (!fieldsToGrade.includes(field)) {
      fields[field] = { ok: true, value: null, min: null, max: null };
      continue;
    }

    // Vf : on part de ce que l'étudiant a saisi pour N et f (D15). f : à partir de deux dents, du fz saisi ou
    // affiché ; sinon de la valeur théorique, avec la tolérance de fz reportée (D69, D70).
    let interval;
    if (field === 'feedRate') interval = feedRateInterval(typed('rpm') ?? expected.rpm, typed('feedPerRev') ?? expected.feedPerRev, halfUnits, expected.feedType);
    else if (field === 'feedPerRev' && coherentFz !== null) interval = feedPerRevInterval(coherentFz, expected.teeth, halfUnits);
    else interval = acceptedInterval(expected[field], toleranceFor(tolerances[field], expected.teeth), halfUnits[field]);
    const { min, max } = interval;

    const value = values[field];
    fields[field] = { ok: value !== null && value >= min && value <= max, value, min, max };
  }

  const success = ANSWER_FIELDS.every((field) => fields[field].ok);
  return { success, fields };
}
