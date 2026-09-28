# Rapport — E5-3 : la présentation des exercices en direct (décision D78)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Ce jalon ne touche ni au calcul, ni aux
> tolérances, ni à `isQuestionValid`, ni à la question figée, ni à la signature ou à la vérification des attestations.
> Ce qui change pour une séance en cours, c'est **ce qu'elle montre** : le titre de la barre, la photo et la note du
> panneau de l'outil sont ceux en vigueur, dès que sa page se recharge. Un test le vérifie : la séance garde exactement
> sa question, ses réponses attendues et sa correction.
>
> **Au déploiement**, rien n'est appliqué : la présentation de chaque exercice est celle de sa dernière version. Une
> séance sur la dernière version ne voit donc aucune différence. **Une séance épinglée à une version plus ancienne
> montre, dès le déploiement, le titre, les photos et les notes de la dernière version** ; ses valeurs, ses outils et
> ses questions restent ceux de sa version.

Session du 2026-09-28, branche `e5-3-presentation-exercices`, partie de `main` à jour (`4f03102`, E5-2 fusionné).
Poussée, pas fusionnée ; rien n'a été lu ni écrit en production.

## En bref

- **En direct, par exercice publié** :
  - le titre, le cours et « À l'accueil » ;
  - pour chaque copie d'outil, sa photo et sa note.

  Tout le reste de l'exercice reste versionné. La liste blanche est imposée par le serveur.
- **La même mécanique qu'E5-1**, exercice par exercice :
  - une présentation en vigueur, et son historique sans limite ;
  - « Rétablir » en un clic ;
  - le contrôle optimiste (409) et le journal.

  Elle se pose par-dessus toute version de l'exercice, séances épinglées comprises, **seulement dans ce que le serveur
  montre**. Une version publiée en prend un instantané.
- **L'attestation.** Celles déjà émises ne changent pas d'un octet. Une attestation émise après ce jalon inscrit, dans
  le même champ, **le titre en vigueur à la réussite**.
- **Titre en double (D74).** Il est refusé quand un titre entre en vigueur : « Appliquer », « Renommer », « Rétablir ».
  Le refus vient de l'écran comme du serveur, et nomme l'exercice en conflit. **« Renommer »**, dans la liste, est
  désormais ce geste en direct pour un exercice publié.
- **Page d'un exercice publié** : un panneau vert **« Présentation — effet immédiat »**, avec l'aperçu, « Appliquer… »
  et l'historique. Ces champs quittent le brouillon et le résumé des différences.
- Tests : **676** (649 avant) ; `test:api` **34 étapes** (33) ; **Chrome** 19 vérifications.

## 1. Le modèle (D78, points 1 à 3)

**Le stockage.** La migration `0011` crée deux tables :

- `presentation_exercices` : **une ligne par exercice**, créée au premier « Appliquer » (contenu, révision, date,
  enseignant) ;
- `presentation_exercices_historique` : un contenu remplacé par ligne (quand et par qui il avait été posé ; quand, par
  qui et par quoi il a été remplacé).

**Le format** est celui de l'exercice, réduit à la liste blanche :

```json
{ "titre": "M10 — Tournage : vitesse de coupe", "cours": "M10", "liste": true,
  "outils": [ { "id": "mvlnr", "image": "mvlnr", "commentaire": "Outil de finition" } ] }
```

