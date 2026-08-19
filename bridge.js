import { TikTokLiveConnection } from 'tiktok-live-connector';
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

let wss = null;
let tiktokLiveConnection = null;
let currentUsername = DEFAULT_USERNAME;
let retryTimer = null;
let isConnectedToTikTok = false;
const streakTracker = new Map();

function broadcast(data) {
  if (!wss) return;
  const json = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // 1 = OPEN
      client.send(json);
    }
  });
}

// HTTP Server with Webhooks for TikFinity & direct URL trigger
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const reqPath = parsedUrl.pathname;

  // 1. Universal Webhook endpoint for TikFinity (GET & POST /gift, /api/gift, /trigger)
  if (reqPath === '/gift' || reqPath === '/api/gift' || reqPath === '/trigger' || reqPath === '/api/trigger') {
    const handleGiftPayload = (data) => {
      const giftName =
        data.giftName ||
        data.gift_name ||
        data.name ||
        data.gift ||
        parsedUrl.searchParams.get('gift') ||
        parsedUrl.searchParams.get('giftName') ||
        'Rosa';

      const repeatCount = parseInt(
        data.repeatCount ||
        data.repeat_count ||
        data.count ||
        data.amount ||
        parsedUrl.searchParams.get('count') ||
        1,
        10
      );

      const uniqueId =
        data.uniqueId ||
        data.username ||
        data.user ||
        parsedUrl.searchParams.get('user') ||
        'TikFinity_Live';

      console.log(`🎁 [TIKFINITY WEBHOOK] @${uniqueId} enviou ${repeatCount}x ${giftName}!`);

      broadcast({
        event: 'gift',
        uniqueId: uniqueId,
        nickname: uniqueId,
        giftId: String(data.giftId || giftName),
        giftName: giftName,
        repeatCount: repeatCount
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, gift: giftName, count: repeatCount }));
    };

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        let data = {};
        try {
          data = JSON.parse(body || '{}');
        } catch (e) {
          try {
            data = Object.fromEntries(new URLSearchParams(body));
          } catch (e2) {}
        }
        handleGiftPayload(data);
      });
      return;
    } else {
      handleGiftPayload(Object.fromEntries(parsedUrl.searchParams));
      return;
    }
  }

  // 3. Static Game Files Serving
  let filePathParam = reqPath;
  if (filePathParam === '/') filePathParam = '/index.html';

  const tryPaths = [
    path.join(__dirname, 'dist', filePathParam),
    path.join(__dirname, 'public', filePathParam),
    path.join(__dirname, filePathParam)
  ];

  let targetPath = null;
  for (const p of tryPaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      targetPath = p;
      break;
    }
  }

  if (!targetPath) {
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
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(targetPath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado no servidor local.');
  }
});

// WebSocket Server
wss = new WebSocketServer({ server });

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

  tiktokLiveConnection = new TikTokLiveConnection(cleanUser, {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    requestPollingIntervalMs: 1000
  });

  tiktokLiveConnection
    .connect()
    .then((state) => {
      isConnectedToTikTok = true;
      console.log(`\n🎉 ✅ SUCESSO! Conectado na LIVE de @${cleanUser}!`);
      console.log(`📍 Room ID: ${state?.roomId || 'OK'}`);
      console.log(`👀 Escutando presentes, likes e socos em tempo real...\n`);

      broadcast({
        event: 'connected',
        roomId: state?.roomId,
        username: cleanUser
      });
    })
    .catch((err) => {
      isConnectedToTikTok = false;
      const errMsg = err.message || 'LIVE offline';
      console.log(`\n⏳ A live de @${cleanUser} está OFFLINE no momento (${errMsg}).`);
      console.log(`🔄 Tentando reconectar automaticamente a cada 6 segundos...`);
      console.log(`💡 Assim que você clicar em "Iniciar LIVE" no TikTok Studio, conectará sozinho!\n`);

      broadcast({
        event: 'error',
        message: `Aguardando live de @${cleanUser}... (${errMsg})`
      });

      retryTimer = setTimeout(() => {
        connectToTikTok(cleanUser);
      }, 6000);
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

    console.log(`🎁 [PRESENTE TIKTOK] @${data.uniqueId} enviou ${countToTrigger}x ${giftName}!`);

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
    retryTimer = setTimeout(() => connectToTikTok(cleanUser), 6000);
  });

  tiktokLiveConnection.on('streamEnd', () => {
    isConnectedToTikTok = false;
    console.log(`🔴 Live de @${cleanUser} finalizou.`);
    broadcast({ event: 'streamEnd' });
    retryTimer = setTimeout(() => connectToTikTok(cleanUser), 6000);
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

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n⚠️ O servidor do jogo já está ATIVO na porta ${PORT}!`);
    console.log(`🎮 Abra o jogo no navegador: http://localhost:${PORT}\n`);
    process.exit(0);
  } else {
    console.error('Erro no servidor local:', err);
  }
});

server.listen(PORT, () => {
  console.log(`\n================================================================`);
  console.log(`🥊 PUNCH FACE LIVE - SERVIDOR LOCAL DO JOGO & BRIDGE ATIVO`);
  console.log(`🎮 LINK DO JOGO NO NAVEGADOR: http://localhost:${PORT}`);
  console.log(`📡 CONTA DO TIKTOK: @${currentUsername}`);
  console.log(`🔗 WEBHOOK TIKFINITY: http://localhost:${PORT}/gift`);
  console.log(`================================================================\n`);

  connectToTikTok(currentUsername);
});
