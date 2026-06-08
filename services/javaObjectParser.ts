/**
 * Java Object → JSON 解析器
 * 支持将 Java 打印的对象字符串转换为标准 JSON 格式
 *
 * 支持的格式:
 *   - Lombok @ToString:  User(name=John, age=30)
 *   - Commons Lang3:     User[name=John,age=30]
 *   - Guava MoreObjects: User{name=John, age=30}
 *   - IDEA Debugger:     User{name='John', age=30}
 *   - 嵌套对象、数组、Map
 */

/**
 * 主入口：解析 Java 对象字符串，返回格式化后的 JSON 字符串
 */
export function parseJavaObjectToJson(input: string): string {
  if (!input || !input.trim()) {
    return '';
  }

  try {
    const trimmed = input.trim();

    // 预处理：去掉 Java 变量声明前缀如 "User user = " 或 "var user = "
    const cleaned = removeVariableDeclaration(trimmed);

    // 尝试检测是否为多条独立对象（换行分隔），如果是则返回数组
    const lines = splitTopLevelObjects(cleaned);
    if (lines.length > 1) {
      const results = lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => parseObject(line));
      return JSON.stringify(results, null, 2);
    }

    const result = parseObject(cleaned);
    return JSON.stringify(result, null, 2);
  } catch (e) {
    return `解析失败: ${(e as Error).message}\n\n请检查输入格式是否为有效的 Java 对象字符串。`;
  }
}

/**
 * 移除 Java 变量声明前缀
 * 例: "User user = User(name=John)" → "User(name=John)"
 *     "var user = User(name=John)" → "User(name=John)"
 *     "User(name=John)" → "User(name=John)"
 */
function removeVariableDeclaration(input: string): string {
  // 匹配 "TypeName varName = " 模式（必须有两个单词，即类型名+变量名）
  // 避免误伤普通的 key=value 格式
  const declarationPattern = /^(?:\w+(?:<[^>]+>)?\s+)\w+\s*=\s*/;
  const match = input.match(declarationPattern);
  if (match && match.index === 0) {
    const afterDecl = input.substring(match[0].length).trim();
    // 确认去掉前缀后剩余部分以括号或类名开头
    if (/^[\w\(\[\{]/.test(afterDecl)) {
      return afterDecl;
    }
  }
  return input;
}

/**
 * 将多行输入按顶层对象拆分
 * 如果每行都是独立的 Java 对象，返回多行；否则返回单元素数组
 */
function splitTopLevelObjects(input: string): string[] {
  // 尝试按换行拆分
  const rawLines = input.split(/\r?\n/).filter((l) => l.trim());

  if (rawLines.length <= 1) {
    return [input];
  }

  // 检查每行是否都包含括号（可能是独立对象）
  const allHaveBrackets = rawLines.every((line) => {
    const trimmed = line.trim();
    return (
      trimmed.includes('(') ||
      trimmed.includes('{') ||
      trimmed.includes('[')
    );
  });

  if (allHaveBrackets) {
    // 验证每一行是否都可以独立解析（括号匹配）
    const validLines = rawLines.filter((line) => {
      const trimmed = line.trim();
      return hasMatchedBrackets(trimmed);
    });

    // 如果大部分行都括号匹配，拆分处理
    if (validLines.length >= rawLines.length * 0.8) {
      return rawLines.map((l) => l.trim());
    }
  }

  // 否则按整个字符串处理（多行可能属于同一个对象）
  return [input];
}

/**
 * 快速检查字符串的括号是否配对
 */
function hasMatchedBrackets(str: string): boolean {
  const stack: string[] = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const opens = new Set(['(', '[', '{']);
  const closes = new Set([')', ']', '}']);

  for (const ch of str) {
    if (opens.has(ch)) {
      stack.push(ch);
    } else if (closes.has(ch)) {
      const last = stack.pop();
      if (!last || pairs[last] !== ch) return false;
    }
  }
  return stack.length === 0;
}

// ─── 核心解析 ───────────────────────────────────────

/**
 * 解析单个 Java 对象字符串为 JS 对象
 */
function parseObject(str: string): any {
  const trimmed = str.trim();

  // 空输入
  if (!trimmed) return {};

  // 如果整个字符串是一个数组字面量 [a, b, c]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return parseArray(trimmed);
  }

  // 如果是纯 Map 字面量 {k1=v1, k2=v2}（无类名前缀）
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.substring(1, trimmed.length - 1).trim();
    const fields = splitByTopLevelCommas(inner);
    return fieldsToObject(fields);
  }

  // 找到第一个括号
  const firstBracket = findFirstBracket(trimmed);
  if (firstBracket === -1) {
    // 没有括号，尝试作为简单的 key=value 对处理
    if (trimmed.includes('=')) {
      const fields = splitByTopLevelCommas(trimmed);
      return fieldsToObject(fields);
    }
    return { _value: trimmed };
  }

  const openBracket = trimmed[firstBracket];
  const closeIdx = findMatchingBracket(trimmed, firstBracket);

  if (closeIdx === -1) {
    throw new Error(`括号不匹配: "${trimmed.substring(0, 100)}..."`);
  }

  // 括号内部内容
  const inner = trimmed.substring(firstBracket + 1, closeIdx).trim();

  // 拆分字段
  const fields = inner ? splitByTopLevelCommas(inner) : [];

  // 构建结果对象
  const result = fieldsToObject(fields);

  return result;
}

/**
 * 将字段数组转换为对象
 */
function fieldsToObject(fields: string[]): Record<string, any> {
  const result: Record<string, any> = {};

  for (const field of fields) {
    const trimmed = field.trim();
    if (!trimmed) continue;

    // 找到第一个顶层等号
    const eqIdx = findTopLevelChar(trimmed, '=');
    if (eqIdx === -1) {
      // 没有等号，当作独立值处理（如 list 元素）
      continue;
    }

    const key = trimmed.substring(0, eqIdx).trim();
    const valueStr = trimmed.substring(eqIdx + 1).trim();

    if (!key) continue;

    result[key] = parseValue(valueStr);
  }

  return result;
}

/**
 * 解析值：自动推断类型
 */
function parseValue(str: string): any {
  if (!str) return null;

  const trimmed = str.trim();

  // null
  if (trimmed === 'null' || trimmed === 'NULL') return null;

  // 布尔值
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // 空数组
  if (trimmed === '[]') return [];

  // 数组 [a, b, c]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return parseArray(trimmed);
  }

  // 嵌套对象：ClassName(...) 或 ClassName{...} 或 ClassName[...]
  const bracketIdx = findFirstBracket(trimmed);
  if (bracketIdx !== -1 && bracketIdx > 0) {
    // 有类名前缀的嵌套
    return parseObject(trimmed);
  }

  // 纯 Map 字面量 {k1=v1, k2=v2}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return parseObject(trimmed);
  }

  // 数字（整数、小数、科学计数法）
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?[LfDd]?$/.test(trimmed)) {
    // 去掉 Java 数字后缀 L/l/F/f/D/d
    const numStr = trimmed.replace(/[LlfFdD]$/, '');
    return Number(numStr);
  }

  // 去掉首尾引号（单引号或双引号）
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.substring(1, trimmed.length - 1);
  }

  // 默认作为字符串
  return trimmed;
}

