# Bibliothèques vendorisées

La seule dépendance d'exécution du site (décision D3), copiée telle quelle, version épinglée. Rien n'est chargé d'un domaine externe.

| Fichier | Origine | Version | Licence |
|---|---|---|---|
| `qrcode-generator-2.0.4.mjs` | paquet npm `qrcode-generator` (Kazuhiko Arase, https://github.com/kazuhikoarase/qrcode-generator), fichier `dist/qrcode.mjs` | 2.0.4 | MIT (en-tête du fichier) |

Utilisée par `site/js/ui/qr.js` pour le QR de l'attestation (décision D33). Le fichier n'est pas modifié ; pour changer de version : remplacer le fichier, renommer, mettre ce tableau et l'import de `qr.js` à jour, puis `npm test`.
