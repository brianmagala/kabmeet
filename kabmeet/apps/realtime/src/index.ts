import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { RoomPresenceStore } from './presence/index.js';

const PORT = Number(process.env.PORT ?? 4100);
const presence = new RoomPresenceStore();

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'kabmeet-realtime' }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/ws', 'http://localhost');
  const sessionId = url.searchParams.get('sessionId') ?? 'default';
  const clientId = `rt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const stats = presence.join(sessionId, clientId);
  ws.send(JSON.stringify({ event: 'presence:update', payload: stats }));

  ws.on('message', (raw) => {
    for (const client of wss.clients) {
      if (client.readyState === ws.OPEN) {
        client.send(raw.toString());
      }
    }
  });

  ws.on('close', () => {
    presence.leave(sessionId, clientId);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Kabmeet realtime service listening on http://0.0.0.0:${PORT}`);
});
