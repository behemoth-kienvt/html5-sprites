import {
  ANIMATION_PHASES,
  ANIMATION_TYPE,
  COMMON_SPRITE_HEIGHT,
  COMMON_SPRITE_WIDTH,
  DIRECTION_KEYS,
  ENEMY_INIT_HEALTH,
  ENEMY_MAX_HEALTH,
  ENEMY_SPAWN_INTERVAL,
  ENEMY_SPEED,
  ENEMY_SPRITE_SHEET_URL,
  FINISH_SPEED_MULTIPLIER,
  FIRST_RETURN_FRAME_INDEX,
  FRAME_DURATION,
  FRAMES_PER_ANIMATION,
  HEALTH_BAR_HEIGHT,
  HEALTH_BAR_RADIOS,
  HEALTH_BAR_SEGMENT_GAP,
  HEALTH_BAR_WIDTH,
  INIT_ENEMY_COUNT,
  LAST_FRAME_INDEX,
  LAST_LOOPED_FRAME_INDEX,
  MAX_ENEMIES,
  MAX_WORLD_HEIGHT,
  MAX_WORLD_WIDTH,
  NO_SPAWN_ENEMY_AREA_SIZE,
  PLAYER_ATTACK_COOLDOWN,
  PLAYER_ATTACK_RANGE,
  PLAYER_INIT_HEALTH,
  PLAYER_MAX_HEALTH,
  PLAYER_SPEED,
  PLAYER_SPRITE_SHEET_URL,
  WORLD_BG_URL,
} from "./config.js";

import {
  clamp,
  distantBetween,
  roundRect,
  spriteCenterCoordinate,
  worldToScreenCoordinate,
} from "./helper.js";

const gameCanvas = document.getElementById("game");
const gameCtx = gameCanvas.getContext("2d");

const enemySpriteSheet = new Image();
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
  score: 0,
  alive: true,
  health: PLAYER_INIT_HEALTH,
  maxHealth: PLAYER_MAX_HEALTH,
  healthBarGradient: {
    startColor: "rgba(155,255,90,1)",
    endColor: "rgba(100,255,30,1)",
  },
  animation: {
    typeIndex: ANIMATION_TYPE.STATIC,
    frameIndex: 0,
    frameTimer: 0,
    playing: false,
    finishing: false,
    phase: ANIMATION_PHASES.NULL,
  },
};

let enemies = [];
let enemySpawnTimer = 0;

// loop timing
let lastTime = performance.now();

// offscreen world buffer act as BG (will be created in prepareWorld)
let worldBuffer = null;

enemySpriteSheet.src = ENEMY_SPRITE_SHEET_URL;
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

const spawnEnemyAwayFromPlayer = () => {
  if (enemies.length >= MAX_ENEMIES) return;

  let tries = 0;
  while (tries++ < 100) {
    const x = Math.random() * (worldSize.w - 80) + 40;
    const y = Math.random() * (worldSize.h - 80) + 40;
    const distanceFromPlayer = Math.hypot(x - player.x, y - player.y);
    const enemy = {
      x: x,
      y: y,
      speed: ENEMY_SPEED,
      radius: COMMON_SPRITE_WIDTH / 2,
      facingDirectionX: 1,
      facingDirectionY: 0,
      alive: true,
      spawning: true,
      spawnTimer: 0,
      spawnDuration: 0.6,
      collidable: false,
      health: ENEMY_INIT_HEALTH,
      maxHealth: ENEMY_MAX_HEALTH,
      healthBarGradient: {
        startColor: "rgba(255,90,90,1)",
        endColor: "rgba(200,30,30,1)",
      },
      animation: {
        typeIndex: ANIMATION_TYPE.STATIC,
        frameIndex: 0,
        frameTimer: 0,
        playing: false,
        finishing: false,
        phase: ANIMATION_PHASES.NULL,
      },
    };

    if (distanceFromPlayer > NO_SPAWN_ENEMY_AREA_SIZE) {
      enemies.push(enemy);
      return;
    }
  }
};

