// --- DOM Elements & Context ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// --- Sound Effects (Web Audio API) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
let soundEnabled = true;

function playSound(type, impactSpeed) {
    if (!soundEnabled) return;

    // Only play sound if the impact is hard enough
    if (impactSpeed < 0.2) return;
    
    // AudioContext requires a user gesture to resume (dragging the ball handles this)
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Volume scales with impact speed, capped to avoid blasting ears
    const volume = Math.min(impactSpeed * 0.05, 0.5);
    
    if (type === 'hit') { // Ball-to-ball collision sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'cushion') { // Ball-to-cushion hit sound
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    }
}

// --- Game Entities ---
class Ball {
    constructor(x, y, color, type = 'standard', radius = 12, number = '') {
        this.x = x;
        this.y = y;
        this.vx = 0; // Velocity X
        this.vy = 0; // Velocity Y
        this.spin = 0; // English (Spin)
        this.rotation = 0; // Visual rotation angle
        this.isPocketed = false; // Is ball currently inside a pocket
        this.type = type;
        this.radius = radius; // Dinamik boyut
        this.color = color;
        this.number = number; // Top numarası
    }

    update() {
        if (this.isPocketed) return false;

        let hitCushion = false;

        // 1. Apply friction to naturally slow down the ball
        this.vx *= 0.992;
        this.vy *= 0.992;

        // Stop completely if moving very slowly (avoids infinite micro-sliding)
        if (Math.abs(this.vx) < 0.02) this.vx = 0;
        if (Math.abs(this.vy) < 0.02) this.vy = 0;

        // 2. Update position based on velocity
        this.x += this.vx;
        this.y += this.vy;

        // 3. Simple cushion collision (bouncing off walls)
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx = -this.vx;
            this.vy -= this.spin * 1.5; // Left wall spin bounce
            this.spin *= 0.6; // Lose spin on impact
            hitCushion = true;
        } else if (this.x + this.radius > canvas.width) {
            this.x = canvas.width - this.radius;
            this.vx = -this.vx;
            this.vy += this.spin * 1.5; // Right wall spin bounce
            this.spin *= 0.6;
            hitCushion = true;
        }

        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.vy = -this.vy;
            this.vx += this.spin * 1.5; // Top wall spin bounce
            this.spin *= 0.6;
            hitCushion = true;
        } else if (this.y + this.radius > canvas.height) {
            this.y = canvas.height - this.radius;
            this.vy = -this.vy;
            this.vx -= this.spin * 1.5; // Bottom wall spin bounce
            this.spin *= 0.6;
            hitCushion = true;
        }

        // Play cushion sound if wall hit is registered
        if (hitCushion) {
            const speed = Math.hypot(this.vx, this.vy);
            playSound('cushion', speed);
        }

        // Update visual rotation
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 0 || Math.abs(this.spin) > 0) {
            this.rotation += (speed / this.radius) + (this.spin * 0.1);
        }

        // Natural spin decay over time
        this.spin *= 0.995;
        if (Math.abs(this.spin) < 0.01) this.spin = 0;

        return hitCushion;
    }

    draw(context) {
        if (this.isPocketed) return;

                // Gölge (Drop Shadow)
        context.save();
        context.beginPath();
        context.arc(this.x + 3, this.y + 3, this.radius, 0, Math.PI * 2);
        context.fillStyle = 'rgba(0, 0, 0, 0.4)';
        context.fill();
        context.closePath();
        context.restore();


        context.save();
        context.translate(this.x, this.y);
        context.rotate(this.rotation);

          // Ana Renk (Base color)
        context.beginPath();
        context.arc(0, 0, this.radius, 0, Math.PI * 2);
        context.fillStyle = this.color;
        context.fill();
        context.closePath();
        
        // Dönüş İşaretçileri (Çizgiler ve Noktalar)
        if (this.type === 'stripe') {
            context.fillStyle = '#ffffff';
            context.fillRect(-this.radius, -this.radius / 2.2, this.radius * 2, this.radius * 0.9);
        }
        if (this.number) {
            context.beginPath();
            context.arc(0, 0, this.radius / 1.8, 0, Math.PI * 2);
            context.fillStyle = '#ffffff';
            context.fill();
            context.closePath();
            context.fillStyle = '#111111';
            context.font = `bold ${this.radius * 0.8}px Arial`;
            context.font = `bold ${Math.round(this.radius * 0.8)}px Arial`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(this.number, 0, 1);
        } else if (this.type !== 'stripe' && this.color !== '#ffffff' && this.color !== '#111111') {
            context.beginPath();
            context.arc(this.radius * 0.5, 0, 3, 0, Math.PI * 2);
            context.fillStyle = '#ffffff';
            context.fill();
            context.closePath();
        } else if (this.color === '#ffffff') {
            context.beginPath();
            context.arc(this.radius * 0.5, 0, 3, 0, Math.PI * 2);
            context.fillStyle = this.color === '#ffffff' ? '#e74c3c' : '#ffffff';
            context.fill();
            context.closePath();
        }

        context.restore();

        // 3D Işık ve Derinlik Kaplaması (Global Overlay)
        context.save();
        context.translate(this.x, this.y);
        
        // Karanlık kenar gölgesi (Küresel Hacim Hissi)
        const shadowGrad = context.createRadialGradient(0, 0, this.radius * 0.4, 0, 0, this.radius);
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        context.beginPath();
        context.arc(0, 0, this.radius, 0, Math.PI * 2);
        context.fillStyle = shadowGrad;
        context.fill();
        context.closePath();

        // Parlak Nokta (Işık Yansıması)
        context.beginPath();
        context.arc(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.4, 0, Math.PI * 2);
        const glareGrad = context.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, 0, -this.radius * 0.3, -this.radius * 0.3, this.radius * 0.4);
        glareGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        glareGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = glareGrad;
        context.fill();
        context.closePath();
                
        context.restore();
    }
}

// --- Particles Engine ---
class Particle {
    constructor(x, y, color, speedScale) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * speedScale;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.color = color;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.02;
        this.radius = Math.random() * 2 + 1;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.life -= this.decay;
    }
    draw(context) {
        context.globalAlpha = Math.max(0, this.life);
        context.fillStyle = this.color;
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1.0;
    }
}
let particles = [];
function createParticles(x, y, color, count, speedScale) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, speedScale));
    }
}

let balls = []; // Dynamically holds active balls on the table
let gameMode = '3-cushion';

// --- 3-Cushion Scoring State ---
let shotActive = false;
let activeCueBall = null;
let cushionsHit = 0;
let ballsHit = [];
let validPoint = false;
let shotResultMessage = "";
let showMessageUntil = 0;

