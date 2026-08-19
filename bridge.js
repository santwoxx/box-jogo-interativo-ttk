import { WebcastPushConnection } from 'tiktok-live-connector';
import { WebSocketServer } from 'ws';

const PORT = 8081;
let wss;

try {
  wss = new WebSocketServer({ port: PORT });
} catch (err) {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n⚠️ ATENÇÃO: O Bridge já está rodando em outro terminal na porta ${PORT}!\nVocê já pode abrir o jogo no navegador e clicar em "Conectar Live".\n`);
    process.exit(0);
  }
  throw err;
}

wss.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n⚠️ ATENÇÃO: O Bridge já está rodando em outro terminal na porta ${PORT}!\nVocê já pode abrir o jogo no navegador e clicar em "Conectar Live".\n`);
    process.exit(0);
  } else {
    console.error('Erro no servidor WebSocket:', err);
  }
});

let tiktokLiveConnection = null;
let currentUniqueId = null;

console.log(`\n======================================================`);
console.log(`🥊 PUNCH FACE LIVE - SERVIDOR BRIDGE DO TIKTOK ATIVO`);
console.log(`📡 WebSocket ouvindo na porta ws://localhost:${PORT}`);
console.log(`======================================================\n`);

wss.on('connection', (ws) => {
  console.log('🟢 Jogo conectado ao Bridge WebSocket local.');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.event === 'setUniqueId' && data.uniqueId) {
        const username = data.uniqueId.replace('@', '').trim();
        console.log(`\n🔄 Tentando conectar na live do TikTok de: @${username}...`);

        if (tiktokLiveConnection) {
          try {
            tiktokLiveConnection.disconnect();
          } catch (e) {}
        }

        currentUniqueId = username;
        tiktokLiveConnection = new WebcastPushConnection(username, {
          processInitialData: false,
          enableExtendedGiftInfo: true,
          requestPollingIntervalMs: 1000
        });

        tiktokLiveConnection
          .connect()
          .then((state) => {
            console.log(`✅ Conectado com sucesso na LIVE de @${username} (Room ID: ${state.roomId})!`);
            ws.send(
              JSON.stringify({
                event: 'connected',
                roomId: state.roomId,
                username: username
              })
            );
          })
          .catch((err) => {
            console.error(`❌ Erro ao conectar na live de @${username}:`, err.message || err);
            ws.send(
              JSON.stringify({
                event: 'error',
                message: `Não foi possível conectar na live de @${username}. Verifique se a live está aberta!`
              })
            );
          });

        // Escuta presentes da live
        tiktokLiveConnection.on('gift', (data) => {
          console.log(`🎁 [PRESENTE] @${data.uniqueId} enviou ${data.repeatCount}x ${data.giftName} (ID: ${data.giftId})`);

          // Envia para o jogo no navegador
          if (ws.readyState === ws.OPEN) {
            ws.send(
              JSON.stringify({
                event: 'gift',
                uniqueId: data.uniqueId,
                nickname: data.nickname,
                giftId: String(data.giftId),
                giftName: data.giftName,
                repeatCount: data.repeatCount,
                profilePictureUrl: data.profilePictureUrl,
                diamondCount: data.diamondCount
              })
            );
          }
        });

        // Escuta likes da live
        tiktokLiveConnection.on('like', (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(
              JSON.stringify({
                event: 'like',
                likeCount: data.likeCount,
                totalLikeCount: data.totalLikeCount,
                uniqueId: data.uniqueId
              })
            );
          }
        });

        // Escuta comentários
        tiktokLiveConnection.on('chat', (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(
              JSON.stringify({
                event: 'chat',
                uniqueId: data.uniqueId,
                comment: data.comment
              })
            );
          }
        });
      }
    } catch (err) {
      console.error('Erro ao processar mensagem do jogo:', err);
    }
  });

  ws.on('close', () => {
    console.log('🔴 Jogo desconectou do Bridge WebSocket.');
  });
});
