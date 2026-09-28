// Tests de site/js/presentation-exercice.js (chantier E5, jalon E5-3, décision D78) : la liste blanche, la présentation
// d'une version, celle en vigueur, la pose par-dessus un contenu et une séance, la validation, les différences, les
// retouches en attente du brouillon, les valeurs sans la présentation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COPY_PRESENTATION_FIELDS, EXERCISE_PRESENTATION_FIELDS, applyExercisePresentation, copyNames, currentExercisePresentation, exerciseArchivedWarnings,
  exercisePresentationDiff, exercisePresentationErrors, exercisePresentationOf, exerciseValues, imagesOfExercisePresentation, knownCopies,
  normalizeExercisePresentation, pendingExercisePresentation, presentSessionView, withLiveTitle,
} from '../site/js/presentation-exercice.js';
import { OUTSIDE_WHITELIST } from '../site/js/presentation.js';
import { draftFromExercise, engineExercise, liveTitleRefusal, sameTitleExercises } from '../site/js/exercice.js';
import { data, lireFichier } from './aide.js';

const m10 = await lireFichier('exercices/m10-tournage-vc.json');
const contenu = () => draftFromExercise({ ...m10, cours: 'M10' }, data.outils); // une version publiée : 9 copies
const IMAGES = [{ id: 'mclnr', archivee_le: null }, { id: 'img-0123456789abcdef', archivee_le: null }, { id: 'img-archivee', archivee_le: '2026-09-27T10:00:00.000Z' }];
const outil = (p, id) => p.outils.find((e) => e.id === id);

test('la liste blanche (D75, D78) : titre, cours, « À l’accueil » ; photo et note de chaque copie', () => {
  assert.deepEqual(EXERCISE_PRESENTATION_FIELDS, ['titre', 'cours', 'liste']);
  assert.deepEqual(COPY_PRESENTATION_FIELDS, ['image', 'commentaire']);
});

test('exercisePresentationOf : la présentation d’un contenu — cours null sans cours, liste booléenne, une entrée par copie (photo, note ; null : aucune)', () => {
  const c = contenu();
  c.outils[1].commentaire = '';
  const p = exercisePresentationOf(c);
  assert.equal(p.titre, 'M10 — Tournage : vitesse de coupe');
  assert.equal(p.cours, 'M10');
  assert.equal(p.liste, true);
  assert.equal(p.outils.length, 9);
  assert.deepEqual(p.outils[0], { id: 'mclnr', image: 'mclnr', commentaire: c.outils[0].commentaire ?? null });
  assert.equal(p.outils[1].commentaire, null, 'une note vide est « pas de note »');
  assert.ok(p.outils.every((e) => Object.keys(e).join() === 'id,image,commentaire'), 'aucune valeur n’y entre');
  assert.deepEqual(exercisePresentationOf({ ...c, cours: undefined, liste: false }), { ...p, cours: null, liste: false, outils: exercisePresentationOf(c).outils });
});

test('currentExercisePresentation : rien d’appliqué → celle de la dernière version ; sinon l’appliquée, une copie nouvelle de la version gardant la sienne, une copie retirée de la version gardée', () => {
  const c = contenu();
  assert.deepEqual(currentExercisePresentation(null, c), exercisePresentationOf(c));
  assert.equal(currentExercisePresentation(null, null), null, 'jamais publié : aucune');
  const stored = { titre: 'Nouveau titre', cours: null, liste: false, outils: [{ id: 'mclnr', image: 'img-0123456789abcdef', commentaire: 'Note' }, { id: 'ancienne', image: null, commentaire: null }] };
  const p = currentExercisePresentation(stored, c);
  assert.equal(p.titre, 'Nouveau titre');
  assert.equal(p.cours, null);
  assert.equal(p.liste, false);
  assert.deepEqual(outil(p, 'mclnr'), { id: 'mclnr', image: 'img-0123456789abcdef', commentaire: 'Note' });
  assert.deepEqual(outil(p, 'mvlnr'), exercisePresentationOf(c).outils[1], 'une copie que l’appliquée ne connaît pas : celle de la version');
  assert.deepEqual(p.outils.map((e) => e.id), [...c.outils.map((copy) => copy.id), 'ancienne'], 'l’ordre de la dernière version, puis les copies qu’elle n’a plus');
  assert.deepEqual(knownCopies(p), new Set([...c.outils.map((copy) => copy.id), 'ancienne']));
});

