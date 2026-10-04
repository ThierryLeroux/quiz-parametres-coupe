# Rapport — un fond d'image animé derrière les pages des étudiants (chantier « fond animé », décision D88)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Ni formule, ni tolérance, ni texte de
> l'attestation ; aucun fichier de `worker/`, aucune migration. **Ce qui change pour tout le monde au déploiement** :
> l'accueil, tout le parcours du quiz (identification, question, progression, écran de l'attestation) et `/verifier`
> reçoivent le fond animé ; l'écran de l'attestation montre la page lettre sur le fond au lieu de la scène grise (point
> proposé, §5.1) ; une page des étudiants pèse 65 à 83 Ko de plus au premier chargement (§3). **L'attestation imprimée
> est exactement la même** : vérifié pixel pour pixel (§4). L'espace professeur, la Gestion du contenu et `/tables` ne
> changent pas.

Session du 2026-10-04, branche `fond-anime`, partie de `main` à jour (`9f2266c`). Poussée, pas fusionnée.

## 1. Ce qui change pour les étudiants

| Écran | Avant | Après |
|---|---|---|
| Accueil, page d'un exercice | fond nuit uni `#05091a` | l'image du couloir d'atelier sous le voile, qui avance lentement ; la lueur au sol respire ; une ligne de balayage descend l'écran toutes les 16 s ; les panneaux, les boutons et les liens inchangés |
| Identification 1 / 2 et 2 / 2, « Corriger mon identité » | fond uni | le fond animé ; les cases restent opaques |
| Question, question corrigée, progression | fond uni | le fond animé derrière les trois panneaux ; les panneaux de l'outil et du matériau gardent leur couleur de sens, les cases leurs quatre états |
| Feuilles des tables (par-dessus la question) | la couche grise, la page lettre | **inchangé** : la couche couvre tout, rien du fond ne paraît |
| Écran de l'attestation | la page lettre blanche sur une scène grise qui remplit l'écran | la page lettre blanche **sur le fond animé** (la scène est transparente, §5.1) ; la barre « Exercice réussi. Remets ce PDF sur Léa. » et le bouton doré inchangés |
| Attestation imprimée / PDF | la page seule, fond blanc | **identique** (le fond disparaît à l'impression) |
| `/verifier` | fond uni | le fond animé ; le panneau du résultat (vert, doré, rouge) inchangé |
| Téléphone, tablette debout (largeur / hauteur ≤ 4/5) | fond uni | l'image dessinée pour le téléphone, cadrée pour lui ; la tablette couchée prend celle de l'ordinateur |
| Appareil qui demande moins d'animations | fond uni | l'image, fixe : aucune des trois animations |
| `/prof`, `/prof/editeur`, `/tables` | fond uni, pages « documents » | **inchangé** |

Le fond ne reçoit aucun événement (`pointer-events: none`) et il est caché aux lecteurs d'écran (`aria-hidden`) :
rien ne change à la saisie, au clavier, à la lecture.

## 2. Ce qui a été fait

1. **Les images.** Les deux WebP de Thierry copiés dans `site/img/fond/` (`fond-ordinateur.webp`, 1399 × 752, 77,6 Ko ;
   `fond-telephone.webp`, 768 × 1376, 62,7 Ko — la r2). Les originaux JPG, les WebP et la maquette `apercu-fond.html`
   restent dans `reference/fond/`, versionnés, comme `reference/lot-exercices/`. Les images sont des fichiers du site,
   pas des lignes de la table `images` : ce n'est pas du contenu que la Gestion du contenu modifie (§5.6).
2. **La feuille `site/css/fond.css`** : les règles de la maquette — `.fond` (fixé, `inset: 0`, `z-index: -1`,
   `overflow: hidden`, `pointer-events: none`), `.fond-image` (l'image en `cover`, `inset: -2%`, cadrée `center 45%`,
   origine `50% 48%` ; au `@media (max-aspect-ratio: 4/5)`, l'image du téléphone, `center 60%`, origine `50% 70%`),
   `.fond-lueur` (le dégradé radial de 70 × 35 vmax à 62 % de hauteur, `mix-blend-mode: screen`), `.fond-balayage` (la
   bande de 18 vh, `screen`), `.fond::after` (le voile : le dégradé radial, puis `rgba(5, 9, 26, var(--fond-voile))`),
   les trois `@keyframes` (`fond-avance` : `scale` 1 → 1.08 ; `fond-respire` : opacité 0.15 → 0.55 ; `fond-balaye` :
   `translateY` −20 vh → 105 vh avec le fondu d'opacité), le `@media (prefers-reduced-motion: reduce)` qui retire les
   trois animations, le `@media print` qui cache la couche. **Seuls `transform` et `opacity` sont animés** ; ni
   `filter`, ni `background-attachment`. Les animations sont posées directement sur les couches (la maquette les
   accrochait à des classes `fx-*` de `body`, pour ses cases à cocher) : le `!important` du mouvement réduit n'a plus
   de raison d'être. Le panneau « Réglages de l'aperçu » et son script ne sont pas repris.
3. **Les réglages dans `tokens.css`**, avec les autres valeurs de présentation : `--fond-voile: 0.55`,
   `--fond-duree-avance: 60s`, `--fond-duree-lueur: 9s`, `--fond-duree-balayage: 16s`.
4. **Le branchement : la page le porte.** `index.html` et `verifier.html` chargent `css/fond.css` et ont, juste après
   `<body>`, `<div class="fond" aria-hidden="true">` avec ses trois enfants. **Pourquoi ainsi** : c'est la façon la
   plus simple à lire et à maintenir — le HTML d'une page dit s'il y a un fond, sans script, sans classe à poser ni à
   retirer selon l'écran ; les règles se comparent une à une à la maquette ; les trois autres pages ne chargent rien de
   plus. Une classe sur `body` n'aurait rien ajouté : il faut de toute façon les éléments des couches — ou alors les
   dessiner avec les deux seuls pseudo-éléments de `body`, pour quatre couches, ce qui obligerait à des astuces. Et le
   JavaScript était exclu par la demande. L'élément est en dehors du flux (`position: fixed`) : la charpente en
   `flex` de `body` ne le voit pas.
5. **L'empilement, vérifié dans le code puis dans Chrome (§4).** `.fond` est en `z-index: -1` dans le contexte
   d'empilement de la racine : il se peint après le canevas (la couleur de `body`, `--color-bg`, qui reste dessous si
   l'image ne charge pas) et avant tout le contenu en flux. Les pseudo-éléments en `z-index: -1` des panneaux et des
   boutons ne passent pas dessous : `.panel` a un `filter` et `.button` une `isolation: isolate`, chacun est donc son
   propre contexte d'empilement, où son `::before`/`::after` se peint derrière son texte mais devant tout ce qui est
   hors de lui. Les cases ont un fond opaque. La feuille des tables (`.sheets`, `position: fixed`, `z-index: 10`, fond
   `--color-print-stage`) couvre toute la fenêtre. La ligne de balayage est une couche **de `.fond`** : elle ne peut pas
   passer par-dessus le contenu ; et comme `.fond` est un contexte d'empilement isolé, ses `mix-blend-mode: screen` ne
   fusionnent qu'avec ses propres couches, jamais avec la page. Un commentaire de `fond.css` et une ligne de CLAUDE.md
   préviennent du seul piège trouvé : **donner un fond à `<html>`** ferait que la couleur de `body` ne serait plus
   reportée sur le canevas et se peindrait par-dessus l'image.
6. **L'écran de l'attestation** : `.attestation-stage { background: none; }` dans `fond.css` — la page lettre flotte sur
   le fond (§5.1). À l'impression, `base.css` posait déjà `background: none` sur la scène : rien ne change.
7. **Test** `tests/ui-fond.test.js` (4 tests) : les deux pages qui portent la feuille et une seule couche à trois
   enfants, avant l'en-tête, et les trois pages qui n'ont ni l'une ni l'autre ; les trois `@keyframes` qui n'animent
   que `transform` et `opacity`, ni `filter` ni `background-attachment`, les durées et le voile tirés de `tokens.css`
   (avec leurs valeurs) ; la couche fixée en `z-index -1` sans événements ; l'image du téléphone dans le `@media`
   d'écran en hauteur ; `animation: none` en mouvement réduit ; `display: none` à l'impression ; la scène de
   l'attestation sans fond ; `site/img/fond/` qui contient exactement les deux WebP, identiques à ceux de
   `reference/fond/`.
8. **Documents** : D88 ; UI §1 (le tableau des deux univers, la sous-section « Fond animé »), §3.6, §6 ; CLAUDE.md
   (la feuille, le dossier des images, la règle « à ne pas faire ») ; PLAN ; ce rapport.

## 3. Poids ajouté par page

Mesuré dans Chrome (`performance.getEntriesByType('resource')`, serveur `wrangler dev`) : au premier chargement, une
page des étudiants demande **deux fichiers de plus**, la feuille et **une seule** des deux images — le navigateur ne
charge que celle du `@media` qui s'applique. Les deux sont servies avec le cache des ressources statiques du Worker :
les chargements suivants ne les redemandent pas.

| Page et écran | Fichiers demandés en plus | Octets sur le réseau |
|---|---|---|
| Accueil ou `/verifier`, ordinateur (1366 × 768) | `css/fond.css` (5,2 Ko ; 2,3 Ko compressés) + `fond-ordinateur.webp` (77,6 Ko) | **≈ 80 Ko** |
| Accueil ou `/verifier`, téléphone (390 × 844) | `css/fond.css` + `fond-telephone.webp` (62,7 Ko) | **≈ 65 Ko** |
| Les écrans suivants du même parcours (identification, question, attestation) | rien : la même page, les fichiers déjà là | 0 |
| `/prof`, `/prof/editeur`, `/tables` | rien | 0 |

Pour situer : sans images, le quiz charge déjà environ 94 Ko de CSS, 220 Ko de polices (neuf woff2) et 52 Ko de
bibliothèque QR, plus les modules JS (environ 300 Ko pour ceux de `index.html`) ; le fond ajoute donc de l'ordre de
10 % au premier chargement d'un ordinateur du labo, moins sur téléphone. Aucune requête vers un domaine externe.

## 4. Vérifications

- `npm test` : **806 tests, 0 échec** (802 avant, 4 ajoutés).
- `npm run test:api` : **35 étapes** sur `wrangler dev` et une D1 jetable, comme avant.
- **Dans Chrome (sans interface, protocole DevTools), deux passes sur la même base et le même port** — « avant » sur un
  arbre de travail git de `main`, « après » sur le dépôt —, avec une D1 jetable préparée une fois par l'API (Camille :
  une question du M10 en cours ; Zoé : le M10 réussi, son attestation `652AD-HSMVN`) et copiée pour chaque passe.
  **47 vérifications après, toutes passées ; aucune erreur console, aucune exception, aucune requête externe.** À
  1366 × 768 et à 390 × 844 :
  - **accueil** : la couche `.fond` est là, fixée, `z-index -1`, `pointer-events: none` ; l'image en usage est celle de
    l'ordinateur à 1366 et **celle du téléphone à 390** ; trois animations et rien d'autre (`document.getAnimations()`) ;
    une seule image demandée ; rien ne déborde de la fenêtre ;
  - **empilement par pixels témoins** (les captures décodées en Node) : un point dans la marge intérieure du premier
    panneau est `#0b1430` et un point de la barre du haut `#03060f`, avant comme après ; puis, les animations figées et
    **la ligne de balayage placée exprès au milieu du panneau** (`currentTime` de l'animation), le panneau et la barre
    gardent leurs couleurs tandis que le vide à côté s'éclaircit (`#030c1b` → `#0c1829` à 1366, `#0b192a` → `#122437`
    à 390) : la ligne passe sous le contenu, pas dessus ;
  - **question corrigée** (Camille reprend sa question ; en mode test la case Vc est préremplie ; « Vérifier » →
    « Bonne réponse ») : le panneau de l'outil `#0b1430`, la barre `#03060f`, la case corrigée `#0e2a20`, inchangés avec
    la ligne de balayage posée dessus ;
  - **feuilles des tables** : la couche couvre exactement la fenêtre (0, 0, 1366 × 768 et 390 × 844), opaque
    (`rgb(42, 47, 58)`), `z-index 10`, `body.sheets-open` ; **deux captures à 2,5 s d'écart sont identiques** (0 pixel
    différent sur 1 049 088 et 329 160) : rien du fond ne paraît ; à 1366, les coins de la fenêtre sont la barre ou la
    scène ;
  - **attestation à l'écran** : la scène transparente (`rgba(0, 0, 0, 0)`), la page blanche ; **en mode impression**
    (média `print`, fenêtre de 720 px) : la couche n'a aucune boîte, `body` blanc, l'en-tête caché, la scène sans fond,
    et **la capture de toute la page est identique à celle d'avant, pixel pour pixel** (0 différent sur 1 382 400, aux
    deux tailles) ; le PDF a 2 pages avant comme après ;
  - **`/verifier`** : la couche et ses trois animations ; la case `#08102a` et le panneau `#0b1430` opaques ;
    `?code=652AD-HSMVN` → « Attestation valide » ;
  - **mouvement réduit émulé** (`prefers-reduced-motion: reduce`, à 1366) : la couche est là, `getAnimations()` est
    **vide**, et deux captures à 3 s d'écart sont **identiques** (0 pixel) ; sans l'émulation, les deux mêmes captures
    diffèrent de 323 248 pixels (la lueur et l'avancée) ;
  - **`/prof` et `/tables?version=`** : ni couche `.fond` ni `fond.css`.
- **Captures** dans `captures/fond-anime/` (hors dépôt), chacune en `-avant` et `-apres` : `01-accueil` (1366, 390),
  `01b-accueil-1366-balayage` (la ligne au milieu du panneau), `02-question-corrigee` (1366, 390) et
  `02b-question-correction-390` (le bandeau), `03-tables` (1366, 390), `04-attestation` (1366, 390),
  `05-attestation-impression` (mode impression, page entière, 1366 et 390 — identiques), `06-verifier` et
  `07-verifier-valide` (1366, 390), `08-accueil-mouvement-reduit-1366`, et les PDF `attestation-*.pdf`.
- Regardées une à une : les panneaux et le texte se lisent bien sur l'image ; le pied de page, en texte atténué, est
  sur la partie la plus sombre du voile (§5.2) ; à 390, l'image du téléphone montre l'hexagone sous les panneaux.

## 5. Points douteux, à trancher

1. **La scène de l'attestation transparente** (D88, point 5 ; `fond.css`, une ligne). Sans elle, la scène grise remplit
   l'écran et le fond n'est visible nulle part sur l'écran de l'attestation, pourtant nommé dans la demande. La page
   lettre blanche sur le fond se lit comme un document posé sur l'atelier (capture `04-attestation-1366-apres`).
   **Proposition : garder.** Pour revenir au gris : retirer la règle `.attestation-stage { background: none; }`.
2. **Le pied de page et la barre de l'attestation sont posés directement sur l'image** (texte atténué `#8aa0c6` à
   12 px, « Exercice réussi. Remets ce PDF sur Léa. »). Le voile y est à son plus épais (le dégradé radial vers les
   bords) et le texte se lit bien sur les captures, mais le contraste dépend de ce que l'image met à cet endroit, et
   d'un écran à l'autre. **Proposition : garder ; si ça gêne sur un écran du labo, une bande sombre sous le pied**
   (`background: rgba(5, 9, 26, 0.6)` sur `.app-footer`) suffit, sans toucher au fond.
3. **La ligne de balayage est discrète** sous le voile à 0.55 : neuf niveaux de plus environ sur le vide
   (`#030c1b` → `#0c1829`), elle se voit en regardant, pas en lisant. La maquette la laissait **décochée par défaut**
   (`body class="fx-avance fx-lueur"`) ; la demande dit « les trois effets ». **Proposition : garder telle quelle** ;
   la rendre plus visible se fait dans les deux `rgba` de `.fond-balayage` (0.10 et 0.22), pas dans le voile.
4. **Le coût sur les vieux postes du labo et la batterie des téléphones.** Trois animations infinies, mais composées
   par le GPU (`transform`, `opacity`) ; la plus coûteuse est la lueur (un dégradé de 70 vmax en `mix-blend-mode:
   screen`). Sur le poste de Thierry, Chrome ne signale rien ; je n'ai pas de vieux poste pour mesurer. **Proposition :
   observer au premier labo** ; si un poste peine, Windows → Accessibilité → Effets visuels → « Effets d'animation »
   désactivés fige le fond sur ce poste seul (`prefers-reduced-motion`), sans changer le code.
5. **iPhone et Safari ne sont pas essayés** (Chrome seulement ; voir `docs/rapports/finition-calcul-saisie.md` pour le
   tunnel). Ce qui est à regarder là-bas : `mix-blend-mode: screen` (pris en charge), les unités `vh` de la ligne (sur
   iOS, `100vh` compte la barre d'adresse : la ligne finit un peu plus bas que le bas visible, sans conséquence), et
   le réglage « Réduire les animations », qui doit figer l'image. **Proposition : un essai sur ton iPhone avant de
   déployer**, puisque c'est pour lui que la seconde image a été faite.
6. **Les images du fond ne passent pas par la Gestion du contenu** : en changer demande un commit (copier le WebP dans
   `site/img/fond/`, mettre à jour `reference/fond/`, le test vérifie qu'ils sont identiques). **Proposition : laisser
   ainsi** — c'est de la présentation du site, pas du contenu d'exercice ; et les images de la base sont servies par
   `/images/<id>` avec un cache qui convient aux photos d'outils, pas à une image de 78 Ko chargée à chaque page.
7. **La frontière `max-aspect-ratio: 4/5`** : un iPad debout (768 × 1024, rapport 0,75) prend l'image du téléphone ;
   couché, celle de l'ordinateur ; une fenêtre d'ordinateur rétrécie en largeur (moins de 4/5 de sa hauteur) bascule
   aussi sur l'image du téléphone, et revient quand on l'élargit. C'est la règle de la maquette. **Proposition :
   garder.**
8. **Le test épingle le texte de `fond.css`** (les sélecteurs, les durées, les deux `@media`) : une retouche du fond
   demande de mettre le test à jour. C'est voulu — une ligne de test par règle de D88 —, mais c'est un choix.
   **Proposition : garder.**

## 6. Ce qui ne change pas

Le serveur de correction, la base, les séances, l'attestation (son enregistrement, son code, son QR, sa page imprimée),
les feuilles des tables, l'espace professeur, la Gestion du contenu, `/tables`. Aucun JavaScript n'a été ajouté ni
modifié.
