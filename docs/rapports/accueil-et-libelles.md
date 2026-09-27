# Rapport — accueil et libellés (décisions D71 à D73)

Session du 2026-09-27, branche `accueil-et-libelles` (partie de `main` après la fusion d'`avances`). Six éléments
tirés du remue-méninges de Thierry : libellés et unités, virgule décimale, accueil unique, bouton retour, page de
description d'un exercice, nouvelle adresse.

## 0. Avant de commencer : les fusions

- `jalon-7b-editeur`, `images-copeaux` (et `legende-chaleur`) : déjà dans `main`.
- `avances` n'était **pas** fusionnée : 16 commits absents de `main`. Je me suis arrêté et je te l'ai signalé.
- Tu l'as fusionnée en avance rapide (`b4b75d0`). J'ai vérifié que `main` la contenait avant de créer la branche.

## 1. Libellés et unités

**Ce qui a été fait.**

- **Les rétroactions nomment chaque grandeur en toutes lettres**, et mettent l'unité après chaque valeur. Ton
  exemple sort mot pour mot (test, et vu dans Chrome) : « Le compteur de Barre à aléser retombe à zéro (1 → 0). Ta
  vitesse de rotation de 3200 tr/min est à +6.7 % de 3000 tr/min (tolérance : ±5 % et ±1 tr/min). »
- Avec les autres grandeurs :
  - « Ton avance par dent de 0.004 po/dent est à +33.3 % de 0.0030 po/dent … » (« ton » devant une voyelle) ;
  - « Ta vitesse d'avance de 13.2 po/min … » ;
  - « Vitesse de rotation : réponse vide ou illisible (attendu 905 tr/min). »
- **La note d'un champ juste dont la valeur vient de tes saisies** (le complément de D70 d'hier) suit la même
  règle : « Juste (0.000284 = ton avance par dent × 2) » et « Juste (3048.000 = ta vitesse de rotation × ton avance
  totale par révolution) ».
- **« tr/min » partout**, et plus aucun « RPM » ni « rév/min » affiché :
  - libellé de saisie : « Vitesse de rotation (N, tr/min) » ;
  - panneau de l'outil : « Vitesse de rotation max de la machine : 3000 tr/min », et « — pour la vitesse de
    rotation » pour la barre à aléser ;
  - l'aide de N, la feuille des formules et les tolérances ;
  - la colonne « N (tr/min) » de l'attestation et de `/verifier` ;
  - l'éditeur (« Vitesse de rotation (N) », « Vitesse de rotation max de la machine », avertissements, aperçu) ;
  - SPEC, UI et CLAUDE.md.
- Le point reste le séparateur affiché.

**Décisions prises (D71).**

- **Les formules gardent leurs symboles**, comme la feuille des formules : la ligne de calcul (« N = Vc × 4 / Ø =
  100 × 4 / 0.238 »), la tolérance écrite en formule (« ±0.5 % de N × f », « ±0.1 % de fz × dents ») et les aides
  (« N = Vc × 4 / Ø »). Seule la grandeur *dont on parle* est écrite en toutes lettres.
- Les **identifiants** ne changent pas (`rpm`, `limite_rpm`, l'exercice `m10-tournage-vc-rpm`).
- **Les attestations déjà émises** s'affichent aussi avec « N (tr/min) ». L'unité ne fait pas partie de
  l'enregistrement signé, donc les signatures sont intactes.
- **Le titre « M10 — Tournage : Vc et RPM »** est une donnée de production : il faut le renommer dans l'éditeur (voir
  « Ce qu'il te reste à faire »). La semence du dépôt garde l'ancien titre, et les tests s'appuient dessus.

## 2. Virgule décimale

**Ce qui a été fait.**

- Une virgule tapée devient un point, **à l'écran**, à deux moments :
  - à la **sortie du champ** ;
  - à la **validation** : Vérifier, ou Entrée, qui ne fait pas quitter la case.
- **Jamais pendant la frappe** : le curseur ne saute pas.
- Portée :
  - les cinq cases du quiz ;
  - tous les champs décimaux de l'éditeur (formulaire d'outil, Vc et avances des tables) ;
  - dans la zone des dimensions et des barres, **la valeur après « ; » seulement** : « Ø 1,5 mm ; 0,059 » devient
    « Ø 1,5 mm ; 0.059 », et le libellé reste tel quel.
- L'espace professeur (`/prof`) n'a **aucun champ décimal** : il n'y avait rien à convertir.
- Le serveur continue de lire la virgule (D10) : la conversion ne fait que changer l'affichage.

