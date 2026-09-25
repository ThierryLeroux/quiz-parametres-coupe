// Tests de worker/svg.js (jalon 7b, décision D57) : un SVG téléversé est assaini par liste blanche,
// ou refusé s'il porte un script, un gestionnaire d'événement, un lien ou une ressource externe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { FORBIDDEN_ELEMENTS, SVG_ATTRIBUTES, SVG_ELEMENTS, SvgError, sanitizeSvg } from '../worker/svg.js';

const PICTOS = new URL('../site/img/pictos/operations/', import.meta.url);
const refuse = (svg, pattern) => assert.throws(() => sanitizeSvg(svg), (error) => error instanceof SvgError && pattern.test(error.message), `attendu : ${pattern}`);

test('les dix-neuf pictogrammes convertis du classeur passent tels quels : mêmes tracés, commentaire retiré, rien de retiré', () => {
  const files = readdirSync(PICTOS).filter((name) => name.endsWith('.svg'));
  assert.equal(files.length, 19);
  for (const name of files) {
    const source = readFileSync(new URL(name, PICTOS), 'utf8');
    const { svg, retires } = sanitizeSvg(source);
    assert.deepEqual(retires, [], name);
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'), name);
    assert.equal(svg.includes('<!--'), false, name);
    // Chaque tracé du fichier est dans le résultat, à l'identique.
    for (const [, d] of source.matchAll(/ d="([^"]+)"/g)) assert.ok(svg.includes(` d="${d}"`), `${name} : tracé absent`);
    assert.equal((svg.match(/<path/g) ?? []).length, (source.match(/<path/g) ?? []).length, name);
    // Idempotent : assainir le résultat ne change rien.
    assert.equal(sanitizeSvg(svg).svg, svg, name);
  }
});

