# Rapport — Finition F3 : les calculs dans les cases de réponse (décision D82)

> **Correction des séances en cours (D75, point 7) : elle change dès le déploiement.** Ce chantier change la façon dont
> le serveur lit les réponses. Une réponse qui est un calcul (« 400*4/0.5 ») était jugée illisible ; elle est maintenant
> jugée sur le nombre qu'elle donne. Une réponse qui est un nombre est jugée **exactement comme avant** : un test de
> non-régression compare la nouvelle lecture à l'ancienne, mot pour mot.
>
> Deux autres changements côté serveur :
> - une saisie de plus de 60 caractères est illisible (elle était coupée à 32 caractères sans le dire) ;
> - la correction renvoyée au navigateur porte l'expression de chaque saisie.
>
> Ne changent pas : les tolérances, les formules, les compteurs, l'attestation (elle montre la valeur, jamais
> l'expression), les attestations déjà émises, le journal (il garde le texte reçu, comme avant) et les migrations
> (aucune). **À déployer hors des périodes de labo.**

Session du 2026-09-28, branche `finition-calcul-saisie`, partie de `main` à jour (`fec4345`, F2 fusionnée). Poussée,
pas fusionnée ; rien n'a été lu ni écrit en production.

## En bref

- **Une case de réponse accepte un calcul**, comme dans Mastercam ou Catia. Tu tapes `(3-1)*2`, Entrée : la case
  affiche 4 et le curseur y reste. Un deuxième Entrée vérifie. Quitter la case (Tab, clic) calcule aussi, et
  « Vérifier » calcule toutes les cases avant d'envoyer.
- **Le serveur juge l'expression**, pas l'affichage : le navigateur la garde de côté et l'envoie. Si l'étudiant
  retouche le résultat à la main, l'expression est oubliée et c'est le nombre tapé qui part.
- **Un évaluateur écrit à la main** (`site/js/expression.js`), jamais `eval` ni `Function`, avec ta syntaxe (point 1),
  60 caractères et 10 niveaux de parenthèses au plus.
- **Dans le corrigé**, sous la case : « ta saisie : 4 × 350 / 0.75 ≈ 1866.6667 ». Partout ailleurs (ligne de calcul,
  écart en %, bandeau rouge, cohérence de f et de Vf, attestation), c'est le nombre qui sert.
- **Sur écran tactile seulement**, une rangée `( ) + − × ÷ π =` juste au-dessus du clavier virtuel. Ses boutons ne
  prennent pas le focus, pour que le clavier reste ouvert.
- Tests : **724** (694 avant). `test:api` : 35 étapes, dont une N sur deux tapée en calcul sur le vrai runtime des
  Workers. **Chrome** : 4 passes, 143 vérifications, aucun échec, aucune erreur console.
- **Six points à trancher** (§5), dont deux présentations que tu m'as demandé de proposer : le résultat trop long et
  l'emplacement de la rangée.

## 1. Ce qui a été fait

**D82** (DECISIONS) reprend tes huit points dans l'ordre. Elle ajoute des « précisions de mise en œuvre », que je te
soumets au §5. Le PLAN a les tâches du jalon F3 sous « Finition ».

**Le moteur** — `site/js/expression.js`, nouveau, pur, importé par le navigateur et par le serveur :

- `evaluateExpression(text)` lit la saisie en deux temps : d'abord l'arbre de l'expression (syntaxe), puis le calcul.
  Une expression mal formée l'est donc avant d'être une division par zéro (« 1/0 + » est mal formée). Le résultat est
  `{ value }`, à 12 chiffres significatifs (0.1 + 0.2 = 0.3), ou `{ error }` : `syntax`, `divisionByZero`, `negative`.
- Grammaire, de la priorité la plus faible à la plus forte : somme, produit, facteur. Un facteur est un moins unaire, un
  nombre, pi ou une parenthèse. `2pi`, `2(3)`, `(2)(3)` laissent un morceau non lu : mal formés.
- `expressionText(text)` écrit l'expression proprement : « 4*350/0,75 » → « 4 × 350 / 0.75 ».
- `computedText(value)` donne le nombre tel que la case l'affiche (§5, point 1).
- `isExpression(text)` dit si la saisie contient un opérateur, une parenthèse ou pi. C'est ce qu'Entrée essaie de
  calculer.

