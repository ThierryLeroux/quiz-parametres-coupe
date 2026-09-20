# CLAUDE.md — Quiz de paramètres de coupe (version web)

Ce fichier est lu automatiquement par Claude Code au début de chaque session.
Il résume le projet, les conventions et la façon de travailler. Les détails sont
dans `docs/`.

## Le projet en trois phrases

Exerciseur web auto-corrigé pour étudiants en génie mécanique (Cégep) : calcul
des paramètres de coupe (Vc, N, avances) pour une opération d'usinage tirée au
hasard. Il remplace un classeur Excel/VBA (`legacy/`) qu'on ne maintient plus.
À la réussite : rapport PDF à remettre sur Léa, avec QR code de vérification.

Propriétaire : Thierry, enseignant, expert en usinage CNC, développeur
occasionnel. Il maintiendra seul ce code pendant des années : **la simplicité et
la lisibilité priment sur l'élégance technique.**

## Où lire quoi

- `docs/SPEC.md` — comportement attendu (formules, tolérances, rapport). **Source de vérité fonctionnelle.** Les ❓ sont des questions ouvertes : ne pas les trancher seul, les remonter.
- `docs/UI.md` — écrans et présentation (langage visuel, parcours, composants, impression). **Source de vérité de la présentation**, au même titre que SPEC pour le comportement (décision D17) ; maquettes approuvées dans `docs/maquettes/`. En cas de contradiction : DECISIONS, puis SPEC, puis UI.
- `docs/DECISIONS.md` — décisions prises et ouvertes. Ne jamais contredire une décision fermée sans en ajouter une nouvelle.
- `docs/PLAN.md` — jalons et tâches. Travailler dans l'ordre, une tâche à la fois.
- `site/data/*.json` — le **catalogue** : données de référence (matériaux, opérations, outils), unique exemplaire (décision D8). Extraites du classeur ; l'en-tête `_source` de chaque fichier dit d'où.
- `site/exercices/<id>.json` — les **exercices** configurables (décision D11, schéma dans SPEC §10) : outils évalués, réussites requises, champs évalués, restrictions.
- `legacy/vba/*.bas|.cls|.frm` — VBA d'origine, à consulter quand la SPEC est muette. Ne pas le modifier.

## Pile et structure (décision D3)

- HTML/CSS/JS natif (modules ES), **aucun framework, aucune étape de build**.
  `site/` est publié tel quel par GitHub Pages.
- Node.js sert uniquement aux tests : `node --test` (voir `package.json`).
- Une seule dépendance d'exécution autorisée : une bibliothèque QR code,
  version épinglée, copiée dans `site/vendor/`. Ne pas en ajouter d'autre sans
  décision dans `DECISIONS.md`.

```
site/              page publiée (index.html, css/, js/, vendor/)
site/data/         catalogue : JSON de référence, unique exemplaire (décisions D8, D11)
site/exercices/    un JSON par exercice configurable (décision D11, SPEC §10)
site/img/outils/   images des outils (jalon 5)
site/editeur/      éditeur web statique du catalogue et des exercices (jalon 4)
tests/             tests unitaires du moteur (node --test)
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
2. **Moteur d'abord, interface ensuite.** Toute fonction de calcul ou de correction a un test avant d'être branchée à l'interface.
3. **Aléa injectable** : les fonctions de tirage reçoivent une source aléatoire en paramètre pour être testables.
4. **Petits commits** en français, un sujet par commit (`Ajoute le calcul de N avec plafond RPM`).
   Un commit n'est créé que si `npm test` affiche `fail 0`. Un commit local non
   poussé qui s'avère rouge est **amendé**, jamais suivi d'un commit de réparation.
5. **Ne pas modifier `site/data/*.json`** pour faire passer un test : si une donnée semble fausse, le signaler à Thierry (c'est lui qui connaît le métier).
6. Quand la SPEC est ambiguë : proposer une interprétation, l'écrire en commentaire `// ❓` et le signaler en fin de session — ne pas décider en silence.
7. Vérifier que `node --test` passe et que `site/index.html` s'ouvre sans erreur console avant de conclure une tâche.

## Commandes

```
npm test                 # tests unitaires
npx serve site           # servir le site en local (ou tout serveur statique)
```

## Ce qu'il ne faut pas faire

- Ajouter un framework, un bundler, TypeScript, ou une dépendance CDN au moment de l'exécution.
- Envoyer des données d'étudiants à un service externe.
- Réécrire `legacy/`.
- Changer le format des JSON de données sans mettre à jour `SPEC.md` §3 et les tests de validation.
