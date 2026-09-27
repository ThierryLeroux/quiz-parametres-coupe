# Rapport — chantier « avances » (décision D69)

Session du 2026-09-26. **Branche `avances`** à partir de `main` (c79b9ed), cinq commits — la décision, la
correction de f, l'éditeur, les docs, ce rapport —, branche poussée, pas de fusion. `npm test` : 568 tests
(+ 11), `fail 0` avant chaque commit. Chrome en mode test (`test-complet`) à 1280 et 390 px : les cinq outils
visés vus aux deux largeurs, captures dans `captures/avances/` (hors dépôt), aucune exception, aucune requête
externe, aucun défilement horizontal à 390 px ; seul message console : le 401 attendu de l'éditeur avant la
connexion.

## 1. La décision D69

- **Une même chaîne pour toutes les opérations**, celle que le moteur appliquait déjà : fz selon la famille
  (fixe : la table ; proportionnelle : avance × Ø × facteur d'avance, le Ø de la barre pour les deux outils à
  deux diamètres, plafonnée ; filetage : le pas, converti en pouces), f = fz × dents, Vf = N × f. Les états
  par exercice (D52) suffisent, pas d'état par outil. Aucune quatrième matière d'outil.
- **`limite_avance` est obsolète** : ce n'est pas un plafond (section 3).
- **f est jugée par cohérence avec fz** (section 2).
- **Ordre** : le code couvre toutes les familles ; tu publies d'abord l'exercice de tournage (perçage au tour
  compris), le fraisage après avoir validé le tableau de la section 5.

Le calcul lui-même n'a pas changé : `tests/chaine.test.js` reste vert sur tout le catalogue, et les deux M10
donnent les mêmes questions et les mêmes réponses attendues.

## 2. La correction de f

Tests écrits d'abord (11 en échec), puis le code (`correction.js`, `seance.js`).

**fz évaluée et lisible** : f est acceptée à ±0,1 % de *fz_saisi × dents*, sur la plage (fz ± demi-unité) ×
dents, élargie de la demi-unité de f — la même construction que `feedRateInterval` pour Vf. Le cas de
départ passe : foret Ø 1/2 po, 2 lèvres, fz « 0.0037 » (+23 %, tolérée) et f « 0.0074 » sont **justes toutes
les deux** ; avant, f était jugée sur 0.006 à ±20 % et refusée. Une f cohérente avec un fz faux est verte, fz
seule est rouge.

**fz fournie, masquée, vide ou illisible** : f est jugée sur la valeur théorique avec la tolérance de fz
reportée — ±25 % borné à ±0,001 po **par dent** en avance proportionnelle (foret Ø 1/2 po : [0.0045 ; 0.0075] ;
Ø 1 po : [0.010 ; 0.014], où la borne par dent l'emporte), ±0,1 % en fixe et en filetage.

**À l'écran** (UI §3.4) : la valeur attendue de f est fz saisi × dents quand la cohérence s'applique
(« Faux — attendu 0.0100 », « f = fz × dents = 0.005 × 2 ») ; la tolérance s'écrit « ±0.1 % de fz × dents »,
ou, sans fz saisie, « ±25 %, au plus ±0.001 po par dent » / « ±0.1 % ».

**Au passage, un trou fermé** : le moteur prenait pour N et f, dans la cohérence de Vf, ce que le navigateur
envoyait, même pour une grandeur fournie ou masquée — un navigateur modifié pouvait envoyer N = 1 et une Vf
assortie. SPEC §6 disait déjà qu'une grandeur non saisie prend sa valeur théorique : le moteur le fait
maintenant, pour f comme pour Vf (test). Le vrai navigateur n'envoie que les grandeurs évaluées : rien ne
change pour les étudiants.

Pour cela, `computeParameters` rend aussi le nombre de dents (`teeth`) ; il figure donc dans `attendu` au
journal des nouvelles corrections.

Tests ajoutés : les bornes de f par famille (cohérence), le cas « 0.0037 / 0.0074 », fz fausse et f
cohérente, fz fournie ou masquée, fz vide ou illisible, une fz envoyée pour une grandeur non évaluée, le N
envoyé pour une grandeur fournie, `toleranceLabel`, `correctionView` (fz saisie, fausse, masquée) ; et, dans
la chaîne sur **tout le catalogue** : f = fz affiché × dents, arrondie ou non, réussit ; fz non saisie, la f
affichée et fz affiché × dents réussissent.

## 3. `limite_avance`

Retirée du formulaire d'outil (le groupe **Limites** n'a plus que le RPM max). La clé reste acceptée dans les
données — absente, `null` ou un nombre > 0 — sans migration. Vérifié dans Chrome, base jetable : MVLNR
enregistré depuis le formulaire garde `limite_avance: 0.01`, à sa place dans l'objet, le taraud garde `null`,
un outil créé ne porte pas la clé. Aucune différence fantôme à la publication (la valeur n'est jamais
touchée).

