-- Jalon 6 (décision D45) : une séance supprimée par l'enseignant disparaît avec son journal, mais
-- ses attestations RESTENT, annulées « séance supprimée » : l'ancien code répond « annulée » avec la
-- date. La colonne seance_id des attestations devient donc facultative, mise à NULL par la base quand
-- la séance disparaît (au jalon 5, supprimer la séance emportait ses attestations : ON DELETE CASCADE).
-- SQLite ne modifie pas une contrainte en place : la table est recréée et ses lignes copiées, avec
-- leurs identifiants. Un fichier de migration appliqué n'est JAMAIS modifié.

CREATE TABLE attestations_nouvelle (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id        INTEGER REFERENCES seances (id) ON DELETE SET NULL,  -- NULL = séance supprimée (D45)
  code             TEXT NOT NULL UNIQUE,  -- 10 caractères de l'alphabet sans ambiguïté (D32), sans tiret
  enregistrement   TEXT NOT NULL,         -- JSON : l'attestation figée (SPEC §8)
  signature        TEXT NOT NULL,         -- HMAC-SHA-256 de la sérialisation canonique, base64url
  creee_le         TEXT NOT NULL,
  annulee_le       TEXT,                  -- NULL = en cours
  annulation_motif TEXT                   -- 'remise_a_zero' (D35), 'identite_corrigee' (D37) ou 'seance_supprimee' (D45)
);

INSERT INTO attestations_nouvelle (id, seance_id, code, enregistrement, signature, creee_le, annulee_le, annulation_motif)
  SELECT id, seance_id, code, enregistrement, signature, creee_le, annulee_le, annulation_motif FROM attestations;

DROP TABLE attestations;
ALTER TABLE attestations_nouvelle RENAME TO attestations;

CREATE INDEX attestations_par_seance ON attestations (seance_id, creee_le);
