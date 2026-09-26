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

## D47 — Les exercices et la banque d'outils vivent en D1 : copies d'outils, versions publiées immuables, séance épinglée (2026-09-24, décidée)

**Contexte.** Thierry est le seul auteur des exercices ; il veut en créer dix à vingt lui-même, en
production, depuis n'importe quel poste, sans commit ni déploiement. D11 prévoyait un éditeur
statique qui produit des JSON à déposer dans le dépôt ; D22 faisait lire au serveur les JSON de
`site/` ; D21 (point 4) faisait continuer une séance sur un exercice modifié, avec des compteurs
par outil. Rien de cela ne convient à une édition en production.

**Décision.**

- **Quatre tables de plus en D1** (migration `0005`) : `tables_reference` (une version des tables
  de référence : le contenu de `materiaux.json` et d'`operations.json`, immuable, identifiée par sa
  révision — une seule pour l'instant, « A2026_r0 »), `banque_outils` (un outil par ligne, au format
  d'`outils.json`, modifiable, archivable), `exercices` (l'identifiant d'URL, définitif, et le
  **brouillon**, seul état modifiable) et `versions_exercice` (les versions publiées d'un exercice,
  numérotées 1, 2, 3…, **immuables**, chacune avec la version des tables qu'elle utilise).
- **Un exercice porte des COPIES d'outils**, pas des références à la banque : chaque copie a ses
  dimensions possibles, son nombre de dents, son gabarit de nomenclature, sa photo (`image`), ses
  facteurs et ses réussites de suite exigées. Modifier la banque ne change aucun exercice ; modifier
  une copie ne change pas la banque. Les restrictions par outil de SPEC §10 (`dimensions`,
  `materiaux_outil`, `groupes` d'une entrée) disparaissent du format enregistré : restreindre, c'est
  retirer de la copie. Restent les restrictions de tout l'exercice : `materiaux_outil` (D40) et,
  nouveau, `groupes`.
- **Une séance est épinglée à sa version** (`seances.version_id`) de sa création à sa fin ; seules
  les nouvelles séances prennent la dernière version publiée. Une publication ne touche donc
  jamais une séance en cours : **remplace le point 4 de D21** (la séance qui « continue » sur
  l'exercice modifié). La version d'un exercice est son numéro (« 1 », « 2 ») : c'est ce que
  l'attestation inscrit comme « version de l'exercice » (`revision`).
- **Semence** : la migration importe les JSON du dépôt tels qu'ils étaient ce jour-là — les tables
  comme « A2026_r0 », les 29 outils comme banque (chaque outil recevant `image` = son id), les deux
  M10 comme version 1 publiée (brouillon identique). Les séances existantes pointent vers la
  version 1 de leur exercice ; une séance créée par l'ancien serveur entre la migration et le
  déploiement (sans version) prend la dernière publiée à sa première requête, et y reste. Les liens
  `?exercice=<id>` diffusés sur Léa ne changent pas ; les attestations émises restent telles quelles.
- **Le serveur et le navigateur lisent l'exercice en base** : `worker/catalogue.js` assemble une
  version (tables + copies) au format de `loadData` ; le navigateur demande `GET /api/exercice`
  (dernière version pour l'accueil, celle de la séance ensuite) et `GET /api/exercices` (la liste
  de l'accueil). **Remplace « une seule source de données : `site/data/` et `site/exercices/` » de
  D22** : les JSON du dépôt ne servent plus qu'à la semence et aux tests (`tests/aide.js`,
  `reference/semence-d1/generer.mjs`), avec un test qui vérifie que la semence leur est identique.
- Un exercice **archivé** disparaît de la liste et refuse toute nouvelle séance ; les séances en
  cours continuent, les attestations restent vérifiables. Un exercice sans aucune séance peut être
  supprimé ; sinon, seulement archivé.

**Conséquences.** `exercice.js` : `copyOfTool`, `draftFromExercise`, `engineExercise`,
`draftErrors`, `allowedGroups` ; `data.js` : `toolErrors` (erreurs par champ), `assembleData` ;
`progression.js` ne restreint plus les dimensions par entrée que pour les fichiers JSON des tests ;
`base.js`, `catalogue.js` réécrit, `index.js` (version épinglée sur chaque route de séance) ;
`app.js` et `main.js` (l'exercice vient du serveur, la version de la séance est rechargée au
besoin). SPEC §3, §7, §10 ; UI §3.1 ; CLAUDE.md. D11 reste vraie pour les deux couches (catalogue,
exercices) et l'éditeur ; son « éditeur statique » est remplacé par D48.

## D48 — L'éditeur en production, rôle admin, validation continue, contrôle de version optimiste, journal (2026-09-24, décidée)

**Décision.**

- L'éditeur est une page du site, `/prof/editeur`, derrière la connexion de l'espace professeur avec
  le **rôle admin** seulement (D44) : chaque route `/api/prof/editeur/*` refuse le rôle consultation
  côté serveur (403), pas seulement à l'écran ; la page refuse la clé de consultation à la
  connexion. **Chaque action est inscrite au journal des actions** (`editeur_creation`,
  `editeur_enregistrement`, `editeur_renommage`, `editeur_archivage`, `editeur_retablissement`,
  `editeur_suppression`, `editeur_publication`, `editeur_banque_*`, `editeur_export`,
  `editeur_import`) ; l'aperçu et les lectures, non.
- **Validation continue** : la règle est celle du quiz — `toolErrors` (le `validateData` du catalogue,
  outil par outil) et `draftErrors` (l'exercice), partagés par le serveur et le navigateur. Chaque
  erreur nomme son champ (« outils.1.fact_vc ») et s'écrit à côté de lui ; « Publier » reste
  désactivé tant qu'il en reste, et le serveur refuse de publier un brouillon en erreur (400, erreurs
  jointes). Un brouillon en erreur s'enregistre quand même : c'est un brouillon.
- **Contrôle de version optimiste** : le brouillon d'un exercice et un outil de la banque portent un
  numéro de `revision` ; un enregistrement doit présenter celui qu'il a lu, sinon il est refusé
  (409) avec un message clair et rien n'est écrasé — l'éditeur ouvert sur deux appareils, le
  second perd. La ligne du journal n'est écrite que si l'enregistrement a eu lieu.
- La liste des exercices montre l'état (jamais publié, brouillon modifié — comparaison du contenu
  avec la dernière version —, à jour, archivé), la dernière version, le nombre de séances par
  version, et offre dupliquer (un nouveau brouillon, jamais publié), renommer (le titre du
  brouillon), archiver ou rétablir, supprimer (sans séance seulement), copier le lien étudiant.
- La page d'un exercice : réglages généraux (titre, grandeurs évaluées, matières d'outil et groupes
  permis pour tout l'exercice, proposé à l'accueil), puis ses copies d'outils dans l'ordre — ajouter
  depuis la banque ou depuis un autre exercice, dupliquer dans l'exercice, retirer, monter,
  descendre ; sur chaque copie, tout ce qu'`outils.json` porte, plus les réussites de suite. Le
  **gabarit de nomenclature reste en lecture seule**, avec un exemple composé (son édition, les
  images et les tables : jalon 7b). La photo se choisit parmi celles de `site/img/outils/` (liste
  dans `index.json`, vérifiée par un test).
- La banque : les mêmes formulaires ; créer, dupliquer, modifier, archiver ; chaque outil dit dans
  quels exercices il a une copie (`origine` de la copie), à titre d'information.
- Les dimensions s'éditent en texte, une par ligne, « libellé ; valeur » (Ø en pouces, ou le
  filetage en texte « 0.25-20 », « 10x1.5 »), les barres d'un outil à deux diamètres de même.