**`parseAnswer`** (`site/js/correction.js`) garde **ses deux lignes d'avant** pour un nombre. Seul ce qui n'est pas un
nombre passe par l'évaluateur. Un nombre se lit donc par le même code, et « 1,600 » vaut toujours 1.6.

**Le serveur** (`worker/seance.js`) :

- `cleanAnswers` garde 60 caractères. Au-delà, il garde les 60 premiers suivis de « … » : la saisie est illisible, et
  le journal montre ce qui a été envoyé. Avant, il coupait à 32 caractères sans le dire. C'était sans danger pour un
  nombre ordinaire, mais une expression coupée peut devenir une autre expression lisible.
- `cleanAnswers` ne filtre pas les caractères : `parseAnswer` refuse tout ce qui n'est pas dans ta liste. Il n'y a
  ainsi qu'une liste, pas deux à tenir d'accord. J'ai vérifié qu'une saisie n'est jamais mise dans du HTML : l'écran
  ne passe que par des nœuds de texte.
- `correctionView` donne à chaque champ `expression` : `null` pour un nombre, ou `{ texte, valeur, arrondie }`. La
  ligne de calcul écrit le nombre évalué : « Vf = N × f = 1451.4931 × 0.003 ». L'écart en % et la cohérence de f et de
  Vf prenaient déjà le nombre lu par `parseAnswer` : ils ont suivi d'eux-mêmes.
- `worker/attestation.js` n'a pas changé de code : il lisait déjà les réponses avec `parseAnswer`. Seuls ses
  commentaires le disent.

**L'écran Question** :

- **Règles pures, testées avant d'être branchées** (`site/js/ui/rules.js`) :
  - `computeCase` : le résultat à afficher, l'expression à envoyer, la note, ou la raison d'une expression illisible ;
  - `enterComputes` : Entrée calcule-t-elle ou vérifie-t-elle ;
  - `answerOf` : l'expression, ou le texte de la case ;
  - `CALC_KEYS` et `insertInCase` : la rangée de boutons.
- **Textes** (`text.js`) : `computedNote`, `unreadableNote`, `expressionLine` et `typedNumber`. « Juste (… attendu) »
  et le bandeau rouge prennent le nombre, jamais la formule.
- **Branchement** (`question-screen.js`) :
  - Entrée : `keydown`, `preventDefault` seulement quand elle calcule ;
  - sortie de la case : `focusout` ;
  - Vérifier : calcule toutes les cases, puis envoie ;
  - « Remplir » du mode test oublie les expressions ;
  - la case a `maxlength="60"`.
  - La virgule devient un point dans le même geste que le calcul (D71).
- **La rangée de boutons** : une barre fixée, placée au bas de la zone visible d'après `window.visualViewport`. Elle
  est hors des panneaux : leur halo (`filter`) l'aurait attachée au panneau au lieu de la fenêtre. Ses boutons
  empêchent `pointerdown` et `mousedown` : la case garde le focus. `tabindex="-1"` fait que Tab les saute, et chacun a
  un nom pour les lecteurs d'écran.
- **Styles** (`question.css`) : la rangée, ses boutons de 44 px, et la marge qu'elle réserve au bas de l'écran.

**Les documents** :

