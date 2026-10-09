import os
import json
import random
import logging
from datetime import datetime
import httpx
from starlette.requests import Request
from starlette.responses import JSONResponse
from telegram import Update
from telegram.ext import ContextTypes

LUCKY_COLORS = [
    "Emerald Green", "Royal Blue", "Golden Yellow", "Crimson Red",
    "Lavender", "Coral Peach", "Deep Violet", "Silver Slate", "Teal", "Rose Gold"
]

DAILY_REMINDERS = [
    "💧 Drink at least 2L of water today — keep a bottle nearby.",
    "🏃 Take a 15-minute walk or stretch break away from screens.",
    "📖 Spend 10–20 minutes reading or learning something new.",
    "🧘 Take three deep breaths whenever things feel rushed.",
    "🥗 Fuel your body with nutritious food today.",
    "💻 Block out 45 minutes for focused, uninterrupted deep work.",
    "✨ Be proud of how far you've come. Take things one step at a time."
]


def get_vault_chat_id():
    vault_id = os.getenv("VAULT_CHANNEL_ID", "")
    if vault_id.startswith("-") or vault_id.isdigit():
        return int(vault_id)
    return vault_id


# ---------------------------------------------------------
# DATE LOGIC & TABLE FORMATTING (MODULAR HELPERS)
# ---------------------------------------------------------
def calculate_days_until(date_str: str) -> int:
    """Calculates days remaining until upcoming birthday (MM-DD)."""
    try:
        parts = date_str.split("-")
        month = int(parts[0])
        day = int(parts[1])
        now = datetime.now()
        today = datetime(now.year, now.month, now.day)

        target = datetime(now.year, month, day)
        if target < today:
            target = datetime(now.year + 1, month, day)

        return (target - today).days
    except Exception:
        return 999


def render_birthdays_table(birthdays: list) -> str:
    """Builds and returns the monochrome ASCII table for birthdays with header."""
    header = "🎂 **BIRTHDAY LIST**\n\n"

    if not birthdays:
        return (
            header +
            "```\n"
            "+-------+--------------------+\n"
            "| DATE  | NAME               |\n"
            "+-------+--------------------+\n"
            "| --    | No entries found   |\n"
            "+-------+--------------------+\n"
            "```"
        )

    # Sort chronologically by upcoming date
    sorted_bdays = sorted(birthdays, key=lambda b: calculate_days_until(b.get("date", "")))

    table_rows = [
        "+-------+--------------------+",
        "| DATE  | NAME               |",
        "+-------+--------------------+"
    ]

    for b in sorted_bdays:
        b_date = (b.get("date") or "MM-DD")[:5].ljust(5)
        # Truncate to 18 chars to ensure table alignment
        name = (b.get("name") or "Unknown")[:18].ljust(18)
        table_rows.append(f"| {b_date} | {name} |")

    table_rows.append("+-------+--------------------+")
    return header + "```\n" + "\n".join(table_rows) + "\n```"



