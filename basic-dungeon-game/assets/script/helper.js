import { COMMON_SPRITE_HEIGHT, COMMON_SPRITE_WIDTH } from "./config.js";

const clamp = (v, a, b) => {
  return Math.max(a, Math.min(b, v));
};

const subtractPosition = (a, b) => {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
};

const distantBetween = (a, b) => {
  const { x, y } = subtractPosition(a, b);

  return Math.hypot(x, y);
};

const worldToScreenCoordinate = (worldX, worldY, camera) => {
  return { x: worldX - camera.x, y: worldY - camera.y };
};

const spriteCenterCoordinate = (target) => {
  return {
    x: Math.round(target.x - COMMON_SPRITE_WIDTH / 2),
    y: Math.round(target.y - COMMON_SPRITE_HEIGHT / 2),
  };
};

const roundRect = (ctx, x, y, w, h, r) => {
  const radius = typeof r === "number" ? r : 4;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

export {
  clamp,
  distantBetween,
  roundRect,
  spriteCenterCoordinate,
  subtractPosition,
  worldToScreenCoordinate,
};
