import * as THREE from 'three';

export const ENEMY_TYPES = {
  DRONE: {
    id: 'drone',
    name: '🎀 飞天天使猫咪玩偶',
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
    name: '🧸 捣蛋发条泰迪熊',
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
    name: '👑 草莓女王巨型甜心熊',
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
  constructor(arg1, arg2, arg3) {
    let scene, typeKey, spawnPos;
    if (typeof arg1 === 'string') {
      typeKey = arg1;
      scene = arg2;
      spawnPos = (arg3 && arg3.isVector3) ? arg3 : null;
    } else {
      scene = arg1;
      typeKey = arg2;
      spawnPos = (arg3 && arg3.isVector3) ? arg3 : null;
    }

    this.scene = scene;
    this.typeDef = ENEMY_TYPES[typeKey] || ENEMY_TYPES.DRONE;
    this.typeKey = typeKey;

    if (!spawnPos) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 32 + Math.random() * 8;
      this.position = new THREE.Vector3(Math.cos(angle) * dist, 1.5, Math.sin(angle) * dist);
    } else {
      this.position = spawnPos.clone();
    }
    this.maxHp = this.typeDef.hp;
    this.hp = this.maxHp;
    this.radius = this.typeDef.radius;
    this.height = this.typeDef.height;
    this.speed = this.typeDef.speed;

    this.isDead = false;
    this.attackTimer = Math.random() * 1.5;
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

  // Helper to create a Hello Kitty style mini ribbon bow
  createRibbonBow(scale = 1.0, ribbonColor = 0xff2e63) {
    const bowGroup = new THREE.Group();
    const bowMat = new THREE.MeshStandardMaterial({
      color: ribbonColor,
      roughness: 0.35,
      metalness: 0.1
    });

    const knotGeo = new THREE.SphereGeometry(0.18 * scale, 10, 10);
    const knot = new THREE.Mesh(knotGeo, bowMat);
    knot.scale.set(1.1, 1.0, 0.7);
    bowGroup.add(knot);

    [-1, 1].forEach(side => {
      const loopGeo = new THREE.ConeGeometry(0.3 * scale, 0.55 * scale, 12);
      const loop = new THREE.Mesh(loopGeo, bowMat);
      loop.rotation.z = side * (Math.PI / 2 + 0.15);
      loop.scale.set(1, 0.45, 0.9);
      loop.position.set(side * 0.3 * scale, 0, 0);
      bowGroup.add(loop);
    });

    return bowGroup;
  }

  buildModel() {
    const plushWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.05
    });

    const plushPinkMat = new THREE.MeshStandardMaterial({
      color: 0xff85a2,
      roughness: 0.55,
      metalness: 0.05
    });

    const teddyBrownMat = new THREE.MeshStandardMaterial({
      color: 0xd4a373,
      roughness: 0.65,
      metalness: 0.05
    });

    const teddyCreamMat = new THREE.MeshStandardMaterial({
      color: 0xffedd8,
      roughness: 0.55,
      metalness: 0.05
    });

    const darkEyeMat = new THREE.MeshBasicMaterial({ color: 0x221c1d });
    const noseMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.2 });

    if (this.typeKey === 'DRONE') {
      // 1. Angel Kitty Balloon: Cute round white cat head + angel wings + halo + ear bow
      const headGeo = new THREE.SphereGeometry(0.72, 16, 16);
      headGeo.scale(1.0, 0.92, 0.95);
      this.coreMesh = new THREE.Mesh(headGeo, plushWhiteMat);
      this.group.add(this.coreMesh);
      this.baseColorHex = 0xffffff;

      // Cute pointed cat ears
      [-1, 1].forEach(side => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 6), plushWhiteMat);
        ear.rotation.y = Math.PI / 4;
        ear.rotation.z = side * -0.25;
        ear.position.set(side * 0.42, 0.65, 0);
        this.group.add(ear);

        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 4), plushPinkMat);
        inner.rotation.y = Math.PI / 4;
        inner.rotation.z = side * -0.25;
        inner.position.set(side * 0.42, 0.65, 0.06);
        this.group.add(inner);
      });

      // Hello Kitty Red/Pink Bow beside the left ear
      const bow = this.createRibbonBow(0.95, 0xff2e63);
      bow.position.set(-0.48, 0.72, 0.18);
      bow.rotation.z = -0.3;
      this.group.add(bow);

      // Cute anime button eyes
      [-1, 1].forEach(side => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), darkEyeMat);
        eye.scale.set(0.9, 1.3, 0.5);
        eye.position.set(side * 0.25, 0.05, -0.66);
        this.group.add(eye);
      });

      // Cute button nose
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), noseMat);
      nose.scale.set(1.2, 0.8, 0.6);
      nose.position.set(0, -0.04, -0.69);
      this.group.add(nose);

      // Flapping Angel Wings
      this.wings = [];
      [-1, 1].forEach(side => {
        const wingGroup = new THREE.Group();
        const wingGeo = new THREE.ConeGeometry(0.25, 0.75, 6);
        const wing = new THREE.Mesh(wingGeo, plushWhiteMat);
        wing.rotation.z = side * (Math.PI / 2);
        wing.scale.set(1, 0.35, 0.85);
        wingGroup.add(wing);
        wingGroup.position.set(side * 0.75, 0.1, 0.1);
        this.group.add(wingGroup);
        this.wings.push({ group: wingGroup, side });
      });

      // Floating sweet halo
      const haloGeo = new THREE.TorusGeometry(0.5, 0.04, 8, 24);
      const haloMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
      this.gyroRing = new THREE.Mesh(haloGeo, haloMat);
      this.gyroRing.rotation.x = Math.PI / 2;
      this.gyroRing.position.y = 1.05;
      this.group.add(this.gyroRing);

    } else if (this.typeKey === 'STALKER') {
      // 2. Mischievous Wind-up Teddy Bear: Fluffy honey bear with bow tie & rotating wind-up key
      // Bear Torso
      const torsoGeo = new THREE.SphereGeometry(0.55, 14, 14);
      torsoGeo.scale(1.0, 1.2, 0.9);
      this.coreMesh = new THREE.Mesh(torsoGeo, teddyBrownMat);
      this.coreMesh.position.y = 0.65;
      this.group.add(this.coreMesh);
      this.baseColorHex = 0xd4a373;

      // Cream belly patch
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), teddyCreamMat);
      belly.scale.set(0.9, 1.0, 0.3);
      belly.position.set(0, 0.62, -0.42);
      this.group.add(belly);

      // Bear Head
      const headGeo = new THREE.SphereGeometry(0.42, 14, 14);
      const head = new THREE.Mesh(headGeo, teddyBrownMat);
      head.position.set(0, 1.25, 0);
      this.group.add(head);

      // Round bear ears
      [-1, 1].forEach(side => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), teddyBrownMat);
        ear.position.set(side * 0.32, 1.55, 0);
        this.group.add(ear);

        const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), teddyCreamMat);
        earInner.position.set(side * 0.32, 1.55, -0.08);
        this.group.add(earInner);
      });

      // Snout
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), teddyCreamMat);
      snout.scale.set(1.2, 0.9, 0.8);
      snout.position.set(0, 1.18, -0.38);
      this.group.add(snout);

      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), darkEyeMat);
      nose.position.set(0, 1.22, -0.49);
      this.group.add(nose);

      // Eyes
      [-1, 1].forEach(side => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), darkEyeMat);
        eye.position.set(side * 0.16, 1.32, -0.36);
        this.group.add(eye);
      });

      // Sweet Red Bow Tie at the neck!
      const bowTie = this.createRibbonBow(0.7, 0xff2e63);
      bowTie.position.set(0, 1.0, -0.38);
      this.group.add(bowTie);

      // Golden wind-up key on the back
      this.windUpKey = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), crownMat);
      stem.rotation.x = Math.PI / 2;
      this.windUpKey.add(stem);
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16), crownMat);
      ring1.position.z = 0.16;
      this.windUpKey.add(ring1);
      this.windUpKey.position.set(0, 0.75, 0.5);
      this.group.add(this.windUpKey);

      // 4 Waddling Arms & Legs
      this.legs = [];
      const limbGeo = new THREE.CapsuleGeometry(0.12, 0.35, 6, 8);
      // Arms
      const leftArm = new THREE.Mesh(limbGeo, teddyBrownMat);
      leftArm.position.set(-0.5, 0.75, -0.15);
      leftArm.rotation.x = -0.4;
      this.group.add(leftArm);
      const rightArm = new THREE.Mesh(limbGeo, teddyBrownMat);
      rightArm.position.set(0.5, 0.75, -0.15);
      rightArm.rotation.x = -0.4;
      this.group.add(rightArm);

      // Legs
      const leftLeg = new THREE.Mesh(limbGeo, teddyBrownMat);
      leftLeg.position.set(-0.25, 0.22, 0);
      this.group.add(leftLeg);
      const rightLeg = new THREE.Mesh(limbGeo, teddyBrownMat);
      rightLeg.position.set(0.25, 0.22, 0);
      this.group.add(rightLeg);

      this.legs.push(leftArm, rightArm, leftLeg, rightLeg);

    } else if (this.typeKey === 'TITAN') {
      // 3. Royal Strawberry Queen Teddy Boss: Giant pink plush queen bear with golden crown & candy cannons
      // Torso
      const torsoGeo = new THREE.SphereGeometry(1.6, 18, 18);
      torsoGeo.scale(1.0, 1.15, 0.95);
      this.coreMesh = new THREE.Mesh(torsoGeo, plushPinkMat);
      this.coreMesh.position.y = 2.4;
      this.group.add(this.coreMesh);
      this.baseColorHex = 0xff85a2;

      // Cream chest & heart medallion
      const chestCream = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 14), teddyCreamMat);
      chestCream.scale.set(0.9, 1.0, 0.25);
      chestCream.position.set(0, 2.3, -1.35);
      this.group.add(chestCream);

      // Giant Head
      const headGeo = new THREE.SphereGeometry(1.2, 16, 16);
      const head = new THREE.Mesh(headGeo, plushPinkMat);
      head.position.set(0, 4.0, 0);
      this.group.add(head);

      // Round bear ears with cream centers
      [-1, 1].forEach(side => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), plushPinkMat);
        ear.position.set(side * 0.95, 4.85, 0);
        this.group.add(ear);

        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), teddyCreamMat);
        inner.position.set(side * 0.95, 4.85, -0.22);
        this.group.add(inner);
      });

      // Snout & Nose
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), teddyCreamMat);
      snout.scale.set(1.2, 0.85, 0.8);
      snout.position.set(0, 3.8, -1.05);
      this.group.add(snout);

      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), darkEyeMat);
      nose.position.set(0, 3.9, -1.35);
      this.group.add(nose);

      // Eyes
      [-1, 1].forEach(side => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), darkEyeMat);
        eye.position.set(side * 0.45, 4.2, -1.05);
        this.group.add(eye);
      });

      // Golden Queen Crown with rubies
      const crown = new THREE.Group();
      const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.42, 0.25, 16), crownMat);
      crown.add(crownBase);
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 6), crownMat);
        const ang = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(ang) * 0.44, 0.26, Math.sin(ang) * 0.44);
        crown.add(spike);
      }
      crown.position.set(0, 5.25, 0);
      this.group.add(crown);

      // Giant Royal Bow Tie
      const queenBow = this.createRibbonBow(2.0, 0xff2e63);
      queenBow.position.set(0, 3.2, -1.3);
      this.group.add(queenBow);

      // Twin Strawberry Candy Launchers on shoulders
      [-1, 1].forEach(side => {
        const pod = new THREE.Group();
        const podBody = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 1.8, 14), teddyCreamMat);
        podBody.rotation.x = Math.PI / 2;
        pod.add(podBody);

        const podCrown = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 16), new THREE.MeshBasicMaterial({ color: 0xff69b4 }));
        podCrown.position.z = -0.9;
        pod.add(podCrown);

        pod.position.set(side * 1.6, 4.0, 0);
        this.group.add(pod);
      });

      // Heavy Plush Legs
      const legGeo = new THREE.CylinderGeometry(0.48, 0.55, 1.8, 14);
      const leg1 = new THREE.Mesh(legGeo, plushPinkMat);
      leg1.position.set(0.85, 0.9, 0);
      const leg2 = leg1.clone();
      leg2.position.x = -0.85;
      this.group.add(leg1);
      this.group.add(leg2);
    }
  }

  createHealthBar() {
    // 3D Billboard Canvas Cute Pastel Pill Health Bar
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 32;
    this.hbCtx = canvas.getContext('2d');
    this.hbTexture = new THREE.CanvasTexture(canvas);

    const hbMat = new THREE.SpriteMaterial({
      map: this.hbTexture,
      transparent: true,
      depthTest: false
    });

    this.hbSprite = new THREE.Sprite(hbMat);
    const spriteScale = this.typeDef.isBoss ? 4.2 : 2.0;
    this.hbSprite.scale.set(spriteScale, spriteScale * 0.2, 1);
    this.hbSprite.position.y = this.height + (this.typeDef.isBoss ? 1.4 : 0.6);
    this.group.add(this.hbSprite);

    this.updateHealthBarTexture();
  }

  updateHealthBarTexture() {
    const ctx = this.hbCtx;
    ctx.clearRect(0, 0, 160, 32);

    // Pill background
    ctx.fillStyle = 'rgba(255, 240, 245, 0.9)';
    ctx.beginPath();
    ctx.roundRect(4, 6, 152, 20, 10);
    ctx.fill();

    // Heart icon
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ff2e63';
    ctx.fillText('💖', 8, 21);

    // Health Track & Fill
    const barX = 30;
    const barW = 120;
    const barH = 12;
    const barY = 10;

    ctx.fillStyle = '#ffd1dc';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();

    const pct = Math.max(0, this.hp / this.maxHp);
    if (pct > 0) {
      const grad = ctx.createLinearGradient(barX, 0, barX + barW * pct, 0);
      grad.addColorStop(0, '#ff7597');
      grad.addColorStop(1, '#ff2e63');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * pct, barH, 6);
      ctx.fill();
    }

    // Border
    ctx.strokeStyle = '#ff85a2';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(4, 6, 152, 20, 10);
    ctx.stroke();

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
        this.coreMesh.material.color.setHex(0xff3366);
      }
    } else {
      if (this.coreMesh) {
        this.coreMesh.material.color.setHex(this.baseColorHex || 0xffffff);
      }
    }

    // Facing player (Yaw only)
    const lookTarget = playerPos.clone();
    lookTarget.y = this.group.position.y;
    this.group.lookAt(lookTarget);

    const distToPlayer = this.group.position.distanceTo(playerPos);
    const dirToPlayer = playerPos.clone().sub(this.group.position).normalize();

    // 1. Angel Kitty Drone AI Logic
    if (this.typeKey === 'DRONE') {
      if (this.gyroRing) {
        this.gyroRing.rotation.z += dt * 2.5;
      }

      // Flapping angel wings
      if (this.wings) {
        const flap = Math.sin(Date.now() * 0.015) * 0.4;
        this.wings.forEach(({ group, side }) => {
          group.rotation.y = side * flap;
        });
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
        // Shoot sweet mischievous candy orb
        const muzzlePos = this.getCenter().add(dirToPlayer.clone().multiplyScalar(1.0));
        projectileManager.spawnEnemyProjectile(muzzlePos, dirToPlayer, 28, this.typeDef.damage);
      }

    } else if (this.typeKey === 'STALKER') {
      // 2. Wind-up Teddy Stalker AI Logic: Rapid ground charge & wind-up key spin
      this.group.position.y = 0;

      // Animate golden wind-up key spinning
      if (this.windUpKey) {
        this.windUpKey.rotation.z += dt * 6.5;
      }

      // Animate waddling hug arm/leg cycle
      const legCycle = Math.sin(Date.now() * 0.02) * 0.4;
      if (this.legs) {
        this.legs.forEach((limb, i) => {
          limb.rotation.x = (i % 2 === 0 ? 1 : -1) * legCycle;
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
        const leftMuzzle = new THREE.Vector3(1.6, 4.0, 0);
        this.group.localToWorld(leftMuzzle);
        const rightMuzzle = new THREE.Vector3(-1.6, 4.0, 0);
        this.group.localToWorld(rightMuzzle);

        projectileManager.spawnEnemyProjectile(leftMuzzle, dirToPlayer, 30, this.typeDef.damage);
        setTimeout(() => {
          if (this.isDead || !this.group.parent) return;
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
