import os
import sys
from starlette.responses import HTMLResponse
from starlette.requests import Request

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
WEBAPP_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
CORE_DIR = CURRENT_DIR

def read_first_existing(*paths):
    for p in paths:
        if os.path.isfile(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return f.read()
            except Exception:
                pass
    return ""

async def serve_index(request: Request):
    # 1. HTML Views
    dashboard_html = read_first_existing(
        os.path.join(CORE_DIR, "dashboard", "dashboard.html"),
        os.path.join(WEBAPP_DIR, "dashboard", "dashboard.html")
    )
    admin_panel_html = read_first_existing(
        os.path.join(WEBAPP_DIR, "features", "admin_panel", "admin_panel.html"),
        os.path.join(WEBAPP_DIR, "features", "admin", "admin.html")
    )
    github_form_html = read_first_existing(
        os.path.join(WEBAPP_DIR, "features", "github_form", "github_form.html")
    )
    deployments_html = read_first_existing(
        os.path.join(WEBAPP_DIR, "features", "deployments", "deployments.html")
    )

    # 2. Styles
    github_form_css = read_first_existing(
        os.path.join(WEBAPP_DIR, "features", "github_form", "github_form.css")
    )

    # 3. Scripts
    github_form_js = read_first_existing(
        os.path.join(WEBAPP_DIR, "features", "github_form", "github_form.js")
    )
    deployments_js = read_first_existing(
        os.path.join(WEBAPP_DIR, "features", "deployments", "deployments.js")
    )

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
        * {{
            box-sizing: border-box;
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
            width: 100%;
        }}
        {github_form_css}
    </style>
</head>
<body>
    <div id="app">
        {dashboard_html}
        {admin_panel_html}
        {github_form_html}
        {deployments_html}
    </div>

    <!-- Central Routing Engine -->
    <script>
        window.KuyaB = window.KuyaB || {{}};

        function hideAllViews() {{
            const views = ["dashboard-view", "admin-panel-view", "githubFormPage", "render-status-view"];
            views.forEach(id => {{
                const el = document.getElementById(id);
                if (el) el.style.display = "none";
            }});
        }}

        window.showDashboardView = function() {{
            hideAllViews();
            const d = document.getElementById("dashboard-view");
            if (d) d.style.display = "block";
        }};

        window.openAdminPanel = function() {{
            hideAllViews();
            const a = document.getElementById("admin-panel-view");
            if (a) a.style.display = "block";
        }};
    </script>

    <!-- Bundled Scripts -->
    <script>{github_form_js}</script>
    <script>{deployments_js}</script>
</body>
</html>
"""
    return HTMLResponse(html_content)
