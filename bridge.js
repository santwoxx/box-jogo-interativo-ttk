import { WebcastPushConnection } from 'tiktok-live-connector';
import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8081;
const DEFAULT_USERNAME = process.argv[2] || 'codeconnectofc';

// Simple MIME types map for serving static game files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

// Create HTTP server to serve the game files locally
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(__dirname, 'dist', reqPath);

  // Fallback to root or public if dist is not built yet
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, reqPath);
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'public', reqPath);
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback to index.html
        const fallbackPath = fs.existsSync(path.join(__dirname, 'dist', 'index.html'))
          ? path.join(__dirname, 'dist', 'index.html')
          : path.join(__dirname, 'index.html');

        fs.readFile(fallbackPath, (fallbackErr, indexContent) => {
          if (fallbackErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Página não encontrada.');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(indexContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Erro no servidor: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content, 'utf-8');
    }
  });
});

// Attach WebSocketServer
const wss = new WebSocketServer({ server });

let tiktokLiveConnection = null;
let currentUsername = DEFAULT_USERNAME;
const streakTracker = new Map(); // Track cumulative streaks for gifts like roses

function broadcast(data) {
  const json = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(json);
    }
  });
}

function connectToTikTok(username) {
  const cleanUser = username.replace('@', '').trim();
  currentUsername = cleanUser;

  if (tiktokLiveConnection) {
    try {
      tiktokLiveConnection.disconnect();
    } catch (e) {}
  }

  console.log(`\n======================================================`);
  console.log(`🔄 CONECTANDO NA LIVE DO TIKTOK DE: @${cleanUser}...`);
  console.log(`======================================================\n`);

  tiktokLiveConnection = new WebcastPushConnection(cleanUser, {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    requestPollingIntervalMs: 1000
  });

  tiktokLiveConnection
    .connect()
    .then((state) => {
      console.log(`\n🎉 ✅ SUCESSO! Conectado na LIVE de @${cleanUser}!`);
      console.log(`📍 Room ID: ${state.roomId}`);
      console.log(`👀 Aguardando presentes, socos e likes da live...\n`);

      broadcast({
        event: 'connected',
        roomId: state.roomId,
        username: cleanUser
      });
    })
    .catch((err) => {
      console.error(`\n⚠️ Não foi possível conectar na live de @${cleanUser}:`);
      console.error(`👉 Motivo: ${err.message || 'Verifique se você já iniciou a LIVE no TikTok Studio!'}\n`);

      broadcast({
        event: 'error',
        message: `Não foi possível conectar na live de @${cleanUser}. Verifique se a live está aberta!`
      });
    });

  // Escuta presentes da live
  tiktokLiveConnection.on('gift', (data) => {
    let countToTrigger = 1;

    // Se o presente for de combo/streak (ex: Rosas)
    if (data.giftType === 1) {
      const streakKey = `${data.userId}_${data.giftId}`;
      const lastCount = streakTracker.get(streakKey) || 0;
      countToTrigger = Math.max(1, data.repeatCount - lastCount);
      streakTracker.set(streakKey, data.repeatCount);

      if (data.repeatEnd) {
        streakTracker.delete(streakKey);
      }
    } else {
      countToTrigger = data.repeatCount || 1;
    }

    const giftName = data.extendedGiftInfo?.name || data.giftName || 'Rosa';
    const giftId = String(data.giftId || '5655');

    console.log(`🎁 [PRESENTE RECEBIDO] @${data.uniqueId} enviou ${countToTrigger}x ${giftName} (Streak: ${data.repeatCount})!`);

    broadcast({
      event: 'gift',
      uniqueId: data.uniqueId,
      nickname: data.nickname || data.uniqueId,
      giftId: giftId,
      giftName: giftName,
      repeatCount: countToTrigger,
      profilePictureUrl: data.profilePictureUrl,
      diamondCount: data.diamondCount
    });
  });

  // Escuta likes
  tiktokLiveConnection.on('like', (data) => {
    broadcast({
      event: 'like',
      likeCount: data.likeCount,
      totalLikeCount: data.totalLikeCount,
      uniqueId: data.uniqueId
    });
  });

  // Escuta chat
  tiktokLiveConnection.on('chat', (data) => {
    console.log(`💬 [@${data.uniqueId}]: ${data.comment}`);
    broadcast({
      event: 'chat',
      uniqueId: data.uniqueId,
      comment: data.comment
    });
  });

  // Desconexão
  tiktokLiveConnection.on('disconnected', () => {
    console.log(`🔴 Desconectado da live de @${cleanUser}.`);
    broadcast({ event: 'disconnected' });
  });

  tiktokLiveConnection.on('streamEnd', () => {
    console.log(`🔴 Live de @${cleanUser} foi encerrada.`);
    broadcast({ event: 'streamEnd' });
  });
}

wss.on('connection', (ws) => {
  console.log('🟢 Jogo conectado ao Bridge WebSocket local.');

  // Se já estiver conectado no TikTok, avisa o novo cliente conectado
  if (tiktokLiveConnection && tiktokLiveConnection.isConnected) {
    ws.send(
      JSON.stringify({
        event: 'connected',
        username: currentUsername
      })
    );
  }

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.event === 'setUniqueId' && data.uniqueId) {
        connectToTikTok(data.uniqueId);
      }
    } catch (e) {
      console.error(e);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n================================================================`);
  console.log(`🥊 PUNCH FACE LIVE - SERVIDOR LOCAL DO JOGO & BRIDGE ATIVO`);
  console.log(`🎮 Abra o jogo no navegador: http://localhost:${PORT} ou http://localhost:5173`);
  console.log(`📡 Conectando automaticamente na conta do TikTok: @${currentUsername}`);
  console.log(`================================================================\n`);

  // Conecta automaticamente no TikTok ao iniciar
  connectToTikTok(currentUsername);
});
