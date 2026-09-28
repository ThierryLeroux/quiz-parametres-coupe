# Rapport — Finition F2 : le graphique de progression par opération (décision D81)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Tout se passe dans le navigateur, dans le
> panneau Progression de l'écran Question. Le serveur, la correction, les tolérances, les compteurs, la question figée,
> la séance et les attestations ne changent pas ; aucune migration. Au déploiement, un étudiant en cours de séance voit
> le nouveau panneau à son prochain affichage ; sa progression est la même.

Session du 2026-09-28, branche `finition-graphique-progression`, partie de `main` à jour (`e0f1226`, F1 fusionnée).
Poussée, pas fusionnée ; rien n'a été lu ni écrit en production.

## En bref

- **Le panneau Progression est regroupé par opération.** Chaque opération a un en-tête : son pictogramme (celui des
  tables de la séance), son nom, « n / m » et une barre. Ses outils sont dessous, avec leurs points, comme avant. La
  barre « n / m outils » du haut et la légende du bas restent.
- **Couleurs** : l'acquis en bleu. Pendant le corrigé seulement, le gain de la question en vert et la perte en rouge.
  Une opération complète a un contour doré **dès la question qui la complète** : le retard du classeur n'est pas repris.
- **Téléphone** : les opérations terminées se replient sous « n opérations terminées ». L'opération que la question
  vient de changer reste visible, même complète.
- **Le serveur envoyait déjà tout** (point 7) : pour chaque outil, son opération, ses réussites plafonnées et ses
  réussites exigées, dans l'ordre de l'exercice. Rien n'a été touché côté serveur.
- Tests : **694** (686 avant : 9 nouveaux, 1 remplacé). **Chrome** : 6 passes, 146 questions, 28 163 vérifications
  dans le DOM, aucun échec, aucune erreur console.
- **Cinq points à trancher** (§5).

## 1. Ce qui a été fait

**D81** (DECISIONS) reprend tes sept points, dans l'ordre, avec le contexte du classeur (`modAffGraph`, le cadre doré
affiché une question trop tard). Le PLAN a les tâches du jalon sous « Finition » ; « Graphique de progression par
opération » est coché.

**La règle** — `operationProgress(progression, labels, { previous, currentId, resetId, phone })`, dans
`site/js/ui/rules.js`, pure, testée avant d'être branchée. Pour chaque opération, elle rend :

- `done / total` : la somme des réussites de suite de ses outils, plafonnées par le serveur, sur la somme de leurs
  réussites exigées ;
- `kept`, `gain` et `loss`, les trois parts de la barre, comptées outil par outil par rapport à la progression d'avant
  « Vérifier » (`previous`) :
  - `kept`, l'acquis, en bleu ;
  - `gain`, ce que la question vient de gagner, en vert ;
  - `loss`, ce qu'elle vient de faire perdre, en rouge, dessiné après ce qui reste ;

  sans `previous` (premier affichage, question suivante), tout est acquis ;
- `complete`, le contour doré ;
- `label`, l'`aria-label` de la barre : « Perçage : 6 réussites sur 10 », « 0 réussite sur 3 » ;
- `rows`, ses outils, rendus par `progressRows` comme avant.

Sur téléphone, elle replie les opérations complètes que la question n'a pas changées. Une opération reste visible si
elle a du vert, du rouge, l'outil en cours ou l'outil remis à zéro. Elle rend aussi le résumé « n opérations
terminées ». Elle remplace `foldDoneRows`, le repli par outil.

**L'écran** — `question-screen.js` : le panneau reçoit la progression d'avant « Vérifier » (celle de la question) pour
dessiner le corrigé. À la question suivante, il ne la reçoit plus : les barres redeviennent simples. Le pictogramme
vient de `operationPictoOf(data, …)`, avec les tables de la version de la séance, comme dans le panneau de l'outil ; un
pictogramme qui manque disparaît sans casser la ligne.

**La présentation** — `question.css`, avec les jetons existants et aucune couleur nouvelle :

