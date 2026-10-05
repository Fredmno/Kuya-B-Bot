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
// DATA & STATE
// ---------------------------------------------------------

let birthdays = [];
let editingBirthdayId = null;

// ---------------------------------------------------------
// LOCAL STORAGE MANAGEMENT
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
// DATE VALIDATION & CALCULATIONS
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

    // Use leap year 2024 to support February 29
    const testDate = new Date(2024, month, 0);
    const daysInMonth = testDate.getDate();

    return day <= daysInMonth;
}

function getNextBirthday(dateString) {
    if (!isValidBirthday(dateString)) {
        return null;
    }

    const parts = dateString.split("-");
    const month = Number(parts[0]);
    const day = Number(parts[1]);

    const today = new Date();
    const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    let birthday = new Date(
        today.getFullYear(),
        month - 1,
        day
    );

    if (birthday < todayStart) {
        birthday = new Date(
            today.getFullYear() + 1,
            month - 1,
            day
        );
    }

    return birthday;
}

function daysUntilBirthday(dateString) {
    const birthday = getNextBirthday(dateString);
    if (!birthday) {
        return Infinity;
    }

    const today = new Date();
    const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    return Math.round(
        (birthday.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
    );
}

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
// NAVIGATION & VIEW SWITCHING
// ---------------------------------------------------------

function showDashboard() {
    const dashboardPage = document.getElementById("dashboardPage");
    const birthdaysPage = document.getElementById("birthdaysPage");

    if (dashboardPage) {
        dashboardPage.style.display = "";
    }

    if (birthdaysPage) {
        birthdaysPage.style.display = "none";
    }

    hideBirthdayForm();

    if (tg?.BackButton) {
        tg.BackButton.hide();
    }
}

function showBirthdays() {
    const dashboardPage = document.getElementById("dashboardPage");
    const birthdaysPage = document.getElementById("birthdaysPage");

    if (dashboardPage) {
        dashboardPage.style.display = "none";
    }

    if (birthdaysPage) {
        birthdaysPage.style.display = "";
    }

    hideBirthdayForm();
    displayBirthdays();

    if (tg?.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(showDashboard);
    }
}

// ---------------------------------------------------------
// FORM CONTROLS
// ---------------------------------------------------------

function showBirthdayForm(birthday = null) {
    const birthdayForm = document.getElementById("birthdayForm");
    const birthdayName = document.getElementById("birthdayName");
    const birthdayDate = document.getElementById("birthdayDate");
    const saveBirthdayButton = document.getElementById("saveBirthdayButton");

    if (!birthdayForm) {
        return;
    }

    birthdayForm.style.display = "block";

    const heading = birthdayForm.querySelector("h2, h3, .form-title");

    if (birthday) {
        editingBirthdayId = birthday.id;
        if (birthdayName) birthdayName.value = birthday.name;
        if (birthdayDate) birthdayDate.value = birthday.date;

        if (heading) heading.textContent = "Edit Birthday";
        if (saveBirthdayButton) saveBirthdayButton.textContent = "Save Changes";
    } else {
        editingBirthdayId = null;
        if (birthdayName) birthdayName.value = "";
        if (birthdayDate) birthdayDate.value = "";

        if (heading) heading.textContent = "Add Birthday";
        if (saveBirthdayButton) saveBirthdayButton.textContent = "Save Birthday";
    }

    setTimeout(() => {
        if (birthdayName) birthdayName.focus();
    }, 100);
}

function hideBirthdayForm() {
    const birthdayForm = document.getElementById("birthdayForm");
    const birthdayName = document.getElementById("birthdayName");
    const birthdayDate = document.getElementById("birthdayDate");

    if (!birthdayForm) {
        return;
    }

    birthdayForm.style.display = "none";
    editingBirthdayId = null;

    if (birthdayName) birthdayName.value = "";
    if (birthdayDate) birthdayDate.value = "";
}

// ---------------------------------------------------------
// CRUD OPERATIONS
// ---------------------------------------------------------

function saveBirthday() {
    const birthdayName = document.getElementById("birthdayName");
    const birthdayDate = document.getElementById("birthdayDate");

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

    // Edit existing entry
    if (editingBirthdayId) {
        const index = birthdays.findIndex(item => item.id === editingBirthdayId);
        if (index !== -1) {
            birthdays[index].name = name;
            birthdays[index].date = date;
        }
    } else {
        // Add new entry
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
    const birthday = birthdays.find(item => item.id === id);
    if (!birthday) {
        return;
    }

    const confirmed = confirm(`Delete ${birthday.name}'s birthday?`);
    if (!confirmed) {
        return;
    }

    birthdays = birthdays.filter(item => item.id !== id);
    saveBirthdays();

    if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("warning");
    }

    displayBirthdays();
}

// ---------------------------------------------------------
// RENDER BIRTHDAYS LIST
// ---------------------------------------------------------

function displayBirthdays() {
    const birthdayList = document.getElementById("birthdayList");
    if (!birthdayList) {
        return;
    }

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

    // Sort by nearest upcoming date
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

    // Attach edit button listeners
    birthdayList.querySelectorAll(".birthday-edit").forEach(button => {
        button.addEventListener("click", function () {
            const id = this.dataset.id;
            const birthday = birthdays.find(item => item.id === id);
            if (birthday) {
                showBirthdayForm(birthday);
            }
        });
    });

    // Attach delete button listeners
    birthdayList.querySelectorAll(".birthday-delete").forEach(button => {
        button.addEventListener("click", function () {
            const id = this.dataset.id;
            deleteBirthday(id);
        });
    });
}

// ---------------------------------------------------------
// DOM READY & GLOBAL EVENT DELEGATION
// ---------------------------------------------------------

document.addEventListener("DOMContentLoaded", function () {
    loadBirthdays();
    showDashboard();

    // Global click listener to avoid timing issues or nested element misses
    document.body.addEventListener("click", function (event) {
        // 1. Birthday tile click (supports data attribute, class, or id)
        const birthdayTrigger = event.target.closest(
            '[data-feature="birthdays"], #birthdaysTile, #openBirthdaysBtn, .tile-birthdays'
        );
        if (birthdayTrigger) {
            event.preventDefault();
            showBirthdays();
            return;
        }

        // 2. Generic unbuilt modules
        const genericFeature = event.target.closest("[data-feature]");
        if (genericFeature) {
            const feature = genericFeature.dataset.feature;
            if (feature !== "birthdays") {
                event.preventDefault();
                alert(`${feature.charAt(0).toUpperCase() + feature.slice(1)} module coming soon.`);
                return;
            }
        }

        // 3. Back button
        if (event.target.closest("#birthdayBackButton")) {
            event.preventDefault();
            showDashboard();
            return;
        }

        // 4. Add birthday button
        if (event.target.closest("#addBirthdayButton")) {
            event.preventDefault();
            showBirthdayForm();
            return;
        }

        // 5. Cancel birthday form
        if (event.target.closest("#cancelBirthdayButton")) {
            event.preventDefault();
            hideBirthdayForm();
            return;
        }

        // 6. Search placeholder
        if (event.target.closest("#searchButton")) {
            event.preventDefault();
            alert("Universal Search coming soon in Phase 5!");
            return;
        }
    });

    // Save button click
    const saveBtn = document.getElementById("saveBirthdayButton");
    if (saveBtn) {
        saveBtn.addEventListener("click", function (e) {
            e.preventDefault();
            saveBirthday();
        });
    }

    // Form submit event (e.g. if submitted via keyboard)
    const form = document.getElementById("birthdayForm");
    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            saveBirthday();
        });
    }

    // Date formatting (MM-DD)
    const dateInput = document.getElementById("birthdayDate");
    if (dateInput) {
        dateInput.addEventListener("input", function () {
            let value = this.value.replace(/\D/g, "");

            if (value.length > 4) {
                value = value.substring(0, 4);
            }

            if (value.length >= 3) {
                value = value.substring(0, 2) + "-" + value.substring(2);
            }

            this.value = value;
        });

        dateInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                saveBirthday();
            }
        });
    }

    // Enter key submission on name field
    const nameInput = document.getElementById("birthdayName");
    if (nameInput) {
        nameInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                saveBirthday();
            }
        });
    }
});
