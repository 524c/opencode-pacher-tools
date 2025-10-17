#!/usr/bin/env bun
/**
 * Apply All OpenCode Patches
 *
 * Unified script to apply all patches to OpenCode repository.
 * This ensures all customizations are applied in the correct order.
 *
 * Patches applied:
 * 1. agents-md-enforcement.patch - AGENTS.md rules survive summarization
 * 2. commit-hash-footer.patch - Display commit hash in TUI footer
 *
 * Usage:
 *   bun run tools/apply-all-patches.ts [command]
 *
 * Commands:
 *   apply   - Apply all patches (default)
 *   status  - Check which patches are applied
 *   help    - Show this help
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Patch definitions
interface Patch {
  name: string;
  file: string;
  description: string;
  checkApplied: () => Promise<boolean>;
}

// Detect patches directory relative to script location
// - Development: OPENCODE_PATCHER_DIR/tools/ (has tools/ subdirectory)
// - Installation: OPENCODE_PATCHER_DIR/ (flattened structure)
const SCRIPT_DIR = import.meta.dir;
const TOOLS_DIR =
  process.env.OPENCODE_PATCHER_DIR ||
  join(homedir(), ".local/bin/opencode-patcher-tools");
const PATCHES_DIR = join(TOOLS_DIR, "patches");

const PATCHES: Patch[] = [
  {
    name: "agents-md-enforcement",
    file: join(PATCHES_DIR, "agents-md-enforcement.patch"),
    description: "AGENTS.md rules survive conversation summarization",
    checkApplied: async () => {
      try {
        await $`grep -q "export type RulesPart" packages/opencode/src/session/message-v2.ts`.quiet();
        await $`grep -q "pinnedRulesMessages" packages/opencode/src/session/message-v2.ts`.quiet();
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    name: "commit-hash-footer",
    file: join(PATCHES_DIR, "commit-hash-footer.patch"),
    description: "Display commit hash in TUI footer",
    checkApplied: async () => {
      try {
        await $`grep -q "var CommitHash = " packages/tui/cmd/opencode/main.go`.quiet();
        await $`grep -q "CommitHash.*string" packages/tui/internal/app/app.go`.quiet();
        return true;
      } catch {
        return false;
      }
    },
  },
];

async function checkGitStatus() {
  try {
    const result = await $`git status --porcelain`.text();
    return result.trim().length === 0;
  } catch {
    return false;
  }
}

async function applyPatch(patch: Patch): Promise<boolean> {
  // Check if already applied
  if (await patch.checkApplied()) {
    return true;
  }

  // Check if patch file exists
  if (!existsSync(patch.file)) {
    console.error(`Patch file not found: ${patch.file}`);
    return false;
  }

  try {
    // Check if patch can be applied cleanly
    await $`git apply --check ${patch.file}`.quiet();

    // Apply the patch
    await $`git apply ${patch.file}`.quiet();

    return true;
  } catch (error) {
    // Check if changes are actually present despite error
    if (await patch.checkApplied()) {
      return true;
    }

    console.error(`Failed to apply patch: ${patch.name}`);
    console.error(`${error.message}`);
    return false;
  }
}

async function applyAllPatches() {
  const results = await Promise.all(PATCHES.map((patch) => applyPatch(patch)));

  const failed = results.filter((r) => !r).length;

  if (failed > 0) {
    console.error(`${failed} patch(es) failed to apply`);
    process.exit(1);
  }
}

async function showStatus() {
  console.log("📊 OpenCode Patches Status");
  console.log("=".repeat(50));

  for (const patch of PATCHES) {
    const applied = await patch.checkApplied();
    const status = applied ? "✅ Applied" : "❌ Not applied";

    console.log(`\n${patch.name}:`);
    console.log(`  Status: ${status}`);
    console.log(`  Description: ${patch.description}`);
    console.log(`  Patch file: ${patch.file}`);
  }

  console.log("\n" + "=".repeat(50));
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "apply";

  // Check if we're in a git repository
  if (!existsSync(".git")) {
    console.error("Not in a git repository");
    console.error("Please run from OpenCode root directory");
    process.exit(1);
  }

  // Check if patches directory exists
  if (!existsSync(PATCHES_DIR)) {
    console.error(`Patches directory not found: ${PATCHES_DIR}`);
    console.error("Please run 'oc-update-tools' to install patches");
    process.exit(1);
  }

  switch (command) {
    case "apply":
      const isClean = await checkGitStatus();
      if (!isClean) {
        console.warn("Working directory has uncommitted changes");
        console.warn("Patches will still be applied\n");
      }

      await applyAllPatches();
      break;

    case "status":
      await showStatus();
      break;

    case "help":
      console.log(`
OpenCode Patches Manager

Usage:
  bun run tools/apply-all-patches.ts [command]

Commands:
  apply   - Apply all patches (default)
  status  - Check which patches are applied
  help    - Show this help

Patches:
${PATCHES.map((p) => `  - ${p.name}: ${p.description}`).join("\n")}

Examples:
  bun run tools/apply-all-patches.ts apply   # Apply all patches
  bun run tools/apply-all-patches.ts status  # Check status
      `);
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.error("   Use 'help' to see available commands");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});
