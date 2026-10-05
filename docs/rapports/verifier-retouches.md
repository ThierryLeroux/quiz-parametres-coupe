# Rapport — deux retouches d'affichage sur `/verifier` (suite de D90)

> **Affichage seulement : rien ne touche la correction des séances en cours (D75, point 7), ni ce que l'attestation
> contient.** Aucun fichier de `worker/`, aucune migration ; l'enregistrement, son code, sa signature et le QR sont les
> mêmes ; l'attestation imprimée et son écran sont identiques pixel pour pixel (§4). Au déploiement, `/verifier` montre
> les deux retouches à tout le monde, pour toute attestation.

Session du 2026-10-05, branche `verifier-retouches`, partie de `main` à jour (`1710cc0`, D90 fusionnée). Poussée, pas
fusionnée.

## 1. Ce qui change

| | Avant | Après |
|---|---|---|
| Sous « Questions réussies qui comptent » | 38 px du texte du titre au texte de la première fiche (13 px sous le titre, 12 px de marge au-dessus du tableau, 8 px de marge intérieure en haut de la première fiche, plus le trait du titre), contre 17 px et un trait entre deux fiches | **18 px** du texte du titre au texte de la première fiche (13 px sous le trait du titre) ; **17 px, trait compris, entre deux fiches, comme avant** ; sur ordinateur, les deux premières fiches (la première rangée) sont collées toutes les deux |
| Sous « Opérations effectuées », tableau par outil en fiches (sous 480 px) | 38 px, de même | **18 px**, de même ; fiche à fiche inchangé |
| Tableau par outil en colonnes (au-dessus de 480 px) | 12 px de marge au-dessus du tableau | **inchangé** |
| Bloc d'informations sur ordinateur (1280, 1024, 768 px) | deux colonnes de 296 px ; « Début de l'exercice » et « Réussite de l'exercice » sur deux lignes (57 px au lieu de 33), la valeur coupée entre la date et l'heure (« 2026-10-05 » / « 12:21 ») | **une seule colonne** de 620 px : neuf lignes de 33 px, chacune sur une ligne |
| Bloc d'informations à 480 et 390 px | une colonne (déjà) | une colonne ; **une date et heure ne se coupe jamais** — si la place manque, c'est le libellé qui se replie, à gauche |
| Page lettre de l'attestation (écran, impression, PDF) | — | **identique**, pixel pour pixel |

## 2. Ce qui a été choisi, et pourquoi

**Le bloc d'informations sur une seule colonne, à toute largeur.** Pour qu'une ligne « Réussite de l'exercice
2026-10-05 12:21 » tienne sur une ligne, il faut 313 px (le libellé en 16 px, la valeur en gras, 12 px d'écart). Le
panneau fait 680 px au plus (`.screen`), 620 px utiles : deux colonnes y font 296 px, et moins encore entre 481 et
640 px (le panneau y est plus étroit). Deux colonnes ne peuvent donc **nulle part** dans ce panneau loger cette ligne
sans la couper ou replier le libellé. Plutôt qu'un bloc où le libellé « Réussite de l'exercice » se replierait sur
deux lignes à 1280 px — ce que demandait le point 2 au minimum, mais qui ne donnait pas « chaque ligne sur une ligne »
—, le bloc est sur une colonne : neuf lignes de pleine largeur, le libellé à gauche et la valeur à droite, exactement
comme les lignes des fiches dessous, et comme le bloc l'était déjà sur téléphone. C'est 130 px plus haut sur
ordinateur (9 lignes au lieu de 5) ; le trait sous chaque ligne guide l'œil du libellé à la valeur. La page lettre
garde ses deux colonnes : à 12 px, ses colonnes de 255 px suffisent.

**Une date et heure ne se coupe jamais**, en plus : `attestationFacts` (`attestation-data.js`, pur) marque ses deux
dates (`stamp: true`), `factsGrid` leur donne la classe `attestation-fact--stamp`, et sous `.verify-result` leur
valeur est `flex: none; white-space: nowrap`. Le titre de l'exercice, lui, peut toujours se replier (un titre long à
390 px : « Test complet — tous les outils du catalogue » prend deux lignes, entre les mots). Sous 390 px (téléphone de
360 ou 320 px), c'est le libellé « Réussite de l'exercice » qui se replie, à gauche, la date entière à droite.

**Les fiches collées sous leur titre.** Le tableau en fiches n'a plus de marge au-dessus (`margin-top: 0`), et
l'espace entre deux rangées de fiches vient de la grille (`row-gap: 8px` sur `tbody`) au lieu du haut de chaque fiche
(`padding: 0 0 8px`) : la première rangée — quelle que soit sa largeur, une ou deux fiches — n'a rien au-dessus,
sans règle `:nth-child` qui dépende du nombre de colonnes. Entre deux fiches : 8 px sous le texte, le trait, 8 px de
grille, soit 17 px comme avant. Du texte du titre au texte de la première fiche : 3 px sous le titre, son trait de
2 px, les 13 px de marge du `h3`, soit 18 px.

## 3. Fichiers

- `site/css/attestation.css` (section `/verifier`, sous `.verify-result` seulement) : `.attestation-facts` sur une
  colonne, `.attestation-fact--stamp .attestation-fact-value` jamais coupée ; les questions et, sous 480 px, le tableau
  par outil : `margin-top: 0`, `gap` ou `row-gap` de la grille, `padding: 0 0 var(--space-2)`.
