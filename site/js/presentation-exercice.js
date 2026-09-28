// La présentation des exercices en direct (chantier E5, jalon E5-3, décision D78) : ce qui, dans un exercice, ne fait
// qu'afficher — son titre, son cours, « À l'accueil » ; la photo et la note de chacune de ses copies d'outils. Elle ne
// se publie pas : elle s'applique en direct, exercice par exercice, et se pose par-dessus TOUTE version de l'exercice
// dans ce que le serveur montre (accueil, page de description, page Question, espace professeur, Gestion du contenu),
// jamais dans le tirage ni la correction. Seule exception : l'attestation émise inscrit le titre en vigueur (D78, point 5).
//
// Son format est celui de l'exercice réduit à la liste blanche : { titre, cours, liste, outils: [{ id, image,
// commentaire }] } — cours null : sans cours ; liste : « À l'accueil » ; image null : la photo nommée d'après
// l'identifiant de la copie ; commentaire null : pas de note. La clé d'une copie est son identifiant dans l'exercice ;
// elle est versionnée, comme tout ce qui n'est pas dans la liste.
//
// Fonctions PURES, partagées par le serveur et le navigateur : la liste blanche, la présentation d'une version, celle
// en vigueur, la pose par-dessus un contenu et une séance, la validation, les différences, les retouches en attente.

import { courseErrors } from './exercice.js';
import { OUTSIDE_WHITELIST } from './presentation.js';

