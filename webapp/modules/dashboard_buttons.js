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

            // 1. Dashboard Feature Cards
            var card = target.closest(".feature-card");
            if (card && !card.hasAttribute("data-action")) {
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

            // 2. Back Buttons
            if (target.closest("#birthdayBackButton, #dailyLogsBackButton, #tasksBackButton, #remindersBackButton")) {
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

            // 3. Vault Add Button (+) & Cancel Button
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

            // 4. Word Game Card
            if (target.closest("#gameButton")) {
                e.preventDefault();
                triggerHaptic("light");
                alert("Use /game in chat to play Word Scramble!");
                return;
            }

            // 5. User Activity Card
            if (target.closest("#btnOpenUserTracking")) {
                e.preventDefault();
                triggerHaptic("light");
                if (r.showPage) r.showPage("userTrackingPage", feats.tracking ? feats.tracking.render : null);
                return;
            }

            if (target.closest("#userTrackingBackButton")) {
                e.preventDefault();
                triggerHaptic("light");
                openVaultCategory("other");
                return;
            }

            // 6. File Committer Card
            if (target.closest("#btnAdminUpdater")) {
                e.preventDefault();
                triggerHaptic("light");
                if (window.KuyaB.clearFileCommitterForm) window.KuyaB.clearFileCommitterForm();
                if (r.showPage) r.showPage("adminUpdaterPage", window.KuyaB.loadRepoTree);
                return;
            }

            if (target.closest("#adminUpdaterBackButton, #cancelAdminUpdaterButton")) {
                e.preventDefault();
                triggerHaptic("light");
                if (window.KuyaB.clearFileCommitterForm) window.KuyaB.clearFileCommitterForm();
                openVaultCategory("other");
                return;
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initDashboardButtons);
    } else {
        initDashboardButtons();
    }
})();
