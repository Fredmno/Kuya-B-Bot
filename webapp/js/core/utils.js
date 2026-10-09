/* =========================================================
   KUYA B — CORE UTILITIES & HELPERS
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.core = window.KuyaB.core || {};

    var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

    if (tg) {
        try {
            tg.ready();
            tg.expand();
        } catch (e) {}
    }

    window.KuyaB.tg = tg;

    // Haptic feedback triggers
    window.KuyaB.triggerHaptic = function (style) {
        style = style || "light";
        try {
            if (tg && tg.HapticFeedback) {
                if (style === "light" || style === "medium" || style === "heavy") {
                    tg.HapticFeedback.impactOccurred(style);
                } else if (style === "success" || style === "error" || style === "warning") {
                    tg.HapticFeedback.notificationOccurred(style);
                }
            }
        } catch (e) {}
    };

    // Global toast messages
    window.KuyaB.showToast = function (message) {
        var toast = document.getElementById("toastNotification");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "toastNotification";
            document.body.appendChild(toast);
        }
        toast.innerText = message;
        toast.style.display = "block";
        setTimeout(function () {
            toast.style.display = "none";
        }, 2800);
    };

    // URL & Telegram start parameter resolver
    window.KuyaB.getParam = function (key) {
        if (key === "start" && tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
            return tg.initDataUnsafe.start_param;
        }
        var urlParams = new URLSearchParams(window.location.search);
        var val = urlParams.get(key);
        if (val) return val;

        if (window.location.hash) {
            var hashQuery = window.location.hash.substring(1);
            var hashParams = new URLSearchParams(hashQuery);
            var hashVal = hashParams.get(key);
            if (hashVal) return hashVal;
        }
        return null;
    };
})();
