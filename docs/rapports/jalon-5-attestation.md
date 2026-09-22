# Rapport du jalon 5 — attestation signée, vérification publique, espace professeur, limites de débit

Session du 2026-09-21, en deux temps : le jalon (six commits), puis la réconciliation avec les
corrections du jalon 4 et les réponses de Thierry aux points douteux (huit commits). Branche
`jalon-5-attestation`, quatorze commits, rien de poussé. `npm test` : 416 tests, `fail 0` ;
`npm run test:api` : 17 étapes, une minute. Décisions D31 à D39.

## Première partie — ce qui a été fait

**A. Attestation signée.**

1. *Enregistrement figé* (D31, migration `0003`, table `attestations`). À la dernière réussite exigée
   — par une correction, ou constatée à la demande de question quand l'exercice a été allégé —, le
   serveur écrit un enregistrement JSON qui ne change plus : identité, exercice (id, titre), version
   de l'exercice à la réussite, **révision des tables** (clé `revision` de `materiaux.json` et
   `operations.json`, D28), début et réussite (horodatage serveur), questions réussies, et les outils
   **exactement tels que `progression.outils`** les montre à l'écran (nom, plage permise par
   l'exercice, opération, réussites obtenues / exigées), copiés à cet instant. Testé : renommer un
   outil, réduire ses dimensions, retitrer l'exercice ou changer la révision des tables après coup
   ne change rien à l'attestation, alors que l'écran, lui, suit. Les séances réussies avant cette
   version reçoivent leur enregistrement à la première ouverture (`GET /api/attestation`), à partir
   de la progression ; trois ouvertures en parallèle n'en créent qu'une.
2. *Code et signature* (D32). Code de 10 caractères tiré sans biais (rejet des octets ≥ 240) dans
   `23456789ABCDEFGHJKMNPQRSTVWXYZ`, unique en base, présenté `XXXXX-XXXXX` ; la saisie tolère
   minuscules, espaces et tirets, et ne corrige jamais un O ou un I. Signature HMAC-SHA-256 sous la
   sous-clé HKDF « attestation » de `CLE_SECRETE`, sur la sérialisation canonique (JSON, clés triées
   à tous les niveaux, sans espace) ; vérifiée contre `node:crypto`. Toute comparaison de signature,
   et celle de la clé d'administration (après hachage, pour que la longueur ne fuie pas), se fait en
   temps constant.
3. *Page de l'attestation* (UI §3.6). Page lettre blanche : logo, en-tête du département sur trois
   lignes (`DEPARTMENT_LINES`), titre, bloc d'informations sur deux colonnes, QR à droite avec le code
   dessous, mention « Vérification : <site>/verifier — code … », tableau des opérations effectuées,
   pied « TGM-TMI — TLP — 2026 », « Page 1 de 1 ». Bouton doré **Enregistrer en PDF** : impression
   du navigateur, le titre de la page devient le nom de fichier
   (`Attestation-m10-tournage-vc-Tremblay-Camille`). Consigne « Exercice réussi. Remets ce PDF sur
   Léa. ». L'écran « Exercice réussi » provisoire, sa bannière et ses aides dans `text.js` ont
   disparu ; la reprise d'une séance réussie ouvre directement l'attestation. Si le serveur ne
   répond pas, un panneau « Exercice réussi » avec **Réessayer**.
4. *QR* (D33). Adresse absolue
   `<origine>/verifier?exercice=…&matricule=…&nom=…&prenom=…&reussite=…&revision=…&questions=…&code=…&signature=…`
   (≈ 235 caractères, QR de version 12, 160 px ≈ 1,7 po sur la feuille). Bibliothèque
   `qrcode-generator` 2.0.4 (MIT, module ES, 52 Ko) copiée telle quelle dans `site/vendor/` avec un
   README ; le QR est rendu en SVG par le DOM, jamais par `innerHTML`.

