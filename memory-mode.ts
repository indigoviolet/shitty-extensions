/**
 * Memory Mode Hook
 *
 * Save instructions to AGENTS.md files with AI-assisted integration.
 *
 * Features:
 * - /mem <instruction> command to save instructions
 * - Choose save location: Project Local, Project, or Global
 * - AI integrates instruction into existing file structure
 * - Preview changes before saving
 * - AGENTS.local.md auto-added to .gitignore
 *
 * Usage:
 * 1. Copy this file to ~/.pi/agent/hooks/ or your project's .pi/hooks/
 * 2. Use /mem <instruction> to save an instruction
 *
 * Example:
 *   /mem Never use git commands directly
 *   /mem Always use TypeScript strict mode
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { completeSimple } from "@mariozechner/pi-ai";
import type { HookAPI, HookContext } from "@mariozechner/pi-coding-agent/hooks";

interface SaveLocation {
	value: "local" | "project" | "global";
	label: string;
	description: string;
	filePath: string;
}

export default function (pi: HookAPI) {
	// Register /mem command
	pi.registerCommand("mem", {
		description: "Save an instruction to AGENTS.md (AI-assisted)",
		handler: async (args, ctx) => {
			const instruction = args.trim();
			if (!instruction) {
				ctx.ui.notify("Usage: /mem <instruction>", "warning");
				return;
			}

			await handleMemoryInstruction(pi, ctx, instruction);
		},
	});

	// Also register /remember as an alias
	pi.registerCommand("remember", {
		description: "Save an instruction to AGENTS.md (alias for /mem)",
		handler: async (args, ctx) => {
			const instruction = args.trim();
			if (!instruction) {
				ctx.ui.notify("Usage: /remember <instruction>", "warning");
				return;
			}

			await handleMemoryInstruction(pi, ctx, instruction);
		},
	});
}

async function handleMemoryInstruction(pi: HookAPI, ctx: HookContext, instruction: string): Promise<void> {
	const cwd = pi.cwd;
	const agentDir = getAgentDir();

	// Build list of save locations
	const locations: SaveLocation[] = [
		{
			value: "local",
			label: "Project Local",
			description: `${path.join(cwd, "AGENTS.local.md")} (gitignored, just for you)`,
			filePath: path.join(cwd, "AGENTS.local.md"),
		},
		{
			value: "project",
			label: "Project",
			description: `${path.join(cwd, "AGENTS.md")} (shared with team)`,
			filePath: path.join(cwd, "AGENTS.md"),
		},
		{
			value: "global",
			label: "Global",
			description: `${path.join(agentDir, "AGENTS.md")} (all your projects)`,
			filePath: path.join(agentDir, "AGENTS.md"),
		},
	];

	// Show location selector
	const selected = await ctx.ui.select(
		"Save instruction to:",
		locations.map((loc) => ({
			value: loc.value,
			label: loc.label,
			description: loc.description,
		})),
	);

	if (!selected) {
		return; // User cancelled
	}

	const location = locations.find((loc) => loc.value === selected.value);
	if (!location) {
		return;
	}

	// Read existing content
	let existingContent = "";
	if (fs.existsSync(location.filePath)) {
		existingContent = fs.readFileSync(location.filePath, "utf-8");
	}

	// Show loading notification
	ctx.ui.notify("Integrating instruction with AI...", "info");

	try {
		// Get model and API key
		const model = ctx.model;
		const apiKey = ctx.apiKey;

		if (!model || !apiKey) {
			throw new Error("No model or API key available");
		}

		// Call AI to integrate the instruction
		const systemPrompt = `You are helping to maintain an AGENTS.md file that provides instructions for an AI coding assistant.

Your task is to integrate a new instruction into the existing file content. Follow these rules:
- If the file is empty, create a well-structured markdown document with the instruction
- If the file has existing content, integrate the new instruction in the most appropriate location
- Group related instructions together under appropriate headings
- Avoid duplicating instructions - if a similar one exists, update it instead
- Maintain consistent formatting with the existing content
- Keep the file concise and well-organized
- Output ONLY the final file content, no explanations or markdown code fences`;

		const userPrompt = existingContent
			? `Here is the existing AGENTS.md content:

\`\`\`markdown
${existingContent}
\`\`\`

Please integrate this new instruction:
${instruction}

Output the complete updated file content:`
			: `The AGENTS.md file is currently empty. Please create it with this instruction:
${instruction}

Output the complete file content:`;

		const abortController = new AbortController();

		const response = await completeSimple(
			model,
			{
				systemPrompt,
				messages: [{ role: "user", content: [{ type: "text", text: userPrompt }], timestamp: Date.now() }],
			},
			{ apiKey, signal: abortController.signal, maxTokens: 4096 },
		);

		if (response.stopReason === "aborted") {
			return;
		}

		if (response.stopReason === "error") {
			throw new Error(response.errorMessage || "AI request failed");
		}

		// Extract the new content from AI response
		let newContent = response.content
			.filter((c): c is { type: "text"; text: string } => c.type === "text")
			.map((c) => c.text)
			.join("\n")
			.trim();

		// Remove markdown code fences if present
		if (newContent.startsWith("```markdown")) {
			newContent = newContent.slice(11);
		} else if (newContent.startsWith("```")) {
			newContent = newContent.slice(3);
		}
		if (newContent.endsWith("```")) {
			newContent = newContent.slice(0, -3);
		}
		newContent = newContent.trim();

		// Show preview and ask for confirmation
		const preview = `📄 ${location.filePath}\n\n${newContent}`;
		const confirmed = await ctx.ui.confirm("Save changes?", preview);

		if (confirmed) {
			// Ensure directory exists
			const dir = path.dirname(location.filePath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			// Write the file
			fs.writeFileSync(location.filePath, newContent);

			// If it's AGENTS.local.md, ensure it's in .gitignore
			if (location.value === "local") {
				ensureGitignore(cwd, "AGENTS.local.md");
			}

			ctx.ui.notify(`Saved to ${location.filePath}`, "success");
		}
	} catch (error) {
		ctx.ui.notify(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
	}
}

function getAgentDir(): string {
	const envDir = process.env.PI_CODING_AGENT_DIR;
	if (envDir) {
		return envDir;
	}
	const home = process.env.HOME || process.env.USERPROFILE || "";
	return path.join(home, ".pi", "agent");
}

function ensureGitignore(cwd: string, filename: string): void {
	const gitignorePath = path.join(cwd, ".gitignore");
	try {
		let content = "";
		if (fs.existsSync(gitignorePath)) {
			content = fs.readFileSync(gitignorePath, "utf-8");
		}

		// Check if already in .gitignore
		const lines = content.split("\n");
		if (lines.some((line) => line.trim() === filename)) {
			return;
		}

		// Add to .gitignore
		const newContent = `${content.trimEnd()}${content.endsWith("\n") ? "" : "\n"}${filename}\n`;
		fs.writeFileSync(gitignorePath, newContent);
	} catch {
		// Ignore errors - gitignore update is best-effort
	}
}
