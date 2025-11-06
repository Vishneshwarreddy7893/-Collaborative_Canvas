

const DrawingState = require('./drawing-state');

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.userRooms = new Map();
  }

  getOrCreateRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new DrawingState(roomId));
      console.log(`[Room] Created room: ${roomId}`);
    }
    return this.rooms.get(roomId);
  }

  addUserToRoom(userId, roomId, userData) {
    const room = this.getOrCreateRoom(roomId);
    room.addUser(userId, userData);
    this.userRooms.set(userId, roomId);
    
    console.log(`[Room] User ${userData.name} (${userId}) joined room ${roomId}`);
    
    return {
      success: true,
      room: room,
      users: room.getUsers(),
      currentState: room.getCurrentState()
    };
  }

  removeUser(userId) {
    const roomId = this.userRooms.get(userId);
    
    if (!roomId) {
      return { success: false };
    }

    const room = this.rooms.get(roomId);
    if (room) {
      room.removeUser(userId);
      console.log(`[Room] User ${userId} left room ${roomId}`);
      
      // Auto-delete empty rooms after 1 minute
      if (room.getUsers().length === 0) {
        setTimeout(() => {
          const currentRoom = this.rooms.get(roomId);
          if (currentRoom && currentRoom.getUsers().length === 0) {
            this.rooms.delete(roomId);
            console.log(`[Room] Deleted empty room: ${roomId}`);
          }
        }, 60000);
      }
      
      return {
        success: true,
        roomId: roomId,
        remainingUsers: room.getUsers()
      };
    }

    this.userRooms.delete(userId);
    return { success: false };
  }

  getUserRoom(userId) {
    const roomId = this.userRooms.get(userId);
    return roomId ? this.rooms.get(roomId) : null;
  }

  getStats() {
    return {
      totalRooms: this.rooms.size,
      totalUsers: this.userRooms.size,
      rooms: Array.from(this.rooms.entries()).map(([id, room]) => ({
        id,
        users: room.getUsers().length,
        operations: room.operations.length
      }))
    };
  }
}

const roomManager = new RoomManager();
module.exports = roomManager;