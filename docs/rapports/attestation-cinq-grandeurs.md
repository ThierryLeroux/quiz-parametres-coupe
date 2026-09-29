# Rapport — l'attestation à cinq grandeurs (décision D85)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Ni formule, ni tolérance, ni texte de
> correction. Aucun fichier de `worker/` ni de `migrations/` ne change.
>
> **Le contenu de l'attestation ne change pas** : mêmes valeurs, même signature, même code, même QR. **Une
> attestation déjà émise reste valide ; seule sa mise en page s'améliore, à l'écran et à l'impression.** Vérifié sur
> neuf attestations : le serveur rend le même enregistrement, chaque code et chaque adresse de QR répondent
> « valide », et les pages écrivent les mêmes cellules, dans le même ordre, avant et après.
>
> **Ce qui change pour tout le monde au déploiement : la page de l'attestation.** À déployer hors des périodes de
> labo.
>
> **Un changement que tu n'as pas demandé, et que je te propose** (point douteux 1) : la place de la page 1 est
> recalibrée. Avec le code de `main`, une page 1 pleine pousse son pied hors de la zone imprimable — aussi à deux
> grandeurs. La correction fait passer une ou deux questions de la page 1 à la page 2. Elle est dans un commit à
> part (`6f53535`), qui s'annule seul. **Sans elle, tes pages à une et deux grandeurs sont identiques à celles
> d'avant, octet pour octet.**

Session du 2026-09-29, branche `attestation-cinq-grandeurs`, partie de `main` (`555a71a`). Poussée, pas fusionnée.
Rien n'a été lu ni écrit en production.

## 1. Ce qui a été fait

Trois fichiers du site changent : `site/js/ui/attestation-data.js` (les règles, pures et testées),
`site/js/ui/attestation-screen.js` (le DOM), `site/css/attestation.css`.

**1. La colonne du matériau usiné.** À quatre ou cinq grandeurs évaluées, le tableau des questions prend des
largeurs resserrées. La règle : les largeurs ordinaires tant qu'elles laissent au matériau au moins 100 px.

| Grandeurs | N° | Outil | Matière d'outil | Matériau usiné | Chaque grandeur | Date et heure |
|---|---|---|---|---|---|---|
| 1, 2, 3 (inchangé) | 22 | 180 | 90 | 258, 198, 138 | 60 | 110 |
| 4 | 22 | 150 | 56 | **214** (78 avant) | 54 | 62 |
| 5 | 22 | 150 | 56 | **160** (18 avant) | 54 | 62 |

Pour y arriver : chaque en-tête sur deux lignes (« Vc » / « (pi/min) », « Matière » / « d'outil », « Date » /
« et heure ») ; la date puis l'heure sur deux lignes ; la matière d'outil sur deux lignes au besoin (« Insert de » /
« carbure »). Les polices et leurs tailles ne changent pas. Une valeur de huit caractères (« 0.000938 ») tient dans
sa colonne. Page lettre, portrait.

**2. Le repli entre les mots.** Aucun mot n'est coupé. La colonne du matériau (152 px utiles à cinq grandeurs) est
deux fois plus large que le mot le plus long des tables, « thermodurcissable » (72 px).

**3. Le tableau « Opérations effectuées » se poursuit** sur la page suivante. Son titre dit « — suite à la page
suivante » ; la page suivante reprend l'en-tête du département, la ligne de rappel, « Opérations effectuées
(suite) » et l'en-tête du tableau. La note reste sous son dernier rang. La liste des questions vient ensuite, sur la
même page. La page 1 porte 20 outils avec la note, 22 quand le tableau se poursuit.

**4. La place de la page 1**, recalibrée de 460 à 420 px (point douteux 1).

## 2. Les pages, avant et après

Les mêmes neuf attestations, montrées par le code de `main` puis par celui de la branche, sur la même base et à la
même adresse. Les sept exercices du lot, et les deux M10 d'origine.

