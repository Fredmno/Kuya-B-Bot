/* =========================================================
   KUYA B — PERSONAL HUB
   Telegram Mini App
   Birthday Module
   ========================================================= */

const tg = window.Telegram?.WebApp;

// ---------------------------------------------------------
// TELEGRAM INITIALIZATION
// ---------------------------------------------------------

if (tg) {
    tg.ready();
    tg.expand();
}

// ---------------------------------------------------------
// ELEMENTS
// ---------------------------------------------------------

const dashboardPage = document.getElementById("dashboardPage");
const birthdaysPage = document.getElementById("birthdaysPage");
const birthdayList = document.getElementById("birthdayList");
const birthdayForm = document.getElementById("birthdayForm");
const birthdayName = document.getElementById("birthdayName");
const birthdayDate = document.getElementById("birthdayDate");

const birthdayBackButton = document.getElementById("birthdayBackButton");
const addBirthdayButton = document.getElementById("addBirthdayButton");
const saveBirthdayButton = document.getElementById("saveBirthdayButton");
const cancelBirthdayButton = document.getElementById("cancelBirthdayButton");
const searchButton = document.getElementById("searchButton");

// ---------------------------------------------------------
// DATA
// ---------------------------------------------------------

let birthdays = [];
let editingBirthdayId = null;

// ---------------------------------------------------------
// LOAD BIRTHDAYS
// ---------------------------------------------------------

function loadBirthdays() {
    try {
        const saved = localStorage.getItem("kuyaB_birthdays");
        if (saved) {
            birthdays = JSON.parse(saved);
        } else {
            birthdays = [];
        }
    } catch (error) {
        console.error("Unable to load birthdays:", error);
        birthdays = [];
    }
}

// ---------------------------------------------------------
// SAVE BIRTHDAYS
// ---------------------------------------------------------

function saveBirthdays() {
    try {
        localStorage.setItem("kuyaB_birthdays", JSON.stringify(birthdays));
    } catch (error) {
        console.error("Unable to save birthdays:", error);
    }
}

// ---------------------------------------------------------
// ESCAPE HTML
// ---------------------------------------------------------

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------
// DATE VALIDATION
// ---------------------------------------------------------

function isValidBirthday(value) {
    if (!/^\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const parts = value.split("-");
    const month = Number(parts[0]);
    const day = Number(parts[1]);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return false;
    }

    // Use leap year 2024 to allow Feb 29
    const testDate = new Date(2024, month, 0);
    const daysInMonth = testDate.getDate();

    return day <= daysInMonth;
}

// ---------------------------------------------------------
// GET NEXT BIRTHDAY
// ---------------------------------------------------------

function getNextBirthday(dateString) {
    if (!isValidBirthday(dateString)) {
        return null;
    }

    const parts = dateString.split("-");
    const month = Number(parts[0]);
    const day = Number(parts[1]);

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    let birthday = new Date(today.getFullYear(), month - 1, day);

    if (birthday < todayStart) {
        birthday = new Date(today.getFullYear() + 1, month - 1, day);
    }

    return birthday;
}

// ---------------------------------------------------------
// DAYS UNTIL BIRTHDAY
// ---------------------------------------------------------

