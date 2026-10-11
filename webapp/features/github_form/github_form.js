/* =========================================================
   KUYA B — SINGLE JSON BOX GITHUB FORM CONTROLLER
   webapp/features/github_form/github_form.js
   ========================================================= */

(function () {
    "use strict";

    window.KuyaB = window.KuyaB || {};

    function triggerHaptic(type) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type || "light");
        }
    }

    async function safeFetchJson(url, options = {}) {
        try {
            const res = await fetch(url, options);
            const text = await res.text();
            let data = {};
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = { error: text.slice(0, 150) || `HTTP ${res.status}` };
            }
            return { res, data, status: res.status };
        } catch (err) {
            return { res: { ok: false }, data: { error: err.message }, status: 0 };
        }
    }

    window.openGitHubFormView = function () {
        triggerHaptic("light");
        const adminView = document.getElementById("admin-panel-view");
        if (adminView) adminView.style.display = "none";

        const dashboardView = document.getElementById("dashboard-view");
        if (dashboardView) dashboardView.style.display = "none";

        const formView = document.getElementById("githubFormPage");
        if (formView) {
            formView.style.display = "block";
        }
    };

    window.closeGitHubFormView = function () {
        triggerHaptic("light");
        const formView = document.getElementById("githubFormPage");
        if (formView) formView.style.display = "none";

        const adminView = document.getElementById("admin-panel-view");
        if (adminView) {
            adminView.style.display = "block";
            return;
        }

        const dashboard = document.getElementById("dashboard-view");
        if (dashboard) dashboard.style.display = "block";
    };

    window.KuyaB.clearGitHubFormContent = function () {
        triggerHaptic("light");
        const input = document.getElementById("githubCommitContentInput");
        const statusEl = document.getElementById("githubFileLoadStatus");
        if (input) input.value = "";
        if (statusEl) statusEl.innerText = "";
    };

    window.KuyaB.pasteGitHubFormContent = async function () {
        triggerHaptic("light");
        const input = document.getElementById("githubCommitContentInput");
        try {
            const text = await navigator.clipboard.readText();
            if (input && text) {
                input.value = text;
                parsePayloadPreview();
            }
        } catch (err) {
            alert("Clipboard permission not granted. Please paste directly into the box.");
        }
    };

    function cleanJsonString(raw) {
        let text = (raw || "").trim();
        if (text.startsWith("```")) {
            const lines = text.split("\n");
            if (lines[0].startsWith("```")) lines.shift();
            if (lines.length && lines[lines.length - 1].startsWith("```")) lines.pop();
            text = lines.join("\n").trim();
        }
        return text;
    }

    function parsePayloadPreview() {
        const input = document.getElementById("githubCommitContentInput");
        const statusEl = document.getElementById("githubFileLoadStatus");
        if (!input || !statusEl) return null;

        const cleaned = cleanJsonString(input.value);
        if (!cleaned.startsWith("{")) {
            statusEl.innerText = "";
            return null;
        }

        try {
            const parsed = JSON.parse(cleaned);
            const targetPath = parsed.path || parsed.file_path || "";
            if (targetPath) {
                statusEl.innerText = `✓ Target: ${targetPath}`;
                return parsed;
            }
        } catch (e) {
            statusEl.innerText = "⚠️ Invalid JSON format";
        }
        return null;
    }

    window.KuyaB.submitGitHubFormCommit = async function () {
        const input = document.getElementById("githubCommitContentInput");
        const btn = document.getElementById("btnSubmitGitHubForm");
        const rawContent = input ? input.value : "";
        const cleaned = cleanJsonString(rawContent);

        if (!cleaned) {
            alert("Please paste a JSON payload into the box.");
            return;
        }

        let parsed = null;
        try {
            parsed = JSON.parse(cleaned);
        } catch (e) {
            alert("Could not parse JSON. Please check for missing braces or syntax errors:\n" + e.message);
            return;
        }

        const filePath = (parsed.path || parsed.file_path || "").trim();
        const commitMsg = (parsed.message || parsed.commit_message || `Update ${filePath}`).trim();
        const content = parsed.content !== undefined ? parsed.content : "";

        if (!filePath) {
            alert("JSON is missing target file 'path'. Example:\n{\n  \"path\": \"webapp/core/routes.py\",\n  \"content\": \"...\"\n}");
            return;
        }

        triggerHaptic("medium");
        const originalText = btn ? btn.innerText : "Push to GitHub 🚀";
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Submitting to GitHub...";
        }

        const payload = JSON.stringify({
            file_path: filePath,
            path: filePath,
            commit_message: commitMsg,
            message: commitMsg,
            content: content
        });

        const endpoints = [
            "/api/commit-file",
            "/api/commit",
            "/app/api/commit-file",
            "/app/api/commit"
        ];

        let success = false;
        let resultMsg = "";

        for (const ep of endpoints) {
            const { res, data } = await safeFetchJson(ep, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload
            });

            if (res.ok && data.ok) {
                success = true;
                resultMsg = data.message || `Committed ${filePath} (${data.sha || 'ok'})`;
                break;
            } else if (res.status !== 404 && res.status !== 0) {
                resultMsg = data.error || `HTTP ${res.status}`;
                break;
            }
        }

        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }

        if (success) {
            triggerHaptic("heavy");
            alert(`🚀 ${resultMsg}\n\nRender deployment initiated.`);
            window.closeGitHubFormView();
        } else {
            alert("Push failed: " + (resultMsg || "Could not reach commit endpoint"));
        }
    };

    function bindEvents() {
        const input = document.getElementById("githubCommitContentInput");
        if (input) {
            input.addEventListener("input", parsePayloadPreview);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindEvents);
    } else {
        bindEvents();
    }
})();
