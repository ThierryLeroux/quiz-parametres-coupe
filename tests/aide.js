// Aides partagées par les tests (ce fichier n'est pas un test : il ne finit pas par .test.js).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadData } from '../site/js/data.js';
import { generateQuestion } from '../site/js/question.js';

// Lit un fichier de site/ : sous Node, fetch ne lit pas les fichiers locaux.
export const lireFichier = async (url) => JSON.parse(await readFile(new URL(`../site/${url}`, import.meta.url), 'utf8'));

// Le vrai catalogue, chargé et validé une fois.
export const data = await loadData('data/', lireFichier);

// Générateur pseudo-aléatoire à graine (mulberry32) : tirages nombreux mais reproductibles.
export const aleaAGraine = (graine) => () => {
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Fabrique une question précise en passant par le vrai générateur : chaque tirage
// est choisi pour tomber sur l'élément voulu (milieu de sa tranche de [0, 1[).
//   groupeMateriau : numéro de groupe (VDI 3323) du matériau brut, clé « groupe » de materiaux.json
export function questionPour({ outil, dimension, dents, materiauOutil, groupeMateriau }) {
  const o = data.outils.find((t) => t.id === outil);
  const m = data.materiaux.find((x) => x.groupe === groupeMateriau);
  const etiquette = `${m.iso} - ${m.materiau}`;
  const viser = (index, longueur) => {
    assert.ok(index >= 0, `introuvable pour ${outil} : ${dimension} / ${materiauOutil} / ${etiquette}`);
    return (index + 0.5) / longueur;
  };
  const tirages = [
    0,
    viser(dents - o.nb_dents_min, o.nb_dents_max - o.nb_dents_min + 1),
    viser(o.dimensions.findIndex((d) => d.libelle === dimension), o.dimensions.length),
    viser(o.materiaux_outil.indexOf(materiauOutil), o.materiaux_outil.length),
    viser(o.groupes_materiaux_usinables.indexOf(etiquette), o.groupes_materiaux_usinables.length),
    viser(data.materialsByGroup.get(etiquette).indexOf(m), data.materialsByGroup.get(etiquette).length),
  ];
  const question = generateQuestion(data, [o], () => tirages.shift());
  assert.equal(question.dimension.label, dimension);
  assert.equal(question.teeth, dents);
  assert.equal(question.material.groupe, groupeMateriau);
  return question;
}

// Toutes les questions possibles du catalogue : chaque outil × nombre de dents × dimension ×
// matériau d'outil × matériau brut usinable. Générateur (for…of) pour ne pas tout garder en mémoire.
export function* toutesLesQuestions() {
  for (const o of data.outils) {
    for (let dents = o.nb_dents_min; dents <= o.nb_dents_max; dents += 1) {
      for (const dimension of o.dimensions) {
        for (const materiauOutil of o.materiaux_outil) {
          for (const etiquette of o.groupes_materiaux_usinables) {
            for (const m of data.materialsByGroup.get(etiquette)) {
              yield questionPour({ outil: o.id, dimension: dimension.libelle, dents, materiauOutil, groupeMateriau: m.groupe });
            }
          }
        }
      }
    }
  }
}
