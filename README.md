# Martinet — suivi administratif (PWA, 100 % local)

Échéances micro-entreprise (Urssaf), impôts sur le revenu et Urssaf artistes-auteurs.
**Aucune donnée personnelle n'est contenue dans le code** : tout est saisi par l'utilisateur sur son appareil.

## Fichiers
`index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest`, `icons/`, `robots.txt`, `.nojekyll`, `_headers`

## Publier (au choix)
- **GitHub Pages** : dépôt avec ces fichiers à la racine → Settings → Pages → branche `main` / racine.
- **Netlify / Cloudflare Pages** : glisser-déposer le dossier. Le fichier `_headers` y applique en plus des en-têtes de sécurité (CSP, anti-iframe, no-referrer…).
- Puis, sur iPhone : ouvrir l'adresse dans Safari → Partager → « Sur l'écran d'accueil ».

## Modèle de sécurité
- **Aucun réseau applicatif** : pas de compte, pas de serveur, pas de statistiques, pas de police ou script externe.
- **CSP stricte** (balise `<meta>` + `_headers`) : scripts, styles et images uniquement depuis le site lui-même, aucun script ou style en ligne, `form-action 'none'`. Le navigateur refuse toute connexion vers un autre domaine (`connect-src 'self'`, `img-src 'self' data:`).
- **Données** : stockées dans le `localStorage` de l'appareil uniquement. Toute donnée lue (stockage ou fichier importé) passe par une validation en liste blanche ; tout texte affiché est échappé (pas de HTML injectable).
- **Verrouillage optionnel** : AES-256-GCM, clé dérivée du code par PBKDF2-SHA256 (310 000 itérations), sel et IV aléatoires. La clé reste en mémoire, jamais stockée. Verrouillage automatique après 1 minute en arrière-plan, voile sur l'aperçu du sélecteur d'applications.
- **Sauvegarde** : fichier JSON manuel (chiffré si le verrouillage est actif).
- **Référent / indexation** : `no-referrer`, `noindex`, `robots.txt` en `Disallow`.

## Limites à connaître
- L'hébergeur voit les visites (adresse IP, type d'appareil) comme pour tout site, jamais les saisies.
- Un code oublié n'est pas récupérable. Un code court ne résiste pas à une attaque menée directement sur l'appareil.
- L'effacement des données du site (ou la désinstallation) supprime tout : faire des sauvegardes.
- La sécurité repose sur l'intégrité des fichiers publiés : protéger l'accès au dépôt / compte d'hébergement (authentification à deux facteurs).
- Les dates 2027 sont des estimations (`EST` dans `app.js`) à confirmer à la publication des calendriers officiels.

## Mises à jour
Après toute modification, incrémenter `CACHE` dans `sw.js` pour forcer la mise à jour hors ligne.
