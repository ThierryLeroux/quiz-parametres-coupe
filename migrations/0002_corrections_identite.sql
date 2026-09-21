-- Journal des corrections d'identité (décision D23) : « Corriger mon identité » déplace la séance —
-- même ligne de la table seances, mêmes compteurs, même journal des corrections — et note ici ce
-- qui a changé, pour la page de vérification (jalon 5). Une ligne par correction, jamais modifiée.

CREATE TABLE corrections_identite (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id         INTEGER NOT NULL REFERENCES seances (id) ON DELETE CASCADE,
  ancien_prenom     TEXT NOT NULL,
  ancien_nom        TEXT NOT NULL,
  ancien_matricule  TEXT NOT NULL,
  nouveau_prenom    TEXT NOT NULL,
  nouveau_nom       TEXT NOT NULL,
  nouveau_matricule TEXT NOT NULL,
  horodatage        TEXT NOT NULL
);

CREATE INDEX corrections_identite_par_seance ON corrections_identite (seance_id, horodatage);
