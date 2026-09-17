import * as THREE from 'three';
import { EngineRenderer } from './engine/Renderer.js';
import { Input } from './engine/Input.js';
import { sound } from './engine/Audio.js';
import { Arena } from './world/Arena.js';
import { PickupManager } from './world/Pickups.js';
import { Player } from './entities/Player.js';
import { WeaponSystem } from './entities/Weapons.js';
import { ProjectileManager } from './entities/Projectile.js';
import { Enemy } from './entities/Enemy.js';
import { ParticleSystem } from './fx/ParticleSystem.js';
import { FloatingTextManager } from './fx/FloatingText.js';
import { HUD } from './ui/HUD.js';
import { Minimap } from './ui/Minimap.js';
import { NetworkManager } from './network/NetworkManager.js';
import { RemotePlayer } from './entities/RemotePlayer.js';

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

    // 3. Network & Multiplayer System
    this.gameMode = 'MULTIPLAYER'; // 'SOLO' | 'MULTIPLAYER'
    this.network = new NetworkManager();
    this.remotePlayers = new Map(); // peerId -> RemotePlayer
    this.playerScores = new Map();  // peerId -> { kills, deaths, score }
    this.mpKills = 0;
    this.mpDeaths = 0;
    this.mpScore = 0;
    this.isRespawning = false;
    this.respawnTimer = 0;
    this.respawnKillerName = '';

    // Player Customization
    this.selectedColor = '#ff69b4';
    this.playerName = localStorage.getItem('cyberstrike_player_name') || '甜心萌喵_' + Math.floor(Math.random() * 900 + 100);

    // 4. Game Progression State (Solo)
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

    // Setup Event Listeners & Networking
    this.setupEvents();
    this.setupNetwork();

    // Start Master Clock & Loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  setupEvents() {
    // 1. Player Profile Inputs
    const nameInput = document.getElementById('player-nickname');
    if (nameInput) {
      nameInput.value = this.playerName;
      nameInput.addEventListener('input', (e) => {
        this.playerName = e.target.value.trim() || '甜心萌喵';
        localStorage.setItem('cyberstrike_player_name', this.playerName);
      });
    }

    const colorDots = document.querySelectorAll('#color-options .color-dot');
    colorDots.forEach((dot) => {
      dot.addEventListener('click', () => {
        colorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.selectedColor = dot.getAttribute('data-color') || '#ff69b4';
      });
    });

    // 2. Lobby Tabs Switcher
    const tabBtnMp = document.getElementById('tab-btn-mp');
    const tabBtnSolo = document.getElementById('tab-btn-solo');
    const tabContentMp = document.getElementById('tab-mp');
    const tabContentSolo = document.getElementById('tab-solo');

    if (tabBtnMp && tabBtnSolo) {
      tabBtnMp.addEventListener('click', () => {
        tabBtnMp.classList.add('active');
        tabBtnSolo.classList.remove('active');
        tabContentMp.classList.remove('hidden');
        tabContentSolo.classList.add('hidden');
      });

      tabBtnSolo.addEventListener('click', () => {
        tabBtnSolo.classList.add('active');
        tabBtnMp.classList.remove('active');
        tabContentSolo.classList.remove('hidden');
        tabContentMp.classList.add('hidden');
      });
    }

    // 3. Multiplayer Action Buttons
    const btnCreateRoom = document.getElementById('btn-create-room');
    if (btnCreateRoom) {
      btnCreateRoom.addEventListener('click', () => {
        sound.init();
        this.startMultiplayer('CREATE');
      });
    }

    const btnJoinRoom = document.getElementById('btn-join-room');
    const inputRoomCode = document.getElementById('input-room-code');
    if (btnJoinRoom && inputRoomCode) {
      const handleJoin = () => {
        const code = inputRoomCode.value.trim();
        if (!code) {
          this.hud.showToast('请输入房间码');
          return;
        }
        sound.init();
        this.startMultiplayer('JOIN', code);
      };
      btnJoinRoom.addEventListener('click', handleJoin);
      inputRoomCode.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleJoin();
      });
    }

    const btnQuickMatch = document.getElementById('btn-quick-match');
    if (btnQuickMatch) {
      btnQuickMatch.addEventListener('click', () => {
        sound.init();
        this.startMultiplayer('QUICK');
      });
    }

    const btnRefreshRooms = document.getElementById('btn-refresh-rooms');
    if (btnRefreshRooms) {
      btnRefreshRooms.addEventListener('click', () => {
        this.network.requestRoomList();
      });
    }

    // 3.1 信令通道诊断与设置弹窗交互
    const btnDiagnose = document.getElementById('btn-signal-diagnose');
    const signalModal = document.getElementById('signal-modal');
    const btnSignalClose = document.getElementById('btn-signal-close');
    const btnSignalRetry = document.getElementById('btn-signal-retry');
    const signalModeCards = document.querySelectorAll('.signal-mode-card');

    if (btnDiagnose && signalModal) {
      btnDiagnose.addEventListener('click', () => {
        signalModal.classList.remove('hidden');
      });
    }

    if (btnSignalClose && signalModal) {
      btnSignalClose.addEventListener('click', () => {
        signalModal.classList.add('hidden');
      });
    }

    if (btnSignalRetry) {
      btnSignalRetry.addEventListener('click', () => {
        this.network.connectSignaling(this.network.mode).then(() => {
          this.network.requestRoomList();
          this.hud.showToast('信令通道已刷新');
        }).catch(() => {});
      });
    }

    signalModeCards.forEach(card => {
      card.addEventListener('click', () => {
        const mode = card.getAttribute('data-mode');
        if (!mode) return;
        signalModeCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;

        this.hud.showToast(`正在切换信令通道: ${mode}...`);
        this.network.switchSignalingMode(mode).then(() => {
          this.hud.showToast('信令通道切换成功！');
        }).catch(err => {
          this.hud.showToast(`信令切换异常: ${err.message}`);
        });
      });
    });

    // 4. Solo Mode Start Button
    const btnStartSolo = document.getElementById('btn-start');
    if (btnStartSolo) {
      btnStartSolo.addEventListener('click', () => {
        sound.init();
        this.startSoloGame();
      });
    }

    // 5. Room Code Badge Click to Copy
    const roomBadge = document.getElementById('mp-room-badge');
    if (roomBadge) {
      roomBadge.addEventListener('click', () => {
        if (!this.network.roomId) return;
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${this.network.roomId}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
          this.hud.showToast('已复制邀请链接！发给好友即可对战');
        }).catch(() => {
          this.hud.showToast(`房间码: ${this.network.roomId}`);
        });
      });
    }

    // 6. Pause & Game Over Controls
    document.getElementById('btn-resume').addEventListener('click', () => {
      this.resumeGame();
    });

    document.getElementById('btn-restart-pause').addEventListener('click', () => {
      this.hud.showPauseScreen(false);
      if (this.gameMode === 'MULTIPLAYER') {
        this.network.leaveRoom();
        this.showLobby();
      } else {
        this.startSoloGame();
      }
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      this.hud.showGameOver(false);
      if (this.gameMode === 'MULTIPLAYER') {
        this.network.leaveRoom();
        this.showLobby();
      } else {
        this.startSoloGame();
      }
    });

    // 7. Pointer Lock events & PC Click-to-lock
    this.input.onLockChange = (isLocked) => {
      if (this.gameState === 'PLAYING') {
        if (isLocked) {
          this.hud.showClickToLock(false);
        } else if (!this.input.isTouchDevice) {
          if (this.gameMode === 'SOLO') {
            this.pauseGame();
          } else {
            // 多人模式：鼠标解锁后展示温和的点击锁定提示，玩家随时点击画面无缝回归视角
            this.hud.showClickToLock(true);
          }
        }
      } else {
        this.hud.showClickToLock(false);
      }
    };

    // PC 画面点击重新锁定
    const clickLockOverlay = document.getElementById('click-to-lock-overlay');
    if (clickLockOverlay) {
      clickLockOverlay.addEventListener('click', () => {
        if (this.gameState === 'PLAYING' && !this.input.isTouchDevice) {
          this.input.requestLock();
        }
      });
    }

    window.addEventListener('click', (e) => {
      if (this.gameState === 'PLAYING' && !this.input.isLocked && !this.input.isTouchDevice) {
        if (!e.target.closest('#start-screen, #pause-screen, #gameover-screen, button, input, .clickable')) {
          this.input.requestLock();
        }
      }
    });

    // 8. 全屏沉浸模式切换 (支持 F11 快捷键或点击按钮)
    const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };

    const btnFsLobby = document.getElementById('btn-fullscreen-lobby');
    if (btnFsLobby) btnFsLobby.addEventListener('click', toggleFullscreen);

    const btnFsPause = document.getElementById('btn-fullscreen-pause');
    if (btnFsPause) btnFsPause.addEventListener('click', toggleFullscreen);

    // 9. Tab Scoreboard
    this.input.onScoreboardToggle = (show) => {
      if (this.gameMode === 'MULTIPLAYER' && this.gameState === 'PLAYING') {
        this.toggleScoreboard(show);
      }
    };

    // 10. Weapon Selection & Shortcuts
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

    this.weapons.onReloadComplete = () => {
      sound.playReloadComplete();
    };

    this.input.onPausePress = () => {
      if (this.gameState === 'PLAYING') {
        if (this.gameMode === 'SOLO') {
          this.pauseGame();
        } else {
          this.input.exitLock();
        }
      } else if (this.gameState === 'PAUSED') {
        this.resumeGame();
      }
    };

    // 11. Settings Sliders & LocalStorage 持久化
    const savedSens = localStorage.getItem('cyberstrike_sens');
    const sensSlider = document.getElementById('sens-slider');
    const sensValue = document.getElementById('sens-value');
    if (savedSens && sensSlider && sensValue) {
      const s = parseFloat(savedSens);
      this.input.sensitivity = s;
      sensSlider.value = s;
      sensValue.textContent = s.toFixed(1);
    } else if (sensSlider && sensValue) {
      sensSlider.value = this.input.sensitivity;
      sensValue.textContent = this.input.sensitivity.toFixed(1);
    }

    if (sensSlider) {
      sensSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.input.sensitivity = val;
        sensValue.textContent = val.toFixed(1);
        localStorage.setItem('cyberstrike_sens', val.toString());
      });
    }

    const savedVol = localStorage.getItem('cyberstrike_vol');
    const volSlider = document.getElementById('volume-slider');
    const volValue = document.getElementById('volume-value');
    if (savedVol && volSlider && volValue) {
      const v = parseInt(savedVol, 10);
      sound.setVolume(v / 100);
      volSlider.value = v;
      volValue.textContent = `${v}%`;
    }

    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        sound.setVolume(val / 100);
        volValue.textContent = `${val}%`;
        localStorage.setItem('cyberstrike_vol', val.toString());
      });
    }

    const savedInvertY = localStorage.getItem('cyberstrike_invert_y');
    const invertYBox = document.getElementById('invert-y-checkbox');
    if (savedInvertY !== null && invertYBox) {
      const inv = savedInvertY === 'true';
      this.player.invertY = inv;
      invertYBox.checked = inv;
    }
    if (invertYBox) {
      invertYBox.addEventListener('change', (e) => {
        this.player.invertY = e.target.checked;
        localStorage.setItem('cyberstrike_invert_y', e.target.checked.toString());
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

    // 11. Auto-detect room parameter from URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam && inputRoomCode) {
      inputRoomCode.value = roomParam.toUpperCase();
      this.hud.showToast(`检测到战局邀请码: ${roomParam.toUpperCase()}，点击加入即可开战！`);
    }

    // Auto-fetch room list on load
    setTimeout(() => {
      this.network.requestRoomList().catch(() => {});
    }, 1200);
  }

  setupNetwork() {
    const statusDot = document.getElementById('signal-status-dot');
    const statusText = document.getElementById('signal-status-text');

    this.network.onSignalingStatusChange = (status, label) => {
      if (statusDot && statusText) {
        statusDot.className = `signal-dot ${status === 'ready' || status === 'switched' ? 'ready' : (status === 'connecting' ? 'connecting' : 'offline')}`;
        statusText.textContent = `联机信令: ${label}`;
      }
    };

    this.network.onRoomJoined = (roomId, existingPeers) => {
      this.gameMode = 'MULTIPLAYER';
      this.hud.setMode(true);
      this.hud.updateMultiplayerStats(roomId, this.mpKills, this.mpDeaths, this.network.ping);
      this.hud.showToast(`已成功接入房间：${roomId}`);

      // Clear existing remote players
      for (const rp of this.remotePlayers.values()) {
        rp.destroy();
      }
      this.remotePlayers.clear();
      this.playerScores.clear();

      // Initialize remote players already in room
      for (const peer of existingPeers) {
        const rp = new RemotePlayer(peer.peerId, peer.name, peer.color, this.renderer.scene);
        this.remotePlayers.set(peer.peerId, rp);
        this.playerScores.set(peer.peerId, { kills: 0, deaths: 0, score: 0 });
      }

      this.enterGameSession();
    };

    this.network.onPeerJoined = (peer) => {
      if (this.remotePlayers.has(peer.peerId)) return;
      const rp = new RemotePlayer(peer.peerId, peer.name, peer.color, this.renderer.scene);
      this.remotePlayers.set(peer.peerId, rp);
      this.playerScores.set(peer.peerId, { kills: 0, deaths: 0, score: 0 });

      sound.playPickup();
      this.hud.showAnnouncement('🎀 新玩偶伙伴加入', `${peer.name} 已来到茶话会`, 'neon-pink');
      this.hud.addKillFeed('🎀 派对广播', `${peer.name} 踏入甜品战场`, 'ONLINE', '#ff69b4', peer.color);
    };

    this.network.onPeerLeft = (peerId) => {
      const rp = this.remotePlayers.get(peerId);
      const name = rp ? rp.name : '小可爱';
      if (rp) {
        rp.destroy();
        this.remotePlayers.delete(peerId);
      }
      this.playerScores.delete(peerId);
      this.hud.addKillFeed('🎀 派对广播', `${name} 回家喝下午茶啦`, 'OFFLINE', '#ff99c8', '#ff99c8');
    };

    this.network.onPeerStateUpdate = (peerId, state) => {
      const rp = this.remotePlayers.get(peerId);
      if (rp) {
        rp.applyNetworkState(state);
      }
    };

    this.network.onPeerShoot = (peerId, data) => {
      const rp = this.remotePlayers.get(peerId);
      const muzzlePos = new THREE.Vector3(data.pos[0], data.pos[1], data.pos[2]);
      const dir = new THREE.Vector3(data.dir[0], data.dir[1], data.dir[2]);

      if (rp) {
        this.particles.createMuzzleFlash(muzzlePos, new THREE.Color(rp.colorHex).getHex());
      }

      if (data.wId === 'plasma') {
        sound.playPlasmaShot();
        this.projectileManager.spawnPlayerProjectile(muzzlePos, dir, 75, 24, 0xff4081, false);
      } else if (data.wId === 'shotgun') {
        sound.playShotgunShot();
        for (let i = 0; i < 7; i++) {
          const spreadDir = dir.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.16,
            (Math.random() - 0.5) * 0.16,
            (Math.random() - 0.5) * 0.16
          )).normalize();
          this.projectileManager.spawnPlayerProjectile(muzzlePos, spreadDir, 85, 14, 0xffaa00, true);
        }
      } else if (data.wId === 'railgun') {
        sound.playRailgunShot();
        const endPos = muzzlePos.clone().add(dir.clone().multiplyScalar(150));
        this.projectileManager.spawnRailgunBeam(muzzlePos, endPos, 0xff1493);
      }
    };

    this.network.onPeerHit = (msg) => {
      // If local player is hit by someone else
      if (msg.target === this.network.localPeerId) {
        if (this.isRespawning) return;

        this.player.takeDamage(msg.dmg);
        this.hud.triggerDamageVignette();
        sound.playHitmarker(msg.crit === 1);

        const hitPos = new THREE.Vector3(msg.pos[0], msg.pos[1], msg.pos[2]);
        this.floatingText.showDamage(hitPos, msg.dmg, msg.crit === 1);
        this.particles.createSparks(hitPos, new THREE.Vector3(0, 1, 0), 0xff4081, 15);

        if (this.player.health <= 0) {
          this.handleLocalPlayerDeath(msg.attacker, 'plasma');
        }
      } else {
        // Another peer was hit, show damage text on their model
        const victim = this.remotePlayers.get(msg.target);
        if (victim) {
          victim.takeDamage(msg.dmg);
          const hitPos = new THREE.Vector3(msg.pos[0], msg.pos[1], msg.pos[2]);
          this.floatingText.showDamage(hitPos, msg.dmg, msg.crit === 1);
          this.particles.createSparks(hitPos, new THREE.Vector3(0, 1, 0), 0xff4081, 12);
        }
      }
    };

    this.network.onPeerKill = (msg) => {
      const killerIsLocal = msg.killer === this.network.localPeerId;
      const victimIsLocal = msg.victim === this.network.localPeerId;

      let killerName = killerIsLocal ? this.playerName : '甜心玩偶';
      let killerColor = killerIsLocal ? this.selectedColor : '#ff69b4';
      let victimName = victimIsLocal ? this.playerName : '甜心玩偶';
      let victimColor = victimIsLocal ? this.selectedColor : '#ff85a2';

      if (!killerIsLocal) {
        const kp = this.remotePlayers.get(msg.killer);
        if (kp) {
          killerName = kp.name;
          killerColor = kp.colorHex;
        }
      }

      if (!victimIsLocal) {
        const vp = this.remotePlayers.get(msg.victim);
        if (vp) {
          victimName = vp.name;
          victimColor = vp.colorHex;
          vp.die();
          this.particles.createExplosion(vp.getCenter(), false);
          sound.playExplosion(false);
        }
      }

      // Update scores
      if (killerIsLocal) {
        this.mpKills++;
        this.mpScore += 100;
        this.streakCount++;
        this.streakTimer = 5.0;

        sound.playHitmarker(true);
        if (this.streakCount === 2) this.hud.showAnnouncement('💖 甜蜜双击! (DOUBLE SWEET)', '+100 甜度奖励', 'neon-pink');
        else if (this.streakCount === 3) this.hud.showAnnouncement('🍰 可爱超标! (KAWAII OVERLOAD)', '+250 甜度奖励', 'neon-orange');
        else if (this.streakCount >= 4) this.hud.showAnnouncement('👑 全场最萌小仙女! (CUTEST QUEEN)', '+400 甜度奖励', 'neon-yellow');
        else this.hud.showAnnouncement('💖 萌心击中!', `你送出满满爱心给 [${victimName}]`, 'neon-pink');
      } else {
        const score = this.playerScores.get(msg.killer) || { kills: 0, deaths: 0, score: 0 };
        score.kills++;
        score.score += 100;
        this.playerScores.set(msg.killer, score);
      }

      if (victimIsLocal) {
        this.mpDeaths++;
      } else {
        const score = this.playerScores.get(msg.victim) || { kills: 0, deaths: 0, score: 0 };
        score.deaths++;
        this.playerScores.set(msg.victim, score);
      }

      // Add to HUD Kill Feed
      const weaponNames = {
        plasma: '🍓 草莓喵喵枪',
        shotgun: '🍬 彩虹波波糖果枪',
        railgun: '✨ 星愿爱心魔杖炮'
      };
      this.hud.addKillFeed(killerName, victimName, weaponNames[msg.wId] || '🎀 萌心玩具', killerColor, victimColor);
    };

    this.network.onPeerRespawn = (peerId, data) => {
      const rp = this.remotePlayers.get(peerId);
      if (rp) {
        rp.respawn(new THREE.Vector3(data.pos[0], data.pos[1], data.pos[2]));
        this.particles.createMuzzleFlash(rp.getCenter(), 0xff69b4);
      }
    };

    this.network.onRoomListReceived = (rooms) => {
      this.renderPublicRoomsList(rooms);
    };

    this.network.onError = (errorMsg) => {
      this.hud.showToast(errorMsg);
    };
  }

  renderPublicRoomsList(rooms) {
    const container = document.getElementById('rooms-list-container');
    if (!container) return;

    if (!rooms || rooms.length === 0) {
      container.innerHTML = `<div class="lobby-empty-hint">当前暂无开放对局，点击上方“创建对局”即可开启新战场！</div>`;
      return;
    }

    container.innerHTML = rooms.map(r => `
      <div class="room-row-item">
        <div class="room-info-meta">
          <span class="room-badge">${r.roomId}</span>
          <span class="room-host">房主: ${r.hostName}</span>
          <span class="room-count">(${r.playerCount}/${r.maxPlayers}人)</span>
        </div>
        <button class="cyber-btn success small btn-join-quick" data-room="${r.roomId}">快速进入</button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-join-quick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rId = e.target.getAttribute('data-room');
        if (rId) {
          sound.init();
          this.startMultiplayer('JOIN', rId);
        }
      });
    });
  }

  startMultiplayer(action, targetRoomId = '') {
    this.gameMode = 'MULTIPLAYER';
    this.mpKills = 0;
    this.mpDeaths = 0;
    this.mpScore = 0;
    this.isRespawning = false;

    if (action === 'CREATE') {
      this.hud.showToast('正在创建茶话会房间...');
      this.network.createRoom(null, this.playerName, this.selectedColor).catch(err => {
        this.hud.showToast(`创建房间失败: ${err.message}`);
      });
    } else if (action === 'JOIN') {
      this.hud.showToast(`正在接入房间 ${targetRoomId}...`);
      this.network.joinRoom(targetRoomId, this.playerName, this.selectedColor).catch(err => {
        this.hud.showToast(`加入房间失败: ${err.message}`);
      });
    } else if (action === 'QUICK') {
      this.hud.showToast('正在为您快速搜寻对局...');
      this.network.quickMatch(this.playerName, this.selectedColor).catch(err => {
        this.hud.showToast(`快速对战失败: ${err.message}`);
      });
    }
  }

  startSoloGame() {
    this.gameMode = 'SOLO';
    this.wave = 1;
    this.score = 0;
    this.totalKills = 0;

    this.hud.setMode(false);
    this.enterGameSession();
    this.startWave(1);
  }

  enterGameSession() {
    this.gameState = 'PLAYING';

    // Clear enemies and pickups
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
    this.pickupManager.clear();
    this.projectileManager.clear();
    this.floatingText.clear();

    // Reset player position & vitals
    this.player.reset();
    const spawnPt = this.getRandomSpawnPoint();
    this.player.position.copy(spawnPt);
    this.renderer.camera.position.copy(spawnPt);

    this.weapons.selectWeapon(0, true);

    this.hud.showStartScreen(false);
    this.hud.showPauseScreen(false);
    this.hud.showGameOver(false);
    this.hud.showHUD(true);

    sound.startKawaiiBgm();
    this.input.requestLock();
    if (!this.input.isLocked && !this.input.isTouchDevice) {
      this.hud.showClickToLock(true);
    }
  }

  showLobby() {
    this.gameState = 'MENU';
    sound.stopKawaiiBgm();
    this.hud.showClickToLock(false);
    this.hud.showHUD(false);
    this.hud.showStartScreen(true);
    this.input.exitLock();
  }

  getRandomSpawnPoint() {
    const spawns = [
      new THREE.Vector3(-32, 2, -32),
      new THREE.Vector3(32, 2, -32),
      new THREE.Vector3(-32, 2, 32),
      new THREE.Vector3(32, 2, 32),
      new THREE.Vector3(0, 2, -42),
      new THREE.Vector3(0, 2, 42),
      new THREE.Vector3(-42, 2, 0),
      new THREE.Vector3(42, 2, 0)
    ];
    return spawns[Math.floor(Math.random() * spawns.length)].clone();
  }

  handleLocalPlayerDeath(killerPeerId, weaponId) {
    if (this.isRespawning) return;

    this.isRespawning = true;
    this.respawnTimer = 3.2;

    let killerName = '调皮小可爱';
    const kp = this.remotePlayers.get(killerPeerId);
    if (kp) killerName = kp.name;
    this.respawnKillerName = killerName;

    sound.playExplosion(false);
    this.particles.createExplosion(this.player.getCenter(), false);

    // Broadcast kill event
    this.network.broadcastKill(this.network.localPeerId, killerPeerId, weaponId);

    // Show respawn countdown overlay
    this.hud.showRespawnCountdown(killerName, Math.ceil(this.respawnTimer));
  }

  respawnLocalPlayer() {
    this.isRespawning = false;
    this.player.reset();
    const spawnPt = this.getRandomSpawnPoint();
    this.player.position.copy(spawnPt);
    this.renderer.camera.position.copy(spawnPt);

    this.hud.hideRespawnCountdown();
    this.hud.showToast('✨ 魔法爱心已充盈！获得 2 秒草莓护盾');

    // Broadcast respawn
    this.network.broadcastRespawn(spawnPt);

    // Overdrive temporary boost
    this.player.activateOverdrive(2.0);
  }

  toggleScoreboard(show) {
    if (!show) {
      this.hud.showScoreboard(false);
      return;
    }

    const playerList = [];

    // Local player entry
    playerList.push({
      name: this.playerName,
      color: this.selectedColor,
      kills: this.mpKills,
      deaths: this.mpDeaths,
      score: this.mpScore,
      ping: this.network.ping,
      isLocal: true
    });

    // Remote players
    for (const [peerId, rp] of this.remotePlayers.entries()) {
      const stats = this.playerScores.get(peerId) || { kills: 0, deaths: 0, score: 0 };
      playerList.push({
        name: rp.name,
        color: rp.colorHex,
        kills: stats.kills,
        deaths: stats.deaths,
        score: stats.score,
        ping: null,
        isLocal: false
      });
    }

    this.hud.showScoreboard(true, playerList, this.network.roomId);
  }

  pauseGame() {
    if (this.gameState !== 'PLAYING') return;
    this.gameState = 'PAUSED';
    this.hud.showClickToLock(false);
    this.hud.showPauseScreen(true);
    this.input.exitLock();
  }

  resumeGame() {
    if (this.gameState !== 'PAUSED') return;
    this.gameState = 'PLAYING';
    this.hud.showPauseScreen(false);
    this.input.requestLock();
    if (!this.input.isLocked && !this.input.isTouchDevice) {
      this.hud.showClickToLock(true);
    }
  }

  gameOver() {
    this.gameState = 'GAMEOVER';
    sound.stopKawaiiBgm();
    this.hud.showClickToLock(false);
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
      this.waveDroneCount = 6;
      this.waveStalkerCount = 2;
      this.waveTitanCount = 1;
    } else {
      this.waveDroneCount = 6 + (waveNum - 4) * 2;
      this.waveStalkerCount = 6 + (waveNum - 4) * 3;
      this.waveTitanCount = Math.floor(waveNum / 3);
    }

    this.waveEnemiesToSpawn = this.waveDroneCount + this.waveStalkerCount + this.waveTitanCount;
    this.spawnTimer = 0;

    sound.playWaveStart();
    this.hud.showAnnouncement(
      waveNum === 4 ? '👑 草莓女王巨型甜心熊 现身 👑' : `第 ${waveNum} 波萌偶茶话会`,
      waveNum === 4 ? '超大号甜心巨熊来袭，小心甜蜜糖果飞弹哦!' : `本波共有 ${this.waveEnemiesToSpawn} 只调皮玩偶伙伴`,
      waveNum === 4 ? 'neon-red' : 'neon-pink'
    );
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
    }

    const enemy = new Enemy(typeKey, this.renderer.scene, this.arena);
    this.enemies.push(enemy);
    this.particles.createMuzzleFlash(enemy.position, 0xff0044);
  }

  handleShooting(dt) {
    if (this.isRespawning) return;

    const wp = this.weapons.getCurrentWeapon();
    const isMouseDown = this.input.isMouseDown(0);

    let wantToFire = false;
    if (wp.isAutomatic) {
      wantToFire = isMouseDown;
    } else {
      wantToFire = isMouseDown && !this.wasMouseDown;
    }
    this.wasMouseDown = isMouseDown;

    if (wantToFire) {
      if (wp.isReloading) return;

      if (wp.currentAmmo <= 0) {
        if (this.weapons.startReload()) {
          sound.playMechanicalClick();
        }
        return;
      }

      const now = performance.now() / 1000;
      const fireInterval = this.player.hasOverdrive ? wp.fireRate * 0.6 : wp.fireRate;
      if (now - wp.lastFireTime < fireInterval) return;

      // Deduct ammo & trigger weapon recoil
      wp.lastFireTime = now;
      wp.currentAmmo--;
      this.weapons.triggerRecoil();
      this.hud.triggerCrosshairBloom();

      // Camera forward direction
      const cameraDir = new THREE.Vector3();
      this.renderer.camera.getWorldDirection(cameraDir);
      const muzzlePos = this.weapons.getMuzzleWorldPosition();

      // Muzzle spark
      this.particles.createMuzzleFlash(muzzlePos, wp.colorHex);

      const finalDamage = this.player.hasOverdrive ? wp.damage * 2.0 : wp.damage;

      // Broadcast shoot event to all peers in multiplayer
      if (this.gameMode === 'MULTIPLAYER') {
        this.network.broadcastShoot(wp.id, muzzlePos, cameraDir);
      }

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
        let hitTarget = null;
        let isRemotePlayer = false;
        let isCritHit = false;

        // Check remote players (PvP)
        if (this.gameMode === 'MULTIPLAYER') {
          for (const rPlayer of this.remotePlayers.values()) {
            if (rPlayer.isDead || rPlayer.isInvulnerable) continue;
            const rCenter = rPlayer.getCenter();
            const ray = raycaster.ray;
            const targetToRay = rCenter.clone().sub(ray.origin);
            const projection = targetToRay.dot(ray.direction);
            if (projection > 0) {
              const closestPt = ray.origin.clone().add(ray.direction.clone().multiplyScalar(projection));
              const dist = closestPt.distanceTo(rCenter);
              if (dist <= rPlayer.radius + 0.3 && projection < closestHitDist) {
                closestHitDist = projection;
                endPoint = closestPt;
                hitTarget = rPlayer;
                isRemotePlayer = true;
                isCritHit = (closestPt.y - rPlayer.position.y) > 1.35;
              }
            }
          }
        }

        // Check AI enemies (Solo)
        if (!hitTarget && this.gameMode === 'SOLO') {
          for (const enemy of this.enemies) {
            if (enemy.isDead) continue;
            const eCenter = enemy.getCenter();
            const ray = raycaster.ray;
            const targetToRay = eCenter.clone().sub(ray.origin);
            const projection = targetToRay.dot(ray.direction);
            if (projection > 0) {
              const closestPt = ray.origin.clone().add(ray.direction.clone().multiplyScalar(projection));
              const dist = closestPt.distanceTo(eCenter);
              if (dist <= enemy.radius + 0.25 && projection < closestHitDist) {
                closestHitDist = projection;
                endPoint = closestPt;
                hitTarget = enemy;
                isRemotePlayer = false;
                isCritHit = (closestPt.y - enemy.position.y) > enemy.height * 0.7;
              }
            }
          }
        }

        if (hitTarget) {
          const hitDmg = isCritHit ? finalDamage * 2.0 : finalDamage;
          hitTarget.takeDamage(hitDmg);
          this.floatingText.showDamage(endPoint, hitDmg, isCritHit);
          this.particles.createSparks(endPoint, cameraDir.clone().negate(), 0xff0077, 20);
          sound.playHitmarker(isCritHit);
          this.hud.triggerHitmarker(isCritHit);

          if (isRemotePlayer) {
            this.network.broadcastHit(hitTarget.peerId, hitDmg, isCritHit, endPoint);
            if (hitTarget.health <= 0) {
              this.network.broadcastKill(hitTarget.peerId, this.network.localPeerId, 'railgun');
            }
          }
        }

        this.projectileManager.spawnRailgunBeam(muzzlePos, endPoint, wp.colorHex);
      }
    }
  }

  handleKill(enemy) {
    this.totalKills++;
    this.score += enemy.typeDef.score;
    this.streakCount++;
    this.streakTimer = 4.0;

    if (this.streakCount === 2) {
      this.hud.showAnnouncement('💖 甜蜜双击! (DOUBLE SWEET)', '+100 甜度奖励', 'neon-pink');
      this.score += 100;
    } else if (this.streakCount === 3) {
      this.hud.showAnnouncement('🍰 可爱超标! (KAWAII OVERLOAD)', '+250 甜度奖励', 'neon-orange');
      this.score += 250;
    } else if (this.streakCount === 4) {
      this.hud.showAnnouncement('🎀 萌力全开! (MEGA CUTE)', '+400 甜度奖励', 'neon-pink');
      this.score += 400;
    } else if (this.streakCount >= 5) {
      this.hud.showAnnouncement('👑 全场最萌小仙女! (CUTEST QUEEN)', '+600 甜度奖励', 'neon-yellow');
      this.score += 600;
    }

    this.particles.createExplosion(enemy.getCenter(), enemy.typeDef.isBoss);
    sound.playExplosion(enemy.typeDef.isBoss);

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

    // 2. Respawn Countdown in Multiplayer
    if (this.isRespawning) {
      this.respawnTimer -= dt;
      this.hud.showRespawnCountdown(this.respawnKillerName, Math.max(1, Math.ceil(this.respawnTimer)));
      if (this.respawnTimer <= 0) {
        this.respawnLocalPlayer();
      }
    }

    // 3. Kill streak countdown
    if (this.streakTimer > 0) {
      this.streakTimer -= dt;
      if (this.streakTimer <= 0) {
        this.streakCount = 0;
      }
    }

    // 4. Local Player Updates
    const wp = this.weapons.getCurrentWeapon();
    const isADS = this.input.isMouseDown(2);
    const mouseDelta = this.input.getAndResetDeltas();
    const { isMoving, isSprinting } = this.player.update(dt, this.input, wp.adsFov, isADS, mouseDelta);

    // 5. Broadcast Local Player State (30Hz rate-limited in NetworkManager)
    if (this.gameMode === 'MULTIPLAYER') {
      const p = this.player.position;
      this.network.broadcastPlayerState({
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        isMoving,
        isJumping: !this.player.isGrounded,
        weaponIndex: this.weapons.currentIndex
      });

      // Update Remote Players 3D animations & interpolation
      for (const rPlayer of this.remotePlayers.values()) {
        rPlayer.update(dt);
      }
    }

    // 6. Weapons Update & Shooting
    this.weapons.update(dt, mouseDelta, isMoving, isSprinting, isADS);
    this.handleShooting(dt);

    // 7. Solo Wave Spawner & Enemies
    if (this.gameMode === 'SOLO') {
      if (this.waveEnemiesToSpawn > 0) {
        this.spawnTimer += dt;
        if (this.spawnTimer >= 0.8) {
          this.spawnTimer = 0;
          this.spawnEnemy();
          this.waveEnemiesToSpawn--;
        }
      }

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        enemy.update(
          dt,
          this.player.position,
          this.arena,
          this.projectileManager,
          sound,
          (damage, pos) => {
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

      const activeEnemiesCount = this.enemies.length + this.waveEnemiesToSpawn;
      if (activeEnemiesCount === 0 && !this.isWaveIntermission) {
        this.isWaveIntermission = true;
        this.intermissionTimer = 3.5;
        sound.playPickup();
        this.hud.showAnnouncement('茶话会圆满成功! 🍰', `第 ${this.wave} 轮萌偶挑战通关`, 'neon-green');
        this.score += this.wave * 300;
      }

      if (this.isWaveIntermission) {
        this.intermissionTimer -= dt;
        if (this.intermissionTimer <= 0) {
          this.startWave(this.wave + 1);
        }
      }

      if (this.player.health <= 0) {
        this.gameOver();
        return;
      }
    }

    // 8. Projectiles Update (with PvP remote player hit check)
    const remoteList = this.gameMode === 'MULTIPLAYER' ? Array.from(this.remotePlayers.values()) : [];
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
      },
      remoteList,
      (rPlayer, damage, isCrit, hitPos) => {
        // PvP projectile hit
        this.network.broadcastHit(rPlayer.peerId, damage, isCrit, hitPos);
        if (rPlayer.health <= 0) {
          this.network.broadcastKill(rPlayer.peerId, this.network.localPeerId, 'plasma');
        }
      }
    );

    // 9. Tactical Pickups
    this.pickupManager.update(dt, this.player.position, (typeKey, typeDef) => {
      sound.playPickup();
      if (typeKey === 'HEALTH') {
        this.player.heal(typeDef.value);
        this.floatingText.showHeal(this.player.position, typeDef.value);
      } else if (typeKey === 'SHIELD') {
        this.player.addShield(typeDef.value);
      } else if (typeKey === 'AMMO') {
        const curWp = this.weapons.getCurrentWeapon();
        curWp.currentAmmo = curWp.magSize;
      } else if (typeKey === 'OVERDRIVE') {
        this.player.activateOverdrive(typeDef.duration);
        this.hud.showAnnouncement('★ 草莓糖心超频 ★', '萌心攻击力翻倍，射速极度提升!', 'neon-yellow');
      }
    });

    // 10. HUD Updates
    this.hud.updatePlayerVitals(this.player);
    this.hud.updateWeapon(wp, this.weapons.currentIndex, isADS);

    if (this.gameMode === 'MULTIPLAYER') {
      this.hud.updateMultiplayerStats(this.network.roomId, this.mpKills, this.mpDeaths, this.network.ping);
    } else {
      const activeCount = this.enemies.length + this.waveEnemiesToSpawn;
      this.hud.updateWaveAndScore(this.wave, this.score, activeCount);
    }

    // 11. Tactical Radar Minimap
    const radarTargets = this.gameMode === 'MULTIPLAYER' ? Array.from(this.remotePlayers.values()) : this.enemies;
    this.minimap.render(this.player, radarTargets, this.pickupManager.pickups, this.arena.jumpPads);
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
