// server.js

// Import necessary libraries
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { verifyToken } = require('./middleware/auth.middleware');

// Load environment variables from .env file
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const User = require('./models/user.model'); // Import user model for sockets

// Create an instance of an Express application
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// M3: restrict CORS to explicitly-allowed origins (comma-separated in
// CLIENT_ORIGINS; defaults to the local dev origin).
const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Enable CORS for frontend communication
app.use(cors({ origin: allowedOrigins }));

// Create HTTP server and wrap the Express app
const server = http.createServer(app);

// Initialize Socket.io with CORS restricted to the same allow-list
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
  }
});

// --- Database Connection ---
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Exit process with failure
    process.exit(1);
  }
};

connectDB(); // Call the function to connect to the database

// --- API Routes ---
// Root route
app.get('/', (req, res) => {
  res.send('Hello, Billiards Game Backend is running!');
});

// Authentication routes
app.use('/api/auth', authRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Map to store room passwords
const roomPasswords = new Map();
// Map to store player roles per room
const roomPlayers = new Map();
// Map to store online users for invites
const onlineUsers = new Map(); // username -> socket.id

// H2: authenticate every Socket.IO connection using the JWT issued at login.
// Identity is taken from the verified token, never from client-sent values.
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  const user = verifyToken(token);
  if (!user) {
    return next(new Error('Authentication required'));
  }
  socket.user = user;              // { id, username }
  socket.username = user.username; // authoritative identity
  next();
});

