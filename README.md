# Quiz de paramètres de coupe — version web

Exerciseur auto-corrigé pour les étudiants en Techniques de génie mécanique
(Cégep du Vieux Montréal) : calcul des paramètres de coupe (vitesse de coupe,
vitesse de rotation, avances) pour une opération de tournage, de fraisage ou de
perçage tirée au hasard. À la réussite, l'étudiant obtient un rapport à
remettre sur Léa, avec un QR code de vérification pour l'enseignant.

Ce projet remplace un classeur Excel/VBA (`legacy/`) par un site HTML/JS sans
étape de construction et un petit **serveur de correction** : un seul Worker
Cloudflare sert le site et l'API `/api/` (décisions D19 et D20 de
`docs/DECISIONS.md`). **État : voir `docs/PLAN.md`.**

## Structure

```
CLAUDE.md        contexte et conventions pour Claude Code (lu à chaque session)
docs/            SPEC.md (comportement), UI.md (écrans), DECISIONS.md (journal), PLAN.md (jalons), DEMARRAGE.md (installation)
site/            le site publié, tel quel
site/data/       catalogue en JSON : matériaux, opérations, outils
site/exercices/  un JSON par exercice configurable (outils évalués, réussites, champs)
worker/          le Worker Cloudflare : API /api/ du serveur de correction
wrangler.jsonc   configuration du Worker
tests/           tests unitaires — `npm test`
legacy/          classeur d'origine, VBA exporté, page de vérification actuelle
```

## Développer

Prérequis : Git, Node.js 22, VS Code avec l'extension Claude Code.

```
npm install       # une fois : installe wrangler, la seule dépendance de développement
npm test          # tests unitaires
npm run dev       # le site et l'API en local (wrangler dev) : http://localhost:8787
```

Publier = pousser sur la branche principale : GitHub Actions lance `npm test`,
puis `wrangler deploy` (mise en place : `docs/DEMARRAGE.md`, étape 4).

## Données

Les tables de vitesses de coupe (ISO 513 / VDI 3323), d'avances et d'outils
sont dans `site/data/*.json`. Modifier une valeur pédagogique = éditer le JSON,
lancer `npm test`, commettre. Unités impériales.

## Licence

Usage pédagogique interne — à préciser.
