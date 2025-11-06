

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.userId = null;
    this.userColor = null;
    this.latency = 0;
    this.callbacks = {};
    
    console.log('[WS] WebSocket client created');
  }

  connect() {
    if (this.socket && this.isConnected) {
      console.log('[WS] Already connected');
      if (this.callbacks.connect) {
        this.callbacks.connect.forEach(cb => cb());
      }
      return;
    }

    console.log('[WS] Connecting to server...');
    
    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    this.setupEvents();
  }

  setupEvents() {
    this.socket.on('connect', () => {
      console.log('[WS] CONNECTED! ID:', this.socket.id);
      this.isConnected = true;
      this.updateStatus(true);
      if (this.callbacks.connect) {
        this.callbacks.connect.forEach(cb => cb());
      }
    });

    this.socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
      this.isConnected = false;
      this.updateStatus(false);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[WS] Connection error:', err.message);
    });

    this.socket.on('init-canvas', (data) => {
      console.log('[WS]  init-canvas received');
      this.userId = data.yourId;
      this.userColor = data.yourColor;
      if (this.callbacks.initCanvas) {
        this.callbacks.initCanvas.forEach(cb => cb(data));
      }
    });

    this.socket.on('draw', (data) => {
      if (this.callbacks.draw) {
        this.callbacks.draw.forEach(cb => cb(data));
      }
    });

    this.socket.on('operation-added', (data) => {
      if (this.callbacks['operation-added']) {
        this.callbacks['operation-added'].forEach(cb => cb(data));
      }
    });

    this.socket.on('undo', (data) => {
      console.log('[WS] UNDO event received');
      if (this.callbacks.undo) {
        this.callbacks.undo.forEach(cb => cb(data));
      }
    });

    this.socket.on('redo', (data) => {
      console.log('[WS]  REDO event received');
      if (this.callbacks.redo) {
        this.callbacks.redo.forEach(cb => cb(data));
      }
    });

    this.socket.on('clear-canvas', () => {
      if (this.callbacks.clearCanvas) {
        this.callbacks.clearCanvas.forEach(cb => cb());
      }
    });

    this.socket.on('user-joined', (data) => {
      console.log('[WS] 👤 User joined:', data.name);
      if (this.callbacks.userJoined) {
        this.callbacks.userJoined.forEach(cb => cb(data));
      }
    });

    this.socket.on('user-left', (data) => {
      console.log('[WS]  User left');
      if (this.callbacks.userLeft) {
        this.callbacks.userLeft.forEach(cb => cb(data));
      }
    });

    this.socket.on('cursor-move', (data) => {
      if (this.callbacks.cursorMove) {
        this.callbacks.cursorMove.forEach(cb => cb(data));
      }
    });
  }

  joinRoom(roomId, userName) {
    if (!this.isConnected) {
      console.error('[WS] Cannot join - not connected');
      return false;
    }

    console.log('[WS] Joining room:', roomId, 'as', userName);
    this.socket.emit('join-room', { roomId, userName });
    return true;
  }

  sendDrawing(data) {
    if (this.isConnected) {
      this.socket.emit('draw', data);
    }
  }

  sendCursorPosition(position) {
    if (this.isConnected) {
      this.socket.emit('cursor-move', { position });
    }
  }

  undo() {
    if (this.isConnected) {
      console.log('[WS] Sending UNDO');
      this.socket.emit('undo');
    } else {
      console.error('[WS] Cannot undo - not connected');
    }
  }

  redo() {
    if (this.isConnected) {
      console.log('[WS] Sending REDO');
      this.socket.emit('redo');
    } else {
      console.error('[WS] Cannot redo - not connected');
    }
  }

  clearCanvas() {
    if (this.isConnected) {
      this.socket.emit('clear-canvas');
    }
  }

  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  updateStatus(connected) {
    const el = document.getElementById('connectionStatus');
    if (!el) return;

    const dot = el.querySelector('.status-dot');
    const text = el.querySelector('.status-text');

    if (connected) {
      dot.classList.add('connected');
      text.textContent = 'Connected';
    } else {
      dot.classList.remove('connected');
      text.textContent = 'Disconnected';
    }
  }

  getLatency() {
    return this.latency;
  }
}

window.wsClient = new WebSocketClient();
console.log('[WS] Global wsClient created and attached to window');