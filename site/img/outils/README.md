# Images d'outils — la semence

Extraites du classeur (feuille « Liste d'outils », ligne 2), une par outil, nommée par l'`id` de l'outil dans `outils.json`. PNG tels quels (environ 100 px). Certains outils partagent la même photo dans le classeur (forets, alésoirs, barres à fileter, SDTMR).

**Depuis le jalon 7b (décision D56), les images vivent dans la base D1** (table `images`, migration `0007`, servies par `/images/<id>`) : ces fichiers ne sont plus que **la semence** et les données des tests — comme les JSON de `site/data/`. Les ajouter, les changer ou les retirer ici ne change rien en production : c'est l'onglet **Images** de l'éditeur (`/prof/editeur`) qui téléverse, archive et supprime, et l'export de l'éditeur qui les sauvegarde. Un test vérifie que la semence est identique à ces fichiers.

| id | outil | image d'origine |
|---|---|---|
| foret_fractionnaire | Foret fractionnaire | image49.png |
| foret_fractionnaire_2 | Foret fractionnaire | image49.png |
| foret_a_numero | Foret à numéro | image50.png |
| foret_a_lettre | Foret à lettre | image51.png |
| foret_metrique | Foret métrique | image49.png |
| foret_metrique_2 | Foret métrique | image49.png |
| foret_udrill | Foret Udrill | image52.png |
| alesoir | Alésoir | image53.png |
| alesoir_2 | Alésoir | image54.png |
| fraise_en_bout_helicoidale | Fraise en bout hélicoïdale | image55.png |
| fraise_en_bout_a_inserts | Fraise en bout à inserts | image56.png |
| fraise_a_surfacer | Fraise à surfacer | image57.png |
| taraud_imperial | Taraud impérial | image58.png |
| taraud_imperial_2 | Taraud impérial | image58.png |
| taraud_metrique | Taraud métrique | image59.png |
| mclnr | MCLNR | image60.png |
| mvlnr | MVLNR | image61.png |
| lame_a_tronconner | Lame à tronçonner | image62.png |
| barre_a_fileter | Barre à fileter | image63.png |
| barre_a_fileter_2 | Barre à fileter | image63.png |
| barre_a_rainurer | Barre à rainurer | image64.png |
| barre_a_aleser | Barre à aléser | image65.png |
| foret_a_centrer | Foret à centrer | image66.png |
| nine9_90_degres | Nine9 90 degrés | image67.png |
| sdtmr | SDTMR | image68.png |
| sdtmr_2 | SDTMR | image68.png |
| foret_a_pointer | Foret à pointer | image69.png |
| fraise_82_degres | Fraise 82 degrés | image70.png |
| outil_a_chambrer | Outil à chambrer | image71.png |
