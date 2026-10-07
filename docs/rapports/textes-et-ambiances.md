# Rapport — Les textes et les ambiances de couleur par espace (décisions D93, D94)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Aucune tolérance, aucune formule, aucun calcul,
> aucune migration ; `gradeQuestion`, `correctionView`, le tirage, l'attestation (enregistrement, code, signature, QR)
> et sa vérification ne changent pas. **Ce qui change pour tout le monde au déploiement** : les textes de tous les
> écrans et les messages d'erreur du serveur (des textes seulement) ; **la page de l'attestation**, dont la note sous le
> tableau par outil perd la phrase « Les paramètres ont été corrigés par le serveur de correction. » et tient sur une
> ligne au lieu de deux (la constante de pagination `note`, 39 px, reste telle quelle : prudente, elle ne fait jamais
> déborder une page — point douteux 1), et dont la mention « Vérification : … — code … » devient « … · code … » ; les
> couleurs de l'espace professeur et de la Gestion du contenu. Une séance en cours voit les nouveaux textes à son
> prochain écran, rien d'autre. À déployer hors des périodes de labo.

Session du 2026-10-06, branche `textes-et-ambiances`, partie de `main` à jour (`75d2957`, D92). Poussée, pas fusionnée.

## 1. Ce qui est livré

### 1.1 L'accueil

- La ligne des trois étapes (« Ton cours », « L'exercice indiqué sur Léa », « Ton matricule et ton NIP ») est retirée,
  avec ses règles CSS (`HOME_STEPS`, `.home-steps`, `.home-step-number`).
- La porte professeur ne garde que « Enseignants » et le bouton « Espace professeur → », le bouton poussé à droite ;
  la note sur la démo (`DEMO_NOTE`) n'existe plus.
- L'indice du bouton Démo : « Essayer sans identification » (`DEMO_HINT`, une constante ; `demoHint(titre)` n'existe
  plus).

### 1.2 Les textes côté étudiant (D93)

Les trente remplacements demandés (2.7 à 2.22) sont faits mot pour mot ; le tableau avant → après est dans D93. Deux
précisions :

- **Mode test** : « Mode test : « Remplir » inscrit les bonnes réponses. Modifie une case pour simuler une erreur. » —
  « Mode test » reste en gras, le reste de la phrase suit.
- **Spécimen** : la consigne de la barre est « **Exemple sans valeur.** C'est ce document que tu remettras sur Léa à la
  fin du vrai exercice. » ; le titre de la barre du haut reste « Spécimen d'attestation — <titre> », et le filigrane
  « SPÉCIMEN ».

**Les autres textes vus par un étudiant qui enfreignaient les règles** (ta demande, point 2.23) — ce que j'ai changé de
moi-même :

| Où | Avant | Après | Règle |
|---|---|---|---|
| Partout (site injoignable) | Le serveur de correction ne répond pas. Vérifie ta connexion, puis réessaie. | Le site ne répond pas. Vérifie ta connexion, puis réessaie. | 2.2 |
| `api.js` (réponse sans message) | Le serveur a répondu 502. · La réponse du serveur est illisible. | Erreur 502. Réessaie dans un instant. · Réponse illisible. | 2.2 |
| Serveur, adresse inconnue | Cette adresse n'existe pas sur le serveur de correction. | Cette adresse n'existe pas. | 2.2 |
| Serveur, erreur imprévue | Erreur du serveur de correction. Réessaie dans un instant. · Erreur du serveur. | Une erreur est survenue. Réessaie dans un instant. · Une erreur est survenue. | 2.2 |
| Séance expirée (navigateur et serveur) | Ta séance a expiré : identifie-toi de nouveau. | Ta séance a expiré. Identifie-toi de nouveau. | 2.1 |
| Accueil, exercice inconnu | L'exercice « x » n'existe pas — vérifie le lien sur Léa. | L'exercice « x » n'existe pas. Vérifie le lien sur Léa. | 2.1 |
| Page de l'exercice | Fournies par l'exercice : avance par dent (fz)… | Données : avance par dent (fz)… | 2.4 |
| Panneau de l'outil, facteur forcé | Facteur propre à cet outil : × 1 — fraise à inserts de carbure | Facteur propre à cet outil : × 1 (fraise à inserts de carbure) | 2.1 |
| Panneau de l'outil, deux diamètres | Ø usiné (alésé) : 1.500" — pour la vitesse de rotation · Ø de la barre : 3/4 po — pour l'avance | Pour la vitesse de rotation, Ø usiné (alésé) : 1.500" · Pour l'avance, Ø de la barre : 3/4 po | 2.1 |
| Aide de fz, filetage métrique | Filetage : fz = pas, en pouces : mm / 25.4. | Filetage : fz = pas, en pouces (mm / 25.4). | 2.1 |
| Attestation, mention | Vérification : hôte/verifier — code ABCDE-FGHJK | Vérification : hôte/verifier · code ABCDE-FGHJK | 2.1 |
| Feuille des formules, note du facteur | … à l'opération de l'outil ; 1 si aucune réduction. | … à l'opération de l'outil (1 si aucune réduction). | 2.1 |
| Feuille des formules, saisie | Saisie — point décimal, pas de séparateur de milliers : 1600 · 0.0015. | Saisie : un nombre (1600 · 0.0015) ou un calcul ((3-1)*2), avec le point décimal. | 2.1 |
| Barre du haut du choix de l'outil (démo) | Démo · rien n'est gardé | TGM-TMI (comme à l'accueil, à la place du rappel retiré) | 2.3 |

Le compteur « Sur cet outil : n réussites de suite sur m » sort de la ligne sous les cases, comme demandé ; la fonction
`toolStreak` (`rules.js`) et son test sont retirés, puisque plus rien ne s'en sert.

### 1.3 Les ambiances de couleur (D94)

- **Trois espaces**, chacun avec trois variables (`--color-accent`, `--color-accent-light`, `--color-link-hover`) :
  étudiant (le bleu actuel, inchangé), consultation (ambre `#f5a623`, clair `#ffbd5c`, survol `#ffd38a`),
  administration (pourpre `#b07cff`, clair `#c9a3ff`, survol `#dcc2ff`). Tout ce qui lisait déjà ces variables suit :
  contours des panneaux, ligne et halo sous la barre du haut, bouton principal, bordures des cases et des listes,
  onglets, titres, liens, anneau de focus, boutons au contour.
- **Une seule source** : les deux blocs `:root[data-espace="consultation"]` et `:root[data-espace="admin"]` de
  `tokens.css`, qui reprennent six variables nommées dans `:root` (`--espace-consultation-accent`…). L'attribut
  `data-espace` est sur `<html>` : « etudiant » en dur sur `index.html`, `verifier.html`, `tables.html` et
  `prof.html` ; « admin » en dur sur `prof/editeur.html` ; sur `/prof`, `applySpace()` le pose d'après `spaceOf(role)`
  à la connexion (étudiant), au tableau (selon la clé) et à la déconnexion (étudiant).
- **L'étiquette** « Administration » / « Consultation » (`.espace-etiquette`, contour accent, texte accent clair,
  capitales) à droite de la barre du haut, à la place de « admin » et « consultation (lecture seule) » ; « lecture
  seule » reste dans le sur-titre du tableau (« Espace professeur · lecture seule »). Dans la Gestion du contenu,
  l'étiquette « Administration » est là dès la connexion.