// --- Input State (Click & Drag) ---
let isDragging = false;
let mouseX = 0;
let mouseY = 0;
let currentSpin = 0; // -1 (Left English) to 1 (Right English)

// --- Multiplayer Game State ---
let myPlayerNumber = 0; // 1 for Host (White), 2 for Guest (Yellow)
let currentTurn = 1; // 1 or 2
let gameStarted = false;
let isPracticeMode = false;
let p1Score = 0;
let p2Score = 0;
let p1Name = null;
let p2Name = null;
let p1Avatar = null;
let p2Avatar = null;
let p1Cue = 'standard';
let p2Cue = 'standard';

// --- 8-Ball Game State ---
let gamePaused = false;
let screenShake = 0; // Kamera sarsıntı şiddeti
let p1Type = null;
let p2Type = null;
let ballInHand = false;
let pocketedThisTurn = [];
let isBreakShot = false;
let cushionedBallsThisTurn = new Set();
const TURN_TIME_SEC = 30;
let turnTimerFrames = TURN_TIME_SEC * 60;

// --- Options State ---
let showPockets = false;
window.setSoundEnabled = function(enabled) {
    soundEnabled = enabled;
};
window.setShowPockets = function(show) {
    showPockets = show;
};

// DOM Elements for Scoreboard
const p1ScoreEl = document.getElementById('p1-score');
const p2ScoreEl = document.getElementById('p2-score');
const turnIndicatorEl = document.getElementById('turn-indicator');

function setupTable() {
    balls = [];
    const pocketGames = ['8-ball', '9-ball', '15-ball', 'snooker'];
    if (pocketGames.includes(gameMode)) {
        isBreakShot = true;

        if (gameMode === '8-ball' || gameMode === '15-ball') {
            balls.push(new Ball(200, 200, '#ffffff', 'cue', 12));
            const startX = 550; const startY = 200; const radius = 12;
            const rowWidth = radius * Math.sqrt(3);
            const colors = ['#f1c40f', '#3498db', '#e74c3c', '#9b59b6', '#e67e22', '#2ecc71', '#8b0000'];
            
            let setupTypes = [];
            if (gameMode === '8-ball') {
                setupTypes = [
                    {c: colors[0], t: 'solid', n: '1'},
                    {c: colors[1], t: 'solid', n: '2'}, {c: colors[2], t: 'solid', n: '3'},
                    {c: colors[0], t: 'stripe', n: '9'}, {c: '#111111', t: 'solid', n: '8'}, {c: colors[3], t: 'solid', n: '4'},
                    {c: colors[4], t: 'solid', n: '5'}, {c: colors[1], t: 'stripe', n: '10'}, {c: colors[5], t: 'solid', n: '6'}, {c: colors[2], t: 'stripe', n: '11'},
                    {c: colors[3], t: 'stripe', n: '12'}, {c: colors[6], t: 'solid', n: '7'}, {c: colors[4], t: 'stripe', n: '13'}, {c: colors[5], t: 'stripe', n: '14'}, {c: colors[6], t: 'stripe', n: '15'}
                ];
            } else { // 15-ball (Straight Pool)
                for(let i=1; i<=15; i++) {
                    let c = i <= 8 ? colors[(i-1)%7] : colors[(i-9)%7];
                    if (i===8) c = '#111111';
                    setupTypes.push({c: c, t: i>8 ? 'stripe' : 'solid', n: i.toString()});
                }
            }

            let colorIdx = 0;
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col <= row; col++) {
                    const st = setupTypes[colorIdx++];
                    balls.push(new Ball(startX + row * rowWidth, startY - row * radius + col * radius * 2, st.c, st.t, 12, st.n));
                }
            }
        } else if (gameMode === '9-ball') {
            balls.push(new Ball(200, 200, '#ffffff', 'cue', 12));
            const startX = 550; const startY = 200; const radius = 12;
            const rowWidth = radius * Math.sqrt(3);
            const colors = ['#f1c40f', '#3498db', '#e74c3c', '#9b59b6', '#e67e22', '#2ecc71', '#8b0000', '#111111', '#f1c40f'];
            const setupTypes = [
                {c: colors[0], t: 'solid', n: '1'}, {c: colors[1], t: 'solid', n: '2'}, {c: colors[2], t: 'solid', n: '3'},
                {c: colors[3], t: 'solid', n: '4'}, {c: colors[8], t: 'stripe', n: '9'}, {c: colors[4], t: 'solid', n: '5'},
                {c: colors[5], t: 'solid', n: '6'}, {c: colors[6], t: 'solid', n: '7'}, {c: '#111111', t: 'solid', n: '8'}
            ];
            const diamondOffsets = [[0, 0], [rowWidth, -radius], [rowWidth, radius], [rowWidth*2, -radius*2], [rowWidth*2, 0], [rowWidth*2, radius*2], [rowWidth*3, -radius], [rowWidth*3, radius], [rowWidth*4, 0]];
            for (let i = 0; i < 9; i++) {
                const st = setupTypes[i];
                balls.push(new Ball(startX + diamondOffsets[i][0], startY + diamondOffsets[i][1], st.c, st.t, 12, st.n));
            }
        } else if (gameMode === 'snooker') {
            const sRad = 8;
            balls.push(new Ball(160, 220, '#ffffff', 'cue', sRad));
            balls.push(new Ball(160, 240, '#f1c40f', 'solid', sRad)); // Yellow
            balls.push(new Ball(160, 160, '#2ecc71', 'solid', sRad)); // Green
            balls.push(new Ball(160, 200, '#8b4513', 'solid', sRad)); // Brown
            balls.push(new Ball(400, 200, '#3498db', 'solid', sRad)); // Blue
            balls.push(new Ball(600, 200, '#e84393', 'solid', sRad)); // Pink
            balls.push(new Ball(720, 200, '#111111', 'solid', sRad)); // Black
            
            const startX = 600 + sRad*2 + 2; const startY = 200;
            const rowWidth = sRad * Math.sqrt(3);
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col <= row; col++) {
                    balls.push(new Ball(startX + row * rowWidth, startY - row * sRad + col * sRad * 2, '#e74c3c', 'solid', sRad));
                }
            }
        }
    } else { // 3-cushion ve karambol
        isBreakShot = false;
        balls.push(new Ball(200, 200, '#ffffff', 'cue1'));
        balls.push(new Ball(200, 250, '#f1c40f', 'cue2'));
        balls.push(new Ball(600, 200, '#e74c3c', 'target'));
    }
    activeCueBall = (!pocketGames.includes(gameMode) && currentTurn === 2) ? balls[1] : balls[0];
    shotActive = false;
    isDragging = false;
    turnTimerFrames = TURN_TIME_SEC * 60;
}

