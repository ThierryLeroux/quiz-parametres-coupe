-- Chantier E5, jalon E5-4 (décision D79) : l'historique de la banque d'outils. Chaque enregistrement d'un outil garde le
-- contenu qu'il remplace, sans limite, pour « Rétablir » en un clic. L'archivage n'y entre pas. La banque ne touche aucun
-- exercice (D47) : rien ne change pour les séances.
-- Un fichier de migration appliqué n'est JAMAIS modifié.

-- Qui a enregistré le contenu actuel d'un outil (NULL : un outil d'avant ce jalon, semé ou créé avant). Avec `modifie_le`,
-- c'est ce que l'historique retient du contenu quand il est remplacé.
ALTER TABLE banque_outils ADD COLUMN modifie_par TEXT;

-- L'historique : un contenu remplacé par ligne — l'identifiant de l'outil (gardé même si l'outil disparaît : un import qui
-- le retire y met son dernier contenu), le contenu (l'outil au format de la banque, JSON), quand et par qui il avait été
-- enregistré, quand, par qui et par quoi il a été remplacé : un enregistrement, un rétablissement ou un import.
CREATE TABLE banque_outils_historique (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  outil_id       TEXT NOT NULL,
  contenu        TEXT NOT NULL,
  enregistre_le  TEXT,
  enregistre_par TEXT,
  remplace_le    TEXT NOT NULL,
  remplace_par   TEXT,
  action         TEXT NOT NULL CHECK (action IN ('enregistrement', 'retablissement', 'import'))
);
CREATE INDEX banque_outils_historique_outil ON banque_outils_historique (outil_id, id);
