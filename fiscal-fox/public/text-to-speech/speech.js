// Ensure voices are loaded before first use
let voicesReady = false;

function ensureVoices() {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      voicesReady = true;
      resolve();
      return;
    }
    speechSynthesis.addEventListener("voiceschanged", () => {
      voicesReady = true;
      resolve();
    }, { once: true });
  });
}

function speak(text) {
  return new Promise(async (resolve) => {
    if (!voicesReady) await ensureVoices();

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve(); // Don't hang if speech fails

    speechSynthesis.speak(utterance);
  });
}
