const gridEl = document.getElementById("grid");
const piecesEl = document.getElementById("pieces");
const targetEl = document.getElementById("target");
const logEl = document.getElementById("log");
const resultEl = document.getElementById("result");
const timeLeftEl = document.getElementById("timeLeft");
const digCountEl = document.getElementById("digCount");
const progressEl = document.getElementById("progress");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const levelSelectEl = document.getElementById("levelSelect");
const gameAreaEl = document.getElementById("gameArea");
const levelNameEl = document.getElementById("levelName");
const backBtn = document.getElementById("backBtn");

const levels = {
  bowl: {
    name: "陶碗",
    pieceName: "陶片",
    timeLimit: 90,
    targetClass: "bowl-target",
    pieceClass: "bowl-piece",
    buried: {
      2: "p1",
      7: "p2",
      13: "p3",
      21: "p4"
    },
    pieceDefs: [
      { id: "p1", label: "上左", slot: { x: 10, y: 12 }, angle: 0 },
      { id: "p2", label: "上右", slot: { x: 51, y: 12 }, angle: 90 },
      { id: "p3", label: "下左", slot: { x: 10, y: 53 }, angle: 180 },
      { id: "p4", label: "下右", slot: { x: 51, y: 53 }, angle: 270 }
    ]
  },
  tile: {
    name: "瓦当",
    pieceName: "瓦当残片",
    timeLimit: 120,
    targetClass: "tile-target",
    pieceClass: "tile-piece",
    buried: {
      1: "p1",
      5: "p2",
      9: "p3",
      12: "p4",
      17: "p5",
      23: "p6"
    },
    pieceDefs: [
      { id: "p1", label: "左上", slot: { x: 5, y: 8 }, angle: 0 },
      { id: "p2", label: "右上", slot: { x: 55, y: 8 }, angle: 90 },
      { id: "p3", label: "左中", slot: { x: 5, y: 40 }, angle: 180 },
      { id: "p4", label: "右中", slot: { x: 55, y: 40 }, angle: 270 },
      { id: "p5", label: "左下", slot: { x: 5, y: 68 }, angle: 0 },
      { id: "p6", label: "右下", slot: { x: 55, y: 68 }, angle: 90 }
    ]
  },
  mirror: {
    name: "青铜镜",
    pieceName: "铜镜残片",
    timeLimit: 180,
    targetClass: "mirror-target",
    pieceClass: "mirror-piece",
    buried: {
      0: "p1",
      4: "p2",
      6: "p3",
      10: "p4",
      14: "p5",
      16: "p6",
      18: "p7",
      20: "p8",
      24: "p9"
    },
    pieceDefs: [
      { id: "p1", label: "顶", slot: { x: 33, y: 3 }, angle: 0 },
      { id: "p2", label: "右上", slot: { x: 60, y: 15 }, angle: 45 },
      { id: "p3", label: "右", slot: { x: 68, y: 38 }, angle: 90 },
      { id: "p4", label: "右下", slot: { x: 60, y: 62 }, angle: 135 },
      { id: "p5", label: "底", slot: { x: 33, y: 75 }, angle: 180 },
      { id: "p6", label: "左下", slot: { x: 8, y: 62 }, angle: 225 },
      { id: "p7", label: "左", slot: { x: 2, y: 38 }, angle: 270 },
      { id: "p8", label: "左上", slot: { x: 8, y: 15 }, angle: 315 },
      { id: "p9", label: "中心", slot: { x: 33, y: 38 }, angle: 0 }
    ]
  }
};

let currentLevel = null;
let state;
let timer;
let dragging = null;

function freshState() {
  const level = levels[currentLevel];
  return {
    running: false,
    timeLeft: level.timeLimit,
    digs: 0,
    dug: new Set(),
    found: new Set(),
    locked: new Set(),
    log: [`探方已经布好，先从泥土里找${level.pieceName}。`]
  };
}

