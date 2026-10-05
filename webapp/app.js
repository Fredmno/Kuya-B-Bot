/* =========================================================
   KUYA B — PERSONAL HUB (MAIN APP)
   ========================================================= */

import { tg, triggerHaptic } from "./modules/helpers.js";
import {
    loadBirthdays,
    showBirthdayForm,
    hideBirthdayForm,
    saveBirthday,
    displayBirthdays
} from "./modules/birthdays.js";

import {
    loadDailyLogs,
    showLogForm,
    hideLogForm,
    saveLog,
    setMood,
    displayDailyLogs
} from "./modules/dailyLogs.js";

import {
    loadTasks,
    showTaskForm,
    hideTaskForm,
    saveTask,
    displayTasks
} from "./modules/tasks.js";

import {
    loadReminders,
    showReminderForm,
    hideReminderForm,
    saveReminder,
    displayReminders
} from "./modules/reminders.js";

// ---------------------------------------------------------
// NAVIGATION & PAGE ROUTING
// ---------------------------------------------------------

function hideAllForms() {
    hideBirthdayForm();
    hideLogForm();
    hideTaskForm();
    hideReminderForm();
}

function showDashboard() {
    const dashboard = document.getElementById("dashboardPage");
    const birthdays = document.getElementById("birthdaysPage");
    const dailyLogs = document.getElementById("dailyLogsPage");
    const tasksPage = document.getElementById("tasksPage");
    const remindersPage = document.getElementById("remindersPage");

    if (dashboard) dashboard.style.display = "block";
    if (birthdays) birthdays.style.display = "none";
    if (dailyLogs) dailyLogs.style.display = "none";
    if (tasksPage) tasksPage.style.display = "none";
    if (remindersPage) remindersPage.style.display = "none";

    hideAllForms();

    if (tg?.BackButton) {
        tg.BackButton.hide();
    }
}

function showBirthdays() {
    showDashboard();
    document.getElementById("dashboardPage").style.display = "none";
    const page = document.getElementById("birthdaysPage");
    if (page) page.style.display = "block";

    displayBirthdays();

    if (tg?.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(showDashboard);
    }
}

function showDailyLogs() {
    showDashboard();
    document.getElementById("dashboardPage").style.display = "none";
    const page = document.getElementById("dailyLogsPage");
    if (page) page.style.display = "block";

    displayDailyLogs();

    if (tg?.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(showDashboard);
    }
}

function showTasks() {
    showDashboard();
    document.getElementById("dashboardPage").style.display = "none";
    const page = document.getElementById("tasksPage");
    if (page) page.style.display = "block";

    displayTasks();

    if (tg?.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(showDashboard);
    }
}

function showReminders() {
    showDashboard();
    document.getElementById("dashboardPage").style.display = "none";
    const page = document.getElementById("remindersPage");
    if (page) page.style.display = "block";

    displayReminders();

    if (tg?.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(showDashboard);
    }
}

// ---------------------------------------------------------
// APP BOOTSTRAP
// ---------------------------------------------------------

function initApp() {
    loadBirthdays();
    loadDailyLogs();
    loadTasks();
    loadReminders();
    showDashboard();

    document.addEventListener("click", function (e) {
        // --- Navigation ---
        if (e.target.closest('[data-feature="birthdays"]')) {
            e.preventDefault();
            triggerHaptic("light");
            showBirthdays();
            return;
        }

        if (e.target.closest('[data-feature="daily"]')) {
            e.preventDefault();
            triggerHaptic("light");
            showDailyLogs();
            return;
        }

        if (e.target.closest('[data-feature="tasks"]')) {
            e.preventDefault();
            triggerHaptic("light");
            showTasks();
            return;
        }

        if (e.target.closest('[data-feature="reminders"]')) {
            e.preventDefault();
            triggerHaptic("light");
            showReminders();
            return;
        }

        if (e.target.closest("#birthdayBackButton, #dailyLogsBackButton, #tasksBackButton, #remindersBackButton")) {
            e.preventDefault();
            triggerHaptic("light");
            showDashboard();
            return;
        }

        // --- Birthdays Actions ---
        if (e.target.closest("#addBirthdayButton")) {
            e.preventDefault();
            triggerHaptic("light");
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

        // --- Daily Logs Actions ---
        if (e.target.closest("#addLogButton")) {
            e.preventDefault();
            triggerHaptic("light");
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
            triggerHaptic("light");
            setMood(moodBtn.dataset.mood);
            return;
        }

        // --- Tasks Actions ---
        if (e.target.closest("#addTaskButton")) {
            e.preventDefault();
            triggerHaptic("light");
            showTaskForm();
            return;
        }
        if (e.target.closest("#cancelTaskButton")) {
            e.preventDefault();
            hideTaskForm();
            return;
        }
        if (e.target.closest("#saveTaskButton")) {
            e.preventDefault();
            saveTask();
            return;
        }

        // --- Reminders Actions ---
        if (e.target.closest("#addReminderButton")) {
            e.preventDefault();
            triggerHaptic("light");
            showReminderForm();
            return;
        }
        if (e.target.closest("#cancelReminderButton")) {
            e.preventDefault();
            hideReminderForm();
            return;
        }
        if (e.target.closest("#saveReminderButton")) {
            e.preventDefault();
            saveReminder();
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
            if (!["birthdays", "daily", "tasks", "reminders"].includes(name)) {
                e.preventDefault();
                alert(`${name.charAt(0).toUpperCase() + name.slice(1)} module coming soon.`);
            }
        }
    });

    // Enter key submission on Task & Reminder title inputs
    ["taskTitle", "reminderTitle"].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener("keydown", function (e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    if (id === "taskTitle") saveTask();
                    if (id === "reminderTitle") saveReminder();
                }
            });
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

        bdayDateInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                saveBirthday();
            }
        });
    }

    const bdayNameInput = document.getElementById("birthdayName");
    if (bdayNameInput) {
        bdayNameInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                saveBirthday();
            }
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
