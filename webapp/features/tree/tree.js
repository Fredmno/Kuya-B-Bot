/* =========================================================
   KUYA B — REPOSITORY TREE CLIENT SCRIPT
   webapp/features/tree/tree.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    let cachedFiles = [];

    function triggerHaptic(type) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type || "light");
        }
    }

    window.openTreeView = function () {
        triggerHaptic("light");

        const appRoot = document.getElementById("app") || document.body;
        for (let child of appRoot.children) {
            if (child.id !== "tree-view" && child.tagName !== "SCRIPT") {
                child.dataset.prevDisplay = child.style.display;
                child.style.display = "none";
            }
        }

        const view = document.getElementById("tree-view");
        if (view) {
            view.style.display = "block";
            window.KuyaB.loadTreeData();
        }
    };

    window.closeTreeView = function () {
        triggerHaptic("light");

        const view = document.getElementById("tree-view");
        if (view) view.style.display = "none";

        const adminView = document.getElementById("admin-panel-view");
        if (adminView) {
            adminView.style.display = "block";
            return;
        }

        const appRoot = document.getElementById("app") || document.body;
        for (let child of appRoot.children) {
            if (child.id !== "tree-view" && child.tagName !== "SCRIPT") {
                child.style.display = child.dataset.prevDisplay || "";
            }
        }
    };

    window.KuyaB.loadTreeData = async function () {
        const listEl = document.getElementById("treeFileList");
        if (listEl) {
            listEl.innerHTML = '<div style="text-align: center; color: var(--text-sub); font-size: 12px; padding: 14px;">Loading updated files...</div>';
        }

        try {
            const res = await fetch("/api/repo-tree-details");
            const resJson = await res.json();

            if (res.ok && resJson.ok && resJson.data) {
                cachedFiles = resJson.data.files || [];
                const badge = document.getElementById("treeFileCountBadge");
                const syncText = document.getElementById("treeLastSyncText");

                if (badge) badge.innerText = `${cachedFiles.length} files`;
                if (syncText && resJson.data.last_updated) {
                    syncText.innerText = `Updated: ${resJson.data.last_updated} (saved to folder)`;
                }

                renderTreeList(cachedFiles);
            } else {
                if (listEl) listEl.innerHTML = `<div style="text-align: center; color: #ef4444; font-size: 12px; padding: 14px;">${resJson.error || "Failed to load"}</div>`;
            }
        } catch (err) {
            if (listEl) listEl.innerHTML = `<div style="text-align: center; color: #ef4444; font-size: 12px; padding: 14px;">Connection error: ${err.message}</div>`;
        }
    };

    window.KuyaB.regenerateTree = async function () {
        triggerHaptic("medium");
        const listEl = document.getElementById("treeFileList");
        if (listEl) {
            listEl.innerHTML = '<div style="text-align: center; color: #2563eb; font-size: 12px; padding: 14px;">Syncing latest GitHub changes and saving repo_tree.json...</div>';
        }

        try {
            const res = await fetch("/api/regenerate-tree", { method: "POST" });
            const data = await res.json();
            if (res.ok && data.ok) {
                triggerHaptic("heavy");
                window.KuyaB.loadTreeData();
            } else {
                alert("Sync failed: " + (data.error || "Unknown"));
                window.KuyaB.loadTreeData();
            }
        } catch (e) {
            alert("Error syncing tree: " + e.message);
            window.KuyaB.loadTreeData();
        }
    };

    function renderTreeList(files) {
        const listEl = document.getElementById("treeFileList");
        if (!listEl) return;

        if (!files || files.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; color: var(--text-sub); font-size: 12px; padding: 16px;">No updated files found. Tap 🔄 Sync to inspect commits.</div>';
            return;
        }

        listEl.innerHTML = "";
        files.forEach((item) => {
            const div = document.createElement("div");
            div.className = "tree-file-item";
            div.onclick = () => openTreeDetailModal(item);
            div.innerHTML = `
                <div class="tree-file-info">
                    <span class="tree-file-path">📄 ${item.file}</span>
                    <span class="tree-file-meta">📅 ${item.date} • Commit ${item.commit} by ${item.author}</span>
                </div>
                <span class="tree-badge" style="text-transform: capitalize;">${item.status}</span>
            `;
            listEl.appendChild(div);
        });
    }

    window.openTreeDetailModal = function (item) {
        triggerHaptic("light");
        document.getElementById("modalTreeFileName").innerText = item.file;
        document.getElementById("modalTreeStatus").innerText = (item.status || "Modified").toUpperCase();
        document.getElementById("modalTreeCommit").innerText = item.commit;
        document.getElementById("modalTreeAuthor").innerText = item.author;
        document.getElementById("modalTreeDate").innerText = item.date;
        document.getElementById("modalTreeStats").innerText = `+${item.additions} / -${item.deletions}`;
        document.getElementById("modalTreeMessage").innerText = item.message;
        document.getElementById("modalTreePatch").innerText = item.patch || "No diff preview available";

        const modal = document.getElementById("treeDetailModal");
        if (modal) modal.style.display = "flex";
    };

    window.closeTreeDetailModal = function () {
        const modal = document.getElementById("treeDetailModal");
        if (modal) modal.style.display = "none";
    };

    window.openTreeView = window.openTreeView;
    window.closeTreeView = window.closeTreeView;
})();
