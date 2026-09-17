// Procedural Web Audio Synthesizer for Kitty Strike 3D (Sweet Kawaii Girlish Style)
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = 0.8;
    this.initialized = false;
    this.bgmTimer = null;
    this.bgmPlaying = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported or failed to init:', e);
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 1. 草莓喵喵枪开火音效 (Sweet Bouncy Kitty Pew-Pew)
  playPlasmaShot() {
    if (!this.initialized) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(820, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.1);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    // Cute bubble pop harmonics
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(1100, t);
    subOsc.frequency.exponentialRampToValueAtTime(440, t + 0.08);
    subGain.gain.setValueAtTime(0.18, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.1);
    subOsc.start(t);
    subOsc.stop(t + 0.08);
  }

  // 2. 彩虹波波糖果枪开火音效 (Party Confetti & Candy Popper)
  playShotgunShot() {
    if (!this.initialized) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    // Party Popper Pop
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.18);
    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.18);

    // Confetti streamer soft sparkle noise
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2200, t);
    noiseFilter.Q.value = 3;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.18);

    // Sweet toy click
    setTimeout(() => this.playMechanicalClick(), 220);
  }

  // 3. 星愿爱心魔杖炮开火音效 (Magical Star Wand Glissando Chime)
  playRailgunShot() {
    if (!this.initialized) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    // Magical girl harp/crystal sparkle arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    notes.forEach((freq, idx) => {
      const noteOsc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      const startTime = t + idx * 0.035;

      noteOsc.type = 'sine';
      noteOsc.frequency.setValueAtTime(freq, startTime);

      noteGain.gain.setValueAtTime(0.25, startTime);
      noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      noteOsc.connect(noteGain);
      noteGain.connect(this.masterGain);
      noteOsc.start(startTime);
      noteOsc.stop(startTime + 0.35);
    });

    // Radiant magic beam resonance
    const beamOsc = this.ctx.createOscillator();
    const beamGain = this.ctx.createGain();
    beamOsc.type = 'triangle';
    beamOsc.frequency.setValueAtTime(880, t);
    beamOsc.frequency.exponentialRampToValueAtTime(220, t + 0.4);
    beamGain.gain.setValueAtTime(0.35, t);
    beamGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    beamOsc.connect(beamGain);
    beamGain.connect(this.masterGain);
    beamOsc.start(t);
    beamOsc.stop(t + 0.4);
  }

  // 击中敌人提示音 (Sweet Crystal Fairy Bell)
  playHitmarker(isCrit = false) {
    if (!this.initialized) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isCrit ? 1567.98 : 1174.66, t); // G6 or D6
    if (isCrit) {
      osc.frequency.setValueAtTime(2093.0, t + 0.04); // C7 sparkle
    }

    gain.gain.setValueAtTime(isCrit ? 0.35 : 0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isCrit ? 0.14 : 0.09));

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + (isCrit ? 0.14 : 0.09));
  }

  // 玩偶派对气球爆炸音效 (Cute Balloon Pop + Glitter)
  playExplosion(isLarge = false) {
    if (!this.initialized) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    // Cheerful cartoon balloon pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.22);
    gain.gain.setValueAtTime(isLarge ? 0.7 : 0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.22);

    // Glitter sprinkle noise
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.3);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3500, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(isLarge ? 0.35 : 0.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.3);
  }

  // 玩具机械卡嗒声 (Cute Toy Click)
  playMechanicalClick() {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(350, t + 0.04);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  // 换弹完成音 (Joyful Two-Tone Chime)
  playReloadComplete() {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    [659.25, 1046.5].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = t + idx * 0.07;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.2, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(st);
      osc.stop(st + 0.12);
    });
  }

  // 果冻布丁弹射跳跃音 (Playful Cartoon Boing~~!)
  playJumpPad() {
    if (!this.initialized) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(820, t + 0.28);

    gain.gain.setValueAtTime(0.42, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  // 拾取甜点道具音效 (Sweet Music Box Celeste Arpeggio)
  playPickup() {
    if (!this.initialized) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const melody = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    melody.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = t + idx * 0.055;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  // 玩家受创 (Soft Cute Squeak)
  playPlayerHurt() {
    if (!this.initialized) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.12);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  // 护盾碎裂 (Cute Bubble Pop-Chime)
  playShieldBreak() {
    if (!this.initialized) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(987.77, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.22);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  // 波次开始欢乐号角 (Joyful Sweet Fanfare)
  playWaveStart() {
    if (!this.initialized) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const fanfare = [523.25, 659.25, 783.99, 1046.5];
    fanfare.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = t + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, start);

      gain.gain.setValueAtTime(0.28, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }

  playWaveAlert() {
    this.playWaveStart();
  }

  // 启动悠扬八音盒可爱背景音乐 (Sweet Kawaii Music Box BGM Loop)
  startKawaiiBgm() {
    if (this.bgmPlaying) return;
    this.ensureContext();
    this.bgmPlaying = true;

    // Soothing sweet pentatonic lullaby notes
    const melodyNotes = [
      523.25, 659.25, 783.99, 659.25, 1046.5, 783.99, 880.0, 659.25,
      587.33, 783.99, 880.0, 783.99, 1174.66, 880.0, 783.99, 659.25
    ];

    let noteIndex = 0;
    const playNextNote = () => {
      if (!this.bgmPlaying || !this.ctx) return;
      const t = this.ctx.currentTime;
      const freq = melodyNotes[noteIndex % melodyNotes.length];
      noteIndex++;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      // Very gentle, warm volume
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.6);

      this.bgmTimer = setTimeout(playNextNote, 320);
    };

    playNextNote();
  }

  stopKawaiiBgm() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const sound = new SoundEngine();
