// Aides des tests du serveur (ce fichier n'est pas un test) : le VRAI Worker (worker/index.js),
// appelé sans wrangler, avec une fausse D1 (aide-d1.js), les vrais fichiers de site/ en guise de
// liaison ASSETS, une horloge qu'on avance à la main et un aléa à graine.
import { readFile } from 'node:fs/promises';
import { handle } from '../worker/index.js';
import { computeParameters } from '../site/js/calcul.js';
import { formatParameters } from '../site/js/format.js';
import { fausseD1 } from './aide-d1.js';
import { aleaAGraine, data } from './aide.js';

// Fausse liaison ASSETS : sert les fichiers de site/ ; `remplacements` substitue un JSON à un
// fichier ({ 'exercices/index.json': {…} }) pour simuler un exercice ajouté ou modifié.
export function fauxSite(remplacements = {}) {
  return {
    fetch: async (request) => {
      const chemin = new URL(request.url).pathname.slice(1);
      if (chemin in remplacements) return Response.json(remplacements[chemin]);
      try {
        return new Response(await readFile(new URL(`../site/${chemin}`, import.meta.url)));
      } catch {
        return new Response('introuvable', { status: 404 });
      }
    },
  };
}

// Un serveur de test : sa base, son horloge, et `appel` pour lui parler.
//   appel('POST', '/api/question', { jeton, corps }) → { status, corps }
//   hote      : l'adresse à laquelle les requêtes sont faites — le mode test (D26) n'existe que sur localhost
//   variables : variables du Worker en plus des secrets, ex. { MODE_TEST: '1' }
export function serveurDeTest({ remplacements = {}, graine = 2026, secret = 'secret-de-test', hote = 'https://quiz.example', variables = {} } = {}) {
  const serveur = {
    db: fausseD1(),
    env: null,
    maintenant: new Date('2026-09-21T13:05:00.000Z'),
    random: aleaAGraine(graine),
    avancer(ms) { this.maintenant = new Date(this.maintenant.getTime() + ms); },
    // Republie le site avec d'autres JSON, sans toucher à la base : « l'enseignant modifie l'exercice ».
    publier(nouveaux) { this.env = { ...this.env, ASSETS: fauxSite(nouveaux) }; },
    async appel(methode, chemin, { jeton, corps, entetes = {} } = {}) {
      const headers = { ...entetes };
      if (jeton) headers.authorization = `Bearer ${jeton}`;
      const request = new Request(`${hote}${chemin}`, { method: methode, headers, body: corps === undefined ? undefined : JSON.stringify(corps) });
      const response = await handle(request, this.env, { now: this.maintenant, random: this.random });
      return { status: response.status, corps: await response.json() };
    },
    // La ligne de la séance, telle qu'en base.
    seance(matricule = '2412345', exercice = 'm10-tournage-vc') {
      return { ...this.db.sqlite.prepare('SELECT * FROM seances WHERE matricule = ? AND exercice_id = ?').get(matricule, exercice) };
    },
    journal() {
      return this.db.sqlite.prepare('SELECT * FROM corrections ORDER BY id').all().map((row) => ({ ...row }));
    },
    // Les bonnes réponses de la question mémorisée, telles qu'affichées par le corrigé.
    bonnesReponses(matricule, exercice) {
      return formatParameters(computeParameters(JSON.parse(this.seance(matricule, exercice).question_courante), data));
    },
  };
  serveur.env = { DB: serveur.db, ASSETS: fauxSite(remplacements), CLE_SECRETE: secret, ...variables };
  return serveur;
}

export const SECONDE = 1000;
export const MINUTE = 60 * SECONDE;
