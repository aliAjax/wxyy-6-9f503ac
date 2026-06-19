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
const levelDescriptionEl = document.getElementById("levelDescription");
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
const levelListEl = document.querySelector(".level-list");
const levelPreviewEl = document.getElementById("levelPreview");
const previewIconEl = document.getElementById("previewIcon");
const previewNameEl = document.getElementById("previewName");
const previewDifficultyEl = document.getElementById("previewDifficulty");
const previewDescriptionEl = document.getElementById("previewDescription");
const previewPieceCountEl = document.getElementById("previewPieceCount");
const previewTimeLimitEl = document.getElementById("previewTimeLimit");
const previewBestScoreEl = document.getElementById("previewBestScore");
const previewToolsEl = document.getElementById("previewTools");
const previewStartBtn = document.getElementById("previewStartBtn");
const closePreviewBtn = document.getElementById("closePreviewBtn");

let currentPreviewTemplateId = null;
let currentPreviewIsDaily = false;
let currentPreviewDailyPractice = false;
let currentPreviewToolkit = null;
let selectedToolkit = null;

const hintBtn = document.getElementById("hintBtn");
const probeBtn = document.getElementById("probeBtn");
const brushBtn = document.getElementById("brushBtn");
const compassBtn = document.getElementById("compassBtn");
const trowelBtn = document.getElementById("trowelBtn");
const compassIndicator = document.getElementById("compassIndicator");
const compassArrow = compassIndicator.querySelector(".compass-arrow");
const compassDistance = compassIndicator.querySelector(".compass-distance");

const focusBtn = document.getElementById("focusBtn");
const labSection = document.querySelector(".lab");
const digSiteSection = document.querySelector(".dig-site");
const notesSection = document.querySelector(".notes");
const mobileTabs = document.querySelector(".mobile-tabs");

let isMobile = window.innerWidth <= 768;
let currentMobileTab = "dig";
let selectedPiece = null;
let lastTapTime = 0;
let doubleTapDelay = 300;
let touchDragOffsetY = 60;
let pieceInitialPositions = new Map();

let gestureState = {
  active: false,
  initialDistance: 0,
  initialAngle: 0,
  pieceAngle: 0
};

const ARCHIVE_STORAGE_KEY = "archaeology_archive_records";
const TUTORIAL_STORAGE_KEY = "archaeology_tutorial_done";
const SETTINGS_STORAGE_KEY = "archaeology_game_settings";
const RATING_ORDER = { S: 5, A: 4, B: 3, C: 2, D: 1, F: 0 };

const gameSettings = {
  _defaults: {
    eventAnim: true,
    vibration: true,
    autoTutorial: true
  },
  _cache: null,
  load() {
    if (this._cache) return this._cache;
    try {
      const data = localStorage.getItem(SETTINGS_STORAGE_KEY);
      this._cache = data ? { ...this._defaults, ...JSON.parse(data) } : { ...this._defaults };
    } catch (e) {
      this._cache = { ...this._defaults };
    }
    return this._cache;
  },
  save() {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this._cache));
    } catch (e) {
      console.error("保存设置失败:", e);
    }
  },
  get(key) {
    return this.load()[key];
  },
  set(key, value) {
    this.load()[key] = value;
    this.save();
  },
  syncUI() {
    const s = this.load();
    document.getElementById("settingEventAnim").checked = s.eventAnim;
    document.getElementById("settingVibration").checked = s.vibration;
    document.getElementById("settingAutoTutorial").checked = s.autoTutorial;
  }
};

