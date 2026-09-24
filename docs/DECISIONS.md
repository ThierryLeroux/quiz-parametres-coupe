# Journal des décisions

Une entrée par décision structurante. On ne réécrit pas une décision : on en
ajoute une nouvelle qui la remplace. Format : contexte → décision → conséquences.

---

## D1 — Migrer le quiz vers une page web statique (2026-09-19, décidée)

**Contexte.** Le quiz actuel est un classeur Excel/VBA avec contrôles ActiveX,
jugé fragile (versions d'Office, macros bloquées, ActiveX absent sur Mac) et
difficile à faire durer.

**Décision.** Réécrire le quiz en HTML/CSS/JS, hébergé sur GitHub Pages. Le
classeur devient une référence figée (`legacy/`), plus maintenu.

**Conséquences.** Tout le comportement doit être re-spécifié (`SPEC.md`) et
testé ; les données sortent d'Excel vers JSON (`data/`).

## D2 — Portée v1 : tournage + fraisage + perçage complets (2026-09-19, décidée)

**Décision.** La v1 couvre les 29 outils, 19 opérations et 5 paramètres, avec un
mécanisme de configuration d'exercice qui reproduit le M10 « Vc seulement » comme
cas particulier.

**Conséquences.** Le moteur est générique dès le départ ; on livre par jalons
(voir `PLAN.md`) mais sans architecture jetable.

## D3 — Pile technique : HTML/CSS/JS sans compilation, JSON (2026-09-19, proposée)

**Contexte.** Le projet doit rester maintenable par un enseignant seul, pendant
des années, avec un minimum d'outillage.

**Décision (à confirmer par Thierry).** JavaScript moderne natif (modules ES),
aucun framework, aucune étape de build pour publier : le dossier `site/` est
servi tel quel par GitHub Pages. Une seule dépendance d'exécution, épinglée et
vendorisée dans le dépôt : une bibliothèque de génération de QR code. Tests
unitaires du moteur avec Node (`node --test`), donc Node.js requis seulement
pour développer, jamais pour publier.

**Conséquences.** Pas de React/Vue/TypeScript ; on accepte un peu plus de code à
la main contre une dette d'outillage nulle.

## D4 — Conventions de langue (2026-09-19, provisoire)

- Interface, documentation, commentaires, messages de commit : **français**.
- Clés des fichiers JSON de données : **français**, `snake_case`, sans accents
  (`materiaux`, `avance_po_rev`) — ce sont les termes du métier que l'enseignant
  édite.
- Identifiants de code (variables, fonctions, fichiers) : **anglais**,
  convention JS usuelle (`camelCase`), pour rester lisible par l'outillage et
  les exemples courants.

## D5 — Les données de référence vivent dans le dépôt (2026-09-19, décidée)

**Décision.** Les tables Vc / avances / outils sont des fichiers JSON versionnés
dans `data/`, lus par le site au chargement. Aucun tableur n'est nécessaire à
l'exécution. Une modification pédagogique = éditer un JSON + commit.

**Conséquences.** Un schéma documenté (`SPEC.md` §3, en-têtes `_source` /
`_unites` dans chaque fichier) et une validation automatique des JSON dans les
tests.

## D6 — Sécurité du code de réussite et du QR (ouverte)

**Contexte.** Le payload du QR est un encodage réversible ; le code Moodle est
une formule connue de l'étudiant qui lit le JS. Un site statique ne peut pas
cacher un secret.

**Options.** (a) conserver tel quel — la vérification réelle est dans Moodle et
le risque est jugé acceptable ; (b) signer le payload (HMAC) avec un secret
détenu par l'enseignant et vérifier hors ligne ; (c) autre chose.

**À décider avec Thierry après la v1 fonctionnelle.**

## D7 — Emplacement du dépôt (ouverte)

Le rapport actuel est publié sur `thierryleroux.github.io/tgm-fab/`. Reste à
décider : nouveau code dans `tgm-fab` (sous-dossier, une seule URL Pages) ou
dépôt dédié. Recommandation : dépôt dédié pour isoler l'historique et les tests,
en gardant `tgm-fab` pour la page de vérification si l'URL du QR doit rester
stable.

## D8 — Les JSON vivent dans `site/data/`, en un seul exemplaire (2026-09-19, décidée)

**Contexte.** `site/` est publié tel quel par GitHub Pages (D3) et le navigateur
doit pouvoir lire les JSON de référence (D5) avec `fetch`. Ils étaient dans
`data/`, hors du dossier publié. Un lien symbolique est fragile sous Windows et
sur GitHub Pages ; une copie crée deux exemplaires à synchroniser, donc une
étape de plus à ne pas oublier.

**Décision.** Déplacer `data/` vers `site/data/`, unique exemplaire. Précise
l'emplacement donné par D5, qui reste valide pour tout le reste.

**Conséquences.** Les tests lisent `site/data/`. Une modification pédagogique =
éditer `site/data/*.json` + `npm test` + commit, sans aucune synchronisation.
Les JSON sont publics, comme tout ce que contient `site/`.

## D9 — Aucun arrondi dans le moteur, arrondi seulement à l'affichage (2026-09-19, décidée)

**Contexte.** Le VBA avait des arrondis partout, tous désactivés (commentés).
Arrondir la valeur théorique déplace les bornes de tolérance et complique les
tests.

**Décision.** Les valeurs théoriques ne sont jamais arrondies (`calcul.js`) ; les
tolérances de la SPEC §6 absorbent les arrondis de l'étudiant. L'arrondi
n'existe qu'à l'affichage, dans `format.js` : N entier, avances à 4 décimales
(5 en filetage), Vf à 3 décimales.

**Conséquences.** Calcul, correction et affichage sont trois modules distincts.
Détail dans `SPEC.md` §5.

## D10 — Séparateur décimal : point à l'affichage, point ou virgule à la saisie (2026-09-19, décidée)

**Contexte.** L'interface est en français (D4), ce qui appellerait la virgule ;
mais la commande CNC, les libellés des données (« 0.2500" », « M10 x 1.50 ») et
les habitudes de l'atelier utilisent le point.

**Décision.** Le point à l'affichage, cohérent avec la commande CNC et les
libellés. La saisie accepte le point et la virgule.

**Conséquences.** `format.js` écrit des points ; `correction.js` lit les deux.

## D11 — Un catalogue et des exercices configurables, avec un éditeur web en v1 (2026-09-19, décidée)

**Contexte.** Le classeur mélangeait deux choses : les données du métier
(outils, matériaux, avances) et la configuration d'un exercice précis (le M10 :
quels outils, combien de réussites, quels champs à saisir). `reussites_requises`
vivait ainsi dans la liste d'outils alors que c'est un réglage du M10. D2
demandait déjà que le M10 soit « un cas particulier ».

**Décision.** Le produit est fait de deux couches :

- un **catalogue** — `site/data/outils.json`, `materiaux.json`,
  `operations.json` — qui décrit le métier et ne sait rien des exercices ;
- des **exercices** configurables — `site/exercices/<id>.json` — qui
  choisissent des outils du catalogue, fixent les réussites requises, les
  champs évalués et, au besoin, restreignent dimensions et groupes de
  matériaux (schéma : `SPEC.md` §10).

Un **éditeur web statique** du catalogue et des exercices (`site/editeur/`)
fait partie de la v1. Il ne publie rien lui-même : il produit des JSON à
télécharger, que l'enseignant dépose dans le dépôt et commet (D1, D3 : pas de
serveur). Les JSON restent éditables à la main.

**Conséquences.** `reussites_requises` sort d'`outils.json` ; le M10 devient
`site/exercices/m10-tournage-vc.json`. Le moteur reçoit la liste des outils
admissibles (déjà le cas de `generateQuestion`). La validation des exercices
(`exercice.js`) sert à la fois aux tests, au quiz et à l'éditeur. Complète D2
et D5 sans les contredire.

## D12 — Réussites consécutives : un échec remet l'outil à zéro (2026-09-19, décidée)

**Contexte.** Le VBA parlait de réussites « consécutives » et comptait les
questions réussies inscrites au rapport ; à chaque échec, `retraitQR` effaçait
du rapport les réussites de l'outil, ce qui revenait à remettre son compteur à
zéro. Le cumul affiché (cellule H9), lui, ne diminuait jamais. La SPEC §7
laissait la question ouverte.

