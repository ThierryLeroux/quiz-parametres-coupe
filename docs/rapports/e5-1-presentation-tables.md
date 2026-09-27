# Rapport — E5-1 : la présentation des tables en direct (décisions D75, D76)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Ce jalon ne touche ni au calcul, ni aux
> tolérances, ni à `isQuestionValid`, ni à la question figée, ni à l'enregistrement ou à la signature des
> attestations. Les tests le vérifient : une séance épinglée garde exactement sa question et ses valeurs attendues,
> et une attestation reste identique octet pour octet quand la présentation change.

Session du 2026-09-27, branche `e5-1-presentation-tables`, partie de `origin/inventaire-versionnage` (`main` + le
rapport d'inventaire, qui entre dans `main` avec ce jalon). Poussée, pas fusionnée ; rien n'a été lu ni écrit en
production.

## En bref

- **D75** consigne le modèle du chantier E5 (tes neuf points) et dit ce qu'il remplace dans D47, D61 à D63, D64 à
  D68 et D74. **D76** consigne les choix propres à ce jalon. Les quatre jalons sont dans le `PLAN.md`.
- **Ce qui ne fait qu'afficher ne se publie plus** : nom et trois couleurs des classes ISO, image de chaleur,
  légende, caractéristiques, couleur des matières d'outil, pictogramme des opérations. Ils vivent dans **la
  présentation** (migration `0010`), que le serveur pose par-dessus **toute** version de tables, dans ce qu'il
  **montre** seulement.
- **L'onglet Tables** a maintenant, en tête, un panneau vert **« Présentation — effet immédiat »** : aperçu,
  « Appliquer… » avec la liste des changements, historique et « Rétablir ». Le brouillon des valeurs est dessous,
  sans ces champs.
- **Le pictogramme de la page Question** lit enfin les tables (§8 de l'inventaire).
- Tests : **636** (614 avant), `test:api` **32 étapes** (31), et une passe dans **Chrome** (21 vérifications) :
  la légende changée apparaît sur la page Question d'une séance en cours après rechargement, puis « Rétablir » la
  remet.

## 1. Le modèle (D75) et ce qu'il remplace

D75 reprend tes neuf points tels quels : la voie hybride, la liste blanche, ce qui reste versionné, l'effet au
rechargement, l'aperçu puis « Appliquer », la cascade (E5-2), le code hors versionnage, l'attestation figée, les
quatre jalons. Ce qu'elle remplace :

- **D47** : une version publiée reste immuable, mais ce qu'elle **montre** ne l'est plus. « Une publication ne
  touche jamais une séance en cours » reste vrai des **valeurs**.
- **D61** : les couleurs, le nom des classes et le pictogramme ne passent plus par le brouillon, la publication ni
  `tablesDiff`. On lit la présentation en vigueur, plus « la version en usage ».
- **D62** : `exerciseTablesImpact` ne dit plus les pictogrammes. Une séance garde les **valeurs** de ses tables,
  plus leur apparence.
- **D63** : `/tables?version=` montre les valeurs de la version **avec la présentation en vigueur**.
- **D64 à D66, D68** : mêmes formats et mêmes règles, mais édités dans le panneau de la présentation.
- **D74** : rien en E5-1 (le titre passera en direct en E5-3).

J'ai ajouté ta règle du point 7 à `CLAUDE.md` (règle 8) : ce rapport l'applique en tête.

## 2. Ce qui a été fait (D76)

### 2.1 Le stockage (migration `0010`)

- `presentation_tables` : **une seule ligne**. Elle porte le contenu (le format des tables réduit à la liste
  blanche), une révision (le contrôle optimiste, D48), la date et l'auteur de la dernière application.
- `presentation_tables_historique` : **un contenu remplacé par ligne**, sans limite. Chaque ligne dit quand et par
  qui ce contenu avait été posé, et quand, par qui et par quoi il a été remplacé : application, rétablissement ou
  import.
- **Au départ, le contenu est vide** (`NULL`). Tant que rien n'est appliqué, la présentation est celle de la
  dernière version publiée des tables, lue à chaque requête. Rien d'autre n'est touché par la migration (un test le
  vérifie, table par table, sur des données produites par le serveur d'avant).

### 2.2 Où elle se pose, et où jamais

La présentation en vigueur est celle du panneau :

- pour chaque classe, matière d'outil et opération de la **dernière** version publiée, l'entrée appliquée, sinon
  celle de la version ;
- puis les entrées appliquées d'une clé que la dernière version n'a plus.

Le serveur la pose **après** le cache des versions assemblées (`presentData`, `applyPresentation`), dans :

- `GET /api/exercice` : la page Question, les feuilles du quiz, la page de description ;
- `GET /api/tables?version=` : les feuilles imprimables ;
- les tables d'un exercice et de la banque dans la Gestion du contenu (pastilles, aperçus).

**Jamais** dans le catalogue gardé en mémoire : c'est avec lui que le serveur tire, corrige (`isQuestionValid`,
`gradeQuestion`) et compose l'attestation. `/verifier` n'en lit rien non plus. Une clé que la présentation ne connaît
pas garde la valeur de sa version.

### 2.3 Les routes (rôle admin, journalisées)

- `GET /api/prof/editeur/presentation` : la présentation, sa révision, ses erreurs, l'historique. Pour chaque contenu
  remplacé, elle dit ce que le rétablir changerait, en clair.
- `POST …/presentation/appliquer` `{ revision, presentation }`.
  - **Tout champ hors de la liste blanche est refusé (400)**, nommé : « classes_iso[0] (P) : « vc_pi_min » est hors
    de la liste blanche de la présentation : il se modifie dans le brouillon des tables, puis se publie ».
  - Les trois listes sont exigées : une liste absente n'effacerait pas en silence ce qui a été appliqué.
  - Les règles d'aujourd'hui s'appliquent : nom non vide, couleurs, légende de 40 caractères, 6 caractéristiques,
    image existante et non archivée.
  - Rien à changer → 400 ; révision périmée → 409, et rien n'est écrit.
- `POST …/presentation/retablir` `{ revision, historique }`.
- Au journal : `editeur_presentation_application` et `editeur_presentation_retablissement`, avec les changements en
  clair dans les détails. Exemple : « 1 changement(s) : Classe P — légende de l'image : Chaleur → Zone chaude ».

### 2.4 Les images (ton point 3)

- **Une image nommée par la présentation, actuelle ou dans l'historique, compte comme utilisée.** Elle ne se
  supprime pas, elle s'archive. L'onglet Images le dit : « présentation des tables · historique de la présentation
  (2 contenus) ».
- **Ma proposition pour « Rétablir » si l'image a été archivée depuis : c'est permis, avec un avertissement.**
  - Une image archivée est toujours servie : les étudiants retrouvent exactement ce qu'ils voyaient.
  - Le panneau la signale ensuite en erreur. Pour appliquer autre chose, il faut en choisir une autre, ou la
    rétablir dans l'onglet Images. Pour une image de chaleur, la publication des tables est bloquée aussi d'ici là,
    puisque la version en prendrait un instantané : c'était déjà la règle pour une image archivée dans le
    brouillon (D64).
  - Comme une image utilisée ne se supprime jamais, « Rétablir » ne peut pas tomber sur une image manquante.

### 2.5 L'onglet Tables (ton point 4)

**Le panneau « Présentation — effet immédiat »**, en tête :

- contour vert, pastille **EN DIRECT**, bouton vert **Appliquer…** (le brouillon garde son contour bleu et son
  « Publier… » doré) ;
- le paragraphe dit, en gras, que « Appliquer… » change la page de **tous** les étudiants dès qu'elle se recharge,
  séances en cours comprises ;
- trois tableaux : classes, matières d'outil, opérations ;
- **l'aperçu** : le tableau de dix questions de l'onglet Tables (image de chaleur, légende, caractéristiques), pour
  la dernière version publiée d'un exercice, avec la présentation **du panneau**, même non appliquée ;
- **Appliquer…** ouvre une confirmation qui liste les changements. Exemple : « Classe N — légende de l'image :
  Chaleur → Zone de coupe ». Puis **Appliquer maintenant** ;
- **l'historique**, replié : **Rétablir** agit en un clic, sans confirmation, parce qu'un rétablissement se rétablit
  lui-même. Une confirmation ne s'ouvre que si le panneau a des modifications non appliquées, qui seraient perdues ;
- les couleurs de la page suivent le panneau à la frappe.

**Le brouillon, dessous** (« Valeurs — brouillon à publier »), a des intertitres « Brouillon · … » :

- **Une classe connue** n'y montre plus que sa pastille et son code, avec une ligne qui renvoie au panneau.
- Les matières d'outil n'ont plus de colonne Couleur. Le pictogramme d'une opération connue renvoie au panneau.
- **`tablesDiff` et `exerciseTablesImpact` ne disent plus les champs de présentation.** La comparaison « brouillon
  modifié » et « aucune différence à publier » ne porte plus que sur les valeurs.
- En passant, `tablesDiff` dit maintenant « L'ordre des classes ISO a changé. ». Un simple réordonnancement des
  classes était une différence publiable, mais aucune ligne ne l'expliquait.
- **Une version publiée prend la présentation en vigueur** : c'est un instantané, pour les clés qu'elle connaît.
  Elle reste ainsi lisible seule et valide, et garde trace de l'apparence du jour.

### 2.6 Une classe ou une opération nouvelle (ton point 5) — à trancher

**Ma proposition** : elle reçoit sa **présentation de départ dans sa ligne du brouillon**.

- Pour une clé que la présentation ne connaît pas, les champs de présentation s'y montrent et s'y saisissent comme
  avant. La ligne est marquée d'un liseré doré.
- La version publiée les porte. La clé entre alors dans la présentation en vigueur (la dernière version), et ne se
  modifie plus que dans le panneau.
- Les matières d'outil ne sont pas concernées : ce sont trois clés fixes.

Voir le point à trancher 1.

### 2.7 Les retouches en attente dans le brouillon

Avant ce jalon, tu retouchais la présentation dans le brouillon des tables. Si une retouche n'a jamais été publiée,
elle y est encore, et elle n'aurait plus d'effet.

- Le panneau les **signale dans un encadré doré**, avec **« Les reprendre dans le panneau »**. Elles y entrent sans
  être appliquées ; tu vérifies, puis tu appliques.
- La prochaine publication des tables les abandonne.
- Même chose à l'**import** : le brouillon d'une sauvegarde se valide avec la présentation par-dessus, comme à la
  publication. Un champ caché qui nommerait une image archivée n'empêche donc pas une restauration. Le test D64
  m'a montré ce piège.

### 2.8 La Sauvegarde

- L'**export** porte `presentation_tables` : le contenu, la date, l'auteur et l'historique complet.
- L'**import** ajoute les contenus d'historique absents. Si la présentation de l'export diffère de celle de la base,
  il la remplace, et celle de la base va à l'historique (« import »).
  - Le résumé le dit, **effet immédiat compris** : « Présentation des tables : remplacée par celle de l'export, avec
    effet immédiat pour les étudiants… ».
  - Un export d'avant ce jalon, ou dont la présentation n'a jamais été appliquée, n'y touche pas.
- **Un aller-retour ne change rien** (testé : export, import dans une base neuve, nouvel export identique).

### 2.9 Le pictogramme de la page Question (ton point 6)

`question-screen.js` demandait le pictogramme sans l'opération. Il prend maintenant celui des tables, et donc celui
de la présentation, par `operationPictoOf`, comme la page de description. Vérifié dans Chrome : un pictogramme
choisi dans le panneau apparaît sur la page Question.

## 3. Au déploiement : ce qui change, et pour qui

- **Une séance sur la dernière version des tables : rien.** La présentation est celle de cette version, telle
  quelle. Testé : les tables servies sont exactement celles d'avant, sans même un `pictogramme: null` de plus.
- **Une séance sur une version plus ancienne** voit, dès le déploiement, **la présentation de la dernière version**
  pour les classes, matières et opérations que celle-ci connaît. C'est ce que tu as demandé (« la présentation part
  de celle de la dernière version et s'applique à toutes les versions »). Ses **valeurs** (Vc, avances, révision au
  pied des feuilles, attestation) ne bougent pas.
  - En pratique : si tu as publié une version A2026_r1 (ou plus) avec d'autres légendes, caractéristiques, images ou
    couleurs, les séances encore sur des exercices en A2026_r0 les prennent.
  - Si A2026_r0 est la seule version publiée, **rien ne change pour personne**.
  - Pour savoir laquelle est la dernière : onglet Tables, liste « Versions publiées ».
- **Tes retouches non publiées** dans le brouillon des tables, s'il y en a : l'encadré doré du panneau les liste.
  C'est la seule chose à regarder après la fusion.
- **Une conséquence heureuse, au passage** (§8 de l'inventaire) : une vieille version ne tire plus son apparence
  des valeurs par défaut du code dès qu'une présentation est appliquée. Elle devient alors explicite, en base.

## 4. Tests

- **`npm test` : 636 réussis, 0 échec** (614 avant).
  - `tests/presentation.test.js` (8) : liste blanche, présentation d'une version et en vigueur, pose (sans rien
    modifier), catalogue présenté, validation, différences, retouches en attente.
  - `tests/worker-presentation.test.js` (13) : les tests que tu as demandés.
    - migration `0010` ;
    - déploiement : dernière version inchangée, vieille version avec la présentation de la dernière ;
    - **liste blanche imposée** (7 champs refusés, rien d'appliqué ni journalisé) ;
    - **séance épinglée à une vieille version** : elle voit la légende actuelle, et garde question et valeurs
      attendues ; sa correction est juste ;
    - **attestation identique octet pour octet** (ligne en base, signature, page, vérification) après un
      changement de tout ce que la présentation permet ;
    - **rétablissement** et **journal** ; « Rétablir » avec une image archivée ; **validation** ; **409** ;
    - où elle se pose ; publication des tables et classe nouvelle ; retouches en attente ;
    - **aller-retour de la Sauvegarde**.
  - Tests ajustés : `tablesDiff` et `exerciseTablesImpact` sans les champs de présentation ; les tests D64, D65 et
    D68 disent qu'une retouche de présentation dans le brouillon seul n'est plus une différence à publier ; les
    utilisations d'une image ont la clé `presentation`.
  - Les routes nouvelles refusent le rôle consultation (403) : le test existant couvre toutes les routes de la
    Gestion du contenu, et je lui ai ajouté les deux tables.
- **`npm run test:api` : 32 étapes sur `wrangler dev` et une vraie D1 locale.** L'étape nouvelle couvre, sur la
  vraie D1, l'application, la liste blanche, la version 1 de Camille et les feuilles de A2026_r0, le 409,
  « Rétablir » et l'historique dans l'export.
- **Chrome** (1280 et 390 px, 21 vérifications, aucune exception, aucune requête externe ; seuls les 401 attendus
  de la Gestion du contenu avant connexion). Le déroulé :
  1. une séance en cours (Camille, MCLNR, classe N) ;
  2. dans le panneau, la légende de N devient « Zone de coupe » et le pictogramme du chariotage ébauche change ;
  3. l'aperçu, puis la confirmation (les deux changements en clair), puis « Appliquer maintenant » ;
  4. **la page Question de Camille, rechargée : même question, « Zone de coupe », le nouveau pictogramme** ;
  5. « Rétablir » la présentation de départ : la page revient comme avant, et l'historique compte deux contenus ;
  6. une classe ajoutée au brouillon montre ses champs de présentation ;
  7. à 390 px, rien ne déborde hors des tableaux défilants.

  Les captures sont dans `captures/e5-1-presentation-tables/` (hors dépôt).

## 5. Points à trancher

1. **Présentation d'une clé nouvelle** (ton point 5) : je propose sa ligne du brouillon (§2.6). Deux autres voies :
   - des valeurs neutres (gris, nom = la lettre), à corriger dans le panneau après la publication ;
   - le panneau qui liste aussi les clés du brouillon non publiées.

   La première laisse la classe grise chez les étudiants jusqu'à ta retouche ; la seconde complique le panneau.
2. **« Rétablir » avec une image archivée depuis** : je propose de le permettre, avec un avertissement (§2.4). La
   voie contraire : refuser, et te demander de rétablir l'image d'abord.
3. **Le pictogramme doit maintenant exister et ne pas être archivé**, comme l'image de chaleur. Avant, seule sa forme
   était vérifiée. J'ai lu « image existante et non archivée » comme valant pour les deux. Un pictogramme archivé
   aujourd'hui en production deviendrait une erreur du panneau et bloquerait « Appliquer » jusqu'à ce qu'il soit
   remplacé.
4. **« Rétablir » sans confirmation** (un clic, comme demandé), sauf si le panneau a des modifications non
   appliquées. D'accord ?
5. **L'aperçu du panneau** tire ses dix questions de la **dernière version publiée** de l'exercice choisi (celle
   que voient les nouvelles séances), pas de son brouillon. Seuls les exercices publiés sont proposés.
6. **L'import remplace la présentation avec effet immédiat**, comme il remplace le brouillon des tables. Le résumé le
   dit avant le mot IMPORTER. Faut-il un mot à part, ou la garder telle quelle quand la base en a une plus récente ?
7. **Une version de tables publiée prend un instantané de la présentation** (§2.5). L'autre voie : elle garderait
   les valeurs cachées du brouillon, sans signification. J'ai préféré l'instantané, qui garde la version lisible
   seule. Il est invisible pour les étudiants tant que la présentation connaît ces clés.

## 6. Observations en passant

- **Le brouillon des tables ne compte pas dans les utilisations d'une image**, et ce n'est pas nouveau. Une image
  téléversée pour une classe **nouvelle** du brouillon, pas encore publiée, pourrait donc être supprimée depuis
  l'onglet Images. C'est rare ; je ne l'ai pas corrigé.
- **`GET /api/exercice` fait deux petites lectures de plus** : la ligne de la présentation, et l'identifiant de la
  dernière version des tables, dont le contenu est gardé en mémoire (il ne change jamais).
- **`GET /api/prof/editeur/tables/version`** rend la version telle qu'en base, sans la présentation : elle ne sert
  qu'à comparer des valeurs.

## 7. Suite

- **E5-2** : la cascade des tables et le retour en arrière des versions. Le brouillon des tables suit déjà la règle
  de D75 : la cascade n'a plus à se soucier de la présentation.
- **E5-3** : la présentation des exercices (titre, cours, « À l'accueil », photo et note des copies).
- **E5-4** : l'historique de la banque.
