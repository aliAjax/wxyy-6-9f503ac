const {
  LAYER_HELPERS,
  RESTORATION_GOALS,
  getRating,
  getCommentary,
  getScoreColor,
  evaluateGoals,
  getGoalsSummary,
  validateLevel,
  DEFAULT_LAYER_COLORS
} = require("../core.js");

describe("LAYER_HELPERS - 文化层辅助函数", () => {
  describe("ensureLayers - 确保图层结构", () => {
    it("应为没有layers的模板创建默认单层结构", () => {
      const template = {
        gridSize: 25,
        buried: { 2: "p1", 7: "p2" },
        pieceDefs: [
          { id: "p1", label: "碎片1" },
          { id: "p2", label: "碎片2" }
        ]
      };
      const result = LAYER_HELPERS.ensureLayers(template);
      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].id).toBe("layer_0");
      expect(result.layers[0].name).toBe("文化层");
      expect(result.layers[0].gridSize).toBe(25);
      expect(result.layers[0].color).toBe(DEFAULT_LAYER_COLORS[0]);
      expect(result.currentLayerId).toBe("layer_0");
    });

    it("应将pieceDefs的layerId设置为默认层", () => {
      const template = {
        gridSize: 25,
        buried: { 2: "p1" },
        pieceDefs: [{ id: "p1", label: "碎片1" }]
      };
      LAYER_HELPERS.ensureLayers(template);
      expect(template.pieceDefs[0].layerId).toBe("layer_0");
    });

    it("不应修改已有layers的模板", () => {
      const template = {
        layers: [
          { id: "layer_0", name: "旧石器时代", gridSize: 25, buried: { 2: "p1" } },
          { id: "layer_1", name: "新石器时代", gridSize: 25, buried: { 5: "p2" } }
        ]
      };
      const originalLayers = JSON.parse(JSON.stringify(template.layers));
      const result = LAYER_HELPERS.ensureLayers(template);
      expect(result.layers).toEqual(originalLayers);
    });

    it("应为空buried创建空对象", () => {
      const template = {
        gridSize: 25,
        pieceDefs: []
      };
      LAYER_HELPERS.ensureLayers(template);
      expect(template.layers[0].buried).toEqual({});
    });
  });

  describe("getLayers - 获取图层列表", () => {
    it("应确保图层存在后返回", () => {
      const template = { gridSize: 25, buried: {} };
      const layers = LAYER_HELPERS.getLayers(template);
      expect(layers).toHaveLength(1);
    });

    it("应返回已有的图层列表", () => {
      const template = {
        layers: [
          { id: "layer_0", name: "层1", gridSize: 25, buried: {} },
          { id: "layer_1", name: "层2", gridSize: 25, buried: {} }
        ]
      };
      const layers = LAYER_HELPERS.getLayers(template);
      expect(layers).toHaveLength(2);
    });
  });

  describe("getLayer - 获取指定图层", () => {
    it("应返回指定ID的图层", () => {
      const template = {
        layers: [
          { id: "layer_0", name: "层1", gridSize: 25, buried: {} },
          { id: "layer_1", name: "层2", gridSize: 25, buried: {} }
        ]
      };
      const layer = LAYER_HELPERS.getLayer(template, "layer_1");
      expect(layer.id).toBe("layer_1");
      expect(layer.name).toBe("层2");
    });

    it("找不到时应返回第一个图层", () => {
      const template = {
        layers: [
          { id: "layer_0", name: "层1", gridSize: 25, buried: {} },
          { id: "layer_1", name: "层2", gridSize: 25, buried: {} }
        ]
      };
      const layer = LAYER_HELPERS.getLayer(template, "non_existent");
      expect(layer.id).toBe("layer_0");
    });
  });

  describe("getLayerIndex - 获取图层索引", () => {
    it("应返回正确的索引", () => {
      const template = {
        layers: [
          { id: "layer_0", name: "层1", gridSize: 25, buried: {} },
          { id: "layer_1", name: "层2", gridSize: 25, buried: {} }
        ]
      };
      expect(LAYER_HELPERS.getLayerIndex(template, "layer_0")).toBe(0);
      expect(LAYER_HELPERS.getLayerIndex(template, "layer_1")).toBe(1);
    });

    it("找不到时应返回-1", () => {
      const template = {
        layers: [{ id: "layer_0", name: "层1", gridSize: 25, buried: {} }]
      };
      expect(LAYER_HELPERS.getLayerIndex(template, "non_existent")).toBe(-1);
    });
  });

  describe("getLayerBuried - 获取图层埋藏", () => {
    it("应返回图层的buried对象", () => {
      const template = {
        layers: [{ id: "layer_0", name: "层1", gridSize: 25, buried: { 2: "p1", 5: "p2" } }]
      };
      const buried = LAYER_HELPERS.getLayerBuried(template, "layer_0");
      expect(buried).toEqual({ 2: "p1", 5: "p2" });
    });

    it("buried不存在时应返回空对象", () => {
      const template = {
        layers: [{ id: "layer_0", name: "层1", gridSize: 25 }]
      };
      const buried = LAYER_HELPERS.getLayerBuried(template, "layer_0");
      expect(buried).toEqual({});
    });
  });

  describe("getLayerGridSize - 获取图层网格尺寸", () => {
    it("应返回图层自身的gridSize", () => {
      const template = {
        gridSize: 25,
        layers: [{ id: "layer_0", name: "层1", gridSize: 36, buried: {} }]
      };
      expect(LAYER_HELPERS.getLayerGridSize(template, "layer_0")).toBe(36);
    });

    it("图层没有gridSize时应返回模板的gridSize", () => {
      const template = {
        gridSize: 25,
        layers: [{ id: "layer_0", name: "层1", buried: {} }]
      };
      expect(LAYER_HELPERS.getLayerGridSize(template, "layer_0")).toBe(25);
    });

    it("都没有时应返回默认值25", () => {
      const template = {
        layers: [{ id: "layer_0", name: "层1", buried: {} }]
      };
      expect(LAYER_HELPERS.getLayerGridSize(template, "layer_0")).toBe(25);
    });
  });

  describe("getLayerPieces - 获取图层碎片", () => {
    it("应返回指定图层的碎片", () => {
      const template = {
        pieceDefs: [
          { id: "p1", label: "碎片1", layerId: "layer_0" },
          { id: "p2", label: "碎片2", layerId: "layer_1" },
          { id: "p3", label: "碎片3", layerId: "layer_0" }
        ]
      };
      const pieces = LAYER_HELPERS.getLayerPieces(template, "layer_0");
      expect(pieces).toHaveLength(2);
      expect(pieces[0].id).toBe("p1");
      expect(pieces[1].id).toBe("p3");
    });

    it("不指定layerId时应返回所有碎片", () => {
      const template = {
        pieceDefs: [
          { id: "p1", label: "碎片1", layerId: "layer_0" },
          { id: "p2", label: "碎片2", layerId: "layer_1" }
        ]
      };
      const pieces = LAYER_HELPERS.getLayerPieces(template);
      expect(pieces).toHaveLength(2);
    });

    it("pieceDefs不存在时应返回空数组", () => {
      const template = {};
      const pieces = LAYER_HELPERS.getLayerPieces(template, "layer_0");
      expect(pieces).toEqual([]);
    });
  });

  describe("isLayerCleared - 判断图层是否清理完成", () => {
    it("所有埋藏碎片都已挖掘时应返回true", () => {
      const template = {
        layers: [
          { id: "layer_0", name: "层1", gridSize: 25, buried: { 2: "p1", 5: "p2", 8: "p3" } }
        ]
      };
      const dugSet = new Set([2, 5, 8]);
      expect(LAYER_HELPERS.isLayerCleared(template, "layer_0", dugSet)).toBe(true);
    });

    it("有碎片未挖掘时应返回false", () => {
      const template = {
        layers: [
          { id: "layer_0", name: "层1", gridSize: 25, buried: { 2: "p1", 5: "p2", 8: "p3" } }
        ]
      };
      const dugSet = new Set([2, 5]);
      expect(LAYER_HELPERS.isLayerCleared(template, "layer_0", dugSet)).toBe(false);
    });

    it("空buried时应返回true", () => {
      const template = {
        layers: [{ id: "layer_0", name: "层1", gridSize: 25, buried: {} }]
      };
      const dugSet = new Set();
      expect(LAYER_HELPERS.isLayerCleared(template, "layer_0", dugSet)).toBe(true);
    });
  });

  describe("isLayerAccessible - 判断图层是否可访问（多文化层解锁）", () => {
    const multiLayerTemplate = {
      layers: [
        { id: "layer_0", name: "旧石器时代", gridSize: 25, buried: { 2: "p1", 5: "p2" } },
        { id: "layer_1", name: "新石器时代", gridSize: 25, buried: { 3: "p3", 7: "p4" } },
        { id: "layer_2", name: "青铜时代", gridSize: 25, buried: { 1: "p5", 9: "p6" } }
      ]
    };

    it("第一层始终可访问", () => {
      const layerDugMap = new Map();
      layerDugMap.set("layer_0", new Set());
      expect(LAYER_HELPERS.isLayerAccessible(multiLayerTemplate, "layer_0", layerDugMap)).toBe(
        true
      );
    });

    it("上一层未清理完成时，下一层不可访问", () => {
      const layerDugMap = new Map();
      layerDugMap.set("layer_0", new Set([2]));
      expect(LAYER_HELPERS.isLayerAccessible(multiLayerTemplate, "layer_1", layerDugMap)).toBe(
        false
      );
    });

    it("上一层清理完成时，下一层可访问", () => {
      const layerDugMap = new Map();
      layerDugMap.set("layer_0", new Set([2, 5]));
      expect(LAYER_HELPERS.isLayerAccessible(multiLayerTemplate, "layer_1", layerDugMap)).toBe(
        true
      );
    });

    it("中间层未清理时，深层不可访问", () => {
      const layerDugMap = new Map();
      layerDugMap.set("layer_0", new Set([2, 5]));
      layerDugMap.set("layer_1", new Set([3]));
      expect(LAYER_HELPERS.isLayerAccessible(multiLayerTemplate, "layer_2", layerDugMap)).toBe(
        false
      );
    });

    it("所有前置层清理完成时，深层可访问", () => {
      const layerDugMap = new Map();
      layerDugMap.set("layer_0", new Set([2, 5]));
      layerDugMap.set("layer_1", new Set([3, 7]));
      expect(LAYER_HELPERS.isLayerAccessible(multiLayerTemplate, "layer_2", layerDugMap)).toBe(
        true
      );
    });

    it("上一层记录不存在时，应视为未清理", () => {
      const layerDugMap = new Map();
      expect(LAYER_HELPERS.isLayerAccessible(multiLayerTemplate, "layer_1", layerDugMap)).toBe(
        false
      );
    });
  });

  describe("getEventProbability - 获取事件概率", () => {
    it("没有事件权重时应返回基础概率", () => {
      const template = {
        layers: [{ id: "layer_0", name: "层1", gridSize: 25, buried: {} }]
      };
      const prob = LAYER_HELPERS.getEventProbability(template, "layer_0", "rain", 0.3);
      expect(prob).toBe(0.3);
    });

    it("有事件权重时应返回加权概率", () => {
      const template = {
        layers: [
          {
            id: "layer_0",
            name: "层1",
            gridSize: 25,
            buried: {},
            eventWeights: { rain: 2.0 }
          }
        ]
      };
      const prob = LAYER_HELPERS.getEventProbability(template, "layer_0", "rain", 0.3);
      expect(prob).toBe(0.6);
    });

    it("加权后概率应限制在0-1范围内", () => {
      const template = {
        layers: [
          {
            id: "layer_0",
            name: "层1",
            gridSize: 25,
            buried: {},
            eventWeights: { rain: 5.0 }
          }
        ]
      };
      const prob = LAYER_HELPERS.getEventProbability(template, "layer_0", "rain", 0.3);
      expect(prob).toBe(1);
    });

    it("负权重时应限制为0", () => {
      const template = {
        layers: [
          {
            id: "layer_0",
            name: "层1",
            gridSize: 25,
            buried: {},
            eventWeights: { rain: -1.0 }
          }
        ]
      };
      const prob = LAYER_HELPERS.getEventProbability(template, "layer_0", "rain", 0.3);
      expect(prob).toBe(0);
    });
  });

  describe("isPieceAccessible - 判断碎片是否可访问", () => {
    it("碎片没有layerId时应返回true", () => {
      const template = {};
      const pieceDef = { id: "p1", label: "碎片1" };
      const layerDugMap = new Map();
      expect(LAYER_HELPERS.isPieceAccessible(template, pieceDef, layerDugMap)).toBe(true);
    });

    it("碎片所在图层可访问时应返回true", () => {
      const template = {
        layers: [{ id: "layer_0", name: "层1", gridSize: 25, buried: { 2: "p1" } }]
      };
      const pieceDef = { id: "p1", label: "碎片1", layerId: "layer_0" };
      const layerDugMap = new Map([["layer_0", new Set([2])]]);
      expect(LAYER_HELPERS.isPieceAccessible(template, pieceDef, layerDugMap)).toBe(true);
    });

    it("碎片所在图层不可访问时应返回false", () => {
      const template = {
        layers: [
          { id: "layer_0", name: "层1", gridSize: 25, buried: { 2: "p1" } },
          { id: "layer_1", name: "层2", gridSize: 25, buried: { 3: "p2" } }
        ]
      };
      const pieceDef = { id: "p2", label: "碎片2", layerId: "layer_1" };
      const layerDugMap = new Map([["layer_0", new Set()]]);
      expect(LAYER_HELPERS.isPieceAccessible(template, pieceDef, layerDugMap)).toBe(false);
    });
  });

  describe("mergeBuriedFromLayers - 合并所有图层埋藏", () => {
    it("应合并所有图层的buried", () => {
      const template = {
        layers: [
          { id: "layer_0", name: "层1", gridSize: 25, buried: { 2: "p1", 5: "p2" } },
          { id: "layer_1", name: "层2", gridSize: 25, buried: { 3: "p3", 7: "p4" } }
        ]
      };
      const merged = LAYER_HELPERS.mergeBuriedFromLayers(template);
      expect(merged).toEqual({ 2: "p1", 5: "p2", 3: "p3", 7: "p4" });
    });

    it("有重复key时后者应覆盖前者", () => {
      const template = {
        layers: [
          { id: "layer_0", name: "层1", gridSize: 25, buried: { 2: "p1" } },
          { id: "layer_1", name: "层2", gridSize: 25, buried: { 2: "p2" } }
        ]
      };
      const merged = LAYER_HELPERS.mergeBuriedFromLayers(template);
      expect(merged[2]).toBe("p2");
    });
  });
});

