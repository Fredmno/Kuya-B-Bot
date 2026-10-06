/* =========================================================
   KUYA B — BIRTHDAYS MODULE
   ========================================================= */

import { triggerHaptic, showToast } from "./helpers.js";

let birthdays = [];

export function loadBirthdays() {
    try {
        const stored = localStorage.getItem("kuyaB_birthdays");
        birthdays = stored ? JSON.parse(stored) : [];
    } catch (e) {
        birthdays = [];
    }
}

export function showBirthdayForm() {
    const form = document.getElementById("birthdayForm");
    if (form) {
        form.style.display = "block";
        const nameInput = document.getElementById("birthdayName");
        if (nameInput) nameInput.focus();
    }
}

export function hideBirthdayForm() {
    const form = document.getElementById("birthdayForm");
    if (form) {
        form.style.display = "none";
        document.getElementById("birthdayName").value = "";
        document.getElementById("birthdayDate").value = "";
    }
}

export function saveBirthday() {
    const nameInput = document.getElementById("birthdayName");
    const dateInput = document.getElementById("birthdayDate");

    const name = nameInput.value.trim();
    const date = dateInput.value.trim();

    if (!name) {
        alert("Please enter a name.");
        return;
    }

    if (!/^\d{2}-\d{2}$/.test(date)) {
        alert("Please enter a valid date in MM-DD format (e.g. 05-24).");
        return;
    }

    const newBirthday = {
        id: Date.now().toString(),
        name: name,
        date: date
    };

    birthdays.push(newBirthday);
    localStorage.setItem("kuyaB_birthdays", JSON.stringify(birthdays));

    triggerHaptic("medium");
    hideBirthdayForm();
    displayBirthdays();
}

export function deleteBirthday(id) {
    birthdays = birthdays.filter(b => b.id !== id);
    localStorage.setItem("kuyaB_birthdays", JSON.stringify(birthdays));
    triggerHaptic("medium");
    displayBirthdays();
}

export async function sendBirthdayGreeting(name) {
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get("chat_id");

    if (!chatId) {
        showToast("Open this via /kuyab in a group chat to send greetings!");
        return;
    }

    triggerHaptic("medium");

    try {
        const response = await fetch("/api/birthdays/greet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, name: name })
        });

        const data = await response.json();
        if (data.success) {
            showToast(`Greeting sent for ${name}! 🎉`);
        } else {
            showToast("Failed to send greeting.");
        }
    } catch (e) {
        showToast("Network error sending greeting.");
    }
}

function calculateDaysLeft(dateStr) {
    const [month, day] = dateStr.split("-").map(Number);
    const today = new Date();
    const currentYear = today.getFullYear();

    let nextBirthday = new Date(currentYear, month - 1, day);
    if (nextBirthday < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        nextBirthday = new Date(currentYear + 1, month - 1, day);
    }

    const diffTime = nextBirthday - new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function displayBirthdays() {
    const listContainer = document.getElementById("birthdaysList");
    if (!listContainer) return;

    if (birthdays.length === 0) {
        listContainer.innerHTML = '<p class="empty-state">No birthdays saved yet. Tap + to add one!</p>';
        return;
    }

    // Sort by nearest upcoming
    const sorted = [...birthdays].sort((a, b) => {
        return calculateDaysLeft(a.date) - calculateDaysLeft(b.date);
    });

    listContainer.innerHTML = sorted.map(b => {
        const daysLeft = calculateDaysLeft(b.date);
        let badge = "";
        if (daysLeft === 0) {
            badge = '<span class="bday-badge today">🎉 Today!</span>';
        } else if (daysLeft === 1) {
            badge = '<span class="bday-badge tomorrow">Tomorrow</span>';
        } else {
            badge = `<span class="bday-badge">${daysLeft} days left</span>`;
        }

        return `
            <div class="birthday-card" data-id="${b.id}">
                <div class="birthday-info">
                    <div class="birthday-title-row">
                        <span class="birthday-name">${b.name}</span>
                        ${badge}
                    </div>
                    <span class="birthday-date">📅 ${b.date}</span>
                </div>
                <div class="birthday-actions">
                    <button class="btn-greet" data-name="${b.name}" title="Send greeting to chat">📢 Greet</button>
                    <button class="btn-delete" data-id="${b.id}" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    }).join("");

    // Hook up Greet buttons
    listContainer.querySelectorAll(".btn-greet").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            sendBirthdayGreeting(btn.dataset.name);
        });
    });

    // Hook up Delete buttons
    listContainer.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm("Delete this birthday?")) {
                deleteBirthday(btn.dataset.id);
            }
        });
    });
}