- SPEC §5 (séparateur décimal, renvoi au calcul) ;
- SPEC §6 : nouvelle section « Lecture d'une saisie » (nombre, expression, illisible, 60 caractères, le nombre partout) ;
- SPEC §7 (`saisies`, `correction.champs[].expression`, le journal) ;
- SPEC §8 (l'attestation montre le nombre d'une expression) ;
- UI §3.3 (paragraphe « Calculs dans les cases », rappel, case de 60 caractères) ;
- UI §3.4 (« ta saisie : … ») ;
- UI §7 (Entrée, Tab, la rangée pour l'accessibilité) ;
- `CLAUDE.md` : une ligne dans « Ce qu'il ne faut pas faire » : jamais `eval` ni `Function` pour lire une saisie, et
  pas de syntaxe nouvelle sans décision.

## 2. Ce qui a été vérifié

- `npm test` : **724** tests, `fail 0` (30 nouveaux). Ceux que tu as demandés :
  - `parseAnswer` : priorités, parenthèses, pi, virgules multiples (« 1,5+2,5 » = 4 ; « 1,2,3 » illisible ; « 1,600 »
    = 1.6), saisies illisibles ;
  - **non-régression** : une copie mot pour mot de l'ancienne fonction sert de référence. La comparaison porte sur
    toutes les saisies de 0 à 4 caractères d'un alphabet de chiffres, points, virgules, espaces (dont l'insécable),
    signes et lettres, plus 20 000 saisies de 5 à 40 caractères tirées à graine. Résultat : toute saisie lue avant
    donne **le même nombre** (`Object.is`), et toute saisie refusée qui n'est pas une expression reste refusée ;
  - **la route** `POST /api/correction` qui reçoit des expressions :
    - jugées sur leur nombre, dont une N avec 12 / π affichée arrondie ;
    - la correction porte l'expression ;
    - le journal garde le texte envoyé ;
    - l'attestation montre des nombres.

  Autour :
  - l'évaluateur : priorités, symboles, moins unaire, bruit de la virgule flottante, raisons d'illisibilité, 60
    caractères et 10 niveaux ;
  - un test qui échoue si `eval` ou `Function` apparaît dans `expression.js` ;
  - `cleanAnswers` et `correctionView` : expressions justes, fausses, illisibles ;
  - les règles et textes de l'écran.
- `npm run test:api` : **35 étapes** réussies sur `wrangler dev` et une vraie D1 locale. L'étape « Vc et RPM » tape
  maintenant une N sur deux en calcul, sur 22 questions : le vrai runtime des Workers les lit, les juge et renvoie
  leur expression, et l'attestation n'a que des nombres.