**B. Vérification publique** (`site/verifier.html`, `POST /api/verification`). Ouverte par le QR, la
page vérifie d'elle-même ; sinon on tape le code (ou on colle l'adresse). Le serveur retrouve
l'enregistrement par le code, recompose la signature à partir de ce qu'il détient (elle doit être
celle stockée et celle de l'adresse) et compare chaque champ de l'adresse à l'enregistrement. Quatre
issues : **valide** (avec l'enregistrement complet, tableau des opérations compris), **annulée** avec
la date et le motif, **aucune**, **invalide**. Un enregistrement retouché directement en base répond
« invalide » même par le code seul. Rien de plus que l'attestation imprimée ne sort (un test cherche
`nip`, `jeton`, `seance_id`, `corrections`, `derniere_activite` dans la réponse).

**C. Espace professeur** (`site/prof.html`, `/api/prof/*`). Une seule clé, `CLE_ADMIN` ; l'enseignant
s'appelle « admin » et le journal des actions (`journal_enseignant`) le note — ajouter des enseignants
au jalon 6 sera un ajout de données. Connexion : comparaison en temps constant, puis cookie signé
(sous-clé « prof », charge = enseignant + expiration, sans état serveur) `HttpOnly; Secure;
SameSite=Strict; Path=/api/prof; Max-Age=43200` ; **Se déconnecter** l'efface. Cinq essais ratés par
adresse, puis 1, 2, 4… minutes (plafond une heure), chaque refus et chaque connexion journalisés.
Tableau des séances (nom, prénom, matricule, exercice, début, dernière activité, état, questions
réussies, code de l'attestation), filtre par exercice, tri par colonne (`aria-sort`), recherche par
matricule ou par nom sans casse ni accents, **Exporter en CSV** (BOM, `;`, CRLF, dates
`2026-09-21 13:48:10`), **Remettre à zéro** et **Réinitialiser le NIP** avec confirmation, onglet
**Corrections d'identité** (la plus récente en premier, avant → après, attestation réémise,
matricule actuel, séance). Aucune route `/api/prof/*` ne répond sans cookie valide (absent, forgé,
signé par un autre secret, expiré après 12 h : testés). Le client ne contient aucun secret.

**D. Limites de débit** (D36). Consultation et vérification : au plus 100 matricules ou codes
**distincts** par adresse (`cf-connecting-ip`) et par tranche horaire UTC, sans limite sur le nombre
de requêtes ; la 101ᵉ valeur est refusée (429 + `attendre_s`) et verrouille l'adresse 10 minutes ;
une valeur déjà vue passe toujours ; une valeur refusée n'est pas comptée. Compteurs en D1 (tables
`debit`, `verrous`), les tranches passées effacées au fil de l'eau. Choix noté dans SPEC §8 et D36 :
le service de limitation de Cloudflare compte des requêtes, pas des valeurs distinctes, et ne se
teste pas sous `node --test` avec une horloge réglable.

## Seconde partie — réconciliation et réponses au rapport

