import os
import sys
import importlib.util
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.responses import JSONResponse

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

def load_feature_module(feature_subpath, filename, candidate_names):
    """Loads feature backend handlers with standard import first, then absolute file fallback."""
    mod_name = os.path.splitext(filename)[0]
    import_paths = [
        f"webapp.features.{feature_subpath}.{mod_name}",
        f"features.{feature_subpath}.{mod_name}",
        f"{feature_subpath}.{mod_name}",
    ]
    for imp in import_paths:
        try:
            mod = __import__(imp, fromlist=candidate_names)
            return [getattr(mod, name, None) for name in candidate_names]
        except ImportError:
            pass

    # Direct filesystem fallback
    target_path = os.path.join(WEBAPP_DIR, "features", feature_subpath, filename)
    if os.path.exists(target_path):
        try:
            spec = importlib.util.spec_from_file_location(mod_name, target_path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            return [getattr(mod, name, None) for name in candidate_names]
        except Exception as e:
            print(f"Error loading {target_path}: {e}")

    async def dummy(request):
        return JSONResponse({"error": f"{filename} not loaded", "ok": False}, status_code=404)

    return [dummy for _ in candidate_names]

# Committer endpoints from webapp/features/committer/committer_backend.py
repo_tree_endpoint, file_content_endpoint, commit_file_endpoint = load_feature_module(
    "committer",
    "committer_backend.py",
    ["repo_tree_endpoint", "file_content_endpoint", "commit_file_endpoint"]
)

# Render Status endpoints from webapp/features/render_status/render_status_backend.py
github_webhook_handler, render_webhook_handler, get_deployments_endpoint = load_feature_module(
    "render_status",
    "render_status_backend.py",
    ["github_webhook_handler", "render_webhook_handler", "get_deployments_endpoint"]
)

# Tree endpoints from webapp/features/tree/tree_backend.py
get_tree_endpoint, regenerate_tree_endpoint = load_feature_module(
    "tree",
    "tree_backend.py",
    ["get_tree_endpoint", "regenerate_tree_endpoint"]
)

def get_all_routes(health_check_handler=None, telegram_webhook_handler=None, webhook_path="/webhook"):
    routes = [
        Route("/app", endpoint=serve_index, methods=["GET"]),
        Mount("/app/core", StaticFiles(directory=CORE_DIR), name="core"),

        # Render Deployment & Webhooks
        Route("/api/deployment-history", endpoint=get_deployments_endpoint, methods=["GET"]),
        Route("/api/github-webhook", endpoint=github_webhook_handler, methods=["POST"]),
        Route("/api/render-webhook", endpoint=render_webhook_handler, methods=["POST"]),

        # Committer Endpoints
        Route("/api/repo-tree", endpoint=repo_tree_endpoint, methods=["GET"]),
        Route("/api/file-content", endpoint=file_content_endpoint, methods=["GET"]),
        Route("/api/commit-file", endpoint=commit_file_endpoint, methods=["POST"]),

        # Tree Endpoints
        Route("/api/repo-tree-details", endpoint=get_tree_endpoint, methods=["GET"]),
        Route("/api/regenerate-tree", endpoint=regenerate_tree_endpoint, methods=["POST"]),
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
