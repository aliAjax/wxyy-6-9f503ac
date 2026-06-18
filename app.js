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
const archiveBtn = document.getElementById("archiveBtn");
const archiveModal = document.getElementById("archiveModal");
const closeArchiveBtn = document.getElementById("closeArchiveBtn");
const clearArchiveBtn = document.getElementById("clearArchiveBtn");
const confirmModal = document.getElementById("confirmModal");
const cancelClearBtn = document.getElementById("cancelClearBtn");
const confirmClearBtn = document.getElementById("confirmClearBtn");
const recentRecordsEl = document.getElementById("recentRecords");
const bestRecordsEl = document.getElementById("bestRecords");
const tutorialBtn = document.getElementById("tutorialBtn");
const tutorialOverlay = document.getElementById("tutorialOverlay");
const tutorialSpotlight = document.getElementById("tutorialSpotlight");
const tutorialTooltip = document.getElementById("tutorialTooltip");

const ARCHIVE_STORAGE_KEY = "archaeology_archive_records";
const TUTORIAL_STORAGE_KEY = "archaeology_tutorial_done";

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

const archive = {
  load() {
    try {
      const data = localStorage.getItem(ARCHIVE_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("加载档案失败:", e);
      return [];
    }
  },

  save(records) {
    try {
      localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error("保存档案失败:", e);
    }
  },

  addRecord(record) {
    const records = this.load();
    records.unshift(record);
    this.save(records);
  },

  clear() {
    localStorage.removeItem(ARCHIVE_STORAGE_KEY);
  },

  getRecent(limit = 20) {
    return this.load().slice(0, limit);
  },

  getBest() {
    const records = this.load();
    const bestByLevel = {};

    for (const record of records) {
      if (!bestByLevel[record.levelId]) {
        bestByLevel[record.levelId] = record;
      } else {
        const existing = bestByLevel[record.levelId];
        if (record.completeness > existing.completeness) {
          bestByLevel[record.levelId] = record;
        } else if (record.completeness === existing.completeness) {
          if (record.timeUsed < existing.timeUsed) {
            bestByLevel[record.levelId] = record;
          } else if (record.timeUsed === existing.timeUsed && record.digs < existing.digs) {
            bestByLevel[record.levelId] = record;
          }
        }
      }
    }

    return Object.values(bestByLevel).sort((a, b) => {
      const levelOrder = ["bowl", "tile", "mirror"];
      return levelOrder.indexOf(a.levelId) - levelOrder.indexOf(b.levelId);
    });
  }
};

function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function createRecordCard(record, showBadge = false) {
  const card = document.createElement("div");
  card.className = "record-card";

  const header = document.createElement("div");
  header.className = "record-header";

  const levelSpan = document.createElement("span");
  levelSpan.className = "record-level";
  levelSpan.textContent = record.levelName;

  if (showBadge) {
    const badge = document.createElement("span");
    badge.className = "best-badge";
    badge.textContent = "最佳";
    levelSpan.appendChild(badge);
  }

  const timeSpan = document.createElement("span");
  timeSpan.className = "record-time";
  timeSpan.textContent = formatDateTime(record.completedAt);

  header.appendChild(levelSpan);
  header.appendChild(timeSpan);

  const stats = document.createElement("div");
  stats.className = "record-stats";

  const timeStat = document.createElement("div");
  timeStat.className = "record-stat";
  timeStat.innerHTML = `<div class="record-stat-label">用时</div><div class="record-stat-value">${record.timeUsed}秒</div>`;

  const digStat = document.createElement("div");
  digStat.className = "record-stat";
  digStat.innerHTML = `<div class="record-stat-label">挖掘</div><div class="record-stat-value">${record.digs}次</div>`;

  const completenessStat = document.createElement("div");
  completenessStat.className = "record-stat";
  completenessStat.innerHTML = `<div class="record-stat-label">完整度</div><div class="record-stat-value">${record.completeness}%</div>`;

  stats.appendChild(timeStat);
  stats.appendChild(digStat);
  stats.appendChild(completenessStat);

  card.appendChild(header);
  card.appendChild(stats);

  return card;
}

function renderRecentRecords() {
  recentRecordsEl.innerHTML = "";
  const records = archive.getRecent();

  if (records.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "暂无修复记录，快去完成第一个修复任务吧！";
    recentRecordsEl.appendChild(empty);
    return;
  }

  records.forEach((record) => {
    recentRecordsEl.appendChild(createRecordCard(record));
  });
}

function renderBestRecords() {
  bestRecordsEl.innerHTML = "";
  const records = archive.getBest();

  if (records.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "暂无最佳成绩，快去挑战吧！";
    bestRecordsEl.appendChild(empty);
    return;
  }

  records.forEach((record) => {
    bestRecordsEl.appendChild(createRecordCard(record, true));
  });
}

function openArchive() {
  renderRecentRecords();
  renderBestRecords();
  archiveModal.classList.remove("hidden");
}

function closeArchive() {
  archiveModal.classList.add("hidden");
}

function openConfirmModal() {
  confirmModal.classList.remove("hidden");
}

function closeConfirmModal() {
  confirmModal.classList.add("hidden");
}

function clearArchive() {
  archive.clear();
  renderRecentRecords();
  renderBestRecords();
  closeConfirmModal();
}

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

const tutorial = {
  steps: [
    {
      target: null,
      text: "欢迎来到考古修复现场！接下来将带你了解发掘与修复的完整流程。",
      arrow: null,
      action: null
    },
    {
      target: "#startBtn",
      text: "点击「开始挖掘」启动计时，探方网格将变为可操作状态。",
      arrow: "bottom",
      action: "start"
    },
    {
      target: "#grid",
      text: "在探方网格中逐格点击进行挖掘，有的格子藏着碎片，有的只有泥土。试着点击任意一格进行挖掘吧！",
      arrow: "right",
      action: "dig"
    },
    {
      target: "#pieces",
      text: "太棒了！挖到碎片后，残片会出现在修复台右侧区域，等待你拖动修复。",
      arrow: "left",
      action: null
    },
    {
      target: "#pieces",
      text: "按住碎片拖动，将它移向修复台上对应的位置。试着拖动碎片到目标区域附近吧！",
      arrow: "left",
      action: "drag"
    },
    {
      target: "#pieces",
      text: "双击碎片可以旋转 45°，调整到正确角度才能贴合。双击碎片试试旋转吧！",
      arrow: "left",
      action: "rotate"
    },
    {
      target: "#target",
      text: "当碎片的角度和位置都对齐时，它会自动贴合到目标位置。集齐所有碎片即可完成修复！继续尝试将碎片放到正确位置吧。",
      arrow: "right",
      action: "snap"
    },
    {
      target: null,
      text: "教学完成！现在你已经掌握了考古修复的全部技巧，开始你的考古之旅吧。",
      arrow: null,
      action: null
    }
  ],

  current: 0,
  active: false,
  waitingForAction: false,

  isDone() {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === "true";
  },

  markDone() {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
  },

  reset() {
    this.current = 0;
    this.waitingForAction = false;
  },

  start(levelId = "bowl") {
    if (this.active) return;
    this.active = true;
    this.reset();
    
    if (!currentLevel) {
      selectLevel(levelId, true);
    } else {
      reset();
      setTimeout(() => {
        tutorialOverlay.classList.remove("hidden");
        this.showStep();
      }, 100);
      return;
    }
    
    setTimeout(() => {
      tutorialOverlay.classList.remove("hidden");
      this.showStep();
    }, 500);
  },

  end() {
    this.active = false;
    this.waitingForAction = false;
    tutorialOverlay.classList.add("hidden");
    tutorialSpotlight.style.cssText = "";
    tutorialTooltip.style.cssText = "";
    this.markDone();
  },

  next() {
    if (this.waitingForAction) return;
    
    this.current += 1;
    if (this.current >= this.steps.length) {
      this.end();
      return;
    }
    this.showStep();
  },

  skip() {
    this.end();
  },

  notifyAction(action) {
    if (!this.active || !this.waitingForAction) return;
    
    const step = this.steps[this.current];
    if (step.action === action) {
      this.waitingForAction = false;
      const nextBtn = tutorialTooltip.querySelector(".tutorial-next-btn");
      nextBtn.disabled = false;
      nextBtn.textContent = this.current === this.steps.length - 1 ? "完成" : "下一步";
      
      if (action === "snap") {
        setTimeout(() => this.next(), 800);
      }
    }
  },

  showStep() {
    const step = this.steps[this.current];
    const indicator = tutorialTooltip.querySelector(".tutorial-step-indicator");
    const text = tutorialTooltip.querySelector(".tutorial-text");
    const nextBtn = tutorialTooltip.querySelector(".tutorial-next-btn");

    indicator.textContent = `${this.current + 1} / ${this.steps.length}`;
    text.textContent = step.text;
    
    this.waitingForAction = step.action !== null && step.action !== "snap";
    nextBtn.disabled = this.waitingForAction;
    nextBtn.textContent = this.waitingForAction ? "请先完成操作" : (this.current === this.steps.length - 1 ? "完成" : "下一步");

    tutorialTooltip.className = "tutorial-tooltip";

    if (step.target) {
      const el = document.querySelector(step.target);
      if (el && !el.closest(".hidden")) {
        const rect = el.getBoundingClientRect();
        const pad = 10;
        tutorialSpotlight.style.left = `${rect.left - pad}px`;
        tutorialSpotlight.style.top = `${rect.top - pad}px`;
        tutorialSpotlight.style.width = `${rect.width + pad * 2}px`;
        tutorialSpotlight.style.height = `${rect.height + pad * 2}px`;
        tutorialSpotlight.style.display = "";

        this.positionTooltip(rect, step.arrow);
      } else {
        tutorialSpotlight.style.display = "none";
        this.centerTooltip();
      }
    } else {
      tutorialSpotlight.style.display = "none";
      this.centerTooltip();
    }
  },

  centerTooltip() {
    tutorialTooltip.style.left = `${(window.innerWidth - 320) / 2}px`;
    tutorialTooltip.style.top = `${window.innerHeight / 2 - 80}px`;
  },

  positionTooltip(targetRect, arrowSide) {
    const tw = 320;
    const gap = 20;
    let left, top;

    if (arrowSide === "bottom") {
      left = targetRect.left + targetRect.width / 2 - tw / 2;
      top = targetRect.bottom + gap + 10;
      tutorialTooltip.classList.add("arrow-top");
    } else if (arrowSide === "top") {
      left = targetRect.left + targetRect.width / 2 - tw / 2;
      top = targetRect.top - gap - 140;
      tutorialTooltip.classList.add("arrow-bottom");
    } else if (arrowSide === "left") {
      left = targetRect.left - tw - gap;
      top = targetRect.top + targetRect.height / 2 - 70;
      tutorialTooltip.classList.add("arrow-right");
    } else if (arrowSide === "right") {
      left = targetRect.right + gap;
      top = targetRect.top + targetRect.height / 2 - 70;
      tutorialTooltip.classList.add("arrow-left");
    }

    left = Math.max(12, Math.min(left, window.innerWidth - tw - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - 160));

    tutorialTooltip.style.left = `${left}px`;
    tutorialTooltip.style.top = `${top}px`;
  }
};

function init() {
  document.querySelectorAll(".level-card").forEach((card) => {
    card.addEventListener("click", () => selectLevel(card.dataset.level));
  });
  startBtn.addEventListener("click", start);
  restartBtn.addEventListener("click", reset);
  backBtn.addEventListener("click", goBack);
  archiveBtn.addEventListener("click", openArchive);
  closeArchiveBtn.addEventListener("click", closeArchive);
  clearArchiveBtn.addEventListener("click", openConfirmModal);
  cancelClearBtn.addEventListener("click", closeConfirmModal);
  confirmClearBtn.addEventListener("click", clearArchive);

  tutorialBtn.addEventListener("click", () => {
    if (tutorial.active) {
      tutorial.skip();
    } else {
      tutorial.start();
    }
  });
  tutorialTooltip.querySelector(".tutorial-next-btn").addEventListener("click", () => {
    tutorial.next();
  });
  tutorialTooltip.querySelector(".tutorial-skip-btn").addEventListener("click", () => {
    tutorial.skip();
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`${tab}Tab`).classList.add("active");
    });
  });

  archiveModal.addEventListener("click", (e) => {
    if (e.target === archiveModal) closeArchive();
  });

  confirmModal.addEventListener("click", (e) => {
    if (e.target === confirmModal) closeConfirmModal();
  });

  resetStatsDisplay();
  levelSelectEl.classList.remove("hidden");
  gameAreaEl.classList.add("hidden");
  resultEl.classList.add("hidden");
  backBtn.classList.add("hidden");
}

function selectLevel(levelId, skipAutoTutorial = false) {
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

  if (!skipAutoTutorial && !tutorial.isDone() && !tutorial.active) {
    setTimeout(() => tutorial.start(), 400);
  }
}

function goBack() {
  clearInterval(timer);
  if (tutorial.active) tutorial.skip();
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
  tutorial.notifyAction("start");
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
  tutorial.notifyAction("dig");
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
  tutorial.notifyAction("drag");
  trySnap(piece);
}

function rotatePiece(piece) {
  if (!state.running || piece.classList.contains("locked")) return;
  piece.dataset.angle = String((Number(piece.dataset.angle) + 45) % 360);
  applyRotation(piece);
  tutorial.notifyAction("rotate");
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
    tutorial.notifyAction("snap");
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

  if (success) {
    const record = {
      levelId: currentLevel,
      levelName: level.name,
      timeUsed: level.timeLimit - state.timeLeft,
      digs: state.digs,
      completeness: completeness,
      completedAt: Date.now()
    };
    archive.addRecord(record);
    addLog("本轮记录已归档。");
  }

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
