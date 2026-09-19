# Spécification fonctionnelle — Quiz de paramètres de coupe (version web)

Statut : **brouillon v0.1** (2026-09-19). Rédigée à partir de l'analyse du classeur
`Exercice M10 - tournage - vc seulement - version étudiant_r0.xlsm` et de son VBA
(voir `legacy/vba/`). Les points marqués ❓ sont à confirmer avec Thierry.

## 1. Objectif

Exerciseur auto-corrigé où l'étudiant calcule les paramètres de coupe d'une
opération d'usinage tirée au hasard (outil × dimension × matériau brut), jusqu'à
démontrer la maîtrise de chaque type d'outil. À la réussite, un **rapport** est
produit avec un **code de réussite Moodle** et un **QR code** de vérification.

Public : étudiants du Cégep du Vieux Montréal, Techniques de génie mécanique
(profil fabrication) et Techniques de génie de la maintenance industrielle.

## 2. Portée de la version 1 (décision D2)

Tournage, fraisage et perçage complets : les 29 outils et 19 opérations du
classeur, et les 5 paramètres demandés (Vc, avance par dent, N, avance par
révolution, vitesse d'avance). La configuration d'un exercice (quels outils,
combien de réussites, quels champs pré-remplis) doit permettre de reproduire le
M10 actuel (« Vc seulement, tournage ») comme simple cas particulier.

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

Les images d'outils (29, EMF/PNG dans le classeur) restent à exporter — champ
`image` vide pour l'instant.

## 4. Génération d'une question

1. **Outil** : tirage uniforme parmi les outils *encore à évaluer* (voir §7).
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

**Arrondis (tranché).** Aucun arrondi sur les valeurs théoriques, comme dans le
VBA (arrondis commentés) : les tolérances du §6 absorbent les arrondis de
l'étudiant. L'arrondi n'existe qu'à l'**affichage**, dans une fonction de
formatage séparée du calcul (`site/js/format.js`) :

| Valeur | Affichage |
|---|---|
| N | entier |
| Avance par dent, avance par révolution | 4 décimales (5 en filetage) |
| Vitesse d'avance Vf | 3 décimales |

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
| Vitesse d'avance | ±0,5 % de *N_saisi × f_saisi* (cohérence interne) | ±5,1 % | ±25 % |

Précisions :

- Sauf mention contraire, l'intervalle est centré sur la **valeur théorique**
  (§5, non arrondie) et ses bornes sont incluses.
- « ±25 %, borné à ±0,001 po » : l'intervalle accepté est **le plus étroit** de
  ±25 % et de ±0,001 po. Ex. fz = 0,0015 → [0,001125 ; 0,001875] (±25 %) ;
  fz = 0,006 → [0,005 ; 0,007] (±0,001 po).
- Vitesse d'avance en filetage : vérifiée à ±0,5 % de *N_saisi × f_saisi*,
  c.-à-d. la **cohérence interne** de la réponse de l'étudiant, pas la valeur
  théorique. (N et f sont corrigés à part, chacun dans sa propre cellule.)
- Saisie : le point et la virgule sont acceptés comme séparateur décimal
  (D10) ; un champ vide ou illisible est une mauvaise réponse.

Une question est **réussie** quand les 5 champs sont corrects. Les champs
pré-remplis par la configuration de l'exercice (ex. M10 : tout sauf Vc) comptent
comme corrects.

## 7. Progression et réussite de l'exercice

- Chaque outil porte `reussites_requises` (0 = non évalué dans cet exercice).
- L'exercice est réussi quand chaque outil évalué compte au moins
  `reussites_requises` questions réussies.
- ❓ « Consécutives » : le VBA parle de réussites consécutives mais compte des
  occurrences ; à confirmer si un échec doit remettre le compteur de l'outil à zéro.
- Un graphique de progression par opération est affiché (VBA `modAffGraph`).

## 8. Identification de l'étudiant et rapport

Saisie au démarrage : prénom, nom, matricule, **numéro Moodle** (5 chiffres,
fourni par la question Moodle à l'étudiant).

Rapport de réussite :
- version de l'exercice, numéro Moodle, **code de réussite**, prénom, nom,
  matricule, date/heure de début, date/heure de réussite, nombre de questions
  réussies ;
- tableau des questions réussies groupées par opération (outil, matériau,
  paramètres) ;
- **QR code** vers la page de vérification.

### Code de réussite Moodle (VBA `calcCodeM`)

Avec `abcde` les 5 chiffres du numéro Moodle et `verMd` le multiplicateur de
version (54126 pour le M10 actuel) :

```
code = ((verMd × (a^e + b^d + c^c + d^b + e^a)) mod 88888) + 11111
```

Formule identique côté Moodle (question calculée) :
`fmod(54126*(pow({a},{e})+pow({b},{d})+pow({c},{c})+pow({d},{b})+pow({e},{a})),88888)+11111`.
❓ Confirmer que la vérification se fait uniquement dans Moodle (l'étudiant
saisit le code) et que le QR/rapport sert à l'enseignant en cas de doute.

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

## 10. Configuration d'un exercice (à concevoir)

Un fichier `exercices/<id>.json` décrit : nom, version, `verMd`, outils
retenus avec `reussites_requises`, champs à pré-remplir, seuils du graphique.
Le M10 actuel devient `exercices/m10-tournage-vc.json`.

## 11. Questions ouvertes (résumé)

1. ~~Arrondis des valeurs théoriques (§5).~~ Tranché : voir §5.
2. Réussites consécutives ou cumulées (§7).
3. Vérification du code : Moodle seul ou aussi QR (§8).
4. Sécurité du payload QR (§8 / D6).
5. Nouveau code dans le dépôt `tgm-fab` (à côté de `index.htm`) ou dépôt dédié ?
