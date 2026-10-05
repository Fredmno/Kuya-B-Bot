/* =========================================================
   KUYA B — MODULE: CONTENT VAULT (WITH FOLDERS)
   ========================================================= */

import { escapeHtml, triggerHaptic, tg } from "./helpers.js";

let vaultItems = [];
let currentVaultType = "videos"; // 'videos' | 'pictures' | 'other'
let selectedFolder = "All";
let editingVaultItemId = null;

const TYPE_CONFIG = {
    videos: {
        title: "🎥 Videos",
        subtitle: "Organized by folders",
        icon: "🎥",
        addText: "＋ Add Video",
        emptyText: "No videos in this folder"
    },
    pictures: {
        title: "🖼️️ Pictures",
        subtitle: "Organized by folders",
        icon: "🖼️",
        addText: "＋ Add Picture",
        emptyText: "No pictures in this folder"
    },
    other: {
        title: "📚 Other",
        subtitle: "Documents & notes",
        icon: "📚",
        addText: "＋ Add File",
        emptyText: "No files in this folder"
    }
};

export function loadVault() {
    try {
        const saved = localStorage.getItem("kuyaB_vault");
        vaultItems = saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error("Unable to load vault items:", error);
        vaultItems = [];
    }
}

function saveVaultToStorage() {
    try {
        localStorage.setItem("kuyaB_vault", JSON.stringify(vaultItems));
    } catch (error) {
        console.error("Unable to save vault items:", error);
    }
}

export function setVaultType(type) {
    if (TYPE_CONFIG[type]) {
        currentVaultType = type;
        selectedFolder = "All"; // Reset folder filter when switching sections
        updateVaultHeader();
    }
}

function updateVaultHeader() {
    const config = TYPE_CONFIG[currentVaultType];
    const headerTitle = document.getElementById("vaultHeaderTitle");
    const headerSub = document.getElementById("vaultHeaderSubtitle");
    const headerIcon = document.getElementById("vaultHeaderIcon");
    const addBtn = document.getElementById("addVaultItemButton");

    if (headerTitle) headerTitle.textContent = config.title;
    if (headerSub) headerSub.textContent = config.subtitle;
    if (headerIcon) headerIcon.textContent = config.icon;
    if (addBtn) addBtn.innerHTML = `<span>＋</span> ${config.addText}`;
}

// Extract distinct folders for current media type
function getFoldersForCurrentType() {
    const folders = new Set();
    vaultItems
        .filter(item => item.type === currentVaultType)
        .forEach(item => {
            if (item.folder) folders.add(item.folder);
        });
    return Array.from(folders).sort();
}

// ---------------------------------------------------------
// RENDER FOLDER PILLS
// ---------------------------------------------------------

export function displayFolderBar() {
    const bar = document.getElementById("vaultFoldersBar");
    if (!bar) return;

    bar.innerHTML = "";
    const folders = ["All", ...getFoldersForCurrentType()];

    folders.forEach(folder => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `folder-pill ${selectedFolder === folder ? "active" : ""}`;
        btn.textContent = folder === "All" ? "📁 All" : `📁 ${folder}`;

        btn.addEventListener("click", () => {
            triggerHaptic("light");
            selectedFolder = folder;
            displayFolderBar();
            displayVaultItems();
        });

        bar.appendChild(btn);
    });
}

