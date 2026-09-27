// Tests de site/js/ui/home-data.js (D71) : l'accueil unique, regroupé par cours, et la page de description d'un
// exercice — composée, comme dans le navigateur, à partir de ce que le serveur publie (GET /api/exercice).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleExercise } from '../site/js/app.js';
import { exerciseLink, homeGroups, materialGroups, questionLines, streakText, toolRows } from '../site/js/ui/home-data.js';
import { listedExerciseMeta } from '../site/js/ui/text.js';
import { serveurDeTest } from './aide-serveur.js';

const serveur = serveurDeTest();
const publie = async (id) => assembleExercise((await serveur.appel('GET', `/api/exercice?exercice=${id}`)).corps);
const m10 = await publie('m10-tournage-vc');
const vcRpm = await publie('m10-tournage-vc-rpm');

// --- Accueil ---------------------------------------------------------------------------------------------------------

test('homeGroups (D71) : un groupe par cours, dans l’ordre des rangs, un même cours écrit autrement dans le même groupe ; sans cours, « Autres exercices » en dernier', () => {
  const liste = [
    { id: 'a', titre: 'A', cours: 'M10' },
    { id: 'b', titre: 'B', cours: null },
    { id: 'c', titre: 'C', cours: 'm-10' },
    { id: 'd', titre: 'D', cours: 'M20' },
    { id: 'e', titre: 'E' }, // réponse d'un serveur d'avant : pas de cours
  ];
  assert.deepEqual(homeGroups(liste).map((g) => [g.title, g.exercises.map((e) => e.id)]), [['M10', ['a', 'c']], ['M20', ['d']], ['Autres exercices', ['b', 'e']]]);
  // L'écriture du groupe est celle du premier exercice du groupe dans l'ordre des rangs.
  assert.equal(homeGroups([{ id: 'c', cours: ' m10 ' }, { id: 'a', cours: 'M10' }])[0].title, 'm10');
  // Aucun cours : un seul groupe, sans titre (l'accueil d'avant) ; aucune entrée : aucun groupe.
  assert.deepEqual(homeGroups([{ id: 'a', cours: null }, { id: 'b', cours: null }]), [{ title: null, exercises: [{ id: 'a', cours: null }, { id: 'b', cours: null }] }]);
  assert.deepEqual(homeGroups([]), []);
});

test('listedExerciseMeta et exerciseLink (D71) : la ligne sous un exercice de l’accueil ; le lien de sa page', () => {
  assert.equal(listedExerciseMeta({ nombre_outils: 9, champs_evalues: ['vc'] }), '9 outils · champ évalué : vitesse de coupe');
  assert.equal(listedExerciseMeta({ nombre_outils: 1, champs_evalues: ['vc', 'n'] }), '1 outil · champs évalués : vitesse de coupe, vitesse de rotation');
  assert.equal(exerciseLink('https://quiz.tgm-tmi.workers.dev', 'm10-tournage-vc'), 'https://quiz.tgm-tmi.workers.dev/?exercice=m10-tournage-vc');
  assert.equal(exerciseLink('http://localhost:8787', 'a b'), 'http://localhost:8787/?exercice=a%20b');
});

// --- Page de description ---------------------------------------------------------------------------------------------

test('questionLines (D71) : les grandeurs à trouver, fournies et non demandées, en toutes lettres avec leur symbole', () => {
  assert.deepEqual(questionLines(m10.exercise), [
    'À trouver : vitesse de coupe (Vc).',
    "Fournies par l'exercice : avance par dent (fz), vitesse de rotation (N), avance totale par révolution (f) et vitesse d'avance (Vf).",
  ]);
  assert.deepEqual(questionLines(vcRpm.exercise), [
    'À trouver : vitesse de coupe (Vc) et vitesse de rotation (N).',
    "Fournies par l'exercice : avance par dent (fz), avance totale par révolution (f) et vitesse d'avance (Vf).",
  ]);
  assert.deepEqual(questionLines({ champs_evalues: ['fz', 'f'], champs_masques: ['vf'] }), [
    'À trouver : avance par dent (fz) et avance totale par révolution (f).',
    "Fournies par l'exercice : vitesse de coupe (Vc) et vitesse de rotation (N).",
    "Non demandée : vitesse d'avance (Vf).",
  ]);
  assert.deepEqual(questionLines({ champs_evalues: ['vc', 'fz', 'n', 'f', 'vf'] }), ["À trouver : vitesse de coupe (Vc), avance par dent (fz), vitesse de rotation (N), avance totale par révolution (f) et vitesse d'avance (Vf)."]);
});

