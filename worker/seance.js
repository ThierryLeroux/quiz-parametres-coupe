// Règles d'une séance sur le serveur de correction (SPEC §7, décisions D19, D21) : tirage,
// correction, compteurs, cadence, essais de NIP — et ce qu'on en montre au navigateur.
//
// Fonctions PURES : ni base de données, ni réseau, ni horloge cachée. Elles reçoivent une séance
// (une ligne de la table seances, colonnes JSON déjà lues — voir base.js), l'exercice, le
// catalogue, l'heure et l'aléa, et retournent des valeurs. Le moteur est celui du site (site/js/) :
// il n'existe qu'en un exemplaire.

import { computeParameters } from '../site/js/calcul.js';
import { ANSWER_FIELDS, gradeAnswers, parseAnswer, toleranceLabel } from '../site/js/correction.js';
import { fieldsToGrade } from '../site/js/exercice.js';
import { formatParameters } from '../site/js/format.js';
import { eligibleTools, isComplete, recordResult } from '../site/js/progression.js';
import { generateQuestion } from '../site/js/question.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

export const TOKEN_LIFETIME_MS = 120 * MINUTE; // le jeton expire 2 h après la dernière activité
export const CADENCE_MS = 10 * SECOND; // au moins 10 s entre deux corrections d'une même séance
export const NIP_MAX_ATTEMPTS = 5; // 5 échecs…
export const NIP_WINDOW_MS = 10 * MINUTE; // … en 10 minutes…
export const NIP_LOCK_MS = 10 * MINUTE; // … verrouillent l'identification 10 minutes

// --- Mode test (décision D26) ---------------------------------------------------------------------------
// Le serveur joint les valeurs attendues à la question, pour essayer le parcours sans calculer.
// Deux verrous, tous deux côté serveur : la variable MODE_TEST=1, posée seulement dans .dev.vars
// (jamais dans wrangler.jsonc ni en production), ET une requête adressée au poste lui-même.
// Rien de ce qu'envoie le navigateur (adresse, en-tête, corps) ne l'active.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

export function isTestMode(variable, hostname) {
  return variable === '1' && LOCAL_HOSTS.includes(hostname);
}

// Cadence réglable (D39), pour « npm run test:api » : la variable CADENCE_S (secondes entières,
// 1 à 999) n'est honorée que pour une requête adressée au poste lui-même, comme le mode test ;
// partout ailleurs, et sans elle, la cadence est celle de CADENCE_MS.
export function cadenceFor(variable, hostname) {
  if (!LOCAL_HOSTS.includes(hostname) || typeof variable !== 'string' || !/^[1-9]\d{0,2}$/.test(variable)) return CADENCE_MS;
  return Number(variable) * SECOND;
}

// Date ISO décalée de `ms` millisecondes : later(now, TOKEN_LIFETIME_MS).
export const later = (now, ms) => new Date(now.getTime() + ms).toISOString();

// --- Compteurs ---------------------------------------------------------------------------------------
// Colonne « compteurs » : { reussites: { [id d'outil]: n }, totalReussies }. Indexés par id d'outil,
// les compteurs survivent à une modification de l'exercice (D21) : un outil retiré est ignoré, un
// outil ajouté vaut 0. progression.js veut en plus l'id de l'exercice : on le lui ajoute au passage.

export const emptyCounters = () => ({ reussites: {}, totalReussies: 0 });

const progressOf = (counters, exercise) => ({ exerciceId: exercise.id, ...counters });

export function isExerciseComplete(counters, exercise) {
  return isComplete(exercise, progressOf(counters, exercise));
}

// --- Question ------------------------------------------------------------------------------------------

// La question mémorisée peut-elle encore être posée ? Oui si son outil est toujours « à évaluer ».
// Non si, depuis le tirage, l'exercice a été modifié (D21) et que l'outil l'a quitté, a quitté le
// catalogue, ou se trouve déjà réussi parce qu'on exige maintenant moins de réussites. Non plus si
// l'outil a maintenant deux diamètres (D25) et que la question, tirée avant, n'a pas de barre.
export function isQuestionValid(question, counters, exercise, data) {
  if (question === null) return false;
  const tool = data.outils.find((entry) => entry.id === question.tool.id);
  if (tool?.dimensions_barre && !question.bar) return false;
  return eligibleTools(exercise, data, progressOf(counters, exercise)).some((eligible) => eligible.id === question.tool.id);
}

