(async function init() {
  currentState = State.WAITING_FOR_ACTIVATION;

  createMainOverlay();

  await speak(
    "Fawn is available. Press space to enable. Press M to continue without enabling.",
  );

  document.addEventListener("keydown", activationHandler);
})();

async function activationHandler(e) {
  if (currentState !== State.WAITING_FOR_ACTIVATION) return;

  // Enable
  if (e.code === "Space") {
    e.preventDefault();

    document.removeEventListener("keydown", activationHandler);

    currentState = State.WAITING_FOR_KEYWORD;

    await speak("Type a keyword and press space to confirm.");

    createKeywordOverlay();

    document.addEventListener("keydown", keywordHandler);
  }

  // Mute / Do Not Enable
  if (e.key.toLowerCase() === "m") {
    e.preventDefault();

    document.removeEventListener("keydown", activationHandler);

    removeOverlay();
    window.speechSynthesis.cancel();
    currentState = State.IDLE;
  }

  // Exit
  if (e.key === "Escape") {
    e.preventDefault();
    exitExtension();
  }
}

async function keywordHandler(e) {
  if (currentState !== State.WAITING_FOR_KEYWORD) return;

  if (e.code === "Space") {
    e.preventDefault();

    const keyword = overlayInput.value.trim();
    if (!keyword) return;

    matches = findKeywordMatches(keyword);
    currentIndex = 0;

    if (matches.length === 0) {
      await speak("No matches found. Type another keyword.");
      return;
    }

    currentState = State.READING_SECTION;
    document.removeEventListener("keydown", keywordHandler);

    await readCurrentMatch();
  }

  if (e.key === "Escape") {
    e.preventDefault();
    exitExtension();
  }
}

async function readCurrentMatch() {
  const element = matches[currentIndex];
  highlightElement(element);

  removeOverlay();

  await speak(element.innerText);

  currentState = State.WAITING_FOR_NEXT_ACTION;

  createMainOverlay();
  updateOverlayMessage("Reading complete.");

  await speak(
    "Press space for next result. Press K for new keyword. Press escape to exit.",
  );

  document.addEventListener("keydown", navigationHandler);
}

async function navigationHandler(e) {
  if (currentState !== State.WAITING_FOR_NEXT_ACTION) return;

  if (e.code === "Space") {
    e.preventDefault();

    if (currentIndex < matches.length - 1) {
      currentIndex++;
      currentState = State.READING_SECTION;
      document.removeEventListener("keydown", navigationHandler);
      await readCurrentMatch();
    } else {
      await speak("No more results.");
    }
  }

  if (e.key.toLowerCase() === "k") {
    e.preventDefault();

    document.removeEventListener("keydown", navigationHandler);

    currentState = State.WAITING_FOR_KEYWORD;

    await speak("Type a new keyword and press space.");

    createKeywordOverlay();
    document.addEventListener("keydown", keywordHandler);
  }

  if (e.key === "Escape") {
    e.preventDefault();
    exitExtension();
  }
}

function exitExtension() {
  removeOverlay();
  window.speechSynthesis.cancel();
  currentState = State.IDLE;
}
