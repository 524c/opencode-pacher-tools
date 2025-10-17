# OpenCode Patcher Tools

Patch and build management for customizing OpenCode with automatic upstream sync.

## Quick Setup

```bash
curl -fsSL https://github.com/524c/opencode-patcher-tools/raw/branch/main/setup.sh | bash
```

## What It Does

Manages patches for the official OpenCode repository with automatic sync, patch application, and custom binary builds.

## Architecture

```
~/.local/bin/opencode-patcher-tools/      # Installation directory
├── opencode/                             # OpenCode as git submodule
├── patches/                              # Patch files and documentation
└── tools/                                # Build and patch application scripts

~/.local/bin/opencode                     # Custom binary (moved from build)
```

**Workflow**: 
- **oc-build**: Sync upstream → Apply patches → Build binary (stops here)
- **oc-up**: Sync upstream → Apply patches → Build binary → Install to $OPENCODE_INSTALL_DIR

**Git Submodule**: OpenCode is included as a git submodule, tracking the official sst/opencode repository. This ensures version consistency and simplifies setup.

**Installation**: Binary is moved directly to the installation directory (default: `~/.local/bin`) to avoid disk duplication. Use `OPENCODE_INSTALL_DIR` to customize the installation location.

**Documentation**: See `PATCHES.md` for patch descriptions, `patches/README.md` for technical details, `AGENTS.md` for AI agent instructions

## Usage

### Main Commands

```bash
oc-build         # Sync + patch + build (NO install)
oc-up            # Sync + patch + build + install (full upgrade)
oc-status        # Check status
oc-update-tools  # Update tools from repo
oc-reinstall     # Full reinstall (if corrupted)
```

### Output

Build and upgrade commands run with minimal output by design. A spinner shows progress for each phase (sync, patches, build, install). Only errors are printed immediately; successful phases stay silent. At completion you get concise summary lines:

```
opencode build: v0.15.6
opencode install: v0.15.6
```
There is no verbose or quiet toggle—minimal mode is always enabled to keep logs clean. Errors still surface instantly with a leading ✗ marker.

### Build Mode Configuration

By default, builds use the **latest stable release**. You can configure this via the `OPENCODE_BUILD_MODE` environment variable:

```bash
# Use latest release (default)
export OPENCODE_BUILD_MODE=release
oc-build

# Use latest dev commit
export OPENCODE_BUILD_MODE=commit
oc-build

# One-time override
OPENCODE_BUILD_MODE=commit oc-build
```

**Options:**
- `release` (default) - Build from latest stable release tag (e.g., `v0.0.9`)
- `commit` - Build from latest dev branch commit

**Recommendation:** Use `release` mode for stability, `commit` mode for testing bleeding-edge features.

### Without Aliases

```bash
# Full build
~/.local/bin/opencode-patcher-tools/opencode-build.zsh

# Manual workflow
cd ~/.local/bin/opencode-patcher-tools/opencode
git fetch sst dev && git reset --hard FETCH_HEAD
bun ~/.local/bin/opencode-patcher-tools/tools/apply-all-patches.ts
bun ~/.local/bin/opencode-patcher-tools/tools/build-macos-arm64.ts
```

## Build Performance

This project uses a **custom macOS ARM64 build script** (`tools/build-macos-arm64.ts`) that builds **only for your platform**, instead of OpenCode's native multi-platform build (7 platforms: Windows, Linux, macOS × x64/ARM64/baseline).

**Performance advantage**: ~60% faster build time for local development.

**How it works**:
- Detects current environment dynamically
- Builds Go TUI with commit hash
- Compiles TypeScript server with Bun
- Embeds TUI into binary
- Validates embedding and binary size

**Usage**: Automatically used by `oc-build` and `oc-up` commands.

## Patches

**7 patches** organized by category:

### Conversation & Rules Preservation (3)
- agents-md-enforcement.patch
- summarization-enhancement-p0.patch
- summarization-enhancement-p1.patch

### Performance & Reliability (2)
- lsp-retry-mechanism.patch
- storage-migration-safety.patch

### Configuration & Flexibility (1)
- provider-blacklist-config.patch

### Developer Experience (1)
- commit-hash-footer.patch

**See `PATCHES.md` for detailed patch descriptions.** Technical regeneration instructions in `patches/README.md`.

## Requirements

- Git, Bun (https://bun.sh)
- macOS ARM64 (currently supported platform)

## Updating

```bash
oc-update-tools  # Update from repository
# or
curl -fsSL https://github.com/524c/opencode-patcher-tools/raw/branch/main/setup.sh | bash
```

## Troubleshooting

```bash
# Binary not found - add to PATH
export PATH="$HOME/.local/bin:$PATH"

# Full reinstall (if corrupted/broken)
oc-reinstall

# Repository issues
oc-status  # Check status
cd ~/.local/bin/opencode-patcher-tools/opencode
git fetch sst dev && git reset --hard FETCH_HEAD

# Reinitialize submodule
cd ~/.local/bin/opencode-patcher-tools
git submodule update --init --recursive

# Update tools only
oc-update-tools
```

## Development

### Project Structure Rules

**MANDATORY directory organization:**
- `patches/` - ALL patch files (`.patch`) and patch documentation (`README.md`)
- `tools/` - ALL build and patch application scripts (`.ts` files)
- `opencode/` - Git submodule (official OpenCode repository)

**File creation rules:**
- ✅ Create patches in `patches/` directory
- ✅ Create build/patch scripts in `tools/` directory
- ❌ NEVER create `.patch` or `.ts` files in root directory

**Creating patches:**
```bash
cd ~/.local/bin/opencode-patcher-tools/opencode
# Make changes
git diff > ../patches/my-feature.patch  # Correct location
# Test with oc-build
```

**Creating build scripts:**
```bash
# Create in tools/ directory
vim ~/.local/bin/opencode-patcher-tools/tools/build-custom.ts
# Test execution
bun ~/.local/bin/opencode-patcher-tools/tools/build-custom.ts
```

**Regenerating patches:** See `patches/README.md` for concept-based regeneration instructions.

**Local development access:** From this project directory, access OpenCode via `opencode/` (git submodule).

---

**Maintainer**: [524c](https://github.com/524c) | **License**: MIT
