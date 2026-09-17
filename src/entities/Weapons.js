import * as THREE from 'three';

export const WEAPON_CONFIGS = [
  {
    id: 'plasma',
    name: '🍓 草莓喵喵枪',
    shortName: '草莓喵喵',
    damage: 28,
    fireRate: 0.1,
    isAutomatic: true,
    magSize: 35,
    reserveAmmo: Infinity,
    reloadTime: 1.2,
    projectileSpeed: 110,
    recoilKickZ: 0.07,
    recoilRotX: 0.08,
    colorHex: 0xff4081,
    adsFov: 60
  },
  {
    id: 'shotgun',
    name: '🍬 彩虹波波糖果枪',
    shortName: '彩虹糖果',
    damage: 18,
    pellets: 8,
    spread: 0.075,
    fireRate: 0.72,
    isAutomatic: false,
    magSize: 8,
    reserveAmmo: Infinity,
    reloadTime: 1.6,
    projectileSpeed: 95,
    recoilKickZ: 0.18,
    recoilRotX: 0.22,
    colorHex: 0xffaa00,
    adsFov: 65
  },
  {
    id: 'railgun',
    name: '✨ 星愿爱心魔杖炮',
    shortName: '星愿魔杖',
    damage: 175,
    isHitscan: true,
    fireRate: 1.15,
    isAutomatic: false,
    magSize: 4,
    reserveAmmo: Infinity,
    reloadTime: 2.0,
    recoilKickZ: 0.22,
    recoilRotX: 0.28,
    colorHex: 0xff1493,
    adsFov: 32
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
    this.onReloadComplete = null;

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

  // Build Procedural 3D Sweet Girlish Weapon Models
  createWeaponModels() {
    const milkWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.05
    });

    const strawberryPinkMat = new THREE.MeshStandardMaterial({
      color: 0xff7aa2,
      roughness: 0.3,
      metalness: 0.1
    });

    const hotPinkMat = new THREE.MeshStandardMaterial({
      color: 0xff2e63,
      roughness: 0.35,
      metalness: 0.05
    });

    const candyGoldMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      metalness: 0.4,
      roughness: 0.25
    });

    const pastelMintMat = new THREE.MeshStandardMaterial({
      color: 0x99e2b4,
      roughness: 0.35,
      metalness: 0.05
    });

    // Helper: Mini Ribbon Bow for weapons
    const makeMiniBow = (scale = 0.08, col = 0xff2e63) => {
      const g = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.3 });
      const knot = new THREE.Mesh(new THREE.SphereGeometry(scale * 0.4, 8, 8), m);
      g.add(knot);
      [-1, 1].forEach(s => {
        const loop = new THREE.Mesh(new THREE.ConeGeometry(scale * 0.6, scale, 12), m);
        loop.rotation.z = s * (Math.PI / 2 + 0.1);
        loop.scale.set(1, 0.45, 0.85);
        loop.position.set(s * scale * 0.55, 0, 0);
        g.add(loop);
      });
      return g;
    };

    // 1. 草莓喵喵枪 (Strawberry Kitty Blaster)
    const kittyGroup = new THREE.Group();
    // Receiver: White & Pink body
    const kBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.44), milkWhiteMat);
    kittyGroup.add(kBody);

    const kUpperCover = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.04, 0.38), strawberryPinkMat);
    kUpperCover.position.set(0, 0.07, 0);
    kittyGroup.add(kUpperCover);

    // Cute Kitty Ears on the front receiver!
    [-1, 1].forEach(side => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.045, 4), milkWhiteMat);
      ear.rotation.y = Math.PI / 4;
      ear.position.set(side * 0.032, 0.105, -0.08);
      kittyGroup.add(ear);

      const earInner = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.035, 4), hotPinkMat);
      earInner.rotation.y = Math.PI / 4;
      earInner.position.set(side * 0.032, 0.105, -0.076);
      kittyGroup.add(earInner);
    });

    // Iconic Hello Kitty Ribbon Bow on the left ear
    const kittyBow = makeMiniBow(0.055, 0xff2e63);
    kittyBow.position.set(-0.038, 0.115, -0.075);
    kittyBow.rotation.z = -0.3;
    kittyGroup.add(kittyBow);

    // Dual strawberry milk nozzles
    const kNozzleMat = new THREE.MeshStandardMaterial({ color: 0xff5376, roughness: 0.2, metalness: 0.2 });
    const kNozzle1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 12), kNozzleMat);
    kNozzle1.rotation.x = Math.PI / 2;
    kNozzle1.position.set(0.025, 0.01, -0.26);
    const kNozzle2 = kNozzle1.clone();
    kNozzle2.position.x = -0.025;
    kittyGroup.add(kNozzle1);
    kittyGroup.add(kNozzle2);

    // Glowing heart muzzle crown
    const kCrown = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 6, 16), new THREE.MeshBasicMaterial({ color: 0xff4081 }));
    kCrown.position.set(0, 0.01, -0.37);
    kittyGroup.add(kCrown);

    // Grip: Strawberry milk pink
    const kGrip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.16, 0.08), strawberryPinkMat);
    kGrip.position.set(0, -0.12, 0.08);
    kGrip.rotation.x = 0.25;
    kittyGroup.add(kGrip);

    // Cute strawberry milk box magazine
    const kMag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 0.065), milkWhiteMat);
    kMag.position.set(0, -0.12, -0.04);
    kittyGroup.add(kMag);
    const kMagDecal = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.06, 0.067), hotPinkMat);
    kMagDecal.position.set(0, -0.12, -0.04);
    kittyGroup.add(kMagDecal);

    kittyGroup.visible = false;
    this.holder.add(kittyGroup);
    this.models.push(kittyGroup);

    // 2. 彩虹波波糖果枪 (Rainbow Candy Popper)
    const shotgunGroup = new THREE.Group();
    // Rounded pastel mint receiver
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.48), pastelMintMat);
    shotgunGroup.add(sBody);

    // Twin candy cane striped barrels
    const sBarrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.38, 12), milkWhiteMat);
    sBarrel1.rotation.x = Math.PI / 2;
    sBarrel1.position.set(0.03, 0.02, -0.32);
    const sBarrel2 = sBarrel1.clone();
    sBarrel2.position.x = -0.03;
    shotgunGroup.add(sBarrel1);
    shotgunGroup.add(sBarrel2);

    // Candy spiral stripes
    for (let i = 0; i < 3; i++) {
      const stripe1 = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 6, 12), hotPinkMat);
      stripe1.position.set(0.03, 0.02, -0.22 - i * 0.09);
      const stripe2 = stripe1.clone();
      stripe2.position.x = -0.03;
      shotgunGroup.add(stripe1);
      shotgunGroup.add(stripe2);
    }

    // Top clear candy bubble hopper with colorful candies inside!
    const hopperDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, roughness: 0.1 })
    );
    hopperDome.position.set(0, 0.11, -0.06);
    shotgunGroup.add(hopperDome);

    // Mini colorful candy balls inside dome
    const candyColors = [0xff5c8a, 0xffd166, 0x06d6a0, 0x118ab2];
    candyColors.forEach((col, idx) => {
      const candy = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), new THREE.MeshBasicMaterial({ color: col }));
      const ang = (idx / 4) * Math.PI * 2;
      candy.position.set(Math.cos(ang) * 0.024, 0.105 + (idx % 2) * 0.015, -0.06 + Math.sin(ang) * 0.024);
      shotgunGroup.add(candy);
    });

    // Yellow candy grip
    const sGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.17, 0.09), candyGoldMat);
    sGrip.position.set(0, -0.14, 0.12);
    sGrip.rotation.x = 0.3;
    shotgunGroup.add(sGrip);

    // Cute ribbon on the front pump
    const sPumpBow = makeMiniBow(0.05, 0xffaa00);
    sPumpBow.position.set(0, -0.06, -0.22);
    shotgunGroup.add(sPumpBow);

    shotgunGroup.visible = false;
    this.holder.add(shotgunGroup);
    this.models.push(shotgunGroup);

    // 3. 星愿爱心魔杖炮 (Heart Magic Wand Cannon)
    const wandGroup = new THREE.Group();
    // Pearl white magical wand shaft
    const wandShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.68, 16), milkWhiteMat);
    wandShaft.rotation.x = Math.PI / 2;
    wandShaft.position.set(0, 0.02, -0.12);
    wandGroup.add(wandShaft);

    // Gold filigree ring wraps
    for (let i = 0; i < 4; i++) {
      const gRing = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.006, 8, 16), candyGoldMat);
      gRing.position.set(0, 0.02, -0.32 + i * 0.12);
      wandGroup.add(gRing);
    }

    // Glowing 3D Heart Crystal at Wand Tip
    const tipHeartShape = new THREE.Shape();
    tipHeartShape.moveTo(0, 0.02);
    tipHeartShape.bezierCurveTo(0, 0.05, -0.05, 0.05, -0.05, 0.02);
    tipHeartShape.bezierCurveTo(-0.05, -0.01, 0, -0.04, 0, -0.07);
    tipHeartShape.bezierCurveTo(0, -0.04, 0.05, -0.01, 0.05, 0.02);
    tipHeartShape.bezierCurveTo(0.05, 0.05, 0, 0.05, 0, 0.02);

    const tipExtrude = { depth: 0.02, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.01, bevelThickness: 0.01 };
    const tipHeartGeo = new THREE.ExtrudeGeometry(tipHeartShape, tipExtrude);
    tipHeartGeo.center();

    const wandHeartMat = new THREE.MeshStandardMaterial({
      color: 0xff1493,
      emissive: 0xff69b4,
      emissiveIntensity: 0.8,
      roughness: 0.15,
      metalness: 0.2
    });
    const wandHeart = new THREE.Mesh(tipHeartGeo, wandHeartMat);
    wandHeart.rotation.x = Math.PI / 2;
    wandHeart.position.set(0, 0.02, -0.5);
    wandGroup.add(wandHeart);

    // Golden Angel Wings flanking the heart tip
    [-1, 1].forEach(side => {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), candyGoldMat);
      wing.rotation.z = side * 1.2;
      wing.rotation.y = side * 0.3;
      wing.position.set(side * 0.06, 0.02, -0.47);
      wandGroup.add(wing);
    });

    // Magical holographic heart-shaped high zoom scope
    const wScope = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.12), milkWhiteMat);
    wScope.position.set(0, 0.09, 0.04);
    wandGroup.add(wScope);

    const wLens = new THREE.Mesh(new THREE.CircleGeometry(0.025, 16), new THREE.MeshBasicMaterial({ color: 0xff69b4 }));
    wLens.position.set(0, 0.09, 0.101);
    wandGroup.add(wLens);

    // Magic Wand handle with golden pommel & ribbon
    const wGrip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.17, 0.075), strawberryPinkMat);
    wGrip.position.set(0, -0.12, 0.15);
    wGrip.rotation.x = 0.28;
    wandGroup.add(wGrip);

    const wBow = makeMiniBow(0.06, 0xff2e63);
    wBow.position.set(0, 0.02, 0.18);
    wandGroup.add(wBow);

    wandGroup.visible = false;
    this.holder.add(wandGroup);
    this.models.push(wandGroup);
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
        if (this.onReloadComplete) this.onReloadComplete();
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
