// Génération d'une question (SPEC §4) : outil × dimension × matériaux, tirés au hasard.
// Ce module ne calcule aucune réponse (voir calcul.js) et ne décide pas quels
// outils sont « encore à évaluer » : l'appelant lui fournit la liste admissible.

import { fittingBars, parseThread } from './data.js';

// Tirage uniforme d'un élément de la liste. `random` retourne un nombre dans [0, 1[, comme Math.random.
function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

// Tirage uniforme d'un entier dans [min, max].
function randomInt(min, max, random) {
  return min + Math.floor(random() * (max - min + 1));
}

// Une longueur en pouces pour les jetons [Dia] et [Pas] : au plus 5 décimales, sans zéros de fin.
const inchesText = (value) => String(Number(value.toFixed(5)));

// Remplace les jetons « [Nom] » du gabarit par leur valeur (VBA clsOutil.instIdOutil ; décision D24).
// Un jeton inconnu, ou sans valeur pour cet outil ([Pas] hors filetage), est une erreur : mieux vaut
// un message clair qu'un « [Xyz] » affiché à l'étudiant. validateData (data.js) l'attrape dès le chargement.
function resolveDisplayId(template, values) {
  return template.replace(/\[([^\]]*)\]/g, (token, name) => {
    if (values[name] === undefined || values[name] === null) throw new Error(`Jeton inconnu dans le gabarit « ${template} » : ${token}`);
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
// Un outil à deux diamètres (barre à aléser, D25) en demande un 7e, le dernier : sa barre, parmi
// celles qui entrent dans le trou tiré.
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
  // L'entrée de materiaux.json, sans ce qui ne regarde que la mise en page de la feuille (D27).
  const { debut_famille: _layout, ...material } = pick(data.materialsByGroup.get(group), random);

  // Filetage : la valeur est un texte (« 0.25-20 », « 10x1.5 ») ; sinon c'est le Ø en pouces.
  const isThread = data.operationByName.get(tool.operation).avance_egale_pas_filetage;
  const { diameter, pitch } = isThread ? parseThread(rawDimension.valeur) : { diameter: rawDimension.valeur, pitch: null };

  // Outil à deux diamètres : « dimension » est le Ø usiné (pour N), « bar » le Ø de l'outil (pour l'avance).
  const rawBar = tool.dimensions_barre ? pick(fittingBars(tool, diameter), random) : null;

  // Liste officielle des jetons : SPEC §4.6 (TEMPLATE_TOKENS, data.js).
  const displayId = resolveDisplayId(tool.format_identifiant, {
    IdDia: rawDimension.libelle,
    Dia: inchesText(diameter),
    Pas: pitch === null ? null : inchesText(pitch),
    IdBarre: rawBar?.libelle,
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
    bar: rawBar === null ? null : { label: rawBar.libelle, diameter: rawBar.valeur }, // null : l'outil n'a qu'un Ø
    toolMaterial: { label: toolMaterialLabel, key: data.toolMaterialKeys.get(toolMaterialLabel) }, // la clé de vc_pi_min, d'après les tables (D61)
    material: { ...material, vc_pi_min: { ...material.vc_pi_min } }, // copie : la question ne partage rien avec le catalogue
  };
}
