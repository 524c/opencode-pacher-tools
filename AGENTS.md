# OpenCode Tools - Agent Instructions

## Project Context

This repository manages **patches for the official OpenCode repository**. It is NOT the OpenCode codebase itself.

**Key Directories (MANDATORY STRUCTURE):**
- `patches/` - **ALL patch files (.patch) and patch documentation (README.md)**
- `tools/` - **ALL build and patch application scripts (.ts files)**
- `opencode/` - Git submodule of the official OpenCode repository (sst/opencode)

**Directory Structure Rules:**
- ✅ **Patches MUST be in `patches/` directory** - Never store .patch files elsewhere
- ✅ **Tools MUST be in `tools/` directory** - All .ts scripts go here (build, patch application, etc.)
- ✅ **Build scripts reference `tools/` and `patches/`** - All paths must use these directories
- ❌ **NEVER store patches or tools in root directory** - Strict organization required

### 🚨 CRITICAL RULE: File Creation Location (ZERO TOLERANCE)

**MANDATORY file location enforcement:**

**Forbidden in Root Directory:**
- ❌ **NEVER create `.patch` files in root** - Must be in `patches/` directory
- ❌ **NEVER create `.ts` build scripts in root** - Must be in `tools/` directory
- ❌ **NEVER create patch application scripts in root** - Must be in `tools/` directory
- ❌ **NEVER create test scripts in root** - Must be in `tools/` or temporary with `test-` prefix

**Allowed in Root Directory:**
- ✅ `README.md` - Project documentation
- ✅ `AGENTS.md` - Agent instructions (this file)
- ✅ `CHANGELOG.md` - Version history and changes (see CHANGELOG rule)
- ✅ `LICENSE` - Project license
- ✅ `setup.sh` - Initial installation script
- ✅ `install-tools.zsh` - Tools installation script
- ✅ `opencode-build.zsh` - Main build orchestrator
- ✅ `opencode-build-wrapper.zsh` - Build wrapper
- ✅ `patches.config.yaml` - Patch configuration (enabled/disabled state)
- ✅ `.gitignore`, `.gitmodules` - Git configuration

**Before Creating ANY File:**
1. **Check file type**: Is it a patch (.patch), tool (.ts), or documentation?
2. **Determine correct location**:
   - Patch → `patches/`
   - Build/patch script → `tools/`
   - Patch documentation → `PATCHES.md` (LLM regeneration recipe with problem/solution/implementation/validation)
   - Project docs → root `README.md`
   - Temporary test → Use `test-` prefix in root (will be cleaned up)
3. **Verify location exists**: Create directory if needed
4. **Create file in correct location**: Never in root unless explicitly allowed

**Validation Before Commit:**
- ❌ `git status` shows `.patch` in root → **STOP** - Move to `patches/`
- ❌ `git status` shows `.ts` script in root → **STOP** - Move to `tools/`
- ✅ All files in correct locations → Proceed with commit

**Example Violations (FORBIDDEN):**
```bash
# ❌ WRONG - patch in root
git add my-feature.patch

# ❌ WRONG - build script in root
git add build-custom.ts

# ❌ WRONG - patch application script in root
git add apply-my-patch.ts
```

**Example Correct Usage:**
```bash
# ✅ CORRECT - patch in patches/
git add patches/my-feature.patch

# ✅ CORRECT - build script in tools/
git add tools/build-custom.ts

# ✅ CORRECT - patch application script in tools/
git add tools/apply-my-patch.ts
```

**Repository Purpose:**
1. Maintain patches that enhance OpenCode functionality
2. Manage sync with upstream OpenCode (sst/opencode) via git submodule
3. Apply patches automatically during build process
4. Generate customized OpenCode binaries

---

## 🚨 CRITICAL RULE: Shell Configuration Management

**Shell config modification rules - STRICTLY ENFORCED:**

### Forbidden Operations (ZERO TOLERANCE)
- ❌ **NEVER add `source` lines to `~/.zshrc` EXCEPT during initial setup**
- ❌ **NEVER add `source` lines to `~/.bashrc`**
- ❌ **NEVER add `source` lines to `~/.bash_profile`**
- ❌ **NEVER add `source` lines to ANY other shell config file**
- ❌ **NEVER add PATH exports**
- ❌ **NEVER add environment variables**
- ❌ **NEVER add aliases**

### Exception: First-Time Setup Only
**`setup.sh` is ALLOWED to modify `~/.zshrc` ONLY when:**
1. **First installation detected**: `~/.local/bin/opencode-patcher-tools/` does not exist
2. **Source line doesn't exist**: Not already present in `~/.zshrc`
3. **Automatic addition**: Adds source line to `~/.zshrc` automatically

**Subsequent executions (updates):**
- ❌ NEVER modify `~/.zshrc` if directory already exists
- ✅ Display message: "Shell configuration not modified (already installed)"

### Current Implementation (CORRECT)
**`setup.sh` - First-time installation logic:**
```bash
# Check if this is first time installation
local is_first_install=false
if [[ ! -d "$TOOLS_DIR" ]]; then
    is_first_install=true
    log_info "First time installation detected"
else
    log_info "Existing installation detected (update mode)"
fi

# Later: Add source line ONLY on first installation
if [[ "$is_first_install" == true ]]; then
    add_source_to_zshrc
    log_info "Shell configuration updated. Reload with: source ~/.zshrc"
else
    log_info "Shell configuration not modified (already installed)"
fi
```

**`add_source_to_zshrc()` function:**
- Checks if source line already exists in `~/.zshrc`
- Adds source line only if not present
- Prevents duplicate additions