- En-tête : le pictogramme de 30 px sur une pastille blanche, à gauche, sur deux lignes ; le nom et « n / m » sur la
  première ligne, la barre de 8 px sur la seconde.
- Les noms des outils s'alignent sur celui de l'opération.
- Une opération complète : un contour doré de 2 px autour de sa barre, et son « n / m » en doré.
- Le vert et le rouge ont la même lueur que les points.

**Les tests** (`tests/ui-rules.test.js`) construisent la progression avec le vrai `sessionView` du serveur : ils
vérifient aussi que les données dont l'écran a besoin arrivent bien. Les cas :

- une opération à un seul outil, avec son en-tête ;
- des outils de même nom : SDTMR impérial et métrique (M10), forets de même unité distingués par leur plage
  (test-complet) ;
- des réussites plafonnées (« Perçage : 6 réussites sur 10 ») ;
- le premier affichage sans progression d'avant ;
- une réussite qui complète une opération (contour doré tout de suite, visible sur téléphone), puis la question
  suivante (barre simple, contour gardé) ;
- un échec qui vide une opération (tout en rouge), et un échec dans une opération à plusieurs outils (le reste en
  bleu, la perte en rouge) ;
- un échec sur un outil déjà à zéro : ni rouge ni vert, mais « remis à zéro » ;
- des opérations intercalées (un cas construit, puis test-complet : 16 opérations, le Chanfreinage revient trois
  fois) ;
- le repli sur téléphone : l'ordre, le résumé, l'opération de l'outil en cours et celle de l'outil remis à zéro
  visibles avec leurs outils terminés, rien de replié sur ordinateur, une progression vide.

L'ancien test du repli par outil est repris par ces cas, sans rien perdre de ce qu'il vérifiait : repli dans l'ordre,
outil en cours et outil remis à zéro toujours visibles, liste vide.

**Les documents** :

- SPEC §7 : la ligne « Un graphique … est affiché » est remplacée par ce qu'il montre.
- SPEC §10 : la ligne « Reporté : seuils du graphique » disparaît ; à sa place, « aucun réglage », avec un renvoi à
  D81.
- UI §3.3, le paragraphe Progression.
- UI §3.4 : ce qui change après une question ratée ou réussie, puis à la question suivante.
- UI §7 : la couleur doublée d'un texte.

La maquette 03 reste telle quelle. `CLAUDE.md` n'avait pas à changer.

## 2. Ce qui a été vérifié

- `npm test` : **694** tests, `fail 0`.
- **Chrome** (sans interface, contre un `wrangler dev` jetable, en mode test et en français), sur `m10-tournage-vc`,
  `m10-tournage-vc-rpm` et `test-complet` (publié sur la base jetable), à 1280 et à 390 px. Chaque passe joue
  l'exercice jusqu'au dernier corrigé, en provoquant un échec qui fait perdre et un échec sur un outil à zéro. À chaque
  question et à chaque corrigé, le script vérifie dans le DOM :
  - l'ordre des opérations et de leurs outils ;
  - « n / m » comparé à la séance lue au serveur, et les points qui le font ;
  - l'`aria-label` ;
  - le pictogramme chargé ;
  - les couleurs calculées (bleu, vert, rouge, doré) et la largeur de chaque part ;
  - le contour doré si et seulement si l'opération est complète ;
  - aucune autre opération en vert ou en rouge ;
  - sur téléphone, les opérations repliées ;
  - rien qui déborde à 390 px.

  Bilan : 146 questions, **28 163 vérifications, aucun échec** ; aucune erreur console, aucune exception, aucune
  requête hors du site. Tout a été vu dans chaque passe : réussite en vert, opération complétée avec son contour doré
  (dont une à plusieurs outils), question suivante en barres simples, échec sur un outil à zéro, repli sur téléphone.
  L'échec en rouge a été vu sur les deux M10. Il est impossible dans test-complet : chaque outil n'y exige qu'une
  réussite, donc un outil qui en a une est terminé et n'est plus jamais tiré.
