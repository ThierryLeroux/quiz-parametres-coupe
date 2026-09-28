// DIAGNOSTIC TEMPORAIRE (D82, deuxième essai sur téléphone) : un encadré en haut de l'écran, montré seulement avec
// ?diag=1 dans l'adresse, qui suit en continu la zone visible, le défilement, la rangée de boutons et le dernier
// événement reçu. Sert à voir sur un vrai téléphone ce que Chrome fait à l'ouverture du clavier. À retirer avant la
// fusion : ce fichier et son import dans main.js.

import { el } from './dom.js';

export function startDiag(search) {
  if (!new URLSearchParams(search).has('diag')) return;
  const box = el('pre', { class: 'diag', 'aria-hidden': 'true' });
  document.body.append(box);
  let last = '—';
  const note = (name) => () => { last = `${name} ${new Date().toISOString().slice(14, 23)}`; };
  const viewport = window.visualViewport;
  viewport?.addEventListener('resize', note('vv:resize'));
  viewport?.addEventListener('scroll', note('vv:scroll'));
  window.addEventListener('scroll', note('win:scroll'), { passive: true });
  window.addEventListener('resize', note('win:resize'));
  for (const name of ['focusin', 'focusout', 'touchstart', 'touchmove', 'touchend']) window.addEventListener(name, note(name), { passive: true });

  function tick() {
    const bar = document.querySelector('.calc-bar');
    const rect = bar ? bar.getBoundingClientRect() : null;
    const active = document.activeElement;
    const activeRect = active && active.tagName === 'INPUT' ? active.getBoundingClientRect() : null;
    box.textContent = [
      `zone visible : h ${viewport ? Math.round(viewport.height) : '—'}  décalage ${viewport ? Math.round(viewport.offsetTop) : '—'}  (fenêtre ${window.innerHeight})`,
      `scrollY ${Math.round(window.scrollY)}`,
      `rangée : ${bar ? (bar.hidden ? 'cachée' : 'visible') : 'absente'}${rect ? `  haut ${Math.round(rect.top)}  bas ${Math.round(rect.bottom)}` : ''}${bar ? ` — ${bar.style.transform || 'sans transform'}` : ''}`,
      `case active : ${activeRect ? `${active.id}  haut ${Math.round(activeRect.top)}  bas ${Math.round(activeRect.bottom)}` : 'aucune'}`,
      `dernier événement : ${last}`,
    ].join('\n');
    requestAnimationFrame(tick);
  }
  tick();
}
