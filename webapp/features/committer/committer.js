/* =========================================================
   KUYA B — FILE COMMITTER CLIENT SCRIPT
   webapp/features/committer/committer.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    let cachedRepoFiles = [];

    function triggerHaptic(type) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type || "light");
        }
    }

    window.openCommitterView = function () {
        triggerHaptic("light");

        const appRoot = document.getElementById("app") || document.body;
        for (let child of appRoot.children) {
            if (child.id !== "committer-view" && child.tagName !== "SCRIPT") {
                child.dataset.prevDisplay = child.style.display;
                child.style.display = "none";
            }
        }

        const view = document.getElementById("committer-view");
        if (view) {
            view.style.display = "block";
            window.KuyaB.loadRepoTree();
        }
    };

    window.closeCommitterView = function () {
        triggerHaptic("light");

        const view = document.getElementById("committer-view");
        if (view) view.style.display = "none";

        const suggestions = document.getElementById("fileSuggestionsList");
        if (suggestions) suggestions.style.display = "none";

        const deployView = document.getElementById("render-status-view");
        if (deployView && deployView.dataset.openedFromHere === "true") {
            deployView.style.display = "block";
            delete deployView.dataset.openedFromHere;
            return;
        }

        const adminView = document.getElementById("admin-panel-view");
        if (adminView) {
            adminView.style.display = "block";
            return;
        }

        const appRoot = document.getElementById("app") || document.body;
        for (let child of appRoot.children) {
            if (child.id !== "committer-view" && child.tagName !== "SCRIPT") {
                child.style.display = child.dataset.prevDisplay || "";
            }
        }
    };

    window.KuyaB.loadRepoTree = async function (forceRefresh = false) {
        const statusEl = document.getElementById("repoScanStatus");
        if (statusEl) statusEl.innerText = "Scanning repo...";

        try {
            const res = await fetch("/api/repo-tree");
            if (!res.ok) throw new Error("Status " + res.status);
            const data = await res.json();
            cachedRepoFiles = data.files || [];
            if (statusEl) statusEl.innerText = `${cachedRepoFiles.length} files found`;
        } catch (err) {
            if (statusEl) statusEl.innerText = "Manual mode";
        }
    };

    window.KuyaB.filterRepoFiles = function (query) {
        const listEl = document.getElementById("fileSuggestionsList");
        if (!listEl) return;

        const val = (query || "").trim().toLowerCase();
        if (!val || cachedRepoFiles.length === 0) {
            listEl.innerHTML = "";
            listEl.style.display = "none";
            return;
        }

        const matches = cachedRepoFiles.filter(p => p.toLowerCase().includes(val)).slice(0, 25);
        if (matches.length === 0) {
            listEl.innerHTML = '<div style="padding: 10px 14px; font-size: 0.8rem; color: #94a3b8;">No matching files</div>';
            listEl.style.display = "block";
            return;
        }

        listEl.innerHTML = matches.map(filePath => `
            <div 
                onclick="window.KuyaB.selectFileSuggestion('${filePath.replace(/'/g, "\\'")}')" 
                style="padding: 9px 14px; font-size: 0.82rem; color: #1e293b; cursor: pointer; border-bottom: 1px solid #f1f5f9;"
                onmouseover="this.style.background='#f8fafc'" 
                onmouseout="this.style.background='transparent'"
            >
                📄 ${filePath}
            </div>
        `).join("");

        listEl.style.display = "block";
    };

    window.KuyaB.selectFileSuggestion = async function (filePath) {
        triggerHaptic("light");

        const searchInput = document.getElementById("fileSearchInput");
        const pathInput = document.getElementById("commitFilePath");
        const listEl = document.getElementById("fileSuggestionsList");
        const statusEl = document.getElementById("fileLoadStatus");
        const contentInput = document.getElementById("commitContentInput");

        if (searchInput) searchInput.value = filePath;
        if (pathInput) pathInput.value = filePath;
        if (listEl) listEl.style.display = "none";

        if (statusEl) statusEl.innerText = "Loading...";

        try {
            const res = await fetch(`/api/file-content?path=${encodeURIComponent(filePath)}`);
            if (res.ok) {
                const data = await res.json();
                if (contentInput) contentInput.value = data.content || "";
                if (statusEl) statusEl.innerText = "Loaded";
            } else {
                if (statusEl) statusEl.innerText = "Empty / New";
            }
        } catch (e) {
            if (statusEl) statusEl.innerText = "Error loading";
        }
    };

    window.KuyaB.clearCommitterContent = function () {
        triggerHaptic("light");
        const contentInput = document.getElementById("commitContentInput");
        if (contentInput) contentInput.value = "";
    };

    window.KuyaB.pasteCommitterContent = async function () {
        triggerHaptic("light");
        const contentInput = document.getElementById("commitContentInput");
        try {
            const text = await navigator.clipboard.readText();
            if (contentInput && text) contentInput.value = text;
        } catch (err) {
            alert("Clipboard access not permitted. Please paste directly into the box.");
        }
    };

    window.KuyaB.submitFileCommit = async function () {
        const filePath = document.getElementById("commitFilePath")?.value.trim();
        const commitMsg = document.getElementById("commitMsgInput")?.value.trim();
        const content = document.getElementById("commitContentInput")?.value;
        const btn = document.getElementById("btnSubmitCommit");

        if (!filePath) {
            alert("Please select or enter a Target File Path.");
            return;
        }

        if (!commitMsg) {
            alert("Please enter a Commit Message.");
            return;
        }

        triggerHaptic("medium");
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Pushing...";
        }

        try {
            const res = await fetch("/api/commit-file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    file_path: filePath,
                    commit_message: commitMsg,
                    content: content
                })
            });

            const result = await res.json();
            if (res.ok && result.ok) {
                triggerHaptic("heavy");
                alert("Commit pushed successfully! GitHub and Render webhooks will trigger automatically.");
                window.closeCommitterView();
            } else {
                alert("Commit failed: " + (result.error || "Unknown error"));
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = "Commit & Deploy 🚀";
            }
        }
    };

    // Close suggestion list on document click outside
    document.addEventListener("click", function (e) {
        const listEl = document.getElementById("fileSuggestionsList");
        const searchInput = document.getElementById("fileSearchInput");
        if (listEl && e.target !== listEl && e.target !== searchInput) {
            listEl.style.display = "none";
        }
    });

    window.openCommitterView = window.openCommitterView;
    window.closeCommitterView = window.closeCommitterView;
})();
