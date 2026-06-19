const fs = require("fs");
const path = require("path");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m",
  dim: "\x1b[2m"
};

let passed = 0;
let failed = 0;
let skipped = 0;
let currentSuite = "";
const failures = [];

function describe(name, fn) {
  currentSuite = name;
  console.log(`\n${colors.bold}${colors.blue}▸ ${name}${colors.reset}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ${colors.green}✓${colors.reset} ${colors.dim}${name}${colors.reset}`);
  } catch (err) {
    failed++;
    failures.push({ suite: currentSuite, test: name, error: err });
    console.log(`  ${colors.red}✗${colors.reset} ${name}`);
    console.log(`    ${colors.red}${err.message}${colors.reset}`);
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${expectedStr}, but got ${actualStr}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, but got ${JSON.stringify(actual)}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, but got ${JSON.stringify(actual)}`);
      }
    },
    toBeUndefined() {
      if (actual !== undefined) {
        throw new Error(`Expected undefined, but got ${JSON.stringify(actual)}`);
      }
    },
    toContain(item) {
      if (typeof actual === "string") {
        if (!actual.includes(item)) {
          throw new Error(`Expected string to contain "${item}", but got "${actual}"`);
        }
      } else if (Array.isArray(actual)) {
        if (!actual.includes(item)) {
          throw new Error(`Expected array to contain ${JSON.stringify(item)}, but got ${JSON.stringify(actual)}`);
        }
      } else {
        throw new Error(`toContain can only be used on strings or arrays`);
      }
    },
    toHaveLength(length) {
      if (actual.length !== length) {
        throw new Error(`Expected length ${length}, but got ${actual.length}`);
      }
    },
    toBeGreaterThan(value) {
      if (actual <= value) {
        throw new Error(`Expected ${actual} to be greater than ${value}`);
      }
    },
    toBeLessThan(value) {
      if (actual >= value) {
        throw new Error(`Expected ${actual} to be less than ${value}`);
      }
    }
  };
}

global.describe = describe;
global.it = it;
global.expect = expect;

const testFile = path.join(__dirname, "core.test.js");
console.log(`${colors.bold}${colors.yellow}考古现场拼碎片 - 核心逻辑测试${colors.reset}`);
console.log(`${colors.dim}运行环境: Node.js ${process.version}${colors.reset}`);

const startTime = Date.now();
require(testFile);
const endTime = Date.now();

console.log(`\n${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.bold}测试结果:${colors.reset}`);
console.log(`  ${colors.green}通过: ${passed}${colors.reset}`);
if (failed > 0) {
  console.log(`  ${colors.red}失败: ${failed}${colors.reset}`);
}
if (skipped > 0) {
  console.log(`  ${colors.yellow}跳过: ${skipped}${colors.reset}`);
}
console.log(`  ${colors.dim}耗时: ${(endTime - startTime) / 1000}s${colors.reset}`);

if (failed > 0) {
  console.log(`\n${colors.red}${colors.bold}失败详情:${colors.reset}`);
  failures.forEach((f, i) => {
    console.log(`\n  ${i + 1}. ${colors.yellow}[${f.suite}]${colors.reset} ${f.test}`);
    console.log(`     ${colors.red}${f.error.message}${colors.reset}`);
    if (f.error.stack) {
      const stackLines = f.error.stack.split("\n").slice(1, 4);
      stackLines.forEach(line => {
        console.log(`     ${colors.dim}${line.trim()}${colors.reset}`);
      });
    }
  });
  process.exit(1);
} else {
  console.log(`\n${colors.green}${colors.bold}✓ 所有测试通过!${colors.reset}`);
  process.exit(0);
}
