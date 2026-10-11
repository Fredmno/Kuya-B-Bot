import os
import sys
from starlette.responses import HTMLResponse
from starlette.requests import Request

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
WEBAPP_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
CORE_DIR = CURRENT_DIR

def read_file_safe(path):
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            return ""
    return ""

async def serve_index(request: Request):
    # Dashboard path pointing directly to webapp/core/dashboard/
    dashboard_html = read_file_safe(os.path.join(CORE_DIR, "dashboard", "dashboard.html"))
    if not dashboard_html:
        dashboard_html = read_file_safe(os.path.join(WEBAPP_DIR, "dashboard", "dashboard.html"))

    admin_panel_html = read_file_safe(os.path.join(WEBAPP_DIR, "admin_panel", "admin_panel.html"))
    github_form_html = read_file_safe(os.path.join(WEBAPP_DIR, "features", "github_form", "github_form.html"))
    deployments_html = read_file_safe(os.path.join(WEBAPP_DIR, "features", "deployments", "deployments.html"))

    dashboard_css = read_file_safe(os.path.join(CORE_DIR, "dashboard", "dashboard.css"))
    if not dashboard_css:
        dashboard_css = read_file_safe(os.path.join(WEBAPP_DIR, "dashboard", "dashboard.css"))

    github_css = read_file_safe(os.path.join(WEBAPP_DIR, "features", "github_form", "github_form.css"))

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Kuya B Hub</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
        :root {{
            --bg-color: #e6ecf5;
            --text-color: #1e293b;
        }}
        body {{
            margin: 0;
            padding: 0;
            background-color: var(--bg-color);
            color: var(--text-color);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            -webkit-tap-highlight-color: transparent;
        }}
        #app {{
            min-height: 100vh;
        }}
        {dashboard_css}
        {github_css}
    </style>
</head>
<body>
    <div id="app">
        {dashboard_html}
        {admin_panel_html}
        {github_form_html}
        {deployments_html}
    </div>

    <!-- Scripts -->
    <script src="/app/admin_panel/admin_panel.js"></script>
    <script src="/app/features/github_form/github_form.js"></script>
    <script src="/app/features/deployments/deployments.js"></script>
</body>
</html>
"""
    return HTMLResponse(html_content)
