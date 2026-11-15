"""Assemble une version démo autonome (un seul fichier HTML) du site, pour l'artefact Claude.

Usage : python3 tools/build_demo.py <fichier_sortie.html>
La démo n'utilise pas Supabase : calculateurs seuls, sans comptes ni enregistrement.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1])

html = (ROOT / "index.html").read_text(encoding="utf-8")
css = (ROOT / "web/styles.css").read_text(encoding="utf-8")
js = {name: (ROOT / path).read_text(encoding="utf-8") for name, path in {
    "i18n": "web/i18n.js", "i18n_en": "web/i18n-en.js", "i18n_de": "web/i18n-de.js",
    "core": "app/src/core.js", "calc": "web/calc.js", "optique": "web/optique.js", "app": "web/app.js"}.items()}

body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
body = re.sub(r"<script[^>]*>\s*</script>\s*", "", body)  # retire les scripts externes

def script(code):
    return "<script>\n" + code.replace("</script", "<\\/script") + "\n</script>\n"

page = (
    "<title>Vision Path</title>\n"
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap">\n'
    "<style>\n" + css + "\n</style>\n"
    + body.strip() + "\n"
    + script("window.LUMENPATH_DEMO = true;")
    + script(js["i18n"]) + script(js["i18n_en"]) + script(js["i18n_de"])
    + script(js["core"]) + script(js["calc"]) + script(js["optique"]) + script(js["app"])
)
out.write_text(page, encoding="utf-8")
print(out, len(page.encode("utf-8")), "octets")
