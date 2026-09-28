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

*Procédure corrigée après ton essai.* Elle passait par le serveur local ouvert au Wi-Fi, ce qui a deux défauts :
- sous PowerShell, `npm run dev -- --ip 0.0.0.0` perd son `--` ;
- sous Windows 11, le pare-feu ouvre `workerd.exe` d'un coup aux réseaux publics et privés.

Elle passe maintenant par le **tunnel intégré de wrangler**. La liste des choses à essayer est à la section 8.

1. Dans le dossier du projet, lance `npx wrangler dev`. Tu peux aussi lancer `npm run dev`, qui applique d'abord les
   migrations locales ; cette branche n'en ajoute aucune.
2. Quand le serveur est prêt, appuie sur **t** (« start tunnel »). Wrangler affiche une adresse
   **`https://…trycloudflare.com`**, tirée au hasard et différente à chaque fois. La première fois, il peut d'abord
   télécharger `cloudflared` et te demander de confirmer.
3. **Sur le téléphone**, ouvre cette adresse, en Wi-Fi comme en données cellulaires. Il n'y a **aucun pare-feu à
   ouvrir** : le tunnel part du poste, et rien n'y entre directement.
4. Le tunnel se ferme de lui-même au bout d'une heure ; **a** le prolonge d'une heure.
5. Pour fermer, appuie sur **t** de nouveau (le tunnel seul) ou sur **Ctrl+C** (le tunnel et le serveur).

À savoir :
- **Tant que le tunnel est ouvert, quiconque a l'adresse joint ton serveur local**, y compris la Gestion du contenu,
  protégée par les clés de `.dev.vars`. Ferme-le après l'essai.
- **Pas de mode test sur le téléphone** : le serveur ne l'accorde qu'à `localhost` (D26). Il n'y a donc pas de bouton
  « Remplir », et la cadence de 10 s s'applique entre deux corrections. C'est voulu.

### Commits de la suite

8. Tes réponses consignées à la fin de D81 et de D82 ; PLAN.
9. La syntaxe élargie, avec ses tests.
10. Une expression illisible ne part jamais (`unreadableCase`, `enterComputes`, écran), avec ses tests.
11. La rangée après un toucher ; vu dans Chrome.
12. Documents (SPEC §6, §7 ; UI §3.3, §7), cette section et le PLAN coché.

## 8. Retouche après l'essai sur téléphone (même branche)

> **Correction des séances en cours : rien de plus que ce qu'annonce la tête du rapport.** Cette retouche ne touche que
> l'écran Question sur écran tactile, dans le navigateur.

**Ton essai** (Android) : une décision et deux bogues, consignés à la fin de **D82** (« Retouche après l'essai sur
téléphone »).

### Ce qui a changé

1. **Sur écran tactile, aucune case ne reçoit le focus à l'affichage d'une question.**
   - Le focus va au titre, et la page part du haut. Le clavier ne s'ouvre que quand l'étudiant touche une case.
   - Le critère est celui de la rangée : `pointer: coarse`.
   - La règle est `initialFocus`, pure et testée (`rules.js`).
   - Sur ordinateur, rien ne change : la première case à saisir reçoit le focus. C'est vérifié à 1280 px.
2. **La rangée suit simplement le focus des cases.**
   - Elle se montre quand une case prend le focus : un toucher, ou Vérifier qui donne le focus à une case illisible.
   - Elle se cache quand le focus quitte les cases.
   - L'état « case touchée » et `touchCase` sont retirés.
   - **Ton bogue 1** (la rangée absente en touchant la case déjà focalisée) : je ne l'ai pas reproduit dans Chrome
     émulé, où toucher cette case montrait la rangée. Sa cause sur ton téléphone n'est donc pas établie. Ce cas n'existe
     plus : sur écran tactile, aucune case n'a le focus à l'affichage, et la rangée n'a plus de condition en plus du
     focus.
