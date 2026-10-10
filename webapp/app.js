/* =========================================================
   KUYA B — APPLICATION ENTRYPOINT
   webapp/app.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};

    function init() {
        if (window.Telegram && window.Telegram.WebApp) {
            window.KuyaB.tg = window.Telegram.WebApp;
            try {
                window.KuyaB.tg.ready();
                window.KuyaB.tg.expand();
            } catch (e) {}
        }

        var feats = window.KuyaB.features || {};
        var r = window.KuyaB.router || {};

        if (feats.vault && feats.vault.initFileInput) feats.vault.initFileInput();
        if (window.KuyaB.initAddContentInput) window.KuyaB.initAddContentInput();

        if (feats.tracking && feats.tracking.track) {
            feats.tracking.track();
        }

        // Deep link router (?start=...)
        var params = new URLSearchParams(window.location.search);
        var startSection = params.get("start");

        if (startSection === "birthdays") {
            if (r.showPage) r.showPage("birthdaysPage", feats.birthdays ? feats.birthdays.render : null);
        } else if (startSection === "videos" || startSection === "pictures" || startSection === "other") {
            if (feats.vault) feats.vault.setVaultType(startSection);
            if (r.showPage) r.showPage("vaultPage", feats.vault ? feats.vault.render : null);
        } else if (startSection === "admin_updater") {
            if (window.KuyaB.clearFileCommitterForm) window.KuyaB.clearFileCommitterForm();
            if (r.showPage) r.showPage("adminUpdaterPage", window.KuyaB.loadRepoTree);
        } else {
            if (r.showDashboard) r.showDashboard();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