test('applyExercisePresentation : titre, cours, liste, photo et note des copies connues ; une copie inconnue garde les siennes ; identique clé pour clé quand rien ne change', () => {
  const c = contenu();
  const avant = structuredClone(c);
  assert.deepEqual(applyExercisePresentation(c, exercisePresentationOf(c)), c, 'la présentation du contenu ne change rien');
  assert.deepEqual(Object.keys(applyExercisePresentation(c, exercisePresentationOf(c))), Object.keys(c));
  const p = { titre: 'Autre', cours: null, liste: false, outils: [{ id: 'mclnr', image: null, commentaire: 'Nouvelle note' }, { id: 'inconnue', image: 'x', commentaire: null }] };
  const out = applyExercisePresentation(c, p);
  assert.equal(out.titre, 'Autre');
  assert.equal('cours' in out, false, 'cours null : la clé disparaît (sans cours)');
  assert.equal(out.liste, false);
  assert.equal(out.outils[0].image, null);
  assert.equal(out.outils[0].commentaire, 'Nouvelle note');
  assert.deepEqual(out.outils[1], c.outils[1], 'mvlnr, que la présentation ne connaît pas : celle de sa version');
  assert.equal(out.outils.length, c.outils.length, 'aucune copie ajoutée');
  assert.deepEqual(exerciseValues(out), exerciseValues(c), 'les valeurs ne changent pas');
  assert.deepEqual(c, avant, 'le contenu reçu n’est pas modifié');
  const back = applyExercisePresentation(out, { ...p, liste: true, cours: 'M10' });
  assert.equal('liste' in back, false, 'À l’accueil : la clé disparaît, comme dans un brouillon');
  assert.equal(back.cours, 'M10');
  assert.equal(applyExercisePresentation(c, null), c, 'sans présentation : tel quel');
});

test('applyExercisePresentation sur l’exercice du moteur avec ses outils (GET /api/exercice) : les mêmes champs, rien d’autre', () => {
  const { exercise, tools } = engineExercise('m10-tournage-vc', 1, contenu());
  const shown = { ...exercise, outils: tools.map((tool) => ({ ...tool, reussites_requises: 1 })) };
  const p = currentExercisePresentation({ titre: 'Autre', cours: 'M20', liste: true, outils: [{ id: 'mvlnr', image: 'img-0123456789abcdef', commentaire: null }] }, contenu());
  const out = applyExercisePresentation(shown, p);
  assert.equal(out.titre, 'Autre');
  assert.equal(out.cours, 'M20');
  assert.equal(out.outils[1].image, 'img-0123456789abcdef');
  assert.equal(out.outils[1].commentaire, null);
  assert.deepEqual({ ...out, titre: shown.titre, cours: shown.cours, outils: shown.outils }, shown);
  assert.deepEqual(out.outils.map(({ image: _i, commentaire: _c, ...rest }) => rest), shown.outils.map(({ image: _i, commentaire: _c, ...rest }) => rest));
});

