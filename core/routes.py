import os
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from webapp.core.index_consolidator import serve_index

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WEBAPP_DIR = os.path.join(BASE_DIR, "webapp")

def get_all_routes(health_check_handler=None, telegram_webhook_handler=None, webhook_path="/webhook"):
    routes = [
        # Mini App Main Dynamic Route
        Route("/app", endpoint=serve_index, methods=["GET"]),
        
        # Static assets (JS, CSS, images)
        Mount("/app/features", StaticFiles(directory=os.path.join(WEBAPP_DIR, "features")), name="features"),
        Mount("/app/modules", StaticFiles(directory=os.path.join(WEBAPP_DIR, "modules")), name="modules"),
        Mount("/app/dashboard", StaticFiles(directory=os.path.join(WEBAPP_DIR, "dashboard")), name="dashboard"),
    ]

    if health_check_handler:
        routes.append(Route("/health", endpoint=health_check_handler, methods=["GET"]))

    if telegram_webhook_handler:
        routes.append(Route(webhook_path, endpoint=telegram_webhook_handler, methods=["POST"]))

    return routes
