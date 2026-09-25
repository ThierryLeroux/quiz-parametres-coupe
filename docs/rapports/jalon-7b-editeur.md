# Rapport — jalon 7b : images, gabarits de nomenclature, tables de référence versionnées

Session du 2026-09-24 et 2026-09-25. Branche `jalon-7b-editeur` à partir de `main` à jour, sept commits (un par
point, plus les docs et ce rapport), branche poussée. **Partie A livrée ; la partie B attend ton feu vert.**
`npm test` : 526 tests (+ 15), `fail 0` ; `npm run test:api` : 28 étapes (+ 3), une minute. Décisions
**D55 à D59**. Chrome à 1280 et 390 px : 41 vérifications, 12 captures dans `captures/jalon-7b/` (hors
dépôt), 176 requêtes, **aucune externe**, aucune exception (quatre erreurs console attendues : le 401
avant la connexion, le 400 du SVG piégé, deux 404 d'images supprimées).

## Préalable (point 1, D55)

Retiré du PLAN, jalons 5 et 7b : la clé par enseignant, la table des enseignants et la table des séances
professeur, et le mode test ouvert au professeur connecté. D55 le dit et ferme le « plus tard » de D26 et le
« reste à faire » de D34, D38 et D44 : deux clés, deux rôles ; le cookie sans état se révoque en changeant la
clé ; le mode test reste local, l'aperçu de l'éditeur le remplace pour le professeur. SPEC §7 (mode test) et §8.

## Partie A — images et nomenclature

### 2. Téléversement d'images (D56)

- **Table `images`** (migration `0007`) : identifiant, nom lisible, usage (`outil`, `operation`), type, taille,
  empreinte SHA-256, contenu en **BLOB**, date, date d'archivage. Route admin `images/televerser` : le corps est
  du JSON avec le contenu en base64 (≤ 1 Mo ; image ≤ 600 Ko). Le serveur **ne croit pas le type annoncé** : il
  le lit dans les premiers octets (PNG, JPEG, WebP) ou relit le XML d'un SVG (point 5) ; « Le fichier est en
  image/png, pas en image/jpeg. » Un **doublon exact** (même empreinte) n'est pas stocké : l'image existante est
  rendue avec `existante: true` — testé avec la photo de l'alésoir, déjà semée. L'identifiant d'un téléversement
  vient de l'empreinte (`img-<16 hex>`) : même contenu, même identifiant sur toute base, ce qui rend l'import
  (point 8) sans conflit. Chaque action est au journal.
- **Réduction dans le navigateur** (`images-picker.js`, `prepareUpload`) : `createImageBitmap` puis un canvas.
  **Format et qualité retenus** — une **photo d'outil** est redessinée **sur fond blanc**, plus grand côté
  **800 px**, en **JPEG à 0,85** ; un **pictogramme** en image matricielle est réduit à **256 px en PNG** ; un
  **SVG part tel quel**. Jamais agrandie. Pourquoi : les photos du classeur sont des photos d'atelier sur fond
  clair, sans transparence utile, et les fiches les affichent sur blanc (le panneau de l'outil les montre à
  120 px au plus, l'éditeur à 96 px) : 800 px laissent une marge pour un futur agrandissement au clic sans que
  la photo dépasse 150 Ko ; le JPEG à 0,85 ne laisse pas d'artefact visible à ces tailles et pèse trois à cinq
  fois moins que le PNG d'une photo. Le PNG est gardé pour les pictogrammes (aplats et transparence sur la
  pastille blanche). WebP aurait été plus léger mais Safari ne l'encode pas depuis un canvas. Vu dans Chrome : un
  BMP de 1000 × 700 (2,1 Mo) arrive en JPEG 800 × 560 de 12 Ko (un dégradé ; une vraie photo fera 40 à 150 Ko).

### 3. Une seule liste d'images (D56)

**Choix : semer les fichiers existants dans D1**, plutôt que servir deux sources derrière une même route.
La migration `0007`, générée par `reference/semence-d1/generer-images.mjs`, importe les 29 PNG (identifiant et
nom de l'outil) et les 19 SVG (identifiant = le slug de l'opération, nom = l'opération, contenu assaini
comme un téléversement) : 420 Ko, plus grosse instruction 32 Ko (limite D1 : 100 Ko), appliquée par
`deploy.yml` comme les autres. Pourquoi : (a) le serveur ne peut pas lister un dossier d'`ASSETS` — il aurait
fallu garder un manifeste ou dériver la liste des données ; (b) un fichier peut changer sous le même nom à un
commit, et le cache d'un an serait faux ; (c) archiver ou supprimer une image-fichier aurait demandé une table
de « tombes » ; (d) une seule table, un seul cycle de vie, un seul export. Les fichiers de `site/img/outils/`
et `site/img/pictos/operations/` **restent comme semence et données des tests**, exactement comme les JSON
depuis D47 ; `index.json` disparaît ; un test vérifie que la semence est identique aux fichiers (contenu,
empreinte, noms). **Route `GET /images/<id>`**, publique, servie par le Worker avant `ASSETS` : type exact,
`nosniff`, `Cache-Control: public, max-age=31536000, immutable`, `ETag` et 304. Le quiz (`toolPhotoUrl`,
`operationPicto` dans `sheets-data.js`), les feuilles et l'éditeur composent cette adresse ; `image` d'un outil et
le slug d'une opération continuent de nommer les mêmes identifiants — la partie B ajoutera `pictogramme` à
l'opération, déjà lu s'il existe.

### 4. Archiver ou supprimer (D56)

`GET images` rend chaque fiche avec ses **utilisations** : versions publiées (`m10-tournage-vc v1`), brouillons,
outils de la banque, versions des tables (par le slug ou `pictogramme` de chaque opération). **Supprimer est
refusé (409) dès qu'une image est utilisée quelque part** — version publiée, mais aussi brouillon, banque ou
tables, pour ne pas laisser de trou dans un brouillon (point douteux 2) — et le message dit où :
« utilisée (version publiée m10-tournage-vc v1 · brouillon m10-tournage-vc · banque mvlnr) ». **Archiver** la
retire des galeries (sauf sur l'outil qui la porte déjà, où elle reste visible et marquée) et la sert toujours ;
rétablir, renommer (le nom lisible seulement). Une image jamais utilisée se supprime (404 ensuite).

### 5. SVG assaini (D57)

`worker/svg.js` : un lecteur XML strict (le Workers runtime n'a pas de DOMParser) qui **resérialise** — ce qui
est servi est ce qui a été relu. **Refusé**, avec la cause nommée : `script`, `foreignObject`, `image`, `a`,
`iframe`, `object`, `embed`, `video`, `audio`, les animations ; tout attribut `on*` ; un `href` vers autre chose
qu'un `#id` du fichier (l'entité `&#106;avascript:` est décodée avant le contrôle) ; `url()` externe, `@import`,
`expression()` dans un attribut ou un `<style>` ; DOCTYPE (entités internes) ; entité inconnue ; mal formé ;
plus de 200 Ko ; sans `viewBox` ni dimensions. **Retiré et dit** : éléments et attributs hors liste blanche
(métadonnées et attributs d'Inkscape, `data-*`, `xmlns` étranger). Servi avec `image/svg+xml; charset=utf-8`,
`nosniff` et `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`. Tests :
23 SVG piégés refusés, un export Inkscape nettoyé à l'identique attendu, les 19 pictogrammes du classeur
passent sans retrait et l'assainissement est idempotent ; par l'API et dans Chrome : le piégé refusé, le propre
accepté avec « Retiré du SVG : attribut xmlns:inkscape sur <svg>, élément <metadata>, … », servi avec sa
politique, et il se dessine.

### 6. Choix de l'image dans le formulaire

**Galerie** (`imagePicker`) dans le groupe Identification : l'image en cours (aperçu 96 px, « nom (identifiant) »),
**Choisir une image…** déplie la galerie — recherche par nom ou identifiant, sans casse ni accents (« alés »
garde les deux alésoirs et la barre à aléser), vignettes des images « photo d'outil » non archivées, la choisie
en surbrillance —, **Aucune**, et **Téléverser une image** sur place : réduite, envoyée, puis choisie d'office
(ou l'existante si doublon, le message le dit). Un choix vaut un changement du brouillon (validation, Publier…).
Le même composant, avec l'usage `operation`, servira au pictogramme d'une opération en partie B. Les fiches
sont chargées une fois par usage et tenues à jour par les téléversements.

### 7. Gabarit de nomenclature éditable (D58)

Le champ est éditable ; sous lui, un **bouton par jeton permis pour l'outil** — `[Pas]` en filetage seulement,
`[IdBarre]` avec des barres seulement (`permittedTokens`) — qui l'insère au curseur (`insertToken`) ; l'**exemple
composé** suit la frappe ; **Autre exemple** le tire au hasard dans l'outil (dimension, dents, matière, barre
qui entre : `exampleIdentifier(…, random)`, testé sur l'alésoir et la barre à aléser — jamais une barre qui
n'entre pas). Un jeton inconnu (`[Couleur]`), `[Pas]` hors filetage, `[IdBarre]` sans barres ou — nouveau — un
**crochet non apparié** sont des erreurs sous le champ (`toolErrors`), et Publier dit « (1 erreur à corriger) ».
Vu dans Chrome : `[NbDent]` inséré, l'exemple « MCLNR - Ø charioté: 10 mm (Insert de carbure de tungstène) »,
l'erreur bloquante puis levée, six « Autre exemple » qui varient.

### 8. Export et import avec les images (D59)

L'**export** porte `images` avec le contenu en base64 (440 Ko pour la semence, 49 images). **L'import se fait
en morceaux** : le navigateur envoie à `import/valider` et `import` l'export **sans le contenu des images** ; la
validation liste les **images manquantes** ; le navigateur les envoie **une par requête** à `images/importer`
(identifiant et empreinte de l'export, vérifiés sur le contenu) ; puis l'import, qui refuse (400) tant qu'une
image manque. Une image présente sous le même identifiant garde son contenu (nom et archivage mis à jour) ;
avec une autre empreinte, refusée. Un export d'avant les images s'importe encore. Pourquoi ce découpage plutôt
qu'un export à part : un seul fichier de sauvegarde à ranger, aucune requête au-dessus d'un Mo quel que soit le
nombre de photos, et le contrôle d'intégrité par empreinte pour chaque image. **Aller-retour identique**, images
comprises : testé sous Node, par HTTP sur la vraie D1 locale, et dans Chrome (photo neuve supprimée, puis
réclamée, renvoyée et servie de nouveau ; export après = export avant).

### 9. Tests, docs, Chrome

- Tests ajoutés (15) : `tests/worker-svg.test.js` (4), `tests/worker-images.test.js` (6 : règles, route
  publique, téléversement, SVG, liste et cycle de vie, export-import), `tests/semence-images.test.js`,
  `tests/ui-editeur.test.js` (3 : exemple aléatoire, jetons, galerie et plan de réduction), `data.test.js`
  (crochets) ; `worker-editeur.test.js` et `editeur.test.js` adaptés au résumé d'import. La fausse D1 accepte un
  `ArrayBuffer` pour un BLOB comme la vraie. `test:api` : étapes 25 à 27.
- Docs : DECISIONS D55 à D59 ; SPEC §3 (images), §4 (crochets, édition), §7 (table `images`, `/images/<id>`, six
  routes, export et import), §9, §10 ; UI §3.3, §3.9 (galerie, gabarit, onglet Images, sauvegarde), §5, §8 ;
  DEMARRAGE §7 ; CLAUDE.md ; PLAN ; README de `site/img/outils/` et `site/img/pictos/`.
- Chrome (wrangler jetable, `MODE_TEST:1`) : galerie et recherche (1280, 390), téléversement d'un BMP réduit
  en JPEG, gabarit (erreur, jetons), onglet Images (1280, 390 ; SVG refusé), sauvegarde (résumé avec la ligne des
  images, import terminé), quiz (photo et pictogramme par `/images/`), feuille des avances (19 pictogrammes).
  Deux retouches CSS trouvées ainsi : le champ fichier débordait à 390 px, et la barre de **quatre onglets** ne
  tenait plus sur 390 px — elle passe à la ligne (`prof.css`, aussi pour `/prof`, sans effet visible).

## Commits (branche `jalon-7b-editeur`, dans l'ordre)

1. Préalable du jalon 7b (D55)
2. Images en D1 (D56, D57) : migration 0007 semée, route `/images/<id>`, téléversement, SVG assaini, liste, archivage, suppression, export et import ; le quiz lit `/images/`
3. Éditeur : galerie et téléversement, gabarit éditable (D58), onglet Images, sauvegarde avec les images à part (D59) ; crochet non apparié
4. `test:api` étendu aux images
5. Docs de la partie A
6. Rapport de session

## Points douteux, à trancher

1. **Photos partagées de la semence.** Le classeur donne la même photo à deux outils (forets fractionnaires et
   métriques, barres à fileter, SDTMR, tarauds impériaux) : la semence les stocke **deux fois**, sous les deux
   identifiants que la banque nomme (dix lignes, 30 Ko de plus). La règle « un doublon exact n'est pas stocké
   deux fois » vaut pour les téléversements. Dédoubler à la semence aurait demandé de réécrire `image` dans la
   banque, les brouillons et la version 1 (JSON en SQL) ; je ne l'ai pas fait.
2. **Supprimer est refusé dès qu'une image est utilisée**, y compris par un brouillon ou un outil de la banque —
   pas seulement par une version publiée, comme le point 4 le demandait. L'autre lecture (permettre la
   suppression quand seule la banque ou un brouillon la nomme) laisserait un outil sans photo ; on peut la
   retirer de l'outil d'abord, puis supprimer. À confirmer.
3. **Identifiant d'un téléversement = son empreinte** (`img-3ebdeed7ea0f14aa`), pas un nom : invisible pour
   l'étudiant, montré en petit dans l'éditeur ; le **nom lisible** (celui du fichier, renommable) est ce qu'on
   voit. Conséquence : le même contenu téléversé pour deux usages (photo puis pictogramme) rend l'existante,
   avec le premier usage ; il n'apparaît que dans une galerie. Cas rare, à mon avis acceptable.
4. **JPEG à 0,85 sur fond blanc** pour toute photo d'outil : une photo PNG avec transparence perd sa
   transparence (fond blanc). Si tu veux garder des photos détourées sur le fond nuit, dis-le : on peut garder
   le PNG quand l'image a de la transparence (à détecter dans le canvas).
5. **Contenu servi d'un SVG semé** : c'est la version assainie (sans le commentaire d'origine « Généré par
   convertir.mjs… »), donc pas l'octet près le fichier du dépôt ; le test compare à `sanitizeSvg(fichier)`.
6. **`limite_avance`** reste comme au 7a (éditable, « non utilisée »), à trancher avec les exercices d'avances.
7. **Corps de la requête de téléversement** : JSON avec base64 (× 1,37), 1 Mo au plus, image de 600 Ko au plus.
   Un envoi binaire brut aurait été plus économe, mais l'API de l'éditeur est en JSON partout ; à 150 Ko par
   photo, l'écart est sans importance.
8. **Choix visuels non maquettés** : galerie dépliable sous l'image en cours, boutons de jetons en chasse
   fixe, onglet Images en tableau, ligne « Images : … » en tête du résumé d'import.

## Suites données (réponses de Thierry, D60)

Un commit de plus sur la branche, poussée. `npm test` : 526 tests (le test des règles d'images étendu),
`fail 0` ; Chrome : deux téléversements de plus (une photo détourée, une photo opaque).

1. *Points 1, 2, 3, 5, 6, 7 et 8 acceptés tels quels.*
2. *Point 4 — la transparence est gardée.* `prepareUpload` redessine d'abord l'image réduite sans fond et lit
   ses pixels (`getImageData`) : si au moins un pixel n'est pas opaque (`hasTransparency`), la photo part en
   **PNG à 800 px sans fond blanc** ; sinon, en JPEG à 0,85 sur fond blanc comme avant
   (`uploadPlan(usage, isSvg, transparent)`, testé dans les deux sens ; le pictogramme et le SVG ne changent
   pas). Vu dans Chrome : un PNG détouré de 1000 × 700 arrive en PNG 800 × 560 servi `image/png`, le même
   dessin aplati sur fond opaque arrive en JPEG. SPEC §3, UI §3.9, DEMARRAGE §7, notes de l'éditeur.
3. Thierry fusionne la partie A dans `main` avant la partie B.

## Partie B — tables de référence versionnées (points 10 à 16, D61 à D63)

Session du 2026-09-25, à partir de `main` à jour (qui était la branche elle-même après ta fusion). Quatre commits
de plus, branche poussée. `npm test` : 541 tests (+ 15), `fail 0` ; `npm run test:api` : 30 étapes (+ 2) ;
Chrome à 1280 et 390 px : 25 vérifications de plus, 9 captures (`14` à `22` dans `captures/jalon-7b/`), aucune
requête externe, aucune exception.

### 10. Onglet Tables de référence (D61)

- **Modèle** : migration `0008` — `brouillon_tables` (une seule ligne : contenu `{ materiaux, operations }`,
  révision optimiste, `base_id` = la version dont le brouillon est parti ; semée depuis A2026_r0) et
  `exercices.tables_id` (la version de tables du brouillon de chaque exercice ; les deux M10 sur A2026_r0).
  Les versions publiées restent les lignes de `tables_reference` (D47), immuables.
- **Contenu d'une version** : le format de SPEC §3 complété par `classes_iso` (code, nom, couleur vive, couleur du
  texte, teinte de ligne), `materiaux_outil` (clé fixe de `vc_pi_min`, nom, couleur) et `operations[].pictogramme`
  (l'identifiant d'une image, D56). `groupes_iso` est dérivé des lignes (« classe - matériau », l'ordre du
  classeur est bien celui d'apparition : testé). **Les couleurs passent dans les tables** : `tokens.css` ne
  garde que les valeurs par défaut, reprises à l'identique dans `site/js/tables.js` (`DEFAULT_ISO_CLASSES`,
  `DEFAULT_TOOL_MATERIALS` ; un test compare aux variables de `tokens.css`). **Une version d'avant (A2026_r0) est
  complétée à la lecture** plutôt que réécrite : la ligne en base ne change pas, la semence reste identique aux
  JSON, un export d'avant s'importe encore ; le brouillon semé l'est aussi.
- **Le quiz et les feuilles lisent la version en usage** : `assembleData` expose `classesIso`, `toolMaterials` et
  `toolMaterialKeys` (nom → clé) ; `question.js` prend la clé de la matière dans les tables ; la feuille des Vc
  colore ses en-têtes et ses lignes avec les valeurs de la version ; les écrans du quiz et de l'éditeur posent
  les variables CSS (`applyTableColors`) à partir de leur version — le rouge K de nuit (D30) est composé de la
  couleur de la classe (64 % couleur, 36 % blanc = #ff5c5c, la valeur d'origine). Vu dans Chrome : la classe P
  passée à #0099cc dans le brouillon suit à la frappe, la version A2026_r1 la sert, la page du M10 sur A2026_r0
  garde le bleu d'origine, puis prend le nouveau une fois passée à A2026_r1, comme la séance de Camille.
- **L'onglet** : des tableaux de saisie (classes, matières, 47 matériaux, 19 opérations avec la famille d'avance
  en liste et le pictogramme par la galerie compacte de la partie A), ↑ ↓ Retirer, Ajouter ; validation
  continue (`validateTables` : classes, couleurs, les trois clés, noms uniques, matériaux, opérations,
  pictogramme) ; Enregistrer avec contrôle optimiste (409 testé) ; la liste des versions avec leurs utilisations
  et « Feuilles imprimables ». À 390 px, les tableaux défilent dans leur cadre.

### 11. Révision, validation, différences (D61)

Publier enregistre, puis montre les **différences valeur par valeur** avec la version dont le brouillon est parti
(`tablesDiff`, testée : « Acier non allié (groupe 1), Insert de carbure de tungstène : 400 → 999 pi/min »,
« Classe P — couleur : #00b0f0 → #0099cc », « Opération « Perçage » — avance (po/rév) : 0.006 → 0.008 »,
matière renommée, matériaux et opérations ajoutés, retirés, réordonnés) et le champ **Révision**, prérempli de la
**suggestion** (`nextRevision` : « A2026_r0 » → « A2026_r1 », « H2025_r12 » → « H2025_r13 », sans suffixe
« _r1 »). Le serveur refuse : une révision mal formée (400), prise (409, « une version publiée ne se remplace
pas »), périmée (409), un brouillon en erreur (400, erreurs jointes) ou identique à sa version de départ (400).
La révision est posée dans les deux JSON de la version ; le brouillon repart de la version publiée. **La version
la plus récente est la dernière insérée** (ordre d'insertion, pas la date) — l'horloge fictive des tests
(2026-09-21) est antérieure à la semence (2026-09-24), ce qui aurait fait remonter A2026_r0 devant A2026_r1.

### 12. L'exercice choisit sa version de tables (D62)

Un exercice créé prend la plus récente ; une copie garde celle de sa source. La page dit sa version (barre) et,
quand une plus récente existe, l'**avis doré** avec **Passer à A2026_r1…** : enregistre, puis montre **ce que ça
change pour cet exercice** (`exerciseTablesImpact`, testée sur les deux M10 : les erreurs qui apparaîtraient —
groupe retiré, matière renommée —, les Vc des groupes et matières que ses outils tirent et rien d'autre — le
carbure solide doublé partout ne change rien pour le M10 « vitesse de coupe », qui ne le tire pas —, les
avances et pictogrammes de ses opérations, les matériaux ajoutés ou retirés dans ses groupes). Le brouillon est
validé contre **sa** version (`draftErrors` reçoit les noms de matières de la version : « matériau d'outil
inconnu : « Acier rapide » (les tables offrent HSS, …) », « groupe de matériaux inconnu : « K - Fonte grise » »),
la publication est refusée tant qu'il reste une erreur, et la version publiée prend la version de tables du
brouillon. **Un changement de tables est une différence à publier** même à contenu identique (serveur et écran :
« Tables de référence : « A2026_r0 » → « A2026_r1 » »). Route `POST exercice/tables` (contrôle optimiste,
journalisée).

### 13. Séance, feuilles imprimables, attestation (D62, D63)

Rien à changer pour la séance : elle était déjà épinglée à sa version d'exercice, donc à sa version de tables
(D47) ; testé : Camille commence sur la version 1 (A2026_r0), A2026_r1 est publiée (carbure doublé), sa question
en attente et sa réponse attendue ne bougent pas, sa correction dit l'ancienne valeur ; Alex, sur la version 2
(A2026_r1), a ses Vc de carbure doublées et **son attestation inscrit « A2026_r1 »** comme révision des tables.
Les feuilles de référence de l'étudiant sont celles de sa version (vu dans Chrome : Vc 999 et « révision
A2026_r1 » au pied). **`/tables?version=<révision>`** : la même couche que dans le quiz, seule et toujours
ouverte, sans « Retour à la question », la révision dans la barre ; imprimée en une page lettre (PDF vérifié) ;
route publique `GET /api/tables?version=`.

### 14. Aperçu d'un brouillon de tables (D63)

Dans l'onglet, le choix d'un exercice et **Dix questions** : `POST tables/apercu` tire dix questions du
brouillon de l'exercice avec les tables **telles qu'à l'écran** (même non enregistrées), sans rien enregistrer
ni journaliser (testé) ; un exercice en erreur avec ces tables est refusé et le message nomme l'erreur.

### 15. Export et import (D61, D62)

L'export porte `brouillon_tables` (contenu, `base_id`) et `tables_id` par exercice ; l'import ajoute les versions
absentes (une version différente sous une révision prise est refusée, D49), remplace le brouillon des tables,
donne à chaque exercice sa version (inconnue : erreur nommée ; absente — un export d'avant — : la plus récente).
Aller-retour identique, testé sous Node et par HTTP.

### 16. Tests, docs, Chrome

- Tests (15 de plus) : `tests/tables.test.js` (complétion, validation, variables CSS contre `tokens.css`,
  révision suivante, différences), `tests/worker-tables.test.js` (8 : brouillon, publication, exercice et tables,
  matière et groupe retirés, **séance qui garde ses tables et réponses attendues qui ne changent que là où les
  valeurs ont changé** — même graine, aperçu de `test-complet` sur A2026_r0 et A2026_r1 : mêmes questions,
  seules les Vc du carbure diffèrent —, attestation sur une version 2, aperçu, export et import, migration
  0008), `ui-editeur.test.js` (famille d'avance, groupes dérivés, impact, ligne des tables, avis, résumé
  d'import). Les tests existants restent verts : **les deux M10 posent les mêmes questions qu'avant sur
  A2026_r0** (`semence.test.js`, inchangé), la semence est identique aux JSON, les 29 outils et les 47 lignes se
  valident comme avant. `test:api` : étapes 28 et 29.
- Docs : DECISIONS D61 à D63 ; SPEC §3 (tables versionnées, format complété), §7 (tables, brouillon, API), §8
  (révision des tables de la version), §10 (version de tables, publication, sauvegarde) ; UI §1 (les couleurs
  vivent dans les tables), §3.5 (feuilles par version, couleurs), §3.9 (onglet Tables de référence, page d'un
  exercice, publication), §8 ; DEMARRAGE §7 ; CLAUDE.md ; PLAN ; `tokens.css` (valeurs par défaut).
- Chrome : onglet Tables (1280, 390), erreur bloquante, confirmation de publication avec les différences et la
  révision suggérée, aperçu, avis et impact sur la page du M10, publication avec la ligne des tables, `/tables`
  pour A2026_r1 et A2026_r0 (PDF d'une page), quiz sur la version 2 aux couleurs et aux tables de A2026_r1.

### Commits de la partie B

7. Tables de référence versionnées, côté serveur (points 10 à 15) ; 8. l'onglet, la page d'un exercice, la page
`/tables`, les couleurs ; 9. `test:api` étendu ; 10. docs et rapport.

### Points douteux de la partie B, à trancher

1. **Les couleurs d'une version d'avant (A2026_r0) sont complétées à la lecture**, pas écrites en base : sa
   ligne est identique à la semence. Si tu préfères que la migration écrive les couleurs dans A2026_r0, c'est une
   migration `0009` qui réécrit le JSON ; le test de semence changerait.
2. **Les matières d'outil restent au nombre de trois, clés fixes** (`acier_rapide`, `carbure_solide`,
   `insert_carbure`) : le nom et la couleur s'éditent, pas la liste — la feuille, `vc_pi_min` et le VBA ont
   trois colonnes. En ajouter demanderait de toucher au format des matériaux et à la feuille.
3. **Les classes ISO s'ajoutent et se retirent** (lettre majuscule unique) ; retirer une classe encore utilisée
   par un matériau est une erreur de validation, dite.
4. **Renommer une matière d'outil** met en erreur chaque outil (banque, brouillons) qui nomme l'ancien nom, et
   la restriction `materiaux_outil` des exercices : c'est voulu (« une matière retirée devient une erreur
   nommée »), mais c'est du travail outil par outil. Un renommage en masse n'existe pas.
5. **Une copie d'exercice garde la version de tables de sa source**, pas la plus récente (le point 12 dit « la
   plus récente à sa création » pour un exercice créé).
6. **La suppression d'une version de tables n'existe pas** (immuable, comme une version d'exercice) ; les
   versions inutilisées restent listées avec « aucune utilisation ».
7. **La famille d'avance d'une opération** se règle en liste (fixe, proportionnelle, filetage) ; en filetage, les
   avances sont grisées et enregistrées à null, comme le format l'exige.
8. **Choix visuels non maquettés** : tableaux de cases de saisie, `<input type="color">` du navigateur pour les
   couleurs, avis doré sur la page de l'exercice, panneau d'impact.
