// Tactical Radar Minimap for Cyberstrike 3D
export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.range = 55; // 55 meters radar coverage
  }

  render(player, enemies, pickups, jumpPads) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = w / 2 - 4;

    ctx.clearRect(0, 0, w, h);

    // Save clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Background: Soft strawberry cream glass
    ctx.fillStyle = 'rgba(255, 242, 247, 0.88)';
    ctx.fillRect(0, 0, w, h);

    // Concentric sweet rings
    ctx.strokeStyle = 'rgba(255, 105, 180, 0.3)';
    ctx.lineWidth = 1;
    [0.33, 0.66, 1.0].forEach(frac => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * frac, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Pastel crosshair axes
    ctx.strokeStyle = 'rgba(255, 182, 193, 0.45)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.stroke();

    // Sweeper line animation
    const sweepAngle = (Date.now() * 0.0022) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 46, 99, 0.35)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * radius, cy + Math.sin(sweepAngle) * radius);
    ctx.stroke();

    // Transform world to radar coords (relative to player position and yaw)
    const pPos = player.position;
    const pYaw = player.yaw;

    const toRadarCoords = (worldX, worldZ) => {
      const dx = worldX - pPos.x;
      const dz = worldZ - pPos.z;

      const sin = Math.sin(-pYaw + Math.PI);
      const cos = Math.cos(-pYaw + Math.PI);

      const rx = dx * cos - dz * sin;
      const ry = dx * sin + dz * cos;

      const screenX = cx + (rx / this.range) * radius;
      const screenY = cy + (ry / this.range) * radius;

      return { x: screenX, y: screenY };
    };

    // 1. Draw Jump Pads (pastel pink rings)
    if (jumpPads) {
      jumpPads.forEach(pad => {
        const pt = toRadarCoords(pad.position.x, pad.position.z);
        ctx.strokeStyle = 'rgba(255, 46, 99, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // 2. Draw Pickups (colored candy dots)
    if (pickups) {
      pickups.forEach(p => {
        const pt = toRadarCoords(p.group.position.x, p.group.position.z);
        ctx.fillStyle = p.typeDef ? `#${p.typeDef.color.toString(16).padStart(6, '0')}` : '#ff69b4';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 3. Draw Enemies & Rivals
    if (enemies) {
      enemies.forEach(e => {
        if (e.isDead) return;
        const pt = toRadarCoords(e.position.x, e.position.z);

        if (e.colorHex) {
          // 对战玩家
          ctx.fillStyle = e.colorHex;
          ctx.shadowColor = e.colorHex;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (e.typeDef && e.typeDef.isBoss) {
          // Boss: 巨型皇冠红心
          ctx.fillStyle = '#ff0055';
          ctx.shadowColor = '#ff2e63';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = '#ff4081';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // 4. Draw Player in Center (Sweet Strawberry Heart Arrow)
    ctx.fillStyle = '#ff2e63';
    ctx.shadowColor = '#ff7aa2';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6.5);
    ctx.lineTo(cx - 5, cy + 5);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    // Outer border ring with soft pink lace
    ctx.strokeStyle = 'rgba(255, 105, 180, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}
