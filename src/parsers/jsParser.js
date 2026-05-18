import {
  createLineLocator,
  extractCallExpressions,
  extractSuppressionDirectives,
  findMatchingDelimiter,
  stripCommentsPreserveLines
} from '../utils/text.js';

export function parseJsFile(target, content) {
  const strippedContent = stripCommentsPreserveLines(content, 'javascript');
  const locate = createLineLocator(content);

  return {
    ...target,
    content,
    lines: content.split(/\r?\n/),
    strippedContent,
    locate,
    suppressions: extractSuppressionDirectives(content, 'javascript'),
    calls: extractCallExpressions(strippedContent, locate),
    loops: extractJsLoops(strippedContent, locate),
    networkEvents: extractJsNetworkEvents(strippedContent, locate),
    eventHandlers: [],
    nuiCallbacks: [],
    exportsUsed: extractJsExportsUsages(strippedContent, locate),
    registeredExports: extractRegisteredExports(strippedContent, locate),
    innerHtmlAssignments: extractInnerHtmlAssignments(strippedContent, locate)
  };
}

function extractJsLoops(source, locate) {
  const loops = [];
  const patterns = [
    /while\s*\(\s*true\s*\)\s*\{/g,
    /for\s*\(\s*;\s*;\s*\)\s*\{/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const openBraceIndex = match.index + match[0].lastIndexOf('{');
      const closeBraceIndex = findMatchingDelimiter(source, openBraceIndex, '{', '}');
      if (closeBraceIndex === -1) {
        continue;
      }

      const body = source.slice(openBraceIndex + 1, closeBraceIndex);
      const location = locate(match.index);
      loops.push({
        line: location.line,
        column: location.column,
        body,
        hasWait: /\bWait\s*\(|\bDelay\s*\(/.test(body),
        waitZero: /\bWait\s*\(\s*0\s*\)|\bDelay\s*\(\s*0\s*\)/.test(body),
        hasTriggerServerEvent: /\bTriggerServerEvent\s*\(|\bemitNet\s*\(/.test(body)
      });
    }
  }

  return loops;
}

function extractJsNetworkEvents(source, locate) {
  const events = [];
  const pattern = /\b(?:onNet|RegisterNetEvent)\s*\(\s*(['\"])([^'\"]+)\1/g;

  for (const match of source.matchAll(pattern)) {
    const location = locate(match.index);
    events.push({
      name: match[2],
      line: location.line,
      column: location.column
    });
  }

  return events;
}

function extractJsExportsUsages(source, locate) {
  const usages = [];
  const patterns = [
    /exports\.([A-Za-z0-9_]+)\s*[.:][A-Za-z0-9_]+\s*\(/g,
    /exports\[['\"]([^'\"]+)['\"]\]\s*[.:][A-Za-z0-9_]+\s*\(/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const location = locate(match.index);
      usages.push({
        resourceName: match[1],
        line: location.line,
        column: location.column
      });
    }
  }

  return usages;
}

function extractRegisteredExports(source, locate) {
  const exportsList = [];
  const pattern = /\bexports\s*\(\s*['\"]([^'\"]+)['\"]/g;

  for (const match of source.matchAll(pattern)) {
    const location = locate(match.index);
    exportsList.push({
      name: match[1],
      line: location.line,
      column: location.column
    });
  }

  return exportsList;
}

function extractInnerHtmlAssignments(source, locate) {
  const findings = [];
  const pattern = /\.innerHTML\s*=\s*([^;\n]+)/g;

  for (const match of source.matchAll(pattern)) {
    const location = locate(match.index);
    findings.push({
      expression: match[1].trim(),
      line: location.line,
      column: location.column
    });
  }

  return findings;
}