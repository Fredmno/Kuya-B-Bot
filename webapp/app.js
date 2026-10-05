/* =========================================================
   KUYA B — PERSONAL HUB
   Telegram Mini App
   Birthday & Daily Logs Modules
   ========================================================= */

const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

// ---------------------------------------------------------
// STATE
// ---------------------------------------------------------

let birthdays = [];
let editingBirthdayId = null;

let dailyLogs = [];
let editingLogId = null;
let selectedMood = "😊";

// ---------------------------------------------------------
// PERSISTENCE (LOCAL STORAGE)
// ---------------------------------------------------------

function loadAllData() {
    // Birthdays
    try {
        const savedBirthdays = localStorage.getItem("kuyaB_birthdays");
        birthdays = savedBirthdays ? JSON.parse(savedBirthdays) : [];
    } catch (error) {
        console.error("Unable to load birthdays:", error);
        birthdays = [];
    }

    // Daily Logs
    try {
        const savedLogs = localStorage.getItem("kuyaB_daily_logs");
        dailyLogs = savedLogs ? JSON.parse(savedLogs) : [];
    } catch (error) {
        console.error("Unable to load daily logs:", error);
        dailyLogs = [];
    }
}

function saveBirthdays() {
    try {
        localStorage.setItem("kuyaB_birthdays", JSON.stringify(birthdays));
    } catch (error) {
        console.error("Unable to save birthdays:", error);
    }
}

function saveDailyLogs() {
    try {
        localStorage.setItem("kuyaB_daily_logs", JSON.stringify(dailyLogs));
    } catch (error) {
        console.error("Unable to save daily logs:", error);
    }
}

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getTodayISODate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function formatLogDate(dateString) {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

// ---------------------------------------------------------
// BIRTHDAY CALCULATIONS & VALIDATION
// ---------------------------------------------------------

function isValidBirthday(value) {
    if (!/^\d{2}-\d{2}$/.test(value)) return false;

    const parts = value.split("-");
    const month = Number(parts[0]);
    const day = Number(parts[1]);

    if (month < 1 || month > 12 || day < 1 || day > 31) return false;

    const testDate = new Date(2024, month, 0);
    return day <= testDate.getDate();
}

function getNextBirthday(dateString) {
    if (!isValidBirthday(dateString)) return null;

    const [month, day] = dateString.split("-").map(Number);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    let bday = new Date(today.getFullYear(), month - 1, day);
    if (bday < todayStart) {
        bday = new Date(today.getFullYear() + 1, month - 1, day);
    }
    return bday;
}

function daysUntilBirthday(dateString) {
    const bday = getNextBirthday(dateString);
    if (!bday) return Infinity;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return Math.round((bday.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
}

function formatBirthday(dateString) {
    if (!isValidBirthday(dateString)) return dateString;

    const [month, day] = dateString.split("-").map(Number);
    const date = new Date(2024, month - 1, day);

    return date.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric"
    });
}

// ---------------------------------------------------------
// NAVIGATION & PAGE ROUTING
// ---------------------------------------------------------

function showDashboard() {
    const dashboard = document.getElementById("dashboardPage");
    const birthdays = document.getElementById("birthdaysPage");
    const dailyLogsPage = document.getElementById("dailyLogsPage");

    if (dashboard) dashboard.style.display = "block";
    if (birthdays) birthdays.style.display = "none";
    if (dailyLogsPage) dailyLogsPage.style.display = "none";

    hideBirthdayForm();
    hideLogForm();

    if (tg?.BackButton) {
        tg.BackButton.hide();
    }
}

function showBirthdays() {
    const dashboard = document.getElementById("dashboardPage");
    const birthdays = document.getElementById("birthdaysPage");
    const dailyLogsPage = document.getElementById("dailyLogsPage");

    if (dashboard) dashboard.style.display = "none";
    if (birthdays) birthdays.style.display = "block";
    if (dailyLogsPage) dailyLogsPage.style.display = "none";

    hideBirthdayForm();
    displayBirthdays();

    if (tg?.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(showDashboard);
    }
}

function showDailyLogs() {
    const dashboard = document.getElementById("dashboardPage");
    const birthdays = document.getElementById("birthdaysPage");
    const dailyLogsPage = document.getElementById("dailyLogsPage");

    if (dashboard) dashboard.style.display = "none";
    if (birthdays) birthdays.style.display = "none";
    if (dailyLogsPage) dailyLogsPage.style.display = "block";

    hideLogForm();
    displayDailyLogs();

    if (tg?.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(showDashboard);
    }
}

// ---------------------------------------------------------
// BIRTHDAYS: FORM & ACTIONS
// ---------------------------------------------------------

function showBirthdayForm(birthday = null) {
    const form = document.getElementById("birthdayForm");
    const nameInput = document.getElementById("birthdayName");
    const dateInput = document.getElementById("birthdayDate");
    const saveBtn = document.getElementById("saveBirthdayButton");

    if (!form) return;

    form.style.display = "block";
    const heading = form.querySelector("h2");

    if (birthday) {
        editingBirthdayId = birthday.id;
        if (nameInput) nameInput.value = birthday.name;
        if (dateInput) dateInput.value = birthday.date;
        if (heading) heading.textContent = "Edit Birthday";
        if (saveBtn) saveBtn.textContent = "Save Changes";
    } else {
        editingBirthdayId = null;
        if (nameInput) nameInput.value = "";
        if (dateInput) dateInput.value = "";
        if (heading) heading.textContent = "Add Birthday";
        if (saveBtn) saveBtn.textContent = "Save Birthday";
    }

    setTimeout(() => nameInput?.focus(), 100);
}

function hideBirthdayForm() {
    const form = document.getElementById("birthdayForm");
    const nameInput = document.getElementById("birthdayName");
    const dateInput = document.getElementById("birthdayDate");

    if (!form) return;
    form.style.display = "none";
    editingBirthdayId = null;

    if (nameInput) nameInput.value = "";
    if (dateInput) dateInput.value = "";
}

function saveBirthday() {
    const nameInput = document.getElementById("birthdayName");
    const dateInput = document.getElementById("birthdayDate");

    const name = nameInput?.value.trim();
    const date = dateInput?.value.trim();

    if (!name) {
        alert("Please enter a name.");
        nameInput?.focus();
        return;
    }

    if (!isValidBirthday(date)) {
        alert("Please enter a valid birthday using MM-DD.\n\nExample: 05-24");
        dateInput?.focus();
        return;
    }

    if (editingBirthdayId) {
        const idx = birthdays.findIndex(b => b.id === editingBirthdayId);
        if (idx !== -1) {
            birthdays[idx].name = name;
            birthdays[idx].date = date;
        }
    } else {
        birthdays.push({
            id: Date.now().toString(),
            name: name,
            date: date
        });
    }

    saveBirthdays();

    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("success");
    }

    hideBirthdayForm();
    displayBirthdays();
}

