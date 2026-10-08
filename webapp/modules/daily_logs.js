/* =========================================================
   KUYA B — DAILY LOGS & HABIT TRACKER MODULE
   ========================================================= */

window.KuyaB = window.KuyaB || {};
window.KuyaB.features = window.KuyaB.features || {};

window.KuyaB.features.dailyLogs = (function () {
    "use strict";

    var currentMood = "😊";
    var selectedHabits = [];
    var logs = [];

    function selectMood(btn, mood) {
        var pills = document.querySelectorAll(".mood-pill");
        pills.forEach(function (p) { p.classList.remove("selected"); });
        btn.classList.add("selected");
        currentMood = mood;
        if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
    }

    function toggleHabit(btn) {
        var habit = btn.getAttribute("data-habit");
        if (btn.classList.contains("selected")) {
            btn.classList.remove("selected");
            selectedHabits = selectedHabits.filter(function (h) { return h !== habit; });
        } else {
            btn.classList.add("selected");
            selectedHabits.push(habit);
        }
        if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
    }

    function resetForm() {
        var noteEl = document.getElementById("logContent");
        if (noteEl) noteEl.value = "";
        var chips = document.querySelectorAll(".habit-chip");
        chips.forEach(function (c) { c.classList.remove("selected"); });
        selectedHabits = [];
        var form = document.getElementById("logForm");
        if (form) form.style.display = "none";
    }

    async function save(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        var noteEl = document.getElementById("logContent");
        var note = noteEl ? noteEl.value.trim() : "";
        var now = new Date();
        var dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        var timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

        var saveBtn = document.getElementById("saveLogButton");
        if (saveBtn) saveBtn.innerText = "Posting to Vault...";

        try {
            var res = await fetch("/api/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mood: currentMood || "😊",
                    habits: selectedHabits || [],
                    content: note,
                    date: dateStr,
                    time: timeStr
                })
            });
            var data = await res.json();
            if (data.success) {
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("medium");
                resetForm();
                render();
            } else {
                alert("Could not post to Telegram: " + (data.error || "Server error"));
            }
        } catch (err) {
            alert("Network error communicating with Kuya B backend.");
        } finally {
            if (saveBtn) saveBtn.innerText = "Save";
        }
    }

    async function render() {
        var list = document.getElementById("dailyLogsList");
        if (!list) return;

        try {
            var res = await fetch("/api/logs");
            var data = await res.json();
            if (data.success) {
                logs = data.logs || [];
            }
        } catch (e) {
            logs = [];
        }

        if (logs.length === 0) {
            list.innerHTML = '<p class="empty-state">No logs in vault yet. Tap + to record how you feel!</p>';
            return;
        }

        var html = "";
        logs.forEach(function (item) {
            html += '<div class="daily-log-card" data-id="' + item.id + '">' +
                '<div class="log-clickable-area" onclick="window.KuyaB.features.dailyLogs.view(\'' + item.id + '\')">' +
                    '<span class="log-emoji-badge">' + (item.mood || "📝") + '</span>' +
                    '<div class="log-date-column">' +
                        '<span class="log-date">' + (item.date || "") + '</span>' +
                        '<span class="log-time">' + (item.time || "") + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="log-actions">' +
                    '<button type="button" class="btn-delete" onclick="window.KuyaB.features.dailyLogs.remove(\'' + item.id + '\')">🗑️</button>' +
                '</div>' +
            '</div>';
        });
        list.innerHTML = html;
    }

    function view(id) {
        var item = logs.find(function (x) { return String(x.id) === String(id); });
        if (!item) return;

        document.getElementById("modalLogEmoji").innerText = item.mood || "📝";
        document.getElementById("modalLogDate").innerText = (item.date || "") + " • " + (item.time || "");

        var habits = item.habits || [];
        var habitsSection = document.getElementById("modalHabitsSection");
        var habitsList = document.getElementById("modalHabitsList");
        var habitsCount = document.getElementById("modalHabitsCount");

        if (habits && habits.length > 0) {
            habitsCount.innerText = habits.length + " habit" + (habits.length > 1 ? "s" : "") + " completed";
            habitsList.innerHTML = habits.map(function (h) {
                return '<span class="modal-habit-tag">✓ ' + h + '</span>';
            }).join("");
            habitsSection.style.display = "block";
        } else {
            habitsCount.innerText = "No habits logged";
            habitsSection.style.display = "none";
        }

        document.getElementById("modalLogContent").innerText = item.content ? item.content : "(No additional reflection notes written)";
        document.getElementById("logDetailModal").style.display = "flex";
        if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
    }

    function closeModal() {
        var modal = document.getElementById("logDetailModal");
        if (modal) modal.style.display = "none";
    }

    async function remove(id) {
        if (confirm("Delete this log post from your Vault channel?")) {
            try {
                var res = await fetch("/api/logs/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: id })
                });
                var data = await res.json();
                if (data.success) {
                    if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("medium");
                    render();
                } else {
                    alert("Failed to delete from Telegram: " + (data.error || "Server error"));
                }
            } catch (e) {
                alert("Network error deleting from vault.");
            }
        }
    }

    return {
        selectMood: selectMood,
        toggleHabit: toggleHabit,
        save: save,
        render: render,
        view: view,
        closeModal: closeModal,
        remove: remove
    };
})();

// Legacy backward-compatibility alias
window.KuyaBDaily = window.KuyaB.features.dailyLogs;
