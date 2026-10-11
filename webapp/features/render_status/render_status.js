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
                    <span style="font-size: 11px; opacity: 0.8;">Ensure GITHUB_TOKEN has repository access.</span>
                </div>`;
            return;
        }

        container.innerHTML = "";
        cachedDeployments.forEach(item => {
            const statusLower = (item.status || "").toLowerCase();
            const badgeClass = (statusLower === "live" || statusLower === "succeeded")
                ? "badge-live" 
                : (statusLower === "building" ? "badge-success" : (statusLower === "success" ? "badge-live" : "badge-failed"));

            const fileCount = item.files ? item.files.length : 0;
            const div = document.createElement("div");
            div.className = "deploy-item";
            div.onclick = () => openDeployModal(item);
            div.innerHTML = `
                <div class="deploy-info">
                    <div class="deploy-name">${item.name || "Deployment"}</div>
                    <div class="deploy-date">📅 ${item.date || "Recent"} • 📄 ${fileCount} file${fileCount === 1 ? "" : "s"} modified</div>
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

    window.openDeployModal = function (deploy) {
        triggerHaptic("light");

        const nameEl = document.getElementById("modalDeployName");
        const statusEl = document.getElementById("modalDeployStatus");
        const dateEl = document.getElementById("modalDeployDate");
        const commitEl = document.getElementById("modalDeployCommit");
        const authorEl = document.getElementById("modalDeployAuthor");
        const messageEl = document.getElementById("modalDeployMessage");
        const fileCountEl = document.getElementById("modalDeployFileCount");
        const filesListEl = document.getElementById("modalDeployFilesList");
        const viewerBox = document.getElementById("modalFileViewerContainer");

        if (nameEl) nameEl.innerText = deploy.name || "Deploy Details";
        if (statusEl) statusEl.innerText = deploy.status || "Unknown";
        if (dateEl) dateEl.innerText = deploy.date || "N/A";
        if (commitEl) commitEl.innerText = deploy.commit || "N/A";
        if (authorEl) authorEl.innerText = deploy.author || "GitHub";
        if (messageEl) messageEl.innerText = deploy.message || "No commit logs";
        if (viewerBox) viewerBox.style.display = "none";

        const files = deploy.files || [];
        if (fileCountEl) fileCountEl.innerText = `${files.length} file${files.length === 1 ? "" : "s"}`;

        if (filesListEl) {
            if (files.length === 0) {
                filesListEl.innerHTML = '<div style="font-size: 11px; color: #94a3b8; padding: 6px;">No specific file diffs recorded.</div>';
            } else {
                filesListEl.innerHTML = files.map(f => `
                    <div 
                        onclick="window.KuyaB.viewDeployFileDetails('${f.filename.replace(/'/g, "\\'")}', '${escape(f.patch || "")}')"
                        style="background: #f1f5f9; padding: 8px 10px; border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0;"
                    >
                        <span style="font-size: 11px; font-weight: 600; color: #1e293b; word-break: break-all;">📄 ${f.filename}</span>
                        <span style="font-size: 10px; color: #16a34a; font-weight: 700; white-space: nowrap; margin-left: 8px;">+${f.additions} / -${f.deletions}</span>
                    </div>
                `).join("");
            }
        }

        const modal = document.getElementById("deploymentDetailModal");
        if (modal) modal.style.display = "flex";
    };

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.viewDeployFileDetails = async function (filename, escapedPatch) {
        triggerHaptic("light");
        const viewerBox = document.getElementById("modalFileViewerContainer");
        const viewerTitle = document.getElementById("modalViewerFileTitle");
        const viewerContent = document.getElementById("modalViewerFileContent");

        if (!viewerBox || !viewerContent) return;

        viewerTitle.innerText = `📄 ${filename} (Loading full content / diff...)`;
        viewerBox.style.display = "block";

        const unescapedPatch = unescape(escapedPatch);

        // Attempt to fetch live current file content from /api/file-content
        try {
            const res = await fetch(`/api/file-content?path=${encodeURIComponent(filename)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.content !== undefined) {
                    viewerTitle.innerText = `📄 ${filename} (Full Updated Content)`;
                    viewerContent.innerText = data.content;
                    return;
                }
            }
        } catch (e) {
            console.warn("Could not fetch full file content, displaying diff patch.");
        }

        // Fallback to commit diff patch
        viewerTitle.innerText = `📄 ${filename} (Commit Diff Patch)`;
        viewerContent.innerText = unescapedPatch || "No diff preview available for this file.";
    };

    window.closeDeployModal = function () {
        const modal = document.getElementById("deploymentDetailModal");
        if (modal) modal.style.display = "none";
    };

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