3. **La page ne défile jamais d'elle-même pendant que l'étudiant fait défiler.**
   - **Ton hypothèse est confirmée** dans Chrome, à 390 px, écran tactile émulé, avant la correction :
     - clavier ouvert, un défilement au doigt vers le haut met la page à 235 px, la case Vc sortie par le bas ;
     - la zone visible passe de 844 à 790 px, comme une barre d'adresse qui paraît ;
     - `place()`, appelée par l'événement `resize`, fait `scrollBy` : la page saute à 639 px et ramène la case juste
       au-dessus de la rangée.
   - **Maintenant**, au défilement et quand la zone visible change de hauteur, `place()` ne fait que replacer la
     rangée. Après la correction, dans le même essai, la page reste à 238 px.
   - La seule remontée automatique reste celle-ci : quand une case prend le focus et que le clavier s'ouvre, si la
     rangée couvre alors la case. Elle s'arme à la prise de focus, et **se désarme au premier geste de défilement** de
     l'étudiant (`touchmove`, `wheel`).
4. **La procédure d'essai passe par le tunnel de wrangler** (section 7, corrigée), et le rapport ne dit plus rien de ton
   réseau.

### Deux points à savoir

1. **« Une fois »**, dans ta règle, est codé ainsi : la remontée est permise de la prise de focus jusqu'au premier geste
   de défilement, pas limitée à un seul `scrollBy`.
   - Pourquoi : l'ouverture du clavier peut changer la zone visible plus d'une fois, et Chrome fait lui-même défiler la
     case au-dessus du clavier. Une remontée unique, faite trop tôt (le clavier pas encore ouvert), laisserait la case
     sous la rangée.
   - En pratique, c'est une remontée, à l'ouverture du clavier, et jamais pendant que tu fais défiler.
   - Dis-moi si tu veux la limiter à un seul mouvement.
2. **Ton réseau reste dans l'historique Git.** Le nom du Wi-Fi et l'adresse du poste sont retirés du rapport, mais ils
   restent dans l'historique de la branche, déjà poussée (commit `217c33d`). C'est une adresse privée, qui ne sert qu'à
   l'intérieur de ton réseau. Pour les effacer de l'historique, il faudrait réécrire la branche et la pousser de force :
   je ne l'ai pas fait. Dis-moi si tu le veux.

### Vérifié

- `npm test` : **726** tests, `fail 0`. Nouveau : `initialFocus`.
- `npm run test:api` : **35 étapes** réussies.
- **Chrome, scénario téléphone** (390 px, écran tactile émulé, vrais événements tactiles) : **11 vérifications,
  aucun échec** sur le code corrigé ; sur le code d'avant, 5 échecs, ceux attendus. Les vérifications :
  - à l'affichage, le titre a le focus, aucune case, la page est en haut, pas de rangée ;
  - toucher la case montre la rangée ;
  - défiler au doigt vers le haut jusqu'à ce que la case sorte par le bas ;
  - changer la hauteur de la zone visible (844 → 790 px) : la page ne bouge pas ;
  - un petit défilement vers le bas : la page avance de ce défilement, et la case ne revient pas ;
  - la zone visible reprend 844 px : toujours rien, et la rangée reste au bas de la zone visible ;
  - une case couverte par la rangée, qui prend le focus au toucher, remonte au-dessus d'elle ;
  - à 1280 px, la première case a le focus.

  Deux limites de ce scénario :
  - `Input.synthesizeScrollGesture` ne fait pas défiler dans Chrome sans interface. Les défilements sont donc des
    suites de `touchStart`, `touchMove` et `touchEnd`, qui envoient les mêmes `touchmove` qu'un doigt.
  - La barre d'adresse est simulée en changeant la hauteur de la fenêtre.
- **Chrome, scénario complet**, mis à jour pour le nouveau focus : `m10-tournage-vc-rpm` et `test-complet`, à 1280 et
  390 px. **189 vérifications, aucun échec**, aucune erreur console, aucune requête hors du site. Il vérifie aussi :
  - à chaque question, sur téléphone, le titre a le focus et la page part du haut ;
  - la rangée apparaît quand Vérifier donne le focus à une case illisible.
- Captures (non versionnées) : `captures/finition-calcul-saisie-telephone/` et `captures/finition-calcul-saisie/`.