const SITE_EVENTS = {
  collapse: {
    id: "collapse",
    name: "塌方",
    type: "negative",
    probability: 0.12,
    cooldown: 2,
    description: "探方侧壁发生塌方",
    key: true,
    apply(state, template) {
      const cellCount = 25;
      const pieceIndices = Object.keys(template.buried).map(Number);
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
      const remainingPieces = pieceIndices.filter(
        (pi) => !state.dug.has(pi) && !state.found.has(template.buried[pi])
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
    apply(state, template) {
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
    apply(state, template) {
      const pieceIndices = Object.keys(template.buried).map(Number);
      const hiddenPieces = pieceIndices.filter(
        (i) => !state.dug.has(i) && !state.hintedCells.has(i)
      );
      if (hiddenPieces.length > 0) {
        const targetIdx = hiddenPieces[Math.floor(Math.random() * hiddenPieces.length)];
        state.hintedCells.add(targetIdx);
        const def = template.pieceDefs.find((p) => p.id === template.buried[targetIdx]);
        return {
          success: true,
          message: `发现文化层标记！${def ? def.label : "某件"}${template.pieceName}附近有标识。`
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
    apply(state, template) {
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
    apply(state, template) {
      if (state.timeLeft < template.timeLimit) {
        const bonus = Math.min(8, template.timeLimit - state.timeLeft);
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
    apply(state, template) {
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
    apply(state, template) {
      state.bonusScore += 2;
      return {
        success: true,
        message: `发现零散遗物！额外加 2 分。`
      };
    }
  }
};

const TOOLS = {
  probe: {
    id: "probe",
    name: "探针",
    icon: "📍",
    baseCount: 2,
    cost: 2,
    description: "提示某片陶片所在的大致区域",
    canUse(state, template) {
      if (!state.running) return { ok: false, reason: "游戏未开始" };
      if (state.tools.probe <= 0) return { ok: false, reason: "探针已用完" };
      const pieceIndices = Object.keys(template.buried).map(Number);
      const hidden = pieceIndices.filter(i => !state.dug.has(i) && !state.probeHints.has(i));
      if (hidden.length === 0) return { ok: false, reason: "没有可探测的碎片" };
      return { ok: true };
    },
    use(state, template) {
      const pieceIndices = Object.keys(template.buried).map(Number);
      const hidden = pieceIndices.filter(i => !state.dug.has(i) && !state.probeHints.has(i));
      const targetIdx = hidden[Math.floor(Math.random() * hidden.length)];
      const cols = Math.sqrt(template.gridSize || 25);
      const row = Math.floor(targetIdx / cols);
      const col = targetIdx % cols;
      const areaCells = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < cols && nc >= 0 && nc < cols) {
            const idx = nr * cols + nc;
            if (!state.dug.has(idx)) {
              areaCells.push(idx);
              state.probeHints.add(idx);
            }
          }
        }
      }
      state.tools.probe -= 1;
      state.toolsUsed.probe += 1;
      const def = template.pieceDefs.find(p => p.id === template.buried[targetIdx]);
      return {
        success: true,
        message: `探针探测：${def ? def.label : "某件"}${template.pieceName}位于第${row + 1}行第${col + 1}列附近区域，已高亮 ${areaCells.length} 格。`,
        cells: areaCells
      };
    }
  },
  brush: {
    id: "brush",
    name: "刷子",
    icon: "🖌️",
    baseCount: 3,
    cost: 1,
    description: "安全清理一格，不触发随机事件",
    canUse(state, template) {
      if (!state.running) return { ok: false, reason: "游戏未开始" };
      if (state.tools.brush <= 0) return { ok: false, reason: "刷子已用完" };
      const undug = [];
      for (let i = 0; i < (template.gridSize || 25); i++) {
        if (!state.dug.has(i) && !state.lockedCells.has(i)) undug.push(i);
      }
      if (undug.length === 0) return { ok: false, reason: "没有可清理的格子" };
      return { ok: true };
    },
    use(state, template) {
      state.activeTool = "brush";
      return {
        success: true,
        message: "刷子模式：点击一格进行安全清理，不会触发随机事件。",
        activateMode: true
      };
    }
  },
  compass: {
    id: "compass",
    name: "罗盘",
    icon: "🧭",
    baseCount: 2,
    cost: 3,
    description: "拖动陶片时显示距离正确槽位的方向",
    canUse(state, template) {
      if (!state.running) return { ok: false, reason: "游戏未开始" };
      if (state.tools.compass <= 0) return { ok: false, reason: "罗盘已用完" };
      const unlockedPieces = Array.from(state.found).filter(p => !state.locked.has(p));
      if (unlockedPieces.length === 0) return { ok: false, reason: "没有可拖动的碎片" };
      return { ok: true };
    },
    use(state, template) {
      state.activeTool = "compass";
      state.compassActive = true;
      state.tools.compass -= 1;
      state.toolsUsed.compass += 1;
      return {
        success: true,
        message: "罗盘已激活：拖动碎片时将显示指向正确位置的方向箭头。",
        activateMode: true
      };
    }
  },
  trowel: {
    id: "trowel",
    name: "小手铲",
    icon: "🔧",
    baseCount: 2,
    cost: 2,
    description: "精确挖掘一格，若为空则返还1次刷子",
    canUse(state, template) {
      if (!state.running) return { ok: false, reason: "游戏未开始" };
      if (state.tools.trowel <= 0) return { ok: false, reason: "小手铲已用完" };
      const undug = [];
      for (let i = 0; i < (template.gridSize || 25); i++) {
        if (!state.dug.has(i) && !state.lockedCells.has(i)) undug.push(i);
      }
      if (undug.length === 0) return { ok: false, reason: "没有可挖掘的格子" };
      return { ok: true };
    },
    use(state, template) {
      state.activeTool = "trowel";
      return {
        success: true,
        message: "小手铲模式：点击一格进行精确挖掘，不触发随机事件，空土返还刷子。",
        activateMode: true
      };
    }
  }
};

const RESTORATION_GOALS = {
  maxDigs: {
    id: "maxDigs",
    name: "精准挖掘",
    icon: "⛏️",
    description: (value) => `挖掘次数不超过 ${value} 次`,
    shortDescription: (value) => `挖掘≤${value}次`,
    checkValid: (value) => typeof value === "number" && value > 0,
    evaluate: (state, template, value) => state.digs <= value
  },
  noHints: {
    id: "noHints",
    name: "独立完成",
    icon: "🧠",
    description: () => "全程不使用提示功能",
    shortDescription: () => "不使用提示",
    checkValid: () => true,
    evaluate: (state) => state.hintsUsed === 0
  },
  noTools: {
    id: "noTools",
    name: "纯手工修复",
    icon: "✋",
    description: () => "不使用任何道具（探针、刷子、罗盘、小手铲）",
    shortDescription: () => "不使用道具",
    checkValid: () => true,
    evaluate: (state) =>
      state.toolsUsed.probe === 0 &&
      state.toolsUsed.brush === 0 &&
      state.toolsUsed.compass === 0 &&
      (state.toolsUsed.trowel === undefined || state.toolsUsed.trowel === 0)
  },
  timeLimit: {
    id: "timeLimit",
    name: "限时修复",
    icon: "⏱️",
    description: (value) => `在 ${value} 秒内完成修复`,
    shortDescription: (value) => `用时≤${value}秒`,
    checkValid: (value) => typeof value === "number" && value > 0,
    evaluate: (state, template, value) => (state.elapsedTime !== undefined ? state.elapsedTime : (template.timeLimit - state.timeLeft)) <= value
  },
  avoidNegativeKeyEvents: {
    id: "avoidNegativeKeyEvents",
    name: "平安作业",
    icon: "🛡️",
    description: () => "不触发任何关键负面事件",
    shortDescription: () => "无关键负面事件",
    checkValid: () => true,
    evaluate: (state) => {
      return !state.keyEvents.some((e) => e.type === "negative");
    }
  },
  noAngleMistakes: {
    id: "noAngleMistakes",
    name: "精准贴合",
    icon: "🎯",
    description: () => "修复过程中无角度判断失误",
    shortDescription: () => "零角度失误",
    checkValid: () => true,
    evaluate: (state) => state.wrongAngleAttempts === 0
  }
};

function evaluateGoals(template, state) {
  const results = {};
  const goals = template.goals || {};
  for (const goalId of Object.keys(goals)) {
    const goalDef = RESTORATION_GOALS[goalId];
    if (!goalDef) continue;
    const goalValue = goals[goalId];
    results[goalId] = {
      id: goalId,
      name: goalDef.name,
      icon: goalDef.icon,
      value: goalValue,
      achieved: goalDef.evaluate(state, template, goalValue),
      description: goalDef.description(goalValue)
    };
  }
  return results;
}

function getGoalsSummary(template) {
  const goals = template.goals || {};
  return Object.keys(goals).map((goalId) => {
    const goalDef = RESTORATION_GOALS[goalId];
    if (!goalDef) return null;
    return {
      id: goalId,
      name: goalDef.name,
      icon: goalDef.icon,
      shortDescription: goalDef.shortDescription(goals[goalId])
    };
  }).filter(Boolean);
}

const artifactTemplates = {
  bowl: {
    id: "bowl",
    name: "陶碗",
    pieceName: "陶片",
    timeLimit: 90,
    difficulty: "初级",
    snapRadius: 72,
    gridSize: 25,
    iconClass: "bowl-icon",
    target: {
      shape: "circle",
      style: {
        background: "#c28c59",
        borderColor: "#7a432d",
        borderWidth: 8,
        innerRingColor: "#d6a873",
        innerRingWidth: 12,
        innerCircleColor: "#7a432d",
        innerCircleWidth: 6,
        innerCircleInset: "28%"
      }
    },
    piece: {
      style: {
        width: 100,
        height: 100,
        background: "#cd915c",
        borderColor: "#7a432d",
        borderWidth: 4,
        borderRadius: "18px 8px 22px 10px",
        lockedBackground: "#d6a873",
        innerDecorationType: "circle",
        innerDecorationInset: "20px",
        innerDecorationBorderWidth: 4,
        innerDecorationBorderColor: "rgba(99, 54, 36, .75)",
        innerDecorationRadius: "50%"
      }
    },
    buried: {
      2: "p1",
      7: "p2",
      13: "p3",
      21: "p4"
    },
    pieceDefs: [
      { id: "p1", label: "上左", slot: { x: 10, y: 12 }, angle: 0, initialAngle: 90 },
      { id: "p2", label: "上右", slot: { x: 51, y: 12 }, angle: 90, initialAngle: 225 },
      { id: "p3", label: "下左", slot: { x: 10, y: 53 }, angle: 180, initialAngle: 315 },
      { id: "p4", label: "下右", slot: { x: 51, y: 53 }, angle: 270, initialAngle: 45 }
    ],
    toolPoints: 8,
    goals: {
      maxDigs: 12,
      timeLimit: 60,
      noHints: true
    }
  },
  tile: {
    id: "tile",
    name: "瓦当",
    pieceName: "瓦当残片",
    timeLimit: 120,
    difficulty: "中级",
    snapRadius: 60,
    gridSize: 25,
    iconClass: "tile-icon",
    target: {
      shape: "tile",
      style: {
        background: "#a08465",
        borderColor: "#4a3728",
        borderWidth: 8,
        innerRingColor: "#b89874",
        innerRingWidth: 12,
        innerCircleColor: "#4a3728",
        innerCircleWidth: 6,
        innerCircleSize: "35%"
      }
    },
    piece: {
      style: {
        width: 100,
        height: 100,
        background: "#a08465",
        borderColor: "#4a3728",
        borderWidth: 4,
        borderRadius: "12px 12px 4px 4px",
        lockedBackground: "#b89874",
        innerDecorationType: "rect",
        innerDecorationInset: "20px",
        innerDecorationBorderWidth: 4,
        innerDecorationBorderColor: "rgba(74, 55, 40, .75)",
        innerDecorationRadius: "4px"
      }
    },
    buried: {
      1: "p1",
      5: "p2",
      9: "p3",
      12: "p4",
      17: "p5",
      23: "p6"
    },
    pieceDefs: [
      { id: "p1", label: "左上", slot: { x: 5, y: 8 }, angle: 0, initialAngle: 180 },
      { id: "p2", label: "右上", slot: { x: 55, y: 8 }, angle: 90, initialAngle: 270 },
      { id: "p3", label: "左中", slot: { x: 5, y: 40 }, angle: 180, initialAngle: 0 },
      { id: "p4", label: "右中", slot: { x: 55, y: 40 }, angle: 270, initialAngle: 90 },
      { id: "p5", label: "左下", slot: { x: 5, y: 68 }, angle: 0, initialAngle: 270 },
      { id: "p6", label: "右下", slot: { x: 55, y: 68 }, angle: 90, initialAngle: 315 }
    ],
    toolPoints: 12,
    goals: {
      maxDigs: 18,
      timeLimit: 90,
      avoidNegativeKeyEvents: true,
      noAngleMistakes: true
    }
  },
  mirror: {
    id: "mirror",
    name: "青铜镜",
    pieceName: "铜镜残片",
    timeLimit: 180,
    difficulty: "高级",
    snapRadius: 50,
    gridSize: 25,
    iconClass: "mirror-icon",
    target: {
      shape: "mirror",
      style: {
        background: "#7a8b94",
        borderColor: "#2d3e45",
        borderWidth: 8,
        innerRingColor: "#95a5ae",
        innerRingWidth: 12,
        innerCircleColor: "#2d3e45",
        innerCircleWidth: 6,
        innerCircleInset: "20%",
        innerCircleFill: "#4a5b63",
        centerKnobColor: "#c49b62",
        centerKnobBorder: "#7a432d",
        centerKnobSize: "12%"
      }
    },
    piece: {
      style: {
        width: 100,
        height: 100,
        background: "#7a8b94",
        borderColor: "#2d3e45",
        borderWidth: 4,
        borderRadius: "50%",
        lockedBackground: "#95a5ae",
        innerDecorationType: "circle",
        innerDecorationInset: "22px",
        innerDecorationBorderWidth: 4,
        innerDecorationBorderColor: "rgba(45, 62, 69, .75)",
        innerDecorationRadius: "50%"
      }
    },
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
      { id: "p1", label: "顶", slot: { x: 33, y: 3 }, angle: 0, initialAngle: 135 },
      { id: "p2", label: "右上", slot: { x: 60, y: 15 }, angle: 45, initialAngle: 225 },
      { id: "p3", label: "右", slot: { x: 68, y: 38 }, angle: 90, initialAngle: 315 },
      { id: "p4", label: "右下", slot: { x: 60, y: 62 }, angle: 135, initialAngle: 0 },
      { id: "p5", label: "底", slot: { x: 33, y: 75 }, angle: 180, initialAngle: 45 },
      { id: "p6", label: "左下", slot: { x: 8, y: 62 }, angle: 225, initialAngle: 90 },
      { id: "p7", label: "左", slot: { x: 2, y: 38 }, angle: 270, initialAngle: 180 },
      { id: "p8", label: "左上", slot: { x: 8, y: 15 }, angle: 315, initialAngle: 270 },
      { id: "p9", label: "中心", slot: { x: 33, y: 38 }, angle: 0, initialAngle: 180 }
    ],
    toolPoints: 15,
    goals: {
      maxDigs: 25,
      timeLimit: 150,
      noTools: true,
      avoidNegativeKeyEvents: true
    }
  }
};

let currentTemplate = null;
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
        const recordRatingOrder = RATING_ORDER[record.rating] || 0;
        const existingRatingOrder = RATING_ORDER[existing.rating] || 0;

        const recordGoalsAchieved = record.goalsAchieved || 0;
        const existingGoalsAchieved = existing.goalsAchieved || 0;

        if (recordRatingOrder > existingRatingOrder) {
          bestByLevel[record.levelId] = record;
        } else if (recordRatingOrder === existingRatingOrder) {
          if (recordGoalsAchieved > existingGoalsAchieved) {
            bestByLevel[record.levelId] = record;
          } else if (recordGoalsAchieved === existingGoalsAchieved) {
            const recordScore = record.finalScore !== undefined ? record.finalScore : record.completeness;
            const existingScore = existing.finalScore !== undefined ? existing.finalScore : existing.completeness;
            if (recordScore > existingScore) {
              bestByLevel[record.levelId] = record;
            } else if (recordScore === existingScore && record.timeUsed < existing.timeUsed) {
              bestByLevel[record.levelId] = record;
            }
          }
        }
      }
    }

    const templateOrder = Object.keys(artifactTemplates);
    return Object.values(bestByLevel).sort((a, b) => {
      return templateOrder.indexOf(a.levelId) - templateOrder.indexOf(b.levelId);
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

  if (record.rating) {
    const ratingBadge = document.createElement("span");
    ratingBadge.className = `record-rating-badge record-rating-${record.rating}`;
    ratingBadge.textContent = record.rating;
    levelSpan.appendChild(ratingBadge);
  }

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

  if (record.hintsUsed !== undefined) {
    const hintStat = document.createElement("div");
    hintStat.className = "record-stat";
    hintStat.innerHTML = `<div class="record-stat-label">提示</div><div class="record-stat-value">${record.hintsUsed}次</div>`;
    stats.appendChild(hintStat);
  }

  if (record.wrongAngleAttempts !== undefined) {
    const angleStat = document.createElement("div");
    angleStat.className = "record-stat";
    angleStat.innerHTML = `<div class="record-stat-label">角度失误</div><div class="record-stat-value">${record.wrongAngleAttempts}次</div>`;
    stats.appendChild(angleStat);
  }

  if (record.toolsUsed !== undefined) {
    const toolStat = document.createElement("div");
    toolStat.className = "record-stat";
    const tu = record.toolsUsed;
    const totalTools = (tu.probe || 0) + (tu.brush || 0) + (tu.compass || 0) + (tu.trowel || 0);
    toolStat.innerHTML = `<div class="record-stat-label">道具使用</div><div class="record-stat-value">${totalTools}次</div>`;
    stats.appendChild(toolStat);
  }

  card.appendChild(header);
  card.appendChild(stats);

  if (record.toolPackage) {
    const tp = record.toolPackage;
    const tpList = [];
    if (tp.probe > 0) tpList.push(`📍探针×${tp.probe}`);
    if (tp.brush > 0) tpList.push(`🖌️刷子×${tp.brush}`);
    if (tp.compass > 0) tpList.push(`🧭罗盘×${tp.compass}`);
    if (tp.trowel && tp.trowel > 0) tpList.push(`🔧小手铲×${tp.trowel}`);
    if (tpList.length > 0) {
      const pkgDiv = document.createElement("div");
      pkgDiv.className = "record-toolkit";
      pkgDiv.innerHTML = `<span class="record-toolkit-label">🎒 工具包：</span>${tpList.join(" · ")}`;
      card.appendChild(pkgDiv);
    }
  }

  if (record.toolsUsed !== undefined) {
    const tu = record.toolsUsed;
    const anyUsed = (tu.probe || 0) > 0 || (tu.brush || 0) > 0 || (tu.compass || 0) > 0 || (tu.trowel || 0) > 0;
    if (anyUsed) {
      const toolsDiv = document.createElement("div");
      toolsDiv.className = "record-tools";
      const toolList = [];
      if (tu.probe > 0) toolList.push(`📍 探针×${tu.probe}`);
      if (tu.brush > 0) toolList.push(`🖌️ 刷子×${tu.brush}`);
      if (tu.compass > 0) toolList.push(`🧭 罗盘×${tu.compass}`);
      if (tu.trowel > 0) toolList.push(`🔧 小手铲×${tu.trowel}`);
      toolsDiv.innerHTML = `<span class="record-tools-label">使用道具：</span>${toolList.join(" · ")}`;
      card.appendChild(toolsDiv);
    }
  }

  if (record.keyEvents && record.keyEvents.length > 0) {
    const eventsDiv = document.createElement("div");
    eventsDiv.className = "record-events";
    const eventList = record.keyEvents.map((e) => e.name).join(" · ");
    eventsDiv.innerHTML = `<span class="record-events-label">关键事件：</span>${eventList}`;
    card.appendChild(eventsDiv);
  }

  if (record.goals && Object.keys(record.goals).length > 0) {
    const goalsDiv = document.createElement("div");
    goalsDiv.className = "record-goals";
    const goalsList = Object.values(record.goals).map(goal => {
      return `<span class="record-goal-item ${goal.achieved ? 'achieved' : 'not-achieved'}" title="${goal.description}">
        ${goal.icon} ${goal.name}${goal.achieved ? ' ✓' : ' ✗'}
      </span>`;
    }).join("");
    goalsDiv.innerHTML = `<span class="record-goals-label">🎯 修复目标 (${record.goalsAchieved || 0}/${record.goalsTotal || 0})：</span>${goalsList}`;
    card.appendChild(goalsDiv);
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

function renderLevelCards() {
  levelListEl.innerHTML = "";
  const bestRecords = archive.getBest();
  Object.values(artifactTemplates).forEach((template) => {
    const card = document.createElement("button");
    card.className = "level-card";
    card.dataset.level = template.id;

    const icon = document.createElement("div");
    icon.className = `level-icon ${template.iconClass}`;

    const best = bestRecords.find(r => r.levelId === template.id);
    if (best && best.rating) {
      const badge = document.createElement("div");
      badge.className = `level-rating level-rating-${best.rating}`;
      badge.textContent = best.rating;
      icon.appendChild(badge);
    }

    const info = document.createElement("div");
    info.className = "level-info";
    info.innerHTML = `
      <h3>${template.name}修复</h3>
      <p>${template.pieceDefs.length} 片碎片 · ${template.timeLimit} 秒 · ${template.difficulty}</p>
    `;

    card.appendChild(icon);
    card.appendChild(info);
    card.addEventListener("click", () => showLevelPreview(template.id));
    levelListEl.appendChild(card);
  });
}

function freshState() {
  const template = artifactTemplates[currentTemplate];
  let toolkit = null;
  if (selectedToolkit) {
    toolkit = selectedToolkit;
  } else if (template.toolCounts) {
    toolkit = template.toolCounts;
  } else if (template.toolPoints !== undefined) {
    toolkit = getDefaultToolkit(template);
  } else {
    toolkit = {
      probe: TOOLS.probe.baseCount,
      brush: TOOLS.brush.baseCount,
      compass: TOOLS.compass.baseCount,
      trowel: TOOLS.trowel.baseCount
    };
  }
  const toolsInit = { probe: 0, brush: 0, compass: 0, trowel: 0 };
  Object.keys(toolkit).forEach(k => { toolsInit[k] = toolkit[k] || 0; });
  const toolsUsedInit = { probe: 0, brush: 0, compass: 0, trowel: 0 };
  return {
    running: false,
    timeLeft: template.timeLimit,
    elapsedTime: 0,
    digs: 0,
    dug: new Set(),
    found: new Set(),
    locked: new Set(),
    log: [`探方已经布好，先从泥土里找${template.pieceName}。`],
    lockedCells: new Set(),
    hintedCells: new Set(),
    toolWear: 0,
    bonusScore: 0,
    triggeredEvents: [],
    keyEvents: [],
    eventCooldowns: {},
    wrongAngleAttempts: 0,
    hintsUsed: 0,
    tools: toolsInit,
    toolsUsed: toolsUsedInit,
    probeHints: new Set(),
    activeTool: null,
    compassActive: false,
    toolPackage: { ...toolsInit }
  };
}

function resetStatsDisplay(templateId) {
  if (templateId && artifactTemplates[templateId]) {
    timeLeftEl.textContent = String(artifactTemplates[templateId].timeLimit);
  } else {
    timeLeftEl.textContent = "90";
  }
  digCountEl.textContent = "0";
  progressEl.textContent = "0%";
}

function renderTarget() {
  const template = artifactTemplates[currentTemplate];
  const style = template.target.style;
  targetEl.style.background = style.background;
  targetEl.style.borderColor = style.borderColor;
  targetEl.style.borderWidth = `${style.borderWidth}px`;
  targetEl.style.borderStyle = "solid";
  targetEl.style.boxShadow = `inset 0 0 0 ${style.innerRingWidth}px ${style.innerRingColor}`;

  if (template.target.shape === "circle" || template.target.shape === "mirror") {
    targetEl.style.borderRadius = "50%";
  } else if (template.target.shape === "tile") {
    targetEl.style.borderRadius = "12px 12px 4px 4px";
  }

  targetEl.innerHTML = "";

  const innerCircle = document.createElement("div");
  innerCircle.className = "target-inner-circle";

  if (template.target.shape === "tile") {
    innerCircle.style.width = style.innerCircleSize;
    innerCircle.style.height = style.innerCircleSize;
    innerCircle.style.top = "50%";
    innerCircle.style.left = "50%";
    innerCircle.style.transform = "translate(-50%, -50%)";
  } else {
    innerCircle.style.top = style.innerCircleInset;
    innerCircle.style.right = style.innerCircleInset;
    innerCircle.style.bottom = style.innerCircleInset;
    innerCircle.style.left = style.innerCircleInset;
  }

  innerCircle.style.border = `${style.innerCircleWidth}px solid ${style.innerCircleColor}`;
  innerCircle.style.borderRadius = "50%";

  if (style.innerCircleFill) {
    innerCircle.style.background = style.innerCircleFill;
  }

  targetEl.appendChild(innerCircle);

  if (template.target.shape === "mirror" && style.centerKnobSize) {
    const centerKnob = document.createElement("div");
    centerKnob.className = "target-center-knob";
    centerKnob.style.width = style.centerKnobSize;
    centerKnob.style.height = style.centerKnobSize;
    centerKnob.style.background = style.centerKnobColor;
    centerKnob.style.border = `4px solid ${style.centerKnobBorder}`;
    centerKnob.style.borderRadius = "50%";
    centerKnob.style.position = "absolute";
    centerKnob.style.top = "50%";
    centerKnob.style.left = "50%";
    centerKnob.style.transform = "translate(-50%, -50%)";
    centerKnob.style.zIndex = "1";
    targetEl.appendChild(centerKnob);
  }

  template.pieceDefs.forEach((def) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.pieceId = def.id;
    slot.style.left = `${def.slot.x}%`;
    slot.style.top = `${def.slot.y}%`;
    slot.style.transform = `rotate(${def.angle}deg)`;
    slot.style.width = `${template.piece.style.width * 0.6}px`;
    slot.style.height = `${template.piece.style.height * 0.6}px`;
    slot.style.border = "2px dashed rgba(49, 76, 83, .35)";
    slot.style.borderRadius = template.piece.style.borderRadius;
    slot.style.position = "absolute";
    slot.style.pointerEvents = "none";
    targetEl.appendChild(slot);
  });
}

function tryTriggerEvent() {
  const template = artifactTemplates[currentTemplate];
  const events = Object.values(SITE_EVENTS);
  const availableEvents = events.filter((evt) => {
    const cooldown = state.eventCooldowns[evt.id] || 0;
    return cooldown <= 0;
  });

  for (const evt of availableEvents) {
    if (Math.random() < evt.probability) {
      const result = evt.apply(state, template);
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
          showEventNotif(evt, result.message);
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

function calculateExpertScore(template) {
  const pieceCount = template.pieceDefs.length;
  const timeRatio = state.timeLeft / template.timeLimit;
  const timeScore = Math.round(Math.min(100, timeRatio * 200));
  const digScore = Math.round(Math.max(0, 100 - Math.max(0, state.digs - pieceCount) * 10));
  const angleScore = Math.round(Math.max(0, 100 - state.wrongAngleAttempts * 15));
  const negativeCount = state.triggeredEvents.filter(e => e.type === "negative").length;
  const positiveCount = state.triggeredEvents.filter(e => e.type === "positive").length;
  const eventScore = Math.round(Math.max(0, Math.min(100, 60 - negativeCount * 12 + positiveCount * 8)));
  const hintScore = state.hintsUsed === 0 ? 100 : Math.round(Math.max(0, 100 - state.hintsUsed * 30));
  const toolPenalty = (state.toolsUsed.probe * 15) + (state.toolsUsed.brush * 10) + (state.toolsUsed.compass * 20) + ((state.toolsUsed.trowel || 0) * 12);
  const toolScore = Math.round(Math.max(0, 100 - toolPenalty));
  const totalScore = Math.round((timeScore + digScore + angleScore + eventScore + hintScore + toolScore) / 6);
  return { timeScore, digScore, angleScore, eventScore, hintScore, toolScore, totalScore };
}

function getRating(score) {
  if (score >= 90) return "S";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 45) return "C";
  return "D";
}

function getCommentary(rating, scores) {
  if (rating === "S") {
    if (scores.hintScore === 100 && scores.angleScore === 100) return "完美发掘！零提示、零失误，考古界泰斗级的现场操作。";
    if (scores.hintScore === 100) return "教科书般的修复流程，全程独立判断，堪称楷模。";
    if (scores.timeScore >= 95) return "电光火石间完成修复，操作之快令人叹为观止！";
    return "极高水准的修复工作，专业素养令人赞叹。";
  }
  if (rating === "A") {
    if (scores.angleScore === 100) return "手法精准，角度判断无一失误，值得称道。";
    if (scores.timeScore >= 80) return "节奏把控出色，效率与品质兼备。";
    if (scores.digScore >= 90) return "挖掘几乎没有多余动作，对地层判断相当准确。";
    return "专业素养可见，继续保持可臻化境。";
  }
  if (rating === "B") {
    if (scores.digScore < 60) return "挖掘还需更谨慎，减少无效操作可大幅提分。";
    if (scores.timeScore < 50) return "时间管理有待加强，注意把控作业节奏。";
    if (scores.eventScore < 60) return "应对现场突发事件还需积累更多经验。";
    return "中规中矩的修复，基本功扎实但仍有提升空间。";
  }
  if (rating === "C") {
    if (scores.hintScore < 60) return "过度依赖提示，独立判断能力还需锻炼。";
    if (scores.angleScore < 50) return "角度判断失误较多，修复前多观察可减少偏差。";
    if (scores.timeScore < 30) return "用时过长，下次可以尝试更高效的发掘策略。";
    return "勉强完成任务，基本功仍需打磨。";
  }
  if (scores.hintScore < 40) return "全程依赖提示完成，建议重新学习操作要领。";
  if (scores.angleScore < 30) return "碎片角度频繁出错，建议先多观察再动手。";
  return "修复过程波折较多，需要更多练习来积累经验。";
}

function getScoreColor(score) {
  if (score >= 90) return "#ffd700";
  if (score >= 75) return "#698980";
  if (score >= 60) return "#7ba4d4";
  if (score >= 45) return "#d4a067";
  return "#d46767";
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
      text: "在探方网格中逐格点击进行挖掘，有的格子藏着碎片，有的只有泥土。继续挖掘，直到发现第一片碎片吧！",
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

    if (!currentTemplate) {
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
  renderLevelCards();
  startBtn.addEventListener("click", start);
  restartBtn.addEventListener("click", reset);
  hintBtn.addEventListener("click", useHint);
  backBtn.addEventListener("click", goBack);
  closePreviewBtn.addEventListener("click", hideLevelPreview);
  previewStartBtn.addEventListener("click", startFromPreview);
  archiveBtn.addEventListener("click", openArchive);
  closeArchiveBtn.addEventListener("click", closeArchive);
  clearArchiveBtn.addEventListener("click", openConfirmModal);
  cancelClearBtn.addEventListener("click", closeConfirmModal);
  confirmClearBtn.addEventListener("click", clearArchive);

  const settingsModal = document.getElementById("settingsModal");
  const settingsBtn = document.getElementById("settingsBtn");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  settingsBtn.addEventListener("click", () => {
    gameSettings.syncUI();
    settingsModal.classList.remove("hidden");
  });
  closeSettingsBtn.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
  });
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) settingsModal.classList.add("hidden");
  });
  document.getElementById("settingEventAnim").addEventListener("change", (e) => {
    gameSettings.set("eventAnim", e.target.checked);
  });
  document.getElementById("settingVibration").addEventListener("change", (e) => {
    gameSettings.set("vibration", e.target.checked);
  });
  document.getElementById("settingAutoTutorial").addEventListener("change", (e) => {
    gameSettings.set("autoTutorial", e.target.checked);
  });

  probeBtn.addEventListener("click", () => useTool("probe"));
  brushBtn.addEventListener("click", () => useTool("brush"));
  compassBtn.addEventListener("click", () => useTool("compass"));
  trowelBtn.addEventListener("click", () => useTool("trowel"));

  document.addEventListener("keydown", (e) => {
    if (!state || !state.running) return;
    if (e.key === "1") useTool("probe");
    if (e.key === "2") useTool("brush");
    if (e.key === "3") useTool("compass");
    if (e.key === "4") useTool("trowel");
    if (e.key === "Escape") cancelToolMode();
  });

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

  document.querySelectorAll(".mobile-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchMobileTab(btn.dataset.tab);
    });
  });

  focusBtn.addEventListener("click", toggleFocusMode);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".piece") && !e.target.closest(".piece-rotate-handle")) {
      deselectPiece();
    }
  });

  document.addEventListener("touchstart", (e) => {
    if (!e.target.closest(".piece") && !e.target.closest(".piece-rotate-handle")) {
      deselectPiece();
    }
  }, { passive: true });

  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      updateIsMobile();
    }, 150);
  });

  window.addEventListener("orientationchange", handleOrientationChange);

  updateIsMobile();

  gameSettings.syncUI();

  resetStatsDisplay();
  levelSelectEl.classList.remove("hidden");
  gameAreaEl.classList.add("hidden");
  resultEl.classList.add("hidden");
  backBtn.classList.add("hidden");
}

function selectLevel(templateId, skipAutoTutorial = false) {
  currentTemplate = templateId;
  currentMobileTab = "dig";
  const template = artifactTemplates[templateId];
  levelNameEl.textContent = template.name;
  const description = (template.description || "").trim();
  levelDescriptionEl.textContent = description;
  levelDescriptionEl.classList.toggle("hidden", description.length === 0);
  targetEl.className = "target";
  renderTarget();
  levelSelectEl.classList.add("hidden");
  gameAreaEl.classList.remove("hidden");
  backBtn.classList.remove("hidden");
  if (isMobile) {
    switchMobileTab(currentMobileTab);
  }
  state = freshState();
  piecesEl.innerHTML = "";
  resultEl.classList.add("hidden");
  resetStatsDisplay(templateId);
  render();

  if (!skipAutoTutorial && gameSettings.get("autoTutorial") && !tutorial.isDone() && !tutorial.active) {
    setTimeout(() => tutorial.start(), 400);
  }
}

