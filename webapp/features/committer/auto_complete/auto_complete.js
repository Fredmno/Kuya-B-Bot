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

        let { res, data } = await safeFetchJson("/api/repo-tree?_t=" + Date.now());
        if (!res.ok || !data.files || data.files.length === 0) {
            const retry = await safeFetchJson("/app/api/repo-tree?_t=" + Date.now());
            if (retry.res.ok && retry.data.files && retry.data.files.length > 0) {
                res = retry.res;
                data = retry.data;
            }
        }

        if (res.ok && Array.isArray(data.files) && data.files.length > 0) {
            cachedRepoFiles = Array.from(new Set(data.files)).sort();
            if (statusEl) statusEl.innerText = `${cachedRepoFiles.length} files`;

            const searchInput = document.getElementById("fileSearchInput");
            if (searchInput && document.activeElement === searchInput) {
                window.KuyaB.filterRepoFiles(searchInput.value);
            }
        } else {
            if (statusEl) statusEl.innerText = "Ready (Manual Input)";
        }
    };

    window.KuyaB.filterRepoFiles = function (query) {
        const listEl = document.getElementById("fileSuggestionsList");
        if (!listEl) return;

        const val = (query || "").trim().toLowerCase();
        let matches = [];

        if (!val) {
            matches = cachedRepoFiles.slice(0, 25);
        } else {
            matches = cachedRepoFiles.filter(item => String(item).toLowerCase().includes(val)).slice(0, 30);
        }

        if (matches.length === 0) {
            listEl.innerHTML = '<div style="padding: 10px 14px; font-size: 0.8rem; color: #94a3b8;">Create new file (path above)</div>';
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
            if (statusEl) statusEl.innerText = "Ready for new content";
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
            if (contentInput && text) {
                contentInput.value = text;
                // Run unpacker in case full JSON was pasted
                window.KuyaB.tryUnpackJsonPayload();
            }
        } catch (err) {
            alert("Clipboard permission denied. Please paste manually into the editor.");
        }
    };

    // Auto-detects if full JSON was pasted and automatically fills in the inputs
    window.KuyaB.tryUnpackJsonPayload = function () {
        const contentInput = document.getElementById("commitContentInput");
        const pathInput = document.getElementById("commitFilePath");
        const msgInput = document.getElementById("commitMsgInput");
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
                    if (parsed
