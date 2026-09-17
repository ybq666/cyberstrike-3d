// HUD Controller for Cyberstrike 3D
export class HUD {
  constructor() {
    // Containers
    this.hudElement = document.getElementById('hud');
    this.startScreen = document.getElementById('start-screen');
    this.pauseScreen = document.getElementById('pause-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');

    // Stats
    this.healthBar = document.getElementById('health-bar');
    this.healthText = document.getElementById('health-text');
    this.shieldBar = document.getElementById('shield-bar');
    this.shieldText = document.getElementById('shield-text');
    this.staminaBar = document.getElementById('stamina-bar');

    // Waves & Score
    this.waveDisplay = document.getElementById('wave-display');
    this.scoreDisplay = document.getElementById('score-display');
    this.enemiesDisplay = document.getElementById('enemies-display');

    // Weapons
    this.weaponName = document.getElementById('weapon-name');
    this.ammoCur = document.getElementById('ammo-cur');
    this.ammoMax = document.getElementById('ammo-max');
    this.reloadIndicator = document.getElementById('reload-indicator');
    this.weaponSlots = [
      document.getElementById('slot-1'),
      document.getElementById('slot-2'),
      document.getElementById('slot-3')
    ];

    // Crosshair & Hitmarker
    this.crosshair = document.getElementById('crosshair');
    this.hitmarker = document.getElementById('hitmarker');
    this.sniperOverlay = document.getElementById('sniper-overlay');
    this.damageVignette = document.getElementById('damage-vignette');

    // Announcements
    this.banner = document.getElementById('announcement-banner');
    this.announceTitle = document.getElementById('announce-title');
    this.announceSubtitle = document.getElementById('announce-subtitle');

    // Buff indicator
    this.buffIndicator = document.getElementById('buff-indicator');
    this.buffTimer = document.getElementById('buff-timer');

    // End stats
    this.finalWave = document.getElementById('final-wave');
    this.finalKills = document.getElementById('final-kills');
    this.finalScore = document.getElementById('final-score');
    this.highScore = document.getElementById('high-score');

    // Settings elements
    this.sensSlider = document.getElementById('sens-slider');
    this.sensValue = document.getElementById('sens-value');
    this.volumeSlider = document.getElementById('volume-slider');
    this.volumeValue = document.getElementById('volume-value');

    // Multiplayer HUD elements
    this.soloTopPanels = document.querySelectorAll('.solo-panel');
    this.mpTopPanels = document.querySelectorAll('.mp-panel');
    this.mpRoomCode = document.getElementById('mp-room-code');
    this.mpKillsDisplay = document.getElementById('mp-kills-display');
    this.mpDeathsDisplay = document.getElementById('mp-deaths-display');
    this.mpPingDisplay = document.getElementById('mp-ping-display');
    this.killFeed = document.getElementById('kill-feed');
    this.scoreboardModal = document.getElementById('scoreboard-modal');
    this.scoreboardBody = document.getElementById('scoreboard-body');
    this.scoreboardRoom = document.getElementById('scoreboard-room');
    this.respawnOverlay = document.getElementById('respawn-overlay');
    this.respawnTimerText = document.getElementById('respawn-timer-text');
    this.respawnKillerText = document.getElementById('respawn-killer-text');
    this.toastEl = document.getElementById('toast-message');

    this.clickToLockOverlay = document.getElementById('click-to-lock-overlay');

    this.hitmarkerTimer = null;
    this.bannerTimer = null;
    this.toastTimer = null;
  }

  showClickToLock(show) {
    if (this.clickToLockOverlay) {
      this.clickToLockOverlay.classList.toggle('hidden', !show);
    }
  }

  showHUD(show) {
    if (show) {
      this.hudElement.classList.remove('hidden');
    } else {
      this.hudElement.classList.add('hidden');
      this.showClickToLock(false);
    }
  }

  showStartScreen(show) {
    this.startScreen.classList.toggle('hidden', !show);
  }

  showPauseScreen(show) {
    this.pauseScreen.classList.toggle('hidden', !show);
  }

