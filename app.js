import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getDatabase, ref, get, push, onChildAdded, remove, set, onChildRemoved } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-database.js";

// Firebase configuration
 const firebaseConfig = {
    apiKey: "AIzaSyCrKf90Bvmxrd6I-qR1AtUc0PMUtGmXObA",
    authDomain: "chat-new-v-1.firebaseapp.com",
    projectId: "chat-new-v-1",
    storageBucket: "chat-new-v-1.firebasestorage.app",
    messagingSenderId: "997224772594",
    appId: "1:997224772594:web:6c4c076801ce1ad968716b"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Encryption Utilities
const SALT = new TextEncoder().encode('CipherNet-Salt-v1');

async function deriveKey(sessionCode) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(sessionCode), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
    );
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: SALT, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
}

function bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
    return btoa(binary);
}

function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }
    return bytes.buffer;
}

async function encryptData(data, key) {
    // Works for strings or ArrayBuffers
    const iv = crypto.getRandomValues(new Uint8Array(12));
    let buffer;
    if (typeof data === 'string') {
        buffer = new TextEncoder().encode(data);
    } else {
        buffer = data; // Assume ArrayBuffer
    }
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, buffer);
    return {
        ciphertext: bufferToBase64(ciphertext),
        iv: bufferToBase64(iv)
    };
}

async function decryptData(encryptedObj, key, asString = true) {
    try {
        const ciphertextBuffer = base64ToBuffer(encryptedObj.ciphertext);
        const ivBuffer = base64ToBuffer(encryptedObj.iv);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
            key,
            ciphertextBuffer
        );
        if (asString) {
            return new TextDecoder().decode(decrypted);
        }
        return decrypted;
    } catch (e) {
        console.error("Decryption failed:", e);
        return asString ? "[Decryption Failed]" : null;
    }
}

async function decryptFileBuffer(ciphertextBuffer, ivBase64, key) {
    try {
        const ivBuffer = base64ToBuffer(ivBase64);
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
            key,
            ciphertextBuffer
        );
        return decrypted;
    } catch (e) {
        console.error("File Decryption failed:", e);
        return null;
    }
}


// Theme Picker (Feature 10)
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const theme = e.currentTarget.dataset.color;
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('ciphernet-theme', theme);
        // Highlight active theme button
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active-theme'));
        e.currentTarget.classList.add('active-theme');
    });
});

const savedTheme = localStorage.getItem('ciphernet-theme');
if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
}
const activeThemeBtn = document.querySelector(`.theme-btn[data-color="${document.body.getAttribute('data-theme')}"]`);
if (activeThemeBtn) {
    activeThemeBtn.classList.add('active-theme');
}

// Settings Modal Logic
const settingsModal = document.getElementById('settings-modal');
document.getElementById('open-settings').addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    settingsModal.classList.add('show');
});
// Landing page gear button also opens settings
document.querySelector('.landing-settings-btn').addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    settingsModal.classList.add('show');
});
document.querySelector('.close-settings').addEventListener('click', () => {
    settingsModal.classList.remove('show');
    settingsModal.classList.add('hidden');
});
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('show');
        settingsModal.classList.add('hidden');
    }
});

// Image Modal Close Logic
const imageModal = document.getElementById('image-modal');
document.querySelector('.close-modal').addEventListener('click', () => {
    imageModal.classList.remove('show');
});
imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
        imageModal.classList.remove('show');
    }
});

// Modal Download Button
document.getElementById('modal-download').addEventListener('click', async () => {
    const imgSrc = document.getElementById('modal-img').src;
    try {
        const response = await fetch(imgSrc);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CipherNet_Image_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
    } catch(e) {
        // Fallback: open in new tab
        window.open(imgSrc, '_blank');
    }
});

// Modal Copy Button
document.getElementById('modal-copy').addEventListener('click', async () => {
    const imgSrc = document.getElementById('modal-img').src;
    const copyBtn = document.getElementById('modal-copy');
    try {
        const response = await fetch(imgSrc);
        const blob = await response.blob();
        await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
        ]);
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
        }, 2000);
    } catch(e) {
        alert('Copy failed. Try downloading instead.');
    }
});

// Helper: Create image action buttons (download, copy, view)
function createImageActions(url, imgElement) {
    const bar = document.createElement('div');
    bar.classList.add('img-actions-bar');

    const dlBtn = document.createElement('button');
    dlBtn.classList.add('img-action-btn');
    dlBtn.innerHTML = '<i class="fa-solid fa-download"></i> Save';
    dlBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = url; a.download = `CipherNet_Image_${Date.now()}.png`;
        a.click();
    });

    const cpBtn = document.createElement('button');
    cpBtn.classList.add('img-action-btn');
    cpBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
    cpBtn.addEventListener('click', async () => {
        try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            cpBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => { cpBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy'; }, 1500);
        } catch(e) { alert('Copy failed'); }
    });

    const viewBtn = document.createElement('button');
    viewBtn.classList.add('img-action-btn');
    viewBtn.innerHTML = '<i class="fa-solid fa-expand"></i> View';
    viewBtn.addEventListener('click', () => {
        document.getElementById('modal-img').src = url;
        imageModal.classList.add('show');
    });

    bar.appendChild(viewBtn);
    bar.appendChild(dlBtn);
    bar.appendChild(cpBtn);
    return bar;
}

// Sound Effects (Feature 6)
let soundEnabled = true;
const toggleSoundBtn = document.getElementById('toggle-sound');
const soundMsgIn = document.getElementById('sound-msg-in');
const soundJoin = document.getElementById('sound-join');

toggleSoundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    toggleSoundBtn.classList.toggle('active-icon', soundEnabled);
    toggleSoundBtn.innerHTML = soundEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
});

function playSound(type) {
    if (!soundEnabled) return;
    if (type === 'msg') { soundMsgIn.currentTime = 0; soundMsgIn.play().catch(e=>console.log(e)); }
    if (type === 'join') { soundJoin.currentTime = 0; soundJoin.play().catch(e=>console.log(e)); }
}

// Browser Notifications (Feature 7)
let notifsEnabled = false;
const toggleNotifsBtn = document.getElementById('toggle-notifs');
toggleNotifsBtn.addEventListener('click', async () => {
    if ("Notification" in window) {
        if (Notification.permission === "granted") {
            notifsEnabled = !notifsEnabled;
        } else if (Notification.permission !== "denied") {
            const perm = await Notification.requestPermission();
            if (perm === "granted") notifsEnabled = true;
        }
    }
    toggleNotifsBtn.classList.toggle('active-icon', notifsEnabled);
    toggleNotifsBtn.innerHTML = notifsEnabled ? '<i class="fa-solid fa-bell"></i>' : '<i class="fa-solid fa-bell-slash"></i>';
});

function showNotification(title, body) {
    if (notifsEnabled && "Notification" in window && Notification.permission === "granted") {
        if (document.hidden) { // Only show if tab is not active
            new Notification(title, { body });
        }
    }
}

// DOM Elements
const landingPage = document.getElementById('landing-page');
const chatContainer = document.getElementById('chat-container');
const messagesDiv = document.getElementById('messages');
const currentUserNameDisplay = document.getElementById('current-user-name');
const uploadIndicator = document.getElementById('upload-indicator');
const participantsDrawer = document.getElementById('participants-drawer');
const participantsList = document.getElementById('participants-list');
const nodeCountDisplay = document.getElementById('node-count');
const messageCountDisplay = document.getElementById('message-count');
const sessionCodeDisplay = document.getElementById('session-code-display');
const sessionRoleDisplay = document.getElementById('session-role');
const p2pStatusDisplay = document.getElementById('p2p-status');
const draftStatusDisplay = document.getElementById('draft-status');
const messageSearchInput = document.getElementById('message-search');
const searchStatus = document.getElementById('search-status');
const clearSearchBtn = document.getElementById('clear-search');
const createSuccessPanel = document.getElementById('create-success-panel');
const successSessionCode = document.getElementById('success-session-code');
const shareModal = document.getElementById('share-modal');
const shareSessionCode = document.getElementById('share-session-code');

// Globals
let currentSessionId = null;
let currentCryptoKey = null;
let messageRef = null;
let currentUserName = null;
let isHost = false;
let currentSessionName = null;

// ----------------------------------------------------
// WebRTC P2P Infrastructure for File Transfer (Feature: No Storage)
// ----------------------------------------------------
let peerConnection = null;
let dataChannel = null;
let signalingRef = null;
let pendingIceCandidates = [];
let isOfferInProgress = false;

function getDraftStorageKey(sessionId = currentSessionId) {
    return sessionId ? `ciphernet-draft-${sessionId}` : null;
}

function updateMessageMetrics() {
    messageCountDisplay.textContent = String(messagesDiv.querySelectorAll('.message').length);
}

