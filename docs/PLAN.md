# Feuille de route

Chaque jalon est découpé en tâches assez petites pour une session Claude Code
(une tâche = une branche ou un commit cohérent, testé). Cocher au fur et à mesure.

## Jalon 0 — Dépôt en place
- [x] Dépôt GitHub créé, squelette commité
- [ ] Publication sur Cloudflare en place (décision D20 ; `DEMARRAGE.md`, étape 4) : compte, sous-domaine `workers.dev`, deux secrets GitHub, GitHub Pages désactivé
- [x] VS Code + extension Claude Code opérationnels ; `CLAUDE.md` lu par Claude Code
- [x] `npm test` (tests vides) passe

## Jalon 1 — Moteur de calcul et de correction (aucune interface)
- [x] `site/js/data.js` : chargement et validation des 3 JSON
- [x] `site/js/question.js` : génération d'une question (SPEC §4), aléa injectable pour les tests
- [x] `site/js/calcul.js` : Vc, N, fz, f, Vf (SPEC §5) ; `site/js/format.js` : arrondis d'affichage
- [x] `site/js/correction.js` : tolérances par champ (SPEC §6)
- [x] Tests unitaires : cas de référence calculés à la main depuis les JSON
      (au moins un par famille : fixe, proportionnelle, filetage impérial, filetage métrique, limite RPM)
- [x] Concilier les arrondis d'affichage (SPEC §5) et les tolérances (SPEC §6), décisions D13 à D15 :
      `tests/chaine.test.js` passe pour toutes les combinaisons du catalogue

## Jalon 1b — Modèle d'exercice et progression (décisions D11, D12)
- [x] `reussites_requises` sort d'`outils.json` ; `site/exercices/m10-tournage-vc.json` (SPEC §10)
- [x] `site/js/exercice.js` : validation et chargement d'un exercice
- [x] `site/js/progression.js` : réussites consécutives, outils admissibles, exercice complété (SPEC §7)

## Jalon 2 — Interface du quiz : socle, accueil, identification
Plomberie d'abord (aucun HTML ni CSS), écrans ensuite, après une maquette approuvée.
Depuis D19, l'état de séance vit sur le serveur : le navigateur affiche.

- [x] `site/exercices/index.json` : exercices offerts, avec sa validation (`exercice.js`)
- [x] `site/js/app.js` : choix de l'exercice (`?exercice=<id>`, sans repli : D18) — le cycle d'une séance, d'abord écrit ici, est passé au serveur (`worker/seance.js`, jalon 3)
- [x] Maquette des écrans, approuvée par Thierry (`docs/UI.md`, `docs/maquettes/`, décision D17)
- [x] `site/css/tokens.css`, `base.css` : langage visuel et composants de base (UI §1, §4, §6) ; polices auto-hébergées dans `site/fonts/`
- [x] Hébergement (D20) : `wrangler.jsonc`, `worker/index.js` minimal (`GET /api/version` ; 501 ailleurs sous `/api/`), `npm run dev`, `deploy.yml`
- [x] `site/js/session.js` : le navigateur ne garde que `{ matricule, prenom, jeton }` (D19) ; `site/js/identification.js` : prénom, nom, matricule, NIP
- [x] `site/js/api.js` : appels au serveur de correction
- [x] `site/index.html` + `site/js/ui/` : écrans Accueil et Identification (UI §3.1, §3.2) selon D19 et D21

## Jalon 3 — Serveur de correction (décisions D19 à D22)
Le moteur (jalons 1 et 1b) passe derrière l'API ; les règles d'une séance sont dans `worker/seance.js` ; chaque route a ses tests.

