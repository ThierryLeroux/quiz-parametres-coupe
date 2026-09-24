# Spécification fonctionnelle — Quiz de paramètres de coupe (version web)

Statut : **brouillon v0.8** (2026-09-24). Rédigée à partir de l'analyse du classeur
`Exercice M10 - tournage - vc seulement - version étudiant_r0.xlsm` et de son VBA
(voir `legacy/vba/`). Un point marqué ❓ est à confirmer avec Thierry ; il n'y en a aucun en ce moment.

## 1. Objectif

Exerciseur auto-corrigé où l'étudiant calcule les paramètres de coupe d'une
opération d'usinage tirée au hasard (outil × dimension × matériau brut), jusqu'à
démontrer la maîtrise de chaque type d'outil. À la réussite, une
**attestation** est produite, que l'étudiant enregistre en PDF et remet sur
Léa ; elle porte un **QR code** de vérification pour l'enseignant (décisions
D16, D31 à D33). Les questions sont tirées et corrigées par un **serveur de
correction**, qui fige et signe la réussite (décision D19, §7).

Public : étudiants du Cégep du Vieux Montréal, Techniques de génie mécanique
(profil fabrication) et Techniques de génie de la maintenance industrielle.

## 2. Portée de la version 1 (décision D2)

Tournage, fraisage et perçage complets : les 29 outils et 19 opérations du
classeur, et les 5 paramètres demandés (Vc, avance par dent, N, avance par
révolution, vitesse d'avance). La configuration d'un exercice (quels outils,
combien de réussites, quels champs pré-remplis) doit permettre de reproduire le
M10 actuel (« Vc seulement, tournage ») comme simple cas particulier (§10).

Un **éditeur web** des exercices et de la banque d'outils fait aussi partie de la
v1 (décisions D11, D47 à D49) : depuis le jalon 7a, il écrit **en production, dans
la base D1**, derrière la clé d'administration (§8, §10). Les exercices et la
banque n'y sont plus des fichiers du dépôt.

## 3. Données de référence (`site/data/`, et la table `tables_reference`)

Les JSON de `site/data/` décrivent le format des données de référence et sont
**la semence** de la base (décision D47) : la migration `0005` les a importés tels
quels comme version « A2026_r0 » de la table `tables_reference` (`materiaux` et
`operations`, JSON), et `outils.json` comme **banque d'outils** (`banque_outils`,
un outil par ligne). Depuis, **le serveur et le navigateur lisent la base**, pas
les fichiers ; les JSON ne servent plus qu'à la semence et aux tests (un test vérifie
que la semence leur est identique). Les éditer ne change rien en production :
c'est l'éditeur (§10) qui modifie la banque, et le jalon 7b qui versionnera les
tables. Le format ci-dessous reste celui des tables en base.

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

**Corrections apportées aux données du classeur** (chacune confirmée par
Thierry, dans un commit « Corrige une donnée : … ») : pas du taraud M2 x 0.4
(0,04 → 0,4 mm) ; Ø du taraud #6-32 UNC (0,136 → 0,138 po) ; groupe
« N - Aluminium de corroyage » répété 8 fois sur `foret_fractionnaire_2` ;
libellé « Ø v45/64 po » → « Ø 45/64 po » sur le foret fractionnaire (D30).

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

   Tout autre jeton, ou un jeton sans valeur pour l'outil, est une erreur **dès la validation du catalogue**. Les autres jetons du VBA (`[Couleur]`, `[FactVc]`, etc.) ne sont pas repris. Le gabarit résolu est le titre de la question, tel quel ; la progression garde le `nom` générique (`UI.md` §3.3). L'éditeur (jalon 7) permettra de le modifier.

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
- **fige et signe l'attestation de réussite** (HMAC) que la page de
  l'attestation porte en QR (§8, décisions D31 à D33).

Une **séance** = un couple (exercice, matricule) : il n'y en a qu'une. Une
séance interrompue se reprend **de n'importe quel appareil**, en s'identifiant
(§8) ; il n'y a ni lien de reprise ni QR de séance.

**Séance épinglée à sa version (D47, remplace le point 4 de D21).** Une séance
est créée sur la **dernière version publiée** de l'exercice (`seances.version_id`)
et **la garde jusqu'à la fin** : une publication ne touche jamais une séance en
cours (mêmes outils, même titre, mêmes tables) ; seules les nouvelles séances
prennent la nouvelle version. La séance note la version (son numéro) **au
début** et **à la réussite** ; c'est ce que l'attestation inscrit. Une séance sans
version (créée par l'ancien serveur entre la migration `0005` et le déploiement)
prend la dernière version publiée à sa première requête, et y reste. Les compteurs
restent indexés par `id` d'outil ; une question en attente dont l'outil n'est
plus à évaluer (ce qui ne peut plus arriver qu'en cas de retouche directe de la
base) est retirée et remplacée.

**Le serveur conserve** (base D1, schéma dans `migrations/`) :

| Table | Contenu |
|---|---|
| `seances` | une ligne par couple (exercice, matricule) : prénom et nom **de la première visite**, NIP haché, jeton haché et son expiration, début, dernière activité, dernière correction, version de l'exercice au début et à la réussite (son numéro), **la version épinglée** (`version_id`, D47), compteurs (JSON), question en attente (JSON), date de réussite, essais de NIP et verrou |
| `corrections_identite` | le journal des corrections d'identité (D23) : séance, anciens et nouveaux prénom, nom et matricule, horodatage ; après la réussite, les codes de l'attestation annulée et de la nouvelle (D37) — pour l'espace professeur |
| `corrections` | le journal : séance, outil, question (JSON), réponses (JSON), résultat champ par champ et valeurs attendues (JSON), réussie ou non, horodatage |
| `attestations` | une ligne par attestation (D31, D35, D37, D45) : séance (NULL une fois la séance supprimée), code court, enregistrement figé (JSON, avec la liste des questions réussies qui comptent, D41), signature, date de création, date et motif d'annulation éventuels (`remise_a_zero`, `identite_corrigee`, `seance_supprimee`) |
| `journal_enseignant` | les actions d'enseignant (D34, D35, D38, D44 à D46) : horodatage, enseignant (« admin » ou « consultation » : le rôle, D44), séance (NULL quand elle n'existe plus), action (`connexion`, `connexion_refusee`, `remise_a_zero`, `reinitialisation_nip`, `suppression`, `effacement`), détails — anonymisés à l'effacement (D46) |
| `debit`, `verrous` | les limites de débit par adresse (D36) : valeurs distinctes vues par tranche horaire, et verrous (délai après refus, connexions professeur ratées) |
| `tables_reference` | les versions des tables de référence (D47) : identifiant (la révision, « A2026_r0 »), `materiaux` et `operations` (JSON, le contenu des deux fichiers de §3), date ; immuables — une seule pour l'instant |
| `banque_outils` | la banque d'outils (D47) : un outil par ligne (JSON au format d'`outils.json`), rang, numéro de révision (D48), date de modification, date d'archivage |
| `exercices` | les exercices (D47) : l'identifiant d'URL (définitif), le **brouillon** (JSON, §10), son numéro de révision (D48), dates de modification, de dernière publication, d'archivage, de création |
| `versions_exercice` | les versions publiées (D47) : exercice, numéro (1, 2, 3…), contenu (JSON, la même forme que le brouillon, **figé**), version des tables de référence, date |

