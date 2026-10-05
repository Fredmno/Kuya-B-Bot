/* =========================================================
   KUYA B — PERSONAL HUB
   Telegram Mini App
   Birthday Module
   ========================================================= */

const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

// ---------------------------------------------------------
// STATE
// ---------------------------------------------------------

let birthdays = [];
let editingBirthdayId = null;

// ---------------------------------------------------------
// LOCAL STORAGE
// ---------------------------------------------------------

function loadBirthdays() {
    try {
        const saved = localStorage.getItem("kuyaB_birthdays");
        birthdays = saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error("Unable to load birthdays:", error);
        birthdays = [];
    }
}

function saveBirthdays() {
    try {
        localStorage.setItem("kuyaB_birthdays", JSON.stringify(birthdays));
    } catch (error) {
        console.error("Unable to save birthdays:", error);
    }
}

// ---------------------------------------------------------
// HELPERS & VALIDATION
// ---------------------------------------------------------

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function isValidBirthday(value) {
    if (!/^\d{2}-\d{2}$/.test(value)) return false;

    const parts = value.split("-");
    const month = Number(parts[0]);
    const day = Number(parts[1]);

    if (month < 1 || month > 12 || day < 1 || day > 31) return false;

    const testDate = new Date(2024, month, 0); // Leap year base allows Feb 29
    return day <= testDate.getDate();
}

function getNextBirthday(dateString) {
    if (!isValidBirthday(dateString)) return null;

    const parts = dateString.split("-");
    const month = Number(parts[0]);
    const day = Number(parts[1]);

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    let bday = new Date(today.getFullYear(), month - 1, day);
    if (bday < todayStart) {
        bday = new Date(today.getFullYear() + 1, month - 1, day);
    }
    return bday;
}

function daysUntilBirthday(dateString) {
    const bday = getNextBirthday(dateString);
    if (!bday) return Infinity;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return Math.round((bday.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
}

function formatBirthday(dateString) {
    if (!isValidBirthday(dateString)) return dateString;

    const [month, day] = dateString.split("-").map(Number);
    const date = new Date(2024, month - 1, day);

    return date.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric"
    });
}

// ---------------------------------------------------------
// NAVIGATION
// ---------------------------------------------------------

function showDashboard() {
    const dashboard = document.getElementById("dashboardPage");
    const birthdays = document.getElementById("birthdaysPage");

    if (dashboard) dashboard.style.display = "block";
    if (birthdays) birthdays.style.display = "none";
    hideBirthdayForm();

    if (tg?.BackButton) {
        tg.BackButton.hide();
    }
}

function showBirthdays() {
    const dashboard = document.getElementById("dashboardPage");
    const birthdays = document.getElementById("birthdaysPage");

    if (dashboard) dashboard.style.display = "none";
    if (birthdays) birthdays.style.display = "block";

    hideBirthdayForm();
    displayBirthdays();

    if (tg?.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(showDashboard);
    }
}

// ---------------------------------------------------------
// FORM MANAGEMENT
// ---------------------------------------------------------

function showBirthdayForm(birthday = null) {
    const form = document.getElementById("birthdayForm");
    const nameInput = document.getElementById("birthdayName");
    const dateInput = document.getElementById("birthdayDate");
    const saveBtn = document.getElementById("saveBirthdayButton");

    if (!form) return;

    form.style.display = "block";
    const heading = form.querySelector("h2");

    if (birthday) {
        editingBirthdayId = birthday.id;
        if (nameInput) nameInput.value = birthday.name;
        if (dateInput) dateInput.value = birthday.date;
        if (heading) heading.textContent = "Edit Birthday";
        if (saveBtn) saveBtn.textContent = "Save Changes";
    } else {
        editingBirthdayId = null;
        if (nameInput) nameInput.value = "";
        if (dateInput) dateInput.value = "";
        if (heading) heading.textContent = "Add Birthday";
        if (saveBtn) saveBtn.textContent = "Save Birthday";
    }

    setTimeout(() => {
        nameInput?.focus();
    }, 100);
}

function hideBirthdayForm() {
    const form = document.getElementById("birthdayForm");
    const nameInput = document.getElementById("birthdayName");
    const dateInput = document.getElementById("birthdayDate");

    if (!form) return;
    form.style.display = "none";
    editingBirthdayId = null;

    if (nameInput) nameInput.value = "";
    if (dateInput) dateInput.value = "";
}

// ---------------------------------------------------------
// CRUD OPERATIONS
// ---------------------------------------------------------

function saveBirthday() {
    const nameInput = document.getElementById("birthdayName");
    const dateInput = document.getElementById("birthdayDate");

    const name = nameInput?.value.trim();
    const date = dateInput?.value.trim();

    if (!name) {
        alert("Please enter a name.");
        nameInput?.focus();
        return;
    }

    if (!isValidBirthday(date)) {
        alert("Please enter a valid birthday using MM-DD.\n\nExample: 05-24");
        dateInput?.focus();
        return;
    }

    if (editingBirthdayId) {
        const idx = birthdays.findIndex(b => b.id === editingBirthdayId);
        if (idx !== -1) {
            birthdays[idx].name = name;
            birthdays[idx].date = date;
        }
    } else {
        birthdays.push({
            id: Date.now().toString(),
            name: name,
            date: date
        });
    }

    saveBirthdays();

    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("success");
    }

    hideBirthdayForm();
    displayBirthdays();
}

