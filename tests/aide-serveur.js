// Aides des tests du serveur (ce fichier n'est pas un test) : le VRAI Worker (worker/index.js),
// appelé sans wrangler, avec une fausse D1 (aide-d1.js), les vrais fichiers de site/ en guise de
// liaison ASSETS, une horloge qu'on avance à la main et un aléa à graine.
import { readFile } from 'node:fs/promises';
import { handle } from '../worker/index.js';
import { computeParameters } from '../site/js/calcul.js';
import { formatParameters } from '../site/js/format.js';
import { CODE_ALPHABET } from '../worker/attestation.js';
import { fausseD1 } from './aide-d1.js';
import { aleaAGraine } from './aide.js';
import { assembleData } from '../site/js/data.js';
import { draftFromExercise, engineExercise } from '../site/js/exercice.js';
import { forgetAssembled } from '../worker/catalogue.js';

// Fausse liaison ASSETS : sert les fichiers de site/. Depuis le jalon 7 (D47), les exercices et le
// catalogue ne viennent plus de là mais de la base : serveur.publierExercice les y met.
export function fauxSite() {
  return {
    fetch: async (request) => {
      const chemin = new URL(request.url).pathname.slice(1);
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
export function serveurDeTest({ graine = 2026, secret = 'secret-de-test', cleAdmin = 'cle-admin-de-test', cleConsultation = 'cle-consultation-de-test', hote = 'https://quiz.example', variables = {}, codes = [], db = fausseD1() } = {}) {
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
    // Publie un exercice au format des fichiers JSON (SPEC §10, outils du catalogue avec restrictions)
    // comme nouvelle version en base, avec des copies prises dans la banque : « l'enseignant publie ».
    // Crée l'exercice s'il n'existe pas. Retourne le numéro de la version.
    publierExercice(exercice, { tablesId = 'A2026_r0', quand = this.maintenant.toISOString() } = {}) {
      const banque = this.db.sqlite.prepare('SELECT outil FROM banque_outils ORDER BY rang').all().map((row) => JSON.parse(row.outil));
      const brouillon = draftFromExercise(exercice, banque);
      const contenu = JSON.stringify(brouillon);
      const existe = this.db.sqlite.prepare('SELECT 1 FROM exercices WHERE id = ?').get(exercice.id);
      if (existe) this.db.sqlite.prepare('UPDATE exercices SET brouillon = ?, revision = revision + 1, brouillon_modifie_le = ?, publie_le = ? WHERE id = ?').run(contenu, quand, quand, exercice.id);
      else this.db.sqlite.prepare('INSERT INTO exercices (id, brouillon, brouillon_modifie_le, publie_le, cree_le) VALUES (?, ?, ?, ?, ?)').run(exercice.id, contenu, quand, quand, quand);
      const numero = (this.db.sqlite.prepare('SELECT MAX(numero) AS n FROM versions_exercice WHERE exercice_id = ?').get(exercice.id).n ?? 0) + 1;
      this.db.sqlite.prepare('INSERT INTO versions_exercice (exercice_id, numero, contenu, tables_id, publiee_le) VALUES (?, ?, ?, ?, ?)').run(exercice.id, numero, contenu, tablesId, quand);
      return numero;
    },
    // Le catalogue d'une version publiée (la dernière par défaut), au format de loadData.
    catalogue(exerciceId, numero = null) {
      const version = numero === null
        ? this.db.sqlite.prepare('SELECT * FROM versions_exercice WHERE exercice_id = ? ORDER BY numero DESC LIMIT 1').get(exerciceId)
        : this.db.sqlite.prepare('SELECT * FROM versions_exercice WHERE exercice_id = ? AND numero = ?').get(exerciceId, numero);
      const tables = this.db.sqlite.prepare('SELECT * FROM tables_reference WHERE id = ?').get(version.tables_id);
      const { tools } = engineExercise(exerciceId, version.numero, JSON.parse(version.contenu));
      return assembleData({ materiaux: JSON.parse(tables.materiaux), operations: JSON.parse(tables.operations) }, tools);
    },
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
    // Les bonnes réponses de la question mémorisée, telles qu'affichées par le corrigé — calculées
    // avec le catalogue de la version épinglée à la séance.
    bonnesReponses(matricule = '2412345', exercice = 'm10-tournage-vc') {
      const ligne = this.seance(matricule, exercice);
      const version = this.db.sqlite.prepare('SELECT numero FROM versions_exercice WHERE id = ?').get(ligne.version_id);
      return formatParameters(computeParameters(JSON.parse(ligne.question_courante), this.catalogue(exercice, version?.numero ?? null)));
    },
  };
  forgetAssembled(); // une autre base : les versions gardées en mémoire ne valent plus
  serveur.env = { DB: serveur.db, ASSETS: fauxSite(), CLE_SECRETE: secret, CLE_ADMIN: cleAdmin, ...(cleConsultation === null ? {} : { CLE_CONSULTATION: cleConsultation }), ...variables };
  return serveur;
}

export const SECONDE = 1000;
export const MINUTE = 60 * SECONDE;
