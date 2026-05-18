const CALL_KEYWORDS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'function',
  'elseif',
  'return',
  'local'
]);

const SUPPRESSION_PATTERN = /fivem-check-disable(-next-line)?\s+(.+)$/i;

export function createLineLocator(source) {
  const lineStarts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') {
      lineStarts.push(index + 1);
    }
  }

  return (characterIndex) => {
    let low = 0;
    let high = lineStarts.length - 1;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (lineStarts[middle] <= characterIndex) {
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    const lineStart = lineStarts[Math.max(0, high)];
    return {
      line: Math.max(0, high) + 1,
      column: characterIndex - lineStart + 1
    };
  };
}

export function stripCommentsPreserveLines(source, language) {
  let output = source;

  if (language === 'lua') {
    output = output.replace(/--\[\[[\s\S]*?\]\]/g, maskPreserveLines);
    output = output.replace(/--.*$/gm, maskPreserveLines);
    return output;
  }

  output = output.replace(/\/\*[\s\S]*?\*\//g, maskPreserveLines);
  output = output.replace(/\/\/.*$/gm, maskPreserveLines);
  return output;
}

export function extractSuppressionDirectives(source, language) {
  const lines = source.split(/\r?\n/);
  const fileRules = new Set();
  const nextLineRules = new Map();

  lines.forEach((lineText, index) => {
    const commentText = extractCommentText(lineText, language);
    if (!commentText) {
      return;
    }

    const match = commentText.match(SUPPRESSION_PATTERN);
    if (!match) {
      return;
    }

    const rules = parseSuppressedRules(match[2]);
    if (rules.size === 0) {
      return;
    }

    if (match[1]) {
      const targetLine = index + 2;
      if (!nextLineRules.has(targetLine)) {
        nextLineRules.set(targetLine, new Set());
      }

      for (const ruleId of rules) {
        nextLineRules.get(targetLine).add(ruleId);
      }
      return;
    }

    for (const ruleId of rules) {
      fileRules.add(ruleId);
    }
  });

  return {
    fileRules: [...fileRules],
    nextLineRules: Object.fromEntries(
      [...nextLineRules.entries()].map(([line, rules]) => [String(line), [...rules]])
    )
  };
}

export function extractCallExpressions(source, locate) {
  const calls = [];

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== '(') {
      continue;
    }

    let cursor = index - 1;
    while (cursor >= 0 && /\s/.test(source[cursor])) {
      cursor -= 1;
    }

    if (cursor < 0 || !/[A-Za-z0-9_\]\)]/.test(source[cursor])) {
      continue;
    }

    let nameStart = cursor;
    while (nameStart >= 0 && /[A-Za-z0-9_.$:\[\]'"\]]/.test(source[nameStart])) {
      nameStart -= 1;
    }

    const callee = source.slice(nameStart + 1, cursor + 1).trim();
    if (!callee) {
      continue;
    }

    const nameMatch = callee.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
    if (!nameMatch) {
      continue;
    }

    const name = nameMatch[1];
    if (CALL_KEYWORDS.has(name.toLowerCase())) {
      continue;
    }

    const prefix = source.slice(Math.max(0, nameStart - 10), nameStart + 1);
    if (/\bfunction\s*$/.test(prefix)) {
      continue;
    }

    const closingParen = findMatchingDelimiter(source, index, '(', ')');
    if (closingParen === -1) {
      continue;
    }

    const args = source.slice(index + 1, closingParen);
    const location = locate(nameStart + 1);
    calls.push({
      callee,
      name,
      line: location.line,
      column: location.column,
      argCount: countTopLevelArgs(args),
      index: nameStart + 1
    });
  }

  return dedupeCalls(calls);
}

export function findMatchingDelimiter(source, startIndex, openChar, closeChar) {
  let depth = 0;
  let stringQuote = null;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];

    if (stringQuote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === '\\') {
        escaped = true;
        continue;
      }

      if (character === stringQuote) {
        stringQuote = null;
      }
      continue;
    }

    if (["'", '"', '`'].includes(character)) {
      stringQuote = character;
      continue;
    }

    if (character === openChar) {
      depth += 1;
      continue;
    }

    if (character === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function countTopLevelArgs(args) {
  const trimmed = args.trim();
  if (!trimmed) {
    return 0;
  }

  let count = 1;
  let parentheses = 0;
  let brackets = 0;
  let braces = 0;
  let stringQuote = null;
  let escaped = false;

  for (let index = 0; index < args.length; index += 1) {
    const character = args[index];

    if (stringQuote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === '\\') {
        escaped = true;
        continue;
      }

      if (character === stringQuote) {
        stringQuote = null;
      }
      continue;
    }

    if (["'", '"', '`'].includes(character)) {
      stringQuote = character;
      continue;
    }

    if (character === '(') {
      parentheses += 1;
      continue;
    }

    if (character === ')') {
      parentheses -= 1;
      continue;
    }

    if (character === '[') {
      brackets += 1;
      continue;
    }

    if (character === ']') {
      brackets -= 1;
      continue;
    }

    if (character === '{') {
      braces += 1;
      continue;
    }

    if (character === '}') {
      braces -= 1;
      continue;
    }

    if (character === ',' && parentheses === 0 && brackets === 0 && braces === 0) {
      count += 1;
    }
  }

  return count;
}

function maskPreserveLines(match) {
  return match.replace(/[^\n]/g, ' ');
}

function dedupeCalls(calls) {
  const seen = new Set();
  return calls.filter((call) => {
    const key = `${call.index}:${call.callee}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function extractCommentText(lineText, language) {
  if (language === 'lua') {
    const commentIndex = lineText.indexOf('--');
    return commentIndex === -1 ? null : lineText.slice(commentIndex + 2).trim();
  }

  if (language === 'javascript') {
    const lineCommentIndex = lineText.indexOf('//');
    if (lineCommentIndex !== -1) {
      return lineText.slice(lineCommentIndex + 2).trim();
    }

    const blockCommentIndex = lineText.indexOf('/*');
    if (blockCommentIndex !== -1) {
      return lineText.slice(blockCommentIndex + 2).replace('*/', '').trim();
    }
  }

  if (language === 'html') {
    const htmlCommentIndex = lineText.indexOf('<!--');
    if (htmlCommentIndex !== -1) {
      return lineText.slice(htmlCommentIndex + 4).replace('-->', '').trim();
    }
  }

  return null;
}

function parseSuppressedRules(rawRules) {
  const rules = new Set();
  for (const value of rawRules.split(',')) {
    const ruleId = value.trim();
    if (ruleId) {
      rules.add(ruleId);
    }
  }

  return rules;
}