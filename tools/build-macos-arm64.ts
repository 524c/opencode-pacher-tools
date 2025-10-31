#!/usr/bin/env bun
/**
 * Custom macOS ARM64 Build Script for OpenCode
 *
 * Based on OpenCode's native build script but customized for:
 * - Single platform builds (macOS ARM64 only)
 * - Integration with opencode-patcher-tools workflow
 * - Support for OPENCODE_BUILD_MODE environment variable
 *
 * Usage:
 *   bun tools/build-macos-arm64.ts
 *
 * Environment Variables:
 *   OPENCODE_BUILD_MODE - Build mode: "release" (default) or "commit"
 *                         release: uses latest release tag as version
 *                         commit: uses short commit hash as version
 */

import path from "path";
import { $ } from "bun";
import { readFileSync } from "fs";

// Simple logging function
const log = console.log;

// Detect script location and determine project root
const scriptDir = import.meta.dir;
const projectRoot = path.resolve(scriptDir, "..");
const opencodeDir = path.join(projectRoot, "opencode", "packages", "opencode");

// Change to OpenCode packages/opencode directory
process.chdir(opencodeDir);

// Load package.json from OpenCode directory
const currentDir = process.cwd();
let pkg;

try {
  const pkgPath = path.join(currentDir, "package.json");
  const pkgContent = readFileSync(pkgPath, "utf-8");
  pkg = { default: JSON.parse(pkgContent) };
} catch (error) {
  console.error("Error: Could not find OpenCode packages/opencode directory");
  console.error(`Expected path: ${opencodeDir}`);
  console.error(`Current directory: ${currentDir}`);
  process.exit(1);
}

// Build configuration
const os = "darwin";
const arch = "arm64";
const name = `${pkg.default.name}-${os}-${arch}`;

// Clean and prepare dist directory
await $`rm -rf dist`;
await $`mkdir -p dist/${name}/bin`;

// Get version identifier for TUI footer and binary version
const buildMode = process.env["OPENCODE_BUILD_MODE"] ?? "release";
let commitHash: string;
let version: string;

// Git commands must run from repository root (opencode/), not packages/opencode
const opencodeRepoRoot = path.join(projectRoot, "opencode");

if (buildMode === "release") {
  // Use latest release tag
  try {
    const tagResult =
      await $`cd ${opencodeRepoRoot} && git describe --tags --abbrev=0`.text();
    commitHash = tagResult.trim();
    version = commitHash; // Use release tag as version
  } catch (error) {
    // Fall back to commit hash if no release tags found
    const hashResult =
      await $`cd ${opencodeRepoRoot} && git rev-parse --short HEAD`.text();
    commitHash = hashResult.trim();
    version = commitHash;
  }
} else {
  // Use commit hash
  const hashResult =
    await $`cd ${opencodeRepoRoot} && git rev-parse --short HEAD`.text();
  commitHash = hashResult.trim();
  version = commitHash;
}

// Build Go TUI
log("\n🔨 Building TUI (Go)...");
const tuiDir = path.join(currentDir, "../tui");
const tuiOutputPath = `../opencode/dist/${name}/bin/tui`;
const tuiSourcePath = `../tui/cmd/opencode/main.go`;

try {
  await $`CGO_ENABLED=0 GOOS=${os} GOARCH=${arch} go build -ldflags="-s -w -X main.Version=${version} -X main.CommitHash=${commitHash} -X main.BuildMode=${buildMode}" -o ${tuiOutputPath} ${tuiSourcePath}`.cwd(
    tuiDir,
  );
  log("✅ TUI built successfully");
} catch (error) {
  console.error("❌ TUI build failed");
  throw error;
}

// Prepare watcher dependency
log("\n📦 Preparing @parcel/watcher...");
const watcher = `@parcel/watcher-darwin-${arch}`;
const nodeModulesDir = path.join(currentDir, "../../node_modules");

await $`mkdir -p ${nodeModulesDir}/${watcher}`;
await $`npm pack ${watcher}`.cwd(nodeModulesDir).quiet();
await $`tar -xf ${nodeModulesDir}/${watcher.replace("@parcel/", "parcel-")}-*.tgz -C ${nodeModulesDir}/${watcher} --strip-components=1`;
log("✅ Watcher prepared");

// Build TypeScript server with Bun
log("\n🔨 Building server (Bun)...");

// Verify TUI exists before building
const tuiPath = `dist/${name}/bin/tui`;
const tuiExists = await Bun.file(tuiPath).exists();

if (!tuiExists) {
  console.error(`❌ TUI binary not found at ${tuiPath}`);
  process.exit(1);
}

const tuiSize = (await Bun.file(tuiPath).size) / 1024 / 1024;
log(`📊 TUI size: ${tuiSize.toFixed(2)} MB`);

// Build server binary
await Bun.build({
  compile: {
    target: `bun-${os}-${arch}` as any,
    outfile: `dist/${name}/bin/opencode`,
    execArgv: [`--user-agent=opencode/${version}`, `--env-file=""`, `--`],
  },
  entrypoints: ["./src/index.ts"],
  define: {
    OPENCODE_VERSION: `'${version}'`,
    OPENCODE_TUI_PATH: `'../../../dist/${name}/bin/tui'`,
  },
});

// Check binary size before TUI removal
const opencodePath = `dist/${name}/bin/opencode`;
const sizeBeforeCleanup = (await Bun.file(opencodePath).size) / 1024 / 1024;
log(`📊 OpenCode binary size: ${sizeBeforeCleanup.toFixed(2)} MB`);

// Remove external TUI binary (it's now embedded in opencode binary)
log("\n🧹 Cleaning up external TUI binary...");
await $`rm -rf ./dist/${name}/bin/tui`;

// Verify size didn't change (proves TUI is embedded)
const sizeAfterCleanup = (await Bun.file(opencodePath).size) / 1024 / 1024;
log(`📊 After cleanup: ${sizeAfterCleanup.toFixed(2)} MB`);

const tuiEmbedded = sizeBeforeCleanup === sizeAfterCleanup;
log(`${tuiEmbedded ? "✅" : "❌"} TUI embedded: ${tuiEmbedded}`);

if (!tuiEmbedded) {
  console.warn(
    "⚠️  Warning: Binary size changed after TUI removal - TUI may not be properly embedded",
  );
}

// Create package.json for distribution
await Bun.file(`dist/${name}/package.json`).write(
  JSON.stringify(
    {
      name,
      version,
      os: ["darwin"],
      cpu: [arch],
    },
    null,
    2,
  ),
);

// Build complete (output handled by calling script)
