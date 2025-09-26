import {
  COMMON_SPRITE_HEIGHT,
  COMMON_SPRITE_WIDTH,
  DIRECTION_KEYS,
  ENEMY_SPAWN_INTERVAL,
  FINISH_SPEED_MULTIPLIER,
  FRAME_DURATION,
  FRAMES_PER_ANIMATION,
  LAST_FRAME_INDEX,
  MAX_ENEMIES,
  MAX_WORLD_HEIGHT,
  MAX_WORLD_WIDTH,
  PLAYER_ANIMATION_TYPE,
  PLAYER_ATTACK_COOLDOWN,
  PLAYER_ATTACK_RANGE,
  PLAYER_MAX_HEALTH,
  PLAYER_SPEED,
  PLAYER_SPRITE_SHEET_URL,
  WORLD_BG_URL,
} from "./config.js";

import {
  clamp,
  distantBetween,
  playerSpriteCenterCoordinate,
  worldToScreenCoordinate,
} from "./helper.js";

const gameCanvas = document.getElementById("game");
const gameCtx = gameCanvas.getContext("2d");

const playerSpriteSheet = new Image();
const worldBg = new Image();

const gameCanvasW = gameCanvas.width;
const gameCanvasH = gameCanvas.height;

const worldSize = { w: MAX_WORLD_WIDTH, h: MAX_WORLD_HEIGHT };

const scaleRatio = Math.min(1, gameCanvasW / worldSize.w);
const scaledW = Math.round(worldSize.w * scaleRatio);
const scaledH = Math.round(worldSize.h * scaleRatio);

const directionKeyToColumn = {
  a: 1,
  w: 2,
  s: 3,
  d: 4,
};

const keys = {};

const player = {
  x: worldSize.w / 2, // world horizontal center
  y: worldSize.h / 2, // world vertical center
  speed: PLAYER_SPEED, // movement speed (px/s)
  radius: COMMON_SPRITE_WIDTH / 2, // collision radius
  facingDirectionX: 1, // control by WASD keys
  facingDirectionY: 0, // control by WASD keys
  animation: {
    typeIndex: PLAYER_ANIMATION_TYPE.STATIC,
    frameIndex: 0,
    frameTimer: 0,
    playing: false,
    finishing: false,
  },
};

let enemies = [];
let enemySpawnTimer = 0;

// loop timing
let lastTime = performance.now();

// offscreen world buffer act as BG (will be created in prepareWorld)
let worldBuffer = null;

playerSpriteSheet.src = PLAYER_SPRITE_SHEET_URL;
worldBg.src = WORLD_BG_URL;

const prepareWorld = () => {
  worldBuffer = document.createElement("canvas");
  worldBuffer.width = worldSize.w;
  worldBuffer.height = worldSize.h;

  const worldBufferCtx = worldBuffer.getContext("2d");

  if (worldBg.width >= worldSize.w && worldBg.height >= worldSize.h) {
    worldBufferCtx.drawImage(worldBg, 0, 0, worldSize.w, worldSize.h);
  } else {
    const pattern = worldBufferCtx.createPattern(worldBg, "repeat");
    worldBufferCtx.fillStyle = pattern;
    worldBufferCtx.fillRect(0, 0, worldSize.w, worldSize.h);
  }
};

const getCameraView = () => {
  return {
    x: clamp(player.x - gameCanvasW / 2, 0, worldSize.w - gameCanvasW),
    y: clamp(player.y - gameCanvasH / 2, 0, worldSize.h - gameCanvasH),
    w: gameCanvasW,
    h: gameCanvasH,
  };
};

const drawWorldBackground = () => {
  const camera = getCameraView();

  gameCtx.drawImage(
    worldBuffer,
    camera.x,
    camera.y,
    camera.w,
    camera.h,
    0,
    0,
    gameCanvasW,
    gameCanvasH
  );

  gameCtx.save();
  gameCtx.translate(-camera.x, -camera.y);
};

const drawPlayer = () => {
  const sx = player.animation.typeIndex * COMMON_SPRITE_WIDTH;
  const sy = player.animation.frameIndex * COMMON_SPRITE_HEIGHT;

  const { x, y } = playerSpriteCenterCoordinate(player);

  gameCtx.drawImage(
    playerSpriteSheet,
    sx,
    sy,
    COMMON_SPRITE_WIDTH,
    COMMON_SPRITE_HEIGHT,
    x,
    y,
    COMMON_SPRITE_WIDTH,
    COMMON_SPRITE_HEIGHT
  );
};

const spawnEnemy = () => {};

const handleDodge = () => {};

const handleAttack = () => {};

const handleEnemyCollision = () => {};

const handleNormalMove = (movementX, movementY, deltaTime) => {
  const speed = player.speed;

  player.x += movementX * speed * deltaTime;
  player.y += movementY * speed * deltaTime;
};

