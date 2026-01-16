import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Middleware to set Content Security Policy


// Serve static files from the React build
app.use(express.static(path.join(__dirname, 'dist')));

// 1. Token Exchange Endpoint
app.post("/api/token", async (req, res) => {
  try {
    const response = await fetch(`https://discord.com/api/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.VITE_DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: req.body.code,
      }),
    });

    const { access_token } = await response.json();
    res.send({ access_token });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Token exchange failed" });
  }
});

// 2. Video Proxy Endpoint
app.get("/proxy/*", async (req, res) => {
  const targetUrl = req.url.replace('/proxy/', ''); 
  
  if (!targetUrl || targetUrl === '/') {
    return res.status(400).send("Missing URL");
  }

  try {
    const response = await fetch(targetUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': new URL(targetUrl).origin,
            ...(req.headers.range && { Range: req.headers.range })
        }
    });

    const headersToForward = [
      'content-type', 
      'content-length', 
      'accept-ranges', 
      'content-range',
      'last-modified',
      'etag'
    ];

    headersToForward.forEach(headerName => {
        const headerValue = response.headers.get(headerName);
        if (headerValue) {
            res.setHeader(headerName, headerValue);
        }
    });

    res.status(response.status);
    response.body.pipe(res);

  } catch (e) {
    console.error("Proxy error:", e);
    if (!res.headersSent) {
      res.status(500).send("Proxy Error");
    }
  }
});

// 3. Party Existence Check API
app.get("/api/party/:instanceId", (req, res) => {
  const { instanceId } = req.params;
  // Check if room exists in the rooms Map
  if (rooms.has(instanceId)) {
    res.status(200).json({ exists: true });
  } else {
    res.status(404).json({ exists: false });
  }
});

app.get('*', (req, res) => {
  const bypass = ['/api', '/yt', '/yts', '/s', '/proxy', '/yt-static'];
  
  if (bypass.some(path => req.url.startsWith(path))) {
    // Вместо return просто отдаем пустой статус 404
    return res.status(404).end(); 
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


  // --- WebSocket Synchronization Server ---

  // 1. Сначала создаем переменную server
  const server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

  // 2. Теперь WebSocket сможет её увидеть
  const wss = new WebSocketServer({ server });
  const rooms = new Map();

  const broadcastRoomState = (instanceId) => {
    if (!rooms.has(instanceId)) return;
    const room = rooms.get(instanceId);

    const participants = Array.from(room.clients).map(client => ({
      id: client.userId,
      username: client.userData.username,
      avatar: client.userData.avatar
    }));

    let currentAdjustedTime = room.state.currentTime;
    if (room.state.isPlaying) {
      const drift = (Date.now() - room.state.lastUpdated) / 1000;
      currentAdjustedTime += drift;
    }

  const payload = JSON.stringify({
    type: 'STATE_UPDATE',
    data: {
      ...room.state,
      currentTime: currentAdjustedTime,
      participants
    }
  });

  for (const client of room.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  }
};

wss.on('connection', (ws, req) => {
  const urlParams = new URLSearchParams(req.url.split('?')[1]);
  const instanceId = urlParams.get('instanceId');
  const userId = urlParams.get('userId');
  const username = urlParams.get('username');
  const avatar = urlParams.get('avatar');

  if (!instanceId || !userId) {
    ws.close();
    return;
  }

  if (!rooms.has(instanceId)) {
    rooms.set(instanceId, {
      clients: new Set(),
      state: {
        url: '',
        isPlaying: false,
        currentTime: 0,
        lastUpdated: Date.now(),
        hostId: userId, 
      }
    });
  }

  const room = rooms.get(instanceId);
  
  ws.userId = userId;
  ws.userData = { username, avatar };
  ws.instanceId = instanceId;
  
  room.clients.add(ws);
  broadcastRoomState(instanceId);

  ws.on('message', (message) => {
    const parsed = JSON.parse(message);
    const { type, data } = parsed;

    if (!rooms.has(instanceId)) return;
    const currentRoom = rooms.get(instanceId);

    if (currentRoom.state.hostId !== userId) {
        return;
    }

    if (type === 'UPDATE_STATE') {
      currentRoom.state = {
        ...currentRoom.state,
        ...data,
        lastUpdated: Date.now()
      };
      broadcastRoomState(instanceId);
    }

    if (type === 'TRANSFER_HOST') {
        const { targetUserId } = data;
        if (targetUserId) {
            currentRoom.state.hostId = targetUserId;
            broadcastRoomState(instanceId);
        }
    }
  });

  ws.on('close', () => {
    if (rooms.has(instanceId)) {
      const currentRoom = rooms.get(instanceId);
      currentRoom.clients.delete(ws);

      if (currentRoom.state.hostId === userId) {
        if (currentRoom.clients.size > 0) {
          const nextClient = currentRoom.clients.values().next().value;
          currentRoom.state.hostId = nextClient.userId;
        } else {
          rooms.delete(instanceId);
          return;
        }
      }
      broadcastRoomState(instanceId);
    }
  });
});