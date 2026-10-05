// app.js
// Telegram Personal Hub - Birthday Module

const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

// --------------------------------------------------
// DATA
// --------------------------------------------------

let birthdays = JSON.parse(localStorage.getItem("birthdays") || "[]");

// --------------------------------------------------
// ELEMENTS
// --------------------------------------------------

const homePage = document.getElementById("homePage");
const birthdayPage = document.getElementById("birthdayPage");
const birthdayFormPage = document.getElementById("birthdayFormPage");

const birthdayList = document.getElementById("birthdayList");

const addBirthdayBtn = document.getElementById("addBirthdayBtn");
const backBirthdayBtn = document.getElementById("backBirthdayBtn");
const cancelBirthdayBtn = document.getElementById("cancelBirthdayBtn");

const birthdayForm = document.getElementById("birthdayForm");

const birthdayName = document.getElementById("birthdayName");
const birthdayDate = document.getElementById("birthdayDate");
const birthdayNotes = document.getElementById("birthdayNotes");

let editingBirthdayId = null;

// --------------------------------------------------
// PAGE NAVIGATION
// --------------------------------------------------

function showPage(page) {
    if (homePage) homePage.classList.add("hidden");
    if (birthdayPage) birthdayPage.classList.add("hidden");
    if (birthdayFormPage) birthdayFormPage.classList.add("hidden");

    if (page) {
        page.classList.remove("hidden");
    }
}

function showHome() {
    showPage(homePage);
}

function showBirthdays() {
    showPage(birthdayPage);
    displayBirthdays();
}

function showBirthdayForm(id = null) {
    showPage(birthdayFormPage);

    editingBirthdayId = id;

    if (id) {
        const birthday = birthdays.find(item => item.id === id);

        if (!birthday) {
            editingBirthdayId = null;
            resetBirthdayForm();
            return;
        }

        birthdayName.value = birthday.name || "";
        birthdayDate.value = birthday.date || "";
        birthdayNotes.value = birthday.notes || "";

        const title = document.getElementById("birthdayFormTitle");

        if (title) {
            title.textContent = "Edit Birthday";
        }
    } else {
        resetBirthdayForm();

        const title = document.getElementById("birthdayFormTitle");

        if (title) {
            title.textContent = "Add Birthday";
        }
    }
}

// --------------------------------------------------
// STORAGE
// --------------------------------------------------

function saveBirthdays() {
    localStorage.setItem("birthdays", JSON.stringify(birthdays));
}

// --------------------------------------------------
// ESCAPE HTML
// --------------------------------------------------

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

// --------------------------------------------------
// DATE HELPERS
// --------------------------------------------------

function getBirthdayThisYear(dateString) {
    const originalDate = new Date(dateString + "T00:00:00");

    if (Number.isNaN(originalDate.getTime())) {
        return null;
    }

    const today = new Date();

    let birthday = new Date(
        today.getFullYear(),
        originalDate.getMonth(),
        originalDate.getDate()
    );

    // If the birthday has already passed this year,
    // use next year.
    const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    if (birthday < todayStart) {
        birthday = new Date(
            today.getFullYear() + 1,
            originalDate.getMonth(),
            originalDate.getDate()
        );
    }

    return birthday;
}

function daysUntilBirthday(dateString) {
    const birthday = getBirthdayThisYear(dateString);

    if (!birthday) {
        return Infinity;
    }

    const today = new Date();

    const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    const birthdayStart = new Date(
        birthday.getFullYear(),
        birthday.getMonth(),
        birthday.getDate()
    );

    return Math.ceil(
        (birthdayStart - todayStart) / (1000 * 60 * 60 * 24)
    );
}

function formatBirthdayDate(dateString) {
    const date = new Date(dateString + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric"
    });
}

