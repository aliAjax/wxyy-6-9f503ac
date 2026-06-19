const DEFAULT_LAYER_COLORS = [
  "#d4b896",
  "#b89968",
  "#9c7856",
  "#80603f",
  "#6b4e35",
  "#5a402c"
];

const LAYER_HELPERS = {
  ensureLayers(template) {
    if (template.layers && Array.isArray(template.layers) && template.layers.length > 0) {
      return template;
    }
    const layer = {
      id: "layer_0",
      name: "文化层",
      description: "单一文化层",
      gridSize: template.gridSize || 25,
      color: DEFAULT_LAYER_COLORS[0],
      buried: JSON.parse(JSON.stringify(template.buried || {})),
      eventWeights: {}
    };
    if (template.pieceDefs) {
      template.pieceDefs.forEach(p => {
        p.layerId = "layer_0";
      });
    }
    template.layers = [layer];
    template.currentLayerId = "layer_0";
    return template;
  },

  getLayers(template) {
    this.ensureLayers(template);
    return template.layers;
  },

  getLayer(template, layerId) {
    const layers = this.getLayers(template);
    return layers.find(l => l.id === layerId) || layers[0];
  },

  getLayerIndex(template, layerId) {
    const layers = this.getLayers(template);
    return layers.findIndex(l => l.id === layerId);
  },

  getCurrentLayer(template, currentLayerId) {
    return this.getLayer(template, currentLayerId || template.currentLayerId);
  },

  getLayerBuried(template, layerId) {
    const layer = this.getLayer(template, layerId);
    return layer.buried || {};
  },

  getLayerGridSize(template, layerId) {
    const layer = this.getLayer(template, layerId);
    return layer.gridSize || template.gridSize || 25;
  },

  getLayerPieces(template, layerId) {
    const pieces = template.pieceDefs || [];
    if (!layerId) return pieces;
    return pieces.filter(p => p.layerId === layerId);
  },

  isLayerCleared(template, layerId, dugSet) {
    const buried = this.getLayerBuried(template, layerId);
    const pieceIndices = Object.keys(buried).map(Number);
    return pieceIndices.every(idx => dugSet.has(idx));
  },

  isLayerAccessible(template, layerId, layerDugMap) {
    const layers = this.getLayers(template);
    const idx = layers.findIndex(l => l.id === layerId);
    if (idx <= 0) return true;
    const prevLayer = layers[idx - 1];
    return this.isLayerCleared(template, prevLayer.id, layerDugMap.get(prevLayer.id) || new Set());
  },

  getEventProbability(template, layerId, eventId, baseProbability) {
    const layer = this.getLayer(template, layerId);
    if (layer.eventWeights && layer.eventWeights[eventId] !== undefined) {
      const weight = layer.eventWeights[eventId];
      return Math.max(0, Math.min(1, baseProbability * weight));
    }
    return baseProbability;
  },

  isPieceAccessible(template, pieceDef, layerDugMap) {
    if (!pieceDef.layerId) return true;
    return this.isLayerAccessible(template, pieceDef.layerId, layerDugMap);
  },

  mergeBuriedFromLayers(template) {
    const layers = this.getLayers(template);
    const merged = {};
    layers.forEach(layer => {
      Object.assign(merged, layer.buried || {});
    });
    return merged;
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

function validateLevel(state) {
  const errors = [];
  const warnings = [];

  if (!state.name || state.name.trim().length === 0) {
    errors.push("关卡名称不能为空");
  }
  if (!state.timeLimit || state.timeLimit < 30) {
    errors.push("倒计时不能少于 30 秒");
  }
  if (state.pieceDefs.length === 0) {
    errors.push("至少需要添加 1 个碎片");
  }

  const hasLayers = state.layers && state.layers.length > 0;
  const allBuried = {};
  const allLayerSizes = {};
  if (hasLayers) {
    state.layers.forEach((layer, lIdx) => {
      if (!layer.name || layer.name.trim().length === 0) {
        errors.push(`第 ${lIdx + 1} 个地层的名称不能为空`);
      }
      const size = layer.gridSize || state.gridSize || 25;
      allLayerSizes[layer.id] = size;
      Object.entries(layer.buried || {}).forEach(([k, v]) => {
        allBuried[v] = { cell: k, layerId: layer.id, layerIdx: lIdx };
      });
      const cellSet = new Set();
      Object.keys(layer.buried || {}).forEach(k => {
        const n = Number(k);
        if (n < 0 || n >= size) {
          errors.push(`第 ${lIdx + 1} 层「${layer.name}」的探方格 ${k} 超出该层探方尺寸范围 (${size})`);
        }
        if (cellSet.has(k)) {
          errors.push(`第 ${lIdx + 1} 层「${layer.name}」的探方格 ${k} 重复使用`);
        }
        cellSet.add(k);
      });
    });
    const totalLayerSize = Object.values(allLayerSizes).reduce((s, v) => s + v, 0);
    if (state.pieceDefs.length > totalLayerSize) {
      errors.push(`碎片数量(${state.pieceDefs.length})不能超过所有地层探方总格数(${totalLayerSize})`);
    }
  } else {
    if (state.pieceDefs.length > state.gridSize) {
      errors.push(`碎片数量(${state.pieceDefs.length})不能超过探方格数(${state.gridSize})`);
    }
    Object.entries(state.buried).forEach(([k, v]) => {
      allBuried[v] = { cell: k };
    });
  }

  const usedCells = new Set();
  const usedPieceIds = new Set();
  state.pieceDefs.forEach((piece, idx) => {
    if (!piece.label || piece.label.trim().length === 0) {
      errors.push(`第 ${idx + 1} 个碎片的标签不能为空`);
    }
    const buriedInfo = allBuried[piece.id];
    if (!buriedInfo) {
      errors.push(`「${piece.label}」还没有设置埋藏位置`);
    } else {
      const cellKey = buriedInfo.layerId ? `${buriedInfo.layerId}:${buriedInfo.cell}` : buriedInfo.cell;
      if (usedCells.has(cellKey)) {
        errors.push(`多个碎片使用了同一个探方格 ${buriedInfo.cell}`);
      }
      usedCells.add(cellKey);
      usedPieceIds.add(piece.id);
    }
    if (!piece.slot || piece.slot.x === undefined || piece.slot.y === undefined) {
      errors.push(`「${piece.label}」还没有设置目标槽位`);
    }
  });

  const checkOrphanBuried = (buriedObj, prefix = "") => {
    Object.entries(buriedObj).forEach(([cell, pid]) => {
      if (!state.pieceDefs.find((p) => p.id === pid)) {
        warnings.push(`${prefix}探方格 ${cell} 埋藏的碎片 ${pid} 不存在于碎片列表`);
      }
    });
  };
  if (hasLayers) {
    state.layers.forEach((layer, lIdx) => {
      checkOrphanBuried(layer.buried || {}, `第 ${lIdx + 1} 层「${layer.name}」`);
    });
  } else {
    checkOrphanBuried(state.buried);
  }

  if (state.snapRadius < 40) {
    warnings.push("贴合半径过小，可能导致碎片难以吸附");
  }
  if (state.timeLimit < state.pieceDefs.length * 15) {
    warnings.push("倒计时可能偏短，建议给更多时间完成修复");
  }

  const duplicates = {};
  state.pieceDefs.forEach((p) => {
    if (p.slot && p.slot.x !== undefined && p.slot.y !== undefined) {
      const key = `${Math.round(p.slot.x)}_${Math.round(p.slot.y)}`;
      duplicates[key] = (duplicates[key] || 0) + 1;
    }
  });
  Object.entries(duplicates).forEach(([k, v]) => {
    if (v > 1) {
      warnings.push(`有 ${v} 个碎片的目标槽位位置重叠，建议调整`);
    }
  });

  if (state.goals) {
    Object.entries(state.goals).forEach(([goalId, goalValue]) => {
      const goalDef = RESTORATION_GOALS[goalId];
      if (!goalDef) {
        warnings.push(`存在未知的修复目标类型：${goalId}`);
        return;
      }
      if (goalDef.checkValid && !goalDef.checkValid(goalValue)) {
        errors.push(`修复目标「${goalDef.name}」的参数无效：${goalValue}`);
      }
      if (goalId === "timeLimit" && typeof goalValue === "number" && state.timeLimit && goalValue > state.timeLimit) {
        errors.push(`修复目标「限时修复」的时间(${goalValue}秒)不能大于关卡总时长(${state.timeLimit}秒)`);
      }
      if (goalId === "maxDigs" && typeof goalValue === "number" && goalValue < state.pieceDefs.length) {
        warnings.push(`修复目标「精准挖掘」的挖掘次数(${goalValue}次)少于碎片数量(${state.pieceDefs.length})，可能难以达成`);
      }
    });
  }

  return { errors, warnings, valid: errors.length === 0 };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DEFAULT_LAYER_COLORS,
    LAYER_HELPERS,
    RESTORATION_GOALS,
    getRating,
    getCommentary,
    getScoreColor,
    evaluateGoals,
    getGoalsSummary,
    validateLevel
  };
}
