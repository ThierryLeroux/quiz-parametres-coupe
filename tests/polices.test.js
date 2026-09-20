// Polices auto-hébergées (UI §1) : chaque @font-face de tokens.css pointe vers un fichier présent
// dans site/fonts/, et la page ne demande rien à un domaine externe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const SITE = new URL('../site/', import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, SITE), 'utf8');

test('tokens.css : chaque police déclarée existe dans site/fonts/, en woff2, avec font-display: swap', () => {
  const declarations = lire('css/tokens.css').match(/@font-face\s*{[^}]*}/g);
  assert.equal(declarations.length, 9); // Plex Sans 400/500/600, Plex Mono 400/500, Carlito 400/700 droit et italique
  for (const declaration of declarations) {
    const [, url] = declaration.match(/url\('([^']+)'\)/);
    assert.match(url, /^\.\.\/fonts\/[a-z0-9-]+\.woff2$/, declaration);
    assert.ok(existsSync(new URL(url, new URL('css/', SITE))), `${url} est absent`);
    assert.match(declaration, /font-display: swap;/);
  }
});

test('site/fonts/ : seulement les woff2 déclarés et les licences OFL des trois familles', () => {
  const fichiers = readdirSync(new URL('fonts/', SITE));
  assert.equal(fichiers.filter((nom) => nom.endsWith('.woff2')).length, 9);
  assert.deepEqual(fichiers.filter((nom) => !nom.endsWith('.woff2')).sort(), ['LICENCE-Carlito.txt', 'LICENCE-IBM-Plex-Mono.txt', 'LICENCE-IBM-Plex-Sans.txt']);
  for (const licence of fichiers.filter((nom) => nom.endsWith('.txt'))) assert.match(lire(`fonts/${licence}`), /SIL Open Font License, Version 1\.1/);
});

test('aucune adresse externe dans la page ni dans les feuilles de style', () => {
  const fichiers = ['index.html', ...readdirSync(new URL('css/', SITE)).map((nom) => `css/${nom}`)];
  for (const fichier of fichiers) assert.doesNotMatch(lire(fichier), /https?:\/\/|url\(\s*['"]?\/\//, fichier);
});
