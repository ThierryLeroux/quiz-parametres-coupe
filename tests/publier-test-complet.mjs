// Publie l'exercice « test-complet » sur la base D1 LOCALE, celle de `npm run dev` (décision D70) :
//
//     npm run publier:test-complet
//
// test-complet (D26) n'est pas semé (D47) : sans ce script, une base locale neuve ne l'a pas. Le script prend
// site/exercices/test-complet.json et la banque d'outils de la base locale, et fait ce que fait « Publier » dans
// la Gestion du contenu, avec le même code (worker/base.js, draftErrors, sameContent) : les copies des outils de la banque,
// les tables de référence les plus récentes, la validation, la version suivante et une ligne au journal des
// actions. Le brouillon local de test-complet est remplacé ; si la dernière version est identique, rien n'est
// publié. Il marche `npm run dev` arrêté ou en marche.
//
// La base locale est ouverte par wrangler (getPlatformProxy), comme `wrangler dev` l'ouvre. **--remote est
// refusé** : la base de production ne se touche pas d'ici.
//   --persist-to <dossier> : la base locale d'un `wrangler dev --persist-to <dossier>`, au lieu de .wrangler/state
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as base from '../worker/base.js';
import { tablesOf } from '../worker/catalogue.js';
import { sameContent } from '../worker/editeur.js';
import { draftErrors, draftFromExercise } from '../site/js/exercice.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ID = 'test-complet';
const JOURNAL = 'script local (npm run publier:test-complet)';

// Publie test-complet sur `db` — la D1 locale, ou la fausse D1 des tests. `fichier` : le contenu de
// site/exercices/test-complet.json. Retourne { numero, tables, outils, cree, identique, archive }.
// Lève une erreur si le brouillon ne se publierait pas (outil absent de la banque, erreurs de validation).
export async function publishTestComplet(db, fichier, now) {
  const row = await base.findLatestTables(db);
  const tables = { id: row.id, ...tablesOf(row) };
  const brouillon = draftFromExercise(fichier, (await base.listBankTools(db)).map((tool) => tool.outil));
  const erreurs = draftErrors(brouillon, tables);
  if (erreurs.length > 0) throw new Error(`test-complet a ${erreurs.length} erreur(s) avec la banque et les tables « ${tables.id} » de la base locale :\n${erreurs.map((e) => `  ${e.champ} : ${e.message}`).join('\n')}`);

  const at = now.toISOString();
  const entry = (action, details) => ({ horodatage: at, enseignant: JOURNAL, action, details });
  const conflict = () => new Error('test-complet a changé pendant le script (Gestion du contenu ouverte ?) : relance-le.');
  let record = await base.findExercise(db, ID);
  const cree = record === null;
  if (cree) {
    await base.createExercise(db, { id: ID, brouillon, tablesId: tables.id, now: at }, entry('editeur_creation', `${ID} · ${brouillon.titre}`));
  } else {
    if (record.tables_id !== tables.id && !(await base.setExerciseTables(db, ID, record.revision, tables.id, at, entry('editeur_tables_exercice', `${ID} · tables ${record.tables_id ?? '—'} → ${tables.id}`)))) throw conflict();
    record = await base.findExercise(db, ID);
    if (!sameContent(record.brouillon, brouillon) && !(await base.saveDraft(db, ID, record.revision, brouillon, at, entry('editeur_enregistrement', `${ID} · révision ${record.revision + 1}`)))) throw conflict();
  }

  record = await base.findExercise(db, ID);
  const latest = await base.findLatestVersion(db, ID);
  const summary = { tables: tables.id, outils: brouillon.outils.length, cree, archive: record.archive_le !== null };
  if (latest !== null && sameContent(record.brouillon, latest.contenu) && latest.tables_id === tables.id) return { ...summary, numero: latest.numero, identique: true };
  const numero = (latest?.numero ?? 0) + 1;
  const published = await base.publishVersion(db, { id: ID, revision: record.revision, numero, contenu: record.brouillon, tablesId: tables.id, now: at }, entry('editeur_publication', `${ID} · version ${numero} · tables ${tables.id}`));
  if (!published) throw conflict();
  return { ...summary, numero, identique: false };
}

// Les arguments : rien, ou --persist-to <dossier>. Tout ce qui parle de « remote » est refusé.
export function readArguments(args) {
  let persistTo = null;
  for (let i = 0; i < args.length; i += 1) {
    if (/remote/i.test(args[i])) throw new Error('--remote est refusé : ce script ne publie que sur la base locale (D70). La production se règle dans la Gestion du contenu.');
    if (args[i] === '--persist-to' && typeof args[i + 1] === 'string') {
      persistTo = args[i + 1];
      i += 1;
    } else {
      throw new Error(`argument inconnu : « ${args[i]} » (seul --persist-to <dossier> est permis)`);
    }
  }
  return { persistTo };
}

async function main() {
  const { persistTo } = readArguments(process.argv.slice(2));
  const where = persistTo === null ? [] : ['--persist-to', persistTo];
  // Une base locale neuve (dépôt fraîchement cloné) n'a pas encore ses tables : les migrations d'abord, comme `npm run dev`.
  const wrangler = join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const migrations = spawnSync(process.execPath, [wrangler, 'd1', 'migrations', 'apply', 'quiz-parametres-coupe', '--local', ...where], { cwd: ROOT, encoding: 'utf8' });
  if (migrations.status !== 0) throw new Error(`migrations locales : ${migrations.stdout}\n${migrations.stderr}`);

  const { getPlatformProxy } = await import('wrangler');
  const proxy = await getPlatformProxy({ configPath: join(ROOT, 'wrangler.jsonc'), persist: persistTo === null ? true : { path: join(persistTo, 'v3') } });
  try {
    const fichier = JSON.parse(readFileSync(join(ROOT, 'site', 'exercices', `${ID}.json`), 'utf8'));
    const result = await publishTestComplet(proxy.env.DB, fichier, new Date());
    console.log(result.identique
      ? `Rien à publier : test-complet, version ${result.numero}, est identique (tables ${result.tables}, ${result.outils} outils).`
      : `test-complet ${result.cree ? 'créé et ' : ''}publié en version ${result.numero} sur la base locale (tables ${result.tables}, ${result.outils} outils).`);
    if (result.archive) console.log('Attention : test-complet est archivé dans cette base ; désarchive-le dans la Gestion du contenu pour ouvrir une séance.');
    console.log('Ouvre http://localhost:8787/?exercice=test-complet (MODE_TEST=1 dans .dev.vars pour le mode test, D26).');
  } finally {
    await proxy.dispose();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
