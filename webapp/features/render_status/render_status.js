/* =========================================================
   KUYA B — RENDER STATUS & DEPLOYMENT HISTORY
   webapp/features/render_status/render_status.js
   ========================================================= */

(function () {
    "use strict";

    let cachedDeployments = [];

    function triggerHaptic(type) {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type || "light");
        }
    }

    async function fetchDeployments() {
        const container = document.getElementById("deploymentList");
        if (container && cachedDeployments.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-sub); font-size: 12px; padding: 12px;">Loading deployments...</div>';
        }

        try {
            const res = await fetch("/api/deployment-history");
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
            container.innerHTML = '<div style="text-align: center; color: var(--text-sub); font-size: 12px; padding: 16px;">No recent deployment events recorded yet. Push a commit or trigger a deploy to populate logs.</div>';
            return;
        }

        container.innerHTML = "";
        cachedDeployments.forEach(item => {
            const badgeClass = item.status === "Live" 
                ? "badge-live" 
                : (item.status === "Building" ? "badge-success" : "badge-failed");

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
        } else {
            const committerView = document.getElementById("committer-view") || 
                                  document.getElementById("adminUpdaterPage");
            if (committerView) committerView.style.display = "block";
            if (window.fetchRepoTree) window.fetchRepoTree();
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

        if (nameEl) nameEl.innerText = deploy.name;
        if (statusEl) statusEl.innerText = deploy.status;
        if (dateEl) dateEl.innerText = deploy.date;
        if (commitEl) commitEl.innerText = deploy.commit;
        if (authorEl) authorEl.innerText = deploy.author || "Git Push";
        if (messageEl) messageEl.innerText = deploy.message;

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