**Décision.** Les réussites exigées sont **consécutives** : une question
échouée remet à zéro le compteur de l'outil concerné, et seulement celui-là.
Le total des questions réussies inscrit au rapport ne diminue jamais.

**Conséquences.** L'état de progression (`progression.js`) tient un compteur
par outil et un total cumulé. Ferme la question ouverte n° 2 de `SPEC.md` §11.

## D13 — Tolérance effective : jamais plus étroite que la précision affichée (2026-09-19, décidée)

**Contexte.** D9 sépare le calcul (sans arrondi) de l'affichage (arrondi). Le
test de bout en bout a montré que la valeur théorique *arrondie comme à
l'écran* échouait parfois à la correction : N de filetage arrondi à l'entier
supérieur (84,67 → 85, tolérance de +0,1 %), lame à tronçonner à 4,375 rév/min
(4 est hors de ±5 %), avance « exacte » affichée à 4 décimales.

**Décision.** La tolérance effective d'un champ est **la plus large** entre
celle du tableau de `SPEC.md` §6 et **une demi-unité du dernier chiffre
affiché** : ±0,5 rév/min pour N, ±0,00005 po pour une avance à 4 décimales,
±0,0005 po/min pour Vf à 3 décimales. « Exact » signifie exact à la précision
affichée.

**Conséquences.** La réponse théorique telle qu'affichée (champ pré-rempli,
corrigé montré à l'étudiant) est toujours acceptée. `correction.js` dépend de
`format.js` pour connaître la précision affichée. Les valeurs de la table et les
données ne changent pas : `fact_vc = 0,125` sur la lame à tronçonner est voulu,
et la borne basse de N en filetage reste −90 % (et non les −90,1 % du VBA).

**Complément (2026-09-21).** La feuille des formules montre aussi la formule
exacte N = Vc × 12 / (π × Ø) (D29). Un N calculé avec elle est plus bas de
4,5 % ; **arrondi à l'entier**, il sortait de ±5 % pour 122 combinaisons sous
90 rév/min. La tolérance de N devient **±5 % élargie de ±1 rév/min de chaque
côté** pour les avances fixes et proportionnelles ; le filetage reste de −90 %
à +0,1 %. La ligne de correction l'écrit (« ±5 % et ±1 rév/min »). La
demi-unité d'affichage de cette décision s'y ajoute toujours. Ferme le ❓ de
SPEC §5.

## D14 — Avances : au moins 4 décimales et au moins 3 chiffres significatifs (2026-09-19, décidée)

**Contexte.** À 4 décimales, l'avance d'un micro-foret s'affichait « 0.0000 »
ou « 0.0001 » (foret métrique Ø 0,05 mm : fz = 0,0000118 po).

**Décision.** fz et f s'affichent avec au moins 4 décimales (5 en filetage)
**et** au moins 3 chiffres significatifs : « 0.0000118 », pas « 0.0000 ». Les
micro-forets restent au catalogue ; c'est à un exercice de les exclure
(restriction `dimensions`, D11).

**Conséquences.** Précise D9. La demi-unité de D13 suit le nombre de décimales
réellement affiché.

## D15 — Vf jugée par cohérence interne, pour toutes les familles (2026-09-19, décidée)

**Contexte.** Le VBA jugeait Vf sur *N_saisi × f_saisi* en filetage seulement ;
ailleurs, sur la valeur théorique (±5,1 % ou ±25 %). Un étudiant dont N (+5 %)
et f (+20 %) étaient acceptés voyait alors refuser une Vf pourtant bien
calculée.

**Décision.** Pour toutes les familles, Vf est acceptée à **±0,5 % de
N_saisi × f_saisi**. Un champ N ou f non saisi (pré-rempli, vide ou illisible)
est remplacé par sa valeur théorique. N et f sont corrigés à part, chacun dans
sa cellule.

*Articulation avec D13.* N et f ne sont connus qu'à la précision de leur
affichage : un étudiant qui saisit « 4 » rév/min a peut-être 4,375 dans sa
calculatrice, et sa Vf est juste. Le produit de référence est donc pris sur
toute la plage N ± demi-unité, f ± demi-unité, puis élargi de ±0,5 % (ou de la
demi-unité de Vf). Sans cela, la Vf théorique affichée à côté d'un N arrondi
serait refusée.

**Conséquences.** Remplace la ligne « Vitesse d'avance » du tableau de
`SPEC.md` §6 (±5,1 % et ±25 % disparaissent). Une Vf cohérente mais loin de la
théorie est bonne ; l'erreur est comptée sur N ou sur f, là où elle a été faite.

## D16 — Abandon complet de Moodle : la preuve de réussite est le rapport PDF (2026-09-20, décidée)

**Contexte.** Le classeur produisait un **code de réussite** calculé à partir
d'un numéro Moodle à 5 chiffres et d'un multiplicateur propre à l'exercice
(`calcCodeM`) ; l'étudiant le saisissait dans une question Moodle. D6 notait
déjà que cette formule, lisible dans le JS d'un site statique, ne protège rien.

**Décision.** Moodle disparaît du produit, entièrement :

- `multiplicateur_moodle` sort du schéma d'exercice (`SPEC.md` §10) et de
  `m10-tournage-vc.json` — la clé est désormais *inconnue*, donc refusée ;
- le numéro Moodle sort de l'identification (`validateStudent`) et de l'état de
  séance : l'étudiant donne prénom, nom et matricule, rien d'autre ;
- aucun code de réussite n'est calculé ni affiché. La formule reste dans
  `legacy/vba/` pour mémoire.

La **preuve de réussite est le rapport PDF** que l'étudiant remet sur Léa. Le
**QR code reste**, pour la vérification par l'enseignant.

**Conséquences.** `SPEC.md` §8 perd sa section « code de réussite Moodle » ; le
jalon 3 de `PLAN.md` devient « Rapport et QR ». Ferme la question ouverte n° 3
de `SPEC.md` §11. D6 reste ouverte, mais ne concerne plus que le contenu du QR.

## D17 — `docs/UI.md` est la référence de présentation (2026-09-20, décidée)

**Contexte.** La maquette des écrans (v2, 25 points de révision) a été
approuvée par Thierry le 2026-09-20. Elle est décrite dans `docs/UI.md` et
illustrée par `docs/maquettes/*.html`.

**Décision.** `docs/UI.md` est la source de vérité de la **présentation**
(langage visuel, parcours, écrans, composants, impression, accessibilité), au
même titre que `SPEC.md` pour le comportement. En cas de contradiction :
`DECISIONS.md`, puis `SPEC.md`, puis `UI.md`. Les maquettes montrent
l'intention ; le code est responsive, accessible et piloté par les données,
jamais copié des maquettes.

**Conséquences.** `UI.md` figure dans la section « Où lire quoi » de
`CLAUDE.md`. Changer un écran = mettre `UI.md` à jour dans le même commit.

## D18 — `?exercice=` absent ou inconnu : l'accueil montre la liste, jamais un repli silencieux (2026-09-20, décidée)

**Contexte.** `SPEC.md` §10 disait « id inconnu ou absent → le premier de
l'index », alors que `UI.md` §3.1 montre la liste des exercices quand l'adresse
n'a pas de `?exercice=`. Avec un repli silencieux, un lien mal copié depuis Léa
lançait un exercice que l'étudiant n'avait pas demandé.

**Décision.**

- `?exercice=` **absent** → l'accueil affiche la liste des exercices de l'index ;
- `?exercice=` **inconnu** → l'accueil affiche « L'exercice « <id> » n'existe
  pas — vérifie le lien sur Léa », puis la même liste ;
- plus aucun repli sur le premier exercice de l'index.

**Conséquences.** `resolveExerciseId` disparaît d'`app.js` ; `loadApp` ne charge
un exercice que si l'adresse en nomme un de l'index. L'ordre de l'index n'est
plus que l'ordre d'affichage de la liste. `SPEC.md` §10 corrigée.

## D19 — Serveur de correction : l'état de séance vit sur un serveur qui signe la réussite (2026-09-20, décidée)

**Contexte.** La preuve de réussite (D16 : le rapport PDF) doit résister à un
étudiant aidé d'une IA. Sur un site statique, tout est falsifiable : le moteur,
l'état de séance dans `localStorage`, le contenu du QR (D6). Un secret ne peut
pas vivre dans le navigateur.

**Décision.** L'état de séance vit sur un **serveur** qui détient la clé
secrète. Le navigateur affiche ; le serveur :

