import os
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from starlette.requests import Request
from starlette.responses import JSONResponse
from telegram import Update
from telegram.ext import ContextTypes

# Import from independent registry module
from features.registry import get_or_create_registry, update_registry_data

# Import dedicated modular handlers
from features.BirthDay.birthday_add import api_add_birthday, command_add_birthday
from features.BirthDay.birthday_delete import api_delete_birthday

logger = logging.getLogger(__name__)

DEFAULT_GROUP_CHAT_ID = -1002607400749


def _get_target_chat_id():
    cid = os.getenv("GROUP_CHAT_ID") or os.getenv("BULLETIN_CHAT_ID")
    if cid:
        try:
            return int(str(cid).strip())
        except ValueError:
            pass
    return DEFAULT_GROUP_CHAT_ID


# ---------------------------------------------------------
# CHAT MENU HELPER
# ---------------------------------------------------------
async def render_birthdays_table(bot):
    try:
        _, registry = await get_or_create_registry(bot)
        birthdays = registry.get("birthdays", [])

        if not birthdays:
            return "🎂 *Birthdays*\n\nNo birthdays registered yet."

        try:
            tz = ZoneInfo("Asia/Manila")
            today = datetime.now(tz)
        except Exception:
            today = datetime.now()

        current_year = today.year
        items = []

        for b in birthdays:
            name = b.get("name", "Unknown")
            date_str = str(b.get("date", "")).strip()
            try:
                parts = date_str.split("-")
                if len(parts) == 3:
                    month = int(parts[1])
                    day = int(parts[2])
                else:
                    month = int(parts[0])
                    day = int(parts[1])
                bday_date = datetime(current_year, month, day)

                if bday_date.date() < today.date():
                    bday_date = datetime(current_year + 1, month, day)

                days_left = (bday_date.date() - today.date()).days
                items.append({
                    "name": name,
                    "date": f"{month:02d}-{day:02d}",
                    "days_left": days_left
                })
            except Exception:
                items.append({
                    "name": name,
                    "date": date_str,
                    "days_left": 9999
                })

        items.sort(key=lambda x: x["days_left"])

        lines = ["🎂 *Upcoming Birthdays*\n"]
        for it in items[:10]:
            if it["days_left"] == 0:
                badge = "🎉 *TODAY!*"
            elif it["days_left"] == 1:
                badge = "*(Tomorrow)*"
            elif it["days_left"] < 9999:
                badge = f"*(in {it['days_left']} days)*"
            else:
                badge = ""
            lines.append(f"• `{it['date']}` — *{it['name']}* {badge}")

        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Error rendering birthdays table: {e}", exc_info=True)
        return "🎂 *Birthdays*\n\nCould not load birthdays."


# ---------------------------------------------------------
# DAILY SCHEDULED BULLETIN JOB
# ---------------------------------------------------------
async def check_and_send_daily_birthday_greetings(context: ContextTypes.DEFAULT_TYPE):
    """
    Scheduled job running daily at 9:00 AM (Asia/Manila).
    Sends morning birthday greetings to GROUP_CHAT_ID (-1002607400749).
    """
    try:
        bot = context.bot
        _, registry = await get_or_create_registry(bot)
        birthdays = registry.get("birthdays", [])

        try:
            now = datetime.now(ZoneInfo("Asia/Manila"))
        except Exception:
            now = datetime.now()

        target_month = now.month
        target_day = now.day
        target_chat = _get_target_chat_id()

        logger.info(f"[Daily Job] Checking birthdays for {target_month:02d}-{target_day:02d} | Target chat: {target_chat}")

        for b in birthdays:
            name = b.get("name", "Friend")
            raw_date = str(b.get("date", "")).strip()

            is_birthday_today = False
            try:
                parts = raw_date.split("-")
                if len(parts) == 3:
                    m, d = int(parts[1]), int(parts[2])
                else:
                    m, d = int(parts[0]), int(parts[1])
                if m == target_month and d == target_day:
                    is_birthday_today = True
            except Exception:
                if raw_date == now.strftime("%m-%d"):
                    is_birthday_today = True

            if is_birthday_today:
                logger.info(f"Sending morning birthday greeting for {name} to {target_chat}")
                greeting_text = (
                    f"🎉🎂 **Happy Birthday, {name}!** 🎂🎉\n\n"
                    "Wishing you good health, endless happiness, and many blessings ahead on your special day! ✨\n\n"
                    "— *Kuya B Bulletin*"
                )
                try:
                    await bot.send_message(
                        chat_id=target_chat,
                        text=greeting_text,
                        parse_mode="Markdown"
                    )
                except Exception as send_err:
                    logger.error(f"Failed to dispatch birthday message to chat {target_chat}: {send_err}")

    except Exception as e:
        logger.error(f"check_and_send_daily_birthday_greetings fatal error: {e}", exc_info=True)


# ---------------------------------------------------------
# BOT COMMAND FOR MANUAL TRIGGER & TESTING
# ---------------------------------------------------------
async def command_trigger_bulletin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Manually triggers the daily bulletin check via Telegram (/trigger_greetings)"""
    await update.message.reply_text("⏳ Running birthday greetings check...")
    await check_and_send_daily_birthday_greetings(context)
    await update.message.reply_text("✅ Check complete!")


# ---------------------------------------------------------
# GET & EDIT REST API ENDPOINTS
# ---------------------------------------------------------
async def api_get_birthdays(request: Request):
    try:
        bot = request.app.state.telegram_app.bot
        _, registry = await get_or_create_registry(bot)
        birthdays = registry.get("birthdays", [])
        return JSONResponse({"success": True, "birthdays": birthdays})
    except Exception as e:
        logger.error(f"api_get_birthdays error: {e}", exc_info=True)
        return JSONResponse({"error": str(e), "birthdays": []}, status_code=500)


async def api_edit_birthday(request: Request):
    try:
        data = await request.json()
        bday_id = str(data.get("id", "")).strip()
        name = str(data.get("name", "")).strip()
        date_raw = str(data.get("date", "")).strip()

        if not bday_id or not name or not date_raw:
            return JSONResponse({"error": "ID, name, and date are required"}, status_code=400)

        parts = date_raw.split("-")
        if len(parts) == 3:
            formatted_date = f"{int(parts[1]):02d}-{int(parts[2]):02d}"
        elif len(parts) == 2:
            formatted_date = f"{int(parts[0]):02d}-{int(parts[1]):02d}"
        else:
            formatted_date = date_raw

        bot = request.app.state.telegram_app.bot
        msg_id, registry = await get_or_create_registry(bot)
        birthdays = registry.get("birthdays", [])

        found = False
        for b in birthdays:
            if str(b.get("id")) == bday_id:
                b["name"] = name
                b["date"] = formatted_date
                found = True
                break

        if not found:
            return JSONResponse({"error": "Birthday not found"}, status_code=404)

        saved = await update_registry_data(msg_id, registry, bot)
        if not saved:
            return JSONResponse({"error": "Failed to persist birthday update"}, status_code=500)

        return JSONResponse({"success": True})
    except Exception as e:
        logger.error(f"api_edit_birthday error: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)