- [x] Les cinq points ❓ de `SPEC.md` §7 tranchés (D21) ; base, secrets, cryptographie et source des données décidés (D22)
- [x] Base **D1** : liaison `DB` dans `wrangler.jsonc`, `migrations/0001_initial.sql` (tables `seances` et `corrections`), migrations locales par `npm run dev`, de production par `deploy.yml` avant le déploiement
- [x] `worker/crypto.js` : sous-clés HKDF de `CLE_SECRETE`, NIP en HMAC-SHA-256, jeton de 32 octets stocké haché
- [x] `worker/seance.js` : tirage, correction, compteurs, cadence, essais de NIP, exercice modifié en cours de session, vues envoyées au navigateur — fonctions pures ; le cycle quitte `app.js`
- [x] `POST /api/identification` : création ou reprise par (exercice, matricule) ; 401 NIP incorrect ; 5 essais en 10 minutes → 429 pendant 10 minutes ; jeton de 2 h prolongé à chaque appel ; prénom et nom de la première visite
- [x] `GET /api/seance`, `POST /api/question` : état de la séance ; question tirée par le serveur, mémorisée, jamais reprise du client
- [x] `POST /api/correction` : correction de la question mémorisée, **cadence** de 10 s (429), compteurs, **journal horodaté**, question suivante ou réussite (date et version de l'exercice)
- [x] `POST /api/deconnexion` : « Changer d'étudiant » invalide le jeton
- [x] Données lues par `ASSETS` (`worker/catalogue.js`) : `site/data/` et `site/exercices/` restent la seule source
- [x] Client : `api.js` sur le vrai serveur ; identification et reprise fonctionnelles ; écran Question en gabarit **fonctionnel** (outil, matériau, cinq champs, Vérifier, résultat, progression) ; écran minimal « Exercice réussi »
- [x] Tests : `npm test` (vrai Worker sur SQLite en mémoire, horloge réglable) ; `npm run test:api` (HTTP sur `wrangler dev` et une vraie D1 locale) ; cycle complet vérifié dans Chrome à 1280 px et 390 px, reprise dans un second navigateur
- [x] Secrets du serveur : `CLE_SECRETE`, `CLE_ADMIN` par `wrangler secret put` ; `.dev.vars` en local ; mode d'emploi dans `DEMARRAGE.md`, étape 5
- [ ] **À faire par Thierry avant de pousser** : donner le droit **D1 : Edit** au jeton d'API de GitHub (`DEMARRAGE.md`, étape 5.5), sinon les migrations échouent et rien n'est publié

## Jalon 4 — Identification en deux temps (D23), écran Question et tables de référence selon UI.md
- [x] D23 : consultation, création, reprise (le serveur ne devine plus), « Corriger mon identité » avec NIP exigé, séance déplacée jamais copiée, corrections d'identité journalisées (migration `0002`) ; écrans 1 / 2 et 2 / 2
- [x] Écran Question (UI §3.3) : grille deux tiers / un tiers, panneaux de l'outil et du matériau aux couleurs de sens, photo de l'outil, pictogrammes des champs et de l'opération, aide contextuelle au clic ; saisie : `inputmode="decimal"`, point ou virgule, Entrée = Vérifier, focus sur le premier champ
- [x] Question corrigée (UI §3.4) : explication de l'écart et de la tolérance, calcul en une ligne, outil « remis à zéro » en rouge — le serveur donne `tolerance`, `ecart_pct` et `calcul` avec la correction
- [x] Progression par outil (UI §3.3) : un point par réussite consécutive, outil en cours surligné ; outils de même nom distingués par l'unité, sinon par la plage de dimensions (`site/js/ui/rules.js`)
- [x] Tables de référence (UI §3.5) : vitesses de coupe, avances (générée depuis `operations.json`), formules ; ouvertes par-dessus la question sans perdre la saisie, défilement dans leur propre cadre, impression de la feuille seule
- [x] Images d'outils (`site/img/outils/`) et pictogrammes (`site/img/pictos/`) affichés
- [x] Pictogrammes d'opérations en SVG : les dix-neuf dessins DrawingML du classeur, convertis sans redessin (`reference/pictogrammes-du-classeur/convertir.mjs`, D29) — planche-contact à valider par Thierry (`captures/jalon-4/planche-pictogrammes.png`)
- [x] Corrections après le premier essai de Thierry (D24 à D29) : gabarit de nomenclature validé et jetons `[Dia]`, `[Pas]`, `[IdBarre]` ; **deux diamètres de la barre à aléser** ; feuilles comme le classeur (traits de famille `debut_famille`, bande grise des avances proportionnelles, révision des tables au pied, formule exacte de N à titre indicatif, colonnes figées sur téléphone) ; département sur trois lignes et « TGM-TMI » ; rouge K éclairci sur fond nuit
- [x] **Mode test** local (D26 : `MODE_TEST=1` dans `.dev.vars`, décidé par le serveur, jamais en production) et exercice `test-complet` (tous les outils, les cinq grandeurs)
- [x] Écran « Exercice réussi » : « Voir mon attestation » → attestation **provisoire, non signée** (la version signée : jalon 5, en tête)
- [x] Second rapport (D30) : barres confirmées ; N tolérée à ±5 % et ±1 rév/min (D13) ; **barre à rainurer** à deux diamètres (D25) ; `"liste": false` pour les exercices d'essai ; note des avances sur la bande (maquette `05b`) ; pied « TGM-TMI — TLP — 2026 » ; coquille « Ø 45/64 po » ; classeur renommé ; attestation provisoire avec bannière et **liste des opérations effectuées** (servie par le serveur : `operation`, `plage`)
- [x] Attente imposée par la cadence montrée à l'écran : compte à rebours sur le bouton Vérifier (`seance.attendre_s`, ou celui d'un refus 429), à la place du message
- [x] Sur téléphone, les outils terminés de la progression sont repliés sous « n outils terminés » (UI §3.3)
- [x] Impression des feuilles vérifiée sur papier par Thierry (2026-09-21)

## Jalon 5 — Attestation signée, vérification publique, espace professeur, limites de débit (décisions D31 à D36)
Rapport de session : `docs/rapports/jalon-5-attestation.md`.

