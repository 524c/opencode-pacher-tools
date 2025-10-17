#!/usr/bin/env bun
/**
 * AGENTS.md Enforcement Patch Application Script
 *
 * Automatically applies the AGENTS.md enforcement patch to OpenCode.
 * This patch ensures AGENTS.md rules survive conversation summarization
 * by moving them from system prompts to pinned conversation messages.
 *
 * Usage:
 *   bun run script/apply-agents-patch.ts [command]
 *   bun run script/apply-agents-patch.ts apply --pull  # Pull from SST remote first
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Try installed patch first, fallback to repo patch
const INSTALLED_PATCH = join(
  homedir(),
  ".local/bin/opencode-patcher-tools/patches/agents-md-enforcement.patch",
);
const REPO_PATCH = "patches/agents-md-enforcement.patch";
const PATCH_FILE = existsSync(INSTALLED_PATCH) ? INSTALLED_PATCH : REPO_PATCH;
const MARKER_FILE = ".agents-patch-applied";

async function pullSSTRemote() {
  console.log("🔄 Pulling latest changes from SST remote...");

  try {
    // Check if sst remote exists
    const remotes = await $`git remote`.text();
    if (!remotes.includes("sst")) {
      console.log("⚠️  SST remote not configured");
      console.log(
        "   Add with: git remote add sst https://github.com/sst/opencode",
      );
      return false;
    }

    // Fetch from sst remote
    await $`git fetch sst`;
    console.log("✅ Fetched from SST remote");

    // Get current branch
    const currentBranch = await $`git branch --show-current`.text();
    const branch = currentBranch.trim();

    if (!branch) {
      console.log("⚠️  Detached HEAD state detected, skipping pull");
      return false;
    }

    // Pull from sst remote
    console.log(`   Pulling sst/${branch}...`);
    await $`git pull sst ${branch} --no-edit`;
    console.log(`✅ Pulled latest changes from sst/${branch}`);

    return true;
  } catch (error) {
    console.log(
      "⚠️  Could not pull from SST remote (may not exist or conflicts)",
    );
    console.log("   Continuing with current code...");
    return false;
  }
}

async function checkGitStatus() {
  try {
    const result = await $`git status --porcelain`.text();
    return result.trim().length === 0;
  } catch {
    return false;
  }
}

async function isPatchApplied() {
  // Check if the actual changes are present in the code
  try {
    await $`grep -q "export type RulesPart" packages/opencode/src/session/message-v2.ts`.quiet();
    await $`grep -q "pinnedRulesMessages" packages/opencode/src/session/message-v2.ts`.quiet();
    await $`grep -q "SystemPrompt.custom()))" packages/opencode/src/session/prompt.ts`.quiet();
    return true;
  } catch {
    return false;
  }
}

async function applyPatch() {
  console.log("🔧 Applying AGENTS.md enforcement patch...");

  // First check if changes are already present in the code
  if (await isPatchApplied()) {
    await Bun.write(
      MARKER_FILE,
      JSON.stringify(
        {
          applied: new Date().toISOString(),
          patch: PATCH_FILE,
          description:
            "AGENTS.md enforcement patch - detected as already applied in code",
        },
        null,
        2,
      ),
    );
    console.log("✅ Patch changes already present in code!");
    console.log("   - RulesPart type found in message system");
    console.log("   - Rules survive conversation summarization");
    console.log("   - Created marker file to track patch status");
    return true;
  }

  try {
    // Check if patch can be applied cleanly
    await $`git apply --check ${PATCH_FILE}`.quiet();

    // Apply the patch
    await $`git apply ${PATCH_FILE}`;

    // Create marker file
    await Bun.write(
      MARKER_FILE,
      JSON.stringify(
        {
          applied: new Date().toISOString(),
          patch: PATCH_FILE,
          description:
            "AGENTS.md enforcement patch - moves rules to conversation context",
        },
        null,
        2,
      ),
    );

    console.log("✅ AGENTS.md enforcement patch applied successfully!");
    console.log("   - RulesPart type added to message system");
    console.log("   - Rules now survive conversation summarization");
    console.log(
      "   - System prompt injection disabled in favor of conversation context",
    );

    return true;
  } catch (error) {
    console.error("❌ Failed to apply patch:");
    console.error(error.message);

    // Final fallback: check if changes are actually present despite error
    if (await isPatchApplied()) {
      await Bun.write(
        MARKER_FILE,
        JSON.stringify(
          {
            applied: new Date().toISOString(),
            patch: PATCH_FILE,
            description:
              "AGENTS.md enforcement patch - detected as already applied despite git error",
          },
          null,
          2,
        ),
      );
      console.log("⚠️  Git apply failed but changes are present in code!");
      console.log("✅ Created marker file to track patch status");
      return true;
    }

    return false;
  }
}

async function revertPatch() {
  console.log("🔄 Reverting AGENTS.md enforcement patch...");

  try {
    await $`git apply --reverse ${PATCH_FILE}`;

    if (existsSync(MARKER_FILE)) {
      await $`rm ${MARKER_FILE}`;
    }

    console.log("✅ Patch reverted successfully!");
    return true;
  } catch (error) {
    console.error("❌ Failed to revert patch:");
    console.error(error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "apply";
  const flags = args.slice(1);

  // Check if we're in a git repository
  if (!existsSync(".git")) {
    console.error(
      "❌ Not in a git repository. Please run from OpenCode root directory.",
    );
    process.exit(1);
  }

  // Check if patch file exists
  if (!existsSync(PATCH_FILE)) {
    console.error(`❌ Patch file not found: ${PATCH_FILE}`);
    console.error(
      "   Please ensure you're running from the OpenCode root directory.",
    );
    process.exit(1);
  }

  switch (command) {
    case "apply":
      // Pull from SST remote if --pull flag is present
      if (flags.includes("--pull")) {
        await pullSSTRemote();
      }

      if (await isPatchApplied()) {
        console.log("✅ AGENTS.md enforcement patch is already applied!");
        console.log(
          "   Use 'bun run script/apply-agents-patch.ts status' to check details.",
        );
        break;
      }

      const isClean = await checkGitStatus();
      if (!isClean) {
        console.warn("⚠️  Working directory has uncommitted changes.");
        console.warn(
          "   Consider committing or stashing changes before applying patch.",
        );
        console.warn("   Continue anyway? (patch will still work)");
      }

      await applyPatch();
      break;

    case "revert":
      if (!(await isPatchApplied())) {
        console.log(
          "ℹ️  AGENTS.md enforcement patch is not currently applied.",
        );
        break;
      }

      await revertPatch();
      break;

    case "status":
      const applied = await isPatchApplied();
      console.log(`Patch status: ${applied ? "✅ Applied" : "❌ Not applied"}`);

      if (applied && existsSync(MARKER_FILE)) {
        const markerContent = await Bun.file(MARKER_FILE).json();
        console.log(`Applied on: ${markerContent.applied}`);
        console.log(`Description: ${markerContent.description}`);
      }
      break;

    case "help":
      console.log(`
AGENTS.md Enforcement Patch Manager

Usage:
  bun run script/apply-agents-patch.ts [command] [flags]

Commands:
  apply   - Apply the patch (default)
  revert  - Revert the patch  
  status  - Check if patch is applied
  help    - Show this help

Flags:
  --pull  - Pull from SST remote before applying (use with apply command)

Examples:
  bun run script/apply-agents-patch.ts apply         # Apply patch only
  bun run script/apply-agents-patch.ts apply --pull  # Pull from SST then apply patch
  bun run script/apply-agents-patch.ts status        # Check patch status

What this patch does:
  - Moves AGENTS.md rules from system prompts to conversation context
  - Ensures rules survive conversation summarization cycles
  - Adds RulesPart type to message system for pinned rules
  - Fixes rule violation issues in long conversations
      `);
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.error("   Use 'help' to see available commands.");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});
