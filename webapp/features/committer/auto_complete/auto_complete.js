/* =========================================================
   KUYA B — FILE COMMITTER & AUTO-COMPLETE CONTROLLER
   webapp/committer/auto_complete/auto_complete.js
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

    function normalizeFileList(rawList) {
        if (!Array.isArray(rawList)) return [];
        return rawList.map(item => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object") {
                return item.file || item.path || item.filename || "";
            }
            return "";
        }).filter(p => p.length > 0);
    }

    function getCommitterViewEl() {
        return document.getElementById("adminUpdaterPage") || document.getElementById("committer-view");
    }

    window.openCommitterView = function () {
        triggerHaptic("light");

        const view = getCommitterViewEl();
        const appRoot = document.getElementById("app") || document.body;

        for (let child of appRoot.children) {
            if (child !== view && child.tagName !== "SCRIPT") {
                child.dataset.prevDisplay = child.style.display;
                child.style.display = "none";
            }
        }

        if (view) {
            view.style.display = "block";
            window.KuyaB.loadRepoTree();
        }
    };

    window.closeCommitterView = function () {
        triggerHaptic("light");

        const view = getCommitterViewEl();
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
            if (child !== view && child.tagName !== "SCRIPT") {
                child.style.display = child.dataset.prevDisplay || "";
            }
        }
    };

    window.KuyaB.loadRepoTree = async function (forceRefresh = false) {
        const statusEl = document.getElementById("repoScanStatus");
        if (statusEl) statusEl.innerText = "Loading files...";

        if (!forceRefresh && cachedRepoFiles.length > 0) {
            if (statusEl) statusEl.innerText = `${cachedRepoFiles.length} files`;
            return;
        }

        let rawFiles = [];

        // 1. Try /api/repo-tree
        let { res, data } = await safeFetchJson("/api/repo-tree?_t=" + Date.now());
        if (res.ok && data.files && data.files.length > 0) {
            rawFiles = data.files;
        } else {
            // 2. Try /app/api/repo-tree alias
            const retry = await safeFetchJson("/app/api/repo-tree?_t=" + Date.now());
            if (retry.res.ok && retry.data.files && retry.data.files.length > 0) {
                rawFiles = retry.data.files;
            }
        }

        // 3. Fallback to /api/repo-tree-details (the Tree feature endpoint)
        if (rawFiles.length === 0) {
            let treeRes = await safeFetchJson("/api/repo-tree-details?_t=" + Date.now());
            if (!treeRes.res.ok) {
                treeRes = await safeFetchJson("/app/api/repo-tree-details?_t=" + Date.now());
            }
            if (treeRes.res.ok && treeRes.data?.data?.files) {
                rawFiles = treeRes.data.data.files;
            }
        }

        const normalized = normalizeFileList(rawFiles);
        if (normalized.length > 0) {
            cachedRepoFiles = Array.from(new Set(normalized)).sort();
            if (statusEl) statusEl.innerText = `${cachedRepoFiles.length} files`;

            const searchInput = document.getElementById("fileSearchInput");
            if (searchInput && document.activeElement === searchInput) {
                window.KuyaB.filterRepoFiles(searchInput.value);
            }
        } else {
            if (statusEl) statusEl.innerText = "0 files found";
        }
    };

    window.KuyaB.filterRepoFiles = function (query) {
        const listEl = document.getElementById("fileSuggestionsList");
        if (!listEl) return;

        if (cachedRepoFiles.length === 0) {
            listEl.innerHTML = '<div style="padding: 10px 14px; font-size: 0.8rem; color: #ef4444;">No files loaded. Tap 🔄 to reload.</div>';
            listEl.style.display = "block";
            return;
        }

        const val = (query || "").trim().toLowerCase();
        let matches = [];

        if (!val) {
            matches = cachedRepoFiles.slice(0, 25);
        } else {
            matches = cachedRepoFiles.filter(item => {
                return String(item).toLowerCase().includes(val);
            }).slice(0, 30);
        }

        if (matches.length === 0) {
            listEl.innerHTML = '<div style="padding: 10px 14px; font-size: 0.8rem; color: #94a3b8;">No matching files found</div>';
            listEl.style.display = "block";
            return;
        }

        listEl.innerHTML = matches.map(filePath => {
            const escapedPath = filePath.replace(/"/g, '&quot;').replace(/'/g, "\\'");
            return `
                <div 
                    style="
                        padding: 9px 14px; 
                        font-size: 0.82rem; 
                        color: #1e293b; 
                        cursor: pointer; 
                        border-bottom: 1px solid #e2e8f0; 
                        text-align: left; 
                        word-break: break-all;
                    "
                    onmouseover="this.style.background='#e2e8f0'"
                    onmouseout="this.style.background='transparent'"
                    onmousedown="event.preventDefault(); window.KuyaB.selectFileSuggestion('${escapedPath}')"
                >
                    📄 ${filePath}
                </div>
            `;
        }).join("");

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
            if (statusEl) statusEl.innerText = data.error || "Load failed";
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
            alert("Clipboard access not allowed. Please paste directly into the box.");
        }
    };

    window.KuyaB.submitFileCommit = async function () {
        const filePath = document.getElementById("commitFilePath")?.value.trim();
        const commitMsg = document.getElementById("commitMsgInput")?.value.trim();
        const content = document.getElementById("commitContentInput")?.value;
        const btn = document.getElementById("btnSubmitCommit");

        if (!filePath) {
            alert("Please provide the Target File Path.");
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
            btn.innerText = "Deploying to GitHub...";
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
            alert("Commit pushed successfully! GitHub and Render deployment initiated.");
            window.closeCommitterView();
        } else {
            alert("Commit failed: " + lastError);
        }
    };

    function bindCommitterEvents() {
        const backBtn = document.getElementById("adminUpdaterBackButton");
        if (backBtn) backBtn.onclick = window.closeCommitterView;

        const cancelBtn = document.getElementById("cancelAdminUpdaterButton");
        if (cancelBtn) cancelBtn.onclick = window.closeCommitterView;

        document.addEventListener("click", function (e) {
            const listEl = document.getElementById("fileSuggestionsList");
            const searchInput = document.getElementById("fileSearchInput");
            if (listEl && e.target !== listEl && e.target !== searchInput) {
                listEl.style.display = "none";
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindCommitterEvents);
    } else {
        bindCommitterEvents();
    }
})();