- **La bande à chevrons** de l'administration : `body::before`, 6 px, `repeating-linear-gradient(135deg, pourpre 0 10px,
  noir 10px 20px)`, au-dessus de la barre ; `display: none` à l'impression.
- **Les couleurs de sens ne bougent pas** : le vert (juste, « En direct »), le rouge (faux, erreur, Supprimer), le doré
  (contour à 100 %, panneau de l'outil, « Publier… », spécimen, mode test, avertissements), les classes ISO et les
  matières d'outil (D61) — le test le vérifie (`tests/ui-ambiances.test.js`), et Chrome aussi (le bouton « Publier… »
  doré et la pastille « En direct » verte dans l'espace pourpre, « Supprimer » rouge, « Réussi le … » vert).
- **Contrastes AA**, calculés par le test (texte sur le fond `#05091a` et sur un panneau `#0b1430`, texte nuit sur un
  bouton plein) :

| Espace | accent / fond | accent / panneau | clair / fond | clair / panneau | nuit / bouton |
|---|---|---|---|---|---|
| Étudiant (bleu) | 6,8 | 6,3 | 9,9 | 9,1 | 6,8 |
| Consultation (ambre) | 9,8 | 9,0 | 12,0 | 11,0 | 9,8 |
| Administration (pourpre) | 6,8 | 6,2 | 9,6 | 8,8 | 6,8 |

- **L'ambre et le doré** (ta question 3.2) : dans l'espace de consultation, **aucun élément doré n'est affiché** —
  Chrome l'a compté : zéro élément dont la couleur, le contour, le fond ou l'anneau soit `#ffc000` sur `/prof` en
  consultation, à 1366 et à 390 px. La confusion ne peut donc pas se produire sur un même écran. Les deux teintes sont
  voisines (ambre 37°, doré 45° ; l'ambre clair des titres, `#ffbd5c`, est plus pâle que le doré) : si, à l'usage, le
  passage de l'accueil (contour doré à 100 %, bouton doré de l'attestation) à la consultation les confond, **je propose
  un ambre plus orangé** — accent `#f28c28`, clair `#ffab5e`, survol `#ffc98a` (contrastes 8,1 / 7,4 / 10,6 / 9,7 / 8,1,
  tous AA) ; c'est trois valeurs à changer dans `tokens.css` et dans le test. Point douteux 5.

## 2. Les textes côté professeur — avant → après (à relire avant la fusion)

Tout ce qui change dans l'espace professeur, la Gestion du contenu et les messages du serveur qu'ils affichent ; les
textes qui respectaient déjà les règles ne sont pas touchés. `/tables` n'avait rien à corriger, sauf son pied de page
(« TGM-TMI »).

### 2.1 Espace professeur (`/prof`)

| Où | Avant | Après |
|---|---|---|
| Connexion | Entre la clé d'administration ou la clé de consultation du serveur de correction. La séance dure 12 h. | Entre ta clé. La séance dure 12 h. |
| Barre du haut, connecté | admin · consultation (lecture seule) | l'étiquette **Administration** · **Consultation** (D94) |
| Sur-titre du tableau | Espace professeur · admin · Espace professeur · consultation (lecture seule) | Espace professeur · Espace professeur · lecture seule |
| Séance expirée (trois endroits) | Ta séance a expiré : connecte-toi de nouveau. | Ta séance a expiré. Connecte-toi de nouveau. |
| Supprimer une séance | Supprimer la séance de X Y, matricule M (T) ? La séance et son journal disparaissent, sans retour ; l'étudiant pourra recommencer de zéro. Son attestation C restera vérifiable et répondra « annulée — séance supprimée ». | Supprimer la séance de X Y, matricule M (T) ? La séance et son journal disparaissent, sans retour. L'étudiant pourra recommencer de zéro. Son attestation C restera vérifiable et répondra « annulée ». |
| Remettre à zéro | Remettre à zéro la séance de X Y (M, T) ? Sa progression repart de zéro ; le matricule et le NIP restent. Son attestation sera annulée ; l'ancien code répondra « annulée ». | Remettre à zéro la séance de X Y (M, T) ? Sa progression repart de zéro. Le matricule et le NIP restent. Son attestation sera annulée. L'ancien code répondra « annulée ». |
| Réinitialiser le NIP | Réinitialiser le NIP de X Y (M, T) ? Le verrou tombe ; à sa prochaine reprise, le NIP qu'il ou elle entrera deviendra le nouveau. Sa progression ne change pas. | Réinitialiser le NIP de X Y (M, T) ? Le verrou tombe. À sa prochaine reprise, le NIP entré deviendra le nouveau. Sa progression ne change pas. |
| Effacement, étape 1 | Exporter toutes les séances en CSV d'abord : c'est la dernière occasion. | Exporte toutes les séances en CSV d'abord. C'est la dernière occasion. |
| Effacement, bilan | Effacé : 3 séances, …, 12 compteurs de débit et 1 verrou ; journal des actions gardé, 4 entrées anonymisées. | Effacé : 3 séances, …, 12 compteurs de débit et 1 verrou. Journal des actions gardé, 4 entrées anonymisées. |

### 2.2 Gestion du contenu — connexion, liste, page d'un exercice

