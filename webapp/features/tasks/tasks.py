import json
import logging
from starlette.requests import Request
from starlette.responses import JSONResponse
from features.registry import get_or_create_registry, update_registry_data

logger = logging.getLogger(__name__)

REGISTRY_KEY = "tasks_vault"


def _get_tasks_data() -> list:
    reg = get_or_create_registry(REGISTRY_KEY, default_value=[])
    data = reg.get("data", [])
    if isinstance(data, str):
        try:
            return json.loads(data)
        except Exception:
            return []
    return data or []


async def api_get_tasks(request: Request):
    """Returns all tasks or tasks filtered by folder."""
    folder = request.query_params.get("folder")
    tasks = _get_tasks_data()

    if folder:
        filtered = [t for t in tasks if t.get("folder", "General").lower() == folder.lower()]
        return JSONResponse({"success": True, "tasks": filtered})

    folder_counts = {}
    for t in tasks:
        f_name = t.get("folder", "General") or "General"
        folder_counts[f_name] = folder_counts.get(f_name, 0) + 1

    folders = [{"name": name, "count": count} for name, count in folder_counts.items()]
    return JSONResponse({"success": True, "folders": folders, "tasks": tasks})


async def api_save_task(request: Request):
    """Adds a new task inside a specific folder."""
    try:
        data = await request.json()
        title = (data.get("title") or "").strip()
        folder = (data.get("folder") or "General").strip() or "General"

        if not title:
            return JSONResponse({"success": False, "error": "Task title is required"}, status_code=400)

        tasks = _get_tasks_data()
        new_task = {
            "id": f"task_{len(tasks) + 1}_{id(title)}",
            "title": title,
            "folder": folder,
            "completed": False,
        }
        tasks.insert(0, new_task)
        update_registry_data(REGISTRY_KEY, tasks)

        return JSONResponse({"success": True, "task": new_task})
    except Exception as e:
        logger.error(f"Error saving task: {e}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def api_toggle_task(request: Request):
    """Toggles task completed status."""
    try:
        data = await request.json()
        task_id = data.get("id")
        tasks = _get_tasks_data()

        found = False
        for t in tasks:
            if t.get("id") == task_id:
                t["completed"] = not t.get("completed", False)
                found = True
                break

        if not found:
            return JSONResponse({"success": False, "error": "Task not found"}, status_code=404)

        update_registry_data(REGISTRY_KEY, tasks)
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


async def api_delete_task(request: Request):
    """Deletes a task by ID."""
    try:
        data = await request.json()
        task_id = data.get("id")
        tasks = _get_tasks_data()

        new_tasks = [t for t in tasks if t.get("id") != task_id]
        update_registry_data(REGISTRY_KEY, new_tasks)

        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