**`install-tools.zsh` (lines 108-109):**
```zsh
log_info "To use, add to your ~/.zshrc:"
echo "  source $TOOLS_DIR/opencode-build.zsh"
```
- Never modifies shell config
- Only displays instructions

### Why This Design
1. **First-time convenience**: New users get automatic setup
2. **Update safety**: Updates don't duplicate source lines
3. **User control**: Users who manage dotfiles elsewhere can remove/relocate source line
4. **Idempotent**: Re-running setup.sh multiple times is safe

### Correct Behavior for Agent Operations

**When user reports `oc-build` not found:**

1. ✅ **Check if user sourced the script**:
   ```bash
   type oc-build  # Check if function exists
   ```

2. ✅ **Instruct user to source**:
   ```bash
   source ~/.local/bin/opencode-patcher-tools/opencode-build.zsh
   ```

3. ✅ **Explain the setup**:
   "The `setup.sh` script should have added the source line to your `~/.zshrc` during first installation. If you manage your dotfiles elsewhere, you'll need to add it manually to your shell config."

4. ❌ **DO NOT:**
   - Add source line manually (setup.sh handles first-time only)
   - Modify any shell configuration file
   - Re-run setup.sh on behalf of user
   - Assume where user manages dotfiles

### Why This Rule Exists
- **First-time automation**: Simplifies initial setup for new users
- **Update idempotency**: Prevents duplicate source lines on updates
- **User autonomy**: Users can relocate source line to their dotfile manager
- **Clean updates**: Tool updates don't touch shell configs

---

## Critical Understanding: Patch Management

### What Patches Are

Patches are **concept-based modifications** to OpenCode that:
- Solve specific problems in OpenCode's behavior
- Are documented by their **abstract purpose**, not just code changes
- Must be **regenerated** when OpenCode's structure changes significantly
- Apply the **same concept** to new codebases with different structures

### Patch Philosophy

**Patches ≠ Static Code Diffs**

When you're asked to "update patches", this means:

1. **Read PATCHES.md** - Complete LLM regeneration recipe:
   - Problem description and solution approach
   - Abstract implementation strategy
   - Detailed step-by-step instructions with code examples
   - Validation checklist

2. **Understand the concept** - Extract the abstract purpose:
   - What is the problem being solved?
   - What is the conceptual solution?
   - What are the key implementation areas?

3. **Analyze current OpenCode structure** - Investigate:
   - Where are the relevant files now?
   - Has the code structure changed?
   - Are the same functions/classes present?
   - Has the logic flow changed?

4. **Regenerate the patch** - Apply the concept to current code:
   - Manually implement the conceptual changes
   - Follow the abstract strategy, not the old code
   - Adapt to new structure while preserving intent
   - Generate new patch file from git diff

5. **Validate the patch** - Ensure it works:
   - Apply patch cleanly with `git apply --check`
   - Build OpenCode successfully
   - Test that the concept is functioning
   - Verify behavior matches documented purpose

---

## Request Type Detection: Patch Updates

### Indicators of Patch Update Requests

**Portuguese phrases:**
- "o patch não está funcionando"
- "atualizar o patch"
- "patch quebrado"
- "adaptar o patch para nova versão"
- "regenerar o patch"

**English phrases:**
- "patch is not working"
- "update the patch"
- "patch is broken"
- "adapt patch for new version"
- "regenerate the patch"

**Response Protocol for Patch Updates:**

```
1. STOP and READ PATCHES.md completely:
   - Understand problem the patch solves
   - Review implementation strategy
   - Study detailed regeneration instructions
   - Check validation requirements
2. Identify which patch needs updating
3. Extract the abstract concept from PATCHES.md
4. Analyze current OpenCode structure in opencode/ (submodule)
5. Explain what you understand about:
   - The problem the patch solves
   - The conceptual solution
   - What has changed in OpenCode
   - How to adapt the solution to new structure
6. ASK for permission to regenerate the patch
7. Apply modifications manually to opencode/ (submodule)
8. Generate new patch file with git diff
9. Update PATCHES.md with any changes to:
   - Implementation strategy
   - Regeneration instructions
   - Code examples
   - Validation checklist
10. Test patch application
```

**Example Dialog:**

```
User: "O patch não está funcionando com a última versão do opencode"

Agent:
"Entendi! Vou investigar o patch atual e regenerá-lo para a versão atual do OpenCode.

1. Lendo PATCHES.md para entender o conceito...
2. O patch 'agents-md-enforcement' resolve o problema de:
   - Regras do AGENTS.md são perdidas após summarização
   - Solução: mover regras de system prompts para mensagens de conversa pinadas
3. Analisando estrutura atual do OpenCode...
4. Identificadas mudanças em: [list changes]
5. Estratégia de adaptação: [explain approach]

Posso prosseguir com a regeneração do patch?"

[WAIT for confirmation]

[After confirmation:]
"Aplicando modificações em opencode/..."
[Apply changes]
"Gerando novo patch..."
[Generate patch]
"Testando aplicação..."
[Test]
"✅ Patch atualizado e funcional!"
```

---

## Working with OpenCode Repository

### File Locations

**This repository (opencode-patcher-tools):**
- Installed at: `~/.local/bin/opencode-patcher-tools/`
- Development: Any directory where this repo is cloned
- Contains: patches, tools, documentation, OpenCode submodule