- `site/js/ui/attestation-data.js` : `stamp: true` sur les deux dates d'`attestationFacts` ; `attestation-screen.js` :
  `factsGrid` pose `attestation-fact--stamp`.
- `tests/ui-attestation.test.js` (les dates marquées) ; `tests/ui-verifier.test.js` (`factsGrid` ; les règles des deux
  retouches, sous `.verify-result` seulement ; la page lettre garde `repeat(2, minmax(0, 1fr))`).
- `docs/UI.md` §3.7 ; `docs/DECISIONS.md` (D90, « Retouches » en fin d'entrée) ; `docs/PLAN.md`.

## 4. Vérifications

- `npm test` : **811 réussis, 0 échec** (809 avant, 2 ajoutés).
- `npm run test:api` : pas lancé — aucun fichier du serveur n'est touché.
- **Chrome sans interface**, avant (arbre de travail de `1710cc0`) et après, sur la même base jetable que D90 (Zoé,
  deux grandeurs ; Camille, `test-complet`, cinq grandeurs ; Malik, annulée) et le même port ; script hors dépôt
  `captures-retouches.mjs` ; captures dans `captures/verifier-retouches/` (hors dépôt). **Après : 72 vérifications,
  0 en échec ; aucune erreur console, aucune exception, aucune requête externe.**
- **Les écarts**, mesurés texte à texte (du bas du texte du titre, ou du bas de la cellule la plus basse de la rangée
  d'avant, au haut de la première cellule de la rangée suivante), à 390 et 1280 px, pour les trois cas :

  | | Titre → première fiche | Fiche → fiche | Première rangée |
  |---|---|---|---|
  | Questions, avant | 38 px | 17 px | — |
  | Questions, après | **18 px** | **17 px** | 1 fiche à 390 px, 2 à 1280 px |
  | Outils en fiches (390 px), avant | 38 px | 17 px | — |
  | Outils en fiches (390 px), après | **18 px** | **17 px** | — |
  | Outils en colonnes (1280 px), avant et après | 58 px (la marge de 12 px, puis l'en-tête du tableau) | rangs collés | inchangé |

- **Le bloc d'informations**, hauteur de chacune des neuf lignes (33 px = une ligne) :

  | Largeur | Avant | Après |
  |---|---|---|
  | 1280, 1024, 768 px | 2 colonnes de 296 px ; « Début » et « Réussite de l'exercice » : 57 px, la date coupée | 1 colonne de 620 px ; **9 × 33 px** |
  | 480 px | 1 colonne de 408 px ; 9 × 33 px | 1 colonne ; 9 × 33 px |
  | 390 px | 1 colonne de 318 px ; 9 × 33 px (deux grandeurs) ; « Exercice » 57 px avec le titre long de `test-complet` | 1 colonne ; idem — les deux dates sur une ligne dans tous les cas |

- **La page lettre** : ses neuf lignes du bloc font 25,2 px (une ligne, dates comprises) à deux comme à cinq grandeurs
  — sauf « Exercice » avec le titre long de `test-complet` (41,4 px, replié entre les mots, avant comme après) ; ses
  deux dates portent la classe mais rien ne l'y lit. L'attestation à deux et à cinq grandeurs (1 et 3 pages), à
  l'écran (1280 px, fond animé figé) et en mode impression (720 px, toute la hauteur), est **identique pixel pour
  pixel** à celle d'avant (0 pixel différent sur 1,7 M, 0,69 M, 4,4 M et 2,1 M).

## 5. Points douteux, à trancher

1. **Le point 3 de la demande : le repli de la date n'existe pas sur la page lettre.** Le point 5 du rapport
   `verifier-fiches` disait que « Réussite de l'exercice » se repliait « sur la page lettre aussi » : c'était faux —
   mesuré ici, ses neuf lignes tiennent sur une ligne à 12 px (colonnes de 255 px). Rien à corriger, donc rien à
   recalibrer dans `PAGE_LAYOUT` (D85). Si un jour un libellé ou une date y changeait de taille, il faudrait remesurer
   la hauteur du bloc d'informations de la page 1 (`firstPageFree`), comme le demande UI §3.6.
2. **Une colonne plutôt que deux, sur ordinateur** : 130 px de plus avant le tableau par outil. L'autre voie — garder
   deux colonnes et replier le libellé des dates sur deux lignes — gardait la hauteur mais pas « chaque ligne sur une
   ligne ». Si Thierry préfère les deux colonnes avec le libellé replié : retirer la règle
   `.verify-result .attestation-facts { grid-template-columns: minmax(0, 1fr) }`, le reste (la date jamais coupée)
   suffit.
3. **L'écart sous le titre fait 18 px texte à texte, contre 17 entre deux fiches** (13 px sous le trait du titre contre
   8 sous le trait d'une fiche : le trait du titre est plus épais, et la marge de 13 px est celle du `h3`, commune aux
   deux titres du panneau). « À peu près » est respecté ; pour un écart identique, il faudrait réduire la marge du
   `h3` à 12 px et ajouter 1 px… ce que je n'ai pas fait.
4. **Sous 390 px**, le libellé « Réussite de l'exercice » se replie à partir d'environ 380 px de large (la ligne demande
   313 px, le panneau en a 318 à 390 px) : vérifié par le calcul, pas sur un vrai téléphone de 360 px.