- [x] Migration `0003` : `attestations`, `journal_enseignant`, `debit`, `verrous`
- [x] **Enregistrement figé** à la réussite (D31 ; `worker/attestation.js`), reconstitué à la première ouverture pour les séances réussies avant cette version ; `GET /api/attestation`
- [x] **Code court** sans ambiguïté et **signature** HMAC sur la sérialisation canonique (D32) ; comparaisons en temps constant
- [x] **Page de l'attestation** (UI §3.6) : page lettre, tableau des opérations, QR (bibliothèque `qrcode-generator` 2.0.4 vendorisée, rendu SVG), « Enregistrer en PDF » par l'impression du navigateur ; remplace l'écran provisoire
- [x] **QR** = adresse de vérification absolue avec l'essentiel en clair puis la signature (D33)
- [x] **`/verifier`** public : par l'adresse du QR ou par le code ; valide / annulée / aucune / invalide (`POST /api/verification`)
- [x] **`/prof`** (D34) : connexion par `CLE_ADMIN` (temps constant, cookie signé 12 h, cinq essais par adresse puis délai croissant, journalisés), tableau des séances (filtre, tri, recherche), export CSV, **remise à zéro** avec annulation de l'attestation (D35), journal des corrections d'identité ; aucune route `/api/prof/*` sans cookie
- [x] **Limites de débit** (D36) : 100 matricules ou codes distincts par adresse et par heure, compteurs en D1, verrou de 10 minutes après refus
- [x] Tests : signature et vérification (valide, falsifiée, inconnue, annulée), figeage et reconstitution, CSV, connexion (temps constant, verrou), routes sans cookie, remise à zéro, limites ; `test:api` étendu au cycle complet ; Chrome à 1280 et 390 px, média print (une page lettre), captures dans `captures/jalon-5/`
- [x] Réponses au rapport (D37 à D39) : « Corriger mon identité » sur la page de l'attestation, qui annule et réémet l'attestation ; **réinitialisation du NIP** depuis le tableau des séances ; révision des tables dans l'attestation ; cadence réglable en local (`CADENCE_S`) pour `test:api`
- [x] **Suppression d'une séance** (farce visible aux horodatages) et **purge de fin de session** — depuis l'espace professeur : faits au jalon 6 (D45, D46)
- ~~Une clé par enseignant et la table des enseignants, avec une table des séances professeur pour révoquer une séance ; le mode test ouvert au professeur connecté~~ — abandonné (D55) : Thierry est le seul auteur, les collègues ont la clé de consultation (D44), et l'aperçu de l'éditeur (D49) remplace le mode test pour le professeur.
- [ ] Essai avec un groupe d'étudiants ; correctifs
- ~~Page de vérification : durée totale, temps médian, corrections d'identité~~ — abandonné (D33 : rien de plus que l'attestation imprimée ; les corrections d'identité sont dans l'espace professeur)

## Après le jalon 5 — exercice « Vc et RPM » et liste des questions sur l'attestation (décisions D40 à D43)
Rapport de session : `docs/rapports/exercice-vc-rpm.md`.

- [x] Restriction de matière d'outil pour tout l'exercice (`materiaux_outil` à la racine, D40) : validée au chargement, un outil sans matière permise refusé avec un message clair
- [x] Exercice `m10-tournage-vc-rpm` : Vc et N, onze outils, acier rapide ou insert seulement, deux réussites de suite (22 questions), listé à l'accueil ; tolérance de N en filetage et barre à aléser vérifiées dans cet exercice
- [x] **Liste des questions réussies qui comptent** dans l'enregistrement signé (D41), composée depuis le journal ; page de l'attestation sur une ou deux pages (QR en première page, en-tête répété, « Page n de N ») ; `/verifier` montre la liste complète ; les attestations déjà figées restent telles quelles
- [x] Réémission : un code déjà pris est retiré (D42) ; aléa des codes injectable dans les tests
- [x] Tests : restriction de matière, exercice complet en mode test, attestation avec liste et signature, deux pages, réémission, collision de code ; `test:api` étendu à l'exercice ; Chrome à 1280 et 390 px, média print (PDF de deux pages), captures dans `captures/exercice-vc-rpm/`, aucune requête externe
- [x] Réponses au rapport (D43) : numéro 1 à n, titre « M10 — Tournage : Vc et RPM », repli sans troncature avec pagination par rang, constantes et police consignées dans UI §3.6, réponses normalisées au figeage

## Jalon 6 — Exploitation : clé de consultation, suppression, effacement (décisions D44 à D46)
Rapport de session : `docs/rapports/jalon-6-exploitation.md`.