**Vérifié au vrai clavier** (frappe simulée touche par touche), dans un Chrome réglé en **fr-CA** :

- « 0,15 » reste « 0,15 » pendant la frappe, curseur au bout, puis devient « 0.15 » à Tab.
- Les cinq bonnes réponses tapées avec des virgules puis **Entrée** dans la dernière case : les cinq cases
  affichent le point, et la question est jugée juste.
- Dans l'éditeur : « 0,5 » devient « 0.5 » à la sortie du champ.

**Pourquoi jamais `type="number"`.** Aucun champ décimal du site ne l'est (vérifié), et c'est voulu. Dans le même
Chrome, un champ `type="number"` rend « 0,15 » en **français**, mais « **015** » en **anglais** : la virgule disparaît
sans prévenir. C'est exactement la perte que tu craignais. Nos champs sont des champs texte avec clavier numérique
(`inputmode="decimal"`), qui gardent ce qui est tapé.

## 3. Page d'accueil unique

**Ce qui a été fait.**

- **`/`** (sans `?exercice=`) montre « Quel exercice fais-tu ? » :
  - les exercices **publiés, non archivés et proposés à l'accueil**, **regroupés par cours** dans l'ordre de la
    liste de l'éditeur ;
  - sous chaque titre, « 9 outils · champ évalué : vitesse de coupe » ;
  - les exercices sans cours, en dernier, sous « Autres exercices ». S'il n'y a aucun cours, une seule liste sans
    intertitre, comme avant.
- **Une seule porte professeur**, le lien **Espace professeur** (`/prof`). La clé saisie décide de ce qu'on voit :
  - ta clé : tout, avec le lien vers l'éditeur ;
  - `CLE_CONSULTATION` : les réussites en lecture seule.

  L'éditeur (`/prof/editeur`) garde sa propre connexion, réservée à ta clé ; c'est le même cookie.
- Un lien inconnu garde son avis (« L'exercice « … » n'existe pas — vérifie le lien sur Léa »), au-dessus de la
  même liste.
- **Le lien direct `?exercice=<id>` marche toujours** et mène à la page de description (élément 5).
- **Champ « Cours »** dans l'éditeur, à côté du titre :
  - facultatif, 30 caractères au plus ;
  - **publié avec la version**, comme le titre ;
  - l'éditeur propose, à la frappe, les cours déjà utilisés par les autres exercices ;
  - une colonne **Cours** s'ajoute dans la liste des exercices ;
  - la publication montre la différence : « Cours : « — » → « M10 » ».
- **M10 / m10 / M-10 ne font jamais trois groupes.** L'accueil regroupe par une clé sans casse, accents, espaces ni
  ponctuation, et affiche l'écriture du premier exercice. Dans l'éditeur, taper « m10 » quand un autre exercice a
  « M10 » fait paraître un conseil doré, « Même cours que « M10 », écrit autrement dans un autre exercice », avec
  un bouton **Écrire « M10 »**.

**Décision prise.** Un **conseil avec un bouton**, et non un remplacement d'office. Un remplacement automatique
t'empêcherait de changer un jour l'écriture d'un cours : chaque essai reprendrait l'ancienne écriture d'un autre
exercice. Comme l'accueil regroupe de toute façon par la clé, il n'y a pas de risque de doublon.

## 4. Bouton retour

- **« ← Tous les exercices »** en haut de la page d'un exercice.
- C'est un simple lien vers l'accueil : aucun appel au serveur, rien d'effacé dans le navigateur.
- **Vérifié dans Chrome**, après avoir commencé une séance puis être revenu à l'accueil :
  - le jeton gardé est identique ;
  - la séance du serveur a la même question et la même progression ;
  - « Reprendre, Camille » ramène à la même question.

**Défaut trouvé et corrigé en passant (D71, point 7).** Le navigateur ne garde qu'un jeton. Avant, ouvrir la page d'un
*autre* exercice proposait « Reprendre, Camille » avec le jeton du premier : le serveur le refusait, et le jeton
était oublié. Avec l'accueil et le bouton retour, ce cas serait devenu courant.

Désormais, le jeton gardé **nomme son exercice** :

- « Reprendre » n'est offert que sur la page de cet exercice ;
- ailleurs, la page propose « Commencer ou reprendre », et le jeton n'est ni essayé ni effacé (vérifié) ;
- un jeton gardé avant cette version, sans exercice, se comporte comme avant.

## 5. Page de description d'un exercice

**Ce qui a été fait.** La page `?exercice=<id>` garde tout ce qu'avait l'accueil d'un exercice : titre, version,
résumé, Commencer / Reprendre, avis d'archivage. Elle ajoute :

