/* =========================================================
   KUYA B — BIRTHDAYS MODULE
   ========================================================= */

window.KuyaB = window.KuyaB || {};
window.KuyaB.features = window.KuyaB.features || {};

window.KuyaB.features.birthdays = (function () {
    "use strict";

    var birthdays = [];

    function calculateDays(dateStr) {
        try {
            var parts = dateStr.split("-");
            var month = parseInt(parts[0], 10) - 1;
            var day = parseInt(parts[1], 10);
            var now = new Date();
            var currentYear = now.getFullYear();
            var bdayThisYear = new Date(currentYear, month, day);
            var today = new Date(currentYear, now.getMonth(), now.getDate());

            if (bdayThisYear < today) {
                bdayThisYear = new Date(currentYear + 1, month, day);
            }
            var diffTime = bdayThisYear - today;
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } catch (e) {
            return 999;
        }
    }

    async function render() {
        var list = document.getElementById("birthdaysList");
        if (!list) return;

        try {
            var res = await fetch("/api/birthdays");
            var data = await res.json();
            birthdays = data.birthdays || [];
        } catch (e) {
            birthdays = [];
        }

        if (birthdays.length === 0) {
            list.innerHTML = '<p class="empty-state">No birthdays saved in vault yet. Tap + to add one!</p>';
            return;
        }

        birthdays.sort(function (a, b) {
            return calculateDays(a.date) - calculateDays(b.date);
        });

        var html = "";
        birthdays.forEach(function (b) {
            var days = calculateDays(b.date);
            var badgeText = "";
            var badgeClass = "bday-badge-days";

            // Only generate the Greet button if the birthday is today
            var greetButtonHtml = "";
            if (days === 0) {
                badgeText = "Today! 🎉";
                badgeClass = "bday-badge-today";
                greetButtonHtml = '<button type="button" class="btn-greet" data-action="greet-bday" data-name="' + b.name + '">Greet</button>';
            } else if (days === 1) {
                badgeText = "Tomorrow";
            } else {
                badgeText = days + " days left";
            }

            html += '<div class="birthday-card" data-id="' + b.id + '">' +
                '<div class="birthday-info">' +
                    '<div class="birthday-title-row">' +
                        '<span class="birthday-name">' + b.name + '</span>' +
                        '<span class="' + badgeClass + '">' + badgeText + '</span>' +
                    '</div>' +
                    '<span class="birthday-date">📅 ' + b.date + '</span>' +
                '</div>' +
                '<div class="birthday-actions">' +
                    greetButtonHtml +
                    '<button type="button" class="btn-delete" data-action="delete-bday" data-id="' + b.id + '">🗑️</button>' +
                '</div>' +
            '</div>';
        });

        list.innerHTML = html;
    }

    async function save() {
        var nameEl = document.getElementById("birthdayName");
        var dateEl = document.getElementById("birthdayDate");
        var name = nameEl ? nameEl.value.trim() : "";
        var date = dateEl ? dateEl.value.trim() : "";

        if (!name || !date) {
            alert("Please enter Name and Date (MM-DD)");
            return;
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
                alert("Error saving: " + (data.error || "Server error"));
            }
        } catch (err) {
            alert("Network error communicating with Kuya B backend.");
        } finally {
            if (saveBtn) saveBtn.innerText = "Save";
        }
    }

    async function remove(id) {
        if (confirm("Delete this birthday from your vault?")) {
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
                    alert("Error deleting: " + (data.error || "Server error"));
                }
            } catch (err) {
                alert("Network error.");
            }
        }
    }

    async function greet(name) {
        var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
        var chatId = (tg && tg.initDataUnsafe && tg.initDataUnsafe.chat) ? tg.initDataUnsafe.chat.id : null;
        if (!chatId && tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
            chatId = tg.initDataUnsafe.user.id;
        }

        if (!chatId) {
            if (window.KuyaB.showToast) window.KuyaB.showToast("Could not determine chat destination.");
            return;
        }

        try {
            var res = await fetch("/api/birthdays/greet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, name: name })
            });
            var data = await res.json();
            if (data.success) {
                if (window.KuyaB.showToast) window.KuyaB.showToast("Greeting sent! 🎉");
            }
        } catch (e) {
            if (window.KuyaB.showToast) window.KuyaB.showToast("Failed to send greeting.");
        }
    }

    return {
        render: render,
        save: save,
        remove: remove,
        greet: greet
    };
})();

// Standalone Modal Popup Logic (Direct from Chat "➕ Add")
window.saveBirthdayFromPopup = async function () {
    var nameEl = document.getElementById("popupBirthdayName");
    var dateEl = document.getElementById("popupBirthdayDate");

    var name = nameEl ? nameEl.value.trim() : "";
    var date = dateEl ? dateEl.value.trim() : "";

    if (!name || !date) {
        alert("Please enter both Name and Date (MM-DD).");
        return;
    }

    var btn = document.getElementById("btnPopupSaveBirthday");
    if (btn) btn.innerText = "Saving...";

    try {
        var res = await fetch("/api/birthdays", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name, date: date })
        });
        var data = await res.json();
        if (data.success) {
            if (window.Telegram && window.Telegram.WebApp) {
                if (window.Telegram.WebApp.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred("success");
                }
                window.Telegram.WebApp.close();
            }
        } else {
            alert("Could not save birthday: " + (data.error || "Server error"));
            if (btn) btn.innerText = "Save";
        }
    } catch (err) {
        alert("Network error communicating with Kuya B backend.");
        if (btn) btn.innerText = "Save";
    }
};
