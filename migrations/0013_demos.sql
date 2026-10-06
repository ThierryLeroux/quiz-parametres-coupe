-- Mode démo (décision D92) : une démo est une séance ANONYME, sans identification, qui ne laisse aucune trace
-- durable — rien dans seances, corrections, corrections_identite ni attestations. Son état vit ici le temps de la
-- démo, parce que c'est le serveur qui tire la question et la corrige, jamais le navigateur (SPEC §7). Aucune
-- donnée personnelle, pas même l'adresse. Une démo expire 24 h après sa dernière activité : le serveur la refuse,
-- l'efface à la prochaine création de démo, et l'effacement des données des étudiants (D46) l'efface aussi.
-- Un fichier de migration appliqué n'est JAMAIS modifié : un changement = un nouveau fichier.
CREATE TABLE demos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  jeton_hache         TEXT NOT NULL UNIQUE,   -- SHA-256 du jeton de démo (crypto.js), comme celui d'une séance
  exercice_id         TEXT NOT NULL,
  version_id          INTEGER NOT NULL,       -- la version publiée épinglée (D47) : celle en vigueur à la création
  outil_choisi        TEXT,                   -- l'outil des prochaines questions ; NULL = au hasard
  compteurs           TEXT NOT NULL,          -- JSON, comme seances.compteurs : { "reussites": {…}, "totalReussies": n }
  question_courante   TEXT,                   -- JSON : la question tirée, en attente de correction
  derniere_correction TEXT,                   -- pour la cadence de 10 s
  creee_le            TEXT NOT NULL,
  derniere_activite   TEXT NOT NULL           -- l'expiration (24 h) se compte à partir d'ici
);

CREATE INDEX demos_par_activite ON demos (derniere_activite);