const drawHealthBar = (
  ctx,
  topLeftX,
  topLeftY,
  spriteW,
  maxHealth,
  health,
  gradient
) => {
  const heightBarPosition = {
    x: topLeftX + (spriteW - HEALTH_BAR_WIDTH) / 2,
    y: topLeftY - HEALTH_BAR_HEIGHT * 3,
  };

  const segments = Math.max(1, Math.floor(maxHealth));
  const totalGap = HEALTH_BAR_SEGMENT_GAP * (segments - 1);
  const segmentsWidth = (HEALTH_BAR_WIDTH - totalGap) / segments;
  const segmentsHeight = HEALTH_BAR_HEIGHT;

  // background
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(
    ctx,
    heightBarPosition.x - 2,
    heightBarPosition.y - 2,
    HEALTH_BAR_WIDTH + 4,
    HEALTH_BAR_HEIGHT + 4,
    HEALTH_BAR_RADIOS
  );
  ctx.fill();

  // border
  ctx.lineWidth = 2;
  ctx.strokeStyle = "silver";
  roundRect(
    ctx,
    heightBarPosition.x - 2,
    heightBarPosition.y - 2,
    HEALTH_BAR_WIDTH + 4,
    HEALTH_BAR_HEIGHT + 4,
    HEALTH_BAR_RADIOS
  );
  ctx.stroke();

  for (let i = 0; i < segments; i++) {
    const segmentPosition = {
      x: heightBarPosition.x + i * (segmentsWidth + HEALTH_BAR_SEGMENT_GAP),
      y: heightBarPosition.y,
    };

    if (i < health) {
      const grad = ctx.createLinearGradient(
        segmentPosition.x,
        segmentPosition.y,
        segmentPosition.x,
        segmentPosition.y + segmentsHeight
      );
      grad.addColorStop(0, gradient.startColor);
      grad.addColorStop(1, gradient.endColor);
      ctx.fillStyle = grad;
      roundRect(
        ctx,
        segmentPosition.x,
        segmentPosition.y,
        segmentsWidth,
        segmentsHeight,
        HEALTH_BAR_RADIOS - 1
      );
      ctx.fill();

      // highlight at top segment
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "white";
      roundRect(
        ctx,
        segmentPosition.x + 1,
        segmentPosition.y + 1,
        segmentsWidth - 2,
        Math.max(1, segmentsHeight / 3),
        HEALTH_BAR_RADIOS - 2
      );
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // no health segment bg
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      roundRect(
        ctx,
        segmentPosition.x,
        segmentPosition.y,
        segmentsWidth,
        segmentsHeight,
        3
      );
      ctx.fill();
    }
  }

  ctx.restore();
};

