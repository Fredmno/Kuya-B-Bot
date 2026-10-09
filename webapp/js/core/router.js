/* =========================================================
   KUYA B — VIEW ROUTER & NAVIGATION CONTROLLER
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.router = window.KuyaB.router || {};

    var ALL_PAGES = [
        "dashboardPage",
        "birthdaysPage",
        "dailyLogsPage",
        "tasksPage",
        "remindersPage",
        "vaultPage",
        "userTrackingPage",
        "addBirthdayStandalonePage",
        "addContentPage",
        "adminUpdaterPage"
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
        if (window.KuyaB.tg && window.KuyaB.tg.BackButton) window.KuyaB.tg.BackButton.hide();
    }

    function showPage(pageId, renderFn) {
        hideAllPages();
        var page = document.getElementById(pageId);
        if (page) page.style.display = "block";
        if (typeof renderFn === "function") renderFn();
        if (window.KuyaB.tg && window.KuyaB.tg.BackButton) {
            window.KuyaB.tg.BackButton.show();
            window.KuyaB.tg.BackButton.onClick(showDashboard);
        }
    }

    window.KuyaB.router.showDashboard = showDashboard;
    window.KuyaB.router.showPage = showPage;
    window.KuyaB.router.hideAllPages = hideAllPages;
})();
