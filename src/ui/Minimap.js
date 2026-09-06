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

    // Background
    ctx.fillStyle = 'rgba(6, 14, 28, 0.85)';
    ctx.fillRect(0, 0, w, h);

    // Concentric range rings
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
    ctx.lineWidth = 1;
    [0.33, 0.66, 1.0].forEach(frac => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * frac, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Crosshair axes
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.stroke();

    // Sweeper line animation
    const sweepAngle = (Date.now() * 0.0025) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
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

      // Rotate by -pYaw so forward (+Z in relative, or forward look) is UP on radar
      const sin = Math.sin(-pYaw + Math.PI);
      const cos = Math.cos(-pYaw + Math.PI);

      const rx = dx * cos - dz * sin;
      const ry = dx * sin + dz * cos;

      const screenX = cx + (rx / this.range) * radius;
      const screenY = cy + (ry / this.range) * radius;

      return { x: screenX, y: screenY };
    };

    // 1. Draw Jump Pads (green rings)
    if (jumpPads) {
      jumpPads.forEach(pad => {
        const pt = toRadarCoords(pad.position.x, pad.position.z);
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // 2. Draw Pickups (colored dots)
    if (pickups) {
      pickups.forEach(p => {
        const pt = toRadarCoords(p.group.position.x, p.group.position.z);
        ctx.fillStyle = p.typeDef ? `#${p.typeDef.color.toString(16).padStart(6, '0')}` : '#00ff88';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 3. Draw Enemies (red/magenta dots)
    if (enemies) {
      enemies.forEach(e => {
        if (e.isDead) return;
        const pt = toRadarCoords(e.position.x, e.position.z);

        if (e.typeDef.isBoss) {
          // Boss: Larger glowing red diamond
          ctx.fillStyle = '#ff0055';
          ctx.shadowColor = '#ff0055';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = '#ff3344';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // 4. Draw Player in Center (Cyan directional triangle)
    ctx.fillStyle = '#00f3ff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx - 4.5, cy + 5);
    ctx.lineTo(cx, cy + 2.5);
    ctx.lineTo(cx + 4.5, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    // Outer border ring
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}