// La liste blanche (D75, point 2) : à la racine de l'exercice, et dans chaque copie d'outil.
export const EXERCISE_PRESENTATION_FIELDS = ['titre', 'cours', 'liste'];
export const COPY_PRESENTATION_FIELDS = ['image', 'commentaire'];
const ROOT_KEYS = [...EXERCISE_PRESENTATION_FIELDS, 'outils'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const copiesOf = (content) => (Array.isArray(content?.outils) ? content.outils : []).filter(isObject);

// L'entrée de présentation d'une copie : son identifiant, sa photo et sa note (null : aucune).
const copyEntryOf = (copy) => ({ id: copy.id, image: copy.image ?? null, commentaire: typeof copy.commentaire === 'string' && copy.commentaire !== '' ? copy.commentaire : null });

// La présentation que porte un contenu d'exercice (une version publiée, ou un brouillon).
export function exercisePresentationOf(content) {
  return {
    titre: typeof content?.titre === 'string' ? content.titre : '',
    cours: typeof content?.cours === 'string' ? content.cours : null,
    liste: content?.liste !== false,
    outils: copiesOf(content).map(copyEntryOf),
  };
}

// Une présentation remise dans l'ordre de la liste blanche, sans autre clé, les textes sans espaces autour : ce qu'on
// enregistre et ce qu'on exporte. L'appelant l'a validée (exercisePresentationErrors).
export function normalizeExercisePresentation(p) {
  const trimmed = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  return {
    titre: typeof p?.titre === 'string' ? p.titre.trim() : '',
    cours: trimmed(p?.cours),
    liste: p?.liste !== false,
    outils: (Array.isArray(p?.outils) ? p.outils : []).filter(isObject).map((e) => ({ id: e.id, image: e.image ?? null, commentaire: trimmed(e.commentaire) })),
  };
}

// La présentation en vigueur d'un exercice publié (D78, point 3), celle du panneau : le titre, le cours et « À
// l'accueil » appliqués (sinon ceux de la dernière version) ; pour chaque copie de la dernière version, l'entrée
// appliquée si elle existe, sinon celle de la version ; puis les entrées appliquées d'une copie que la dernière version
// n'a plus (elle sert encore aux séances épinglées à une version plus ancienne). Rien d'appliqué (stored null) : la
// présentation de la dernière version, telle quelle. null pour un exercice jamais publié (rien d'appliqué, pas de version).
//   stored : le contenu enregistré (presentation_exercices.contenu), ou null ; latestContent : le contenu de la dernière version
export function currentExercisePresentation(stored, latestContent) {
  if (!isObject(stored) && !isObject(latestContent)) return null;
  const latest = exercisePresentationOf(latestContent);
  if (!isObject(stored)) return latest;
  const applied = normalizeExercisePresentation(stored);
  const byId = new Map(applied.outils.map((e) => [e.id, e]));
  const ids = new Set(latest.outils.map((e) => e.id));
  return {
    titre: applied.titre,
    cours: applied.cours,
    liste: applied.liste,
    outils: [...latest.outils.map((e) => byId.get(e.id) ?? e), ...applied.outils.filter((e) => !ids.has(e.id))],
  };
}

// Les identifiants des copies qu'une présentation connaît.
export const knownCopies = (presentation) => new Set(copiesOf(presentation).map((e) => e.id));

// Un contenu d'exercice avec la présentation posée par-dessus (D78, point 3) : le titre, le cours et « À l'accueil » ;
// la photo et la note de chaque copie que la présentation connaît — les autres gardent celles de leur version. Sert à
// l'exercice que le serveur montre (au format du moteur, avec ses outils), à l'instantané d'une version publiée et au
// brouillon d'un exercice dupliqué. Un champ n'est réécrit que s'il change : quand la présentation est celle du
// contenu, le résultat lui est identique, clé pour clé. Le contenu reçu n'est pas modifié ; sans présentation, il est rendu tel quel.
export function applyExercisePresentation(content, presentation) {
  if (!isObject(presentation) || !isObject(content)) return content;
  const out = { ...content };
  const now = exercisePresentationOf(content);
  if (now.titre !== presentation.titre) out.titre = presentation.titre;
  if (now.cours !== presentation.cours) {
    if (presentation.cours === null) delete out.cours;
    else out.cours = presentation.cours;
  }
  if (now.liste !== presentation.liste) {
    if (presentation.liste === false) out.liste = false;
    else delete out.liste;
  }
  if (Array.isArray(content.outils)) {
    const byId = new Map(copiesOf(presentation).map((e) => [e.id, e]));
    out.outils = content.outils.map((copy) => {
      const entry = isObject(copy) ? byId.get(copy.id) : undefined;
      if (entry === undefined) return copy;
      const was = copyEntryOf(copy);
      const changed = COPY_PRESENTATION_FIELDS.filter((field) => !same(was[field], entry[field]));
      return changed.length === 0 ? copy : { ...copy, ...Object.fromEntries(changed.map((field) => [field, entry[field]])) };
    });
  }
  return out;
}

// La séance que le serveur rend (sessionView) avec la présentation posée par-dessus (D78, point 4) : le titre de la
// barre, et la photo et la note de l'outil de la question en attente. Rien d'autre : la progression, la question et
// ses valeurs restent celles de la version épinglée. La vue reçue n'est pas modifiée.
export function presentSessionView(view, presentation) {
  if (!isObject(presentation) || !isObject(view)) return view;
  const out = { ...view, exercice: { ...view.exercice, titre: presentation.titre } };
  const outil = view.question?.outil;
  const entry = isObject(outil) ? copiesOf(presentation).find((e) => e.id === outil.id) : undefined;
  if (entry !== undefined) {
    const image = entry.image ?? outil.id; // comme questionView : la photo, sinon celle nommée d'après la copie
    const noteChanged = (outil.commentaire ?? null) !== entry.commentaire;
    if (image !== outil.image || noteChanged) out.question = { ...view.question, outil: { ...outil, image, ...(noteChanged ? { commentaire: entry.commentaire } : {}) } };
  }
  return out;
}

// L'exercice avec le titre en vigueur : ce que l'attestation émise inscrit (D78, point 5). Rien d'autre ne change.
export const withLiveTitle = (exercise, presentation) => (isObject(presentation) ? { ...exercise, titre: presentation.titre } : exercise);

// Un contenu d'exercice sans les champs de la présentation : ce que comparent, pour un exercice publié, le « aucune
// différence à publier », le « brouillon modifié », « Annuler les modifications » et la cascade (D78, point 8).
export function exerciseValues(content) {
  if (!isObject(content)) return content;
  const { titre: _t, cours: _c, liste: _l, ...values } = content;
  if (Array.isArray(content.outils)) values.outils = content.outils.map((copy) => {
    if (!isObject(copy)) return copy;
    const { image: _i, commentaire: _m, ...rest } = copy;
    return rest;
  });
  return values;
}

// --- Validation (D78, points 7 et 11) ------------------------------------------------------------------------------

// L'identifiant d'une image de la base (D56 : le même motif que worker/images.js).
const IMAGE_REF = /^[a-z0-9]+([_-][a-z0-9]+)*$/;
const DRAFT_ADVICE = "il se modifie dans le brouillon de l'exercice, puis se publie";

// Les erreurs d'une présentation d'exercice reçue : [messages]. Toute clé hors de la liste blanche est une erreur (le
// serveur refuse, 400) ; chaque entrée est complète ; le titre n'est pas vide, le cours suit la règle de D71, une note
// est un texte ou null. Une photo CHOISIE (différente de celle que la présentation en vigueur a pour cette copie) doit
// exister et ne pas être archivée ; archivée et déjà en vigueur, elle n'est qu'un avertissement (exerciseArchivedWarnings).
//   images   : les fiches des images de la base ([{ id, archivee_le }]), ou null : seule la forme est vérifiée
//   inForce  : la présentation en vigueur, ou null (toute photo est alors choisie)
//   archived : 'erreur' (par défaut) ; 'permis' pour « Rétablir » et l'import, où rien n'est choisi
//   copies   : les identifiants de copie permis (knownCopies de la présentation en vigueur), ou null : non vérifiés
export function exercisePresentationErrors(p, { images = null, inForce = null, archived = 'erreur', copies = null } = {}) {
  if (!isObject(p)) return ["La présentation doit être un objet { titre, cours, liste, outils }."];
  const errors = [];
  const known = Array.isArray(images) ? new Map(images.filter(isObject).map((image) => [image.id, image])) : null;
  for (const name of Object.keys(p)) {
    if (!ROOT_KEYS.includes(name)) errors.push(`« ${name} » est ${OUTSIDE_WHITELIST} : seuls le titre, le cours, « À l'accueil » (liste) et la photo et la note des outils s'y modifient ; ${DRAFT_ADVICE}.`);
  }
  for (const name of ROOT_KEYS) if (!(name in p)) errors.push(`« ${name} » manque`);
  if ('titre' in p && !isText(p.titre)) errors.push('Le titre est vide.');
  if ('cours' in p && p.cours !== null) errors.push(...courseErrors(p.cours).map((m) => m.replace('(ou être absent : sans cours)', '(ou null : sans cours)')));
  if ('liste' in p && typeof p.liste !== 'boolean') errors.push("« liste » (À l'accueil) doit être true ou false.");
  if (!('outils' in p)) return errors;
  if (!Array.isArray(p.outils)) return [...errors, '« outils » doit être une liste'];
  const inForceById = new Map(copiesOf(inForce).map((e) => [e.id, e]));
  p.outils.forEach((entry, i) => {
    if (!isObject(entry)) { errors.push(`outils[${i}] : n'est pas un objet`); return; }
    const where = `outils[${i}] (${entry.id})`;
    for (const field of Object.keys(entry)) {
      if (field !== 'id' && !COPY_PRESENTATION_FIELDS.includes(field)) errors.push(`${where} : « ${field} » est ${OUTSIDE_WHITELIST} : ${DRAFT_ADVICE}`);
    }
    for (const field of ['id', ...COPY_PRESENTATION_FIELDS]) if (!(field in entry)) errors.push(`${where} : « ${field} » manque`);
    if (!isText(entry.id)) errors.push(`${where} : « id » est vide`);
    else if (copies !== null && !copies.has(entry.id)) errors.push(`${where} : cette copie n'est dans aucune version publiée de l'exercice ; une copie nouvelle reçoit sa photo et sa note dans le brouillon, puis se publie.`);
    if ('image' in entry && entry.image !== null) {
      if (typeof entry.image !== 'string' || !IMAGE_REF.test(entry.image)) errors.push(`${where} : « image » doit être l'identifiant d'une image (ou null)`);
      else if (known !== null && inForceById.get(entry.id)?.image !== entry.image) {
        if (!known.has(entry.image)) errors.push(`${where} : « image » : l'image « ${entry.image} » est inconnue`);
        else if (known.get(entry.image).archivee_le && archived !== 'permis') errors.push(`${where} : « image » : l'image « ${entry.image} » est archivée (choisis-en une autre, ou rétablis-la dans l'onglet Images)`);
      }
    }
    if ('commentaire' in entry && entry.commentaire !== null && !isText(entry.commentaire)) errors.push(`${where} : « commentaire » (la note) doit être un texte non vide, ou null : pas de note`);
  });
  const ids = p.outils.filter(isObject).map((e) => e.id);
  for (const [i, id] of ids.entries()) if (ids.indexOf(id) !== i) errors.push(`outils : « ${id} » en double`);
  return errors;
}

// Les avertissements d'une présentation (comme la retouche de D76) : une photo archivée qu'elle nomme reste affichée
// (une image archivée est toujours servie) et ne bloque rien.
//   names : Map identifiant de copie → nom de l'outil, pour les nommer
export function exerciseArchivedWarnings(p, images, names = new Map()) {
  const archived = new Set((images ?? []).filter((image) => isObject(image) && image.archivee_le).map((image) => image.id));
  return copiesOf(p).filter((e) => archived.has(e.image)).map((e) => `${copyLabel(e.id, names)} — photo : l'image « ${e.image} » est archivée ; elle reste affichée et ne bloque rien (pour la remplacer, choisis-en une autre, ou rétablis-la dans l'onglet Images).`);
}

// Les images qu'une présentation d'exercice nomme (les photos) : ce qui la rend « utilisée » (D78, point 11).
export const imagesOfExercisePresentation = (p) => copiesOf(p).map((e) => e.image).filter((id) => typeof id === 'string');

// --- Différences, en clair ---------------------------------------------------------------------------------------

const quoted = (v) => (v === null || v === undefined || v === '' ? '—' : `« ${v} »`);
const plain = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));
const copyLabel = (id, names) => (names.has(id) ? `Outil « ${names.get(id)} » (${id})` : `Outil ${id}`);

