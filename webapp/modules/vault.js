/* =========================================================
   KUYA B — MODULE: CONTENT VAULT (VIDEOS, PICTURES, OTHER)
   ========================================================= */

import { escapeHtml, triggerHaptic, tg } from "./helpers.js";

let vaultItems = [];
let currentVaultType = "videos"; // 'videos' | 'pictures' | 'other'
let editingVaultItemId = null;

const TYPE_CONFIG = {
    videos: {
        title: "🎥 Videos",
        subtitle: "Your video vault",
        icon: "🎥",
        addText: "＋ Add Video",
        emptyText: "No videos saved yet"
    },
    pictures: {
        title: "🖼️ Pictures",
        subtitle: "Your photo gallery",
        icon: "🖼️",
        addText: "＋ Add Picture",
        emptyText: "No pictures saved yet"
    },
    other: {
        title: "📚 Other",
        subtitle: "Documents, notes & files",
        icon: "📚",
        addText: "＋ Add Content",
        emptyText: "No files or notes saved yet"
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

export function showVaultForm(item = null) {
    const form = document.getElementById("vaultForm");
    const heading = document.getElementById("vaultFormHeading");
    const titleInput = document.getElementById("vaultItemTitle");
    const catInput = document.getElementById("vaultItemCategory");
    const urlInput = document.getElementById("vaultItemUrl");
    const saveBtn = document.getElementById("saveVaultItemButton");

    if (!form) return;
    form.style.display = "block";

    if (item) {
        editingVaultItemId = item.id;
        if (heading) heading.textContent = "Edit Item";
        if (titleInput) titleInput.value = item.title;
        if (catInput) catInput.value = item.category || "";
        if (urlInput) urlInput.value = item.url || "";
        if (saveBtn) saveBtn.textContent = "Save Changes";
    } else {
        editingVaultItemId = null;
        if (heading) heading.textContent = `Save ${TYPE_CONFIG[currentVaultType].title}`;
        if (titleInput) titleInput.value = "";
        if (catInput) catInput.value = "";
        if (urlInput) urlInput.value = "";
        if (saveBtn) saveBtn.textContent = "Save Item";
    }

    setTimeout(() => titleInput?.focus(), 100);
}

export function hideVaultForm() {
    const form = document.getElementById("vaultForm");
    const titleInput = document.getElementById("vaultItemTitle");
    const catInput = document.getElementById("vaultItemCategory");
    const urlInput = document.getElementById("vaultItemUrl");

    if (!form) return;
    form.style.display = "none";
    editingVaultItemId = null;

    if (titleInput) titleInput.value = "";
    if (catInput) catInput.value = "";
    if (urlInput) urlInput.value = "";
}

export function saveVaultItem() {
    const titleInput = document.getElementById("vaultItemTitle");
    const catInput = document.getElementById("vaultItemCategory");
    const urlInput = document.getElementById("vaultItemUrl");

    const title = titleInput?.value.trim();
    const category = catInput?.value.trim() || "General";
    const url = urlInput?.value.trim() || "";

    if (!title) {
        alert("Please enter a title or description.");
        titleInput?.focus();
        return;
    }

    if (editingVaultItemId) {
        const idx = vaultItems.findIndex(v => v.id === editingVaultItemId);
        if (idx !== -1) {
            vaultItems[idx].title = title;
            vaultItems[idx].category = category;
            vaultItems[idx].url = url;
        }
    } else {
        vaultItems.unshift({
            id: Date.now().toString(),
            type: currentVaultType,
            title,
            category,
            url,
            createdAt: new Date().toISOString()
        });
    }

    saveVaultToStorage();
    triggerHaptic("notification");
    hideVaultForm();
    displayVaultItems();
}

export function deleteVaultItem(id) {
    const item = vaultItems.find(v => v.id === id);
    if (!item) return;

    if (!confirm(`Delete "${item.title}" from your vault?`)) return;

    vaultItems = vaultItems.filter(v => v.id !== id);
    saveVaultToStorage();
    triggerHaptic("warning");
    displayVaultItems();
}

export function displayVaultItems() {
    const list = document.getElementById("vaultList");
    if (!list) return;

    list.innerHTML = "";
    const config = TYPE_CONFIG[currentVaultType];

    // Filter items matching the active section (videos, pictures, or other)
    const filtered = vaultItems.filter(item => item.type === currentVaultType);

    if (!filtered.length) {
        list.innerHTML = `
            <div class="empty-state" style="text-align:center; padding:30px 10px; color:#94a3b8;">
                <div style="font-size:3rem; margin-bottom:8px;">${config.icon}</div>
                <strong style="display:block; font-size:1.1rem; color:#f8fafc; margin-bottom:4px;">${config.emptyText}</strong>
                <small>Keep track of your channel posts and media links here.</small>
            </div>
        `;
        return;
    }

    filtered.forEach(item => {
        const card = document.createElement("div");
        card.style.cssText = "display:flex; flex-direction:column; padding:12px; margin-bottom:10px; background:rgba(255,255,255,0.06); border-radius:14px;";

        let linkSection = "";
        if (item.url) {
            linkSection = `
                <div style="margin-top:8px;">
                    <button class="open-link-btn" data-url="${escapeHtml(item.url)}" type="button" style="background:rgba(56, 189, 248, 0.15); color:#38bdf8; border:none; border-radius:8px; padding:6px 12px; font-size:0.85rem; font-weight:600; cursor:pointer;">
                        ↗ Open in Telegram
                    </button>
                </div>
            `;
        }

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <span style="font-size:0.75rem; background:rgba(255,255,255,0.1); color:#94a3b8; padding:2px 8px; border-radius:6px;">
                        🏷️ ${escapeHtml(item.category)}
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
            ${linkSection}
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

    list.querySelectorAll(".open-link-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const url = btn.dataset.url;
            if (url) {
                if (tg?.openTelegramLink && url.includes("t.me")) {
                    tg.openTelegramLink(url);
                } else if (tg?.openLink) {
                    tg.openLink(url);
                } else {
                    window.open(url, "_blank");
                }
            }
        });
    });
}
