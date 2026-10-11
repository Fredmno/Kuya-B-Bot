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

    window.KuyaB.loadRepoTree = async function () {
        const statusEl = document.getElementById("repoScanStatus");
        if (statusEl) statusEl.innerText = "Loading repo tree...";

        try {
            const res = await fetch("/api/repo-tree");
            const rawText = await res.text();
            let data = {};
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                if (statusEl) statusEl.innerText = "Server returned non-JSON";
                return;
            }

            if (res.ok && data.files) {
                cachedRepoFiles = data.files;
                if (statusEl) statusEl.innerText = `${cachedRepoFiles.length} files found`;
            } else {
                if (statusEl) statusEl.innerText = data.error || "Failed to load files";
            }
        } catch (err) {
            if (statusEl) statusEl.innerText = "Connection error";
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

        const matches = cachedRepoFiles.filter(p => p.toLowerCase().includes(val)).slice(0, 30);
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

        if (statusEl) statusEl.innerText = "Loading content...";

        try {
            const res = await fetch(`/api/file-content?path=${encodeURIComponent(filePath)}`);
            const rawText = await res.text();
            let data = {};
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                if (statusEl) statusEl.innerText = "Error reading response";
                return;
            }

            if (res.ok && data.content !== undefined) {
                if (contentInput) contentInput.value = data.content;
                if (statusEl) statusEl.innerText = "Loaded";
            } else {
                if (statusEl) statusEl.innerText = data.error || "Failed to load";
            }
        } catch (e) {
            if (statusEl) statusEl.innerText = "Network error";
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
            alert("Clipboard permission denied. Please paste manually into the editor.");
        }
    };

    window.KuyaB.submitFileCommit = async function () {
        const filePath = document.getElementById("commitFilePath")?.value.trim();
        const commitMsg = document.getElementById("commitMsgInput")?.value.trim();
        const content = document.getElementById("commitContentInput")?.value;
        const btn = document.getElementById("btnSubmitCommit") || document.querySelector("button[onclick*='submitFileCommit']");

        if (!filePath) {
            alert("Please specify Target File Path.");
            return;
        }

        if (!commitMsg) {
            alert("Please provide a Commit Message.");
            return;
        }

        triggerHaptic("medium");
        const originalText = btn ? btn.innerText : "Commit & Deploy 🚀";
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Committing to GitHub...";
        }

        const payload = JSON.stringify({
            file_path: filePath,
            path: filePath,
            commit_message: commitMsg,
            message: commitMsg,
            content: content
        });

        try {
            // Send request to /api/commit-file with fallback to /api/commit
            let res = await fetch("/api/commit-file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload
            });

            if (res.status === 404) {
                res = await fetch("/api/commit", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: payload
                });
            }

            const rawText = await res.text();
            let result = {};
            try {
                result = JSON.parse(rawText);
            } catch (err) {
                throw new Error(`Server returned status ${res.status}: ${rawText.slice(0, 150)}`);
            }

            if (res.ok && result.ok) {
                triggerHaptic("heavy");
                alert("Commit pushed successfully! GitHub and Render deployment started.");
                window.closeCommitterView();
            } else {
                alert("Commit failed: " + (result.error || result.message || "Unknown error"));
            }
        } catch (err) {
            alert("Commit Error: " + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        }
    };

    document.addEventListener("click", function (e) {
        const listEl = document.getElementById("fileSuggestionsList");
        const searchInput = document.getElementById("fileSearchInput");
        if (listEl && e.target !== listEl && e.target !== searchInput) {
            listEl.style.display = "none";
        }
    });
})();
