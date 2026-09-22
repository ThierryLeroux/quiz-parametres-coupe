# Spécification fonctionnelle — Quiz de paramètres de coupe (version web)

Statut : **brouillon v0.4** (2026-09-21). Rédigée à partir de l'analyse du classeur
`Exercice M10 - tournage - vc seulement - version étudiant_r0.xlsm` et de son VBA
(voir `legacy/vba/`). Un point marqué ❓ est à confirmer avec Thierry ; il n'y en a aucun en ce moment.

## 1. Objectif

Exerciseur auto-corrigé où l'étudiant calcule les paramètres de coupe d'une
opération d'usinage tirée au hasard (outil × dimension × matériau brut), jusqu'à
démontrer la maîtrise de chaque type d'outil. À la réussite, un **rapport** est
produit, que l'étudiant enregistre en PDF et remet sur Léa ; il porte un
**QR code** de vérification pour l'enseignant (décision D16). Les questions
sont tirées et corrigées par un **serveur de correction**, qui signe la
réussite (décision D19, §7).

Public : étudiants du Cégep du Vieux Montréal, Techniques de génie mécanique
(profil fabrication) et Techniques de génie de la maintenance industrielle.

## 2. Portée de la version 1 (décision D2)

Tournage, fraisage et perçage complets : les 29 outils et 19 opérations du
classeur, et les 5 paramètres demandés (Vc, avance par dent, N, avance par
révolution, vitesse d'avance). La configuration d'un exercice (quels outils,
combien de réussites, quels champs pré-remplis) doit permettre de reproduire le
M10 actuel (« Vc seulement, tournage ») comme simple cas particulier (§10).

Un **éditeur web statique** du catalogue et des exercices fait aussi partie de
la v1 (décision D11) : il produit des JSON à télécharger, que l'enseignant
dépose dans le dépôt et commet. Il n'écrit rien en ligne.

## 3. Données de référence (`site/data/`)

Les JSON vivent dans `site/data/`, en un seul exemplaire publié avec le site
(décision D8) ; les tests les lisent au même endroit.

| Fichier | Contenu | Source Excel |
|---|---|---|
| `materiaux.json` | `revision` de la table ; 47 matériaux, classes ISO 513 P/M/K/N/S/H/O, groupe VDI 3323, dureté, exemple AISI/SAE, **Vc (pi/min)** pour 3 matériaux d'outil, `debut_famille` | `Vitesses de coupe` / `tblVitesse` |
| `operations.json` | `revision` de la table ; 19 opérations : machine, direction d'avance, avance/rév., avance max, drapeaux *filetage* et *proportionnelle au Ø* | `Avances d'usinage` / `tblAvance` |
| `outils.json` | 29 outils : gabarit de nom (`format_identifiant`, §4.6), opération, facteurs Vc/avance, limites RPM/avance, plage de nb de dents, matériaux d'outil possibles, groupes ISO usinables, liste des dimensions (libellé + valeur) ; pour un outil à deux diamètres, `dimensions_barre` et `rapport_barre_max` | `Liste d'outils` (masquée) |

Unités : **impériales** (pouces, pi/min, rév/min, po/min). Les dimensions
métriques sont déjà converties en pouces dans `outils.json` ; le libellé affiché
reste métrique (ex. « 10 mm »).

**Révision des tables (décision D28).** `materiaux.json` et `operations.json`
portent chacun une clé `revision` (texte non vide, ex. « A2026_r0 »), affichée au
pied de la feuille de référence correspondante, comme « révision H2025_r0 » au
pied des feuilles du classeur. C'est la révision **des tables** ; la version d'un
exercice est dans l'exercice (§10). `loadData` la rend dans `revisions`.

**Familles de matériaux (décision D27).** `debut_famille: true` sur un matériau
= un trait fin au-dessus de sa ligne dans la feuille des vitesses de coupe : il
marque un changement de **matériau usiné** (compositions et états d'un même
matériau restent ensemble ; plastiques et graphite, groupes 42 à 47, forment une
seule famille). Booléen facultatif, **donnée et non calcul** : l'éditeur peut le
changer. Il ne sert qu'à la feuille ; il n'entre pas dans la question tirée.

**Outil à deux diamètres (décision D25).** Pour la barre à aléser et la barre
à rainurer, `dimensions` est le **Ø usiné** (le trou : alésé, rainuré), qui sert
à N, et `dimensions_barre` (libellé + Ø en pouces) le **Ø de la barre**, qui
sert à l'avance proportionnelle (§5).
`rapport_barre_max` (> 0 et ≤ 1, ex. 0,75) dit quelles barres entrent dans un
trou : Ø barre ≤ rapport × Ø alésé. Les deux clés vont ensemble, ne sont permises
que sur une opération à avance proportionnelle au Ø, et le catalogue est refusé
si une dimension n'a aucune barre qui y entre. Valeurs : barres de 1/2, 5/8,
3/4, 1 et 1 1/4 po, rapport 0,75 (confirmées, D30). Le rainurage interne est
une avance proportionnelle (0,003 × Ø barre, plafond 0,003 po/tour), comme
l'alésage à la barre (D25, extension). Aucun autre outil n'a deux diamètres à
distinguer.

Le champ `note` des opérations a été supprimé (D29) : il contredisait la table
(« .008 × Ø 1/4 = .002 ») et n'était plus affiché ; l'encadré de la feuille des
avances est calculé depuis les avances.

Champ `limite_avance` de `outils.json` : présent dans le classeur, **non utilisé
par le moteur** (ni par le VBA). Le seul plafond d'avance est
`avance_max_po_rev` de l'opération (§5).

Groupes « O - Plastique renforci d'aramid » et « O - Graphite » : **volontairement** attachés à aucun outil (jugés trop rares pour les étudiants) ; ils restent au catalogue pour pouvoir l'être plus tard.

Les images d'outils sont dans `site/img/outils/<id>.png` ; le champ `image` du
catalogue n'est pas encore utilisé.

## 4. Génération d'une question

1. **Outil** : tirage uniforme parmi les outils *encore à évaluer* de l'exercice (voir §7 et §10). Les restrictions de l'exercice (dimensions, matériaux d'outil, groupes) s'appliquent aux tirages 3, 4 et 5.
2. **Nombre de dents** : entier uniforme dans `[nb_dents_min, nb_dents_max]`.
3. **Dimension** : tirage uniforme dans `dimensions[]` de l'outil. Pour un outil à deux diamètres (§3, D25), un **7e tirage**, le dernier, choisit ensuite la barre, uniformément parmi celles qui entrent dans le trou tiré.
   - Outil de filetage : libellé du type `Ø-filets/po` (impérial : `0.25-20` → Ø 0,25 po, pas = 1/20 po) ou `ØxPas` mm (métrique : `10x1.5` → Ø 10/25,4 po, pas = 1,5/25,4 po).
   - Sinon : Ø en pouces.
4. **Matériau d'outil** : tirage uniforme dans `materiaux_outil[]`.
5. **Matériau brut** : tirage d'un *groupe* dans `groupes_materiaux_usinables[]`, puis tirage uniforme d'un matériau de ce groupe dans `materiaux.json`.
6. **Nom affiché — gabarit de nomenclature (décision D24)** : chaque outil porte dans `format_identifiant` le gabarit de la ligne 4 (`IdFormat`) de « Liste d'outils », même syntaxe : des jetons entre crochets, remplacés par les valeurs tirées. Ex. : « Foret [IdDia] », « Alésoir [IdDia] - [NbDent] lèvres », « MCLNR - Ø charioté: [IdDia] », « Barre à aléser Ø [IdBarre] - Ø alésé: [IdDia] ». Liste officielle (`TEMPLATE_TOKENS`, `site/js/data.js`) :

   | Jeton | Remplacé par |
   |---|---|
   | `[IdDia]` | libellé de la dimension tirée (ex. « Ø 1/64 po », « 1/4- 20 UNC », « M6 x 1 ») |
   | `[Dia]` | Ø de la dimension tirée, en pouces (au plus 5 décimales, sans zéros de fin) |
   | `[Pas]` | pas du filet, en pouces — **outil de filetage seulement** |
   | `[IdBarre]` | libellé de la barre tirée — **outil à deux diamètres seulement** (D25) |
   | `[NbDent]` | nombre de dents tiré |
   | `[NomOutil]` | `nom` de l'outil |
   | `[Operation]` | `operation` de l'outil |
   | `[Matoutil]` | matériau d'outil tiré (ex. « Acier rapide ») |

   Tout autre jeton, ou un jeton sans valeur pour l'outil, est une erreur **dès la validation du catalogue**. Les autres jetons du VBA (`[Couleur]`, `[FactVc]`, etc.) ne sont pas repris. Le gabarit résolu est le titre de la question, tel quel ; la progression garde le `nom` générique (`UI.md` §3.3). L'éditeur (jalon 6) permettra de le modifier.

## 5. Calcul des réponses attendues

Convention pédagogique du cours : `N = Vc × 4 / D` (approximation de 12/π ≈ 3,82).

```
Vc        = materiaux[matériau].vc_pi_min[matériau d'outil]              (pi/min)
N_brut    = Vc × 4 / D × fact_vc                                         (rév/min)
N         = min(N_brut, limite_rpm)

avance par dent (fz) :
  filetage                : fz = pas   (la table d'avance donne « pas du filetage »)
  proportionnelle au Ø    : fz = min(avance_po_rev × D_outil × fact_av, avance_max_po_rev)
  fixe                    : fz = avance_po_rev

avance par révolution  f  = fz × nb_dents                                (po/rév)
vitesse d'avance       Vf = N × f                                        (po/min)
```

`D` est le Ø de la dimension tirée. `D_outil` est le même, sauf pour un outil à
deux diamètres (décision D25) : pour la barre à aléser, **N se calcule avec le Ø
usiné et l'avance avec le Ø de la barre** (alésage : 0,006 × Ø barre, plafonnée
à 0,006 po/tour ; rainurage interne : 0,003 × Ø barre, plafonnée à 0,003).

La feuille des formules montre aussi, **à titre indicatif**, la formule exacte
`N = Vc × 12 / (π × Ø)` (D29) ; la correction reste sur `Vc × 4 / Ø`. Un N calculé
avec 12/π est plus bas de 4,5 % : il tient dans la tolérance de N (§6) pour
toutes les combinaisons du catalogue, arrondi à l'entier ou non
(`tests/chaine.test.js`) : c'est pour lui que la tolérance de N est élargie de
±1 rév/min (§6, D13 complément).

**Arrondis (décisions D9, D14).** Aucun arrondi sur les valeurs théoriques,
comme dans le VBA (arrondis commentés) : les tolérances du §6 absorbent les
arrondis de l'étudiant. L'arrondi n'existe qu'à l'**affichage**, dans une
fonction de formatage séparée du calcul (`site/js/format.js`) :

| Valeur | Affichage |
|---|---|
| Vc | valeur de la table, telle quelle |
| N | entier |
| Avance par dent, avance par révolution | au moins 4 décimales (5 en filetage) **et** au moins 3 chiffres significatifs |
| Vitesse d'avance Vf | 3 décimales |

Exemples d'avances : 0,003 → « 0.0030 » ; 0,001875 → « 0.00188 » ;
0,0000118 (foret métrique Ø 0,05 mm) → « 0.0000118 », et non « 0.0000 ». Les
zéros de fin au-delà du minimum de décimales ne sont pas écrits : 0,0015 →
« 0.0015 », pas « 0.00150 ». Arrondi au plus proche, demi vers le haut.

Séparateur décimal : le **point** à l'affichage (« 0.0015 »), comme sur la
commande CNC et dans les libellés ; la saisie accepte le point et la virgule
(décision D10).

## 6. Correction — tolérances (reprises du VBA `modCorrection`)

| Champ | Filetage | Avance fixe | Avance proportionnelle au Ø |
|---|---|---|---|
| Vc | exact | exact | exact |
| Avance par dent | ±0,1 % | exact | ±25 %, borné à ±0,001 po |
| N | de −90 % à +0,1 % (la vitesse peut être réduite pour fileter) | ±5 %, élargie de ±1 rév/min | ±5 %, élargie de ±1 rév/min |
| Avance par révolution | ±0,1 % | ±0,1 % | ±20 % |
| Vitesse d'avance | ±0,5 % de *N_saisi × f_saisi* (cohérence interne, D15) | idem | idem |

Précisions :

- Sauf pour Vf, l'intervalle est centré sur la **valeur théorique** (§5, non
  arrondie) ; ses bornes sont incluses.
