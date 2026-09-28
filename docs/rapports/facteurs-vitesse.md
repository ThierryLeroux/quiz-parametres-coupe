# Rapport — les facteurs de modification de la vitesse de rotation, 4e feuille des tables de référence (décision D83)

> **Correction des séances en cours (D75, point 7) : aucun changement au déploiement.** La formule et les tolérances
> ne changent pas. Tant que tu n'as pas publié de tables qui portent les facteurs, tout — questions, corrections,
> lignes de calcul, feuilles, attestations — reste exactement comme avant : un témoin produit par le code d'avant le
> chantier le vérifie, octet pour octet pour les attestations (§2). **Ce qui changera ensuite vient de tes gestes, pas
> du déploiement** : la publication des tables et la cascade créent de nouvelles versions, que seules les **nouvelles
> séances** prennent. Dans ces versions, le facteur est à trouver dans la 4e feuille au lieu d'être affiché (§6,
> point 1), et la ligne de calcul de N l'écrit en fraction. Les séances commencées gardent leur version jusqu'à la fin.
> **Aucune migration de la base.**
>
> **Retouche du 2026-09-28, avant la fusion (§7) : de la présentation seulement** — les onglets des feuilles et la
> mise en page de la 4e feuille. Elle ne touche ni la correction, ni les trois autres feuilles.

Session du 2026-09-28, branche `facteurs-vitesse`, partie de `main` à jour (`4ffb4bf`). Poussée, pas fusionnée ; rien
n'a été lu ni écrit en production. Aucun point de ta demande ne contredisait une décision fermée ni le code : je n'ai
pas eu à m'arrêter. Ce que D83 précise des décisions d'avant (D54, D61, D62, D77, D82) est écrit à la fin de D83.

## En bref

- **Le facteur de vitesse est une valeur de chaque opération des tables** (`facteur_vitesse`), versionnée comme les
  avances. Le brouillon des tables arrive **prérempli d'après la table papier** ; tu vérifies, puis tu publies.
- **L'outil hérite du facteur de son opération**, ou le **force**, avec une raison que l'étudiant voit toujours.
- **Les outils existants font leur passage sans rien changer en silence** : même valeur que leur table, ils héritent ;
  valeur différente, ils sont forcés « à vérifier » et nommés. Dans la semence : **Nine9 90 degrés** et **l'outil à
  chambrer**, comme attendu ; les 27 autres héritent, sans changement de valeur.
- **La 4e feuille, « Facteurs de vitesse »**, après Formules, à l'écran et à l'impression — seulement pour une version
  de tables qui porte les facteurs.
- **Un réglage par exercice**, « Donner le facteur de vitesse à l'étudiant », décoché par défaut.
- **Rien ne change pour ce qui existe.**
- Tests : **766** (726 avant) ; `test:api` **35 étapes** ; **Chrome** 74 vérifications à 1280 et 390 px, aucune erreur
  console, chaque feuille sur une page lettre.

## 1. Ce qui a été fait, point par point

**1. Le facteur dans les tables.** Clé `facteur_vitesse` de chaque opération, un nombre > 0. Dans l'onglet Tables de
référence, tableau **Opérations**, la colonne **Facteur de vitesse** est entre « Avance max » et « Pictogramme ». Elle
accepte « 1/4 » comme « 0.25 » (et « 0,25 »), par l'évaluateur de D82, et récrit en fraction ce qu'elle a lu quand on
quitte la case. Vide ou illisible (« un quart ») : une erreur nommée, et « Publier » s'arrête. Les différences d'une
publication le disent en fraction : « Opération « Tronçonnage » — facteur de vitesse : — → 1/8 ».

**2. Les valeurs de départ.** Le brouillon se lit prérempli : Tronçonnage 1/8 ; Rainurage externe, Rainurage interne,
Alésage à l'alésoir, Chanfreinage, Chanfreinage / ébavurage 1/4 ; les treize autres 1. Chambrage et Moletage ne sont
pas créés. Le préremplissage se fait **à la lecture du brouillon** : la base n'est écrite que lorsque tu enregistres
ou publies (§6, point 4).

