// Tests de site/js/session.js : le navigateur ne garde que { matricule, prenom, jeton } (SPEC §7, D19).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_KEY, clearSession, loadSession, saveSession } from '../site/js/session.js';

const SEANCE = { matricule: '2412345', prenom: 'Camille', jeton: 'b3f1c2d4e5' };

// Faux localStorage en mémoire, avec la même interface (getItem / setItem / removeItem).
function fauxStockage(contenu = {}) {
  const memoire = new Map(Object.entries(contenu));
  return {
    getItem: (cle) => (memoire.has(cle) ? memoire.get(cle) : null),
    setItem: (cle, valeur) => { memoire.set(cle, String(valeur)); },
    removeItem: (cle) => { memoire.delete(cle); },
    cles: () => [...memoire.keys()],
  };
}

// Stockage qui refuse tout : navigation privée stricte, quota dépassé, accès interdit.
const stockageEnPanne = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); },
};

test('sauvegarde puis relecture : { matricule, prenom, jeton } revient identique, sous une seule clé', () => {
  const stockage = fauxStockage();
  assert.equal(saveSession(SEANCE, stockage), true);
  assert.deepEqual(stockage.cles(), [SESSION_KEY]);
  assert.deepEqual(loadSession(stockage), SEANCE);

  // Une nouvelle identification remplace la précédente, toujours sous la même clé.
  const autre = { matricule: '2498765', prenom: 'Alex', jeton: 'ffff0000' };
  assert.equal(saveSession(autre, stockage), true);
  assert.deepEqual(stockage.cles(), [SESSION_KEY]);
  assert.deepEqual(loadSession(stockage), autre);
});

test('saveSession : rien d’autre que les trois valeurs n’est écrit — jamais le nom ni le NIP', () => {
  const stockage = fauxStockage();
  assert.equal(saveSession({ ...SEANCE, nom: 'Tremblay', nip: '4821', progression: { totalReussies: 5 } }, stockage), true);
  assert.deepEqual(JSON.parse(stockage.getItem(SESSION_KEY)), SEANCE);
});

test('saveSession : une valeur manquante ou vide → false, et rien n’est écrit', () => {
  const stockage = fauxStockage();
  assert.equal(saveSession({ matricule: '2412345', prenom: 'Camille' }, stockage), false);
  assert.equal(saveSession({ ...SEANCE, jeton: '' }, stockage), false);
  assert.equal(saveSession({ ...SEANCE, matricule: 2412345 }, stockage), false); // un nombre n'est pas un texte
  assert.equal(saveSession(null, stockage), false);
  assert.deepEqual(stockage.cles(), []);
});

test('stockage vide : loadSession retourne null', () => {
  assert.equal(loadSession(fauxStockage()), null);
});

test('stockage corrompu : loadSession retourne null, sans exception et sans rien effacer', () => {
  const abimes = {
    'JSON tronqué': '{"matricule":"2412345","pren',
    'pas du JSON': 'bonjour',
    'chaîne vide': '',
    'null': 'null',
    'un nombre': '42',
    'un tableau': '[]',
    'objet vide': '{}',
    'jeton absent': JSON.stringify({ matricule: '2412345', prenom: 'Camille' }),
    'jeton vide': JSON.stringify({ ...SEANCE, jeton: ' ' }),
    'prénom qui n’est pas un texte': JSON.stringify({ ...SEANCE, prenom: 12 }),
    'état complet d’avant D19': JSON.stringify({ version: 1, etudiant: { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' }, exerciceId: 'm10-tournage-vc', progression: {} }),
  };
  for (const [nom, texte] of Object.entries(abimes)) {
    const stockage = fauxStockage({ [SESSION_KEY]: texte });
    assert.equal(loadSession(stockage), null, nom);
    assert.equal(stockage.getItem(SESSION_KEY), texte, `${nom} : le contenu ne doit pas être effacé`);
  }
});

test('loadSession : ne rend que les trois valeurs, même si le contenu en a davantage', () => {
  const stockage = fauxStockage({ [SESSION_KEY]: JSON.stringify({ ...SEANCE, nip: '4821', admin: true }) });
  assert.deepEqual(loadSession(stockage), SEANCE);
});

test('stockage corrompu : la sauvegarde suivante le remplace et tout rentre dans l’ordre', () => {
  const stockage = fauxStockage({ [SESSION_KEY]: '{abîmé' });
  assert.equal(loadSession(stockage), null);
  assert.equal(saveSession(SEANCE, stockage), true);
  assert.deepEqual(loadSession(stockage), SEANCE);
});

test('les autres clés du stockage ne sont ni lues ni touchées', () => {
  const stockage = fauxStockage({ 'autre-site': 'x' });
  saveSession(SEANCE, stockage);
  clearSession(stockage);
  assert.deepEqual(stockage.cles(), ['autre-site']);
});

test('stockage en panne (navigation privée, quota, accès interdit) : aucune exception', () => {
  assert.equal(loadSession(stockageEnPanne), null);
  assert.equal(saveSession(SEANCE, stockageEnPanne), false);
  assert.equal(clearSession(stockageEnPanne), false);
});

test('stockage absent (null, ou Node sans localStorage) : aucune exception', () => {
  assert.equal(loadSession(null), null);
  assert.equal(saveSession(SEANCE, null), false);
  assert.equal(clearSession(null), false);
  assert.equal(loadSession(), null); // stockage par défaut : sous Node, il n'y en a pas
});

test('clearSession : oublie l’étudiant ; loadSession retourne ensuite null', () => {
  const stockage = fauxStockage();
  saveSession(SEANCE, stockage);
  assert.equal(clearSession(stockage), true);
  assert.equal(loadSession(stockage), null);
  assert.equal(clearSession(stockage), true); // effacer deux fois ne pose pas de problème
});
