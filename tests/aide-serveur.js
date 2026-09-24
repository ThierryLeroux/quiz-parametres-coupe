// Aides des tests du serveur (ce fichier n'est pas un test) : le VRAI Worker (worker/index.js),
// appelé sans wrangler, avec une fausse D1 (aide-d1.js), les vrais fichiers de site/ en guise de
// liaison ASSETS, une horloge qu'on avance à la main et un aléa à graine.
import { readFile } from 'node:fs/promises';
import { handle } from '../worker/index.js';
import { computeParameters } from '../site/js/calcul.js';
import { formatParameters } from '../site/js/format.js';
import { CODE_ALPHABET } from '../worker/attestation.js';
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
//   appel('POST', '/api/question', { jeton, corps, entetes }) → { status, corps }
//   entetes   : en-têtes de plus (cookie, cf-connecting-ip…) ; ceux de la dernière réponse sont dans serveur.derniersEntetes
//   hote      : l'adresse à laquelle les requêtes sont faites — le mode test (D26) et la cadence réglable n'existent que sur localhost
//   variables : variables du Worker en plus des secrets, ex. { MODE_TEST: '1' }
//   codes     : les codes d'attestation à tirer, dans l'ordre (10 caractères de l'alphabet, D32) ; au hasard ensuite
//   cleConsultation : la clé de consultation (D44) ; null = non configurée sur le serveur
//   db        : une fausse D1 déjà construite (ex. fausseD1({ jusqua: 3 }), pour tester une migration sur des données réelles)
export function serveurDeTest({ remplacements = {}, graine = 2026, secret = 'secret-de-test', cleAdmin = 'cle-admin-de-test', cleConsultation = 'cle-consultation-de-test', hote = 'https://quiz.example', variables = {}, codes = [], db = fausseD1() } = {}) {
  const prevus = [...codes];
  const serveur = {
    db,
    env: null,
    derniersEntetes: null,
    maintenant: new Date('2026-09-21T13:05:00.000Z'),
    random: aleaAGraine(graine),
    // L'aléa des codes : un code prévu est rendu octet par octet (son rang dans l'alphabet), sinon du vrai hasard.
    randomBytes(n) {
      const code = prevus.shift();
      return code === undefined ? crypto.getRandomValues(new Uint8Array(n)) : Uint8Array.from(code, (c) => CODE_ALPHABET.indexOf(c));
    },
    avancer(ms) { this.maintenant = new Date(this.maintenant.getTime() + ms); },
    // Republie le site avec d'autres JSON, sans toucher à la base : « l'enseignant modifie l'exercice ».
    publier(nouveaux) { this.env = { ...this.env, ASSETS: fauxSite(nouveaux) }; },
    async appel(methode, chemin, { jeton, corps, entetes = {} } = {}) {
      const headers = { ...entetes };
      if (jeton) headers.authorization = `Bearer ${jeton}`;
      const request = new Request(`${hote}${chemin}`, { method: methode, headers, body: corps === undefined ? undefined : JSON.stringify(corps) });
      const response = await handle(request, this.env, { now: this.maintenant, random: this.random, randomBytes: (n) => this.randomBytes(n) });
      this.derniersEntetes = response.headers;
      return { status: response.status, corps: await response.json() };
    },
    // Les attestations d'une séance, telles qu'en base.
    attestations(matricule = '2412345', exercice = 'm10-tournage-vc') {
      return this.db.sqlite.prepare('SELECT a.* FROM attestations a JOIN seances s ON s.id = a.seance_id WHERE s.matricule = ? AND s.exercice_id = ? ORDER BY a.id')
        .all(matricule, exercice).map((row) => ({ ...row, enregistrement: JSON.parse(row.enregistrement) }));
    },
    journalEnseignant() {
      return this.db.sqlite.prepare('SELECT * FROM journal_enseignant ORDER BY id').all().map((row) => ({ ...row }));
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
  serveur.env = { DB: serveur.db, ASSETS: fauxSite(remplacements), CLE_SECRETE: secret, CLE_ADMIN: cleAdmin, ...(cleConsultation === null ? {} : { CLE_CONSULTATION: cleConsultation }), ...variables };
  return serveur;
}

export const SECONDE = 1000;
export const MINUTE = 60 * SECONDE;
