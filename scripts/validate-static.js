const fs = require("fs");
const path = require("path");
const vm = require("vm");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m",
  dim: "\x1b[2m"
};

const projectRoot = path.resolve(__dirname, "..");
let errors = [];
let warnings = [];
let checks = 0;

function logOk(msg) {
  console.log(`  ${colors.green}✓${colors.reset} ${msg}`);
}
function logWarn(msg) {
  console.log(`  ${colors.yellow}!${colors.reset} ${msg}`);
}
function logErr(msg) {
  console.log(`  ${colors.red}✗${colors.reset} ${msg}`);
}
function section(title) {
  console.log(`\n${colors.bold}${colors.blue}▸ ${title}${colors.reset}`);
}

function fileExists(relPath) {
  const abs = path.join(projectRoot, relPath);
  try {
    return fs.statSync(abs).isFile();
  } catch {
    return false;
  }
}

function readFileSafe(relPath) {
  try {
    return fs.readFileSync(path.join(projectRoot, relPath), "utf8");
  } catch {
    return null;
  }
}

function parseHtmlReferences(html) {
  const scripts = [];
  const stylesheets = [];

  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    if (!match[1].startsWith("http://") && !match[1].startsWith("https://")) {
      scripts.push(match[1]);
    }
  }

  const linkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/g;
  while ((match = linkRegex.exec(html)) !== null) {
    const tag = match[0];
    if (
      tag.includes('rel="stylesheet"') ||
      tag.includes("rel='stylesheet'") ||
      tag.includes("stylesheet")
    ) {
      if (!match[1].startsWith("http://") && !match[1].startsWith("https://")) {
        stylesheets.push(match[1]);
      }
    }
  }

  return { scripts, stylesheets };
}

function validateJsSyntax(relPath) {
  const content = readFileSafe(relPath);
  if (content === null) {
    errors.push(`无法读取文件: ${relPath}`);
    return false;
  }
  try {
    new vm.Script(content, { filename: relPath });
    return true;
  } catch (err) {
    errors.push(`JS语法错误 [${relPath}]: ${err.message}`);
    return false;
  }
}

function validateCss(relPath) {
  const content = readFileSafe(relPath);
  if (content === null) {
    errors.push(`无法读取文件: ${relPath}`);
    return false;
  }
  if (content.trim().length === 0) {
    warnings.push(`CSS文件为空: ${relPath}`);
    return true;
  }
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`CSS括号不匹配 [${relPath}]: {${openBraces} vs }${closeBraces}`);
    return false;
  }
  return true;
}

section("静态资源校验");

const indexHtml = readFileSafe("index.html");
if (indexHtml === null) {
  logErr("index.html 不存在或无法读取");
  errors.push("index.html 缺失");
} else {
  logOk("index.html 存在");
  checks++;

  if (indexHtml.trim().length < 50) {
    warnings.push("index.html 内容过短，可能不完整");
  }

  const { scripts, stylesheets } = parseHtmlReferences(indexHtml);

  section("HTML 引用资源存在性");

  stylesheets.forEach(ref => {
    checks++;
    if (fileExists(ref)) {
      logOk(`CSS 存在: ${ref}`);
    } else {
      logErr(`CSS 缺失: ${ref}`);
      errors.push(`HTML引用的CSS不存在: ${ref}`);
    }
  });

  scripts.forEach(ref => {
    checks++;
    if (fileExists(ref)) {
      logOk(`JS 存在: ${ref}`);
    } else {
      logErr(`JS 缺失: ${ref}`);
      errors.push(`HTML引用的JS不存在: ${ref}`);
    }
  });

  section("JavaScript 语法校验");
  scripts.forEach(ref => {
    if (fileExists(ref)) {
      checks++;
      if (validateJsSyntax(ref)) {
        logOk(`语法正常: ${ref}`);
      } else {
        logErr(`语法错误: ${ref}`);
      }
    }
  });

  section("CSS 完整性校验");
  stylesheets.forEach(ref => {
    if (fileExists(ref)) {
      checks++;
      if (validateCss(ref)) {
        logOk(`CSS 正常: ${ref}`);
      } else {
        logErr(`CSS 异常: ${ref}`);
      }
    }
  });

  section("额外文件完整性");
  const extraJs = ["core.js", "levels.js", "game-data.js", "app.js"];
  extraJs.forEach(f => {
    if (!scripts.includes(f) && fileExists(f)) {
      checks++;
      if (validateJsSyntax(f)) {
        logOk(`语法正常: ${f} (未在HTML中引用)`);
      }
    }
  });
}

console.log(`\n${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.bold}校验结果:${colors.reset}`);
console.log(`  检查项: ${checks}`);
if (warnings.length > 0) {
  console.log(`  ${colors.yellow}警告: ${warnings.length}${colors.reset}`);
  warnings.forEach(w => console.log(`    ${colors.yellow}- ${w}${colors.reset}`));
}
if (errors.length > 0) {
  console.log(`  ${colors.red}错误: ${errors.length}${colors.reset}`);
  errors.forEach(e => console.log(`    ${colors.red}- ${e}${colors.reset}`));
  console.log(`\n${colors.red}${colors.bold}✗ 校验失败!${colors.reset}`);
  process.exit(1);
} else {
  console.log(`  ${colors.green}通过: 所有检查项无错误${colors.reset}`);
  console.log(`\n${colors.green}${colors.bold}✓ 静态资源校验通过!${colors.reset}`);
  process.exit(0);
}