function resetStatsDisplay(levelId) {
  if (levelId && levels[levelId]) {
    timeLeftEl.textContent = String(levels[levelId].timeLimit);
  } else {
    timeLeftEl.textContent = "90";
  }
  digCountEl.textContent = "0";
  progressEl.textContent = "0%";
}

function init() {
  document.querySelectorAll(".level-card").forEach((card) => {
    card.addEventListener("click", () => selectLevel(card.dataset.level));
  });
  startBtn.addEventListener("click", start);
  restartBtn.addEventListener("click", reset);
  backBtn.addEventListener("click", goBack);
  resetStatsDisplay();
  levelSelectEl.classList.remove("hidden");
  gameAreaEl.classList.add("hidden");
  resultEl.classList.add("hidden");
  backBtn.classList.add("hidden");
}

function selectLevel(levelId) {
  currentLevel = levelId;
  const level = levels[levelId];
  levelNameEl.textContent = level.name;
  targetEl.className = `target ${level.targetClass}`;
  levelSelectEl.classList.add("hidden");
  gameAreaEl.classList.remove("hidden");
  backBtn.classList.remove("hidden");
  state = freshState();
  piecesEl.innerHTML = "";
  resultEl.classList.add("hidden");
  resetStatsDisplay(levelId);
  render();
}

function goBack() {
  clearInterval(timer);
  currentLevel = null;
  levelSelectEl.classList.remove("hidden");
  gameAreaEl.classList.add("hidden");
  resultEl.classList.add("hidden");
  backBtn.classList.add("hidden");
  piecesEl.innerHTML = "";
  resetStatsDisplay();
}

function start() {
  if (state.running) return;
  state.running = true;
  resultEl.classList.add("hidden");
  const level = levels[currentLevel];
  addLog(`计时开始，${level.name}进入抢救性发掘。`);
  timer = setInterval(() => {
    state.timeLeft -= 1;
    if (state.timeLeft <= 0) {
      finish(false, `时间到了，${level.name}没能完整修复。`);
    }
    renderStats();
  }, 1000);
  render();
}

function reset() {
  clearInterval(timer);
  state = freshState();
  piecesEl.innerHTML = "";
  resultEl.classList.add("hidden");
  resetStatsDisplay(currentLevel);
  render();
}

function dig(index) {
  if (!state.running || state.dug.has(index)) return;
  const level = levels[currentLevel];
  state.dug.add(index);
  state.digs += 1;
  if (level.buried[index]) {
    const id = level.buried[index];
    state.found.add(id);
    addLog(`挖到了${level.pieceDefs.find((p) => p.id === id).label}${level.pieceName}。`);
    spawnPiece(id);
  } else {
    addLog("这一格只有松土和碎砂。");
  }
  render();
}

function spawnPiece(id) {
  if (document.querySelector(`[data-id="${id}"]`)) return;
  const level = levels[currentLevel];
  const def = level.pieceDefs.find((piece) => piece.id === id);
  const piece = document.createElement("div");
  piece.className = `piece ${level.pieceClass}`;
  piece.dataset.id = id;
  piece.dataset.angle = String((def.angle + 90) % 360);
  piece.textContent = def.label;
  piece.style.left = `${22 + state.found.size * 16}px`;
  piece.style.top = `${26 + state.found.size * 48}px`;
  applyRotation(piece);
  piece.addEventListener("pointerdown", startDrag);
  piece.addEventListener("dblclick", () => rotatePiece(piece));
  piecesEl.appendChild(piece);
}

function startDrag(event) {
  const piece = event.currentTarget;
  if (piece.classList.contains("locked")) return;
  piece.setPointerCapture(event.pointerId);
  dragging = {
    piece,
    offsetX: event.clientX - piece.offsetLeft,
    offsetY: event.clientY - piece.offsetTop
  };
  piece.addEventListener("pointermove", dragMove);
  piece.addEventListener("pointerup", endDrag, { once: true });
}

