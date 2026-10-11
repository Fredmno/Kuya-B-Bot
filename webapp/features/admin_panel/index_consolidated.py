import os
import time
from starlette.requests import Request
from starlette.responses import HTMLResponse

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def read_file_safe(path: str) -> str:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
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

    css_files = collect_assets(".css")
    css_tags = "\n    ".join([f'<link rel="stylesheet" href="{css}?v={version}">' for css in css_files])

    js_files = sort_scripts(collect_assets(".js"))
    js_tags = "\n    ".join([f'<script src="{js}?v={version}"></script>' for js in js_files])

    # Find the main dashboard file across common paths
    possible_dashboards = [
        os.path.join(BASE_DIR, "dashboard", "dashboard.html"),
        os.path.join(BASE_DIR, "dashboard.html"),
        os.path.join(BASE_DIR, "index.html"),
    ]
    
    dashboard_html = ""
    for p in possible_dashboards:
        if os.path.exists(p):
            content = read_file_safe(p)
            # If it's a full HTML page, extract inside body or div#app
            if "<body" in content:
                import re
                match = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL | re.IGNORECASE)
                if match:
                    content = match.group(1)
            dashboard_html = content
            break

    # Collect feature HTML views
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
