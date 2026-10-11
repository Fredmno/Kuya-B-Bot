/* =========================================================
   KUYA B — FILE COMMITTER CLIENT SCRIPT
   webapp/features/committer/committer.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};

    function haptic(type) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type || "light");
        }
    }

    // Open Committer View
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
            fetchRepoTree();
        }
    };

    // Close Committer View (return to previous screen)
    window.closeCommitterView = function () {
        haptic("light");

        const view = document.getElementById("committer-view");
        if (view) view.style.display = "none";

        // Return to admin panel if active, else restore prior screen
        const adminView = document.getElementById("admin-panel-view");
        const deployView = document.getElementById("render-status-view");

        if (deployView && deployView.dataset.openedFromHere === "true") {
            deployView.style.display = "block";
            delete deployView.dataset.openedFromHere;
            return;
        }

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
        const selectEl = document.getElementById("committerFileSelect");
        const statusEl = document.getElementById("committerFileStatus");

        if (pathEl) pathEl.value = "";
        if (msgEl) msgEl.value = "";
        if (contentEl) contentEl.value = "";
        if (selectEl) selectEl.value = "";
        if (statusEl) statusEl.innerText = "Ready";
    };

    // Populate dropdown with repository files
    window.fetchRepoTree = async function () {
        const selectEl = document.getElementById("committerFileSelect");
        const statusEl = document.getElementById("committerFileStatus");
        if (!selectEl) return;

        if (statusEl) statusEl.innerText = "Loading repo tree...";

        try {
            const res = await fetch("/api/repo-tree");
            if (!res.ok) throw new Error("Status " + res.status);
            const data = await res.json();
            const files = data.files || [];

            selectEl.innerHTML = '<option value="">-- Select an existing file or enter path below --</option>';
            files.forEach(f => {
                const opt = document.createElement("option");
                opt.value = f;
                opt.textContent = f;
                selectEl.appendChild(opt);
            });

            if (statusEl) statusEl.innerText = `${files.length} files loaded`;
        } catch (err) {
            if (statusEl) statusEl.innerText = "Manual path input only";
        }
    };

    // Selecting a file from the list
    window.onCommitterFileSelected = async function (filePath) {
        if (!filePath) return;
        const pathInput = document.getElementById("committerFilePath");
        const contentArea = document.getElementById("committerContent");
        const statusEl = document.getElementById("committerFileStatus");

        if (pathInput) pathInput.value = filePath;
        if (statusEl) statusEl.innerText = "Fetching content...";

        try {
            const res = await fetch(`/api/file-content?path=${encodeURIComponent(filePath)}`);
            if (res.ok) {
                const data = await res.json();
                if (contentArea) contentArea.value = data.content || "";
                if (statusEl) statusEl.innerText = "File loaded";
            } else {
                if (statusEl) statusEl.innerText = "New file or fetch error";
            }
        } catch (e) {
            if (statusEl) statusEl.innerText = "Ready";
        }
    };

    // Submit and push commit
    window.submitCommit = async function () {
        const path = document.getElementById("committerFilePath")?.value.trim();
        const message = document.getElementById("committerCommitMsg")?.value.trim();
        const content = document.getElementById("committerContent")?.value;
        const btn = document.getElementById("btnSubmitCommit");

        if (!path) {
            alert("Please specify a file path.");
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
                alert("Commit pushed successfully! GitHub and Render webhooks will trigger automatically.");
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

    // Expose aliases for backwards compatibility with earlier buttons
    window.KuyaB.openCommitterView = window.openCommitterView;
    window.KuyaB.clearFileCommitterForm = window.clearCommitterForm;
    window.KuyaB.loadRepoTree = window.fetchRepoTree;
})();
