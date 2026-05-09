/**
 * WildArena Multiplayer Server
 * Run: node server.js
 * Then open: http://localhost:8080/game.html
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 8080;
const WS_PORT = 8765;

// ── HTTP file server ──────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  let file = req.url === '/' ? '/game.html' : req.url;
  const filePath = path.join(__dirname, file);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(data);
  });
});
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   MULTIPLAYER OPEN WORLD SERVER      ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Running on port ${PORT}                ║`);
  console.log('║                                      ║');
  console.log('║  LOCAL:  http://localhost:8080       ║');
  console.log('║  LAN:    http://<your-ip>:8080       ║');
  console.log('║                                      ║');
  console.log('║  Get your IP: ifconfig | grep inet   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
});

// ── WebSocket server ──────────────────────────────────────────
const wss = new WebSocket.Server({ port: WS_PORT });
const clients = new Map(); // id → { ws, data }

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      playerId = msg.id;
      clients.set(playerId, { ws, data: msg });
      broadcast({ type:'chat', from:'SERVER', msg:`${playerId} joined!`, color:'#f0c040' });
      sendState();
    } else if (msg.type === 'move') {
      if (clients.has(msg.id)) clients.get(msg.id).data = msg;
      sendState();
    } else if (msg.type === 'chat') {
      broadcast(msg);
    } else if (msg.type === 'attack') {
      // Forward attack damage to target
      if (clients.has(msg.target)) {
        send(clients.get(msg.target).ws, { type:'hit', target: msg.target, dmg: msg.dmg, from: msg.from });
      }
    } else if (msg.type === 'anim_attack') {
      broadcastExcept(playerId, msg);
    }
  });

  ws.on('close', () => {
    if (playerId) {
      clients.delete(playerId);
      broadcast({ type:'chat', from:'SERVER', msg:`${playerId} left.`, color:'#888' });
      sendState();
    }
  });
});

function sendState() {
  const players = [...clients.values()].map(c => c.data).filter(Boolean);
  broadcast({ type:'state', players });
}

function broadcast(msg) {
  const str = JSON.stringify(msg);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(str); });
}

function broadcastExcept(excludeId, msg) {
  const str = JSON.stringify(msg);
  clients.forEach((c, id) => {
    if (id !== excludeId && c.ws.readyState === 1) c.ws.send(str);
  });
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

console.log(`🔌 WildArena WS  server: ws://localhost:${WS_PORT}`);
