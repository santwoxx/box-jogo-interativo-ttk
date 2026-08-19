// Boxer character engine with high-definition muscular anatomy, dynamic lighting, professional glove textures and custom head overlay
export class Boxer {
  constructor(config = {}) {
    this.id = config.id || 'boxer_1';
    this.name = config.name || 'Streamer';
    this.isPlayer = config.isPlayer !== undefined ? config.isPlayer : true;
    this.facing = this.isPlayer ? 1 : -1;

    // Position in arena
    this.baseX = config.baseX || (this.isPlayer ? 420 : 860);
    this.baseY = config.baseY || 520;
    this.x = this.baseX;
    this.y = this.baseY;

    // Combat Stats
    this.maxHp = config.maxHp || 1000;
    this.hp = this.maxHp;
    this.stamina = 100;
    this.rage = 0;
    this.koCount = 0;
    this.score = 0;

    // Visual Themes
    this.gloveColor = config.gloveColor || (this.isPlayer ? '#00d2ff' : '#ff0055');
    this.gloveDark = config.gloveDark || (this.isPlayer ? '#0077b6' : '#990033');
    this.trunksColor = config.trunksColor || (this.isPlayer ? '#101738' : '#7f092b');
    this.trunksTrim = config.trunksTrim || (this.isPlayer ? '#00e5ff' : '#ffea00');
    this.skinTone = config.skinTone || (this.isPlayer ? '#f2b58e' : '#d89168');
    this.skinShadow = config.skinShadow || (this.isPlayer ? '#c27e57' : '#a25934');
    this.skinHighlight = config.skinHighlight || (this.isPlayer ? '#ffd2b3' : '#eeb390');

    // Head Customization
    this.headImage = null;
    this.headConfig = {
      src: config.headSrc || null,
      rawSrc: config.rawSrc || null,
      offsetX: config.headOffsetX || 0,
      offsetY: config.headOffsetY || 0,
      scale: config.headScale || 1.0,
      rotation: config.headRotation || 0,
      cropRadius: config.cropRadius || 65,
      brightness: config.brightness || 100,
      contrast: config.contrast || 100
    };

    if (config.headSrc) {
      this.loadHeadImage(config.headSrc);
    }

    // Animation & State
    this.state = 'IDLE'; // IDLE, ATTACKING, HIT, DIZZY, KO, VICTORY
    this.stateTimer = 0;
    this.animTime = Math.random() * 10;
    this.currentAttack = null;
    this.attackProgress = 0;

    // Head Physics
    this.headRecoilX = 0;
    this.headRecoilY = 0;
    this.headRecoilRot = 0;
    this.headVelocityX = 0;
    this.headVelocityY = 0;
    this.headVelocityRot = 0;
    this.squishX = 1;
    this.squishY = 1;

    // Hit Flash
    this.hitFlashTimer = 0;
    this.dizzyStars = [];
    this.initDizzyStars();

    this.scale = config.scale || 1.18;
  }

  loadHeadImage(src) {
    if (!src) {
      this.headImage = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.headImage = img;
    };
    img.src = src;
  }

  setHeadConfig(newConfig) {
    const oldSrc = this.headConfig.src;
    this.headConfig = { ...this.headConfig, ...newConfig };
    if (newConfig.src && (newConfig.src !== oldSrc || !this.headImage)) {
      this.loadHeadImage(newConfig.src);
    }
  }

  initDizzyStars() {
    this.dizzyStars = [];
    for (let i = 0; i < 4; i++) {
      this.dizzyStars.push({
        angle: (i * Math.PI * 2) / 4,
        speed: 4.0,
        radiusX: 62,
        radiusY: 22,
        size: 11
      });
    }
  }

  attack(type = 'jab') {
    if (this.state === 'KO' || this.state === 'DIZZY') return false;

    this.state = 'ATTACKING';
    this.currentAttack = type;
    this.attackProgress = 0;
    this.stateTimer = 0;
    return true;
  }