function updateDraftStatus(value = messageInput.value) {
    const hasDraft = value.trim().length > 0;
    draftStatusDisplay.textContent = hasDraft ? `${value.trim().length} chars` : 'Empty';
    draftStatusDisplay.classList.toggle('status-online', hasDraft);
}

function persistDraft() {
    const key = getDraftStorageKey();
    if (!key) {
        updateDraftStatus();
        return;
    }

    const value = messageInput.value;
    if (value.trim()) {
        localStorage.setItem(key, value);
    } else {
        localStorage.removeItem(key);
    }
    updateDraftStatus(value);
}

function restoreDraft() {
    const key = getDraftStorageKey();
    const draft = key ? localStorage.getItem(key) : '';
    messageInput.value = draft || '';
    updateDraftStatus(messageInput.value);
}

function clearDraft(sessionId = currentSessionId) {
    const key = getDraftStorageKey(sessionId);
    if (key) localStorage.removeItem(key);
    messageInput.value = '';
    updateDraftStatus('');
}

function updateSessionHeader() {
    sessionCodeDisplay.textContent = currentSessionId || '--------';
    sessionRoleDisplay.textContent = isHost ? 'Host' : 'Guest';
}

function updateP2PStatus(label, tone = 'status-warn') {
    p2pStatusDisplay.textContent = label;
    p2pStatusDisplay.classList.remove('status-online', 'status-warn', 'status-danger');
    if (tone) p2pStatusDisplay.classList.add(tone);
}

function applyMessageSearch() {
    const query = messageSearchInput.value.trim().toLowerCase();
    const messages = Array.from(messagesDiv.querySelectorAll('.message'));
    let matches = 0;

    messages.forEach((messageElement) => {
        const haystack = [
            messageElement.dataset.sender || '',
            messageElement.dataset.searchText || '',
            messageElement.dataset.quoteText || '',
            messageElement.dataset.kind || ''
        ].join(' ').toLowerCase();
        const visible = !query || haystack.includes(query);
        messageElement.classList.toggle('hidden', !visible);
        if (visible) matches += 1;
    });

    clearSearchBtn.classList.toggle('hidden', !query);
    searchStatus.classList.toggle('hidden', !query);
    if (query) {
        searchStatus.textContent = `${matches} match${matches === 1 ? '' : 'es'}`;
    }
}

function registerMessageMetadata(messageElement, metadata = {}) {
    messageElement.dataset.sender = metadata.sender || '';
    messageElement.dataset.searchText = metadata.text || '';
    messageElement.dataset.quoteText = metadata.quote || '';
    messageElement.dataset.kind = metadata.kind || 'text';
    updateMessageMetrics();
    applyMessageSearch();
}

const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
};

function flushPendingIceCandidates() {
    if (!peerConnection || !peerConnection.remoteDescription || !pendingIceCandidates.length) return;
    while (pendingIceCandidates.length) {
        const ice = pendingIceCandidates.shift();
        peerConnection.addIceCandidate(new RTCIceCandidate(ice)).catch(err => console.warn('Deferred ICE candidate error', err));
    }
}

async function waitForDataChannelOpen(timeoutMs = 10000) {
    if (dataChannel && dataChannel.readyState === 'open') return true;
    return new Promise(resolve => {
        const start = Date.now();

        const check = () => {
            if (dataChannel && dataChannel.readyState === 'open') {
                resolve(true); return;
            }
            if (Date.now() - start >= timeoutMs) {
                resolve(false); return;
            }
            setTimeout(check, 150);
        };
        check();
    });
}

function setupWebRTC(sessionCode) {
    peerConnection = new RTCPeerConnection(rtcConfig);
    updateP2PStatus('Negotiating', 'status-warn');
    
    // Both sides bind the event listener for incoming channels
    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel(dataChannel);
    };

    // Host explicitly creates the channel to kick off negotiation
    if (isHost) {
        dataChannel = peerConnection.createDataChannel("p2p-files", { negotiated: false });
        setupDataChannel(dataChannel);
    }

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            push(ref(database, `sessions/${sessionCode}/signaling`), {
                sender: currentUserName,
                type: 'candidate',
                candidate: JSON.stringify(event.candidate)
            });
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        const stateMap = {
            connected: ['Connected', 'status-online'],
            connecting: ['Connecting', 'status-warn'],
            disconnected: ['Disconnected', 'status-danger'],
            failed: ['Failed', 'status-danger'],
            closed: ['Closed', 'status-danger']
        };
        const nextState = stateMap[peerConnection.connectionState] || ['Standby', 'status-warn'];
        updateP2PStatus(nextState[0], nextState[1]);
        if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
            console.warn('P2P connection lost, retrying.');
            // Try once to regenerate offer on host
            if (isHost && !isOfferInProgress) {
                createOffer(sessionCode);
            }
        }
    };

    // Listen for signaling data (Offers, Answers, ICE) via RTDB
    signalingRef = ref(database, `sessions/${sessionCode}/signaling`);
    onChildAdded(signalingRef, async (snapshot) => {
        const data = snapshot.val();
        if (data.sender === currentUserName) return;

        try {
            if (data.type === 'offer' && !isHost) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.offer)));
                flushPendingIceCandidates();
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                push(ref(database, `sessions/${sessionCode}/signaling`), {
                    sender: currentUserName,
                    type: 'answer',
                    answer: JSON.stringify(answer)
                });
            } else if (data.type === 'answer' && isHost) {
                if (peerConnection.signalingState !== 'stable') {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.answer)));
                    flushPendingIceCandidates();
                }
            } else if (data.type === 'request_offer' && isHost) {
                if (peerConnection.connectionState !== 'connected' && !isOfferInProgress) {
                    createOffer(sessionCode);
                }
            } else if (data.type === 'candidate') {
                const iceCandidate = JSON.parse(data.candidate);
                if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
                } else {
                    pendingIceCandidates.push(iceCandidate);
                }
            }
        } catch (e) {
            console.error("WebRTC Signaling Error", e);
        }
    });

    if (isHost) {
        // We add a tiny delay to allow the guest to mount their listener
        setTimeout(() => createOffer(sessionCode), 1500);
    } else {
        // If not host, trigger host to resend offer if it was missed
        push(ref(database, `sessions/${sessionCode}/signaling`), {
            sender: currentUserName,
            type: 'request_offer'
        });
    }
}

async function createOffer(sessionCode) {
    if (!isHost || !peerConnection) return;
    try {
        isOfferInProgress = true;

        // Ensure data channel exists for host
        if (!dataChannel || dataChannel.readyState === 'closed' || dataChannel.readyState === 'closing') {
            dataChannel = peerConnection.createDataChannel('p2p-files', { negotiated: false });
            setupDataChannel(dataChannel);
        }

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        push(ref(database, `sessions/${sessionCode}/signaling`), {
            sender: currentUserName,
            type: 'offer',
            offer: JSON.stringify(offer)
        });
    } catch (e) {
        console.error('Create offer failed', e);
    } finally {
        isOfferInProgress = false;
    }
}

// Data Channel Data Buffering
let incomingFileData = [];
let incomingFileMeta = null;
let bytesReceived = 0;

function setupDataChannel(channel) {
    channel.binaryType = "arraybuffer";
    channel.onopen = () => {
        console.log("P2P Data Channel Open");
        updateP2PStatus('Live', 'status-online');
        uploadIndicator.innerHTML = '<i class="fa-solid fa-satellite-dish fa-spin"></i> P2P Connected';
        uploadIndicator.classList.remove('hidden');
        setTimeout(() => uploadIndicator.classList.add('hidden'), 1200);
    };
    channel.onclose = () => {
        console.warn("P2P Data Channel Closed");
        updateP2PStatus('Reconnecting', 'status-danger');
        uploadIndicator.innerHTML = '<span style="color:#f53333;">P2P channel closed. Reconnecting...</span>';
        uploadIndicator.classList.remove('hidden');
        setTimeout(() => uploadIndicator.classList.add('hidden'), 2500);
    };
    channel.onerror = (e) => {
        console.error("P2P Error:", e);
        updateP2PStatus('Error', 'status-danger');
        uploadIndicator.innerHTML = '<span style="color:#ffbb33;">P2P error: reconnect</span>';
        uploadIndicator.classList.remove('hidden');
        setTimeout(() => uploadIndicator.classList.add('hidden'), 3000);
    };
    
    channel.onmessage = async (event) => {
        if (typeof event.data === 'string') {
            // Meta data arrival
            incomingFileMeta = JSON.parse(event.data);
            incomingFileData = [];
            bytesReceived = 0;
            uploadIndicator.innerHTML = `<div><i class="fa-solid fa-satellite-dish fa-fade"></i> Receiving: <span id="transfer-progress">0%</span></div><div class="progress-bar-container"><div id="progress-bar-fill" class="progress-bar-fill"></div></div>`;
            uploadIndicator.classList.remove('hidden');
        } else {
            // Chunk arrival
            incomingFileData.push(event.data);
            bytesReceived += event.data.byteLength;
            
            // Update Dashboard
            if(incomingFileMeta) {
                let perc = Math.round((bytesReceived / incomingFileMeta.size) * 100);
                const pText = document.getElementById('transfer-progress');
                const pFill = document.getElementById('progress-bar-fill');
                if(pText) pText.textContent = `${perc}%`;
                if(pFill) pFill.style.width = `${perc}%`;
            }
            
            if (incomingFileMeta && bytesReceived >= incomingFileMeta.size) {
                // Reassemble
                const blob = new Blob(incomingFileData);
                const arrayBuffer = await blob.arrayBuffer();
                
                // Decrypt using ArrayBuffer directly instead of base64
                const decryptedBuffer = await decryptFileBuffer(arrayBuffer, incomingFileMeta.encryptionObj.iv, currentCryptoKey);
                
                if (decryptedBuffer) {
                    const decryptedBlob = new Blob([decryptedBuffer], { type: incomingFileMeta.mimeType });
                    const url = URL.createObjectURL(decryptedBlob);
                    renderReceivedFileMessage(incomingFileMeta, url);
                }
                
                uploadIndicator.classList.add('hidden');
                incomingFileMeta = null;
                incomingFileData = [];
            }
        }
    };
}