- [x] **Clé de consultation partagée** (D44) : `CLE_CONSULTATION`, secret du Worker ; `/prof` accepte l'une ou l'autre clé ; le cookie porte le rôle (`admin` ou `consultation`), le journal des actions le note ; mêmes verrous d'essais et de délai
- [x] **Rôle consultation, lecture seule** : tableau (filtre, tri, recherche), export CSV, journal des corrections d'identité ; aucun bouton d'action, et chaque route d'action refuse ce rôle côté serveur (403)
- [x] `DEMARRAGE.md` §7 : créer la clé, la remettre, la remplacer si elle circule trop (`wrangler secret put`, sans push)
- [x] **Suppression d'une séance** (D45, migration `0004`) : rôle admin, bouton par ligne, confirmation avec le nom et le matricule, journalisée ; la séance et son journal disparaissent, ses attestations restent « annulée — séance supprimée », ce que `/verifier` dit avec la date
- [x] **Effacement des données des étudiants** (D46) : page à part de `/prof`, rôle admin, export CSV de tout proposé puis le mot EFFACER exigé (écran et serveur) ; séances, journaux, corrections d'identité et attestations effacés ; journal des actions gardé avec les nombres ; exercices et catalogue jamais touchés
- [x] Tests : rôle consultation refusé sur chaque route d'action, suppression avec attestations annulées, effacement complet avec journal intact, mot de confirmation exigé, migration `0004` sur des attestations existantes ; `test:api` étendu à la connexion en consultation, à la suppression et à l'effacement ; Chrome à 1280 et 390 px pour les deux rôles, captures dans `captures/jalon-6/`, aucune requête externe

## Jalon 7a — Éditeur des exercices et banque d'outils, en production (décisions D47 à D49)
Rapport de session : `docs/rapports/jalon-7a-editeur.md`. Thierry est le seul auteur ; l'éditeur écrit en D1, sans commit ni déploiement.

- [x] **Migration `0005`** : `tables_reference` (une version « A2026_r0 »), `banque_outils`, `exercices` (brouillon, révision), `versions_exercice` (immuables, numérotées) ; `seances.version_id` ; semence générée depuis les JSON du dépôt (`reference/semence-d1/generer.mjs`) : les 29 outils, les deux M10 en version 1 ; les séances existantes épinglées à la version 1 ; un test vérifie que la semence est identique aux JSON, et que les M10 posent les mêmes questions qu'avant pour une même graine
- [x] **Copies d'outils** dans l'exercice (`copyOfTool`, `draftFromExercise`, `engineExercise`, `draftErrors`, `toolErrors` par champ) ; groupes permis pour tout l'exercice
- [x] Le serveur lit la version épinglée à la séance (`worker/catalogue.js`) ; `GET /api/exercice`, `GET /api/exercices` ; le navigateur compose son catalogue à partir de là ; exercice archivé = plus de nouvelle séance
- [x] **Éditeur** `/prof/editeur`, rôle admin, chaque action au journal : liste (état, versions, séances par version, dupliquer, renommer, archiver, supprimer, lien étudiant) ; page d'un exercice (réglages, copies d'outils : ajouter depuis la banque ou un autre exercice, dupliquer, retirer, réordonner, tout modifier sauf le gabarit en lecture seule avec exemple ; photo parmi les images du site) ; validation continue par champ, Publier désactivé tant qu'il reste une erreur ; enregistrement avec contrôle de version optimiste (409) ; publication avec résumé des différences ; aperçu de dix questions ; banque (créer, dupliquer, modifier, archiver, nombre d'exercices qui en ont une copie) ; sauvegarde (export JSON, import validé, fusion sans suppression, mot IMPORTER)
- [x] Tests : migration et semence, séance épinglée, copie indépendante, refus du rôle consultation sur chaque route, conflit d'enregistrement, publication bloquée, aller-retour export-import, `worker/index.js` n'exporte que des fonctions ; `test:api` étendu (25 étapes) ; Chrome à 1280 et 390 px, captures dans `captures/jalon-7a/`, aucune requête externe

## Jalon 7b — Images, gabarits de nomenclature, tables de référence versionnées
Rapport de session : `docs/rapports/jalon-7b-editeur.md`. Deux parties ; la B attend le feu vert de Thierry après la A.
À concevoir sur les tables de `0005` : une nouvelle version des tables = une nouvelle ligne de `tables_reference` (immuable), que les publications suivantes prennent ; **le brouillon d'un exercice choisira sa version de tables** (D51).