test('presentSessionView : le titre de la barre, la photo et la note de l’outil de la question ; la progression et la question restent celles de la version', () => {
  const view = {
    exercice: { id: 'm10', titre: 'Ancien', version: '1' },
    progression: { outils: [{ id: 'mclnr', nom: 'MCLNR', reussites: 0, requises: 1 }], outils_termines: 0, total_reussies: 0 },
    question: { identifiant: 'MCLNR 1/2', outil: { id: 'mclnr', nom: 'MCLNR', image: 'mclnr', commentaire: 'Ancienne note', dents: 1 }, champs: [{ champ: 'vc', evalue: true, texte: '' }] },
  };
  const avant = structuredClone(view);
  const p = { titre: 'Nouveau', cours: null, liste: true, outils: [{ id: 'mclnr', image: 'img-0123456789abcdef', commentaire: null }] };
  const out = presentSessionView(view, p);
  assert.equal(out.exercice.titre, 'Nouveau');
  assert.equal(out.question.outil.image, 'img-0123456789abcdef');
  assert.equal(out.question.outil.commentaire, null);
  assert.deepEqual({ ...out, exercice: view.exercice, question: { ...out.question, outil: view.question.outil } }, view, 'rien d’autre ne change');
  assert.deepEqual(view, avant, 'la vue reçue n’est pas modifiée');
  // Une photo null : celle nommée d'après la copie, comme questionView.
  assert.equal(presentSessionView(view, { ...p, outils: [{ id: 'mclnr', image: null, commentaire: 'Ancienne note' }] }).question.outil.image, 'mclnr');
  // Une copie que la présentation ne connaît pas, ou pas de question : seul le titre.
  assert.deepEqual(presentSessionView(view, { ...p, outils: [] }).question, view.question);
  assert.equal(presentSessionView({ ...view, question: null }, p).question, null);
  assert.equal(presentSessionView(view, null), view);
});

test('withLiveTitle : l’exercice avec le titre en vigueur, rien d’autre (ce que l’attestation émise inscrit)', () => {
  const exercise = { id: 'm10', titre: 'Ancien', version: '2', outils: [{ id: 'mclnr', reussites_requises: 1 }] };
  assert.deepEqual(withLiveTitle(exercise, { titre: 'Nouveau', cours: null, liste: true, outils: [] }), { ...exercise, titre: 'Nouveau' });
  assert.equal(withLiveTitle(exercise, null), exercise);
});

test('exerciseValues : le contenu sans titre, cours, liste, photos ni notes — ce que comparent la publication et le brouillon modifié', () => {
  const c = contenu();
  const v = exerciseValues(c);
  assert.equal('titre' in v, false);
  assert.equal('cours' in v, false);
  assert.ok(v.outils.every((copy) => !('image' in copy) && !('commentaire' in copy)));
  assert.deepEqual(v.outils[0].dimensions, c.outils[0].dimensions);
  assert.deepEqual(exerciseValues({ ...c, titre: 'Autre', liste: false, outils: c.outils.map((copy) => ({ ...copy, image: 'x', commentaire: 'y' })) }), v);
});

test('exercisePresentationErrors : liste blanche imposée, entrées complètes, titre, cours (D71), note, copies connues, doublons', () => {
  const c = contenu();
  const p = exercisePresentationOf(c);
  assert.deepEqual(exercisePresentationErrors(p), []);
  assert.deepEqual(exercisePresentationErrors(p, { images: IMAGES, inForce: p, copies: knownCopies(p) }), []);
  // Hors de la liste blanche : nommé, avec ce qu'il faut faire.
  const outside = exercisePresentationErrors({ ...p, champs_evalues: ['vc'] });
  assert.equal(outside.length, 1);
  assert.match(outside[0], new RegExp(`« champs_evalues » est ${OUTSIDE_WHITELIST}`));
  assert.match(outside[0], /brouillon de l'exercice, puis se publie/);
  const toolOutside = exercisePresentationErrors({ ...p, outils: [{ ...p.outils[0], fact_vc: 2 }, ...p.outils.slice(1)] });
  assert.deepEqual(toolOutside, [`outils[0] (mclnr) : « fact_vc » est ${OUTSIDE_WHITELIST} : il se modifie dans le brouillon de l'exercice, puis se publie`]);
  // Complète.
  assert.deepEqual(exercisePresentationErrors({ titre: 'A', cours: null, outils: [] }), ['« liste » manque']);
  assert.deepEqual(exercisePresentationErrors({ ...p, outils: [{ id: 'mclnr', image: null }] }), ['outils[0] (mclnr) : « commentaire » manque']);
  // Titre, cours, liste, note.
  assert.deepEqual(exercisePresentationErrors({ ...p, titre: '  ' }), ['Le titre est vide.']);
  assert.deepEqual(exercisePresentationErrors({ ...p, cours: '--' }), ['Le cours doit contenir au moins une lettre ou un chiffre.']);
  assert.deepEqual(exercisePresentationErrors({ ...p, cours: '' }), ['Le cours doit être un texte non vide (ou null : sans cours).']);
  assert.deepEqual(exercisePresentationErrors({ ...p, liste: 'oui' }), ["« liste » (À l'accueil) doit être true ou false."]);
  assert.match(exercisePresentationErrors({ ...p, outils: [{ id: 'mclnr', image: null, commentaire: '' }] })[0], /la note\) doit être un texte non vide, ou null/);
  // Une copie que la présentation en vigueur ne connaît pas : elle se publie d'abord.
  assert.match(exercisePresentationErrors({ ...p, outils: [{ id: 'nouvelle', image: null, commentaire: null }] }, { copies: knownCopies(p) })[0], /n'est dans aucune version publiée de l'exercice ; une copie nouvelle reçoit sa photo et sa note dans le brouillon/);
  assert.deepEqual(exercisePresentationErrors({ ...p, outils: [p.outils[0], p.outils[0]] }), ['outils : « mclnr » en double']);
  assert.deepEqual(exercisePresentationErrors([]), ['La présentation doit être un objet { titre, cours, liste, outils }.']);
});

