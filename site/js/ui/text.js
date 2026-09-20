// Textes des écrans, composés à partir des données (UI §3) : fonctions PURES, sans DOM, testées
// sous Node. Les écrans ne font qu'afficher ce qu'elles retournent.

// Champ évalué tel qu'écrit dans l'exercice (SPEC §10) → son nom en clair (UI §3.3).
const FIELD_NAMES = {
  vc: 'vitesse de coupe',
  fz: 'avance par dent',
  n: 'RPM',
  f: 'avance totale par révolution',
  vf: "vitesse d'avance",
};

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// « 1 outil », « 9 outils », « 0 réussite » : en français, 0 et 1 sont au singulier.
const count = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// Ligne sous le titre de l'exercice : « version r0 · 9 outils · champ évalué : vitesse de coupe »
export function exerciseMeta(exercise) {
  const fields = exercise.champs_evalues.map((field) => FIELD_NAMES[field]);
  const heading = fields.length > 1 ? 'champs évalués' : 'champ évalué';
  return `version ${exercise.version} · ${count(exercise.outils.length, 'outil')} · ${heading} : ${fields.join(', ')}`;
}

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

// Date ISO → « 19 sept. 2026, 13 h 40 », à l'heure du poste.
export function formatDateTime(iso) {
  const date = new Date(iso);
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${date.getHours()} h ${minutes}`;
}

// En-tête de l'écran Question : « Camille Tremblay · 2412345 »
export function studentLine(state) {
  const { prenom, nom, matricule } = state.etudiant;
  return `${prenom} ${nom} · ${matricule}`;
}

// Panneau « Séance en cours » : « Camille Tremblay · 2412345 · commencée le … · 7 réussites »
export function sessionSummary(state) {
  const parts = [studentLine(state), `commencée le ${formatDateTime(state.debut)}`, count(state.progression.totalReussies, 'réussite')];
  if (state.reussite !== null) parts.push('exercice réussi');
  return parts.join(' · ');
}
