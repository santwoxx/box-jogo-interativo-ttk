// Hotkey Manager for customizable keyboard shortcuts and external stream triggers (TikFinity / Streamer.bot)
export class HotkeyManager {
  constructor(game) {
    this.game = game;

    // Default key mappings
    this.keyMap = {
      'Digit1': { action: 'PLAYER_JAB', label: 'Soco Rápido (Jab)', category: 'player' },
      'Digit2': { action: 'PLAYER_CROSS', label: 'Direto Pesado (Cross)', category: 'player' },
      'Digit3': { action: 'PLAYER_HOOK', label: 'Cruzado Potente (Hook)', category: 'player' },
      'Digit4': { action: 'PLAYER_UPPERCUT', label: 'Mega Gancho (Uppercut KO)', category: 'player' },
      'Digit5': { action: 'ENEMY_PUNCH', label: 'Golpe do Inimigo (Contra-Ataque)', category: 'enemy' },
      'Digit6': { action: 'PLAYER_HEAL', label: 'Curar Jogador (+100 HP)', category: 'system' },
      'KeyR': { action: 'RESET_MATCH', label: 'Próximo Round / Reiniciar', category: 'system' },
      'KeyH': { action: 'TOGGLE_UI', label: 'Ocultar / Exibir Painel (Modo Live Limpa)', category: 'system' }
    };

    this.listeningKeySlot = null; // When user is rebinding a key
    this.initDOM();
    this.bindGlobalKeys();
    this.exposeGlobalAPI();
    this.loadSavedKeymap();
  }

  initDOM() {
    this.modal = document.getElementById('hotkeys-modal');
  }

  bindGlobalKeys() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      // If in key binding mode inside modal
      if (this.listeningKeySlot) {
        e.preventDefault();
        this.assignKey(this.listeningKeySlot, e.code, e.key);
        return;
      }

      const mapping = this.keyMap[e.code];
      if (mapping) {
        e.preventDefault();
        this.executeAction(mapping.action);
      }
    });
  }

  executeAction(actionName, payload = {}) {
    switch (actionName) {
      case 'PLAYER_JAB':
        this.game.playerAttack('jab', payload.damage, payload.gifter);
        break;
      case 'PLAYER_CROSS':
        this.game.playerAttack('cross', payload.damage, payload.gifter);
        break;
      case 'PLAYER_HOOK':
        this.game.playerAttack('hook', payload.damage, payload.gifter);
        break;
      case 'PLAYER_UPPERCUT':
        this.game.playerAttack('uppercut', payload.damage, payload.gifter);
        break;
      case 'PLAYER_SUPER':
        this.game.playerAttack('super', payload.damage, payload.gifter);
        break;
      case 'ENEMY_PUNCH':
        this.game.enemyAttack(payload.type || 'cross', payload.damage);
        break;
      case 'PLAYER_HEAL':
        this.game.healPlayer(payload.amount || 100);
        break;
      case 'RESET_MATCH':
        this.game.resetMatch(true);
        break;
      case 'TOGGLE_UI':
        document.body.classList.toggle('clean-stream-mode');
        break;
    }
  }

  exposeGlobalAPI() {
    // Expose global window object for external scripts / browser extensions / TikFinity webhooks
    window.PunchFaceLive = {
      trigger: (actionName, payload) => this.executeAction(actionName, payload),
      playerJab: (gifter) => this.executeAction('PLAYER_JAB', { gifter }),
      playerCross: (gifter) => this.executeAction('PLAYER_CROSS', { gifter }),
      playerHook: (gifter) => this.executeAction('PLAYER_HOOK', { gifter }),
      playerUppercut: (gifter) => this.executeAction('PLAYER_UPPERCUT', { gifter }),
      playerSuper: (gifter) => this.executeAction('PLAYER_SUPER', { gifter }),
      enemyAttack: () => this.executeAction('ENEMY_PUNCH'),
      heal: (amount) => this.executeAction('PLAYER_HEAL', { amount }),
      reset: () => this.executeAction('RESET_MATCH')
    };
  }

  openModal() {
    this.renderKeyList();
    if (this.modal) this.modal.classList.add('active');
  }

  closeModal() {
    this.listeningKeySlot = null;
    if (this.modal) this.modal.classList.remove('active');
  }

  renderKeyList() {
    const listContainer = document.getElementById('hotkeys-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const actions = [
      { id: 'PLAYER_JAB', label: '🥊 Soco Rápido (Jab)', desc: 'Dano leve (15) - Ideal para Rosas (1 Moeda)' },
      { id: 'PLAYER_CROSS', label: '💥 Direto Pesado (Cross)', desc: 'Dano médio (35) - Para presentes de 10-30 Moedas' },
      { id: 'PLAYER_HOOK', label: '⚡ Cruzado Potente (Hook)', desc: 'Dano alto (65) - Para presentes de 50-100 Moedas' },
      { id: 'PLAYER_UPPERCUT', label: '🔥 Mega Gancho (Uppercut KO)', desc: 'Dano crítico (120+) - Para presentes grandes' },
      { id: 'ENEMY_PUNCH', label: '👹 Golpe do Inimigo', desc: 'Boss ataca o streamer de volta' },
      { id: 'PLAYER_HEAL', label: '💚 Curar Jogador (+100 HP)', desc: 'Regenera a vida do streamer' },
      { id: 'RESET_MATCH', label: '🔄 Reiniciar / Próximo Round', desc: 'Inicia uma nova rodada' },
      { id: 'TOGGLE_UI', label: '👁️ Ocultar / Exibir Painel', desc: 'Ativa tela limpa para OBS / TikTok Studio' }
    ];

    actions.forEach((act) => {
      // Find current key bound to this action
      let currentCode = Object.keys(this.keyMap).find((k) => this.keyMap[k].action === act.id) || 'NENHUMA';
      let readableKey = currentCode.replace('Digit', '').replace('Key', '');

      const row = document.createElement('div');
      row.className = 'hotkey-row';
      row.innerHTML = `
        <div class="hotkey-info">
          <strong>${act.label}</strong>
          <span>${act.desc}</span>
        </div>
        <button class="key-bind-btn ${this.listeningKeySlot === act.id ? 'listening' : ''}" data-action="${act.id}">
          ${this.listeningKeySlot === act.id ? 'Pressione a tecla...' : readableKey}
        </button>
      `;

      const btn = row.querySelector('.key-bind-btn');
      btn.addEventListener('click', () => {
        this.listeningKeySlot = act.id;
        this.renderKeyList();
      });

      listContainer.appendChild(row);
    });
  }

  assignKey(actionId, code, keyName) {
    // Remove old bindings with this key or action
    Object.keys(this.keyMap).forEach((k) => {
      if (this.keyMap[k].action === actionId || k === code) {
        delete this.keyMap[k];
      }
    });

    this.keyMap[code] = {
      action: actionId,
      label: keyName.toUpperCase(),
      category: 'custom'
    };

    this.listeningKeySlot = null;
    this.saveKeymap();
    this.renderKeyList();
  }

  saveKeymap() {
    try {
      localStorage.setItem('punch_boxing_hotkeys', JSON.stringify(this.keyMap));
    } catch (e) {
      console.warn('Error saving hotkeys', e);
    }
  }

  loadSavedKeymap() {
    try {
      const saved = localStorage.getItem('punch_boxing_hotkeys');
      if (saved) {
        this.keyMap = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error loading hotkeys', e);
    }
  }
}
