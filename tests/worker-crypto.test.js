// Tests de worker/crypto.js : hachage du NIP, jeton de séance (décision D22).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, hkdfSync } from 'node:crypto';
import { hashNip, hashToken, newToken, sameSecret, sameText, signAttestation, signProfSession } from '../worker/crypto.js';

const SECRET = 'secret-de-test-0123456789';

test('hashNip : HMAC-SHA-256 sous une sous-clé HKDF, vérifié avec node:crypto', async () => {
  const sousCle = Buffer.from(hkdfSync('sha256', SECRET, 'quiz-parametres-coupe', 'nip', 32));
  const attendu = createHmac('sha256', sousCle).update('2412345:4821').digest('base64url');
  assert.equal(await hashNip(SECRET, '2412345', '4821'), attendu);
  assert.match(attendu, /^[A-Za-z0-9_-]{43}$/);
});

test('hashNip : dépend du secret, du matricule et du NIP ; le même trio donne la même valeur', async () => {
  const reference = await hashNip(SECRET, '2412345', '4821');
  assert.equal(await hashNip(SECRET, '2412345', '4821'), reference);
  assert.notEqual(await hashNip('autre-secret', '2412345', '4821'), reference);
  assert.notEqual(await hashNip(SECRET, '2412346', '4821'), reference); // même NIP, autre étudiant
  assert.notEqual(await hashNip(SECRET, '2412345', '4822'), reference);
  assert.notEqual(await hashNip(SECRET, '2412345', '04821'), reference); // les zéros de tête comptent
});

test('hashNip : sans CLE_SECRETE, une erreur claire plutôt qu’un hachage sans secret', async () => {
  await assert.rejects(hashNip(undefined, '2412345', '4821'), /CLE_SECRETE/);
  await assert.rejects(hashNip('', '2412345', '4821'), /CLE_SECRETE/);
});

test('newToken : 32 octets aléatoires en base64url, jamais deux fois le même', () => {
  const jetons = new Set(Array.from({ length: 200 }, newToken));
  assert.equal(jetons.size, 200);
  for (const jeton of jetons) assert.match(jeton, /^[A-Za-z0-9_-]{43}$/);
});

test('hashToken : SHA-256 en base64url ; la base ne contient jamais le jeton lui-même', async () => {
  // SHA-256 de « abc », valeur de référence de la norme.
  assert.equal(await hashToken('abc'), Buffer.from('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'hex').toString('base64url'));
  const jeton = newToken();
  assert.notEqual(await hashToken(jeton), jeton);
});

test('sameText : égalité stricte de deux textes', () => {
  assert.equal(sameText('abc', 'abc'), true);
  assert.equal(sameText('abc', 'abd'), false);
  assert.equal(sameText('abc', 'abcd'), false);
  assert.equal(sameText('', ''), true);
  assert.equal(sameText(null, null), false);
  assert.equal(sameText('abc', undefined), false);
});

// --- Jalon 5 : signature des attestations, cookie professeur, clé d'administration ---------------------------

test('signAttestation : HMAC-SHA-256 sous la sous-clé « attestation », vérifié avec node:crypto ; une autre sous-clé donne autre chose', async () => {
  const sousCle = Buffer.from(hkdfSync('sha256', SECRET, 'quiz-parametres-coupe', 'attestation', 32));
  const texte = '{"code":"ABCDEFGHJK","etudiant":{"nom":"Tremblay"}}';
  assert.equal(await signAttestation(SECRET, texte), createHmac('sha256', sousCle).update(texte).digest('base64url'));
  assert.notEqual(await signAttestation(SECRET, texte), await signAttestation(SECRET, texte.replace('Tremblay', 'Tremblai')));
  assert.notEqual(await signAttestation(SECRET, texte), await signProfSession(SECRET, texte));
  assert.notEqual(await signAttestation('autre-secret', texte), await signAttestation(SECRET, texte));
  await assert.rejects(signAttestation('', texte), /CLE_SECRETE/);
});

test('signProfSession : sous-clé « prof »', async () => {
  const sousCle = Buffer.from(hkdfSync('sha256', SECRET, 'quiz-parametres-coupe', 'prof', 32));
  assert.equal(await signProfSession(SECRET, 'charge'), createHmac('sha256', sousCle).update('charge').digest('base64url'));
});

test('sameSecret : la clé d’administration, comparée après hachage (la longueur ne fuit pas) ; sans CLE_ADMIN, une erreur claire', async () => {
  assert.equal(await sameSecret('cle-admin', 'cle-admin'), true);
  assert.equal(await sameSecret('cle-admin ', 'cle-admin'), false);
  assert.equal(await sameSecret('cle', 'cle-admin'), false);
  assert.equal(await sameSecret(undefined, 'cle-admin'), false);
  assert.equal(await sameSecret(null, 'cle-admin'), false);
  await assert.rejects(sameSecret('cle-admin', undefined), /CLE_ADMIN/);
  await assert.rejects(sameSecret('cle-admin', ''), /CLE_ADMIN/);
});
