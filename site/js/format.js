// Formatage des nombres pour l'affichage (SPEC §5, « Arrondis » ; décisions D9, D10, D14).
// L'arrondi n'existe qu'ici : calcul.js travaille sur les valeurs exactes, et la correction
// élargit ses tolérances d'une demi-unité du dernier chiffre affiché ici (D13).
// Séparateur décimal : le point, comme sur la commande CNC et dans les libellés (D10).

// Nombre de décimales affichées (SPEC §5).
const FEED_DECIMALS = 4;
const THREAD_FEED_DECIMALS = 5;
const FEED_SIGNIFICANT_DIGITS = 3;
const FEED_RATE_DECIMALS = 3;

// Arrondit à `decimals` décimales (demi vers le haut) et retourne le texte, ex. 4.8 → « 4.800 ».
// Le passage par toPrecision(12) efface le bruit de la virgule flottante avant d'arrondir :
// sans lui, 1.0005 × 1000 = 1000.4999999999999 s'arrondirait à « 1.000 » au lieu de « 1.001 ».
export function formatNumber(value, decimals) {
  const scaled = Math.round(Number((value * 10 ** decimals).toPrecision(12)));
  return (scaled / 10 ** decimals).toFixed(decimals);
}

// Nombre de décimales d'un texte produit par formatNumber : « 0.0015 » → 4, « 1600 » → 0.
export function decimalsOf(text) {
  const point = text.indexOf('.');
  return point === -1 ? 0 : text.length - point - 1;
}

// Avance (fz ou f), décision D14 : au moins `minDecimals` décimales ET au moins 3 chiffres
// significatifs, pour qu'un micro-foret ne s'affiche pas « 0.0000 ».
//   0.0015     → « 0.0015 »     0.003 → « 0.0030 »     0.001875 → « 0.00188 »
//   0.0000118… → « 0.0000118 »
// Les zéros de fin au-delà de `minDecimals` n'apprennent rien : on écrit « 0.0015 », pas « 0.00150 ».
export function formatFeed(value, minDecimals) {
  const forSignificantDigits = value > 0 ? FEED_SIGNIFICANT_DIGITS - 1 - Math.floor(Math.log10(value)) : 0;
  let text = formatNumber(value, Math.max(minDecimals, forSignificantDigits));
  while (decimalsOf(text) > minDecimals && text.endsWith('0')) text = text.slice(0, -1);
  return text;
}

// Met en forme les paramètres calculés par computeParameters (calcul.js).
// Retourne des textes, sans unités : vc, rpm, feedPerTooth, feedPerRev, feedRate.
export function formatParameters(parameters) {
  const feedDecimals = parameters.feedType === 'thread' ? THREAD_FEED_DECIMALS : FEED_DECIMALS;
  return {
    vc: String(parameters.vc), // valeur de la table, telle quelle
    rpm: formatNumber(parameters.rpm, 0),
    feedPerTooth: formatFeed(parameters.feedPerTooth, feedDecimals),
    feedPerRev: formatFeed(parameters.feedPerRev, feedDecimals),
    feedRate: formatNumber(parameters.feedRate, FEED_RATE_DECIMALS),
  };
}
