import { audio } from '../engine/audioEngine.js';

// TikTok Live gifts manager with custom battle rules (Player vs Enemy team targets) and anti-lag batching
export class TikTokManager {
  constructor(game) {
    this.game = game;

    // Stream Goal Config
    this.goal = {
      title: 'Meta da Live: Nocautear o Boss',
      giftType: 'rose',
      target: 100,
      current: 0
    };

    // Leaderboard
    this.topGifters = new Map();

    // Official TikTok Live Gifts Catalog (Exact names, real coins and official icons - 2,000 Roses = 20k HP K.O.)
    this.defaultGifts = [
      // Streamer Team Gifts (Ajudam o Streamer a bater no Boss)
      { id: 'rose', name: 'Rosa', coins: 1, icon: '🌹', target: 'player', punchType: 'jab', damage: 10, aliases: ['rose', 'rosa', '5655'] },
      { id: 'tiktok', name: 'TikTok', coins: 1, icon: '🎵', target: 'player', punchType: 'jab', damage: 10, aliases: ['tiktok', 'tiktok logo', '5269'] },
      { id: 'panda', name: 'Mini Panda', coins: 5, icon: '🐼', target: 'player', punchType: 'jab', damage: 50, aliases: ['panda', 'mini panda', '5487'] },
      { id: 'heart', name: 'Heart Me', coins: 10, icon: '💖', target: 'player', punchType: 'cross', damage: 120, aliases: ['heart', 'heart me', 'coração', '5760'] },
      { id: 'sunglasses', name: 'Óculos de Sol', coins: 199, icon: '🕶️', target: 'player', punchType: 'hook', damage: 2400, aliases: ['sunglasses', 'oculos', 'óculos', '5657'] },
      { id: 'moneygun', name: 'Money Gun', coins: 500, icon: '🔫', target: 'player', punchType: 'uppercut', damage: 6000, aliases: ['moneygun', 'money gun', 'pistola de dinheiro', '5650'] },
      { id: 'galaxy', name: 'Galáxia', coins: 1000, icon: '🌌', target: 'player', punchType: 'super', damage: 12000, aliases: ['galaxy', 'galaxia', 'galáxia', '5659'] },
      { id: 'universe', name: 'Universo TikTok', coins: 34999, icon: '✨', target: 'player', punchType: 'super', damage: 20000, aliases: ['universe', 'universo', 'tiktok universe', '5844'] },

      // Enemy Team Gifts (Ajudam o Boss / Trollar o Streamer)
      { id: 'icecream', name: 'Casquinha', coins: 1, icon: '🍦', target: 'enemy', punchType: 'jab', damage: 10, aliases: ['ice cream', 'icecream', 'casquinha', 'sorvete', '5879'] },
      { id: 'doughnut', name: 'Rosquinha', coins: 30, icon: '🍩', target: 'enemy', punchType: 'jab', damage: 350, aliases: ['doughnut', 'donut', 'rosquinha', '5827'] },
      { id: 'duck', name: 'Patinho', coins: 50, icon: '🦆', target: 'enemy', punchType: 'jab', damage: 600, aliases: ['duck', 'pato', 'patinho', '5828'] },
      { id: 'cap', name: 'Boné GG', coins: 99, icon: '🧢', target: 'enemy', punchType: 'hook', damage: 1200, aliases: ['cap', 'bone', 'boné', 'cap and mustache', '5658'] },
      { id: 'corgi', name: 'Corgi Dog', coins: 299, icon: '🐶', target: 'enemy', punchType: 'hook', damage: 3600, aliases: ['corgi', 'dog', 'cachorro'] },
      { id: 'whale', name: 'Baleia', coins: 2150, icon: '🐳', target: 'enemy', punchType: 'uppercut', damage: 14000, aliases: ['whale', 'baleia', 'whale diving'] },
      { id: 'car', name: 'Carro Esportivo', coins: 7000, icon: '🏎️', target: 'enemy', punchType: 'super', damage: 18000, aliases: ['car', 'carro', 'sports car'] },
      { id: 'falcon', name: 'Falcão', coins: 10999, icon: '🦅', target: 'enemy', punchType: 'super', damage: 20000, aliases: ['falcon', 'falcao', 'falcão'] },
      { id: 'lion', name: 'Leão TikTok', coins: 29999, icon: '🦁', target: 'enemy', punchType: 'super', damage: 20000, aliases: ['lion', 'leao', 'leão', '5653'] }
    ];

    this.gifts = JSON.parse(JSON.stringify(this.defaultGifts));

    this.ws = null;
    this.isConnected = false;

    this.loadSavedSettings();
    this.initDOM();
    this.renderGiftButtons();
    this.updateGoalUI();
    this.updateLeaderboardUI();
  }