| Exercice | Grandeurs | Outils | Questions | Pages avant | Pages après | Rang le plus haut, avant | après |
|---|---|---|---|---|---|---|---|
| Tournage — Exercice 2 | 2 | 13 | 36 | 3 | 3 | 33 px | 33 px |
| Tournage — Exercice 3 | 5 | 9 | 27 | 11 | **3** | 449 px | 33 px |
| Fraisage — Exercice 2 | 2 | 13 | 34 | 3 | 3 | 33 px | 33 px |
| Fraisage — Exercice 3 | 5 | 6 | 15 | 7 | **2** | 371 px | 33 px |
| M30 — Fraisage CN | 5 | 18 | 43 | 20 | **4** | 449 px | 33 px |
| M40 — Tournage CN | 5 | 15 | 39 | 17 | **3** | 449 px | 33 px |
| F50 — Synthèse | 5 | 35 | 37 | 16 | **4** | 449 px | 33 px |
| M10 — Tournage : vitesse de coupe | 1 | 9 | 15 | 2 | 2 | 33 px | 33 px |
| M10 — Tournage : Vc et RPM | 2 | 11 | 22 | 2 | 2 | 33 px | 33 px |

Les nombres d'avant diffèrent un peu de ceux du rapport `lot-exercices` (6 à 19 pages) : les matériaux sont tirés
au hasard, et ces séances sont nouvelles.

**Rien ne déborde du pied de page.** Par page, après, en mode impression : outils / questions / pixels libres entre
le bas du contenu et le haut du pied. Une page pleine en garde 12.

| Exercice | Page 1 | Page 2 | Page 3 | Page 4 |
|---|---|---|---|---|
| Tournage — Exercice 2 | 13 / 3 / 65 | 0 / 27 / 197 | 0 / 6 / 656 | |
| Tournage — Exercice 3 | 9 / 5 / 43 | 0 / 21 / 96 | 0 / 1 / 756 | |
| Fraisage — Exercice 2 | 13 / 3 / 52 | 0 / 27 / 145 | 0 / 4 / 696 | |
| Fraisage — Exercice 3 | 6 / 7 / 48 | 0 / 8 / 525 | | |
| M30 | 18 / 0 / 38 | 0 / 21 / 96 | 0 / 21 / 96 | 0 / 1 / 756 |
| M40 | 15 / 1 / 32 | 0 / 21 / 96 | 0 / 17 / 228 | |
| F50 | 22 / 0 / 20 | 13 / 9 / 70 | 0 / 21 / 96 | 0 / 7 / 558 |
| M10 — vitesse de coupe | 9 / 7 / 68 | 0 / 8 / 642 | | |
| M10 — Vc et RPM | 11 / 5 / 34 | 0 / 17 / 423 | | |

Avant, trois pages 1 débordaient : F50 de 379 px, « M10 — Tournage : Vc et RPM » de 18 px, « Tournage —
Exercice 3 » de 6 px.

## 3. Non-régression, en deux temps

**Premier temps — le commit des largeurs (`43a2232`), sans le recalibrage.** Les quatre attestations à une et deux
grandeurs, soit dix pages : **identiques à celles du code de `main`, octet pour octet.** « Tournage — Exercice 2 »
(3 pages), M10 d'origine (2), « Fraisage — Exercice 2 » (3), « M10 — Tournage : Vc et RPM » (2).

**Second temps — le commit du recalibrage (`6f53535`).** Le nombre de pages ne change pas. La page 1 porte moins
de questions ; elles passent à la page 2, et les suivantes se décalent d'autant. Rien d'autre ne bouge : mêmes
largeurs, même repli, mêmes textes.

| Exercice | Questions en page 1, avant | après |
|---|---|---|
| Tournage — Exercice 2 | 4 | 3 |
| M10 — Tournage : vitesse de coupe | 9 | 7 |
| Fraisage — Exercice 2 | 5 | 3 |
| M10 — Tournage : Vc et RPM | 7 (le pied hors de la page, de 18 px) | 5 |

## 4. Vérifications

