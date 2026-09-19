# Quiz de paramètres de coupe — version web

Exerciseur auto-corrigé pour les étudiants en Techniques de génie mécanique
(Cégep du Vieux Montréal) : calcul des paramètres de coupe (vitesse de coupe,
vitesse de rotation, avances) pour une opération de tournage, de fraisage ou de
perçage tirée au hasard. À la réussite, l'étudiant obtient un rapport, un code
de réussite Moodle et un QR code de vérification.

Ce projet remplace un classeur Excel/VBA (`legacy/`) par un site statique
HTML/JS hébergé sur GitHub Pages. **État : squelette — jalon 0** (voir
`docs/PLAN.md`).

## Structure

```
CLAUDE.md        contexte et conventions pour Claude Code (lu à chaque session)
docs/            SPEC.md (comportement), DECISIONS.md (journal), PLAN.md (jalons), DEMARRAGE.md (installation)
data/            données de référence en JSON : matériaux, opérations, outils
site/            le site publié (à construire)
tests/           tests unitaires — `npm test`
legacy/          classeur d'origine, VBA exporté, page de vérification actuelle
```

## Développer

Prérequis : Git, Node.js (tests seulement), VS Code avec l'extension Claude Code.

```
npm test          # tests unitaires
npm run serve     # servir site/ en local
```

Publier = pousser sur la branche principale ; GitHub Pages sert `site/`.

## Données

Les tables de vitesses de coupe (ISO 513 / VDI 3323), d'avances et d'outils
sont dans `data/*.json`. Modifier une valeur pédagogique = éditer le JSON,
lancer `npm test`, commettre. Unités impériales.

## Licence

Usage pédagogique interne — à préciser.