- **Chrome** (sans interface, contre un `wrangler dev` jetable, en mode test et en français), sur `m10-tournage-vc-rpm`
  et `test-complet`, à 1280 et 390 px. À 390 px, l'écran tactile est émulé (`pointer: coarse`) et les boutons sont
  touchés par de vrais événements tactiles. Ce que chaque passe vérifie dans le DOM :
  - `(3-1)*2` puis Entrée donne 4, le focus reste dans la case, la note dit « = (3 − 1) × 2 », rien n'est vérifié ;
  - une expression juste, deux Entrée : le premier calcule, le deuxième vérifie ; « ta saisie : … = … » sous la case ;
  - Vérifier avec une expression pas encore calculée : la case est calculée puis envoyée ; « ≈ » dans le corrigé ;
  - `2(3)` : le texte reste, en rouge, « Illisible : expression mal formée », le focus reste ; le deuxième Entrée
    vérifie : question ratée, « réponse vide ou illisible » ;
  - Tab calcule la case quittée ; une retouche du résultat oublie l'expression, et c'est le nombre tapé qui part ;
  - à 390 px, les boutons :
    - huit, dans l'ordre, de 44 px de haut et 40 px de large au moins, au bas de la zone visible, dans la largeur ;
    - « ( » remplace la sélection, « + » s'insère au curseur, le focus reste dans la case à chaque toucher ;
    - « = » calcule ; « π » après « 4 » donne « 4π », illisible ;
    - clavier simulé (zone visible réduite à 450 px) : la rangée suit le bas, et la case active reste au-dessus ;
    - la rangée se cache hors des cases et après la correction ;
    - Vérifier au toucher calcule et envoie ;
  - à 1280 px, aucune rangée ; rien ne déborde.

  Bilan : **143 vérifications, aucun échec** ; aucune erreur console, aucune exception, aucune requête hors du site.
- Ma première passe complète a signalé un échec, et **c'était mon scénario** : « N + 1/3 » sortait de la tolérance
  d'un filetage (+0.1 % sur N, ±0.01 % sur Vf), tiré dans `test-complet` à 390 px. Le serveur l'a jugé faux à bon
  droit. Je suis passé à « N + 1/3000 », toujours arrondi à l'affichage, et tout a été relancé sans toucher au site.
- Mesure : une case de réponse montre 9 caractères à 1280 px, 6 à 1000 px, 26 à 390 px (IBM Plex Mono 18 px).
- Captures (non versionnées) : `captures/finition-calcul-saisie/<exercice>-<largeur>/`, avec `rapport.json`.

## 3. Ce qui n'a pas changé

Ne changent pas :

- les tolérances, les formules, les compteurs, la cadence ;
- la question figée, la séance, les migrations ;
- l'attestation (elle lisait déjà les réponses avec `parseAnswer`, et montre la valeur), la page `/verifier` ;
- l'espace professeur : il ne montre pas les saisies ;
- la Gestion du contenu : ses champs décimaux gardent la seule conversion de la virgule (D71) ;
- les maquettes : UI.md fait foi (D17).

Un étudiant qui a encore l'ancienne page ouverte au déploiement n'a ni le calcul à Entrée ni la rangée jusqu'à ce
qu'il recharge. Mais s'il tape un calcul, le serveur le juge déjà.

## 4. Pour relire dans le navigateur

`npm run dev`, puis un exercice. Avec `MODE_TEST=1` dans `.dev.vars`, les cases arrivent remplies : efface-en une,
tape `(3-1)*2`, Entrée, puis Entrée encore. Pour voir la rangée de boutons dans Chrome :

- outils de développement, barre d'appareils, un téléphone (par exemple « iPhone 12 Pro ») ;
- **recharge la page** : le choix tactile se fait à l'affichage.

La vraie épreuve reste un téléphone : voir le point 2.

## 5. Points à trancher

1. **Un résultat trop long pour la case** — ce que je propose, puisque tu me l'as demandé :
   - la case montre le nombre jugé s'il tient en **9 caractères**, la largeur d'une case à 1280 px ;
   - sinon, le même nombre avec moins de chiffres significatifs, jusqu'à ce qu'il tienne : 4 × 350 / 0.75 →
     « 1866.6667 » ;
   - la note sous la case le signale par « ≈ » au lieu de « = » : « ≈ 4 × 350 / 0.75 ». Le serveur juge l'expression
     complète : l'arrondi n'est qu'à l'écran ;
   - dans le corrigé, j'écris « ta saisie : 4 × 350 / 0.75 ≈ 1866.6667 », avec le nombre de la case, plutôt que
     « = 1866.67 » de ton exemple : les deux montrent le même nombre.

   Entre 1000 et 1279 px, la case ne montre que 6 à 8 caractères. C'est déjà vrai aujourd'hui pour une avance tapée
   (« 0.00188 », 7 caractères) : je n'y ai pas touché.
2. **L'emplacement de la rangée** — ce que je propose : une barre en bas de la zone visible, **juste au-dessus du
   clavier virtuel**, comme la barre d'accessoires d'un clavier natif, sur toute la largeur.
   - Je la place avec `window.visualViewport`, parce que le clavier d'un iPhone (et d'un Android récent) ne réduit que
     la zone visible, pas la page. Une barre simplement fixée en bas passerait derrière le clavier.
   - Si elle couvre la case, la page remonte.
   - UI.md empile tout sur téléphone et veut des cibles de 44 px. Huit boutons de 44 px ne tiennent pas dans la
     largeur du panneau à 390 px (environ 326 px utiles), mais ils tiennent sur toute la largeur de l'écran.
   - **Vérifié dans Chrome émulé seulement**, sans vrai clavier virtuel : il faut l'essayer sur un vrai iPhone et un
     vrai Android. Le focus gardé au toucher, surtout, se vérifie mal ailleurs que sur un iPhone.
   - Sur téléphone, la première case reçoit le focus à chaque question, comme avant ce chantier. La rangée apparaît
     donc dès l'affichage de la question, avant même que le clavier s'ouvre. L'autre choix : ne la montrer qu'après un
     toucher dans une case.
3. **La note sous la case avant la correction** : ce n'était pas demandé. « = (3 − 1) × 2 » rappelle l'expression d'une
   case calculée. Pour une expression illisible, la case passe en rouge avec la raison : « Illisible : expression mal
   formée », « … division par zéro », « … résultat négatif ». Sur une expression illisible, le premier Entrée montre la
   note et le deuxième vérifie : sinon, Entrée ne vérifierait jamais une case illisible.
