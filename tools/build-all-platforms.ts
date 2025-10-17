#!/usr/bin/env bun
import path from "path";
const dir = new URL("..", import.meta.url).pathname;
process.chdir(dir);
import { $ } from "bun";

import pkg from "../package.json";

const version = process.env["OPENCODE_VERSION"] ?? "dev";

// Get commit hash for TUI footer
const commitHashResult = await $`git rev-parse --short HEAD`.text();
const commitHash = commitHashResult.trim();
console.log(`Commit hash: ${commitHash}`);

// Define all target platforms
const platforms = [
  { os: "darwin", arch: "arm64" },
  { os: "darwin", arch: "amd64" },
  { os: "linux", arch: "arm64" },
  { os: "linux", arch: "amd64" },
  { os: "windows", arch: "amd64" },
];

console.log(`Building for ${platforms.length} platforms...`);
console.log("Platforms:", platforms.map((p) => `${p.os}-${p.arch}`).join(", "));

await $`rm -rf dist`;

for (const platform of platforms) {
  const { os, arch } = platform;
  const name = `${pkg.name}-${os}-${arch}`;

  console.log(`\n📦 Building ${os}-${arch}...`);

  await $`mkdir -p dist/${name}/bin`;

  // Build Go TUI
  console.log("  Building TUI (Go)...");
  const tuiOutput = os === "windows" ? "tui.exe" : "tui";
  await $`CGO_ENABLED=0 GOOS=${os} GOARCH=${arch} go build -ldflags="-s -w -X main.Version=${version} -X main.CommitHash=${commitHash}" -o ../opencode/dist/${name}/bin/${tuiOutput} ../tui/cmd/opencode/main.go`.cwd(
    "../tui",
  );

  // Prepare watcher dependency (only for macOS and Linux)
  if (os !== "windows") {
    console.log("  Preparing @parcel/watcher...");
    const watcher = `@parcel/watcher-${os}-${arch}`;

    // Try to install watcher dependency - gracefully skip if not available
    try {
      // Check if package exists first
      const checkProc = Bun.spawn(["npm", "view", watcher, "version"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await checkProc.exited;

      if (checkProc.exitCode === 0) {
        // Package exists, try to install it
        const mkdirProc = Bun.spawn(
          ["mkdir", "-p", `../../node_modules/${watcher}`],
          {
            stdout: "pipe",
            stderr: "pipe",
          },
        );
        await mkdirProc.exited;

        const packProc = Bun.spawn(["npm", "pack", watcher], {
          cwd: path.join(dir, "../../node_modules"),
          stdout: "pipe",
          stderr: "pipe",
        });
        await packProc.exited;

        if (packProc.exitCode === 0) {
          const tarProc = Bun.spawn(
            [
              "tar",
              "-xf",
              `../../node_modules/${watcher.replace("@parcel/", "parcel-")}-*.tgz`,
              "-C",
              `../../node_modules/${watcher}`,
              "--strip-components=1",
            ],
            {
              stdout: "pipe",
              stderr: "pipe",
              cwd: dir,
            },
          );
          await tarProc.exited;

          if (tarProc.exitCode === 0) {
            console.log(`  ✅ ${watcher} installed`);
          } else {
            console.log(`  ⚠️  ${watcher} tar extraction failed - skipping`);
          }
        } else {
          console.log(`  ⚠️  ${watcher} pack failed - skipping`);
        }
      } else {
        console.log(`  ⚠️  ${watcher} not available on npm - skipping`);
      }
    } catch (error) {
      console.log(`  ⚠️  ${watcher} installation failed - skipping`);
    }
  }

  // Build TypeScript server with Bun
  console.log("  Building server (Bun)...");

  const tuiPath = `dist/${name}/bin/${tuiOutput}`;
  const tuiExists = await Bun.file(tuiPath).exists();
  if (tuiExists) {
    console.log(
      `  TUI size: ${(Bun.file(tuiPath).size / 1024 / 1024).toFixed(2)} MB`,
    );
  }

  const opencodeOutput = os === "windows" ? "opencode.exe" : "opencode";
  await Bun.build({
    compile: {
      target: `bun-${os}-${arch}` as any,
      outfile: `dist/${name}/bin/${opencodeOutput}`,
      execArgv: [`--user-agent=opencode/${version}`, `--env-file=""`, `--`],
    },
    entrypoints: ["./src/index.ts"],
    define: {
      OPENCODE_VERSION: `'${version}'`,
      OPENCODE_TUI_PATH: `'../../../dist/${name}/bin/${tuiOutput}'`,
    },
  });

  const opencodePath = `dist/${name}/bin/${opencodeOutput}`;
  const sizeBeforeCleanup = Bun.file(opencodePath).size / 1024 / 1024;
  console.log(`  Binary size: ${sizeBeforeCleanup.toFixed(2)} MB`);

  // Remove TUI binary after embedding
  console.log("  Cleaning up external TUI binary...");
  await $`rm -rf ./dist/${name}/bin/${tuiOutput}`;

  const sizeAfterCleanup = Bun.file(opencodePath).size / 1024 / 1024;
  console.log(
    `  TUI embedded: ${sizeBeforeCleanup === sizeAfterCleanup ? "✅" : "❌"}`,
  );

  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name,
        version,
        os: [os],
        cpu: [arch],
      },
      null,
      2,
    ),
  );

  const binPath = path.resolve(dir, `dist/${name}/bin/${opencodeOutput}`);
  console.log(`  ✅ Complete: ${binPath}\n`);
}

console.log(`\n🎉 All platforms built successfully!`);
console.log(`\nBuilt binaries:`);
for (const platform of platforms) {
  const { os, arch } = platform;
  const name = `${pkg.name}-${os}-${arch}`;
  const opencodeOutput = os === "windows" ? "opencode.exe" : "opencode";
  console.log(`  - dist/${name}/bin/${opencodeOutput}`);
}
