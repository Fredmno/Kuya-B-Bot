/* =========================================================
   KUYA B — FEATURE: VAULT WITH FOLDER-FIRST NAVIGATION
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};

    var vaultItems = [];
    var currentVaultType = "other";
    var activeFolder = null; // null = Folders Directory; String = Inside a specific folder

    function setVaultType(type) {
        currentVaultType = type;
        activeFolder = null; // Reset folder drilldown upon navigation
        updateTitles();

        var otherActions = document.getElementById("otherActionsBar");
        if (otherActions) {
            var isAdmin = window.KuyaB.features.tracking && window.KuyaB.features.tracking.isAdmin();
            otherActions.style.display = (type === "other" && isAdmin) ? "block" : "none";
        }
    }

    function updateTitles() {
        var titleEl = document.getElementById("vaultPageTitle");
        if (!titleEl) return;

        if (currentVaultType === "videos") {
            titleEl.innerText = activeFolder ? "🎥 " + activeFolder : "🎥 Videos";
        } else if (currentVaultType === "pictures") {
            titleEl.innerText = activeFolder ? "🖼️ " + activeFolder : "🖼️ Pictures";
        } else {
            titleEl.innerText = activeFolder ? "📁 " + activeFolder : "📁 Other";
        }
    }

    async function fetchVaultItems() {
        try {
            var res = await fetch("/api/vault/items");
            var data = await res.json();
            vaultItems = data.vault || [];
        } catch (e) {
            vaultItems = [];
        }
    }

    // ---------------------------------------------------------
    // RENDER CONTROLLER
    // ---------------------------------------------------------
    async function renderVault() {
        await fetchVaultItems();

        if (activeFolder === null) {
            displayFoldersView();
        } else {
            displayFolderItemsView();
        }
    }

    // 1. Show Folder Grid/Cards
    function displayFoldersView() {
        var foldersContainer = document.getElementById("vaultFoldersContainer");
        var itemsContainer = document.getElementById("vaultItemsContainer");
        var breadcrumb = document.getElementById("vaultFolderBreadcrumb");

        if (breadcrumb) breadcrumb.style.display = "none";
        if (itemsContainer) itemsContainer.style.display = "none";
        if (foldersContainer) foldersContainer.style.display = "block";

        updateTitles();

        var filtered = vaultItems.filter(function (item) {
            return (item.type || "other") === currentVaultType;
        });

        if (filtered.length === 0) {
            foldersContainer.innerHTML = '<p class="empty-state">No folders or items here yet. Tap + to upload!</p>';
            return;
        }

        // Group media count by folder
        var folderCounts = {};
        for (var i = 0; i < filtered.length; i++) {
            var fName = (filtered[i].folder || "General").trim();
            folderCounts[fName] = (folderCounts[fName] || 0) + 1;
        }

        var folderNames = Object.keys(folderCounts).sort();
        var html = "";

        for (var j = 0; j < folderNames.length; j++) {
            var name = folderNames[j];
            var count = folderCounts[name];
            var itemWord = count === 1 ? "item" : "items";

            html += '<div class="feature-card-full" data-action="open-folder" data-folder="' + encodeURIComponent(name) + '" style="margin: 0 0 12px 0;">' +
                '<div class="card-left">' +
                    '<span class="card-icon" style="font-size: 1.5rem;">📁</span>' +
                    '<div>' +
                        '<div class="card-title">' + name + '</div>' +
                        '<div class="card-desc">' + count + ' ' + itemWord + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="card-arrow">›</div>' +
            '</div>';
        }

        foldersContainer.innerHTML = html;
    }

    // 2. Show Files Inside Selected Folder
    function displayFolderItemsView() {
        var foldersContainer = document.getElementById("vaultFoldersContainer");
        var itemsContainer = document.getElementById("vaultItemsContainer");
        var breadcrumb = document.getElementById("vaultFolderBreadcrumb");
        var activeHeader = document.getElementById("activeFolderHeader");

        if (foldersContainer) foldersContainer.style.display = "none";
        if (breadcrumb) breadcrumb.style.display = "flex";
        if (itemsContainer) itemsContainer.style.display = "block";
        if (activeHeader) activeHeader.innerText = "📁 " + activeFolder;

        updateTitles();

        var filtered = vaultItems.filter(function (item) {
            var itemType = item.type || "other";
            var itemFolder = (item.folder || "General").trim();
            return itemType === currentVaultType && itemFolder.toLowerCase() === activeFolder.toLowerCase();
        });

        if (filtered.length === 0) {
            itemsContainer.innerHTML = '<p class="empty-state">No media left in this folder.</p>';
            return;
        }

        var html = "";
        for (var j = 0; j < filtered.length; j++) {
            var item = filtered[j];

            html += '<div class="birthday-card" data-id="' + item.id + '">' +
                '<div class="birthday-info">' +
                    '<div class="birthday-title-row">' +
                        '<span class="birthday-name">' + (item.title || "Untitled") + '</span>' +
                    '</div>' +
                    '<span class="birthday-date">📁 ' + (item.type === "videos" ? "Video" : "Photo") + '</span>' +
                '</div>' +
                '<div class="birthday-actions">' +
                    '<button type="button" class="btn-greet" data-action="view-vault" data-id="' + item.id + '" data-type="' + (item.type || "pictures") + '" data-title="' + (item.title || "Media") + '">View 👁️</button>' +
                    '<button type="button" class="btn-delete" data-action="delete-vault" data-id="' + item.id + '">🗑️</button>' +
                '</div>' +
            '</div>';
        }

        itemsContainer.innerHTML = html;
    }

    function openFolder(folderName) {
        activeFolder = folderName;
        window.KuyaB.triggerHaptic("light");
        displayFolderItemsView();
    }

    function backToFolders() {
        activeFolder = null;
        window.KuyaB.triggerHaptic("light");
        displayFoldersView();
    }

    // ---------------------------------------------------------
    // LIGHTBOX MODAL
    // ---------------------------------------------------------
    function openMediaModal(itemId, title, mediaType) {
        var modal = document.getElementById("mediaViewerModal");
        var img = document.getElementById("mediaModalImage");
        var vid = document.getElementById("mediaModalVideo");
        var spinner = document.getElementById("mediaLoadingSpinner");
        var titleEl = document.getElementById("mediaModalTitle");

        if (!modal) return;

        titleEl.innerText = title || "View Media";
        img.style.display = "none";
        vid.style.display = "none";
        vid.pause();
        spinner.style.display = "block";
        spinner.innerText = "Loading media...";
        modal.style.display = "flex";

        var streamUrl = "/api/vault/media-file?id=" + encodeURIComponent(itemId);

        if (mediaType === "videos") {
            vid.src = streamUrl;
            vid.oncanplay = function () {
                spinner.style.display = "none";
                vid.style.display = "block";
            };
            vid.onerror = function () {
                spinner.innerText = "Could not preview this video in Mini App.";
            };
        } else {
            img.src = streamUrl;
            img.onload = function () {
                spinner.style.display = "none";
                img.style.display = "block";
            };
            img.onerror = function () {
                spinner.innerText = "Could not preview this image in Mini App.";
            };
        }
    }

    function closeMediaModal() {
        var modal = document.getElementById("mediaViewerModal");
        var img = document.getElementById("mediaModalImage");
        var vid = document.getElementById("mediaModalVideo");
        if (modal) modal.style.display = "none";
        if (img) img.src = "";
        if (vid) {
            vid.pause();
            vid.src = "";
        }
    }

    // ---------------------------------------------------------
    // FILE UPLOAD & MANAGEMENT
    // ---------------------------------------------------------
    async function uploadMedia() {
        var fileInput = document.getElementById("vaultItemFile");
        var titleInput = document.getElementById("vaultItemTitle");
        var folderInput = document.getElementById("vaultItemFolder");
        var fileNameLabel = document.getElementById("selectedFileName");

        if (!fileInput || !fileInput.files.length) {
            alert("Please select a photo or video to upload.");
            return;
        }

        var file = fileInput.files[0];
        var isVideo = file.type.startsWith("video/");
        var determinedType = currentVaultType === "other" ? (isVideo ? "videos" : "pictures") : currentVaultType;
        var chosenFolder = (folderInput.value.trim() || activeFolder || "General");

        var formData = new FormData();
        formData.append("file", file);
        formData.append("title", titleInput.value.trim() || "Untitled");
        formData.append("folder", chosenFolder);
        formData.append("type", determinedType);

        var btn = document.getElementById("btnUploadMedia");
        if (btn) btn.innerText = "Uploading...";

        try {
            var res = await fetch("/api/vault/upload", {
                method: "POST",
                body: formData
            });
            var data = await res.json();
            if (data.success) {
                window.KuyaB.triggerHaptic("success");
                window.KuyaB.showToast("Uploaded to Vault Channel! 📁");
                if (titleInput) titleInput.value = "";
                if (folderInput) folderInput.value = "";
                if (fileInput) fileInput.value = "";
                if (fileNameLabel) {
                    fileNameLabel.innerText = "No file chosen";
                    fileNameLabel.style.color = "#64748b";
                }
                document.getElementById("vaultUploadForm").style.display = "none";
                renderVault();
            } else {
                alert("Upload failed: " + (data.error || "Server error"));
            }
        } catch (err) {
            alert("Network error communicating with Kuya B backend.");
        } finally {
            if (btn) btn.innerText = "Upload";
        }
    }

    async function deleteItem(id) {
        if (!confirm("Delete media from vault and channel?")) return;
        try {
            await fetch("/api/vault/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: id })
            });
            renderVault();
        } catch (e) {
            window.KuyaB.showToast("Failed to delete media.");
        }
    }

    function initFileInput() {
        var fileInputEl = document.getElementById("vaultItemFile");
        var fileNameLabel = document.getElementById("selectedFileName");
        if (fileInputEl && fileNameLabel) {
            fileInputEl.addEventListener("change", function () {
                if (this.files && this.files.length > 0) {
                    fileNameLabel.innerText = this.files[0].name;
                    fileNameLabel.style.color = "#1e293b";
                } else {
                    fileNameLabel.innerText = "No file chosen";
                    fileNameLabel.style.color = "#64748b";
                }
            });
        }
    }

    // Export module functions
    window.KuyaB.features.vault = {
        setVaultType: setVaultType,
        render: renderVault,
        openFolder: openFolder,
        backToFolders: backToFolders,
        getActiveFolder: function () { return activeFolder; },
        uploadMedia: uploadMedia,
        deleteItem: deleteItem,
        openMediaModal: openMediaModal,
        closeMediaModal: closeMediaModal,
        initFileInput: initFileInput
    };

    window.KuyaB.uploadMediaToVault = uploadMedia;
    window.KuyaB.closeMediaModal = closeMediaModal;
})();