const drawEnemy = (enemy) => {
  const sx = enemy.animation.typeIndex * COMMON_SPRITE_WIDTH;
  const sy = enemy.animation.frameIndex * COMMON_SPRITE_HEIGHT;

  const { x, y } = spriteCenterCoordinate(enemy);

  const centerX = x + COMMON_SPRITE_WIDTH / 2;
  const centerY = y + COMMON_SPRITE_HEIGHT * 0.82;

  if (enemy.spawning) {
    // 0..1
    const spawnProgress = Math.min(1, enemy.spawnTimer / enemy.spawnDuration);
    const easedOut = Math.sin((spawnProgress * Math.PI) / 2);
    const spriteScale = easedOut;
    const spriteAlpha = easedOut;

    // spawn shadow sizing:
    const baseWidth = COMMON_SPRITE_WIDTH * 0.9;
    const baseHeight = COMMON_SPRITE_HEIGHT * 0.28;
    const ellipseWidth = baseWidth * (0.6 + 0.4 * easedOut);
    const ellipseHeight = baseHeight * (0.4 + 0.6 * easedOut);

    // alpha: core darker, outer fade quicker
    const coreAlpha = 0.85 * easedOut;
    const ringAlpha =
      0.9 * (1 - Math.pow(1 - spawnProgress, 2)) * (1 - 0.25 * spawnProgress);

    // subtle vertical offset so ellipse appears under feet and not clipped by sprite
    const verticalOffset = COMMON_SPRITE_HEIGHT * 0.02 * (1 - easedOut);

    // draw spawn shadow core
    gameCtx.save();
    gameCtx.globalCompositeOperation = "source-over";
    gameCtx.shadowBlur = 18 * easedOut;
    gameCtx.shadowColor = `rgba(200, 40, 40, ${0.6 * easedOut})`;
    gameCtx.globalAlpha = coreAlpha;
    gameCtx.beginPath();
    gameCtx.ellipse(
      centerX,
      centerY + verticalOffset,
      ellipseWidth / 2,
      ellipseHeight / 2,
      0,
      0,
      Math.PI * 2
    );

    const grad = gameCtx.createRadialGradient(
      centerX,
      centerY + verticalOffset,
      0,
      centerX,
      centerY + verticalOffset,
      ellipseWidth / 2
    );
    grad.addColorStop(0, `rgba(140,10,10,${coreAlpha})`);
    grad.addColorStop(0.6, `rgba(180,30,30,${coreAlpha * 0.7})`);
    grad.addColorStop(1, `rgba(220,70,70,0)`);
    gameCtx.fillStyle = grad;
    gameCtx.fill();

    // draw spawn shadow outer ring
    gameCtx.globalAlpha = ringAlpha;
    gameCtx.lineWidth = 2 + 2 * (1 - spawnProgress);
    gameCtx.strokeStyle = `rgba(255,120,120,${Math.min(0.8, ringAlpha)})`;
    gameCtx.beginPath();
    gameCtx.ellipse(
      centerX,
      centerY + verticalOffset,
      (ellipseWidth * 1.05) / 2,
      (ellipseHeight * 1.05) / 2,
      0,
      0,
      Math.PI * 2
    );
    gameCtx.stroke();

    gameCtx.restore();

    // draw the scaled + faded sprite on top of the ellipse
    gameCtx.save();
    gameCtx.globalAlpha = spriteAlpha;

    // draw sprite with center-based scaling
    const drawCenterX = centerX;
    const drawCenterY = y + COMMON_SPRITE_HEIGHT / 2;
    gameCtx.translate(drawCenterX, drawCenterY);
    gameCtx.scale(spriteScale, spriteScale);
    gameCtx.drawImage(
      enemySpriteSheet,
      sx,
      sy,
      COMMON_SPRITE_WIDTH,
      COMMON_SPRITE_HEIGHT,
      -COMMON_SPRITE_WIDTH / 2,
      -COMMON_SPRITE_HEIGHT / 2,
      COMMON_SPRITE_WIDTH,
      COMMON_SPRITE_HEIGHT
    );
    drawHealthBar(
      gameCtx,
      -COMMON_SPRITE_WIDTH / 2,
      -COMMON_SPRITE_HEIGHT / 2,
      COMMON_SPRITE_WIDTH,
      enemy.maxHealth,
      enemy.health,
      enemy.healthBarGradient
    );
    gameCtx.restore();
  } else {
    gameCtx.drawImage(
      enemySpriteSheet,
      sx,
      sy,
      COMMON_SPRITE_WIDTH,
      COMMON_SPRITE_HEIGHT,
      x,
      y,
      COMMON_SPRITE_WIDTH,
      COMMON_SPRITE_HEIGHT
    );
    drawHealthBar(
      gameCtx,
      x,
      y,
      COMMON_SPRITE_WIDTH,
      enemy.maxHealth,
      enemy.health,
      enemy.healthBarGradient
    );
  }
};

const drawEnemies = () => {
  enemies.forEach((enemy) => {
    drawEnemy(enemy);
  });
};

const drawPlayer = () => {
  const sx = player.animation.typeIndex * COMMON_SPRITE_WIDTH;
  const sy = player.animation.frameIndex * COMMON_SPRITE_HEIGHT;

  const { x, y } = spriteCenterCoordinate(player);

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

  drawHealthBar(
    gameCtx,
    x,
    y,
    COMMON_SPRITE_WIDTH,
    player.maxHealth,
    player.health,
    player.healthBarGradient
  );
};

const spawnEnemy = (deltaTime) => {
  enemySpawnTimer += deltaTime;

  if (enemySpawnTimer >= ENEMY_SPAWN_INTERVAL) {
    enemySpawnTimer = 0;
    spawnEnemyAwayFromPlayer();
  }
};

const updateEnemy = (enemy, deltaTime) => {
  if (enemy.spawning) {
    enemy.spawnTimer += deltaTime;
    if (enemy.spawnTimer >= enemy.spawnDuration) {
      enemy.spawning = false;
      enemy.spawnTimer = enemy.spawnDuration;
      enemy.collidable = true;
    }
  }
};