describe("RESTORATION_GOALS - 修复目标", () => {
  describe("maxDigs - 精准挖掘", () => {
    it("checkValid: 正数应有效", () => {
      expect(RESTORATION_GOALS.maxDigs.checkValid(10)).toBe(true);
      expect(RESTORATION_GOALS.maxDigs.checkValid(1)).toBe(true);
    });

    it("checkValid: 非正数应无效", () => {
      expect(RESTORATION_GOALS.maxDigs.checkValid(0)).toBe(false);
      expect(RESTORATION_GOALS.maxDigs.checkValid(-5)).toBe(false);
      expect(RESTORATION_GOALS.maxDigs.checkValid("10")).toBe(false);
      expect(RESTORATION_GOALS.maxDigs.checkValid(null)).toBe(false);
    });

    it("evaluate: 挖掘次数不超过目标时应达成", () => {
      const state = { digs: 8 };
      expect(RESTORATION_GOALS.maxDigs.evaluate(state, null, 10)).toBe(true);
    });

    it("evaluate: 挖掘次数等于目标时应达成", () => {
      const state = { digs: 10 };
      expect(RESTORATION_GOALS.maxDigs.evaluate(state, null, 10)).toBe(true);
    });

    it("evaluate: 挖掘次数超过目标时未达成", () => {
      const state = { digs: 12 };
      expect(RESTORATION_GOALS.maxDigs.evaluate(state, null, 10)).toBe(false);
    });

    it("description: 应生成正确描述", () => {
      expect(RESTORATION_GOALS.maxDigs.description(15)).toBe("挖掘次数不超过 15 次");
    });

    it("shortDescription: 应生成正确简短描述", () => {
      expect(RESTORATION_GOALS.maxDigs.shortDescription(15)).toBe("挖掘≤15次");
    });
  });

  describe("noHints - 独立完成", () => {
    it("checkValid: 始终有效", () => {
      expect(RESTORATION_GOALS.noHints.checkValid()).toBe(true);
      expect(RESTORATION_GOALS.noHints.checkValid(null)).toBe(true);
    });

    it("evaluate: 未使用提示时应达成", () => {
      const state = { hintsUsed: 0 };
      expect(RESTORATION_GOALS.noHints.evaluate(state)).toBe(true);
    });

    it("evaluate: 使用过提示时未达成", () => {
      const state = { hintsUsed: 1 };
      expect(RESTORATION_GOALS.noHints.evaluate(state)).toBe(false);
    });
  });

  describe("noTools - 纯手工修复", () => {
    it("checkValid: 始终有效", () => {
      expect(RESTORATION_GOALS.noTools.checkValid()).toBe(true);
    });

    it("evaluate: 未使用任何道具时应达成", () => {
      const state = { toolsUsed: { probe: 0, brush: 0, compass: 0, trowel: 0 } };
      expect(RESTORATION_GOALS.noTools.evaluate(state)).toBe(true);
    });

    it("evaluate: trowel为undefined时也应达成", () => {
      const state = { toolsUsed: { probe: 0, brush: 0, compass: 0 } };
      expect(RESTORATION_GOALS.noTools.evaluate(state)).toBe(true);
    });

    it("evaluate: 使用过探针时未达成", () => {
      const state = { toolsUsed: { probe: 1, brush: 0, compass: 0, trowel: 0 } };
      expect(RESTORATION_GOALS.noTools.evaluate(state)).toBe(false);
    });

    it("evaluate: 使用过刷子时未达成", () => {
      const state = { toolsUsed: { probe: 0, brush: 1, compass: 0, trowel: 0 } };
      expect(RESTORATION_GOALS.noTools.evaluate(state)).toBe(false);
    });

    it("evaluate: 使用过罗盘时未达成", () => {
      const state = { toolsUsed: { probe: 0, brush: 0, compass: 1, trowel: 0 } };
      expect(RESTORATION_GOALS.noTools.evaluate(state)).toBe(false);
    });

    it("evaluate: 使用过小手铲时未达成", () => {
      const state = { toolsUsed: { probe: 0, brush: 0, compass: 0, trowel: 1 } };
      expect(RESTORATION_GOALS.noTools.evaluate(state)).toBe(false);
    });
  });

  describe("timeLimit - 限时修复", () => {
    it("checkValid: 正数应有效", () => {
      expect(RESTORATION_GOALS.timeLimit.checkValid(60)).toBe(true);
      expect(RESTORATION_GOALS.timeLimit.checkValid(30)).toBe(true);
    });

    it("checkValid: 非正数应无效", () => {
      expect(RESTORATION_GOALS.timeLimit.checkValid(0)).toBe(false);
      expect(RESTORATION_GOALS.timeLimit.checkValid(-10)).toBe(false);
      expect(RESTORATION_GOALS.timeLimit.checkValid("60")).toBe(false);
    });

    it("evaluate: 有elapsedTime时应使用elapsedTime判断", () => {
      const state = { elapsedTime: 50 };
      expect(RESTORATION_GOALS.timeLimit.evaluate(state, null, 60)).toBe(true);
      expect(RESTORATION_GOALS.timeLimit.evaluate(state, null, 45)).toBe(false);
    });

    it("evaluate: 没有elapsedTime时应使用timeLeft计算", () => {
      const state = { timeLeft: 40 };
      const template = { timeLimit: 90 };
      expect(RESTORATION_GOALS.timeLimit.evaluate(state, template, 60)).toBe(true);
      expect(RESTORATION_GOALS.timeLimit.evaluate(state, template, 45)).toBe(false);
    });
  });

  describe("avoidNegativeKeyEvents - 平安作业", () => {
    it("checkValid: 始终有效", () => {
      expect(RESTORATION_GOALS.avoidNegativeKeyEvents.checkValid()).toBe(true);
    });

    it("evaluate: 没有关键负面事件时应达成", () => {
      const state = { keyEvents: [{ type: "positive" }, { type: "neutral" }] };
      expect(RESTORATION_GOALS.avoidNegativeKeyEvents.evaluate(state)).toBe(true);
    });

    it("evaluate: 有关键负面事件时未达成", () => {
      const state = { keyEvents: [{ type: "positive" }, { type: "negative" }] };
      expect(RESTORATION_GOALS.avoidNegativeKeyEvents.evaluate(state)).toBe(false);
    });

    it("evaluate: 空事件列表时应达成", () => {
      const state = { keyEvents: [] };
      expect(RESTORATION_GOALS.avoidNegativeKeyEvents.evaluate(state)).toBe(true);
    });
  });

  describe("noAngleMistakes - 精准贴合", () => {
    it("checkValid: 始终有效", () => {
      expect(RESTORATION_GOALS.noAngleMistakes.checkValid()).toBe(true);
    });

    it("evaluate: 没有角度失误时应达成", () => {
      const state = { wrongAngleAttempts: 0 };
      expect(RESTORATION_GOALS.noAngleMistakes.evaluate(state)).toBe(true);
    });

    it("evaluate: 有角度失误时未达成", () => {
      const state = { wrongAngleAttempts: 1 };
      expect(RESTORATION_GOALS.noAngleMistakes.evaluate(state)).toBe(false);
    });
  });

  describe("evaluateGoals - 批量评估目标", () => {
    it("应正确评估所有目标达成情况", () => {
      const template = {
        timeLimit: 90,
        goals: {
          maxDigs: 15,
          noHints: true,
          timeLimit: 60
        }
      };
      const state = {
        digs: 12,
        hintsUsed: 0,
        elapsedTime: 55,
        toolsUsed: { probe: 0, brush: 0, compass: 0 },
        keyEvents: [],
        wrongAngleAttempts: 0
      };
      const results = evaluateGoals(template, state);
      expect(results.maxDigs.achieved).toBe(true);
      expect(results.noHints.achieved).toBe(true);
      expect(results.timeLimit.achieved).toBe(true);
    });

    it("应正确标记未达成的目标", () => {
      const template = {
        timeLimit: 90,
        goals: {
          maxDigs: 10,
          noHints: true
        }
      };
      const state = {
        digs: 15,
        hintsUsed: 2
      };
      const results = evaluateGoals(template, state);
      expect(results.maxDigs.achieved).toBe(false);
      expect(results.noHints.achieved).toBe(false);
    });

    it("应忽略未知的目标类型", () => {
      const template = {
        goals: {
          unknownGoal: "value"
        }
      };
      const state = {};
      const results = evaluateGoals(template, state);
      expect(results.unknownGoal).toBeUndefined();
    });

    it("没有目标时应返回空对象", () => {
      const template = {};
      const state = {};
      const results = evaluateGoals(template, state);
      expect(results).toEqual({});
    });
  });

  describe("getGoalsSummary - 获取目标摘要", () => {
    it("应返回目标摘要列表", () => {
      const template = {
        goals: {
          maxDigs: 15,
          noHints: true
        }
      };
      const summary = getGoalsSummary(template);
      expect(summary).toHaveLength(2);
      expect(summary[0].id).toBe("maxDigs");
      expect(summary[1].id).toBe("noHints");
    });

    it("应过滤掉未知的目标类型", () => {
      const template = {
        goals: {
          maxDigs: 15,
          unknownGoal: "value"
        }
      };
      const summary = getGoalsSummary(template);
      expect(summary).toHaveLength(1);
      expect(summary[0].id).toBe("maxDigs");
    });
  });
});

