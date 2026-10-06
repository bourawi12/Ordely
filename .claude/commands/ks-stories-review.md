---
description: Review the story breakdown against the PRD perimeter, in a fresh-context subagent. Cheapest place to catch a bad split.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - Write
---
# ks-stories-review — Delegated review of the story breakdown

## Execution contract (non-negotiable)
You MUST complete this command by delegating to the `stories-reviewer` subagent (fresh context). You are FORBIDDEN from:
- Judging the stories yourself: you are probably the context that wrote them, hence blind to your own gaps.
- Modifying `docs/stories.md`. Your only write right is the report `docs/reviews/stories.md`, nothing else.
- Softening a verdict to move the pipeline along.

If you can't invoke the Agent tool, stop and report the error. Don't improvise.

## Workflow

### Step 1 — Prerequisites (fail-closed)
`docs/prd.md` and `docs/stories.md` must both exist. Missing PRD → STOP: "No PRD — run /ks-prd first." Missing stories → STOP: "No stories — run /ks-stories first." There is nothing to review otherwise.

### Step 2 — Delegate
Invoke the Agent tool:
- subagent_type: stories-reviewer
- description: Review the story breakdown against the PRD
- prompt: Review docs/stories.md against docs/prd.md. The stories-review skill is preloaded. Check coverage of the PRD perimeter first (every feature of the "Replicated (core loop)" table must be covered by at least one story — a gap is critical), then graveyard leaks, technical-layer stories, untestable acceptance criteria, dependency order, complexity scores, id format and overlaps. Fill the checklist from templates/stories-review-checklist.md, classify each issue (critical / major / minor), and end your report with the exact lines "Max severity: <critical|major|minor|none>" and "Stories ready: <yes|no>".

Wait for the verdict.

### Step 3 — Report
Write the full report to `docs/reviews/stories.md`. It MUST end with the exact lines `Max severity: ...` and `Stories ready: yes` or `Stories ready: no`. A single critical = no. Commit it on the default branch (docs: stories review) — it is a framing document.

### Step 4 — Outcome
- `Stories ready: no` → End with: "Stories review blocked (<max severity>). Fix docs/stories.md — rerun /ks-stories or edit it directly — then rerun /ks-stories-review."
- `Stories ready: yes` → End with: "Stories review passed. Next step: /ks-architect"

Note: this is a soft gate. It does not block the pipeline mechanically — it is surfaced by /ks-status and warned about by /ks-research. Fixing a bad split here costs a markdown edit; fixing it after five shipped stories costs cycles.
