import * as THREE from 'three';

export class FloatingTextManager {
  constructor(container, camera) {
    this.container = container;
    this.camera = camera;
    this.items = [];
    this.vec = new THREE.Vector3();
  }

  spawnItem(el, worldPos) {
    this.container.appendChild(el);

    const item = {
      el,
      pos: worldPos.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        Math.random() * 0.4 + 0.2,
        (Math.random() - 0.5) * 0.6
      )),
      velY: 1.5,
      life: 0.85,
      maxLife: 0.85
    };

    this.items.push(item);
    this.updateItemPosition(item);
  }

  showDamage(worldPos, damage, isCrit = false) {
    const el = document.createElement('div');
    el.className = `floating-dmg ${isCrit ? 'crit' : ''}`;
    if (damage < 0) {
      el.className += ' heal';
      el.textContent = `🍓 +${Math.abs(Math.round(damage))}`;
    } else {
      el.textContent = isCrit ? `✨ 暴击! -${Math.round(damage)} 💖` : `💕 -${Math.round(damage)}`;
    }
    this.spawnItem(el, worldPos);
  }

  showHeal(worldPos, amount) {
    const el = document.createElement('div');
    el.className = 'floating-dmg heal';
    el.textContent = `🍓 +${Math.abs(Math.round(amount))}`;
    this.spawnItem(el, worldPos);
  }

  updateItemPosition(item) {
    this.vec.copy(item.pos);
    this.vec.project(this.camera);

    // If behind camera, hide
    if (this.vec.z > 1) {
      item.el.style.display = 'none';
      return;
    }

    item.el.style.display = 'block';
    const x = (this.vec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.vec.y * 0.5 + 0.5) * window.innerHeight;

    item.el.style.left = `${x}px`;
    item.el.style.top = `${y}px`;
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.life -= dt;
      item.pos.y += item.velY * dt;

      const progress = 1 - item.life / item.maxLife;
      item.el.style.opacity = Math.max(0, 1 - progress * 1.2);
      item.el.style.transform = `translate(-50%, -50%) scale(${1 + progress * 0.25})`;

      this.updateItemPosition(item);

      if (item.life <= 0) {
        this.container.removeChild(item.el);
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const item of this.items) {
      if (item.el.parentNode) item.el.parentNode.removeChild(item.el);
    }
    this.items = [];
  }
}