describe("getRating - 评分档位", () => {
  it("分数>=90应为S级", () => {
    expect(getRating(100)).toBe("S");
    expect(getRating(95)).toBe("S");
    expect(getRating(90)).toBe("S");
  });

  it("分数75-89应为A级", () => {
    expect(getRating(89)).toBe("A");
    expect(getRating(80)).toBe("A");
    expect(getRating(75)).toBe("A");
  });

  it("分数60-74应为B级", () => {
    expect(getRating(74)).toBe("B");
    expect(getRating(70)).toBe("B");
    expect(getRating(60)).toBe("B");
  });

  it("分数45-59应为C级", () => {
    expect(getRating(59)).toBe("C");
    expect(getRating(50)).toBe("C");
    expect(getRating(45)).toBe("C");
  });

  it("分数<45应为D级", () => {
    expect(getRating(44)).toBe("D");
    expect(getRating(30)).toBe("D");
    expect(getRating(0)).toBe("D");
  });

  it("边界值测试", () => {
    expect(getRating(89.9)).toBe("A");
    expect(getRating(90)).toBe("S");
    expect(getRating(74.9)).toBe("B");
    expect(getRating(75)).toBe("A");
    expect(getRating(59.9)).toBe("C");
    expect(getRating(60)).toBe("B");
    expect(getRating(44.9)).toBe("D");
    expect(getRating(45)).toBe("C");
  });
});

