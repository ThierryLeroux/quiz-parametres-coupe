# Écrans et présentation — cahier de l'interface

Statut : **approuvé par Thierry le 2026-09-20** (maquette v2, 25 points de révision).
Les maquettes de référence sont dans `docs/maquettes/*.html` (export du canevas ;
tailles fixes, à ouvrir dans un navigateur). Elles montrent *l'intention* ; le
code doit être responsive, accessible et piloté par les données, jamais copié.

Ce document complète `SPEC.md` (comportement) et `DECISIONS.md` (choix). En cas
de contradiction, `DECISIONS.md` gagne, puis `SPEC.md`, puis ce cahier.

## 1. Langage visuel

Deux univers, volontairement distincts :

| | Exercice (accueil, identification, question, correction, progression) | Documents (tables de référence, rapport de réussite) |
|---|---|---|
| Fond | bleu nuit `#05091a`, panneaux `#0b1430` | blanc, page lettre |
| Panneaux | coins biseautés (18 px en haut-gauche et bas-droite), contour 2 px coloré, halo `drop-shadow` de la même couleur | aucun effet |
| Texte | `#dde6f5`, atténué `#8aa0c6` | noir |
| Accent d'interface | bleu `#2e9bff` (contours, boutons), bleu clair `#4fc3f7` (titres, liens) | — |
| Correction | juste `#35d07f`, faux `#ff4d5a` | — |

Origine : la feuille Quiz du classeur Excel (fond nuit, panneaux biseautés,
contours lumineux). Le style ne doit jamais nuire à la lecture : **lisibilité
avant style**.

### Couleurs de sens (identiques aux feuilles Excel)

- Matériau d'outil — c'est la couleur de l'en-tête de colonne de la table des Vc, et celle du **panneau de l'outil** (contour, halo, titre) : acier rapide `#B4C7E7`, carbure de tungstène solide `#A6A6A6`, insert de carbure de tungstène `#FFC000`.
- Classe ISO du matériau brut — couleur vive de la lettre et du **panneau du matériau** : P `#00B0F0`, M `#FFFF00`, K `#FF0000`, N `#00B050`, S `#FFC000`, H `#D9D9D9`, O `#808080`. Teintes de ligne dans la table : P `#C1EFFF`, M `#FFFFB7`, K `#FFC5C5`, N `#B3FFD5`, S `#FFF1C5`, H `#EEEEEE`, O `#D9D9D9`. Texte de la lettre : blanc sur P, K, N, O ; noir sur M, S, H.
- Ces couleurs vivent dans `site/css/tokens.css` (variables) et sont lues par les composants ; les JSON n'en contiennent pas.

### Typographie

- Une seule famille pour tout le texte : **IBM Plex Sans** 400, 500 et 600 (repli `system-ui, sans-serif`).
- **IBM Plex Mono** 400 et 500, uniquement pour les nombres : cases de saisie, valeurs du rapport, formules (repli `ui-monospace, Consolas, monospace`).
- Documents imprimables : **Carlito** 400 et 700, droit et italique (clone métrique de Calibri, celle des feuilles Excel), repli `Calibri, sans-serif`.
- Les polices sont **auto-hébergées** dans `site/fonts/` : fichiers woff2 seulement, sous-ensemble latin, copiés des paquets npm `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` et `@fontsource/carlito` (copie de fichiers, aucune dépendance dans `package.json`), avec leurs licences OFL. Déclarées par `@font-face` avec `font-display: swap` dans `site/css/tokens.css`. **Aucune requête vers un domaine externe**, ni Google Fonts ni autre.
- Le symbole de diamètre est toujours le caractère **Ø** (U+00D8), jamais un zéro barré ; vérifier son rendu dans chaque police retenue.
- Pas de police d'affichage « futuriste » : essayée, retirée pour lisibilité.

## 2. Parcours

`?exercice=<id>` (lien diffusé sur Léa) → **Accueil** → **Identification** →
**Question** ⇄ **Tables de référence** → (Vérifier) → **Question corrigée** →
Question suivante… → **Réussite** (rapport). Une séance interrompue se reprend
depuis l'accueil (état dans `localStorage`, SPEC §7).

## 3. Écrans

### 3.1 Accueil (`01-accueil.html`)

