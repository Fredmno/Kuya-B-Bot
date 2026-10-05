/* =========================================================
   KUYA B — MODULE: HELPERS & TELEGRAM INTEGRATION
   ========================================================= */

export const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

export function triggerHaptic(type = "light") {
    if (!tg?.HapticFeedback) return;
    if (type === "notification" || type === "success") {
        tg.HapticFeedback.notificationOccurred("success");
    } else if (type === "warning") {
        tg.HapticFeedback.notificationOccurred("warning");
    } else {
        tg.HapticFeedback.impactOccurred(type);
    }
}

export function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
