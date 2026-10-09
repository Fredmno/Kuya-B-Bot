import os

# Automatic cache-busting versioning:
# Uses Render's git commit hash if available, otherwise falls back to a dev timestamp
APP_VERSION = os.getenv("RENDER_GIT_COMMIT", "dev")[:7]

BOT_TOKEN = os.getenv("BOT_TOKEN")
RENDER_EXTERNAL_URL = os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")
PORT = int(os.getenv("PORT", 10000))

VAULT_CHANNEL_ID = os.getenv("VAULT_CHANNEL_ID")
GROUP_CHAT_ID = os.getenv("GROUP_CHAT_ID")
ADMIN_USER_ID = os.getenv("ADMIN_USER_ID")

WEBHOOK_PATH = "/telegram"
WEBHOOK_URL = f"{RENDER_EXTERNAL_URL}{WEBHOOK_PATH}"


def get_vault_chat_id():
    vault_id = os.getenv("VAULT_CHANNEL_ID", "")
    if vault_id.startswith("-") or vault_id.isdigit():
        return int(vault_id)
    return vault_id
