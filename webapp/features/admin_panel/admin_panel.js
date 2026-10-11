// Replace with your actual numeric Telegram User ID
const ADMIN_USER_IDS = 7698531657;

function initAdminFeature() {
    const tg = window.Telegram?.WebApp;
    // Fallback allows visibility during local desktop browser testing if outside Telegram
    const user = tg?.initDataUnsafe?.user;

    // Check if user is authorized admin
    if (user && ADMIN_USER_IDS.includes(user.id)) {
        const adminCard = document.getElementById("admin-panel-card");
        if (adminCard) {
            // Unhide card
            adminCard.style.display = "flex";

            // If card is outside the main dashboard grid, attach it inside
            const dashboardGrid = document.querySelector(".dashboard-grid") || document.getElementById("dashboard-content");
            if (dashboardGrid && !dashboardGrid.contains(adminCard)) {
                dashboardGrid.appendChild(adminCard);
            }
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

    // Hide dashboard, display admin panel
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

// Run as soon as DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdminFeature);
} else {
    initAdminFeature();
}