**OpenCode repository (for patching):**
- Location: `opencode/` (git submodule within this repository)
- Tracks: Official sst/opencode repository
- Branch: `dev` (default tracking branch)
- This is where patches are applied
- This is where you make modifications to regenerate patches

**Installation Structure:**
```
~/.local/bin/opencode-patcher-tools/
├── opencode/              # Git submodule (sst/opencode)
├── patches/               # Patch files (.patch) - MANDATORY LOCATION
│   ├── agents-md-enforcement.patch
│   ├── commit-hash-footer.patch
│   └── README.md          # Patch documentation
├── tools/                 # Build and patch scripts (.ts) - MANDATORY LOCATION
│   ├── apply-all-patches.ts
│   ├── apply-agents-patch.ts
│   ├── apply-commit-hash-footer-patch.ts
│   ├── build-macos-arm64.ts
│   └── build-all-platforms.ts
├── opencode-build.zsh     # Main build script
└── opencode-build-wrapper.zsh
```

**Path Reference Rules:**
- Build scripts MUST use `$OPENCODE_PATCHER_DIR/tools/` for tool scripts
- Patch scripts MUST use `$OPENCODE_PATCHER_DIR/patches/` for patch files
- NO patches or tools in root directory (strict separation)

### 🚨 CRITICAL RULE: OpenCode Submodule Workflow (ZERO TOLERANCE)

**MANDATORY: Understanding External Patch Creation**

This repository manages patches FOR OpenCode, not the OpenCode codebase itself. The OpenCode repository is a git submodule used ONLY as a workspace for patch creation.

**The Correct Workflow:**

```
User Request → Analyze Request → Design Patch Concept → Document Concept → 
Apply to opencode/ (temporary) → Generate .patch file → Reset opencode/ → 
Test patch application → Store .patch in patches/ directory
```

**CRITICAL UNDERSTANDING:**

1. **opencode/ is a WORKSPACE, not the source of truth**
   - It's a git submodule tracking official sst/opencode
   - Used ONLY for temporary modifications to generate patches
   - MUST be reset to clean state after patch generation
   - NEVER commit changes directly to opencode/ submodule

2. **Patches are stored EXTERNALLY in patches/ directory**
   - `.patch` files are the source of truth
   - These files are applied during build process
   - Modifications to OpenCode happen via patch application, not direct edits

3. **Two-Phase Process:**
   - **Phase A (Temporary):** Modify files in opencode/ → Generate .patch file
   - **Phase B (Permanent):** Reset opencode/ → Store .patch in patches/

**FORBIDDEN OPERATIONS:**

❌ **NEVER commit changes to opencode/ submodule**
   - opencode/ is a workspace, not our repository
   - Changes would corrupt the submodule state
   - Would break upstream sync

❌ **NEVER leave opencode/ in modified state**
   - After generating .patch, ALWAYS reset to clean state
   - Use `git reset --hard` to clean workspace

❌ **NEVER store patches outside patches/ directory**
   - Patches MUST be in patches/ directory
   - NO patches in root or other locations

❌ **NEVER modify OpenCode files without patch generation intent**
   - Every modification MUST result in a .patch file
   - No "temporary fixes" or "quick tests" without cleanup

**CORRECT WORKFLOW (Step-by-Step):**

```bash
# ✅ PHASE 1: Preparation
cd opencode
git status                    # Verify clean state
git reset --hard              # Clean if needed

# ✅ PHASE 2: Modification (TEMPORARY)
# Edit files according to patch concept
vim packages/opencode/src/session/prompt.ts
# Add version marker comments (see Version Tracking rule)
# Make actual modifications

# ✅ PHASE 3: Patch Generation
git add -A
git diff --cached > ../patches/my-feature.patch

# ✅ PHASE 4: Cleanup (MANDATORY)
git reset --hard              # Reset opencode/ to clean state
cd ..

# ✅ PHASE 5: Validation
cd opencode
git apply --check ../patches/my-feature.patch
git apply ../patches/my-feature.patch
bun install
bun run build:macos-arm64

# ✅ PHASE 6: Final Cleanup
git reset --hard              # Reset again after testing
cd ..

# ✅ PHASE 7: Document
# Update PATCHES.md with complete LLM regeneration recipe:
# - Problem & solution description
# - Implementation strategy
# - Detailed regeneration instructions with code examples
# - Validation checklist
```

**VALIDATION CHECKLIST (Before Completing Task):**

- [ ] opencode/ submodule is in clean state (`git status` shows no changes)
- [ ] .patch file is in patches/ directory (NOT in root or opencode/)
- [ ] PATCHES.md contains complete LLM regeneration recipe
- [ ] PATCHES.md includes problem/solution/strategy/instructions/validation
- [ ] Patch applies cleanly on clean opencode/ checkout
- [ ] Build succeeds after patch application
- [ ] opencode/ was reset after testing (not left in modified state)

**WHY THIS RULE EXISTS:**

1. **Separation of Concerns:**
   - This repo: patch management
   - opencode/ submodule: official OpenCode (read-only reference)

2. **Upstream Sync:**
   - opencode/ must stay synchronized with sst/opencode
   - Modifications would break `git submodule update`

3. **Patch Portability:**
   - Patches are independent of OpenCode version
   - Can be regenerated for new OpenCode versions
   - External storage enables version tracking

4. **Clean State:**
   - Ensures reproducible builds
   - Prevents accidental commits to upstream
   - Maintains clear workspace boundaries

**EXAMPLE: WRONG vs CORRECT**

