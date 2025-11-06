/**
 * Main Application
 * THIS IS THE KEY FILE - HANDLES JOIN BUTTON
 */

console.log('[Main] Main.js loaded');

class CollaborativeCanvasApp {
  constructor() {
    console.log('[Main] App constructor called');
    
    this.users = new Map();
    this.operations = [];
    this.currentOperationIndex = -1;
    this.fpsInterval = null;
    this.latencyInterval = null;
    
    this.init();
  }

  init() {
    console.log('[Main] Init called');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    console.log('[Main] Setup called');
    
    this.setupUIListeners();
    this.setupWebSocketCallbacks();
    this.setupKeyboardShortcuts();
    this.startPerformanceMonitoring();
    
    // Show modal after a delay
    setTimeout(() => this.showJoinModal(), 500);
  }

  showJoinModal() {
    console.log('[Main] showJoinModal called');
    
    const modal = document.getElementById('joinModal');
    const joinBtn = document.getElementById('joinBtn');
    const userNameInput = document.getElementById('userName');
    const roomIdInput = document.getElementById('roomId');
    
    if (!modal || !joinBtn) {
      console.error('[Main] ❌ Modal elements not found!');
      return;
    }
    
    console.log('[Main] Modal elements found');
    modal.classList.remove('hidden');
    
    // SINGLE EVENT LISTENER - This is the fix!
    joinBtn.onclick = () => {
      console.log('[Main] 🔘 JOIN BUTTON CLICKED!');
      this.handleJoinRoom(userNameInput.value.trim(), roomIdInput.value.trim(), modal, joinBtn);
    };
    
    // Enter key handlers
    userNameInput.onkeypress = (e) => {
      if (e.key === 'Enter') {
        console.log('[Main] Enter in name field');
        joinBtn.click();
      }
    };
    
    roomIdInput.onkeypress = (e) => {
      if (e.key === 'Enter') {
        console.log('[Main] Enter in room field');
        joinBtn.click();
      }
    };
    
    console.log('[Main] Modal shown, listeners attached');
  }

  handleJoinRoom(userName, roomId, modal, joinBtn) {
    userName = userName || 'Anonymous';
    roomId = roomId || 'default';
    
    console.log('[Main] 🚪 handleJoinRoom called');
    console.log('[Main] Name:', userName, 'Room:', roomId);
    
    joinBtn.disabled = true;
    joinBtn.textContent = 'Connecting...';
    
    console.log('[Main] Calling wsClient.connect()');
    window.wsClient.connect();
    
    // Wait for connection
    let connected = false;
    const timeout = setTimeout(() => {
      if (!connected) {
        console.error('[Main] ⏱️ CONNECTION TIMEOUT');
        alert('Connection timeout. Is the server running?');
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join Room';
      }
    }, 5000);
    
    window.wsClient.on('connect', () => {
      if (connected) return;
      connected = true;
      clearTimeout(timeout);
      
      console.log('[Main] ✅ Connected callback triggered');
      console.log('[Main] Calling joinRoom()');
      
      const success = window.wsClient.joinRoom(roomId, userName);
      console.log('[Main] joinRoom returned:', success);
      
      if (success) {
        setTimeout(() => {
          console.log('[Main] ✅ Hiding modal');
          modal.classList.add('hidden');
          joinBtn.disabled = false;
          joinBtn.textContent = 'Join Room';
        }, 1000);
      }
    });
    
    // If already connected
    if (window.wsClient.isConnected) {
      console.log('[Main] Already connected, joining immediately');
      connected = true;
      clearTimeout(timeout);
      window.wsClient.joinRoom(roomId, userName);
      setTimeout(() => {
        modal.classList.add('hidden');
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join Room';
      }, 1000);
    }
  }

