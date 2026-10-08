/* =========================================================
   KUYA B — DAILY LOGS FEATURE MODULE (SELF-HEALING)
   ========================================================= */

window.KuyaB = window.KuyaB || {};
window.KuyaB.features = window.KuyaB.features || {};

window.KuyaB.features.dailyLogs = (function () {
    "use strict";

    var logs = [];
    var selectedMood = "😊";

    var MOODS = [
        { emoji: "😊", label: "Happy" },
        { emoji: "😔", label: "Sad" },
        { emoji: "🥺", label: "Lonely" },
        { emoji: "😡", label: "Angry" },
        { emoji: "😴", label: "Tired" },
        { emoji: "✨", label: "Excited" },
        { emoji: "🧘", label: "Calm" }
    ];

    function load() {
        try {
            logs = JSON.parse(localStorage.getItem("kuyaB_dailyLogs")) || [];
        } catch (e) {
            logs = [];
        }
    }

    function renderMoodSelector() {
        var container = document.getElementById("moodSelectorContainer");
        if (!container) return;

        var html = "";
        for (var i = 0; i < MOODS.length; i++) {
            var m = MOODS[i];
            var isSelected = m.emoji === selectedMood ? " selected" : "";
            html += '<button type="button" class="mood-pill' + isSelected + '" data-mood="' + m.emoji + '" title="' + m.label + '">' +
                '<span class="mood-emoji">' + m.emoji + '</span>' +
                '<span class="mood-label">' + m.label + '</span>' +
            '</button>';
        }
        container.innerHTML = html;
    }

    function render() {
        var list = document.getElementById("dailyLogsList");
        if (!list) return;

        load();

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
                        '<span class="log-date">' + (item.date || "Unknown Date") + '</span>' +
                        '<span class="log-time">' + (item.time || "") + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="log-actions">' +
                    '<button class="btn-delete" data-action="delete-log" data-id="' + item.id + '">🗑️</button>' +
                '</div>' +
            '</div>';
        }
        list.innerHTML = html;
    }

    function save() {
        var noteEl = document.getElementById("logContent");
        var content = noteEl ? noteEl.value.trim() : "";

        var now = new Date();
        var dateFormatted = now.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
        var timeFormatted = now.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit"
        });

        logs.unshift({
            id: Date.now().toString(),
            mood: selectedMood,
            content: content,
            date: dateFormatted,
            time: timeFormatted
        });

        localStorage.setItem("kuyaB_dailyLogs", JSON.stringify(logs));
        if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("medium");

        if (noteEl) noteEl.value = "";
        var form = document.getElementById("logForm");
        if (form) form.style.display = "none";

        render();
    }

    function remove(id) {
        if (confirm("Delete this log entry?")) {
            logs = logs.filter(function (x) { return x.id !== id; });
            localStorage.setItem("kuyaB_dailyLogs", JSON.stringify(logs));
            if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("medium");
            render();
            closeDetail();
        }
    }

    function view(id) {
        var log = logs.find(function (x) { return x.id === id; });
        if (!log) return;

        var modal = document.getElementById("logDetailModal");
        var emojiEl = document.getElementById("modalLogEmoji");
        var dateEl = document.getElementById("modalLogDate");
        var textEl = document.getElementById("modalLogContent");

        if (emojiEl) emojiEl.innerText = log.mood || "📝";
        if (dateEl) dateEl.innerText = (log.date || "") + " • " + (log.time || "");
        if (textEl) {
            textEl.innerText = log.content ? log.content : "(No additional details written for this log)";
        }

        if (modal) modal.style.display = "flex";
        if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
    }

    function closeDetail() {
        var modal = document.getElementById("logDetailModal");
        if (modal) modal.style.display = "none";
    }

    function init() {
        load();
        renderMoodSelector();

        // Capture clicks directly to avoid app.js interference
        document.addEventListener("click", function (e) {
            var target = e.target;
            if (!target) return;

            // When + Add Log is tapped, ensure moods are rendered
            if (target.closest("#addLogButton")) {
                renderMoodSelector();
                return;
            }

            // Mood pill selection
            var pill = target.closest(".mood-pill");
            if (pill) {
                e.preventDefault();
                e.stopPropagation();
                selectedMood = pill.getAttribute("data-mood");
                renderMoodSelector();
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                return;
            }

            // Direct Save Button Handler
            if (target.closest("#saveLogButton")) {
                e.preventDefault();
                e.stopPropagation();
                save();
                return;
            }

            // View log modal
            var viewTrigger = target.closest('[data-action="view-log"]');
            if (viewTrigger) {
                e.preventDefault();
                view(viewTrigger.getAttribute("data-id"));
                return;
            }

            // Delete log
            var deleteTrigger = target.closest('[data-action="delete-log"]');
            if (deleteTrigger) {
                e.preventDefault();
                remove(deleteTrigger.getAttribute("data-id"));
                return;
            }

            // Close modal
            if (target.closest("#closeLogDetailBtn") || target.id === "logDetailModal") {
                e.preventDefault();
                closeDetail();
                return;
            }
        }, true); // Use capture phase so it runs before app.js crashes
    }

    // Auto-run init as soon as DOM loads
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    return {
        init: init,
        render: render,
        save: save
    };
})();
