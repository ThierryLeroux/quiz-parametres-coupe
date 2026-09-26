# Images de chaleur par classe ISO — la semence

Une image par classe ISO 513 (P, M, K, N, S, H), fournie par Thierry : l'**image de chaleur** (où la chaleur
se concentre dans la coupe de cette classe de matériau ; elle montre aussi la forme du copeau). Elle est
montrée sous la description du matériau brut de l'écran Question, avec les caractéristiques de la classe à
sa droite, et dans l'aperçu de l'éditeur. Les images de forme de copeaux, d'abord fournies, ont été
retirées avant la mise en production (décision D66).

- `originaux/` — les fichiers tels que reçus (« Chaleur groupe P.png », RVBA 8 bits, fond blanc composé
  dans l'image). **C'est la source** ; ils ne sont pas servis.
- `copeaux-<classe>-chaleur.png` — les mêmes, **détourés** (fond transparent, objet érodé d'un pixel,
  bande de 3 px adoucie et démélangée du blanc, jamais agrandis, 340 px de large au plus — le double de la largeur affichée) par
  `node reference/semence-d1/detourer-copeaux.mjs`, qui dit sa méthode et ses constantes en tête. Ne pas
  les retoucher à la main : relancer le script (un test vérifie qu'ils sont exactement ce qu'il produit).

**Depuis la migration `0009` (décisions D64, D66), ces six fichiers détourés sont la semence de la table
`images`** (usage `classe`, identifiant = le nom du fichier sans `.png`), servis par `/images/<id>` ;
chaque classe ISO des tables de référence nomme la sienne (`image_chaleur`, valeur par défaut d'une version
d'avant). Comme pour les photos et les pictogrammes (D56), **changer ou ajouter un fichier ici ne change rien
en production** : c'est l'onglet Images de l'éditeur qui téléverse (usage « image de classe ISO »), et
l'onglet Tables de référence qui choisit l'image d'une classe. Un test vérifie que la semence est identique à
ces fichiers.

| id | classe |
|---|---|
| copeaux-p-chaleur | P |
| copeaux-m-chaleur | M |
| copeaux-k-chaleur | K |
| copeaux-n-chaleur | N |
| copeaux-s-chaleur | S |
| copeaux-h-chaleur | H |

La classe O (plastiques et graphite) n'a pas d'image : l'espace reste vide à l'écran. Le dossier garde son
nom, `copeaux/`, et les identifiants leur préfixe `copeaux-` : ils sont semés tels quels.