// Populate folder options in the form dropdown
function populateFolderDropdown(activeFolder = "General") {
    const select = document.getElementById("vaultFolderSelect");
    const newFolderContainer = document.getElementById("newFolderContainer");
    const newFolderInput = document.getElementById("vaultNewFolderInput");

    if (!select) return;
    select.innerHTML = "";

    const existingFolders = getFoldersForCurrentType();
    if (!existingFolders.includes("General")) {
        existingFolders.unshift("General");
    }

    existingFolders.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f;
        opt.textContent = f;
        select.appendChild(opt);
    });

    // Special option to create a new folder
    const createNewOpt = document.createElement("option");
    createNewOpt.value = "__NEW__";
    createNewOpt.textContent = "＋ Create New Folder...";
    select.appendChild(createNewOpt);

    select.value = existingFolders.includes(activeFolder) ? activeFolder : "General";

    // Toggle custom text input if "__NEW__" is selected
    select.onchange = () => {
        if (select.value === "__NEW__") {
            newFolderContainer.style.display = "block";
            newFolderInput.focus();
        } else {
            newFolderContainer.style.display = "none";
            newFolderInput.value = "";
        }
    };

    if (newFolderContainer) newFolderContainer.style.display = "none";
    if (newFolderInput) newFolderInput.value = "";
}

// ---------------------------------------------------------
// FORM MANAGEMENT
// ---------------------------------------------------------

export function showVaultForm(item = null) {
    const form = document.getElementById("vaultForm");
    const heading = document.getElementById("vaultFormHeading");
    const titleInput = document.getElementById("vaultItemTitle");
    const urlInput = document.getElementById("vaultItemUrl");
    const saveBtn = document.getElementById("saveVaultItemButton");

    if (!form) return;
    form.style.display = "block";

    if (item) {
        editingVaultItemId = item.id;
        if (heading) heading.textContent = "Edit Item";
        if (titleInput) titleInput.value = item.title;
        if (urlInput) urlInput.value = item.messageLink || "";
        if (saveBtn) saveBtn.textContent = "Save Changes";
        populateFolderDropdown(item.folder || "General");
    } else {
        editingVaultItemId = null;
        if (heading) heading.textContent = `Add to ${TYPE_CONFIG[currentVaultType].title}`;
        if (titleInput) titleInput.value = "";
        if (urlInput) urlInput.value = "";
        if (saveBtn) saveBtn.textContent = "Save Item";
        populateFolderDropdown(selectedFolder !== "All" ? selectedFolder : "General");
    }

    setTimeout(() => titleInput?.focus(), 100);
}

export function hideVaultForm() {
    const form = document.getElementById("vaultForm");
    if (!form) return;
    form.style.display = "none";
    editingVaultItemId = null;
}

export function saveVaultItem() {
    const titleInput = document.getElementById("vaultItemTitle");
    const select = document.getElementById("vaultFolderSelect");
    const newFolderInput = document.getElementById("vaultNewFolderInput");
    const urlInput = document.getElementById("vaultItemUrl");

    const title = titleInput?.value.trim();
    const rawLink = urlInput?.value.trim() || "";

    // Determine final folder name
    let folder = select?.value || "General";
    if (folder === "__NEW__") {
        folder = newFolderInput?.value.trim() || "General";
    }

    if (!title) {
        alert("Please enter a title.");
        titleInput?.focus();
        return;
    }

    // Extract message ID number
    const parts = rawLink.split('/');
    const messageId = parts[parts.length - 1].replace(/\D/g, "");

    if (editingVaultItemId) {
        const idx = vaultItems.findIndex(v => v.id === editingVaultItemId);
        if (idx !== -1) {
            vaultItems[idx].title = title;
            vaultItems[idx].folder = folder;
            vaultItems[idx].messageLink = rawLink;
            vaultItems[idx].messageId = messageId;
        }
    } else {
        vaultItems.unshift({
            id: Date.now().toString(),
            type: currentVaultType,
            title,
            folder,
            messageLink: rawLink,
            messageId: messageId,
            createdAt: new Date().toISOString()
        });
    }

    saveVaultToStorage();
    triggerHaptic("notification");
    hideVaultForm();
    displayFolderBar();
    displayVaultItems();
}

export function deleteVaultItem(id) {
    const item = vaultItems.find(v => v.id === id);
    if (!item) return;

    if (!confirm(`Delete "${item.title}"?`)) return;

    vaultItems = vaultItems.filter(v => v.id !== id);
    saveVaultToStorage();
    triggerHaptic("warning");
    displayFolderBar();
    displayVaultItems();
}

