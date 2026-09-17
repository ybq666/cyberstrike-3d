import * as THREE from 'three';

export const PICKUP_TYPES = {
  HEALTH: {
    id: 'health',
    name: '🍓 草莓奶油甜甜圈',
    color: 0xff69b4,
    icon: '🍓',
    value: 35
  },
  SHIELD: {
    id: 'shield',
    name: '🎀 萌心蝴蝶结护盾',
    color: 0xff3366,
    icon: '🎀',
    value: 50
  },
  AMMO: {
    id: 'ammo',
    name: '🍭 彩虹波板棒棒糖',
    color: 0xffaa00,
    icon: '🍭',
    value: 100
  },
  OVERDRIVE: {
    id: 'overdrive',
    name: '✨ 闪耀梦幻星愿星',
    color: 0xffd700,
    icon: '✨',
    duration: 10
  }
};

export class PickupManager {
  constructor(scene) {
    this.scene = scene;
    this.pickups = [];

    // Shared geometries
    this.donutGeo = new THREE.TorusGeometry(0.35, 0.18, 12, 24);
    this.octaGeo = new THREE.OctahedronGeometry(0.48);
    this.lollipopGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 24);
    this.lollipopGeo.rotateX(Math.PI / 2);
    this.starGeo = new THREE.DodecahedronGeometry(0.45);
  }

  spawn(typeKey, position) {
    const typeDef = PICKUP_TYPES[typeKey] || PICKUP_TYPES.HEALTH;
    const group = new THREE.Group();
    group.position.copy(position);
    group.position.y = Math.max(1.0, position.y);

    let mesh;
    if (typeKey === 'HEALTH') {
      // Strawberry frosted donut
      const donutMat = new THREE.MeshStandardMaterial({
        color: 0xff69b4,
        roughness: 0.3,
        metalness: 0.1
      });
      mesh = new THREE.Mesh(this.donutGeo, donutMat);
      mesh.rotation.x = Math.PI / 3;
    } else if (typeKey === 'SHIELD') {
      // Cute Ribbon Bow
      const bowMat = new THREE.MeshStandardMaterial({
        color: 0xff2e63,
        roughness: 0.35,
        metalness: 0.1
      });
      mesh = new THREE.Group();
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), bowMat);
      mesh.add(knot);
      [-1, 1].forEach(s => {
        const loop = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 10), bowMat);
        loop.rotation.z = s * (Math.PI / 2 + 0.1);
        loop.scale.set(1, 0.45, 0.85);
        loop.position.set(s * 0.22, 0, 0);
        mesh.add(loop);
      });
    } else if (typeKey === 'AMMO') {
      // Rainbow Lollipop
      const lollyGroup = new THREE.Group();
      const lollyMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.3 });
      const candy = new THREE.Mesh(this.lollipopGeo, lollyMat);
      lollyGroup.add(candy);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      stick.position.y = -0.35;
      lollyGroup.add(stick);
      mesh = lollyGroup;
    } else {
      // Golden Star Gem (Overdrive)
      const starMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffae00,
        emissiveIntensity: 0.7,
        roughness: 0.2,
        metalness: 0.4
      });
      mesh = new THREE.Mesh(this.starGeo, starMat);
    }

    group.add(mesh);

    // Glowing pastel lace ring beneath pickup
    const ringGeo = new THREE.RingGeometry(0.65, 0.85, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: typeDef.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Sweet point light
    const light = new THREE.PointLight(typeDef.color, 1.6, 6);
    group.add(light);

    this.scene.add(group);

    const item = {
      typeKey,
      typeDef,
      group,
      mesh,
      ring,
      baseY: group.position.y,
      rotSpeed: 2.0,
      age: 0,
      life: 30
    };

    this.pickups.push(item);
    return item;
  }

  update(dt, playerPos, onCollect) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.age += dt;
      p.life -= dt;

      // Bobbing and spinning
      p.mesh.rotation.y += p.rotSpeed * dt;
      p.mesh.rotation.x += p.rotSpeed * 0.5 * dt;
      p.ring.rotation.z += p.rotSpeed * dt;
      p.group.position.y = p.baseY + Math.sin(p.age * 3) * 0.25;

      // Proximity check with player
      const dist = p.group.position.distanceTo(playerPos);
      if (dist < 1.8) {
        // Collected!
        if (onCollect) {
          onCollect(p.typeKey, p.typeDef);
        }
        this.removePickup(i);
        continue;
      }

      // Despawn timeout
      if (p.life <= 0) {
        this.removePickup(i);
      }
    }
  }

  removePickup(index) {
    const p = this.pickups[index];
    this.scene.remove(p.group);
    this.pickups.splice(index, 1);
  }

  clear() {
    for (const p of this.pickups) {
      this.scene.remove(p.group);
    }
    this.pickups = [];
  }
}