window.updatePlayerMetadata = function(name1, name2, cue1, cue2, avatar1, avatar2) {
    p1Name = name1;
    p2Name = name2;
    p1Cue = cue1 || 'standard';
    p2Cue = cue2 || 'standard';
    p1Avatar = avatar1 || null;
    p2Avatar = avatar2 || null;
    updateScoreboardUI();
};

window.showGameOver = function(message) {
    document.getElementById('game-over-text').textContent = message;
    document.getElementById('game-over-screen').style.display = 'flex';
};
window.hideGameOver = function() {
    document.getElementById('game-over-screen').style.display = 'none';
};

window.setGamePaused = function(isPaused) {
    gamePaused = isPaused;
};

window.drawCuePreview = function(cueType) {
    const previewCanvas = document.getElementById('cue-preview-canvas');
    if (!previewCanvas) return;
    const pCtx = previewCanvas.getContext('2d');
    pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    let woodColor = '#8e44ad'; let gripColor = '#2c3e50'; let tipColor = '#3498db';
    if (cueType === 'carbon') { woodColor = '#333333'; gripColor = '#e74c3c'; tipColor = '#e74c3c'; }
    else if (cueType === 'gold') { woodColor = '#f1c40f'; gripColor = '#ffffff'; tipColor = '#111111'; }
    else if (cueType === 'neon') { woodColor = '#00ffcc'; gripColor = '#ff00ff'; tipColor = '#ffff00'; }
    else if (cueType === 'sapphire') { woodColor = '#0984e3'; gripColor = '#2980b9'; tipColor = '#00cec9'; }
    else if (cueType === 'magma') { woodColor = '#d35400'; gripColor = '#c0392b'; tipColor = '#f39c12'; }
    else if (cueType === 'toxic') { woodColor = '#27ae60'; gripColor = '#8e44ad'; tipColor = '#2ecc71'; }

    pCtx.save();
    pCtx.translate(10, 15); // Ortalama ayarı

    const stickLength = 280;
    const gap = 0;

    pCtx.beginPath();
    pCtx.moveTo(gap, -3);
    pCtx.lineTo(gap + stickLength, -5);
    pCtx.lineTo(gap + stickLength, 5);
    pCtx.lineTo(gap, 3);
    
    const cueGrad = pCtx.createLinearGradient(0, -5, 0, 5);
    cueGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
    cueGrad.addColorStop(0.3, woodColor);
    cueGrad.addColorStop(0.7, woodColor);
    cueGrad.addColorStop(1, 'rgba(0,0,0,0.7)');
    
    pCtx.fillStyle = cueGrad; pCtx.fill();
    pCtx.closePath();

    const tipGrad = pCtx.createLinearGradient(0, -3, 0, 3);
    tipGrad.addColorStop(0, '#222'); tipGrad.addColorStop(0.5, tipColor); tipGrad.addColorStop(1, '#111');
    pCtx.fillStyle = tipGrad; pCtx.fillRect(gap, -3, 4, 6);

    const gripGrad = pCtx.createLinearGradient(0, -4.5, 0, 4.5);
    gripGrad.addColorStop(0, '#111'); gripGrad.addColorStop(0.5, gripColor); gripGrad.addColorStop(1, '#000');
    pCtx.fillStyle = gripGrad; pCtx.fillRect(gap + stickLength - 60, -4.5, 60, 9);
    pCtx.restore();
};

// Exposed functions for ui.js to control game state
window.initGame = function(role, mode, practice = false) {
    myPlayerNumber = role;
    gameMode = mode || '3-cushion';
    isPracticeMode = practice;
    showPockets = ['8-ball', '9-ball', '15-ball', 'snooker'].includes(gameMode);
    p1Score = 0;
    p2Score = 0;
    currentTurn = 1;
    gameStarted = false;
    p1Type = null;
    p2Type = null;
    ballInHand = false;
    pocketedThisTurn = [];
    cushionedBallsThisTurn = new Set();
    setupTable();
    window.hideGameOver();
    updateScoreboardUI();
};

window.restartGameLocally = function() {
    p1Score = 0;
    p2Score = 0;
    currentTurn = 1;
    p1Type = null;
    p2Type = null;
    ballInHand = false;
    pocketedThisTurn = [];
    cushionedBallsThisTurn = new Set();
    setupTable();
    updateScoreboardUI();
};

window.setGameActive = function(isActive) {
    gameStarted = isActive;
    updateScoreboardUI();
};

window.getGameState = function() {
    return {
        p1Score, p2Score, currentTurn, gameStarted, gameMode,
        p1Type, p2Type, ballInHand, isBreakShot, p1Name, p2Name, p1Cue, p2Cue, p1Avatar, p2Avatar, turnTimerFrames, gamePaused, isPracticeMode,
        balls: balls.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, spin: b.spin, color: b.color, isPocketed: b.isPocketed, type: b.type }))
    };
};

window.setGameState = function(state) {
    p1Score = state.p1Score; p2Score = state.p2Score;
    currentTurn = state.currentTurn; gameStarted = state.gameStarted;
    gameMode = state.gameMode || '3-cushion';
    p1Type = state.p1Type || null; p2Type = state.p2Type || null;
    ballInHand = state.ballInHand || false;
    isBreakShot = state.isBreakShot || false;
    p1Name = state.p1Name || null;
    p2Name = state.p2Name || null;
    p1Cue = state.p1Cue || 'standard';
    p2Cue = state.p2Cue || 'standard';
    p1Avatar = state.p1Avatar || null;
    p2Avatar = state.p2Avatar || null;
    showPockets = ['8-ball', '9-ball', '15-ball', 'snooker'].includes(gameMode);
    turnTimerFrames = state.turnTimerFrames !== undefined ? state.turnTimerFrames : TURN_TIME_SEC * 60;
    gamePaused = state.gamePaused || false;
    isPracticeMode = state.isPracticeMode || false;
    
    balls = state.balls.map(bs => {
        const b = new Ball(bs.x, bs.y, bs.color, bs.type, bs.radius, bs.number);
        b.vx = bs.vx; b.vy = bs.vy; b.spin = bs.spin; b.isPocketed = bs.isPocketed;
        return b;
    });
    activeCueBall = (!['8-ball', '9-ball', '15-ball', 'snooker'].includes(gameMode) && currentTurn === 2) ? balls[1] : balls[0];
    updateScoreboardUI();
};

