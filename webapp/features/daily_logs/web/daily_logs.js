(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};

    var dailyLogs = {};
    var selectedMood = "😊";
    var selectedHabits = [];

    function getCurrentUser() {
        var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : (window.KuyaB.tg || null);
        return (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;
    }

    dailyLogs.render = async function () {
        var user = getCurrentUser();
        var userId = user ? user.id : "";

        var lockScreen = document.getElementById("dailyLogsLockScreen");
        var mainContent = document.getElementById("dailyLogsMainContent");
        var addBtn = document.getElementById("addLogButton");
        var container = document.getElementById("dailyLogsList");

        try {
            var res = await fetch("/api/logs?user_id=" + encodeURIComponent(userId) + "&t=" + Date.now());
            var data = await res.json();

            // Handle unauthorized access
            if (data.access === false) {
                if (lockScreen) lockScreen.style.display = "block";
                if (mainContent) mainContent.style.display = "none";
                if (addBtn) addBtn.style.display = "none";
                return;
            }

            // Authorized: show logs & controls
            if (lockScreen) lockScreen.style.display = "none";
            if (mainContent) mainContent.style.display = "block";
            if (addBtn) addBtn.style.display = "block";

            var list = data.logs || [];
            if (!container) return;

            if (list.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 32px 16px; color: var(--text-muted, #94a3b8);"><div style="font-size: 2rem; margin-bottom: 8px;">📅</div>No daily logs recorded yet.</div>';
                return;
            }

            var html = '<div style="padding: 12px 16px;">';
            list.forEach(function (log) {
                html += '<div style="background: var(--bg-card, #1e293b); padding: 14px 16px; border-radius: 14px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.06);">' +
                    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">' +
                        '<span style="font-size: 1.4rem;">' + (log.mood || "😊") + '</span>' +
                        '<span style="font-size: 0.78rem; color: var(--text-muted, #94a3b8);">' + (log.created_at || "") + '</span>' +
                    '</div>' +
                    '<div style="font-size: 0.88rem; color: #fff; margin-bottom: 6px;">' + (log.content || "No notes") + '</div>' +
                '</div>';
            });
            html += '</div>';
            container.innerHTML = html;

        } catch (e) {
            console.error("Failed to load logs:", e);
        }
    };

    dailyLogs.requestAccess = async function () {
        var user = getCurrentUser();
        var reqBtn = document.getElementById("btnRequestLogsAccess");
        var statusLabel = document.getElementById("requestLogsStatus");

        if (!user) {
            alert("Could not detect your Telegram profile. Please open inside Telegram.");
            return;
        }

        if (reqBtn) reqBtn.disabled = true;

        try {
            var res = await fetch("/api/logs/request-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: user.id,
                    name: (user.first_name || "") + " " + (user.last_name || ""),
                    username: user.username || ""
                })
            });
            var data = await res.json();
            if (data.success) {
                if (statusLabel) {
                    statusLabel.innerText = "Access request sent to Kuya B! 📨";
                    statusLabel.style.display = "block";
                }
            } else {
                alert("Failed: " + (data.error || "Could not submit request."));
                if (reqBtn) reqBtn.disabled = false;
            }
        } catch (err) {
            alert("Network error submitting request.");
            if (reqBtn) reqBtn.disabled = false;
        }
    };

    dailyLogs.selectMood = function (el, emoji) {
        selectedMood = emoji;
        var pills = document.querySelectorAll("#moodSelectorContainer .mood-pill");
        pills.forEach(function (p) { p.classList.remove("selected"); });
        if (el) el.classList.add("selected");
    };

    dailyLogs.toggleHabit = function (el) {
        var habit = el.getAttribute("data-habit");
        if (el.classList.contains("selected")) {
            el.classList.remove("selected");
            selectedHabits = selectedHabits.filter(function (h) { return h !== habit; });
        } else {
            el.classList.add("selected");
            selectedHabits.push(habit);
        }
    };

    window.KuyaB.features.dailyLogs = dailyLogs;
})();
