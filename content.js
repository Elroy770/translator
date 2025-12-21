console.log("Hover Translator Loaded");

let hoverHost = null; // We'll store the shadow host here
let timeoutId;

document.addEventListener("mouseup", async (e) => {
  const text = window.getSelection().toString().trim();
  if (!text) return;

  // If we click inside our own shadow dom (not easy to detect from outside without composed path)
  // but usually user clicks elsewhere to clear.
  // For now, let's just clear previous if any.
  if (hoverHost) {
    hoverHost.remove();
    hoverHost = null;
  }
  clearTimeout(timeoutId);

  try {
    // 1. Get Settings
    const storage = await chrome.storage.sync.get("targetLang");
    const tl = storage.targetLang || "he";

    // 2. Fetch Translation
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();

    let translated = "";
    if (data?.[0]) {
      data[0].forEach(seg => {
        if (seg?.[0]) translated += seg[0];
      });
    }

    if (!translated) return;

    // 3. Show UI (Shadow DOM)
    showHoverResult(translated, e.pageX, e.pageY);

  } catch (err) {
    console.error("Translate error:", err);
  }
});

function showHoverResult(text, x, y) {
  if (hoverHost) hoverHost.remove();

  // Create Host
  hoverHost = document.createElement("div");
  hoverHost.id = "hover-translator-host";
  Object.assign(hoverHost.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "2147483647",
    pointerEvents: "none"
  });
  document.body.appendChild(hoverHost);

  // Create Shadow
  const shadow = hoverHost.attachShadow({ mode: "open" });

  // Styles
  const style = document.createElement("style");
  style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        
        .card {
            position: absolute;
            background: rgba(20, 20, 25, 0.95);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px;
            color: #fff;
            box-shadow: 0 10px 25px rgba(0,0,0,0.25);
            font-family: 'Inter', sans-serif;
            max-width: 300px;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.2s ease-out;
            pointer-events: auto;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .card.visible {
            opacity: 1;
            transform: translateY(0);
        }
    `;
  shadow.appendChild(style);

  // Content
  const card = document.createElement("div");
  card.className = "card";
  card.textContent = text;

  // Positioning logic (keep roughly near mouse but onscreen)
  // We render logic in JS to keep it simple
  style.textContent += `
        .card {
            top: ${y + 15}px;
            left: ${x}px;
        }
    `;

  shadow.appendChild(card);

  // Animate
  requestAnimationFrame(() => card.classList.add("visible"));

  // Auto-remove
  timeoutId = setTimeout(() => {
    if (hoverHost) {
      card.classList.remove("visible");
      setTimeout(() => {
        if (hoverHost) hoverHost.remove();
        hoverHost = null;
      }, 200);
    }
  }, 4000); // 4 seconds

  // Stop removal on hover
  card.addEventListener("mouseenter", () => clearTimeout(timeoutId));
  card.addEventListener("mouseleave", () => {
    timeoutId = setTimeout(() => {
      if (hoverHost) hoverHost.remove();
    }, 3000);
  });
}