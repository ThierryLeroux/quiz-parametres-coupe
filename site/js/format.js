// Formatage des nombres pour l'affichage (SPEC §5, « Arrondis »).
// L'arrondi n'existe qu'ici : calcul.js et la correction travaillent sur les valeurs exactes.

// ❓ Séparateur décimal à l'affichage : virgule (interface en français). Les libellés des
// données, eux, utilisent le point (« 0.2500" », « M10 x 1.50 »). À confirmer par Thierry.
const DECIMAL_SEPARATOR = ',';

// Nombre de décimales affichées (SPEC §5).
const FEED_DECIMALS = 4;
const THREAD_FEED_DECIMALS = 5;
const FEED_RATE_DECIMALS = 3;

// Arrondit à `decimals` décimales (demi vers le haut) et retourne le texte, ex. 4.8 → « 4,800 ».
// Le passage par toPrecision(12) efface le bruit de la virgule flottante avant d'arrondir :
// sans lui, 1,0005 × 1000 = 1000,4999999999999 s'arrondirait à « 1,000 » au lieu de « 1,001 ».
export function formatNumber(value, decimals) {
  const scaled = Math.round(Number((value * 10 ** decimals).toPrecision(12)));
  return (scaled / 10 ** decimals).toFixed(decimals).replace('.', DECIMAL_SEPARATOR);
}

// Met en forme les paramètres calculés par computeParameters (calcul.js).
//   isThread : true pour une question de filetage (question.dimension.pitch !== null)
// Retourne des textes, sans unités : vc, rpm, feedPerTooth, feedPerRev, feedRate.
export function formatParameters(parameters, isThread) {
  const feedDecimals = isThread ? THREAD_FEED_DECIMALS : FEED_DECIMALS;
  return {
    vc: String(parameters.vc).replace('.', DECIMAL_SEPARATOR), // valeur de la table, telle quelle
    rpm: formatNumber(parameters.rpm, 0),
    feedPerTooth: formatNumber(parameters.feedPerTooth, feedDecimals),
    feedPerRev: formatNumber(parameters.feedPerRev, feedDecimals),
    feedRate: formatNumber(parameters.feedRate, FEED_RATE_DECIMALS),
  };
}
