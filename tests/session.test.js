// Tests de site/js/session.js : état d'une séance, sauvegarde et relecture dans localStorage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_KEY, SESSION_VERSION, clearSession, createSession, isValidSession, loadSession, saveSession, studentErrors, validateStudent } from '../site/js/session.js';

const ETUDIANT = { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' };
const EXERCICE = { id: 'm10-tournage-vc', version: 'r0' }; // createSession ne lit que l'id et la version
const DEBUT = new Date('2026-09-21T13:05:00.000Z');

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

test('validateStudent : identification complète → aucune erreur', () => {
  assert.deepEqual(validateStudent(ETUDIANT), []);
});

test('validateStudent : une erreur par champ fautif', () => {
  assert.deepEqual(validateStudent({ ...ETUDIANT, prenom: '  ' }), ['Le prénom est requis.']);
  assert.deepEqual(validateStudent({ ...ETUDIANT, nom: '' }), ['Le nom est requis.']);
  assert.deepEqual(validateStudent({ ...ETUDIANT, matricule: undefined }), ['Le matricule est requis.']);
  assert.equal(validateStudent({}).length, 3);
  assert.equal(validateStudent(null).length, 1);
});

test('validateStudent : le matricule a exactement 7 chiffres', () => {
  for (const matricule of ['241234', '24123456', '241234a', '2412 345', '2412-345']) {
    assert.deepEqual(validateStudent({ ...ETUDIANT, matricule }), ['Le matricule doit avoir exactement 7 chiffres.'], matricule);
  }
  assert.deepEqual(validateStudent({ ...ETUDIANT, matricule: 2412345 }), ['Le matricule est requis.']); // un nombre n'est pas un texte
  assert.deepEqual(validateStudent({ ...ETUDIANT, matricule: ' 0412345 ' }), []); // espaces autour tolérés, zéro de tête conservé
});

test('studentErrors : le message de chaque champ, ou null', () => {
  assert.deepEqual(studentErrors(ETUDIANT), { prenom: null, nom: null, matricule: null });
  assert.deepEqual(studentErrors({ prenom: ' ', nom: 'Tremblay', matricule: '24123' }), {
    prenom: 'Le prénom est requis.',
    nom: null,
    matricule: 'Le matricule doit avoir exactement 7 chiffres.',
  });
  assert.deepEqual(studentErrors({}), { prenom: 'Le prénom est requis.', nom: 'Le nom est requis.', matricule: 'Le matricule est requis.' });
});

test('createSession : état de départ complet', () => {
  assert.deepEqual(createSession(ETUDIANT, EXERCICE, DEBUT), {
    version: SESSION_VERSION,
    etudiant: ETUDIANT,
    exerciceId: 'm10-tournage-vc',
    exerciceVersion: 'r0',
    debut: '2026-09-21T13:05:00.000Z',
    reussite: null,
    progression: { exerciceId: 'm10-tournage-vc', reussites: {}, totalReussies: 0 },
    question: null,
    saisies: {},
    correction: null,
    questionsReussies: [],
  });
});

test('createSession : retire les espaces autour de l’identification', () => {
  const etat = createSession({ prenom: ' Camille ', nom: 'Tremblay ', matricule: ' 2412345' }, EXERCICE, DEBUT);
  assert.deepEqual(etat.etudiant, { prenom: 'Camille', nom: 'Tremblay', matricule: '2412345' });
});

test('createSession : identification invalide → erreur qui énumère les problèmes', () => {
  assert.throws(() => createSession({ ...ETUDIANT, nom: '', matricule: '' }, EXERCICE, DEBUT), /Identification invalide :\n- Le nom est requis\.\n- Le matricule/);
});

test('sauvegarde puis relecture : l’état revient identique, sous une seule clé', () => {
  const stockage = fauxStockage();
  const etat = {
    ...createSession(ETUDIANT, EXERCICE, DEBUT),
    progression: { exerciceId: 'm10-tournage-vc', reussites: { mvlnr: 2, mclnr: 0 }, totalReussies: 5 },
    question: { tool: { id: 'mvlnr', name: 'MVLNR', operation: 'Chariotage finition' }, displayId: 'MVLNR - Ø charioté: 2.000"', teeth: 1, dimension: { label: '2.000"', diameter: 2, pitch: null } },
    saisies: { vc: '400', feedPerTooth: '', rpm: '800', feedPerRev: '', feedRate: '' },
  };

  assert.equal(saveSession(etat, stockage), true);
  assert.deepEqual(stockage.cles(), [SESSION_KEY]);
  assert.deepEqual(loadSession(stockage), etat);

  // Une nouvelle sauvegarde remplace la précédente, toujours sous la même clé.
  const suite = { ...etat, reussite: '2026-09-21T14:00:00.000Z' };
  assert.equal(saveSession(suite, stockage), true);
  assert.deepEqual(stockage.cles(), [SESSION_KEY]);
  assert.equal(loadSession(stockage).reussite, '2026-09-21T14:00:00.000Z');
});

test('stockage vide : loadSession retourne null', () => {
  assert.equal(loadSession(fauxStockage()), null);
});

test('stockage corrompu : loadSession retourne null, sans exception et sans rien effacer', () => {
  const bon = createSession(ETUDIANT, EXERCICE, DEBUT);
  const abimes = {
    'JSON tronqué': '{"version":1,"etudiant":{"prenom":"Cam',
    'pas du JSON': 'bonjour',
    'chaîne vide': '',
    'null': 'null',
    'un nombre': '42',
    'un tableau': '[]',
    'objet vide': '{}',
    'autre version du format': JSON.stringify({ ...bon, version: SESSION_VERSION + 1 }),
    'étudiant incomplet': JSON.stringify({ ...bon, etudiant: { prenom: 'Camille' } }),
    'progression absente': JSON.stringify({ ...bon, progression: undefined }),
    'progression abîmée': JSON.stringify({ ...bon, progression: { exerciceId: 'm10-tournage-vc', reussites: null, totalReussies: 'trois' } }),
    'question qui n’est pas un objet': JSON.stringify({ ...bon, question: 'mvlnr' }),
    'saisies absentes': JSON.stringify({ ...bon, saisies: undefined }),
    'historique qui n’est pas une liste': JSON.stringify({ ...bon, questionsReussies: {} }),
    'date de début absente': JSON.stringify({ ...bon, debut: null }),
  };
  for (const [nom, texte] of Object.entries(abimes)) {
    const stockage = fauxStockage({ [SESSION_KEY]: texte });
    assert.equal(loadSession(stockage), null, nom);
    assert.equal(stockage.getItem(SESSION_KEY), texte, `${nom} : le contenu ne doit pas être effacé`);
  }
});

test('stockage corrompu : la sauvegarde suivante le remplace et tout rentre dans l’ordre', () => {
  const stockage = fauxStockage({ [SESSION_KEY]: '{abîmé' });
  assert.equal(loadSession(stockage), null);
  const etat = createSession(ETUDIANT, EXERCICE, DEBUT);
  assert.equal(saveSession(etat, stockage), true);
  assert.deepEqual(loadSession(stockage), etat);
});

test('les autres clés du stockage ne sont ni lues ni touchées', () => {
  const stockage = fauxStockage({ 'autre-site': 'x' });
  saveSession(createSession(ETUDIANT, EXERCICE, DEBUT), stockage);
  clearSession(stockage);
  assert.deepEqual(stockage.cles(), ['autre-site']);
});

test('stockage en panne (navigation privée, quota, accès interdit) : aucune exception', () => {
  assert.equal(loadSession(stockageEnPanne), null);
  assert.equal(saveSession(createSession(ETUDIANT, EXERCICE, DEBUT), stockageEnPanne), false);
  assert.equal(clearSession(stockageEnPanne), false);
});

test('stockage absent (null, ou Node sans localStorage) : aucune exception', () => {
  assert.equal(loadSession(null), null);
  assert.equal(saveSession(createSession(ETUDIANT, EXERCICE, DEBUT), null), false);
  assert.equal(clearSession(null), false);
  assert.equal(loadSession(), null); // stockage par défaut : sous Node, il n'y en a pas
});

test('un état qui ne se sérialise pas (référence circulaire) : saveSession retourne false', () => {
  const etat = createSession(ETUDIANT, EXERCICE, DEBUT);
  etat.question = {};
  etat.question.boucle = etat.question;
  assert.equal(saveSession(etat, fauxStockage()), false);
});

test('clearSession : efface la séance ; loadSession retourne ensuite null', () => {
  const stockage = fauxStockage();
  saveSession(createSession(ETUDIANT, EXERCICE, DEBUT), stockage);
  assert.equal(clearSession(stockage), true);
  assert.equal(loadSession(stockage), null);
  assert.equal(clearSession(stockage), true); // effacer deux fois ne pose pas de problème
});

test('isValidSession : l’état de départ et un état en cours sont valides', () => {
  const etat = createSession(ETUDIANT, EXERCICE, DEBUT);
  assert.equal(isValidSession(etat), true);
  assert.equal(isValidSession({ ...etat, question: { tool: { id: 'mvlnr' } }, correction: { success: true, fields: {} }, reussite: '2026-09-21T14:00:00.000Z' }), true);
  assert.equal(isValidSession(null), false);
});