```bash
# ❌ WRONG WORKFLOW
cd opencode
vim packages/opencode/src/session/prompt.ts  # Make changes
git add -A
git commit -m "Add feature"                   # WRONG! Commits to submodule
cd ..
git add opencode                               # WRONG! Commits submodule change
git commit -m "Update opencode"                # WRONG! Breaks submodule

# ✅ CORRECT WORKFLOW
cd opencode
vim packages/opencode/src/session/prompt.ts  # Make changes
git add -A
git diff --cached > ../patches/my-feature.patch  # Generate patch
git reset --hard                                 # Clean workspace
cd ..
git add patches/my-feature.patch                 # Add patch file
git commit -m "feat: add my-feature patch"       # Correct!
```

**DETECTION TRIGGERS:**

If you see these indicators, STOP and follow correct workflow:

- ❌ `git status` in project root shows "modified: opencode" (untracked)
- ❌ `git diff` shows changes in opencode/ submodule pointer
- ❌ Request to commit changes in opencode/ directory
- ❌ .patch files in locations other than patches/
- ❌ opencode/ has uncommitted changes when task is "complete"

**AGENT RESPONSIBILITIES:**

1. **Before ANY opencode/ modification:**
   - Verify clean state
   - Plan patch concept
   - Document intent in PATCHES.md (complete regeneration recipe)

2. **During modification:**
   - Add version markers to ALL modified lines
   - Track changes for patch generation

3. **After patch generation:**
   - IMMEDIATELY reset opencode/ to clean state
   - Validate patch applies cleanly
   - Test build with patch applied
   - Reset again after testing

4. **Before task completion:**
   - Verify opencode/ is clean
   - Verify .patch is in patches/
   - Verify PATCHES.md contains complete LLM regeneration recipe
   - Verify no submodule pointer changes in project root

**Zero Tolerance:** Any violation of this workflow requires immediate correction.

### Patch Regeneration Workflow

```bash
# 1. Ensure clean state
cd opencode  # Git submodule directory
git status  # Should be clean
git reset --hard  # If needed

# 2. Make modifications manually
# Edit files according to regeneration instructions from PATCHES.md

# 3. Generate new patch
git add -A
git diff --cached > ../patches/patch-name.patch

# 4. Test application
git reset --hard
git apply --check ../patches/patch-name.patch
git apply ../patches/patch-name.patch

# 5. Verify build
bun install
bun run build:macos-arm64

# 6. Final cleanup (MANDATORY)
git reset --hard  # Reset opencode/ after testing
cd ..
```

### 🚨 CRITICAL RULE: Version Tracking in Patch Modifications

**MANDATORY: Add version/commit markers to ALL modified lines in patches**

When manually modifying OpenCode files to regenerate a patch, you MUST add comments above each modification block to track the OpenCode version/commit where the change was applied.

**Comment Format:**
```typescript
// PATCH: <patch-name> @ OpenCode <version-or-commit>
// <Brief description of what this modification does>
[modified code block]
```

**Why This Rule Exists:**
1. **Version Identification** - Quickly identify which OpenCode version the patch was designed for
2. **Update Detection** - Easily spot which sections need review when OpenCode changes
3. **Conflict Resolution** - When patches fail to apply, markers show exact intent and context
4. **Maintenance History** - Track evolution of patch across OpenCode versions
5. **Regeneration Guidance** - Future patch regeneration knows original implementation context

**Mandatory Information in Comments:**
- **Patch name** - Which patch this modification belongs to
- **OpenCode version/commit** - Tag (e.g., `v0.15.6`) or commit hash (e.g., `2be9ed25`)
- **Modification purpose** - Brief description of what this change accomplishes

**Examples:**

```typescript
// ✅ CORRECT - Full context provided
// PATCH: agents-md-enforcement @ OpenCode v0.15.6
// Disable system prompt injection for AGENTS.md (moved to conversation-based injection)
// system.push(...(await SystemPrompt.custom()))

// PATCH: agents-md-enforcement @ OpenCode v0.15.6
// Define RulesPart message type for pinned conversation rules
export const RulesPart = PartBase.extend({
  type: z.literal("rules"),
  rules: z.string(),
  source: z.string(),
  pinned: z.boolean(),
  hash: z.string(),
})

// ❌ WRONG - No version tracking
// Disable system prompt injection
// system.push(...(await SystemPrompt.custom()))

// ❌ WRONG - Missing patch name and description
// OpenCode v0.15.6
export const RulesPart = PartBase.extend({
```

**Workflow Integration:**

```bash
# Step 2 (from Patch Regeneration Workflow): Make modifications manually
cd opencode
vim packages/opencode/src/session/prompt.ts

# Before modifying, add version marker comment:
# 1. Get current OpenCode version/commit
git describe --tags  # or: git rev-parse --short HEAD

# 2. Add comment above modification block
# PATCH: agents-md-enforcement @ OpenCode v0.15.6
# [Description of modification]

# 3. Make the actual code changes
[your modifications]

# Continue with rest of workflow (generate patch, test, etc.)
```

**Multi-Version Tracking:**

When a patch is regenerated for a new OpenCode version, keep historical markers:

```typescript
// PATCH: agents-md-enforcement @ OpenCode v0.15.6 (original)
// PATCH: agents-md-enforcement @ OpenCode v0.16.0 (updated - function signature changed)
// Disable system prompt injection for AGENTS.md
```

**Benefits During Patch Updates:**