- tire les questions, corrige, tient les compteurs ;
- **horodate** chaque correction et impose une **cadence minimale** : 10 s
  entre deux corrections d'une même séance ;
- **signe l'attestation de réussite** (HMAC) que le rapport porte en QR.

Une **page de vérification** publique et une **page d'administration** à clé
(liste des réussites, remise à zéro d'un NIP, purge) interrogent le même
serveur.

*Identification.* Prénom, nom, matricule à 7 chiffres et un **NIP de 4 à 6
chiffres**, choisi à la première identification (haché côté serveur ; 5 essais
par 10 minutes par matricule). Une seule séance par couple (matricule,
exercice). Le serveur renvoie un **jeton de séance**, que le navigateur garde
dans `localStorage` avec le matricule et le prénom, et qui expire après 2 h
sans activité. Plus de lien de reprise ni de QR de séance : on reprend de
n'importe quel appareil en s'identifiant.

*Données conservées par le serveur.* Prénom, nom, matricule, NIP haché,
compteurs, question en cours et horodatages ; purgés en fin de session par
l'enseignant. Nouveau pied de page : « Tes réponses sont corrigées par un
serveur ; tes données sont effacées à la fin de la session. »

*Complément du 2026-09-20.* Le serveur garde aussi le **journal complet des
corrections** : outil, question tirée, réponses données, résultat, horodatage.
Le rapport en tire les questions réussies ; la page de vérification, la durée
totale et le temps médian par question. Il est purgé avec le reste. Détails :
D21.

**Conséquences.** Remplace « site statique, aucun serveur » de D1 et de D3 : le
site reste du HTML/CSS/JS sans étape de construction, mais il ne fonctionne plus
sans son serveur (hébergement : D20). **Ferme D6** : le QR porte une
attestation signée par HMAC, vérifiée par le serveur. `session.js` ne garde
plus que `{ matricule, prenom, jeton }` ; `site/js/api.js` fait les appels
(`/api/…`). `SPEC.md` §7 à §9 et `UI.md` §3.1, §3.2 réécrites ; `PLAN.md` :
jalon 3 = serveur, jalon 4 = écran Question et tables de référence branchés,
jalon 5 = rapport signé, page de vérification, administration ; l'éditeur
(D11) ensuite.

## D20 — Hébergement : un Worker Cloudflare sert le site et l'API (2026-09-20, décidée)

**Contexte.** D19 exige un serveur ; GitHub Pages ne sert que des fichiers.

**Décision.** **Un seul Worker Cloudflare** sert `site/` comme ressources
statiques et expose l'API sous `/api/`. Base **D1** pour les séances (jalon 3).
Déploiement par **GitHub Actions** avec `wrangler`, à chaque push sur `main`,
après `npm test`. Remplace GitHub Pages (D1, D3, D8) : `pages.yml` disparaît et
l'étape 4 de `DEMARRAGE.md` est réécrite.

**Conséquences.** `wrangler` devient la seule `devDependency` ; il n'y a
toujours aucune étape de construction pour le site, et aucune dépendance
d'exécution de plus. `wrangler.jsonc` à la racine, code du serveur dans
`worker/`. `npm run dev` (= `wrangler dev`) remplace `npm run serve`. Deux
secrets GitHub : `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`.

## D21 — Serveur de correction : précisions de D19 (2026-09-20, décidée)

**Contexte.** `SPEC.md` §7 laissait cinq points ❓ à confirmer avant de coder le
serveur (jalon 3), et le rapport du jalon 2 en soulevait trois autres.

**Décision.**

1. **Jeton et exercice.** Chaque appel nomme l'exercice. Un jeton d'un autre
   exercice, inconnu ou expiré → 401 → l'étudiant s'identifie.
2. **Journal des corrections.** Le serveur garde chaque correction : outil,
   question tirée, réponses données, résultat, horodatage (complément de D19).
3. **Prénom et nom.** Matricule + NIP identifient. Le prénom et le nom sont ceux
   de la **première visite** : le serveur les renvoie et l'écran les affiche ;
   ceux tapés à la reprise sont ignorés.
4. **Exercice modifié en cours de session.** La séance **continue**. Les
   compteurs sont indexés par `id` d'outil : un outil retiré disparaît, un outil
   ajouté part à zéro. La séance note la version de l'exercice au début et à la
   réussite.
5. **Correction demandée trop tôt** (moins de 10 s après la précédente) : 429,
   sans effet sur les compteurs ni sur la question en cours.
6. **NIP remis à zéro** par l'enseignant = l'étudiant en choisit un nouveau à
   sa prochaine identification.
7. **Case du NIP** : champ texte à chiffres (`inputmode="numeric"`,
   `autocomplete="off"`), masqué par CSS (`-webkit-text-security: disc`) là où
   c'est possible ; **jamais `type="password"`**, pour que le navigateur ne
   propose pas d'enregistrer le NIP sur les postes partagés. `autocomplete="off"`
   aussi sur le matricule.
8. **Éditeur (jalon 6)** : protégé par la clé d'administration du serveur, et
   non par une empreinte dans le code ; son mode de sauvegarde se décide au
   jalon 6.

**Conséquences.** `SPEC.md` §7 à §9 n'ont plus de ❓. `restoreSession` (une
séance repartait de zéro quand l'exercice changeait) disparaît. Les maquettes
`01-accueil.html` et `02-identification.html` sont périmées depuis D19 ; elles
ne sont pas refaites : le texte de `UI.md` fait foi.

## D22 — Serveur : base D1, secrets, cryptographie, source des données (2026-09-20, décidée)

**Décision.**

- **Base D1** `quiz-parametres-coupe`, liaison `DB`. Schéma dans `migrations/`
  (fichiers SQL numérotés, jamais modifiés une fois appliqués) : table
  `seances` — une ligne par couple (exercice, matricule) — et table
  `corrections` — le journal. Les migrations sont appliquées en local par
  `npm run dev`, et en production par `deploy.yml`, **avant** le déploiement.
- **Deux secrets** posés sur le Worker (`wrangler secret put`), jamais dans le
  dépôt : `CLE_SECRETE` pour toute la cryptographie du serveur, `CLE_ADMIN`
  pour l'administration (jalon 5). En local : `.dev.vars`, ignoré par git.
- **Sous-clés dérivées de `CLE_SECRETE` par HKDF-SHA-256**, une par usage :
  hachage des NIP, signature des attestations (jalon 5).
- **NIP** stocké comme HMAC-SHA-256 (sous-clé, matricule + NIP). Pas de
  PBKDF2 : un NIP de 4 à 6 chiffres est trop court pour qu'un hachage lent le
  protège ; la protection vient du secret, que la base ne contient pas.
  5 échecs en 10 minutes → identification verrouillée 10 minutes (429).
- **Jeton de séance** : 32 octets aléatoires en base64url, envoyé une seule
  fois, stocké haché (SHA-256). Expire 2 h après la dernière activité ; chaque
  appel le prolonge. Un seul jeton par séance : s'identifier sur un second
  appareil invalide le jeton du premier.
- **Une seule source de données** : le Worker lit `site/data/` et
  `site/exercices/` **par la liaison `ASSETS`**, avec `loadData` et
  `loadExercise` du site (mêmes validations), et garde le résultat en mémoire.
  Pas d'importation au bundle : ajouter un exercice reste « déposer un JSON et
  l'inscrire dans `index.json` », sans toucher au code du serveur. Le Worker
  importe aussi le moteur de `site/js/` (question, calcul, correction,
  progression) : il n'existe qu'en un exemplaire.
- **Tests de l'API sans dépendance de plus** : sous `node --test`, le vrai
  Worker tourne sur une base SQLite en mémoire (`node:sqlite`, même moteur SQL
  que D1) où la vraie migration est appliquée, avec une horloge injectée — seul
  moyen de tester une expiration de 2 h ou un verrou de 10 minutes.
  `npm run test:api` rejoue un scénario par HTTP sur `wrangler dev` et une vraie
  D1 locale. `@cloudflare/vitest-pool-workers` n'est pas retenu : il amènerait
  vitest, un second lanceur de tests et des dizaines de paquets, pour un projet
  qui n'a qu'une `devDependency`.

**Conséquences.** Node ≥ 22.13 pour les tests (`node:sqlite`). Deux colonnes
s'ajoutent à la table `seances` demandée : `essais_nip_debut` (sans elle,
« 5 échecs **en 10 minutes** » ne se calcule pas) et
`version_exercice_reussite` (D21, point 4). Le NIP est propre à chaque séance,
donc à chaque exercice : l'étudiant en choisit un par exercice (il peut
reprendre le même). Le jeton d'API Cloudflare de GitHub doit aussi avoir le
droit **D1 : Edit** pour appliquer les migrations.

