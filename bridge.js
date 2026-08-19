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

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

// HTTP Static Server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  const tryPaths = [
    path.join(__dirname, 'dist', reqPath),
    path.join(__dirname, 'public', reqPath),
    path.join(__dirname, reqPath)
  ];

  let targetPath = null;
  for (const p of tryPaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      targetPath = p;
      break;
    }
  }

  if (!targetPath) {
    // Fallback to dist/index.html or index.html
    const indexFallback = fs.existsSync(path.join(__dirname, 'dist', 'index.html'))
      ? path.join(__dirname, 'dist', 'index.html')
      : path.join(__dirname, 'index.html');

    if (fs.existsSync(indexFallback)) {
      targetPath = indexFallback;
    }
  }

  if (targetPath && fs.existsSync(targetPath)) {
    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(targetPath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado no servidor local.');
  }
});

// WebSocket Server
const wss = new WebSocketServer({ server });

let tiktokLiveConnection = null;
let currentUsername = DEFAULT_USERNAME;
let retryTimer = null;
let isConnectedToTikTok = false;
const streakTracker = new Map();

function broadcast(data) {
  const json = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(json);
    }
  });
}

function connectToTikTok(username) {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  const cleanUser = username.replace('@', '').trim();
  currentUsername = cleanUser;

  if (tiktokLiveConnection) {
    try {
      tiktokLiveConnection.disconnect();
    } catch (e) {}
    tiktokLiveConnection = null;
  }

  console.log(`\n======================================================`);
  console.log(`🔄 CONECTANDO NA LIVE DO TIKTOK DE: @${cleanUser}...`);
  console.log(`======================================================`);

  tiktokLiveConnection = new WebcastPushConnection(cleanUser, {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    requestPollingIntervalMs: 1000
  });

  tiktokLiveConnection
    .connect()
    .then((state) => {
      isConnectedToTikTok = true;
      console.log(`\n🎉 ✅ SUCESSO! Conectado na LIVE de @${cleanUser}!`);
      console.log(`📍 Room ID: ${state.roomId}`);
      console.log(`👀 Aguardando presentes e socos em tempo real...\n`);

      broadcast({
        event: 'connected',
        roomId: state.roomId,
        username: cleanUser
      });
    })
    .catch((err) => {
      isConnectedToTikTok = false;
      const errMsg = err.message || 'LIVE offline';
      console.log(`\n⏳ A live de @${cleanUser} está OFFLINE no momento (${errMsg}).`);
      console.log(`🔄 Tentando reconectar automaticamente a cada 8 segundos...`);
      console.log(`💡 Assim que você clicar em "Iniciar LIVE" no TikTok Studio, conectará sozinho!\n`);

      broadcast({
        event: 'error',
        message: `Live @${cleanUser} está offline. Aguardando você iniciar no TikTok Studio...`
      });

      // Tenta reconectar a cada 8 segundos automaticamente
      retryTimer = setTimeout(() => {
        connectToTikTok(cleanUser);
      }, 8000);
    });

  // Escuta presentes
  tiktokLiveConnection.on('gift', (data) => {
    let countToTrigger = 1;

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

    console.log(`🎁 [PRESENTE RECEBIDO] @${data.uniqueId} enviou ${countToTrigger}x ${giftName}!`);

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

  tiktokLiveConnection.on('disconnected', () => {
    isConnectedToTikTok = false;
    console.log(`🔴 Desconectado da live de @${cleanUser}. Reconectando...`);
    broadcast({ event: 'disconnected' });
    retryTimer = setTimeout(() => connectToTikTok(cleanUser), 8000);
  });

  tiktokLiveConnection.on('streamEnd', () => {
    isConnectedToTikTok = false;
    console.log(`🔴 Live de @${cleanUser} finalizou.`);
    broadcast({ event: 'streamEnd' });
    retryTimer = setTimeout(() => connectToTikTok(cleanUser), 8000);
  });
}

wss.on('connection', (ws) => {
  console.log('🟢 Jogo conectado ao Bridge WebSocket local.');

  if (isConnectedToTikTok) {
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
  console.log(`🎮 LINK DO JOGO NO NAVEGADOR: http://localhost:${PORT}`);
  console.log(`📡 CONTA DO TIKTOK CONFIGURADA: @${currentUsername}`);
  console.log(`================================================================\n`);

  connectToTikTok(currentUsername);
});
