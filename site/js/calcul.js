// Calcul des réponses attendues d'une question (SPEC §5).
// Unités impériales partout : pouces, pi/min, rév/min, po/min.
// AUCUN arrondi ici : les tolérances de correction (SPEC §6) absorbent les
// arrondis de l'étudiant, et l'affichage arrondit de son côté (format.js).

// Calcule les paramètres de coupe théoriques d'une question.
//   question : objet produit par generateQuestion (question.js)
//   data     : résultat de loadData (data.js) ; l'outil y est retrouvé par question.tool.id
//
// Retourne un objet simple, sérialisable en JSON :
//   vc                 vitesse de coupe (pi/min), lue dans la table — sans fact_vc
//   rpmRaw             N calculé, avant plafond (rév/min)
//   rpm                N retenu = min(rpmRaw, limite_rpm de l'outil)
//   rpmCapped          true si le plafond limite_rpm a été appliqué
//   feedPerTooth       avance par dent fz (po/dent)
//   feedPerToothCapped true si le plafond avance_max_po_rev de l'opération a été appliqué
//   feedPerRev         avance par révolution f = fz × nombre de dents (po/rév)
//   feedRate           vitesse d'avance Vf = N × f (po/min)
//   feedType           famille d'avance de l'opération : 'thread' (filetage), 'proportional'
//                      (proportionnelle au Ø) ou 'fixed' — la correction choisit ses tolérances
//                      d'après elle (SPEC §6), sans avoir à relire les données
export function computeParameters(question, data) {
  const tool = data.outils.find((o) => o.id === question.tool.id);
  if (!tool) throw new Error(`Outil inconnu : « ${question.tool.id} »`);
  const operation = data.operationByName.get(tool.operation);
  const diameter = question.dimension.diameter;

  // Formule pédagogique du cours : N = Vc × 4 / D (et non 3,82). Ne pas « corriger ».
  const vc = question.material.vc_pi_min[question.toolMaterial.key];
  const rpmRaw = (vc * 4 / diameter) * tool.fact_vc;
  const rpmCapped = rpmRaw > tool.limite_rpm;
  const rpm = rpmCapped ? tool.limite_rpm : rpmRaw;

  // Avance par dent : trois familles d'opérations.
  let feedType;
  let feedPerTooth;
  let feedPerToothCapped = false;
  if (operation.avance_egale_pas_filetage) {
    feedType = 'thread';
    feedPerTooth = question.dimension.pitch; // filetage : l'avance est le pas
  } else if (operation.avance_proportionnelle_diametre) {
    feedType = 'proportional';
    // Outil à deux diamètres (D25) : l'avance suit le Ø de l'outil (la barre), pas le Ø alésé qui sert à N.
    const toolDiameter = question.bar ? question.bar.diameter : diameter;
    const proportional = operation.avance_po_rev * toolDiameter * tool.fact_av;
    feedPerToothCapped = proportional > operation.avance_max_po_rev;
    feedPerTooth = feedPerToothCapped ? operation.avance_max_po_rev : proportional;
  } else {
    feedType = 'fixed';
    feedPerTooth = operation.avance_po_rev; // avance fixe
  }

  const feedPerRev = feedPerTooth * question.teeth;
  const feedRate = rpm * feedPerRev;

  return { vc, rpmRaw, rpm, rpmCapped, feedPerTooth, feedPerToothCapped, feedPerRev, feedRate, feedType };
}