Ni le NIP ni le jeton n'y sont en clair (ci-dessous). L'enseignant **efface les
données des étudiants en fin de session** (espace professeur, §8, D46) — les
quatre tables de l'éditeur ne sont jamais touchées ; supprimer une séance
efface son journal, mais ses attestations restent, annulées (D45).

**Le navigateur ne conserve que** `{ matricule, prenom, jeton }`
(`site/js/session.js`), dans `localStorage` sous une seule clé
(`quiz-parametres-coupe:seance`) : de quoi offrir « Reprendre, <prénom> » à
l'accueil sans redemander le NIP. Le stockage n'est jamais fiable (navigation
privée, quota, contenu abîmé) : chaque lecture et chaque écriture est protégée ;
stockage vide, illisible ou en panne → l'étudiant s'identifie, sans erreur.

### Secrets, NIP et jeton (décision D22)

- Trois secrets, posés sur le Worker et jamais dans le dépôt : `CLE_SECRETE`,
  pour toute la cryptographie du serveur ; `CLE_ADMIN`, pour l'administration ;
  `CLE_CONSULTATION`, facultative, pour la consultation en lecture seule (D44).
  En local : `.dev.vars` (`DEMARRAGE.md`, étape 5). Sans `CLE_SECRETE`, le
  serveur refuse de travailler (500) plutôt que de hacher sans secret.
- Une **sous-clé par usage** est dérivée de `CLE_SECRETE` par HKDF-SHA-256
  (`worker/crypto.js`) : « nip », « attestation » (signature des
  attestations, D32), « prof » (cookie de séance professeur, D34).
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

### Données lues par le serveur (décisions D22, D47)

