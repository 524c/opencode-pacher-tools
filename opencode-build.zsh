#!/usr/bin/env zsh
#
# 🚀 OpenCode Build & Sync Management
#
# Strategy:
# - Local dev branch synchronized with sst/dev (upstream)
# - Patch and build done directly on dev (never committed)
# - Branch 524c maintains customizations (optional merge)
#
# Available functions:
#   opencode_sync       - Sync local dev with sst/dev (reset --hard)
#   opencode_build      - Apply patch + build on current branch
#   opencode_upgrade    - sync + build + install (full workflow)
#   opencode_status     - Show repository and installation status
#

# Execution guard: must be sourced, not executed
if [[ -n "$ZSH_VERSION" ]]; then
    if [[ "$ZSH_EVAL_CONTEXT" != *:file* ]]; then
        echo "This script must be sourced, not executed. Use: source ${(%):-%N}" >&2
        return 0 2>/dev/null || exit 1
    fi
elif [[ -n "$BASH_VERSION" ]]; then
    if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
        echo "This script must be sourced, not executed. Use: source $0" >&2
        exit 1
    fi
fi

# Output colors (use existing or set defaults)
: "${RED:=\033[0;31m}"
: "${GREEN:=\033[0;32m}"
: "${YELLOW:=\033[1;33m}"
: "${BLUE:=\033[0;34m}"
: "${PURPLE:=\033[0;35m}"
: "${CYAN:=\033[0;36m}"
: "${BOLD:=\033[1m}"
: "${DIM:=\033[2m}"
: "${NC:=\033[0m}"

# Configuration (use existing or set defaults)
: "${OPENCODE_PATCHER_DIR:=$HOME/.local/bin/opencode-patcher-tools}"
: "${OPENCODE_DIR:=$OPENCODE_PATCHER_DIR/opencode}"
: "${OPENCODE_BUILD_MODE:=release}"  # Options: release (default), commit
: "${OPENCODE_INSTALL_DIR:=$HOME/.local/bin}"  # Binary installation directory
BINARY_PATH="$OPENCODE_DIR/packages/opencode/dist/opencode-darwin-arm64/bin/opencode"
INSTALL_PATH="$OPENCODE_INSTALL_DIR/opencode"
PATCH_SCRIPT="$OPENCODE_PATCHER_DIR/tools/apply-all-patches.ts"
BUILD_SCRIPT="$OPENCODE_DIR/packages/opencode/script/build-macos-arm64.ts"

# Minimal progress indicator - no spinner, just start/end messages
_progress_start() {
    local message="$1"
    echo -e "${DIM}→${NC} ${message}" >&2
}

_progress_stop() {
    local _ps_status="$1"  # success | error | warn
    local message="$2"
    if [[ "$_ps_status" == "error" ]]; then
        echo -e "${RED}✗${NC} ${message}" >&2
    elif [[ "$_ps_status" == "success" ]]; then
        echo -e "${GREEN}✓${NC} ${message}" >&2
    fi
}


# Auto-setup: Initialize submodule if missing or corrupted
_auto_setup() {
    local needs_setup=false
    
    # Check if opencode directory doesn't exist or is empty
    if [[ ! -d "$OPENCODE_DIR" ]] || [[ ! -d "$OPENCODE_DIR/.git" ]]; then
        needs_setup=true
    fi
    
    # Check if .git is a file (submodule) but target doesn't exist
    if [[ -f "$OPENCODE_DIR/.git" ]]; then
        local git_dir=$(cat "$OPENCODE_DIR/.git" | sed 's/gitdir: //')
        if [[ ! -d "$OPENCODE_PATCHER_DIR/$git_dir" ]]; then
            needs_setup=true
        fi
    fi
    
    [[ "$needs_setup" == false ]] && return 0
    
    _progress_start "First-time setup: initializing OpenCode submodule..."
    
    # Navigate to patcher directory
    (
        cd "$OPENCODE_PATCHER_DIR" || exit 1
        
        # Remove corrupted opencode directory if exists
        [[ -d "$OPENCODE_DIR" ]] && rm -rf "$OPENCODE_DIR"
        
        # Initialize submodule
        if ! git submodule update --init --recursive 2>&1 | grep -v "^Cloning into"; then
            exit 1
        fi
    ) || {
        _progress_stop "error" "Failed to initialize OpenCode submodule"
        echo -e "${BLUE}ℹ${NC} Manual fix: cd $OPENCODE_PATCHER_DIR && git submodule update --init --recursive" >&2
        return 1
    }
    
    _progress_stop "success" "OpenCode submodule initialized"
    return 0
}

