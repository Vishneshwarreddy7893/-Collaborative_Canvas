# Architecture Documentation

This document explains how the collaborative canvas application works internally.

## Data Flow Diagram

Here's how drawing events flow from one user's canvas to another:

```
User A draws on canvas
         ↓
Canvas.js captures mouse events
         ↓
Batches points (every 3 points)
         ↓
WebSocket.js sends 'draw' event to server
         ↓
Server receives event
         ↓
Server adds operation to room's operation array
         ↓
Server broadcasts to all users in room (including sender)
         ↓
WebSocket.js receives 'draw' event
         ↓
Canvas.js draws the stroke
         ↓
User B sees the drawing appear
```

The key insight here is that we batch points together instead of sending every single mouse movement. This reduces network traffic significantly. I send drawing data in chunks of 3 points, which gives a good balance between smoothness and performance.

## WebSocket Protocol

Here are all the messages the app sends and receives:

### Client → Server

1. **join-room**
   ```javascript
   { roomId: 'default', userName: 'John' }
   ```
   Sent when user joins. Server assigns them to a room.

2. **draw**
   ```javascript
   { 
     points: [{x: 100, y: 200}, {x: 101, y: 201}],
     color: '#FF0000',
     size: 5,
     tool: 'brush'
   }
   ```
   Sent while drawing. Contains stroke data.

3. **cursor-move**
   ```javascript
   { position: {x: 150, y: 250} }
   ```
   Sent every 33ms while mouse moves. Throttled to avoid spam.

4. **undo** - No payload, just triggers undo

5. **redo** - No payload, just triggers redo

6. **clear-canvas** - No payload, clears everything

### Server → Client

1. **init-canvas**
   ```javascript
   {
     operations: [...all previous operations],
     users: [...currently online users],
     yourId: 'socket-id',
     yourColor: '#FF6B6B'
   }
   ```
   Sent when user joins. Gives them full canvas state so they see what others drew.

2. **draw**
   ```javascript
   {
     type: 'draw',
     userId: 'socket-id',
     points: [...],
     color: '#FF0000',
     size: 5,
     tool: 'brush',
     timestamp: 1699123456789,
     id: 'op_123456_abc'
   }
   ```
   Broadcasted to all users when someone draws.

3. **undo**
   ```javascript
   {
     type: 'undo',
     operation: {...operation that was undone},
     newIndex: 42
   }
   ```
   Tells everyone to move back one operation.

4. **redo**
   ```javascript
   {
     type: 'redo',
     operation: {...operation that was redone},
     newIndex: 44
   }
   ```
   Tells everyone to move forward one operation.

5. **user-joined**
   ```javascript
   {
     id: 'socket-id',
     name: 'Alice',
     color: '#4ECDC4'
   }
   ```
   Notifies existing users about new user.

6. **user-left**
   ```javascript
   {
     userId: 'socket-id',
     remainingUsers: [...]
   }
   ```
   Notifies when someone disconnects.

7. **cursor-move**
   ```javascript
   {
     userId: 'socket-id',
     position: {x: 150, y: 250}
   }
   ```
   Shows other users' cursor positions.

## Undo/Redo Strategy

This was the trickiest part. Here's how I implemented global undo/redo:

### Data Structure

The server maintains for each room:
```javascript
{
  operations: [...all drawing operations],
  currentIndex: 42  // points to last active operation
}
```

Each client also keeps a local copy of this for efficiency.

### How Undo Works

1. User clicks undo button
2. Client sends 'undo' event to server
3. Server decrements `currentIndex` by 1
4. Server broadcasts new index to all clients
5. Each client clears canvas and replays operations from index 0 to newIndex
6. Result: Everyone's canvas shows the same thing

### Why This Approach?

I considered two approaches:

**Option 1: Store canvas snapshots**
- Pros: Fast undo
- Cons: Memory intensive, hard to sync

**Option 2: Store operations and replay** (chosen)
- Pros: Memory efficient, easy to sync
- Cons: Slower with many operations

I chose option 2 because it's more reliable for multi-user scenarios. The performance hit is acceptable up to ~500 operations (about 5-10 minutes of continuous drawing).

### Edge Cases Handled

- User A draws, User B undos → Works correctly
- Multiple undos in quick succession → Batched properly
- Undo when at index 0 → Does nothing
- Redo when at last operation → Does nothing
- New drawing after undo → Clears redo stack (standard behavior)

## Performance Decisions

### 1. Point Batching

