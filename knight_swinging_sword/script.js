const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const spriteSheet = new Image();

const spriteLength = 4;
const scaleRatio = 2;
const spriteHeight = 198;
const spriteWidth = 124;
const scaledSpriteHeight = spriteHeight * scaleRatio;
const scaledSpriteWidth = spriteWidth * scaleRatio;

let currentLoopIndex = 0;
let frameCount = 0;
let isPlaying = false;
let leftHeld = false;
let leftPaused = false;
let rightHeld = false;
let lastAction = null;

const framesPerStep = 9;

const elSpace = document.getElementById("space");
const elLeftClick = document.getElementById("left-click");
const elCharge = document.getElementById("charge");
const elDodge = document.getElementById("dodge");

function clearHighlights() {
  elSpace.classList.remove("active");
  elLeftClick.classList.remove("active");
  elCharge.classList.remove("active");
  elDodge.classList.remove("active");
}

function setHighlight(id) {
  clearHighlights();

  if (id === "space") elSpace.classList.add("active");
  if (id === "left-click") elLeftClick.classList.add("active");
  if (id === "charge") elCharge.classList.add("active");
  if (id === "dodge") elDodge.classList.add("active");
}

spriteSheet.src = "./knight_swinging_sword_124x198.png";

spriteSheet.onload = function () {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawFrame(0, 0, 0, 0);
  clearHighlights();
};

const drawFrame = (frameX, frameY, canvasX, canvasY) => {
  ctx.drawImage(
    spriteSheet,
    frameX * spriteWidth,
    frameY * spriteHeight,
    spriteWidth,
    spriteHeight,
    canvasX,
    canvasY,
    scaledSpriteWidth,
    scaledSpriteHeight
  );
};

function playAnimation() {
  if (!isPlaying) return;

  if (rightHeld) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFrame(spriteLength - 1, 0, 0, 0);

    setHighlight("dodge");
    isPlaying = false;
    lastAction = "right";

    return;
  }

  frameCount++;
  console.log(frameCount, "frameCount");
  if (frameCount < framesPerStep) {
    window.requestAnimationFrame(playAnimation);
    return;
  }
  frameCount = 0;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawFrame(currentLoopIndex, 0, 0, 0);

  if (leftHeld && currentLoopIndex === 1) {
    isPlaying = false;
    leftPaused = true;

    lastAction = "left";
    setHighlight("charge");

    return;
  }

  if (lastAction === "space") {
    setHighlight("space");
  } else if (lastAction === "left") {
    if (!leftHeld && !leftPaused) setHighlight("left-click");
  }

  if (currentLoopIndex >= spriteLength) {
    console.log("end");

    isPlaying = false;
    currentLoopIndex = 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFrame(0, 0, 0, 0);

    lastAction = null;
    clearHighlights();

    return;
  }

  currentLoopIndex++;
  console.log(currentLoopIndex, "currentLoopIndex");

  window.requestAnimationFrame(playAnimation);
}

// prevent default context menu on canvas (right-click)
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    e.preventDefault();

    if (rightHeld) return;

    leftHeld = true;
    leftPaused = false;

    lastAction = "left";
    setHighlight("charge");

    if (isPlaying) return;

    currentLoopIndex = 0;
    frameCount = 0;

    isPlaying = true;

    window.requestAnimationFrame(playAnimation);
  }

  if (e.button === 2) {
    e.preventDefault();
    lastAction = "right";

    rightHeld = true;
    isPlaying = false;
    leftHeld = false;
    leftPaused = false;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFrame(spriteLength - 1, 0, 0, 0);
    setHighlight("dodge");
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0) {
    leftHeld = false;

    if (leftPaused) {
      leftPaused = false;
      isPlaying = true;

      lastAction = "left";

      currentLoopIndex = Math.min(2, spriteLength - 1);
      frameCount = 0;

      setHighlight("left-click");

      window.requestAnimationFrame(playAnimation);
    } else {
      if (isPlaying && lastAction === "left") {
        setHighlight("left-click");
      }
    }
  }

  if (e.button === 2) {
    rightHeld = false;
    lastAction = null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFrame(0, 0, 0, 0);
    clearHighlights();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (isPlaying || rightHeld) return;

    leftHeld = false;
    leftPaused = false;

    lastAction = "space";
    setHighlight("space");

    currentLoopIndex = 0;
    frameCount = 0;

    isPlaying = true;

    window.requestAnimationFrame(playAnimation);
  }
});