## 4. Vérification dans Chrome (mode test, `test-complet`)

`test-complet` n'est pas semé (D47) : le script l'a publié par l'API de l'éditeur (création, brouillon
`draftFromExercise` sur la banque, publication, version 1, 29 outils, aucune erreur). Le scénario a tourné
deux fois (la seconde pour montrer f refusée sur la barre), chaque fois avec un étudiant à 1280 px et un autre à
390 px ; les tirages diffèrent d'une fois à l'autre. Outils vus (1re fois ; 2e fois, celle des captures) :

| Outil visé | 1280 px | 390 px | Ce qui a été saisi | Résultat |
|---|---|---|---|---|
| Foret (2 dents) | Foret Ø 1 13/16 po (fz plafonnée 0.0100) ; Foret #16 | Foret #40 ; Foret Ø 35/64 po | fz +23 % (au plus +0.00095), f = fz × 2, Vf cohérente | fz « Juste (… attendu) », f « Juste » ; pour #40, #16 et Ø 35/64, cette f aurait été refusée avant D69 |
| Barre à aléser (Ø barre) | Ø 1 1/4 po, Ø alésé 2.000" ; Ø 1 1/4 po, 3.000" | Ø 1 po, 1.500" ; Ø 5/8 po, 4.000" | fz juste ; f +1 % la 1re fois, +5 % la 2e | +1 % **accepté** (point douteux 4) ; +5 % refusé : « Ta f de 0.003938 est à +5 % de 0.00375 (tolérance : ±0.1 % de fz × dents) », « Faux — attendu 0.00375 / f = fz × dents = 0.00375 × 1 » |
| SDTMR métrique (pas converti) | M42 x 4.5 ; M68 x 6 | M68 x 6 ; M30 x 3.5 | fz = f = pas en mm, Vf cohérente | fz « Faux — attendu 0.17717 » (0.23622, 0.13780), f et Vf vertes (cohérentes) |
| Fraise, dents tirées | Fraise en bout Ø 3/8 po - 3 lèvres ; Fraise à surfacer Ø 1 1/2 po - 5 inserts | Fraise à surfacer Ø 1 po - 3 inserts ; Ø 1 1/4 po - 4 inserts | fz × 2, f = fz × dents | fz rouge (« ±25 %, au plus ±0.001 po »), f verte |
| Avance fixe | MVLNR 1.500" ; 1.000" | Lame à tronçonner 2.500" ; 1.750" | réponses du mode test | tout juste |

Le panneau de l'outil montre toujours « Nombre de dents : n » ; pour la barre, « Ø usiné (alésé) : … — pour le
RPM » et « Ø de la barre : … — pour l'avance ».

**L'aide contextuelle de fz**, relevée telle quelle :

- proportionnelle : « Avance par dent → table des avances, à l'opération de l'outil. Avance proportionnelle
  au Ø : avance × Ø outil, sans dépasser l'avance max. » ; barre : « … avance × Ø de la barre (pas le Ø
  usiné), sans dépasser l'avance max. » ;
