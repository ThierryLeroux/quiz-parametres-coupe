-- Jalon 7b, partie B (décisions D61, D62) : les tables de référence s'éditent et se publient comme les
-- exercices. Un BROUILLON unique des tables (une seule ligne), modifiable, et les versions publiées
-- immuables de tables_reference (0005). Chaque exercice choisit la version de tables de son brouillon.
-- Un fichier de migration appliqué n'est JAMAIS modifié.

-- Le brouillon des tables : son contenu est { materiaux, operations } (les deux JSON de SPEC §3),
-- sa révision est le contrôle optimiste (D48), base_id la version publiée dont il est parti (la
-- dernière publication). Semé depuis la version la plus récente (« A2026_r0 » à ce jour).
CREATE TABLE brouillon_tables (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  contenu    TEXT NOT NULL,
  revision   INTEGER NOT NULL DEFAULT 1,
  modifie_le TEXT NOT NULL,
  base_id    TEXT REFERENCES tables_reference (id)
);
INSERT INTO brouillon_tables (id, contenu, revision, modifie_le, base_id)
  SELECT 1, json_object('materiaux', json(materiaux), 'operations', json(operations)), 1, creee_le, id
  FROM tables_reference ORDER BY creee_le DESC, id DESC LIMIT 1;

-- La version des tables que le brouillon d'un exercice utilise (D62) : la plus récente à sa création ;
-- les exercices existants prennent la plus récente d'aujourd'hui. Une publication d'exercice prend
-- celle-ci (versions_exercice.tables_id), plus « la plus récente ».
ALTER TABLE exercices ADD COLUMN tables_id TEXT REFERENCES tables_reference (id);
UPDATE exercices SET tables_id = (SELECT id FROM tables_reference ORDER BY creee_le DESC, id DESC LIMIT 1);