- `cours` null : sans cours.
- `image` null : la photo nommée d'après l'identifiant de la copie (comme « Aucune » aujourd'hui).
- `commentaire` null : pas de note.
- **La clé d'une copie est son identifiant dans l'exercice.**

**La présentation en vigueur.** Pas de ligne : c'est celle de la dernière version publiée, lue à chaque fois. Sinon :

- le titre, le cours et « À l'accueil » appliqués ;
- pour chaque copie de la dernière version, l'entrée appliquée si elle existe, sinon celle de la version ;
- puis les entrées appliquées d'une copie que la dernière version n'a plus : elle sert encore aux séances épinglées à
  une plus ancienne.

**Une copie que la présentation ne connaît pas garde la valeur de sa version.**

Les règles pures sont dans `site/js/presentation-exercice.js` (testé), partagées par le serveur et l'écran :

| Fonction | Rôle |
|---|---|
| `currentExercisePresentation` | la présentation en vigueur |
| `applyExercisePresentation` | la pose sur un contenu ou sur l'exercice servi ; identique clé pour clé quand rien ne change |
| `presentSessionView` | la pose sur la séance rendue |
| `withLiveTitle` | le titre de l'attestation émise |
| `exerciseValues` | un contenu sans ces champs, pour comparer les valeurs seules |
| `exercisePresentationErrors` | la validation (liste blanche, photo choisie) |
| `exercisePresentationDiff` | les différences en clair |
| `pendingExercisePresentation` | les retouches en attente du brouillon |

## 2. Où la présentation se pose — l'inventaire (ton point 3)

Le serveur la pose **après** le cache des versions assemblées. Le catalogue avec lequel il tire et corrige n'est jamais
touché.

| Champ | Où il s'affiche | D'où il vient |
|---|---|---|
| **Titre** | Accueil (la liste) | `GET /api/exercices` |
| | Page de description (le grand titre), identification (barre du haut) | `GET /api/exercice` |
| | Page Question (barre du haut), écran de réussite (barre du haut) | la séance rendue (`seance.exercice.titre`) |
| | Espace professeur : tableau des réussites, filtre par exercice, **export CSV** (colonne « Titre »), confirmations (remise à zéro, NIP, suppression) | `GET /api/prof/seances` |
| | Gestion du contenu : liste, grand titre de la page, confirmation de publication, cascade des tables, « Aperçu avec » de l'onglet Tables, « Ajouter depuis un autre exercice » | routes de l'éditeur |
| | **Attestation émise après ce jalon** | le titre en vigueur à l'émission ; ensuite, figé |
| | Attestation déjà émise, `/verifier` | l'enregistrement figé : **ne change pas** |
| **Cours** | Accueil (le regroupement), page de description (la surligne « M10 · exercice ») | `GET /api/exercices`, `GET /api/exercice` |
| | Gestion du contenu : colonne Cours, cours proposés et conseil d'écriture | liste de l'éditeur |
| **À l'accueil** | Accueil (qui est listé) ; Gestion du contenu, colonne « À l'accueil » | `GET /api/exercices`, liste de l'éditeur |
| **Photo** | Page de description (une ligne par outil) | `GET /api/exercice` (outils) |
| | Page Question (panneau de l'outil) | la séance rendue (`question.outil.image`) |
| | Gestion du contenu : vignette de chaque copie, panneau, aperçu | page de l'exercice |
| **Note** | Page Question (« Note : … » dans le panneau de l'outil) | la séance rendue (`question.outil.commentaire`) |
| | Gestion du contenu : panneau, aperçu | page de l'exercice |

**Jamais** dans le tirage, la correction, `isQuestionValid` ou la question figée : aucun ne lit un titre, une photo ou
une note.

La séance est rendue par `creation`, `reprise`, `identite`, `seance`, `question` et `correction`. On pose la
présentation sur la **vue** que le serveur rend, après coup. La séance elle-même n'en sait rien.

## 3. L'attestation (ton point 4)

`ensureAttestation` reçoit l'exercice avec le titre en vigueur (`withLiveTitle`). **C'est le seul changement** :

- `buildAttestation` est inchangée ; le champ est le même (`exercice.titre`) ;
- la signature et la vérification ne changent pas.

L'attestation est émise **à la réussite**. Pour une séance réussie avant l'émission des attestations, elle l'est à la
première ouverture : elle prend alors le titre en vigueur à ce moment.

Testé :

- une attestation émise, puis le titre et une note changés en direct, puis un renommage : la réponse de
  `/api/attestation` est identique **octet pour octet** ;
- les lignes de la table `attestations` sont identiques ;
- `/verifier` répond « valide » avec l'ancien titre ;
- Alex réussit ensuite : son attestation porte le titre affiché à sa réussite, se vérifie, et ne change pas quand le
  titre change encore.

## 4. Le titre en double (ton point 5)

**Quand il est vérifié.** Au moment où un titre entre en vigueur :

- « Appliquer » dans le panneau ;
- « Renommer » dans la liste ;
- « Rétablir » un contenu de l'historique ;

**et seulement si le titre change** (sa clé : casse, accents, espaces). Un doublon d'avant ne bloque donc pas un
changement de photo.

**Contre quoi.** Les **titres en vigueur** des autres exercices publiés et non archivés. Le refus nomme l'exercice en
conflit : « Titre refusé : un autre exercice publié porte déjà ce titre : « … » (id). Les étudiants reconnaissent un
exercice à son titre : choisis-en un autre (ou change celui de l'autre). »

- **À l'écran**, la ligne rouge apparaît sous le bouton, qui dit « Appliquer (titre déjà pris) ». Dans la liste, rien
  n'est envoyé.
- **Au serveur**, c'est un 400 avec `doublons`.

**Le brouillon d'un exercice jamais publié reste libre.** La règle s'applique à sa première publication, comme avant.

**Pour un exercice publié**, « Renommer » applique le titre en direct : même règle, même historique, même journal.
Jamais publié, il renomme toujours le brouillon.

## 5. Exercice jamais publié, copie nouvelle, retouches en attente (ton point 6)

- **Jamais publié** : tout reste dans le brouillon (réglages généraux, formulaire de chaque outil). Sa première
  publication met ces champs en vigueur.
- **Copie nouvelle** (ajoutée au brouillon d'un exercice publié) : sa photo et sa note se saisissent **dans son
  formulaire**. Sa ligne a un liseré doré et le dit. La version publiée les porte ; ensuite, elles sont en vigueur et ne
  se modifient plus que dans le panneau. Le panneau refuse une copie qu'il ne connaît pas encore.
- **Retouches en attente** : une valeur de présentation restée dans le brouillon que ni la présentation (en vigueur
  ou dans son historique) ni **aucune** version publiée n'a jamais portée. Le panneau les liste en doré, avec « Les
  reprendre dans le panneau ». La prochaine publication les abandonne.

  **Pourquoi « aucune version »** : un brouillon d'exercice ne dit pas de quelle version il est parti. Après une
  publication, qui prend un instantané, le titre qui dort dans le brouillon peut différer de la dernière version sans
  être une retouche.

## 6. La page d'un exercice (ton point 7)

Sous la barre de la page, un panneau **à contour vert**, comme celui des tables : « Présentation — effet immédiat »,
pastille EN DIRECT. Il contient :

- **Titre**, **Cours** (les cours existants proposés, et le conseil « Écrire « M10 » »), **Proposé dans la liste de
  l'accueil** ;
- un tableau **Outils : photo et note** : la galerie compacte des photos, avec téléversement, et la note. Une copie
  qui n'est plus dans la dernière version le dit ;
- **l'aperçu de ce que voit l'étudiant**, qui suit la frappe :
  - l'en-tête de la page de l'exercice (« M10 · exercice », le titre) ;
  - sa place à l'accueil ;
  - chaque outil avec sa photo et « Note : … » ;
- **Appliquer…** : la confirmation liste les changements en clair, puis « Appliquer maintenant » ;
- **l'historique** avec **Rétablir** ; un 409 propose de recharger le panneau.

**Le brouillon.** Les réglages généraux n'ont plus titre, cours ni « À l'accueil ». Le formulaire d'une copie connue
n'a plus Photo ni Note : un renvoi au panneau les remplace. Le **résumé des différences** (`versionDiff`) ne les liste
plus. Le « brouillon modifié », « aucune différence à publier » et « Annuler les modifications » ne comparent plus que
les valeurs.

**La publication** prend la présentation en vigueur (un instantané), et la cascade des tables aussi.

**Dupliquer** un exercice publié, ou y prendre une copie (« Ajouter depuis un autre exercice », « Dupliquer » dans
l'exercice), part de la présentation en vigueur, pas de ce qui dort dans le brouillon.

## 7. Sauvegarde, images, journal (tes points 8 et 2)

- **Sauvegarde.** Chaque exercice de l'export porte `presentation` : contenu, date, enseignant, historique. L'import
  l'ajoute ou la remplace comme celle des tables : l'historique absent est ajouté ; la présentation remplacée va à
  l'historique (« import »). **L'aller-retour ne change rien** (testé). Une autre base la reçoit, avec effet immédiat.
- **Images.** Seule une photo **choisie** doit exister et ne pas être archivée. Une photo archivée déjà en vigueur
  n'est qu'un avertissement ; « Rétablir » est permis. Une photo nommée par la présentation d'un exercice, actuelle
  ou dans l'historique, compte comme utilisée : l'onglet Images le dit et refuse de la supprimer.
- **Journal.** Deux actions : `editeur_presentation_exercice_application` et
  `editeur_presentation_exercice_retablissement`, avec les changements en clair. Un renommage depuis la liste est une
  application, dite « renommé depuis la liste ».
- **Suppression.** Supprimer un exercice (sans séance) emporte sa présentation et son historique.

## 8. Vérifications

- **`npm test` : 676 réussis, 0 échec.** En plus de l'existant :
  - le module pur, sur 14 cas ;
  - la liste blanche (racine et copie, champ nommé, copie inconnue, rien d'écrit) ;
  - **la séance épinglée** : titre, photo et note en vigueur ; même question, mêmes réponses attendues, correction
    juste ; la copie retirée par la version 2 garde les siennes ;
  - **l'attestation octet pour octet**, et **le titre de la nouvelle attestation** ;
  - **le titre en double** (appliquer, renommer, rétablir, première publication ; archivé et jamais publié ne
    comptent pas) ;
  - **la copie nouvelle** ;
  - l'instantané (publication et cascade) ;
  - les retouches en attente ;
  - **le rétablissement**, **le 409** et **le journal** ;
  - les images ; dupliquer et supprimer ;
  - **l'aller-retour de la Sauvegarde**, et l'import dans une autre base ;
  - la migration `0011` sur des données du serveur (rien d'autre ne bouge ; l'exercice servi est identique octet pour
    octet).

  **Des tests existants ont changé d'attente** : là où une version 2 était publiée pour changer le titre, elle l'est
  désormais pour une valeur, et le titre se change en direct. Une séance épinglée montre maintenant le titre en
  vigueur.
- **`npm run test:api`** : 34 étapes réussies. La nouvelle étape (33) fait sur la vraie D1 locale :
  - titre et note appliqués, vus sur l'accueil et par la version 1 de Camille ;
  - champ hors liste blanche → 400 ; titre pris → 400 ; 409 ;
  - « Rétablir » ; l'export porte l'historique.
- **Chrome** : 19 vérifications réussies ; aucune exception, aucune requête externe, seul le 401 attendu avant
  connexion.
  - Le panneau en tête de la page du M10 ; titre, cours et « À l'accueil » absents du brouillon ; une copie connue
    sans photo ni note ; une copie ajoutée depuis la banque, avec liseré doré, photo et note.
  - Un titre pris refusé à l'écran, le bouton inactif. Puis le M10 renommé en direct : l'aperçu suit, la confirmation
    liste le changement, le titre de la page suit.
  - **L'accueil** montre le nouveau titre. **La séance en cours de Camille** (version 1), rechargée, le montre dans sa
    barre, avec la même question.
  - **La photo de l'outil** de sa question changée, avec une note : visibles dans sa séance après rechargement.
  - **« Rétablir »** : la photo et la note d'avant reviennent, le titre reste.
  - « Renommer » depuis la liste : un titre pris refusé à l'écran, puis un renommage en direct, vu sur l'accueil.

  Les captures sont dans `captures/e5-3-presentation-exercices/` (hors dépôt).

## 9. Points à trancher

1. **Au déploiement, une séance épinglée à une version plus ancienne** montre tout de suite le titre, les photos et
   les notes de la dernière version (voir l'encadré du haut). C'est ce que dit « elle se pose par-dessus toute
   version » quand rien n'est appliqué. D'accord ?
2. **La republication ne vérifie plus le titre en double.** Une version publiée prend le titre en vigueur, déjà
   vérifié quand il est entré en vigueur. Un doublon d'avant D74 reste donc en place jusqu'à ce qu'un titre change en
   direct ; avant, il bloquait la prochaine publication de l'un comme de l'autre. D'accord ?
3. **La réémission après une correction d'identité (D37)** recopie l'enregistrement d'origine, **titre compris** :
   c'est le titre affiché à la réussite. D'accord ?
4. **L'écran de réussite d'un étudiant** : la barre du haut montre le titre en vigueur, l'attestation montre le sien,
   figé. Après un renommage, les deux diffèrent. Je propose de laisser ainsi : la barre nomme l'exercice, le document
   est une preuve. D'accord ?
5. **L'espace professeur** montre le titre en vigueur pour toutes les séances, réussies ou non, **export CSV
   compris**. Le titre inscrit sur une attestation ancienne peut donc différer de la colonne « Titre » ; le code relie
   les deux. D'accord ?
6. **Retouches en attente** : la règle « aucune version ni présentation ne l'a portée » a un angle mort. Un brouillon
   revenu à la valeur d'une vieille version n'est pas signalé ; la prochaine publication l'abandonne sans le dire.
   Acceptable ?
7. **Une copie retirée puis rajoutée sous le même identifiant** retrouve sa présentation en vigueur (sa photo et sa
   note d'alors), pas celles de la banque : la présentation la reconnaît à son identifiant. D'accord ?
8. **L'import** restaure la présentation telle quelle, **sans la règle du titre en double** (comme la cascade). Une
   restauration pourrait donc réintroduire un doublon, que tu règlerais en direct. D'accord ?

## Ce qui reste

- **Toi** : fusionner ; trancher les points ci-dessus. Après la fusion, ouvre la page de chaque exercice publié : un
  encadré doré y signale les retouches de présentation restées dans le brouillon, s'il y en a.
- **E5-4** : l'historique de la banque d'outils.
