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

## D3 — Pile technique : HTML/CSS/JS sans compilation, JSON (2026-09-19, proposée ; confirmée par D80)

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

## D4 — Conventions de langue (2026-09-19, provisoire ; confirmée par D80)

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

## D6 — Sécurité du code de réussite et du QR (ouverte ; fermée par D19)

**Contexte.** Le payload du QR est un encodage réversible ; le code Moodle est
une formule connue de l'étudiant qui lit le JS. Un site statique ne peut pas
cacher un secret.

**Options.** (a) conserver tel quel — la vérification réelle est dans Moodle et
le risque est jugé acceptable ; (b) signer le payload (HMAC) avec un secret
détenu par l'enseignant et vérifier hors ligne ; (c) autre chose.

**À décider avec Thierry après la v1 fonctionnelle.**

## D7 — Emplacement du dépôt (ouverte ; fermée par D80)

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
est arrêté à la limite — cent ici, **mille depuis D86** : à cent, la 101ᵉ
identification d'une heure verrouillait tout le cégep.

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

## D68 — La légende de l'image de chaleur s'édite dans les tables (2026-09-26, décidée)

**Contexte.** La légende sous l'image de chaleur (D64, D66) était écrite dans le code, « Chaleur ». Thierry veut
la choisir classe par classe, ou n'en mettre aucune.

**Décision.**

- Les classes ISO des tables portent `legende_image` : un **texte de 0 à 40 caractères**. Absent — une version
  d'avant, `A2026_r0` et le brouillon semé —, il est **complété à la lecture à « Chaleur »** (`completeIsoClass`,
  même approche que les couleurs, D61) : la ligne en base ne change pas. Présent, même vide, il est gardé.
- **Page Question et aperçu de l'éditeur** : la légende sous l'image vient de ce champ (espaces de bord retirés).
  **Vide : pas de légende**, et pas d'espace laissé pour elle (aucun `figcaption`). L'aperçu montre désormais
  la légende sous la vignette, comme la page Question.
- **Onglet Tables** : une colonne **Légende** dans le tableau des classes, après l'image ; validée en continu,
  écran et serveur (« classes_iso[0] (P) : « legende_image » a 41 caractères (au plus 40) », un texte ou
  rien) ; dans les **différences à la publication** (« Classe P — légende de l'image : Chaleur → … », « → — »
  pour une légende vidée) ; dans l'**export**, avec les tables.

**Conséquences.** `tables.js` (`LEGENDE_IMAGE_MAX`, `DEFAULT_LEGENDE_IMAGE`, complétion, différences),
`data.js` (validation), `sheets-data.js` (`classImages` : le `label` vient du champ, `null` si vide ;
`CLASS_IMAGE_LABELS` disparaît), `question-screen.js`, `editeur.js`, `editeur.css` ; SPEC §3 ; UI §3.3, §3.4,
§3.9. Rapport : `docs/rapports/legende-chaleur.md`.

## D69 — Exercices d'avances : une même chaîne pour toutes les opérations, f jugée par cohérence avec fz, `limite_avance` obsolète (2026-09-26, décidée)

**Contexte.** Les exercices publiés (les deux M10) évaluent Vc et N. Thierry prépare des exercices d'avances
(fz, f, Vf) : le tournage d'abord, perçage au tour compris, le fraisage ensuite. Trois points restaient ouverts :
la chaîne de calcul vaut-elle pour toutes les opérations ; que faire de `limite_avance` (D51) ; comment juger f
quand fz est fausse ou arrondie. Aujourd'hui, un fz toléré suivi d'un f bien calculé à partir de lui est refusé :
foret Ø 1/2 po, 2 lèvres, fz « 0.0037 » (théorique 0.003, tolérée à ±25 %, au plus ±0.001 po) et f « 0.0074 »
(= 0.0037 × 2) — la f théorique est 0.006, tolérée à ±20 % : [0.0048 ; 0.0072].

**Décision.**

- **Une même chaîne pour toutes les opérations** — celle du moteur (SPEC §5) : fz selon la famille (fixe : la
  valeur de la table ; proportionnelle : avance × Ø × facteur d'avance, **le Ø de la barre** pour un outil à deux
  diamètres (D25), plafonnée à l'avance max de l'opération ; filetage : le pas, **converti en pouces** — mm / 25,4
  en métrique) ; f = fz × nombre de dents ; Vf = N × f. Les trois états par grandeur, réglés **par exercice**
  (D52), suffisent : **pas d'état par outil**.
- **`limite_avance` n'est pas un plafond.** Le seul plafond d'avance reste l'avance max de l'opération
  (`avance_max_po_rev`). La clé est **retirée du formulaire** de l'éditeur ; elle reste **acceptée dans les
  données** — absente, `null` ou un nombre > 0 —, **sans migration** : les outils qui la portent la gardent,
  intacte à l'enregistrement, et un outil créé dans l'éditeur ne l'a plus. SPEC §3 la dit **obsolète**. Ferme le
  point `limite_avance` de D51.
- **f jugée par cohérence avec fz**, comme Vf avec N × f (D15) :
  - **fz évaluée et lisible** : f est acceptée à **±0,1 % de fz_saisi × dents**. fz n'est connue qu'à la précision
    de son affichage (D13) : la référence est toute la plage (fz ± demi-unité) × dents, élargie de ±0,1 % ou de la
    demi-unité de f — ce que `feedRateInterval` fait pour Vf. Une f cohérente avec un fz faux est juste ; l'erreur
    est comptée sur fz, là où elle a été faite.
  - **fz fournie, masquée, vide ou illisible** : f est jugée sur la **valeur théorique**, avec la **tolérance de fz
    reportée** : ±25 % bornée à **±0,001 po par dent** (× nombre de dents) en avance proportionnelle ; ±0,1 % en
    avance fixe et en filetage. La demi-unité de f (D13) s'y ajoute toujours.
  - Comme pour Vf, seule compte la saisie d'une grandeur **à saisir** : une valeur envoyée pour une grandeur fournie
    ou masquée est ignorée, sa valeur théorique la remplace (SPEC §6 le disait déjà pour N et f dans Vf ; le moteur
    prenait la saisie reçue, un navigateur modifié pouvait s'en servir).
  - Ligne de correction (UI §3.4) : tolérance « ±0.1 % de fz × dents » dans le premier cas, « ±25 %, au plus
    ±0.001 po par dent » (proportionnelle) ou « ±0.1 % » dans le second ; la **valeur attendue** montrée pour f est
    fz saisi × dents quand la cohérence s'applique, comme N saisi × f saisi pour Vf.
- **Aucune quatrième matière d'outil** : l'avance ne dépend pas de la matière de l'outil (la table des avances
  n'a qu'une colonne).
- **Ordre** : le code couvre toutes les familles dès maintenant ; Thierry publie d'abord l'exercice de **tournage**
  (perçage au tour compris), puis celui de **fraisage** après avoir validé les avances de fraisage et de perçage
  (tableau du rapport `docs/rapports/avances.md`).

**Conséquences.** `computeParameters` rend aussi le nombre de dents (`teeth`) ; `correction.js` : `feedPerRevInterval`,
tolérance par dent (`perTooth`), `toleranceLabel(…, { coherence })`, saisie d'une grandeur non évaluée ignorée ;
`correctionView` (`seance.js`) ; `toolErrors` (`data.js`) et le formulaire d'outil (`editeur.js`) ; SPEC §3, §5,
§6 ; UI §3.4, §3.9 ; tests : correction, chaîne sur tout le catalogue (f = fz affiché × dents, arrondie ou non ;
fz non saisie), `correctionView`. Remplace la tolérance « ±20 % » de f en avance proportionnelle.

## D70 — Réponses au rapport « avances » : cohérence de f à partir de deux dents, fz fournie vérifiée, aides et ligne de calcul des filets, `test-complet` en local (2026-09-26, décidée)

**Contexte.** Le rapport `docs/rapports/avances.md` (D69) remontait sept points douteux et un tableau des avances
de fraisage et de perçage à valider. Réponses de Thierry, point par point.

**Décision.**

1. **La cohérence de f ne vaut qu'à partir de deux dents.** À une dent, f = fz : la même valeur, rien à
   vérifier de plus. Règle complète de f :
   - **1 dent** : f jugée sur la **valeur théorique**, avec la tolérance de fz de sa famille — proportionnelle
     ±25 %, au plus ±0,001 po ; fixe et filetage ±0,1 % —, que fz soit saisie ou non. MVLNR revient à
     [0.00495 ; 0.00505] ; SDTMR M42 x 4.5 avec fz « 4.5 » et f « 4.5 » (le pas non converti) : f fausse aussi ;
   - **2 dents et plus, fz évaluée et lisible** : cohérence avec **fz saisi × dents** (D69) ;
   - **2 dents et plus, fz fournie** : cohérence avec **fz affiché × dents** (±0,1 %, sur la plage de la
     demi-unité de fz affichée) — l'étudiant a fz sous les yeux ; cela vérifie le **nombre de dents**, qu'une
     tolérance reportée de ±25 % laissait passer à une dent près dès quatre dents (alésoir à 8 dents, f
     calculée avec 7 : refusée) ;
   - **2 dents et plus, fz masquée, vide ou illisible** : valeur théorique, tolérance de fz reportée (D69,
     inchangé).

   Barre à aléser (une dent, avance proportionnelle), fz « 0.0060 », f +1 % : le test demandé la voulait refusée ;
   il contredisait la règle, et **la règle est gardée** (Thierry, 2026-09-27) : à une dent, f = fz, même
   tolérance que fz — ±25 %, au plus ±0,001 po —, et f +1 % est acceptée.
2. **Demi-unité de f dans la cohérence : la plus large des deux (D13), pas la somme.** Avec référence = fz ×
   dents, l'intervalle est [min(plus petit produit × (1 − 0,1 %), référence − demi-unité de f) ; max(plus grand
   produit × (1 + 0,1 %), référence + demi-unité de f)], les produits étant pris sur la plage (fz ± demi-unité
   de fz) × dents. Le foret #40 (fz « 0.000588 », f « 0.00118 ») reste accepté ; le foret à pointer (fz
   « 0.0010 », 2 dents) passe de [0.00185 ; 0.00215] à un intervalle plus étroit.
3. **Aide de fz en avance fixe** : « Avance fixe : la valeur de la table, telle quelle, quel que soit le Ø. »
4. **Aides de fz et de N, dimension métrique** (foret métrique, MCLNR, tarauds et filets métriques) : rappeler
   que le Ø se met en pouces (mm / 25.4), **seulement quand la dimension tirée est métrique**. Une dimension est
   métrique si sa valeur est un filet « Ø x pas » en mm, ou si son libellé est en mm — la règle qui distinguait
   déjà les outils de même nom (UI §3.3). Lecture confirmée par Thierry (2026-09-27) : le rappel du Ø va à
   l'aide de N, et à celle de fz quand fz dépend du Ø (avance proportionnelle) — **pas** à l'aide de fz d'un filet
   ni d'une avance fixe ; pour un filet, fz est le pas, et l'aide dit « pas en pouces : mm / 25.4 » en métrique,
   « 1 / filets au pouce » en impérial.
5. **Ligne de calcul d'un filetage** : elle montre la conversion, à partir du **pas de la question** et non de
   la saisie — « fz = pas = 4.5 mm / 25.4 = 0.17717 » en métrique, « fz = pas = 1 / 20 = 0.05000 » en impérial.
   À une dent, la ligne de f reprend de même la valeur théorique de fz, sur laquelle f est jugée.
6. **`test-complet` en local** : un script, lancé par `npm run`, le publie sur la **base locale** (celle de
   `npm run dev`) depuis `site/exercices/test-complet.json` et la banque de cette base ; il refuse `--remote`.
   `DEMARRAGE.md` §7 le dit.
7. Docs : SPEC §6, UI §3.3 et §3.4, PLAN, rapport complété (« Réponses aux points douteux », avec les bornes
   obtenues).
8. **Réponses au tableau des avances** :
   - **Foret Udrill à 1 dent** : confirmé — une plaquette compte pour une dent.
   - **Les plus grosses avances** (alésoir 1.5" à 8 dents, f = 0.024 ; fraise à surfacer 1 1/2 po à 5 inserts,
     f = 0.030) : jugées réalistes.
   - **Micro-forets** : écartés par les **dimensions des exercices**, à partir de Ø 1/16 po (foret à numéro #52 et
     plus gros, foret métrique 1.6 mm et plus), **pas retirés de la banque**.
   - **Un cas plafonné en fraisage** : Thierry ajoute **en production, par l'éditeur**, deux fraises à surfacer de
     3 po, à 5 et à 7 dents, comme à l'atelier : fz = 0,004 × 3 = 0,012 → plafonnée à 0,010 ; f = 0,050 et 0,070.
   - **Aucune modification de `site/data/` ni de la semence.**

**Conséquences.** `correction.js` : `coherentFeedPerTooth` (sur quoi f est jugée), `feedPerRevInterval` (la plus
large des deux), `gradeAnswers(…, masked)`, `toleranceLabel(…, { teeth })` ; `seance.js` : `gradeQuestion` passe
les grandeurs masquées, `correctionView` et la ligne de calcul d'un filet ; `data.js` : `isMetricDimension`,
`pitchFormula` ; `rules.js` : `helpLine(…, metric)`, `questionIsMetric` ; un script `npm run` pour `test-complet` ;
SPEC §6 ; UI §3.3, §3.4 ; DEMARRAGE §7 ; tests. Précise D69 (f à une dent, fz fournie, demi-unité de f).

**Complément (2026-09-27) — d'où vient la valeur attendue.** Quand la valeur attendue d'un champ **jugé juste**
vient de la cohérence avec les saisies de l'étudiant — f d'après son fz × dents, Vf d'après ses N et f —, la note
sous le champ le dit au lieu d'« attendu » : « Juste (0.000284 = ton fz × 2) », « Juste (3048.000 = ton N × ta
f) » ; si un seul des deux facteurs de Vf est le sien, « N × ta f » ou « ton N × f ». Un champ faux garde « Faux —
attendu … ». Le serveur joint à chaque champ corrigé `coherence` (`null`, ou les grandeurs saisies dont la valeur
attendue est faite : `{ saisies: ['fz'], dents: 2 }`, `{ saisies: ['n', 'f'] }`) ; le texte est une règle
d'affichage pure (`coherenceSource`, `fieldResultNote`, `text.js`). SPEC §7 ; UI §3.4.

## D71 — Grandeurs en toutes lettres et « tr/min », virgule convertie à la sortie du champ, accueil unique par cours, page de description d'un exercice (2026-09-27, décidée ; point 8 remplacé par D74)

**Contexte.** Lot issu d'un remue-méninges de Thierry (rapport `docs/rapports/accueil-et-libelles.md`). Les
rétroactions nomment les grandeurs par leur symbole (« Ta N de 3200 est à +6.7 % de 3000 ») ; l'unité de vitesse
de rotation s'écrit « rév/min » et la grandeur « RPM » ; une virgule tapée reste une virgule à l'écran ; il y a une
page d'accueil par exercice (`?exercice=<id>`), sans retour possible (UI §3.1 : « aucun moyen d'en changer »), et
une liste sans regroupement quand l'adresse n'en nomme aucun (D18) ; rien ne montre à un professeur ce que demande
un exercice avant de le donner.

**Décision.**

1. **Grandeurs en toutes lettres dans les rétroactions.** Les noms sont ceux des libellés de saisie : vitesse de
   coupe, avance par dent, **vitesse de rotation**, avance totale par révolution, vitesse d'avance. L'explication
   d'un champ faux met l'unité après la saisie et après la valeur attendue : « Ta vitesse de rotation de 3200 tr/min
   est à +6.7 % de 3000 tr/min (tolérance : ±5 % et ±1 tr/min). », « Ton avance par dent de 0.004 po/dent est à … » ;
   une réponse vide : « Vitesse de rotation : réponse vide ou illisible (attendu 3000 tr/min). » La note d'un champ
   juste dont la valeur attendue vient de la cohérence (complément de D70) devient « Juste (0.000284 = ton avance par
   dent × 2) », « Juste (3048.000 = ta vitesse de rotation × ton avance totale par révolution) » (« la vitesse de
   rotation × ton avance… », « ta vitesse de rotation × l'avance… » quand un seul des deux facteurs est le sien).
   **Les formules gardent leurs symboles**, comme la feuille des formules : la ligne de calcul (« Vf = N × f = 2500 ×
   0.0050 »), la tolérance écrite en formule (« ±0.5 % de N × f », « ±0.1 % de fz × dents ») et les aides (« N = Vc ×
   4 / Ø »).
2. **« tr/min » partout, plus aucun « RPM » ni « rév/min » affiché** : libellés de saisie (« Vitesse de rotation (N,
   tr/min) »), rétroactions et tolérances (« ±5 % et ±1 tr/min »), panneau de l'outil (« Vitesse de rotation max de
   la machine : 3000 tr/min », « Ø usiné … — pour la vitesse de rotation »), aides, feuille des formules, attestation
   et `/verifier` (en-tête de colonne « N (tr/min) » — l'enregistrement signé ne porte aucune unité : les
   attestations déjà émises s'affichent aussi ainsi, signatures intactes), éditeur (« Vitesse de rotation (N) »,
   « Vitesse de rotation max de la machine »), documentation. Les **identifiants ne changent pas** (`rpm`,
   `limite_rpm`, l'exercice `m10-tournage-vc-rpm`). Le titre publié « M10 — Tournage : Vc et RPM » est une **donnée
   de production** : Thierry le renomme dans l'éditeur ; la semence du dépôt reste telle quelle. Le point reste le
   séparateur décimal affiché (D10).
3. **Virgule décimale** (précise D10) : une virgule tapée est acceptée et **remplacée par un point, visiblement, à la
   sortie du champ ou à la validation** (Vérifier, Entrée), **jamais pendant la frappe** (le curseur ne saute pas).
   Aucun champ décimal n'est `type="number"` (celui-ci efface « 0,15 » dans un navigateur réglé en anglais) : tous
   sont `type="text"` avec `inputmode="decimal"`, ce qui est déjà le cas. Portée : les cinq champs du quiz ; dans
   l'éditeur, tous les champs décimaux (formulaire d'outil, Vc et avances des tables) et, dans la zone des
   dimensions, la valeur après « ; » seulement (le libellé reste tel quel). L'espace professeur n'a aucun champ
   décimal. Le serveur continue de lire la virgule (D10) : la conversion n'est qu'un affichage.
4. **Accueil unique** (`/`, sans `?exercice=`), point de départ commun des étudiants et des professeurs : les
   exercices **publiés, non archivés et proposés à l'accueil** (D18, `liste`), **regroupés par cours** dans l'ordre
   des rangs (D51) — un exercice sans cours sous « Autres exercices », en dernier ; chacun mène à sa page de
   description. **Une seule porte professeur** : le lien « Espace professeur » (`/prof`), où la clé saisie décide de
   ce qu'on voit (D44 : administration, avec l'éditeur ; consultation, en lecture seule). Un `?exercice=` inconnu
   garde l'avis de D18 au-dessus de la liste.
5. **Le cours d'un exercice** : clé `cours` du contenu (brouillon et versions), texte facultatif de 1 à 30
   caractères, **publié avec la version** comme le titre et « proposé à l'accueil » (les deux M10 semés n'en ont pas :
   Thierry publie une version avec « M10 »). Dans l'éditeur, un champ **Cours** propose les cours déjà utilisés
   par les autres exercices (brouillons et dernières versions, une écriture par cours) ; un cours qui ne diffère
   d'un cours existant que par la casse, les accents, les espaces ou la ponctuation (« m10 », « M-10 » quand un
   autre a « M10 ») fait paraître sous le champ un conseil doré avec un bouton **Écrire « M10 »** — un conseil et
   non un remplacement d'office, pour qu'on puisse encore changer l'écriture d'un cours ; **l'accueil regroupe de
   toute façon par cette clé** (`courseKey`), sous l'écriture du premier exercice dans l'ordre des rangs : jamais
   trois groupes. Colonne **Cours** dans la liste des exercices de l'éditeur. Différence à la publication :
   « Cours : « — » → « M10 » ».