- **Tolérance effective (décision D13)** : la plus large entre celle du tableau
  et **une demi-unité du dernier chiffre affiché** (§5) — ±0,5 rév/min pour N,
  ±0,00005 po pour une avance affichée à 4 décimales, ±0,0005 po/min pour Vf.
  « Exact » signifie donc exact à la précision affichée, et la valeur théorique
  telle qu'affichée est toujours acceptée. Ex. : N théorique = 84,67 rév/min en
  filetage → 84 et 85 sont acceptés ; lame à tronçonner à 4,375 rév/min → 4 est
  accepté.
- **N, hors filetage (D13, complément)** : ±5 % **puis** ±1 rév/min de chaque
  côté (1600 → [1519 ; 1681] ; 4,375 → [3,156 ; 5,594]), pour qu'un N calculé
  avec la formule exacte 12/π (§5) et arrondi à l'entier passe toujours. La ligne
  de correction l'écrit : « ±5 % et ±1 rév/min ».
- « ±25 %, borné à ±0,001 po » : l'intervalle du tableau est **le plus étroit**
  de ±25 % et de ±0,001 po. Ex. fz = 0,0015 → [0,001125 ; 0,001875] (±25 %) ;
  fz = 0,006 → [0,005 ; 0,007] (±0,001 po). La demi-unité de D13 s'y ajoute
  ensuite (elle ne change rien à ces deux exemples).
