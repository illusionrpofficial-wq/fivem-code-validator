# FiveM Resource Checker

`@sajat-org/fivem-checker` is a lightweight validator for FiveM resources. It is designed to run both as a reusable GitHub Action and as a CLI that other repos can call locally or from CI.

## Why use this?

FiveM resources often contain subtle security, manifest, and runtime issues that are hard to catch during development. This checker helps detect common mistakes early in CI before they reach production servers.

## Features

- Validates `fxmanifest.lua` presence and required metadata.
- Resolves manifest file references, checks `ui_page`, and detects undeclared web assets.
- Checks curated client/server/shared native side usage.
- Warns on suspicious native argument counts.
- Finds infinite loops without `Wait` or `Delay`.
- Enforces a configurable custom event prefix.
- Supports config validation, path ignores, inline suppressions, and baseline mode.
- Supports `--fail-on` for CI policy tuning and `--no-color` for plain logs.
- Detects common SQL string concatenation patterns.
- Flags config-like debug mode switches left enabled.
- Finds high-signal server event trust issues where client params reach money, item, or SQL operations.
- Warns about missing player validation, cooldown, and distance checks around sensitive reward-like events.
- Warns when sensitive handlers do not visibly validate `source` or required job/permission checks.
- Flags NUI `innerHTML` assignments from dynamic values.
- Detects `RegisterNUICallback` paths that forward raw `data.*` into `TriggerServerEvent`.
- Warns when exports or `lib.callback` are used without matching manifest dependencies.
- Warns when manifest exports are declared without matching `exports()` registration.

## Installation

Node.js 20+ is required.

Run without installing:

```bash
npx @sajat-org/fivem-checker .
```

Or install it as a dev dependency:

```bash
npm install -D @sajat-org/fivem-checker
```

Then add a script to `package.json`:

```json
{
  "scripts": {
    "check:fivem": "fivem-checker ."
  }
}
```

## CLI usage

Basic usage:

```bash
npx @sajat-org/fivem-checker .
```

Examples:

```bash
npx @sajat-org/fivem-checker . --sarif fivem-check.sarif
npx @sajat-org/fivem-checker . --stats-file fivem-check.stats.json
npx @sajat-org/fivem-checker . --format json
npx @sajat-org/fivem-checker . --config .fivemcheck.json
npx @sajat-org/fivem-checker . --fail-on warn
npx @sajat-org/fivem-checker . --write-baseline
npx @sajat-org/fivem-checker . --no-color
npx @sajat-org/fivem-checker . --offline
```

CLI options:

| Option | Description |
| --- | --- |
| `--config <path>` | Override the `.fivemcheck.json` location |
| `--sarif <path>` | Write SARIF output |
| `--stats-file <path>` | Write JSON stats output |
| `--baseline <path>` | Override the baseline file path |
| `--write-baseline [path]` | Write a baseline file and exit successfully |
| `--fail-on <level>` | Fail on `info`, `warn`, `error`, or `high` |
| `--format <text\|json>` | Select console output format |
| `--no-color` | Disable ANSI colors in text output |
| `--offline` | Skip remote native refresh |
| `--no-remote-natives` | Only use the bundled native catalog |
| `--help` | Show help |

## GitHub Action usage

```yaml
name: FiveM Check

on:
  push:
  pull_request:

jobs:
  fivem-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run FiveM checker
        uses: sajat-org/fivem-resource-checker@v1
        with:
          path: .
          sarif: fivem-check.sarif
          stats-file: fivem-check.stats.json
          fail-on: warn
          no-color: true

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: fivem-check.sarif
```

## GitHub Action inputs

| Input | Required | Description |
| --- | ---: | --- |
| `path` | no | Resource path to scan. Defaults to `.` |
| `config` | no | Custom config file path |
| `sarif` | no | SARIF output file path |
| `stats-file` | no | JSON statistics output file path |
| `baseline` | no | Baseline file path override |
| `fail-on` | no | Severity threshold that should fail the check. Defaults to `error` |
| `format` | no | Console output format. Defaults to `text` |
| `no-color` | no | Disable ANSI colors in text output |

The Action currently installs Node.js 22 internally before running the checker.

## Configuration

Create `.fivemcheck.json` in the resource repo:

```json
{
  "framework": "esx",
  "webDir": "web",
  "eventPrefix": "myresource:",
  "manifest": "fxmanifest.lua",
  "ignore": [
    "legacy/**",
    "web/vendor/**"
  ],
  "baseline": ".fivemcheck-baseline.json",
  "rules": {
    "native-side-check": "error",
    "native-arg-count": "warn",
    "no-loop-without-wait": "error",
    "client-controlled-money": "high",
    "client-controlled-item": "high",
    "sql-injection-check": "error",
    "nui-innerhtml-check": "warn"
  }
}
```

Top-level config fields:

