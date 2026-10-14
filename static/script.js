"use strict";

const chatForm = document.getElementById("chat-form");
const questionInput = document.getElementById("question");
const sendButton = document.getElementById("send-button");
const messagesContainer = document.getElementById("messages");
const welcomeSection = document.getElementById("welcome");
const errorMessage = document.getElementById("error-message");

const HISTORY_KEY = "medibot_conversation_v1";
const MAX_HISTORY_ITEMS = 100;
let isSending = false;
let conversation = [];

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
}

function clearError() {
    errorMessage.textContent = "";
    errorMessage.hidden = true;
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function saveConversation() {
    try {
        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(conversation.slice(-MAX_HISTORY_ITEMS))
        );
    } catch {
        showError("Conversation could not be saved in this browser.");
    }
}

function addMessage(role, text) {
    const message = createElement("article", `message ${role}`);
    const avatar = createElement(
        "div", "message-avatar", role === "user" ? "U" : "+"
    );
    avatar.setAttribute("aria-hidden", "true");

    const content = createElement("div", "message-content");
    const label = createElement(
        "div", "message-label", role === "user" ? "YOU" : "MEDIBOT"
    );
    const bubble = createElement("div", "message-bubble", text);

    content.append(label, bubble);
    message.append(avatar, content);
    messagesContainer.appendChild(message);

    return { message, content, bubble };
}

function addSources(parent, sources) {
    if (!Array.isArray(sources) || sources.length === 0) return;

    const section = createElement("section", "sources");
    section.appendChild(createElement("h3", "", "Evidence explorer"));

    sources.forEach((source, index) => {
        const item = createElement("details", "source-item");
        const page = source.page_label ?? source.page;
        const title = typeof source.source === "string"
            ? source.source : "Unknown source";
        const pageText = page !== undefined && page !== null
            ? ` · Page ${String(page)}` : "";

        const summary = createElement(
            "summary", "source-summary",
            `${index + 1}. ${title}${pageText}`
        );
        item.appendChild(summary);

        if (typeof source.excerpt === "string" && source.excerpt.length) {
            item.appendChild(createElement("p", "source-excerpt", source.excerpt));
        } else {
            item.appendChild(createElement(
                "p", "source-excerpt", "No excerpt is available."
            ));
        }

        item.appendChild(createElement(
            "small", "evidence-note",
            "Retrieved reference passage; verify the context before drawing conclusions."
        ));
        section.appendChild(item);
    });

    parent.appendChild(section);
}

function addCopyButton(parent, text) {
    const button = createElement("button", "message-action", "Copy answer");
    button.type = "button";
    button.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(text);
            button.textContent = "Copied!";
        } catch {
            const area = document.createElement("textarea");
            area.value = text;
            area.setAttribute("readonly", "");
            area.style.position = "absolute";
            area.style.left = "-9999px";
            document.body.appendChild(area);
            area.select();
            const copied = document.execCommand("copy");
            area.remove();
            button.textContent = copied ? "Copied!" : "Copy unavailable";
        }

        window.setTimeout(() => {
            button.textContent = "Copy answer";
        }, 1800);
    });

    parent.appendChild(button);
}

function renderAssistantMessage(entry) {
    const result = addMessage("assistant", entry.text);
    addCopyButton(result.content, entry.text);
    addSources(result.content, entry.sources);
}