- Ma première passe avait signalé de faux échecs : le navigateur arrondit la largeur écrite (« 33.3333% ») et mon
  script la comparait au texte exact. J'ai corrigé la comparaison dans le script et tout relancé. Le code du site n'a
  pas changé entre les deux passes.
- Pas de `test:api` : le serveur n'a pas changé.
- Captures (non versionnées) : `captures/finition-graphique-progression/<exercice>-<largeur>/`, avec `rapport.json`.

## 3. Ce qui n'a pas changé

Ni le serveur (`sessionView` envoyait déjà `operation`, `reussites` plafonnées et `requises`), ni la correction, ni les
compteurs, ni l'attestation, ni la page de description, ni l'espace professeur, ni aucune migration. La barre
« n / m outils » du haut, les points et la légende restent. La maquette 03 aussi.

## 4. Pour relire dans le navigateur

`npm run dev`, puis un exercice. Avec `MODE_TEST=1` dans `.dev.vars`, « Remplir » donne les bonnes réponses ; changer
la Vc pour provoquer un échec. Pour voir du rouge, il faut rater un outil qui a déjà une réussite de suite : sur le M10,
MVLNR, lame à tronçonner ou barre à rainurer (3 réussites chacun). Sur téléphone, réduire la fenêtre sous 1000 px
**avant** d'ouvrir la question : le repli se décide à l'affichage.

## 5. Points à trancher

1. **Le contour doré entoure la barre**, comme le cadre du classeur, pas tout le bloc de l'opération (en-tête et
   outils) ; son « n / m » passe aussi en doré. Le bloc entier se verrait davantage, mais en fin d'exercice le panneau
   serait couvert de cadres dorés. Je propose de garder la barre. Changer, c'est une ligne de CSS.
2. **Bleu et vert côte à côte** : la part acquise d'une opération est bleue (ta décision). Les points pleins et la
   barre « n / m outils » du haut restent verts, comme depuis le jalon 4 (« restent »). Pendant le corrigé, le vert
   d'un gain se lit donc à côté de points verts qui sont de l'acquis. Je propose de laisser ainsi : le vert des points
   voulait déjà dire « acquis ». Sinon, les points et la barre du haut passeraient au bleu.
3. **Les noms d'outils sont décalés** sous le nom de leur opération, à droite du pictogramme. Les plus longs passent
   sur deux lignes, sur ordinateur comme sur téléphone : forets métriques avec leur plage, tarauds impériaux de
   test-complet. Dans les deux M10, aucun ne passe à la ligne. Je propose de garder l'alignement ; l'autre choix est de
   remettre les noms au bord gauche, comme avant.
4. **Longueur du panneau sur ordinateur** : avec test-complet (16 opérations, 29 outils), le panneau fait environ
   1 900 px de haut, puisque rien n'est replié sur ordinateur (ton point 5). Les exercices des étudiants sont plus
   courts : 7 opérations pour 9 outils, 5 pour 11. Je propose de ne rien changer.
5. **Pendant le corrigé d'une réussite, l'outil n'est plus surligné « en cours »**, comme avant ce jalon. Ce qui montre
   où la question a compté : le vert de la barre, le point qui se remplit et le bandeau « Bonne réponse — SDTMR
   (impérial) : 1 réussite de suite sur 1 ». Je propose de laisser ainsi. On pourrait aussi garder le surlignage de
   l'outil pendant le corrigé.

## 6. Commits

1. D81 ; les tâches du jalon F2 dans le PLAN.
2. `operationProgress` et ses tests (l'ancien repli gardé le temps du branchement, pour que chaque commit laisse un
   site qui marche).
3. Le panneau Progression regroupé par opération (`question-screen.js`, `question.css`) ; `foldDoneRows` retiré, son
   test repris.
4. Documents : SPEC §7, §10 ; UI §3.3, §3.4, §7.
5. PLAN coché et ce rapport.
