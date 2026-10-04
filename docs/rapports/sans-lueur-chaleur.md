# Rapport — L'image de chaleur sans lueur (D89)

**Correction des séances en cours : non touchée.** Aucun fichier de `worker/`, aucune migration. Au déploiement,
l'image de chaleur du panneau du matériau apparaît sans halo coloré pour tout le monde.

## Ce qui change

Sur l'écran Question, l'image de chaleur (le schéma de copeaux de la classe ISO) n'a plus la lueur de la couleur
de la classe (`filter: drop-shadow(0 0 var(--glow) var(--panel-color))`, D67), qui rendait le schéma difficile à
lire. Le **fondu des bords** (dégradé transparent sur 10 % de chaque côté) est conservé tel quel, comme la largeur
bornée et la légende. La photo de l'outil garde sa lueur ; le panneau garde sa couleur de classe.

## Fichiers

- `site/css/question.css` : la ligne `filter` retirée de `.material-image img`, le commentaire mis à jour.
- `docs/DECISIONS.md` : D89 (remplace la puce « Lueur » de D67).
- `docs/UI.md` §3.3 : « sans lueur ».

## Vérifications

- `npm test` : 806 réussis, 0 échec.

## Point douteux

1. Pas de vérification visuelle dans un navigateur cette fois (aucun navigateur disponible sur le poste depuis la
   session). Le changement est le retrait d'une seule propriété CSS ; à regarder sur `npm run dev` avant de fusionner.
