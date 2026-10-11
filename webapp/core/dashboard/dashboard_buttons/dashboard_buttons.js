/* =========================================================
   KUYA B — DASHBOARD & NAVIGATION BUTTONS MODULE
   webapp/core/dashboard/dashboard_buttons/dashboard_buttons.js
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

            // 1. SPECIFIC TILES INSIDE "OTHER" FOLDER
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

            // 2. MAIN DASHBOARD FEATURE CARDS
            var card = target.closest(".feature-card");
            if (card && card.hasAttribute("data-feature")) {
                e.preventDefault();
                var feature = card.getAttribute("data-feature");
                triggerHaptic("light");

                if (feature === "birthdays") {
                    if (r.
