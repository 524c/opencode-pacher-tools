#!/usr/bin/env bun
/**
 * Apply OpenCode Patches
 *
 * Unified script to apply patches to OpenCode repository.
 * Patches are configured in patches.config.yaml and can be enabled/disabled individually.
 *
 * Features:
 * - Independent patch configuration
 * - Dependency resolution
 * - Automatic validation
 * - Category organization
 *
 * Usage:
 *   bun run tools/apply-all-patches.ts [command] [options]
 *
 * Commands:
 *   apply    - Apply enabled patches (default)
 *   status   - Show patch status
 *   enable   - Enable specific patch(es)
 *   disable  - Disable specific patch(es)
 *   list     - List all available patches
 *   help     - Show this help
 *
 * Options:
 *   --patch <id>        - Specific patch ID (for enable/disable)
 *   --category <name>   - Apply/status for specific category
 *   --all               - Apply all patches (ignore enabled flag)
 *
 * Examples:
 *   bun run tools/apply-all-patches.ts apply
 *   bun run tools/apply-all-patches.ts apply --category conversation
 *   bun run tools/apply-all-patches.ts enable --patch lsp-retry-mechanism
 *   bun run tools/apply-all-patches.ts disable --patch commit-hash-footer
 *   bun run tools/apply-all-patches.ts list
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import YAML from "yaml";

// Patch configuration interface
interface PatchCheckFile {
  path: string;
  patterns: string[];
}

interface PatchCheck {
  type: "grep";
  files: PatchCheckFile[];
}

interface PatchConfig {
  id: string;
  name: string;
  file: string;
  description: string;
  category: string;
  enabled: boolean;
  dependencies: string[];
  checkApplied: PatchCheck;
}

interface CategoryConfig {
  name: string;
  description: string;
}

interface Config {
  patches: PatchConfig[];
  categories: Record<string, CategoryConfig>;
}

// Detect directories
const SCRIPT_DIR = import.meta.dir;

// Auto-detect if running from development directory or installation
function detectToolsDir(): string {
  if (process.env.OPENCODE_PATCHER_DIR) {
    return process.env.OPENCODE_PATCHER_DIR;
  }

  // Check if running from development directory (has .git and patches/ directory)
  const devDir = join(SCRIPT_DIR, "..");
  if (existsSync(join(devDir, ".git")) && existsSync(join(devDir, "patches"))) {
    return devDir;
  }

  // Default to installation directory
  return join(homedir(), ".local/bin/opencode-patcher-tools");
}

const TOOLS_DIR = detectToolsDir();
const PATCHES_DIR = join(TOOLS_DIR, "patches");
const CONFIG_FILE = join(TOOLS_DIR, "patches.config.yaml");
const OPENCODE_DIR = join(TOOLS_DIR, "opencode");

// Load configuration
async function loadConfig(): Promise<Config> {
  if (!existsSync(CONFIG_FILE)) {
    console.error(`Configuration file not found: ${CONFIG_FILE}`);
    process.exit(1);
  }

  try {
    const configContent = await Bun.file(CONFIG_FILE).text();
    return YAML.parse(configContent) as Config;
  } catch (error) {
    console.error(`Failed to load configuration: ${error.message}`);
    process.exit(1);
  }
}

// Save configuration
async function saveConfig(config: Config): Promise<void> {
  try {
    await Bun.write(CONFIG_FILE, YAML.stringify(config));
  } catch (error) {
    console.error(`Failed to save configuration: ${error.message}`);
    process.exit(1);
  }
}

// Check if patch is applied
async function checkPatchApplied(patch: PatchConfig): Promise<boolean> {
  if (patch.checkApplied.type !== "grep") {
    return false;
  }

  try {
    for (const file of patch.checkApplied.files) {
      const filePath = join(OPENCODE_DIR, file.path);
      for (const pattern of file.patterns) {
        await $`grep -q ${pattern} ${filePath}`.quiet();
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Check git status
async function checkGitStatus(): Promise<boolean> {
  try {
    const result = await $`cd ${OPENCODE_DIR} && git status --porcelain`.text();
    return result.trim().length === 0;
  } catch {
    return false;
  }
}

// Apply single patch
async function applyPatch(patch: PatchConfig): Promise<boolean> {
  // Check if already applied
  if (await checkPatchApplied(patch)) {
    return true;
  }

  // Check if patch file exists
  const patchFile = join(PATCHES_DIR, patch.file);
  if (!existsSync(patchFile)) {
    console.error(`Patch file not found: ${patchFile}`);
    return false;
  }

  // Check if opencode directory exists
  if (!existsSync(OPENCODE_DIR)) {
    console.error(`OpenCode directory not found: ${OPENCODE_DIR}`);
    console.error(`Please initialize the git submodule first`);
    return false;
  }

  try {
    // Check if patch can be applied cleanly
    await $`cd ${OPENCODE_DIR} && git apply --check ${patchFile}`.quiet();

    // Apply the patch
    await $`cd ${OPENCODE_DIR} && git apply ${patchFile}`.quiet();

    return true;
  } catch (error) {
    // Check if changes are actually present despite error
    if (await checkPatchApplied(patch)) {
      return true;
    }

    console.error(`Failed to apply patch: ${patch.id}`);
    console.error(`Failed with exit code ${error.exitCode}`);
    return false;
  }
}

// Resolve patch dependencies
function resolveDependencies(
  patches: PatchConfig[],
  patchId: string,
  resolved: Set<string> = new Set(),
  visiting: Set<string> = new Set(),
): string[] {
  if (resolved.has(patchId)) {
    return [];
  }

  if (visiting.has(patchId)) {
    console.error(`Circular dependency detected: ${patchId}`);
    process.exit(1);
  }

  const patch = patches.find((p) => p.id === patchId);
  if (!patch) {
    console.error(`Patch not found: ${patchId}`);
    process.exit(1);
  }

  visiting.add(patchId);

  const order: string[] = [];
  for (const depId of patch.dependencies) {
    order.push(...resolveDependencies(patches, depId, resolved, visiting));
  }

  visiting.delete(patchId);
  resolved.add(patchId);
  order.push(patchId);

  return order;
}

// Apply patches with dependency resolution
async function applyPatches(
  config: Config,
  options: { category?: string; all?: boolean } = {},
): Promise<void> {
  // Filter patches by category and enabled status
  let patchesToApply = config.patches.filter((p) => {
    if (options.category && p.category !== options.category) {
      return false;
    }
    if (!options.all && !p.enabled) {
      return false;
    }
    return true;
  });

  if (patchesToApply.length === 0) {
    console.log("No patches to apply");
    return;
  }

  // Resolve dependencies
  const resolved = new Set<string>();
  const applyOrder: string[] = [];

  for (const patch of patchesToApply) {
    const deps = resolveDependencies(config.patches, patch.id, resolved);
    for (const depId of deps) {
      if (!applyOrder.includes(depId)) {
        applyOrder.push(depId);
      }
    }
  }

  // Apply in dependency order
  const results: boolean[] = [];
  for (const patchId of applyOrder) {
    const patch = config.patches.find((p) => p.id === patchId);
    if (!patch) continue;

    const result = await applyPatch(patch);
    results.push(result);
  }

  const failed = results.filter((r) => !r).length;

  if (failed > 0) {
    console.error(`${failed} patch(es) failed to apply`);
    process.exit(1);
  }
}

// Show patch status
async function showStatus(
  config: Config,
  options: { category?: string } = {},
): Promise<void> {
  console.log("📊 OpenCode Patches Status");
  console.log("=".repeat(60));

  // Group by category
  const categories = new Map<string, PatchConfig[]>();
  for (const patch of config.patches) {
    if (options.category && patch.category !== options.category) {
      continue;
    }

    if (!categories.has(patch.category)) {
      categories.set(patch.category, []);
    }
    categories.get(patch.category)!.push(patch);
  }

  // Display by category
  for (const [categoryId, patches] of categories) {
    const category = config.categories[categoryId];
    console.log(`\n${category.name}`);
    console.log("-".repeat(60));

    for (const patch of patches) {
      const applied = await checkPatchApplied(patch);
      const enabledStatus = patch.enabled ? "✅ enabled" : "❌ disabled";
      const appliedStatus = applied ? "✅ applied" : "⚠️  not applied";

      console.log(`\n${patch.name} (${patch.id}):`);
      console.log(`  Status: ${enabledStatus} | ${appliedStatus}`);
      console.log(`  Description: ${patch.description}`);

      if (patch.dependencies.length > 0) {
        console.log(`  Dependencies: ${patch.dependencies.join(", ")}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
}

// List all patches
function listPatches(
  config: Config,
  options: { category?: string } = {},
): void {
  console.log("📋 Available Patches");
  console.log("=".repeat(60));

  // Group by category
  const categories = new Map<string, PatchConfig[]>();
  for (const patch of config.patches) {
    if (options.category && patch.category !== options.category) {
      continue;
    }

    if (!categories.has(patch.category)) {
      categories.set(patch.category, []);
    }
    categories.get(patch.category)!.push(patch);
  }

  // Display by category
  for (const [categoryId, patches] of categories) {
    const category = config.categories[categoryId];
    console.log(`\n${category.name}`);
    console.log(category.description);
    console.log("-".repeat(60));

    for (const patch of patches) {
      const status = patch.enabled ? "✅" : "❌";
      console.log(`  ${status} ${patch.id}`);
      console.log(`     ${patch.description}`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

// Enable patch
async function enablePatch(config: Config, patchId: string): Promise<void> {
  const patch = config.patches.find((p) => p.id === patchId);
  if (!patch) {
    console.error(`Patch not found: ${patchId}`);
    process.exit(1);
  }

  if (patch.enabled) {
    console.log(`Patch already enabled: ${patchId}`);
    return;
  }

  patch.enabled = true;
  await saveConfig(config);
  console.log(`✅ Enabled patch: ${patchId}`);
}

// Disable patch
async function disablePatch(config: Config, patchId: string): Promise<void> {
  const patch = config.patches.find((p) => p.id === patchId);
  if (!patch) {
    console.error(`Patch not found: ${patchId}`);
    process.exit(1);
  }

  if (!patch.enabled) {
    console.log(`Patch already disabled: ${patchId}`);
    return;
  }

  // Check if any enabled patches depend on this one
  const dependents = config.patches.filter(
    (p) => p.enabled && p.dependencies.includes(patchId),
  );

  if (dependents.length > 0) {
    console.error(`Cannot disable patch: ${patchId}`);
    console.error("The following enabled patches depend on it:");
    dependents.forEach((p) => console.error(`  - ${p.id}`));
    process.exit(1);
  }

  patch.enabled = false;
  await saveConfig(config);
  console.log(`✅ Disabled patch: ${patchId}`);
}

// Show help
function showHelp(): void {
  console.log(`
OpenCode Patches Manager

Usage:
  bun run tools/apply-all-patches.ts [command] [options]

Commands:
  apply    - Apply enabled patches (default)
  status   - Show patch status
  enable   - Enable specific patch
  disable  - Disable specific patch
  list     - List all available patches
  help     - Show this help

Options:
  --patch <id>        - Specific patch ID (for enable/disable)
  --category <name>   - Filter by category
  --all               - Apply all patches (ignore enabled flag)

Examples:
  bun run tools/apply-all-patches.ts apply
  bun run tools/apply-all-patches.ts apply --category conversation
  bun run tools/apply-all-patches.ts enable --patch lsp-retry-mechanism
  bun run tools/apply-all-patches.ts disable --patch commit-hash-footer
  bun run tools/apply-all-patches.ts list
  bun run tools/apply-all-patches.ts status

Categories:
  conversation          - Conversation & Rules Preservation
  performance           - Performance & Reliability
  configuration         - Configuration & Flexibility
  developer-experience  - Developer Experience
  `);
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "apply";

  // Parse options
  const options: any = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--patch" && i + 1 < args.length) {
      options.patch = args[++i];
    } else if (args[i] === "--category" && i + 1 < args.length) {
      options.category = args[++i];
    } else if (args[i] === "--all") {
      options.all = true;
    }
  }

  // Check if we're in a git repository (file or directory)
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

  // Load configuration
  const config = await loadConfig();

  switch (command) {
    case "apply":
      const isClean = await checkGitStatus();
      if (!isClean) {
        console.warn("Working directory has uncommitted changes");
        console.warn("Patches will still be applied\n");
      }

      await applyPatches(config, options);
      break;

    case "status":
      await showStatus(config, options);
      break;

    case "list":
      listPatches(config, options);
      break;

    case "enable":
      if (!options.patch) {
        console.error("Missing --patch option");
        console.error("Usage: enable --patch <patch-id>");
        process.exit(1);
      }
      await enablePatch(config, options.patch);
      break;

    case "disable":
      if (!options.patch) {
        console.error("Missing --patch option");
        console.error("Usage: disable --patch <patch-id>");
        process.exit(1);
      }
      await disablePatch(config, options.patch);
      break;

    case "help":
      showHelp();
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
