/* =========================================================
   KUYA B — MODULE: REMINDERS
   ========================================================= */

import { escapeHtml, triggerHaptic } from "./helpers.js";

let reminders = [];
let editingReminderId = null;

export function loadReminders() {
    try {
        const saved = localStorage.getItem("kuyaB_reminders");
        reminders = saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error("Unable to load reminders:", error);
        reminders = [];
    }
}

function saveRemindersToStorage() {
    try {
        localStorage.setItem("kuyaB_reminders", JSON.stringify(reminders));
    } catch (error) {
        console.error("Unable to save reminders:", error);
    }
}

function getTodayISODate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function getDefaultTime() {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

export function showReminderForm(reminder = null) {
    const form = document.getElementById("reminderForm");
    const heading = document.getElementById("reminderFormHeading");
    const titleInput = document.getElementById("reminderTitle");
    const dateInput = document.getElementById("reminderDate");
    const timeInput = document.getElementById("reminderTime");
    const repeatSelect = document.getElementById("reminderRepeat");
    const saveBtn = document.getElementById("saveReminderButton");

    if (!form) return;
    form.style.display = "block";

    if (reminder) {
        editingReminderId = reminder.id;
        if (heading) heading.textContent = "Edit Reminder";
        if (titleInput) titleInput.value = reminder.title;
        if (dateInput) dateInput.value = reminder.date;
        if (timeInput) timeInput.value = reminder.time;
        if (repeatSelect) repeatSelect.value = reminder.repeat || "none";
        if (saveBtn) saveBtn.textContent = "Save Changes";
    } else {
        editingReminderId = null;
        if (heading) heading.textContent = "Add Reminder";
        if (titleInput) titleInput.value = "";
        if (dateInput) dateInput.value = getTodayISODate();
        if (timeInput) timeInput.value = getDefaultTime();
        if (repeatSelect) repeatSelect.value = "none";
        if (saveBtn) saveBtn.textContent = "Save Reminder";
    }

    setTimeout(() => titleInput?.focus(), 100);
}

export function hideReminderForm() {
    const form = document.getElementById("reminderForm");
    const titleInput = document.getElementById("reminderTitle");

    if (!form) return;
    form.style.display = "none";
    editingReminderId = null;
    if (titleInput) titleInput.value = "";
}

export function saveReminder() {
    const titleInput = document.getElementById("reminderTitle");
    const dateInput = document.getElementById("reminderDate");
    const timeInput = document.getElementById("reminderTime");
    const repeatSelect = document.getElementById("reminderRepeat");

    const title = titleInput?.value.trim();
    const date = dateInput?.value || getTodayISODate();
    const time = timeInput?.value || "09:00";
    const repeat = repeatSelect?.value || "none";

    if (!title) {
        alert("Please enter a reminder title.");
        titleInput?.focus();
        return;
    }

    if (editingReminderId) {
        const idx = reminders.findIndex(r => r.id === editingReminderId);
        if (idx !== -1) {
            reminders[idx].title = title;
            reminders[idx].date = date;
            reminders[idx].time = time;
            reminders[idx].repeat = repeat;
        }
    } else {
        reminders.push({
            id: Date.now().toString(),
            title,
            date,
            time,
            repeat,
            createdAt: new Date().toISOString()
        });
    }

    saveRemindersToStorage();
    triggerHaptic("notification");
    hideReminderForm();
    displayReminders();
}

export function deleteReminder(id) {
    const item = reminders.find(r => r.id === id);
    if (!item) return;

    if (!confirm(`Delete reminder "${item.title}"?`)) return;

    reminders = reminders.filter(r => r.id !== id);
    saveRemindersToStorage();
    triggerHaptic("warning");
    displayReminders();
}

export function displayReminders() {
    const list = document.getElementById("remindersList");
    if (!list) return;
    list.innerHTML = "";

    if (!reminders.length) {
        list.innerHTML = `
            <div class="empty-state" style="text-align:center; padding:30px 10px; color:#94a3b8;">
                <div style="font-size:3rem; margin-bottom:8px;">⏰</div>
                <strong style="display:block; font-size:1.1rem; color:#f8fafc; margin-bottom:4px;">No reminders set</strong>
                <small>Create reminders so Kuya B can keep you on schedule.</small>
            </div>
        `;
        return;
    }

    // Sort by soonest date + time
    const sorted = [...reminders].sort((a, b) => {
        const dtA = new Date(`${a.date}T${a.time || "00:00"}`);
        const dtB = new Date(`${b.date}T${b.time || "00:00"}`);
        return dtA - dtB;
    });

    sorted.forEach(rem => {
        const card = document.createElement("div");
        card.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:12px; margin-bottom:10px; background:rgba(255,255,255,0.06); border-radius:14px;";

        let repeatBadge = "";
        if (rem.repeat && rem.repeat !== "none") {
            repeatBadge = `<span style="font-size:0.75rem; background:rgba(249,115,22,0.2); color:#fb923c; padding:2px 6px; border-radius:6px; margin-left:6px;">🔁 ${rem.repeat}</span>`;
        }

        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
                <div style="font-size:1.8rem;">⏰</div>
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center;">
                        <strong style="font-size:0.95rem; color:#f8fafc; word-break:break-word;">
                            ${escapeHtml(rem.title)}
                        </strong>
                        ${repeatBadge}
                    </div>
                    <span style="font-size:0.8rem; color:#38bdf8; display:block; margin-top:2px;">
                        📅 ${escapeHtml(rem.date)} &nbsp;•&nbsp; 🕒 ${escapeHtml(rem.time)}
                    </span>
                </div>
            </div>
            <div style="display:flex; gap:6px; margin-left:8px;">
                <button class="rem-edit" type="button" data-id="${escapeHtml(rem.id)}" style="background:none; border:none; font-size:1.1rem; padding:6px; cursor:pointer;">✏️</button>
                <button class="rem-delete" type="button" data-id="${escapeHtml(rem.id)}" style="background:none; border:none; font-size:1.1rem; padding:6px; cursor:pointer;">🗑️</button>
            </div>
        `;

        list.appendChild(card);
    });

    list.querySelectorAll(".rem-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            const item = reminders.find(r => r.id === btn.dataset.id);
            if (item) showReminderForm(item);
        });
    });

    list.querySelectorAll(".rem-delete").forEach(btn => {
        btn.addEventListener("click", () => deleteReminder(btn.dataset.id));
    });
}
