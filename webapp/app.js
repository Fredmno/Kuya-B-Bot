/* =========================================================
   KUYA B — MASTER SHELL & EVENT DISPATCHER
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};
    window.KuyaB.router = window.KuyaB.router || {};

    // Configure your Telegram user ID here (e.g., "7698531657")
    window.KuyaB.ADMIN_ID = "YOUR_TELEGRAM_USER_ID";

    var cachedRepoFiles = [];

    function getRouter() {
        return window.KuyaB.router;
    }

    function getFeatures() {
        return window.KuyaB.features;
    }

    // Dynamic file label updater
    function initAddContentInput() {
        var fileEl = document.getElementById("newContentFile");
        var nameLabel = document.getElementById("newContentFileName");
        if (fileEl && nameLabel) {
            fileEl.addEventListener("change", function () {
                if (this.files && this.files.length > 0) {
                    nameLabel.innerText = this.files[0].name;
                    nameLabel.style.color = "#1e293b";
                } else {
                    nameLabel.innerText = "No file chosen";
                    nameLabel.style.color = "#64748b";
                }
            });
        }
    }

    // Reset all File Committer form inputs
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

    // Clear only textarea content
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

    // Paste directly from clipboard into textarea
    window.KuyaB.pasteCommitterContent = async function () {
        var contentInput = document.getElementById("commitContentInput");
        var statusLabel = document.getElementById("fileLoadStatus");

        if (!contentInput) return;

        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                var text = await navigator.clipboard.readText();
                if (text) {
                    contentInput.value = text;
                    if (statusLabel) {
                        statusLabel.innerText = "Pasted from clipboard!";
                        setTimeout(function () { statusLabel.innerText = ""; }, 2000);
                    }
                    return;
                }
            }
            contentInput.focus();
            alert("Clipboard permission unavailable. Tap inside the box and select Paste.");
        } catch (err) {
            contentInput.focus();
            alert("Clipboard access blocked by browser. Please tap and paste manually.");
        }
    };

    // 1. Submit New Content (Standalone) with live % progress bar
    window.KuyaB.submitNewContent = function () {
        var fileInput = document.getElementById("newContentFile");
        var titleInput = document.getElementById("newContentTitle");
        var folderInput = document.getElementById("newContentFolder");
        var sectionSelect = document.getElementById("newContentSection");
        var fileNameLabel = document.getElementById("newContentFileName");
        var submitBtn = document.getElementById("btnSubmitAddContent");

        var progressContainer = document.getElementById("uploadProgressContainer");
        var progressBar = document.getElementById("uploadProgressBar");
        var percentText = document.getElementById("uploadPercentText");
        var statusText = document.getElementById("uploadStatusText");

        if (!fileInput || !fileInput.files.length) {
            alert("Please choose a file to upload.");
            return;
        }

        var file = fileInput.files[0];
        var chosenSection = sectionSelect ? sectionSelect.value : "other";
        var isVideo = file.type.startsWith("video/");
        var mediaType = chosenSection === "other" ? (isVideo ? "videos" : "pictures") : chosenSection;
        var folderName = folderInput.value.trim() || "General";

        var formData = new FormData();
        formData.append("file", file);
        formData.append("title", titleInput.value.trim() || "Untitled");
        formData.append("folder", folderName);
        formData.append("type", mediaType);

        if (progressContainer) {
            progressContainer.style.display = "block";
            if (progressBar) progressBar.style.width = "0%";
            if (percentText) percentText.innerText = "0%";
            if (statusText) statusText.innerText = isVideo ? "Uploading video..." : "Uploading file...";
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "Uploading (0%)...";
        }

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/vault/upload", true);

        xhr.upload.onprogress = function (e) {
            if (e.lengthComputable) {
                var percent = Math.round((e.loaded / e.total) * 100);
                if (progressBar) progressBar.style.width = percent + "%";
                if (percentText) percentText.innerText = percent + "%";
                if (submitBtn) submitBtn.innerText = "Uploading (" + percent + "%)...";

                if (percent === 100 && statusText) {
                    statusText.innerText = "Processing & saving to vault...";
                }
            }
        };

        xhr.onload = function () {
            if (submitBtn) submitBtn.disabled = false;
            try {
                var data = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                    if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("success");
                    if (window.KuyaB.showToast) window.KuyaB.showToast("Uploaded successfully! 📁");

                    titleInput.value = "";
                    folderInput.value = "";
                    fileInput.value = "";
                    if (fileNameLabel) {
                        fileNameLabel.innerText = "No file chosen";
                        fileNameLabel.style.color = "#64748b";
                    }
                    if (progressContainer) progressContainer.style.display = "none";
                    if (submitBtn) submitBtn.innerText = "Upload Content";

                    var feats = getFeatures();
                    var r = getRouter();
                    if (feats.vault) feats.vault.setVaultType(mediaType);
                    if (r.showPage) {
                        r.showPage("vaultPage", function () {
                            if (feats.vault) feats.vault.openFolder(folderName);
                        });
                    }
                } else {
                    alert("Upload failed: " + (data.error || "Server error"));
                    if (submitBtn) submitBtn.innerText = "Upload Content";
                }
            } catch (err) {
                alert("Error parsing server response.");
                if (submitBtn) submitBtn.innerText = "Upload Content";
            }
        };

        xhr.onerror = function () {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "Upload Content";
            }
            alert("Network error uploading file.");
        };

        xhr.send(formData);
    };

    // 2. Submit Inline Vault Upload with live % progress bar
    window.KuyaB.uploadMediaToVault = function () {
        var titleInput = document.getElementById("vaultItemTitle");
        var folderInput = document.getElementById("vaultItemFolder");
        var fileInput = document.getElementById("vaultItemFile");
        var fileNameLabel = document.getElementById("selectedFileName");
        var formBox = document.getElementById("vaultUploadForm");
        var submitBtn = document.getElementById("btnUploadMedia");

        var progressContainer = document.getElementById("inlineUploadProgressContainer");
        var progressBar = document.getElementById("inlineUploadProgressBar");
        var percentText = document.getElementById("inlineUploadPercentText");
        var statusText = document.getElementById("inlineUploadStatusText");

        if (!fileInput || !fileInput.files.length) {
            alert("Please choose a file to upload.");
            return;
        }

        var file = fileInput.files[0];
        var feats = getFeatures();
        var currentVaultType = (feats.vault && feats.vault.getCurrentVaultType) ? feats.vault.getCurrentVaultType() : "pictures";
        var isVideo = file.type.startsWith("video/");
        var mediaType = currentVaultType === "other" ? (isVideo ? "videos" : "pictures") : currentVaultType;
        var folderName = folderInput.value.trim() || ((feats.vault && feats.vault.getActiveFolder && feats.vault.getActiveFolder()) ? feats.vault.getActiveFolder() : "General");

        var formData = new FormData();
        formData.append("file", file);
        formData.append("title", titleInput.value.trim() || "Untitled");
        formData.append("folder", folderName);
        formData.append("type", mediaType);

        if (progressContainer) {
            progressContainer.style.display = "block";
            if (progressBar) progressBar.style.width = "0%";
            if (percentText) percentText.innerText = "0%";
            if (statusText) statusText.innerText = isVideo ? "Uploading video..." : "Uploading file...";
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "Uploading (0%)...";
        }

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/vault/upload", true);

        xhr.upload.onprogress = function (e) {
            if (e.lengthComputable) {
                var percent = Math.round((e.loaded / e.total) * 100);
                if (progressBar) progressBar.style.width = percent + "%";
                if (percentText) percentText.innerText = percent + "%";
                if (submitBtn) submitBtn.innerText = "Uploading (" + percent + "%)...";

                if (percent === 100 && statusText) {
                    statusText.innerText = "Processing & saving to vault...";
                }
            }
        };

        xhr.onload = function () {
            if (submitBtn) submitBtn.disabled = false;
            try {
                var data = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                    if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("success");
                    if (window.KuyaB.showToast) window.KuyaB.showToast("Uploaded successfully! 📁");

                    titleInput.value = "";
                    folderInput.value = "";
                    fileInput.value = "";
                    if (fileNameLabel) {
                        fileNameLabel.innerText = "No file chosen";
                        fileNameLabel.style.color = "#64748b";
                    }
                    if (progressContainer) progressContainer.style.display = "none";
                    if (formBox) formBox.style.display = "none";
                    if (submitBtn) submitBtn.innerText = "Upload";

                    if (feats.vault && feats.vault.render) feats.vault.render();
                } else {
                    alert("Upload failed: " + (data.error || "Server error"));
                    if (submitBtn) submitBtn.innerText = "Upload";
                }
            } catch (err) {
                alert("Error parsing response.");
                if (submitBtn) submitBtn.innerText = "Upload";
            }
        };

        xhr.onerror = function () {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "Upload";
            }
            alert("Network error during upload.");
        };

        xhr.send(formData);
    };

    // 3. Scan Repository Files List
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
                if (statusLabel) statusLabel.innerText = "Repo scan error";
            }
        } catch (err) {
            if (statusLabel) statusLabel.innerText = "Failed to load files";
        }

        setTimeout(function () {
            if (statusLabel) statusLabel.innerText = "";
        }, 3000);
    };

    // 4. Real-time Filter on Typing or Focus
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

    // 5. Select file from autocomplete
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

    // 6. Submit GitHub commit and reset form state
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

        var user = (window.KuyaB.tg && window.KuyaB.tg.initDataUnsafe) ? window.KuyaB.tg.initDataUnsafe.user : null;
        var userId = user ? user.id : "";

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
                    message: msg || ("Update " + path),
                    user_id: userId
                })
            });

            var data = await res.json();
            if (data.success) {
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("success");
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

    function attachGlobalEvents() {
        document.body.addEventListener("click", function (e) {
            var target = e.target;
            if (!target) return;

            var r = getRouter();
            var feats = getFeatures();

            var repoItem = target.closest(".repo-file-item");
            if (repoItem) {
                e.preventDefault();
                var encodedPath = repoItem.getAttribute("data-file");
                if (encodedPath) {
                    window.KuyaB.onSelectRepoFile(decodeURIComponent(encodedPath));
                }
                return;
            }

            var card = target.closest(".feature-card");
            if (card && !card.hasAttribute("data-action")) {
                e.preventDefault();
                var feature = card.getAttribute("data-feature");
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");

                if (feature === "birthdays") {
                    if (r.showPage) r.showPage("birthdaysPage", feats.birthdays ? feats.birthdays.render : null);
                } else if (feature === "daily") {
                    if (r.showPage) r.showPage("dailyLogsPage", feats.dailyLogs ? feats.dailyLogs.render : null);
                } else if (feature === "tasks") {
                    if (r.showPage) r.showPage("tasksPage", feats.tasks ? feats.tasks.render : null);
                } else if (feature === "reminders") {
                    if (r.showPage) r.showPage("remindersPage", feats.reminders ? feats.reminders.render : null);
                } else if (feature === "videos" || feature === "pictures" || feature === "other") {
                    if (feats.vault) feats.vault.setVaultType(feature);
                    if (r.showPage) r.showPage("vaultPage", feats.vault ? feats.vault.render : null);
                } else if (feature === "search") {
                    var searchInput = document.getElementById("dashboardSearchInput");
                    if (searchInput) searchInput.focus();
                }
                return;
            }

            if (target.closest("#birthdayBackButton, #dailyLogsBackButton, #tasksBackButton, #remindersBackButton")) {
                e.preventDefault();
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                if (r.showDashboard) r.showDashboard();
                return;
            }

            if (target.closest("#vaultBackButton")) {
                e.preventDefault();
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                if (feats.vault && feats.vault.getActiveFolder && feats.vault.getActiveFolder()) {
                    feats.vault.backToFolders();
                } else {
                    if (r.showDashboard) r.showDashboard();
                }
                return;
            }

            var folderCard = target.closest('[data-action="open-folder"]');
            if (folderCard) {
                e.preventDefault();
                var fName = decodeURIComponent(folderCard.getAttribute("data-folder"));
                if (feats.vault && feats.vault.openFolder) feats.vault.openFolder(fName);
                return;
            }

            if (target.closest("#btnBackToFolders")) {
                e.preventDefault();
                if (feats.vault && feats.vault.backToFolders) feats.vault.backToFolders();
                return;
            }

            if (target.closest("#addContentButton")) {
                e.preventDefault();
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                if (r.showPage) r.showPage("addContentPage");
                return;
            }

            if (target.closest("#addContentBackButton, #cancelAddContentButton")) {
                e.preventDefault();
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                if (r.showDashboard) r.showDashboard();
                return;
            }

            // Open Admin File Committer: Reset form every time it's opened
            if (target.closest("#btnAdminUpdater")) {
                e.preventDefault();
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                window.KuyaB.clearFileCommitterForm();
                if (r.showPage) r.showPage("adminUpdaterPage", window.KuyaB.loadRepoTree);
                return;
            }

            if (target.closest("#adminUpdaterBackButton, #cancelAdminUpdaterButton")) {
                e.preventDefault();
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                window.KuyaB.clearFileCommitterForm();
                if (feats.vault) feats.vault.setVaultType("other");
                if (r.showPage) r.showPage("vaultPage", feats.vault ? feats.vault.render : null);
                return;
            }

            if (target.closest("#btnOpenUserTracking")) {
                e.preventDefault();
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                if (r.showPage) r.showPage("userTrackingPage", feats.tracking ? feats.tracking.render : null);
                return;
            }
            if (target.closest("#userTrackingBackButton")) {
                e.preventDefault();
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                if (feats.vault) feats.vault.setVaultType("other");
                if (r.showPage) r.showPage("vaultPage", feats.vault ? feats.vault.render : null);
                return;
            }

            if (target.closest("#gameButton")) {
                e.preventDefault();
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                alert("Use /game in chat to play Word Scramble!");
                return;
            }

            if (target.closest("#addVaultItemButton")) {
                e.preventDefault();
                var vf = document.getElementById("vaultUploadForm");
                if (vf) vf.style.display = "block";
                return;
            }
            if (target.closest("#cancelVaultItemButton")) {
                e.preventDefault();
                var vfCancel = document.getElementById("vaultUploadForm");
                if (vfCancel) vfCancel.style.display = "none";
                return;
            }

            var vaultView = target.closest('[data-action="view-vault"]');
            if (vaultView) {
                e.preventDefault();
                var vId = vaultView.getAttribute("data-id");
                var vTitle = vaultView.getAttribute("data-title");
                var vType = vaultView.getAttribute("data-type") || "pictures";
                if (feats.vault && feats.vault.openMediaModal) feats.vault.openMediaModal(vId, vTitle, vType);
                return;
            }

            var vaultDel = target.closest('[data-action="delete-vault"]');
            if (vaultDel) {
                e.preventDefault();
                if (feats.vault && feats.vault.deleteItem) feats.vault.deleteItem(vaultDel.getAttribute("data-id"));
                return;
            }

            // Tasks
            if (target.closest("#addTaskButton")) {
                e.preventDefault();
                var tf = document.getElementById("taskForm");
                if (tf) tf.style.display = "block";
                return;
            }
            if (target.closest("#cancelTaskButton")) {
                e.preventDefault();
                var tfc = document.getElementById("taskForm");
                if (tfc) tfc.style.display = "none";
                return;
            }
            if (target.closest("#saveTaskButton")) {
                e.preventDefault();
                if (feats.tasks && feats.tasks.add) feats.tasks.add();
                return;
            }
            var taskToggle = target.closest('[data-action="toggle-task"]');
            if (taskToggle) {
                e.preventDefault();
                if (feats.tasks && feats.tasks.toggle) feats.tasks.toggle(taskToggle.getAttribute("data-id"));
                return;
            }
            var taskDel = target.closest('[data-action="delete-task"]');
            if (taskDel) {
                e.preventDefault();
                if (feats.tasks && feats.tasks.remove) feats.tasks.remove(taskDel.getAttribute("data-id"));
                return;
            }

            // Reminders
            if (target.closest("#addReminderButton")) {
                e.preventDefault();
                var rf = document.getElementById("reminderForm");
                if (rf) rf.style.display = "block";
                return;
            }
            if (target.closest("#cancelReminderButton")) {
                e.preventDefault();
                var rfc = document.getElementById("reminderForm");
                if (rfc) rfc.style.display = "none";
                return;
            }
            if (target.closest("#saveReminderButton")) {
                e.preventDefault();
                if (feats.reminders && feats.reminders.add) feats.reminders.add();
                return;
            }
            var remDel = target.closest('[data-action="delete-rem"]');
            if (remDel) {
                e.preventDefault();
                if (feats.reminders && feats.reminders.remove) feats.reminders.remove(remDel.getAttribute("data-id"));
                return;
            }

            // Birthdays
            if (target.closest("#addBirthdayButton")) {
                e.preventDefault();
                var bf = document.getElementById("birthdayForm");
                if (bf) bf.style.display = "block";
                return;
            }
            if (target.closest("#cancelBirthdayButton")) {
                e.preventDefault();
                var bfc = document.getElementById("birthdayForm");
                if (bfc) bfc.style.display = "none";
                return;
            }
            if (target.closest("#saveBirthdayButton")) {
                e.preventDefault();
                if (feats.birthdays && feats.birthdays.save) feats.birthdays.save();
                return;
            }
            var bdayGreetBtn = target.closest('[data-action="greet-bday"]');
            if (bdayGreetBtn) {
                e.preventDefault();
                if (feats.birthdays && feats.birthdays.greet) feats.birthdays.greet(bdayGreetBtn.getAttribute("data-name"));
                return;
            }
            var bdayDelBtn = target.closest('[data-action="delete-bday"]');
            if (bdayDelBtn) {
                e.preventDefault();
                if (feats.birthdays && feats.birthdays.remove) feats.birthdays.remove(bdayDelBtn.getAttribute("data-id"));
                return;
            }

            // Daily Logs
            if (target.closest("#addLogButton")) {
                e.preventDefault();
                var lf = document.getElementById("logForm");
                if (lf) lf.style.display = "block";
                return;
            }
        });

        // Hide autocomplete suggestions on outside click
        document.addEventListener("click", function (e) {
            var dropdown = document.getElementById("fileSuggestionsList");
            var searchInput = document.getElementById("fileSearchInput");
            if (dropdown && searchInput && !dropdown.contains(e.target) && e.target !== searchInput) {
                dropdown.style.display = "none";
            }
        });
    }

    function init() {
        if (window.Telegram && window.Telegram.WebApp) {
            window.KuyaB.tg = window.Telegram.WebApp;
            try {
                window.KuyaB.tg.ready();
                window.KuyaB.tg.expand();
            } catch (e) {}
        }

        var feats = getFeatures();
        var r = getRouter();

        if (feats.vault && feats.vault.initFileInput) feats.vault.initFileInput();
        initAddContentInput();
        attachGlobalEvents();

        if (feats.tracking && feats.tracking.track) {
            feats.tracking.track();
        }

        var getParam = window.KuyaB.getParam ? window.KuyaB.getParam : function (key) {
            var params = new URLSearchParams(window.location.search);
            return params.get(key);
        };

        var startSection = getParam("start");

        if (startSection === "add_bday") {
            if (r.hideAllPages) r.hideAllPages();
            var popupPage = document.getElementById("addBirthdayStandalonePage");
            if (popupPage) popupPage.style.display = "block";
            return;
        }

        if (startSection === "birthdays") {
            if (r.showPage) r.showPage("birthdaysPage", feats.birthdays ? feats.birthdays.render : null);
        } else if (startSection === "daily") {
            if (r.showPage) r.showPage("dailyLogsPage", feats.dailyLogs ? feats.dailyLogs.render : null);
        } else if (startSection === "tasks") {
            if (r.showPage) r.showPage("tasksPage", feats.tasks ? feats.tasks.render : null);
        } else if (startSection === "reminders") {
            if (r.showPage) r.showPage("remindersPage", feats.reminders ? feats.reminders.render : null);
        } else if (startSection === "videos" || startSection === "pictures" || startSection === "other") {
            if (feats.vault) feats.vault.setVaultType(startSection);
            if (r.showPage) r.showPage("vaultPage", feats.vault ? feats.vault.render : null);
        } else if (startSection === "admin_updater") {
            window.KuyaB.clearFileCommitterForm();
            if (r.showPage) r.showPage("adminUpdaterPage", window.KuyaB.loadRepoTree);
        } else {
            if (r.showDashboard) r.showDashboard();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