  showGameOver(show, stats = {}) {
    this.gameoverScreen.classList.toggle('hidden', !show);
    if (show) {
      this.finalWave.textContent = `第 ${stats.wave || 1} 派对轮次`;
      this.finalKills.textContent = stats.kills || 0;
      this.finalScore.textContent = stats.score || 0;
      this.highScore.textContent = stats.highScore || 0;
    }
  }

  updatePlayerVitals(player) {
    // Health (元气生命值)
    const hpPct = Math.max(0, Math.min(100, (player.health / player.maxHealth) * 100));
    this.healthBar.style.width = `${hpPct}%`;
    this.healthText.textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;

    // Shield (草莓甜心护盾)
    const shPct = Math.max(0, Math.min(100, (player.shield / player.maxShield) * 100));
    this.shieldBar.style.width = `${shPct}%`;
    this.shieldText.textContent = `${Math.ceil(player.shield)} / ${player.maxShield}`;

    // Stamina (轻盈体力)
    const stPct = Math.max(0, Math.min(100, (player.stamina / player.maxStamina) * 100));
    this.staminaBar.style.width = `${stPct}%`;

    // Overdrive Buff (草莓狂欢超频)
    if (player.hasOverdrive) {
      this.buffIndicator.classList.remove('hidden');
      this.buffTimer.textContent = `${Math.ceil(player.buffTimer)}s`;
    } else {
      this.buffIndicator.classList.add('hidden');
    }
  }

  updateWeapon(weapon, index, isADS) {
    this.weaponName.textContent = weapon.name;
    this.ammoCur.textContent = weapon.currentAmmo;
    this.ammoMax.textContent = weapon.magSize;

    // Active slot
    this.weaponSlots.forEach((slot, i) => {
      slot.classList.toggle('active', i === index);
    });

    // Reload indicator
    if (weapon.isReloading) {
      this.reloadIndicator.classList.remove('hidden');
    } else {
      this.reloadIndicator.classList.add('hidden');
    }

    // Sniper scope
    if (weapon.id === 'railgun' && isADS) {
      this.sniperOverlay.classList.remove('hidden');
      this.crosshair.classList.add('hidden');
    } else {
      this.sniperOverlay.classList.add('hidden');
      this.crosshair.classList.remove('hidden');
    }
  }

  triggerCrosshairBloom() {
    this.crosshair.classList.add('bloom');
    setTimeout(() => {
      this.crosshair.classList.remove('bloom');
    }, 90);
  }

  triggerHitmarker(isCrit = false) {
    if (this.hitmarkerTimer) clearTimeout(this.hitmarkerTimer);
    this.hitmarker.classList.add('active');
    this.hitmarker.classList.toggle('crit', isCrit);

    this.hitmarkerTimer = setTimeout(() => {
      this.hitmarker.classList.remove('active');
      this.hitmarker.classList.remove('crit');
    }, 120);
  }

  triggerDamageVignette() {
    this.damageVignette.classList.add('hit');
    setTimeout(() => {
      this.damageVignette.classList.remove('hit');
    }, 180);
  }

  updateWaveAndScore(wave, score, enemiesLeft) {
    if (this.waveDisplay) this.waveDisplay.textContent = `第 ${wave} 轮`;
    if (this.scoreDisplay) this.scoreDisplay.textContent = `${score.toLocaleString()}`;
    if (this.enemiesDisplay) this.enemiesDisplay.textContent = `${enemiesLeft} 🧸`;
  }

  showAnnouncement(title, subtitle = '', colorClass = 'neon-pink') {
    if (this.bannerTimer) clearTimeout(this.bannerTimer);

    if (this.announceTitle) {
      this.announceTitle.className = `announce-title ${colorClass}`;
      this.announceTitle.textContent = title;
    }
    if (this.announceSubtitle) {
      this.announceSubtitle.textContent = subtitle;
    }

    if (this.banner) {
      this.banner.classList.add('show');
      this.bannerTimer = setTimeout(() => {
        this.banner.classList.remove('show');
      }, 2400);
    }
  }

