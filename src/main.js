import { GameEngine } from './engine/gameEngine.js';
import { audio } from './engine/audioEngine.js';
import { FaceCustomizer } from './systems/faceCustomizer.js';
import { HotkeyManager } from './systems/hotkeyManager.js';
import { TikTokManager } from './systems/tiktokManager.js';
import { ArenaManager } from './systems/arenaManager.js';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const game = new GameEngine(canvas);

  // Initialize Subsystems
  const faceCustomizer = new FaceCustomizer(game);
  const hotkeyManager = new HotkeyManager(game);
  const tiktokManager = new TikTokManager(game);
  const arenaManager = new ArenaManager(game);

  // Load saved configurations
  faceCustomizer.loadSavedProfiles();

  // HUD Elements
  const playerNameDisplay = document.getElementById('player-name-display');
  const playerHpFill = document.getElementById('player-hp-fill');
  const playerHpText = document.getElementById('player-hp-text');
  const playerKoBadge = document.getElementById('player-ko-badge');
  const playerAvatarPreview = document.getElementById('player-avatar-preview');

  const enemyNameDisplay = document.getElementById('enemy-name-display');
  const enemyHpFill = document.getElementById('enemy-hp-fill');
  const enemyHpText = document.getElementById('enemy-hp-text');
  const enemyKoBadge = document.getElementById('enemy-ko-badge');
  const enemyAvatarPreview = document.getElementById('enemy-avatar-preview');

  const roundText = document.getElementById('round-text');
  const roundTimerText = document.getElementById('round-timer-text');

  // Guerra da Live Elements
  const warPlayerBar = document.getElementById('war-player-bar');
  const warEnemyBar = document.getElementById('war-enemy-bar');
  const warPlayerPct = document.getElementById('war-player-pct');
  const warEnemyPct = document.getElementById('war-enemy-pct');

  // UI Sync function
  function updateHUD() {
    // Names
    if (playerNameDisplay) playerNameDisplay.textContent = game.player.name.toUpperCase();
    if (enemyNameDisplay) enemyNameDisplay.textContent = game.enemy.name.toUpperCase();

    // Player HP
    const pPct = Math.max(0, (game.player.hp / game.player.maxHp) * 100);
    if (playerHpFill) playerHpFill.style.width = `${pPct}%`;
    if (playerHpText) playerHpText.textContent = `${Math.round(game.player.hp)} / ${game.player.maxHp} HP`;
    if (playerKoBadge) playerKoBadge.textContent = `K.O: ${game.player.koCount}`;

    // Enemy HP
    const ePct = Math.max(0, (game.enemy.hp / game.enemy.maxHp) * 100);
    if (enemyHpFill) enemyHpFill.style.width = `${ePct}%`;
    if (enemyHpText) enemyHpText.textContent = `${Math.round(game.enemy.hp)} / ${game.enemy.maxHp} HP`;
    if (enemyKoBadge) enemyKoBadge.textContent = `K.O: ${game.enemy.koCount}`;

    // Round & Timer
    if (roundText) roundText.textContent = `ROUND ${game.round}`;
    if (roundTimerText) roundTimerText.textContent = `${game.roundTime}`;

    // Avatars
    if (game.player.headConfig.src && playerAvatarPreview && playerAvatarPreview.src !== game.player.headConfig.src) {
      playerAvatarPreview.src = game.player.headConfig.src;
    }
    if (game.enemy.headConfig.src && enemyAvatarPreview && enemyAvatarPreview.src !== game.enemy.headConfig.src) {
      enemyAvatarPreview.src = game.enemy.headConfig.src;
    }

    // Guerra da Live (Tug-of-war balance)
    const totalHp = game.player.hp + game.enemy.hp;
    const playerShare = Math.round((game.player.hp / (totalHp || 1)) * 100);
    const enemyShare = 100 - playerShare;

    if (warPlayerBar) warPlayerBar.style.width = `${playerShare}%`;
    if (warEnemyBar) warEnemyBar.style.width = `${enemyShare}%`;
    if (warPlayerPct) warPlayerPct.textContent = `${playerShare}%`;
    if (warEnemyPct) warEnemyPct.textContent = `${enemyShare}%`;
  }

  game.onUIUpdate = updateHUD;

  // ================= SETTINGS HUB & MODALS CONTROLS =================
  const settingsHubModal = document.getElementById('settings-hub-modal');
  const btnOpenSettingsHub = document.getElementById('btn-open-settings-hub');
  const closeSettingsHubBtn = document.getElementById('close-settings-hub');
  const closeSettingsHubFooter = document.getElementById('close-settings-hub-footer');

  const openSettingsHub = () => {
    if (settingsHubModal) settingsHubModal.classList.add('active');
  };

  const closeSettingsHub = () => {
    if (settingsHubModal) settingsHubModal.classList.remove('active');
  };

  btnOpenSettingsHub?.addEventListener('click', openSettingsHub);
  closeSettingsHubBtn?.addEventListener('click', closeSettingsHub);
  closeSettingsHubFooter?.addEventListener('click', closeSettingsHub);

  // Close modals on overlay backdrop click
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        if (overlay.id === 'face-modal') faceCustomizer.closeModal();
      }
    });
  });

  // Global Keyboard Shortcuts (C for Settings Hub, H for Clean UI, Esc to close modals)
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

    if (e.key === 'c' || e.key === 'C') {
      if (settingsHubModal?.classList.contains('active')) {
        closeSettingsHub();
      } else {
        openSettingsHub();
      }
    } else if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach((m) => m.classList.remove('active'));
      faceCustomizer.closeModal();
    }
  });

  // Hub Feature Cards Navigation
  document.getElementById('hub-open-player-face')?.addEventListener('click', () => {
    closeSettingsHub();
    faceCustomizer.openModal('player');
  });

  document.getElementById('hub-open-enemy-face')?.addEventListener('click', () => {
    closeSettingsHub();
    faceCustomizer.openModal('enemy');
  });

  document.getElementById('hub-open-battle-rules')?.addEventListener('click', () => {
    closeSettingsHub();
    openBattleRulesModal();
  });

  document.getElementById('hub-open-arenas')?.addEventListener('click', () => {
    closeSettingsHub();
    arenaManager.openModal();
  });

  document.getElementById('hub-open-hotkeys')?.addEventListener('click', () => {
    closeSettingsHub();
    hotkeyManager.openModal();
  });



  // Sound Toggle
  let isMuted = false;
  const hubSoundIcon = document.getElementById('hub-sound-icon');
  const hubSoundText = document.getElementById('hub-sound-text');

  const toggleSoundState = () => {
    isMuted = !isMuted;
    audio.setMuted(isMuted);
    if (hubSoundIcon) hubSoundIcon.textContent = isMuted ? '🔇' : '🔊';
    if (hubSoundText) hubSoundText.textContent = isMuted ? 'Mudo' : 'Som Ativado';
    faceCustomizer.showToast(isMuted ? '🔇 Áudio desativado' : '🔊 Áudio ativado');
  };

  document.getElementById('hub-btn-toggle-sound')?.addEventListener('click', toggleSoundState);

  // Aspect Ratio Toggle (9:16 TikTok Studio vs 16:9 PC)
  let isVertical = false;
  const hubAspectText = document.getElementById('hub-aspect-text');

  const toggleAspectRatio = () => {
    isVertical = !isVertical;
    document.body.classList.toggle('aspect-vertical-tiktok', isVertical);
    if (hubAspectText) hubAspectText.textContent = isVertical ? 'Modo 16:9 (PC)' : 'Modo 9:16';
    faceCustomizer.showToast(isVertical ? '📱 Modo Vertical 9:16 (TikTok Live Studio)' : '🖥️ Modo Horizontal 16:9 (PC)');
    setTimeout(() => game.initCanvasSize(), 100);
  };

  document.getElementById('hub-btn-toggle-aspect')?.addEventListener('click', toggleAspectRatio);

  // Reset Match
  const executeResetMatch = () => {
    game.resetMatch(true);
    updateHUD();
    faceCustomizer.showToast('🔄 Nova rodada iniciada!');
  };

  document.getElementById('hub-btn-reset-match')?.addEventListener('click', executeResetMatch);

  // Clean UI Mode
  const floatingShowUI = document.getElementById('floating-show-ui-btn');
  const toggleCleanUI = () => {
    document.body.classList.toggle('clean-stream-mode');
  };

  document.getElementById('hub-btn-toggle-clean-ui')?.addEventListener('click', () => {
    closeSettingsHub();
    toggleCleanUI();
    faceCustomizer.showToast('👁️ Modo Live Limpa ativado. Pressione H ou passe o mouse para reexibir.');
  });
  floatingShowUI?.addEventListener('click', toggleCleanUI);

  // Fullscreen Toggle
  document.getElementById('hub-btn-fullscreen')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => console.warn(err));
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
    }
  });

  // Battle Rules Modal Logic
  const battleRulesModal = document.getElementById('battle-rules-modal');
  const closeBattleRulesBtn = document.getElementById('close-battle-rules-modal');
  const cancelBattleRulesBtn = document.getElementById('cancel-battle-rules-btn');
  const saveBattleRulesBtn = document.getElementById('save-battle-rules-btn');
  const btnRestoreDefaultGifts = document.getElementById('btn-restore-default-gifts');

  const playerNameInput = document.getElementById('player-name-input');
  const playerMaxHpInput = document.getElementById('player-max-hp-input');
  const enemyNameInput = document.getElementById('enemy-name-input');
  const enemyMaxHpInput = document.getElementById('enemy-max-hp-input');
  const giftsTableContainer = document.getElementById('gifts-table-container');

  function renderGiftsTable() {
    if (!giftsTableContainer) return;

    let html = `
      <table class="gifts-table">
        <thead>
          <tr>
            <th>Presente</th>
            <th>Ação / Time</th>
            <th>Golpe</th>
            <th>Dano</th>
            <th>Moedas</th>
          </tr>
        </thead>
        <tbody>
    `;

    tiktokManager.gifts.forEach((g) => {
      html += `
        <tr data-gift-id="${g.id}">
          <td>
            <span style="font-size: 18px; margin-right: 6px;">${g.icon}</span>
            <strong>${g.name}</strong>
          </td>
          <td>
            <select class="target-select ${g.target === 'enemy' ? 'target-enemy' : 'target-player'}" data-field="target">
              <option value="player" ${g.target === 'player' ? 'selected' : ''}>🥊 Streamer Bate (Você)</option>
              <option value="enemy" ${g.target === 'enemy' ? 'selected' : ''}>👹 Inimigo Bate (Boss)</option>
              <option value="heal_player" ${g.target === 'heal_player' ? 'selected' : ''}>💚 Curar Streamer</option>
              <option value="heal_enemy" ${g.target === 'heal_enemy' ? 'selected' : ''}>❤️ Curar Boss</option>
            </select>
          </td>
          <td>
            <select class="target-select" data-field="punchType" style="font-size: 12px;">
              <option value="jab" ${g.punchType === 'jab' ? 'selected' : ''}>Jab Rápido</option>
              <option value="cross" ${g.punchType === 'cross' ? 'selected' : ''}>Direto Pesado</option>
              <option value="hook" ${g.punchType === 'hook' ? 'selected' : ''}>Cruzado</option>
              <option value="uppercut" ${g.punchType === 'uppercut' ? 'selected' : ''}>Mega Uppercut</option>
              <option value="super" ${g.punchType === 'super' ? 'selected' : ''}>Super Combo</option>
            </select>
          </td>
          <td>
            <input type="number" class="gift-row-dmg-input" data-field="damage" value="${g.damage}" min="1" max="10000" />
          </td>
          <td style="color: var(--gold); font-weight: 800;">
            ${g.coins} 🪙
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    giftsTableContainer.innerHTML = html;

    const targetSelects = giftsTableContainer.querySelectorAll('.target-select[data-field="target"]');
    targetSelects.forEach((sel) => {
      sel.addEventListener('change', (e) => {
        sel.className = `target-select ${e.target.value === 'enemy' ? 'target-enemy' : 'target-player'}`;
      });
    });
  }

  function openBattleRulesModal() {
    if (playerNameInput) playerNameInput.value = game.player.name;
    if (playerMaxHpInput) playerMaxHpInput.value = game.player.maxHp;
    if (enemyNameInput) enemyNameInput.value = game.enemy.name;
    if (enemyMaxHpInput) enemyMaxHpInput.value = game.enemy.maxHp;

    renderGiftsTable();
    if (battleRulesModal) battleRulesModal.classList.add('active');
  }

  function closeBattleRulesModal() {
    if (battleRulesModal) battleRulesModal.classList.remove('active');
  }

  closeBattleRulesBtn?.addEventListener('click', closeBattleRulesModal);
  cancelBattleRulesBtn?.addEventListener('click', closeBattleRulesModal);

  // HP Preset Chips
  const hpPresets = document.querySelectorAll('.btn-hp-preset');
  hpPresets.forEach((chip) => {
    chip.addEventListener('click', () => {
      const target = chip.dataset.target;
      const val = chip.dataset.val;
      if (target === 'player' && playerMaxHpInput) playerMaxHpInput.value = val;
      if (target === 'enemy' && enemyMaxHpInput) enemyMaxHpInput.value = val;
    });
  });

  // Restore Default Gifts
  btnRestoreDefaultGifts?.addEventListener('click', () => {
    tiktokManager.restoreDefaults();
    renderGiftsTable();
    faceCustomizer.showToast('🔄 Regras de presentes restauradas para o padrão!');
  });

  // Save Battle Rules
  saveBattleRulesBtn?.addEventListener('click', () => {
    const pName = playerNameInput?.value.trim() || 'STREAMER';
    const eName = enemyNameInput?.value.trim() || 'BOSS FIGHTER';
    const pMaxHp = parseInt(playerMaxHpInput?.value, 10) || 1000;
    const eMaxHp = parseInt(enemyMaxHpInput?.value, 10) || 1000;

    game.setFightersConfig({
      playerName: pName,
      enemyName: eName,
      playerMaxHp: pMaxHp,
      enemyMaxHp: eMaxHp
    });

    const rows = giftsTableContainer.querySelectorAll('tr[data-gift-id]');
    rows.forEach((row) => {
      const giftId = row.dataset.giftId;
      const targetSel = row.querySelector('[data-field="target"]');
      const punchSel = row.querySelector('[data-field="punchType"]');
      const dmgInput = row.querySelector('[data-field="damage"]');

      if (targetSel && punchSel && dmgInput) {
        tiktokManager.updateGiftRule(giftId, {
          target: targetSel.value,
          punchType: punchSel.value,
          damage: parseInt(dmgInput.value, 10) || 20
        });
      }
    });

    tiktokManager.saveSettings();
    tiktokManager.renderGiftButtons();
    updateHUD();

    faceCustomizer.showToast('✅ Regras de Batalha, HP e Presentes salvos com sucesso!');
    closeBattleRulesModal();
  });

  // Modal Closers & Subsystems Handlers
  document.getElementById('close-face-modal')?.addEventListener('click', () => faceCustomizer.closeModal());
  document.getElementById('cancel-face-btn')?.addEventListener('click', () => faceCustomizer.closeModal());
  document.getElementById('save-face-btn')?.addEventListener('click', () => {
    faceCustomizer.applyAndSave();
    updateHUD();
  });

  document.getElementById('close-arena-modal')?.addEventListener('click', () => arenaManager.closeModal());
  document.getElementById('close-arena-footer-btn')?.addEventListener('click', () => arenaManager.closeModal());

  document.getElementById('close-hotkeys-modal')?.addEventListener('click', () => hotkeyManager.closeModal());
  document.getElementById('close-hotkeys-footer-btn')?.addEventListener('click', () => hotkeyManager.closeModal());

  // Webcam buttons
  document.getElementById('btn-start-webcam')?.addEventListener('click', () => faceCustomizer.startWebcam());
  document.getElementById('btn-capture-snapshot')?.addEventListener('click', () => faceCustomizer.captureWebcamSnapshot());

  // Preset face buttons
  document.getElementById('preset-chad-btn')?.addEventListener('click', () => faceCustomizer.loadPreset('chad'));
  document.getElementById('preset-boss-btn')?.addEventListener('click', () => faceCustomizer.loadPreset('boss'));

  // Start the Game
  game.start();
  updateHUD();

  window.addEventListener('click', () => {
    audio.ensureContext();
  }, { once: true });
});