## D23 — Identification en deux temps, et réparation sans enseignant (2026-09-20, décidée)

**Contexte.** L'essai en production l'a montré : le formulaire demandait tout
d'un coup, puis le serveur décidait **en silence** de créer ou de reprendre ; un
nom différent tapé à la reprise était ignoré sans un mot ; un matricule mal saisi
à la création rendait le travail irrécupérable sans un enseignant. Plusieurs
enseignants utiliseront le site : rien ne doit se réparer à la main, au cas par
cas.

**Décision.**

1. **Écran 1/2 : le matricule seul.** Une route de **consultation** répond, pour
   un exercice et un matricule, soit « séance trouvée » avec le prénom et
   l'initiale du nom, soit « aucune séance ». Rien d'autre ne sort.
2. **Écran 2/2, séance trouvée** : « Séance de Romain L. trouvée. Entre ton NIP
   pour la reprendre. », un champ NIP, bouton **Reprendre**, lien « Ce n'est pas
   moi » qui ramène au 1/2. Aucun champ prénom ni nom.
3. **Écran 2/2, aucune séance** : le matricule en gros caractères, « Nouvelle
   séance pour le matricule 7654321. Vérifie-le : il figurera sur ton rapport et
   te servira à reprendre l'exercice sur un autre appareil. », puis prénom, nom,
   « Choisis un NIP (4 à 6 chiffres) », bouton **Commencer**, lien « Mauvais
   matricule » qui ramène au 1/2.
4. **« Corriger mon identité »**, dans l'en-tête de la séance, à côté de
   Quitter : prénom, nom et matricule modifiables, **NIP exigé**. Un nouveau
   matricule n'est accepté que s'il n'a pas de séance pour cet exercice (sinon
   409, « Ce matricule a déjà une séance »). La séance est **déplacée, jamais
   copiée**. Chaque correction est **journalisée** (anciennes et nouvelles
   valeurs, horodatage), pour la page de vérification du jalon 5.
5. Le serveur ne devine plus : **créer** et **reprendre** sont deux appels
   distincts. Créer une séance qui existe → 409 ; reprendre une séance qui
   n'existe pas → 404. Les règles d'`identification.js` restent (matricule à
   7 chiffres, NIP de 4 à 6 chiffres), ainsi que le verrou après 5 essais — qui
   vaut aussi pour le NIP exigé par « Corriger mon identité ».

