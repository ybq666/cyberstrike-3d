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

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 110;
      pos[i * 3 + 1] = Math.random() * 25 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 110;

      const isCyan = Math.random() > 0.3;
      colors[i * 3] = isCyan ? 0.0 : 1.0;
      colors[i * 3 + 1] = isCyan ? 0.95 : 0.0;
      colors[i * 3 + 2] = isCyan ? 1.0 : 0.5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    this.ambientPoints = new THREE.Points(geo, mat);
    this.scene.add(this.ambientPoints);
  }

  // 1. 击中火花飞溅 (Sparks)
  createSparks(pos, normal, colorHex = 0x00f3ff, count = 12) {
    const group = new THREE.Group();
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      // Reflect outwards around normal
      const spread = 1.2;
      const v = new THREE.Vector3(
        normal.x + (Math.random() - 0.5) * spread,
        normal.y + (Math.random() - 0.5) * spread,
        normal.z + (Math.random() - 0.5) * spread
      ).normalize().multiplyScalar(4 + Math.random() * 8);

      velocities.push(v);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: colorHex,
      size: 0.28,
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
      life: 0.35,
      maxLife: 0.35
    });
  }

  // 2. 敌人死亡大爆炸 (Neon Explosion)
  createExplosion(pos, isLarge = false) {
    const pieceCount = isLarge ? 40 : 22;
    const colorHex = isLarge ? 0xff0055 : 0x00f3ff;

    // Shockwave Ring
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
      scaleSpeed: isLarge ? 30 : 18,
      life: 0.4,
      maxLife: 0.4
    });

    // Debris cubes
    const debrisGroup = new THREE.Group();
    const debrisList = [];

    const debrisMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      wireframe: true
    });

    for (let i = 0; i < pieceCount; i++) {
      const piece = new THREE.Mesh(this.debrisGeo, debrisMat);
      piece.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5 + 0.3,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar((isLarge ? 8 : 5) + Math.random() * 6);

      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      );

      debrisGroup.add(piece);
      debrisList.push({ mesh: piece, vel, rotSpeed });
    }

    this.scene.add(debrisGroup);

    this.particles.push({
      type: 'debris',
      group: debrisGroup,
      pieces: debrisList,
      life: 0.7,
      maxLife: 0.7
    });

    // Flash light
    const flash = new THREE.PointLight(colorHex, isLarge ? 6 : 3, 20);
    flash.position.copy(pos);
    this.scene.add(flash);
    this.particles.push({
      type: 'flash',
      light: flash,
      life: 0.15,
      maxLife: 0.15
    });
  }

  // 3. 枪口火焰微粒子
  createMuzzleFlash(pos, colorHex = 0x00f3ff) {
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
