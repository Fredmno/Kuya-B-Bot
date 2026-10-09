/* =========================================================
   KUYA B — FEATURE: VAULT (PICTURES, VIDEOS, OTHER)
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};

    var currentVaultType = "pictures"; 
    var activeFolder = null; 

    function setVaultType(type) {
        currentVaultType = type || "pictures";
        activeFolder = null;
    }

    function getCurrentVaultType() {
        return currentVaultType;
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

        if (activeFolder) {
            if (breadcrumbBar) breadcrumbBar.style.display = "flex";
            if (activeHeader) activeHeader.innerText = "📂 " + activeFolder;
            if (foldersContainer) foldersContainer.style.display = "none";
            if (itemsContainer) itemsContainer.style.display = "flex";
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

            var filtered = allItems.filter(function (it) {
                if (currentVaultType === "pictures") return it.type === "pictures";
                if (currentVaultType === "videos") return it.type === "videos";
                return it.type !== "pictures" && it.type !== "videos";
            });

            var foldersMap = {};
            filtered.forEach(function (it) {
                var f = it.folder || "General";
                if (!foldersMap[f]) foldersMap[f] = [];
                foldersMap[f].push(it);
            });

            // Folders Directory View
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

            // Inside Folder View
            var folderItems = foldersMap[activeFolder] || [];
            if (folderItems.length === 0) {
                itemsContainer.innerHTML = '<p class="empty-state">Folder is empty. Tap + above to add files!</p>';
                return;
            }

            var iHtml = "";
            folderItems.forEach(function (it) {
                var icon = it.type === "videos" ? "🎥" : (it.type === "pictures" ? "🖼️" : "📁");
                var displayTitle = it.title || "Untitled";
                var typeLabel = it.type === "videos" ? "Video file" : (it.type === "pictures" ? "Image file" : "File");

                iHtml += '<div class="feature-card-full" data-action="view-vault" data-id="' + it.id + '" data-title="' + encodeURIComponent(displayTitle) + '" data-type="' + it.type + '" style="' +
                    'width: 100%; ' +
                    'margin: 0; ' +
                    'box-sizing: border-box; ' +
                    'display: flex; ' +
                    'align-items: center; ' +
                    'justify-content: space-between; ' +
                    'cursor: pointer; ' +
                    'padding: 12px 16px;' +
                '">' +
                    '<div class="card-left" style="display: flex; align-items: center; gap: 14px; text-align: left; overflow: hidden;">' +
                        '<span class="card-icon" style="font-size: 1.5rem; flex-shrink: 0;">' + icon + '</span>' +
                        '<div style="text-align: left; overflow: hidden;">' +
                            '<div class="card-title" style="font-weight: 700; font-size: 0.95rem; color: #1e293b; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + displayTitle + '</div>' +
                            '<div class="card-desc" style="font-size: 0.8rem; color: #64748b; text-align: left; margin-top: 2px;">' + typeLabel + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<button type="button" class="btn-icon-back" data-action="delete-vault" data-id="' + it.id + '" title="Delete item" style="' +
                        'width: 36px; ' +
                        'height: 36px; ' +
                        'flex-shrink: 0; ' +
                        'font-size: 0.9rem; ' +
                        'border-radius: 10px; ' +
                        'box-shadow: 2px 2px 5px #cad5e2, -2px -2px 5px #ffffff;' +
                    '" onclick="event.stopPropagation();">🗑️</button>' +
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

        titleEl.innerText = decodeURIComponent(title || "Media");
        container.innerHTML = '<div style="padding: 40px; color: #94a3b8; font-size: 0.9rem;">Buffering video...</div>';
        modal.style.display = "flex";

        var mediaUrl = "/api/vault/media-file?id=" + encodeURIComponent(id) + "&t=" + Date.now();

        if (type === "videos") {
            container.innerHTML = 
                '<video controls autoplay playsinline webkit-playsinline preload="metadata" style="width: 100%; max-height: 75vh; border-radius: 12px; background: #000; outline: none;">' +
                    '<source src="' + mediaUrl + '" type="video/mp4">' +
                    '<source src="' + mediaUrl + '" type="video/quicktime">' +
                    '<source src="' + mediaUrl + '" type="video/webm">' +
                    'Your device cannot play this video format.' +
                '</video>';
        } else {
            var img = new Image();
            img.style.maxWidth = "100%";
            img.style.maxHeight = "75vh";
            img.style.borderRadius = "12px";
            img.onload = function () {
                container.innerHTML = "";
                container.appendChild(img);
            };
            img.onerror = function () {
                container.innerHTML = '<div style="padding: 24px; color: #ef4444; font-size: 0.9rem;">Failed to load image.</div>';
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
        getCurrentVaultType: getCurrentVaultType,
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