test('exercisePresentationErrors : seule une photo CHOISIE doit exister et ne pas être archivée ; déjà en vigueur, archivée, elle n’est qu’un avertissement ; « permis » pour Rétablir', () => {
  const p = exercisePresentationOf(contenu());
  const withImage = (image) => ({ ...p, outils: p.outils.map((e) => (e.id === 'mclnr' ? { ...e, image } : e)) });
  assert.deepEqual(exercisePresentationErrors(withImage('img-inconnue'), { images: IMAGES, inForce: p }), ['outils[0] (mclnr) : « image » : l\'image « img-inconnue » est inconnue']);
  assert.deepEqual(exercisePresentationErrors(withImage('img-archivee'), { images: IMAGES, inForce: p }), ['outils[0] (mclnr) : « image » : l\'image « img-archivee » est archivée (choisis-en une autre, ou rétablis-la dans l\'onglet Images)']);
  assert.deepEqual(exercisePresentationErrors(withImage('img-archivee'), { images: IMAGES, inForce: withImage('img-archivee') }), [], 'déjà en vigueur : pas choisie');
  assert.deepEqual(exercisePresentationErrors(withImage('img-archivee'), { images: IMAGES, inForce: p, archived: 'permis' }), []);
  assert.deepEqual(exercisePresentationErrors(withImage('Pas Une Image'), { images: IMAGES, inForce: p }), ['outils[0] (mclnr) : « image » doit être l\'identifiant d\'une image (ou null)']);
  assert.deepEqual(exercisePresentationErrors(withImage(null), { images: IMAGES, inForce: p }), [], 'null : la photo nommée d’après la copie');
  const names = copyNames([contenu()]);
  assert.deepEqual(exerciseArchivedWarnings(withImage('img-archivee'), IMAGES, names), [`Outil « ${names.get('mclnr')} » (mclnr) — photo : l'image « img-archivee » est archivée ; elle reste affichée et ne bloque rien (pour la remplacer, choisis-en une autre, ou rétablis-la dans l'onglet Images).`]);
  assert.deepEqual(imagesOfExercisePresentation(withImage(null)), p.outils.slice(1).map((e) => e.image));
});

test('normalizeExercisePresentation : l’ordre de la liste blanche, les textes sans espaces autour, sans autre clé', () => {
  assert.deepEqual(normalizeExercisePresentation({ outils: [{ commentaire: '  Note ', image: null, id: 'a', x: 1 }], liste: false, cours: ' M10 ', titre: ' Titre ' }), { titre: 'Titre', cours: 'M10', liste: false, outils: [{ id: 'a', image: null, commentaire: 'Note' }] });
});