**3. Rien ne change pour ce qui existe.** Une version de tables d'avant ne reçoit **aucun** facteur, ni à la lecture
ni autrement : ses exercices se corrigent avec le `fact_vc` de leurs copies, s'affichent comme avant (« Vitesse
réduite × 0.25 »), gardent leurs trois feuilles et leur feuille des formules, mot pour mot. La 4e feuille n'existe que
pour une version qui porte les facteurs.

**4. Hériter, forcer.**

- Formulaire d'outil (banque et copies) : « Selon la table : 1/4 (Chanfreinage) », en lecture seule, qui suit
  l'opération choisie ; **Forcer pour cet outil** ouvre **Valeur forcée** et **Raison, montrée à l'étudiant**
  (80 caractères au plus), toutes deux obligatoires. Avec des tables d'avant, le champ d'avant.
- Badge doré **facteur forcé** dans la liste de la banque et dans la liste des outils d'un exercice ; au survol, la
  valeur, celle de la table et la raison.
- Dans la question, un facteur forcé est **toujours** affiché, même à 1, même quand le facteur est à trouver :
  « Facteur propre à cet outil : × 1 — Valeur reprise de l'ancien outil — à vérifier ».
- `fact_av` ne change pas.

**5. Le passage des outils existants.** Il s'écrit chaque fois qu'un contenu est écrit avec des tables qui portent les
facteurs : cascade (version publiée et brouillon), « Passer à … », « Reprendre cette version », enregistrement,
import. **La banque fait le sien à la publication des tables**, dans le même lot (§6, point 2). Les outils forcés sont
nommés à trois endroits : dans la confirmation de publication (la banque), dans l'impact de la cascade (exercice par
exercice) et par leur badge.

**6. Le réglage de l'exercice.** Case « Donner le facteur de vitesse à l'étudiant », dans les réglages généraux,
offerte seulement si les tables de l'exercice portent les facteurs ; versionnée, et dite dans le résumé d'une
publication. Quand le facteur est à trouver, l'aide de N dit : « Vitesse de rotation → N = Vc × 4 / Ø × le facteur de
l'opération (feuille Facteurs de vitesse), plafonnée à la vitesse de rotation max de la machine. », et son bouton
ouvre la 4e feuille. **Rien de ce qui est à trouver ne part au navigateur** : la question ne porte alors ni la valeur
ni le texte du facteur. Les avertissements « se déduit de » disent où il se relève.

**7. La 4e feuille.** Même cadre que les autres, la révision au pied, une page lettre. Titre et formule en tête ; une
ligne par opération, sous les trois machines de la feuille des avances ; le pictogramme des tables ; le facteur en
fraction. Les six lignes réduites ressortent (bande et facteur au bleu de la vitesse de rotation), les treize à 1
restent grises. Composée par `speedFactorSheet` (`sheets-data.js`), testée.

**8. Ailleurs.** Feuille des formules d'une version qui porte les facteurs : « N = Vc × 4 / Ø × facteur », la note
renvoie à la feuille des facteurs, avec une miniature (`table-facteurs.svg`). Correction : « N = Vc × 4 / Ø × facteur =
100 × 4 / 0.5 × 1/4 ».

## 2. Non-régression

`tests/instantanes/avant-d83.json` a été produit **par le code de `main`, avant toute retouche**, puis figé ;
`tests/non-regression-d83.test.js` rejoue le scénario avec le code d'aujourd'hui et compare. Il couvre :

- les trois exercices du dépôt sur le catalogue semé, deux questions par outil (58 pour `test-complet`) : la question
  rendue au navigateur, les valeurs attendues, la correction d'une bonne et d'une mauvaise réponse — donc chaque ligne
  de calcul, « × 0.25 » et « × 0.125 » compris —, et l'aperçu ;
- le vrai Worker sur les deux M10 semés : chaque étape d'une séance entière, puis l'attestation — son enregistrement,
  **le texte que la signature couvre, la signature et l'adresse du QR, octet pour octet** ; et ce que le navigateur
  lit pour afficher (`/api/exercice`, `/api/exercices`, `/api/tables`).