```bash
# When patch fails to apply on new OpenCode version:
# 1. Read patch file, find version markers
grep "PATCH:.*@" ../patches/agents-md-enforcement.patch

# 2. Identify original implementation context
# "Oh, this was designed for v0.15.6, now we're on v0.16.2"

# 3. Compare with current code structure
# "The function moved from prompt.ts to rules.ts"

# 4. Adapt patch concept to new structure
# Version markers provide exact context of original intent
```

**Zero Tolerance:**
- ❌ NO modifications without version marker comments
- ❌ NO generic comments without patch name and version
- ❌ NO modifications without description of purpose

**Validation Before Generating Patch:**
```bash
# Check that all modifications have version markers
cd opencode
git diff | grep -B2 "^+" | grep "PATCH:.*@.*OpenCode"
# Should show markers for each modification block
```

---

## Documentation Standards

### 🚨 CHANGELOG.md Maintenance (MANDATORY)

**CRITICAL: Keep CHANGELOG.md updated with all significant changes**

**THE RULE:**
Every modification that affects functionality, patches, tools, or workflows MUST be documented in `CHANGELOG.md` at the root of the repository.

**When to Update CHANGELOG.md:**
- ✅ Creating, updating, or removing patches
- ✅ Adding, modifying, or removing tools (scripts in `tools/`)
- ✅ Changing build workflows or commands
- ✅ Updating shell scripts (`opencode-build.zsh`, `setup.sh`, etc.)
- ✅ Modifying project structure or directory organization
- ✅ Fixing bugs or resolving issues
- ✅ Adding or removing dependencies
- ❌ Minor documentation fixes (typos, formatting)
- ❌ Internal refactoring without behavior changes

**CHANGELOG.md Format:**

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New features, patches, tools, commands

### Changed
- Changes in existing functionality

### Fixed
- Bug fixes

### Removed
- Removed features or patches

## [X.Y.Z] - YYYY-MM-DD

### Added
- Feature description

### Changed
- Change description

### Fixed
- Fix description
```

**Workflow Integration:**

```bash
# 1. Make changes (patch, tool, workflow)
[your modifications]

# 2. IMMEDIATELY update CHANGELOG.md
vim CHANGELOG.md
# Add entry under [Unreleased] section in appropriate category

# 3. Commit changes together
git add [modified files] CHANGELOG.md
git commit -m "feat: [description]"
```

**Entry Format:**
- **Concise** - One line per change, brief but descriptive
- **Present tense** - "Add feature X" not "Added feature X"
- **User-focused** - Describe impact, not implementation details
- **Grouped by type** - Added/Changed/Fixed/Removed sections

**Examples:**

```markdown
## [Unreleased]

### Added
- New patch `provider-blacklist-config.patch` for flexible provider filtering
- Command `oc-status` to check installation and submodule status
- Build mode configuration via `OPENCODE_BUILD_MODE` environment variable

### Changed
- Updated `agents-md-enforcement.patch` for OpenCode v0.16.0 compatibility
- Improved `oc-build` performance by 60% with platform-specific builds

### Fixed
- Patch application failure on clean OpenCode checkout
- Shell configuration duplication when re-running `setup.sh`

### Removed
- Obsolete `test-build.ts` script (replaced by `test-build-all.ts`)
```

**Zero Tolerance:**
- ❌ NO significant changes without CHANGELOG.md update
- ❌ NO commit complete without CHANGELOG.md entry
- ❌ NO vague entries ("fix stuff", "update things")
- ✅ ALL changes documented clearly and concisely

**Validation Before Commit:**
```bash
# Check if CHANGELOG.md was modified alongside your changes
git status | grep CHANGELOG.md
# If not present and change is significant → STOP and update it
```

**Why This Rule Exists:**
1. **Version tracking** - Clear history of what changed and when
2. **User visibility** - Users can quickly see what's new or fixed
3. **Maintenance** - Future developers understand project evolution
4. **Release preparation** - Easy to generate release notes from CHANGELOG
5. **Communication** - Transparent project progress for all stakeholders

### PATCHES.md Documentation Standard

**CRITICAL: PATCHES.md as LLM Regeneration Recipe**

`PATCHES.md` serves as a **comprehensive instruction manual** that enables LLM agents to:
1. Understand what each patch does
2. Regenerate patches when OpenCode structure changes
3. Generate new patches following established patterns
4. Validate patch functionality

**PATCHES.md MUST contain for each patch:**

**1. Problem & Solution Description**
- What problem the patch solves
- Why the patch is necessary
- What behavior changes it introduces
- Files modified by the patch

**2. Abstract Implementation Strategy**
- High-level approach (concept-based, not code-specific)
- Key architectural decisions
- Integration points with OpenCode internals
- Design patterns used

**3. Detailed Implementation Instructions**
- Step-by-step regeneration guide
- Concrete code examples showing modifications
- Version markers to track OpenCode compatibility
- Specific functions/classes/types to modify

**4. Validation Checklist**
- How to verify patch applies cleanly
- How to test patch functionality
- Expected behavior after application
- Edge cases to validate

**Example Structure:**
```markdown
## agents-md-enforcement.patch

**Problem**: AGENTS.md rules disappear after conversation summarization

**Solution**: Move AGENTS.md from system prompts to pinned conversation messages

**Implementation Strategy**:
1. Disable system prompt injection for AGENTS.md
2. Create RulesPart message type for pinned rules
3. Inject rules as conversation messages with persistence
4. Add hash-based deduplication

