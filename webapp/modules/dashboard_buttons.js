/* =========================================================
   KUYA B — DASHBOARD & NAVIGATION BUTTONS MODULE
   webapp/modules/dashboard_buttons.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};

    function getRouter() {
        return window.KuyaB.router || {};
    }

    function getFeatures() {
        return window.KuyaB.features || {};
    }

    function triggerHaptic(type) {
        if (window.KuyaB.triggerHaptic) {
            window.KuyaB.triggerHaptic(type || "light");
        } else if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type || "light");
        }
    }

    function openVaultCategory(type) {
        var r = getRouter();
        var feats = getFeatures();

        var titleEl = document.getElementById("vaultPageTitle");
        var otherBar = document.getElementById("otherActionsBar");

        if (titleEl) {
            if (type === "videos") titleEl.innerText = "🎥 Videos";
            else if (type === "pictures") titleEl.innerText = "🖼️ Pictures";
            else titleEl.innerText = "📁 Other";
        }

        // Show Word Game, Committer, User Activity ONLY in Other folder
        if (otherBar) {
            otherBar.style.display = (type === "other") ? "block" : "none";
        }

        if (feats.vault && feats.vault.setVaultType) {
            feats.vault.setVaultType(type);
        }

        if (r.showPage) {
            r.showPage("vaultPage", feats.vault ? feats.vault.render : null);
        }
    }

    function initDashboardButtons() {
        document.body.addEventListener("click", function (e) {
            var target = e.target;
            if (!target) return;

            var r = getRouter();
            var feats = getFeatures();

            // 1. SPECIFIC TILES INSIDE "OTHER" FOLDER (Checked first to avoid interception)
            var gameBtn = target.closest("#gameButton");
            if (gameBtn) {
                e.preventDefault();
                triggerHaptic("light");
                alert("Use /game in chat to play Word Scramble!");
                return;
            }

            var committerBtn = target.closest("#btnAdminUpdater");
            if (committerBtn) {
                e.preventDefault();
                triggerHaptic("light");
                if (window.KuyaB.clearFileCommitterForm) window.KuyaB.clearFileCommitterForm();
                if (r.showPage) r.showPage("adminUpdaterPage", window.KuyaB.loadRepoTree);
                return;
            }

            var trackingBtn = target.closest("#btnOpenUserTracking");
            if (trackingBtn) {
                e.preventDefault();
                triggerHaptic("light");
                if (r.showPage) r.showPage("userTrackingPage", feats.tracking ? feats.tracking.render : null);
                return;
            }

            var deployStatusBtn = target.closest("#btnDeployStatus");
            if (deployStatusBtn) {
                e.preventDefault();
                triggerHaptic("light");
                if (window.KuyaB.renderStatus && window.KuyaB.renderStatus.check) {
                    window.KuyaB.renderStatus.check().then(function (res) {
                        alert("Deploy Status: " + (res.status || "Unknown"));
                    });
                } else {
                    alert("Deploy Status: Operational");
                }
                return;
            }

            // 2. MAIN DASHBOARD FEATURE CARDS (Must have data-feature)
            var card = target.closest(".feature-card");
            if (card && card.hasAttribute("data-feature")) {
                e.preventDefault();
                var feature = card.getAttribute("data-feature");
                triggerHaptic("light");

                if (feature === "birthdays") {
                    if (r.showPage) r.showPage("birthdaysPage", feats.birthdays ? feats.birthdays.render : null);
                } else if (feature === "daily") {
                    if (r.showPage) r.showPage("dailyLogsPage", feats.dailyLogs ? feats.dailyLogs.render : null);
                } else if (feature === "tasks") {
                    if (r.showPage) r.showPage("tasksPage", feats.tasks ? feats.tasks.render : null);
                } else if (feature === "reminders") {
                    if (r.showPage) r.showPage("remindersPage", feats.reminders ? feats.reminders.render : null);
                } else if (feature === "videos" || feature === "pictures" || feature === "other") {
                    openVaultCategory(feature);
                }
                return;
            }

            // 3. BACK NAVIGATION BUTTONS
            if (target.closest("#tasksBackButton")) {
                e.preventDefault();
                triggerHaptic("light");
                if (feats.tasks && feats.tasks.getActiveFolder && feats.tasks.getActiveFolder()) {
                    feats.tasks.backToFolders();
                } else {
                    if (r.showDashboard) r.showDashboard();
                }
                return;
            }

            if (target.closest("#birthdayBackButton, #dailyLogsBackButton, #remindersBackButton")) {
                e.preventDefault();
                triggerHaptic("light");
                if (r.showDashboard) r.showDashboard();
                return;
            }

            if (target.closest("#vaultBackButton")) {
                e.preventDefault();
                triggerHaptic("light");
                if (feats.vault && feats.vault.getActiveFolder && feats.vault.getActiveFolder()) {
                    feats.vault.backToFolders();
                } else {
                    if (r.showDashboard) r.showDashboard();
                }
                return;
            }

            if (target.closest("#userTrackingBackButton")) {
                e.preventDefault();
                triggerHaptic("light");
                openVaultCategory("other");
                return;
            }

            if (target.closest("#adminUpdaterBackButton, #cancelAdminUpdaterButton")) {
                e.preventDefault();
                triggerHaptic("light");
                if (window.KuyaB.clearFileCommitterForm) window.KuyaB.clearFileCommitterForm();
                openVaultCategory("other");
                return;
            }

            // 4. VAULT ADD (+) & CANCEL BUTTONS
            if (target.closest("#addVaultItemButton")) {
                e.preventDefault();
                triggerHaptic("light");
                var form = document.getElementById("vaultUploadForm");
                if (form) form.style.display = (form.style.display === "none") ? "block" : "none";
                return;
            }

            if (target.closest("#cancelVaultItemButton")) {
                e.preventDefault();
                var form = document.getElementById("vaultUploadForm");
                if (form) form.style.display = "none";
                return;
            }

            // 5. TASKS ADD (+) & CANCEL BUTTONS
            if (target.closest("#addTaskButton")) {
                e.preventDefault();
                triggerHaptic("light");
                var taskForm = document.getElementById("taskForm");
                if (taskForm) {
                    var isHidden = (taskForm.style.display === "none" || !taskForm.style.display);
                    taskForm.style.display = isHidden ? "block" : "none";
                    if (isHidden) {
                        var titleInput = document.getElementById("taskTitle");
                        if (titleInput) titleInput.focus();
                    }
                }
                return;
            }

            if (target.closest("#cancelTaskButton")) {
                e.preventDefault();
                var taskFormToCancel = document.getElementById("taskForm");
                if (taskFormToCancel)