// --- WebSocket Connection ---
io.on('connection', (socket) => {
  console.log(`User connected to WebSocket: ${socket.id} (${socket.username})`);

  // Helper function to broadcast online users
  const broadcastOnlineCount = () => {
    io.emit('onlineCountUpdate', onlineUsers.size);
  };

  // M2: lightweight per-socket rate limiters for spammable events.
  const makeLimiter = (max, windowMs) => {
    const hits = [];
    return () => {
      const now = Date.now();
      while (hits.length && hits[0] <= now - windowMs) hits.shift();
      if (hits.length >= max) return false;
      hits.push(now);
      return true;
    };
  };
  const pointLimiter = makeLimiter(10, 10000);   // max 10 score events / 10s
  const messageLimiter = makeLimiter(10, 10000); // max 10 chat messages / 10s

  // Identity is established by the auth middleware above — register as online.
  onlineUsers.set(socket.username, socket.id);
  broadcastOnlineCount();

  // 0. Kept for client compatibility: the username is derived from the
  //    verified token, so any client-sent value is ignored.
  socket.on('userOnline', () => {
    onlineUsers.set(socket.username, socket.id);
    broadcastOnlineCount();
  });

  // 0.5 Handle Ping for Latency
  socket.on('pingRequest', (timestamp) => {
    socket.emit('pongResponse', timestamp);
  });

  socket.on('updateLatency', (latency) => {
    socket.latency = latency;
    if (socket.roomId) {
      const players = roomPlayers.get(socket.roomId);
      if (players) {
        const p1Latency = io.sockets.sockets.get(players.p1)?.latency || 0;
        const p2Latency = io.sockets.sockets.get(players.p2)?.latency || 0;
        io.in(socket.roomId).emit('playerLatencies', { p1: p1Latency, p2: p2Latency });
      }
    }
  });

  // 1. Handle Room Creation
  socket.on('createRoom', (data) => {
    const { password, mode, cue, avatar } = data;
    const username = socket.username; // H2: from verified token, not client
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    socket.join(roomId);
    socket.roomId = roomId; // Store room ID
    socket.role = 'Player 1';
    
    roomPlayers.set(roomId, { p1: socket.id, p1Name: username, p1Cue: cue || 'standard', p1Avatar: avatar || '', p2: null, p2Name: null, p2Cue: null, p2Avatar: null, mode: mode || '3-cushion' });
    if (password) roomPasswords.set(roomId, password);

    socket.emit('roomCreated', { roomId, mode: mode || '3-cushion', p1Name: username, p2Name: null, p1Cue: cue || 'standard', p2Cue: null, p1Avatar: avatar || '', p2Avatar: null });
    console.log(`${username} (${socket.id}) created and joined room ${roomId} in ${mode} mode`);
  });

  // 2. Handle Joining a Room
  socket.on('joinRoom', (data) => {
    const { roomId, password, cue, avatar } = data;
    const username = socket.username; // H2: from verified token, not client
    const room = io.sockets.adapter.rooms.get(roomId);
    
    if (room) {
      // Validate password if the room has one
      if (roomPasswords.has(roomId) && roomPasswords.get(roomId) !== password) {
        return socket.emit('roomError', 'Incorrect room password.');
      }

      if (room.size >= 10) {
        return socket.emit('roomError', 'Room is full (Max 10 users).');
      }

      const players = roomPlayers.get(roomId) || { p1: null, p1Name: null, p1Cue: null, p1Avatar: null, p2: null, p2Name: null, p2Cue: null, p2Avatar: null, mode: '3-cushion' };
      let role = 'Spectator';
      
      // Assign player roles if available
      if (!players.p1) { players.p1 = socket.id; players.p1Name = username; players.p1Cue = cue || 'standard'; players.p1Avatar = avatar || ''; role = 'Player 1'; }
      else if (!players.p2) { players.p2 = socket.id; players.p2Name = username; players.p2Cue = cue || 'standard'; players.p2Avatar = avatar || ''; role = 'Player 2'; }

      socket.join(roomId);
      socket.roomId = roomId;
      socket.role = role;
      
      // Get the host's username
      const hostSocket = io.sockets.sockets.get(players.p1);
      const hostName = hostSocket ? hostSocket.username : 'Host';
      
      socket.emit('roomJoined', { roomId, hostName, role, mode: players.mode, p1Name: players.p1Name, p2Name: players.p2Name, p1Cue: players.p1Cue, p2Cue: players.p2Cue, p1Avatar: players.p1Avatar, p2Avatar: players.p2Avatar });
      socket.to(roomId).emit('playerJoined', { username, role, mode: players.mode, p1Name: players.p1Name, p2Name: players.p2Name, p1Cue: players.p1Cue, p2Cue: players.p2Cue, p1Avatar: players.p1Avatar, p2Avatar: players.p2Avatar });
      console.log(`${username} (${socket.id}) joined room ${roomId} as ${role}`);
    } else {
      socket.emit('roomError', 'Room not found.');
    }
  });

  // 3. Handle Leaving a Room
  socket.on('leaveRoom', () => {
    if (socket.roomId) {
      socket.leave(socket.roomId);
      console.log(`${socket.username} (${socket.id}) left room ${socket.roomId}`);
      
      const players = roomPlayers.get(socket.roomId);
      if (players) {
        if (players.p1 === socket.id) { players.p1 = null; players.p1Name = null; players.p1Cue = null; players.p1Avatar = null; }
        if (players.p2 === socket.id) { players.p2 = null; players.p2Name = null; players.p2Cue = null; players.p2Avatar = null; }
      }
      
      socket.to(socket.roomId).emit('playerLeft', { 
        username: socket.username, role: socket.role, 
        p1Name: players ? players.p1Name : null, 
        p2Name: players ? players.p2Name : null,
        p1Cue: players ? players.p1Cue : null,
        p2Cue: players ? players.p2Cue : null,
        p1Avatar: players ? players.p1Avatar : null,
        p2Avatar: players ? players.p2Avatar : null
      });

      // Clean up room data if the room becomes empty
      const room = io.sockets.adapter.rooms.get(socket.roomId);
      if (!room || room.size === 0) {
        roomPasswords.delete(socket.roomId);
        roomPlayers.delete(socket.roomId);
      }

      socket.roomId = null;
      socket.role = null;
    }
  });

  // 4. Handle Gameplay Sync
  socket.on('shoot', (shotData) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('playerShot', shotData);
    }
  });

  // 4.5 Handle Ball in Hand
  socket.on('placeCueBall', (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('cueBallPlaced', data);
    }
  });

  // 5. Handle Scoring points to database (identity from the verified token)
  socket.on('addPoint', async () => {
    if (!socket.username || !pointLimiter()) return; // M2: throttle
    try {
      await User.findOneAndUpdate({ username: socket.username }, { $inc: { score: 1 } });
    } catch (err) {
      console.error('Failed to update score:', err);
    }
  });

  // 6. Handle Chat Messages
  socket.on('sendMessage', (message) => {
    if (!socket.roomId || !socket.username || !messageLimiter()) return; // M2
    const text = typeof message === 'string' ? message.slice(0, 500) : '';
    if (!text) return;
    io.in(socket.roomId).emit('receiveMessage', {
      username: socket.username,
      message: text
    });
  });

  // 6.5 Handle Reactions
  socket.on('sendReaction', (emoji) => {
    if (socket.roomId && socket.username) {
      io.in(socket.roomId).emit('receiveReaction', {
        username: socket.username,
        emoji: emoji
      });
    }
  });

  // 7. Handle Match Restart
  socket.on('restartGame', () => {
    if (socket.roomId) {
      io.in(socket.roomId).emit('gameRestarted');
    }
  });

  // 7.2 Handle Pause/Resume Game
  socket.on('togglePause', (isPaused) => {
    if (socket.roomId) {
      io.in(socket.roomId).emit('gamePaused', { username: socket.username, isPaused });
    }
  });

  // 7.5 Handle Direct Invites
  socket.on('sendInvite', (data) => {
    const { targetUsername, roomId, mode } = data;
    
    let targetSocketId = null;
    let actualUsername = null;
    
    // Büyük/küçük harf duyarlılığını kaldırmak için tüm online kullanıcıları tara
    for (const [uname, sid] of onlineUsers.entries()) {
      if (uname.toLowerCase() === targetUsername.toLowerCase()) {
        targetSocketId = sid;
        actualUsername = uname;
        break;
      }
    }
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('receiveInvite', { fromUsername: socket.username, roomId, mode });
      socket.emit('inviteSuccess', `Davet başarıyla gönderildi: ${actualUsername}`);
    } else {
      socket.emit('inviteFailed', `Hata: "${targetUsername}" adında aktif bir oyuncu bulunamadı.`);
    }
  });

  // 8. Handle Spectator State Sync
  socket.on('requestStateSync', () => {
    if (socket.roomId) {
      const players = roomPlayers.get(socket.roomId);
      if (players && players.p1) {
        // Ask the host to provide the current game state
        socket.to(players.p1).emit('requestStateSync', socket.id);
      }
    }
  });

  socket.on('sendStateSync', (data) => {
    io.to(data.targetId).emit('receiveStateSync', data.state);
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if (socket.username) {
      onlineUsers.delete(socket.username);
      broadcastOnlineCount();
    }
    if (socket.roomId) {
      const players = roomPlayers.get(socket.roomId);
      if (players) {
        if (players.p1 === socket.id) { players.p1 = null; players.p1Name = null; players.p1Cue = null; players.p1Avatar = null; }
        if (players.p2 === socket.id) { players.p2 = null; players.p2Name = null; players.p2Cue = null; players.p2Avatar = null; }
      }
      
      socket.to(socket.roomId).emit('playerLeft', { 
        username: socket.username, role: socket.role, 
        p1Name: players ? players.p1Name : null, 
        p2Name: players ? players.p2Name : null,
        p1Cue: players ? players.p1Cue : null,
        p2Cue: players ? players.p2Cue : null,
        p1Avatar: players ? players.p1Avatar : null,
        p2Avatar: players ? players.p2Avatar : null
      });

      // Clean up room data if the room becomes empty
      const room = io.sockets.adapter.rooms.get(socket.roomId);
      if (!room || room.size === 0) {
        roomPasswords.delete(socket.roomId);
        roomPlayers.delete(socket.roomId);
      }
    }
  });
});

// --- Server Initialization ---
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