Il n'y a **qu'une source** : la base D1 — une **version publiée** d'exercice
(`versions_exercice`) et la version des tables de référence qu'elle nomme
(`tables_reference`). `worker/catalogue.js` les assemble (`assembleData` de
`site/js/data.js`, avec les mêmes validations que le navigateur) au format de
`loadData` : les copies d'outils de la version tiennent lieu de catalogue
d'outils. Une version publiée ne change jamais : une fois assemblée, elle est
gardée en mémoire. Un exercice sans version publiée n'existe pas pour le serveur
(400 « Cet exercice n'existe pas ») ; un exercice archivé refuse toute nouvelle
séance (400 « Cet exercice n'est plus offert »), ses séances en cours continuent.
Le navigateur reçoit la même chose par `GET /api/exercice` — la dernière version
pour l'accueil, puis celle de sa séance — et compose ses feuilles de référence et
ses noms d'outils à partir de là. Le moteur (`site/js/` : question, calcul,
format, correction, progression) est importé par le Worker : il n'existe qu'en
un exemplaire.

### API du serveur (`/api/…`, appelée par `site/js/api.js`)

Requêtes et réponses en JSON. **Chaque appel nomme l'exercice** (D21). Après
l'identification, chaque appel porte le jeton dans l'en-tête
`Authorization: Bearer <jeton>`. Une erreur est de la forme
`{ "erreur": "<message en français>" }`, avec un code HTTP.

| Appel | Requête | Réponse |
|---|---|---|
| `GET /api/version` | — | `{ version }` (celle de `package.json`) |
| `GET /api/exercice?exercice=<id>[&version=<n>]` | — | `{ exercice, tables, version, archive }` — la dernière version publiée de l'exercice (ou la version `n`, celle d'une séance) : l'exercice au format du moteur avec ses copies d'outils (chacune avec `reussites_requises`), les deux tables de référence, le numéro, et si l'exercice est archivé ; 400 inconnu ou jamais publié, 404 version inconnue (D47) |
| `GET /api/exercices` | — | `{ exercices: [ { id, titre } ] }` — la liste de l'accueil (D18) : publiés, non archivés, sans `"liste": false` |
| `POST /api/consultation` | `{ exercice, matricule }` | `{ trouvee: false }`, ou `{ trouvee: true, prenom, initiale }` — **rien d'autre ne sort** |
| `POST /api/creation` | `{ exercice, prenom, nom, matricule, nip }` | `{ jeton, seance }` — crée la séance ; ne reprend **jamais** une séance existante (409) |
| `POST /api/reprise` | `{ exercice, matricule, nip }` | `{ jeton, seance }` — ni prénom ni nom ; 404 s'il n'y a pas de séance |
| `POST /api/identite` | jeton, `{ exercice, prenom, nom, matricule, nip }` | `{ seance }` — « Corriger mon identité » : NIP exigé, séance **déplacée, jamais copiée**, correction journalisée ; le jeton ne change pas ; après la réussite, l'attestation est annulée et réémise (D37, §8) |
| `GET /api/seance?exercice=<id>` | jeton | `{ seance }` — l'état, sans rien tirer |
| `POST /api/question` | jeton, `{ exercice }` | `{ seance }` — avec la question mémorisée, tirée au besoin ; `question` vaut `null` si l'exercice est réussi |
| `POST /api/correction` | jeton, `{ exercice, saisies }` | `{ correction, seance }` — `seance` porte déjà la question suivante, ou la réussite |
| `POST /api/deconnexion` | jeton, `{ exercice }` | `{ deconnecte: true }` — « Changer d'étudiant » : le jeton ne vaut plus rien |
| `GET /api/attestation?exercice=<id>` | jeton | `{ attestation, code, signature, url_verification, annulee_le }` — l'attestation de la séance réussie (§8), créée à la première ouverture pour une séance réussie avant le jalon 5 ; 409 si l'exercice n'est pas réussi |
| `POST /api/verification` | `{ code }`, ou tous les champs de l'adresse du QR | `{ resultat: "valide", attestation }`, `{ resultat: "annulee", attestation, annulee_le, motif }`, `{ resultat: "aucune" }` ou `{ resultat: "invalide" }` — public, sans jeton (§8) |
| `POST /api/prof/connexion` | `{ cle }` | `{ enseignant, role, expire_le }` + cookie `prof` (HttpOnly, Secure, SameSite=Strict, chemin `/api/prof`, 12 h) — `role` : `admin` (`CLE_ADMIN`) ou `consultation` (`CLE_CONSULTATION`, D44) ; 401 clé incorrecte ; 429 après cinq échecs par adresse, délai croissant |
| `POST /api/prof/deconnexion` | — | `{ deconnecte: true }` + cookie effacé |
| `GET /api/prof/seances` | cookie | `{ enseignant, role, exercices, seances: [ { id, exercice: { id, titre }, prenom, nom, matricule, debut, derniere_activite, reussite_le, questions_reussies, code } ] }` — toutes les séances ; ni NIP, ni jeton, ni question |
| `POST /api/prof/remise-a-zero` | cookie **admin**, `{ seance }` | `{ remise_a_zero: true, seance }` — D35 ; 404 séance inconnue |
| `POST /api/prof/reinitialisation-nip` | cookie **admin**, `{ seance }` | `{ nip_reinitialise: true, seance }` — D38 : NIP effacé, verrou levé, progression intacte ; 404 séance inconnue |
| `POST /api/prof/suppression` | cookie **admin**, `{ seance }` | `{ supprimee: true, seance }` — D45 : la séance et son journal disparaissent, ses attestations restent, annulées « séance supprimée » ; 404 séance inconnue |
| `POST /api/prof/effacement` | cookie **admin**, `{ confirmation: "EFFACER" }` | `{ efface: true, nombres: { seances, corrections, corrections_identite, attestations, debit, verrous, journal_anonymise } }` — D46 : tout est effacé sauf le journal des actions, gardé anonymisé ; 400 sans le mot exact, rien n'est touché |
| `GET /api/prof/identites` | cookie | `{ corrections }` — le journal des corrections d'identité (D23), la plus récente en premier, avec l'exercice et le matricule actuel de la séance |

Aucune route `/api/prof/*` ne répond sans cookie valide (401 « Connexion
requise. ») ; les routes d'action (**admin**) refusent le rôle consultation
(403, D44).

**L'éditeur** (`/api/prof/editeur/*`, décisions D47 à D49) : toutes les routes
exigent le cookie avec le **rôle admin** (403 sinon), et chaque action est
inscrite au journal des actions. Les corps sont en JSON, jusqu'à 4 Mo (un import
porte toute la sauvegarde).