**Conséquences.** Remplace, dans D19 et D21, le formulaire unique et la phrase
« le prénom et le nom tapés à la reprise sont ignorés » : à la reprise, on ne les
tape plus. `POST /api/identification` disparaît au profit de
`/api/consultation`, `/api/creation`, `/api/reprise` et `/api/identite` ;
migration `0002` (journal des corrections d'identité). La consultation révèle,
à qui connaît un matricule, un prénom et une initiale : c'est voulu, et rien
d'autre ne sort. **Risques acceptés** (réponses au rapport du jalon 3) : une
séance ouverte par un autre au matricule d'un étudiant est une farce visible aux
horodatages ; la page d'administration du jalon 5 devra remettre un NIP à zéro
**et supprimer une séance**, avec **une clé par enseignant**. Un NIP par
exercice est accepté pour la v1 ; une table `etudiants` (un NIP par matricule,
alimentée par une liste de classe) est la piste si cela gêne.

## D24 — Nomenclature des outils : le gabarit du classeur, avec ses jetons (2026-09-20, décidée)

**Contexte.** Dans le classeur, chaque outil porte à la ligne 4 de « Liste
d'outils » (`IdFormat`) un gabarit de nom dont les champs entre crochets sont
remplacés par les valeurs tirées au sort (`clsOutil.instIdOutil`). Le catalogue
le porte déjà (`format_identifiant`, SPEC §4.6), mais avec cinq jetons seulement,
et l'écran Question retouchait le résultat pour distinguer les outils de même nom.

**Décision.**

- Le gabarit reste le champ `format_identifiant` de chaque outil, même syntaxe
  que le classeur. Jetons reconnus : `[IdDia]`, `[Dia]`, `[Pas]`, `[NbDent]`,
  `[NomOutil]`, `[Matoutil]`, `[Operation]`, et `[IdBarre]` (D25). Tout autre
  jeton est une erreur **à la validation du catalogue**, plus seulement au tirage ;
  `[Pas]` n'est permis que sur un outil de filetage, `[IdBarre]` que sur un outil
  à deux diamètres.
- Le **nom affiché dans la question** (titre du panneau de l'outil) est le
  gabarit résolu, **tel quel**. La **progression** garde le nom générique
  (`nom`), avec ce qui distingue les homonymes : l'unité, sinon la plage de
  dimensions (réponse A.3 au rapport du jalon 4).
- L'éditeur (jalon 6) permet de modifier le gabarit, avec la liste des jetons
  et un aperçu.

**Conséquences.** `validateData` vérifie les gabarits ; `labeledIdentifier`
disparaît de `site/js/ui/rules.js` ; SPEC §4.6, UI §3.3, PLAN (jalon 6).

## D25 — Barre à aléser : deux diamètres, le Ø alésé pour N, le Ø de la barre pour l'avance (2026-09-20, décidée)

**Contexte.** L'alésage à la barre a une avance proportionnelle au Ø **de la
barre** (0.006 × Ø barre), alors que N se calcule avec le Ø **alésé** (le trou).
Dans le classeur, l'outil n'a qu'une dimension (Ø alésé), qui servait aux deux :
l'avance était fausse.

**Décision.**

- Un outil peut porter une seconde liste, `dimensions_barre` (libellé + Ø en
  pouces), et `rapport_barre_max`. La barre est tirée **avec** la dimension,
  parmi celles qui entrent dans le trou : Ø barre ≤ `rapport_barre_max` × Ø alésé.
- Valeurs de départ : barres de 1/2, 5/8, 3/4, 1 et 1 1/4 po ;
  `rapport_barre_max` = 0,75 — **confirmées par Thierry le 2026-09-21**. Que le
  plafond de 0,006 ne soit atteint qu'à partir de la barre de 1 po convient :
  l'étudiant rencontre le cas proportionnel et le cas plafonné.
- Moteur : N avec le Ø de la dimension, avance proportionnelle avec le Ø de la
  barre. Question, panneau de l'outil, aide contextuelle et correction nomment
  chacun des deux diamètres. Gabarit : « Barre à aléser Ø [IdBarre] - Ø alésé:
  [IdDia] ».
- Le catalogue est refusé si une dimension n'a aucune barre qui y entre.
- Vérifié : **aucun autre outil** du catalogue n'a deux diamètres à distinguer
  aujourd'hui — les autres outils de tournage intérieur (barre à rainurer, barre
  à fileter) ont une avance fixe ou égale au pas ; forets, alésoirs et fraises
  n'ont qu'un Ø. (Le foret à centrer a un Ø de corps et un Ø de pilote, mais une
  avance fixe : seul le Ø de corps sert, pour N.)

**Extension (2026-09-21) — barre à rainurer.** Le rainurage interne est traité
de même : la barre à rainurer reçoit `dimensions_barre` (même liste) et
`rapport_barre_max` 0,75 ; N se calcule avec le Ø rainuré (facteur de vitesse
0,25 inchangé), l'avance avec le Ø de la barre. Dans `operations.json`,
« Rainurage interne » passe en avance **proportionnelle** : 0,003 × Ø barre,
plafonnée à 0,003 po/tour, sur le modèle de l'alésage à la barre. Gabarit :
« Barre à rainurer Ø [IdBarre] - Ø rainuré: [IdDia] ». Feuille des avances :
même représentation que l'alésage à la barre (bande grise, « × Ø outil »,
note « Ajuster l'avance ↔ Ø outil, Av. MAX. : .003" / tour ») : neuf bandes.
À l'écran, les deux outils partagent les mêmes textes, avec « Ø usiné » pour le
trou (« Ø usiné (le trou, pas la barre) ») ; le titre garde le mot du gabarit
(alésé, rainuré).

**Conséquences.** Un tirage de plus pour ces outils seulement (le 7e) ; une
question en attente tirée avant ce changement, sans barre, est retirée et
remplacée. SPEC §3 à §5, UI §3.3, tests du moteur et du serveur.

## D26 — Mode test : local seulement, et c'est le serveur qui décide (2026-09-20, décidée)

**Contexte.** Pour essayer le parcours, Thierry veut que les réponses se
remplissent d'elles-mêmes (modifiables, pour simuler des erreurs) et n'avoir
qu'à cliquer Vérifier puis Question suivante. Cela ne doit ouvrir aucune porte
à la tricherie.

**Décision.**

- Le mode n'existe que sur le poste de développement : variable `MODE_TEST=1`
  dans `.dev.vars` (lu par `wrangler dev`), **jamais** dans `wrangler.jsonc` ni
  en production. Second verrou : même avec la variable, le serveur ne l'accepte
  que pour une requête adressée à `localhost` ou `127.0.0.1`.
- **C'est le serveur qui joint les valeurs attendues** à la question
  (`question.reponses_test`), et seulement dans ce mode. Aucun paramètre
  d'adresse ni interrupteur du navigateur ne l'active ; le navigateur ne montre
  le bandeau « Mode test » et le bouton « Remplir » **que** si la question porte
  ces valeurs.
- Dans ce mode, la cadence de 10 s entre deux corrections est levée.
- Exercice `test-complet` : tous les outils du catalogue, les cinq grandeurs,
  une réussite par outil — pour voir chaque écran et chaque aide.
- Plus tard : l'ouvrir aux séances d'un professeur connecté (jalon 5 ou 6) ; la
  règle « rien de ce qui est à trouver ne part au navigateur » (SPEC §7) reste
  vraie pour toute séance d'étudiant.

**Conséquences.** `worker/seance.js` (`isTestMode`, vues), tests de fuite dans
`tests/worker-api.test.js`, un test qui refuse `MODE_TEST` dans
`wrangler.jsonc` ; SPEC §7 et §10, `.dev.vars.exemple`, DEMARRAGE.

## D27 — Table des vitesses de coupe : un trait par famille de matériau, marqué dans les données (2026-09-20, décidée)

**Contexte.** La feuille du classeur sépare les matériaux usinés par un trait
noir fin ; la version web l'avait remplacé par des lignes blanches.

**Décision.** Plus aucune ligne blanche. Un trait noir fin (« hairline ») au-dessus
du premier groupe de chaque **matériau usiné** — les compositions et états
métallurgiques d'un même matériau restent ensemble ; plastiques et graphite
(groupes 42 à 47) forment une seule famille —, plus le cadre du tableau et le
trait sous l'en-tête. Le début d'une famille est un **indicateur dans les
données**, `debut_famille: true` sur le matériau, et non un calcul : l'éditeur
pourra le changer. Aujourd'hui : groupes 1, 6, 10, 12, 15, 17, 19, 21, 23, 26,
31, 36, 38, 41 et 42. (Le « thème nuit » demandé pour les feuilles venait d'une
confusion : elles restent des pages blanches, UI §1 — D30.)

**Conséquences.** `materiaux.json`, `validateData` (booléen facultatif),
`vcSheet`, `sheets.css` ; SPEC §3, UI §3.5.

## D28 — Révision des tables de référence, dans les données (2026-09-20, décidée)

**Contexte.** Les feuilles du classeur portent leur révision au pied de page
(« révision H2025_r0 ») ; la version web n'en avait pas.

**Décision.** `materiaux.json` et `operations.json` portent chacun une clé
`revision` (texte ; aujourd'hui « A2026_r0 »), affichée au pied de la feuille
correspondante ; la feuille des formules, qui n'a pas de données, n'en porte pas.
Modifiable par l'éditeur (jalon 6). C'est la révision **des tables** ; la
version d'un exercice reste dans l'exercice (SPEC §10).

**Conséquences.** `validateData`, `loadData` (`revisions`), pied des feuilles ;
SPEC §3, UI §3.5.

## D29 — Réponses au rapport du jalon 4 (2026-09-20, décidée)

Points tranchés par Thierry, sans décision propre :

- **Pictogrammes d'opérations** : les formes d'origine du classeur (DrawingML,
  `xl/drawings/drawing3.xml`) sont **converties** en SVG, sans redessin
  (`reference/pictogrammes-du-classeur/`). Le pictogramme de l'opération reste
  dans le panneau de l'outil.
- **La table des avances fait foi** : le champ `note` d'`operations.json`, qui
  la contredisait (.008 × Ø 1/4 = .002) et n'était plus affiché, est supprimé ;
  l'encadré de la feuille est calculé depuis les données.
- **Feuille des formules** : la formule exacte N = Vc × 12 / (π × Ø) est montrée
  **à titre indicatif** à côté de la formule du cours ; la correction reste sur
  Vc × 4 / Ø.
- **Feuille des avances** : bande grise sur les opérations proportionnelles au Ø,
  comme dans le classeur, à la place de l'en-tête de colonne.
- **Sur téléphone**, les colonnes Classe et No de groupe de la table des Vc
  restent figées pendant le défilement.
- **Rouge de la classe K** : éclairci en thème nuit seulement (UI §1).
- **« TGM-TMI »** partout où « TGM » était affiché ; nom du département sur trois
  lignes dans toutes les pages. Dépôt, chemins et adresses ne changent pas.
- **Consultation du matricule** (`/api/consultation`) : à limiter au jalon 5. Le
  cégep sort par une seule adresse IP (NAT) : une limite par IP doit rester
  large ; préférer un plafond de **matricules distincts par heure**.
- **Attestation de réussite** signée, avec son code QR : **en tête du jalon 5** —
  c'est la sortie du parcours étudiant. D'ici là, « Voir mon attestation » mène à
  une attestation **provisoire, non signée**, qui le dit.

## D30 — Réponses au second rapport du jalon 4 (2026-09-21, décidée)

Points tranchés par Thierry :

- **Planche-contact validée** : les 19 pictogrammes convertis sont adoptés,
  fraises rondes (sans l'étirement de 14 % qu'Excel applique au groupe), pointes
  de flèche telles quelles. L'essai d'impression des trois feuilles est réussi.
- **Barres et rapport 0,75** : confirmés (D25).
- **N avec 12/π arrondi** : tolérance de N élargie de ±1 rév/min (D13).
- **Feuilles en thème nuit : non.** Elles restent des pages blanches (UI §1). Les
  variables CSS `--sheet-rule` et `--sheet-band` restent, sans redéfinition.
- **Cadence levée en mode test** : confirmé (D26).
- **`test-complet` hors de la liste** : un exercice porte `"liste": false` dans
  son fichier pour ne pas apparaître dans la liste de l'accueil (D18) ; il reste
  joignable par `?exercice=<id>`. Le même indicateur servira aux futurs
  exercices d'essai. Clé facultative, `true` par défaut (SPEC §10).
- **Note des avances posée sur la bande**, sans encadré : adopté ; maquette
  `05b` et UI §3.5 mises à jour.
- **Pied des feuilles et de l'attestation** : « TGM-TMI — TLP — 2026 », sans
  « profil fabrication ».
- **Coquille « Ø v45/64 po »** corrigée en « Ø 45/64 po » (commit « Corrige une
  donnée »).
- **Classeur de `legacy/`** renommé `Exercice_M10_tournage_vc_version_etudiant_r0.xlsm`
  (sans accent ni espace) ; le convertisseur pointe sur ce chemin.
- **Attestation provisoire** : elle part en production avec la prochaine
  fusion ; bannière « PROVISOIRE — non signée, ne vaut pas preuve de réussite »
  à l'écran et à l'impression, jusqu'au jalon 5. Elle **liste les opérations
  effectuées** : pour chaque outil de l'exercice, dans l'ordre, le nom générique
  avec sa plage de dimensions, l'opération, les réussites obtenues sur les
  réussites exigées. La liste vient de la séance côté serveur, pour faire partie
  du contenu signé au jalon 5.
- **Rainurage interne** à deux diamètres (D25, extension).
- Pour clore le jalon 4 : compte à rebours de la cadence à la place du message,
  repli des outils terminés sur téléphone.

## D31 — L'attestation de réussite est un enregistrement figé à la réussite (2026-09-21, décidée)

**Contexte.** Jusqu'au jalon 4, l'écran « Exercice réussi » relisait le
catalogue et l'exercice au moment de l'affichage : renommer un outil, changer
ses dimensions ou retitrer l'exercice aurait fait *suivre* une attestation
déjà remise. Une preuve de réussite doit dire ce qui était vrai à l'instant de
la réussite, et ne plus jamais changer.

**Décision.** Quand la dernière réussite exigée est obtenue, le serveur écrit
un **enregistrement d'attestation** (table `attestations`, migration `0003`)
qui ne change plus : prénom, nom, matricule ; identifiant et titre de
l'exercice ; révision (la version de l'exercice à la réussite) ; début et
réussite (horodatage serveur) ; nombre de questions réussies ; la liste des
outils **dans l'ordre de l'exercice**, chacun avec son nom générique, sa
**plage de dimensions**, son opération et ses réussites obtenues / exigées.
Plage, opération et nom sont **copiés du catalogue à cet instant** et plus
jamais relus. Une correction d'identité postérieure ne touche pas
l'attestation.

Les séances réussies avant cette version reçoivent leur enregistrement **à la
première ouverture** de l'attestation, à partir de la progression enregistrée
(compteurs, total, date de réussite, version à la réussite) et de l'exercice
tel qu'il est alors.

**Conséquences.** Une séance peut avoir plusieurs attestations dans le temps
(D35) : la table est séparée de `seances`, une ligne par attestation, avec sa
date d'annulation éventuelle. `worker/attestation.js` compose l'enregistrement
(pur, testé) ; `GET /api/attestation` le rend, avec le code et l'adresse de
vérification. L'écran « Exercice réussi » provisoire et sa bannière
disparaissent au profit de la page de l'attestation (`UI.md` §3.6).

## D32 — Code court et signature de l'attestation (2026-09-21, décidée)

**Décision.** Chaque attestation reçoit :

- un **code court** de 10 caractères tirés au hasard (sans biais) dans
  l'alphabet base32 de Crockford **sans 0, O, 1, I** (ni L, ni U) :
  `23456789ABCDEFGHJKMNPQRSTVWXYZ`, présenté `XXXXX-XXXXX`. Unique en base ;
  environ 6 × 10¹⁴ codes possibles. La saisie tolère minuscules, espaces et
  tirets, et ne « corrige » jamais un O ou un I ;
- une **signature HMAC-SHA-256** sous la sous-clé « attestation » dérivée de
  `CLE_SECRETE` (D22), calculée sur une **sérialisation canonique** de
  l'enregistrement (JSON, clés triées à tous les niveaux, sans espace). Le code
  fait partie de l'enregistrement signé.

Toute comparaison de signature — et de la clé d'administration — se fait **en
temps constant** (`sameText`, après hachage pour la clé).

**Conséquences.** La signature est stockée avec l'enregistrement ; la
vérification la **recompose** à partir de ce que le serveur détient : un
enregistrement retouché en base ne passe plus. Changer `CLE_SECRETE`
invaliderait toutes les attestations remises (rappel dans `DEMARRAGE.md`).

## D33 — Contenu du QR et vérification publique (2026-09-21, décidée)

**Décision.** Le QR de l'attestation porte une **adresse de vérification
absolue** — `<site>/verifier?…` — dont la requête contient **l'essentiel de
l'attestation en clair**, puis la signature : exercice, matricule, nom, prénom,
date de réussite, révision, questions réussies, code, signature. Un lecteur de
QR quelconque montre donc ces données sans le site ; le site, lui, vérifie.
L'adresse du site est celle de la requête, jamais figée dans l'enregistrement.

La page **`/verifier`**, publique et sans connexion, a deux entrées : l'adresse
du QR, ou la saisie du code court. Le serveur (`POST /api/verification`)
retrouve l'enregistrement par le code, recompose la signature, et compare le
contenu de l'adresse à l'enregistrement. Issues : **valide** (avec
l'enregistrement complet tel que le serveur le détient, tableau des outils
compris) ; **aucune** attestation ne correspond ; **invalide** (signature
invalide ou contenu modifié) ; **annulée** par l'enseignant, avec la date
(D35). Une attestation ne se vérifie pas à moitié : si l'adresse porte autre
chose que le code, tout doit correspondre.

La page ne divulgue **rien de plus que l'attestation imprimée** : ni journal
des corrections, ni corrections d'identité (elles vont dans l'espace
professeur, D34), ni durées. Elle est soumise aux limites de débit (D36).

