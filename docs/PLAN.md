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
- [ ] **À confirmer par Thierry** : barres de la barre à aléser (1/2, 5/8, 3/4, 1, 1 1/4 po) et rapport 0,75 (D25) ; un N calculé avec 12/π puis arrondi à l'entier est refusé sous ~90 rév/min (SPEC §5, test `todo`)
- [ ] Attente imposée par la cadence montrée à l'écran (compte à rebours ; le serveur donne déjà `attendre_s`) — aujourd'hui, un message sous le formulaire
- [ ] Sur téléphone, replier les outils terminés de la progression (UI §3.3 : « peuvent être repliés »)
- [ ] Impression des feuilles vérifiée sur papier par Thierry (une page lettre chacune)

## Jalon 5 — Attestation signée, page de vérification, connexion professeur et administration (décisions D16, D19)
**En tête : l'attestation de réussite signée** — c'est la sortie du parcours étudiant (D29). L'écran et le bouton « Voir mon attestation » existent déjà (jalon 4), en version provisoire non signée.

- [ ] `GET /api/rapport` : **attestation signée** (HMAC, sous-clé « attestation » de `CLE_SECRETE`) et rapport de réussite tiré du journal des corrections
- [ ] Attestation imprimable (UI §3.6) + **QR code** de l'attestation (bibliothèque vendorisée, seule dépendance d'exécution permise) ; l'avis « provisoire, non signée » disparaît
- [ ] `POST /api/consultation` **limitée** (D29) : le cégep sort par une seule adresse IP (NAT), donc une limite par IP reste large ; préférer un plafond de **matricules distincts par heure**
- [ ] **Page de vérification** publique : lit l'attestation du QR, interroge le serveur ; montre la durée totale et le temps médian par question (journal)
- [ ] **Connexion professeur** = **une clé par enseignant** ; elle ouvre la page d'administration, puis l'éditeur (jalon 6), et pourra ouvrir le **mode test** aux séances d'un professeur connecté (D26)
- [ ] **Page d'administration**, avec **une clé par enseignant** (D23 : plusieurs enseignants, rien ne se répare à la main) : liste des réussites, **remise à zéro d'un NIP** (`nip_hache` nul : déjà compris par la reprise), **suppression d'une séance** (séance ouverte par un autre au matricule d'un étudiant : farce visible aux horodatages), purge de fin de session
- [ ] Page de vérification : montre aussi les **corrections d'identité** de la séance (journal `corrections_identite`, D23)
- [ ] Essai avec un groupe d'étudiants ; correctifs

## Jalon 6 — Éditeur web du catalogue et des exercices (décision D11)
Rien n'en existe encore. Protégé par la connexion professeur du jalon 5 (UI §8).

- [ ] `site/editeur/` : **création de devoirs** — éditer un exercice (outils, réussites, champs évalués, restrictions), validé par `exercice.js` ; l'inscrire à l'index
- [ ] Éditer les **outils** (`outils.json`), validé par `data.js` : dimensions, **gabarit de nomenclature** avec la liste des jetons et un aperçu (D24), **barres** d'un outil à deux diamètres (D25)
- [ ] Éditer les **tables de référence** : vitesses de coupe (`materiaux.json`, dont `debut_famille`, D27), avances (`operations.json`), **révision** de chaque table (D28)
- [ ] **Images** : photo d'un outil (`site/img/outils/`), pictogramme d'une opération (`site/img/pictos/operations/`)
- [ ] Télécharger les JSON produits ; mode d'emploi « déposer dans le dépôt et commettre »

## Finition
- [ ] Graphique de progression par opération
- [ ] Décision D7 (dépôt) close — D6 (sécurité) est fermée par D19
