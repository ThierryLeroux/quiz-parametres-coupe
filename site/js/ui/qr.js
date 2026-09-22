// Le QR de l'attestation (décision D33), avec la bibliothèque vendorisée (site/vendor/, D3).
// Correction d'erreur M : un QR imprimé puis photographié se lit encore avec une tache.
//
//   qrModules(text) : PURE, testée sous Node — la grille de modules et le tracé SVG
//   qrSvg(text)     : l'élément <svg>, construit par le DOM (jamais innerHTML)

import qrcode from '../../vendor/qrcode-generator-2.0.4.mjs';

const QUIET_ZONE = 4; // marge blanche de 4 modules tout autour, comme la norme le demande

// Retourne { count, size, path } : le nombre de modules par côté, la taille avec la marge, et un
// tracé SVG (un carré par module sombre) dans un repère où un module vaut 1.
export function qrModules(text) {
  const qr = qrcode(0, 'M'); // 0 : la version (taille) est choisie selon la longueur du texte
  qr.addData(text, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  const squares = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) squares.push(`M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`);
    }
  }
  return { count, size: count + 2 * QUIET_ZONE, path: squares.join('') };
}

// L'élément SVG du QR, carré, de `pixels` de côté.
export function qrSvg(text, pixels, label = 'Code QR de vérification') {
  const { size, path } = qrModules(text);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', pixels);
  svg.setAttribute('height', pixels);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.setAttribute('shape-rendering', 'crispEdges');
  const background = document.createElementNS(NS, 'rect');
  background.setAttribute('width', size);
  background.setAttribute('height', size);
  background.setAttribute('fill', '#fff');
  const modules = document.createElementNS(NS, 'path');
  modules.setAttribute('d', path);
  modules.setAttribute('fill', '#000');
  svg.append(background, modules);
  return svg;
}
