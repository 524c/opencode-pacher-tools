#!/usr/bin/env bun

/**
 * Apply commit hash footer patch to OpenCode TUI
 *
 * This patch modifies the TUI footer to display the commit hash alongside the version.
 * Instead of just "opencode dev", it will show "opencode dev + abc1234"
 *
 * Modified files:
 * 1. packages/tui/internal/app/app.go - Add CommitHash field
 * 2. packages/tui/internal/components/status/status.go - Display commit hash in logo
 * 3. packages/tui/cmd/opencode/main.go - Capture and pass commit hash
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const OPENCODE_REPO = join(process.env.HOME!, ".opencode-repo");

console.log("🔧 Applying commit hash footer patch to OpenCode TUI...\n");

// ============================================================================
// 1. Modify app.go to add CommitHash field
// ============================================================================

console.log("1️⃣  Adding CommitHash field to app.go...");

const appGoPath = join(OPENCODE_REPO, "packages/tui/internal/app/app.go");
let appGo = readFileSync(appGoPath, "utf-8");

// Add CommitHash field to App struct (after Version field)
const appStructPattern = /(\tVersion\s+string)/;
if (!appGo.match(appStructPattern)) {
  console.error("   ❌ Could not find Version field in App struct");
  process.exit(1);
}

appGo = appGo.replace(appStructPattern, "$1\n\tCommitHash        string");

writeFileSync(appGoPath, appGo);
console.log("   ✅ CommitHash field added to App struct");

// ============================================================================
// 2. Modify status.go to display commit hash in logo
// ============================================================================

console.log("\n2️⃣  Modifying status.go to display commit hash...");

const statusGoPath = join(
  OPENCODE_REPO,
  "packages/tui/internal/components/status/status.go",
);
let statusGo = readFileSync(statusGoPath, "utf-8");

// Replace the logo function to include commit hash
const logoFunctionPattern =
  /(func \(m \*statusComponent\) logo\(\) string \{[\s\S]*?)(open := base\("open"\)\n\tcode := emphasis\("code"\)\n\tversion := base\(" " \+ m\.app\.Version\))/;

if (!statusGo.match(logoFunctionPattern)) {
  console.error("   ❌ Could not find logo function pattern");
  process.exit(1);
}

statusGo = statusGo.replace(
  logoFunctionPattern,
  `$1open := base("open")
	code := emphasis("code")
	
	versionText := " " + m.app.Version
	if m.app.CommitHash != "" {
		versionText += " + " + m.app.CommitHash
	}
	version := base(versionText)`,
);

writeFileSync(statusGoPath, statusGo);
console.log("   ✅ Logo function modified to include commit hash");

// ============================================================================
// 3. Modify main.go to capture and pass commit hash
// ============================================================================

console.log("\n3️⃣  Modifying main.go to capture commit hash...");

const mainGoPath = join(OPENCODE_REPO, "packages/tui/cmd/opencode/main.go");
let mainGo = readFileSync(mainGoPath, "utf-8");

// Add CommitHash variable declaration after Version
const versionDeclPattern = /(var Version = "dev")/;
if (!mainGo.match(versionDeclPattern)) {
  console.error("   ❌ Could not find Version declaration");
  process.exit(1);
}

mainGo = mainGo.replace(
  versionDeclPattern,
  `$1
var CommitHash = ""`,
);

// Modify app.New call to pass commitHash
// Find the app.New call and add commitHash parameter
const appNewPattern = /(app_, err := app\.New\(ctx, version,)/;
if (!mainGo.match(appNewPattern)) {
  console.error("   ❌ Could not find app.New call");
  process.exit(1);
}

mainGo = mainGo.replace(
  appNewPattern,
  `commitHash := CommitHash
	if commitHash == "" {
		commitHash = "unknown"
	}

	$1 commitHash,`,
);

writeFileSync(mainGoPath, mainGo);
console.log("   ✅ main.go modified to pass commit hash");

// ============================================================================
// 4. Modify app/app.go New function to accept commitHash parameter
// ============================================================================

console.log("\n4️⃣  Modifying app.New function signature...");

// Find the New function in app.go
const newFuncPattern = /(func New\(\s*ctx context\.Context,\s*version string,)/;
if (!appGo.match(newFuncPattern)) {
  console.error("   ❌ Could not find New function signature");
  process.exit(1);
}

appGo = appGo.replace(
  newFuncPattern,
  `func New(
	ctx context.Context,
	version string,
	commitHash string,`,
);

// Find where Version is assigned in New function and add CommitHash
const versionAssignPattern = /(Version:\s+version,)/;
if (!appGo.match(versionAssignPattern)) {
  console.error("   ❌ Could not find Version assignment in New");
  process.exit(1);
}

appGo = appGo.replace(
  versionAssignPattern,
  `Version:           version,
		CommitHash:        commitHash,`,
);

writeFileSync(appGoPath, appGo);
console.log("   ✅ app.New function signature updated");

console.log("\n✅ All modifications applied successfully!");
console.log("\nNext steps:");
console.log("  1. Review changes: git -C ~/.opencode-repo diff");
console.log(
  "  2. Build OpenCode: bun run --cwd ~/.opencode-repo/packages/tui build",
);
console.log("  3. Test TUI with commit hash display");
console.log("  4. Stage changes: git -C ~/.opencode-repo add -A");
console.log(
  "  5. Generate patch: git -C ~/.opencode-repo diff --cached > patches/commit-hash-footer.patch",
);
