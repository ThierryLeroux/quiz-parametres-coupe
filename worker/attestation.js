// L'attestation de réussite (décisions D31 à D33 ; SPEC §8) : l'enregistrement figé, son code
// court, sa sérialisation canonique (ce que la signature couvre), l'adresse de vérification que
// porte le QR, et la comparaison entre ce qu'un QR prétend et ce que le serveur détient.
//
// Fonctions PURES : ni base, ni réseau, ni horloge cachée. La cryptographie est dans crypto.js.

import { sessionView } from './seance.js';

// --- Code court (D32) ----------------------------------------------------------------------------------
// Alphabet base32 de Crockford sans 0/O/1/I (ni L, ni U) : 30 caractères, aucun ne se confond avec
// un autre à l'écrit. 10 caractères → 30^10 ≈ 6 × 10^14 codes : deviner un code est sans espoir.

export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 10;

// Un code au hasard, sans biais : un octet ≥ 240 est rejeté (256 = 8 × 30 + 16), les autres sont
// pris modulo 30.
//   randomBytes(n) : n octets aléatoires — crypto.getRandomValues par défaut, remplaçable par les tests
export function newCode(randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of randomBytes(CODE_LENGTH)) {
      if (byte < 240 && code.length < CODE_LENGTH) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
  }
  return code;
}