- filetage : « … Filetage : fz = pas = 1 / filets au pouce (ou mm / 25.4). » ;
- **fixe** : « Avance par dent → table des avances, à l'opération de l'outil. » — **rien de propre à la
  famille** (point douteux 1). Je ne l'ai pas complétée.

Captures : `1280-…` et `390-…` pour `foret`, `barre`, `sdtmr-metrique`, `fraise`, `fixe`, chacune avant
(`-question`, l'aide de fz ouverte) et après (`-corrigee`) ; `1280-editeur-limites.png` ; `rapport.json` (tout
ce que le script a lu).

## 5. Avances de fraisage et de perçage, à valider

Chaque outil de fraiseuse ou de perceuse et chaque foret, calculé **par le moteur** (`computeParameters`,
affichage `formatParameters`) sur **la semence du dépôt** — tables `A2026_r0` et banque semée. Si tu as
modifié la banque en production depuis, c'est l'aperçu de l'éditeur qui fait foi pour ces outils. fz en
po/dent, f en po/rév ; « f (min / max) » = au nombre de dents minimum et maximum. Plafond : le Ø à partir
duquel avance × Ø dépasse l'avance max, et la première dimension du catalogue qui l'atteint.

| Outil | Opération — machine | Règle (po/dent) | Dents | Plus petit Ø | fz | f (min / max) | Plus grand Ø | fz | f (min / max) | Plafond |
|---|---|---|---|---|---|---|---|---|---|---|
| Foret fractionnaire (`foret_fractionnaire`) | Perçage — Perceuse / Fraiseuse | 0.006 × Ø, max 0.010 | 2 | Ø 1/64 po | 0.0000938 | 0.000188 | Ø 1 po | 0.0060 | 0.0120 | Ø 1.6667 po : jamais atteint |
| Foret fractionnaire (`foret_fractionnaire_2`) | Perçage — Perceuse / Fraiseuse | 0.006 × Ø, max 0.010 | 2 | Ø 1 po | 0.0060 | 0.0120 | Ø 2 po | 0.0100 | 0.0200 | Ø 1.6667 po : **dès Ø 1 11/16 po** (1.6875 po) |
| Foret à numéro (`foret_a_numero`) | Perçage — Perceuse / Fraiseuse | 0.006 × Ø, max 0.010 | 2 | #80 (0.0135 po) | 0.000081 | 0.000162 | #1 (0.228 po) | 0.00137 | 0.00274 | jamais atteint |
| Foret à lettre (`foret_a_lettre`) | Perçage — Perceuse / Fraiseuse | 0.006 × Ø, max 0.010 | 2 | A (0.234 po) | 0.0014 | 0.00281 | Z (0.413 po) | 0.00248 | 0.00496 | jamais atteint |
| Foret métrique (`foret_metrique`) | Perçage — Perceuse / Fraiseuse | 0.006 × Ø, max 0.010 | 2 | Ø 0.05 mm (0.0019685 po) | 0.0000118 | 0.0000236 | Ø 15.0 mm (0.59055 po) | 0.00354 | 0.00709 | jamais atteint |
| Foret métrique (`foret_metrique_2`) | Perçage — Perceuse / Fraiseuse | 0.006 × Ø, max 0.010 | 2 | Ø 15.0 mm (0.59055 po) | 0.00354 | 0.00709 | Ø 38.0 mm (1.4961 po) | 0.00898 | 0.0180 | jamais atteint |
| Foret Udrill (`foret_udrill`) | Perçage — Perceuse / Fraiseuse | 0.006 × Ø, max 0.010 | **1** | Ø 5/8 po | 0.00375 | 0.00375 | Ø 1 1/2 po | 0.0090 | 0.0090 | jamais atteint |
| Alésoir (`alesoir`) | Alésage à l'alésoir — Perceuse / Fraiseuse | 0.002 × Ø, max 0.010 | 6 | 0.1250" | 0.00025 | 0.0015 | 0.5000" | 0.0010 | 0.0060 | Ø 5 po : jamais atteint |
| Alésoir (`alesoir_2`) | Alésage à l'alésoir — Perceuse / Fraiseuse | 0.002 × Ø, max 0.010 | 8 | 0.6250" | 0.00125 | 0.0100 | 1.5000" | 0.0030 | 0.0240 | Ø 5 po : jamais atteint |
| Fraise en bout hélicoïdale (`fraise_en_bout_helicoidale`) | Contournage ébauche — Fraiseuse | 0.006 × Ø, max 0.010 | 2 à 5 | 1/8 po | 0.00075 | 0.0015 / 0.00375 | 1/2 po | 0.0030 | 0.0060 / 0.0150 | Ø 1.6667 po : jamais atteint |
| Fraise en bout à inserts (`fraise_en_bout_a_inserts`) | Contournage finition — Fraiseuse | 0.004 × Ø, max 0.010 | 3 | 5/8 po | 0.0025 | 0.0075 | 7/8 po | 0.0035 | 0.0105 | Ø 2.5 po : jamais atteint |
| Fraise à surfacer (`fraise_a_surfacer`) | Surfaçage — Fraiseuse | 0.004 × Ø, max 0.010 | 3 à 5 | 1 po | 0.0040 | 0.0120 / 0.0200 | 1 1/2 po | 0.0060 | 0.0180 / 0.0300 | Ø 2.5 po : jamais atteint |
| Nine9 90 degrés (`nine9_90_degres`) | Chanfreinage — Perceuse / Fraiseuse | 0.004 × Ø, max 0.010 | 1 | Ø 3/8 po | 0.0015 | 0.0015 | Ø 3/4 po | 0.0030 | 0.0030 | Ø 2.5 po : jamais atteint |
| Fraise 82 degrés (`fraise_82_degres`) | Chanfreinage — Perceuse / Fraiseuse | 0.004 × Ø, max 0.010 | 3 | Ø 1/8 po | 0.0005 | 0.0015 | Ø 1 po | 0.0040 | 0.0120 | Ø 2.5 po : jamais atteint |
| Outil à chambrer (`outil_a_chambrer`) | Chanfreinage — Perceuse / Fraiseuse | 0.004 × Ø, max 0.010 | 2 | Ø 1/8 po | 0.0005 | 0.0010 | Ø 1 po | 0.0040 | 0.0080 | Ø 2.5 po : jamais atteint |
| Foret à pointer (`foret_a_pointer`) | Pointage — Perceuse / Fraiseuse | 0.001, fixe | 2 | Ø 1/8 po | 0.0010 | 0.0020 | Ø 1 po | 0.0010 | 0.0020 | — (fixe) |
| Foret à centrer (`foret_a_centrer`) | Centrage — **Tour** | 0.002, fixe | 1 | 00 (0.125 po) | 0.0020 | 0.0020 | 8 (0.75 po) | 0.0020 | 0.0020 | — (fixe) |

