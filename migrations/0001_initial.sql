-- Schéma initial du serveur de correction (décisions D19, D21, D22 ; SPEC §7).
-- Un fichier de migration appliqué n'est JAMAIS modifié : un changement = un nouveau fichier
-- (0002_…sql). Les dates sont des textes ISO 8601 en UTC (« 2026-09-21T13:05:00.000Z ») : elles
-- se comparent comme du texte. Les colonnes « JSON » contiennent du JSON en texte.

-- Une séance = un couple (exercice, matricule). Il n'y en a qu'une.
CREATE TABLE seances (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  exercice_id               TEXT NOT NULL,
  matricule                 TEXT NOT NULL,
  prenom                    TEXT NOT NULL,            -- ceux de la première visite (D21)
  nom                       TEXT NOT NULL,
  nip_hache                 TEXT,                     -- HMAC du NIP (D22) ; NULL = remis à zéro par l'enseignant
  jeton_hache               TEXT,                     -- SHA-256 du jeton de séance ; NULL = aucun jeton valide
  jeton_expire_le           TEXT,
  debut                     TEXT NOT NULL,
  derniere_activite         TEXT NOT NULL,
  derniere_correction       TEXT,                     -- pour la cadence de 10 s
  version_exercice          TEXT NOT NULL,            -- version de l'exercice au début de la séance
  version_exercice_reussite TEXT,                     -- … et à la réussite
  compteurs                 TEXT NOT NULL,            -- JSON : { "reussites": { "<id d'outil>": n }, "totalReussies": n }
  question_courante         TEXT,                     -- JSON : la question tirée, en attente de correction
  reussite_le               TEXT,                     -- date de réussite de l'exercice
  essais_nip                INTEGER NOT NULL DEFAULT 0, -- essais de NIP dans la fenêtre de 10 minutes en cours
  essais_nip_debut          TEXT,                     -- début de cette fenêtre
  verrou_nip_jusqua         TEXT,                     -- identification refusée (429) jusqu'à cette date
  UNIQUE (exercice_id, matricule)
);

CREATE INDEX seances_par_jeton ON seances (jeton_hache);

-- Journal des corrections : une ligne par clic sur « Vérifier », jamais modifiée.
CREATE TABLE corrections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id  INTEGER NOT NULL REFERENCES seances (id) ON DELETE CASCADE,
  outil_id   TEXT NOT NULL,
  question   TEXT NOT NULL,     -- JSON : la question tirée
  reponses   TEXT NOT NULL,     -- JSON : les saisies de l'étudiant, en texte
  resultat   TEXT NOT NULL,     -- JSON : correction champ par champ et valeurs attendues
  reussie    INTEGER NOT NULL,  -- 1 ou 0
  horodatage TEXT NOT NULL
);

CREATE INDEX corrections_par_seance ON corrections (seance_id, horodatage);
