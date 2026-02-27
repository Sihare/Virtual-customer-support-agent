 
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

 socket.on('connect', () => {
  rl.question('Enter your name: ', name => {
    socket.emit('join', { name: name.trim(), role: 'customer' });

    print('\n--- Type your message and press Enter to send ---');
    print('--- Type  /end  to end the chat              ---\n');

    rl.setPrompt('You: ');
    rl.prompt();

    rl.on('line', line => {
      const text = line.trim();
      if (!text) { rl.prompt(); return; }

      if (text === '/end') {
        socket.emit('endChat');
        return;
      }

      if (!inChat) {
        print('[!] Not connected to an agent yet. Please wait...');
        rl.prompt();
        return;
      }

      socket.emit('message', { content: text });
      socket.emit('typing', false);
      rl.prompt();
    });
  });
});

 
socket.on('queued', ({ position }) => {
  print(`\n[QUEUE] All agents are busy. You are #${position} in queue. Please wait...`);
});

 socket.on('assigned', ({ agentName }) => {
  inChat = true;
  print(`\n[CONNECTED] You are now chatting with agent: ${agentName}`);
  print('----------------------------------------------');
  rl.prompt();
});

 socket.on('message', ({ senderName, role, content, time }) => {
  if (role === 'customer') return; 
  print(`[${time}] ${senderName}: ${content}`);
});

 socket.on('typing', ({ name, isTyping }) => {
  if (isTyping) print(`... ${name} is typing`);
});

 socket.on('chatEnded', ({ reason }) => {
  inChat = false;
  print(`\n[ENDED] ${reason}`);
  print('[INFO]  Type /end to quit or wait to be reconnected.\n');
});

 socket.on('log', msg => print(`[SERVER] ${msg}`));

 socket.on('stats', ({ agentsOnline, freeAgents, queueLength, activeChats }) => {
 
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
