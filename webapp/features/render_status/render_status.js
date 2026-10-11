async function checkRenderDeploymentStatus() {
    const dot = document.getElementById("status-dot");
    const text = document.getElementById("status-text");
    const commitElem = document.getElementById("render-commit");

    try {
        const response = await fetch("/health");
        if (response.ok) {
            if (dot) {
                dot.className = "dot live";
            }
            if (text) {
                text.textContent = "Online (Render Live)";
            }
            if (commitElem) {
                commitElem.textContent = window.RENDER_GIT_COMMIT || "Active";
            }
        } else {
            throw new Error(`Status ${response.status}`);
        }
    } catch (error) {
        if (dot) {
            dot.className = "dot down";
        }
        if (text) {
            text.textContent = "Service Unreachable";
        }
        if (commitElem) {
            commitElem.textContent = "Offline";
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    checkRenderDeploymentStatus();
});
