/**
 * Usage Bar Hook - Shows AI provider usage stats like CodexBar
 * Run /usage to see usage for Claude, Copilot, Gemini
 */

import type { HookAPI } from "@mariozechner/pi-coding-agent/hooks";
import { visibleWidth } from "@mariozechner/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";

// ============================================================================
// Types
// ============================================================================

interface RateWindow {
	label: string;
	usedPercent: number;
	resetDescription?: string;
}

interface UsageSnapshot {
	provider: string;
	displayName: string;
	windows: RateWindow[];
	plan?: string;
	error?: string;
}

// ============================================================================
// Claude Usage
// ============================================================================

function loadClaudeToken(): string | undefined {
	// Try pi's auth.json first (has user:profile scope)
	const piAuthPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
	try {
		if (fs.existsSync(piAuthPath)) {
			const data = JSON.parse(fs.readFileSync(piAuthPath, "utf-8"));
			if (data.anthropic?.access) return data.anthropic.access;
		}
	} catch {}

	// Fallback to Claude CLI keychain (macOS)
	try {
		const keychainData = execSync(
			'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
			{ encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
		).trim();
		if (keychainData) {
			const parsed = JSON.parse(keychainData);
			const scopes = parsed.claudeAiOauth?.scopes || [];
			if (scopes.includes("user:profile") && parsed.claudeAiOauth?.accessToken) {
				return parsed.claudeAiOauth.accessToken;
			}
		}
	} catch {}

	return undefined;
}

async function fetchClaudeUsage(): Promise<UsageSnapshot> {
	const token = loadClaudeToken();
	if (!token) {
		return { provider: "anthropic", displayName: "Claude", windows: [], error: "No credentials" };
	}

	try {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 5000);

		const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
			headers: {
				Authorization: `Bearer ${token}`,
				"anthropic-beta": "oauth-2025-04-20",
			},
			signal: controller.signal,
		});

		if (!res.ok) {
			return { provider: "anthropic", displayName: "Claude", windows: [], error: `HTTP ${res.status}` };
		}

		const data = await res.json() as any;
		const windows: RateWindow[] = [];

		if (data.five_hour?.utilization !== undefined) {
			windows.push({
				label: "5h",
				usedPercent: data.five_hour.utilization,
				resetDescription: data.five_hour.resets_at ? formatReset(new Date(data.five_hour.resets_at)) : undefined,
			});
		}

		if (data.seven_day?.utilization !== undefined) {
			windows.push({
				label: "Week",
				usedPercent: data.seven_day.utilization,
				resetDescription: data.seven_day.resets_at ? formatReset(new Date(data.seven_day.resets_at)) : undefined,
			});
		}

		const modelWindow = data.seven_day_sonnet || data.seven_day_opus;
		if (modelWindow?.utilization !== undefined) {
			windows.push({
				label: data.seven_day_sonnet ? "Sonnet" : "Opus",
				usedPercent: modelWindow.utilization,
			});
		}

		return { provider: "anthropic", displayName: "Claude", windows };
	} catch (e) {
		return { provider: "anthropic", displayName: "Claude", windows: [], error: String(e) };
	}
}

// ============================================================================
// Copilot Usage
// ============================================================================

function loadCopilotToken(): string | undefined {
	const authPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
	try {
		if (fs.existsSync(authPath)) {
			const data = JSON.parse(fs.readFileSync(authPath, "utf-8"));
			if (data["github-copilot"]?.access) return data["github-copilot"].access;
		}
	} catch {}

	try {
		return execSync("gh auth token 2>/dev/null", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
	} catch {}

	return undefined;
}

async function fetchCopilotUsage(): Promise<UsageSnapshot> {
	const token = loadCopilotToken();
	if (!token) {
		return { provider: "copilot", displayName: "Copilot", windows: [], error: "No token" };
	}

	try {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 5000);

		const res = await fetch("https://api.github.com/copilot_internal/user", {
			headers: {
				Authorization: `token ${token}`,
				"Editor-Version": "vscode/1.96.2",
				"User-Agent": "GitHubCopilotChat/0.26.7",
				"X-Github-Api-Version": "2025-04-01",
			},
			signal: controller.signal,
		});

		if (!res.ok) {
			return { provider: "copilot", displayName: "Copilot", windows: [], error: `HTTP ${res.status}` };
		}

		const data = await res.json() as any;
		const windows: RateWindow[] = [];

		if (data.quota_snapshots?.premium_interactions) {
			windows.push({
				label: "Premium",
				usedPercent: Math.max(0, 100 - (data.quota_snapshots.premium_interactions.percent_remaining || 0)),
			});
		}

		if (data.quota_snapshots?.chat) {
			windows.push({
				label: "Chat",
				usedPercent: Math.max(0, 100 - (data.quota_snapshots.chat.percent_remaining || 0)),
			});
		}

		return {
			provider: "copilot",
			displayName: "Copilot",
			windows,
			plan: data.copilot_plan,
		};
	} catch (e) {
		return { provider: "copilot", displayName: "Copilot", windows: [], error: String(e) };
	}
}

// ============================================================================
// Gemini Usage
// ============================================================================

function loadGeminiToken(): string | undefined {
	const credPath = path.join(os.homedir(), ".gemini", "oauth_creds.json");
	try {
		if (fs.existsSync(credPath)) {
			const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
			return data.access_token;
		}
	} catch {}
	return undefined;
}