- le **cours** en surtitre (« M10 · exercice ») ;
- le bouton **Copier le lien**, accessible sans connexion. Le lien va dans le presse-papiers. Si le navigateur
  refuse, le lien s'affiche, sélectionné, à copier à la main. Les deux cas ont été vus dans Chrome ;
- **les questions posées** : « À trouver : vitesse de coupe (Vc) et vitesse de rotation (N). », « Fournies par
  l'exercice : … », « Non demandées : … » ;
- **les outils questionnés** : photo, nom tel que la progression l'écrit (« SDTMR (métrique) »), plage de
  dimensions, opération et son pictogramme, matières d'outil permises, « 3 réussites de suite » ;
- **les matériaux usinés possibles**, une ligne par classe ISO avec la lettre sur sa couleur : « P — Acier : Acier
  non allié, … ».

Tout est composé dans le navigateur à partir de ce que le serveur publiait déjà (`GET /api/exercice`). Rien de ce
qui est à trouver n'y est, ni Vc ni avance de la table : un test le vérifie.

**Doublon de nom (5.4).** À la publication, le panneau de confirmation signale **en rouge**, sans bloquer, un autre
exercice publié et non archivé qui porte le même titre, sans tenir compte de la casse, des accents ni des espaces.
Il le nomme : « Un autre exercice publié porte déjà ce titre : « … » (id). Les étudiants reconnaissent un exercice à
son titre : change l'un des deux. » Vu dans Chrome avec une copie du M10.

**Décision prise.** Les grandeurs demandées sont réglées **pour tout l'exercice** (D52) : elles sont donc les mêmes
pour chaque outil. La page les dit une fois, sous « Questions posées pour chaque outil », plutôt que de répéter la
même ligne sur les neuf outils.

## 6. Nouvelle adresse : `quiz-parametres-coupe.tgm-tmi.workers.dev`

Le renommage du Worker, prévu d'abord (D72), est introuvable dans le tableau de bord. **Le Worker garde son nom**, et
seul le sous-domaine du compte change (D73, voir « Suites données » plus bas).

**Ce qui a été fait (D72, D73).**

- `wrangler.jsonc` garde le nom de production, **`quiz-parametres-coupe`**, avec un commentaire : ce nom ne se change
  pas. La fusion redéploie donc **le Worker existant**, avec ses trois secrets et sa liaison D1. `deploy.yml` est
  identique à celui de `main`.
- **Aucune adresse n'est écrite dans le code** (vérifié, et un test le garde) :
  - le QR prend l'origine de la requête (D33) ;
  - l'attestation affiche l'adresse de la page ;
  - « Copier le lien » et « Copier le lien étudiant » partent de la page ouverte.

  Tout suit donc la nouvelle adresse sans autre changement. Seuls `DEMARRAGE.md` et des exemples de tests la
  nomment.
- **Ce qui ne doit pas changer, et ne change pas** (un test le garde) :
  - le **sel de la cryptographie** (`quiz-parametres-coupe` dans `worker/crypto.js`). Le changer rendrait tous les
    NIP méconnaissables et toutes les attestations « signature invalide » ;
  - la clé du stockage local ;
  - le format d'export.
- Un test simule le déménagement : une attestation émise sous l'ancienne adresse se vérifie sous la nouvelle, par
  son **code** comme par **l'adresse entière de son QR collée**, et la séance se reprend. Avec une autre
  `CLE_SECRETE`, rien ne passe.
- Le jeton d'API de GitHub vaut pour tout le compte : rien à changer.

### Marche à suivre, pas à pas

(Même texte dans `DEMARRAGE.md` §4.) Le sous-domaine se change pour tout le compte, sans redéploiement. Le Worker
reste le même : aucun secret à reposer.

**Avant de commencer.**

- Choisis un moment sans cours en marche. Au changement de sous-domaine, le site ne répond pas pendant quelques
  minutes, puis les étudiants se réidentifient.
- Note le **code d'une attestation déjà émise** (espace professeur, colonne Attestation). Il servira aux
  vérifications.

**Étape 1 — Fusionner cette branche.** Fusionne `accueil-et-libelles` sur GitHub. Dans *Actions*, le flux *deploy*
doit finir en vert : tests, migrations, puis déploiement du Worker `quiz-parametres-coupe`, le même qu'avant.
L'adresse ne change pas encore.

**Étape 2 — Vérifier sur l'adresse actuelle**, `https://quiz-parametres-coupe.thierryleroux.workers.dev` :

