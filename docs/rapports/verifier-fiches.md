# Rapport — `/verifier` en fiches : la liste des questions réussies lisible sur téléphone (décision D90)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Rien ne touche la correction ni ce que
> l'attestation contient : aucun fichier de `worker/`, aucune migration ; l'enregistrement, son code, sa signature
> et l'adresse du QR sont les mêmes ; l'attestation imprimée et son écran sont identiques pixel pour pixel (§4).
> **C'est de l'affichage seulement**, sur `/verifier` : au déploiement, la page montre les fiches à tout le monde,
> pour toute attestation, anciennes comprises.

Session du 2026-10-05, branche `verifier-fiches`, partie de `main` à jour (`33ef48e`). Poussée, pas fusionnée.

## 1. Le constat et la cause

Thierry, en scannant le QR d'une attestation sur son téléphone : la liste « Questions réussies qui comptent » est
illisible, ses colonnes tombent à deux ou trois caractères. Reproduit dans Chrome, avec le code de `main`, sur une
attestation à cinq grandeurs (29 questions, `test-complet`) et une à deux grandeurs (22 questions, « Vc et RPM ») :

| Avec le code d'avant | 390 px, cinq grandeurs | 390 px, deux grandeurs | 1280 px, cinq grandeurs |
|---|---|---|---|
| Colonne la plus étroite | « fz (po/dent) » : 19,8 px | « N° » : 21,5 px (Outil 29, Matière 25) | « fz (po/dent) » : 35 px |
| Nombres écrits sur plusieurs lignes | 174 sur 174 | 66 sur 66 | 174 sur 174 (« 0. / 00 / 10 ») |
| Rang le plus haut | 834 px (une lettre par ligne) | 413 px | 97 px |
| Débordement | la page défile de côté (397 px), le cadre déborde de 43 px | aucun | aucun |

Cause : dans `attestation.css`, `.verify-result .attestation-questions td` hérite d'`overflow-wrap: anywhere` (la
règle de la page lettre, D43) et y ajoute `white-space: normal`, qui l'emporte aussi sur le `nowrap` de `td.num`.
Le navigateur peut alors écraser chaque colonne presque à zéro et couper un nombre n'importe où. Sur ordinateur, le
panneau fait au plus 680 px (`.screen`) : à quatre ou cinq grandeurs, « 0.0010 » ou « 2560 » y sont coupés aussi.

## 2. Ce qui change, sur `/verifier` seulement

| | Avant | Après |
|---|---|---|
| Liste des questions réussies | un tableau en colonnes (N°, Outil, Matière d'outil, Matériau usiné, une colonne par grandeur, Date et heure), sans largeurs fixes | **une fiche par question** : « **Question n** » à gauche, la date et l'heure à droite (12 px, atténuées) ; Outil, Matière d'outil, Matériau usiné sur toute la largeur ; les grandeurs **deux par ligne** (« Vc (pi/min) 200 », « fz (po/dent) 0.0010 ») ; un trait entre les fiches ; **deux fiches côte à côte** sur ordinateur, une par ligne sur téléphone ; le libellé à gauche en texte atténué, la valeur à droite, qui passe dessous (toujours à droite) quand la ligne est trop courte ; un texte se replie entre les mots, jamais au milieu d'un mot |
| Tableau « Opérations effectuées » | quatre colonnes | quatre colonnes ; **sous 480 px, une fiche par outil** (Opération, Outil, Plage de dimensions, Réussites de suite) |
| Attestation annulée (panneau doré), enregistrement d'avant D41 (sans liste) | — | la même présentation ; sans liste, rien ne change |
| Page lettre de l'attestation (écran, impression, PDF) | — | **identique**, pixel pour pixel |
| Lecteurs d'écran | un tableau | l'en-tête du tableau reste dans le DOM, caché à l'œil ; Chrome garde les rôles de tableau (§4) |

## 3. Ce qui a été fait

1. **`site/js/ui/attestation-screen.js`** : `operationsTable` et `questionsTable` posent sur chaque `<td>` un attribut
   `data-label` égal au texte de l'en-tête de sa colonne (pour une grandeur, `column.label` : « Vc (pi/min) ») ; le
   tableau par outil reçoit la classe `attestation-operations`. Sur la page lettre, l'attribut n'affiche rien.
2. **`site/css/attestation.css`**, section `/verifier`, tout sous `.verify-result` : la liste des questions quitte la
   mise en page de tableau — `tbody` en grille de fiches (`auto-fill`, `minmax(260px, 1fr)`), chaque `tr` en grille à
   deux colonnes, chaque `td` en `flex` avec son libellé en `::before { content: attr(data-label) }` (couleur
   atténuée, police de texte, pas la chasse fixe des nombres) ; le `td` du N° en ligne 1, colonne 1, avec
   « Question » ; le `td.stamp` en ligne 1, colonne 2, sans libellé ; les `td.num` des grandeurs en `grid-column:
   auto`, les autres sur toute la largeur ; `overflow-wrap: normal` ; le `<thead>` caché à l'œil (1 × 1 px,
   `clip-path: inset(50%)`). Sous 480 px, les mêmes règles pour `.attestation-operations`. Une variable
   `--verify-rule` porte la couleur des traits du panneau (elle était écrite deux fois).