### À essayer de nouveau sur ton téléphone (avec le tunnel, section 7)

- [ ] À l'affichage d'une question : la page part du haut, le clavier reste fermé, pas de rangée.
- [ ] Toucher la case Vc : le clavier s'ouvre, et la rangée apparaît juste au-dessus.
- [ ] Clavier ouvert, remonter relire le diamètre de l'outil, redescendre un peu, remonter, plusieurs fois : **la page
  ne saute plus**.
- [ ] Toucher une case basse, près du clavier : elle remonte **une fois** au-dessus de la rangée.
- [ ] Taper `3`, toucher ×, taper `2`, toucher = : le clavier reste ouvert, et la case affiche 6.
- [ ] Taper `2(3)`, toucher Vérifier : rien ne part, la case rouge a le focus, et la rangée est là.
- [ ] Sur Android, la touche retour ferme le clavier sans quitter la case : la rangée reste alors au bas de l'écran
  jusqu'à ce que tu touches ailleurs. C'est le comportement prévu ; dis-moi s'il te gêne.

### Commits de cette retouche

13. Focus à l'affichage sur écran tactile (`initialFocus`) ; la rangée suit le focus.
14. La page ne défile jamais d'elle-même.
15. Documents (D82, UI §3.3, §7), la procédure du tunnel, cette section et le PLAN.

## 9. Retouche après le deuxième essai sur téléphone (même branche)

> **Correction des séances en cours : rien de plus que ce qu'annonce la tête du rapport.** Cette retouche ne touche que
> la rangée de boutons, dans le navigateur, et ajoute un diagnostic temporaire.

**Ton deuxième essai** (Android) : le saut de la page est corrigé, le focus à l'affichage est gardé. Le bogue de la
rangée invisible, mieux décrit : ce n'est pas le focus d'avant, c'est **le sens du défilement** que fait Chrome pour
placer la case touchée au-dessus du clavier. Case dans la moitié inférieure → la page monte, rangée visible ; case dans
la moitié supérieure → la page descend, rangée invisible. Consigné à la fin de **D82**.

### Ton hypothèse

**Le mécanisme existe, le cas n'est pas reproduit.**

- Ce que je peux montrer sur le poste, avec une page d'essai dans Chrome à 390 px, écran tactile émulé : **un
  défilement de la page n'envoie que `scroll` à `window`, jamais à `visualViewport`** — au doigt (26 `win:scroll`,
  0 `vv:scroll`) comme par `scrollBy`. La rangée ne se replaçait que sur les événements de `visualViewport` : si
  Chrome, sur ton téléphone, amène la case vers le centre en faisant défiler la page elle-même, rien ne la replaçait.
- Ce que je ne peux pas montrer : **Chrome sans interface ne sait pas ouvrir un clavier**, ni réduire la zone visible
  sous la fenêtre. J'ai essayé le paramètre `viewport` de l'émulation d'appareil et le zoom par pincement : la zone
  visible reste à 844 px dans les deux cas. Je n'ai donc pas vu la rangée disparaître, et je ne sais pas pourquoi
  elle disparaîtrait dans ce cas-là plutôt que de rester où elle est : fixée, elle ne bouge pas quand la page
  défile. C'est le diagnostic qui le dira.

### Ce que j'ai fait, et pourquoi ce choix

**Piste 1, appliquée.** La rangée se replace :
- sur `scroll` et `resize` de `window`, en plus de ceux de `visualViewport` ;
- **à chaque image pendant 600 ms après la prise de focus** (`requestAnimationFrame`), le temps que le clavier
  s'ouvre — quels que soient les événements que Chrome envoie ou n'envoie pas, et même si un événement arrive avant
  la fin de l'animation du clavier, avec une hauteur pas encore définitive.

Toujours un replacement seulement : la page ne défile jamais d'elle-même, sauf la remontée de la retouche précédente,
qui reste armée jusqu'au premier geste de défilement.

**Piste 2, en réserve : `interactive-widget=resizes-content`.** Je ne l'ai pas ajoutée, pour deux raisons :
1. **Une chose à la fois.** Si j'ajoutais les deux, ton prochain essai ne dirait pas laquelle corrige, et le
   diagnostic ne servirait à rien. La piste 1 est la moins intrusive : rien ne change pour la page, seulement quand la
   rangée relit sa position.
