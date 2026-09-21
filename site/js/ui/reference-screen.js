// Tables de référence (UI §3.5) : vitesses de coupe, avances, formules — la même page lettre qu'à
// l'impression. Elles s'ouvrent PAR-DESSUS l'écran Question, dans leur propre cadre qui défile :
// la saisie en cours n'est pas perdue, et la page en dessous ne bouge pas.
// Le contenu vient du catalogue, composé par sheets-data.js (pur, testé) ; ici, la mise en page.

import { el } from './dom.js';
import { feedSheet, vcSheet } from './sheets-data.js';

const TABS = [
  { id: 'vc', label: 'Vitesses de coupe' },
  { id: 'avances', label: 'Avances' },
  { id: 'formules', label: 'Formules' },
];

function picto(name) {
  const url = `url(img/pictos/grandeurs/${name}.svg)`;
  return el('span', { class: 'picto picto--sheet', 'aria-hidden': 'true', style: `-webkit-mask-image: ${url}; mask-image: ${url};` });
}

// La page lettre : en-tête (logo, titre, bloc TGM), contenu, pied (date, révision, page).
function page(content) {
  return el('article', { class: 'print-page sheet' }, [
    el('header', { class: 'sheet-header' }, [
      el('img', { class: 'sheet-logo', src: 'img/logo-cvm.png', alt: 'Cégep du Vieux Montréal' }),
      el('div', { class: 'sheet-title' }, [el('div', {}, 'Paramètres de coupe'), el('small', {}, 'valeurs de départ')]),
      el('div', { class: 'sheet-program' }, [el('div', {}, 'Techniques de génie mécanique'), el('div', {}, 'Technique du génie de la maintenance industrielle'), el('div', {}, '(fiabilité des systèmes de production)')]),
    ]),
    el('div', { class: 'sheet-body' }, content),
    el('footer', { class: 'sheet-footer' }, [el('span', {}, new Date().toISOString().slice(0, 10)), el('span', {}, 'TGM — profil fabrication'), el('span', {}, 'Page 1 de 1')]),
  ]);
}

// --- Vitesses de coupe : toutes les classes, toutes les lignes, aucune surlignée ------------------------------
function vcPage(data) {
  const { columns, rows } = vcSheet(data);
  // Une ligne par matériau, sans repli : un libellé long est écrit plus petit (UI §3.5).
  const cell = (text, className = '') => {
    const shown = text === null || text === undefined ? '' : String(text);
    return el('td', { class: `${className}${shown.length > 28 ? ' tight' : ''}`.trim() || null }, shown);
  };
  return page([
    el('div', { class: 'sheet-caption' }, [el('strong', {}, 'Classification des matériaux par usinabilité (ISO 513 et VDI 3323)'), el('span', {}, ['Vitesse de coupe', el('br'), 'Vc (pieds/minute)'])]),
    el('table', { class: 'vc-table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, 'Classe'), el('th', {}, ['No de', el('br'), 'groupe']), el('th', { class: 'left' }, 'Matériau usiné'), el('th', { class: 'left' }, 'Composition'),
        el('th', { class: 'left' }, 'État métallurgique'), el('th', {}, ['Dureté', el('br'), 'Brinell (HB)']), el('th', {}, ['Ex. de matériau', el('br'), 'AISI/SAE/ASTM']),
        ...columns.map(({ label, key }) => el('th', { class: 'vc-tool', style: `background: var(--tool-${key.replaceAll('_', '-')})` }, label)),
      ])),
      el('tbody', {}, rows.map((row) => {
        const iso = row.iso.toLowerCase();
        return el('tr', { style: `background: var(--iso-${iso}-tint)` }, [
          el('td', { class: 'vc-class', style: `background: var(--iso-${iso}); color: var(--iso-${iso}-text)` }, row.iso),
          el('td', { class: 'vc-class', style: `background: var(--iso-${iso}); color: var(--iso-${iso}-text)` }, String(row.groupe)),
          cell(row.materiau, 'left'), cell(row.composition, 'left'), cell(row.etat, 'left'), cell(row.durete), cell(row.exemple),
          ...columns.map(({ key }) => cell(row.vc_pi_min[key], 'vc-value')),
        ]);
      })),
    ]),
  ]);
}

