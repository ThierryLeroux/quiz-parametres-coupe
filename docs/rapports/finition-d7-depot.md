# Rapport — Finition : D7 fermée (le dépôt dédié), ménage des statuts restés en suspens (décision D80)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Cette session ne touche que des documents :
> aucun code, aucune migration, aucune donnée. Ni le calcul, ni les tolérances, ni la question figée, ni les
> attestations ne bougent ; le déploiement de cette branche ne change rien pour les étudiants.

Session du 2026-09-28, branche `finition-d7-depot`, partie de `main` à jour (`765abbc`, E5-4 fusionné). Poussée, pas
fusionnée ; rien n'a été lu ni écrit en production, et rien n'a été touché dans le dépôt `tgm-fab`.

## En bref

- **D80** ferme D7 : le projet est un **dépôt dédié**, public, servi par un seul Worker Cloudflare, à l'adresse de
  D73. `tgm-fab` n'a plus de rôle pour le quiz : tu dépublies son GitHub Pages toi-même (marche à suivre au §2).
- **D3 et D4 sont confirmées**, D6 est marquée fermée (elle l'était par D19). Seuls les **en-têtes** des quatre
  anciennes entrées sont annotés, comme celui de D64 ; leurs corps sont intacts.
- `legacy/index.htm` devient **l'ancienne page de vérification du classeur** (README, legacy/README).
- **PLAN** : les cinq cases que tu as nommées sont cochées, deux gestes nouveaux ajoutés. Les autres cases ouvertes
  sont listées au §3 : dis-moi lesquelles sont faites.
- Tests : `npm test` **686**, `fail 0` (inchangé : aucun code touché).

## 1. Ce qui a changé, fichier par fichier

**`docs/DECISIONS.md`**

- **D80** — « Le dépôt dédié et Cloudflare : D7 fermée ; D3 et D4 confirmées, D6 marquée fermée » (contexte →
  décision → conséquences) :
  1. D7 fermée : dépôt dédié `ThierryLeroux/quiz-parametres-coupe`, public (aucun secret n'y vit, D22) ; un seul
     Worker Cloudflare (D20), déployé par GitHub Actions après les tests ; GitHub Pages de ce dépôt dépublié ; adresse
     de D73. La page de vérification n'a pas eu à rester dans `tgm-fab` : c'est `/verifier`, sur le même Worker (D33).
  2. `tgm-fab` : tu dépublies son GitHub Pages ; `legacy/index.htm` en garde la copie. Après la dépublication, un
     ancien QR du classeur ne s'ouvre plus — il n'en reste aucun à vérifier.
  3. D3 confirmée. **Ce qui tient** : modules ES sans framework ni étape de construction, `node --test` (le moteur,
     et le serveur sur `node:sqlite`), une seule dépendance d'exécution vendorisée, la bibliothèque QR.
     **Ce que D19 et D20 ont changé** : le serveur de correction, l'hébergement Cloudflare (Worker et D1) au lieu de
     GitHub Pages, `wrangler` pour développer et publier.
  4. D4 confirmée, et ses conventions s'appliquent partout : site, serveur, tests, migrations, scripts de
     `reference/`, documents, commits ; les clés des données en français `snake_case`, dans les JSON du dépôt comme
     dans les tables et les colonnes de D1 (vérifié : toutes les tables des migrations le sont déjà).
  5. D6 marquée fermée (par D19).
  6. Les anciennes entrées ne sont pas réécrites.
- **En-têtes annotés**, rien d'autre : D3 « (2026-09-19, proposée ; confirmée par D80) », D4 « (2026-09-19,
  provisoire ; confirmée par D80) », D6 « (ouverte ; fermée par D19) », D7 « (ouverte ; fermée par D80) ».

**`docs/SPEC.md`** — §11, question 5 barrée : « Tranché : dépôt dédié (D80). »

**`README.md`** — la ligne `legacy/` de la structure : « ancienne page de vérification du classeur (publiée sur
thierryleroux.github.io/tgm-fab jusqu'à sa dépublication, D80) » au lieu de « page de vérification actuelle ».

**`legacy/README.md`** — `index.htm` : « l'ancienne page de vérification du classeur, publiée sur
`thierryleroux.github.io/tgm-fab/` jusqu'à sa dépublication (D80) : elle décodait `?data=` et affichait le rapport »,
et une phrase de plus : le quiz web ne s'en sert pas, ses attestations se vérifient sur `/verifier` (D33). Rien d'autre
dans `legacy/` n'est touché.

**`docs/DEMARRAGE.md`** — deux retouches, trouvées par la recherche du point 4 :

- **Étape 2** : « nom `quiz-parametres-coupe` (ou selon D7) » présentait D7 comme ouverte ; devient « (un dépôt
  dédié, D80) », avec « celui du projet est public : aucun secret n'y vit, D22 » à côté de « privé ou public au
  choix ».
- **Étape 4, point 6** (désactiver GitHub Pages) : ajouté « Fait pour ce dépôt-ci ; le dépôt `tgm-fab`, qui ne
  publiait plus que l'ancienne page de vérification du classeur, se dépublie de la même façon (D80). »

**`docs/PLAN.md`** — cochées, parce que c'est fait :

- Jalon 0 : « Publication sur Cloudflare en place ».
- Jalon 3 : « À faire par Thierry avant de pousser : droit D1 : Edit ».
- « Thierry, dans l'ordre … sous-domaine `tgm-tmi` … remplacer les liens de Léa » — elle est dans le chantier
  « accueil et libellés », pas sous « Après le jalon 5 » comme dit dans la consigne ; c'est bien elle, la seule qui
  parle du sous-domaine. Ajoutée juste dessous, non cochée : « **Thierry** : rediffuser le lien du site sur Léa
  (« Copier le lien ») ».
- E5-4 : « **Thierry** : fusionner (fait : fusionné et déployé le 2026-09-28) ».
- Finition : « Décision D7 (dépôt) close (D80 : dépôt dédié ; D3 et D4 confirmées) », avec le nom de ce rapport ;
  ajoutée dessous, non cochée : « **Thierry** : dépublier GitHub Pages de `tgm-fab` (D80 ; marche à suivre dans le
  rapport) ».

**La recherche** (tout le dépôt, fichiers cachés compris, hors `docs/rapports/`, hors `legacy/vba/`, hors corps des
anciennes décisions) : `tgm-fab`, `GitHub Pages`, `github.io`, `pages.yml`, `D7`, `thierryleroux`. Laissé tel quel :

- **SPEC §8**, « L'ancien QR du classeur (`https://thierryleroux.github.io/tgm-fab/?data=…` …) était reproductible
  … : il n'est pas repris » — déjà au passé.
- **DEMARRAGE, étapes 2 et 3** : l'adresse du dépôt `github.com/thierryleroux/quiz-parametres-coupe` — c'est la bonne
  (GitHub ne distingue pas les majuscules).
- **DEMARRAGE, « Changer l'adresse du site »**, et `tests/worker-api.test.js` : l'ancienne adresse
  `…thierryleroux.workers.dev` — c'est Cloudflare, pas GitHub Pages ; le test la garde exprès (une attestation émise
  sous l'ancienne adresse se vérifie sous la nouvelle, D72). Voir le §4, point 2.
- `CLAUDE.md`, `site/`, `worker/`, `.github/` : aucune mention.

## 2. Dépublier le GitHub Pages de `tgm-fab`

La marche à suivre de `DEMARRAGE.md`, étape 4, point 6, appliquée à `tgm-fab` :

1. Ouvrir le dépôt : https://github.com/ThierryLeroux/tgm-fab.
2. **Settings** → **Pages** (colonne de gauche, section *Code and automation*).
3. Bouton **Unpublish site**. S'il n'est pas visible : le menu « … » à côté de l'adresse du site (« Your site is live
   at … »), puis **Unpublish site**.
4. Vérifier, après quelques minutes : `https://thierryleroux.github.io/tgm-fab/` ne répond plus (404).

Rien d'autre à faire : le dépôt `tgm-fab` peut rester tel quel (ou être archivé, à ton choix) ; ce dépôt-ci n'en dépend
pas, et `legacy/index.htm` garde la copie de la page. Une fois fait, coche la ligne de Finition.

## 3. Les cases encore ouvertes du PLAN

Je n'ai coché que les cinq que tu as nommées. Dis-moi lesquelles de celles-ci sont faites :

**Tes gestes en production**

1. Jalon 5 : **essai avec un groupe d'étudiants** ; correctifs.
2. Chantier « avances » : **publier l'exercice de tournage** (perçage au tour compris) ; micro-forets écartés par ses
   dimensions.
3. Chantier « avances » : **ajouter deux fraises à surfacer de 3 po**, à 5 et à 7 dents ; puis **publier l'exercice
   de fraisage**.
4. Chantier « accueil et libellés » : **rediffuser le lien du site sur Léa** (« Copier le lien ») — ajoutée aujourd'hui.
5. Chantier « accueil et libellés » : **mettre le cours « M10 » aux deux M10** et les publier ; **renommer « M10 —
   Tournage : Vc et RPM »**.
6. Chantier « gestion du contenu » : **repérer les doublons de titre** déjà en production et, s'il y en a, changer un
   titre ou archiver l'un des deux ; trancher les points douteux de son rapport. Depuis E5-4 (D79, point 8), c'est
   plus simple : la liste des exercices de la Gestion du contenu marque en doré chaque exercice dont le titre en
   vigueur se confond avec celui d'un autre — il suffit de l'ouvrir.
7. E5-1 : **ouvrir l'onglet Tables de référence** et vérifier la présentation de départ (encadré doré des retouches
   restées dans le brouillon, avertissements dorés, images archivées en vigueur).
