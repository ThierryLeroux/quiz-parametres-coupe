# Pictogrammes des opérations — conversion du classeur en SVG

Les 19 pictogrammes d'opérations d'usinage sont dessinés **en vectoriel dans le classeur Excel**
d'origine (`legacy/Exercice_M10_tournage_vc_version_etudiant_r0.xlsm`, feuille « Avances d'usinage ») : des formes
DrawingML rangées dans le groupe « Group 4 » de `xl/drawings/drawing3.xml`, un sous-groupe par
opération. `convertir.mjs` les convertit en SVG **sans redessin** : géométrie, couleurs et
épaisseurs de trait viennent du classeur.

## Relancer la conversion

```
node reference/pictogrammes-du-classeur/convertir.mjs
```

Depuis la racine du dépôt, Node seul, aucune dépendance. Le script lit directement le `.xlsm`
(chemin explicite en tête du script) et réécrit les 19 fichiers `site/img/pictos/operations/<slug>.svg`.
Il est déterministe : relancé, il réécrit des fichiers identiques octet pour octet. **Ne pas
retoucher les SVG à la main** : corriger le script, puis relancer.

Le slug suit la règle d'`operationSlug` (`site/js/ui/sheets-data.js`).

## Correspondance sous-groupe → opération

Les sous-groupes sont empilés dans la feuille, un par rang de la table des avances ; les rangs
suivent l'ordre de `site/data/operations.json`. La table `ICONS` du script écrit cette
correspondance en clair, et le script s'arrête si elle ne suit plus l'ordre vertical des
sous-groupes ou l'ordre d'`operations.json`.

| Sous-groupe du classeur | Opération | Fichier |
| --- | --- | --- |
| Group 54 | Contournage ébauche | `contournage_ebauche.svg` |
| Group 51 | Contournage finition | `contournage_finition.svg` |
| Group 44 | Surfaçage | `surfacage.svg` |
| Group 40 | Chanfreinage / ébavurage | `chanfreinage_ebavurage.svg` |
| Group 39 | Perçage | `percage.svg` |
| Group 38 | Chanfreinage | `chanfreinage.svg` |
| Group 36 | Alésage à l'alésoir | `alesage_a_l_alesoir.svg` |
| Group 35 | Pointage | `pointage.svg` |
| Group 169 | Taraudage | `taraudage.svg` |
| Group 206 | Filetage externe | `filetage_externe.svg` |
| Group 208 | Filetage interne | `filetage_interne.svg` |
| Group 193 | Chariotage ébauche | `chariotage_ebauche.svg` |
| Group 194 | Chariotage finition | `chariotage_finition.svg` |
| Group 201 | Centrage | `centrage.svg` |
| Group 204 | Alésage à la barre | `alesage_a_la_barre.svg` |
| Group 456 | Dressage | `dressage.svg` |
| Group 462 | Tronçonnage | `tronconnage.svg` |
| Group 479 | Rainurage externe | `rainurage_externe.svg` |
| Groupe 180 | Rainurage interne | `rainurage_interne.svg` |

## Vocabulaire DrawingML couvert

- Formes libres `a:custGeom` : `moveTo`, `lnTo`, `cubicBezTo`, `close`, repère `a:path w= h=` mis à
  l'échelle de `a:ext`.
- Formes prédéfinies, avec leurs valeurs d'ajustement (`a:avLst`) et les formules de
  `presetShapeDefinitions.xml` : `line`, `straightConnector1`, `ellipse`, `snip2SameRect`, `arc`,
  `blockArc`. Les arcs deviennent des courbes de Bézier.
- Groupes imbriqués (`off`, `ext`, `chOff`, `chExt`), étirement inégal en x et en y compris ;
  `rot`, `flipH`, `flipV` des formes (retournement, puis rotation, autour du centre).
- Remplissages `solidFill` et `noFill`, sinon `fillRef` du style (idx 0 = aucun). Couleurs
  `srgbClr`, `sysClr` (valeur `lastClr`), `schemeClr` résolues avec le thème, modificateurs `shade`
  et `tint`.
- Traits : `a:ln` de la forme par-dessus le trait du thème désigné par `lnRef` (épaisseur, bout,
  joint en onglet de limite 8, tireté `prstDash`). Les épaisseurs ne sont pas mises à l'échelle par
  les groupes, comme dans Office.
- Pointes de flèche `stealth` et `triangle` sur les traits droits, dessinées en polygones : taille
  = facteur (`sm` 2, `med` 3, `lg` 5) × épaisseur du trait, celle-ci comptée pour 2 pt au moins ;
  le trait s'arrête à la base de la pointe.

Tout le reste (groupe tourné ou retourné, image, texte des formes, dégradé, autre forme
prédéfinie, autre type de pointe, `arcTo` dans une forme libre, `lumMod`, `alpha`…) **arrête le
script avec un message** : rien n'est ignoré en silence. Le texte des formes (`txBody`) est vide
dans ces dessins et n'est pas lu.

## Choix à connaître

- **L'étirement de « Group 4 » n'est pas appliqué.** Le groupe qui contient les 19 dessins est
  étiré en largeur d'environ 14 % (`ext` 648000 contre `chExt` 566265) parce qu'il est ancré aux
  cellules de la feuille : dans Excel, les fraises rondes paraissent donc ovales, plus ou moins
  selon la largeur de colonne à l'écran. Les SVG gardent les proportions des dessins eux-mêmes
  (fraise ronde). Les étirements des sous-groupes et des groupes imbriqués, eux, sont appliqués.
- Une forme tournée d'environ 90° ou 270° dans un groupe étiré est mise à l'échelle par sa boîte
  vue à l'écran (côtés échangés), pour rester alignée sur ses voisines.
- Une forme libre dont le tracé revient exactement à son point de départ est fermée (`Z`) : même
  géométrie, mais le dernier coin a un vrai joint. Les tracés ouverts du classeur restent ouverts
  (remplis, sans trait sur le côté ouvert), comme dans Excel.
- Unité des SVG : 1 = 1 pt (12700 EMU), coordonnées à 2 décimales. `viewBox` = boîte englobante
  des formes et de la demi-épaisseur des traits, plus 0,5 pt de marge pour les pointes des joints.
- Pointes de flèche : les facteurs, le minimum de 2 pt et la base rentrée aux 2/3 de la pointe
  `stealth` sont mesurés sur le rendu d'Excel ; ce ne sont pas des valeurs écrites dans le classeur.

## Vérification

Planche-contact des 19 SVG à côté des anciens PNG provisoires (rendus rognés de la feuille, voir
`reference/pictogrammes-excel-provisoires/`) : `captures/jalon-4/planche-pictogrammes.png`.
