import os
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles

# Import serve_index from index_consolidator in the same directory
try:
    from webapp.core.index_consolidator import serve_index
except ImportError:
    from index_consolidator import serve_index

# Base webapp directory: webapp/core/ -> webapp/
WEBAPP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def get_all_routes(health_check_handler=None, telegram_webhook_handler=None, webhook_path="/webhook"):
    """
    Returns all Starlette routes for the webapp and API endpoints.
    """
    features_dir = os.path.join(WEBAPP_DIR, "features")
    modules_dir = os.path.join(WEBAPP_DIR, "modules")
    dashboard_dir = os.path.join(WEBAPP_DIR, "dashboard")

    routes = [
        # Main dynamic Mini App entry route
        Route("/app", endpoint=serve_index, methods=["GET"]),
    ]

    # Mount static assets if directories exist
    if os.path.exists(features_dir):
        routes.append(Mount("/app/features", StaticFiles(directory=features_dir), name="features"))
    if os.path.exists(modules_dir):
        routes.append(Mount("/app/modules", StaticFiles(directory=modules_dir), name="modules"))
    if os.path.exists(dashboard_dir):
        routes.append(Mount("/app/dashboard", StaticFiles(directory=dashboard_dir), name="dashboard"))

    if health_check_handler:
        routes.append(Route("/health", endpoint=health_check_handler, methods=["GET"]))

    if telegram_webhook_handler:
        routes.append(Route(webhook_path, endpoint=telegram_webhook_handler, methods=["POST"]))

    return routes
