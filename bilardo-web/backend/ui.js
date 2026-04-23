// API URL (pointing to your local backend)
const API_URL = 'http://localhost:3000/api/auth';

// DOM Elements
const authContainer = document.getElementById('auth-container');
const lobbyContainer = document.getElementById('lobby-container');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const authMessage = document.getElementById('auth-message');
const loggedInUserSpan = document.getElementById('logged-in-user');

// Room DOM Elements
const createRoomBtn = document.getElementById('create-room-btn');
const practiceRoomBtn = document.getElementById('practice-room-btn');
const createRoomMode = document.getElementById('create-room-mode');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomIdInput = document.getElementById('room-id-input');
const createRoomPassword = document.getElementById('create-room-password');
const joinRoomPassword = document.getElementById('join-room-password');
const lobbyMessage = document.getElementById('lobby-message');
const gameContainer = document.getElementById('game-container');
const currentRoomIdSpan = document.getElementById('current-room-id');
const currentRoomModeSpan = document.getElementById('current-room-mode');
const playersList = document.getElementById('players-list');
const pauseGameBtn = document.getElementById('pause-game-btn');
const inviteUsernameInput = document.getElementById('invite-username');
const sendInviteBtn = document.getElementById('send-invite-btn');
const restartGameBtn = document.getElementById('restart-game-btn');
const overlayRematchBtn = document.getElementById('overlay-rematch-btn');
const tableColorPicker = document.getElementById('table-color-picker');
const soundToggle = document.getElementById('sound-toggle');
const pocketsToggle = document.getElementById('pockets-toggle');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const showLeaderboardBtn = document.getElementById('show-leaderboard-btn');
const leaderboardSection = document.getElementById('leaderboard-section');
const leaderboardList = document.getElementById('leaderboard-list');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const showProfileBtn = document.getElementById('show-profile-btn');
const profileSection = document.getElementById('profile-section');
const avatarUrlInput = document.getElementById('avatar-url-input');
const cueSelectInput = document.getElementById('cue-select-input');
const saveProfileBtn = document.getElementById('save-profile-btn');
const profileMessage = document.getElementById('profile-message');
const reactionBtns = document.querySelectorAll('.reaction-btn');

// Global Socket variable
let socket;

// 1. Check if user is already logged in on page load
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (token && username) {
        showLobby(username);
    }
});

// 2. Handle Registration
registerBtn.addEventListener('click', async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (!username || !password) return showMessage('Lütfen kullanıcı adı ve şifrenizi girin.', 'red');

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Kayıt başarılı! Şimdi giriş yapabilirsiniz.', '#2ecc71'); // Green
        } else {
            showMessage(data.message || 'Kayıt başarısız.', '#e74c3c'); // Red
        }
    } catch (error) {
        showMessage('Sunucu bağlantı hatası.', '#e74c3c');
    }
});

// 3. Handle Login
loginBtn.addEventListener('click', async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (!username || !password) return showMessage('Lütfen kullanıcı adı ve şifrenizi girin.', 'red');

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save auth details
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', username);
            localStorage.setItem('avatarUrl', data.avatarUrl || '');
            localStorage.setItem('equippedCue', data.equippedCue || 'standard');
            showLobby(username);
        } else {
            showMessage(data.message || 'Giriş başarısız.', '#e74c3c');
        }
    } catch (error) {
        showMessage('Sunucu bağlantı hatası.', '#e74c3c');
    }
});

// 4. Handle Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    if (socket) {
        socket.disconnect(); // Disconnect from WebSocket server cleanly
    }
    showAuth();
});

// 5. Handle Create Room
createRoomBtn.addEventListener('click', () => {
    if (socket) {
        const username = localStorage.getItem('username');
        const password = createRoomPassword.value.trim();
        const mode = createRoomMode.value;
        const cue = localStorage.getItem('equippedCue') || 'standard';
        const avatar = localStorage.getItem('avatarUrl') || '';
        socket.emit('createRoom', { username, password, mode, cue, avatar });
    }
});

