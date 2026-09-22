# Rapport — exercice « M10 — Tournage : Vc et RPM » et liste des questions sur l'attestation

Session du 2026-09-22, après la mise en production du jalon 5, en deux temps : le travail (huit
commits, un par point), puis les réponses de Thierry aux points douteux (six commits). Branche
`exercice-vc-rpm` à partir de `main` à jour, rien de poussé. `npm test` : 443 tests, `fail 0` ;
`npm run test:api` : 18 étapes, une minute. Décisions D40 à D43.

## Première partie — ce qui a été fait

## A. Nouvel exercice « M10 - tournage - Vc et RPM »

1. *Fichier* `site/exercices/m10-tournage-vc-rpm.json`, inscrit à l'index et **listé** à l'accueil
   (capture `1280-01-accueil-liste`). `champs_evalues` : `["vc", "n"]` — rien d'autre.
2. *Onze outils*, dans l'ordre demandé : `foret_a_pointer` ; `foret_fractionnaire`, `foret_a_numero`,
   `foret_a_lettre`, `foret_metrique`, `foret_udrill` ; `barre_a_aleser` ; `sdtmr`, `sdtmr_2`,
   `barre_a_fileter`, `barre_a_fileter_2`. Pour « jobber », j'ai pris `foret_fractionnaire`
   (Ø 1/64 à 1 po) et `foret_metrique` (Ø 0.05 à 15 mm), dont le commentaire du catalogue dit
   « Le jobber lenght » — pas les `_2` (> 1 po, > 15 mm, « pré-percer pour dégager l'âme »).
3. *Matière de l'outil* : le schéma ne permettait la restriction que par outil. Nouvelle clé
   facultative **à la racine** de l'exercice, `materiaux_outil` (D40), validée au chargement :
   noms du catalogue, sans doublon, non vide ; croisée avec les matières de l'outil et, s'il y en
   a une, avec la restriction de l'entrée. Un outil qui n'aurait **plus aucune matière permise**
   rend l'exercice invalide au chargement : « outils[0] « mvlnr » : plus aucune matière d'outil
   permise — l'outil offre Insert de carbure de tungstène ; l'exercice permet Acier rapide ». Ici :
   `["Acier rapide", "Insert de carbure de tungstène"]` ; le carbure solide, que le catalogue
   offre sur les six forets, ne sort jamais (testé sur 2 000 tirages, sur la séance simulée et sur
   le parcours par l'API).
4. *Matériaux usinés* : aucune restriction, tous les groupes de chaque outil (vérifié outil par
   outil contre le catalogue).
5. *Réussites* : 2 de suite par outil, 22 questions (séance simulée sans erreur : exactement 22).
6. *Ce qui existe s'applique* : parcours complet en mode test à l'écran (Remplir, Vérifier,
   Question suivante, deux erreurs volontaires) jusqu'à l'attestation, dans Chrome. Vérifié par
   des tests dans cet exercice : **N en filetage** de −90 % à +0,1 % (SDTMR 1/2-13 UNC, 1020,
   insert : 3000 rév/min plafonné ; 1500 et 300 acceptés, 299 et 3004 refusés ; ligne de
   correction « de −90 % à +0.1 % » ; un foret garde « ±5 % et ±1 rév/min ») ; **barre à aléser**
   à deux diamètres (N avec le Ø alésé — 400 × 4 / 2 = 800, pas 1600 avec la barre de 1 po —,
   ligne « N = Vc × 4 / Ø usiné = … », avance fournie calculée avec la barre, toute question tirée
   pour cet outil porte sa barre et son gabarit « Barre à aléser Ø … - Ø alésé: … »).

## B. Attestation : liste exacte des questions réussies

1. *Contenu* (D41). L'enregistrement figé porte `questions` : pour chaque outil, ses `reussites`
   dernières questions réussies — la série finale ; comme un échec remet le compteur à zéro,
   elles sont toujours postérieures au dernier échec de l'outil (et à une remise à zéro) —, le
   tout dans l'ordre chronologique. Chaque entrée : `numero` (rang de la question dans la
   séance, ratées comprises), `outil_id`, `outil` (le gabarit résolu tel qu'affiché, avec
   dimension, Ø de barre et dents quand le gabarit les porte), `materiau_outil`, `materiau`
   (classe, groupe, nom, état), `reponses` (les saisies de l'étudiant, telles quelles, aux
   grandeurs évaluées seulement), `horodatage`. Testé : avec un échec toutes les quatre questions,
   la liste a exactement 15 entrées (le M10), chacune après le dernier échec de son outil ; le
   total `questions_reussies`, lui, compte tout.
2. *Signature et QR*. La liste entre dans la sérialisation canonique signée : un `numero`
   retouché en base rend l'attestation « invalide » même par le code seul. Le QR ne change pas.
   `/verifier` montre la liste complète (lignes repliables, rien de tronqué) sous le tableau
   par outil. **Pas de migration** : le journal `corrections` contenait déjà la question
   complète, les saisies, le résultat champ par champ et l'horodatage.
3. *Tableau par outil* : inchangé, au-dessus, comme résumé.
4. *Mise en page*. Une page lettre quand ça tient, sinon la suite sur une deuxième page avec
   l'en-tête du département, une ligne de rappel (nom, matricule, code, « suite ») et le pied
   « Page n de N » ; le QR, le code et le tableau par outil restent en première page, dont le
   titre de liste dit « — suite à la page suivante ». Lignes d'une seule hauteur (20 px, sans
   repli) ; la coupe est un calcul pur (`paginateQuestions`, `PAGE_LAYOUT`) calibré sur la page
   mesurée dans Chrome : 460 px libres sur la page 1 pour les lignes d'outils (24 px) et de
   questions (20 px), 36 questions par page de suite. « Vc et RPM » : 9 questions en page 1,
   13 en page 2 ; le M10 : 12 + 3. Le mode test parcourt l'exercice A jusqu'à l'attestation
   (captures).