// « ABCDEFGHJK » → « ABCDE-FGHJK », la forme présentée partout (attestation, page de vérification).
export function formatCode(code) {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

// Ce qu'un étudiant ou un enseignant a tapé → le code de 10 caractères, ou null s'il est mal formé.
// Tolère les minuscules, les espaces et les tirets. Ne corrige pas un O ou un I : ils n'existent
// pas dans l'alphabet, et un code qui en contient est simplement inconnu.
export function parseCode(text) {
  if (typeof text !== 'string') return null;
  const code = text.toUpperCase().replace(/[\s-]/g, '');
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

// --- Sérialisation canonique (D32) ---------------------------------------------------------------------
// La signature couvre un texte, pas un objet : il faut que le même enregistrement donne toujours le
// même texte. JSON avec les clés triées, à tous les niveaux, sans espace.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// --- Les questions réussies qui comptent (D41) ------------------------------------------------------------
// Pour chaque outil de l'attestation, ses `reussites` dernières questions réussies : la série finale
// de réussites consécutives. Comme un échec remet le compteur à zéro (D12), les n dernières réussites
// d'un outil sont toujours postérieures à son dernier échec — et à une remise à zéro (D35). Chaque
// question est copiée du journal telle qu'elle a été posée : le nom affiché (gabarit résolu, avec
// dimension, barre et dents quand le gabarit les porte), la matière de l'outil, le matériau usiné,
// les réponses de l'étudiant aux grandeurs évaluées, l'heure. Le numéro est le rang de la question
// dans la séance (réussies ou non). Liste dans l'ordre chronologique.
//   corrections : le journal de la séance, dans l'ordre (base.js listCorrections)
//   outils      : les outils de l'attestation, avec leurs `reussites`
export function successfulQuestions(corrections, outils) {
  const numbered = corrections.map((correction, i) => ({ ...correction, numero: i + 1 }));
  const kept = outils.flatMap((outil) => numbered.filter((c) => c.outil_id === outil.id && c.reussie).slice(-outil.reussites));
  return kept.sort((x, y) => x.numero - y.numero).map(({ numero, outil_id, question, reponses, resultat, horodatage }) => ({
    numero,
    outil_id,
    outil: question.displayId,
    materiau_outil: question.toolMaterial.label,
    materiau: { classe: question.material.iso, groupe: question.material.groupe, materiau: question.material.materiau, etat: question.material.etat },
    // Les champs évalués sont ceux que la correction a bornés ; les autres étaient fournis.
    reponses: Object.fromEntries(Object.entries(resultat.fields).filter(([, field]) => field.min !== null).map(([name]) => [name, reponses[name]])),
    horodatage,
  }));
}

// --- L'enregistrement figé (D31) ------------------------------------------------------------------------

// Compose l'attestation d'une séance réussie. Tout est COPIÉ à cet instant : le nom, la plage et
// l'opération des outils sont ceux que le serveur montre dans progression.outils (sessionView :
// la plage est celle que l'exercice permet, D30) et ne seront plus jamais relus ; le titre et la
// révision de l'exercice non plus, ni la révision des tables (D28 : materiaux.json et
// operations.json). L'ordre des outils est celui de l'exercice.
//   session  : la ligne de la table seances (colonnes JSON décodées), réussie (reussite_le non nul)
//   exercise : l'exercice tel qu'il est au moment de composer
//   data     : le catalogue (loadData, avec ses révisions)
//   code        : le code court, sans tiret
//   corrections : le journal de la séance (listCorrections), pour la liste des questions réussies (D41)
export function buildAttestation(session, exercise, data, code, corrections = []) {
  const { progression } = sessionView(session, exercise, data);
  const outils = progression.outils.map(({ id, nom, plage, operation, reussites, requises }) => ({ id, nom, plage, operation, reussites, requises }));
  return {
    code,
    exercice: { id: exercise.id, titre: exercise.titre },
    revision: session.version_exercice_reussite ?? exercise.version,
    revision_tables: { materiaux: data.revisions.materiaux, operations: data.revisions.operations },
    etudiant: { prenom: session.prenom, nom: session.nom, matricule: session.matricule },
    debut: session.debut,
    reussite_le: session.reussite_le,
    questions_reussies: progression.total_reussies,
    outils,
    questions: successfulQuestions(corrections, outils),
  };
}

// --- Le QR : une adresse de vérification qui porte l'essentiel en clair (D33) ------------------------------
// Un lecteur de QR quelconque montre ces champs sans le site ; le site, lui, vérifie.

// Les champs de l'adresse, et où les lire dans l'enregistrement.
const CLAIM_FIELDS = {
  exercice: (record) => record.exercice.id,
  matricule: (record) => record.etudiant.matricule,
  nom: (record) => record.etudiant.nom,
  prenom: (record) => record.etudiant.prenom,
  reussite: (record) => record.reussite_le,
  revision: (record) => record.revision,
  questions: (record) => String(record.questions_reussies),
  code: (record) => formatCode(record.code),
};

// « https://…/verifier?exercice=…&matricule=…&…&code=XXXXX-XXXXX&signature=… »
//   origin : l'adresse du site, celle de la requête (elle n'est pas dans l'enregistrement : le site peut déménager)
export function verificationUrl(origin, record, signature) {
  const params = new URLSearchParams();
  for (const [name, read] of Object.entries(CLAIM_FIELDS)) params.set(name, read(record));
  params.set('signature', signature);
  return `${origin}/verifier?${params}`;
}

// Ce qu'une adresse de vérification prétend : { exercice, matricule, …, code, signature }, avec le
// code ramené à 10 caractères. Retourne null si le code manque ou est mal formé.
//   params : URLSearchParams, ou un objet { exercice, matricule, … } tel que reçu en JSON
export function readClaims(params) {
  const get = (name) => (params instanceof URLSearchParams ? params.get(name) : params?.[name]) ?? null;
  const code = parseCode(get('code'));
  if (code === null) return null;
  const claims = { code };
  for (const name of Object.keys(CLAIM_FIELDS)) if (name !== 'code') claims[name] = get(name);
  claims.signature = get('signature');
  return claims;
}

// Une adresse de vérification ne porte que le code (saisi à la main, ou QR sans le reste) : on ne
// compare alors que le code.
export const claimsOnlyCode = (claims) => Object.entries(claims).every(([name, value]) => name === 'code' || value === null);

// Les champs prétendus par l'adresse sont-ils exactement ceux de l'enregistrement ? Un champ
// absent de l'adresse compte comme différent : une attestation ne se vérifie pas à moitié.
export function claimsMatch(record, claims) {
  return Object.entries(CLAIM_FIELDS).every(([name, read]) => (name === 'code' ? claims.code === record.code : claims[name] === read(record)));
}
