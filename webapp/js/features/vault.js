/* =========================================================
   KUYA B — FEATURE: VAULT & MEDIA LIGHTBOX
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    window.KuyaB.features = window.KuyaB.features || {};

    var vaultItems = [];
    var currentVaultType = "other";

    function setVaultType(type) {
        currentVaultType = type;
        var titleEl = document.getElementById("vaultPageTitle");
        var otherActions = document.getElementById("otherActionsBar");

        if (otherActions) {
            var isAdmin = window.KuyaB.features.tracking && window.KuyaB.features.tracking.isAdmin();
            otherActions.style.display = (type === "other" && isAdmin) ? "block" : "none";
        }

        if (titleEl) {
            if (type === "videos") titleEl.innerText = "🎥 Videos";
            else if (type === "pictures") titleEl.innerText = "🖼️ Pictures";
            else titleEl.innerText = "📁 Other";
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

    async function displayVaultItems() {
        var list = document.getElementById("vaultItemsList");
        if (!list) return;

        await fetchVaultItems();

        var filtered = [];
        for (var i = 0; i < vaultItems.length; i++) {
            if ((vaultItems[i].type || "other") === currentVaultType) filtered.push(vaultItems[i]);
        }

        if (filtered.length === 0) {
            list.innerHTML = '<p class="empty-state">No items saved in this section yet. Tap + to upload!</p>';
            return;
        }

        var html = "";
        for (var j = 0; j < filtered.length; j++) {
            var item = filtered[j];

            html += '<div class="birthday-card" data-id="' + item.id + '">' +
                '<div class="birthday-info">' +
                    '<div class="birthday-title-row">' +
                        '<span class="birthday-name">' + (item.title || "Untitled") + '</span>' +
                        '<span class="bday-badge-days">' + (item.folder || "General") + '</span>' +
                    '</div>' +
                    '<span class="birthday-date">📁 ' + (item.type === "videos" ? "Video" : "Photo") + '</span>' +
                '</div>' +
                '<div class="birthday-actions">' +
                    '<button type="button" class="btn-greet" data-action="view-vault" data-id="' + item.id + '" data-type="' + (item.type || "pictures") + '" data-title="' + (item.title || "Media") + '">View 👁️</button>' +
                    '<button type="button" class="btn-delete" data-action="delete-vault" data-id="' + item.id + '">🗑️</button>' +
                '</div>' +
            '</div>';
        }
        list.innerHTML = html;
    }

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

        var formData = new FormData();
        formData.append("file", file);
        formData.append("title", titleInput.value.trim() || "Untitled");
        formData.append("folder", folderInput.value.trim() || "General");
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
                displayVaultItems();
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
            displayVaultItems();
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

    // Export module
    window.KuyaB.features.vault = {
        setVaultType: setVaultType,
        render: displayVaultItems,
        uploadMedia: uploadMedia,
        deleteItem: deleteItem,
        openMediaModal: openMediaModal,
        closeMediaModal: closeMediaModal,
        initFileInput: initFileInput
    };

    // Backward compatibility bridges
    window.KuyaB.uploadMediaToVault = uploadMedia;
    window.KuyaB.openMediaModal = openMediaModal;
    window.KuyaB.closeMediaModal = closeMediaModal;
})();