  setMode(isMultiplayer) {
    if (this.soloTopPanels) {
      this.soloTopPanels.forEach(el => el.classList.toggle('hidden', isMultiplayer));
    }
    if (this.mpTopPanels) {
      this.mpTopPanels.forEach(el => el.classList.toggle('hidden', !isMultiplayer));
    }
  }

  updateMultiplayerStats(roomCode, kills, deaths, ping) {
    if (this.mpRoomCode && roomCode) this.mpRoomCode.textContent = roomCode;
    if (this.mpKillsDisplay) this.mpKillsDisplay.textContent = `${kills} 萌化`;
    if (this.mpDeathsDisplay) this.mpDeathsDisplay.textContent = `${deaths} 倒地`;
    if (this.mpPingDisplay) this.mpPingDisplay.textContent = `${ping || '--'} ms`;
  }

  addKillFeed(killerName, victimName, weaponName, killerColor = '#ff4081', victimColor = '#ff2e63') {
    if (!this.killFeed) return;

    const item = document.createElement('div');
    item.className = 'kill-feed-item';
    item.innerHTML = `
      <span class="kf-killer" style="color: ${killerColor};">${killerName}</span>
      <span class="kf-weapon">[${weaponName}]</span>
      <span class="kf-victim" style="color: ${victimColor};">${victimName}</span>
    `;

    this.killFeed.appendChild(item);

    // 4.5 秒后淡出移除
    setTimeout(() => {
      item.classList.add('fade-out');
      setTimeout(() => {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 500);
    }, 4500);

    // 限制最多显示 5 条
    while (this.killFeed.children.length > 5) {
      this.killFeed.removeChild(this.killFeed.firstChild);
    }
  }

  showScoreboard(show, players = [], roomId = '') {
    if (!this.scoreboardModal) return;
    this.scoreboardModal.classList.toggle('hidden', !show);
    if (!show) return;

    if (this.scoreboardRoom) {
      this.scoreboardRoom.textContent = roomId || 'SWEET-PARADISE';
    }

    if (this.scoreboardBody) {
      // 按照击杀数倒序排列
      const sorted = [...players].sort((a, b) => (b.kills || 0) - (a.kills || 0));

      this.scoreboardBody.innerHTML = sorted.map((p, idx) => `
        <tr class="${p.isLocal ? 'sb-local-player' : ''}">
          <td>${idx === 0 ? '👑' : `#${idx + 1}`}</td>
          <td>
            <span class="sb-color-dot" style="background-color: ${p.color || '#ff7aa2'};"></span>
            🎀 ${p.name} ${p.isLocal ? '<span class="sb-tag-you">(你)</span>' : ''}
          </td>
          <td class="neon-pink font-bold">${p.kills || 0}</td>
          <td class="neon-orange">${p.deaths || 0}</td>
          <td class="neon-yellow">${p.score || 0}</td>
          <td class="${(p.ping || 0) < 60 ? 'neon-green' : 'neon-orange'}">${p.ping ? p.ping + 'ms' : '直连'}</td>
        </tr>
      `).join('');
    }
  }

  showRespawnCountdown(killerName, secondsRemaining) {
    if (!this.respawnOverlay) return;
    this.respawnOverlay.classList.remove('hidden');
    if (this.respawnKillerText) {
      this.respawnKillerText.textContent = killerName ? `你被小可爱 [${killerName}] 萌倒啦~` : '元气耗尽，补妆休息中~';
    }
    if (this.respawnTimerText) {
      this.respawnTimerText.textContent = `${secondsRemaining} 秒后甜心重返派对...`;
    }
  }

  hideRespawnCountdown() {
    if (this.respawnOverlay) {
      this.respawnOverlay.classList.add('hidden');
    }
  }

  showToast(message) {
    if (!this.toastEl) return;
    if (this.toastTimer) clearTimeout(this.toastTimer);

    this.toastEl.textContent = message;
    this.toastEl.classList.remove('hidden');
    this.toastEl.classList.add('show');

    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
      setTimeout(() => this.toastEl.classList.add('hidden'), 300);
    }, 2500);
  }
}

