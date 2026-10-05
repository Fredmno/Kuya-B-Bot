const tg = window.Telegram.WebApp;

tg.ready();
tg.expand();

const dashboard = document.getElementById("dashboardPage");
const birthdaysPage = document.getElementById("birthdaysPage");

const birthdayList = document.getElementById("birthdayList");
const birthdayForm = document.getElementById("birthdayForm");

const birthdayName = document.getElementById("birthdayName");
const birthdayDate = document.getElementById("birthdayDate");

const birthdayButton =
    document.querySelector('[data-feature="birthdays"]');


// ==========================
// OPEN BIRTHDAYS
// ==========================

birthdayButton.addEventListener("click", () => {

    dashboard.style.display = "none";
    birthdaysPage.style.display = "block";

    loadBirthdays();

});


// ==========================
// BACK TO DASHBOARD
// ==========================

document
    .getElementById("birthdayBackButton")
    .addEventListener("click", () => {

        birthdaysPage.style.display = "none";
        dashboard.style.display = "block";

    });


// ==========================
// SHOW ADD FORM
// ==========================

document
    .getElementById("addBirthdayButton")
    .addEventListener("click", () => {

        birthdayForm.style.display = "block";

        birthdayName.focus();

    });


// ==========================
// CANCEL
// ==========================

document
    .getElementById("cancelBirthdayButton")
    .addEventListener("click", () => {

        birthdayForm.style.display = "none";

        birthdayName.value = "";
        birthdayDate.value = "";

    });
// ==========================
// LOAD BIRTHDAYS
// ==========================

async function loadBirthdays() {

    birthdayList.innerHTML = `
        <div style="
            text-align:center;
            color:#94a3b8;
            padding:30px;
        ">
            Loading birthdays...
        </div>
    `;

    try {

        const response =
            await fetch("/api/birthdays");

        const data =
            await response.json();

        if (!data.success) {
            throw new Error(data.error || "Failed to load birthdays.");
        }

        displayBirthdays(data.birthdays);

    } catch (error) {

        console.error(error);

        birthdayList.innerHTML = `
            <div style="
                text-align:center;
                color:#f87171;
                padding:30px;
            ">
                Unable to load birthdays.
            </div>
        `;

        tg.showAlert(
            "Could not load birthdays."
        );
    }
}


// ==========================
// DISPLAY BIRTHDAYS
// ==========================

function displayBirthdays(birthdays) {

    if (!birthdays || birthdays.length === 0) {

        birthdayList.innerHTML = `
            <div style="
                text-align:center;
                color:#94a3b8;
                padding:30px;
            ">
                🎂 No birthdays yet.
                <br><br>
                Tap "Add Birthday" to add one.
            </div>
        `;

        return;
    }


    birthdayList.innerHTML = "";


    birthdays.forEach(birthday => {

        const card =
            document.createElement("div");

        card.style.cssText = `
            background:#1e293b;
            border-radius:16px;
            padding:16px;
            margin-bottom:12px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
        `;


        const info =
            document.createElement("div");

        info.innerHTML = `
            <strong style="
                font-size:17px;
                display:block;
            ">
                🎂 ${escapeHtml(birthday.name)}
            </strong>

            <small style="
                color:#94a3b8;
                display:block;
                margin-top:5px;
            ">
                ${escapeHtml(birthday.birthday_mmdd)}
            </small>
        `;


        const deleteButton =
            document.createElement("button");

        deleteButton.textContent = "🗑️";

        deleteButton.style.cssText = `
            border:none;
            border-radius:10px;
            padding:10px;
            background:#450a0a;
            color:white;
            font-size:16px;
        `;


        deleteButton.addEventListener(
            "click",
            () => deleteBirthday(birthday.id)
        );


        card.appendChild(info);
        card.appendChild(deleteButton);

        birthdayList.appendChild(card);

    });
}
// ==========================
// SAVE BIRTHDAY
// ==========================

document
    .getElementById("saveBirthdayButton")
    .addEventListener("click", async () => {

        const name =
            birthdayName.value.trim();

        const birthday_mmdd =
            birthdayDate.value.trim();


        if (!name) {

            tg.showAlert(
                "Please enter a name."
            );

            return;
        }


        if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(birthday_mmdd)) {

            tg.showAlert(
                "Birthday must use MM-DD format.\nExample: 06-28"
            );

            return;
        }


        const user =
            tg.initDataUnsafe?.user;


        const payload = {

            chat_id: "mini_app_default",

            name: name,

            birthday_mmdd: birthday_mmdd,

            added_by_user_id:
                user?.id
                ? String(user.id)
                : "",

            added_by_name:
                user?.first_name || "Mini App User"

        };


        try {

            const response =
                await fetch(
                    "/api/birthdays",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(payload)
                    }
                );


            const data =
                await response.json();


            if (!data.success) {

                throw new Error(
                    data.error ||
                    "Failed to save birthday."
                );

            }


            birthdayName.value = "";
            birthdayDate.value = "";

            birthdayForm.style.display =
                "none";


            await loadBirthdays();


            tg.showAlert(
                "🎂 Birthday saved!"
            );


        } catch (error) {

            console.error(error);

            tg.showAlert(
                error.message ||
                "Could not save birthday."
            );

        }

    });


// ==========================
// DELETE BIRTHDAY
// ==========================

async function deleteBirthday(id) {

    const confirmed =
        confirm(
            "Delete this birthday?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                "/api/birthdays/delete",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            chat_id:
                                "mini_app_default",

                            id: id
                        })
                }
            );


        const data =
            await response.json();


        if (!data.success) {

            throw new Error(
                data.error ||
                "Failed to delete birthday."
            );

        }


        await loadBirthdays();


    } catch (error) {

        console.error(error);

        tg.showAlert(
            "Could not delete birthday."
        );

    }

}


// ==========================
// HTML SAFETY
// ==========================

function escapeHtml(value) {

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");

}


// ==========================
// OTHER BUTTONS
// ==========================

document
    .querySelectorAll("[data-feature]")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const feature =
                    button.dataset.feature;


                if (feature === "birthdays") {
                    return;
                }


                tg.showAlert(
                    `${button.innerText.trim()} is coming next.`
                );

            }
        );

    });


// Word game

document
    .getElementById("gameButton")
    ?.addEventListener(
        "click",
        () => {

            tg.close();

            // The existing /game command
            // remains available in Telegram.

        }
    );


// Search

document
    .getElementById("searchButton")
    ?.addEventListener(
        "click",
        () => {

            tg.showAlert(
                "Vault search is coming next."
            );

        }
    );


// Add content

document
    .getElementById("addContentButton")
    ?.addEventListener(
        "click",
        () => {

            tg.showAlert(
                "Content upload is coming next."
            );

        }
    );