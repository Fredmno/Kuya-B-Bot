// Authorized numeric Telegram User ID
const ADMIN_USER_IDS = [7698531657];

function initAdminFeature() {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;

    // Check if user is an authorized admin
    if (user && ADMIN_USER_IDS.includes(Number(user.id))) {
        const adminBtn = document.getElementById("admin-panel-btn");
        if (!adminBtn) return;

        // Locate search bar to position the button right above it
        const searchInput = document.querySelector('input[type="search"]') || 
                            document.querySelector('input[placeholder*="Search" i]') || 
                            document.getElementById("search-input");

        if (searchInput) {
            const searchContainer = searchInput.closest(".search-container") || 
                                    searchInput.closest(".search-wrapper") || 
                                    searchInput.parentElement;

            if (searchContainer && searchContainer.parentElement) {
                searchContainer.parentElement.insertBefore(adminBtn, searchContainer);
            }
        }

        // Show the button
        adminBtn.style.display = "inline-flex";
    }
}

function openAdminPanel() {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;

    if (!user || !ADMIN_USER_IDS.includes(Number(user.id))) {
        alert("Access Denied: You do not have administrator permissions.");
        return;
    }

    // Hide dashboard, display admin panel
    const dashboardRoot = document.getElementById("dashboard-content") || 
                          document.querySelector(".dashboard-grid") ||
                          document.getElementById("app-root");
    if (dashboardRoot) dashboardRoot.style.display = "none";

    const adminView = document.getElementById("admin-panel-view");
    if (adminView) adminView.style.display = "block";
}

function closeAdminPanel() {
    const adminView = document.getElementById("admin-panel-view");
    if (adminView) adminView.style.display = "none";

    const dashboardRoot = document.getElementById("dashboard-content") || 
                          document.querySelector(".dashboard-grid") ||
                          document.getElementById("app-root");
    if (dashboardRoot) dashboardRoot.style.display = "";
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

// Run when DOM is loaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdminFeature);
} else {
    initAdminFeature();
}
