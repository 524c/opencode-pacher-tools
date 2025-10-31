# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed
- `summarization-enhancement-p1` patch (agent context preservation across summarization) - removed from project

### Added
- New patch `jsx-react-mode-fix.patch` for OpenCode v1.0.0 Bun build compatibility
- Auto-setup routine in `oc-build` and `oc-up` commands to initialize submodule on first execution or when corrupted
- Configurable patch system with `patches.config.yaml` for independent patch control
- Patch management commands: `enable`, `disable`, `list`, `status` with category filtering
- Dependency resolution and validation for patches
- Automatic detection of development vs installation directory in patch tools
- Package.json with project metadata and npm scripts for build/patch operations

### Changed
- Migrate patch configuration from JSON to YAML format (`patches.config.json` → `patches.config.yaml`)
- Transform PATCHES.md into comprehensive LLM regeneration recipe with complete implementation instructions, eliminating dual-documentation approach
- `_validate_env()` now calls `_auto_setup()` to automatically fix missing or corrupted OpenCode submodule
- Rewrite `tools/apply-all-patches.ts` to be configuration-driven with independent patch toggling
- Improve agent detection in agents-md-enforcement patch using msg.info.mode comparison instead of AgentPart for reliable detection of all agent switches
- Build script now automatically detects project root and changes to correct directory

### Fixed
- Preserve user's working directory when running `oc-build` or `oc-up` from non-installation directories
- Build script execution from any directory (auto-detects correct paths)