Il est vert à chaque commit de la branche. Un autre test vérifie qu'une séance commencée **avant** une cascade garde,
après elle, sa question, son `fact_vc` et sa ligne de calcul d'avant. Le témoin pèse 565 Ko (§6, point 9).

**Tests d'avant retouchés**, et pourquoi — aucun ne l'a été pour cacher un écart :

- un brouillon des tables parti de A2026_r0 a désormais ses facteurs à publier : les tests qui attendaient « aucune
  différence à publier » sur une base neuve publient d'abord A2026_r1, puis vérifient le refus ;
- un contenu qui passe à des tables qui portent les facteurs fait le passage de ses copies : les tests de la cascade
  comparent au dernier contenu publié **une fois ce passage fait**, et vérifient que rien d'autre n'y change ;
- le journal de la publication des tables résume le passage de la banque ; l'historique d'un outil en garde le contenu
  d'avant ; un aller-retour de sauvegarde vers une base neuve y ajoute 29 contenus « import » (la banque de la source
  a fait son passage, pas celle de la cible).

## 3. Vérifications

- `npm test` : **766 tests, 0 échec**. Nouveaux : `facteur-vitesse` (héritage, forçage, passage des 29 outils de la
  semence, fraction, saisie, table papier, réglage), `worker-facteurs` (serveur), `ui-facteurs` (feuille, panneau de
  l'outil, aide de N, Gestion du contenu), `non-regression-d83`.
- `npm run test:api` : **35 étapes**, sur wrangler dev et une vraie D1 locale — dont la publication des tables avec le
  passage de la banque dans le même lot.
- **Chrome**, 1280 et 390 px, 74 vérifications : la colonne des tables ; la confirmation de publication ; les badges ;
  le formulaire d'outil (hérité, forcé, les deux champs exigés, l'opération qui change) ; le réglage et les
  avertissements ; un exercice resté sur A2026_r0 ; une question d'alésoir avec le facteur à trouver, puis donné ; un
  outil forcé ; la correction ; la 4e feuille à l'écran et à l'impression ; une séance d'avant ; `/tables?version=`.
  Aucune exception, aucune requête hors du site ; en console, seulement les trois 401 de la Gestion du contenu avant
  la connexion, attendus. Captures dans `captures/facteurs-vitesse/` (hors dépôt).

## 4. Tes gestes en production, après la fusion

Le déploiement seul ne change rien pour les étudiants. Dans l'ordre :

