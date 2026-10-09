/* =========================================================
   KUYA B — MASTER SHELL & EVENT DISPATCHER
   ========================================================= */

(function () {
    "use strict";

    var router = window.KuyaB.router;
    var features = window.KuyaB.features;

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
            if (target.closest("#birthdayBackButton, #dailyLogsBackButton, #tasksBackButton, #remindersBackButton, #vaultBackButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                router.showDashboard();
                return;
            }

            // 3. User Tracking View
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

            // 4. Vault Media Lightbox & Actions
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

            // 5. Tasks Actions
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

            // 6. Reminders Actions
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

            // 7. Birthdays Actions
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

            // 8. Daily Logs Open
            if (target.closest("#addLogButton")) {
                e.preventDefault();
                var lf = document.getElementById("logForm");
                if (lf) lf.style.display = "block";
                return;
            }


            // Folder Drilldown Actions
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

            // Top Vault Back Button Behavior:
            // If inside a folder, back goes to the Folders list. If at Folders list, goes to Dashboard.
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


            // 9. Word Game & Quick Add
            if (target.closest("#gameButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                alert("Use /game in chat to play Word Scramble!");
                return;
            }
            if (target.closest("#addContentButton")) {
                e.preventDefault();
                window.KuyaB.triggerHaptic("light");
                features.vault.setVaultType("other");
                router.showPage("vaultPage", function () {
                    features.vault.render();
                    var vf = document.getElementById("vaultUploadForm");
                    if (vf) vf.style.display = "block";
                });
                return;
            }
        });
    }

    function init() {
        features.vault.initFileInput();
        attachGlobalEvents();

        if (features.tracking) features.tracking.track();

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
