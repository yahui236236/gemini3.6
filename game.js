/**
 * TWINBEE 2088 - Classic Arcade Tribute Engine
 * Features Bell Juggling (頂鈴鐺系統), Shadow Clones (分身), Twin Cannon,
 * Ground Bombing & Bright Pastel World!
 */

// ==========================================================================
// 1. Web Audio Sound Engine (TwinBee Retro Chimes)
// ==========================================================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playPop() {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playBellHit() {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.1);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(now + 0.1);
  }

  playBellPickup() {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    
    // Play 3 arpeggiated bells
    [523.25, 659.25, 1046.50].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.2, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.06 + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.2);
    });
  }

  playExplosion(isLarge = false) {
    if (!this.enabled || !this.ctx) return;
    this.init();

    const bufferSize = this.ctx.sampleRate * (isLarge ? 0.4 : 0.2);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isLarge ? 500 : 900, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + (isLarge ? 0.4 : 0.2));

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (isLarge ? 0.4 : 0.2));

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start();
  }
}

const audio = new SoundEngine();

// ==========================================================================
// 2. Global Canvas & Setup
// ==========================================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 900;

function resizeCanvas() {
  const containerWidth = window.innerWidth;
  const containerHeight = window.innerHeight;
  const scale = Math.min(containerWidth / CANVAS_WIDTH, containerHeight / CANVAS_HEIGHT);

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.style.width = `${CANVAS_WIDTH * scale}px`;
  canvas.style.height = `${CANVAS_HEIGHT * scale}px`;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const GameState = {
  START: 'START',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER'
};

let currentState = GameState.START;
let score = 0;
let kills = 0;
let highScore = parseInt(localStorage.getItem('twinbee_high_score') || '0', 10);
let screenShakeTimer = 0;
let screenShakeMagnitude = 0;
let yellowBellCombo = 0;

// Input Keys
const keys = {
  w: false, a: false, s: false, d: false,
  ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
  Space: false, KeyE: false, ShiftLeft: false, ShiftRight: false,
  KeyP: false
};

// UI Elements
const hudElement = document.getElementById('hud');
const scoreVal = document.getElementById('score-val');
const weaponTypeVal = document.getElementById('weapon-type-val');
const highScoreVal = document.getElementById('high-score-val');
const hpBar = document.getElementById('hp-bar');
const shieldBar = document.getElementById('shield-bar');

const bossHpContainer = document.getElementById('boss-hp-container');
const bossName = document.getElementById('boss-name');
const bossHpBar = document.getElementById('boss-hp-bar');

const overlayStart = document.getElementById('overlay-start');
const overlayGameover = document.getElementById('overlay-gameover');
const overlayPause = document.getElementById('overlay-pause');
const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');
const btnResume = document.getElementById('btn-resume');
const btnSoundToggle = document.getElementById('btn-sound-toggle');

const finalScore = document.getElementById('final-score');
const finalKills = document.getElementById('final-kills');
const finalMaxCombo = document.getElementById('final-max-combo');
const finalHighscore = document.getElementById('final-highscore');

highScoreVal.innerText = highScore;

// Boss & Stage Manager
let currentStage = 1;
let activeBoss = null;

// ==========================================================================
// 3. TwinBee World, Player & Bell Juggling Logic
// ==========================================================================

// TwinBee Player Aircraft
class Player {
  constructor() {
    this.x = CANVAS_WIDTH / 2;
    this.y = CANVAS_HEIGHT - 130;
    this.radius = 24;
    this.baseSpeed = 6.5;
    this.speed = 6.5;
    this.maxHp = 500;
    this.hp = 500;
    this.maxShield = 500;
    this.shield = 500;

    this.hasTwinGun = false;
    this.hasClones = false;
    this.hasBarrier = false;

    // Movement History for Shadow Clones
    this.history = [];
    this.lastShootTime = 0;
    this.shootInterval = 110;
  }

  reset() {
    this.x = CANVAS_WIDTH / 2;
    this.y = CANVAS_HEIGHT - 130;
    this.hp = this.maxHp;
    this.shield = this.maxShield;
    this.speed = this.baseSpeed;
    this.hasTwinGun = false;
    this.hasClones = false;
    this.hasBarrier = false;
    this.history = [];
    weaponTypeVal.innerText = 'NORMAL';
    weaponTypeVal.className = 'hud-value glow-cyan';
  }

  update(dt) {
    let dx = 0;
    let dy = 0;

    if (keys.a || keys.ArrowLeft) dx -= 1;
    if (keys.d || keys.ArrowRight) dx += 1;
    if (keys.w || keys.ArrowUp) dy -= 1;
    if (keys.s || keys.ArrowDown) dy += 1;

    if (mobileTouchDir.x !== 0 || mobileTouchDir.y !== 0) {
      dx = mobileTouchDir.x;
      dy = mobileTouchDir.y;
    }

    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    this.x += dx * this.speed;
    this.y += dy * this.speed;

    this.x = Math.max(this.radius, Math.min(CANVAS_WIDTH - this.radius, this.x));
    this.y = Math.max(this.radius + 40, Math.min(CANVAS_HEIGHT - this.radius - 20, this.y));

    // Record position history for Green Bell Shadow Clones
    this.history.unshift({ x: this.x, y: this.y });
    if (this.history.length > 30) this.history.pop();

    // Auto / Manual Shooting
    const now = Date.now();
    if ((keys.Space || mobileFiring) && now - this.lastShootTime > this.shootInterval) {
      this.shoot();
      this.lastShootTime = now;
    }
  }

  shoot() {
    audio.playPop();

    if (this.hasTwinGun) {
      // Twin Cannon
      bullets.push(new Bullet(this.x - 14, this.y - 20, 0, -18, true));
      bullets.push(new Bullet(this.x + 14, this.y - 20, 0, -18, true));
    } else {
      // Single Cannon
      bullets.push(new Bullet(this.x, this.y - 20, 0, -18, true));
    }

    // Shadow Clones Fire Bullets
    if (this.hasClones) {
      const c1 = this.history[10] || { x: this.x - 30, y: this.y + 20 };
      const c2 = this.history[20] || { x: this.x + 30, y: this.y + 20 };
      bullets.push(new Bullet(c1.x, c1.y - 15, 0, -18, true, 'clone_bullet'));
      bullets.push(new Bullet(c2.x, c2.y - 15, 0, -18, true, 'clone_bullet'));
    }
  }

  takeDamage(amount) {
    audio.playExplosion(false);
    triggerScreenShake(6, 120);

    if (this.hasBarrier && this.shield > 0) {
      this.shield -= amount;
      if (this.shield <= 0) {
        this.shield = 0;
        this.hasBarrier = false;
      }
    } else {
      this.hp -= amount;
    }

    if (this.hp <= 0) {
      this.hp = 0;
      gameOver();
    }
  }

  draw() {
    // Draw Green Shadow Clones if active
    if (this.hasClones) {
      const c1 = this.history[10] || { x: this.x - 30, y: this.y + 20 };
      const c2 = this.history[20] || { x: this.x + 30, y: this.y + 20 };
      this.drawTwinBeeCraft(c1.x, c1.y, true);
      this.drawTwinBeeCraft(c2.x, c2.y, true);
    }

    // Draw Main Player TwinBee Craft
    this.drawTwinBeeCraft(this.x, this.y, false);
  }

  drawTwinBeeCraft(x, y, isClone = false) {
    ctx.save();
    ctx.translate(x, y);

    if (isClone) {
      ctx.globalAlpha = 0.65;
    }

    // Barrier Aura
    if (this.hasBarrier && this.shield > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff75a0';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#ff75a0';
      ctx.shadowBlur = 12;
      ctx.stroke();
    }

    // TwinBee Body (Cute Round Craft)
    ctx.fillStyle = isClone ? '#2ed573' : '#70a1ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Yellow Canopy / Face
    ctx.fillStyle = '#fffa65';
    ctx.beginPath();
    ctx.arc(0, -8, 12, 0, Math.PI * 2);
    ctx.fill();

    // Cute Eyes
    ctx.fillStyle = '#1e272e';
    ctx.beginPath();
    ctx.arc(-4, -10, 2.5, 0, Math.PI * 2);
    ctx.arc(4, -10, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Floating Boxing Glove Hands 🥊
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(-24, 4, 7, 0, Math.PI * 2);
    ctx.arc(24, 4, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// Iconic Bell Item (Juggled by Shooting!)
class Bell {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 16;
    this.vy = 1.2; // Slow downward float
    this.vx = (Math.random() - 0.5) * 1.5;
    this.hitCount = 0;
    this.alive = true;

    // Bell Types: 'YELLOW', 'WHITE', 'BLUE', 'GREEN', 'PINK'
    this.types = ['YELLOW', 'WHITE', 'BLUE', 'GREEN', 'PINK'];
    this.typeIndex = 0;
    this.color = '#fffa65';
  }

  onShot() {
    audio.playBellHit();
    this.vy = -6.5; // Pop upwards!
    this.vx = (Math.random() - 0.5) * 3;
    this.hitCount++;

    // Advance Bell Color on hit!
    this.typeIndex = (this.typeIndex + 1) % this.types.length;
    const t = this.types[this.typeIndex];

    if (t === 'YELLOW') this.color = '#fffa65';
    else if (t === 'WHITE') this.color = '#ffffff';
    else if (t === 'BLUE') this.color = '#70a1ff';
    else if (t === 'GREEN') this.color = '#2ed573';
    else if (t === 'PINK') this.color = '#ff75a0';
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    // Gravity decelerates upward pop
    if (this.vy < 2.0) this.vy += 0.25;

    // Bounce off screen boundaries
    if (this.x < 25 || this.x > CANVAS_WIDTH - 25) this.vx *= -1;

    if (this.y > CANVAS_HEIGHT + 40) this.alive = false;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Glowing Bell Body
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.arc(0, -3, 13, Math.PI, 0);
    ctx.lineTo(15, 10);
    ctx.lineTo(-15, 10);
    ctx.closePath();
    ctx.fill();

    // Bell Rim & Clapper
    ctx.fillStyle = '#1e272e';
    ctx.beginPath();
    ctx.arc(0, 11, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// Floating Target Cloud (Shooting cloud spawns a Bell)
class CloudTarget {
  constructor() {
    this.x = Math.random() * (CANVAS_WIDTH - 160) + 80;
    this.y = -60;
    this.vy = 1.2;
    this.radius = 35;
    this.hp = 1;
    this.alive = true;
  }

  update() {
    this.y += this.vy;
    if (this.y > CANVAS_HEIGHT + 80) this.alive = false;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.arc(25, 10, 22, 0, Math.PI * 2);
    ctx.arc(-25, 10, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Bullets
class Bullet {
  constructor(x, y, vx, vy, isPlayer = true, type = 'normal') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.isPlayer = isPlayer;
    this.type = type;
    this.radius = 6;
    this.alive = true;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < -20 || this.x > CANVAS_WIDTH + 20 || this.y < -20 || this.y > CANVAS_HEIGHT + 20) {
      this.alive = false;
    }
  }

  draw() {
    ctx.save();
    if (this.isPlayer) {
      ctx.fillStyle = this.type === 'clone_bullet' ? '#2ed573' : '#fffa65';
      ctx.shadowColor = this.type === 'clone_bullet' ? '#2ed573' : '#fffa65';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ff4d4d';
      ctx.shadowColor = '#ff4d4d';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// Cute Enemies (Fruit, Turnips, Alarm Clocks, Flying Teapots)
class Enemy {
  constructor() {
    this.x = Math.random() * (CANVAS_WIDTH - 80) + 40;
    this.y = -40;
    this.radius = 18;
    this.hp = 15;
    this.speedY = Math.random() * 1.5 + 2.2;
    this.speedX = Math.sin(Date.now() / 200) * 2;
    this.alive = true;

    // Enemy Types: 'turnip', 'clock', 'teapot', 'boss'
    const rand = Math.random();
    this.type = rand < 0.4 ? 'turnip' : (rand < 0.8 ? 'clock' : 'teapot');
    this.lastShoot = Date.now();
  }

  update(dt) {
    this.x += Math.sin(this.y / 40) * 2.5;
    this.y += this.speedY;

    if (Date.now() - this.lastShoot > 1200) {
      this.shoot();
      this.lastShoot = Date.now();
    }

    if (this.y > CANVAS_HEIGHT + 50) this.alive = false;
  }

  shoot() {
    if (this.y < 0) return;
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 4.5, Math.sin(angle) * 4.5, false));
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.alive = false;
      audio.playExplosion(false);
      kills++;
      score += 150;
      scoreVal.innerText = score;
      floatingTexts.push(new FloatingText(this.x, this.y, "+150", "#fffa65"));
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.type === 'turnip') {
      // Cute Flying Turnip / Radish 🥬
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2ed573';
      ctx.fillRect(-6, -22, 12, 10);
    } else if (this.type === 'clock') {
      // Flying Alarm Clock ⏰
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Flying Teapot 🫖
      ctx.fillStyle = '#ff9f1a';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// Stage Bosses (King Onion, Watermelon Mecha, King Spice Teapot)
class StageBoss {
  constructor(stage = 1) {
    this.stage = stage;
    this.x = CANVAS_WIDTH / 2;
    this.y = -100;
    this.targetY = 140;
    this.alive = true;
    this.timer = 0;
    this.speedX = 2;
    this.lastShoot = Date.now();

    if (stage === 1) {
      this.name = "🧅 KING ONION (洋蔥大王)";
      this.radius = 55;
      this.hp = 800;
      this.maxHp = 800;
      this.color = '#f39c12';
    } else if (stage === 2) {
      this.name = "🍉 WATERMELON MECHA (西瓜巨型獸)";
      this.radius = 65;
      this.hp = 1500;
      this.maxHp = 1500;
      this.color = '#27ae60';
    } else {
      this.name = "🫖 KING SPICE TEAPOT (皇冠大茶壺魔王)";
      this.radius = 75;
      this.hp = 2500;
      this.maxHp = 2500;
      this.color = '#e74c3c';
    }
  }

  update(dt) {
    this.timer += dt;

    if (this.y < this.targetY) {
      this.y += 1.5;
    } else {
      this.x += this.speedX;
      if (this.x < 110 || this.x > CANVAS_WIDTH - 110) {
        this.speedX *= -1;
      }
    }

    if (Date.now() - this.lastShoot > (this.stage === 3 ? 500 : 800)) {
      this.shoot();
      this.lastShoot = Date.now();
    }
  }

  shoot() {
    if (this.y < 0) return;

    if (this.stage === 1) {
      // 3-way tear barrage
      for (let i = -1; i <= 1; i++) {
        bullets.push(new Bullet(this.x + i * 20, this.y + 20, i * 2, 5, false));
      }
    } else if (this.stage === 2) {
      // Seed Machine Gun
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 / 6) * i + (this.timer / 300);
        bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 5, Math.sin(angle) * 5, false));
      }
    } else if (this.stage === 3) {
      // 10-way Ring Burst
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * 2 / 10) * i + (this.timer / 250);
        bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 5.5, Math.sin(angle) * 5.5, false));
      }
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    audio.playBellHit();

    // Sparkles
    for (let i = 0; i < 4; i++) {
      particles.push(new Particle(
        this.x, this.y,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        this.color,
        Math.random() * 4 + 2,
        15
      ));
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.onDestroy();
    }
  }

  onDestroy() {
    audio.playExplosion(true);
    triggerScreenShake(20, 500);
    kills++;
    score += this.stage * 2000;
    scoreVal.innerText = score;

    // Drop 3 Bells & Pink Shield Bell!
    bells.push(new Bell(this.x - 30, this.y));
    bells.push(new Bell(this.x, this.y));
    bells.push(new Bell(this.x + 30, this.y));

    // Big Fireworks Particles
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2;
      particles.push(new Particle(
        this.x, this.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        this.color,
        Math.random() * 6 + 3,
        40
      ));
    }

    floatingTexts.push(new FloatingText(CANVAS_WIDTH / 2, 240, `🎉 STAGE ${this.stage} CLEAR! 🎉`, "#fffa65"));
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.stage === 1) {
      // 🧅 KING ONION
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Onion Crown Leaves
      ctx.fillStyle = '#2ed573';
      ctx.fillRect(-12, -75, 24, 30);

      // Angry Eyes
      ctx.fillStyle = '#1e272e';
      ctx.beginPath();
      ctx.arc(-16, -10, 6, 0, Math.PI * 2);
      ctx.arc(16, -10, 6, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.stage === 2) {
      // 🍉 WATERMELON MECHA
      ctx.fillStyle = '#27ae60';
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#218c74';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Watermelon Dark Stripes
      ctx.strokeStyle = '#1e272e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-45, -20); ctx.lineTo(-10, 50);
      ctx.moveTo(0, -55); ctx.lineTo(15, 55);
      ctx.moveTo(35, -30); ctx.lineTo(45, 30);
      ctx.stroke();

    } else if (this.stage === 3) {
      // 🫖 KING SPICE TEAPOT
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Royal Crown
      ctx.fillStyle = '#fffa65';
      ctx.beginPath();
      ctx.moveTo(-30, -70);
      ctx.lineTo(-15, -95);
      ctx.lineTo(0, -75);
      ctx.lineTo(15, -95);
      ctx.lineTo(30, -70);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

// Visual Effects
class Particle {
  constructor(x, y, vx, vy, color, radius, maxLife) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.color = color;
    this.radius = radius; this.life = maxLife; this.maxLife = maxLife;
  }
  update() { this.x += this.vx; this.y += this.vy; this.life--; }
  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class FloatingText {
  constructor(x, y, text, color) {
    this.x = x; this.y = y; this.text = text; this.color = color; this.life = 40;
  }
  update() { this.y -= 1; this.life--; }
  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / 40);
    ctx.font = '700 15px Fredoka, Orbitron';
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// Pastoral TwinBee Background (Green Farmland, Rivers, Windmills & Clouds)
class TwinBeeBackground {
  constructor() {
    this.scrollY = 0;
    this.clouds = [];
    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        scale: Math.random() * 0.8 + 0.6,
        speed: Math.random() * 1.2 + 0.8
      });
    }
  }

  update() {
    this.scrollY += 1.5;
    this.clouds.forEach(c => {
      c.y += c.speed;
      if (c.y > CANVAS_HEIGHT + 60) {
        c.y = -60;
        c.x = Math.random() * CANVAS_WIDTH;
      }
    });
  }

  draw() {
    ctx.save();

    // Pastoral Green Farmland Palette
    let grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, '#55efc4');
    grad.addColorStop(0.5, '#00b894');
    grad.addColorStop(1, '#009432');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Winding Blue River
    ctx.strokeStyle = '#74b9ff';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(120, -50);
    ctx.bezierCurveTo(300, 300, 50, 600, 220, CANVAS_HEIGHT + 50);
    ctx.stroke();

    // Farmland Checkered Fields
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    for (let y = (this.scrollY % 80); y < CANVAS_HEIGHT; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Parallax Cloud Shadows & Clouds
    this.clouds.forEach(c => {
      ctx.save();
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.beginPath();
      ctx.arc(c.x + 25, c.y + 25, 40 * c.scale, 0, Math.PI * 2);
      ctx.fill();

      // White Cloud
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 40 * c.scale, 0, Math.PI * 2);
      ctx.arc(c.x + 25, c.y + 5, 30 * c.scale, 0, Math.PI * 2);
      ctx.arc(c.x - 20, c.y + 5, 30 * c.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();
  }
}

function triggerScreenShake(magnitude, duration) {
  screenShakeMagnitude = magnitude;
  screenShakeTimer = duration;
}

// ==========================================================================
// 4. Game Engine Loop & Managers
// ==========================================================================
const player = new Player();
const bg = new TwinBeeBackground();
let bullets = [];
let enemies = [];
let bells = [];
let cloudTargets = [];
let particles = [];
let floatingTexts = [];

let spawnTimer = 0;
let cloudSpawnTimer = 0;
let lastTime = 0;

function updateGame(dt) {
  if (currentState !== GameState.PLAYING) return;

  bg.update();
  player.update(dt);

  // Spawn Stage Bosses based on score & stage
  if (!activeBoss) {
    if (currentStage === 1 && score >= 300) {
      activeBoss = new StageBoss(1);
    } else if (currentStage === 2 && score >= 1000) {
      activeBoss = new StageBoss(2);
    } else if (currentStage === 3 && score >= 2500) {
      activeBoss = new StageBoss(3);
    }

    if (activeBoss) {
      bossName.innerText = activeBoss.name;
      bossHpContainer.classList.remove('hidden');
      floatingTexts.push(new FloatingText(CANVAS_WIDTH / 2, 200, `⚠️ BOSS: ${activeBoss.name} ⚠️`, "#ff4d4d"));
    }
  }

  if (activeBoss) {
    activeBoss.update(dt);
    bossHpBar.style.width = `${(activeBoss.hp / activeBoss.maxHp) * 100}%`;

    if (!activeBoss.alive) {
      activeBoss = null;
      bossHpContainer.classList.add('hidden');
      currentStage++;
    }
  }

  // Spawn Cloud Targets (which release Bells)
  cloudSpawnTimer += dt;
  if (cloudSpawnTimer > 3500) {
    cloudSpawnTimer = 0;
    cloudTargets.push(new CloudTarget());
  }

  // Spawn Regular Enemies (Only when no boss is active)
  if (!activeBoss) {
    spawnTimer += dt;
    if (spawnTimer > 1200) {
      spawnTimer = 0;
      enemies.push(new Enemy());
    }
  }

  // Update Entities
  cloudTargets.forEach(c => c.update());
  cloudTargets = cloudTargets.filter(c => c.alive);

  bells.forEach(b => b.update());
  bells = bells.filter(b => b.alive);

  bullets.forEach(b => b.update());
  bullets = bullets.filter(b => b.alive);

  enemies.forEach(e => e.update(dt));
  enemies = enemies.filter(e => e.alive);

  particles.forEach(p => p.update());
  particles = particles.filter(p => p.life > 0);

  floatingTexts.forEach(ft => ft.update());
  floatingTexts = floatingTexts.filter(ft => ft.life > 0);

  handleCollisions();

  hpBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
  shieldBar.style.width = `${(player.shield / player.maxShield) * 100}%`;
}

function handleCollisions() {
  // Player bullets vs Cloud Targets -> Releases Bell!
  bullets.forEach(b => {
    if (!b.isPlayer || !b.alive) return;
    cloudTargets.forEach(c => {
      if (!c.alive) return;
      const dist = Math.hypot(b.x - c.x, b.y - c.y);
      if (dist < b.radius + c.radius) {
        b.alive = false;
        c.alive = false;
        bells.push(new Bell(c.x, c.y)); // Spawn Bell!
        floatingTexts.push(new FloatingText(c.x, c.y, "🔔 BELL!", "#fffa65"));
      }
    });
  });

  // Player bullets vs Bells -> Juggles Bell & Changes Color!
  bullets.forEach(b => {
    if (!b.isPlayer || !b.alive) return;
    bells.forEach(bell => {
      if (!bell.alive) return;
      const dist = Math.hypot(b.x - bell.x, b.y - bell.y);
      if (dist < b.radius + bell.radius) {
        b.alive = false;
        bell.onShot(); // Pop Bell upwards & cycle color!
      }
    });
  });

  // Player bullets vs Active Stage Boss
  if (activeBoss && activeBoss.alive) {
    bullets.forEach(b => {
      if (!b.isPlayer || !b.alive) return;
      const dist = Math.hypot(b.x - activeBoss.x, b.y - activeBoss.y);
      if (dist < b.radius + activeBoss.radius) {
        b.alive = false;
        activeBoss.takeDamage(25);
      }
    });

    // Player vs Boss Body Collision
    const bossDist = Math.hypot(player.x - activeBoss.x, player.y - activeBoss.y);
    if (bossDist < player.radius + activeBoss.radius) {
      player.takeDamage(25);
    }
  }

  // Player bullets vs Enemies
  bullets.forEach(b => {
    if (!b.isPlayer || !b.alive) return;
    enemies.forEach(e => {
      if (!e.alive) return;
      const dist = Math.hypot(b.x - e.x, b.y - e.y);
      if (dist < b.radius + e.radius) {
        b.alive = false;
        e.takeDamage(20);
      }
    });
  });

  // Enemy bullets vs Player
  bullets.forEach(b => {
    if (b.isPlayer || !b.alive) return;
    const dist = Math.hypot(b.x - player.x, b.y - player.y);
    if (dist < b.radius + player.radius) {
      b.alive = false;
      player.takeDamage(20);
    }
  });

  // Player collects Bell!
  bells.forEach(bell => {
    if (!bell.alive) return;
    const dist = Math.hypot(bell.x - player.x, bell.y - player.y);
    if (dist < bell.radius + player.radius) {
      bell.alive = false;
      audio.playBellPickup();

      const type = bell.types[bell.typeIndex];
      if (type === 'YELLOW') {
        // Yellow Bell: Increasing Score Bonus!
        yellowBellCombo++;
        const pts = Math.min(10000, 500 * Math.pow(2, Math.min(4, yellowBellCombo - 1)));
        score += pts;
        scoreVal.innerText = score;
        floatingTexts.push(new FloatingText(player.x, player.y - 20, `+${pts} PTS!`, "#fffa65"));
      } else if (type === 'WHITE') {
        // White Bell: Twin Bubble Cannon
        player.hasTwinGun = true;
        weaponTypeVal.innerText = 'TWIN CANNON';
        weaponTypeVal.className = 'hud-value glow-cyan';
        floatingTexts.push(new FloatingText(player.x, player.y - 20, "TWIN CANNON!", "#ffffff"));
      } else if (type === 'BLUE') {
        // Blue Bell: Speed Up
        player.speed = player.baseSpeed * 1.5;
        floatingTexts.push(new FloatingText(player.x, player.y - 20, "SPEED UP!", "#70a1ff"));
      } else if (type === 'GREEN') {
        // Green Bell: Shadow Clones
        player.hasClones = true;
        weaponTypeVal.innerText = 'SHADOW CLONES';
        weaponTypeVal.className = 'hud-value glow-green';
        floatingTexts.push(new FloatingText(player.x, player.y - 20, "SHADOW CLONES!", "#2ed573"));
      } else if (type === 'PINK') {
        // Pink Bell: Barrier Shield
        player.hasBarrier = true;
        player.shield = player.maxShield;
        floatingTexts.push(new FloatingText(player.x, player.y - 20, "BARRIER SHIELD!", "#ff75a0"));
      }
    }
  });
}

function render() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.save();
  if (screenShakeTimer > 0) {
    const offsetX = (Math.random() - 0.5) * screenShakeMagnitude;
    const offsetY = (Math.random() - 0.5) * screenShakeMagnitude;
    ctx.translate(offsetX, offsetY);
    screenShakeTimer -= 16;
  }

  bg.draw();
  cloudTargets.forEach(c => c.draw());
  bells.forEach(b => b.draw());
  bullets.forEach(b => b.draw());
  enemies.forEach(e => e.draw());
  if (activeBoss && activeBoss.alive) activeBoss.draw();
  if (currentState === GameState.PLAYING) player.draw();
  particles.forEach(p => p.draw());
  floatingTexts.forEach(ft => ft.draw());

  ctx.restore();
}

function gameLoop(timestamp) {
  const dt = timestamp - lastTime || 16;
  lastTime = timestamp;

  updateGame(dt);
  render();

  requestAnimationFrame(gameLoop);
}

// ==========================================================================
// 5. State & Controls
// ==========================================================================
function startGame() {
  score = 0;
  kills = 0;
  yellowBellCombo = 0;
  currentStage = 1;
  activeBoss = null;
  bullets = [];
  enemies = [];
  bells = [];
  cloudTargets = [];
  particles = [];
  floatingTexts = [];

  player.reset();
  audio.init();

  scoreVal.innerText = '0';

  bossHpContainer.classList.add('hidden');
  overlayStart.classList.add('hidden');
  overlayGameover.classList.add('hidden');
  overlayPause.classList.add('hidden');
  hudElement.classList.remove('hidden');

  currentState = GameState.PLAYING;
}

function gameOver() {
  currentState = GameState.GAMEOVER;
  audio.playExplosion(true);

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('twinbee_high_score', highScore.toString());
  }

  finalScore.innerText = score;
  finalKills.innerText = kills;
  finalMaxCombo.innerText = yellowBellCombo;
  finalHighscore.innerText = highScore;

  hudElement.classList.add('hidden');
  overlayGameover.classList.remove('hidden');
}

function togglePause() {
  if (currentState === GameState.PLAYING) {
    currentState = GameState.PAUSED;
    overlayPause.classList.remove('hidden');
  } else if (currentState === GameState.PAUSED) {
    currentState = GameState.PLAYING;
    overlayPause.classList.add('hidden');
  }
}

window.addEventListener('keydown', (e) => {
  if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
  if (e.code === 'KeyP') togglePause();
});

window.addEventListener('keyup', (e) => {
  if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
});

btnStart.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);
btnResume.addEventListener('click', togglePause);

btnSoundToggle.addEventListener('click', () => {
  audio.enabled = !audio.enabled;
  btnSoundToggle.innerText = audio.enabled ? '🔊 音效: 開' : '🔇 音效: 關';
});

const btnShare = document.getElementById('btn-share');
if (btnShare) {
  btnShare.addEventListener('click', () => {
    const gameUrl = 'https://yahui236236.github.io/gemini3.6/';
    navigator.clipboard.writeText(gameUrl).then(() => {
      btnShare.innerText = '✅ 已複製連結！快傳給同學！';
      setTimeout(() => {
        btnShare.innerText = '🔗 複製遊戲連結傳給同學 [SHARE]';
      }, 2500);
    }).catch(() => {
      alert(`遊戲連結為：${gameUrl}`);
    });
  });
}

// Mobile Controls
let mobileTouchDir = { x: 0, y: 0 };
let mobileFiring = false;
let mobileBombTrigger = false;

const joystickZone = document.getElementById('joystick-zone');
const joystickKnob = document.getElementById('joystick-knob');
const mobileControls = document.getElementById('mobile-controls');
const btnMobileFire = document.getElementById('btn-mobile-fire');
const btnMobileBomb = document.getElementById('btn-mobile-bomb');

if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  mobileControls.classList.remove('hidden');
}

let touchId = null;
let touchStartPos = { x: 0, y: 0 };

joystickZone.addEventListener('touchstart', (e) => {
  const touch = e.changedTouches[0];
  touchId = touch.identifier;
  const rect = joystickZone.getBoundingClientRect();
  touchStartPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}, { passive: true });

joystickZone.addEventListener('touchmove', (e) => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === touchId) {
      const dx = touch.clientX - touchStartPos.x;
      const dy = touch.clientY - touchStartPos.y;
      const dist = Math.min(45, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx);

      const knobX = Math.cos(angle) * dist;
      const knobY = Math.sin(angle) * dist;

      joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
      mobileTouchDir.x = knobX / 45;
      mobileTouchDir.y = knobY / 45;
    }
  }
}, { passive: true });

