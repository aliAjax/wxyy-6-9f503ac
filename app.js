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

const buried = {
  2: "p1",
  7: "p2",
  13: "p3",
  21: "p4"
};

const pieceDefs = [
  { id: "p1", label: "上左", slot: { x: 10, y: 12 }, angle: 0 },
  { id: "p2", label: "上右", slot: { x: 51, y: 12 }, angle: 90 },
  { id: "p3", label: "下左", slot: { x: 10, y: 53 }, angle: 180 },
  { id: "p4", label: "下右", slot: { x: 51, y: 53 }, angle: 270 }
];

let state;
let timer;
let dragging = null;

function freshState() {
  return {
    running: false,
    timeLeft: 90,
    digs: 0,
    dug: new Set(),
    found: new Set(),
    locked: new Set(),
    log: ["探方已经布好，先从泥土里找陶片。"]
  };
}

function init() {
  state = freshState();
  startBtn.addEventListener("click", start);
  restartBtn.addEventListener("click", reset);
  render();
}

function start() {
  if (state.running) return;
  state.running = true;
  resultEl.classList.add("hidden");
  addLog("计时开始，考古现场进入抢救性发掘。");
  timer = setInterval(() => {
    state.timeLeft -= 1;
    if (state.timeLeft <= 0) {
      finish(false, "时间到了，器物没能完整修复。");
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
  render();
}

function dig(index) {
  if (!state.running || state.dug.has(index)) return;
  state.dug.add(index);
  state.digs += 1;
  if (buried[index]) {
    const id = buried[index];
    state.found.add(id);
    addLog(`挖到了${pieceDefs.find((p) => p.id === id).label}陶片。`);
    spawnPiece(id);
  } else {
    addLog("这一格只有松土和碎砂。");
  }
  render();
}

function spawnPiece(id) {
  if (document.querySelector(`[data-id="${id}"]`)) return;
  const def = pieceDefs.find((piece) => piece.id === id);
  const piece = document.createElement("div");
  piece.className = "piece";
  piece.dataset.id = id;
  piece.dataset.angle = String((def.angle + 90) % 360);
  piece.textContent = def.label;
  piece.style.left = `${22 + state.found.size * 18}px`;
  piece.style.top = `${26 + state.found.size * 54}px`;
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
  dragging.piece.style.left = `${event.clientX - rect.left - 58}px`;
  dragging.piece.style.top = `${event.clientY - rect.top - 58}px`;
}

function endDrag(event) {
  const piece = event.currentTarget;
  piece.removeEventListener("pointermove", dragMove);
  dragging = null;
  trySnap(piece);
}

function rotatePiece(piece) {
  if (!state.running || piece.classList.contains("locked")) return;
  piece.dataset.angle = String((Number(piece.dataset.angle) + 90) % 360);
  applyRotation(piece);
}

function applyRotation(piece) {
  piece.style.transform = `rotate(${piece.dataset.angle}deg)`;
}

function trySnap(piece) {
  const id = piece.dataset.id;
  const def = pieceDefs.find((item) => item.id === id);
  const pieceRect = piece.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const centerX = pieceRect.left + pieceRect.width / 2;
  const centerY = pieceRect.top + pieceRect.height / 2;
  const targetX = targetRect.left + targetRect.width * (def.slot.x + 19.5) / 100;
  const targetY = targetRect.top + targetRect.height * (def.slot.y + 19.5) / 100;
  const distance = Math.hypot(centerX - targetX, centerY - targetY);
  const angleOk = Number(piece.dataset.angle) === def.angle;
  if (distance < 78 && angleOk) {
    const benchRect = piecesEl.getBoundingClientRect();
    const targetRelativeX = targetRect.left - benchRect.left + targetRect.width * def.slot.x / 100;
    const targetRelativeY = targetRect.top - benchRect.top + targetRect.height * def.slot.y / 100;
    piece.style.left = `${targetRelativeX}px`;
    piece.style.top = `${targetRelativeY}px`;
    piece.classList.add("locked");
    state.locked.add(id);
    addLog(`${def.label}陶片贴合成功。`);
    if (state.locked.size === pieceDefs.length) {
      finish(true, "陶器修复完成。");
    }
  } else if (!angleOk) {
    addLog("角度不对，双击陶片可以旋转。");
  }
  renderStats();
}

function finish(success, message) {
  if (!state.running && state.timeLeft > 0) return;
  state.running = false;
  clearInterval(timer);
  const completeness = Math.round((state.locked.size / pieceDefs.length) * 100);
  resultEl.innerHTML = `<h2>${message}</h2><p>${success ? "通关" : "结束"}：用时${90 - state.timeLeft}秒，挖掘${state.digs}次，完整度${completeness}%。</p>`;
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
  timeLeftEl.textContent = state.timeLeft;
  digCountEl.textContent = state.digs;
  progressEl.textContent = `${Math.round((state.locked.size / pieceDefs.length) * 100)}%`;
}

function renderGrid() {
  gridEl.innerHTML = "";
  for (let i = 0; i < 25; i += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    if (state.dug.has(i)) cell.classList.add("dug");
    if (state.found.has(buried[i])) cell.classList.add("found");
    cell.textContent = state.dug.has(i) ? (buried[i] ? "陶片" : "土") : "";
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
