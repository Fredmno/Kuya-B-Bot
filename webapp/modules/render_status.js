/* =========================================================
   KUYA B — RENDER DEPLOY STATUS MODULE
   webapp/modules/render_status.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.renderStatus = {};

    var pollInterval = null;

    window.KuyaB.renderStatus.check = async function () {
        try {
            var res = await fetch("/api/admin/deploy-status?t=" + Date.now());
            var data = await res.json();
            return data;
        } catch (err) {
            console.error("Failed to check deploy status:", err);
            return { success: false, error: "Network error" };
        }
    };

    // Automatically polls until the status becomes 'live' or fails
    window.KuyaB.renderStatus.startPolling = function (onUpdate) {
        if (pollInterval) clearInterval(pollInterval);

        pollInterval = setInterval(async function () {
            var data = await window.KuyaB.renderStatus.check();
            if (typeof onUpdate === "function") {
                onUpdate(data);
            }

            if (data.status === "live" || data.status === "build_failed" || data.status === "canceled") {
                clearInterval(pollInterval);
                pollInterval = null;
            }
        }, 5000); // Check every 5 seconds
    };

    window.KuyaB.renderStatus.stopPolling = function () {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    };
})();
