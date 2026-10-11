/* =========================================================
   KUYA B — GITHUB FORM CLIENT SCRIPT
   webapp/committer/github_form/github_form.js
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

    window.openGitHubFormView = function () {
        triggerHaptic("light");
        const view = document.getElementById("githubFormPage");
        const appRoot = document.getElementById("app") || document.body;

        for (let child of appRoot.children) {
            if (child !== view && child.tagName !== "SCRIPT") {
                child.dataset.prevDisplay = child.style.display;
                child.style.display = "none";
            }
        }

        if (view) {
            view.style.display = "block";
            window.KuyaB.loadGitHubRepoTree();
        }
    };

    window.closeGitHubFormView = function () {
        triggerHaptic("light");
        const view = document.getElementById("githubFormPage");
        if (view) view.style.display = "none";

        const suggestions = document.getElementById("githubFileSuggestionsList");
        if (suggestions) suggestions.style.display = "none";

        const dashboard = document.getElementById("dashboard-view");
        if (dashboard) {
            dashboard.style.display = "block";
            return;
        }

        const appRoot = document.getElementById("app") || document.body;
        for (let child of appRoot.children) {
            if (child !== view && child.tagName !== "SCRIPT") {
                child.style.display = child.dataset.prevDisplay || "";
            }
        }
    };

    window.KuyaB.loadGitHubRepoTree = async function (forceRefresh = false) {
        const statusEl = document.getElementById("githubRepoScanStatus");
        if (statusEl) statusEl.innerText = "Loading...";

        if (!forceRefresh && cachedRepoFiles.length > 0) {
            if (statusEl) statusEl.innerText = `${cachedRepoFiles.length} files`;
            return;
        }

        let rawFiles = [];
        let { res, data } = await safeFetchJson("/api/repo-tree?_t=" + Date.now());
        if (res.ok && data.files && data.files.length > 0) {
            rawFiles = data.files;
        } else {
            const retry = await safeFetchJson("/app/api/repo-tree?_t=" + Date.now());
            if (retry.res.ok && retry.data.files && retry.data.files.length > 0) {
                rawFiles = retry.data.files;
            }
        }

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
        } else {
            if (statusEl) statusEl.innerText = "Ready";
        }
    };

    window.KuyaB.filterGitHubRepoFiles = function (query) {
        const listEl = document.getElementById("githubFileSuggestionsList");
        if (!listEl) return;

        const val = (query || "").trim().toLowerCase();
        let matches = [];

        if (!val) {
            matches = cachedRepoFiles.slice(0, 25);
        } else {
            matches = cachedRepoFiles.filter(item => String(item).toLowerCase().includes(val)).slice(0, 30);
        }

        if (matches.length === 0) {
            listEl.innerHTML = '<div style="padding: 10px 14px; font-size: 0.8rem; color: #94a3b8;">New file target</div>';
            listEl.style.display = "block";
            return;
        }

        listEl.innerHTML = matches.map(filePath => {
            const escapedPath = filePath.replace(/"/g, '&quot;').replace(/'/g, "\\'");
            return `
                <div 
                    style="padding: 9px 14px; font-size: 0.82rem; color: #1e293b; cursor: pointer; border-bottom: 1px solid #e2e8f0; text-align: left; word-break: break-all;"
                    onmouseover="this.style.background='#e2e8f0'"
                    onmouseout="this.style.background='transparent'"
                    onmousedown="event.preventDefault(); window.KuyaB.selectGitHubFileSuggestion('${escapedPath}')"
                >
                    📄 ${filePath}
                </div>
            `;
        }).join("");

        listEl.style.display = "block";
    };

    window.KuyaB.selectGitHubFileSuggestion = async function (filePath) {
        triggerHaptic("light");

        const searchInput = document.getElementById("githubFileSearchInput");
        const pathInput = document.getElementById("githubCommitFilePath");
        const listEl = document.getElementById("githubFileSuggestionsList");
        const statusEl = document.getElementById("githubFileLoadStatus");
        const contentInput = document.getElementById("githubCommitContentInput");

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
            if (statusEl) statusEl.innerText = "Ready";
        }
    };

    window.KuyaB.clearGitHubFormContent = function () {
        triggerHaptic("light");
        const contentInput = document.getElementById("githubCommitContentInput");
        if (contentInput) contentInput.value = "";
    };

    window.KuyaB.tryUnpackGitHubJson = function () {
        const contentInput = document.getElementById("githubCommitContentInput");
        const pathInput = document.getElementById("githubCommitFilePath");
        const msgInput = document.getElementById("githubCommitMsgInput");
        const statusEl = document.getElementById("githubFileLoadStatus");
        if (!contentInput) return;

        let raw = contentInput.value.trim();
        if (raw.startsWith("```")) {
            const lines = raw.split("\n");
            if (lines[0].startsWith("```")) lines.shift();
            if (lines.length && lines[lines.length - 1].startsWith("```")) lines.pop();
            raw = lines.join("\n").trim();
        }

        if (raw.startsWith("{") && raw.endsWith("}")) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed.path || parsed.file_path || parsed.action === "commit_file") {
                    if (pathInput && (parsed.path || parsed.file_path)) {
                        pathInput.value = parsed.path || parsed.file_path;
                    }
                    if (msgInput && (parsed.message || parsed.commit_message)) {
                        msgInput.value = parsed.message || parsed.commit_message;
                    }
                    if (parsed.content !== undefined) {
                        contentInput.value = parsed.content;
                    }
                    triggerHaptic("medium");
                    if (statusEl) statusEl.innerText = "✓ JSON Unpacked";
                }
            } catch (e) {}
        }
    };

    window.KuyaB.pasteGitHubFormContent = async function () {
        triggerHaptic("light");
        const contentInput = document.getElementById("githubCommitContentInput");
        try {
            const text = await navigator.clipboard.readText();
            if (contentInput && text) {
                contentInput.value = text;
                window.KuyaB.tryUnpackGitHubJson();
            }
        } catch (err) {
            alert("Clipboard permission not granted. Paste manually into the box.");
        }
    };

    window.KuyaB.submitGitHubFormCommit = async function () {
        window.KuyaB.tryUnpackGitHubJson();

        let filePath = document.getElementById("githubCommitFilePath")?.value.trim();
        let commitMsg = document.getElementById("githubCommitMsgInput")?.value.trim();
        let content = document.getElementById("githubCommitContentInput")?.value;
        const btn = document.getElementById("btnSubmitGitHubForm");

        if (!filePath) {
            alert("Please enter the Target File Path (e.g. webapp/core/routes.py).");
            return;
        }

        if (!commitMsg) {
            commitMsg = `Update ${filePath}`;
        }

        triggerHaptic("medium");
        const originalText = btn ? btn.innerText : "Push to GitHub 🚀";
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Submitting to GitHub...";
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
        let resultMsg = "";

        for (const ep of endpoints) {
            const { res, data } = await safeFetchJson(ep, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload
            });

            if (res.ok && data.ok) {
                success = true;
                resultMsg = data.message || `Committed ${filePath} (${data.sha || 'ok'})`;
                break;
            } else if (res.status !== 404 && res.status !== 0) {
                resultMsg = data.error || `HTTP ${res.status}`;
                break;
            }
        }

        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }

        if (success) {
            triggerHaptic("heavy");
            alert(`🚀 ${resultMsg}\n\nRender deployment has started.`);
            window.closeGitHubFormView();
        } else {
            alert("Push failed: " + (resultMsg || "Could not reach commit endpoint"));
        }
    };

    function bindGitHubFormEvents() {
        const backBtn = document.getElementById("githubFormBackButton");
        if (backBtn) backBtn.onclick = window.closeGitHubFormView;

        const cancelBtn = document.getElementById("cancelGitHubFormButton");
        if (cancelBtn) cancelBtn.onclick = window.closeGitHubFormView;

        const contentInput = document.getElementById("githubCommitContentInput");
        if (contentInput) {
            contentInput.addEventListener("input", function () {
                if (contentInput.value.trim().startsWith("{")) {
                    window.KuyaB.tryUnpackGitHubJson();
                }
            });
        }

        document.addEventListener("click", function (e) {
            const listEl = document.getElementById("githubFileSuggestionsList");
            const searchInput = document.getElementById("githubFileSearchInput");
            if (listEl && e.target !== listEl && e.target !== searchInput) {
                listEl.style.display = "none";
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindGitHubFormEvents);
    } else {
        bindGitHubFormEvents();
    }
})();