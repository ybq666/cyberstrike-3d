import * as THREE from 'three';

export const PICKUP_TYPES = {
  HEALTH: {
    id: 'health',
    name: '纳米医疗包',
    color: 0x00ff66,
    icon: '+',
    value: 35
  },
  SHIELD: {
    id: 'shield',
    name: '护盾增幅器',
    color: 0x00f3ff,
    icon: '⛨',
    value: 50
  },
  AMMO: {
    id: 'ammo',
    name: '等离子弹药箱',
    color: 0xffaa00,
    icon: '⚡',
    value: 100
  },
  OVERDRIVE: {
    id: 'overdrive',
    name: '过载芯片',
    color: 0xff0055,
    icon: '★',
    duration: 10
  }
};

export class PickupManager {
  constructor(scene) {
    this.scene = scene;
    this.pickups = [];

    // Shared geometries
    this.cubeGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    this.octaGeo = new THREE.OctahedronGeometry(0.55);
    this.dodecaGeo = new THREE.DodecahedronGeometry(0.5);
  }

  spawn(typeKey, position) {
    const typeDef = PICKUP_TYPES[typeKey] || PICKUP_TYPES.HEALTH;
    const group = new THREE.Group();
    group.position.copy(position);
    group.position.y = Math.max(1.0, position.y);

    let geo = this.cubeGeo;
    if (typeKey === 'SHIELD') geo = this.octaGeo;
    if (typeKey === 'OVERDRIVE') geo = this.dodecaGeo;

    const mat = new THREE.MeshStandardMaterial({
      color: typeDef.color,
      emissive: typeDef.color,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.8
    });

    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    // Glowing outer ring
    const ringGeo = new THREE.RingGeometry(0.7, 0.85, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: typeDef.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Point Light
    const light = new THREE.PointLight(typeDef.color, 1.2, 5);
    group.add(light);

    this.scene.add(group);

    const item = {
      typeKey,
      typeDef,
      group,
      mesh,
      ring,
      baseY: group.position.y,
      rotSpeed: 1.8,
      age: 0,
      life: 30 // Despawn after 30s if not picked up
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
