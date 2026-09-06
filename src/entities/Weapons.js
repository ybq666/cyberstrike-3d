import * as THREE from 'three';

export const WEAPON_CONFIGS = [
  {
    id: 'plasma',
    name: '等离子冲锋枪',
    shortName: '冲锋枪',
    damage: 28,
    fireRate: 0.1, // 10 shots per second
    isAutomatic: true,
    magSize: 35,
    reserveAmmo: Infinity,
    reloadTime: 1.3,
    projectileSpeed: 110,
    recoilKickZ: 0.08,
    recoilRotX: 0.09,
    colorHex: 0x00f3ff,
    adsFov: 60
  },
  {
    id: 'shotgun',
    name: '碎裂重型霰弹枪',
    shortName: '霰弹枪',
    damage: 18, // per pellet
    pellets: 8,
    spread: 0.075,
    fireRate: 0.72,
    isAutomatic: false,
    magSize: 8,
    reserveAmmo: Infinity,
    reloadTime: 1.8,
    projectileSpeed: 95,
    recoilKickZ: 0.22,
    recoilRotX: 0.26,
    colorHex: 0xff7700,
    adsFov: 65
  },
  {
    id: 'railgun',
    name: '湮灭磁轨炮',
    shortName: '磁轨炮',
    damage: 175, // Hitscan single high impact
    isHitscan: true,
    fireRate: 1.15,
    isAutomatic: false,
    magSize: 4,
    reserveAmmo: Infinity,
    reloadTime: 2.2,
    recoilKickZ: 0.25,
    recoilRotX: 0.32,
    colorHex: 0xff0077,
    adsFov: 32 // High zoom electronic scope
  }
];

export class WeaponSystem {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;

    // Weapon holder attached to camera for true FPS viewpoint
    this.holder = new THREE.Group();
    this.camera.add(this.holder);

    // Resting position of weapon in view space
    this.defaultPos = new THREE.Vector3(0.24, -0.22, -0.45);
    this.adsPos = new THREE.Vector3(0.0, -0.16, -0.35);
    this.holder.position.copy(this.defaultPos);

    // Current State
    this.currentIndex = 0;
    this.weapons = WEAPON_CONFIGS.map(cfg => ({
      ...cfg,
      currentAmmo: cfg.magSize,
      isReloading: false,
      reloadTimer: 0,
      lastFireTime: 0
    }));

    this.isADS = false; // Aim down sights
    this.isSwitching = false;
    this.switchProgress = 1.0;

    // Animation recoil & sway offsets
    this.recoilZ = 0;
    this.recoilRotX = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.bobOffset = new THREE.Vector3();

