// Short-lived sparks, rings and floating score text. Visual only: the world
// never reads them, so they can never change how a game plays out.

export function createParticles() {
  const sparks = [];
  const rings = [];
  const floaters = [];

  return {
    /** A burst of glowing sparks at (x, y). */
    burst(x, y, color, count = 14, speed = 160) {
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = speed * (0.4 + Math.random() * 0.8);
        sparks.push({
          x, y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: 0.55 + Math.random() * 0.35,
          age: 0,
          size: 2 + Math.random() * 3,
          color,
        });
      }
    },
    /** An expanding ring, for flares. */
    ring(x, y, color, maxRadius) {
      rings.push({ x, y, radius: 8, maxRadius, life: 0.45, age: 0, color });
    },
    /** Floating text that rises and fades, for scores and warnings. */
    floater(x, y, text, color) {
      floaters.push({ x, y, text, color, life: 1.1, age: 0 });
    },
    update(dt) {
      for (let index = sparks.length - 1; index >= 0; index -= 1) {
        const spark = sparks[index];
        spark.age += dt;
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.vx *= 1 - 2.2 * dt;
        spark.vy *= 1 - 2.2 * dt;
        if (spark.age >= spark.life) sparks.splice(index, 1);
      }
      for (let index = rings.length - 1; index >= 0; index -= 1) {
        const ring = rings[index];
        ring.age += dt;
        ring.radius = 8 + (ring.maxRadius - 8) * (ring.age / ring.life);
        if (ring.age >= ring.life) rings.splice(index, 1);
      }
      for (let index = floaters.length - 1; index >= 0; index -= 1) {
        const floater = floaters[index];
        floater.age += dt;
        floater.y -= 34 * dt;
        if (floater.age >= floater.life) floaters.splice(index, 1);
      }
    },
    draw(context) {
      context.save();
      context.globalCompositeOperation = 'lighter';
      for (const spark of sparks) {
        const alpha = 1 - spark.age / spark.life;
        context.globalAlpha = alpha;
        context.fillStyle = spark.color;
        context.beginPath();
        context.arc(spark.x, spark.y, spark.size * alpha + 0.5, 0, Math.PI * 2);
        context.fill();
      }
      for (const ring of rings) {
        const alpha = 1 - ring.age / ring.life;
        context.globalAlpha = alpha * 0.9;
        context.strokeStyle = ring.color;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        context.stroke();
      }
      context.restore();
      for (const floater of floaters) {
        const alpha = 1 - floater.age / floater.life;
        context.save();
        context.globalAlpha = alpha;
        context.font = '700 20px system-ui, sans-serif';
        context.textAlign = 'center';
        context.fillStyle = floater.color;
        context.fillText(floater.text, floater.x, floater.y);
        context.restore();
      }
    },
  };
}
