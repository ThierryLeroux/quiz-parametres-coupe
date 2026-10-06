# Rapport — L'accueil lisible au premier coup d'œil : une carte par cours, une rangée par exercice avec sa démo (décision D91)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Rien ne touche la correction, le serveur ni
> l'attestation : aucun fichier de `worker/`, aucune migration ; `GET /api/exercices` rend la même liste. **C'est de
> l'affichage seulement, sur l'accueil (`/`)** : au déploiement, tout le monde voit les cartes de cours à la place de
> la liste ; une séance en cours ne passe pas par l'accueil et ne voit rien changer. La page d'un exercice
> (`?exercice=<id>`, le lien de Léa), l'identification, les questions et le fond animé sont les mêmes.

Session du 2026-10-06, branche `accueil-lisible`, partie de `main` à jour (`66b91b4`). Poussée, pas fusionnée.

## 1. Le constat

En production, depuis le lot d'exercices (D84), l'accueil empile **quatorze liens soulignés** — sept exercices et sept
démos — dans un seul panneau de 680 px, chacun suivi d'une longue ligne « 13 outils · champs évalués : vitesse de
coupe, avance par dent, vitesse de rotation, avance totale par révolution, vitesse d'avance ». Mesuré dans Chrome
avec le code de `main`, sur une base jetable où le lot est importé et publié (les quatorze entrées de la production,
dans l'ordre des rangs) :

| Avec le code d'avant | 1366 × 768 | 390 × 844 | 360 × 740 |
|---|---|---|---|
| Hauteur de la page | 1890 px (2,5 écrans) | 2206 px | 2238 px |
| Largeur de l'écran d'accueil | 680 px | 358 px | 328 px |
| Liens dans la page | 14 exercices et démos + Espace professeur, tous soulignés | idem | idem |

Chaque titre se lit deux fois (« Tournage — Démo de l'exercice 2 », « Tournage — Exercice 2 »), rien ne distingue au
premier regard le cours, l'exercice et sa démo. La maquette de référence de Thierry est
`reference/accueil/apercu-accueil.html` (ajoutée à la branche) ; elle lit les feuilles de `site/css/`.

## 2. Ce qui change, sur l'accueil seulement

| | Avant | Après |
|---|---|---|
| En-tête | un panneau « Exercices », « Quel exercice fais-tu ? », une consigne de deux lignes | **sans panneau, posé sur le fond** (ombre portée du texte) : « EXERCICES · PARAMÈTRES DE COUPE », « Quel exercice fais-tu ? » (au focus), puis **1 Ton cours · 2 L'exercice indiqué sur Léa · 3 Ton matricule et ton NIP** |
| Avis (exercice inconnu, D18 ; aucun exercice) | au-dessus de la consigne, dans le panneau | **sous le titre, dans un panneau** à part, pour rester lisibles sur l'image |
| Cours | un intertitre souligné par cours, dans le même panneau | **une carte par cours** (panneau biseauté) : le **sigle encadré** en chasse fixe, le nom à côté (« M10 — Tournage » → **M10** Tournage), « 2 exercices » à droite ; **deux colonnes à partir de 900 px**, une en dessous ; l'écran fait 1040 px (les autres gardent 680) |
| Exercice | un lien souligné, et dessous la ligne des champs évalués en toutes lettres | **une rangée** dont le lien couvre toute la surface : le titre en 17 px, « › », et dessous « À trouver » puis **une pastille par grandeur** (Vc, fz, N, f, Vf — le nom complet en indice), « · 13 outils » ; nom accessible complet |
| Démo | sa propre rangée, avec son titre, avant l'exercice | **le bouton « DÉMO »** (pictogramme de projecteur) à droite de la rangée de son exercice, séparé par un filet, atténué, **doré au survol** ; nom accessible « Démo : <titre> », indice « … une seule question, à faire au projecteur » |
| Raccourcis | — | sous 900 px, **une rangée de liens** vers chaque carte (ancre stable `cours-m10-tournage`, …) ; cachés sur ordinateur |
| Porte professeur | un panneau avec le lien souligné et la phrase sur les deux clés | **un panneau d'une ligne** : « ENSEIGNANTS », la note sur les démos, le bouton au contour **Espace professeur →** ; la phrase sur les clés n'y est plus (la connexion de `/prof` la dit) |
| Hauteur de la page | 1890 / 2206 / 2238 px | **1191 / 1951 / 1951 px** (1366 / 390 / 360 px) : sur ordinateur, les cinq cartes et la porte professeur tiennent en un écran et demi |

Et ce qui ne change pas : `GET /api/exercices`, le regroupement par cours (`homeGroups`, `courseKey`, « Autres
exercices »), l'ordre des rangs (D51), la page d'un exercice, la correction, le fond animé.

## 3. Ce qui a été fait

1. **`site/js/ui/home-data.js`** (règles pures) : `attachDemos` — l'entrée « demo-<id> » s'accroche à « <id> » quand les
   deux sont dans la liste reçue (la rangée garde la place de l'exercice ; une démo orpheline ou sans la convention
   reste une rangée ; une démo sous un autre cours s'accroche quand même) ; `splitCourse` — le sigle et le nom, coupés
   au premier « — » (un trait d'union n'est pas le tiret) ; `courseAnchor` — « cours-m10-tournage », « cours-m30 »,
   « cours-autres-exercices », « cours-exercices » ; `gradedFields` — les grandeurs évaluées dans l'ordre Vc, fz, N, f,
   Vf, avec leur nom ; `homeCards` — les cartes : sigle, nom, « 2 exercices » sans compter les démos, et pour chaque
   rangée le lien, les pastilles, « 13 outils », le nom accessible et sa démo (lien, nom accessible, indice).
   `exerciseHref` (le lien relatif des rangées), `OTHERS_TITLE`, `NO_COURSE_NAME` (« Exercices » : la seule carte quand
   aucun exercice n'a de cours). `text.js` exporte `countText` ; `listedExerciseMeta` est retirée (plus rien ne
   l'écrivait).
2. **`site/js/ui/home-screen.js`** : `renderHomeList` réécrit — l'en-tête (`.home-hero`, sans panneau), les avis dans
   `.home-notice` (un panneau) sous le `h1`, la liste ordonnée des trois étapes (le numéro encadré est `aria-hidden` :
   un lecteur d'écran a déjà la numérotation), les raccourcis (`nav`, « Aller à un cours », seulement à partir de deux
   cartes), une `section.panel.course-card` par cours avec son ancre et son `h2` (`aria-labelledby`), un `li.ex-row` par
   exercice à deux liens frères (`a.ex-main` avec `aria-label`, `a.ex-demo` avec `aria-label` et `title`) — jamais de
   lien dans un lien —, le pictogramme de projecteur en SVG **construit par le DOM** (`createElementNS`, jamais
   `innerHTML`), la porte professeur compacte. Les textes sont des constantes exportées (`HOME_EYEBROW`, `HOME_TITLE`,
   `HOME_STEPS`, `DEMO_NOTE`, `TEACHER_LINK_LABEL`, `NO_EXERCISE_NOTICE`, `unknownExerciseNotice`).
3. **`site/css/app.css`** : la section de l'accueil réécrite (`.screen--home` 1040 px, `.home-hero`, `.home-steps`,
   `.course-jump`, `.course-grid`, `.course-card`, `.course-head`, `.course-code`, `.ex-row`, `.ex-main`, `.qty`,
   `.ex-demo`, `.home-teacher` ; deux colonnes et raccourcis cachés à partir de 900 px ; téléphone sous 640 px ; le
   contour de focus dessiné à l'intérieur de la rangée ; transitions retirées en `prefers-reduced-motion`) ; les règles
   `.exercise-list`, `.home-course`, `.home-group` retirées. **Aucune couleur en dur** : `tokens.css` reçoit
   `--color-panel-row` (la rangée, un ton plus clair que le panneau), le reste vient des couleurs existantes par
   `color-mix`.
4. **Tests** : `tests/ui-home.test.js` — les règles pures (rattachement, démo orpheline, démo sans convention, ordre
   conservé, coupe du cours, ancres, grandeurs dans l'ordre, cartes et compte sans démos, « Autres exercices », groupe
   sans titre, serveur d'avant D71) et l'écran sur le DOM minuscule `tests/aide-dom.js` (qui apprend
   `createElementNS`) : l'en-tête, le h1 au focus, les étapes, les raccourcis, les cartes et leurs ancres, les rangées,
   les pastilles, la démo en lien à part, aucun lien dans un lien, les avis, la liste vide, la porte professeur sans
   phrase sur les clés ; et la feuille de style (1040 px, 900 px, 17 px, mouvement réduit, aucune couleur en dur).
5. **Documents** : D91 ; UI §3.1 (la description de l'accueil remplacée) ; CLAUDE.md ; PLAN ; ce rapport.

## 4. Vérifications

- `npm test` : **824 réussis, 0 échec** (811 avant, 13 ajoutés).
- `npm run test:api` : **35 étapes, 0 échec** (rien du serveur n'est touché ; lancé quand même, comme demandé).
- **Chrome sans interface**, avant (le code de `main`) et après, **sur la même base jetable et le même port** : l'export
  de la production du 29 sept. restauré, le lot importé et ses quatorze exercices publiés par l'API, la démo de
  « Tournage — Exercice 2 » montée de deux rangs, les trois exercices d'avant le lot archivés — l'accueil montre
  exactement les quatorze entrées de la production, dans son ordre. Scripts hors dépôt (`preparer-accueil.mjs`,
  `captures-accueil.mjs`). Captures dans `captures/accueil-lisible/` (hors dépôt) : `avant-accueil-{1366,390,360}.png`,
  `apres-accueil-{1366,390,360}.png`, `apres-survol-1366.png` (une rangée survolée), `apres-survol-demo-1366.png`
  (la démo dorée), `apres-focus-390.png` (une rangée au focus clavier), `apres-raccourci-390.png` (après un
  raccourci), `apres-inconnu-1366.png` (l'avis D18).
- **Après : 40 vérifications, 0 en échec ; aucune erreur console, aucune exception, aucune requête externe.** À
  1366 × 768, 390 × 844 et 360 × 740 : aucun défilement de côté (`scrollWidth` = largeur de la fenêtre), aucun élément
  au-delà du bord droit, aucun lien dans un lien, **5 cartes, 7 rangées, 7 démos** (14 liens dans les cartes, plus
  Espace professeur), l'écran de 1040 px à 1366 px (358 et 328 px sur téléphone), **deux colonnes** de cartes à 1366 px
  (les deux premières au même `top`) et **une colonne** en dessous, les raccourcis cachés (`display: none`) à 1366 px et
  affichés en dessous (cinq liens de 44 px de haut), chaque cible Démo d'au moins 44 × 44 px (64 × 73 sur ordinateur,
  54 × 73 à 117 sur téléphone), le h1 au focus à l'ouverture, le titre de rangée en 17 px, le **focus clavier visible**
  (contour `solid`, `:focus-visible`) sur les quatre premiers éléments atteints par Tab — les rangées et les démos sur
  ordinateur, les raccourcis sur téléphone —, un raccourci qui amène sa carte **à 16 px du haut** de l'écran
  (`scroll-margin-top`), la démo survolée **dorée** (`rgb(255, 192, 0)`), aucune transition sur la rangée en
  `prefers-reduced-motion`, l'avis « L'exercice « inconnu » n'existe pas — vérifie le lien sur Léa. » sous le h1 dans un
  panneau (le 400 de l'API pour cet exercice est le refus attendu).
- **Mesures** (après) : cartes de 508 px de large à 1366 px, 267 / 180 / 201 px de haut (deux, une, une rangées) ; à
  390 px, 358 px de large, 269 / 203 px de haut ; la rangée à cinq pastilles passe « · 9 outils » à la ligne sur
  téléphone (la rangée fait alors 95 px au lieu de 73).

## 5. Points douteux, à trancher — une proposition pour chacun

1. **Le nom de la carte quand aucun exercice n'a de cours.** La consigne dit « une carte avec ce titre en nom, sans
   sigle encadré » pour le groupe sans titre comme pour « Autres exercices » ; le groupe sans titre n'a pas de titre
   (`homeGroups` rend `null`, le cas d'avant D71 où aucun exercice n'avait de cours). J'ai nommé cette carte
   **« Exercices »** (`NO_COURSE_NAME`). Ce cas n'arrive plus en production (tout le lot a un cours). Proposition : garder
   « Exercices » ; sinon, une constante à changer.
2. **« · 9 outils » qui passe seul à la ligne sur téléphone.** À 390 px, la rangée à cinq pastilles ne loge pas
   « À trouver Vc fz N f Vf · 9 outils » sur une ligne : « · 9 outils » passe en dessous, d'un seul tenant (le point
   médian suit le nombre, pour ne pas finir une ligne par « · »). La ligne du dessous commence donc par « · », qui
   ressemble à une puce. Proposition : laisser ainsi — c'est lisible ; l'alternative (le nombre d'outils avant les
   pastilles) changerait l'ordre voulu « À trouver … · n outils ».
3. **Les raccourcis avec une seule carte.** La consigne demande « une rangée de liens vers l'ancre de chaque carte » ;
   avec une seule carte, j'ai omis la rangée (rien à sauter). Proposition : garder.
4. **Le libellé des raccourcis** : le cours entier (« M10 — Tournage », « M10 — Fraisage »), comme dans la maquette,
   pour que les deux M10 se distinguent ; à 390 px, les cinq liens prennent deux lignes (138, 133, 61, 61, 58 px de
   large, 44 px de haut). Proposition : garder le cours entier.
5. **Le `h2` d'une carte ne contient que le sigle et le nom** ; « 2 exercices » est à côté, hors du titre (la maquette
   le mettait dans le `h2`), pour qu'un lecteur d'écran annonce « M10 Tournage » et pas « M10 Tournage 2 exercices ».
   Proposition : garder.
6. **Le nom accessible d'une rangée vient d'un `aria-label`** qui remplace le contenu du lien : « Tournage — Exercice 2
   — à trouver : vitesse de coupe, vitesse de rotation — 13 outils ». C'est ce que la consigne demande ; la contrepartie
   est qu'un lecteur d'écran n'entend pas les symboles Vc, N. Proposition : garder (les noms en toutes lettres sont ceux
   de D71).
7. **Une démo rangée sous un autre cours que son exercice** s'accroche quand même à la rangée de l'exercice (c'est
   l'exercice qui range la rangée) : son propre cours n'est alors vu nulle part. Proposition : garder — c'est le cas
   d'une donnée incohérente, et la démo reste joignable par le bouton.
8. **La consigne « Choisis l'exercice indiqué sur Léa par ton enseignant ; sa page dit ce qu'il demande avant que tu
   commences. » disparaît** : les trois étapes la remplacent, et la maquette n'en a pas. Proposition : garder la
   suppression ; si Thierry y tient, elle se remettrait sous les étapes (`.home-lead` de la maquette, non reprise).
9. **Pas essayé sur un vrai téléphone** (Chrome sans interface à 390 et 360 px seulement) ; ni le survol au doigt
   (`:hover` collant sur tactile : la rangée peut rester allumée après un toucher, comme ailleurs dans le site).
10. **`listedExerciseMeta` retirée de `text.js`** (plus rien ne l'écrivait) : hors de la portée stricte de la consigne
    (`renderHomeList`, `home-data.js`, `app.css`), mais c'est un code mort. Proposition : garder le retrait.
