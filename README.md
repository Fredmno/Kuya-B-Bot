
# 🤖 Kuya B — Personal Telegram Hub & Assistant

Kuya B is a personal Telegram-based assistant and Mini App dashboard hosted on Render. It bridges structured local/PostgreSQL data with an unlimited content vault powered by a private Telegram channel.

## 🏗️ Architecture Overview

```text
                 TELEGRAM
                    │
                    ▼
              ┌───────────┐
              │  KUYA B   │  (Python / Starlette / PTB)
              │   BOT     │
              └─────┬─────┘
                    │
                    ▼
             ┌─────────────┐
             │ MINI APP    │  (HTML5 / CSS3 / ES Modules)
             │ DASHBOARD   │
             └──────┬──────┘
                    │
       ┌────────────┴────────────┐
       ▼                         ▼
  PostgreSQL              Telegram Channel
 (Structured Data)        (Media Vault: Videos/Photos)
```

## 📁 Repository Structure

```text
Kuya-B-Bot/
├── bot.py                  # Main backend server (Starlette + Bot Webhook)
├── core/                   # Shared Telegram command handlers
├── database.py             # PostgreSQL connection & migrations
├── requirements.txt        # Python dependencies
├── features/               # Backend feature modules and bot commands
│   ├── BirthDay/
│   ├── daily_logs/
│   ├── tasks/
│   ├── vault/
│   └── word_game.py
├── data/
│   └── words.json          # Game dictionary data
└── webapp/                 # Frontend Mini App (Static files served at /app)
    ├── index.html          # Current static entry point
    ├── core/routes/        # Modular API route handlers and registry
    │   ├── __init__.py     # get_all_routes() registry
    │   ├── routes_github_form.py
    │   └── routes_deployments.py
    ├── features/           # Admin and Mini App feature assets
    └── modules/            # Older JavaScript feature modules
```

The current `webapp/index.html` loads the admin panel script; the older `webapp/app.js` and `webapp/modules/` files are not loaded by that entry point. They are left in place because other legacy views refer to the module APIs.

## 🚀 Feature Modules

```text
👤 Personal Hub
 * 🎂 Birthdays: MM-DD date validation, leap-year support, upcoming countdowns, and automated 7-day highlight badges.
 * 📅 Daily Logs: Journal with mood tracking (😊, ⚡, 😌, 😴, 🌧️) and reverse-chronological timeline.
 * ✅ Tasks: Checklist manager with high/normal/low priority tags and one-tap completion toggles.
 * ⏰ Reminders: Schedule tracking with date, time, and recurrence options (None / Daily / Weekly).
```

## 📚 Media & Content Vault

```text
 * 🎥 Videos & 🖼️ Pictures: Browse channel-hosted media filtered by dynamic Folder Pills (e.g., Travel, Family, Receipts).
 * 📥 Send to Bot Chat: Relays channel media directly to your private chat using Telegram's native copy_message without third-party hosting.
🎮 Entertainment
 * 🎮 Word Scramble: Mini-game integration accessible via bot or dashboard.
```

## ⚙️ Environment Variables (Render)

| Variable | Description | Example |
|---|---|---|
| BOT_TOKEN | Telegram Bot Token from @BotFather | 123456:ABC-DEF... |
| RENDER_EXTERNAL_URL | Your live Render service URL | https://kuya-b-bot.onrender.com |
| DATABASE_URL | PostgreSQL connection string | postgresql://user:pass@host/db |
| VAULT_CHANNEL_ID | Private vault channel ID (must include -100) | -1002345678901 |
| PORT | Web server listening port | 10000 |

## 🛠️ Development & Deployment

 * Deploying Updates:
   Pushes to the main branch automatically trigger a deploy on Render.
 * Frontend Cache-Busting:
   When editing a web asset loaded by webapp/index.html, bump that asset's query-string version in the entry point to bypass Telegram's mobile cache.

 * Telegram Channel Permissions:
   Ensure @KuyaBBot is added as an Administrator in your vault channel with permission to post and read messages.

