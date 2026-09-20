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