// 5.5 Handle Practice Room
practiceRoomBtn.addEventListener('click', () => {
    const mode = createRoomMode.value;
    const username = localStorage.getItem('username') || 'Player';
    const cue = localStorage.getItem('equippedCue') || 'standard';
    const avatar = localStorage.getItem('avatarUrl') || '';
    showGameRoom('PRACTICE', mode);
    addPlayerToList(`${username} (Pratik)`);
    if (typeof window.initGame === 'function') {
        window.initGame(1, mode, true); // true = practice mode
        window.setGameActive(true);
        window.updatePlayerMetadata(username, 'Pratik Mankeni', cue, cue, avatar, null);
    }
});

// 6. Handle Join Room
joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim().toUpperCase();
    if (!roomId) {
        lobbyMessage.textContent = 'Lütfen bir Oda Kodu girin.';
        lobbyMessage.style.color = '#e74c3c';
        return;
    }
    if (socket) {
        const username = localStorage.getItem('username');
        const password = joinRoomPassword.value.trim();
        const cue = localStorage.getItem('equippedCue') || 'standard';
        const avatar = localStorage.getItem('avatarUrl') || '';
        socket.emit('joinRoom', { roomId, username, password, cue, avatar });
    }
});

// 7. Handle Leave Room
leaveRoomBtn.addEventListener('click', () => {
    if (socket) {
        socket.emit('leaveRoom');
    }
    showLobby(localStorage.getItem('username'));
});

// 7.5 Handle Sending Invites
sendInviteBtn.addEventListener('click', () => {
    const targetUsername = inviteUsernameInput.value.trim();
    const roomId = currentRoomIdSpan.textContent;
    const modeText = currentRoomModeSpan.textContent;
    let mode = '3-cushion';
    if (modeText === '8 Top') mode = '8-ball';
    if (modeText === '9 Top') mode = '9-ball';
    if (modeText === '15 Top') mode = '15-ball';
    if (modeText === 'Snooker') mode = 'snooker';
    if (modeText === 'Karambol') mode = 'karambol';

    if (!targetUsername) {
        return;
    }

    if (socket) {
        socket.emit('sendInvite', { targetUsername, roomId, mode });
        inviteUsernameInput.value = '';
    }
});

let isGamePaused = false;
// 7.8 Handle Pause Game
pauseGameBtn.addEventListener('click', () => {
    if (socket) {
        isGamePaused = !isGamePaused;
        socket.emit('togglePause', isGamePaused);
    }
});

// 8. Handle Restart Game
restartGameBtn.addEventListener('click', () => {
    if (socket) {
        socket.emit('restartGame');
    }
});

// Handle Overlay Rematch Game
overlayRematchBtn.addEventListener('click', () => {
    if (socket) {
        socket.emit('restartGame');
    }
});

// Handle Table Color Change
tableColorPicker.addEventListener('input', (e) => {
    document.getElementById('game-canvas').style.backgroundColor = e.target.value;
});

// Handle Sound Toggle
soundToggle.addEventListener('change', (e) => {
    if (typeof window.setSoundEnabled === 'function') window.setSoundEnabled(e.target.checked);
});

// Handle Pockets Toggle
pocketsToggle.addEventListener('change', (e) => {
    if (typeof window.setShowPockets === 'function') window.setShowPockets(e.target.checked);
});

// 9. Handle Leaderboard Display
showLeaderboardBtn.addEventListener('click', async () => {
    if (leaderboardSection.style.display === 'none') {
        leaderboardSection.style.display = 'block';
        leaderboardList.innerHTML = '<li>Loading...</li>';
        
        try {
            const response = await fetch('http://localhost:3000/api/leaderboard');
            const topUsers = await response.json();
            
            leaderboardList.innerHTML = '';
            topUsers.forEach((user) => {
                const li = document.createElement('li');
                li.textContent = `${user.username} - ${user.score} puan`;
                li.style.padding = "5px 0";
                leaderboardList.appendChild(li);
            });
        } catch (error) {
            leaderboardList.innerHTML = '<li style="color: #e74c3c;">Sıralama yüklenemedi.</li>';
        }
    } else {
        leaderboardSection.style.display = 'none';
    }
});

