const tg = window.Telegram.WebApp;


// =========================
// Initialize Telegram Mini App
// =========================

tg.ready();
tg.expand();


// =========================
// Feature buttons
// =========================

const featureButtons =
    document.querySelectorAll("[data-feature]");


featureButtons.forEach((button) => {

    button.addEventListener("click", () => {

        const feature =
            button.dataset.feature;

        openFeature(feature);

    });

});


// =========================
// Open features
// =========================

function openFeature(feature) {

    switch (feature) {

        case "daily":

            tg.showAlert(
                "📅 Daily Logs\n\n"
                + "This section is coming next."
            );

            break;


        case "tasks":

            tg.showAlert(
                "✅ Tasks\n\n"
                + "Task management is coming next."
            );

            break;


        case "reminders":

            tg.showAlert(
                "⏰ Reminders\n\n"
                + "Reminder management is coming next."
            );

            break;


        case "birthdays":

            openBirthdays();

            break;


        case "videos":

            tg.showAlert(
                "🎥 Videos\n\n"
                + "Your Telegram video vault is coming next."
            );

            break;


        case "pictures":

            tg.showAlert(
                "🖼️ Pictures\n\n"
                + "Your Telegram picture vault is coming next."
            );

            break;


        case "other":

            tg.showAlert(
                "📚 Other Content\n\n"
                + "Your other content vault is coming next."
            );

            break;


        case "search":

            tg.showAlert(
                "🔍 Search\n\n"
                + "Vault search is coming next."
            );

            break;


        default:

            tg.showAlert(
                "This feature is not available yet."
            );

    }

}


// =========================
// Birthday Manager
// =========================

function openBirthdays() {

    tg.showAlert(
        "🎂 Birthday Manager\n\n"
        + "Your existing birthday system "
        + "will be connected here next."
    );

}


// =========================
// Search
// =========================

document
    .getElementById("searchButton")
    .addEventListener("click", () => {

        tg.showAlert(
            "🔍 Search\n\n"
            + "Search across your personal vault "
            + "is coming next."
        );

    });


// =========================
// Add Content
// =========================

document
    .getElementById("addContentButton")
    .addEventListener("click", () => {

        tg.showAlert(
            "➕ Add Content\n\n"
            + "Soon you will be able to send content "
            + "to Kuya B and choose where to store it."
        );

    });


// =========================
// Word Game
// =========================

document
    .getElementById("gameButton")
    .addEventListener("click", () => {

        /*
         * The existing Word Scramble game
         * is still handled by the Telegram bot.
         *
         * Close the Mini App so you can
         * continue using the bot.
         */

        tg.close();

    });