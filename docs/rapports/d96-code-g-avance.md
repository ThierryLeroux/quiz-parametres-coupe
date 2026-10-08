# Rapport — le code G d'avance de chaque opération : G94/G95 en fraisage, G98/G99 en tournage (décision D96)

> **Correction des séances en cours (D75, point 7) : aucun changement au déploiement.** Les séances sont épinglées à
> leur version, et une version de tables d'avant D96 ne reçoit aucun code à la lecture : ses exercices se corrigent et
> s'affichent exactement comme avant — Vf demandée partout, aucun code G nulle part. Un témoin produit par le code
> d'avant le chantier le vérifie, octet pour octet pour l'attestation et le spécimen (§2). **Ce qui changera ensuite
> vient de tes gestes, pas du déploiement** : la publication des tables qui portent les codes, puis la cascade, créent
> de nouvelles versions, que seules les **nouvelles séances** prennent. Dans ces versions, la vitesse d'avance d'un outil
> du tour est « sans objet », la question montre la pastille du code G et l'étiquette « mot F », le corrigé la ligne de
> programme, et l'attestation inscrit « s.o. ». **Aucune migration de la base.** Les tolérances et les formules ne
> changent pas.

Session du 2026-10-08, branche `code-g-avance`, partie de `main` à jour (`86e6f64`). Poussée, pas fusionnée ; rien
n'a été lu ni écrit en production. Ta demande ne contredisait aucune décision fermée : je n'ai pas eu à m'arrêter.
Ce que D96 précise des décisions d'avant (D15, D52, D83, D85, D93) est écrit à la fin de D96.

## En bref

- **Chaque opération porte son code G d'avance** (`code_avance` : G94, G95, G98, G99), versionné comme les avances,
  sur le modèle du facteur de vitesse. Le brouillon des tables arrive **prérempli** : G99 au tour, G94 ailleurs ; tu
  révises, puis tu publies.
- **Pour un outil en G95/G99, Vf est sans objet** : ni demandée, ni corrigée, jamais envoyée ; « sans objet » à
  l'écran, « s.o. » sur l'attestation. Les quatre autres grandeurs ne changent pas.
- **L'écran** : la pastille « G99 · avance par tour » sous l'opération ; l'étiquette « mot F » sur la case de f (G95,
  G99) ou de Vf (G94, G98) dès la question ; au corrigé seulement, le panneau « Ligne de programme ».
- **Les feuilles** : une colonne « Code G » sur la feuille des avances ; la rangée « Mot F » sur la feuille des
  formules. L'attestation : « s.o. » dans la colonne Vf, les largeurs de D85 inchangées.
- **La Gestion du contenu** : une liste « Code G d'avance » par opération, l'avertissement machine doré, non bloquant,
  les différences d'une publication (« Opération « Dressage » — code G d'avance : — → G99 »), l'impact de la cascade.
- **Un exercice dont la seule grandeur évaluée est Vf, avec un outil du tour, est invalide** ; la cascade le nomme et
  le laisse tel quel.
- **Rien ne change pour ce qui existe** : témoin de non-régression d'avant D96.
- Tests : **925** (889 avant), 0 échec ; **Chrome** à 1366 et 390 px, aucune erreur console, aucune requête hors du
  site ; captures dans `captures/d96-code-g-avance/` (hors dépôt).

## 1. Ce qui a été fait, point par point

**1. Le code dans les tables.** Clé `code_avance` de chaque opération, l'une des quatre valeurs. **Des tables portent
les codes quand chacune de leurs opérations a le sien** (toutes, ou aucune : la validation refuse l'entre-deux, comme
pour les facteurs de vitesse — §6, point 2). Une version d'avant D96 n'en reçoit aucun à la lecture. Dans l'onglet
Tables de référence, tableau **Opérations**, la colonne **Code G d'avance** est une liste déroulante entre « Facteur
de vitesse » et « Pictogramme » ; une opération ajoutée part en G99 si sa machine est « Tour », G94 sinon. En
consultation, une version d'avant montre « — ». Les différences d'une publication le disent, opération par
opération ; l'impact d'un changement de tables pour un exercice aussi, suivi de « La vitesse d'avance devient sans
objet pour MVLNR (mvlnr)… : avance par tour (G95 ou G99). Elle n'est ni demandée ni corrigée. ».

