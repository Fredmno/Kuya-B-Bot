/* =========================================================
   KUYA B — MODULAR VIEW & SCRIPT BUNDLER / LOADER
   ========================================================= */

(function () {
    "use strict";

    var scripts = document.getElementsByTagName("script");
    var currentScript = scripts[scripts.length - 1];
    var src = currentScript ? currentScript.getAttribute("src") : "";
    var vMatch = src ? src.match(/[?&]v=([^&]+)/) : null;
    var v = vMatch ? vMatch[1] : "1.0.0";

    var viewList = [
        "/app/views/modals.html",
        "/app/views/dashboard.html",
        "/app/views/birthdays.html",
        "/app/views/daily_logs.html",
        "/app/views/tasks.html",
        "/app/views/reminders.html",
        "/app/views/vault.html",
        "/app/views/add_content.html"
    ];

    var scriptList = [
        "/app/js/core/utils.js",
        "/app/js/core/router.js",
        "/app/modules/birthdays.js",
        "/app/modules/daily_logs.js",
        "/app/modules/tracking.js",
        "/app/js/features/vault.js",
        "/app/js/features/tasks.js",
        "/app/js/features/reminders.js",
        "/app/app.js"
    ];

    async function loadViews() {
        var appContainer = document.getElementById("app");
        if (!appContainer) return;

        try {
            var promises = viewList.map(function (url) {
                return fetch(url + "?v=" + encodeURIComponent(v)).then(function (res) {
                    if (!res.ok) throw new Error("Could not load " + url);
                    return res.text();
                });
            });

            var htmlParts = await Promise.all(promises);
            appContainer.innerHTML = htmlParts.join("\n");
        } catch (err) {
            console.error("View loading failed:", err);
        }
    }

    function loadScriptSequentially(index) {
        if (index >= scriptList.length) return;

        var scriptUrl = scriptList[index] + "?v=" + encodeURIComponent(v);
        var tag = document.createElement("script");
        tag.src = scriptUrl;
        tag.async = false;

        tag.onload = function () {
            loadScriptSequentially(index + 1);
        };

        tag.onerror = function () {
            console.error("Failed to load script:", scriptUrl);
            loadScriptSequentially(index + 1);
        };

        document.body.appendChild(tag);
    }

    loadViews().then(function () {
        loadScriptSequentially(0);
    });
})();
