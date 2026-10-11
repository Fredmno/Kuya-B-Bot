import os
import re
import time
from starlette.requests import Request
from starlette.responses import HTMLResponse

# webapp/core/ -> webapp/
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CORE_DIR = os.path.join(BASE_DIR, "core")

def read_file_safe(path: str) -> str:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return ""

def find_file(filename: str) -> str:
    """Finds the first matching file inside the webapp directory."""
    for root, _, files in os.walk(BASE_DIR):
        if filename in files:
            return os.path.join(root, filename)
    return ""

def collect_assets(extension: str) -> list:
    collected = []
    for root, _, files in os.walk(BASE_DIR):
        for file in files:
            if file.endswith(extension):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, BASE_DIR).replace("\\", "/")
                collected.append(f"/app/{rel_path}")
    return collected

def sort_scripts(scripts: list) -> list:
    def priority(path: str):
        if "utils" in path: return 10
        if "router" in path: return 20
        if "admin_panel.js" in path: return 60
        if "app.js" in path: return 90
        return 40
    return sorted(scripts, key=priority)

def build_consolidated_index() -> str:
    version = int(time.time())

    # 1. Inline neomorphic and dashboard CSS to prevent 404s and cache drops
    neomorphic_path = find_file("neomorphic.css")
    dashboard_css_path = os.path.join(CORE_DIR, "dashboard", "dashboard.css")
    if not os.path.exists(dashboard_css_path):
        dashboard_css_path = find_file("dashboard.css")

    inline_neomorphic = read_file_safe(neomorphic_path)
    inline_dashboard_css = read_file_safe(dashboard_css_path)

    # 2. Collect other feature CSS links
    css_files = [
        f for f in collect_assets(".css")
        if "neomorphic.css" not in f and "dashboard.css" not in f
    ]
    css_tags = "\n    ".join([f'<link rel="stylesheet" href="{css}?v={version}">' for css in css_files])

    # 3. Collect JS scripts
    js_files = sort_scripts(collect_assets(".js"))
    js_tags = "\n    ".join([f'<script src="{js}?v={version}"></script>' for js in js_files])

    # 4. Load dashboard HTML
    dashboard_path = os.path.join(CORE_DIR, "dashboard", "dashboard.html")
    if not os.path.exists(dashboard_path):
        dashboard_path = find_file("dashboard.html")

    dashboard_html = read_file_safe(dashboard_path)
    if "<body" in dashboard_html:
        match = re.search(r'<body[^>]*>(.*?)</body>', dashboard_html, re.DOTALL | re.IGNORECASE)
        if match:
            dashboard_html = match.group(1)

    # 5. Collect feature HTML views
    features_html = ""
    features_dir = os.path.join(BASE_DIR, "features")
    if os.path.exists(features_dir):
        for root, _, files in os.walk(features_dir):
            for file in sorted(files):
                if file.endswith(".html"):
                    features_html += f"\n<!-- Feature: {file} -->\n"
                    features_html += read_file_safe(os.path.join(root, file)) + "\n"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Kuya B Hub</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
/* Neomorphic Base Styles */
{inline_neomorphic}

/* Dashboard Styles */
{inline_dashboard_css}
    </style>
    {css_tags}
</head>
<body>
    <div id="app">
        {dashboard_html}
        {features_html}
    </div>
    {js_tags}
</body>
</html>"""

async def serve_index(request: Request):
    return HTMLResponse(build_consolidated_index())
