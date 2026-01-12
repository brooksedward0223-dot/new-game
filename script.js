// Simple canvas platformer: jump between platforms and kill zombies with a minigun.
// Controls: A/D or ←→ to move, W/Up/Space to jump, mouse to aim, hold left mouse to fire.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const healthEl = document.getElementById('health');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayScore = document.getElementById('overlay-score');
  const btnRestart = document.getElementById('btn-restart');

  // Virtual resolution; canvas scaled to fit
  const RES_W = 1280, RES_H = 720;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = RES_W;
    canvas.height = RES_H;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // Utilities
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function rand(min,max){ return Math.random()*(max-min)+min; }
  function now(){ return performance.now(); }

  // Input
  const keys = {};
  const mouse = {x: RES_W/2, y: RES_H/2, down:false};
  window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
  window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * (canvas.width / r.width);
    const py = (e.clientY - r.top) * (canvas.height / r.height);
    mouse.x = px; mouse.y = py;
  });
  canvas.addEventListener('mousedown', e => { if(e.button===0) mouse.down = true; });
  window.addEventListener('mouseup', e => { if(e.button===0) mouse.down = false; });

  // Game objects
  const gravity = 1800;
  const platforms = [];
  const bullets = [];
  const zombies = [];
  let lastTime = now();
  let spawnTimer = 0;
  let spawnInterval = 1600;
  let score = 0;

  class Platform {
    constructor(x,y,w,h){ this.x=x;this.y=y;this.w=w;this.h=h; }
    draw(ctx){
      ctx.fillStyle = '#244e2b';
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.fillStyle = '#18351f';
      ctx.fillRect(this.x, this.y+this.h-6, this.w, 6);
    }
  }

  class Player {
    constructor(){
      this.w = 46; this.h = 66;
      this.x = 160; this.y = RES_H - 240;
      this.vx = 0; this.vy = 0;
      this.speed = 420;
      this.onGround = false;
      this.facing = 1;
      this.health = 100;
      this.fireCooldown = 0;
      this.fireRate = 0.04; // seconds between bullets (minigun)
    }
    get center(){ return {x: this.x + this.w/2, y: this.y + this.h/2}; }
    update(dt){
      // Input horizontal
      let move = 0;
      if (keys['a'] || keys['arrowleft']) move -= 1;
      if (keys['d'] || keys['arrowright']) move += 1;
      this.vx = move*this.speed;
      if (move !== 0) this.facing = move>0?1:-1;

      // Jump
      const wantsJump = keys['w'] || keys['arrowup'] || keys[' '];
      if (wantsJump && this.onGround){
        this.vy = -760;
        this.onGround = false;
      }

      // Apply physics
      this.vy += gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // World bounds horizontally
      if (this.x < 0) this.x = 0;
      if (this.x + this.w > RES_W) this.x = RES_W - this.w;

      // Platform collision
      this.onGround = false;
      for (let p of platforms){
        if (this.x + this.w > p.x && this.x < p.x + p.w){
          // coming from above?
          const prevY = this.y - this.vy*dt;
          if (prevY + this.h <= p.y && this.y + this.h >= p.y){
            this.y = p.y - this.h;
            this.vy = 0;
            this.onGround = true;
          }
        }
      }

      // Floor
      if (this.y + this.h >= RES_H){
        this.y = RES_H - this.h;
        this.vy = 0;
        this.onGround = true;
      }

      // Firing
      if (mouse.down){
        this.fireCooldown -= dt;
        if (this.fireCooldown <= 0){
          this.fireCooldown = this.fireRate;
          this.fireBullet();
        }
      } else {
        // small recovery to allow semi-auto pace when pressing again
        this.fireCooldown = Math.min(this.fireCooldown, 0);
      }
    }
    fireBullet(){
      const c = this.center;
      // aim towards mouse
      const dx = mouse.x - c.x, dy = mouse.y - c.y;
      const len = Math.hypot(dx,dy) || 1;
      const speed = 1200;
      const vx = (dx/len)*speed;
      const vy = (dy/len)*speed;
      const b = {x:c.x, y:c.y, vx, vy, r:6, life:1.8};
      bullets.push(b);
    }
    draw(ctx){
      // Body
      ctx.save();
      ctx.translate(this.x, this.y);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(6, this.h-6, this.w-12, 6);
      // body
      ctx.fillStyle = '#4fc3f7';
      ctx.fillRect(0, 8, this.w, this.h-16);
      // head
      ctx.fillStyle = '#ffe0b2';
      ctx.beginPath();
      ctx.ellipse(this.w/2, 10, 16, 14, 0, 0, Math.PI*2);
      ctx.fill();

      ctx.restore();

      // draw minigun barrel aiming at mouse
      const c = this.center;
      const ang = Math.atan2(mouse.y - c.y, mouse.x - c.x);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(ang);
      // barrel
      ctx.fillStyle = '#222';
      ctx.fillRect(0, -6, 36, 12);
      // muzzle
      ctx.fillStyle = '#999';
      ctx.fillRect(36, -4, 8, 8);
      ctx.restore();
    }
  }

  class Zombie {
    constructor(x,y){
      this.w = 48; this.h = 64;
      this.x = x; this.y = y;
      this.vx = -rand(20,90);
      this.health = 35 + Math.round(rand(0,30));
      this.speedMul = 1;
      this.dead = false;
    }
    update(dt){
      // aim towards left (player roughly left side)
      this.x += this.vx * this.speedMul * dt;
      // gravity simple: land on platforms / ground
      let grounded = false;
      for (let p of platforms){
        if (this.x + this.w > p.x && this.x < p.x + p.w){
          if (this.y + this.h <= p.y && this.y + this.h + 6 >= p.y){
            this.y = p.y - this.h;
            grounded = true;
          }
        }
      }
      if (!grounded){
        this.y += gravity * dt;
        if (this.y + this.h >= RES_H){
          this.y = RES_H - this.h;
        }
      }
    }
    draw(ctx){
      ctx.save();
      ctx.translate(this.x, this.y);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(6, this.h-6, this.w-12, 6);
      // torso
      ctx.fillStyle = '#4d7a3d';
      ctx.fillRect(0, 8, this.w, this.h-12);
      // head
      ctx.fillStyle = '#7a9b68';
      ctx.fillRect(8, -6, this.w-16, 22);
      // injuries / eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(this.w/2-10, -2, 6, 6);
      ctx.fillRect(this.w/2+4, -2, 6, 6);
      // health bar
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, -8, this.w, 5);
      ctx.fillStyle = '#ff6b6b';
      const w = clamp((this.health / 60) * this.w, 0, this.w);
      ctx.fillRect(0, -8, w, 5);
      ctx.restore();
    }
  }

  const player = new Player();

  function resetGame(){
    platforms.length = 0;
    bullets.length = 0;
    zombies.length = 0;
    score = 0;
    player.x = 160; player.y = RES_H - 240;
    player.vx = player.vy = 0;
    player.health = 100;
    spawnInterval = 1600;
    spawnTimer = 0;
    buildLevel();
    overlay.classList.add('hidden');
  }

  function buildLevel(){
    // ground platform across bottom
    platforms.push(new Platform(0, RES_H - 24, RES_W, 24));
    // some floating platforms
    const banks = [
      [140, RES_H-180, 260, 16],
      [420, RES_H-280, 220, 16],
      [720, RES_H-210, 260, 16],
      [980, RES_H-330, 240, 16],
      [560, RES_H-120, 200, 16],
    ];
    for (let b of banks) platforms.push(new Platform(...b));
  }

  function spawnZombie(){
    // spawn at right edge, random y on a platform or on ground
    const sideX = RES_W + 64;
    // pick a platform to place on
    const p = platforms[Math.floor(rand(0, platforms.length))];
    const y = (p ? p.y - 64 : RES_H - 64 - 24);
    const z = new Zombie(sideX, y);
    // give some chance to be faster/tougher
    if (Math.random() < 0.15){ z.vx *= 1.4; z.health *= 1.6; }
    zombies.push(z);
  }

  function update(dt){
    // spawn logic
    spawnTimer += dt*1000;
    const difficulty = 1 + score/60;
    if (spawnTimer >= spawnInterval/difficulty){
      spawnTimer = 0;
      spawnZombie();
      // slowly lower interval min cap
      spawnInterval = Math.max(550, spawnInterval - 20);
    }

    player.update(dt);

    for (let b of bullets){
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    // remove bullets out of bounds or expired
    for (let i = bullets.length-1; i>=0; i--){
      const b = bullets[i];
      if (b.life <= 0 || b.x < -50 || b.x > RES_W+50 || b.y < -50 || b.y > RES_H+50){
        bullets.splice(i,1);
      }
    }

    for (let z of zombies) z.update(dt);

    // bullet collisions with zombies
    for (let i = bullets.length-1; i >= 0; i--){
      const b = bullets[i];
      for (let j = zombies.length-1; j >= 0; j--){
        const z = zombies[j];
        // circle vs rect
        const cx = clamp(b.x, z.x, z.x + z.w);
        const cy = clamp(b.y, z.y, z.y + z.h);
        const dx = b.x - cx, dy = b.y - cy;
        if (dx*dx + dy*dy <= b.r*b.r){
          // hit
          z.health -= 12 + Math.random()*8;
          bullets.splice(i,1);
          if (z.health <= 0){
            zombies.splice(j,1);
            score += 5;
            // spawn small blood/gib or add to score
          } else {
            score += 1;
          }
          break;
        }
      }
    }

    // zombies colliding with player
    for (let i = zombies.length-1; i >= 0; i--){
      const z = zombies[i];
      if (player.x < z.x + z.w && player.x + player.w > z.x &&
          player.y < z.y + z.h && player.y + player.h > z.y){
        // damage player and bounce zombie back
        player.health -= 12;
        z.x += 40 * (z.vx < 0 ? 1 : -1);
        z.vx *= 0.6;
        if (player.health <= 0){
          gameOver();
        }
      }
      // remove zombies off left edge
      if (z.x + z.w < -120) zombies.splice(i,1);
    }

    scoreEl.textContent = 'Score: ' + Math.floor(score);
    healthEl.textContent = 'Health: ' + Math.max(0, Math.floor(player.health));
  }

  function gameOver(){
    overlay.classList.remove('hidden');
    overlayTitle.textContent = 'You died';
    overlayScore.textContent = 'Score: ' + Math.floor(score);
  }

  function draw(){
    // clear
    ctx.fillStyle = '#071427';
    ctx.fillRect(0,0,RES_W,RES_H);

    // background parallax-ish
    ctx.fillStyle = '#08202a';
    ctx.fillRect(0, RES_H - 120, RES_W, 120);

    // platforms
    for (let p of platforms) p.draw(ctx);

    // bullets
    for (let b of bullets){
      ctx.beginPath();
      ctx.fillStyle = '#ffd86b';
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();
      // glow
      ctx.fillStyle = 'rgba(255,216,107,0.12)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r*2.8, 0, Math.PI*2);
      ctx.fill();
    }

    // zombies
    for (let z of zombies) z.draw(ctx);

    // player
    player.draw(ctx);

    // overlays: crosshair
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.moveTo(mouse.x-8, mouse.y);
    ctx.lineTo(mouse.x+8, mouse.y);
    ctx.moveTo(mouse.x, mouse.y-8);
    ctx.lineTo(mouse.x, mouse.y+8);
    ctx.stroke();
  }

  function loop(){
    const t = now();
    const dt = Math.min(1/30, (t - lastTime)/1000);
    lastTime = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // initial setup
  buildLevel();
  lastTime = now();
  requestAnimationFrame(loop);

  // restart button
  btnRestart.addEventListener('click', () => {
    resetGame();
  });

  // quick touch controls / mobile: tap to fire, swipe left-right to move
  let touchStartX = null;
  canvas.addEventListener('touchstart', e => {
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    mouse.x = (t.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (t.clientY - r.top) * (canvas.height / r.height);
    mouse.down = true;
    touchStartX = t.clientX;
    e.preventDefault();
  }, {passive:false});
  canvas.addEventListener('touchmove', e => {
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    mouse.x = (t.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (t.clientY - r.top) * (canvas.height / r.height);
    e.preventDefault();
  }, {passive:false});
  canvas.addEventListener('touchend', e => {
    mouse.down = false;
    touchStartX = null;
    e.preventDefault();
  }, {passive:false});

})();
