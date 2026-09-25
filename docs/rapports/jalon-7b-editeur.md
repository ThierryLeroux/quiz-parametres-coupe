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

## Partie B (attendre le feu vert)

Décrite dans `PLAN.md` (jalon 7b, partie B) : onglet Tables de référence (brouillon unique, versions immuables,
couleurs dans les tables), révision saisie à la publication avec suggestion, choix de la version de tables par
le brouillon d'un exercice avec l'aperçu de ce que ça change, séance toujours sur les tables de sa version,
feuilles imprimables par version, aperçu d'une version de tables en brouillon, export et import, tests.