describe("getCommentary - 评价文案", () => {
  it("S级: 零提示零失误应有特殊文案", () => {
    const scores = { hintScore: 100, angleScore: 100, timeScore: 90, digScore: 90 };
    expect(getCommentary("S", scores)).toContain("完美发掘");
  });

  it("S级: 零提示应有特殊文案", () => {
    const scores = { hintScore: 100, angleScore: 90, timeScore: 90, digScore: 90 };
    expect(getCommentary("S", scores)).toContain("教科书般");
  });

  it("S级: 速度极快应有特殊文案", () => {
    const scores = { hintScore: 90, angleScore: 90, timeScore: 98, digScore: 90 };
    expect(getCommentary("S", scores)).toContain("电光火石");
  });

  it("A级: 零角度失误应有特殊文案", () => {
    const scores = { hintScore: 90, angleScore: 100, timeScore: 70, digScore: 70 };
    expect(getCommentary("A", scores)).toContain("手法精准");
  });

  it("D级: 低提示分应有特殊文案", () => {
    const scores = { hintScore: 30, angleScore: 50, timeScore: 50, digScore: 50 };
    expect(getCommentary("D", scores)).toContain("全程依赖提示");
  });
});

describe("getScoreColor - 分数颜色", () => {
  it("高分应为金色", () => {
    expect(getScoreColor(95)).toBe("#ffd700");
  });

  it("良好应为青绿色", () => {
    expect(getScoreColor(80)).toBe("#698980");
  });

  it("中等应为蓝色", () => {
    expect(getScoreColor(65)).toBe("#7ba4d4");
  });

  it("及格应为橙色", () => {
    expect(getScoreColor(50)).toBe("#d4a067");
  });

  it("不及格应为红色", () => {
    expect(getScoreColor(30)).toBe("#d46767");
  });
});

