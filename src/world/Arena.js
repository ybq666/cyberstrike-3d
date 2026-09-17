import * as THREE from 'three';

export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.size = 100; // 100 x 100 arena
    this.colliders = []; // THREE.Box3 bounding boxes for collision
    this.jumpPads = [];  // Jump pad entities

    this.initFloor();
    this.initPerimeter();
    this.initCentralCore();
    this.initCoversAndPlatforms();
    this.initJumpPads();
  }

  // Helper to create a Hello Kitty style 3D ribbon bow
  createRibbonBow(scale = 1.0, ribbonColor = 0xff3366) {
    const bowGroup = new THREE.Group();
    const bowMat = new THREE.MeshStandardMaterial({
      color: ribbonColor,
      roughness: 0.35,
      metalness: 0.1
    });

    // Central knot
    const knotGeo = new THREE.SphereGeometry(0.25 * scale, 12, 12);
    const knot = new THREE.Mesh(knotGeo, bowMat);
    knot.scale.set(1.1, 1.0, 0.7);
    bowGroup.add(knot);

    // Left & Right loops (flattened and rotated cones/rings)
    [-1, 1].forEach(side => {
      const loopGeo = new THREE.ConeGeometry(0.42 * scale, 0.75 * scale, 16);
      const loop = new THREE.Mesh(loopGeo, bowMat);
      loop.rotation.z = side * (Math.PI / 2 + 0.15);
      loop.scale.set(1, 0.45, 0.9);
      loop.position.set(side * 0.42 * scale, 0, 0);
      bowGroup.add(loop);

      // Ribbon tails
      const tailGeo = new THREE.BoxGeometry(0.22 * scale, 0.65 * scale, 0.06 * scale);
      const tail = new THREE.Mesh(tailGeo, bowMat);
      tail.position.set(side * 0.25 * scale, -0.45 * scale, -0.05 * scale);
      tail.rotation.z = side * -0.3;
      bowGroup.add(tail);
    });

    return bowGroup;
  }

  // 1. 草莓奶霜粉白格子地面 & 萌系爱心蝴蝶结地毯
  initFloor() {
    // Generate high-resolution procedural sweet checkerboard canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const tileSize = 64;
    for (let x = 0; x < 512; x += tileSize) {
      for (let y = 0; y < 512; y += tileSize) {
        const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        ctx.fillStyle = isEven ? '#fff5f8' : '#ffd1df';
        ctx.fillRect(x, y, tileSize, tileSize);

        // Cute polka dots or mini hearts inside pink tiles
        if (!isEven) {
          ctx.fillStyle = '#ff85a2';
          ctx.beginPath();
          ctx.arc(x + tileSize / 2, y + tileSize / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const floorTex = new THREE.CanvasTexture(canvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(16, 16);

    const floorGeo = new THREE.PlaneGeometry(this.size, this.size);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.45,
      metalness: 0.1
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // Subtle soft pink pastel grid lines
    const gridHelper = new THREE.GridHelper(this.size, 50, 0xff69b4, 0xffccd9);
    gridHelper.position.y = 0.02;
    this.scene.add(gridHelper);

    // Giant Sweet Center Ring & Bow Motif on Floor
    const ringGeo = new THREE.RingGeometry(18, 18.5, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff69b4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.scene.add(ring);

    // Scalloped lace dots around center ring
    const dotCount = 36;
    for (let i = 0; i < dotCount; i++) {
      const angle = (i / dotCount) * Math.PI * 2;
      const dotGeo = new THREE.CircleGeometry(0.35, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xff3366, side: THREE.DoubleSide });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(Math.cos(angle) * 18.25, 0.035, Math.sin(angle) * 18.25);
      this.scene.add(dot);
    }
  }

  // 2. 草莓威化饼外围墙 & 奶油花边
  initPerimeter() {
    const wallHeight = 7;
    const wallThickness = 2;
    const half = this.size / 2;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffb8cb, // strawberry milk
      roughness: 0.6,
      metalness: 0.1
    });

    const creamMat = new THREE.MeshStandardMaterial({
      color: 0xfffdfa, // whipped cream frosting
      roughness: 0.3,
      metalness: 0.05
    });

    const wallConfigs = [
      { size: [this.size, wallHeight, wallThickness], pos: [0, wallHeight / 2, -half], rotY: 0 },
      { size: [this.size, wallHeight, wallThickness], pos: [0, wallHeight / 2, half], rotY: Math.PI },
      { size: [wallThickness, wallHeight, this.size], pos: [-half, wallHeight / 2, 0], rotY: Math.PI / 2 },
      { size: [wallThickness, wallHeight, this.size], pos: [half, wallHeight / 2, 0], rotY: -Math.PI / 2 },
    ];

    wallConfigs.forEach(cfg => {
      const geo = new THREE.BoxGeometry(...cfg.size);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(...cfg.pos);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.scene.add(mesh);

      // Cream frosting stripe on top
      const isX = cfg.size[0] > cfg.size[2];
      const stripGeo = new THREE.BoxGeometry(
        isX ? this.size : 0.6,
        0.35,
        isX ? 0.6 : this.size
      );
      const strip = new THREE.Mesh(stripGeo, creamMat);
      strip.position.set(cfg.pos[0], wallHeight + 0.15, cfg.pos[2]);
      this.scene.add(strip);

      // Sweet Hello Kitty giant bow in the middle of each outer wall
      const bow = this.createRibbonBow(2.4, 0xff2e63);
      bow.position.set(
        cfg.pos[0] === 0 ? 0 : (cfg.pos[0] > 0 ? half - 1.05 : -half + 1.05),
        wallHeight * 0.65,
        cfg.pos[2] === 0 ? 0 : (cfg.pos[2] > 0 ? half - 1.05 : -half + 1.05)
      );
      bow.rotation.y = cfg.rotY;
      this.scene.add(bow);

      // Add to colliders
      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push({ box, type: 'wall' });
    });
  }

  // 3. 巨型草莓甜点城堡中央核心塔
  initCentralCore() {
    const coreGroup = new THREE.Group();

    // Bottom tier cake
    const tier1Geo = new THREE.CylinderGeometry(3.6, 4.0, 5, 24);
    const tier1Mat = new THREE.MeshStandardMaterial({
      color: 0xff99bb,
      roughness: 0.35,
      metalness: 0.1
    });
    const tier1 = new THREE.Mesh(tier1Geo, tier1Mat);
    tier1.position.y = 2.5;
    tier1.castShadow = true;
    tier1.receiveShadow = true;
    coreGroup.add(tier1);

    // Whipped cream ruffle rim
    const creamRimGeo = new THREE.TorusGeometry(3.8, 0.25, 12, 32);
    const creamMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2
    });
    const creamRim1 = new THREE.Mesh(creamRimGeo, creamMat);
    creamRim1.rotation.x = Math.PI / 2;
    creamRim1.position.y = 5.0;
    coreGroup.add(creamRim1);

    // Top tier cake
    const tier2Geo = new THREE.CylinderGeometry(2.6, 2.9, 9, 24);
    const tier2Mat = new THREE.MeshStandardMaterial({
      color: 0xfff0f5,
      roughness: 0.3,
      metalness: 0.05
    });
    const tier2 = new THREE.Mesh(tier2Geo, tier2Mat);
    tier2.position.y = 9.5;
    tier2.castShadow = true;
    tier2.receiveShadow = true;
    coreGroup.add(tier2);

    // Swirling strawberry magic heart crystal at the core
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 0.4);
    heartShape.bezierCurveTo(0, 0.9, -0.9, 0.9, -0.9, 0.4);
    heartShape.bezierCurveTo(-0.9, -0.1, 0, -0.6, 0, -1.0);
    heartShape.bezierCurveTo(0, -0.6, 0.9, -0.1, 0.9, 0.4);
    heartShape.bezierCurveTo(0.9, 0.9, 0, 0.9, 0, 0.4);

    const extrudeSettings = { depth: 0.4, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.15, bevelThickness: 0.15 };
    const heartGeo = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
    heartGeo.center();

    const heartMat = new THREE.MeshStandardMaterial({
      color: 0xff1493,
      emissive: 0xff69b4,
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.3
    });
    this.coreHeartMesh = new THREE.Mesh(heartGeo, heartMat);
    this.coreHeartMesh.position.y = 14.5;
    this.coreHeartMesh.scale.set(1.5, 1.5, 1.5);
    coreGroup.add(this.coreHeartMesh);

    // Outer rotating pastel ribbon rings
    const ringGeo = new THREE.TorusGeometry(4.6, 0.16, 8, 36);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0xff69b4 });
    this.coreRing1 = new THREE.Mesh(ringGeo, ringMat1);
    this.coreRing1.position.y = 10;
    this.coreRing1.rotation.x = Math.PI / 3;
    coreGroup.add(this.coreRing1);

    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    this.coreRing2 = new THREE.Mesh(ringGeo, ringMat2);
    this.coreRing2.position.y = 6;
    this.coreRing2.rotation.x = -Math.PI / 4;
    coreGroup.add(this.coreRing2);

    // Sweet ribbon bows decorating the tower
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const bow = this.createRibbonBow(1.2, 0xff3366);
      bow.position.set(Math.cos(angle) * 3.8, 3.2, Math.sin(angle) * 3.8);
      bow.rotation.y = -angle + Math.PI / 2;
      coreGroup.add(bow);
    }

    this.scene.add(coreGroup);

    // Collider for central core
    const coreBox = new THREE.Box3(
      new THREE.Vector3(-4.0, 0, -4.0),
      new THREE.Vector3(4.0, 16, 4.0)
    );
    this.colliders.push({ box: coreBox, type: 'core' });
  }

  // 4. 战术掩体：巨型礼物盒、草莓奶盒与马卡龙甜心方块
  initCoversAndPlatforms() {
    const giftBoxMatPink = new THREE.MeshStandardMaterial({ color: 0xff85a2, roughness: 0.4, metalness: 0.1 });
    const giftBoxMatMint = new THREE.MeshStandardMaterial({ color: 0x99e2b4, roughness: 0.4, metalness: 0.1 });
    const giftBoxMatLavender = new THREE.MeshStandardMaterial({ color: 0xd8bbff, roughness: 0.4, metalness: 0.1 });
    const giftBoxMatCream = new THREE.MeshStandardMaterial({ color: 0xffe599, roughness: 0.4, metalness: 0.1 });

    const ribbonMatGold = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const ribbonMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const materials = [giftBoxMatPink, giftBoxMatMint, giftBoxMatLavender, giftBoxMatCream];

    const coverConfigs = [
      // 靠近中心的4个L型或条状奶盒/礼盒掩体
      { size: [7, 2.8, 1.4], pos: [12, 1.4, 12], rot: 0.3 },
      { size: [7, 2.8, 1.4], pos: [-12, 1.4, 12], rot: -0.3 },
      { size: [7, 2.8, 1.4], pos: [12, 1.4, -12], rot: -0.3 },
      { size: [7, 2.8, 1.4], pos: [-12, 1.4, -12], rot: 0.3 },

      // 外圈大型重装礼物盒
      { size: [8, 3.5, 4], pos: [26, 1.75, 0], rot: 0 },
      { size: [8, 3.5, 4], pos: [-26, 1.75, 0], rot: 0 },
      { size: [4, 3.5, 8], pos: [0, 1.75, 26], rot: 0 },
      { size: [4, 3.5, 8], pos: [0, 1.75, -26], rot: 0 },

      // 角落高台马卡龙掩体
      { size: [6, 2.2, 3], pos: [34, 1.1, 34], rot: 0.78 },
      { size: [6, 2.2, 3], pos: [-34, 1.1, 34], rot: -0.78 },
      { size: [6, 2.2, 3], pos: [34, 1.1, -34], rot: -0.78 },
      { size: [6, 2.2, 3], pos: [-34, 1.1, -34], rot: 0.78 },
    ];

    coverConfigs.forEach((cfg, idx) => {
      const geo = new THREE.BoxGeometry(...cfg.size);
      const mat = materials[idx % materials.length];
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...cfg.pos);
      mesh.rotation.y = cfg.rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // 礼物盒丝带十字装饰 (Gift Box Ribbon Cross)
      const rMat = (idx % 2 === 0) ? ribbonMatWhite : ribbonMatGold;
      const ribbonBand1 = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.size[0] + 0.05, cfg.size[1] + 0.05, 0.25),
        rMat
      );
      mesh.add(ribbonBand1);

      const ribbonBand2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, cfg.size[1] + 0.05, cfg.size[2] + 0.05),
        rMat
      );
      mesh.add(ribbonBand2);

      // 礼物盒顶部的 3D 蝴蝶结 (Ribbon Bow on top)
      const bow = this.createRibbonBow(1.1, idx % 2 === 0 ? 0xff3366 : 0xffaa00);
      bow.position.set(0, cfg.size[1] / 2 + 0.2, 0);
      mesh.add(bow);

      // Add to colliders with accurate world box
      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push({ box, type: 'cover' });
    });
  }

  // 5. 草莓果冻布丁弹跳垫 (Strawberry Jelly Pudding Jump Pads)
  initJumpPads() {
    const padLocations = [
      new THREE.Vector3(22, 0, 22),
      new THREE.Vector3(-22, 0, 22),
      new THREE.Vector3(22, 0, -22),
      new THREE.Vector3(-22, 0, -22),
    ];

    padLocations.forEach((pos) => {
      const padGroup = new THREE.Group();
      padGroup.position.copy(pos);

      // Sweet porcelain dish base
      const baseGeo = new THREE.CylinderGeometry(2.5, 2.8, 0.25, 24);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0xfffcf8,
        roughness: 0.2,
        metalness: 0.1
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.12;
      baseMesh.receiveShadow = true;
      padGroup.add(baseMesh);

      // Translucent Strawberry Jelly Pudding Bouncer
      const puddingGeo = new THREE.CylinderGeometry(1.6, 2.1, 0.4, 24);
      const puddingMat = new THREE.MeshStandardMaterial({
        color: 0xff3377,
        roughness: 0.15,
        metalness: 0.2,
        transparent: true,
        opacity: 0.88
      });
      const puddingMesh = new THREE.Mesh(puddingGeo, puddingMat);
      puddingMesh.position.y = 0.35;
      padGroup.add(puddingMesh);

      // Cute white heart decal on top of the pudding
      const heartDecalGeo = new THREE.RingGeometry(0.3, 1.2, 24);
      const heartDecalMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95
      });
      const heartDecal = new THREE.Mesh(heartDecalGeo, heartDecalMat);
      heartDecal.rotation.x = -Math.PI / 2;
      heartDecal.position.y = 0.56;
      padGroup.add(heartDecal);

      // Upward fairy magic sparkling beam
      const beamGeo = new THREE.CylinderGeometry(1.2, 1.2, 4, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xff85a2,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 2.4;
      padGroup.add(beam);

      // Warm pink fairy light
      const light = new THREE.PointLight(0xff69b4, 1.8, 12);
      light.position.y = 1.0;
      padGroup.add(light);

      this.scene.add(padGroup);

      this.jumpPads.push({
        position: pos,
        radius: 2.5,
        puddingMesh,
        ringMesh: heartDecal,
        beamMesh: beam,
        impulse: 26
      });
    });
  }

  update(dt) {
    // Animate central core rings and heart
    if (this.coreRing1) {
      this.coreRing1.rotation.z += dt * 1.5;
      this.coreRing2.rotation.z -= dt * 1.2;
    }
    if (this.coreHeartMesh) {
      this.coreHeartMesh.rotation.y += dt * 1.8;
      const pulse = 1.5 + Math.sin(Date.now() * 0.005) * 0.12;
      this.coreHeartMesh.scale.set(pulse, pulse, pulse);
    }

    // Animate jump pad pudding bounce & beam pulse
    for (const pad of this.jumpPads) {
      pad.ringMesh.rotation.z += dt * 1.8;
      pad.beamMesh.material.opacity = 0.25 + Math.sin(Date.now() * 0.006) * 0.12;
      const bScale = 1.0 + Math.sin(Date.now() * 0.008) * 0.06;
      pad.puddingMesh.scale.set(bScale, 1.0, bScale);
    }
  }

  // Check if position triggers a jump pad
  checkJumpPad(playerPos) {
    for (const pad of this.jumpPads) {
      const dx = playerPos.x - pad.position.x;
      const dz = playerPos.z - pad.position.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < pad.radius * pad.radius && Math.abs(playerPos.y - pad.position.y) < 1.5) {
        return pad;
      }
    }
    return null;
  }

  // Collision resolution for player bounding cylinder/box against arena
  resolveCollision(playerPos, radius = 0.6) {
    const minX = -this.size / 2 + 1.5;
    const maxX = this.size / 2 - 1.5;
    const minZ = -this.size / 2 + 1.5;
    const maxZ = this.size / 2 - 1.5;

    // Arena boundary clamp
    playerPos.x = Math.max(minX, Math.min(maxX, playerPos.x));
    playerPos.z = Math.max(minZ, Math.min(maxZ, playerPos.z));

    // Obstacle collisions
    for (const { box } of this.colliders) {
      if (
        playerPos.x + radius > box.min.x &&
        playerPos.x - radius < box.max.x &&
        playerPos.z + radius > box.min.z &&
        playerPos.z - radius < box.max.z &&
        playerPos.y < box.max.y &&
        playerPos.y + 1.8 > box.min.y
      ) {
        // Push out along shortest penetration axis
        const overlapX1 = (playerPos.x + radius) - box.min.x;
        const overlapX2 = box.max.x - (playerPos.x - radius);
        const overlapZ1 = (playerPos.z + radius) - box.min.z;
        const overlapZ2 = box.max.z - (playerPos.z - radius);

        const minOverlapX = Math.min(overlapX1, overlapX2);
        const minOverlapZ = Math.min(overlapZ1, overlapZ2);

        if (minOverlapX < minOverlapZ) {
          if (overlapX1 < overlapX2) {
            playerPos.x = box.min.x - radius;
          } else {
            playerPos.x = box.max.x + radius;
          }
        } else {
          if (overlapZ1 < overlapZ2) {
            playerPos.z = box.min.z - radius;
          } else {
            playerPos.z = box.max.z + radius;
          }
        }
      }
    }
  }
}
