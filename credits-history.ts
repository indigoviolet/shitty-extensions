/**
 * Credits History Extension - Shows spending history as text-based charts
 * Run /credits to see daily spending over time
 * 
 * Uses data from pi session logs (same as cost-tracker)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Theme, visibleWidth } from "@mariozechner/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ============================================================================
// Types
// ============================================================================

interface DailySpending {
	date: string;
	cost: number;
	tokens: number;
	providers: Record<string, number>;
}

interface SpendingData {
	days: DailySpending[];
	totalCost: number;
	totalTokens: number;
	byProvider: Record<string, number>;
}

// ============================================================================
// Session Log Parsing
// ============================================================================

function getSessionLogDir(): string {
	return path.join(os.homedir(), ".pi", "agent", "sessions");
}

function parseSessionLogs(daysBack: number = 30): SpendingData {
	const logDir = getSessionLogDir();
	if (!fs.existsSync(logDir)) {
		return { days: [], totalCost: 0, totalTokens: 0, byProvider: {} };
	}

	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - daysBack);

	const dailyData: Map<string, DailySpending> = new Map();
	const byProvider: Record<string, number> = {};
	let totalCost = 0;
	let totalTokens = 0;

	// Read session directories
	const sessions = fs.readdirSync(logDir).filter(f => {
		const stat = fs.statSync(path.join(logDir, f));
		return stat.isDirectory() && stat.mtime >= cutoffDate;
	});

	for (const session of sessions) {
		const sessionPath = path.join(logDir, session);
		const files = fs.readdirSync(sessionPath).filter(f => f.endsWith(".jsonl"));

		for (const file of files) {
			const filePath = path.join(sessionPath, file);
			const content = fs.readFileSync(filePath, "utf-8");

			for (const line of content.split("\n")) {
				if (!line.trim()) continue;
				try {
					const entry = JSON.parse(line);
					
					// Look for usage/cost data
					const usage = entry.usage || entry.response?.usage;
					if (!usage) continue;

					const cost = usage.cost || usage.totalCost || 0;
					const tokens = usage.total_tokens || usage.totalTokens || 
						(usage.input_tokens || 0) + (usage.output_tokens || 0);
					const provider = entry.provider || entry.model?.split("/")[0] || "unknown";

					if (cost > 0 || tokens > 0) {
						const date = new Date(entry.timestamp || entry.time || Date.now());
						const dateKey = date.toISOString().split("T")[0];

						if (!dailyData.has(dateKey)) {
							dailyData.set(dateKey, { date: dateKey, cost: 0, tokens: 0, providers: {} });
						}

						const day = dailyData.get(dateKey)!;
						day.cost += cost;
						day.tokens += tokens;
						day.providers[provider] = (day.providers[provider] || 0) + cost;

						byProvider[provider] = (byProvider[provider] || 0) + cost;
						totalCost += cost;
						totalTokens += tokens;
					}
				} catch {}
			}
		}
	}

	// Sort by date
	const days = Array.from(dailyData.values()).sort((a, b) => a.date.localeCompare(b.date));

	return { days, totalCost, totalTokens, byProvider };
}

// ============================================================================
// Chart Rendering
// ============================================================================

function renderBarChart(data: SpendingData, width: number, theme: Theme): string[] {
	const t = theme;
	const lines: string[] = [];
	const accent = (s: string) => t.fg("accent", s);
	const dim = (s: string) => t.fg("muted", s);
	const bold = (s: string) => t.bold(s);

	if (data.days.length === 0) {
		lines.push(dim("No spending data found"));
		return lines;
	}

	// Calculate max cost for scaling
	const maxCost = Math.max(...data.days.map(d => d.cost), 0.01);
	const chartWidth = Math.min(width - 20, 50);

	lines.push(bold(accent("📊 Daily Spending (Last 30 Days)")));
	lines.push("");

	// Show last 14 days in the chart
	const recentDays = data.days.slice(-14);
	
	for (const day of recentDays) {
		const barLen = Math.round((day.cost / maxCost) * chartWidth);
		const bar = "█".repeat(Math.max(1, barLen));
		const dateLabel = day.date.slice(5); // MM-DD
		const costLabel = `$${day.cost.toFixed(2)}`;
		
		// Color based on cost
		const color = day.cost > maxCost * 0.8 ? "error" 
			: day.cost > maxCost * 0.5 ? "warning" 
			: "success";
		
		lines.push(`${dim(dateLabel)} ${t.fg(color, bar)} ${dim(costLabel)}`);
	}

	lines.push("");
	lines.push(dim("─".repeat(Math.min(width, 60))));

	// Summary stats
	lines.push(bold("Summary"));
	lines.push(`  Total: ${accent(`$${data.totalCost.toFixed(2)}`)}`);
	lines.push(`  Tokens: ${dim(data.totalTokens.toLocaleString())}`);
	
	if (data.days.length > 0) {
		const avgDaily = data.totalCost / data.days.length;
		lines.push(`  Avg/day: ${dim(`$${avgDaily.toFixed(2)}`)}`);
	}

	// Provider breakdown
	const sortedProviders = Object.entries(data.byProvider)
		.sort(([,a], [,b]) => b - a)
		.slice(0, 5);

	if (sortedProviders.length > 0) {
		lines.push("");
		lines.push(bold("By Provider"));
		for (const [provider, cost] of sortedProviders) {
			const percent = ((cost / data.totalCost) * 100).toFixed(0);
			lines.push(`  ${provider}: ${accent(`$${cost.toFixed(2)}`)} ${dim(`(${percent}%)`)}`);
		}
	}

	return lines;
}

function renderSparkline(data: SpendingData, width: number): string {
	if (data.days.length === 0) return "";
	
	const sparkChars = "▁▂▃▄▅▆▇█";
	const maxCost = Math.max(...data.days.map(d => d.cost), 0.01);
	
	// Take last N days that fit
	const days = data.days.slice(-Math.min(width, data.days.length));
	
	let sparkline = "";
	for (const day of days) {
		const idx = Math.min(
			Math.floor((day.cost / maxCost) * (sparkChars.length - 1)),
			sparkChars.length - 1
		);
		sparkline += sparkChars[idx];
	}
	
	return sparkline;
}

// ============================================================================
// UI Component
// ============================================================================

class CreditsHistoryComponent {
	private data: SpendingData | null = null;
	private loading = true;
	private tui: { requestRender: () => void };
	private theme: Theme;
	private onClose: () => void;
	private days: number;

	constructor(tui: { requestRender: () => void }, theme: Theme, onClose: () => void, days: number = 30) {
		this.tui = tui;
		this.theme = theme;
		this.onClose = onClose;
		this.days = days;
		this.load();
	}

	private async load() {
		this.data = parseSessionLogs(this.days);
		this.loading = false;
		this.tui.requestRender();
	}

	handleInput(_data: string): void {
		this.onClose();
	}

	invalidate(): void {}

	render(width: number): string[] {
		const t = this.theme;
		const lines: string[] = [];

		const accent = (s: string) => t.fg("accent", s);
		const dim = (s: string) => t.fg("muted", s);
		const bold = (s: string) => t.bold(s);

		const hLine = "─".repeat(width - 2);
		const boxLine = (content: string) => {
			const vis = visibleWidth(content);
			const pad = Math.max(0, width - 4 - vis);
			return dim("│ ") + content + " ".repeat(pad) + dim(" │");
		};

		lines.push(dim(`╭${hLine}╮`));
		lines.push(boxLine(bold(accent("💰 Credits History"))));
		lines.push(dim(`├${hLine}┤`));

		if (this.loading) {
			lines.push(boxLine("Loading..."));
		} else if (this.data) {
			const chartLines = renderBarChart(this.data, width - 4, this.theme);
			for (const line of chartLines) {
				lines.push(boxLine(line));
			}

			// Sparkline at the bottom
			if (this.data.days.length > 0) {
				lines.push(boxLine(""));
				const sparkline = renderSparkline(this.data, width - 10);
				lines.push(boxLine(dim("Trend: ") + sparkline));
			}
		}

		lines.push(dim(`├${hLine}┤`));
		lines.push(boxLine(dim("Press any key to close")));
		lines.push(dim(`╰${hLine}╯`));

		return lines;
	}

	dispose(): void {}
}

// ============================================================================
// Hook
// ============================================================================

export default function (pi: ExtensionAPI) {
	pi.registerCommand("credits", {
		description: "Show spending history chart",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Credits requires interactive mode", "error");
				return;
			}

			const days = args[0] ? parseInt(args[0], 10) : 30;
			
			await ctx.ui.custom((tui, theme, done) => {
				return new CreditsHistoryComponent(tui, theme, () => done(undefined), days);
			});
		},
	});

	// Also add a sparkline command for quick view
	pi.registerCommand("spark", {
		description: "Show quick spending sparkline",
		handler: async (args, ctx) => {
			const days = args[0] ? parseInt(args[0], 10) : 30;
			const data = parseSessionLogs(days);
			
			if (data.days.length === 0) {
				ctx.ui.notify("No spending data found", "info");
				return;
			}

			const sparkline = renderSparkline(data, 40);
			const total = `$${data.totalCost.toFixed(2)}`;
			ctx.ui.notify(`${sparkline} Total: ${total}`, "info");
		},
	});
}
