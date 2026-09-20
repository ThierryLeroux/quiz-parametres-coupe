// Le catalogue et les exercices, lus par le serveur (décision D22).
// Une seule source : les JSON de site/data/ et de site/exercices/, ceux-là mêmes que lit le
// navigateur. Le Worker les lit par sa liaison ASSETS, avec loadData et loadExercise du site —
// donc avec les mêmes validations — et garde le résultat en mémoire. Ajouter un exercice reste
// « déposer un JSON et l'inscrire dans index.json » : rien à changer ici.

import { loadData } from '../site/js/data.js';
import { loadExercise, loadExerciseIndex } from '../site/js/exercice.js';

// Mémoire par liaison ASSETS, c'est-à-dire par instance du Worker : un déploiement en crée de
// nouvelles, donc un JSON modifié est relu dès qu'il est publié.
const loaded = new WeakMap();

const reader = (assets) => async (path) => {
  const response = await assets.fetch(new Request(`https://site.invalid/${path}`));
  if (!response.ok) throw new Error(`Impossible de lire ${path} (HTTP ${response.status})`);
  return response.json();
};

async function load(assets) {
  const readJson = reader(assets);
  const data = await loadData('data/', readJson);
  const index = await loadExerciseIndex('exercices/', readJson);
  const exercises = new Map();
  for (const { id } of index) exercises.set(id, await loadExercise(id, data, 'exercices/', readJson));
  return { data, exercises };
}

// Retourne { data, exercises } : le catalogue (loadData) et les exercices de l'index, par id.
export function loadCatalogue(assets) {
  if (!loaded.has(assets)) {
    const loading = load(assets);
    loaded.set(assets, loading);
    loading.catch(() => loaded.delete(assets)); // un échec n'est pas gardé : le prochain appel réessaie
  }
  return loaded.get(assets);
}
