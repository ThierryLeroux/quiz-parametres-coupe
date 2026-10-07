# Rapport — Démo : le retour à l'accueil, comme sur la page de description d'un exercice

> **Correction des séances en cours (D75, point 7) : aucun changement.** Aucun fichier du serveur, aucune migration ; de
> l'affichage seulement, sur les écrans du mode démo (D92), qui changent pour tout le monde au déploiement. Le vrai
> exercice ne change pas.

Session du 2026-10-07, branche `demo-retour-accueil`, partie de `main` à jour (`015bfa6`, D95). Poussée, pas fusionnée.

## 1. Ce qui est livré

- **Le choix de l'outil** (`renderDemoChooser`, `demo-screen.js`) reçoit en tête, au-dessus du bandeau de la démo, la
  rangée de la page de description d'un exercice : la classe `description-nav` et le lien `HOME_LINK_LABEL`
  (« ← Tous les exercices ») vers l'accueil (`location.pathname`, la page sans `?exercice=`). Même texte, même place,
  même style ; sans « Copier le lien », qui appartient à la page de l'exercice. Aucune nouvelle chaîne.
- **La question et le corrigé en démo** (`renderQuestion` avec `demo`, `question-screen.js`) : la même rangée en tête
  de la colonne de la question, au-dessus du bandeau. Quitter une démo ne fait rien perdre : aucune confirmation.
- **Rien d'autre ne change** : le vrai exercice n'a pas cette rangée (sa question se quitte par la barre du haut) ; le
  spécimen d'attestation garde « ← Retour à la démo ».
- La rangée est construite par `demoHomeNav()` (`demo-screen.js`), que `question-screen.js` importe à côté de
  `demoBanner`.

## 2. Vérifications

- `tests/ui-demo.test.js` (sur le DOM minuscule, contre le vrai Worker) : un test dédié — le choix de l'outil (à
  l'entrée et en cours de démo), la question en démo et son corrigé construisent la rangée en tête, avec le seul lien
  « ← Tous les exercices » vers `/`, de classe `button-link`, sans bouton, suivie du bandeau ; la question du vrai
  exercice n'en construit pas et n'affiche pas ce texte ; le spécimen garde « ← Retour à la démo ». Les deux tests
  existants du bandeau (« le bandeau d'abord ») lisent maintenant la rangée puis le bandeau.
- `npm test` : **887 tests, 0 échec** (886 avant : un test ajouté).
- **Chrome** (sans interface, piloté par DevTools, sur un wrangler dev jetable en mode test ; 1366 × 768 puis
  390 × 844) : **17 vérifications réussies, 0 en échec**, aucune erreur console, aucune exception, aucune requête
  hors du site. Pour chaque largeur : la rangée de la page de description (la référence), puis celle du choix de
  l'outil, de la question et du corrigé en démo — **le même texte, la même adresse, le même lien (120 × 44 px, même
  couleur, même police, sans soulignement), collée au bord gauche et au haut de sa colonne, sur toute sa largeur,
  et le même écart de 12 px** jusqu'à l'élément suivant (le bandeau en démo, le panneau sur la page de description :
  le bandeau de la démo n'a pas de marge du haut). À 1366 px, le choix de l'outil est à la même place que la page de
  description (colonne de 680 px à 343 px du bord) ; la question est dans sa colonne de la mise en page large (811 px
  à 63 px du bord), la rangée en tête, au-dessus du bandeau. Le lien, cliqué depuis le corrigé, ramène à l'accueil
  sans boîte de confirmation ; le spécimen garde « ← Retour à la démo » ; le vrai exercice n'a ni rangée ni bandeau.
  Captures dans `captures/demo-retour-accueil/` (hors dépôt) : la page de description, le choix de l'outil, la
  question, le corrigé, aux deux largeurs.

## 3. Points douteux

1. **« Quitter » dans la barre du haut** d'une démo mène toujours à la page de l'exercice, et la nouvelle rangée à
   l'accueil : deux sorties, deux destinations — comme sur la page de description, dont la barre du haut mène aussi à
   l'accueil (D87). Laissé tel quel.
2. **La hauteur de la barre du haut** diffère d'une page à l'autre à 390 px : « Démo — M10 — Tournage : vitesse de
   coupe » tient sur trois lignes, et la barre de la question porte en plus ses boutons ; la rangée est donc plus
   bas à l'écran qu'en page de description (129 et 155 px au lieu de 109), tout en étant au même endroit de sa
   colonne, avec le même écart de 12 px jusqu'au bandeau. C'est la barre, pas la rangée ; rien n'est changé.
