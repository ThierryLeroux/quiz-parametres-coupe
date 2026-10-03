# Rapport — la limite de débit à 1000 valeurs distinctes (décision D86)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Ni formule, ni tolérance, ni texte de
> l'attestation. **Ce qui change pour tout le monde au déploiement** : une adresse IP peut consulter 1000 matricules
> distincts (ou vérifier 1000 codes distincts) par heure avant d'être verrouillée 10 minutes, au lieu de 100. Rien
> d'autre : aucune migration, aucun fichier de `site/`.

Session du 2026-10-03, branche `limite-debit`, partie de `main` à jour (`ae09a28`). Poussée, pas fusionnée. La
production a été **lue** (des `SELECT` par `wrangler d1 execute --remote`), jamais écrite.

## 1. Le diagnostic de production (lecture seule)

**Un verrou a-t-il déjà été posé ? Non.** La table `verrous` est vide. Un verrou de débit (portées `consultation` et
`verification`) n'est jamais effacé par le code — seul l'effacement des données des étudiants (D46) vide la table, et
le journal des actions n'en compte aucun. Un verrou posé un jour serait donc encore là, avec sa date passée. Les
quatre connexions professeur refusées (du 24 au 29 septembre) n'ont pas laissé de verrou non plus : une connexion
réussie l'efface.

**Le plus haut compte atteint dans une tranche : il ne se lit pas.** La table `debit` ne garde que la tranche en
cours : à chaque consultation, les tranches passées sont effacées (D36, « au fil de l'eau »). Au moment du diagnostic
(13 h, tranche UTC `2026-10-03T17`), elle contenait **une seule ligne** : une valeur, portée `verification`, une
adresse. Aucun historique des tranches n'existe, et le journal ne note pas les refus 429.

Ce que la base garde de l'essai, pour l'échelle :

| Mesure | Valeur |
|---|---|
| Séances en base (après 23 suppressions) | 19 |
| Matricules distincts | 13 |
| Première séance | 2026-09-22 |
| Tranche la plus chargée en séances commencées | 4 séances, 3 matricules (le 29 septembre, 17 h) |
| Tranche la plus chargée en corrections | 80 corrections, 2 séances (le 1er octobre, 8 h) |

Rien n'approche de cent. Le risque est devant : des groupes complets, qui se suivent dans la même heure, avec leurs
fautes de frappe.

Les adresses IP lues ne sont pas dans ce rapport (dépôt public).

## 2. Ce qui a été fait

- `worker/acces.js` : `DISTINCT_PER_HOUR` passe de 100 à **1000**. C'était déjà une seule constante pour les deux
  portées (`limitRate` la lit pour la consultation et pour la vérification) : rien à fusionner. Le commentaire dit
  pourquoi la limite est large.
- `worker/index.js` : le commentaire de `limitRate` (« 100 », « 101e »).
- `docs/SPEC.md` §7 : la section « Limites de débit par adresse » (1000, 1001ᵉ, renvoi à D86). Ce n'était pas
  demandé, mais SPEC est la source de vérité fonctionnelle et aurait contredit D86.
- `docs/DECISIONS.md` : **D86** (contexte : 500 inscrits au plus, une seule adresse IP, les fautes de frappe, le coût
  d'un verrou pour tout le cégep contre ce que révèle la consultation ; le diagnostic ; une seule constante) ; dans
  les conséquences de D36, « un robot est arrêté à cent » renvoie à D86.
- Tests : `tests/worker-acces.test.js` vérifie la valeur (1000 — le seul endroit où le nombre est écrit) ;
  `tests/worker-api.test.js` importe `DISTINCT_PER_HOUR` et en dérive les deux tests : les matricules de la série
  (`matriculeDeSerie`), la valeur de trop, le premier de l'heure suivante ; les codes sur quatre chiffres au lieu de
  trois (1001 codes différents, vérifié par le test). Ce qu'ils vérifient ne change pas : le refus de la valeur de
  trop (429, `attendre_s` 600), le verrou de 10 minutes même pour une valeur connue, la valeur déjà vue qui passe,
  l'autre adresse non touchée, l'heure suivante qui repart, la tranche passée effacée, le verrou qui se repose après
  10 minutes si la tranche est pleine.

**La vitesse des tests** : le test de consultation fait maintenant 3 000 requêtes (1000 nouvelles, 1000 déjà vues,
1000 l'heure suivante) et dure **1,2 s** au lieu de 0,16 s ; celui des codes, 0,16 s ; la suite entière, 4,6 s. Je
n'ai rien allégé : c'est acceptable, et toute économie aurait retiré une vérification (la boucle des « déjà vus » est
ce qui prouve qu'aucun compteur de requêtes ne s'est glissé). Si un jour c'est trop, la seule solution sans rien
affaiblir est de garder les 1000 nouvelles et de ne rejouer qu'un échantillon des déjà vues.

## 3. Vérifications

- `npm test` : **789 tests, 0 échec** (aucun test ajouté : les trois tests de débit sont réécrits).
- `npm run test:api` : **35 étapes** sur wrangler dev et une vraie D1 locale jetable (il ne joue pas la limite de
  débit : 1001 valeurs par HTTP n'y ont pas leur place ; `npm test` la couvre avec l'horloge réglable).
- Le site n'a pas été ouvert dans un navigateur : rien de `site/` ne change.

## 4. Points douteux

1. **Le nombre, 1000.** C'est deux fois les 500 inscrits : la marge pour les fautes de frappe. Si deux groupes
   enchaînés et leurs fautes dépassent un jour mille matricules distincts en une heure, le verrou tombera encore sur
   tout le cégep. L'alternative serait de ne plus verrouiller l'adresse, mais seulement de refuser les valeurs
   nouvelles jusqu'à la tranche suivante — une autre décision, pas prise ici.
2. **Rien ne dit qu'un verrou a été posé.** Le journal des actions ne note pas les refus 429, et la table `debit` ne
   garde pas les tranches passées : si cela se reproduit, on ne le saura que par les étudiants. Un journal des refus
   de débit (date, portée, adresse, compte atteint) serait une petite tâche à part, si tu la veux.

## 5. Ce qu'il te reste à faire

Relire, fusionner `limite-debit` dans `main`, et laisser GitHub Actions déployer — le soir, hors cours.