    // Procedural weapon meshes
    this.models = [];
    this.createWeaponModels();
    this.selectWeapon(0, true);
  }

  // Build Procedural 3D Sci-Fi Weapon Models
  createWeaponModels() {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      metalness: 0.85,
      roughness: 0.25
    });

    const darkGripMat = new THREE.MeshStandardMaterial({
      color: 0x090b10,
      metalness: 0.5,
      roughness: 0.7
    });

    // 1. Plasma Blaster Model
    const plasmaGroup = new THREE.Group();
    // Receiver body
    const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.45), metalMat);
    plasmaGroup.add(pBody);
    // Grip
    const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), darkGripMat);
    pGrip.position.set(0, -0.12, 0.08);
    pGrip.rotation.x = 0.25;
    plasmaGroup.add(pGrip);
    // Dual plasma emitter rails
    const pRailMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    const pRail1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 12), pRailMat);
    pRail1.rotation.x = Math.PI / 2;
    pRail1.position.set(0.03, 0.02, -0.28);
    const pRail2 = pRail1.clone();
    pRail2.position.x = -0.03;
    plasmaGroup.add(pRail1);
    plasmaGroup.add(pRail2);
    // Energy core cylinder
    const pCore = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 12), pRailMat);
    pCore.rotation.z = Math.PI / 2;
    pCore.position.set(0, 0.02, 0.05);
    plasmaGroup.add(pCore);
    plasmaGroup.visible = false;
    this.holder.add(plasmaGroup);
    this.models.push(plasmaGroup);

    // 2. Scatter Shotgun Model
    const shotgunGroup = new THREE.Group();
    // Heavy Receiver
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.52), metalMat);
    shotgunGroup.add(sBody);
    // Dual heavy barrels
    const sBarrelMat = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.9, roughness: 0.2 });
    const sBarrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 12), sBarrelMat);
    sBarrel1.rotation.x = Math.PI / 2;
    sBarrel1.position.set(0.028, 0.03, -0.32);
    const sBarrel2 = sBarrel1.clone();
    sBarrel2.position.x = -0.028;
    shotgunGroup.add(sBarrel1);
    shotgunGroup.add(sBarrel2);
    // Heat radiator orange vent
    const sVentMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
    const sVent = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.25), sVentMat);
    sVent.position.set(0, 0.08, -0.15);
    shotgunGroup.add(sVent);
    // Grip
    const sGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.09), darkGripMat);
    sGrip.position.set(0, -0.14, 0.12);
    sGrip.rotation.x = 0.3;
    shotgunGroup.add(sGrip);
    shotgunGroup.visible = false;
    this.holder.add(shotgunGroup);
    this.models.push(shotgunGroup);

    // 3. Railgun Model
    const railGroup = new THREE.Group();
    // Long angular barrel housing
    const rBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.65), metalMat);
    railGroup.add(rBody);
    // Magenta electromagnetic coil rings
    const rCoilMat = new THREE.MeshBasicMaterial({ color: 0xff0077 });
    for (let i = 0; i < 4; i++) {
      const rRing = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 16), rCoilMat);
      rRing.position.set(0, 0.01, -0.1 - i * 0.12);
      railGroup.add(rRing);
    }
    // High-tech holographic scope
    const rScope = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.18), darkGripMat);
    rScope.position.set(0, 0.1, 0.0);
    railGroup.add(rScope);
    const rLens = new THREE.Mesh(new THREE.CircleGeometry(0.024, 16), rCoilMat);
    rLens.position.set(0, 0.1, 0.091);
    railGroup.add(rLens);
    // Grip
    const rGrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.08), darkGripMat);
    rGrip.position.set(0, -0.14, 0.14);
    rGrip.rotation.x = 0.28;
    railGroup.add(rGrip);
    railGroup.visible = false;
    this.holder.add(railGroup);
    this.models.push(railGroup);
  }

  getCurrentWeapon() {
    return this.weapons[this.currentIndex];
  }

  selectWeapon(index, force = false) {
    if ((index === this.currentIndex && !force) || index < 0 || index >= this.weapons.length) {
      return;
    }

    this.currentIndex = index;
    this.models.forEach((m, i) => {
      m.visible = i === index;
    });

    // Reset animations
    this.recoilZ = 0;
    this.recoilRotX = 0;
  }

  cycleWeapon(dir) {
    let next = this.currentIndex + dir;
    if (next < 0) next = this.weapons.length - 1;
    if (next >= this.weapons.length) next = 0;
    this.selectWeapon(next);
  }

  triggerRecoil() {
    const wp = this.getCurrentWeapon();
    this.recoilZ = wp.recoilKickZ;
    this.recoilRotX = wp.recoilRotX;
  }

  startReload() {
    const wp = this.getCurrentWeapon();
    if (wp.isReloading || wp.currentAmmo === wp.magSize) return false;

    wp.isReloading = true;
    wp.reloadTimer = wp.reloadTime;
    return true;
  }

  // Calculate tip/muzzle world position for spawning projectile
  getMuzzleWorldPosition() {
    const muzzleOffset = new THREE.Vector3(
      this.isADS ? 0 : 0.24,
      -0.18,
      -0.9
    );
    const worldPos = muzzleOffset.clone();
    this.camera.localToWorld(worldPos);
    return worldPos;
  }

  update(dt, mouseDelta, isMoving, isSprinting, isADS) {
    const wp = this.getCurrentWeapon();
    this.isADS = isADS;

    // Handle reload countdown
    if (wp.isReloading) {
      wp.reloadTimer -= dt;
      if (wp.reloadTimer <= 0) {
        wp.currentAmmo = wp.magSize;
        wp.isReloading = false;
      }
    }

    // Weapon Sway based on mouse movement
    const targetSwayX = -mouseDelta.dx * 0.0006;
    const targetSwayY = -mouseDelta.dy * 0.0006;
    this.swayX = THREE.MathUtils.lerp(this.swayX, targetSwayX, 10 * dt);
    this.swayY = THREE.MathUtils.lerp(this.swayY, targetSwayY, 10 * dt);

    // Walking Bob
    const time = Date.now() * 0.008;
    const bobSpeed = isSprinting ? 1.6 : 1.0;
    const bobAmount = isMoving ? (isSprinting ? 0.015 : 0.008) : 0.001;

    this.bobOffset.x = Math.sin(time * bobSpeed) * bobAmount;
    this.bobOffset.y = Math.cos(time * 2 * bobSpeed) * bobAmount * 0.5;

    // Recoil recovery
    this.recoilZ = THREE.MathUtils.lerp(this.recoilZ, 0, 14 * dt);
    this.recoilRotX = THREE.MathUtils.lerp(this.recoilRotX, 0, 16 * dt);

    // Target base position (ADS vs Hip-fire)
    const baseTarget = this.isADS ? this.adsPos : this.defaultPos;

    // Reload dip effect
    let reloadDip = 0;
    if (wp.isReloading) {
      const relNorm = wp.reloadTimer / wp.reloadTime;
      reloadDip = Math.sin(relNorm * Math.PI) * 0.16;
    }

    // Apply combined transformations
    this.holder.position.x = THREE.MathUtils.lerp(
      this.holder.position.x,
      baseTarget.x + this.swayX + this.bobOffset.x,
      12 * dt
    );
    this.holder.position.y = THREE.MathUtils.lerp(
      this.holder.position.y,
      baseTarget.y + this.swayY + this.bobOffset.y - reloadDip,
      12 * dt
    );
    this.holder.position.z = THREE.MathUtils.lerp(
      this.holder.position.z,
      baseTarget.z + this.recoilZ,
      14 * dt
    );

    this.holder.rotation.x = -this.recoilRotX + (wp.isReloading ? reloadDip * 2.5 : 0);
    this.holder.rotation.y = this.swayX * 0.8;
  }
}
