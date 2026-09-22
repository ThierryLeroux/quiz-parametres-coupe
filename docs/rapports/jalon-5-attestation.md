# Rapport du jalon 5 — attestation signée, vérification publique, espace professeur, limites de débit

Session du 2026-09-21. Branche `jalon-5-attestation`, six commits à partir de `main` (76faaa1), rien
n'est poussé. Décisions D31 à D36 ; `npm test` : 368 tests, `fail 0` ; `npm run test:api` : 17 étapes.

## Ce qui a été fait

**A. Attestation signée.**

1. *Enregistrement figé* (D31, migration `0003`, table `attestations`). À la dernière réussite exigée
   — par une correction, ou constatée à la demande de question quand l'exercice a été allégé —, le
   serveur écrit un enregistrement JSON qui ne change plus : identité, exercice (id, titre), révision
   (version de l'exercice à la réussite), début et réussite (horodatage serveur), questions
   réussies, et les outils dans l'ordre de l'exercice avec nom, **plage de dimensions**, opération,
   réussites obtenues / exigées, tous **copiés du catalogue à cet instant**. Testé : renommer un
   outil, réduire ses dimensions, retitrer l'exercice et corriger l'identité après coup ne changent
   rien à l'attestation, alors que l'écran, lui, suit. Les séances réussies avant cette version
   reçoivent leur enregistrement à la première ouverture (`GET /api/attestation`), à partir de la
   progression ; trois ouvertures en parallèle n'en créent qu'une.
2. *Code et signature* (D32). Code de 10 caractères tiré sans biais (rejet des octets ≥ 240) dans
   `23456789ABCDEFGHJKMNPQRSTVWXYZ`, unique en base, présenté `XXXXX-XXXXX` ; la saisie tolère
   minuscules, espaces et tirets, et ne corrige jamais un O ou un I. Signature HMAC-SHA-256 sous la
   sous-clé HKDF « attestation » de `CLE_SECRETE`, sur la sérialisation canonique (JSON, clés triées
   à tous les niveaux, sans espace) ; vérifiée contre `node:crypto`. Toute comparaison de signature,
   et celle de la clé d'administration (après hachage, pour que la longueur ne fuie pas), se fait en
   temps constant.
3. *Page de l'attestation* (UI §3.6). Page lettre blanche : logo, en-tête du département sur trois
   lignes, titre, bloc d'informations sur deux colonnes, QR à droite avec le code dessous, mention
   « Vérification : <site>/verifier — code … », tableau des opérations effectuées, pied
   « TGM-TMI — TLP — 2026 », « Page 1 de 1 ». Bouton doré **Enregistrer en PDF** : impression du
   navigateur, le titre de la page devient le nom de fichier
   (`Attestation-m10-tournage-vc-Tremblay-Camille`). Consigne « Exercice réussi. Remettez ce PDF sur
   Léa. ». L'écran « Exercice réussi » provisoire et sa bannière ont disparu ; la reprise d'une séance
   réussie ouvre directement l'attestation. Si le serveur ne répond pas, un panneau « Exercice
   réussi » avec **Réessayer**.
4. *QR* (D33). Adresse absolue `<origine de la requête>/verifier?exercice=…&matricule=…&nom=…&prenom=…&reussite=…&revision=…&questions=…&code=…&signature=…`
   (≈ 235 caractères, QR de version 12, 65 modules, 160 px ≈ 1,7 po sur la feuille). Bibliothèque
   `qrcode-generator` 2.0.4 (MIT, module ES, 52 Ko) copiée telle quelle dans `site/vendor/` avec un
   README ; le QR est rendu en SVG par le DOM, jamais par `innerHTML`.

**B. Vérification publique** (`site/verifier.html`, `POST /api/verification`). Ouverte par le QR, la
page vérifie d'elle-même ; sinon on tape le code (ou on colle l'adresse). Le serveur retrouve
l'enregistrement par le code, recompose la signature à partir de ce qu'il détient (elle doit être
celle stockée et celle de l'adresse) et compare chaque champ de l'adresse à l'enregistrement. Quatre
issues : **valide** (avec l'enregistrement complet, tableau des opérations compris), **annulée** avec
la date, **aucune**, **invalide**. Un enregistrement retouché directement en base répond
« invalide » même par le code seul. Rien de plus que l'attestation imprimée ne sort (vérifié par un
test qui cherche `nip`, `jeton`, `seance_id`, `corrections`, `derniere_activite` dans la réponse).

**C. Espace professeur** (`site/prof.html`, `/api/prof/*`). Une seule clé, `CLE_ADMIN` ; l'enseignant
s'appelle « admin » et le journal des actions (`journal_enseignant`) le note — ajouter des enseignants
au jalon 6 sera un ajout de données. Connexion : comparaison en temps constant, puis cookie signé
(sous-clé « prof », charge = enseignant + expiration, sans état serveur) `HttpOnly; Secure;
SameSite=Strict; Path=/api/prof; Max-Age=43200` ; **Se déconnecter** l'efface. Cinq essais ratés par
adresse, puis 1, 2, 4… minutes (plafond une heure), chaque refus et chaque connexion journalisés.
Tableau des séances (nom, prénom, matricule, exercice, début, dernière activité, état, questions
réussies, code de l'attestation), filtre par exercice, tri par colonne (`aria-sort`), recherche par
matricule ou par nom sans casse ni accents, **Exporter en CSV** (BOM, `;`, CRLF, dates
`2026-09-21 13:48:10`), **Remettre à zéro** avec confirmation (D35 : progression à zéro, séance
conservée avec matricule, NIP et jeton, journal des corrections conservé, attestation marquée
annulée, action journalisée ; une nouvelle réussite donne un nouveau code), onglet **Corrections
d'identité** (la plus récente en premier, avant → après, matricule actuel, séance). Aucune route
`/api/prof/*` ne répond sans cookie valide (absent, forgé, signé par un autre secret, expiré après
12 h : testés). Le client ne contient aucun secret.

**D. Limites de débit** (D36). Consultation et vérification : au plus 100 matricules ou codes
**distincts** par adresse (`cf-connecting-ip`) et par tranche horaire UTC, sans limite sur le nombre
de requêtes ; la 101ᵉ valeur est refusée (429 + `attendre_s`) et verrouille l'adresse 10 minutes ;
une valeur déjà vue passe toujours ; une valeur refusée n'est pas comptée. Compteurs en D1 (tables
`debit`, `verrous`), les tranches passées effacées au fil de l'eau. Choix noté dans SPEC §8 et D36 :
le service de limitation de Cloudflare compte des requêtes, pas des valeurs distinctes, et ne se
teste pas sous `node --test` avec une horloge réglable.

**E. Documents et tests.** DECISIONS D31 à D36 (D24 à D30 réservés pour les décisions du Projet
Claude) ; SPEC §7 (tables, API, codes) et §8 (attestation, vérification, professeur, limites) ; UI
§3.6 réécrit, §3.7 et §3.8 ajoutés ; PLAN ; DEMARRAGE (étape 7 : ouvrir l'espace professeur) ;
CLAUDE.md (règle des rapports, `docs/rapports/`, nouveaux modules, durée de `test:api`). Tests :
`worker-attestation.test.js`, `worker-acces.test.js`, `worker-crypto` (signatures, clé),
`migrations` (nouvelles tables, cascade), `worker-api` (12 tests de plus : figeage, reconstitution,
vérification valide / falsifiée / inconnue / annulée, connexion et verrou croissant, routes sans
cookie, liste, remise à zéro, identités, limites de débit consultation et vérification),
`ui-attestation` (textes, QR), `ui-prof` (filtre, tri, recherche, CSV). `npm run test:api` rejoue
le cycle complet sur `wrangler dev` : réussite du M10 à la cadence réelle, attestation, vérification
par l'adresse et par le code, connexion professeur, remise à zéro, attestation annulée, reprise au
début, déconnexion (≈ 3 min au lieu de 30 s).

## Vérifié dans Chrome (captures dans `captures/jalon-5/`, hors dépôt)

Sur un `wrangler dev` jetable (port 8791, D1 temporaire, secrets de test), Chrome sans interface
piloté par le protocole DevTools : reprise de séance par l'écran d'identification jusqu'à
l'attestation (1280 px, 390 px), média print à la largeur utile de la feuille (720 px) et
`printToPDF` → **1 page**, `attestation.pdf` conservé dans les captures ; page de vérification pour
les quatre issues (valide, invalide, aucune, annulée) à 1280 et 390 px ; espace professeur :
connexion (clé fausse puis bonne), liste, recherche, tri, corrections d'identité, remise à zéro par
le bouton (boîte de confirmation acceptée), liste rafraîchie, 390 px. 228 requêtes, **aucune vers un
domaine externe** ; aucune exception ; les deux seules erreurs du journal réseau sont les 401
attendus (liste avant connexion, clé fausse). Après la remise à zéro, « Reprendre, Camille » rouvre
l'écran Question à zéro.

**Un test instable, trouvé et corrigé.** Une exécution de `npm test` sur treize a été rouge ; rejoué
seul quarante fois, le test « vérification : contenu modifié… » échouait une fois sur dix : il
remplaçait le *dernier* caractère de la signature par « A » pour la fausser, or le dernier caractère
d'un HMAC en base64url ne peut valoir que A, Q, g ou w. Le test change maintenant le premier
caractère ; trente exécutions vertes de suite, puis la suite complète. La correction est repliée dans
le commit du serveur (aucun commit de réparation).

## Commits (branche `jalon-5-attestation`)

1. Décisions D31 à D36 du jalon 5 et règle des rapports dans CLAUDE.md
2. Serveur du jalon 5 : attestation figée et signée, vérification, espace professeur, limites de débit
3. Page de l'attestation avec QR de vérification ; bibliothèque QR vendorisée
4. Page publique /verifier et espace professeur /prof
5. test:api étendu au cycle complet du jalon 5
6. Docs du jalon 5 : SPEC, UI, PLAN, DEMARRAGE, CLAUDE.md ; rapport

## Points douteux, à trancher

1. **« Révision des tables ».** Les JSON de `site/data/` n'ont pas de numéro de révision ; j'ai pris
   la **version de l'exercice à la réussite** (`r0`), ce que SPEC §10 appelait déjà « inscrit au
   rapport ». Si la révision voulue est celle du catalogue (feuilles de l'atelier), il faut ajouter
   une clé (par ex. `_revision` dans `materiaux.json` et `operations.json`) et l'inscrire aussi dans
   l'enregistrement — un ajout de données, pas une refonte.
2. **Table `attestations` séparée** plutôt que des colonnes dans `seances` : nécessaire pour que
   l'ancien code réponde « annulée » après une remise à zéro pendant qu'une nouvelle réussite en
   crée un autre (D35). L'enregistrement reste « dans la séance » au sens où il lui est lié et purgé
   avec elle.
3. **« Remettez ce PDF sur Léa »** : vouvoiement repris tel que demandé, alors que tout le site
   tutoie (« Enregistre le PDF, puis remets-le sur Léa » dans l'ancien UI §3.6). À confirmer.
4. **« Corriger mon identité » retiré de la page de l'attestation** : l'attestation est figée, la
   correction ne la changerait pas et l'en-tête contredirait le document. Conséquence : une faute
   dans le nom découverte après la réussite ne se répare que par une remise à zéro (tout refaire).
   Piste si cela gêne : une correction d'identité après réussite qui **annule et réémet**
   l'attestation (nouveau code, journalisé) — une décision à prendre.
5. **Cookie professeur sans état** : « Se déconnecter » efface le cookie, mais un cookie copié reste
   valable jusqu'à son expiration (12 h). Acceptable pour un enseignant ; sinon, table des séances
   professeur au jalon 6 avec les enseignants.
6. **Dates du CSV** : `2026-09-21 13:48:10` (ISO 8601 étendu, mais avec un espace et non « T », à
   l'heure du poste de l'enseignant) : Excel en français reconnaît cette forme comme une date, pas la
   forme avec « T ». Les dates de l'attestation et des tableaux sont aussi à l'heure du poste.
7. **Reconstitution des anciennes séances** : à partir de la progression et de l'exercice **tel qu'il
   est au moment de l'ouverture** (un outil retiré de l'exercice depuis n'y figure pas) ; le journal
   des corrections n'est pas lu, puisque `total_reussies` est déjà dans la progression. Y a-t-il des
   séances réussies en production ? Si oui, elles recevront leur attestation à leur prochaine
   ouverture, datée de leur `reussite_le`.
8. **Colonne « Attestation » (le code) ajoutée** au tableau professeur et au CSV, non demandée :
   utile pour retrouver une attestation papier sans scanner. À retirer si elle encombre.
9. **Cookie `Secure` en local** : Chrome et Firefox acceptent un cookie `Secure` posé par
   `http://localhost` ; Safari ne le fait pas, l'espace professeur ne fonctionnerait donc pas en local
   sous Safari (en production, tout est en HTTPS).
10. **Hors de ce jalon**, laissés dans PLAN : remise à zéro d'un NIP, suppression d'une séance, purge
    de fin de session, clé par enseignant. Le message « demande à ton enseignant de le remettre à
    zéro » (NIP oublié) n'a donc pas encore de bouton côté enseignant.
11. **Lecture du QR** vérifiée par la bibliothèque (encodage) et par la vérification de l'adresse,
    pas avec un téléphone réel ; l'impression papier n'a pas été faite (PDF d'une page vérifié par
    Chrome).
12. **`npm run test:api` dure environ 3 minutes** : quinze corrections à la cadence réelle de 10 s.
    Un exercice de test plus court n'existe pas dans `site/exercices/` (il serait public).

## Reste à faire

Voir PLAN, jalon 5 : NIP, suppression, purge, clé par enseignant, essai avec un groupe. Avant de
fusionner : relire `docs/DECISIONS.md` D31 à D36 et reporter D24 à D30 depuis le Projet Claude.
