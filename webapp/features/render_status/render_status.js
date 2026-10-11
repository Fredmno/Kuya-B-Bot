/* =========================================================
   KUYA B — RENDER STATUS & DEPLOYMENT HISTORY
   webapp/features/render_status/render_status.js
   ========================================================= */

(function () {
    "use strict";

    let cachedDeployments = [];

    function triggerHaptic(type) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type || "light");
        }
    }

    async function fetchDeployments() {
        const container = document.getElementById("deploymentList");
        if (container) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-sub, #64748b); font-size: 12px; padding: 14px;">Fetching live deployment data...</div>';
        }

        try {
            // Append timestamp query parameter to bypass webview caching
            const res = await fetch("/api/deployment-history?_t=" + Date.now());
            if (res.ok) {
                const data = await res.json();
                cachedDeployments = data.deployments || [];
            }
        } catch (e) {
            console.error("Error fetching deployments:", e);
        }

        renderDeploymentList();
    }

    function renderDeploymentList() {
        const container = document.getElementById("deploymentList");
        if (!container) return;

        if (cachedDeployments.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-sub, #64748b); font-size: 12px; padding: 20px;">
                    No recent deployments found.<br>
                    <span style="font-size: 11px; opacity: 0.8;">Tap Refresh or ensure GITHUB_TOKEN has access to the repo.</span>
                </div>`;
            return;
        }

        container.innerHTML = "";
        cachedDeployments.forEach(item => {
            const statusLower = (item.status || "").toLowerCase();
            const badgeClass = (statusLower === "live" || statusLower === "succeeded")
                ? "badge-live" 
                : (statusLower === "building" ? "badge-success" : (statusLower === "success" ? "badge-live" : "badge-failed"));

            const div = document.createElement("div");
            div.className = "deploy-item";
            div.onclick = () => openDeployModal(item);
            div.innerHTML = `
                <div class="deploy-info">
                    <div class="deploy-name">${item.name || "Deployment"}</div>
                    <div class="deploy-date">📅 ${item.date || "Recent"}</div>
                </div>
                <span class="deploy-badge ${badgeClass}">${item.status || "Live"}</span>
            `;
            container.appendChild(div);
        });
    }

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
            fetchDeployments();
        }
    };

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

    window.openCommitterFromDeploy = function () {
        triggerHaptic("light");

        const deployView = document.getElementById("render-status-view");
        if (deployView) {
            deployView.dataset.openedFromHere = "true";
            deployView.style.display = "none";
        }

        if (window.openCommitterView) {
            window.openCommitterView();
        }
    };

    window.openDeployModal = function (deploy) {
        triggerHaptic("light");

        const nameEl = document.getElementById("modalDeployName");
        const statusEl = document.getElementById("modalDeployStatus");
        const dateEl = document.getElementById("modalDeployDate");
        const commitEl = document.getElementById("modalDeployCommit");
        const authorEl = document.getElementById("modalDeployAuthor");
        const messageEl = document.getElementById("modalDeployMessage");

        if (nameEl) nameEl.innerText = deploy.name || "Deploy Details";
        if (statusEl) statusEl.innerText = deploy.status || "Unknown";
        if (dateEl) dateEl.innerText = deploy.date || "N/A";
        if (commitEl) commitEl.innerText = deploy.commit || "N/A";
        if (authorEl) authorEl.innerText = deploy.author || "Render / Git";
        if (messageEl) messageEl.innerText = deploy.message || "No commit message";

        const modal = document.getElementById("deploymentDetailModal");
        if (modal) modal.style.display = "flex";
    };

    window.closeDeployModal = function () {
        const modal = document.getElementById("deploymentDetailModal");
        if (modal) modal.style.display = "none";
    };

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.renderStatus = {
        open: window.openRenderStatusView,
        refresh: fetchDeployments,
        check: async function () {
            window.openRenderStatusView();
            return { status: "Operational" };
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", fetchDeployments);
    } else {
        fetchDeployments();
    }
})();