function deleteBirthday(id) {
    const item = birthdays.find(b => b.id === id);
    if (!item) return;

    if (!confirm(`Delete ${item.name}'s birthday?`)) return;

    birthdays = birthdays.filter(b => b.id !== id);
    saveBirthdays();

    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("warning");
    }

    displayBirthdays();
}

function displayBirthdays() {
    const list = document.getElementById("birthdayList");
    if (!list) return;

    list.innerHTML = "";

    if (!birthdays.length) {
        list.innerHTML = `
            <div class="empty-state" style="text-align:center; padding:30px 10px; color:#94a3b8;">
                <div style="font-size:3rem; margin-bottom:8px;">🎂</div>
                <strong style="display:block; font-size:1.1rem; color:#f8fafc; margin-bottom:4px;">No birthdays yet</strong>
                <small>Add birthdays for family, friends, and important people.</small>
            </div>
        `;
        return;
    }

    const sorted = [...birthdays].sort((a, b) => daysUntilBirthday(a.date) - daysUntilBirthday(b.date));

    sorted.forEach(b => {
        const days = daysUntilBirthday(b.date);
        let countdown = "";

        if (days === 0) countdown = "🎉 Today!";
        else if (days === 1) countdown = "Tomorrow";
        else if (days !== Infinity) countdown = `In ${days} days`;

        const isSoon = days <= 7;
        const card = document.createElement("div");
        card.className = `birthday-card ${isSoon ? "birthday-soon" : ""}`;
        card.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:12px; margin-bottom:10px; background:rgba(255,255,255,0.06); border-radius:14px;";

        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="font-size:1.8rem;">🎂</div>
                <div>
                    <strong style="display:block; font-size:1rem; color:#f8fafc;">${escapeHtml(b.name)}</strong>
                    <span style="font-size:0.85rem; color:#94a3b8;">${escapeHtml(formatBirthday(b.date))}</span>
                    <small style="display:block; font-size:0.8rem; color:${isSoon ? '#f43f5e' : '#38bdf8'}; font-weight:600;">${escapeHtml(countdown)}</small>
                </div>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="birthday-edit" type="button" data-id="${escapeHtml(b.id)}" style="background:none; border:none; font-size:1.2rem; padding:6px; cursor:pointer;">✏️</button>
                <button class="birthday-delete" type="button" data-id="${escapeHtml(b.id)}" style="background:none; border:none; font-size:1.2rem; padding:6px; cursor:pointer;">🗑️</button>
            </div>
        `;

        list.appendChild(card);
    });

    list.querySelectorAll(".birthday-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            const item = birthdays.find(b => b.id === btn.dataset.id);
            if (item) showBirthdayForm(item);
        });
    });

    list.querySelectorAll(".birthday-delete").forEach(btn => {
        btn.addEventListener("click", () => deleteBirthday(btn.dataset.id));
    });
}

// ---------------------------------------------------------
// DAILY LOGS: MOOD & FORM
// ---------------------------------------------------------

function setMood(mood) {
    selectedMood = mood;
    document.querySelectorAll(".mood-btn").forEach(btn => {
        if (btn.dataset.mood === mood) {
            btn.style.borderColor = "#38bdf8";
            btn.style.background = "rgba(56, 189, 248, 0.2)";
        } else {
            btn.style.borderColor = "transparent";
            btn.style.background = "rgba(255, 255, 255, 0.08)";
        }
    });
}

function showLogForm(log = null) {
    const form = document.getElementById("logForm");
    const heading = document.getElementById("logFormHeading");
    const dateInput = document.getElementById("logDate");
    const textInput = document.getElementById("logText");
    const saveBtn = document.getElementById("saveLogButton");

    if (!form) return;

    form.style.display = "block";

    if (log) {
        editingLogId = log.id;
        if (heading) heading.textContent = "Edit Entry";
        if (dateInput) dateInput.value = log.date;
        if (textInput) textInput.value = log.text;
        if (saveBtn) saveBtn.textContent = "Save Changes";
        setMood(log.mood || "😊");
    } else {
        editingLogId = null;
        if (heading) heading.textContent = "New Entry";
        if (dateInput) dateInput.value = getTodayISODate();
        if (textInput) textInput.value = "";
        if (saveBtn) saveBtn.textContent = "Save Entry";
        setMood("😊");
    }

    setTimeout(() => textInput?.focus(), 100);
}

function hideLogForm() {
    const form = document.getElementById("logForm");
    const textInput = document.getElementById("logText");

    if (!form) return;
    form.style.display = "none";
    editingLogId = null;

    if (textInput) textInput.value = "";
}

function saveLog() {
    const dateInput = document.getElementById("logDate");
    const textInput = document.getElementById("logText");

    const date = dateInput?.value || getTodayISODate();
    const text = textInput?.value.trim();

    if (!text) {
        alert("Please write something in your log entry.");
        textInput?.focus();
        return;
    }

    if (editingLogId) {
        const idx = dailyLogs.findIndex(l => l.id === editingLogId);
        if (idx !== -1) {
            dailyLogs[idx].date = date;
            dailyLogs[idx].mood = selectedMood;
            dailyLogs[idx].text = text;
        }
    } else {
        dailyLogs.unshift({
            id: Date.now().toString(),
            date: date,
            mood: selectedMood,
            text: text
        });
    }

    saveDailyLogs();

    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("success");
    }

    hideLogForm();
    displayDailyLogs();
}

function deleteLog(id) {
    const item = dailyLogs.find(l => l.id === id);
    if (!item) return;

    if (!confirm("Delete this log entry?")) return;

    dailyLogs = dailyLogs.filter(l => l.id !== id);
    saveDailyLogs();

    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("warning");
    }

    displayDailyLogs();
}

function displayDailyLogs() {
    const list = document.getElementById("logsList");
    if (!list) return;

    list.innerHTML = "";

    if (!dailyLogs.length) {
        list.innerHTML = `
            <div class="empty-state" style="text-align:center; padding:30px 10px; color:#94a3b8;">
                <div style="font-size:3rem; margin-bottom:8px;">📅</div>
                <strong style="display:block; font-size:1.1rem; color:#f8fafc; margin-bottom:4px;">No log entries yet</strong>
                <small>Record your daily thoughts, activities, and milestones.</small>
            </div>
        `;
        return;
    }

    // Sort descending (newest dates first)
    const sorted = [...dailyLogs].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(log => {
        const card = document.createElement("div");
        card.className = "log-card";
        card.style.cssText = "padding:16px; margin-bottom:12px; background:rgba(255,255,255,0.06); border-radius:14px;";

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:6px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:1.4rem;">${escapeHtml(log.mood || "😊")}</span>
                    <strong style="font-size:0.9rem; color:#38bdf8;">${escapeHtml(formatLogDate(log.date))}</strong>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="log-edit" type="button" data-id="${escapeHtml(log.id)}" style="background:none; border:none; font-size:1.1rem; padding:4px; cursor:pointer;">✏️</button>
                    <button class="log-delete" type="button" data-id="${escapeHtml(log.id)}" style="background:none; border:none; font-size:1.1rem; padding:4px; cursor:pointer;">🗑️</button>
                </div>
            </div>
            <p style="margin:0; font-size:0.95rem; color:#f1f5f9; line-height:1.45; white-space:pre-wrap;">${escapeHtml(log.text)}</p>
        `;

        list.appendChild(card);
    });

    list.querySelectorAll(".log-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            const item = dailyLogs.find(l => l.id === btn.dataset.id);
            if (item) showLogForm(item);
        });
    });

    list.querySelectorAll(".log-delete").forEach(btn => {
        btn.addEventListener("click", () => deleteLog(btn.dataset.id));
    });
}