async function sendToChat(messageId) {
    triggerHaptic("light");
    const userId = tg?.initDataUnsafe?.user?.id;

    try {
        const res = await fetch('/api/vault/forward', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId, userId })
        });

        if (res.ok) {
            triggerHaptic("notification");
            if (tg?.showAlert) {
                tg.showAlert("Sent to your chat with Kuya B! 📬");
            } else {
                alert("Sent to your chat with Kuya B! 📬");
            }
        } else {
            alert("Could not forward file. Make sure the message ID exists in the channel.");
        }
    } catch (e) {
        console.error(e);
        alert("Error connecting to bot server.");
    }
}

// ---------------------------------------------------------
// RENDER ITEMS LIST
// ---------------------------------------------------------

export function displayVaultItems() {
    const list = document.getElementById("vaultList");
    if (!list) return;

    list.innerHTML = "";
    const config = TYPE_CONFIG[currentVaultType];

    // Filter by type AND active folder
    const filtered = vaultItems.filter(item => {
        if (item.type !== currentVaultType) return false;
        if (selectedFolder !== "All" && item.folder !== selectedFolder) return false;
        return true;
    });

    if (!filtered.length) {
        list.innerHTML = `
            <div class="empty-state" style="text-align:center; padding:30px 10px; color:#94a3b8;">
                <div style="font-size:3rem; margin-bottom:8px;">${config.icon}</div>
                <strong style="display:block; font-size:1.1rem; color:#f8fafc; margin-bottom:4px;">${config.emptyText}</strong>
                <small>Tap "＋ Add" to add files into this folder.</small>
            </div>
        `;
        return;
    }

    filtered.forEach(item => {
        const card = document.createElement("div");
        card.style.cssText = "display:flex; flex-direction:column; padding:14px; margin-bottom:12px; background:rgba(255,255,255,0.06); border-radius:14px;";

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <span style="font-size:0.75rem; background:rgba(255,255,255,0.1); color:#38bdf8; padding:3px 8px; border-radius:6px; font-weight:600;">
                        📁 ${escapeHtml(item.folder || "General")}
                    </span>
                    <strong style="display:block; font-size:1rem; color:#f8fafc; margin-top:6px; word-break:break-word;">
                        ${escapeHtml(item.title)}
                    </strong>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="vault-edit" type="button" data-id="${escapeHtml(item.id)}" style="background:none; border:none; font-size:1.1rem; padding:4px; cursor:pointer;">✏️</button>
                    <button class="vault-delete" type="button" data-id="${escapeHtml(item.id)}" style="background:none; border:none; font-size:1.1rem; padding:4px; cursor:pointer;">🗑️</button>
                </div>
            </div>

            <div style="margin-top:12px;">
                <button class="btn-send-chat" data-msgid="${escapeHtml(item.messageId || '')}" type="button" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px; background:rgba(56, 189, 248, 0.15); color:#38bdf8; border:1px solid rgba(56, 189, 248, 0.3); border-radius:10px; padding:10px; font-size:0.9rem; font-weight:600; cursor:pointer;">
                    <span>📥</span> Send to Bot Chat
                </button>
            </div>
        `;

        list.appendChild(card);
    });

    list.querySelectorAll(".vault-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            const item = vaultItems.find(v => v.id === btn.dataset.id);
            if (item) showVaultForm(item);
        });
    });

    list.querySelectorAll(".vault-delete").forEach(btn => {
        btn.addEventListener("click", () => deleteVaultItem(btn.dataset.id));
    });

    list.querySelectorAll(".btn-send-chat").forEach(btn => {
        btn.addEventListener("click", () => {
            const msgId = btn.dataset.msgid;
            if (!msgId) {
                alert("No channel message ID found for this item.");
                return;
            }
            sendToChat(msgId);
        });
    });
}