function formatBirthdayFullDate(dateString) {
    const date = new Date(dateString + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

// --------------------------------------------------
// DISPLAY BIRTHDAYS
// --------------------------------------------------

function displayBirthdays() {
    if (!birthdayList) {
        console.error("birthdayList element not found.");
        return;
    }

    birthdayList.innerHTML = "";

    if (!birthdays.length) {
        birthdayList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎂</div>
                <h3>No birthdays yet</h3>
                <p>Add your first birthday to your personal hub.</p>
            </div>
        `;

        return;
    }

    // Sort by upcoming birthday
    const sortedBirthdays = [...birthdays].sort((a, b) => {
        return daysUntilBirthday(a.date) - daysUntilBirthday(b.date);
    });

    sortedBirthdays.forEach(birthday => {
        const days = daysUntilBirthday(birthday.date);

        let countdownText = "";

        if (days === 0) {
            countdownText = "🎉 Today!";
        } else if (days === 1) {
            countdownText = "Tomorrow";
        } else if (days !== Infinity) {
            countdownText = `In ${days} days`;
        }

        const card = document.createElement("div");

        card.className = "birthday-card";

        if (days === 0) {
            card.classList.add("birthday-today");
        } else if (days <= 7) {
            card.classList.add("birthday-soon");
        }

        card.innerHTML = `
            <div class="birthday-card-main">
                <div class="birthday-icon">
                    🎂
                </div>

                <div class="birthday-info">
                    <h3>${escapeHtml(birthday.name)}</h3>

                    <div class="birthday-date">
                        ${escapeHtml(formatBirthdayDate(birthday.date))}
                    </div>

                    ${
                        birthday.notes
                            ? `
                                <div class="birthday-notes">
                                    ${escapeHtml(birthday.notes)}
                                </div>
                              `
                            : ""
                    }

                    ${
                        countdownText
                            ? `
                                <div class="birthday-countdown">
                                    ${escapeHtml(countdownText)}
                                </div>
                              `
                            : ""
                    }
                </div>
            </div>

            <div class="birthday-actions">
                <button
                    class="edit-birthday-btn"
                    data-id="${escapeHtml(birthday.id)}"
                    type="button"
                >
                    ✏️
                </button>

                <button
                    class="delete-birthday-btn"
                    data-id="${escapeHtml(birthday.id)}"
                    type="button"
                >
                    🗑️
                </button>
            </div>
        `;

        birthdayList.appendChild(card);
    });

    attachBirthdayActions();
}

// --------------------------------------------------
// BIRTHDAY ACTIONS
// --------------------------------------------------

function attachBirthdayActions() {
    const editButtons = document.querySelectorAll(".edit-birthday-btn");

    editButtons.forEach(button => {
        button.addEventListener("click", function () {
            const id = this.dataset.id;

            showBirthdayForm(id);
        });
    });

    const deleteButtons = document.querySelectorAll(".delete-birthday-btn");

    deleteButtons.forEach(button => {
        button.addEventListener("click", function () {
            const id = this.dataset.id;

            deleteBirthday(id);
        });
    });
}

// --------------------------------------------------
// ADD / EDIT BIRTHDAY
// --------------------------------------------------

function saveBirthday(event) {
    event.preventDefault();

    const name = birthdayName?.value.trim();
    const date = birthdayDate?.value;
    const notes = birthdayNotes?.value.trim();

    if (!name) {
        alert("Please enter a name.");
        return;
    }

    if (!date) {
        alert("Please select a birthday.");
        return;
    }

    if (editingBirthdayId) {
        const index = birthdays.findIndex(
            item => item.id === editingBirthdayId
        );

        if (index !== -1) {
            birthdays[index] = {
                ...birthdays[index],
                name,
                date,
                notes
            };
        }
    } else {
        const newBirthday = {
            id:
                Date.now().toString() +
                Math.random().toString(36).substring(2, 9),

            name,
            date,
            notes
        };

        birthdays.push(newBirthday);
    }

    saveBirthdays();

    editingBirthdayId = null;

    resetBirthdayForm();

    showBirthdays();
}

// --------------------------------------------------
// DELETE BIRTHDAY
// --------------------------------------------------

function deleteBirthday(id) {
    const birthday = birthdays.find(item => item.id === id);

    if (!birthday) {
        return;
    }

    const confirmed = confirm(
        `Delete ${birthday.name}'s birthday?`
    );

    if (!confirmed) {
        return;
    }

    birthdays = birthdays.filter(item => item.id !== id);

    saveBirthdays();

    displayBirthdays();
}

// --------------------------------------------------
// FORM RESET
// --------------------------------------------------

function resetBirthdayForm() {
    if (birthdayForm)