  findGift(giftIdentifier) {
    if (!giftIdentifier) return this.gifts[0];
    const clean = String(giftIdentifier).toLowerCase().trim();

    // 1. Direct ID match
    let matched = this.gifts.find((g) => g.id.toLowerCase() === clean);
    if (matched) return matched;

    // 2. Exact Name match
    matched = this.gifts.find((g) => g.name.toLowerCase() === clean);
    if (matched) return matched;

    // 3. Alias / Numeric ID match
    matched = this.gifts.find((g) => g.aliases && g.aliases.some((a) => a.toLowerCase() === clean));
    if (matched) return matched;

    // 4. Substring partial match
    matched = this.gifts.find((g) => g.name.toLowerCase().includes(clean) || clean.includes(g.id.toLowerCase()));
    if (matched) return matched;

    return this.gifts[0];
  }

  initDOM() {
    this.streamerGiftsGrid = document.getElementById('streamer-gifts-grid');
    this.enemyGiftsGrid = document.getElementById('enemy-gifts-grid');
    this.onScreenYuriGifts = document.getElementById('on-screen-yuri-gifts');
    this.onScreenDonaGifts = document.getElementById('on-screen-dona-gifts');
    this.giftBar = document.getElementById('gift-quick-bar');
    this.giftAlertContainer = document.getElementById('gift-alert-container');
    this.leaderboardList = document.getElementById('top-gifters-list');

    this.connectBtn = document.getElementById('tiktok-connect-btn');
    this.usernameInput = document.getElementById('tiktok-username-input');

    if (this.usernameInput) {
      const savedUser = localStorage.getItem('punch_tiktok_username') || 'codeconnectofc';
      this.usernameInput.value = savedUser;
    }

    if (this.connectBtn) {
      this.connectBtn.addEventListener('click', () => this.toggleTikTokConnection());
    }

    this.updateLegendNames();

    // Auto-connect if on local HTTP
    if (window.location.protocol === 'http:') {
      setTimeout(() => {
        if (!this.isConnected) {
          this.toggleTikTokConnection();
        }
      }, 500);
    } else if (window.location.protocol === 'https:') {
      this.showHttpsWarning();
    }
  }

  showHttpsWarning() {
    const statusChip = document.getElementById('tiktok-status-chip');
    if (statusChip) {
      statusChip.textContent = '⚠️ Abra em http://localhost:8081';
      statusChip.style.color = '#ffea00';
      statusChip.style.background = 'rgba(255, 234, 0, 0.2)';
    }

    console.warn(
      '⚠️ ATENÇÃO PARA A LIVE: Navegadores bloqueiam conexões WebSocket locais (ws://localhost) quando carregados em páginas HTTPS (Vercel).\n' +
      '👉 Para receber os presentes da sua Live automaticamente, abra o jogo no navegador em:\n' +
      'http://localhost:8081 ou http://localhost:5173'
    );
  }

  updateLegendNames() {
    const pName = this.game?.player?.name || 'YURI';
    const eName = this.game?.enemy?.name || 'DONA';
    document.querySelectorAll('.legend-player-name').forEach((el) => {
      el.textContent = pName.toUpperCase();
    });
    document.querySelectorAll('.legend-enemy-name').forEach((el) => {
      el.textContent = eName.toUpperCase();
    });
  }

  getEffectLabel(gift) {
    const isEnemy = gift.target === 'enemy';
    const isPlayerHeal = gift.target === 'heal_player';
    const isEnemyHeal = gift.target === 'heal_enemy';

    if (isPlayerHeal) return `+${gift.damage} HP Cura`;
    if (isEnemyHeal) return `+${gift.damage} HP Boss`;

    const punchNames = {
      jab: 'Jab',
      cross: 'Direto',
      hook: 'Cruzado',
      uppercut: 'Uppercut',
      super: 'Super Combo'
    };
    const punchName = punchNames[gift.punchType] || 'Golpe';

    if (isEnemy) {
      return `+${gift.damage} Dano no Streamer (${punchName})`;
    }
    return `+${gift.damage} Dano (${punchName})`;
  }

