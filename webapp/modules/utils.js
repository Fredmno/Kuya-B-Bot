/* =========================================================
   KUYA B — UTILITIES MODULE
   webapp/modules/utils.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};

    window.KuyaB.triggerHaptic = function (type) {
        var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : (window.KuyaB.tg || null);
        if (tg && tg.HapticFeedback) {
            if (type === "success" || type === "error" || type === "warning") {
                tg.HapticFeedback.notificationOccurred(type);
            } else {
                tg.HapticFeedback.impactOccurred(type || "light");
            }
        }
    };

    window.KuyaB.showToast = function (message) {
        alert(message);
    };

    window.KuyaB.initAddContentInput = function () {
        var fileEl = document.getElementById("newContentFile");
        var nameLabel = document.getElementById("newContentFileName");
        if (fileEl && nameLabel) {
            fileEl.addEventListener("change", function () {
                if (this.files && this.files.length > 0) {
                    nameLabel.innerText = this.files[0].name;
                    nameLabel.style.color = "#1e293b";
                } else {
                    nameLabel.innerText = "No file chosen";
                    nameLabel.style.color = "#64748b";
                }
            });
        }
    };
})();