function deleteBirthday(id) {
    const item = birthdays.find(b => b.id === id);
    if (!item) return;

    if (!confirm(`Delete ${item.name}'s birthday?`)) return;

    birthdays = birthdays.filter(b => b.id !== id);
    saveBirthdays();

    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("warning");
    }

    displayBirthdays();
}

// ---------------------------------------------------------
// RENDER BIRTHDAYS
// ---------------------------------------------------------

function displayBirthdays() {
    const list = document.getElementById("birthdayList");
    if (!list) return;

    list.innerHTML = "";

    if (!birthdays.length) {
        list.innerHTML = `
            <div class="empty-state" style="text-align:center; padding:30px 10px; color:#94a3b8;">
                <div style="font-size:3rem; margin-bottom:8px;">🎂</div>
                <strong style="display:block; font-size:1.1rem; color:#f8fafc; margin-bottom:4px;">No birthdays yet</strong>
                <small>Add birthdays for family, friends, and important people.</small>
            </div>
        `;
        return;
    }

    const sorted = [...birthdays].sort((a, b) => daysUntilBirthday(a.date) - daysUntilBirthday(b.date));

    sorted.forEach(b => {
        const days = daysUntilBirthday(b.date);
        let countdown = "";

        if (days === 0) countdown = "🎉 Today!";
        else if (days === 1) countdown = "Tomorrow";
        else if (days !== Infinity) countdown = `In ${days} days`;

        const isSoon = days <= 7;
        const card = document.createElement("div");
        card.className = `birthday-card ${isSoon ? "birthday-soon" : ""}`;
        card.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:12px; margin-bottom:10px; background:rgba(255,255,255,0.06); border-radius:14px;";

        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="font-size:1.8rem;">🎂</div>
                <div>
                    <strong style="display:block; font-size:1rem; color:#f8fafc;">${escapeHtml(b.name)}</strong>
                    <span style="font-size:0.85rem; color:#94a3b8;">${escapeHtml(formatBirthday(b.date))}</span>
                    <small style="display:block; font-size:0.8rem; color:${isSoon ? '#f43f5e' : '#38bdf8'}; font-weight:600;">${escapeHtml(countdown)}</small>
                </div>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="birthday-edit" type="button" data-id="${escapeHtml(b.id)}" style="background:none; border:none; font-size:1.2rem; padding:6px; cursor:pointer;">✏️</button>
                <button class="birthday-delete" type="button" data-id="${escapeHtml(b.id)}" style="background:none; border:none; font-size:1.2rem; padding:6px; cursor:pointer;">🗑️</button>
            </div>
        `;

        list.appendChild(card);
    });

    list.querySelectorAll(".birthday-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            const item = birthdays.find(b => b.id === btn.dataset.id);
            if (item) showBirthdayForm(item);
        });
    });

    list.querySelectorAll(".birthday-delete").forEach(btn => {
        btn.addEventListener("click", () => deleteBirthday(btn.dataset.id));
    });
}

// ---------------------------------------------------------
// INITIALIZATION & EVENT DELEGATION
// ---------------------------------------------------------

function initApp() {
    loadBirthdays();
    showDashboard();

    // Universal Click Delegator
    document.addEventListener("click", function (e) {
        // Birthdays Tile
        const bdayTile = e.target.closest('[data-feature="birthdays"]');
        if (bdayTile) {
            e.preventDefault();
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
            showBirthdays();
            return;
        }

        // Back to Dashboard Button
        if (e.target.closest("#birthdayBackButton")) {
            e.preventDefault();
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
            showDashboard();
            return;
        }

        // Show Add Form Button
        if (e.target.closest("#addBirthdayButton")) {
            e.preventDefault();
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
            showBirthdayForm();
            return;
        }

        // Cancel Form Button
        if (e.target.closest("#cancelBirthdayButton")) {
            e.preventDefault();
            hideBirthdayForm();
            return;
        }

        // Save Birthday Button
        if (e.target.closest("#saveBirthdayButton")) {
            e.preventDefault();
            saveBirthday();
            return;
        }

        // Add Content
        if (e.target.closest("#addContentButton")) {
            e.preventDefault();
            alert("Add Content modal coming soon!");
            return;
        }

        // Word Scramble
        if (e.target.closest("#gameButton")) {
            e.preventDefault();
            alert("Word Scramble launcher ready!");
            return;
        }

        // Search Bar
        if (e.target.closest("#searchButton")) {
            e.preventDefault();
            alert("Universal Search coming in Phase 5!");
            return;
        }

        // Any other data-feature
        const featureTile = e.target.closest("[data-feature]");
        if (featureTile) {
            const name = featureTile.dataset.feature;
            if (name !== "birthdays") {
                e.preventDefault();
                alert(`${name.charAt(0).toUpperCase() + name.slice(1)} module coming soon.`);
            }
        }
    });

    // Auto-dash format for date input
    const dateInput = document.getElementById("birthdayDate");
    if (dateInput) {
        dateInput.addEventListener("input", function () {
            let val = this.value.replace(/\D/g, "");
            if (val.length > 4) val = val.substring(0, 4);
            if (val.length >= 3) {
                val = val.substring(0, 2) + "-" + val.substring(2);
            }
            this.value = val;
        });

        dateInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                saveBirthday();
            }
        });
    }

    const nameInput = document.getElementById("birthdayName");
    if (nameInput) {
        nameInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                saveBirthday();
            }
        });
    }
}

// Bootstrap whether DOM is already ready or loading
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
