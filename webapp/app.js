    // Cached repository file list for autocomplete filtering
    var cachedRepoFiles = [];

    // 1. Fetch Repository Files List
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
            } else {
                if (statusLabel) statusLabel.innerText = "Repo error: " + (data.error || "empty");
            }
        } catch (err) {
            if (statusLabel) statusLabel.innerText = "Failed to load files";
        }

        setTimeout(function () {
            if (statusLabel) statusLabel.innerText = "";
        }, 3000);
    };

    // 2. Real-time Filter on Typing or Focus
    window.KuyaB.filterRepoFiles = async function (query) {
        var dropdown = document.getElementById("fileSuggestionsList");
        if (!dropdown) return;

        // If files haven't been fetched yet, trigger background fetch immediately
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
                'padding: 10px 14px; ' +
                'font-size: 0.84rem; ' +
                'color: #1e293b; ' +
                'cursor: pointer; ' +
                'border-bottom: 1px solid rgba(0,0,0,0.06); ' +
                'text-align: left;' +
            '">' + file + '</div>';
        }

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
