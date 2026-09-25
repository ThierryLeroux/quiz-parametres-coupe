// La page /tables?version=<révision> (jalon 7b, décision D63) : les trois feuilles de référence d'une
// version publiée des tables — vitesses de coupe, avances, formules —, telles que l'étudiant les voit,
// avec les couleurs de cette version, prêtes à imprimer. Ouverte depuis l'éditeur (onglet Tables de
// référence, liste des versions). Publique : ce sont les feuilles de l'atelier.

import { getTables } from '../api.js';
import { assembleTables } from '../data.js';
import { applyTableColors, el } from './dom.js';
import { createReference } from './reference-screen.js';
import { serverErrorMessage } from './text.js';

const main = document.querySelector('#app');

async function start() {
  const version = new URLSearchParams(location.search).get('version');
  if (!version) {
    main.replaceChildren(el('div', { class: 'screen screen--narrow' }, el('section', { class: 'panel' }, [el('h1', {}, 'Tables de référence'), el('p', {}, "L'adresse doit nommer une version : /tables?version=A2026_r0.")])));
    return;
  }
  try {
    const { tables } = await getTables(version);
    const data = assembleTables(tables);
    applyTableColors({ classes_iso: data.classesIso, materiaux_outil: data.toolMaterials });
    document.title = `Tables de référence ${tables.id} — Quiz paramètres de coupe`;
    main.replaceChildren();
    createReference(data, { standalone: true }).open('vc');
  } catch (error) {
    main.replaceChildren(el('div', { class: 'screen screen--narrow' }, el('section', { class: 'panel' }, [el('h1', {}, 'Tables de référence'), el('p', {}, error.status === 404 ? `La version « ${version} » des tables de référence n'existe pas.` : serverErrorMessage(error))])));
  }
}

start();