// --- Avances : une grille, un rang par opération ; machines, directions et encadrés sur plusieurs rangs ----------
function feedPage(data) {
  const { rows, machines, directions, boxes } = feedSheet(data);
  const at = (start, span) => `grid-row: ${start + 2} / span ${span}`; // le rang 1 est l'en-tête
  const lastOfMachine = new Set(machines.map((run) => run.start + run.span - 1));
  return page([
    el('div', { class: 'feed-grid' }, [
      el('div', { class: 'feed-head', style: 'grid-column: 1 / span 2' }, 'Machine-outil'),
      el('div', { class: 'feed-head', style: 'grid-column: 3 / span 2' }, 'Opération'),
      el('div', { class: 'feed-head', style: 'grid-column: 5' }, 'Avance / rév.'),
      el('div', { class: 'feed-head feed-head--note', style: 'grid-column: 6' }, "Avance proportionnelle au Ø de l'outil"),
      ...machines.map((run) => el('div', { class: 'feed-machine', style: `grid-column: 1; ${at(run.start, run.span)}` }, run.key.split(' / ').flatMap((part, i) => (i === 0 ? [part] : [el('br'), part])))),
      ...directions.map((run) => el('div', { class: 'feed-direction', style: `grid-column: 2; ${at(run.start, run.span)}` }, el('span', {}, run.key))),
      ...rows.flatMap((row, i) => {
        const end = lastOfMachine.has(i) ? ' feed-cell--end' : '';
        const image = el('img', { src: row.picto, alt: '', onerror: () => image.remove() });
        return [
          el('div', { class: `feed-cell feed-operation${end}`, style: `grid-column: 3; ${at(i, 1)}` }, row.operation),
          el('div', { class: `feed-cell feed-picto${end}`, style: `grid-column: 4; ${at(i, 1)}` }, image),
          el('div', { class: `feed-cell feed-value${end}`, style: `grid-column: 5; ${at(i, 1)}` }, row.bar === null
            ? el('strong', { class: 'feed-thread' }, row.label)
            : el('div', { class: 'feed-bar', style: `--bar: ${Math.round(row.bar * 100)}%` }, el('strong', {}, row.label))),
        ];
      }),
      ...boxes.map((box) => el('div', { class: 'feed-box', style: `grid-column: 6; ${at(box.start, box.span)}` }, el('div', {}, box.lines.map((line) => el('p', { class: [line.strong ? 'strong' : '', line.italic ? 'italic' : ''].join(' ').trim() || null }, line.text))))),
    ]),
  ]);
}

// --- Formules : deux parties, du relevé dans les tables jusqu'à Vf ---------------------------------------------------
function formulaRow(pictoName, name, unit, formula, note) {
  return el('div', { class: 'formula-row' }, [
    picto(pictoName),
    el('div', { class: 'formula-name' }, [el('strong', {}, name), el('div', {}, unit)]),
    el('div', { class: 'formula-math' }, [formula].flat().map((line) => el('div', {}, line))),
    el('div', { class: 'formula-note' }, note),
  ]);
}

// Miniature schématique d'une feuille : où se fait le relevé (UI §3.5).
const miniature = (name, alt) => el('img', { class: 'formula-miniature', src: `img/pictos/miniatures/${name}.svg`, alt });