Tarauds (perceuse / fraiseuse, filetage : fz = f = pas) : `taraud_imperial` 1/4- 20 UNC → 0.05000 à 1 - 8 UNC →
0.12500 ; `taraud_imperial_2` #1-64 UNC → 0.01563 à #12-24 UNC → 0.04167 ; `taraud_metrique` M1.6 x 0.35 →
0.01378 à M68 x 6 → 0.23622.

Ce que le tableau fait ressortir, pour ta relecture :

- **Le plafond n'est atteint que par `foret_fractionnaire_2`**, dès Ø 1 11/16 po. En fraisage, jamais :
  l'exercice de fraisage ne montrera aucun cas plafonné (au tour, la barre à aléser le montre dès la barre de
  1 po).
- **Foret Udrill à 1 dent** : f = fz. Est-ce voulu (une plaquette qui compte pour une dent) ?
- **Les plus grosses avances par tour** : fraise à surfacer 1 1/2 po à 5 inserts, f = 0.030 ; alésoir 1.5",
  8 dents, f = 0.024 ; fraise en bout 1/2 po à 5 lèvres, f = 0.015.
- **Les micro-forets** (#80, Ø 0.05 mm, Ø 1/64 po) donnent des fz de l'ordre de 0.0001 à 0.00001 po : un
  exercice d'avances voudra sans doute les écarter par ses dimensions (D14).
- **Le foret à centrer est un outil de tour** (Centrage, avance fixe) : il entre dans l'exercice de tournage,
  « perçage au tour ».
- Opérations sans outil au catalogue : Chanfreinage / ébavurage (fraiseuse), Dressage et Rainurage externe
  (tour).

## 6. Docs

DECISIONS D69 ; SPEC §3 (`limite_avance` obsolète), §5 (même chaîne pour toutes les opérations), §6 (tableau et
précisions : f par cohérence, tolérance reportée, saisie d'une grandeur non évaluée ignorée) ; UI §3.4 (valeur
attendue et tolérance de f), §3.9 (groupe Limites) ; PLAN (section « Chantier avances », et la case
`limite_avance` du 7b cochée).

## Points douteux

1. **Aide de fz en avance fixe** : elle ne dit rien de la famille (« Avance par dent → table des avances, à
   l'opération de l'outil. »). Les deux autres familles ont leur phrase. Proposition, non faite : « Avance
   fixe : la valeur de la table, telle quelle, quel que soit le Ø. »
2. **Aide de fz et Ø métrique** : pour un foret métrique (« Foret Ø 6.0 mm »), l'aide dit « avance × Ø outil »
   sans rappeler que Ø est en pouces (mm / 25.4) — l'aide de N non plus, c'était déjà le cas pour les M10.
   Non fait.
3. **Ligne de calcul d'un filet faux** : elle reprend la saisie — « fz = pas du filet = 4.5 » pour un étudiant
   qui a oublié de convertir M42 x 4.5. Elle pourrait montrer la conversion : « fz = pas = 4.5 mm / 25.4 =
   0.17717 ». Non fait. À noter aussi : dans ce cas, **f « 4.5 » et Vf sont vertes** (cohérentes avec son fz),
   seul fz est rouge — c'est la règle de D69 (l'erreur comptée une fois, là où elle a été faite), mais
   l'étudiant voit une f en millimètres marquée juste.