- Titre de l'exercice en grand, avec version, nombre d'outils, champs évalués, et la consigne « vérifie que c'est l'exercice indiqué sur Léa ». **Aucun moyen d'en changer** depuis la page (D11, point 10) ; la liste des exercices n'apparaît que si l'URL n'a pas de `?exercice=`, ou en nomme un qui n'existe pas — elle est alors précédée de « L'exercice « <id> » n'existe pas — vérifie le lien sur Léa » (D18).
- Résumé de l'exercice en trois phrases (réussites consécutives, échec = compteur à zéro, rapport PDF à remettre sur Léa).
- Panneau doré « Séance en cours sur cet appareil » (prénom, nom, matricule, début, nombre de réussites) avec **Reprendre**, seulement si une séance valide existe.
- Bouton **Nouvelle séance** + avertissement « efface la séance en cours ».
- Pied : « aucune donnée n'est envoyée ; la séance est conservée dans ce navigateur seulement ».

### 3.2 Identification (`02-identification.html`)

- Prénom, nom, **matricule à 7 chiffres** (validation à la saisie, message en français). Rien d'autre (D16 : plus de numéro Moodle).
- Texte : « Ces informations apparaîtront sur ton rapport de réussite, que tu remettras sur Léa. »
- Boutons : ← Retour, **Commencer l'exercice**.

### 3.3 Question (`03-question.html`, téléphone `03b-question-telephone.html`)

Grille ordinateur : deux tiers pour la question, un tiers pour la progression.
Téléphone : tout s'empile dans l'ordre outil → matériau → questionnaire → progression.

**En-tête** : titre de l'exercice, « Prénom Nom · matricule », bouton **Tables de référence**, lien Quitter.

**Panneau de l'outil** (couleur du matériau d'outil) :
- photo (`site/img/outils/<id>.png`, halo de la même couleur), identifiant résolu du gabarit (« MVLNR — Ø charioté : 5/8 po »), rappel du matériau d'outil en petit ;
- opération, nombre de dents, **RPM max de la machine-outil** (`limite_rpm`), note de l'outil (`commentaire`) ;
- **facteur de vitesse ou d'avance affiché seulement s'il diffère de 1**, en clair : « Vitesse réduite × 0.25 » (alésoir), « × 0.125 » (lame à tronçonner). Sans cette ligne l'étudiant ne peut pas trouver N.

**Panneau du matériau brut** (couleur de la classe ISO) : lettre de classe en badge, matériau et groupe, composition, état, dureté, exemple AISI.

**Questionnaire** (bleu) — cinq champs dans l'ordre du calcul, chacun avec :
- **libellé complet + symbole + unité** : *Vitesse de coupe (Vc, pi/min)*, *Avance par dent (fz, po/dent)*, *RPM (N, rév/min)*, *Avance totale par révolution (f, po/rév)*, *Vitesse d'avance (Vf, po/min)* ;
- un **pictogramme** de la grandeur (§5) ;
- une case à chasse fixe, 48 px de haut, `inputmode="decimal"` ; les champs fournis par l'exercice sont grisés et marqués « fourni par l'exercice » ;
- rappel sous le formulaire : « Point décimal, sans séparateur de milliers : 2496 · 0.005 » et « sur cet outil : n réussites de suite sur m ».

