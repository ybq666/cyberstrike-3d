// Input and PointerLock Controller for Cyberstrike 3D
export class Input {
  constructor(domElement) {
    this.domElement = domElement;

    // Keys state
    this.keys = {};
    this.mouseButtons = {};
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.wheelDelta = 0;

    // Settings
    this.sensitivity = 1.0;
    this.isLocked = false;

    // 严谨检测移动端/触屏：仅在真实移动设备或小屏触屏上开启触摸控件，PC 端哪怕带有触控屏也优先以键盘鼠标为准
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSmallTouchScreen = (window.innerWidth <= 1024) && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
    this.isTouchDevice = isMobileUA || isSmallTouchScreen;

    // Callbacks
    this.onLockChange = null;
    this.onWeaponSelect = null;
    this.onReloadPress = null;
    this.onPausePress = null;
    this.onWeaponCycle = null;

    this.bindEvents();
    if (this.isTouchDevice) {
      this.bindTouchControls();
    }
  }

  bindEvents() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Weapon shortcut keys 1, 2, 3
      if (e.code === 'Digit1') {
        if (this.onWeaponSelect) this.onWeaponSelect(0);
      } else if (e.code === 'Digit2') {
        if (this.onWeaponSelect) this.onWeaponSelect(1);
      } else if (e.code === 'Digit3') {
        if (this.onWeaponSelect) this.onWeaponSelect(2);
      }

      // Tab Scoreboard
      if (e.code === 'Tab') {
        e.preventDefault();
        if (this.onScoreboardToggle) this.onScoreboardToggle(true);
      }

      // Reload
      if (e.code === 'KeyR') {
        if (this.onReloadPress) this.onReloadPress();
      }

