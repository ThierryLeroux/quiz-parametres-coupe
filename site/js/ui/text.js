// Textes des écrans, composés à partir des données (UI §3) : fonctions PURES, sans DOM, testées
// sous Node. Les écrans ne font qu'afficher ce qu'elles retournent.

// Champ évalué tel qu'écrit dans l'exercice (SPEC §10) → son nom en clair (UI §3.3).
const FIELD_NAMES = {
  vc: 'vitesse de coupe',
  fz: 'avance par dent',
  n: 'vitesse de rotation',
  f: 'avance totale par révolution',
  vf: "vitesse d'avance",
};

// Le département, sur trois lignes, comme sur les feuilles de l'atelier : le même texte dans toutes
// les pages (pied de page de index.html, feuilles de référence, attestation). Son sigle, partout où
// il est affiché : « TGM-TMI » (D29). Les noms de dépôt, chemins et adresses ne changent pas.
export const DEPARTMENT_LINES = ['Techniques de génie mécanique', 'Technique du génie de la maintenance industrielle', '(fiabilité des systèmes de production)'];
export const DEPARTMENT_SHORT = 'TGM-TMI';

// Signature au pied des feuilles de référence et de l'attestation (D30) : « TGM-TMI — TLP — 2026 ».
// L'année est celle du jour d'impression.
export function sheetSignature(date = new Date()) {
  return `${DEPARTMENT_SHORT} — TLP — ${date.getFullYear()}`;
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// « 1 outil », « 9 outils », « 0 réussite » : en français, 0 et 1 sont au singulier.
const count = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// « champ évalué : vitesse de coupe », « champs évalués : vitesse de coupe, vitesse de rotation ».
function evaluatedFields(champs) {
  const fields = champs.map((field) => FIELD_NAMES[field]);
  return `${fields.length > 1 ? 'champs évalués' : 'champ évalué'} : ${fields.join(', ')}`;
}

// Ligne sous le titre de l'exercice : « version r0 · 9 outils · champ évalué : vitesse de coupe »
export function exerciseMeta(exercise) {
  return `version ${exercise.version} · ${count(exercise.outils.length, 'outil')} · ${evaluatedFields(exercise.champs_evalues)}`;
}

// Ligne sous un exercice de l'accueil (D71), d'après GET /api/exercices : « 9 outils · champ évalué : vitesse de coupe ».
export function listedExerciseMeta(entry) {
  return `${count(entry.nombre_outils, 'outil')} · ${evaluatedFields(entry.champs_evalues)}`;
}

// Les grandeurs d'un champ d'exercice (vc, fz, n, f, vf), en toutes lettres (D71).
export const fieldName = (field) => FIELD_NAMES[field];

// Résumé de l'exercice en trois phrases (UI §3.1) : réussites de suite, échec, rapport.
// N est lu dans reussites_requises ; s'il varie selon l'outil, on écrit « plusieurs fois de suite ».
export function exerciseSummary(exercise) {
  const required = exercise.outils.map((entry) => entry.reussites_requises);
  const n = required[0];
  let times = 'plusieurs fois de suite';
  if (required.every((value) => value === n)) times = n === 1 ? 'une fois' : `${n} fois de suite`;
  return [
    `Chaque outil doit être réussi ${times}.`,
    'Une mauvaise réponse remet le compteur de cet outil à zéro.',
    'À la fin, tu enregistres ton rapport de réussite en PDF et tu le remets sur Léa.',
  ];
}

// La date du jour, à l'heure du poste, en « 2026-09-21 » (pied des feuilles et de l'attestation) —
// pas toISOString, qui donnerait la date UTC : le soir, ce serait déjà demain.
export function localDate(date = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

// Date ISO → « 19 sept. 2026, 13 h 40 », à l'heure du poste.
export function formatDateTime(iso) {
  const date = new Date(iso);
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${date.getHours()} h ${minutes}`;
}

// Date ISO → « 2026-09-21 13:48 » à l'heure du poste (documents et tableaux) ; avec les secondes si demandé.
export function formatDateStamp(iso, { seconds = false } = {}) {
  const date = new Date(iso);
  const two = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
  return seconds ? `${stamp}:${two(date.getSeconds())}` : stamp;
}

// Message à montrer quand un appel au serveur de correction échoue (ApiError d'api.js, ou toute
// erreur portant { status, message }) : celui du serveur, sauf s'il n'a pas pu être joint.
export function serverErrorMessage(error) {
  if (error.status === 0 || error.status === undefined) return 'Le serveur de correction ne répond pas. Vérifie ta connexion, puis réessaie.';
  return error.message;
}

// Même chose pour l'identification (UI §3.2), où 401 veut dire « NIP incorrect », 429 « trop
// d'essais » et 409 « ce matricule est pris ». Un 400 ou un 404 garde le message du serveur
// (ex. « Le matricule doit avoir exactement 7 chiffres. »).
export function identificationErrorMessage(error) {
  if (error.status === 401) return "NIP incorrect. Si tu l'as oublié, demande à ton enseignant de le remettre à zéro.";
  if (error.status === 429) return "Trop d'essais. Attends 10 minutes avant de réessayer.";
  if (error.status === 409) return 'Ce matricule a déjà une séance.';
  return serverErrorMessage(error);
}

// Écran 2/2, séance trouvée (D23) : « Séance de Romain L. trouvée. Entre ton NIP pour la reprendre. »
export function sessionFoundNotice(prenom, initiale) {
  return `Séance de ${prenom} ${initiale}. trouvée. Entre ton NIP pour la reprendre.`;
}

// Écran 2/2, aucune séance (D23).
export function newSessionNotice(matricule) {
  return `Nouvelle séance pour le matricule ${matricule}. Vérifie-le : il figurera sur ton rapport et te servira à reprendre l'exercice sur un autre appareil.`;
}

// --- Virgule décimale (D10, D71) ----------------------------------------------------------------------------
// Le point est le séparateur affiché ; une virgule tapée est acceptée et devient un point, visiblement, à la
// sortie du champ ou à la validation — jamais pendant la frappe (dom.js). Rien d'autre ne change : le serveur
// juge ce qui est écrit, et lit la virgule de toute façon.

// Tout le champ : « 0,15 » → « 0.15 ».
export const decimalPoint = (text) => String(text ?? '').replaceAll(',', '.');

// Une zone « libellé ; valeur » par ligne (les dimensions de la Gestion du contenu) : la valeur seulement, après le dernier
// « ; » — « Ø 1,5 mm ; 0,059 » → « Ø 1,5 mm ; 0.059 », « M10 x 1.5 ; 10x1,5 » → « M10 x 1.5 ; 10x1.5 ».
export function decimalPointInValues(text) {
  return String(text ?? '').split('\n').map((line) => {
    const at = line.lastIndexOf(';');
    return at < 0 ? line : `${line.slice(0, at + 1)}${decimalPoint(line.slice(at + 1))}`;
  }).join('\n');
}

// --- Écran Question (UI §3.3, §3.4) ---------------------------------------------------------------------
// Les fonctions ci-dessous reçoivent ce que renvoie le serveur (SPEC §7). Les règles d'affichage
// plus riches (outil, matériau, aide, progression) sont dans rules.js.

// Libellé complet de chaque champ : nom, symbole, unité (UI §3.3).
export const FIELD_LABELS = {
  vc: 'Vitesse de coupe (Vc, pi/min)',
  feedPerTooth: 'Avance par dent (fz, po/dent)',
  rpm: 'Vitesse de rotation (N, tr/min)',
  feedPerRev: 'Avance totale par révolution (f, po/rév)',
  feedRate: "Vitesse d'avance (Vf, po/min)",
};

// Les mêmes, en morceaux, pour l'écran : le nom en gras, « Vc · pi/min » dessous, et le fichier du
// pictogramme de la grandeur (site/img/pictos/grandeurs/, UI §5).
export const FIELD_PARTS = {
  vc: { name: 'Vitesse de coupe', symbol: 'Vc', unit: 'pi/min', picto: 'vc' },
  feedPerTooth: { name: 'Avance par dent', symbol: 'fz', unit: 'po/dent', picto: 'fz' },
  rpm: { name: 'Vitesse de rotation', symbol: 'N', unit: 'tr/min', picto: 'n' },
  feedPerRev: { name: 'Avance totale par révolution', symbol: 'f', unit: 'po/rév', picto: 'f' },
  feedRate: { name: "Vitesse d'avance", symbol: 'Vf', unit: 'po/min', picto: 'vf' },
};

// Une grandeur nommée dans une phrase de rétroaction (D71) : en toutes lettres, jamais par son symbole seul, avec
// l'article qui va devant — « ta vitesse de rotation », « ton avance par dent » (« ton » devant une voyelle),
// ou « la vitesse de rotation », « l'avance par dent ».
//   whose : 'mine' (la saisie de l'étudiant) ou 'the'
const ARTICLES = {
  vc: { mine: 'ta ', the: 'la ' },
  feedPerTooth: { mine: 'ton ', the: "l'" },
  rpm: { mine: 'ta ', the: 'la ' },
  feedPerRev: { mine: 'ton ', the: "l'" },
  feedRate: { mine: 'ta ', the: 'la ' },
};
export function fieldInSentence(field, whose = 'mine') {
  return `${ARTICLES[field][whose]}${FIELD_PARTS[field].name.toLowerCase()}`;
}

// D'où vient la valeur attendue d'un champ jugé par cohérence avec les saisies de l'étudiant (D70, complément ;
// D71 : en toutes lettres), d'après `coherence` du serveur : « ton avance par dent × 2 » pour f ; « ta vitesse de
// rotation × ton avance totale par révolution » pour Vf, ou « la vitesse de rotation × ton avance… », « ta vitesse de
// rotation × l'avance… » quand un seul des deux facteurs est le sien. null pour les autres champs, ou sans cohérence.
export function coherenceSource(field, coherence) {
  if (!coherence) return null;
  const named = (key, engineField) => fieldInSentence(engineField, coherence.saisies.includes(key) ? 'mine' : 'the');
  if (field === 'feedPerRev') return `${named('fz', 'feedPerTooth')} × ${coherence.dents}`;
  if (field === 'feedRate') return `${named('n', 'rpm')} × ${named('f', 'feedPerRev')}`;
  return null;
}

// Note sous un champ corrigé (UI §3.4) : « Juste », « Juste (2496 attendu) » si la saisie diffère de
// la valeur attendue mais est tolérée — « Juste (0.000284 = ton avance par dent × 2) » quand cette valeur est faite
// de ses saisies —, « Faux — attendu 12.500 » ; un champ fourni garde sa mention.
export function fieldResultNote(champ) {
  if (champ.masque) return 'non demandée';
  if (!champ.evalue) return "fourni par l'exercice";
  if (!champ.ok) return `Faux — attendu ${champ.attendu}`;
  const typed = decimalPoint(champ.saisie.replace(/\s/g, ''));
  if (typed === champ.attendu) return 'Juste';
  const source = coherenceSource(champ.champ, champ.coherence);
  return source === null ? `Juste (${champ.attendu} attendu)` : `Juste (${champ.attendu} = ${source})`;
}

// Bandeau après « Vérifier » (UI §3.4).
//   name : le nom de l'outil à afficher (« SDTMR (métrique) », rules.js) ; par défaut, celui du serveur
export function correctionBanner(correction, requises, name = correction.outil.nom) {
  const { avant, apres } = correction.outil;
  const nom = name;
  if (correction.reussie) return `Bonne réponse — ${nom} : ${count(apres, 'réussite')} de suite sur ${requises}.`;
  if (avant === 0) return `Question ratée — le compteur de ${nom} reste à zéro.`;
  return `Question ratée — le compteur de ${nom} retombe à zéro (${avant} → 0).`;
}

// En-tête des écrans d'une séance : « Camille Tremblay · 2412345 » — le prénom et le nom de la
// première visite, renvoyés par le serveur (D21).
export function studentLine(seance) {
  const { prenom, nom, matricule } = seance.etudiant;
  return `${prenom} ${nom} · ${matricule}`;
}
