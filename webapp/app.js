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
    // PARAMETER RESOLVER
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
    // DATA STORES
    // ---------------------------------------------------------
    var tasks = [];
    var reminders = [];
    var vaultItems = [];
    var currentVaultType = "other";

    function loadSharedData() {
        try { tasks = JSON.parse(localStorage.getItem("kuyaB_tasks")) || []; } catch (e) { tasks = []; }
        try { reminders = JSON.parse(localStorage.getItem("kuyaB_reminders")) || []; } catch (e) { reminders = []; }
    }

    // ---------------------------------------------------------
    // PAGE ROUTING
    // ---------------------------------------------------------
    var ALL_PAGES = [
        "dashboardPage", 
        "birthdaysPage", 
        "dailyLogsPage", 
        "tasksPage", 
        "remindersPage", 
        "vaultPage", 
        "userTrackingPage",
        "addBirthdayStandalonePage"
    ];

    function hideAllForms() {
        var formIds = ["birthdayForm", "logForm", "taskForm", "reminderForm", "vaultUploadForm"];
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
            var style = t.completed ? "text-decoration: line-through; opacity: 0.5;" : "";
            var toggleIcon = t.completed ? "↩" : "✓";
            html += '<div class="birthday-card" data-id="' + t.id + '">' +
                '<div class="birthday-info"><span class="birthday-name" style="' + style + '">' + t.title + '</span></div>' +
                '<div class="birthday-actions"><button type="button" class="btn-greet" data-action="toggle-task" data-id="' + t.id + '">' + toggleIcon + '</button>' +
                '<button type="button" class="btn-delete" data-action="delete-task" data-id="' + t.id + '">🗑️</button></div></div>';
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
                '<div class="birthday-actions"><button type="button" class="btn-delete" data-action="delete-rem" data-id="' + r.id + '">🗑️</button></div></div>';
        }
        list.innerHTML = html;
    }

    // ---------------------------------------------------------
    // VAULT ENGINE & MEDIA UPLOAD
    // ---------------------------------------------------------
    function setVaultType(type) {
        currentVaultType = type;
        var titleEl = document.getElementById("vaultPageTitle");
        var otherActions = document.getElementById("otherActionsBar");

        if (otherActions) {
            var isAdmin = window.KuyaB.features.tracking && window.KuyaB.features.tracking.isAdmin();
            otherActions.style.display = (type === "other" && isAdmin) ? "block" : "none";
        }

        if (titleEl) {
            if (type === "videos") titleEl.innerText = "🎥 Videos";
            else if (type === "pictures") titleEl.innerText = "🖼️ Pictures";
            else titleEl.innerText = "📁 Other";
        }
    }

    async function fetchVaultItems() {
        try {
            var res = await fetch("/api/vault/items");
            var data = await res.json();
            vaultItems = data.vault || [];
        } catch (e) {
            vaultItems = [];
        }
    }

    async function displayVaultItems() {
        var list = document.getElementById("vaultItemsList");
        if (!list) return;

        await fetchVaultItems();

        var filtered = [];
        for (var i = 0; i < vaultItems.length; i++) {
            if ((vaultItems[i].type || "other") === currentVaultType) filtered.push(vaultItems[i]);
        }

        if (filtered.length === 0) {
            list.innerHTML = '<p class="empty-state">No items saved in this section yet. Tap + to upload!</p>';
            return;
        }

        var html = "";
        for (var j = 0; j < filtered.length; j++) {
            var item = filtered[j];
            var linkBtn = item.link ? '<a href="' + item.link + '" target="_blank" class="btn-greet" style="text-decoration:none; display:inline-flex; align-items:center;">Link 🔗</a>' : '';

            html += '<div class="birthday-card" data-id="' + item.id + '">' +
                '<div class="birthday-info">' +
                    '<div class="birthday-title-row">' +
                        '<span class="birthday-name">' + (item.title || "Untitled") + '</span>' +
                        '<span class="bday-badge-days">' + (item.folder || "General") + '</span>' +
                    '</div>' +
                    '<span class="birthday-date">Msg ID: ' + (item.messageId || item.id) + '</span>' +
                '</div>' +
                '<div class="birthday-actions">' +
                    linkBtn +
                    '<button type="button" class="btn-greet" data-action="forward-vault" data-msg="' + item.messageId + '">Send</button>' +
                    '<button type="button" class="btn-delete" data-action="delete-vault" data-id="' + item.id + '">🗑️</button>' +
                '</div>' +
            '</div>';
        }
        list.innerHTML = html;
    }

    window.KuyaB.uploadMediaToVault = async function () {
        var fileInput = document.getElementById("vaultItemFile");
        var titleInput = document.getElementById("vaultItemTitle");
        var folderInput = document.getElementById("vaultItemFolder");

        if (!fileInput || !fileInput.files.length) {
            alert("Please select a photo or video to upload.");
            return;
        }

        var file = fileInput.files[0];
        var isVideo = file.type.startsWith("video/");
        var determinedType = currentVaultType === "other" ? (isVideo ? "videos" : "pictures") : currentVaultType;

        var formData = new FormData();
        formData.append("file", file);
        formData.append("title", titleInput.value.trim() || "Untitled");
        formData.append("folder", folderInput.value.trim() || "General");
        formData.append("type", determinedType);

        var btn = document.getElementById("btnUploadMedia");
        if (btn) btn.innerText = "Uploading...";

        try {
            var res = await fetch("/api/vault/upload", {
                method: "POST",
                body: formData
            });
            var data = await res.json();
            if (data.success) {
                window.KuyaB.triggerHaptic("success");
                window.KuyaB.showToast("Uploaded to Vault Channel! 📁");
                if (titleInput) titleInput.value = "";
                if (folderInput) folderInput.value = "";
                if (fileInput) fileInput.value = "";
                document.getElementById("vaultUploadForm").style.display = "none";
                displayVaultItems();
            } else {
                alert("Upload failed: " + (data.error || "Server error"));
            }
        } catch (err) {
            alert("Network error communicating with Kuya B backend.");
        } finally {
            if (btn) btn.innerText = "Upload";
        }
    };

    // ---------------------------------------------------------
    // GLOBAL CLICK DISPATCHER
    // ---------------------------------------------------------
    function attachGlobalClicks() {
        document.body.addEventListener("click", function (e) {
            var target = e.target;
            if (!target) return;

            // 1. Dashboard Navigation
            var card = target.closest(".feature-card");
            if (card) {
                e.preventDefault();
                var feature = card.getAttribute("data-feature");
                window.KuyaB.triggerHaptic("light");

                if (feature === "birthdays") {
                    showPage("birthdaysPage", function () {
                        if (window.KuyaB.features.birthdays) window.KuyaB.features.birthdays.render();
                    });
                } else if (feature === "daily") {
                    showPage("dailyLogsPage", function () {
                        if (window.KuyaB.features.dailyLogs) window.KuyaB.features.dailyLogs.render();
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

            // 3. User Tracking Navigation
            if (target.closest("#btnOpenUserTracking")) {
                e.preventDefault();
                if (window.KuyaB.features.tracking && window.KuyaB.features.tracking.isAdmin()) {
                    window.KuyaB.triggerHaptic("light");
                    showPage("userTrackingPage", function () {
                        window.KuyaB.features.tracking.render();
                    });
                }
                return;
            }

            if (target.closest("#userTrackingBackButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                setVaultType("other");
                showPage("vaultPage", displayVaultItems);
                return;
            }

            // 4. Birthdays Page Delegation
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

            // 5. Daily Logs Open Form
            if (target.closest("#addLogButton")) {
                e.preventDefault();
                var lForm = document.getElementById("logForm");
                if (lForm) lForm.style.display = "block";
                return;
            }

            // 6. Tasks Delegation
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

            // 7. Reminders Delegation
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

            // 8. Vault Delegation
            if (target.closest("#addVaultItemButton")) {
                e.preventDefault();
                var vf = document.getElementById("vaultUploadForm");
                if (vf) vf.style.display = "block";
                return;
            }
            if (target.closest("#cancelVaultItemButton")) {
                e.preventDefault();
                var vfCancel = document.getElementById("vaultUploadForm");
                if (vfCancel) vfCancel.style.display = "none";
                return;
            }
            var vaultDel = target.closest('[data-action="delete-vault"]');
            if (vaultDel) {
                e.preventDefault();
                var dId = vaultDel.getAttribute("data-id");
                if (confirm("Delete media from vault and channel?")) {
                    fetch("/api/vault/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: dId })
                    }).then(function () {
                        displayVaultItems();
                    });
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

            // 9. Word Game
            if (target.closest("#gameButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                alert("Use /game in chat to play Word Scramble!");
                return;
            }

            // 10. Quick Add Content
            if (target.closest("#addContentButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                setVaultType("other");
                showPage("vaultPage", function () {
                    displayVaultItems();
                    var vf = document.getElementById("vaultUploadForm");
                    if (vf) vf.style.display = "block";
                });
                return;
            }
        });
    }

    // ---------------------------------------------------------
    // INITIALIZATION & ROUTING
    // ---------------------------------------------------------
    function init() {
        loadSharedData();
        attachGlobalClicks();

        if (window.KuyaB.features.tracking) {
            window.KuyaB.features.tracking.track();
        }

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

        if (startSection === "add_bday") {
            hideAllPages();
            var popupPage = document.getElementById("addBirthdayStandalonePage");
            if (popupPage) popupPage.style.display = "block";
            return;
        }

        if (startSection === "birthdays") {
            showPage("birthdaysPage", function () {
                if (window.KuyaB.features.birthdays) window.KuyaB.features.birthdays.render();
            });
        } else if (startSection === "daily") {
            showPage("dailyLogsPage", function () {
                if (window.KuyaB.features.dailyLogs) window.KuyaB.features.dailyLogs.render();
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
