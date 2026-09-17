import * as THREE from 'three';

/**
 * 赛博前线 3D - 远程对战玩家实体 (Remote Player 3D Entity)
 * 具备赛博装甲机身、头部弱点判定、武器持握、实时平滑插值以及头顶血条铭牌
 */
export class RemotePlayer {
  constructor(peerId, name, colorHex, scene) {
    this.peerId = peerId;
    this.name = name || '远程玩家';
    this.colorHex = colorHex || '#00f3ff';
    this.scene = scene;

    // 战斗属性
    this.health = 100;
    this.maxHealth = 100;
    this.shield = 100;
    this.maxShield = 100;
    this.isDead = false;
    this.isInvulnerable = false; // 复活无敌保护

    // 空间变换与平滑插值目标
    this.position = new THREE.Vector3(0, 0, 0);
    this.targetPosition = new THREE.Vector3(0, 0, 0);
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.isMoving = false;
    this.isJumping = false;
    this.currentWeaponIndex = 0;

    // 碰撞包围几何
    this.radius = 0.55;
    this.height = 1.85;

    // 动画计时
    this.walkCycle = 0;

    // 构建 3D 角色网格
    this.meshGroup = new THREE.Group();
    this.buildCharacterMesh();
    this.buildNameTag();

    this.scene.add(this.meshGroup);
  }

