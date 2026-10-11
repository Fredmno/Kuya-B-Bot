import os
import sys
import importlib.util
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles

WEBAPP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CORE_DIR = os.path.join(WEBAPP_DIR, "core")

BASE_DIR = os.path.abspath(os.path.join(WEBAPP_DIR, ".."))
for p in [BASE_DIR, WEBAPP_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from webapp.core.index_consolidator import serve_index
except ImportError:
    try:
        from core.index_consolidator import serve_index
    except ImportError:
        from index_consolidator import serve_index

def load_render_backend():
    try:
        from webapp.features.render_status.render_status_backend import (
            github_webhook_handler,
            render_webhook_handler,
            get_deployments_endpoint,
        )
        return github_webhook_handler, render_webhook_handler, get_deployments_endpoint
    except ImportError:
        pass

    try:
        from features.render_status.render_status_backend import (
            github_webhook_handler,
            render_webhook_handler,
            get_deployments_endpoint,
        )
        return github_webhook_handler, render_webhook_handler, get_deployments_endpoint
    except ImportError:
        pass

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
        return (
            getattr(mod, "github_webhook_handler", None),
            getattr(mod, "render_webhook_handler", None),
            getattr(mod, "get_deployments_endpoint", None),
        )

    async def dummy_handler(request):
        from starlette.responses import JSONResponse
        return JSONResponse({"deployments": []})

    return dummy_handler, dummy_handler, dummy_handler

github_webhook_handler, render_webhook_handler, get_deployments_endpoint = load_render_backend()

def get_all_routes(health_check_handler=None, telegram_webhook_handler=None, webhook_path="/webhook"):
    routes = [
        Route("/app", endpoint=serve_index, methods=["GET"]),
        Mount("/app/core", StaticFiles(directory=CORE_DIR), name="core"),

        # Render & deployment webhooks/API
        Route("/api/deployment-history", endpoint=get_deployments_endpoint, methods=["GET"]),
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
