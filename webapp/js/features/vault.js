/* =========================================================
   KUYA B — FEATURE: VAULT (PICTURES, VIDEOS, OTHER)
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};

    var currentVaultType = "pictures"; // 'pictures' | 'videos' | 'other'
    var activeFolder = null; // null => root folder directory view

    function setVaultType(type) {
        currentVaultType = type || "pictures";
        activeFolder = null;
    }

    function getActiveFolder() {
        return activeFolder;
    }

    function openFolder(folderName) {
        activeFolder = folderName;
        render();
    }

    function backToFolders() {
        activeFolder = null;
        render();
    }

    function isCurrentUserAdmin() {
        var user = null;
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
            user = window.Telegram.WebApp.initDataUnsafe.user;
        } else if (window.KuyaB.tg && window.KuyaB.tg.initDataUnsafe && window.KuyaB.tg.initDataUnsafe.user) {
            user = window.KuyaB.tg.initDataUnsafe.user;
        }

        var adminId = window.KuyaB.ADMIN_ID || "";
        // If ADMIN_ID is unset or matches placeholder, default to true so you aren't locked out
        if (!adminId || adminId === "YOUR_TELEGRAM_USER_ID") {
            return true;
        }
        return user ? String(user.id) === String(adminId) : true;
    }

    function initFileInput() {
        var fileEl = document.getElementById("vaultItemFile");
        var nameLabel = document.getElementById("selectedFileName");
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

    async function render() {
        var titleEl = document.getElementById("vaultPageTitle");
        var otherBar = document.getElementById("otherActionsBar");
        var adminBtn = document.getElementById("btnAdminUpdater");
        var breadcrumbBar = document.getElementById("vaultFolderBreadcrumb");
        var activeHeader = document.getElementById("activeFolderHeader");
        var foldersContainer = document.getElementById("vaultFoldersContainer");
        var itemsContainer = document.getElementById("vaultItemsContainer");

        if (titleEl) {
            if (currentVaultType === "pictures") titleEl.innerText = "🖼️ Pictures";
            else if (currentVaultType === "videos") titleEl.innerText = "🎥 Videos";
            else titleEl.innerText = "📁 Other";
        }

        // Show 'Other' extra tools ONLY on root view of Other section
        if (otherBar) {
            if (currentVaultType === "other" && !activeFolder) {
                otherBar.style.display = "block";
                if (adminBtn) {
                    adminBtn.style.display = isCurrentUserAdmin() ? "flex" : "none";
                }
            } else {
                otherBar.style.display = "none";
            }
        }

        // Folder drilldown view setup
        if (activeFolder) {
            if (breadcrumbBar) breadcrumbBar.style.display = "flex";
            if (activeHeader) activeHeader.innerText = "📂 " + activeFolder;
            if (foldersContainer) foldersContainer.style.display = "none";
            if (itemsContainer) itemsContainer.style.display = "grid";
        } else {
            if (breadcrumbBar) breadcrumbBar.style.display = "none";
            if (foldersContainer) foldersContainer.style.display = "block";
            if (itemsContainer) itemsContainer.style.display = "none";
        }

        if (foldersContainer && !activeFolder) {
            foldersContainer.innerHTML = '<p class="empty-state">Loading folders...</p>';
        }
        if (itemsContainer && activeFolder) {
            itemsContainer.innerHTML = '<p class="empty-state">Loading folder items...</p>';
        }

        try {
            var res = await fetch("/api/vault/items?t=" + Date.now());
            var data = await res.json();
            var allItems = data.vault || [];

            // Filter for current vault category
            var filtered = allItems.filter(function (it) {
                if (currentVaultType === "pictures") return it.type === "pictures";
                if (currentVaultType === "videos") return it.type === "videos";
                return it.type !== "pictures" && it.type !== "videos";
            });

            // Group into folders
            var foldersMap = {};
            filtered.forEach(function (it) {
                var f = it.folder || "General";
                if (!foldersMap[f]) foldersMap[f] = [];
                foldersMap[f].push(it);
            });

            // STATE 1: Folders Directory View
            if (!activeFolder) {
                var folderNames = Object.keys(foldersMap);
                if (folderNames.length === 0) {
                    foldersContainer.innerHTML = '<p class="empty-state">No folders or items here yet. Tap + to upload!</p>';
                    return;
                }

                var fHtml = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px;">';
                folderNames.forEach(function (fName) {
                    var count = foldersMap[fName].length;
                    fHtml += '<div class="feature-card" data-action="open-folder" data-folder="' + encodeURIComponent(fName) + '" style="cursor: pointer; margin: 0; min-height: 90px; justify-content: center;">' +
                        '<div class="card-header" style="justify-content: center; gap: 6px;">' +
                            '<span class="card-icon" style="font-size: 1.4rem;">📂</span>' +
                            '<span class="card-title" style="font-size: 0.95rem;">' + fName + '</span>' +
                        '</div>' +
                        '<span class="card-desc" style="text-align: center; margin-top: 4px;">' + count + (count === 1 ? ' item' : ' items') + '</span>' +
                    '</div>';
                });
                fHtml += '</div>';
                foldersContainer.innerHTML = fHtml;
                return;
            }

            // STATE 2: Inside Folder View
            var folderItems = foldersMap[activeFolder] || [];
            if (folderItems.length === 0) {
                itemsContainer.innerHTML = '<p class="empty-state">Folder is empty.</p>';
                return;
            }

            var iHtml = "";
            folderItems.forEach(function (it) {
                var icon = it.type === "videos" ? "🎥" : (it.type === "pictures" ? "🖼️" : "📁");
                iHtml += '<div class="vault-card" data-action="view-vault" data-id="' + it.id + '" data-title="' + encodeURIComponent(it.title || "Media") + '" data-type="' + it.type + '" style="cursor: pointer;">' +
                    '<div class="vault-icon-preview">' + icon + '</div>' +
                    '<div class="vault-info">' +
                        '<div class="vault-title">' + (it.title || "Untitled") + '</div>' +
                        '<div class="vault-meta">' + (it.type || "file") + '</div>' +
                    '</div>' +
                    '<button type="button" class="btn-delete-card" data-action="delete-vault" data-id="' + it.id + '" onclick="event.stopPropagation();">🗑️</button>' +
                '</div>';
            });
            itemsContainer.innerHTML = iHtml;

        } catch (e) {
            if (foldersContainer) foldersContainer.innerHTML = '<p class="empty-state">Error loading items.</p>';
        }
    }

    function openMediaModal(id, title, type) {
        var modal = document.getElementById("mediaModal");
        var container = document.getElementById("modalMediaContainer");
        var titleEl = document.getElementById("modalMediaTitle");

        if (!modal || !container) return;

        titleEl.innerText = decodeURIComponent(title);
        container.innerHTML = '<div style="padding: 40px; color: #64748b;">Loading media...</div>';
        modal.style.display = "flex";

        var mediaUrl = "/api/vault/media-file?id=" + encodeURIComponent(id);

        if (type === "videos") {
            container.innerHTML = '<video controls autoplay playsinline style="max-width: 100%; max-height: 70vh; border-radius: 12px; background: #000;">' +
                '<source src="' + mediaUrl + '" type="video/mp4">' +
                'Your browser does not support the video tag.' +
            '</video>';
        } else {
            var img = new Image();
            img.style.maxWidth = "100%";
            img.style.maxHeight = "70vh";
            img.style.borderRadius = "12px";
            img.onload = function () {
                container.innerHTML = "";
                container.appendChild(img);
            };
            img.onerror = function () {
                container.innerHTML = '<div style="padding: 20px; color: #ef4444;">Failed to load image.</div>';
            };
            img.src = mediaUrl;
        }
    }

    async function deleteItem(id) {
        if (!confirm("Are you sure you want to delete this vault item?")) return;
        try {
            var res = await fetch("/api/vault/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: id })
            });
            var data = await res.json();
            if (data.success) {
                render();
            } else {
                alert("Delete failed: " + (data.error || "Unknown"));
            }
        } catch (err) {
            alert("Error communicating with backend");
        }
    }

    window.KuyaB.features.vault = {
        setVaultType: setVaultType,
        getActiveFolder: getActiveFolder,
        openFolder: openFolder,
        backToFolders: backToFolders,
        initFileInput: initFileInput,
        render: render,
        openMediaModal: openMediaModal,
        deleteItem: deleteItem,
        isCurrentUserAdmin: isCurrentUserAdmin
    };
})();