# ---------------------------------------------------------
# CHAT COMMAND: /bday
# ---------------------------------------------------------
async def command_add_birthday(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Command: /bday Name MM-DD"""
    if not context.args or len(context.args) < 2:
        await update.message.reply_text(
            "Usage: `/bday <Name> <MM-DD>`\nExample: `/bday Maria 10-25`",
            parse_mode="Markdown"
        )
        return

    name = " ".join(context.args[:-1]).strip()
    date_str = context.args[-1].strip()

    channel_id = get_vault_chat_id()
    if not channel_id:
        await update.message.reply_text("VAULT_CHANNEL_ID not set.")
        return

    metadata_json = json.dumps({"name": name, "date": date_str})
    msg_text = (
        f"🎂 **BIRTHDAY ENTRY**\n"
        f"**Name:** {name}\n"
        f"**Date:** {date_str}\n\n"
        f"`#BIRTHDAY:{metadata_json}`"
    )

    from bot import application, get_or_create_registry, save_registry

    try:
        sent = await application.bot.send_message(
            chat_id=channel_id,
            text=msg_text,
            parse_mode="Markdown"
        )

        reg, p_id = await get_or_create_registry()
        b_list = reg.get("birthdays", [])
        b_list.append({"id": str(sent.message_id), "name": name, "date": date_str})
        reg["birthdays"] = b_list
        await save_registry(reg, p_id)

        await update.message.reply_text(
            f"✅ Added birthday for **{name}** on `{date_str}`!",
            parse_mode="Markdown"
        )
    except Exception as e:
        logging.error(f"Error adding birthday via chat command: {e}")
        await update.message.reply_text(f"❌ Failed to record birthday: {e}")


# ---------------------------------------------------------
# AUTOMATED SCHEDULED MORNING BULLETIN
# ---------------------------------------------------------
async def fetch_weather_summary(lat: float = 14.4297, lon: float = 120.9367) -> str:
    """Fetches real-time weather via open-meteo (defaults to Cavite / Manila coords)."""
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,weather_code"
        )
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json().get("current", {})
                temp = data.get("temperature_2m")
                humidity = data.get("relative_humidity_2m")
                return f"{temp}°C • Humidity {humidity}%"
    except Exception as e:
        logging.warning(f"Could not fetch weather: {e}")
    return "Fair & Pleasant"


async def check_and_send_daily_birthday_greetings(context: ContextTypes.DEFAULT_TYPE):
    """Scheduled task running at 9:00 AM Manila to send daily bulletin."""
    group_chat_id = os.getenv("GROUP_CHAT_ID")
    if not group_chat_id:
        logging.warning("GROUP_CHAT_ID is not configured. Skipping morning bulletin.")
        return

    try:
        from bot import get_or_create_registry
        reg, _ = await get_or_create_registry()
        birthdays = reg.get("birthdays", [])

        # Match today's celebrants (MM-DD)
        today_str = datetime.now().strftime("%m-%d")
        celebrants = [b["name"] for b in birthdays if b.get("date") == today_str]

        weather_text = await fetch_weather_summary()
        lucky_number = random.randint(1, 99)
        lucky_color = random.choice(LUCKY_COLORS)
        reminder = random.choice(DAILY_REMINDERS)

        birthday_section = ""
        if celebrants:
            names = ", ".join(celebrants)
            birthday_section = (
                f"🎂 **TODAY'S BIRTHDAY CELEBRANT:**\n"
                f"🎉 Happy Birthday, **{names}**! Wishing you blessings, health, and happiness! 🥳\n\n"
            )

        morning_message = (
            f"☀️ **GOOD MORNING!** ☀️\n\n"
            f"{birthday_section}"
            f"🌤️ **Weather Today:** {weather_text}\n"
            f"🍀 **Lucky Number:** `{lucky_number}`\n"
            f"🎨 **Lucky Color:** {lucky_color}\n\n"
            f"💡 **Daily Reminder:**\n{reminder}\n\n"
            f"— *Kuya B Hub*"
        )

        chat_target = int(group_chat_id) if group_chat_id.startswith("-") or group_chat_id.isdigit() else group_chat_id

        await context.bot.send_message(
            chat_id=chat_target,
            text=morning_message,
            parse_mode="Markdown"
        )
        logging.info("Sent daily morning bulletin successfully.")
    except Exception as e:
        logging.error(f"Error in morning bulletin job: {e}", exc_info=True)


# ---------------------------------------------------------
# BIRTHDAYS REST API ENDPOINTS
# ---------------------------------------------------------
async def api_get_birthdays(request: Request):
    from bot import get_or_create_registry
    reg, _ = await get_or_create_registry()
    return JSONResponse({"success": True, "birthdays": reg.get("birthdays", [])})


async def api_add_birthday(request: Request):
    try:
        data = await request.json()
        name = data.get("name", "").strip()
        date_str = data.get("date", "").strip()

        if not name or not date_str:
            return JSONResponse({"error": "Name and date are required"}, status_code=400)

        channel_id = get_vault_chat_id()
        if not channel_id:
            return JSONResponse({"error": "VAULT_CHANNEL_ID not set"}, status_code=500)

        metadata_json = json.dumps({"name": name, "date": date_str})
        message_text = (
            f"🎂 **BIRTHDAY ENTRY**\n"
            f"**Name:** {name}\n"
            f"**Date:** {date_str}\n\n"
            f"`#BIRTHDAY:{metadata_json}`"
        )

        from bot import application, get_or_create_registry, save_registry
        sent_msg = await application.bot.send_message(
            chat_id=channel_id,
            text=message_text,
            parse_mode="Markdown"
        )

        item = {
            "id": str(sent_msg.message_id),
            "name": name,
            "date": date_str
        }

        reg, msg_id = await get_or_create_registry()
        b_list = reg.get("birthdays", [])
        b_list.append(item)
        reg["birthdays"] = b_list
        await save_registry(reg, msg_id)

        return JSONResponse({"success": True, "birthday": item})
    except Exception as e:
        logging.error(f"Error saving birthday to vault: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_edit_birthday(request: Request):
    try:
        data = await request.json()
        msg_id = data.get("id")
        name = data.get("name", "").strip()
        date_str = data.get("date", "").strip()

        channel_id = get_vault_chat_id()
        metadata_json = json.dumps({"name": name, "date": date_str})
        new_text = (
            f"🎂 **BIRTHDAY ENTRY**\n"
            f"**Name:** {name}\n"
            f"**Date:** {date_str}\n\n"
            f"`#BIRTHDAY:{metadata_json}`"
        )

        from bot import application, get_or_create_registry, save_registry
        await application.bot.edit_message_text(
            chat_id=channel_id,
            message_id=int(msg_id),
            text=new_text,
            parse_mode="Markdown"
        )

        reg, p_msg_id = await get_or_create_registry()
        for b in reg.get("birthdays", []):
            if str(b.get("id")) == str(msg_id):
                b["name"] = name
                b["date"] = date_str
                break
        await save_registry(reg, p_msg_id)

        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error editing birthday in vault: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


async def api_delete_birthday(request: Request):
    try:
        data = await request.json()
        msg_id = data.get("id")
        if not msg_id:
            return JSONResponse({"error": "Missing birthday ID"}, status_code=400)

        channel_id = get_vault_chat_id()
        from bot import application, get_or_create_registry, save_registry
        try:
            await application.bot.delete_message(chat_id=channel_id, message_id=int(msg_id))
        except Exception as bot_err:
            logging.warning(f"Could not delete message {msg_id}: {bot_err}")

        reg, p_msg_id = await get_or_create_registry()
        reg["birthdays"] = [b for b in reg.get("birthdays", []) if str(b.get("id")) != str(msg_id)]
        await save_registry(reg, p_msg_id)

        return JSONResponse({"success": True})
    except Exception as e:
        logging.error(f"Error deleting birthday from vault: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)