  createOnScreenGiftChip(g, isEnemy) {
    const chip = document.createElement('div');
    chip.className = `stream-gift-chip ${isEnemy ? 'chip-enemy' : 'chip-player'}`;
    chip.setAttribute('data-gift-id', g.id);
    chip.title = `${g.name} (${g.coins}🪙) - Clique para testar!`;

    chip.innerHTML = `
      <span class="chip-icon">${g.icon}</span>
      <div class="chip-info">
        <span class="chip-name">${g.name}</span>
        <span class="chip-cost">${g.coins.toLocaleString('pt-BR')} 🪙</span>
      </div>
      <span class="chip-dmg ${isEnemy ? 'dmg-enemy' : 'dmg-player'}">+${g.damage}</span>
    `;

    chip.addEventListener('click', () => {
      const randomNames = ['Live_Chat', 'Fã_do_Yuri', 'Troll_Dona', 'VIP_Boxeador', 'Super_Doador', 'Top_Stream'];
      const randomName = randomNames[Math.floor(Math.random() * randomNames.length)];
      this.triggerGift(g.id, 1, randomName);
    });

    return chip;
  }

  createGiftCardElement(g, isEnemy) {
    const card = document.createElement('div');
    card.className = `live-gift-card ${isEnemy ? 'card-team-enemy' : 'card-team-streamer'}`;
    card.setAttribute('data-gift-id', g.id);
    card.title = `Clique para testar o presente ${g.name}!`;

    let teamTagHtml = '';
    if (g.target === 'player') {
      teamTagHtml = '<span class="card-team-badge badge-streamer">🟢 AJUDA STREAMER</span>';
    } else if (g.target === 'enemy') {
      teamTagHtml = '<span class="card-team-badge badge-enemy">🔴 AJUDA O BOSS</span>';
    } else if (g.target === 'heal_player') {
      teamTagHtml = '<span class="card-team-badge badge-heal-player">💚 CURA STREAMER</span>';
    } else if (g.target === 'heal_enemy') {
      teamTagHtml = '<span class="card-team-badge badge-heal-enemy">❤️ CURA BOSS</span>';
    }

    const effectText = this.getEffectLabel(g);

    card.innerHTML = `
      <div class="card-left-icon">
        <span class="gift-emoji">${g.icon}</span>
      </div>
      <div class="card-center-info">
        <div class="card-title-row">
          <strong class="gift-name">${g.name}</strong>
          <span class="gift-coins-chip">${g.coins.toLocaleString('pt-BR')} 🪙</span>
        </div>
        <div class="card-effect-desc">
          <span class="effect-icon">${isEnemy ? '👹' : '🥊'}</span>
          <span class="effect-text">${effectText}</span>
        </div>
        <div class="card-team-row">
          ${teamTagHtml}
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      const randomNames = ['Maria_VIP', 'Lucas_Live', 'Ana_KO', 'Rodrigo_Punch', 'TikToker_Gamer', 'Ninja_Fighter', 'Troll_Chat', 'Fã_Numero1'];
      const randomName = randomNames[Math.floor(Math.random() * randomNames.length)];
      this.triggerGift(g.id, 1, randomName);
    });

    return card;
  }

  renderGiftButtons() {
    // 1. Render on-screen live footer chips
    if (this.onScreenYuriGifts && this.onScreenDonaGifts) {
      this.onScreenYuriGifts.innerHTML = '';
      this.onScreenDonaGifts.innerHTML = '';

      this.gifts.forEach((g) => {
        const isEnemy = g.target === 'enemy' || g.target === 'heal_enemy';
        const chip = this.createOnScreenGiftChip(g, isEnemy);

        if (isEnemy) {
          this.onScreenDonaGifts.appendChild(chip);
        } else {
          this.onScreenYuriGifts.appendChild(chip);
        }
      });
    }

    // 2. Render settings modal cards
    if (this.streamerGiftsGrid && this.enemyGiftsGrid) {
      this.streamerGiftsGrid.innerHTML = '';
      this.enemyGiftsGrid.innerHTML = '';

      this.gifts.forEach((g) => {
        const isEnemy = g.target === 'enemy' || g.target === 'heal_enemy';
        const card = this.createGiftCardElement(g, isEnemy);

        if (isEnemy) {
          this.enemyGiftsGrid.appendChild(card);
        } else {
          this.streamerGiftsGrid.appendChild(card);
        }
      });
    }

    // Fallback if legacy giftBar is present
    if (this.giftBar) {
      this.giftBar.innerHTML = '';
      this.gifts.forEach((g) => {
        const isEnemy = g.target === 'enemy' || g.target === 'heal_enemy';
        const card = this.createGiftCardElement(g, isEnemy);
        this.giftBar.appendChild(card);
      });
    }

    this.updateLegendNames();
  }

  // Trigger gift effect with target routing (Streamer vs Enemy Boss)
  triggerGift(giftIdentifier, repeatCount = 1, username = 'Apoiador VIP', userAvatar = null) {
    const gift = this.findGift(giftIdentifier);
    const totalCoins = gift.coins * repeatCount;

    // Play Throttled Gift Sound
    audio.playGiftAlert(gift.coins >= 500 || repeatCount >= 20);

    // Pulse animation on corresponding on-screen gift chips
    document.querySelectorAll(`.stream-gift-chip[data-gift-id="${gift.id}"]`).forEach((el) => {
      el.classList.remove('gift-pop-pulse');
      void el.offsetWidth;
      el.classList.add('gift-pop-pulse');
    });

    // Show on-screen popup alert with target indication
    this.showGiftAlert(username, gift, repeatCount, userAvatar);

    // Update Goal
    if (gift.target === 'player') {
      this.goal.current += repeatCount;
      if (this.goal.current >= this.goal.target) {
        this.goal.current = this.goal.target;
      }
      this.updateGoalUI();
    }

    // Update Leaderboard
    const existing = this.topGifters.get(username) || { name: username, coins: 0, count: 0 };
    existing.coins += totalCoins;
    existing.count += repeatCount;
    this.topGifters.set(username, existing);
    this.updateLeaderboardUI();

    // Determine Action Type & Target
    const isEnemyAttack = gift.target === 'enemy';
    const isPlayerHeal = gift.target === 'heal_player';
    const isEnemyHeal = gift.target === 'heal_enemy';

    if (isPlayerHeal) {
      this.game.queueAction({ type: 'heal_player', amount: gift.damage * repeatCount });
      return;
    } else if (isEnemyHeal) {
      this.game.queueAction({ type: 'heal_enemy', amount: gift.damage * repeatCount });
      return;
    }

    // Attacks (Player or Enemy)
    const actionType = isEnemyAttack ? 'enemy_punch' : 'player_punch';

    if (repeatCount <= 4) {
      for (let i = 0; i < repeatCount; i++) {
        setTimeout(() => {
          this.game.queueAction({
            type: actionType,
            punchType: gift.punchType || 'jab',
            damage: gift.damage,
            gifter: { username, giftName: gift.name, target: gift.target }
          });
        }, i * 85);
      }
    } else {
      // 5+ to 100+ gifts: rapid combo flurry
      const flurryHits = Math.min(8, Math.max(5, Math.floor(repeatCount / 4)));
      const damagePerHit = Math.max(10, Math.round((gift.damage * repeatCount) / flurryHits));

      for (let i = 0; i < flurryHits; i++) {
        setTimeout(() => {
          const isLast = i === flurryHits - 1;
          this.game.queueAction({
            type: actionType,
            punchType: isLast ? 'uppercut' : (i % 2 === 0 ? 'jab' : 'cross'),
            damage: damagePerHit,
            gifter: { username, giftName: gift.name, target: gift.target, comboStreak: repeatCount }
          });
        }, i * 65);
      }
    }
  }

  showGiftAlert(username, gift, count, avatarUrl) {
    if (!this.giftAlertContainer) return;

    if (this.giftAlertContainer.children.length > 4) {
      this.giftAlertContainer.firstElementChild.remove();
    }

    const isEnemyTarget = gift.target === 'enemy';
    const alert = document.createElement('div');
    alert.className = `live-gift-badge animate-slide-in ${isEnemyTarget ? 'alert-enemy-team' : 'alert-player-team'}`;
    const avatar = avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

    let actionText = `enviou ${gift.name} ${gift.icon} (Ajudou Você!)`;
    if (isEnemyTarget) {
      actionText = `enviou ${gift.name} ${gift.icon} (Mandou o Boss bater!)`;
    }

    alert.innerHTML = `
      <img src="${avatar}" class="gift-user-avatar" alt="${username}" />
      <div class="gift-badge-info">
        <span class="gift-user-name">@${username}</span>
        <span class="gift-action-desc">${actionText}</span>
      </div>
      <span class="gift-streak-count">x${count}</span>
    `;

    this.giftAlertContainer.appendChild(alert);

    setTimeout(() => {
      alert.classList.add('fade-out');
      setTimeout(() => alert.remove(), 350);
    }, 2800);
  }

  updateGoalUI() {
    if (this.goalProgressBar) {
      const pct = Math.min(100, Math.round((this.goal.current / this.goal.target) * 100));
      this.goalProgressBar.style.width = `${pct}%`;
    }
    if (this.goalCount) {
      this.goalCount.textContent = `${this.goal.current} / ${this.goal.target}`;
    }
  }

  updateLeaderboardUI() {
    if (!this.leaderboardList) return;

    const sorted = Array.from(this.topGifters.values())
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 3);

    this.leaderboardList.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];

    if (sorted.length === 0) {
      this.leaderboardList.innerHTML = '<li class="no-gifters">Aguardando presentes da live...</li>';
      return;
    }

    sorted.forEach((g, index) => {
      const li = document.createElement('li');
      li.className = 'top-gifter-item';
      li.innerHTML = `
        <span class="rank-medal">${medals[index] || index + 1}</span>
        <span class="gifter-name">@${g.name}</span>
        <span class="gifter-coins">${g.coins} 🪙</span>
      `;
      this.leaderboardList.appendChild(li);
    });
  }

  resetGoal() {
    this.goal.current = 0;
    this.updateGoalUI();
  }

  saveSettings() {
    try {
      localStorage.setItem('punch_boxing_gifts_rules_v4', JSON.stringify(this.gifts));
    } catch (e) {
      console.warn('Error saving gift rules', e);
    }
  }

  loadSavedSettings() {
    try {
      const saved = localStorage.getItem('punch_boxing_gifts_rules_v4');
      if (saved) {
        const savedGifts = JSON.parse(saved);
        this.gifts = this.defaultGifts.map((dg) => {
          const found = savedGifts.find((sg) => sg.id === dg.id);
          return found ? { ...dg, ...found } : dg;
        });
      } else {
        this.gifts = JSON.parse(JSON.stringify(this.defaultGifts));
      }
    } catch (e) {
      console.warn('Error loading gift rules', e);
      this.gifts = JSON.parse(JSON.stringify(this.defaultGifts));
    }
  }

  // Update gift rule by ID
  updateGiftRule(giftId, newProperties) {
    const gift = this.gifts.find((g) => g.id === giftId);
    if (gift) {
      Object.assign(gift, newProperties);
      this.saveSettings();
      this.renderGiftButtons();
    }
  }

  // Add new custom gift
  addCustomGift(newGift) {
    this.gifts.push(newGift);
    this.saveSettings();
    this.renderGiftButtons();
  }

  // Restore defaults
  restoreDefaults() {
    this.gifts = JSON.parse(JSON.stringify(this.defaultGifts));
    this.saveSettings();
    this.renderGiftButtons();
  }

  toggleTikTokConnection() {
    const username = this.usernameInput ? this.usernameInput.value.replace('@', '').trim() : 'codeconnectofc';
    const statusChip = document.getElementById('tiktok-status-chip');

    if (!username) {
      alert('Digite o seu @usuario da Live do TikTok!');
      return;
    }

    localStorage.setItem('punch_tiktok_username', username);

    if (this.isConnected) {
      if (this.ws) this.ws.close();
      this.isConnected = false;
      if (this.connectBtn) this.connectBtn.textContent = 'Conectar Live';
      if (statusChip) {
        statusChip.textContent = 'Desconectado';
        statusChip.style.color = '#ff5577';
        statusChip.style.background = 'rgba(255, 0, 85, 0.15)';
      }
      return;
    }

    if (statusChip) {
      statusChip.textContent = `⏳ Conectando em @${username}...`;
      statusChip.style.color = '#ffea00';
      statusChip.style.background = 'rgba(255, 234, 0, 0.15)';
    }

    const tryConnect = (urls, index = 0) => {
      if (index >= urls.length) {
        alert('Bridge local do TikTok não detectada na porta 8081.\n\nPara conectar automaticamente via live, certifique-se de executar no terminal:\n npm run bridge\n\nOu utilize o TikFinity com as teclas de atalho (1, 2, 3, 4, 5, R)!');
        this.isConnected = false;
        if (this.connectBtn) this.connectBtn.textContent = 'Conectar Live';
        if (statusChip) {
          statusChip.textContent = 'Bridge Desconectada (Inicie: npm run bridge)';
          statusChip.style.color = '#ff5577';
          statusChip.style.background = 'rgba(255, 0, 85, 0.15)';
        }
        return;
      }

      const url = urls[index];
      try {
        const ws = new WebSocket(url);
        this.ws = ws;

        ws.onopen = () => {
          this.isConnected = true;
          if (this.connectBtn) this.connectBtn.textContent = 'Desconectar';
          if (statusChip) {
            statusChip.textContent = `🟢 Conectado ao Bridge! Aguardando @${username}...`;
            statusChip.style.color = '#00ff88';
            statusChip.style.background = 'rgba(0, 255, 136, 0.2)';
          }
          ws.send(JSON.stringify({ event: 'setUniqueId', uniqueId: username }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.event === 'connected') {
              if (statusChip) {
                statusChip.textContent = `🔴 AO VIVO em @${data.username}`;
                statusChip.style.color = '#00ff88';
                statusChip.style.background = 'rgba(0, 255, 136, 0.25)';
              }
            } else if (data.event === 'gift') {
              const rawIdentifier = data.giftId || data.giftName || 'rose';
              const matched = this.findGift(rawIdentifier);
              this.triggerGift(matched.id, data.repeatCount || 1, data.nickname || data.uniqueId, data.profilePictureUrl);
            } else if (data.event === 'like') {
              this.game.playerAttack('jab', 5);
            } else if (data.event === 'error') {
              if (statusChip) {
                statusChip.textContent = `⚠️ Live Offline (@${username})`;
                statusChip.style.color = '#ff9900';
                statusChip.style.background = 'rgba(255, 153, 0, 0.15)';
              }
            } else if (data.event === 'disconnected') {
              // Bridge lost the connection to TikTok (network hiccup, etc) and
              // is already retrying in the background. Without this, the chip
              // stays stuck on the old green "AO VIVO" text forever, so gifts
              // silently stop working with no visible sign anything is wrong.
              if (statusChip) {
                statusChip.textContent = `🟡 Conexão com a live caiu. Reconectando...`;
                statusChip.style.color = '#ffea00';
                statusChip.style.background = 'rgba(255, 234, 0, 0.15)';
              }
            } else if (data.event === 'streamEnd') {
              if (statusChip) {
                statusChip.textContent = `⚫ A live terminou. Aguardando você iniciar de novo...`;
                statusChip.style.color = '#ff5577';
                statusChip.style.background = 'rgba(255, 0, 85, 0.15)';
              }
            } else if (data.event === 'reconnecting') {
              if (statusChip) {
                const attemptText = data.attempt ? ` (tentativa ${data.attempt}${data.max ? `/${data.max}` : ''})` : '';
                statusChip.textContent = `🟡 Reconectando à live de @${data.username || username}...${attemptText}`;
                statusChip.style.color = '#ffea00';
                statusChip.style.background = 'rgba(255, 234, 0, 0.15)';
              }
            } else if (data.event === 'unstable') {
              if (statusChip) {
                statusChip.textContent = `⚠️ Conexão instável com @${data.username || username}, presentes podem falhar...`;
                statusChip.style.color = '#ff9900';
                statusChip.style.background = 'rgba(255, 153, 0, 0.15)';
              }
            }
          } catch (e) {
            console.error(e);
          }
        };

        ws.onerror = () => {
          if (!this.isConnected) {
            tryConnect(urls, index + 1);
          }
        };

        ws.onclose = () => {
          if (this.isConnected) {
            this.isConnected = false;
            if (this.connectBtn) this.connectBtn.textContent = 'Conectar Live';
            if (statusChip) {
              statusChip.textContent = 'Desconectado';
              statusChip.style.color = '#ff5577';
              statusChip.style.background = 'rgba(255, 0, 85, 0.15)';
            }
          }
        };
      } catch (err) {
        tryConnect(urls, index + 1);
      }
    };

    tryConnect(['ws://localhost:8081', 'ws://127.0.0.1:8081']);
  }
}