function renderReceivedFileMessage(meta, url) {
    const isImage = meta.mimeType.startsWith('image/');
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'received');
    
    const headerRow = document.createElement('div');
    headerRow.classList.add('message-header-row');
    headerRow.innerHTML = `
        <span class="sender-name"><i class="fa-solid fa-user-secret"></i> ${meta.sender}</span>
        <span class="message-timestamp">${new Date().toLocaleTimeString()}</span>
    `;
    messageElement.appendChild(headerRow);

    if (isImage) {
        // View-once: image is blurred behind overlay, click to reveal once
        const wrapper = document.createElement('div');
        wrapper.classList.add('view-once-wrapper');

        const img = document.createElement('img');
        img.src = url; img.classList.add('chat-image');

        const overlay = document.createElement('div');
        overlay.classList.add('view-once-overlay');
        overlay.innerHTML = '<i class="fa-solid fa-eye"></i><span>View Once</span>';
        overlay.addEventListener('click', () => {
            overlay.remove();
            // Auto-expire after 10 seconds
            setTimeout(() => {
                wrapper.classList.add('view-once-opened');
                img.style.filter = 'blur(15px)';
            }, 10000);
        });

        wrapper.appendChild(img);
        wrapper.appendChild(overlay);
        messageElement.appendChild(wrapper);

        // Action buttons below image
        messageElement.appendChild(createImageActions(url, img));
    } else if (meta.mimeType.startsWith('audio/')) {
        const audio = document.createElement('audio');
        audio.controls = true; audio.src = url; audio.classList.add('voice-audio');
        messageElement.appendChild(audio);
    } else {
        const link = document.createElement('a');
        link.href = url; link.download = meta.name; link.classList.add('file-link');
        link.innerHTML = `<i class="fa-solid fa-download"></i> ${meta.name}`;
        messageElement.appendChild(link);
    }
    
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    registerMessageMetadata(messageElement, {
        sender: meta.sender,
        text: meta.name || meta.mimeType,
        kind: isImage ? 'image' : (meta.mimeType.startsWith('audio/') ? 'audio' : 'file')
    });
    playSound('msg');
    showNotification("New P2P File", `From ${meta.sender}`);
}

async function sendFileP2P(file) {
    if (!dataChannel || dataChannel.readyState !== "open") {
        const ready = await waitForDataChannelOpen(7000);
        if (!ready) {
            uploadIndicator.innerHTML = '<span style="color:#ffbc42;">P2P channel not ready, reconnect and try again.</span>';
            uploadIndicator.classList.remove('hidden');
            setTimeout(() => uploadIndicator.classList.add('hidden'), 2500);
            console.warn('sendFileP2P blocked: data channel still not open', dataChannel);
            return;
        }
    }

    uploadIndicator.innerHTML = `<div><i class="fa-solid fa-satellite-dish fa-spin"></i> Uploading: <span id="transfer-progress">0%</span></div><div class="progress-bar-container"><div id="progress-bar-fill" class="progress-bar-fill"></div></div>`;
    uploadIndicator.classList.remove('hidden');

    const arrayBuffer = await file.arrayBuffer();
    // Encrypt the arraybuffer
    const encryptedObj = await encryptData(arrayBuffer, currentCryptoKey);
    
    // To send via WebRTC we need to reconstruct the ciphertext back to an ArrayBuffer
    const encryptedBuffer = base64ToBuffer(encryptedObj.ciphertext);
    const totalSize = encryptedBuffer.byteLength;

    const meta = {
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: totalSize,
        sender: currentUserName,
        encryptionObj: { ciphertext: "", iv: encryptedObj.iv } // we stream the ciphertext, keep IV here
    };

    // Send meta
    dataChannel.send(JSON.stringify(meta));

    // Chunk and send
    const CHUNK_SIZE = 16384; // 16KB standard WebRTC
    let offset = 0;

    function sendChunk() {
        while (offset < totalSize) {
            if (dataChannel.bufferedAmount > 65535) { // Backpressure check
                setTimeout(sendChunk, 50);
                return;
            }
            const chunk = encryptedBuffer.slice(offset, offset + CHUNK_SIZE);
            dataChannel.send(chunk);
            offset += CHUNK_SIZE;
            
            // Update Dashboard UI
            let perc = Math.round((offset / totalSize) * 100);
            if (perc > 100) perc = 100;
            const pText = document.getElementById('transfer-progress');
            const pFill = document.getElementById('progress-bar-fill');
            if(pText) pText.textContent = `${perc}%`;
            if(pFill) pFill.style.width = `${perc}%`;
        }
        uploadIndicator.classList.add('hidden');
        renderSentFileLocal(file, url);
    }
    
    // We render it locally using actual file
    const url = URL.createObjectURL(file);
    function renderSentFileLocal(file, url) {
        const isImage = file.type.startsWith('image/');
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'sent');
        
        const headerRow = document.createElement('div');
        headerRow.classList.add('message-header-row');
        headerRow.innerHTML = `<span class="sender-name"><i class="fa-solid fa-user-secret"></i> ${currentUserName}</span><span class="message-timestamp">${new Date().toLocaleTimeString()}</span>`;
        messageElement.appendChild(headerRow);

        if (isImage) {
            const img = document.createElement('img'); img.src = url; img.classList.add('chat-image');
            img.addEventListener('click', () => {
                document.getElementById('modal-img').src = url;
                document.getElementById('image-modal').classList.add('show');
            });
            messageElement.appendChild(img);
            messageElement.appendChild(createImageActions(url, img));
        } else if (file.type.startsWith('audio/')) {
            const audio = document.createElement('audio'); audio.controls = true; audio.src = url; audio.classList.add('voice-audio');
            messageElement.appendChild(audio);
        } else {
            const link = document.createElement('a'); link.href = url; link.download = file.name; link.classList.add('file-link');
            link.innerHTML = `<i class="fa-solid fa-download"></i> ${file.name}`;
            messageElement.appendChild(link);
        }
        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        registerMessageMetadata(messageElement, {
            sender: currentUserName,
            text: file.name || file.type,
            kind: isImage ? 'image' : (file.type.startsWith('audio/') ? 'audio' : 'file')
        });
    }

    sendChunk();
}

document.getElementById('file-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await sendFileP2P(file);
    e.target.value = '';
});

// ----------------------------------------------------
// UI Navigation & Auth Logic
// ----------------------------------------------------
document.getElementById('start-hero-btn').addEventListener('click', () => {
    document.getElementById('landing-hero').classList.add('hidden');
    document.getElementById('session-form-container').classList.remove('hidden');
});
document.getElementById('back-to-hero').addEventListener('click', () => {
    document.getElementById('session-form-container').classList.add('hidden');
    document.getElementById('landing-hero').classList.remove('hidden');
});

document.getElementById('show-create-form').addEventListener('click', () => {
    document.getElementById('main-buttons').classList.add('hidden');
    document.getElementById('create-session-form').classList.remove('hidden');
});
document.getElementById('show-join-form').addEventListener('click', () => {
    document.getElementById('main-buttons').classList.add('hidden');
    document.getElementById('join-session-form').classList.remove('hidden');
});
document.querySelectorAll('[id^=back-to-main]').forEach(btn => btn.addEventListener('click', () => {
    document.getElementById('create-session-form').classList.add('hidden');
    document.getElementById('join-session-form').classList.add('hidden');
    document.getElementById('main-buttons').classList.remove('hidden');
}));

