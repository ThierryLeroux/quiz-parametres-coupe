# Rapport — jalon 7a : éditeur, exercices et banque d'outils en D1

Session du 2026-09-24. Branche `jalon-7a-editeur` à partir de `main` à jour, sept commits (un par
point, plus les docs), rien de poussé. `npm test` : 492 tests (+ 38), `fail 0` ; `npm run test:api` :
25 étapes (+ 4), une minute. Décisions **D47 à D49**. Chrome à 1280 et 390 px : 23 vérifications,
22 captures dans `captures/jalon-7a/` (hors dépôt), 222 requêtes, **aucune externe**, aucune exception.

## A. Modèle de données en D1

1. *Migration `0005`* (D47) : quatre tables — `tables_reference` (une version des tables de référence,
   immuable : `materiaux` et `operations` en JSON, une seule ligne « A2026_r0 »), `banque_outils` (un
   outil par ligne, au format d'`outils.json`, avec `revision`, `rang`, `archive_le`), `exercices`
   (identifiant d'URL, **brouillon** JSON, `revision` pour le contrôle optimiste, dates de
   modification, de publication, d'archivage) et `versions_exercice` (numéro, `contenu` JSON figé,
   `tables_id`, date ; `UNIQUE (exercice_id, numero)`). `seances.version_id` épingle la séance à sa
   version. Le SQL de la semence est **généré** par `reference/semence-d1/generer.mjs` (148 Ko, la
   plus grosse instruction fait 25 Ko : loin de la limite D1 de 100 Ko par instruction) ; on ne le
   relance pas, et un test vérifie que la semence est identique aux JSON du dépôt.
2. *Copies d'outils* : une entrée d'exercice est une copie complète de l'outil (toutes les clés
   d'`outils.json`) plus `reussites_requises` et `origine` (l'id de banque, à titre d'information).
   Les restrictions par outil du format fichier (`dimensions`, `materiaux_outil`, `groupes` d'une
   entrée) n'existent plus dans le format enregistré : `draftFromExercise` les applique en retirant
   de la copie. Les restrictions de tout l'exercice restent : `materiaux_outil` (D40) et, nouveau,
   `groupes`. Chaque copie porte `image` (sa photo) : une copie dupliquée (« mvlnr_2 ») garde la
   photo du MVLNR.
3. *Brouillon et versions* : le brouillon est le seul état modifiable ; « Publier » le copie tel quel
   comme version suivante, avec les tables de référence les plus récentes. Une séance prend la
   dernière version publiée à sa création et la garde jusqu'à la fin (testé : après la publication
   d'une version 2 qui retire l'outil de la question en attente, Camille continue sur la 1 — même
   titre, mêmes outils, même question — et son attestation dit « 1 » ; Alex, nouveau, est sur la 2).
   **Remplace le point 4 de D21** (la séance qui continuait sur l'exercice modifié) ; les deux tests
   « exercice modifié en cours de session » sont remplacés par « séance épinglée ». La version d'un
   exercice est son numéro (« 1 », « 2 »), inscrit sur l'attestation.
4. *Semence* : les 29 outils (avec `image` = leur id), les deux M10 en version 1, brouillon identique.
   Les séances existantes reçoivent `version_id` de la version 1 de leur exercice. Une séance créée
   par l'ancien serveur entre la migration et le déploiement (version NULL) prend la dernière
   publiée à sa première requête et y reste (testé). Testé aussi sur des données produites par le
   vrai serveur, transplantées dans une base au schéma 0001–0004 puis migrées : tables inchangées,
   `version_id` posé, `/verifier` répond pareil, l'attestation de Camille est identique, Zoé reprend
   et réussit sur la version 1. Et, pour une même graine, le M10 semé pose **les mêmes questions avec
   les mêmes réponses attendues** que le moteur sur les fichiers JSON (les deux M10, testé).
5. *Le moteur lit D1* : `worker/catalogue.js` assemble une version (tables + copies) au format de
   `loadData` (`assembleData`), gardée en mémoire (immuable). Chaque route de séance charge la
   version épinglée. Le navigateur demande `GET /api/exercice` (dernière version pour l'accueil,
   puis celle de la séance, rechargée si elle diffère) et `GET /api/exercices` (liste de l'accueil).
   L'espace professeur tire les titres d'exercice de D1. **CLAUDE.md le dit** : `site/data/` et
   `site/exercices/` ne sont plus que la semence et les données des tests ; les éditer ne change
   rien en production.

## B. Éditeur (`/prof/editeur`, rôle admin)

1. *Accès* : chaque route `/api/prof/editeur/*` exige le cookie admin — 401 sans cookie, **403 pour le
   rôle consultation**, testé sur les 17 routes, base comparée avant et après (rien d'écrit, pas même
   au journal). La page refuse la clé de consultation à la connexion. Chaque action est au journal
   (`editeur_creation`, `_enregistrement`, `_renommage`, `_archivage`, `_retablissement`,
   `_suppression`, `_publication`, `_banque_*`, `_export`, `_import`) ; l'aperçu et les lectures, non.
2. *Liste* : état (« Jamais publié », « Brouillon modifié » — le contenu diffère de la dernière
   version —, « À jour », « Archivé »), dernière version avec sa date, séances par version
   (« 2 séances (v2 : 1, v1 : 1) »), à l'accueil ; Ouvrir, Dupliquer (demande l'identifiant), Renommer
   (le titre du brouillon), Archiver / Rétablir, Supprimer (seulement sans séance, sinon 409 « archiver »),
   Copier le lien étudiant. Un exercice archivé n'est plus listé à l'accueil et refuse toute nouvelle
   séance ; ses séances en cours continuent (point douteux 3).
3. *Page d'un exercice* : réglages généraux (titre, grandeurs, matières et groupes permis — tout coché
   = aucune restriction —, proposé à l'accueil), puis un volet repliable par copie avec le formulaire
   complet, Dupliquer dans l'exercice, Monter, Descendre, Retirer ; Ajouter depuis la banque (outils
   non archivés) ou depuis un autre exercice (son brouillon, chargé à la demande). Photo choisie parmi
   `site/img/outils/` (liste `index.json`, vérifiée par un test contre le dossier). Gabarit en lecture
   seule avec l'exemple composé et ses jetons. Dimensions et barres en zone de texte, une par ligne
   « libellé ; valeur » (aller-retour testé sur les 29 outils, filetages compris).
