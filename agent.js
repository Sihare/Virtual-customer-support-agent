 
const { io } = require('socket.io-client');
const readline = require('readline');

const socket = io('http://localhost:3000');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function print(msg) {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  console.log(msg);
  rl.prompt(true);
}

let inChat = false;
let agentName = '';

 socket.on('connect', () => {
  rl.question('Enter agent name: ', name => {
    agentName = name.trim();
    socket.emit('join', { name: agentName, role: 'agent' });

    print('\n--------------------------------------');
    print(` Agent "${agentName}" is now ONLINE`);
    print(' Waiting for a customer to be assigned...');
    print('--------------------------------------');
     

    rl.setPrompt(`${agentName}: `);
    rl.prompt();

    rl.on('line', line => {
      const text = line.trim();
      if (!text) { rl.prompt(); return; }

      if (text === '/end') {
        if (!inChat) { print('[!] No active chat to end.'); rl.prompt(); return; }
        socket.emit('endChat');
        return;
      }

      if (text === '/stats') {
        socket.emit('getStats');
        rl.prompt();
        return;
      }

      if (!inChat) {
        print('[!] No customer assigned yet. Please wait...');
        rl.prompt();
        return;
      }

      socket.emit('message', { content: text });
      socket.emit('typing', false);
      rl.prompt();
    });
  });
});

 
socket.on('assigned', ({ chatId, customerName }) => {
  inChat = true;
  print(`\n======================================`);
  print(` NEW CUSTOMER: "${customerName}"`);
  print(` Chat Room   : ${chatId}`);
  print(`======================================\n`);
  rl.prompt();
});

 socket.on('message', ({ senderName, role, content, time }) => {
  if (role === 'agent') return;  
  print(`[${time}] ${senderName}: ${content}`);
});

 socket.on('typing', ({ name, isTyping }) => {
  if (isTyping) print(`... ${name} is typing`);
});

 socket.on('chatEnded', ({ reason }) => {
  inChat = false;
  print(`\n[ENDED] ${reason}`);
  print('[INFO]  Waiting for next customer...\n');
});

 socket.on('log', msg => print(`[SERVER] ${msg}`));

 socket.on('stats', ({ agentsOnline, freeAgents, activeChats, queueLength }) => {
  print(
    `[STATS]  agents online=${agentsOnline}  free=${freeAgents}` +
    `  active chats=${activeChats}  queue=${queueLength}`
  );
});

 process.stdin.on('keypress', () => {
  if (inChat) {
    socket.emit('typing', true);
    clearTimeout(process._typingTimer);
    process._typingTimer = setTimeout(() => socket.emit('typing', false), 1500);
  }
});

socket.on('disconnect', () => {
  print('\n[DISCONNECTED] Lost connection to server.');
  process.exit(0);
});