const p1NameDisplay = document.getElementById('p1-name-display');
const p2NameDisplay = document.getElementById('p2-name-display');
const p1AvatarEl = document.getElementById('p1-avatar');
const p2AvatarEl = document.getElementById('p2-avatar');
const p1PingDisplay = document.getElementById('p1-ping-display');
const p2PingDisplay = document.getElementById('p2-ping-display');

window.updatePlayerLatencies = function(ping1, ping2) {
    if (p1PingDisplay) {
        p1PingDisplay.textContent = ping1 > 0 ? `📶 ${ping1} ms` : '';
        p1PingDisplay.style.color = ping1 < 100 ? '#2ecc71' : (ping1 < 200 ? '#f1c40f' : '#e74c3c');
    }
    if (p2PingDisplay) {
        p2PingDisplay.textContent = ping2 > 0 ? `📶 ${ping2} ms` : '';
        p2PingDisplay.style.color = ping2 < 100 ? '#2ecc71' : (ping2 < 200 ? '#f1c40f' : '#e74c3c');
    }
};

function updateScoreboardUI() {
    p1ScoreEl.textContent = p1Score;
    p2ScoreEl.textContent = p2Score;
    
    const n1 = p1Name || 'Bekleniyor...';
    const n2 = isPracticeMode ? 'P2 (Pratik)' : (p2Name || 'Bekleniyor...');

    const p1Arrow = gameStarted && currentTurn === 1 ? '▶ ' : '';
    const p2Arrow = gameStarted && currentTurn === 2 ? '▶ ' : '';

    if (p1Avatar) { p1AvatarEl.src = p1Avatar; p1AvatarEl.style.display = 'inline-block'; }
    else { p1AvatarEl.style.display = 'none'; }
    
    if (p2Avatar) { p2AvatarEl.src = p2Avatar; p2AvatarEl.style.display = 'inline-block'; }
    else { p2AvatarEl.style.display = 'none'; }

    if (gameMode === '8-ball') {
        p1NameDisplay.textContent = `${p1Arrow}${n1} (${p1Type ? (p1Type === 'solid' ? 'Düzler' : 'Parçalılar') : 'Açık'}): `;
        p2NameDisplay.textContent = `${p2Arrow}${n2} (${p2Type ? (p2Type === 'solid' ? 'Düzler' : 'Parçalılar') : 'Açık'}): `;
    } else if (['9-ball', '15-ball', 'snooker'].includes(gameMode)) {
        p1NameDisplay.textContent = `${p1Arrow}${n1}: `;
        p2NameDisplay.textContent = `${p2Arrow}${n2}: `;
    } else {
        p1NameDisplay.textContent = `${p1Arrow}${n1} (Beyaz): `;
        p2NameDisplay.textContent = `${p2Arrow}${n2} (Sarı): `;
    }

    if (isPracticeMode) {
        turnIndicatorEl.textContent = `Pratik Modu - P${currentTurn}'in Sırası`;
        turnIndicatorEl.style.color = currentTurn === 1 ? "#ffffff" : "#f1c40f";
    } else if (!gameStarted) {
        turnIndicatorEl.textContent = "Oyuncu 2 Bekleniyor...";
        turnIndicatorEl.style.color = "#ecf0f1";
    } else if (myPlayerNumber === 3) { // Spectator View
        turnIndicatorEl.textContent = `Oyuncu ${currentTurn}'in Sırası`;
        turnIndicatorEl.style.color = currentTurn === 1 ? "#ffffff" : "#f1c40f";
    } else if (currentTurn === myPlayerNumber) {
        turnIndicatorEl.textContent = "Senin Sıran!";
        turnIndicatorEl.style.color = "#2ecc71"; // Green
    } else {
        turnIndicatorEl.textContent = "Rakibin Sırası";
        turnIndicatorEl.style.color = "#e74c3c"; // Red
    }
}

// Helper: Get mouse position relative to the canvas
function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = evt.clientX;
    let clientY = evt.clientY;
    
    if (evt.touches && evt.touches.length > 0) {
        clientX = evt.touches[0].clientX;
        clientY = evt.touches[0].clientY;
    }

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

// === KESİN SIFIRLAMA VE GÜVENLİK KİLİDİ ===
// Önceki hatalı veya çiftlenmiş döngüleri ve olayları tamamen temizler
if (window.gamePhysicsInterval) clearInterval(window.gamePhysicsInterval);
if (window.handleKeydown) window.removeEventListener('keydown', window.handleKeydown);
if (window.handleInputStart) {
    canvas.removeEventListener('mousedown', window.handleInputStart);
    canvas.removeEventListener('touchstart', window.handleInputStart);
}
if (window.handleInputMove) {
    window.removeEventListener('mousemove', window.handleInputMove);
    window.removeEventListener('touchmove', window.handleInputMove);
}
if (window.handleInputEnd) {
    window.removeEventListener('mouseup', window.handleInputEnd);
    window.removeEventListener('touchend', window.handleInputEnd);
}

// Yeni olay dinleyicilerini global window objesine bağla
window.handleKeydown = (e) => {
    if (!gameStarted || shotActive || gamePaused) return;
    if (!isPracticeMode && currentTurn !== myPlayerNumber) return;

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowLeft') currentSpin = Math.max(-1, currentSpin - 0.1);
        if (e.key === 'ArrowRight') currentSpin = Math.min(1, currentSpin + 0.1);
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') currentSpin = 0;
    }
};

window.handleInputStart = (e) => {
    if (e.type === 'touchstart') e.preventDefault();
    if (!gameStarted || gamePaused) return;
    
    // Sıra kontrolü: Kullanıcı yanlışlıkla tıklarsa onu bilgilendir
    if (!isPracticeMode && currentTurn !== myPlayerNumber) {
        shotResultMessage = "Sıra Rakipte!";
        showMessageUntil = Date.now() + 1000;
        return;
    }

    const pos = getMousePos(e);
    
    if (ballInHand) {
        activeCueBall.x = pos.x;
        activeCueBall.y = pos.y;
        ballInHand = false;

        if (!isPracticeMode && typeof socket !== 'undefined' && socket) {
            socket.emit('placeCueBall', { x: pos.x, y: pos.y });
        }
        return;
    }

    const dist = Math.hypot(pos.x - activeCueBall.x, pos.y - activeCueBall.y);
    if (dist < activeCueBall.radius * 2 && activeCueBall.vx === 0 && activeCueBall.vy === 0) {
        isDragging = true;
        mouseX = pos.x;
        mouseY = pos.y;
    }
};

window.handleInputMove = (e) => {
    if (isDragging) {
        if (e.type === 'touchmove') e.preventDefault();
        const pos = getMousePos(e);
        mouseX = pos.x;
        mouseY = pos.y;
    }
};

