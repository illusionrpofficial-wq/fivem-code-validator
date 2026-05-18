import {
  createLineLocator,
  extractCallExpressions,
  extractSuppressionDirectives,
  stripCommentsPreserveLines
} from '../utils/text.js';

export function parseLuaFile(target, content) {
  const strippedContent = stripCommentsPreserveLines(content, 'lua');
  const locate = createLineLocator(content);

  return {
    ...target,
    content,
    lines: content.split(/\r?\n/),
    strippedContent,
    locate,
    suppressions: extractSuppressionDirectives(content, 'lua'),
    calls: extractCallExpressions(strippedContent, locate),
    loops: extractLuaLoops(strippedContent, locate),
    networkEvents: extractLuaNetworkEvents(strippedContent, locate),
    eventHandlers: extractLuaEventHandlers(strippedContent, locate),
    nuiCallbacks: extractLuaNuiCallbacks(strippedContent, locate),
    exportsUsed: extractLuaExportsUsages(strippedContent, locate),
    registeredExports: extractRegisteredExports(strippedContent, locate),
    innerHtmlAssignments: []
  };
}

function extractLuaLoops(source, locate) {
  const loops = [];
  const pattern = /while\s+true\s+do/g;

  for (const match of source.matchAll(pattern)) {
    const bodyStart = match.index + match[0].length;
    const bodyEnd = findLuaBlockEnd(source, bodyStart);
    if (bodyEnd === -1) {
      continue;
    }

    const body = source.slice(bodyStart, bodyEnd);
    const location = locate(match.index);
    loops.push({
      line: location.line,
      column: location.column,
      body,
      hasWait: /\bWait\s*\(/.test(body),
      waitZero: /\bWait\s*\(\s*0\s*\)/.test(body),
      hasTriggerServerEvent: /\bTriggerServerEvent\s*\(/.test(body)
    });
  }

  return loops;
}

function extractLuaNetworkEvents(source, locate) {
  const events = [];
  const pattern = /\b(?:RegisterNetEvent|RegisterServerEvent|lib\.callback\.register)\s*\(\s*(['"])([^'"]+)\1/g;

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

function extractLuaEventHandlers(source, locate) {
  return [
    ...extractFunctionHandlers(source, locate, 'AddEventHandler'),
    ...extractFunctionHandlers(source, locate, 'RegisterNetEvent'),
    ...extractFunctionHandlers(source, locate, 'RegisterServerEvent'),
    ...extractFunctionHandlers(source, locate, 'lib.callback.register')
  ];
}

function extractLuaNuiCallbacks(source, locate) {
  return extractFunctionHandlers(source, locate, 'RegisterNUICallback');
}

function extractFunctionHandlers(source, locate, functionName) {
  const handlers = [];
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escapedName}\\s*\\(\\s*(['\"])([^'\"]+)\\1\\s*,\\s*function\\s*\\(([^)]*)\\)`, 'g');

  for (const match of source.matchAll(pattern)) {
    const bodyStart = match.index + match[0].length;
    const bodyEnd = findLuaBlockEnd(source, bodyStart);
    if (bodyEnd === -1) {
      continue;
    }

    const location = locate(match.index);
    handlers.push({
      name: match[2],
      params: splitParams(match[3]),
      body: source.slice(bodyStart, bodyEnd),
      bodyStartIndex: bodyStart,
      line: location.line,
      column: location.column,
      sourceFunction: functionName
    });
  }

  return handlers;
}

function extractLuaExportsUsages(source, locate) {
  const usages = [];
  const patterns = [
    /exports\.([A-Za-z0-9_]+)\s*[.:][A-Za-z0-9_]+\s*\(/g,
    /exports\[['"]([^'"]+)['"]\]\s*[.:][A-Za-z0-9_]+\s*\(/g
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
  const pattern = /\bexports\s*\(\s*['"]([^'"]+)['"]/g;

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

function splitParams(rawParams) {
  return rawParams
    .split(',')
    .map((param) => param.trim())
    .filter(Boolean);
}

function findLuaBlockEnd(source, startIndex) {
  const tokenPattern = /\b(function|if|for|while|repeat|end|until)\b/g;
  tokenPattern.lastIndex = startIndex;
  let depth = 1;

  for (const match of source.matchAll(tokenPattern)) {
    if (match.index < startIndex) {
      continue;
    }

    const token = match[1];
    if (['function', 'if', 'for', 'while', 'repeat'].includes(token)) {
      depth += 1;
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return match.index;
    }
  }

  return -1;
}