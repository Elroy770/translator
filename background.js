// Initialize context menu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "translate-selection",
        title: "Translate Selection",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "translate-selection" && info.selectionText) {
        handleTranslation(info.selectionText, tab.id);
    }
});

async function handleTranslation(text, tabId) {
    try {
        const data = await chrome.storage.sync.get("targetLang");
        const tl = data.targetLang || "he";

        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const json = await res.json();

        let translated = "";
        if (json && json[0]) {
            json[0].forEach(seg => {
                if (seg && seg[0]) translated += seg[0];
            });
        }

        if (translated) {
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: showTranslationResult,
                args: [translated]
            });
        }
    } catch (err) {
        console.error("Translation failed:", err);
    }
}

function showTranslationResult(text) {
    // 1. Clean up existing
    const existingHost = document.getElementById("hover-translator-host");
    if (existingHost) existingHost.remove();

    // 2. Create Shadow Host
    const host = document.createElement("div");
    host.id = "hover-translator-host";
    Object.assign(host.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "0",
        height: "0",
        zIndex: "2147483647", // Max z-index
        pointerEvents: "none" // Allow clicks through the empty host
    });
    document.body.appendChild(host);

    // 3. Create Shadow Root
    const shadow = host.attachShadow({ mode: "open" });

    // 4. Styles (Isolated)
    const style = document.createElement("style");
    style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        
        .container {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            min-width: 320px;
            max-width: 600px;
            background: rgba(20, 20, 25, 0.95); /* Dark premium theme */
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 24px;
            color: #fff;
            box-shadow: 
                0 20px 40px rgba(0,0,0,0.3),
                0 0 0 1px rgba(255,255,255,0.05);
            font-family: 'Inter', -apple-system, system-ui, sans-serif;
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .container.visible {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }

        .title {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #9ca3af;
            font-weight: 600;
        }

        .content {
            font-size: 16px;
            line-height: 1.6;
            color: #f3f4f6;
            font-weight: 400;
        }

        .footer {
            margin-top: 8px;
            display: flex;
            justify-content: flex-end;
        }

        .close-btn {
            background: none;
            border: none;
            color: #6b7280;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: color 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .close-btn:hover {
            color: #fff;
            background: rgba(255,255,255,0.1);
        }
        
        svg {
            width: 20px;
            height: 20px;
        }
    `;
    shadow.appendChild(style);

    // 5. Structure
    const container = document.createElement("div");
    container.className = "container";

    container.innerHTML = `
        <div class="header">
            <span class="title">Translation</span>
            <button class="close-btn" id="close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
        <div class="content">${text}</div>
    `;

    shadow.appendChild(container);

    // 6. Logic
    requestAnimationFrame(() => container.classList.add("visible"));

    const close = () => {
        container.classList.remove("visible");
        container.style.transform = "translateX(-50%) translateY(-10px)";
        setTimeout(() => host.remove(), 400);
    };

    container.querySelector("#close").onclick = close;

    // Auto close logic
    let timer;
    const startTimer = () => { timer = setTimeout(close, 6000); };
    startTimer();

    container.onmouseenter = () => clearTimeout(timer);
    container.onmouseleave = startTimer;
}