6. **Page de description d'un exercice** (`?exercice=<id>`, le lien diffusé sur Léa, qui continue de fonctionner) :
   elle remplace l'accueil d'un exercice et en garde tout (titre, version, résumé, Commencer / Reprendre, avis
   d'archivage), plus : un bouton **« ← Tous les exercices »** — une simple navigation vers l'accueil, qui ne crée, ne
   modifie ni n'efface aucune séance, ni sur le serveur ni dans le navigateur (remplace « aucun moyen d'en changer
   depuis la page », UI §3.1) —, un bouton **« Copier le lien »** (presse-papiers ; sinon le lien affiché, à
   sélectionner), sans connexion ; **les questions posées** (grandeurs à trouver, fournies, non demandées — les mêmes
   pour chaque outil, D52), **les outils questionnés** (photo, nom, plage de dimensions, opération, matières d'outil,
   réussites de suite exigées) et **les matériaux usinés possibles**, par classe ISO. Tout est composé dans le
   navigateur à partir de la dernière version publiée (`GET /api/exercice`) : rien de nouveau ne sort du serveur,
   rien de ce qui est à trouver. Double usage : l'étudiant vérifie qu'il est dans le bon exercice, le professeur
   choisit celui à donner.
7. **Le jeton gardé nomme son exercice** (`{ matricule, prenom, jeton, exercice }`, SPEC §7) : « Reprendre,
   <prénom> » n'est offert que sur la page de cet exercice ; ailleurs, « Commencer ou reprendre », et le jeton gardé
   n'est ni utilisé ni effacé (avant, l'essayer sur un autre exercice le faisait refuser, puis oublier). Un jeton
   gardé avant cette version, sans exercice, se comporte comme avant.
8. **Le nom d'un exercice identifie l'exercice pour les étudiants** : à la publication, le panneau de confirmation
   **signale** — en rouge, sans bloquer — un autre exercice publié et non archivé qui porte le même titre (sans tenir
   compte de la casse, des accents ni des espaces), en le nommant. *(Remplacé par D74 : un tel doublon bloque
   désormais la publication.)*

**Conséquences.** `text.js` (`FIELD_PARTS`, `FIELD_LABELS`, `FIELD_NAMES`, `coherenceSource`, `decimalPoint`),
`rules.js` (`gapExplanation`, `helpLine`, `diameterLines`), `correction.js` (`toleranceLabel`), `question-screen.js`,
`reference-screen.js`, `editeur-data.js` (`FIELD_CHOICES`, avertissements, cours, doublon de titre),
`editeur.js`, `dom.js` (virgule convertie à la sortie du champ), `exercice.js` (`cours`, `courseKey`),
`worker/index.js` (`GET /api/exercices` : `cours`, nombre d'outils et grandeurs évaluées ; liste de l'éditeur :
`cours`, titre publié), `session.js`, `home-screen.js` et un module pur de la page de description ; SPEC §5 à §8,
§10 ; UI §1 à §3 ; tests. Remplace, dans UI §3.1, « aucun moyen d'en changer depuis la page » ; précise D10 et D18 ;
remplace les textes du complément de D70.

## D72 — Nouvelle adresse : `quiz.tgm-tmi.workers.dev` — le Worker s'appelle `quiz`, renommé dans le tableau de bord (2026-09-27, décidée ; nom du Worker, adresse et procédure remplacés par D73)

**Contexte.** Le site est à `https://quiz-parametres-coupe.thierryleroux.workers.dev` : long, et fait du nom de
Thierry. Il le veut à `https://quiz.tgm-tmi.workers.dev` (sans « cvm »). L'adresse d'un Worker est
`<nom du Worker>.<sous-domaine du compte>.workers.dev` : il faut changer les deux. Changer seulement `name` dans
`wrangler.jsonc` puis déployer **crée un second Worker**, vide de secrets, et laisse l'ancien tourner sur la même
base ; et une valeur de secret ne se relit jamais chez Cloudflare.

**Décision.**

- Le Worker s'appelle **`quiz`** (`wrangler.jsonc`, `name`). Le **dépôt** et la **base D1** gardent leur nom
  (`quiz-parametres-coupe` : `database_name`, les commandes `d1` de `package.json`, `deploy.yml` et des scripts) ;
  `deploy.yml` ne nomme pas le Worker (`wrangler deploy` le lit dans `wrangler.jsonc`) : il ne change pas.
- **Le Worker se renomme d'abord dans le tableau de bord Cloudflare** (il garde son identifiant, ses versions, ses
  secrets et sa liaison D1), **puis** la branche est fusionnée (le déploiement vise alors le Worker déjà renommé),
  **puis** le sous-domaine du compte passe de `thierryleroux` à `tgm-tmi` (à défaut : `tgmtmi`, puis
  `tgm-tmi-usinage`). Procédure pas à pas, vérifications et solution de repli (nouveau Worker, les trois secrets
  reposés **avec les mêmes valeurs**) : `DEMARRAGE.md` §4 et le rapport `docs/rapports/accueil-et-libelles.md`.
- **`CLE_SECRETE` ne change pas de valeur** — sinon plus aucun NIP n'est reconnu et toute attestation répond
  « signature invalide ». Ne changent pas non plus ce que la cryptographie ou les données portent : le **sel HKDF**
  `quiz-parametres-coupe` (`worker/crypto.js`), la clé de `localStorage`, le format d'export. Un test le garde.
- **Aucune adresse n'est écrite dans le code** (vérifié, et un test le garde) : l'adresse du QR est l'origine de
  la requête (D33), l'attestation affiche `location.host`, le lien d'un exercice est composé sur l'origine de la
  page. Tout suit la nouvelle adresse sans autre changement ; seuls `DEMARRAGE.md` et les exemples des tests la
  nomment.
- **Ce qui cesse de fonctionner** : l'ancienne adresse (plus de réponse, aucune redirection possible depuis un
  sous-domaine rendu) — les liens sur Léa sont à remplacer, et le **QR des attestations déjà émises** ne s'ouvre
  plus. **Ce qui reste valide** : chaque attestation, par son **code** saisi sur la nouvelle page `/verifier`, ou
  par l'**adresse entière de son QR collée** dans le champ (la vérification ne regarde pas l'hôte) ; les données
  du QR restent lisibles hors ligne par n'importe quel lecteur de QR ; les séances, les NIP et la production
  entière (même base, même secret). Le navigateur change d'origine : le jeton gardé et le cookie professeur sont
  perdus — l'étudiant se réidentifie (matricule et NIP), le professeur se reconnecte.

**Conséquences.** `wrangler.jsonc` ; commentaires de `deploy.yml`, `worker/crypto.js`, `site/js/session.js` ;
`DEMARRAGE.md` §4 et §7 ; tests (nom du Worker et de la base, aucune adresse dans le code, sel inchangé, une
attestation émise sous l'ancienne adresse vérifiée sous la nouvelle). PLAN : l'action de Thierry dans le tableau de
bord.

## D73 — Le Worker garde son nom : seule l'adresse du compte change, `quiz-parametres-coupe.tgm-tmi.workers.dev` (2026-09-27, décidée)

**Contexte.** D72 prévoyait de renommer le Worker `quiz` dans le tableau de bord Cloudflare avant de fusionner. Thierry
n'y trouve pas le renommage. Il choisit de **ne pas renommer le Worker** et de ne changer que le sous-domaine du compte :
pas de plan B, aucun secret à reposer.

**Décision.**

- Le Worker **garde le nom `quiz-parametres-coupe`**, celui de production (`wrangler.jsonc`) : la fusion redéploie le
  Worker existant, avec ses trois secrets et sa liaison D1. **Ce nom ne se change pas** : un autre nom déployé créerait
  un second Worker, sans les secrets. `deploy.yml` reste tel qu'il était.
- **Adresse cible : `https://quiz-parametres-coupe.tgm-tmi.workers.dev`** — seul le sous-domaine du compte change
  (`thierryleroux` → `tgm-tmi` ; à défaut `tgmtmi`, puis `tgm-tmi-usinage`), dans le tableau de bord, après la fusion.
- **Procédure courte** (`DEMARRAGE.md` §4) : fusionner, vérifier, changer le sous-domaine, vérifier, remplacer les liens
  de Léa. L'étape de renommage et le plan B de D72 sont retirés.
- **Inchangé depuis D72** : aucune adresse n'est écrite dans le code ; le sel HKDF, la clé de `localStorage` et le format
  d'export ne changent pas ; ce qui cesse de fonctionner (l'ancienne adresse, le QR des attestations déjà émises, le
  jeton gardé et le cookie professeur) et ce qui reste valide (chaque attestation, par son code ou par l'adresse
  entière de son QR collée ; les séances, les NIP, toute la base). Les tests qui le gardent restent.

**Conséquences.** `wrangler.jsonc` (le nom de production, un commentaire) ; `deploy.yml` ramené à la version de `main` ;
commentaires de `worker/crypto.js` et `site/js/session.js` ; `DEMARRAGE.md` §4 et §7 ; SPEC §7 ; CLAUDE.md ; PLAN ;
tests (nom du Worker, adresses d'exemple) ; rapport `docs/rapports/accueil-et-libelles.md` (§6, « Suites données »).
Remplace D72 pour le nom du Worker, l'adresse et la procédure.

## D74 — « Gestion du contenu », bouton « Modifier », un titre en double bloque la publication (2026-09-27, décidée)

**Contexte.** Trois retouches de la page `/prof/editeur` (éléments E1 à E3 de la liste de Thierry ; rapport
`docs/rapports/gestion-du-contenu.md`). La page ne gère plus seulement les exercices : banque d'outils, tables de
référence, images et sauvegarde s'y ajoutent depuis les jalons 7a et 7b, et « Éditeur des exercices » la décrit mal.
Dans ses listes, le bouton qui ouvre un élément s'appelle « Ouvrir », alors qu'on l'ouvre pour le modifier. Enfin,
D71 (point 8) ne fait que **signaler** en rouge un autre exercice publié du même titre : rien n'empêche deux exercices
indiscernables à l'accueil.

**Décision.**

1. **La page s'appelle « Gestion du contenu »** : titre de l'onglet du navigateur, en-tête, lien de la barre du haut
   de l'espace professeur (rôle admin), phrase du panneau « Enseignants » de l'accueil, et les messages qui la
   nommaient (connexion refusée à la clé de consultation, fichier qui n'est pas un export). **Ne changent pas** :
   l'adresse `/prof/editeur`, les routes `/api/prof/editeur/*`, les noms de fichiers (`editeur.html`, `editeur.js`,
   `editeur.css`, `worker/editeur.js`…), les identifiants du code, les actions du journal (`editeur_publication`…)
   et le format d'export. Les documents vivants (SPEC, UI, PLAN, DEMARRAGE, CLAUDE.md) et les commentaires suivent ;
   les décisions passées et les rapports gardent « éditeur », le nom de l'époque.
2. **« Modifier » au lieu d'« Ouvrir »** pour le bouton qui ouvre un élément d'une liste afin de le modifier. Seules
   deux listes en ont un : **Exercices** et **Banque d'outils**. Les autres onglets n'ont pas d'équivalent : les
   tables de référence n'ont qu'un brouillon, déjà modifiable sur la page (leurs versions publiées, immuables,
   n'offrent que « Feuilles imprimables ») ; une image ne se modifie pas (elle se renomme, s'archive ou se
   supprime) ; la Sauvegarde n'a pas de liste. Le titre en lien de chaque ligne ouvre toujours la même page.
3. **Un titre en double bloque la publication** (remplace D71, point 8, « sans bloquer ») : la publication d'un
   exercice est **refusée tant qu'un AUTRE exercice publié et non archivé** a pour titre (celui de sa dernière
   version publiée) le titre du brouillon à publier — même comparaison qu'avant : sans tenir compte de la casse, des
   accents ni des espaces (`titleKey`, `sameTitleExercises`, maintenant dans `site/js/exercice.js`, en un seul
   exemplaire pour l'écran et le serveur).
   - **Des deux côtés** : le serveur refuse (`POST /api/prof/editeur/exercice/publier` → 400, `doublons` joints),
     même si l'on contourne l'écran ; à l'écran, le panneau de confirmation affiche le refus en rouge et le bouton
     « Publier la version n » est inactif.
   - **Le message nomme l'exercice en conflit** (titre et identifiant) **et dit quoi faire** : « Publication refusée :
     un autre exercice publié porte déjà ce titre : « … » (id). Les étudiants reconnaissent un exercice à son titre :
     change le titre de l'un des deux, puis publie. »
   - **Les brouillons restent libres** : enregistrer, renommer, dupliquer, créer ne sont jamais refusés pour un titre.
   - **Republier le même exercice** ne se bloque jamais lui-même ; un exercice **archivé** ne compte pas, un exercice
     jamais publié non plus.
   - **Les doublons déjà en production restent en place** : rien ne les défait ; le blocage joue à la prochaine
     publication de l'un ou de l'autre (il faudra alors changer un titre, ou archiver l'autre exercice).
   - **Hors du blocage**, faute de consigne (points à trancher du rapport) : rétablir un exercice archivé dont le
     titre est pris, l'import d'une sauvegarde (une restauration), et `npm run publier:test-complet` (base locale
     seulement, D70).

**Conséquences.** `site/prof/editeur.html`, `site/js/ui/editeur.js`, `prof.js`, `home-screen.js`,
`worker/editeur.js` (message d'import) ; `site/js/exercice.js` (`titleKey`, `sameTitleExercises`,
`sameTitleRefusal`), `site/js/ui/editeur-data.js`, `worker/index.js` (publication) ; `site/css/editeur.css` ; tests
(textes visibles, doublon à l'écran et au serveur) ; SPEC §7, §8, §10 ; UI §2, §3.8, §3.9 ; PLAN ; DEMARRAGE ;
CLAUDE.md ; commentaires. Remplace D71, point 8.

## D75 — Modifier le contenu sans créer de nouvelle version : la présentation en direct, la publication en cascade des tables, le retour en arrière (chantier E5) (2026-09-27, décidée ; les quatre exigences de Thierry inscrites à la clôture du chantier, le 2026-09-28)

**Contexte.** L'inventaire du versionnage (`docs/rapports/inventaire-versionnage.md`) a montré qu'une retouche
d'un libellé des tables coûte aujourd'hui 1 + 2 × n gestes (publier les tables, puis, pour chaque exercice, y
passer et le publier), et n'atteint pas les séances déjà commencées. Il proposait deux voies — A : séparer la
présentation de ce qui sert à la correction ; B : un versionnage invisible, la question épinglée plutôt que la
séance — et une voie hybride. Thierry retient la voie hybride, avec des ajouts. Cette décision encadre les quatre
jalons du chantier E5.

**Les quatre exigences de Thierry**, posées au début du chantier (inscrites ici mot pour mot à sa clôture, le
2026-09-28 ; le bilan du chantier, dans le rapport d'E5-4, les reprend dans cet ordre) :

- a) Une question affichée à un étudiant ne doit jamais être corrigée contre une valeur modifiée après son tirage.
- b) Les attestations déjà émises doivent rester valides et afficher ce qu'elles affichaient.
- c) Je veux pouvoir revenir en arrière après une erreur de saisie.
- d) Je veux que corriger ou essayer un libellé prenne quelques secondes, pas une procédure.

**Décision.**

1. **Voie hybride** : la **présentation en direct** (H1) et la **publication en cascade des tables** (H2). Les
   séances restent **épinglées à leur version** d'exercice, donc à ses tables (D47). La voie B est écartée ;
   l'épinglage par question (H3) ne sera repris que si la limite du point 6 pose un vrai problème.
2. **En direct : une liste blanche, imposée par le serveur** (un champ hors de la liste est refusé, 400) :
   - **tables** : le **nom** et les **trois couleurs** des classes ISO, leur **image de chaleur**, sa **légende** et
     leurs **caractéristiques** ; la **couleur** des matières d'outil ; le **pictogramme** des opérations ;
   - **exercice** (jalon E5-3) : le **titre**, le **cours**, « **À l'accueil** » ; pour chaque copie d'outil, sa
     **photo** et sa **note** (`commentaire`).
3. **Tout le reste demeure versionné**, dont : les noms d'outils et les gabarits de nomenclature (figés dans chaque
   question au tirage ; ils pourraient passer en direct plus tard), les noms et les descriptifs des matériaux
   usinés, la clé et le nom des matières d'outil, la machine, la direction d'avance, le trait de famille, les
   libellés des dimensions. Pour une image, c'est **le choix de l'identifiant** qui passe en direct : l'image
   elle-même ne change jamais sous son identifiant (D56).
