// Le spécimen d'attestation du mode démo (décision D92, point 9) : un exemple sans valeur, composé à la volée par le
// vrai moteur, jamais enregistré, signé avec une sous-clé réservée (crypto.js, « specimen »), et portant un code
// qu'aucune vraie attestation ne peut avoir. Il se vérifie sans être enregistré : son QR porte de quoi le RECOMPOSER
// (la version de l'exercice, la graine du tirage, les dates, le titre), et le serveur compare ce qu'il recompose à
// ce que l'adresse prétend, signature comprise.
//
// Fonctions PURES : ni base, ni réseau, ni horloge cachée. L'aléa du spécimen vient de sa graine (seededRandom) :
// le même exercice, la même version, la même graine et les mêmes dates redonnent exactement le même spécimen.

import { ANSWER_FIELDS } from '../site/js/correction.js';
import { computeParameters } from '../site/js/calcul.js';
import { fieldsToGrade } from '../site/js/exercice.js';
import { formatParameters } from '../site/js/format.js';
import { recordResult } from '../site/js/progression.js';
import { buildAttestation, formatCode } from './attestation.js';
import { drawQuestion, emptyCounters, gradeQuestion } from './seance.js';

// Le code d'un spécimen : « SPECI-MEN00 ». Il contient un I et des 0, que l'alphabet des codes (D32) n'a pas :
// parseCode le refuse, aucune vraie attestation ne peut le porter.
export const SPECIMEN_CODE = 'SPECIMEN00';

// L'identité fictive, évidente, de tout spécimen.
export const SPECIMEN_STUDENT = { prenom: 'Exemple', nom: 'SPÉCIMEN', matricule: '0000000' };

// Les horodatages des questions s'échelonnent de `debut` à `reussite_le` : 45 s par question.
export const SECONDS_PER_QUESTION = 45;

// La graine : un entier de 0 à 2^31 − 1.
export const SEED_MAX = 2 ** 31 - 1;

// Ce qu'on a tapé est-il le code d'un spécimen ? Tolère les minuscules, les espaces et les tirets, comme parseCode.
export function isSpecimenCode(text) {
  return typeof text === 'string' && text.toUpperCase().replace(/[\s-]/g, '') === SPECIMEN_CODE;
}

// Générateur pseudo-aléatoire à graine (mulberry32) : () => un nombre dans [0, 1[, comme Math.random, mais
// reproductible. C'est lui qui tire les questions d'un spécimen.
export function seededRandom(seed) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Une graine au hasard, avec l'aléa du serveur (que les tests remplacent).
export const newSeed = (random) => Math.floor(random() * (SEED_MAX + 1));

// Les dates d'un spécimen composé maintenant : réussi à l'instant, commencé 45 s par question plus tôt.
export function specimenDates(now, exercise) {
  const questions = exercise.outils.reduce((sum, entry) => sum + entry.reussites_requises, 0);
  return { debut: new Date(now.getTime() - questions * SECONDS_PER_QUESTION * 1000).toISOString(), reussite: now.toISOString() };
}

// Compose le spécimen : pour chaque outil, le nombre de réussites exigé en questions tirées comme si tout avait été
// réussi. Le tirage est celui d'une vraie séance (drawQuestion : au hasard parmi les outils encore à évaluer, jusqu'à
// la réussite), la correction aussi (gradeQuestion, avec les bonnes réponses au format d'affichage), et
// l'enregistrement est composé par buildAttestation comme pour une vraie attestation : mêmes outils, même liste des
// questions (D41), mêmes réponses normalisées (D43). Chaque question est comptée réussie quoi qu'il arrive (c'est un
// exemple), ce qui garantit que la boucle finit.
//   exercise : l'exercice au format du moteur, avec le titre en vigueur (D78)
//   data     : le catalogue de sa version
//   seed, debut, reussite : la graine (entier) et les deux dates ISO
export function buildSpecimen(exercise, data, { seed, debut, reussite }) {
  const random = seededRandom(seed);
  const graded = fieldsToGrade(exercise);
  let counters = emptyCounters();
  const corrections = [];
  for (let question = drawQuestion(counters, exercise, data, random); question !== null; question = drawQuestion(counters, exercise, data, random)) {
    const displayed = formatParameters(computeParameters(question, data));
    const answers = Object.fromEntries(ANSWER_FIELDS.map((field) => [field, graded.includes(field) ? displayed[field] : '']));
    const { result } = gradeQuestion(question, answers, counters, exercise, data);
    const progress = recordResult({ exerciceId: exercise.id, ...counters }, question.tool.id, true);
    counters = { reussites: progress.reussites, totalReussies: progress.totalReussies };
    corrections.push({ outil_id: question.tool.id, question, reponses: answers, resultat: result, reussie: true, horodatage: null });
  }
  const start = Date.parse(debut);
  const end = Date.parse(reussite);
  corrections.forEach((correction, i) => {
    correction.horodatage = new Date(start + Math.round(((i + 1) * (end - start)) / corrections.length)).toISOString();
  });
  const session = { ...SPECIMEN_STUDENT, compteurs: counters, question_courante: null, derniere_correction: null, debut, reussite_le: reussite, version_exercice_reussite: exercise.version };
  return { ...buildAttestation(session, exercise, data, SPECIMEN_CODE, corrections), specimen: true, graine: seed };
}

