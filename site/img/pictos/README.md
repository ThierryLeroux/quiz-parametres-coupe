# Pictogrammes (UI §5)

## `grandeurs/` — six SVG, un par grandeur

`vc`, `fz`, `n`, `f`, `vf`, `pas` : trait de 1.8, cadre de 24 × 24, tirés des maquettes approuvées
(`docs/maquettes/03-question.html`, `05c-tables-formules.html`). Modifiables dans tout éditeur de
SVG. Ils sont affichés par un masque CSS (`.picto` dans `site/css/question.css`) : c'est la couleur du
texte autour qui les colore, le `stroke` du fichier n'a donc pas d'importance.

## `operations/` — dix-neuf PNG **provisoires**, un par opération

Le fichier porte le nom de l'opération d'`operations.json`, sans accents, en minuscules, tout le
reste remplacé par `_` : « Chanfreinage / ébavurage » → `chanfreinage_ebavurage.png`
(`operationSlug` dans `site/js/ui/sheets-data.js` ; un test vérifie que chaque opération a le sien).

Ce sont les recadrages du rendu de la feuille Excel (`reference/pictogrammes-excel-provisoires/`) :
certains sont rognés ou portent un fragment du dessin voisin. À remplacer par des SVG propres —
fichiers d'origine de Thierry, export vectoriel du classeur, ou redessin fidèle (UI §8). Le jour
venu : déposer les `.svg` ici et changer l'extension dans `operationPicto`.

Une opération ajoutée au catalogue sans pictogramme s'affiche sans image, sans erreur.