4. **Effet dès que la page se recharge, pour tous, séances en cours comprises.** La présentation **part de celle de
   la dernière version de tables publiée** et **s'applique à toutes les versions** ; une clé qu'elle ne connaît pas
   (une classe, une matière d'outil ou une opération) garde la valeur de sa version. **La révision au pied des
   feuilles identifie désormais les valeurs, plus l'apparence.**
5. **Aperçu dans le panneau même** (le rendu de l'aperçu de l'onglet Tables : dix questions, l'image de chaleur de la
   classe, sa légende et ses caractéristiques), puis **« Appliquer »**. **Pas de brouillon de présentation.** Chaque
   contenu remplacé est **gardé, sans limite**, avec **« Rétablir »** en un clic ; **chaque geste est inscrit au
   journal**. La **Sauvegarde** (export, import) porte la présentation et son historique.
6. **La cascade** (jalon E5-2) : publier des tables propose **tous les exercices sur la version remplacée, archivés
   compris**, chacun décochable, avec ce que ça change pour chacun (`exerciseTablesImpact`). Elle **republie le
   dernier contenu publié, jamais le brouillon**, et fait aussi passer **le brouillon** aux nouvelles tables s'il
   était sur la version remplacée (sinon sa prochaine publication ramènerait les anciennes, D62). Un exercice en
   erreur est nommé et laissé tel quel. **Retour en arrière** : « **Reprendre cette version** » sur toute version
   publiée (tables ou exercice) la recharge dans le brouillon, puis publication normale avec le résumé des
   différences ; « **Annuler les modifications** » ramène un brouillon à sa dernière version publiée.
   **Limite acceptée** : une séance commencée pendant qu'une valeur erronée était publiée garde cette version
   jusqu'à sa fin ; la protection est le résumé des différences avant la cascade.
7. **Le code reste hors du versionnage** : tolérances, formules, textes et en-têtes de l'attestation. **Règle : en
   tête de chaque rapport, signaler tout changement qui touche la correction des séances en cours** ; Thierry
   déploie hors des périodes de labo.
8. **L'attestation reste entièrement figée à la réussite** ; la présentation en direct ne l'atteint jamais, ni
   `/verifier`. Quand le titre passera en direct (E5-3), l'attestation inscrira **le titre affiché à la réussite**, et
   la règle du titre en double (D74) suivra le titre. La page de description continue de montrer la dernière
   version.
9. **Quatre jalons, dans l'ordre, une branche chacun** : **E5-1** la présentation des tables en direct ; **E5-2** la
   cascade des tables et le retour en arrière des versions ; **E5-3** la présentation des exercices en direct ;
   **E5-4** l'historique de la banque d'outils (même mécanisme).

**Ce que D75 remplace.**

- **D47** : « versions publiées immuables » reste vrai du **contenu** d'une version, mais ce qu'une version
  **montre** n'est plus figé : la présentation des tables (E5-1), puis celle des exercices (E5-3), se pose
  par-dessus. « Une publication ne touche jamais une séance en cours » reste vrai des **valeurs** ; la présentation,
  elle, l'atteint.
- **D61** : les couleurs des classes ISO et des matières d'outil, le nom des classes et le pictogramme des
  opérations **ne se modifient plus dans le brouillon des tables** et ne passent plus par la publication ni par les
  différences valeur par valeur (`tablesDiff`). « Le quiz, les feuilles et l'éditeur lisent les couleurs de la
  version en usage » devient : ils lisent **la présentation en vigueur**, et la valeur de la version pour une clé
  qu'elle ne connaît pas.
- **D62** : `exerciseTablesImpact` ne dit plus les pictogrammes. « Une séance utilise toujours les tables de sa
  version d'exercice : … feuilles de référence et couleurs à l'écran » reste vrai des **valeurs** (questions,
  correction, valeurs des feuilles, révision sur l'attestation), plus de l'apparence. En E5-2, la cascade
  remplacera « chaque exercice y passe depuis sa page ».
- **D63** : `/tables?version=` montre les valeurs de cette version **avec la présentation en vigueur**, plus « les
  couleurs de cette version ».
- **D64 à D66 et D68** : l'image de chaleur, les caractéristiques et la légende gardent leur format et leurs règles,
  mais s'éditent dans le panneau de la présentation, plus dans le brouillon, et ne sont plus dans les différences à
  la publication des tables.
- **D74** : rien en E5-1. En E5-3, le titre en double sera refusé au moment d'**appliquer** le titre, plus seulement
  à la publication.

**Conséquences.** Les jalons E5-1 à E5-4 dans `PLAN.md` ; les choix propres à chaque jalon sont des décisions à
part (D76 pour E5-1).

## D76 — E5-1 : la présentation des tables en direct — stockage, point de départ, publication des tables, nouvelles clés, rétablissement (2026-09-27, décidée ; points 6 et 7 précisés par sa retouche, en fin d'entrée)

**Contexte.** Le premier jalon de D75 laissait à trancher le stockage, le point de départ au déploiement, ce que
devient la présentation dans le brouillon et dans une version publiée des tables, la présentation d'une clé
nouvelle, et « Rétablir » quand une image a été archivée entre-temps.

**Décision.**

1. **Stockage** (migration `0010`) : `presentation_tables`, une seule ligne — `contenu` (le format des tables réduit
   à la liste blanche : `classes_iso` [{ `code`, `nom`, `couleur`, `couleur_texte`, `couleur_ligne`,
   `image_chaleur`, `legende_image`, `caracteristiques` }], `materiaux_outil` [{ `cle`, `couleur` }], `operations`
   [{ `operation`, `pictogramme` }], chaque entrée complète), `revision` (le contrôle optimiste, D48),
   `modifiee_le`, `enseignant` — et `presentation_tables_historique`, un contenu **remplacé** par ligne : le
   contenu, quand et par qui il avait été posé, quand et par qui il a été remplacé, et par quoi (`application`,
   `retablissement`, `import`). Rien ne s'efface.
2. **Point de départ** : `contenu` est **vide (NULL) tant que rien n'a été appliqué**, et la présentation est alors
   **celle de la dernière version publiée des tables**, lue à chaque fois. Rien ne change donc au déploiement pour
   une séance sur la dernière version. Au premier « Appliquer », cette présentation de départ entre dans
   l'historique (« présentation de départ ») : « Rétablir » la retrouve.
3. **La présentation en vigueur est celle du panneau** : pour chaque classe, matière d'outil et opération de la
   dernière version publiée, l'entrée appliquée si elle existe, sinon celle de la version ; puis les entrées
   appliquées d'une clé que la dernière version n'a plus (elle sert encore aux versions plus anciennes). Elle se
   pose par-dessus **toute** version pour les clés qu'elle connaît (`applyPresentation`, `presentData`,
   `site/js/presentation.js`) ; une clé inconnue garde la valeur de sa version.
4. **Où elle se pose** : après le cache des versions assemblées, dans ce que le serveur **montre** — `GET
   /api/exercice` (page Question, feuilles de référence du quiz, page de description), `GET /api/tables?version=`
   (feuilles imprimables), et, dans la Gestion du contenu, les tables d'un exercice et de la banque (pastilles,
   aperçus). **Jamais** dans ce qui corrige ou atteste : le tirage, la correction, `isQuestionValid`, la question
   figée, l'attestation et `/verifier` gardent le catalogue de la version, sans présentation (aucune n'en lit
   d'ailleurs une couleur ou une image).
5. **Routes** (rôle admin, journalisées) : `GET /api/prof/editeur/presentation` (la présentation en vigueur, sa
   révision, ses erreurs, l'historique avec, pour chaque contenu, ce que le rétablir changerait) ;
   `POST …/presentation/appliquer` `{ revision, presentation }` ; `POST …/presentation/retablir` `{ revision,
   historique }`. Un champ hors de la liste blanche → 400 nommé ; une révision périmée → 409, rien n'est écrasé ;
   rien à changer → 400. Actions du journal : `editeur_presentation_application`,
   `editeur_presentation_retablissement` (les changements en clair dans les détails).
6. **Validation** : celle d'aujourd'hui (nom non vide, couleurs « #rrggbb », légende de 40 caractères au plus, 6
   caractéristiques au plus avec leurs longueurs, image existante et non archivée), et, nouveau, **le pictogramme
   d'une opération doit aussi être une image existante et non archivée** (il n'était vérifié que dans sa forme).
   *Précisé par la retouche : seulement pour une image choisie.*
