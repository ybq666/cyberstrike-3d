import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];

    // Shared Geometries & Materials
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkMat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });

    // Debris Geometry for Explosions
    this.debrisGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    this.shockwaveGeo = new THREE.RingGeometry(0.2, 0.8, 32);

    // Ambient floating cyber motes
    this.initAmbientMotes();
  }

  initAmbientMotes() {
    const count = 350;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color(0xff85a2), // strawberry pink
      new THREE.Color(0xffd1dc), // baby pink
      new THREE.Color(0xffe066), // butter yellow
      new THREE.Color(0xd8bbff), // lavender
      new THREE.Color(0x99e2b4)  // pastel mint
    ];

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 110;
      pos[i * 3 + 1] = Math.random() * 25 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 110;

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.38,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    this.ambientPoints = new THREE.Points(geo, mat);
    this.scene.add(this.ambientPoints);
  }

  // 1. 击中可爱心心与彩虹糖果飞溅 (Sparks / Hearts)
  createSparks(pos, normal, colorHex = 0xff4081, count = 14) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = [];

    const sparkPalette = [
      new THREE.Color(0xff2e63),
      new THREE.Color(0xff7aa2),
      new THREE.Color(0xffd166),
      new THREE.Color(0xffffff)
    ];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      const col = sparkPalette[i % sparkPalette.length];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      const spread = 1.3;
      const v = new THREE.Vector3(
        normal.x + (Math.random() - 0.5) * spread,
        normal.y + (Math.random() - 0.5) * spread + 0.3,
        normal.z + (Math.random() - 0.5) * spread
      ).normalize().multiplyScalar(4 + Math.random() * 8);

      velocities.push(v);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.42,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    this.particles.push({
      type: 'sparks',
      mesh: points,
      velocities,
      life: 0.4,
      maxLife: 0.4
    });
  }

  // 2. 玩偶派对庆祝大爆炸 (Sweet Kawaii Party Explosion)
  createExplosion(pos, isLarge = false) {
    const pieceCount = isLarge ? 45 : 25;
    const colorHex = isLarge ? 0xff2e63 : 0xff69b4;

    // Pastel Shockwave Ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(this.shockwaveGeo, ringMat);
    ring.position.copy(pos);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);

    this.particles.push({
      type: 'shockwave',
      mesh: ring,
      scaleSpeed: isLarge ? 32 : 20,
      life: 0.45,
      maxLife: 0.45
    });

    // Colorful Candy Confetti & Heart Pieces
    const debrisGroup = new THREE.Group();
    const debrisList = [];

    const confettiPalette = [0xff2e63, 0xff7aa2, 0xffd166, 0x06d6a0, 0x118ab2, 0xd8bbff];

    for (let i = 0; i < pieceCount; i++) {
      const pColor = confettiPalette[i % confettiPalette.length];
      const pMat = new THREE.MeshStandardMaterial({
        color: pColor,
        roughness: 0.3,
        metalness: 0.1
      });

      const piece = new THREE.Mesh(this.debrisGeo, pMat);
      piece.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.8 + 0.4,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar((isLarge ? 8.5 : 5.5) + Math.random() * 6);

      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16
      );

      debrisGroup.add(piece);
      debrisList.push({ mesh: piece, vel, rotSpeed });
    }

    this.scene.add(debrisGroup);

    this.particles.push({
      type: 'debris',
      group: debrisGroup,
      pieces: debrisList,
      life: 0.8,
      maxLife: 0.8
    });

    // Warm Pink/Gold Flash Light
    const flash = new THREE.PointLight(colorHex, isLarge ? 6 : 3.5, 22);
    flash.position.copy(pos);
    this.scene.add(flash);
    this.particles.push({
      type: 'flash',
      light: flash,
      life: 0.18,
      maxLife: 0.18
    });
  }

  // 3. 萌系枪口微星光
  createMuzzleFlash(pos, colorHex = 0xff4081) {
    const flash = new THREE.PointLight(colorHex, 3, 6);
    flash.position.copy(pos);
    this.scene.add(flash);

    this.particles.push({
      type: 'flash',
      light: flash,
      life: 0.05,
      maxLife: 0.05
    });
  }

  update(dt) {
    // 1. Update ambient motes
    if (this.ambientPoints) {
      const posAttr = this.ambientPoints.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) + dt * 0.4;
        if (y > 30) y = 0.5;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
    }

    // 2. Update dynamic active particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      const progress = 1 - p.life / p.maxLife;

      if (p.type === 'sparks') {
        const posAttr = p.mesh.geometry.attributes.position;
        for (let j = 0; j < p.velocities.length; j++) {
          const v = p.velocities[j];
          v.y -= 12 * dt; // gravity
          posAttr.setXYZ(
            j,
            posAttr.getX(j) + v.x * dt,
            posAttr.getY(j) + v.y * dt,
            posAttr.getZ(j) + v.z * dt
          );
        }
        posAttr.needsUpdate = true;
        p.mesh.material.opacity = Math.max(0, 1 - progress);

        if (p.life <= 0) {
          this.scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          this.particles.splice(i, 1);
        }
      } else if (p.type === 'shockwave') {
        const s = 1 + progress * p.scaleSpeed;
        p.mesh.scale.set(s, s, s);
        p.mesh.material.opacity = (1 - progress) * 0.9;

        if (p.life <= 0) {
          this.scene.remove(p.mesh);
          p.mesh.material.dispose();
          this.particles.splice(i, 1);
        }
      } else if (p.type === 'debris') {
        for (let k = 0; k < p.pieces.length; k++) {
          const item = p.pieces[k];
          item.vel.y -= 14 * dt;
          item.mesh.position.addScaledVector(item.vel, dt);
          item.mesh.rotation.x += item.rotSpeed.x * dt;
          item.mesh.rotation.y += item.rotSpeed.y * dt;
          const scale = Math.max(0.01, 1 - progress);
          item.mesh.scale.set(scale, scale, scale);
        }

        if (p.life <= 0) {
          this.scene.remove(p.group);
          this.particles.splice(i, 1);
        }
      } else if (p.type === 'flash') {
        p.light.intensity = Math.max(0, (1 - progress) * 3);
        if (p.life <= 0) {
          this.scene.remove(p.light);
          this.particles.splice(i, 1);
        }
      }
    }
  }
}