1. **Fusionner et déployer hors des périodes de labo.** Puis laisser passer la journée avant l'étape 4, ou la faire
   un soir. D'après le code d'avant (je ne l'ai pas essayé) : une page restée ouverte depuis avant le déploiement
   refuserait une version qui porte les facteurs, parce que sa validation exige un `fact_vc` par outil ; recharger la
   page suffit.
2. **Exporter une sauvegarde** (onglet Sauvegarde).
3. **Vérifier la colonne préremplie** : onglet Tables de référence, tableau Opérations, colonne Facteur de vitesse.
   Si tu as ajouté des opérations en production, elles y sont à 1 : à vérifier aussi.
4. **Publier les tables.** La confirmation montre une différence par opération, puis **« Banque d'outils : le
   facteur de vitesse passe aux tables »** — les outils forcés y sont nommés ; en production, la liste peut différer
   de celle de la semence —, puis la cascade.
5. **Faire la cascade**, en sachant ceci : un exercice coché aura le facteur **à trouver**. Pour un exercice de
   débutants qui doit continuer à le donner, **décoche-le** dans la cascade ; puis, sur sa page, « Passer à
   A2026_rN… », coche « Donner le facteur de vitesse à l'étudiant », et publie. Il n'aura ainsi qu'une version
   nouvelle.
6. **Trancher Nine9 90 degrés et l'outil à chambrer** : dans la fiche de chacun (banque), décocher « Forcer pour cet
   outil » pour qu'il hérite de 1/4, ou garder × 1 avec une vraie raison. Même geste dans chaque exercice qui en a une
   copie (le badge les montre), puis publier l'exercice.
7. **Chambrage et Moletage**, si tu les veux : « Ajouter une opération » dans le brouillon des tables (machine,
   direction, famille, avances, facteur 1/4, pictogramme), publier, puis ranger l'outil à chambrer sous Chambrage —
   il héritera. **Attention : à 21 opérations, la feuille des avances déborde sur son pied de page** (§7.5, point 4) ;
   la 4e feuille, elle, tient.
8. **Imprimer la 4e feuille** : « Feuilles imprimables », dans la liste des versions des tables.

## 5. Ce que je n'ai pas pu vérifier

- **Les données de production** : je n'ai lu que la semence. Des outils modifiés ou ajoutés en production peuvent
  donner d'autres cas forcés ; la confirmation de publication les nommera tous avant que rien ne soit écrit.
- **Un vrai téléphone** : la 4e feuille a été vue dans Chrome à 390 px, pas sur un appareil.
- **La limite de D1 en production** pour le lot de la première publication (une soixantaine de requêtes de plus, pour
  la banque) : il passe sur la D1 locale de wrangler ; je n'ai pas de mesure en production.

## 6. Points douteux, chacun avec ma proposition

> **Réponses de Thierry (2026-09-28) : les onze propositions sont acceptées telles quelles** (fin de D83, et §7).

1. **Un exercice qui passe par la cascade a le facteur à trouver.** Tu as dit « décoché par défaut pour un nouvel
   exercice » et « une version publiée avant garde l'affichage d'aujourd'hui » ; pour un exercice existant qui passe
   aux nouvelles tables, j'ai appliqué le défaut, et l'impact de la cascade le dit pour chacun. **Proposition : garder.**
   L'autre choix — la cascade coche le réglage, pour que rien ne change à l'écran — se fait en une ligne ; dis-le-moi.
2. **La banque fait son passage à la publication des tables**, ce que tu n'avais pas demandé en ces termes. Sans cela,
   un outil resté à l'ancien format aurait paru hérité, puis serait devenu « forcé » le jour où sa table change, au
   lieu de la suivre. Le passage est annoncé avant, gardé dans l'historique de chaque outil, résumé au journal.
   **Proposition : garder.**
3. **La ligne de calcul nomme le facteur** : « N = Vc × 4 / Ø × facteur = … × 1/4 », et « (propre à cet outil) » après
   un facteur forcé. Tu n'avais demandé que la fraction. **Proposition : garder**, pour que la correction parle comme
   la feuille ; `// ❓` dans `worker/seance.js`.
4. **« Reprendre cette version » d'une version d'avant** donne un brouillon prérempli d'après la table papier, pas
   d'après les facteurs de la dernière version publiée. Si tu avais changé un facteur entre-temps, les différences de
   la publication le montreraient. **Proposition : garder** — c'est le plus simple à expliquer.
5. **Sur la 4e feuille, le facteur est avant le pictogramme** (Machine, Opération, Facteur, Pictogramme), à l'inverse
   de la feuille des avances : à 390 px, le nom et le facteur se lisent ainsi sans faire défiler. **Proposition :
   garder.**
6. **La couleur d'accent de la feuille** est le bleu de la 1re partie des formules (la bande `#C1EFFF`, le facteur en
   `#0070A8`). Il n'y a pas de maquette. **À toi de voir** ; elle se change dans `tokens.css` et `sheets.css`.
7. **La feuille des formules** : la miniature est sous la formule de N ; la formule exacte devient « N = Vc × 12 /
   (π × Ø) × facteur » et passe à la ligne ; l'exemple dit « perçage : facteur 1 ». **Proposition : garder** ; la
   feuille tient largement dans sa page.
8. **Limites** : une raison de 80 caractères au plus ; un facteur > 0, sans plafond (un facteur de 1.5 s'afficherait
   « Vitesse augmentée × 1.5 »). Un outil peut être forcé à la valeur même de sa table. **Proposition : garder.**
9. **Le témoin de non-régression pèse 565 Ko** dans le dépôt. **Proposition : le garder** le temps que les versions
   d'avant servent encore ; il ne doit pas être régénéré pour faire passer son test (c'est écrit dans `CLAUDE.md`).