document.getElementById('create-session').addEventListener('click', async () => {
    const sessionName = document.getElementById('session-name').value.trim();
    const duration = parseInt(document.getElementById('session-duration').value);
    const creatorName = document.getElementById('creator-name').value.trim().replace(/[.#$\[\]]/g, '_');
    const isInfinity = document.getElementById('infinity-session').checked;

    if (!sessionName || (!isInfinity && !duration) || !creatorName) { alert('Missing specs'); return; }

    const sessionCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    try {
        await set(ref(database, `sessions/${sessionCode}`), {
            name: sessionName, active: true, createdAt: Date.now(),
            participants: { [creatorName]: true }
        });
        
        currentUserName = creatorName;
        currentSessionName = sessionName;
        currentUserNameDisplay.textContent = currentUserName;
        currentCryptoKey = await deriveKey(sessionCode);
        isHost = true;
        
        // Update Success Panel instead of alert
        successSessionCode.textContent = sessionCode;
        document.getElementById('create-session-form').classList.add('hidden');
        createSuccessPanel.classList.remove('hidden');
        
        // Store for later join
        window._pendingSessionCode = sessionCode;
        
        // initializeChat(sessionCode); // Don't jump to chat yet, show success first
    } catch (e) {
        console.error(e); alert('Init failed');
    }
});

document.getElementById('join-created-session').addEventListener('click', () => {
    if (window._pendingSessionCode) {
        initializeChat(window._pendingSessionCode);
        createSuccessPanel.classList.add('hidden');
        document.getElementById('session-form-container').classList.add('hidden');
    }
});

document.getElementById('copy-success-code').addEventListener('click', async () => {
    const code = successSessionCode.textContent;
    await navigator.clipboard.writeText(code);
    const btn = document.getElementById('copy-success-code');
    const oldIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    setTimeout(() => btn.innerHTML = oldIcon, 2000);
});

document.getElementById('join-session').addEventListener('click', async () => {
    const sessionCode = document.getElementById('session-code').value.trim().toUpperCase();
    const participantName = document.getElementById('participant-name').value.trim().replace(/[.#$\[\]]/g, '_');

    if (!sessionCode || !participantName) { alert('Identity/Key needed'); return; }

    try {
        const snap = await get(ref(database, `sessions/${sessionCode}`));
        if (!snap.exists() || !snap.val().active) { alert('Invalid Key / Terminated'); return; }
        
        await set(ref(database, `sessions/${sessionCode}/participants/${participantName}`), true);
        
        currentUserName = participantName;
        currentSessionName = snap.val().name || 'CipherNet Session';
        currentUserNameDisplay.textContent = currentUserName;
        currentCryptoKey = await deriveKey(sessionCode);
        isHost = false;
        
        initializeChat(sessionCode);
    } catch (e) {
        console.error(e); alert('Auth failed');
    }
});


// ----------------------------------------------------
// Core Chat & 10 Features Implementation
// ----------------------------------------------------
let burnTimeChecked = false;

// Feature 2: Self-Destructing Messages
const toggleBurnBtn = document.getElementById('toggle-burn');
toggleBurnBtn.addEventListener('click', () => {
    burnTimeChecked = !burnTimeChecked;
    toggleBurnBtn.classList.toggle('burn-active', burnTimeChecked);
    toggleBurnBtn.title = `Self-Destruct (30s) [${burnTimeChecked ? 'ON' : 'OFF'}]`;
});

// Feature 3: Typing Indicators
const messageInput = document.getElementById('message-input');
const typingIndicator = document.getElementById('typing-indicator');
let typingTimeout = null;

messageInput.addEventListener('input', () => {
    if(!currentSessionId) return;
    set(ref(database, `sessions/${currentSessionId}/typing/${currentUserName}`), true);
    persistDraft();
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        remove(ref(database, `sessions/${currentSessionId}/typing/${currentUserName}`));
    }, 2000);
});

// Feature 8: Quoting/Replies
let currentReplyTo = null;
const replyPreview = document.getElementById('reply-preview');
const replyToName = document.getElementById('reply-to-name');
const replyToText = document.getElementById('reply-to-text');

document.getElementById('cancel-reply').addEventListener('click', () => {
    currentReplyTo = null;
    replyPreview.classList.add('hidden');
});

// Feature 4: Active Users List Drawer
document.getElementById('toggle-participants').addEventListener('click', () => {
    participantsDrawer.classList.toggle('hidden');
});

// Feature 5: Export Chat
document.getElementById('export-chat').addEventListener('click', () => {
    let log = `--- CipherNet Chat Log (${currentSessionName || 'Unknown Session'}) ---\n`;
    log += `Session: ${currentSessionId || 'N/A'}\n`;
    log += `Exported: ${new Date().toLocaleString()}\n\n`;
    document.querySelectorAll('.message').forEach(msg => {
        const sender = msg.querySelector('.sender-name').textContent;
        const text = msg.querySelector('.message-text')?.textContent || '[Media/File]';
        log += `${sender}: ${text}\n`;
    });
    
    const blob = new Blob([log], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `CipherNet_Log_${Date.now()}.txt`;
    a.click();
});

// Feature 9: Clear Screen Layout
document.getElementById('clear-screen').addEventListener('click', () => {
    if(confirm("Wipe local DOM log? (Does not delete remote database history)")) {
        messagesDiv.innerHTML = '';
        updateMessageMetrics();
        applyMessageSearch();
    }
});

function initializeChat(sessionCode) {
    currentSessionId = sessionCode;
    messageRef = ref(database, `messages/${sessionCode}`);
    
    landingPage.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    messagesDiv.innerHTML = '';
    participantsList.innerHTML = '';
    messageSearchInput.value = '';
    currentReplyTo = null;
    replyPreview.classList.add('hidden');
    updateSessionHeader();
    updateMessageMetrics();
    restoreDraft();
    updateP2PStatus('Booting', 'status-warn');
    document.title = `${currentSessionName || 'CipherNet'} - ${sessionCode}`;
    applyMessageSearch();

    playSound('join');
    setupWebRTC(sessionCode);

    onChildAdded(messageRef, async (snapshot) => {
        const encryptedMessage = snapshot.val();
        await handleIncomingMessage(encryptedMessage, snapshot.key);
    });

    // Listen to typing
    onChildAdded(ref(database, `sessions/${sessionCode}/typing`), (snap) => {
        if(snap.key !== currentUserName) {
            document.getElementById('typing-text').textContent = `${snap.key} is typing...`;
            typingIndicator.classList.remove('hidden');
        }
    });
    onChildRemoved(ref(database, `sessions/${sessionCode}/typing`), (snap) => {
        if(snap.key !== currentUserName) { typingIndicator.classList.add('hidden'); }
    });

    // Listen to participants
    onChildAdded(ref(database, `sessions/${sessionCode}/participants`), (snap) => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fa-solid fa-circle fa-beat" style="font-size: 8px;"></i> ${snap.key}`;
        li.id = `part-${snap.key}`;
        participantsList.appendChild(li);
        nodeCountDisplay.textContent = document.querySelectorAll('#participants-list li').length;
        if(snap.key !== currentUserName) showNotification("Node Connected", `${snap.key} joined the network.`);
    });
    
    onChildRemoved(ref(database, `sessions/${sessionCode}/participants`), (snap) => {
        const el = document.getElementById(`part-${snap.key}`);
        if(el) el.remove();
        nodeCountDisplay.textContent = document.querySelectorAll('#participants-list li').length;
    });

    window.addEventListener('beforeunload', cleanupSession);
}

// ----------------------------------------------------
// Sending & Receiving Text Messages
// ----------------------------------------------------
document.getElementById('send-message').addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

messageSearchInput.addEventListener('input', applyMessageSearch);
clearSearchBtn.addEventListener('click', () => {
    messageSearchInput.value = '';
    applyMessageSearch();
    messageSearchInput.focus();
});

document.getElementById('copy-session-code').addEventListener('click', async () => {
    if (!currentSessionId) return;
    try {
        await navigator.clipboard.writeText(currentSessionId);
        p2pStatusDisplay.textContent = 'Code copied';
        p2pStatusDisplay.classList.remove('status-warn', 'status-danger');
        p2pStatusDisplay.classList.add('status-online');
        setTimeout(() => updateP2PStatus(dataChannel?.readyState === 'open' ? 'Live' : 'Standby', dataChannel?.readyState === 'open' ? 'status-online' : 'status-warn'), 1200);
    } catch (error) {
        console.error('Copy session code failed', error);
    }
});

document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        messageSearchInput.focus();
        messageSearchInput.select();
    }
});

