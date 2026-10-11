/* =========================================================
   KUYA B — TASKS MODULE (FOLDER-BASED VAULT STYLE)
   webapp/modules/tasks.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};

    var tasks = {
        activeFolder: null,
        allTasks: []
    };

    function triggerHaptic(type) {
        if (window.KuyaB.triggerHaptic) {
            window.KuyaB.triggerHaptic(type || "light");
        } else if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type || "light");
        }
    }

    tasks.render = async function () {
        tasks.activeFolder = null;
        var pageTitle = document.getElementById("tasksPageTitle");
        if (pageTitle) pageTitle.innerText = "✅ Tasks";

        var foldersView = document.getElementById("tasksFoldersView");
        var insideView = document.getElementById("tasksInsideFolderView");
        var form = document.getElementById("taskForm");

        if (foldersView) foldersView.style.display = "block";
        if (insideView) insideView.style.display = "none";
        if (form) form.style.display = "none";

        try {
            var res = await fetch("/api/tasks?t=" + Date.now());
            var data = await res.json();
            if (!data.success) return;

            tasks.allTasks = data.tasks || [];
            var folders = data.folders || [];
            var grid = document.getElementById("tasksFoldersGrid");
            if (!grid) return;

            if (folders.length === 0) {
                // Show default General folder if empty
                folders = [{ name: "General", count: 0 }];
            }

            var html = "";
            folders.forEach(function (f) {
                html += '<div class="feature-card" onclick="window.KuyaB.features.tasks.openFolder(\'' + encodeURIComponent(f.name) + '\')" style="cursor: pointer; padding: 16px;">' +
                    '<div class="card-header">' +
                        '<span class="card-icon">📁</span>' +
                        '<span class="card-title">' + f.name + '</span>' +
                    '</div>' +
                    '<span class="card-desc">' + f.count + (f.count === 1 ? ' task' : ' tasks') + '</span>' +
                '</div>';
            });

            grid.innerHTML = html;
        } catch (e) {
            console.error("Error loading task folders:", e);
        }
    };

    tasks.openFolder = function (encodedFolder) {
        var folderName = decodeURIComponent(encodedFolder);
        tasks.activeFolder = folderName;
        triggerHaptic("light");

        var pageTitle = document.getElementById("tasksPageTitle");
        if (pageTitle) pageTitle.innerText = "📁 " + folderName;

        var label = document.getElementById("tasksCurrentFolderLabel");
        if (label) label.innerText = folderName;

        var foldersView = document.getElementById("tasksFoldersView");
        var insideView = document.getElementById("tasksInsideFolderView");
        var form = document.getElementById("taskForm");
        var folderInput = document.getElementById("taskFolderInput");

        if (foldersView) foldersView.style.display = "none";
        if (insideView) insideView.style.display = "block";
        if (form) form.style.display = "none";
        if (folderInput) folderInput.value = folderName;

        tasks.renderFolderItems();
    };

    tasks.backToFolders = function () {
        triggerHaptic("light");
        tasks.render();
    };

    tasks.getActiveFolder = function () {
        return tasks.activeFolder;
    };

    tasks.renderFolderItems = function () {
        var listContainer = document.getElementById("tasksItemsList");
        if (!listContainer) return;

        var folderTasks = tasks.allTasks.filter(function (t) {
            return (t.folder || "General").toLowerCase() === tasks.activeFolder.toLowerCase();
        });

        if (folderTasks.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; padding: 36px 16px; color: var(--text-muted, #94a3b8);">' +
                '<div style="font-size: 2rem; margin-bottom: 8px;">✅</div>' +
                'No tasks in this folder yet.<br>Tap + above to add one.</div>';
            return;
        }

        var html = "";
        folderTasks.forEach(function (t) {
            var isDone = t.completed;
            var textStyle = isDone ? "text-decoration: line-through; opacity: 0.55; color: #94a3b8;" : "color: #fff;";
            var checkIcon = isDone ? "☑️" : "⬜";

            html += '<div style="background: var(--bg-card, #1e293b); padding: 14px 16px; border-radius: 14px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between;">' +
                '<div style="display: flex; align-items: center; gap: 12px; flex: 1; cursor: pointer;" onclick="window.KuyaB.features.tasks.toggleTask(\'' + t.id + '\')">' +
                    '<span style="font-size: 1.25rem;">' + checkIcon + '</span>' +
                    '<span style="font-size: 0.92rem; ' + textStyle + '">' + t.title + '</span>' +
                '</div>' +
                '<button type="button" class="btn-soft cancel" style="padding: 4px 8px; font-size: 0.75rem;" onclick="window.KuyaB.features.tasks.deleteTask(\'' + t.id + '\')">✕</button>' +
            '</div>';
        });

        listContainer.innerHTML = html;
    };

    tasks.save = async function () {
        var titleInput = document.getElementById("taskTitle");
        var folderInput = document.getElementById("taskFolderInput");

        var title = titleInput ? titleInput.value.trim() : "";
        var folder = (folderInput ? folderInput.value.trim() : "") || (tasks.activeFolder || "General");

        if (!title) {
            alert("Please enter a task description.");
            return;
        }

        try {
            var res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: title, folder: folder })
            });
            var data = await res.json();
            if (data.success) {
                triggerHaptic("success");
                if (titleInput) titleInput.value = "";
                document.getElementById("taskForm").style.display = "none";

                // Refresh tasks data and view
                var fetchRes = await fetch("/api/tasks?t=" + Date.now());
                var fetchData = await fetchRes.json();
                tasks.allTasks = fetchData.tasks || [];

                if (tasks.activeFolder) {
                    tasks.renderFolderItems();
                } else {
                    tasks.openFolder(folder);
                }
            } else {
                alert("Error: " + (data.error || "Could not save task"));
            }
        } catch (e) {
            alert("Network error saving task.");
        }
    };

    tasks.toggleTask = async function (id) {
        triggerHaptic("light");
        try {
            var res = await fetch("/api/tasks/toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: id })
            });
            var data = await res.json();
            if (data.success) {
                tasks.allTasks.forEach(function (t) {
                    if (t.id === id) t.completed = !t.completed;
                });
                tasks.renderFolderItems();
            }
        } catch (e) {
            console.error("Error toggling task:", e);
        }
    };

    tasks.deleteTask = async function (id) {
        triggerHaptic("light");
        try {
            var res = await fetch("/api/tasks/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: id })
            });
            var data = await res.json();
            if (data.success) {
                tasks.allTasks = tasks.allTasks.filter(function (t) { return t.id !== id });
                tasks.renderFolderItems();
            }
        } catch (e) {
            console.error("Error deleting task:", e);
        }
    };

    window.KuyaB.features.tasks = tasks;
})();
