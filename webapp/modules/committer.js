/* =========================================================
   KUYA B — FILE COMMITTER MODULE
   webapp/modules/committer.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    var cachedRepoFiles = [];

    function getRouter() {
        return window.KuyaB.router || {};
    }

    function getFeatures() {
        return window.KuyaB.features || {};
    }

    window.KuyaB.clearFileCommitterForm = function () {
        var searchInput = document.getElementById("fileSearchInput");
        var pathInput = document.getElementById("commitFilePath");
        var msgInput = document.getElementById("commitMsgInput");
        var contentInput = document.getElementById("commitContentInput");
        var statusLabel = document.getElementById("fileLoadStatus");
        var dropdown = document.getElementById("fileSuggestionsList");

        if (searchInput) searchInput.value = "";
        if (pathInput) pathInput.value = "";
        if (msgInput) msgInput.value = "";
        if (contentInput) contentInput.value = "";
        if (statusLabel) statusLabel.innerText = "";
        if (dropdown) dropdown.style.display = "none";
    };

    window.KuyaB.clearCommitterContent = function () {
        var contentInput = document.getElementById("commitContentInput");
        var statusLabel = document.getElementById("fileLoadStatus");
        if (contentInput) {
            contentInput.value = "";
            contentInput.focus();
        }
        if (statusLabel) {
            statusLabel.innerText = "Cleared";
            setTimeout(function () { statusLabel.innerText = ""; }, 1800);
        }
    };

    window.KuyaB.pasteCommitterContent = function () {
        var contentInput = document.getElementById("commitContentInput");
        var statusLabel = document.getElementById("fileLoadStatus");
        if (!contentInput) return;

        function applyText(text) {
            if (text && text.trim().length > 0) {
                contentInput.value = text;
                if (statusLabel) {
                    statusLabel.innerText = "Pasted!";
                    setTimeout(function () { statusLabel.innerText = ""; }, 2000);
                }
                return true;
            }
            return false;
        }

        var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : (window.KuyaB.tg || null);
        if (tg && typeof tg.readTextFromClipboard === "function") {
            try {
                tg.readTextFromClipboard(function (text) {
                    if (!applyText(text)) contentInput.focus();
                });
                return;
            } catch (err) {}
        }

        if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
            navigator.clipboard.readText().then(function (text) {
                if (!applyText(text)) contentInput.focus();
            }).catch(function () {
                contentInput.focus();
            });
            return;
        }
        contentInput.focus();
    };

    window.KuyaB.loadRepoTree = async function (force) {
        var statusLabel = document.getElementById("repoScanStatus");
        if (cachedRepoFiles.length > 0 && !force) return;
        if (statusLabel) statusLabel.innerText = "Scanning files...";

        try {
            var res = await fetch("/api/admin/repo-tree?t=" + Date.now());
            var data = await res.json();
            if (data.success && Array.isArray(data.files)) {
                cachedRepoFiles = data.files;
                if (statusLabel) statusLabel.innerText = cachedRepoFiles.length + " files ready";
            }
        } catch (err) {
            if (statusLabel) statusLabel.innerText = "Failed to load files";
        }

        setTimeout(function () {
            if (statusLabel) statusLabel.innerText = "";
        }, 3000);
    };

    window.KuyaB.filterRepoFiles = async function (query) {
        var dropdown = document.getElementById("fileSuggestionsList");
        if (!dropdown) return;

        if (cachedRepoFiles.length === 0) {
            dropdown.innerHTML = '<div style="padding: 10px 14px; font-size: 0.82rem; color: #64748b;">Loading repository file list...</div>';
            dropdown.style.display = "block";
            await window.KuyaB.loadRepoTree(false);
        }

        var term = (query || "").trim().toLowerCase();
        var matches = cachedRepoFiles.filter(function (file) {
            return term === "" || file.toLowerCase().indexOf(term) !== -1;
        });

        if (matches.length === 0) {
            dropdown.innerHTML = '<div style="padding: 10px 14px; font-size: 0.82rem; color: #94a3b8;">No matching files found</div>';
            dropdown.style.display = "block";
            return;
        }

        var html = "";
        var displayCount = Math.min(matches.length, 30);
        for (var i = 0; i < displayCount; i++) {
            var file = matches[i];
            var safeFile = encodeURIComponent(file);
            html += '<div class="repo-file-item" data-file="' + safeFile + '" style="' +
                'padding: 10px 14px; font-size: 0.84rem; color: #1e293b; cursor: pointer; ' +
                'border-bottom: 1px solid rgba(0,0,0,0.06); text-align: left;">' + file + '</div>';
        }

        dropdown.innerHTML = html;
        dropdown.style.display = "block";
    };

    window.KuyaB.onSelectRepoFile = async function (filePath) {
        var searchInput = document.getElementById("fileSearchInput");
        var pathInput = document.getElementById("commitFilePath");
        var contentInput = document.getElementById("commitContentInput");
        var statusLabel = document.getElementById("fileLoadStatus");
        var dropdown = document.getElementById("fileSuggestionsList");

        if (dropdown) dropdown.style.display = "none";
        if (searchInput) searchInput.value = filePath;
        if (pathInput) pathInput.value = filePath;
        if (!filePath) return;

        if (statusLabel) statusLabel.innerText = "Fetching current code...";
        try {
            var res = await fetch("/api/admin/get-file?path=" + encodeURIComponent(filePath) + "&t=" + Date.now());
            var data = await res.json();
            if (data.success && contentInput) {
                contentInput.value = data.content;
                if (statusLabel) statusLabel.innerText = "Loaded latest!";
            }
        } catch (e) {
            if (statusLabel) statusLabel.innerText = "Could not load content";
        }

        setTimeout(function () {
            if (statusLabel) statusLabel.innerText = "";
        }, 3000);
    };

    window.KuyaB.submitFileCommit = async function () {
        var pathInput = document.getElementById("commitFilePath");
        var msgInput = document.getElementById("commitMsgInput");
        var contentInput = document.getElementById("commitContentInput");
        var btn = document.getElementById("btnSubmitCommit");

        var path = pathInput ? pathInput.value.trim() : "";
        var content = contentInput ? contentInput.value : "";
        var msg = msgInput ? msgInput.value.trim() : "";

        if (!path) return alert("Please specify the file path.");
        if (!content) return alert("Please provide content to write.");

        if (!confirm("Are you sure you want to commit to " + path + "? This will trigger a live deploy.")) {
            return;
        }

        if (btn) btn.innerText = "Committing to GitHub...";

        try {
            var res = await fetch("/api/admin/commit-file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    file_path: path,
                    content: content,
                    message: msg || ("Update " + path)
                })
            });

            var data = await res.json();
            if (data.success) {
                alert(data.message);
                window.KuyaB.clearFileCommitterForm();

                var feats = getFeatures();
                var r = getRouter();
                if (feats.vault) feats.vault.setVaultType("other");
                if (r.showPage) r.showPage("vaultPage", feats.vault ? feats.vault.render : null);
            } else {
                alert("Commit failed: " + (data.error || "Unknown error"));
            }
        } catch (e) {
            alert("Network error: " + e.message);
        } finally {
            if (btn) btn.innerText = "Commit & Deploy 🚀";
        }
    };

    // Attach click listener for committer dropdown and repo file selection
    document.addEventListener("click", function (e) {
        var target = e.target;
        if (!target) return;

        var repoItem = target.closest(".repo-file-item");
        if (repoItem) {
            e.preventDefault();
            var encodedPath = repoItem.getAttribute("data-file");
            if (encodedPath) window.KuyaB.onSelectRepoFile(decodeURIComponent(encodedPath));
            return;
        }

        var dropdown = document.getElementById("fileSuggestionsList");
        var searchInput = document.getElementById("fileSearchInput");
        if (dropdown && searchInput && !dropdown.contains(target) && target !== searchInput) {
            dropdown.style.display = "none";
        }
    });
})();
