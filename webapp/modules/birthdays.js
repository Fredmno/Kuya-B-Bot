/* =========================================================
   KUYA B — BIRTHDAYS MODULE (VAULT + COUNTDOWN & GREET)
   ========================================================= */

window.KuyaB = window.KuyaB || {};
window.KuyaB.features = window.KuyaB.features || {};

window.KuyaB.features.birthdays = (function () {
    "use strict";

    var birthdays = [];

    // Calculate days remaining until next birthday
    function calculateCountdown(dateStr) {
        if (!dateStr || !dateStr.includes("-")) return { days: null, isToday: false, formattedDate: dateStr };

        var parts = dateStr.split("-");
        var birthMonth = parseInt(parts[0], 10) - 1;
        var birthDay = parseInt(parts[1], 10);

        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        var nextBday = new Date(now.getFullYear(), birthMonth, birthDay);

        // If birthday has already passed this year, point to next year
        if (nextBday < today) {
            nextBday.setFullYear(now.getFullYear() + 1);
        }

        var diffTime = nextBday.getTime() - today.getTime();
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        var formatted = (monthNames[birthMonth] || "") + " " + birthDay;

        return {
            days: diffDays,
            isToday: diffDays === 0,
            formattedDate: formatted
        };
    }

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

        // Sort birthdays by upcoming days
        var mapped = birthdays.map(function(b) {
            var countdownInfo = calculateCountdown(b.date);
            return {
                id: b.id,
                name: b.name,
                rawDate: b.date,
                days: countdownInfo.days,
                isToday: countdownInfo.isToday,
                formattedDate: countdownInfo.formattedDate
            };
        });

        mapped.sort(function(a, b) {
            return (a.days !== null ? a.days : 999) - (b.days !== null ? b.days : 999);
        });

        var html = "";
        for (var i = 0; i < mapped.length; i++) {
            var b = mapped[i];

            // Build countdown pill badge
            var countdownBadge = "";
            if (b.isToday) {
                countdownBadge = '<span class="bday-badge-today">Today! 🎉</span>';
            } else if (b.days !== null) {
                countdownBadge = '<span class="bday-badge-days">' + (b.days === 1 ? 'Tomorrow' : 'In ' + b.days + ' days') + '</span>';
            }

            // Greet button only appears if today is their birthday
            var greetButtonHtml = "";
            if (b.isToday) {
                greetButtonHtml = '<button type="button" class="btn-greet" data-action="greet-bday" data-name="' + b.name + '">Greet 🎂</button>';
            }

            html += '<div class="birthday-card" data-id="' + b.id + '">' +
                '<div class="birthday-info">' +
                    '<div class="birthday-title-row">' +
                        '<span class="birthday-name">' + b.name + '</span>' +
                        countdownBadge +
                    '</div>' +
                    '<span class="birthday-date">📅 ' + b.formattedDate + '</span>' +
                '</div>' +
                '<div class="birthday-actions">' +
                    greetButtonHtml +
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
                if (window.KuyaB && window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("medium");
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
                    if (window.KuyaB && window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("medium");
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
            if (window.KuyaB && window.KuyaB.showToast) window.KuyaB.showToast("Birthday greeting sent! 🎂🎉");
            if (window.KuyaB && window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("success");
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
