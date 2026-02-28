# Arena Agent — Heartbeat Checks

Run these checks on each heartbeat tick to monitor arena agent health.

## Checks

1. **Is the agent running?**
   ```bash
   pgrep -f arena-agent.js
   ```
   If no PID, the agent is idle (not necessarily a problem — sessions are time-limited).

2. **Recent errors?**
   ```bash
   tail -5 logs/agent.jsonl | grep -c '"level":"error"'
   ```
   If 3+ errors in the last 5 entries, something may be wrong. Check the log for details.

3. **Player status:**
   ```bash
   node arena-cli.js status
   ```
   Note current rank, cash, and last action time.

## Status Report Format

Summarize as: `[running/idle] | Last action: <time> | Rank: <N> | Errors: <count>`

If the agent has been idle for over 1 hour and no session was recently completed, note it but don't auto-start — wait for operator instruction.
