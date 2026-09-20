# Spécification fonctionnelle — Quiz de paramètres de coupe (version web)

Statut : **brouillon v0.1** (2026-09-19). Rédigée à partir de l'analyse du classeur
`Exercice M10 - tournage - vc seulement - version étudiant_r0.xlsm` et de son VBA
(voir `legacy/vba/`). Les points marqués ❓ sont à confirmer avec Thierry.

## 1. Objectif

Exerciseur auto-corrigé où l'étudiant calcule les paramètres de coupe d'une
opération d'usinage tirée au hasard (outil × dimension × matériau brut), jusqu'à
démontrer la maîtrise de chaque type d'outil. À la réussite, un **rapport** est
produit, que l'étudiant enregistre en PDF et remet sur Léa ; il porte un
**QR code** de vérification pour l'enseignant (décision D16).

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
| `materiaux.json` | 47 matériaux, classes ISO 513 P/M/K/N/S/H/O, groupe VDI 3323, dureté, exemple AISI/SAE, **Vc (pi/min)** pour 3 matériaux d'outil | `Vitesses de coupe` / `tblVitesse` |
| `operations.json` | 19 opérations : machine, direction d'avance, avance/rév., avance max, drapeaux *filetage* et *proportionnelle au Ø* | `Avances d'usinage` / `tblAvance` |
| `outils.json` | 29 outils : opération, facteurs Vc/avance, limites RPM/avance, plage de nb de dents, matériaux d'outil possibles, groupes ISO usinables, liste des dimensions (libellé + valeur) | `Liste d'outils` (masquée) |

Unités : **impériales** (pouces, pi/min, rév/min, po/min). Les dimensions
métriques sont déjà converties en pouces dans `outils.json` ; le libellé affiché
reste métrique (ex. « 10 mm »).

Champ `limite_avance` de `outils.json` : présent dans le classeur, **non utilisé
par le moteur** (ni par le VBA). Le seul plafond d'avance est
`avance_max_po_rev` de l'opération (§5).

Groupes « O - Plastique renforci d'aramid » et « O - Graphite » : **volontairement** attachés à aucun outil (jugés trop rares pour les étudiants) ; ils restent au catalogue pour pouvoir l'être plus tard.

Les images d'outils (29, EMF/PNG dans le classeur) restent à exporter — champ
`image` vide pour l'instant.

## 4. Génération d'une question

