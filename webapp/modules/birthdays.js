/* =========================================================
   KUYA B — BIRTHDAYS MODULE (TELEGRAM VAULT STORAGE)
   ========================================================= */

window.KuyaB = window.KuyaB || {};
window.KuyaB.features = window.KuyaB.features || {};

window.KuyaB.features.birthdays = (function () {
    "use strict";

    var birthdays = [];

    async function fetchBirthdays() {
        try {
            var res = await fetch("/api/birthdays");
            var data = await res.json();
            if (data.success) {
                birthdays = data.birthdays || [];
            }
        } catch (e) {
            birthdays = [];
        }
    }

    async function render() {
        var list = document.getElementById("birthdaysList");
        if (!list) return;

        await fetchBirthdays();

        if (birthdays.length === 0) {
            list.innerHTML = '<p class="empty-state">No birthdays in vault yet. Tap + to add one!</p>';
            return;
        }

        var html = "";
        for (var i = 0; i < birthdays.length; i++) {
            var b = birthdays[i];
            html += '<div class="birthday-card" data-id="' + b.id + '">' +
                '<div class="birthday-info">' +
                    '<span class="birthday-name">' + b.name + '</span>' +
                    '<span class="birthday-date">📅 ' + b.date + '</span>' +
                '</div>' +
                '<div class="birthday-actions">' +
                    '<button type="button" class="btn-greet" data-action="greet-bday" data-name="' + b.name + '">Greet</button>' +
                    '<button type="button" class="btn-delete" data-action="delete-bday" data-id="' + b.id + '">🗑️</button>' +
                '</div>' +
            '</div>';
        }
        list.innerHTML = html;
    }

    async function save() {
        var nameEl = document.getElementById("birthdayName");
        var dateEl = document.getElementById("birthdayDate");
        var name = nameEl ? nameEl.value.trim() : "";
        var date = dateEl ? dateEl.value.trim() : "";

        if (!name || !date) {
            return alert("Please enter both name and date (MM-DD).");
        }

        var saveBtn = document.getElementById("saveBirthdayButton");
        if (saveBtn) saveBtn.innerText = "Saving...";

        try {
            var res = await fetch("/api/birthdays", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name, date: date })
            });
            var data = await res.json();
            if (data.success) {
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("medium");
                if (nameEl) nameEl.value = "";
                if (dateEl) dateEl.value = "";
                var form = document.getElementById("birthdayForm");
                if (form) form.style.display = "none";
                render();
            } else {
                alert("Could not save to vault: " + (data.error || "Server error"));
            }
        } catch (e) {
            alert("Network error connecting to vault.");
        } finally {
            if (saveBtn) saveBtn.innerText = "Save";
        }
    }

    async function remove(id) {
        if (confirm("Delete this birthday from your Vault channel?")) {
            try {
                var res = await fetch("/api/birthdays/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: id })
                });
                var data = await res.json();
                if (data.success) {
                    if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("medium");
                    render();
                } else {
                    alert("Failed to delete: " + (data.error || "Server error"));
                }
            } catch (e) {
                alert("Network error connecting to vault.");
            }
        }
    }

    function greet(name) {
        var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
        var chatId = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : null;

        if (!chatId) {
            return alert("Could not resolve Telegram chat ID.");
        }

        fetch("/api/birthdays/greet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, name: name })
        }).then(function () {
            if (window.KuyaB.showToast) window.KuyaB.showToast("Birthday greeting sent! 🎂🎉");
            if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("success");
        }).catch(function () {
            alert("Failed to send greeting.");
        });
    }

    function init() {
        render();
    }

    return {
        init: init,
        render: render,
        save: save,
        remove: remove,
        greet: greet
    };
})();