**Aide contextuelle, au clic seulement** (point 17) : quand une case reçoit le focus, une ligne d'aide apparaît sous le formulaire, **méthode jamais valeur** et sans nommer la ligne ni la colonne :
- Vc : « table des vitesses de coupe : le matériau brut donne la ligne, le matériau de l'outil donne la colonne » + bouton **Ouvrir la table** ;
- fz : « table des avances, à l'opération de l'outil » + selon la famille : « proportionnelle au Ø : avance × Ø outil, sans dépasser l'avance max » ou « filetage : fz = pas = 1 / filets au pouce (ou mm / 25.4) » ;
- N : « N = Vc × 4 / Ø, plafonnée au RPM max de la machine » (+ facteur s'il y en a un) ;
- f : « f = fz × nombre de dents » ; Vf : « Vf = N × f ».

Bouton **Vérifier** (un seul clic possible ; SPEC §7, `correction` dans l'état).

**Progression** (panneau bleu, toujours visible) : barre « n / m outils », puis un rang par outil de l'exercice avec **un point par réussite consécutive** (`reussites_requises` points, pleins et lumineux quand acquis), l'outil en cours surligné ; légende « un échec sur un outil remet ses points à zéro ». Sur téléphone, sous le formulaire, les outils terminés peuvent être repliés.

### 3.4 Question ratée (`04-question-ratee.html`)

Même écran après **Vérifier** avec au moins un champ faux (choix de Thierry : voir les réponses attendues, puis question suivante) :
- chaque champ passe en vert (« Juste », et « (2496 attendu) » si la valeur diffère mais est tolérée) ou rouge (« Faux — attendu 12.500 » et le calcul en une ligne : « Vf = N × f = 2500 × 0.0050 ») ;
- bandeau rouge : « Question ratée — le compteur de MVLNR retombe à zéro (2 → 0). » + l'explication de l'écart et de la tolérance ;
- dans la progression, l'outil passe en rouge « remis à zéro », ses points se vident ;
- un seul bouton : **Question suivante**. Une question réussie affiche le même écran en vert, sans bandeau rouge, puis Question suivante.
- Aucun compteur d'échecs n'est montré nulle part.

### 3.5 Tables de référence (`05-tables-vc.html`, `05b-tables-avances.html`, `05c-tables-formules.html`)

- Barre d'application (HUD) : trois onglets *Vitesses de coupe / Avances / Formules*, bouton **Imprimer / PDF**, ← Retour à la question. L'impression est ouverte à tous.
- Sous la barre, une **page lettre blanche** identique à la feuille imprimée de l'atelier : en-tête (logo `site/img/logo-cvm.svg` à gauche, « Paramètres de coupe / valeurs de départ » au centre, bloc TGM à droite), pied (date, révision, page). Police Carlito.
- **Vitesses de coupe** : *toutes* les classes et les 47 lignes, quel que soit l'exercice ; colonnes Classe, No de groupe, Matériau, Composition, État, Dureté, Exemple, puis les trois colonnes de Vc dont les **en-têtes colorés ont la même hauteur** ; lettre et numéro sur fond vif, ligne teintée par classe ; **une ligne par matériau, sans repli** (réduire le corps si un libellé est long ; abréviations admises comme « Haute résis. traction, Ampco ») ; aucun séparateur entre groupes ; **aucun surlignage** de la question en cours.
- **Avances** : colonnes Machine-outil et direction d'avance (texte vertical, **centré sur la hauteur du groupe**), opération, **pictogramme** (§5), barre orangée `#FFC000 → blanc` dont la **longueur est proportionnelle à l'avance** (calculée depuis `operations.json`), « pas du filetage » pour les filetages ; les **opérations proportionnelles au Ø** sont ceinturées par un encadré gris à liseré orangé qui porte la note (« Avances pour un outil Ø1'' — ajuster l'avance ↔ Ø outil », exemple « .006''/dent × Ø1/4'' = .0015''/dent », « Ne pas dépasser .010''/dent ») ; l'alésage à la barre a son propre encadré (« Av. MAX. .006''/tour »). Tout est généré depuis les données : ajouter une opération dans l'éditeur l'ajoute à la feuille.
- **Formules** (nouvelle feuille) : deux parties séparées par un bandeau — *1re partie — Vitesse de rotation (rév/min)* (bleu `#C1EFFF`) : Vc relevée, N = Vc × 4 / Ø ; *2e partie — Vitesse d'avance (po/min)* (orangé `#FFF1C5`) : fz relevée, pas d'un filet (deux lignes : `pas = 1 / filets par pouce`, `pas = mm / 25.4`), f = fz × dents, Vf = N × f. Chaque ligne : pictogramme, nom et unité, formule **sur une seule ligne**, note. Les deux relevés dans les tables sont illustrés par une **miniature schématique** de la feuille (flèche sur la ligne et la colonne pour Vc, sur l'opération pour fz). Exemples de filetage sur trois lignes. Exemple complet surligné des deux couleurs. Rappel de la règle de saisie.

### 3.6 Réussite — rapport (`06-rapport-reussite.html`)

- Barre HUD : « Exercice réussi — rapport », consigne « Enregistre le PDF, puis remets-le sur Léa », bouton **Enregistrer en PDF** (impression du navigateur, nom de fichier proposé `Rapport-<exercice>-<Nom>-<Prenom>.pdf`), Terminer.
- La page est **claire, en format lettre, identique à l'écran et à l'impression** : logo et bloc TGM, titre « Rapport de réussite — calcul de paramètres d'usinage », bloc d'informations sur deux colonnes (Exercice avec version, Prénom, Nom, Matricule, Début, Réussite, Questions réussies, Champs évalués) et le **QR code à droite de ce bloc**, dans l'en-tête.
- Tableau des questions réussies groupées par opération : Opération, Outil, Matériau brut précédé d'une **pastille de classe** (« P2 » sur `#00B0F0`, etc.), puis **les cinq valeurs** Vc, fz, N, f, Vf avec unités, toujours toutes listées même si l'exercice n'en évaluait qu'une partie. Seules les séries qui comptent sont listées (SPEC §8).
- **Pagination** : si la liste déborde, pages suivantes avec en-tête répété (nom, matricule, exercice) et « Page n de m » en pied. Aucun nombre d'échecs.
- Rien sur Moodle (D16).

## 4. Composants réutilisables

`panel(couleur)` (biseau + contour + halo), `field` (libellé, pictogramme, case, note, états *à répondre / fourni / juste / faux*), `helpLine`, `progression`, `toolCard`, `materialCard`, `printPage` (page lettre avec en-tête et pied), `dataTable` (feuilles). CSS natif avec variables ; pas de framework (D3).

## 5. Pictogrammes (SVG, dans le dépôt, modifiables)

Tous en SVG trait/aplat, dans `site/img/pictos/`, référencés par les données ou par le code, et éditables (D11 : l'éditeur permet d'en changer).

**Grandeurs** (un par champ, aussi dans la feuille Formules) :
- Vc : l'outil qui file en **ligne droite** dans la matière (vitesse linéaire) ;
- N : broche qui tourne (flèche circulaire) ;
- fz : **une dent qui prend sa bouchée** dans la matière (surface festonnée) ;
- pas : profil de filet et **cote entre deux sommets** ;
- f : **un tour complet et la distance parcourue** ;
- Vf : déplacement rapide (double flèche).

**Opérations** (19, feuille des avances) : chacun montre **la bouchée par dent que prend l'outil dans ce type d'opération**, dans l'esprit des dessins bleus du classeur. Références visuelles provisoires : `reference/pictogrammes-excel-provisoires/` et `docs/maquettes/pictos-sprite-provisoire.png` (rognés, pixellisés : références, pas des icônes finales). Palette : bleu `#00B0F0`, contour noir, bouchée orangée `#FFC000`.

## 6. Impression

- `@page { size: letter; margin: 0.5in }` ; feuilles de référence et rapport conçus pour **lettre 8½ × 11** uniquement ; l'affiche de l'atelier est le même PDF imprimé à l'échelle.
- Chaque feuille de référence tient sur **une page** avec les données actuelles ; si le catalogue grossit au point de déborder, passer à deux pages avec en-tête répété plutôt que de réduire jusqu'à l'illisible.
- En impression, masquer la barre HUD et tout ce qui n'est pas la page ; `print-color-adjust: exact` pour conserver les couleurs de classe et les barres.

## 7. Saisie et accessibilité

- Point ou virgule acceptés à la saisie (D10) ; espaces ignorés ; « 1,600 » vaut 1.6 — d'où l'exemple affiché.
- Cibles tactiles ≥ 44 px ; l'exercice se fait autant sur les postes du labo que sur téléphone.
- Contrastes AA sur fond nuit ; focus visible (halo bleu clair) ; libellés liés aux champs ; le vert/rouge est doublé par un texte (« Juste » / « Faux »).
- Clavier : Entrée dans une case = Vérifier ; Tab suit l'ordre Vc → fz → N → f → Vf en sautant les champs fournis.

## 8. Ce que la maquette ne tranche pas (à traiter au fil des jalons)

- Le rendu final des 6 + 19 pictogrammes (proposition de Claude Code, validation de Thierry).
- Le contenu exact du QR et sa page de vérification (D6, jalon 3).
- L'éditeur (jalon 4) : accès par mot de passe pour les professeurs — empreinte seulement dans le code, jamais le mot de passe en clair, jamais dans les docs.
