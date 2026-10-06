/* =========================================================
   KUYA B — PERSONAL HUB (COMPLETE ENGINE)
   ========================================================= */

// ---------------------------------------------------------
// TELEGRAM HELPERS & HAPTICS
// ---------------------------------------------------------
const tg = /* =========================================================
   KUYA B — PERSONAL HUB (RELIABLE STANDALONE ENGINE)
   ========================================================= */

const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

function triggerHaptic(style = "light") {
    try {
        if (tg?.HapticFeedback) {
            if (style === "light" || style === "medium" || style === "heavy") {
                tg.HapticFeedback.impactOccurred(style);
            } else if (style === "success" || style === "error" || style === "warning") {
                tg.HapticFeedback.notificationOccurred(style);
            }
        }
    } catch (e) {}
}

function showToast(message) {
    let toast = document.getElementById("toastNotification");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toastNotification";
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 2800);
}

// Data store
let birthdays = [];
let dailyLogs = [];
let tasks = [];
let reminders = [];
let vaultItems = [];
let currentVaultType = "other";

function loadData() {
    try { birthdays = JSON.parse(localStorage.getItem("kuyaB_birthdays")) || []; } catch (e) { birthdays = []; }
    try { dailyLogs = JSON.parse(localStorage.getItem("kuyaB_dailyLogs")) || []; } catch (e) { dailyLogs = []; }
    try { tasks = JSON.parse(localStorage.getItem("kuyaB_tasks")) || []; } catch (e) { tasks = []; }
    try { reminders = JSON.parse(localStorage.getItem("kuyaB_reminders")) || []; } catch (e) { reminders = []; }
    try { vaultItems = JSON.parse(localStorage.getItem("kuyaB_vault")) || []; } catch (e) { vaultItems = []; }
}

const ALL_PAGES = [
    "dashboardPage",
    "birthdaysPage",
    "dailyLogsPage",
    "tasksPage",
    "remindersPage",
    "vaultPage"
];

