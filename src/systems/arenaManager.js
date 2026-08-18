// Arena & Ring Manager with background themes, custom upload and Chroma Key OBS modes
export class ArenaManager {
  constructor(game) {
    this.game = game;
    this.modal = null;
    this.currentTheme = 'championship';

    this.initDOM();
    this.loadSavedSettings();
  }

  initDOM() {
    this.modal = document.getElementById('arena-modal');
    this.customBgInput = document.getElementById('arena-file-input');
    this.ringTextInput = document.getElementById('ring-text-input');

    if (this.customBgInput) {
      this.customBgInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            this.setCustomBackground(ev.target.result);
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (this.ringTextInput) {
      this.ringTextInput.addEventListener('input', (e) => {
        const val = e.target.value.trim() || '🥊 PUNCH FACE LIVE 🥊';
        this.game.ringMatText = val;
        this.saveSettings();
      });
    }

    // Bind arena preset cards
    const cards = document.querySelectorAll('.arena-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const theme = card.dataset.theme;
        this.selectTheme(theme);
      });
    });
  }

  selectTheme(theme) {
    this.currentTheme = theme;
    this.game.setArena(theme);

    // Update active UI cards
    const cards = document.querySelectorAll('.arena-card');
    cards.forEach((c) => {
      c.classList.toggle('selected', c.dataset.theme === theme);
    });

    this.saveSettings();
  }

  setCustomBackground(dataUrl) {
    this.currentTheme = 'custom';
    this.game.setArena('custom', dataUrl);

    const cards = document.querySelectorAll('.arena-card');
    cards.forEach((c) => c.classList.remove('selected'));

    this.saveSettings(dataUrl);
  }

  openModal() {
    if (this.ringTextInput) {
      this.ringTextInput.value = this.game.ringMatText;
    }
    if (this.modal) this.modal.classList.add('active');
  }

  closeModal() {
    if (this.modal) this.modal.classList.remove('active');
  }

  saveSettings(customBg = null) {
    try {
      const data = {
        theme: this.currentTheme,
        ringText: this.game.ringMatText,
        customBg: customBg || (this.currentTheme === 'custom' ? this.game.arenaImages.custom?.src : null)
      };
      localStorage.setItem('punch_boxing_arena_settings', JSON.stringify(data));
    } catch (e) {
      console.warn('Error saving arena settings', e);
    }
  }

  loadSavedSettings() {
    try {
      const saved = localStorage.getItem('punch_boxing_arena_settings');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.theme) {
          if (data.theme === 'custom' && data.customBg) {
            this.setCustomBackground(data.customBg);
          } else {
            this.selectTheme(data.theme);
          }
        }
        if (data.ringText) {
          this.game.ringMatText = data.ringText;
        }
      }
    } catch (e) {
      console.warn('Error loading arena settings', e);
    }
  }
}
