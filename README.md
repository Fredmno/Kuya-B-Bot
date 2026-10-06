
# 🤖 Kuya B — Personal Telegram Hub & Assistant

Kuya B is a personal Telegram-based assistant and Mini App dashboard hosted on Render. It bridges structured local/PostgreSQL data with an unlimited content vault powered by a private Telegram channel.

---

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

📁 Repository Structure
Kuya-B-Bot/
├── bot.py                  # Main backend server (Starlette + Bot Webhook)
├── database.py             # PostgreSQL connection & migrations
├── requirements.txt        # Python dependencies
├── features/               # Bot commands & backend handlers
│   ├── BirthDay/           # Birthday database & API endpoints
│   ├── menu.py             # Mini App menu triggers
│   └── word_game.py        # Word Scramble game logic
├── data/
│   └── words.json          # Game dictionary data
└── webapp/                 # Frontend Mini App (Static files served at /app)
    ├── index.html          # Main SPA layout & view sections
    ├── style.css           # Modern dark-mode UI with green accents
    ├── app.js              # Application conductor & view router
    └── modules/            # Modular feature components
        ├── helpers.js      # Telegram WebApp SDK, haptics & sanitization
        ├── birthdays.js    # Birthday tracking & countdown engine
        ├── dailyLogs.js    # Journaling engine with mood selector
        ├── tasks.js        # Personal task manager (done/undone toggles)
        ├── reminders.js    # Time-sensitive reminder tracker
        └── vault.js        # Channel media indexer with folder categorization

🚀 Active Features
👤 Personal Hub
 * 🎂 Birthdays: MM-DD date validation, leap-year support, upcoming countdowns, and automated 7-day highlight badges.
 * 📅 Daily Logs: Journal with mood tracking (😊, ⚡, 😌, 😴, 🌧️) and reverse-chronological timeline.
 * ✅ Tasks: Checklist manager with high/normal/low priority tags and one-tap completion toggles.
 * ⏰ Reminders: Schedule tracking with date, time, and recurrence options (None / Daily / Weekly).
📚 Media & Content Vault
 * 🎥 Videos & 🖼️ Pictures: Browse channel-hosted media filtered by dynamic Folder Pills (e.g., Travel, Family, Receipts).
 * 📥 Send to Bot Chat: Relays channel media directly to your private chat using Telegram's native copy_message without third-party hosting.
🎮 Entertainment
 * 🎮 Word Scramble: Mini-game integration accessible via bot or dashboard.
⚙️ Environment Variables (Render)
| Variable | Description | Example |
|---|---|---|
| BOT_TOKEN | Telegram Bot Token from @BotFather | 123456:ABC-DEF... |
| RENDER_EXTERNAL_URL | Your live Render service URL | https://kuya-b-bot.onrender.com |
| DATABASE_URL | PostgreSQL connection string | postgresql://user:pass@host/db |
| VAULT_CHANNEL_ID | Private vault channel ID (must include -100) | -1002345678901 |
| PORT | Web server listening port | 10000 |
🛠️ Development & Deployment
 * Deploying Updates:
   Pushes to the main branch automatically trigger a deploy on Render.
 * Frontend Cache-Busting:
   When editing files inside webapp/, always bump the query string version in webapp/index.html to bypass Telegram's mobile cache:
   <link rel="stylesheet" href="/app/style.css?v=X"/>
<script type="module" src="/app/app.js?v=X"></script>

 * Telegram Channel Permissions:
   Ensure @KuyaBBot is added as an Administrator in your vault channel with permission to post and read messages.

---

### What to Document Next

To keep everything easy to maintain:
1. **Save this to your `README.md`** in GitHub[span_4](start_span)[span_4](end_span).
2. Create a private note or `.env.example` documenting your exact channel IDs and test account chat IDs so you never lose track of configuration secrets.

Would you like to continue refining the vault error diagnostics next, or move on to **Phase 5: Universal Search**?

