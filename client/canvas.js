/**
 * Canvas Manager
 */

class CanvasManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    this.width = 1200;
    this.height = 700;
    this.setupCanvas();
    
    this.isDrawing = false;
    this.currentTool = 'brush';
    this.currentColor = '#000000';
    this.brushSize = 5;
    
    this.currentStroke = {
      points: [],
      color: this.currentColor,
      size: this.brushSize,
      tool: this.currentTool
    };
    
    this.lastFrameTime = Date.now();
    this.fps = 60;
    this.operationCount = 0;
    
    this.cursors = new Map();
    this.lastPoint = null;
    this.strokeBuffer = [];
    
    this.setupEvents();
    console.log('[Canvas] Canvas manager initialized');
  }

  setupCanvas() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  setupEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  handleMouseDown(e) {
    this.isDrawing = true;
    const pos = this.getMousePos(e);
    this.lastPoint = pos;
    this.currentStroke = {
      points: [pos],
      color: this.currentColor,
      size: this.brushSize,
      tool: this.currentTool
    };
  }

  handleMouseMove(e) {
    const pos = this.getMousePos(e);
    
    if (window.wsClient && window.wsClient.isConnected) {
      this.throttledCursorUpdate(pos);
    }
    
    if (!this.isDrawing) return;
    
    this.currentStroke.points.push(pos);
    this.drawLine(this.lastPoint, pos, this.currentColor, this.brushSize, this.currentTool);
    
    this.strokeBuffer.push(pos);
    
    if (this.strokeBuffer.length >= 3) {
      this.sendDrawingData();
      this.strokeBuffer = [];
    }
    
    this.lastPoint = pos;
  }

  handleMouseUp(e) {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    
    if (this.strokeBuffer.length > 0) {
      this.sendDrawingData();
      this.strokeBuffer = [];
    }
    
    this.lastPoint = null;
    this.operationCount++;
  }

  throttledCursorUpdate = (() => {
    let lastUpdate = 0;
    const throttleTime = 33;
    
    return (pos) => {
      const now = Date.now();
      if (now - lastUpdate > throttleTime) {
        window.wsClient.sendCursorPosition(pos);
        lastUpdate = now;
      }
    };
  })();

  sendDrawingData() {
    if (!window.wsClient || !window.wsClient.isConnected) return;
    
    const data = {
      points: this.currentStroke.points.slice(-3),
      color: this.currentStroke.color,
      size: this.currentStroke.size,
      tool: this.currentStroke.tool
    };
    
    window.wsClient.sendDrawing(data);
  }

  drawLine(start, end, color, size, tool) {
    this.ctx.save();
    
    if (tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = color;
    }
    
    this.ctx.lineWidth = size;
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawStroke(strokeData) {
    if (!strokeData.points || strokeData.points.length < 2) return;
    
    const points = strokeData.points;
    for (let i = 1; i < points.length; i++) {
      this.drawLine(points[i - 1], points[i], strokeData.color, strokeData.size, strokeData.tool);
    }
  }

  replayOperations(operations) {
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.width, this.height);
    operations.forEach(op => {
      if (op.type === 'draw') {
        this.drawStroke(op);
      }
    });
  }

  clearCanvas() {
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.operationCount = 0;
  }

  updateCursor(userId, position, userName, color) {
    let cursorElement = this.cursors.get(userId);
    
    if (!cursorElement) {
      cursorElement = document.createElement('div');
      cursorElement.className = 'user-cursor';
      cursorElement.style.backgroundColor = color;
      cursorElement.setAttribute('data-name', userName);
      document.getElementById('cursorsContainer').appendChild(cursorElement);
      this.cursors.set(userId, cursorElement);
    }
    
    cursorElement.style.left = `${position.x}px`;
    cursorElement.style.top = `${position.y}px`;
  }

  removeCursor(userId) {
    const cursorElement = this.cursors.get(userId);
    if (cursorElement) {
      cursorElement.remove();
      this.cursors.delete(userId);
    }
  }

  setTool(tool) {
    this.currentTool = tool;
  }

  setColor(color) {
    this.currentColor = color;
  }

  setSize(size) {
    this.brushSize = size;
  }

  updateFPS() {
    const now = Date.now();
    const delta = now - this.lastFrameTime;
    this.fps = Math.round(1000 / delta);
    this.lastFrameTime = now;
    return this.fps;
  }

  getOperationCount() {
    return this.operationCount;
  }

  setOperationCount(count) {
    this.operationCount = count;
  }
}

// FIX: Attach to window object for global access
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.canvasManager = new CanvasManager('drawingCanvas');
  });
} else {
  window.canvasManager = new CanvasManager('drawingCanvas');
}

console.log('[Canvas] Canvas script loaded');