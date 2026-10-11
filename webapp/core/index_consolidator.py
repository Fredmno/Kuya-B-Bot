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
    # 1. HTML Templates
    dashboard_html = read_first_existing(
        os.path.join(CORE_DIR, "dashboard", "dashboard.html"),
        os.path.join(WEBAPP_DIR, "dashboard", "dashboard.html")
    )
    admin_panel_html = read_first_existing(
        os.path.join(WEBAPP_DIR, "admin_panel", "admin_panel.html"),
        os.path.join(WEBAPP_DIR, "features", "admin", "admin.html")
    )
    github_form_html = read_first_existing(
        os.path.join(WEBAPP_DIR, "features", "github_form", "github_form.html"),
        os.path.join(WEBAPP_DIR, "admin_panel", "github_form.html")
    )
    deployments_html = read_first_existing(
        os.path.join(WEBAPP_DIR, "features", "deployments", "deployments.html")
    )

    # 2. Styles
    dashboard_css = read_first_existing(
        os.path.join(CORE_DIR, "dashboard", "dashboard.css"),
        os.path.join(WEBAPP_DIR, "dashboard", "dashboard.css")
    )
    github_form_css = read_first_existing(
        os.path.join(WEBAPP_DIR, "features", "github_form", "github_form.css"),
        os.path.join(WEBAPP_DIR, "admin_panel", "github_form.css")
    )
    deployments_css = read_first_existing(
        os.path.join(WEBAPP_DIR, "features", "deployments", "deployments.css")
    )

    # 3. Scripts
    admin_panel_js = read_first_existing(
        os.path.join(WEBAPP_DIR, "admin_panel", "admin_panel.js")
    )
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
        .neu-input {{
            width: 100%;
            padding: 9px 12px;
            border-radius: 10px;
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            color: #1e293b;
            outline: none;
            font-size: 0.85rem;
        }}
        .btn-icon-back, .btn-icon-add {{
            background: #e2e8f0;
            border: none;
            border-radius: 8px;
            padding: 6px 10px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 600;
            color: #334155;
        }}
        .btn-soft {{
            border: none;
            border-radius: 10px;
            padding: 10px 14px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
        }}
        .btn-soft.cancel {{
            background: #e2e8f0;
            color: #475569;
        }}
        .btn-soft.save {{
            background: #2563eb;
            color: #ffffff;
        }}
        {dashboard_css}
        {github_form_css}
        {deployments_css}
    </style>
</head>
<body>
    <div id="app">
        {dashboard_html}
        {admin_panel_html}
        {github_form_html}
        {deployments_html}
    </div>

    <!-- Inline Core Handlers & Fallbacks -->
    <script>
        window.KuyaB = window.KuyaB || {{}};

        window.showDashboardView = function() {{
            const app = document.getElementById("app");
            if (app) {{
                for (let child of app.children) {{
                    if (child.tagName !== "SCRIPT") child.style.display = "none";
                }}
            }}
            const d = document.getElementById("dashboard-view");
            if (d) d.style.display = "block";
        }};

        window.openAdminPanel = function() {{
            const app = document.getElementById("app");
            if (app) {{
                for (let child of app.children) {{
                    if (child.tagName !== "SCRIPT") child.style.display = "none";
                }}
            }}
            const a = document.getElementById("admin-panel-view");
            if (a) a.style.display = "block";
        }};
    </script>

    <!-- Bundled Feature Scripts -->
    <script>{admin_panel_js}</script>
    <script>{github_form_js}</script>
    <script>{deployments_js}</script>
</body>
</html>
"""
    return HTMLResponse(html_content)