4. *Banque* : mêmes formulaires ; créer (un outil de départ à compléter), dupliquer, modifier,
   archiver ; « Exercices qui en ont une copie » depuis `origine` des brouillons. Modifier ou archiver
   un outil de la banque ne change ni un brouillon ni une version, et l'inverse (testé).
5. *Validation continue* : `toolErrors` (le `validateData` du catalogue, outil par outil, avec le champ
   en cause) et `draftErrors` (l'exercice), partagés par le navigateur et le serveur. À la frappe,
   l'erreur remplace la note sous le champ, le volet dit « 1 erreur », **Publier** devient « Publier
   (1 erreur à corriger) » et se désactive ; le serveur refuse aussi (400, erreurs jointes). Un
   brouillon en erreur s'enregistre. **Contrôle optimiste** (D48) : `revision` sur le brouillon et sur
   l'outil de banque ; deux appareils, le second enregistrement reçoit 409 « enregistré ailleurs
   depuis ton ouverture… recharge la page », rien n'est écrasé, rien au journal (testé, et vu dans
   Chrome). Publier et renommer avec une révision périmée : 409 aussi.
6. *Publier* : après l'enregistrement, un panneau doré résume les différences avec la version
   précédente — réglages, outils ajoutés, retirés, modifiés champ par champ, ordre — puis « Publier la
   version n ». Vu dans Chrome : « Titre : « … » → « … (v2) » », « Outil ajouté : Alésoir (alesoir),
   1 réussite de suite ».
7. *Aperçu* : dix questions du brouillon **tel qu'il est à l'écran** (même non enregistré) ou d'une
   version, avec la nomenclature composée, la matière, le matériau et les réponses attendues des
   grandeurs évaluées ; « Dix autres ». Rien en base, rien au journal (testé). Derrière la clé admin
   seulement : ce n'est pas le mode test.