test('toolRows (D71) : les outils questionnés dans l’ordre, avec leur photo, leur plage, leur opération et son pictogramme, leurs matières et les réussites de suite', () => {
  const rows = toolRows(m10.exercise, m10.data);
  assert.deepEqual(rows.map((r) => r.id), m10.exercise.outils.map((e) => e.id));
  assert.deepEqual(rows.map((r) => r.label), ['MCLNR', 'MVLNR', 'Lame à tronçonner', 'Barre à fileter (impérial)', 'Barre à fileter (métrique)', 'Barre à rainurer', 'Barre à aléser', 'SDTMR (impérial)', 'SDTMR (métrique)']);
  assert.deepEqual(rows.map((r) => r.streak), [1, 3, 3, 1, 1, 3, 1, 1, 1]);
  const mclnr = rows[0];
  assert.deepEqual([mclnr.photo, mclnr.operation, mclnr.picto, mclnr.range], ['/images/mclnr', 'Chariotage ébauche', '/images/chariotage_ebauche', '10 mm à 20 mm']);
  assert.deepEqual(mclnr.materials, m10.data.outils.find((t) => t.id === 'mclnr').materiaux_outil);
  // « Vc et RPM » écarte le carbure solide pour tout l'exercice (D40) : aucun outil ne l'affiche.
  const rpm = toolRows(vcRpm.exercise, vcRpm.data);
  assert.equal(rpm.length, 11);
  assert.ok(rpm.every((r) => r.materials.length > 0 && !r.materials.includes('Carbure de tungstène solide')), JSON.stringify(rpm.map((r) => r.materials)));
  assert.ok(rpm.every((r) => r.streak === 2));
  assert.deepEqual([streakText(1), streakText(3)], ['1 réussite de suite', '3 réussites de suite']);
  // Une entrée de fichier d'exercice qui restreint ses dimensions : la plage le suit.
  const restreint = { outils: [{ id: 'mvlnr', reussites_requises: 1, dimensions: ['2.000"'] }], champs_evalues: ['vc'] };
  assert.equal(toolRows(restreint, m10.data)[0].range, '2.000"');
});

test('materialGroups (D71) : les groupes que les outils peuvent tirer, par classe ISO, dans l’ordre des tables ; la restriction de l’exercice s’y applique', () => {
  const classes = materialGroups(m10.exercise, m10.data);
  assert.equal(classes[0].code, 'P');
  assert.equal(classes[0].name, 'Acier');
  assert.equal(new Set(classes.map((c) => c.code)).size, classes.length); // une ligne par classe
  // Chaque groupe tiré par au moins un outil y est, une fois ; aucun autre.
  const attendus = new Set(m10.data.outils.flatMap((t) => t.groupes_materiaux_usinables).map((g) => g.split(' - ')[1]));
  assert.deepEqual(new Set(classes.flatMap((c) => c.groups)), attendus);
  assert.ok(!classes.flatMap((c) => c.groups).includes('Graphite')); // attaché à aucun outil (SPEC §3)
  // Restreint à un groupe pour tout l'exercice : il ne reste que lui.
  assert.deepEqual(materialGroups({ ...m10.exercise, groupes: ['P - Acier non allié'] }, m10.data), [{ code: 'P', name: 'Acier', groups: ['Acier non allié'] }]);
});

test('page de description (D71) : rien de ce qui est à trouver — aucune vitesse de coupe, aucune avance de la table', () => {
  const texte = JSON.stringify({ questions: questionLines(vcRpm.exercise), outils: toolRows(vcRpm.exercise, vcRpm.data), materiaux: materialGroups(vcRpm.exercise, vcRpm.data) });
  assert.doesNotMatch(texte, /vc_pi_min|avance_po_rev|pi\/min/);
  // Les seuls nombres des rangs d'outils sont les réussites de suite (les plages sont des libellés de dimension).
  for (const row of toolRows(vcRpm.exercise, vcRpm.data)) assert.deepEqual(Object.entries(row).filter(([, v]) => typeof v === 'number').map(([k]) => k), ['streak']);
});
