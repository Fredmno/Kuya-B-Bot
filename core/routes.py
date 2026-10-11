from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from webapp.core.index_consolidator import serve_index


def get_all_routes(
    health_check_handler=None,
    telegram_webhook_handler=None,
    webhook_path: str = "/webhook",
    *args,
    **kwargs
) -> list:
    """
    Returns all Starlette routes. Accepts health check, webhook handlers,
    and **kwargs so bot.py can pass its arguments without raising a TypeError.
    """
    routes = [
        # Mini App views & static assets
        Route("/app", serve_index, methods=["GET"]),
        Route("/app/", serve_index, methods=["GET"]),
        Mount("/app", StaticFiles(directory="webapp", html=False), name="app"),
    ]

    # Health check endpoint for uptime pings
    if health_check_handler:
        routes.append(Route("/health", health_check_handler, methods=["GET"]))

    # Telegram webhook endpoint
    if telegram_webhook_handler and webhook_path:
        routes.append(Route(webhook_path, telegram_webhook_handler, methods=["POST"]))

    return routes
