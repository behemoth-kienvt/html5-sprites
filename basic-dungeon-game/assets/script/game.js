import {
  ANIMATION_PHASES,
  ANIMATION_TYPE,
  COMMON_SPRITE_HEIGHT,
  COMMON_SPRITE_WIDTH,
  DIRECTION_KEYS,
  ENEMY_COLLISION_RADIUS,
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
  HIT_SCORE,
  INIT_ENEMY_COUNT,
  KILL_SCORE,
  LAST_FRAME_INDEX,
  LAST_LOOPED_FRAME_INDEX,
  MAX_ENEMIES,
  MAX_WORLD_HEIGHT,
  MAX_WORLD_WIDTH,
  NO_SPAWN_ENEMY_AREA_SIZE,
  PLAYER_ATTACK_COOLDOWN,
  PLAYER_ATTACK_FRAME,
  PLAYER_ATTACK_RANGE,
  PLAYER_COLLISION_RADIUS,
  PLAYER_INIT_HEALTH,
  PLAYER_INVULNERABLE_TIME,
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
  collisionRadius: PLAYER_COLLISION_RADIUS, //
  facingDirectionX: 1, // control by WASD keys
  facingDirectionY: 0, // control by WASD keys
  score: 0,
  invulnerable: 0, // seconds
  alive: true,
  health: PLAYER_INIT_HEALTH,
  maxHealth: PLAYER_MAX_HEALTH,
  lastDirectionKey: null,
  attackCooldown: 0,
  attacking: false,
  attackTimer: 0,
  attackHitRegisteredThisSwing: false,
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
      collisionRadius: ENEMY_COLLISION_RADIUS,
      facingDirectionX: 1,
      facingDirectionY: 0,
      alive: true,
      invulnerable: 0,
      spawning: true,
      spawnTimer: 0,
      spawnDuration: 0.6,
      collidable: false,
      health: ENEMY_INIT_HEALTH,
      maxHealth: ENEMY_MAX_HEALTH,
      dying: false,
      respawnTimer: 0,
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
  gradient,
  invulnerable
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

  drawDamageFlash(
    ctx,
    heightBarPosition.x,
    heightBarPosition.y,
    HEALTH_BAR_WIDTH,
    HEALTH_BAR_HEIGHT,
    HEALTH_BAR_RADIOS,
    invulnerable
  );

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

const drawDamageFlash = (ctx, x, y, w, h, r, invulnerable) => {
  if (invulnerable > 0 && Math.floor(invulnerable * 8) % 2 === 0) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgb(255, 0, 0)";
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
  }
};

const drawEnemy = (enemy) => {
  const sx = enemy.animation.typeIndex * COMMON_SPRITE_WIDTH;
  const sy = enemy.animation.frameIndex * COMMON_SPRITE_HEIGHT;

  const { x, y } = spriteCenterCoordinate(enemy);

  const centerX = x + COMMON_SPRITE_WIDTH / 2;
  const centerY = y + COMMON_SPRITE_HEIGHT * 0.82;

  // determine sprite scale/alpha depending on spawning/dying
  let spriteScale = 1;
  let spriteAlpha = 1;
  let drawTransformed = false;

  if (enemy.spawning) {
    const spawnProgress = Math.min(1, enemy.spawnTimer / enemy.spawnDuration);
    const easedOut = Math.sin((spawnProgress * Math.PI) / 2);
    spriteScale = easedOut;
    spriteAlpha = easedOut;
    drawTransformed = true;

    // draw spawn shadow
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
  } else if (enemy.dying) {
    const progress = Math.max(0, enemy.respawnTimer / enemy.spawnDuration);
    const eased = Math.sin((progress * Math.PI) / 2);
    spriteScale = eased;
    spriteAlpha = eased;
    drawTransformed = true;

    // draw shrink shadow (fade out)
    const baseWidth = COMMON_SPRITE_WIDTH * 0.9;
    const baseHeight = COMMON_SPRITE_HEIGHT * 0.28;
    const ellipseWidth = baseWidth * (0.6 + 0.4 * eased);
    const ellipseHeight = baseHeight * (0.4 + 0.6 * eased);

    gameCtx.save();
    gameCtx.globalAlpha = 0.65 * eased;
    gameCtx.beginPath();
    gameCtx.ellipse(
      centerX,
      centerY,
      ellipseWidth / 2,
      ellipseHeight / 2,
      0,
      0,
      Math.PI * 2
    );
    gameCtx.fillStyle = `rgba(120,20,20,${0.6 * eased})`;
    gameCtx.fill();
    gameCtx.restore();
  }

  // draw sprite (transformed when spawning/dying so health bar scales correctly)
  if (drawTransformed) {
    gameCtx.save();
    gameCtx.globalAlpha = spriteAlpha;

    const drawCenterX = x + COMMON_SPRITE_WIDTH / 2;
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
      enemy.healthBarGradient,
      enemy.invulnerable
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
      enemy.healthBarGradient,
      enemy.invulnerable
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
    player.healthBarGradient,
    player.invulnerable
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
  if (enemy.invulnerable > 0) {
    enemy.invulnerable = Math.max(0, enemy.invulnerable - deltaTime);
  }

  if (enemy.spawning) {
    enemy.spawnTimer += deltaTime;
    if (enemy.spawnTimer >= enemy.spawnDuration) {
      enemy.spawning = false;
      enemy.spawnTimer = enemy.spawnDuration;
      enemy.collidable = true;
    }
  }

  if (enemy.dying) {
    enemy.respawnTimer = Math.max(0, enemy.respawnTimer - deltaTime);
  }
};

const updateEnemies = (deltaTime) => {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    updateEnemy(enemy, deltaTime);

    if (enemy.dying && enemy.respawnTimer <= 0) {
      enemies.splice(i, 1);
    }
  }
};

