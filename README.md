# 🖥️ Live Chat Console — Real-Time Customer Support via Terminal

A terminal-based real-time customer support chat system built with **Node.js**, **Socket.io**, and **json-server**. No browser, no HTML — everything runs in your console. Multiple customers and agents connect over WebSockets, with automatic agent assignment and a FIFO waiting queue.

---

## 🚀 Quick Start

**1. Install dependencies**
```bash
npm install
```

**2. Open 3 terminals and run:**

| Terminal | Command | Role |
|---|---|---|
| 1 | `npm run db` | Starts json-server (database) on port 4000 |
| 2 | `npm run server` | Starts WebSocket server on port 3000 |
| 3+ | `npm run agent` | Launch an agent console |
| 3+ | `npm run customer` | Launch a customer console |

Run as many `agent` and `customer` terminals as you want to simulate multiple users.

---

## 🗂️ Project Structure

```
chat-console/
├── server.js      → WebSocket server + assignment logic
├── agent.js       → Agent console client
├── customer.js    → Customer console client
├── db.json        → json-server database (chats + messages)
└── package.json
```

---

## ⚙️ How It Works

### Agent Assignment Logic

```
Customer joins
    ├── Free agent available?
    │       YES → assign immediately (paired into Socket.io room)
    │       NO  → push to waitingQueue[], tell customer their position
    │
Agent joins
    └── Customers in queue?
            YES → pick first customer, assign immediately
            NO  → wait online for next customer

Chat ends / user disconnects
    └── Agent freed → assignCustomerToAgent() called again
                    → next customer in queue gets the agent
```

### Socket.io Rooms
Each paired chat creates a private Socket.io room (`chat_<timestamp>`). Messages only go to the two users in that room — no leakage between chats.

### In-Memory State
```js
online = {
  socketId: { socketId, name, role, chatId }
}

waitingQueue = [ socketId, socketId, ... ]  // FIFO
```

### json-server (Database)
All chats and messages are persisted to `db.json` via REST calls to json-server.

```
GET  http://localhost:4000/chats
GET  http://localhost:4000/messages
```

---

## 💬 Console Commands

| Command | Who | Action |
|---|---|---|
| Type any text + Enter | Customer / Agent | Send a message |
| `/end` | Customer / Agent | End the current chat |
| `/stats` | Agent | Print live server stats |

---

## 📡 WebSocket Events

| Event | Direction | Description |
|---|---|---|
| `join` | Client → Server | Register name and role |
| `message` | Client → Server | Send a message |
| `typing` | Client → Server | Typing indicator (true/false) |
| `endChat` | Client → Server | End the current chat |
| `assigned` | Server → Client | Notify both sides of a pairing |
| `queued` | Server → Customer | Inform customer of queue position |
| `message` | Server → Room | Broadcast message to both users |
| `typing` | Server → Room | Broadcast typing indicator |
| `chatEnded` | Server → Room | Notify both that chat is closed |
| `stats` | Server → All | Live agent/queue/chat counts |

---

## 🔄 Multi-User Scenario

```
Agents:    Sarah (free),  James (free)
Customers: Alice, Bob, Carol (joining one after another)

Alice joins → assigned to Sarah   ✅
Bob   joins → assigned to James   ✅
Carol joins → no free agents → queue #1 ⏳

Sarah ends chat with Alice
→ Sarah is now free
→ Carol is pulled from queue → assigned to Sarah ✅
```

---

## 🛠️ Tech Stack

| Tool | Purpose |
|---|---|
| Node.js | Runtime |
| Socket.io | Real-time WebSocket communication |
| socket.io-client | Console clients connect to the server |
| Express | HTTP server (Socket.io attaches to it) |
| json-server | Zero-config REST database for chats and messages |
| readline | Node.js built-in for reading console input |

---

## 📄 License

MIT