| Appel | Requête | Réponse |
|---|---|---|
| `GET /api/prof/editeur/exercices` | cookie admin | `{ exercices: [ { id, titre, modifie, derniere_version, publie_le, archive_le, brouillon_modifie_le, seances, versions: [ { id, numero, tables_id, publiee_le, seances } ], liste } ] }` — `modifie` : le brouillon diffère de la dernière version (ou jamais publié) |
| `GET /api/prof/editeur/exercice?id=<id>` | cookie admin | `{ exercice: { id, brouillon, revision, brouillon_modifie_le, publie_le, archive_le }, versions, derniere_version: { numero, contenu, tables_id, publiee_le } ou null, tables, erreurs }` — `erreurs` : celles du brouillon (`draftErrors`), chacune avec son `champ` ; 404 inconnu |
| `POST /api/prof/editeur/exercice/creer` | `{ id, titre }` ou `{ id, depuis }` (dupliquer) | `{ cree: true, id }` — un brouillon, jamais publié ; 400 identifiant ou titre, 409 identifiant pris |
| `POST /api/prof/editeur/exercice/enregistrer` | `{ id, revision, brouillon }` | `{ enregistre: true, revision, erreurs }` — enregistré même en erreur ; **409** si la révision n'est plus celle lue (D48, `revision_actuelle` jointe), rien n'est écrasé |
| `POST /api/prof/editeur/exercice/renommer` | `{ id, titre }` | `{ renomme: true, titre }` — le titre du brouillon (à publier) |
| `POST /api/prof/editeur/exercice/archiver` | `{ id, archive }` | `{ archive, id }` |
| `POST /api/prof/editeur/exercice/supprimer` | `{ id }` | `{ supprime: true, id }` — 409 s'il a des séances (archiver alors) |
| `POST /api/prof/editeur/exercice/publier` | `{ id, revision }` | `{ publie: true, numero, publiee_le }` — le brouillon devient la version suivante ; 400 s'il a des erreurs (`erreurs` jointes), 409 révision périmée |
| `POST /api/prof/editeur/apercu` | `{ id, brouillon }` ou `{ id, version }` | `{ questions: [ { identifiant, outil_id, outil, operation, dimension, barre, dents, materiau_outil, materiau, reponses } ], champs_evalues }` — dix questions, rien d'enregistré (D49) ; 400 brouillon en erreur |
| `GET /api/prof/editeur/banque` | cookie admin | `{ outils: [ { id, outil, revision, rang, archive_le, modifie_le, exercices } ], tables }` — `exercices` : ceux dont le brouillon a une copie de cet outil |
| `GET /api/prof/editeur/tables` | cookie admin | `{ tables: { id, materiaux, operations } }` — les tables les plus récentes |
| `POST /api/prof/editeur/banque/creer` | `{ id, outil }` ou `{ id, depuis }` | `{ cree: true, id }` |
| `POST /api/prof/editeur/banque/enregistrer` | `{ id, revision, outil }` | `{ enregistre: true, revision, erreurs }` — 409 révision périmée |
| `POST /api/prof/editeur/banque/archiver` | `{ id, archive }` | `{ archive, id }` |
| `GET /api/prof/editeur/export` | cookie admin | `{ format, exporte_le, version_serveur, tables_reference, banque, exercices: [ { id, brouillon, archive_le, cree_le, publie_le, versions } ] }` — la sauvegarde complète, sans données d'étudiants (D49) |
| `POST /api/prof/editeur/import/valider` | `{ export }` | `{ erreurs, resume }` — ce que l'import ferait ; rien n'est écrit |
| `POST /api/prof/editeur/import` | `{ export, confirmation: "IMPORTER" }` | `{ importe: true, resume }` — fusion en un seul lot (D49) ; 400 sans le mot ou avec des erreurs, rien n'est touché |

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
| 400 | requête invalide : JSON illisible, exercice inconnu ou jamais publié, exercice archivé pour une nouvelle séance, identification mal formée (le message dit quoi) ; éditeur : identifiant ou titre, brouillon en erreur à la publication, mot d'import absent |
| 401 | NIP incorrect (reprise, correction d'identité) ; ailleurs : jeton absent, inconnu, expiré ou **d'un autre exercice** → l'étudiant s'identifie de nouveau ; espace professeur : clé incorrecte, ou cookie absent, forgé ou expiré |
| 403 | espace professeur : action réservée à la clé d'administration, refusée au rôle consultation (D44) |
| 404 | adresse inconnue sous `/api/` ; reprise : aucune séance pour ce matricule dans cet exercice ; espace professeur : séance inconnue |
| 409 | création ou correction d'identité : ce matricule a déjà une séance pour cet exercice ; correction : aucune question n'attend de correction (exercice réussi, question pas encore tirée, ou devenue caduque) → le navigateur redemande la question ; attestation : l'exercice n'est pas encore réussi ; éditeur : révision périmée (enregistré ailleurs entre-temps, D48), identifiant pris, exercice à séances qu'on voudrait supprimer |
| 429 | reprise et correction d'identité : 5 essais de NIP en 10 minutes → verrou de 10 minutes, même pour le bon NIP ; correction : moins de 10 s depuis la précédente (`attendre_s` dit combien) ; consultation et vérification : limite de débit par adresse (§8) ; connexion professeur : cinq échecs par adresse, puis délai croissant |
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

**Cadence réglable (D39).** La variable `CADENCE_S` (secondes entières) règle la
cadence entre deux corrections, sous les mêmes verrous que `MODE_TEST` : jamais
dans `wrangler.jsonc` ni dans le déploiement, et honorée seulement pour une
requête adressée au poste lui-même (`cadenceFor`, `worker/seance.js`) ; ailleurs
la cadence reste 10 s. `npm run test:api` s'en sert (`CADENCE_S:1`) pour le
cycle complet, après avoir vérifié la cadence réelle.

L'exercice `test-complet` (§10) sert à cet essai. Plus tard, le mode pourra
s'ouvrir aux séances d'un **professeur connecté** (jalon 5 ou 6) ; pour toute
séance d'étudiant, la règle « rien de ce qui est à trouver ne part au
navigateur » reste entière.

**Tests.** `npm test` fait tourner le vrai Worker sur une base SQLite en mémoire
(`node:sqlite`) où les vraies migrations sont appliquées, avec une horloge
réglable (`tests/worker-api.test.js`). `npm run test:api` rejoue un scénario par
HTTP sur `wrangler dev` et une vraie D1 locale.

## 8. Identification de l'étudiant, attestation, vérification, espace professeur

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
- Un NIP oublié est **remis à zéro par l'enseignant** (espace professeur,
  D38) : l'étudiant en choisit un nouveau à sa prochaine reprise. Une
  séance ouverte par un autre au matricule d'un étudiant — farce visible aux
  horodatages — se **supprime** depuis le même espace (D45).
- Le navigateur vérifie la forme des champs avant l'envoi
  (`site/js/identification.js`) ; le serveur revérifie tout.

**La preuve de réussite est l'attestation**, que l'étudiant enregistre en PDF
et remet sur Léa (décision D16). Le QR code sert à l'enseignant pour vérifier
une attestation en cas de doute.

Moodle est abandonné (D16) : ni numéro Moodle, ni code de réussite. La formule
du classeur (`calcCodeM`) reste dans `legacy/vba/` pour mémoire.

### Attestation de réussite (décisions D31 à D33, D41)

**Enregistrement figé (D31).** Quand la dernière réussite exigée est obtenue —
par une correction, ou constatée à la demande de question quand l'exercice a
été allégé (D21) —, le serveur écrit un enregistrement qui **ne change plus** :

