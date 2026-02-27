 
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const DB = 'http://localhost:4000';
 
const online = {};

 
const waitingQueue = [];

 
async function dbPost(path, body) {
  const res = await fetch(`${DB}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function dbPatch(path, body) {
  const res = await fetch(`${DB}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

 
function getFreeAgent() {
  return Object.values(online).find(u => u.role === 'agent' && u.chatId === null);
}

 function broadcastStats() {
  const agents = Object.values(online).filter(u => u.role === 'agent');
  const stats = {
    agentsOnline: agents.length,
    freeAgents: agents.filter(u => u.chatId === null).length,
    activeChats: agents.filter(u => u.chatId !== null).length,
    queueLength: waitingQueue.length
  };
  io.emit('stats', stats);

   console.log(
    `[STATS]  agents=${stats.agentsOnline}  free=${stats.freeAgents}` +
    `  activeChats=${stats.activeChats}  queue=${stats.queueLength}`
  );
}

 
async function assignCustomerToAgent(agentSocketId) {
  if (waitingQueue.length === 0) return; 

  const customerSocketId = waitingQueue.shift();  
  const customer = online[customerSocketId];
  const agent = online[agentSocketId];

  if (!customer || !agent) return;

   const chatId = `chat_${Date.now()}`;
  await dbPost('/chats', {
    id: chatId,
    customerId: customerSocketId,
    customerName: customer.name,
    agentId: agentSocketId,
    agentName: agent.name,
    status: 'active',
    startedAt: new Date().toISOString()
  });

   online[customerSocketId].chatId = chatId;
  online[agentSocketId].chatId = chatId;

   io.sockets.sockets.get(customerSocketId)?.join(chatId);
  io.sockets.sockets.get(agentSocketId)?.join(chatId);

   io.to(customerSocketId).emit('assigned', { chatId, agentName: agent.name });
  io.to(agentSocketId).emit('assigned', { chatId, customerName: customer.name });

  console.log(`[ASSIGN]  "${customer.name}"  <-->  "${agent.name}"   room=${chatId}`);
  broadcastStats();
}

 
async function closeChat(chatId, reason) {
   await dbPatch(`/chats/${chatId}`, {
    status: 'closed',
    closedAt: new Date().toISOString()
  });

   io.to(chatId).emit('chatEnded', { reason });
  console.log(`[CLOSE]   room=${chatId}  reason="${reason}"`);

   const agent = Object.values(online).find(u => u.chatId === chatId && u.role === 'agent');
  if (agent) {
    agent.chatId = null;
    assignCustomerToAgent(agent.socketId); 
  }

   const customer = Object.values(online).find(u => u.chatId === chatId && u.role === 'customer');
  if (customer) customer.chatId = null;

  broadcastStats();
}

 
io.on('connection', socket => {

   socket.on('join', ({ name, role }) => {
    online[socket.id] = { socketId: socket.id, name, role, chatId: null };
    console.log(`[JOIN]    "${name}" joined as ${role}  socket=${socket.id}`);

    if (role === 'agent') {
      socket.emit('log', `You are online as agent "${name}". Waiting for customers...`);
       assignCustomerToAgent(socket.id);

    } else {
       const freeAgent = getFreeAgent();
      if (freeAgent) {
        waitingQueue.push(socket.id);
        assignCustomerToAgent(freeAgent.socketId);
      } else {
        waitingQueue.push(socket.id);
        const position = waitingQueue.indexOf(socket.id) + 1;
        socket.emit('queued', { position });
        console.log(`[QUEUE]   "${name}" is #${position} in queue`);
      }
    }

    broadcastStats();
  });

   socket.on('message', async ({ content }) => {
    const user = online[socket.id];
    if (!user || !user.chatId) {
      socket.emit('log', 'You are not in an active chat.');
      return;
    }

    const msg = {
      chatId: user.chatId,
      senderName: user.name,
      role: user.role,
      content,
      time: new Date().toLocaleTimeString()
    };

     await dbPost('/messages', msg);

     io.to(user.chatId).emit('message', msg);
  });

   socket.on('typing', isTyping => {
    const user = online[socket.id];
    if (!user || !user.chatId) return;
    socket.to(user.chatId).emit('typing', { name: user.name, isTyping });
  });

   socket.on('endChat', () => {
    const user = online[socket.id];
    if (!user || !user.chatId) return;
    closeChat(user.chatId, `${user.name} ended the chat`);
  });

   socket.on('disconnect', () => {
    const user = online[socket.id];
    if (!user) return;
    console.log(`[LEAVE]   "${user.name}" disconnected`);

    if (user.chatId) {
      closeChat(user.chatId, `${user.name} disconnected`);
    }

     const idx = waitingQueue.indexOf(socket.id);
    if (idx !== -1) waitingQueue.splice(idx, 1);

    delete online[socket.id];
    broadcastStats();
  });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('\n==============================');
  console.log(' Chat Server started');
  console.log(` Port : ${PORT}`);
  console.log(' DB   : http://localhost:4000 ');
  console.log('==============================\n');
});

 server.on('error', err => {
  if (err.code === 'Error_occur') {
    console.error(`\nERROR: port ${PORT} is already in use. ` +
      'either stop the other process or set a different PORT.');
    process.exit(1);
  }
  console.error('Server error:', err);
});
