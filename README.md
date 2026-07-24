# RETROCORE

Émulateur Game Boy Advance 100 % web, optimisé iPhone (Safari + PWA), déployable sur GitHub Pages sans build step.

## Déploiement

1. Pousser le contenu du dossier tel quel sur une branche (`main`).
2. Settings → Pages → Deploy from branch → `main` / `/ (root)`.
3. Ouvrir `https://<user>.github.io/<repo>/` sur iPhone.

Tous les chemins sont relatifs : le sous-dossier GitHub Pages est géré.

## Architecture

- **Parent** (`index.html` + `js/`) : bibliothèque de ROMs (IndexedDB), save states (IndexedDB, 9 slots + miniatures JPEG), codes GameShark (localStorage par ROM), UI.
- **Iframe blob** (`js/emulator-frame.js`) : document HTML autonome → Blob → iframe. Handshake `ready` → envoi de la ROM en `ArrayBuffer` (structured clone) → l'iframe crée sa propre blob URL → EmulatorJS (core `gba` = mGBA WASM) + injection de `loader.js` depuis le contexte iframe.
- **Point clé** : l'iframe blob a une **origine opaque** → aucun accès à IndexedDB/localStorage dedans. Toute la persistance vit côté parent ; états et miniatures transitent par postMessage (`get-state` / `state-data`, `load-state`, `set-cheats`).

## ⚠️ Point ouvert : mode standalone (PWA)

L'architecture postMessage + blob iframe est validée en Safari classique. En mode « ajouté à l'écran d'accueil », vérifier explicitement :

1. **Stockage partitionné** : iOS isole le stockage de la PWA de celui de Safari. Les ROMs/states importées dans Safari **n'apparaîtront pas** dans la PWA (et inversement). C'est un comportement iOS attendu, pas un bug — réimporter les ROMs depuis la PWA.
2. **Blob iframe en standalone** : à tester en priorité. Si l'écran reste noir en PWA alors que Safari fonctionne, noter le mode d'échec exact (iframe blanche ? `ready` jamais reçu ? `loader.js` en erreur ?) — le message `error` du protocole remonte dans un toast pour faciliter ce diagnostic.
3. **Éviction WebKit** : iOS peut purger IndexedDB des sites inactifs ; l'installation en PWA réduit ce risque mais ne l'élimine pas.
4. **Suspension d'app** : en standalone, un passage en arrière-plan prolongé recharge la page (retour à la bibliothèque, partie perdue). D'où l'importance des 9 slots de save state.

Le service worker ne gère que l'app shell de notre origine ; les URLs `blob:` ne passent jamais par lui, donc il n'interfère pas avec l'architecture iframe.

## Formats

- ROMs : `.gba`, `.agb`, `.bin` (import local, jamais uploadées — tout reste sur l'appareil).
- Codes GameShark : `XXXXXXXX YYYYYYYY` (2 × 8 hexadécimaux, normalisés automatiquement à la saisie).
