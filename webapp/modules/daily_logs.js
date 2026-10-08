/* =========================================================
   KUYA B — DAILY LOGS (STANDALONE CONTROLLER)
   ========================================================= */

(function () {
    "use strict";

    var selectedMood = "😊";

    function getLogs() {
        try {
            return JSON.parse(localStorage.getItem("kuyaB_dailyLogs")) || [];
        } catch (e) {
            return [];
        }
    }

    function saveLogs(logs) {
        localStorage.setItem("kuyaB_dailyLogs", JSON.stringify(logs));
    }

    function renderDailyLogs() {
        var list = document.getElementById("dailyLogsList");
        if (!list) return;

        var logs = getLogs();
        if (logs.length === 0) {
            list.innerHTML = '<p class="empty-state">No logs yet. Tap + to record how you feel!</p>';
            return;
        }

        var html = "";
        for (var i = 0; i < logs.length; i++) {
            var item = logs[i];
            html += '<div class="daily-log-card" data-id="' + item.id + '">' +
                '<div class="log-clickable-area" data-action="view-log" data-id="' + item.id + '">' +
                    '<span class="log-emoji-badge">' + (item.mood || "📝") + '</span>' +
                    '<div class="log-date-column">' +
                        '<span class="log-date">' + (item.date || "") + '</span>' +
                        '<span class="log-time">' + (item.time || "") + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="log-actions">' +
                    '<button type="button" class="btn-delete" data-action="delete-log" data-id="' + item.id + '">🗑️</button>' +
                '</div>' +
            '</div>';
        }
        list.innerHTML = html;
    }

    function handleSave() {
        var noteEl = document.getElementById("logContent");
        var content = noteEl ? noteEl.value.trim() : "";

        var now = new Date();
        var dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        var timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

        var logs = getLogs();
        logs.unshift({
            id: Date.now().toString(),
            mood: selectedMood,
            content: content,
            date: dateStr,
            time: timeStr
        });

        saveLogs(logs);

        if (window.KuyaB && window.KuyaB.triggerHaptic) {
            window.KuyaB.triggerHaptic("medium");
        }

        if (noteEl) noteEl.value = "";
        var form = document.getElementById("logForm");
        if (form) form.style.display = "none";

        renderDailyLogs();
    }

    function handleDelete(id) {
        if (confirm("Delete this log entry?")) {
            var logs = getLogs().filter(function (x) { return x.id !== id; });
            saveLogs(logs);
            if (window.KuyaB && window.KuyaB.triggerHaptic) {
                window.KuyaB.triggerHaptic("medium");
            }
            renderDailyLogs();
            var modal = document.getElementById("logDetailModal");
            if (modal) modal.style.display = "none";
        }
    }

    function handleView(id) {
        var log = getLogs().find(function (x) { return x.id === id; });
        if (!log) return;

        var modal = document.getElementById("logDetailModal");
        var emojiEl = document.getElementById("modalLogEmoji");
        var dateEl = document.getElementById("modalLogDate");
        var textEl = document.getElementById("modalLogContent");

        if (emojiEl) emojiEl.innerText = log.mood || "📝";
        if (dateEl) dateEl.innerText = (log.date || "") + " • " + (log.time || "");
        if (textEl) textEl.innerText = log.content ? log.content : "(No additional details written for this log)";

        if (modal) modal.style.display = "flex";
        if (window.KuyaB && window.KuyaB.triggerHaptic) {
            window.KuyaB.triggerHaptic("light");
        }
    }

    // Direct event listener
    document.addEventListener("click", function (e) {
        var target = e.target;
        if (!target) return;

        // 1. Mood pill selector
        var pill = target.closest(".mood-pill");
        if (pill) {
            e.preventDefault();
            var pills = document.querySelectorAll(".mood-pill");
            for (var i = 0; i < pills.length; i++) {
                pills[i].classList.remove("selected");
            }
            pill.classList.add("selected");
            selectedMood = pill.getAttribute("data-mood") || "😊";
            if (window.KuyaB && window.KuyaB.triggerHaptic) {
                window.KuyaB.triggerHaptic("light");
            }
            return;
        }

        // 2. Save Log Button
        if (target.closest("#saveLogButton")) {
            e.preventDefault();
            e.stopImmediatePropagation();
            handleSave();
            return;
        }

        // 3. Cancel Log Button
        if (target.closest("#cancelLogButton")) {
            e.preventDefault();
            var form = document.getElementById("logForm");
            if (form) form.style.display = "none";
            return;
        }

        // 4. View Detail Click
        var viewRow = target.closest('[data-action="view-log"]');
        if (viewRow) {
            e.preventDefault();
            handleView(viewRow.getAttribute("data-id"));
            return;
        }

        // 5. Delete Entry Click
        var delBtn = target.closest('[data-action="delete-log"]');
        if (delBtn) {
            e.preventDefault();
            e.stopImmediatePropagation();
            handleDelete(delBtn.getAttribute("data-id"));
            return;
        }

        // 6. Close Modal
        if (target.closest("#closeLogDetailBtn") || target.id === "logDetailModal") {
            e.preventDefault();
            var modal = document.getElementById("logDetailModal");
            if (modal) modal.style.display = "none";
            return;
        }
    }, true);

    // Initial render when script loads
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderDailyLogs);
    } else {
        renderDailyLogs();
    }

    // Export render so router can call it
    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};
    window.KuyaB.features.dailyLogs = {
        render: renderDailyLogs,
        save: handleSave
    };
})();