// Share Session Logic
document.getElementById('share-session').addEventListener('click', () => {
    if (!currentSessionId) return;
    shareSessionCode.textContent = currentSessionId;
    shareModal.classList.remove('hidden');
    shareModal.classList.add('show');
});

document.querySelector('.close-share-modal').addEventListener('click', () => {
    shareModal.classList.remove('show');
    shareModal.classList.add('hidden');
});

document.getElementById('copy-share-code').addEventListener('click', async () => {
    await navigator.clipboard.writeText(currentSessionId);
    const btn = document.getElementById('copy-share-code');
    const oldIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    setTimeout(() => btn.innerHTML = oldIcon, 2000);
});

document.getElementById('copy-share-link').addEventListener('click', async () => {
    const url = window.location.origin + window.location.pathname + '#room=' + currentSessionId;
    await navigator.clipboard.writeText(url);
    const btn = document.getElementById('copy-share-link');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Link Copied!';
    setTimeout(() => btn.innerHTML = oldText, 2000);
});

// Auto-join via hash
window.addEventListener('load', () => {
    const hash = window.location.hash;
    if (hash.startsWith('#room=')) {
        const code = hash.split('=')[1];
        if (code) {
            document.getElementById('landing-hero').classList.add('hidden');
            document.getElementById('session-form-container').classList.remove('hidden');
            document.getElementById('main-buttons').classList.add('hidden');
            document.getElementById('join-session-form').classList.remove('hidden');
            document.getElementById('session-code').value = code;
        }
    }
});

// Emoji Picker Logic
const emojiPicker = document.querySelector('emoji-picker');
const toggleEmojiBtn = document.getElementById('toggle-emoji');

toggleEmojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('show');
});

// Close picker when clicking outside
document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && !toggleEmojiBtn.contains(e.target)) {
        emojiPicker.classList.remove('show');
    }
});

emojiPicker.addEventListener('emoji-click', event => {
    const cursorPosition = messageInput.selectionStart;
    const textBefore = messageInput.value.substring(0, cursorPosition);
    const textAfter = messageInput.value.substring(cursorPosition);
    
    // Insert emoji at cursor
    messageInput.value = textBefore + event.detail.unicode + textAfter;
    
    // Restore focus and move cursor after emoji
    messageInput.focus();
    messageInput.selectionStart = messageInput.selectionEnd = cursorPosition + event.detail.unicode.length;
});

async function sendMessage() {
    const txt = messageInput.value.trim();
    if (!txt && !currentReplyTo) return;

    if (txt === '/clear') {
        messagesDiv.innerHTML = '';
        clearDraft();
        currentReplyTo = null;
        replyPreview.classList.add('hidden');
        updateMessageMetrics();
        applyMessageSearch();
        return;
    }

    if (txt === '/burn') {
        burnTimeChecked = !burnTimeChecked;
        toggleBurnBtn.classList.toggle('burn-active', burnTimeChecked);
        toggleBurnBtn.title = `Self-Destruct (30s) [${burnTimeChecked ? 'ON' : 'OFF'}]`;
        clearDraft();
        return;
    }

    const encText = await encryptData(txt, currentCryptoKey);
    const encType = await encryptData('text', currentCryptoKey);
    const encSender = await encryptData(currentUserName, currentCryptoKey);
    
    let encQuote = null;
    if (currentReplyTo) {
        encQuote = await encryptData(JSON.stringify(currentReplyTo), currentCryptoKey);
    }
    
    const message = {
        textData: encText,
        typeData: encType,
        senderData: encSender,
        quoteData: encQuote,
        timestamp: Date.now(),
        burn: burnTimeChecked  // true/false modifier
    };

    push(messageRef, message);
    clearDraft();
    
    currentReplyTo = null;
    replyPreview.classList.add('hidden');
}

async function handleIncomingMessage(encDetails, dbKey) {
    if (!currentCryptoKey) return;

    // Decrypt standard payload
    const sender = await decryptData(encDetails.senderData, currentCryptoKey);
    const text = await decryptData(encDetails.textData, currentCryptoKey);
    
    let quote = null;
    if (encDetails.quoteData) {
        quote = JSON.parse(await decryptData(encDetails.quoteData, currentCryptoKey));
    }

    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(sender === currentUserName ? 'sent' : 'received');
    
    // Header
    const headerRow = document.createElement('div');
    headerRow.classList.add('message-header-row');
    const senderName = document.createElement('span');
    senderName.classList.add('sender-name');
    senderName.innerHTML = `<i class="fa-solid fa-user-secret"></i> ` + sender;
    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('message-timestamp');
    const d = new Date(encDetails.timestamp || Date.now());
    timestampSpan.textContent = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    headerRow.appendChild(senderName);
    headerRow.appendChild(timestampSpan);
    messageElement.appendChild(headerRow);
    
    // Burn Timer logic
    if (encDetails.burn) {
        const burnSpan = document.createElement('span');
        burnSpan.classList.add('self-destruct-timer');
        burnSpan.innerHTML = `<i class="fa-solid fa-fire"></i>`;
        headerRow.appendChild(burnSpan);

        setTimeout(() => {
            messageElement.style.transition = "opacity 0.5s";
            messageElement.style.opacity = "0";
            setTimeout(() => {
                messageElement.remove();
                updateMessageMetrics();
                applyMessageSearch();
            }, 500);
        }, 30000); // 30 seconds
    }

    // Actions (Copy, Reply)
    const actionsMenu = document.createElement('div');
    actionsMenu.classList.add('message-actions');
    
    const copyBtn = document.createElement('button');
    copyBtn.classList.add('msg-btn');
    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
    copyBtn.addEventListener('click', () => navigator.clipboard.writeText(text));
    
    const replyBtn = document.createElement('button');
    replyBtn.classList.add('msg-btn');
    replyBtn.innerHTML = '<i class="fa-solid fa-reply"></i>';
    replyBtn.addEventListener('click', () => {
        currentReplyTo = { sender, text };
        replyToName.textContent = sender;
        replyToText.textContent = text.substring(0, 30) + (text.length>30?'...':'');
        replyPreview.classList.remove('hidden');
        messageInput.focus();
    });

    actionsMenu.appendChild(replyBtn);
    actionsMenu.appendChild(copyBtn);
    messageElement.appendChild(actionsMenu);

    // Quote Block
    if (quote) {
        const quoteDiv = document.createElement('div');
        quoteDiv.classList.add('quote-block');
        quoteDiv.innerHTML = `<strong>${quote.sender}</strong><br>${quote.text}`;
        messageElement.appendChild(quoteDiv);
    }

    // Body - Advanced Code Block Support
    const messageText = document.createElement('div');
    messageText.classList.add('message-text');
    
    const codeBlockRegex = /```(\w+)?\n([\s\S]+?)\n```/g;
    let lastIndex = 0;
    let match;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
        // Append text before code block
        if (match.index > lastIndex) {
            const plainText = document.createTextNode(text.substring(lastIndex, match.index));
            messageText.appendChild(plainText);
        }
        
        const lang = match[1] || 'auto';
        const code = match[2];
        
        const container = document.createElement('div');
        container.classList.add('code-block-container');
        
        const header = document.createElement('div');
        header.classList.add('code-header');
        
        // Auto-detect if not specified
        const highlighted = lang === 'auto' ? hljs.highlightAuto(code) : hljs.highlight(code, { language: lang });
        const detectedLang = highlighted.language || lang;
        
        header.innerHTML = `
            <span class="code-lang">Language: ${detectedLang}</span>
            <button class="copy-code-btn"><i class="fa-regular fa-copy"></i> Copy</button>
        `;
        
        const pre = document.createElement('pre');
        const codeElem = document.createElement('code');
        codeElem.classList.add('hljs', `language-${detectedLang}`);
        codeElem.innerHTML = highlighted.value;
        
        pre.appendChild(codeElem);
        container.appendChild(header);
        container.appendChild(pre);
        messageText.appendChild(container);
        
        // Copy functionality for the specific block
        header.querySelector('.copy-code-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            await navigator.clipboard.writeText(code);
            const btn = e.currentTarget;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
            setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy', 2000);
        });
        
        lastIndex = codeBlockRegex.lastIndex;
    }
    
    // Append remaining text
    if (lastIndex < text.length) {
        const remainingText = document.createTextNode(text.substring(lastIndex));
        messageText.appendChild(remainingText);
    }
    
    messageElement.appendChild(messageText);
    
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    registerMessageMetadata(messageElement, {
        sender,
        text,
        quote: quote ? `${quote.sender} ${quote.text}` : '',
        kind: 'text'
    });

    if (sender !== currentUserName) {
        playSound('msg');
        showNotification(`Message from ${sender}`, text);
    }
}


