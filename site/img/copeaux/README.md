# Images de chaleur et de forme de copeaux, par classe ISO — la semence

Deux images par classe ISO 513 (P, M, K, N, S, H), fournies par Thierry : l'**image de chaleur** (où
la chaleur se concentre dans la coupe de cette classe de matériau) et l'**image de forme de
copeaux** (le copeau typique). Elles sont montrées sous la description du matériau brut de l'écran
Question, et dans l'aperçu de l'éditeur.

- `originaux/` — les fichiers tels que reçus (« Chaleur groupe P.png », « Copeaux groupe P.png »,
  RVBA 8 bits, fond blanc composé dans l'image). **C'est la source** ; ils ne sont pas servis.
- `copeaux-<classe>-chaleur.png`, `copeaux-<classe>-copeaux.png` — les mêmes, **détourés** (fond
  transparent, bord adouci, jamais agrandis, au plus 256 px) par
  `node reference/semence-d1/detourer-copeaux.mjs`, qui dit sa méthode et son seuil en tête. Ne pas
  les retoucher à la main : relancer le script (un test vérifie qu'ils sont exactement ce qu'il produit).

**Depuis la migration `0009` (décision D64), ces douze fichiers détourés sont la semence de la table
`images`** (usage `classe`, identifiant = le nom du fichier sans `.png`), servis par
`/images/<id>` ; chaque classe ISO des tables de référence nomme les siens (`image_chaleur`,
`image_copeaux`, valeurs par défaut d'une version d'avant). Comme pour les photos et les
pictogrammes (D56), **changer ou ajouter un fichier ici ne change rien en production** : c'est
l'onglet Images de l'éditeur qui téléverse (usage « image de classe ISO »), et l'onglet Tables de
référence qui choisit l'image d'une classe. Un test vérifie que la semence est identique à ces fichiers.

| id | classe | image |
|---|---|---|
| copeaux-p-chaleur, copeaux-p-copeaux | P | chaleur, forme de copeaux |
| copeaux-m-chaleur, copeaux-m-copeaux | M | chaleur, forme de copeaux |
| copeaux-k-chaleur, copeaux-k-copeaux | K | chaleur, forme de copeaux |
| copeaux-n-chaleur, copeaux-n-copeaux | N | chaleur, forme de copeaux |
| copeaux-s-chaleur, copeaux-s-copeaux | S | chaleur, forme de copeaux |
| copeaux-h-chaleur, copeaux-h-copeaux | H | chaleur, forme de copeaux |

La classe O (plastiques et graphite) n'a pas d'images : l'espace reste vide à l'écran.
