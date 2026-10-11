import os
import sys
import importlib.util
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles

# webapp/core/ -> webapp/
WEBAPP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CORE_DIR = os.path.join(WEBAPP_DIR, "core")

# Ensure BASE and webapp are in sys.path
BASE_DIR = os.path.abspath(os.path.join(WEBAPP_DIR, ".."))
for p in [BASE_DIR, WEBAPP_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

# 1. Import Index Consolidator
try:
    from webapp.core.index_consolidator import serve_index
except ImportError:
    try:
        from core.index_consolidator import serve_index
    except ImportError:
        from index_consolidator import serve_index

# 2. Dynamic loader for render_status_backend
def load_render_backend():
    # Attempt standard imports first
    try:
        from webapp.features.render_status.render_status_backend import (
            github_webhook_handler,
            render_webhook_handler,
        )
        return github_webhook_handler, render_webhook_handler
    except ImportError:
        pass

    try:
        from features.render_status.render_status_backend import (
            github_webhook_handler,
            render_webhook_handler,
        )
        return github_webhook_handler, render_webhook_handler
    except ImportError:
        pass

    # Fallback: Locate render_status_backend.py directly on disk
    target_filename = "render_status_backend.py"
    target_path = None
    for root, _, files in os.walk(WEBAPP_DIR):
        if target_filename in files:
            target_path = os.path.join(root, target_filename)
            break

    if target_path and os.path.exists(target_path):
        spec = importlib.util.spec_from_file_location("render_status_backend", target_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return getattr(mod, "github_webhook_handler", None), getattr(mod, "render_webhook_handler", None)

    # Fallback dummy handlers if the file has not been pushed yet
    async def dummy_handler(request):
        from starlette.responses import JSONResponse
        return JSONResponse({"status": "backend_module_not_found"}, status_code=500)

    return dummy_handler, dummy_handler

github_webhook_handler, render_webhook_handler = load_render_backend()


def get_all_routes(health_check_handler=None, telegram_webhook_handler=None, webhook_path="/webhook"):
    routes = [
        Route("/app", endpoint=serve_index, methods=["GET"]),
        Mount("/app/core", StaticFiles(directory=CORE_DIR), name="core"),
        Route("/api/github-webhook", endpoint=github_webhook_handler, methods=["POST"]),
        Route("/api/render-webhook", endpoint=render_webhook_handler, methods=["POST"]),
    ]

    features_dir = os.path.join(WEBAPP_DIR, "features")
    modules_dir = os.path.join(WEBAPP_DIR, "modules")
    root_dashboard_dir = os.path.join(WEBAPP_DIR, "dashboard")

    if os.path.exists(features_dir):
        routes.append(Mount("/app/features", StaticFiles(directory=features_dir), name="features"))
    if os.path.exists(modules_dir):
        routes.append(Mount("/app/modules", StaticFiles(directory=modules_dir), name="modules"))
    if os.path.exists(root_dashboard_dir):
        routes.append(Mount("/app/dashboard", StaticFiles(directory=root_dashboard_dir), name="root_dashboard"))

    if health_check_handler:
        routes.append(Route("/health", endpoint=health_check_handler, methods=["GET"]))

    if telegram_webhook_handler:
        routes.append(Route(webhook_path, endpoint=telegram_webhook_handler, methods=["POST"]))

    return routes
