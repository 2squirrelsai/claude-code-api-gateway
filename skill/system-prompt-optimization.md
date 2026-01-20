# System Prompt Optimization Skill

> Transform comprehensive documentation into context-efficient, phased workflows optimized for AI development sessions.

---

## When to Use This Skill

Use this when you have:
- A comprehensive guide or documentation (100+ lines)
- Multi-step implementation instructions
- Content that would benefit from on-demand loading

**Goal**: Reduce context window usage by ~85% while maintaining full implementation guidance.

---

## Optimization Techniques

### 1. Card Catalog Architecture

Replace monolithic documents with an indexed structure:

```
BEFORE: Single 200-line guide (4,000 tokens upfront)

AFTER:
├── workflow-guide.md        # Master guide with all code
├── references/
│   ├── phase-01-*.md       # ~50-100 lines each
│   ├── phase-02-*.md
│   └── session-insights.md  # Learnings capture
```

**Token savings**: Load ~100-150 tokens per phase instead of 4,000+ for everything.

### 2. Phase-Based Decomposition

Break work into distinct phases with clear triggers:

| Element | Purpose |
|---------|---------|
| **Phase Index** | Quick lookup table with triggers |
| **Trigger Keywords** | Words that indicate phase relevance |
| **Files to Create** | Scope boundary for the phase |
| **Validation Checklist** | Phase completion criteria |

### 3. On-Demand Reference Loading

Each phase reference contains:
- **Purpose header** - When to load this file
- **File list** - What gets created
- **Key patterns** - Implementation approaches
- **Integration points** - How it connects to other phases
- **Validation checklist** - How to verify completion

### 4. Session Insights Capture

Template for learning extraction:
```markdown
### Session: YYYY-MM-DD
**Phase worked on**: [1-6]
**Key insight**:
**Issue encountered**:
**Resolution**:
**Should generalize?**: [Yes/No]
```

---

## Implementation Workflow

### Step 1: Analyze Source Material

Read the source documentation and identify:
- [ ] How many distinct phases/stages exist
- [ ] What files/components each phase produces
- [ ] Dependencies between phases
- [ ] Keywords that indicate phase relevance

### Step 2: Create Master Workflow Guide

Create `workflow-guide.md` with:
- Token savings explanation
- Phase index table with triggers
- Complete code for all phases (searchable reference)
- Quick commands section

### Step 3: Create Phase References

For each phase, create `references/phase-XX-name.md` with:

```markdown
# Phase X: [Name]

> Load this file when working on: [trigger keywords]

## Files to Create
| File | Purpose |

## Key Patterns
[Implementation approaches specific to this phase]

## Integration Points
[How this connects to other phases]

## Validation Checklist
- [ ] Verification items
```

### Step 4: Create Session Insights Template

Create `references/session-insights.md` for capturing:
- Learnings from each session
- Issues and resolutions
- Patterns to integrate back

---

## Output Structure

```
project/
├── workflow-guide.md           # Full implementation reference
├── references/
│   ├── phase-01-foundation.md  # Setup, config, utilities
│   ├── phase-02-services.md    # Core services
│   ├── phase-03-*.md           # Additional phases
│   └── session-insights.md     # Learning capture
└── skill/
    └── system-prompt-optimization.md  # This skill
```

---

## Usage Pattern

**During Development:**
```
User: "Let's work on caching"
→ Load: references/phase-02-services.md (150 tokens)
→ Reference: workflow-guide.md for code snippets as needed
```

**After Session:**
```
1. Capture insights in session-insights.md
2. Review for generalizable patterns
3. Integrate back to phase references
```

---

## Metrics

Track optimization effectiveness:
- **Before**: Total tokens for full guide
- **After**: Tokens per phase reference
- **Savings**: `(before - after) / before * 100`

Target: 80-90% token reduction per session.

---

## Example Transformation

**Input**: 200-line API gateway guide with 6 implementation steps

**Output**:
| File | Lines | Est. Tokens |
|------|-------|-------------|
| workflow-guide.md | 400 | 1,600 (full reference) |
| phase-01-foundation.md | 45 | 180 |
| phase-02-services.md | 60 | 240 |
| phase-03-queue.md | 50 | 200 |
| phase-04-monitoring.md | 55 | 220 |
| phase-05-admin.md | 65 | 260 |
| phase-06-production.md | 50 | 200 |

**Per-session cost**: 180-260 tokens vs 4,000+ for monolithic approach.