4. **Largeur de la cohérence quand fz et f ont la même précision** : la demi-unité de fz (× dents) et celle de
   f s'additionnent. À une dent et quatre décimales, f est acceptée à ±0.0001 de fz : barre à aléser fz
   « 0.0060 » → f dans [0.0059 ; 0.0061] (±1,7 % ; **f +1 % acceptée**, vu dans Chrome), MVLNR « 0.0050 » →
   [0.0049 ; 0.0051] (±2 %, contre [0.00495 ; 0.00505] avant) ; foret à pointer, 2 dents, fz « 0.0010 » →
   [0.00185 ; 0.00215] (±7,5 %). C'est la règle demandée, calquée sur Vf, et la demi-unité de f est
   nécessaire quand f s'affiche avec moins de décimales que fz × dents (foret #40 : fz « 0.000588 », f
   « 0.00118 ») ; mais pour les avances fixes, c'est plus large qu'avant. Garder, ou ne l'ajouter que dans ce
   cas-là ?
5. **Tolérance reportée et nombre de dents faux** : quand fz est fournie ou masquée, une f calculée avec
   **une dent de trop ou de moins** passe pour les alésoirs (6 et 8 dents, tous les Ø), la fraise en bout
   hélicoïdale à 4 et 5 lèvres (tous les Ø), la fraise à surfacer à 4 et 5 inserts (certains Ø) : ±25 %
   couvre une dent sur quatre. Avec fz saisie (cohérence), ce n'est jamais le cas. Si un exercice **fournit
   fz** et demande f, une autre possibilité serait la cohérence avec le fz affiché (±0,1 %), qui vérifie le
   nombre de dents. À trancher avant de publier un tel exercice.
