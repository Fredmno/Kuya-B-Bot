/* =========================================================
   KUYA B — MASTER SHELL & EVENT DISPATCHER
   ========================================================= */

(function () {
    "use strict";

    var router = window.KuyaB.router;
    var features = window.KuyaB.features;

    // --- Dynamic file label for Add Content ---
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

    // --- Standalone Add Content submission handler ---
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
                window.KuyaB.triggerHaptic("success");
                window.KuyaB.showToast("Uploaded successfully! 📁");

                titleInput.value = "";
                folderInput.value = "";
                fileInput.value = "";
                if (fileNameLabel) {
                    fileNameLabel.innerText = "No file chosen";
                    fileNameLabel.style.color = "#64748b";
                }

                features.vault.setVaultType(mediaType);
                router.showPage("vaultPage", function () {
                    features.vault.openFolder(folderName);
                });
            } else {
                alert("Upload failed: " + (data.error || "Server error"));
            }
        } catch (err) {
            alert("Network error communicating with backend.");
        } finally {
            if (submitBtn) submitBtn.innerText = "Upload Content";
        }
    };

    // --- Dynamic Repository Tree Loader ---
    window.KuyaB.loadRepoTree = async function () {
        var select = document.getElementById("quickFileSelect");
        if (!select) return;
        select.innerHTML = '<option value="">-- Scanning repository... --</option>';

        try {
            var res = await fetch("/api/admin/repo-tree?t=" + Date.now());
            var data = await res.json();
            if (data.success && data.files) {
                var html = '<option value="">-- Select File to Edit or Type Below --</option>';
                data.files.forEach(function (filePath) {
                    html += '<option value="' + filePath + '">' + filePath + '</option>';
                });
                select.innerHTML = html;
            } else {
                select.innerHTML = '<option value="">-- Failed to load files --</option>';
            }
        } catch (err) {
            select.innerHTML = '<option value="">-- Error fetching files --</option>';
        }
    };

    // --- Live File Content Loader ---
    window.KuyaB.onSelectRepoFile = async function (filePath) {
        var pathInput = document.getElementById("commitFilePath");
        var contentInput = document.getElementById("commitContentInput");
        var statusLabel = document.getElementById("fileLoadStatus");

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
                if (statusLabel) statusLabel.innerText = "Blank / New File";
            }
        } catch (e) {
            if (statusLabel) statusLabel.innerText = "Could not load content";
        }
        setTimeout(function () {
            if (statusLabel) statusLabel.innerText = "";
        }, 3000);
    };

    // --- GitHub Committer Submission ---
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
                window.KuyaB.triggerHaptic("success");
                alert(data.message);
                contentInput.value = "";
                router.showDashboard();
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

            // 1. Dashboard Feature Cards
            var card = target.closest(".feature-card");
            if (card) {
                e.preventDefault();
                var feature = card.getAttribute("data-feature");
                window.KuyaB.triggerHaptic("light");

                if (feature === "birthdays") {
                    router.showPage("birthdaysPage", function () {
                        if (features.birthdays) features.birthdays.render();
                    });
                } else if (feature === "daily") {
                    router.showPage("dailyLogsPage", function () {
                        if (features.dailyLogs) features.dailyLogs.render();
                    });
                } else if (feature === "tasks") {
                    router.showPage("tasksPage", features.tasks.render);
                } else if (feature === "reminders") {
                    router.showPage("remindersPage", features.reminders.render);
                } else if (feature === "videos" || feature === "pictures" || feature === "other") {
                    features.vault.setVaultType(feature);
                    router.showPage("vaultPage", features.vault.render);
                } else if (feature === "search") {
                    var searchInput = document.getElementById("dashboardSearchInput");
                    if (searchInput) searchInput.focus();
                }
                return;
            }

            // 2. Navigation Back Buttons
            if (target.closest("#birthdayBackButton, #dailyLogsBackButton, #tasksBackButton, #remindersBackButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                router.showDashboard();
                return;
            }

            if (target.closest("#vaultBackButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                if (features.vault.getActiveFolder()) {
                    features.vault.backToFolders();
                } else {
                    router.showDashboard();
                }
                return;
            }

            // 3. Folder Drilldown Actions
            var folderCard = target.closest('[data-action="open-folder"]');
            if (folderCard) {
                e.preventDefault();
                var fName = decodeURIComponent(folderCard.getAttribute("data-folder"));
                features.vault.openFolder(fName);
                return;
            }

            if (target.closest("#btnBackToFolders")) {
                e.preventDefault();
                features.vault.backToFolders();
                return;
            }

            // 4. Standalone Add Content Page
            if (target.closest("#addContentButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                router.showPage("addContentPage");
                return;
            }

            if (target.closest("#addContentBackButton, #cancelAddContentButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                router.showDashboard();
                return;
            }

            // 5. Admin File Committer Navigation
            if (target.closest("#btnAdminUpdater")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                router.showPage("adminUpdaterPage", window.KuyaB.loadRepoTree);
                return;
            }

            if (target.closest("#adminUpdaterBackButton, #cancelAdminUpdaterButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                router.showDashboard();
                return;
            }

            // 6. User Tracking View
            if (target.closest("#btnOpenUserTracking")) {
                e.preventDefault();
                if (features.tracking && features.tracking.isAdmin()) {
                    window.KuyaB.triggerHaptic("light");
                    router.showPage("userTrackingPage", features.tracking.render);
                }
                return;
            }
            if (target.closest("#userTrackingBackButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                features.vault.setVaultType("other");
                router.showPage("vaultPage", features.vault.render);
                return;
            }

            // 7. Vault Media Lightbox & Inline Upload Form
            var vaultView = target.closest('[data-action="view-vault"]');
            if (vaultView) {
                e.preventDefault();
                var vId = vaultView.getAttribute("data-id");
                var vTitle = vaultView.getAttribute("data-title");
                var vType = vaultView.getAttribute("data-type") || "pictures";
                features.vault.openMediaModal(vId, vTitle, vType);
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
            var vaultDel = target.closest('[data-action="delete-vault"]');
            if (vaultDel) {
                e.preventDefault();
                features.vault.deleteItem(vaultDel.getAttribute("data-id"));
                return;
            }

            // 8. Tasks Actions
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
                features.tasks.add();
                return;
            }
            var taskToggle = target.closest('[data-action="toggle-task"]');
            if (taskToggle) {
                e.preventDefault();
                features.tasks.toggle(taskToggle.getAttribute("data-id"));
                return;
            }
            var taskDel = target.closest('[data-action="delete-task"]');
            if (taskDel) {
                e.preventDefault();
                features.tasks.remove(taskDel.getAttribute("data-id"));
                return;
            }

            // 9. Reminders Actions
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
                features.reminders.add();
                return;
            }
            var remDel = target.closest('[data-action="delete-rem"]');
            if (remDel) {
                e.preventDefault();
                features.reminders.remove(remDel.getAttribute("data-id"));
                return;
            }

            // 10. Birthdays Actions
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
                if (features.birthdays) features.birthdays.save();
                return;
            }
            var bdayGreetBtn = target.closest('[data-action="greet-bday"]');
            if (bdayGreetBtn) {
                e.preventDefault();
                if (features.birthdays) features.birthdays.greet(bdayGreetBtn.getAttribute("data-name"));
                return;
            }
            var bdayDelBtn = target.closest('[data-action="delete-bday"]');
            if (bdayDelBtn) {
                e.preventDefault();
                if (features.birthdays) features.birthdays.remove(bdayDelBtn.getAttribute("data-id"));
                return;
            }

            // 11. Daily Logs Open
            if (target.closest("#addLogButton")) {
                e.preventDefault();
                var lf = document.getElementById("logForm");
                if (lf) lf.style.display = "block";
                return;
            }

            // 12. Word Game
            if (target.closest("#gameButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                alert("Use /game in chat to play Word Scramble!");
                return;
            }
        });
    }

    function init() {
        if (window.Telegram && window.Telegram.WebApp) {
            window.KuyaB.tg = window.Telegram.WebApp;
            window.KuyaB.tg.ready();
            window.KuyaB.tg.expand();
        }

        features.vault.initFileInput();
        initAddContentInput();
        attachGlobalEvents();

        if (features.tracking) {
            features.tracking.track();
        }

        var msgId = window.KuyaB.getParam("msg_id");
        var chatId = window.KuyaB.getParam("chat_id");
        var startSection = window.KuyaB.getParam("start");

        if (msgId && chatId) {
            fetch("/api/cleanup-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, message_id: msgId })
            }).catch(function () {});
        }

        if (startSection === "add_bday") {
            router.hideAllPages();
            var popupPage = document.getElementById("addBirthdayStandalonePage");
            if (popupPage) popupPage.style.display = "block";
            return;
        }

        if (startSection === "birthdays") {
            router.showPage("birthdaysPage", function () {
                if (features.birthdays) features.birthdays.render();
            });
        } else if (startSection === "daily") {
            router.showPage("dailyLogsPage", function () {
                if (features.dailyLogs) features.dailyLogs.render();
            });
        } else if (startSection === "tasks") {
            router.showPage("tasksPage", features.tasks.render);
        } else if (startSection === "reminders") {
            router.showPage("remindersPage", features.reminders.render);
        } else if (startSection === "videos" || startSection === "pictures" || startSection === "other") {
            features.vault.setVaultType(startSection);
            router.showPage("vaultPage", features.vault.render);
        } else if (startSection === "admin_updater") {
            router.showPage("adminUpdaterPage", window.KuyaB.loadRepoTree);
        } else {
            router.showDashboard();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
