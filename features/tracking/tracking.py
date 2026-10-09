import logging
from starlette.requests import Request
from starlette.responses import JSONResponse

from database import db_track_user, db_get_users


async def api_track_user(request: Request):
    """Logs user visit into PostgreSQL."""
    try:
        data = await request.json()
        user_id = data.get("id")
        username = data.get("username", "")
        first_name = data.get("first_name", "")
        last_name = data.get("last_name", "")

        if not user_id:
            return JSONResponse({"error": "Missing user ID"}, status_code=400)

        db_track_user(
            user_id=user_id,
            username=username,
            first_name=first_name,
            last_name=last_name
        )
        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error tracking user: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_get_users(request: Request):
    """Retrieves logged users from PostgreSQL."""
    try:
        users = db_get_users()
        return JSONResponse({"success": True, "users": users})
    except Exception as e:
        logging.error(f"Error retrieving users: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)
