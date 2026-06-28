const tg = window.Telegram.WebApp;

tg.ready();
tg.expand();

document.getElementById("birthdayButton").addEventListener("click", () => {
    tg.showAlert("Birthday Manager setup is next.");
});