**Conséquences.** `worker/editeur.js` (règles pures), routes dans `index.js`, SQL dans `base.js` ;
`site/prof/editeur.html`, `site/js/ui/editeur.js`, `editeur-data.js` (pur, testé),
`site/css/editeur.css` ; `site/img/outils/index.json`. `worker/index.js` n'exporte que des fonctions :
le Workers runtime refuse tout autre export du module d'entrée (un test le vérifie). UI §3.9.

## D49 — Publier avec le résumé des différences, aperçu sans trace, sauvegarde par export et import par fusion (2026-09-24, décidée)

**Décision.**

- **Publier** enregistre le brouillon, puis montre les différences avec la version précédente —
  réglages changés, outils ajoutés, retirés ou modifiés champ par champ, ordre changé — et crée la
  version suivante après confirmation. Une publication sans différence est permise (le brouillon
  redevient « à jour »). La version prend les tables de référence les plus récentes.
- **Aperçu** : dix questions tirées parmi tous les outils du brouillon (tel qu'il est à l'écran,
  même non enregistré) ou d'une version, avec la nomenclature composée, le matériau tiré et les
  réponses attendues des grandeurs évaluées. Aucune séance, rien d'enregistré, rien au journal.
  Ce n'est pas le mode test (D26) : il n'existe que derrière la clé d'administration.
- **Sauvegarde** : un export JSON complet (`format` « quiz-parametres-coupe/editeur/1 » : tables de
  référence, banque, exercices avec brouillon et toutes leurs versions), jamais de données
  d'étudiants. **L'import fusionne** : il ajoute les tables, exercices et versions absents, remplace
  les brouillons et la banque ; il **ne supprime jamais une version publiée ni un exercice**, refuse
  une version ou une table différente sous un numéro ou un identifiant existant (immuables), refuse
  un contenu invalide ; il est d'abord validé et résumé, puis appliqué sur le mot IMPORTER, en un
  seul lot ; il ne touche ni aux séances, ni aux journaux, ni aux attestations. Un export réimporté
  ne change rien (aller-retour identique).

**Conséquences.** `versionDiff`, `diffLines` (`editeur-data.js`) ; `previewQuestions`,
`importPlan` (`worker/editeur.js`) ; `base.exportEditorData`, `base.applyImport`.
`DEMARRAGE.md` §7 : la sauvegarde par export, la restauration par import. La `CLE_ADMIN` reste le
seul secret de l'éditeur.

## D50 — Réponses au rapport du jalon 7a (2026-09-24, décidée)

Points tranchés par Thierry, sur D47 à D49 :

- **`test-complet` non semé**, **exercice archivé** (les séances en cours finissent), **renommer =
  le titre du brouillon** (l'identifiant d'URL est définitif) et **exports du module d'entrée** :
  acceptés tels quels. Pour **changer l'adresse d'un exercice**, on le duplique sous un nouvel
  identifiant et on archive l'ancien (`DEMARRAGE.md` §7).
- **La version d'un exercice est son numéro** : accepté. L'attestation des nouvelles séances affiche
  **« version 1 »** comme version de l'exercice et la révision des tables de référence
  (**« A2026_r0 »**) ; `/verifier` montre les deux. Le libellé est celui de l'affichage
  (`exerciseVersionLabel`, `attestation-data.js`) : l'enregistrement figé garde `revision: "1"`, et
  les attestations déjà émises (`"r0"`) restent telles quelles, à l'écran aussi.
- **Import et banque** : avant d'importer, la confirmation montre ce que l'import change dans la
  banque — outils ajoutés, modifiés et surtout **ceux qui disparaîtraient, par nom**. S'il y a des
  disparitions, la confirmation exige de taper **REMPLACER** au lieu d'IMPORTER, et **le serveur
  l'exige aussi** (400 sinon, le message dit le mot attendu et les outils). Les copies déjà faites
  dans les exercices ne changent pas ; un outil disparu ne peut plus être ajouté.
- Les huit autres points du rapport restent ouverts : Thierry y revient.