**Partie A — images et nomenclature**
- [x] **Téléversement d'images** (D51, D56) : photo d'un outil et pictogramme d'une opération, rôle admin, **stockées dans D1 en blob** — pas dans R2, qui exige une carte de crédit —, **réduites dans le navigateur avant l'envoi** (plus grand côté 800 px pour une photo) ; chaque image a un nom lisible, un type, une taille, une empreinte (un doublon exact n'est pas stocké deux fois) et une date
- [x] **Une seule liste d'images** pour l'éditeur (D56) : les fichiers de `site/img/outils/` et de `site/img/pictos/operations/` **semés dans D1** (migration `0007`), servis par une même route avec des en-têtes de cache (une image ne change jamais sous le même identifiant) ; le manifeste `site/img/outils/index.json` disparaît
- [x] **Archiver ou supprimer** (D56) : une image utilisée par une version publiée s'archive (retirée du choix, toujours servie) ; une image jamais utilisée peut être supprimée
- [x] **SVG assaini** côté serveur (D57) : liste blanche d'éléments et d'attributs, aucun script, gestionnaire d'événement, lien ni ressource externe, ou refusé ; servi avec Content-Type exact, nosniff et une Content-Security-Policy sans script ; tests avec un SVG piégé
- [x] **Choix de l'image** dans le formulaire d'outil : galerie de vignettes avec recherche par nom, « Téléverser » sur place ; le même choix pour le pictogramme d'une opération (partie B)
- [x] **Gabarit de nomenclature éditable** (D24, D58) : champ de texte, boutons qui insèrent les jetons permis pour cet outil, exemple composé en direct et « Autre exemple » ; un jeton inconnu ou sans valeur est une erreur sous le champ (`toolErrors`) qui bloque Publier
- [x] **Export et import avec les images** (D59) : les images font partie de la sauvegarde, envoyées à part, une par requête, pour rester sous la limite ; l'aller-retour reste identique
- [x] Tests, docs (SPEC, UI §3.9, DEMARRAGE), Chrome à 1280 et 390 px, captures dans `captures/jalon-7b/`, rapport de la partie A ; branche poussée
- [x] **`limite_avance`** (D51) : tranchée avec les exercices d'avances (D69) — obsolète, retirée du formulaire, acceptée dans les données

**Partie B — tables de référence versionnées** (décisions D61 à D63)
- [x] Onglet **Tables de référence** : un brouillon unique des tables, modifiable, et des versions publiées immuables, comme les exercices — matériaux usinés (nom, groupe ISO, Vc par matériau d'outil, `debut_famille` D27), groupes ISO (code, nom, couleur), matériaux d'outil (nom, couleur), opérations (famille, avances, pictogramme) ; les couleurs passent dans les tables, semées depuis `tokens.css` ; le quiz et les feuilles les lisent de la version en usage
- [x] Chaque version porte sa **révision** (D28), saisie à la publication, avec une suggestion qui incrémente la dernière (A2026_r0 → A2026_r1), unique ; publication avec validation complète, contrôle optimiste et résumé des différences valeur par valeur
- [x] Le **brouillon d'un exercice choisit sa version de tables** (par défaut la plus récente à sa création) ; quand une plus récente existe, la page le signale, avec un bouton pour y passer qui montre d'abord ce que ça change ; un exercice est validé contre la version qu'il a choisie (un matériau, un groupe ou une matière retirée = une erreur nommée) ; le changement de tables figure dans les différences à la publication
- [x] Une séance utilise toujours les tables de sa version d'exercice : questions, correction, feuilles de référence ; les feuilles ont une vue imprimable par version de tables, accessible depuis l'éditeur ; l'attestation inscrit la révision de ces tables (à vérifier sur une séance en version 2)
- [x] Aperçu d'une version de tables en brouillon : dix questions d'un exercice au choix avec ces tables, sans rien enregistrer
- [x] Export et import couvrent les versions de tables et leur brouillon
- [x] Tests : une séance en cours garde ses tables après la publication d'une nouvelle version ; un exercice passé à la nouvelle version change de questions attendues seulement là où les valeurs ont changé ; une matière retirée devient une erreur sur les exercices qui l'utilisent ; les deux M10 donnent les mêmes questions qu'avant sur A2026_r0 ; docs (DECISIONS, SPEC, UI, PLAN, DEMARRAGE), Chrome à 1280 et 390 px, captures, rapport complété

## Après le jalon 7b — images de chaleur et de forme de copeaux par classe ISO (décision D64)
Rapport de session : `docs/rapports/images-copeaux.md`.

- [x] **Détourage** des douze originaux de Thierry (`site/img/copeaux/originaux/`) par `reference/semence-d1/detourer-copeaux.mjs` (JavaScript pur) : remplissage depuis les bords sur les pixels proches du blanc (seuil 244, mesuré), objet érodé d'un pixel et bande de 3 px adoucie, démélangée du blanc (retouchés : plus de liseré gris-blanc), jamais agrandi, 256 px au plus ; les PNG détourés dans `site/img/copeaux/`, un test vérifie qu'ils sont ceux du script
- [x] **Semence** : migration `0009` (usage `classe`, identifiants `copeaux-p-chaleur`…) ; chaque classe ISO porte `image_chaleur` et `image_copeaux`, complétés à la lecture comme les couleurs (D61) ; test de semence
- [x] **Écran Question** : les deux images de la classe sous le matériau brut, même hauteur, légendes, sans fond ni cadre, à 390 px aussi ; l'aperçu de l'éditeur les montre en vignettes
- [x] **Onglet Tables de référence** : deux colonnes (galerie compacte, téléversement), validation (image existante, non archivée), différences à la publication, export et import
- [x] Tests, docs (DECISIONS, SPEC §3 et §7, UI §3.3, §3.4 et §3.9), Chrome à 1280 et 390 px, captures dans `captures/images-copeaux/`, aucune requête externe, rapport
- [x] ~~**Caractéristiques des classes** (D65)~~ — remplacé par D66 ci-dessous : Effort, Chaleur, Copeaux, Problème typique avec sa solution, sous les images ; « → Solution : » sur une ligne à part ; éditables dans l'onglet Tables, validées, dans les différences et l'export ; vérifié à 390 px

- [x] **Changement pédagogique** (D66) : l'image de chaleur seule (`image_copeaux`, les six PNG de copeaux et leurs originaux retirés, `0009` régénérée à six images) ; à sa droite (dessous à 390 px), les caractéristiques de la classe, libellé en gras, texte secondaire, solution sur une ligne à part ; 0 à 6 lignes, libellé ≤ 20, texte et solution ≤ 90, complétées à la lecture ; édition ligne par ligne (Ajouter, ↑, ↓, Retirer), validation, différences, export ; aperçu de l'éditeur au même affichage ; tests, docs, Chrome à 1280 et 390 px, planche des six images

- [x] **Retouche visuelle de l'image de chaleur** (D67) : lueur de la classe, fondu des bords (10 %), largeur générée 340 px au plus sans agrandir et largeur affichée ≤ original ÷ 1,5 ; marche à suivre pour une base locale qui a appliqué une migration régénérée (DEMARRAGE §5) ; captures des six classes à 1280 et 390 px

## Après images-copeaux — légende de l'image de chaleur éditable (décision D68)
Rapport de session : `docs/rapports/legende-chaleur.md`.

- [x] Champ `legende_image` des classes ISO (0 à 40 caractères), complété à « Chaleur » à la lecture ; la page Question et l'aperçu de l'éditeur l'affichent sous l'image (vide : rien, sans espace) ; colonne Légende de l'onglet Tables, validée, dans les différences et l'export ; tests, docs, Chrome à 390 et 1280 px

## Chantier « avances » — exercices de fz, f et Vf (décision D69)
Rapport de session : `docs/rapports/avances.md`.

- [x] D69 : une même chaîne pour toutes les opérations (fz selon la famille, f = fz × dents, Vf = N × f), états par exercice (D52) sans état par outil, aucune quatrième matière d'outil
- [x] **Correction de f par cohérence** (`correction.js`, tests d'abord) : fz saisie et lisible → ±0,1 % de fz_saisi × dents, sur la plage (fz ± demi-unité) × dents, élargie de la demi-unité de f ; sinon valeur théorique avec la tolérance de fz reportée (±25 %, au plus ±0,001 po par dent ; ±0,1 % en fixe et filetage) ; « ±0.1 % de fz × dents » et valeur attendue fz saisi × dents dans la correction ; une saisie envoyée pour une grandeur non évaluée ne compte plus (f et Vf) ; `tests/chaine.test.js` étendu à tout le catalogue
- [x] **`limite_avance`** retirée du formulaire d'outil de l'éditeur ; clé acceptée dans les données (absente, `null` ou > 0), gardée telle quelle à l'enregistrement ; SPEC §3 la dit obsolète
- [x] Chrome, mode test (`test-complet`), 1280 et 390 px : foret, barre à aléser, SDTMR métrique, fraise à nombre de dents tiré, outil à avance fixe ; aide de fz relevée pour les trois familles ; aucune erreur console hors le 401 attendu de l'éditeur avant connexion, aucune requête externe ; captures dans `captures/avances/`
- [x] Tableau de validation des avances de fraisage et de perçage dans le rapport
- [x] Points douteux du rapport tranchés par Thierry (D70) ; avances de fraisage et de perçage validées (D70, point 8)
- [x] **f selon D70** : à une dent, valeur théorique avec la tolérance de fz de la famille ; à partir de deux dents, cohérence avec fz saisi × dents, ou **fz affiché × dents quand fz est fournie** (le nombre de dents est vérifié) ; fz masquée, vide ou illisible : tolérance reportée ; demi-unité de f la plus large des deux, pas la somme ; tests (MVLNR, SDTMR M42 x 4.5, alésoir à 8 dents, foret #40, foret à pointer), chaîne sur tout le catalogue
- [x] Aides : avance fixe (« la valeur de la table, telle quelle, quel que soit le Ø ») ; dimension métrique seulement, « Le Ø se met en pouces : mm / 25.4 » pour N et fz proportionnelle, « fz = pas, en pouces : mm / 25.4 » pour un filet métrique
- [x] Ligne de calcul d'un filetage : la conversion du pas de la question (« fz = pas = 4.5 mm / 25.4 = 0.17717 », « fz = pas = 1 / 20 = 0.05000 »)
- [x] `npm run publier:test-complet` : test-complet sur la base locale, refuse `--remote` ; DEMARRAGE §7
- [x] Chrome, mode test, 1280 et 390 px (huit outils visés, test-complet publié par le script pendant que wrangler dev tourne) ; captures dans `captures/avances-d70/`
- [x] Barre à aléser, f +1 % : le test demandé contredisait la règle à une dent ; la règle est gardée (D70), le test `todo` retiré ; lecture des aides des filets confirmée
- [x] **D'où vient la valeur attendue** (D70, complément) : « Juste (0.000284 = ton fz × 2) », « Juste (3048.000 = ton N × ta f) » quand elle vient de la cohérence avec les saisies ; `coherence` dans chaque champ corrigé, `coherenceSource` (`text.js`)
- [ ] **Thierry** : publier l'exercice de tournage (perçage au tour compris) dans la Gestion du contenu ; micro-forets écartés par ses dimensions (à partir de Ø 1/16 po : #52 et plus gros, 1.6 mm et plus)
- [ ] **Thierry, en production, par la Gestion du contenu** : ajouter deux fraises à surfacer de 3 po, à 5 et à 7 dents (fz = 0,004 × 3 = 0,012 → 0,010) ; puis publier l'exercice de fraisage

## Chantier « accueil et libellés » — six retouches du remue-méninges de Thierry (décisions D71 à D73)
Rapport de session : `docs/rapports/accueil-et-libelles.md`.

- [x] **Grandeurs en toutes lettres** dans les rétroactions (« Ta vitesse de rotation de 3200 tr/min est à +6.7 % de 3000 tr/min (tolérance : ±5 % et ±1 tr/min). »), formules gardées en symboles ; **« tr/min » partout**, plus aucun « RPM » ni « rév/min » affiché (quiz, feuilles, attestation, `/verifier`, éditeur, docs)
- [x] **Virgule décimale** convertie en point, visiblement, à la sortie du champ ou à la validation, jamais pendant la frappe (quiz, éditeur ; aucun `type="number"`) ; vérifiée au vrai clavier dans Chrome réglé en français
- [x] **Accueil unique** regroupé par **cours** (champ Cours de l'éditeur, publié avec la version, cours connus proposés, conseil d'écriture), une seule porte professeur
- [x] **Page de description** d'un exercice (`?exercice=<id>`) : « ← Tous les exercices » (sans toucher à aucune séance), « Copier le lien », questions posées, outils questionnés, matériaux usinés ; le jeton gardé nomme son exercice
- [x] **Doublon de titre** signalé à la publication, sans bloquer
- [x] ~~Worker renommé `quiz` (D72)~~ — le renommage est introuvable dans le tableau de bord : **le Worker garde son nom**, seul le sous-domaine change (D73) ; aucune adresse dans le code, sel HKDF inchangé ; procédure courte dans `DEMARRAGE.md` §4
- [ ] **Thierry, dans l'ordre** (`DEMARRAGE.md` §4) : fusionner la branche, vérifier, changer le sous-domaine en `tgm-tmi` dans le tableau de bord Cloudflare, vérifier sur `quiz-parametres-coupe.tgm-tmi.workers.dev`, remplacer les liens de Léa
- [ ] **Thierry, dans la Gestion du contenu** : mettre le cours « M10 » aux deux M10 et les publier ; renommer « M10 — Tournage : Vc et RPM » (le titre est une donnée de production)

## Chantier « gestion du contenu » — trois retouches de la page `/prof/editeur` (décision D74)
Rapport de session : `docs/rapports/gestion-du-contenu.md`. Les tâches cochées des chantiers précédents gardent le nom « éditeur », celui de l'époque.

- [x] **E1 — « Gestion du contenu »** au lieu d'« Éditeur des exercices » : titre de l'onglet, en-tête, lien de l'espace professeur, panneau « Enseignants » de l'accueil, messages ; documents vivants et commentaires ; l'adresse `/prof/editeur`, les routes `/api/prof/editeur/*`, les fichiers et les identifiants ne changent pas ; un test garde les textes visibles de tout « éditeur »
- [x] **E2 — « Modifier »** au lieu d'« Ouvrir » dans les listes Exercices et Banque d'outils (les seules qui ont ce bouton)
- [x] **E3 — un titre en double bloque la publication** (remplace le simple signalement de D71) : au serveur (400, `doublons`) et à l'écran (refus en rouge, bouton inactif) ; brouillons libres ; republier le même exercice passe ; un archivé ne compte pas ; les doublons déjà publiés restent en place
- [ ] **Thierry** : repérer les doublons de titre déjà en production (marche à suivre dans le rapport) et, s'il y en a, changer un titre ou archiver l'un des deux avant la prochaine publication ; trancher les points douteux du rapport

## Chantier E5 — modifier le contenu sans créer de nouvelle version (décisions D75, D76)
Inventaire : `docs/rapports/inventaire-versionnage.md`. Voie hybride (D75) : la présentation en direct, la publication
en cascade des tables ; les séances restent épinglées à leur version. Un jalon par branche, dans l'ordre.

### Jalon E5-1 — la présentation des tables en direct (décision D76)
Rapport de session : `docs/rapports/e5-1-presentation-tables.md`.

- [x] Migration `0010` : la présentation des tables (une ligne, vide tant que rien n'est appliqué) et son historique
- [x] `site/js/presentation.js` (pur, testé) : liste blanche, présentation d'une version, présentation en vigueur, pose par-dessus une version et un catalogue, validation, différences, retouches en attente du brouillon ; `tablesDiff`, `tablesContent` et `exerciseTablesImpact` sans les champs de présentation
- [x] Serveur : la présentation posée après le cache des versions, sur `GET /api/exercice`, `GET /api/tables` et les tables de la Gestion du contenu, jamais sur la correction ni l'attestation ; routes lire, appliquer, rétablir (admin, 409, journal) ; une version de tables publiée prend la présentation en vigueur ; images de la présentation et de son historique comptées comme utilisées
- [x] Sauvegarde : la présentation et son historique dans l'export ; l'import les fusionne ; aller-retour identique
- [x] Onglet Tables : le panneau « Présentation — effet immédiat » (aperçu, Appliquer, historique, Rétablir), le brouillon sans ces champs pour les clés connues
- [x] Pictogramme de l'opération sur la page Question : celui des tables
- [x] Tests (liste blanche, séance épinglée à une vieille version, attestation identique octet pour octet, rétablissement, validation, 409, journal, Sauvegarde) ; `test:api` ; passe dans Chrome
- [x] Documents : SPEC §3, §7, §10 ; UI §1, §3.9 ; CLAUDE.md ; DEMARRAGE
- [x] Points du rapport tranchés par Thierry (les sept acceptés) ; **retouche** (D76) : « image existante et non archivée » ne vaut que pour une image choisie ; une image archivée déjà en vigueur n'est qu'un avertissement, qui ne bloque ni « Appliquer » ni la publication des tables ; tests et Chrome
- [ ] **Thierry** : fusionner ; après la fusion, ouvrir l'onglet Tables de référence (un encadré doré y signale les retouches de présentation restées dans le brouillon, s'il y en a ; les avertissements dorés, les images archivées en vigueur) et vérifier la présentation de départ

### Jalon E5-2 — la cascade des tables et le retour en arrière des versions (décision D77)
Rapport de session : `docs/rapports/e5-2-cascade-retour.md`.

- [x] Publier des tables propose, dans la même confirmation que le résumé des différences, tous les exercices sur la version remplacée (archivés et jamais publiés compris), cochés par défaut, chacun décochable, avec `exerciseTablesImpact` ; republie leur dernier contenu publié, jamais le brouillon, sans la règle du doublon ; fait passer le brouillon s'il était sur la version remplacée ; un exercice en erreur est nommé et laissé tel quel ; tout dans un seul lot ; journal
- [x] « Reprendre cette version » (tables : les valeurs, la présentation en vigueur gardée ; exercice : le contenu, sa version de tables gardée), puis publication normale ; « Annuler les modifications » ramène un brouillon à sa dernière version publiée ; confirmation qui liste les modifications perdues ; journal
- [x] Les images nommées par le brouillon des tables comptent comme utilisées
- [x] Tests (cascade, brouillons, décochés, erreurs, archivés, jamais publiés, titres en double, journal, séance en cours, reprendre, annuler, images, 409) ; `test:api` ; passe dans Chrome
- [x] Documents : D77 ; SPEC §7, §10 ; UI §3.9 ; DEMARRAGE ; CLAUDE.md
- [x] Points du rapport tranchés par Thierry ; **retouche** (D77) : une seule liste de tout ce qui n'est pas à jour (cochés par défaut ceux sur la version remplacée, décochés ceux sur une plus ancienne, impact depuis leur propre version) ; pour un coché, contenu publié et brouillon passent chacun de son côté ; les laissés en erreur nommés avec leurs erreurs ; tests et Chrome
- [ ] **Thierry** : fusionner

### Jalon E5-3 — la présentation des exercices en direct
- [ ] Titre, cours, « À l'accueil », photo et note des copies d'outils en direct ; l'attestation inscrit le titre affiché à la réussite ; la règle du titre en double (D74) suit le titre

### Jalon E5-4 — l'historique de la banque d'outils
- [ ] Chaque contenu remplacé d'un outil de la banque gardé, « Rétablir » en un clic, journal (le mécanisme d'E5-1)

## Finition
- [ ] Graphique de progression par opération
- [ ] Décision D7 (dépôt) close — D6 (sécurité) est fermée par D19
