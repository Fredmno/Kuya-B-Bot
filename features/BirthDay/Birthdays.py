import json
import re

from starlette.requests import Request
from starlette.responses import JSONResponse

from database import get_birthdays, add_birthday, delete_birthday


DEFAULT_CHAT_ID = "mini_app_default"


def is_valid_mmdd(value):
    return bool(re.match(r"^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$", value))


async def api_get_birthdays(request: Request):
    chat_id = request.query_params.get("chat_id", DEFAULT_CHAT_ID)

    birthdays = get_birthdays(chat_id)

    return JSONResponse(
        {
            "success": True,
            "birthdays": birthdays,
        }
    )


async def api_add_birthday(request: Request):
    try:
        payload = await request.json()
    except Exception:
        return JSONResponse(
            {
                "success": False,
                "error": "Invalid JSON payload.",
            },
            status_code=400,
        )

    chat_id = payload.get("chat_id", DEFAULT_CHAT_ID)
    name = payload.get("name", "").strip()
    birthday_mmdd = payload.get("birthday_mmdd", "").strip()
    added_by_user_id = str(payload.get("added_by_user_id", ""))
    added_by_name = payload.get("added_by_name", "Mini App User")

    if not name:
        return JSONResponse(
            {
                "success": False,
                "error": "Name is required.",
            },
            status_code=400,
        )

    if not birthday_mmdd:
        return JSONResponse(
            {
                "success": False,
                "error": "Birthday is required.",
            },
            status_code=400,
        )

    if not is_valid_mmdd(birthday_mmdd):
        return JSONResponse(
            {
                "success": False,
                "error": "Birthday must use MM-DD format. Example: 06-28",
            },
            status_code=400,
        )

    birthday = add_birthday(
        chat_id=chat_id,
        name=name,
        birthday_mmdd=birthday_mmdd,
        added_by_user_id=added_by_user_id,
        added_by_name=added_by_name,
    )

    return JSONResponse(
        {
            "success": True,
            "birthday": birthday,
        }
    )


async def api_delete_birthday(request: Request):
    try:
        payload = await request.json()
    except Exception:
        return JSONResponse(
            {
                "success": False,
                "error": "Invalid JSON payload.",
            },
            status_code=400,
        )

    chat_id = payload.get("chat_id", DEFAULT_CHAT_ID)
    birthday_id = payload.get("id")

    if not birthday_id:
        return JSONResponse(
            {
                "success": False,
                "error": "Birthday ID is required.",
            },
            status_code=400,
        )

    deleted_count = delete_birthday(chat_id, birthday_id)

    return JSONResponse(
        {
            "success": True,
            "deleted_count": deleted_count,
        }
    )
