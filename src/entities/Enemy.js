import * as THREE from 'three';

export const ENEMY_TYPES = {
  DRONE: {
    id: 'drone',
    name: '巡航侦察无人机',
    hp: 70,
    speed: 7.5,
    score: 100,
    radius: 0.9,
    height: 1.8,
    isFlying: true,
    hoverHeight: 3.2,
    attackRange: 24,
    attackCooldown: 2.2,
    damage: 15
  },
  STALKER: {
    id: 'stalker',
    name: '机械潜伏者',
    hp: 95,
    speed: 10.5,
    score: 150,
    radius: 0.8,
    height: 1.5,
    isFlying: false,
    attackRange: 2.4,
    attackCooldown: 1.2,
    damage: 25
  },
  TITAN: {
    id: 'titan',
    name: '泰坦重装机甲',
    hp: 650,
    speed: 4.8,
    score: 800,
    radius: 2.2,
    height: 5.0,
    isFlying: false,
    isBoss: true,
    attackRange: 32,
    attackCooldown: 2.5,
    damage: 35
  }
};

export class Enemy {
  constructor(scene, typeKey, spawnPos) {
    this.scene = scene;
    this.typeDef = ENEMY_TYPES[typeKey] || ENEMY_TYPES.DRONE;
    this.typeKey = typeKey;

    this.position = spawnPos.clone();
    this.maxHp = this.typeDef.hp;
    this.hp = this.maxHp;
    this.radius = this.typeDef.radius;
    this.height = this.typeDef.height;
    this.speed = this.typeDef.speed;

    this.isDead = false;
    this.attackTimer = Math.random() * 1.5; // Randomize start attack
    this.flinchTimer = 0;

    // Movement state
    this.velocity = new THREE.Vector3();
    this.strafeAngle = Math.random() * Math.PI * 2;
    this.strafeTimer = 0;

    // Build 3D Mesh
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.buildModel();

    // Floating 3D Health Bar
    this.createHealthBar();

    this.scene.add(this.group);
  }

