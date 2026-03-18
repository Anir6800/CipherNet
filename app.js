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
        // Highlight active theme button
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active-theme'));
        e.currentTarget.classList.add('active-theme');
    });
});

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

// Globals
let currentSessionId = null;
let currentCryptoKey = null;
let messageRef = null;
let currentUserName = null;
let isHost = false;

// ----------------------------------------------------
// WebRTC P2P Infrastructure for File Transfer (Feature: No Storage)
// ----------------------------------------------------
let peerConnection = null;
let dataChannel = null;
let signalingRef = null;
let pendingIceCandidates = [];
let isOfferInProgress = false;

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
        uploadIndicator.innerHTML = '<i class="fa-solid fa-satellite-dish fa-spin"></i> P2P Connected';
        uploadIndicator.classList.remove('hidden');
        setTimeout(() => uploadIndicator.classList.add('hidden'), 1200);
    };
    channel.onclose = () => {
        console.warn("P2P Data Channel Closed");
        uploadIndicator.innerHTML = '<span style="color:#f53333;">P2P channel closed. Reconnecting...</span>';
        uploadIndicator.classList.remove('hidden');
        setTimeout(() => uploadIndicator.classList.add('hidden'), 2500);
    };
    channel.onerror = (e) => {
        console.error("P2P Error:", e);
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
        currentUserNameDisplay.textContent = currentUserName;
        currentCryptoKey = await deriveKey(sessionCode);
        isHost = true;
        
        alert(`Session created.\nKEY: ${sessionCode}`);
        initializeChat(sessionCode);
    } catch (e) {
        console.error(e); alert('Init failed');
    }
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
    let log = "--- CipherNet Chat Log ---\n\n";
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
    }
});

function initializeChat(sessionCode) {
    currentSessionId = sessionCode;
    messageRef = ref(database, `messages/${sessionCode}`);
    
    landingPage.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    messagesDiv.innerHTML = '';

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
    messageInput.value = '';
    
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
            setTimeout(() => messageElement.remove(), 500);
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

    // Body
    const messageText = document.createElement('div');
    messageText.classList.add('message-text');
    messageText.textContent = text;
    messageElement.appendChild(messageText);
    
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

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
            await remove(ref(database, `sessions/${currentSessionId}/participants/${currentUserName}`));
            await remove(ref(database, `sessions/${currentSessionId}/typing/${currentUserName}`));
            
            // If Host leaves, destroy session entirely
            if(isHost) {
                await remove(ref(database, `messages/${currentSessionId}`));
                await remove(ref(database, `sessions/${currentSessionId}`));
            }

            if(peerConnection) peerConnection.close();
            if(dataChannel) dataChannel.close();

            currentSessionId = null;
            currentCryptoKey = null;
            currentUserName = null;
        } catch (error) {
            console.error(error);
        }
    }
}