- N en filetage : borne basse à −90 % (la vitesse peut être réduite pour
  fileter). Le VBA appliquait −90,1 % ; ce n'est pas repris.
- **Vitesse d'avance (décision D15)**, toutes familles : vérifiée à ±0,5 % de
  *N_saisi × f_saisi*, c.-à-d. la **cohérence interne** de la réponse, pas la
  valeur théorique. N et f sont corrigés à part, chacun dans sa cellule : une Vf
  cohérente avec un N faux est bonne, et l'erreur est comptée sur N.
  - Un champ N ou f non saisi (pré-rempli, vide ou illisible) est remplacé par
    sa valeur théorique.
  - N et f ne sont connus qu'à la précision de leur affichage (D13) : le produit
    de référence est pris sur toute la plage (N ± demi-unité) × (f ± demi-unité),
    puis élargi de ±0,5 % ou de la demi-unité de Vf. Ex. lame à tronçonner :
    N affiché « 4 » (théorique 4,375), f = 0,004 → la Vf théorique 0,0175,
    affichée « 0.018 », est acceptée, tout comme 4 × 0,004 = 0,016.
- Saisie : le point et la virgule sont acceptés comme séparateur décimal
  (D10) ; un champ vide ou illisible est une mauvaise réponse.

Une question est **réussie** quand les 5 champs sont corrects. Les champs
pré-remplis par la configuration de l'exercice (ex. M10 : tout sauf Vc) comptent
comme corrects.

## 7. Progression, séance et serveur de correction

### Progression et réussite de l'exercice

- L'exercice (§10) liste les outils évalués ; chacun porte ses
  `reussites_requises` (≥ 1). Un outil absent de l'exercice n'est jamais tiré.
- Les réussites sont **consécutives** (décision D12) : une question réussie
  ajoute 1 au compteur de son outil ; une question échouée remet ce compteur à
  zéro, et seulement celui-là. Le compteur est tenu **par `id` d'outil**. (Le
  VBA remettait à zéro par *nom* d'outil : un échec sur le SDTMR impérial
  annulait aussi le SDTMR métrique, qui porte le même nom. Ce comportement
  n'est pas repris.)
- Un outil reste « à évaluer » — donc admissible au tirage du §4.1 — tant que
  son compteur est sous `reussites_requises`. Ensuite il ne sort plus.
- L'exercice est réussi quand chaque outil de l'exercice a atteint ses
  `reussites_requises`.
- Le **total des questions réussies**, inscrit au rapport (§8), ne diminue
  jamais, même quand un compteur d'outil retombe à zéro.
