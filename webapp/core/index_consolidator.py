import os
import glob
from starlette.requests import Request
from starlette.responses import HTMLResponse
from config import APP_VERSION

# Current file is in webapp/core/, so the webapp root is one level up
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
WEBAPP_ROOT = os.path.dirname(CURRENT_DIR)


def generate_consolidated_index_html() -> str:
    """
    Automatically scans all .html partials inside webapp/,
    orders them structurally, and merges them into a single index.html.
    """
    head_parts = []
    modal_parts = []
    dashboard_parts = []
    feature_parts = []
    footer_parts = []

    # Find all .html files inside webapp and its subfolders
    html_files = glob.glob(os.path.join(WEBAPP_ROOT, "**", "*.html"), recursive=True)

    for file_path in html_files:
        filename = os.path.basename(file_path).lower()

        # Deterministic sequence: Head -> Modals -> Dashboard -> Features -> Scripts
        if "base_head" in filename or "head" in filename:
            head_parts.append(file_path)
        elif "modal" in filename:
            modal_parts.append(file_path)
        elif "dashboard" in filename:
            dashboard_parts.append(file_path)
        elif "script" in filename or "footer" in filename:
            footer_parts.append(file_path)
        else:
            feature_parts.append(file_path)

    # Sort alphabetically inside each category
    head_parts.sort()
    modal_parts.sort()
    dashboard_parts.sort()
    feature_parts.sort()
    footer_parts.sort()

    ordered_files = head_parts + modal_parts + dashboard_parts + feature_parts + footer_parts

    content_pieces = []
    for path in ordered_files:
        try:
            with open(path, "r", encoding="utf-8") as f:
                content_pieces.append(f.read())
        except Exception as e:
            print(f"[IndexConsolidator] Error reading {path}: {e}")

    return "\n\n".join(content_pieces)


async def serve_index(request: Request):
    """
    Endpoint that renders the dynamically consolidated index.html
    with cache-busting for the current app version.
    """
    html = generate_consolidated_index_html()
    rendered = html.replace("{{ v }}", str(APP_VERSION))
    return HTMLResponse(rendered)