**Conséquences.** Bibliothèque QR vendorisée (D3) : `qrcode-generator` 2.0.4,
MIT, module ES copié dans `site/vendor/`, rendue en SVG par le DOM (jamais
`innerHTML`). Les tâches « durée totale et temps médian » et « corrections
d'identité sur la page de vérification » du `PLAN.md` sont abandonnées pour
cette page.

## D34 — Espace professeur : une clé, un cookie signé, un journal (2026-09-21, décidée)

**Contexte.** D23 prévoyait « une clé par enseignant ». Au jalon 5 il n'y a
qu'un enseignant ; la table des enseignants viendra avec les devoirs (jalon 6).

**Décision.**

- **Une seule clé** au jalon 5 : `CLE_ADMIN`, le secret existant (D22). La
  séance professeur porte un **identifiant d'enseignant**, « admin » pour
  l'instant, que le journal des actions note ; ajouter des enseignants sera un
  ajout de données, pas une refonte.
- **Connexion** sur `/prof` : saisie de la clé, comparaison en temps constant
  (D32), puis **cookie de séance signé** (sous-clé « prof » de `CLE_SECRETE`,
  sans état sur le serveur) : `HttpOnly`, `Secure`, `SameSite=Strict`, chemin
  `/api/prof`, **12 h**. « Se déconnecter » efface le cookie.
- **Cinq essais ratés par adresse**, puis délai croissant (1, 2, 4… minutes,
  plafonné à une heure), chaque refus et chaque connexion **journalisés**
  (table `journal_enseignant`).
- **Aucune route `/api/prof/*` ne répond sans cookie valide** ; le client ne
  contient aucun secret. Routes : liste des séances, remise à zéro (D35),
  journal des corrections d'identité (D23).
- Le tableau des réussites (nom, prénom, matricule, début, dernière activité,
  réussi ou en cours, questions réussies, code de l'attestation), le filtre par
  exercice, le tri par colonne, la recherche par matricule ou par nom et
  l'**export CSV** (UTF-8 avec BOM, séparateur `;`, dates ISO, pour Excel en
  français) se font **dans le navigateur** : une classe, pas une base de
  données.

**Conséquences.** Remplace « une clé par enseignant » de D23 pour ce jalon.
La remise à zéro d'un NIP, la suppression d'une séance et la purge de fin de
session (D19, D23) restent à faire (`PLAN.md`).

## D35 — Remise à zéro d'une séance et annulation de l'attestation (2026-09-21, décidée)

**Décision.** Depuis l'espace professeur, **remettre une séance à zéro** :
la progression revient à zéro (compteurs, question en attente, dates de
réussite et de dernière correction, version à la réussite), la séance **reste
la même** (identifiant, matricule, NIP, jeton, date de début) et son journal
des corrections est conservé. Si une attestation existait, elle est **marquée
annulée** avec la date ; la vérification (D33) le dit. Une nouvelle réussite
crée une **nouvelle attestation**, avec un autre code ; l'ancien code reste
vérifiable et répond « annulée ». L'action est **journalisée** : date,
enseignant, séance, action.

## D36 — Limites de débit par adresse, compteurs en D1 (2026-09-21, décidée)

**Contexte.** La consultation d'un matricule (D23) révèle un prénom et une
initiale ; la vérification d'un code (D33) révèle une attestation. Ni l'une ni
l'autre n'exige de connexion : il faut empêcher d'énumérer. Mais tous les
postes du cégep sortent par **une seule adresse IP** : une limite sur le nombre
de requêtes bloquerait une classe entière.

**Décision.** Consultation et vérification : au plus **100 matricules ou codes
distincts par adresse et par heure**, aucune limite sur le nombre de requêtes.
La 101ᵉ valeur est refusée (429) et **verrouille l'adresse 10 minutes** ; une
valeur déjà vue passe toujours ; une valeur refusée n'est pas comptée comme
vue. Les compteurs vivent **en D1** (table `debit` : une ligne par valeur
distincte, par adresse et par tranche horaire UTC ; table `verrous` pour les
délais), pas dans le service de limitation de Cloudflare : celui-ci compte des
requêtes, pas des valeurs distinctes, ne se règle pas par valeur, et ne se
teste pas sous `node --test` avec une horloge réglable. Les tranches passées
sont effacées au fil de l'eau. L'adresse est `cf-connecting-ip`, qu'un client
ne peut pas forger ; sans cet en-tête (tests), une seule adresse « inconnue ».

