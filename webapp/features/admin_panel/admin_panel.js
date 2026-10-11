const ADMIN_USER_IDS = [7698531657];

function mountAdminButton() {
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.ready();
    }

    const user = tg?.initDataUnsafe?.user;
    const isAuthorized = user && ADMIN_USER_IDS.some(id => String(id) === String(user.id));

    if (!isAuthorized) return;

    let adminBtn = document.getElementById("admin-panel-btn");
    if (!adminBtn) return;

    // Locate the search bar on your dashboard
    const searchInput = document.querySelector('input[placeholder*="Search" i]') || 
                        document.querySelector('input[type="text"]') ||
                        document.querySelector('input[type="search"]');

    if (searchInput) {
        const searchContainer = searchInput.closest('.search-box') || 
                                searchInput.closest('.search-container') || 
                                searchInput.closest('.search-bar') ||
                                searchInput.parentElement;

        if (searchContainer && searchContainer.parentElement) {
            // Container to align button neatly to the upper right above the search box
            let headerWrapper = document.getElementById("admin-btn-wrapper");
            if (!headerWrapper) {
                headerWrapper = document.createElement("div");
                headerWrapper.id = "admin-btn-wrapper";
                headerWrapper.style.cssText = "display: flex; justify-content: flex-end; width: 100%; margin-bottom: 8px;";
                searchContainer.parentElement.insertBefore(headerWrapper, searchContainer);
            }
            headerWrapper.appendChild(adminBtn);
        }
    }

    adminBtn.style.display = "inline-flex";
}

function openAdminPanel() {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    const isAuthorized = user && ADMIN_USER_IDS.some(id => String(id) === String(user.id));

    if (!isAuthorized) {
        alert("Access Denied: You do not have administrator permissions.");
        return;
    }

    const appRoot = document.getElementById("app") || document.body;
    for (let child of appRoot.children) {
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

    const appRoot = document.getElementById("app") || document.body;
    for (let child of appRoot.children) {
        if (child.id !== "admin-panel-view" && child.tagName !== "SCRIPT") {
            child.style.display = child.dataset.prevDisplay || "";
        }
    }
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

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAdminButton);
} else {
    mountAdminButton();
}

setTimeout(mountAdminButton, 400);