      // Pause toggle
      if (e.code === 'Escape') {
        if (this.onPausePress) this.onPausePress();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;

      if (e.code === 'Tab') {
        e.preventDefault();
        if (this.onScoreboardToggle) this.onScoreboardToggle(false);
      }
    });

    // Mouse movement (仅在鼠标锁定后响应，保证 360 度无边界流畅视角)
    window.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      this.mouseDeltaX += e.movementX || 0;
      this.mouseDeltaY += e.movementY || 0;
    });

    // Mouse buttons
    window.addEventListener('mousedown', (e) => {
      if (!this.isLocked) return;
      this.mouseButtons[e.button] = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.isLocked) return;
      this.mouseButtons[e.button] = false;
    });

    // Disable context menu for right click ADS
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Wheel for switching weapons
    window.addEventListener('wheel', (e) => {
      if (!this.isLocked) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      this.wheelDelta = dir;
      if (this.onWeaponCycle) this.onWeaponCycle(dir);
    }, { passive: true });

    // Pointer Lock change listener
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      if (this.onLockChange) this.onLockChange(this.isLocked);
    });

    document.addEventListener('pointerlockerror', (err) => {
      console.warn('[Input] Pointer lock error:', err);
      this.isLocked = false;
      if (this.onLockChange) this.onLockChange(false);
    });

    // 点击 canvas 画布尝试激活鼠标锁定
    if (this.domElement) {
      this.domElement.addEventListener('click', () => {
        if (!this.isLocked && !this.isTouchDevice) {
          this.requestLock();
        }
      });
    }
  }

  bindTouchControls() {
    const mobileControls = document.getElementById('mobile-controls');
    if (mobileControls) {
      mobileControls.classList.remove('hidden');
    }

    // 1. Virtual Joystick
    const zone = document.getElementById('touch-joystick-zone');
    const stick = document.getElementById('joystick-stick');
    let joystickTouchId = null;
    let originX = 0;
    let originY = 0;
    const maxRadius = 45;

    if (zone && stick) {
      zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        joystickTouchId = touch.identifier;
        const rect = zone.getBoundingClientRect();
        originX = rect.left + rect.width / 2;
        originY = rect.top + rect.height / 2;
      }, { passive: false });

      const handleJoystickMove = (touch) => {
        const dx = touch.clientX - originX;
        const dy = touch.clientY - originY;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const clampedDist = Math.min(maxRadius, dist);

        const stickX = Math.cos(angle) * clampedDist;
        const stickY = Math.sin(angle) * clampedDist;
        stick.style.transform = `translate(${stickX}px, ${stickY}px)`;

        const normX = stickX / maxRadius;
        const normY = stickY / maxRadius;

        // Map to WASD keys
        this.keys['KeyW'] = normY < -0.3;
        this.keys['KeyS'] = normY > 0.3;
        this.keys['KeyA'] = normX < -0.3;
        this.keys['KeyD'] = normX > 0.3;
        this.keys['ShiftLeft'] = dist > maxRadius * 0.85; // Auto sprint at outer edge
      };

      zone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === joystickTouchId) {
            handleJoystickMove(touch);
            break;
          }
        }
      }, { passive: false });

      const resetJoystick = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === joystickTouchId) {
            joystickTouchId = null;
            stick.style.transform = 'translate(0, 0)';
            this.keys['KeyW'] = false;
            this.keys['KeyS'] = false;
            this.keys['KeyA'] = false;
            this.keys['KeyD'] = false;
            this.keys['ShiftLeft'] = false;
            break;
          }
        }
      };

      zone.addEventListener('touchend', resetJoystick, { passive: false });
      zone.addEventListener('touchcancel', resetJoystick, { passive: false });
    }

    // 2. Touch Look Swipe Area (Right Screen)
    const lookZone = document.getElementById('touch-look-zone');
    let lookTouchId = null;
    let lastLookX = 0;
    let lastLookY = 0;

    if (lookZone) {
      lookZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        lookTouchId = touch.identifier;
        lastLookX = touch.clientX;
        lastLookY = touch.clientY;
      }, { passive: false });

      lookZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === lookTouchId) {
            const dx = touch.clientX - lastLookX;
            const dy = touch.clientY - lastLookY;
            lastLookX = touch.clientX;
            lastLookY = touch.clientY;

            this.mouseDeltaX += dx * 1.5;
            this.mouseDeltaY += dy * 1.5;
            break;
          }
        }
      }, { passive: false });

      const resetLook = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === lookTouchId) {
            lookTouchId = null;
            break;
          }
        }
      };

      lookZone.addEventListener('touchend', resetLook, { passive: false });
      lookZone.addEventListener('touchcancel', resetLook, { passive: false });
    }

    // 3. Touch Buttons
    const btnFire = document.getElementById('touch-btn-fire');
    if (btnFire) {
      btnFire.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.mouseButtons[0] = true;
      }, { passive: false });
      btnFire.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.mouseButtons[0] = false;
      }, { passive: false });
    }

    const btnJump = document.getElementById('touch-btn-jump');
    if (btnJump) {
      btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.keys['Space'] = true;
      }, { passive: false });
      btnJump.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.keys['Space'] = false;
      }, { passive: false });
    }

    const btnReload = document.getElementById('touch-btn-reload');
    if (btnReload) {
      btnReload.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onReloadPress) this.onReloadPress();
      }, { passive: false });
    }

    const btnAds = document.getElementById('touch-btn-ads');
    if (btnAds) {
      btnAds.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.mouseButtons[2] = !this.mouseButtons[2];
      }, { passive: false });
    }

    const btnSwitch = document.getElementById('touch-btn-switch');
    if (btnSwitch) {
      btnSwitch.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onWeaponCycle) this.onWeaponCycle(1);
      }, { passive: false });
    }
  }

  requestLock() {
    if (this.domElement && this.domElement.requestPointerLock) {
      try {
        const promise = this.domElement.requestPointerLock();
        if (promise && promise.catch) {
          promise.catch((err) => {
            // 某些情况下异步触发或无手势会失败，静默捕获
            console.warn('[Input] requestPointerLock async rejection:', err);
          });
        }
      } catch (e) {
        console.warn('[Input] requestPointerLock failed:', e);
      }
    } else if (this.isTouchDevice) {
      this.isLocked = true;
    }
  }

  exitLock() {
    if (document.exitPointerLock) {
      try {
        document.exitPointerLock();
      } catch (e) {}
    }
    this.isLocked = false;
  }

  isKeyDown(code) {
    return !!this.keys[code];
  }

  isMouseDown(btn = 0) {
    return !!this.mouseButtons[btn];
  }

  getAndResetDeltas() {
    const dx = this.mouseDeltaX * this.sensitivity;
    const dy = this.mouseDeltaY * this.sensitivity;
    const wheel = this.wheelDelta;

    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.wheelDelta = 0;

    return { dx, dy, wheel };
  }
}
