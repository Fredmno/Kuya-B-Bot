import os

# Automatic cache-busting versioning:
# Uses Render's git commit hash if available, otherwise falls back to a dev timestamp

import os
import time

# --- DYNAMIC APP VERSION ---
# 1. Check if Render provided the commit hash
git_commit = os.getenv("RENDER_GIT_COMMIT")

if git_commit:
    # Use the first 7 characters of the Git commit SHA (e.g., 'va558f1')
    APP_VERSION = f"v{git_commit[:7]}"
else:
    # Fallback for local development or environments without Git info
    # Generates a timestamp-based version on server start
    APP_VERSION = f"v{int(time.time())}"


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
