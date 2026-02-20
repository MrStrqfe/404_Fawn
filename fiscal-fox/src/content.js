/* --- 1. CORE SPEECH ENGINE --- */
const speak = (text) => {
  // Cancel any currently playing audio to prevent overlap
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0; // Normal speed
  utterance.pitch = 1.0;

  // Optional: Highlight text visually while reading (accessibility best practice)
  window.speechSynthesis.speak(utterance);
};

/* --- 2. SEARCH & CONTEXT LOGIC --- */
function searchAndRead(keyword) {
  if (!keyword) return;

  // Search through common text containers
  const elements = document.querySelectorAll(
    "p, li, h1, h2, h3, article, section, div",
  );
  let found = false;

  for (let el of elements) {
    // Only target elements that contain the keyword but aren't massive containers
    if (
      el.innerText.toLowerCase().includes(keyword.toLowerCase()) &&
      el.children.length < 10
    ) {
      // Visual feedback: Highlight and scroll
      el.style.backgroundColor = "rgba(255, 255, 0, 0.4)"; // Soft yellow
      el.style.border = "2px solid orange";
      el.scrollIntoView({ behavior: "smooth", block: "center" });

      speak(el.innerText);
      found = true;
      break; // Exit after finding the first relevant block
    }
  }

  if (!found) {
    speak("I'm sorry, I couldn't find a paragraph containing " + keyword);
  }
}

/* --- 3. MESSAGE LISTENER (Link with App.js) --- */
// This allows your React Popup to trigger the search
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SEARCH_KEYWORD") {
    searchAndRead(request.keyword);
    sendResponse({ status: "searching" });
  }

  if (request.action === "STOP_SPEECH") {
    window.speechSynthesis.cancel();
    sendResponse({ status: "stopped" });
  }
  return true; // Keeps the messaging channel open for async responses
});

/* --- 4. AUTO-PROMPT ON PAGE LOAD --- */
window.addEventListener("load", () => {
  // Wait 1 second for the page to finish rendering
  setTimeout(() => {
    const wantReadAloud = confirm(
      "Fiscal Fox: Would you like to use the Read Aloud helper on this page?",
    );

    if (wantReadAloud) {
      const keyword = prompt(
        "Enter a keyword to find a specific paragraph, or leave blank to read whatever you highlight:",
      );

      if (keyword && keyword.trim() !== "") {
        searchAndRead(keyword);
      } else {
        // Fallback: Listener for highlighted text
        alert("Mode: Highlight text on this page to hear it read aloud.");
        document.addEventListener("mouseup", () => {
          const selectedText = window.getSelection().toString().trim();
          if (selectedText) {
            speak(selectedText);
          }
        });
      }
    }
  }, 1000);
});