function getDefaultToolkit(template) {
  if (template.toolCounts) {
    return { ...template.toolCounts };
  }
  const points = template.toolPoints || 10;
  let remaining = points;
  const toolkit = {};
  const toolOrder = ["brush", "probe", "trowel", "compass"];
  toolOrder.forEach(id => {
    const tool = TOOLS[id];
    const max = Math.floor(remaining / tool.cost);
    const cnt = Math.min(tool.baseCount, max);
    toolkit[id] = cnt;
    remaining -= cnt * tool.cost;
  });
  toolkit.brush = (toolkit.brush || 0) + Math.floor(remaining / TOOLS.brush.cost);
  return toolkit;
}

function calcToolkitCost(toolkit) {
  let total = 0;
  Object.keys(toolkit).forEach(id => {
    const tool = TOOLS[id];
    if (tool) total += (toolkit[id] || 0) * tool.cost;
  });
  return total;
}

function toolkitIsValid(toolkit, template) {
  if (!template) return false;
  const cost = calcToolkitCost(toolkit);
  const maxPoints = template.toolPoints || 0;
  return cost <= maxPoints;
}

function renderToolkitSelector(template, isLocked, isPractice) {
  previewToolsEl.innerHTML = "";
  const toolPoints = template.toolPoints || 0;
  let toolkit;
  if (template.toolCounts && (template.isDailyChallenge && !isPractice)) {
    toolkit = { ...template.toolCounts };
  } else {
    toolkit = currentPreviewToolkit || getDefaultToolkit(template);
  }
  currentPreviewToolkit = toolkit;

  const cost = calcToolkitCost(toolkit);
  const header = document.createElement("div");
  header.className = "toolkit-header";

  const leftInfo = document.createElement("div");
  leftInfo.className = "toolkit-header-info";
  leftInfo.innerHTML = `<span class="toolkit-points-label">工具点数：</span>
    <span class="toolkit-points-value ${cost > toolPoints && !isPractice ? 'over' : ''}">${cost}</span>
    <span class="toolkit-points-sep">/</span>
    <span class="toolkit-points-max">${toolPoints}</span>`;

  const rightInfo = document.createElement("div");
  rightInfo.className = "toolkit-header-status";
  if (isLocked) {
    rightInfo.innerHTML = `<span class="toolkit-lock-badge">🔒 固定配置</span>`;
  } else if (isPractice) {
    rightInfo.innerHTML = `<span class="toolkit-practice-badge">📝 练习模式</span>`;
  }
  header.appendChild(leftInfo);
  header.appendChild(rightInfo);
  previewToolsEl.appendChild(header);

  const toolList = document.createElement("div");
  toolList.className = "toolkit-list";

  Object.keys(TOOLS).forEach(toolId => {
    const tool = TOOLS[toolId];
    const count = toolkit[toolId] || 0;
    const item = document.createElement("div");
    item.className = "toolkit-item";

    const canInc = !isLocked && (isPractice || (cost + tool.cost) <= toolPoints);
    const canDec = !isLocked && count > 0;

    item.innerHTML = `
      <div class="toolkit-item-main">
        <span class="toolkit-item-icon">${tool.icon}</span>
        <div class="toolkit-item-info">
          <div class="toolkit-item-name">
            <span>${tool.name}</span>
            <span class="toolkit-item-cost" title="每次消耗点数">${tool.cost}点/个</span>
          </div>
          <div class="toolkit-item-desc">${tool.description}</div>
        </div>
      </div>
      <div class="toolkit-item-controls">
        <button type="button" class="toolkit-btn minus" data-tool="${toolId}" ${canDec ? '' : 'disabled'}>−</button>
        <span class="toolkit-item-count">${count}</span>
        <button type="button" class="toolkit-btn plus" data-tool="${toolId}" ${canInc ? '' : 'disabled'}>+</button>
      </div>
    `;
    toolList.appendChild(item);
  });
  previewToolsEl.appendChild(toolList);

  const resetRow = document.createElement("div");
  resetRow.className = "toolkit-actions-row";
  resetRow.innerHTML = `
    <button type="button" class="toolkit-reset-btn" ${isLocked ? 'disabled' : ''}>↺ 恢复默认</button>
    <button type="button" class="toolkit-clear-btn" ${isLocked ? 'disabled' : ''}>✕ 清空全部</button>
  `;
  previewToolsEl.appendChild(resetRow);

  previewToolsEl.querySelectorAll(".toolkit-btn.plus").forEach(btn => {
    btn.addEventListener("click", () => {
      const tid = btn.dataset.tool;
      const tk = currentPreviewToolkit || getDefaultToolkit(template);
      tk[tid] = (tk[tid] || 0) + 1;
      currentPreviewToolkit = tk;
      renderToolkitSelector(template, isLocked, isPractice);
    });
  });
  previewToolsEl.querySelectorAll(".toolkit-btn.minus").forEach(btn => {
    btn.addEventListener("click", () => {
      const tid = btn.dataset.tool;
      const tk = currentPreviewToolkit || getDefaultToolkit(template);
      if ((tk[tid] || 0) > 0) {
        tk[tid] = tk[tid] - 1;
        currentPreviewToolkit = tk;
        renderToolkitSelector(template, isLocked, isPractice);
      }
    });
  });
  const resetBtn = previewToolsEl.querySelector(".toolkit-reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      currentPreviewToolkit = getDefaultToolkit(template);
      renderToolkitSelector(template, isLocked, isPractice);
    });
  }
  const clearBtn = previewToolsEl.querySelector(".toolkit-clear-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      currentPreviewToolkit = { probe: 0, brush: 0, compass: 0, trowel: 0 };
      renderToolkitSelector(template, isLocked, isPractice);
    });
  }
}

