# Lumenpath — contexte pour Claude Code

Outil web pour intégrateurs, constructeurs de machines et utilisateurs finaux de vision industrielle (optiques, filtres, éclairage). Langue de l'interface : français (anglais à prévoir pour le marché européen).

## Structure
- `app/src/core.js` : moteur de calcul optique (UMD, `OptiCalc`). Capteurs, matières, longueurs d'onde, objectif neutre, filtres, prix caméra indicatif, montures, `adviseOptic`.
- `app/src/test.js` : 46 vérifications. Lancer `node app/src/test.js` avant toute modification du moteur.
- `app/app_template.html` : application actuelle (porte d'inscription démo + 2 calculateurs). `app.html` en est la version assemblée (remplacer `/*__CORE__*/` par `core.js`).
- `design/` : nouveau design (canvas, fichiers `.dc.html`, 9 écrans dont mobile). Référence visuelle à porter dans l'app. Tokens : polices Geist / Geist Mono, un accent bleu, mode clair et sombre.
- `docs/` : logos, cahier des charges, architecture (à ajouter).
- `supabase/` : schéma prévu (voir `docs/NEXT_STEPS.md`).

## Règles
- Le moteur de calcul reste indépendant de l'interface et testé.
- Aucun mot de passe en clair ni envoyé par e-mail ; l'utilisateur le choisit après vérification du lien (24 h, usage unique).
- Admin : 2FA obligatoire, journal d'audit.
- Prix caméra : estimation ±25 %, source revendeurs Basler (USD), à signaler comme indicative.
