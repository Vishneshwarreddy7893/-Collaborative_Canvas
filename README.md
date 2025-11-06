# Collaborative Canvas - Real-Time Drawing App

A multi-user drawing application built with vanilla JavaScript and WebSockets. Multiple users can draw together in real-time on the same canvas.

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation & Running

1. Clone the repository
```bash
git clone https://github.com/Vishneshwarreddy7893/-Collaborative_Canvas.git
cd collaborative-canvas
```

2. Install dependencies
```bash
npm install
```

3. Start the server
```bash
npm start
```

4. Open your browser and go to `http://localhost:3000`

That's it! The app should be running.

## Testing with Multiple Users

To test the collaborative features:

1. Open the app in one browser window (`http://localhost:3000`)
2. Enter your name and room ID (default room is fine)
3. Open another browser window or use incognito mode
4. Join the same room with a different name
5. Start drawing in one window - you should see it appear in the other window instantly

You can test with as many windows/tabs as you want. Each user gets assigned a unique color.

## Features Implemented

- **Drawing Tools**: Brush and eraser with adjustable size
- **Color Selection**: Color picker + quick color presets
- **Real-time Sync**: Drawing appears on all connected users' screens as you draw
- **User Cursors**: See where other users are drawing with colored cursors
- **Global Undo/Redo**: Any user can undo/redo operations, works across all users
- **Clear Canvas**: Clears for everyone
- **User List**: Shows who's online with their assigned colors
- **Performance Stats**: FPS counter, latency, and operation count
- **Keyboard Shortcuts**: 
  - Ctrl+Z: Undo
  - Ctrl+Y or Ctrl+Shift+Z: Redo
  - B: Brush tool
  - E: Eraser tool

## Project Structure

```
collaborative-canvas/
├── client/
│   ├── index.html          # Main HTML file
│   ├── style.css           # All styling
│   ├── canvas.js           # Canvas drawing logic
│   ├── websocket.js        # WebSocket client
│   └── main.js             # App initialization & UI
├── server/
│   ├── server.js           # Express + Socket.io server
│   ├── rooms.js            # Room management
│   └── drawing-state.js    # Canvas state & undo/redo
├── package.json
├── README.md
└── ARCHITECTURE.md
```

## Known Limitations / Bugs

1. **Canvas Size**: Fixed at 1200x700px - doesn't adapt to screen size automatically
2. **Mobile Support**: Works but not optimized for touch - need to add touch event handlers
3. **Performance**: With 10+ users drawing simultaneously, you might notice slight lag
4. **Memory**: Long drawing sessions (1000+ operations) might slow down undo/redo
5. **No Persistence**: Canvas state is lost when all users leave the room
6. **Network Issues**: If connection drops, you need to refresh - no auto-reconnect implemented yet

## Time Spent

Approximately 12-14 hours total:
- Day 1 (4 hours): Basic setup, canvas drawing, WebSocket connection
- Day 2 (5 hours): Real-time sync, user cursors, undo/redo logic
- Day 3 (3 hours): UI polish, bug fixes, testing with multiple users
- Final (2 hours): Documentation, deployment preparation

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5 Canvas API
- **Backend**: Node.js, Express.js
- **WebSocket**: Socket.io
- **No frameworks**: Pure DOM manipulation, no React/Vue

## Why Certain Choices?

I used Socket.io instead of native WebSockets because:
- Built-in reconnection handling
- Easier room management
- Automatic polling fallback
- Less code to write for same functionality

The undo/redo system maintains a global operation array on the server, and each client maintains an index pointer. When someone undos, the server broadcasts the new index and all clients replay operations up to that index.

## Future Improvements

If I had more time, I would add:
- Canvas persistence (save to database)
- More tools (rectangle, circle, text)
- Layers system
- Export canvas as image
- Better mobile/touch support
- Canvas zoom and pan
- User authentication

## Browser Compatibility

Tested on:
- Chrome (works perfectly)
- Firefox (works perfectly)
- Safari (works but slightly slower)
- Edge (works perfectly)

---

Built for the Collaborative Canvas assignment. All code written from scratch without copying tutorials.