// 10. Handle Chat
function sendMessage() {
    const text = chatInput.value.trim();
    if (text && socket) {
        socket.emit('sendMessage', text);
        chatInput.value = '';
    }
}
sendChatBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// --- Helper Functions ---
function showMessage(text, color) {
    authMessage.textContent = text;
    authMessage.style.color = color;
}

function showLobby(username) {
    authContainer.style.display = 'none';
    lobbyContainer.style.display = 'block';
    gameContainer.style.display = 'none';
    loggedInUserSpan.textContent = username;
    usernameInput.value = '';
    passwordInput.value = '';
    authMessage.textContent = '';
    lobbyMessage.textContent = '';
    createRoomPassword.value = '';
    joinRoomPassword.value = '';
    leaderboardSection.style.display = 'none';
    profileSection.style.display = 'none';

    // Initialize WebSocket ONLY ONCE globally to prevent ghosting/memory leaks
    if (!socket) {
        socket = io('http://localhost:3000');

        let pingInterval;
        socket.on('connect', () => {
            console.log('Successfully connected to WebSocket server!');
            console.log('Socket ID:', socket.id);
            // Register user as online for invites
            socket.emit('userOnline', localStorage.getItem('username'));
            
            // Start pinging
            if (pingInterval) clearInterval(pingInterval);
            pingInterval = setInterval(() => {
                socket.emit('pingRequest', Date.now());
            }, 2000);
        });

        socket.on('pongResponse', (timestamp) => {
            const latency = Date.now() - timestamp;
            socket.emit('updateLatency', latency);
        });

        socket.on('playerLatencies', (latencies) => {
            if (typeof window.updatePlayerLatencies === 'function') {
                window.updatePlayerLatencies(latencies.p1, latencies.p2);
            }
        });

        socket.on('onlineCountUpdate', (count) => {
            const countEl = document.getElementById('online-count-number');
            if (countEl) countEl.textContent = count;
        });

        // --- Step 4: Room System Socket Listeners ---
        socket.on('roomCreated', (data) => {
            showGameRoom(data.roomId, data.mode);
            addPlayerToList(`${username} (Kurucu - Sen)`);
            addSystemChatMessage(`Oda başarıyla kuruldu! Arkadaşlarınızı davet etmek için Oda Kodunuz: ${data.roomId}`, '#f1c40f');
            
            // Initialize as Player 1
            if (typeof window.initGame === 'function') window.initGame(1, data.mode);
            if (typeof window.updatePlayerMetadata === 'function') window.updatePlayerMetadata(data.p1Name, data.p2Name, data.p1Cue, data.p2Cue, data.p1Avatar, data.p2Avatar);
        });

        socket.on('roomJoined', (data) => {
            showGameRoom(data.roomId, data.mode);
            addPlayerToList(`${data.hostName} (Kurucu)`);
            
            let myRoleNum = 3; // Default to Spectator
            if (data.role === 'Player 2') {
                addPlayerToList(`${username} (Oyuncu 2 - Sen)`);
                myRoleNum = 2;
            } else {
                addPlayerToList(`${username} (İzleyici - Sen)`);
            }

            if (typeof window.initGame === 'function') {
                window.initGame(myRoleNum, data.mode);
                if (myRoleNum === 2) {
                    window.setGameActive(true);
                } else if (myRoleNum === 3) {
                    // Spectator requests current board state from the Host
                    socket.emit('requestStateSync');
                }
            }
            if (typeof window.updatePlayerMetadata === 'function') window.updatePlayerMetadata(data.p1Name, data.p2Name, data.p1Cue, data.p2Cue, data.p1Avatar, data.p2Avatar);
        });

        socket.on('playerJoined', (data) => {
            const roleTr = data.role === 'Player 2' ? 'Oyuncu 2' : 'İzleyici';
            addPlayerToList(`${data.username} (${roleTr})`);
            
            if (data.role === 'Player 2' && typeof window.setGameActive === 'function') {
                window.setGameActive(true);
            }
            
            addSystemChatMessage(`${data.username} ${roleTr} olarak katıldı.`, '#2ecc71');
            if (typeof window.updatePlayerMetadata === 'function') window.updatePlayerMetadata(data.p1Name, data.p2Name, data.p1Cue, data.p2Cue, data.p1Avatar, data.p2Avatar);
        });

        socket.on('playerLeft', (data) => {
            if (data.role === 'Player 1' || data.role === 'Player 2') {
                // Pause the game if a primary player leaves
                if (typeof window.setGameActive === 'function') window.setGameActive(false);
            }
            
            const roleTr = data.role === 'Player 2' ? 'Oyuncu 2' : (data.role === 'Player 1' ? 'Kurucu' : 'İzleyici');
            addSystemChatMessage(`${data.username} (${roleTr}) odadan ayrıldı.`, '#e74c3c');
            if (typeof window.updatePlayerMetadata === 'function') window.updatePlayerMetadata(data.p1Name, data.p2Name, data.p1Cue, data.p2Cue, data.p1Avatar, data.p2Avatar);
        });

        socket.on('roomError', (errorMessage) => {
            lobbyMessage.textContent = errorMessage;
            lobbyMessage.style.color = '#e74c3c';
        });

        // --- Step 6: Listen for incoming gameplay data ---
        socket.on('playerShot', (shotData) => {
            if (typeof window.applyNetworkShot === 'function') {
                window.applyNetworkShot(shotData);
            }
        });

        // --- Step 6.5: Listen for Ball in Hand placement ---
        socket.on('cueBallPlaced', (data) => {
            if (typeof window.applyCueBallPlacement === 'function') {
                window.applyCueBallPlacement(data);
            }
        });

        // --- Step 6.8: Listen for Pause Events ---
        socket.on('gamePaused', (data) => {
            isGamePaused = data.isPaused;
            if (typeof window.setGamePaused === 'function') {
                window.setGamePaused(data.isPaused);
            }
            pauseGameBtn.textContent = data.isPaused ? 'Oyuna Devam Et' : 'Oyunu Duraklat';
            pauseGameBtn.style.backgroundColor = data.isPaused ? '#e67e22' : '#3498db';
            addSystemChatMessage(`${data.username} oyunu ${data.isPaused ? 'duraklattı' : 'devam ettirdi'}.`, '#f1c40f');
        });

        // --- Step 6.9: Listen for Reactions ---
        socket.on('receiveReaction', (data) => {
            if (data.username !== localStorage.getItem('username')) {
                showFloatingReaction(data.username, data.emoji);
            }
        });

// 11. Handle Profile Display and Update
showProfileBtn.addEventListener('click', () => {
    if (profileSection.style.display === 'none') {
        profileSection.style.display = 'block';
        avatarUrlInput.value = localStorage.getItem('avatarUrl') || '';
            const currentCue = localStorage.getItem('equippedCue') || 'standard';
            cueSelectInput.value = currentCue;
            if (typeof window.drawCuePreview === 'function') window.drawCuePreview(currentCue);
    } else {
        profileSection.style.display = 'none';
    }
});

cueSelectInput.addEventListener('change', (e) => {
    if (typeof window.drawCuePreview === 'function') window.drawCuePreview(e.target.value);
});

saveProfileBtn.addEventListener('click', async () => {
    const avatarUrl = avatarUrlInput.value.trim();
    const equippedCue = cueSelectInput.value;
    const username = localStorage.getItem('username');

    try {
        const response = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, avatarUrl, equippedCue })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('avatarUrl', avatarUrl);
            localStorage.setItem('equippedCue', equippedCue);
                profileMessage.textContent = 'Profil güncellendi!';
            profileMessage.style.color = '#2ecc71';
            setTimeout(() => profileMessage.textContent = '', 3000);
        } else {
                profileMessage.textContent = data.message || 'Güncelleme başarısız.';
            profileMessage.style.color = '#e74c3c';
        }
    } catch (error) {
            profileMessage.textContent = 'Sunucu bağlantı hatası.';
        profileMessage.style.color = '#e74c3c';
    }
});

        // --- Step 7: Listen for incoming chat messages ---
        socket.on('receiveMessage', (data) => {
            const msgEl = document.createElement('div');
            msgEl.style.marginBottom = '5px';
            msgEl.innerHTML = `<strong style="color: #f1c40f;">${data.username}:</strong> ${data.message}`;
            chatMessages.appendChild(msgEl);
            chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll to bottom
        });

        // --- Step 8: Additional Match Control Listeners ---
        socket.on('gameRestarted', () => {
            if (typeof window.restartGameLocally === 'function') window.restartGameLocally();
        });

        socket.on('requestStateSync', (targetId) => {
            // Provide the current game state to a newly joined spectator
            if (typeof window.getGameState === 'function') {
                const state = window.getGameState();
                socket.emit('sendStateSync', { targetId, state });
            }
        });

        socket.on('receiveStateSync', (state) => {
            if (typeof window.setGameState === 'function') window.setGameState(state);
        });

        // --- Step 9: Listen for Invites ---
        socket.on('receiveInvite', (data) => {
            let modeTr = '3 Bant';
            if (data.mode === '8-ball') modeTr = '8 Top';
            else if (data.mode === '9-ball') modeTr = '9 Top';
            else if (data.mode === '15-ball') modeTr = '15 Top';
            else if (data.mode === 'snooker') modeTr = 'Snooker';
            else if (data.mode === 'karambol') modeTr = 'Karambol';
            const accept = confirm(`${data.fromUsername} seni oynamaya davet etti (${modeTr})! Odaya katılmak ister misin?`);
            if (accept) {
                const username = localStorage.getItem('username');
                const cue = localStorage.getItem('equippedCue') || 'standard';
                const avatar = localStorage.getItem('avatarUrl') || '';
                socket.emit('joinRoom', { roomId: data.roomId, username, password: '', cue, avatar });
            }
        });

        socket.on('inviteSuccess', (msg) => {
            addSystemChatMessage(msg, '#2ecc71');
        });

        socket.on('inviteFailed', (msg) => {
            addSystemChatMessage(msg, '#e74c3c');
        });
    } else if (socket.disconnected) {
        socket.connect();
    }
}

