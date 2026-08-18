// Robust Face Customizer with Instant Canvas Sync, Drag & Drop, Webcam Snapshot and Zero-Latency Head Rendering
export class FaceCustomizer {
  constructor(game) {
    this.game = game;
    this.activeTarget = 'player'; // 'player' or 'enemy'
    this.mediaStream = null;
    this.currentImage = null;

    // Crop / Transform state
    this.state = {
      offsetX: 0,
      offsetY: 0,
      scale: 1.0,
      rotation: 0,
      cropRadius: 85,
      brightness: 100,
      contrast: 100
    };

    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Presets
    this.presets = {
      chad: '/assets/faces/chad.jpg',
      boss: '/assets/faces/boss.jpg'
    };

    this.initDOM();
  }

  initDOM() {
    this.modal = document.getElementById('face-modal');
    this.cropCanvas = document.getElementById('crop-canvas');
    this.cropCtx = this.cropCanvas ? this.cropCanvas.getContext('2d') : null;
    this.videoElem = document.getElementById('webcam-video');
    this.webcamContainer = document.getElementById('webcam-container');
    this.cropContainer = document.getElementById('crop-container');
    this.fileInput = document.getElementById('face-file-input');

    this.bindEvents();
  }

  bindEvents() {
    if (!this.cropCanvas) return;

    // Drag to Pan Image inside Crop Canvas
    this.cropCanvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX - this.state.offsetX;
      this.dragStartY = e.clientY - this.state.offsetY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.state.offsetX = e.clientX - this.dragStartX;
      this.state.offsetY = e.clientY - this.dragStartY;
      this.renderCropPreview();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch support
    this.cropCanvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.dragStartX = e.touches[0].clientX - this.state.offsetX;
        this.dragStartY = e.touches[0].clientY - this.state.offsetY;
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      this.state.offsetX = e.touches[0].clientX - this.dragStartX;
      this.state.offsetY = e.touches[0].clientY - this.dragStartY;
      this.renderCropPreview();
    });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    // Drag & Drop Image File directly onto Crop Canvas or Modal
    ['dragenter', 'dragover'].forEach((evt) => {
      this.modal.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    this.modal.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0 && files[0].type.startsWith('image/')) {
        this.handleImageFile(files[0]);
      }
    });

    // Sliders
    const scaleSlider = document.getElementById('face-zoom-slider');
    const rotSlider = document.getElementById('face-rot-slider');
    const brightSlider = document.getElementById('face-bright-slider');
    const contrastSlider = document.getElementById('face-contrast-slider');

    if (scaleSlider) {
      scaleSlider.addEventListener('input', (e) => {
        this.state.scale = parseFloat(e.target.value);
        this.renderCropPreview();
      });
    }

    if (rotSlider) {
      rotSlider.addEventListener('input', (e) => {
        this.state.rotation = (parseFloat(e.target.value) * Math.PI) / 180;
        this.renderCropPreview();
      });
    }

    if (brightSlider) {
      brightSlider.addEventListener('input', (e) => {
        this.state.brightness = parseInt(e.target.value, 10);
        this.renderCropPreview();
      });
    }

    if (contrastSlider) {
      contrastSlider.addEventListener('input', (e) => {
        this.state.contrast = parseInt(e.target.value, 10);
        this.renderCropPreview();
      });
    }

    // File Input (Reset value on click to allow selecting the same file repeatedly)
    if (this.fileInput) {
      this.fileInput.addEventListener('click', () => {
        this.fileInput.value = '';
      });

      this.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.handleImageFile(file);
        }
      });
    }
  }

  handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.loadImage(ev.target.result);
      this.showToast('📷 Imagem carregada! Ajuste a posição e clique em Aplicar.');
    };
    reader.readAsDataURL(file);
  }

  openModal(target = 'player') {
    this.activeTarget = target;
    const targetTitle = document.getElementById('face-modal-title');
    if (targetTitle) {
      targetTitle.textContent = target === 'player' ? '👤 Personalizar Rosto do Jogador (Você)' : '🥊 Personalizar Rosto do Adversário (Boss)';
    }

    const boxer = target === 'player' ? this.game.player : this.game.enemy;
    this.state = {
      offsetX: 0,
      offsetY: 0,
      scale: 1.0,
      rotation: 0,
      cropRadius: 85,
      brightness: 100,
      contrast: 100
    };

    this.updateSlidersUI();

    if (boxer.headConfig.rawSrc) {
      this.loadImage(boxer.headConfig.rawSrc);
    } else if (boxer.headConfig.src) {
      this.loadImage(boxer.headConfig.src);
    } else {
      this.loadImage(target === 'player' ? this.presets.chad : this.presets.boss);
    }

    this.stopWebcam();
    this.showCropView();
    this.modal.classList.add('active');
  }

  closeModal() {
    this.stopWebcam();
    this.modal.classList.remove('active');
  }

  updateSlidersUI() {
    const scaleSlider = document.getElementById('face-zoom-slider');
    const rotSlider = document.getElementById('face-rot-slider');
    const brightSlider = document.getElementById('face-bright-slider');
    const contrastSlider = document.getElementById('face-contrast-slider');

    if (scaleSlider) scaleSlider.value = this.state.scale;
    if (rotSlider) rotSlider.value = (this.state.rotation * 180) / Math.PI;
    if (brightSlider) brightSlider.value = this.state.brightness;
    if (contrastSlider) contrastSlider.value = this.state.contrast;
  }

  showCropView() {
    if (this.cropContainer) this.cropContainer.style.display = 'flex';
    if (this.webcamContainer) this.webcamContainer.style.display = 'none';
  }

  showWebcamView() {
    if (this.cropContainer) this.cropContainer.style.display = 'none';
    if (this.webcamContainer) this.webcamContainer.style.display = 'flex';
  }

  loadImage(src) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.currentImage = img;
      this.showCropView();
      this.renderCropPreview();
    };
    img.src = src;
  }

  loadPreset(presetKey) {
    if (this.presets[presetKey]) {
      this.state.offsetX = 0;
      this.state.offsetY = 0;
      this.state.scale = 1.0;
      this.state.rotation = 0;
      this.state.brightness = 100;
      this.state.contrast = 100;
      this.updateSlidersUI();
      this.loadImage(this.presets[presetKey]);
      this.showToast(`👑 Rosto preset "${presetKey.toUpperCase()}" selecionado!`);
    }
  }

  // Webcam Capture Functions
  async startWebcam() {
    this.showWebcamView();
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      if (this.videoElem) {
        this.videoElem.srcObject = this.mediaStream;
        this.videoElem.play();
      }
    } catch (err) {
      alert('Não foi possível acessar a câmera: ' + err.message);
      this.showCropView();
    }
  }

  stopWebcam() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  captureWebcamSnapshot() {
    if (!this.videoElem) return;

    const canvas = document.createElement('canvas');
    canvas.width = this.videoElem.videoWidth || 640;
    canvas.height = this.videoElem.videoHeight || 480;
    const ctx = canvas.getContext('2d');

    // Mirror image for natural selfie feel
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.videoElem, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/png');
    this.stopWebcam();
    this.loadImage(dataUrl);
    this.showToast('📸 Foto tirada com sucesso! Ajuste o enquadramento e aplique.');
  }

  renderCropPreview() {
    if (!this.cropCtx || !this.cropCanvas) return;

    const ctx = this.cropCtx;
    const w = this.cropCanvas.width;
    const h = this.cropCanvas.height;
    const centerX = w / 2;
    const centerY = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#141824';
    ctx.fillRect(0, 0, w, h);

    // Draw user image with transformations
    if (this.currentImage && this.currentImage.complete) {
      ctx.save();
      ctx.filter = `brightness(${this.state.brightness}%) contrast(${this.state.contrast}%)`;
      ctx.translate(centerX + this.state.offsetX, centerY + this.state.offsetY);
      ctx.rotate(this.state.rotation);

      const imgW = this.currentImage.naturalWidth || 300;
      const imgH = this.currentImage.naturalHeight || 300;
      const baseScale = (180 / Math.min(imgW, imgH)) * this.state.scale;

      ctx.scale(baseScale, baseScale);
      ctx.drawImage(this.currentImage, -imgW / 2, -imgH / 2, imgW, imgH);
      ctx.restore();
    }

    // Draw Oval Head Mask Overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.ellipse(centerX, centerY, 85, 100, 0, 0, Math.PI * 2, true);
    ctx.fill();

    // Glowing Neon Guide Line
    ctx.strokeStyle = this.activeTarget === 'player' ? '#00e5ff' : '#ff0055';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 85, 100, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Center Crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(centerX - 15, centerY);
    ctx.lineTo(centerX + 15, centerY);
    ctx.moveTo(centerX, centerY - 15);
    ctx.lineTo(centerX, centerY + 15);
    ctx.stroke();

    ctx.restore();
  }

  // Generate exact cropped canvas element
  createCroppedCanvas() {
    if (!this.currentImage || !this.currentImage.complete) return null;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = 320;
    outCanvas.height = 360;
    const outCtx = outCanvas.getContext('2d');

    const centerX = outCanvas.width / 2;
    const centerY = outCanvas.height / 2;

    outCtx.save();
    // Clip with exact oval
    outCtx.beginPath();
    outCtx.ellipse(centerX, centerY, 85, 100, 0, 0, Math.PI * 2);
    outCtx.clip();

    outCtx.filter = `brightness(${this.state.brightness}%) contrast(${this.state.contrast}%)`;

    outCtx.translate(centerX + this.state.offsetX, centerY + this.state.offsetY);
    outCtx.rotate(this.state.rotation);

    const imgW = this.currentImage.naturalWidth || 300;
    const imgH = this.currentImage.naturalHeight || 300;
    const baseScale = (180 / Math.min(imgW, imgH)) * this.state.scale;

    outCtx.scale(baseScale, baseScale);
    outCtx.drawImage(this.currentImage, -imgW / 2, -imgH / 2, imgW, imgH);
    outCtx.restore();

    return outCanvas;
  }

  applyAndSave() {
    if (!this.currentImage) {
      this.closeModal();
      return;
    }

    const croppedCanvas = this.createCroppedCanvas();
    if (!croppedCanvas) {
      this.closeModal();
      return;
    }

    const croppedDataUrl = croppedCanvas.toDataURL('image/png', 0.9);
    const boxer = this.activeTarget === 'player' ? this.game.player : this.game.enemy;

    // Set cropped image directly on boxer with zero latency
    boxer.headImage = croppedCanvas;
    boxer.headConfig.src = croppedDataUrl;
    boxer.headConfig.rawSrc = this.currentImage.src;

    // Update Top Avatar preview immediately
    const avatarElem = document.getElementById(this.activeTarget === 'player' ? 'player-avatar-preview' : 'enemy-avatar-preview');
    if (avatarElem) {
      avatarElem.src = croppedDataUrl;
    }

    // Save to localStorage safely
    try {
      localStorage.setItem(`punch_boxing_${this.activeTarget}_head_url`, croppedDataUrl);
    } catch (e) {
      console.warn('LocalStorage quota warning', e);
    }

    this.showToast(`✅ Rosto do ${this.activeTarget === 'player' ? 'Jogador' : 'Adversário'} aplicado com sucesso!`);
    this.closeModal();

    if (this.game.onUIUpdate) {
      this.game.onUIUpdate();
    }
  }

  loadSavedProfiles() {
    try {
      const savedPlayerUrl = localStorage.getItem('punch_boxing_player_head_url');
      if (savedPlayerUrl) {
        this.game.player.setHeadConfig({ src: savedPlayerUrl });
      }

      const savedEnemyUrl = localStorage.getItem('punch_boxing_enemy_head_url');
      if (savedEnemyUrl) {
        this.game.enemy.setHeadConfig({ src: savedEnemyUrl });
      }
    } catch (e) {
      console.warn('Error loading saved profiles', e);
    }
  }

  showToast(message) {
    let toast = document.getElementById('game-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'game-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'game-toast show';
    setTimeout(() => {
      toast.className = 'game-toast';
    }, 3000);
  }
}