**Detailed Steps**:
```typescript
// PATCH: agents-md-enforcement @ OpenCode v0.15.6
// Step 1: Disable system prompt injection (packages/opencode/src/session/prompt.ts:45)
// system.push(...(await SystemPrompt.custom()))

// Step 2: Define RulesPart type (packages/opencode/src/parts/index.ts:120)
export const RulesPart = PartBase.extend({
  type: z.literal("rules"),
  rules: z.string(),
  source: z.string(),
  pinned: z.boolean(),
  hash: z.string(),
})
```

**Validation**:
- [ ] Patch applies without conflicts
- [ ] Build succeeds after application
- [ ] Long conversations preserve AGENTS.md rules
- [ ] Rules not duplicated in conversation history
```

**Why This Matters**:
- LLM agents can regenerate patches for new OpenCode versions
- Instructions are self-contained and reproducible
- Reduces human intervention when OpenCode structure changes
- Enables generation of new patches following proven patterns

### When Updating Patches

**MANDATORY: Update PATCHES.md when:**
- Creating new patches (add complete entry)
- Regenerating patches (update implementation details)
- OpenCode structure changes (adapt regeneration steps)
- Implementation strategy evolves (document new approach)
- New validation requirements discovered (expand checklist)

### When Creating New Patches

**Before creating a new patch:**
1. Document complete entry in PATCHES.md following the LLM regeneration recipe format:
   - Problem & Solution description
   - Abstract implementation strategy
   - Detailed implementation instructions with code examples
   - Validation checklist
2. Follow existing patch documentation patterns
3. Include version markers in code examples

**After creating the patch:**
1. Test application on clean OpenCode checkout
2. Verify build succeeds
3. Test actual functionality
4. Validate patch documentation is sufficient for LLM regeneration
5. Update this AGENTS.md if new patterns emerge

---

## 🚨 Diagnostic Analysis → Patch Creation Workflow

**MANDATORY: Converting improvement opportunities into patches**

When diagnostic analysis of OpenCode submodule identifies improvement opportunities, follow this workflow to create patches.

### Detection Triggers

**When to create patches from diagnostic findings:**
- Performance bottlenecks identified in OpenCode code
- Error handling gaps or missing safeguards
- Configuration limitations (hardcoded values)
- Missing retry mechanisms or fault tolerance
- Data safety issues (migrations, backups)
- UX improvements (better feedback, clearer errors)

### Workflow: Diagnostic Analysis → Patch Creation

```
1. Diagnostic Analysis (Read-Only)
   ↓
2. Identify Improvement Opportunity
   ↓
3. Prioritize by Impact/Effort
   ↓
4. Design Patch Concept
   ↓
5. Document Concept in PATCHES.md (complete regeneration recipe)
   ↓
6. Apply to opencode/ (temporary)
   ↓
7. Generate .patch file
   ↓
8. Reset opencode/ to clean state
   ↓
9. Test patch application
   ↓
10. Validate functionality
   ↓
11. Update root README.md patches section
```

### Prioritization Framework

**High Priority (P0)** - Create immediately:
- Data corruption risks
- Critical error handling gaps
- Security vulnerabilities
- Performance issues affecting all users
- Configuration limitations blocking common use cases

**Medium Priority (P1)** - Create soon:
- UX improvements (better feedback)
- Missing retry mechanisms
- Configuration flexibility (nice-to-have)
- Performance optimizations (specific scenarios)

**Low Priority (P2)** - Create later:
- Code quality improvements
- Refactoring opportunities
- Minor optimizations

### Example: From Diagnostic Finding to Patch

**Diagnostic Finding:**
```
Issue: LSP servers marked as broken permanently until restart
File: opencode/packages/opencode/src/lsp/index.ts
Impact: Single failure = permanent loss of LSP until restart
Priority: P0 (affects developer experience)
```

**Patch Creation:**
```bash
# 1. Design concept
Concept: Automatic retry with exponential backoff (30s → 1m → 5m, max 3 attempts)

# 2. Document in PATCHES.md (complete LLM regeneration recipe)
[Add problem/solution, implementation strategy, detailed instructions, validation checklist]

# 3. Implement in opencode/
cd opencode
# Add version markers
# PATCH: lsp-retry-mechanism @ OpenCode v0.15.6
# Replace Set<string> with Map<string, BrokenServer>
[Make modifications]

# 4. Generate patch
git add -A
git diff --cached > ../patches/lsp-retry-mechanism.patch

# 5. Cleanup
git reset --hard

# 6. Test
git apply --check ../patches/lsp-retry-mechanism.patch
git apply ../patches/lsp-retry-mechanism.patch
bun install && bun run build:macos-arm64

# 7. Final cleanup
git reset --hard
cd ..

# 8. Update README.md patches section
```

### Documentation Requirements

**PATCHES.md entry MUST include (complete LLM regeneration recipe):**
1. **Problem & Solution** - What issue the patch solves and how
2. **Abstract Implementation Strategy** - High-level approach, design patterns, integration points
3. **Detailed Implementation Instructions** - Step-by-step with code examples and version markers
4. **Validation Checklist** - How to verify patch applies, builds, and functions correctly
5. **Files Modified** - List of all modified files
6. **Key Components** - Functions, classes, types added/modified
7. **Related Patches** - Dependencies and application order

**Root README.md entry:**
- List patch name by category
- Reference PATCHES.md for complete regeneration instructions

### Tracking Improvement Opportunities

**When diagnostic agent finds issues:**
- ✅ Log findings in temporary notes
- ✅ Prioritize by impact/effort
- ✅ Create patches for P0/P1 immediately
- ✅ Document P2 for future consideration
- ❌ NEVER modify opencode/ without creating patches
- ❌ NEVER leave opencode/ in modified state

**Validation:**
- All diagnostic findings converted to patches or documented as future work
- No "temporary fixes" in opencode/ without corresponding .patch files
- All patches have complete LLM regeneration recipe in PATCHES.md
- Root README.md reflects current patches with category structure

### Example Session Flow

```
User: "@diagnostic analyze opencode for improvement opportunities"

