/* =========================================================
   KUYA B — ROUTER MODULE
   webapp/modules/router.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.router = window.KuyaB.router || {};

    var PAGES = [
        "dashboardPage",
        "birthdaysPage",
        "dailyLogsPage",
        "tasksPage",
        "remindersPage",
        "vaultPage",
        "addContentPage",
        "adminUpdaterPage",
        "userTrackingPage"
    ];

    window.KuyaB.router.showPage = function (pageId, callback) {
        PAGES.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) {
                el.style.display = (id === pageId) ? "block" : "none";
            }
        });

        window.scrollTo(0, 0);

        if (typeof callback === "function") {
            try {
                callback();
            } catch (err) {
                console.error("Router callback error:", err);
            }
        }
    };

    window.KuyaB.router.showDashboard = function () {
        window.KuyaB.router.showPage("dashboardPage");
    };
})();