8. E5-3 : **ouvrir la page de chaque exercice publié** (encadré doré des retouches de présentation restées dans le
   brouillon).
9. Finition : **dépublier GitHub Pages de `tgm-fab`** (§2) — ajoutée aujourd'hui.

**Du développement, pas un geste de production**

10. Finition : **graphique de progression par opération** — reste à faire, dans une session à venir.

## 4. Remarques, hors de la consigne

Je ne les ai pas corrigées : elles dépassent « tgm-fab, GitHub Pages, D7 ». Dis-moi si tu veux une petite retouche.

1. **`README.md`, section « Données »** : « Modifier une valeur pédagogique = éditer le JSON, lancer `npm test`,
   commettre » est faux depuis D47 (on modifie en production, dans la Gestion du contenu ; les JSON ne sont plus que
   la semence et les données des tests). Dans la structure, les lignes `site/data/`, `site/exercices/` et
   `migrations/` datent aussi d'avant D47.
2. **`DEMARRAGE.md`, « Changer l'adresse du site »** : la procédure est faite (case cochée aujourd'hui), mais elle
   parle encore de `thierryleroux.workers.dev` comme de « l'adresse actuelle ». On pourrait la marquer « faite le … »
   en tête, sans la retirer (elle explique ce qui a cessé de fonctionner).

## 5. Vérifications

- `npm test` : **686** tests, `fail 0` — le même nombre qu'avant : aucun code n'a changé.
- Pas de `test:api` ni de passe dans Chrome : aucun fichier de `site/`, `worker/` ou `migrations/` n'est touché.
- `git diff` des anciennes entrées de DECISIONS : seules les quatre lignes d'en-tête changent.

## 6. Commits

1. D80 ; en-têtes de D3, D4, D6, D7 ; SPEC §11 ; README ; legacy/README ; DEMARRAGE, étapes 2 et 4.
2. PLAN : les cinq cases cochées, les deux lignes ajoutées.
3. Ce rapport.
