import * as THREE from 'three';

export class ProjectileManager {
  constructor(scene) {
    this.scene = scene;
    this.projectiles = [];

    // Shared Geometries & Materials
    this.plasmaGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    this.plasmaGeo.rotateX(Math.PI / 2);

    this.pelletGeo = new THREE.SphereGeometry(0.06, 6, 6);
    this.enemyOrbGeo = new THREE.SphereGeometry(0.2, 12, 12);

    this.beamGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    this.beamGeo.rotateX(Math.PI / 2);
  }

  // 1. 发射玩家子弹 (等离子/霰弹)
  spawnPlayerProjectile(origin, direction, speed, damage, colorHex, isPellet = false) {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex
    });

    const mesh = new THREE.Mesh(isPellet ? this.pelletGeo : this.plasmaGeo, mat);
    mesh.position.copy(origin);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.clone().normalize());

    // Small light for plasma bolt
    let light = null;
    if (!isPellet) {
      light = new THREE.PointLight(colorHex, 1.5, 6);
      mesh.add(light);
    }

    this.scene.add(mesh);

    this.projectiles.push({
      isEnemy: false,
      mesh,
      velocity: direction.clone().normalize().multiplyScalar(speed),
      damage,
      colorHex,
      radius: isPellet ? 0.15 : 0.25,
      life: 2.5
    });
  }

  // 2. 磁轨炮即时激光束 (Hitscan Beam)
  spawnRailgunBeam(startPos, endPos, colorHex = 0xff0077) {
    const dist = startPos.distanceTo(endPos);
    const midPoint = startPos.clone().add(endPos).multiplyScalar(0.5);

    const geo = new THREE.CylinderGeometry(0.06, 0.06, dist, 8);
    geo.rotateX(Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(midPoint);
    mesh.lookAt(endPos);

    this.scene.add(mesh);

    // Inner bright core
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0
    });
    const coreGeo = new THREE.CylinderGeometry(0.02, 0.02, dist, 6);
    coreGeo.rotateX(Math.PI / 2);
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    mesh.add(coreMesh);

    this.projectiles.push({
      isBeam: true,
      mesh,
      coreMesh,
      mat,
      coreMat,
      life: 0.25,
      maxLife: 0.25
    });
  }

  // 3. 敌人发射敌对等离子球 (Enemy Plasma Orb)
  spawnEnemyProjectile(origin, direction, speed = 26, damage = 18) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff2244
    });

    const mesh = new THREE.Mesh(this.enemyOrbGeo, mat);
    mesh.position.copy(origin);

    const light = new THREE.PointLight(0xff2244, 2.0, 8);
    mesh.add(light);

    this.scene.add(mesh);

    this.projectiles.push({
      isEnemy: true,
      mesh,
      velocity: direction.clone().normalize().multiplyScalar(speed),
      damage,
      colorHex: 0xff2244,
      radius: 0.35,
      life: 4.0
    });
  }

  // 更新所有子弹飞行与碰撞
  update(dt, arena, enemies, player, particleSystem, floatingText, soundEngine, onPlayerDamaged) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      // Handle fading beam
      if (p.isBeam) {
        p.life -= dt;
        const progress = 1 - p.life / p.maxLife;
        p.mat.opacity = (1 - progress) * 0.9;
        p.coreMat.opacity = 1 - progress;

        if (p.life <= 0) {
          this.scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mat.dispose();
          p.coreMat.dispose();
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      // Moving projectile
      p.life -= dt;
      const step = p.velocity.clone().multiplyScalar(dt);
      const nextPos = p.mesh.position.clone().add(step);

      // Check collision with arena bounds and obstacles
      let hitObstacle = false;
      if (
        nextPos.x < -arena.size / 2 || nextPos.x > arena.size / 2 ||
        nextPos.z < -arena.size / 2 || nextPos.z > arena.size / 2 ||
        nextPos.y < 0.1 || nextPos.y > 25
      ) {
        hitObstacle = true;
      }

      if (!hitObstacle) {
        for (const { box } of arena.colliders) {
          if (box.containsPoint(nextPos)) {
            hitObstacle = true;
            break;
          }
        }
      }

      if (hitObstacle) {
        particleSystem.createSparks(p.mesh.position, new THREE.Vector3(0, 1, 0), p.colorHex, 8);
        this.destroyProjectile(i);
        continue;
      }

      // 1. Player projectile hitting enemies
      if (!p.isEnemy) {
        let hitEnemy = false;
        for (const enemy of enemies) {
          if (enemy.isDead) continue;

          const dist = nextPos.distanceTo(enemy.getCenter());
          if (dist < enemy.radius + p.radius) {
            // Check Headshot/Weakpoint (if hit height is in top 30% of enemy model)
            const relativeY = nextPos.y - enemy.position.y;
            const isCrit = relativeY > enemy.height * 0.7;
            const finalDamage = isCrit ? p.damage * 2.0 : p.damage;

            enemy.takeDamage(finalDamage);
            particleSystem.createSparks(nextPos, p.velocity.clone().negate().normalize(), 0xff3355, 12);
            floatingText.showDamage(nextPos, finalDamage, isCrit);
            soundEngine.playHitmarker(isCrit);

            hitEnemy = true;
            break;
          }
        }

        if (hitEnemy) {
          this.destroyProjectile(i);
          continue;
        }
      }

      // 2. Enemy projectile hitting player
      if (p.isEnemy) {
        const pCenter = player.getCenter();
        const dist = nextPos.distanceTo(pCenter);

        if (dist < player.radius + p.radius) {
          // Player hit!
          particleSystem.createSparks(nextPos, p.velocity.clone().negate().normalize(), 0xff0044, 15);
          if (onPlayerDamaged) {
            onPlayerDamaged(p.damage, p.mesh.position);
          }
          this.destroyProjectile(i);
          continue;
        }
      }

      p.mesh.position.copy(nextPos);

      if (p.life <= 0) {
        this.destroyProjectile(i);
      }
    }
  }

  destroyProjectile(index) {
    const p = this.projectiles[index];
    this.scene.remove(p.mesh);
    this.projectiles.splice(index, 1);
  }

  clear() {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
    }
    this.projectiles = [];
  }
}
