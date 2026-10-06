/* =========================================================
   KUYA B — BIRTHDAYS FEATURE MODULE
   ========================================================= */

window.KuyaB = window.KuyaB || {};
window.KuyaB.features = window.KuyaB.features || {};

window.KuyaB.features.birthdays = (function () {
    "use strict";

    var birthdays = [];

    function load() {
        try {
            birthdays = JSON.parse(localStorage.getItem("kuyaB_birthdays")) || [];
        } catch (e) {
            birthdays = [];
        }
    }

    function calculateDaysLeft(dateStr) {
        if (!dateStr || dateStr.indexOf("-") === -1) return 999;
        var parts = dateStr.split("-");
        var month = parseInt(parts[0], 10);
        var day = parseInt(parts[1], 10);
        var today = new Date();
        var currentYear = today.getFullYear();

        var next = new Date(currentYear, month - 1, day);
        var todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (next < todayMidnight) {
            next = new Date(currentYear + 1, month - 1, day);
        }

        var diff = next - todayMidnight;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    function render() {
        var list = document.getElementById("birthdaysList");
        if (!list) return;

        if (birthdays.length === 0) {
            list.innerHTML = '<p class="empty-state">No birthdays saved yet. Tap + to add one!</p>';
            return;
        }

        var sorted = birthdays.slice().sort(function (a, b) {
            return calculateDaysLeft(a.date) - calculateDaysLeft(b.date);
        });

        var html = "";
        for (var i = 0; i < sorted.length; i++) {
            var b = sorted[i];
            var daysLeft = calculateDaysLeft(b.date);
            var badge = '<span class="bday-badge">' + daysLeft + ' days left</span>';
            var greetButtonHtml = "";

            // The Greet button ONLY shows when the birthday is TODAY
            if (daysLeft === 0) {
                badge = '<span class="bday-badge today">🎉 Today!</span>';
                greetButtonHtml = '<button class="btn-greet" data-action="greet-bday" data-name="' + b.name + '">📢 Greet</button>';
            } else if (daysLeft === 1) {
                badge = '<span class="bday-badge">Tomorrow</span>';
            }

            html += '<div class="birthday-card" data-id="' + b.id + '">' +
                '<div class="birthday-info">' +
                    '<div class="birthday-title-row">' +
                        '<span class="birthday-name">' + b.name + '</span>' +
                        badge +
                    '</div>' +
                    '<span class="birthday-date">📅 ' + b.date + '</span>' +
                '</div>' +
                '<div class="birthday-actions">' +
                    greetButtonHtml +
                    '<button class="btn-delete" data-action="delete-bday" data-id="' + b.id + '">🗑️</button>' +
                '</div>' +
            '</div>';
        }
        list.innerHTML = html;
    }

    function save() {
        var nameEl = document.getElementById("birthdayName");
        var dateEl = document.getElementById("birthdayDate");
        var name = nameEl ? nameEl.value.trim() : "";
        var date = dateEl ? dateEl.value.trim() : "";

        if (!name || !date) {
            alert("Please enter both a name and date (MM-DD).");
            return;
        }

        birthdays.push({ id: Date.now().toString(), name: name, date: date });
        localStorage.setItem("kuyaB_birthdays", JSON.stringify(birthdays));
        if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("medium");

        if (nameEl) nameEl.value = "";
        if (dateEl) dateEl.value = "";
        var form = document.getElementById("birthdayForm");
        if (form) form.style.display = "none";
        render();
    }

    function remove(id) {
        if (confirm("Delete this birthday?")) {
            birthdays = birthdays.filter(function (x) { return x.id !== id; });
            localStorage.setItem("kuyaB_birthdays", JSON.stringify(birthdays));
            if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("medium");
            render();
        }
    }

    function greet(name) {
        var chatId = window.KuyaB.getParam("chat_id");
        if (!chatId) {
            window.KuyaB.showToast("Open via /kuyab in a group chat to send greetings!");
            return;
        }

        if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("medium");
        fetch("/api/birthdays/greet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, name: name })
        }).then(function (res) {
            return res.json();
        }).then(function (data) {
            if (data.success) {
                window.KuyaB.showToast("Greeting sent for " + name + "! 🎉");
            } else {
                window.KuyaB.showToast("Failed to send greeting.");
            }
        }).catch(function () {
            window.KuyaB.showToast("Network error.");
        });
    }

    return {
        init: function () {
            load();
            var bdayDateInput = document.getElementById("birthdayDate");
            if (bdayDateInput) {
                bdayDateInput.addEventListener("input", function () {
                    var val = this.value.replace(/\D/g, "");
                    if (val.length > 4) val = val.substring(0, 4);
                    if (val.length >= 3) val = val.substring(0, 2) + "-" + val.substring(2);
                    this.value = val;
                });
            }
        },
        render: render,
        save: save,
        remove: remove,
        greet: greet
    };
})();