test('un SVG piégé est refusé : script, gestionnaire d’événement, lien, image ou use externe, url() externe, DOCTYPE, foreignObject, entité inconnue', () => {
  const svg = (inner, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"${attrs}>${inner}</svg>`;
  refuse(svg('<script>alert(1)</script>'), /élément <script>/);
  refuse(svg('<g><SCRIPT>alert(1)</SCRIPT></g>'), /élément <SCRIPT>/);
  refuse(svg('<rect width="1" height="1" onclick="alert(1)"/>'), /gestionnaire d'événement « onclick » sur <rect>/);
  refuse(svg('<rect width="1" height="1"/>', ' onload="alert(1)"'), /gestionnaire d'événement « onload » sur <svg>/);
  refuse(svg('<a href="https://example.org"><rect width="1" height="1"/></a>'), /élément <a>/);
  refuse(svg('<image href="https://example.org/x.png"/>'), /élément <image>/);
  refuse(svg('<use href="https://example.org/x.svg#p"/>'), /« href » vers autre chose qu'un élément du fichier sur <use>/);
  refuse(svg('<use xlink:href="javascript:alert(1)"/>'), /« xlink:href » vers autre chose/);
  refuse(svg('<use href="&#106;avascript:alert(1)"/>'), /« href » vers autre chose/); // l'entité est décodée avant le contrôle
  refuse(svg('<rect width="1" height="1" fill="url(https://example.org/x.svg#g)"/>'), /url\(\) vers une ressource externe dans « fill » sur <rect>/);
  refuse(svg('<rect width="1" height="1" style="fill: url(\'//example.org/x\')"/>'), /url\(\) vers une ressource externe dans « style »/);
  refuse(svg('<style>@import url(https://example.org/x.css);</style>'), /@import dans <style>/);
  refuse(svg('<style>.a { background: url(https://example.org/x.png) }</style>'), /url\(\) vers une ressource externe dans <style>/);
  refuse(svg('<foreignObject><div>x</div></foreignObject>'), /élément <foreignObject>/);
  refuse(svg('<animate attributeName="href" to="https://example.org"/>'), /élément <animate>/);
  refuse(`<!DOCTYPE svg [<!ENTITY x "y">]>${svg('')}`, /DOCTYPE/);
  refuse(svg('<text>&nbsp;</text>'), /entité inconnue « &nbsp; »/);
  refuse(svg('<rect width="1" height="1"/><rect>'), /« <\/svg> » ne ferme pas « <rect> »/);
  refuse('<svg viewBox="0 0 1 1"><g>', /« <g> » n'est pas fermé/);
  refuse('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>', /sans viewBox ni largeur et hauteur/);
  refuse('<div>x</div>', /un seul élément racine <svg>/);
  refuse(`${svg('')}${svg('')}`, /un seul élément racine <svg>/);
  refuse('pas du xml', /un seul élément racine/);
  refuse(`<svg viewBox="0 0 1 1"><rect width="1" height="1" fill=red/></svg>`, /sans guillemets/);
  refuse(`<?xml version="1.0"?>${'<svg viewBox="0 0 1 1">'}${'<g>'.repeat(3)}${'</g>'.repeat(2)}</svg>`, /ne ferme pas « <g> »/);
  refuse(`<svg viewBox="0 0 1 1">${'a'.repeat(200_001)}</svg>`, /plus de 200 Ko/);
});

test('ce qui est seulement inconnu est retiré et dit : métadonnées d’Inkscape, attributs d’un autre espace de noms, déclaration XML, commentaires', () => {
  const source = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape -->
<svg xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10mm" height="10mm" viewBox="0 0 10 10" inkscape:version="1.3">
  <sodipodi:namedview id="nv" inkscape:zoom="2"/>
  <metadata id="m"><rdf:RDF xmlns:rdf="x"><rdf:li>y</rdf:li></rdf:RDF></metadata>
  <defs><linearGradient id="g"><stop offset="0" stop-color="#00B0F0"/><stop offset="1" stop-color="#FFC000"/></linearGradient></defs>
  <g inkscape:label="Calque 1" inkscape:groupmode="layer" data-name="x">
    <path d="M1 1L9 9" fill="url(#g)" style="stroke:#000;stroke-width:0.5" sodipodi:nodetypes="cc"/>
    <use href="#p"/>
    <text x="1" y="9" font-size="2">Ø &amp; &lt;pas&gt; &#233;</text>
  </g>
</svg>`;
  const { svg, retires } = sanitizeSvg(source);
  assert.deepEqual(retires, [
    'attribut xmlns:inkscape sur <svg>', 'attribut xmlns:sodipodi sur <svg>', 'attribut inkscape:version sur <svg>',
    'élément <sodipodi:namedview>', 'élément <metadata>',
    'attribut inkscape:label sur <g>', 'attribut inkscape:groupmode sur <g>', 'attribut data-name sur <g>',
    'attribut sodipodi:nodetypes sur <path>',
  ]);
  assert.equal(svg, '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10mm" height="10mm" viewBox="0 0 10 10">'
    + '<defs><linearGradient id="g"><stop offset="0" stop-color="#00B0F0"/><stop offset="1" stop-color="#FFC000"/></linearGradient></defs>'
    + '<g><path d="M1 1L9 9" fill="url(#g)" style="stroke:#000;stroke-width:0.5"/><use href="#p"/><text x="1" y="9" font-size="2">Ø &amp; &lt;pas&gt; é</text></g></svg>');
  // Sans xmlns, il est ajouté (sinon un <img> ne le dessine pas) ; un mauvais xmlns est remplacé ; CDATA relu comme du texte.
  assert.equal(sanitizeSvg('<svg viewBox="0 0 1 1"><style><![CDATA[.a { fill: url(#g) }]]></style></svg>').svg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><style>.a { fill: url(#g) }</style></svg>');
  assert.equal(sanitizeSvg('<svg xmlns="http://autre" viewBox="0 0 1 1"/>').svg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>');
  // Le BOM est ignoré ; les guillemets simples sont acceptés ; « > » dans une valeur est resérialisé sans casser.
  assert.equal(sanitizeSvg("﻿<svg viewBox='0 0 1 1'><title>a > b \"c\"</title></svg>").svg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><title>a &gt; b "c"</title></svg>');
});

test('les listes blanches ne se recoupent pas et couvrent l’essentiel', () => {
  for (const name of FORBIDDEN_ELEMENTS) assert.equal(SVG_ELEMENTS.has(name), false, name);
  for (const name of ['svg', 'g', 'path', 'rect', 'circle', 'text', 'defs', 'use', 'clipPath', 'linearGradient', 'stop']) assert.ok(SVG_ELEMENTS.has(name), name);
  for (const name of ['viewBox', 'd', 'fill', 'stroke', 'stroke-width', 'transform', 'style', 'href']) assert.ok(SVG_ATTRIBUTES.has(name), name);
  assert.equal([...SVG_ATTRIBUTES].some((name) => /^on/i.test(name)), false);
});