  buildModel() {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1a2130,
      metalness: 0.85,
      roughness: 0.35
    });

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });

    if (this.typeKey === 'DRONE') {
      // 1. Drone Model: Core sphere + outer rotating gyro ring
      const coreGeo = new THREE.SphereGeometry(0.7, 16, 16);
      this.coreMesh = new THREE.Mesh(coreGeo, metalMat);
      this.group.add(this.coreMesh);

      const eyeGeo = new THREE.SphereGeometry(0.25, 12, 12);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0, 0, -0.6);
      this.group.add(eye);

      // Rotating Gyro Ring
      const ringGeo = new THREE.TorusGeometry(1.0, 0.08, 8, 24);
      this.gyroRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x00f3ff }));
      this.group.add(this.gyroRing);

    } else if (this.typeKey === 'STALKER') {
      // 2. Stalker Model: sleek predatory body with 4 arachnid legs
      const bodyGeo = new THREE.ConeGeometry(0.6, 1.4, 6);
      bodyGeo.rotateX(Math.PI / 2);
      this.coreMesh = new THREE.Mesh(bodyGeo, metalMat);
      this.coreMesh.position.y = 0.7;
      this.group.add(this.coreMesh);

      // Red visor eyes
      const visorGeo = new THREE.BoxGeometry(0.5, 0.15, 0.3);
      const visor = new THREE.Mesh(visorGeo, eyeMat);
      visor.position.set(0, 0.75, -0.65);
      this.group.add(visor);

      // 4 Angular Legs
      this.legs = [];
      const legGeo = new THREE.CylinderGeometry(0.06, 0.03, 1.0, 6);
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(legGeo, metalMat);
        const signX = (i % 2 === 0) ? 1 : -1;
        const signZ = (i < 2) ? 1 : -1;
        leg.position.set(signX * 0.6, 0.4, signZ * 0.5);
        leg.rotation.z = signX * 0.5;
        this.group.add(leg);
        this.legs.push(leg);
      }

    } else if (this.typeKey === 'TITAN') {
      // 3. Titan Mech: Massive bipedal war mech with twin shoulder cannons
      const torsoGeo = new THREE.BoxGeometry(2.4, 2.2, 1.8);
      this.coreMesh = new THREE.Mesh(torsoGeo, metalMat);
      this.coreMesh.position.y = 3.2;
      this.group.add(this.coreMesh);

      // Glowing central reactor eye
      const eyeGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 16);
      eyeGeo.rotateX(Math.PI / 2);
      const eye = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xff0055 }));
      eye.position.set(0, 3.2, -0.92);
      this.group.add(eye);

      // Shoulder Missile/Plasma Pods
      const podGeo = new THREE.BoxGeometry(0.8, 0.8, 2.2);
      const pod1 = new THREE.Mesh(podGeo, metalMat);
      pod1.position.set(1.6, 4.0, 0);
      const pod2 = pod1.clone();
      pod2.position.x = -1.6;
      this.group.add(pod1);
      this.group.add(pod2);

      // Heavy Legs
      const legGeo = new THREE.BoxGeometry(0.7, 2.4, 0.9);
      const leg1 = new THREE.Mesh(legGeo, metalMat);
      leg1.position.set(0.9, 1.2, 0);
      const leg2 = leg1.clone();
      leg2.position.x = -0.9;
      this.group.add(leg1);
      this.group.add(leg2);
    }
  }

  createHealthBar() {
    // 3D Billboard Canvas Health Bar
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 16;
    this.hbCtx = canvas.getContext('2d');
    this.hbTexture = new THREE.CanvasTexture(canvas);

    const hbMat = new THREE.SpriteMaterial({
      map: this.hbTexture,
      transparent: true,
      depthTest: false
    });

    this.hbSprite = new THREE.Sprite(hbMat);
    const spriteScale = this.typeDef.isBoss ? 3.6 : 1.8;
    this.hbSprite.scale.set(spriteScale, spriteScale * 0.16, 1);
    this.hbSprite.position.y = this.height + (this.typeDef.isBoss ? 1.0 : 0.5);
    this.group.add(this.hbSprite);

    this.updateHealthBarTexture();
  }

  updateHealthBarTexture() {
    const ctx = this.hbCtx;
    ctx.clearRect(0, 0, 128, 16);

    // Background track
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 128, 16);

    // Health Fill
    const pct = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = this.typeDef.isBoss ? '#ff0055' : '#00f3ff';
    ctx.fillRect(2, 2, (128 - 4) * pct, 12 - 4);

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 128, 16);

    this.hbTexture.needsUpdate = true;
  }

  getCenter() {
    return this.group.position.clone().add(new THREE.Vector3(0, this.height * 0.5, 0));
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.hp -= amount;
    this.flinchTimer = 0.12;

    this.updateHealthBarTexture();

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
    }
  }

  update(dt, playerPos, arena, projectileManager, soundEngine, onMeleeHit) {
    if (this.isDead) return;

    // Handle Flinch effect
    if (this.flinchTimer > 0) {
      this.flinchTimer -= dt;
      if (this.coreMesh) {
        this.coreMesh.material.color.setHex(0xff3355);
      }
    } else {
      if (this.coreMesh) {
        this.coreMesh.material.color.setHex(0x1a2130);
      }
    }

    // Facing player (Yaw only)
    const lookTarget = playerPos.clone();
    lookTarget.y = this.group.position.y;
    this.group.lookAt(lookTarget);

    const distToPlayer = this.group.position.distanceTo(playerPos);
    const dirToPlayer = playerPos.clone().sub(this.group.position).normalize();

    // 1. Drone AI Logic
    if (this.typeKey === 'DRONE') {
      if (this.gyroRing) {
        this.gyroRing.rotation.x += dt * 4;
        this.gyroRing.rotation.y += dt * 3;
      }

      // Hover bobbing
      const targetY = this.typeDef.hoverHeight + Math.sin(Date.now() * 0.003 + this.strafeAngle) * 0.6;
      this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, targetY, 3 * dt);

      // Maintain distance & strafe
      if (distToPlayer > 18) {
        this.group.position.addScaledVector(dirToPlayer, this.speed * dt);
      } else if (distToPlayer < 10) {
        this.group.position.addScaledVector(dirToPlayer, -this.speed * 0.8 * dt);
      } else {
        // Circle around player
        const tangent = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x);
        this.group.position.addScaledVector(tangent, Math.sin(this.strafeAngle) * this.speed * dt);
      }

      // Attack firing
      this.attackTimer += dt;
      if (this.attackTimer >= this.typeDef.attackCooldown && distToPlayer <= this.typeDef.attackRange) {
        this.attackTimer = 0;
        // Shoot energy projectile
        const muzzlePos = this.getCenter().add(dirToPlayer.clone().multiplyScalar(1.0));
        projectileManager.spawnEnemyProjectile(muzzlePos, dirToPlayer, 28, this.typeDef.damage);
      }

    } else if (this.typeKey === 'STALKER') {
      // 2. Stalker AI Logic: Rapid ground charge
      this.group.position.y = 0;

      // Animate leg cycle
      const legCycle = Math.sin(Date.now() * 0.02) * 0.35;
      if (this.legs) {
        this.legs.forEach((leg, i) => {
          leg.rotation.x = (i % 2 === 0 ? 1 : -1) * legCycle;
        });
      }

      // Charge directly towards player
      if (distToPlayer > this.typeDef.attackRange) {
        this.group.position.addScaledVector(dirToPlayer, this.speed * dt);
      } else {
        // In melee range! Attack player
        this.attackTimer += dt;
        if (this.attackTimer >= this.typeDef.attackCooldown) {
          this.attackTimer = 0;
          if (onMeleeHit) onMeleeHit(this.typeDef.damage, this.group.position);
        }
      }

    } else if (this.typeKey === 'TITAN') {
      // 3. Titan Mech AI Logic: Heavy march and burst attacks
      this.group.position.y = 0;

      if (distToPlayer > 14) {
        this.group.position.addScaledVector(dirToPlayer, this.speed * dt);
      }

      // Attack routine: twin plasma volley
      this.attackTimer += dt;
      if (this.attackTimer >= this.typeDef.attackCooldown) {
        this.attackTimer = 0;
        // Fire from left & right pods
        const leftMuzzle = this.group.position.clone().add(new THREE.Vector3(1.6, 4.0, 0));
        const rightMuzzle = this.group.position.clone().add(new THREE.Vector3(-1.6, 4.0, 0));

        projectileManager.spawnEnemyProjectile(leftMuzzle, dirToPlayer, 30, this.typeDef.damage);
        setTimeout(() => {
          projectileManager.spawnEnemyProjectile(rightMuzzle, dirToPlayer, 30, this.typeDef.damage);
        }, 150);
      }
    }

    // Resolve collision with arena walls and obstacles
    arena.resolveCollision(this.group.position, this.radius);
    this.position.copy(this.group.position);
  }

  destroy() {
    this.scene.remove(this.group);
    if (this.hbTexture) this.hbTexture.dispose();
  }
}
