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

// Message à montrer quand un appel au serveur de correction échoue (ApiError d'api.js, ou toute
// erreur portant { status, message }) : celui du serveur, sauf s'il n'a pas pu être joint.
export function serverErrorMessage(error) {
  if (error.status === 0 || error.status === undefined) return 'Le serveur de correction ne répond pas. Vérifie ta connexion, puis réessaie.';
  return error.message;
}

// Même chose pour l'identification (UI §3.2), où 401 veut dire « NIP incorrect » et 429 « trop d'essais ».
// Un 400 garde le message du serveur (ex. « Le matricule doit avoir exactement 7 chiffres. »).
export function identificationErrorMessage(error) {
  if (error.status === 401) return "NIP incorrect. Si tu l'as oublié, demande à ton enseignant de le remettre à zéro.";
  if (error.status === 429) return "Trop d'essais. Attends 10 minutes avant de réessayer.";
  return serverErrorMessage(error);
}

// --- Écran Question (UI §3.3, §3.4) ---------------------------------------------------------------------
// Les fonctions ci-dessous reçoivent ce que renvoie le serveur (SPEC §7) : seance.question,
// correction, seance.progression.

// Libellé complet de chaque champ : nom, symbole, unité (UI §3.3).
export const FIELD_LABELS = {
  vc: 'Vitesse de coupe (Vc, pi/min)',
  feedPerTooth: 'Avance par dent (fz, po/dent)',
  rpm: 'RPM (N, rév/min)',
  feedPerRev: 'Avance totale par révolution (f, po/rév)',
  feedRate: "Vitesse d'avance (Vf, po/min)",
};

// Ce qu'il faut savoir de l'outil pour calculer : liste de [libellé, valeur]. Un facteur de vitesse
// ou d'avance n'est montré que s'il diffère de 1 — sans lui, l'étudiant ne peut pas trouver N.
export function toolFacts(question) {
  const { outil } = question;
  const facts = [
    ['Opération', outil.operation],
    ['Dimension', question.dimension],
    ['Nombre de dents', String(outil.dents)],
    ["Matériau de l'outil", outil.materiau],
    ['RPM max de la machine-outil', String(outil.limite_rpm)],
  ];
  if (outil.fact_vc !== 1) facts.push(['Facteur de vitesse', `Vitesse ${outil.fact_vc < 1 ? 'réduite' : 'augmentée'} × ${outil.fact_vc}`]);
  if (outil.fact_av !== 1) facts.push(["Facteur d'avance", `Avance ${outil.fact_av < 1 ? 'réduite' : 'augmentée'} × ${outil.fact_av}`]);
  if (outil.commentaire) facts.push(['Note', outil.commentaire]);
  return facts;
}

// Le matériau brut : liste de [libellé, valeur]. Jamais ses vitesses de coupe : c'est l'exercice.
export function materialFacts(question) {
  const m = question.materiau;
  return [
    ['Classe et groupe', `${m.iso}${m.groupe} — ${m.materiau}`],
    ['Composition', String(m.composition ?? '—')],
    ['État', String(m.etat ?? '—')],
    ['Dureté', String(m.durete ?? '—')],
    ['Exemple', String(m.exemple ?? '—')],
  ];
}

// Note sous un champ corrigé (UI §3.4) : « Juste », « Juste (2496 attendu) » si la saisie diffère de
// la valeur attendue mais est tolérée, « Faux — attendu 12.500 » ; un champ fourni garde sa mention.
export function fieldResultNote(champ) {
  if (!champ.evalue) return "fourni par l'exercice";
  if (!champ.ok) return `Faux — attendu ${champ.attendu}`;
  const typed = champ.saisie.replace(/\s/g, '').replace(',', '.');
  return typed === champ.attendu ? 'Juste' : `Juste (${champ.attendu} attendu)`;
}

// Bandeau après « Vérifier » (UI §3.4).
export function correctionBanner(correction, requises) {
  const { nom, avant, apres } = correction.outil;
  if (correction.reussie) return `Bonne réponse — ${nom} : ${count(apres, 'réussite')} de suite sur ${requises}.`;
  if (avant === 0) return `Question ratée — le compteur de ${nom} reste à zéro.`;
  return `Question ratée — le compteur de ${nom} retombe à zéro (${avant} → 0).`;
}

// Une ligne de la progression : « MVLNR — 2 / 3 », et « réussi » quand c'est acquis.
export function progressLine(outil) {
  return `${outil.nom} — ${outil.reussites} / ${outil.requises}${outil.reussites >= outil.requises ? ' · réussi' : ''}`;
}

// En-tête des écrans d'une séance : « Camille Tremblay · 2412345 » — le prénom et le nom de la
// première visite, renvoyés par le serveur (D21).
export function studentLine(seance) {
  const { prenom, nom, matricule } = seance.etudiant;
  return `${prenom} ${nom} · ${matricule}`;
}
