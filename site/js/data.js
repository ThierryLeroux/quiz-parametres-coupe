// Données de référence : lecture des JSON de site/data/ (SPEC §3).
// Tout ce qui interprète le contenu brut des JSON (libellés, filetages,
// conversions mm → po) vit ici ; le reste du moteur ne voit que des pouces.

const MM_PER_INCH = 25.4;

// Matériau d'outil tel qu'écrit dans outils.json → clé de `vc_pi_min` dans materiaux.json.
export const TOOL_MATERIAL_KEYS = {
  'Acier rapide': 'acier_rapide',
  'Carbure de tungstène solide': 'carbure_solide',
  'Insert de carbure de tungstène': 'insert_carbure',
};

const NUMBER = String.raw`(\d*\.?\d+)`; // accepte « 0.25 », « .3125 » et « 1 »
const IMPERIAL_THREAD = new RegExp(`^${NUMBER}-(\\d+)$`); // Ø (po) - filets au pouce
const METRIC_THREAD = new RegExp(`^${NUMBER}x${NUMBER}$`); // Ø (mm) x pas (mm)

// Interprète la valeur d'une dimension de filetage (SPEC §4.3) :
//   « 0.25-20 » → Ø 0,25 po, pas = 1/20 po
//   « 10x1.5 »  → Ø 10/25,4 po, pas = 1,5/25,4 po
// Retourne { diameter, pitch } en pouces, ou null si la valeur est illisible.
export function parseThread(valeur) {
  if (typeof valeur !== 'string') return null;

  let diameter;
  let pitch;
  const imperial = IMPERIAL_THREAD.exec(valeur);
  const metric = METRIC_THREAD.exec(valeur);
  if (imperial) {
    diameter = Number(imperial[1]);
    pitch = 1 / Number(imperial[2]);
  } else if (metric) {
    diameter = Number(metric[1]) / MM_PER_INCH;
    pitch = Number(metric[2]) / MM_PER_INCH;
  } else {
    return null;
  }

  // Un Ø nul, un pas nul ou « 0 filet au pouce » (pas infini) n'ont pas de sens.
  if (!(diameter > 0) || !(pitch > 0) || !Number.isFinite(pitch)) return null;
  return { diameter, pitch };
}