**Conséquences.** `worker/acces.js` porte les règles (pur, testé), `base.js`
le SQL. La connexion professeur a son propre verrou (D34). Une classe entière
peut consulter ses matricules à volonté ; un robot qui en essaie des milliers
est arrêté à cent.

## D37 — Correction d'identité après la réussite : l'attestation est annulée et réémise (2026-09-21, décidée)

**Contexte.** D31 figeait l'attestation, et le jalon 5 avait retiré « Corriger
mon identité » de sa page : une faute de frappe dans le nom, découverte après
la réussite, ne se réparait plus que par une remise à zéro — tout refaire pour
une coquille, à l'inverse du sens de D23 (rien ne se répare à la main, et
l'étudiant se répare seul).

**Décision.** « Corriger mon identité » revient sur la page de l'attestation,
avec le NIP exigé comme dans D23. Quand la séance est réussie, la correction
**annule l'attestation en cours** (motif « identité corrigée ») et **en émet
une nouvelle** dans le même lot : nouveau code, nouvelle signature, nouvelle
identité, **mêmes résultats, mêmes dates**. L'ancien code répond « annulée »
avec le motif ; le journal des corrections d'identité note les deux codes.
Une correction sans changement ne réémet rien.

**Conséquences.** Précise D31 : ce qui est figé, ce sont les résultats et les
dates ; l'identité suit la correction, mais jamais en silence — l'ancienne
attestation reste vérifiable et dit pourquoi elle ne vaut plus. Migration
`0003` : `attestations.annulation_motif`, `corrections_identite.ancien_code`
et `nouveau_code`. La vérification (D33) donne le motif d'une annulation.

## D38 — Réinitialisation du NIP depuis l'espace professeur (2026-09-21, décidée)

**Décision.** Dans le tableau des séances, un bouton **Réinitialiser le NIP**,
avec confirmation : le NIP est effacé (`nip_hache` nul), les essais et le
verrou tombent, la progression et le jeton restent. À sa prochaine reprise,
l'étudiant choisit un nouveau NIP : celui qu'il présente devient le sien, comme
à la création (mécanisme déjà prévu par D21). L'action est journalisée
(`reinitialisation_nip`). Le message « Si tu l'as oublié, demande à ton
enseignant de le remettre à zéro » a ainsi son bouton.

**Conséquences.** `POST /api/prof/reinitialisation-nip`. Complète D34 :
restent pour le jalon 6 la suppression d'une séance, la purge et la clé par
enseignant, avec une table des séances professeur qui permette de révoquer
(le cookie sans état du jalon 5 ne se révoque qu'à son expiration).

## D39 — Cadence réglable en local, pour les tests (2026-09-21, décidée)

**Contexte.** `npm run test:api` rejoue la réussite complète du M10 sur
`wrangler dev` : quinze corrections à la cadence réelle de 10 s, soit près de
trois minutes.

**Décision.** Une variable `CADENCE_S` (secondes entières, 1 à 999) règle la
cadence entre deux corrections. Même règle que `MODE_TEST` (D26) : absente de
`wrangler.jsonc` et du déploiement (un test le vérifie), en commentaire dans
`.dev.vars.exemple`, et **honorée seulement pour une requête adressée au poste
lui-même** — partout ailleurs, la cadence reste 10 s. `test:api` garde ses
étapes à la cadence réelle, puis relance `wrangler dev` avec `CADENCE_S:1` sur
la même base pour le cycle complet : une minute au lieu de trois.

**Conséquences.** `cadenceFor` dans `worker/seance.js` ; `cadenceWait` reçoit
la cadence en option. Rien ne change pour l'étudiant.

## D40 — Exercice « M10 - tournage - Vc et RPM » et restriction de matière d'outil pour tout l'exercice (2026-09-22, décidée)

**Contexte.** Après la mise en production du jalon 5, Thierry veut un second exercice : Vc lue
dans la table, comme le M10, **et** N calculée, sur des outils de pointage, de perçage, d'alésage
à la barre et de filetage ; jamais de carbure de tungstène solide. Le schéma d'exercice ne
permettait la restriction de matière que **par outil** (`outils[].materiaux_outil`), à répéter
sur onze entrées, sans pouvoir dire « pour tout l'exercice ».

**Décision.**

- Une clé facultative **à la racine de l'exercice**, `materiaux_outil` (liste de matériaux d'outil
  du catalogue, non vide, sans doublon), restreint le tirage de la matière pour **tous** les
  outils. Elle se croise avec la liste de l'outil et, s'il y en a une, avec celle de l'entrée
  (`allowedToolMaterials`, `exercice.js`). Un outil qui n'aurait **plus aucune matière permise**
  est refusé **au chargement**, avec un message qui dit ce que l'outil offre et ce que l'exercice
  permet : jamais un tirage impossible en cours de séance.
- L'exercice `site/exercices/m10-tournage-vc-rpm.json` : titre « M10 - tournage - Vc et RPM »,
  `champs_evalues` `["vc", "n"]`, `materiaux_outil` `["Acier rapide", "Insert de carbure de
  tungstène"]`, onze outils dans cet ordre — foret à pointer ; foret fractionnaire (jobber), foret
  à numéro, foret à lettre, foret métrique (jobber), foret Udrill ; barre à aléser ; SDTMR impérial
  et métrique, barre à fileter impériale et métrique —, **deux réussites de suite** chacun, soit
  22 questions ; tous les groupes usinables de chaque outil, toutes les dimensions. Inscrit à
  l'index, **listé** à l'accueil (D18).
- Tout ce qui existe s'applique sans changement : aide contextuelle, feuilles, mode test,
  attestation ; la tolérance de N en filetage (de −90 % à +0,1 %) et la barre à aléser à deux
  diamètres (N avec le Ø alésé) sont vérifiées par des tests dans cet exercice.

**Conséquences.** `validateExercise` et `eligibleTools` ; SPEC §10 ; `test-complet` et le M10
ne changent pas. L'éditeur (jalon 6) offrira cette clé à côté des restrictions par outil.

## D41 — L'attestation liste les questions réussies qui comptent (2026-09-22, décidée)

**Contexte.** Le tableau par outil (réussites obtenues / exigées) rend toutes les attestations
d'un même exercice identiques, à l'identité et aux dates près. Thierry veut que chaque copie soit
**unique et comparable d'un étudiant à l'autre** : ce qui a été demandé et ce qui a été répondu.

**Décision.**

- L'enregistrement figé (D31) porte une liste `questions` : pour chaque outil, **la série finale
  de réussites consécutives** (ses `reussites` dernières questions réussies — toujours après son
  dernier échec, puisqu'un échec remet le compteur à zéro, D12), le tout dans l'**ordre
  chronologique**. Chaque entrée : `numero` (le **rang de la question dans la séance**, réussies
  et ratées confondues), `outil_id`, `outil` (le nom **tel qu'affiché** : gabarit résolu, avec
  dimension, Ø de barre et nombre de dents quand le gabarit les porte), `materiau_outil`,
  `materiau` (`classe`, `groupe`, `materiau`, `etat`), `reponses` (les **réponses de l'étudiant**,
  telles que saisies, aux **grandeurs évaluées** seulement, sous les noms du moteur), `horodatage`.
  Tout vient du **journal des corrections**, qui contenait déjà tout : aucune migration.
- La liste fait partie de la sérialisation **signée** ; le QR garde son contenu essentiel (D33) ;
  `/verifier` montre la liste complète, telle que le serveur la détient.
- Sur la page de l'attestation, le tableau par outil reste au-dessus, comme résumé ; la liste
  vient dessous. **Une page lettre quand ça tient, sinon la suite sur une deuxième page** avec
  l'en-tête du département, un rappel (nom, matricule, code) et le pied « Page n de N » ; le QR
  et le code restent en première page. Les lignes ont une hauteur fixe (une ligne, sans repli, un
  libellé trop long est tronqué) : la coupe est un calcul pur, calibré sur la page lettre mesurée
  dans Chrome (`PAGE_LAYOUT`, `attestation-data.js`).
- Les attestations **figées avant cette version** restent telles quelles (sans liste, signature
  intacte) ; la liste s'applique aux attestations composées à partir de cette version — y compris
  la reconstitution d'une séance réussie avant le jalon 5, dont le journal existe. La réémission
  (D37) reprend la liste telle quelle.

**Conséquences.** `successfulQuestions` et `buildAttestation(…, corrections)`
(`worker/attestation.js`), `listCorrections` (`base.js`) ; `questionsTable`, `attestationPages`
(`attestation-screen.js`), `verifier.js` ; SPEC §7, §8 ; UI §3.6, §3.7.

## D42 — Réémission : un code d'attestation déjà pris est retiré (2026-09-22, décidée)

**Contexte.** Point 2 du rapport du jalon 5 : à la réémission (D37), un code tiré déjà pris
faisait échouer le lot (UNIQUE) et répondait 409 « ce matricule a déjà une séance », message faux.

**Décision.** `moveSession` distingue la contrainte violée (`seances` → « matricule »,
`attestations.code` → « code ») ; sur « code », le serveur tire un autre code et recommence, comme
il le faisait déjà à la réussite. L'aléa des codes est **injectable** (`tools.randomBytes`, à côté
de `now` et `random`), pour forcer une collision dans les tests.