- `npm test` : **789 tests, 0 échec** (779 avant ; 10 nouveaux).
- `npm run test:api` : **35 étapes**.
- **Trois tests existants sont retouchés**, tous dans `tests/ui-attestation.test.js` : celui de `paginateQuestions`
  devient celui de `paginateAttestation`, avec les mêmes cas ; celui de `questionColumns` attend le champ `lines` ;
  celui du repli n'attend plus « cinq lignes au moins » à cinq grandeurs. Aucun autre fichier de test ne change.
- **Dans Chrome, à l'écran et en mode impression**, sur mon propre serveur (port 8871 ; ton `npm run dev` n'a pas
  été touché), dans une base jetable où l'export est restauré et le lot importé puis publié.

| Passe | Vérifications | Échecs |
|---|---|---|
| Code de `main` | 93 | 19 : les défauts du constat, et le pied de « Vc et RPM » |
| Commit des largeurs, sans recalibrage | 93 | 10 : cinq pages 1 dont le pied sort de la page |
| **Code de la branche** | **93** | **0** |

  Pour chaque attestation : le serveur rend l'enregistrement émis, son code, sa signature et l'adresse du QR,
  inchangés ; le code et l'adresse du QR se vérifient, « valide » ; rien ne déborde d'une page ni de son pied ; le
  PDF a autant de pages que l'écran ; tous les outils et toutes les questions sont sur les pages ; les deux tableaux
  écrivent l'enregistrement, en entier et dans l'ordre ; aucun mot coupé ; aucune cellule ne passe sur sa voisine ;
  aucun rang plus haut que son estimation. Aucune exception, aucune requête hors du site.
- **L'estimation des lignes contre le réel, pour tout le catalogue** : les 651 noms d'outils que le moteur compose et
  les 47 matériaux, soit 1 349 rangs, à une, deux, trois, quatre et cinq grandeurs, à l'écran et à l'impression.
  **Aucun rang sous-estimé, aucun mot coupé, aucune cellule trop large.**
- **La page de vérification** (`/verifier`), à 1280 et à 390 px, à deux et à cinq grandeurs : identique à celle
  d'avant, octet pour octet. Elle n'est pas touchée (point douteux 3).
- **Sur un écran de 390 px**, l'attestation de M30 : la page lettre garde sa taille (816 px) et défile dans son
  cadre, comme avant.
- La console montre des refus 404 du pictogramme de « Chanfreinage / chambrage » sur la page de l'exercice. Ce
  n'est pas ce chantier : c'est le geste 7 du rapport `lot-exercices`.

## 5. Captures

Dans `captures/attestation-cinq-grandeurs/` (hors dépôt).

| Fichier | Ce qu'on y voit |
|---|---|
| `m30-fraisage-cn-page-1-avant.png`, `…-apres.png` | la page 1 de M30 : la même, le tableau par outil y tient ; seul le pied diffère (« Page 1 de 20 », « Page 1 de 4 ») |
| `m30-fraisage-cn-page-2-avant.png`, `…-apres.png` | **la colonne du matériau** : 3 rangs et 18 px avant, 21 rangs et 160 px après |
| `f50-synthese-page-1-avant.png`, `…-apres.png` | **la page 1 de F50** : 35 outils qui débordent avant ; 22 outils et « suite à la page suivante » après |
| `f50-synthese-page-2-avant.png`, `…-apres.png` | après : la suite du tableau par outil, sa note, puis la liste des questions |
| `avant/`, `etape-1/`, `apres/` | les neuf attestations, page par page, en entier, et leur PDF — pour chacun des trois codes |
| `verifier/` | la page de vérification, avant et après |
| `telephone/` | l'attestation de M30 à 390 px |
| `mesures/` | les mesures et les journaux des passes |

## 6. Tes gestes

1. **Relis ce rapport et tranche les points douteux**, surtout le premier.
2. **Fusionne hors des périodes de labo** : la page de l'attestation change au déploiement.
3. **Après le déploiement**, ouvre une attestation déjà émise et enregistre-la en PDF : même code, même QR.
4. **Puis le geste 14 du rapport `lot-exercices`** : publie les dix exercices à cinq grandeurs.

## 7. Points douteux

