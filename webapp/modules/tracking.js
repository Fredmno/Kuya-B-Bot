/* =========================================================
   KUYA B — USER TRACKING MODULE (ADMIN SECURED)
   ========================================================= */

window.KuyaB = window.KuyaB || {};
window.KuyaB.features = window.KuyaB.features || {};

window.KuyaB.features.tracking = (function () {
    "use strict";

    // Set to your numeric Telegram user ID
    var ADMIN_USER_ID = 1234567890;

    function isAdmin() {
        var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
        var currentUserId = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : null;
        return String(currentUserId) === String(ADMIN_USER_ID);
    }

    function track() {
        var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
        var user = tg && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;
        if (!user) return;

        var now = new Date();
        var dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        var timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

        fetch("/api/track-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: user.id,
                first_name: user.first_name || "",
                username: user.username || "N/A",
                timestamp: dateStr + " • " + timeStr
            })
        }).catch(function () {});
    }

    async function render() {
        var container = document.getElementById("usersListContainer");
        if (!container) return;
        if (!isAdmin()) {
            container.innerHTML = '<p class="empty-state">Unauthorized access.</p>';
            return;
        }

        container.innerHTML = '<p class="empty-state">Loading user activity...</p>';

        try {
            var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
            var user = tg && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;
            var currentUserId = user ? user.id : "";

            var res = await fetch("/api/users?user_id=" + currentUserId);
            var data = await res.json();
            var users = data.users || [];

            if (users.length === 0) {
                container.innerHTML = '<p class="empty-state">No users tracked yet.</p>';
                return;
            }

            var html = "";
            for (var i = 0; i < users.length; i++) {
                var u = users[i];
                var handle = u.username && u.username !== "N/A" ? "@" + u.username : "No username";
                html += '<div class="birthday-card" style="margin-bottom: 10px;">' +
                    '<div class="birthday-info">' +
                        '<div class="birthday-title-row">' +
                            '<span class="birthday-name">👤 ' + (u.first_name || "Anonymous") + '</span>' +
                            '<span class="bday-badge-days">' + (u.visits || 1) + ' visit' + (u.visits > 1 ? "s" : "") + '</span>' +
                        '</div>' +
                        '<span class="birthday-date" style="font-size: 0.78rem; color: var(--text-muted);">' + handle + ' • ID: ' + u.id + '</span>' +
                        '<span class="birthday-date" style="font-size: 0.74rem; color: var(--primary-blue); margin-top: 2px;">Last: ' + (u.last_seen || "Recent") + '</span>' +
                    '</div>' +
                '</div>';
            }
            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = '<p class="empty-state">Error loading user logs.</p>';
        }
    }

    return {
        isAdmin: isAdmin,
        track: track,
        render: render
    };
})();