async function fetchGeminiUsage(): Promise<UsageSnapshot> {
	const token = loadGeminiToken();
	if (!token) {
		return { provider: "gemini", displayName: "Gemini", windows: [], error: "No credentials" };
	}

	try {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 5000);

		const res = await fetch("https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota", {
			method: "POST",
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
			body: "{}",
			signal: controller.signal,
		});

		if (!res.ok) {
			return { provider: "gemini", displayName: "Gemini", windows: [], error: `HTTP ${res.status}` };
		}

		const data = await res.json() as any;
		const quotas: Record<string, number> = {};

		for (const bucket of data.buckets || []) {
			const model = bucket.modelId || "unknown";
			const frac = bucket.remainingFraction ?? 1;
			if (!quotas[model] || frac < quotas[model]) quotas[model] = frac;
		}

		const windows: RateWindow[] = [];
		let proMin = 1, flashMin = 1;

		for (const [model, frac] of Object.entries(quotas)) {
			if (model.toLowerCase().includes("pro") && frac < proMin) proMin = frac;
			if (model.toLowerCase().includes("flash") && frac < flashMin) flashMin = frac;
		}

		if (proMin < 1) windows.push({ label: "Pro", usedPercent: (1 - proMin) * 100 });
		if (flashMin < 1) windows.push({ label: "Flash", usedPercent: (1 - flashMin) * 100 });

		return { provider: "gemini", displayName: "Gemini", windows };
	} catch (e) {
		return { provider: "gemini", displayName: "Gemini", windows: [], error: String(e) };
	}
}

// ============================================================================
// Helpers
// ============================================================================

function formatReset(date: Date): string {
	const diffMins = Math.floor((date.getTime() - Date.now()) / 60000);
	if (diffMins < 0) return "now";
	if (diffMins < 60) return `${diffMins}m`;
	const hours = Math.floor(diffMins / 60);
	if (hours < 24) return `${hours}h`;
	return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

// ============================================================================
// UI Component
// ============================================================================

class UsageComponent {
	private usages: UsageSnapshot[] = [];
	private loading = true;
	private tui: { requestRender: () => void };
	private theme: any;
	private onClose: () => void;

	constructor(tui: { requestRender: () => void }, theme: any, onClose: () => void) {
		this.tui = tui;
		this.theme = theme;
		this.onClose = onClose;
		this.load();
	}

	private async load() {
		const timeout = <T>(p: Promise<T>, ms: number, fallback: T) =>
			Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

		const [claude, copilot, gemini] = await Promise.all([
			timeout(fetchClaudeUsage(), 6000, { provider: "anthropic", displayName: "Claude", windows: [], error: "Timeout" }),
			timeout(fetchCopilotUsage(), 6000, { provider: "copilot", displayName: "Copilot", windows: [], error: "Timeout" }),
			timeout(fetchGeminiUsage(), 6000, { provider: "gemini", displayName: "Gemini", windows: [], error: "Timeout" }),
		]);

		this.usages = [claude, copilot, gemini];
		this.loading = false;
		this.tui.requestRender();
	}

	handleInput(_data: string): void {
		this.onClose();
	}

	invalidate(): void {}

	render(width: number): string[] {
		const t = this.theme;
		const dim = (s: string) => t.fg("muted", s);
		const bold = (s: string) => t.bold(s);
		const accent = (s: string) => t.fg("accent", s);

		// Box dimensions: total width includes borders
		const totalW = Math.min(55, width - 4);
		const innerW = totalW - 4; // subtract "│ " and " │"
		const hLine = "─".repeat(totalW - 2); // subtract corners

		const box = (content: string) => {
			const contentW = visibleWidth(content);
			const pad = Math.max(0, innerW - contentW);
			return dim("│ ") + content + " ".repeat(pad) + dim(" │");
		};

		const lines: string[] = [];
		lines.push(dim(`╭${hLine}╮`));
		lines.push(box(bold(accent("AI Usage"))));
		lines.push(dim(`├${hLine}┤`));

		if (this.loading) {
			lines.push(box("Loading..."));
		} else {
			for (const u of this.usages) {
				const planStr = u.plan ? dim(` (${u.plan})`) : "";
				lines.push(box(bold(u.displayName) + planStr));

				if (u.error) {
					lines.push(box(dim(`  ${u.error}`)));
				} else if (u.windows.length === 0) {
					lines.push(box(dim("  No data")));
				} else {
					for (const w of u.windows) {
						const remaining = Math.max(0, 100 - w.usedPercent);
						const barW = 12;
						const filled = Math.round((w.usedPercent / 100) * barW);
						const empty = barW - filled;
						const color = remaining <= 10 ? "error" : remaining <= 30 ? "warning" : "success";
						const bar = t.fg(color, "█".repeat(filled)) + dim("░".repeat(empty));
						const reset = w.resetDescription ? dim(` (${w.resetDescription})`) : "";
						lines.push(box(`  ${w.label.padEnd(7)} ${bar} ${remaining.toFixed(0).padStart(3)}%${reset}`));
					}
				}
				lines.push(box(""));
			}
		}

		lines.push(dim(`├${hLine}┤`));
		lines.push(box(dim("Press any key to close")));
		lines.push(dim(`╰${hLine}╯`));

		return lines;
	}

	dispose(): void {}
}

// ============================================================================
// Hook
// ============================================================================

export default function (pi: HookAPI) {
	pi.registerCommand("usage", {
		description: "Show AI provider usage statistics",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Usage requires interactive mode", "error");
				return;
			}

			await ctx.ui.custom((tui, theme, done) => {
				return new UsageComponent(tui, theme, () => done(undefined));
			});
		},
	});
}