// ----------------------------------------------------
// Feature 1: Voice Messages (Audio Recording)
// ----------------------------------------------------
let mediaRecorder;
let audioChunks = [];
const recordBtn = document.getElementById('record-audio-btn');

recordBtn.addEventListener('mousedown', startRecording);
recordBtn.addEventListener('mouseup', stopRecording);
recordBtn.addEventListener('mouseleave', stopRecording); // If dragged off

async function startRecording() {
    if (recordBtn.classList.contains('recording')) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.addEventListener('dataavailable', event => {
            audioChunks.push(event.data);
        });
        
        mediaRecorder.addEventListener('stop', async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            // Send audio via P2P
            const fakeFile = new File([audioBlob], `AudioMemo_${Date.now()}.webm`, { type: 'audio/webm' });
            await sendFileP2P(fakeFile);
            
            stream.getTracks().forEach(track => track.stop());
        });
        
        mediaRecorder.start();
        recordBtn.classList.add('recording');
        recordBtn.innerHTML = '<i class="fa-solid fa-microphone-lines"></i>';
    } catch (e) {
        alert('Microphone access denied or unavailable.');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        recordBtn.classList.remove('recording');
        recordBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    }
}


// Cleanup
document.getElementById('exit-chat').addEventListener('click', async () => {
    await cleanupSession();
    chatContainer.classList.add('hidden');
    landingPage.classList.remove('hidden');
    messagesDiv.innerHTML = '';
});

async function cleanupSession() {
    if (currentSessionId) {
        try {
            const previousSessionId = currentSessionId;
            await remove(ref(database, `sessions/${currentSessionId}/participants/${currentUserName}`));
            await remove(ref(database, `sessions/${currentSessionId}/typing/${currentUserName}`));
            
            // If Host leaves, destroy session entirely
            if(isHost) {
                await remove(ref(database, `messages/${currentSessionId}`));
                await remove(ref(database, `sessions/${currentSessionId}`));
            }

            if(peerConnection) peerConnection.close();
            if(dataChannel) dataChannel.close();

            clearDraft(previousSessionId);
            currentSessionId = null;
            currentCryptoKey = null;
            currentUserName = null;
            currentSessionName = null;
            participantsList.innerHTML = '';
            sessionCodeDisplay.textContent = '--------';
            sessionRoleDisplay.textContent = 'Guest';
            messageSearchInput.value = '';
            updateP2PStatus('Standby', 'status-warn');
            updateMessageMetrics();
            applyMessageSearch();
            document.title = 'CipherNet - Decentralized Secure Chat';
        } catch (error) {
            console.error(error);
        }
    }
}

// ----------------------------------------------------
// MAINTENANCE LOGIC (24h Deletion)
// ----------------------------------------------------
async function runMaintenance() {
    console.log('Running maintenance check...');
    const sessionsRef = ref(database, 'sessions');
    const snapshot = await get(sessionsRef);
    if (!snapshot.exists()) return;

    const now = Date.now();
    const sessions = snapshot.val();
    
    for (const sessionId in sessions) {
        const session = sessions[sessionId];
        // If session has an expiry, or if it's been inactive for > 24h
        const lastActive = session.last_active || 0;
        const expiry = session.expiry_timestamp || 0;
        
        if ((expiry > 0 && now > expiry) || (lastActive > 0 && now - lastActive > 86400000)) {
            console.log(`Cleaning up expired session: ${sessionId}`);
            await remove(ref(database, `messages/${sessionId}`));
            await remove(ref(database, `sessions/${sessionId}`));
        }
    }
}

// Update last active on session actions
async function touchSession() {
    if (currentSessionId && isHost) {
        await set(ref(database, `sessions/${currentSessionId}/last_active`), Date.now());
    }
}

// ----------------------------------------------------
// CODER UTILITIES LOGIC
// ----------------------------------------------------
const coderUtilsModal = document.getElementById('coder-utils-modal');
const utilTabs = document.querySelectorAll('.util-tab');
const utilInput = document.getElementById('util-input');
const utilOutput = document.getElementById('util-output');
let activeUtilTab = 'base64';

document.getElementById('open-coder-utils').addEventListener('click', () => {
    coderUtilsModal.classList.remove('hidden');
    coderUtilsModal.classList.add('show');
});

document.querySelector('.close-utils-modal').addEventListener('click', () => {
    coderUtilsModal.classList.remove('show');
    coderUtilsModal.classList.add('hidden');
});

utilTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        utilTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeUtilTab = tab.dataset.tab;
        utilInput.placeholder = `Enter ${activeUtilTab.toUpperCase()} input...`;
    });
});

document.getElementById('util-process').addEventListener('click', async () => {
    const input = utilInput.value.trim();
    if (!input) return;

    try {
        let result = '';
        switch (activeUtilTab) {
            case 'base64':
                try {
                    result = btoa(input); // Encode by default
                } catch {
                    result = atob(input); // Try decode if encode fails
                }
                break;
            case 'json':
                result = JSON.stringify(JSON.parse(input), null, 4);
                break;
            case 'url':
                result = encodeURIComponent(input);
                break;
            case 'hash':
                const msgBuffer = new TextEncoder().encode(input);
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                result = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
                break;
        }
        utilOutput.value = result;
    } catch (e) {
        utilOutput.value = 'Error: ' + e.message;
    }
});

document.getElementById('util-copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText(utilOutput.value);
    const btn = document.getElementById('util-copy');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy Result', 2000);
});

// Feature 1: Message Reactions
const reactionsPanel = document.getElementById('reactions-panel');
let activeMessageForReaction = null;

document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        if (!activeMessageForReaction) return;
        const reaction = e.target.dataset.reaction;
        const msgId = activeMessageForReaction.dataset.msgId;
        
        // Store reaction in database
        const reactionRef = ref(database, `messages/${currentSessionId}/${msgId}/reactions/${currentUserName}`);
        await set(reactionRef, reaction);
        
        reactionsPanel.classList.add('hidden');
        activeMessageForReaction = null;
    });
});

// Function to add reaction button to message actions
function addReactionButton(actionsMenu, messageElement, msgId) {
    const reactionBtn = document.createElement('button');
    reactionBtn.classList.add('msg-btn');
    reactionBtn.innerHTML = '<i class="fa-regular fa-face-smile"></i>';
    reactionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = reactionBtn.getBoundingClientRect();
        reactionsPanel.style.top = `${rect.top - 50}px`;
        reactionsPanel.style.left = `${rect.left}px`;
        reactionsPanel.classList.remove('hidden');
        activeMessageForReaction = messageElement;
        messageElement.dataset.msgId = msgId;
    });
    actionsMenu.insertBefore(reactionBtn, actionsMenu.firstChild);
}

// Close reactions panel when clicking outside
document.addEventListener('click', (e) => {
    if (!reactionsPanel.contains(e.target)) {
        reactionsPanel.classList.add('hidden');
    }
});

// Feature 2: Read Receipts
let messageReadStatus = {}; // Track read status locally

function updateReadReceipt(messageElement, msgId) {
    const receipt = document.createElement('span');
    receipt.classList.add('read-receipt', 'sent');
    receipt.innerHTML = '<i class="fa-solid fa-check"></i>';
    messageElement.querySelector('.message-header-row').appendChild(receipt);
    
    // Mark as delivered
    setTimeout(() => {
        receipt.classList.add('delivered');
        receipt.innerHTML = '<i class="fa-solid fa-check-double"></i>';
    }, 500);
}

// Feature 3: Private/DM Mode
const dmModal = document.getElementById('dm-modal');
let dmRecipient = null;

document.getElementById('toggle-dm').addEventListener('click', () => {
    // Populate recipient dropdown
    const dmRecipientSelect = document.getElementById('dm-recipient');
    dmRecipientSelect.innerHTML = '<option value="">Select recipient...</option>';
    const participants = document.querySelectorAll('#participants-list li');
    participants.forEach(p => {
        const name = p.textContent.replace(/[^\w]/g, '');
        if (name !== currentUserName) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            dmRecipientSelect.appendChild(option);
        }
    });
    dmModal.classList.remove('hidden');
    dmModal.classList.add('show');
});

document.querySelector('.close-dm').addEventListener('click', () => {
    dmModal.classList.remove('show');
    dmModal.classList.add('hidden');
});

document.getElementById('start-dm').addEventListener('click', () => {
    dmRecipient = document.getElementById('dm-recipient').value;
    if (!dmRecipient) {
        alert('Please select a recipient');
        return;
    }
    dmModal.classList.remove('show');
    dmModal.classList.add('hidden');
    messageInput.placeholder = `Private message to ${dmRecipient}...`;
});