// Tire une question parmi les outils encore à évaluer ; null s'il n'en reste aucun (exercice complété).
export function drawQuestion(counters, exercise, data, random) {
  const tools = eligibleTools(exercise, data, progressOf(counters, exercise));
  return tools.length > 0 ? generateQuestion(data, tools, random) : null;
}

// --- Correction ----------------------------------------------------------------------------------------

// Ne garde des saisies reçues que les cinq champs, en texte court : le reste n'entre ni dans la
// correction ni dans le journal.
export function cleanAnswers(answers) {
  const source = answers !== null && typeof answers === 'object' ? answers : {};
  return Object.fromEntries(ANSWER_FIELDS.map((field) => [field, typeof source[field] === 'string' ? source[field].trim().slice(0, 32) : '']));
}

// Corrige la question mémorisée avec les saisies de l'étudiant.
// Retourne { success, result, counters } :
//   result   : pour le journal — la correction de gradeAnswers et les valeurs attendues, non arrondies
//   counters : les nouveaux compteurs (réussites consécutives, D12)
export function gradeQuestion(question, answers, counters, exercise, data) {
  const expected = computeParameters(question, data);
  const correction = gradeAnswers(expected, answers, fieldsToGrade(exercise));
  const progress = recordResult(progressOf(counters, exercise), question.tool.id, correction.success);
  return {
    success: correction.success,
    result: { ...correction, attendu: expected },
    counters: { reussites: progress.reussites, totalReussies: progress.totalReussies },
  };
}

// Secondes à attendre avant la prochaine correction (0 = on peut corriger). En mode test (D26),
// la cadence est levée : on clique Vérifier, Question suivante, Vérifier… ; cadenceMs est celle
// de cadenceFor (D39), 10 s partout sauf en local avec CADENCE_S.
export function cadenceWait(session, now, { testMode = false, cadenceMs = CADENCE_MS } = {}) {
  if (testMode || session.derniere_correction === null) return 0;
  const elapsed = now.getTime() - new Date(session.derniere_correction).getTime();
  return elapsed >= cadenceMs ? 0 : Math.ceil((cadenceMs - elapsed) / SECOND);
}

// --- Essais de NIP ---------------------------------------------------------------------------------------

// L'identification de cette séance est-elle verrouillée en ce moment ?
export function isNipLocked(session, now) {
  return session.verrou_nip_jusqua !== null && session.verrou_nip_jusqua > now.toISOString();
}

// Compte un essai de NIP de plus ; retourne les nouvelles valeurs des trois colonnes.
// L'essai est compté AVANT de regarder le NIP (index.js) : des essais lancés en parallèle ne
// peuvent pas tous passer. Le 5e essai d'une fenêtre de 10 minutes pose d'avance le verrou de
// 10 minutes : s'il réussit, l'identification efface tout (NIP_CLEARED) ; s'il échoue, le verrou reste.
export function countNipAttempt(session, now) {
  const windowOpen = session.essais_nip_debut !== null && later(new Date(session.essais_nip_debut), NIP_WINDOW_MS) > now.toISOString();
  const attempts = windowOpen ? session.essais_nip + 1 : 1;
  if (attempts >= NIP_MAX_ATTEMPTS) return { essais_nip: 0, essais_nip_debut: null, verrou_nip_jusqua: later(now, NIP_LOCK_MS) };
  return { essais_nip: attempts, essais_nip_debut: windowOpen ? session.essais_nip_debut : now.toISOString(), verrou_nip_jusqua: null };
}

// Après une identification réussie : plus aucun essai au compteur, plus de verrou.
export const NIP_CLEARED = { essais_nip: 0, essais_nip_debut: null, verrou_nip_jusqua: null };

