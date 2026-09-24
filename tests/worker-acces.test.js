// Tests de worker/acces.js (décisions D34, D36) : adresse, limites de débit, verrou des connexions
// professeur, cookie de séance professeur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN, ANONYMIZED, CONSULTATION, DISTINCT_PER_HOUR, PROF_COOKIE_PATH, PROF_FREE_ATTEMPTS, PROF_SESSION_MS, PURGE_WORD, REFUSAL_LOCK_MS, ROLES, anonymizedDetails,
  canAct, clientAddress, hourSlot, isLocked, lockWait, profCookieHeader, profFailureLock, profSessionPayload, purgeDetails, readCookie, readProfSessionPayload,
  refusalLock,
} from '../worker/acces.js';

const NOW = new Date('2026-09-21T13:05:00.000Z');
const MINUTE = 60 * 1000;

test('clientAddress : cf-connecting-ip, sinon « inconnue »', () => {
  assert.equal(clientAddress(new Request('https://q.example/', { headers: { 'cf-connecting-ip': '203.0.113.7' } })), '203.0.113.7');
  assert.equal(clientAddress(new Request('https://q.example/', { headers: { 'x-forwarded-for': '203.0.113.7' } })), 'inconnue'); // forgeable : ignoré
});

test('limites de débit : 100 valeurs distinctes par heure, tranche horaire UTC, verrou de 10 minutes après un refus', () => {
  assert.equal(DISTINCT_PER_HOUR, 100);
  assert.equal(REFUSAL_LOCK_MS, 10 * MINUTE);
  assert.equal(hourSlot(NOW), '2026-09-21T13');
  assert.equal(hourSlot(new Date('2026-09-21T13:59:59.999Z')), '2026-09-21T13');
  assert.equal(hourSlot(new Date('2026-09-21T14:00:00.000Z')), '2026-09-21T14');
  assert.deepEqual(refusalLock(NOW), { echecs: 0, jusqua: '2026-09-21T13:15:00.000Z' });
});

test('isLocked et lockWait : un verrou vaut jusqu’à sa date, secondes restantes arrondies vers le haut', () => {
  const lock = refusalLock(NOW);
  assert.equal(isLocked(null, NOW), false);
  assert.equal(isLocked({ echecs: 3, jusqua: null }, NOW), false);
  assert.equal(isLocked(lock, NOW), true);
  assert.equal(lockWait(lock, NOW), 600);
  assert.equal(lockWait(lock, new Date(NOW.getTime() + 599_500)), 1);
  assert.equal(isLocked(lock, new Date('2026-09-21T13:15:00.000Z')), false);
});

test('connexion professeur : quatre échecs libres, puis 1, 2, 4… minutes, plafonné à une heure', () => {
  assert.equal(PROF_FREE_ATTEMPTS, 5);
  let lock = null;
  for (let failures = 1; failures <= 4; failures += 1) {
    lock = profFailureLock(lock, NOW);
    assert.deepEqual(lock, { echecs: failures, jusqua: null });
  }
  lock = profFailureLock(lock, NOW);
  assert.deepEqual(lock, { echecs: 5, jusqua: '2026-09-21T13:06:00.000Z' });
  lock = profFailureLock(lock, NOW);
  assert.deepEqual(lock, { echecs: 6, jusqua: '2026-09-21T13:07:00.000Z' });
  lock = profFailureLock(lock, NOW);
  assert.deepEqual(lock, { echecs: 7, jusqua: '2026-09-21T13:09:00.000Z' });
  for (let i = 0; i < 20; i += 1) lock = profFailureLock(lock, NOW);
  assert.equal(lock.jusqua, '2026-09-21T14:05:00.000Z'); // une heure, pas plus
});