Agent (Diagnostic):
1. Read-only analysis of opencode/
2. Identify 5 improvement opportunities
3. Categorize by priority (2×P0, 2×P1, 1×P2)
4. Report findings with impact assessment

User: "Create patches for the P0 issues"

Agent (This agent):
1. Read diagnostic findings
2. Design patch concepts
3. Document complete LLM regeneration recipe in PATCHES.md:
   - Problem & solution
   - Implementation strategy
   - Detailed instructions with code examples
   - Validation checklist
4. Generate .patch files (following submodule workflow)
5. Test patch application
6. Update README.md patches section
7. Report completion with validation results
```

---

## Language Standards

**MANDATORY RULES - NO EXCEPTIONS:**

### Code and Technical Content

**MUST be in English:**
- All code (variables, functions, classes, methods)
- All code comments (inline, block, documentation)
- All Git commit messages
- All patches and patch descriptions
- All technical documentation
- All build scripts and configuration files
- All error messages and logs
- All function/variable/file naming

**Examples:**

```go
// ✅ CORRECT - English only
var CommitHash = "unknown"  // Short commit hash for version display

// ❌ WRONG - Local language
var HashCommit = "desconhecido"  // Hash curto do commit para exibir versão
```

```bash
# ✅ CORRECT - English only
# Generate patch with commit hash footer

# ❌ WRONG - Local language  
# Gerar patch com rodapé de hash do commit
```

```
✅ CORRECT commit message:
Add commit hash to TUI footer display

❌ WRONG commit message:
Adicionar hash do commit no rodapé do TUI
```

### Documentation and Communication

**English for technical docs:**
- README.md files
- AGENTS.md (this file)
- PATCHES.md (LLM regeneration recipes)
- All .md documentation files
- Code architecture documentation
- API documentation

**User's language for conversation:**
- Chat responses adapt to user's language
- Explanations use user's language
- Technical terms remain in English even in localized conversation
- Context and reasoning in user's language

**Example conversation (Portuguese user):**
```
User: "Pode adicionar o commit hash no rodapé?"

Agent: "Sim! Vou adicionar o commit hash no rodapé do TUI. 
Vou modificar a variável `Version` e adicionar `CommitHash` 
no arquivo main.go..."

[Code written in English]
var CommitHash = "unknown"  // Added for version display
```

### Why English for Code?

1. **Universal understanding** - Code readable by global community
2. **Consistency** - All OpenCode codebase is in English
3. **Collaboration** - Patches can be contributed upstream
4. **Tooling** - Better IDE support and documentation
5. **Maintenance** - Future developers understand code easily

**Zero tolerance:** ANY code, comments, or technical content in local language must be rewritten in English.

---

## 🚨 Git Commit Standards (MANDATORY)

**CRITICAL RULES - ZERO TOLERANCE:**

### Commit Message Format

**ALL commits MUST follow this format:**

```
<prefix>: <concise description>
```

**Maximum length: 70 characters (strictly enforced)**

### Commit Prefixes (MANDATORY)

Use these prefixes to categorize commits:

| Prefix | When to Use | Example |
|--------|-------------|---------|
| `feat:` | New features, commands, capabilities | `feat: add oc-up command for full upgrade workflow` |
| `fix:` | Bug fixes, error corrections | `fix: resolve patch application failure on dev branch` |
| `chore:` | Maintenance, refactoring, cleanup | `chore: remove obsolete test scripts` |
| `docs:` | Documentation only changes | `docs: update README with build mode examples` |
| `refactor:` | Code restructuring without behavior change | `refactor: split build and install logic` |
| `test:` | Adding or fixing tests | `test: add validation for patch application` |
| `style:` | Code formatting, whitespace, comments | `style: format shell scripts with consistent indentation` |
| `perf:` | Performance improvements | `perf: optimize build script execution time` |

### Prefix Selection Rules

**Choose prefix based on PRIMARY change:**

1. **New functionality** → `feat:`
   - Adding new commands, features, capabilities
   - Introducing new workflows or tools

2. **Fixing problems** → `fix:`
   - Correcting bugs, errors, broken functionality
   - Resolving issues or failures

3. **Maintenance work** → `chore:`
   - Updating dependencies, configuration
   - Cleaning up code, removing obsolete files
   - Improving build scripts without new features

4. **Documentation** → `docs:`
   - Only documentation changes (README, AGENTS.md, comments)
   - No code behavior changes

5. **Mixed changes** → Use prefix of MOST SIGNIFICANT change
   - If adding feature + docs → `feat:`
   - If fixing bug + updating docs → `fix:`
   - If refactoring + cleanup → `refactor:`

### Character Limit Enforcement

**70 characters maximum (no exceptions):**

```bash
# ✅ CORRECT (64 chars)
feat: add oc-up/oc-reinstall, shell cache, and build improvements

# ❌ WRONG (95 chars - exceeds limit)
feat: add oc-up and oc-reinstall commands with shell cache clearing and build improvements