/**
 * 解析数组 [a, b, c]
 */
function parseArray(str: string): any[] {
  const trimmed = str.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return [parseValue(trimmed)];
  }

  const inner = trimmed.substring(1, trimmed.length - 1).trim();
  if (!inner) return [];

  const items = splitByTopLevelCommas(inner);
  return items.map((item) => parseValue(item.trim()));
}

// ─── 辅助函数 ───────────────────────────────────────

/**
 * 找到字符串中第一个括号的位置
 */
function findFirstBracket(str: string): number {
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (!inString && (ch === "'" || ch === '"')) {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (inString && ch === stringChar && str[i - 1] !== '\\') {
      inString = false;
      continue;
    }

    if (!inString && (ch === '(' || ch === '[' || ch === '{')) {
      return i;
    }
  }
  return -1;
}

/**
 * 找到匹配的闭合括号位置
 */
function findMatchingBracket(str: string, openIdx: number): number {
  const openBracket = str[openIdx];
  const closeBracket = matchingBracket(openBracket);
  let depth = 1;
  let inString = false;
  let stringChar = '';

  for (let i = openIdx + 1; i < str.length; i++) {
    const ch = str[i];

    // 字符串边界
    if (!inString && (ch === "'" || ch === '"')) {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (inString && ch === stringChar && str[i - 1] !== '\\') {
      inString = false;
      continue;
    }

    if (inString) continue;

    if (ch === openBracket) depth++;
    else if (ch === closeBracket) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * 获取匹配的闭合括号
 */
function matchingBracket(open: string): string {
  const map: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  return map[open] || ')';
}

/**
 * 在给定字符中查找第一个在括号深度 0 且不在字符串中的指定字符
 * 用于查找 '=' 或 ',' 等分隔符
 */
function findTopLevelChar(str: string, target: string): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (!inString && (ch === "'" || ch === '"')) {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (inString && ch === stringChar && str[i - 1] !== '\\') {
      inString = false;
      continue;
    }

    if (inString) continue;

    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      // 防止 depth 变为负数
      if (depth > 0) depth--;
    }

    if (ch === target && depth === 0) {
      return i;
    }
  }
  return -1;
}

/**
 * 按顶层逗号拆分（括号深度为 0 且不在字符串中的逗号）
 */
function splitByTopLevelCommas(str: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let current = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    // 字符串边界检测
    if (!inString && (ch === "'" || ch === '"')) {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }
    if (inString && ch === stringChar && str[i - 1] !== '\\') {
      inString = false;
      current += ch;
      continue;
    }

    if (inString) {
      current += ch;
      continue;
    }

    // 括号深度跟踪
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth > 0) depth--;
    }

    // 顶层逗号 = 字段分隔符
    if (ch === ',' && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) result.push(current.trim());
  return result;
}