2. **Je ne peux pas vérifier ce qu'elle change ailleurs.** Avec elle, Chrome sur Android réduit toute la page à
   l'ouverture du clavier : l'écran d'identification, dont les cases ouvrent aussi le clavier, se remettrait en page
   à chaque ouverture. Le poste ne peut pas montrer l'effet, faute de clavier. Ce que j'ai regardé dans la CSS : le
   corps de page a `min-height: 100dvh` (il suivrait la réduction, sans mal) ; les feuilles de référence sont fixées
   sur toute la fenêtre (pas de clavier là) ; rien d'autre ne dépend de la hauteur de la fenêtre. Le risque est donc
   faible, mais ce n'est pas vérifié.

Si le diagnostic montre que la rangée est bien replacée et reste pourtant sous le clavier, c'est que Chrome ne dit pas
la vraie zone visible : alors la piste 2, qui n'a plus besoin de la connaître pour Android. C'est une ligne dans
`site/index.html` ; la formule par `visualViewport` reste juste avec elle (la zone visible devient la fenêtre réduite),
donc le code ne change pas, seulement l'iPhone continue de dépendre de `visualViewport`.

### Le diagnostic (`?diag=1`)

`https://…trycloudflare.com/?exercice=m10-tournage-vc-rpm&diag=1` : un encadré noir en haut de l'écran, mis à jour à
chaque image :
- `zone visible : h … décalage … (fenêtre …)` — `visualViewport.height`, `offsetTop`, `innerHeight` ;
- `scrollY …` ;
- `rangée : visible|cachée haut … bas … — translate(…)` — sa position à l'écran et la transformation posée ;
- `case active : vc haut … bas …` ;
- `dernier événement : … hh:ss.mmm`.

Ce que je voudrais lire sur tes deux captures, une fois le clavier ouvert :
- **la hauteur de la zone visible** : si elle vaut encore celle de la fenêtre, Chrome ne réduit pas la zone visible et
  la formule ne peut pas marcher → piste 2 ;
- **`bas` de la rangée contre `décalage + h`** : égaux, la rangée est là où elle doit être, et si elle est pourtant
  invisible, c'est autre chose que sa position ;
- **le dernier événement** dans le cas « case en haut ».

Il n'a aucun effet sans `?diag=1`, et `npm test` reste vert. **À retirer avant la fusion** : `site/js/ui/diag.js`, son
import et l'appel `startDiag` dans `main.js`, le style `.diag` de `question.css` (chacun marqué « DIAGNOSTIC
TEMPORAIRE »).

### Vérifié

- `npm test` : **726** tests, `fail 0`.
- `npm run test:api` : **35 étapes** réussies.
- **Chrome, 390 px, écran tactile émulé** (14 vérifications, aucun échec, aucune erreur console) :
  - la case Vc placée dans la moitié supérieure, touchée : rangée au bas de la zone visible, la case au-dessus ; la
    page descend de 120 px par `scrollBy`, comme Chrome le ferait : la rangée est toujours au bas ; clavier simulé
    (fenêtre à 450 px) puis la page qui descend encore : toujours au bas ;
  - la case N placée dans la moitié inférieure, touchée : la remontée la met au-dessus de la rangée, rangée au bas ;
    clavier simulé puis la page qui monte : toujours au bas ;
  - la page ne défile toujours pas d'elle-même : la case sortie par le bas, une barre d'adresse simulée et un petit
    défilement vers le bas ne la ramènent pas ;
  - le diagnostic : absent sans `?diag`, présent avec, avec ses cinq lignes, l'événement daté ;
  - à 1280 px : la première case a le focus, pas de rangée, pas de diagnostic.
- Les deux scénarios précédents, rejoués : 189 et 11 vérifications, aucun échec.
- Captures (non versionnées) : `captures/finition-calcul-saisie-telephone-2/`.

### À essayer (avec le tunnel, section 7)

