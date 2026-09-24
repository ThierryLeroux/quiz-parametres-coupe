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

## Reste

Relire D47 à D49, la migration `0005` (générée) et UI §3.9 ; fusionner ; après le déploiement, vérifier
l'éditeur en production et faire le premier export (section D). Le jalon 7b est décrit dans `PLAN.md`.