- `…/api/version` répond ;
- la nouvelle page d'accueil montre les exercices ;
- `…/prof` accepte ta clé ;
- `…/verifier` dit « Attestation valide » pour le code noté.

**Étape 3 — Changer le sous-domaine du compte.**

1. Va sur https://dash.cloudflare.com → *Compute* → *Workers & Pages*, page d'ensemble. Dans l'encadré **Account
   details**, à droite, clique le crayon (ou *Change*) à côté de *Subdomain* `thierryleroux.workers.dev`.
2. Tape **`tgm-tmi`**, puis confirme. La mise en garde dit que tous les Workers du compte changent d'adresse : c'est
   voulu.
3. Si le nom est pris, essaie **`tgmtmi`**, puis **`tgm-tmi-usinage`**. Permis : minuscules, chiffres et traits
   d'union, jamais au début ni à la fin. Il n'y a pas de vérification préalable : la boîte le dit à la
   confirmation.
4. Attends quelques minutes, sans ouvrir la nouvelle adresse avant la confirmation (le navigateur retiendrait un
   « introuvable »).

**Étape 4 — Vérifier sur `https://quiz-parametres-coupe.tgm-tmi.workers.dev`** (ou le sous-domaine retenu) : les
mêmes quatre vérifications qu'à l'étape 2. Si l'adresse ne répond pas après une trentaine de minutes, regarde
https://www.cloudflarestatus.com avant de toucher à quoi que ce soit.

**Étape 5 — Remplacer les liens.**