6. **`DEMARRAGE.md` §7** dit d'ouvrir `?exercice=test-complet` en local, mais depuis D47 cet exercice n'est pas
   semé : une base locale neuve ne l'a pas (« n'existe pas »). Mon script l'a publié par l'API de l'éditeur.
   Il faudrait soit l'expliquer (l'importer ou le créer dans l'éditeur), soit un petit script. Non fait.
7. **Le tableau de la section 5 vient de la semence**, pas de la production (je ne lis pas la base de
   production). Si la banque a été retouchée en ligne, l'aperçu de l'éditeur donne les vraies valeurs.

## Réponses aux points douteux (décision D70)

Suite de la session, sur la même branche : tes réponses sont consignées dans **D70**, un commit par point (la
décision, la correction de f, les aides, la ligne de calcul des filets, le script de `test-complet`, les docs,
cette section). `npm test` : 587 tests (+ 19 depuis la première partie), dont un `todo` (le ❓ ci-dessous),
`fail 0` avant chaque commit. Chrome en mode test à 1280 et 390 px : huit outils visés vus aux deux largeurs,
`test-complet` publié par le nouveau script pendant que `wrangler dev` tournait, captures dans
`captures/avances-d70/` (hors dépôt), aucune exception, aucune erreur console, aucune requête externe, aucun
défilement horizontal à 390 px.

### Points 1 et 5 du rapport — f, selon le nombre de dents et l'état de fz

La règle est appliquée telle que tu l'as écrite : **à une dent**, f est jugée sur la valeur théorique avec la
tolérance de fz de sa famille, que fz soit saisie ou non ; **à partir de deux dents**, cohérence avec fz saisi ×
dents, avec **fz affiché × dents quand fz est fournie**, et la tolérance reportée quand fz est masquée, vide ou
illisible. `coherentFeedPerTooth` (`correction.js`) dit sur quoi f est jugée ; `gradeAnswers` et `correctionView`
s'en servent tous les deux : la valeur attendue, le libellé et la ligne de calcul ne peuvent pas contredire la
correction. Pour distinguer fz fournie de fz masquée, `gradeAnswers` reçoit maintenant les grandeurs masquées.

Les tests demandés passent : SDTMR M42 x 4.5 avec fz « 4.5 » et f « 4.5 » → f fausse (et fz) ; MVLNR revient à
[0.00495 ; 0.00505] ; alésoir à 8 dents, fz fournie, f calculée avec 7 dents → refusée ; `tests/chaine.test.js`
vert sur tout le catalogue, f = fz affiché × dents (arrondie ou non) avec fz saisie, fournie et masquée. Sur tout
le catalogue, **avec fz fournie, plus aucune f calculée avec une dent de trop ou de moins n'est acceptée**.

❓ **Un test demandé contredit la règle** : « barre à aléser, fz « 0.0060 », f +1 % → refusée ». La barre à aléser
n'a qu'une dent et son avance est **proportionnelle** : la règle à une dent la juge à ±25 %, au plus ±0.001 po,
soit [0.005 ; 0.007] pour 0.006 — f +1 % (0.00606) y est **acceptée**. Dans Chrome, f +30 % est refusée
(« tolérance : ±25 %, au plus ±0.001 po »). J'ai appliqué la règle, écrit le test selon elle, et laissé un test
`todo` qui nomme la contradiction. Si tu veux f à ±0,1 % à une dent pour toutes les familles (comme le fixe et le
filetage), c'est une ligne à changer : dis-le-moi.

### Point 2 — la demi-unité de f, la plus large des deux