- [ ] Case Vc dans la moitié **supérieure** de l'écran, touchée : la rangée est-elle au-dessus du clavier ? Capture
  avec `?diag=1`.
- [ ] Case Vc dans la moitié **inférieure**, touchée : même chose, capture avec `?diag=1`.
- [ ] Clavier ouvert, remonter relire le diamètre, redescendre un peu : la page ne saute pas.
- [ ] Si la rangée reste invisible dans le premier cas, dis-le-moi avec les deux captures : j'ajoute la piste 2.

### Commits de cette retouche

16. La rangée replacée sur `scroll` et `resize` de `window` et à chaque image pendant l'ouverture du clavier ; le
    diagnostic temporaire ; vu dans Chrome.
17. Documents (D82, UI §3.3), cette section et le PLAN.

## 10. Retouche après le troisième essai sur téléphone (même branche)

> **Correction des séances en cours : rien de plus que ce qu'annonce la tête du rapport.** Cette retouche ne touche que
> la rangée de boutons, dans le navigateur, et le diagnostic temporaire.

**Ton troisième essai** (Android, avec `?diag=1`) a donné la cause : la rangée était replacée juste d'après ce que
Chrome dit de la zone visible, et Chrome se trompait de 56 px — la hauteur de sa barre d'adresse — quand elle
réapparaît. Ta décision : la rangée quitte l'écran et s'attache à la case, dans la page. Consigné à la fin de **D82**.

### Ce qui a changé

1. **La rangée est dans la page**, insérée entre la case qui a le focus et sa note, et défile avec la case.
   - Elle suit le focus : elle se déplace d'une case à l'autre, et se cache quand le focus quitte les cases.
   - La note reste visible dessous, le rouge d'une expression illisible compris ; ce qui suit descend d'autant.
   - Largeur : celle de la case, ou 334 px au moins pour huit boutons de 40 px avec 2 px d'écart. À 390 px, la case
     fait 314 px : la rangée déborde de 10 px de chaque côté, dans la marge du panneau (32 px), sans élargir la page.
   - Retirés : le placement par `visualViewport`, les écoutes de `scroll` et `resize` de `window`, le replacement à
     chaque image, la marge réservée au bas de l'écran, la position fixée. Le code de la rangée a fondu de moitié.
2. **La seule remontée automatique**, à la prise de focus : `scrollIntoView({ block: 'nearest' })` sur le bloc de la
   case (libellé, case, rangée, note), par le navigateur. Elle se fait à la prise de focus, puis chaque fois que la zone
   visible change de taille — c'est le clavier qui s'ouvre ; l'événement `resize` de `visualViewport` ne sert que de
   moment, aucune de ses valeurs n'est lue —, et se désarme au premier geste de défilement, comme avant.
3. **Un bogue trouvé en vérifiant, corrigé** : la rangée se cache **un instant après** que le focus quitte la case,
   une fois le toucher terminé. Sans cela, un toucher sur **Vérifier** se perdait : le focus quitte la case dès que le
   doigt se pose, la rangée disparaissait, la page se décalait de 50 px sous le doigt, et le clic n'atteignait plus le
   bouton. Dans Chrome, c'est exactement ce qui s'est passé au premier passage du scénario complet (le toucher sur
   Vérifier ne faisait plus rien). Même chose pour « Ouvrir la table ». Si une autre case a pris le focus entre-temps,
   la rangée l'a déjà suivie : rien à cacher.
4. **`interactive-widget=resizes-content`, écartée** : elle aurait fait dépendre la rangée de ce que Chrome dit de la
   fenêtre — faux de 56 px dans ce cas.
5. **Le diagnostic**, adapté : case active (haut, bas), rangée (visible ou cachée, haut, bas, dans le bloc de quelle
   case), `scrollY`, dernier événement daté. J'ai gardé la zone visible en première ligne : elle ne coûte rien et c'est
   elle qui a permis de lire tes captures.
6. **Section 8, point 2** : l'historique Git n'est pas réécrit, comme tu l'as demandé.

### Ce que je ne peux pas vérifier ici

