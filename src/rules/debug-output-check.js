export const meta = {
  id: 'debug-output-check',
  title: 'Debug mode appears enabled in configuration',
  defaultSeverity: 'warn',
  description: 'Finds config-like debug flags left enabled, which means verbose logging or temporary traces are likely still active.',
  suggestion: 'Set debug flags such as Config.Debug or debugMode to false before release.'
};

export function apply(context) {
  const findings = [];
  const debugFlagPattern = /\b(?:Config\.)?(?:Debug|DebugMode|DebugLogs?|VerboseLogging|EnableDebug|debug|debugMode|debugLogs?|enableDebug)\s*=\s*true\b/g;

  for (const analysis of context.analyses) {
    if (!isConfigLikeFile(analysis.relativePath)) {
      continue;
    }

    for (const match of analysis.strippedContent.matchAll(debugFlagPattern)) {
      const location = analysis.locate(match.index);
      findings.push({
        ruleId: meta.id,
        file: analysis.relativePath,
        line: location.line,
        column: location.column,
        message: 'A debug flag appears to be enabled and may expose temporary logging in production.'
      });
    }
  }

  return findings;
}

function isConfigLikeFile(relativePath) {
  return /(?:^|\/)(config|shared|settings)/i.test(relativePath);
}