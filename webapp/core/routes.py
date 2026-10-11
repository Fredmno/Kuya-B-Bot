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

def load_backend_module(filename, candidates):
    target_path = None
    for root, _, files in os.walk(WEBAPP_DIR):
        if filename in files:
            target_path = os.path.join(root, filename)
            break

    if target_path and os.path.exists(target_path):
        mod_name = os.path.splitext(filename)[0]
        spec = importlib.util.spec_from_file_location(mod_name, target_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return [getattr(mod, name, None) for name in candidates]

    async def dummy_endpoint(request):
        from starlette.responses import JSONResponse
        return JSONResponse({"error": "Module not configured"}, status_code=404)

    return [dummy_endpoint for _ in candidates]

# Load Render & Committer handlers dynamically
github_webhook_handler, render_webhook_handler, get_deployments_endpoint = load_backend_module(
    "render_status_backend.py",
    ["github_webhook_handler", "render_webhook_handler", "get_deployments_endpoint"]
)

repo_tree_endpoint, file_content_endpoint, commit_file_endpoint = load_backend_module(
    "committer_backend.py",
    ["repo_tree_endpoint", "file_content_endpoint", "commit_file_endpoint"]
)

def get_all_routes(health_check_handler=None, telegram_webhook_handler=None, webhook_path="/webhook"):
    routes = [
        Route("/app", endpoint=serve_index, methods=["GET"]),
        Mount("/app/core", StaticFiles(directory=CORE_DIR), name="core"),

        # Render Deploy History & Webhooks
        Route("/api/deployment-history", endpoint=get_deployments_endpoint, methods=["GET"]),
        Route("/api/github-webhook", endpoint=github_webhook_handler, methods=["POST"]),
        Route("/api/render-webhook", endpoint=render_webhook_handler, methods=["POST"]),

        # Committer Endpoints
        Route("/api/repo-tree", endpoint=repo_tree_endpoint, methods=["GET"]),
        Route("/api/file-content", endpoint=file_content_endpoint, methods=["GET"]),
        Route("/api/commit-file", endpoint=commit_file_endpoint, methods=["POST"]),
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