4. **Le rappel sous le formulaire** dit maintenant aussi « un calcul se tape tel quel : (3-1)*2 ». Sans lui, rien ne
   l'apprend à l'étudiant sur ordinateur. C'est une chaîne dans `question-screen.js` : facile à retirer.
5. **Détails de syntaxe** que j'ai tranchés à la lettre de ton point 1 (`// ❓` dans `expression.js`) :
   - `x` en minuscule seulement : « 2X3 » est illisible ;
   - `pi`, `PI` et `π` seulement : « Pi » est illisible ;
   - le tiret demi-cadratin « – » (que certains claviers mettent à la place de « - ») est illisible ;
   - « -0 » reste refusé : −0 compte comme négatif ;
   - « --5 » vaut 5 : deux moins unaires ;
   - pas de plus unaire : « +5 » reste refusé, comme avant.

   Dis-moi si tu veux élargir l'un d'eux : c'est une ligne chacun, avec son test.
6. **Les limites** : une expression de 60 caractères au plus, 10 niveaux de parenthèses. La case refuse d'en taper
   davantage, et la rangée n'insère plus rien au-delà. Un **nombre** de plus de 60 caractères, sans intérêt en pratique
   et que la case ne laisse pas taper, passe par la même limite du serveur : il est maintenant illisible, alors qu'il
   était coupé à 32 caractères avant.

## 6. Commits

1. D82 ; les tâches du jalon F3 dans le PLAN.
2. `expression.js` et `parseAnswer`, avec leurs tests (dont la non-régression).
3. Serveur : `cleanAnswers`, `correctionView` ; tests, dont la route qui reçoit des expressions.
4. Règles et textes de l'écran, purs et testés.
5. Écran Question et rangée de boutons (`question-screen.js`, `question.css`).
6. Documents : SPEC §5, §6, §7, §8 ; UI §3.3, §3.4, §7 ; `CLAUDE.md` ; `test:api` (une N sur deux en calcul).
7. PLAN coché et ce rapport.

## 7. Suite (réponses au rapport, même branche)

> **Correction des séances en cours : toujours le changement annoncé en tête**, qui arrive au déploiement. La retouche
> y ajoute une seule chose côté serveur : il lit aussi `Pi`, `pI`, `X` et « – ». Le reste de la retouche se passe dans
> le navigateur : une expression illisible n'y part plus, et la rangée de boutons attend un toucher.

**Tes réponses**, consignées à la fin de **D81** et de **D82** :

- **F2** : tes cinq propositions sont gardées telles quelles, rien à changer dans le code.
- **F3, acceptés** (points 1, 3, 4 et 6) : 9 caractères et « ≈ », la note sous la case, le rappel sous le formulaire,
  les limites.
- **F3, trois retouches** : une expression illisible ne part jamais ; la syntaxe élargie ; la rangée seulement après
  un toucher.
- **Ensuite** : tu essaies sur ton téléphone, puis tu fusionnes toi-même, hors des périodes de labo.

### La retouche

1. **Une expression illisible ne part jamais.**
   - Vérifier (clic, toucher, ou Entrée dans une case) calcule toutes les cases. Si l'une d'elles contient une
     expression illisible, **rien n'est envoyé** : la première, dans l'ordre de l'écran, reçoit le focus, en rouge
     avec sa raison. Une faute de frappe dans un calcul ne coûte plus une série.
   - La règle est `unreadableCase`, pure et testée (`rules.js`).
   - **Entrée** calcule toute expression et ne vérifie jamais une case illisible. `enterComputes` n'a plus de
     deuxième Entrée, et l'état « déjà essayé » a disparu de l'écran.
   - **« 12a »** (illisible, mais sans opérateur, parenthèse ni pi) part comme avant et reste une mauvaise réponse.
   - Le serveur n'a pas changé : il juge toujours illisible une expression mal formée qu'il recevrait.
   - Conséquence à connaître : **« -5 »** et **« 12x »** sont maintenant retenus eux aussi. Le moins et le x en font
     des expressions : la première est illisible parce que son résultat est négatif, la seconde parce qu'elle est mal
     formée. Ils étaient envoyés et jugés faux ; ils ne partent plus. « 12a » et « abc » partent comme avant.
