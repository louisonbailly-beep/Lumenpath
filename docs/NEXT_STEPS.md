# Prochaines étapes

1. **Comptes** : créer GitHub (dépôt `lumenpath`) et Supabase (projet UE).
2. **Dépôt** : `git init`, premier commit de ce dossier, pousser sur GitHub.
3. **Supabase Auth** : e-mail + mot de passe, confirmation par lien, rôles `utilisateur`, `editeur_catalogue`, `admin` (table `profiles` + RLS). 2FA TOTP pour admin.
4. **Tables** : `profiles` (prénom, nom, société, département, téléphone facultatif), `projects` (entrées + résultats), `audit_log`, `consents` (partage bureau d'études, IA).
5. **Port du design** : reprendre `design/` dans l'app, d'abord Connexion/Inscription, puis les deux calculateurs, puis l'admin.
6. **Mobile** : barre d'onglets bas, tableaux en cartes, cibles de 44 px (voir `design/Mobile.dc.html`).
7. **Écrans à finir côté design** : Optique conseillée en version adaptative (grilles qui se replient), Accueil et Admin en mobile.
8. **Vérifications** : marque et nom de domaine « Lumenpath », montures et prix à valider, mentions RGPD.