test('exercisePresentationDiff : une ligne par valeur, en clair, les outils nommés', () => {
  const c = contenu();
  const before = exercisePresentationOf(c);
  const after = { ...structuredClone(before), titre: 'Autre', cours: null, liste: false };
  after.outils[0] = { ...after.outils[0], image: 'img-0123456789abcdef', commentaire: 'Note' };
  const names = copyNames([c]);
  assert.deepEqual(exercisePresentationDiff(before, after, names), [
    'Titre : « M10 — Tournage : vitesse de coupe » → « Autre »',
    'Cours : « M10 » → —',
    "À l'accueil : oui → non",
    `Outil « ${names.get('mclnr')} » (mclnr) — photo : mclnr → img-0123456789abcdef`,
    `Outil « ${names.get('mclnr')} » (mclnr) — note : ${before.outils[0].commentaire === null ? '—' : `« ${before.outils[0].commentaire} »`} → « Note »`,
  ]);
  assert.deepEqual(exercisePresentationDiff(before, before, names), []);
});

test('pendingExercisePresentation : une valeur du brouillon que ni la présentation en vigueur ni aucune version n’a portée est une retouche en attente', () => {
  const v1 = contenu();
  const v2 = { ...structuredClone(v1), titre: 'Titre de la version 2' };
  const current = currentExercisePresentation({ ...exercisePresentationOf(v2), titre: 'Titre appliqué en direct' }, v2);
  // Le brouillon a les valeurs d'une version (v1 ou v2) : rien en attente.
  assert.deepEqual(pendingExercisePresentation([v1, v2], v1, current).lignes, []);
  assert.deepEqual(pendingExercisePresentation([v1, v2], v2, current).lignes, []);
  // Une retouche jamais publiée : le titre et la note d'une copie.
  const draft = structuredClone(v2);
  draft.titre = 'Retouche du brouillon';
  draft.outils[0].commentaire = 'Note retouchée';
  draft.outils.push({ ...structuredClone(v2.outils[1]), id: 'copie_nouvelle', commentaire: 'Nouvelle' }); // une copie nouvelle n'est pas « en attente » : elle se publie
  const pending = pendingExercisePresentation([v1, v2], draft, current, copyNames([v2]));
  assert.deepEqual(pending.lignes, ['Titre : « Titre appliqué en direct » → « Retouche du brouillon »', `Outil « ${v2.outils[0].nom} » (mclnr) — note : ${v2.outils[0].commentaire === null ? '—' : `« ${v2.outils[0].commentaire} »`} → « Note retouchée »`]);
  assert.equal(pending.contenu.titre, 'Retouche du brouillon');
  assert.equal(outil(pending.contenu, 'mclnr').commentaire, 'Note retouchée');
  assert.equal(outil(pending.contenu, 'copie_nouvelle'), undefined);
  assert.equal(current.titre, 'Titre appliqué en direct', 'la présentation reçue n’est pas modifiée');
  // Le brouillon a déjà la valeur en vigueur : rien.
  assert.deepEqual(pendingExercisePresentation([v1, v2], { ...v2, titre: 'Titre appliqué en direct' }, current).lignes, []);
});

test('liveTitleRefusal et sameTitleExercises : le titre en vigueur d’un autre exercice publié et non archivé, casse, accents et espaces ignorés', () => {
  const others = [{ id: 'a', titre: 'M10 — Tournage', archive_le: null }, { id: 'b', titre: 'Archivé', archive_le: '2026-01-01' }, { id: 'c', titre: null, archive_le: null }];
  const twins = sameTitleExercises('m10 —   TOURNAGE', others, 'moi');
  assert.deepEqual(twins, [{ id: 'a', titre: 'M10 — Tournage' }]);
  assert.equal(liveTitleRefusal(twins), 'Titre refusé : un autre exercice publié porte déjà ce titre : « M10 — Tournage » (a). Les étudiants reconnaissent un exercice à son titre : choisis-en un autre (ou change celui de l\'autre).');
  assert.deepEqual(sameTitleExercises('Archivé', others, 'moi'), []);
});