3. **`tests/ui-verifier.test.js`** (sur le DOM minuscule `tests/aide-dom.js`) : chaque `<td>` des deux tableaux porte
   le texte de l'en-tête de sa colonne, à deux et à cinq grandeurs, en largeurs ordinaires et resserrées ; les
   libellés des grandeurs dans l'ordre du calcul avec leur unité ; les règles qui lisent `data-label` sont sous
   `.verify-result` seulement, et la section « fiches » dit bien ce que la décision demande. Le test qui compare les
   largeurs d'`attestation.css` à `PAGE_LAYOUT` passe tel quel : rien n'a bougé.
4. **Documents** : D90 ; UI §3.7 ; CLAUDE.md (le bullet de `verifier.html`) ; PLAN ; ce rapport.

## 4. Vérifications

- `npm test` : **809 réussis, 0 échec** (806 avant, 3 ajoutés).
- `npm run test:api` : pas lancé — aucun fichier du serveur n'est touché.
- **Chrome sans interface**, avant (arbre de travail de `main`) et après, sur la même base jetable copiée et le
  même port, scripts hors dépôt (`preparer-fiches.mjs`, `captures-fiches.mjs`). Données posées par l'API : Zoé
  (« Vc et RPM », deux grandeurs, 22 questions), Camille (`test-complet` publié en local, cinq grandeurs,
  29 questions), Malik (« Vc et RPM », puis sa séance **remise à zéro** par l'enseignant : attestation annulée),
  et un **enregistrement d'avant D41** : celui de Zoé sans sa liste de questions, sous un autre code, signé avec le
  secret du serveur jetable et inséré dans la base — le serveur le dit « valide ». Captures dans
  `captures/verifier-fiches/` (hors dépôt).
- **Après : 109 vérifications, 0 en échec ; aucune erreur console, aucune exception, aucune requête externe.**
  À 390 × 844 (téléphone) et 1280 × 900, pour les quatre cas : le titre et la couleur du panneau (vert, doré) ;
  **rien ne déborde de la page** (largeur défilable 390 ≤ 390 ; aucun élément au-delà du bord) ni d'un cadre
  (`.table-wrap`) ; le tableau par outil en quatre colonnes à 1280 px (en-tête visible, aucun libellé devant les
  valeurs) et en fiches à 390 px ; la liste des questions : autant de fiches que de questions, chaque fiche en
  grille, « Question n » et la date sur la même ligne, Outil / Matière / Matériau sur toute la largeur avec leur
  libellé, les grandeurs avec leur libellé et **deux par ligne** (mesuré par la position de chaque cellule),
  **aucune cellule qui déborde de sa boîte** (`scrollWidth` ≤ `clientWidth`), l'en-tête dans le DOM et caché
  (1 × 1 px, hors flux), une fiche par ligne à 390 px et **deux côte à côte** à 1280 px (les deux premières sur
  la même ligne, la troisième dessous), un trait sous chaque fiche et aucun dans les fiches ; sans liste (avant
  D41), pas de titre « Questions réussies » et le tableau par outil seul.
- **L'attestation n'a pas changé** : à deux et à cinq grandeurs (1 et 3 pages), à l'écran (1280 px, le fond animé
  figé à l'instant 0 des deux côtés) et en mode impression (720 px, toute la hauteur), la capture d'après est
  **identique à celle d'avant, pixel pour pixel** (0 pixel différent sur 1,7 M, 4,4 M, 0,69 M et 2,1 M) ; le PDF a
  le même nombre de pages ; sur la page lettre, chaque cellule porte `data-label` (44 / 44, 406 / 406) et aucune
  n'affiche de libellé (`::before` : `none`) ; les largeurs des en-têtes resserrées sont celles de `PAGE_LAYOUT`
  (22, 150, 56, 160, 54 × 5, 62).
- **Accessibilité** (note, pas une vérification) : avec les cellules en `flex` et la table en `block`, Chrome garde
  les rôles de tableau dans l'arbre d'accessibilité (2 tables, 35 rangs, 198 cellules, 11 en-têtes de colonne) ;
  les libellés générés par `::before` y figurent aussi (« Question » × 22, « Outil » × 35). Un lecteur d'écran
  entend donc le libellé avant chaque valeur — et aussi l'en-tête de colonne, caché à l'œil : voir le point 4.

## 5. Points douteux, à trancher

1. **Les valeurs des fiches ne sont pas en gras.** Le bloc d'informations met ses valeurs en gras ; dans une fiche
   de sept lignes, répétée 29 fois, j'ai laissé les valeurs en graisse normale et mis le gras sur « Question n »
   seulement, pour que l'œil trouve le début de chaque fiche. Si Thierry préfère les valeurs en gras comme dans le
   bloc d'informations : une ligne de CSS (`font-weight: 700` sur `.verify-result .attestation-questions td`).
2. **La date et l'heure en 12 px, atténuées.** En 13 px (la taille du reste), « 2026-10-05 12:21:21 » en chasse fixe
   fait 148 px et ne tient pas dans la demi-fiche de l'ordinateur (143 px) : elle se repliait sur deux lignes. En
   12 px (137 px), elle tient à 1280 px comme à 390 px ; sur un téléphone de 360 px, elle tient de justesse ; en
   dessous (320 px), elle se replie — la date, puis l'heure, toujours à droite. Pas essayé sur un vrai téléphone.
3. **Le seuil de 480 px pour le tableau par outil.** Entre 481 et ~520 px, le tableau garde ses quatre colonnes dans
   un panneau étroit ; « Plage de dimensions » et « Réussites de suite » s'y replient sur deux lignes. C'était déjà
   le cas ; non mesuré ici (seuls 390 et 1280 px l'ont été).
4. **Les libellés lus deux fois par un lecteur d'écran.** Chrome garde les rôles de tableau et lit l'en-tête de
   colonne (caché à l'œil) avant la cellule, puis le libellé généré (`::before`), puis la valeur : « Outil, Outil,
   MCLNR… ». Deux options, non appliquées : la syntaxe `content: attr(data-label) / ""` (le texte généré sans
   équivalent textuel, donc hors de l'arbre d'accessibilité ; Chrome, Safari 17.4 et Firefox 128 la lisent, les
   plus vieux navigateurs ignorent alors toute la déclaration et perdent le libellé à l'écran), ou ne pas cacher
   l'en-tête du tout et laisser le libellé généré seul. Je laisserais tel quel : lisible, et rien n'est perdu.
5. **Le bloc d'informations à 1280 px** : « Réussite de l'exercice » y est sur deux lignes (« 2026-10-05 »,
   « 12:21 »), parce que la colonne de droite est plus courte que la gauche. C'est d'avant ce chantier, et sur la
   page lettre aussi ; non touché.
6. **L'enregistrement d'avant D41 des captures est fabriqué** (signé par le secret du serveur jetable, inséré par
   SQL) : c'est ce qu'une attestation figée avant D41 donne exactement — le serveur l'a dit « valide » —, mais ce
   n'est pas une attestation de la production.