## D43 — Réponses au rapport « exercice Vc et RPM » (2026-09-22, décidée)

Points tranchés par Thierry, sur D40 et D41 :

- **Numéro** de la liste des questions : le rang **dans la liste**, de 1 à n — pas dans la séance.
  Les trous révélaient les échecs, qu'UI §3.4 interdit d'afficher ; l'heure suffit à la
  chronologie, et l'unicité de la copie ne dépend pas du numéro.
- **Titre** de l'exercice aligné sur le style du M10 : « M10 — Tournage : Vc et RPM » (remplace
  le titre écrit dans D40).
- **Jamais de troncature** sur une attestation : un libellé long se replie dans sa cellule, quitte
  à ce qu'un rang prenne deux lignes ; la pagination en tient compte — elle estime les lignes de
  chaque rang (largeur des colonnes, largeur de caractère prise avec marge) et ne coupe jamais un
  rang entre deux pages.
- **Pagination par constantes mesurées** : acceptable. Les constantes et la police sont consignées
  dans UI §3.6, avec la consigne de recalibrer si la police d'impression change.
- **Réponses normalisées** au figeage : le nombre interprété (point ou virgule, espaces ignorés),
  écrit au format d'affichage de la grandeur (D10, D14 : point décimal, N entier, avances à
  4 décimales, 5 en filetage, Vf à 3). La frappe brute n'a pas de valeur.

## D44 — Clé de consultation partagée et rôles de l'espace professeur (2026-09-24, décidée)

**Contexte.** L'espace professeur (D34) n'avait qu'une clé, `CLE_ADMIN`, qui permet tout. Des
collègues doivent pouvoir voir les réussites et les exporter sans pouvoir remettre à zéro,
réinitialiser un NIP, supprimer ni effacer.

**Décision.**

- Une **seconde clé**, `CLE_CONSULTATION`, secret du Worker comme `CLE_ADMIN` (`wrangler secret put` ;
  `.dev.vars` en local). Facultative : sans elle, seule la clé d'administration ouvre.
- `/prof` accepte l'une ou l'autre. Le **cookie de séance porte le rôle** — `admin` ou `consultation` —
  à côté de l'identifiant d'enseignant, qui est le nom du rôle tant qu'il n'y a pas de table des
  enseignants. Une charge du jalon 5 (sans rôle) n'est plus lue : on se reconnecte. Le **journal des
  actions note le rôle** à la connexion (colonne `enseignant`, et « rôle … » dans les détails).
- **Mêmes verrous** d'essais et de délai : cinq échecs par adresse, quelle que soit la clé visée.
- Rôle consultation, **lecture seule** : liste des réussites par exercice (filtre, tri, recherche),
  export CSV, journal des corrections d'identité. **Aucun bouton d'action** à l'écran, et chaque route
  d'action (`remise-a-zero`, `reinitialisation-nip`, `suppression`, `effacement`) **refuse ce rôle côté
  serveur** (403), pas seulement à l'écran.
- La clé est **partagée entre collègues** : `DEMARRAGE.md` §7 dit comment la créer, la remettre et la
  remplacer si elle circule trop (`wrangler secret put CLE_CONSULTATION`, sans push).

**Conséquences.** `worker/acces.js` (`ROLES`, `canAct`, charge à trois champs), `requireAdmin` dans
`worker/index.js`, `prof-data.js` (`canAct`, `roleLabel`). Remplace « une seule clé » de D34 ; « une clé
par enseignant » (D23, D34) reste à faire.

## D45 — Suppression d'une séance : la séance et son journal disparaissent, les attestations restent, annulées (2026-09-24, décidée)

**Contexte.** D23 et D34 prévoyaient de supprimer une séance ouverte par un autre au matricule d'un
étudiant — farce visible aux horodatages — ; D35 ne fait que remettre à zéro.

**Décision.**

- **Rôle admin seulement** : bouton **Supprimer** par ligne, confirmation qui rappelle le nom, le
  matricule et l'exercice, action **journalisée** (`suppression`, sans lien vers la séance, qui n'existe
  plus : l'étudiant et le numéro de séance sont dans les détails).
- La **séance disparaît** avec son journal des corrections et ses corrections d'identité (ON DELETE
  CASCADE). Ses **attestations restent** : l'attestation en cours passe à **« annulée — séance
  supprimée »** (motif `seance_supprimee`) avec la date, ce que `/verifier` dit ; une attestation déjà
  annulée garde son motif et sa date. Migration `0004` : `attestations.seance_id` devient facultatif,
  mis à NULL par la base à la suppression — la table est recréée, SQLite ne modifie pas une contrainte
  en place.
- L'étudiant peut recommencer de zéro au même matricule ; une nouvelle réussite donne une attestation neuve.

**Conséquences.** `POST /api/prof/suppression`, `base.deleteSession` ; SPEC §7, §8 ; UI §3.7, §3.8.
Ferme le point laissé ouvert par D23.

## D46 — Effacement des données des étudiants en fin de session (2026-09-24, décidée)

**Contexte.** Le pied de page promet depuis D19 « tes données sont effacées à la fin de la session »,
et SPEC §9 le dit ; rien ne le faisait encore.

**Décision.**

- **Rôle admin seulement**, sur une **page à part** de `/prof` : « Effacer les données des étudiants ».
  Avant d'effacer, la page propose l'**export CSV de tout**, puis exige de taper le mot **EFFACER** ;
  le serveur exige le même mot dans la requête (400 sinon, rien n'est touché).
- L'effacement supprime **toutes** les séances, journaux de corrections, corrections d'identité et
  attestations, **ainsi que les compteurs de débit et les verrous par adresse** (`debit`, `verrous` :
  ils contiennent des matricules et des codes consultés, la promesse du pied de page vaut pour eux,
  et perdre une heure de compteurs ne coûte rien), en un seul lot. Les anciens codes d'attestation
  répondent ensuite « aucune attestation ne correspond ». Le pied de page qui annonce l'effacement
  reste vrai.
- Il **garde le journal des actions**, mais **anonymisé** : dans les détails des entrées existantes,
  les noms, matricules et codes d'attestation sont remplacés par « — » ; la date, le rôle, l'action,
  l'exercice et les nombres restent (« m10-tournage-vc · — · — · séance 7 »). Les lignes sont
  détachées des séances. L'effacement y inscrit les **nombres effacés** (`effacement`, « 3 séances ·
  40 corrections · 1 correction d'identité · 2 attestations · 12 compteurs de débit · 1 verrou ·
  4 entrées du journal anonymisées »). Le journal reste utile sans les identités.
- Les **exercices, la banque d'outils et les données de référence ne sont jamais touchés** : ils ne
  sont pas en base (D22).

**Conséquences.** `POST /api/prof/effacement`, `base.countStudentData`, `base.listTeacherLog`,
`base.purgeStudentData`, `PURGE_WORD` et `anonymizedDetails` (`acces.js` ; le mot est le même dans
`prof-data.js`, un test le vérifie) ; SPEC §7, §8, §9 ; UI §3.8. L'éditeur du catalogue devient le
jalon 7 (`PLAN.md`).
