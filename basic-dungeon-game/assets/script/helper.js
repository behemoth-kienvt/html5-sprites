import { COMMON_SPRITE_HEIGHT, COMMON_SPRITE_WIDTH } from "./config.js";

const clamp = (v, a, b) => {
  return Math.max(a, Math.min(b, v));
};

const distantBetween = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.hypot(dx, dy);
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

export {
  clamp,
  distantBetween,
  spriteCenterCoordinate,
  worldToScreenCoordinate,
};
