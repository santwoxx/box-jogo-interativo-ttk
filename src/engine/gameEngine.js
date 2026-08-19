import { Boxer } from './boxer.js';
import { ParticleSystem } from './particles.js';
import { audio } from './audioEngine.js';

export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = new ParticleSystem();

    // Virtual resolution
    this.width = 1280;
    this.height = 720;

    // Boxers (Default 10,000 HP for balanced TikTok stream battles)
    this.player = new Boxer({
      id: 'player',
      name: 'YURI',
      isPlayer: true,
      baseX: 420,
      baseY: 530,
      maxHp: 10000,
      gloveColor: '#00e5ff',
      trunksColor: '#1a237e',
      headSrc: '/assets/faces/yuri22.png'
    });

    this.enemy = new Boxer({
      id: 'enemy',
      name: 'DONA',
      isPlayer: false,
      baseX: 860,
      baseY: 530,
      maxHp: 10000,
      gloveColor: '#ff0055',
      trunksColor: '#b71c1c',
      headSrc: '/assets/faces/Dona.png'
    });

    // Game Match State
    this.round = 1;
    this.roundTime = 99;
    this.timerInterval = null;
    this.matchStatus = 'READY'; // READY, FIGHTING, KO, ROUND_OVER
    this.comboCount = 0;
    this.comboTimer = 0;
    this.lastAttacker = null;

    // Camera Shake
    this.trauma = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;

    // Hit Pause / Freeze Frame
    this.freezeTimer = 0;

    // Arena / Background Config
    this.arenaType = 'championship'; // championship, cyberpunk, retro, chroma, custom
    this.arenaImages = {
      championship: new Image(),
      cyberpunk: new Image(),
      retro: new Image(),
      custom: null
    };
    this.arenaImages.championship.src = '/assets/arenas/championship.jpg';
    this.arenaImages.cyberpunk.src = '/assets/arenas/cyberpunk.jpg';
    this.arenaImages.retro.src = '/assets/arenas/retro.jpg';

    this.ringMatText = '🥊 PUNCH FACE LIVE 🥊';
    this.cornerText = '@TIKTOK_LIVE';

    // Action Queue for smooth gift handling
    this.actionQueue = [];
    this.queueProcessTimer = 0;

    this.matchSessionId = 1;

    // Callbacks for UI updates
    this.onUIUpdate = null;
    this.onKOCallback = null;

    this.lastFrameTime = performance.now();
    this.isRunning = false;

    this.initCanvasSize();
    window.addEventListener('resize', () => this.initCanvasSize());
  }

  initCanvasSize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
    }
  }

  start() {
    this.isRunning = true;
    this.matchStatus = 'FIGHTING';
    this.startRoundTimer();
    audio.playGong();
    this.loop(performance.now());
  }

  startRoundTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.matchStatus === 'FIGHTING' && this.roundTime > 0) {
        this.roundTime--;
        if (this.roundTime <= 0) {
          this.endRoundByTime();
        }
        if (this.onUIUpdate) this.onUIUpdate();
      }
    }, 1000);
  }

  addTrauma(amount) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  setArena(type, customSrc = null) {
    this.arenaType = type;
    if (type === 'custom' && customSrc) {
      const img = new Image();
      img.onload = () => {
        this.arenaImages.custom = img;
      };
      img.src = customSrc;
    }
  }

  // Enqueue gift actions or trigger directly
  queueAction(action) {
    this.actionQueue.push(action);
  }

  // Execute punch from Player to Enemy
  playerAttack(punchType = 'jab', customDamage = null, gifterInfo = null) {
    if (this.matchStatus === 'KO') return;

    const damageMap = {
      jab: 15,
      cross: 35,
      hook: 65,
      uppercut: 120,
      super: 250
    };

    const damage = customDamage || damageMap[punchType] || 25;
    const isCrit = punchType === 'uppercut' || punchType === 'super' || Math.random() < 0.18;
    const finalDamage = isCrit ? Math.round(damage * 1.5) : damage;

    this.player.attack(punchType);
    audio.playPunch(punchType);

    // Hit registration with session tracking
    const currentSession = this.matchSessionId;
    setTimeout(() => {
      if (currentSession !== this.matchSessionId || this.enemy.state === 'KO') return;

      const hitX = this.enemy.x - 20;
      const hitY = this.enemy.y - 120;

      // Enemy takes hit
      this.enemy.takeHit(finalDamage, punchType, isCrit);

      // Camera Shake
      const shakePower = punchType === 'super' ? 0.85 : (punchType === 'uppercut' ? 0.6 : 0.3);
      this.addTrauma(shakePower);

      // Freeze frame on big hits
      if (punchType === 'uppercut' || punchType === 'super' || isCrit) {
        this.freezeTimer = 0.08;
      }

      // Visual Particles
      this.particles.spawnImpactSparks(hitX, hitY, isCrit);
      this.particles.spawnSweat(hitX, hitY, 1, isCrit ? 18 : 10, isCrit ? 1.4 : 1.0);
      this.particles.spawnDamageText(hitX, hitY - 30, finalDamage, punchType === 'super' ? 'super' : (isCrit ? 'crit' : 'normal'));

      // Combo System
      this.comboCount++;
      this.comboTimer = 2.5;
      audio.playComboSound(this.comboCount);

      if (this.enemy.hp <= 0) {
        this.handleKO(this.player, this.enemy, gifterInfo);
      }

      if (this.onUIUpdate) this.onUIUpdate();
    }, 85);
  }

  // Execute punch from Enemy to Player
  enemyAttack(punchType = 'jab', customDamage = null) {
    if (this.matchStatus === 'KO') return;

    const damage = customDamage || (punchType === 'uppercut' ? 80 : 25);
    this.enemy.attack(punchType);
    audio.playPunch(punchType);

    const currentSession = this.matchSessionId;
    setTimeout(() => {
      if (currentSession !== this.matchSessionId || this.player.state === 'KO') return;

      const hitX = this.player.x + 20;
      const hitY = this.player.y - 120;

      this.player.takeHit(damage, punchType, false);
      this.addTrauma(0.35);

      this.particles.spawnImpactSparks(hitX, hitY, false);
      this.particles.spawnSweat(hitX, hitY, -1, 10);
      this.particles.spawnDamageText(hitX, hitY - 30, damage, 'normal');

      if (this.player.hp <= 0) {
        this.handleKO(this.enemy, this.player);
      }

      if (this.onUIUpdate) this.onUIUpdate();
    }, 85);
  }

  healPlayer(amount = 100) {
    this.player.heal(amount);
    this.particles.spawnDamageText(this.player.x, this.player.y - 120, amount, 'heal');
    if (this.onUIUpdate) this.onUIUpdate();
  }

  healEnemy(amount = 100) {
    this.enemy.heal(amount);
    this.particles.spawnDamageText(this.enemy.x, this.enemy.y - 120, amount, 'heal');
    if (this.onUIUpdate) this.onUIUpdate();
  }

  setFightersConfig(config = {}) {
    if (config.playerName) this.player.name = config.playerName;
    if (config.enemyName) this.enemy.name = config.enemyName;
    if (config.playerMaxHp) {
      this.player.maxHp = parseInt(config.playerMaxHp, 10);
      this.player.hp = this.player.maxHp;
    }
    if (config.enemyMaxHp) {
      this.enemy.maxHp = parseInt(config.enemyMaxHp, 10);
      this.enemy.hp = this.enemy.maxHp;
    }
    try {
      localStorage.setItem('punch_boxing_fighters_config', JSON.stringify({
        playerName: this.player.name,
        enemyName: this.enemy.name,
        playerMaxHp: this.player.maxHp,
        enemyMaxHp: this.enemy.maxHp
      }));
    } catch (e) {
      console.warn('Error saving fighters config', e);
    }
    if (this.onUIUpdate) this.onUIUpdate();
  }

  loadSavedFightersConfig() {
    try {
      const saved = localStorage.getItem('punch_boxing_fighters_config_v2') || localStorage.getItem('punch_boxing_fighters_config');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.playerName && !['VOCÊ', 'STREAMER'].includes(data.playerName)) this.player.name = data.playerName;
        if (data.enemyName && !['BOSS', 'BOSS FIGHTER'].includes(data.enemyName)) this.enemy.name = data.enemyName;
        if (data.playerMaxHp) {
          const val = parseInt(data.playerMaxHp, 10);
          this.player.maxHp = val <= 1000 ? 10000 : val;
          this.player.hp = this.player.maxHp;
        }
        if (data.enemyMaxHp) {
          const val = parseInt(data.enemyMaxHp, 10);
          this.enemy.maxHp = val <= 1000 ? 10000 : val;
          this.enemy.hp = this.enemy.maxHp;
        }
      }
    } catch (e) {
      console.warn('Error loading fighters config', e);
    }
  }

  handleKO(winner, loser, gifterInfo = null) {
    this.matchStatus = 'KO';
    audio.playKOFanfare();
    this.particles.spawnConfetti(this.width, this.height, 100);

    if (this.onKOCallback) {
      this.onKOCallback({
        winner: winner.name,
        loser: loser.name,
        round: this.round,
        gifter: gifterInfo
      });
    }

    if (this.onUIUpdate) this.onUIUpdate();
  }

  resetMatch(nextRound = false) {
    this.matchSessionId++;
    if (nextRound) {
      this.round++;
    } else {
      this.round = 1;
      this.player.koCount = 0;
      this.enemy.koCount = 0;
    }

    this.roundTime = 99;
    this.matchStatus = 'FIGHTING';
    this.comboCount = 0;
    this.actionQueue = [];
    this.player.reset(true);
    this.enemy.reset(true);
    this.particles.clear();
    audio.playGong();

    if (this.onUIUpdate) this.onUIUpdate();
  }

  endRoundByTime() {
    this.matchStatus = 'ROUND_OVER';
    audio.playGong();
    if (this.onUIUpdate) this.onUIUpdate();
  }

  update(dt) {
    // Adaptive fast queue processing for gift floods
    this.queueProcessTimer += dt;
    const processThreshold = this.actionQueue.length > 12 ? 0.04 : (this.actionQueue.length > 5 ? 0.07 : 0.09);

    if (this.queueProcessTimer >= processThreshold && this.actionQueue.length > 0) {
      this.queueProcessTimer = 0;

      // If queue is heavily flooded (> 20 actions), consolidate into rapid batches
      if (this.actionQueue.length > 20) {
        let totalDamage = 0;
        let lastGifter = null;
        const batchCount = Math.min(6, this.actionQueue.length);
        for (let b = 0; b < batchCount; b++) {
          const item = this.actionQueue.shift();
          if (item.type === 'player_punch') {
            totalDamage += item.damage || 15;
            lastGifter = item.gifter;
          }
        }
        this.playerAttack('uppercut', totalDamage, lastGifter);
      } else {
        const act = this.actionQueue.shift();
        if (act.type === 'player_punch') {
          this.playerAttack(act.punchType, act.damage, act.gifter);
        } else if (act.type === 'enemy_punch') {
          this.enemyAttack(act.punchType, act.damage);
        } else if (act.type === 'heal_player') {
          this.healPlayer(act.amount);
        } else if (act.type === 'heal_enemy') {
          this.healEnemy(act.amount);
        }
      }
    }

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
      }
    }

    // Freeze frame pause
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      return;
    }

    // Camera Shake Decay
    if (this.trauma > 0) {
      const shakeAmount = Math.pow(this.trauma, 2) * 24;
      this.shakeOffsetX = (Math.random() * 2 - 1) * shakeAmount;
      this.shakeOffsetY = (Math.random() * 2 - 1) * shakeAmount;
      this.trauma = Math.max(0, this.trauma - dt * 1.8);
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }

    // Update Boxers
    this.player.update(dt);
    this.enemy.update(dt);

    // Update Particles
    this.particles.update(dt * 60);
  }

  render() {
    const ctx = this.ctx;
    const canvas = this.canvas;

    ctx.save();
    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale canvas to fit virtual 1280x720 while maintaining aspect ratio
    const scaleX = canvas.width / this.width;
    const scaleY = canvas.height / this.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvas.width - this.width * scale) / 2;
    const offsetY = (canvas.height - this.height * scale) / 2;

    ctx.translate(offsetX + this.shakeOffsetX, offsetY + this.shakeOffsetY);
    ctx.scale(scale, scale);

    // 1. Draw Background / Arena
    this.renderArenaBackground(ctx);

    // 2. Draw Ring Canvas Floor / Mat
    this.renderRingFloor(ctx);

    // 3. Draw Back Ropes
    this.renderRopes(ctx, false);

    // 4. Render Boxers
    this.player.render(ctx);
    this.enemy.render(ctx);

    // 5. Draw Front Ropes & Corner Posts
    this.renderRopes(ctx, true);
    this.renderCornerPosts(ctx);

    // 6. Render Particles & Damage FX
    this.particles.render(ctx);

    // 7. Render In-Game Floating Alerts & Banners
    this.renderInGameBanners(ctx);

    ctx.restore();
  }

  renderArenaBackground(ctx) {
    if (this.arenaType === 'chroma') {
      // Chroma Key Green Screen
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(0, 0, this.width, this.height);
      return;
    } else if (this.arenaType === 'transparent') {
      // Transparent OBS background
      return;
    }

    const currentImg = this.arenaType === 'custom'
      ? this.arenaImages.custom
      : this.arenaImages[this.arenaType];

    if (currentImg && currentImg.complete && currentImg.naturalWidth > 0) {
      ctx.drawImage(currentImg, 0, 0, this.width, this.height);
    } else {
      // Fallback Dark Gradient Arena
      const grad = ctx.createLinearGradient(0, 0, 0, this.height);
      grad.addColorStop(0, '#0a0a14');
      grad.addColorStop(0.7, '#16192e');
      grad.addColorStop(1, '#05050a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);

      // Arena Light Beams
      ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(100, 0);
      ctx.lineTo(300, 0);
      ctx.lineTo(600, 720);
      ctx.lineTo(200, 720);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 0, 85, 0.08)';
      ctx.beginPath();
      ctx.moveTo(1180, 0);
      ctx.lineTo(980, 0);
      ctx.lineTo(680, 720);
      ctx.lineTo(1080, 720);
      ctx.closePath();
      ctx.fill();
    }

    // Dynamic Crowd Spotlights
    ctx.save();
    const time = performance.now() * 0.002;
    const spotX1 = 640 + Math.sin(time) * 350;
    const spotX2 = 640 - Math.sin(time * 0.8) * 350;

    const spotGrad1 = ctx.createRadialGradient(spotX1, 540, 10, spotX1, 540, 420);
    spotGrad1.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    spotGrad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spotGrad1;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  renderRingFloor(ctx) {
    if (this.arenaType === 'transparent') return;

    ctx.save();
    // 3D Perspective Ring Mat Trapezoid
    ctx.fillStyle = '#0d131f';
    ctx.beginPath();
    ctx.moveTo(140, 440);
    ctx.lineTo(1140, 440);
    ctx.lineTo(1240, 680);
    ctx.lineTo(40, 680);
    ctx.closePath();
    ctx.fill();

    // Ring Canvas Mat Center Logo
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.ellipse(640, 560, 220, 75, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ring Mat Custom Text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '900 32px "Impact", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.ringMatText, 640, 570);

    // Ring Apron Edge
    ctx.fillStyle = '#080a10';
    ctx.fillRect(40, 680, 1200, 40);

    ctx.fillStyle = '#f5b300';
    ctx.fillRect(40, 680, 1200, 4);

    ctx.restore();
  }

  renderRopes(ctx, isFront = false) {
    if (this.arenaType === 'transparent') return;

    ctx.save();
    const ropeYPositions = isFront ? [520, 600] : [420, 470];
    const ropeColors = ['#ff0055', '#ffffff', '#00e5ff', '#ffea00'];

    ropeYPositions.forEach((y, idx) => {
      ctx.strokeStyle = ropeColors[idx % ropeColors.length];
      ctx.lineWidth = isFront ? 6 : 4;
      ctx.shadowColor = ropeColors[idx % ropeColors.length];
      ctx.shadowBlur = 8;

      ctx.beginPath();
      const startX = isFront ? 60 : 160;
      const endX = isFront ? 1220 : 1120;
      const sag = Math.sin(performance.now() * 0.003 + idx) * 3;

      ctx.moveTo(startX, y);
      ctx.quadraticCurveTo(640, y + 8 + sag, endX, y);
      ctx.stroke();
    });

    ctx.restore();
  }

  renderCornerPosts(ctx) {
    if (this.arenaType === 'transparent') return;

    ctx.save();
    // Blue Corner Post (Left)
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(40, 360, 24, 320);
    ctx.fillStyle = '#007799';
    ctx.fillRect(40, 360, 6, 320);

    // Red Corner Post (Right)
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(1216, 360, 24, 320);
    ctx.fillStyle = '#990033';
    ctx.fillRect(1234, 360, 6, 320);

    // Corner Pads
    ctx.fillStyle = '#111122';
    ctx.fillRect(36, 400, 32, 220);
    ctx.fillRect(1212, 400, 32, 220);

    ctx.restore();
  }

  renderInGameBanners(ctx) {
    // Render Combo Counter
    if (this.comboCount > 1) {
      ctx.save();
      ctx.translate(640, 160);
      const pulse = 1 + Math.sin(performance.now() * 0.015) * 0.08;
      ctx.scale(pulse, pulse);

      ctx.textAlign = 'center';
      ctx.font = '900 36px "Impact", "Arial Black", sans-serif';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.strokeText(`🔥 COMBO x${this.comboCount} 🔥`, 0, 0);

      ctx.fillStyle = '#ffcc00';
      ctx.fillText(`🔥 COMBO x${this.comboCount} 🔥`, 0, 0);
      ctx.restore();
    }

    // Render Knockout Big Screen Overlay
    if (this.matchStatus === 'KO') {
      ctx.save();
      ctx.translate(640, 320);
      const pulseKO = 1 + Math.sin(performance.now() * 0.008) * 0.05;
      ctx.scale(pulseKO, pulseKO);

      ctx.textAlign = 'center';
      ctx.font = '900 82px "Impact", "Arial Black", sans-serif';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 12;
      ctx.strokeText('K. O. !', 0, 0);

      ctx.fillStyle = '#ff0055';
      ctx.fillText('K. O. !', 0, 0);

      ctx.font = '800 26px "Arial", sans-serif';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 5;
      ctx.strokeText('🏆 VITÓRIA DO STREAMER! 🏆', 0, 50);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('🏆 VITÓRIA DO STREAMER! 🏆', 0, 50);

      ctx.restore();
    }
  }

  loop(currentTime) {
    if (!this.isRunning) return;

    const dt = Math.max(0, Math.min(0.1, (currentTime - this.lastFrameTime) / 1000));
    this.lastFrameTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}
