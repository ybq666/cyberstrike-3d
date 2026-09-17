import * as THREE from 'three';

export class Player {
  constructor(camera, arena, soundEngine) {
    this.camera = camera;
    this.arena = arena;
    this.sound = soundEngine;

    // Dimensions
    this.height = 1.7;
    this.radius = 0.6;

    // Transform & Physics
    this.position = new THREE.Vector3(0, this.height, 25);
    this.velocity = new THREE.Vector3();
    this.camera.position.copy(this.position);

    // Rotation (Euler angles)
    this.camera.rotation.order = 'YXZ';
    this.pitch = 0; // Look up/down
    this.yaw = Math.PI; // Face arena center initially
    this.invertY = false;

    // Speeds & Stats
    this.walkSpeed = 8.5;
    this.sprintSpeed = 13.5;
    this.jumpForce = 11.0;
    this.gravity = 28.0;
    this.isGrounded = true;

    // Stamina
    this.maxStamina = 100;
    this.stamina = 100;
    this.staminaRegenRate = 35;
    this.staminaDrainRate = 45;

    // Vitals
    this.maxHealth = 100;
    this.health = 100;
    this.maxShield = 100;
    this.shield = 100;
    this.shieldRegenDelay = 4.0;
    this.shieldRegenTimer = 0;
    this.shieldRegenRate = 30;

    // Power-up Buff
    this.buffTimer = 0;
    this.hasOverdrive = false;

    // Camera Shake
    this.shakeIntensity = 0;

    // FOV management
    this.baseFov = 75;
    this.targetFov = 75;
  }

  getCenter() {
    return this.position.clone().add(new THREE.Vector3(0, -this.height * 0.5, 0));
  }

  addCameraShake(amount) {
    this.shakeIntensity = Math.min(1.0, this.shakeIntensity + amount);
  }

  takeDamage(amount, sourcePos) {
    if (this.health <= 0) return;

    this.shieldRegenTimer = this.shieldRegenDelay;
    this.addCameraShake(0.45);

    let remaining = amount;
    if (this.shield > 0) {
      if (this.shield >= remaining) {
        this.shield -= remaining;
        remaining = 0;
      } else {
        remaining -= this.shield;
        this.shield = 0;
        this.sound.playShieldBreak();
      }
    }

    if (remaining > 0) {
      this.health = Math.max(0, this.health - remaining);
      this.sound.playPlayerHurt();
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  addShield(amount) {
    this.shield = Math.min(this.maxShield, this.shield + amount);
  }

  activateOverdrive(duration = 10) {
    this.hasOverdrive = true;
    this.buffTimer = duration;
  }

  reset() {
    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.stamina = this.maxStamina;
    this.position.set(0, this.height, 25);
    this.velocity.set(0, 0, 0);
    this.pitch = 0;
    this.yaw = Math.PI;
    this.hasOverdrive = false;
    this.buffTimer = 0;
  }

  update(dt, input, currentWeaponAdsFov, isADS, mouseDelta = null) {
    // 1. Mouse Look (Pitch & Yaw)
    const { dx, dy } = mouseDelta || input.getAndResetDeltas();
    const lookSens = 0.0022;
    const ySign = this.invertY ? -1 : 1;

    this.yaw -= dx * lookSens;
    this.pitch -= dy * lookSens * ySign;

    // Clamp vertical look angle
    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // 2. Sprint & Stamina
    const wantsSprint = input.isKeyDown('ShiftLeft') && this.stamina > 10;
    const isSprinting = wantsSprint && (input.isKeyDown('KeyW') || input.isKeyDown('KeyA') || input.isKeyDown('KeyS') || input.isKeyDown('KeyD'));

    if (isSprinting) {
      this.stamina = Math.max(0, this.stamina - this.staminaDrainRate * dt);
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate * dt);
    }

    // 3. Movement input vector (relative to player yaw)
    const moveVector = new THREE.Vector3();
    if (input.isKeyDown('KeyW')) moveVector.z -= 1;
    if (input.isKeyDown('KeyS')) moveVector.z += 1;
    if (input.isKeyDown('KeyA')) moveVector.x -= 1;
    if (input.isKeyDown('KeyD')) moveVector.x += 1;

    const isMoving = moveVector.lengthSq() > 0;
    if (isMoving) moveVector.normalize();

    // Rotate moveVector by player yaw
    moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    // Apply speed
    const curSpeed = isSprinting ? this.sprintSpeed : this.walkSpeed;
    const accel = this.isGrounded ? 12 : 3;

    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveVector.x * curSpeed, accel * dt);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, moveVector.z * curSpeed, accel * dt);

    // 4. Gravity & Jump
    this.velocity.y -= this.gravity * dt;

    if (this.isGrounded && input.isKeyDown('Space')) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
    }

    // 5. Jump Pad Check (Launch upward!)
    const pad = this.arena.checkJumpPad(this.position);
    if (pad) {
      this.velocity.y = pad.impulse;
      this.isGrounded = false;
      this.sound.playJumpPad();
      this.addCameraShake(0.3);
    }

    // 6. Integrate Position
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // Floor collision
    if (this.position.y <= this.height) {
      this.position.y = this.height;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Arena walls and obstacles collision
    this.arena.resolveCollision(this.position, this.radius);

    // 7. Shield Auto-Regeneration
    if (this.shieldRegenTimer > 0) {
      this.shieldRegenTimer -= dt;
    } else if (this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenRate * dt);
    }

    // 8. Buff Timer
    if (this.buffTimer > 0) {
      this.buffTimer -= dt;
      if (this.buffTimer <= 0) {
        this.hasOverdrive = false;
      }
    }

    // 9. Camera Shake Decay & Application
    let shakePitch = 0;
    let shakeYaw = 0;
    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - 3.0 * dt);
      const time = Date.now() * 0.05;
      shakePitch = Math.sin(time) * this.shakeIntensity * 0.05;
      shakeYaw = Math.cos(time * 1.3) * this.shakeIntensity * 0.05;
    }

    // 10. Update Camera position & rotation
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw + shakeYaw;
    this.camera.rotation.x = this.pitch + shakePitch;
    this.camera.rotation.z = 0;

    // 11. Dynamic FOV
    if (isADS) {
      this.targetFov = currentWeaponAdsFov;
    } else if (isSprinting) {
      this.targetFov = 82;
    } else {
      this.targetFov = this.baseFov;
    }
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, 12 * dt);
    this.camera.updateProjectionMatrix();

    return { isMoving, isSprinting };
  }
}
