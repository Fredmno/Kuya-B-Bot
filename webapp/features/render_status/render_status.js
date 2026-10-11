/* =========================================================
   KUYA B — RENDER STATUS & DEPLOYMENT HISTORY
   webapp/features/render_status/render_status.js
   ========================================================= */

(function () {
    "use strict";

    // Recent deployment log history
    const DEPLOYMENTS = [
        {
            id: "dep-103",
            name: "Deploy #103 — Neomorphic & Dashboard Relocation",
            date: "2026-10-11 21:04",
            status: "Live",
            commit: "c3f82a1",
            message: "Consolidated dashboard into core/dashboard with neomorphic styles and fixed admin button positioning."
        },
        {
            id: "dep-102",
            name: "Deploy #102 — Fix Start Handler TypeError",
            date: "2026-10-11 18:48",
            status: "Success",
            commit: "a810f9e",
            message: "Provided start_command callback to register_all_handlers in bot.py."
        },
        {
            id: "dep-101",
            name: "Deploy #101 — Routes Reorganization",
            date: "2026-10-11 18:45",
            status: "Success",
            commit: "54b209d",
            message: "Cleaned up webapp.core.routes import in bot.py."
        }
    ];

    function triggerHaptic(type) {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type || "light");
        }
    }

    function renderDeploymentList() {
        const container = document.getElementById("deploymentList");
        if (!container) return;

        container.innerHTML = "";
        DEPLOYMENTS.forEach(item => {
            const badgeClass = item.status === "Live" 
                ? "badge-live" 
                : (item.status === "Success" ? "badge-success" : "badge-failed");

            const div = document.createElement("div");
            div.className = "deploy-item";
            div.onclick = () => openDeployModal(item);
            div.innerHTML = `
                <div class="deploy-info">
                    <div class="deploy-name">${item.name}</div>
                    <div class="deploy-date">📅 ${item.date}</div>
                </div>
                <span class="deploy-badge ${badgeClass}">${item.status}</span>
            `;
            container.appendChild(div);
        });
    }

    // Open Render Status Full View
    window.openRenderStatusView = function () {
        triggerHaptic("light");

        const appRoot = document.getElementById("app") || document.body;
        for (let child of appRoot.children) {
            if (child.id !== "render-status-view" && child.tagName !== "SCRIPT") {
                child.dataset.prevDisplay = child.style.display;
                child.style.display = "none";
            }
        }

        const view = document.getElementById("render-status-view");
        if (view) {
            view.style.display = "block";
            renderDeploymentList();
        }
    };

    // Close Render Status View & Return to Admin Panel or Dashboard
    window.closeRenderStatusView = function () {
        triggerHaptic("light");

        const view = document.getElementById("render-status-view");
        if (view) view.style.display = "none";

        const adminView = document.getElementById("admin-panel-view");
        if (adminView) {
            adminView.style.display = "block";
        } else {
            const appRoot = document.getElementById("app") || document.body;
            for (let child of appRoot.children) {
                if (child.id !== "render-status-view" && child.tagName !== "SCRIPT") {
                    child.style.display = child.dataset.prevDisplay || "";
                }
            }
        }
    };

    // Open Committer Directly from the Deployment Header Button
    window.openCommitterFromDeploy = function () {
        triggerHaptic("light");

        const deployView = document.getElementById("render-status-view");
        if (deployView) {
            deployView.dataset.openedFromHere = "true";
            deployView.style.display = "none";
        }

        if (window.openCommitterView) {
            window.openCommitterView();
        } else {
            const committerView = document.getElementById("committer-view") || 
                                  document.getElementById("adminUpdaterPage");
            if (committerView) committerView.style.display = "block";
            if (window.fetchRepoTree) window.fetchRepoTree();
        }
    };

    // Open Modal Details for Selected Deploy
    window.openDeployModal = function (deploy) {
        triggerHaptic("light");

        const nameEl = document.getElementById("modalDeployName");
        const statusEl = document.getElementById("modalDeployStatus");
        const dateEl = document.getElementById("modalDeployDate");
        const commitEl = document.getElementById("modalDeployCommit");
        const messageEl = document.getElementById("modalDeployMessage");

        if (nameEl) nameEl.innerText = deploy.name;
        if (statusEl) statusEl.innerText = deploy.status;
        if (dateEl) dateEl.innerText = deploy.date;
        if (commitEl) commitEl.innerText = deploy.commit;
        if (messageEl) messageEl.innerText = deploy.message;

        const modal = document.getElementById("deploymentDetailModal");
        if (modal) modal.style.display = "flex";
    };

    // Close Modal Details
    window.closeDeployModal = function () {
        const modal = document.getElementById("deploymentDetailModal");
        if (modal) modal.style.display = "none";
    };

    // Global Registry
    window.KuyaB = window.KuyaB || {};
    window.KuyaB.renderStatus = {
        open: window.openRenderStatusView,
        check: async function () {
            window.openRenderStatusView();
            return { status: "Operational" };
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderDeploymentList);
    } else {
        renderDeploymentList();
    }
})();