2. **Syntaxe élargie** (`expression.js`) :
   - `pi` sans égard à la casse (`pi`, `Pi`, `PI`, `pI`, `π`) ;
   - `x` et `X` ;
   - le tiret demi-cadratin « – » comme moins.

   Ne changent pas :
   - « -0 » et « +5 » restent refusés, et « --5 » vaut toujours 5 ;
   - un nombre se lit toujours exactement comme avant : même test de non-régression, toujours vert.
3. **La rangée après un toucher.**
   - À l'affichage d'une question, la première case reçoit le focus comme avant, mais la rangée ne se montre pas.
   - Elle apparaît au premier toucher dans une case, y compris dans la case qui avait déjà le focus : c'est le
     `pointerdown` qui la déclenche, puisque cette case ne reçoit pas de nouvel événement focus.
   - Ensuite, elle suit le focus d'une case à l'autre, et revient quand Vérifier donne le focus à une case illisible.
   - Chaque nouvelle question repart sans rangée.

**Les documents** :
- SPEC §6 (syntaxe élargie) et §7 (le navigateur n'envoie jamais une expression illisible ; le serveur n'en dépend pas) ;
- UI §3.3 (l'expression illisible retenue, « 12a » qui part, la rangée après un toucher) et §7 (Entrée, Vérifier) ;
- PLAN : F2 tranché, tâches de la retouche du F3.

### Vérifié

- `npm test` : **725** tests, `fail 0`. Nouveau : `unreadableCase`. Mis à jour :
  - `enterComputes` : plus de deuxième Entrée sur une case illisible ;
  - l'évaluateur, `isExpression`, `expressionText` et `parseAnswer` : « Pi*2 », « 2X3 », « 4–1 », « -Pi », « –5 » ;
  - la non-régression, inchangée, toujours verte.
- `npm run test:api` : **35 étapes** réussies sur `wrangler dev` et une vraie D1 locale.
- **Chrome**, à 1280 et 390 px, sur `m10-tournage-vc-rpm` et `test-complet` : **185 vérifications, aucun échec**,
  aucune erreur console, aucune requête hors du site. En plus de celles du rapport :
  - « 2(3) », deuxième Entrée : aucune requête de correction, focus dans la case, en rouge ;
  - un vrai clic (à 390 px, un vrai toucher) sur **Vérifier**, le focus dans une autre case : aucune requête, la case
    illisible reçoit le focus, en rouge avec « Illisible : expression mal formée » ;
  - Entrée dans une autre case : aucune requête, le focus revient à la case illisible ;
  - « 1/0 » puis Vérifier : aucune requête, « Illisible : division par zéro » ;
  - « 12a » : ni rouge ni note ; Vérifier envoie une seule correction, « réponse vide ou illisible » ;
  - « Pi*2 » donne « 6.2831853 », « ≈ π × 2 » ; « 2X3 » donne 6 ; « 4–1 » donne 3 ;
  - à 390 px, première case avec le focus et sans rangée à chaque question ; la rangée au premier toucher.
- Pour compter ce qui part, le script compte les requêtes `/api/correction` du navigateur.
- Captures (non versionnées) : `captures/finition-calcul-saisie/`, dont `05-verifier-refuse.png` et, à 390 px,
  `00-affichage-sans-rangee.png`.

### Essayer sur ton téléphone

Le poste et le téléphone sur **le même Wi-Fi**. Le 2026-09-28, le Wi-Fi du poste (réseau « ORICOM30617 ») avait
l'adresse **192.168.68.56**. Elle est donnée par le routeur et peut changer : `ipconfig` dans un terminal, rubrique
« Carte réseau sans fil Wi-Fi », ligne « Adresse IPv4 ».

1. **Lancer le serveur local, ouvert au Wi-Fi.** Dans le dossier du projet :

   ```
   npm run dev -- --ip 0.0.0.0
   ```

   C'est `npm run dev` (migrations locales, puis `wrangler dev`), avec le serveur à l'écoute sur toutes les cartes
   réseau au lieu du seul poste.
2. **Sur le téléphone**, taper l'adresse en entier, avec `http://` : **`http://192.168.68.56:8787`**, puis choisir un
   exercice.
3. **Le pare-feu Windows.**
   - Windows range ce Wi-Fi dans les réseaux **publics**. D'abord, le passer en **privé** (c'est ton réseau à la
     maison) : Paramètres → Réseau et Internet → Wi-Fi → « ORICOM30617 » → Type de profil réseau : **Réseau privé**.
   - Au premier lancement, Windows peut demander d'autoriser l'accès pour `workerd.exe` ou `node.exe`. Coche
     **Réseaux privés** seulement, décoche Réseaux publics, puis « Autoriser ».
   - Si rien n'est demandé et que le téléphone n'arrive pas à ouvrir la page (délai dépassé), ouvre une règle pour le
     port 8787, sur les réseaux privés seulement. Dans un PowerShell **en administrateur** :

     ```
     New-NetFirewallRule -DisplayName "Quiz - wrangler dev 8787" -Direction Inbound -Protocol TCP -LocalPort 8787 -Action Allow -Profile Private
     ```

     Pour la retirer après l'essai :

     ```
     Remove-NetFirewallRule -DisplayName "Quiz - wrangler dev 8787"
     ```
   - Si ça ne passe toujours pas : le téléphone est-il bien sur le Wi-Fi, pas sur le réseau cellulaire ? Un réseau
     « invité » isole souvent les appareils les uns des autres.
