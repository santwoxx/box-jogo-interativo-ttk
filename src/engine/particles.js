// High performance particle system with limits, pooling and combo number consolidation
export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.damageTexts = [];
    this.confetti = [];

    this.maxParticles = 120;
    this.maxDamageTexts = 12;
    this.maxConfetti = 90;
  }

  // Spawn sweat droplets when punched
  spawnSweat(x, y, dirX, count = 10, power = 1) {
    if (this.particles.length > this.maxParticles) return;
    const spawnCount = Math.min(count, this.maxParticles - this.particles.length);

    for (let i = 0; i < spawnCount; i++) {
      const angle = (dirX > 0 ? -0.3 : Math.PI + 0.3) + (Math.random() - 0.5) * 1.2;
      const speed = (Math.random() * 7 + 3.5) * power;
      this.particles.push({
        type: 'sweat',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 3.5,
        size: Math.random() * 3 + 2,
        alpha: 1,
        color: 'rgba(210, 240, 255, ',
        gravity: 0.35,
        life: 1,
        decay: Math.random() * 0.035 + 0.025
      });
    }
  }

  // Spawn impact comic sparks / flash burst
  spawnImpactSparks(x, y, isCrit = false) {
    if (this.particles.length > this.maxParticles) return;
    const count = isCrit ? 16 : 8;
    const colors = isCrit
      ? ['#ff0055', '#ffcc00', '#ffffff', '#ff5500']
      : ['#ffdd00', '#ffffff', '#ff9900'];

    const spawnCount = Math.min(count, this.maxParticles - this.particles.length);

    for (let i = 0; i < spawnCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (isCrit ? 12 : 7) + 3;
      this.particles.push({
        type: 'spark',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * (isCrit ? 4.5 : 3) + 2,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 0.15,
        life: 1,
        decay: Math.random() * 0.05 + 0.04
      });
    }

    // Impact ring
    if (this.particles.length < this.maxParticles) {
      this.particles.push({
        type: 'shockwave',
        x,
        y,
        radius: 4,
        maxRadius: isCrit ? 80 : 45,
        lineWidth: isCrit ? 5 : 3.5,
        alpha: 1,
        color: isCrit ? '#ff0055' : '#ffea00',
        decay: 0.07
      });
    }
  }

  // Spawn 3D floating damage number with consolidation
  spawnDamageText(x, y, amount, type = 'normal') {
    // If too many damage texts are active, remove oldest to prevent clutter
    if (this.damageTexts.length >= this.maxDamageTexts) {
      this.damageTexts.shift();
    }

    let text = `-${amount}`;
    let color = '#ffffff';
    let strokeColor = '#000000';
    let scale = 1.15;
    let subtitle = '';

    if (type === 'crit') {
      color = '#ffdd00';
      strokeColor = '#b30000';
      scale = 1.6;
      subtitle = 'CRÍTICO!';
    } else if (type === 'super') {
      color = '#ff0055';
      strokeColor = '#500000';
      scale = 2.2;
      subtitle = '💥 MEGA KO!';
    } else if (type === 'heal') {
      text = `+${amount} HP`;
      color = '#00ff88';
      strokeColor = '#004d20';
      scale = 1.3;
    } else if (type === 'combo') {
      color = '#ff9900';
      strokeColor = '#4a0000';
      scale = 1.5;
      subtitle = 'COMBO STREAK!';
    }

    this.damageTexts.push({
      x: x + (Math.random() - 0.5) * 26,
      y: y + (Math.random() - 0.5) * 16,
      text,
      subtitle,
      color,
      strokeColor,
      scale,
      targetScale: 0.95,
      alpha: 1,
      vy: -3.2,
      life: 1,
      decay: 0.024
    });
  }

  // Spawn Victory Confetti
  spawnConfetti(width, height, count = 70) {
    const colors = ['#ff0055', '#00e5ff', '#ffea00', '#00ff66', '#ff00ff', '#ffffff'];
    const spawnCount = Math.min(count, this.maxConfetti);
    for (let i = 0; i < spawnCount; i++) {
      this.confetti.push({
        x: Math.random() * width,
        y: -20 - Math.random() * 150,
        vx: (Math.random() - 0.5) * 5,
        vy: Math.random() * 4 + 2.5,
        size: Math.random() * 7 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.18,
        life: 1,
        decay: 0.003
      });
    }
  }

  update(dt = 1) {
    // Update regular particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.type === 'shockwave') {
        p.radius += (p.maxRadius - p.radius) * 0.22 * dt;
        p.alpha -= p.decay * dt;
        if (p.alpha <= 0 || p.radius >= p.maxRadius - 2) {
          this.particles.splice(i, 1);
        }
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.gravity || 0.2) * dt;
        p.alpha -= p.decay * dt;
        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    // Update floating damage texts
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const dtText = this.damageTexts[i];
      dtText.y += dtText.vy * dt;
      dtText.vy *= 0.94;
      dtText.scale += (dtText.targetScale - dtText.scale) * 0.18 * dt;
      dtText.alpha -= dtText.decay * dt;
      if (dtText.alpha <= 0) {
        this.damageTexts.splice(i, 1);
      }
    }

    // Update confetti
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rotation += c.rotSpeed * dt;
      c.alpha -= c.decay * dt;
      if (c.alpha <= 0 || c.y > 1080) {
        this.confetti.splice(i, 1);
      }
    }
  }

  render(ctx) {
    ctx.save();

    // Render particles
    for (const p of this.particles) {
      if (p.type === 'shockwave') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.lineWidth = p.lineWidth;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'sweat') {
        ctx.fillStyle = `${p.color}${Math.max(0, p.alpha)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }

    // Render damage numbers
    for (const dt of this.damageTexts) {
      ctx.save();
      ctx.translate(dt.x, dt.y);
      ctx.scale(dt.scale, dt.scale);
      ctx.globalAlpha = Math.max(0, dt.alpha);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Number outline
      ctx.font = '900 26px "Impact", "Arial Black", sans-serif';
      ctx.strokeStyle = dt.strokeColor;
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.strokeText(dt.text, 0, 0);

      // Number fill
      ctx.fillStyle = dt.color;
      ctx.fillText(dt.text, 0, 0);

      if (dt.subtitle) {
        ctx.font = '800 15px "Impact", "Arial Black", sans-serif';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3.5;
        ctx.strokeText(dt.subtitle, 0, -24);
        ctx.fillStyle = dt.color;
        ctx.fillText(dt.subtitle, 0, -24);
      }

      ctx.restore();
    }

    // Render Confetti
    for (const c of this.confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      ctx.globalAlpha = Math.max(0, c.alpha);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
      ctx.restore();
    }

    ctx.restore();
  }

  clear() {
    this.particles = [];
    this.damageTexts = [];
    this.confetti = [];
  }
}
