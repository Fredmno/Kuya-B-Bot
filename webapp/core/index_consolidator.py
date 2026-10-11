import os
import time
from starlette.requests import Request
from starlette.responses import HTMLResponse

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def read_file_safe(path: str) -> str:
    """Reads a text file safely if it exists."""
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return ""


def collect_assets(extension: str) -> list:
    """Recursively collects relative web paths for assets (.css or .js)."""
    collected = []
    for root, _, files in os.walk(BASE_DIR):
        for file in files:
            if file.endswith(extension):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, BASE_DIR).replace(
                    "\\", "/"
                )
                collected.append(f"/app/{rel_path}")
    return collected


def sort_scripts(scripts: list) -> list:
    """
    Ensures correct loading hierarchy:
    1. Third-party / core modules (utils, router, etc.)
    2. Feature logic (admin, render_status, tasks, etc.)
    3. App entry points (app.js)
    """

    def priority(path: str):
        if "utils" in path:
            return 10
        if "router" in path:
            return 20
        if "modules/" in path:
            return 30
        if "features/" in path:
            return 50
        if "app.js" in path:
            return 90
        return 40

    return sorted(scripts, key=priority)


def build_consolidated_index() -> str:
    """Compiles head, styles, feature views, and scripts into one page."""
    version = int(time.time())

    # 1. Discover all CSS stylesheets automatically
    css_files = collect_assets(".css")
    css_tags = "\n    ".join(
        [
            f'<link rel="stylesheet" href="{css}?v={version}">'
            for css in css_files
        ]
    )

    # 2. Discover all JavaScript files automatically
    js_files = sort_scripts(collect_assets(".js"))
    js_tags = "\n    ".join(
        [
            f'<script src="{script}?v={version}"></script>'
            for script in js_files
        ]
    )

    # 3. Collect dashboard and feature HTML views
    views_html = ""
    dashboard_path = os.path.join(BASE_DIR, "dashboard", "dashboard.html")
    if os.path.exists(dashboard_path):
        views_html += read_file_safe(dashboard_path) + "\n"

    features_dir = os.path.join(BASE_DIR, "features")
    if os.path.exists(features_dir):
        for root, _, files in os.walk(features_dir):
            for file in sorted(files):
                if file.endswith(".html"):
                    view_path = os.path.join(root, file)
                    views_html += f"\n<!-- Feature View: {file} -->\n"
                    views_html += read_file_safe(view_path) + "\n"

    # 4. Construct the complete single-page HTML
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
{views_html}
    </div>
    {js_tags}
</body>
</html>"""


async def serve_index(request: Request):
    """Starlette route handler returning the consolidated HTML."""
    html = build_consolidated_index()
    return HTMLResponse(html)