function showLevelPreview(templateId, isDaily = false, isPractice = false) {
  const template = artifactTemplates[templateId];
  if (!template) return;

  currentPreviewTemplateId = templateId;
  currentPreviewIsDaily = isDaily;
  currentPreviewDailyPractice = isPractice;
  currentPreviewToolkit = null;

  previewIconEl.className = `preview-icon level-icon ${template.iconClass || "custom-icon"}`;

  const bestRecords = archive.getBest();
  const best = bestRecords.find(r => r.levelId === templateId);

  previewNameEl.textContent = `${template.name}修复`;
  previewDifficultyEl.textContent = template.difficulty || "自定义";
  previewDescriptionEl.textContent = template.description || "探索古老文物的奥秘，将散落的碎片逐一拼合，重现历史的光辉。";

  previewPieceCountEl.textContent = `${template.pieceDefs.length} 片`;
  previewTimeLimitEl.textContent = `${template.timeLimit} 秒`;

  if (best) {
    const score = best.finalScore !== undefined ? best.finalScore : best.completeness;
    previewBestScoreEl.textContent = `${best.rating || "-"}级 · ${score}分`;
  } else {
    previewBestScoreEl.textContent = "暂无记录";
  }

  const isLocked = isDaily && !isPractice;
  renderToolkitSelector(template, isLocked, isPractice);

  const previewGoalsSection = document.getElementById("previewGoalsSection");
  const previewGoalsEl = document.getElementById("previewGoals");
  previewGoalsEl.innerHTML = "";
  const goalsSummary = getGoalsSummary(template);
  if (goalsSummary.length > 0) {
    previewGoalsSection.classList.remove("hidden");
    goalsSummary.forEach(goal => {
      const goalEl = document.createElement("div");
      goalEl.className = "preview-goal";
      goalEl.innerHTML = `
        <span class="preview-goal-icon">${goal.icon}</span>
        <div class="preview-goal-info">
          <span class="preview-goal-name">${goal.name}</span>
          <span class="preview-goal-desc">${goal.shortDescription}</span>
        </div>
      `;
      previewGoalsEl.appendChild(goalEl);
    });
  } else {
    previewGoalsSection.classList.add("hidden");
  }

  const toggleModeBtn = document.getElementById("previewToggleModeBtn");
  if (toggleModeBtn) {
    if (isDaily) {
      toggleModeBtn.classList.remove("hidden");
      toggleModeBtn.textContent = isPractice
        ? "🎯 切换为正式挑战（🔒固定工具包）"
        : "📝 切换为练习模式（自由配置工具包）";
      toggleModeBtn.onclick = () => {
        showLevelPreview(templateId, isDaily, !isPractice);
      };
    } else {
      toggleModeBtn.classList.add("hidden");
      toggleModeBtn.onclick = null;
    }
  }

  if (isDaily) {
    previewStartBtn.textContent = isPractice ? "🔄 开始练习" : "🎮 开始挑战";
  } else {
    previewStartBtn.textContent = "🎮 开始修复";
  }

  levelPreviewEl.classList.remove("hidden");
  levelPreviewEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideLevelPreview() {
  levelPreviewEl.classList.add("hidden");
  currentPreviewTemplateId = null;
  currentPreviewIsDaily = false;
  currentPreviewDailyPractice = false;
  currentPreviewToolkit = null;
}

function startFromPreview() {
  if (!currentPreviewTemplateId) return;
  selectedToolkit = currentPreviewToolkit ? { ...currentPreviewToolkit } : null;

  if (currentPreviewIsDaily) {
    startDailyChallenge(currentPreviewDailyPractice, currentPreviewTemplateId);
  } else {
    selectLevel(currentPreviewTemplateId);
  }

  hideLevelPreview();
}

function goBack() {
  clearInterval(timer);
  if (tutorial.active) tutorial.skip();
  currentTemplate = null;
  currentMobileTab = "dig";
  switchMobileTab(currentMobileTab);
  levelSelectEl.classList.remove("hidden");
  gameAreaEl.classList.add("hidden");
  resultEl.classList.add("hidden");
  backBtn.classList.add("hidden");
  levelDescriptionEl.textContent = "";
  levelDescriptionEl.classList.add("hidden");
  piecesEl.innerHTML = "";
  resetStatsDisplay();
  hideLevelPreview();
}

function start() {
  if (state.running) return;
  state.running = true;
  resultEl.classList.add("hidden");
  const template = artifactTemplates[currentTemplate];
  addLog(`计时开始，${template.name}进入抢救性发掘。`);
  timer = setInterval(() => {
    state.timeLeft -= 1;
    state.elapsedTime += 1;
    if (state.timeLeft <= 0) {
      finish(false, `时间到了，${template.name}没能完整修复。`);
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
  compassIndicator.classList.add("hidden");
  resetStatsDisplay(currentTemplate);
  render();
}

function dig(index) {
  if (!state.running || state.dug.has(index) || state.lockedCells.has(index)) return;

  if (state.activeTool === "brush") {
    brushDig(index);
    return;
  }
  if (state.activeTool === "trowel") {
    trowelDig(index);
    return;
  }

  const template = artifactTemplates[currentTemplate];
  state.dug.add(index);
  state.digs += 1;
  if (template.buried[index]) {
    const id = template.buried[index];
    state.found.add(id);
    addLog(`挖到了${template.pieceDefs.find((p) => p.id === id).label}${template.pieceName}。`);
    spawnPiece(id);
    triggerVibration([20, 40, 20]);
    tutorial.notifyAction("dig");
  } else {
    addLog("这一格只有松土和碎砂。");
  }
  tryTriggerEvent();
  render();
}

function updateCompass(piece, clientX, clientY) {
  if (!state.compassActive || !state.running) return;

  const template = artifactTemplates[currentTemplate];
  const id = piece.dataset.id;
  const def = template.pieceDefs.find((item) => item.id === id);
  if (!def) return;

  const pieceRect = piece.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const centerX = pieceRect.left + pieceRect.width / 2;
  const centerY = pieceRect.top + pieceRect.height / 2;
  const targetX = targetRect.left + targetRect.width * (def.slot.x + 18) / 100;
  const targetY = targetRect.top + targetRect.height * (def.slot.y + 18) / 100;

  const dx = targetX - centerX;
  const dy = targetY - centerY;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;

  compassIndicator.classList.remove("hidden");
  compassIndicator.style.left = `${clientX}px`;
  compassIndicator.style.top = `${clientY - 40}px`;
  compassArrow.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;

  let distanceText = "";
  const snapRadius = template.snapRadius;
  if (distance < snapRadius) {
    distanceText = "很近！";
  } else if (distance < snapRadius * 2) {
    distanceText = "较近";
  } else if (distance < snapRadius * 4) {
    distanceText = "中等";
  } else {
    distanceText = "较远";
  }
  compassDistance.textContent = `${Math.round(distance)}px · ${distanceText}`;
}

function hideCompass() {
  compassIndicator.classList.add("hidden");
}

function useHint() {
  if (!state.running) return;
  const template = artifactTemplates[currentTemplate];
  const pieceIndices = Object.keys(template.buried).map(Number);
  const hidden = pieceIndices.filter(i => !state.dug.has(i) && !state.hintedCells.has(i));
  if (hidden.length === 0) {
    addLog("没有可提示的碎片了。");
    return;
  }
  const targetIdx = hidden[Math.floor(Math.random() * hidden.length)];
  state.hintedCells.add(targetIdx);
  state.hintsUsed += 1;
  const def = template.pieceDefs.find(p => p.id === template.buried[targetIdx]);
  addLog(`提示：${def ? def.label : "某件"}${template.pieceName}的位置已标记。`);
  render();
}

function useTool(toolId) {
  if (!state.running) return;
  const template = artifactTemplates[currentTemplate];
  const tool = TOOLS[toolId];

  if (state.activeTool === toolId) {
    cancelToolMode();
    return;
  }

  const check = tool.canUse(state, template);
  if (!check.ok) {
    addLog(`无法使用${tool.name}：${check.reason}`);
    render();
    return;
  }

  if (state.activeTool && state.activeTool !== toolId) {
    cancelToolMode(false);
  }

  const result = tool.use(state, template);
  if (result.success) {
    addLog(result.message);
    if (result.activateMode) {
      renderTools();
      renderGrid();
      renderLog();
      return;
    }
  }
  render();
}

function cancelToolMode(renderLog = true) {
  if (state.activeTool === "brush" && state.tools.brush > 0) {
    state.activeTool = null;
    if (renderLog) addLog("已取消刷子模式。");
  } else if (state.activeTool === "compass") {
    state.activeTool = null;
    state.compassActive = false;
    compassIndicator.classList.add("hidden");
    if (renderLog) addLog("已关闭罗盘。");
  } else if (state.activeTool === "trowel" && state.tools.trowel > 0) {
    state.activeTool = null;
    if (renderLog) addLog("已取消小手铲模式。");
  } else {
    state.activeTool = null;
  }
  renderTools();
  renderGrid();
}

function brushDig(index) {
  if (!state.running || state.dug.has(index) || state.lockedCells.has(index)) return;
  const template = artifactTemplates[currentTemplate];

  state.dug.add(index);
  state.tools.brush -= 1;
  state.toolsUsed.brush += 1;
  state.activeTool = null;

  if (template.buried[index]) {
    const id = template.buried[index];
    state.found.add(id);
    addLog(`[刷子] 安全清理出${template.pieceDefs.find((p) => p.id === id).label}${template.pieceName}。`);
    spawnPiece(id);
    tutorial.notifyAction("dig");
  } else {
    addLog("[刷子] 安全清理，这一格只有松土和碎砂。");
  }

  render();
}

function trowelDig(index) {
  if (!state.running || state.dug.has(index) || state.lockedCells.has(index)) return;
  const template = artifactTemplates[currentTemplate];

  state.dug.add(index);
  state.tools.trowel -= 1;
  state.toolsUsed.trowel += 1;
  state.activeTool = null;

  if (template.buried[index]) {
    const id = template.buried[index];
    state.found.add(id);
    addLog(`[小手铲] 精确挖掘出${template.pieceDefs.find((p) => p.id === id).label}${template.pieceName}！`);
    spawnPiece(id);
    tutorial.notifyAction("dig");
  } else {
    addLog("[小手铲] 精确挖掘落空，这一格只有松土，返还1次刷子。");
    state.tools.brush = (state.tools.brush || 0) + 1;
  }

  render();
}

function spawnPiece(id) {
  if (document.querySelector(`[data-id="${id}"]`)) return;
  const template = artifactTemplates[currentTemplate];
  const def = template.pieceDefs.find((piece) => piece.id === id);
  const style = template.piece.style;
  const piece = document.createElement("div");
  piece.className = "piece";
  piece.dataset.id = id;
  piece.dataset.angle = String(def.initialAngle);
  piece.style.width = `${style.width}px`;
  piece.style.height = `${style.height}px`;
  piece.style.background = style.background;
  piece.style.borderColor = style.borderColor;
  piece.style.borderWidth = `${style.borderWidth}px`;
  piece.style.borderStyle = "solid";
  piece.style.borderRadius = style.borderRadius;
  piece.style.setProperty("--piece-locked-bg", style.lockedBackground);

  const piecesRect = piecesEl.getBoundingClientRect();
  const foundCount = state.found.size - 1;

  if (isMobile) {
    const pieceSize = window.innerWidth <= 480 ? 60 : 70;
    const cols = 3;
    const col = foundCount % cols;
    const row = Math.floor(foundCount / cols);
    piece.style.left = `${10 + col * (pieceSize + 12)}px`;
    piece.style.top = `${10 + row * (pieceSize + 12)}px`;
  } else {
    piece.style.left = `${22 + foundCount * 16}px`;
    piece.style.top = `${26 + foundCount * 48}px`;
  }

  const innerDeco = document.createElement("div");
  innerDeco.className = "piece-inner-deco";
  innerDeco.style.position = "absolute";
  innerDeco.style.inset = style.innerDecorationInset;
  innerDeco.style.border = `${style.innerDecorationBorderWidth}px solid ${style.innerDecorationBorderColor}`;
  innerDeco.style.borderRadius = style.innerDecorationRadius;
  innerDeco.style.pointerEvents = "none";
  innerDeco.style.zIndex = "0";
  piece.insertBefore(innerDeco, piece.firstChild);

  const rotateHandle = document.createElement("div");
  rotateHandle.className = "piece-rotate-handle";
  rotateHandle.textContent = "↻";
  rotateHandle.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    rotatePiece(piece);
  });
  rotateHandle.addEventListener("touchstart", (e) => {
    e.stopPropagation();
    e.preventDefault();
    rotatePiece(piece);
  }, { passive: false });
  piece.appendChild(rotateHandle);

  const labelSpan = document.createElement("span");
  labelSpan.className = "piece-label";
  labelSpan.textContent = def.label;
  labelSpan.style.position = "relative";
  labelSpan.style.zIndex = "1";
  piece.appendChild(labelSpan);

  applyRotation(piece);
  piece.addEventListener("pointerdown", startDrag);
  piece.addEventListener("touchstart", handleTouchStart, { passive: false });
  piece.addEventListener("dblclick", () => rotatePiece(piece));
  piecesEl.appendChild(piece);
  pieceInitialPositions.set(id, {
    left: piece.style.left,
    top: piece.style.top
  });

  if (isMobile && state.found.size === 1) {
    pulseMobileTab("repair");
  }
}

function pulseMobileTab(tabName) {
  const btn = document.querySelector(`.mobile-tab-btn[data-tab="${tabName}"]`);
  if (!btn) return;
  btn.style.animation = "none";
  btn.offsetHeight;
  btn.style.animation = "tabPulse 1.5s ease-in-out 3";
  setTimeout(() => {
    btn.style.animation = "";
  }, 4500);
}

function startDrag(event) {
  const piece = event.currentTarget;
  if (piece.classList.contains("locked")) return;
  piece.setPointerCapture(event.pointerId);
  selectPiece(piece);

  const isTouch = event.pointerType === "touch";
  const rect = piecesEl.getBoundingClientRect();
  const pieceWidth = piece.offsetWidth;
  const pieceHeight = piece.offsetHeight;

  let offsetX, offsetY;
  if (isTouch) {
    offsetX = pieceWidth / 2;
    offsetY = pieceHeight / 2 + touchDragOffsetY;
  } else {
    offsetX = event.clientX - piece.offsetLeft;
    offsetY = event.clientY - piece.offsetTop;
  }

  dragging = {
    piece,
    offsetX,
    offsetY,
    isTouch
  };

  piece.classList.add("dragging");
  piece.addEventListener("pointermove", dragMove);
  piece.addEventListener("pointerup", endDrag, { once: true });
  piece.addEventListener("pointercancel", endDrag, { once: true });
  preventPageScroll(true);
  triggerVibration(15);
}

function dragMove(event) {
  if (!dragging) return;
  const rect = piecesEl.getBoundingClientRect();
  const piece = dragging.piece;
  const pieceWidth = piece.offsetWidth;
  const pieceHeight = piece.offsetHeight;

  let newLeft = event.clientX - rect.left - dragging.offsetX;
  let newTop = event.clientY - rect.top - dragging.offsetY;

  const maxLeft = rect.width - pieceWidth;
  const maxTop = rect.height - pieceHeight;
  newLeft = Math.max(0, Math.min(newLeft, maxLeft));
  newTop = Math.max(0, Math.min(newTop, maxTop));

  piece.style.left = `${newLeft}px`;
  piece.style.top = `${newTop}px`;

  updateSnapFeedback(piece);
  updateCompass(piece, event.clientX, event.clientY);
}

function endDrag(event) {
  const piece = event.currentTarget;
  piece.removeEventListener("pointermove", dragMove);
  piece.removeEventListener("pointercancel", endDrag);
  piece.classList.remove("dragging");
  dragging = null;
  hideCompass();
  clearSnapFeedback();
  preventPageScroll(false);
  tutorial.notifyAction("drag");
  trySnap(piece);
}

function preventPageScroll(prevent) {
  if (prevent) {
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
  } else {
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  }
}

function rotatePiece(piece) {
  if (!state.running || piece.classList.contains("locked")) return;
  piece.dataset.angle = String((Number(piece.dataset.angle) + 45) % 360);
  applyRotation(piece);
  tutorial.notifyAction("rotate");
  if (dragging && dragging.piece === piece) {
    updateSnapFeedback(piece);
  }
}

function selectPiece(piece) {
  if (selectedPiece && selectedPiece !== piece) {
    selectedPiece.classList.remove("selected");
  }
  selectedPiece = piece;
  piece.classList.add("selected");
}

function deselectPiece() {
  if (selectedPiece) {
    selectedPiece.classList.remove("selected");
    selectedPiece = null;
  }
}

function updateSnapFeedback(piece) {
  const template = artifactTemplates[currentTemplate];
  const id = piece.dataset.id;
  const def = template.pieceDefs.find((item) => item.id === id);
  if (!def) return;

  const pieceRect = piece.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const centerX = pieceRect.left + pieceRect.width / 2;
  const centerY = pieceRect.top + pieceRect.height / 2;
  const targetX = targetRect.left + targetRect.width * (def.slot.x + 18) / 100;
  const targetY = targetRect.top + targetRect.height * (def.slot.y + 18) / 100;
  const distance = Math.hypot(centerX - targetX, centerY - targetY);
  const snapRadius = template.snapRadius;

  const slot = targetEl.querySelector(`.slot[data-piece-id="${id}"]`);

  if (distance < snapRadius * 1.5) {
    piece.classList.add("near-slot");
    if (slot) slot.classList.add("highlight");
  } else {
    piece.classList.remove("near-slot");
    if (slot) slot.classList.remove("highlight");
  }
}

function clearSnapFeedback() {
  document.querySelectorAll(".piece.near-slot").forEach((p) => {
    p.classList.remove("near-slot");
  });
  document.querySelectorAll(".slot.highlight").forEach((s) => {
    s.classList.remove("highlight");
  });
}

function handleTouchStart(event) {
  const piece = event.currentTarget;
  if (piece.classList.contains("locked")) return;

  if (event.touches.length === 1) {
    const now = Date.now();
    if (now - lastTapTime < doubleTapDelay) {
      event.preventDefault();
      rotatePiece(piece);
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;
  }

  if (event.touches.length === 2) {
    event.preventDefault();
    startTwoFingerRotate(event, piece);
  }
}

function startTwoFingerRotate(event, piece) {
  if (piece.classList.contains("locked")) return;

  const touch1 = event.touches[0];
  const touch2 = event.touches[1];

  const dx = touch2.clientX - touch1.clientX;
  const dy = touch2.clientY - touch1.clientY;
  gestureState.initialDistance = Math.hypot(dx, dy);
  gestureState.initialAngle = Math.atan2(dy, dx) * 180 / Math.PI;
  gestureState.pieceAngle = Number(piece.dataset.angle) || 0;
  gestureState.active = true;
  gestureState.piece = piece;

  document.addEventListener("touchmove", handleTwoFingerMove, { passive: false });
  document.addEventListener("touchend", handleTwoFingerEnd, { once: true });
  selectPiece(piece);
  preventPageScroll(true);
}

function handleTwoFingerMove(event) {
  if (!gestureState.active || !gestureState.piece) return;
  if (event.touches.length < 2) return;

  event.preventDefault();

  const touch1 = event.touches[0];
  const touch2 = event.touches[1];

  const dx = touch2.clientX - touch1.clientX;
  const dy = touch2.clientY - touch1.clientY;
  const currentAngle = Math.atan2(dy, dx) * 180 / Math.PI;

  let angleDiff = currentAngle - gestureState.initialAngle;
  let newAngle = gestureState.pieceAngle + angleDiff;

  newAngle = ((newAngle % 360) + 360) % 360;

  const piece = gestureState.piece;
  piece.dataset.angle = String(Math.round(newAngle / 45) * 45);
  applyRotation(piece);
}

function handleTwoFingerEnd() {
  if (gestureState.active && gestureState.piece) {
    updateSnapFeedback(gestureState.piece);
  }
  gestureState.active = false;
  gestureState.piece = null;
  document.removeEventListener("touchmove", handleTwoFingerMove);
  preventPageScroll(false);
}

function switchMobileTab(tabName) {
  currentMobileTab = tabName;

  document.querySelectorAll(".mobile-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  digSiteSection.classList.toggle("mobile-hidden", tabName !== "dig");
  labSection.classList.toggle("mobile-hidden", tabName !== "repair");
  notesSection.classList.toggle("mobile-hidden", tabName !== "notes");
}

function toggleFocusMode() {
  labSection.classList.toggle("focus-mode");
  focusBtn.classList.toggle("active");
  focusBtn.textContent = labSection.classList.contains("focus-mode") ? "✕ 退出" : "⛶ 全屏";
}

function updateIsMobile() {
  const wasMobile = isMobile;
  isMobile = window.innerWidth <= 768;

  if (wasMobile !== isMobile) {
    if (isMobile) {
      switchMobileTab(currentMobileTab);
    } else {
      digSiteSection.classList.remove("mobile-hidden");
      labSection.classList.remove("mobile-hidden");
      notesSection.classList.remove("mobile-hidden");
      labSection.classList.remove("focus-mode");
      focusBtn.classList.remove("active");
      focusBtn.textContent = "⛶ 全屏";
    }
  }

  if (isMobile) {
    repositionPiecesForMobile();
  }
}

function repositionPiecesForMobile() {
  const pieces = document.querySelectorAll(".piece:not(.locked)");
  const rect = piecesEl.getBoundingClientRect();

  pieces.forEach((piece, index) => {
    const id = piece.dataset.id;
    if (pieceInitialPositions.has(id)) {
      const pieceWidth = piece.offsetWidth || 70;
      const pieceHeight = piece.offsetHeight || 70;
      const col = index % 3;
      const row = Math.floor(index / 3);
      piece.style.left = `${10 + col * (pieceWidth + 12)}px`;
      piece.style.top = `${10 + row * (pieceHeight + 12)}px`;
    }
  });
}

function handleOrientationChange() {
  setTimeout(() => {
    updateIsMobile();
    clearSnapFeedback();

    if (selectedPiece && !selectedPiece.classList.contains("locked")) {
      const rect = piecesEl.getBoundingClientRect();
      const pieceRect = selectedPiece.getBoundingClientRect();
      const pieceWidth = selectedPiece.offsetWidth;
      const pieceHeight = selectedPiece.offsetHeight;

      let left = parseFloat(selectedPiece.style.left);
      let top = parseFloat(selectedPiece.style.top);

      const maxLeft = rect.width - pieceWidth;
      const maxTop = rect.height - pieceHeight;
      left = Math.max(0, Math.min(left, maxLeft));
      top = Math.max(0, Math.min(top, maxTop));

      selectedPiece.style.left = `${left}px`;
      selectedPiece.style.top = `${top}px`;
    }
  }, 100);
}

function applyRotation(piece) {
  piece.style.transform = `rotate(${piece.dataset.angle}deg)`;
}

function trySnap(piece) {
  const template = artifactTemplates[currentTemplate];
  const id = piece.dataset.id;
  const def = template.pieceDefs.find((item) => item.id === id);
  const pieceRect = piece.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const centerX = pieceRect.left + pieceRect.width / 2;
  const centerY = pieceRect.top + pieceRect.height / 2;
  const targetX = targetRect.left + targetRect.width * (def.slot.x + 18) / 100;
  const targetY = targetRect.top + targetRect.height * (def.slot.y + 18) / 100;
  const distance = Math.hypot(centerX - targetX, centerY - targetY);
  const angleOk = Number(piece.dataset.angle) === def.angle;
  const snapRadius = template.snapRadius;
  if (distance < snapRadius && angleOk) {
    const benchRect = piecesEl.getBoundingClientRect();
    const targetRelativeX = targetRect.left - benchRect.left + targetRect.width * def.slot.x / 100;
    const targetRelativeY = targetRect.top - benchRect.top + targetRect.height * def.slot.y / 100;

    piece.classList.add("snapping");
    piece.style.left = `${targetRelativeX}px`;
    piece.style.top = `${targetRelativeY}px`;

    setTimeout(() => {
      piece.classList.remove("snapping");
      piece.classList.add("locked");
      piece.classList.remove("selected");
      piece.style.background = template.piece.style.lockedBackground;
      state.locked.add(id);
      addLog(`${def.label}${template.pieceName}贴合成功。`);
      triggerVibration([10, 30, 10]);
      tutorial.notifyAction("snap");
      if (selectedPiece === piece) {
        selectedPiece = null;
      }
      if (state.locked.size === template.pieceDefs.length) {
        finish(true, `${template.name}修复完成。`);
      }
    }, 150);
  } else if (distance < snapRadius && !angleOk) {
    state.wrongAngleAttempts += 1;
    addLog("角度不对，双击碎片可以旋转。");
  } else if (!angleOk) {
    addLog("角度不对，双击碎片可以旋转。");
  }
  clearSnapFeedback();
  renderStats();
}

function finish(success, message) {
  if (!state.running) return;
  state.running = false;
  clearInterval(timer);
  const template = artifactTemplates[currentTemplate];
  const completeness = Math.round((state.locked.size / template.pieceDefs.length) * 100);
  const scores = calculateExpertScore(template);

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

  const goalResults = evaluateGoals(template, state);
  const goalsCount = Object.keys(goalResults).length;
  const achievedGoalsCount = Object.values(goalResults).filter(g => g.achieved).length;

  let goalsHtml = "";
  if (goalsCount > 0) {
    goalsHtml = `
      <div class="settlement-goals">
        <h3>🎯 修复目标 <span class="goals-progress">(${achievedGoalsCount}/${goalsCount})</span></h3>
        <div class="settlement-goals-list">
          ${Object.values(goalResults).map(goal => `
            <div class="settlement-goal-item ${goal.achieved ? 'achieved' : 'not-achieved'}">
              <span class="settlement-goal-icon">${goal.icon}</span>
              <div class="settlement-goal-info">
                <span class="settlement-goal-name">${goal.name}</span>
                <span class="settlement-goal-desc">${goal.description}</span>
              </div>
              <span class="settlement-goal-status">${goal.achieved ? '✓ 达成' : '✗ 未达成'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  let settlementHtml = "";
  if (success) {
    const rating = getRating(scores.totalScore);
    const commentary = getCommentary(rating, scores);
    const totalColor = getScoreColor(scores.totalScore);

    settlementHtml = `
      <div class="settlement">
        ${goalsHtml}
        <div class="settlement-rating rating-${rating}">
          <div class="rating-label">专家评级</div>
          <div class="rating-badge">${rating}</div>
          <div class="total-score" style="color:${totalColor}">综合评分 ${scores.totalScore}</div>
        </div>
        <div class="settlement-scores">
          <div class="settlement-score-item">
            <div class="score-label">用时效率</div>
            <div class="score-bar"><div class="score-bar-fill" style="width:${scores.timeScore}%;background:${getScoreColor(scores.timeScore)}"></div></div>
            <div class="score-value" style="color:${getScoreColor(scores.timeScore)}">${scores.timeScore}</div>
          </div>
          <div class="settlement-score-item">
            <div class="score-label">挖掘精准</div>
            <div class="score-bar"><div class="score-bar-fill" style="width:${scores.digScore}%;background:${getScoreColor(scores.digScore)}"></div></div>
            <div class="score-value" style="color:${getScoreColor(scores.digScore)}">${scores.digScore}</div>
          </div>
          <div class="settlement-score-item">
            <div class="score-label">角度判断</div>
            <div class="score-bar"><div class="score-bar-fill" style="width:${scores.angleScore}%;background:${getScoreColor(scores.angleScore)}"></div></div>
            <div class="score-value" style="color:${getScoreColor(scores.angleScore)}">${scores.angleScore}</div>
          </div>
          <div class="settlement-score-item">
            <div class="score-label">事件应对</div>
            <div class="score-bar"><div class="score-bar-fill" style="width:${scores.eventScore}%;background:${getScoreColor(scores.eventScore)}"></div></div>
            <div class="score-value" style="color:${getScoreColor(scores.eventScore)}">${scores.eventScore}</div>
          </div>
          <div class="settlement-score-item">
            <div class="score-label">独立完成</div>
            <div class="score-bar"><div class="score-bar-fill" style="width:${scores.hintScore}%;background:${getScoreColor(scores.hintScore)}"></div></div>
            <div class="score-value" style="color:${getScoreColor(scores.hintScore)}">${scores.hintScore}</div>
          </div>
          <div class="settlement-score-item">
            <div class="score-label">工具使用</div>
            <div class="score-bar"><div class="score-bar-fill" style="width:${scores.toolScore}%;background:${getScoreColor(scores.toolScore)}"></div></div>
            <div class="score-value" style="color:${getScoreColor(scores.toolScore)}">${scores.toolScore}</div>
          </div>
        </div>
        <div class="settlement-tools-used">
          <span class="tools-used-label">道具使用：</span>
          <span class="tool-used-item">📍 探针 ${state.toolsUsed.probe}</span>
          <span class="tool-used-item">🖌️ 刷子 ${state.toolsUsed.brush}</span>
          <span class="tool-used-item">🧭 罗盘 ${state.toolsUsed.compass}</span>
          <span class="tool-used-item">🔧 小手铲 ${state.toolsUsed.trowel || 0}</span>
        </div>
        <div class="settlement-commentary">${commentary}</div>
      </div>`;

    const record = {
      levelId: currentTemplate,
      levelName: template.name,
      timeUsed: state.elapsedTime !== undefined ? state.elapsedTime : (template.timeLimit - state.timeLeft),
      digs: state.digs,
      completeness: completeness,
      finalScore: scores.totalScore,
      rating: rating,
      scores: scores,
      keyEvents: state.keyEvents,
      toolWear: state.toolWear,
      bonusScore: state.bonusScore,
      hintsUsed: state.hintsUsed,
      wrongAngleAttempts: state.wrongAngleAttempts,
      toolsUsed: { ...state.toolsUsed },
      toolPackage: state.toolPackage ? { ...state.toolPackage } : null,
      goals: goalResults,
      goalsAchieved: achievedGoalsCount,
      goalsTotal: goalsCount,
      completedAt: Date.now()
    };
    archive.addRecord(record);
    addLog("本轮记录已归档。");
  } else {
    const totalColor = getScoreColor(scores.totalScore);
    settlementHtml = `
      <div class="settlement">
        ${goalsHtml}
        <div class="settlement-rating rating-F">
          <div class="rating-label">专家评级</div>
          <div class="rating-badge">F</div>
          <div class="total-score" style="color:${totalColor}">综合评分 ${scores.totalScore}</div>
        </div>
        <div class="settlement-scores">
          <div class="settlement-score-item">
            <div class="score-label">用时效率</div>
            <div class="score-bar"><div class="score-bar-fill" style="width:${scores.timeScore}%;background:${getScoreColor(scores.timeScore)}"></div></div>
            <div class="score-value" style="color:${getScoreColor(scores.timeScore)}">${scores.timeScore}</div>
          </div>
          <div class="settlement-score-item">
            <div class="score-label">挖掘精准</div>
            <div class="score-bar"><div class="score-bar-fill" style="width:${scores.digScore}%;background:${getScoreColor(scores.digScore)}"></div></div>
            <div class="score-value" style="color:${getScoreColor(scores.digScore)}">${scores.digScore}</div>
          </div>
          <div class="settlement-score-item">
            <div class="score-label">角度判断</div>
            <div class="score-bar"><div class="score-bar-fill" style="width:${scores.angleScore}%;background:${getScoreColor(scores.angleScore)}"></div></div>
            <div class="score-value" style="color:${getScoreColor(scores.angleScore)}">${scores.angleScore}</div>
          </div>
          <div class="settlement-score-item">
            <div class="score-label">事件应对</div>
            <div class="score-bar"><div class="score-bar-fill" style="width:${scores.eventScore}%;background:${getScoreColor(scores.eventScore)}"></div></div>
            <div class="score-value" style="color:${getScoreColor(scores.eventScore)}">${scores.eventScore}</div>
          </div>
          <div class="settlement-score-item">
            <div class="score-label">独立完成</div>
            <div class="score-bar"><div class="score-bar-fill" style="width:${scores.hintScore}%;background:${getScoreColor(scores.hintScore)}"></div></div>
            <div class="score-value" style="color:${getScoreColor(scores.hintScore)}">${scores.hintScore}</div>
          </div>
          <div class="settlement-score-item">
            <div class="score-label">工具使用</div>
            <div class="score-bar"><div class="score-bar-fill" style="width:${scores.toolScore}%;background:${getScoreColor(scores.toolScore)}"></div></div>
            <div class="score-value" style="color:${getScoreColor(scores.toolScore)}">${scores.toolScore}</div>
          </div>
        </div>
        <div class="settlement-tools-used">
          <span class="tools-used-label">道具使用：</span>
          <span class="tool-used-item">📍 探针 ${state.toolsUsed.probe}</span>
          <span class="tool-used-item">🖌️ 刷子 ${state.toolsUsed.brush}</span>
          <span class="tool-used-item">🧭 罗盘 ${state.toolsUsed.compass}</span>
          <span class="tool-used-item">🔧 小手铲 ${state.toolsUsed.trowel || 0}</span>
        </div>
        <div class="settlement-commentary">修复未能完成，考古现场需更严谨的操作与更充分的准备。</div>
      </div>`;
  }

  resultEl.innerHTML = `<h2>${message}</h2>
    <p>${success ? "通关" : "结束"}：${template.name}修复任务 · 用时${state.elapsedTime !== undefined ? state.elapsedTime : (template.timeLimit - state.timeLeft)}秒 · 挖掘${state.digs}次 · 完整度${completeness}%。</p>
    ${eventsHtml}
    ${settlementHtml}`;
  resultEl.classList.remove("hidden");

  render();
}

function addLog(text) {
  state.log.push(text);
  state.log = state.log.slice(-30);
}

const eventNotifContainer = document.getElementById("eventNotifContainer");

function showEventNotif(evt, message) {
  if (!gameSettings.get("eventAnim")) return;
  const notif = document.createElement("div");
  notif.className = `event-notif event-${evt.type}`;
  const icon = evt.type === "positive" ? "✦" : "⚡";
  notif.innerHTML = `
    <div class="event-notif-header">
      <span class="event-notif-icon">${icon}</span>
      <span class="event-notif-name">${evt.name}</span>
    </div>
    <div class="event-notif-msg">${message}</div>
  `;
  eventNotifContainer.appendChild(notif);
  setTimeout(() => {
    notif.classList.add("fade-out");
    notif.addEventListener("animationend", () => notif.remove());
  }, 3500);
}

function triggerVibration(pattern) {
  if (!gameSettings.get("vibration")) return;
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

function render() {
  renderStats();
  renderGrid();
  renderLog();
  renderTools();
  startBtn.disabled = state.running;
  hintBtn.disabled = !state.running;
}

function renderStats() {
  const template = artifactTemplates[currentTemplate];
  timeLeftEl.textContent = state.timeLeft;
  digCountEl.textContent = state.digs;
  progressEl.textContent = `${Math.round((state.locked.size / template.pieceDefs.length) * 100)}%`;
  renderGoals();
}

function renderGoals() {
  const template = artifactTemplates[currentTemplate];
  const goalsPanel = document.getElementById("goalsPanel");
  const goalsListEl = document.getElementById("goalsList");
  const goals = template.goals || {};

  if (Object.keys(goals).length === 0) {
    goalsPanel.classList.add("hidden");
    return;
  }

  goalsPanel.classList.remove("hidden");
  goalsListEl.innerHTML = "";

  const goalResults = evaluateGoals(template, state);
  Object.values(goalResults).forEach(result => {
    const goalEl = document.createElement("div");
    goalEl.className = "goal-item" + (result.achieved ? " achieved" : "");
    goalEl.innerHTML = `
      <span class="goal-icon">${result.icon}</span>
      <div class="goal-info">
        <span class="goal-name">${result.name}</span>
        <span class="goal-desc">${result.description}</span>
      </div>
      <span class="goal-status">${result.achieved ? "✓" : "○"}</span>
    `;
    goalsListEl.appendChild(goalEl);
  });
}

function renderTools() {
  const template = artifactTemplates[currentTemplate];
  const allBtns = [probeBtn, brushBtn, compassBtn, trowelBtn];
  allBtns.forEach(b => b.classList.add("hidden"));

  function renderToolButton(btnEl, toolId) {
    const count = state.tools[toolId] || 0;
    if (count <= 0 && state.activeTool !== toolId) {
      btnEl.classList.add("hidden");
      return;
    }
    const tool = TOOLS[toolId];
    if (!tool) return;
    btnEl.classList.remove("hidden");
    const check = tool.canUse(state, template);
    const isActive = state.activeTool === toolId;

    btnEl.innerHTML = `
      <span class="tool-icon">${tool.icon}</span>
      <span class="tool-name">${tool.name}</span>
      <span class="tool-count">${count}</span>
    `;
    btnEl.title = `${tool.name}：${tool.description}（剩余${count}次）`;
    btnEl.disabled = !check.ok && !isActive;
    btnEl.classList.toggle("active", isActive);
  }

  renderToolButton(probeBtn, "probe");
  renderToolButton(brushBtn, "brush");
  renderToolButton(compassBtn, "compass");
  renderToolButton(trowelBtn, "trowel");
}

function renderGrid() {
  const template = artifactTemplates[currentTemplate];
  gridEl.innerHTML = "";
  const gridSize = template.gridSize || 25;
  const cols = Math.sqrt(gridSize);
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  gridEl.classList.toggle("brush-mode", state.activeTool === "brush");
  gridEl.classList.toggle("trowel-mode", state.activeTool === "trowel");

  for (let i = 0; i < gridSize; i += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    if (state.dug.has(i)) cell.classList.add("dug");
    if (state.found.has(template.buried[i])) cell.classList.add("found");
    if (state.lockedCells.has(i)) cell.classList.add("locked-cell");
    if (state.hintedCells.has(i) && !state.dug.has(i)) cell.classList.add("hinted");
    if (state.probeHints.has(i) && !state.dug.has(i)) cell.classList.add("probe-hinted");
    if (state.activeTool === "brush") cell.classList.add("brush-mode");
    if (state.activeTool === "trowel") cell.classList.add("trowel-mode");

    if (state.dug.has(i)) {
      cell.textContent = template.buried[i] ? template.pieceName : "土";
    } else if (state.lockedCells.has(i)) {
      cell.textContent = "⚠";
    } else if (state.hintedCells.has(i)) {
      cell.textContent = "?";
    } else if (state.probeHints.has(i)) {
      cell.textContent = "◎";
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

const CUSTOM_LEVELS_STORAGE_KEY = "archaeology_custom_levels";
const STYLE_PRESETS = {
  bowl: {
    shape: "circle",
    targetClass: "",
    target: {
      background: "#c28c59",
      borderColor: "#7a432d",
      borderWidth: 8,
      innerRingColor: "#d6a873",
      innerRingWidth: 12,
      innerCircleColor: "#7a432d",
      innerCircleWidth: 6,
      innerCircleInset: "28%"
    },
    piece: {
      width: 100,
      height: 100,
      background: "#cd915c",
      borderColor: "#7a432d",
      borderWidth: 4,
      borderRadius: "18px 8px 22px 10px",
      lockedBackground: "#d6a873",
      innerDecorationType: "circle",
      innerDecorationInset: "20px",
      innerDecorationBorderWidth: 4,
      innerDecorationBorderColor: "rgba(99, 54, 36, .75)",
      innerDecorationRadius: "50%"
    }
  },
  tile: {
    shape: "tile",
    targetClass: "tile-shape",
    target: {
      background: "#a08465",
      borderColor: "#4a3728",
      borderWidth: 8,
      innerRingColor: "#b89874",
      innerRingWidth: 12,
      innerCircleColor: "#4a3728",
      innerCircleWidth: 6,
      innerCircleSize: "35%"
    },
    piece: {
      width: 100,
      height: 100,
      background: "#a08465",
      borderColor: "#4a3728",
      borderWidth: 4,
      borderRadius: "12px 12px 4px 4px",
      lockedBackground: "#b89874",
      innerDecorationType: "rect",
      innerDecorationInset: "20px",
      innerDecorationBorderWidth: 4,
      innerDecorationBorderColor: "rgba(74, 55, 40, .75)",
      innerDecorationRadius: "4px"
    }
  },
  mirror: {
    shape: "mirror",
    targetClass: "mirror-shape",
    target: {
      background: "#7a8b94",
      borderColor: "#2d3e45",
      borderWidth: 8,
      innerRingColor: "#95a5ae",
      innerRingWidth: 12,
      innerCircleColor: "#2d3e45",
      innerCircleWidth: 6,
      innerCircleInset: "20%",
      innerCircleFill: "#4a5b63",
      centerKnobColor: "#c49b62",
      centerKnobBorder: "#7a432d",
      centerKnobSize: "12%"
    },
    piece: {
      width: 100,
      height: 100,
      background: "#7a8b94",
      borderColor: "#2d3e45",
      borderWidth: 4,
      borderRadius: "50%",
      lockedBackground: "#95a5ae",
      innerDecorationType: "circle",
      innerDecorationInset: "22px",
      innerDecorationBorderWidth: 4,
      innerDecorationBorderColor: "rgba(45, 62, 69, .75)",
      innerDecorationRadius: "50%"
    }
  },
  jade: {
    shape: "circle",
    targetClass: "jade-shape",
    target: {
      background: "#8fbc8f",
      borderColor: "#3d6b4f",
      borderWidth: 8,
      innerRingColor: "#a8d4a8",
      innerRingWidth: 12,
      innerCircleColor: "#3d6b4f",
      innerCircleWidth: 6,
      innerCircleInset: "25%"
    },
    piece: {
      width: 100,
      height: 100,
      background: "#98c998",
      borderColor: "#3d6b4f",
      borderWidth: 4,
      borderRadius: "8px 18px 10px 22px",
      lockedBackground: "#b8e0b8",
      innerDecorationType: "circle",
      innerDecorationInset: "20px",
      innerDecorationBorderWidth: 4,
      innerDecorationBorderColor: "rgba(61, 107, 79, .75)",
      innerDecorationRadius: "50%"
    }
  }
};

const DEFAULT_LABELS = [
  "顶部", "底部", "左侧", "右侧", "左上", "右上", "左下", "右下",
  "中心", "顶部左", "顶部右", "底部左", "底部右"
];

const customLevelsStore = {
  load() {
    try {
      const data = localStorage.getItem(CUSTOM_LEVELS_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error("加载自定义关卡失败:", e);
      return {};
    }
  },
  save(levels) {
    try {
      localStorage.setItem(CUSTOM_LEVELS_STORAGE_KEY, JSON.stringify(levels));
    } catch (e) {
      console.error("保存自定义关卡失败:", e);
    }
  },
  getAll() {
    const data = this.load();
    return Object.values(data).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },
  get(id) {
    const data = this.load();
    return data[id] || null;
  },
  add(level) {
    const data = this.load();
    if (!level.id) {
      level.id = "custom_" + Date.now();
    }
    if (!level.createdAt) {
      level.createdAt = Date.now();
    }
    data[level.id] = level;
    this.save(data);
    return level;
  },
  update(id, level) {
    const data = this.load();
    if (data[id]) {
      level.updatedAt = Date.now();
      data[id] = { ...data[id], ...level };
      this.save(data);
      return true;
    }
    return false;
  },
  delete(id) {
    const data = this.load();
    if (data[id]) {
      delete data[id];
      this.save(data);
      return true;
    }
    return false;
  }
};

const editor = {
  state: null,
  selectedPieceId: null,
  draggingSlotId: null,
  dragOffset: { x: 0, y: 0 },
  editingLevelId: null,
  _pendingImportState: null,

  init() {
    this.bindUI();
  },

  bindUI() {
    document.getElementById("openEditorBtn").addEventListener("click", () => this.open());
    document.getElementById("editorBackBtn").addEventListener("click", () => this.close());
    document.getElementById("duplicateLevelBtn").addEventListener("click", () => this.duplicate());
    document.getElementById("addPieceBtn").addEventListener("click", () => this.addPiece());
    document.getElementById("clearPiecesBtn").addEventListener("click", () => this.clearPieces());
    document.getElementById("validateBtn").addEventListener("click", () => this.validateAndShow());
    document.getElementById("previewBtn").addEventListener("click", () => this.preview());
    document.getElementById("saveLevelBtn").addEventListener("click", () => this.save());
    document.getElementById("exportLevelBtn").addEventListener("click", () => this.exportJSON());
    document.getElementById("importLevelBtn").addEventListener("click", () => {
      document.getElementById("importFileInput").click();
    });
    document.getElementById("importFileInput").addEventListener("change", (e) => this.importJSON(e));
    document.getElementById("importPreviewCloseBtn").addEventListener("click", () => this.hideImportPreview());
    document.getElementById("importPreviewCancelBtn").addEventListener("click", () => this.hideImportPreview());
    document.getElementById("importPreviewConfirmBtn").addEventListener("click", () => this.applyImportedData());
    document.getElementById("previewCopyBtn").addEventListener("click", () => this.copyFromPreview());

    document.getElementById("editorLevelName").addEventListener("input", (e) => {
      if (this.state) this.state.name = e.target.value;
    });
    document.getElementById("editorDescription").addEventListener("input", (e) => {
      if (this.state) this.state.description = e.target.value;
    });
    document.getElementById("editorTimeLimit").addEventListener("change", (e) => {
      if (this.state) this.state.timeLimit = Number(e.target.value);
    });
    document.getElementById("editorGridSize").addEventListener("change", (e) => {
      if (this.state) {
        const newSize = Number(e.target.value);
        this.state.gridSize = newSize;
        Object.keys(this.state.buried).forEach((key) => {
          if (Number(key) >= newSize) {
            delete this.state.buried[key];
          }
        });
        this.renderGrid();
      }
    });
    document.getElementById("editorPieceName").addEventListener("input", (e) => {
      if (this.state) this.state.pieceName = e.target.value;
    });
    document.getElementById("editorSnapRadius").addEventListener("change", (e) => {
      if (this.state) this.state.snapRadius = Number(e.target.value);
    });

    document.querySelectorAll(".style-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".style-preset-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (this.state) {
          this.state.stylePreset = btn.dataset.style;
          this.renderTargetStyle();
        }
      });
    });

    document.getElementById("editorTarget").addEventListener("click", (e) => {
      if (e.target.id === "editorTarget" || e.target.id === "editorTargetInner") {
        if (!this.selectedPieceId) {
          this.showHint("请先在左侧选择一个碎片");
          return;
        }
        const rect = document.getElementById("editorTarget").getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        this.setPieceSlot(this.selectedPieceId, x, y);
      }
    });

    document.addEventListener("pointermove", (e) => this.handleSlotDragMove(e));
    document.addEventListener("pointerup", (e) => this.handleSlotDragEnd(e));
  },

  open(levelId = null) {
    this.editingLevelId = null;
    if (levelId) {
      const customLevel = customLevelsStore.get(levelId);
      if (customLevel) {
        this.state = JSON.parse(JSON.stringify(customLevel));
        this.editingLevelId = levelId;
      } else if (artifactTemplates[levelId]) {
        this.state = this.templateToEditorState(artifactTemplates[levelId]);
      } else {
        this.createNewState();
      }
    } else {
      this.createNewState();
    }
    this.selectedPieceId = this.state.pieceDefs.length > 0 ? this.state.pieceDefs[0].id : null;
    this.syncUIFromState();
    this.renderAll();
    document.getElementById("levelSelect").classList.add("hidden");
    document.getElementById("levelEditor").classList.remove("hidden");
    document.getElementById("validationResult").innerHTML = "";
  },

  templateToEditorState(template) {
    const iconClassMap = {
      "bowl-icon": "bowl",
      "tile-icon": "tile",
      "mirror-icon": "mirror",
      "custom-icon": "jade"
    };
    let stylePreset = "bowl";
    if (template.iconClass && iconClassMap[template.iconClass]) {
      stylePreset = iconClassMap[template.iconClass];
    } else if (template.target && template.target.style) {
      stylePreset = this.inferStylePreset(template);
    }
    return {
      isCustom: true,
      id: template.id,
      name: template.name || "",
      description: template.description || "",
      timeLimit: template.timeLimit || 120,
      gridSize: template.gridSize || 25,
      pieceName: template.pieceName || "碎片",
      snapRadius: template.snapRadius || 60,
      stylePreset: stylePreset,
      difficulty: template.difficulty || "自定义",
      buried: JSON.parse(JSON.stringify(template.buried || {})),
      pieceDefs: JSON.parse(JSON.stringify(template.pieceDefs || [])),
      goals: JSON.parse(JSON.stringify(template.goals || {}))
    };
  },

  generateCopyName(originalName) {
    const baseName = originalName || "自定义关卡";
    const existingLevels = customLevelsStore.getAll();
    const existingNames = existingLevels.map((l) => l.name);
    let copyName = `${baseName} 副本`;
    let counter = 2;
    while (existingNames.includes(copyName)) {
      copyName = `${baseName} 副本 ${counter}`;
      counter++;
    }
    return copyName;
  },

  persistCopiedState(sourceState) {
    const copiedState = JSON.parse(JSON.stringify(sourceState));
    copiedState.name = this.generateCopyName(copiedState.name);
    delete copiedState.id;
    delete copiedState.createdAt;
    delete copiedState.updatedAt;
    const savedLevel = customLevelsStore.add(this.stateToTemplate(copiedState));
    this.state = this.templateToEditorState(savedLevel);
    this.editingLevelId = savedLevel.id;
    this.selectedPieceId = this.state.pieceDefs.length > 0 ? this.state.pieceDefs[0].id : null;
    renderCustomLevelCards();
    return savedLevel;
  },

  duplicate() {
    if (!this.state) {
      alert("当前没有可复制的关卡配置");
      return;
    }
    const savedLevel = this.persistCopiedState(this.state);
    this.syncUIFromState();
    this.renderAll();
    document.getElementById("validationResult").className = "validation-result success";
    document.getElementById("validationResult").innerHTML =
      `<strong>✅ 已复制为新关卡</strong> 名称已更新为「${savedLevel.name}」，可继续编辑碎片、埋藏位置和修复槽位。`;
  },

  copyFromPreview() {
    if (!currentPreviewTemplateId || !artifactTemplates[currentPreviewTemplateId]) {
      alert("请先选择一个关卡");
      return;
    }
    const template = artifactTemplates[currentPreviewTemplateId];
    const editorState = this.templateToEditorState(template);
    const savedLevel = this.persistCopiedState(editorState);
    hideLevelPreview();
    this.syncUIFromState();
    this.renderAll();
    document.getElementById("levelSelect").classList.add("hidden");
    document.getElementById("levelEditor").classList.remove("hidden");
    document.getElementById("validationResult").className = "validation-result success";
    document.getElementById("validationResult").innerHTML =
      `<strong>✅ 已复制为自定义关卡</strong> 名称：「${savedLevel.name}」，可继续编辑碎片、埋藏位置和修复槽位。`;
  },

  close() {
    this.editingLevelId = null;
    document.getElementById("levelEditor").classList.add("hidden");
    document.getElementById("levelSelect").classList.remove("hidden");
    renderCustomLevelCards();
  },

  createNewState() {
    this.state = {
      isCustom: true,
      name: "",
      description: "",
      timeLimit: 120,
      gridSize: 25,
      pieceName: "碎片",
      snapRadius: 60,
      stylePreset: "bowl",
      difficulty: "自定义",
      buried: {},
      pieceDefs: [],
      goals: {}
    };
  },

  syncUIFromState() {
    document.getElementById("editorLevelName").value = this.state.name || "";
    document.getElementById("editorDescription").value = this.state.description || "";
    document.getElementById("editorTimeLimit").value = this.state.timeLimit || 120;
    document.getElementById("editorGridSize").value = String(this.state.gridSize || 25);
    document.getElementById("editorPieceName").value = this.state.pieceName || "碎片";
    document.getElementById("editorSnapRadius").value = this.state.snapRadius || 60;
    document.querySelectorAll(".style-preset-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.style === (this.state.stylePreset || "bowl"));
    });
  },

  renderAll() {
    this.renderPieceList();
    this.renderGrid();
    this.renderSlots();
    this.renderTargetStyle();
    this.renderGoalsEditor();
    this.updatePieceCount();
  },

  renderGoalsEditor() {
    const container = document.getElementById("editorGoalsList");
    if (!container) return;
    container.innerHTML = "";

    if (!this.state.goals) this.state.goals = {};

    const goalIds = Object.keys(RESTORATION_GOALS);
    goalIds.forEach(goalId => {
      const goalDef = RESTORATION_GOALS[goalId];
      const enabled = this.state.goals[goalId] !== undefined;
      const goalValue = this.state.goals[goalId];

      const wrapper = document.createElement("div");
      wrapper.className = "editor-goal-item" + (enabled ? " enabled" : "");

      const needsValue = goalId === "maxDigs" || goalId === "timeLimit";

      let valueInput = "";
      if (needsValue) {
        let defaultVal = 0;
        if (goalId === "maxDigs") defaultVal = Math.ceil((this.state.gridSize || 25) * 0.6);
        if (goalId === "timeLimit") defaultVal = Math.floor((this.state.timeLimit || 120) * 0.8);
        valueInput = `
          <input type="number" class="editor-goal-value" min="1" 
            ${enabled ? "" : "disabled"} 
            value="${enabled && goalValue ? goalValue : defaultVal}">
        `;
      }

      wrapper.innerHTML = `
        <label class="editor-goal-checkbox">
          <input type="checkbox" ${enabled ? "checked" : ""}>
          <span class="editor-goal-icon">${goalDef.icon}</span>
          <div class="editor-goal-info">
            <span class="editor-goal-name">${goalDef.name}</span>
            <span class="editor-goal-desc">${goalDef.description(
              needsValue ? (enabled && goalValue ? goalValue : (goalId === "maxDigs" ? "N" : "N")) : true
            )}</span>
          </div>
          ${valueInput}
        </label>
      `;

      const checkbox = wrapper.querySelector('input[type="checkbox"]');
      checkbox.addEventListener("change", (e) => {
        if (e.target.checked) {
          if (needsValue) {
            const valInput = wrapper.querySelector(".editor-goal-value");
            const val = Number(valInput.value);
            if (val > 0) {
              this.state.goals[goalId] = val;
            } else {
              this.state.goals[goalId] = goalId === "maxDigs" 
                ? Math.ceil((this.state.gridSize || 25) * 0.6) 
                : Math.floor((this.state.timeLimit || 120) * 0.8);
              valInput.value = this.state.goals[goalId];
            }
          } else {
            this.state.goals[goalId] = true;
          }
        } else {
          delete this.state.goals[goalId];
        }
        this.renderGoalsEditor();
      });

      if (needsValue) {
        const valInput = wrapper.querySelector(".editor-goal-value");
        valInput.addEventListener("change", (e) => {
          const val = Number(e.target.value);
          if (val > 0 && this.state.goals[goalId] !== undefined) {
            this.state.goals[goalId] = val;
            const descEl = wrapper.querySelector(".editor-goal-desc");
            if (descEl) descEl.textContent = goalDef.description(val);
          }
        });
        valInput.addEventListener("input", (e) => {
          const val = Number(e.target.value);
          const descEl = wrapper.querySelector(".editor-goal-desc");
          if (descEl && val > 0) descEl.textContent = goalDef.description(val);
        });
      }

      container.appendChild(wrapper);
    });
  },

  updatePieceCount() {
    document.getElementById("pieceCountBadge").textContent = String(this.state.pieceDefs.length);
  },

  addPiece() {
    const idx = this.state.pieceDefs.length;
    const id = "p" + (idx + 1);
    const label = DEFAULT_LABELS[idx] || `碎片${idx + 1}`;
    const cols = Math.sqrt(this.state.gridSize);
    const gridIdx = idx % this.state.gridSize;
    const slotX = 10 + (idx % 4) * 20;
    const slotY = 10 + Math.floor(idx / 4) * 20;

    this.state.pieceDefs.push({
      id: id,
      label: label,
      slot: { x: Math.min(slotX, 70), y: Math.min(slotY, 70) },
      angle: 0,
      initialAngle: Math.floor(Math.random() * 8) * 45
    });
    this.state.buried[String(gridIdx)] = id;
    this.selectedPieceId = id;
    this.renderAll();
  },

  clearPieces() {
    if (this.state.pieceDefs.length === 0) return;
    if (!confirm("确定要清空所有碎片吗？")) return;
    this.state.pieceDefs = [];
    this.state.buried = {};
    this.selectedPieceId = null;
    this.renderAll();
  },

  deletePiece(pieceId) {
    this.state.pieceDefs = this.state.pieceDefs.filter((p) => p.id !== pieceId);
    Object.keys(this.state.buried).forEach((key) => {
      if (this.state.buried[key] === pieceId) {
        delete this.state.buried[key];
      }
    });
    if (this.selectedPieceId === pieceId) {
      this.selectedPieceId = this.state.pieceDefs.length > 0 ? this.state.pieceDefs[0].id : null;
    }
    this.renderAll();
  },

  selectPiece(pieceId) {
    this.selectedPieceId = pieceId;
    this.renderPieceList();
    this.renderGrid();
    this.renderSlots();
  },

  setPieceLabel(pieceId, label) {
    const piece = this.state.pieceDefs.find((p) => p.id === pieceId);
    if (piece) piece.label = label;
  },

  setPieceAngle(pieceId, angle, field) {
    const piece = this.state.pieceDefs.find((p) => p.id === pieceId);
    if (piece) {
      piece[field] = Number(angle);
      if (field === "angle") this.renderSlots();
    }
  },

  setPieceSlot(pieceId, x, y) {
    const piece = this.state.pieceDefs.find((p) => p.id === pieceId);
    if (piece) {
      x = Math.max(8, Math.min(92, x));
      y = Math.max(8, Math.min(92, y));
      piece.slot = { x, y };
      this.renderSlots();
    }
  },

  renderPieceList() {
    const container = document.getElementById("pieceListEditor");
    container.innerHTML = "";
    this.state.pieceDefs.forEach((piece, idx) => {
      const card = document.createElement("div");
      card.className = "piece-editor-card" + (this.selectedPieceId === piece.id ? " selected" : "");

      const status = this.getPieceStatus(piece);

      card.innerHTML = `
        <div class="piece-editor-header">
          <div class="piece-editor-title">
            <span class="piece-editor-index">${idx + 1}</span>
            <input type="text" class="piece-editor-label" value="${piece.label}" maxlength="8">
            <span class="piece-status ${status.type}">${status.text}</span>
          </div>
          <button type="button" class="piece-delete-btn" title="删除">✕</button>
        </div>
        <div class="piece-editor-body">
          <div class="mini-field">
            <label>正确角度 (°)</label>
            <select class="angle-select" data-field="angle">
              ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => 
                `<option value="${a}" ${piece.angle === a ? "selected" : ""}>${a}°</option>`
              ).join("")}
            </select>
          </div>
          <div class="mini-field">
            <label>初始角度 (°)</label>
            <select class="angle-select" data-field="initialAngle">
              ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => 
                `<option value="${a}" ${piece.initialAngle === a ? "selected" : ""}>${a}°</option>`
              ).join("")}
            </select>
          </div>
        </div>
      `;

      const titleDiv = card.querySelector(".piece-editor-title");
      titleDiv.addEventListener("click", (e) => {
        if (!e.target.classList.contains("piece-editor-label")) {
          this.selectPiece(piece.id);
        }
      });

      const labelInput = card.querySelector(".piece-editor-label");
      labelInput.addEventListener("input", (e) => {
        this.setPieceLabel(piece.id, e.target.value);
      });
      labelInput.addEventListener("click", (e) => e.stopPropagation());

      card.querySelector(".piece-delete-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        this.deletePiece(piece.id);
      });

      card.querySelectorAll(".angle-select").forEach((sel) => {
        sel.addEventListener("change", (e) => {
          e.stopPropagation();
          this.setPieceAngle(piece.id, e.target.value, sel.dataset.field);
        });
        sel.addEventListener("click", (e) => e.stopPropagation());
      });

      container.appendChild(card);
    });

    if (this.state.pieceDefs.length === 0) {
      container.innerHTML = `<div style="padding:24px;text-align:center;color:#7d4c21;font-size:13px;">
        还没有碎片，点击「+ 添加碎片」开始创建
      </div>`;
    }
  },

  getPieceStatus(piece) {
    const hasBuried = Object.values(this.state.buried).includes(piece.id);
    const hasSlot = piece.slot && piece.slot.x !== undefined && piece.slot.y !== undefined;
    if (!hasBuried && !hasSlot) return { type: "error", text: "未配置" };
    if (!hasBuried) return { type: "warn", text: "缺埋藏" };
    if (!hasSlot) return { type: "warn", text: "缺槽位" };
    return { type: "ok", text: "已就绪" };
  },

  renderGrid() {
    const grid = document.getElementById("editorGrid");
    grid.innerHTML = "";
    const size = this.state.gridSize;
    const cols = Math.sqrt(size);
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    for (let i = 0; i < size; i++) {
      const cell = document.createElement("div");
      cell.className = "editor-cell";
      const pieceId = this.state.buried[String(i)];
      if (pieceId) {
        cell.classList.add("has-piece");
        const piece = this.state.pieceDefs.find((p) => p.id === pieceId);
        const idx = this.state.pieceDefs.findIndex((p) => p.id === pieceId);
        cell.textContent = String(idx + 1);
        cell.title = `${piece ? piece.label : pieceId}`;
        if (pieceId === this.selectedPieceId) {
          cell.classList.add("selected-piece-cell");
        }
      }

      cell.addEventListener("click", () => this.handleGridCellClick(i));
      grid.appendChild(cell);
    }
  },

  handleGridCellClick(cellIdx) {
    const key = String(cellIdx);
    if (this.state.buried[key]) {
      const existingPieceId = this.state.buried[key];
      this.selectedPieceId = existingPieceId;
      delete this.state.buried[key];
    } else {
      if (!this.selectedPieceId) {
        this.showHint("请先在左侧选择或添加一个碎片");
        return;
      }
      Object.keys(this.state.buried).forEach((k) => {
        if (this.state.buried[k] === this.selectedPieceId) {
          delete this.state.buried[k];
        }
      });
      this.state.buried[key] = this.selectedPieceId;
    }
    this.renderGrid();
    this.renderPieceList();
  },

  renderTargetStyle() {
    const preset = STYLE_PRESETS[this.state.stylePreset || "bowl"];
    const target = document.getElementById("editorTarget");
    target.className = "editor-target " + (preset.targetClass || "");
  },

  renderSlots() {
    const target = document.getElementById("editorTarget");
    target.querySelectorAll(".editor-slot").forEach((el) => el.remove());

    this.state.pieceDefs.forEach((piece) => {
      if (!piece.slot || piece.slot.x === undefined) return;
      const idx = this.state.pieceDefs.findIndex((p) => p.id === piece.id);
      const slot = document.createElement("div");
      slot.className = "editor-slot";
      if (piece.id === this.selectedPieceId) {
        slot.classList.add("selected-slot");
      }
      slot.dataset.pieceId = piece.id;
      slot.style.left = `${piece.slot.x}%`;
      slot.style.top = `${piece.slot.y}%`;
      slot.style.transform = `translate(-50%, -50%) rotate(${piece.angle}deg)`;
      slot.innerHTML = `
        <div class="editor-slot-angle-indicator">${piece.angle}°</div>
        <span>${idx + 1}</span>
      `;
      slot.title = `${piece.label} - 双击旋转，拖动调整位置`;

      slot.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.startSlotDrag(e, piece.id);
      });

      slot.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        this.rotateSlot(piece.id);
      });

      slot.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectPiece(piece.id);
      });

      target.appendChild(slot);
    });
  },

  rotateSlot(pieceId) {
    const piece = this.state.pieceDefs.find((p) => p.id === pieceId);
    if (piece) {
      piece.angle = (piece.angle + 45) % 360;
      this.selectedPieceId = pieceId;
      this.renderPieceList();
      this.renderSlots();
    }
  },

  startSlotDrag(e, pieceId) {
    this.draggingSlotId = pieceId;
    const slot = document.querySelector(`.editor-slot[data-piece-id="${pieceId}"]`);
    if (slot) slot.classList.add("dragging-slot");
    const rect = slot.getBoundingClientRect();
    this.dragOffset = {
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2
    };
    this.selectPiece(pieceId);
  },

  handleSlotDragMove(e) {
    if (!this.draggingSlotId) return;
    const target = document.getElementById("editorTarget");
    const targetRect = target.getBoundingClientRect();
    const x = ((e.clientX - targetRect.left) / targetRect.width) * 100;
    const y = ((e.clientY - targetRect.top) / targetRect.height) * 100;
    this.setPieceSlot(this.draggingSlotId, x, y);
  },

  handleSlotDragEnd() {
    if (!this.draggingSlotId) return;
    const slot = document.querySelector(`.editor-slot[data-piece-id="${this.draggingSlotId}"]`);
    if (slot) slot.classList.remove("dragging-slot");
    this.draggingSlotId = null;
  },

  showHint(msg) {
    const hint = document.getElementById("digHint");
    const original = hint.textContent;
    hint.textContent = msg;
    hint.style.borderLeftColor = "#a83232";
    setTimeout(() => {
      hint.textContent = original;
      hint.style.borderLeftColor = "";
    }, 2000);
  },

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.state.name || this.state.name.trim().length === 0) {
      errors.push("关卡名称不能为空");
    }
    if (!this.state.timeLimit || this.state.timeLimit < 30) {
      errors.push("倒计时不能少于 30 秒");
    }
    if (this.state.pieceDefs.length === 0) {
      errors.push("至少需要添加 1 个碎片");
    }
    if (this.state.pieceDefs.length > this.state.gridSize) {
      errors.push(`碎片数量(${this.state.pieceDefs.length})不能超过探方格数(${this.state.gridSize})`);
    }

    const usedCells = new Set();
    const usedPieceIds = new Set();
    this.state.pieceDefs.forEach((piece, idx) => {
      if (!piece.label || piece.label.trim().length === 0) {
        errors.push(`第 ${idx + 1} 个碎片的标签不能为空`);
      }
      const buriedEntry = Object.entries(this.state.buried).find(([k, v]) => v === piece.id);
      if (!buriedEntry) {
        errors.push(`「${piece.label}」还没有设置埋藏位置`);
      } else {
        if (usedCells.has(buriedEntry[0])) {
          errors.push(`多个碎片使用了同一个探方格 ${buriedEntry[0]}`);
        }
        usedCells.add(buriedEntry[0]);
        usedPieceIds.add(piece.id);
      }
      if (!piece.slot || piece.slot.x === undefined || piece.slot.y === undefined) {
        errors.push(`「${piece.label}」还没有设置目标槽位`);
      }
    });

    Object.entries(this.state.buried).forEach(([cell, pid]) => {
      if (!this.state.pieceDefs.find((p) => p.id === pid)) {
        warnings.push(`探方格 ${cell} 埋藏的碎片 ${pid} 不存在于碎片列表`);
      }
    });

    if (this.state.snapRadius < 40) {
      warnings.push("贴合半径过小，可能导致碎片难以吸附");
    }
    if (this.state.timeLimit < this.state.pieceDefs.length * 15) {
      warnings.push("倒计时可能偏短，建议给更多时间完成修复");
    }

    const duplicates = {};
    this.state.pieceDefs.forEach((p) => {
      const key = `${Math.round(p.slot.x)}_${Math.round(p.slot.y)}`;
      duplicates[key] = (duplicates[key] || 0) + 1;
    });
    Object.entries(duplicates).forEach(([k, v]) => {
      if (v > 1) {
        warnings.push(`有 ${v} 个碎片的目标槽位位置重叠，建议调整`);
      }
    });

    if (this.state.goals) {
      Object.entries(this.state.goals).forEach(([goalId, goalValue]) => {
        const goalDef = RESTORATION_GOALS[goalId];
        if (!goalDef) {
          warnings.push(`存在未知的修复目标类型：${goalId}`);
          return;
        }
        if (goalDef.checkValid && !goalDef.checkValid(goalValue)) {
          errors.push(`修复目标「${goalDef.name}」的参数无效：${goalValue}`);
        }
        if (goalId === "timeLimit" && typeof goalValue === "number" && this.state.timeLimit && goalValue > this.state.timeLimit) {
          errors.push(`修复目标「限时修复」的时间(${goalValue}秒)不能大于关卡总时长(${this.state.timeLimit}秒)`);
        }
        if (goalId === "maxDigs" && typeof goalValue === "number" && goalValue < this.state.pieceDefs.length) {
          warnings.push(`修复目标「精准挖掘」的挖掘次数(${goalValue}次)少于碎片数量(${this.state.pieceDefs.length})，可能难以达成`);
        }
      });
    }

    return { errors, warnings, valid: errors.length === 0 };
  },

  validateAndShow() {
    const result = this.validate();
    const container = document.getElementById("validationResult");
    if (result.valid) {
      container.className = "validation-result success";
      let html = "<strong>✅ 配置校验通过！</strong> 关卡已可以正常游玩。";
      if (result.warnings.length > 0) {
        html += `<br><br>💡 优化建议：<ul>`;
        result.warnings.forEach((w) => html += `<li>${w}</li>`);
        html += "</ul>";
      }
      container.innerHTML = html;
    } else {
      container.className = "validation-result error";
      let html = "<strong>❌ 存在以下问题需要修复：</strong><ul>";
      result.errors.forEach((e) => html += `<li>${e}</li>`);
      html += "</ul>";
      if (result.warnings.length > 0) {
        html += `<br>💡 优化建议：<ul>`;
        result.warnings.forEach((w) => html += `<li>${w}</li>`);
        html += "</ul>";
      }
      container.innerHTML = html;
    }
    return result;
  },

  buildTemplate() {
    return this.stateToTemplate(this.state);
  },

  stateToTemplate(state) {
    const preset = STYLE_PRESETS[state.stylePreset || "bowl"];
    const iconClassMap = {
      bowl: "bowl-icon",
      tile: "tile-icon",
      mirror: "mirror-icon",
      jade: "custom-icon"
    };

    return {
      id: state.id || ("custom_" + Date.now()),
      isCustom: true,
      name: state.name || "自定义关卡",
      pieceName: state.pieceName || "碎片",
      description: state.description || "",
      timeLimit: state.timeLimit || 120,
      difficulty: "自定义",
      snapRadius: state.snapRadius || 60,
      gridSize: state.gridSize || 25,
      iconClass: iconClassMap[state.stylePreset] || "custom-icon",
      target: {
        shape: preset.shape,
        style: preset.target
      },
      piece: {
        style: preset.piece
      },
      buried: JSON.parse(JSON.stringify(state.buried)),
      pieceDefs: JSON.parse(JSON.stringify(state.pieceDefs)),
      goals: JSON.parse(JSON.stringify(state.goals || {}))
    };
  },

  preview() {
    const validation = this.validate();
    if (!validation.valid) {
      this.validateAndShow();
      alert("请先修复配置错误后再预览试玩");
      return;
    }
    const template = this.buildTemplate();
    const tempId = "__preview__" + Date.now();
    template.id = tempId;
    artifactTemplates[tempId] = template;
    document.getElementById("levelEditor").classList.add("hidden");
    selectLevel(tempId, true);
    const origGoBack = window.__origGoBack || goBack;
    window.__origGoBack = origGoBack;
    const checkCleanup = setInterval(() => {
      if (document.getElementById("levelSelect").classList.contains("hidden") === false) {
        if (tempId.startsWith("__preview__")) {
          delete artifactTemplates[tempId];
        }
        clearInterval(checkCleanup);
        document.getElementById("levelEditor").classList.remove("hidden");
        document.getElementById("levelSelect").classList.add("hidden");
      }
    }, 200);
  },

  save() {
    const validation = this.validateAndShow();
    if (!validation.valid) {
      alert("请先修复配置错误后再保存");
      return;
    }
    const template = this.buildTemplate();
    if (this.editingLevelId) {
      template.id = this.editingLevelId;
      customLevelsStore.update(this.editingLevelId, template);
      alert("关卡更新成功！");
    } else {
      customLevelsStore.add(template);
      this.editingLevelId = template.id;
      alert("关卡保存成功！可以在关卡选择页找到它。");
    }
  },

  exportJSON() {
    const validation = this.validate();
    if (!validation.valid && !confirm("配置存在错误，确定仍然导出吗？")) return;
    const template = this.buildTemplate();
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `level_${(template.name || "custom").replace(/\s+/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importJSON(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.pieceDefs || !data.buried) {
          throw new Error("无效的关卡文件格式：缺少 pieceDefs 或 buried 字段");
        }
        const { state, issues, warnings } = this.inspectImportData(data);
        this._pendingImportState = state;
        this.showImportPreview(state, issues, warnings);
      } catch (err) {
        alert("导入失败：" + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  },

  inspectImportData(data) {
    const issues = [];
    const warnings = [];
    const validGridSizes = [16, 25, 36];
    const originalGridSize = data.gridSize;
    let gridSize = data.gridSize || 25;
    if (!validGridSizes.includes(gridSize)) {
      issues.push(`探方尺寸 ${gridSize} 不是合法值（允许 16/25/36），将自动修正为 25`);
      gridSize = 25;
      data.gridSize = 25;
    }
    const cols = Math.sqrt(gridSize);

    const stylePreset = this.inferStylePreset(data);
    const styleLabelMap = { bowl: "陶碗", tile: "瓦当", mirror: "铜镜", jade: "玉器" };

    if (data.target && data.target.style) {
      const bg = data.target.style.background;
      const matchedPreset = Object.entries(STYLE_PRESETS).find(([, v]) => v.target.background === bg);
      if (!matchedPreset) {
        warnings.push(`导入文件使用了自定义器物样式（背景色 ${bg}），将映射为最接近的「${styleLabelMap[stylePreset] || stylePreset}」样式`);
      }
    }

    const missingFields = [];
    if (!data.name) { missingFields.push("name"); data.name = ""; }
    if (!data.description) { missingFields.push("description"); data.description = ""; }
    if (!data.timeLimit) { missingFields.push("timeLimit"); data.timeLimit = 120; }
    if (!data.pieceName) { missingFields.push("pieceName"); data.pieceName = "碎片"; }
    if (!data.snapRadius) { missingFields.push("snapRadius"); data.snapRadius = 60; }
    if (!data.goals) { missingFields.push("goals"); data.goals = {}; }
    if (!data.difficulty) { missingFields.push("difficulty"); data.difficulty = "自定义"; }
    if (missingFields.length > 0) {
      warnings.push(`以下字段缺失已自动补充默认值：${missingFields.join("、")}`);
    }

    if (data.pieceDefs) {
      data.pieceDefs.forEach((piece, idx) => {
        if (!piece.id) {
          piece.id = "p" + (idx + 1);
          warnings.push(`第 ${idx + 1} 个碎片缺少 id，已自动设为 ${piece.id}`);
        }
        if (!piece.label) {
          piece.label = DEFAULT_LABELS[idx] || `碎片${idx + 1}`;
          warnings.push(`第 ${idx + 1} 个碎片缺少标签，已自动设为「${piece.label}」`);
        }
        if (piece.slot === undefined || piece.slot === null) {
          piece.slot = { x: 10 + (idx % 4) * 20, y: 10 + Math.floor(idx / 4) * 20 };
          warnings.push(`第 ${idx + 1} 个碎片「${piece.label}」缺少槽位坐标，已自动分配`);
        }
        if (piece.slot) {
          if (piece.slot.x < 0 || piece.slot.x > 100 || piece.slot.y < 0 || piece.slot.y > 100) {
            issues.push(`碎片「${piece.label}」槽位坐标 (${piece.slot.x}, ${piece.slot.y}) 越界（允许 0~100），将自动钳制`);
            piece.slot.x = Math.max(0, Math.min(100, piece.slot.x));
            piece.slot.y = Math.max(0, Math.min(100, piece.slot.y));
          }
        }
        if (piece.angle === undefined) { piece.angle = 0; }
        if (piece.initialAngle === undefined) { piece.initialAngle = 0; }
      });
    }

    if (data.buried) {
      const validPieceIds = new Set(data.pieceDefs ? data.pieceDefs.map((p) => p.id) : []);
      const burialCounts = {};
      const sizeChanged = originalGridSize !== gridSize;

      Object.entries(data.buried).forEach(([cell, pid]) => {
        const cellNum = Number(cell);
        if (isNaN(cellNum) || cellNum < 0 || cellNum >= gridSize) {
          const origHint = sizeChanged
            ? `（原尺寸 ${originalGridSize} 已修正为 ${gridSize}）`
            : "";
          issues.push(`埋藏位置 ${cell} 超出探方范围（0~${gridSize - 1}）${origHint}，该埋藏将被移除`);
          return;
        }
        if (!validPieceIds.has(pid)) {
          warnings.push(`埋藏位置 ${cell} 引用了不存在的碎片 ${pid}，该引用将被忽略`);
          return;
        }
        if (!burialCounts[cell]) burialCounts[cell] = [];
        burialCounts[cell].push(pid);
      });

      Object.entries(burialCounts).forEach(([cell, pids]) => {
        if (pids.length > 1) {
          const labels = pids.map((pid) => {
            const piece = data.pieceDefs.find((p) => p.id === pid);
            return piece ? piece.label : pid;
          });
          issues.push(`探方格 ${cell} 存在 ${pids.length} 个碎片埋藏冲突（${labels.join("、")}），仅保留最后一个`);
        }
      });

      const cleanedBuried = {};
      Object.entries(data.buried).forEach(([cell, pid]) => {
        const cellNum = Number(cell);
        if (cellNum < 0 || cellNum >= gridSize) return;
        if (!validPieceIds.has(pid)) return;
        cleanedBuried[cell] = pid;
      });
      data.buried = cleanedBuried;
    }

    data.pieceDefs.forEach((piece) => {
      const hasBuried = Object.values(data.buried).includes(piece.id);
      if (!hasBuried) {
        warnings.push(`碎片「${piece.label}」没有埋藏位置，需手动在探方编辑中设置`);
      }
    });

    if (data.goals) {
      Object.keys(data.goals).forEach((goalId) => {
        if (!RESTORATION_GOALS[goalId]) {
          warnings.push(`存在未知的修复目标类型「${goalId}」，该目标将被忽略`);
          delete data.goals[goalId];
        }
      });
    }

    const state = {
      isCustom: true,
      id: data.id,
      name: data.name || "",
      description: data.description || "",
      timeLimit: data.timeLimit || 120,
      gridSize: gridSize,
      pieceName: data.pieceName || "碎片",
      snapRadius: data.snapRadius || 60,
      stylePreset: stylePreset,
      difficulty: data.difficulty || "自定义",
      buried: data.buried || {},
      pieceDefs: data.pieceDefs || [],
      goals: data.goals || {}
    };

    return { state, issues, warnings };
  },

  showImportPreview(state, issues, warnings) {
    const styleLabelMap = { bowl: "陶碗 🍯", tile: "瓦当 🏺", mirror: "铜镜 🪞", jade: "玉器 💎" };
    const gridSize = state.gridSize;
    const cols = Math.sqrt(gridSize);

    document.getElementById("importPreviewName").textContent = state.name || "（未命名）";
    document.getElementById("importPreviewSize").textContent = `${cols} × ${cols}（${gridSize} 格）`;
    document.getElementById("importPreviewPieceCount").textContent = String(state.pieceDefs.length);
    document.getElementById("importPreviewStyle").textContent = styleLabelMap[state.stylePreset] || state.stylePreset;
    document.getElementById("importPreviewTimeLimit").textContent = `${state.timeLimit} 秒`;
    document.getElementById("importPreviewSnapRadius").textContent = String(state.snapRadius);

    const issuesEl = document.getElementById("importPreviewIssues");
    if (issues.length > 0) {
      issuesEl.innerHTML = `<div class="import-preview-section import-preview-section-error">
        <div class="import-preview-section-title">⚠️ 发现问题（已自动修正）</div>
        <ul>${issues.map((i) => `<li>${i}</li>`).join("")}</ul>
      </div>`;
    } else {
      issuesEl.innerHTML = "";
    }

    const warningsEl = document.getElementById("importPreviewWarnings");
    if (warnings.length > 0) {
      warningsEl.innerHTML = `<div class="import-preview-section import-preview-section-warn">
        <div class="import-preview-section-title">💡 提示与警告</div>
        <ul>${warnings.map((w) => `<li>${w}</li>`).join("")}</ul>
      </div>`;
    } else {
      warningsEl.innerHTML = `<div class="import-preview-section import-preview-section-ok">
        <div class="import-preview-section-title">✅ 未发现问题</div>
      </div>`;
    }

    const confirmBtn = document.getElementById("importPreviewConfirmBtn");
    if (issues.length > 0) {
      confirmBtn.textContent = "确认导入（含自动修正）";
    } else {
      confirmBtn.textContent = "确认导入";
    }

    document.getElementById("importPreviewModal").classList.remove("hidden");
  },

  hideImportPreview() {
    document.getElementById("importPreviewModal").classList.add("hidden");
    this._pendingImportState = null;
  },

  applyImportedData() {
    if (!this._pendingImportState) {
      this.hideImportPreview();
      return;
    }
    this.state = this._pendingImportState;
    this.editingLevelId = this.state.id || null;
    this.selectedPieceId = this.state.pieceDefs.length > 0 ? this.state.pieceDefs[0].id : null;
    this.syncUIFromState();
    this.renderAll();
    document.getElementById("validationResult").innerHTML = "";
    this.hideImportPreview();

    const container = document.getElementById("validationResult");
    container.className = "validation-result success";
    container.innerHTML = `<strong>✅ 关卡导入成功！</strong> 请检查配置是否正确，可点击「校验配置」验证。`;
  },

  inferStylePreset(template) {
    if (template.target && template.target.style) {
      const bg = template.target.style.background;
      if (bg === "#c28c59") return "bowl";
      if (bg === "#a08465") return "tile";
      if (bg === "#7a8b94") return "mirror";
      if (bg === "#8fbc8f") return "jade";
    }
    if (template.target && template.target.shape === "tile") return "tile";
    return "bowl";
  }
};

function renderCustomLevelCards() {
  const section = document.getElementById("customLevelsSection");
  const list = document.getElementById("customLevelList");
  const levels = customLevelsStore.getAll();

  if (levels.length === 0) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  list.innerHTML = "";
  const bestRecords = archive.getBest();

  levels.forEach((level) => {
    const wrapper = document.createElement("div");
    wrapper.className = "custom-level-card";

    const card = document.createElement("button");
    card.className = "level-card";
    card.dataset.level = level.id;

    const icon = document.createElement("div");
    icon.className = `level-icon ${level.iconClass || "custom-icon"}`;

    const best = bestRecords.find((r) => r.levelId === level.id);
    if (best && best.rating) {
      const badge = document.createElement("div");
      badge.className = `level-rating level-rating-${best.rating}`;
      badge.textContent = best.rating;
      icon.appendChild(badge);
    }

    const tag = document.createElement("span");
    tag.className = "custom-level-tag";
    tag.textContent = "自定义";
    card.appendChild(tag);

    const info = document.createElement("div");
    info.className = "level-info";
    info.innerHTML = `
      <h3>${level.name}修复</h3>
      <p>${level.pieceDefs.length} 片碎片 · ${level.timeLimit} 秒 · ${level.difficulty || "自定义"}</p>
    `;

    card.appendChild(icon);
    card.appendChild(info);
    card.addEventListener("click", () => {
      artifactTemplates[level.id] = level;
      showLevelPreview(level.id);
    });

    const actions = document.createElement("div");
    actions.className = "custom-level-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "custom-level-action-btn";
    editBtn.type = "button";
    editBtn.title = "编辑";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      editor.open(level.id);
    });
    const delBtn = document.createElement("button");
    delBtn.className = "custom-level-action-btn delete-btn";
    delBtn.type = "button";
    delBtn.title = "删除";
    delBtn.textContent = "🗑";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`确定要删除关卡「${level.name}」吗？`)) {
        customLevelsStore.delete(level.id);
        renderCustomLevelCards();
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    card.appendChild(actions);
    wrapper.appendChild(card);
    list.appendChild(wrapper);
  });
}

const _origRenderLevelCards = renderLevelCards;
renderLevelCards = function () {
  _origRenderLevelCards();
  renderCustomLevelCards();
};

const _origInit = init;
init = function () {
  _origInit();
  editor.init();
  renderCustomLevelCards();
};

const _origGoBack = goBack;
goBack = function () {
  clearInterval(timer);
  if (tutorial.active) tutorial.skip();

  if (currentTemplate && currentTemplate.startsWith("__preview__")) {
    delete artifactTemplates[currentTemplate];
    currentTemplate = null;
    currentMobileTab = "dig";
    switchMobileTab(currentMobileTab);
    document.getElementById("levelEditor").classList.remove("hidden");
    document.getElementById("levelSelect").classList.add("hidden");
    gameAreaEl.classList.add("hidden");
    resultEl.classList.add("hidden");
    backBtn.classList.add("hidden");
    levelDescriptionEl.textContent = "";
    levelDescriptionEl.classList.add("hidden");
    piecesEl.innerHTML = "";
    resetStatsDisplay();
    return;
  }

  if (currentTemplate && customLevelsStore.get(currentTemplate) && !artifactTemplates[currentTemplate]?.isDailyChallenge && !currentTemplate.startsWith("daily_")) {
    delete artifactTemplates[currentTemplate];
  }
  _origGoBack();
  renderCustomLevelCards();
};

const DAILY_CHALLENGE_STORAGE_KEY = "archaeology_daily_challenge";
const DAILY_PRACTICE_KEY = "archaeology_daily_practice";

function seededRandom(seed) {
  let hash = 0;
  const seedStr = String(seed);
  for (let i = 0; i < seedStr.length; i++) {
    const char = seedStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  let state = Math.abs(hash) || 1;
  return function() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function getDateString(date) {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createShuffledArray(rng, length) {
  const arr = [];
  for (let i = 0; i < length; i++) arr.push(i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateDailyChallenge(dateStr) {
  const seed = `wxyy_daily_${dateStr}`;
  const rng = seededRandom(seed);

  const templateIds = Object.keys(artifactTemplates).filter(id => id !== "jade");
  const baseTemplates = templateIds.map(id => artifactTemplates[id]);

  const difficultyIdx = Math.floor(rng() * baseTemplates.length);
  const baseTemplate = baseTemplates[difficultyIdx];

  const gridSize = baseTemplate.gridSize;
  const cols = Math.sqrt(gridSize);

  const pieceCount = baseTemplate.pieceDefs.length;
  const shuffledPositions = createShuffledArray(rng, gridSize);
  const buriedPositions = shuffledPositions.slice(0, pieceCount);

  const buried = {};
  const pieceDefs = [];
  for (let i = 0; i < pieceCount; i++) {
    const pieceId = `dp${i}`;
    buried[buriedPositions[i]] = pieceId;

    const baseDef = baseTemplate.pieceDefs[i];
    const angleOffset = Math.floor(rng() * 8) * 45;

    const xMin = 5;
    const xMax = 65;
    const yMin = 5;
    const yMax = 75;
    const slotX = xMin + rng() * (xMax - xMin);
    const slotY = yMin + rng() * (yMax - yMin);
    const slotAngle = Math.floor(rng() * 8) * 45;

    pieceDefs.push({
      id: pieceId,
      label: baseDef.label,
      slot: { x: slotX, y: slotY },
      angle: slotAngle,
      initialAngle: (slotAngle + angleOffset + 180) % 360
    });
  }

  const eventModifiers = {};
  Object.keys(SITE_EVENTS).forEach(eventId => {
    const baseProb = SITE_EVENTS[eventId].probability;
    const modifier = 0.7 + rng() * 0.6;
    eventModifiers[eventId] = Math.min(0.35, Math.max(0.02, baseProb * modifier));
  });

  const toolCounts = {
    probe: Math.max(1, TOOLS.probe.baseCount + Math.floor(rng() * 3) - 1),
    brush: Math.max(1, TOOLS.brush.baseCount + Math.floor(rng() * 3) - 1),
    compass: Math.max(0, TOOLS.compass.baseCount + Math.floor(rng() * 2) - 1),
    trowel: Math.max(0, TOOLS.trowel.baseCount + Math.floor(rng() * 3) - 1)
  };
  const toolPoints = calcToolkitCost(toolCounts);

  const timeModifier = 0.85 + rng() * 0.3;
  const timeLimit = Math.round(baseTemplate.timeLimit * timeModifier);

  const targetScore = Math.round(50 + rng() * 35);
  const targetRating = getRating(targetScore);

  const challengeTemplate = {
    id: `daily_${dateStr}`,
    name: `每日挑战 · ${baseTemplate.name}`,
    pieceName: baseTemplate.pieceName,
    timeLimit: timeLimit,
    difficulty: "每日挑战",
    snapRadius: baseTemplate.snapRadius,
    gridSize: gridSize,
    iconClass: baseTemplate.iconClass,
    target: JSON.parse(JSON.stringify(baseTemplate.target)),
    piece: JSON.parse(JSON.stringify(baseTemplate.piece)),
    buried: buried,
    pieceDefs: pieceDefs,
    isDailyChallenge: true,
    date: dateStr,
    eventModifiers: eventModifiers,
    toolCounts: toolCounts,
    toolPoints: toolPoints,
    targetScore: targetScore,
    targetRating: targetRating
  };

  return challengeTemplate;
}

const dailyChallengeStore = {
  load() {
    try {
      const data = localStorage.getItem(DAILY_CHALLENGE_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error("加载每日挑战记录失败:", e);
      return {};
    }
  },

  save(records) {
    try {
      localStorage.setItem(DAILY_CHALLENGE_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error("保存每日挑战记录失败:", e);
    }
  },

  getRecord(dateStr) {
    const records = this.load();
    return records[dateStr] || null;
  },

  setRecord(dateStr, record) {
    const records = this.load();
    records[dateStr] = record;
    this.save(records);
  },

  hasCompleted(dateStr) {
    const record = this.getRecord(dateStr);
    return record && record.completed;
  },

  getStreak() {
    const records = this.load();
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = getDateString(d);
      if (records[dateStr] && records[dateStr].completed) {
        streak++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }
    return streak;
  },

  getCalendarData(year, month) {
    const records = this.load();
    const calendar = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();

    for (let i = 0; i < startDay; i++) {
      calendar.push({ date: null, weekday: i });
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = getDateString(new Date(year, month, day));
      const record = records[dateStr];
      calendar.push({
        date: day,
        dateStr: dateStr,
        weekday: new Date(year, month, day).getDay(),
        completed: record && record.completed,
        rating: record ? record.rating : null,
        score: record ? record.finalScore : null
      });
    }

    return calendar;
  },

  getMonthlyStats(year, month) {
    const records = this.load();
    const lastDay = new Date(year, month + 1, 0).getDate();
    let completed = 0;
    let totalScore = 0;
    let bestScore = 0;

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = getDateString(new Date(year, month, day));
      const record = records[dateStr];
      if (record && record.completed) {
        completed++;
        totalScore += record.finalScore || 0;
        bestScore = Math.max(bestScore, record.finalScore || 0);
      }
    }

    return {
      completed,
      totalDays: lastDay,
      avgScore: completed > 0 ? Math.round(totalScore / completed) : 0,
      bestScore
    };
  }
};

let isDailyChallengeMode = false;
let isPracticeMode = false;

function getTodayChallenge() {
  const dateStr = getDateString();
  const expectedId = `daily_${dateStr}`;
  if (artifactTemplates[expectedId] && artifactTemplates[expectedId].isDailyChallenge) {
    return artifactTemplates[expectedId];
  }
  const challenge = generateDailyChallenge(dateStr);
  artifactTemplates[challenge.id] = challenge;
  return challenge;
}

function startDailyChallenge(practice, templateId = null) {
  const dateStr = getDateString();
  let challenge;

  if (templateId && artifactTemplates[templateId] && artifactTemplates[templateId].isDailyChallenge) {
    challenge = artifactTemplates[templateId];
  } else {
    const expectedId = `daily_${dateStr}`;
    if (artifactTemplates[expectedId] && artifactTemplates[expectedId].isDailyChallenge) {
      challenge = artifactTemplates[expectedId];
    } else {
      challenge = generateDailyChallenge(dateStr);
      artifactTemplates[challenge.id] = challenge;
    }
  }

  isDailyChallengeMode = true;
  isPracticeMode = practice;

  selectLevel(challenge.id);

  if (practice) {
    addLog("📝 练习模式：本次成绩不会记入每日挑战记录。");
  } else {
    if (dailyChallengeStore.hasCompleted(dateStr)) {
      addLog("⚠️ 今日已有正式成绩，本次为练习模式。");
      isPracticeMode = true;
    } else {
      addLog("🏆 每日挑战：完成后成绩将记入今日记录！");
    }
  }
}

const _origFreshStateDaily = freshState;
freshState = function() {
  const template = artifactTemplates[currentTemplate];
  if (template && template.isDailyChallenge && !isPracticeMode && template.toolCounts) {
    const savedToolkit = selectedToolkit;
    selectedToolkit = template.toolCounts;
    const state = _origFreshStateDaily();
    selectedToolkit = savedToolkit;
    state.toolPackage = { ...template.toolCounts };
    return state;
  }
  return _origFreshStateDaily();
};

const _origTryTriggerEventDaily = tryTriggerEvent;
tryTriggerEvent = function() {
  const template = artifactTemplates[currentTemplate];
  if (!template || !template.isDailyChallenge || !template.eventModifiers) {
    return _origTryTriggerEventDaily();
  }

  const events = Object.values(SITE_EVENTS);
  const availableEvents = events.filter((evt) => {
    const cooldown = state.eventCooldowns[evt.id] || 0;
    return cooldown <= 0;
  });

  for (const evt of availableEvents) {
    const prob = template.eventModifiers[evt.id] || evt.probability;
    if (Math.random() < prob) {
      const result = evt.apply(state, template);
      if (result && result.success) {
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
          showEventNotif(evt, result.message);
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
};

const _origFinishDaily = finish;
finish = function(success, message) {
  if (!state.running) return;

  const template = artifactTemplates[currentTemplate];
  const isDaily = template && template.isDailyChallenge;
  const dateStr = template ? template.date : null;

  _origFinishDaily(success, message);

  if (isDaily && success && !isPracticeMode && dateStr) {
    const scores = calculateExpertScore(template);
    const rating = getRating(scores.totalScore);
    const completeness = Math.round((state.locked.size / template.pieceDefs.length) * 100);

    if (!dailyChallengeStore.hasCompleted(dateStr)) {
      const record = {
        date: dateStr,
        completed: true,
        levelId: template.id,
        levelName: template.name,
        timeUsed: state.elapsedTime !== undefined ? state.elapsedTime : (template.timeLimit - state.timeLeft),
        digs: state.digs,
        completeness: completeness,
        finalScore: scores.totalScore,
        rating: rating,
        scores: scores,
        keyEvents: state.keyEvents,
        hintsUsed: state.hintsUsed,
        wrongAngleAttempts: state.wrongAngleAttempts,
        toolsUsed: { ...state.toolsUsed },
        completedAt: Date.now()
      };
      dailyChallengeStore.setRecord(dateStr, record);
      addLog("🎉 每日挑战完成！成绩已记录。");
    }
  }

  if (isDaily) {
    const resultSection = document.getElementById("result");
    const challengeInfo = document.createElement("div");
    challengeInfo.className = "daily-challenge-result";

    const todayRecord = dailyChallengeStore.getRecord(dateStr);
    const streak = dailyChallengeStore.getStreak();
    const targetScore = template.targetScore || 0;
    const targetRating = template.targetRating || "C";
    const scores = calculateExpertScore(template);
    const finalScore = scores.totalScore;
    const finalRating = getRating(finalScore);
    const scoreDiff = finalScore - targetScore;
    const reachedTarget = finalScore >= targetScore;
    const targetPercent = Math.min(100, Math.round((finalScore / targetScore) * 100));

    let targetHtml = `
      <div class="daily-target-section">
        <div class="daily-target-header">
          <span class="target-label">🎯 今日目标</span>
          <span class="target-rating-badge target-rating-${targetRating}">${targetRating}级 · ${targetScore}分</span>
        </div>
        <div class="daily-target-progress">
          <div class="target-progress-bar">
            <div class="target-progress-fill ${reachedTarget ? 'reached' : ''}" style="width:${targetPercent}%"></div>
            <div class="target-progress-marker" style="left:100%"></div>
          </div>
          <div class="target-score-row">
            <span class="current-score">
              <span class="score-num">${finalScore}</span>
              <span class="score-label">本次得分</span>
            </span>
            <span class="target-score">
              <span class="score-num">${targetScore}</span>
              <span class="score-label">目标分数</span>
            </span>
          </div>
        </div>
        <div class="daily-target-result">
    `;

    if (reachedTarget) {
      targetHtml += `
          <div class="target-reached">
            <span class="target-reached-icon">🎉</span>
            <span class="target-reached-text">目标达成！${scoreDiff > 0 ? `超出 ${scoreDiff} 分` : '刚好达成'}</span>
          </div>
      `;
    } else {
      targetHtml += `
          <div class="target-not-reached">
            <span class="target-not-reached-icon">💪</span>
            <span class="target-not-reached-text">还差 ${Math.abs(scoreDiff)} 分达成目标</span>
          </div>
      `;
    }

    targetHtml += `</div></div>`;

    let modeHtml = "";
    if (isPracticeMode) {
      modeHtml = `
        <div class="practice-badge">📝 练习模式</div>
        <p class="practice-note">本次为练习，不计入每日挑战成绩。</p>
      `;
    } else if (todayRecord && todayRecord.completed) {
      modeHtml = `
        <div class="streak-info">🔥 连续完成 <strong>${streak}</strong> 天</div>
        <p class="completed-note">今日挑战已完成！明天再来挑战吧。</p>
      `;
    }

    challengeInfo.innerHTML = modeHtml + targetHtml;

    resultSection.insertBefore(challengeInfo, resultSection.firstChild);
  }
};

function renderDailyChallengeCard() {
  const dateStr = getDateString();
  const challenge = getTodayChallenge();
  if (!artifactTemplates[challenge.id]) {
    artifactTemplates[challenge.id] = challenge;
  }
  const hasCompleted = dailyChallengeStore.hasCompleted(dateStr);
  const record = dailyChallengeStore.getRecord(dateStr);
  const streak = dailyChallengeStore.getStreak();

  const levelSelect = document.getElementById("levelSelect");
  const levelSelectHeader = levelSelect.querySelector(".level-select-header");
  let dailySection = document.getElementById("dailyChallengeSection");

  if (!dailySection) {
    dailySection = document.createElement("div");
    dailySection.id = "dailyChallengeSection";
    dailySection.className = "level-list-section daily-challenge-section";
    levelSelect.insertBefore(dailySection, levelSelectHeader.nextSibling);
  }

  let statusText = "今日待挑战";
  let statusClass = "pending";
  if (hasCompleted) {
    statusText = `已完成 · ${record.rating}级 · ${record.finalScore}分`;
    statusClass = "completed";
  }

  dailySection.innerHTML = `
    <h3 class="section-subtitle">
      <span class="daily-icon">🎯</span> 每日挑战
      <span class="streak-badge">🔥 连续 ${streak} 天</span>
    </h3>
    <div class="daily-challenge-card ${statusClass}">
      <div class="daily-challenge-header">
        <div class="daily-date">${dateStr}</div>
        <div class="daily-status">${statusText}</div>
      </div>
      <div class="daily-challenge-info">
        <div class="daily-level-icon level-icon ${challenge.iconClass}">
          ${hasCompleted && record.rating ? `<div class="level-rating level-rating-${record.rating}">${record.rating}</div>` : ''}
        </div>
        <div class="daily-challenge-details">
          <h4>${challenge.name}</h4>
          <p>目标评级：<strong>${challenge.targetRating}</strong> · 目标分数：<strong>${challenge.targetScore}</strong></p>
          <p>${challenge.pieceDefs.length} 片碎片 · ${challenge.timeLimit} 秒</p>
        </div>
      </div>
      <div class="daily-challenge-actions">
        <button id="startDailyBtn" type="button" class="daily-start-btn">
          ${hasCompleted ? "🔄 再练一次" : "🎮 开始挑战"}
        </button>
        <button id="viewCalendarBtn" type="button" class="daily-calendar-btn">📅 历史日历</button>
      </div>
    </div>
  `;

  const startBtn = document.getElementById("startDailyBtn");
  if (startBtn) {
    startBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showLevelPreview(challenge.id, true, hasCompleted);
    });
  }

  const dailyCard = dailySection.querySelector(".daily-challenge-card");
  if (dailyCard) {
    dailyCard.addEventListener("click", () => {
      showLevelPreview(challenge.id, true, hasCompleted);
    });
  }

  const calendarBtn = document.getElementById("viewCalendarBtn");
  if (calendarBtn) {
    calendarBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openCalendarModal();
    });
  }
}

function openCalendarModal() {
  let modal = document.getElementById("calendarModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "calendarModal";
    modal.className = "modal hidden";
    modal.innerHTML = `
      <div class="modal-content calendar-modal-content">
        <div class="modal-header">
          <h2>📅 挑战日历</h2>
          <button id="closeCalendarBtn" type="button" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="calendar-nav">
            <button id="prevMonthBtn" type="button" class="secondary-btn">← 上月</button>
            <span id="currentMonthLabel" class="current-month-label"></span>
            <button id="nextMonthBtn" type="button" class="secondary-btn">下月 →</button>
          </div>
          <div class="calendar-stats">
            <div class="calendar-stat">
              <span class="calendar-stat-label">本月完成</span>
              <span id="monthCompleted" class="calendar-stat-value">0</span>
            </div>
            <div class="calendar-stat">
              <span class="calendar-stat-label">平均分</span>
              <span id="monthAvgScore" class="calendar-stat-value">0</span>
            </div>
            <div class="calendar-stat">
              <span class="calendar-stat-label">最高分</span>
              <span id="monthBestScore" class="calendar-stat-value">0</span>
            </div>
            <div class="calendar-stat">
              <span class="calendar-stat-label">连续天数</span>
              <span id="currentStreak" class="calendar-stat-value">0</span>
            </div>
          </div>
          <div class="calendar-grid-header">
            <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
          </div>
          <div id="calendarGrid" class="calendar-grid"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("closeCalendarBtn").addEventListener("click", closeCalendarModal);
    document.getElementById("prevMonthBtn").addEventListener("click", () => {
      calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
      renderCalendar();
    });
    document.getElementById("nextMonthBtn").addEventListener("click", () => {
      calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
      renderCalendar();
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeCalendarModal();
    });
  }

  calendarCurrentDate = new Date();
  renderCalendar();
  modal.classList.remove("hidden");
}

