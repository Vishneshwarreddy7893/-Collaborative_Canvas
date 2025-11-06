

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
    
    setTimeout(() => this.showJoinModal(), 500);
  }

  showJoinModal() {
    console.log('[Main] showJoinModal called');
    
    const modal = document.getElementById('joinModal');
    const joinBtn = document.getElementById('joinBtn');
    const userNameInput = document.getElementById('userName');
    const roomIdInput = document.getElementById('roomId');
    
    if (!modal || !joinBtn) {
      console.error('[Main] Modal elements not found!');
      return;
    }
    
    console.log('[Main] Modal elements found');
    modal.classList.remove('hidden');
    
    joinBtn.onclick = () => {
      console.log('[Main] JOIN BUTTON CLICKED!');
      this.handleJoinRoom(userNameInput.value.trim(), roomIdInput.value.trim(), modal, joinBtn);
    };
    
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
    
    console.log('[Main] handleJoinRoom called');
    console.log('[Main] Name:', userName, 'Room:', roomId);
    
    joinBtn.disabled = true;
    joinBtn.textContent = 'Connecting...';
    
    console.log('[Main] Calling wsClient.connect()');
    window.wsClient.connect();
    
    let connected = false;
    const timeout = setTimeout(() => {
      if (!connected) {
        console.error('[Main] CONNECTION TIMEOUT');
        alert('Connection timeout. Is the server running?');
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join Room';
      }
    }, 5000);
    
    window.wsClient.on('connect', () => {
      if (connected) return;
      connected = true;
      clearTimeout(timeout);
      
      console.log('[Main] Connected callback triggered');
      console.log('[Main] Calling joinRoom()');
      
      const success = window.wsClient.joinRoom(roomId, userName);
      console.log('[Main] joinRoom returned:', success);
      
      if (success) {
        setTimeout(() => {
          console.log('[Main] Hiding modal');
          modal.classList.add('hidden');
          joinBtn.disabled = false;
          joinBtn.textContent = 'Join Room';
        }, 1000);
      }
    });
    
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
      console.log('[Main] Undo button clicked');
      window.wsClient.undo();
    });
    
    document.getElementById('redoBtn').addEventListener('click', () => {
      console.log('[Main] Redo button clicked');
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
    
    // Initial canvas state when joining
    window.wsClient.on('initCanvas', (data) => {
      console.log('[Main] initCanvas callback:', data);
      this.operations = data.operations || [];
      this.currentOperationIndex = this.operations.length - 1;
      window.canvasManager.replayOperations(this.operations);
      window.canvasManager.setOperationCount(this.operations.length);
      if (data.users) {
        data.users.forEach(user => this.addUser(user.id, user));
      }
      this.updateUndoRedoButtons();
    });
    
    // Drawing from other users
    window.wsClient.on('draw', (data) => {
      console.log('[Main] Draw event received:', data);
      
      // Don't draw your own strokes again (already drawn locally)
      if (data.userId === window.wsClient.userId) {
        console.log('[Main] Skipping own drawing');
        return;
      }
      
      // Draw the stroke
      window.canvasManager.drawStroke(data);
      
      // Add to operations array
      this.operations.push(data);
      this.currentOperationIndex++;
      
      window.canvasManager.setOperationCount(this.operations.length);
      this.updateUndoRedoButtons();
    });
    
    // FIXED: Undo should work for ALL users
    window.wsClient.on('undo', (data) => {
      console.log('[Main] ✅ UNDO event received for ALL users:', data);
      
      // Update the current index
      this.currentOperationIndex = data.newIndex;
      
      // Get operations up to the new index
      const currentOps = this.operations.slice(0, this.currentOperationIndex + 1);
      
      console.log('[Main] Replaying operations after undo. Count:', currentOps.length);
      
      // Replay all operations
      window.canvasManager.replayOperations(currentOps);
      window.canvasManager.setOperationCount(currentOps.length);
      
      this.updateUndoRedoButtons();
    });
    
    // FIXED: Redo should work for ALL users
    window.wsClient.on('redo', (data) => {
      console.log('[Main] ✅ REDO event received for ALL users:', data);
      
      // Update the current index
      this.currentOperationIndex = data.newIndex;
      
      // Get operations up to the new index
      const currentOps = this.operations.slice(0, this.currentOperationIndex + 1);
      
      console.log('[Main] Replaying operations after redo. Count:', currentOps.length);
      
      // Replay all operations
      window.canvasManager.replayOperations(currentOps);
      window.canvasManager.setOperationCount(currentOps.length);
      
      this.updateUndoRedoButtons();
    });
    
    // Clear canvas
    window.wsClient.on('clearCanvas', () => {
      console.log('[Main] Clear canvas event');
      this.operations = [];
      this.currentOperationIndex = -1;
      window.canvasManager.clearCanvas();
      this.updateUndoRedoButtons();
    });
    
    // User joined
    window.wsClient.on('userJoined', (data) => {
      console.log('[Main] User joined:', data);
      this.addUser(data.id, data);
    });
    
    // User left
    window.wsClient.on('userLeft', (data) => {
      console.log('[Main] User left:', data);
      this.removeUser(data.userId);
    });
    
    // Cursor movement
    window.wsClient.on('cursorMove', (data) => {
      const user = this.users.get(data.userId);
      if (user) {
        window.canvasManager.updateCursor(data.userId, data.position, user.name, user.color);
      }
    });
  }

  // NEW: Update undo/redo button states
  updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    // Enable undo if we have operations to undo
    if (this.currentOperationIndex >= 0) {
      undoBtn.disabled = false;
      undoBtn.style.opacity = '1';
    } else {
      undoBtn.disabled = true;
      undoBtn.style.opacity = '0.5';
    }
    
    // Enable redo if we have operations ahead of current index
    if (this.currentOperationIndex < this.operations.length - 1) {
      redoBtn.disabled = false;
      redoBtn.style.opacity = '1';
    } else {
      redoBtn.disabled = true;
      redoBtn.style.opacity = '0.5';
    }
    
    console.log('[Main] Button states - Undo:', !undoBtn.disabled, 'Redo:', !redoBtn.disabled);
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        console.log('[Main] Keyboard shortcut: Undo');
        window.wsClient.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        console.log('[Main] Keyboard shortcut: Redo');
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

console.log('[Main] Creating app instance...');
window.app = new CollaborativeCanvasApp();
console.log('[Main] App instance created');