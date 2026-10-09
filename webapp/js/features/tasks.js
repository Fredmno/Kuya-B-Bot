/* =========================================================
   KUYA B — FEATURE: TASKS
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};

    var tasks = [];

    function loadTasks() {
        try { tasks = JSON.parse(localStorage.getItem("kuyaB_tasks")) || []; } catch (e) { tasks = []; }
    }

    function saveTasks() {
        localStorage.setItem("kuyaB_tasks", JSON.stringify(tasks));
    }

    function render() {
        loadTasks();
        var list = document.getElementById("tasksList");
        if (!list) return;

        if (tasks.length === 0) {
            list.innerHTML = '<p class="empty-state">No tasks pending. Tap + to add one!</p>';
            return;
        }

        var html = "";
        for (var i = 0; i < tasks.length; i++) {
            var t = tasks[i];
            var style = t.completed ? "text-decoration: line-through; opacity: 0.5;" : "";
            var toggleIcon = t.completed ? "↩" : "✓";
            html += '<div class="birthday-card" data-id="' + t.id + '">' +
                '<div class="birthday-info"><span class="birthday-name" style="' + style + '">' + t.title + '</span></div>' +
                '<div class="birthday-actions"><button type="button" class="btn-greet" data-action="toggle-task" data-id="' + t.id + '">' + toggleIcon + '</button>' +
                '<button type="button" class="btn-delete" data-action="delete-task" data-id="' + t.id + '">🗑️</button></div></div>';
        }
        list.innerHTML = html;
    }

    function add() {
        var input = document.getElementById("taskTitle");
        var title = input ? input.value.trim() : "";
        if (!title) return alert("Please enter task.");
        tasks.push({ id: Date.now().toString(), title: title, completed: false });
        saveTasks();
        window.KuyaB.triggerHaptic("medium");
        if (input) input.value = "";
        document.getElementById("taskForm").style.display = "none";
        render();
    }

    function toggle(id) {
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].id === id) {
                tasks[i].completed = !tasks[i].completed;
                break;
            }
        }
        saveTasks();
        render();
    }

    function remove(id) {
        if (!confirm("Delete task?")) return;
        tasks = tasks.filter(function (x) { return x.id !== id; });
        saveTasks();
        render();
    }

    window.KuyaB.features.tasks = {
        load: loadTasks,
        render: render,
        add: add,
        toggle: toggle,
        remove: remove
    };
})();
