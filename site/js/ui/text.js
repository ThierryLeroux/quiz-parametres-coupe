// Textes des écrans, composés à partir des données (UI §3) : fonctions PURES, sans DOM, testées
// sous Node. Les écrans ne font qu'afficher ce qu'elles retournent.

// Champ évalué tel qu'écrit dans l'exercice (SPEC §10) → son nom en clair (UI §3.3).
const FIELD_NAMES = {
  vc: { label: 'vitesse de coupe', withArticle: 'la vitesse de coupe' },
  fz: { label: 'avance par dent', withArticle: "l'avance par dent" },
  n: { label: 'RPM', withArticle: 'le RPM' },
  f: { label: 'avance totale par révolution', withArticle: "l'avance totale par révolution" },
  vf: { label: "vitesse d'avance", withArticle: "la vitesse d'avance" },
};

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// « 1 outil », « 9 outils », « 0 réussite » : en français, 0 et 1 sont au singulier.
const count = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// « a », « a et b », « a, b et c »
function list(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items.at(-1)}`;
}

// Ligne sous le titre de l'exercice : « version r0 · 9 outils · champ évalué : vitesse de coupe »
export function exerciseMeta(exercise) {
  const fields = exercise.champs_evalues.map((field) => FIELD_NAMES[field].label);
  const heading = fields.length > 1 ? 'champs évalués' : 'champ évalué';
  return `version ${exercise.version} · ${count(exercise.outils.length, 'outil')} · ${heading} : ${fields.join(', ')}`;
}

// Résumé de l'exercice en trois phrases (UI §3.1) : quoi trouver, combien de réussites de suite, le rapport.
export function exerciseSummary(exercise) {
  const fields = list(exercise.champs_evalues.map((field) => FIELD_NAMES[field].withArticle));
  const required = exercise.outils.map((entry) => entry.reussites_requises);
  const min = Math.min(...required);
  const max = Math.max(...required);
  let times = `de ${min} à ${max} fois de suite, selon l'outil`;
  if (min === max) times = max === 1 ? 'une fois' : `${max} fois de suite`;
  return [
    `Pour chaque outil, trouve ${fields} à l'aide des tables de référence.`,
    `Chaque outil doit être réussi ${times} ; un échec remet son compteur à zéro.`,
    'À la fin : rapport de réussite à enregistrer en PDF et à remettre sur Léa.',
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
