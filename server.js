// server.js — WebRTC signaling server for Team Radio
const WebSocket = require('ws');

const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

console.log("Signaling server running on port " + port);

const rooms = {}; // roomId -> Set of ws

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try { msg = JSON.parse(msg); } catch (e) { return; }

    const { type, room, payload } = msg;

    if (type === "join") {
      ws.room = room;
      ws.id = payload?.id || Math.random().toString(36).slice(2, 8);

      rooms[room] = rooms[room] || new Set();

      rooms[room].forEach(peer => {
        peer.send(JSON.stringify({ type: "peer-joined", id: ws.id }));
      });

      const existing = Array.from(rooms[room]).map(p => p.id);
      ws.send(JSON.stringify({ type: "peers", peers: existing, id: ws.id }));

      rooms[room].add(ws);
      return;
    }

    if (!room || !rooms[room]) return;

    if (["offer","answer","ice"].includes(type)) {
      const targetId = payload.target;
      const target = Array.from(rooms[room]).find(s => s.id === targetId);
      if (target) {
        target.send(JSON.stringify({ type, from: ws.id, payload: payload.data }));
      }
    }
  });

  ws.on("close", () => {
    const room = ws.room;
    if (room && rooms[room]) {
      rooms[room].delete(ws);
      rooms[room].forEach(peer => 
        peer.send(JSON.stringify({ type: "peer-left", id: ws.id }))
      );
      if (rooms[room].size === 0) delete rooms[room];
    }
  });
});
