// Génération d'une question (SPEC §4) : outil × dimension × matériaux, tirés au hasard.
// Ce module ne calcule aucune réponse (voir calcul.js) et ne décide pas quels
// outils sont « encore à évaluer » : l'appelant lui fournit la liste admissible.

import { TOOL_MATERIAL_KEYS, parseThread } from './data.js';

// Tirage uniforme d'un élément de la liste. `random` retourne un nombre dans [0, 1[, comme Math.random.
function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

// Tirage uniforme d'un entier dans [min, max].
function randomInt(min, max, random) {
  return min + Math.floor(random() * (max - min + 1));
}

// Remplace les jetons « [Nom] » du gabarit par leur valeur (VBA clsOutil.instIdOutil).
// Un jeton inconnu est une erreur : mieux vaut un message clair qu'un « [Xyz] » affiché à l'étudiant.
function resolveDisplayId(template, values) {
  return template.replace(/\[([^\]]*)\]/g, (token, name) => {
    if (!(name in values)) throw new Error(`Jeton inconnu dans le gabarit « ${template} » : ${token}`);
    return String(values[name]);
  });
}

// Génère une question.
//   data          : résultat de loadData (data.js)
//   eligibleTools : outils admissibles, c.-à-d. des éléments de data.outils choisis par l'appelant
//   random        : source d'aléa injectable, () => nombre dans [0, 1[
//
// Il y a toujours exactement 6 tirages, dans cet ordre (celui du VBA et de la SPEC §4) :
// outil, nombre de dents, dimension, matériau d'outil, groupe de matériaux, matériau brut.
//
// Retourne un objet simple, sérialisable en JSON (localStorage, rapport). Il ne contient
// pas l'outil complet (jusqu'à 111 dimensions) : calcul.js le retrouve par `tool.id`.
export function generateQuestion(data, eligibleTools, random = Math.random) {
  if (!Array.isArray(eligibleTools) || eligibleTools.length === 0) {
    throw new Error('Aucun outil admissible : impossible de générer une question');
  }

  const tool = pick(eligibleTools, random);
  const teeth = randomInt(tool.nb_dents_min, tool.nb_dents_max, random);
  const rawDimension = pick(tool.dimensions, random);
  const toolMaterialLabel = pick(tool.materiaux_outil, random);
  const group = pick(tool.groupes_materiaux_usinables, random);
  const material = pick(data.materialsByGroup.get(group), random);

  // Filetage : la valeur est un texte (« 0.25-20 », « 10x1.5 ») ; sinon c'est le Ø en pouces.
  const isThread = data.operationByName.get(tool.operation).avance_egale_pas_filetage;
  const { diameter, pitch } = isThread ? parseThread(rawDimension.valeur) : { diameter: rawDimension.valeur, pitch: null };

  // ❓ La SPEC §4.6 dit « [IdDia], [NbDent], etc. ». Le VBA connaît 15 jetons, les données
  // n'en utilisent que 2. Interprétation : on reconnaît ces 2-là et 3 autres sans ambiguïté.
  // [Pas] et [Dia] sont écartés (dans le VBA, [Pas] vaut des filets/po, pas un pas en pouces).
  const displayId = resolveDisplayId(tool.format_identifiant, {
    IdDia: rawDimension.libelle,
    NbDent: teeth,
    NomOutil: tool.nom,
    Operation: tool.operation,
    Matoutil: toolMaterialLabel,
  });

  return {
    tool: { id: tool.id, name: tool.nom, operation: tool.operation },
    displayId,
    teeth,
    dimension: { label: rawDimension.libelle, diameter, pitch }, // pouces ; pitch = null hors filetage
    toolMaterial: { label: toolMaterialLabel, key: TOOL_MATERIAL_KEYS[toolMaterialLabel] },
    material: { ...material, vc_pi_min: { ...material.vc_pi_min } }, // copie de l'entrée de materiaux.json
  };
}