// ---------------------------------------------------------
// INITIALIZATION & EVENT DELEGATION
// ---------------------------------------------------------

function initApp() {
    loadAllData();
    showDashboard();

    // Universal Click Delegator
    document.addEventListener("click", function (e) {
        // --- Navigation ---
        // Birthdays Tile
        if (e.target.closest('[data-feature="birthdays"]')) {
            e.preventDefault();
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
            showBirthdays();
            return;
        }

        // Daily Logs Tile
        if (e.target.closest('[data-feature="daily"]')) {
            e.preventDefault();
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
            showDailyLogs();
            return;
        }

        // Back to Dashboard (from Birthdays or Daily Logs)
        if (e.target.closest("#birthdayBackButton, #dailyLogsBackButton")) {
            e.preventDefault();
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
            showDashboard();
            return;
        }

        // --- Birthday Actions ---
        if (e.target.closest("#addBirthdayButton")) {
            e.preventDefault();
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
            showBirthdayForm();
            return;
        }

        if (e.target.closest("#cancelBirthdayButton")) {
            e.preventDefault();
            hideBirthdayForm();
            return;
        }

        if (e.target.closest("#saveBirthdayButton")) {
            e.preventDefault();
            saveBirthday();
            return;
        }

        // --- Daily Log Actions ---
        if (e.target.closest("#addLogButton")) {
            e.preventDefault();
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
            showLogForm();
            return;
        }

        if (e.target.closest("#cancelLogButton")) {
            e.preventDefault();
            hideLogForm();
            return;
        }

        if (e.target.closest("#saveLogButton")) {
            e.preventDefault();
            saveLog();
            return;
        }

        const moodBtn = e.target.closest(".mood-btn");
        if (moodBtn) {
            e.preventDefault();
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
            setMood(moodBtn.dataset.mood);
            return;
        }

        // --- Future Placeholders ---
        if (e.target.closest("#addContentButton")) {
            e.preventDefault();
            alert("Add Content modal coming soon!");
            return;
        }

        if (e.target.closest("#gameButton")) {
            e.preventDefault();
            alert("Word Scramble launcher ready!");
            return;
        }

        if (e.target.closest("#searchButton")) {
            e.preventDefault();
            alert("Universal Search coming in Phase 5!");
            return;
        }

        const featureTile = e.target.closest("[data-feature]");
        if (featureTile) {
            const name = featureTile.dataset.feature;
            if (name !== "birthdays" && name !== "daily") {
                e.preventDefault();
                alert(`${name.charAt(0).toUpperCase() + name.slice(1)} module coming soon.`);
            }
        }
    });

    // Auto-dash format for birthday date input
    const birthdayDateInput = document.getElementById("birthdayDate");
    if (birthdayDateInput) {
        birthdayDateInput.addEventListener("input", function () {
            let val = this.value.replace(/\D/g, "");
            if (val.length > 4) val = val.substring(0, 4);
            if (val.length >= 3) {
                val = val.substring(0, 2) + "-" + val.substring(2);
            }
            this.value = val;
        });

        birthdayDateInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                saveBirthday();
            }
        });
    }

    const birthdayNameInput = document.getElementById("birthdayName");
    if (birthdayNameInput) {
        birthdayNameInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                saveBirthday();
            }
        });
    }
}

// Bootstrap
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