10. **Revenir à des tables sans facteurs** n'est possible que par l'API (la page n'offre que les plus récentes) :
    chaque copie y retrouve son facteur, mais la raison d'un forçage est perdue. **Proposition : garder**, le cas ne
    se présente pas à l'écran.
11. **Les messages d'erreur nomment la clé** (« « fact_vc » doit être un nombre > 0 »), comme ceux des autres champs.
    **Proposition : ne rien changer ici** ; ce serait une retouche de tous les messages.

## 7. Retouche avant la fusion (2026-09-28)

**Rien ne touche la correction.** La retouche est de la présentation : `site/css/sheets.css`,
`site/js/ui/reference-screen.js`, et un commentaire de `worker/seance.js`. Même branche, poussée, pas fusionnée.

### 7.1 Tes réponses

Les onze propositions du §6 sont acceptées telles quelles ; elles sont consignées à la fin de D83. Le `// ❓` de
`worker/seance.js` est retiré (point 3) : le commentaire dit la règle, sans question.

### 7.2 Les onglets des feuilles sur téléphone

La barre des onglets **passe à la ligne** au lieu de défiler de côté (`flex-wrap` ; `overflow-x: auto` retiré).

| Largeur | Quatre onglets (tables qui portent les facteurs) | Trois onglets (version d'avant) |
|---|---|---|
| 1280 px | une rangée, comme avant | une rangée, comme avant |
| 390 px | deux rangées : deux et deux | deux rangées : deux et un |
| 360 px | deux rangées : deux et deux | deux rangées : deux et un |

Ouverte par « Ouvrir la table » de l'aide de N, la feuille montre son onglet actif, « Facteurs de vitesse », entier.
Même règle sur `/tables?version=`, puisque c'est la même barre.

### 7.3 La mise en page de la 4e feuille

| | Avant | Ordinateur et impression | Téléphone (moins de 640 px) |
|---|---|---|---|
| Largeur du tableau | 374 px sur 720 | 720 px, quatre colonnes réparties | 720 px, colonnes serrées à gauche |
| Nom de l'opération | 11 px | 15 px | 13 px |
| Facteur d'une ligne réduite | 17 px | 25 px | 21 px |
| Facteur d'une ligne à 1 | 13 px | 19 px | 16 px |
| Hauteur d'un rang (19 opérations) | 41 px | 43,8 px | 43,8 px |
| Pictogramme | 56 × 38 px | 59 × 40 px | 59 × 40 px |

- **L'ordre des colonnes** : Machine-outil, Opération, Facteur, Pictogramme. Le pictogramme est centré dans la sienne.
- **La bande bleue** d'une ligne réduite va du nom de l'opération au bord droit de la page.
- **Les rangs se partagent la hauteur de la page**, 56 px au plus chacun : la feuille tient sur sa page lettre quel
  que soit le nombre d'opérations. Essayé avec 21 opérations (Chambrage et Moletage ajoutés dans une base jetable) :
  des rangs de 39,6 px, une page à l'impression.
- **Sur téléphone**, les colonnes se serrent à gauche (68, 146 et 78 px) : le nom et le facteur de chaque opération
  sont entiers dans l'écran, à 390 comme à 360 px, sans faire défiler. À l'impression, la pleine largeur, même
  depuis un téléphone.

### 7.4 Vérifications

- `npm test` : **766 tests, 0 échec**. Le témoin de non-régression n'a pas été régénéré : `git diff` ne touche ni
  `tests/instantanes/avant-d83.json` ni aucun test.
- `npm run test:api` : **35 étapes**.
- **Chrome, scénario complet du chantier** (celui du §3), rejoué sur l'état final : **74 vérifications, aucun échec**.
- **Chrome, scénario de la retouche**, à 1280, 390 et 360 px : **82 vérifications, aucun échec**.
  - Les onglets : tous entiers dans l'écran, la barre ne défile pas, chacun des quatre onglets actif à son tour ;
    dans une séance, dans une séance d'avant (trois onglets), sur `/tables?version=A2026_r1` et `A2026_r0`.
  - La 4e feuille ouverte depuis l'aide de N : les mesures du tableau ci-dessus, les en-têtes sur une ligne, les 19
    pictogrammes chargés, le contenu qui finit avant le pied de page.
  - L'impression : **une page lettre** pour chacune des quatre feuilles, depuis les trois largeurs.
  - **Les trois autres feuilles** (vitesses de coupe, avances, formules), comparées à celles du code d'avant la
    retouche, servi par un second serveur : la même mise en page élément par élément (place, taille, police,
    couleurs, texte) aux trois largeurs, pour A2026_r0 et A2026_r1 ; à 1280 px, **la même image, octet pour octet**.
- Aucune exception, aucune requête hors du site. En console : les trois 401 d'avant la connexion (scénario complet),
  et deux 404 attendus — les pictogrammes de Chambrage et de Moletage, que l'essai à 21 opérations n'a pas téléversés.
- Captures dans `captures/facteurs-vitesse/` (hors dépôt) : celles du scénario complet refaites, et les nouvelles,
  préfixées `c1` à `c8`.

**Un écart rencontré en route.** À un passage, la comparaison des images a différé sur trois feuilles (quelques
centaines à 18 000 pixels sur 860 000), avec une mise en page identique. La cause était dans mon script : il capturait
avant que Chrome ait fini de décoder les images. Une fois l'attente ajoutée, les six images sont identiques du premier
coup.

**Ce que je n'ai pas pu vérifier** : un vrai téléphone, et un autre navigateur que Chrome (Safari sur iPhone en
particulier). Le partage de la hauteur entre les rangs repose sur des règles CSS courantes, mais je ne les ai vues
tourner que dans Chrome.

### 7.5 Points douteux de la retouche, chacun avec ma proposition

1. **Les pictogrammes ne grandissent pas dans la proportion du texte** : 40 px de haut au lieu de 38 (+5 %), quand
   le texte gagne un tiers. Avec une opération par rang, 19 opérations sur une page lettre laissent 44 px à chacun, et
   le pictogramme ne peut pas dépasser son rang. **Proposition : garder.** Pour des pictogrammes vraiment plus gros, il
   faudrait deux blocs côte à côte (le tour à gauche, fraiseuse et perceuse à droite, des rangs d'environ 80 px) ou
   deux pages : le contraire de ta demande, donc je ne l'ai pas fait.
2. **Sur téléphone, la feuille n'est pas disposée comme la page imprimée** : colonnes serrées à gauche, texte à 13 px
   au lieu de 15. C'est la seule façon que j'ai trouvée de garder le nom et le facteur visibles sans défiler avec un
   texte plus gros. **Proposition : garder.**
3. **Les trois onglets d'une version d'avant passent aussi sur deux rangées sur téléphone.** À 390 px, ils tenaient
   sur une rangée à 4 px près (la barre défilait de 4 px). C'est la même règle pour tous ; ces séances disparaissent
   après ta cascade. **Proposition : garder.** L'autre choix : des onglets un peu plus étroits sur téléphone, pour que
   trois tiennent sur une rangée à 390 px — quatre feraient alors trois et un.
4. **La feuille des avances déborde à 21 opérations.** Ses rangs ont une hauteur fixe de 41 px : elle tient jusqu'à
   20 opérations ; à 21, le dernier rang passe sur le pied de page (capture `c8-feuille-avances-21-operations-1280.png`).
   Ce n'est pas nouveau et je n'y ai pas touché, puisque tu demandes que les trois autres feuilles ne changent pas.
   Mais créer Chambrage **et** Moletage donne 21 opérations. **Proposition : lui donner la règle de la 4e feuille**
   (les rangs se partagent la hauteur), avant que tu crées les deux opérations. Dis-le-moi.
5. **Deux `// ❓` de D82 restent dans le code** (`site/js/expression.js`, `site/js/ui/question-screen.js`), sur des
   points que tu as acceptés à la fin de D82. Hors de cette retouche : je ne les ai pas retirés. **Proposition : les
   retirer** à la prochaine occasion.