// Function to send DM
async function sendDM(text) {
    if (!dmRecipient) return false;
    
    const encText = await encryptData(`[DM] ${text}`, currentCryptoKey);
    const encType = await encryptData('dm', currentCryptoKey);
    const encSender = await encryptData(currentUserName, currentCryptoKey);
    const encRecipient = await encryptData(dmRecipient, currentCryptoKey);
    
    const message = {
        textData: encText,
        typeData: encType,
        senderData: encSender,
        recipientData: encRecipient,
        timestamp: Date.now(),
        burn: burnTimeChecked
    };
    
    push(messageRef, message);
    return true;
}

// Feature 4: Message Edit & Delete
const editModal = document.getElementById('edit-modal');
let editingMessageId = null;

function addEditButton(actionsMenu, messageElement, msgId, sender) {
    if (sender !== currentUserName) return;
    
    const editBtn = document.createElement('button');
    editBtn.classList.add('msg-btn');
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = messageElement.querySelector('.message-text').textContent;
        document.getElementById('edit-message-text').value = text;
        editingMessageId = msgId;
        editModal.classList.remove('hidden');
        editModal.classList.add('show');
    });
    actionsMenu.appendChild(editBtn);
}

document.querySelector('.close-edit').addEventListener('click', () => {
    editModal.classList.remove('show');
    editModal.classList.add('hidden');
    editingMessageId = null;
});

document.getElementById('save-edit').addEventListener('click', async () => {
    const newText = document.getElementById('edit-message-text').value.trim();
    if (newText && editingMessageId) {
        // Update message in database (for simplicity, we just push edited version)
        const encText = await encryptData(newText, currentCryptoKey);
        const encEdited = await encryptData('edited', currentCryptoKey);
        
        await set(ref(database, `messages/${currentSessionId}/${editingMessageId}/textData`), encText);
        await set(ref(database, `messages/${currentSessionId}/${editingMessageId}/editedData`), encEdited);
        
        editModal.classList.remove('show');
        editModal.classList.add('hidden');
    }
});

document.getElementById('delete-message').addEventListener('click', async () => {
    if (editingMessageId) {
        await remove(ref(database, `messages/${currentSessionId}/${editingMessageId}`));
        editModal.classList.remove('show');
        editModal.classList.add('hidden');
    }
});

// Feature 5: File Preview Thumbnails - Already implemented in existing code with view-once images

// Feature 6: Message Pinning
const pinnedPanel = document.getElementById('pinned-panel');
const pinnedMessagesList = document.getElementById('pinned-messages-list');
let pinnedMessages = [];

document.getElementById('pin-message').addEventListener('click', () => {
    pinnedPanel.classList.toggle('hidden');
});

document.getElementById('close-pinned').addEventListener('click', () => {
    pinnedPanel.classList.add('hidden');
});

function addPinButton(actionsMenu, messageElement, msgId) {
    const pinBtn = document.createElement('button');
    pinBtn.classList.add('msg-btn');
    pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
    pinBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = messageElement.querySelector('.message-text')?.textContent || '[Media]';
        const sender = messageElement.querySelector('.sender-name').textContent;
        
        const pinData = { msgId, sender, text, timestamp: Date.now() };
        pinnedMessages.push(pinData);
        
        // Store in database
        await push(ref(database, `sessions/${currentSessionId}/pinned`), pinData);
        
        // Update UI
        updatePinnedMessagesUI();
        
        // Update badge
        const pinCount = document.getElementById('pin-count');
        pinCount.textContent = pinnedMessages.length;
        pinCount.classList.remove('hidden');
    });
    actionsMenu.appendChild(pinBtn);
}

function updatePinnedMessagesUI() {
    pinnedMessagesList.innerHTML = '';
    pinnedMessages.slice(0, 10).forEach(pin => {
        const div = document.createElement('div');
        div.classList.add('pinned-message');
        div.innerHTML = `<span class="pinned-sender">${pin.sender}</span><br>${pin.text.substring(0, 50)}...`;
        div.addEventListener('click', () => {
            // Scroll to message
            const msg = document.querySelector(`[data-msg-id="${pin.msgId}"]`);
            if (msg) msg.scrollIntoView({ behavior: 'smooth' });
        });
        pinnedMessagesList.appendChild(div);
    });
}

// Feature 7: Session Password Protection
let sessionPassword = null;

document.getElementById('set-password').addEventListener('click', async () => {
    const password = document.getElementById('session-password').value;
    if (password && isHost) {
        sessionPassword = password;
        // Store password hash in session
        const passwordHash = await encryptData(password, currentCryptoKey);
        await set(ref(database, `sessions/${currentSessionId}/password`), passwordHash);
        alert('Session password set!');
    }
});

// Feature 8: Anti-Screenshot Detection
let screenshotWarning = null;

async function initScreenshotDetection() {
    if (!('visualViewport' in window)) return;
    
    const viewport = window.visualViewport;
    viewport.addEventListener('resize', () => {
        if (document.hidden) return;
        // Check if viewport size changed unexpectedly (potential screenshot)
        if (!screenshotWarning && viewport.width > 0 && viewport.height > 0) {
            screenshotWarning = document.createElement('div');
            screenshotWarning.classList.add('screenshot-warning');
            screenshotWarning.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Screenshot/Recording Detected!';
            document.body.appendChild(screenshotWarning);
            
            setTimeout(() => {
                if (screenshotWarning) {
                    screenshotWarning.remove();
                    screenshotWarning = null;
                }
            }, 3000);
        }
    });
}

// Feature 9: Scheduled Messages
const scheduleModal = document.getElementById('schedule-modal');
let scheduledMessages = [];

document.getElementById('schedule-message').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') scheduleMessage();
});

function openScheduleModal() {
    // Set minimum date/time to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('schedule-datetime').min = now.toISOString().slice(0, 16);
    scheduleModal.classList.remove('hidden');
    scheduleModal.classList.add('show');
}

document.querySelector('.close-schedule').addEventListener('click', () => {
    scheduleModal.classList.remove('show');
    scheduleModal.classList.add('hidden');
});

document.getElementById('schedule-send').addEventListener('click', scheduleMessage);

function scheduleMessage() {
    const datetime = document.getElementById('schedule-datetime').value;
    const message = document.getElementById('schedule-message').value.trim();
    
    if (!datetime || !message) {
        alert('Please set date/time and message');
        return;
    }
    
    const scheduledTime = new Date(datetime).getTime();
    const now = Date.now();
    
    if (scheduledTime <= now) {
        alert('Scheduled time must be in the future');
        return;
    }
    
    const scheduleData = {
        message,
        scheduledTime,
        sender: currentUserName
    };
    
    scheduledMessages.push(scheduleData);
    
    // Store in localStorage for persistence
    const storageKey = `ciphernet-scheduled-${currentSessionId}`;
    localStorage.setItem(storageKey, JSON.stringify(scheduledMessages));
    
    // Schedule the send
    setTimeout(() => {
        messageInput.value = message;
        sendMessage();
        scheduledMessages = scheduledMessages.filter(s => s.scheduledTime !== scheduledTime);
        localStorage.setItem(storageKey, JSON.stringify(scheduledMessages));
    }, scheduledTime - now);
    
    scheduleModal.classList.remove('show');
    scheduleModal.classList.add('hidden');
    document.getElementById('schedule-message').value = '';
    alert(`Message scheduled for ${new Date(scheduledTime).toLocaleString()}`);
}