| Field | Description |
| --- | --- |
| `framework` | Optional framework hint such as `esx` or `qbcore` |
| `webDir` | Optional UI directory to scan for NUI-related checks |
| `eventPrefix` | Prefix enforced by the `event-prefix-check` rule |
| `manifest` | Custom manifest filename. Defaults to `fxmanifest.lua` |
| `ignore` | Glob patterns that should be excluded from analysis |
| `baseline` | Baseline file path. Defaults to `.fivemcheck-baseline.json` |
| `rules` | Per-rule severity overrides |

## Ignore and suppressions

Ignore whole paths in config:

```json
{
  "ignore": [
    "legacy/**",
    "web/vendor/**"
  ]
}
```

Suppress a single rule for the next line:

```lua
-- fivem-check-disable-next-line no-loop-without-wait
while true do
  DoSomething()
end
```

Suppress a rule for the whole file:

```lua
-- fivem-check-disable event-prefix-check
RegisterNetEvent('legacy:event')
```

## Rules

Rule severities can be configured with the following levels:

| Level | Meaning |
| --- | --- |
| `off` | Disable the rule |
| `info` | Informational finding |
| `warn` | Show warning |
| `error` | Blocking error |
| `high` | Security-sensitive blocking finding |

Current built-in rules:

| Rule | Default | Purpose |
| --- | --- | --- |
| `manifest-basic-check` | `error` | Ensures the manifest exists and declares basic metadata |
| `manifest-files-check` | `error` | Checks that manifest file references resolve |
| `native-side-check` | `error` | Detects client-only/server-only native misuse |
| `native-arg-count` | `warn` | Warns on suspicious curated native argument counts |
| `no-loop-without-wait` | `error` | Flags infinite loops without `Wait`/`Delay` |
| `event-loop-spam` | `warn` | Warns when loops spam server events with `Wait(0)` |
| `event-prefix-check` | `warn` | Enforces a custom network event prefix |
| `sql-injection-check` | `error` | Finds common SQL string concatenation patterns |
| `debug-output-check` | `warn` | Flags config-like debug mode toggles left enabled |
| `client-controlled-money` | `high` | Detects client-controlled values reaching sensitive reward operations |
| `client-controlled-item` | `high` | Detects client-controlled values reaching sensitive item or weapon operations |
| `missing-source-validation` | `warn` | Warns when sensitive server events do not visibly reference or validate `source` |
| `net-event-player-validation` | `warn` | Warns when sensitive server events lack player validation |
| `net-event-missing-cooldown` | `warn` | Warns when reward-like events lack cooldown patterns |
| `net-event-missing-distance-check` | `warn` | Warns when reward-like events lack coords or distance checks |
| `missing-job-check` | `warn` | Warns when job-like events lack job or permission checks |
| `raw-sql-from-client` | `high` | Detects client-controlled values reaching SQL calls |
| `nui-innerhtml-check` | `warn` | Flags dynamic `innerHTML` assignments in NUI assets |
| `nui-callback-check` | `warn` | Flags raw NUI data flowing into server events |
| `manifest-missing-dependency` | `warn` | Detects used exports without manifest dependencies |
| `manifest-export-check` | `warn` | Detects manifest exports without matching code registration |

## Output formats

- Text report for humans.
- JSON report on stdout with `--format json`.
- SARIF for GitHub Code Scanning with `--sarif`.
- JSON stats file for aggregation or dashboards with `--stats-file`.
- Baseline file generation with `--write-baseline`.
- GitHub annotations when running inside GitHub Actions.

## Example output

```txt
[HIGH] client-controlled-money server.lua:5:3 Event giveMoney passes client-controlled value(s) amount into addMoney().
[ERROR] native-side-check server.lua:8:1 PlayerPedId() is client-only but is used in a server script.
[WARN] event-prefix-check server.lua:10:1 Event giveMoney should start with myresource:.
Summary: 3 active findings across 2 files (high: 1, error: 1, warn: 1, info: 0, suppressed: 0, baselined: 2, ignored files: 1, fail-on: error).
```

## Exit codes

- `0` — no blocking issues found
- `1` — one or more findings matched the configured `--fail-on` threshold
- `2` — checker runtime or configuration failure

## Notes on native metadata

The checker supports optional refresh from `https://runtime.fivem.net/doc/natives.json`, but that payload is not currently sufficient for reliable client/server-side detection on its own. The MVP therefore ships with a curated native cache and merges runtime metadata on top when useful.

## Non-goals

This checker is not a replacement for manual security review. It is designed to catch common high-signal mistakes, not to prove that a resource is fully secure.

## Limitations

This version is intentionally heuristic. It favors high-signal findings over full parsing and does not yet attempt full Lua AST analysis, inter-file taint tracking, or deep framework-specific dataflow. JavaScript support is currently pattern-based, and C# analysis is not implemented yet.

## Roadmap

- Full Lua AST-based analysis.
- Better JavaScript and C# support.
- Framework-specific ESX, QBCore, and QBOX rules.
- Inter-file event and dataflow tracking.
- Custom rule plugins.
