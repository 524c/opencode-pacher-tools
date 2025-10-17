#!/usr/bin/env zsh
#
# 🚀 OpenCode Patcher Tools Installer
#
# Installs build/sync scripts from repo to ~/.local/bin/opencode-patcher-tools/
#
# Usage:
#   ./install-tools.zsh           # Install tools
#   ./install-tools.zsh --update  # Update existing tools
#

# Note: DO NOT use 'set -e' here - we need to handle rm failures gracefully

readonly TOOLS_DIR="$HOME/.local/bin/opencode-patcher-tools"
readonly REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-${(%):-%x}}")" && pwd)"

copy_if_different() {
    local src="$1"
    local dst="$2"

    # Check if source and destination are the same file
    if [[ "$src" -ef "$dst" ]]; then
        return 0
    fi

    cp "$src" "$dst"
}

main() {
    # Detect if running from installation directory
    if [[ "$REPO_DIR" == "$TOOLS_DIR" ]]; then
        echo "✓ Tools already in place" >&2
        return 0
    fi

    echo "→ Installing tools..." >&2

    # Prune existing installation (remove old files except opencode/)
    if [[ -d "$TOOLS_DIR" ]]; then
        # Remove everything EXCEPT opencode/ directory (git submodule is large and slow to re-clone)
        find "$TOOLS_DIR" -mindepth 1 -maxdepth 1 ! -name 'opencode' -exec rm -rf {} + 2>/dev/null || true
    fi

    # Create destination directory
    mkdir -p "$TOOLS_DIR"

    # Copy main script
    copy_if_different "$REPO_DIR/opencode-build.zsh" "$TOOLS_DIR/opencode-build.zsh"
    chmod +x "$TOOLS_DIR/opencode-build.zsh"

    # Copy patch tools (survives git reset --hard)
    mkdir -p "$TOOLS_DIR/tools"
    copy_if_different "$REPO_DIR/tools/apply-agents-patch.ts" "$TOOLS_DIR/tools/apply-agents-patch.ts"
    copy_if_different "$REPO_DIR/tools/apply-all-patches.ts" "$TOOLS_DIR/tools/apply-all-patches.ts"
    copy_if_different "$REPO_DIR/tools/apply-commit-hash-footer-patch.ts" "$TOOLS_DIR/tools/apply-commit-hash-footer-patch.ts"

    # Copy patch files (survives git reset --hard)
    mkdir -p "$TOOLS_DIR/patches"
    copy_if_different "$REPO_DIR/patches/agents-md-enforcement.patch" "$TOOLS_DIR/patches/agents-md-enforcement.patch"
    copy_if_different "$REPO_DIR/patches/commit-hash-footer.patch" "$TOOLS_DIR/patches/commit-hash-footer.patch"

    # Copy build tools (survives git reset --hard)
    copy_if_different "$REPO_DIR/tools/build-macos-arm64.ts" "$TOOLS_DIR/tools/build-macos-arm64.ts"
    copy_if_different "$REPO_DIR/tools/build-all-platforms.ts" "$TOOLS_DIR/tools/build-all-platforms.ts"

    # Initialize opencode git submodule
    if [[ ! -d "$TOOLS_DIR/opencode/.git" ]]; then
        # Remove incomplete/corrupted directory
        [[ -d "$TOOLS_DIR/opencode" ]] && rm -rf "$TOOLS_DIR/opencode"
        
        git clone --quiet --depth 1 --branch dev https://github.com/sst/opencode.git "$TOOLS_DIR/opencode" 2>/dev/null
    else
        cd "$TOOLS_DIR/opencode"
        git fetch --quiet origin dev 2>/dev/null
        git reset --hard origin/dev >/dev/null 2>&1
        cd - > /dev/null
    fi

    # Clear shell command cache
    hash -r 2>/dev/null || true

    echo "✓ Done" >&2
}

main "$@"