- **Le clavier, toujours.** Chrome sans interface ne l'ouvre pas ; la remontée par `scrollIntoView` est vérifiée avec
  une case placée en bas de l'écran (la page remonte de 54 px, juste assez), et avec l'événement `resize` envoyé à la
  main. Ce que fera Chrome sur Android à l'ouverture réelle du clavier — sa propre remontée de la case, puis la
  nôtre —, seul ton téléphone le dira.
- **iPhone** : Safari ouvre aussi le clavier en réduisant la zone visible, et fait défiler la page pour montrer la
  case. La rangée étant dans la page, elle suit ; la remontée par `scrollIntoView` s'appuie sur Safari. Aucun calcul
  qui lui soit propre.

### Vérifié

- `npm test` : **726** tests, `fail 0`.
- `npm run test:api` : **35 étapes** réussies.
- **Chrome, 390 px, écran tactile émulé** (23 vérifications, aucun échec, aucune erreur console) :
  - la case placée dans le **haut** (10 %), au **milieu** (45 %) et en **bas** (92 %) de l'écran, touchée : la rangée
    est collée sous la case (6 px d'écart), la note collée sous la rangée, tout visible, huit boutons de 44 × 40 px, la
    rangée dans la largeur de l'écran, la page pas plus large que l'écran ; dans le bloc de la case, l'ordre est
    libellé, case, rangée, note ;
  - en haut et au milieu, la page n'a pas bougé ; en bas, où la rangée et la note ne tenaient pas, la page est
    remontée une fois, de 54 px, juste assez ;
  - les boutons : « (3−1)×2 » tapé aux boutons, le focus dans la case à chaque toucher ; « + » inséré au curseur ;
    « = » calcule, la note « = (3 − 1) × 2 » visible sous la rangée ; « 2(3) » puis « = » : la case et la note en
    rouge, « Illisible : expression mal formée », visible sous la rangée ;
  - le focus passe à N : la rangée le suit, plus rien dans le bloc de Vc ; hors des cases : elle se cache ;
  - la page ne défile pas d'elle-même : case et rangée sorties par le bas au doigt, un changement de la zone visible
    (`resize` envoyé) puis un petit défilement vers le bas ne la ramènent pas ;
  - le diagnostic : absent sans `?diag`, présent avec ses cinq lignes, l'événement daté.
- **Chrome, scénario complet** (`m10-tournage-vc-rpm`, `test-complet`, 1280 et 390 px) : **189 vérifications, aucun
  échec** — dont, à 390 px, le toucher sur Vérifier avec une expression illisible (la case rouge reçoit le focus, la
  rangée y vient) et Vérifier au toucher qui calcule et envoie.
- À 1280 px : la première case a le focus, pas de rangée, pas de diagnostic ; le bloc d'une case reste libellé, case,
  note.
- Captures (non versionnées) : `captures/finition-calcul-saisie-telephone-3/`.

### À essayer (avec le tunnel, section 7 ; Android, puis iPhone)

- [ ] Toucher une case dans le **haut** de l'écran : la rangée est collée dessous, la note dessous, le clavier ouvert.
- [ ] Toucher une case dans le **bas** de l'écran : la page remonte une fois, la case, sa rangée et sa note sont
  au-dessus du clavier.
- [ ] Clavier ouvert, remonter relire le diamètre, redescendre : la page ne saute pas.
- [ ] Taper `3`, toucher ×, taper `2`, toucher = : le clavier reste ouvert, la case affiche 6.
- [ ] Taper `2(3)`, toucher **Vérifier** : le toucher est pris, rien ne part, la case rouge a le focus avec sa rangée.
- [ ] Une expression juste, toucher **Vérifier** : la correction arrive (le toucher n'est pas perdu).
- [ ] Toucher **Ouvrir la table** depuis une case : les tables s'ouvrent.
- [ ] Si quelque chose cloche, une capture avec `?diag=1`.

### Commits de cette retouche

18. La rangée dans la page, sous la case active ; la remontée par `scrollIntoView` ; le masquage différé ; le
    diagnostic adapté ; vu dans Chrome.
19. Documents (D82, UI §3.3, §7), cette section et le PLAN.
