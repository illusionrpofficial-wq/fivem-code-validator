import { createLineLocator, extractSuppressionDirectives } from '../utils/text.js';

export function parseGenericFile(target, content) {
  return {
    ...target,
    content,
    lines: content.split(/\r?\n/),
    strippedContent: content,
    locate: createLineLocator(content),
    suppressions: extractSuppressionDirectives(content, target.language),
    calls: [],
    loops: [],
    networkEvents: [],
    eventHandlers: [],
    nuiCallbacks: [],
    exportsUsed: [],
    registeredExports: [],
    innerHtmlAssignments: []
  };
}