function closeCalendarModal() {
  const modal = document.getElementById("calendarModal");
  if (modal) modal.classList.add("hidden");
}

let calendarCurrentDate = new Date();

function renderCalendar() {
  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth();

  document.getElementById("currentMonthLabel").textContent = `${year}年${month + 1}月`;

  const stats = dailyChallengeStore.getMonthlyStats(year, month);
  const streak = dailyChallengeStore.getStreak();

  document.getElementById("monthCompleted").textContent = `${stats.completed}/${stats.totalDays}`;
  document.getElementById("monthAvgScore").textContent = stats.avgScore;
  document.getElementById("monthBestScore").textContent = stats.bestScore;
  document.getElementById("currentStreak").textContent = streak;

  const calendarData = dailyChallengeStore.getCalendarData(year, month);
  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  const todayStr = getDateString();

  calendarData.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";

    if (!day.date) {
      cell.classList.add("empty");
    } else {
      cell.textContent = day.date;

      if (day.dateStr === todayStr) {
        cell.classList.add("today");
      }

      if (day.completed) {
        cell.classList.add("completed");
        if (day.rating) {
          cell.classList.add(`rating-${day.rating}`);
          const ratingBadge = document.createElement("span");
          ratingBadge.className = "calendar-rating";
          ratingBadge.textContent = day.rating;
          cell.appendChild(ratingBadge);
        }
      }

      if (day.dateStr && day.completed) {
        cell.title = `${day.dateStr} · 得分：${day.score || 0} · 评级：${day.rating || '-'}`;
      }
    }

    grid.appendChild(cell);
  });
}

