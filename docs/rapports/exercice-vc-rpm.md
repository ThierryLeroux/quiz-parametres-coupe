# Rapport — exercice « M10 - tournage - Vc et RPM » et liste des questions sur l'attestation

Session du 2026-09-22, après la mise en production du jalon 5. Branche `exercice-vc-rpm` à partir
de `main` à jour, huit commits (un par point), rien de poussé. `npm test` : 441 tests, `fail 0` ;
`npm run test:api` : 18 étapes, une minute. Décisions D40 à D42.

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

## Commits (branche `exercice-vc-rpm`, dans l'ordre)

1. Restriction de matière d'outil pour tout l'exercice (materiaux_outil, D40)
2. Nouvel exercice « M10 - tournage - Vc et RPM » (D40)
3. L'attestation liste les questions réussies qui comptent, depuis le journal (D41)
4. Réémission : un code d'attestation déjà pris est retiré (D42)
5. Page de l'attestation et /verifier : liste des questions réussies, sur une ou deux pages (D41)
6. test:api étendu à l'exercice « Vc et RPM »
7. Docs : décisions D40 à D42, SPEC (v0.6), UI, PLAN, CLAUDE.md
8. Rapport de session

## Points douteux, à trancher

1. **Le numéro** est le rang de la question dans la séance, ratées comprises (« 1, 2, 4, 5… ») :
   c'est ce qui rend la copie unique, mais on en déduit le nombre d'échecs, que l'écran ne
   montre jamais (UI §3.4). L'autre lecture — numéroter la liste 1..n — n'apporte rien.
2. **Titre** pris tel quel, « M10 - tournage - Vc et RPM » (tirets simples, minuscules), alors que
   le M10 s'appelle « M10 — Tournage : vitesse de coupe ». À harmoniser si tu veux.
3. **« À partir de cette version »** : la liste s'ajoute à toute attestation composée désormais,
   y compris la reconstitution d'une séance réussie avant le jalon 5 (son journal existe). Les
   attestations déjà figées ne bougent pas.
4. **Libellés tronqués** sur la page lettre : le matériau usiné le plus long (« Cuivre et
   alliages de cuivre, Haute résistance en traction, Ampco », 72 caractères) est coupé avec des
   points de suspension au-delà d'environ 50 caractères (4 matériaux sur 47) ; `/verifier` montre
   tout. Matière de l'outil en court (« Insert de carbure », « Carbure solide ») ;
   l'enregistrement garde le nom complet.
5. **`test-complet`** (29 outils, cinq grandeurs) : le tableau par outil remplit la page 1, la
   liste commence en page 2, et les cinq colonnes de réponses écrasent le matériau usiné. C'est
   l'exercice d'essai ; je n'ai rien fait pour lui.
6. **Pagination par constantes** mesurées dans Chrome avec Carlito auto-hébergée, pas par mesure
   du DOM à l'exécution : si la police ou la CSS de la page change, recalibrer `PAGE_LAYOUT` (une
   marge d'une ligne environ reste sur chaque page).
7. **Réponses telles que saisies** (« 400,0 » avec sa virgule, « 1 600 » avec son espace) : j'ai
   lu « valeurs acceptées » comme « les réponses de l'étudiant ». La valeur théorique est dans le
   journal si tu la veux à côté.
8. **Impression papier** non faite ; le PDF de deux pages vient de Chrome (`printToPDF`).
9. Le fichier parasite `witch main` du dernier rapport n'était plus là.
