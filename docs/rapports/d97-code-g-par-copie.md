# Rapport — le code G d'avance se règle sur la copie d'outil, pas dans les tables (décision D97)

> **Correction des séances en cours (D75, point 7) : aucun changement au déploiement.** Une séance est épinglée à sa
> version d'exercice (D47). Toutes les versions publiées à ce jour ont des copies d'outil **sans** `code_avance`, et
> aucune version de tables n'a été publiée depuis D96 (A2026_r6 n'a jamais porté de code) : avant comme après, la
> vitesse d'avance y est demandée selon l'état de l'exercice, sans pastille, sans mot F, sans ligne de programme. Le
> témoin produit par le code d'avant D96 reste vert, octet pour octet (§2), et un test rejoue une séance commencée sur
> une version sans code après la publication d'une version 2 avec codes. Les tolérances, les formules et les textes de
> l'attestation ne changent pas ; le spécimen garde sa forme. **Aucune migration de la base.**
>
> Ce qui change tout de suite, pour toi seulement : l'onglet Tables de référence relit le brouillon **sans** les codes
> que D96 y avait préremplis (et peut-être enregistrés) ; « Annuler les modifications » est inactif si rien d'autre ne
> diffère de A2026_r6 ; la colonne « Code G d'avance » et l'avertissement machine disparaissent. Les feuilles de
> référence sont celles d'avant D96, qui ne montraient de toute façon rien pour A2026_r6. **Ce qui changera pour les
> étudiants vient de tes gestes (§4)** : régler l'avance programmée des copies d'un exercice, puis le publier — seules
> les nouvelles séances prennent cette version.

Branche `code-g-par-copie`, depuis `main` à d957e1a (D96 fusionnée et déployée). Trois commits : la décision et le
PLAN ; le code (moteur, serveur, écrans, Gestion du contenu, feuilles, tests) ; les documents et ce rapport. Le code
tient en un seul commit parce que ses tests se croisent : un commit « moteur seul » laissait rouges les tests d'écran
de D96, et leur réécriture suppose les nouveaux écrans.

## 1. Ce qui a été fait

