/* =========================================================
   KUYA B — RENDER DEPLOYMENTS CONTROLLER
   webapp/features/deployments/deployments.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    let cachedDeploys = [];

    function triggerHaptic(type) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type || "light");
        }
    }

    function getStatusBadge(status) {
        const s = (status || "").toLowerCase();
        if (s === "live" || s === "succeeded" || s === "success") {
            return '<span style="background: #dcfce7; color: #166534; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">● Live</span>';
        } else if (s.includes("progress") || s.includes("building") || s.includes("created")) {
            return '<span style="background: #fef9c3; color: #854d0e; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">⏳ In Progress</span>';
        } else if (s.includes("fail") || s.includes("error") || s.includes("canceled")) {
            return '<span style="background: #fee2e2; color: #991b1b; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">✕ Failed</span>';
        }
        return `<span style="background: #e2e8f0; color: #475569; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">${status || 'Unknown'}</span>`;
    }

    window.openRenderStatusView = function () {
        triggerHaptic("light");
        const adminView = document.getElementById("admin-panel-view");
        if (adminView) adminView.style.display = "none";

        const dashboard = document.getElementById("dashboard-view");
        if (dashboard) dashboard.style.display = "none";

        const view = document.getElementById("render-status-view");
        if (view) {
            view.style.display = "block";
            window.KuyaB.loadRenderDeployments();
        }
    };

    window.closeDeploymentsView = function () {
        triggerHaptic("light");
        const view = document.getElementById("render-status-view");
        if (view) view.style.display = "none";

        const adminView = document.getElementById("admin-panel-view");
        if (adminView) adminView.style.display = "block";
    };

    window.closeDeployDetailModal = function () {
        const modal = document.getElementById("deploymentDetailModal");
        if (modal) modal.style.display = "none";
    };

    window.KuyaB.loadRenderDeployments = async function (force = false) {
        const loading = document.getElementById("deploymentsLoadingIndicator");
        const listContainer = document.getElementById("deploymentsListContainer");
        if (loading) loading.style.display = "block";
        if (listContainer && force) listContainer.innerHTML = "";

        try {
            const res = await fetch("/api/deployment-history?_t=" + Date.now());
            const data = await res.json();
            if (loading) loading.style.display = "none";

            const deploys = data.deployments || [];
            cachedDeploys = deploys;

            if (!deploys.length) {
                if (listContainer) listContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 0.85rem; padding: 20px;">No recent deployments found.</div>';
                return;
            }

            if (listContainer) {
                listContainer.innerHTML = deploys.map((d, index) => `
                    <div class="neu-card" onclick="window.KuyaB.viewDeployDetails(${index})" style="background: #e6ecf5; padding: 12px 14px; border-radius: 12px; cursor: pointer; box-shadow: 3px 3px 7px #c5d0e0, -3px -3px 7px #ffffff;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-size: 0.85rem; font-weight: 700; color: #1e293b;">${d.name || 'Deployment'}</span>
                            ${getStatusBadge(d.status)}
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.74rem; color: #64748b;">
                            <span>Commit: <code>${d.commit || 'head'}</code></span>
                            <span>${d.date || ''}</span>
                        </div>
                    </div>
                `).join("");
            }
        } catch (err) {
            if (loading) loading.innerText = "Failed to load deployments.";
        }
    };

    window.KuyaB.viewDeployDetails = async function (index) {
        triggerHaptic("medium");
        const deploy = cachedDeploys[index];
        if (!deploy) return;

        const modal = document.getElementById("deploymentDetailModal");
        const title = document.getElementById("detailDeployTitle");
        const badge = document.getElementById("detailDeployStatusBadge");
        const filesBox = document.getElementById("detailDeployFiles");
        const logsBox = document.getElementById("detailDeployLogs");
        const logStatus = document.getElementById("detailLogsStatus");

        if (modal) modal.style.display = "block";
        if (title) title.innerText = deploy.name || "Deployment Details";
        if (badge) badge.innerHTML = getStatusBadge(deploy.status);

        // Render files list
        if (filesBox) {
            if (deploy.files && deploy.files.length) {
                filesBox.innerHTML = deploy.files.map(f => `• ${f}`).join("<br/>");
            } else if (deploy.commit) {
                filesBox.innerHTML = "Fetching changed files...";
            } else {
                filesBox.innerHTML = "No files changed recorded.";
            }
        }

        // Logs fetching
        if (logsBox) logsBox.innerText = "Fetching Render deployment logs...";
        if (logStatus) logStatus.innerText = "Loading...";

        try {
            const deployId = deploy.id || "";
            const commitSha = deploy.commit || "";
            const res = await fetch(`/api/deployment-logs?id=${encodeURIComponent(deployId)}&commit=${encodeURIComponent(commitSha)}`);
            const data = await res.json();

            if (data.files && filesBox) {
                filesBox.innerHTML = data.files.length ? data.files.map(f => `• ${f}`).join("<br/>") : "No file diff available";
            }

            if (logsBox) {
                logsBox.innerText = data.logs || "No build logs returned from Render API for this deploy.";
            }
            if (logStatus) logStatus.innerText = "";
        } catch (e) {
            if (logsBox) logsBox.innerText = "Unable to retrieve logs.";
            if (logStatus) logStatus.innerText = "";
        }
    };
})();
