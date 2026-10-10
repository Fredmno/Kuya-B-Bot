import os
from starlette.requests import Request
from starlette.responses import HTMLResponse, PlainTextResponse

from config import APP_VERSION

VIEW_PARTS = [
    "base_head.html",
    "modals.html",
    "dashboard.html",
    "birthdays.html",
    "daily_logs.html",
    "tasks.html",
    "reminders.html",
    "vault.html",
    "user_tracking.html",
    "scripts.html",
]


async def serve_index(request: Request):
    """
    Renders the WebApp HTML.
    Stitches partial templates from webapp/views/ if available,
    otherwise falls back to webapp/index.html.
    """
    views_dir = os.path.join("webapp", "views")

    if os.path.exists(views_dir):
        fragments = []
        for part in VIEW_PARTS:
            part_path = os.path.join(views_dir, part)
            if os.path.exists(part_path):
                with open(part_path, "r", encoding="utf-8") as f:
                    fragments.append(f.read())
        content = "\n".join(fragments)
    else:
        index_path = os.path.join("webapp", "index.html")
        if not os.path.exists(index_path):
            return PlainTextResponse("index.html not found", status_code=404)
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()

    rendered = content.replace("{{ v }}", str(APP_VERSION))

    return HTMLResponse(
        rendered,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