**2. L'avertissement machine.** Doré, non bloquant, sous la liste des erreurs de l'onglet : « Opération « Dressage » :
G94 est un code de fraisage, mais sa machine est « Tour ». », « Opération « Perçage » : G99 est un code du tour, mais sa
machine est « Perceuse / Fraiseuse ». ». Il se met à jour à chaque changement de liste ; « Publier… » reste possible.
Aucune règle n'est déduite du nom de la machine, un texte libre (§6, point 9).

**3. Un exercice sans grandeur applicable.** `champs_evalues` réduit à `vf`, avec un outil dont l'opération est en
G95/G99 : « La seule grandeur évaluée, la vitesse d'avance, est sans objet pour MVLNR (mvlnr), Lame à tronçonner
(lame_a_tronconner) : leur opération est en avance par tour (G95 ou G99). Évalue une autre grandeur, ou retire ces
outils. » — sur `champs_evalues`, dans la Gestion du contenu comme sur le serveur (`draftErrors`, `validateExercise`).
À la publication des tables, la cascade le propose **en erreur**, non cochable, et le laisse tel quel, brouillon
compris (D77). Passé à la main aux nouvelles tables, son enregistrement rend l'erreur et sa publication est refusée.

**4. La correction.** `gradeQuestion` retire Vf des champs à corriger pour un outil en G95/G99 : elle compte comme
juste, quoi que le navigateur envoie (« abc » passe), et le contrôle de cohérence de D15 ne s'applique pas. Quand
l'exercice l'évaluait, son résultat porte `notApplicable`, ce que l'attestation lit pour écrire « s.o. ». Les valeurs
théoriques ne changent pas : Vf se calcule toujours, elle n'est simplement plus demandée.

