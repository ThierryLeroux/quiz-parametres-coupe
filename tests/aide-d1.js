// Fausse base D1 pour les tests (ce fichier n'est pas un test) : une base SQLite en mémoire
// (node:sqlite, le même moteur SQL que D1) où les VRAIES migrations de migrations/ sont appliquées,
// derrière la petite partie de l'interface D1 que le Worker utilise :
//   db.prepare(sql).bind(…).first() / .all() / .run()   et   db.batch([…])
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

const MIGRATIONS = new URL('../migrations/', import.meta.url);

// Les fichiers de migration, dans l'ordre de leurs numéros ; `jusqua` = seulement jusqu'à ce numéro.
function migrationFiles(jusqua = Infinity) {
  return readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql') && Number(name.slice(0, 4)) <= jusqua).sort();
}

// Le SQL de toutes les migrations (ou de celles jusqu'au numéro `jusqua`), dans l'ordre.
export function migrationsSql({ jusqua = Infinity } = {}) {
  return migrationFiles(jusqua).map((name) => readFileSync(new URL(name, MIGRATIONS), 'utf8')).join('\n');
}

// Le SQL d'une seule migration, par son numéro.
export function migrationSql(numero) {
  const [name] = migrationFiles(numero).slice(-1);
  if (Number(name?.slice(0, 4)) !== numero) throw new Error(`pas de migration ${numero}`);
  return readFileSync(new URL(name, MIGRATIONS), 'utf8');
}

// Une base neuve avec toutes les migrations — ou seulement jusqu'à `jusqua`, pour tester la suivante
// sur des données produites par le vrai serveur.
export function fausseD1({ jusqua = Infinity } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(migrationsSql({ jusqua }));

  function statement(sql, values = []) {
    // Comme D1 : « undefined » n'est pas une valeur SQL. Mieux vaut l'apprendre ici qu'en production.
    const check = () => values.forEach((value, i) => { if (value === undefined) throw new Error(`D1_TYPE_ERROR : le paramètre ${i + 1} est undefined — ${sql}`); });
    // Comme D1, un BLOB se donne en ArrayBuffer ; node:sqlite veut un Uint8Array.
    const bound = () => values.map((value) => (value instanceof ArrayBuffer ? new Uint8Array(value) : value));
    const rows = () => { check(); return sqlite.prepare(sql).all(...bound()).map((row) => ({ ...row })); };
    const execute = () => {
      check();
      // Comme D1, une requête qui lit (SELECT) rend ses lignes, même dans un lot.
      if (/^\s*(SELECT|WITH)\b/i.test(sql)) return { success: true, results: rows(), meta: { changes: 0, last_row_id: 0 } };
      const { changes, lastInsertRowid } = sqlite.prepare(sql).run(...bound());
      return { success: true, results: [], meta: { changes: Number(changes), last_row_id: Number(lastInsertRowid) } };
    };
    return {
      bind: (...bound) => statement(sql, bound),
      first: async () => rows()[0] ?? null,
      all: async () => ({ success: true, results: rows() }),
      run: async () => execute(),
      executeNow: execute, // pour batch, ci-dessous
    };
  }

  return {
    prepare: (sql) => statement(sql),
    // Comme D1 : les requêtes d'un lot forment une transaction — tout passe, ou rien.
    batch: async (statements) => {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((s) => s.executeNow());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    sqlite, // accès direct, pour qu'un test inspecte ou retouche la base
  };
}
