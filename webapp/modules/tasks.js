/* =========================================================
   KUYA B — MODULE: TASKS
   ========================================================= */

import { escapeHtml, triggerHaptic } from "./helpers.js";

let tasks = [];
let editingTaskId = null;

export function loadTasks() {
    try {
        const saved = localStorage.getItem("kuyaB_tasks");
        tasks = saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error("Unable to load tasks:", error);
        tasks = [];
    }
}

function saveTasksToStorage() {
    try {
        localStorage.setItem("kuyaB_tasks", JSON.stringify(tasks));
    } catch (error) {
        console.error("Unable to save tasks:", error);
    }
}

export function showTaskForm(task = null) {
    const form = document.getElementById("taskForm");
    const heading = document.getElementById("taskFormHeading");
    const titleInput = document.getElementById("taskTitle");
    const dateInput = document.getElementById("taskDueDate");
    const prioritySelect = document.getElementById("taskPriority");
    const saveBtn = document.getElementById("saveTaskButton");

    if (!form) return;
    form.style.display = "block";

    if (task) {
        editingTaskId = task.id;
        if (heading) heading.textContent = "Edit Task";
        if (titleInput) titleInput.value = task.title;
        if (dateInput) dateInput.value = task.dueDate || "";
        if (prioritySelect) prioritySelect.value = task.priority || "normal";
        if (saveBtn) saveBtn.textContent = "Save Changes";
    } else {
        editingTaskId = null;
        if (heading) heading.textContent = "Add Task";
        if (titleInput) titleInput.value = "";
        if (dateInput) dateInput.value = "";
        if (prioritySelect) prioritySelect.value = "normal";
        if (saveBtn) saveBtn.textContent = "Save Task";
    }

    setTimeout(() => titleInput?.focus(), 100);
}

export function hideTaskForm() {
    const form = document.getElementById("taskForm");
    const titleInput = document.getElementById("taskTitle");
    const dateInput = document.getElementById("taskDueDate");

    if (!form) return;
    form.style.display = "none";
    editingTaskId = null;

    if (titleInput) titleInput.value = "";
    if (dateInput) dateInput.value = "";
}

export function saveTask() {
    const titleInput = document.getElementById("taskTitle");
    const dateInput = document.getElementById("taskDueDate");
    const prioritySelect = document.getElementById("taskPriority");

    const title = titleInput?.value.trim();
    const dueDate = dateInput?.value || null;
    const priority = prioritySelect?.value || "normal";

    if (!title) {
        alert("Please enter a task name.");
        titleInput?.focus();
        return;
    }

    if (editingTaskId) {
        const idx = tasks.findIndex(t => t.id === editingTaskId);
        if (idx !== -1) {
            tasks[idx].title = title;
            tasks[idx].dueDate = dueDate;
            tasks[idx].priority = priority;
        }
    } else {
        tasks.unshift({
            id: Date.now().toString(),
            title,
            dueDate,
            priority,
            completed: false,
            createdAt: new Date().toISOString()
        });
    }

    saveTasksToStorage();
    triggerHaptic("notification");
    hideTaskForm();
    displayTasks();
}

export function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    saveTasksToStorage();
    triggerHaptic("light");
    displayTasks();
}

export function deleteTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (!confirm(`Delete task "${task.title}"?`)) return;

    tasks = tasks.filter(t => t.id !== id);
    saveTasksToStorage();
    triggerHaptic("warning");
    displayTasks();
}

export function displayTasks() {
    const list = document.getElementById("tasksList");
    if (!list) return;
    list.innerHTML = "";

    if (!tasks.length) {
        list.innerHTML = `
            <div class="empty-state" style="text-align:center; padding:30px 10px; color:#94a3b8;">
                <div style="font-size:3rem; margin-bottom:8px;">✅</div>
                <strong style="display:block; font-size:1.1rem; color:#f8fafc; margin-bottom:4px;">No tasks yet</strong>
                <small>Create tasks to stay organized and productive.</small>
            </div>
        `;
        return;
    }

    // Sort: Pending first, completed last
    const sorted = [...tasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return Number(b.id) - Number(a.id);
    });

    sorted.forEach(task => {
        const isDone = task.completed;
        const card = document.createElement("div");
        card.style.cssText = `display:flex; align-items:center; justify-content:space-between; padding:12px; margin-bottom:10px; background:rgba(255,255,255,${isDone ? '0.02' : '0.06'}); border-radius:14px; opacity:${isDone ? '0.6' : '1'};`;

        let priorityBadge = "";
        if (task.priority === "high") {
            priorityBadge = `<span style="font-size:0.75rem; background:rgba(239,68,68,0.2); color:#f87171; padding:2px 6px; border-radius:6px; margin-left:6px;">High</span>`;
        }

        let dueText = "";
        if (task.dueDate) {
            dueText = `<span style="font-size:0.8rem; color:#94a3b8; display:block; margin-top:2px;">Due: ${escapeHtml(task.dueDate)}</span>`;
        }

        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
                <button class="task-toggle" data-id="${escapeHtml(task.id)}" type="button" style="background:none; border:none; font-size:1.4rem; padding:0; cursor:pointer;">
                    ${isDone ? '☑️' : '⬜'}
                </button>
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center;">
                        <strong style="font-size:0.95rem; color:#f8fafc; text-decoration:${isDone ? 'line-through' : 'none'}; word-break:break-word;">
                            ${escapeHtml(task.title)}
                        </strong>
                        ${priorityBadge}
                    </div>
                    ${dueText}
                </div>
            </div>
            <div style="display:flex; gap:6px; margin-left:8px;">
                <button class="task-edit" type="button" data-id="${escapeHtml(task.id)}" style="background:none; border:none; font-size:1.1rem; padding:6px; cursor:pointer;">✏️</button>
                <button class="task-delete" type="button" data-id="${escapeHtml(task.id)}" style="background:none; border:none; font-size:1.1rem; padding:6px; cursor:pointer;">🗑️</button>
            </div>
        `;

        list.appendChild(card);
    });

    list.querySelectorAll(".task-toggle").forEach(btn => {
        btn.addEventListener("click", () => toggleTask(btn.dataset.id));
    });

    list.querySelectorAll(".task-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            const item = tasks.find(t => t.id === btn.dataset.id);
            if (item) showTaskForm(item);
        });
    });

    list.querySelectorAll(".task-delete").forEach(btn => {
        btn.addEventListener("click", () => deleteTask(btn.dataset.id));
    });
}
