// Progression de l'étudiant dans un exercice (SPEC §7, décision D12).
// Réussites CONSÉCUTIVES : un échec remet à zéro le compteur de l'outil, et seulement
// celui-là ; le total des questions réussies (pour le rapport) ne diminue jamais.
//
// L'état est un objet simple, sérialisable en JSON (localStorage) :
//   { exerciceId, reussites: { [id d'outil]: n }, totalReussies }
// Un outil absent de `reussites` vaut 0. Les fonctions sont pures : elles ne modifient
// jamais l'état reçu, elles en retournent un nouveau.

// État de départ d'un exercice.
export function createProgress(exercise) {
  return { exerciceId: exercise.id, reussites: {}, totalReussies: 0 };
}

// Un état sauvegardé pour un autre exercice ne doit jamais servir ici.
function checkSameExercise(exercise, progress) {
  if (progress.exerciceId !== exercise.id) {
    throw new Error(`Cette progression est celle de l'exercice « ${progress.exerciceId} », pas de « ${exercise.id} »`);
  }
}

// Enregistre le résultat d'une question sur l'outil `toolId` ; retourne le nouvel état.
export function recordResult(progress, toolId, success) {
  const current = progress.reussites[toolId] ?? 0;
  return {
    ...progress,
    reussites: { ...progress.reussites, [toolId]: success ? current + 1 : 0 },
    totalReussies: progress.totalReussies + (success ? 1 : 0),
  };
}

// Outils encore à évaluer, prêts pour generateQuestion (question.js) : ceux de l'exercice
// dont le compteur est sous reussites_requises. Si l'exercice restreint les dimensions, les
// matériaux d'outil ou les groupes de matériaux d'un outil, l'outil retourné est une COPIE
// qui ne contient que les choix permis ; le catalogue n'est pas modifié.
export function eligibleTools(exercise, data, progress) {
  checkSameExercise(exercise, progress);
  return exercise.outils
    .filter((entry) => (progress.reussites[entry.id] ?? 0) < entry.reussites_requises)
    .map((entry) => {
      const tool = data.outils.find((o) => o.id === entry.id);
      if (!tool) throw new Error(`Exercice « ${exercise.id} » : l'outil « ${entry.id} » n'existe pas dans le catalogue`);
      // Une restriction absente laisse tous les choix de l'outil.
      const restrict = (choices, allowed, labelOf = (choice) => choice) => (
        allowed ? choices.filter((choice) => allowed.includes(labelOf(choice))) : choices
      );
      return {
        ...tool,
        dimensions: restrict(tool.dimensions, entry.dimensions, (d) => d.libelle),
        materiaux_outil: restrict(tool.materiaux_outil, entry.materiaux_outil),
        groupes_materiaux_usinables: restrict(tool.groupes_materiaux_usinables, entry.groupes),
      };
    });
}

// L'exercice est réussi quand chaque outil a atteint ses réussites requises.
export function isComplete(exercise, progress) {
  checkSameExercise(exercise, progress);
  return exercise.outils.every((entry) => (progress.reussites[entry.id] ?? 0) >= entry.reussites_requises);
}