  takeHit(damage, punchType = 'jab', isCrit = false) {
    if (this.state === 'KO') return;

    this.hp = Math.max(0, this.hp - damage);
    this.hitFlashTimer = 0.16;

    const hitDirection = -this.facing;
    const forceMultiplier = isCrit ? 1.8 : (punchType === 'super' ? 2.2 : (punchType === 'uppercut' ? 1.5 : (punchType === 'hook' ? 1.2 : 0.85)));

    this.headVelocityX = hitDirection * (20 + Math.random() * 8) * forceMultiplier;
    this.headVelocityY = (punchType === 'uppercut' || punchType === 'super' ? -30 : (Math.random() - 0.5) * 12) * forceMultiplier;
    this.headVelocityRot = hitDirection * (0.35 + Math.random() * 0.2) * forceMultiplier;

    this.squishX = 1.35 * forceMultiplier;
    this.squishY = 0.72 / forceMultiplier;

    if (this.hp <= 0) {
      this.triggerKO();
    } else {
      this.state = 'HIT';
      this.stateTimer = 0.2;
    }
  }

  heal(amount) {
    if (this.state === 'KO') return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  triggerKO() {
    this.state = 'KO';
    this.stateTimer = 0;
    this.koCount++;
    this.headVelocityX = -this.facing * 32;
    this.headVelocityY = -24;
    this.headVelocityRot = -this.facing * 0.85;
  }

  reset(fullHeal = true) {
    if (fullHeal) this.hp = this.maxHp;
    this.state = 'IDLE';
    this.stateTimer = 0;
    this.attackProgress = 0;
    this.currentAttack = null;
    this.x = this.baseX;
    this.y = this.baseY;
    this.headRecoilX = 0;
    this.headRecoilY = 0;
    this.headRecoilRot = 0;
    this.squishX = 1;
    this.squishY = 1;
  }

  update(dt = 0.016) {
    this.animTime += dt * 4.2;

    // Spring Physics (head recoil). Integrated in fixed-size substeps: this
    // step-doubling formula is only numerically stable for small dt, and a
    // dropped/lagged frame (easy to get right on hit impact, since a punch
    // also fires audio + particles + a freeze-frame in the same tick) can
    // otherwise make the head recoil explode into visible jitter for a
    // couple frames. Substepping keeps every step small regardless of the
    // real frame time, without changing the motion at a normal framerate.
    const springK = 38;
    const damping = 0.82;
    const maxSubDt = 1 / 60;
    let remaining = dt;

    while (remaining > 0) {
      const step = Math.min(maxSubDt, remaining);
      remaining -= step;

      const forceX = -springK * this.headRecoilX;
      const forceY = -springK * this.headRecoilY;
      const forceRot = -springK * this.headRecoilRot;

      this.headVelocityX = (this.headVelocityX + forceX * step) * damping;
      this.headVelocityY = (this.headVelocityY + forceY * step) * damping;
      this.headVelocityRot = (this.headVelocityRot + forceRot * step) * damping;

      this.headRecoilX += this.headVelocityX * step * 60;
      this.headRecoilY += this.headVelocityY * step * 60;
      this.headRecoilRot += this.headVelocityRot * step * 60;
    }

    this.squishX += (1.0 - this.squishX) * 0.18;
    this.squishY += (1.0 - this.squishY) * 0.18;

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }

    if (this.state === 'ATTACKING') {
      const attackSpeed = this.currentAttack === 'super' ? 3.5 : (this.currentAttack === 'uppercut' ? 4.2 : 7.0);
      this.attackProgress += dt * attackSpeed;

      if (this.attackProgress >= 1.0) {
        this.state = 'IDLE';
        this.attackProgress = 0;
        this.currentAttack = null;
      }
    } else if (this.state === 'HIT') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'IDLE';
      }
    } else if (this.state === 'KO') {
      this.stateTimer += dt;
      if (this.stateTimer < 1.3) {
        this.y += 190 * dt;
        this.x -= this.facing * 50 * dt;
      }
    }

    if (this.state === 'KO' || this.hp < this.maxHp * 0.3) {
      for (const star of this.dizzyStars) {
        star.angle += star.speed * dt;
      }
    }
  }

  render(ctx) {
    if (!this._gradientsReady) {
      this.buildGradients(ctx);
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // Idle rhythmic breathing and boxing stance bobbing
    const idleBobY = this.state === 'IDLE' ? Math.sin(this.animTime) * 6 : (this.state === 'HIT' ? 10 : 0);
    const idleBobRot = this.state === 'IDLE' ? Math.cos(this.animTime * 0.5) * 0.025 : (this.state === 'HIT' ? -this.facing * 0.06 : 0);

    ctx.translate(0, idleBobY);
    ctx.rotate(idleBobRot);
    ctx.scale(this.scale, this.scale);

    // Realistic Ground Shadow
    this.renderShadow(ctx);

    // Muscular Layered Body
    this.renderLegsAndBoots(ctx);
    this.renderTrunks(ctx);
    this.renderTorso(ctx);
    this.renderBackArm(ctx);
    this.renderHead(ctx);
    this.renderFrontArm(ctx);

    // Hit Flash
    if (this.hitFlashTimer > 0) {
      this.renderHitFlash(ctx);
    }

    // Dizzy Stars
    if (this.state === 'KO' || this.hp < this.maxHp * 0.3) {
      this.renderDizzyStars(ctx);
    }

    ctx.restore();
  }

  renderShadow(ctx) {
    ctx.save();
    ctx.fillStyle = this._shadowGrad;
    ctx.beginPath();
    ctx.ellipse(0, 115, 100, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawMuscularLeg(ctx, x, y, w, h, isFront, gradient) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(-w / 2, 0, w, h, [10, 10, 8, 8]);
    ctx.fill();

    // Calf muscle curve
    ctx.fillStyle = this.skinHighlight;
    ctx.beginPath();
    ctx.ellipse(isFront ? this.facing * 3 : -this.facing * 3, h * 0.45, 4, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawBoot(ctx, bx, by, bw, bh) {
    ctx.save();
    ctx.translate(bx, by);

    ctx.fillStyle = this._bootGrad;
    ctx.beginPath();
    ctx.roundRect(-bw / 2, 0, bw, bh, [6, 6, 8, 8]);
    ctx.fill();

    // Golden sole
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(-bw / 2 - 2, bh - 6, bw + 4, 6);

    // White boot laces
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let i = 4; i < bh - 8; i += 5) {
      ctx.beginPath();
      ctx.moveTo(-bw * 0.28, i);
      ctx.lineTo(bw * 0.28, i);
      ctx.stroke();
    }

    ctx.restore();
  }

  renderLegsAndBoots(ctx) {
    ctx.save();
    const dir = this.facing;

    // Back leg
    this.drawMuscularLeg(ctx, -dir * 26, 32, 28, 70, false, this._backLegGrad);
    // Front leg
    this.drawMuscularLeg(ctx, dir * 18, 25, 30, 75, true, this._frontLegGrad);

    // High Top Boxing Boots
    this.drawBoot(ctx, -dir * 28, 92, 38, 24);
    this.drawBoot(ctx, dir * 20, 92, 40, 24);

    ctx.restore();
  }

  renderTrunks(ctx) {
    ctx.save();

    // Satin Boxing Shorts with depth
    ctx.fillStyle = this._trunksGrad;
    ctx.beginPath();
    ctx.moveTo(-54, -6);
    ctx.lineTo(54, -6);
    ctx.lineTo(48, 50);
    ctx.lineTo(3, 44);
    ctx.lineTo(-48, 50);
    ctx.closePath();
    ctx.fill();

    // Satin Fabric Folds Shading
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(-14, 46);
    ctx.lineTo(-6, 45);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(16, 45);
    ctx.lineTo(24, 46);
    ctx.lineTo(20, 0);
    ctx.closePath();
    ctx.fill();

    // Metallic Gold Championship Belt
    ctx.fillStyle = this._beltGrad;
    ctx.beginPath();
    ctx.roundRect(-56, -14, 112, 20, 6);
    ctx.fill();

    // Championship Center Plate Emblem
    ctx.fillStyle = '#111420';
    ctx.beginPath();
    ctx.arc(0, -4, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffea00';
    ctx.font = '900 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👑', 0, -3);

    // Glowing Side Trim Stripes
    ctx.fillStyle = this.trunksTrim;
    ctx.fillRect(-52, 6, 8, 42);
    ctx.fillRect(44, 6, 8, 42);

    ctx.restore();
  }

  drawPec(ctx, px, py, pw, ph) {
    ctx.fillStyle = this.skinShadow;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, [10, 10, 14, 14]);
    ctx.fill();

    ctx.fillStyle = this.skinHighlight;
    ctx.beginPath();
    ctx.ellipse(px + pw * 0.45, py + ph * 0.35, pw * 0.35, ph * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawAbsRow(ctx, ay, ah) {
    ctx.fillStyle = this.skinShadow;
    ctx.beginPath();
    ctx.roundRect(-22, ay, 20, ah, 4);
    ctx.roundRect(2, ay, 20, ah, 4);
    ctx.fill();

    ctx.fillStyle = this.skinHighlight;
    ctx.beginPath();
    ctx.ellipse(-12, ay + ah * 0.4, 6, ah * 0.25, 0, 0, Math.PI * 2);
    ctx.ellipse(12, ay + ah * 0.4, 6, ah * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  renderTorso(ctx) {
    ctx.save();

    // Muscular V-Shape Torso (Broad shoulders, tight waist)
    ctx.fillStyle = this._torsoGrad;
    ctx.beginPath();
    ctx.moveTo(-56, -88); // Broad left shoulder
    ctx.lineTo(56, -88);  // Broad right shoulder
    ctx.lineTo(44, -6);   // Waist
    ctx.lineTo(-44, -6);
    ctx.closePath();
    ctx.fill();

    // Pectoral Muscle Definition (Chest)
    this.drawPec(ctx, -48, -76, 44, 30);
    this.drawPec(ctx, 4, -76, 44, 30);

    // Center Sternum Line
    ctx.strokeStyle = this.skinShadow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -84);
    ctx.lineTo(0, -44);
    ctx.stroke();

    // Chiseled 6-Pack Abs
    this.drawAbsRow(ctx, -42, 10);
    this.drawAbsRow(ctx, -28, 10);
    this.drawAbsRow(ctx, -14, 10);

    ctx.restore();
  }

  renderHead(ctx) {
    ctx.save();
    const headX = this.headRecoilX;
    const headY = -128 + this.headRecoilY;
    const headRot = this.headRecoilRot;

    ctx.translate(headX, headY);
    ctx.rotate(headRot);
    ctx.scale(this.squishX, this.squishY);

    // Muscular Trapezoid Neck
    ctx.fillStyle = this._neckGrad;
    ctx.beginPath();
    ctx.moveTo(-24, 22);
    ctx.lineTo(24, 22);
    ctx.lineTo(32, 54);
    ctx.lineTo(-32, 54);
    ctx.closePath();
    ctx.fill();

    // Neck muscle tendons
    ctx.strokeStyle = this.skinShadow;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-10, 24);
    ctx.lineTo(-18, 52);
    ctx.moveTo(10, 24);
    ctx.lineTo(18, 52);
    ctx.stroke();

    // Check if head image/canvas is ready to draw
    const isImageReady = this.headImage && (
      (this.headImage instanceof HTMLCanvasElement && this.headImage.width > 0) ||
      (this.headImage.complete && (this.headImage.naturalWidth > 0 || this.headImage.width > 0)) ||
      (this.headImage.width > 0 && this.headImage.height > 0)
    );

    if (isImageReady) {
      this.renderCustomHeadPhoto(ctx);
    } else {
      this.renderDefaultCartoonHead(ctx);
    }

    ctx.restore();
  }

  renderCustomHeadPhoto(ctx) {
    const headWidth = 145;
    const headHeight = 168;

    ctx.save();
    // Head drop shadow on neck
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 32, 48, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // High-res cropped head texture
    ctx.drawImage(
      this.headImage,
      -headWidth / 2,
      -headHeight / 2 - 8,
      headWidth,
      headHeight
    );

    // Stylish Neon Outline Frame
    ctx.strokeStyle = this.isPlayer ? '#00e5ff' : '#ff0055';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = this.isPlayer ? '#00e5ff' : '#ff0055';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, -8, 60, 70, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Streamer / Fighter Badge under chin
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.isPlayer ? '#00e5ff' : '#ff0055';
    ctx.beginPath();
    ctx.roundRect(-45, 46, 90, 18, 6);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.font = '900 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.name.substring(0, 10).toUpperCase(), 0, 55);

    ctx.restore();
  }

  renderDefaultCartoonHead(ctx) {
    ctx.fillStyle = this.skinTone;
    ctx.beginPath();
    ctx.ellipse(0, -6, 58, 66, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.skinShadow;
    ctx.fillRect(-26, 26, 52, 22);

    // Fierce Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-22, -14, 15, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(22, -14, 15, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(this.facing > 0 ? -18 : -26, -14, 6, 0, Math.PI * 2);
    ctx.arc(this.facing > 0 ? 26 : 18, -14, 6, 0, Math.PI * 2);
    ctx.fill();

    // Angry Brows
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-36, -30);
    ctx.lineTo(-8, -22);
    ctx.moveTo(36, -30);
    ctx.lineTo(8, -22);
    ctx.stroke();

    // Mouth Guard
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-22, 18, 44, 12);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.strokeRect(-22, 18, 44, 12);

    // Red Headband
    ctx.fillStyle = this.isPlayer ? '#00e5ff' : '#ff0055';
    ctx.fillRect(-56, -52, 112, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.isPlayer ? 'STREAMER' : 'BOSS', 0, -42);
  }

  // Back arm
  renderBackArm(ctx) {
    ctx.save();
    const dir = this.facing;
    const shoulderX = -dir * 42;
    const shoulderY = -78;
    let gloveX = -dir * 28;
    let gloveY = -62;

    if (this.state === 'ATTACKING') {
      const p = this.attackProgress;
      const punchReach = Math.sin(p * Math.PI);

      if (this.currentAttack === 'cross' || this.currentAttack === 'super' || this.currentAttack === 'uppercut') {
        if (this.currentAttack === 'uppercut' || this.currentAttack === 'super') {
          gloveX = -dir * 28 + dir * punchReach * 210;
          gloveY = -62 - punchReach * 135;
        } else {
          gloveX = -dir * 28 + dir * punchReach * 230;
          gloveY = -62 - punchReach * 28;
        }
      }
    }

    // Muscular Arm Stroke
    ctx.strokeStyle = this.skinShadow;
    ctx.lineWidth = 28;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(gloveX, gloveY);
    ctx.stroke();

    this.renderProGlove(ctx, gloveX, gloveY, 1.12, dir);
    ctx.restore();
  }

  // Front arm
  renderFrontArm(ctx) {
    ctx.save();
    const dir = this.facing;
    const shoulderX = dir * 42;
    const shoulderY = -78;
    let gloveX = dir * 68;
    let gloveY = -72;

    if (this.state === 'ATTACKING') {
      const p = this.attackProgress;
      const punchReach = Math.sin(p * Math.PI);

      if (this.currentAttack === 'jab') {
        gloveX = dir * 68 + dir * punchReach * 240;
        gloveY = -72 - punchReach * 18;
      } else if (this.currentAttack === 'hook') {
        gloveX = dir * 68 + dir * punchReach * 190;
        gloveY = -72 - Math.sin(p * Math.PI) * 85;
      }
    } else if (this.state === 'IDLE') {
      gloveY += Math.sin(this.animTime * 1.6) * 8;
      gloveX += Math.cos(this.animTime) * 5;
    } else if (this.state === 'HIT') {
      gloveX -= dir * 32;
      gloveY += 26;
    }

    // Forearm with gradient definition
    ctx.strokeStyle = this.skinTone;
    ctx.lineWidth = 30;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(gloveX, gloveY);
    ctx.stroke();

    this.renderProGlove(ctx, gloveX, gloveY, 1.28, dir);
    ctx.restore();
  }

  // Professional 3D Leather Boxing Glove
  renderProGlove(ctx, x, y, scale = 1.0, dir = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Main Glove Fist
    ctx.fillStyle = this._gloveGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();

    // Glove Thumb
    ctx.beginPath();
    ctx.arc(-dir * 14, -14, 13, 0, Math.PI * 2);
    ctx.fill();

    // Wrist Wrap / High-Grade Elastic Cuff
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.roundRect(-22, 14, 44, 16, 4);
    ctx.fill();

    // Brand Label on Wrist Tape
    ctx.fillStyle = this.gloveColor;
    ctx.fillRect(-14, 18, 28, 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PRO', 0, 22);

    // Leather Specular Highlight Shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(dir * 8, -10, 10, 6, -dir * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderHitFlash(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(0, -60, 110, 145, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderDizzyStars(ctx) {
    ctx.save();
    ctx.translate(0, -210);
    for (const star of this.dizzyStars) {
      const sx = Math.cos(star.angle) * star.radiusX;
      const sy = Math.sin(star.angle) * star.radiusY;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.fillStyle = '#ffea00';
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      for (let s = 0; s < 5; s++) {
        const a = (s * Math.PI * 2) / 5 - Math.PI / 2;
        const r1 = star.size;
        const r2 = star.size * 0.45;
        const x1 = Math.cos(a) * r1;
        const y1 = Math.sin(a) * r1;
        const a2 = a + Math.PI / 5;
        const x2 = Math.cos(a2) * r2;
        const y2 = Math.sin(a2) * r2;
        if (s === 0) ctx.moveTo(x1, y1);
        else ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}
