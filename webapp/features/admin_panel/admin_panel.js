const ADMIN_USER_IDS = [7698531657];

function mountAdminButton() {
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
    }

    const user = tg?.initDataUnsafe?.user;

    // Verify authorized ID (comparing as numbers or strings)
    const isAuthorized = user && ADMIN_USER_IDS.some(id => String(id) === String(user.id));

    if (isAuthorized) {
        let adminBtn = document.getElementById("admin-panel-btn");
        if (!adminBtn) return;

        // Target the search input element
        const searchInput = document.querySelector('input[placeholder*="Search" i]') || 
                            document.querySelector('input[type="text"]') ||
                            document.querySelector('input[type="search"]');

        if (searchInput) {
            // Find the outermost container for the search bar
            const targetContainer = searchInput.closest('.search-box') || 
                                    searchInput.closest('.search-container') || 
                                    searchInput.parentElement;

            if (targetContainer && targetContainer.parentNode) {
                // Insert directly above the search container
                targetContainer.parentNode.insertBefore(adminBtn, targetContainer);
            }
        }

        // Show button
        adminBtn.style.display = "inline-flex";
    }
}

function openAdminPanel() {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;

    const isAuthorized = user && ADMIN_USER_IDS.some(id => String(id) === String(user.id));
    if (!isAuthorized) {
        alert("Access Denied: You do not have administrator permissions.");
        return;
    }

    // Hide main views and display Admin View
    const mainApp = document.getElementById("app") || document.body;
    for (let child of mainApp.children) {
        if (child.id !== "admin-panel-view" && child.tagName !== "SCRIPT") {
            child.dataset.prevDisplay = child.style.display;
            child.style.display = "none";
        }
    }

    const adminView = document.getElementById("admin-panel-view");
    if (adminView) adminView.style.display = "block";
}

function closeAdminPanel() {
    const adminView = document.getElementById("admin-panel-view");
    if (adminView) adminView.style.display = "none";

    // Restore previous display states
    const mainApp = document.getElementById("app") || document.body;
    for (let child of mainApp.children) {
        if (child.id !== "admin-panel-view" && child.tagName !== "SCRIPT") {
            child.style.display = child.dataset.prevDisplay || "";
        }
    }
}

// Ensure execution even if DOMContentLoaded has already fired
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAdminButton);
} else {
    mountAdminButton();
}

// Backup check in case Telegram WebApp initializes after DOM ready
setTimeout(mountAdminButton, 300);
