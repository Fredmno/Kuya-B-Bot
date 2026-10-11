import os
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles

try:
    from webapp.core.index_consolidator import serve_index
except ImportError:
    from index_consolidator import serve_index

# webapp/core/ -> webapp/
WEBAPP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CORE_DIR = os.path.join(WEBAPP_DIR, "core")

def get_all_routes(health_check_handler=None, telegram_webhook_handler=None, webhook_path="/webhook"):
    features_dir = os.path.join(WEBAPP_DIR, "features")
    modules_dir = os.path.join(WEBAPP_DIR, "modules")

    routes = [
        Route("/app", endpoint=serve_index, methods=["GET"]),
        
        # Mount the core folder so /app/core/dashboard/dashboard.css is reachable
        Mount("/app/core", StaticFiles(directory=CORE_DIR), name="core"),
    ]

    if os.path.exists(features_dir):
        routes.append(Mount("/app/features", StaticFiles(directory=features_dir), name="features"))
    if os.path.exists(modules_dir):
        routes.append(Mount("/app/modules", StaticFiles(directory=modules_dir), name="modules"))

    if health_check_handler:
        routes.append(Route("/health", endpoint=health_check_handler, methods=["GET"]))

    if telegram_webhook_handler:
        routes.append(Route(webhook_path, endpoint=telegram_webhook_handler, methods=["POST"]))

    return routes
