from starlette.routing import Route
from features.tasks.tasks import (
    api_get_tasks,
    api_save_task,
    api_toggle_task,
    api_delete_task,
)


def get_tasks_routes() -> list[Route]:
    """Returns Starlette HTTP routes for Tasks."""
    return [
        Route("/api/tasks", api_get_tasks, methods=["GET"]),
        Route("/api/tasks", api_save_task, methods=["POST"]),
        Route("/api/tasks/toggle", api_toggle_task, methods=["POST"]),
        Route("/api/tasks/delete", api_delete_task, methods=["POST"]),
    ]