function hideAllForms() {
    ["birthdayForm", "logForm", "taskForm", "reminderForm", "vaultItemForm"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
}

function hideAllPages() {
    ALL_PAGES.forEach(id => {
        const page = document.getElementById(id);
        if (page) page.style.display = "none";
    });
    hideAllForms();
}

function showDashboard() {
    hideAllPages();
    const dashboard = document.getElementById("dashboardPage");
    if (dashboard) dashboard.style.display = "block";

    if (tg?.BackButton) {
        tg.BackButton.hide();
    }
}

function showPage(pageId, renderFn) {
    hideAllPages();
    const page = document.getElementById(pageId);
    if (page) page.style.display = "block";

    if (typeof renderFn === "function") {
        renderFn();
    }

    if (tg?.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(showDashboard);
    }
}

// ---------------------------------------------------------
// BIRTHDAYS LOGIC
// ---------------------------------------------------------
function calculateDaysLeft(dateStr) {
    if (!dateStr || !dateStr.includes("-")) return 999;
    const [month, day] = dateStr.split("-").map(Number);
    const today = new Date();
    const currentYear = today.getFullYear();

    let next = new Date(currentYear, month - 1, day);
    if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        next = new Date(currentYear + 1, month - 1, day);
    }

    const diff = next - new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function displayBirthdays() {
    const list = document.getElementById("birthdaysList");
    if (!list) return;

    if (birthdays.length === 0) {
        list.innerHTML = '<p class="empty-state">No birthdays saved yet. Tap + to add one!</p>';
        return;
    }

    const sorted = [...birthdays].sort((a, b) => calculateDaysLeft(a.date) - calculateDaysLeft(b.date));

    list.innerHTML = sorted.map(b => {
        const daysLeft = calculateDaysLeft(b.date);
        let badge = `<span class="bday-badge">${daysLeft} days left</span>`;
        let greetButtonHtml = "";

        if (daysLeft === 0) {
            badge = '<span class="bday-badge today">🎉 Today!</span>';
            // Only show Greet button if the birthday is TODAY
            greetButtonHtml = `<button class="btn-greet" data-name="${b.name}">📢 Greet</button>`;
        } else if (daysLeft === 1) {
            badge = '<span class="bday-badge">Tomorrow</span>';
        }

        return `
            <div class="birthday-card" data-id="${b.id}">
                <div class="birthday-info">
                    <div class="birthday-title-row">
                        <span class="birthday-name">${b.name}</span>
                        ${badge}
                    </div>
                    <span class="birthday-date">📅 ${b.date}</span>
                </div>
                <div class="birthday-actions">
                    ${greetButtonHtml}
                    <button class="btn-delete" data-type="birthday" data-id="${b.id}">🗑️</button>
                </div>
            </div>
        `;
    }).join("");
}

function saveBirthday() {
    const nameEl = document.getElementById("birthdayName");
    const dateEl = document.getElementById("birthdayDate");
    const name = nameEl?.value.trim();
    const date = dateEl?.value.trim();

    if (!name || !date) {
        alert("Please enter both a name and date (MM-DD).");
        return;
    }

    birthdays.push({ id: Date.now().toString(), name, date });
    localStorage.setItem("kuyaB_birthdays", JSON.stringify(birthdays));
    triggerHaptic("medium");

    nameEl.value = "";
    dateEl.value = "";
    document.getElementById("birthdayForm").style.display = "none";
    displayBirthdays();
}

async function sendGreetingToChat(name) {
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get("chat_id");

    if (!chatId) {
        showToast("Open via /kuyab inside a group chat to send greetings!");
        return;
    }

    triggerHaptic("medium");
    try {
        const res = await fetch("/api/birthdays/greet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, name: name })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Greeting sent for ${name}! 🎉`);
        } else {
            showToast("Failed to send greeting.");
        }
    } catch (e) {
        showToast("Network error.");
    }
}

// ---------------------------------------------------------
// DAILY LOGS LOGIC
// ---------------------------------------------------------
function displayDailyLogs() {
    const list = document.getElementById("dailyLogsList");
    if (!list) return;

    if (dailyLogs.length === 0) {
        list.innerHTML = '<p class="empty-state">No daily logs saved yet. Tap + to add one!</p>';
        return;
    }

    list.innerHTML = dailyLogs.map(l => `
        <div class="birthday-card" data-id="${l.id}">
            <div class="birthday-info">
                <span class="birthday-name">${l.title}</span>
                <span class="birthday-date">${l.content || ""}</span>
            </div>
            <div class="birthday-actions">
                <button class="btn-delete" data-type="log" data-id="${l.id}">🗑️️</button>
            </div>
        </div>
    `).join("");
}

function saveLog() {
    const title = document.getElementById("logTitle")?.value.trim();
    const content = document.getElementById("logContent")?.value.trim();

    if (!title) {
        alert("Please enter a title or summary.");
        return;
    }

    dailyLogs.unshift({ id: Date.now().toString(), title, content, date: new Date().toLocaleDateString() });
    localStorage.setItem("kuyaB_dailyLogs", JSON.stringify(dailyLogs));
    triggerHaptic("medium");

    document.getElementById("logTitle").value = "";
    document.getElementById("logContent").value = "";
    document.getElementById("logForm").style.display = "none";
    displayDailyLogs();
}

// ---------------------------------------------------------
// TASKS LOGIC
// ---------------------------------------------------------
function displayTasks() {
    const list = document.getElementById("tasksList");
    if (!list) return;

    if (tasks.length === 0) {
        list.innerHTML = '<p class="empty-state">No tasks pending. Tap + to add one!</p>';
        return;
    }

    list.innerHTML = tasks.map(t => `
        <div class="birthday-card" data-id="${t.id}">
            <div class="birthday-info">
                <span class="birthday-name" style="${t.completed ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${t.title}</span>
            </div>
            <div class="birthday-actions">
                <button class="btn-greet" data-action="toggle-task" data-id="${t.id}">${t.completed ? '↩' : '✓'}</button>
                <button class="btn-delete" data-type="task" data-id="${t.id}">🗑️</button>
            </div>
        </div>
    `).join("");
}

function saveTask() {
    const title = document.getElementById("taskTitle")?.value.trim();
    if (!title) {
        alert("Please enter a task.");
        return;
    }

    tasks.push({ id: Date.now().toString(), title, completed: false });
    localStorage.setItem("kuyaB_tasks", JSON.stringify(tasks));
    triggerHaptic("medium");

    document.getElementById("taskTitle").value = "";
    document.getElementById("taskForm").style.display = "none";
    displayTasks();
}

// ---------------------------------------------------------
// REMINDERS LOGIC
// ---------------------------------------------------------
function displayReminders() {
    const list = document.getElementById("remindersList");
    if (!list) return;

    if (reminders.length === 0) {
        list.innerHTML = '<p class="empty-state">No reminders saved. Tap + to add one!</p>';
        return;
    }

    list.innerHTML = reminders.map(r => `
        <div class="birthday-card" data-id="${r.id}">
            <div class="birthday-info">
                <span class="birthday-name">${r.title}</span>
            </div>
            <div class="birthday-actions">
                <button class="btn-delete" data-type="reminder" data-id="${r.id}">🗑️</button>
            </div>
        </div>
    `).join("");
}

function saveReminder() {
    const title = document.getElementById("reminderTitle")?.value.trim();
    if (!title) {
        alert("Please enter a reminder.");
        return;
    }

    reminders.push({ id: Date.now().toString(), title });
    localStorage.setItem("kuyaB_reminders", JSON.stringify(reminders));
    triggerHaptic("medium");

    document.getElementById("reminderTitle").value = "";
    document.getElementById("reminderForm").style.display = "none";
    displayReminders();
}

// ---------------------------------------------------------
// VAULT LOGIC
// ---------------------------------------------------------
function setVaultType(type) {
    currentVaultType = type;
    const titleEl = document.getElementById("vaultPageTitle");
    if (titleEl) {
        if (type === "videos") titleEl.innerText = "🎥 Videos";
        else if (type === "pictures") titleEl.innerText = "🖼️ Pictures";
        else titleEl.innerText = "📁 Vault";
    }
}

function displayVaultItems() {
    const list = document.getElementById("vaultItemsList");
    if (!list) return;

    const filtered = vaultItems.filter(item => (item.type || "other") === currentVaultType);

    if (filtered.length === 0) {
        list.innerHTML = '<p class="empty-state">No files saved here yet. Tap + to add one!</p>';
        return;
    }

    list.innerHTML = filtered.map(item => `
        <div class="birthday-card" data-id="${item.id}">
            <div class="birthday-info">
                <div class="birthday-title-row">
                    <span class="birthday-name">${item.title}</span>
                    <span class="bday-badge">${item.folder || "General"}</span>
                </div>
                <span class="birthday-date">Msg ID: ${item.messageId}</span>
            </div>
            <div class="birthday-actions">
                <button class="btn-greet" data-action="forward-vault" data-msg="${item.messageId}">Forward</button>
                <button class="btn-delete" data-type="vault" data-id="${item.id}">🗑️</button>
            </div>
        </div>
    `).join("");
}

function saveVaultItem() {
    const title = document.getElementById("vaultItemTitle")?.value.trim();
    const folder = document.getElementById("vaultItemFolder")?.value.trim() || "General";
    const msgId = document.getElementById("vaultItemMsgId")?.value.trim();

    if (!title || !msgId) {
        alert("Please enter title and Message ID.");
        return;
    }

    vaultItems.push({ id: Date.now().toString(), title, folder, messageId: msgId, type: currentVaultType });
    localStorage.setItem("kuyaB_vault", JSON.stringify(vaultItems));
    triggerHaptic("medium");

    document.getElementById("vaultItemTitle").value = "";
    document.getElementById("vaultItemFolder").value = "";
    document.getElementById("vaultItemMsgId").value = "";
    document.getElementById("vaultItemForm").style.display = "none";
    displayVaultItems();
}

// ---------------------------------------------------------
// INITIALIZATION & GLOBAL CLICK ROUTER
// ---------------------------------------------------------
function initApp() {
    loadData();

    // Direct launch & cleanup
    const urlParams = new URLSearchParams(window.location.search);
    const msgId = urlParams.get("msg_id");
    const chatId = urlParams.get("chat_id");
    const startSection = urlParams.get("start");

    if (msgId && chatId) {
        fetch("/api/cleanup-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId })
        }).catch(() => {});
    }

    if (startSection === "birthdays") {
        showPage("birthdays
;
if (tg) {
    tg.ready();
    tg.expand();
}

function triggerHaptic(style = "light") {
    try {
        if (tg?.HapticFeedback) {
            if (style === "light" || style === "medium" || style === "heavy") {
                tg.HapticFeedback.impactOccurred(style);
            } else if (style === "success" || style === "error" || style === "warning") {
                tg.HapticFeedback.notificationOccurred(style);
            }
        }
    } catch (e) {}
}

function showToast(message) {
    let toast = document.getElementById("toastNotification");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toastNotification";
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 2800);
}

// ---------------------------------------------------------
// STATE MANAGEMENT
// ---------------------------------------------------------
let birthdays = [];
let dailyLogs = [];
let tasks = [];
let reminders = [];
let vaultItems = [];
let currentVaultType = "other";
let currentMood = "neutral";

// ---------------------------------------------------------
// STORAGE LOADERS
// ---------------------------------------------------------
function loadAllData() {
    try {
        birthdays = JSON.parse(localStorage.getItem("kuyaB_birthdays")) || [];
    } catch (e) { birthdays = []; }

    try {
        dailyLogs = JSON.parse(localStorage.getItem("kuyaB_dailyLogs")) || [];
    } catch (e) { dailyLogs = []; }

    try {
        tasks = JSON.parse(localStorage.getItem("kuyaB_tasks")) || [];
    } catch (e) { tasks = []; }

    try {
        reminders = JSON.parse(localStorage.getItem("kuyaB_reminders")) || [];
    } catch (e) { reminders = []; }

    try {
        vaultItems = JSON.parse(localStorage.getItem("kuyaB_vault")) || [];
    } catch (e) { vaultItems = []; }
}

// ---------------------------------------------------------
// VIEW ROUTING
// ---------------------------------------------------------
const ALL_PAGES = [
    "dashboardPage",
    "birthdaysPage",
    "dailyLogsPage",
    "tasksPage",
    "remindersPage",
    "vaultPage"
];

function hideAllForms() {
    const formIds = ["birthdayForm", "logForm", "taskForm", "reminderForm", "vaultItemForm"];
    formIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
}

function hideAllPages() {
    ALL_PAGES.forEach(id => {
        const page = document.getElementById(id);
        if (page) page.style.display = "none";
    });
    hideAllForms();
}

function showDashboard() {
    hideAllPages();
    const dashboard = document.getElementById("dashboardPage");
    if (dashboard) dashboard.style.display = "block";

    if (tg?.BackButton) {
        tg.BackButton.hide();
    }
}

function showPage(pageId, renderFn) {
    hideAllPages();
    const page = document.getElementById(pageId);
    if (page) page.style.display = "block";

    if (typeof renderFn === "function") {
        renderFn();
    }

    if (tg?.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(showDashboard);
    }
}

// ---------------------------------------------------------
// BIRTHDAYS LOGIC
// ---------------------------------------------------------
function calculateDaysLeft(dateStr) {
    if (!dateStr || !dateStr.includes("-")) return 999;
    const [month, day] = dateStr.split("-").map(Number);
    const today = new Date();
    const currentYear = today.getFullYear();

    let nextBirthday = new Date(currentYear, month - 1, day);
    if (nextBirthday < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        nextBirthday = new Date(currentYear + 1, month - 1, day);
    }

    const diffTime = nextBirthday - new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function displayBirthdays() {
    const list = document.getElementById("birthdaysList");
    if (!list) return;

    if (birthdays.length === 0) {
        list.innerHTML = '<p class="empty-state">No birthdays saved yet. Tap + to add one!</p>';
        return;
    }

    const sorted = [...birthdays].sort((a, b) => calculateDaysLeft(a.date) - calculateDaysLeft(b.date));

    list.innerHTML = sorted.map(b => {
        const daysLeft = calculateDaysLeft(b.date);
        let badge = `<span class="bday-badge">${daysLeft} days left</span>`;
        if (daysLeft === 0) badge = '<span class="bday-badge today">🎉 Today!</span>';
        else if (daysLeft === 1) badge = '<span class="bday-badge tomorrow">Tomorrow</span>';

        return `
            <div class="birthday-card" data-id="${b.id}">
                <div class="birthday-info">
                    <div class="birthday-title-row">
                        <span class="birthday-name">${b.name}</span>
                        ${badge}
                    </div>
                    <span class="birthday-date">📅 ${b.date}</span>
                </div>
                <div class="birthday-actions">
                    <button class="btn-greet" data-name="${b.name}">📢 Greet</button>
                    <button class="btn-delete" data-type="birthday" data-id="${b.id}">🗑️</button>
                </div>
            </div>
        `;
    }).join("");
}

function saveBirthday() {
    const nameEl = document.getElementById("birthdayName");
    const dateEl = document.getElementById("birthdayDate");
    const name = nameEl?.value.trim();
    const date = dateEl?.value.trim();

    if (!name || !date) {
        alert("Please enter both a name and date (MM-DD).");
        return;
    }

    birthdays.push({ id: Date.now().toString(), name, date });
    localStorage.setItem("kuyaB_birthdays", JSON.stringify(birthdays));
    triggerHaptic("medium");

    nameEl.value = "";
    dateEl.value = "";
    const form = document.getElementById("birthdayForm");
    if (form) form.style.display = "none";

    displayBirthdays();
}

async function sendGreetingToChat(name) {
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get("chat_id");

    if (!chatId) {
        showToast("Open via /kuyab inside a group chat to send greetings!");
        return;
    }

    triggerHaptic("medium");
    try {
        const res = await fetch("/api/birthdays/greet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, name: name })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Greeting sent for ${name}! 🎉`);
        } else {
            showToast("Failed to send greeting.");
        }
    } catch (e) {
        showToast("Network error.");
    }
}

// ---------------------------------------------------------
// DAILY LOGS LOGIC
// ---------------------------------------------------------
function displayDailyLogs() {
    const list = document.getElementById("dailyLogsList");
    if (!list) return;

    if (dailyLogs.length === 0) {
        list.innerHTML = '<p class="empty-state">No daily logs saved yet. Tap + to add one!</p>';
        return;
    }

    list.innerHTML = dailyLogs.map(l => `
        <div class="birthday-card" data-id="${l.id}">
            <div class="birthday-info">
                <div class="birthday-title-row">
                    <span class="birthday-name">${l.title}</span>
                </div>
                <span class="birthday-date">${l.content || ""}</span>
            </div>
            <div class="birthday-actions">
                <button class="btn-delete" data-type="log" data-id="${l.id}">🗑️</button>
            </div>
        </div>
    `).join("");
}

function saveLog() {
    const titleEl = document.getElementById("logTitle");
    const contentEl = document.getElementById("logContent");
    const title = titleEl?.value.trim();
    const content = contentEl?.value.trim();

    if (!title) {
        alert("Please enter a title or summary.");
        return;
    }

    dailyLogs.unshift({ id: Date.now().toString(), title, content, date: new Date().toLocaleDateString() });
    localStorage.setItem("kuyaB_dailyLogs", JSON.stringify(dailyLogs));
    triggerHaptic("medium");

    titleEl.value = "";
    contentEl.value = "";
    const form = document.getElementById("logForm");
    if (form) form.style.display = "none";

    displayDailyLogs();
}

// ---------------------------------------------------------
// TASKS LOGIC
// ---------------------------------------------------------
function displayTasks() {
    const list = document.getElementById("tasksList");
    if (!list) return;

    if (tasks.length === 0) {
        list.innerHTML = '<p class="empty-state">No tasks pending. Tap + to add one!</p>';
        return;
    }

    list.innerHTML = tasks.map(t => `
        <div class="birthday-card" data-id="${t.id}">
            <div class="birthday-info">
                <span class="birthday-name" style="${t.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${t.title}</span>
            </div>
            <div class="birthday-actions">
                <button class="btn-greet" data-action="toggle-task" data-id="${t.id}">${t.completed ? '↩️️' : '✓'}</button>
                <button class="btn-delete" data-type="task" data-id="${t.id}">🗑️</button>
            </div>
        </div>
    `).join("");
}

function saveTask() {
    const titleEl = document.getElementById("taskTitle");
    const title = titleEl?.value.trim();

    if (!title) {
        alert("Please enter a task.");
        return;
    }

    tasks.push({ id: Date.now().toString(), title, completed: false });
    localStorage.setItem("kuyaB_tasks", JSON.stringify(tasks));
    triggerHaptic("medium");

    titleEl.value = "";
    const form = document.getElementById("taskForm");
    if (form) form.style.display = "none";

    displayTasks();
}

// ---------------------------------------------------------
// REMINDERS LOGIC
// ---------------------------------------------------------
function displayReminders() {
    const list = document.getElementById("remindersList");
    if (!list) return;

    if (reminders.length === 0) {
        list.innerHTML = '<p class="empty-state">No reminders saved. Tap + to add one!</p>';
        return;
    }

    list.innerHTML = reminders.map(r => `
        <div class="birthday-card" data-id="${r.id}">
            <div class="birthday-info">
                <span class="birthday-name">${r.title}</span>
            </div>
            <div class="birthday-actions">
                <button class="btn-delete" data-type="reminder" data-id="${r.id}">🗑️</button>
            </div>
        </div>
    `).join("");
}

function saveReminder() {
    const titleEl = document.getElementById("reminderTitle");
    const title = titleEl?.value.trim();

    if (!title) {
        alert("Please enter a reminder.");
        return;
    }

    reminders.push({ id: Date.now().toString(), title });
    localStorage.setItem("kuyaB_reminders", JSON.stringify(reminders));
    triggerHaptic("medium");

    titleEl.value = "";
    const form = document.getElementById("reminderForm");
    if (form) form.style.display = "none";

    displayReminders();
}

// ---------------------------------------------------------
// VAULT LOGIC
// ---------------------------------------------------------
function setVaultType(type) {
    currentVaultType = type;
    const titleEl = document.getElementById("vaultPageTitle");
    if (titleEl) {
        if (type === "videos") titleEl.innerText = "🎥 Videos";
        else if (type === "pictures") titleEl.innerText = "🖼️ Pictures";
        else titleEl.innerText = "📁 Vault";
    }
}

function displayVaultItems() {
    const list = document.getElementById("vaultItemsList");
    if (!list) return;

    const filtered = vaultItems.filter(item => (item.type || "other") === currentVaultType);

    if (filtered.length === 0) {
        list.innerHTML = '<p class="empty-state">No files saved here yet. Tap + to add one!</p>';
        return;
    }

    list.innerHTML = filtered.map(item => `
        <div class="birthday-card" data-id="${item.id}">
            <div class="birthday-info">
                <div class="birthday-title-row">
                    <span class="birthday-name">${item.title}</span>
                    <span class="bday-badge">${item.folder || "General"}</span>
                </div>
                <span class="birthday-date">Msg ID: ${item.messageId}</span>
            </div>
            <div class="birthday-actions">
                <button class="btn-greet" data-action="forward-vault" data-msg="${item.messageId}">Forward</button>
                <button class="btn-delete" data-type="vault" data-id="${item.id}">🗑️</button>
            </div>
        </div>
    `).join("");
}

function saveVaultItem() {
    const titleEl = document.getElementById("vaultItemTitle");
    const folderEl = document.getElementById("vaultItemFolder");
    const msgIdEl = document.getElementById("vaultItemMsgId");

    const title = titleEl?.value.trim();
    const folder = folderEl?.value.trim() || "General";
    const msgId = msgIdEl?.value.trim();

    if (!title || !msgId) {
        alert("Please enter title and Message ID.");
        return;
    }

    vaultItems.push({
        id: Date.now().toString(),
        title,
        folder,
        messageId: msgId,
        type: currentVaultType
    });
    localStorage.setItem("kuyaB_vault", JSON.stringify(vaultItems));
    triggerHaptic("medium");

    titleEl.value = "";
    folderEl.value = "";
    msgIdEl.value = "";
    const form = document.getElementById("vaultItemForm");
    if (form) form.style.display = "none";

    displayVaultItems();
}

// ---------------------------------------------------------
// APP INITIALIZATION & GLOBAL CLICK HANDLER
// ---------------------------------------------------------
function initApp() {
    loadAllData();

    // 1. Process URL parameters for direct deep-linking & cleanup
    const urlParams = new URLSearchParams(window.location.search);
    const msgId = urlParams.get("msg_id");
    const chatId = urlParams.get("chat_id");
    const startSection = urlParams.get("start");

    if (msgId && chatId) {
        fetch("/api/cleanup-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId })
        }).catch(() => {});
    }

    // 2. Open specific feature or load Dashboard
    if (startSection === "birthdays") {
        showPage("birthdaysPage", displayBirthdays);
    } else if (startSection === "daily") {
        showPage("dailyLogsPage", displayDailyLogs);
    } else if (startSection === "tasks") {
        showPage("tasksPage", displayTasks);
    } else if (startSection === "reminders") {
        showPage("remindersPage", displayReminders);
    } else if (["videos", "pictures", "other"].includes(startSection)) {
        setVaultType(startSection);
        showPage("vaultPage", displayVaultItems);
    } else {
        showDashboard();
    }

    // 3. Global Click Handler
    document.addEventListener("click", function (e) {
        // --- Dashboard Navigation ---
        const bdayNav = e.target.closest('[data-feature="birthdays"]');
        if (bdayNav) {
            e.preventDefault();
            triggerHaptic("light");
            showPage("birthdaysPage", displayBirthdays);
            return;
        }

        const dailyNav = e.target.closest('[data-feature="daily"]');
        if (dailyNav) {
            e.preventDefault();
            triggerHaptic("light");
            showPage("dailyLogsPage", displayDailyLogs);
            return;
        }

        const taskNav = e.target.closest('[data-feature="tasks"]');
        if (taskNav) {
            e.preventDefault();
            triggerHaptic("light");
            showPage("tasksPage", displayTasks);
            return;
        }

        const remNav = e.target.closest('[data-feature="reminders"]');
        if (remNav) {
            e.preventDefault();
            triggerHaptic("light");
            showPage("remindersPage", displayReminders);
            return;
        }

        const vaultNav = e.target.closest('[data-feature="videos"], [data-feature="pictures"], [data-feature="other"]');
        if (vaultNav) {
            e.preventDefault();
            triggerHaptic("light");
            setVaultType(vaultNav.dataset.feature);
            showPage("vaultPage", displayVaultItems);
            return;
        }

        // --- Back Buttons ---
        if (e.target.closest("#birthdayBackButton, #dailyLogsBackButton, #tasksBackButton, #remindersBackButton, #vaultBackButton")) {
            e.preventDefault();
            triggerHaptic("light");
            showDashboard();
            return;
        }

        // --- Add Forms Toggle ---
        if (e.target.closest("#addBirthdayButton")) {
            e.preventDefault();
            document.getElementById("birthdayForm").style.display = "block";
            return;
        }
        if (e.target.closest("#cancelBirthdayButton")) {
            e.preventDefault();
            document.getElementById("birthdayForm").style.display = "none";
            return;
        }
        if (e.target.closest("#saveBirthdayButton")) {
            e.preventDefault();
            saveBirthday();
            return;
        }

        if (e.target.closest("#addLogButton")) {
            e.preventDefault();
            document.getElementById("logForm").style.display = "block";
            return;
        }
        if (e.target.closest("#cancelLogButton")) {
            e.preventDefault();
            document.getElementById("logForm").style.display = "none";
            return;
        }
        if (e.target.closest("#saveLogButton")) {
            e.preventDefault();
            saveLog();
            return;
        }

        if (e.target.closest("#addTaskButton")) {
            e.preventDefault();
            document.getElementById("taskForm").style.display = "block";
            return;
        }
        if (e.target.closest("#cancelTaskButton")) {
            e.preventDefault();
            document.getElementById("taskForm").style.display = "none";
            return;
        }
        if (e.target.closest("#saveTaskButton")) {
            e.preventDefault();
            saveTask();
            return;
        }

        if (e.target.closest("#addReminderButton")) {
            e.preventDefault();
            document.getElementById("reminderForm").style.display = "block";
            return;
        }
        if (e.target.closest("#cancelReminderButton")) {
            e.preventDefault();
            document.getElementById("reminderForm").style.display = "none";
            return;
        }
        if (e.target.closest("#saveReminderButton")) {
            e.preventDefault();
            saveReminder();
            return;
        }

        if (e.target.closest("#addVaultItemButton")) {
            e.preventDefault();
            document.getElementById("vaultItemForm").style.display = "block";
            return;
        }
        if (e.target.closest("#cancelVaultItemButton")) {
            e.preventDefault();
            document.getElementById("vaultItemForm").style.display = "none";
            return;
        }
        if (e.target.closest("#saveVaultItemButton")) {
            e.preventDefault();
            saveVaultItem();
            return;
        }

        // --- Item Actions (Greet, Toggle Task, Delete, Forward) ---
        const greetBtn = e.target.closest(".btn-greet[data-name]");
        if (greetBtn) {
            e.preventDefault();
            sendGreetingToChat(greetBtn.dataset.name);
            return;
        }

        const toggleBtn = e.target.closest('[data-action="toggle-task"]');
        if (toggleBtn) {
            e.preventDefault();
            const id = toggleBtn.dataset.id;
            const t = tasks.find(x => x.id === id);
            if (t) {
                t.completed = !t.completed;
                localStorage.setItem("kuyaB_tasks", JSON.stringify(tasks));
                triggerHaptic("light");
                displayTasks();
            }
            return;
        }

        const deleteBtn = e.target.closest(".btn-delete");
        if (deleteBtn) {
            e.preventDefault();
            const id = deleteBtn.dataset.id;
            const type = deleteBtn.dataset.type;

            if (confirm("Delete this item?")) {
                if (type === "birthday") {
                    birthdays = birthdays.filter(x => x.id !== id);
                    localStorage.setItem("kuyaB_birthdays", JSON.stringify(birthdays));
                    displayBirthdays();
                } else if (type === "log") {
                    dailyLogs = dailyLogs.filter(x => x.id !== id);
                    localStorage.setItem("kuyaB_dailyLogs", JSON.stringify(dailyLogs));
                    displayDailyLogs();
                } else if (type === "task") {
                    tasks = tasks.filter(x => x.id !== id);
                    localStorage.setItem("kuyaB_tasks", JSON.stringify(tasks));
                    displayTasks();
                } else if (type === "reminder") {
                    reminders = reminders.filter(x => x.id !== id);
                    localStorage.setItem("kuyaB_reminders", JSON.stringify(reminders));
                    displayReminders();
                } else if (type === "vault") {
                    vaultItems = vaultItems.filter(x => x.id !== id);
                    localStorage.setItem("kuyaB_vault", JSON.stringify(vaultItems));
                    displayVaultItems();
                }
                triggerHaptic("medium");
            }
            return;
        }

        const fwdBtn = e.target.closest('[data-action="forward-vault"]');
        if (fwdBtn) {
            e.preventDefault();
            const msgId = fwdBtn.dataset.msg;
            const userId = tg?.initDataUnsafe?.user?.id;
            if (!userId) {
                showToast("Could not determine user ID.");
                return;
            }
            fetch("/api/vault/forward", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageId: msgId, userId: userId })
            }).then(() => showToast("Message forwarded! 🚀")).catch(() => showToast("Failed to forward."));
            return;
        }

        // --- Other Dashboard Links ---
        if (e.target.closest("#gameButton")) {
            e.preventDefault();
            alert("Use /game in chat to play Word Scramble!");
            return;
        }

        if (e.target.closest("#addContentButton")) {
            e.preventDefault();
            setVaultType("other");
            showPage("vaultPage", () => {
                displayVaultItems();
                document.getElementById("vaultItemForm").style.display = "block";
            });
            return;
        }
    });

    // Auto-dash format for birthday date
    const bdayDateInput = document.getElementById("birthdayDate");
    if (bdayDateInput) {
        bdayDateInput.addEventListener("input", function () {
            let val = this.value.replace(/\D/g, "");
            if (val.length > 4) val = val.substring(0, 4);
            if (val.length >= 3) val = val.substring(0, 2) + "-" + val.substring(2);
            this.value = val;
        });
    }
}

// Run initialization immediately on load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
