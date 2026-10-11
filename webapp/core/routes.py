from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from webapp.core.index_consolidator import serve_index


def get_all_routes(
    health_check_handler=None,
    telegram_webhook_handler=None,
    webhook_path: str = "/webhook",
) -> list:
    """Returns all active Starlette routes including webhook and health check."""
    routes = [
        # Mini App views & static files
        Route("/app", serve_index, methods=["GET"]),
        Route("/app/", serve_index, methods=["GET"]),
        Mount("/app", StaticFiles(directory="webapp", html=False), name="app"),
    ]

    # Health check route used by Render/Uvicorn
    if health_check_handler:
        routes.append(Route("/health", health_check_handler, methods=["GET"]))

    # Telegram webhook route
    if telegram_webhook_handler and webhook_path:
        routes.append(Route(webhook_path, telegram_webhook_handler, methods=["POST"]))

    return routes