function dragMove(event) {
  if (!dragging) return;
  const rect = piecesEl.getBoundingClientRect();
  dragging.piece.style.left = `${event.clientX - rect.left - 50}px`;
  dragging.piece.style.top = `${event.clientY - rect.top - 50}px`;
}

function endDrag(event) {
  const piece = event.currentTarget;
  piece.removeEventListener("pointermove", dragMove);
  dragging = null;
  trySnap(piece);
}

function rotatePiece(piece) {
  if (!state.running || piece.classList.contains("locked")) return;
  piece.dataset.angle = String((Number(piece.dataset.angle) + 45) % 360);
  applyRotation(piece);
}

function applyRotation(piece) {
  piece.style.transform = `rotate(${piece.dataset.angle}deg)`;
}

function trySnap(piece) {
  const level = levels[currentLevel];
  const id = piece.dataset.id;
  const def = level.pieceDefs.find((item) => item.id === id);
  const pieceRect = piece.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const centerX = pieceRect.left + pieceRect.width / 2;
  const centerY = pieceRect.top + pieceRect.height / 2;
  const targetX = targetRect.left + targetRect.width * (def.slot.x + 18) / 100;
  const targetY = targetRect.top + targetRect.height * (def.slot.y + 18) / 100;
  const distance = Math.hypot(centerX - targetX, centerY - targetY);
  const angleOk = Number(piece.dataset.angle) === def.angle;
  if (distance < 72 && angleOk) {
    const benchRect = piecesEl.getBoundingClientRect();
    const targetRelativeX = targetRect.left - benchRect.left + targetRect.width * def.slot.x / 100;
    const targetRelativeY = targetRect.top - benchRect.top + targetRect.height * def.slot.y / 100;
    piece.style.left = `${targetRelativeX}px`;
    piece.style.top = `${targetRelativeY}px`;
    piece.classList.add("locked");
    state.locked.add(id);
    addLog(`${def.label}${level.pieceName}贴合成功。`);
    if (state.locked.size === level.pieceDefs.length) {
      finish(true, `${level.name}修复完成。`);
    }
  } else if (!angleOk) {
    addLog("角度不对，双击碎片可以旋转。");
  }
  renderStats();
}

function finish(success, message) {
  if (!state.running && state.timeLeft > 0) return;
  state.running = false;
  clearInterval(timer);
  const level = levels[currentLevel];
  const completeness = Math.round((state.locked.size / level.pieceDefs.length) * 100);
  resultEl.innerHTML = `<h2>${message}</h2><p>${success ? "通关" : "结束"}：${level.name}修复任务 · 用时${level.timeLimit - state.timeLeft}秒 · 挖掘${state.digs}次 · 完整度${completeness}%。</p>`;
  resultEl.classList.remove("hidden");
  addLog("本轮记录已归档。");
  render();
}

function addLog(text) {
  state.log.push(text);
  state.log = state.log.slice(-30);
}

function render() {
  renderStats();
  renderGrid();
  renderLog();
  startBtn.disabled = state.running;
}

function renderStats() {
  const level = levels[currentLevel];
  timeLeftEl.textContent = state.timeLeft;
  digCountEl.textContent = state.digs;
  progressEl.textContent = `${Math.round((state.locked.size / level.pieceDefs.length) * 100)}%`;
}

function renderGrid() {
  const level = levels[currentLevel];
  gridEl.innerHTML = "";
  for (let i = 0; i < 25; i += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    if (state.dug.has(i)) cell.classList.add("dug");
    if (state.found.has(level.buried[i])) cell.classList.add("found");
    cell.textContent = state.dug.has(i) ? (level.buried[i] ? level.pieceName : "土") : "";
    cell.disabled = !state.running || state.dug.has(i);
    cell.addEventListener("click", () => dig(i));
    gridEl.appendChild(cell);
  }
}

function renderLog() {
  logEl.innerHTML = "";
  state.log.forEach((entry) => {
    const p = document.createElement("p");
    p.textContent = entry;
    logEl.appendChild(p);
  });
}

init();