const updateEnemies = (deltaTime) => {
  for (const enemy of enemies) {
    updateEnemy(enemy, deltaTime);
  }
};

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
      player.animation.phase = ANIMATION_PHASES.STARTUP;
    }

    player.animation.frameTimer += deltaTime;
    if (player.animation.frameTimer >= FRAME_DURATION) {
      player.animation.frameTimer -= FRAME_DURATION;

      if (player.animation.phase === ANIMATION_PHASES.STARTUP) {
        if (player.animation.frameIndex < LAST_LOOPED_FRAME_INDEX) {
          player.animation.frameIndex += 1;
        } else if (player.animation.frameIndex === LAST_LOOPED_FRAME_INDEX) {
          player.animation.phase = ANIMATION_PHASES.LOOP;
          player.animation.frameIndex = 1;
        }
      } else if (player.animation.phase === ANIMATION_PHASES.LOOP) {
        if (player.animation.frameIndex < LAST_LOOPED_FRAME_INDEX) {
          player.animation.frameIndex += 1;
        } else {
          player.animation.frameIndex = 1;
        }
      } else {
        player.animation.frameIndex = Math.min(
          player.animation.frameIndex + 1,
          LAST_FRAME_INDEX
        );
      }
    }
  } else {
    if (player.animation.playing && !player.animation.finishing) {
      // complete remaining frames at faster speed
      player.animation.finishing = true;
      player.animation.frameIndex = FIRST_RETURN_FRAME_INDEX;
      player.animation.frameTimer = 0;
      player.animation.phase = ANIMATION_PHASES.NULL;
    }

    if (player.animation.playing && player.animation.finishing) {
      // finish remaining frames
      const fastFrameDuration = FRAME_DURATION / FINISH_SPEED_MULTIPLIER;

      player.animation.frameTimer += deltaTime;
      if (player.animation.frameTimer >= fastFrameDuration) {
        player.animation.frameTimer -= fastFrameDuration;

        if (player.animation.frameIndex === FIRST_RETURN_FRAME_INDEX) {
          player.animation.frameIndex = LAST_FRAME_INDEX;
        } else if (player.animation.frameIndex === LAST_FRAME_INDEX) {
          player.animation.playing = false;
          player.animation.finishing = false;
          player.animation.phase = ANIMATION_PHASES.NULL;
          player.animation.typeIndex = ANIMATION_TYPE.STATIC;
          player.animation.frameIndex = 0;
          player.animation.frameTimer = 0;
        } else {
          player.animation.frameIndex = LAST_FRAME_INDEX;
        }
      }
    } else {
      player.animation.playing = false;
      player.animation.finishing = false;
      player.animation.phase = ANIMATION_PHASES.NULL;
      player.animation.colIndex = ANIMATION_TYPE.STATIC;
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
  spawnEnemy(deltaTime);
  updateEnemies(deltaTime);
  handleMovementInput(deltaTime);
};

const drawScore = () => {
  const scoreText = "Score: " + player.score;

  gameCtx.save();
  gameCtx.setTransform(1, 0, 0, 1, 0, 0);

  gameCtx.font = "16px sans-serif";
  gameCtx.textBaseline = "middle";

  const padding = 10;
  const textWidth = gameCtx.measureText(scoreText).width;
  const boxW = textWidth + padding * 2;
  const boxH = 36;
  const boxX = gameCanvasW - boxW - 10;
  const boxY = 10;

  gameCtx.strokeStyle = "#fff";
  gameCtx.strokeRect(boxX, boxY, boxW, boxH);
  gameCtx.fillStyle = "#fff";
  gameCtx.fillText(scoreText, boxX + padding, boxY + boxH / 2);

  gameCtx.restore();
};

const draw = () => {
  if (!worldBuffer) return;

  gameCtx.clearRect(0, 0, gameCanvasW, gameCanvasH);

  drawWorldBackground();
  drawEnemies();
  drawPlayer();
  drawScore();

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

enemySpriteSheet.onload = () => {
  for (let i = 0; i < INIT_ENEMY_COUNT; i++) spawnEnemyAwayFromPlayer();
};

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