function renderConversation() {
    messagesContainer.replaceChildren();

    conversation.forEach((entry) => {
        if (entry.role === "user") {
            addMessage("user", entry.text);
        } else if (entry.role === "assistant") {
            renderAssistantMessage(entry);
        }
    });

    welcomeSection.hidden = conversation.length > 0;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function loadConversation() {
    try {
        const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        if (Array.isArray(saved)) {
            conversation = saved.filter((entry) =>
                entry &&
                (entry.role === "user" || entry.role === "assistant") &&
                typeof entry.text === "string"
            ).slice(-MAX_HISTORY_ITEMS);
        }
    } catch {
        conversation = [];
    }

    renderConversation();
}

function exportConversation() {
    if (!conversation.length) {
        showError("There is no conversation to export yet.");
        return;
    }

    const content = [
        "Medibot — Medical Information Conversation",
        "Educational information only; not a diagnosis or treatment plan.",
        "",
        ...conversation.map((entry) =>
            `${entry.role === "user" ? "YOU" : "MEDIBOT"}:\n${entry.text}\n`
        )
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `medibot-conversation-${new Date()
        .toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function createConversationToolbar() {
    const toolbar = createElement("div", "conversation-toolbar");
    const title = createElement("span", "toolbar-title", "Conversation tools");
    const exportButton = createElement("button", "toolbar-button", "Export chat");
    const clearButton = createElement("button", "toolbar-button", "Clear chat");

    exportButton.type = "button";
    clearButton.type = "button";

    exportButton.addEventListener("click", exportConversation);
    clearButton.addEventListener("click", () => {
        if (!conversation.length) return;
        if (!window.confirm("Clear this conversation from this browser?")) return;

        conversation = [];
        try {
            localStorage.removeItem(HISTORY_KEY);
        } catch {
            // Clearing the visible conversation still works if storage is unavailable.
        }
        renderConversation();
        clearError();
    });

    toolbar.append(title, exportButton, clearButton);
    messagesContainer.parentNode.insertBefore(toolbar, messagesContainer);
}

function addLoadingIndicator() {
    const result = addMessage("assistant", "");
    const typing = createElement("div", "typing");
    typing.setAttribute("role", "status");
    typing.setAttribute("aria-label", "Medibot is preparing an answer");

    for (let i = 0; i < 3; i += 1) {
        typing.appendChild(document.createElement("span"));
    }

    result.bubble.appendChild(typing);
    return result.message;
}

async function sendQuestion(question) {
    if (isSending) return;

    isSending = true;
    clearError();
    welcomeSection.hidden = true;

    conversation.push({ role: "user", text: question });
    conversation = conversation.slice(-MAX_HISTORY_ITEMS);
    saveConversation();
    addMessage("user", question);

    const loadingMessage = addLoadingIndicator();
    sendButton.disabled = true;
    questionInput.disabled = true;

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ question })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.error || `The request failed (HTTP ${response.status}).`
            );
        }

        loadingMessage.remove();

        const answer = typeof data.answer === "string" && data.answer.trim()
            ? data.answer
            : "No answer was returned. Please try asking another question.";

        const sources = Array.isArray(data.sources) ? data.sources : [];
        const entry = { role: "assistant", text: answer, sources };

        conversation.push(entry);
        conversation = conversation.slice(-MAX_HISTORY_ITEMS);
        saveConversation();

        renderAssistantMessage(entry);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        loadingMessage.remove();

        // Do not leave an unanswered user turn in persistent history.
        const last = conversation[conversation.length - 1];
        if (last && last.role === "user" && last.text === question) {
            conversation.pop();
            saveConversation();
        }

        showError(error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.");
    } finally {
        isSending = false;
        sendButton.disabled = false;
        questionInput.disabled = false;
        questionInput.focus();
    }
}

chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = questionInput.value.trim();

    if (!question) {
        showError("Please enter a medical question.");
        questionInput.focus();
        return;
    }

    if (question.length > 2000) {
        showError("Your question must be 2000 characters or fewer.");
        return;
    }

    questionInput.value = "";
    questionInput.style.height = "auto";
    await sendQuestion(question);
});

questionInput.addEventListener("input", () => {
    questionInput.style.height = "auto";
    questionInput.style.height = `${Math.min(questionInput.scrollHeight, 150)}px`;
    clearError();
});

questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        chatForm.requestSubmit();
    }
});

document.querySelectorAll("[data-question]").forEach((button) => {
    button.addEventListener("click", () => {
        if (isSending) return;
        const question = button.dataset.question;
        if (question) {
            questionInput.value = question;
            chatForm.requestSubmit();
        }
    });
});

createConversationToolbar();
loadConversation();

// Research Lab: upload a PDF to the local analysis endpoint.
const paperForm = document.getElementById("paper-form");

if (paperForm) {
    const paperInput = document.getElementById("paper-file");
    const analyzeButton = document.getElementById("analyze-button");
    const paperStatus = document.getElementById("paper-status");
    const paperResult = document.getElementById("paper-result");
    const paperSummary = document.getElementById("paper-summary");
    const paperResultTitle = document.getElementById("paper-result-title");
    const paperDisclaimer = document.getElementById("paper-disclaimer");

    paperForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const file = paperInput.files && paperInput.files[0];

        if (!file) {
            paperStatus.textContent = "Choose a PDF file first.";
            paperStatus.hidden = false;
            return;
        }

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            paperStatus.textContent = "Only PDF files are supported.";
            paperStatus.hidden = false;
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            paperStatus.textContent = "The PDF must be 10 MB or smaller.";
            paperStatus.hidden = false;
            return;
        }

        const formData = new FormData();
        formData.append("paper", file);

        analyzeButton.disabled = true;
        paperInput.disabled = true;
        paperResult.hidden = true;
        paperStatus.textContent =
            "Analyzing locally. Larger papers may take a little while...";
        paperStatus.hidden = false;

        try {
            const response = await fetch("/analyze-paper", {
                method: "POST",
                body: formData
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || `Request failed (${response.status}).`);
            }

            paperResultTitle.textContent =
                `Analysis: ${data.filename || file.name} · ${data.pages_analyzed} pages`;
            paperSummary.textContent = data.summary || "No summary was returned.";
            paperDisclaimer.textContent = data.disclaimer || "";
            paperResult.hidden = false;
            paperStatus.textContent = "Analysis complete. Verify findings against the original paper.";
        } catch (error) {
            paperStatus.textContent = error instanceof Error
                ? error.message
                : "Analysis failed. Please try again.";
        } finally {
            analyzeButton.disabled = false;
            paperInput.disabled = false;
        }
    });
}
