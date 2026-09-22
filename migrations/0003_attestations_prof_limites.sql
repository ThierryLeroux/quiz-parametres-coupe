-- Jalon 5 (décisions D31 à D36) : attestation signée, espace professeur, limites de débit.
-- Un fichier de migration appliqué n'est JAMAIS modifié : un changement = un nouveau fichier.

-- Attestation de réussite (D31, D32) : un enregistrement FIGÉ à la réussite, qui ne change plus
-- jamais — ni avec le catalogue, ni avec l'exercice, ni avec une correction d'identité. Une séance
-- peut en avoir plusieurs dans le temps : une remise à zéro par l'enseignant (D35) annule
-- l'attestation en cours (annulee_le), et une nouvelle réussite en crée une autre, avec un autre
-- code. L'ancien code reste vérifiable et répond « annulée ».
CREATE TABLE attestations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id      INTEGER NOT NULL REFERENCES seances (id) ON DELETE CASCADE,
  code           TEXT NOT NULL UNIQUE,  -- 10 caractères de l'alphabet sans ambiguïté (D32), sans tiret
  enregistrement TEXT NOT NULL,         -- JSON : l'attestation figée (SPEC §8)
  signature      TEXT NOT NULL,         -- HMAC-SHA-256 de la sérialisation canonique, base64url
  creee_le       TEXT NOT NULL,
  annulee_le     TEXT                   -- remise à zéro par l'enseignant ; NULL = en cours
);

CREATE INDEX attestations_par_seance ON attestations (seance_id, creee_le);

-- Journal des actions d'enseignant (D34, D35) : connexions, refus, remises à zéro. L'identifiant
-- d'enseignant est « admin » au jalon 5 ; une table des enseignants s'y raccordera au jalon 6.
-- Une ligne par action, jamais modifiée ; la séance peut disparaître, la ligne reste.
CREATE TABLE journal_enseignant (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  horodatage TEXT NOT NULL,
  enseignant TEXT,                      -- NULL pour une connexion refusée (on ne sait pas qui)
  seance_id  INTEGER REFERENCES seances (id) ON DELETE SET NULL,
  action     TEXT NOT NULL,             -- 'connexion', 'connexion_refusee', 'remise_a_zero'
  details    TEXT                       -- texte libre : adresse, matricule et exercice…
);

CREATE INDEX journal_enseignant_par_date ON journal_enseignant (horodatage);

-- Limites de débit (D36) : les valeurs DISTINCTES vues par adresse et par tranche horaire — les
-- matricules consultés, les codes vérifiés. Ce qui compte, c'est le nombre de lignes par
-- (portee, adresse, tranche) ; une valeur déjà vue ne compte pas deux fois. Les tranches passées
-- sont effacées au fil de l'eau.
CREATE TABLE debit (
  portee  TEXT NOT NULL,                -- 'consultation' (matricules) ou 'verification' (codes)
  adresse TEXT NOT NULL,                -- adresse IP du demandeur
  tranche TEXT NOT NULL,                -- heure UTC : « 2026-09-21T13 »
  valeur  TEXT NOT NULL,
  PRIMARY KEY (portee, adresse, tranche, valeur)
);

-- Verrous par adresse : après un refus de débit (délai fixe), ou après des connexions professeur
-- ratées (délai croissant avec le nombre d'échecs).
CREATE TABLE verrous (
  portee  TEXT NOT NULL,                -- 'consultation', 'verification', 'prof'
  adresse TEXT NOT NULL,
  echecs  INTEGER NOT NULL DEFAULT 0,   -- connexions professeur ratées de suite
  jusqua  TEXT,                         -- refusé (429) jusqu'à cette date ; NULL = pas de verrou
  PRIMARY KEY (portee, adresse)
);