- État de progression, sérialisable, tenu **par le serveur** (ci-dessous) :
  `{ exerciceId, reussites: { [id d'outil]: n }, totalReussies }`.
- Un graphique de progression par opération est affiché (VBA `modAffGraph`).

### Serveur de correction (décisions D19, D21, D22, D23)

La preuve de réussite doit résister à un étudiant aidé d'une IA. Dans un
navigateur, tout est falsifiable : **l'état de séance vit donc sur un serveur**,
qui détient la clé secrète. Le navigateur **affiche** ; le serveur :

- **tire** les questions (§4) et **mémorise** la question tirée dans la séance :
  tant qu'elle n'est pas corrigée, c'est elle qui revient — on ne « passe » pas
  une question, et rien de ce que le navigateur dit de la question n'est cru ;
- calcule les réponses attendues (§5), **corrige** (§6) la question mémorisée
  et **tient les compteurs** (ci-dessus) ;
- **horodate** et **journalise** chaque correction : outil, question tirée,
  réponses données, résultat, heure. Le rapport (§8) en tire les questions
  réussies ; la page de vérification, la durée totale et le temps médian par
  question ;
- impose une **cadence minimale** (levée en mode test, ci-dessous) : 10 s entre deux corrections d'une même
  séance. Une correction demandée trop tôt est refusée (429), **sans effet** sur
  les compteurs ni sur la question en cours ;
- ne corrige une question **qu'une seule fois** : la correction tire aussitôt
  la question suivante, ou constate la réussite ;
- **signe l'attestation de réussite** (HMAC) que le rapport porte en QR (§8,
  jalon 5).

Une **séance** = un couple (exercice, matricule) : il n'y en a qu'une. Une
séance interrompue se reprend **de n'importe quel appareil**, en s'identifiant
(§8) ; il n'y a ni lien de reprise ni QR de séance.

**Exercice modifié en cours de session (D21).** La séance **continue**. Les
compteurs sont indexés par `id` d'outil : un outil retiré de l'exercice
disparaît de la progression, un outil ajouté part à zéro, ce qui est acquis le
reste. Une question en attente ne vaut plus si son outil a quitté l'exercice,
ou s'y trouve déjà réussi parce qu'on exige maintenant moins de réussites : la
suivante est tirée à la prochaine demande — ou la réussite est constatée s'il
ne reste rien à tirer. La séance note la version de l'exercice **au début** et
**à la réussite**. Une réussite acquise le reste, quoi que devienne l'exercice.

**Le serveur conserve** (base D1, schéma dans `migrations/`) :

| Table | Contenu |
|---|---|
| `seances` | une ligne par couple (exercice, matricule) : prénom et nom **de la première visite**, NIP haché, jeton haché et son expiration, début, dernière activité, dernière correction, version de l'exercice au début et à la réussite, compteurs (JSON), question en attente (JSON), date de réussite, essais de NIP et verrou |
| `corrections_identite` | le journal des corrections d'identité (D23) : séance, anciens et nouveaux prénom, nom et matricule, horodatage — pour la page de vérification |
| `corrections` | le journal : séance, outil, question (JSON), réponses (JSON), résultat champ par champ et valeurs attendues (JSON), réussie ou non, horodatage |

