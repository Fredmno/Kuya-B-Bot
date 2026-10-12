import os
import sys
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
WEBAPP_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
CORE_DIR = CURRENT_DIR

for p in [WEBAPP_DIR, CORE_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from webapp.core.index_consolidator import serve_index
except Exception:
    try:
        from index_consolidator import serve_index
    except Exception:
        async def serve_index(request: Request):
            return HTMLResponse("<h2>Kuya B Hub is loading... Please refresh.</h2>")

def get_all_routes(health_check_handler=None, telegram_webhook_handler=None, webhook_path="/webhook"):
    routes = [
        Route("/", endpoint=serve_index, methods=["GET"]),
        Route("/app", endpoint=serve_index, methods=["GET"]),
        Route("/app/", endpoint=serve_index, methods=["GET"]),
        Route("/index.html", endpoint=serve_index, methods=["GET"]),
    ]

    try:
        from webapp.core.routes import routes_commit
        routes.extend(routes_commit.get_routes())
    except Exception:
        pass

    try:
        from webapp.core.routes import routes_deployments
        routes.extend(routes_deployments.get_routes())
    except Exception:
        pass

    try:
        from webapp.core.routes import routes_admin_panel
        routes.extend(routes_admin_panel.get_routes())
    except Exception:
        pass

    if os.path.exists(CORE_DIR):
        routes.append(Mount("/app/core", StaticFiles(directory=CORE_DIR), name="core_app"))
        routes.append(Mount("/core", StaticFiles(directory=CORE_DIR), name="core_root"))

    features_dir = os.path.join(WEBAPP_DIR, "features")
    if os.path.exists(features_dir):
        routes.append(Mount("/app/features", StaticFiles(directory=features_dir), name="features_app"))
        routes.append(Mount("/features", StaticFiles(directory=features_dir), name="features_root"))

    if health_check_handler:
        routes.append(Route("/health", endpoint=health_check_handler, methods=["GET"]))
    if telegram_webhook_handler:
        routes.append(Route(webhook_path, endpoint=telegram_webhook_handler, methods=["POST"]))

    return routes