| Où | Avant | Après |
|---|---|---|
| Connexion | Entre la clé d'administration du serveur de correction. La Gestion du contenu n'est pas ouverte à la clé de consultation. La séance dure 12 h. | Entre la clé d'administration. La clé de consultation n'ouvre pas la Gestion du contenu. La séance dure 12 h. |
| Connexion, clé de consultation refusée | La Gestion du contenu est réservée à la clé d'administration : la clé de consultation ne fait que lire l'espace professeur. | La Gestion du contenu est réservée à la clé d'administration. La clé de consultation ouvre seulement l'espace professeur, en lecture. |
| Barre du haut | TGM-TMI (connexion) · admin | l'étiquette **Administration**, partout (D94) |
| Pied de page | TGM-TMI · Les exercices publiés sont ce que voient les étudiants ; le brouillon ne change rien tant qu'il n'est pas publié. | TGM-TMI · Les étudiants voient les versions publiées. Le brouillon ne change rien tant qu'il n'est pas publié. |
| Liste, paragraphe | Les étudiants voient la dernière version publiée de chaque exercice ; une séance commencée garde sa version jusqu'à la fin. Le brouillon ne change rien tant qu'il n'est pas publié. L'ordre de cette liste (↑ ↓) est celui de l'accueil des étudiants. | Les étudiants voient la dernière version publiée de chaque exercice. Une séance commencée garde sa version jusqu'à la fin. Le brouillon ne change rien tant qu'il n'est pas publié. L'ordre de cette liste (↑ ↓) est celui de l'accueil. |
| Nouvel exercice, identifiant | Minuscules, chiffres et tirets ; définitif : c'est le lien sur Léa. | Minuscules, chiffres et tirets. Définitif : c'est le lien sur Léa. |
| Renommer (publié), la question | Nouveau titre — en direct : les étudiants le voient dès que leur page se recharge, séances en cours comprises (l'ancien reste dans l'historique de la présentation de l'exercice) : | Nouveau titre, en direct. Les étudiants le voient dès que leur page se recharge, séances en cours comprises. L'ancien reste dans l'historique de la présentation. Nouveau titre : |
| Renommer (brouillon), la question | Nouveau titre (celui du brouillon ; il entrera en vigueur à la première publication) : | Nouveau titre du brouillon (il entrera en vigueur à la première publication) : |
| Renommé en direct | Titre changé en direct : « T ». Les étudiants le voient dès que leur page se recharge ; l'ancien est dans l'historique de la présentation de l'exercice. | Titre changé en direct : « T ». Les étudiants le voient dès que leur page se recharge. L'ancien est dans l'historique de la présentation de l'exercice. |
| Titre en double (panneau) | … Rien n'est bloqué ; l'avertissement disparaît dès qu'un titre change. | … Rien n'est bloqué. L'avertissement disparaît dès qu'un titre change. |
| Archiver un exercice | Archiver « T » ? Il disparaît de la liste de l'accueil et aucune nouvelle séance ne peut être commencée ; les séances en cours continuent, et les attestations restent vérifiables. Il pourra être rétabli. | Archiver « T » ? Il disparaît de l'accueil. Aucune nouvelle séance ne peut commencer. Les séances en cours continuent, et les attestations restent vérifiables. Il pourra être rétabli. |
| Supprimer un exercice | Supprimer « T » (id) ? Aucune séance ne s'y rattache : le brouillon et ses versions disparaissent, sans retour. | Supprimer « T » (id) ? Aucune séance ne s'y rattache. Le brouillon et ses versions disparaissent, sans retour. |
| Réglages, titre | Affiché à l'étudiant et sur l'attestation ; il identifie l'exercice pour les étudiants. Il entre en vigueur à la première publication ; ensuite, il se change en direct. | Affiché à l'étudiant et sur l'attestation. Il entre en vigueur à la première publication. Ensuite, il se change en direct. |
| Réglages, cours (brouillon et présentation) | Ex. M10 : l'accueil regroupe les exercices par cours ; vide, sous « Autres exercices ». … | Ex. M10 : l'accueil regroupe les exercices par cours. Vide, l'exercice va sous « Autres exercices ». … |
| Réglages, facteur de vitesse donné | … Coché (exercices pour débutants) : la question l'affiche — « Vitesse réduite × 1/4 ». … | … Coché (exercices pour débutants) : la question l'affiche, « Vitesse réduite × 1/4 ». … |
| Réglages, matières / groupes permis | Tout coché = aucune restriction ; se croise avec les matières (les groupes) de chaque outil. | Tout coché : aucune restriction. Se croise avec les matières (les groupes) de chaque outil. |
| Présentation, titre | Affiché à l'étudiant — accueil, page de l'exercice, barre du haut — et inscrit sur les attestations émises ensuite (celles déjà émises ne changent pas). Il identifie l'exercice : un titre déjà pris par un autre exercice publié est refusé. | Affiché à l'étudiant (accueil, page de l'exercice, barre du haut) et inscrit sur les attestations émises ensuite. Celles déjà émises ne changent pas. Un titre déjà pris par un autre exercice publié est refusé. |
| Présentation, confirmation | … Les valeurs, la correction et les attestations déjà émises ne changent pas ; une attestation émise ensuite inscrit le titre en vigueur. … | … Les valeurs, la correction et les attestations déjà émises ne changent pas. Une attestation émise ensuite inscrit le titre en vigueur. … |
| Présentation appliquée (exercice et tables) | Présentation appliquée à 14:10 : 3 changements, effet immédiat — chaque page d'étudiant la montre dès qu'elle se recharge. Le contenu remplacé est dans l'historique. | Présentation appliquée à 14:10 (3 changements). Effet immédiat : chaque page d'étudiant la montre dès qu'elle se recharge. Le contenu remplacé est dans l'historique. |
| Retouches en attente (exercice et tables) | Faites dans le brouillon avant que la présentation passe en direct, elles n'ont jamais été publiées et ne le seront plus : pour les garder, reprends-les dans ce panneau, vérifie l'aperçu, puis applique. … | Faites dans le brouillon avant que la présentation passe en direct, elles n'ont jamais été publiées et ne le seront plus. Pour les garder, reprends-les dans ce panneau, vérifie l'aperçu, puis applique. … |
| Outils de l'exercice (publié) | La photo et la note d'un outil déjà publié sont en direct, dans le panneau « Présentation » ; une copie nouvelle les reçoit ici (liseré doré), et sa publication les y fait passer. | La photo et la note d'un outil déjà publié sont en direct, dans le panneau « Présentation ». Une copie nouvelle les reçoit ici (liseré doré), et sa publication les y fait passer. |
| Copie nouvelle | Copie nouvelle : sa photo et sa note de départ se saisissent dans son formulaire ; publiée, elles passeront dans le panneau « Présentation », en direct. | Copie nouvelle : sa photo et sa note de départ se saisissent dans son formulaire. Publiée, elles passeront dans le panneau « Présentation », en direct. |
| Retirer un outil | Retirer « N » (id) de l'exercice ? Sa copie disparaît du brouillon ; l'outil de la banque n'est pas touché. | Retirer « N » (id) de l'exercice ? Sa copie disparaît du brouillon. L'outil de la banque n'est pas touché. |
| Retirer la sélection | Retirer 2 outils de l'exercice — A (a), B (b) ? Leurs copies disparaissent du brouillon (rien n'est perdu avant la publication) ; la banque n'est pas touchée. | Retirer 2 outils de l'exercice (A (a), B (b)) ? Leurs copies disparaissent du brouillon. La version publiée ne change pas tant que tu ne publies pas. La banque n'est pas touchée. |
| Publier, note | Cette version sera sur les tables X. Les séances déjà commencées gardent leur version ; seules les nouvelles séances prennent celle-ci. Une version publiée ne se modifie plus. Elle prend la présentation en vigueur (titre, cours, « À l'accueil », photos et notes : un instantané) ; celle-ci continue de se modifier en direct. | Cette version sera sur les tables X. Les séances déjà commencées gardent leur version. Seules les nouvelles séances prennent celle-ci. Une version publiée ne se modifie plus. Elle prend la présentation en vigueur (titre, cours, « À l'accueil », photos et notes), en instantané. Celle-ci continue de se modifier en direct. |
| Publié | Version 3 publiée le D : les nouvelles séances la prennent ; les séances en cours gardent la leur. | Version 3 publiée le D. Les nouvelles séances la prennent, les séances en cours gardent la leur. |
| Publication refusée (titre pris) | Publication refusée : un autre exercice publié porte déjà ce titre : « T » (id). Les étudiants reconnaissent un exercice à son titre : change le titre de l'un des deux, puis publie. (et au pluriel) | Publication refusée. Un autre exercice publié porte déjà ce titre : « T » (id). Les étudiants reconnaissent un exercice à son titre. Change le titre de l'un des deux, puis publie. |
| Titre refusé en direct | Titre refusé : un autre exercice publié porte déjà ce titre : « T » (id). Les étudiants reconnaissent un exercice à son titre : choisis-en un autre (ou change celui de l'autre). (et au pluriel) | Titre refusé. Un autre exercice publié porte déjà ce titre : « T » (id). Les étudiants reconnaissent un exercice à son titre. Choisis-en un autre (ou change celui de l'autre). |
| Reprendre une version | Version 2 reprise dans le brouillon, qui garde ses tables (X) — 2 erreur(s) à corriger avec ces tables : vérifie, puis « Publier… ». | Version 2 reprise dans le brouillon, qui garde ses tables (X). 2 erreur(s) à corriger avec ces tables. Vérifie, puis « Publier… ». |
| Aperçu | … Rien n'est enregistré ; les étudiants ne voient jamais ces réponses. | … Rien n'est enregistré. Les étudiants ne voient jamais ces réponses. |

### 2.3 Gestion du contenu — formulaire d'outil et banque

| Où | Avant | Après |
|---|---|---|
| Gabarit de nomenclature, note | Le nom affiché dans la question : du texte et des jetons entre crochets, remplacés au tirage. Les boutons insèrent au curseur les jetons permis pour cet outil. | Le nom affiché dans la question : du texte, et des crochets remplacés au tirage. Les boutons insèrent au curseur les crochets permis pour cet outil. |
| Exemple composé | Exemple composé : MVLNR - Ø charioté: 1.000" — jetons : IdDia. | Exemple composé : MVLNR - Ø charioté: 1.000" (crochets : IdDia). |
| Gabarit, erreurs de validation | jeton inconnu dans « format_identifiant » : [X] (jetons permis : …) · le jeton [Pas] n'a de sens que pour un outil de filetage · le jeton [IdBarre] exige « dimensions_barre » | crochet inconnu dans « format_identifiant » : [X] (permis : …) · [Pas] n'a de sens que pour un outil de filetage · [IdBarre] exige « dimensions_barre » |
| Photo, note | … La galerie montre les images « photo d'outil » non archivées ; « Téléverser » réduit la photo dans le navigateur avant l'envoi (800 px ; JPEG sur fond blanc, ou PNG si elle a de la transparence). | … La galerie montre les images « photo d'outil » non archivées. « Téléverser » réduit la photo dans le navigateur avant l'envoi : 800 px, en JPEG sur fond blanc ou en PNG si elle a de la transparence. |
| Dimensions, libellé et note | Dimensions possibles (une par ligne : libellé ; valeur) · Valeur : Ø en pouces (« Ø 1/4 po ; 0.25 »), ou le filetage en texte : « 1/4- 20 UNC ; 0.25-20 », « M10 x 1.5 ; 10x1.5 ». | Dimensions possibles, une par ligne (libellé ; valeur) · Valeur : le Ø en pouces (« Ø 1/4 po ; 0.25 »), ou le filetage en texte (« 1/4- 20 UNC ; 0.25-20 », « M10 x 1.5 ; 10x1.5 »). |
| Barres, libellé et note | Barres (outil à deux diamètres) : libellé ; Ø en pouces · Vide = un seul diamètre. Sinon, avance proportionnelle au Ø de la barre ; N avec le Ø usiné. | Barres d'un outil à deux diamètres, une par ligne (libellé ; Ø en pouces) · Vide : un seul diamètre. Sinon, l'avance suit le Ø de la barre, et N le Ø usiné. |
| Facteur forcé, valeur | « 1/4 » ou « 0.25 » ; 1 = aucune réduction. | « 1/4 » ou « 0.25 ». 1 : aucune réduction. |
| Facteur (tables d'avant D83) | 1 = aucun ; 0.25 pour un alésoir. | 1 : aucun. 0.25 pour un alésoir. |
| Banque, paragraphe | Les outils qu'on copie dans un exercice. Modifier un outil ici ne change aucun exercice existant ; le nombre d'exercices est donné à titre d'information. | Les outils qu'on copie dans un exercice. Modifier un outil ici ne change aucun exercice existant. Le nombre d'exercices est donné à titre d'information. |
| Nouvel outil, identifiant | Minuscules, chiffres et soulignés ; définitif. | Minuscules, chiffres et soulignés. Définitif. |
| Archiver un outil | Archiver « N » ? Il ne sera plus proposé à l'ajout dans un exercice ; les copies déjà faites ne changent pas. | Archiver « N » ? Il ne sera plus proposé à l'ajout dans un exercice. Les copies déjà faites ne changent pas. |
| Outil enregistré | Outil enregistré à 09:30 (révision 2) : 2 changements ; le contenu remplacé est dans l'historique. | Outil enregistré à 09:30 (révision 2) : 2 changements. Le contenu remplacé est dans l'historique. |
| Outil enregistré, erreurs avec les tables d'aujourd'hui | Avec les tables d'aujourd'hui, 2 erreurs : cet outil ne pourra pas être ajouté à un exercice sans erreur tant qu'elles restent (elles sont sous les champs). | Avec les tables d'aujourd'hui, 2 erreurs (sous les champs). Tant qu'elles restent, cet outil ne peut pas être ajouté à un exercice. |
| Contenu rétabli | Contenu rétabli à 09:30 (2 changements) ; celui qu'il remplace est dans l'historique. | Contenu rétabli à 09:30 (2 changements). Celui qu'il remplace est dans l'historique. |
| Historique vide | Vide : chaque enregistrement y mettra le contenu qu'il remplace. | Vide : chaque fois que tu enregistres, le contenu remplacé vient ici. |
| Historique, ligne | Contenu enregistré le …, remplacé le … par admin (un enregistrement) | Contenu enregistré le …, remplacé le … par admin (une modification) |
| Historique, contenu en erreur | Avec les tables d'aujourd'hui, ce contenu a 2 erreurs ; il se rétablit quand même, et elles seront à corriger : | Avec les tables d'aujourd'hui, ce contenu a 2 erreurs. Il se rétablit quand même, et elles seront à corriger : |

### 2.4 Gestion du contenu — tables de référence

| Où | Avant | Après |
|---|---|---|
| Paragraphe du haut | Deux parties, qui ne s'enregistrent pas de la même façon. **Présentation — effet immédiat** : ce qui ne fait qu'afficher ; « Appliquer… » change tout de suite la page de tous les étudiants, quelle que soit leur version des tables, et l'historique permet de revenir en arrière. **Valeurs — brouillon à publier** : tout le reste (matériaux, Vc, opérations, avances…) ; un seul brouillon, des versions publiées immuables, chacune avec sa révision ; une version ne change aucun exercice toute seule, et une séance commencée garde les valeurs de sa version. | Deux parties, qui ne s'enregistrent pas de la même façon. **Présentation, effet immédiat.** Ce qui ne fait qu'afficher. « Appliquer… » change tout de suite la page de tous les étudiants, quelle que soit leur version des tables. L'historique permet de revenir en arrière. **Valeurs, brouillon à publier.** Tout le reste (matériaux, Vc, opérations, avances…). Un seul brouillon, des versions publiées immuables, chacune avec sa révision. Une version ne change aucun exercice toute seule, et une séance commencée garde les valeurs de sa version. |
| Présentation des tables, paragraphe | … légendes (40 caractères au plus ; vide, aucune), … | … légendes (40 caractères au plus, aucune si vide), … |
| Brouillon des tables, paragraphe | Un seul brouillon, modifiable ; des versions publiées immuables, chacune avec sa révision. … | Un seul brouillon, modifiable. Des versions publiées immuables, chacune avec sa révision. … |
| Classes ISO, paragraphe | … Une classe ajoutée ici reçoit sa présentation de départ sur sa ligne (légende de 40 caractères au plus ; au plus 6 caractéristiques, libellé de 20 caractères, texte et solution de 90) ; une fois publiée, elle se modifie en direct. | … Une classe ajoutée ici reçoit sa présentation de départ sur sa ligne (légende de 40 caractères au plus, 6 caractéristiques au plus, libellé de 20 caractères, texte et solution de 90). Une fois publiée, elle se modifie en direct. |
| Classe publiée, sa ligne | Acier — nom, couleurs, image, légende et caractéristiques : en direct, dans le panneau « Présentation » ci-dessus. | Acier. Nom, couleurs, image, légende et caractéristiques : en direct, dans le panneau « Présentation » ci-dessus. |
| Matières d'outil, paragraphe | Les trois colonnes de la table des vitesses de coupe ; leur couleur est en direct, dans le panneau « Présentation ». … | Les trois colonnes de la table des vitesses de coupe. Leur couleur est en direct, dans le panneau « Présentation ». … |
| Opérations, paragraphe | … l'avance par révolution et son maximum (en pouces ; sans objet en filetage), et le facteur de vitesse — N = Vc × 4 / Ø × facteur : « 1 » sans réduction, « 1/4 » ou « 0.25 », « 1/8 »… Les outils en héritent. Le pictogramme est en direct, dans le panneau « Présentation » ; une opération ajoutée ici reçoit le sien sur sa ligne. | … l'avance par révolution et son maximum (en pouces, sans objet en filetage), et le facteur de vitesse. Le facteur (N = Vc × 4 / Ø × facteur) : « 1 » sans réduction, « 1/4 » ou « 0.25 », « 1/8 »… Les outils en héritent. Le pictogramme est en direct, dans le panneau « Présentation ». Une opération ajoutée ici reçoit le sien sur sa ligne. |
| Publier, différences | Différences de valeurs avec X (3) — relis-les : une faute de frappe partirait chez tous les exercices cochés ci-dessous. | Différences de valeurs avec X (3). Relis-les : une faute de frappe partirait chez tous les exercices cochés ci-dessous. |
| Publier, passage de la banque | Avec cette publication, chaque outil de la banque hérite du facteur de son opération s'il avait la même valeur ; sinon il garde la sienne, « forcée », avec la raison « à vérifier » — à trancher ensuite dans la fiche de l'outil. … | Avec cette publication, chaque outil de la banque hérite du facteur de son opération s'il avait la même valeur. Sinon il garde la sienne, « forcée », avec la raison « à vérifier », à trancher ensuite dans la fiche de l'outil. … |
| Publier, révision | Suggérée : X. Unique ; inscrite au pied des feuilles et sur les attestations. … | Suggérée : X. Unique, inscrite au pied des feuilles et sur les attestations. … |
| Cascade, paragraphe | Pour chaque exercice coché, son contenu publié passe à ces tables — une version suivante, faite de son dernier contenu publié, jamais de son brouillon —, et son brouillon aussi, chacun de son côté, ses modifications gardées. Un exercice décoché n'est pas touché. Les séances en cours gardent leur version ; seules les nouvelles séances prennent celle de la cascade. | Pour chaque exercice coché, son contenu publié passe à ces tables (une version suivante, faite de son dernier contenu publié, jamais de son brouillon), et son brouillon aussi, chacun de son côté, ses modifications gardées. Un exercice décoché n'est pas touché. Les séances en cours gardent leur version. Seules les nouvelles séances prennent celle de la cascade. |
| Cascade, groupe des plus anciens | Sur une version plus ancienne — décochés par défaut : ils ont pu être laissés de côté exprès | Sur une version plus ancienne, décochés par défaut : ils ont pu être laissés de côté exprès |
| Cascade, ce qu'elle fera | Version 3 publiée avec ces tables : le contenu de sa version 2 (sur X), pas son brouillon ; son brouillon passe aussi à ces tables. | Version 3 publiée avec ces tables : le contenu de sa version 2 (sur X), pas son brouillon. Son brouillon passe aussi à ces tables. |
| Cascade, brouillon en erreur | Son brouillon aura 2 erreurs avec ces tables, à corriger avant sa prochaine publication : e1 ; e2 | Son brouillon aura 2 erreurs avec ces tables, à corriger avant sa prochaine publication. e1 · e2 |
| Cascade, note | Une version publiée ne se modifie plus ; elle prend la présentation en vigueur (panneau « Présentation »). Tout se publie ensemble, ou rien. | Une version publiée ne se modifie plus. Elle prend la présentation en vigueur (panneau « Présentation »). Tout se publie ensemble, ou rien. |
| Tables publiées, résultat | … Laissés tels quels, en erreur avec X (…) : « T » (e1 ; e2). … Banque d'outils : 27 outils héritent du facteur de leur opération ; 1 forcé, à vérifier : … | … Laissés tels quels, en erreur avec X (…) : « T » (e1 · e2). … Banque d'outils : 27 outils héritent du facteur de leur opération. 1 forcé, à vérifier : … |
| Différences d'une publication, passage | Facteur de vitesse : ces tables le portent. 27 outils héritent de celui de leur opération, sans changement de valeur ; 2 sont forcés, à vérifier. | Facteur de vitesse : ces tables le portent. 27 outils héritent de celui de leur opération, sans changement de valeur. 2 sont forcés, à vérifier. |
| Serveur, passage d'un exercice en erreur | L'exercice « T » a des erreurs avec ces tables : champ : message ; champ : message | L'exercice « T » a des erreurs avec ces tables. champ : message · champ : message |

### 2.5 Gestion du contenu — images et sauvegarde

| Où | Avant | Après |
|---|---|---|
| Images, paragraphe | … Une image ne change jamais sous le même identifiant ; une image utilisée par une version publiée ne se supprime pas : elle s'archive (…). … | … Une image ne change jamais sous le même identifiant. Une image utilisée par une version publiée ne se supprime pas : elle s'archive (…). … |
| Téléverser, note | Une photo est réduite dans le navigateur (800 px ; JPEG sur fond blanc, ou PNG si elle a de la transparence) ; un pictogramme à 256 px en PNG, une image de classe à 340 px en PNG, ou tel quel en SVG (assaini par le serveur). Un doublon exact n'est pas stocké deux fois. | Une photo est réduite dans le navigateur à 800 px, en JPEG sur fond blanc ou en PNG si elle a de la transparence. Un pictogramme passe à 256 px en PNG, une image de classe à 340 px en PNG. Un SVG est gardé tel quel, nettoyé à l'envoi. Un doublon exact n'est pas stocké deux fois. |
| Supprimer une image | Supprimer l'image « N » (id) ? Elle n'est utilisée nulle part ; elle disparaît sans retour. | Supprimer l'image « N » (id) ? Elle n'est utilisée nulle part. Elle disparaît sans retour. |
| Archiver une image | Archiver l'image « N » ? Elle ne sera plus proposée dans la galerie ; les outils, opérations et classes qui la nomment l'affichent toujours (le brouillon des tables la signalera). Elle pourra être rétablie. | Archiver l'image « N » ? Elle ne sera plus proposée dans la galerie. Les outils, opérations et classes qui la nomment l'affichent toujours. Le brouillon des tables la signalera. Elle pourra être rétablie. |
| Sauvegarde, paragraphe | L'export contient … et les images (photos et pictogrammes) — jamais de données d'étudiants. L'import fusionne un export dans la base : il ajoute ce qui manque (…), remplace … | L'export contient … et les images (photos et pictogrammes). Jamais de données d'étudiants. L'import fusionne un export dans la base. Il ajoute ce qui manque (…), remplace … |
| Sauvegarde, étape 2 | Importer un export : il est d'abord validé et résumé ; rien n'est écrit avant la confirmation. | Importer un export : il est d'abord validé et résumé. Rien n'est écrit avant la confirmation. |
| Résumé d'import, images | Images : 48 déjà dans la base ; 2 à envoyer avant l'import (une par requête) ; 1 fiche(s) mise(s) à jour (nom, archivage). | Images : 48 déjà dans la base, 2 à envoyer avant l'import (une par requête), 1 fiche(s) mise(s) à jour (nom, archivage). |
| Résumé d'import, tables | Tables de référence ajoutées : X ; le brouillon des tables est remplacé. | Tables de référence ajoutées : X. Le brouillon des tables est remplacé. |
| Résumé d'import, présentation des tables | Présentation des tables : remplacée par celle de l'export, … (l'actuelle va à l'historique) ; 3 contenu(s) ajouté(s) à son historique. | Présentation des tables : remplacée par celle de l'export, … (l'actuelle va à l'historique). 3 contenu(s) ajouté(s) à son historique. |
| Résumé d'import, banque | Banque d'outils — ajoutés : A (a) ; modifiés : aucun ; inchangés : 28. | Banque d'outils : ajoutés A (a) · modifiés aucun · inchangés 28. |
| Résumé d'import, disparitions | Banque d'outils — DISPARAÎTRAIENT : A (a), B (b). … · Banque d'outils — aucun outil ne disparaît. | Outils de la banque qui DISPARAÎTRAIENT : A (a), B (b). … · Aucun outil de la banque ne disparaît. |
| Résumé d'import, historique de la banque | Historique de la banque : … (« Rétablir » le ramène) ; 4 contenu(s) de l'export ajouté(s). | Historique de la banque : … (« Rétablir » le ramène). 4 contenu(s) de l'export ajouté(s). |
| Import, envoi des images | 2 image(s) envoyée(s) ; import en cours… | 2 image(s) envoyée(s). Import en cours… |
| Import refusé | Rien n'a été importé : e1 ; e2 | Rien n'a été importé. e1 e2 |
| Serveur, mot d'import | Pour importer, la requête doit porter le mot REMPLACER — 2 outil(s) de la banque disparaîtraient : A, B. | Pour importer, la requête doit porter le mot REMPLACER. 2 outil(s) de la banque disparaîtraient : A, B. |
| Serveur, image en conflit à l'import | Image « x » : la base en a une autre sous le même identifiant ; une image ne change jamais sous le même identifiant. | Image « x » : la base en a déjà une autre sous cet identifiant. Une image ne change jamais sous le même identifiant. |

**Ce que je n'ai pas changé côté professeur, exprès** (à confirmer, points douteux 3 et 4) : les **lignes de
différences** d'une publication ou de l'historique (« MVLNR (mvlnr) — fact_vc : « 1 » → « 0.5 » », « Dimensions :
retirées « a » ; ajoutées « b » », « Opération « x » — avance : 0.005 → 0.006 ») et les lignes du **journal des
actions** en base (« 2 changement(s) : … ; … », que rien n'affiche) : ce sont des lignes de liste, pas des phrases ; et
le mot **« fournie »** pour l'état d'une grandeur dans la Gestion du contenu (« évaluée (à saisir), fournie (valeur
montrée) ou masquée »), là où l'étudiant lit maintenant « donné ».

## 3. Vérifications

- `npm test` : **868 tests, 0 échec** (860 avant ; 8 ajoutés : 7 dans `tests/ui-ambiances.test.js`, 1 dans
  `tests/textes-visibles.test.js` ; le test de `toolStreak` retiré avec la fonction, un test de `newSessionNotice`
  ajouté dans `ui-text.test.js`). Tous les tests qui vérifiaient un texte changé sont mis à jour — 22 fichiers de
  tests touchés.
  - **Le vocabulaire interne** : `textes-visibles.test.js` refuse désormais « serveur », « enregistrement »,
    « détenir », « recomposer », « jeton » et le vouvoiement dans toute chaîne d'au moins deux mots de `site/js/**`,
    `worker/*.js` (sauf `base.js`, du SQL, et `crypto.js`, la configuration des secrets) et des cinq pages HTML. Il a
    trouvé onze endroits que j'avais manqués (les « jetons » du gabarit, « un enregistrement » dans l'historique,
    « assaini par le serveur », les deux connexions) : tous corrigés.
  - **Les ambiances** : l'attribut de chaque page ; les deux blocs de `tokens.css` ne redéfinissent que les trois
    variables, par `var(--espace-…)` ; les couleurs de sens restent celles de `:root` ; les **contrastes AA calculés**
    (le tableau de §1.3) ; aucune couleur d'espace en dur hors de `tokens.css` ; `prof.js` pose l'espace à la
    connexion, au tableau et à la déconnexion, et met l'étiquette ; `editeur.js` met « Administration ».
- **Chrome sans interface** (1366 × 768 et 390 × 844, mode test, cadence 1 s) : **50 vérifications, toutes vertes** ;
  aucune erreur console, aucune exception, aucune requête externe. Pour chaque taille : l'accueil (sans les trois
  étapes, « Enseignants » et le bouton seuls, l'indice « Essayer sans identification », le pied court, bleu, sans
  étiquette ni bande) ; la page de l'exercice (« enregistre ton attestation », « Données : … ») ; l'identification
  (« Il te permet de reprendre… », « Nouveau matricule : 2400001. Vérifie-le bien. … ») ; une question d'une séance
  en cours (le rappel « Tape un nombre (0.005) ou un calcul ((3-1)*2). », « donné », « Clique sur une case pour voir
  l'aide. », le bandeau du mode test) et son corrigé ; l'attestation d'une séance réussie par l'API (la note en deux
  phrases, « Vérification : … · code … ») ; `/verifier` (l'introduction, le pied « TGM-TMI », « Attestation
  authentique — Voici son contenu. », « Aucune attestation ne correspond », le spécimen par son QR, le code d'un
  exemple) ; le mode démo (le choix de l'outil et ses deux textes, « Démo — rien n'est enregistré. », la barre sans
  rappel, la question, le spécimen et sa consigne, ← Retour à la démo seul dans la barre) ; la connexion de `/prof`
  (« Entre ta clé. … », bleu) ; **la consultation** (ambre : accent, ligne de la barre, titre, onglet actif ;
  l'étiquette « Consultation » ; « Espace professeur · lecture seule » ; aucune colonne Actions ; pas de bande ; **zéro
  élément doré** ; le doré, le rouge et le vert des variables inchangés) ; la déconnexion (retour au bleu, sans
  étiquette) ; **l'administration** (pourpre ; l'étiquette « Administration » ; « Espace professeur » ; la bande de
  6 px en `repeating-linear-gradient` ; « Supprimer » rouge ; l'anneau de focus pourpre clair) ; la Gestion du contenu
  (la connexion déjà pourpre avec l'étiquette et la bande, « Entre la clé d'administration. … » ; la liste avec
  « Administration · Espace professeur · Se déconnecter » et le pied en deux phrases ; la page d'un exercice avec
  « Publier… » doré et « En direct » vert dans l'espace pourpre).
- **Captures** (à regarder, pas versionnées) dans `captures/textes-et-ambiances/`, quinze par taille : `01-etudiant-
  accueil`, `02-etudiant-identification`, `03-etudiant-question`, `04-etudiant-corrige`, `05-etudiant-attestation`,
  `06-etudiant-verifier`, `07-etudiant-demo-choix`, `08-etudiant-demo-question`, `09-etudiant-specimen`,
  `10-prof-connexion`, `11-consultation`, `12-admin`, `13-gestion-connexion`, `14-gestion-liste`,
  `15-gestion-exercice`, chacune en `-1366` et `-390`. Les trois espaces à 1366 et à 390 px (ta demande 3.5) :
  `01-etudiant-accueil-*`, `03-etudiant-question-*`, `11-consultation-*`, `12-admin-*`, `14-gestion-liste-*`.
- `npm run test:api` n'a pas été relancé : aucune route, aucun format de réponse ni aucune migration ne change — seuls
  des textes de messages, couverts par `worker-api.test.js`, `worker-editeur.test.js`, `worker-tables.test.js` et
  `worker-presentation-exercice.test.js` sur la base en mémoire.

## 4. Points douteux, à trancher

1. **La constante de pagination de la note de l'attestation.** La note tient maintenant sur une ligne (une phrase de
   110 caractères sur 720 px) : sa hauteur réelle est d'environ 26 px, la constante `PAGE_LAYOUT.note` dit 39. Je l'ai
   laissée : elle surestime de 13 px, ce qui ne fait jamais déborder une page — au pire, une page 1 pleine garde 13 px
   libres qu'un rang de question (20 px) n'aurait pas remplis de toute façon. La recalibrer (mesurer dans Chrome en
   mode impression, puis `note: 26` et le test `REAL.note`) demande la méthode de D85 ; je propose de le faire au
   prochain chantier qui touche la page de l'attestation, ou tout de suite si tu préfères une constante exacte.
2. **« Vérification impossible »** pour une réponse inconnue de `/verifier` : tu as donné le texte (« Réponse
   inattendue. Réessaie plus tard. ») sans titre ; l'ancien titre était « Réponse inattendue ». Pour ne pas répéter
   les deux mêmes mots en titre et en texte, j'ai mis « Vérification impossible ». À changer si tu préfères autre chose.
3. **Les lignes de différences et le journal** gardent « — » et « : » dans la même ligne (« MVLNR (mvlnr) — fact_vc :
   « 1 » → « 0.5 » ») : ce sont des lignes de liste, pas des phrases, et les tests de `versionDiff`, `tablesDiff`,
   `bankToolDiff` et des journaux les vérifient à la lettre. Je les ai laissées ; si tu veux la règle 2.1 là aussi,
   c'est « MVLNR (mvlnr), fact_vc : « 1 » → « 0.5 » » (la virgule à la place du tiret), une vingtaine d'assertions à
   suivre.
4. **« Fournie » dans la Gestion du contenu** (l'état d'une grandeur : « évaluée (à saisir), fournie (valeur montrée) ou
   masquée », les avertissements « N fourni », la clé `fournie` du formulaire) : l'étudiant lit maintenant « donné »
   (règle 2.4), le professeur lit encore « fournie ». Deux mots pour une chose, mais de deux côtés : je ne l'ai pas
   changé (la clé et une dizaine de textes et de tests). À ton choix : « donnée (valeur montrée) » côté professeur
   aussi, en gardant la clé telle quelle.
5. **L'ambre et le doré** (§1.3) : aucun doré en consultation, donc pas de confusion sur un écran ; si le passage
   d'un espace à l'autre les confond, l'ambre plus orangé proposé (`#f28c28` / `#ffab5e` / `#ffc98a`).
6. **« Données : … » sur la page de l'exercice** (ma lecture de 2.16 pour la liste « À trouver / Fournies par
   l'exercice / Non demandées ») : « Données » après « À trouver » se lit comme « déjà données » ; si c'est ambigu avec
   « les données », l'autre lecture est « Déjà connues : … ».
7. **La barre du haut du choix de l'outil (démo)** : le rappel « Démo · rien n'est gardé » retiré laissait la droite
   de la barre vide ; j'y ai mis « TGM-TMI », comme à l'accueil. Sur la question de la démo, la barre garde Tables de
   référence, Changer d'outil, Quitter ; sur le spécimen, « ← Retour à la démo » seul.
8. **« Recharge la page. » et le bouton Réessayer** sur l'attestation non chargée : ton texte dit de recharger, le
   bouton **Réessayer** (qui redemande l'attestation) est resté. Les deux marchent ; si tu préfères une seule
   consigne, je retire le bouton ou la phrase.
9. **L'explication du développeur dans la console** : un petit script en ligne dans `index.html` (le premier du
   projet) qui, trois secondes après le chargement, écrit `console.warn(…)` si `#app` montre encore « Chargement… ».
   Sans effet sur l'étudiant (la page s'affiche en moins d'une seconde) ; un réseau très lent le déclencherait sans
   conséquence. L'autre façon — rien du tout, la page ouverte depuis un fichier resterait muette — est possible si tu
   préfères zéro script en ligne.
10. **L'étiquette « Administration » sur la connexion de la Gestion du contenu**, avant toute clé : elle nomme
    l'espace de la page (tout `/prof/editeur` est pourpre, D94 point 1), pas une séance ouverte. Sur `/prof`, la
    connexion reste bleue et sans étiquette. Si tu préfères l'étiquette seulement une fois connecté, c'est une ligne.
11. **« lecture seule » dans le sur-titre** de la consultation (« Espace professeur · lecture seule ») : gardé parce
    qu'il explique l'absence de la colonne Actions ; l'étiquette dit « Consultation ». À retirer si c'est de trop.
12. **La question de « Renommer »** (une boîte `prompt()` du navigateur) finit par « Nouveau titre : » après trois
    phrases, pour que la case ait un libellé ; c'est un peu long pour une boîte, mais tout y est. Une boîte en deux
    temps (confirmer, puis saisir) serait plus propre, hors de ce chantier.
13. **Les spécimens déjà imprimés** restent vérifiables : `buildSpecimen` et l'enregistrement du spécimen ne changent
    pas ; seuls les textes de `/verifier` autour changent.

## 5. Ce que tu vérifies après le déploiement

1. **L'accueil** (`/`) : plus de ligne des trois étapes ; « Enseignants » et le bouton seuls ; le pied « TGM-TMI · Tes
   données sont effacées à la fin de chaque session. » ; au survol d'un bouton Démo, « Essayer sans identification ».
2. **Une question** d'une séance réelle : sous les cases, « Tape un nombre (0.005) ou un calcul ((3-1)*2). » et rien
   d'autre ; « donné » sous une grandeur donnée ; « Clique sur une case pour voir l'aide. » en tête du panneau.
3. **Une attestation** (une vraie, ou le spécimen d'une démo) : la note en deux phrases sous le tableau par outil, la
   mention « Vérification : … · code … » ; **une page 1 pleine** (un exercice à 20 outils, ou à cinq grandeurs) ne
   déborde pas en mode impression — la constante de pagination n'a pas changé, mais c'est le moment de regarder.
4. **`/verifier`** : par le QR d'une attestation, « Attestation authentique — Voici son contenu. » ; un code inventé,
   « Aucune attestation ne porte ce code. Vérifie-le : il ne contient jamais de O ni de I. » ; le QR d'un spécimen,
   « Exemple produit par le mode démo. Il n'atteste aucune réussite. » ; le code `SPECI-MEN00` tapé, « Code d'un
   exemple ».
5. **`/prof` avec la clé de consultation** : la page ambre, l'étiquette « Consultation », « Espace professeur · lecture
   seule » ; **avec la clé d'administration** : pourpre, « Administration », la bande à chevrons tout en haut ; la
   connexion et la déconnexion, bleues et sans étiquette. Regarde si l'ambre te fait penser au doré du quiz (point 5).
6. **La Gestion du contenu** : pourpre dès la connexion ; « Publier… » toujours doré, la pastille « En direct »
   toujours verte, « Supprimer » toujours rouge ; les confirmations (Archiver, Supprimer, Retirer) en phrases courtes ;
   le mot « crochets » dans le formulaire d'outil.
7. **Sur téléphone** (390 px) : l'accueil, une question, `/prof` en administration (la bande, l'étiquette qui ne
   déborde pas).

## 6. Fichiers

- **Décisions et documents** : `docs/DECISIONS.md` (D93, D94) ; `docs/UI.md` (§1 : « Ambiances par espace », « Les
  textes » ; §3.1 à §3.10 : les textes cités) ; `CLAUDE.md` ; `docs/PLAN.md` ; ce rapport.
- **Site** : `site/index.html`, `verifier.html`, `tables.html`, `prof.html`, `prof/editeur.html` (`data-espace`, les
  pieds de page, « Chargement… » et le script de la console) ; `site/css/tokens.css` (les variables par espace),
  `app.css` (l'étiquette, la bande ; les trois étapes et la note de la porte professeur retirées) ; `site/js/api.js`,
  `exercice.js`, `data.js`, `question.js` ; `site/js/ui/text.js`, `home-data.js`, `home-screen.js`, `demo-data.js`,
  `demo-screen.js`, `identification-screen.js`, `question-screen.js`, `rules.js` (`toolStreak` retirée),
  `attestation-data.js`, `attestation-screen.js`, `verifier.js`, `reference-screen.js`, `main.js`, `prof.js`,
  `prof-data.js` (`spaceOf`, `roleLabel`, `roleNote`), `editeur.js`, `editeur-data.js`.
- **Serveur** : `worker/index.js` (les messages 404 et 500, la séance expirée, l'image en conflit, le passage de tables
  en erreur, le mot d'import). Aucune migration.
- **Tests** : `tests/ui-ambiances.test.js` (nouveau), `tests/textes-visibles.test.js` (la règle du vocabulaire) ; mis à
  jour : `ui-text`, `ui-home`, `ui-demo`, `ui-attestation`, `ui-rules`, `ui-facteurs`, `ui-navigation`, `ui-prof`,
  `ui-editeur`, `api`, `app`, `exercice`, `data`, `question`, `presentation-exercice`, `worker-api`, `worker-editeur`,
  `worker-tables`, `worker-facteurs`, `worker-presentation-exercice`.
- **Hors dépôt** : `captures/textes-et-ambiances/` (trente captures), les scripts jetables du scratchpad
  (`captures-ambiances.mjs`, `cdp.mjs`, `serveur.mjs`, les fichiers de remplacements appliqués par `patcher.mjs`).
