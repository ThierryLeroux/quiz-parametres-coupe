# Feuille de route

Chaque jalon est découpé en tâches assez petites pour une session Claude Code
(une tâche = une branche ou un commit cohérent, testé). Cocher au fur et à mesure.

## Jalon 0 — Dépôt en place
- [x] Dépôt GitHub créé, squelette commité
- [ ] GitHub Pages activé sur `site/` (quand `site/index.html` existera)
- [x] VS Code + extension Claude Code opérationnels ; `CLAUDE.md` lu par Claude Code
- [x] `npm test` (tests vides) passe

## Jalon 1 — Moteur de calcul et de correction (aucune interface)
- [x] `site/js/data.js` : chargement et validation des 3 JSON
- [x] `site/js/question.js` : génération d'une question (SPEC §4), aléa injectable pour les tests
- [x] `site/js/calcul.js` : Vc, N, fz, f, Vf (SPEC §5) ; `site/js/format.js` : arrondis d'affichage
- [x] `site/js/correction.js` : tolérances par champ (SPEC §6)
- [ ] Tests unitaires : cas de référence recalculés à la main depuis le classeur
      (au moins un par famille : fixe, proportionnelle, filetage impérial, filetage métrique, limite RPM)
- [ ] Concilier les arrondis d'affichage (SPEC §5) et les tolérances (SPEC §6) :
      test `todo` de `tests/chaine.test.js` (micro-forets, N de filetage, lame à tronçonner)

## Jalon 1b — Modèle d'exercice et progression (décisions D11, D12)
- [x] `reussites_requises` sort d'`outils.json` ; `site/exercices/m10-tournage-vc.json` (SPEC §10)
- [x] `site/js/exercice.js` : validation et chargement d'un exercice
- [x] `site/js/progression.js` : réussites consécutives, outils admissibles, exercice complété (SPEC §7)

## Jalon 2 — Interface du quiz
- [ ] `site/exercices/index.json` et sélection de l'exercice
- [ ] Écran d'identification (prénom, nom, matricule, numéro Moodle)
- [ ] Écran question : outil, dimension, matériau, 5 champs (évalués ou pré-remplis), correction visuelle
- [ ] Progression par outil / opération, sauvegarde de session en `localStorage`

## Jalon 3 — Rapport, code Moodle, QR
- [ ] Calcul du code de réussite (SPEC §8) et test contre des valeurs connues
- [ ] Page rapport imprimable + QR code (bibliothèque vendorisée)
- [ ] Compatibilité avec la page de vérification actuelle (`legacy/index.htm`) ou nouvelle page

## Jalon 4 — Éditeur web du catalogue et des exercices (décision D11)
- [ ] `site/editeur/` : éditer un exercice (outils, réussites, champs évalués, restrictions), validé par `exercice.js`
- [ ] Éditer le catalogue (outils, matériaux, opérations), validé par `data.js`
- [ ] Télécharger les JSON produits ; mode d'emploi « déposer dans le dépôt et commettre »

## Jalon 5 — Finition
- [ ] Images d'outils exportées du classeur (PNG/SVG) dans `site/img/outils/` et affichées
- [ ] Graphique de progression par opération
- [ ] Essai avec un groupe d'étudiants ; correctifs
- [ ] Décision D6 (sécurité) et D7 (dépôt) closes