# Validate environment (with auto-setup)
_validate_env() {
    # Check bun first (required for everything)
    command -v bun >/dev/null 2>&1 || {
        echo -e "${RED}✗${NC} bun not found. Install: https://bun.sh" >&2
        return 1
    }
    
    # Auto-setup if needed (first-time or corrupted)
    _auto_setup || return 1
    
    # Final validation
    [[ ! -d "$OPENCODE_DIR" ]] && {
        echo -e "${RED}✗${NC} OpenCode directory not found after setup: $OPENCODE_DIR" >&2
        return 1
    }

    [[ ! -d "$OPENCODE_DIR/.git" ]] && {
        echo -e "${RED}✗${NC} Not a git repository after setup: $OPENCODE_DIR" >&2
        return 1
    }

    return 0
}

# Restore user's directories (preserves cd - functionality)
_restore_dirs() {
    cd "$2"
    OLDPWD="$1"
}

# Sync local dev with sst/dev or latest release
opencode_sync() {
    _validate_env || return 1

    # Save user's current directory and previous directory (do this FIRST!)
    local user_pwd="$PWD"
    local user_oldpwd="$OLDPWD"
    local return_code=0
    
    _progress_start "Syncing..."

    # All git operations in subshell to preserve OLDPWD
    (
        cd "$OPENCODE_DIR" || exit 1

        # Check if sst remote exists
        git remote | grep -q '^sst$' || {
            git remote add sst https://github.com/sst/opencode 2>/dev/null || exit 1
        }

        # Save current branch
        local current_branch=$(git branch --show-current)

        # Stash any local changes
        git diff-index --quiet HEAD -- || {
            git stash push -m "opencode-sync: auto-stash before sync" >/dev/null 2>&1
        }

        # Fetch from sst
        git fetch sst --tags 2>/dev/null || exit 1

        # Determine target based on OPENCODE_BUILD_MODE
        local target_ref
        local target_description
        
        if [[ "$OPENCODE_BUILD_MODE" == "release" ]]; then
            # Get latest release tag
            target_ref=$(git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
            
            if [[ -z "$target_ref" ]]; then
                target_ref="sst/dev"
                target_description="sst/dev (fallback)"
            else
                target_description="release $target_ref"
            fi
        else
            # Default: use dev branch (latest commit)
            git fetch sst dev 2>/dev/null || exit 1
            target_ref="sst/dev"
            target_description="sst/dev (latest commit)"
        fi
        
        # Export for parent shell
        echo "$target_description" > /tmp/opencode_sync_target.$$

        # Checkout local dev (silent unless error)
        local checkout_err=$(mktemp)
        if ! git checkout dev >/dev/null 2>"$checkout_err"; then
            if ! git checkout -b dev "$target_ref" >/dev/null 2>"$checkout_err"; then
                rm -f "$checkout_err"
                exit 1
            fi
        fi
        rm -f "$checkout_err"

        # Reset --hard to target
        git reset --hard "$target_ref" >/dev/null 2>&1 || exit 1

        # Return to original branch if it wasn't dev
        if [[ "$current_branch" != "dev" && -n "$current_branch" ]]; then
            git checkout "$current_branch" 2>/dev/null
        fi
    ) || {
        _progress_stop "error" "Sync failed"
        return 1
    }

    # Read target description and show success
    local target_desc=$(cat /tmp/opencode_sync_target.$$ 2>/dev/null || echo "target")
    rm -f /tmp/opencode_sync_target.$$
    
    _progress_stop "success" "Synced to $target_desc"

    # PWD and OLDPWD are already preserved - no cd was done in main shell!
    return $return_code
}

# Apply patch + build (auto sync + build - NO INSTALL)
opencode_build() {
    _validate_env || return 1

    # Save user's current directory and previous directory (do this FIRST!)
    local user_pwd="$PWD"
    local user_oldpwd="$OLDPWD"
    local return_code=0

    # Determine target based on OPENCODE_BUILD_MODE
    local target_ref
    local target_description
    
    _progress_start "Syncing..."
    
    # All git operations in subshell to preserve OLDPWD
    (
        cd "$OPENCODE_DIR" || exit 1

        # Check if sst remote exists
        git remote | grep -q '^sst$' || {
            git remote add sst https://github.com/sst/opencode 2>/dev/null || exit 1
        }

        # Stash any local changes
        git diff-index --quiet HEAD -- || {
            git stash push -m "opencode-build: auto-stash before sync" >/dev/null 2>&1
        }

        # Fetch tags for release mode detection
        git fetch sst --tags 2>/dev/null || exit 1
        
        if [[ "$OPENCODE_BUILD_MODE" == "release" ]]; then
            # Get latest release tag
            target_ref=$(git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
            
            if [[ -z "$target_ref" ]]; then
                target_ref="sst/dev"
                target_description="sst/dev (fallback)"
            else
                target_description="release $target_ref"
            fi
        else
            # Default: use dev branch (latest commit)
            git fetch sst dev 2>/dev/null || exit 1
            target_ref="sst/dev"
            target_description="sst/dev (latest commit)"
        fi
        
        # Export for use in parent shell
        echo "$target_ref" > /tmp/opencode_target_ref.$$
        echo "$target_description" > /tmp/opencode_target_desc.$$

        # Checkout local dev (silent unless error)
        local checkout_err=$(mktemp)
        if ! git checkout dev >/dev/null 2>"$checkout_err"; then
            if ! git checkout -b dev "$target_ref" >/dev/null 2>"$checkout_err"; then
                rm -f "$checkout_err"
                exit 1
            fi
        fi
        rm -f "$checkout_err"

        # Reset --hard to target
        git reset --hard "$target_ref" >/dev/null 2>&1 || exit 1
    ) || {
        _progress_stop "error" "Sync failed"
        return 1
    }
    
    # Read target info from temp files
    target_ref=$(cat /tmp/opencode_target_ref.$$ 2>/dev/null)
    target_description=$(cat /tmp/opencode_target_desc.$$ 2>/dev/null)
    rm -f /tmp/opencode_target_ref.$$ /tmp/opencode_target_desc.$$
    
    _progress_stop "success" "Synced to $target_description"

    # Apply patch (run from opencode directory with env var)
    [[ ! -f "$PATCH_SCRIPT" ]] && {
        _progress_stop "error" "Patch script not found"
        return 1
    }

    _progress_start "Applying patches..."
    if (cd "$OPENCODE_DIR" && OPENCODE_PATCHER_DIR="$OPENCODE_PATCHER_DIR" bun run "$PATCH_SCRIPT" apply) >/dev/null 2>&1; then
        _progress_stop "success" "Patches applied"
    else
        _progress_stop "error" "Failed to apply patches"
        return 1
    fi

    # Restore build script (survives git reset --hard)
    local installed_build_script="$OPENCODE_PATCHER_DIR/tools/build-macos-arm64.ts"
    [[ ! -f "$installed_build_script" ]] && {
        _progress_stop "error" "Build script not found"
        return 1
    }

    mkdir -p "$OPENCODE_DIR/packages/opencode/script"
    cp "$installed_build_script" "$BUILD_SCRIPT"

    # Clean build
    local dist_dir="$OPENCODE_DIR/packages/opencode/dist"
    [[ -d "$dist_dir" ]] && rm -rf "$dist_dir"

    # Build
    _progress_start "Building..."
    
    # Install dependencies
    (cd "$OPENCODE_DIR/packages/opencode" && bun install) >/dev/null 2>&1 || {
        _progress_stop "error" "Failed to install dependencies"
        return 1
    }
    
    # Run build script (captures all output)
    if ! (cd "$OPENCODE_DIR/packages/opencode" && OPENCODE_BUILD_MODE="$OPENCODE_BUILD_MODE" bun "$BUILD_SCRIPT") >/dev/null 2>&1; then
        _progress_stop "error" "Build failed"
        return 1
    fi
    
    # Validate binary
    [[ ! -f "$BINARY_PATH" ]] && {
        _progress_stop "error" "Binary not found"
        return 1
    }

    if ! "$BINARY_PATH" --version >/dev/null 2>&1; then
        _progress_stop "error" "Binary validation failed"
        return 1
    fi
    
    _progress_stop "success" "Build complete"

    # PWD and OLDPWD are already preserved - no cd was done in main shell!
    return $return_code
}

# Full workflow: build + install
opencode_upgrade() {
    # First, build
    opencode_build || {
        return 1
    }

    # Then, install with progress indicator
    _progress_start "Installing..."

    [[ ! -f "$BINARY_PATH" ]] && {
        _progress_stop "error" "Binary not found"
        return 1
    }

    # Validate binary before replacing old version
    if ! "$BINARY_PATH" --version >/dev/null 2>&1; then
        _progress_stop "error" "Binary validation failed"
        return 1
    fi

    # Install binary (move instead of symlink to avoid disk duplication)
    mkdir -p "$OPENCODE_INSTALL_DIR"
    
    # Remove old installation (symlink or file)
    [[ -L "$INSTALL_PATH" || -f "$INSTALL_PATH" ]] && rm -f "$INSTALL_PATH"

    # Move binary to installation directory (saves disk space)
    if ! mv "$BINARY_PATH" "$INSTALL_PATH"; then
        _progress_stop "error" "Failed to install binary"
        return 1
    fi

    # Remove quarantine (macOS)
    if [[ "$(uname)" == "Darwin" ]]; then
        xattr -d com.apple.quarantine "$INSTALL_PATH" 2>/dev/null
        chmod +x "$INSTALL_PATH"
    fi

    # Clear shell command cache
    hash -r 2>/dev/null || true

    # Verify installation
    if ! command -v opencode >/dev/null 2>&1; then
        _progress_stop "error" "OpenCode not in PATH"
        return 1
    fi

    _progress_stop "success" "Done"
    
    # Show final version output (consolidated)
    local version_output=""
    if command -v opencode >/dev/null 2>&1; then
        version_output=$(opencode --version 2>/dev/null)
    fi
    echo "opencode: ${version_output:-ok}" >&2

}

# Update tools from repository (correct implementation)
opencode_update_tools() {
    local temp_dir="$(mktemp -d)"
    local tools_repo="https://github.com/524c/opencode-pacher-tools.git"

    # Cleanup on exit
    trap "rm -rf '$temp_dir'" EXIT

    _progress_start "Updating tools..."
    
    git clone --quiet "$tools_repo" "$temp_dir" 2>/dev/null || {
        _progress_stop "error" "Failed to download tools"
        return 1
    }

    (cd "$temp_dir" && ./install-tools.zsh) >/dev/null 2>&1 || {
        _progress_stop "error" "Installation failed"
        return 1
    }

    _progress_stop "success" "Updated"
}

# Reinstall tools from current repository to installation directory
opencode_reinstall() {
    # Detect current repository location
    local current_repo=""
    
    # Try to find the repo by looking for characteristic files
    if [[ -f "$OPENCODE_PATCHER_DIR/../../../opencode-tools/install-tools.zsh" ]]; then
        current_repo="$OPENCODE_PATCHER_DIR/../../../opencode-tools"
    elif [[ -f "$HOME/projects/0x524c/opencode-tools/install-tools.zsh" ]]; then
        current_repo="$HOME/projects/0x524c/opencode-tools"
    fi
    
    if [[ -z "$current_repo" || ! -d "$current_repo" ]]; then
        echo -e "${RED}✗${NC} Could not find opencode-tools repository" >&2
        return 1
    fi
    
    current_repo=$(cd "$current_repo" && pwd)
    
    _progress_start "Reinstalling from $current_repo..."
    
    # Run installer from repository
    (cd "$current_repo" && ./install-tools.zsh) >/dev/null 2>&1 || {
        _progress_stop "error" "Installation failed"
        return 1
    }
    
    _progress_stop "success" "Reinstall complete"
    
    # Clear shell command cache
    hash -r 2>/dev/null || true
}

# Show repository and installation status
opencode_status() {
    _validate_env || return 1

    # Save user's current directory and previous directory (do this FIRST!)
    local user_pwd="$PWD"
    local user_oldpwd="$OLDPWD"

    # All operations in subshell to preserve OLDPWD
    (
        cd "$OPENCODE_DIR" || exit 1

        echo -e "${GREEN}📊 OpenCode Status${NC}"
        echo ""

        # Build mode
        echo -e "${BLUE}Configuration:${NC}"
        local build_mode_description
        if [[ "$OPENCODE_BUILD_MODE" == "release" ]]; then
            build_mode_description="release (latest stable version)"
        else
            build_mode_description="commit (latest dev branch)"
        fi
        echo "  Build Mode: $build_mode_description"
        echo ""

        # Git status
        local current_branch=$(git branch --show-current)
        local commit=$(git rev-parse --short HEAD)
        echo -e "${BLUE}Git:${NC}"
        echo "  Branch: $current_branch"
        echo "  Commit: $commit"

        # Check sst/dev sync
        git fetch sst dev 2>/dev/null
        local behind=$(git rev-list --count HEAD..sst/dev 2>/dev/null || echo "?")
        [[ "$behind" == "0" ]] && {
            echo -e "  Status: ${GREEN}✅ Up to date with sst/dev${NC}"
        } || {
            echo -e "  Status: ${YELLOW}⚠️  Behind sst/dev by $behind commits${NC}"
        }

        # Show latest release if in release mode
        if [[ "$OPENCODE_BUILD_MODE" == "release" ]]; then
            git fetch sst --tags 2>/dev/null
            local latest_tag=$(git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
            if [[ -n "$latest_tag" ]]; then
                local tag_commit=$(git rev-parse --short "$latest_tag" 2>/dev/null)
                echo "  Latest Release: $latest_tag ($tag_commit)"
                
                # Check if current commit matches latest release
                if [[ "$commit" == "$tag_commit" ]]; then
                    echo -e "  ${GREEN}✅ On latest release${NC}"
                else
                    echo -e "  ${YELLOW}⚠️  Not on latest release${NC}"
                fi
            fi
        fi

        # Uncommitted changes
        git diff-index --quiet HEAD -- || {
            echo -e "  ${YELLOW}⚠️  Uncommitted changes present${NC}"
        }

        echo ""

        # Binary status
        echo -e "${BLUE}Binary:${NC}"
        [[ -f "$BINARY_PATH" ]] && {
            local size=$(du -h "$BINARY_PATH" | cut -f1)
            local mtime=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$BINARY_PATH" 2>/dev/null)
            echo -e "  Built: ${GREEN}✅${NC} $size ($mtime)"
        } || {
            echo -e "  Built: ${RED}❌ Not found${NC}"
        }

        [[ -f "$INSTALL_PATH" ]] && {
            echo -e "  Installed: ${GREEN}✅${NC} $INSTALL_PATH"
        } || {
            echo -e "  Installed: ${RED}❌ Not found${NC}"
        }

        command -v opencode >/dev/null 2>&1 && {
            local version=$(opencode --version 2>/dev/null)
            local which_path=$(which opencode)
            echo -e "  In PATH: ${GREEN}✅${NC} $version"
            [[ "$which_path" == "$INSTALL_PATH" ]] || {
                echo -e "  ${YELLOW}⚠️  Different binary in PATH: $which_path${NC}"
            }
        } || {
            echo -e "  In PATH: ${RED}❌ Not found${NC}"
        }

        echo ""

        # Patch status
        echo -e "${BLUE}Patch:${NC}"
        (cd "$OPENCODE_DIR" && OPENCODE_PATCHER_DIR="$OPENCODE_PATCHER_DIR" bun run "$PATCH_SCRIPT" status 2>/dev/null) | tail -n +2
    )

    # PWD and OLDPWD are already preserved - no cd was done in main shell!
}

# Help
opencode_help() {
    cat << 'EOF'
🚀 OpenCode Build & Sync Management

FUNCTIONS:
  opencode_sync          Sync local dev with sst/dev or latest release
  opencode_build         Sync + patch + build (NO install)
  opencode_upgrade       Full workflow: sync + patch + build + install
  opencode_status        Show repository and installation status
  opencode_update_tools  Update tools from repository (prune + fresh install)
  opencode_reinstall     Full reinstall: remove + fresh clone + setup
  opencode_help          Show this help

WORKFLOW:
  oc-build            → Sync + patch + build (NO install)
  oc-up / oc-upgrade  → Sync + patch + build + install (full upgrade)
  oc-status           → Check current state
  oc-update-tools     → Update tools and patches
  oc-reinstall        → Full reinstall (remove + fresh install)

BUILD MODE:
  Configure via OPENCODE_BUILD_MODE environment variable:
  
  release (default)   → Build from latest stable release tag
  commit              → Build from latest dev branch commit
  
  Examples:
    export OPENCODE_BUILD_MODE=release  # Use latest release (default)
    export OPENCODE_BUILD_MODE=commit   # Use latest dev commit
    oc-build                            # Apply current mode

STRATEGY:
  - oc-build: Sync + patch + build (stops at build)
  - oc-up/oc-upgrade: Full cycle (sync + patch + build + install)
  - 100% non-interactive, no prompts
  - oc-update-tools downloads latest, prunes old files

EXAMPLES:
  oc-build                              # Build latest release (NO install)
  oc-up                                 # Full upgrade: build + install
  oc-upgrade                            # Same as oc-up
  OPENCODE_BUILD_MODE=commit oc-build   # Build latest commit
  oc-sync                               # Just sync (manual)
  oc-status                             # Check current state
  oc-update-tools                       # Update tools from repository
  oc-reinstall                          # Full reinstall (if corrupted)

ENVIRONMENT:
  OPENCODE_PATCHER_DIR    Path to tools installation (default: ~/.local/bin/opencode-patcher-tools)
  OPENCODE_DIR            Path to opencode repo (default: $OPENCODE_PATCHER_DIR/opencode)
  OPENCODE_BUILD_MODE     Build mode: release (default) or commit
   OPENCODE_INSTALL_DIR    Binary installation directory (default: ~/.local/bin)
 
EOF
}

# Aliases
alias oc-sync='opencode_sync'
alias oc-build='opencode_build'
alias oc-up='opencode_upgrade'
alias oc-upgrade='opencode_upgrade'
alias oc-status='opencode_status'
alias oc-update-tools='opencode_update_tools'
alias oc-reinstall='opencode_reinstall'
alias oc-help='opencode_help'

# Silent load - no output when sourced