const handleDodge = () => {};

// pick dominant axis to convert facing vector into a cardinal key
const getCardinalFromFacing = (fx, fy) => {
  if (Math.abs(fx) >= Math.abs(fy)) {
    return fx >= 0 ? "d" : "a";
  } else {
    return fy >= 0 ? "s" : "w";
  }
};

const startPlayerAttack = (directionKey) => {
  if (player.attacking) return;

  let directionKeyToUse = null;

  if (directionKey) {
    directionKeyToUse = directionKey;
  } else if (player.lastDirectionKey) {
    directionKeyToUse = player.lastDirectionKey;
  } else {
    directionKeyToUse = getCardinalFromFacing(
      player.facingDirectionX,
      player.facingDirectionY
    );
  }
  if (!directionKeyToUse) directionKeyToUse = "d";

  const directionMap = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  const direction = directionMap[directionKeyToUse] || [1, 0];

  player.facingDirectionX = direction[0];
  player.facingDirectionY = direction[1];

  if (directionKeyToUse === "a") {
    player.animation.typeIndex = ANIMATION_TYPE.ATTACK_LEFT;
  } else {
    player.animation.typeIndex = ANIMATION_TYPE.ATTACK_RIGHT;
  }

  player.attacking = true;
  player.attackTimer = 0;
  player.attackHitRegisteredThisSwing = false;
  player.attackCooldown = PLAYER_ATTACK_COOLDOWN;

  player.animation.frameIndex = 0;
  player.animation.frameTimer = 0;
  player.animation.playing = true;
  player.animation.finishing = false;
  player.animation.phase = ANIMATION_PHASES.STARTUP;
};

const handleAttack = () => {
  if (keys["f"] && player.attackCooldown <= 0 && !player.attacking) {
    const pressedDirs = DIRECTION_KEYS.filter((k) => keys[k]);
    const singleDirectionKey = pressedDirs.length === 1 ? pressedDirs[0] : null;

    startPlayerAttack(singleDirectionKey || null);
  }
};

