/* =========================================================
   KUYA B — FILE COMMITTER CLIENT SCRIPT
   webapp/features/committer/committer.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    let allRepoFiles = [];
    let loadTimeout = null;

    function haptic(type) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type || "light");
        }
    }

    window.openCommitterView = function () {
        haptic("light");

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
            window.fetchRepoTree();
        }
    };

    window.closeCommitterView = function () {
        haptic("light");

        const view = document.getElementById("committer-view");
        if (view) view.style.display = "none";

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

    window.clearCommitterForm = function () {
        const pathEl = document.getElementById("committerFilePath");
        const msgEl = document.getElementById("committerCommitMsg");
        const contentEl = document.getElementById("committerContent");
        const statusEl = document.getElementById("committerFileStatus");

        if (pathEl) pathEl.value = "";
        if (msgEl) msgEl.value = "";
        if (contentEl) contentEl.value = "";
        if (statusEl) statusEl.innerText = "Ready";
    };

    window.fetchRepoTree = async function () {
        const dataList = document.getElementById("repoFileList");
        const statusEl = document.getElementById("committerFileStatus");
        if (statusEl) statusEl.innerText = "Loading file index...";

        try {
            const res = await fetch("/api/repo-tree");
            if (!res.ok) throw new Error("Status " + res.status);
            const data = await res.json();
            allRepoFiles = data.files || [];

            if (dataList) {
                dataList.innerHTML = "";
                allRepoFiles.forEach(f => {
                    const opt = document.createElement("option");
                    opt.value = f;
                    dataList.appendChild(opt);
                });
            }
            if (statusEl) statusEl.innerText = `${allRepoFiles.length} files indexed`;
        } catch (err) {
            if (statusEl) statusEl.innerText = "Ready (Manual mode)";
        }
    };

    window.handleFilePathInput = function (val) {
        clearTimeout(loadTimeout);
        const match = allRepoFiles.find(f => f.toLowerCase() === val.trim().toLowerCase());
        if (match) {
            loadTimeout = setTimeout(() => {
                loadFileContent(match);
            }, 300);
        }
    };

    async function loadFileContent(filePath) {
        const contentArea = document.getElementById("committerContent");
        const statusEl = document.getElementById("committerFileStatus");
        if (statusEl) statusEl.innerText = "Fetching content...";

        try {
            const res = await fetch(`/api/file-content?path=${encodeURIComponent(filePath)}`);
            if (res.ok) {
                const data = await res.json();
                if (contentArea) contentArea.value = data.content || "";
                if (statusEl) statusEl.innerText = "File loaded";
            } else {
                if (statusEl) statusEl.innerText = "Ready (New file)";
            }
        } catch (e) {
            if (statusEl) statusEl.innerText = "Ready";
        }
    }

    window.submitCommit = async function () {
        const path = document.getElementById("committerFilePath")?.value.trim();
        const message = document.getElementById("committerCommitMsg")?.value.trim();
        const content = document.getElementById("committerContent")?.value;
        const btn = document.getElementById("btnSubmitCommit");

        if (!path) {
            alert("Please specify a target file path.");
            return;
        }

        if (!message) {
            alert("Please provide a commit message.");
            return;
        }

        haptic("medium");
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Pushing...";
        }

        try {
            const res = await fetch("/api/commit-file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    file_path: path,
                    commit_message: message,
                    content: content
                })
            });

            const result = await res.json();
            if (res.ok && result.ok) {
                haptic("heavy");
                alert("Commit pushed successfully! GitHub and Render will trigger automatically.");
                window.closeCommitterView();
            } else {
                alert("Commit failed: " + (result.error || "Unknown error"));
            }
        } catch (err) {
            alert("Error committing file: " + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = "🚀 Push Commit";
            }
        }
    };

    window.KuyaB.openCommitterView = window.openCommitterView;
    window.KuyaB.clearFileCommitterForm = window.clearCommitterForm;
    window.KuyaB.loadRepoTree = window.fetchRepoTree;
})();
