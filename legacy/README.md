# Legacy — référence figée, lecture seule

- `Exercice_M10_tournage_vc_version_etudiant_r0.xlsm` — le classeur d'origine (Excel + VBA + ActiveX). Son titre d'origine était « Exercice M10 - tournage - vc seulement - version étudiant_r0.xlsm » ; renommé sans accent ni espace (2026-09-21) parce que l'accent s'était abîmé sur disque.
- `vba/` — les 25 modules VBA exportés en texte (`.bas` modules, `.cls` classes et feuilles, `.frm` formulaires), pour lecture et diff. Modules clés :
  - `modNouvQuestion.bas`, `clsOutil.cls`, `clsMateriau.cls`, `clsParamCoupe.cls` — génération d'une question et calcul des réponses ;
  - `modCorrection.bas` — tolérances de correction et code de réussite Moodle (`calcCodeM`) ;
  - `modRapport.bas` — rapport, payload du QR (`qrCode`), URL de vérification ;
  - `modSubFct.bas` — utilitaires, encodage du payload (`EncryptString`) ;
  - `mdQRCodegen.bas` — générateur de QR code (bibliothèque tierce portée en VBA).
- `index.htm` — page de vérification actuellement publiée sur `thierryleroux.github.io/tgm-fab/` : décode `?data=` et affiche le rapport.

Rien ici n'est destiné à évoluer ; c'est la référence pour `docs/SPEC.md`.