L'intervalle est maintenant [min(plus petit produit × 0,999, fz × dents − ½ unité de f) ; max(plus grand
produit × 1,001, fz × dents + ½ unité de f)]. Bornes obtenues par le moteur, sur la semence, avant et après D70 :

| Cas | fz affiché | f affichée | D69 | D70 |
|---|---|---|---|---|
| MVLNR 2.000" (fixe, 1 dent), fz saisie | « 0.0050 » | « 0.0050 » | [0.0049 ; 0.0051] | **[0.00495 ; 0.00505]** (valeur théorique ±0,1 %, ½ unité) |
| Barre à aléser Ø 1 1/4 po, Ø alésé 2.000" (1 dent), fz saisie | « 0.0060 » | « 0.0060 » | [0.0059 ; 0.0061] | **[0.005 ; 0.007]** (±25 %, au plus ±0.001 po : voir le ❓) |
| SDTMR M42 x 4.5 (1 dent), fz saisie | « 0.17717 » | « 0.17717 » | cohérence avec la fz saisie (« 4.5 » acceptait f « 4.5 ») | **[0.1769882 ; 0.1773425]** |
| Foret Ø 1/2 po, 2 dents, fz saisie | « 0.0030 » | « 0.0060 » | [0.00585 ; 0.00615] | **[0.0058941 ; 0.0061061]** |
| Foret à pointer Ø 1/2 po, 2 dents, fz saisie | « 0.0010 » | « 0.0020 » | [0.00185 ; 0.00215] (±7,5 %) | **[0.0018981 ; 0.0021021]** (±5,1 %) |
| Foret #40, 2 dents, fz saisie | « 0.000588 » | « 0.00118 » | [0.00117 ; 0.001182] | **[0.001171 ; 0.001181]** : « 0.00118 » accepté |
| Fraise à surfacer 1 po, 5 dents, fz saisie | « 0.0040 » | « 0.0200 » | [0.0197 ; 0.0203] | **[0.01973025 ; 0.02027025]** |
| Alésoir 0.6250", 8 dents, fz fournie | « 0.00125 » | « 0.0100 » | [0.0075 ; 0.0125] (tolérance reportée) | **[0.00995 ; 0.01005004]** : 7 dents (0.00875) refusées |
| Alésoir 1.5000", 8 dents, fz fournie | « 0.0030 » | « 0.0240 » | [0.018 ; 0.030] | **[0.0235764 ; 0.0244244]** |
| Fraise en bout 1/2 po, 5 dents, fz masquée | « 0.0030 » | « 0.0150 » | [0.01125 ; 0.01875] | [0.01125 ; 0.01875] (inchangé) |

Pour le foret à pointer, l'intervalle reste à ±5 % : c'est la demi-unité de fz (« 0.0010 », ±0.00005, soit 5 %)
multipliée par les dents, que la cohérence doit garder pour un étudiant qui a écrit fz arrondi.

### Points 3 et 4 — les aides

- **Avance fixe** : « Avance par dent → table des avances, à l'opération de l'outil. Avance fixe : la valeur de
  la table, telle quelle, quel que soit le Ø. » (vu sur MVLNR et MCLNR).
- **Dimension métrique**, seulement alors : l'aide de N et celle de fz proportionnelle se terminent par « Le Ø se
  met en pouces : mm / 25.4. » (vu sur Foret Ø 0.6 mm et Ø 19.0 mm, MCLNR 20 mm et 11 mm, et pour N sur SDTMR
  M16 x 2). Une dimension est métrique si sa valeur est un filet « Ø x pas » en mm, ou si son libellé est en mm :
  la règle qui distinguait déjà « SDTMR (impérial) » et « SDTMR (métrique) » dans la progression, maintenant une
  seule fonction (`isMetricDimension`, `data.js`).