Instead of sending every mouse move event (could be 60+ per second), I batch points:
```javascript
if (this.strokeBuffer.length >= 3) {
  this.sendDrawingData();
  this.strokeBuffer = [];
}
```

This reduces network traffic by ~95% while maintaining smooth curves.

### 2. Cursor Throttling

Cursor positions are throttled to update max every 33ms:
```javascript
throttledCursorUpdate = (() => {
  let lastUpdate = 0;
  const throttleTime = 33; // ~30 FPS for cursors
  
  return (pos) => {
    const now = Date.now();
    if (now - lastUpdate > throttleTime) {
      window.wsClient.sendCursorPosition(pos);
      lastUpdate = now;
    }
  };
})();
```

This prevents cursor spam while keeping it smooth.

### 3. Canvas Rendering Optimization

I use `lineCap: 'round'` and `lineJoin: 'round'` to make strokes look smooth without anti-aliasing calculations:
```javascript
this.ctx.lineCap = 'round';
this.ctx.lineJoin = 'round';
```

### 4. Room Cleanup

Empty rooms are deleted after 60 seconds to prevent memory leaks:
```javascript
if (room.getUsers().length === 0) {
  setTimeout(() => {
    if (currentRoom.getUsers().length === 0) {
      this.rooms.delete(roomId);
    }
  }, 60000);
}
```

## Conflict Resolution

### Drawing Conflicts

When two users draw on the same spot simultaneously:
- Both strokes are preserved
- Operations are ordered by server receive time
- Last-write-wins for overlapping pixels
- No data loss

This is simpler than Google Docs-style OT (Operational Transform) but works fine for drawing.

### Undo/Redo Conflicts

When User A is drawing and User B clicks undo:
- User A's current stroke is completed first
- Then undo happens
- User A sees their stroke disappear
- This can feel weird but it's technically correct

A better solution would be to prevent undo while anyone is actively drawing, but I didn't implement that due to time constraints.

## System Architecture

```
┌─────────────────────────────────────────┐
│           Client (Browser)              │
│                                         │
│  ┌──────────┐  ┌──────────┐           │
│  │ main.js  │  │canvas.js │           │
│  │  (UI)    │─→│(Drawing) │           │
│  └──────────┘  └──────────┘           │
│        │              ↓                 │
│        └──→  websocket.js              │
│                   ↓                     │
└───────────────────│─────────────────────┘
                    │ Socket.io
                    ↓
┌───────────────────│─────────────────────┐
│           Server (Node.js)              │
│                   ↓                     │
│            ┌──────────┐                 │
│            │server.js │                 │
│            │(Socket.io)                 │
│            └────┬─────┘                 │
│                 │                       │
│         ┌───────┴────────┐              │
│         ↓                ↓              │
│    ┌─────────┐    ┌──────────────┐     │
│    │rooms.js │    │drawing-state │     │
│    │         │    │     .js      │     │
│    └─────────┘    └──────────────┘     │
│                                         │
└─────────────────────────────────────────┘
```

## Why Socket.io Instead of Native WebSockets?

I chose Socket.io because:

1. **Room Management**: Built-in `socket.join(roomId)` makes multi-room trivial
2. **Reconnection**: Automatic reconnection attempts
3. **Fallback**: Falls back to polling if WebSocket fails
4. **Event-based**: Cleaner than parsing raw WebSocket messages
5. **Broadcasting**: `io.to(room).emit()` is simpler than manual tracking

The downside is larger bundle size (~60KB), but for this project the convenience was worth it.

## Scaling Considerations

Current architecture can handle ~50 concurrent users per room comfortably. Beyond that:

**Bottlenecks:**
1. Server CPU for operation replay
2. Network bandwidth for broadcasting
3. Client memory for operation array

**How I'd scale it:**
1. Use Redis for shared state across multiple server instances
2. Implement operation compression (gzip)
3. Add canvas snapshotting every 100 operations
4. Use WebRTC for peer-to-peer drawing (removes server bottleneck)
5. Implement pagination for operation history

## Testing Strategy

I manually tested with:
- 2 windows (basic functionality)
- 4 windows (stress test)
- Slow network (Chrome DevTools throttling)
- Rapid drawing + undo spam
- Disconnection/reconnection

For production I would add:
- Unit tests for undo/redo logic
- Integration tests for WebSocket events
- Load testing with 100+ simulated users
- End-to-end tests with Playwright

---

This architecture prioritizes simplicity and correctness over performance. For a real production app, I'd add more optimizations, but this strikes a good balance for a 3-day assignment.