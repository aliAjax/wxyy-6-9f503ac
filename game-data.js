const ARCHIVE_STORAGE_KEY = "archaeology_archive_records";
const TUTORIAL_STORAGE_KEY = "archaeology_tutorial_done";
const SETTINGS_STORAGE_KEY = "archaeology_game_settings";
const CUSTOM_LEVELS_STORAGE_KEY = "archaeology_custom_levels";
const DAILY_CHALLENGE_STORAGE_KEY = "archaeology_daily_challenge";
const DAILY_PRACTICE_KEY = "archaeology_daily_practice";

const RATING_ORDER = { S: 5, A: 4, B: 3, C: 2, D: 1, F: 0 };

const SEEDED_RANDOM = {
  _seed: 1,
  init(seed) {
    this._seed = seed || Math.floor(Math.random() * 2147483647);
    return this._seed;
  },
  next() {
    this._seed = (this._seed * 1664525 + 1013904223) >>> 0;
    return this._seed / 0x100000000;
  },
  range(min, max) {
    return min + this.next() * (max - min);
  },
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  },
  getState() {
    return this._seed;
  },
  setState(state) {
    this._seed = state >>> 0;
  }
};

const TIMELINE_EVENT_TYPES = {
  DIG: "dig",
  TOOL_USE: "tool",
  EVENT_TRIGGER: "event",
  PIECE_SPAWN: "spawn",
  PIECE_DRAG: "drag",
  PIECE_ROTATE: "rotate",
  PIECE_SNAP: "snap",
  HINT_USE: "hint",
  GAME_START: "start",
  GAME_END: "end"
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
        pi => !state.dug.has(pi) && !state.found.has(template.buried[pi])
      ).length;
      let lockCount = Math.min(2, lockable.length);
      if (lockable.length > 0 && remainingPieces > 2) {
        const actualLock = [];
        for (let i = 0; i < lockCount; i++) {
          if (lockable.length === 0) break;
          const idx = SEEDED_RANDOM.int(0, lockable.length - 1);
          actualLock.push(lockable.splice(idx, 1)[0]);
        }
        actualLock.forEach(i => state.lockedCells.add(i));
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
      const hiddenPieces = pieceIndices.filter(i => !state.dug.has(i) && !state.hintedCells.has(i));
      if (hiddenPieces.length > 0) {
        const targetIdx = hiddenPieces[SEEDED_RANDOM.int(0, hiddenPieces.length - 1)];
        state.hintedCells.add(targetIdx);
        const def = template.pieceDefs.find(p => p.id === template.buried[targetIdx]);
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
      const currentLayerId = state.currentLayerId;
      const buried = LAYER_HELPERS.getLayerBuried(template, currentLayerId);
      const pieceIndices = Object.keys(buried).map(Number);
      const hidden = pieceIndices.filter(i => !state.dug.has(i) && !state.probeHints.has(i));
      if (hidden.length === 0) {
        const layers = LAYER_HELPERS.getLayers(template);
        let hasHidden = false;
        for (const layer of layers) {
          if (!LAYER_HELPERS.isLayerAccessible(template, layer.id, state.layerDug)) break;
          const lBuried = LAYER_HELPERS.getLayerBuried(template, layer.id);
          const lDug = state.layerDug.get(layer.id) || new Set();
          const lProbe = state.layerProbeHints.get(layer.id) || new Set();
          const lHidden = Object.keys(lBuried)
            .map(Number)
            .filter(i => !lDug.has(i) && !lProbe.has(i));
          if (lHidden.length > 0) {
            hasHidden = true;
            break;
          }
        }
        if (!hasHidden) return { ok: false, reason: "没有可探测的碎片" };
        return { ok: true, _needSwitchLayer: true };
      }
      return { ok: true };
    },
    use(state, template) {
      let currentLayerId = state.currentLayerId;
      let buried = LAYER_HELPERS.getLayerBuried(template, currentLayerId);
      let pieceIndices = Object.keys(buried).map(Number);
      let hidden = pieceIndices.filter(i => !state.dug.has(i) && !state.probeHints.has(i));

      if (hidden.length === 0) {
        const layers = LAYER_HELPERS.getLayers(template);
        for (const layer of layers) {
          if (!LAYER_HELPERS.isLayerAccessible(template, layer.id, state.layerDug)) break;
          const lBuried = LAYER_HELPERS.getLayerBuried(template, layer.id);
          const lDug = state.layerDug.get(layer.id) || new Set();
          const lProbe = state.layerProbeHints.get(layer.id) || new Set();
          const lHidden = Object.keys(lBuried)
            .map(Number)
            .filter(i => !lDug.has(i) && !lProbe.has(i));
          if (lHidden.length > 0) {
            currentLayerId = layer.id;
            buried = lBuried;
            pieceIndices = Object.keys(buried).map(Number);
            hidden = lHidden;
            state.currentLayerId = currentLayerId;
            state.dug = state.layerDug.get(currentLayerId);
            state.lockedCells = state.layerLockedCells.get(currentLayerId);
            state.hintedCells = state.layerHintedCells.get(currentLayerId);
            state.probeHints = state.layerProbeHints.get(currentLayerId);
            break;
          }
        }
      }

      const targetIdx = hidden[SEEDED_RANDOM.int(0, hidden.length - 1)];
      const cols = Math.sqrt(LAYER_HELPERS.getLayerGridSize(template, currentLayerId));
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
      const def = template.pieceDefs.find(p => p.id === buried[targetIdx]);
      const layerName = LAYER_HELPERS.getLayer(template, currentLayerId).name;
      return {
        success: true,
        message: `探针探测（${layerName}）：${def ? def.label : "某件"}${template.pieceName}位于第${row + 1}行第${col + 1}列附近区域，已高亮 ${areaCells.length} 格。`,
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
      const gridSize = LAYER_HELPERS.getLayerGridSize(template, state.currentLayerId);
      const undug = [];
      for (let i = 0; i < gridSize; i++) {
        if (!state.dug.has(i) && !state.lockedCells.has(i)) undug.push(i);
      }
      if (undug.length === 0) return { ok: false, reason: "当前层没有可清理的格子" };
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
      const gridSize = LAYER_HELPERS.getLayerGridSize(template, state.currentLayerId);
      const undug = [];
      for (let i = 0; i < gridSize; i++) {
        if (!state.dug.has(i) && !state.lockedCells.has(i)) undug.push(i);
      }
      if (undug.length === 0) return { ok: false, reason: "当前层没有可挖掘的格子" };
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

const TOOL_NAMES = {
  probe: { name: "探针", icon: "📍" },
  brush: { name: "刷子", icon: "🖌️" },
  compass: { name: "罗盘", icon: "🧭" },
  trowel: { name: "小手铲", icon: "🔧" }
};

const LEVEL_CATEGORY = {
  OFFICIAL: "official",
  CUSTOM: "custom",
  DAILY: "daily",
  UNKNOWN: "unknown"
};

function getLevelCategory(levelId) {
  if (!levelId) return LEVEL_CATEGORY.UNKNOWN;
  if (levelId.startsWith("daily_")) return LEVEL_CATEGORY.DAILY;
  if (levelId.startsWith("custom_")) return LEVEL_CATEGORY.CUSTOM;
  if (artifactTemplates[levelId]) return LEVEL_CATEGORY.OFFICIAL;
  return LEVEL_CATEGORY.UNKNOWN;
}

function getCategoryLabel(category) {
  const map = {
    [LEVEL_CATEGORY.OFFICIAL]: "官方关卡",
    [LEVEL_CATEGORY.CUSTOM]: "自定义关卡",
    [LEVEL_CATEGORY.DAILY]: "每日挑战",
    [LEVEL_CATEGORY.UNKNOWN]: "未知"
  };
  return map[category] || "未知";
}

function calculateLevelStats(records) {
  if (!records || records.length === 0) return null;

  const validRecords = records.filter(r => r && r.completedAt);
  if (validRecords.length === 0) return null;

  const totalCompletions = validRecords.length;

  let bestRating = null;
  let bestRatingOrder = -1;
  let bestScore = null;
  let totalTime = 0;
  let timeCount = 0;
  let totalDigs = 0;
  let digsCount = 0;

  const toolUsageCount = { probe: 0, brush: 0, compass: 0, trowel: 0 };
  const eventCountMap = {};

  for (const record of validRecords) {
    const ratingOrder = RATING_ORDER[record.rating] || 0;
    if (ratingOrder > bestRatingOrder) {
      bestRatingOrder = ratingOrder;
      bestRating = record.rating;
    }

    const score = record.finalScore !== undefined ? record.finalScore : record.completeness || 0;
    if (bestScore === null || score > bestScore) {
      bestScore = score;
    }

    if (record.timeUsed !== undefined && record.timeUsed !== null) {
      totalTime += record.timeUsed;
      timeCount++;
    }

    if (record.digs !== undefined && record.digs !== null) {
      totalDigs += record.digs;
      digsCount++;
    }

    if (record.toolsUsed) {
      for (const tool of ["probe", "brush", "compass", "trowel"]) {
        if (record.toolsUsed[tool] !== undefined && record.toolsUsed[tool] > 0) {
          toolUsageCount[tool] += record.toolsUsed[tool];
        }
      }
    }

    if (record.keyEvents && Array.isArray(record.keyEvents)) {
      for (const event of record.keyEvents) {
        const eventName = event.name || event;
        eventCountMap[eventName] = (eventCountMap[eventName] || 0) + 1;
      }
    }
  }

  const avgTime = timeCount > 0 ? Math.round(totalTime / timeCount) : null;
  const avgDigs = digsCount > 0 ? Math.round(totalDigs / digsCount) : null;

  const sortedTools = Object.entries(toolUsageCount)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const mostUsedTool = sortedTools.length > 0 ? sortedTools[0] : null;

  const sortedEvents = Object.entries(eventCountMap).sort((a, b) => b[1] - a[1]);
  const mostCommonEvent = sortedEvents.length > 0 ? sortedEvents[0] : null;

  return {
    totalCompletions,
    bestRating,
    bestScore,
    avgTime,
    avgDigs,
    mostUsedTool,
    mostCommonEvent,
    toolBreakdown: toolUsageCount,
    eventBreakdown: eventCountMap
  };
}

function calculateOverallStats(records, filter = "all") {
  let filteredRecords = records || [];

  if (filter !== "all") {
    filteredRecords = filteredRecords.filter(r => getLevelCategory(r.levelId) === filter);
  }

  const totalCompletions = filteredRecords.length;
  const uniqueLevels = new Set(filteredRecords.map(r => r.levelId)).size;

  const recordsByLevel = {};
  for (const record of filteredRecords) {
    if (!recordsByLevel[record.levelId]) {
      recordsByLevel[record.levelId] = [];
    }
    recordsByLevel[record.levelId].push(record);
  }

  let totalTime = 0;
  let timeCount = 0;
  let totalDigs = 0;
  let digsCount = 0;
  let totalScore = 0;
  let scoreCount = 0;
  let sCount = 0;
  let aCount = 0;

  for (const record of filteredRecords) {
    if (record.timeUsed !== undefined && record.timeUsed !== null) {
      totalTime += record.timeUsed;
      timeCount++;
    }
    if (record.digs !== undefined && record.digs !== null) {
      totalDigs += record.digs;
      digsCount++;
    }
    if (record.finalScore !== undefined) {
      totalScore += record.finalScore;
      scoreCount++;
    } else if (record.completeness !== undefined) {
      totalScore += record.completeness;
      scoreCount++;
    }
    if (record.rating === "S") sCount++;
    else if (record.rating === "A") aCount++;
  }

  const levelStatsList = [];
  for (const [levelId, levelRecords] of Object.entries(recordsByLevel)) {
    const stats = calculateLevelStats(levelRecords);
    if (stats) {
      const sampleRecord = levelRecords[0];
      levelStatsList.push({
        levelId,
        levelName: sampleRecord.levelName || levelId,
        category: getLevelCategory(levelId),
        ...stats
      });
    }
  }

  levelStatsList.sort((a, b) => b.totalCompletions - a.totalCompletions);

  return {
    totalCompletions,
    uniqueLevels,
    avgTime: timeCount > 0 ? Math.round(totalTime / timeCount) : null,
    avgDigs: digsCount > 0 ? Math.round(totalDigs / digsCount) : null,
    avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : null,
    sCount,
    aCount,
    levelStatsList
  };
}

function calculateLayerAccuracy(template, gameState) {
  const layers = LAYER_HELPERS.getLayers(template);
  const layerResults = [];
  let totalCorrectPieces = 0;
  let totalExpectedPieces = 0;
  let weightedLayerScore = 0;
  let totalWeight = 0;

  layers.forEach((layer, idx) => {
    const buried = LAYER_HELPERS.getLayerBuried(template, layer.id);
    const expectedPieces = Object.keys(buried).length;
    const record = gameState.layerRecords[layer.id] || { correctDigs: 0, totalDigs: 0, pieces: [] };
    const foundInLayer = record.pieces.length;
    const correctInLayer = Math.min(foundInLayer, expectedPieces);
    const accuracy = expectedPieces > 0 ? Math.round((correctInLayer / expectedPieces) * 100) : 100;
    const digEfficiency =
      record.totalDigs > 0
        ? Math.round(Math.max(0, 100 - Math.max(0, record.totalDigs - expectedPieces) * 15))
        : 100;
    const layerScore = Math.round((accuracy + digEfficiency) / 2);
    const weight = idx + 1;

    totalCorrectPieces += correctInLayer;
    totalExpectedPieces += expectedPieces;
    weightedLayerScore += layerScore * weight;
    totalWeight += weight;

    layerResults.push({
      layerId: layer.id,
      layerName: layer.name,
      layerColor: layer.color || DEFAULT_LAYER_COLORS[idx],
      expectedPieces,
      foundPieces: foundInLayer,
      totalDigs: record.totalDigs,
      accuracy,
      digEfficiency,
      layerScore
    });
  });

  const overallLayerAccuracy =
    totalExpectedPieces > 0 ? Math.round((totalCorrectPieces / totalExpectedPieces) * 100) : 100;
  const weightedAvgLayerScore =
    totalWeight > 0 ? Math.round(weightedLayerScore / totalWeight) : 100;

  return {
    layerResults,
    overallLayerAccuracy,
    weightedAvgLayerScore,
    isMultiLayer: layers.length > 1
  };
}

function calculateExpertScore(template, gameState) {
  const pieceCount = template.pieceDefs.length;
  const timeRatio = gameState.timeLeft / template.timeLimit;
  const timeScore = Math.round(Math.min(100, timeRatio * 200));
  const digScore = Math.round(Math.max(0, 100 - Math.max(0, gameState.digs - pieceCount) * 10));
  const angleScore = Math.round(Math.max(0, 100 - gameState.wrongAngleAttempts * 15));
  const negativeCount = gameState.triggeredEvents.filter(e => e.type === "negative").length;
  const positiveCount = gameState.triggeredEvents.filter(e => e.type === "positive").length;
  const eventScore = Math.round(
    Math.max(0, Math.min(100, 60 - negativeCount * 12 + positiveCount * 8))
  );
  const hintScore =
    gameState.hintsUsed === 0 ? 100 : Math.round(Math.max(0, 100 - gameState.hintsUsed * 30));
  const toolPenalty =
    gameState.toolsUsed.probe * 15 +
    gameState.toolsUsed.brush * 10 +
    gameState.toolsUsed.compass * 20 +
    (gameState.toolsUsed.trowel || 0) * 12;
  const toolScore = Math.round(Math.max(0, 100 - toolPenalty));

  const layerAccuracy = calculateLayerAccuracy(template, gameState);
  const layerScore = layerAccuracy.weightedAvgLayerScore;

  let totalScore;
  if (layerAccuracy.isMultiLayer) {
    totalScore = Math.round(
      (timeScore + digScore + angleScore + eventScore + hintScore + toolScore + layerScore) / 7
    );
  } else {
    totalScore = Math.round(
      (timeScore + digScore + angleScore + eventScore + hintScore + toolScore) / 6
    );
  }
  return {
    timeScore,
    digScore,
    angleScore,
    eventScore,
    hintScore,
    toolScore,
    layerScore,
    layerAccuracy,
    totalScore
  };
}

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
  "顶部",
  "底部",
  "左侧",
  "右侧",
  "左上",
  "右上",
  "左下",
  "右下",
  "中心",
  "顶部左",
  "顶部右",
  "底部左",
  "底部右"
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ARCHIVE_STORAGE_KEY,
    TUTORIAL_STORAGE_KEY,
    SETTINGS_STORAGE_KEY,
    CUSTOM_LEVELS_STORAGE_KEY,
    DAILY_CHALLENGE_STORAGE_KEY,
    DAILY_PRACTICE_KEY,
    RATING_ORDER,
    SEEDED_RANDOM,
    TIMELINE_EVENT_TYPES,
    SITE_EVENTS,
    TOOLS,
    TOOL_NAMES,
    LEVEL_CATEGORY,
    getLevelCategory,
    getCategoryLabel,
    calculateLevelStats,
    calculateOverallStats,
    calculateLayerAccuracy,
    calculateExpertScore,
    STYLE_PRESETS,
    DEFAULT_LABELS
  };
}
