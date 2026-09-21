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
- `site/data/*.json` — le **catalogue** : données de référence (matériaux, opérations, outils), unique exemplaire (décision D8). Extraites du classeur ; l'en-tête `_source` de chaque fichier dit d'où. Y vivent aussi le **gabarit de nom** de chaque outil (`format_identifiant`, D24), les deux diamètres de la barre à aléser (D25), les débuts de famille (D27) et la révision des tables (D28).
- `site/exercices/<id>.json` — les **exercices** configurables (décision D11, schéma dans SPEC §10) : outils évalués, réussites requises, champs évalués, restrictions. `test-complet` couvre tout le catalogue, pour les essais (D26).
- `worker/` — le **serveur de correction** (décisions D19 à D22, API dans SPEC §7) : `index.js` reçoit les requêtes, `seance.js` porte les règles (pur, testé), `base.js` tout le SQL, `crypto.js` le NIP et le jeton, `catalogue.js` lit `site/data/` et `site/exercices/` par ASSETS. Il importe le moteur de `site/js/` : un seul exemplaire. `site/js/api.js` est son pendant côté navigateur.
- `site/js/ui/` — les écrans. Ce qu'on montre et quand est décidé par des fonctions **pures, testées** (`text.js`, `rules.js`, `sheets-data.js`) ; les fichiers `*-screen.js` ne font que construire le DOM. Une règle d'affichage nouvelle va dans les premiers, avec son test.
- `migrations/*.sql` — schéma de la base D1. Un fichier appliqué n'est **jamais modifié** : un changement = un nouveau fichier numéroté.
- `reference/pictogrammes-du-classeur/` — le convertisseur DrawingML → SVG des pictogrammes d'opérations (D29). Les SVG de `site/img/pictos/operations/` ne se retouchent pas à la main : on relance la conversion.
- `legacy/vba/*.bas|.cls|.frm` — VBA d'origine, à consulter quand la SPEC est muette. Ne pas le modifier.

## Pile et structure (décisions D3, D19, D20, D22)

- HTML/CSS/JS natif (modules ES), **aucun framework, aucune étape de build**.
  `site/` est publié tel quel.
- **Un seul Worker Cloudflare** (`worker/`, `wrangler.jsonc`) sert `site/` comme
  ressources statiques et expose l'API du **serveur de correction** sous `/api/`
  (D19 : l'état de séance, la correction et la signature de la réussite vivent
  sur le serveur ; le navigateur affiche). Base **D1** (liaison `DB`), secrets
  `CLE_SECRETE` et `CLE_ADMIN` posés sur le Worker — en local : `.dev.vars`,
  jamais commité. Déployé par GitHub Actions à chaque push sur `main` :
  `npm test`, migrations D1, puis `wrangler deploy`.
- Node.js ≥ 22.13 sert aux tests (`node --test` ; la base des tests du serveur
  est `node:sqlite`, sans dépendance) et à `wrangler`, **seule
  `devDependency`**, version épinglée.
- Une seule dépendance d'exécution autorisée : une bibliothèque QR code,
  version épinglée, copiée dans `site/vendor/`. Ne pas en ajouter d'autre sans
  décision dans `DECISIONS.md`. Les polices sont des fichiers copiés dans
  `site/fonts/` : aucune requête vers un domaine externe.

```
site/              page publiée (index.html, css/, js/, fonts/, vendor/)
site/data/         catalogue : JSON de référence, unique exemplaire (décisions D8, D11)
site/exercices/    un JSON par exercice configurable (décision D11, SPEC §10)
site/img/outils/   images des outils
site/editeur/      éditeur web statique du catalogue et des exercices (jalon 6)
worker/            le Worker : API /api/… du serveur de correction (décisions D19, D20)
migrations/        schéma de la base D1, un fichier SQL numéroté par changement
wrangler.jsonc     configuration du Worker (nom, ressources statiques, base D1)
tests/             tests du moteur et du serveur (node --test) ; api-locale.mjs = npm run test:api
docs/              SPEC, UI (+ maquettes/), DECISIONS, PLAN
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
5. **Ne pas modifier `site/data/*.json`** pour faire passer un test : si une donnée semble fausse, le signaler à Thierry (c'est lui qui connaît le métier).
6. Quand la SPEC est ambiguë : proposer une interprétation, l'écrire en commentaire `// ❓` et le signaler en fin de session — ne pas décider en silence.
7. Vérifier que `node --test` passe et que `site/index.html`, servi par `npm run dev`, s'ouvre sans erreur console avant de conclure une tâche.

## Commandes

```
npm test                 # tests unitaires, dont l'API du serveur sur une base SQLite en mémoire
npm run test:api         # l'API par HTTP sur wrangler dev et une vraie D1 locale jetable (~30 s)
npm run dev              # migrations locales, puis wrangler dev : le site et l'API (http://localhost:8787)
                         # avec MODE_TEST=1 dans .dev.vars : mode test (D26), réponses jointes par le serveur — local seulement
npm run deploy           # migrations de production puis wrangler deploy — normalement fait par GitHub Actions, pas à la main
```

## Ce qu'il ne faut pas faire

- Ajouter un framework, un bundler, TypeScript, ou une dépendance CDN au moment de l'exécution.
- Envoyer des données d'étudiants ailleurs qu'au serveur de correction du projet (D19), ou charger quoi que ce soit d'un domaine externe.
- Réécrire `legacy/`.
- Modifier un fichier de `migrations/` déjà appliqué, ou toucher à la base de production (`--remote`) sans que Thierry le demande.
- Écrire un secret (`CLE_SECRETE`, `CLE_ADMIN`, jeton Cloudflare) dans le dépôt, un test, un journal ou une conversation.
- Mettre `MODE_TEST` dans `wrangler.jsonc`, dans le déploiement ou en production, ou l'activer depuis le navigateur (D26) : c'est le serveur local seul qui décide. Toute donnée ajoutée à `seance.question` se juge à la règle « rien de ce qui est à trouver ne part au navigateur » (SPEC §7).
- Changer le format des JSON de données sans mettre à jour `SPEC.md` §3 et les tests de validation.
