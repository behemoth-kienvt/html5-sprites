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

const spriteCenterCoordinate = (target) => {
  return {
    x: Math.round(target.x - COMMON_SPRITE_WIDTH / 2),
    y: Math.round(target.y - COMMON_SPRITE_HEIGHT / 2),
  };
};

const roundRect = (
  ctx,
  x,
  y,
  width,
  height,
  radius,
  fill = false,
  stroke = false
) => {
  if (typeof radius === "undefined") radius = 5;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();

  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
};

const worldToMinimap = (target, worldSize, minimap) => {
  return {
    x:
      minimap.x +
      ((target.x + COMMON_SPRITE_WIDTH / 2) / worldSize.width) * minimap.width,
    y:
      minimap.y +
      ((target.y + COMMON_SPRITE_HEIGHT / 2) / worldSize.height) *
        minimap.height,
  };
};

export {
  clamp,
  distantBetween,
  roundRect,
  spriteCenterCoordinate,
  subtractPosition,
  worldToMinimap,
};