```json
{
  "code": "ABCDEFGHJK",
  "exercice": { "id": "m10-tournage-vc", "titre": "M10 — Tournage : vitesse de coupe" },
  "revision": "r0",
  "revision_tables": { "materiaux": "A2026_r0", "operations": "A2026_r0" },
  "etudiant": { "prenom": "Camille", "nom": "Tremblay", "matricule": "2412345" },
  "debut": "2026-09-21T13:05:00.000Z",
  "reussite_le": "2026-09-21T13:48:10.000Z",
  "questions_reussies": 15,
  "outils": [ { "id": "mclnr", "nom": "MCLNR", "plage": "10 mm à 20 mm", "operation": "Chariotage ébauche", "reussites": 1, "requises": 1 } ],
  "questions": [ { "numero": 3, "outil_id": "mclnr", "outil": "MCLNR - Ø charioté: 10 mm", "materiau_outil": "Insert de carbure de tungstène",
                   "materiau": { "classe": "H", "groupe": 39, "materiau": "Acier durci", "etat": "Durci et revenu" },
                   "reponses": { "vc": "40" }, "horodatage": "2026-09-21T13:12:05.000Z" } ]
  // numero : le rang dans la liste (1 à n) ; reponses : normalisées au format d'affichage (D43)
}
```

- `revision` : la version de l'exercice à la réussite (`version_exercice_reussite`) ;
  `revision_tables` : la révision de chaque table de référence (clé `revision`
  de `materiaux.json` et `operations.json`, D28) ;
- `outils` : exactement `progression.outils` tel que le serveur le montre à
  l'écran (§7) — `nom`, `operation` et `plage` (celle que l'exercice permet,
  D30) **copiés à cet instant** et plus jamais relus ; `reussites` est le
  compteur de l'outil, `requises` ce que l'exercice exigeait ;
- `questions` (D41) : **les questions réussies qui comptent** — pour chaque outil, la série
  finale de réussites consécutives (ses `reussites` dernières questions réussies, donc toutes
  après son dernier échec), dans l'ordre chronologique. Chaque entrée est copiée du **journal des
  corrections** : `numero` (le rang dans la liste, de 1 à n — jamais le rang dans la séance, qui
  révélerait les échecs : D43), `outil_id`, `outil` (le nom tel qu'affiché à l'étudiant : gabarit
  résolu, §4.6), `materiau_outil`, `materiau` (classe ISO, no de groupe, nom, état), `reponses`
  (les réponses de l'étudiant aux grandeurs évaluées seulement, sous les noms du moteur,
  **normalisées** : le nombre lu, écrit au format d'affichage de la grandeur, §5 — « 400,0 » →
  « 400 », « 1 600 » → « 1600 »), `horodatage`. Une attestation figée avant cette liste n'en a
  pas, et reste valide telle quelle ;
- une correction d'identité postérieure **annule et réémet** l'attestation
  (D37, ci-dessous) : les résultats, les dates et la liste sont repris tels quels.

Une séance réussie **avant le jalon 5** reçoit son enregistrement à la
première ouverture de l'attestation (`GET /api/attestation`), à partir de la
progression enregistrée et de l'exercice tel qu'il est alors. Plusieurs
requêtes qui constatent la réussite en même temps n'en créent qu'une.

**Code et signature (D32).** Le code est tiré au hasard, sans biais, dans
`23456789ABCDEFGHJKMNPQRSTVWXYZ` (30 caractères : ni 0, O, 1, I, L ni U),
10 caractères, unique, présenté `XXXXX-XXXXX` ; la saisie tolère minuscules,
espaces et tirets. La signature est HMAC-SHA-256(sous-clé « attestation »,
sérialisation canonique de l'enregistrement) en base64url ; la sérialisation
canonique est le JSON de l'enregistrement, clés triées à tous les niveaux, sans
espace (`worker/attestation.js`). Toute comparaison de signature se fait en
temps constant.

**Correction d'identité après la réussite (D37).** « Corriger mon identité »
est offert sur la page de l'attestation, NIP exigé. Si l'identité change, le
même lot déplace la séance, marque l'attestation en cours annulée (motif
`identite_corrigee`) et en insère une nouvelle : l'enregistrement est repris
tel quel avec la nouvelle identité et un nouveau code, puis signé. L'ancien code
répond « annulée » avec le motif ; le journal des corrections d'identité note
`ancien_code` et `nouveau_code`. Sans changement, rien n'est réémis. Si le code tiré pour la
réémission est déjà pris, un autre est tiré (D42).

**La page de l'attestation** (`UI.md` §3.6) : format lettre, en-tête du
département sur trois lignes, identité, exercice, version et révision des
tables, dates, tableau
des opérations effectuées (opération, outil, plage, réussites obtenues /
exigées), code QR avec le code court dessous, mention « Vérification :
<adresse du site>/verifier — code XXXXX-XXXXX », puis le **tableau des
questions réussies qui comptent** (numéro, outil, matière de l'outil, matériau
usiné, une colonne par grandeur évaluée, date et heure) — une page quand ça
tient, sinon la suite sur une deuxième page avec l'en-tête (D41) —, pied
« TGM-TMI — TLP — <année> », « Page n de N ». Bouton **Enregistrer en PDF** : l'impression du navigateur (le PDF
vient du navigateur, jamais du serveur), nom de fichier proposé
`Attestation-<exercice>-<Nom>-<Prenom>.pdf`. Un étudiant retrouve son
attestation par la reprise de séance quand l'exercice est réussi.