8. *Sauvegarde* : export JSON complet (`format` « quiz-parametres-coupe/editeur/1 », sans aucune donnée
   d'étudiant, testé) ; import validé d'abord (résumé : tables et exercices ajoutés, brouillons
   remplacés, versions ajoutées, exercices gardés) puis appliqué sur le mot IMPORTER, en un seul lot.
   **Fusion** : rien n'est jamais supprimé, une version différente sous un numéro existant est
   refusée, un contenu invalide aussi. Aller-retour export → import → export identique, séances et
   attestations intactes (testé, `npm test` et `test:api`).
9. *Interface* : univers « exercice », en-tête « Éditeur des exercices », pied avec le département sur
   trois lignes et TGM-TMI ; onglets Exercices / Banque d'outils / Sauvegarde ; grilles de champs à
   trois colonnes qui passent à une à 390 px ; lien « Éditeur des exercices » dans l'espace
   professeur pour le rôle admin. UI §3.9.

## C. Documents, tests, livraison

- DECISIONS D47 à D49 ; SPEC v0.8 (§2, §3, §7 : séance épinglée, tables, données lues, API — deux
  routes publiques et les 17 de l'éditeur —, codes 400 et 409 ; §8 ; §9 ; §10 : « Exercice enregistré »,
  `groupes`, liste composée par le serveur) ; UI §3.1, §3.8, **§3.9**, §8 ; PLAN (7a livré, **7b décrit**) ;
  CLAUDE.md (source des données, structure, règles) ; DEMARRAGE §5 (la migration s'applique seule) et §7
  (l'éditeur ; sauvegarde par export, restauration par import).
- Tests ajoutés (38) : `tests/semence.test.js` (migration 0005 sur données réelles, semence identique aux
  JSON, mêmes questions qu'avant pour les deux M10), `tests/worker-editeur.test.js` (15 : accès, journal,
  liste, ouverture, enregistrement, conflit, copies indépendantes, banque, ajout et publication, publication
  bloquée, aperçu, export-import, fusion, tables, **exports du module d'entrée**), `tests/editeur.test.js`
  (règles pures), `tests/ui-editeur.test.js` (règles d'affichage, manifeste des photos) ; `worker-api.test.js`
  adapté (séance épinglée, séance sans version, exercice archivé, `/api/exercice(s)`, figée par publication).
  `test:api` : étapes 21 à 24.
- **Chrome** (wrangler jetable, `MODE_TEST:1`, `CADENCE_S:1`) : accueil (liste, M10 « version 1 ») ;
  éditeur — connexion, clé de consultation refusée, liste (1280, 390), page du M10, erreur en direct sous
  `fact_vc` avec Publier désactivé (1280, 390), alésoir ajouté depuis la banque, aperçu, confirmation de
  publication, version 2 publiée ; quiz — Camille reprend sur la version 1 (9 outils, ancien titre), Alex
  commence sur la 2 (10 outils) et fait corriger une question ; liste après publication et duplication ;
  banque et fiche du MVLNR (1280, 390) ; sauvegarde : export, import validé et appliqué (1280, 390) ;
  espace professeur avec le lien. Les captures sont celles de la fenêtre (900 px de haut), pas de la page
  entière.

## D. Déploiement : la migration D1 en production (C.4)

**Rien à taper.** `deploy.yml` fait, à chaque push sur `main`, dans cet ordre : `npm test` →
`wrangler d1 migrations apply quiz-parametres-coupe --remote` (la `0005` : création des quatre tables,
semence, `seances.version_id` posé pour les séances existantes) → `wrangler deploy`. Le jeton d'API a
déjà le droit D1 : Edit (jalon 3). Entre la migration et le déploiement (quelques secondes), l'ancien
Worker continue sur les JSON de `site/` ; il ignore les nouvelles tables et la colonne ajoutée ; une
séance créée à ce moment-là (sans version) est épinglée à la dernière version publiée à sa première
requête sur le nouveau Worker. Après la fusion : ouvrir `…/prof/editeur`, vérifier que les deux M10
sont « À jour » en version 1 et que `…/?exercice=m10-tournage-vc` affiche « version 1 », puis faire un
premier **export** (Sauvegarde) et le ranger hors du dépôt. Si l'on voulait appliquer la migration
avant la fusion : `npx wrangler d1 migrations apply quiz-parametres-coupe --remote` depuis la branche,
puis pousser ; c'est inutile, et l'ordre inverse (déployer avant de migrer) est impossible avec
`deploy.yml` tel quel.

## Commits (branche `jalon-7a-editeur`, dans l'ordre)

1. Migration 0005 : banque d'outils, exercices avec copies d'outils, versions publiées et tables de référence en D1, semées depuis les JSON (D47)
2. Le serveur et le navigateur lisent l'exercice dans D1 : version épinglée à la séance, GET /api/exercice et /api/exercices, routes de l'éditeur (D47 à D49)
3. API de l'éditeur testée : rôle consultation refusé sur chaque route, actions au journal, conflit d'enregistrement, publication bloquée par une erreur, copies indépendantes de la banque, aperçu, export et import
4. Éditeur des exercices et de la banque d'outils : /prof/editeur, rôle admin (D47 à D49)
5. test:api étendu à l'éditeur
6. Docs du jalon 7a : D47 à D49, SPEC (v0.8), UI (§3.9), PLAN (7a livré, 7b décrit), CLAUDE.md, DEMARRAGE
7. Rapport de session

## Points douteux, à trancher

1. **`test-complet` n'est pas semé** : la demande dit « les deux exercices M10 » ; `test-complet` n'est
   plus qu'un fichier de test (publié à la volée par les tests). En production, `?exercice=test-complet`
   répondra « n'existe pas » après la fusion. S'il doit rester joignable, le créer dans l'éditeur (dupliquer
   un M10 et y ajouter tous les outils), ou me demander de l'ajouter à la semence d'une migration 0006.
2. **La version d'un exercice est son numéro** (« 1 ») ; les attestations émises jusqu'ici disent
   « r0 » et restent telles quelles ; une séance commencée avant la fusion et réussie après dira « 1 »
   (même contenu). Le champ `version` du fichier d'exercice n'est plus lu que par les tests.
3. **Exercice archivé** : j'ai retenu « plus de nouvelle séance, plus dans la liste ; les séances en
   cours continuent, les attestations restent vérifiables ». L'autre lecture (« retiré de l'accès
   étudiant » = plus rien du tout) coupe un étudiant au milieu de son exercice.
4. **Renommer** change le titre du **brouillon** (l'identifiant d'URL est définitif : les liens sur Léa) ;
   les étudiants ne voient le nouveau titre qu'après publication. La liste le dit.
5. **Publier sans différence** est permis (une version identique de plus) ; le bouton l'annonce
   (« Publier (aucune différence) »). Refuser serait aussi défendable.
6. **L'import remplace la banque entière** (suppression puis insertion) : les révisions des outils
   repartent à 1 ; un formulaire de banque ouvert pendant l'import recevra 409 à l'enregistrement — c'est
   voulu (rien n'est écrasé), mais surprenant. Les exercices absents de l'export sont gardés ; les
   versions ne sont jamais retirées : pour « revenir en arrière » sur une version publiée par erreur,
   il faut publier une version suivante (les versions sont immuables, D47).
7. **`limite_avance`** est éditable dans le formulaire alors que le moteur ne l'utilise pas (SPEC §3) ;
   je l'ai laissée, marquée « non utilisée », pour ne pas perdre la donnée du classeur.
8. **Ordre de la liste des exercices** : par date de création ; les deux M10 semés portent la date de
   la semence (2026-09-24 12:00 UTC), un exercice créé ensuite vient après. Dans les tests, l'horloge
   fictive (2026-09-21) est antérieure à la semence : les tests trient avant de comparer.
9. **Photos** : `image` d'une copie nomme un fichier de `site/img/outils/` ; le jalon 7b devra décider
   où stocker les téléversements (D1 en blob, ou R2) et comment `image` s'y réfère. La liste
   `index.json` est faite à la main (test contre le dossier) ; une photo ajoutée au dépôt doit y être
   inscrite.
10. **Tables de référence** : une seule version, « A2026_r0 » ; une publication prend toujours la plus
    récente (`creee_le` puis `id`). Le brouillon ne choisit pas encore sa version de tables (7b).
11. **Le dossier `site/prof/`** cohabite avec `site/prof.html` : `/prof` sert toujours la page de
    l'espace professeur (vérifié par `test:api`) et `/prof/editeur` la nouvelle. Les chemins de
    l'éditeur sont absolus (`/css/…`, `/img/…`).
12. **Corps des requêtes de l'éditeur** : jusqu'à 4 Mo (un import porte toute la sauvegarde) ; une
    version fait aujourd'hui 15 à 35 Ko, la limite D1 par ligne est de 2 Mo.
13. **Le Workers runtime refuse tout export non fonction du module d'entrée** — découvert au premier
    `wrangler dev` de la passe Chrome (les tests Node ne le voient pas) ; corrigé, et un test vérifie
    désormais que `worker/index.js` n'exporte que des fonctions et le gestionnaire.
14. **Choix visuels non maquettés** : volets repliables par outil, cases à cocher pour grandeurs, matières
    et groupes, dimensions en zone de texte, panneau doré de confirmation, tableau d'aperçu.

## Suites données (réponses de Thierry, D50)

Trois commits de plus sur la branche. `npm test` : 494 tests, `fail 0` ; `test:api` : 25 étapes ;
Chrome : la confirmation d'import avec disparitions vérifiée (5 vérifications, 2 captures de plus).

1. *Points 1, 3, 4 et 6 acceptés tels quels.* DEMARRAGE §7 dit comment changer l'adresse d'un
   exercice : le dupliquer sous le nouvel identifiant, publier la copie, donner le nouveau lien, archiver l'ancien.
2. *Point 2 accepté* ; en plus, l'attestation affiche **« version 1 »** (`exerciseVersionLabel`,
   `attestation-data.js`) et « A2026_r0 » comme révision des tables, et `/verifier` montre les deux
   (même `attestationFacts`). L'enregistrement figé n'est pas touché (`revision: "1"`), et une
   attestation d'avant (« r0 ») s'affiche telle quelle. Tests : le libellé, et l'enregistrement d'une
   séance réussie sur D1 porte bien `revision "1"` et `revision_tables A2026_r0`.
3. *Point 5* : la validation d'un import résume la banque outil par outil — `resume.banque =
   { ajoutes, modifies, retires, gardes }`, par nom — ; la page l'affiche (« DISPARAÎTRAIENT : Alésoir
   (alesoir), MVLNR (mvlnr) ») et, s'il y a des disparitions, le bouton devient « Importer et
   remplacer la banque » et la confirmation exige **REMPLACER** ; le **serveur l'exige aussi** (400
   « Pour importer, la requête doit porter le mot REMPLACER — 2 outil(s) de la banque
   disparaîtraient : Alésoir, MVLNR. ») et REMPLACER ne vaut pas quand rien ne disparaît. Tests :
   `importPlan` et `importWord`, `importSummaryLines`, le même mot des deux côtés, l'API (validation
   nommée, IMPORTER refusé, REMPLACER accepté, copies des exercices intactes, journal).
4. Les huit autres points restent ouverts, en attendant les réponses.

Commits : 8. DEMARRAGE (changer l'adresse d'un exercice) ; 9. attestation « version 1 » et révision des
tables ; 10. import avec les outils de la banque nommés et REMPLACER ; 11. docs (D50, SPEC, UI,
DEMARRAGE) et rapport.

## Suites données, deuxième partie (réponses aux huit points ouverts, D51)

Quatre commits de plus, branche poussée. `npm test` : 495 tests, `fail 0` ; `test:api` : 25 étapes ;
Chrome : Monter / Descendre dans la liste, l'accueil qui suit, « Aucune différence à publier »
(5 vérifications, 2 captures de plus).

1. *Point 5* : une version identique à la précédente ne se publie pas. Le bouton se désactive avec
   « Aucune différence à publier » (`publishState`) et le serveur refuse (400, comparaison
   structurelle `sameContent` : ni l'ordre des clés ni un commentaire « _… » ne font une différence).
   Testé : rien de créé, rien au journal. D49 corrigée par D51.
2. *Point 8* : **ordre manuel des exercices**. Migration `0006` : colonne `rang`, les deux M10 semés en
   1 et 2 ; un exercice créé, dupliqué ou importé prend le dernier rang, un exercice remplacé par un
   import garde le sien. Route `POST /api/prof/editeur/exercice/deplacer` (`{ id, rang, direction }`) :
   les rangs sont réécrits 1 à n en un lot, journalisés (`editeur_deplacement`, « id · rang 3 → 2 »),
   avec un contrôle optimiste sur le rang que l'écran a vu (409 sinon, rien ne bouge ; 400 en tête ou
   en queue). `GET /api/exercices` (l'accueil) suit le même ordre. Dans la liste : colonne Rang, boutons
   ↑ ↓ désactivés aux bords. Testé par l'API et dans Chrome ; l'export porte le rang et un export
   réimporté garde l'ordre ; le test de migration sur données réelles applique aussi la 0006.
3. *Point 7* : `limite_avance` inchangée, marquée « non utilisée » ; à trancher avec les exercices d'avances (PLAN 7b).
4. *Points 9 et 10* : inscrits dans la description du 7b — images téléversées stockées dans D1 en blob
   (pas R2, carte de crédit), réduites dans le navigateur avant l'envoi, manifeste `index.json`
   remplacé ; le brouillon choisira sa version des tables.
5. *Points 11 à 14* : acceptés tels quels.
6. CLAUDE.md : à la fin d'une session, pousser la branche de travail, jamais `main`.

Commits : 12. publication identique refusée ; 13. rang des exercices (migration 0006) ; 14. docs (D51,
SPEC, UI, PLAN, CLAUDE.md) et rapport.

## Retouches (avant la fusion, D52 et D53)

Huit commits de plus, branche poussée. `npm test` : 510 tests, `fail 0` ; `test:api` : 25 étapes ;
Chrome à 1280 et 390 px : 22 vérifications, 10 captures de plus (`27` à `36` dans
`captures/jalon-7a/`), aucune requête externe, aucune exception.

1. **Aucun numéro de décision dans les textes visibles.** Trois libellés de l'éditeur en portaient
   (les barres à deux diamètres, les réussites de suite, la matière d'outil de l'exercice) ; corrigés. Le test
   `tests/textes-visibles.test.js` cherche « D » suivi d'un à trois chiffres dans toutes les chaînes
   des fichiers de `site/js`, `site/js/ui`, `worker` et des pages HTML (commentaires exclus) : un
   « D19 » dans un texte affiché le ferait échouer. Chrome : l'écran Question, l'éditeur, /prof et
   /verifier n'affichent aucun « Dnn ».
2. **Pastilles de couleur.** Chaque groupe porte une pastille avec la lettre ISO sur la couleur de
   sa classe, chaque matière d'outil une pastille de sa couleur. **Les couleurs viennent de
   `site/css/tokens.css`**, celles des feuilles de référence et des pastilles du quiz (`--iso-p`,
   `--iso-m`… ; `--tool-acier-rapide`, `--tool-carbure-solide`, `--tool-insert-carbure`) : rien n'a
   été pris dans le classeur ni inventé. Une seule nuance : le K prend `--iso-k-night`, le rouge K
   éclairci pour le fond nuit (celui du panneau du matériau brut dans le quiz, contraste AA), plutôt
   que le rouge pur des feuilles. **Tout cocher / Tout décocher** sous les matières et sous les groupes, dans les
   réglages de l'exercice comme dans le formulaire d'outil (`groupSwatch`, `materialSwatch`,
   testés).
3. **Liste des outils d'un exercice.** Une ligne par copie, repliée : case à cocher, vignette de la
   photo, nom, opération, réussites, erreurs ; Dupliquer, ↑, ↓, Retirer accessibles sans déplier ;
   Tout cocher et Retirer la sélection avec une confirmation qui nomme les outils
   (`removeSelectionConfirmation`, testée). Toujours un changement du brouillon seulement. Chrome :
   neuf outils après une duplication, sept après un retrait de sélection de deux.
4. **Formulaire d'outil par thèmes** : Identification, Nomenclature, Dimensions, Dents (min et max
   côte à côte), Facteurs, Limites (RPM max, Limite d'avance « non utilisée »), Matières et groupes
   permis, Exercice (réussites de suite, copie seulement). Même formulaire dans la banque. À 390 px,
   chaque groupe passe à une colonne.
5. **Lecture des filetages.** Pour un outil dont l'opération est de la famille filetage, une liste
   « Lecture par le moteur » à droite des dimensions donne, par ligne, le Ø et le pas tels que le
   moteur les lit (pouces ; et mm en métrique), ou l'erreur de lecture en rouge
   (`dimensionReadings`, testée : 1/4-20 UNC, M10 x 1.50, une ligne illisible, et un outil hors
   filetage).
   Elle se rafraîchit à la frappe.
6. **Trois états par grandeur (D52).** Chaque grandeur (Vc, fz, N, f, Vf) est évaluée, fournie ou
   masquée, en boutons radio dans les réglages ; au moins une évaluée. Une grandeur masquée s'écrit
   « — » dans l'écran Question, sans valeur ni champ, note « non demandée » ; **sa valeur ne figure
   nulle part dans les réponses de l'API** (question : `texte` vide et `masque: true` ; correction :
   `attendu` nul, « — » dans les calculs en une ligne). Pour la correction, elle est traitée comme
   fournie : sa valeur théorique entre dans la cohérence de Vf (SPEC §6). Format : clé facultative
   `champs_masques`, disjointe de `champs_evalues` ; les deux M10 n'en ont pas et leur correction
   est inchangée (test). L'export la porte, l'aperçu montre l'état de chaque grandeur dans l'en-tête
   et « — » pour une masquée, la liste des différences à la publication compare les états. Tests :
   aucune valeur masquée dans les réponses de l'API d'une séance (question, correction, réussite),
   anomalies du schéma, écran Question.
7. Chrome, captures et cette section ; UI §3.9 décrit les lignes d'outils, le formulaire par thèmes
   et la lecture des filetages.
8. **Vf en filetage à ±0,01 % (D53).** `FEED_RATE_TOLERANCES` par famille dans `correction.js` :
   filetage 0,01 %, avance fixe et proportionnelle 0,5 % ; la plage (N ± demi-unité) × (f ±
   demi-unité) et la demi-unité de Vf restent appliquées ; la ligne de correction dit « ±0.01 % de
   N × f ». Les quatre tests demandés sur le taraud M10 x 1.50 (N = 1000 plafonné, f affiché
   0.05906, Vf 59.055) : Vf sur le pas exact acceptée, Vf sur le pas arrondi (59.06) acceptée, Vf
   décalée de 0,1 % (59.119) refusée alors que ±0,5 % l'acceptait, Vf cohérente avec N = 1002
   acceptée pour Vf et refusée pour N. Les cas limites existants du filetage (D15) recalculés ;
   les autres familles gardent ±0,5 % (test). SPEC §6 (tableau et précisions), DECISIONS.

9. **Grandeurs déductibles (D54).** Sous les états, un avertissement doré, non bloquant, nomme chaque
   grandeur évaluée ou masquée qui se déduit des grandeurs fournies, avec sa relation : Vc et N (par
   le Ø, le facteur Vc et la limite RPM — « sauf si N est plafonné » dans le sens N → Vc), fz et f (par
   les dents), N, f et Vf (deux fournies donnent la troisième). Seules les grandeurs fournies servent
   de source. Rafraîchi à chaque changement d'état ; repris dans la confirmation de publication ;
   Publier n'en tient pas compte (`deducibleWarnings`, huit cas testés, `publishState` inchangé).
   Chrome (7 vérifications, captures 37 à 39) : le M10 « vitesse de coupe » avertit « Vc se déduit
   de N fourni », N évaluée change l'avertissement en « N se déduit de f et Vf », f masquée en « f se
   déduit de fz », la confirmation de publication le reprend et le bouton reste actif.

Points douteux :

- **Les deux M10 semés portent un avertissement** (Vc se déduit de N ; N se déduit de f et Vf) : c'est
  la conséquence voulue de la règle, à toi de juger si leurs états restent ceux-là.
- **Lecture des filetages** affichée seulement pour la famille filetage : pour les autres outils,
  une valeur illisible est déjà signalée par l'erreur sous le champ, sans liste à droite.
- **Couleur du K** : `--iso-k-night` (le rouge éclairci du panneau du matériau brut) plutôt que
  `--iso-k` (le rouge pur des feuilles), pour le contraste sur le fond nuit de l'éditeur ; à confirmer.
- Les retraits par sélection ne demandent qu'une confirmation, sans annulation : la page reste
  modifiée et non enregistrée jusqu'à Enregistrer le brouillon, on peut donc recharger la page pour
  tout reprendre.

Commits : 15. textes visibles ; 16. pastilles ; 17. lignes d'outils ; 18. formulaire par thèmes ;
19. lecture des filetages ; 20. trois états (D52) ; 21. Vf en filetage (D53) ; 22. UI et rapport ;
23. grandeurs déductibles (D54) ; 24. ses docs et captures.

## Reste

Relire D47 à D54, les migrations `0005` (générée) et `0006`, UI §3.9 ; fusionner ; après le
déploiement (les deux migrations s'appliquent seules, section D), vérifier l'éditeur en production et
faire le premier export. Le jalon 7b est décrit dans `PLAN.md`.
