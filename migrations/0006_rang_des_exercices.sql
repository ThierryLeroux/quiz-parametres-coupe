-- Jalon 7a, suites du rapport (décision D51) : ordre manuel des exercices. Le rang est celui de la
-- liste de l'éditeur (Monter / Descendre) et de l'accueil des étudiants ; un exercice créé ou importé
-- prend le dernier rang. Les deux M10 semés par la 0005 prennent 1 (vitesse de coupe) et 2 (Vc et RPM).
-- Un fichier de migration appliqué n'est JAMAIS modifié.

ALTER TABLE exercices ADD COLUMN rang INTEGER NOT NULL DEFAULT 0;
UPDATE exercices SET rang = 1 WHERE id = 'm10-tournage-vc';
UPDATE exercices SET rang = 2 WHERE id = 'm10-tournage-vc-rpm';