**Contenu du QR (D33).** L'adresse de vérification, absolue, sur l'origine de
la requête (le site peut déménager : l'adresse n'est pas dans
l'enregistrement) :

```
https://<site>/verifier?exercice=…&matricule=…&nom=…&prenom=…&reussite=<ISO>&revision=…&questions=15&code=XXXXX-XXXXX&signature=<base64url>
```

Un lecteur de QR quelconque montre ces données sans le site ; le site, lui,
vérifie. L'adresse fait environ 240 caractères : un QR de version 12
(65 modules), lisible à 1,7 po sur une attestation imprimée.

### Vérification publique (`/verifier`, décision D33)

Sans connexion. Deux entrées : l'adresse du QR (la page vérifie d'elle-même),
ou la saisie du code court (ou d'une adresse collée entière). Le serveur
(`POST /api/verification`) :

1. retrouve l'enregistrement par le code → sinon **aucune** attestation ne
   correspond ;
2. **recompose la signature** à partir de l'enregistrement qu'il détient ; elle
   doit être celle qu'il a stockée et, si l'adresse en porte une, celle de
   l'adresse ; et chaque champ de l'adresse doit être égal à celui de
   l'enregistrement — sinon **invalide** (signature invalide ou contenu
   modifié). Une attestation ne se vérifie pas à moitié : une adresse qui porte
   autre chose que le code doit tout porter ;
3. si l'attestation a été annulée — remise à zéro (D35), identité corrigée
   (D37) ou séance supprimée (D45) → **annulée**, avec la date et le motif ;
4. sinon **valide**, avec l'enregistrement complet tel que le serveur le
   détient, tableau des opérations et liste des questions réussies (D41)
   compris.

La page ne divulgue rien de plus que l'attestation imprimée : ni journal, ni
corrections d'identité, ni durées. Elle est soumise aux limites de débit
(ci-dessous).

### Espace professeur (`/prof`, décisions D34, D35, D38, D44 à D46)

- **Deux clés, deux rôles** (D44) : `CLE_ADMIN` ouvre le rôle **admin** (tout),
  `CLE_CONSULTATION` — facultative, partagée entre collègues — le rôle
  **consultation**, lecture seule : tableau, filtre, tri, recherche, export
  CSV, journal des corrections d'identité ; aucun bouton d'action, et chaque
  route d'action refuse ce rôle côté serveur (403). La séance professeur porte
  un identifiant d'enseignant (le nom du rôle, tant qu'il n'y a pas de table
  des enseignants) et le rôle, que le journal des actions note.
- **Connexion** : saisie de la clé, comparée en temps constant après hachage
  aux deux clés ; puis un **cookie de séance signé** (sous-clé « prof »,
  charge = enseignant, rôle et expiration ; `HttpOnly`, `Secure`,
  `SameSite=Strict`, chemin `/api/prof`, 12 h). **Se déconnecter** efface le
  cookie. **Cinq essais ratés par adresse**, quelle que soit la clé visée, puis
  un délai qui double à chaque échec (1, 2, 4… minutes, plafonné à une heure) ;
  chaque refus et chaque connexion sont journalisés.
- **Réussites par exercice** : le tableau des séances (nom, prénom, matricule,
  exercice, début, dernière activité, réussi le … ou en cours, questions
  réussies, code de l'attestation), filtre par exercice, tri par colonne,
  recherche par matricule ou par nom (sans casse ni accents). Tout se fait dans
  le navigateur (`site/js/ui/prof-data.js`).
- **Export CSV** de la liste affichée : UTF-8 avec BOM, séparateur `;`, CRLF,
  dates ISO 8601 à l'heure du poste avec un espace entre la date et l'heure
  (`2026-09-21 13:48:10` : Excel en français le reconnaît, pas le « T »).
- **Remise à zéro** d'une séance, avec confirmation : la progression revient à
  zéro (compteurs, question en attente, dates de réussite et de dernière
  correction, version à la réussite), la séance reste (identifiant, matricule,
  NIP, jeton, début, journal des corrections) ; l'attestation en cours est
  **marquée annulée** avec la date ; l'action est journalisée (date,
  enseignant, séance, action). Une nouvelle réussite crée une nouvelle
  attestation, avec un autre code.
- **Réinitialisation du NIP** (D38), avec confirmation : NIP effacé, essais et
  verrou levés, progression et jeton intacts ; l'étudiant choisit un nouveau NIP
  à sa prochaine reprise. Journalisée.
- **Suppression d'une séance** (D45), rôle admin, avec une confirmation qui
  rappelle le nom et le matricule : la séance disparaît avec son journal des
  corrections et ses corrections d'identité ; ses **attestations restent**,
  l'attestation en cours **annulée « séance supprimée »** avec la date, ce que
  `/verifier` dit (une attestation déjà annulée garde son motif). Journalisée,
  sans lien vers la séance : l'étudiant et le numéro de séance sont dans les
  détails. L'étudiant peut recommencer de zéro.
- **Effacement des données des étudiants** (D46), rôle admin, sur une page à
  part : export CSV de tout proposé d'abord, puis le mot **EFFACER** à taper,
  exigé aussi par le serveur (400 sinon). Toutes les séances, journaux de
  corrections, corrections d'identité et attestations, ainsi que les compteurs
  de débit et les verrous par adresse (ci-dessous), sont supprimés en un seul
  lot ; le **journal des actions reste**, détaché des séances et **anonymisé**
  (dans ses détails, noms, matricules et codes d'attestation deviennent « — » ;
  date, rôle, action, exercice et nombres restent), et note les nombres effacés.
  Les anciens codes d'attestation répondent ensuite « aucune attestation ne
  correspond ». Exercices, banque d'outils et données de référence ne sont pas
  en base : jamais touchés.
- **Journal des corrections d'identité** (D23) : la plus récente en premier,
  avec l'exercice, le matricule actuel, avant → après, l'attestation réémise
  s'il y en a une (D37), et la séance.
- Aucune route `/api/prof/*` ne répond sans cookie valide ; le client ne
  contient aucun secret. Ordinateur d'abord, lisible à 390 px.