test('cookie professeur : charge signable de 12 h, relue tant qu’elle n’est pas expirée', () => {
  assert.equal(PROF_SESSION_MS, 12 * 60 * MINUTE);
  const { payload, expires } = profSessionPayload('admin', ADMIN, NOW);
  assert.equal(expires, '2026-09-22T01:05:00.000Z');
  assert.match(payload, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(readProfSessionPayload(payload, NOW), { teacher: 'admin', role: 'admin', expires });
  assert.deepEqual(readProfSessionPayload(payload, new Date('2026-09-22T01:04:59.999Z')), { teacher: 'admin', role: 'admin', expires });
  assert.equal(readProfSessionPayload(payload, new Date('2026-09-22T01:05:00.000Z')), null);
  assert.equal(readProfSessionPayload('pas du base64 !', NOW), null);
  assert.equal(readProfSessionPayload('', NOW), null);
  assert.equal(readProfSessionPayload(btoa('admin'), NOW), null); // sans expiration
  assert.equal(readProfSessionPayload(btoa(`admin|${expires}`), NOW), null); // charge du jalon 5, sans rôle : on se reconnecte
});

test('effacement (D46) : le mot exigé, et le détail des nombres pour le journal, au singulier comme au pluriel', () => {
  assert.equal(PURGE_WORD, 'EFFACER');
  assert.equal(purgeDetails({ seances: 3, corrections: 40, corrections_identite: 1, attestations: 2, debit: 12, verrous: 1, journal_anonymise: 4 }),
    "3 séances · 40 corrections · 1 correction d'identité · 2 attestations · 12 compteurs de débit · 1 verrou · 4 entrées du journal anonymisées");
  assert.equal(purgeDetails({ seances: 1, corrections: 0, corrections_identite: 0, attestations: 1, debit: 0, verrous: 0, journal_anonymise: 1 }),
    "1 séance · 0 correction · 0 correction d'identité · 1 attestation · 0 compteur de débit · 0 verrou · 1 entrée du journal anonymisée");
});

test('anonymizedDetails (D46) : matricule, nom et codes d’attestation → « — » dans les actions qui nomment un étudiant ; le reste ne change pas', () => {
  assert.equal(ANONYMIZED, '—');
  assert.equal(anonymizedDetails('remise_a_zero', 'm10-tournage-vc · 2412345 · Camille Tremblay'), 'm10-tournage-vc · — · —');
  assert.equal(anonymizedDetails('reinitialisation_nip', 'm10-tournage-vc · 2412345 · Camille Tremblay-Roy'), 'm10-tournage-vc · — · —');
  assert.equal(anonymizedDetails('suppression', 'm10-tournage-vc · 2412345 · Camille Tremblay · séance 7'), 'm10-tournage-vc · — · — · séance 7');
  assert.equal(anonymizedDetails('suppression', 'm10-tournage-vc · 2412345 · Camille Tremblay · ABCDE-FGHJK · séance 7'), 'm10-tournage-vc · — · — · — · séance 7'); // un code, si un jour les détails en portent
  assert.equal(anonymizedDetails('connexion', 'adresse 203.0.113.7, rôle admin'), 'adresse 203.0.113.7, rôle admin');
  assert.equal(anonymizedDetails('connexion_refusee', 'adresse 203.0.113.7, échec 3'), 'adresse 203.0.113.7, échec 3');
  assert.equal(anonymizedDetails('effacement', "3 séances · 40 corrections · 1 correction d'identité · 2 attestations"), "3 séances · 40 corrections · 1 correction d'identité · 2 attestations");
  assert.equal(anonymizedDetails('remise_a_zero', null), null);
});

test('rôles (D44) : la charge porte le rôle ; un rôle inconnu est refusé ; seul admin agit', () => {
  assert.deepEqual(ROLES, ['admin', 'consultation']);
  const { payload, expires } = profSessionPayload('consultation', CONSULTATION, NOW);
  assert.deepEqual(readProfSessionPayload(payload, NOW), { teacher: 'consultation', role: 'consultation', expires });
  assert.equal(readProfSessionPayload(btoa(`admin|superviseur|${expires}`), NOW), null);
  assert.equal(canAct(ADMIN), true);
  assert.equal(canAct(CONSULTATION), false);
  assert.equal(canAct(undefined), false);
});

test('readCookie et profCookieHeader : HttpOnly, Secure, SameSite=Strict, chemin /api/prof, 12 h ; effacé avec Max-Age=0', () => {
  assert.equal(readCookie('a=1; prof=abc.def; b=2'), 'abc.def');
  assert.equal(readCookie('prof=abc=.def'), 'abc=.def');
  assert.equal(readCookie('a=1'), null);
  assert.equal(readCookie(null), null);
  assert.equal(PROF_COOKIE_PATH, '/api/prof');
  assert.equal(profCookieHeader('abc.def'), 'prof=abc.def; Path=/api/prof; HttpOnly; Secure; SameSite=Strict; Max-Age=43200');
  assert.equal(profCookieHeader(null), 'prof=; Path=/api/prof; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
});