1. **Outil** : tirage uniforme parmi les outils *encore à évaluer* de l'exercice (voir §7 et §10). Les restrictions de l'exercice (dimensions, matériaux d'outil, groupes) s'appliquent aux tirages 3, 4 et 5.
2. **Nombre de dents** : entier uniforme dans `[nb_dents_min, nb_dents_max]`.
3. **Dimension** : tirage uniforme dans `dimensions[]` de l'outil.
   - Outil de filetage : libellé du type `Ø-filets/po` (impérial : `0.25-20` → Ø 0,25 po, pas = 1/20 po) ou `ØxPas` mm (métrique : `10x1.5` → Ø 10/25,4 po, pas = 1,5/25,4 po).
   - Sinon : Ø en pouces.
4. **Matériau d'outil** : tirage uniforme dans `materiaux_outil[]`.
5. **Matériau brut** : tirage d'un *groupe* dans `groupes_materiaux_usinables[]`, puis tirage uniforme d'un matériau de ce groupe dans `materiaux.json`.
6. **Identifiant affiché** : gabarit `format_identifiant` avec substitution des jetons. Liste officielle (tout autre jeton est une erreur) :

   | Jeton | Remplacé par |
   |---|---|
   | `[IdDia]` | libellé de la dimension tirée (ex. « 1/4 po », « M10 x 1.50 ») |
   | `[NbDent]` | nombre de dents tiré |
   | `[NomOutil]` | `nom` de l'outil |
   | `[Operation]` | `operation` de l'outil |
   | `[Matoutil]` | matériau d'outil tiré (ex. « Acier rapide ») |

   Les autres jetons du VBA (`[Pas]`, `[Dia]`, `[Couleur]`, etc.) ne sont pas repris.

## 5. Calcul des réponses attendues

Convention pédagogique du cours : `N = Vc × 4 / D` (approximation de 12/π ≈ 3,82).

```
Vc        = materiaux[matériau].vc_pi_min[matériau d'outil]              (pi/min)
N_brut    = Vc × 4 / D × fact_vc                                         (rév/min)
N         = min(N_brut, limite_rpm)

avance par dent (fz) :
  filetage                : fz = pas   (la table d'avance donne « pas du filetage »)
  proportionnelle au Ø    : fz = min(avance_po_rev × D × fact_av, avance_max_po_rev)
  fixe                    : fz = avance_po_rev

avance par révolution  f  = fz × nb_dents                                (po/rév)
vitesse d'avance       Vf = N × f                                        (po/min)
```

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
| N | de −90 % à +0,1 % (la vitesse peut être réduite pour fileter) | ±5 % | ±5 % |
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

## 7. Progression et réussite de l'exercice

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
- État de progression, sérialisable (`localStorage`) :
  `{ exerciceId, reussites: { [id d'outil]: n }, totalReussies }`.
- Un graphique de progression par opération est affiché (VBA `modAffGraph`).

### État d'une séance (`site/js/session.js`)

Toute la séance tient dans **un seul objet JSON**, conservé dans `localStorage`
sous **une seule clé** (`quiz-parametres-coupe:seance`), pour survivre à un
rechargement de la page. Rien n'est envoyé ailleurs (§9).

| Clé | Contenu |
|---|---|
| `version` | version du format de l'état ; un état d'une autre version est ignoré |
| `etudiant` | `{ prenom, nom, matricule }` (§8), en texte |
| `exerciceId`, `exerciceVersion` | l'exercice de la séance (§10) |
| `debut`, `reussite` | dates ISO ; `reussite` vaut `null` tant que l'exercice n'est pas complété |
| `progression` | compteurs de réussites consécutives (ci-dessus) |
| `question`, `saisies` | la question en cours et ce que l'étudiant a tapé, en texte |
| `correction` | résultat de la correction de la question en cours, `null` tant qu'elle n'est pas corrigée : une question ne peut être corrigée qu'une fois, même après un rechargement |
| `questionsReussies` | `{ question, attendu, date }` de chaque question réussie, pour le tableau du rapport (§8) ; rien n'en est retiré |

Le stockage n'est jamais fiable (navigation privée, quota, contenu abîmé) :
chaque lecture et chaque écriture est protégée. Stockage vide, illisible,
abîmé, d'une autre version, ou séance d'un autre exercice → l'application
démarre une nouvelle séance, sans erreur ; stockage en panne → elle continue
sans sauvegarde.

## 8. Identification de l'étudiant et rapport

Saisie au démarrage : prénom, nom, **matricule à 7 chiffres** (espaces autour
tolérés, conservé en texte). Rien d'autre.

**La preuve de réussite est le rapport**, que l'étudiant enregistre en PDF et
remet sur Léa (décision D16). Le QR code sert à l'enseignant pour vérifier un
rapport en cas de doute.

Rapport de réussite (présentation : `UI.md` §3.6) :
- exercice et sa version, prénom, nom, matricule, date/heure de début,
  date/heure de réussite, nombre de questions réussies ;
- tableau des questions réussies groupées par opération (outil, matériau,
  paramètres) ;
- **QR code** vers la page de vérification.

Moodle est abandonné (D16) : ni numéro Moodle, ni code de réussite. La formule
du classeur (`calcCodeM`) reste dans `legacy/vba/` pour mémoire.

### QR code et page de vérification

Aujourd'hui : `https://thierryleroux.github.io/tgm-fab/?data=<payload>` où
`payload` = champs `;`-séparés, URL-encodés, décalage César +4 sur chaque octet,
puis base64. `index.htm` (dans `legacy/`) décode et affiche.

**Faiblesse connue** : tout est reproductible par quiconque lit le JS de la
page. Décision à prendre (voir `DECISIONS.md`, D6 ouverte) : conserver tel quel,
ou signer le payload (ex. HMAC avec secret côté enseignant et vérification
hors ligne), sachant qu'un site statique ne peut pas cacher un secret.

## 9. Exigences non fonctionnelles

- **Site statique** (HTML/CSS/JS, JSON) hébergé sur GitHub Pages ; aucun serveur,
  aucune base de données, aucun compte.
- Fonctionne dans les navigateurs récents du laboratoire et sur téléphone.
- Interface en **français**.
- **Durable** : sans étape de compilation obligatoire, dépendances minimales et
  épinglées (QR code), données modifiables par l'enseignant en éditant les JSON.
- Le **moteur de calcul et de correction est testé unitairement** (cas tirés du
  classeur).
- Aucune donnée personnelle envoyée à un tiers ; l'état de la session peut être
  conservé localement (`localStorage`) pour survivre à un rechargement.

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
  l'éditeur (jalon 4).
- **Index des exercices offerts** : un site statique ne peut pas lister un
  dossier ; `site/exercices/index.json` dit quels exercices proposer, dans
  l'ordre d'affichage : `{ "exercices": [ { "id", "titre" }, … ] }`. Le premier
  est l'exercice par défaut ; `?exercice=<id>` dans l'adresse en choisit un
  autre **parmi ceux de l'index** (id inconnu ou absent → le premier). Chaque
  `id` a son fichier `<id>.json` et le même `titre` (vérifié par les tests) ;
  « index » est un identifiant réservé. Un fichier d'exercice absent de
  l'index n'est pas offert.
- Reporté : seuils du graphique de progression (jalon 5).

## 11. Questions ouvertes (résumé)

1. ~~Arrondis des valeurs théoriques (§5).~~ Tranché : voir §5.
2. ~~Réussites consécutives ou cumulées (§7).~~ Tranché : consécutives (D12).
3. ~~Vérification du code : Moodle seul ou aussi QR (§8).~~ Tranché : plus de Moodle ; rapport PDF remis sur Léa, QR pour l'enseignant (D16).
4. Sécurité du payload QR (§8 / D6).
5. Nouveau code dans le dépôt `tgm-fab` (à côté de `index.htm`) ou dépôt dédié ?
