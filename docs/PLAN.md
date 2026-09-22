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
- [ ] Pictogrammes d'opérations en SVG : les dix-neuf PNG du classeur sont provisoires (`site/img/pictos/README.md`) — fichiers d'origine de Thierry, ou redessin à valider
- [ ] Attente imposée par la cadence montrée à l'écran (compte à rebours ; le serveur donne déjà `attendre_s`) — aujourd'hui, un message sous le formulaire
- [ ] Sur téléphone, replier les outils terminés de la progression (UI §3.3 : « peuvent être repliés »)
- [ ] Impression des feuilles vérifiée sur papier par Thierry (une page lettre chacune)

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
- [ ] **Remise à zéro d'un NIP** (`nip_hache` nul : déjà compris par la reprise), **suppression d'une séance** (farce visible aux horodatages), **purge de fin de session** — depuis l'espace professeur
- [ ] Une **clé par enseignant** et la table des enseignants (D34 : avec les devoirs, jalon 6)
- [ ] Essai avec un groupe d'étudiants ; correctifs
- ~~Page de vérification : durée totale, temps médian, corrections d'identité~~ — abandonné (D33 : rien de plus que l'attestation imprimée ; les corrections d'identité sont dans l'espace professeur)

## Jalon 6 — Éditeur web du catalogue et des exercices (décision D11)
- [ ] `site/editeur/` : éditer un exercice (outils, réussites, champs évalués, restrictions), validé par `exercice.js`
- [ ] Éditer le catalogue (outils, matériaux, opérations), validé par `data.js`
- [ ] Télécharger les JSON produits ; mode d'emploi « déposer dans le dépôt et commettre »

## Finition
- [ ] Graphique de progression par opération
- [ ] Décision D7 (dépôt) close — D6 (sécurité) est fermée par D19
