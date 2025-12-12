// server.js — Single-Channel Team Radio (WebRTC Signaling Server)

const WebSocket = require('ws');

const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

console.log("Single-Channel Signaling Server running on port " + port);

// ALWAYS use this room (one shared channel)
const ROOM = "team-radio";

const rooms = { [ROOM]: new Set() };

wss.on("connection", (ws) => {
  ws.room = ROOM;
  ws.id = Math.random().toString(36).slice(2, 10);

  // Inform existing peers
  rooms[ROOM].forEach(peer =>
    peer.send(JSON.stringify({ type: "peer-joined", id: ws.id }))
  );

  // Send back list of existing connected peers
  ws.send(JSON.stringify({
    type: "peers",
    id: ws.id,
    peers: Array.from(rooms[ROOM]).map(p => p.id)
  }));

  rooms[ROOM].add(ws);

  ws.on("message", (msg) => {
    try { msg = JSON.parse(msg); } catch (e) { return; }
    const { type, payload } = msg;

    if (["offer", "answer", "ice"].includes(type)) {
      const targetId = payload.target;
      const target = Array.from(rooms[ROOM]).find(s => s.id === targetId);
      if (target) {
        target.send(JSON.stringify({
          type,
          from: ws.id,
          payload: payload.data
        }));
      }
    }
  });

  ws.on("close", () => {
    rooms[ROOM].delete(ws);
    rooms[ROOM].forEach(peer =>
      peer.send(JSON.stringify({ type: "peer-left", id: ws.id }))
    );
  });
});