const handleDash = (movementX, movementY, deltaTime) => {
  handleNormalMove(movementX, movementY, deltaTime);
};

const updateAnimation = (deltaTime) => {
  const pressedDirs = DIRECTION_KEYS.filter((k) => keys[k]);
  const singleDirectionKey = pressedDirs.length === 1 ? pressedDirs[0] : null;

  if (singleDirectionKey) {
    const targetColumnIndex = directionKeyToColumn[singleDirectionKey];

    // new direction, start from frame 0 and not finishing
    if (
      !player.animation.playing ||
      player.animation.typeIndex !== targetColumnIndex ||
      player.animation.finishing
    ) {
      player.animation.typeIndex = targetColumnIndex;
      player.animation.frameIndex = 0;
      player.animation.frameTimer = 0;
      player.animation.playing = true;
      player.animation.finishing = false;
    }

    player.animation.frameTimer += deltaTime;
    if (player.animation.frameTimer >= FRAME_DURATION) {
      player.animation.frameTimer -= FRAME_DURATION;
      player.animation.frameIndex += 1;

      if (player.animation.frameIndex > LAST_FRAME_INDEX) {
        player.animation.frameIndex = 0;
      }
    }
  } else {
    if (player.animation.playing && !player.animation.finishing) {
      // complete remaining frames at faster speed
      player.animation.finishing = true;
    }

    if (player.animation.playing && player.animation.finishing) {
      // finish remaining frames
      const fastFrameDuration = FRAME_DURATION / FINISH_SPEED_MULTIPLIER;

      player.animation.frameTimer += deltaTime;
      if (player.animation.frameTimer >= fastFrameDuration) {
        player.animation.frameTimer -= fastFrameDuration;

        if (player.animation.frameIndex < LAST_FRAME_INDEX) {
          player.animation.frameIndex += 1;
        } else {
          player.animation.playing = false;
          player.animation.finishing = false;
          player.animation.typeIndex = PLAYER_ANIMATION_TYPE.STATIC;
          player.animation.frameIndex = 0;
          player.animation.frameTimer = 0;
        }
      }
    } else {
      player.animation.playing = false;
      player.animation.finishing = false;
      player.animation.colIndex = PLAYER_ANIMATION_TYPE.STATIC;
      player.animation.frameIndex = 0;
      player.animation.frameTimer = 0;
    }
  }
};

const handleMovementInput = (deltaTime) => {
  let movementX = 0;
  let movementY = 0;

  if (keys["w"]) movementY -= 1;
  if (keys["s"]) movementY += 1;
  if (keys["a"]) movementX -= 1;
  if (keys["d"]) movementX += 1;

  // prevent simultaneous direction keys
  const dirCount = ["w", "a", "s", "d"].reduce(
    (c, k) => c + (keys[k] ? 1 : 0),
    0
  );

  if (dirCount > 1) {
    handleAttack();
    handleEnemyCollision();
    return;
  }

  const moving = movementX !== 0 || movementY !== 0;

  if (moving) {
    const movingLength = Math.hypot(movementX, movementY) || 1;

    movementX /= movingLength;
    movementY /= movingLength;

    player.facingDirectionX = movementX;
    player.facingDirectionY = movementY;
  }

  handleDodge();
  handleDash(movementX, movementY, deltaTime);

  // clamp player position inside world border
  player.x = clamp(player.x, 10, worldSize.w - 10);
  player.y = clamp(player.y, 10, worldSize.h - 10);

  handleAttack();
  handleEnemyCollision();
};

const update = () => {
  const now = performance.now();

  // seconds passed since last frame
  let deltaTime = (now - lastTime) / 1000;
  if (deltaTime > 0.05) deltaTime = 0.05;

  lastTime = now;

  updateAnimation(deltaTime);
  spawnEnemy();
  handleMovementInput(deltaTime);
};

const draw = () => {
  if (!worldBuffer) return;

  gameCtx.clearRect(0, 0, gameCanvasW, gameCanvasH);

  drawWorldBackground();
  drawPlayer();

  gameCtx.restore();
};

const loop = () => {
  update();
  draw();
  requestAnimationFrame(loop);
};

const loadSpriteSheet = () => {
  playerSpriteSheet.onload = () => {
    lastTime = performance.now();
    prepareWorld();
    loop();
  };

  // playerSpriteSheet already loaded
  if (playerSpriteSheet.complete && worldBg.complete) {
    prepareWorld();
    loop();
  }
};

// game init
worldBg.onload = () => {
  loadSpriteSheet();
};

// cached load
if (worldBg.complete) {
  loadSpriteSheet();
}

// prevent default context menu on canvas (right-click)
gameCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
    e.preventDefault();

  keys[e.key.toLowerCase()] = true;
  e.preventDefault();
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
  e.preventDefault();
});
