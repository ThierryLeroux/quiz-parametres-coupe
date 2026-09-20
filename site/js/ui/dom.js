// Petits outils pour construire le DOM sans framework (D3) et sans innerHTML : tout texte venant
// des données ou de l'étudiant passe par des nœuds de texte, jamais par du HTML.

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

// Remplace le contenu de <main> par un écran, met à jour la barre du haut et le titre de l'onglet,
// puis place le focus : sur `focus` (sélecteur) s'il est donné, sinon sur le titre de l'écran.
//   header : { title, aside } — aside : texte ou éléments à droite de la barre
export function showScreen(main, screen, { title, aside = '' }, focus = 'h1') {
  main.replaceChildren(screen);
  document.querySelector('#header-title').textContent = title;
  document.querySelector('#header-aside').replaceChildren(...[aside].flat());
  document.title = title;
  window.scrollTo(0, 0);
  main.querySelector(focus)?.focus();
}