# ✅ CORRECT (shortened to 58 chars)
feat: add oc-up/oc-reinstall with shell cache clearing
```

**Shortening strategies:**
- Remove articles: "the", "a", "an"
- Use abbreviations: "config" instead of "configuration"
- Remove redundant words: "add feature X" → "add X"
- Use "/" for related items: "X and Y" → "X/Y"
- Focus on WHAT, not HOW

### Examples (All ≤70 chars)

```bash
# ✅ Features (59 chars)
feat: add oc-up/oc-reinstall, shell cache, and build improvements

# ✅ Features (54 chars)
feat: add configurable build mode for commit/release

# ✅ Fixes (56 chars)
fix: resolve patch application failure on clean checkout

# ✅ Chores (48 chars)
chore: remove obsolete test and reinstall scripts

# ✅ Documentation (52 chars)
docs: add build performance section to README.md

# ✅ Refactoring (51 chars)
refactor: split build/install logic into functions

# ✅ Initial commit (19 chars)
chore: initial commit
```

### Validation Before Commit

**MANDATORY checks:**

1. **Check prefix**: Does commit have `prefix:` format?
2. **Check length**: Is message ≤70 characters?
3. **Check language**: Is message in English?
4. **Check clarity**: Is description concise and specific?

```bash
# Example validation
echo "feat: add oc-up/oc-reinstall, shell cache, and build improvements" | wc -c
# Output: 71 (includes newline, actual is 70) ✅

# If over 70, STOP and shorten before committing
```

### Common Mistakes

**❌ WRONG:**
```bash
# No prefix
git commit -m "add new commands and improve workflow"

# Over 70 characters
git commit -m "feat: add oc-up and oc-reinstall commands with full upgrade workflow and shell cache clearing"

# Not in English
git commit -m "feat: adicionar comandos oc-up e oc-reinstall"

# Too vague
git commit -m "feat: update stuff"

# Wrong prefix (should be feat:, not chore:)
git commit -m "chore: add new oc-up command"
```

**✅ CORRECT:**
```bash
# Proper prefix, concise, under 70 chars, English, specific
git commit -m "feat: add oc-up/oc-reinstall with shell cache clearing"
git commit -m "fix: patch application on submodule structure"
git commit -m "chore: remove obsolete test scripts"
git commit -m "docs: update README with new workflow commands"
```

### Enforcement

**Agents MUST:**
- Always suggest commits with proper prefix
- Always validate character count (≤70)
- Always write in English
- Always provide concise, specific descriptions
- Reject commits that violate these rules

**Zero tolerance:** No commits without prefix, over 70 chars, or in non-English language.

---

## Error Handling: Patch Application Failures

### When Patch Fails to Apply

**Diagnostic protocol:**

```bash
# 1. Check exact error
cd opencode  # Submodule directory
git apply --check ../patches/patch.patch 2>&1

# Errors indicate:
# - "corrupt patch" → Patch file is malformed
# - "does not apply" → Code structure has changed
# - "already applied" → Changes exist in code
```

**Response based on error:**

**Corrupt patch:**
- Patch file is incomplete or malformed
- MUST regenerate from scratch
- Read PATCHES.md for complete regeneration recipe
- Apply modifications manually following instructions
- Generate new patch

**Does not apply:**
- OpenCode structure has changed
- Lines/functions have moved or changed
- MUST analyze new structure
- Adapt concept to new codebase
- Regenerate patch

**Already applied:**
- Check if changes are actually present
- May be partial application
- Verify functionality works
- Consider regenerating for clean state

---

## Testing Requirements

### After Regenerating a Patch

**Mandatory validation:**

```bash
# 1. Clean application test
cd opencode
git reset --hard
git apply --check ../patches/patch.patch  # Must succeed
git apply ../patches/patch.patch          # Must succeed

# 2. Build test
bun install
bun run build:macos-arm64  # Must succeed

# 3. Functionality test
# Test the specific behavior the patch implements
# For agents-md-enforcement: test long conversation with rules preservation
```

**Document test results:**
- What was tested
- How it was verified
- Any unexpected behavior
- Edge cases discovered

---

## Collaboration with User

### Before Major Changes

**Always ask permission before:**
- Regenerating patches (explain changes first)
- Modifying patch concepts
- Adding new patches
- Changing regeneration workflow

### Progress Updates

**During patch regeneration:**
- Explain what you're analyzing
- Share what you've discovered
- Describe approach before implementing
- Report progress at each step
- Confirm successful completion

### Knowledge Sharing

**When explaining patches:**
- Start with the problem (why patch exists)
- Explain the conceptual solution
- Show how it's implemented
- Describe how to verify it works
- Share how to maintain it in future

---

## Key Principles

1. **Concept over code** - Understand the why, not just the what
2. **Documentation is critical** - Future you/others must understand patches
3. **Test everything** - Patches must apply cleanly and work correctly
4. **Clean workflow** - Use git properly, verify state, generate cleanly
5. **Communicate clearly** - Explain findings, ask permission, report progress
6. **Adapt intelligently** - Code changes, concepts remain; apply concepts to new code
7. **Preserve intent** - When regenerating, maintain original purpose exactly

---

## Success Criteria

**A successful patch update includes:**
- ✅ Comprehensive understanding of patch concept from PATCHES.md
- ✅ Analysis of OpenCode structure changes
- ✅ Manual implementation of concept in new structure
- ✅ Clean patch generation with git diff
- ✅ Successful patch application test
- ✅ Successful OpenCode build
- ✅ Functional testing of patched behavior
- ✅ Updated PATCHES.md with complete LLM regeneration recipe
- ✅ Clear explanation to user of what was done
- ✅ Validation checklist completed

---

Ready to help maintain patches for OpenCode with deep understanding of concepts and clean regeneration workflows.
