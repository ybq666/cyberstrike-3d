import * as THREE from 'three';

export class ProjectileManager {
  constructor(scene) {
    this.scene = scene;
    this.projectiles = [];

    // 1. Cute Heart Shape Geometry for Strawberry SMG
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 0.1);
    heartShape.bezierCurveTo(0, 0.24, -0.22, 0.24, -0.22, 0.1);
    heartShape.bezierCurveTo(-0.22, -0.05, 0, -0.15, 0, -0.25);
    heartShape.bezierCurveTo(0, -0.15, 0.22, -0.05, 0.22, 0.1);
    heartShape.bezierCurveTo(0.22, 0.24, 0, 0.24, 0, 0.1);

    const heartExtrude = { depth: 0.08, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
    this.heartGeo = new THREE.ExtrudeGeometry(heartShape, heartExtrude);
    this.heartGeo.center();
    this.heartGeo.scale(1.2, 1.2, 1.2);

    // 2. Rainbow Candy Pellets (Shotgun)
    this.pelletGeo = new THREE.DodecahedronGeometry(0.1);

    // 3. Mischievous Purple Candy Orbs (Enemies)
    this.enemyOrbGeo = new THREE.SphereGeometry(0.24, 12, 12);
  }

  // 1. 发射草莓心心子弹 / 彩虹糖果散弹
  spawnPlayerProjectile(origin, direction, speed, damage, colorHex, isPellet = false) {
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.1
    });

    const mesh = new THREE.Mesh(isPellet ? this.pelletGeo : this.heartGeo, mat);
    mesh.position.copy(origin);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.clone().normalize());

    // Sweet pastel light for flying hearts
    const light = new THREE.PointLight(colorHex, isPellet ? 1.0 : 1.8, 6);
    mesh.add(light);

    this.scene.add(mesh);

    this.projectiles.push({
      isEnemy: false,
      mesh,
      velocity: direction.clone().normalize().multiplyScalar(speed),
      damage,
      colorHex,
      radius: isPellet ? 0.2 : 0.35,
      life: 2.5
    });
  }

  // 2. 星愿爱心魔杖粉红星光即时射线 (Hitscan Beam)
  spawnRailgunBeam(startPos, endPos, colorHex = 0xff1493) {
    const dist = startPos.distanceTo(endPos);
    const midPoint = startPos.clone().add(endPos).multiplyScalar(0.5);

    const geo = new THREE.CylinderGeometry(0.08, 0.08, dist, 8);
    geo.rotateX(Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(midPoint);
    mesh.lookAt(endPos);

    this.scene.add(mesh);

    // Inner sparkling gold/white magical star core
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xfff0aa,
      transparent: true,
      opacity: 1.0
    });
    const coreGeo = new THREE.CylinderGeometry(0.03, 0.03, dist, 6);
    coreGeo.rotateX(Math.PI / 2);
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    mesh.add(coreMesh);

    this.projectiles.push({
      isBeam: true,
      mesh,
      coreMesh,
      mat,
      coreMat,
      life: 0.28,
      maxLife: 0.28
    });
  }

  // 3. 敌人发射淘气紫色糖果波 (Enemy Candy Orb)
  spawnEnemyProjectile(origin, direction, speed = 26, damage = 18) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9d4edd,
      emissive: 0x7b2cbf,
      emissiveIntensity: 0.7,
      roughness: 0.3
    });

    const mesh = new THREE.Mesh(this.enemyOrbGeo, mat);
    mesh.position.copy(origin);

    const light = new THREE.PointLight(0xb5179e, 2.0, 8);
    mesh.add(light);

    this.scene.add(mesh);

    this.projectiles.push({
      isEnemy: true,
      mesh,
      velocity: direction.clone().normalize().multiplyScalar(speed),
      damage,
      colorHex: 0x9d4edd,
      radius: 0.38,
      life: 4.0
    });
  }

  // 更新所有子弹飞行与碰撞
  update(dt, arena, enemies, player, particleSystem, floatingText, soundEngine, onPlayerDamaged, remotePlayers = [], onRemotePlayerHit = null) {
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

      // 1. Player projectile hitting enemies or remote players
      if (!p.isEnemy) {
        let hitTarget = false;

        // Check remote players (PvP)
        if (remotePlayers && remotePlayers.length > 0) {
          for (const rPlayer of remotePlayers) {
            if (rPlayer.isDead || rPlayer.isInvulnerable) continue;

            const dist = nextPos.distanceTo(rPlayer.getCenter());
            if (dist < rPlayer.radius + p.radius) {
              const isCrit = (nextPos.y - rPlayer.position.y) > 1.35;
              const finalDamage = isCrit ? p.damage * 2.0 : p.damage;

              rPlayer.takeDamage(finalDamage);
              particleSystem.createSparks(nextPos, p.velocity.clone().negate().normalize(), 0xff3355, 14);
              floatingText.showDamage(nextPos, finalDamage, isCrit);
              soundEngine.playHitmarker(isCrit);

              if (onRemotePlayerHit) {
                onRemotePlayerHit(rPlayer, finalDamage, isCrit, nextPos);
              }

              hitTarget = true;
              break;
            }
          }
        }

        // Check AI enemies (PvE / Solo)
        if (!hitTarget && enemies && enemies.length > 0) {
          for (const enemy of enemies) {
            if (enemy.isDead) continue;

            const dist = nextPos.distanceTo(enemy.getCenter());
            if (dist < enemy.radius + p.radius) {
              // Check Headshot/Weakpoint
              const relativeY = nextPos.y - enemy.position.y;
              const isCrit = relativeY > enemy.height * 0.7;
              const finalDamage = isCrit ? p.damage * 2.0 : p.damage;

              enemy.takeDamage(finalDamage);
              particleSystem.createSparks(nextPos, p.velocity.clone().negate().normalize(), 0xff3355, 12);
              floatingText.showDamage(nextPos, finalDamage, isCrit);
              soundEngine.playHitmarker(isCrit);

              hitTarget = true;
              break;
            }
          }
        }

        if (hitTarget) {
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