**5. Ce que la question porte** (SPEC §7). `outil.code_avance` (« G99 »), seulement pour une version qui porte les
codes, toujours envoyé (il ne donne aucune réponse) ; dans `champs`, Vf d'un outil du tour arrive `{ evalue: false,
sans_objet: true, texte: "" }` — **quel que soit l'état que l'exercice lui donne** (évaluée, donnée ou masquée : §6,
point 1) — et sa valeur ne part jamais, même en mode test. Pour une version d'avant, la question d'avant, clé pour
clé. Le mode démo et l'aperçu suivent les mêmes règles (« sans objet » dans la cellule de l'aperçu).

**6. L'écran Question.** Sous la ligne de l'opération, la **pastille** `G99 · avance par tour` : fond presque noir,
liseré fin au bleu clair, chasse fixe, le code en bleu clair ; ses couleurs sont les variables `--code-g-*` de
`tokens.css`, les mêmes dans les trois espaces (le test des ambiances le vérifie, contrastes AA compris : 9,6 pour le
code, 15,6 pour le texte, 7,5 pour le gris de la coordonnée, 11,9 pour le doré du mot F). **« mot F »** sur la case de
f (G95/G99) ou de Vf (G94/G98), **dès la question** — un essai, à évaluer en classe (§6, point 7) ; une seule
constante le réserve au corrigé. La case Vf d'un outil du tour est remplacée par **« sans objet »**, en italique
atténué dans le cadre d'une case grisée, avec la note « En G99, F est l'avance par tour. » ; après la correction, telle
quelle. Le mode test remplit quatre cases, jamais Vf.

**7. Le corrigé.** Le panneau **« Ligne de programme »**, sous le questionnaire, jamais avant « Vérifier » : « G97 S333
M03 » puis « G99 G01 Z… F0.0050 » au tour, « G97 S2400 M03 » puis « G94 G01 X… Y… F28.800 » à la fraiseuse — recomposées
par le serveur des valeurs théoriques mises en forme, la coordonnée d'après la direction d'avance de l'opération
(longitudinale et axiale « Z… », transversale « X… », latérale « X… Y… »), en gris atténué ; le mot F en doré ; la note
« S = N. F = f, en po/tour. » ou « S = N. F = Vf, en po/min. » dessous. Une grandeur masquée s'y écrit « — » (« G97 S—
M03 »), et sa valeur ne part pas.

**8. Les feuilles.** Feuille des avances : la colonne **« Code G »** entre le pictogramme et la barre, une pastille
par opération sur deux lignes (le code, puis « par tour » ou « par minute ») ; la grille est recalibrée (l'opération et
la note perdent 12 px, la barre 48) et la feuille tient sur une page lettre, à l'écran comme à l'impression (un PDF
d'une page). Feuille des formules : après Vf, la rangée **« Mot F »** — « G94 / G98 : F = Vf (po/min) », « G95 / G99 :
F = f (po/tour) » — avec la note sur le système A de Fanuc ; la note de Vf dit les deux cas. Une version d'avant garde
ses feuilles, colonne pour colonne et mot pour mot. La feuille des facteurs ne change pas.

**9. L'attestation.** L'enregistrement figé porte `reponses.feedRate = "s.o."` pour une question dont l'outil est en
G95/G99 quand l'exercice évalue Vf ; la page le montre tel quel, « s.o. » dans la colonne Vf. Les largeurs de D85 ne
changent pas ; la coupe des pages a été vérifiée en mode impression sur un exercice à cinq grandeurs mêlant tour et
fraiseuse (six outils, six questions : une page, le pied dans la zone utile). Ni code G ni ligne de programme sur
l'attestation. Un spécimen d'une version qui porte les codes porte « s.o. » de même ; un spécimen déjà imprimé d'une
version d'avant reste valide.

**10. Les documents.** D96 ; SPEC §3 (le code, ses règles), §5, §6, §7 (la question, la correction, la ligne de
programme), §8 (« s.o. »), §10 (la validation) ; UI §3.3, §3.4, §3.5, §3.6, §3.9 ; CLAUDE.md ; PLAN.

## 2. Non-régression

`tests/instantanes/avant-d96.json` (229 Ko) a été produit **par le code de `main`, avant toute retouche** (`86e6f64`),
puis figé ; `tests/non-regression-d96.test.js` rejoue le scénario avec le code d'aujourd'hui et compare. Des tables
qui portent les facteurs de vitesse **sans aucun code G** — comme A2026_r6 en production —, publiées sous A2026_r1 :

- le moteur sur `test-complet` (les 29 outils, les cinq grandeurs) : la question rendue au navigateur, les réponses du
  mode test, les valeurs attendues, la correction d'une bonne et d'une mauvaise réponse (chaque ligne de calcul, Vf
  comprise), l'aperçu, la feuille des avances et ses onglets, un spécimen ;
- le vrai Worker sur un exercice à cinq grandeurs qui mêle le tour et la fraiseuse : chaque étape d'une séance entière,
  l'attestation — **son enregistrement, le texte que la signature couvre, la signature et l'adresse du QR, octet pour
  octet** —, la séance relue, l'exercice servi, les tables servies, une démo avec sa correction et son spécimen.

Il est vert à chaque commit de la branche. Un autre test vérifie qu'une séance commencée **avant** la publication des
tables qui portent les codes garde, après elle, sa question (Vf demandée, aucun code) et sa correction (sans ligne de
programme), et qu'une nouvelle séance prend la version de la cascade.

**Tests d'avant retouchés**, et pourquoi — aucun pour cacher un écart : le brouillon des tables se lit désormais
prérempli des codes aussi (le test de D83 retire la clé avant de comparer) ; l'impact d'une cascade dit le code de
chaque opération (le test de D83 regarde les lignes des facteurs seulement) ; un aperçu sur des tables publiées par
l'API n'a plus de Vf au tour (le test de D62 la retire des réponses attendues quand la question dit « sans objet »).

## 3. Vérifications

- `npm test` : **925 tests, 0 échec**. Nouveaux : `code-avance` (le module pur, la validation des tables et des
  exercices, les différences, la question, la correction, l'attestation, l'aperçu, les feuilles, l'impact),
  `worker-code-avance` (le serveur : la question et la correction d'un outil du tour et d'un outil de fraiseuse,
  aucune Vf d'un outil en G95/G99 dans aucune réponse — mode test et ligne de programme compris —, aucune valeur
  masquée, « sans objet » qui l'emporte sur donnée et masquée, l'attestation et sa vérification, le spécimen, la
  démo, l'aperçu, le brouillon prérempli, la publication et ses différences, la règle du point 3 et la cascade, la
  séance épinglée), un cas dans `worker-api`, `ui-code-avance` (la pastille, le mot F, « sans objet », la ligne de
  programme, les feuilles, les feuilles de style, sur le DOM minuscule contre le vrai Worker), `ui-ambiances` (les
  variables `--code-g-*`, identiques dans les trois espaces, contrastes AA), `ui-enseignant` (la liste par opération,
  « — » en consultation), `non-regression-d96`.
- `npm run test:api` : **36 étapes**, sur wrangler dev et une vraie D1 locale, inchangées (le brouillon des tables
  y est prérempli des codes, et sa publication les porte).
- **Chrome**, 1366 × 768 et 390 × 844, 42 vérifications : la question d'un outil du tour (la pastille, ses couleurs
  calculées, le mot F sur la case de f, « sans objet », quatre cases remplies par le mode test, rien ne déborde) et
  son corrigé (la ligne de programme, la coordonnée grise, le mot F doré) ; un outil de fraiseuse (G94, le mot F sur Vf,
  cinq cases) et son corrigé ; la feuille des avances (19 pastilles dans leur rang, aucune barre sur une note, la grille
  au-dessus du pied ; un PDF d'une page) et celle des formules (la rangée du mot F ; un PDF d'une page) ;
  `/tables?version=A2026_r0` sans colonne ; l'attestation (« s.o. » pour les trois outils du tour, une valeur pour les
  trois autres ; en mode impression, le pied de page dans la zone utile, une page) ; l'onglet Tables de référence (19
  listes, préremplies ; deux avertissements dorés après deux changements, « Publier… » possible ; les différences
  « G99 → G94 » et « G94 → G99 ») ; la page de « Vf seule » avec son erreur. Aucune exception, aucune requête hors du
  site, aucune erreur console. Captures dans `captures/d96-code-g-avance/` (hors dépôt).
- **Une retouche après les captures** : à 1366 px, l'étiquette « mot F » posée à côté de la case rétrécissait la case
  de f, qui coupait « 0.0050 » en « 0.005 » ; elle est désormais au coin supérieur droit de la case, à cheval sur son
  bord (§6, point 4), et la case garde sa largeur ; le scénario vérifie que la valeur n'est plus coupée.

## 4. Tes gestes en production, après la fusion

Le déploiement seul ne change rien pour les étudiants. Dans l'ordre :

1. **Fusionner et déployer hors des périodes de labo.**
2. **Exporter une sauvegarde** (onglet Sauvegarde).
3. **Réviser la colonne préremplie** : onglet Tables de référence, tableau Opérations, colonne **Code G d'avance** —
   G99 pour les dix opérations de machine « Tour », G94 pour les neuf autres (perçage, taraudage, alésage à l'alésoir,
   pointage, chanfreinage, contournages, surfaçage). Les opérations ajoutées en production arrivent de même, d'après
   leur machine. Un avertissement doré signale un code du tour hors du tour, ou l'inverse.
4. **Publier les tables** (A2026_r7). La confirmation montre une différence par opération (« code G d'avance : — →
   G99 »), puis la cascade : pour chaque exercice, le code de ses opérations et, s'il a des outils du tour, « La
   vitesse d'avance devient sans objet pour … ». Un exercice dont la seule grandeur évaluée serait Vf avec un outil du
   tour serait nommé en erreur et laissé tel quel ; aucun exercice du lot n'est dans ce cas, à ce que je sais.
5. **Vérifier une question du tour** (la pastille, « sans objet ») et son corrigé (la ligne de programme), puis une
   question de fraiseuse ; **imprimer** la feuille des avances et celle des formules.
6. **Évaluer en classe l'étiquette « mot F » dès la question.** Pour la réserver au corrigé : `F_WORD_FROM_QUESTION =
   false` dans `site/js/code-avance.js`, rien d'autre à changer (un test le vérifie).

## 5. Ce que je n'ai pas pu vérifier

- **Les données de production** : je n'ai lu que la semence. Une opération ajoutée en production avec une machine
  écrite autrement que « Tour » arriverait en G94 et, si c'est une opération du tour, c'est à toi de la passer en G99 —
  l'avertissement ne se déclenche que sur le texte exact « Tour » (§6, point 9).
- **Un vrai téléphone** : la pastille, le mot F et la ligne de programme ont été vus dans Chrome à 390 px, pas sur un
  appareil.
- **La page de l'attestation au-delà d'une page** avec « s.o. » : les largeurs ne changent pas et « s.o. » est plus
  court qu'un nombre, la coupe de D85 reste donc valable ; je l'ai vérifiée sur une page, pas sur deux.

## 6. Points douteux, chacun avec ma proposition

1. **« Sans objet » l'emporte sur l'état que l'exercice donne à Vf.** Tu as dit « Vf n'est ni demandée ni corrigée »
   pour un outil en G95/G99 ; pour un exercice qui **donne** ou **masque** Vf, j'ai gardé « sans objet » (sans valeur,
   ni « — ») : c'est une propriété de l'opération, pas un réglage, et une Vf donnée au tour serait la valeur qu'on ne
   veut pas montrer. **Proposition : garder** ; D96 le précise de D52.
2. **Des tables portent les codes pour toutes leurs opérations, ou pour aucune**, comme les facteurs de vitesse
   (D83) ; la validation refuse l'entre-deux. **Proposition : garder** — on ne montre jamais une pastille pour une
   opération et rien pour la voisine.
3. **La coordonnée d'une direction inconnue** : aucune (« G99 G01 F0.0100 »), `// ❓` dans `code-avance.js`. Les
   quatre directions de la semence sont reconnues sans égard à la casse ni aux accents (« longitudinal », « axial »,
   « transversal », « lateral » dans le texte). **Proposition : garder.**
