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

    # Copy package.json and install dependencies
    copy_if_different "$REPO_DIR/package.json" "$TOOLS_DIR/package.json"
    
    # Install dependencies in tools directory
    (cd "$TOOLS_DIR" && bun install --silent) >/dev/null 2>&1

    # Copy patch configuration
    copy_if_different "$REPO_DIR/patches.config.yaml" "$TOOLS_DIR/patches.config.yaml"

    # Copy patch tools (survives git reset --hard)
    mkdir -p "$TOOLS_DIR/tools"
    for script in "$REPO_DIR/tools"/*.ts; do
        [[ -f "$script" ]] && copy_if_different "$script" "$TOOLS_DIR/tools/$(basename "$script")"
    done

    # Copy all patch files (survives git reset --hard)
    mkdir -p "$TOOLS_DIR/patches"
    for patch in "$REPO_DIR/patches"/*.patch; do
        [[ -f "$patch" ]] && copy_if_different "$patch" "$TOOLS_DIR/patches/$(basename "$patch")"
    done
    # Copy patch documentation
    [[ -f "$REPO_DIR/patches/README.md" ]] && copy_if_different "$REPO_DIR/patches/README.md" "$TOOLS_DIR/patches/README.md"

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