- **L'éditeur des exercices** (`/prof/editeur`, décisions D47 à D49 ; `UI.md`
  §3.9) : la même connexion, **rôle admin seulement** — la clé de consultation est
  refusée à la connexion et par chaque route. Exercices (brouillon, versions,
  aperçu, publication), banque d'outils, sauvegarde (export, import) : §10.
- Reste à faire (`PLAN.md`) : une clé par enseignant avec une table des
  séances professeur, pour révoquer une séance avant son expiration.

### Limites de débit par adresse (décision D36)

Consultation d'un matricule (`/api/consultation`) et vérification d'un code
(`/api/verification`) : au plus **100 valeurs distinctes par adresse IP et par
heure** (tranche horaire UTC), aucune limite sur le nombre de requêtes (tous les
postes du cégep sortent par une seule adresse). La 101ᵉ valeur est refusée
(429, `attendre_s`) et **verrouille l'adresse 10 minutes** ; une valeur déjà
vue passe toujours ; une valeur refusée n'est pas comptée comme vue. Les
compteurs vivent en D1 (tables `debit` et `verrous`), pas dans le service de
limitation de Cloudflare : il compte des requêtes, pas des valeurs distinctes,
et ne se teste pas sous `node --test` avec une horloge réglable. L'adresse est
`cf-connecting-ip` ; sans cet en-tête (tests sous Node), une seule adresse
« inconnue ». La connexion professeur a son propre verrou (ci-dessus).

L'ancien QR du classeur (`https://thierryleroux.github.io/tgm-fab/?data=…` :
champs `;`-séparés, décalage César +4, base64, décodé par `legacy/index.htm`)
était reproductible par quiconque lisait le code : il n'est pas repris. D19
ferme D6.

## 9. Exigences non fonctionnelles

- **Un site sans étape de construction et un serveur de correction**
  (décisions D19, D20, D22) : un seul Worker Cloudflare sert `site/`
  (HTML/CSS/JS, JSON ; trois pages : le quiz, `/verifier`, `/prof`) tel quel
  et expose l'API `/api/` ; base D1 pour les séances, le journal des
  corrections, les attestations et le journal d'enseignant. Publié par GitHub Actions à chaque push
  sur `main` : `npm test`, puis les migrations de la base, puis
  `wrangler deploy`.
- Fonctionne dans les navigateurs récents du laboratoire et sur téléphone.
- Interface en **français**.
- **Durable** : sans étape de compilation obligatoire, dépendances minimales et
  épinglées (`qrcode-generator` 2.0.4 copié dans `site/vendor/` pour le QR,
  `wrangler` pour développer et publier), données modifiables par l'enseignant
  en éditant les JSON.
- Le **moteur de calcul et de correction est testé unitairement** (cas tirés du
  classeur), tout comme le serveur (§7, « Tests »). Node ≥ 22.13 pour
  développer ; rien à installer pour l'étudiant.
- **Les exercices, la banque d'outils et les tables de référence vivent dans la
  base D1** (D47) et s'éditent en production (D48) ; la sauvegarde est l'export
  JSON de l'éditeur (D49, `DEMARRAGE.md` §7).
- **Données personnelles** : prénom, nom, matricule, NIP haché, réponses et
  résultats ne vont qu'au serveur de correction du projet, et sont **effacés par l'enseignant
  en fin de session** (§8, D46). Rien n'est envoyé à un tiers, et la page ne charge
  rien d'un domaine externe (polices auto-hébergées, `UI.md` §1). Le navigateur
  ne garde que `{ matricule, prenom, jeton }` (§7). Pied de page : « Tes
  réponses sont corrigées par un serveur ; tes données sont effacées à la fin de
  la session. »

## 10. Configuration d'un exercice (décisions D11, D47 à D49)

Le **catalogue** (§3) décrit le métier ; un **exercice** choisit ce qui est
évalué. Deux formats coexistent :

- le **fichier d'exercice** `site/exercices/<id>.json`, ci-dessous : des
  références aux outils du catalogue avec des restrictions. Depuis D47, il ne
  sert plus qu'à la **semence** et aux **tests** (`test-complet` compris) ; le M10 du
  classeur est `site/exercices/m10-tournage-vc.json` ;
- l'**exercice enregistré** en base — brouillon et versions —, avec ses **copies
  d'outils** (« Exercice enregistré », plus bas), que l'éditeur produit et que le
  serveur sert.

La fonction `draftFromExercise` (`exercice.js`) convertit le premier dans le
second ; `engineExercise` rend le second au moteur.

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
| `materiaux_outil` | non | restreint le tirage du matériau d'outil pour **tous** les outils de l'exercice (D40) ; chacun doit être un matériau d'outil du catalogue (§3). Se croise avec les matériaux de chaque outil et avec `outils[].materiaux_outil` ; un outil qui n'aurait plus aucune matière permise rend l'exercice invalide (le message nomme l'outil, ce qu'il offre et ce que l'exercice permet) |
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
  qu'un exercice écarte les micro-forets (D14), et par `materiaux_outil` à la
  racine qu'il écarte une matière d'outil partout (D40 : « jamais de carbure de
  tungstène solide »).
- **Clé inconnue = erreur.** Une faute de frappe (« dimension » pour
  « dimensions ») lèverait sinon une restriction en silence. Seules les clés
  commençant par `_` (commentaires, comme `_source`) sont ignorées.
- `groupes` (facultatif, jalon 7) : comme `materiaux_outil`, restreint les groupes de
  matériaux usinés pour **tous** les outils ; un outil sans plus aucun groupe rend
  l'exercice invalide.
- La validation (`site/js/exercice.js`) est la même pour les tests, le quiz et
  l'éditeur.