// --- Ce qu'on montre au navigateur ---------------------------------------------------------------------

// La question, prête à afficher. Les champs évalués sont à saisir ; les autres sont fournis, avec
// leur valeur théorique mise en forme (SPEC §10). Les Vc du matériau n'y sont pas : les trouver
// dans la table, c'est l'exercice.
//   testMode : mode test (D26) — et alors seulement, les valeurs attendues des champs évalués
//              accompagnent la question (reponses_test), pour le bouton « Remplir »
export function questionView(question, exercise, data, { testMode = false } = {}) {
  const tool = data.outils.find((entry) => entry.id === question.tool.id);
  const graded = fieldsToGrade(exercise);
  const displayed = formatParameters(computeParameters(question, data));
  const { vc_pi_min: _vc, ...material } = question.material;
  return {
    identifiant: question.displayId,
    outil: {
      id: tool.id,
      nom: tool.nom,
      operation: tool.operation,
      commentaire: tool.commentaire,
      dents: question.teeth,
      materiau: question.toolMaterial.label,
      limite_rpm: tool.limite_rpm,
      fact_vc: tool.fact_vc,
      fact_av: tool.fact_av,
      barre: question.bar?.label ?? null, // outil à deux diamètres (D25) : le Ø de la barre ; sinon null
    },
    dimension: question.dimension.label,
    materiau: material,
    champs: ANSWER_FIELDS.map((field) => (graded.includes(field)
      ? { champ: field, evalue: true, texte: '' }
      : { champ: field, evalue: false, texte: displayed[field] })),
    ...(testMode ? { reponses_test: Object.fromEntries(graded.map((field) => [field, displayed[field]])) } : {}),
  };
}

// Le calcul d'un champ, en une ligne, montré sous un champ faux (UI §3.4) : « Vf = N × f = 2500 × 0.0050 ».
// null quand il n'y a pas de calcul : Vc et l'avance fixe se lisent dans une table.
//   shown : textes des valeurs à montrer — la saisie de l'étudiant quand elle est lisible, sinon la valeur théorique
function calculationLine(field, question, expected, shown, tool, operation) {
  const inches = (value) => String(Number(value.toPrecision(5)));
  const diameter = inches(question.dimension.diameter);
  // Outil à deux diamètres (D25) : on nomme celui qui sert — le Ø usiné (le trou) pour N, le Ø de la barre pour l'avance.
  const twoDiameters = Boolean(question.bar);
  if (field === 'rpm') {
    const factor = tool.fact_vc === 1 ? '' : ` × ${tool.fact_vc}`;
    const capped = expected.rpmCapped ? ` → plafonné à ${tool.limite_rpm}` : '';
    return `N = Vc × 4 / Ø${twoDiameters ? ' usiné' : ''} = ${shown.vc} × 4 / ${diameter}${factor}${capped}`;
  }
  if (field === 'feedPerTooth' && expected.feedType === 'thread') return `fz = pas du filet = ${shown.feedPerTooth}`;
  if (field === 'feedPerTooth' && expected.feedType === 'proportional') {
    const factor = tool.fact_av === 1 ? '' : ` × ${tool.fact_av}`;
    const capped = expected.feedPerToothCapped ? ` → plafonné à ${operation.avance_max_po_rev}` : '';
    if (twoDiameters) return `fz = avance × Ø barre = ${operation.avance_po_rev} × ${inches(question.bar.diameter)}${factor}${capped}`;
    return `fz = avance × Ø = ${operation.avance_po_rev} × ${diameter}${factor}${capped}`;
  }
  if (field === 'feedPerRev') return `f = fz × dents = ${shown.feedPerTooth} × ${question.teeth}`;
  if (field === 'feedRate') return `Vf = N × f = ${shown.rpm} × ${shown.feedPerRev}`;
  return null;
}

