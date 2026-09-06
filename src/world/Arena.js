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

  // 1. 赛博网格发光地面
  initFloor() {
    // Ground base plane
    const floorGeo = new THREE.PlaneGeometry(this.size, this.size);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x060c18,
      roughness: 0.25,
      metalness: 0.8
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // Grid Overlay (High-tech neon grid lines)
    const gridHelper = new THREE.GridHelper(this.size, 50, 0x00f3ff, 0x0d2847);
    gridHelper.position.y = 0.02;
    this.scene.add(gridHelper);

    // Secondary pulsing rings on floor
    const ringGeo = new THREE.RingGeometry(18, 18.3, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.scene.add(ring);
  }

  // 2. 外围防线与能量屏障
  initPerimeter() {
    const wallHeight = 7;
    const wallThickness = 2;
    const half = this.size / 2;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0b1329,
      roughness: 0.5,
      metalness: 0.85
    });

    const borderNeonMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff
    });

    const wallConfigs = [
      { size: [this.size, wallHeight, wallThickness], pos: [0, wallHeight / 2, -half] },
      { size: [this.size, wallHeight, wallThickness], pos: [0, wallHeight / 2, half] },
      { size: [wallThickness, wallHeight, this.size], pos: [-half, wallHeight / 2, 0] },
      { size: [wallThickness, wallHeight, this.size], pos: [half, wallHeight / 2, 0] },
    ];

    wallConfigs.forEach(cfg => {
      const geo = new THREE.BoxGeometry(...cfg.size);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(...cfg.pos);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.scene.add(mesh);

      // Top neon stripe
      const stripHeight = 0.2;
      const isX = cfg.size[0] > cfg.size[2];
      const stripGeo = new THREE.BoxGeometry(
        isX ? this.size : 0.4,
        stripHeight,
        isX ? 0.4 : this.size
      );
      const strip = new THREE.Mesh(stripGeo, borderNeonMat);
      strip.position.set(cfg.pos[0], wallHeight, cfg.pos[2]);
      this.scene.add(strip);

      // Add to colliders
      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push({ box, type: 'wall' });
    });
  }

  // 3. 中央能源核心柱
  initCentralCore() {
    const coreGroup = new THREE.Group();

    // Central Pillar
    const pillarGeo = new THREE.CylinderGeometry(2.5, 3.2, 14, 16);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x091428,
      metalness: 0.9,
      roughness: 0.3
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 7;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    coreGroup.add(pillar);

    // Glowing energy ring inside pillar
    const energyGeo = new THREE.CylinderGeometry(1.8, 1.8, 4, 16);
    const energyMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      wireframe: true
    });
    const energy = new THREE.Mesh(energyGeo, energyMat);
    energy.position.y = 7;
    coreGroup.add(energy);
    this.coreEnergyMesh = energy;

    // Outer rotating beacon rings
    const ringGeo = new THREE.TorusGeometry(4.2, 0.15, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    this.coreRing1 = new THREE.Mesh(ringGeo, ringMat);
    this.coreRing1.position.y = 9;
    this.coreRing1.rotation.x = Math.PI / 3;
    coreGroup.add(this.coreRing1);

    this.coreRing2 = new THREE.Mesh(ringGeo, ringMat);
    this.coreRing2.position.y = 5;
    this.coreRing2.rotation.x = -Math.PI / 4;
    coreGroup.add(this.coreRing2);

    this.scene.add(coreGroup);

    // Collider for central core
    const coreBox = new THREE.Box3(
      new THREE.Vector3(-3.2, 0, -3.2),
      new THREE.Vector3(3.2, 14, 3.2)
    );
    this.colliders.push({ box: coreBox, type: 'core' });
  }

  // 4. 战术掩体与平台
  initCoversAndPlatforms() {
    const coverMat = new THREE.MeshStandardMaterial({
      color: 0x111c38,
      metalness: 0.85,
      roughness: 0.35
    });

    const neonOrangeMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });

    // 掩体分布配置 (对称战术掩护)
    const coverConfigs = [
      // 靠近中心的4个L型或直条掩体
      { size: [7, 2.8, 1.4], pos: [12, 1.4, 12], rot: 0.3 },
      { size: [7, 2.8, 1.4], pos: [-12, 1.4, 12], rot: -0.3 },
      { size: [7, 2.8, 1.4], pos: [12, 1.4, -12], rot: -0.3 },
      { size: [7, 2.8, 1.4], pos: [-12, 1.4, -12], rot: 0.3 },

      // 外圈大型重装集装箱
      { size: [8, 3.5, 4], pos: [26, 1.75, 0], rot: 0 },
      { size: [8, 3.5, 4], pos: [-26, 1.75, 0], rot: 0 },
      { size: [4, 3.5, 8], pos: [0, 1.75, 26], rot: 0 },
      { size: [4, 3.5, 8], pos: [0, 1.75, -26], rot: 0 },

      // 角落高台掩体
      { size: [6, 2.2, 3], pos: [34, 1.1, 34], rot: 0.78 },
      { size: [6, 2.2, 3], pos: [-34, 1.1, 34], rot: -0.78 },
      { size: [6, 2.2, 3], pos: [34, 1.1, -34], rot: -0.78 },
      { size: [6, 2.2, 3], pos: [-34, 1.1, -34], rot: 0.78 },
    ];

    coverConfigs.forEach((cfg, idx) => {
      const geo = new THREE.BoxGeometry(...cfg.size);
      const mesh = new THREE.Mesh(geo, coverMat);
      mesh.position.set(...cfg.pos);
      mesh.rotation.y = cfg.rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Neon accent edge
      const edgeMat = (idx % 2 === 0) ? neonCyanMat : neonOrangeMat;
      const edgeGeo = new THREE.BoxGeometry(cfg.size[0] * 0.8, 0.1, 0.15);
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.set(0, cfg.size[1] / 2 + 0.05, 0);
      mesh.add(edge);

      // Add to colliders with accurate world box
      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push({ box, type: 'cover' });
    });
  }

  // 5. 重力弹跳垫 (Jump Pads)
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

      // Pad Base Platform
      const baseGeo = new THREE.CylinderGeometry(2.4, 2.7, 0.3, 24);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x0a1428,
        metalness: 0.9,
        roughness: 0.3
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.15;
      baseMesh.receiveShadow = true;
      padGroup.add(baseMesh);

      // Glowing Launch Emitter Rings
      const ringGeo = new THREE.RingGeometry(0.8, 2.0, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.32;
      padGroup.add(ring);

      // Vertical upward beacon beam
      const beamGeo = new THREE.CylinderGeometry(1.2, 1.2, 4, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 2.3;
      padGroup.add(beam);

      // Light
      const light = new THREE.PointLight(0x00ff88, 1.8, 12);
      light.position.y = 1.0;
      padGroup.add(light);

      this.scene.add(padGroup);

      this.jumpPads.push({
        position: pos,
        radius: 2.5,
        ringMesh: ring,
        beamMesh: beam,
        impulse: 26 // Strong upward launch impulse
      });
    });
  }

  update(dt) {
    // Animate central core rings
    if (this.coreRing1) {
      this.coreRing1.rotation.z += dt * 1.5;
      this.coreRing2.rotation.z -= dt * 1.2;
    }
    if (this.coreEnergyMesh) {
      this.coreEnergyMesh.rotation.y += dt * 2;
    }

    // Animate jump pad beacon beams pulsing
    for (const pad of this.jumpPads) {
      pad.ringMesh.rotation.z += dt * 1.8;
      pad.beamMesh.material.opacity = 0.2 + Math.sin(Date.now() * 0.006) * 0.1;
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
