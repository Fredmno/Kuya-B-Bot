/* =========================================================
   KUYA B — MASTER SHELL & EVENT DISPATCHER
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};
    window.KuyaB.router = window.KuyaB.router || {};

    // Leave empty or set your numerical Telegram ID
    window.KuyaB.ADMIN_ID = "YOUR_TELEGRAM_USER_ID";

    var cachedRepoFiles = [];

    // Safe router getters
    function getRouter() {
        return window.KuyaB.router;
    }

    function getFeatures() {
        return window.KuyaB.features;
    }

    // Dynamic file label for Add Content
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

    // Submit new vault content
    window.KuyaB.submitNewContent = async function () {
        var fileInput = document.getElementById("newContentFile");
        var titleInput = document.getElementById("newContentTitle");
        var folderInput = document.getElementById("newContentFolder");
        var sectionSelect = document.getElementById("newContentSection");
        var fileNameLabel = document.getElementById("newContentFileName");
        var submitBtn = document.getElementById("btnSubmitAddContent");

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

        if (submitBtn) submitBtn.innerText = "Uploading...";

        try {
            var res = await fetch("/api/vault/upload", {
                method: "POST",
                body: formData
            });
            var data = await res.json();
            if (data.success) {
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("success");
                if (window.KuyaB.showToast) window.KuyaB.showToast("Uploaded successfully! 📁");

                titleInput.value = "";
                folderInput.value = "";
                fileInput.value = "";
                if (fileNameLabel) {
                    fileNameLabel.innerText = "No file chosen";
                    fileNameLabel.style.color = "#64748b";
                }

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
            }
        } catch (err) {
            alert("Network error communicating with backend.");
        } finally {
            if (submitBtn) submitBtn.innerText = "Upload Content";
        }
    };

    // Scan repository file list
    window.KuyaB.loadRepoTree = async function () {
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

    // Autocomplete filter
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
                'padding: 10px 14px; font-size: 0.84rem; color: #1e293b; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.04);' +
            '">' + file + '</div>';
        });

        dropdown.innerHTML = html;
        dropdown.style.display = "block";
    };

    // Select file from autocomplete
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

    // Commit file
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
                contentInput.value = "";
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

            // 1. Feature Cards
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

            // 2. Navigation Back Buttons
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

            // 3. Vault Folder Drilldown
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

            // 4. Standalone Add Content Page
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

            // 5. Admin File Committer Navigation
            if (target.closest("#btnAdminUpdater")) {
                e.preventDefault();
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                if (r.showPage) r.showPage("adminUpdaterPage", window.KuyaB.loadRepoTree);
                return;
            }

            if (target.closest("#adminUpdaterBackButton, #cancelAdminUpdaterButton")) {
                e.preventDefault();
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                if (feats.vault) feats.vault.setVaultType("other");
                if (r.showPage) r.showPage("vaultPage", feats.vault ? feats.vault.render : null);
                return;
            }

            // 6. User Tracking
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

            // 7. Word Game
            if (target.closest("#gameButton")) {
                e.preventDefault();
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("light");
                alert("Use /game in chat to play Word Scramble!");
                return;
            }

            // 8. Vault Upload Form Toggle
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

            // 9. Vault Media View / Delete
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

            // 10. Tasks
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

            // 11. Reminders
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

            // 12. Birthdays
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

            // 13. Daily Logs
            if (target.closest("#addLogButton")) {
                e.preventDefault();
                var lf = document.getElementById("logForm");
                if (lf) lf.style.display = "block";
                return;
            }
        });

        // Close dropdown suggestions when clicking elsewhere
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
