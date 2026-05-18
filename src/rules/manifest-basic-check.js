export const meta = {
  id: 'manifest-basic-check',
  title: 'fxmanifest.lua should exist and contain required metadata',
  defaultSeverity: 'error',
  description: 'Ensures the resource manifest exists and declares fx_version and game.'
};

export function apply(context) {
  const findings = [];
  const { manifest } = context;

  if (!manifest.exists) {
    findings.push({
      ruleId: meta.id,
      file: manifest.relativePath,
      line: 1,
      column: 1,
      message: 'Resource manifest is missing.'
    });
    return findings;
  }

  if (!manifest.fxVersion) {
    findings.push({
      ruleId: meta.id,
      file: manifest.relativePath,
      line: 1,
      column: 1,
      message: 'fx_version is missing from the manifest.'
    });
  }

  if (manifest.games.length === 0) {
    findings.push({
      ruleId: meta.id,
      file: manifest.relativePath,
      line: 1,
      column: 1,
      message: 'game is missing from the manifest.'
    });
  }

  return findings;
}