/* =========================================================
   KUYA B — MODULAR SCRIPT BUNDLER / LOADER
   ========================================================= */

(function () {
    "use strict";

    // Extract current cache-busting version parameter
    var scripts = document.getElementsByTagName("script");
    var currentScript = scripts[scripts.length - 1];
    var src = currentScript ? currentScript.getAttribute("src") : "";
    var vMatch = src ? src.match(/[?&]v=([^&]+)/) : null;
    var v = vMatch ? vMatch[1] : "1.0.0";

    // Ordered list of scripts to load sequentially
    var scriptList = [
        // 1. Core Engine
        "/app/js/core/utils.js",
        "/app/js/core/router.js",

        // 2. Feature Modules
        "/app/modules/birthdays.js",
        "/app/modules/daily_logs.js",
        "/app/modules/tracking.js",
        "/app/js/features/vault.js",
        "/app/js/features/tasks.js",
        "/app/js/features/reminders.js",

        // 3. Main Shell Orchestrator
        "/app/app.js"
    ];

    function loadScriptSequentially(index) {
        if (index >= scriptList.length) return;

        var scriptUrl = scriptList[index] + "?v=" + encodeURIComponent(v);
        var tag = document.createElement("script");
        tag.src = scriptUrl;
        tag.async = false; // Preserves execution order

        tag.onload = function () {
            loadScriptSequentially(index + 1);
        };

        tag.onerror = function () {
            console.error("Failed to load script:", scriptUrl);
            loadScriptSequentially(index + 1);
        };

        document.body.appendChild(tag);
    }

    loadScriptSequentially(0);
})();
