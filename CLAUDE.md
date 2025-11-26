- you can use vercel cli to diretcly access the logs, the project is connected and we are
logged in

## Session Startup Protocol

At the START of each new session, Claude MUST:

1. **Read PROGRESS.md** to understand current state
   ```bash
   cat PROGRESS.md
   ```

2. **Check git status** for uncommitted work
   ```bash
   git status && git diff --stat
   ```

3. **Sync with Codex** on current priorities
   ```bash
   codex exec "Read PROGRESS.md and confirm: what should we work on next?"
   ```

4. **Update PROGRESS.md** at end of session with:
   - Tasks completed
   - Tasks in progress
   - Any blockers or notes for next session
   - Codex collaboration outcomes

## Context Window Management

To maximize efficiency across long sessions:

1. **Delegate exploration to Codex** when context is getting full
   - Codex has its own context window
   - Use for research tasks that would consume Claude's context

2. **Commit frequently** with detailed messages
   - Git history serves as external memory
   - `git log --oneline -10` to recall recent work

3. **Document decisions in PROGRESS.md**
   - Architecture choices
   - Why certain approaches were taken
   - What was tried and didn't work

4. **Use `/clear` strategically**
   - Clear after completing a major task
   - Re-read PROGRESS.md to restore context

5. **Codex as context backup**
   - Before clearing: `codex exec "Summarize current session state for handoff"`
   - After clearing: `codex exec "What did we accomplish in the last session?"`

## Codex CLI Integration (AUTONOMOUS)

Claude MUST automatically use Codex (`codex exec "prompt"`) for the following scenarios without being asked:

### Auto-Delegate to Codex (DO THIS AUTOMATICALLY):

1. **After implementing significant code (>50 lines)**
   - Ask Codex to review for edge cases, security, performance
   - Example: `codex exec "Review this new component for issues: [summary]"`

2. **Before starting complex features**
   - Have Codex draft a plan/spec first
   - Example: `codex exec "Design the approach for implementing [feature]"`

3. **When debugging is stuck (>2 failed attempts)**
   - Get fresh perspective from Codex
   - Example: `codex exec "Debug: [error message]. Tried X and Y. What else?"`

4. **For database schema changes**
   - Have Codex review migrations before applying
   - Example: `codex exec "Review this SQL migration for issues: [sql]"`

5. **When refactoring existing code**
   - Get Codex suggestions first, then Claude implements
   - Example: `codex exec "Suggest refactoring approach for [file/function]"`

6. **For architecture decisions**
   - Query Codex for alternative approaches
   - Example: `codex exec "Compare approaches for [problem]: A vs B vs C"`

### DO NOT auto-delegate:
- Simple edits (<20 lines)
- Bug fixes with obvious solutions
- Tasks where speed is critical
- When user explicitly wants Claude-only work

### How to use:
```bash
codex exec "your prompt here" 2>&1 | head -200
```

### Cross-Check Protocol:
- If Claude wrote code → Codex reviews
- If Codex suggested approach → Claude implements + validates
- For critical changes → Both must agree

### Efficiency tracking:
Log delegation results mentally to improve future decisions:
- Did Codex catch something Claude missed? → Delegate more
- Was Codex response unhelpful? → Be more specific next time
- Did parallel work save time? → Use more often