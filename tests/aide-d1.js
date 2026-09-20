// Fausse base D1 pour les tests (ce fichier n'est pas un test) : une base SQLite en mémoire
// (node:sqlite, le même moteur SQL que D1) où les VRAIES migrations de migrations/ sont appliquées,
// derrière la petite partie de l'interface D1 que le Worker utilise :
//   db.prepare(sql).bind(…).first() / .all() / .run()   et   db.batch([…])
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

const MIGRATIONS = new URL('../migrations/', import.meta.url);

// Le SQL de toutes les migrations, dans l'ordre de leurs numéros.
export function migrationsSql() {
  return readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()
    .map((name) => readFileSync(new URL(name, MIGRATIONS), 'utf8')).join('\n');
}

export function fausseD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(migrationsSql());

  function statement(sql, values = []) {
    // Comme D1 : « undefined » n'est pas une valeur SQL. Mieux vaut l'apprendre ici qu'en production.
    const check = () => values.forEach((value, i) => { if (value === undefined) throw new Error(`D1_TYPE_ERROR : le paramètre ${i + 1} est undefined — ${sql}`); });
    const rows = () => { check(); return sqlite.prepare(sql).all(...values).map((row) => ({ ...row })); };
    const execute = () => {
      check();
      const { changes, lastInsertRowid } = sqlite.prepare(sql).run(...values);
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
