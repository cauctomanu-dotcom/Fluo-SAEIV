from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

VERSION = "1.0.60"

# Les modules modernes sont chargés explicitement et une seule fois, dans un ordre
# déterministe. Les anciens tags vXXX présents dans l'HTML source sont supprimés.
MODULES = [
    "v128-gps.js",
    "v128-offline.js",
    "v130-session-orientation.js",
    "v131-speech.js",
    "v132-journals.js",
    "v133-profile-journals.js",
    "v134-journal-front.js",
    "v135-journal-router.js",
    "v136-driver-operations.js",
    "v137-driver-hub.js",
    "v141-static-fluo.js",
    "v144-day-hlp-driver.js",
    "v145-planning-tad.js",
    "v146-planning-tad-bridge.js",
    "v147-flow-journals-fix.js",
    "v148-continuous-day.js",
    "v150-journal-regulation.js",
    "v154-planning-service-times.js",
    "v155-planning-cut-percent.js",
    # Le pont propre doit exister avant l'authentification Supabase.
    "v159-clean-runtime.js",
    "v156-supabase-sync.js",
    "v157-exploitation.js",
    "v158-role-login.js",
]

SCRIPT_RE = re.compile(r"<script\b(?P<attrs>[^>]*)>(?P<body>.*?)</script\s*>", re.I | re.S)
MODULE_SRC_RE = re.compile(
    r"\s*<script\b[^>]*\bsrc\s*=\s*([\"'])\./v\d[^\"']*\.js(?:\?[^\"']*)?\1[^>]*>\s*</script\s*>\s*",
    re.I,
)


def executable_inline(attrs: str) -> bool:
    if re.search(r"\bsrc\s*=", attrs, re.I):
        return False
    m = re.search(r"\btype\s*=\s*([\"'])(.*?)\1", attrs, re.I | re.S)
    if not m:
        return True
    typ = m.group(2).strip().lower()
    return typ in {"", "text/javascript", "application/javascript", "module"}


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: externalize_runtime.py SITE_INDEX_HTML")

    page = Path(sys.argv[1])
    if not page.exists():
        raise SystemExit(f"index introuvable: {page}")

    html = page.read_text(encoding="utf-8")
    runtime_dir = page.parent / "runtime"
    if runtime_dir.exists():
        shutil.rmtree(runtime_dir)
    runtime_dir.mkdir(parents=True)

    parts: list[str] = []
    part_names: list[str] = []

    def replace_script(match: re.Match[str]) -> str:
        attrs = match.group("attrs") or ""
        body = match.group("body") or ""
        if not executable_inline(attrs):
            return match.group(0)
        if not body.strip():
            return ""
        idx = len(parts) + 1
        name = f"part-{idx:03d}.js"
        parts.append(body.rstrip() + "\n")
        part_names.append(name)
        return f'<script src="./runtime/{name}?v={VERSION}"></script>'

    html = SCRIPT_RE.sub(replace_script, html)
    if not parts:
        raise SystemExit("aucun JavaScript inline trouvé à externaliser")

    # Retire les anciens chargements de modules versionnés, puis réinstalle une
    # chaîne unique. Les CDN (Leaflet / MapLibre) ne correspondent pas à ce motif
    # et restent exactement à leur place.
    html = MODULE_SRC_RE.sub("\n", html)

    module_tags = "\n".join(
        f'<script src="./{name}?v={VERSION}"></script>' for name in MODULES
    )
    if "</body>" not in html:
        raise SystemExit("balise </body> absente")
    html = html.replace("</body>", module_tags + "\n</body>", 1)

    # Numéro de version uniquement dans les références de ressources et le titre.
    html = re.sub(r"manifest\.webmanifest\?v=1\.0\.\d+", f"manifest.webmanifest?v={VERSION}", html)
    html = re.sub(r"<title>Mon SAEIV · 1\.0\.\d+</title>", f"<title>Mon SAEIV · {VERSION}</title>", html)

    for name, body in zip(part_names, parts):
        (runtime_dir / name).write_text(body, encoding="utf-8")

    manifest = {
        "version": VERSION,
        "generated": True,
        "parts": [f"runtime/{name}" for name in part_names],
        "modules": MODULES,
    }
    (runtime_dir / "runtime-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    # Contrat principal de la réécriture : le document HTML publié ne contient
    # plus aucun JavaScript exécutable inline. Il ne peut donc plus afficher la
    # suite du code comme du texte à cause d'une fermeture </script> dans une chaîne.
    for m in SCRIPT_RE.finditer(html):
        if executable_inline(m.group("attrs") or ""):
            raise SystemExit("JavaScript inline résiduel après externalisation")

    page.write_text(html, encoding="utf-8")
    print(f"Runtime externalisé : {len(parts)} scripts -> {runtime_dir}")


if __name__ == "__main__":
    main()