**1. La place de la page 1 est recalibrée, de 460 à 420 px — tu ne l'as pas demandé.** La constante d'origine
offrait 37 px de trop : la place réelle est de 422,9 px. Quand la liste remplit la page 1 jusqu'au bout, le pied de
page sort de la zone imprimable. C'est déjà le cas avec le code de `main`, à deux grandeurs : 18 px sur « M10 —
Tournage : Vc et RPM ». La vérification écrite dans UI §3.6 ne le voyait pas : à l'écran, ce qui dépasse tombe dans
la marge de la page. Sans cette correction, quatre des cinq attestations à cinq grandeurs débordent aussi, de 2 à
30 px.
Elle contredit ta demande 4 à la lettre : à une et deux grandeurs, une ou deux questions changent de page.
*Proposition* : la garder. Si tu préfères tes pages d'avant telles quelles, annule le commit `6f53535` ; les pages 1
pleines déborderont de nouveau.

**2. La place d'une page de suite est prudente de 50 px** : 740 px dans le code, 790 mesurés. Je ne l'ai pas
touchée. Conséquence : « Tournage — Exercice 3 » et M30 finissent sur une page qui ne porte qu'une question. Avec
786 px, « Tournage — Exercice 3 » passerait de 3 à 2 pages et M30 de 4 à 3 ; les pages 2 et suivantes des
attestations à une et deux grandeurs porteraient un ou deux rangs de plus.
*Proposition* : le faire, si tu acceptes le point 1 — une constante et ses tests.

**3. La page de vérification replie mal la liste des questions, et c'est plus ancien que ce chantier.** À 390 px,
les textes s'y écrivent deux ou trois lettres par ligne : un rang fait de 132 à 448 px de haut à deux grandeurs,
jusqu'à 834 px à cinq. À 1280 px, les nombres se coupent (« 354 » / « 2 »), et le N° aussi (« 1 » / « 0 »). C'est
la page qu'on ouvre en scannant le QR, souvent sur un téléphone. Je ne l'ai pas touchée : elle est hors de ta
demande. Captures dans `verifier/`.
*Proposition* : un petit chantier à part, de la feuille de style seulement : repli entre les mots, nombres jamais
coupés, tableau qui défile dans son cadre.

**4. Le tableau par outil garde ses largeurs automatiques.** Quand il se poursuit, ses colonnes n'ont pas la même
largeur d'une page à l'autre : sur F50, « Opération » fait 177 px en page 1 et 141 px en page 2, où la longue plage
de la fraise à fileter prend sa place. Et un rang de ce tableau compte toujours pour une ligne : une plage de plus
de 75 caractères environ se replierait sans être comptée. La plus longue d'aujourd'hui en a 63.
*Proposition* : laisser. Des largeurs fixes changeraient la page 1 de toutes les attestations.

**5. Le titre de la liste peut rester seul au bas d'une page**, sans rang dessous : « Questions réussies qui
comptent (43) — suite à la page suivante », sur la page 1 de M30. C'était déjà ainsi.
*Proposition* : laisser.

**6. À trois grandeurs, les largeurs restent ordinaires** : le matériau y a 138 px, au-dessus de tes 100 px. Aucun
exercice n'a trois grandeurs aujourd'hui.
*Proposition* : laisser.

**7. Une valeur de neuf caractères dépasserait sa colonne de 5 px**, vers la gauche : une avance sous 0.0001
(« 0.0000938 »), celle d'un micro-foret. Aucun exercice du lot n'en tire.
*Proposition* : laisser.

**8. Un mot plus large que sa colonne se couperait**, en dernier recours, plutôt que de passer sur la colonne
voisine. Il faudrait un mot de plus de 35 caractères environ ; un test vérifie qu'aucun mot des tables ni des noms
d'outils n'y arrive.
*Proposition* : garder cette règle.

**9. Tout est mesuré dans Chrome.** Firefox et Safari n'ont pas été essayés, comme pour les chantiers précédents.
La marge de 3 px sur la page 1 et celle de 50 px sur les pages de suite couvrent un écart de rendu.
*Proposition* : essayer un PDF depuis un iPhone quand tu essaieras le reste (section Finition).