- Sur Léa, chaque `https://quiz-parametres-coupe.thierryleroux.workers.dev/?exercice=<id>` devient
  `https://quiz-parametres-coupe.tgm-tmi.workers.dev/?exercice=<id>`. **Copier le lien** (page de l'exercice) ou
  **Copier le lien étudiant** (éditeur) donne le bon.
- Mets à jour tes favoris.

### Ce qui cessera de fonctionner

- **L'ancienne adresse** ne répondra plus, sans redirection possible. D'après des cas rapportés (la documentation de
  Cloudflare n'en dit rien), un ancien sous-domaine ne répond plus du tout, aussitôt.
- **Les liens sur Léa** sont à remplacer (étape 5).
- **Le QR des attestations déjà remises** ne s'ouvre plus, et la ligne imprimée « Vérification :
  quiz-parametres-coupe.thierryleroux.workers.dev/verifier — code … » nomme l'ancienne adresse.
- **Le jeton gardé des étudiants et ton cookie professeur** : le navigateur change d'origine, il les perd. Les
  étudiants se réidentifient (matricule et NIP ; leur progression est gardée), et tu te reconnectes.

### Ce qui reste valide

- **Chaque attestation** :
  - par son **code**, saisi sur `https://quiz-parametres-coupe.tgm-tmi.workers.dev/verifier` ;
  - ou par l'**adresse entière de son QR collée** dans le même champ, puisque la vérification ne regarde pas l'hôte
    (testé).
- **Les données signées du QR** restent lisibles hors ligne par n'importe quel lecteur de QR : nom, matricule,
  exercice, date, nombre de questions, code.
- **Toutes les séances, les NIP, les exercices, la banque, les tables et les images** : même Worker, même base, même
  secret.
- Les attestations émises **après** le déménagement portent la nouvelle adresse dans leur QR, automatiquement.

## Tests

- `npm test` : **608 réussis, 0 échec** (588 au départ).
- Nouveaux fichiers de tests : `tests/ui-home.test.js` (accueil par cours, page de description, rien de ce qui est
  à trouver).
- Tests ajoutés dans les fichiers existants :
  - libellés en toutes lettres et unités ;
  - virgule ;
  - cours : format, validation, API, publication, export ;
  - jeton par exercice ;
  - doublon de titre ;
  - nom du Worker (celui de production) et de la base ; aucune adresse dans le code ; sel inchangé ;
  - attestation vérifiée après le déménagement.
- `npm run test:api` : **31 étapes réussies** sur `wrangler dev` et une vraie D1 locale (relancé après D73, avec le
  nom de production).
- **Chrome** (fr-CA, 1280 et 390 px), sur une base jetable avec des cours posés par l'API, dont un « m-10 » pour
  vérifier le regroupement : **44 vérifications sur 44**.
  - Aucune requête hors du site, aucune exception.
  - En console, seulement les deux 401 attendus des pages professeur avant connexion.
  - Captures dans `captures/accueil-et-libelles/` (non versionnées) : accueil et description à 1280 et 390 px,
    question, rétroaction, virgule à 390 px, `/verifier`, éditeur (liste, cours, doublon).
- **Défaut vu dans les captures et corrigé** : des photos d'outils sortaient en carrés blancs, à cause du chargement
  différé des images. Il est retiré, et une photo qui manque ne laisse plus de cadre blanc.

## Ce qu'il te reste à faire

1. **Cloudflare**, dans l'ordre ci-dessus : fusionner, vérifier, changer le sous-domaine, vérifier, puis les liens
   de Léa.
2. **Dans l'éditeur, en production** :
   - mettre le cours **« M10 »** aux deux M10 et les **publier**. Les versions semées n'ont pas de cours : d'ici là,
     ils sont sous « Autres exercices ». Cela crée une version 2 de chacun ; les séances en cours gardent la leur ;
   - **renommer** « M10 — Tournage : Vc et RPM » (par exemple « M10 — Tournage : Vc et vitesse de rotation ») et
     publier.

## Points douteux à trancher

1. **Formules en symboles.** J'ai gardé les symboles dans la ligne de calcul, dans la tolérance écrite en formule
   (« ±0.5 % de N × f ») et dans les aides. Veux-tu aussi celles-là en toutes lettres ? Elles deviendraient longues :
   « ±0.5 % de ta vitesse de rotation × ton avance totale par révolution ».
2. **Longueur des notes de cohérence.** « Juste (3048.000 = ta vitesse de rotation × ton avance totale par
   révolution) » tient sur trois ou quatre lignes sous la case. Faut-il une forme plus courte (« … × ton avance par
   révolution ») ?
3. **Doublon de titre : avertir ou bloquer ?** « Signale » m'a fait choisir un avertissement rouge qui ne bloque pas.
   Un blocage est facile à ajouter, côté écran et côté serveur.
4. **Cours : conseil ou remplacement ?** J'ai choisi le conseil (voir l'élément 3). Si tu préfères qu'une autre
   écriture soit remplacée d'office, c'est une ligne à changer.
5. **Un seul jeton gardé.** Commencer l'exercice B sur un appareil fait oublier *localement* le jeton de l'exercice A.
   La séance A reste intacte sur le serveur et se reprend par matricule et NIP. Garder un jeton par exercice est
   possible si les étudiants alternent souvent entre deux exercices sur le même appareil.
6. **L'ancien sous-domaine `thierryleroux`.** La documentation ne dit pas s'il redevient libre. Si quelqu'un le
   prenait, il pourrait servir une page aux anciennes adresses des QR. Le risque est faible, mais un QR ancien
   scanné pourrait alors mener ailleurs. Cloudflare recommande d'ailleurs un domaine à soi pour un site en
   production : une adresse qui ne changerait plus jamais, QR compris. Ce domaine serait payant ; à voir, pas
   urgent.
7. ~~**Emplacement du renommage dans le tableau de bord.**~~ Tranché (D73) : pas de renommage, le Worker garde son
   nom.

## Suites données

**Réponse de Thierry (2026-09-27), élément 6.** Le renommage du Worker est introuvable dans le tableau de bord. Le
Worker n'est donc pas renommé ; seul le sous-domaine change. Adresse cible :
`quiz-parametres-coupe.tgm-tmi.workers.dev`. Pas de plan B, aucun secret à reposer. Devenu la décision **D73**, qui
remplace D72 pour le nom du Worker, l'adresse et la procédure.

- `wrangler.jsonc` reprend le nom de production, `quiz-parametres-coupe`. Par rapport à `main`, il ne diffère que
  par un commentaire ; `deploy.yml` est identique à celui de `main`.
- Tests :
  - celui du nom du Worker attend maintenant le nom de production ;
  - les adresses d'exemple sont passées à `quiz-parametres-coupe.tgm-tmi.workers.dev` ;
  - sont gardés : aucune adresse dans le code, le sel inchangé, l'attestation vérifiée après le déménagement.
- `DEMARRAGE.md` §4 et la section 6 ci-dessus : l'étape de renommage et le plan B sont retirés. La procédure est
  courte : fusionner, vérifier, changer le sous-domaine, vérifier, remplacer les liens de Léa. La nouvelle adresse
  est écrite partout.
- Éléments 1 à 5 : inchangés.
- `npm test` : 608 réussis, 0 échec. `npm run test:api` : 31 étapes réussies.
- **La fusion est sans risque.** Elle redéploie le même Worker, avec ses secrets. Elle n'ajoute aucune migration.
  Les versions déjà publiées, sans cours, restent valides, et un jeton gardé d'avant se comporte comme avant.
