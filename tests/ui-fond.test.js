// Le fond animé des pages des étudiants (D88) : seuls index.html et verifier.html le portent ; fond.css n'anime que
// transform et opacity, se fige quand l'appareil demande moins d'animations et disparaît à l'impression ; ses deux
// images sont dans site/img/fond/, identiques aux WebP de reference/fond/ ; ses réglages (voile, durées) viennent de
// tokens.css. Ce que le navigateur en fait (empilement, impression, mouvement réduit) se vérifie dans Chrome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, ROOT), 'utf8');
const sansCommentaires = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const AVEC_FOND = ['site/index.html', 'site/verifier.html'];
const SANS_FOND = ['site/prof.html', 'site/tables.html']; // /prof/editeur n'est plus une page (D95)
const COUCHE = '<div class="fond" aria-hidden="true">\n    <div class="fond-image"></div>\n    <div class="fond-lueur"></div>\n    <div class="fond-balayage"></div>\n  </div>';

// Le bloc { … } qui suit l'indice donné, accolades imbriquées comprises.
function bloc(css, debut) {
  const ouverture = css.indexOf('{', debut);
  let profondeur = 0;
  for (let i = ouverture; i < css.length; i += 1) {
    if (css[i] === '{') profondeur += 1;
    if (css[i] === '}') { profondeur -= 1; if (profondeur === 0) return css.slice(ouverture + 1, i); }
  }
  throw new Error('bloc non fermé');
}

test('index.html et verifier.html : la feuille fond.css et une seule couche .fond, trois enfants, avant l’en-tête ; rien de tel sur les trois autres pages', () => {
  for (const page of AVEC_FOND) {
    const html = lire(page).replaceAll('\r\n', '\n');
    assert.match(html, /<link rel="stylesheet" href="css\/fond\.css">/, page);
    assert.equal(html.split('class="fond"').length - 1, 1, page);
    assert.ok(html.includes(COUCHE), `${page} : la couche et ses trois enfants`);
    assert.ok(html.indexOf('class="fond"') < html.indexOf('<header'), `${page} : la couche vient avant l'en-tête`);
  }
  for (const page of SANS_FOND) {
    const html = lire(page);
    assert.doesNotMatch(html, /fond\.css/, page);
    assert.doesNotMatch(html, /class="fond/, page);
  }
});

test('fond.css : trois animations qui ne touchent que transform et opacity ; ni filter ni background-attachment ; les durées et le voile viennent de tokens.css', () => {
  const css = sansCommentaires(lire('site/css/fond.css'));
  const noms = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]).sort();
  assert.deepEqual(noms, ['fond-avance', 'fond-balaye', 'fond-respire']);
  for (const m of css.matchAll(/@keyframes\s+[\w-]+/g)) {
    const proprietes = [...bloc(css, m.index).matchAll(/([a-z-]+)\s*:/g)].map((p) => p[1]);
    assert.ok(proprietes.length > 0);
    for (const propriete of proprietes) assert.ok(['transform', 'opacity'].includes(propriete), `${m[0]} anime ${propriete}`);
  }
  assert.doesNotMatch(css, /\bfilter\s*:/);
  assert.doesNotMatch(css, /background-attachment/);
  assert.match(css, /\.fond-image \{[^}]*animation: fond-avance var\(--fond-duree-avance\) ease-in-out infinite alternate;/);
  assert.match(css, /\.fond-lueur \{[^}]*animation: fond-respire var\(--fond-duree-lueur\) ease-in-out infinite;/);
  assert.match(css, /\.fond-balayage \{[^}]*animation: fond-balaye var\(--fond-duree-balayage\) linear infinite;/);
  assert.match(css, /rgba\(5, 9, 26, var\(--fond-voile\)\)/);
  const tokens = sansCommentaires(lire('site/css/tokens.css'));
  for (const ligne of ['--fond-voile: 0.55;', '--fond-duree-avance: 60s;', '--fond-duree-lueur: 9s;', '--fond-duree-balayage: 16s;']) assert.ok(tokens.includes(ligne), ligne);
});

test('fond.css : la couche fixée derrière tout ; l’image du téléphone pour un écran en hauteur ; image fixe en mouvement réduit ; rien à l’impression', () => {
  const css = sansCommentaires(lire('site/css/fond.css'));
  const fond = bloc(css, css.indexOf('.fond {'));
  assert.match(fond, /position: fixed;/);
  assert.match(fond, /inset: 0;/);
  assert.match(fond, /z-index: -1;/);
  assert.match(fond, /pointer-events: none;/);
  assert.match(css, /\.fond-image \{[^}]*url\('\.\.\/img\/fond\/fond-ordinateur\.webp'\)/);
  const telephone = bloc(css, css.indexOf('@media (max-aspect-ratio: 4/5)'));
  assert.match(telephone, /\.fond-image \{[^}]*background-image: url\('\.\.\/img\/fond\/fond-telephone\.webp'\);/);
  const reduit = bloc(css, css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduit, /\.fond-image,\s*\.fond-lueur,\s*\.fond-balayage \{ animation: none; \}/);
  const impression = bloc(css, css.indexOf('@media print'));
  assert.match(impression, /\.fond \{ display: none; \}/);
  // L'écran de l'attestation : la page lettre flotte sur le fond, sans le gris de la scène.
  assert.match(css, /\.attestation-stage \{ background: none; \}/);
});

test('site/img/fond/ : les deux WebP, et rien d’autre, identiques aux fichiers de reference/fond/', () => {
  const fichiers = readdirSync(new URL('site/img/fond/', ROOT)).sort();
  assert.deepEqual(fichiers, ['fond-ordinateur.webp', 'fond-telephone.webp']);
  for (const nom of fichiers) {
    const octets = readFileSync(new URL(`site/img/fond/${nom}`, ROOT));
    assert.equal(octets.toString('ascii', 0, 4), 'RIFF', nom);
    assert.equal(octets.toString('ascii', 8, 12), 'WEBP', nom);
    assert.equal(Buffer.compare(octets, readFileSync(new URL(`reference/fond/${nom}`, ROOT))), 0, `${nom} diffère de reference/fond/`);
  }
});