  buildCharacterMesh() {
    const mainColor = new THREE.Color(this.colorHex || '#ff7597');
    const outfitMat = new THREE.MeshStandardMaterial({
      color: mainColor,
      roughness: 0.5,
      metalness: 0.05
    });
    const whitePlushMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.05
    });
    const pinkInnerMat = new THREE.MeshStandardMaterial({
      color: 0xff85a2,
      roughness: 0.4,
      metalness: 0.05
    });
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xff2e63,
      roughness: 0.35,
      metalness: 0.1
    });

    this.bodyGroup = new THREE.Group();
    this.meshGroup.add(this.bodyGroup);

    // 1. 躯干萌系卫衣 (Cute Pastel Hoodie / Dress)
    const torsoGeo = new THREE.BoxGeometry(0.62, 0.72, 0.4);
    this.torso = new THREE.Mesh(torsoGeo, outfitMat);
    this.torso.position.y = 1.05;
    this.bodyGroup.add(this.torso);

    // 卫衣前身白色爱心印花 (Heart Logo on chest)
    const heartPatch = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.05), whitePlushMat);
    heartPatch.position.set(0, 1.12, 0.2);
    this.bodyGroup.add(heartPatch);

    // 2. 头部萌喵玩偶面容 (Cute Kitty Doll Head)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.55, 0);
    this.bodyGroup.add(this.headGroup);

    const headGeo = new THREE.SphereGeometry(0.32, 16, 16);
    headGeo.scale(1.1, 0.95, 1.0);
    const headMesh = new THREE.Mesh(headGeo, whitePlushMat);
    this.headGroup.add(headMesh);

    // 猫耳 (Pointed Kitty Ears)
    [-1, 1].forEach(side => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 4), whitePlushMat);
      ear.rotation.y = Math.PI / 4;
      ear.rotation.z = side * -0.22;
      ear.position.set(side * 0.24, 0.3, 0);
      this.headGroup.add(ear);

      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.14, 4), pinkInnerMat);
      inner.rotation.y = Math.PI / 4;
      inner.rotation.z = side * -0.22;
      inner.position.set(side * 0.24, 0.3, 0.035);
      this.headGroup.add(inner);
    });

    // 标志性 Hello Kitty 蝴蝶结 (Iconic Red Bow on left ear)
    const bowGroup = new THREE.Group();
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), ribbonMat);
    bowGroup.add(knot);
    [-1, 1].forEach(s => {
      const loop = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 10), ribbonMat);
      loop.rotation.z = s * (Math.PI / 2 + 0.12);
      loop.scale.set(1, 0.45, 0.85);
      loop.position.set(s * 0.09, 0, 0);
      bowGroup.add(loop);
    });
    bowGroup.position.set(-0.25, 0.32, 0.12);
    bowGroup.rotation.z = -0.25;
    this.headGroup.add(bowGroup);

    // 萌系大眼睛与黄色小鼻子
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1f1b24 });
    [-1, 1].forEach(side => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeMat);
      eye.scale.set(0.9, 1.3, 0.5);
      eye.position.set(side * 0.11, 0.02, 0.3);
      this.headGroup.add(eye);

      // 腮红 (Pink Blush)
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.045, 8), pinkInnerMat);
      blush.position.set(side * 0.18, -0.04, 0.295);
      this.headGroup.add(blush);
    });

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    nose.position.set(0, -0.02, 0.32);
    this.headGroup.add(nose);

    // 3. 四肢：左右手臂 (Pastel Arms & White Gloves)
    const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.18);

    this.leftArm = new THREE.Mesh(armGeo, outfitMat);
    this.leftArm.position.set(-0.42, 1.0, 0);
    this.bodyGroup.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, outfitMat);
    this.rightArm.position.set(0.42, 1.0, 0.1);
    this.bodyGroup.add(this.rightArm);

    // 手持草莓喵喵枪模型 (Cute Blaster in hand)
    this.weaponGroup = new THREE.Group();
    this.weaponGroup.position.set(0.42, 0.85, 0.3);
    this.bodyGroup.add(this.weaponGroup);
    this.buildWeaponMesh();

    // 4. 四肢：左右腿部 (Legs & Shoes)
    const legGeo = new THREE.BoxGeometry(0.2, 0.68, 0.22);

    this.leftLeg = new THREE.Mesh(legGeo, outfitMat);
    this.leftLeg.position.set(-0.18, 0.35, 0);
    this.bodyGroup.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, outfitMat);
    this.rightLeg.position.set(0.18, 0.35, 0);
    this.bodyGroup.add(this.rightLeg);
  }

  buildWeaponMesh() {
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.3 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.44), whiteMat);
    const gunTop = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.03, 0.38), pinkMat);
    gunTop.position.y = 0.07;
    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8), pinkMat);
    gunBarrel.rotateX(Math.PI / 2);
    gunBarrel.position.set(0, 0.02, 0.32);

    this.weaponGroup.add(gunBody);
    this.weaponGroup.add(gunTop);
    this.weaponGroup.add(gunBarrel);
  }

  buildNameTag() {
    this.tagCanvas = document.createElement('canvas');
    this.tagCanvas.width = 256;
    this.tagCanvas.height = 80;
    this.tagCtx = this.tagCanvas.getContext('2d');

    this.tagTexture = new THREE.CanvasTexture(this.tagCanvas);
    this.tagTexture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.tagTexture,
      transparent: true,
      depthTest: false
    });
    this.tagSprite = new THREE.Sprite(spriteMat);
    this.tagSprite.position.set(0, 2.2, 0);
    this.tagSprite.scale.set(1.6, 0.5, 1);
    this.meshGroup.add(this.tagSprite);

    this.updateNameTag();
  }

  updateNameTag() {
    const ctx = this.tagCtx;
    ctx.clearRect(0, 0, 256, 80);

    // 1. 玩家名字与心心
    ctx.font = 'bold 20px "Fredoka", "Quicksand", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff2e63';
    ctx.shadowColor = 'rgba(255, 182, 193, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(`🎀 ${this.name}`, 128, 24);
    ctx.shadowBlur = 0;

    // 2. 能量护盾条 (Pastel Strawberry Cream)
    const barW = 190;
    const barH = 7;
    const barX = (256 - barW) / 2;
    const shieldPercent = Math.max(0, this.shield / this.maxShield);

    ctx.fillStyle = 'rgba(255, 240, 245, 0.85)';
    ctx.beginPath();
    ctx.roundRect(barX, 34, barW, barH, 4);
    ctx.fill();

    ctx.fillStyle = '#ff85a2';
    ctx.beginPath();
    ctx.roundRect(barX, 34, barW * shieldPercent, barH, 4);
    ctx.fill();

    // 3. 元气生命条 (Sweet Hot Pink)
    const hpPercent = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = 'rgba(255, 240, 245, 0.85)';
    ctx.beginPath();
    ctx.roundRect(barX, 45, barW, barH, 4);
    ctx.fill();

    let hpColor = '#ff3366';
    if (hpPercent < 0.3) hpColor = '#ff0055';
    else if (hpPercent < 0.6) hpColor = '#ff7700';

    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(barX, 45, barW * hpPercent, barH, 4);
    ctx.fill();

    this.tagTexture.needsUpdate = true;
  }

  /**
   * 应用来自网络的高频状态包
   */
  applyNetworkState(state) {
    if (this.isDead) return;

    // 目标坐标
    this.targetPosition.set(state.p[0], state.p[1], state.p[2]);

    // 水平与俯仰角
    this.targetYaw = state.r[0];
    this.targetPitch = state.r[1];

    // 动作与武器
    this.isMoving = state.m === 1;
    this.isJumping = state.j === 1;
    this.currentWeaponIndex = state.w || 0;
  }

  /**
   * 每帧更新：平滑插值与四肢走动动画
   */
  update(delta) {
    if (this.isDead) return;

    // 1. 位置线性插值 (Smooth Lerp)
    this.position.lerp(this.targetPosition, 0.22);
    this.meshGroup.position.copy(this.position);

    // 2. 水平朝向平滑旋转
    let currentYaw = this.bodyGroup.rotation.y;
    let diffYaw = this.targetYaw - currentYaw;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    this.bodyGroup.rotation.y += diffYaw * 0.25;

    // 3. 头部俯仰角插值
    this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, this.targetPitch, 0.25);
    this.weaponGroup.rotation.x = this.headGroup.rotation.x;

    // 4. 走动摆动动画
    if (this.isMoving) {
      this.walkCycle += delta * 12;
      const legSwing = Math.sin(this.walkCycle) * 0.45;
      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;
      this.leftArm.rotation.x = -legSwing * 0.6;
    } else {
      // 待机恢复直立
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, 0.1);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, 0.1);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, 0.1);
    }

    if (this.isJumping) {
      this.leftLeg.rotation.x = 0.3;
      this.rightLeg.rotation.x = -0.3;
    }
  }

  /**
   * 受击扣血判定
   */
  takeDamage(amount) {
    if (this.isDead || this.isInvulnerable) return;

    if (this.shield > 0) {
      if (this.shield >= amount) {
        this.shield -= amount;
      } else {
        const overflow = amount - this.shield;
        this.shield = 0;
        this.health -= overflow;
      }
    } else {
      this.health -= amount;
    }

    this.health = Math.max(0, this.health);
    this.updateNameTag();

    // 闪烁红光提示受击
    this.flashDamage();
  }

  flashDamage() {
    if (this.torso && this.torso.material) {
      const orig = this.torso.material.color.getHex();
      this.torso.material.color.setHex(0xff2e63);
      setTimeout(() => {
        if (this.torso && this.torso.material) {
          this.torso.material.color.setHex(orig);
        }
      }, 90);
    }
  }

  /**
   * 获取玩家中心点
   */
  getCenter() {
    return this.position.clone().add(new THREE.Vector3(0, 1.0, 0));
  }

  /**
   * 获取枪口世界坐标（用于发射弹道）
   */
  getMuzzlePosition() {
    const muzzle = new THREE.Vector3();
    this.weaponGroup.getWorldPosition(muzzle);
    muzzle.y += 0.05;
    return muzzle;
  }

  /**
   * 阵亡：隐藏模型并等待复活
   */
  die() {
    this.isDead = true;
    this.meshGroup.visible = false;
  }

  /**
   * 在指定坐标复活并开启 2 秒保护罩
   */
  respawn(pos) {
    this.isDead = false;
    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.position.copy(pos);
    this.targetPosition.copy(pos);
    this.meshGroup.position.copy(pos);
    this.meshGroup.visible = true;
    this.updateNameTag();

    // 无敌护盾闪烁
    this.isInvulnerable = true;
    setTimeout(() => {
      this.isInvulnerable = false;
    }, 2000);
  }

  destroy() {
    if (this.scene && this.meshGroup) {
      this.scene.remove(this.meshGroup);
    }
    if (this.tagTexture) this.tagTexture.dispose();
  }
}