describe("validateLevel - 自定义关卡校验", () => {
  const createValidState = () => ({
    name: "测试关卡",
    timeLimit: 120,
    gridSize: 25,
    snapRadius: 60,
    buried: { 2: "p1", 5: "p2", 8: "p3" },
    pieceDefs: [
      { id: "p1", label: "碎片1", slot: { x: 20, y: 30 } },
      { id: "p2", label: "碎片2", slot: { x: 50, y: 30 } },
      { id: "p3", label: "碎片3", slot: { x: 80, y: 30 } }
    ],
    layers: null,
    goals: { maxDigs: 15 }
  });

  describe("基础信息校验", () => {
    it("完整有效数据应通过校验", () => {
      const state = createValidState();
      const result = validateLevel(state);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("空名称应报错", () => {
      const state = createValidState();
      state.name = "";
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("关卡名称不能为空");
    });

    it("空格名称应报错", () => {
      const state = createValidState();
      state.name = "   ";
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("关卡名称不能为空");
    });

    it("时间限制小于30秒应报错", () => {
      const state = createValidState();
      state.timeLimit = 29;
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("倒计时不能少于 30 秒");
    });

    it("时间限制为0应报错", () => {
      const state = createValidState();
      state.timeLimit = 0;
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
    });

    it("没有碎片应报错", () => {
      const state = createValidState();
      state.pieceDefs = [];
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("至少需要添加 1 个碎片");
    });
  });

  describe("多图层校验", () => {
    it("多层有效数据应通过校验", () => {
      const state = {
        name: "多层关卡",
        timeLimit: 180,
        gridSize: 25,
        snapRadius: 60,
        pieceDefs: [
          { id: "p1", label: "碎片1", slot: { x: 20, y: 30 }, layerId: "layer_0" },
          { id: "p2", label: "碎片2", slot: { x: 50, y: 30 }, layerId: "layer_1" }
        ],
        layers: [
          { id: "layer_0", name: "旧石器时代", gridSize: 25, buried: { 2: "p1" } },
          { id: "layer_1", name: "新石器时代", gridSize: 25, buried: { 5: "p2" } }
        ]
      };
      const result = validateLevel(state);
      expect(result.valid).toBe(true);
    });

    it("图层名称为空应报错", () => {
      const state = {
        name: "测试关卡",
        timeLimit: 120,
        gridSize: 25,
        snapRadius: 60,
        pieceDefs: [{ id: "p1", label: "碎片1", slot: { x: 20, y: 30 }, layerId: "layer_0" }],
        layers: [{ id: "layer_0", name: "", gridSize: 25, buried: { 2: "p1" } }]
      };
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("第 1 个地层的名称不能为空");
    });

    it("探方格索引超出范围应报错", () => {
      const state = {
        name: "测试关卡",
        timeLimit: 120,
        gridSize: 25,
        snapRadius: 60,
        pieceDefs: [{ id: "p1", label: "碎片1", slot: { x: 20, y: 30 }, layerId: "layer_0" }],
        layers: [{ id: "layer_0", name: "层1", gridSize: 25, buried: { 30: "p1" } }]
      };
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("超出该层探方尺寸范围"))).toBe(true);
    });

    it("探方格索引为负数应报错", () => {
      const state = {
        name: "测试关卡",
        timeLimit: 120,
        gridSize: 25,
        snapRadius: 60,
        pieceDefs: [{ id: "p1", label: "碎片1", slot: { x: 20, y: 30 }, layerId: "layer_0" }],
        layers: [{ id: "layer_0", name: "层1", gridSize: 25, buried: { "-1": "p1" } }]
      };
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
    });

    it("重复埋藏同一探方格应能检测到（模拟数据损坏场景）", () => {
      const state = {
        name: "测试关卡",
        timeLimit: 120,
        gridSize: 25,
        snapRadius: 60,
        pieceDefs: [
          { id: "p1", label: "碎片1", slot: { x: 20, y: 30 }, layerId: "layer_0" },
          { id: "p2", label: "碎片2", slot: { x: 50, y: 30 }, layerId: "layer_0" }
        ],
        layers: [
          {
            id: "layer_0",
            name: "层1",
            gridSize: 25,
            buried: { 5: "p1", 6: "p2" }
          }
        ]
      };
      const originalEntries = Object.entries;
      const originalKeys = Object.keys;
      Object.entries = function (obj) {
        if (obj === state.layers[0].buried) {
          return [
            ["5", "p1"],
            ["5", "p2"]
          ];
        }
        return originalEntries.call(Object, obj);
      };
      Object.keys = function (obj) {
        if (obj === state.layers[0].buried) {
          return ["5", "5"];
        }
        return originalKeys.call(Object, obj);
      };
      try {
        const result = validateLevel(state);
        expect(result.valid).toBe(false);
        const hasError = result.errors.some(
          e => (e.includes("探方格") && e.includes("重复使用")) || e.includes("同一个探方格")
        );
        expect(hasError).toBe(true);
      } finally {
        Object.entries = originalEntries;
        Object.keys = originalKeys;
      }
    });

    it("碎片数量超过所有层总格子数应报错", () => {
      const state = {
        name: "测试关卡",
        timeLimit: 120,
        gridSize: 9,
        snapRadius: 60,
        pieceDefs: Array.from({ length: 20 }, (_, i) => ({
          id: `p${i}`,
          label: `碎片${i + 1}`,
          slot: { x: 10 + i * 5, y: 50 },
          layerId: "layer_0"
        })),
        layers: [
          {
            id: "layer_0",
            name: "层1",
            gridSize: 9,
            buried: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i, `p${i}`]))
          }
        ]
      };
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("不能超过所有地层探方总格数"))).toBe(true);
    });
  });

  describe("碎片校验", () => {
    it("碎片标签为空应报错", () => {
      const state = createValidState();
      state.pieceDefs[0].label = "";
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("第 1 个碎片的标签不能为空");
    });

    it("碎片没有设置埋藏位置应报错", () => {
      const state = createValidState();
      state.buried = { 2: "p1", 5: "p2" };
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("「碎片3」还没有设置埋藏位置");
    });

    it("多个碎片使用同一格应报错（模拟数据损坏场景）", () => {
      const state = createValidState();
      const originalEntries = Object.entries;
      Object.entries = function (obj) {
        if (obj === state.buried) {
          return [
            ["2", "p1"],
            ["2", "p2"],
            ["8", "p3"]
          ];
        }
        return originalEntries.call(Object, obj);
      };
      try {
        const result = validateLevel(state);
        expect(result.valid).toBe(false);
        expect(
          result.errors.some(
            e =>
              e.includes("同一个探方格") ||
              e.includes("还没有设置埋藏位置") ||
              e.includes("重复使用")
          )
        ).toBe(true);
      } finally {
        Object.entries = originalEntries;
      }
    });

    it("碎片没有设置目标槽位应报错", () => {
      const state = createValidState();
      delete state.pieceDefs[0].slot;
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("「碎片1」还没有设置目标槽位");
    });

    it("碎片slot只有x没有y应报错", () => {
      const state = createValidState();
      state.pieceDefs[0].slot = { x: 20 };
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
    });
  });

  describe("孤儿埋藏警告", () => {
    it("埋藏的碎片不在列表中应警告", () => {
      const state = createValidState();
      state.buried = { 2: "p1", 5: "p2", 8: "p3", 10: "p999" };
      const result = validateLevel(state);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes("p999"))).toBe(true);
    });

    it("多层模式下孤儿埋藏应警告", () => {
      const state = {
        name: "测试关卡",
        timeLimit: 120,
        gridSize: 25,
        snapRadius: 60,
        pieceDefs: [{ id: "p1", label: "碎片1", slot: { x: 20, y: 30 }, layerId: "layer_0" }],
        layers: [{ id: "layer_0", name: "层1", gridSize: 25, buried: { 2: "p1", 5: "p999" } }]
      };
      const result = validateLevel(state);
      expect(result.warnings.some(w => w.includes("p999"))).toBe(true);
    });
  });

  describe("参数警告", () => {
    it("贴合半径过小应警告", () => {
      const state = createValidState();
      state.snapRadius = 30;
      const result = validateLevel(state);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("贴合半径过小，可能导致碎片难以吸附");
    });

    it("时间过短应警告", () => {
      const state = createValidState();
      state.timeLimit = 30;
      state.pieceDefs = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        label: `碎片${i + 1}`,
        slot: { x: 10 + i * 8, y: 50 }
      }));
      state.buried = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, `p${i}`]));
      const result = validateLevel(state);
      expect(result.warnings.some(w => w.includes("倒计时可能偏短"))).toBe(true);
    });

    it("目标槽位重叠应警告", () => {
      const state = createValidState();
      state.pieceDefs[0].slot = { x: 50, y: 30 };
      state.pieceDefs[1].slot = { x: 50, y: 30 };
      const result = validateLevel(state);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes("目标槽位位置重叠"))).toBe(true);
    });
  });

  describe("修复目标校验", () => {
    it("未知目标类型应警告", () => {
      const state = createValidState();
      state.goals = { unknownGoal: 123 };
      const result = validateLevel(state);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("存在未知的修复目标类型：unknownGoal");
    });

    it("maxDigs参数无效应报错", () => {
      const state = createValidState();
      state.goals = { maxDigs: -5 };
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("修复目标「精准挖掘」的参数无效：-5");
    });

    it("timeLimit参数无效应报错", () => {
      const state = createValidState();
      state.goals = { timeLimit: "invalid" };
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("修复目标「限时修复」的参数无效：invalid");
    });

    it("限时目标时间大于关卡总时长应报错", () => {
      const state = createValidState();
      state.timeLimit = 90;
      state.goals = { timeLimit: 120 };
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("修复目标「限时修复」的时间(120秒)不能大于关卡总时长(90秒)");
    });

    it("maxDigs少于碎片数量应警告", () => {
      const state = createValidState();
      state.goals = { maxDigs: 2 };
      const result = validateLevel(state);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes("挖掘次数(2次)少于碎片数量(3)"))).toBe(true);
    });

    it("maxDigs大于等于碎片数量不应警告", () => {
      const state = createValidState();
      state.goals = { maxDigs: 3 };
      const result = validateLevel(state);
      expect(result.warnings.some(w => w.includes("精准挖掘"))).toBe(false);
    });
  });

  describe("单图层特殊校验", () => {
    it("单图层碎片数量超过gridSize应报错", () => {
      const state = createValidState();
      state.gridSize = 2;
      state.pieceDefs = [
        { id: "p1", label: "碎片1", slot: { x: 20, y: 30 } },
        { id: "p2", label: "碎片2", slot: { x: 50, y: 30 } },
        { id: "p3", label: "碎片3", slot: { x: 80, y: 30 } }
      ];
      state.buried = { 0: "p1", 1: "p2", 2: "p3" };
      const result = validateLevel(state);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("不能超过探方格数"))).toBe(true);
    });
  });
});