- ❓ **Lecture retenue pour les filets** : pour un filet, fz est le pas, pas le Ø. L'aide de fz dit « Filetage :
  fz = pas, en pouces : mm / 25.4. » en métrique, et « Filetage : fz = pas = 1 / filets au pouce. » en impérial
  (l'ancienne phrase disait les deux à la fois). Le rappel du Ø n'est pas ajouté à l'aide de fz en avance fixe
  (MCLNR) : elle y dit justement « quel que soit le Ø ». À corriger si tu voulais le rappel partout.

### Point 5 du rapport — la ligne de calcul d'un filet

« fz = pas = 2 mm / 25.4 = 0.07874 » (SDTMR M16 x 2 saisi « 2 »), « fz = pas = 1 / 8 = 0.12500 » (taraud 1 - 8
UNC saisi « 8 »), « fz = pas = 1 / 40 = 0.02500 » (taraud #5-40 UNC) : le pas vient de la dimension de la
question (`pitchFormula`, `data.js`), jamais de la saisie. À une dent, la ligne de f reprend de même la valeur
théorique de fz, sur laquelle f est jugée : « f = fz × dents = 0.07874 × 1 ».

### Point 6 du rapport — `test-complet` en local

`npm run publier:test-complet` (`tests/publier-test-complet.mjs`) le publie sur la base locale, celle de
`npm run dev`, comme « Publier » dans l'éditeur et **avec le même code** (`worker/base.js`, `draftErrors`,
`sameContent`) : copies de la banque locale, tables les plus récentes, validation, version suivante, une ligne au
journal (« script local »). Relancé sans changement : « Rien à publier ». **`--remote` est refusé** avant
d'ouvrir quoi que ce soit (testé). La base est ouverte par wrangler (`getPlatformProxy`) ; vérifié sur une D1
jetable : **`wrangler dev` en marche sur la même base voit l'exercice aussitôt** (400 avant, 200 après). Le
brouillon local de test-complet est remplacé par le fichier. `DEMARRAGE.md` §7 et `CLAUDE.md` le disent. Je ne
l'ai pas lancé sur ta base de `npm run dev` : c'est à toi de le faire, une fois.

### Point 8 — tes réponses au tableau

Consignées dans D70 : Udrill à 1 dent confirmé ; grosses avances jugées réalistes ; micro-forets écartés par les
dimensions des exercices (à partir de Ø 1/16 po : #52 et plus gros, 1.6 mm et plus), pas retirés de la banque ;
deux fraises à surfacer de 3 po, à 5 et à 7 dents, à ajouter **en production par l'éditeur** (fz = 0.004 × 3 =
0.012 → plafonnée à 0.010 ; f = 0.050 et 0.070). Rien n'a été touché dans `site/data/` ni dans la semence. Les
deux actions restent à toi (PLAN).

### Nouveaux points douteux

1. **Le test de la barre à aléser** (❓ ci-dessus) : f +1 % est acceptée par la règle à une dent en avance
   proportionnelle.
2. **fz masquée et nombre de dents** : la règle « fz masquée → tolérance reportée » est inchangée ; sur tout le
   catalogue, une f calculée avec une dent de trop ou de moins y passe encore pour les alésoirs (6 et 8 dents),
   la fraise en bout hélicoïdale à 4 et 5 lèvres et la fraise à surfacer à 4 et 5 inserts (certains Ø). C'est
   le prix de ±25 % quand l'étudiant ne voit pas fz ; avec fz fournie ou saisie, ce n'est plus le cas.
3. **« Juste (… attendu) » sur une f exacte** : avec fz saisie, la valeur attendue de f est fz saisi × dents.
   Pour le Foret Ø 0.6 mm, la f du mode test (« 0.000283 », la théorique) s'affiche « Juste (0.000284
   attendu) », parce que 0.000142 × 2 = 0.000284. C'est cohérent avec Vf (« Juste (3048.000 attendu) »), mais
   l'étudiant qui a la valeur exacte lit une « attendue » un peu différente.
4. **La lecture des aides des filets** (❓ ci-dessus, points 3 et 4).