function showAuth() {
    authContainer.style.display = 'block';
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'none';
}

function showGameRoom(roomId, mode = '3-cushion') {
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    currentRoomIdSpan.textContent = roomId;
    
    let modeTr = '3 Bant';
    if (mode === '8-ball') modeTr = '8 Top';
    else if (mode === '9-ball') modeTr = '9 Top';
    else if (mode === '15-ball') modeTr = '15 Top';
    else if (mode === 'snooker') modeTr = 'Snooker';
    else if (mode === 'karambol') modeTr = 'Karambol';
    currentRoomModeSpan.textContent = modeTr;
    
    playersList.innerHTML = ''; // Clear previous list
    chatMessages.innerHTML = ''; // Clear chat
    
    // Oyun moduna göre masanın dış çerçeve rengini ayarla
    const canvasEl = document.getElementById('game-canvas');
    if (mode === '8-ball' || mode === '9-ball' || mode === '15-ball') {
        canvasEl.style.borderColor = '#5c4033'; // Kahverengi Ahşap
        canvasEl.style.backgroundColor = '#27ae60';
    } else if (mode === 'snooker') {
        canvasEl.style.borderColor = '#8b4513'; // Daha koyu ahşap
        canvasEl.style.backgroundColor = '#1e824c'; // Snooker yeşili
    } else if (mode === 'karambol') {
        canvasEl.style.borderColor = '#c0392b'; // Kızıl Ahşap (Karambol için)
        canvasEl.style.backgroundColor = '#27ae60';
    } else {
        canvasEl.style.borderColor = '#8e44ad'; // Klasik Mor/Bordo
        canvasEl.style.backgroundColor = '#27ae60';
    }
}

function addPlayerToList(name) {
    const li = document.createElement('li');
    li.textContent = name;
    playersList.appendChild(li);
}

function addSystemChatMessage(text, color) {
    const msgEl = document.createElement('div');
    msgEl.style.marginBottom = '5px';
    msgEl.innerHTML = `<strong style="color: ${color};">Sistem:</strong> ${text}`;
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}