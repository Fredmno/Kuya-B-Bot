import os
import sys
import logging
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, RedirectResponse

logger = logging.getLogger(__name__)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
WEBAPP_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
CORE_DIR = CURRENT_DIR

for p in [WEBAPP_DIR, CORE_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Safe import for index consolidator
serve_index = None
try:
    from webapp.core.index_consolidator import serve_index
except Exception:
    try:
        from webapp.core.index_consilidator import serve_index
    except Exception:
        try:
            from index_consolidator import serve_index
        except Exception:
            try:
                from index_consilidator import serve_index
            except Exception:
                pass

if not serve_index:
    async def serve_index(request: Request):
        index_file = os.path.join(WEBAPP_DIR, "index.html")
        if os.path.isfile(index_file):
            with open(index_file, "r", encoding="utf-8") as f:
                return HTMLResponse(f.read())
        return HTMLResponse("<h2>Kuya B Hub is loading... Please refresh.</h2>")

async def redirect_to_app(request: Request):
    return RedirectResponse(url="/app/")

def get_all_routes(health_check_handler=None, telegram_webhook_handler=None, webhook_path="/webhook"):
    routes = [
        Route("/", endpoint=serve_index, methods=["GET"]),
        Route("/app", endpoint=serve_index, methods=["GET"]),
        Route("/app/", endpoint=serve_index, methods=["GET"]),
        Route("/index.html", endpoint=serve_index, methods=["GET"]),
    ]

    # 1. Commit / Content routes
    routes_commit_module = None
    for mod_name in ["webapp.core.Routes_content", "webapp.core.routes_commit", "Routes_content", "routes_commit"]:
        try:
            routes_commit_module = __import__(mod_name, fromlist=["get_routes"])
            break
        except Exception:
            pass

    if routes_commit_module and hasattr(routes_commit_module, "get_routes"):
        try:
            routes.extend(routes_commit_module.get_routes())
        except Exception as e:
            logger.warning(f"Error loading commit routes: {e}")

    # 2. Deployment routes
    routes_deploy_module = None
    for mod_name in ["webapp.core.Rotes_deployment", "webapp.core.routes_deployments", "webapp.core.routes_deployment", "Rotes_deployment", "routes_deployments"]:
        try:
            routes_deploy_module = __import__(mod_name, fromlist=["get_routes"])
            break
        except Exception:
            pass

    if routes_deploy_module and hasattr(routes_deploy_module, "get_routes"):
        try:
            routes.extend(routes_deploy_module.get_routes())
        except Exception as e:
            logger.warning(f"Error loading deployment routes: {e}")

    # 3. Admin / Github JSON routes
    routes_admin_module = None
    for mod_name in ["webapp.core.Routes_guthub_json", "webapp.core.routes_admin_panel", "Routes_guthub_json", "routes_admin_panel"]:
        try:
            routes_admin_module = __import__(mod_name, fromlist=["get_routes"])
            break
        except Exception:
            pass

    if routes_admin_module and hasattr(routes_admin_module, "get_routes"):
        try:
            routes.extend(routes_admin_module.get_routes())
        except Exception as e:
            logger.warning(f"Error loading admin routes: {e}")

    # 4. Static Directories
    if os.path.exists(CORE_DIR):
        routes.append(Mount("/app/core", StaticFiles(directory=CORE_DIR), name="core_app"))
        routes.append(Mount("/core", StaticFiles(directory=CORE_DIR), name="core_root"))

    features_dir = os.path.join(WEBAPP_DIR, "features")
    if os.path.exists(features_dir):
        routes.append(Mount("/app/features", StaticFiles(directory=features_dir), name="features_app"))
        routes.append(Mount("/features", StaticFiles(directory=features_dir), name="features_root"))

    if os.path.exists(WEBAPP_DIR):
        routes.append(Mount("/app/static", StaticFiles(directory=WEBAPP_DIR), name="webapp_static"))

    # 5. Handlers for Health & Webhook
    if health_check_handler:
        routes.append(Route("/health", endpoint=health_check_handler, methods=["GET"]))
    if telegram_webhook_handler:
        routes.append(Route(webhook_path, endpoint=telegram_webhook_handler, methods=["POST"]))

    return routes
