"""Génère les modèles d'e-mails Supabase en français (supabase/email-templates/).

Usage : python3 tools/build_emails.py
Les fichiers produits se collent dans Supabase > Authentication > Emails > Templates.
HTML compatible messageries : tableaux, styles en ligne, pas de SVG ni de police externe.
"""
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "supabase" / "email-templates"
OUT.mkdir(parents=True, exist_ok=True)

FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
INK, MUTED, LINE, BG, BLUE = "#1D1D1F", "#6E6E73", "#E5E5EA", "#F5F5F7", "#0066CC"


def page(preheader, title, intro, button, after, note):
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background:{BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BG};">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="padding:0 8px 24px;font-family:{FONT};font-size:20px;font-weight:600;letter-spacing:-0.4px;color:{INK};">
        lumen<span style="font-weight:400;color:{MUTED};">path</span>&nbsp;<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:{BLUE};vertical-align:middle;"></span>
      </td></tr>
      <tr><td style="background:#FFFFFF;border:1px solid {LINE};border-radius:18px;padding:36px 32px;font-family:{FONT};color:{INK};">
        <h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-0.6px;color:{INK};">{title}</h1>
        <p style="margin:0 0 26px;font-size:16px;line-height:1.55;color:{INK};">{intro}</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:{BLUE};">
          <a href="{{{{ .ConfirmationURL }}}}" style="display:inline-block;padding:13px 26px;font-family:{FONT};font-size:16px;color:#FFFFFF;text-decoration:none;border-radius:999px;">{button}</a>
        </td></tr></table>
        <p style="margin:26px 0 0;font-size:14px;line-height:1.55;color:{MUTED};">{after}</p>
        <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:{MUTED};word-break:break-all;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="{{{{ .ConfirmationURL }}}}" style="color:{BLUE};">{{{{ .ConfirmationURL }}}}</a></p>
      </td></tr>
      <tr><td style="padding:22px 8px 0;font-family:{FONT};font-size:12px;line-height:1.5;color:{MUTED};">
        {note}<br>Lumenpath · calcul optique pour la vision industrielle
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
"""


TEMPLATES = {
    "confirmation.html": dict(
        subject="Confirmez votre adresse pour activer votre accès Lumenpath",
        preheader="Un clic pour confirmer votre adresse, puis vous choisirez votre mot de passe.",
        title="Confirmez votre adresse",
        intro="Bonjour {{ .Data.prenom }}, merci pour votre inscription à Lumenpath. Confirmez votre adresse pour activer votre accès professionnel.",
        button="Confirmer mon adresse",
        after="Vous choisirez ensuite votre mot de passe sur le site. Ce lien est à usage unique et expire après 24 heures.",
        note="Vous n'êtes pas à l'origine de cette inscription ? Ignorez cet e-mail : aucun compte ne sera activé.",
    ),
    "magic-link.html": dict(
        subject="Votre lien de connexion Lumenpath",
        preheader="Votre lien de connexion à usage unique.",
        title="Votre lien de connexion",
        intro="Bonjour {{ .Data.prenom }}, voici votre lien pour vous connecter à Lumenpath.",
        button="Me connecter",
        after="Ce lien est à usage unique et expire rapidement. Aucun mot de passe n'est envoyé par e-mail.",
        note="Vous n'avez rien demandé ? Ignorez cet e-mail : personne ne pourra se connecter sans ce lien.",
    ),
    "reset-password.html": dict(
        subject="Choisissez un nouveau mot de passe Lumenpath",
        preheader="Un lien à usage unique pour choisir un nouveau mot de passe.",
        title="Nouveau mot de passe",
        intro="Bonjour {{ .Data.prenom }}, vous avez demandé à changer le mot de passe de votre accès Lumenpath.",
        button="Choisir un nouveau mot de passe",
        after="Ce lien est à usage unique. Votre mot de passe actuel reste valable tant que vous n'en avez pas choisi un nouveau.",
        note="Vous n'êtes pas à l'origine de cette demande ? Ignorez cet e-mail : votre mot de passe ne change pas.",
    ),
}

subjects = []
for name, t in TEMPLATES.items():
    html = page(t["preheader"], t["title"], t["intro"], t["button"], t["after"], t["note"])
    (OUT / name).write_text(html, encoding="utf-8")
    subjects.append(f"- `{name}` : {t['subject']}")

(OUT / "README.md").write_text(
    "# Modèles d'e-mails Supabase\n\n"
    "À coller dans Supabase > Authentication > Emails > Templates (un modèle par onglet).\n\n"
    "| Onglet Supabase | Fichier | Objet |\n|---|---|---|\n"
    f"| Confirm signup | confirmation.html | {TEMPLATES['confirmation.html']['subject']} |\n"
    f"| Magic Link | magic-link.html | {TEMPLATES['magic-link.html']['subject']} |\n"
    f"| Reset Password | reset-password.html | {TEMPLATES['reset-password.html']['subject']} |\n\n"
    "Régénérer : `python3 tools/build_emails.py`.\n",
    encoding="utf-8",
)
print("\n".join(subjects))
