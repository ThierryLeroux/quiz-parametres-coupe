# Pictogrammes (UI §5)

## `grandeurs/` — six SVG, un par grandeur

`vc`, `fz`, `n`, `f`, `vf`, `pas` : trait de 1.8, cadre de 24 × 24, tirés des maquettes approuvées
(`docs/maquettes/03-question.html`, `05c-tables-formules.html`). Modifiables dans tout éditeur de
SVG. Ils sont affichés par un masque CSS (`.picto` dans `site/css/question.css`) : c'est la couleur du
texte autour qui les colore, le `stroke` du fichier n'a donc pas d'importance.

## `operations/` — dix-neuf SVG, un par opération

Ce sont **les dessins d'origine du classeur**, convertis sans redessin (décision D29) : les formes
DrawingML de la feuille « Avances d'usinage » (`xl/drawings/drawing3.xml`, groupe « Group 4 »),
traduites en SVG par `reference/pictogrammes-du-classeur/convertir.mjs`. **Ne pas les retoucher à la
main** : relancer la conversion (`node reference/pictogrammes-du-classeur/convertir.mjs`, depuis la
racine du dépôt). Le README de ce dossier dit ce qui est couvert et la correspondance
sous-groupe → opération.

Le fichier porte le nom de l'opération d'`operations.json`, sans accents, en minuscules, tout le
reste remplacé par `_` : « Chanfreinage / ébavurage » → `chanfreinage_ebavurage.svg`
(`operationSlug` dans `site/js/ui/sheets-data.js` ; un test vérifie que chaque opération a le sien).
Ils servent à la feuille des avances et au panneau de l'outil de l'écran Question, sur une pastille
blanche.

**Depuis le jalon 7b (décision D56), ces dix-neuf fichiers sont la semence de la table `images`**
(migration `0007`, identifiant = le slug, contenu assaini par `worker/svg.js`) : le site les lit
par `/images/<slug>`, jamais ici. Relancer la conversion change les fichiers du dépôt, pas la
production : un pictogramme nouveau ou retouché se **téléverse dans l'éditeur** (onglet Images,
usage « pictogramme d'opération »), où le serveur l'assainit (scripts, liens et ressources externes
refusés, D57). Une opération sans pictogramme s'affiche sans image, sans erreur ; le sien se dessine
dans tout éditeur de SVG (palette : bleu `#00B0F0`, bouchée `#FFC000`, trait noir).

## `miniatures/` — deux SVG de la feuille Formules

Schémas des deux tables (où se fait le relevé) : ceux des maquettes approuvées.
