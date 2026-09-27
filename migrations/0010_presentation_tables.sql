-- Chantier E5, jalon E5-1 (décisions D75, D76) : la présentation des tables en direct. Ce qui ne fait qu'afficher —
-- nom et couleurs des classes ISO, image de chaleur, légende, caractéristiques ; couleur des matières d'outil ;
-- pictogramme des opérations — ne se publie plus : il s'applique en direct et se pose par-dessus toute version des
-- tables à l'affichage (jamais dans la correction ni l'attestation). Les tables publiées et le brouillon ne changent pas.
-- Un fichier de migration appliqué n'est JAMAIS modifié.

-- La présentation en vigueur : une seule ligne. `contenu` est le format des tables réduit à la liste blanche
-- ({ classes_iso, materiaux_outil, operations }, JSON) ; NULL tant que rien n'a été appliqué : la présentation est
-- alors celle de la dernière version publiée des tables (lue par le serveur), et rien ne change au déploiement.
-- `revision` est le contrôle optimiste (D48) ; `modifiee_le` et `enseignant` disent la dernière application.
CREATE TABLE presentation_tables (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  contenu     TEXT,
  revision    INTEGER NOT NULL DEFAULT 0,
  modifiee_le TEXT,
  enseignant  TEXT
);
INSERT INTO presentation_tables (id, contenu, revision) VALUES (1, NULL, 0);

-- L'historique : chaque contenu remplacé, gardé sans limite, pour « Rétablir » en un clic. `posee_le` et `posee_par`
-- disent quand et par qui il avait été appliqué (NULL : la présentation de départ, tirée des tables publiées) ;
-- `remplacee_le`, `remplacee_par` et `action` quand, par qui et par quoi il a été remplacé : application,
-- retablissement ou import.
CREATE TABLE presentation_tables_historique (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  contenu       TEXT NOT NULL,
  posee_le      TEXT,
  posee_par     TEXT,
  remplacee_le  TEXT NOT NULL,
  remplacee_par TEXT,
  action        TEXT NOT NULL CHECK (action IN ('application', 'retablissement', 'import'))
);
