/* =========================================================
   KUYA B — URL DOWNLOADER & CONTENT UPLOADER MODULE
   webapp/modules/url_loader.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};
    var addContentCurrentMode = "file";

    function getRouter() {
        return window.KuyaB.router || {};
    }

    function getFeatures() {
        return window.KuyaB.features || {};
    }

    window.KuyaB.switchAddContentMode = function (mode) {
        addContentCurrentMode = mode;
        var tabFile = document.getElementById("tabUploadFile");
        var tabLink = document.getElementById("tabDownloadLink");
        var secFile = document.getElementById("uploadFileSection");
        var secLink = document.getElementById("downloadLinkSection");
        var submitBtn = document.getElementById("btnSubmitAddContent");

        if (mode === "file") {
            if (tabFile) tabFile.className = "btn-soft save";
            if (tabLink) tabLink.className = "btn-soft cancel";
            if (secFile) secFile.style.display = "block";
            if (secLink) secLink.style.display = "none";
            if (submitBtn) submitBtn.innerText = "Upload Content";
        } else {
            if (tabFile) tabFile.className = "btn-soft cancel";
            if (tabLink) tabLink.className = "btn-soft save";
            if (secFile) secFile.style.display = "none";
            if (secLink) secLink.style.display = "block";
            if (submitBtn) submitBtn.innerText = "Download & Save ⬇️";
        }
    };

    window.KuyaB.pasteDownloadUrl = function () {
        var urlInput = document.getElementById("downloadMediaUrl");
        if (!urlInput) return;

        var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : (window.KuyaB.tg || null);
        if (tg && typeof tg.readTextFromClipboard === "function") {
            try {
                tg.readTextFromClipboard(function (text) {
                    if (text) urlInput.value = text.trim();
                });
                return;
            } catch (e) {}
        }

        if (navigator.clipboard && navigator.clipboard.readText) {
            navigator.clipboard.readText().then(function (text) {
                if (text) urlInput.value = text.trim();
            }).catch(function () {
                urlInput.focus();
            });
            return;
        }
        urlInput.focus();
    };

    window.KuyaB.submitAddContentAction = function () {
        if (addContentCurrentMode === "file") {
            window.KuyaB.submitNewContent();
        } else {
            window.KuyaB.submitDownloadLink();
        }
    };

    window.KuyaB.submitDownloadLink = async function () {
        var urlInput = document.getElementById("downloadMediaUrl");
        var titleInput = document.getElementById("newContentTitle");
        var folderInput = document.getElementById("newContentFolder");
        var submitBtn = document.getElementById("btnSubmitAddContent");
        var progressContainer = document.getElementById("uploadProgressContainer");
        var progressBar = document.getElementById("uploadProgressBar");
        var statusText = document.getElementById("uploadStatusText");
        var percentText = document.getElementById("uploadPercentText");

        var url = urlInput ? urlInput.value.trim() : "";
        if (!url) {
            alert("Please paste a link first.");
            return;
        }

        var folderName = folderInput ? folderInput.value.trim() || "Downloads" : "Downloads";
        var customTitle = titleInput ? titleInput.value.trim() : "";

        if (progressContainer) {
            progressContainer.style.display = "block";
            if (progressBar) progressBar.style.width = "75%";
            if (percentText) percentText.innerText = "Fetching...";
            if (statusText) statusText.innerText = "Downloading media from link...";
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "Downloading...";
        }

        try {
            var res = await fetch("/api/vault/download-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: url,
                    folder: folderName,
                    title: customTitle
                })
            });
            var data = await res.json();
            if (data.success && data.item) {
                if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("success");
                alert("Saved to Vault! 📁");

                if (urlInput) urlInput.value = "";
                if (titleInput) titleInput.value = "";
                if (folderInput) folderInput.value = "";
                if (progressContainer) progressContainer.style.display = "none";

                var feats = getFeatures();
                var r = getRouter();
                if (feats.vault) feats.vault.setVaultType(data.item.type);
                if (r.showPage) {
                    r.showPage("vaultPage", function () {
                        if (feats.vault && feats.vault.openFolder) feats.vault.openFolder(folderName);
                    });
                }
            } else {
                alert("Download failed: " + (data.error || "Could not fetch media."));
            }
        } catch (err) {
            alert("Network error processing link.");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "Download & Save ⬇️";
            }
            if (progressContainer) progressContainer.style.display = "none";
        }
    };

    window.KuyaB.submitNewContent = function () {
        var fileInput = document.getElementById("newContentFile");
        var titleInput = document.getElementById("newContentTitle");
        var folderInput = document.getElementById("newContentFolder");
        var sectionSelect = document.getElementById("newContentSection");
        var fileNameLabel = document.getElementById("newContentFileName");
        var submitBtn = document.getElementById("btnSubmitAddContent");

        var progressContainer = document.getElementById("uploadProgressContainer");
        var progressBar = document.getElementById("uploadProgressBar");
        var percentText = document.getElementById("uploadPercentText");
        var statusText = document.getElementById("uploadStatusText");

        if (!fileInput || !fileInput.files.length) {
            alert("Please choose a file to upload.");
            return;
        }

        var file = fileInput.files[0];
        var chosenSection = sectionSelect ? sectionSelect.value : "other";
        var isVideo = file.type.startsWith("video/");
        var mediaType = chosenSection === "other" ? (isVideo ? "videos" : "pictures") : chosenSection;
        var folderName = folderInput ? folderInput.value.trim() || "General" : "General";

        var formData = new FormData();
        formData.append("file", file);
        formData.append("title", titleInput ? titleInput.value.trim() || "Untitled" : "Untitled");
        formData.append("folder", folderName);
        formData.append("type", mediaType);

        if (progressContainer) {
            progressContainer.style.display = "block";
            if (progressBar) progressBar.style.width = "0%";
            if (percentText) percentText.innerText = "0%";
            if (statusText) statusText.innerText = isVideo ? "Uploading video..." : "Uploading file...";
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "Uploading (0%)...";
        }

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/vault/upload", true);

        xhr.upload.onprogress = function (e) {
            if (e.lengthComputable) {
                var percent = Math.round((e.loaded / e.total) * 100);
                if (progressBar) progressBar.style.width = percent + "%";
                if (percentText) percentText.innerText = percent + "%";
                if (submitBtn) submitBtn.innerText = "Uploading (" + percent + "%)...";

                if (percent === 100 && statusText) {
                    statusText.innerText = "Processing & saving to vault...";
                }
            }
        };

        xhr.onload = function () {
            if (submitBtn) submitBtn.disabled = false;
            try {
                var data = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                    if (window.KuyaB.triggerHaptic) window.KuyaB.triggerHaptic("success");
                    alert("Uploaded successfully! 📁");

                    if (titleInput) titleInput.value = "";
                    if (folderInput) folderInput.value = "";
                    if (fileInput) fileInput.value = "";
                    if (fileNameLabel) {
                        fileNameLabel.innerText = "No file chosen";
                        fileNameLabel.style.color = "#64748b";
                    }
                    if (progressContainer) progressContainer.style.display = "none";
                    if (submitBtn) submitBtn.innerText = "Upload Content";

                    var feats = getFeatures();
                    var r = getRouter();
                    if (feats.vault) feats.vault.setVaultType(mediaType);
                    if (r.showPage) {
                        r.showPage("vaultPage", function () {
                            if (feats.vault && feats.vault.openFolder) feats.vault.openFolder(folderName);
                        });
                    }
                } else {
                    alert("Upload failed: " + (data.error || "Server error"));
                    if (submitBtn) submitBtn.innerText = "Upload Content";
                }
            } catch (err) {
                alert("Error parsing server response.");
                if (submitBtn) submitBtn.innerText = "Upload Content";
            }
        };

        xhr.onerror = function () {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "Upload Content";
            }
            alert("Network error uploading file.");
        };

        xhr.send(formData);
    };
})();