function daysUntilBirthday(dateString) {
    const birthday = getNextBirthday(dateString);
    if (!birthday) {
        return Infinity;
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return Math.round((birthday.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------
// FORMAT BIRTHDAY
// ---------------------------------------------------------

function formatBirthday(dateString) {
    if (!isValidBirthday(dateString)) {
        return dateString;
    }

    const parts = dateString.split("-");
    const month = Number(parts[0]);
    const day = Number(parts[1]);

    const date = new Date(2024, month - 1, day);

    return date.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric"
    });
}

// ---------------------------------------------------------
// SHOW DASHBOARD
// ---------------------------------------------------------

function showDashboard() {
    if (dashboardPage) dashboardPage.style.display = "";
    if (birthdaysPage) birthdaysPage.style.display = "none";
    hideBirthdayForm();

    if (tg?.BackButton) {
        tg.BackButton.hide();
    }
}

// ---------------------------------------------------------
// SHOW BIRTHDAYS
// ---------------------------------------------------------

function showBirthdays() {
    if (dashboardPage) dashboardPage.style.display = "none";
    if (birthdaysPage) birthdaysPage.style.display = "";
    hideBirthdayForm();
    displayBirthdays();

    if (tg?.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(showDashboard);
    }
}

// ---------------------------------------------------------
// SHOW BIRTHDAY FORM
// ---------------------------------------------------------

function showBirthdayForm(birthday = null) {
    if (!birthdayForm) return;

    birthdayForm.style.display = "block";

    const heading = birthdayForm.querySelector("h2, h3");

    if (birthday) {
        editingBirthdayId = birthday.id;
        birthdayName.value = birthday.name;
        birthdayDate.value = birthday.date;

        if (heading) heading.textContent = "Edit Birthday";
        if (saveBirthdayButton) saveBirthdayButton.textContent = "Save Changes";
    } else {
        editingBirthdayId = null;
        birthdayName.value = "";
        birthdayDate.value = "";

        if (heading) heading.textContent = "Add Birthday";
        if (saveBirthdayButton) saveBirthdayButton.textContent = "Save Birthday";
    }

    setTimeout(() => {
        if (birthdayName) birthdayName.focus();
    }, 100);
}

// ---------------------------------------------------------
// HIDE BIRTHDAY FORM
// ---------------------------------------------------------

function hideBirthdayForm() {
    if (!birthdayForm) return;
    birthdayForm.style.display = "none";
    editingBirthdayId = null;
}

// ---------------------------------------------------------
// DISPLAY BIRTHDAYS
// ---------------------------------------------------------

function displayBirthdays() {
    if (!birthdayList) return;
    birthdayList.innerHTML = "";

    // Empty state
    if (!birthdays.length) {
        birthdayList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎂</div>
                <strong>No birthdays yet</strong>
                <small>Add birthdays for family, friends, and important people.</small>
            </div>
        `;
        return;
    }

    // Sort by upcoming
    const sorted = [...birthdays].sort((a, b) => {
        return daysUntilBirthday(a.date) - daysUntilBirthday(b.date);
    });

    // Create cards
    sorted.forEach(birthday => {
        const days = daysUntilBirthday(birthday.date);

        let countdownText = "";
        if (days === 0) {
            countdownText = "🎉 Today!";
        } else if (days === 1) {
            countdownText = "Tomorrow";
        } else if (days !== Infinity) {
            countdownText = `In ${days} days`;
        }

        let cardClass = "birthday-card";
        if (days === 0 || days <= 7) {
            cardClass += " birthday-soon";
        }

        const card = document.createElement("div");
        card.className = cardClass;

        card.innerHTML = `
            <div class="birthday-icon">🎂</div>
            <div class="birthday-info">
                <strong>${escapeHtml(birthday.name)}</strong>
                <span>${escapeHtml(formatBirthday(birthday.date))}</span>
                <small>${escapeHtml(countdownText)}</small>
            </div>
            <div class="birthday-actions">
                <button
                    class="birthday-edit"
                    type="button"
                    data-id="${escapeHtml(birthday.id)}"
                    aria-label="Edit birthday"
                >✏️</button>
                <button
                    class="birthday-delete"
                    type="button"
                    data-id="${escapeHtml(birthday.id)}"
                    aria-label="Delete birthday"
                >🗑️</button>
            </div>
        `;

        birthdayList.appendChild(card);
    });

    // Edit buttons
    birthdayList.querySelectorAll(".birthday-edit").forEach(button => {
        button.addEventListener("click", function () {
            const id = this.dataset.id;
            const birthday = birthdays.find(item => item.id === id);
            if (birthday) {
                showBirthdayForm(birthday);
            }
        });
    });

    // Delete buttons
    birthdayList.querySelectorAll(".birthday-delete").forEach(button => {
        button.addEventListener("click", function () {
            const id = this.dataset.id;
            deleteBirthday(id);
        });
    });
}

// ---------------------------------------------------------
// DELETE BIRTHDAY
// ---------------------------------------------------------

function deleteBirthday(id) {
    const birthday = birthdays.find(item => item.id === id);
    if (!birthday) return;

    const confirmed = confirm(`Delete ${birthday.name}'s birthday?`);
    if (!confirmed) return;

    birthdays = birthdays.filter(item => item.id !== id);
    saveBirthdays();

    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("warning");
    }

    displayBirthdays();
}

// ---------------------------------------------------------
// SAVE BIRTHDAY
// ---------------------------------------------------------

function saveBirthday() {
    const name = birthdayName?.value.trim();
    const date = birthdayDate?.value.trim();

    // Name validation
    if (!name) {
        alert("Please enter a name.");
        birthdayName?.focus();
        return;
    }

    // Date validation
    if (!isValidBirthday(date)) {
        alert("Please enter a valid birthday using MM-DD.\n\nExample: 05-24");
        birthdayDate?.focus();
        return;
    }

    // Edit existing
    if (editingBirthdayId) {
        const index = birthdays.findIndex(item => item.id === editingBirthdayId);
        if (index !== -1) {
            birthdays[index].name = name;
            birthdays[index].date = date;
        }
    } else {
        // Add new
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

// ---------------------------------------------------------
// FORMAT DATE INPUT (AUTO-INSERTS DASH)
// ---------------------------------------------------------

if (birthdayDate) {
    birthdayDate.addEventListener("input", function () {
        let value = this.value.replace(/\D/g, "");

        if (value.length > 4) {
            value = value.substring(0, 4);
        }

        if (value.length >= 3) {
            value = value.substring(0, 2) + "-" + value.substring(2);
        }

        this.value = value;
    });
}

// Allow Enter key to submit within form inputs
[birthdayName, birthdayDate].forEach(input => {
    if (input) {
        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                saveBirthday();
            }
        });
    }
});

// ---------------------------------------------------------
// EVENT ATTACHMENTS
// ---------------------------------------------------------

// Birthday tile navigation
document.querySelectorAll('[data-feature="birthdays"]').forEach(button => {
    button.addEventListener("click", function () {
        showBirthdays();
    });
});

// Back button
if (birthdayBackButton) {
    birthdayBackButton.addEventListener("click", function () {
        showDashboard();
    });
}

// Add button
if (addBirthdayButton) {
    addBirthdayButton.addEventListener("click", function () {
        showBirthdayForm();
    });
}

// Save button
if (saveBirthdayButton) {
    saveBirthdayButton.addEventListener("click", function () {
        saveBirthday();
    });
}

// Cancel button
if (cancelBirthdayButton) {
    cancelBirthdayButton.addEventListener("click", function () {
        hideBirthdayForm();
    });
}

// Search button stub
if (searchButton) {
    searchButton.addEventListener("click", function () {
        alert("Universal Search coming soon in Phase 5!");
    });
}

// Placeholder alerts for upcoming modules
document.querySelectorAll("[data-feature]").forEach(button => {
    button.addEventListener("click", function () {
        const feature = this.dataset.feature;
        if (feature === "birthdays") return;

        alert(`${feature.charAt(0).toUpperCase() + feature.slice(1)} module coming soon.`);
    });
});

// ---------------------------------------------------------
// APP BOOTSTRAP
// ---------------------------------------------------------

document.addEventListener("DOMContentLoaded", function () {
    loadBirthdays();
    showDashboard();
});