Ni le NIP ni le jeton n'y sont en clair (ci-dessous). L'enseignant **purge le
tout en fin de session** (page d'administration, §8) ; purger une séance efface
son journal.

**Le navigateur ne conserve que** `{ matricule, prenom, jeton }`
(`site/js/session.js`), dans `localStorage` sous une seule clé
(`quiz-parametres-coupe:seance`) : de quoi offrir « Reprendre, <prénom> » à
l'accueil sans redemander le NIP. Le stockage n'est jamais fiable (navigation
privée, quota, contenu abîmé) : chaque lecture et chaque écriture est protégée ;
stockage vide, illisible ou en panne → l'étudiant s'identifie, sans erreur.

### Secrets, NIP et jeton (décision D22)

- Deux secrets, posés sur le Worker et jamais dans le dépôt : `CLE_SECRETE`,
  pour toute la cryptographie du serveur, et `CLE_ADMIN`, pour l'administration
  (jalon 5). En local : `.dev.vars` (`DEMARRAGE.md`, étape 5). Sans
  `CLE_SECRETE`, le serveur refuse de travailler (500) plutôt que de hacher
  sans secret.
- Une **sous-clé par usage** est dérivée de `CLE_SECRETE` par HKDF-SHA-256
  (`worker/crypto.js`) : « nip » aujourd'hui, « attestation » au jalon 5.
- **NIP** : la base garde HMAC-SHA-256(sous-clé « nip », matricule + NIP). Pas
  de hachage lent : un NIP de 4 à 6 chiffres est trop court pour qu'il serve ;
  la protection vient du secret, que la base ne contient pas. Le matricule fait partie du haché : « Corriger mon identité » vers un autre
  matricule rehache le même NIP. Le NIP appartient
  à la séance, donc à l'exercice : l'étudiant en choisit un par exercice.
  Accepté pour la v1 ; si cela gêne, la piste est une table `etudiants` — un
  NIP par matricule, alimentée par une liste de classe (D23).
- **Jeton de séance** : 32 octets aléatoires en base64url (43 caractères),
  envoyé une seule fois, à l'identification ; la base n'en garde que le
  SHA-256. Il expire **2 h après la dernière activité** ; chaque appel accepté
  le prolonge. **Un seul jeton par séance** : s'identifier sur un second
  appareil invalide le jeton du premier, qui sera renvoyé à l'identification.
- Deux requêtes lancées en même temps ne passent pas toutes les deux : chaque
  écriture ne vaut que si la séance n'a pas changé depuis sa lecture. Un seul
  essai de NIP est examiné, une seule question est tirée, une seule correction
  compte.

### Données lues par le serveur (décision D22)

Il n'y a **qu'une source** : `site/data/` (§3) et `site/exercices/` (§10), ceux
que lit aussi le navigateur. Le Worker les lit **par sa liaison `ASSETS`**
(`worker/catalogue.js`), avec `loadData` et `loadExercise` du site — donc avec
les mêmes validations —, et garde le résultat en mémoire jusqu'au déploiement
suivant. Seuls les exercices de l'index (§10) existent pour le serveur. Le
moteur (`site/js/` : question, calcul, format, correction, progression) est
importé par le Worker : il n'existe qu'en un exemplaire.

### API du serveur (`/api/…`, appelée par `site/js/api.js`)

Requêtes et réponses en JSON. **Chaque appel nomme l'exercice** (D21). Après
l'identification, chaque appel porte le jeton dans l'en-tête
`Authorization: Bearer <jeton>`. Une erreur est de la forme
`{ "erreur": "<message en français>" }`, avec un code HTTP.

| Appel | Requête | Réponse |
|---|---|---|
| `GET /api/version` | — | `{ version }` (celle de `package.json`) |
| `POST /api/consultation` | `{ exercice, matricule }` | `{ trouvee: false }`, ou `{ trouvee: true, prenom, initiale }` — **rien d'autre ne sort** |
| `POST /api/creation` | `{ exercice, prenom, nom, matricule, nip }` | `{ jeton, seance }` — crée la séance ; ne reprend **jamais** une séance existante (409) |
| `POST /api/reprise` | `{ exercice, matricule, nip }` | `{ jeton, seance }` — ni prénom ni nom ; 404 s'il n'y a pas de séance |
| `POST /api/identite` | jeton, `{ exercice, prenom, nom, matricule, nip }` | `{ seance }` — « Corriger mon identité » : NIP exigé, séance **déplacée, jamais copiée**, correction journalisée ; le jeton ne change pas |
| `GET /api/seance?exercice=<id>` | jeton | `{ seance }` — l'état, sans rien tirer |
| `POST /api/question` | jeton, `{ exercice }` | `{ seance }` — avec la question mémorisée, tirée au besoin ; `question` vaut `null` si l'exercice est réussi |
| `POST /api/correction` | jeton, `{ exercice, saisies }` | `{ correction, seance }` — `seance` porte déjà la question suivante, ou la réussite |
| `POST /api/deconnexion` | jeton, `{ exercice }` | `{ deconnecte: true }` — « Changer d'étudiant » : le jeton ne vaut plus rien |

`saisies` : les champs évalués, en texte, sous les noms du moteur —
`{ vc, feedPerTooth, rpm, feedPerRev, feedRate }`. Tout le reste est ignoré.

`seance` (composée par `worker/seance.js`) :

```json
{
  "etudiant": { "prenom": "Camille", "nom": "Tremblay", "matricule": "2412345" },
  "exercice": { "id": "m10-tournage-vc", "titre": "M10 — …", "version": "r0" },
  "debut": "2026-09-21T13:05:00.000Z",
  "reussite_le": null,
  "attendre_s": 0,
  "progression": {
    "outils": [ { "id": "mvlnr", "nom": "MVLNR", "operation": "Chariotage finition", "plage": "1.000\" à 4.000\"", "reussites": 2, "requises": 3 } ],
    "outils_termines": 4,
    "total_reussies": 9
  },
  "question": {
    "identifiant": "MVLNR - Ø charioté: 2.000\"",
    "outil": { "id", "nom", "operation", "commentaire", "dents", "materiau", "limite_rpm", "fact_vc", "fact_av", "barre" },
    "dimension": "2.000\"",
    "materiau": { "iso", "groupe", "materiau", "composition", "etat", "durete", "exemple" },
    "champs": [ { "champ": "vc", "evalue": true, "texte": "" },
                { "champ": "rpm", "evalue": false, "texte": "800" } ]
  }
}
```

Un champ non évalué arrive avec sa valeur théorique mise en forme (§5, §10).
`attendre_s` : secondes avant que la prochaine correction soit acceptée
(cadence ; 0 en mode test) — le navigateur en fait un **compte à rebours** sur le
bouton Vérifier (« Vérifier dans 7 s »), à la place d'un message ; un refus 429
le relance avec son `attendre_s`. Chaque outil de `progression.outils` porte
son `operation` et sa `plage` de dimensions dans l'exercice (« Ø 1/64 po à
Ø 1 po », un seul libellé s'il n'y en a qu'une) : c'est ce que l'attestation
liste (§8), et qui fera partie du contenu signé (jalon 5).
`identifiant` est le gabarit de nom résolu (§4.6). `outil.barre` est le libellé
de la barre tirée pour un outil à deux diamètres (`dimension` est alors le Ø
alésé), sinon `null`. En mode test seulement, `question` porte aussi
`reponses_test` (ci-dessous).

**Règle : rien de ce qui est à trouver ne part au navigateur.** Ni la valeur
attendue d'un champ évalué, ni les vitesses de coupe du matériau, ni rien qui
permette de les déduire sans faire le travail. Les valeurs attendues n'arrivent
qu'avec la correction, une fois la réponse donnée. Toute nouvelle donnée ajoutée
à `seance.question` se juge à cette règle.

`correction` : `{ reussie, outil: { id, nom, avant, apres }, champs: [ { champ,
evalue, ok, saisie, attendu, tolerance, ecart_pct, calcul } ] }`, montrée après
la correction (`UI.md` §3.4) ; `avant` et `apres` sont le compteur de l'outil.
Pour chaque champ :

- `attendu` : la valeur théorique mise en forme — sauf pour **Vf**, où c'est
  *N × f* **avec les N et f saisis** (D15) : c'est sur elle que Vf est jugée ;
- pour un champ évalué : `tolerance`, en clair et écrite à partir des constantes
  mêmes de la correction (« exacte », « ±5 % », « de −90 % à +0.1 % »,
  « ±25 %, au plus ±0.001 po », « ±0.5 % de N × f ») ; `ecart_pct`, l'écart de
  la saisie en % (`null` si elle est vide ou illisible) ; `calcul`, le calcul en
  une ligne (« Vf = N × f = 2500 × 0.0050 », facteur de vitesse et plafond du
  RPM compris ; pour un outil à deux diamètres, il nomme celui qui sert :
  « N = Vc × 4 / Ø usiné = … », « fz = avance × Ø barre = 0.006 × 0.75 » ; `null` pour Vc et pour une avance fixe, qui se lisent dans une
  table). Pour un champ fourni, ces trois valeurs sont `null`.

| Code | Sens |
|---|---|
| 400 | requête invalide : JSON illisible, exercice inconnu, identification mal formée (le message dit quoi) |
| 401 | NIP incorrect (reprise, correction d'identité) ; ailleurs : jeton absent, inconnu, expiré ou **d'un autre exercice** → l'étudiant s'identifie de nouveau |
| 404 | adresse inconnue sous `/api/` ; reprise : aucune séance pour ce matricule dans cet exercice |
| 409 | création ou correction d'identité : ce matricule a déjà une séance pour cet exercice ; correction : aucune question n'attend de correction (exercice réussi, question pas encore tirée, ou devenue caduque) → le navigateur redemande la question |
| 429 | reprise et correction d'identité : 5 essais de NIP en 10 minutes → verrou de 10 minutes, même pour le bon NIP ; correction : moins de 10 s depuis la précédente (`attendre_s` dit combien) |
| 500 | erreur du serveur ; le détail reste dans ses journaux |

**Essais de NIP.** Ils se comptent à la reprise **et** à la correction d'identité, qui exige le NIP : ce n'est pas un moyen de le deviner sans limite. Chaque essai est compté avant d'être examiné. Le 5ᵉ essai
d'une fenêtre de 10 minutes pose le verrou ; une identification réussie efface
le compte. Le verrou est celui d'une séance : il ne touche aucun autre
étudiant. Un NIP **remis à zéro** par l'enseignant (jalon 5) : le prochain NIP
présenté pour ce matricule devient le nouveau.

### Mode test (décision D26)

Pour essayer le parcours sans calculer : les cases se remplissent d'elles-mêmes,
restent modifiables (pour simuler une erreur), et il n'y a qu'à cliquer Vérifier
puis Question suivante. **Sans porte à la tricherie** :

- le mode n'existe que **sur le poste de développement** : variable
  `MODE_TEST=1` dans `.dev.vars`, lu par `wrangler dev`. Elle n'est **jamais**
  dans `wrangler.jsonc`, ni dans le déploiement, ni en production (un test le
  vérifie) ;
- second verrou : même avec la variable, le serveur n'accepte le mode que pour
  une requête adressée à `localhost`, `127.0.0.1` ou `[::1]`
  (`isTestMode`, `worker/seance.js`) ;
- **c'est le serveur qui joint les valeurs attendues** à la question, dans
  `seance.question.reponses_test` (`{ vc: "100", rpm: "1600", … }`, champs
  évalués seulement), et seulement dans ce mode. Rien de ce qu'envoie le
  navigateur — adresse, en-tête, corps — ne l'active ;
- le navigateur n'affiche le bandeau « Mode test » et le bouton « Remplir » que
  si la question porte `reponses_test` ; il n'a aucun interrupteur ;
- dans ce mode, la cadence de 10 s est levée.

L'exercice `test-complet` (§10) sert à cet essai. Plus tard, le mode pourra
s'ouvrir aux séances d'un **professeur connecté** (jalon 5 ou 6) ; pour toute
séance d'étudiant, la règle « rien de ce qui est à trouver ne part au
navigateur » reste entière.

**Tests.** `npm test` fait tourner le vrai Worker sur une base SQLite en mémoire
(`node:sqlite`) où les vraies migrations sont appliquées, avec une horloge
réglable (`tests/worker-api.test.js`). `npm run test:api` rejoue un scénario par
HTTP sur `wrangler dev` et une vraie D1 locale.

## 8. Identification de l'étudiant et rapport

Identification (décisions D19, D21, D23) : prénom, nom, **matricule à 7 chiffres**
(espaces autour tolérés, conservé en texte) et un **NIP de 4 à 6 chiffres**.
Rien d'autre. Elle se fait **en deux temps**, pour que rien ne se décide en
silence (présentation : `UI.md` §3.2) :

1. **Le matricule seul.** Le serveur dit s'il a une séance pour cet exercice :
   « séance trouvée », avec le prénom et l'initiale du nom pour que l'étudiant
   se reconnaisse, ou « aucune séance ». Rien d'autre ne sort.
2. **Séance trouvée → reprendre** : le NIP, et lui seul. **Matricule + NIP
   identifient** ; le prénom et le nom sont ceux de la création.
   **Aucune séance → commencer** : le matricule, montré en gros pour être
   vérifié, puis prénom, nom et NIP **choisi**.

- Le serveur ne devine jamais : créer une séance qui existe est refusé (409),
  reprendre une séance qui n'existe pas aussi (404).
- Le NIP sert ensuite à reprendre cet exercice, y compris sur un autre
  appareil. Le serveur n'en garde qu'un **haché** (§7).
- **5 essais de NIP en 10 minutes** pour une séance ; ensuite le NIP est refusé
  (429) pendant 10 minutes, même s'il est le bon (§7).
- **Réparation sans enseignant — « Corriger mon identité »**, depuis la séance :
  prénom, nom et matricule modifiables, **NIP exigé**. Un nouveau matricule
  n'est accepté que s'il n'a pas de séance pour cet exercice. La séance est
  **déplacée, jamais copiée** : compteurs, question en attente et journal
  suivent. Chaque correction est **journalisée** (anciennes et nouvelles
  valeurs, horodatage) et sera montrée par la page de vérification (jalon 5).
- Un NIP oublié est **remis à zéro par l'enseignant** (page d'administration,
  jalon 5) : l'étudiant en choisit un nouveau à sa prochaine reprise. Une
  séance ouverte par un autre au matricule d'un étudiant — farce visible aux
  horodatages — se supprime de la même page.
- Le navigateur vérifie la forme des champs avant l'envoi
  (`site/js/identification.js`) ; le serveur revérifie tout.

**La preuve de réussite est le rapport**, que l'étudiant enregistre en PDF et
remet sur Léa (décision D16). Le QR code sert à l'enseignant pour vérifier un
rapport en cas de doute.

**Attestation provisoire (D29, D30).** Depuis l'écran « Exercice réussi », « Voir
mon attestation » ouvre une page lettre imprimable tirée de la séance : exercice
et version, identité, début, réussite, questions réussies, champs évalués,
l'emplacement du code QR, et **la liste des opérations effectuées** — pour
chaque outil de l'exercice, dans l'ordre : nom générique avec sa plage de
dimensions, opération, réussites obtenues sur réussites exigées
(`progression.outils`, §7). Tant que le serveur ne la signe pas (jalon 5, en
tête), une bannière « PROVISOIRE — non signée, ne vaut pas preuve de
réussite » l'accompagne, à l'écran et à l'impression.

Rapport de réussite (présentation : `UI.md` §3.6) :
- exercice et sa version, prénom, nom, matricule, date/heure de début,
  date/heure de réussite, nombre de questions réussies ;
- tableau des questions réussies groupées par opération (outil, matériau,
  paramètres) ;
- **QR code** vers la page de vérification.

Moodle est abandonné (D16) : ni numéro Moodle, ni code de réussite. La formule
du classeur (`calcCodeM`) reste dans `legacy/vba/` pour mémoire.

### QR code, page de vérification et page d'administration (décision D19)

- Le QR du rapport porte une **attestation de réussite signée par le serveur**
  (HMAC, clé secrète détenue par le serveur seulement). Un rapport fabriqué ou
  retouché ne passe pas la vérification.
- Une **page de vérification publique** lit l'attestation du QR et demande au
  serveur si elle est authentique.
- Une **page d'administration, à clé**, interroge le même serveur : liste des
  réussites, remise à zéro d'un NIP, purge des données en fin de session.
- Contenu exact de l'attestation, adresse de la page de vérification et forme
  de la clé d'administration : jalon 5 (`PLAN.md`).

L'ancien QR du classeur (`https://thierryleroux.github.io/tgm-fab/?data=…` :
champs `;`-séparés, décalage César +4, base64, décodé par `legacy/index.htm`)
était reproductible par quiconque lisait le code : il n'est pas repris. D19
ferme D6.

