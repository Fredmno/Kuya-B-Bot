/* =========================================================
   KUYA B — BIRTHDAYS MODULE
   Matches webapp/index.html layout and element IDs exactly
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};

    var birthdays = {};

    birthdays.fetchList = async function () {
        try {
            var res = await fetch("/api/birthdays?t=" + Date.now());
            var data = await res.json();
            return data.birthdays || [];
        } catch (e) {
            console.error("Failed to load birthdays", e);
            return [];
        }
    };

    birthdays.render = async function () {
        var container = document.getElementById("birthdaysList");
        if (!container) return;

        container.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--text-muted, #94a3b8);">Loading birthdays...</div>';
        var list = await birthdays.fetchList();

        if (!list || list.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 32px 16px; color: var(--text-muted, #94a3b8);"><div style="font-size: 2rem; margin-bottom: 8px;">🎂</div>No birthdays registered yet. Tap + to add one.</div>';
            return;
        }

        var html = '<div style="padding: 12px 16px;">';
        list.forEach(function (b) {
            html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; margin-bottom: 10px; background: var(--bg-card, #1e293b); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">' +
                '<div>' +
                    '<div style="font-weight: 600; font-size: 0.95rem; color: #fff;">' + (b.name || "Unknown") + '</div>' +
                    '<div style="font-size: 0.82rem; color: #38bdf8; margin-top: 2px;">🎂 ' + (b.date || "") + '</div>' +
                '</div>' +
                '<button type="button" class="btn-soft cancel" data-action="delete-bday" data-id="' + b.id + '" style="padding: 6px 12px; font-size: 0.8rem; background: rgba(239,68,68,0.15); color: #f87171; border: none; border-radius: 8px; cursor: pointer;">Delete</button>' +
            '</div>';
        });
        html += '</div>';

        container.innerHTML = html;
    };

    birthdays.save = async function () {
        var nameInput = document.getElementById("birthdayName");
        var dateInput = document.getElementById("birthdayDate");
        var saveBtn = document.getElementById("saveBirthdayButton");
        var formBox = document.getElementById("birthdayForm");

        var name = nameInput ? nameInput.value.trim() : "";
        var date = dateInput ? dateInput.value.trim() : "";

        if (!name || !date) {
            alert("Please provide both name and date (MM-DD).");
            return;
        }

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerText = "Saving...";
        }

        try {
            var res = await fetch("/api/birthdays", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name, date: date })
            });
            var data = await res.json();
            if (data.success) {
                if (nameInput) nameInput.value = "";
                if (dateInput) dateInput.value = "";
                if (formBox) formBox.style.display = "none";
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.notificationOccurred("success");
                }
                await birthdays.render();
            } else {
                alert("Failed: " + (data.error || "Could not save birthday."));
            }
        } catch (e) {
            alert("Network error saving birthday.");
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = "Save";
            }
        }
    };

    birthdays.delete = async function (id) {
        if (!id) return;
        if (!confirm("Are you sure you want to delete this birthday?")) return;

        try {
            var res = await fetch("/api/birthdays/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: id })
            });
            var data = await res.json();
            if (data.success) {
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
                }
                await birthdays.render();
            } else {
                alert("Could not delete: " + (data.error || "Server error."));
            }
        } catch (e) {
            alert("Network error deleting birthday.");
        }
    };

    // Attach event listeners directly to the exact HTML IDs
    document.addEventListener("click", function (e) {
        var addBtn = e.target.closest("#addBirthdayButton");
        if (addBtn) {
            e.preventDefault();
            var form = document.getElementById("birthdayForm");
            if (form) {
                form.style.display = form.style.display === "none" ? "block" : "none";
            }
            return;
        }

        var cancelBtn = e.target.closest("#cancelBirthdayButton");
        if (cancelBtn) {
            e.preventDefault();
            var form = document.getElementById("birthdayForm");
            if (form) form.style.display = "none";
            return;
        }

        var saveBtn = e.target.closest("#saveBirthdayButton");
        if (saveBtn) {
            e.preventDefault();
            birthdays.save();
            return;
        }

        var deleteBtn = e.target.closest('[data-action="delete-bday"]');
        if (deleteBtn) {
            e.preventDefault();
            var id = deleteBtn.getAttribute("data-id");
            birthdays.delete(id);
            return;
        }
    });

    window.KuyaB.features.birthdays = birthdays;
})();
