# Rapport — la feuille des avances à plus de 20 opérations (suite de D83)

> **Correction des séances en cours (D75, point 7) : aucun changement.** De la présentation seulement : la feuille des
> avances, et deux commentaires dans le code. Aucune migration de la base.

Session du 2026-09-28, branche `feuille-avances-hauteur`, partie de `main` à jour (`5e293e4`, qui contient
`facteurs-vitesse`). Poussée, pas fusionnée ; rien n'a été lu ni écrit en production. Pas de nouvelle décision : la
fin de D83 est complétée. Aucun point de ta demande ne contredisait une décision fermée ni le code.

## 1. Ce qui a été fait

**1. La feuille des avances reçoit la règle de la 4e feuille** (point 4 de la retouche, accepté). Ses rangs se
partagent la hauteur de la page, sans jamais dépasser leur hauteur d'aujourd'hui.

| Opérations | Avant | Maintenant |
|---|---|---|
| 19 (aujourd'hui) et 20 | rangs de 41 px | rangs de 41 px : la même feuille, élément par élément |
| 21 | rangs de 41 px, la grille dépasse le pied de page de 16 px | rangs de 39,8 px, la grille finit 8 px avant le pied |
| 23 | rangs de 41 px, la grille dépasse le pied de page de 98 px | rangs de 36,4 px, la grille finit 8 px avant le pied |

- L'en-tête de la grille garde ses 41 px ; ce sont les rangs des opérations qui se resserrent, tous également.
- Le texte garde sa taille (11 px).
- Le pictogramme ne dépasse jamais son rang : 38 px de haut tant que le rang le permet, la hauteur du rang ensuite.
- Deux fichiers : `site/css/sheets.css` (la grille, le pictogramme) et `site/js/ui/reference-screen.js` (le nombre
  d'opérations, donné à la feuille de style).

**2. Les deux `// ❓` de D82 sont retirés** (point 5, accepté) : `site/js/expression.js` et
`site/js/ui/question-screen.js`. Les commentaires disent la règle acceptée à la fin de D82, sans question. Il ne reste
aucun `❓` dans le code de `site/`, de `worker/` ni de `tests/`.

## 2. Vérifications

- `npm test` : **766 tests, 0 échec**. Le témoin de non-régression n'a pas été régénéré : `git diff` ne touche ni
  `tests/instantanes/avant-d83.json` ni aucun test.
- `npm run test:api` : **35 étapes**.
- **Chrome, à 1280, 390 et 360 px : 56 vérifications, aucun échec.** Aucune exception, aucune erreur en console,
  aucune requête hors du site. Deux serveurs côte à côte, sur les mêmes données : le code de `main` et celui de la
  branche.
  - **À 19 et à 20 opérations, et pour la version semée (A2026_r0)** : la feuille des avances est celle de `main`,
    élément par élément (place, taille, police, couleurs, texte) aux trois largeurs ; à 1280 px, la même image,
    octet pour octet.
  - **Les trois autres feuilles** (vitesses de coupe, formules, facteurs de vitesse) : la même comparaison, le même
    résultat.
  - **À 21 et à 23 opérations**, dans une base jetable (Chambrage, Moletage, puis deux autres, chacune avec un
    pictogramme) : la grille finit avant le pied de page, rien n'est posé dessus, les noms tiennent sur une ligne,
    chaque pictogramme reste dans son rang, les notes et les directions d'avance dans les leurs. **Une page lettre à
    l'impression**, pour chacune des quatre feuilles, depuis les trois largeurs.
  - **Le témoin du défaut** : avec le code de `main`, la grille dépasse le pied de page de 16 px à 21 opérations, de
    98 px à 23.
  - **Depuis une séance** (tables A2026_r0) : la même feuille des avances que sur `/tables?version=A2026_r0`,
    19 rangs de 41 px.
- Captures dans `captures/feuille-avances-hauteur/` (hors dépôt).

**Deux écarts rencontrés en route.**

1. **Un vrai, corrigé.** Ma première règle pour le pictogramme retirait 1 px à trois d'entre eux, ceux du dernier rang
   de chaque machine (leur case porte le trait du bas). La comparaison avec `main` l'a vu ; la règle est corrigée, et
   la feuille est identique.
2. **Un bruit de Chrome, sans rapport avec le code.** À 1280 px, une image sur onze a différé à la première capture
   (la feuille des facteurs : 17 064 pixels sur 861 696, écart de teinte de 13 sur 255 au plus), avec une mise en page
   identique. Chrome ne peint pas toujours deux fois de la même façon une page qui porte de petites images. Le script
   recapture alors des deux côtés : l'image identique est venue au deuxième essai.

## 3. Tes gestes

1. **Fusionner et déployer hors des périodes de labo.**
2. **Ensuite seulement, créer Chambrage et Moletage** (geste 7 du rapport `facteurs-vitesse`). Tant que cette branche
   n'est pas déployée, s'en tenir à 20 opérations : la 21e déborde sur le pied de page de la feuille des avances.

## 4. Ce que je n'ai pas pu vérifier

- **Un vrai téléphone, et un autre navigateur que Chrome** (Safari sur iPhone en particulier).
- **Le déploiement de `main`** après la fusion de `facteurs-vitesse` : je vois la fusion dans git, pas l'état du
  déploiement.
- **Les données de production** : je n'ai lu que la semence.

## 5. Points douteux, chacun avec ma proposition

1. **L'en-tête de la grille garde ses 41 px quand les rangs se resserrent.** À 23 opérations, il est donc un peu plus
   haut que les rangs (41 contre 36,4 px). **Proposition : garder** ; c'est la règle de la 4e feuille, dont l'en-tête
   est fixe aussi.
2. **La grille s'arrête 8 px avant le pied de page**, comme la 4e feuille, pour ne pas coller au pied. Cela ne change
   pas le seuil : les rangs se resserrent à partir de la 21e opération. **Proposition : garder.**
3. **Jusqu'où la feuille reste lisible.** D'après les mesures, et sans l'avoir essayé au-delà de 23 : jusqu'à 27
   opérations, les notes de deux lignes (« Ajuster l'avance ↔ Ø outil », « Av. MAX. ») tiennent dans leur rang ; à
   partir de 28, elles en dépasseraient de quelques pixels. **Proposition : ne rien faire maintenant** ; à revoir si
   les tables approchent 28 opérations.
4. **Les points 1 à 3 de la retouche** (§7.5 du rapport `facteurs-vitesse` : les pictogrammes de la 4e feuille, sa
   disposition sur téléphone, les trois onglets d'une version d'avant sur deux rangées) n'ont pas reçu de réponse. La
   branche a été fusionnée avec ce que je proposais. **Proposition : les tenir pour acceptés**, sauf avis contraire.
