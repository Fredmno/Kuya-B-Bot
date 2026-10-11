/* =========================================================
   KUYA B — RENDER STATUS & DEPLOYMENT HISTORY
   webapp/features/render_status/render_status.js
   ========================================================= */

(function () {
    "use strict";

    // Recent deployment log data
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

    window.openRenderStatusView = function () {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
        }

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

    window.closeRenderStatusView = function () {
        const view = document.getElementById("render-status-view");
        if (view) view.style.display = "none";

        const appRoot = document.getElementById("app") || document.body;
        for (let child of appRoot.children) {
            if (child.id !== "render-status-view" && child.tagName !== "SCRIPT") {
                child.style.display = child.dataset.prevDisplay || "";
            }
        }
    };

    window.openDeployModal = function (deploy) {
        document.getElementById("modalDeployName").innerText = deploy.name;
        document.getElementById("modalDeployStatus").innerText = deploy.status;
        document.getElementById("modalDeployDate").innerText = deploy.date;
        document.getElementById("modalDeployCommit").innerText = deploy.commit;
        document.getElementById("modalDeployMessage").innerText = deploy.message;

        const modal = document.getElementById("deploymentDetailModal");
        if (modal) modal.style.display = "flex";
    };

    window.closeDeployModal = function () {
        const modal = document.getElementById("deploymentDetailModal");
        if (modal) modal.style.display = "none";
    };

    // Expose check method to window.KuyaB.renderStatus
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
