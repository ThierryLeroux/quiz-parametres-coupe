# Feuille de route

Chaque jalon est découpé en tâches assez petites pour une session Claude Code
(une tâche = une branche ou un commit cohérent, testé). Cocher au fur et à mesure.

## Jalon 0 — Dépôt en place
- [ ] Dépôt GitHub créé, squelette commité, GitHub Pages activé sur `site/`
- [ ] VS Code + extension Claude Code opérationnels ; `CLAUDE.md` lu par Claude Code
- [ ] `npm test` (tests vides) passe

## Jalon 1 — Moteur de calcul et de correction (aucune interface)
- [ ] `site/js/data.js` : chargement et validation des 3 JSON
- [ ] `site/js/question.js` : génération d'une question (SPEC §4), aléa injectable pour les tests
- [ ] `site/js/calcul.js` : Vc, N, fz, f, Vf (SPEC §5)
- [ ] `site/js/correction.js` : tolérances par champ (SPEC §6)
- [ ] Tests unitaires : cas de référence recalculés à la main depuis le classeur
      (au moins un par famille : fixe, proportionnelle, filetage impérial, filetage métrique, limite RPM)

## Jalon 2 — Interface du quiz
- [ ] Écran d'identification (prénom, nom, matricule, numéro Moodle)
- [ ] Écran question : outil, dimension, matériau, 5 champs de réponse, correction visuelle
- [ ] Progression par outil / opération, sauvegarde de session en `localStorage`
- [ ] Configuration d'exercice `exercices/m10-tournage-vc.json` et sélection de l'exercice

## Jalon 3 — Rapport, code Moodle, QR
- [ ] Calcul du code de réussite (SPEC §8) et test contre des valeurs connues
- [ ] Page rapport imprimable + QR code (bibliothèque vendorisée)
- [ ] Compatibilité avec la page de vérification actuelle (`legacy/index.htm`) ou nouvelle page

## Jalon 4 — Finition
- [ ] Images d'outils exportées du classeur (PNG/SVG) et affichées
- [ ] Graphique de progression par opération
- [ ] Essai avec un groupe d'étudiants ; correctifs
- [ ] Décision D6 (sécurité) et D7 (dépôt) closes
