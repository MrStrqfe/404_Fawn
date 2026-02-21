// Fawn Remote Access Handler
// Injected into all pages to manage local safety features during a remote session

let isRemoteSessionActive = false;
let sessionOverlay = null;
let stopButton = null;
let lastLocalInputTime = 0;

function initRemoteHandler() {
    chrome.storage.local.get(['remoteSessionState'], (data) => {
        if (data.remoteSessionState === 'HOSTING') {
            enableSafetyFeatures();
        }
    });

    // Listen for state changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.remoteSessionState) {
            if (changes.remoteSessionState.newValue === 'HOSTING') {
                enableSafetyFeatures();
            } else {
                disableSafetyFeatures();
            }
        }
    });
}

function enableSafetyFeatures() {
    if (isRemoteSessionActive) return;
    isRemoteSessionActive = true;

    // 1. Install Yellow Border Overlay
    sessionOverlay = document.createElement('div');
    sessionOverlay.style.position = 'fixed';
    sessionOverlay.style.top = '0';
    sessionOverlay.style.left = '0';
    sessionOverlay.style.width = '100vw';
    sessionOverlay.style.height = '100vh';
    sessionOverlay.style.border = '6px solid #FEF250'; // Bright yellow
    sessionOverlay.style.boxSizing = 'border-box';
    sessionOverlay.style.pointerEvents = 'none'; // Let clicks pass through
    sessionOverlay.style.zIndex = '2147483646'; // Maximum z-index minus 1
    sessionOverlay.style.boxShadow = 'inset 0 0 15px rgba(254, 242, 80, 0.5)';
    document.documentElement.appendChild(sessionOverlay);

    // 2. Install Emergency Stop Button
    stopButton = document.createElement('button');
    stopButton.style.position = 'fixed';
    stopButton.style.bottom = '20px';
    stopButton.style.right = '20px';
    stopButton.style.width = '60px';
    stopButton.style.height = '60px';
    stopButton.style.borderRadius = '50%';
    stopButton.style.backgroundColor = '#ef4444';
    stopButton.style.color = '#fff';
    stopButton.style.border = '3px solid #fff';
    stopButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    stopButton.style.cursor = 'pointer';
    stopButton.style.zIndex = '2147483647'; // Absolute maximum
    stopButton.textContent = 'STOP'; // Fallback if no image
    stopButton.style.fontWeight = 'bold';
    stopButton.title = 'End Remote Access Session instantly';

    // Try to load a red block icon if available (fallback to styled button otherwise)
    const imgUrl = chrome.runtime.getURL('red-stop-btn.png');
    stopButton.style.backgroundImage = `url('${imgUrl}')`;
    stopButton.style.backgroundSize = 'cover';
    stopButton.style.backgroundPosition = 'center';

    stopButton.addEventListener('click', () => {
        terminateSession('Emergency Stop Button Clicked');
    });

    document.documentElement.appendChild(stopButton);

    // 3. Register Global Emergency Kill Shortcut (Ctrl+Alt+B / Cmd+Option+B)
    document.addEventListener('keydown', handleKillShortcut, true);

    // 4. Register Local Input Priority Trackers
    document.addEventListener('mousemove', trackLocalInput, true);
    document.addEventListener('mousedown', trackLocalInput, true);
    document.addEventListener('keydown', trackLocalInput, true);

    console.log('Fawn: Remote Access Safety Features Enabled.');
}

function disableSafetyFeatures() {
    if (!isRemoteSessionActive) return;
    isRemoteSessionActive = false;

    if (sessionOverlay && sessionOverlay.parentNode) sessionOverlay.parentNode.removeChild(sessionOverlay);
    if (stopButton && stopButton.parentNode) stopButton.parentNode.removeChild(stopButton);

    document.removeEventListener('keydown', handleKillShortcut, true);
    document.removeEventListener('mousemove', trackLocalInput, true);
    document.removeEventListener('mousedown', trackLocalInput, true);
    document.removeEventListener('keydown', trackLocalInput, true);

    console.log('Fawn: Remote Access Safety Features Disabled.');
}

function terminateSession(reason) {
    console.warn('Fawn: Terminating remote session. Reason:', reason);
    disableSafetyFeatures();
    chrome.storage.local.remove(['remoteSessionState', 'remoteAccessCode']);
    alert('Remote Access Connection Terminated.');
}

function handleKillShortcut(e) {
    // Check for Ctrl + Alt + B (Windows/Linux) or Cmd + Option + B (Mac)
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        e.stopPropagation();
        terminateSession('Keyboard Kill Shortcut Used');
    }
}

function trackLocalInput(e) {
    // If this event was artificially dispatched by a script (e.g. simulated click from remote helper),
    // e.isTrusted is false. True physical inputs from the local user have e.isTrusted = true.
    if (e.isTrusted) {
        lastLocalInputTime = Date.now();
    }
}

// Exported function for the simulated remote helper script to check if it's allowed to interact
const isRemoteInputAllowed = function () {
    // Prevent remote actions if physical user interacted within the last 2 seconds (2000ms)
    return (Date.now() - lastLocalInputTime) > 2000;
};
window.isRemoteInputAllowed = isRemoteInputAllowed;

// Start
initRemoteHandler();
