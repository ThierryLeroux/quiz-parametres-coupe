// L'entrée de l'espace enseignant, /prof (décision D95) : une seule page, dont les écrans viennent de deux modules —
// prof.js (Réussites, Corrections d'identité) et editeur.js (Exercices, Banque d'outils, Tables de référence, Images,
// Sauvegarde) — sur la coquille commune de prof-shell.js. Ici, on enregistre les onglets, puis on démarre.

import { showBackup, showBank, showImages, showList, showTables } from './editeur.js';
import { showIdentities, showSessions } from './prof.js';
import { registerTabs, start } from './prof-shell.js';

registerTabs({
  seances: showSessions,
  identites: showIdentities,
  exercices: showList,
  banque: showBank,
  tables: showTables,
  images: showImages,
  sauvegarde: showBackup,
});

start();
