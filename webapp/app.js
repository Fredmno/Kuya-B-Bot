    // Cached repository file list for autocomplete filtering
    var cachedRepoFiles = [];

    // 1. Fetch Repository Files List
    window.KuyaB.loadRepoTree = async function () {
        var searchInput = document.getElementById("fileSearchInput");
        var statusLabel = document.getElementById("fileLoadStatus");

        if (statusLabel) statusLabel.innerText = "Scanning repository...";

        try {
            var res = await fetch("/api/admin/repo-tree?t=" + Date.now());
            var data = await res.json();
            if (data.success && data.files) {
                cachedRepoFiles = data.files;
                if (statusLabel) statusLabel.innerText = "Loaded " + cachedRepoFiles.length + " files";
            } else {
                if (statusLabel) statusLabel.innerText = "Failed to scan repo";
            }
        } catch (err) {
            if (statusLabel) statusLabel.innerText = "Error loading files";
        }

        setTimeout(function () {
            if (statusLabel) statusLabel.innerText = "";
        }, 2500);
    };

    // 2. Real-time Filter on Typing
    window.KuyaB.filterRepoFiles = function (query) {
        var dropdown = document.getElementById("fileSuggestionsList");
        if (!dropdown) return;

        var term = (query || "").trim().toLowerCase();
        var matches = cachedRepoFiles.filter(function (file) {
            return file.toLowerCase().indexOf(term) !== -1;
        });

        if (matches.length === 0) {
            dropdown.innerHTML = '<div style="padding: 10px 14px; font-size: 0.82rem; color: #94a3b8;">No matching files found</div>';
            dropdown.style.display = "block";
            return;
        }

        var html = "";
        matches.slice(0, 30).forEach(function (file) {
            html += '<div class="repo-file-item" onclick="window.KuyaB.onSelectRepoFile(\'' + file + '\')" style="' +
                'padding: 10px 14px; ' +
                'font-size: 0.84rem; ' +
                'color: #1e293b; ' +
                'cursor: pointer; ' +
                'border-bottom: 1px solid rgba(0,0,0,0.04);' +
            '">' + file + '</div>';
        });

        dropdown.innerHTML = html;
        dropdown.style.display = "block";
    };

    // 3. Selection Handler: Closes Dropdown and Loads Code
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
            } else {
                if (statusLabel) statusLabel.innerText = "New / Blank file";
            }
        } catch (e) {
            if (statusLabel) statusLabel.innerText = "Could not load content";
        }

        setTimeout(function () {
            if (statusLabel) statusLabel.innerText = "";
        }, 3000);
    };

    // Close suggestions list when tapping outside
    document.addEventListener("click", function (e) {
        var dropdown = document.getElementById("fileSuggestionsList");
        var searchInput = document.getElementById("fileSearchInput");
        if (dropdown && searchInput && !dropdown.contains(e.target) && e.target !== searchInput) {
            dropdown.style.display = "none";
        }
    });