**Conséquences.** `importWord`, `REPLACE_WORD` (`worker/editeur.js` ; les mêmes mots dans
`editeur-data.js`, un test le vérifie), le résumé d'import `banque: { ajoutes, modifies, retires,
gardes }` ; SPEC §7 (API), §8, §10 ; UI §3.6, §3.9 ; DEMARRAGE §7.

## D51 — Réponses aux huit points ouverts du rapport du jalon 7a (2026-09-24, décidée)

Points tranchés par Thierry :

- **Publier une version identique à la précédente est refusé.** Le bouton se désactive avec « Aucune
  différence à publier » (`publishState`), et le serveur refuse aussi (400 « Aucune différence à
  publier : le brouillon est identique à la version n. », comparaison structurelle `sameContent`,
  sans l'ordre des clés ni les commentaires). Remplace « une publication sans différence est permise » de D49.
- **Ordre manuel des exercices** : un `rang` sur chaque exercice (migration `0006`), avec **Monter /
  Descendre** dans la liste de l'éditeur ; **l'accueil des étudiants suit le même ordre**
  (`GET /api/exercices`). Les deux M10 semés prennent les rangs 1 (vitesse de coupe) et 2 (Vc et
  RPM) ; un exercice créé, dupliqué ou importé prend le dernier rang, un exercice remplacé par un import
  garde le sien. Un déplacement réécrit les rangs 1 à n en un seul lot, est **journalisé**
  (`editeur_deplacement`, « id · rang 3 → 2 ») et porte un **contrôle optimiste** : la requête dit le
  rang que l'écran a vu ; s'il a changé ailleurs, 409 et rien ne bouge. Déjà en tête ou en queue : 400.
- **`limite_avance`** reste telle quelle dans le formulaire, marquée « non utilisée » ; elle sera
  tranchée avec les exercices d'avances.
- **Jalon 7b** (`PLAN.md`) : les images téléversées seront stockées **dans D1 en blob**, pas dans R2
  (qui exige une carte de crédit), **réduites dans le navigateur avant l'envoi** ; le manifeste
  `site/img/outils/index.json` fait à la main sera remplacé. Le **brouillon choisira sa version des
  tables** de référence au 7b.
- Points 11 (`site/prof/` à côté de `prof.html`), 12 (corps jusqu'à 4 Mo), 13 (exports du module
  d'entrée) et 14 (choix visuels) : acceptés tels quels.
- **Flux git** : à la fin d'une session, la branche de travail est **poussée** (`git push`, jamais
  `main`, jamais de fusion) ; Thierry relit les rapports sur GitHub. Inscrit dans `CLAUDE.md`.

**Conséquences.** `POST /api/prof/editeur/exercice/deplacer`, `base.renumberExercises`,
`exercices.rang` dans les listes et l'export ; SPEC §7 (API), §10 ; UI §3.9 ; PLAN (7b) ; CLAUDE.md.

## D52 — Trois états par grandeur : évaluée, fournie, masquée (2026-09-24, décidée)

**Contexte.** Un exercice ne distinguait que les grandeurs évaluées (à saisir) des autres, toutes
pré-remplies. Thierry veut pouvoir **masquer** une grandeur qui ne sert pas à l'exercice : ni
saisie, ni valeur montrée.

**Décision.**

- Chaque grandeur (Vc, fz, N, f, Vf) prend un état : **évaluée** (saisie et corrigée), **fournie**
  (valeur théorique montrée, comptée juste) ou **masquée**. Au moins une grandeur évaluée.
- Une grandeur masquée s'affiche **« — »** dans l'écran Question, sans valeur, sans champ de saisie,
  note « non demandée » ; **sa valeur ne figure nulle part dans les réponses de l'API** au
  navigateur : ni dans la question (`texte` vide, `masque: true`), ni dans la correction (`attendu`
  nul), ni dans les calculs en une ligne, où elle s'écrit « — » (« Vf = N × f = — × — »).
- Pour la correction, une grandeur masquée se traite **comme une grandeur fournie** : sa valeur
  théorique entre dans le contrôle de cohérence de Vf (SPEC §6, D15), et elle compte juste.
- Format d'exercice (fichier et brouillon) : la clé facultative `champs_masques`, liste de
  grandeurs du schéma, sans doublon, disjointe de `champs_evalues`. Les deux M10 semés n'en ont pas :
  leurs grandeurs non évaluées restent fournies. L'export la porte (dans le brouillon) ; l'aperçu
  indique l'état de chaque grandeur et ne porte ni réponse ni valeur pour une masquée ; la liste des
  différences à la publication compare les états (« Grandeurs : « Vc évaluée · fz fournie … » → … »).
- L'éditeur : une ligne par grandeur avec trois boutons radio (évaluée, fournie, masquée).

**Conséquences.** `maskedFields` et `champs_masques` (`exercice.js`), `questionView` et
`correctionView` (`seance.js`), l'écran Question (`field--masked`), `fieldStates`,
`statesToDraft`, `previewColumns` (`editeur-data.js`) ; SPEC §7, §10 ; UI §3.3, §3.9. Tests :
aucune valeur masquée dans les réponses de l'API, correction inchangée pour les M10.

## D53 — Vitesse d'avance en filetage : cohérence à ±0,01 % (2026-09-24, décidée)

**Contexte.** En filetage (tarauds, barres à fileter, SDTMR), l'avance est le pas, exact ; une Vf
tolérée à ±0,5 % de *N_saisi × f_saisi* (D15) laissait passer une Vf calculée de travers.

**Décision.** Pour la famille filetage, la tolérance de cohérence de Vf est **±0,01 %** de
*N_saisi × f_saisi* ; les autres familles restent à ±0,5 %. La plage (N ± demi-unité) × (f ±
demi-unité) et la demi-unité d'affichage de Vf (D13) restent appliquées : une Vf calculée avec le
pas exact ou avec le pas arrondi à l'affichage est acceptée, une Vf décalée de 0,1 % ne l'est pas,
et une Vf cohérente avec un N saisi faux est acceptée pour Vf et refusée pour N.

**Conséquences.** `FEED_RATE_TOLERANCES` par famille dans `correction.js` ; la ligne de correction
dit « ±0.01 % de N × f » en filetage ; SPEC §6 (tableau et précisions) ; tests sur le taraud M10 x 1.50.

## D54 — Avertissement quand une grandeur à trouver se déduit des grandeurs fournies (2026-09-24, décidée)

**Contexte.** Avec les trois états (D52), un exercice peut fournir N et demander Vc : l'étudiant lit
alors Vc = N × Ø / (4 × facteur Vc) sans ouvrir la table. Le masquage cache une valeur, pas une
relation. L'enseignant doit le savoir au moment de régler l'exercice.

**Décision.** L'éditeur affiche un **avertissement non bloquant** — sans effet sur Publier — quand une
grandeur **évaluée ou masquée** se déduit des grandeurs **fournies** et des données de la question
(Ø, facteur Vc, limite RPM, nombre de dents). Seules les grandeurs fournies servent de source : une
grandeur évaluée n'est pas connue de l'étudiant. Relations couvertes, celles du moteur :

- Vc et N : N = Vc × 4 / Ø × facteur Vc, plafonné à la limite RPM. N se déduit de Vc fournie ; Vc se
  déduit de N fourni **sauf si N est plafonné** (le message le dit : « sauf si N est plafonné par la
  limite RPM »).
- fz et f : f = fz × dents ; chacune se déduit de l'autre.
- N, f et Vf : Vf = N × f ; deux fournies donnent la troisième.

Le message nomme la grandeur et la relation (« Vc se déduit de N fourni : Vc = N × Ø / (4 × facteur
Vc), sauf si N est plafonné par la limite RPM. »), sous les états dans les réglages, rafraîchi à
chaque changement, et repris dans la confirmation de publication. Les deux M10 semés en portent un
(Vc se déduit de N ; N se déduit de f et Vf) : c'est voulu, à l'enseignant de juger.

**Conséquences.** `deducibleWarnings` (`editeur-data.js`, pure, testée) ; `editeur.js` l'affiche ;
UI §3.9.

## D55 — Un seul auteur : ni clé par enseignant, ni table des séances professeur, ni mode test pour le professeur (2026-09-24, décidée)

**Contexte.** D23, D34, D38 et D44 gardaient en réserve « une clé par enseignant », une table des
enseignants et une table des séances professeur (pour révoquer un cookie avant ses 12 h) ; D26
prévoyait d'ouvrir plus tard le mode test aux séances d'un professeur connecté. Depuis, Thierry est le
seul auteur des exercices (D47), les collègues ont la clé de consultation partagée en lecture seule
(D44), et l'éditeur offre l'aperçu (D49) : dix questions avec leurs réponses, derrière la clé
d'administration, sans séance ni trace.

**Décision.** Ces trois chantiers sont **abandonnés** :

- **pas de clé par enseignant ni de table des enseignants** : deux clés, deux rôles (D44), point final ;
  l'identifiant d'enseignant du journal reste le nom du rôle ;
- **pas de table des séances professeur** : le cookie signé sans état (D34) reste, et se révoque en
  changeant la clé (`wrangler secret put`, `DEMARRAGE.md` §7) — les séances ouvertes expirent
  d'elles-mêmes, au plus 12 h après ;
- **le mode test reste local** (D26, inchangé pour le poste de développement) ; pour le professeur en
  production, **l'aperçu de l'éditeur le remplace**. Il ne sera pas ouvert à une séance d'étudiant,
  même celle d'un professeur connecté.

**Conséquences.** Remplace le « plus tard » de D26 et le « reste à faire » de D34, D38, D44 ; ferme
la piste « une clé par enseignant » de D23. `PLAN.md` (jalons 5 et 7b), SPEC §7 (mode test) et §8.

## D56 — Les images vivent dans D1, en blob : une seule liste, semée depuis le dépôt, servie par /images/<id> (2026-09-25, décidée)

**Contexte.** Les photos d'outils étaient des fichiers de `site/img/outils/` listés par un manifeste
tenu à la main (`index.json`), les pictogrammes d'opérations des SVG de `site/img/pictos/operations/`
nommés d'après l'opération. L'éditeur (D47) écrit en production sans commit : il faut pouvoir y
téléverser une photo ou un pictogramme. D51 a écarté R2 (carte de crédit exigée) au profit de D1.

**Décision.**

- **Une table `images`** (migration `0007`) : identifiant, nom lisible, usage (`outil` : la photo d'un
  outil ; `operation` : le pictogramme d'une opération), type (celui des octets), taille, empreinte
  SHA-256, contenu en BLOB, date, date d'archivage. **Une seule route les sert, publique** :
  `GET /images/<id>` — type exact, `X-Content-Type-Options: nosniff`, `Cache-Control: public,
  max-age=31536000, immutable`, `ETag` (l'empreinte) et 304. Une image **ne change jamais sous le
  même identifiant** : ni l'éditeur ni l'import ne réécrivent un contenu.
- **Une seule liste, semée** : la migration `0007`, générée par
  `reference/semence-d1/generer-images.mjs`, importe les 29 PNG du dépôt (identifiant = celui de
  l'outil, nom = celui de l'outil) et les 19 SVG (identifiant = le slug de l'opération, nom = l'opération,
  contenu assaini comme un téléversement, D57). Plutôt que de servir deux sources derrière une même
  route : le serveur ne peut pas lister un dossier d'`ASSETS` (il aurait fallu garder un manifeste),
  un fichier peut changer sous le même nom à un commit (le cache d'un an serait faux), et archiver ou
  supprimer une image-fichier aurait demandé une table de « tombes ». La migration fait 420 Ko, sa
  plus grosse instruction 32 Ko (limite D1 : 100 Ko). Les fichiers de `site/img/outils/` et
  `site/img/pictos/operations/` **restent dans le dépôt comme semence et données des tests**, comme
  les JSON de `site/data/` (D47) : les modifier ne change rien en production ; un test vérifie que
  la semence leur est identique. Le manifeste `index.json` disparaît.
- **Ce qu'une image nomme** : `image` d'un outil (copie ou banque) est l'identifiant d'une image
  `outil` (sinon l'identifiant de l'outil, comme avant) ; le pictogramme d'une opération est son
  `pictogramme` s'il en a un (partie B), sinon le slug de son nom — c'est l'identifiant de la semence.
  Le quiz et les feuilles composent `/images/<id>` (`toolPhotoUrl`, `operationPicto`,
  `sheets-data.js`).
- **Téléversement** (rôle admin, `POST /api/prof/editeur/images/televerser`, base64 dans le JSON,
  corps ≤ 1 Mo, image ≤ 600 Ko) : **le navigateur réduit avant l'envoi** — une photo d'outil est
  redessinée sur fond blanc, plus grand côté 800 px, en **JPEG à 0,85** (une photo d'atelier n'a pas
  de transparence utile, les fiches l'affichent sur blanc, et 800 px suffisent au panneau de l'outil
  qui la montre à 120 px au plus : 40 à 150 Ko au lieu de plusieurs Mo) ; un pictogramme en image
  matricielle est réduit à 256 px en **PNG** (aplats et transparence gardés) ; un **SVG part tel
  quel** et le serveur l'assainit (D57). Jamais agrandie. Le serveur ne croit pas le type annoncé :
  il le lit dans les premiers octets (PNG, JPEG, WebP) ou dans le XML. **Un doublon exact n'est pas
  stocké deux fois** : la même empreinte rend l'image existante. L'identifiant d'un téléversement
  vient de son empreinte (`img-<16 hex>`) : même contenu, même identifiant, sur toute base — ce qui
  rend l'import (D59) sans conflit. (Les quatre photos que le classeur partage entre deux outils sont
  semées deux fois, sous les deux identifiants que la banque nomme ; la règle vaut pour les téléversements.)
- **Cycle de vie** : une image **utilisée** — par une version publiée, un brouillon, un outil de la
  banque ou une version des tables — **ne se supprime jamais** : elle s'**archive** (retirée des
  galeries, sauf sur l'outil qui la porte déjà ; toujours servie). Une image **jamais utilisée** peut
  être supprimée (404 ensuite). Renommer ne change que le nom lisible. Chaque action est au journal
  (`editeur_image_televersement`, `_renommage`, `_archivage`, `_retablissement`, `_suppression`,
  `_import`).

**Conséquences.** `worker/images.js` (règles pures : identifiants, types, base64, en-têtes,
utilisations), `base.js` (SQL des images), `index.js` (`/images/<id>` avant `ASSETS`, six routes
`/api/prof/editeur/images/*`), `site/js/ui/images-picker.js` (galerie, réduction dans le
navigateur), `site/js/ui/editeur-data.js` (plan de réduction, filtre, libellés), onglet **Images** de
l'éditeur ; SPEC §3, §7, §10 ; UI §3.3, §3.5, §3.9, §5 ; CLAUDE.md.

## D57 — Un SVG téléversé est assaini par liste blanche, ou refusé (2026-09-25, décidée)

**Contexte.** Un SVG est un document : il peut porter des scripts, des gestionnaires d'événement, des
liens et des références externes. Il est affiché dans le quiz et l'éditeur.

**Décision.** Le serveur relit chaque SVG téléversé avec son propre lecteur XML (`worker/svg.js` :
le Workers runtime n'a pas de DOMParser) et le **resérialise** — ce qui est servi est ce qui a été
relu, jamais le texte reçu.

- **Refusé** (400, le message nomme la cause) : `script`, `foreignObject`, `image`, `a`, `iframe`,
  `object`, `embed`, `video`, `audio`, les animations (`animate*`, `set`) ; tout attribut `on*` ;
  un `href` ou `xlink:href` vers autre chose qu'un `#id` du fichier ; `url()` vers autre chose
  qu'un `#id`, `@import`, `expression()` dans un attribut ou un `<style>` ; un DOCTYPE ; une entité
  inconnue ; un fichier mal formé ; plus de 200 Ko ; sans `viewBox` ni largeur et hauteur.
- **Retiré, et dit** dans la réponse (`retires`) : les éléments et attributs hors liste blanche —
  métadonnées et attributs d'Inkscape ou d'Illustrator, `data-*`, un `xmlns` étranger.
- **Gardé** : les formes, groupes, définitions, dégradés, masques, filtres courants, texte, `style`
  (attribut et élément, sous les contrôles ci-dessus) ; `xmlns` est ajouté s'il manque (un `<img>`
  ne dessine pas un SVG sans lui).
- **Servi** avec `Content-Type: image/svg+xml; charset=utf-8`, `nosniff` et
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`.

Les dix-neuf pictogrammes convertis du classeur passent sans retrait (test) ; la semence les stocke assainis.

**Conséquences.** `worker/svg.js` (pur, testé sur un SVG piégé), `readUpload` (`images.js`),
`tests/worker-svg.test.js`, `tests/worker-images.test.js`.

## D58 — Le gabarit de nomenclature s'édite, avec les jetons permis et l'exemple composé (2026-09-25, décidée)

**Décision.** Dans le formulaire d'outil (copie ou banque), le champ `format_identifiant` (D24) est un
champ de texte ; sous lui, un bouton par jeton **permis pour cet outil** — `[IdDia]`, `[Dia]`,
`[Pas]` (filetage seulement), `[IdBarre]` (outil à deux diamètres seulement), `[NbDent]`,
`[NomOutil]`, `[Operation]`, `[Matoutil]` — qui insère le jeton au curseur ; l'**exemple composé**
se rafraîchit à la frappe, avec les premières valeurs de l'outil, et **« Autre exemple »** le tire au
hasard dans l'outil (dimension, dents, matière, barre qui entre), comme le ferait une question. Un
jeton inconnu ou sans valeur pour l'outil, et un crochet non apparié, sont des erreurs sous le champ
(`toolErrors`) qui bloquent Publier — la règle du catalogue, inchangée.

**Conséquences.** `permittedTokens`, `insertToken`, `exampleIdentifier(…, random)` (`editeur-data.js`) ;
`toolErrors` (crochets) ; UI §3.9 ; SPEC §4.

## D59 — La sauvegarde porte les images, envoyées à part à l'import (2026-09-25, décidée)

**Contexte.** L'export (D49) doit contenir les images, sinon une restauration perd les photos. Un
export avec quelques dizaines de photos dépasse la limite des requêtes de l'éditeur (4 Mo).

**Décision.** L'**export** contient `images` : la fiche de chaque image et son **contenu en base64**
(les 48 de la semence : 440 Ko). L'**import** se fait en morceaux : le navigateur envoie à
`import/valider` et à `import` l'export **sans le contenu des images** (les fiches seulement) ; la
validation dit quelles images de l'export **manquent** dans la base ; le navigateur les envoie
**une par requête** (`POST /api/prof/editeur/images/importer`, avec leur identifiant et leur
empreinte, que le serveur vérifie sur le contenu) ; puis l'import s'applique — il refuse (400) tant
qu'une image manque. Une image déjà présente sous le même identifiant avec la même empreinte ne
change pas ; avec une autre empreinte, l'import est refusé (une image ne change jamais sous le même
identifiant). L'import met à jour le nom et l'état d'archivage des images présentes. Un export
d'avant les images s'importe encore. **L'aller-retour reste identique**, images comprises (testé).

**Conséquences.** `importPlan` (`images_manquantes`, `images_presentes`, `images_modifiees`),
`base.applyImport`, `editeurImageImporter` ; l'onglet Sauvegarde ; SPEC §7, §10 ; DEMARRAGE §7.

## D60 — Réponses au rapport de la partie A du jalon 7b : une photo transparente garde le PNG (2026-09-25, décidée)

Points tranchés par Thierry, sur D55 à D59 :

- **Acceptés tels quels** : les photos partagées de la semence stockées deux fois (point 1), la suppression
  refusée dès qu'un brouillon ou la banque nomme l'image (point 2), l'identifiant d'un téléversement tiré
  de son empreinte (point 3), le SVG semé servi assaini (point 5), `limite_avance` inchangée (point 6), le
  téléversement en JSON base64 (point 7), les choix visuels (point 8).
- **Point 4 — la transparence d'une photo d'outil est gardée.** Le navigateur redessine d'abord l'image
  réduite sans fond et lit ses pixels : si **au moins un pixel n'est pas opaque**, la photo part en **PNG**,
  réduite à 800 px, **sans fond blanc** (une photo détourée reste détourée sur le fond nuit) ; sinon, en
  **JPEG à 0,85 sur fond blanc** comme avant. Le pictogramme reste en PNG à 256 px, le SVG tel quel.
  Complète D56.

**Conséquences.** `uploadPlan(usage, isSvg, transparent)` et `hasTransparency` (`editeur-data.js`, testés),
`prepareUpload` (`images-picker.js`) ; SPEC §3 ; UI §3.9 ; DEMARRAGE §7.

## D61 — Les tables de référence s'éditent et se publient : un brouillon unique, des versions immuables avec leur révision, les couleurs et les pictogrammes dans les tables (2026-09-25, décidée)

**Contexte.** Depuis D47, les tables de référence (matériaux, opérations) vivent en D1 comme versions
immuables, mais une seule existait (« A2026_r0 », la semence) et rien ne permettait d'en publier une
autre. Les couleurs de sens (classes ISO, matières d'outil) étaient des variables de `tokens.css`
(UI §1), et les pictogrammes d'opérations étaient trouvés par le nom de l'opération.

**Décision.**

- **Un brouillon unique des tables** (table `brouillon_tables`, migration `0008`, semé depuis la
  version la plus récente), modifiable, avec un contrôle optimiste (D48) ; **des versions publiées
  immuables** (`tables_reference`), comme les exercices. Le brouillon note la version dont il est
  parti (`base_id`). Chaque action est au journal (`editeur_tables_enregistrement`, `_publication`).
- **Ce qu'une version contient** — le format de SPEC §3, complété : les **classes ISO**
  (`classes_iso` : code, nom, couleur vive, couleur du texte, teinte de ligne), les **matières d'outil**
  (`materiaux_outil` : la clé de `vc_pi_min`, fixe — `acier_rapide`, `carbure_solide`,
  `insert_carbure` —, le nom que les outils nomment et que l'étudiant lit, la couleur de la colonne),
  les **matériaux usinés** (avec `debut_famille`, D27), les **opérations** (machine, direction,
  famille d'avance, avances, et `pictogramme` : l'identifiant d'une image, D56). Les groupes ISO
  (`groupes_iso`) sont **dérivés des lignes** (« classe - matériau », dans l'ordre d'apparition), plus
  saisis. **Les couleurs passent dans les tables** : `tokens.css` ne garde que les valeurs par défaut,
  et une version d'avant (« A2026_r0 ») est **complétée à la lecture** avec ces valeurs
  (`completeTables`, `site/js/tables.js`) — la ligne en base ne change pas, la semence reste identique
  aux JSON, un export d'avant s'importe encore. **Le quiz, les feuilles et l'éditeur lisent les couleurs
  et les matières de la version en usage** (`data.classesIso`, `data.toolMaterials`,
  `data.toolMaterialKeys` ; les variables CSS sont posées sur la page par `applyTableColors`) ; le
  rouge K de nuit (D30) est composé de la couleur de la classe (64 % couleur, 36 % blanc). Renommer
  une matière d'outil est permis : les outils qui nomment l'ancien nom passent en erreur, nommée.
- **La révision** (D28) est **saisie à la publication**, avec une **suggestion** qui incrémente la
  dernière (« A2026_r0 » → « A2026_r1 » ; sans suffixe, « _r1 »), **unique** (409 sinon) ; elle est
  posée dans les deux JSON de la version. La publication exige un brouillon sans erreur
  (`validateTables`, 400 avec les erreurs jointes), refuse un brouillon identique à la version dont il
  est parti (400) et une révision périmée (409), et montre d'abord les **différences valeur par
  valeur** (`tablesDiff` : « Acier non allié (groupe 1), Insert de carbure de tungstène : 400 → 999
  pi/min », « Classe P — couleur : … », « Opération « Perçage » — avance (po/rév) : … », matériaux et
  opérations ajoutés, retirés, réordonnés). Une nouvelle version **ne change aucun exercice toute
  seule** (D62).
- **La version la plus récente** est la dernière publiée ou importée (l'ordre d'insertion, pas la
  date : une horloge fausse ne fait pas remonter une vieille version).

**Conséquences.** `site/js/tables.js` (pur : valeurs par défaut, complétion, variables CSS, révision
suivante, différences), `data.js` (`validateTables`, `assembleTables`, index des couleurs et des
matières), `question.js` (la clé de la matière d'après les tables), `sheets-data.js` et
`reference-screen.js` (couleurs des tables), `base.js`, `index.js` (routes `tables`), l'onglet
**Tables de référence** de l'éditeur ; SPEC §3, §7, §10 ; UI §1, §3.5, §3.9.

## D62 — Le brouillon d'un exercice choisit sa version de tables ; une séance garde celles de sa version d'exercice (2026-09-25, décidée)

**Décision.**

- Chaque exercice porte la **version de tables de son brouillon** (`exercices.tables_id`, migration
  `0008`) : la plus récente à sa création (une copie garde celle de sa source) ; les exercices
  existants sont sur « A2026_r0 ». **Le brouillon est validé contre cette version** : un matériau, un
  groupe ou une matière d'outil qu'elle n'a plus est une **erreur nommée** (« groupe de matériaux
  inconnu : « K - Fonte grise » », « matériau d'outil inconnu : « Acier rapide » (les tables offrent
  HSS, …) »), qui bloque la publication. **La publication prend cette version** — plus « la plus
  récente » (remplace ce point de D47 et D49) — et **un changement de tables est une différence à
  publier**, même à contenu identique (« Tables de référence : « A2026_r0 » → « A2026_r1 » »).
- Quand une version plus récente existe, **la page de l'exercice le signale** et offre d'y passer ;
  le bouton montre d'abord **ce que ça change pour cet exercice** (`exerciseTablesImpact`) : les
  erreurs qui apparaîtraient, les Vc qui changent dans les groupes et matières que ses outils tirent,
  les avances et pictogrammes de ses opérations, les matériaux ajoutés ou retirés dans ses groupes ; puis
  le passage (`POST exercice/tables`, contrôle optimiste, journalisé). Le brouillon seul change ; les
  versions publiées et les séances en cours gardent leurs tables.
- **Une séance utilise toujours les tables de sa version d'exercice** (D47) : questions, correction,
  feuilles de référence et couleurs à l'écran, révision des tables sur l'attestation (D28) — vérifié :
  une séance commencée avant la publication de « A2026_r1 » garde ses réponses attendues ; l'attestation
  d'une séance sur une version 2 inscrit « A2026_r1 ».

**Conséquences.** `exerciseTables` et `editeurExerciceTables` (`index.js`), `base.setExerciseTables`,
`exerciseTablesImpact`, `tablesNotice`, `versionDiff(…, tables)` (`editeur-data.js`) ; l'export porte
`tables_id` par exercice (un export d'avant : la plus récente) ; SPEC §7, §10 ; UI §3.9.

## D63 — Feuilles imprimables par version de tables, aperçu d'un brouillon de tables (2026-09-25, décidée)

**Décision.**

- **`/tables?version=<révision>`** : les trois feuilles de référence d'une version publiée, telles que
  l'étudiant les voit, avec les couleurs de cette version, la révision au pied et dans la barre, sans
  retour à une question — la même couche que dans le quiz (`createReference`, `standalone`), sur une
  page lettre à l'impression. Publique (`GET /api/tables?version=`) : ce sont les feuilles de
  l'atelier. Ouverte depuis l'éditeur (liste des versions, « Feuilles imprimables »).
- **Aperçu d'un brouillon de tables** : depuis l'onglet, le choix d'un exercice et **dix questions** de
  son brouillon tirées avec les tables **telles qu'à l'écran** (même non enregistrées), avec leurs
  réponses ; rien n'est enregistré, rien au journal. Un exercice en erreur avec ces tables est refusé,
  et le message nomme l'erreur.

**Conséquences.** `site/tables.html`, `site/js/ui/tables.js`, `assembleTables` (`data.js`),
`GET /api/tables`, `POST /api/prof/editeur/tables/apercu` ; UI §3.5, §3.9.

## D64 — Images de chaleur et de forme de copeaux par classe ISO, sous le matériau brut (2026-09-26, décidée ; image de copeaux et mise en page remplacées par D66)

**Contexte.** Thierry a fourni douze petites images, deux par classe ISO (P, M, K, N, S, H) : où la
chaleur se concentre dans la coupe, et la forme typique du copeau. Elles doivent aider l'étudiant sur
l'écran Question, à côté du matériau brut tiré, sans rien dire de ce qui est à trouver. Elles ont un fond
blanc composé dans l'image, alors que l'écran est sur fond nuit (UI §1).

**Décision.**

- **Détourage dans le dépôt, pas à la main** : `reference/semence-d1/detourer-copeaux.mjs` (avec
  `png.mjs`, un lecteur et écrivain PNG en JavaScript pur sur `node:zlib`, aucune dépendance) produit,
  pour chaque original de `site/img/copeaux/originaux/` (gardé comme source), un PNG à fond transparent
  dans `site/img/copeaux/`, nommé par l'identifiant d'image. Méthode : remplissage depuis les bords sur
  les pixels proches du blanc — les trois canaux ≥ **244**, seuil mesuré sur les douze originaux : le
  copeau le plus clair atteint 240, le blanc des rendus ne descend pas sous 250 hors des bords —, ce qui
  n'est pas atteint depuis un bord reste opaque (le blanc intérieur d'un copeau ou d'un reflet, la pièce
  et l'outil qui touchent les bords) ; un **bord adouci** d'un pixel de chaque côté de la frontière, alpha
  en rampe de 244 (opaque) à 252 (transparent), couleur démélangée du blanc pour éviter tout liseré clair
  sur le fond nuit ; jamais agrandi, réduit à 256 px de plus grand côté si plus grand (aucun ne l'est :
  237 px au plus). Un test vérifie que les fichiers détourés sont exactement ce que le script produit.
- **Semence** : la migration `0009` (générée par `generer-copeaux.mjs`) insère les douze PNG détourés
  dans `images` sous un **troisième usage, `classe`**, avec des identifiants lisibles
  (`copeaux-p-chaleur`, `copeaux-p-copeaux` — en minuscules, la règle des identifiants d'images) et le
  nom « Classe P — chaleur », « Classe P — forme de copeaux ». Une instruction par image (88 Ko au plus,
  sous la limite D1 de 100 Ko ; recoller des morceaux par `||` ne marche pas, SQLite concatène en texte).
- **Chaque classe ISO porte `image_chaleur` et `image_copeaux`** (l'identifiant d'une image, ou
  `null` : aucune), **complétés à la lecture** comme les couleurs (D61) : les classes par défaut
  (`DEFAULT_ISO_CLASSES`) nomment les images de la semence (O : aucune), et **une classe sans ses clés**
  — une version d'avant, `A2026_r0` comme une version publiée depuis avec `classes_iso` — **reçoit
  celles de sa lettre** (`completeIsoClass`) ; une clé présente, même `null`, est gardée. Ni
  `tables_reference` ni le brouillon des tables ne sont réécrits ; la semence reste identique aux JSON.
- **Écran Question** : sous la description du matériau brut, les deux images de sa classe, à la même
  hauteur, avec une légende courte (« Chaleur », « Copeaux »), sans fond ni cadre ; la hauteur suit la
  largeur du panneau (les deux tiennent côte à côte à 390 px, 110 px au plus) ; servies par
  `/images/<id>`, trouvées dans les classes ISO des tables de la version de la séance
  (`classImages`, `sheets-data.js`) — rien ne s'ajoute à `seance.question`. Une classe sans image, ou
  une image qui manque, laisse l'espace vide, sans erreur. L'**aperçu** de l'éditeur montre les mêmes
  images en vignettes devant le matériau usiné.
- **Éditeur, onglet Tables de référence** : deux colonnes de plus dans le tableau des classes ISO, avec la
  galerie compacte de l'usage « image de classe ISO » et le téléversement (PNG à 256 px, transparence
  gardée) ; **validation avec les fiches des images** — une image de classe inconnue ou **archivée est une
  erreur nommée** (« classes_iso[1] (M) : « image_chaleur » : l'image « copeaux-m-chaleur » est
  archivée … »), écran et serveur, qui bloque la publication et l'aperçu ; l'import valide ainsi le
  brouillon des tables de l'export, mais pas une version publiée (immuable : elle peut nommer une image
  archivée, toujours servie). **Différences à la publication** : « Classe P — image de chaleur :
  copeaux-p-chaleur → — ». Les utilisations d'une image comptent les classes (une image de classe
  utilisée s'archive, jamais supprimée) ; l'export et l'import les portent comme les autres (D59).

**Conséquences.** `site/img/copeaux/` (README), `reference/semence-d1/png.mjs`, `detourer-copeaux.mjs`,
`generer-copeaux.mjs`, migration `0009` ; `tables.js` (`CLASS_IMAGE_KEYS`, `completeIsoClass`,
`isoClassOf`, différences), `data.js` (`validateTables(tables, { images })`), `sheets-data.js`
(`classImages`), `question-screen.js`, `question.css` ; `worker/images.js` (`USAGES`, utilisations),
`worker/editeur.js` (`draftTablesErrors`), `index.js` ; l'éditeur (`editeur.js`, `editeur-data.js`) ;
SPEC §3, §7 ; UI §3.3, §3.4, §3.9 ; CLAUDE.md ; PLAN ; DEMARRAGE §7. Rapport : `docs/rapports/images-copeaux.md`.

**Complément (2026-09-26) — retouche du détourage.** La première méthode (alpha partiel sur un pixel de
chaque côté de la frontière, entre 244 et 252 seulement) laissait un **liseré gris-blanc** sur le fond
nuit. Remplacée, à la demande de Thierry, avant toute mise en production de `0009` (la migration est
régénérée) : après le remplissage depuis les bords (seuil 244 inchangé), le fond est **dilaté d'un pixel**
(érosion de l'objet, 8-connexité, `EROSION_PX = 1`) ; puis, sur une **bande de 3 pixels** à partir de ce
fond (distance euclidienne, `BANDE_PX = 3`), alpha = clamp((255 − min(R, V, B)) / (255 − 200), 0, 1)
(`PLANCHER = 200`) et la couleur est démélangée du blanc ; au-delà, l'objet reste opaque ; le blanc
intérieur non relié aux bords (≥ 244 hors du fond) reste intact, même dans la bande. Un test sur un disque
anticrénelé vérifie qu'aucun pixel d'alpha > 0,5 plus clair que 200 sur les trois canaux ne reste à moins de
3 px du fond (l'ancienne méthode en laissait 28).

## D65 — Caractéristiques d'une classe ISO, avec une solution facultative, sous le matériau brut (2026-09-26, décidée ; format, place et édition remplacés par D66)

**Contexte.** Sous les images de chaleur et de copeaux (D64), Thierry veut quelques lignes de texte par
classe ISO : ce qui caractérise l'usinage de cette classe, et, pour le problème typique, sa solution.

**Décision.**

- Chaque classe ISO porte `caracteristiques` : une liste de lignes `{ libelle, texte, solution? }`
  (au plus 6 ; libellé de 30 caractères au plus, texte de 90, **solution facultative de 90**). Complétée à
  la lecture comme les images (D64) : une classe sans la clé reçoit les lignes de sa lettre, une liste
  présente — même vide — est gardée ; rien n'est réécrit en base.
- **Contenu par défaut** (P à H, dans cet ordre) : **Effort**, **Chaleur**, **Copeaux**, **Problème
  typique** — ce dernier avec sa solution ; la classe O n'en a pas. Textes de Thierry, tels quels.
- **Écran Question** : sous les images, une ligne par caractéristique, « **Effort :** moyen » ; quand la
  ligne a une solution, une **ligne à part** dessous, en retrait, « → Solution : » en **couleur d'accent de
  la page** (`--color-accent-light`), puis le texte en **couleur secondaire** (`--color-text-muted`). Une
  classe sans caractéristique ne montre rien.
- **Éditeur, onglet Tables de référence** : une colonne **Caractéristiques** dans le tableau des classes,
  une zone de texte, une caractéristique par ligne, « libellé ; texte » ou « libellé ; texte ; solution »
  (comme les dimensions d'un outil) ; validée en continu, écran et serveur (`characteristicsErrors`) ;
  dans les différences à la publication, par libellé (« Classe M — Problème typique, solution : « … » →
  « … » », ligne ajoutée, retirée, ordre) ; dans l'export avec les tables.
- La complétion copie désormais les classes par défaut **en profondeur** : une version modifiée ne peut
  plus toucher les valeurs par défaut (défaut trouvé par les tests de cette décision).

**Conséquences.** `tables.js` (`DEFAULT_CHARACTERISTICS`, `CHARACTERISTIC_LIMITS`,
`characteristicsErrors`, différences), `data.js` (validation), `sheets-data.js` (`classFeatures`),
`question-screen.js`, `question.css`, `editeur-data.js` (`characteristicsText`,
`parseCharacteristics`), `editeur.js`, `editeur.css` ; SPEC §3 ; UI §3.3, §3.9. Rapport :
`docs/rapports/images-copeaux.md`.

## D66 — Changement pédagogique : l'image de chaleur seule, les caractéristiques de la classe à sa droite (2026-09-26, décidée)

**Contexte.** Thierry revoit D64 et D65 avant toute mise en production : l'image de forme de copeaux fait
double emploi (l'image de chaleur montre déjà la forme du copeau), et les caractéristiques de la classe se
lisent mieux à côté de l'image qu'en dessous. D65 avait été construite sur un complément arrivé avant le
message de base ; celui-ci en fixe le format.

**Décision.** Remplace, dans D64, l'image de copeaux et la mise en page ; dans D65, le format et l'édition.

- **Une seule image par classe, la chaleur** : `image_copeaux` sort du format des classes ISO, de la
  complétion, de la validation, des différences et de l'onglet Tables ; la migration `0009` (pas encore
  appliquée en production, donc régénérée) ne sème plus que les **six images de chaleur** ; les six PNG de
  copeaux et leurs originaux sortent du dépôt. Le détourage retouché (D64, complément) est gardé.
- **Écran Question** : sous la description du matériau brut, l'image de chaleur avec sa légende et, **à sa
  droite**, la liste des caractéristiques de la classe ; **sous l'image** quand la place manque (moins de
  160 px à côté d'elle) et toujours sur téléphone. Chaque ligne : le **libellé en gras**, le texte, en
  **couleur de texte secondaire**, sans puce (la lettre de classe du panneau sert de repère) ; une
  **solution** facultative suit sur une ligne à part, en retrait, « → Solution : » en couleur d'accent de la
  page (`--color-accent-light`) puis le texte en couleur secondaire.
- **Format** : `caracteristiques`, **0 à 6 lignes** `{ libelle ≤ 20, texte ≤ 90, solution? ≤ 90 }`,
  complétées à la lecture pour `A2026_r0` et le brouillon (même approche que les couleurs, D61).
- **Contenu semé** (P à H, dans cet ordre) : Effort, Chaleur, Copeaux, **Problème typique** avec sa
  solution — le texte du complément de Thierry, qui remplace la ligne « À surveiller » du message de base ;
  la classe O n'en a pas.
- **Éditeur, onglet Tables** : les caractéristiques d'une classe s'éditent **ligne par ligne** (libellé,
  texte, solution ; **Ajouter une ligne**, **↑**, **↓**, **Retirer**, par classe), plus en zone de texte ;
  validées en continu, écran et serveur ; dans les **différences à la publication** au format « Classe M —
  Problème typique : écrouissage → … », « Classe M — Problème typique, solution : … → … », ligne ajoutée,
  retirée, ordre ; dans l'**export**.
- **Aperçu de l'éditeur** : même affichage — l'image de chaleur de la classe du matériau tiré et, à sa
  droite, le matériau puis ses caractéristiques.

**Conséquences.** `tables.js` (`CLASS_IMAGE_KEYS = ['image_chaleur']`, limites), `sheets-data.js`,
`question-screen.js`, `question.css`, `editeur.js` (`characteristicsEditor`, `previewTable`),
`editeur-data.js` (`moveItem`, `characteristicFrom`), `editeur.css`, `detourer-copeaux.mjs`,
`generer-copeaux.mjs`, migration `0009` ; SPEC §3, §7 ; UI §3.3, §3.4, §3.9 ; CLAUDE.md ; PLAN ; DEMARRAGE §7.

## D67 — L'image de chaleur : lueur de la classe, fondu des bords, largeur affichée bornée (2026-09-26, décidée)

**Contexte.** Sur le fond nuit, l'image de chaleur (D66) restait un rectangle aux bords francs, sans le halo
des autres images de l'écran ; affichée jusqu'à 170 px CSS, elle occupait 340 px réels sur un écran de densité 2 :
agrandie × 1,43 depuis ses 237 px.

**Décision.**

- **Lueur** : `.material-image img` reçoit le traitement de `.tool-photo`, `drop-shadow(0 0 var(--glow)
  var(--panel-color))` — la couleur de la classe ISO de la question, celle que le panneau pose depuis les
  tables (`applyTableColors` ; le rouge K de nuit pour K).
- **Fondu des bords** : `mask-image` (et `-webkit-mask-image`) de deux `linear-gradient` croisés
  (`mask-composite: intersect`, `-webkit-mask-composite: source-in`), transparents aux bords et pleinement
  opaques au centre, sur **10 %** de chaque côté (`--fondu-bords`). Mesuré sur les six images : la zone
  chaude est à 22,9 % au moins de chaque bord (aucun pixel touché jusqu'à 22 %) ; seule la queue du copeau,
  qui sort du cadre en haut, est atténuée — à 10 %, 3,8 à 7,9 % de ses pixels colorés, dont 1,3 à 3,8 % sous
  la moitié de leur opacité (à 12 % : 4,9 à 9,9 %). Vu à densité 3 : 10 et 12 % ne se distinguent presque pas.
- **Netteté** : le détourage génère au **double de la largeur d'affichage maximale, 340 px**, seulement si
  l'original le permet — **jamais agrandi**. Les originaux font 235 à 237 px : ils gardent leur taille, et la
  **largeur affichée est bornée à la largeur de l'original ÷ 1,5** (`heatImageMaxWidth`, posée sur la figure
  une fois l'image chargée), soit 156,7 à 158 px CSS au lieu de 170 — agrandissement × 1,33 sur un écran de
  densité 2 au lieu de × 1,43. Une image de classe téléversée est réduite à 340 px (PNG).
- **Liseré** : aucun n'est visible après la lueur et le fondu (gros plans à densité 3 des six classes) ;
  `EROSION_PX` reste à 1.
- **Base locale** : une migration pas encore déployée peut être régénérée ; la base locale qui l'a déjà
  appliquée se remet à neuf, ou se réécrit pour les lignes semées — marche à suivre dans `DEMARRAGE.md` §5.

**Conséquences.** `question.css`, `question-screen.js`, `sheets-data.js` (`heatImageMaxWidth`),
`detourer-copeaux.mjs` (`LARGEUR_MAX`, `fitWidth`), `editeur-data.js` (`uploadPlan`) ; UI §3.3 ; DEMARRAGE §5.
