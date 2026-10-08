/* =========================================================
   KUYA B — MODULAR APP ROUTER & SHELL ENGINE
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};

    var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    if (tg) {
        try {
            tg.ready();
            tg.expand();
        } catch (e) {}
    }

    // ---------------------------------------------------------
    // HAPTICS & TOAST NOTIFICATIONS
    // ---------------------------------------------------------
    window.KuyaB.triggerHaptic = function (style) {
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
    };

    window.KuyaB.showToast = function (message) {
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
    };

    // ---------------------------------------------------------
    // PARAMETER RESOLVER (Deep Links, Telegram start_param, Query, Hash)
    // ---------------------------------------------------------
    window.KuyaB.getParam = function (key) {
        if (key === "start" && tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
            return tg.initDataUnsafe.start_param;
        }
        var urlParams = new URLSearchParams(window.location.search);
        var val = urlParams.get(key);
        if (val) return val;

        if (window.location.hash) {
            var hashQuery = window.location.hash.substring(1);
            var hashParams = new URLSearchParams(hashQuery);
            var hashVal = hashParams.get(key);
            if (hashVal) return hashVal;
        }
        return null;
    };

    // ---------------------------------------------------------
    // SHARED STORES
    // ---------------------------------------------------------
    var tasks = [];
    var reminders = [];
    var vaultItems = [];
    var currentVaultType = "other";

    function loadSharedData() {
        try { tasks = JSON.parse(localStorage.getItem("kuyaB_tasks")) || []; } catch (e) { tasks = []; }
        try { reminders = JSON.parse(localStorage.getItem("kuyaB_reminders")) || []; } catch (e) { reminders = []; }
        try { vaultItems = JSON.parse(localStorage.getItem("kuyaB_vault")) || []; } catch (e) { vaultItems = []; }
    }

    // ---------------------------------------------------------
    // PAGE ROUTING
    // ---------------------------------------------------------
    var ALL_PAGES = ["dashboardPage", "birthdaysPage", "dailyLogsPage", "tasksPage", "remindersPage", "vaultPage"];

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
        if (tg && tg.BackButton) tg.BackButton.hide();
    }

    function showPage(pageId, renderFn) {
        hideAllPages();
        var page = document.getElementById(pageId);
        if (page) page.style.display = "block";
        if (typeof renderFn === "function") renderFn();
        if (tg && tg.BackButton) {
            tg.BackButton.show();
            tg.BackButton.onClick(showDashboard);
        }
    }

    // ---------------------------------------------------------
    // TASKS ENGINE
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
            var t = tasks[i];
            var style = t.completed ? 'text-decoration: line-through; opacity: 0.5;' : '';
            var toggleIcon = t.completed ? '↩' : '✓';
            html += '<div class="birthday-card" data-id="' + t.id + '">' +
                '<div class="birthday-info"><span class="birthday-name" style="' + style + '">' + t.title + '</span></div>' +
                '<div class="birthday-actions"><button class="btn-greet" data-action="toggle-task" data-id="' + t.id + '">' + toggleIcon + '</button>' +
                '<button class="btn-delete" data-action="delete-task" data-id="' + t.id + '">🗑️</button></div></div>';
        }
        list.innerHTML = html;
    }

    // ---------------------------------------------------------
    // REMINDERS ENGINE
    // ---------------------------------------------------------
    function displayReminders() {
        var list = document.getElementById("remindersList");
        if (!list) return;
        if (reminders.length === 0) {
            list.innerHTML = '<p class="empty-state">No reminders saved. Tap + to add one!</p>';
            return;
        }
        var html = "";
        for (var i = 0; i < reminders.length; i++) {
            var r = reminders[i];
            html += '<div class="birthday-card" data-id="' + r.id + '">' +
                '<div class="birthday-info"><span class="birthday-name">' + r.title + '</span></div>' +
                '<div class="birthday-actions"><button class="btn-delete" data-action="delete-rem" data-id="' + r.id + '">🗑️</button></div></div>';
        }
        list.innerHTML = html;
    }

    // ---------------------------------------------------------
    // VAULT ENGINE
    // ---------------------------------------------------------
    function setVaultType(type) {
        currentVaultType = type;
        var titleEl = document.getElementById("vaultPageTitle");
        if (titleEl) {
            if (type === "videos") titleEl.innerText = "🎥 Videos";
            else if (type === "pictures") titleEl.innerText = "🖼️ Pictures";
            else titleEl.innerText = "📁 Vault";
        }
    }

    function displayVaultItems() {
        var list = document.getElementById("vaultItemsList");
        if (!list) return;
        var filtered = [];
        for (var i = 0; i < vaultItems.length; i++) {
            if ((vaultItems[i].type || "other") === currentVaultType) filtered.push(vaultItems[i]);
        }
        if (filtered.length === 0) {
            list.innerHTML = '<p class="empty-state">No files saved here yet. Tap + to add one!</p>';
            return;
        }
        var html = "";
        for (var j = 0; j < filtered.length; j++) {
            var item = filtered[j];
            html += '<div class="birthday-card" data-id="' + item.id + '">' +
                '<div class="birthday-info"><div class="birthday-title-row"><span class="birthday-name">' + item.title + '</span>' +
                '<span class="bday-badge">' + (item.folder || "General") + '</span></div><span class="birthday-date">Msg ID: ' + item.messageId + '</span></div>' +
                '<div class="birthday-actions"><button class="btn-greet" data-action="forward-vault" data-msg="' + item.messageId + '">Forward</button>' +
                '<button class="btn-delete" data-action="delete-vault" data-id="' + item.id + '">🗑️</button></div></div>';
        }
        list.innerHTML = html;
    }

    // ---------------------------------------------------------
    // GLOBAL CLICK DISPATCHER
    // ---------------------------------------------------------
    function attachGlobalClicks() {
        document.body.addEventListener("click", function (e) {
            var target = e.target;
            if (!target) return;

            // 1. Dashboard Feature Card Navigation
            var card = target.closest(".feature-card");
            if (card) {
                e.preventDefault();
                var feature = card.getAttribute("data-feature");
                window.KuyaB.triggerHaptic("light");

                if (feature === "birthdays") {
                    showPage("birthdaysPage", window.KuyaB.features.birthdays ? window.KuyaB.features.birthdays.render : null);
                } else if (feature === "daily") {
                    showPage("dailyLogsPage", function () {
                        if (window.KuyaBDaily) window.KuyaBDaily.render();
                        else if (window.KuyaB.features.dailyLogs) window.KuyaB.features.dailyLogs.render();
                    });
                } else if (feature === "tasks") {
                    showPage("tasksPage", displayTasks);
                } else if (feature === "reminders") {
                    showPage("remindersPage", displayReminders);
                } else if (feature === "videos" || feature === "pictures" || feature === "other") {
                    setVaultType(feature);
                    showPage("vaultPage", displayVaultItems);
                } else if (feature === "search") {
                    var searchInput = document.getElementById("dashboardSearchInput");
                    if (searchInput) searchInput.focus();
                }
                return;
            }

            // 2. Back Navigation
            if (target.closest("#birthdayBackButton, #dailyLogsBackButton, #tasksBackButton, #remindersBackButton, #vaultBackButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                showDashboard();
                return;
            }

            // 3. Birthdays Module Delegation
            if (target.closest("#addBirthdayButton")) {
                e.preventDefault();
                var bForm = document.getElementById("birthdayForm");
                if (bForm) bForm.style.display = "block";
                return;
            }
            if (target.closest("#cancelBirthdayButton")) {
                e.preventDefault();
                var bFormCancel = document.getElementById("birthdayForm");
                if (bFormCancel) bFormCancel.style.display = "none";
                return;
            }
            if (target.closest("#saveBirthdayButton")) {
                e.preventDefault();
                if (window.KuyaB.features.birthdays) window.KuyaB.features.birthdays.save();
                return;
            }
            var bdayGreetBtn = target.closest('[data-action="greet-bday"]');
            if (bdayGreetBtn) {
                e.preventDefault();
                if (window.KuyaB.features.birthdays) window.KuyaB.features.birthdays.greet(bdayGreetBtn.getAttribute("data-name"));
                return;
            }
            var bdayDelBtn = target.closest('[data-action="delete-bday"]');
            if (bdayDelBtn) {
                e.preventDefault();
                if (window.KuyaB.features.birthdays) window.KuyaB.features.birthdays.remove(bdayDelBtn.getAttribute("data-id"));
                return;
            }

            // 4. Daily Logs Open Form Handler
            if (target.closest("#addLogButton")) {
                e.preventDefault();
                var lForm = document.getElementById("logForm");
                if (lForm) lForm.style.display = "block";
                return;
            }

            // 5. Tasks Form & Actions Delegation
            if (target.closest("#addTaskButton")) {
                e.preventDefault();
                var tForm = document.getElementById("taskForm");
                if (tForm) tForm.style.display = "block";
                return;
            }
            if (target.closest("#cancelTaskButton")) {
                e.preventDefault();
                var tFormCancel = document.getElementById("taskForm");
                if (tFormCancel) tFormCancel.style.display = "none";
                return;
            }
            if (target.closest("#saveTaskButton")) {
                e.preventDefault();
                var taskTitle = document.getElementById("taskTitle").value.trim();
                if (!taskTitle) return alert("Please enter task.");
                tasks.push({ id: Date.now().toString(), title: taskTitle, completed: false });
                localStorage.setItem("kuyaB_tasks", JSON.stringify(tasks));
                window.KuyaB.triggerHaptic("medium");
                document.getElementById("taskTitle").value = "";
                document.getElementById("taskForm").style.display = "none";
                displayTasks();
                return;
            }
            var taskToggle = target.closest('[data-action="toggle-task"]');
            if (taskToggle) {
                e.preventDefault();
                var tId = taskToggle.getAttribute("data-id");
                for (var i = 0; i < tasks.length; i++) {
                    if (tasks[i].id === tId) {
                        tasks[i].completed = !tasks[i].completed;
                        break;
                    }
                }
                localStorage.setItem("kuyaB_tasks", JSON.stringify(tasks));
                displayTasks();
                return;
            }
            var taskDel = target.closest('[data-action="delete-task"]');
            if (taskDel) {
                e.preventDefault();
                if (confirm("Delete task?")) {
                    tasks = tasks.filter(function (x) { return x.id !== taskDel.getAttribute("data-id"); });
                    localStorage.setItem("kuyaB_tasks", JSON.stringify(tasks));
                    displayTasks();
                }
                return;
            }

            // 6. Reminders Form & Actions Delegation
            if (target.closest("#addReminderButton")) {
                e.preventDefault();
                var rForm = document.getElementById("reminderForm");
                if (rForm) rForm.style.display = "block";
                return;
            }
            if (target.closest("#cancelReminderButton")) {
                e.preventDefault();
                var rFormCancel = document.getElementById("reminderForm");
                if (rFormCancel) rFormCancel.style.display = "none";
                return;
            }
            if (target.closest("#saveReminderButton")) {
                e.preventDefault();
                var remTitle = document.getElementById("reminderTitle").value.trim();
                if (!remTitle) return alert("Please enter reminder.");
                reminders.push({ id: Date.now().toString(), title: remTitle });
                localStorage.setItem("kuyaB_reminders", JSON.stringify(reminders));
                window.KuyaB.triggerHaptic("medium");
                document.getElementById("reminderTitle").value = "";
                document.getElementById("reminderForm").style.display = "none";
                displayReminders();
                return;
            }
            var remDel = target.closest('[data-action="delete-rem"]');
            if (remDel) {
                e.preventDefault();
                if (confirm("Delete reminder?")) {
                    reminders = reminders.filter(function (x) { return x.id !== remDel.getAttribute("data-id"); });
                    localStorage.setItem("kuyaB_reminders", JSON.stringify(reminders));
                    displayReminders();
                }
                return;
            }

            // 7. Vault Form & Actions Delegation
            if (target.closest("#addVaultItemButton")) {
                e.preventDefault();
                var vForm = document.getElementById("vaultItemForm");
                if (vForm) vForm.style.display = "block";
                return;
            }
            if (target.closest("#cancelVaultItemButton")) {
                e.preventDefault();
                var vFormCancel = document.getElementById("vaultItemForm");
                if (vFormCancel) vFormCancel.style.display = "none";
                return;
            }
            if (target.closest("#saveVaultItemButton")) {
                e.preventDefault();
                var vTitle = document.getElementById("vaultItemTitle").value.trim();
                var vFolder = document.getElementById("vaultItemFolder").value.trim() || "General";
                var vMsgId = document.getElementById("vaultItemMsgId").value.trim();
                if (!vTitle || !vMsgId) return alert("Enter title and Message ID.");
                vaultItems.push({ id: Date.now().toString(), title: vTitle, folder: vFolder, messageId: vMsgId, type: currentVaultType });
                localStorage.setItem("kuyaB_vault", JSON.stringify(vaultItems));
                window.KuyaB.triggerHaptic("medium");
                document.getElementById("vaultItemTitle").value = "";
                document.getElementById("vaultItemFolder").value = "";
                document.getElementById("vaultItemMsgId").value = "";
                document.getElementById("vaultItemForm").style.display = "none";
                displayVaultItems();
                return;
            }
            var vaultDel = target.closest('[data-action="delete-vault"]');
            if (vaultDel) {
                e.preventDefault();
                if (confirm("Delete item?")) {
                    vaultItems = vaultItems.filter(function (x) { return x.id !== vaultDel.getAttribute("data-id"); });
                    localStorage.setItem("kuyaB_vault", JSON.stringify(vaultItems));
                    displayVaultItems();
                }
                return;
            }
            var vaultFwd = target.closest('[data-action="forward-vault"]');
            if (vaultFwd) {
                e.preventDefault();
                var mId = vaultFwd.getAttribute("data-msg");
                var uId = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : null;
                if (!uId) return window.KuyaB.showToast("Could not determine user ID.");
                fetch("/api/vault/forward", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messageId: mId, userId: uId })
                }).then(function () {
                    window.KuyaB.showToast("Message forwarded! 🚀");
                }).catch(function () {
                    window.KuyaB.showToast("Failed to forward.");
                });
                return;
            }

            // 8. Word Game Trigger
            if (target.closest("#gameButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                alert("Use /game in chat to play Word Scramble!");
                return;
            }

            // 9. Quick Add Content Trigger
            if (target.closest("#addContentButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                setVaultType("other");
                showPage("vaultPage", function () {
                    displayVaultItems();
                    var vf = document.getElementById("vaultItemForm");
                    if (vf) vf.style.display = "block";
                });
                return;
            }
        });
    }

    // ---------------------------------------------------------
    // INITIALIZATION RUNNER
    // ---------------------------------------------------------
    function init() {
        loadSharedData();

        if (window.KuyaB.features.birthdays) {
            window.KuyaB.features.birthdays.init();
        }

        attachGlobalClicks();

        var msgId = window.KuyaB.getParam("msg_id");
        var chatId = window.KuyaB.getParam("chat_id");
        var startSection = window.KuyaB.getParam("start");

        if (msgId && chatId) {
            fetch("/api/cleanup-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, message_id: msgId })
            }).catch(function () {});
        }

        // Direct Route on Launch
        if (startSection === "birthdays") {
            showPage("birthdaysPage", window.KuyaB.features.birthdays ? window.KuyaB.features.birthdays.render : null);
        } else if (startSection === "daily") {
            showPage("dailyLogsPage", function () {
                if (window.KuyaBDaily) window.KuyaBDaily.render();
                else if (window.KuyaB.features.dailyLogs) window.KuyaB.features.dailyLogs.render();
            });
        } else if (startSection === "tasks") {
            showPage("tasksPage", displayTasks);
        } else if (startSection === "reminders") {
            showPage("remindersPage", displayReminders);
        } else if (startSection === "videos" || startSection === "pictures" || startSection === "other") {
            setVaultType(startSection);
            showPage("vaultPage", displayVaultItems);
        } else {
            showDashboard();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
