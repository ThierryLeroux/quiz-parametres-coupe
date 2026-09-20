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
- [x] `site/js/app.js` : choix de l'exercice (`?exercice=<id>`, sans repli : D18) et cycle d'une séance, en fonctions pures — le cycle servira au serveur (jalon 3)
- [x] Maquette des écrans, approuvée par Thierry (`docs/UI.md`, `docs/maquettes/`, décision D17)
- [x] `site/css/tokens.css`, `base.css` : langage visuel et composants de base (UI §1, §4, §6) ; polices auto-hébergées dans `site/fonts/`
- [x] Hébergement (D20) : `wrangler.jsonc`, `worker/index.js` minimal (`GET /api/version` ; 501 ailleurs sous `/api/`), `npm run dev`, `deploy.yml`
- [ ] `site/js/session.js` : le navigateur ne garde que `{ matricule, prenom, jeton }` (D19) ; `site/js/identification.js` : prénom, nom, matricule, NIP
- [x] `site/js/api.js` : appels prévus au serveur (identification, question, correction, rapport)
- [ ] `site/index.html` + `site/js/ui/` : écrans Accueil et Identification (UI §3.1, §3.2) selon D19 — « Serveur de correction à venir » tant que l'API répond 501 ; écran Question en gabarit vide

## Jalon 3 — Serveur de correction (décisions D19, D20)
Le moteur (jalons 1 et 1b) et le cycle d'`app.js` passent derrière l'API ; chaque route a ses tests.
Avant de coder : trancher les cinq points ❓ de la fin de `SPEC.md` §7.

- [ ] Base **D1** : liaison dans `wrangler.jsonc`, **schéma et migrations** (séances, identifications, corrections), base locale pour `npm run dev` et les tests
- [ ] `POST /api/identification` : matricule à 7 chiffres, NIP de 4 à 6 chiffres haché, 5 essais par 10 minutes par matricule, une séance par (matricule, exercice), jeton de séance qui expire après 2 h sans activité
- [ ] `GET /api/question` : tirage côté serveur parmi les outils encore à évaluer ; la question en cours est rendue telle quelle à la reprise
- [ ] `POST /api/correction` : correction, compteurs, une seule correction par question
- [ ] **Cadence** : 10 s au moins entre deux corrections d'une même séance
- [ ] **Horodatage** de chaque correction
- [ ] Secrets du serveur (clé HMAC, clé d'administration) : `wrangler secret`, `.dev.vars` en local, mode d'emploi dans `DEMARRAGE.md`

## Jalon 4 — Écran Question et tables de référence, branchés sur le serveur
- [ ] Écran Question (UI §3.3) : outil, dimension, matériau, 5 champs (évalués ou pré-remplis), aide contextuelle
- [ ] Question corrigée (UI §3.4) : correction visuelle, bandeau, Question suivante ; attente imposée par la cadence
- [ ] Progression par outil à l'écran
- [ ] Tables de référence (UI §3.5) : vitesses de coupe, avances, formules ; impression
- [ ] Images d'outils (`site/img/outils/`) et pictogrammes (UI §5) affichés
- [ ] Jeton expiré ou refusé en cours de séance : retour à l'identification, sans perte (l'état est sur le serveur)

## Jalon 5 — Rapport signé, page de vérification, administration (décisions D16, D19)
- [ ] `GET /api/rapport` : rapport de réussite et **attestation signée** (HMAC)
- [ ] Page rapport imprimable (UI §3.6) + QR code de l'attestation (bibliothèque vendorisée)
- [ ] **Page de vérification** publique : lit l'attestation du QR, interroge le serveur
- [ ] **Page d'administration** à clé : liste des réussites, remise à zéro d'un NIP, purge de fin de session
- [ ] Essai avec un groupe d'étudiants ; correctifs

## Jalon 6 — Éditeur web du catalogue et des exercices (décision D11)
- [ ] `site/editeur/` : éditer un exercice (outils, réussites, champs évalués, restrictions), validé par `exercice.js`
- [ ] Éditer le catalogue (outils, matériaux, opérations), validé par `data.js`
- [ ] Télécharger les JSON produits ; mode d'emploi « déposer dans le dépôt et commettre »

## Finition
- [ ] Graphique de progression par opération
- [ ] Décision D7 (dépôt) close — D6 (sécurité) est fermée par D19
