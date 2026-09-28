-- Chantier E5, jalon E5-3 (décision D78) : la présentation des exercices en direct. Ce qui, dans un exercice, ne fait
-- qu'afficher — son titre, son cours, « À l'accueil » ; la photo et la note de chacune de ses copies d'outils — ne se
-- publie plus : il s'applique en direct, exercice par exercice, et se pose par-dessus toute version de l'exercice dans
-- ce que le serveur montre (jamais dans le tirage ni la correction). Les versions publiées et les brouillons ne changent pas.
-- Un fichier de migration appliqué n'est JAMAIS modifié.

-- La présentation en vigueur d'un exercice : une ligne, créée au premier « Appliquer ». Pas de ligne : rien d'appliqué,
-- la présentation est celle de la dernière version publiée de l'exercice (lue par le serveur), et rien ne change au
-- déploiement. `contenu` est le format de l'exercice réduit à la liste blanche ({ titre, cours, liste, outils: [{ id,
-- image, commentaire }] }, JSON) ; `revision` est le contrôle optimiste (D48 ; 0 = pas de ligne) ; `modifiee_le` et
-- `enseignant` disent la dernière application.
CREATE TABLE presentation_exercices (
  exercice_id TEXT PRIMARY KEY,
  contenu     TEXT NOT NULL,
  revision    INTEGER NOT NULL,
  modifiee_le TEXT,
  enseignant  TEXT
);

-- L'historique, par exercice : chaque contenu remplacé, gardé sans limite, pour « Rétablir » en un clic. `posee_le` et
-- `posee_par` disent quand et par qui il avait été appliqué (NULL : la présentation de départ, tirée de la dernière
-- version publiée) ; `remplacee_le`, `remplacee_par` et `action` quand, par qui et par quoi il a été remplacé.
CREATE TABLE presentation_exercices_historique (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  exercice_id   TEXT NOT NULL,
  contenu       TEXT NOT NULL,
  posee_le      TEXT,
  posee_par     TEXT,
  remplacee_le  TEXT NOT NULL,
  remplacee_par TEXT,
  action        TEXT NOT NULL CHECK (action IN ('application', 'retablissement', 'import'))
);
CREATE INDEX presentation_exercices_historique_exercice ON presentation_exercices_historique (exercice_id, id);
