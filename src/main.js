import * as THREE from 'three';
import { EngineRenderer } from './engine/Renderer.js';
import { Input } from './engine/Input.js';
import { sound } from './engine/Audio.js';
import { Arena } from './world/Arena.js';
import { PickupManager, PICKUP_TYPES } from './world/Pickups.js';
import { Player } from './entities/Player.js';
import { WeaponSystem } from './entities/Weapons.js';
import { ProjectileManager } from './entities/Projectile.js';
import { Enemy, ENEMY_TYPES } from './entities/Enemy.js';
import { ParticleSystem } from './fx/ParticleSystem.js';
import { FloatingTextManager } from './fx/FloatingText.js';
import { HUD } from './ui/HUD.js';
import { Minimap } from './ui/Minimap.js';

class Game {
  constructor() {
    this.container = document.getElementById('game-container');
    this.radarCanvas = document.getElementById('radar-canvas');

    // 1. Initialize Engine & Systems
    this.renderer = new EngineRenderer(this.container);
    this.input = new Input(this.renderer.renderer.domElement);
    this.hud = new HUD();
    this.minimap = new Minimap(this.radarCanvas);
    this.particles = new ParticleSystem(this.renderer.scene);
    this.floatingText = new FloatingTextManager(
      document.getElementById('damage-text-container'),
      this.renderer.camera
    );

    // 2. World Entities
    this.arena = new Arena(this.renderer.scene);
    this.pickupManager = new PickupManager(this.renderer.scene);
    this.projectileManager = new ProjectileManager(this.renderer.scene);
    this.player = new Player(this.renderer.camera, this.arena, sound);
    this.weapons = new WeaponSystem(this.renderer.camera, this.renderer.scene);

    // 3. Game Progression State
    this.gameState = 'MENU'; // 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
    this.wave = 1;
    this.score = 0;
    this.totalKills = 0;
    this.highScore = parseInt(localStorage.getItem('cyberstrike_high_score') || '0', 10);

    this.enemies = [];
    this.waveEnemiesToSpawn = 0;
    this.spawnTimer = 0;
    this.isWaveIntermission = false;
    this.intermissionTimer = 0;

    // Killstreak tracking
    this.streakCount = 0;
    this.streakTimer = 0;

    // Mouse shooting state
    this.wasMouseDown = false;

    // Setup Event Listeners & UI Buttons
    this.setupEvents();

    // Start Master Clock & Loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  setupEvents() {
    // Start button
    document.getElementById('btn-start').addEventListener('click', () => {
      sound.init();
      this.startGame();
    });

    // Resume button
    document.getElementById('btn-resume').addEventListener('click', () => {
      this.resumeGame();
    });

    // Restart from pause
    document.getElementById('btn-restart-pause').addEventListener('click', () => {
      this.hud.showPauseScreen(false);
      this.startGame();
    });

    // Restart from game over
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.hud.showGameOver(false);
      this.startGame();
    });

    // Pointer Lock events
    this.input.onLockChange = (isLocked) => {
      if (this.gameState === 'PLAYING' && !isLocked) {
        this.pauseGame();
      }
    };

    // Keyboard bindings from Input
    this.input.onWeaponSelect = (index) => {
      if (this.gameState === 'PLAYING') {
        this.weapons.selectWeapon(index);
        sound.playMechanicalClick();
      }
    };

    this.input.onWeaponCycle = (dir) => {
      if (this.gameState === 'PLAYING') {
        this.weapons.cycleWeapon(dir);
        sound.playMechanicalClick();
      }
    };

    this.input.onReloadPress = () => {
      if (this.gameState === 'PLAYING') {
        if (this.weapons.startReload()) {
          sound.playMechanicalClick();
        }
      }
    };

    this.input.onPausePress = () => {
      if (this.gameState === 'PLAYING') {
        this.pauseGame();
      } else if (this.gameState === 'PAUSED') {
        this.resumeGame();
      }
    };

    // Settings
    const sensSlider = document.getElementById('sens-slider');
    const sensValue = document.getElementById('sens-value');
    sensSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.input.sensitivity = val;
      sensValue.textContent = val.toFixed(1);
    });

    const volSlider = document.getElementById('volume-slider');
    const volValue = document.getElementById('volume-value');
    volSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      sound.setVolume(val / 100);
      volValue.textContent = `${val}%`;
    });

    const invertYBox = document.getElementById('invert-y-checkbox');
    if (invertYBox) {
      invertYBox.addEventListener('change', (e) => {
        this.player.invertY = e.target.checked;
      });
    }

    // Weapon slot clicks
    [1, 2, 3].forEach(slotNum => {
      const el = document.getElementById(`slot-${slotNum}`);
      if (el) {
        el.addEventListener('click', () => {
          if (this.gameState === 'PLAYING') {
            this.weapons.selectWeapon(slotNum - 1);
            sound.playMechanicalClick();
          }
        });
      }
    });
  }

  startGame() {
    this.gameState = 'PLAYING';
    this.wave = 1;
    this.score = 0;
    this.totalKills = 0;
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
    this.pickupManager.clear();
    this.projectileManager.clear();
    this.floatingText.clear();

    this.player.reset();
    this.weapons.selectWeapon(0, true);

    this.hud.showStartScreen(false);
    this.hud.showPauseScreen(false);
    this.hud.showGameOver(false);
    this.hud.showHUD(true);

    this.input.requestLock();
    this.startWave(1);
  }

  pauseGame() {
    if (this.gameState !== 'PLAYING') return;
    this.gameState = 'PAUSED';
    this.hud.showPauseScreen(true);
    this.input.exitLock();
  }

  resumeGame() {
    if (this.gameState !== 'PAUSED') return;
    this.gameState = 'PLAYING';
    this.hud.showPauseScreen(false);
    this.input.requestLock();
  }

  gameOver() {
    this.gameState = 'GAMEOVER';
    this.input.exitLock();
    this.hud.showHUD(false);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('cyberstrike_high_score', this.highScore.toString());
    }

    this.hud.showGameOver(true, {
      wave: this.wave,
      kills: this.totalKills,
      score: this.score,
      highScore: this.highScore
    });
  }

  startWave(waveNum) {
    this.wave = waveNum;
    this.isWaveIntermission = false;

    // Calculate wave composition
    if (waveNum === 1) {
      this.waveDroneCount = 5;
      this.waveStalkerCount = 0;
      this.waveTitanCount = 0;
    } else if (waveNum === 2) {
      this.waveDroneCount = 6;
      this.waveStalkerCount = 4;
      this.waveTitanCount = 0;
    } else if (waveNum === 3) {
      this.waveDroneCount = 5;
      this.waveStalkerCount = 8;
      this.waveTitanCount = 0;
    } else if (waveNum === 4) {
      // Boss Wave!
      this.waveDroneCount = 6;
      this.waveStalkerCount = 2;
      this.waveTitanCount = 1;
    } else {
      // Escalating endless waves
      this.waveDroneCount = 6 + (waveNum - 4) * 2;
      this.waveStalkerCount = 6 + (waveNum - 4) * 3;
      this.waveTitanCount = Math.floor(waveNum / 3);
    }

    this.waveEnemiesToSpawn = this.waveDroneCount + this.waveStalkerCount + this.waveTitanCount;

    // Sound and announcement
    sound.playWaveStart();
    if (this.waveTitanCount > 0) {
      this.hud.showAnnouncement(`第 ${waveNum} 波 - 警报!`, '检测到重装泰坦机甲降临战场!', 'neon-red');
    } else {
      this.hud.showAnnouncement(`第 ${waveNum} 波`, '清除所有侵入机械部队', 'neon-cyan');
    }

    // Spawn a guaranteed tactical crate in the arena for each wave
    const spawnPoints = [
      new THREE.Vector3(0, 1.2, 10),
      new THREE.Vector3(0, 1.2, -10),
      new THREE.Vector3(15, 1.2, 0),
      new THREE.Vector3(-15, 1.2, 0)
    ];
    const randPos = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    const types = ['HEALTH', 'SHIELD', 'AMMO', 'OVERDRIVE'];
    this.pickupManager.spawn(types[Math.floor(Math.random() * types.length)], randPos);
  }

  spawnEnemy() {
    let typeKey = 'DRONE';
    if (this.waveTitanCount > 0) {
      typeKey = 'TITAN';
      this.waveTitanCount--;
    } else if (this.waveStalkerCount > 0) {
      typeKey = 'STALKER';
      this.waveStalkerCount--;
    } else if (this.waveDroneCount > 0) {
      typeKey = 'DRONE';
      this.waveDroneCount--;
    } else {
      return;
    }

    // Spawn location around outer perimeter away from player
    const angle = Math.random() * Math.PI * 2;
    const dist = 32 + Math.random() * 12;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const spawnPos = new THREE.Vector3(x, 0.5, z);

    const enemy = new Enemy(this.renderer.scene, typeKey, spawnPos);
    this.enemies.push(enemy);

    // Neon spawn beam
    this.particles.createSparks(spawnPos, new THREE.Vector3(0, 1, 0), 0x00f3ff, 15);
  }

  handleShooting(dt) {
    const isMouseDown = this.input.isMouseDown(0);
    const isRightDown = this.input.isMouseDown(2);
    const wp = this.weapons.getCurrentWeapon();

    // Wheel weapon cycling
    const { wheel } = this.input.getAndResetDeltas();
    if (wheel !== 0) {
      this.weapons.cycleWeapon(wheel > 0 ? 1 : -1);
      sound.playMechanicalClick();
    }

    // Check if player wants to shoot
    const wantsToFire = wp.isAutomatic ? isMouseDown : (isMouseDown && !this.wasMouseDown);
    this.wasMouseDown = isMouseDown;

    const now = performance.now() / 1000;
    const fireInterval = this.player.hasOverdrive ? wp.fireRate * 0.6 : wp.fireRate;

    if (wantsToFire && now - wp.lastFireTime >= fireInterval) {
      if (wp.isReloading) {
        // Can't fire while reloading
        return;
      }

      if (wp.currentAmmo <= 0) {
        // Out of ammo! Auto reload
        this.weapons.startReload();
        sound.playMechanicalClick();
        return;
      }

      // Fire weapon!
      wp.currentAmmo--;
      wp.lastFireTime = now;
      this.weapons.triggerRecoil();
      this.player.addCameraShake(wp.id === 'railgun' ? 0.35 : (wp.id === 'shotgun' ? 0.25 : 0.1));
      this.hud.triggerCrosshairBloom();

      // Camera forward direction
      const cameraDir = new THREE.Vector3();
      this.renderer.camera.getWorldDirection(cameraDir);
      const muzzlePos = this.weapons.getMuzzleWorldPosition();

      // Muzzle spark
      this.particles.createMuzzleFlash(muzzlePos, wp.colorHex);

      const finalDamage = this.player.hasOverdrive ? wp.damage * 2.0 : wp.damage;

      if (wp.id === 'plasma') {
        sound.playPlasmaShot();
        this.projectileManager.spawnPlayerProjectile(
          muzzlePos,
          cameraDir,
          wp.projectileSpeed,
          finalDamage,
          wp.colorHex,
          false
        );
      } else if (wp.id === 'shotgun') {
        sound.playShotgunShot();
        for (let i = 0; i < wp.pellets; i++) {
          const spreadDir = cameraDir.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * wp.spread,
            (Math.random() - 0.5) * wp.spread,
            (Math.random() - 0.5) * wp.spread
          )).normalize();

          this.projectileManager.spawnPlayerProjectile(
            muzzlePos,
            spreadDir,
            wp.projectileSpeed,
            finalDamage,
            wp.colorHex,
            true
          );
        }
      } else if (wp.id === 'railgun') {
        sound.playRailgunShot();

        // Hitscan raycast forward
        const raycaster = new THREE.Raycaster(this.renderer.camera.position, cameraDir, 0.1, 200);
        let endPoint = this.renderer.camera.position.clone().add(cameraDir.clone().multiplyScalar(150));
        let closestHitDist = 150;
        let hitEnemyTarget = null;
        let isCritHit = false;

        // Check enemies
        for (const enemy of this.enemies) {
          if (enemy.isDead) continue;
          const eCenter = enemy.getCenter();
          // Ray sphere test
          const ray = raycaster.ray;
          const targetToRay = eCenter.clone().sub(ray.origin);
          const projection = targetToRay.dot(ray.direction);
          if (projection > 0) {
            const closestPt = ray.origin.clone().add(ray.direction.clone().multiplyScalar(projection));
            const dist = closestPt.distanceTo(eCenter);
            if (dist <= enemy.radius + 0.25 && projection < closestHitDist) {
              closestHitDist = projection;
              endPoint = closestPt;
              hitEnemyTarget = enemy;
              isCritHit = (closestPt.y - enemy.position.y) > enemy.height * 0.7;
            }
          }
        }

        if (hitEnemyTarget) {
          const hitDmg = isCritHit ? finalDamage * 2.0 : finalDamage;
          hitEnemyTarget.takeDamage(hitDmg);
          this.floatingText.showDamage(endPoint, hitDmg, isCritHit);
          this.particles.createSparks(endPoint, cameraDir.clone().negate(), 0xff0077, 20);
          sound.playHitmarker(isCritHit);
          this.hud.triggerHitmarker(isCritHit);
        }

        this.projectileManager.spawnRailgunBeam(muzzlePos, endPoint, wp.colorHex);
      }
    }
  }

  handleKill(enemy) {
    this.totalKills++;
    this.score += enemy.typeDef.score;
    this.streakCount++;
    this.streakTimer = 4.0; // 4 seconds killstreak window

    // Killstreak announcement
    if (this.streakCount === 2) {
      this.hud.showAnnouncement('双杀! (DOUBLE KILL)', '+100 连杀奖励', 'neon-cyan');
      this.score += 100;
    } else if (this.streakCount === 3) {
      this.hud.showAnnouncement('大杀特杀! (TRIPLE KILL)', '+250 连杀奖励', 'neon-orange');
      this.score += 250;
    } else if (this.streakCount === 4) {
      this.hud.showAnnouncement('势不可挡! (RAMPAGE)', '+400 连杀奖励', 'neon-red');
      this.score += 400;
    } else if (this.streakCount >= 5) {
      this.hud.showAnnouncement('超神歼灭! (UNSTOPPABLE)', '+600 连杀奖励', 'neon-yellow');
      this.score += 600;
    }

    // Explosion visual and sound
    this.particles.createExplosion(enemy.getCenter(), enemy.typeDef.isBoss);
    sound.playExplosion(enemy.typeDef.isBoss);

    // 40% chance of tactical drop
    if (Math.random() < 0.45 || enemy.typeDef.isBoss) {
      const keys = ['HEALTH', 'SHIELD', 'AMMO', 'OVERDRIVE'];
      const chosen = enemy.typeDef.isBoss ? 'OVERDRIVE' : keys[Math.floor(Math.random() * keys.length)];
      this.pickupManager.spawn(chosen, enemy.position);
    }
  }

  update(dt) {
    // 1. Particle & Floating Text always update
    this.particles.update(dt);
    this.floatingText.update(dt);
    this.arena.update(dt);

    if (this.gameState !== 'PLAYING') {
      // Menu slow pan
      if (this.gameState === 'MENU') {
        this.renderer.camera.position.set(
          Math.sin(Date.now() * 0.0004) * 20,
          10,
          Math.cos(Date.now() * 0.0004) * 20
        );
        this.renderer.camera.lookAt(0, 3, 0);
      }
      return;
    }

    // 2. Kill streak countdown
    if (this.streakTimer > 0) {
      this.streakTimer -= dt;
      if (this.streakTimer <= 0) {
        this.streakCount = 0;
      }
    }

    // 3. Player Updates
    const wp = this.weapons.getCurrentWeapon();
    const isADS = this.input.isMouseDown(2);
    const { isMoving, isSprinting } = this.player.update(dt, this.input, wp.adsFov, isADS);

    // 4. Weapons Update
    const mouseDelta = this.input.getAndResetDeltas();
    this.weapons.update(dt, mouseDelta, isMoving, isSprinting, isADS);
    this.handleShooting(dt);

    // 5. Wave Spawner
    if (this.waveEnemiesToSpawn > 0) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= 0.8) {
        this.spawnTimer = 0;
        this.spawnEnemy();
        this.waveEnemiesToSpawn--;
      }
    }

    // 6. Enemies Update
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(
        dt,
        this.player.position,
        this.arena,
        this.projectileManager,
        sound,
        (damage, pos) => {
          // Melee attack on player
          this.player.takeDamage(damage, pos);
          this.hud.triggerDamageVignette();
        }
      );

      if (enemy.isDead) {
        this.handleKill(enemy);
        enemy.destroy();
        this.enemies.splice(i, 1);
      }
    }

    // 7. Wave Clear Check
    const activeEnemiesCount = this.enemies.length + this.waveEnemiesToSpawn;
    if (activeEnemiesCount === 0 && !this.isWaveIntermission) {
      this.isWaveIntermission = true;
      this.intermissionTimer = 3.5;
      sound.playPickup();
      this.hud.showAnnouncement('区域肃清完成!', `第 ${this.wave} 波防御成功`, 'neon-green');
      this.score += this.wave * 300;
    }

    if (this.isWaveIntermission) {
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0) {
        this.startWave(this.wave + 1);
      }
    }

    // 8. Projectiles Update
    this.projectileManager.update(
      dt,
      this.arena,
      this.enemies,
      this.player,
      this.particles,
      this.floatingText,
      sound,
      (damage, pos) => {
        this.player.takeDamage(damage, pos);
        this.hud.triggerDamageVignette();
      }
    );

    // 9. Tactical Pickups Update
    this.pickupManager.update(dt, this.player.position, (typeKey, typeDef) => {
      sound.playPickup();
      if (typeKey === 'HEALTH') {
        this.player.heal(typeDef.value);
        this.floatingText.showDamage(this.player.position, typeDef.value, false);
      } else if (typeKey === 'SHIELD') {
        this.player.addShield(typeDef.value);
      } else if (typeKey === 'AMMO') {
        const curWp = this.weapons.getCurrentWeapon();
        curWp.currentAmmo = curWp.magSize;
      } else if (typeKey === 'OVERDRIVE') {
        this.player.activateOverdrive(typeDef.duration);
        this.hud.showAnnouncement('★ 过载超频模式 ★', '攻击力翻倍，射速极度提升!', 'neon-yellow');
      }
    });

    // 10. Check Player Death
    if (this.player.health <= 0) {
      this.gameOver();
      return;
    }

    // 11. HUD Updates
    this.hud.updatePlayerVitals(this.player);
    this.hud.updateWeapon(wp, this.weapons.currentIndex, isADS);
    this.hud.updateWaveAndScore(this.wave, this.score, activeEnemiesCount);

    // 12. Tactical Radar Minimap
    this.minimap.render(this.player, this.enemies, this.pickupManager.pickups, this.arena.jumpPads);
  }

  loop(currentTime) {
    requestAnimationFrame((t) => this.loop(t));

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.update(dt);
    this.renderer.render();
  }
}

// Instantiate game on page load
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