  setupUIListeners() {
    console.log('[Main] Setting up UI listeners');
    
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        this.selectTool(tool);
      });
    });
    
    const colorPicker = document.getElementById('colorPicker');
    colorPicker.addEventListener('input', (e) => {
      window.canvasManager.setColor(e.target.value);
    });
    
    document.querySelectorAll('.color-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        colorPicker.value = color;
        window.canvasManager.setColor(color);
      });
    });
    
    const brushSize = document.getElementById('brushSize');
    const brushSizeValue = document.getElementById('brushSizeValue');
    brushSize.addEventListener('input', (e) => {
      const size = parseInt(e.target.value);
      brushSizeValue.textContent = size;
      window.canvasManager.setSize(size);
    });
    
    document.getElementById('undoBtn').addEventListener('click', () => {
      window.wsClient.undo();
    });
    
    document.getElementById('redoBtn').addEventListener('click', () => {
      window.wsClient.redo();
    });
    
    document.getElementById('clearBtn').addEventListener('click', () => {
      if (confirm('Clear canvas for everyone?')) {
        window.wsClient.clearCanvas();
      }
    });
  }

  selectTool(tool) {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
    window.canvasManager.setTool(tool);
  }

  setupWebSocketCallbacks() {
    console.log('[Main] Setting up WebSocket callbacks');
    
    window.wsClient.on('initCanvas', (data) => {
      console.log('[Main] 📊 initCanvas callback:', data);
      this.operations = data.operations;
      this.currentOperationIndex = data.operations.length - 1;
      window.canvasManager.replayOperations(data.operations);
      window.canvasManager.setOperationCount(data.operations.length);
      data.users.forEach(user => this.addUser(user.id, user));
    });
    
    window.wsClient.on('draw', (data) => {
      if (data.userId === window.wsClient.userId) return;
      window.canvasManager.drawStroke(data);
      this.operations.push(data);
      this.currentOperationIndex++;
      window.canvasManager.setOperationCount(this.operations.length);
    });
    
    window.wsClient.on('undo', (data) => {
      this.currentOperationIndex = data.newIndex;
      const currentOps = this.operations.slice(0, this.currentOperationIndex + 1);
      window.canvasManager.replayOperations(currentOps);
      window.canvasManager.setOperationCount(currentOps.length);
    });
    
    window.wsClient.on('redo', (data) => {
      this.currentOperationIndex = data.newIndex;
      const currentOps = this.operations.slice(0, this.currentOperationIndex + 1);
      window.canvasManager.replayOperations(currentOps);
      window.canvasManager.setOperationCount(currentOps.length);
    });
    
    window.wsClient.on('clearCanvas', () => {
      this.operations = [];
      this.currentOperationIndex = -1;
      window.canvasManager.clearCanvas();
    });
    
    window.wsClient.on('userJoined', (data) => {
      this.addUser(data.id, data);
    });
    
    window.wsClient.on('userLeft', (data) => {
      this.removeUser(data.userId);
    });
    
    window.wsClient.on('cursorMove', (data) => {
      const user = this.users.get(data.userId);
      if (user) {
        window.canvasManager.updateCursor(data.userId, data.position, user.name, user.color);
      }
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        window.wsClient.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        window.wsClient.redo();
      }
      if (e.key === 'b' || e.key === 'B') this.selectTool('brush');
      if (e.key === 'e' || e.key === 'E') this.selectTool('eraser');
    });
  }

  addUser(userId, userData) {
    this.users.set(userId, userData);
    this.updateUsersList();
  }

  removeUser(userId) {
    this.users.delete(userId);
    this.updateUsersList();
    window.canvasManager.removeCursor(userId);
  }

  updateUsersList() {
    const usersList = document.getElementById('usersList');
    const userCount = document.getElementById('userCount');
    userCount.textContent = this.users.size;
    usersList.innerHTML = '';
    
    this.users.forEach((user, userId) => {
      const userItem = document.createElement('div');
      userItem.className = 'user-item';
      const isYou = userId === window.wsClient.userId;
      userItem.innerHTML = `
        <div class="user-color" style="background-color: ${user.color}"></div>
        <div class="user-info">
          <div class="user-name">${user.name} ${isYou ? '(You)' : ''}</div>
          <div class="user-status">Online</div>
        </div>
      `;
      usersList.appendChild(userItem);
    });
  }

  startPerformanceMonitoring() {
    this.fpsInterval = setInterval(() => {
      const fps = window.canvasManager.updateFPS();
      document.getElementById('fpsCounter').textContent = fps;
    }, 500);
    
    this.latencyInterval = setInterval(() => {
      const latency = window.wsClient.getLatency();
      document.getElementById('latencyCounter').textContent = `${latency}ms`;
    }, 1000);
    
    setInterval(() => {
      const count = window.canvasManager.getOperationCount();
      document.getElementById('operationCounter').textContent = count;
    }, 100);
  }
}

// Create app instance
console.log('[Main] Creating app instance...');
window.app = new CollaborativeCanvasApp();
console.log('[Main] App instance created');