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

import {
    loadVault,
    setVaultType,
    showVaultForm,
    hideVaultForm,
    saveVaultItem,
    displayFolderBar,
    displayVaultItems
} from "./modules/vault.js";


// ---------------------------------------------------------
// NAVIGATION & PAGE ROUTING
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
    hideBirthdayForm();
    hideLogForm();
    hideTaskForm();
    hideReminderForm();
    hideVaultForm();
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

    if (renderFn) renderFn();

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
    loadVault();

    // 1. Auto-clean the triggering launcher message in chat
    const urlParams = new URLSearchParams(window.location.search);
    const msgId = urlParams.get("msg_id");
    const chatId = urlParams.get("chat_id");

    if (msgId && chatId) {
        fetch("/api/cleanup-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId })
        }).catch(() => {});
    }

    // 2. Direct Feature Routing (Bypasses Dashboard if ?start= is present)
    const startSection = urlParams.get("start");

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
        showPage("vaultPage", () => {
            displayFolderBar();
            displayVaultItems();
        });
    } else {
        showDashboard();
    }

    // ---------------------------------------------------------
    // GLOBAL EVENT LISTENERS
    // ---------------------------------------------------------
    document.addEventListener("click", function (e) {
        // --- Navigation: Personal ---
        if (e.target.closest('[data-feature="birthdays"]')) {
            e.preventDefault();
            triggerHaptic("light");
            showPage("birthdaysPage", displayBirthdays);
            return;
        }

        if (e.target.closest('[data-feature="daily"]')) {
            e.preventDefault();
            triggerHaptic("light");
            showPage("dailyLogsPage", displayDailyLogs);
            return;
        }

        if (e.target.closest('[data-feature="tasks"]')) {
            e.preventDefault();
            triggerHaptic("light");
            showPage("tasksPage", displayTasks);
            return;
        }

        if (e.target.closest('[data-feature="reminders"]')) {
            e.preventDefault();
            triggerHaptic("light");
            showPage("remindersPage", displayReminders);
            return;
        }

        // --- Navigation: Vault (Videos, Pictures, Other) ---
        const vaultTrigger = e.target.closest(
            '[data-feature="videos"], [data-feature="pictures"], [data-feature="other"]'
        );
        if (vaultTrigger) {
            e.preventDefault();
            triggerHaptic("light");
            const type = vaultTrigger.dataset.feature;
            setVaultType(type);
            showPage("vaultPage", () => {
                displayFolderBar();
                displayVaultItems();
            });
            return;
        }

        // Back to Dashboard
        if (e.target.closest("#birthdayBackButton, #dailyLogsBackButton, #tasksBackButton, #remindersBackButton, #vaultBackButton")) {
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

        // --- Vault Actions ---
        if (e.target.closest("#addVaultItemButton")) {
            e.preventDefault();
            triggerHaptic("light");
            showVaultForm();
            return;
        }
        if (e.target.closest("#cancelVaultItemButton")) {
            e.preventDefault();
            hideVaultForm();
            return;
        }
        if (e.target.closest("#saveVaultItemButton")) {
            e.preventDefault();
            saveVaultItem();
            return;
        }

        // --- Bottom Actions & Placeholders ---
        if (e.target.closest("#addContentButton")) {
            e.preventDefault();
            triggerHaptic("light");
            setVaultType("other");
            showPage("vaultPage", () => {
                displayVaultItems();
                showVaultForm();
            });
            return;
        }

        if (e.target.closest("#gameButton")) {
            e.preventDefault();
            alert("Word Scramble launcher ready!");
            return;
        }

        if (e.target.closest('#searchButton, [data-feature="search"]')) {
            e.preventDefault();
            alert("Universal Search coming next!");
            return;
        }
    });

    // Enter key submissions
    ["taskTitle", "reminderTitle", "vaultItemTitle"].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener("keydown", function (e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    if (id === "taskTitle") saveTask();
                    if (id === "reminderTitle") saveReminder();
                    if (id === "vaultItemTitle") saveVaultItem();
                }
            });
        }
    });

    // Auto-dash format for birthday date input
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