// La correction, prête à afficher (UI §3.4). Pour chaque champ : juste ou faux, la saisie, la valeur
// attendue, et — pour un champ évalué — la tolérance en clair, l'écart en % et le calcul en une ligne.
// Pour Vf, la valeur attendue est N × f AVEC les N et f saisis (cohérence interne, D15), pas la
// valeur théorique : c'est sur elle que Vf a été jugée.
//   before : compteur de l'outil avant cette correction (« le compteur retombe à zéro (2 → 0) »)
export function correctionView(question, answers, result, before, counters, data) {
  const expected = result.attendu;
  const tool = data.outils.find((entry) => entry.id === question.tool.id);
  const operation = data.operationByName.get(tool.operation);

  const typed = Object.fromEntries(ANSWER_FIELDS.map((field) => [field, parseAnswer(answers[field])]));
  const reference = { ...expected, feedRate: (typed.rpm ?? expected.rpm) * (typed.feedPerRev ?? expected.feedPerRev) };
  const displayed = formatParameters(reference);
  const shown = Object.fromEntries(ANSWER_FIELDS.map((field) => [field, typed[field] === null ? displayed[field] : answers[field].replace(',', '.')]));

  return {
    reussie: result.success,
    outil: { id: question.tool.id, nom: question.tool.name, avant: before, apres: counters.reussites[question.tool.id] ?? 0 },
    champs: ANSWER_FIELDS.map((field) => {
      const evaluated = result.fields[field].min !== null;
      const gap = evaluated && typed[field] !== null && reference[field] !== 0 ? (typed[field] - reference[field]) / reference[field] : null;
      return {
        champ: field,
        evalue: evaluated,
        ok: result.fields[field].ok,
        saisie: answers[field],
        attendu: displayed[field],
        tolerance: evaluated ? toleranceLabel(expected.feedType, field) : null,
        ecart_pct: gap === null ? null : Number((gap * 100).toFixed(1)),
        calcul: evaluated ? calculationLine(field, question, expected, shown, tool, operation) : null,
      };
    }),
  };
}

// La plage de dimensions d'un outil dans l'exercice : « Ø 1/64 po à Ø 1 po » — celles que l'exercice
// permet, si l'entrée en restreint. Une seule dimension : son libellé.
function dimensionRange(tool, entry) {
  const labels = tool.dimensions.map((d) => d.libelle).filter((label) => !entry.dimensions || entry.dimensions.includes(label));
  return labels.length === 1 ? labels[0] : `${labels[0]} à ${labels.at(-1)}`;
}

// L'état de la séance : qui, quel exercice, où il en est, la question en attente.
// Le prénom et le nom sont ceux de la première visite (D21).
//   options : { testMode, now } — testMode est transmis à questionView (D26) ; now sert à attendre_s
// Chaque outil de la progression porte aussi son opération et sa plage de dimensions : c'est ce que
// l'attestation liste (D30), et qui fera partie du contenu signé au jalon 5.
// attendre_s : secondes avant que la prochaine correction soit acceptée (cadence, SPEC §7) — le
// navigateur en fait un compte à rebours ; 0 sans horloge, ou en mode test.
export function sessionView(session, exercise, data, options = {}) {
  const question = isQuestionValid(session.question_courante, session.compteurs, exercise, data) ? session.question_courante : null;
  const tools = exercise.outils.map((entry) => {
    const tool = data.outils.find((candidate) => candidate.id === entry.id);
    return {
      id: entry.id,
      nom: tool.nom,
      operation: tool.operation,
      plage: dimensionRange(tool, entry),
      reussites: Math.min(session.compteurs.reussites[entry.id] ?? 0, entry.reussites_requises),
      requises: entry.reussites_requises,
    };
  });
  return {
    etudiant: { prenom: session.prenom, nom: session.nom, matricule: session.matricule },
    exercice: { id: exercise.id, titre: exercise.titre, version: exercise.version },
    debut: session.debut,
    reussite_le: session.reussite_le,
    attendre_s: options.now ? cadenceWait(session, options.now, options) : 0,
    progression: {
      outils: tools,
      outils_termines: tools.filter((tool) => tool.reussites >= tool.requises).length,
      total_reussies: session.compteurs.totalReussies,
    },
    question: question === null ? null : questionView(question, exercise, data, options),
  };
}
