# Rapport — images de chaleur et de forme de copeaux par classe ISO (décision D64)

Session du 2026-09-26. Branche `images-copeaux` à partir de `main` à jour, sept commits (un par point, puis
`test:api`, les docs et ce rapport), branche poussée, pas de fusion. `npm test` : 549 tests (+ 8), `fail 0` ;
`npm run test:api` : 31 étapes (+ 1) sur wrangler dev et une vraie D1 locale — la migration `0009` y passe.
Chrome à 1280 et 390 px : 18 vérifications, 10 captures dans `captures/images-copeaux/` (hors dépôt),
139 requêtes, **aucune externe**, aucune exception (un message console attendu : le 401 avant la connexion).

Les douze fichiers déposés se nommaient « Chaleur groupe P.png » et « Copeaux groupe P.png » : la
correspondance fichier → classe et type était sans ambiguïté, je n'ai pas eu à te la demander.

## 1. Fond transparent (`reference/semence-d1/detourer-copeaux.mjs`)

- **JavaScript pur** : `png.mjs` lit et écrit le PNG (8 bits, non entrelacé, tous les types de couleur ;
  filtres adaptatifs à l'écriture, zlib niveau 9 par `node:zlib`) — aucune dépendance, native ou non.
  Les originaux vont dans `site/img/copeaux/originaux/` (gardés comme source) ; le script écrit
  `site/img/copeaux/copeaux-<classe>-<chaleur|copeaux>.png`. Un test vérifie que les douze fichiers du
  dépôt sont exactement ce que le script produit (relancer le script plutôt que retoucher).
- **Méthode.** Remplissage depuis les bords, en 4-connexité, sur les pixels dont les trois canaux sont
  ≥ **244**. Ce qui n'est pas atteint depuis un bord reste opaque : le blanc intérieur d'un copeau ou d'un
  reflet, mais aussi la **pièce grise et l'outil, qui touchent les bords** — sur les images de chaleur,
  le blanc n'est que la zone au-dessus du copeau ; le rendu détouré garde donc la pièce et l'outil, avec
  une échancrure transparente (vu sur le fond nuit : c'est propre, voir les captures).
- **Seuil justifié par les pixels.** Sur les douze originaux (RVBA 8 bits, 160 × 130 à 237 × 154, tous
  opaques), le pixel le plus clair d'un copeau atteint min(R, V, B) = **240** (un reflet de Copeaux M,
  enclavé), le blanc des rendus de chaleur descend rarement sous **252** (bruit) et jamais sous 250 hors
  des bords ; entre 241 et 249 il n'y a que des pixels d'anticrénelage, collés à la frontière. 244 laisse
  quatre valeurs de marge de chaque côté ; à 240 et à 250 le remplissage donne le même fond, à 36 pixels
  près (les pixels de bord).
- **Bord adouci.** Les pixels à un pixel de la frontière fond / objet, des deux côtés, reçoivent un alpha
  en rampe sur la blancheur (opaque à ≤ 244, transparent à ≥ 252, linéaire entre), et leur couleur est
  **démélangée du blanc** (l'original a été composé sur blanc : `objet = (c − (1 − a)·255) / a`) : aucun
  liseré clair sur le fond nuit. Le reste du fond est transparent (0, 0, 0, 0), le reste de l'objet opaque.
- **Jamais agrandi ; 256 px au plus** (moyenne des pixels source, alpha prémultiplié) — aucun original ne
  dépasse 237 px, donc aucun n'est réduit ; la réduction est testée sur une image synthétique.
- **Poids** avant → après (octets) :

  | Fichier | Avant | Après |
  |---|---|---|
  | Chaleur H, K, M, N, P, S | 42 319 · 46 196 · 46 316 · 39 211 · 44 415 · 46 576 | 38 924 · 43 971 · 43 140 · 35 876 · 40 892 · 43 336 |
  | Copeaux H, K, M, N, P, S | 14 566 · 18 622 · 18 940 · 14 934 · 15 210 · 14 677 | 13 075 · 16 237 · 17 097 · 13 934 · 14 028 · 12 921 |
  | **Total** | **361 982** | **333 431** (− 8 %) |

  Les images de chaleur restent lourdes : ce sont des rendus bruités (gradients et grain), peu compressibles.

## 2. Semence (migration `0009`, `generer-copeaux.mjs`)

- Les douze PNG détourés entrent dans `images` sous un **troisième usage, `classe`**, identifiants
  `copeaux-p-chaleur`, `copeaux-p-copeaux`…, noms « Classe P — chaleur », « Classe P — forme de
  copeaux », date 2026-09-26. La table `images` ne change pas ; `USAGES` du serveur, `USAGE_LABELS`, le
  filtre et le téléversement de l'onglet Images, `readUpload` et l'import acceptent l'usage.
- **Une instruction par image** : la plus longue fait 88 Ko (44 Ko d'image en hexadécimal), sous la
  limite D1 de 100 Ko. J'avais d'abord recollé les grosses images par morceaux (`INSERT` du premier, puis
  `UPDATE … SET contenu = contenu || X'…'`) : **SQLite concatène en texte**, le blob était tronqué au
  premier octet nul — abandonné. `unhex()` aurait marché mais dépend de la version de SQLite en
  production. `test:api` confirme que `0009` s'applique sur le SQLite de wrangler.
- **Chaque classe ISO porte `image_chaleur` et `image_copeaux`**, complétés à la lecture comme les
  couleurs (D61) : `DEFAULT_ISO_CLASSES` nomme les images de la semence (O : `null`), et
  `completeIsoClass` donne à **toute classe sans ces clés** celles de sa lettre — donc `A2026_r0` (sans
  `classes_iso`) et le brouillon semé, mais aussi une version publiée depuis la partie B avec des
  `classes_iso` d'avant D64. Une clé présente, même `null`, est gardée : c'est ainsi qu'on dit « aucune
  image ». Ni `tables_reference` ni `brouillon_tables` ne sont réécrits ; le test de semence de `0005`
  reste vert, celui de `0007` aussi (il ne compte plus que les usages `outil` et `operation`).
- Tests : `tests/semence-copeaux.test.js` (semence identique aux fichiers, chaque classe par défaut nomme
  les siennes, `A2026_r0` complétée sans changer en base), `tables.test.js` (complétion, `null` gardé,
  format des identifiants, différences « Classe P — image de chaleur : copeaux-p-chaleur → — »),
  `worker-images.test.js` (utilisations d'une image de classe : une version d'avant, complétée, la nomme ;
  une version qui l'a retirée, non).

## 3. Page Question

- **Sous la description du matériau brut**, une rangée de deux figures : l'image de chaleur et l'image de
  copeaux de la classe, **à la même hauteur**, légende « Chaleur » / « Copeaux » dessous, sans fond ni
  cadre. La hauteur suit la largeur du panneau — `min(110px, calc(35vw − 30px))` sous 640 px,
  `calc(18vw − 45px)` jusqu'à 999, `calc(12vw − 45px)` au-delà — : mesuré dans Chrome, **107 px à
  390 px** (les deux tiennent côte à côte, 10 px avant le bord du panneau, sans défilement horizontal),
  109 px à 1280.
- **Servies par `/images/<id>`**, trouvées par la règle pure `classImages(classesIso, code)`
  (`sheets-data.js`, à côté de `toolPhotoUrl` et `operationPicto`, testée) dans les classes ISO des
  tables de la version de la séance (`GET /api/exercice`) : **rien ne s'ajoute à `seance.question`**, la
  règle « rien de ce qui est à trouver ne part au navigateur » n'est pas touchée. Une classe sans image
  (O), ou inconnue, donne une liste vide ; une image qui manque en base retire sa figure (`onerror`) :
  l'espace reste vide, sans erreur.
- **Aperçu de l'éditeur** (page d'un exercice et onglet Tables) : les deux images en vignettes de 28 px
  devant le matériau usiné de chaque ligne, d'après les classes de la version de l'exercice — ou du
  brouillon des tables **tel qu'à l'écran** pour l'aperçu de l'onglet.

## 4. Onglet Tables de référence

- **Deux colonnes de plus** dans le tableau des classes ISO, **Image de chaleur** et **Image de copeaux**,
  avec la galerie compacte de la partie A (usage `classe`, recherche, téléversement — réduit à 256 px en
  PNG, transparence gardée, comme un pictogramme —, **Aucune**). Une classe ajoutée part sans image.
- **Validation** : `validateTables(tables, { images })` reçoit les fiches des images ; une image de classe
  **inconnue ou archivée est une erreur nommée** (« classes_iso[1] (M) : « image_chaleur » : l'image
  « copeaux-m-chaleur » est archivée (choisis-en une autre, ou rétablis-la dans l'onglet Images) »), à
  l'écran (liste des erreurs, Publier désactivé) et sur le serveur (`GET tables`, `enregistrer` — dit,
  `publier` — 400, `tables/apercu` — 400). Sans les fiches (catalogue d'une séance, version publiée),
  seul le format est vérifié : une version publiée qui nomme une image archivée reste servie.
- **Différences à la publication** : « Classe P — image de chaleur : copeaux-p-chaleur → — »,
  « Classe K — image de copeaux : copeaux-k-copeaux → copeaux-s-copeaux » (vu dans Chrome).
- **Export et import** : les images de classe suivent (D59). L'import valide le **brouillon** des tables
  de l'export contre les images que l'import laissera (celles de la base et les fiches de l'export, avec
  leur état d'archivage : `draftTablesErrors`) ; les **versions publiées** de l'export ne le sont pas
  (immuables). Testé : un export dont A2026_r0 nomme une image archivée passe, un brouillon qui la nomme
  est refusé, nommément.
- Tests : `worker-tables.test.js` (nouveau test de bout en bout : semence dans le brouillon, la version
  publique et l'exercice ; archivage → erreur, publication et aperçu refusés ; image inconnue dite ;
  `null` publié et gardé dans la version ; utilisations ; suppression refusée ; import ; téléversement
  sous l'usage classe, doublon), `tables.test.js` (validation avec les fiches), `ui-editeur.test.js`.

## 5. Tests, docs, Chrome

- Tests (+ 8) : `detourer-copeaux.test.js` (4), `semence-copeaux.test.js` (2), `ui-rules.test.js`
  (`classImages`), `worker-tables.test.js` (1) ; comptes d'images passés de 48 à 60 (49 → 61) là où ils
  sont testés. `test:api` : étape 26.
- Docs : DECISIONS D64 ; SPEC §3 (format des classes, images), §7 (table `images`, API, note sur
  `question`) ; UI §3.3, §3.4, §3.9, §8 ; CLAUDE.md ; PLAN ; DEMARRAGE §7 ; README de `site/img/copeaux/`.
- Chrome (wrangler jetable, `MODE_TEST:1`) : quiz à 1280 et 390 px (classes N, M, P, K vues, images
  chargées, même hauteur, dans le panneau), aperçu de l'éditeur, onglet Tables (colonnes, galerie
  compacte à 12 images, Aucune, choix, différences à la publication, erreur d'image archivée et Publier
  bloqué, 390 px sans défilement horizontal), onglet Images (filtre « image de classe ISO », 12 images
  utilisées par A2026_r0, archivage).

## Commits (branche `images-copeaux`, dans l'ordre)

1. Détourage (`detourer-copeaux.mjs`, `png.mjs`), originaux et douze PNG détourés, test, README
2. Semence 0009, classes complétées avec leurs images, validation du format, différences, utilisations
3. Écran Question et aperçu de l'éditeur
4. Onglet Tables (colonnes, validation avec les images, import), onglet Images (usage classe)
5. `test:api` étendu
6. Docs
7. Rapport

## Points douteux, à trancher

1. **Identifiants en minuscules** : `copeaux-p-chaleur`, pas `copeaux-P-chaleur`. La règle des identifiants
   d'images (`IMAGE_ID`, D56 : minuscules, chiffres, `_` et `-`) vaut pour `/images/<id>` et pour le
   `pictogramme` d'une opération ; je ne l'ai pas élargie aux majuscules.
2. **Complétion par classe, pas seulement par liste absente.** « A2026_r0 et le brouillon des tables sont
   complétés » : je l'ai lu largement — **toute classe sans ses clés d'images** reçoit celles de sa lettre,
   y compris dans une version publiée depuis la partie B avec des `classes_iso` d'avant D64 (s'il y en a
   une en production, elle montre les images sans réécriture). Conséquence : pour retirer une image, la
   classe porte `null` (l'éditeur l'écrit toujours) ; une classe d'une autre lettre (X) reçoit `null`.
3. **Une instruction par image, 88 Ko sur une limite de 100 Ko** (12 % de marge). Le recollage par
   morceaux est impossible avec `||` (texte) ; `unhex()` marcherait à condition que la production ait
   SQLite ≥ 3.41 — je ne l'ai pas fait pour ne rien parier sur la version. Une image de classe semée ne
   pourra pas dépasser 49 Ko (le générateur refuse) ; les téléversements passent par l'API, sans limite
   d'instruction.
4. **La règle « image existante, non archivée » ne vaut que pour les images des classes**, comme demandé ;
   le `pictogramme` d'une opération garde sa validation de format seule (un pictogramme archivé n'est pas
   une erreur). Étendre la règle serait une ligne, mais mettrait en erreur un brouillon qui nomme un
   pictogramme archivé aujourd'hui.
5. **Le badge de lettre (P, M…) est dans les images de copeaux elles-mêmes**, en haut à gauche, redondant
   avec le badge du panneau ; je n'y ai pas touché (le détourage ne retire que le blanc atteint depuis les
   bords, et ce badge est coloré).
6. **Ce que le détourage retire** : le blanc seulement. Sur les images de chaleur, la pièce (gris-bleu, à
   gauche) et l'outil (gris, en bas à droite) touchent les bords et restent opaques ; le rendu est un bloc
   avec une échancrure transparente, pas un objet flottant. Si tu voulais aussi retirer la pièce grise,
   c'est une autre règle (elle n'est pas « proche du blanc ») et un choix de dessin.
7. **`alt` vide** sur les images (décoratives, la légende dit ce qu'elles sont) ; un lecteur d'écran lit
   « Chaleur » et « Copeaux ». Si tu préfères un texte plus parlant (« Chaleur dans la coupe, classe P »),
   c'est un mot dans `question-screen.js`.
8. **Choix visuels non maquettés** : figures sous tout le panneau (pas seulement sous la colonne de texte,
   pour laisser 107 px de haut à 390 px), plafond de 110 px, vignettes de 28 px dans l'aperçu, deux
   colonnes de galeries compactes qui élargissent le tableau des classes (il défile dans son cadre à
   390 px, comme celui des opérations). Entre 1000 et 1100 px la hauteur descend vers 75 à 87 px.
9. **Le test de semence de `0007`** ne compte plus que les usages `outil` et `operation` (48) ; celui de
   `0009` compte les 12 et vérifie que la base en a 60. Les comptes 49 → 61 de `worker-images`,
   `worker-editeur` et `test:api` ont suivi.

## Retouche du détourage (même branche, même jour)

À ta demande : un liseré gris-blanc restait sur le fond nuit, parce que seuls les pixels à un pixel de la
frontière et entre 244 et 252 étaient adoucis. `npm test` : 550 tests (+ 1), `fail 0` ; `npm run test:api` :
31 étapes, la migration `0009` régénérée y passe.

- **Nouvelle méthode** (`detourer-copeaux.mjs`, trois constantes nommées en tête : `EROSION_PX = 1`,
  `BANDE_PX = 3`, `PLANCHER = 200`). Après le remplissage depuis les bords (seuil 244 inchangé), le fond est
  dilaté d'un pixel en 8-connexité (l'anneau extérieur de l'objet devient transparent). Puis, sur une bande
  de 3 px à partir de ce fond (distance euclidienne entre centres), alpha = clamp((255 − min(R, V, B)) / 55,
  0, 1) et la couleur est démélangée du blanc. Au-delà de la bande, l'objet reste opaque. Le blanc
  intérieur non relié aux bords reste intact, même dans la bande.
- **Vérifié sur Chaleur et Copeaux P** (agrandis sur fond nuit), puis sur les douze : **planche**
  `captures/images-copeaux/planche-fond-nuit.png` (fond `#05091a`, × 3, quatre par rangée : P chaleur,
  P copeaux, M chaleur, M copeaux ; K, N ; S, H). Plus de liseré visible.
- **Tests** : `cutOut` réécrit sur une image de 17 × 17 (anneau érodé même gris foncé, gris 230 à 2 px du
  fond à alpha 25/55 démélangé, gris 230 au-delà de la bande opaque tel quel, blanc enclavé intact à 2 px du
  fond) ; **disque bleu anticrénelé sur blanc** : aucun pixel d'alpha > 0,5 plus clair que 200 sur les trois
  canaux à moins de 3 px du fond. L'ancienne méthode, soumise au même test, en laisse **28** : le test mord.
  Le test de semence de `0009` compare la base aux fichiers : il a suivi sans retouche.
- **Poids** (octets) :

  | Fichier | Originaux | 1re version | Retouche |
  |---|---|---|---|
  | Chaleur H, K, M, N, P, S | 42 319 · 46 196 · 46 316 · 39 211 · 44 415 · 46 576 | 38 924 · 43 971 · 43 140 · 35 876 · 40 892 · 43 336 | 36 341 · 40 744 · 39 685 · 33 116 · 38 073 · 39 369 |
  | Copeaux H, K, M, N, P, S | 14 566 · 18 622 · 18 940 · 14 934 · 15 210 · 14 677 | 13 075 · 16 237 · 17 097 · 13 934 · 14 028 · 12 921 | 12 074 · 15 361 · 16 459 · 12 490 · 13 500 · 12 167 |
  | **Total** | **361 982** | **333 431** | **309 379** (− 15 % sur les originaux) |

  La migration `0009` passe de 671 à 623 Ko ; sa plus longue instruction de 88 à 82 Ko (limite D1 : 100 Ko).

### Points douteux de la retouche

1. **L'érosion d'un pixel mange une partie du trait noir** des dessins de copeaux, là où ce trait longe le
   fond : 146 à 267 pixels sombres (min < 100) retirés par image de copeaux, 206 à 371 par image de chaleur
   (le bord net de la pièce et de l'outil). Sur l'arc extérieur du copeau P, le contour noir d'un à deux
   pixels devient plus mince ou disparaît par endroits (visible en agrandissant la planche). Si tu tiens au
   trait, `EROSION_PX = 0` le garde, mais le liseré reviendrait en partie : c'est l'anneau érodé qui le
   portait.
2. **Le blanc intérieur reste intact, même dans la bande** : je l'ai lu comme « tout pixel ≥ 244 hors du
   fond reste opaque », puisque l'autre lecture (appliquer la formule dans la bande) l'aurait rendu
   transparent près du bord. Conséquence : quelques pixels blancs restent visibles près du fond sur trois
   images de chaleur (H : 2, K : 3, S : 1) — un reflet à la pointe de l'outil, enclavé — et les fissures
   blanches des copeaux K et H restent blanches, comme voulu.
3. **Le gris clair de la pièce près du fond perd de l'opacité** : un gris à 230 à moins de 3 px du fond
   passe à alpha 0,45, démélangé en gris plus foncé ; sur le fond nuit, le bord de la pièce paraît
   légèrement assombri sur 3 px, sans liseré. C'est l'effet voulu de la formule, mais il touche aussi des
   gris qui ne sont pas de l'anticrénelage.
4. **La migration `0009` a été modifiée** (régénérée) : correct tant qu'elle n'est appliquée nulle part.
   Sur ton poste, si `npm run dev` a tourné sur cette branche avant la retouche, ta D1 locale a l'ancienne
   `0009` déjà appliquée : il faut effacer `.wrangler/state` (ou la table `d1_migrations` locale) pour qu'elle
   reprenne la nouvelle.

## Caractéristiques des classes (complément, D65)

**Le message de base n'est pas arrivé.** Ton complément parle des « points 3 et 4 du message précédent » :
je n'ai reçu que le message de la retouche du détourage, qui n'avait pas de ligne de caractéristique.
J'ai construit la fonction à partir du complément seul (A, B, C), sous les hypothèses ci-dessous ; si le
message de base disait autre chose (autres points, autre emplacement, autres noms), renvoie-le et
j'ajusterai.

`npm test` : 554 tests (+ 4), `fail 0`. Chrome : 9 vérifications de plus, 4 captures (`1280-11` à
`1280-14`, `390-12`), aucune requête externe, aucune exception.

- **Modèle** : `classes_iso[].caracteristiques`, des lignes `{ libelle, texte, solution? }`, complétées à la
  lecture comme les images (une classe sans la clé reçoit les lignes de sa lettre ; une liste présente,
  même vide, est gardée). Les quatre lignes par classe de ton message, dans l'ordre Effort, Chaleur,
  Copeaux, Problème typique ; le « → » de ton message a servi de séparateur : ce qui suit est dans
  `solution`, jamais dans le texte (un test le vérifie). La classe O n'en a pas.
- **Page Question** : sous les images, une ligne par caractéristique (libellé en gras) ; la solution sur une
  ligne à part, en retrait, « → Solution : » en couleur d'accent de la page (#4fc3f7), le texte en couleur
  secondaire (#8aa0c6), couleurs vérifiées dans Chrome.
- **Point C** : à 390 px, la solution de M (55 caractères, la plus longue) **se replie sur deux lignes**
  et s'arrête au bord intérieur du panneau (354 px pour 354), sans défilement horizontal. Elle se replie
  aussi à 1280 px, où le panneau du matériau n'a que la moitié de deux tiers de la largeur.
- **Onglet Tables** : colonne **Caractéristiques**, une zone de texte, « libellé ; texte ; solution » par ligne
  ; validation en continu (une solution de 91 caractères : « classes_iso[1] (M) : caractéristique 2 :
  « solution » a 91 caractères (au plus 90) », Publier bloqué, et refus du serveur) ; différences par
  libellé (« Classe M — Problème typique, solution : « … » → « … » », ligne ajoutée, retirée, ordre) ;
  l'export porte la version publiée avec ses caractéristiques (testé).
- **Défaut trouvé en passant** : quand une version n'avait pas `classes_iso`, la complétion partageait les
  objets des valeurs par défaut ; modifier les caractéristiques d'une version modifiait les défauts. Corrigé
  (copie profonde) dans le commit du modèle.

### Points douteux du complément

1. **Hypothèses faute du message de base** : la clé `caracteristiques` (et `libelle`, `texte`,
   `solution`) ; l'emplacement sous les images ; les limites autres que celle de la solution (au plus 6
   lignes, libellé de 30 caractères, texte de 90) ; aucune caractéristique pour O.
2. **« Couleur d'accent de la page »** : j'ai pris le bleu clair des titres et liens (#4fc3f7), pas la
   couleur de la classe du panneau (le jaune de M, le rouge de K…). Si tu voulais la couleur du panneau,
   c'est une variable à changer dans `question.css`.
3. **Édition en zone de texte** « libellé ; texte ; solution », comme les dimensions, plutôt qu'un
   sous-tableau de champs : plus compact dans un tableau déjà large, mais un « ; » dans un texte est
   impossible (un « ; » de trop part dans la solution).
4. **L'aperçu de l'éditeur ne montre pas les caractéristiques** (il montre les images) : ce ne sont pas des
   réponses, et le tableau d'aperçu est déjà large.
5. **La solution se replie sur deux lignes même à 1280 px** : si tu préfères une ligne, il faudrait un texte
   plus court (≤ 40 caractères environ) ou une police plus petite.