window.handleInputEnd = (e) => {
    if (isDragging) {
        if (e.type === 'touchend') e.preventDefault();
        isDragging = false;
        
        const dx = activeCueBall.x - mouseX;
        const dy = activeCueBall.y - mouseY;
        
        const powerMultiplier = 0.15;
        const startVx = dx * powerMultiplier;
        const startVy = dy * powerMultiplier;
        const appliedSpin = currentSpin;
        
        shootBall(startVx, startVy, appliedSpin);

        if (!isPracticeMode && typeof socket !== 'undefined' && socket) {
            socket.emit('shoot', { vx: startVx, vy: startVy, spin: appliedSpin });
        }
    }
};

// Olayları sisteme tanıt
window.addEventListener('keydown', window.handleKeydown);
canvas.addEventListener('mousedown', window.handleInputStart);
canvas.addEventListener('touchstart', window.handleInputStart, { passive: false });
window.addEventListener('mousemove', window.handleInputMove);
window.addEventListener('touchmove', window.handleInputMove, { passive: false });
window.addEventListener('mouseup', window.handleInputEnd);
window.addEventListener('touchend', window.handleInputEnd, { passive: false });

// Döngüleri başlat
window.gamePhysicsInterval = setInterval(updatePhysics, 1000 / 60);

if (!window.gameRenderStarted) {
    window.gameRenderStarted = true;
    requestAnimationFrame(renderLoop);
}

// Helper: Trigger a shot and reset scoring trackers
function shootBall(vx, vy, spin = 0) {
    activeCueBall.vx = vx;
    activeCueBall.vy = vy;
    activeCueBall.spin = spin;

    const startSpeed = Math.hypot(vx, vy);
    if (startSpeed > 15) { // Hard shot
        createParticles(activeCueBall.x, activeCueBall.y, '#3498db', 25, 4); // Chalk dust
    }
        if (startSpeed > 5) {
        screenShake = Math.min(startSpeed * 0.8, 15); // Hıza orantılı kamera sarsıntısı
    }
    
    shotActive = true;
    cushionsHit = 0;
    ballsHit = [];
    cushionedBallsThisTurn.clear(); // Clear cushion tracking for the new shot
    validPoint = false;
    shotResultMessage = "";
}

// Expose function globally so ui.js can call it when receiving a network shot
window.applyNetworkShot = function(shotData) {
    shootBall(shotData.vx, shotData.vy, shotData.spin || 0);
};

window.applyCueBallPlacement = function(data) {
    activeCueBall.x = data.x;
    activeCueBall.y = data.y;
    ballInHand = false;
};

// --- Collision Engine ---
function resolveCollision(ball1, ball2) {
    if (ball1.isPocketed || ball2.isPocketed) return;

    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    const distance = Math.hypot(dx, dy);

    // Check for overlap
    if (distance < ball1.radius + ball2.radius) {
        // Play collision sound based on relative velocity
        const impactSpeed = Math.hypot(ball1.vx - ball2.vx, ball1.vy - ball2.vy);
        playSound('hit', impactSpeed);

        // Generate sparks on hard impact
        if (impactSpeed > 10) {
            const midX = (ball1.x + ball2.x) / 2;
            const midY = (ball1.y + ball2.y) / 2;
            createParticles(midX, midY, '#f1c40f', 15, 3);
        }

        // 1. Static Resolution (prevent sticking)
        const overlap = (ball1.radius + ball2.radius) - distance;
        const nx = dx / distance;
        const ny = dy / distance;

        ball1.x -= nx * (overlap / 2);
        ball1.y -= ny * (overlap / 2);
        ball2.x += nx * (overlap / 2);
        ball2.y += ny * (overlap / 2);

        // --- 3-Cushion & Karambol Scoring Rule Detection ---
        if (shotActive) {
            if (ball1 === activeCueBall && !ballsHit.includes(ball2)) {
                ballsHit.push(ball2);
                if (ballsHit.length === 2 && (gameMode === 'karambol' || cushionsHit >= 3)) validPoint = true;
            } else if (ball2 === activeCueBall && !ballsHit.includes(ball1)) {
                ballsHit.push(ball1);
                if (ballsHit.length === 2 && (gameMode === 'karambol' || cushionsHit >= 3)) validPoint = true;
            }
        }

        // 2. Dynamic Resolution (exchange velocity)
        // Tangent vector
        const tx = -ny;
        const ty = nx;

        // Dot Product Tangent (velocity along tangent stays the same)
        const dpTan1 = ball1.vx * tx + ball1.vy * ty;
        const dpTan2 = ball2.vx * tx + ball2.vy * ty;

        // Dot Product Normal (velocity along normal swaps because masses are equal)
        const dpNorm1 = ball1.vx * nx + ball1.vy * ny;
        const dpNorm2 = ball2.vx * nx + ball2.vy * ny;

        // Apply new velocities
        ball1.vx = tx * dpTan1 + nx * dpNorm2;
        ball1.vy = ty * dpTan1 + ny * dpNorm2;
        ball2.vx = tx * dpTan2 + nx * dpNorm1;
        ball2.vy = ty * dpTan2 + ny * dpNorm1;
    }
}

