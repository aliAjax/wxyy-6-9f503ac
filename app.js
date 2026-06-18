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

const SITE_EVENTS = {
  collapse: {
    id: "collapse",
    name: "塌方",
    type: "negative",
    probability: 0.12,
    cooldown: 2,
    description: "探方侧壁发生塌方",
    key: true,
    apply(state, level) {
      const cellCount = 25;
      const pieceIndices = Object.keys(level.buried).map(Number);
      const lockable = [];
      for (let i = 0; i < cellCount; i++) {
        if (!state.dug.has(i) && !state.lockedCells.has(i) && !pieceIndices.includes(i)) {
          lockable.push(i);
        }
      }
      const foundPieceIndices = [];
      for (const pi of pieceIndices) {
        if (!state.dug.has(pi) && !state.lockedCells.has(pi)) {
          foundPieceIndices.push(pi);
        }
      }
      const availablePieceCount = foundPieceIndices.length;
      const remainingPieces = pieceIndices.filter(
        (pi) => !state.dug.has(pi) && !state.found.has(level.buried[pi])
      ).length;
      let lockCount = Math.min(2, lockable.length);
      if (lockable.length > 0 && remainingPieces > 2) {
        const actualLock = [];
        for (let i = 0; i < lockCount; i++) {
          if (lockable.length === 0) break;
          const idx = Math.floor(Math.random() * lockable.length);
          actualLock.push(lockable.splice(idx, 1)[0]);
        }
        actualLock.forEach((i) => state.lockedCells.add(i));
        return {
          success: true,
          message: `塌方！${actualLock.length} 格探方被土方掩埋，暂时无法挖掘。`
        };
      }
      return { success: false };
    }
  },
  rain: {
    id: "rain",
    name: "雨水",
    type: "negative",
    probability: 0.1,
    cooldown: 3,
    description: "突降雨水，作业暂停",
    key: true,
    apply(state, level) {
      const minTimeLeft = 15;
      const penalty = Math.min(10, state.timeLeft - minTimeLeft);
      if (penalty > 0) {
        state.timeLeft -= penalty;
        return {
          success: true,
          message: `突降暴雨！现场排水耗费 ${penalty} 秒时间。`
        };
      }
      return { success: false };
    }
  },
  markerLayer: {
    id: "markerLayer",
    name: "发现标记层",
    type: "positive",
    probability: 0.08,
    cooldown: 4,
    description: "发现文化层标记",
    key: true,
    apply(state, level) {
      const pieceIndices = Object.keys(level.buried).map(Number);
      const hiddenPieces = pieceIndices.filter(
        (i) => !state.dug.has(i) && !state.hintedCells.has(i)
      );
      if (hiddenPieces.length > 0) {
        const targetIdx = hiddenPieces[Math.floor(Math.random() * hiddenPieces.length)];
        state.hintedCells.add(targetIdx);
        const def = level.pieceDefs.find((p) => p.id === level.buried[targetIdx]);
        return {
          success: true,
          message: `发现文化层标记！${def ? def.label : "某件"}${level.pieceName}附近有标识。`
        };
      }
      return { success: false };
    }
  },
  toolWear: {
    id: "toolWear",
    name: "工具磨损",
    type: "negative",
    probability: 0.15,
    cooldown: 1,
    description: "发掘工具磨损",
    key: false,
    apply(state, level) {
      state.toolWear += 1;
      return {
        success: true,
        message: `手铲刃口磨损，本轮评分将受影响。`
      };
    }
  },
  goodWeather: {
    id: "goodWeather",
    name: "好天气",
    type: "positive",
    probability: 0.08,
    cooldown: 5,
    description: "天气晴朗，光线充足",
    key: true,
    apply(state, level) {
      if (state.timeLeft < level.timeLimit) {
        const bonus = Math.min(8, level.timeLimit - state.timeLeft);
        state.timeLeft += bonus;
        return {
          success: true,
          message: `天气晴好！多出 ${bonus} 秒作业时间。`
        };
      }
      return { success: false };
    }
  },
  ancientTrack: {
    id: "ancientTrack",
    name: "古人痕迹",
    type: "positive",
    probability: 0.06,
    cooldown: 3,
    description: "发现古人活动痕迹",
    key: true,
    apply(state, level) {
      state.bonusScore += 5;
      return {
        success: true,
        message: `发现古人活动痕迹！额外加 5 分。`
      };
    }
  },
  strayFind: {
    id: "strayFind",
    name: "零散遗物",
    type: "positive",
    probability: 0.07,
    cooldown: 2,
    description: "发现零散遗物",
    key: false,
    apply(state, level) {
      state.bonusScore += 2;
      return {
        success: true,
        message: `发现零散遗物！额外加 2 分。`
      };
    }
  }
};

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
        const recordScore = record.finalScore !== undefined ? record.finalScore : record.completeness;
        const existingScore = existing.finalScore !== undefined ? existing.finalScore : existing.completeness;

        if (recordScore > existingScore) {
          bestByLevel[record.levelId] = record;
        } else if (recordScore === existingScore) {
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

  if (record.finalScore !== undefined) {
    const scoreStat = document.createElement("div");
    scoreStat.className = "record-stat";
    scoreStat.innerHTML = `<div class="record-stat-label">评分</div><div class="record-stat-value">${record.finalScore}</div>`;
    stats.appendChild(scoreStat);
  }

  card.appendChild(header);
  card.appendChild(stats);

  if (record.keyEvents && record.keyEvents.length > 0) {
    const eventsDiv = document.createElement("div");
    eventsDiv.className = "record-events";
    const eventList = record.keyEvents.map((e) => e.name).join(" · ");
    eventsDiv.innerHTML = `<span class="record-events-label">关键事件：</span>${eventList}`;
    card.appendChild(eventsDiv);
  }

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
    log: [`探方已经布好，先从泥土里找${level.pieceName}。`],
    lockedCells: new Set(),
    hintedCells: new Set(),
    toolWear: 0,
    bonusScore: 0,
    triggeredEvents: [],
    keyEvents: [],
    eventCooldowns: {}
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

function tryTriggerEvent() {
  const level = levels[currentLevel];
  const events = Object.values(SITE_EVENTS);
  const availableEvents = events.filter((evt) => {
    const cooldown = state.eventCooldowns[evt.id] || 0;
    return cooldown <= 0;
  });

  for (const evt of availableEvents) {
    if (Math.random() < evt.probability) {
      const result = evt.apply(state, level);
      if (result.success) {
        state.triggeredEvents.push({
          id: evt.id,
          name: evt.name,
          type: evt.type,
          message: result.message,
          timestamp: Date.now()
        });

        if (evt.key) {
          state.keyEvents.push({
            id: evt.id,
            name: evt.name,
            type: evt.type,
            message: result.message
          });
        }

        if (!result.silent) {
          addLog(result.message);
        }

        state.eventCooldowns[evt.id] = evt.cooldown;

        Object.keys(state.eventCooldowns).forEach((id) => {
          if (id !== evt.id && state.eventCooldowns[id] > 0) {
            state.eventCooldowns[id] -= 1;
          }
        });

        return evt;
      }
    }
  }

  Object.keys(state.eventCooldowns).forEach((id) => {
    if (state.eventCooldowns[id] > 0) {
      state.eventCooldowns[id] -= 1;
    }
  });

  return null;
}

function calculateFinalScore(level) {
  const baseScore = Math.round((state.locked.size / level.pieceDefs.length) * 100);
  const timeBonus = Math.max(0, state.timeLeft);
  const digPenalty = Math.max(0, state.digs - level.pieceDefs.length) * 2;
  const wearPenalty = state.toolWear * 3;
  const finalScore = Math.max(0, baseScore + state.bonusScore + Math.floor(timeBonus / 5) - digPenalty - wearPenalty);
  return {
    baseScore,
    bonusScore: state.bonusScore,
    timeBonus: Math.floor(timeBonus / 5),
    digPenalty,
    wearPenalty,
    finalScore
  };
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
      text: "在探方网格中逐格点击进行挖掘，有的格子藏着碎片，有的只有泥土。继续挖掘，直到发现第一片陶片吧！",
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
  if (!state.running || state.dug.has(index) || state.lockedCells.has(index)) return;
  const level = levels[currentLevel];
  state.dug.add(index);
  state.digs += 1;
  if (level.buried[index]) {
    const id = level.buried[index];
    state.found.add(id);
    addLog(`挖到了${level.pieceDefs.find((p) => p.id === id).label}${level.pieceName}。`);
    spawnPiece(id);
    tutorial.notifyAction("dig");
  } else {
    addLog("这一格只有松土和碎砂。");
  }
  tryTriggerEvent();
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
  const scores = calculateFinalScore(level);

  let eventsHtml = "";
  if (state.keyEvents.length > 0) {
    eventsHtml = `<div class="result-events">
      <h3>本轮关键事件</h3>
      <ul>`;
    state.keyEvents.forEach((evt) => {
      const typeClass = evt.type === "positive" ? "event-positive" : "event-negative";
      const icon = evt.type === "positive" ? "✦" : "⚡";
      eventsHtml += `<li class="${typeClass}"><span class="event-icon">${icon}</span>${evt.message}</li>`;
    });
    eventsHtml += `</ul></div>`;
  }

  const scoreBreakdown = `
    <div class="result-scores">
      <h3>评分明细</h3>
      <div class="score-item"><span>完整度</span><span>+${scores.baseScore}</span></div>
      ${scores.bonusScore > 0 ? `<div class="score-item"><span>遗物奖励</span><span>+${scores.bonusScore}</span></div>` : ""}
      ${scores.timeBonus > 0 ? `<div class="score-item"><span>时间奖励</span><span>+${scores.timeBonus}</span></div>` : ""}
      ${scores.digPenalty > 0 ? `<div class="score-item penalty"><span>多余挖掘</span><span>-${scores.digPenalty}</span></div>` : ""}
      ${scores.wearPenalty > 0 ? `<div class="score-item penalty"><span>工具磨损</span><span>-${scores.wearPenalty}</span></div>` : ""}
      <div class="score-item total"><span>最终评分</span><span>${scores.finalScore}</span></div>
    </div>
  `;

  resultEl.innerHTML = `<h2>${message}</h2>
    <p>${success ? "通关" : "结束"}：${level.name}修复任务 · 用时${level.timeLimit - state.timeLeft}秒 · 挖掘${state.digs}次 · 完整度${completeness}%。</p>
    ${eventsHtml}
    ${scoreBreakdown}`;
  resultEl.classList.remove("hidden");

  if (success) {
    const record = {
      levelId: currentLevel,
      levelName: level.name,
      timeUsed: level.timeLimit - state.timeLeft,
      digs: state.digs,
      completeness: completeness,
      finalScore: scores.finalScore,
      scores: scores,
      keyEvents: state.keyEvents,
      toolWear: state.toolWear,
      bonusScore: state.bonusScore,
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
    if (state.lockedCells.has(i)) cell.classList.add("locked-cell");
    if (state.hintedCells.has(i) && !state.dug.has(i)) cell.classList.add("hinted");
    if (state.dug.has(i)) {
      cell.textContent = level.buried[i] ? level.pieceName : "土";
    } else if (state.lockedCells.has(i)) {
      cell.textContent = "⚠";
    } else if (state.hintedCells.has(i)) {
      cell.textContent = "?";
    } else {
      cell.textContent = "";
    }
    cell.disabled = !state.running || state.dug.has(i) || state.lockedCells.has(i);
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