**A. Fusion de main** (commit « Fusionne main… »), sans rebase. Douze conflits résolus en gardant les
deux côtés : nomenclature par gabarit, deux diamètres, mode test, familles et révision des tables,
pictogrammes SVG, compte à rebours, repli sur téléphone (jalon 4) ; attestation signée, vérification,
espace professeur, limites (jalon 5). L'attestation signée remplace la provisoire : l'écran
« Exercice réussi », sa bannière, le style `.success-actions` et les aides `attestationLines`,
`attestationTools`, `attestationFileName(seance)` de `text.js` (avec leurs tests) ont disparu ;
l'attestation reprend `DEPARTMENT_LINES`. DECISIONS : les vrais D24 à D30 précèdent D31 à D36, la
note des numéros réservés est partie. SPEC (v0.5), UI, PLAN, CLAUDE.md et DEMARRAGE relus après la
fusion : ni doublon ni contradiction trouvés (les mentions de l'attestation provisoire qui restent
sont dans l'historique du jalon 4 de PLAN et dans D29/D30). Un test recopiait l'index des exercices
et a cassé sur `test-complet` : il lit l'index.

**B. Réponses appliquées.**

1. *Révision* : l'attestation porte la version de l'exercice à la réussite **et** `revision_tables`
   (`{ materiaux, operations }`), affichée « A2026_r0 » (ou les deux si elles diffèrent).
2. *Table `attestations` séparée* : conservée.
3. *Tutoiement* : « Remets ce PDF sur Léa. » ; « figureront sur ton attestation » dans le formulaire.
4. *Correction d'identité après la réussite* (D37) : « Corriger mon identité » est de retour sur la
   page de l'attestation, NIP exigé. Le même lot déplace la séance, annule l'attestation en cours
   (motif `identite_corrigee`) et en insère une nouvelle : enregistrement repris tel quel avec la
   nouvelle identité et un nouveau code, resigné. L'ancien code répond « annulée » avec le motif ;
   le journal des corrections d'identité note les deux codes et l'espace professeur les montre
   (« ancien → nouveau »). Sans changement, rien n'est réémis ; un matricule déjà pris (409) ne
   réémet rien. Le formulaire prévient : « Ton attestation sera réémise… ».
5. *Cookie sans état* : conservé ; PLAN note pour le jalon 6 une table des séances professeur qui
   permette de révoquer (D38, conséquences).
6. *Dates du CSV* avec espace : conservées.
7. *Colonne du code* : conservée.
8. *Réinitialisation du NIP* (D38) : `POST /api/prof/reinitialisation-nip`, bouton « Réinitialiser le
   NIP » par ligne avec confirmation ; NIP effacé, essais et verrou tombés, progression et jeton
   intacts ; le NIP présenté à la prochaine reprise devient le nouveau (mécanisme de D21, testé
   après un verrou de cinq essais) ; journalisée (`reinitialisation_nip`). Suppression, purge, clé par
   enseignant : PLAN, jalon 6.
9. *Cadence réglable* (D39) : variable `CADENCE_S` (secondes entières, 1 à 999), honorée seulement
   pour une requête adressée au poste (`cadenceFor`, comme `isTestMode`), absente de `wrangler.jsonc`
   et du déploiement, en commentaire dans `.dev.vars.exemple` — le test qui le vérifiait pour
   `MODE_TEST` couvre les deux. `test:api` garde ses étapes 6 et 7 à la cadence réelle de 10 s (une
   attente de 10 s), puis arrête wrangler et le relance avec `CADENCE_S:1` sur la même D1 pour le
   cycle complet : environ une minute au lieu de trois.
10. *Test instable* : rien de plus.
11. *D24 à D30* : réglé par la fusion.

**Migration `0003`** a été modifiée plutôt que complétée par une `0004` : elle n'a jamais été
appliquée ailleurs que sur des bases jetables (elle n'existe que sur cette branche). Colonnes
ajoutées : `attestations.annulation_motif`, `corrections_identite.ancien_code` et `nouveau_code`.

**Retouches** vues à la seconde passe Chrome : pieds de page de `/verifier` et `/prof` alignés sur
index.html (« TGM-TMI », D30) ; la cellule des deux boutons d'action débordait du tableau.

## Vérifié

- `npm test` : 416 tests (dont 12 nouveaux pour D37 à D39 et la révision des tables), `fail 0`, sur
  la branche fusionnée. `npm run test:api` : 17 étapes vertes, deux phases.
- **Chrome**, seconde passe sur un `wrangler dev` jetable (`MODE_TEST:1`, `CADENCE_S:1`), captures
  dans `captures/jalon-5/` (hors dépôt, 22 images et le PDF) : question avec **barre à rainurer** à
  deux diamètres (1280 et 390 px, bandeau du mode test visible : c'est lui qui a permis d'atteindre
  cet outil de `test-complet` sans calculer) ; les trois **feuilles** avec les pictogrammes SVG et
  la révision au pied ; **attestation** (1280, 390, média print à 720 px, PDF d'une page) ;
  **Corriger mon identité** depuis l'attestation → attestation réémise avec le nouveau nom et un
  nouveau code ; vérification de l'ancien code → « annulée : identité corrigée… », du nouveau →
  valide, adresse retouchée → invalide, code inconnu → aucune, 390 px ; espace professeur :
  connexion, liste, **Réinitialiser le NIP** d'Alex (puis, par l'API, son nouveau NIP accepté et
  l'ancien refusé), corrections d'identité avec l'attestation réémise, remise à zéro de Camille,
  390 px, vérification « annulée : séance remise à zéro ». 275 requêtes, **aucune externe**, aucune
  exception ; les deux erreurs du journal réseau sont des 401 attendus.
- Un test instable trouvé et corrigé en première partie (dernier caractère d'une signature
  base64url, qui ne peut valoir que A, Q, g ou w) ; correction repliée dans le commit du serveur.

## Commits (branche `jalon-5-attestation`, dans l'ordre)

1. Décisions D31 à D36 du jalon 5 et règle des rapports dans CLAUDE.md
2. Serveur du jalon 5 : attestation figée et signée, vérification, espace professeur, limites de débit
3. Page de l'attestation avec QR de vérification ; bibliothèque QR vendorisée
4. Page publique /verifier et espace professeur /prof
5. test:api étendu au cycle complet du jalon 5
6. Docs du jalon 5 : SPEC, UI, PLAN, DEMARRAGE, CLAUDE.md ; rapport
7. Fusionne main (corrections du jalon 4) dans jalon-5-attestation
8. L'attestation reprend plage et opération de progression.outils, et porte la révision des tables
9. Corriger mon identité après la réussite : l'attestation est annulée et réémise (D37)
10. Réinitialisation du NIP depuis le tableau des séances (D38)
11. Cadence réglable en local (CADENCE_S, D39) ; test:api en deux phases
12. Docs des réponses au rapport : D37 à D39, SPEC, UI, DEMARRAGE, CLAUDE.md ; tutoiement
13. Pieds de page « TGM-TMI » sur /verifier et /prof ; cellule Actions du tableau professeur
14. Rapport du jalon 5 mis à jour

## Points douteux, à trancher

1. **Réémission et révisions** : la nouvelle attestation reprend l'enregistrement tel quel (dates,
   résultats, révisions) ; seuls `etudiant` et le code changent. Si la version de l'exercice ou la
   révision des tables a changé entre-temps, l'attestation réémise garde celles de la réussite —
   c'est le sens de « mêmes résultats, mêmes dates », mais à confirmer.
2. **Collision de code à la réémission** : un code déjà pris ferait échouer le lot (UNIQUE) et
   répondrait 409 « ce matricule a déjà une séance », message faux. Probabilité 1 sur 6 × 10¹⁴ par
   réémission ; non traité.
3. **Reconstitution des anciennes séances** : à partir de la progression et de l'exercice **tel qu'il
   est au moment de l'ouverture** ; le journal des corrections n'est pas lu. Y a-t-il des séances
   réussies en production ? Elles recevront leur attestation à leur prochaine ouverture, datée de leur
   `reussite_le`.
4. **Cookie `Secure` en local** : Chrome et Firefox acceptent un cookie `Secure` posé par
   `http://localhost` ; Safari non — l'espace professeur ne fonctionnerait pas en local sous Safari
   (en production tout est en HTTPS).
5. **Lecture du QR** vérifiée par la bibliothèque et par la vérification de l'adresse, pas avec un
   téléphone ; impression papier non faite (PDF d'une page vérifié par Chrome).
6. **Capture de la question à deux diamètres** prise en mode test (bandeau visible) : le seul moyen
   d'atteindre la barre à rainurer sans calculer 22 questions.
7. **Fichier parasite** `witch main` (non versionné) à la racine du dépôt, sans doute un
   `git s>witch main` : laissé en place, à supprimer.
8. **`test:api` relance wrangler** entre les deux phases (même D1) : une dizaine de secondes de plus,
   contre deux minutes gagnées.

## Reste à faire

PLAN, jalon 5 : suppression d'une séance, purge, clé par enseignant avec table des séances
professeur (jalon 6) ; essai avec un groupe. Avant de fusionner : relire D37 à D39, supprimer
`witch main`.