// Les différences entre deux présentations d'exercice, une ligne par valeur : « Titre : « A » → « B » », « Cours : … »,
// « À l'accueil : oui → non », « Outil « Foret » (foret_1) — photo : a → b », « … — note : « … » → — ».
//   names : Map identifiant de copie → nom de l'outil
export function exercisePresentationDiff(before, after, names = new Map()) {
  const lines = [];
  if (!isObject(after)) return lines;
  const b = isObject(before) ? before : { titre: '', cours: null, liste: true, outils: [] };
  if (b.titre !== after.titre) lines.push(`Titre : ${quoted(b.titre)} → ${quoted(after.titre)}`);
  if ((b.cours ?? null) !== (after.cours ?? null)) lines.push(`Cours : ${quoted(b.cours)} → ${quoted(after.cours)}`);
  if ((b.liste !== false) !== (after.liste !== false)) lines.push(`À l'accueil : ${b.liste !== false ? 'oui' : 'non'} → ${after.liste !== false ? 'oui' : 'non'}`);
  const beforeById = new Map(copiesOf(b).map((e) => [e.id, e]));
  for (const e of copiesOf(after)) {
    const old = beforeById.get(e.id);
    const label = copyLabel(e.id, names);
    if (!old) { lines.push(`${label} — présentation ajoutée : photo ${plain(e.image)}, note ${quoted(e.commentaire)}`); continue; }
    if (!same(old.image, e.image)) lines.push(`${label} — photo : ${plain(old.image)} → ${plain(e.image)}`);
    if (!same(old.commentaire, e.commentaire)) lines.push(`${label} — note : ${quoted(old.commentaire)} → ${quoted(e.commentaire)}`);
  }
  return lines;
}

