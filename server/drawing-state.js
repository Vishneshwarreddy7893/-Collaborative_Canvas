

class DrawingState {
  constructor(roomId) {
    this.roomId = roomId;
    this.operations = [];
    this.currentIndex = -1;
    this.users = new Map();
  }

  addOperation(operation) {
    // Remove any operations after current index (handles redo stack)
    this.operations = this.operations.slice(0, this.currentIndex + 1);
    
    // Add new operation
    this.operations.push({
      ...operation,
      timestamp: Date.now(),
      id: this.generateOperationId()
    });
    
    this.currentIndex++;
    return this.operations[this.currentIndex];
  }

  undo() {
    if (this.currentIndex < 0) {
      return null;
    }
    const operation = this.operations[this.currentIndex];
    this.currentIndex--;
    return {
      type: 'undo',
      operation: operation,
      newIndex: this.currentIndex
    };
  }

  redo() {
    if (this.currentIndex >= this.operations.length - 1) {
      return null;
    }
    this.currentIndex++;
    const operation = this.operations[this.currentIndex];
    return {
      type: 'redo',
      operation: operation,
      newIndex: this.currentIndex
    };
  }

  getCurrentState() {
    return this.operations.slice(0, this.currentIndex + 1);
  }

  addUser(userId, userData) {
    this.users.set(userId, {
      ...userData,
      joinedAt: Date.now()
    });
  }

  removeUser(userId) {
    this.users.delete(userId);
  }

  getUsers() {
    return Array.from(this.users.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  }

  updateUserCursor(userId, position) {
    const user = this.users.get(userId);
    if (user) {
      user.cursorPosition = position;
    }
  }

  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  clear() {
    this.operations = [];
    this.currentIndex = -1;
  }
}

module.exports = DrawingState;