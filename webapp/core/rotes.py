from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from webapp.core.index_consolidator import serve_index

# (Feature routes can be added here one by one once their files exist)


def get_all_routes() -> list:
    """Returns all web and API routes for Starlette."""
    return [
        # Mini App HTML entry points
        Route("/app", serve_index, methods=["GET"]),
        Route("/app/", serve_index, methods=["GET"]),
        # Mount the webapp folder for static assets (css, js, images)
        Mount("/app", StaticFiles(directory="webapp", html=False), name="app"),
    ]
