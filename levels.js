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
    timeLimit: 240,
    difficulty: "高级",
    snapRadius: 50,
    gridSize: 25,
    iconClass: "mirror-icon",
    layers: [
      {
        id: "layer1",
        name: "表土层",
        description: "耕土层，含近现代杂物，土质松散，小心塌方。",
        gridSize: 25,
        color: "#d4b896",
        eventWeights: {
          collapse: 1.2,
          rain: 0.8,
          sun_crack: 0.6,
          wind: 1.0,
          find_coin: 1.5,
          ancient_guide: 0.5
        },
        buried: { 2: "p1", 6: "p2", 12: "p3" }
      },
      {
        id: "layer2",
        name: "文化层",
        description: "汉代文化堆积，陶片与铜器残件较多，湿度较高。",
        gridSize: 25,
        color: "#b89968",
        eventWeights: {
          collapse: 0.9,
          rain: 1.3,
          sun_crack: 0.7,
          wind: 0.8,
          find_coin: 1.0,
          ancient_guide: 1.2
        },
        buried: { 4: "p4", 9: "p5", 16: "p6" }
      },
      {
        id: "layer3",
        name: "生土层",
        description: "原生土层，青铜镜主体埋藏于此，土质较硬，雨水易渗透。",
        gridSize: 25,
        color: "#8f7348",
        eventWeights: {
          collapse: 0.7,
          rain: 1.5,
          sun_crack: 0.4,
          wind: 0.6,
          find_coin: 0.5,
          ancient_guide: 1.8
        },
        buried: { 1: "p7", 14: "p8", 22: "p9" }
      }
    ],
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
    toolPoints: 20,
    goals: {
      maxDigs: 35,
      timeLimit: 200,
      noTools: true,
      avoidNegativeKeyEvents: true
    }
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { artifactTemplates };
}
