document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const viewMenu = document.getElementById('view-menu');
    const viewGetHelp = document.getElementById('view-get-help');
    const viewGiveHelp = document.getElementById('view-give-help');

    const btnGetHelp = document.getElementById('btnGetHelp');
    const btnGiveHelp = document.getElementById('btnGiveHelp');
    const btnCancelGetHelp = document.getElementById('btnCancelGetHelp');
    const btnBackFromGiveHelp = document.getElementById('btnBackFromGiveHelp');

    const btnConnectHelper = document.getElementById('btnConnectHelper');
    const generatedCodeDisplay = document.getElementById('generatedCode');
    const inputAccessCode = document.getElementById('inputAccessCode');

    // Logic Variables
    let isHosting = false;
    let connectionCheckInterval = null;

    // View switchers
    function showView(viewId) {
        document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
    }

    // --- GET HELP (Host / Spectated) --- //
    btnGetHelp.addEventListener('click', () => {
        showView('view-get-help');

        // Generate a secure 6 digit random number from crypto
        const randomArray = new Uint32Array(1);
        crypto.getRandomValues(randomArray);
        const code = (randomArray[0] % 900000) + 100000; // 100000 to 999999

        generatedCodeDisplay.textContent = code;
        isHosting = true;

        // Simulate starting a hosting session in background
        chrome.storage.local.set({
            remoteSessionState: 'HOSTING',
            remoteAccessCode: code.toString()
        });

    });

    btnCancelGetHelp.addEventListener('click', () => {
        isHosting = false;
        chrome.storage.local.remove(['remoteSessionState', 'remoteAccessCode']);
        showView('view-menu');
    });

    // --- GIVE HELP (Client / Helper) --- //
    btnGiveHelp.addEventListener('click', () => {
        showView('view-give-help');
        inputAccessCode.value = '';
        inputAccessCode.focus();
    });

    btnBackFromGiveHelp.addEventListener('click', () => {
        showView('view-menu');
    });

    btnConnectHelper.addEventListener('click', () => {
        const code = inputAccessCode.value.trim();
        if (code.length !== 6) {
            alert('Must be exactly 6 digits.');
            return;
        }

        // "Connect" action simulation
        console.log('Attempting simulated remote connection with code:', code);

        // In a real app this would negotiate WebRTC over signaling server.
        // For this simulation phase, we will just alert.
        alert('Simulated WebRTC connection sequence initiated for code: ' + code);
    });

    inputAccessCode.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnConnectHelper.click();
    });

});
