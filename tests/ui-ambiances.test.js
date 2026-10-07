// Les ambiances de couleur par espace (décision D94) : bleu pour l'étudiant, ambre pour la consultation, pourpre pour
// l'administration. Une seule source — les variables de tokens.css, redéfinies sous :root[data-espace="…"] —, l'attribut
// data-espace posé en dur sur chaque page et changé par /prof selon le rôle, la bande à chevrons et l'étiquette de
// l'espace dans app.css, les contrastes AA calculés ici, et les couleurs de sens qui ne bougent pas. Ce que le
// navigateur en fait (la bande, l'étiquette, les boutons) se vérifie dans Chrome (rapport textes-et-ambiances).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spaceOf } from '../site/js/ui/prof-data.js';

const ROOT = new URL('../', import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, ROOT), 'utf8');
const sansCommentaires = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// Le bloc { … } d'un sélecteur, sans les accolades.
function bloc(css, selecteur) {
  const debut = css.indexOf(selecteur);
  assert.notEqual(debut, -1, selecteur);
  const ouverture = css.indexOf('{', debut);
  return css.slice(ouverture + 1, css.indexOf('}', ouverture));
}

// Les déclarations « --nom: valeur; » d'un bloc.
const declarations = (texte) => Object.fromEntries([...texte.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const ESPACES = {
  etudiant: { accent: '#2e9bff', light: '#4fc3f7', hover: '#8fd8ff' },
  consultation: { accent: '#f5a623', light: '#ffbd5c', hover: '#ffd38a' },
  admin: { accent: '#b07cff', light: '#c9a3ff', hover: '#dcc2ff' },
};
const FOND = '#05091a';
const PANNEAU = '#0b1430';

// Le rapport de contraste WCAG de deux couleurs « #rrggbb ».
function contraste(a, b) {
  const luminance = (hex) => {
    const canal = (i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
  };
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

test('les cinq pages portent data-espace sur <html> : « etudiant » partout, sauf la Gestion du contenu, « admin » en dur', () => {
  for (const page of ['site/index.html', 'site/verifier.html', 'site/tables.html', 'site/prof.html']) assert.match(lire(page), /<html lang="fr" data-espace="etudiant">/, page);
  assert.match(lire('site/prof/editeur.html'), /<html lang="fr" data-espace="admin">/);
});

test('tokens.css : l’espace étudiant garde le bleu ; la consultation et l’administration ne redéfinissent que l’accent, sa variante claire et le survol des liens', () => {
  const css = sansCommentaires(lire('site/css/tokens.css'));
  const racine = declarations(bloc(css, ':root {'));
  assert.deepEqual([racine['--color-accent'], racine['--color-accent-light'], racine['--color-link-hover']], [ESPACES.etudiant.accent, ESPACES.etudiant.light, ESPACES.etudiant.hover]);
  for (const espace of ['consultation', 'admin']) {
    const propres = declarations(bloc(css, `:root[data-espace="${espace}"]`));
    assert.deepEqual(Object.keys(propres), ['--color-accent', '--color-accent-light', '--color-link-hover'], espace);
    // Les valeurs sont nommées une fois, dans :root (« --espace-<espace>-… »), et reprises par var().
    assert.deepEqual(Object.values(propres), [`var(--espace-${espace}-accent)`, `var(--espace-${espace}-accent-light)`, `var(--espace-${espace}-link-hover)`], espace);
    assert.deepEqual([racine[`--espace-${espace}-accent`], racine[`--espace-${espace}-accent-light`], racine[`--espace-${espace}-link-hover`]], [ESPACES[espace].accent, ESPACES[espace].light, ESPACES[espace].hover], espace);
  }
  assert.equal(css.split('data-espace=').length - 1, 2); // deux blocs, pas plus
});

test('les couleurs de sens ne changent dans aucun espace : juste, faux, doré, en direct, classes ISO et matières d’outil restent celles de :root', () => {
  const css = sansCommentaires(lire('site/css/tokens.css'));
  const racine = declarations(bloc(css, ':root {'));
  assert.deepEqual([racine['--color-correct'], racine['--color-wrong'], racine['--color-gold']], ['#35d07f', '#ff4d5a', '#ffc000']);
  for (const espace of ['consultation', 'admin']) {
    const propres = bloc(css, `:root[data-espace="${espace}"]`);
    assert.doesNotMatch(propres, /--color-(correct|wrong|gold)|--iso-|--tool-/, espace);
  }
});

test('contrastes AA (≥ 4,5) dans les trois espaces : l’accent et sa variante claire sur le fond et sur un panneau ; le texte nuit sur un bouton plein', () => {
  for (const [espace, { accent, light }] of Object.entries(ESPACES)) {
    for (const fond of [FOND, PANNEAU]) {
      assert.ok(contraste(accent, fond) >= 4.5, `${espace} : accent ${accent} sur ${fond} = ${contraste(accent, fond).toFixed(2)}`);
      assert.ok(contraste(light, fond) >= 4.5, `${espace} : clair ${light} sur ${fond} = ${contraste(light, fond).toFixed(2)}`);
    }
    assert.ok(contraste(FOND, accent) >= 4.5, `${espace} : texte nuit sur le bouton ${accent} = ${contraste(FOND, accent).toFixed(2)}`); // .button : color: var(--color-bg)
  }
  // Le calcul est le bon : blanc sur noir fait 21, blanc sur blanc 1.
  assert.equal(Math.round(contraste('#ffffff', '#000000')), 21);
  assert.equal(contraste('#ffffff', '#ffffff'), 1);
});

test('app.css : l’étiquette de l’espace et la bande à chevrons de l’administration ne nomment que des variables ; la bande disparaît à l’impression', () => {
  const css = sansCommentaires(lire('site/css/app.css'));
  const etiquette = bloc(css, '.espace-etiquette {');
  assert.match(etiquette, /border: 1px solid var\(--color-accent\);/);
  assert.match(etiquette, /color: var\(--color-accent-light\);/);
  assert.match(etiquette, /text-transform: uppercase;/);
  const bande = bloc(css, ':root[data-espace="admin"] body::before {');
  assert.match(bande, /height: 6px;/);
  assert.match(bande, /repeating-linear-gradient\(135deg, var\(--color-accent\) 0 10px, var\(--color-bg-header\) 10px 20px\)/);
  const impression = css.slice(css.indexOf('@media print {\n  :root[data-espace="admin"] body::before'));
  assert.match(impression, /^@media print \{\n  :root\[data-espace="admin"\] body::before \{ display: none; \}/);
});

test('aucune couleur d’espace en dur hors de tokens.css : les feuilles de style et les écrans ne connaissent que les variables', () => {
  const couleurs = Object.values(ESPACES).flatMap((e) => [e.accent, e.light, e.hover]).filter((c) => !Object.values(ESPACES.etudiant).includes(c));
  const fichiers = [
    ...readdirSync(new URL('site/css/', ROOT)).filter((f) => f.endsWith('.css') && f !== 'tokens.css').map((f) => `site/css/${f}`),
    ...readdirSync(new URL('site/js/ui/', ROOT)).filter((f) => f.endsWith('.js')).map((f) => `site/js/ui/${f}`),
  ];
  for (const fichier of fichiers) {
    const source = lire(fichier).toLowerCase();
    for (const couleur of couleurs) assert.ok(!source.includes(couleur), `${fichier} nomme ${couleur}`);
  }
});

test('prof.js pose data-espace d’après le rôle (spaceOf) à la connexion, à la déconnexion et sur le tableau, et met l’étiquette dans la barre ; editeur.js met « Administration »', () => {
  assert.deepEqual([spaceOf('admin'), spaceOf('consultation'), spaceOf(null)], ['admin', 'consultation', 'etudiant']);
  const prof = lire('site/js/ui/prof.js').replace(/\/\/[^\n]*/g, '');
  assert.match(prof, /const applySpace = \(\) => \{ document\.documentElement\.dataset\.espace = spaceOf\(state\.role\); \};/);
  const connexion = prof.slice(prof.indexOf('function showLogin'), prof.indexOf('async function submit', prof.indexOf('function showLogin')));
  assert.match(connexion, /state\.role = null;\s*applySpace\(\);/); // la connexion : l'espace étudiant, quel que soit l'état d'avant
  const barre = prof.slice(prof.indexOf('function headerAside'), prof.indexOf('async function logout'));
  assert.match(barre, /applySpace\(\);/);
  assert.match(barre, /el\('span', \{ class: 'espace-etiquette' \}, roleLabel\(state\.role\)\)/);
  assert.doesNotMatch(prof, /roleLabel\(state\.role\)\}`/); // plus de rôle dans le sur-titre : l'étiquette le dit
  assert.equal((prof.match(/Espace professeur\$\{roleNote\(state\.role\)\}/g) ?? []).length, 2); // le tableau et la page d'effacement
  const editeur = lire('site/js/ui/editeur.js').replace(/\/\/[^\n]*/g, '');
  assert.match(editeur, /const spaceBadge = \(\) => el\('span', \{ class: 'espace-etiquette' \}, 'Administration'\);/);
  assert.equal((editeur.match(/spaceBadge\(\)/g) ?? []).length, 2); // la connexion et la barre des écrans
  assert.doesNotMatch(editeur, /el\('span', \{\}, 'admin'\)/);
});