5. *Anciennes attestations* : un enregistrement sans `questions` reste tel quel, se vérifie
   (testé : signé par l'ancien serveur, rendu sans y toucher, « valide ») et s'affiche sans la
   liste. La réémission (D37) reprend la liste telle quelle.
6. *Collision de code à la réémission* (D42) : `moveSession` distingue le matricule pris (409,
   inchangé) du code pris (un autre est tiré, jusqu'à cinq fois). L'aléa des codes est
   injectable (`tools.randomBytes`) : le test force la collision à la réussite et à la réémission.

## C. Livraison

- DECISIONS D40 à D42 ; SPEC v0.6 (§7 table `attestations`, §8 enregistrement et page, §10 clé
  `materiaux_outil` et l'exercice) ; UI §3.6 (liste, deux pages), §3.7, §4, §6 ; PLAN (section
  « Après le jalon 5 ») ; CLAUDE.md (restriction de matière, rapports hors jalon).
- Tests ajoutés (25) : restriction de matière (validation, tirage, messages) ; exercice A
  (validation, tirage, séance simulée, filetage, barre, parcours complet par l'API en mode test) ;
  liste des questions (pure : série finale, numéros, réponses, sérialisation ; API : avec échecs,
  ancienne attestation sans liste, réémission, reconstitution) ; collision de code ; colonnes,
  lignes, pagination, rappel de page. `test:api` : étape 17, l'exercice A par HTTP (N calculée
  comme l'étudiant), attestation avec ses 22 questions, vérification par le code.
- **Chrome** (wrangler jetable, `MODE_TEST:1`, `CADENCE_S:1`), captures dans
  `captures/exercice-vc-rpm/` (hors dépôt, 14 images et `attestation.pdf`) : accueil avec la
  liste, accueil de l'exercice, première question en mode test, filetage, question réussie,
  question ratée, barre à aléser, **attestation sur deux pages** (1280), média print à 720 px,
  **PDF de deux pages**, attestation à 390 px (haut et défilée), `/verifier` avec la liste
  (1280 et 390), reprise sur téléphone depuis un second contexte. 197 requêtes, **aucune
  externe**, aucune exception, aucune erreur console.

## Commits de la première partie (branche `exercice-vc-rpm`, dans l'ordre)

1. Restriction de matière d'outil pour tout l'exercice (materiaux_outil, D40)
2. Nouvel exercice « M10 - tournage - Vc et RPM » (D40)
3. L'attestation liste les questions réussies qui comptent, depuis le journal (D41)
4. Réémission : un code d'attestation déjà pris est retiré (D42)
5. Page de l'attestation et /verifier : liste des questions réussies, sur une ou deux pages (D41)
6. test:api étendu à l'exercice « Vc et RPM »
7. Docs : décisions D40 à D42, SPEC (v0.6), UI, PLAN, CLAUDE.md
8. Rapport de session

## Points douteux de la première partie (tranchés : D43)

1. Le numéro était le rang de la question dans la séance, ratées comprises → **rang dans la liste**.
2. Titre « M10 - tournage - Vc et RPM » → **aligné sur le M10**.
3. « À partir de cette version » : la liste s'ajoute à toute attestation composée désormais, y
   compris la reconstitution d'une séance réussie avant le jalon 5 — conservé.
4. Libellés tronqués sur la page lettre → **plus jamais de troncature**, repli.
5. `test-complet` (29 outils, cinq grandeurs) : liste en page 2, colonne du matériau écrasée — avec
   le repli, elle n'est plus écrasée mais très haute (jusqu'à 6 lignes par rang) ; exercice d'essai.
6. Pagination par constantes → **acceptée**, constantes et police dans UI §3.6.
7. Réponses telles que saisies → **normalisées**.
8. Impression papier non faite ; PDF de deux pages par Chrome — inchangé.
9. `witch main` n'était plus là.

## Seconde partie — réponses appliquées (D43)

1. *Numéro* : la liste est numérotée de 1 à n, dans l'ordre chronologique ; le rang dans la séance
   ne sort plus (tests : pure, API — « sans trou », chronologie par l'heure).
2. *Titre* : « M10 — Tournage : Vc et RPM » (fichier, index, tests, docs ; D40 conserve l'ancien
   titre, D43 le remplace).
3. *Repli* : plus de `text-overflow`, `overflow-wrap: anywhere` dans les cellules d'outil, de matière
   et de matériau ; un rang de deux lignes fait 33 px (7 + 2 × 13). La pagination estime les lignes
   de chaque rang (`questionRows` calcule `lines` à partir des largeurs de colonnes et d'une
   largeur de caractère prise avec marge, 4,6 px pour 4,0 mesurés) et `paginateQuestions` compte
   en pixels, sans jamais couper un rang. Colonne « Matière d'outil » élargie à 90 px (« Insert de
   carbure » tenait à un pixel près). Vérifié dans Chrome sur le M10 et sur « Vc et RPM » : rangs de
   20 et 33 px, `scrollHeight` = `clientHeight` sur toutes les pages, « Cuivre et alliages de
   cuivre, Haute résistance en traction, Ampco » entier sur deux lignes (capture
   `1280-08-attestation-deux-pages`, rangs 7, 8, 12, 14, 21, 22).
4. *Constantes et police* consignées dans UI §3.6 : page lettre 720 × 960 px utiles, Carlito
   9,5 px, 460 px libres en page 1, 740 px en page de suite, 24 px par ligne d'outil, 7 + 13 px par
   ligne de question, largeurs des colonnes, 4,6 px par caractère ; consigne de recalibrer
   (mesurer, puis vérifier qu'aucune page ne déborde) si la police d'impression change.
5. *Réponses normalisées* au figeage (`normalizedAnswers`) : le nombre lu par `parseAnswer` (point
   ou virgule, espaces ignorés), écrit par `formatParameters` pour la grandeur — « 400,0 » → « 400 »,
   « 1 600 » → « 1600 », « ,004 » → « 0.0040 », « .0769 » en filetage → « 0.07690 », « 6,4 » →
   « 6.400 » ; une saisie illisible (impossible sur une question réussie) resterait telle quelle.
6. *Tests* (+2, dont un réécrit) : numérotation 1 à n (pure et API), repli (`lines`, largeur de
   colonne du matériau selon le nombre de grandeurs, rang de deux lignes, nom d'outil long,
   pagination en pixels avec rangs doubles), réponses normalisées (les cinq grandeurs, filetage,
   illisible). `npm test` : 443, `fail 0`. `test:api` : 18 étapes. **Chrome** relancé : mêmes
   14 captures et le PDF refaits dans `captures/exercice-vc-rpm/` — accueil avec le nouveau
   titre, parcours en mode test, attestation sur deux pages (7 rangs en page 1 dont deux repliés,
   15 en page 2), média print, PDF de deux pages, 390 px, `/verifier` ; 197 requêtes, aucune
   externe, aucune erreur console.

## Commits de la seconde partie (dans l'ordre)

9. Liste des questions : numérotée de 1 à n, plus par le rang dans la séance (D43)
10. Titre de l'exercice aligné sur le style du M10 : « M10 — Tournage : Vc et RPM » (D43)
11. Attestation : plus de troncature, repli dans la cellule et pagination en pixels par rang (D43)
12. Liste des questions : réponses normalisées au figeage (D43)
13. Docs des réponses au rapport : D43, SPEC, UI (constantes de pagination et police), PLAN
14. Rapport mis à jour

## Reste

Rien à trancher. Avant de fusionner : relire D43 et UI §3.6.
