# CLAUDE.md — Quiz de paramètres de coupe (version web)

Ce fichier est lu automatiquement par Claude Code au début de chaque session.
Il résume le projet, les conventions et la façon de travailler. Les détails sont
dans `docs/`.

## Le projet en trois phrases

Exerciseur web auto-corrigé pour étudiants en génie mécanique (Cégep) : calcul
des paramètres de coupe (Vc, N, avances) pour une opération d'usinage tirée au
hasard. Il remplace un classeur Excel/VBA (`legacy/`) qu'on ne maintient plus.
À la réussite : rapport PDF à remettre sur Léa, avec un QR code de vérification
signé par le serveur de correction (décision D19).

Propriétaire : Thierry, enseignant, expert en usinage CNC, développeur
occasionnel. Il maintiendra seul ce code pendant des années : **la simplicité et
la lisibilité priment sur l'élégance technique.**

## Où lire quoi

- `docs/SPEC.md` — comportement attendu (formules, tolérances, rapport). **Source de vérité fonctionnelle.** Les ❓ sont des questions ouvertes : ne pas les trancher seul, les remonter.
- `docs/UI.md` — écrans et présentation (langage visuel, parcours, composants, impression). **Source de vérité de la présentation**, au même titre que SPEC pour le comportement (décision D17) ; maquettes approuvées dans `docs/maquettes/`. En cas de contradiction : DECISIONS, puis SPEC, puis UI.
- `docs/DECISIONS.md` — décisions prises et ouvertes. Ne jamais contredire une décision fermée sans en ajouter une nouvelle.
- `docs/PLAN.md` — jalons et tâches. Travailler dans l'ordre, une tâche à la fois.
- **La base D1 porte les exercices, la banque d'outils, les tables de référence** (décision D47, migration `0005`) **et les images** (D56, migration `0007` ; D64, migration `0009`) : c'est ce que le serveur et le navigateur lisent, et ce que l'éditeur modifie en production. Les JSON et les images du dépôt ne sont plus que la **semence et les données des tests** :
  - `site/data/*.json` — le format des tables de référence (matériaux, opérations) et de la banque d'outils (SPEC §3), extraits du classeur ; l'en-tête `_source` de chaque fichier dit d'où. Y vivent le **gabarit de nom** de chaque outil (`format_identifiant`, D24), les deux diamètres de la barre à aléser (D25), les débuts de famille (D27) et la révision des tables (D28). Semés en base par `0005` comme version « A2026_r0 » et comme banque ; un test vérifie que la semence leur est identique. **Les éditer ne change rien en production.** Depuis la partie B du 7b (D61 à D63), **les tables s'éditent et se publient dans l'éditeur** (onglet Tables de référence : brouillon unique, versions immuables avec leur révision, classes ISO et matières d'outil **avec leurs couleurs**, pictogrammes) ; `site/js/tables.js` porte les règles pures (valeurs par défaut = celles de `tokens.css`, complétion d'une vieille version, variables CSS, révision suivante, différences) ; chaque exercice choisit sa version de tables (D62) ; `/tables?version=` imprime les feuilles d'une version (D63).
  - `site/exercices/<id>.json` — les exercices au format **fichier** (SPEC §10 : outils du catalogue avec restrictions), convertis en copies d'outils par `draftFromExercise` pour la semence (les deux M10) et les tests. `test-complet` couvre tout le catalogue, pour les tests et le mode test (D26) ; il n'est pas semé.
  - `site/img/outils/*.png` et `site/img/pictos/operations/*.svg` — les photos d'outils et les pictogrammes d'opérations, **semés dans la table `images`** par la migration `0007` (D56) ; le quiz et l'éditeur lisent `/images/<id>`, jamais ces fichiers. **Y ajouter ou y changer un fichier ne change rien en production** : c'est l'onglet Images de l'éditeur qui téléverse. Un test vérifie que la semence est identique aux fichiers.
  - `site/img/copeaux/` — les **images de chaleur par classe ISO** (D64, D66 : plus d'image de forme de copeaux) : `originaux/` est la source, et les PNG **détourés** (fond transparent) sont produits par `reference/semence-d1/detourer-copeaux.mjs` (à relancer, jamais retouchés à la main ; un test le vérifie) ; **semés dans `images`** par la migration `0009` sous l'usage `classe`. Chaque classe ISO des tables nomme la sienne (`image_chaleur`) et porte ses **caractéristiques** (`caracteristiques`, 0 à 6 lignes libellé, texte, solution facultative ; D65, D66), complétées à la lecture d'une version d'avant, comme les couleurs ; l'écran Question montre l'image sous le matériau brut et les caractéristiques à sa droite, l'onglet Tables de référence édite les deux.
  - `reference/semence-d1/generer.mjs`, `generer-images.mjs` et `generer-copeaux.mjs` — les scripts qui ont composé les migrations `0005`, `0007` et `0009` ; on ne les relance pas (une migration appliquée ne change pas).
- `site/prof/editeur.html` — **l'éditeur** (D47 à D49, D56 à D59, SPEC §10, UI §3.9), rôle admin : exercices (brouillon, versions publiées immuables, aperçu, publication avec le résumé des différences), banque d'outils, images (galerie, téléversement réduit dans le navigateur, archivage), sauvegarde (export, import — les images à part). Écrans `site/js/ui/editeur.js` et `images-picker.js`, règles pures `editeur-data.js` ; côté serveur `worker/editeur.js` (pur, testé), `worker/images.js` (règles des images), `worker/svg.js` (SVG assaini par liste blanche, D57) et les routes `/api/prof/editeur/*` d'`index.js`. La validation (`draftErrors`, `toolErrors`) est la même des deux côtés.
- `worker/` — le **serveur de correction** (décisions D19 à D22, D26, D31 à D39, D44 à D49, D56 à D59 ; API dans SPEC §7) : `index.js` reçoit les requêtes (et **n'exporte que des fonctions** : le Workers runtime refuse tout autre export ; il sert aussi `/images/<id>` depuis D1, avant les fichiers de `site/`), `seance.js` porte les règles d'une séance (pur, testé), `attestation.js` celles de l'attestation (code, enregistrement figé, adresse du QR), `acces.js` celles de l'accès (limites de débit, verrous, cookie professeur et ses deux rôles, mot d'effacement), `editeur.js` celles de l'éditeur (aperçu, import), `images.js` celles des images (types lus dans les octets, empreinte, en-têtes, utilisations), `svg.js` l'assainissement d'un SVG, `base.js` tout le SQL, `crypto.js` le NIP, le jeton, les signatures, `catalogue.js` assemble une **version publiée** d'exercice depuis D1 (tables + copies d'outils) — une séance est épinglée à la sienne (D47). Il importe le moteur de `site/js/` : un seul exemplaire. `site/js/api.js` est son pendant côté navigateur.
- `site/verifier.html` et `site/prof.html` — la page publique de vérification d'une attestation et l'espace professeur (SPEC §8) ; leurs écrans sont `site/js/ui/verifier.js` et `prof.js`, leurs règles `attestation-data.js` et `prof-data.js` (pures, testées).
- `site/js/ui/` — les écrans. Ce qu'on montre et quand est décidé par des fonctions **pures, testées** (`text.js`, `rules.js`, `sheets-data.js`) ; les fichiers `*-screen.js` ne font que construire le DOM. Une règle d'affichage nouvelle va dans les premiers, avec son test.
- `migrations/*.sql` — schéma de la base D1. Un fichier appliqué n'est **jamais modifié** : un changement = un nouveau fichier numéroté. `deploy.yml` les applique en production avant chaque déploiement.
- `reference/pictogrammes-du-classeur/` — le convertisseur DrawingML → SVG des pictogrammes d'opérations (D29). Les SVG de `site/img/pictos/operations/` ne se retouchent pas à la main : on relance la conversion.
- `docs/rapports/<jalon>-<sujet>.md` (ou `<sujet>.md` pour une session hors jalon) — les rapports de fin de session, tels qu'écrits à Thierry (règle 8 ci-dessous) : ce qui a été fait, vérifié, et les points douteux à trancher.
- `legacy/vba/*.bas|.cls|.frm` — VBA d'origine, à consulter quand la SPEC est muette. Ne pas le modifier.

## Pile et structure (décisions D3, D19, D20, D22)

- HTML/CSS/JS natif (modules ES), **aucun framework, aucune étape de build**.
  `site/` est publié tel quel.
- **Un seul Worker Cloudflare** (`worker/`, `wrangler.jsonc`) sert `site/` comme
  ressources statiques et expose l'API du **serveur de correction** sous `/api/`
  (D19 : l'état de séance, la correction et la signature de la réussite vivent
  sur le serveur ; le navigateur affiche). Base **D1** (liaison `DB`), secrets
  `CLE_SECRETE`, `CLE_ADMIN` et `CLE_CONSULTATION` (D44) posés sur le Worker —
  en local : `.dev.vars`, jamais commité. Déployé par GitHub Actions à chaque push sur `main` :
  `npm test`, migrations D1, puis `wrangler deploy`.
- Node.js ≥ 22.13 sert aux tests (`node --test` ; la base des tests du serveur
  est `node:sqlite`, sans dépendance) et à `wrangler`, **seule
  `devDependency`**, version épinglée.
- Une seule dépendance d'exécution autorisée : une bibliothèque QR code,
  version épinglée, copiée dans `site/vendor/`. Ne pas en ajouter d'autre sans
  décision dans `DECISIONS.md`. Les polices sont des fichiers copiés dans
  `site/fonts/` : aucune requête vers un domaine externe.

```
site/              pages publiées : index.html (le quiz), verifier.html, prof.html, prof/editeur.html ; css/, js/, fonts/, vendor/ (bibliothèque QR)
site/data/         tables de référence et banque d'outils au format JSON : semence de la base et données des tests (D47)
site/exercices/    exercices au format fichier (SPEC §10) : semence (les deux M10) et tests
site/img/outils/   photos des outils (semence de la table images, D56) ; site/img/pictos/operations/ : les pictogrammes (semence aussi) ; site/img/copeaux/ : chaleur et copeaux par classe ISO (D64, semence aussi)
worker/            le Worker : API /api/… du serveur de correction et de l'éditeur, et /images/<id> (décisions D19, D20, D47, D56)
migrations/        schéma de la base D1, un fichier SQL numéroté par changement ; 0005 sème la banque et les exercices, 0007 les images, 0009 les images de classe
reference/         outillage ponctuel : convertisseur des pictogrammes (D29), générateurs des semences 0005, 0007 et 0009, détourage des images de classe (D64)
wrangler.jsonc     configuration du Worker (nom, ressources statiques, base D1)
tests/             tests du moteur et du serveur (node --test) ; api-locale.mjs = npm run test:api
docs/              SPEC, UI (+ maquettes/), DECISIONS, PLAN ; rapports/ = un rapport de fin de session par jalon
legacy/            classeur .xlsm, VBA exporté, index.htm actuel — lecture seule
```

## Conventions (décision D4)

- Interface, commentaires, documentation, messages de commit : **français**.
- Identifiants de code : anglais, `camelCase` ; fichiers JS en `kebab-case`.
- Clés JSON de données : français, `snake_case`, sans accents.
- Unités impériales partout dans le moteur (po, pi/min, rév/min, po/min) ;
  les conversions se font à la lecture des données, jamais dans les calculs.
- Formule pédagogique du cours : `N = Vc × 4 / D` (pas 3,82). Ne pas « corriger ».

## Façon de travailler

1. **Lire la tâche dans `docs/PLAN.md`** et la section correspondante de `SPEC.md` avant de coder.
2. **Moteur d'abord, interface ensuite.** Toute fonction de calcul ou de correction a un test avant d'être branchée à l'interface. Côté serveur : une règle va dans `worker/seance.js` (pur), et chaque route a ses cas dans `tests/worker-api.test.js`.
3. **Aléa et horloge injectables** : les fonctions de tirage reçoivent une source aléatoire, le serveur reçoit l'heure (`handle(request, env, { now, random })`), pour être testables.
4. **Petits commits** en français, un sujet par commit (`Ajoute le calcul de N avec plafond RPM`).
   Un commit n'est créé que si `npm test` affiche `fail 0`. Un commit local non
   poussé qui s'avère rouge est **amendé**, jamais suivi d'un commit de réparation.
   **À la fin d'une session, pousser la branche de travail** (`git push -u origin <branche>`),
   **jamais `main`**, jamais de fusion : Thierry relit les rapports sur GitHub et fusionne lui-même (D51).
5. **Ne pas modifier `site/data/*.json`** pour faire passer un test : si une donnée semble fausse, le signaler à Thierry (c'est lui qui connaît le métier). Depuis D47, une correction de donnée se fait **dans l'éditeur, en production** (banque, exercices) ; le JSON du dépôt reste la semence d'origine et ne se retouche que pour les tests, jamais pour « corriger la production ».
6. Quand la SPEC est ambiguë : proposer une interprétation, l'écrire en commentaire `// ❓` et le signaler en fin de session — ne pas décider en silence.
7. Vérifier que `node --test` passe et que `site/index.html`, servi par `npm run dev`, s'ouvre sans erreur console avant de conclure une tâche.
8. **Chaque rapport de fin de session écrit à Thierry est aussi enregistré dans `docs/rapports/<jalon>-<sujet>.md`** (ex. `jalon-5-attestation.md`) et commité avec le travail, points douteux compris : la conversation s'oublie, le dépôt reste.

## Commandes

```
npm test                 # tests unitaires, dont l'API du serveur sur une base SQLite en mémoire
npm run test:api         # l'API par HTTP sur wrangler dev et une vraie D1 locale jetable (~1 min : cadence réelle, puis CADENCE_S:1 pour le cycle complet)
npm run dev              # migrations locales, puis wrangler dev : le site et l'API (http://localhost:8787)
                         # avec MODE_TEST=1 dans .dev.vars : mode test (D26), réponses jointes par le serveur — local seulement
npm run deploy           # migrations de production puis wrangler deploy — normalement fait par GitHub Actions, pas à la main
```

## Ce qu'il ne faut pas faire

- Ajouter un framework, un bundler, TypeScript, ou une dépendance CDN au moment de l'exécution.
- Envoyer des données d'étudiants ailleurs qu'au serveur de correction du projet (D19), ou charger quoi que ce soit d'un domaine externe.
- Réécrire `legacy/`.
- Modifier un fichier de `migrations/` déjà appliqué, ou toucher à la base de production (`--remote`) sans que Thierry le demande.
- Écrire un secret (`CLE_SECRETE`, `CLE_ADMIN`, `CLE_CONSULTATION`, jeton Cloudflare) dans le dépôt, un test, un journal ou une conversation.
- Mettre `MODE_TEST` dans `wrangler.jsonc`, dans le déploiement ou en production, ou l'activer depuis le navigateur (D26) : c'est le serveur local seul qui décide. Toute donnée ajoutée à `seance.question` se juge à la règle « rien de ce qui est à trouver ne part au navigateur » (SPEC §7).
- Changer le format des JSON de données sans mettre à jour `SPEC.md` §3 et les tests de validation — le même format vit maintenant en base (colonnes JSON) : un changement de format demande une migration qui réécrit les lignes, ou des valeurs par défaut à la lecture (`completeTables`, D61), jamais une retouche d'une version publiée.
- Remettre une couleur de sens en dur dans une feuille ou un écran : elles viennent des tables de la version en usage (`data.classesIso`, `data.toolMaterials`, `applyTableColors`) ; `tokens.css` n'en garde que les valeurs par défaut (D61).
- Croire que modifier `site/data/`, `site/exercices/` ou `site/img/` change quelque chose en production (D47, D56) : c'est l'éditeur `/prof/editeur` qui écrit en base (exercices, banque, images), et l'export JSON de l'éditeur qui sauvegarde.
- Servir un SVG reçu tel quel, ou une image sous un type qui n'est pas celui de ses octets (D57) : tout passe par `readUpload` et `sanitizeSvg`.
