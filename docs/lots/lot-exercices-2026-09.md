# Exercices à créer — quiz de paramètres de coupe

> Copie, telle quelle, du catalogue arrêté par Thierry le 2026-09-29 (`captures/lot-exercices/exercices.md`), gardée
> dans le dépôt par la décision D84. Le script `reference/lot-exercices/generer.mjs` en est la transcription ; les
> trois endroits où il s'en écarte sont dits dans D84 et dans `docs/rapports/lot-exercices.md`. Ce catalogue ne se
> retouche pas : un changement s'écrit dans une nouvelle décision, puis dans le script.

Catalogue des exercices conçus en discussion avec Thierry (28-29 sept. 2026), avant leur mise en production en un seul lot. **Tout est arrêté (29 sept., 5 h 45).**

**Déroulement retenu**
1. Chaque exercice est arrêté ici, fiche par fiche. — **Fait.**
2. Un seul message à Claude Code (branche `lot-exercices`) : un script reproductible lit un **export frais de la production** et produit un fichier d'import qui ajoute les exercices en **brouillons** et les **outils nouveaux ou modifiés de la banque** (avec leurs images) ; validation par les tests et répétition générale en local (`npm run dev`).
3. Production, un soir hors labo : nouvel export → script relancé sur cet export → Sauvegarde → « Valider l'import » (résumé) → « Importer » ; puis, pour chaque exercice, Aperçu → Publier.
- **Précaution** : l'import remplace la banque et les brouillons ; rien ne se modifie dans la Gestion du contenu entre l'export et l'import.
- **Fichiers du lot** : `C:\Projets\quiz-parametres-coupe\captures\lot-exercices\` (dossier exclu de Git) — ce catalogue (`exercices.md`), l'export frais, les images détourées `fraise_a_fileter.png`, `outil_a_rainurer.png` (120 px, fond transparent) et leurs versions `_pleine`.

---

## Cours visés (grille officielle du CVM, option Fabrication mécanique)

| Cours | Titre officiel | Session | Contenu |
|---|---|---|---|
| 241-M10-VM | Usinage conventionnel | 1 | **deux blocs permutables** de 6 semaines, ni l'un ni l'autre prérequis : tournage conventionnel et fraisage conventionnel |
| 241-M30-VM | Programmation CN I | 3 | fraisage à commandes numériques |
| 241-M40-VM | Programmation CN II | 4 | tournage à commandes numériques |
| 241-F50-VM | Projet de fabrication I | 5 | premier cours à projet, synthèse du fraisage et du tournage |

**Champ « Cours »** : « M10 — Tournage » et « M10 — Fraisage » (deux groupes à l'accueil, sans changer le code), puis « M30 », « M40 », « F50 ».
**Numérotation du M10** : la même dans les deux blocs — Exercice 2 (Vc et N), Exercice 3 (avances). L'exercice 1 (Vc seulement, fait en Excel) n'est pas refait ; `m10-tournage-vc` reste archivé.

## Règles communes

- **3 réussites de suite par outil** : trois calculs exacts de suite sont le gage de la maîtrise de la notion.
- **Outils semblables réunis dans un même exercice : 2 réussites chacun** (forets fractionnaire, à numéro, à lettre, métrique ; tarauds ; filetages en pouces et en métrique d'un même porte-outil ; les deux Nine9 ; les fraises à surfacer). Un outil seul de sa famille dans l'exercice garde 3. Le foret Udrill n'est pas de la famille des forets hélicoïdaux.
- **Avance des outils axiaux calculée à partir du M30** (M30, M40, F50) : au M10, les perçages au tour et à la fraiseuse conventionnels sont manuels. Outils axiaux : forets, foret à centrer, foret à pointer, alésoirs, tarauds, outil à chambrer — et, par les tables (« Avance axiale »), la fraise 82° et le Nine9 90°. Un exercice règle ses grandeurs pour tous ses outils (D52) : les exercices d'avances du M10 ne contiennent aucun outil axial.
- **Forets : Ø 1/16 po au minimum** (0.0625 po) — dimensions retirées de chaque copie : foret fractionnaire 1/16 à 1 po (61 dimensions) ; foret à numéro #52 et plus gros ; foret métrique 1.6 mm et plus ; foret à lettre : toutes.
- **M10 : pas de filetage métrique ni de foret métrique.**
- **Matières d'outil** : M10 = acier rapide et insert de carbure de tungstène (jamais le carbure solide, par `materiaux_outil` à la racine de l'exercice) ; **M30, M40, F50 = les trois**.
- **La table des avances donne fz** ; f = fz × nombre de dents ; Vf = N × f ; filetage et taraudage : fz = pas.
- **Le facteur de vitesse ne touche que N** ; partout : facteur **à trouver** dans la 4e feuille (`facteur_vitesse_donne` absent).
- Une réponse ne doit jamais se déduire des grandeurs fournies (leçon de P1).
- Matériaux usinés : tous les groupes permis par chaque outil (aucune restriction `groupes`).
- **Une démo par exercice** : un exercice d'une seule question (une copie d'outil, 1 réussite), fait par l'enseignant au projecteur ; mêmes réglages que l'exercice ; jusqu'à l'attestation ; **à l'accueil**, sous le même cours, placée juste avant son exercice, avec « Démo » dans le titre. Réussites de démo supprimables dans l'espace professeur.

---

## Banque d'outils — changements du lot

### Outils à créer

Groupes de matériaux usinés : **tous sauf le groupe O** (P, M, K, N, S, H : 14 groupes). Limite de vitesse de rotation reprise des outils voisins : tour 3000 tr/min, fraiseuse 10000 tr/min.

| Outil | Opération (machine) | Dimensions | Dents | Matière d'outil | Facteur de vitesse | Nomenclature | Image |
|---|---|---|---|---|---|---|---|
| DTFNR (`dtfnr`) | Dressage (Tour) | celles du MVLNR : Ø 1.000" à 4.000" (7) | 1 | Insert de carbure de tungstène | hérité (1) | `DTFNR - Ø dressé: [IdDia]` | celle du MCLNR (`mclnr`) |
| Outil à rainurer (`outil_a_rainurer`) | Rainurage externe (Tour) | celles du MVLNR (7) | 1 | Insert de carbure de tungstène | hérité (1/4) | `Outil à rainurer - Ø rainuré: [IdDia]` | **nouvelle** : `outil_a_rainurer.png` (porte-outil MGEHR2020-3) |
| Nine9 (`nine9_ebavurage`) | Chanfreinage / ébavurage (Fraiseuse) | Ø 1/4, 3/8, 1/2 po | 1 | Insert de carbure de tungstène | **forcé à 1** (l'opération est à 1/4) ; raison : « Un seul insert de carbure en périphérie : vitesse non réduite » | `Outil à chanfreiner Nine9 : [IdDia]` | celle du Nine9 90° (`nine9_90_degres`) |
| Fraise à surfacer 3 po, 5 dents (`fraise_a_surfacer_3po_5`) | Surfaçage (Fraiseuse) | 3 po | 5 (min = max) | Insert de carbure de tungstène | hérité (1) | `Fraise à surfacer Ø [IdDia] - [NbDent] inserts` | celle de la fraise à surfacer (`fraise_a_surfacer`) |
| Fraise à surfacer 3 po, 7 dents (`fraise_a_surfacer_3po_7`) | Surfaçage (Fraiseuse) | 3 po | 7 (min = max) | Insert de carbure de tungstène | hérité (1) | idem | idem |
| Fraise à fileter (`fraise_a_fileter`) | **Contournage finition** (Fraiseuse) | « Ø 0.300 po — 16 à 28 filets/po » (0.300), « Ø 0.240 po — 18 à 28 filets/po » (0.240), « Ø 0.180 po — 20 à 32 filets/po » (0.180) ; le pas n'entre pas dans le calcul | 4 | Carbure de tungstène solide | hérité (1) | `Fraise à fileter Ø [IdDia] - [NbDent] dents` | **nouvelle** : `fraise_a_fileter.png` |

Fraise à fileter : avance 0.004 × Ø par dent (≈ 0.0012 po/dent à Ø 0.300) ; questionnée **à partir du F50 seulement**. Pas de fraise à surfacer de 5 po.

### Outils à modifier

- **Nine9 90° (`nine9_90_degres`)** : facteur **forcé à 1** (l'opération « Chanfreinage / chambrage » est à 1/4) ; raison : « Un seul insert de carbure en périphérie : vitesse non réduite » (remplace « Valeur reprise de l'ancien outil — à vérifier » s'il la porte).
- **Outil à chambrer (`outil_a_chambrer`)** : matière **Acier rapide seulement** (retirer le carbure solide) ; facteur **hérité** (1/4 de « Chanfreinage / chambrage » : retirer tout forçage).

---

## Grille des outils par exercice (arrêtée le 29 sept.)

Colonnes : **T2** Tournage — Exercice 2 · **T3** Tournage — Exercice 3 · **F2** Fraisage — Exercice 2 · **F3** Fraisage — Exercice 3 · **M30** · **M40** · **F50**. Nombre = réussites de suite ; vide = absent.

| Outil (banque) | Opération | T2 | T3 | F2 | F3 | M30 | M40 | F50 | Démo |
|---|---|---|---|---|---|---|---|---|---|
| DTFNR ★ (`dtfnr`) | Dressage | 3 | 3 | | | | 3 | 1 | |
| MCLNR (`mclnr`) | Chariotage ébauche | 3 | 3 | | | | 3 | 1 | |
| MVLNR (`mvlnr`) | Chariotage finition | 3 | 3 | | | | 3 | 1 | |
| Outil à rainurer ★ (`outil_a_rainurer`) | Rainurage externe | 3 | 3 | | | | 3 | 1 | |
| Lame à tronçonner (`lame_a_tronconner`) | Tronçonnage | 3 | 3 | | | | 3 | 1 | |
| Barre à rainurer (`barre_a_rainurer`) | Rainurage interne | | 3 | | | | 3 | 1 | |
| Barre à aléser (`barre_a_aleser`) | Alésage à la barre | 3 | 3 | | | | 3 | 1 | Démo T3 |
| SDTMR UNC (`sdtmr`) | Filetage externe | 3 | 3 | | | | 2 | 1 | |
| SDTMR métrique (`sdtmr_2`) | Filetage externe | | | | | | 2 | 1 | Démo M40 |
| Barre à fileter UNC (`barre_a_fileter`) | Filetage interne | 3 | 3 | | | | 2 | 1 | |
| Barre à fileter métrique (`barre_a_fileter_2`) | Filetage interne | | | | | | 2 | 1 | |
| Foret à centrer (`foret_a_centrer`) | Centrage | 3 | | | | | 3 | 1 | |
| Foret à pointer (`foret_a_pointer`) | Pointage | 3 | | 3 | | 3 | | 1 | |
| Foret fractionnaire (`foret_fractionnaire`, 1/16 à 1 po) | Perçage | 2 | | 2 | | 2 | 2 | 1 | Démo T2 |
| Foret fractionnaire 2 (`foret_fractionnaire_2`, 1 à 2 po) | Perçage | | | | | | | 1 | |
| Foret à numéro (`foret_a_numero`, #52 à #1) | Perçage | 2 | | 2 | | 2 | | 1 | |
| Foret à lettre (`foret_a_lettre`) | Perçage | 2 | | 2 | | 2 | | 1 | |
| Foret métrique (`foret_metrique`, 1.6 à 15 mm) | Perçage | | | | | 2 | 2 | 1 | |
| Foret métrique 2 (`foret_metrique_2`, 15 à 38 mm) | Perçage | | | | | | | 1 | |
| Foret Udrill (`foret_udrill`) | Perçage | | | | | 3 | 3 | 1 | |
| Alésoir (`alesoir`, 1/8 à 1/2 po) | Alésage à l'alésoir | | | 3 | | 3 | | 1 | |
| Alésoir 2 (`alesoir_2`, 5/8 à 1 1/2 po) | Alésage à l'alésoir | | | | | | | 1 | |
| Taraud UNC (`taraud_imperial`, 1/4 à 1 po) | Taraudage | | | 3 | | 2 | | 1 | |
| Taraud à numéro (`taraud_imperial_2`, #1 à #12) | Taraudage | | | | | | | 1 | |
| Taraud métrique (`taraud_metrique`) | Taraudage | | | | | 2 | | 1 | |
| Fraise 82° (`fraise_82_degres`) | Chanfreinage / chambrage | | | 3 | | 3 | | 1 | |
| Outil à chambrer (`outil_a_chambrer`) | Chanfreinage / chambrage | | | 3 | | 3 | | 1 | |
| Nine9 90° (`nine9_90_degres`) | Chanfreinage / chambrage | | | 2 | | 2 | | 1 | |
| Nine9 d'ébavurage ★ (`nine9_ebavurage`) | Chanfreinage / ébavurage | | | 2 | 3 | 2 | | 1 | |
| Fraise en bout hélicoïdale (`fraise_en_bout_helicoidale`) | Contournage ébauche | | | 3 | 3 | 3 | | 1 | Démos F2, F3 |
| Fraise en bout à inserts (`fraise_en_bout_a_inserts`) | Contournage finition | | | 3 | 3 | 3 | | 1 | |
| Fraise à surfacer (`fraise_a_surfacer`, 1 à 1 1/2 po) | Surfaçage | | | 3 | 2 | 2 | | 1 | |
| Fraise à surfacer 3 po, 5 dents ★ | Surfaçage | | | | 2 | 2 | | 1 | Démo M30 |
| Fraise à surfacer 3 po, 7 dents ★ | Surfaçage | | | | 2 | 2 | | 1 | |
| Fraise à fileter ★ | Contournage finition | | | | | | | 3 | Démo F50 |
| **Questions** | | **36** | **27** | **34** | **15** | **43** | **39** | **37** | 1 chacune |

★ = outil à créer. Au M30, le foret à lettre est gardé (choix de Thierry) ; retirés : foret fractionnaire 2, foret métrique 2, alésoir 2, taraud à numéro. Au M40, retirés : foret fractionnaire 2, foret métrique 2.

## Réglages des exercices

| Identifiant | Titre | Cours | À trouver | Fournies | Masquées | Matières d'outil |
|---|---|---|---|---|---|---|
| `m10-tournage-vc-rpm-2` (**nouvelle version** du brouillon existant ; titre et cours en direct) | Tournage — Exercice 2 | M10 — Tournage | Vc, N | fz, f | Vf | Acier rapide, Insert de carbure de tungstène |
| `m10-tournage-avances` | Tournage — Exercice 3 | M10 — Tournage | Vc, fz, N, f, Vf | — | — | Acier rapide, Insert de carbure de tungstène |
| `m10-fraisage-vc-rpm` | Fraisage — Exercice 2 | M10 — Fraisage | Vc, N | fz, f | Vf | Acier rapide, Insert de carbure de tungstène |
| `m10-fraisage-avances` | Fraisage — Exercice 3 | M10 — Fraisage | Vc, fz, N, f, Vf | — | — | Acier rapide, Insert de carbure de tungstène |
| `m30-fraisage-cn` | M30 — Fraisage CN : paramètres de coupe | M30 | Vc, fz, N, f, Vf | — | — | les trois |
| `m40-tournage-cn` | M40 — Tournage CN : paramètres de coupe | M40 | Vc, fz, N, f, Vf | — | — | les trois |
| `f50-synthese` | F50 — Synthèse du fraisage et du tournage | F50 | Vc, fz, N, f, Vf | — | — | les trois |

Tous : facteur de vitesse à trouver ; tous les matériaux usinés permis par chaque outil ; à l'accueil (`liste` vrai).

**Démos** (7) : identifiant `demo-<identifiant de l'exercice>` ; même cours ; mêmes réglages que l'exercice ; une seule copie (l'outil de la colonne Démo), 1 réussite ; rang juste avant son exercice. Titres :

| Identifiant | Titre | Outil |
|---|---|---|
| `demo-m10-tournage-vc-rpm-2` | Tournage — Démo de l'exercice 2 | foret fractionnaire |
| `demo-m10-tournage-avances` | Tournage — Démo de l'exercice 3 | barre à aléser |
| `demo-m10-fraisage-vc-rpm` | Fraisage — Démo de l'exercice 2 | fraise en bout hélicoïdale |
| `demo-m10-fraisage-avances` | Fraisage — Démo de l'exercice 3 | fraise en bout hélicoïdale |
| `demo-m30-fraisage-cn` | M30 — Démo : fraisage CN | fraise à surfacer 3 po, 5 dents |
| `demo-m40-tournage-cn` | M40 — Démo : tournage CN | SDTMR métrique |
| `demo-f50-synthese` | F50 — Démo : synthèse | fraise à fileter |

- `m10-tournage-vc-rpm-2` : la nouvelle version part du **dernier brouillon de la production** (export frais) ; les versions publiées ne sont pas touchées ; les séances commencées gardent leur version ; titre « Tournage — Exercice 2 » et cours « M10 — Tournage » posés par la présentation en direct.

---

## Historique

- 2026-09-28 — Catalogue ouvert ; déroulement retenu (conception ici, import en un lot) ; cours du CVM ; règles (Ø 1/16 po, 3 réussites, semblables à 2, outils axiaux à partir du M30, matières) ; six outils à créer, deux à modifier ; exercice 1 abandonné ; démos décidées.
- 2026-09-29 — Blocs M10 permutables (« M10 — Tournage », « M10 — Fraisage »), numérotation Exercice 2 et 3 ; M30 et M40 élagués : **tout est arrêté**. Images de la fraise à fileter et de l'outil à rainurer détourées.