// --- Le QR d'un spécimen : une adresse /verifier marquée spécimen, qui porte de quoi le recomposer (D92, 9.4) ---------

// Les champs de l'adresse, et où les lire dans l'enregistrement : ceux d'une vraie adresse (attestation.js), plus
// `specimen`, la graine, le début et le titre.
const SPECIMEN_FIELDS = {
  specimen: () => '1',
  exercice: (record) => record.exercice.id,
  matricule: (record) => record.etudiant.matricule,
  nom: (record) => record.etudiant.nom,
  prenom: (record) => record.etudiant.prenom,
  reussite: (record) => record.reussite_le,
  revision: (record) => record.revision,
  questions: (record) => String(record.questions_reussies),
  code: (record) => formatCode(record.code),
  graine: (record) => String(record.graine),
  debut: (record) => record.debut,
  titre: (record) => record.exercice.titre,
};

// « https://…/verifier?specimen=1&exercice=…&…&code=SPECI-MEN00&graine=…&debut=…&titre=…&signature=… »
export function specimenUrl(origin, record, signature) {
  const params = new URLSearchParams();
  for (const [name, read] of Object.entries(SPECIMEN_FIELDS)) params.set(name, read(record));
  params.set('signature', signature);
  return `${origin}/verifier?${params}`;
}

// Ce qu'une adresse de spécimen prétend : { code: SPECIMEN_CODE, specimen, exercice, …, titre, signature } — un champ
// absent vaut null. Retourne null si le code n'est pas celui d'un spécimen.
//   params : URLSearchParams, ou un objet tel que reçu en JSON
export function readSpecimenClaims(params) {
  const get = (name) => (params instanceof URLSearchParams ? params.get(name) : params?.[name]) ?? null;
  if (!isSpecimenCode(get('code'))) return null;
  const claims = { code: SPECIMEN_CODE };
  for (const name of Object.keys(SPECIMEN_FIELDS)) if (name !== 'code') claims[name] = get(name);
  claims.signature = get('signature');
  return claims;
}

// L'adresse ne porte que le code : tapé à la main, ou un QR sans le reste (D92, 9.5).
export const specimenClaimsOnlyCode = (claims) => Object.entries(claims).every(([name, value]) => name === 'code' || value === null);

// Ce qu'il faut pour recomposer le spécimen que l'adresse prétend : { exercice, revision, seed, debut, reussite,
// titre }, ou null si un champ manque ou est mal formé — un spécimen ne se recompose pas à moitié.
const ISO_DATE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const isIsoDate = (text) => typeof text === 'string' && ISO_DATE.test(text) && !Number.isNaN(Date.parse(text));

export function specimenRequest(claims) {
  const seed = /^(0|[1-9]\d*)$/.test(claims.graine ?? '') ? Number(claims.graine) : NaN;
  if (!Number.isInteger(seed) || seed > SEED_MAX) return null;
  if (!/^[1-9]\d*$/.test(claims.revision ?? '')) return null;
  if (!isIsoDate(claims.debut) || !isIsoDate(claims.reussite) || claims.debut > claims.reussite) return null;
  if (typeof claims.exercice !== 'string' || typeof claims.titre !== 'string') return null;
  return { exercice: claims.exercice, revision: Number(claims.revision), seed, debut: claims.debut, reussite: claims.reussite, titre: claims.titre };
}

// Les champs prétendus par l'adresse sont-ils exactement ceux du spécimen recomposé ? Un champ absent compte comme
// différent, « specimen » compris : un seul caractère modifié dans l'adresse donne « invalide ».
export function specimenClaimsMatch(record, claims) {
  return Object.entries(SPECIMEN_FIELDS).every(([name, read]) => (name === 'code' ? claims.code === record.code : claims[name] === read(record)));
}
