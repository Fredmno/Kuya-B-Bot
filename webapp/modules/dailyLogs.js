/* =========================================================
   KUYA B — MODULE: DAILY LOGS
   ========================================================= */

import { escapeHtml, triggerHaptic } from "./helpers.js";

let dailyLogs = [];
let editingLogId = null;
let selectedMood = "😊";

export function loadDailyLogs() {
    try {
        const saved = localStorage.getItem("kuyaB_daily_logs");
        dailyLogs = saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error("Unable to load daily logs:", error);
        dailyLogs = [];
    }
}

function saveDailyLogs() {
    try {
        localStorage.setItem("kuyaB_daily_logs", JSON.stringify(dailyLogs));
    } catch (error) {
        console.error("Unable to save daily logs:", error);
    }
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

export function setMood(mood) {
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

export function showLogForm(log = null) {
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

export function hideLogForm() {
    const form = document.getElementById("logForm");
    const textInput = document.getElementById("logText");

    if (!form) return;
    form.style.display = "none";
    editingLogId = null;
    if (textInput) textInput.value = "";
}

export function saveLog() {
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
            date,
            mood: selectedMood,
            text
        });
    }

    saveDailyLogs();
    triggerHaptic("notification");
    hideLogForm();
    displayDailyLogs();
}

export function deleteLog(id) {
    const item = dailyLogs.find(l => l.id === id);
    if (!item) return;

    if (!confirm("Delete this log entry?")) return;

    dailyLogs = dailyLogs.filter(l => l.id !== id);
    saveDailyLogs();
    triggerHaptic("warning");
    displayDailyLogs();
}

export function displayDailyLogs() {
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
