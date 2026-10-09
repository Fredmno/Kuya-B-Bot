/* =========================================================
   KUYA B — FEATURE: REMINDERS
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};

    var reminders = [];

    function loadReminders() {
        try { reminders = JSON.parse(localStorage.getItem("kuyaB_reminders")) || []; } catch (e) { reminders = []; }
    }

    function saveReminders() {
        localStorage.setItem("kuyaB_reminders", JSON.stringify(reminders));
    }

    function render() {
        loadReminders();
        var list = document.getElementById("remindersList");
        if (!list) return;

        if (reminders.length === 0) {
            list.innerHTML = '<p class="empty-state">No reminders saved. Tap + to add one!</p>';
            return;
        }

        var html = "";
        for (var i = 0; i < reminders.length; i++) {
            var r = reminders[i];
            html += '<div class="birthday-card" data-id="' + r.id + '">' +
                '<div class="birthday-info"><span class="birthday-name">' + r.title + '</span></div>' +
                '<div class="birthday-actions"><button type="button" class="btn-delete" data-action="delete-rem" data-id="' + r.id + '">🗑️</button></div></div>';
        }
        list.innerHTML = html;
    }

    function add() {
        var input = document.getElementById("reminderTitle");
        var title = input ? input.value.trim() : "";
        if (!title) return alert("Please enter reminder.");
        reminders.push({ id: Date.now().toString(), title: title });
        saveReminders();
        window.KuyaB.triggerHaptic("medium");
        if (input) input.value = "";
        document.getElementById("reminderForm").style.display = "none";
        render();
    }

    function remove(id) {
        if (!confirm("Delete reminder?")) return;
        reminders = reminders.filter(function (x) { return x.id !== id; });
        saveReminders();
        render();
    }

    window.KuyaB.features.reminders = {
        load: loadReminders,
        render: render,
        add: add,
        remove: remove
    };
})();
