// Petits outils pour construire le DOM sans framework (D3) et sans innerHTML : tout texte venant
// des données ou de l'étudiant passe par des nœuds de texte, jamais par du HTML.

import { feedCodeLabel } from '../code-avance.js';
import { colorVariables } from '../tables.js';
import { decimalPoint, decimalPointInValues } from './text.js';

// Crée un élément.
//   attrs    : attributs HTML ; « onclick », « onsubmit »… branchent un écouteur ;
//              true → attribut sans valeur ; false, null ou undefined → attribut omis
//   children : un enfant ou une liste d'enfants — éléments ou textes
// Ex. : el('button', { class: 'button', type: 'button', onclick: start }, 'Nouvelle séance')
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else if (value === true) node.setAttribute(name, '');
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(name, value);
  }
  node.append(...[children].flat());
  return node;
}

// La pastille du code G d'avance (D96) : « G99 · avance par tour », au style d'un écran de commande — le code en tête,
// en bleu clair, puis le libellé (question.css, .code-g). Sur l'écran Question (panneau de l'outil) et sur la feuille des
// avances (en petit, sur deux lignes, le libellé en court : .code-g--sheet). Elle ne donne aucune réponse : toujours affichée.
export function feedCodeBadge(code, className = 'code-g', label = feedCodeLabel(code)) {
  return el('span', { class: className }, [el('span', { class: 'code-g-code' }, code), el('span', { class: 'code-g-sep', 'aria-hidden': 'true' }, ' · '), el('span', { class: 'code-g-label' }, label)]);
}

// Pose sur la page les couleurs de sens de la version des tables en usage (D61 : classes ISO,
// matières d'outil) — les variables CSS que tokens.css déclare avec ses valeurs par défaut.
//   materiaux : la table des matériaux, complétée (classes_iso, materiaux_outil)
export function applyTableColors(materiaux) {
  for (const [name, value] of colorVariables({ classesIso: materiaux?.classes_iso, toolMaterials: materiaux?.materiaux_outil })) {
    document.documentElement.style.setProperty(name, value);
  }
}

// La virgule décimale (D10, D71) : acceptée à la saisie, remplacée par un point À LA SORTIE du champ — jamais
// pendant la frappe, pour que le curseur ne saute pas (téléphone réglé en français, dont le clavier numérique
// n'a qu'une virgule). Les champs décimaux sont des champs texte (`inputmode="decimal"`), jamais
// type="number", qui effacerait « 0,15 » dans un navigateur réglé en anglais.
// Retourne true si le champ a changé ; il annonce alors un événement « input », comme une frappe, pour que
// la page relise sa valeur (validation de la Gestion du contenu). Un champ en lecture seule n'est pas touché.
//   un champ `inputmode="decimal"` : toute sa valeur ; une zone `data-decimal="valeurs"` (« libellé ; valeur »
//   par ligne, les dimensions de la Gestion du contenu) : la valeur de chaque ligne seulement
export function pointDecimalComma(field) {
  if (!field || field.readOnly || typeof field.value !== 'string') return false;
  let next = null;
  if (field.getAttribute('inputmode') === 'decimal') next = decimalPoint(field.value);
  else if (field.dataset?.decimal === 'valeurs') next = decimalPointInValues(field.value);
  if (next === null || next === field.value) return false;
  field.value = next;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

// Une seule écoute par page, posée sur <main> au démarrage : chaque champ décimal qu'on quitte.
export function convertDecimalCommas(root) {
  root.addEventListener('focusout', (event) => pointDecimalComma(event.target));
}

// Remplace le contenu de <main> par un écran, met à jour la barre du haut et le titre de l'onglet,
// puis place le focus : sur `focus` (sélecteur) s'il est donné, sinon sur le titre de l'écran.
//   header : { title, aside } — aside : texte ou éléments à droite de la barre
export function showScreen(main, screen, { title, aside = '' }, focus = 'h1') {
  main.replaceChildren(screen);
  // Seul le TEXTE du titre change : le logo et le titre restent le lien vers l'accueil de la page (D87).
  document.querySelector('#header-title').textContent = title;
  document.querySelector('#header-aside').replaceChildren(...[aside].flat());
  document.title = title;
  window.scrollTo(0, 0);
  main.querySelector(focus)?.focus();
}
