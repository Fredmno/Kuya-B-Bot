// Replace with your numeric Telegram user ID
const ADMIN_USER_IDS = [123456789];

function initAdminFeature() {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;

    // Check if current user is an admin
    if (user && ADMIN_USER_IDS.includes(user.id)) {
        const adminCard = document.getElementById("admin-panel-card");
        if (adminCard) {
            adminCard.style.display = "flex";
        }
    }
}

function openAdminPanel() {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;

    if (!user || !ADMIN_USER_IDS.includes(user.id)) {
        alert("Access Denied: You do not have administrator permissions.");
        return;
    }

    // Hide dashboard sections, display the admin screen
    const dashboardRoot = document.getElementById("dashboard-content") || document.querySelector(".dashboard-grid");
    if (dashboardRoot) dashboardRoot.style.display = "none";

    const adminView = document.getElementById("admin-panel-view");
    if (adminView) adminView.style.display = "block";
}

function closeAdminPanel() {
    const adminView = document.getElementById("admin-panel-view");
    if (adminView) adminView.style.display = "none";

    const dashboardRoot = document.getElementById("dashboard-content") || document.querySelector(".dashboard-grid");
    if (dashboardRoot) dashboardRoot.style.display = "grid";
}

async function triggerRegenerateTree() {
    alert("Triggering directory structure sync...");
    // Can call your backend endpoint when set up
}

async function checkServerHealth() {
    try {
        const res = await fetch("/health");
        if (res.ok) {
            alert("Server is running smoothly (Status 200)");
        } else {
            alert(`Server returned status: ${res.status}`);
        }
    } catch (err) {
        alert(`Failed to check health: ${err.message}`);
    }
}

// Check admin status on page load
document.addEventListener("DOMContentLoaded", () => {
    initAdminFeature();
});