7. **« Rétablir » une présentation dont une image a été archivée depuis** : **permis**, avec un avertissement (une
   image archivée est toujours servie : les étudiants retrouvent exactement ce qu'ils voyaient). Le panneau la
   signale ensuite comme erreur : il faut en choisir une autre, ou la rétablir dans l'onglet Images, avant
   d'appliquer autre chose. Une image nommée par la présentation, **actuelle ou dans l'historique**, compte comme
   utilisée : elle ne se supprime pas, elle s'archive. *Précisé par la retouche : en vigueur, elle n'est plus qu'un
   avertissement et ne bloque rien.*
8. **Le brouillon et la publication des tables** : les champs de la liste blanche **quittent le brouillon** pour
   toute clé que la présentation en vigueur connaît (ils y restent, cachés, sans effet). **Une version publiée prend
   la présentation en vigueur** (un instantané, pour les clés qu'elle connaît) : elle reste lisible seule, et
   garde trace de l'apparence du jour. Les différences à la publication (`tablesDiff`), le « aucune différence à
   publier » et le « brouillon modifié » ne comparent plus que les valeurs ; `exerciseTablesImpact` ne dit plus
   les pictogrammes.
9. **Une clé nouvelle** (une classe ou une opération ajoutée au brouillon ; les matières d'outil sont trois clés
   fixes) **reçoit sa présentation de départ dans sa ligne du brouillon** : pour une clé que la présentation ne
   connaît pas, les champs de présentation s'y montrent et s'y saisissent comme avant. La version publiée les porte ;
   la clé entre alors dans la présentation en vigueur (dernière version) et ne se modifie plus que dans le panneau.
10. **Retouches de présentation en attente dans le brouillon** (faites avant ce jalon, jamais publiées) : le
    panneau les signale en doré, avec « Les reprendre dans le panneau » ; elles ne partent qu'à l'application, et
    la prochaine publication des tables les abandonne.
11. **Sauvegarde** : l'export porte `presentation_tables` (`contenu`, `modifiee_le`, `enseignant`, `historique`).
    L'import ajoute les contenus d'historique absents, et, si la présentation de l'export diffère de celle de la
    base, la remplace — celle de la base va à l'historique (« import »). Un export sans présentation (d'avant ce
    jalon) ou dont la présentation n'a jamais été appliquée ne la change pas. Un aller-retour ne change rien.
12. **Le pictogramme de l'opération sur la page Question** lit les tables, comme la feuille des avances et la page
    de description (il prenait l'image nommée d'après l'opération, celle de la semence : inventaire, §8).
13. **Onglet Tables** : un panneau distinct, **« Présentation — effet immédiat »** (contour vert, bouton
    « Appliquer… » vert), en tête, avec ses tableaux (classes, matières d'outil, opérations), l'aperçu, la
    confirmation qui liste les changements et l'historique ; puis **« Valeurs — brouillon à publier »**, le brouillon
    d'avant sans ces champs. Les couleurs de la page suivent le panneau de la présentation.

**Conséquences.** `migrations/0010_presentation_tables.sql` ; `site/js/presentation.js` (pur, testé) ;
`site/js/tables.js` (`tablesDiff`, `tablesContent`) ; `site/js/ui/editeur-data.js` (`exerciseTablesImpact`,
utilisations d'une image) ; `worker/base.js`, `worker/catalogue.js`, `worker/index.js`, `worker/images.js`,
`worker/editeur.js` (import) ; `site/js/api.js`, `site/js/ui/editeur.js`, `site/css/editeur.css` ;
`site/js/ui/question-screen.js` (pictogramme) ; SPEC §3, §7, §10 ; UI §3.9 ; CLAUDE.md ; PLAN. Rapport :
`docs/rapports/e5-1-presentation-tables.md`.

**Réponses de Thierry au rapport, et retouche (2026-09-27).** Les sept points à trancher du rapport sont acceptés tels
que proposés : la présentation de départ d'une clé nouvelle dans sa ligne du brouillon, avec le liseré doré (point 9) ;
« Rétablir » permis avec une image archivée depuis, avec l'avertissement (point 7) ; le pictogramme vérifié comme
l'image de chaleur (point 6) ; « Rétablir » sans confirmation, sauf s'il y a des modifications non appliquées ; l'aperçu
tiré de la dernière version publiée de l'exercice ; l'import qui remplace la présentation avec effet immédiat, **tel
quel** — la présentation remplacée va à l'historique et se rétablit en un clic, pas de mot à part ; l'instantané de la
présentation dans une version publiée (point 8). Et une retouche, qui précise les points 6 et 7 :

- **« Image existante et non archivée » ne vaut que pour une image qu'on CHOISIT**, c'est-à-dire différente de celle
  que la présentation en vigueur a déjà pour ce champ (la même classe ou la même opération, le même champ).
- **Une image archivée déjà en vigueur** (après un « Rétablir », ou un pictogramme déjà archivé en production) **reste
  un avertissement** : elle ne bloque **ni « Appliquer »** d'un autre changement, **ni le brouillon ni la publication
  des tables**, instantané compris. Sinon, corriger une légende ou une Vc serait bloqué par une image qui n'a rien à
  voir, contre l'exigence de quelques secondes.
- En pratique : `presentationErrors(…, { inForce })` et `validateTables(…, { presentation })` n'appliquent le contrôle
  d'existence et d'archivage qu'aux images choisies ; `archivedWarnings` dit les images archivées en vigueur. Le
  panneau les montre en doré, sous les erreurs ; `GET …/presentation`, `…/appliquer` et `…/retablir` les rendent
  (`avertissements`). Une classe **nouvelle** du brouillon qui nomme une image archivée la choisit : c'est une erreur.
  La galerie ne propose pas les images archivées (seule celle déjà en place y reste, marquée).

## D77 — E5-2 : la cascade des tables et le retour en arrière des versions (2026-09-27, décidée ; points 2 et 3 précisés par sa retouche, en fin d'entrée)

**Contexte.** D75, point 6 : une correction de valeurs (une Vc, une avance) coûtait une publication des tables, puis, pour
chaque exercice, un passage aux nouvelles tables et une publication. Et rien ne permettait de revenir à une version
publiée, sinon à la main.

**Décision.**

1. **La version remplacée** est celle dont le brouillon des tables est parti (`base_id`) : la dernière publiée, en usage
   normal comme après « Reprendre cette version » (point 6), qui fait repartir le brouillon de la dernière.
2. **La cascade est proposée dans la confirmation même de la publication des tables**, sous le résumé des différences
   valeur par valeur, qui reste en tête (la protection contre une faute de frappe) : **une seule confirmation** pour le
   tout. Elle liste **tous les exercices sur la version remplacée** — ceux dont la dernière version publiée est sur
   elle, et ceux dont le brouillon y est —, **archivés et jamais publiés compris**, **cochés par défaut**, chacun
   décochable, avec ce que la cascade fera pour lui et **ce que ça change pour lui** (`exerciseTablesImpact` de son
   contenu publié, ou de son brouillon s'il n'a jamais été publié ; les erreurs qui apparaîtraient dans son brouillon).
   *Précisé par la retouche : la liste montre aussi, décochés, les exercices sur une version plus ancienne.*
3. **Pour chaque exercice coché** :
   - **sa version suivante est son dernier contenu publié avec les nouvelles tables, jamais son brouillon** ; la règle du
     titre en double (D74) ne s'y applique pas : la cascade ne change aucun titre ;
   - **son brouillon passe aussi aux nouvelles tables s'il était sur la version remplacée**, ses modifications non
     publiées gardées ;
   - **jamais publié** : seul son brouillon passe.

   **Un exercice en erreur** avec les nouvelles tables (son contenu publié ne se republierait pas) est **nommé, ne se
   coche pas, et reste tel quel**, brouillon compris. **Un exercice décoché n'est pas touché**, brouillon compris.
   *Précisé par la retouche : son contenu publié et son brouillon passent chacun de son côté, d'où qu'ils partent.*
4. **Tout passe ensemble, ou rien** : la version des tables, les versions d'exercice de la cascade, les brouillons qui
   passent et les lignes du journal vont dans **un seul lot**. Le serveur recalcule la liste (il ne croit pas celle du
   navigateur) : un identifiant coché qu'il ne connaît plus est ignoré, et le résultat le dit.
5. **Journal** : chaque version de la cascade est une publication ordinaire (`editeur_publication`, « … · cascade de la
   publication des tables A2026_r2 ») ; chaque brouillon qui passe, un passage de tables (`editeur_tables_exercice`,
   même mention) ; la publication des tables résume la cascade (proposés, publiés, brouillons, laissés).
6. **« Reprendre cette version » sur une version publiée des tables** : ses **valeurs** entrent dans le brouillon, qui
   **repart de la dernière version publiée** — le résumé des différences montre ce qui change par rapport à elle, et le
   brouillon se publie comme version suivante, **avec la cascade**. **Sa présentation n'est pas reprise** : pour les
   clés que la présentation en vigueur connaît, le brouillon prend la sienne (l'encadré des retouches en attente ne
   s'allume pas à tort) ; la présentation se rétablit par son propre historique (D76).
7. **« Reprendre cette version » sur une version publiée d'un exercice** : son contenu entre dans le brouillon, qui
   **garde sa version de tables actuelle** (reprendre un contenu ne ramène pas d'anciennes tables en silence) ; puis
   publication normale, avec le résumé.
8. **« Annuler les modifications »** ramène un brouillon à sa dernière version publiée : pour un exercice, son contenu
   **et** sa version de tables ; pour les tables, la dernière version publiée (présentation comme au point 6). **Inactif
   quand le brouillon est à jour** ; si le brouillon enregistré l'est déjà (l'écran n'avait que des modifications non enregistrées), le serveur n'écrit ni ne journalise rien et l'écran se recharge. Un exercice jamais publié n'a rien à annuler (400).
9. **Pour les points 6 à 8** : si le brouillon a des modifications non publiées — enregistrées ou seulement à l'écran —,
   **une confirmation les liste et dit qu'elles seront perdues** (pour « Reprendre » un exercice, son contenu seulement,
   puisque sa version de tables est gardée ; pour les tables, les différences de valeurs et les retouches de
   présentation en attente) ; sans modification, le geste se fait tout de suite. Contrôle optimiste (D48, 409) ;
   chaque geste est au journal (`editeur_reprise`, `editeur_annulation`, `editeur_tables_reprise`,
   `editeur_tables_annulation`).
10. **Les images nommées par le brouillon des tables comptent comme utilisées** (`brouillon_tables` dans les
    utilisations d'une image) : celle d'une classe ou d'une opération nouvelle ne se supprime plus avant d'être publiée.
11. **Ni la correction ni les attestations ne changent.** Les séances restent épinglées à leur version (D47) : une
    cascade ne crée que des versions, pour les nouvelles séances.

**Ce que D77 remplace.** Dans **D62**, « aucun exercice ne change de tables tout seul : chaque exercice y passe depuis
sa page » : la publication des tables les fait passer, en cascade, ceux qu'on laisse cochés — le passage depuis la page
d'un exercice (« Passer à … ») reste possible. Dans **D74**, la règle du titre en double vaut pour la publication depuis
la page d'un exercice, pas pour la cascade (qui ne change aucun titre).

**Conséquences.** `cascadeCandidates`, `cascadePlan` (`worker/editeur.js`, purs) ; `base.publishTables` (la cascade dans
le même lot), `replaceTablesDraft`, `replaceDraft`, `listExercises` (`tables_publiees`) ; routes `GET
…/tables/cascade`, `POST …/tables/reprendre`, `…/tables/annuler`, `…/exercice/reprendre`, `…/exercice/annuler`, et la
cascade de `POST …/tables/publier` (`worker/index.js`) ; `worker/images.js` ; l'onglet Tables et la page d'un exercice
(`site/js/ui/editeur.js`, `editeur-data.js`) ; SPEC §7, §10 ; UI §3.9 ; PLAN. Rapport :
`docs/rapports/e5-2-cascade-retour.md`.

**Réponses de Thierry au rapport, et retouche (2026-09-28).** Les points 3 à 6 du rapport sont acceptés : un exercice en
erreur est laissé entièrement tel quel, brouillon compris ; un brouillon qui passe peut gagner des erreurs (elles sont
dites en rouge dans la confirmation) ; « Annuler » les tables ramène à la dernière version publiée ; « Reprendre cette
version » est offert sur toutes les versions, la dernière comprise. Les points 1 et 2 deviennent une retouche, qui précise
les points 2 et 3 de cette décision :

- **Une seule liste de tout ce qui n'est pas à jour.** La cascade propose aussi les exercices sur une version des tables
  **plus ancienne** que la version remplacée, mais **décochés par défaut** (ils ont pu être laissés de côté exprès, ou
  être en erreur), avec **ce que ça change pour chacun depuis sa propre version**. Ceux qui sont sur la version remplacée
  restent cochés par défaut. Un exercice laissé de côté une fois ne disparaît pas de la vue. « Sur » une version se lit à
  sa dernière version publiée ; pour un exercice jamais publié, à son brouillon. La confirmation les montre en deux
  groupes : « Sur A2026_r1, la version remplacée — cochés par défaut » et « Sur une version plus ancienne — décochés par
  défaut », chaque exercice de celui-ci étiqueté « sur A2026_r0 ».
- **Pour un exercice coché, chacun de son côté** : son **contenu publié** passe aux nouvelles tables s'il n'y est pas déjà
  (une version suivante, faite de son dernier contenu publié), et son **brouillon** aussi, d'où qu'il parte — ce qui règle
  le cas « publié sur une version, brouillon sur une autre ».
- **Un exercice en erreur** est nommé **avec ses erreurs** dans le message qui suit la publication ; il reste proposé aux
  cascades suivantes (décoché, puisqu'il est désormais sur une version plus ancienne).

## D78 — E5-3 : la présentation des exercices en direct — stockage, où elle se pose, titre de l'attestation, titre en double, brouillon et publication (2026-09-28, décidée ; réponses de Thierry au rapport en fin d'entrée, complétées par D79)

**Contexte.** Le troisième jalon de D75 (points 2 et 8) : le titre, le cours et « À l'accueil » d'un exercice, la photo
et la note (`commentaire`) de chacune de ses copies d'outils passent en direct, avec la mécanique d'E5-1 (D76), mais
**par exercice**. Restaient à trancher le stockage, où la présentation se pose, le titre que l'attestation inscrit, la
règle du titre en double (D74), l'exercice jamais publié, la copie nouvelle, et ce que deviennent ces champs dans le
brouillon et à la publication.

**Décision.**

1. **Stockage** (migration `0011`) : `presentation_exercices`, **une ligne par exercice**, créée au premier
   « Appliquer » — `contenu`, `revision` (le contrôle optimiste, D48), `modifiee_le`, `enseignant` — et
   `presentation_exercices_historique`, un contenu **remplacé** par ligne, comme pour les tables (quand et par qui il
   avait été posé, quand, par qui et par quoi il a été remplacé : `application`, `retablissement`, `import`). Le format
   est celui de l'exercice réduit à la liste blanche : `{ titre, cours, liste, outils: [{ id, image, commentaire }] }`,
   chaque entrée complète — `cours` null : sans cours ; `liste` : « À l'accueil » ; `image` null : la photo nommée
   d'après l'identifiant de la copie ; `commentaire` null : pas de note. **La clé d'une copie est son identifiant dans
   l'exercice.** Rien ne s'efface, sauf avec l'exercice (un exercice supprimé, sans séance, emporte sa présentation).
2. **Point de départ** : **pas de ligne tant que rien n'a été appliqué**, et la présentation est alors **celle de la
   dernière version publiée de l'exercice**, lue à chaque fois : rien ne change au déploiement pour une séance sur la
   dernière version ; une séance épinglée à une version plus ancienne montre dès lors le titre, les photos et les notes
   de la dernière (ses valeurs, ses outils et ses questions restent ceux de sa version). Au premier « Appliquer », elle
   entre dans l'historique (« présentation de départ »).
3. **La présentation en vigueur** d'un exercice : son titre, son cours et « À l'accueil » appliqués (sinon ceux de sa
   dernière version) ; pour chaque copie de la dernière version, l'entrée appliquée si elle existe, sinon celle de la
   version ; puis les entrées appliquées d'une copie que la dernière version n'a plus (elle sert encore aux séances
   épinglées à une version plus ancienne). Elle se pose par-dessus **toute** version de l'exercice ; **une copie
   qu'elle ne connaît pas garde la valeur de sa version**. Règles pures dans `site/js/presentation-exercice.js`.
4. **Où elle se pose** : après le cache des versions assemblées, dans ce que le serveur **montre** seulement —
   `GET /api/exercice` (page de description, identification, page Question, feuilles), `GET /api/exercices`
   (l'accueil : titre, cours, liste), la séance que rendent `creation`, `reprise`, `identite`, `seance`, `question` et
   `correction` (le titre de la barre, la photo et la note du panneau de l'outil), l'espace professeur (titres des
   réussites, filtre, export CSV) et la Gestion du contenu. **Jamais** dans le tirage, la correction,
   `isQuestionValid` ni la question figée : ce qui juge une réponse ne lit ni titre, ni photo, ni note.
5. **L'attestation.** Une attestation déjà émise **ne change pas d'un octet**. Une attestation émise après ce jalon
   inscrit, **dans le même champ** (`exercice.titre`), **le titre en vigueur au moment où elle est émise** — à la
   réussite, ou à la première ouverture pour une séance réussie avant l'émission des attestations. C'est le seul
   changement de l'enregistrement ; sa signature et sa vérification ne changent pas. La réémission qui suit une
   correction d'identité (D37) recopie l'enregistrement d'origine : elle garde son titre.
6. **Titre en double (D74)** : la règle s'applique **quand un titre entre en vigueur** — « Appliquer » dans le panneau,
   « Renommer » dans la liste, et « Rétablir » un contenu de l'historique —, **si le titre change** (sa clé : casse,
   accents et espaces ignorés), à l'écran comme au serveur (400, qui nomme l'exercice en conflit). Les titres comparés
   sont **les titres en vigueur** des autres exercices publiés et non archivés. Le brouillon d'un exercice jamais publié
   reste libre ; **la règle s'applique à sa première publication**, comme aujourd'hui. Une republication ne change pas
   le titre (point 8) : elle n'est plus vérifiée. L'import restaure tel quel ; la cascade ne change aucun titre (D77).
7. **Routes** (rôle admin, journalisées) : `GET /api/prof/editeur/exercice/presentation?id=` (la présentation en
   vigueur, sa révision, ses erreurs, ses avertissements, les noms des copies, les retouches en attente,
   l'historique avec ce que le rétablir changerait) ; `POST …/exercice/presentation/appliquer`
   `{ id, revision, presentation }` ; `POST …/exercice/presentation/retablir` `{ id, revision, historique }`. Un champ
   hors de la liste blanche → 400 nommé ; une copie que la présentation en vigueur ne connaît pas → 400 (une copie
   nouvelle se publie d'abord) ; une révision périmée → 409, rien n'est écrasé ; rien à changer → 400 ; un exercice
   jamais publié → 400 (sa présentation est dans son brouillon). Actions du journal :
   `editeur_presentation_exercice_application`, `editeur_presentation_exercice_retablissement`.
   **« Renommer » un exercice publié** fait ce même geste en direct (même règle, même historique, même journal) ;
   pour un exercice jamais publié, il renomme le brouillon, comme avant.
8. **Le brouillon et la publication** : pour un exercice publié, ces champs **quittent le brouillon** — le titre, le
   cours et « À l'accueil » des réglages généraux, la photo et la note de toute copie que la présentation connaît ;
   ils y restent, cachés, sans effet. **Une version publiée prend la présentation en vigueur** (un instantané, pour
   les copies qu'elle connaît), cascade comprise. Le résumé des différences (`versionDiff`), le « aucune différence à
   publier », le « brouillon modifié » et « Annuler les modifications » ne comparent plus que le reste.
9. **Exercice jamais publié** : ses champs de présentation restent dans son brouillon, et entrent en vigueur à sa
   première publication (sa dernière version les porte). **Une copie ajoutée au brouillon d'un exercice publié**
   reçoit sa photo et sa note de départ **dans sa ligne du brouillon** (liseré doré), comme une clé nouvelle en E5-1 ;
   la version publiée les porte, puis elles ne se modifient plus que dans le panneau. Dupliquer un exercice publié,
   ou y prendre une copie, part de sa présentation en vigueur.
10. **Retouches en attente** (faites dans le brouillon avant ce jalon, jamais publiées) : une valeur de présentation
    du brouillon que ni la présentation (en vigueur ou dans son historique), ni **aucune** version publiée n'a jamais
    portée (une valeur venue d'une version, par « Reprendre » ou d'avant un « Appliquer », ou qui a déjà été en
    vigueur, n'est pas une retouche). Le panneau les signale en
    doré, avec « Les reprendre dans le panneau » ; elles ne partent qu'à l'application, et la prochaine publication
    les abandonne.
11. **Images** : même règle qu'après la retouche de D76 — seule une photo **choisie** (différente de celle en vigueur
    pour cette copie) doit exister et ne pas être archivée ; une photo archivée déjà en vigueur n'est qu'un
    avertissement ; « Rétablir » est permis avec une image archivée depuis. Une image nommée par la présentation d'un
    exercice, actuelle ou dans l'historique, compte comme utilisée.
12. **Sauvegarde** : chaque exercice de l'export porte `presentation` (`contenu`, `modifiee_le`, `enseignant`,
    `historique`) ; l'import l'ajoute ou la remplace comme celle des tables (D76, point 11). Un aller-retour ne change
    rien.
13. **Page d'un exercice publié** : un panneau **« Présentation — effet immédiat »** en tête, distinct du brouillon
    (contour et bouton verts, comme E5-1) — titre, cours (avec les cours existants et le conseil d'écriture, D71),
    « À l'accueil », une ligne par copie (photo, note), l'aperçu de ce que voit l'étudiant, « Appliquer… » avec la liste
    des changements, l'historique et « Rétablir ».

**Ce que D78 remplace.** Dans **D47**, ce qu'une version d'exercice **montre** n'est plus figé : sa présentation se
pose par-dessus. Dans **D71**, le cours se modifie en direct pour un exercice publié, plus « publié avec la version ».
Dans **D74**, le titre en double est refusé quand un titre entre en vigueur, plus à chaque publication ; il l'est
toujours à la première. Dans **D31**, l'attestation copie toujours le titre à l'émission, mais c'est le titre en
vigueur, plus celui de la version de la séance.

**Conséquences.** `migrations/0011_presentation_exercices.sql` ; `site/js/presentation-exercice.js` (pur, testé) ;
`site/js/exercice.js` (le refus du titre en direct) ; `site/js/ui/editeur-data.js` (`versionDiff`, textes) ;
`worker/base.js`, `worker/catalogue.js`, `worker/index.js`, `worker/editeur.js` (cascade, import), `worker/images.js` ;
`site/js/api.js`, `site/js/ui/editeur.js`, `site/css/editeur.css` ; SPEC §3, §7, §10 ; UI §3.9 ; CLAUDE.md ; PLAN.
Rapport : `docs/rapports/e5-3-presentation-exercices.md`.

**Réponses de Thierry au rapport (2026-09-28).** Les huit points à trancher du rapport sont acceptés tels que proposés :

1. au déploiement, une séance épinglée à une version plus ancienne montre le titre, les photos et les notes de la
   dernière version (point 2) ;
2. la republication ne vérifie plus le titre en double (point 6) — complétée par l'avertissement des titres en double
   (D79, point 8) ;
3. la réémission qui suit une correction d'identité (D37) garde le titre d'origine (point 5) ;
4. la barre de l'écran de réussite montre le titre en vigueur, l'attestation le sien ;
5. l'espace professeur et l'export CSV montrent le titre en vigueur ;
6. l'angle mort des retouches en attente (un brouillon revenu à la valeur d'une vieille version n'est pas signalé) est
   acceptable : il ne concerne que des brouillons d'avant E5-3 (point 10) ;
7. une copie rajoutée sous le même identifiant retrouve sa présentation en vigueur ; au besoin, sa photo se change dans
   le panneau ;
8. l'import restaure la présentation sans la règle du titre en double (point 6) — complété, lui aussi, par
   l'avertissement de D79.

## D79 — E5-4 : l'historique de la banque d'outils ; l'avertissement des titres en double ; clôture du chantier E5 (2026-09-28, décidée ; réponses de Thierry au rapport en fin d'entrée)

**Contexte.** Le dernier jalon de D75 : la banque d'outils se modifiait sur place, sans historique (inventaire, §1) ;
une erreur d'enregistrement ne se défaisait qu'à la main. Et les réponses au rapport d'E5-3 demandent un complément : la
republication et l'import ne vérifiant plus le titre en double, deux exercices publiés peuvent se retrouver sous le même
titre sans que rien ne le dise.

**Décision.**

1. **Stockage** (migration `0012`) : `banque_outils_historique`, un contenu **remplacé** par ligne — l'identifiant de
   l'outil, le contenu (l'outil au format de la banque), quand et par qui il avait été enregistré, quand, par qui et par
   quoi il a été remplacé (`enregistrement`, `retablissement`, `import`). Sans limite ; rien ne s'efface. La banque
   gagne `modifie_par` (qui a enregistré le contenu actuel ; vide pour les outils d'avant, semés ou créés avant ce
   jalon).
2. **Chaque enregistrement** d'un outil met le contenu qu'il remplace dans l'historique : l'écriture décide, avec le
   contrôle optimiste (D48, 409 : rien n'est écrit), puis le contenu remplacé et la ligne du journal suivent dans un
   même lot, comme pour la présentation (D76). Un enregistrement **sans
   changement** n'écrit rien (ni révision, ni historique, ni journal) et le dit. Le journal
   (`editeur_banque_enregistrement`) dit les changements en clair. **L'archivage reste tel quel** (hors de l'historique).
   Créer ou dupliquer un outil ne remplace rien.
3. **« Rétablir »** (`POST …/banque/retablir`) remet un contenu de l'historique de cet outil ; le contenu qu'il remplace
   va lui-même à l'historique (`retablissement`) ; journal `editeur_banque_historique_retablissement`. Il **revalide le
   contenu avec les règles et les tables d'aujourd'hui** :
   - un contenu devenu **invalide** (une matière d'outil renommée dans les tables, un groupe ou une opération disparus)
     **se rétablit quand même**, comme un enregistrement en erreur (la banque n'en refuse aucun) : ses erreurs sont
     dites **avant**, sur la ligne de l'historique, et **après**, sous les champs, pour être corrigées puis
     enregistrées ;
   - une **image archivée** depuis est permise (elle est toujours servie) et dite en avertissement ; une image inconnue
     (impossible : une image nommée par l'historique ne se supprime pas) est refusée (400).
4. **Images** (comme après la retouche de D76) : à l'enregistrement ou à la création, seule une photo **choisie**
   (différente de celle de l'outil) doit exister et ne pas être archivée — sinon 400, rien n'est écrit ; une photo
   archivée déjà en place n'est qu'un avertissement. Une image nommée par l'historique de la banque compte comme
   utilisée (`banque_historique`).
5. **La page de l'outil** montre l'historique, replié, le plus récent en tête : pour chaque contenu, quand et par qui il
   avait été enregistré, quand et par quoi il a été remplacé, **ce que le rétablir changerait** (en clair), ses erreurs
   et avertissements avec les tables d'aujourd'hui, et **Rétablir** (sans confirmation, sauf modifications non
   enregistrées). Route `GET /api/prof/editeur/banque/outil?id=`.
6. **Sauvegarde** : l'export porte `historique_banque` (tous les contenus remplacés, avec l'identifiant de leur outil,
   même disparu de la banque). L'import ajoute ceux qui manquent, et, comme il remplace la banque (D49), **met chaque
   contenu qu'il remplace ou retire dans l'historique** (`import`) : une restauration se défait outil par outil. Un
   outil **inchangé** par l'import garde sa ligne telle quelle (révision, date, auteur) ; un outil modifié prend la
   révision suivante ; un outil retiré garde son historique (recréé sous le même identifiant, il le retrouve, et
   « Rétablir » ramène son dernier contenu). Un aller-retour ne change rien.
7. **Aucune séance n'est touchée** : la banque ne touche aucun exercice (D47), et ce jalon ne change ni la correction
   ni les attestations.
8. **L'avertissement des titres en double** (complément de D78, réponses 2 et 8) : deux exercices publiés et
   non archivés dont les **titres en vigueur** se confondent (même clé : casse, accents, espaces ignorés) sont signalés
   en **doré**, sans rien bloquer : dans la liste des exercices, sur la ligne de chacun, et dans le panneau
   « Présentation » de chacun, en nommant l'autre. L'avertissement disparaît dès qu'un des deux titres change (ou
   qu'un des deux est archivé). Le serveur le calcule (`doublons` dans la liste et dans le panneau), avec la règle de
   D74 (`sameTitleExercises`).
9. **Clôture du chantier E5** : le rapport d'E5-4 fait le bilan des exigences de D75 ; le chantier est coché dans
   `PLAN.md`.

**Conséquences.** `migrations/0012_historique_banque.sql` ; `worker/base.js`, `worker/index.js`, `worker/editeur.js`
(import), `worker/images.js` ; `site/js/ui/editeur-data.js` (`bankToolDiff`, textes de l'historique et des titres en
double), `site/js/api.js`, `site/js/ui/editeur.js`, `site/css/editeur.css` ; SPEC §7, §10 ; UI §3.9 ; CLAUDE.md ;
DEMARRAGE ; PLAN. Rapport : `docs/rapports/e5-4-historique-banque.md`.

**Réponses de Thierry au rapport (2026-09-28).** Les cinq points à trancher du rapport sont acceptés tels que proposés :

1. un contenu devenu invalide se rétablit quand même, ses erreurs dites avant et après (point 3) ;
2. une photo choisie inconnue ou archivée est refusée (400) : c'est la règle de la retouche de D76 (point 4) ;
3. un enregistrement sans changement n'écrit rien (point 2) ;
4. un outil retiré par un import se retrouve en le recréant sous le même identifiant : c'est suffisant, puisque le
   résumé de l'import nomme déjà chaque outil retiré avec son identifiant (point 6) ;
5. l'action du journal d'un contenu rétabli est `editeur_banque_historique_retablissement` (point 3).

Et une retouche des documents : les quatre exigences de Thierry, posées au début du chantier, sont inscrites mot pour
mot dans D75, et le bilan du chantier (rapport d'E5-4, §7) les reprend dans leur ordre, a) à d).

## D80 — Le dépôt dédié et Cloudflare : D7 fermée ; D3 et D4 confirmées, D6 marquée fermée (2026-09-28, décidée)

**Contexte.** Quatre entrées du début du journal gardent un statut que les faits ont dépassé. D7 hésitait entre le
dépôt `tgm-fab` (un sous-dossier, une seule adresse GitHub Pages) et un dépôt dédié, en gardant `tgm-fab` pour la page
de vérification si l'adresse du QR devait rester stable. D3 (pile technique) était « proposée », à confirmer par
Thierry ; D4 (conventions de langue), « provisoire ». D6 (sécurité du QR) est fermée par D19, mais son en-tête dit
encore « ouverte ». Thierry constate l'état des lieux (2026-09-28) : le projet vit dans son propre dépôt depuis le
jalon 0 ; `tgm-fab` ne contient plus que l'ancienne page de rapport du classeur (`index.htm`, le même contenu que
`legacy/index.htm` aux fins de ligne près) et le logo ; le QR des nouvelles attestations n'y renvoie jamais (D33), et
il ne reste plus aucun rapport du classeur à vérifier.

**Décision.**

1. **D7 est fermée : dépôt dédié**, `ThierryLeroux/quiz-parametres-coupe`, **public** — aucun secret n'y vit (D22 :
   les secrets sont posés sur le Worker et dans les secrets de GitHub ; `.dev.vars` est ignoré par git). Le site et
   l'API sont servis par **un seul Worker Cloudflare** (D20), déployé par GitHub Actions après les tests ; GitHub Pages
   de ce dépôt est dépublié ; l'adresse est celle de D73, `https://quiz-parametres-coupe.tgm-tmi.workers.dev`. La page
   de vérification n'a pas eu à rester dans `tgm-fab` : c'est `/verifier`, sur le même Worker (D33), et l'adresse du
   QR suit celle du site.
2. **`tgm-fab` n'a plus de rôle pour le quiz.** Thierry dépublie lui-même son GitHub Pages (la marche à suivre de
   `DEMARRAGE.md`, étape 4, point 6, appliquée à `tgm-fab` ; rapport `docs/rapports/finition-d7-depot.md`) ; rien à
   faire dans ce dépôt-ci, sinon le dire. `legacy/index.htm` en garde la copie, en lecture seule : c'est **l'ancienne
   page de vérification du classeur**, publiée sur `thierryleroux.github.io/tgm-fab` jusqu'à sa dépublication. Après
   elle, un ancien QR du classeur (`…/tgm-fab/?data=…`) ne s'ouvre plus ; il n'en reste aucun à vérifier.
3. **D3 est confirmée**, telle que D19 et D20 l'ont changée. **Ce qui tient** : JavaScript natif en modules ES, sans
   framework ni étape de construction (`site/` est publié tel quel) ; les tests par `node --test` (le moteur, et le
   serveur sur `node:sqlite`, D22) ; une seule dépendance d'exécution, épinglée et vendorisée : la bibliothèque QR
   (`qrcode-generator`, `site/vendor/`, D33). **Ce que D19 et D20 ont changé** : le site ne fonctionne plus sans son
   **serveur de correction**, qui tire, corrige et signe (D19) ; il est hébergé par **Cloudflare** — un Worker, une
   base D1 — et non plus par GitHub Pages (D20) ; **`wrangler`**, seule `devDependency`, épinglée, sert à développer
   (`npm run dev`) et à publier (`deploy.yml`). Node sert donc aux tests et à `wrangler`, jamais au site publié.
4. **D4 est confirmée, et ses conventions s'appliquent partout** : site, serveur (`worker/`), tests, migrations,
   scripts de `reference/`, documents, messages de commit. Interface, documentation, commentaires et commits en
   français ; clés des données en français, `snake_case`, sans accents — les JSON du dépôt comme les tables et les
   colonnes de D1 ; identifiants de code en anglais, `camelCase`, fichiers JS en `kebab-case` (CLAUDE.md).
5. **D6 est marquée fermée** : D19 l'a fermée (le QR porte une attestation signée par HMAC, vérifiée par le serveur) ;
   son en-tête le dit maintenant.
6. Les anciennes entrées ne sont pas réécrites : seuls leurs en-têtes sont annotés, comme celui de D64.

**Conséquences.** En-têtes de D3, D4, D6 et D7 ; SPEC §11 (question 5 barrée) ; `README.md` et `legacy/README.md`
(`legacy/index.htm`, l'ancienne page de vérification du classeur) ; `DEMARRAGE.md`, étapes 2 et 4 ; PLAN (jalon 0,
jalon 3, chantier « accueil et libellés », E5-4, Finition). Aucun code, aucune migration ; rien ne touche la correction
ni les attestations. Rapport : `docs/rapports/finition-d7-depot.md`.

## D81 — Le graphique de progression par opération, dans le panneau Progression de l'écran Question (2026-09-28, décidée ; réponses de Thierry au rapport en fin d'entrée)

**Contexte.** Le classeur montrait, sur la feuille « Quiz - Menu Principal », un graphique de progression par
opération (VBA `modAffGraph`) : une barre horizontale par opération évaluée, de 0 à 100 % = somme des réussites de
suite des outils de l'opération ÷ somme de leurs réussites exigées ; après « Vérifier », la part gagnée par la question
en vert, la part perdue en rouge, retour au bleu à la question suivante ; un cadre doré quand l'opération est complète —
affiché une question trop tard, parce que le VBA le décide sur le pourcentage d'avant la question. La SPEC le demandait
(§7 : « Un graphique de progression par opération est affiché ») et en reportait les « seuils » à la finition (§10). Le
panneau Progression du site ne montrait qu'un rang par outil, un point par réussite de suite.

**Décision** (Thierry, 2026-09-28).

1. **Forme.** Dans le panneau Progression de l'écran Question, la liste des outils est **regroupée par opération**.
   Chaque opération a un **en-tête** : son pictogramme (celui des tables de la séance, comme le panneau de l'outil :
   `operationPictoOf`), son nom, une barre horizontale et « n / m » (réussites). Dessous, ses outils avec leurs points,
   comme avant (nom distinctif, « en cours », « remis à zéro »). Même une opération à un seul outil a son en-tête. La
   barre « n / m outils » du haut et la légende du bas restent.
2. **Valeur** : la somme des réussites de suite des outils de l'opération (plafonnées à leurs réussites exigées, comme
   le serveur les envoie) ÷ la somme de leurs réussites exigées. **Aucun réglage dans l'exercice** : les « seuils du
   graphique » reportés à la finition (SPEC §10) se ferment ainsi.
3. **Couleurs**, avec les jetons existants et aucune couleur nouvelle : la part acquise en bleu (`--color-accent`) ;
   **pendant le corrigé seulement**, la part que la question vient de gagner en vert (`--color-correct`) et celle
   qu'elle vient de perdre en rouge (`--color-wrong`) ; à la question suivante, la barre redevient simple. Une opération
   complète a un **contour doré** (`--color-gold`), **dès la question qui la complète** (le retard du classeur n'est pas
   repris). La couleur reste doublée d'un texte (UI §7) : « n / m » change, les points se remplissent ou se vident,
   « remis à zéro » ; la barre a un `aria-label` (« Perçage : 6 réussites sur 10 »).
4. **Ordre** : les opérations dans l'ordre de leur premier outil dans l'exercice ; les outils dans l'ordre de
   l'exercice à l'intérieur de leur opération.
5. **Téléphone** (sous 1000 px) : les opérations terminées se replient sous « n opérations terminées » (au lieu de
   « n outils terminés »). Restent toujours visibles : l'opération de l'outil en cours et, pendant le corrigé, celle que
   la question vient de changer — une perte, mais aussi un gain qui la complète : l'étudiant doit voir le contour doré.
   Dans une opération non terminée, tous ses outils restent affichés. Sur ordinateur, rien n'est replié.
6. **Où** : seulement l'écran Question. Rien sur l'attestation (figée et signée), la page de description d'un
   exercice ni l'espace professeur.
7. **Données** : tout se passe dans le navigateur. Le serveur envoie déjà, pour chaque outil de la progression, son
   opération, ses réussites et ses réussites exigées (`sessionView`), et l'écran a la progression d'avant « Vérifier »
   (celle de la question) et celle d'après (celle de la correction). Ni le serveur, ni la correction, ni la séance, ni
   l'attestation, ni aucune migration ne changent.

**Conséquences.** `site/js/ui/rules.js` : une fonction pure, testée (regroupement, ordre, sommes, gain, perte, complète,
repli sur téléphone), qui remplace le repli par outil (`foldDoneRows`) ; `site/js/ui/question-screen.js`,
`site/css/question.css` ; `tests/ui-rules.test.js`. SPEC §7 (ce que le graphique montre) et §10 (la ligne « Reporté :
seuils du graphique de progression » disparaît) ; UI §3.3 et §3.4 ; PLAN (Finition). La maquette 03 reste telle quelle :
UI.md fait foi (D17). Les séances en cours ne changent que d'affichage : ni leur correction, ni leurs compteurs, ni leurs
attestations. Rapport : `docs/rapports/finition-graphique-progression.md`.

**Réponses de Thierry au rapport (2026-09-28).** Les cinq points à trancher du rapport sont acceptés tels que
proposés ; rien ne change dans le code :

1. le contour doré entoure la barre de l'opération, pas tout son bloc, et son « n / m » passe en doré ;
2. l'acquis est bleu dans la barre de chaque opération ; les points et la barre « n / m outils » du haut restent verts ;
3. les noms des outils restent alignés sur celui de leur opération, quitte à passer sur deux lignes ;
4. rien n'est replié sur ordinateur, même quand le panneau est long (`test-complet`) ;
5. pendant le corrigé d'une réussite, l'outil n'est plus surligné « en cours » : le vert de la barre, le point qui se
   remplit et le bandeau disent où la question a compté.

## D82 — Les calculs dans les cases de réponse : une expression se calcule dans la case, le serveur la juge (2026-09-28, décidée ; réponses de Thierry au rapport, et retouche, puis retouches après les essais sur téléphone, en fin d'entrée)

**Contexte.** Une case de réponse de l'écran Question ne lit qu'un nombre : point ou virgule décimale (D10), espaces
ignorés (« 1 600 »), et la virgule devient un point à la sortie du champ (D71). L'étudiant calcule N = Vc × 4 / Ø ou
Vf = N × f à la calculatrice, puis recopie le résultat, avec le risque d'une faute de recopie. Mastercam et Catia
acceptent un calcul dans leurs cases : on tape `(3-1)*2`, Entrée, et la case affiche 4. Le serveur lit chaque saisie
avec `parseAnswer` (`site/js/correction.js`), qu'il importe (`worker/seance.js`, `worker/attestation.js`) ; il coupait
chaque saisie à 32 caractères, sans le dire (`cleanAnswers`).

**Décision** (Thierry, 2026-09-28).

1. **Syntaxe acceptée** : les nombres, avec point ou virgule décimale et espaces ignorés, comme aujourd'hui ; `+` et `-`
   (aussi `−`) ; `*` (aussi `×` et `x`) ; `/` (aussi `÷`) ; les parenthèses ; `pi` (aussi `PI` et `π`), qui vaut
   `Math.PI`. **Rien d'autre** : ni puissance, ni fonction, ni multiplication implicite (`2pi`, `2(3+1)` sont
   illisibles). Le moins unaire est permis à l'intérieur d'une expression. Un résultat négatif, une division par zéro
   ou une expression mal formée donnent « illisible », comme aujourd'hui.
2. **Moteur** : `parseAnswer` lit désormais ces expressions, avec un petit évaluateur écrit à la main — **jamais
   `eval()` ni `Function()`**. Le serveur, qui importe cette fonction, sait donc corriger une expression. La longueur de
   la saisie et la profondeur des parenthèses sont limitées, pour protéger le Worker. **Non-régression** : toute saisie
   acceptée aujourd'hui donne exactement le même nombre ; tout ce qui est refusé aujourd'hui sans être une expression
   reste refusé (« abc », « 1.2.3 », « -5 ») ; « 1,600 » vaut toujours 1.6. La validation des réponses côté serveur
   (longueur, caractères permis), en amont de `parseAnswer`, est revue.
3. **Touche Entrée** : si la case contient une expression, Entrée la calcule et **on reste dans la case** ; un deuxième
   Entrée vérifie, comme aujourd'hui. Quitter la case (Tab, clic) calcule aussi, au même moment où la virgule devient un
   point (D71). Un clic sur **Vérifier** calcule toutes les cases, puis envoie. Seulement les cases de réponse de
   l'écran Question : la Gestion du contenu ne change pas.
4. **Ce que la case affiche** : le résultat, c'est-à-dire le nombre que le serveur jugera, **sans le bruit de la
   virgule flottante et sans arrondi pédagogique**. Le navigateur **garde l'expression de côté et l'envoie comme
   réponse**, pour que le serveur juge exactement la même chose. Si l'étudiant retouche ensuite le résultat à la main,
   l'expression est oubliée et c'est le nombre tapé qui part.
5. **Correction** : la saisie s'affiche avec son expression — « ta saisie : 4 × 350 / 0.75 = 1866.67 » —, pour qu'on
   voie où l'étudiant s'est trompé dans sa formule. Partout où la saisie sert de nombre (ligne de calcul, écart en %,
   bandeau rouge, cohérence de f et de Vf), c'est **le nombre évalué** qui sert, jamais le texte de l'expression.
   **L'attestation ne change pas** : elle montre la valeur, pas l'expression.
6. **Téléphone** : le clavier numérique (`inputmode="decimal"`) n'a ni parenthèses ni opérateurs, et sur iPhone pas de
   touche Entrée. **Sur écran tactile seulement**, une rangée de boutons : `( ) + − × ÷ π =`. Un bouton insère son
   caractère à la position du curseur **sans faire perdre le focus** à la case (le clavier reste ouvert) ; « = »
   calcule la case active. La rangée reste visible pendant la saisie à 390 px. Pas de rangée sur ordinateur.
7. **Documents** : D82 ; SPEC (lecture d'une saisie, D10) ; UI §3.3, §3.4 et §7.
8. **Vérification** : `npm test` à `fail 0`, dont des tests de `parseAnswer` (priorités, parenthèses, pi, virgules
   multiples, saisies illisibles, non-régression) et une route du serveur qui reçoit une expression ; Chrome à 1280 et
   390 px, sans erreur console, sur `m10-tournage-vc-rpm` et `test-complet`.

**Précisions de mise en œuvre** (proposées au rapport, à confirmer ; `// ❓` dans le code là où elles tranchent).

- **Nombre ou expression.** Une saisie qui est un nombre (`^(\d+\.?\d*|\.\d+)$` une fois les espaces retirés et la
  virgule changée en point) se lit **mot pour mot comme avant** : même code, même nombre, sans limite de longueur.
  Tout le reste passe par l'évaluateur (`site/js/expression.js`). Les virgules deviennent toutes des points : « 1,5 +
  2,5 » vaut 4, « 1,2,3 » reste illisible (« 1.2.3 »). Le moins unaire est permis partout où un nombre peut aller
  (« 2 × −3 », « (−1 + 3) ») ; « -5 » reste refusé parce que son résultat est négatif, et « -0 » parce que −0 compte
  comme négatif. Il n'y a pas de plus unaire : « +5 » reste refusé. `x` en minuscule seulement ; `pi`, `PI` et `π`
  seulement (« Pi » est illisible).
- **Limites** : une expression de **60 caractères** au plus (la case n'en accepte pas davantage, `maxlength`) et
  **10 niveaux de parenthèses**. Le serveur (`cleanAnswers`) garde les 60 premiers caractères d'une saisie plus longue,
  suivis de « … » : elle est illisible, et le journal montre ce qui a été envoyé. Il ne filtre pas les caractères :
  c'est l'évaluateur qui refuse tout caractère hors de la liste du point 1 (une seule liste, pas deux à tenir
  d'accord).
- **Le nombre jugé** est le résultat de l'expression à 12 chiffres significatifs : le bruit de la virgule flottante
  disparaît (0.1 + 0.2 = 0.3), loin sous toute tolérance. Un nombre tapé, lui, n'est jamais touché.
- **Ce que la case affiche** : ce nombre, s'il tient en **9 caractères** (la largeur d'une case à 1280 px, mesurée
  dans Chrome) ; sinon, le même nombre avec moins de chiffres significatifs, jusqu'à ce qu'il tienne : 4 × 350 / 0.75
  → « 1866.6667 ». Sous la case, une note rappelle l'expression : « = (3 − 1) × 2 », ou « ≈ 4 × 350 / 0.75 » quand
  l'affichage est arrondi. Une expression illisible reste telle quelle dans la case, en rouge, avec sa note :
  « Illisible : division par zéro », « … : résultat négatif » ou « … : expression mal formée ».
- **Entrée** calcule si la case contient une expression **qu'on n'a pas encore essayé de calculer** : sur une
  expression illisible, le premier Entrée affiche la note, le deuxième vérifie.
- **Correction** : chaque champ de `correction.champs` porte `expression` — `null`, ou `{ texte, valeur, arrondie }` :
  l'expression écrite proprement (« 4 × 350 / 0.75 » : `×`, `/`, `−`, `π`, des espaces autour des opérateurs), le
  nombre tel que la case l'affiche, et s'il est arrondi. L'écran écrit sous la case « ta saisie : 4 × 350 / 0.75 ≈
  1866.6667 » (« = » quand rien n'est arrondi). Le calcul en une ligne, le bandeau rouge et « Juste (… attendu) »
  reprennent `valeur`.
- **La rangée de boutons** : une barre en bas de la zone visible, **juste au-dessus du clavier virtuel** (placée
  d'après `window.visualViewport`), sur toute la largeur, montrée seulement tant qu'une case à saisir a le focus, sur
  un écran dont le pointeur principal est tactile (`pointer: coarse`) ; 8 boutons de 44 px de haut. Les boutons
  insèrent `(`, `)`, `+`, `−`, `×`, `÷`, `π`.

**Conséquences.** `site/js/expression.js` (nouveau : l'évaluateur, l'écriture propre d'une expression, l'affichage du
résultat) ; `site/js/correction.js` (`parseAnswer`) ; `worker/seance.js` (`cleanAnswers`, `correctionView`) ;
`site/js/ui/rules.js`, `text.js`, `question-screen.js`, `site/css/question.css` ; tests. SPEC §5 (séparateur décimal),
§6 (saisie), §7 (`correction`) ; UI §3.3, §3.4, §7 ; PLAN (Finition, jalon F3). **La correction des séances en cours
change dès le déploiement** : le serveur lit autrement les réponses (une expression, refusée hier, est jugée) ; une
réponse qui était un nombre est jugée exactement comme avant. Le journal garde le texte envoyé, expression comprise ;
les attestations déjà émises ne changent pas. Rapport : `docs/rapports/finition-calcul-saisie.md`.

**Réponses de Thierry au rapport, et retouche (2026-09-28).**

1. **Acceptés tels que proposés** (points 1, 3, 4 et 6 du rapport) : le résultat en 9 caractères au plus, avec « ≈ »
   dans la note quand l'affichage est arrondi ; la note sous la case avant la correction ; le rappel « un calcul se
   tape tel quel » sous le formulaire ; les limites (60 caractères, 10 niveaux de parenthèses, « … » au-delà de 60
   caractères côté serveur).
2. **Une expression illisible ne part jamais au serveur**, ni par Entrée ni par Vérifier. Avant cette retouche, un clic
   sur Vérifier avec « 2(3) » dans une case la calculait à la sortie de la case, puis l'envoyait dans le même geste :
   question ratée et série remise à zéro pour une faute de frappe dans un calcul. Désormais, Vérifier (clic, toucher
   ou Entrée) **ne part pas** tant qu'une case contient une expression illisible : la case reste en rouge avec sa
   raison et **reçoit le focus** ; l'étudiant corrige ou efface. Un texte illisible qui n'est pas une expression
   (« 12a ») part comme avant et reste une mauvaise réponse. Le deuxième Entrée ne vérifie donc plus une case
   illisible : cette retouche remplace la précision « Entrée calcule si la case contient une expression qu'on n'a pas
   encore essayé de calculer ». **Côté navigateur seulement** : le serveur continue de juger illisible toute expression
   mal formée qu'il recevrait.
3. **Syntaxe élargie** (point 5 du rapport ; remplace la précision « `x` en minuscule seulement ; `pi`, `PI` et
   `π` seulement ») : `pi` **sans égard à la casse** (`pi`, `Pi`, `PI`, `pI`, `π`), à cause des
   majuscules automatiques des téléphones ; `x` **et `X`** ; le tiret demi-cadratin **« – »** comme moins. Le reste
   ne change pas : « -0 » et « +5 » refusés, « --5 » vaut 5. Le test de non-régression reste le même : un nombre se lit
   exactement comme avant.
4. **La rangée de boutons n'apparaît qu'après un toucher dans une case**, pas au focus automatique de la première case
   à l'affichage d'une question (point 2 du rapport) : sur iPhone, ce focus n'ouvre pas le clavier, et la rangée
   resterait seule au bas de l'écran. Son emplacement, juste au-dessus du clavier virtuel, est gardé.
5. **Essai sur un vrai téléphone** avant la fusion : le serveur local ouvert au Wi-Fi (procédure dans le rapport,
   « Suite ») ; Thierry fusionne lui-même, hors des périodes de labo.

**Retouche après l'essai sur téléphone (Thierry, Android, 2026-09-28).** Une décision et deux bogues.

1. **Sur écran tactile, aucune case ne reçoit le focus à l'affichage d'une question** (même critère que la rangée de
   boutons : `pointer: coarse`). À l'usage, le clavier s'ouvrait et cachait la moitié de l'écran, alors que
   l'étudiant doit d'abord lire les données du problème. Le focus va au titre, comme `showScreen` le fait par défaut,
   et la page s'affiche depuis le haut. Sur ordinateur, rien ne change : la première case à saisir reçoit le focus.
2. **La rangée de boutons suit simplement le focus des cases** (remplace le point 4 des réponses au rapport) : elle se
   montre quand une case prend le focus — un toucher, ou Vérifier qui donne le focus à une case illisible — et se
   cache quand le focus quitte les cases. Bogue corrigé : à l'affichage, le curseur était déjà dans la première case,
   mais la rangée n'apparaissait pas, même en touchant cette case ; il fallait toucher ailleurs, puis y revenir. Avec
   le point 1, ce cas disparaît ; l'état « case touchée » est retiré.
3. **La page ne défile jamais d'elle-même pendant que l'étudiant fait défiler.** Bogue corrigé : clavier ouvert, on
   remonte relire le diamètre de l'outil, puis on redescend un peu, et la page sautait pour ramener la case de
   réponse. Cause, l'hypothèse de Thierry, vérifiée dans Chrome : la rangée se replaçait à chaque défilement et à
   chaque changement de hauteur de la zone visible, et la page remontait dès que la case était sous la rangée ; or la
   barre d'adresse du navigateur, qui paraît ou disparaît selon le sens du défilement, change cette hauteur.
   Désormais, au défilement et au changement de hauteur, la rangée se replace seulement. **La seule remontée
   automatique** : quand une case prend le focus et que le clavier s'ouvre, si la rangée couvre alors la case. Elle est
   permise de la prise de focus jusqu'au premier geste de défilement de l'étudiant, jamais après.
4. **L'essai sur téléphone passe par le tunnel intégré de wrangler** (`npx wrangler dev`, touche `t`, l'adresse
   `https://…trycloudflare.com` sur le téléphone ; `t` ou Ctrl+C pour fermer), et non plus par le serveur local
   ouvert au Wi-Fi. Sous PowerShell, `npm run dev -- --ip 0.0.0.0` retire le `--`, et wrangler reçoit `0.0.0.0`
   comme fichier d'entrée. Sous Windows 11, la fenêtre du pare-feu pour `workerd.exe` autorise d'un coup les réseaux
   publics et privés, sans case à cocher. **Aucune information sur le réseau de Thierry** (nom du Wi-Fi, adresse IP)
   ne va dans un rapport : le dépôt est public.

**Retouche après le deuxième essai sur téléphone (Thierry, Android, 2026-09-28).** Le saut de la page est corrigé, le
focus à l'affichage est gardé. Le bogue de la rangée invisible, mieux décrit : quand on touche une case, le navigateur
fait défiler la page pour placer la case au-dessus du clavier ; si la case était dans la moitié **inférieure** de
l'écran, la page monte et la rangée apparaît ; si elle était dans la moitié **supérieure**, la page descend et la rangée
reste invisible. Le sens du défilement fait la différence, pas le focus d'avant.

1. **Hypothèse** (Thierry, à vérifier) : `calcBar` ne replaçait la rangée que sur les événements `scroll` et
   `resize` de `window.visualViewport`. Quand la case est en bas, Chrome déplace la zone visible, ce qui les
   déclenche ; quand elle est en haut, Chrome fait défiler la page elle-même (`scroll` de `window`), sans événement
   de la zone visible : la rangée reste à une position périmée. **Ce que Chrome sur le poste en dit** : un défilement
   de la page n'envoie que `scroll` à `window`, jamais à `visualViewport` (la sonde le montre, au doigt comme par
   `scrollBy`) — le mécanisme supposé existe. Mais Chrome sans interface ne sait pas émuler un clavier (ni le
   paramètre `viewport` de l'émulation, ni le zoom ne réduisent la zone visible sous la fenêtre) : le cas n'est
   **pas reproduit** tel quel, et l'hypothèse reste à confirmer sur le téléphone, par le diagnostic.
2. **Correction, piste 1** : la rangée se replace **aussi sur `scroll` et `resize` de `window`**, et **à chaque
   image pendant 600 ms après la prise de focus**, le temps que le clavier s'ouvre, quels que soient les événements
   que le navigateur envoie ou n'envoie pas. Toujours un replacement seulement : la page ne défile jamais d'elle-même,
   sauf la remontée déjà prévue (retouche précédente, point 3).
3. **Piste 2, en réserve** : `interactive-widget=resizes-content` dans la balise `meta viewport` du quiz — Chrome
   réduirait alors la page avec le clavier, et la rangée, fixée, se poserait d'office au-dessus ; le calcul par
   `visualViewport` resterait pour l'iPhone, qui ignore l'option. **Pas ajoutée** : une chose à la fois, pour que le
   prochain essai dise ce qui corrige ; et le poste ne peut pas vérifier ce qu'elle change aux autres écrans avec un
   clavier ouvert (identification, Gestion du contenu n'est pas touchée : autre page). À ajouter si la piste 1 ne
   suffit pas, et alors vérifier sur le téléphone les écrans à saisie.
4. **Diagnostic temporaire**, montré seulement avec `?diag=1` dans l'adresse (`site/js/ui/diag.js`, une ligne dans
   `main.js`, un style) : un encadré en haut de l'écran, mis à jour à chaque image — hauteur et décalage de la zone
   visible, `scrollY`, position et état de la rangée, case active, dernier événement reçu et son heure. Thierry fait
   une capture dans chacun des deux cas. **À retirer avant la fusion.**

**Retouche après le troisième essai sur téléphone (Thierry, Android, 2026-09-28).** Avec `?diag=1` : la rangée reste
invisible quand la case touchée est dans la moitié supérieure de l'écran ; au toucher, elle apparaît une fraction de
seconde, puis disparaît.

1. **Ce que le diagnostic a montré.** Case en haut (bogue) : zone visible h 434, décalage 0, fenêtre 817 ; scrollY
   1263 ; rangée « visible », haut 381, bas 434 ; case rpm haut 120, bas 168 ; dernier événement `touchend`. Case en
   bas (correct) : zone visible h 378, fenêtre 761 ; rangée haut 325, bas 378 ; case rpm haut 269, bas 317 ; dernier
   événement `win:scroll`. **Lecture de Thierry** : le clavier fait 383 px dans les deux cas (817 − 434 = 761 − 378),
   mais dans le cas du bogue Chrome annonce une fenêtre de 817 px, comme si la barre d'adresse était cachée, alors
   qu'elle est affichée ; l'écart, 56 px, est sa hauteur. La rangée, replacée juste, se trouve donc 56 px trop bas,
   derrière la bande d'icônes du haut du clavier. Le « flash » : bien placée d'abord, puis la barre d'adresse
   réapparaît quand Chrome fait descendre la page, et tout se décale. **Toute position calculée à partir de
   `visualViewport` ou de la fenêtre est fausse dans ce cas** : replacer plus souvent n'y change rien. L'hypothèse
   du deuxième essai (un défilement de la page sans événement de la zone visible) n'était pas la cause.
2. **Décision : la rangée n'est plus fixée à l'écran.** Elle s'attache à la case active, **dans la page, entre la case
   et sa note**, et défile avec elle ; la note reste visible dessous, le rouge d'une expression illisible compris.
   **Plus aucun calcul** à partir de `visualViewport`, de la fenêtre ou du clavier, sur Android comme sur iPhone.
   Largeur : celle de la case, ou 334 px au moins pour que les huit boutons (44 px de haut, 40 px de large au moins)
   y tiennent — à 390 px d'écran, la rangée déborde alors de 10 px de chaque côté, dans la marge du panneau. Retirés :
   le placement par `visualViewport`, les écoutes de `scroll` et `resize` de `window`, le replacement à chaque
   image, la marge réservée au bas de l'écran. Gardés : les boutons qui ne prennent pas le focus, la rangée qui suit
   le focus des cases, aucun focus à l'affichage sur écran tactile, la page qui ne défile jamais d'elle-même pendant
   que l'étudiant fait défiler.
3. **La seule remontée automatique reste celle de la prise de focus** : si le clavier, en s'ouvrant, cache la rangée
   sous la case, la page remonte pour montrer la case, sa rangée et sa note — **par le navigateur**
   (`scrollIntoView` au plus près sur le bloc de la case), jamais par un calcul. Elle se fait à la prise de focus,
   puis quand la zone visible change de taille (le clavier qui s'ouvre : l'événement `resize` de `visualViewport`
   sert de moment, pas de mesure), et se désarme au premier geste de défilement, comme avant.
4. **La rangée se cache un instant après que le focus quitte la case**, une fois le toucher terminé (trouvé dans
   Chrome en vérifiant) : au toucher d'un bouton sous la case — Vérifier, Ouvrir la table —, le focus quitte la case
   dès que le doigt se pose ; si la rangée disparaissait à cet instant, la page se décalerait sous le doigt et le
   toucher n'atteindrait plus le bouton. Si une autre case a pris le focus entre-temps, la rangée l'a suivie.
5. **La piste `interactive-widget=resizes-content` est écartée** : elle aurait aussi fait dépendre la rangée de ce
   que Chrome dit de la fenêtre, faux de 56 px dans ce cas.
6. **Le diagnostic `?diag=1` est gardé**, adapté (case active, rangée et le bloc où elle est, `scrollY`, dernier
   événement ; la zone visible reste en première ligne, pour lire les captures) ; à retirer avant la fusion.
7. **Réponse à la section 8 du rapport** : l'historique Git n'est pas réécrit pour l'adresse réseau qui s'y trouve.

**Quatrième essai sur téléphone (Thierry, Android, 2026-09-28) : concluant.** La rangée est collée sous la case, que
la case soit en haut ou en bas de l'écran ; Vérifier répond du premier coup ; la page ne saute pas. Le diagnostic
temporaire est retiré (`site/js/ui/diag.js`, son import et l'appel dans `main.js`, le style `.diag`) : il n'en reste
aucune trace dans le code, seulement dans les documents. **L'iPhone n'a pas encore été essayé** : la rangée y est dans
la page comme sur Android, et la remontée s'appuie sur Safari (`scrollIntoView`), sans calcul qui lui soit propre.

## D83 — Les facteurs de modification de la vitesse de rotation : une valeur de l'opération, dans les tables ; l'outil en hérite ; la 4e feuille (2026-09-28, décidée ; réponses de Thierry au rapport, et retouche, puis la feuille des avances à plus de 20 opérations, en fin d'entrée)

**Contexte.** En classe, les étudiants se réfèrent à une table papier, « Modification du RPM en fonction de
l'opération », que le site n'a pas — un oubli du classeur : Perçage 1 · Alésage 1/4 · Alésage à la barre 1 ·
Chanfreinage 1/4 · Rainurage 1/4 · Chambrage 1/4 · Moletage 1/4 · Tronçonnage 1/8. Jusqu'ici, chaque outil portait son
propre `fact_vc`, tapé à la main, et la question l'affichait (« Vitesse réduite × 0.25 »). Désormais **le facteur
appartient à l'opération**, dans les tables de référence, et **l'outil en hérite**, comme sa Vc vient de la table des
vitesses.

**Décision** (Thierry, 2026-09-28).

1. **Le facteur de vitesse est une valeur de chaque opération des tables de référence** (`facteur_vitesse`, un
   nombre plus grand que 0). Il est **versionné, comme les avances** : il touche la correction, donc il ne fait pas
   partie de la présentation en direct (D75). Dans l'onglet Tables de référence, une colonne l'édite, qui accepte
   « 1/4 » comme « 0.25 » (l'évaluateur de D82).
2. **Valeurs de départ** : le brouillon des tables est **prérempli d'après la table papier** ; Thierry les vérifie,
   puis publie lui-même la révision suivante. Tour : Tronçonnage 1/8 ; Rainurage externe et Rainurage interne 1/4 ;
   toutes les autres 1 (chariotages, dressage, centrage, alésage à la barre, filetages). Perceuse / Fraiseuse :
   Alésage à l'alésoir 1/4 ; Chanfreinage 1/4 ; Perçage, Pointage, Taraudage 1. Fraiseuse : Chanfreinage / ébavurage
   1/4 (la ligne « Chanfreinage » du papier ; aucun outil ne l'utilise encore) ; Contournages et Surfaçage 1.
   **Chambrage et Moletage ne sont pas créés** : Thierry le fera lui-même dans la Gestion du contenu s'il le veut, avec
   leurs avances et leur pictogramme.
3. **Rien ne change pour ce qui existe** (exigences d'E5, D75). Une version de tables sans facteurs, une version
   d'exercice publiée, une séance commencée et une attestation émise sont corrigées et affichées exactement comme
   avant, avec le `fact_vc` enregistré dans leurs copies. **La 4e feuille n'apparaît que pour une version de tables
   qui porte les facteurs** : on ne montre jamais une feuille qui contredirait la correction de sa version.
4. **L'outil hérite du facteur de son opération. On peut le forcer**, comme une exception signalée :
   - formulaire d'outil (banque et copies) : le champ « Facteur de vitesse » devient une ligne en lecture seule,
     « Selon la table : 1/4 (Chanfreinage) » ; une case « Forcer pour cet outil » ouvre deux champs obligatoires, la
     valeur et une raison courte ;
   - un badge « facteur forcé » dans la liste de la banque et dans la liste des outils d'un exercice ;
   - **un facteur forcé est toujours affiché à l'étudiant** dans la question, avec sa raison, que l'exercice donne le
     facteur ou non (« Facteur propre à cet outil : × 1 — fraise à inserts de carbure ») : sinon, la 4e feuille le
     piégerait ;
   - le facteur d'avance (`fact_av`) ne change pas : il reste propre à chaque outil.
5. **Passage des outils existants, sans rien changer en silence.** Quand un outil (banque, brouillon d'exercice, copie
   qui passe aux nouvelles tables par la cascade) rencontre des tables qui portent les facteurs : s'il est égal au
   facteur de son opération, il devient « hérité » ; s'il diffère, il devient « forcé », avec la raison « Valeur
   reprise de l'ancien outil — à vérifier », et il est nommé dans l'impact de la cascade et dans le rapport. Dans la
   semence, deux cas : **Nine9 90 degrés** et **l'outil à chambrer**, tous deux rangés sous Chanfreinage (1/4) avec
   un facteur de 1. Thierry tranchera leur cas lui-même dans la Gestion du contenu.
6. **Réglage par exercice « Donner le facteur de vitesse à l'étudiant »**, versionné avec l'exercice (comme les
   grandeurs masquées). **Décoché par défaut** pour un nouvel exercice : l'étudiant trouve le facteur dans la 4e
   feuille, comme la Vc. Coché (exercices pour débutants) : la ligne « Vitesse réduite × 1/4 » s'affiche comme
   aujourd'hui. **Une version publiée avant ce chantier garde l'affichage d'aujourd'hui.** Quand le facteur est à
   trouver, l'aide contextuelle de N ne donne plus la valeur, seulement la méthode (« … × le facteur de l'opération,
   feuille Facteurs de vitesse »), et son bouton ouvre la 4e feuille. Les avertissements « se déduit de » (D54)
   suivent.
7. **La 4e feuille** : onglet « Facteurs de vitesse », après Formules, et à l'impression (`/tables?version=`). Même
   cadre que les trois autres (en-tête, pied avec la révision — D28 —, une page lettre, lisible à 390 px). Titre :
   « Modification de la vitesse de rotation selon l'opération », avec la formule N = Vc × 4 / Ø × facteur. Une ligne
   par opération des tables, regroupées par machine comme sur la feuille des avances, avec le pictogramme des tables
   et le nom exact affiché dans la question. Le facteur s'écrit **en fraction, comme sur le papier** (1, 1/4, 1/8),
   en décimal seulement s'il n'est pas de la forme 1/n. Les lignes réduites ressortent (couleur d'accent) ; celles à
   1 restent sobres. Le contenu est composé par une fonction pure de `sheets-data.js`, testée.
8. **Ailleurs, pour que tout parle du même facteur** : feuille des formules, rangée N : « N = Vc × 4 / Ø × facteur »,
   et sa note renvoie à la feuille des facteurs (« relevé à l'opération de l'outil ; 1 si aucune réduction ») au lieu
   de « Certains outils imposent une réduction (alésoir, lame à tronçonner) », avec une miniature de la feuille si
   c'est simple ; correction : la ligne de calcul montre le facteur en fraction (« × 1/4 »). **La formule et les
   tolérances de la correction ne changent pas.**
9. **Vérifications** : non-régression (toute séance et toute version publiée existante donne la même correction, la
   même ligne de calcul et la même attestation qu'avant, octet pour octet pour les attestations) ; tests (héritage,
   forçage, passage des outils existants, feuille, réglage d'exercice, aide de N) ; Chrome à 1280 et 390 px.
10. **Documents** : D83 ; SPEC ; UI ; PLAN ; rapport, avec la liste des gestes de Thierry en production après la
    fusion. Le déploiement se fait **hors des périodes de labo**.

**Précisions de mise en œuvre** (proposées au rapport ; **confirmées par Thierry** le 2026-09-28 — réponses en fin
d'entrée, où la mise en page de la 4e feuille est aussi retouchée).

- **Les clés.** `operations[].facteur_vitesse` dans les tables ; dans un outil (banque, copie), `fact_vc` reste la clé
  du facteur **propre à l'outil**, désormais facultative, et `fact_vc_raison` (texte de 80 caractères au plus) est la
  raison de le forcer ; dans un exercice, `facteur_vitesse_donne` (`true` ; absent ou `false` : à trouver). Aucune
  migration : le format ancien se lit tel quel.
- **Des tables « portent les facteurs »** quand **chacune** de leurs opérations a `facteur_vitesse`. La validation
  refuse l'entre-deux (toutes, ou aucune). Une version de tables d'avant D83 n'en reçoit **pas** à la lecture
  (contrairement aux couleurs, D61) : elle garde sa correction et n'a pas de 4e feuille.
- **Le facteur qui sert au calcul de N** : celui de l'outil s'il en a un (`fact_vc`), sinon celui de son opération
  dans les tables de sa version. Avec des tables sans facteurs, `fact_vc` est exigé de l'outil, comme avant ; avec
  des tables qui les portent, il est facultatif.
- **L'état d'un outil**, lu avec les tables de sa version (`speedFactorState`) : **propre** (tables sans facteurs :
  l'affichage et la correction d'avant) ; **hérité** (pas de `fact_vc`) ; **forcé** (`fact_vc` et sa raison). Un
  **ancien outil** — un `fact_vc` sans raison — rencontré avec des tables qui portent les facteurs se lit selon le
  point 5 : égal, hérité ; différent, forcé avec la raison du passage. Rien n'est donc jamais en erreur ni ignoré en
  silence, même pour un contenu importé ou repris d'une vieille version.
- **Le passage s'écrit** (`adoptSpeedFactor` : le `fact_vc` égal disparaît, le `fact_vc` différent reçoit sa raison)
  chaque fois qu'un contenu est écrit avec des tables qui portent les facteurs : dans **la cascade** (la version
  qu'elle publie, et le brouillon qui passe — écrit avec sa révision lue), au **passage d'un brouillon** depuis sa
  page (« Passer à … »), à **« Reprendre cette version »** d'un exercice, à chaque **enregistrement** d'un brouillon
  ou d'un outil de la banque, à **« Rétablir »** un contenu de la banque, à la duplication et à l'**import**. Une
  version publiée, immuable, n'est jamais réécrite : elle se lit par la règle ci-dessus. Un outil hérité qui a fait
  son passage **suit** ensuite sa table ; un outil forcé garde sa valeur.
- **La banque fait son passage à la publication** des premières tables qui portent les facteurs, **dans le même lot**
  que la version des tables et la cascade : elle n'a pas de version, et se valide avec les tables les plus récentes.
  Sans cela, un outil resté à l'ancien format aurait paru hérité tant que sa table ne changeait pas, puis « forcé » le
  jour où elle change — alors qu'on attend de lui qu'il la suive. La confirmation de publication l'annonce (combien
  d'outils héritent, lesquels sont forcés) ; le contenu d'avant de chaque outil va à son historique (D79), et la
  ligne du journal de la publication le résume.
- **Une copie ajoutée à un exercice** (depuis la banque, depuis un autre exercice) prend le facteur que les tables de
  l'exercice veulent (`settleSpeedFactor`) : avec des tables sans facteurs, elle reçoit son `fact_vc` — le sien, sinon
  celui de son opération dans les tables d'où elle vient —, sans raison. De même un **brouillon qu'on fait passer à
  des tables qui ne portent pas les facteurs** (par l'API : la page n'offre que les plus récentes) : chaque copie y
  retrouve son `fact_vc`, et la raison d'un forçage, sans objet, n'y est plus.
- **La 4e feuille** place le facteur tout de suite après le nom de l'opération, puis le pictogramme : à 390 px, le
  nom et le facteur se lisent sans faire défiler la feuille. La **miniature** de la feuille des formules est sous la
  formule de N, dont l'exacte devient « N = Vc × 12 / (π × Ø) × facteur ».
- **Le brouillon des tables prérempli** : à la lecture du brouillon (jamais d'une version publiée), une opération
  **sans** la clé reçoit la valeur de la table papier, 1 si le papier ne la nomme pas (`prefillSpeedFactors`) ; la
  publication montre chaque facteur dans ses différences (« Opération « Tronçonnage » — facteur de vitesse : — →
  1/8 »). « Reprendre cette version » d'une version sans facteurs et « Annuler les modifications » donnent donc un
  brouillon prérempli de même ; « Annuler » est inactif quand le brouillon ne diffère de la dernière version que par
  ce préremplissage.
- **Le réglage de l'exercice n'a d'effet qu'avec des tables qui portent les facteurs** : avec les autres, le facteur
  de l'outil s'affiche comme avant, quoi que dise le réglage. **Un exercice qui passe aux nouvelles tables par la
  cascade n'a pas le réglage : le facteur y devient à trouver** ; l'impact de la cascade le dit pour chaque exercice.
- **Ce que la question porte** (`seance.question.outil`) : pour une version d'avant D83, `fact_vc`, comme avant ;
  sinon `facteur_vitesse` — `{ etat: "force", texte, valeur, raison }`, `{ etat: "donne", texte, valeur }` ou
  `{ etat: "a_trouver" }`, sans valeur ni texte : **rien de ce qui est à trouver ne part au navigateur** (SPEC §7).
- **La ligne de calcul de N**, pour une version qui porte les facteurs : « N = Vc × 4 / Ø × facteur = 100 × 4 / 0.25
  × 1/4 » ; un facteur hérité de 1 ne s'écrit pas ; un facteur forcé s'écrit toujours, suivi de « (propre à cet
  outil) ». Pour une version d'avant, la ligne d'avant (« … × 0.25 »).

**Ce que D83 précise ou remplace.**

- **D54** : les avertissements « se déduit de » nomment le « facteur de vitesse », et disent d'où il vient quand il
  est à trouver (la feuille des facteurs).
- **D61, D62** : les tables portent une valeur de plus par opération ; `tablesDiff` et `exerciseTablesImpact` la
  disent ; l'impact nomme les outils forcés et le réglage de l'exercice.
- **D77, point 3** : la version que la cascade publie reste le dernier contenu publié, **à ceci près** que, avec des
  tables qui portent les facteurs, chaque copie fait son passage (point 5) ; le brouillon qui passe aussi.
- **D82, point 3** (« la Gestion du contenu ne change pas ») : les cases de facteur de vitesse de la Gestion du
  contenu — la colonne des tables, la valeur forcée d'un outil — lisent une fraction avec le même évaluateur. Le
  reste de la Gestion du contenu ne change pas.
- **SPEC §5** : `N_brut = Vc × 4 / D × facteur`, où le facteur est celui de l'outil s'il en a un, sinon celui de son
  opération.

**Conséquences.** `site/js/facteur-vitesse.js` (nouveau : les règles pures) ; `data.js` (validation des tables et
des outils, `hasSpeedFactors`), `calcul.js`, `tables.js` (`tablesDiff`), `exercice.js` (`facteur_vitesse_donne`) ;
`worker/seance.js` (`questionView`, la ligne de calcul), `worker/editeur.js` et `index.js` (cascade, passage,
reprise, brouillon des tables), `worker/base.js` ; `site/js/ui/sheets-data.js` (`speedFactorSheet`),
`reference-screen.js`, `rules.js` (`factorLines`, `helpLine`), `editeur-data.js`, `editeur.js` ; feuilles de style ;
tests, dont `tests/non-regression-d83.test.js` et son témoin `tests/instantanes/avant-d83.json`, produit par le code
d'avant le chantier. SPEC §3, §5, §7, §10 ; UI §3.3, §3.4, §3.5, §3.9 ; PLAN ; CLAUDE.md. **Rien ne touche la
correction des séances en cours** : tant que Thierry n'a pas publié de tables qui portent les facteurs, tout se lit
et se corrige comme avant ; ensuite, seules les nouvelles séances prennent les versions de la cascade. Rapport :
`docs/rapports/facteurs-vitesse.md`.

**Réponses de Thierry au rapport, et retouche (2026-09-28).**

1. **Les onze points douteux du rapport sont acceptés tels que proposés** :
   1. un exercice qui passe aux nouvelles tables par la cascade reçoit le défaut : le facteur y est **à trouver** ;
   2. la banque fait son passage **à la publication des tables** ;
   3. la ligne de calcul **nomme le facteur** (« N = Vc × 4 / Ø × facteur = … × 1/4 », « (propre à cet outil) » après
      un facteur forcé) ; le `// ❓` de `worker/seance.js` est retiré ;
   4. « Reprendre cette version » d'une version d'avant préremplit d'après la **table papier** ;
   5. sur la 4e feuille, le facteur reste **avant le pictogramme** ;
   6. la couleur d'accent de la feuille reste le **bleu de la 1re partie** ;
   7. la feuille des formules reste comme proposée (miniature sous la formule de N, formule exacte qui passe à la
      ligne, exemple « perçage : facteur 1 ») ;
   8. une raison de **80 caractères** au plus ; un facteur **> 0, sans plafond** ; un outil peut être forcé à la valeur
      de sa table ;
   9. le témoin de non-régression (565 Ko) est **gardé** dans le dépôt, jamais régénéré ;
   10. le retour à des tables sans facteurs reste possible **par l'API seulement** ;
   11. les messages d'erreur **ne changent pas** (ils nomment la clé).
2. **Les onglets des feuilles sont tous visibles, sans défiler.** À 390 px, le 4e onglet sortait de l'écran : la barre
   des onglets défilait de côté (`overflow-x: auto`), si bien qu'un étudiant sur téléphone pouvait ne jamais voir que
   la feuille existe, et que l'onglet actif était coupé quand la feuille s'ouvrait par « Ouvrir la table ». La barre
   **passe à la ligne** (`flex-wrap`) et ne défile plus : à 390 comme à 360 px, quatre onglets font deux rangées de
   deux. Même règle sur `/tables?version=`. Sur ordinateur, une seule rangée : rien ne change. Conséquence de la même
   règle : les trois onglets d'une version d'avant font aussi deux rangées sur téléphone (deux et un) ; à 390 px, il
   leur manquait 4 px pour tenir sur une seule.
3. **La 4e feuille occupe toute la largeur de la page, et son texte est plus gros.** Le tableau n'occupait que la
   moitié gauche de la page lettre, et ses noms d'opérations étaient petits à côté de la table papier.
   - **Quatre colonnes réparties sur la largeur utile** (720 px), dans l'ordre Machine-outil, Opération, Facteur,
     Pictogramme (point 5 du rapport) ; le pictogramme est centré dans la sienne. La **bande bleue** d'une ligne
     réduite va du nom de l'opération au bord droit de la page.
   - **Tailles** : noms d'opérations 15 px (11 avant) ; facteur d'une ligne réduite 25 px (17 avant), d'une ligne à 1
     19 px (13 avant) ; le facteur reste ce qu'on lit en premier.
   - **Les rangs se partagent la hauteur de la page** (56 px au plus chacun), et le pictogramme suit la hauteur de
     son rang : la feuille tient sur une page lettre **quel que soit le nombre d'opérations** — 19 opérations, des
     rangs de 44 px (41 avant) ; 21 (avec Chambrage et Moletage), des rangs de 40 px.
   - **Le pictogramme ne grandit pas dans la proportion du texte** : 40 px de haut au lieu de 38, quand le texte gagne
     un tiers. Dix-neuf opérations sur une page lettre, une par rang, ne laissent pas plus de 44 px à chacun.
   - **Sur téléphone** (écran de moins de 640 px), la page garde sa taille et défile dans son cadre ; les colonnes s'y
     serrent à gauche (68, 146 et 78 px, puis le pictogramme) et le texte y est un peu plus petit (noms à 13 px,
     facteurs à 21 et 16 px), pour que **le nom et le facteur se lisent sans faire défiler**, à 390 comme à 360 px.
     À l'impression, toujours la pleine largeur, même depuis un téléphone.
   - Les trois autres feuilles ne changent pas. **Rien ne touche la correction.**

**Suite : la feuille des avances à plus de 20 opérations (2026-09-28).** Réponses de Thierry aux points 4 et 5 de la
retouche (§7.5 du rapport) : **acceptés**. Les points 1 à 3 (les pictogrammes, la disposition du téléphone, les trois
onglets d'une version d'avant sur deux rangées) n'ont pas reçu de réponse ; la branche a été fusionnée avec ce qu'ils
proposaient.

1. **La feuille des avances reçoit la règle de la 4e feuille.** Ses rangs avaient une hauteur fixe, 41 px : elle
   tenait jusqu'à 20 opérations ; à 21 — Chambrage et Moletage créés —, le dernier rang passait sur le pied de page.
   Désormais **les rangs se partagent la hauteur de la page, sans jamais dépasser leur hauteur d'aujourd'hui** :
   - **jusqu'à 20 opérations**, des rangs de 41 px : la feuille est celle d'avant, élément par élément ;
   - **au-delà**, la grille s'arrête 8 px avant le pied de page, l'en-tête garde ses 41 px et les rangs se partagent
     le reste, tous égaux (21 opérations : 39,8 px ; 23 : 36,4 px) ; le pictogramme ne dépasse jamais son rang ; le
     texte garde sa taille ; la feuille tient sur une page lettre.
2. **Les deux `// ❓` de D82 sont retirés** (`site/js/expression.js`, `site/js/ui/question-screen.js`) : leurs
   commentaires disent la règle acceptée à la fin de D82 — le résultat en 9 caractères, le rappel « un calcul se tape
   tel quel ».

Pas de nouvelle décision : c'est la règle de la 4e feuille, étendue à la feuille des avances. **Rien ne touche la
correction.** Rapport : `docs/rapports/feuille-avances-hauteur.md`.

## D84 — Le lot d'exercices de l'automne 2026 : sept exercices, sept démos, six outils, créés d'un seul coup par l'import de la Gestion du contenu (2026-09-29, décidée ; réponses de Thierry au rapport, et retouche, en fin d'entrée)

**Contexte.** Le site n'offrait qu'un exercice, « M10 — Tournage : Vc et vitesse de rotation ». Thierry a arrêté, en
discussion, le catalogue des exercices de quatre cours (M10 — tournage et fraisage —, M30, M40, F50), les outils qui
manquaient à la banque et ceux à corriger. Les saisir à la main dans la Gestion du contenu, c'est quatorze exercices et
deux cent cinquante copies d'outils. L'import d'une sauvegarde (D49) sait déjà tout écrire d'un coup, avec un résumé
avant la confirmation.

**Décision** (Thierry, 2026-09-29).

1. **Le catalogue arrêté est gardé dans le dépôt**, tel quel : `docs/lots/lot-exercices-2026-09.md`. Il fait foi :
   règles communes, outils à créer et à modifier, grille des outils par exercice avec les réussites exigées, réglages
   de chaque exercice, démos.
2. **Un script reproductible compose le fichier d'import** : `reference/lot-exercices/generer.mjs`. Entrée : un
   export de la Gestion du contenu ; sortie : `captures/lot-exercices/import-lot.json`, au format
   « quiz-parametres-coupe/editeur/1 ». Il ne parle à aucun serveur et ne touche à aucune base. Le même export donne
   le même fichier, octet pour octet. Le fichier produit ne va pas dans Git.
3. **Aucun code du site ni du serveur ne change.** Le script se sert du code du dépôt pour se vérifier (`draftErrors`,
   `validateData`, `importPlan`, `copyOfTool`) et n'écrit rien si une vérification échoue.
4. **Le déroulement**, un soir hors des périodes de labo : **export frais → script → valider → importer → publier.**
   Rien ne se modifie dans la Gestion du contenu entre l'export et l'import : l'import remplace la banque entière et
   les brouillons des exercices du lot.
5. **Ce que le fichier contient**, et rien d'autre :
   - la **version de tables** sur laquelle les brouillons sont faits (la plus récente de l'export) : si la base en a
     une autre sous ce nom, l'import est refusé ;
   - la **banque entière** : les outils de l'export, les six nouveaux au dernier rang, trois outils modifiés ; aucun
     outil n'est retiré ;
   - **quatorze exercices** : sept démos et six exercices en brouillons jamais publiés, et un brouillon nouveau pour
     `m10-tournage-vc-rpm-2`, bâti sur le sien ; ses versions publiées ne sont pas dans le fichier, donc pas touchées ;
   - **deux images** (fiche et contenu), celles de l'outil à rainurer et de la fraise à fileter ; leur identifiant
     vient de leur empreinte (`img-…`), comme celui d'une image téléversée dans l'onglet Images.
   Les tables, leur brouillon, leur présentation, l'historique de la banque et les autres exercices ne sont pas dans
   le fichier : l'import les laisse tels quels.
6. **Le titre et le cours de `m10-tournage-vc-rpm-2` entrent en vigueur à l'import**, par sa présentation en direct
   (D78) : « Tournage — Exercice 2 », « M10 — Tournage ». Le reste de sa présentation est gardé. L'effet est
   immédiat, séances en cours comprises ; sa version 6 ne prend effet qu'à sa publication, pour les nouvelles séances.
7. **Une démo est un exercice comme un autre**, d'une seule question : identifiant `demo-<exercice>`, mêmes réglages,
   une copie d'outil, une réussite, « Démo » dans le titre, juste avant son exercice à l'accueil. Sa séance se
   supprime dans l'espace professeur (D45) ; son attestation répond alors « annulée ».

**Trois écarts au catalogue, chacun signalé dans le rapport.**

1. **La fraise 82 degrés est modifiée aussi** (trois outils modifiés, pas deux). La version A2026_r6 des tables a
   renommé l'opération « Chanfreinage » en « Chanfreinage / chambrage » ; la banque ne suit pas un renommage, et ses
   trois outils de cette opération (Nine9 90 degrés, fraise 82 degrés, outil à chambrer) portaient encore l'ancien
   nom, inconnu des tables. Le script leur donne le nouveau. Rien d'autre ne change dans la fraise 82 degrés.
2. **Le gabarit de la fraise à fileter perd son « Ø »** : « Fraise à fileter [IdDia] - [NbDent] dents ». Le jeton
   [IdDia] est le libellé de la dimension, qui commence déjà par « Ø » : avec le gabarit du catalogue, la question
   aurait affiché « Fraise à fileter Ø Ø 0.300 po — … ».
3. **Le nouveau Nine9 s'appelle « Nine9 d'ébavurage »**, le nom que lui donne la grille ; le tableau des outils à créer
   dit « Nine9 » tout court, qui se confondrait avec « Nine9 90 degrés » dans la progression.

**Ce que l'import ne sait pas exprimer**, et qui se fait à la main après lui (aucun code n'a été modifié pour le
contourner) :

1. **Le rang d'un exercice.** Un exercice ajouté prend le dernier rang, dans l'ordre du fichier ; un exercice
   remplacé garde le sien. La démo de « Tournage — Exercice 2 » arrive donc après son exercice : elle se monte de deux
   rangs dans la liste de la Gestion du contenu (« ↑ », deux fois). Les six autres démos arrivent à leur place.
2. **L'archivage d'un exercice hors du lot.** `m10-tournage-vc-rpm-2-2` (« … (copie) », cours « M10 »), publié et non
   archivé, ferait un sixième groupe à l'accueil : Thierry l'archive s'il n'en veut plus.

**Conséquences.**

- **Rien ne touche la correction des séances en cours** : aucun code ne change, et une séance commencée garde sa
  version. La banque ne touche aucun exercice publié (ses copies sont indépendantes, D47).
- La Gestion du contenu reste le seul endroit où le contenu se modifie : le script ne fait que préparer un fichier que
  l'écran Sauvegarde valide, résume, puis importe sur confirmation.
- Le script est gardé avec son test (`tests/lot-exercices.test.js`, sur un export d'essai fait de la semence) : tant
  que le lot n'est pas importé, un changement du code qui casserait le fichier se voit à `npm test`. Le lot importé et
  publié, le script ne sert plus qu'à relire comment il a été composé.
- **Deux limites du code, vues à la répétition générale, restent à traiter à part** (rapport, points douteux 1 et 2) :
  à cinq grandeurs évaluées, la colonne « Matériau usiné » de l'attestation n'a que 18 px ; à plus de dix-neuf outils,
  le tableau des opérations de l'attestation dépasse sa première page.

Rapport : `docs/rapports/lot-exercices.md`.

**Réponses de Thierry au rapport, et retouche (2026-09-29).** Les treize points douteux du rapport sont tranchés.

1. **L'attestation à cinq grandeurs** (la colonne « Matériau usiné » de 18 px, 6 à 19 pages) : **traitée dans un
   chantier de code à part**, branche `attestation-cinq-grandeurs`. Le lot n'y touche pas.
2. **L'attestation à plus de dix-neuf outils** (la première page de F50 déborde) : **le même chantier**.
   Conséquence des points 1 et 2 : **les exercices à cinq grandeurs et leurs démos ne se publient qu'après la fusion
   de ce chantier** — « Tournage — Exercice 3 », « Fraisage — Exercice 3 », M30, M40, F50, et leurs cinq démos.
   L'import, lui, se fait en entier : un brouillon jamais publié n'est pas servi aux étudiants. « Tournage —
   Exercice 2 », « Fraisage — Exercice 2 » et leurs démos se publient le soir de l'import.
3. **Le pictogramme de « Chanfreinage / chambrage »** : accepté. Thierry le choisit dans le panneau
   « Présentation » des tables (le pictogramme « Chanfreinage »), avec effet immédiat.
4. **Le rang de la démo de « Tournage — Exercice 2 »** : accepté. Thierry la monte de deux rangs après l'import ;
   aucun code n'est modifié pour que l'import règle les rangs.
5. **La copie `m10-tournage-vc-rpm-2-2`** : Thierry l'archive à la main. Rien à faire dans le script.
6. **La fraise 82 degrés est modifiée aussi** : accepté. Trois outils modifiés.
7. **La fraise à fileter** : le gabarit est gardé (« Fraise à fileter [IdDia] - [NbDent] dents ») ; **ses dimensions
   vont de la plus petite à la plus grande** — Ø 0.180, 0.240, 0.300 po —, comme celles des autres outils. La plage
   se lit « Ø 0.180 po — 20 à 32 filets/po à Ø 0.300 po — 16 à 28 filets/po ».
8. **« Nine9 d'ébavurage »** : accepté, c'est le nom de l'outil.
9. **Le Nine9 d'ébavurage a sa propre nomenclature : « Outil à ébavurer Nine9 : [IdDia] »**, dans la banque et dans
   toutes ses copies. Le Nine9 90 degrés garde la sienne, « Outil à chanfreiner Nine9 : [IdDia] ».
10. **Les six nouveaux outils n'ont pas de note** : accepté.
11. **L'identifiant des deux images vient de leur empreinte** (`img-…`) : accepté.
12. **Le script reste dans `reference/lot-exercices/`** : accepté.
13. **Importer et publier le même soir**, hors des périodes de labo : accepté.

**Les écarts au catalogue sont donc cinq**, tous décidés : la fraise 82 degrés modifiée (point 6) ; le gabarit de la
fraise à fileter sans son « Ø » et l'ordre de ses dimensions (point 7) ; le nom du Nine9 d'ébavurage (point 8) ; sa
nomenclature (point 9). Le catalogue du dépôt reste tel que Thierry l'a arrêté : c'est cette entrée, puis le script,
qui portent ces cinq écarts.

**La retouche** tient en deux valeurs du script (points 7 et 9). Relancé sur le même export, il donne un fichier où
huit valeurs changent, et aucune autre : la nomenclature du Nine9 d'ébavurage dans la banque et dans ses quatre copies
(« Fraisage — Exercice 2 », « Fraisage — Exercice 3 », M30, F50), l'ordre des dimensions de la fraise à fileter dans
la banque et dans ses deux copies (F50 et sa démo). **Rien ne touche la correction** : aucun code du site ni du
serveur ne change, et le lot n'est pas encore importé.

## D85 — L'attestation à quatre ou cinq grandeurs et à plus de dix-neuf outils : largeurs resserrées, tableau par outil qui se poursuit, page 1 recalibrée (2026-09-29, décidée ; le point 6 est proposé, à confirmer par Thierry)

**Contexte.** La répétition générale du lot d'exercices (D84, rapport `lot-exercices`, points douteux 1 et 2) a montré
deux limites de la page de l'attestation. À cinq grandeurs évaluées, les colonnes du tableau des questions ont des
largeurs fixes et « Matériau usiné » prend ce qui reste : 18 px. Le nom du matériau s'y écrit deux lettres par ligne,
un rang fait de 111 à 449 px de haut, et l'attestation fait de 7 à 20 pages. Le tableau « Opérations effectuées »,
lui, n'est jamais coupé entre deux pages : à 35 outils (F50), la première page déborde et les derniers outils sont
perdus à l'impression.

**Décision** (Thierry, 2026-09-29 ; les valeurs sont mesurées dans Chrome, sur la page lettre).

1. **Seule la mise en page change.** L'enregistrement figé, son code, sa signature et l'adresse que porte le QR ne
   changent pas : aucun fichier de `worker/` n'est touché, et l'attestation montre les mêmes textes et les mêmes
   valeurs. **Une attestation déjà émise reste valide** ; elle s'affiche et s'imprime avec la nouvelle mise en page.
2. **Des largeurs resserrées à quatre ou cinq grandeurs évaluées.** La règle : les largeurs ordinaires (N° 22,
   Outil 180, Matière d'outil 90, chaque grandeur 60, Date et heure 110 px) tant qu'elles laissent au matériau usiné
   **au moins 100 px** — une, deux ou trois grandeurs : 258, 198, 138 px. Sinon, les largeurs resserrées : N° 22,
   Outil 150, Matière d'outil 56, chaque grandeur 54, Date et heure 62 px ; le matériau usiné a alors **214 px à
   quatre grandeurs et 160 px à cinq**. Pour y arriver : l'en-tête d'une grandeur sur deux lignes (« Vc », puis
   « (pi/min) »), comme « Matière » / « d'outil » et « Date » / « et heure » ; **la date et l'heure sur deux lignes** ;
   la matière d'outil sur deux lignes au besoin (« Insert de » / « carbure »). Les polices et leurs tailles ne
   changent pas ; une valeur de huit caractères (« 0.000938 ») tient dans sa colonne. Page lettre, portrait.
3. **Un texte se replie entre les mots, jamais au milieu d'un mot.** La colonne du matériau usiné (152 px utiles à
   cinq grandeurs) est plus de deux fois plus large que le mot le plus long des tables (« thermodurcissable »,
   72 px). Un mot plus large que sa colonne — il n'y en a aucun — se couperait, en dernier recours, plutôt que de
   passer sur la colonne voisine.
4. **Le tableau « Opérations effectuées » se poursuit sur la page suivante**, comme la liste des questions : son
   titre dit « — suite à la page suivante », la page suivante reprend l'en-tête du département, la ligne de rappel,
   le titre « Opérations effectuées (suite) » et l'en-tête du tableau. La note des réussites de suite reste sous son
   dernier rang. La liste des questions vient ensuite, sur la même page s'il reste de la place.
5. **Non-régression.** À une et deux grandeurs, et tant que le tableau par outil tient en page 1, la page est
   **identique à celle d'avant, image contre image** : mêmes largeurs, même repli, même coupe entre les pages.
   L'estimation du repli se fait maintenant mot par mot (elle suit ce que fait le navigateur) ; pour tous les
   matériaux des tables et tous les noms d'outils du catalogue, elle compte les mêmes lignes que l'estimation
   d'avant aux largeurs d'une et de deux grandeurs (un test le vérifie).
6. **❓ La place de la page 1 est recalibrée : 420 px au lieu de 460** (`firstPageFree`). C'est la seule chose qui
   change pour une attestation à une ou deux grandeurs, et elle est proposée, pas demandée. La mesure du chantier a
   montré que la constante d'origine offrait 37 px de trop (la place réelle est de 422,9 px) : quand la liste des
   questions remplissait la page 1 jusqu'au bout, **le pied de page sortait de la zone imprimable** — de 18 px sur
   « M10 — Tournage : Vc et RPM », avec le code de `main`. La vérification d'UI §3.6 (`scrollHeight` =
   `clientHeight`) ne le voyait pas : à l'écran, le débordement tombe dans la marge de la page. Avec 420 px, la
   page 1 porte une ou deux questions de moins, qui passent à la page 2 ; rien d'autre ne bouge. UI §3.6 demande de recalibrer quand la CSS de la page change, et de
   vérifier qu'aucune page ne déborde : c'est ce qui est fait, dans un commit à part. **Si Thierry préfère garder les
   pages d'avant telles quelles**, ce commit s'annule seul — mais les pages 1 pleines débordent alors de nouveau, à
   cinq grandeurs aussi.
7. **La place d'une page de suite ne change pas** (`nextPageFree`, 740 px) : elle est mesurée à 790 px, donc
   prudente de 50 px. La corriger ferait tenir deux rangs de plus par page, et changerait la coupe de toutes les
   attestations de plus de deux pages ; elle est laissée telle quelle.

**Conséquences.**

- **La correction des séances en cours n'est pas touchée** : ni formule, ni tolérance, ni texte. Ce qui change au
  déploiement, pour tout le monde : la page de l'attestation — sa mise en page à quatre ou cinq grandeurs et à plus de
  dix-neuf outils, et, par le point 6, une ou deux questions qui passent de la page 1 à la page 2.
- `site/js/ui/attestation-data.js` : `questionWidths` (les largeurs en vigueur), `linesIn` (le repli mot par mot),
  `paginateAttestation` (les deux tableaux, page par page ; remplace `paginateQuestions`), `tableTitles` (les titres
  des tableaux) ; `PAGE_LAYOUT` porte les largeurs resserrées et la hauteur des blocs de la page (en-tête du tableau
  par outil, note, titre et en-tête de la liste). `attestation-screen.js` ne fait que construire le DOM.
  `attestation.css` : les largeurs resserrées, sous la classe `attestation-questions--narrow` ; un test vérifie
  qu'elles sont celles de `PAGE_LAYOUT`.
- Les exercices à cinq grandeurs du lot (D84) donnent une attestation de **2 à 4 pages** (7 à 20 avant). Ils peuvent
  être publiés après la fusion et le déploiement de ce chantier (rapport `lot-exercices`, §4, geste 14).
- **La page de vérification (`/verifier`) n'est pas touchée** : elle montre les mêmes tableaux, en entier, sans page
  ni largeurs fixes, et ne prend pas les largeurs resserrées (`questionsTable(record, rows, narrow)` : elle ne passe
  pas `narrow`). Elle est identique à celle d'avant, image contre image. Ses propres défauts de repli, plus anciens
  que ce chantier, sont au rapport.
- UI §3.6 et §6 sont mis à jour : les largeurs, la règle des 100 px, le tableau par outil qui se poursuit, les
  constantes recalibrées, et la vérification du débordement — qui se fait **en mode impression**, ou en mesurant le
  pied de page, pas par `scrollHeight` à l'écran.

Rapport : `docs/rapports/attestation-cinq-grandeurs.md`.

## D86 — La limite de débit passe de 100 à 1000 valeurs distinctes par adresse et par heure (2026-10-03, décidée)

**Contexte.** D36 limite la consultation d'un matricule et la vérification d'un code à **100 valeurs distinctes par
adresse IP et par heure**, et un refus **verrouille l'adresse 10 minutes**. Le site est en essai réel dans les
classes, et tous les postes du cégep sortent par **une seule adresse IP** : la 101ᵉ identification d'une heure
verrouille tout le cégep 10 minutes — plus personne ne s'identifie, plus personne ne vérifie un code. Trois choses
rendent la borne de cent trop courte :

1. le cégep compte **au plus 500 étudiants inscrits** (la limite théorique, de Thierry), et plusieurs groupes peuvent
   se suivre dans la même heure ;
2. **un matricule mal tapé compte comme une valeur distincte** : le serveur ne distingue pas une faute de frappe d'une
   énumération, et chaque faute rapproche tout le cégep du verrou ;
3. le coût d'un verrou est **une classe arrêtée**, alors que ce qu'il protège est mince : la consultation révèle un
   prénom et une initiale (D23) ; la vérification, une attestation (D33), qu'il faudrait encore deviner parmi 30¹⁰
   codes.

Le diagnostic de production du 2026-10-03 (lecture seule) : la table `verrous` est vide — aucun verrou de débit n'a
jamais été posé (un verrou de débit ne s'efface que par l'effacement des données de D46, qui n'a jamais eu lieu) ; la
table `debit` n'a qu'une valeur, dans la tranche en cours. Les tranches passées étant effacées au fil de l'eau, le
plus haut compte jamais atteint ne se lit pas ; ce que la base garde de l'essai (19 séances, 13 matricules depuis le
2026-09-22 ; au plus 4 séances commencées dans une même heure) est très loin de cent.

**Décision.** `DISTINCT_PER_HOUR` passe de **100 à 1000** : au plus 1000 matricules ou codes distincts par adresse
et par heure ; la 1001ᵉ valeur est refusée (429) et verrouille l'adresse 10 minutes. Mille, c'est deux fois les 500
inscrits : la marge pour les fautes de frappe et les reprises. **Tout le reste de D36 tient** : aucune limite sur le
nombre de requêtes, une valeur déjà vue passe toujours, une valeur refusée n'est pas comptée comme vue, les compteurs
en D1 par tranche horaire UTC, le verrou de 10 minutes. **Une seule constante pour les deux portées**, consultation
et vérification : la vérification d'un code n'a pas de raison d'être plus serrée que la consultation, et deux
constantes seraient deux choses à régler et à oublier.

**Conséquences.**

- `worker/acces.js` : la constante et son commentaire ; `worker/index.js` : le commentaire de `limitRate` ; SPEC §7.
  Aucune migration : la table `debit` compte des lignes, la limite est dans le code.
- Les tests dérivent de la constante au lieu d'un nombre écrit en dur : `tests/worker-acces.test.js` (sa valeur, le
  seul endroit où le nombre est écrit), `tests/worker-api.test.js` (le test de consultation et celui des codes — le
  refus de la valeur de trop, le verrou de 10 minutes, la valeur déjà vue qui passe, l'autre adresse non touchée,
  l'heure suivante qui repart).
- **La correction des séances en cours n'est pas touchée.** Le code change pour tout le monde au déploiement : une
  adresse peut consulter dix fois plus de matricules distincts par heure avant d'être verrouillée.
- Un robot qui essaie des milliers de matricules est arrêté à mille, pas à cent : à mille par heure, les dix millions
  de matricules à sept chiffres demandent plus d'un an, et chaque heure n'en révèle que des prénoms et des initiales ;
  les codes d'attestation (30¹⁰ possibles) restent hors de portée.

Rapport : `docs/rapports/limite-debit.md`.

## D87 — Revenir à l'accueil depuis n'importe quelle page : le logo et le titre de l'en-tête en lien, et des liens de retour sur les écrans qui n'en avaient pas (2026-10-03, décidée)

**Contexte.** Le constat de Thierry, relevé dans le code de `main` (`e8738bc`) : le logo du cégep et le titre de
l'en-tête ne sont des liens sur aucune page, et plusieurs écrans n'ont **aucun chemin vers l'accueil** — l'identification
1 / 2 ; l'identification 2 / 2 (seulement vers le 1 / 2) ; « Le quiz n'a pas pu démarrer » ; `/verifier` ;
`/tables?version=` ; `/prof` (connexion et tableau) ; `/prof/editeur` (sa connexion n'a même pas de lien vers `/prof`).
Depuis les écrans de la séance (Question, Attestation), l'accueil est à deux clics (« Quitter » ou « Terminer », puis
« ← Tous les exercices » de la page de l'exercice, D71). Cas vécu : après « Se déconnecter » de l'espace professeur,
il n'y a aucun moyen d'aller essayer un exercice comme un étudiant, sinon retaper l'adresse. UI §3.2 disait même, pour
les écrans d'identification : « Il n'y a pas de lien « ← Retour » vers l'accueil sur ces écrans ».

**Décision.**

1. **Le logo du cégep et le titre de l'en-tête forment un seul lien vers l'accueil** (`/`), sur les cinq pages :
   `index.html`, `prof.html`, `prof/editeur.html`, `tables.html`, `verifier.html`. Son nom accessible est
   **« Accueil — tous les exercices »** (`aria-label`, et le même texte en `title`, l'indice au survol de la souris).
   **Apparence inchangée au repos** : pas de soulignement, la couleur du texte ; au survol, le titre passe au bleu clair
   des liens ; au clavier, le contour de focus commun à toute la page (`:focus-visible`). `showScreen` ne remplace que
   le **texte** de `#header-title` : le lien survit à chaque changement d'écran (un test le vérifie).
2. **Ce lien est une simple navigation**, comme « ← Tous les exercices » (D71) : il ne crée, ne modifie ni n'efface
   aucune séance, ni sur le serveur ni dans le navigateur ; **le jeton gardé reste**. Un étudiant qui quitte ainsi une
   question en cours et revient par l'accueil, puis la page de son exercice et « Reprendre, <prénom> », **retrouve la
   même question** : le serveur la mémorise et la rend telle quelle tant qu'elle n'est pas corrigée (`POST
   /api/question`, SPEC §7 : « on ne passe pas une question »), **sans nouveau tirage et sans rien de compté** — seule
   une correction (`POST /api/correction`) change les compteurs. **La saisie non vérifiée est perdue**, comme avec
   « Quitter » : elle n'existait que dans la page.
3. **Gestion du contenu : le lien respecte la protection des modifications non enregistrées.** Un clic sur un lien de
   la barre du haut — le logo, et aussi **« Espace professeur »**, qui quittait la page sans rien demander — avec
   `state.dirty` (le brouillon d'un exercice, d'un outil ou des tables, **ou un panneau « Présentation » non appliqué**,
   que `syncDirty` compte déjà) pose **la même confirmation que `leave()`** (« Des modifications ne sont pas
   enregistrées. Quitter la page et les perdre ? ») ; confirmée, `state.dirty` passe à faux et la navigation suit, sans
   seconde question ; refusée, le clic est annulé. Un clic qui ouvre un autre onglet (Ctrl, Maj ou ⌘) ne quitte pas la
   page : rien n'est demandé. **Le `beforeunload` existant reste**, filet pour ce que la page ne contrôle pas (bouton
   Précédent, onglet fermé, adresse retapée). Il ne suffisait pas seul : son texte est celui du navigateur, dans sa
   langue, pas celui de la page ; Chrome ne le montre qu'après une interaction avec la page, et Safari sur iPhone ne le
   montre jamais. Le plus sûr, c'est les deux.
4. **Identification 1 / 2 : le lien « ← Page de l'exercice »** sous le formulaire, qui ramène à la page de l'exercice
   (`showHome`) sans rien toucher — ni le jeton, ni le serveur. Il **remplace la règle de UI §3.2** « Il n'y a pas de
   lien « ← Retour » vers l'accueil sur ces écrans ». Les écrans 2 / 2 gardent « Ce n'est pas moi » et « Mauvais
   matricule » (vers le 1 / 2, qui a maintenant le lien) ; « Corriger mon identité » garde « Annuler ». Le logo, en
   plus, mène à l'accueil depuis les quatre écrans.
5. **Espace professeur : sur l'écran de connexion de `/prof`** (donc aussi après « Se déconnecter »), un lien visible
   **« ← Tous les exercices »** vers l'accueil, en plus du logo. **Sur la connexion de `/prof/editeur`** : **« ← Espace
   professeur »** (`/prof`) et **« ← Tous les exercices »** (`/`). Rien ne change aux deux clés ni aux rôles (D44).
6. **« Le quiz n'a pas pu démarrer » : « ← Tous les exercices »** sous le message, vers l'accueil (`location.pathname`,
   comme le lien de D71).
7. **Ne sont pas touchés** : les couleurs des tables (D61), le bouton d'effacement des données (D46), la correction,
   l'attestation. **Rien de tout cela ne s'imprime** : l'en-tête est `no-print` ; vérifié sur l'attestation et sur
   `/tables` en mode impression.
8. Le libellé **« ← Tous les exercices »** est le même partout où un lien y ramène (`HOME_LINK_LABEL`, `text.js`), et
   le nom du lien de l'en-tête est `HEADER_LINK_NAME` : un test vérifie que les cinq pages le portent.

**Conséquences.**

- `site/index.html`, `prof.html`, `prof/editeur.html`, `tables.html`, `verifier.html` : le `<div class="app-brand">`
  devient un `<a class="app-brand" href="/" aria-label title>` ; `app.css` : `.app-brand` garde sa mise en page, prend
  `color: inherit` et `text-decoration: none`, et son survol colore le titre ; `.form-links` devient une rangée (deux
  liens sur la connexion de la Gestion du contenu).
- `site/js/ui/text.js` : `HOME_LINK_LABEL`, `HEADER_LINK_NAME` ; `home-screen.js` : le lien de D71 prend le libellé
  commun, « Le quiz n'a pas pu démarrer » reçoit le sien ; `identification-screen.js` : `renderMatricule` reçoit
  `onHome` et montre « ← Page de l'exercice » ; `main.js` : `onHome: showHome`.
- `prof-data.js` et `editeur-data.js` : `LOGIN_LINKS`, les liens de chaque écran de connexion (purs, testés) ;
  `editeur-data.js` : `LEAVE_CONFIRMATION` (le texte de `leave()`, qui le partage) et `confirmsBeforeLeaving(dirty,
  touches)` ; `editeur.js` : une écoute des clics sur les liens de la barre du haut.
- Tests : `tests/ui-navigation.test.js` — le lien de l'en-tête sur chaque page, `showScreen` qui le garde, le lien de
  l'identification 1 / 2 (il appelle `onHome` et ne touche pas au jeton), les liens des deux écrans de connexion, la
  règle de confirmation. Les écrans se testent sur un **DOM minuscule écrit pour les tests** (`tests/aide-dom.js` :
  éléments, attributs, écouteurs, `querySelector` simple), sans dépendance (D3) : c'est le DOM construit qu'on regarde,
  pas le code qui le construit.
- **La correction des séances en cours n'est pas touchée** : aucun fichier de `worker/`, aucune migration. Au
  déploiement, l'en-tête change pour tout le monde (un lien à la place d'un bloc inerte) ; une séance en cours n'en est
  pas affectée.
- Documents : UI §1 (la nouvelle sous-section « Barre du haut »), §2, §3.1, §3.2, §3.7, §3.8, §3.9 ; PLAN ; rapport
  `docs/rapports/navigation-accueil.md`, avec le tableau « écran → chemin vers l'accueil, nombre de clics », avant et après.