// --- Physics Engine Loop (Fixed Timestep) ---
function updatePhysics() {
    if (gamePaused) return;

        if (screenShake > 0) {
        screenShake *= 0.9; // Sarsıntı yavaşça azalır
        if (screenShake < 0.5) screenShake = 0;
    }

    particles.forEach(p => p.update());
    particles = particles.filter(p => p.life > 0);

    let allStopped = true;

    // --- Turn Timer Logic ---
    if (gameStarted && !shotActive && !isPracticeMode) {
        turnTimerFrames--;
        if (turnTimerFrames <= 0) {
            shotResultMessage = "Süre Bitti!";
            showMessageUntil = Date.now() + 3000;
            currentTurn = currentTurn === 1 ? 2 : 1;
            activeCueBall = gameMode === '8-ball' ? balls[0] : (currentTurn === 1 ? balls[0] : balls[1]);
            if (gameMode === '8-ball') {
                ballInHand = true;
            }
            turnTimerFrames = TURN_TIME_SEC * 60;
            updateScoreboardUI();
        }
    }
    
    const pocketRadius = gameMode === 'snooker' ? 14 : 18; // Snooker cepleri dardır
    const pockets = [
        { x: 0, y: 0 }, { x: canvas.width / 2, y: 0 }, { x: canvas.width, y: 0 },
        { x: 0, y: canvas.height }, { x: canvas.width / 2, y: canvas.height }, { x: canvas.width, y: canvas.height }
    ];

    // 1. Update ball positions & track cushions
    balls.forEach(ball => {
        if (ball.isPocketed) return;

        const hitCushion = ball.update();
        
        if (hitCushion) {
            cushionedBallsThisTurn.add(ball);
        }

        // Track cushion hits for the active cue ball
        if (hitCushion && shotActive && ball === activeCueBall) {
            cushionsHit++;
        }

        // --- Pocket Fall-in Logic ---
        if (showPockets) {
            for (let p of pockets) {
                if (Math.hypot(ball.x - p.x, ball.y - p.y) < pocketRadius) {
                    ball.isPocketed = true;
                    ball.vx = 0; ball.vy = 0;
                    pocketedThisTurn.push(ball);
                    playSound('cushion', 2); // Sound of falling in
                    break;
                }
            }
        }

        // Check if balls are still moving
        if (ball.vx !== 0 || ball.vy !== 0) {
            allStopped = false;
        }
    });

    // 2. Handle ball-to-ball collisions
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            resolveCollision(balls[i], balls[j]);
        }
    }

    // --- Evaluate Shot End ---
    if (shotActive && allStopped) {
        shotActive = false;
        currentSpin = 0; // Reset spin for the next player

        if (['9-ball', '15-ball', 'snooker'].includes(gameMode)) {
            let scratch = activeCueBall.isPocketed;
            let pocketedLegalBall = pocketedThisTurn.length > (scratch ? 1 : 0);
            
            if (scratch) {
                activeCueBall.isPocketed = false;
                activeCueBall.vx = 0; activeCueBall.vy = 0;
                shotResultMessage = "Faul! Elde Top.";
                ballInHand = true;
                currentTurn = currentTurn === 1 ? 2 : 1;
            } else if (pocketedLegalBall) {
                shotResultMessage = "Sayı!";
                if (currentTurn === 1) p1Score += pocketedThisTurn.length; else p2Score += pocketedThisTurn.length;
                if (!isPracticeMode && currentTurn === myPlayerNumber && typeof socket !== 'undefined' && socket) {
                    socket.emit('addPoint');
                }
            } else {
                shotResultMessage = "Vuruş Tamamlandı!";
                currentTurn = currentTurn === 1 ? 2 : 1;
            }
            activeCueBall = balls[0];
            pocketedThisTurn = [];
        } else if (gameMode === '8-ball') {
            let scratch = activeCueBall.isPocketed;
            let pocketedLegalBall = false;
            let eightBallPocketed = false;
            let illegalBreak = false;

            // Check Legal Break Rules (Either pocket a ball or drive 4 balls to a cushion)
            if (isBreakShot) {
                if (pocketedThisTurn.length === 0 && cushionedBallsThisTurn.size < 4) {
                    illegalBreak = true;
                }
                isBreakShot = false;
            }

            pocketedThisTurn.forEach(b => {
                if (b.type === 'solid' || b.type === 'stripe') {
                    if (!p1Type && !p2Type && !scratch && !illegalBreak) {
                        if (currentTurn === 1) {
                            p1Type = b.type; p2Type = b.type === 'solid' ? 'stripe' : 'solid';
                        } else {
                            p2Type = b.type; p1Type = b.type === 'solid' ? 'stripe' : 'solid';
                        }
                    }
                    const myType = currentTurn === 1 ? p1Type : p2Type;
                    if (b.type === myType || !myType) pocketedLegalBall = true;
                } else if (b.type === '8-ball') {
                    eightBallPocketed = true;
                }
            });

            if (eightBallPocketed) {
                // Hangi grupta olduğumuzu bulalım
                const myType = currentTurn === 1 ? p1Type : p2Type;
                
                // Masada hala kendi grubumuzdan (veya masa açıksa herhangi bir) top var mı?
                let hasBallsLeft = false;
                if (!myType) {
                    hasBallsLeft = true; // Masa açıkken 8'i sokmak direkt kaybettirir
                } else {
                    balls.forEach(b => {
                        if (!b.isPocketed && b.type === myType) hasBallsLeft = true;
                    });
                }

                const shooterLost = scratch || illegalBreak || hasBallsLeft;
                const iAmShooter = currentTurn === myPlayerNumber;
                const iAmSpectator = myPlayerNumber === 3;

                let msg = "";
                if (shooterLost) {
                    if (iAmSpectator) msg = `Oyuncu ${currentTurn} Erken 8 Top/Faul Yaptı! Kaybetti!`;
                    else if (iAmShooter) msg = hasBallsLeft ? "Topların bitmeden 8'i soktun! Kaybettin!" : "8 Topta Faul! Kaybettin!";
                    else msg = "Rakip 8 Topta Hata Yaptı! Kazandın!";
                    
                    // Rakip kazandı
                    if (currentTurn === 1) p2Score++; else p1Score++;
                } else {
                    if (iAmSpectator) msg = `Oyuncu ${currentTurn} Kazandı!`;
                    else if (iAmShooter) msg = "8 Top Girdi! Kazandın!";
                    else msg = "Rakip 8 Topu Soktu! Kaybettin!";
                    
                    // Vuran kazandı
                    if (currentTurn === 1) p1Score++; else p2Score++;
                }
                
                // Kazanan oyuncunun veritabanı puanını artır
                if (!isPracticeMode && typeof socket !== 'undefined' && socket) {
                    const iWon = (!shooterLost && iAmShooter) || (shooterLost && !iAmShooter && !iAmSpectator);
                    if (iWon) socket.emit('addPoint');
                }

                gameStarted = false;
                window.showGameOver(msg);
                shotResultMessage = "Oyun Bitti";
            } else if (scratch || illegalBreak) {
                activeCueBall.isPocketed = false;
                shotResultMessage = illegalBreak ? "Geçersiz Açılış! Elde Top." : "Faul! Elde Top.";
                ballInHand = true;
                currentTurn = currentTurn === 1 ? 2 : 1;
            } else if (pocketedLegalBall) {
                shotResultMessage = "Güzel Vuruş!";
            } else {
                shotResultMessage = "Vuruş Tamamlandı!";
                currentTurn = currentTurn === 1 ? 2 : 1;
            }
            activeCueBall = balls[0];
            pocketedThisTurn = [];
            }
        } else {
            // 3-Cushion & Karambol Logic
            if (validPoint) {
                shotResultMessage = "Sayı!";
                if (currentTurn === 1) p1Score++; else p2Score++;
                if (!isPracticeMode && currentTurn === myPlayerNumber && typeof socket !== 'undefined' && socket) {
                    socket.emit('addPoint');
                }
            } else {
                shotResultMessage = "Karavana!";
                currentTurn = currentTurn === 1 ? 2 : 1;
                activeCueBall = currentTurn === 1 ? balls[0] : balls[1];
            }
        }
        showMessageUntil = Date.now() + 3000; // Show for 3 seconds
        turnTimerFrames = TURN_TIME_SEC * 60; // Reset timer for the next turn
        updateScoreboardUI();
    }

