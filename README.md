# shitty-extensions

Custom hooks for [pi coding agent](https://github.com/badlogic/pi-mono).

## Available Hooks

### memory-mode.ts

Save instructions to AGENTS.md files with AI-assisted integration.

**Commands:**
- `/mem <instruction>` - Save an instruction
- `/remember <instruction>` - Alias for `/mem`

**Features:**
- Choose save location: Project Local, Project, or Global
- AI integrates instruction into existing file structure intelligently
- Groups related instructions under appropriate headings
- Avoids duplicating rules (updates existing ones instead)
- Preview changes before saving
- AGENTS.local.md auto-added to .gitignore

**Example:**
```
/mem Never use git commands directly
/mem Always use TypeScript strict mode
```

---

### plan-mode.ts

Claude Code-style "plan mode" for safe code exploration.

**Commands:**
- `/plan` - Toggle plan mode on/off
- `/todos` - Show current plan todo list

**Shortcut:**
- `Shift+P` - Toggle plan mode

**Features:**
- In plan mode: only read-only tools (read, bash read-only, grep, find, ls)
- Agent cannot modify files while planning
- Injects system context telling the agent about restrictions
- After each response, prompts to execute the plan or continue planning
- Shows "plan" indicator in footer when active
- Extracts todo list from plan and tracks progress during execution
- Uses ID-based tracking: agent outputs `[DONE:id]` to mark steps complete

**Example:**
```
/plan
> Analyze the codebase and create a plan to refactor the authentication module

# Agent explores code in read-only mode, creates a plan
# Then prompts: "Execute plan?" or "Continue planning?"
```

---

## Installation

### Option 1: Copy to hooks directory

```bash
# Global hooks (all projects)
cp memory-mode.ts ~/.pi/agent/hooks/
cp plan-mode.ts ~/.pi/agent/hooks/

# Project-local hooks
mkdir -p .pi/hooks
cp memory-mode.ts .pi/hooks/
cp plan-mode.ts .pi/hooks/
```

### Option 2: Add to settings.json

```json
{
  "hooks": [
    "/path/to/shitty-extensions/memory-mode.ts",
    "/path/to/shitty-extensions/plan-mode.ts"
  ]
}
```

### Option 3: Use --hook flag

```bash
pi --hook /path/to/shitty-extensions/memory-mode.ts
pi --hook /path/to/shitty-extensions/plan-mode.ts
```

## License

MIT