const updateAttack = (deltaTime) => {
  if (player.attackCooldown > 0)
    player.attackCooldown = Math.max(0, player.attackCooldown - deltaTime);

  if (!player.attacking) return;

  player.attackTimer += deltaTime;
  if (player.attackTimer >= FRAME_DURATION) {
    player.attackTimer -= FRAME_DURATION;
    player.animation.frameIndex += 1;

    if (player.animation.frameIndex > LAST_FRAME_INDEX) {
      player.attacking = false;
      player.animation.playing = false;
      player.animation.finishing = false;
      player.animation.phase = ANIMATION_PHASES.NULL;
      player.animation.typeIndex = ANIMATION_TYPE.STATIC;
      player.animation.frameIndex = 0;
      player.animation.frameTimer = 0;
      player.attackHitRegisteredThisSwing = false;
      return;
    }
  }

  if (
    !player.attackHitRegisteredThisSwing &&
    player.animation.frameIndex === PLAYER_ATTACK_FRAME
  ) {
    const attackDirX = player.facingDirectionX;
    const attackDirY = player.facingDirectionY;

    for (const enemy of enemies) {
      if (!enemy.collidable || enemy.dying) continue;
      if (enemy.invulnerable > 0) continue;

      const ex = enemy.x + COMMON_SPRITE_WIDTH / 2;
      const ey = enemy.y + COMMON_SPRITE_HEIGHT / 2;
      const px = player.x + COMMON_SPRITE_WIDTH / 2;
      const py = player.y + COMMON_SPRITE_HEIGHT / 2;

      const dx = ex - px;
      const dy = ey - py;
      const dist = Math.hypot(dx, dy);
      if (dist > PLAYER_ATTACK_RANGE) continue;

      if (Math.abs(attackDirX) >= Math.abs(attackDirY)) {
        if (attackDirX > 0) {
          // right
          if (
            !(
              ex >= px &&
              ex - px <= PLAYER_ATTACK_RANGE &&
              Math.abs(ey - py) <= PLAYER_COLLISION_RADIUS
            )
          ) {
            continue;
          }
        } else {
          // left
          if (
            !(
              ex <= px &&
              px - ex <= PLAYER_ATTACK_RANGE &&
              Math.abs(ey - py) <= PLAYER_COLLISION_RADIUS
            )
          ) {
            continue;
          }
        }
      } else {
        if (attackDirY > 0) {
          // down
          if (
            !(
              ey >= py &&
              ey - py <= PLAYER_ATTACK_RANGE &&
              Math.abs(ex - px) <= PLAYER_COLLISION_RADIUS
            )
          ) {
            continue;
          }
        } else {
          // up
          if (
            !(
              ey <= py &&
              py - ey <= PLAYER_ATTACK_RANGE &&
              Math.abs(ex - px) <= PLAYER_COLLISION_RADIUS
            )
          ) {
            continue;
          }
        }
      }

      enemy.health -= 1;
      enemy.invulnerable = 1.0;

      player.score += HIT_SCORE;

      if (enemy.health <= 0) {
        enemy.dying = true;
        enemy.respawnTimer = enemy.spawnDuration;
        enemy.collidable = false;
        enemy.invulnerable = 1.0;

        player.score += KILL_SCORE;
      }
    }

    player.attackHitRegisteredThisSwing = true;
  }
};

const handleEnemyCollision = (deltaTime) => {
  if (player.invulnerable > 0)
    player.invulnerable = Math.max(0, player.invulnerable - deltaTime);

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const distanceFromPlayer = distantBetween(player, enemy);

    if (distanceFromPlayer <= player.collisionRadius + enemy.collisionRadius) {
      if (player.invulnerable <= 0) {
        player.health -= 1;
        player.invulnerable = PLAYER_INVULNERABLE_TIME;

        if (player.health <= 0) {
          player.health = player.maxHealth;
          player.x = worldSize.w / 2;
          player.y = worldSize.h / 2;
        }
      }
    }
  }
};

const handleNormalMove = (movementX, movementY, deltaTime) => {
  const speed = player.speed;

  player.x += movementX * speed * deltaTime;
  player.y += movementY * speed * deltaTime;
};

const handleDash = (movementX, movementY, deltaTime) => {
  handleNormalMove(movementX, movementY, deltaTime);
};

const updateAnimation = (deltaTime) => {
  if (player.attacking) return;

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
  if (player.attacking) {
    handleAttack();
    handleEnemyCollision(deltaTime);
    return;
  }

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
    handleEnemyCollision(deltaTime);
    return;
  }

  const moving = movementX !== 0 || movementY !== 0;

  if (moving) {
    const movingLength = Math.hypot(movementX, movementY) || 1;

    movementX /= movingLength;
    movementY /= movingLength;

    player.facingDirectionX = movementX;
    player.facingDirectionY = movementY;

    const singlePressed = dirCount === 1;
    if (singlePressed) {
      const pressedKey = ["w", "a", "s", "d"].find((k) => keys[k]);
      if (pressedKey) player.lastDirectionKey = pressedKey;
    }
  }

  handleDodge();
  handleDash(movementX, movementY, deltaTime);

  // clamp player position inside world border
  player.x = clamp(player.x, 10, worldSize.w - 10);
  player.y = clamp(player.y, 10, worldSize.h - 10);

  handleAttack();
  handleEnemyCollision(deltaTime);
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
  updateAttack(deltaTime);
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
