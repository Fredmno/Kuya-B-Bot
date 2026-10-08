import os
import logging
from starlette.requests import Request
from starlette.responses import JSONResponse

ADMIN_USER_ID = os.getenv("ADMIN_USER_ID")

async def api_track_user(request: Request):
    try:
        data = await request.json()
        user_id = str(data.get("id"))
        first_name = data.get("first_name", "Unknown")
        username = data.get("username", "N/A")
        timestamp = data.get("timestamp", "")

        if not user_id:
            return JSONResponse({"error": "No user ID"}, status_code=400)

        from bot import get_or_create_registry, save_registry
        reg, p_msg_id = await get_or_create_registry()
        users_list = reg.get("users", [])

        found = False
        for u in users_list:
            if str(u.get("id")) == user_id:
                u["first_name"] = first_name
                u["username"] = username
                u["last_seen"] = timestamp
                u["visits"] = u.get("visits", 1) + 1
                found = True
                break

        if not found:
            users_list.insert(0, {
                "id": user_id,
                "first_name": first_name,
                "username": username,
                "last_seen": timestamp,
                "visits": 1
            })

        reg["users"] = users_list
        await save_registry(reg, p_msg_id)

        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error tracking user: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)

async def api_get_users(request: Request):
    req_user_id = request.query_params.get("user_id")
    if ADMIN_USER_ID and str(req_user_id) != str(ADMIN_USER_ID):
        return JSONResponse({"success": False, "error": "Unauthorized"}, status_code=403)

    from bot import get_or_create_registry
    reg, _ = await get_or_create_registry()
    return JSONResponse({"success": True, "users": reg.get("users", [])})
