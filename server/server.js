/**
 * Main Server - Express + Socket.io
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const roomManager = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  res.json(roomManager.getStats());
});

// User colors
const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
];

let colorIndex = 0;

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`\n[Connection] ✅ New connection: ${socket.id}`);
  
  const userColor = USER_COLORS[colorIndex % USER_COLORS.length];
  colorIndex++;

  // Join room
  socket.on('join-room', (data) => {
    const roomId = data.roomId || 'default';
    const userName = data.userName || `User${socket.id.substring(0, 4)}`;
    
    console.log(`[Join] User "${userName}" joining room "${roomId}"`);
    
    socket.join(roomId);
    
    const result = roomManager.addUserToRoom(socket.id, roomId, {
      name: userName,
      color: userColor
    });

    console.log(`[Join] ✅ Sending init-canvas to ${socket.id}`);
    console.log(`[Join] Operations: ${result.currentState.length}, Users: ${result.users.length}`);

    // Send to the new user
    socket.emit('init-canvas', {
      operations: result.currentState,
      users: result.users,
      yourId: socket.id,
      yourColor: userColor
    });

    // Notify others
    socket.to(roomId).emit('user-joined', {
      id: socket.id,
      name: userName,
      color: userColor
    });

    console.log(`[Join] ✅ ${userName} successfully joined ${roomId}`);
  });

  // Draw event
  socket.on('draw', (data) => {
    const room = roomManager.getUserRoom(socket.id);
    if (!room) return;

    const operation = room.addOperation({
      type: 'draw',
      userId: socket.id,
      ...data
    });

    io.to(room.roomId).emit('draw', operation);
  });

  // Cursor move
  socket.on('cursor-move', (data) => {
    const room = roomManager.getUserRoom(socket.id);
    if (!room) return;

    room.updateUserCursor(socket.id, data.position);
    socket.to(room.roomId).emit('cursor-move', {
      userId: socket.id,
      position: data.position
    });
  });

  // Undo
  socket.on('undo', () => {
    const room = roomManager.getUserRoom(socket.id);
    if (!room) return;

    const result = room.undo();
    if (result) {
      io.to(room.roomId).emit('undo', result);
    }
  });

  // Redo
  socket.on('redo', () => {
    const room = roomManager.getUserRoom(socket.id);
    if (!room) return;

    const result = room.redo();
    if (result) {
      io.to(room.roomId).emit('redo', result);
    }
  });

  // Clear canvas
  socket.on('clear-canvas', () => {
    const room = roomManager.getUserRoom(socket.id);
    if (!room) return;

    room.clear();
    io.to(room.roomId).emit('clear-canvas');
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[Disconnect] ❌ ${socket.id} disconnected`);
    
    const result = roomManager.removeUser(socket.id);
    if (result.success) {
      socket.to(result.roomId).emit('user-left', {
        userId: socket.id,
        remainingUsers: result.remainingUsers
      });
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  🎨 Collaborative Canvas Server                        ║
║                                                        ║
║  📡 Port: ${PORT}                                        ║
║  🌐 URL: http://localhost:${PORT}                       ║
║  📊 Stats: http://localhost:${PORT}/api/stats          ║
║                                                        ║
║  ✅ Server is ready!                                   ║
╚════════════════════════════════════════════════════════╝
  `);
});