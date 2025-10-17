# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Auto-setup routine in `oc-build` and `oc-up` commands to initialize submodule on first execution or when corrupted

### Changed
- Transform PATCHES.md into comprehensive LLM regeneration recipe with complete implementation instructions, eliminating dual-documentation approach
- `_validate_env()` now calls `_auto_setup()` to automatically fix missing or corrupted OpenCode submodule
