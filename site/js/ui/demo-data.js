// Ce que montre le mode démo (décision D92 ; UI §3.10) : fonctions PURES, sans DOM, testées sous Node ;
// demo-screen.js, question-screen.js et home-screen.js ne font que les mettre à l'écran.

// Le lien du mode démo d'un exercice, tel que l'accueil l'écrit dans ses rangées : la page de l'exercice, « &demo=1 »
// (app.js, demoRequested, le reconnaît au démarrage).
export const demoHref = (id) => `?exercice=${encodeURIComponent(id)}&demo=1`;

// --- Textes -----------------------------------------------------------------------------------------------------

// La barre du haut : « Démo — <titre> ». Le rappel « rien n'est gardé » qui s'y trouvait est retiré (D93) : le bandeau le dit.
export const demoTitle = (titre) => `Démo — ${titre}`;

// Le bouton « Démo » d'une rangée de l'accueil : son nom accessible et son indice (D93).
export const demoName = (titre) => `Démo : ${titre}`;
export const DEMO_HINT = 'Essayer sans identification';

// Le bandeau discret mais constant de la démo (D92, point 8 ; D93), et ses deux sorties.
export const DEMO_BANNER = { label: 'Démo', text: "rien n'est enregistré.", exercise: 'Faire le vrai exercice', specimen: "Voir un exemple d'attestation" };

// L'écran du choix de l'outil (D93).
export const CHOOSER = {
  eyebrow: 'Démo',
  title: 'Sur quel outil veux-tu des questions ?',
  intro: "Choisis un outil, ou laisse le hasard choisir. Tu pourras changer d'outil en tout temps.",
  random: 'Au hasard',
  randomNote: 'Un outil différent à chaque question',
  back: '← Revenir à la question',
};

// Quand le serveur ne reconnaît plus la démo (24 h sans activité) : on en commence une autre.
export const DEMO_EXPIRED_NOTICE = 'La démo a expiré. Choisis un outil pour recommencer.';

// À 100 % (D92, point 7 ; D93).
export const DEMO_DONE = { title: 'Démo réussie', text: 'Dans le vrai exercice, ton attestation apparaîtrait ici. Tu peux continuer.' };

// Le spécimen d'attestation (D92, point 9 ; D93) : le titre de la barre du haut, puis la consigne en deux phrases, la
// première en gras.
export const SPECIMEN = {
  title: "Spécimen d'attestation",
  lead: 'Exemple sans valeur.',
  text: "C'est ce document que tu remettras sur Léa à la fin du vrai exercice.",
  watermark: 'SPÉCIMEN',
  back: '← Retour à la démo',
  print: 'Enregistrer en PDF',
};
// Le nom du fichier PDF d'un spécimen (« Specimen-attestation-<exercice> ») vient d'attestationFileName (attestation-data.js),
// qui le donne aussi au pied de page.

// --- Les outils de l'exercice, regroupés par opération (D92, point 6) ---------------------------------------------
// Les opérations dans l'ordre de leur premier outil dans l'exercice, les outils dans l'ordre de l'exercice (comme la
// progression, D81). Retourne [{ operation, picto, tools: [{ id, label, range, streak }] }] — label : le nom tel
// que la progression l'écrit (« SDTMR (métrique) ») ; range : la plage de dimensions ; picto : le pictogramme de
// l'opération dans les tables de la version.
//   rows : les outils questionnés de la page de description (toolRows, home-data.js), dans l'ordre de l'exercice
export function demoToolGroups(rows) {
  const groups = [];
  for (const row of rows) {
    let group = groups.find((entry) => entry.operation === row.operation);
    if (!group) {
      group = { operation: row.operation, picto: row.picto, tools: [] };
      groups.push(group);
    }
    group.tools.push({ id: row.id, label: row.label, range: row.range, streak: row.streak });
  }
  return groups;
}

// Le nom à montrer de l'outil choisi (le libellé de la progression), ou « Au hasard ».
export function chosenToolLabel(chosen, groups) {
  const tool = chosen === null ? null : groups.flatMap((group) => group.tools).find((entry) => entry.id === chosen);
  return tool ? tool.label : CHOOSER.random;
}
