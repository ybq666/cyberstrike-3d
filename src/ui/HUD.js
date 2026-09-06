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

    this.hitmarkerTimer = null;
    this.bannerTimer = null;
  }

  showHUD(show) {
    if (show) {
      this.hudElement.classList.remove('hidden');
    } else {
      this.hudElement.classList.add('hidden');
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
      this.finalWave.textContent = `第 ${stats.wave || 1} 波`;
      this.finalKills.textContent = stats.kills || 0;
      this.finalScore.textContent = stats.score || 0;
      this.highScore.textContent = stats.highScore || 0;
    }
  }

  updatePlayerVitals(player) {
    // Health
    const hpPct = Math.max(0, Math.min(100, (player.health / player.maxHealth) * 100));
    this.healthBar.style.width = `${hpPct}%`;
    this.healthText.textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;

    // Shield
    const shPct = Math.max(0, Math.min(100, (player.shield / player.maxShield) * 100));
    this.shieldBar.style.width = `${shPct}%`;
    this.shieldText.textContent = `${Math.ceil(player.shield)} / ${player.maxShield}`;

    // Stamina
    const stPct = Math.max(0, Math.min(100, (player.stamina / player.maxStamina) * 100));
    this.staminaBar.style.width = `${stPct}%`;

    // Overdrive Buff
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
    this.waveDisplay.textContent = `第 ${wave} 波`;
    this.scoreDisplay.textContent = score.toLocaleString();
    this.enemiesDisplay.textContent = enemiesLeft;
  }

  showAnnouncement(title, subtitle = '', colorClass = 'neon-cyan') {
    if (this.bannerTimer) clearTimeout(this.bannerTimer);

    this.announceTitle.className = `announce-title ${colorClass}`;
    this.announceTitle.textContent = title;
    this.announceSubtitle.textContent = subtitle;

    this.banner.classList.add('show');
    this.bannerTimer = setTimeout(() => {
      this.banner.classList.remove('show');
    }, 2400);
  }
}
