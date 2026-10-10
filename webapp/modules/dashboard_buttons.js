/* =========================================================
   KUYA B — DASHBOARD & NAVIGATION BUTTONS MODULE
   Handles feature cards, back buttons, and dashboard actions
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

    function initDashboardButtons() {
        document.body.addEventListener("click", function (e) {
            var target = e.target;
            if (!target) return;

            var r = getRouter();
            var feats = getFeatures();

            // 1. Dashboard Feature Cards (.feature-card)
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
                    if (feats.vault) feats.vault.setVaultType(feature);
                    if (r.showPage) r.showPage("vaultPage", feats.vault ? feats.vault.render : null);
                }
                return;
            }

            // 2. Navigation Back Buttons
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

            // 3. Add Content Button (+ Add Content on dashboard)
            if (target.closest("#addContentButton")) {
                e.preventDefault();
                triggerHaptic("light");
                if (r.showPage) r.showPage("addContentPage");
                return;
            }

            if (target.closest("#addContentBackButton, #cancelAddContentButton")) {
                e.preventDefault();
                triggerHaptic("light");
                if (r.showDashboard) r.showDashboard();
                return;
            }

            // 4. Word Game Card
            if (target.closest("#gameButton")) {
                e.preventDefault();
                triggerHaptic("light");
                alert("Use /game in chat to play Word Scramble!");
                return;
            }

            // 5. User Activity Navigation
            if (target.closest("#btnOpenUserTracking")) {
                e.preventDefault();
                triggerHaptic("light");
                if (r.showPage) r.showPage("userTrackingPage", feats.tracking ? feats.tracking.render : null);
                return;
            }

            if (target.closest("#userTrackingBackButton")) {
                e.preventDefault();
                triggerHaptic("light");
                if (feats.vault) feats.vault.setVaultType("other");
                if (r.showPage) r.showPage("vaultPage", feats.vault ? feats.vault.render : null);
                return;
            }

            // 6. Admin File Committer Navigation
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
                if (feats.vault) feats.vault.setVaultType("other");
                if (r.showPage) r.showPage("vaultPage", feats.vault ? feats.vault.render : null);
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
