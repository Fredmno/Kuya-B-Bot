/* =========================================================
   KUYA B — FEATURE: USER ACTIVITY TRACKING
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};

    function getTelegramUser() {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
            return window.Telegram.WebApp.initDataUnsafe.user;
        }
        if (window.KuyaB.tg && window.KuyaB.tg.initDataUnsafe && window.KuyaB.tg.initDataUnsafe.user) {
            return window.KuyaB.tg.initDataUnsafe.user;
        }
        return null;
    }

    function isAdmin() {
        return true;
    }

    async function track() {
        var user = getTelegramUser();

        if (!user) {
            console.warn("[Tracking] Telegram user context not detected.");
            return;
        }

        try {
            var payload = {
                id: String(user.id),
                username: user.username || "",
                first_name: user.first_name || "",
                last_name: user.last_name || ""
            };

            var res = await fetch("/api/track-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            var result = await res.json();
            if (!result.success) {
                console.error("[Tracking] Track failed:", result);
            } else {
                console.log("[Tracking] Visit counted successfully!");
            }
        } catch (e) {
            console.error("[Tracking] Network error recording user activity:", e);
        }
    }

    async function render() {
        var container = document.getElementById("usersListContainer");
        if (!container) return;

        container.innerHTML = '<p class="empty-state">Loading user activity...</p>';

        try {
            var res = await fetch("/api/users?t=" + Date.now());
            var data = await res.json();
            var users = data.users || [];

            if (users.length === 0) {
                container.innerHTML = '<p class="empty-state">No user activity recorded yet.</p>';
                return;
            }

            var html = "";
            for (var i = 0; i < users.length; i++) {
                var u = users[i];
                var displayName = (u.first_name + " " + (u.last_name || "")).trim() || "User " + u.id;
                var handle = u.username ? "@" + u.username : "No handle";
                var visits = u.visit_count ? u.visit_count + " visits" : "1 visit";

                html += '<div class="birthday-card" style="margin-bottom: 10px;">' +
                    '<div class="birthday-info">' +
                        '<div class="birthday-title-row">' +
                            '<span class="birthday-name">' + displayName + '</span>' +
                            '<span class="bday-badge-days">' + visits + '</span>' +
                        '</div>' +
                        '<span class="birthday-date">' + handle + ' • Last seen: ' + (u.last_seen || "N/A") + '</span>' +
                    '</div>' +
                '</div>';
            }
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<p class="empty-state">Error loading user logs.</p>';
        }
    }

    window.KuyaB.features.tracking = {
        track: track,
        render: render,
        isAdmin: isAdmin
    };
})();
