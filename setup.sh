#!/usr/bin/env bash
#
# 🚀 OpenCode Tools - Setup Script
#
# Installs OpenCode build tools and sets up ~/.opencode-repo
#
# Usage:
#   curl -fsSL https://github.com/524c/opencode-tools/raw/branch/main/setup.sh | bash
#

set -e

readonly TOOLS_REPO="https://github.com/524c/opencode-patcher-tools"
readonly TOOLS_DIR="$HOME/.local/bin/opencode-patcher-tools"
readonly TEMP_CLONE_DIR="$(mktemp -d)"
readonly OPENCODE_REPO="$HOME/.opencode-repo"
readonly OPENCODE_UPSTREAM="https://github.com/sst/opencode"
readonly OPENCODE_BRANCH="dev"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

clone_tools_temp() {
    log_info "Cloning tools repository to temporary directory..."
    git clone --quiet "$TOOLS_REPO" "$TEMP_CLONE_DIR" || {
        log_error "Failed to clone tools repository"
        exit 1
    }
}

cleanup_temp() {
    if [[ -d "$TEMP_CLONE_DIR" ]]; then
        log_info "Cleaning up temporary directory..."
        rm -rf "$TEMP_CLONE_DIR"
    fi
}

setup_opencode_repo() {
    if [[ -d "$OPENCODE_REPO/.git" ]]; then
        log_info "OpenCode repository exists, resetting to latest $OPENCODE_BRANCH..."
        cd "$OPENCODE_REPO"
        git fetch origin "$OPENCODE_BRANCH" --quiet
        git reset --hard "origin/$OPENCODE_BRANCH" --quiet
        log_success "Reset to latest $OPENCODE_BRANCH"
    elif [[ -d "$OPENCODE_REPO" ]]; then
        log_warning "OpenCode directory exists but is not a git repository"
        log_info "Removing and cloning fresh..."
        rm -rf "$OPENCODE_REPO"
        git clone --quiet --branch "$OPENCODE_BRANCH" "$OPENCODE_UPSTREAM" "$OPENCODE_REPO"
    else
        log_info "Cloning OpenCode repository to ~/.opencode-repo..."
        git clone --quiet --branch "$OPENCODE_BRANCH" "$OPENCODE_UPSTREAM" "$OPENCODE_REPO"
    fi
}

add_source_to_zshrc() {
    local zshrc="$HOME/.zshrc"
    local source_line="source $HOME/.local/bin/opencode-patcher-tools/opencode-build.zsh"

    # Check if source line already exists
    if grep -qF "$source_line" "$zshrc" 2>/dev/null; then
        log_info "Source line already exists in ~/.zshrc"
        return 0
    fi

    # Add source line
    echo "" >> "$zshrc"
    echo "# OpenCode Patcher Tools" >> "$zshrc"
    echo "$source_line" >> "$zshrc"
    log_success "Added source line to ~/.zshrc"
}

main() {
    echo -e "${GREEN}🚀 OpenCode Tools Setup${NC}\n"

    # Check if this is first time installation
    local is_first_install=false
    if [[ ! -d "$TOOLS_DIR" ]]; then
        is_first_install=true
        log_info "First time installation detected"
    else
        log_info "Existing installation detected (update mode)"
    fi

    # Check prerequisites
    command -v git >/dev/null 2>&1 || {
        log_error "git not found. Please install git first."
        exit 1
    }

    command -v bun >/dev/null 2>&1 || {
        log_error "bun not found. Install from https://bun.sh"
        exit 1
    }

    # Setup cleanup trap
    trap cleanup_temp EXIT

    # Check if running from local workspace
    if [[ -f "$SCRIPT_DIR/install-tools.zsh" ]]; then
        log_info "Running from local workspace: $SCRIPT_DIR"
        log_info "Installing tools from workspace..."
        "$SCRIPT_DIR/install-tools.zsh"
    else
        # Clone to temporary directory
        clone_tools_temp

        # Run installer from temporary clone
        log_info "Installing tools from temporary clone..."
        (cd "$TEMP_CLONE_DIR" && ./install-tools.zsh)
    fi

    # Setup opencode repository (with reset hard)
    setup_opencode_repo

    echo ""
    log_success "Setup complete!"
    echo ""

    # Add source line to ~/.zshrc ONLY on first installation
    if [[ "$is_first_install" == true ]]; then
        add_source_to_zshrc
        echo ""
        log_info "Shell configuration updated. Reload with:"
        echo "  source ~/.zshrc"
    else
        log_info "Shell configuration not modified (already installed)"
    fi

    echo ""
    log_info "Available commands:"
    echo "  oc-build    # Build OpenCode"
    echo "  oc-status   # Check status"
}

main "$@"