4. **Pas de mode test sur le téléphone** : le serveur ne l'accorde qu'à `localhost` (D26). Il n'y a donc pas de bouton
   « Remplir », et la cadence de 10 s s'applique entre deux corrections. C'est voulu.
5. **À la fin**, Ctrl+C dans le terminal. `npm run dev` sans `--ip` redonne un serveur que seul le poste voit.

**À essayer** (sur iPhone, et sur Android si tu en as un sous la main) :

- [ ] À l'affichage d'une question, **pas de rangée**. Toucher la case Vc : le clavier s'ouvre, et la rangée apparaît
  **juste au-dessus du clavier**.
- [ ] Taper `3`, toucher **×**, taper `2` : **le clavier reste ouvert** à chaque toucher d'un bouton, et le curseur
  reste dans la case.
- [ ] Toucher **=** : la case affiche 6, et la note « = 3 × 2 » apparaît dessous.
- [ ] **La rangée suit le clavier** : fais défiler la page, passe d'une case à l'autre (flèches du clavier de
  l'iPhone). La rangée reste collée au-dessus du clavier.
- [ ] **Fermer le clavier.** Sur iPhone, « OK » quitte la case : la rangée disparaît avec le clavier. Sur Android, la
  touche retour ferme le clavier **sans quitter la case** : la rangée reste alors au bas de l'écran jusqu'à ce que tu
  touches ailleurs. C'est la règle « tant qu'une case a le focus » ; dis-moi si ça te gêne.
- [ ] **La case active n'est jamais cachée** par la rangée, même la case N, plus bas.
- [ ] Taper `2(3)` et toucher **Vérifier** : **rien ne part**, la case est rouge, « Illisible : expression mal
  formée », et elle a le focus. Efface-la, tape la bonne valeur, Vérifier : la correction arrive.
- [ ] En passant : `pi` tapé avec la majuscule automatique (« Pi×2 ») est lu.

Dis-moi ce qui ne va pas, avec le modèle du téléphone. La place de la rangée ne se règle qu'à partir de ce qu'on voit
sur un vrai appareil.

### Commits de la suite

8. Tes réponses consignées à la fin de D81 et de D82 ; PLAN.
9. La syntaxe élargie, avec ses tests.
10. Une expression illisible ne part jamais (`unreadableCase`, `enterComputes`, écran), avec ses tests.
11. La rangée après un toucher ; vu dans Chrome.
12. Documents (SPEC §6, §7 ; UI §3.3, §7), cette section et le PLAN coché.