// Les noms des copies, par identifiant, d'après des contenus d'exercice (versions, brouillon) : le dernier donné l'emporte.
export function copyNames(contents) {
  const names = new Map();
  for (const content of contents) for (const copy of copiesOf(content)) if (isText(copy.nom)) names.set(copy.id, copy.nom);
  return names;
}

// --- Retouches en attente dans le brouillon (D78, point 10) ------------------------------------------------------
// Avant ce jalon, la présentation d'un exercice se modifiait dans son brouillon : une retouche jamais publiée y est
// peut-être encore. C'est une valeur de présentation du brouillon — pour le titre, le cours, « À l'accueil », ou pour
// une copie que la présentation en vigueur connaît — que ni la présentation (en vigueur ou dans son historique), ni
// AUCUNE version publiée n'a jamais portée : une valeur venue d'une version (« Reprendre », ou d'avant un « Appliquer »
// qui l'a remplacée), ou qui a déjà été en vigueur, n'en est pas une. Retourne { lignes, contenu } : les différences en clair (en vigueur → brouillon) et la présentation en
// vigueur avec ces retouches (ce que « Les reprendre dans le panneau » y met) ; lignes vide s'il n'y en a pas.
//   versions : les contenus de toutes les versions publiées ; draft : le brouillon ; current : la présentation en vigueur
//   history  : les contenus de l'historique de la présentation (ce qui a déjà été en vigueur)
export function pendingExercisePresentation(versions, draft, current, names = new Map(), history = []) {
  if (!isObject(current) || !isObject(draft)) return { lignes: [], contenu: current };
  const published = [...(Array.isArray(versions) ? versions : []), ...(Array.isArray(history) ? history : [])].filter(isObject).map(exercisePresentationOf);
  const d = exercisePresentationOf(draft);
  const contenu = structuredClone(current);
  for (const field of EXERCISE_PRESENTATION_FIELDS) {
    if (!same(d[field], current[field]) && !published.some((v) => same(v[field], d[field]))) contenu[field] = d[field];
  }
  const draftById = new Map(d.outils.map((e) => [e.id, e]));
  for (const entry of contenu.outils) {
    const now = draftById.get(entry.id);
    if (now === undefined) continue;
    for (const field of COPY_PRESENTATION_FIELDS) {
      if (same(now[field], entry[field])) continue;
      if (!published.some((v) => v.outils.some((e) => e.id === entry.id && same(e[field], now[field])))) entry[field] = now[field];
    }
  }
  return { lignes: exercisePresentationDiff(current, contenu, names), contenu };
}