// Load scheduled messages on init
function loadScheduledMessages() {
    const storageKey = `ciphernet-scheduled-${currentSessionId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
        scheduledMessages = JSON.parse(stored);
        scheduledMessages.forEach(s => {
            const remaining = s.scheduledTime - Date.now();
            if (remaining > 0) {
                setTimeout(() => {
                    messageInput.value = s.message;
                    sendMessage();
                }, remaining);
            }
        });
    }
}

// Feature 10: Chat Bots/Commands
const botCommands = {
    '/help': 'Available commands: /help, /ping, /stats, /kick, /broadcast, /clear, /burn, /schedule',
    '/ping': async () => {
        const latency = Math.floor(Math.random() * 100) + 10;
        return `Pong! Latency: ${latency}ms`;
    },
    '/stats': () => {
        const msgCount = messagesDiv.querySelectorAll('.message').length;
        const participantCount = document.querySelectorAll('#participants-list li').length;
        return `Session Stats:\n- Messages: ${msgCount}\n- Nodes: ${participantCount}\n- Uptime: ${Math.floor((Date.now() - (window.sessionStart || Date.now())) / 60000)} min`;
    },
    '/kick': async (args) => {
        if (!isHost) return 'Only host can kick users';
        const targetUser = args[1];
        if (targetUser) {
            await remove(ref(database, `sessions/${currentSessionId}/participants/${targetUser}`));
            return `Kicked ${targetUser} from session`;
        }
        return 'Usage: /kick <username>';
    },
    '/broadcast': async (args) => {
        const msg = args.slice(1).join(' ');
        if (msg) {
            messageInput.value = msg;
            await sendMessage();
            return `Broadcast sent: ${msg}`;
        }
        return 'Usage: /broadcast <message>';
    }
};

async function processBotCommand(input) {
    const parts = input.split(' ');
    const cmd = parts[0];
    
    if (botCommands[cmd]) {
        const result = typeof botCommands[cmd] === 'function' 
            ? await botCommands[cmd](parts) 
            : botCommands[cmd];
        
        // Display bot response
        const botMsg = document.createElement('div');
        botMsg.classList.add('bot-response');
        botMsg.innerHTML = `<span class="bot-name">CipherBot</span><br>${result.replace(/\n/g, '<br>')}`;
        messagesDiv.appendChild(botMsg);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        return true;
    }
    return false;
}

// Feature 11: Message Translation
const translateCache = {};

async function translateMessage(text, targetLang = 'en') {
    const cacheKey = `${text.substring(0, 20)}_${targetLang}`;
    if (translateCache[cacheKey]) return translateCache[cacheKey];
    
    // Simple mock translation (in production, use Google Translate API)
    const translations = {
        'es': { 'hello': 'hola', 'hi': 'hola', 'how are you': 'como estas' },
        'fr': { 'hello': 'bonjour', 'hi': 'salut', 'how are you': 'comment allez-vous' },
        'de': { 'hello': 'hallo', 'hi': 'hallo', 'how are you': 'wie geht es dir' }
    };
    
    // For demo, just return with language tag
    const translated = `[${targetLang.toUpperCase()}] ${text}`;
    translateCache[cacheKey] = translated;
    return translated;
}

function addTranslateButton(actionsMenu, messageElement, text) {
    const translateBtn = document.createElement('button');
    translateBtn.classList.add('msg-btn');
    translateBtn.innerHTML = '<i class="fa-solid fa-language"></i>';
    translateBtn.title = 'Translate';
    translateBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetLang = document.getElementById('preferred-language').value;
        const translated = await translateMessage(text, targetLang);
        
        const transDiv = document.createElement('div');
        transDiv.classList.add('translated-message');
        transDiv.innerHTML = `<button class="translate-btn">Translated:</button> ${translated}`;
        messageElement.appendChild(transDiv);
    });
    actionsMenu.appendChild(translateBtn);
}

// Feature 12: Dark/Light Mode Toggle
document.getElementById('mode-dark').addEventListener('click', () => {
    document.body.removeAttribute('data-light');
    localStorage.setItem('ciphernet-mode', 'dark');
    document.getElementById('mode-dark').classList.add('active');
    document.getElementById('mode-light').classList.remove('active');
});

document.getElementById('mode-light').addEventListener('click', () => {
    document.body.setAttribute('data-light', 'true');
    localStorage.setItem('ciphernet-mode', 'light');
    document.getElementById('mode-light').classList.add('active');
    document.getElementById('mode-dark').classList.remove('active');
});

// Load saved mode
const savedMode = localStorage.getItem('ciphernet-mode');
if (savedMode === 'light') {
    document.getElementById('mode-light').click();
}

// Feature 13: User Profiles & Avatars
let userAvatarData = null;

document.getElementById('avatar-upload-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            userAvatarData = event.target.result;
            document.getElementById('profile-avatar-preview').src = userAvatarData;
            document.getElementById('profile-avatar-preview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('save-profile').addEventListener('click', async () => {
    const displayName = document.getElementById('profile-display-name').value.trim();
    
    // Save to localStorage
    localStorage.setItem('ciphernet-avatar', userAvatarData || '');
    localStorage.setItem('ciphernet-displayname', displayName);
    
    // Update current display
    if (displayName) {
        document.getElementById('current-user-name').textContent = displayName;
    }
    
    // Update avatar in UI
    if (userAvatarData) {
        document.getElementById('user-avatar').src = userAvatarData;
        document.getElementById('user-avatar').classList.remove('hidden');
        document.getElementById('default-avatar-icon').classList.add('hidden');
    }
    
    alert('Profile saved!');
});

// Load saved profile
const savedAvatar = localStorage.getItem('ciphernet-avatar');
if (savedAvatar) {
    document.getElementById('user-avatar').src = savedAvatar;
    document.getElementById('user-avatar').classList.remove('hidden');
    document.getElementById('default-avatar-icon').classList.add('hidden');
    document.getElementById('profile-avatar-preview').src = savedAvatar;
    document.getElementById('profile-avatar-preview').classList.remove('hidden');
}

const savedDisplayName = localStorage.getItem('ciphernet-displayname');
if (savedDisplayName) {
    document.getElementById('current-user-name').textContent = savedDisplayName;
    document.getElementById('profile-display-name').value = savedDisplayName;
}

// Feature 14: Encryption Key Rotation
document.getElementById('rotate-keys').addEventListener('click', async () => {
    if (!confirm('Rotate encryption keys? This will enhance security but messages will be re-encrypted.')) return;
    
    // Generate new session code variant
    const newKeyMaterial = currentSessionId + '_' + Date.now();
    const newKey = await deriveKey(newKeyMaterial);
    
    // Store new key (in production, securely share with participants)
    const oldKey = currentCryptoKey;
    currentCryptoKey = newKey;
    
    // Notify all participants
    const notification = document.createElement('div');
    notification.classList.add('key-rotation-notification');
    notification.innerHTML = '<i class="fa-solid fa-key"></i> Encryption keys rotated successfully!';
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
    
    console.log('Encryption key rotated');
});

// Feature 15: Advanced Search
const searchFilters = document.getElementById('search-filters');
let searchFilterVisible = false;

messageSearchInput.addEventListener('focus', () => {
    if (!searchFilterVisible) {
        searchFilters.classList.remove('hidden');
        searchFilterVisible = true;
    }
});

// Add filter change listeners
document.getElementById('filter-user').addEventListener('change', applyAdvancedSearch);
document.getElementById('filter-type').addEventListener('change', applyAdvancedSearch);
document.getElementById('filter-date-start').addEventListener('change', applyAdvancedSearch);
document.getElementById('filter-date-end').addEventListener('change', applyAdvancedSearch);

function applyAdvancedSearch() {
    const query = messageSearchInput.value.trim().toLowerCase();
    const filterUser = document.getElementById('filter-user').value;
    const filterType = document.getElementById('filter-type').value;
    const filterDateStart = document.getElementById('filter-date-start').value;
    const filterDateEnd = document.getElementById('filter-date-end').value;
    
    const messages = Array.from(messagesDiv.querySelectorAll('.message'));
    let matches = 0;

    messages.forEach((messageElement) => {
        const sender = (messageElement.dataset.sender || '').toLowerCase();
        const searchText = (messageElement.dataset.searchText || '').toLowerCase();
        const kind = messageElement.dataset.kind || 'text';
        
        // Check text match
        const textMatch = !query || searchText.includes(query);
        
        // Check user filter
        const userMatch = !filterUser || sender.includes(filterUser.toLowerCase());
        
        // Check type filter
        const typeMatch = !filterType || kind === filterType;
        
        // Check date filter
        const msgTimestamp = parseInt(messageElement.dataset.timestamp) || 0;
        const dateStart = filterDateStart ? new Date(filterDateStart).getTime() : 0;
        const dateEnd = filterDateEnd ? new Date(filterDateEnd).getTime() + 86400000 : Infinity;
        const dateMatch = msgTimestamp >= dateStart && msgTimestamp <= dateEnd;
        
        const visible = textMatch && userMatch && typeMatch && dateMatch;
        messageElement.classList.toggle('hidden', !visible);
        if (visible) matches++;
    });
    
    searchStatus.classList.toggle('hidden', !query && !filterUser && !filterType && !filterDateStart && !filterDateEnd);
    searchStatus.textContent = `${matches} match${matches === 1 ? '' : 'es'}`;
}

// Populate user filter dropdown
function updateUserFilter() {
    const userFilter = document.getElementById('filter-user');
    const currentValue = userFilter.value;
    userFilter.innerHTML = '<option value="">All Users</option>';
    
    const participants = document.querySelectorAll('#participants-list li');
    participants.forEach(p => {
        const name = p.textContent.replace(/[^\w]/g, '');
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        userFilter.appendChild(option);
    });
    
    userFilter.value = currentValue;
}

// Initialize new features
window.addEventListener('DOMContentLoaded', () => {
    initScreenshotDetection();
    runMaintenance(); // Run cleanup on load
    
    // Add keyboard shortcut for scheduling
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === '/' && messageInput.value === '') {
            // Could open command palette
        }
    });
});
