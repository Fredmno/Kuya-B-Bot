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

    async function safeFetchJson(url, options = {}) {
        try {
            const res = await fetch(url, options);
            const text = await res.text();
            let data = {};
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = { error: text.slice(0, 150) || `HTTP ${res.status}` };
            }
            return { res, data, status: res.status };
        } catch (err) {
            return { res: { ok: false }, data: { error: err.message }, status: 0 };
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
        if (statusEl) statusEl.innerText = "Scanning files...";

        // Try /api/repo-tree first
        let { res, data } = await safeFetchJson("/api/repo-tree?_t=" + Date.now());
        if (!res.ok || !data.files || data.files.length === 0) {
            // Fallback to /app/api/repo-tree
            const retry = await safeFetchJson("/app/api/repo-tree?_t=" + Date.now());
            if (retry.res.ok && retry.data.files && retry.data.files.length > 0) {
                res = retry.res;
                data = retry.data;
            }
        }

        if (res.ok && Array.isArray(data.files) && data.files.length > 0) {
            cachedRepoFiles = data.files;
            if (statusEl) statusEl.innerText = `${cachedRepoFiles.length} files (${data.source || "ok"})`;
            
            const searchInput = document.getElementById("fileSearchInput");
            if (searchInput && document.activeElement === searchInput) {
                window.KuyaB.filterRepoFiles(searchInput.value);
            }
        } else {
            if (statusEl) statusEl.innerText = data.error || "0 files found";
        }
    };

    window.KuyaB.filterRepoFiles = function (query) {
        const listEl = document.getElementById("fileSuggestionsList");
        if (!listEl) return;

        if (cachedRepoFiles.length === 0) {
            listEl.innerHTML = '<div class="neu-dropdown-item" style="color: #ef4444; padding: 10px;">No files cached. Tap 🔄 Refresh above.</div>';
            listEl.style.display = "block";
            return;
        }

        const val = (query || "").trim().toLowerCase();
        let matches = [];
        if (!val) {
            // Present first 30 files on click/focus
            matches = cachedRepoFiles.slice(0, 30);
        } else {
            matches = cachedRepoFiles.filter(p => p.toLowerCase().includes(val)).slice(0, 30);
        }

        if (matches.length === 0) {
            listEl.innerHTML = '<div class="neu-dropdown-item" style="color: var(--neu-text-muted); padding: 10px;">No matching files found</div>';
            listEl.style.display = "block";
            return;
        }

        listEl.innerHTML = matches.map(filePath => `
            <div 
                class="neu-dropdown-item"
                style="padding: 10px 14px; font-size: 11.5px; cursor: pointer; text-align: left;"
                onclick="window.KuyaB.selectFileSuggestion('${filePath.replace(/'/g, "\\'")}')"
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

        let { res, data } = await safeFetchJson(`/api/file-content?path=${encodeURIComponent(filePath)}`);
        if (!res.ok) {
            const retry = await safeFetchJson(`/app/api/file-content?path=${encodeURIComponent(filePath)}`);
            if (retry.res.ok) {
                res = retry.res;
                data = retry.data;
            }
        }

        if (res.ok && data.content !== undefined) {
            if (contentInput) contentInput.value = data.content;
            if (statusEl) statusEl.innerText = "✓ Loaded";
        } else {
            if (statusEl) statusEl.innerText = data.error || "Failed to load content";
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
        const btn = document.getElementById("btnSubmitCommit");

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

        const endpoints = [
            "/api/commit-file",
            "/api/commit",
            "/app/api/commit-file",
            "/app/api/commit"
        ];

        let success = false;
        let lastError = "Unable to reach commit endpoint";

        for (const ep of endpoints) {
            const { res, data } = await safeFetchJson(ep, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload
            });

            if (res.ok && data.ok) {
                success = true;
                break;
            } else if (res.status !== 404 && res.status !== 0) {
                lastError = data.error || data.message || `HTTP ${res.status}`;
                break;
            }
        }

        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }

        if (success) {
            triggerHaptic("heavy");
            alert("Commit pushed successfully! GitHub and Render deployment started.");
            window.closeCommitterView();
        } else {
            alert("Commit failed: " + lastError);
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