const resetJoystick = () => {
  touchId = null;
  mobileTouchDir = { x: 0, y: 0 };
  joystickKnob.style.transform = 'translate(0px, 0px)';
};

joystickZone.addEventListener('touchend', resetJoystick);
joystickZone.addEventListener('touchcancel', resetJoystick);

btnMobileFire.addEventListener('touchstart', (e) => { e.preventDefault(); mobileFiring = true; });
btnMobileFire.addEventListener('touchend', (e) => { e.preventDefault(); mobileFiring = false; });
btnMobileBomb.addEventListener('touchstart', (e) => { e.preventDefault(); mobileBombTrigger = true; });

// Direct Touch Dragging on Canvas (Touch anywhere on screen to drag TwinBee!)
let isDirectTouching = false;
let touchOffset = { x: 0, y: 0 };

canvas.addEventListener('touchstart', (e) => {
  if (currentState !== GameState.PLAYING) return;
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;

  const touchCanvasX = (touch.clientX - rect.left) * scaleX;
  const touchCanvasY = (touch.clientY - rect.top) * scaleY;

  isDirectTouching = true;
  mobileFiring = true;
  touchOffset.x = player.x - touchCanvasX;
  touchOffset.y = player.y - touchCanvasY;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (!isDirectTouching || currentState !== GameState.PLAYING) return;
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;

  const touchCanvasX = (touch.clientX - rect.left) * scaleX;
  const touchCanvasY = (touch.clientY - rect.top) * scaleY;

  player.x = touchCanvasX + touchOffset.x;
  player.y = touchCanvasY + touchOffset.y;
  player.x = Math.max(player.radius, Math.min(CANVAS_WIDTH - player.radius, player.x));
  player.y = Math.max(player.radius + 40, Math.min(CANVAS_HEIGHT - player.radius - 20, player.y));
}, { passive: false });

const endDirectTouch = () => {
  isDirectTouching = false;
  mobileFiring = false;
};
canvas.addEventListener('touchend', endDirectTouch);
canvas.addEventListener('touchcancel', endDirectTouch);

requestAnimationFrame(gameLoop);
