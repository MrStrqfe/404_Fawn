// cross-browser
const ext = typeof browser !== "undefined" ? browser : chrome;

let isMuted = false;
let lastKeyword = "";
let currentNode = null;

/* ---------------- PROMPT ON LOAD ---------------- */
window.addEventListener("load", () => {
  const host = location.hostname;

  ext.storage.local.get([host], (res) => {
    if (res?.[host] === "dismissed") return;
    setTimeout(() => createPrompt(host), 800);
  });
});

function createPrompt(host) {
  if (document.getElementById("ff-enable")) return;

  const box = document.createElement("div");
  box.id = "ff-enable";
  box.style.cssText =
    "position:fixed;bottom:20px;right:20px;background:#1a1a1a;color:#fff;padding:20px;border-radius:10px;z-index:999999;font-family:sans-serif;box-shadow:0 10px 25px rgba(0,0,0,.5);";

  box.innerHTML = `
    <div style="margin-bottom:10px;font-weight:bold;">Enable Read Aloud?</div>
    <div>Enter = Yes</div>
    <div>Esc = No</div>
    <div style="margin-top:8px;font-size:12px;">M = mute site</div>
  `;

  document.body.appendChild(box);

  const handler = (e) => {
    if (e.key === "Enter") {
      cleanup();
      speak("Read aloud enabled.");
    }

    if (e.key === "Escape") {
      cleanup();
    }

    if (e.key.toLowerCase() === "m") {
      ext.storage.local.set({ [host]: "dismissed" });
      cleanup();
    }
  };

  function cleanup() {
    document.removeEventListener("keydown", handler, true);
    box.remove();
  }

  document.addEventListener("keydown", handler, true);
}

/* ---------------- SPEECH CORE ---------------- */

function speak(text, onEnd) {
  if (isMuted) return;

  speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;

  const voices = speechSynthesis.getVoices();
  if (voices.length) {
    utter.voice = voices.find((v) => v.lang.startsWith("en")) || voices[0];
  }

  if (onEnd) utter.onend = onEnd;

  speechSynthesis.speak(utter);
}

/* ---------------- KEYWORD SEARCH ---------------- */

ext.runtime.onMessage.addListener((msg) => {
  if (msg.action === "SEARCH_KEYWORD") {
    lastKeyword = msg.keyword;
    findAndRead(msg.keyword);
  }

  if (msg.action === "STOP_SPEECH") {
    speechSynthesis.cancel();
  }
});

function findAndRead(keyword) {
  if (!keyword) return;

  clearHighlight();

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false,
  );

  let node;

  while ((node = walker.nextNode())) {
    const index = node.nodeValue.toLowerCase().indexOf(keyword.toLowerCase());
    if (index !== -1) {
      currentNode = node.parentElement;
      break;
    }
  }

  if (!currentNode) {
    speak("Keyword not found.");
    return;
  }

  highlight(currentNode);

  currentNode.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });

  const paragraph = currentNode.innerText;

  speak(paragraph, () => {
    showContinuePrompt();
  });
}

/* ---------------- NEXT INSTANCE ---------------- */

function findNextInstance() {
  if (!lastKeyword) return;

  clearHighlight();

  const nodes = [...document.querySelectorAll("p, div, span")];
  let foundCurrent = false;

  for (let el of nodes) {
    if (el === currentNode) {
      foundCurrent = true;
      continue;
    }

    if (
      foundCurrent &&
      el.innerText &&
      el.innerText.toLowerCase().includes(lastKeyword.toLowerCase())
    ) {
      currentNode = el;
      highlight(el);

      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      speak(el.innerText, () => {
        showContinuePrompt();
      });

      return;
    }
  }

  speak("No more instances found.");
}

/* ---------------- CONTINUE READING ---------------- */

function continueReading() {
  if (!currentNode) return;

  const next = currentNode.nextElementSibling;
  if (!next) return;

  clearHighlight();
  currentNode = next;

  highlight(next);

  next.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });

  speak(next.innerText, () => {
    showContinuePrompt();
  });
}

/* ---------------- HIGHLIGHT ---------------- */

function highlight(element) {
  element.style.backgroundColor = "#f39c12";
  element.style.color = "#000";
}

function clearHighlight() {
  if (currentNode) {
    currentNode.style.backgroundColor = "";
    currentNode.style.color = "";
  }
}

/* ---------------- AFTER READING PROMPT ---------------- */

function showContinuePrompt() {
  if (document.getElementById("ff-continue")) return;

  const box = document.createElement("div");
  box.id = "ff-continue";

  box.style.cssText =
    "position:fixed;bottom:20px;left:20px;background:#222;color:#fff;padding:15px;border-radius:8px;z-index:999999;font-family:sans-serif;";

  box.innerHTML = `
    <div style="margin-bottom:8px;">Continue?</div>
    <button id="ff-next">Next Paragraph</button>
    <button id="ff-search">Next Match</button>
    <button id="ff-stop">Stop</button>
  `;

  document.body.appendChild(box);

  document.getElementById("ff-next").onclick = () => {
    box.remove();
    continueReading();
  };

  document.getElementById("ff-search").onclick = () => {
    box.remove();
    findNextInstance();
  };

  document.getElementById("ff-stop").onclick = () => {
    speechSynthesis.cancel();
    box.remove();
  };
}

/* ---------------- GLOBAL MUTE ---------------- */

document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "m") {
    isMuted = !isMuted;
    if (isMuted) speechSynthesis.cancel();
  }
});