// --- Render Engine Loop (Tied to Monitor Refresh Rate) ---
function renderLoop() {
    // Matrisi zorla sıfırla (Bulanıklık ve hayalet çizimleri kesin olarak engeller)
    // Tüm Canvas durumlarını KESİN OLARAK sıfırla (Yazı bozulması ve ıstaka çiftlenmesini engeller)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowColor = 'transparent';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    
    // 1. Clear the canvas from the previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
    if (screenShake > 0) {
        const dx = Math.round((Math.random() - 0.5) * screenShake);
        const dy = Math.round((Math.random() - 0.5) * screenShake);
        ctx.translate(dx, dy);
    }

    // 1.5 Draw Pockets if enabled
    if (showPockets) {
        const pocketRadius = gameMode === 'snooker' ? 14 : 18;
        const pockets = [
            { x: 0, y: 0 }, { x: canvas.width / 2, y: 0 }, { x: canvas.width, y: 0 },
            { x: 0, y: canvas.height }, { x: canvas.width / 2, y: canvas.height }, { x: canvas.width, y: canvas.height }
        ];
        
        pockets.forEach(p => {
            // Metalik çerçeve
            ctx.beginPath();
            ctx.arc(p.x, p.y, pocketRadius + 4, 0, Math.PI * 2);
            ctx.fillStyle = '#7f8c8d';
            ctx.fill();
            ctx.closePath();
            
            // Siyah delik
            ctx.beginPath();
            ctx.arc(p.x, p.y, pocketRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#111111';
            ctx.fill();
            ctx.closePath();
        });
    } else if (gameMode === '3-cushion' || gameMode === 'karambol') {
        // 3 Bant ve Karambol masası için elmas (diamond) işaretleyiciler
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        const diamondsX = [canvas.width/8, canvas.width*2/8, canvas.width*3/8, canvas.width*5/8, canvas.width*6/8, canvas.width*7/8];
        const diamondsY = [canvas.height/4, canvas.height*2/4, canvas.height*3/4];
        diamondsX.forEach(dx => { ctx.fillRect(dx - 3, 2, 6, 6); ctx.fillRect(dx - 3, canvas.height - 8, 6, 6); });
        diamondsY.forEach(dy => { ctx.fillRect(2, dy - 3, 6, 6); ctx.fillRect(canvas.width - 8, dy - 3, 6, 6); });
    }

    if (gameMode === 'snooker') {
        ctx.beginPath();
        ctx.moveTo(160, 25);
        ctx.lineTo(160, canvas.height - 25);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();
        
        ctx.beginPath();
        ctx.arc(160, 200, 40, Math.PI / 2, Math.PI * 1.5);
        ctx.stroke();
        ctx.closePath();
    }

    // 1.8 Draw Turn Timer
    if (gameStarted && !shotActive) {
        const timeSec = Math.ceil(turnTimerFrames / 60);
        ctx.fillStyle = timeSec <= 10 ? '#e74c3c' : '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`00:${timeSec.toString().padStart(2, '0')}`, canvas.width / 2, 35);
    }

    // 1.9 Draw 8-Ball Player Indicators on Table
    if (gameMode === '8-ball' && gameStarted) {
        const drawMiniBall = (x, y, type, color) => {
            ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI*2);
            ctx.fillStyle = color; ctx.fill(); ctx.closePath();
            if (type === 'stripe') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x - 8, y - 4, 16, 8);
            }
            ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI*2);
            ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1; ctx.stroke(); ctx.closePath();
        };

        // P1 Box
        ctx.fillStyle = currentTurn === 1 ? 'rgba(46, 204, 113, 0.6)' : 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(10, 10, 140, 45);
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.font = '14px Arial';
        ctx.fillText((p1Name || 'P1'), 15, 28);
        if (p1Type) {
            drawMiniBall(25, 42, p1Type, p1Type === 'solid' ? '#e74c3c' : '#3498db');
            ctx.fillText(p1Type === 'solid' ? 'Düzler' : 'Parçalılar', 40, 47);
        } else ctx.fillText("Açık Masa", 15, 47);

        // P2 Box
        ctx.fillStyle = currentTurn === 2 ? 'rgba(46, 204, 113, 0.6)' : 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(canvas.width - 150, 10, 140, 45);
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'right'; ctx.font = '14px Arial';
        ctx.fillText((p2Name || 'P2'), canvas.width - 15, 28);
        if (p2Type) {
            drawMiniBall(canvas.width - 25, 42, p2Type, p2Type === 'solid' ? '#e74c3c' : '#3498db');
            ctx.fillText(p2Type === 'solid' ? 'Düzler' : 'Parçalılar', canvas.width - 40, 47);
        } else ctx.fillText("Açık Masa", canvas.width - 15, 47);
    }

    // 2. Draw all balls
    balls.forEach(ball => { if (!ball.isPocketed) ball.draw(ctx) });

    // 2.5 Draw Particles
    particles.forEach(p => p.draw(ctx));

    // 3. Draw aiming cue line when dragging
    if (isDragging && !activeCueBall.isPocketed) {
        const dx = activeCueBall.x - mouseX;
        const dy = activeCueBall.y - mouseY;
        const dist = Math.hypot(dx, dy);
        
        const activeCueType = currentTurn === 1 ? p1Cue : p2Cue;
        let woodColor = '#8e44ad'; // Standard
        let gripColor = '#2c3e50';
        let tipColor = '#3498db';

        if (activeCueType === 'carbon') { woodColor = '#333333'; gripColor = '#e74c3c'; tipColor = '#e74c3c'; }
        else if (activeCueType === 'gold') { woodColor = '#f1c40f'; gripColor = '#ffffff'; tipColor = '#111111'; }
        else if (activeCueType === 'neon') { woodColor = '#00ffcc'; gripColor = '#ff00ff'; tipColor = '#ffff00'; }
        else if (activeCueType === 'sapphire') { woodColor = '#0984e3'; gripColor = '#2980b9'; tipColor = '#00cec9'; }
        else if (activeCueType === 'magma') { woodColor = '#d35400'; gripColor = '#c0392b'; tipColor = '#f39c12'; }
        else if (activeCueType === 'toxic') { woodColor = '#27ae60'; gripColor = '#8e44ad'; tipColor = '#2ecc71'; }

        // The Cue Stick (Drawn dynamically behind the cue ball)
        const angle = Math.atan2(-dy, -dx);
        
        ctx.save();
        ctx.translate(activeCueBall.x, activeCueBall.y);
        ctx.rotate(angle);

        const stickLength = 250;
        const gap = activeCueBall.radius + 5 + (dist * 0.3); // Pulls back as you drag

        ctx.beginPath();
        ctx.moveTo(gap, -3); // Thinner tip
        ctx.lineTo(gap + stickLength, -5); // Thicker back
        ctx.lineTo(gap + stickLength, 5);
        ctx.lineTo(gap, 3);
        
        // 3D İstaka Gradyanı
        const cueGrad = ctx.createLinearGradient(0, -5, 0, 5);
        cueGrad.addColorStop(0, 'rgba(0,0,0,0.8)');
        cueGrad.addColorStop(0.3, woodColor);
        cueGrad.addColorStop(0.7, woodColor);
        cueGrad.addColorStop(1, 'rgba(0,0,0,0.8)');

        // Gölge
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        
        ctx.fillStyle = cueGrad;
        ctx.fill();
        
        ctx.shadowColor = 'transparent'; // Diğer çizimleri etkilemesin diye sıfırla
        ctx.closePath();

        // 3D Uç (Tip) & Kavrama (Grip) Detayları
        const tipGrad = ctx.createLinearGradient(0, -3, 0, 3);
        tipGrad.addColorStop(0, '#222'); tipGrad.addColorStop(0.5, tipColor); tipGrad.addColorStop(1, '#111');
        ctx.fillStyle = tipGrad; 
        ctx.fillRect(gap - 2, -3, 4, 6); // Chalk Tip

        const gripGrad = ctx.createLinearGradient(0, -4.5, 0, 4.5);
        gripGrad.addColorStop(0, '#111'); gripGrad.addColorStop(0.5, gripColor); gripGrad.addColorStop(1, '#000');
        ctx.fillStyle = gripGrad; 
        ctx.fillRect(gap + stickLength - 60, -4.5, 60, 9); // Back Grip

        ctx.restore();

        // Trajectory Prediction (Forward dotted line)
        
        ctx.beginPath();
        ctx.setLineDash([8, 8]);
        ctx.moveTo(activeCueBall.x, activeCueBall.y);
        
        let remLen = Math.hypot(dx, dy) * 4; // Predict 4x the drag distance
        if (remLen > 0) {
            let dirX = dx / Math.hypot(dx, dy);
            let dirY = dy / Math.hypot(dx, dy);
            let currX = activeCueBall.x;
            let currY = activeCueBall.y;
            let radius = activeCueBall.radius;

            for (let i = 0; i < 4; i++) { // Maksimum 3 bant sekmesi göster
                let distToX = Infinity;
                if (dirX > 0) distToX = (canvas.width - radius - currX) / dirX;
                else if (dirX < 0) distToX = (radius - currX) / dirX;
                
                let distToY = Infinity;
                if (dirY > 0) distToY = (canvas.height - radius - currY) / dirY;
                else if (dirY < 0) distToY = (radius - currY) / dirY;
                
                let dist = Math.min(distToX, distToY);
                
                if (remLen <= dist) {
                    currX += dirX * remLen;
                    currY += dirY * remLen;
                    ctx.lineTo(currX, currY);
                    break;
                } else {
                    currX += dirX * dist;
                    currY += dirY * dist;
                    ctx.lineTo(currX, currY);
                    remLen -= dist;
                    
                    if (distToX < distToY) {
                        dirX = -dirX;
                    } else if (distToY < distToX) {
                        dirY = -dirY;
                    } else {
                        dirX = -dirX;
                        dirY = -dirY;
                    }
                }
            }
        }
        
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.8)'; // Green trajectory line
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]); // Reset
        ctx.closePath();

        // --- Power Bar Indicator ---
        const maxDragDist = 150; // The distance that represents 100% power
        const currentDist = Math.hypot(dx, dy);
        const powerPercent = Math.min(currentDist / maxDragDist, 1);

        const barWidth = 200;
        const barHeight = 15;
        const barX = (canvas.width - barWidth) / 2;
        const barY = canvas.height - 30; // Positioned at bottom center

        // Power bar background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Power bar fill (Gradient from Green -> Yellow -> Red)
        const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
        gradient.addColorStop(0, '#2ecc71');   // Green
        gradient.addColorStop(0.5, '#f1c40f'); // Yellow
        gradient.addColorStop(1, '#e74c3c');   // Red
        
        ctx.fillStyle = gradient;
        ctx.fillRect(barX, barY, barWidth * powerPercent, barHeight);

        // Power bar border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // Power Text
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`GÜÇ: %${Math.round(powerPercent * 100)}`, canvas.width / 2, barY - 8);
    }

    // 4. Draw Spin Controls & Indicator
    if (gameStarted && currentTurn === myPlayerNumber && !shotActive) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText("Sağ/Sol Ok tuşları ile falso (fırıldak) verebilirsiniz", 10, canvas.height - 15);

        if (currentSpin !== 0) {
            let indicatorX = activeCueBall.x + currentSpin * activeCueBall.radius * 0.8;
            let indicatorY = activeCueBall.y;

            // If aiming, draw the spin indicator perpendicular to the shot direction
            if (isDragging) {
                const dx = activeCueBall.x - mouseX;
                const dy = activeCueBall.y - mouseY;
                const dist = Math.hypot(dx, dy);
                if (dist > 0) {
                    indicatorX = activeCueBall.x + (-dy / dist) * currentSpin * activeCueBall.radius * 0.8;
                    indicatorY = activeCueBall.y + (dx / dist) * currentSpin * activeCueBall.radius * 0.8;
                }
            }

            ctx.beginPath();
            ctx.arc(indicatorX, indicatorY, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#e74c3c'; // Red dot for strike point
            ctx.fill();
            ctx.closePath();
        }
    }

    // 4.5 Draw Ball In Hand notification
    if (ballInHand && currentTurn === myPlayerNumber) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("Elde Top: Beyaz topu yerleştirmek için tıklayın", canvas.width / 2, canvas.height / 2 - 50);
    }

    // 5. Draw Shot Result Message
    if (Date.now() < showMessageUntil) {
        ctx.fillStyle = validPoint ? '#2ecc71' : '#e74c3c'; // Green or Red
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(shotResultMessage, canvas.width / 2, 50);
    }

    // 6. Draw Pause Overlay
    if (gamePaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("DURAKLATILDI", canvas.width / 2, canvas.height / 2);
    }

        ctx.restore(); // Kamera sarsıntısını sıfırla

    // 5. Ask browser to call renderLoop again before the next repaint
    requestAnimationFrame(renderLoop);
}