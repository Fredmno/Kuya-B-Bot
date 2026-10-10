/* =========================================================
   KUYA B — BIRTHDAYS FEATURE MODULE
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};

    var birthdaysFeature = {};

    birthdaysFeature.loadBirthdays = async function () {
        try {
            var res = await fetch("/api/birthdays?t=" + Date.now());
            var data = await res.json();
            return data.birthdays || [];
        } catch (e) {
            console.error("Failed to fetch birthdays", e);
            return [];
        }
    };

    birthdaysFeature.render = async function () {
        var container = document.getElementById("birthdaysList");
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; padding: 20px; color: #64748b;">Loading birthdays...</div>';
        var list = await birthdaysFeature.loadBirthdays();

        if (!list || list.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding: 20px; color: #94a3b8;">No birthdays added yet.</div>';
            return;
        }

        var html = "";
        list.forEach(function (b) {
            html += '<div class="birthday-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px; margin-bottom:8px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">' +
                '<div>' +
                    '<strong style="color:#1e293b; display:block; font-size:0.95rem;">' + (b.name || "Unknown") + '</strong>' +
                    '<span style="font-size:0.85rem; color:#64748b;">🎂 ' + (b.date || "") + '</span>' +
                '</div>' +
                '<button type="button" class="btn-soft delete" data-action="delete-bday" data-id="' + b.id + '" style="padding:6px 12px; font-size:0.8rem; background:#fee2e2; color:#ef4444; border:none; border-radius:6px; cursor:pointer;">Delete</button>' +
            '</div>';
        });

        container.innerHTML = html;
    };

    birthdaysFeature.addBirthday = async function () {
        var nameInput = document.getElementById("bdayNameInput");
        var dateInput = document.getElementById("bdayDateInput");
        var submitBtn = document.getElementById("btnAddBday");

        var name = nameInput ? nameInput.value.trim() : "";
        var date = dateInput ? dateInput.value.trim() : "";

        if (!name || !date) {
            alert("Please enter both a name and a date (MM-DD).");
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "Adding...";
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
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("success");
                await birthdaysFeature.render();
            } else {
                alert("Failed to add birthday: " + (data.error || "Unknown server error"));
            }
        } catch (e) {
            alert("Network error: Could not reach server to add birthday.");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "Add Birthday";
            }
        }
    };

    birthdaysFeature.deleteBirthday = async function (id) {
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
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                await birthdaysFeature.render();
            } else {
                alert("Could not delete birthday: " + (data.error || "Unknown error"));
            }
        } catch (e) {
            alert("Network error: Could not reach server to delete birthday.");
        }
    };

    // Attach click handlers using event delegation
    document.addEventListener("click", function (e) {
        var addBtn = e.target.closest("#btnAddBday");
        if (addBtn) {
            e.preventDefault();
            birthdaysFeature.addBirthday();
            return;
        }

        var delBtn = e.target.closest('[data-action="delete-bday"]');
        if (delBtn) {
            e.preventDefault();
            var bId = delBtn.getAttribute("data-id");
            birthdaysFeature.deleteBirthday(bId);
            return;
        }
    });

    window.KuyaB.features.birthdays = birthdaysFeature;
})();