- **Liste des exercices offerts** : le serveur la compose (`GET /api/exercices`, D47)
  — les exercices publiés, non archivés, sans `"liste": false` —, et
  `site/exercices/index.json` ne sert plus qu'aux tests et à la semence.
  `?exercice=<id>` dans l'adresse choisit un exercice **publié**. Il n'y a **pas
  d'exercice par défaut** (décision D18) : `?exercice=` absent → l'accueil affiche
  la liste ; id inconnu, jamais publié → l'accueil affiche « L'exercice « <id> »
  n'existe pas — vérifie le lien sur Léa », puis la même liste ; archivé →
  l'accueil le dit, une séance en cours se reprend encore. « index » est un
  identifiant réservé.
- **`m10-tournage-vc-rpm`** (décisions D40, D43) : « M10 — Tournage : Vc et RPM »,
  `champs_evalues` `["vc", "n"]`, acier rapide ou insert de carbure seulement,
  onze outils de pointage, perçage, alésage à la barre et filetage, deux
  réussites de suite chacun (22 questions), listé à l'accueil.
- **`test-complet`** (décision D26) : exercice de test pour l'enseignant — tous
  les outils du catalogue, les cinq grandeurs, une réussite par outil, aucune
  restriction, `"liste": false`. Un test vérifie qu'un outil ajouté au catalogue
  y figure. Il est dans l'index (le serveur ne connaît que l'index) mais pas
  dans la liste de l'accueil ; joignable par `?exercice=test-complet`, il ne
  donne aucune réponse en production (le mode test n'existe qu'en local, §7).
- Reporté : seuils du graphique de progression (finition).

### Exercice enregistré : brouillon et versions (décisions D47 à D49)

Un exercice en base, c'est un **identifiant d'URL** (définitif : c'est le lien
sur Léa), un **brouillon** et des **versions publiées** numérotées 1, 2, 3…,
immuables. Brouillon et version ont la même forme :

```json
{
  "titre": "M10 — Tournage : vitesse de coupe",
  "champs_evalues": ["vc"],
  "materiaux_outil": ["Acier rapide", "Insert de carbure de tungstène"],
  "groupes": ["P - Acier non allié"],
  "liste": false,
  "outils": [
    { "id": "mvlnr", "reussites_requises": 3, "origine": "mvlnr",
      "nom": "MVLNR", "format_identifiant": "MVLNR - Ø charioté: [IdDia]", "commentaire": "Outil de finition", "operation": "Chariotage finition",
      "fact_vc": 1, "fact_av": 1, "limite_rpm": 3000, "limite_avance": 0.01, "nb_dents_min": 1, "nb_dents_max": 1,
      "materiaux_outil": ["Insert de carbure de tungstène"], "groupes_materiaux_usinables": ["P - Acier non allié", "…"],
      "image": "mvlnr", "dimensions": [ { "libelle": "1.000\"", "valeur": 1 } ] }
  ]
}
```

- `materiaux_outil`, `groupes` et `liste` sont facultatifs, avec le même sens que
  dans le fichier d'exercice ; `titre`, `champs_evalues` et `outils` sont
  obligatoires ; la **version** n'est pas dans le contenu : c'est le numéro attribué
  à la publication.
- Chaque entrée d'`outils` est une **copie complète** d'un outil (toutes les clés
  d'`outils.json`, `TOOL_KEYS`), plus `reussites_requises` (entier ≥ 1) et
  `origine` (l'id de l'outil de la banque dont elle vient, à titre d'information).
  Son `id` est unique dans l'exercice (« mvlnr », puis « mvlnr_2 » pour une
  copie dupliquée) ; `image` nomme sa photo (`site/img/outils/<image>.png`).
  **Ses dimensions, ses matières et ses groupes sont ce que l'exercice permet** :
  il n'y a plus de restriction par outil, on retire de la copie.
- **Validation** (`draftErrors`, la même dans l'éditeur et sur le serveur) : les
  règles du fichier d'exercice, plus celles de `validateData` pour chaque copie
  (`toolErrors`), chaque erreur nommant son champ (« outils.1.fact_vc »). Un
  brouillon en erreur s'enregistre, mais ne se publie pas.
- **Publier** = copier le brouillon tel quel comme version suivante, avec la
  version des tables de référence la plus récente. Le brouillon reste, modifiable.
  Le serveur sert la dernière version ; une séance garde la sienne (§7).
- **Semence** (migration `0005`) : les deux M10 du dépôt, convertis par
  `draftFromExercise`, version 1 ; `test-complet` n'est pas semé (il ne sert
  qu'aux tests, où il est publié à la volée).
- **Sauvegarde** : l'export JSON de l'éditeur (`format`
  « quiz-parametres-coupe/editeur/1 ») contient les tables de référence, la
  banque et les exercices avec toutes leurs versions ; l'import **fusionne**
  (ajoute ce qui manque, remplace les brouillons et la banque, ne supprime jamais
  une version ni un exercice, refuse une version différente sous un numéro
  existant) et ne touche ni aux séances ni aux attestations (D49).

## 11. Questions ouvertes (résumé)

1. ~~Arrondis des valeurs théoriques (§5).~~ Tranché : voir §5.
2. ~~Réussites consécutives ou cumulées (§7).~~ Tranché : consécutives (D12).
3. ~~Vérification du code : Moodle seul ou aussi QR (§8).~~ Tranché : plus de Moodle ; rapport PDF remis sur Léa, QR pour l'enseignant (D16).
4. ~~Sécurité du payload QR (§8 / D6).~~ Tranché : attestation signée par le serveur de correction (D19).
5. Nouveau code dans le dépôt `tgm-fab` (à côté de `index.htm`) ou dépôt dédié ? (D7)
6. ~~Serveur de correction : cinq points du §7.~~ Tranchés : D21.
7. ~~Un N calculé avec 12/π puis arrondi à l'entier (§5).~~ Tranché : tolérance de N élargie de ±1 rév/min (D13, complément).
8. ~~Barres de la barre à aléser et rapport 0,75 (§3, D25).~~ Confirmés (D30).