function formulasPage() {
  const b = (text) => el('strong', {}, text);
  return page([
    el('div', { class: 'sheet-caption' }, [el('strong', {}, 'Formules et unités'), el('span', {}, 'Unités impériales')]),
    el('div', { class: 'formula-part formula-part--rotation' }, [el('strong', {}, '1re partie — Vitesse de rotation (rév/min)'), el('span', {}, 'Vc → N')]),
    formulaRow('vc', 'Vitesse de coupe', 'Vc (pi/min)', miniature('table-vc', 'Schéma de la table des vitesses de coupe : une ligne, une colonne'), ['Relevée dans la ', b('table des vitesses de coupe'), ' : le matériau brut donne la ligne, le matériau de l’outil donne la colonne.']),
    formulaRow('n', 'Vitesse de rotation', 'N (rév/min)', 'N = Vc × 4 / Ø', ['Ø en pouces : Ø de l’outil en fraisage et perçage, Ø usiné en tournage. ', b('Plafonnée à la vitesse maximale de la machine.'), ' Certains outils imposent une réduction (alésoir, lame à tronçonner).']),
    el('div', { class: 'formula-part formula-part--feed' }, [el('strong', {}, '2e partie — Vitesse d’avance (po/min)'), el('span', {}, 'fz → f → Vf')]),
    formulaRow('fz', 'Avance par dent', 'fz (po/dent)', miniature('table-avances', 'Schéma de la table des avances : le rang de l’opération'), ['Relevée dans la ', b('table des avances'), ', à l’opération de l’outil. Fixe : la valeur de la table. ', b('Proportionnelle au Ø'), ' : fz = avance × Ø outil, sans dépasser l’avance maximale. ', b('Filetage'), ' : fz = pas.']),
    formulaRow('pas', 'Pas d’un filet', '(po)', ['pas = 1 / filets par pouce', 'pas = mm / 25.4'], [el('div', {}, '1/4-20 UNC : pas = 1 / 20 = 0.0500 po'), el('div', {}, 'M10 × 1.5 : pas = 1.5 / 25.4 = 0.0591 po'), el('div', {}, 'M10 : Ø = 10 / 25.4 = 0.3937 po')]),
    formulaRow('f', 'Avance totale par révolution', 'f (po/rév)', 'f = fz × nombre de dents', 'Distance parcourue pendant un tour complet. Un outil à une seule arête (tournage) : f = fz.'),
    formulaRow('vf', 'Vitesse d’avance', 'Vf (po/min)', 'Vf = N × f', 'C’est la vitesse programmée à la commande (G94).'),
    el('div', { class: 'formula-boxes' }, [
      el('div', {}, [
        el('p', {}, [b('Exemple'), ' — foret Ø 1/4 po, acier rapide, 2 lèvres, acier 1020 (P-1, 125 HB)']),
        el('p', {}, el('span', { class: 'mark-rotation' }, 'Vc = 100 pi/min · N = 100 × 4 / 0.25 = 1600 rév/min')),
        el('p', {}, el('span', { class: 'mark-feed' }, 'fz = 0.006 × 0.25 = 0.0015 po/dent · f = 0.0015 × 2 = 0.0030 po/rév · Vf = 1600 × 0.0030 = 4.8 po/min')),
      ]),
      el('div', {}, [
        el('p', {}, [b('Saisie'), ' — point décimal, pas de séparateur de milliers : 1600 · 0.0015.']),
        el('p', {}, 'La correction tolère l’arrondi d’affichage (N à l’entier, avances à 4 décimales).'),
      ]),
    ]),
  ]);
}

// Crée la couche des feuilles, une fois, et l'accroche à la page. Retourne { open(feuille), close() }.
export function createReference(data) {
  const pages = { vc: () => vcPage(data), avances: () => feedPage(data), formules: formulasPage };
  const stage = el('div', { class: 'print-stage sheets-stage' });
  const title = el('div', { class: 'app-title' }, 'Tables de référence');
  const tabs = TABS.map(({ id, label }) => el('button', { class: 'tab', type: 'button', role: 'tab', 'data-tab': id, onclick: () => show(id) }, label));
  let returnFocus = null;

  const layer = el('div', { class: 'sheets', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tables de référence', hidden: true }, [
    el('div', { class: 'sheets-bar no-print' }, [
      title,
      el('div', { class: 'sheets-actions' }, [
        el('button', { class: 'button button--gold', type: 'button', onclick: () => window.print() }, 'Imprimer / PDF'),
        el('button', { class: 'button-link', type: 'button', onclick: close }, '← Retour à la question'),
      ]),
    ]),
    el('div', { class: 'sheets-tabs no-print', role: 'tablist' }, tabs),
    stage,
  ]);
  layer.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  document.body.append(layer);

  function show(id) {
    const tab = TABS.find((entry) => entry.id === id) ?? TABS[0];
    tabs.forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tab === tab.id)));
    title.textContent = `Tables de référence — ${tab.label}`;
    stage.replaceChildren(pages[tab.id]());
    stage.scrollTo(0, 0);
  }

  function open(id) {
    returnFocus = document.activeElement;
    show(id);
    layer.hidden = false;
    document.body.classList.add('sheets-open'); // la page en dessous ne défile plus, et ne s'imprime pas
    tabs.find((button) => button.getAttribute('aria-selected') === 'true').focus();
  }

  function close() {
    layer.hidden = true;
    document.body.classList.remove('sheets-open');
    returnFocus?.focus?.(); // on revient à la case qu'on était en train de remplir
  }

  return { open, close };
}
