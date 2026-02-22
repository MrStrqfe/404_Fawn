/* global io chrome */
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

    // Helper-specific DOM
    const helperSetup = document.getElementById('helper-setup');
    const helperVideoContainer = document.getElementById('helper-video-container');
    const remoteVideo = document.getElementById('remoteVideo');
    const btnDisconnectHelper = document.getElementById('btnDisconnectHelper');
    const btnFullscreen = document.getElementById('btnFullscreen');
    const helperStatus = document.getElementById('helperStatus');

    // WebRTC Variables
    let socket = null;
    let peerConnection = null;
    let dataChannel = null;
    let localStream = null;
    let currentRoom = null;
    let role = null; // 'host' or 'helper'

    // Configuration for WebRTC
    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    function connectSignalingServer() {
        if (!socket) {
            // Using the live Heroku deployment for global reach
            socket = io('https://fawn-signaling-server.herokuapp.com');

            socket.on('connect', () => {
                console.log('Connected to signaling server');
            });

            socket.on('user-joined', async (joinedRole) => {
                console.log('User joined room:', joinedRole);
                if (role === 'host' && joinedRole === 'helper') {
                    // Start WebRTC connection process
                    await createPeerConnection();
                    // Send offer
                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);
                    socket.emit('signal', { roomId: currentRoom, signalData: { type: 'offer', offer } });
                }
            });

            socket.on('signal', async (data) => {
                if (data.type === 'offer' && role === 'helper') {
                    await createPeerConnection();
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    socket.emit('signal', { roomId: currentRoom, signalData: { type: 'answer', answer } });
                } else if (data.type === 'answer' && role === 'host') {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                } else if (data.type === 'ice-candidate') {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            });

            socket.on('user-left', () => {
                alert('The other user has disconnected.');
                resetConnection();
            });
        }
    }

    async function createPeerConnection() {
        peerConnection = new RTCPeerConnection(rtcConfig);

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('signal', { roomId: currentRoom, signalData: { type: 'ice-candidate', candidate: event.candidate } });
            }
        };

        if (role === 'host') {
            // Create data channel for receiving clicks/keys
            dataChannel = peerConnection.createDataChannel('control-channel');
            setupDataChannel(dataChannel);

            // Add local stream tracks to connection
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        } else if (role === 'helper') {
            // Listen for data channel
            peerConnection.ondatachannel = (event) => {
                dataChannel = event.channel;
                setupDataChannel(dataChannel);
            };

            // Listen for remote video
            peerConnection.ontrack = (event) => {
                if (remoteVideo.srcObject !== event.streams[0]) {
                    remoteVideo.srcObject = event.streams[0];
                    console.log('Received remote stream');
                }
            };
        }
    }

    function setupDataChannel(channel) {
        channel.onopen = () => console.log('Data channel open');
        channel.onmessage = (event) => {
            if (role === 'host') {
                handleRemoteControlMessage(event.data);
            }
        };
    }

    function executeVisualActionLocally(remoteData) {
        // Double check if user interacted recently to prevent helper override
        if (window.isRemoteInputAllowed && !window.isRemoteInputAllowed()) {
            console.warn('Fawn: Remote input blocked. Local user is active.');
            return;
        }

        const x = remoteData.x * window.innerWidth;
        const y = remoteData.y * window.innerHeight;

        if (remoteData.type === 'click') {
            const el = document.elementFromPoint(x, y);
            if (el) {
                const event = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y
                });
                el.dispatchEvent(event);

                // Visual feedback
                const ripple = document.createElement('div');
                ripple.textContent = '✨';
                ripple.style.position = 'fixed';
                ripple.style.left = (x - 12) + 'px'; // Center emoji
                ripple.style.top = (y - 12) + 'px';
                ripple.style.zIndex = '2147483647';
                ripple.style.pointerEvents = 'none';
                ripple.style.fontSize = '24px';
                ripple.style.animation = 'fadeup 1s ease-out forwards';
                document.body.appendChild(ripple);
                setTimeout(() => ripple.remove(), 1000);

                if (!document.getElementById('fawn-ripple-style')) {
                    const style = document.createElement('style');
                    style.id = 'fawn-ripple-style';
                    style.textContent = '@keyframes fadeup { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-30px); } }';
                    document.head.appendChild(style);
                }
            }
        } else if (remoteData.type === 'draw') {
            // Visual feedback for drawing
            const dot = document.createElement('div');
            dot.style.position = 'fixed';
            dot.style.left = (x - 6) + 'px'; // Center dot
            dot.style.top = (y - 6) + 'px';
            dot.style.width = '12px';
            dot.style.height = '12px';
            dot.style.backgroundColor = '#4CAF50';
            dot.style.borderRadius = '50%';
            dot.style.zIndex = '2147483647';
            dot.style.pointerEvents = 'none';
            dot.style.transition = 'opacity 2s linear';
            document.body.appendChild(dot);

            // Force reflow so transition works, then fade out
            void dot.offsetWidth;
            dot.style.opacity = '0';
            setTimeout(() => dot.remove(), 2000);
        }
    }

    // Host receives message via Data Channel to trigger click.
    function handleRemoteControlMessage(dataString) {
        try {
            const data = JSON.parse(dataString);

            // Determine active tab to receive the input
            chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                    // It's a normal web page! Inject the script into it.
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: executeVisualActionLocally,
                        args: [data]
                    }).catch(err => {
                        console.warn('Fawn: Injection failed:', err.message);
                        // Fallback: draw on the extension page itself just in case
                        executeVisualActionLocally(data);
                    });
                } else {
                    // Host is looking at a restricted page (like Fawn's Visual Help page itself).
                    // Run it natively in this DOM!
                    executeVisualActionLocally(data);
                }
            });
        } catch (e) {
            console.error('Error handling remote control message', e);
        }
    }

    function resetConnection() {
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            localStream = null;
        }
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        isHosting = false;
        currentRoom = null;
        role = null;

        // Remove storage flags
        chrome.storage.local.remove(['remoteSessionState', 'remoteAccessCode']);

        showView('view-menu');
    }

    // View switchers
    function showView(viewId) {
        document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        if (viewId === 'view-give-help') {
            helperSetup.style.display = 'block';
            helperVideoContainer.style.display = 'none';
            helperStatus.style.display = 'none';
        }
    }

    function generateAlphanumericCode(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        const randomArray = new Uint32Array(length);
        crypto.getRandomValues(randomArray);
        for (let i = 0; i < length; i++) {
            result += chars[randomArray[i] % chars.length];
        }
        return result;
    }

    // --- GET HELP (Host / Spectated) --- //
    btnGetHelp.addEventListener('click', async () => {
        try {
            // Pick screen to share
            localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        } catch (e) {
            console.warn('Screen capture cancelled or failed', e);
            return;
        }

        const code = generateAlphanumericCode(6);
        currentRoom = code;
        role = 'host';

        showView('view-get-help');
        generatedCodeDisplay.textContent = currentRoom;
        isHosting = true;

        connectSignalingServer();
        socket.emit('join-room', currentRoom, role);

        chrome.storage.local.set({
            remoteSessionState: 'HOSTING',
            remoteAccessCode: currentRoom
        });

        // If user stops sharing via browser native UI
        localStream.getVideoTracks()[0].onended = () => {
            resetConnection();
        };
    });

    btnCancelGetHelp.addEventListener('click', () => {
        resetConnection();
    });

    // Handle background termination (e.g. Host clicked Emergency Stop or Ctrl+Alt+B)
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') {
            if (changes.remoteSessionState && changes.remoteSessionState.newValue === undefined && isHosting) {
                resetConnection();
            }
        }
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
        const code = inputAccessCode.value.trim().toUpperCase();
        if (code.length !== 6) {
            alert('Must be exactly 6 characters.');
            return;
        }

        currentRoom = code;
        role = 'helper';

        helperStatus.style.display = 'flex';
        btnConnectHelper.disabled = true;

        connectSignalingServer();
        socket.emit('join-room', currentRoom, role);

        helperSetup.style.display = 'none';
        helperVideoContainer.style.display = 'block';
    });

    inputAccessCode.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnConnectHelper.click();
    });

    btnDisconnectHelper.addEventListener('click', () => {
        resetConnection();
    });

    btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            remoteVideo.requestFullscreen().catch(err => {
                alert(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    // Remote Control Logic (Helper sending clicks and drawing)
    let isDrawing = false;
    let lastDrawTime = 0;
    let clickStartX = 0;
    let clickStartY = 0;
    const DRAW_THROTTLE_MS = 30; // 30ms

    function handleRemoteInputEvent(e, actionType) {
        if (!dataChannel || dataChannel.readyState !== 'open') return;

        // Disable native video pause when clicking
        if (e.type === 'mousedown') {
            e.preventDefault();
        }

        const rect = remoteVideo.getBoundingClientRect();

        // Calculate object-fit boundaries
        const videoRatio = remoteVideo.videoWidth / remoteVideo.videoHeight;
        const containerRatio = rect.width / rect.height;

        let displayedWidth, displayedHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (containerRatio > videoRatio) {
            // Pillarboxing (black bars on left/right)
            displayedHeight = rect.height;
            displayedWidth = rect.height * videoRatio;
            offsetX = (rect.width - displayedWidth) / 2;
        } else {
            // Letterboxing (black bars on top/bottom)
            displayedWidth = rect.width;
            displayedHeight = rect.width / videoRatio;
            offsetY = (rect.height - displayedHeight) / 2;
        }

        // Calculate position relative to the actual video stream area
        const relativeX = e.clientX - rect.left - offsetX;
        const relativeY = e.clientY - rect.top - offsetY;

        // Ignore events on black bars
        if (relativeX < 0 || relativeX > displayedWidth || relativeY < 0 || relativeY > displayedHeight) {
            return;
        }

        // Normalize to 0.0 - 1.0
        const x = relativeX / displayedWidth;
        let y = relativeY / displayedHeight;

        // Apply a small manual correction upwards because the Host's browser UI 
        // (bookmarks bar, URL bar) is often captured in the Stream but misaligned 
        // with the viewport's innerHeight during injection.
        // A 2 inch difference vertically usually equates to ~60-80px on standard screens. 
        // We will subtract roughly 6-8% as a calibration offset.
        y = Math.max(0, y - 0.08);

        dataChannel.send(JSON.stringify({
            type: actionType,
            x: x,
            y: y
        }));
    }

    remoteVideo.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only process left click
        isDrawing = true;
        clickStartX = e.clientX;
        clickStartY = e.clientY;
        lastDrawTime = Date.now();
        // Don't send immediately. We wait to see if it's a drag or a click.
    });

    window.addEventListener('mouseup', (e) => {
        if (!isDrawing) return;
        isDrawing = false;

        // If mouse moved very little, consider it a single click rather than a draw segment.
        const dist = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
        if (dist < 5) { // 5px threshold
            handleRemoteInputEvent(e, 'click');
        }
    });

    remoteVideo.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;

        // Determine if we moved enough to start drawing
        const dist = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
        if (dist >= 5) {
            const now = Date.now();
            if (now - lastDrawTime > DRAW_THROTTLE_MS) {
                lastDrawTime = now;
                handleRemoteInputEvent(e, 'draw');
            }
        }
    });

});