## 9. Exigences non fonctionnelles

- **Un site sans étape de construction et un serveur de correction**
  (décisions D19, D20, D22) : un seul Worker Cloudflare sert `site/`
  (HTML/CSS/JS, JSON) tel quel et expose l'API `/api/` ; base D1 pour les
  séances et le journal des corrections. Publié par GitHub Actions à chaque push
  sur `main` : `npm test`, puis les migrations de la base, puis
  `wrangler deploy`.
- Fonctionne dans les navigateurs récents du laboratoire et sur téléphone.
- Interface en **français**.
- **Durable** : sans étape de compilation obligatoire, dépendances minimales et
  épinglées (QR code à l'exécution, `wrangler` pour développer et publier),
  données modifiables par l'enseignant en éditant les JSON.
- Le **moteur de calcul et de correction est testé unitairement** (cas tirés du
  classeur), tout comme le serveur (§7, « Tests »). Node ≥ 22.13 pour
  développer ; rien à installer pour l'étudiant.
- **Données personnelles** : prénom, nom, matricule, NIP haché, réponses et
  résultats ne vont qu'au serveur de correction du projet, et sont **purgés par l'enseignant
  en fin de session** (§7). Rien n'est envoyé à un tiers, et la page ne charge
  rien d'un domaine externe (polices auto-hébergées, `UI.md` §1). Le navigateur
  ne garde que `{ matricule, prenom, jeton }` (§7). Pied de page : « Tes
  réponses sont corrigées par un serveur ; tes données sont effacées à la fin de
  la session. »

## 10. Configuration d'un exercice (décision D11)

Le **catalogue** (`site/data/`, §3) décrit le métier ; un **exercice** choisit
dans le catalogue ce qui est évalué. Un exercice = un fichier
`site/exercices/<id>.json`. Le M10 du classeur est
`site/exercices/m10-tournage-vc.json`.

```json
{
  "id": "m10-tournage-vc",
  "titre": "M10 — Tournage : vitesse de coupe",
  "version": "r0",
  "champs_evalues": ["vc"],
  "outils": [
    { "id": "mvlnr", "reussites_requises": 3 },
    { "id": "foret_fractionnaire", "reussites_requises": 2,
      "dimensions": ["Ø 1/4 po", "Ø 1/2 po"],
      "materiaux_outil": ["Acier rapide"],
      "groupes": ["P - Acier non allié", "N - Aluminium de corroyage"] }
  ]
}
```

| Clé | Obligatoire | Règle |
|---|---|---|
| `id` | oui | minuscules, chiffres et tirets ; **identique au nom du fichier** (sans `.json`) |
| `titre` | oui | texte affiché à l'étudiant et au rapport |
| `version` | oui | texte (ex. « r0 ») ; inscrit au rapport (§8) |
| `champs_evalues` | oui | au moins un parmi `vc`, `fz`, `n`, `f`, `vf`, sans doublon |
| `outils` | oui | au moins un ; chaque `id` une seule fois |
| `liste` | non | `false` retire l'exercice de la liste de l'accueil (D18) ; il reste joignable par `?exercice=<id>`. Pour les exercices d'essai (D30). Absent = listé |
| `outils[].id` | oui | `id` d'un outil du catalogue |
| `outils[].reussites_requises` | oui | entier ≥ 1 (réussites consécutives, §7) |
| `outils[].dimensions` | non | restreint le tirage à ces **libellés** de dimension ; chacun doit exister sur l'outil |
| `outils[].materiaux_outil` | non | restreint le tirage du matériau d'outil (ex. « Acier rapide » seulement) ; chacun doit figurer dans les `materiaux_outil` de l'outil |
| `outils[].groupes` | non | restreint le tirage du matériau brut à ces groupes ; chacun doit être usinable par l'outil |

Précisions :

- **Champs évalués et pré-remplis.** Les cinq champs sont toujours affichés,
  dans l'ordre Vc, fz, N, f, Vf. Ceux de `champs_evalues` sont saisis et
  corrigés (§6) ; les autres sont **pré-remplis** avec la valeur théorique mise
  en forme (§5) et comptent comme corrects. Correspondance avec le moteur :
  `vc` → `vc`, `fz` → `feedPerTooth`, `n` → `rpm`, `f` → `feedPerRev`,
  `vf` → `feedRate`.
- **Restrictions absentes = aucune restriction** : toutes les dimensions, tous
  les matériaux d'outil, tous les groupes usinables de l'outil. Une liste de
  restriction vide, ou avec un doublon, est une erreur. C'est par `dimensions`
  qu'un exercice écarte les micro-forets (D14).
- **Clé inconnue = erreur.** Une faute de frappe (« dimension » pour
  « dimensions ») lèverait sinon une restriction en silence. Seules les clés
  commençant par `_` (commentaires, comme `_source`) sont ignorées.
- La validation (`site/js/exercice.js`) est la même pour les tests, le quiz et
  l'éditeur (jalon 6).
- **Index des exercices offerts** : un site statique ne peut pas lister un
  dossier ; `site/exercices/index.json` dit quels exercices proposer, dans
  l'ordre d'affichage : `{ "exercices": [ { "id", "titre" }, … ] }`.
  `?exercice=<id>` dans l'adresse choisit un exercice **parmi ceux de l'index**.
  Il n'y a **pas d'exercice par défaut** (décision D18) : `?exercice=` absent →
  l'accueil affiche la liste des exercices de l'index ; id inconnu → l'accueil
  affiche « L'exercice « <id> » n'existe pas — vérifie le lien sur Léa », puis
  la même liste. Chaque
  `id` a son fichier `<id>.json` et le même `titre` (vérifié par les tests) ;
  « index » est un identifiant réservé. Un fichier d'exercice absent de
  l'index n'est pas offert. Pour composer la liste, la page lit les fichiers des
  exercices de l'index et écarte ceux qui portent `"liste": false`.
- **`test-complet`** (décision D26) : exercice de test pour l'enseignant — tous
  les outils du catalogue, les cinq grandeurs, une réussite par outil, aucune
  restriction, `"liste": false`. Un test vérifie qu'un outil ajouté au catalogue
  y figure. Il est dans l'index (le serveur ne connaît que l'index) mais pas
  dans la liste de l'accueil ; joignable par `?exercice=test-complet`, il ne
  donne aucune réponse en production (le mode test n'existe qu'en local, §7).
- Reporté : seuils du graphique de progression (finition).

## 11. Questions ouvertes (résumé)

1. ~~Arrondis des valeurs théoriques (§5).~~ Tranché : voir §5.
2. ~~Réussites consécutives ou cumulées (§7).~~ Tranché : consécutives (D12).
3. ~~Vérification du code : Moodle seul ou aussi QR (§8).~~ Tranché : plus de Moodle ; rapport PDF remis sur Léa, QR pour l'enseignant (D16).
4. ~~Sécurité du payload QR (§8 / D6).~~ Tranché : attestation signée par le serveur de correction (D19).
5. Nouveau code dans le dépôt `tgm-fab` (à côté de `index.htm`) ou dépôt dédié ? (D7)
6. ~~Serveur de correction : cinq points du §7.~~ Tranchés : D21.
7. ~~Un N calculé avec 12/π puis arrondi à l'entier (§5).~~ Tranché : tolérance de N élargie de ±1 rév/min (D13, complément).
8. ~~Barres de la barre à aléser et rapport 0,75 (§3, D25).~~ Confirmés (D30).