const _origInitDaily = init;
init = function() {
  _origInitDaily();
  renderDailyChallengeCard();
};

const _origGoBackDaily = goBack;
goBack = function() {
  clearInterval(timer);
  if (tutorial.active) tutorial.skip();

  if (currentTemplate && artifactTemplates[currentTemplate] && artifactTemplates[currentTemplate].isDailyChallenge) {
    currentTemplate = null;
    isDailyChallengeMode = false;
    isPracticeMode = false;
    currentMobileTab = "dig";
    switchMobileTab(currentMobileTab);
    levelSelectEl.classList.remove("hidden");
    gameAreaEl.classList.add("hidden");
    resultEl.classList.add("hidden");
    backBtn.classList.add("hidden");
    levelDescriptionEl.textContent = "";
    levelDescriptionEl.classList.add("hidden");
    piecesEl.innerHTML = "";
    resetStatsDisplay();
    renderDailyChallengeCard();
    return;
  }

  if (currentTemplate && currentTemplate.startsWith("__preview__")) {
    delete artifactTemplates[currentTemplate];
    currentTemplate = null;
    currentMobileTab = "dig";
    switchMobileTab(currentMobileTab);
    document.getElementById("levelEditor").classList.remove("hidden");
    document.getElementById("levelSelect").classList.add("hidden");
    gameAreaEl.classList.add("hidden");
    resultEl.classList.add("hidden");
    backBtn.classList.add("hidden");
    levelDescriptionEl.textContent = "";
    levelDescriptionEl.classList.add("hidden");
    piecesEl.innerHTML = "";
    resetStatsDisplay();
    return;
  }

  if (currentTemplate && customLevelsStore.get(currentTemplate) && !artifactTemplates[currentTemplate]?.isDailyChallenge && !currentTemplate.startsWith("daily_")) {
    delete artifactTemplates[currentTemplate];
  }
  _origGoBackDaily();
  renderDailyChallengeCard();
};

init();