**La décision.** D97 est écrite dans `DECISIONS.md` (D96 n'est pas réécrite : D97 dit ce qu'elle remplace, ce qu'elle
garde, ses précisions proposées). SPEC §3 (la clé de l'outil, les tables sans code, le brouillon égaré), §5, §6, §7,
§8, §10 ; UI §3.3, §3.4, §3.5 (les feuilles telles qu'avant D96), §3.6, §3.9 (la liste « Avance programmée », la
pastille grise, « Avance programmée de la sélection… », l'onglet Tables sans colonne) ; CLAUDE.md ; PLAN.

**Le moteur** (`site/js/code-avance.js`, pur, le même des deux côtés). Le code est lu sur l'**outil** : `feedCodeOf`,
`hasFeedCode`, `feedCodeErrors` (G94, G95, G98, G99 ou absent — tout autre texte est une erreur sur « code_avance »),
`feedRateApplies` et `inapplicableFields` (Vf sans objet en G95 et G99 ; demandée en G94, G98 et sans code),
`withFeedCode` (pose la clé après `fact_av`, la retire pour « Aucune », sans modifier l'objet reçu), `stripFeedCodes`
(retire un `code_avance` resté sur une opération des tables), `FEED_CODE_CHOICES` (les cinq choix de la liste),
`ownFeedCodeLabel` (« aucune » ou le code). Gardés de D96 tels quels : le mot F (`fWordField`, montré dès la question),
« sans objet » et sa note, `programCoordinate` (d'après la direction d'avance de l'opération) et `programLines`,
`inapplicableGradedError` (Vf seule évaluée avec une copie par tour : refusé, les outils nommés).

**La validation, des deux côtés.** `TOOL_KEYS` porte `code_avance` ; `toolErrors` appelle `feedCodeErrors` ; la
validation des opérations de D96 (« les quatre codes, toutes ou aucune ») est retirée ; `OPERATION_FIELDS` ne nomme
plus le code. `validateExercise` (format fichier) accepte `outils[].code_avance` sur une entrée (**proposé**, `// ❓`,
point 1) et refuse « Vf seule » avec une copie par tour ; `draftErrors` (format enregistré) de même ; `copyOfTool`
recopie le code de sa source (la banque, une autre copie, l'entrée du fichier).

**Le serveur.** `seance.js` : la question porte `outil.code_avance` (seulement quand il y en a un) et le champ Vf
`{ evalue: false, sans_objet: true, texte: '' }` pour une copie par tour, quoi que l'exercice dise de Vf ; la correction
la laisse de côté (ni demandée ni corrigée, comptée juste, jamais sa valeur) et rend la ligne de programme ;
`reponses_test` ne la contient pas. `attestation.js` inscrit « s.o. » (inchangé). `editeur.js` : l'aperçu nomme
« sans objet » d'après la copie ; `cleanTables` retire un code égaré. `index.js` : le brouillon des tables se lit par
`stripFeedCodes(prefillSpeedFactors(…))` — plus de préremplissage de codes, plus d'avertissement, plus de ligne de
différences ni d'impact en cascade. Un code resté dans le brouillon enregistré sous D96 est ignoré à la lecture et
retiré au prochain enregistrement ; `modifie` reste faux ; aucune migration.

**Les écrans des étudiants** (`question-screen.js`, inchangé depuis D96) : la pastille sous l'opération, le mot F au
coin supérieur droit de la case, Vf « sans objet » avec sa note, la ligne de programme au corrigé — d'après la copie.
Une copie sans code donne l'écran d'avant D96, dans le même exercice. `feedCodeBadge` est dans `dom.js`.

**Les feuilles** : `reference-screen.js` et `sheets.css` sont rétablis **mot pour mot** à leur état d'avant D96
(commit 86e6f64) — plus de colonne « Code G » sur la feuille des avances, grille comprise ; plus de rangée « Mot F »
sur la feuille des formules ; la note de Vf d'avant. `sheets-data.js` : `feedSheet` sans codes.

**La Gestion du contenu** (`editeur.js`, `editeur-data.js`, `editeur.css`). Le formulaire d'outil, banque et copie, a
le groupe **Avance programmée** après « Facteurs » : la liste « Aucune », « G94 · fraisage, par minute », « G95 ·
fraisage, par tour », « G98 · tour, par minute », « G99 · tour, par tour », avec sa note (différente dans la banque :
la valeur de départ d'une copie ajoutée). Sur la ligne repliée d'une copie, la **pastille grise** du code (rien pour
« Aucune », pas de doré), rafraîchie à la frappe. À côté de « Tout cocher » et « Retirer la sélection », **« Avance
programmée de la sélection… »** (« … (3)… » avec trois outils cochés ; inactif sans sélection) ouvre une rangée — la
liste, Appliquer, Annuler — qui règle toutes les copies cochées en une fois ; ça ne change que le brouillon. La
publication résume « MVLNR (mvlnr) — avance programmée : « aucune » → « G99 » » ; l'historique de la banque et
`bankToolDiff` de même ; l'export et l'import portent la clé. L'onglet Tables de référence a retrouvé ses huit colonnes,
sans avertissement ; sa lecture ignore une clé `code_avance` égarée. En consultation, la liste est dans le
`fieldset` en lecture seule, sans rangée de sélection.

## 2. Tests et non-régression

`npm test` : **925 tests, fail 0**. `npm run test:api` : 36 étapes, 0 échec. Le témoin `tests/instantanes/avant-d96.json`
et `tests/non-regression-d96.test.js` sont **inchangés** et verts (comme `avant-d83`) : un exercice dont les copies
n'ont pas de code se corrige et s'affiche exactement comme avant D96, avec n'importe quelle version de tables.

**Le test demandé** (point 3 de D97) est dans `tests/worker-code-avance.test.js` : pour une copie en G99, aucune Vf
dans aucune réponse de l'API — la question, la correction, sa ligne de programme, la séance rendue, l'attestation, le
mode test — et aucune valeur masquée non plus (une grandeur masquée s'écrit « — » dans la ligne de programme).

**Tests de D96 retirés ou réécrits, et pourquoi** — ils vérifiaient un code porté par les tables, ce que D97 retire :

- `tests/code-avance.test.js`, réécrit : retirés, les cas de `validateTables` (les quatre codes, « toutes ou aucune »),
  du préremplissage du brouillon, de `feedCodeWarnings` (l'avertissement machine), des lignes de `tablesDiff`, de
  `feedRateImpact` et de la colonne de `feedSheet`. À la place : `withFeedCode`, `stripFeedCodes`, et l'assurance que
  `cleanTables`, `validateTables`, `tablesDiff`, l'impact et `feedSheet` ne portent **rien** ; `copyOfTool` et
  `draftFromExercise` ; `questionView`, `gradeQuestion`, `correctionView`, `normalizedAnswers`, `previewQuestions`
  sur un exercice à cinq grandeurs mêlant G99, G94 et sans code.
- `tests/worker-code-avance.test.js`, réécrit : retirés, la publication de tables avec codes, la cascade et son
  impact, le brouillon prérempli. À la place : trois copies (G99, G94, sans code) dans un même exercice ; « sans
  objet » par-dessus « donnée » et « masquée » ; l'attestation, le spécimen, la démo, l'aperçu ; la banque (valeur de
  départ, différence, historique, code illisible), la validation « Vf seule », l'export et l'import ; le brouillon des
  tables avec un code égaré (inséré par SQL, comme D96 l'aurait laissé) relu sans lui, `modifie` faux ; la séance
  épinglée.
- `tests/ui-code-avance.test.js`, réécrit : retirés, la colonne de la feuille des avances et la rangée « Mot F ». À la
  place : les écrans des trois copies contre le vrai Worker, « les feuilles ne portent rien du code G », le badge, les
  feuilles de style (`.badge-code-g`, plus d'`.avis-code-g`, `sheets.css` sans `feed-grid--codes`).
- `tests/ui-enseignant.test.js` : les contrôles de la colonne de l'onglet Tables retirés ; à la place, le formulaire
  d'outil (la liste et ses cinq choix, la pastille cachée, le bouton de sélection, la rangée fermée) en administration,
  et la liste dans le `fieldset` désactivé en consultation.
- `tests/worker-api.test.js` : le cas de D96 (un exercice sur des tables avec codes) réécrit pour une copie qui porte
  `code_avance: 'G99'` au format fichier, sur A2026_r0.
- `tests/worker-facteurs.test.js` et `tests/worker-tables.test.js` : les retouches de D96 (des attentes sur un brouillon
  prérempli de codes) annulées ; ces fichiers sont ceux d'avant D96.

## 3. Vérifications dans Chrome (1366 × 768 et 390 × 844)

Scénario piloté par CDP contre un wrangler dev jetable (`MODE_TEST`), **31 vérifications, 0 échec, aucune erreur de
console, aucune exception, aucune requête externe** ; captures dans `captures/d97-code-g-par-copie/` (hors dépôt).
La semence du scénario : les tables publiées comme A2026_r1 (avec leurs facteurs, comme en production), puis le
brouillon **enregistré avec des codes égarés** — relu sans aucun code, « mêmes valeurs que sa version », rien à
annuler ; un exercice à cinq grandeurs avec MVLNR et la lame en G99, le foret en G94, la fraise et l'alésoir sans code.

- La question d'une copie en G99 : la pastille « G99 · avance par tour », le mot F au coin de la case de f (la valeur
  reste entière à 1366), Vf « sans objet » avec sa note, quatre cases, rien ne déborde à 390 ; le corrigé : « G97 S… M03 »
  puis « G99 G01 Z… F… », la coordonnée en gris, le mot F en doré, la note.
- La copie en G94 : « G94 · avance par minute », le mot F sur Vf, cinq cases ; le corrigé : « G94 G01 Z… F… ».
- La copie sans code, dans le même exercice : ni pastille, ni mot F, ni « sans objet », cinq cases, pas de ligne de
  programme — l'écran d'avant D96.
- La feuille des avances : la grille d'avant D96, sans colonne ni pastille ; la feuille des formules : sans rangée
  « Mot F », la note de Vf d'avant.
- La page de l'exercice : la pastille grise « G99 » sur MVLNR et la lame, « G94 » sur le foret, rien sur la fraise et
  l'alésoir ; le formulaire de MVLNR, la liste sur G99 dans son groupe ; MVLNR passé en G98 par sa liste, la pastille
  suit ; la fraise et l'alésoir cochés, « Avance programmée de la sélection (2)… », G99, Appliquer : les deux passent
  en G99, les autres ne bougent pas, la rangée se ferme ; « Publier… » résume « G99 » → « G98 » pour MVLNR et
  « aucune » → « G99 » pour la fraise et l'alésoir.
- L'onglet Tables de référence : ni colonne « Code G d'avance », ni avertissement ; « Annuler les modifications »
  inactif.

Une retouche après les captures : le bouton « Appliquer » de la rangée portait le contour rouge de « Retirer » ; il a
le style neutre des petits boutons (↑, ↓, Dupliquer).

## 4. Tes gestes en production

1. **Tables de référence** : ouvre l'onglet. « Annuler les modifications » doit être inactif (le brouillon relu égale
   A2026_r6). S'il est actif, autre chose diffère : regarde avant d'annuler. Rien à publier pour D97.
2. **Banque d'outils** : pour chaque outil, « Avance programmée » (G99 pour un outil du tour, G94 pour la fraiseuse,
   ou Aucune), puis Enregistrer. Ça ne change aucun exercice : c'est la valeur de départ des copies ajoutées ensuite.
3. **Chaque exercice** : Tout cocher, « Avance programmée de la sélection… », le code, Appliquer ; règle à la pièce
   ce qui diffère (la liste de la copie) ; Enregistrer le brouillon ; Publier… — le résumé nomme chaque copie
   changée. Un exercice qui n'évalue que Vf avec une copie par tour est refusé : évalue une autre grandeur, ou laisse
   « Aucune ».
4. Les séances déjà commencées gardent leur version ; seules les nouvelles séances voient le code. Rien n'oblige à
   déployer hors des périodes de labo pour D97, mais la règle reste la bonne.
5. `test-complet` (local, `npm run publier:test-complet`) n'a pas de code : rien à faire.

## 5. Points douteux, à trancher

1. **Le format fichier (§10)** : `outils[].code_avance` sur une entrée de catalogue est **proposé** (`// ❓` dans
   `TOOL_ENTRY_KEYS`, `exercice.js`) — les tests en ont besoin (le cas de l'API, `test-complet` si tu veux un jour y
   mettre un code), et un fichier peut ainsi régler ses copies. À accepter, ou à retirer (le cas de l'API passerait
   alors par la Gestion du contenu).
2. **« Sans objet » l'emporte** sur « donnée » et « masquée » (gardé de D96) : une copie en G99 dans un exercice qui
   donne Vf ne la montre pas du tout, et la ligne de programme écrit F avec f (ou « — » si f est masquée).
3. **La ligne de différences** porte des guillemets, « avance programmée : « aucune » → « G99 » », comme les autres
   lignes des copies ; l'exemple de D97 n'en avait pas. À garder ou à épurer.
4. **La coordonnée** de la ligne de programme vient toujours de la direction d'avance de l'opération (règle de D96).
   D97 ne déduit rien de la machine : une copie en G94 sur un outil du tour n'a aucun avertissement, nulle part — les
   libellés « tour » et « fraisage » de la liste sont le seul guide. Voulu ?
5. **La banque enregistre un code illisible** avec son erreur (comme ses autres champs, D48) ; une copie ajoutée
   depuis cet outil le porte, et l'exercice le signale. Cohérent, mais à savoir — seul l'import ou un export retouché
   peut produire un tel code, la liste ne propose que les cinq choix.
6. **« Avance programmée de la sélection… »** n'existe que sur la page d'un exercice ; la banque n'a pas de sélection,
   chaque outil s'y règle un par un (point 2 de §4). Si tu veux régler toute la banque d'un coup, c'est une autre tâche.
7. **Le groupe « Avance programmée »** du formulaire est un groupe à part, après « Facteurs », sur une colonne.
   Placement et notes à relire (la note de la copie dit ce que l'étudiant voit ; celle de la banque, la valeur de
   départ).
8. **Le mot F** reste au coin supérieur droit de la case (retouche de D96) ; rien n'a changé.
9. **Un export de D96** qui porterait `code_avance` sur les opérations des tables s'importe sans eux (`cleanTables`) ;
   vérifié par le test du module, pas par un import complet dans Chrome.
10. **`seance.question` envoie `outil.code_avance`** : c'est une donnée de présentation, pas une grandeur à trouver —
    conforme à SPEC §7 ; à confirmer.
11. **Le témoin `avant-d96.json`** garde son nom bien que D97 remplace D96 : il reste le témoin de « l'écran sans code »,
    valable pour D97 ; renommer casserait l'historique pour rien.
12. **Les sept `demo-<id>`** du lot (D84) et les exercices de D96 n'ont jamais eu de code : rien à reprendre.
