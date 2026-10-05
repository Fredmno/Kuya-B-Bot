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

const dashboardPage =
    document.getElementById("dashboardPage");

const birthdaysPage =
    document.getElementById("birthdaysPage");

const birthdayList =
    document.getElementById("birthdayList");

const birthdayForm =
    document.getElementById("birthdayForm");

const birthdayName =
    document.getElementById("birthdayName");

const birthdayDate =
    document.getElementById("birthdayDate");

const birthdayBackButton =
    document.getElementById("birthdayBackButton");

const addBirthdayButton =
    document.getElementById("addBirthdayButton");

const saveBirthdayButton =
    document.getElementById("saveBirthdayButton");

const cancelBirthdayButton =
    document.getElementById("cancelBirthdayButton");


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

        const saved =
            localStorage.getItem("kuyaB_birthdays");

        if (saved) {

            birthdays =
                JSON.parse(saved);

        } else {

            birthdays = [];

        }

    } catch (error) {

        console.error(
            "Unable to load birthdays:",
            error
        );

        birthdays = [];

    }

}


// ---------------------------------------------------------
// SAVE BIRTHDAYS
// ---------------------------------------------------------

function saveBirthdays() {

    try {

        localStorage.setItem(
            "kuyaB_birthdays",
            JSON.stringify(birthdays)
        );

    } catch (error) {

        console.error(
            "Unable to save birthdays:",
            error
        );

    }

}


// ---------------------------------------------------------
// ESCAPE HTML
// ---------------------------------------------------------

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
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

    const parts =
        value.split("-");

    const month =
        Number(parts[0]);

    const day =
        Number(parts[1]);

    if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
    ) {
        return false;
    }

    // Check actual number of days in month.
    const testDate =
        new Date(
            2024,
            month,
            0
        );

    const daysInMonth =
        testDate.getDate();

    return day <= daysInMonth;

}


// ---------------------------------------------------------
// GET NEXT BIRTHDAY
// ---------------------------------------------------------

function getNextBirthday(dateString) {

    if (!isValidBirthday(dateString)) {
        return null;
    }

    const parts =
        dateString.split("-");

    const month =
        Number(parts[0]);

    const day =
        Number(parts[1]);

    const today =
        new Date();

    const todayStart =
        new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        );

    let birthday =
        new Date(
            today.getFullYear(),
            month - 1,
            day
        );

    if (birthday < todayStart) {

        birthday =
            new Date(
                today.getFullYear() + 1,
                month - 1,
                day
            );

    }

    return birthday;

}


// ---------------------------------------------------------
// DAYS UNTIL BIRTHDAY
// ---------------------------------------------------------

function daysUntilBirthday(dateString) {

    const birthday =
        getNextBirthday(dateString);

    if (!birthday) {
        return Infinity;
    }

    const today =
        new Date();

    const todayStart =
        new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        );

    return Math.round(
        (
            birthday.getTime() -
            todayStart.getTime()
        ) /
        (1000 * 60 * 60 * 24)
    );

}


// ---------------------------------------------------------
// FORMAT BIRTHDAY
// ---------------------------------------------------------

function formatBirthday(dateString) {

    if (!isValidBirthday(dateString)) {
        return dateString;
    }

    const parts =
        dateString.split("-");

    const month =
        Number(parts[0]);

    const day =
        Number(parts[1]);

    const date =
        new Date(
            2024,
            month - 1,
            day
        );

    return date.toLocaleDateString(
        undefined,
        {
            month: "long",
            day: "numeric"
        }
    );

}


// ---------------------------------------------------------
// SHOW DASHBOARD
// ---------------------------------------------------------

function showDashboard() {

    if (dashboardPage) {

        dashboardPage.style.display =
            "";

    }

    if (birthdaysPage) {

        birthdaysPage.style.display =
            "none";

    }

    hideBirthdayForm();

}


// ---------------------------------------------------------
// SHOW BIRTHDAYS
// ---------------------------------------------------------

function showBirthdays() {

    if (dashboardPage) {

        dashboardPage.style.display =
            "none";

    }

    if (birthdaysPage) {

        birthdaysPage.style.display =
            "";

    }

    hideBirthdayForm();

    displayBirthdays();

}


// ---------------------------------------------------------
// SHOW BIRTHDAY FORM
// ---------------------------------------------------------

function showBirthdayForm(
    birthday = null
) {

    if (!birthdayForm) {
        return;
    }

    birthdayForm.style.display =
        "block";

    if (birthday) {

        editingBirthdayId =
            birthday.id;

        birthdayName.value =
            birthday.name;

        birthdayDate.value =
            birthday.date;

        const heading =
            birthdayForm.querySelector("h2");

        if (heading) {

            heading.textContent =
                "Edit Birthday";

        }

        if (saveBirthdayButton) {

            saveBirthdayButton.textContent =
                "Save Changes";

        }

    } else {

        editingBirthdayId =
            null;

        birthdayName.value =
            "";

        birthdayDate.value =
            "";

        const heading =
            birthdayForm.querySelector("h2");

        if (heading) {

            heading.textContent =
                "Add Birthday";

        }

        if (saveBirthdayButton) {

            saveBirthdayButton.textContent =
                "Save Birthday";

        }

    }

    setTimeout(() => {

        if (birthdayName) {
            birthdayName.focus();
        }

    }, 100);

}


// ---------------------------------------------------------
// HIDE BIRTHDAY FORM
// ---------------------------------------------------------

function hideBirthdayForm() {

    if (!birthdayForm) {
        return;
    }

    birthdayForm.style.display =
        "none";

    editingBirthdayId =
        null;

}


// ---------------------------------------------------------
// DISPLAY BIRTHDAYS
// ---------------------------------------------------------

function displayBirthdays() {

    if (!birthdayList) {
        return;
    }

    birthdayList.innerHTML =
        "";

    // -----------------------------------------------------
    // EMPTY STATE
    // -----------------------------------------------------

    if (!birthdays.length) {

        birthdayList.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    🎂
                </div>

                <strong>
                    No birthdays yet
                </strong>

                <small>
                    Add birthdays for family,
                    friends, and important people.
                </small>

            </div>

        `;

        return;

    }


    // -----------------------------------------------------
    // SORT BY UPCOMING
    // -----------------------------------------------------

    const sorted =
        [...birthdays].sort(
            (a, b) => {

                return (
                    daysUntilBirthday(a.date) -
                    daysUntilBirthday(b.date)
                );

            }
        );


    // -----------------------------------------------------
    // CREATE CARDS
    // -----------------------------------------------------

    sorted.forEach(
        birthday => {

            const days =
                daysUntilBirthday(
                    birthday.date
                );

            let countdownText =
                "";

            if (days === 0) {

                countdownText =
                    "🎉 Today!";

            } else if (days === 1) {

                countdownText =
                    "Tomorrow";

            } else if (
                days !== Infinity
            ) {

                countdownText =
                    `In ${days} days`;

            }


            let cardClass =
                "birthday-card";

            if (days === 0) {

                cardClass +=
                    " birthday-soon";

            } else if (days <= 7) {

                cardClass +=
                    " birthday-soon";

            }


            const card =
                document.createElement(
                    "div"
                );

            card.className =
                cardClass;


            card.innerHTML = `

                <div class="birthday-icon">
                    🎂
                </div>

                <div class="birthday-info">

                    <strong>
                        ${escapeHtml(
                            birthday.name
                        )}
                    </strong>

                    <span>
                        ${escapeHtml(
                            formatBirthday(
                                birthday.date
                            )
                        )}
                    </span>

                    <small>
                        ${