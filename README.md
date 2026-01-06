# shitty-extensions

Custom hooks for [pi coding agent](https://github.com/badlogic/pi-mono).

## Table of Contents

- [Available Hooks](#available-hooks)
  - [memory-mode.ts](#memory-modets) - Save instructions to AGENTS.md
  - [plan-mode.ts](#plan-modets) - Read-only exploration mode
  - [handoff.ts](#handoffts) - Transfer context to new sessions
  - [usage-bar.ts](#usage-barts) - AI provider usage statistics
  - [ultrathink.ts](#ultrathinkts) - Rainbow animated "ultrathink" effect
  - [status-widget.ts](#status-widgetts) - Provider status in footer
  - [cost-tracker.ts](#cost-trackerts) - Session spending analysis
- [Installation](#installation)
- [License](#license)

---

## Available Hooks

### memory-mode.ts

Save instructions to AGENTS.md files with AI-assisted integration.

#### Commands

| Command | Description |
|---------|-------------|
| `/mem <instruction>` | Save an instruction to AGENTS.md |
| `/remember <instruction>` | Alias for `/mem` |

#### Features

- **Location selector**: Choose where to save:

  | Location | File | Use Case |
  |----------|------|----------|
  | Project Local | `./AGENTS.local.md` | Personal preferences, auto-added to `.gitignore` |
  | Project | `./AGENTS.md` | Shared with team |
  | Global | `~/.pi/agent/AGENTS.md` | All your projects |

- **AI-assisted integration**: The current model intelligently integrates instructions
- **Preview before save**: Review proposed changes before committing

---

### plan-mode.ts

Claude Code-style "plan mode" for safe code exploration.

#### Commands

| Command | Description |
|---------|-------------|
| `/plan` | Toggle plan mode on/off |
| `/todos` | Show current plan todo list |

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Shift+P` | Toggle plan mode |

#### CLI Flags

| Flag | Description |
|------|-------------|
| `--plan` | Start session in plan mode |

---

### handoff.ts

Transfer context to a new focused session.

#### Commands

| Command | Description |
|---------|-------------|
| `/handoff <goal>` | Generate a context-aware prompt for a new session |

---

### usage-bar.ts

Display AI provider usage statistics with status polling and reset countdowns.

#### Commands

| Command | Description |
|---------|-------------|
| `/usage` | Show usage statistics popup |

#### Supported Providers

| Provider | Metrics Shown | Auth Source |
|----------|---------------|-------------|
| **Claude** | 5h window, Week, Sonnet/Opus | pi auth, macOS Keychain |
| **Copilot** | Premium, Chat | pi auth, `gh auth token` |
| **Gemini** | Pro quota, Flash quota | pi auth (`google-gemini-cli`) |
| **Codex** | 5h window, Day, Credits | pi auth (`openai-codex`) |
| **Kiro** | Credits, Bonus credits | `kiro-cli` |
| **z.ai** | Token limits, Monthly | `Z_AI_API_KEY` env or pi auth |

#### Features

- **Provider status polling**: Shows outage/incident status
  - ✅ All systems operational
  - ⚠️ Minor incident
  - 🟠 Major incident  
  - 🔴 Critical outage
  - 🔧 Maintenance
- **Reset countdowns**: Shows when limits reset (e.g., "2h 30m", "3d 5h")
- **Visual progress bars**: Color-coded remaining quota (green → yellow → red)
- **Auto-filters**: Only shows providers you have credentials for

#### Example Output

```
╭─────────────────────────────────────────────╮
│ AI Usage                                    │
├─────────────────────────────────────────────┤
│ Claude ✅                                   │
│   5h      ████████░░░░  33%  ⏱2h 30m       │
│   Week    ██░░░░░░░░░░  85%                │
│                                             │
│ Codex (Plus $45.50) ⚠️                      │
│   ⚡ Partial System Degradation             │
│   5h      ████░░░░░░░░  67%  ⏱1h 45m       │
│   Day     ██████░░░░░░  50%                │
├─────────────────────────────────────────────┤
│ Press any key to close                      │
╰─────────────────────────────────────────────╯
```

---

### ultrathink.ts

Rainbow animated "ultrathink" text effect with Knight Rider shimmer.

#### Commands

| Command | Description |
|---------|-------------|
| `/ultrathink` | Trigger the rainbow animation |

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+U` | Trigger ultrathink |

#### Features

- **Auto-detect**: Triggers when you type "ultrathink" in your message
- **Rainbow colors**: Cycles through red, orange, yellow, green, cyan, blue, magenta
- **Knight Rider effect**: White shimmer sweeps across the text
- **3-second animation**: Shows above the editor, then fades away

---

### status-widget.ts

Persistent provider status indicator in the footer.

#### Commands

| Command | Description |
|---------|-------------|
| `/status` | Toggle status widget on/off |
| `/status-refresh` | Force refresh status now |

#### Features

- **Auto-start**: Enables automatically on session start
- **Auto-refresh**: Updates every 5 minutes
- **Providers monitored**: Claude, OpenAI, Gemini, GitHub

#### Footer Display

```
✅ Claude  ✅ OpenAI  ⚠️ Gemini  ✅ GitHub
```

---

### cost-tracker.ts

Analyze spending from pi session logs.

#### Commands

| Command | Description |
|---------|-------------|
| `/cost` | Show spending for last 30 days |
| `/cost <days>` | Show spending for last N days |

#### Features

- **Provider breakdown**: Shows spending by provider
- **Model breakdown**: Expandable view with per-model costs
- **Daily totals**: Token and cost summaries

#### Example Output

```
╭─────────────────────────────────────────────╮
│ 💰 Cost Tracker (Last 30 days)              │
├─────────────────────────────────────────────┤
│ Total: $24.56 (1,234,567 tokens)            │
│                                             │
│ By Provider:                                │
│   1. anthropic    $18.23  (74%)             │
│   2. openai       $6.33   (26%)             │
│                                             │
│ Press 1-2 to expand model breakdown         │
├─────────────────────────────────────────────┤
│ Press any key to close                      │
╰─────────────────────────────────────────────╯
```

---

## Installation

### Option 1: Copy to hooks directory

```bash
# Global hooks (all projects)
cp *.ts ~/.pi/agent/hooks/

# Or project-local hooks
mkdir -p .pi/hooks
cp *.ts .pi/hooks/
```

### Option 2: Add to settings.json

Add to `~/.pi/agent/settings.json`:

```json
{
  "hooks": [
    "/path/to/shitty-extensions/memory-mode.ts",
    "/path/to/shitty-extensions/plan-mode.ts",
    "/path/to/shitty-extensions/handoff.ts",
    "/path/to/shitty-extensions/usage-bar.ts",
    "/path/to/shitty-extensions/ultrathink.ts",
    "/path/to/shitty-extensions/status-widget.ts",
    "/path/to/shitty-extensions/cost-tracker.ts"
  ]
}
```

### Option 3: Use -e flag

```bash
pi -e /path/to/shitty-extensions/usage-bar.ts \
   -e /path/to/shitty-extensions/ultrathink.ts \
   -e /path/to/shitty-extensions/status-widget.ts
```

---

## License

MIT