4. **L'étiquette « mot F » est au coin supérieur droit de la case, à cheval sur son bord**, et non à côté : à
   1366 px, dans les cinq colonnes, la case de f perdait un chiffre. Sur téléphone, la case est pleine largeur et
   l'étiquette reste au coin. **Proposition : garder** ; l'autre choix — à côté, avec une case plus étroite — est un
   changement de CSS seulement.
5. **Sur la feuille des avances, la pastille est sur deux lignes** (« G99 », puis « par tour ») pour tenir dans un rang
   de 41 px et une colonne de 72 px ; l'opération et la note perdent 12 px, la barre 48. **Proposition : garder.**
6. **La feuille des formules** : la rangée « Mot F » reprend le pictogramme de f (il n'y en a pas pour un mot de
   programme), avec l'unité « programme CN » ; et la note de Vf devient « C'est la vitesse programmée à la commande en
   G94 / G98. En G95 / G99, c'est f qui se programme : Vf est sans objet. » (tu n'avais demandé que la rangée).
   **Proposition : garder** ; l'ancienne note, « (G94) », aurait contredit la rangée.
7. **Le mot F dès la question** : un essai, comme tu l'as dit. Pour le réserver au corrigé, une constante. Je n'ai pas
   d'avis avant la classe.
8. **« s.o. » est inscrit dans l'enregistrement figé** (`reponses.feedRate = "s.o."`), pour que la page montre
   l'enregistrement tel quel (D31, D85). Conséquence : un spécimen d'une version qui porte les codes le porte aussi,
   et les spécimens déjà imprimés d'une version d'avant restent valides (rien ne change pour eux). **Proposition :
   garder.**
9. **L'avertissement machine compare au texte exact « Tour »** (la machine des dix opérations du tour de la semence).
   Une machine « Tour CN » ou « tour » serait traitée comme hors du tour. **Proposition : garder** (tu m'as demandé
   « dont la machine n'est pas « Tour » ») ; sinon, une comparaison sans casse ni accents se fait en une ligne.
10. **Le préremplissage en production** : A2026_r6 porte les facteurs ; au déploiement, le brouillon des tables
    arrivera prérempli des codes, donc « modifié » par rapport à A2026_r6, et « Annuler les modifications » n'aura rien
    à annuler (même règle que D83). **Proposition : garder.**
11. **Les messages** nomment la clé (« « code_avance » doit être G94, G95, G98, G99 »), comme ceux des autres champs
    des tables. **Proposition : ne rien changer.**
12. **Le spécimen d'une version qui porte les codes** se recompose depuis son QR comme avant (rien ne change à
    `buildSpecimen` ni à la forme de l'enregistrement, hors « s.o. » dans les réponses) : les spécimens d'une version
    d'avant restent « spécimen » à la vérification. Rien à trancher, c'est pour mémoire.
