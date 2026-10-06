/* =========================================================
   KUYA B — PERSONAL HUB (BULLETPROOF ROUTING & ENGINE)
   ========================================================= */

(function () {
    "use strict";

    var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    if (tg) {
        try {
            tg.ready();
            tg.expand();
        } catch (e) {}
    }

    function triggerHaptic(style) {
        style = style || "light";
        try {
            if (tg && tg.HapticFeedback) {
                if (style === "light" || style === "medium" || style === "heavy") {
                    tg.HapticFeedback.impactOccurred(style);
                } else if (style === "success" || style === "error" || style === "warning") {
                    tg.HapticFeedback.notificationOccurred(style);
                }
            }
        } catch (e) {}
    }

    function showToast(message) {
        var toast = document.getElementById("toastNotification");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "toastNotification";
            document.body.appendChild(toast);
        }
        toast.innerText = message;
        toast.style.display = "block";
        setTimeout(function () {
            toast.style.display = "none";
        }, 2800);
    }

    var birthdays = [];
    var dailyLogs = [];
    var tasks = [];
    var reminders = [];
    var vaultItems = [];
    var currentVaultType = "other";

    function loadData() {
        try { birthdays = JSON.parse(localStorage.getItem("kuyaB_birthdays")) || []; } catch (e) { birthdays = []; }
        try { dailyLogs = JSON.parse(localStorage.getItem("kuyaB_dailyLogs")) || []; } catch (e) { dailyLogs = []; }
        try { tasks = JSON.parse(localStorage.getItem("kuyaB_tasks")) || []; } catch (e) { tasks = []; }
        try { reminders = JSON.parse(localStorage.getItem("kuyaB_reminders")) || []; } catch (e) { reminders = []; }
        try { vaultItems = JSON.parse(localStorage.getItem("kuyaB_vault")) || []; } catch (e) { vaultItems = []; }
    }

    var ALL_PAGES = [
        "dashboardPage",
        "birthdaysPage",
        "dailyLogsPage",
        "tasksPage",
        "remindersPage",
        "vaultPage"
    ];

    function hideAllForms() {
        var formIds = ["birthdayForm", "logForm", "taskForm", "reminderForm", "vaultItemForm"];
        for (var i = 0; i < formIds.length; i++) {
            var el = document.getElementById(formIds[i]);
            if (el) el.style.display = "none";
        }
    }

    function hideAllPages() {
        for (var i = 0; i < ALL_PAGES.length; i++) {
            var page = document.getElementById(ALL_PAGES[i]);
            if (page) page.style.display = "none";
        }
        hideAllForms();
    }

    function showDashboard() {
        hideAllPages();
        var dashboard = document.getElementById("dashboardPage");
        if (dashboard) dashboard.style.display = "block";

        if (tg && tg.BackButton) {
            tg.BackButton.hide();
        }
    }

    function showPage(pageId, renderFn) {
        hideAllPages();
        var page = document.getElementById(pageId);
        if (page) page.style.display = "block";

        if (typeof renderFn === "function") {
            renderFn();
        }

        if (tg && tg.BackButton) {
            tg.BackButton.show();
            tg.BackButton.onClick(showDashboard);
        }
    }

    // ---------------------------------------------------------
    // PARAMETER DETECTOR (Supports Search, Telegram Start Param & Hash)
    // ---------------------------------------------------------
    function getParam(key) {
        // 1. Direct Telegram start_param
        if (key === "start" && tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
            return tg.initDataUnsafe.start_param;
        }

        // 2. Standard Query URL
        var urlParams = new URLSearchParams(window.location.search);
        var val = urlParams.get(key);
        if (val) return val;

        // 3. Hash URL fallback (e.g. #start=birthdays)
        if (window.location.hash) {
            var hashQuery = window.location.hash.substring(1);
            var hashParams = new URLSearchParams(hashQuery);
            var hashVal = hashParams.get(key);
            if (hashVal) return hashVal;
        }

        return null;
    }

    // ---------------------------------------------------------
    // BIRTHDAYS LOGIC
    // ---------------------------------------------------------
    function calculateDaysLeft(dateStr) {
        if (!dateStr || dateStr.indexOf("-") === -1) return 999;
        var parts = dateStr.split("-");
        var month = parseInt(parts[0], 10);
        var day = parseInt(parts[1], 10);
        var today = new Date();
        var currentYear = today.getFullYear();

        var next = new Date(currentYear, month - 1, day);
        var todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (next < todayMidnight) {
            next = new Date(currentYear + 1, month - 1, day);
        }

        var diff = next - todayMidnight;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    function displayBirthdays() {
        var list = document.getElementById("birthdaysList");
        if (!list) return;

        if (birthdays.length === 0) {
            list.innerHTML = '<p class="empty-state">No birthdays saved yet. Tap + to add one!</p>';
            return;
        }

        var sorted = birthdays.slice().sort(function (a, b) {
            return calculateDaysLeft(a.date) - calculateDaysLeft(b.date);
        });

        var html = "";
        for (var i = 0; i < sorted.length; i++) {
            var b = sorted[i];
            var daysLeft = calculateDaysLeft(b.date);
            var badge = '<span class="bday-badge">' + daysLeft + ' days left</span>';
            var greetButtonHtml = "";

            // The Greet button ONLY shows when the birthday is today
            if (daysLeft === 0) {
                badge = '<span class="bday-badge today">🎉 Today!</span>';
                greetButtonHtml = '<button class="btn-greet" data-action="greet" data-name="' + b.name + '">📢 Greet</button>';
            } else if (daysLeft === 1) {
                badge = '<span class="bday-badge">Tomorrow</span>';
            }

            html += '<div class="birthday-card" data-id="' + b.id + '">' +
                '<div class="birthday-info">' +
                    '<div class="birthday-title-row">' +
                        '<span class="birthday-name">' + b.name + '</span>' +
                        badge +
                    '</div>' +
                    '<span class="birthday-date">📅 ' + b.date + '</span>' +
                '</div>' +
                '<div class="birthday-actions">' +
                    greetButtonHtml +
                    '<button class="btn-delete" data-action="delete" data-type="birthday" data-id="' + b.id + '">🗑️</button>' +
                '</div>' +
            '</div>';
        }
        list.innerHTML = html;
    }

    function saveBirthday() {
        var nameEl = document.getElementById("birthdayName");
        var dateEl = document.getElementById("birthdayDate");
        var name = nameEl ? nameEl.value.trim() : "";
        var date = dateEl ? dateEl.value.trim() : "";

        if (!name || !date) {
            alert("Please enter both a name and date (MM-DD).");
            return;
        }

        birthdays.push({ id: Date.now().toString(), name: name, date: date });
        localStorage.setItem("kuyaB_birthdays", JSON.stringify(birthdays));
        triggerHaptic("medium");

        if (nameEl) nameEl.value = "";
        if (dateEl) dateEl.value = "";
        var form = document.getElementById("birthdayForm");
        if (form) form.style.display = "none";
        displayBirthdays();
    }

    function sendGreetingToChat(name) {
        var chatId = getParam("chat_id");
        if (!chatId) {
            showToast("Open via /kuyab inside a group chat to send greetings!");
            return;
        }

        triggerHaptic("medium");
        fetch("/api/birthdays/greet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, name: name })
        }).then(function (res) {
            return res.json();
        }).then(function (data) {
            if (data.success) {
                showToast("Greeting sent for " + name + "! 🎉");
            } else {
                showToast("Failed to send greeting.");
            }
        }).catch(function () {
            showToast("Network error.");
        });
    }

    // ---------------------------------------------------------
    // DAILY LOGS LOGIC
    // ---------------------------------------------------------
    function displayDailyLogs() {
        var list = document.getElementById("dailyLogsList");
        if (!list) return;

        if (dailyLogs.length === 0) {
            list.innerHTML = '<p class="empty-state">No daily logs saved yet. Tap + to add one!</p>';
            return;
        }

        var html = "";
        for (var i = 0; i < dailyLogs.length; i++) {
            var l = dailyLogs[i];
            html += '<div class="birthday-card" data-id="' + l.id + '">' +
                '<div class="birthday-info">' +
                    '<span class="birthday-name">' + l.title + '</span>' +
                    '<span class="birthday-date">' + (l.content || "") + '</span>' +
                '</div>' +
                '<div class="birthday-actions">' +
                    '<button class="btn-delete" data-action="delete" data-type="log" data-id="' + l.id + '">🗑️</button>' +
                '</div>' +
            '</div>';
        }
        list.innerHTML = html;
    }

    function saveLog() {
        var titleEl = document.getElementById("logTitle");
        var contentEl = document.getElementById("logContent");
        var title = titleEl ? titleEl.value.trim() : "";
        var content = contentEl ? contentEl.value.trim() : "";

        if (!title) {
            alert("Please enter a title or summary.");
            return;
        }

        dailyLogs.unshift({ id: Date.now().toString(), title: title, content: content, date: new Date().toLocaleDateString() });
        localStorage.setItem("kuyaB_dailyLogs", JSON.stringify(dailyLogs));
        triggerHaptic("medium");

        if (titleEl) titleEl.value = "";
        if (contentEl) contentEl.value = "";
        var form = document.getElementById("logForm");
        if (form) form.style.display = "none";
        displayDailyLogs();
    }

    // ---------------------------------------------------------
    // TASKS LOGIC
    // ---------------------------------------------------------
    function displayTasks() {
        var list = document.getElementById("tasksList");
        if (!list) return;

        if (tasks.length === 0) {
            list.innerHTML = '<p class="empty-state">No tasks pending. Tap + to add one!</p>';
            return;
        }

        var html = "";
        for (var i = 0; i < tasks.length; i++) {
            var t
